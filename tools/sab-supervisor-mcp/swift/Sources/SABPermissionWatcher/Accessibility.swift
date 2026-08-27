import AppKit
import ApplicationServices
import Foundation
import PermissionCore

final class LiveNode {
    let element: AXUIElement
    let semantic: SemanticNode
    let children: [LiveNode]

    init(element: AXUIElement, semantic: SemanticNode, children: [LiveNode]) {
        self.element = element
        self.semantic = semantic
        self.children = children
    }

    func descendantsIncludingSelf() -> [LiveNode] {
        [self] + children.flatMap { $0.descendantsIncludingSelf() }
    }
}

enum AccessibilityReader {
    static func chromeProcessIdentifiers() -> [pid_t] {
        NSRunningApplication.runningApplications(
            withBundleIdentifier: "com.google.Chrome"
        ).map(\.processIdentifier)
    }

    static func claudeProcessIdentifiers() -> [pid_t] {
        NSRunningApplication.runningApplications(
            withBundleIdentifier: "com.anthropic.claudefordesktop"
        ).map(\.processIdentifier)
    }

    static func readChrome(pid: pid_t, maxNodes: Int = 30_000) -> LiveNode? {
        readApplication(pid: pid, maxNodes: maxNodes)
    }

    static func readApplication(pid: pid_t, maxNodes: Int = 30_000) -> LiveNode? {
        let application = AXUIElementCreateApplication(pid)
        var visited = 0
        return read(element: application, depth: 0, visited: &visited, maxNodes: maxNodes)
    }

    static func pressContinuationButton(in root: LiveNode, match: PromptMatch) -> AXError {
        for scope in continuationScopes(in: root) {
            let nodes = scope.descendantsIncludingSelf()
            guard nodes.contains(where: {
                $0.semantic.displayedText.trimmingCharacters(in: .whitespacesAndNewlines)
                    == match.actionDescriptor
            }) else { continue }
            let buttons = nodes.filter {
                $0.semantic.role == "AXButton" && $0.semantic.enabled
                    && $0.semantic.displayedText.trimmingCharacters(in: .whitespacesAndNewlines)
                        == match.selectedButton
            }
            guard buttons.count == 1,
                  let button = buttons.first
            else { continue }
            return AXUIElementPerformAction(button.element, kAXPressAction as CFString)
        }
        return .noValue
    }

    static func pressClaudePermissionButton(in root: LiveNode, match: PromptMatch) -> AXError {
        let normalizedDescriptor = normalizedWhitespace(match.actionDescriptor)
        for scope in supervisorPermissionScopes(in: root) {
            let nodes = scope.descendantsIncludingSelf()
            let visibleText = normalizedWhitespace(
                nodes.map { $0.semantic.displayedText }.filter { !$0.isEmpty }
                    .joined(separator: " ")
            )
            guard visibleText.contains(normalizedDescriptor) else { continue }
            let buttons = nodes.filter {
                $0.semantic.role == "AXButton" && $0.semantic.enabled
                    && normalizedWhitespace($0.semantic.displayedText) == match.selectedButton
            }
            guard buttons.count == 1, let button = buttons.first else { continue }
            return AXUIElementPerformAction(button.element, kAXPressAction as CFString)
        }
        return .noValue
    }

    static func activateVisualTextControl(in root: LiveNode, label: String) -> AXError {
        let candidates = root.descendantsIncludingSelf().filter {
            $0.semantic.enabled
                && ["AXButton", "AXStaticText"].contains($0.semantic.role)
                && $0.semantic.displayedText.trimmingCharacters(in: .whitespacesAndNewlines)
                    == label
        }
        guard candidates.count == 1, let candidate = candidates.first else { return .noValue }
        if candidate.semantic.actions.contains(kAXPressAction as String) {
            return AXUIElementPerformAction(candidate.element, kAXPressAction as CFString)
        }
        guard let position = pointAttribute(candidate.element, kAXPositionAttribute),
              let size = sizeAttribute(candidate.element, kAXSizeAttribute),
              size.width > 0, size.height > 0
        else { return .noValue }

        let point = CGPoint(x: position.x + size.width / 2, y: position.y + size.height / 2)
        guard let down = CGEvent(
            mouseEventSource: nil,
            mouseType: .leftMouseDown,
            mouseCursorPosition: point,
            mouseButton: .left
        ), let up = CGEvent(
            mouseEventSource: nil,
            mouseType: .leftMouseUp,
            mouseCursorPosition: point,
            mouseButton: .left
        ) else { return .failure }
        down.post(tap: .cghidEventTap)
        up.post(tap: .cghidEventTap)
        return .success
    }

