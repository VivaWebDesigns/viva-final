import Foundation

public struct PromptDetector: Sendable {
    public let extensionID: String

    public init(extensionID: String) {
        self.extensionID = extensionID
    }

    private let alwaysLabels = [
        "Always allow for this website",
        "Always allow actions on this site",
        "Always allow on this site",
    ]

    private let protectedMarkers = [
        "password", "credential", "sign in", "log in", "login", "oauth",
        "authorize", "authorization", "download", "upload", "purchase",
        "buy", "checkout", "payment", "credit card", "bank", "transfer",
        "delete", "deleting", "remove", "removing", "erase", "erasing",
        "destroy", "submit", "sensitive",
        "personal information", "social security", "ssn", "send message",
        "publish", "post comment",
    ]

    private let routinePrefixes = [
        "navigating", "opening", "reading", "searching", "scrolling",
        "inspecting", "clicking", "interacting", "viewing",
    ]

    public func detect(in root: SemanticNode) -> DetectionResult {
        let extensionRoots = root.descendantsIncludingSelf().filter {
            $0.role == "AXWebArea"
                && $0.url.hasPrefix("chrome-extension://\(extensionID)/sidepanel.html")
        }
        for extensionRoot in extensionRoots {
            let taskRoots = extensionRoot.descendantsIncludingSelf().filter {
                $0.role == "AXWebArea"
                    && ($0.url.hasPrefix("https://claude.ai/cic/task/")
                        || $0.url.hasPrefix("https://claude.ai/cic/new"))
            }
            for taskRoot in taskRoots {
                let result = detectTask(taskRoot)
                if result != .none { return result }
            }
        }
        return .none
    }

    private func detectTask(_ taskRoot: SemanticNode) -> DetectionResult {
        let nodes = taskRoot.descendantsIncludingSelf()
        let permissionPrefix = "Allow Claude to use the browser on"
        guard nodes.contains(where: {
            $0.displayedText.trimmingCharacters(in: .whitespacesAndNewlines)
                .hasPrefix(permissionPrefix)
        }) else {
            return .none
        }

        let disabledDescriptors = nodes
            .filter { $0.role == "AXButton" && !$0.enabled }
            .map(\.displayedText)
        let protectedDescriptor = disabledDescriptors.last(where: { descriptor in
            let normalized = descriptor.lowercased()
            return protectedMarkers.contains(where: normalized.contains)
        })
        let routineDescriptor = disabledDescriptors.last(where: { actionKind(from: $0) != nil })
        guard let descriptor = protectedDescriptor ?? routineDescriptor else {
            return .unknown(
                hostname: "unknown",
                permissionType: permissionPrefix,
                reason: "No recognized semantic browser action descriptor was exposed"
            )
        }

        let promptHostname = nodes.compactMap {
            permissionHostname(from: $0.displayedText)
        }.last
        let descriptorHostname = hostnameFromDescriptor(descriptor)
        guard let hostname = promptHostname ?? descriptorHostname else {
            return .unknown(
                hostname: "unknown",
                permissionType: permissionPrefix,
                reason: "Neither the permission prompt nor action descriptor exposed a hostname"
            )
        }
        let permissionType = "\(permissionPrefix) \(hostname)?"

        let buttonLabels = Set(
            nodes.filter { $0.role == "AXButton" && $0.enabled }.map(\.displayedText)
        )
        guard buttonLabels.contains("Allow once"), buttonLabels.contains("Deny") else {
            return .unknown(
                hostname: hostname,
                permissionType: permissionType,
                reason: "Expected semantic Allow once and Deny buttons were not both present"
            )
        }

        let selectedButton = alwaysLabels.first(where: buttonLabels.contains) ?? "Allow once"

        let normalizedDescriptor = descriptor.lowercased()
        if let marker = protectedMarkers.first(where: normalizedDescriptor.contains) {
            return .protected(
                hostname: hostname,
                permissionType: permissionType,
                reason: "Protected action marker: \(marker)"
            )
        }

        guard isPublicHostname(hostname) else {
            return .protected(
                hostname: hostname,
                permissionType: permissionType,
                reason: "Non-public or local hostname"
            )
        }

        guard let descriptorHostname else {
            return .unknown(
                hostname: hostname,
                permissionType: permissionType,
                reason: "The semantic browser action descriptor did not expose a hostname"
            )
        }

        if descriptorHostname.caseInsensitiveCompare(hostname) != .orderedSame
        {
            return .unknown(
                hostname: hostname,
                permissionType: permissionType,
                reason: "Prompt hostname and action hostname do not match"
            )
        }

        guard let actionKind = actionKind(from: descriptor) else {
            return .unknown(
                hostname: hostname,
                permissionType: permissionType,
                reason: "The browser action descriptor was not a recognized routine action"
            )
        }

        return .routine(
            PromptMatch(
                taskURL: taskRoot.url,
                hostname: hostname,
                permissionType: permissionType,
                actionDescriptor: descriptor,
                actionKind: actionKind,
                selectedButton: selectedButton
            )
        )
    }

    private func permissionHostname(from text: String) -> String? {
        let prefix = "Allow Claude to use the browser on "
        guard text.hasPrefix(prefix), text.hasSuffix("?") else { return nil }
        let raw = text.dropFirst(prefix.count).dropLast()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty, !raw.contains("/") else { return nil }
        return raw.lowercased()
    }

    private func actionKind(from descriptor: String) -> String? {
        let normalized = descriptor.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return routinePrefixes.first(where: { normalized.hasPrefix($0) })
    }

    private func hostnameFromDescriptor(_ descriptor: String) -> String? {
        guard let range = descriptor.range(of: #"https?://[^\s/]+"#, options: .regularExpression),
              let url = URL(string: String(descriptor[range]))
        else { return nil }
        return url.host?.lowercased()
    }

    private func isPublicHostname(_ hostname: String) -> Bool {
        let host = hostname.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
        if host == "localhost" || host.hasSuffix(".localhost") || host.hasSuffix(".local") {
            return false
        }
        if host == "0.0.0.0" || host == "::1" { return false }
        let parts = host.split(separator: ".").compactMap { Int($0) }
        if parts.count == 4 {
            if parts[0] == 10 || parts[0] == 127 { return false }
            if parts[0] == 192 && parts[1] == 168 { return false }
            if parts[0] == 172 && (16...31).contains(parts[1]) { return false }
            if parts[0] == 169 && parts[1] == 254 { return false }
        }
        return host.contains(".")
    }
}
