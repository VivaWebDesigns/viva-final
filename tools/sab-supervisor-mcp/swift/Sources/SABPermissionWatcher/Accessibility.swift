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

    static func readChrome(pid: pid_t, maxNodes: Int = 30_000) -> LiveNode? {
        let application = AXUIElementCreateApplication(pid)
        var visited = 0
        return read(element: application, depth: 0, visited: &visited, maxNodes: maxNodes)
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