    static func visibleTextControlCount(in root: LiveNode, label: String) -> Int {
        root.descendantsIncludingSelf().filter {
            $0.semantic.enabled
                && ["AXButton", "AXStaticText"].contains($0.semantic.role)
                && $0.semantic.displayedText.trimmingCharacters(in: .whitespacesAndNewlines)
                    == label
        }.count
    }

    static func pressButton(
        in root: LiveNode,
        extensionID: String,
        match: PromptMatch
    ) -> AXError {
        let extensionRoots = root.descendantsIncludingSelf().filter {
            $0.semantic.role == "AXWebArea"
                && $0.semantic.url.hasPrefix("chrome-extension://\(extensionID)/sidepanel.html")
        }
        for extensionRoot in extensionRoots {
            let taskRoots = extensionRoot.semantic.url == match.taskURL
                ? [extensionRoot]
                : extensionRoot.descendantsIncludingSelf().filter {
                $0.semantic.role == "AXWebArea" && $0.semantic.url == match.taskURL
            }
            for taskRoot in taskRoots {
                let nodes = taskRoot.descendantsIncludingSelf()
                guard nodes.contains(where: {
                    $0.semantic.displayedText == match.actionDescriptor
                }), let button = nodes.last(where: {
                    $0.semantic.role == "AXButton"
                        && $0.semantic.enabled
                        && $0.semantic.displayedText == match.selectedButton
                }) else {
                    continue
                }
                return AXUIElementPerformAction(button.element, kAXPressAction as CFString)
            }
        }
        return .noValue
    }

    static func taskNode(
        in root: LiveNode,
        extensionID: String,
        taskURL: String
    ) -> LiveNode? {
        let extensionRoots = root.descendantsIncludingSelf().filter {
            $0.semantic.role == "AXWebArea"
                && $0.semantic.url.hasPrefix("chrome-extension://\(extensionID)/sidepanel.html")
        }
        for extensionRoot in extensionRoots {
            if extensionRoot.semantic.url == taskURL { return extensionRoot }
            if let task = extensionRoot.descendantsIncludingSelf().first(where: {
                $0.semantic.role == "AXWebArea" && $0.semantic.url == taskURL
            }) {
                return task
            }
        }
        return nil
    }

    private static func continuationScopes(in node: LiveNode) -> [LiveNode] {
        let childMatches = node.children.flatMap { continuationScopes(in: $0) }
        if !childMatches.isEmpty { return childMatches }

        let descendants = node.descendantsIncludingSelf()
        let hasExactMessage = descendants.contains {
            $0.semantic.displayedText.trimmingCharacters(in: .whitespacesAndNewlines)
                == PromptDetector.toolUseLimitMessage
        }
        let buttons = descendants.filter {
            $0.semantic.role == "AXButton" && $0.semantic.enabled
                && $0.semantic.displayedText.trimmingCharacters(in: .whitespacesAndNewlines)
                    == "Continue"
        }
        let messageIndexes = descendants.indices.filter {
            descendants[$0].semantic.displayedText
                .trimmingCharacters(in: .whitespacesAndNewlines)
                == PromptDetector.toolUseLimitMessage
        }
        let buttonIndexes = descendants.indices.filter {
            descendants[$0].semantic.role == "AXButton"
                && descendants[$0].semantic.enabled
                && descendants[$0].semantic.displayedText
                    .trimmingCharacters(in: .whitespacesAndNewlines) == "Continue"
        }
        let hasAdjacentPair = messageIndexes.contains { messageIndex in
            buttonIndexes.contains { buttonIndex in buttonIndex == messageIndex + 1 }
        }
        let hasConflictingAction = descendants.contains {
            $0.semantic.role == "AXButton" && $0.semantic.enabled
                && ["Cancel", "Deny"].contains(
                    $0.semantic.displayedText.trimmingCharacters(in: .whitespacesAndNewlines)
                )
        }
        let unsafeContainerRoles = ["AXApplication", "AXWindow", "AXWebArea"]
        guard hasExactMessage,
              buttons.count == 1,
              hasAdjacentPair,
              !hasConflictingAction,
              !unsafeContainerRoles.contains(node.semantic.role),
              descendants.count <= 500
        else { return [] }
        return [node]
    }

    private static func supervisorPermissionScopes(in node: LiveNode) -> [LiveNode] {
        let childMatches = node.children.flatMap { supervisorPermissionScopes(in: $0) }
        if !childMatches.isEmpty { return childMatches }

        let descendants = node.descendantsIncludingSelf()
        let visibleText = normalizedWhitespace(
            descendants.map { $0.semantic.displayedText }.filter { !$0.isEmpty }
                .joined(separator: " ")
        )
        let matchingTools = PromptDetector.supervisorToolTitles.filter {
            visibleText.contains(
                "Claude wants to use \($0) from \(PromptDetector.supervisorServerName)"
            )
        }
        let enabledButtonLabels = descendants.filter {
            $0.semantic.role == "AXButton" && $0.semantic.enabled
        }.map { normalizedWhitespace($0.semantic.displayedText) }
        let unsafeContainerRoles = ["AXApplication", "AXWindow", "AXWebArea"]
        guard matchingTools.count == 1,
              enabledButtonLabels.filter({ $0 == "Deny" }).count == 1,
              enabledButtonLabels.filter({ $0 == "Always allow" }).count == 1,
              enabledButtonLabels.filter({ $0 == "Allow once" }).count == 1,
              !unsafeContainerRoles.contains(node.semantic.role),
              descendants.count <= 80
        else { return [] }
        return [node]
    }

    private static func normalizedWhitespace(_ value: String) -> String {
        value.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
    }

    private static func read(
        element: AXUIElement,
        depth: Int,
        visited: inout Int,
        maxNodes: Int
    ) -> LiveNode? {
        guard depth <= 32, visited < maxNodes else { return nil }
        visited += 1

        let role = stringAttribute(element, kAXRoleAttribute)
        let title = stringAttribute(element, kAXTitleAttribute)
        let description = stringAttribute(element, kAXDescriptionAttribute)
        let label = !title.isEmpty ? title : description
        let value = stringAttribute(element, kAXValueAttribute)
        let url = stringAttribute(element, "AXURL")
        let enabled = boolAttribute(element, kAXEnabledAttribute) ?? true
        let actions = actionNames(element)
        let childElements = elementArrayAttribute(element, kAXChildrenAttribute)
        let liveChildren = childElements.compactMap {
            read(element: $0, depth: depth + 1, visited: &visited, maxNodes: maxNodes)
        }
        let semanticChildren = liveChildren.map(\.semantic)
        let semantic = SemanticNode(
            role: role,
            label: label,
            value: value,
            url: url,
            enabled: enabled,
            actions: actions,
            children: semanticChildren
        )
        return LiveNode(element: element, semantic: semantic, children: liveChildren)
    }

    private static func copyAttribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else {
            return nil
        }
        return value
    }

    private static func stringAttribute(_ element: AXUIElement, _ name: String) -> String {
        guard let raw = copyAttribute(element, name) else { return "" }
        if let value = raw as? String { return value }
        if let value = raw as? URL { return value.absoluteString }
        return "\(raw)"
    }

    private static func boolAttribute(_ element: AXUIElement, _ name: String) -> Bool? {
        copyAttribute(element, name) as? Bool
    }

    private static func pointAttribute(_ element: AXUIElement, _ name: String) -> CGPoint? {
        guard let raw = copyAttribute(element, name),
              CFGetTypeID(raw) == AXValueGetTypeID()
        else { return nil }
        var point = CGPoint.zero
        guard AXValueGetValue(raw as! AXValue, .cgPoint, &point) else { return nil }
        return point
    }

    private static func sizeAttribute(_ element: AXUIElement, _ name: String) -> CGSize? {
        guard let raw = copyAttribute(element, name),
              CFGetTypeID(raw) == AXValueGetTypeID()
        else { return nil }
        var size = CGSize.zero
        guard AXValueGetValue(raw as! AXValue, .cgSize, &size) else { return nil }
        return size
    }

    private static func elementArrayAttribute(
        _ element: AXUIElement,
        _ name: String
    ) -> [AXUIElement] {
        copyAttribute(element, name) as? [AXUIElement] ?? []
    }

    private static func actionNames(_ element: AXUIElement) -> [String] {
        var names: CFArray?
        guard AXUIElementCopyActionNames(element, &names) == .success else { return [] }
        return names as? [String] ?? []
    }
}
