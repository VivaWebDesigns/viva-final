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

    private let routineBatchActions = [
        "navigate", "get_page_text", "get_tabs", "find", "search", "scroll",
        "click", "hover", "wait", "screenshot",
    ]

    private let routineTargetlessTools = [
        "tabs_create_mcp", "tabs_context_mcp",
    ]

    public func detect(in root: SemanticNode) -> DetectionResult {
        detectAll(in: root).first ?? .none
    }

    public func detectAll(in root: SemanticNode) -> [DetectionResult] {
        var results: [DetectionResult] = []
        let windows = root.descendantsIncludingSelf().filter { $0.role == "AXWindow" }
        let scopes = windows.isEmpty ? [root] : windows
        for scope in scopes {
            let fallbackHostname = visiblePageHostname(in: scope)
            let extensionRoots = scope.descendantsIncludingSelf().filter {
                $0.role == "AXWebArea"
                    && $0.url.hasPrefix("chrome-extension://\(extensionID)/sidepanel.html")
            }
            for extensionRoot in extensionRoots {
                if extensionRoot.url.contains("mcpPermissionOnly=true") {
                    let result = detectMcpPermissionOnly(extensionRoot)
                    if result != .none { results.append(result) }
                    continue
                }
                let taskRoots = extensionRoot.descendantsIncludingSelf().filter {
                    $0.role == "AXWebArea"
                        && isClaudeTaskURL($0.url)
                }
                for taskRoot in taskRoots {
                    let result = detectTask(taskRoot, fallbackHostname: fallbackHostname)
                    if result != .none { results.append(result) }
                }
            }
        }
        return results
    }

    private func detectMcpPermissionOnly(_ permissionRoot: SemanticNode) -> DetectionResult {
        let nodes = permissionRoot.descendantsIncludingSelf()
        let navigationPrefix = "Claude wants to navigate to:"
        guard let actionDescriptor = nodes.map(\.displayedText).last(where: {
            $0.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix(navigationPrefix)
        }) else { return .none }

        let rawHostname = actionDescriptor.trimmingCharacters(in: .whitespacesAndNewlines)
            .dropFirst(navigationPrefix.count)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard !rawHostname.isEmpty, !rawHostname.contains("/") else {
            return .unknown(
                hostname: "unknown",
                permissionType: "New permissions required",
                reason: "The MCP permission window did not expose one hostname"
            )
        }
        guard isPublicHostname(rawHostname) else {
            return .protected(
                hostname: rawHostname,
                permissionType: "New permissions required",
                reason: "Non-public or local hostname"
            )
        }

        let buttonLabels = nodes.filter { $0.role == "AXButton" && $0.enabled }
            .map(\.displayedText)
        guard buttonLabels.contains(where: { $0 == "Allow this action" }),
              buttonLabels.contains(where: { $0 == "Decline" }),
              let persistentButton = buttonLabels.first(where: {
                  $0.hasPrefix("Always allow actions on this site")
              })
        else {
            return .unknown(
                hostname: rawHostname,
                permissionType: "New permissions required",
                reason: "The MCP permission window did not expose the expected semantic approval controls"
            )
        }

        return .routine(
            PromptMatch(
                taskURL: permissionRoot.url,
                hostname: rawHostname,
                permissionType: "New permissions required",
                actionDescriptor: actionDescriptor,
                actionKind: "mcp_navigate",
                selectedButton: persistentButton
            )
        )
    }

    private func detectTask(
        _ taskRoot: SemanticNode,
        fallbackHostname: String?
    ) -> DetectionResult {
        let nodes = taskRoot.descendantsIncludingSelf()
        let permissionPrefix = "Allow Claude to use the browser on"
        if let permissionMarker = nodes.map(\.displayedText).last(where: {
            $0.trimmingCharacters(in: .whitespacesAndNewlines)
                .hasPrefix(permissionPrefix)
        }) {
            return detectLegacyTask(
                taskRoot,
                nodes: nodes,
                permissionPrefix: permissionPrefix,
                permissionMarker: permissionMarker
            )
        }

        guard let permissionMarker = nodes.map(\.displayedText).last(where: {
            $0.trimmingCharacters(in: .whitespacesAndNewlines)
                .hasPrefix("Permission request:")
        }) else { return .none }

        return detectPermissionRequest(
            taskRoot,
            nodes: nodes,
            permissionMarker: permissionMarker,
            fallbackHostname: fallbackHostname
        )
    }

    private func detectLegacyTask(
        _ taskRoot: SemanticNode,
        nodes: [SemanticNode],
        permissionPrefix: String,
        permissionMarker: String
    ) -> DetectionResult {

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

        let buttonLabels = nodes.filter { $0.role == "AXButton" && $0.enabled }
            .map(\.displayedText)
        guard approvalButton(prefix: "Allow once", in: buttonLabels) != nil,
              approvalButton(prefix: "Deny", in: buttonLabels) != nil
        else {
            return .unknown(
                hostname: hostname,
                permissionType: permissionType,
                reason: "Expected semantic Allow once and Deny buttons were not both present"
            )
        }

        let selectedButton = alwaysLabels.compactMap {
            approvalButton(prefix: $0, in: buttonLabels)
        }.first ?? approvalButton(prefix: "Allow once", in: buttonLabels)!

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
                actionDescriptor: permissionMarker,
                actionKind: actionKind,
                selectedButton: selectedButton
            )
        )
    }

    private func detectPermissionRequest(
        _ taskRoot: SemanticNode,
        nodes: [SemanticNode],
        permissionMarker: String,
        fallbackHostname: String?
    ) -> DetectionResult {
        let permissionType = permissionMarker.trimmingCharacters(in: .whitespacesAndNewlines)
        let toolName = permissionType.dropFirst("Permission request:".count)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let buttonLabels = nodes.filter { $0.role == "AXButton" && $0.enabled }
            .map(\.displayedText)
        guard let allowButton = approvalButton(prefix: "Allow once", in: buttonLabels),
              approvalButton(prefix: "Deny", in: buttonLabels) != nil
        else {
            return .unknown(
                hostname: "unknown",
                permissionType: permissionType,
                reason: "Candidate Claude permission prompt did not expose semantic Allow once and Deny buttons"
            )
        }
        let selectedButton = alwaysLabels.compactMap {
            approvalButton(prefix: $0, in: buttonLabels)
        }.first ?? allowButton

        if routineTargetlessTools.contains(toolName) {
            return .routine(
                PromptMatch(
                    taskURL: taskRoot.url,
                    hostname: fallbackHostname ?? "browser-session",
                    permissionType: permissionType,
                    actionDescriptor: permissionMarker,
                    actionKind: toolName,
                    selectedButton: selectedButton
                )
            )
        }

        if toolName == "javascript_tool" {
            return detectReadOnlyJavaScriptPermission(
                taskRoot,
                nodes: nodes,
                permissionMarker: permissionMarker,
                permissionType: permissionType,
                allowButton: selectedButton,
                fallbackHostname: fallbackHostname
            )
        }

        if toolName != "browser_batch" {
            return detectSinglePermissionRequest(
                taskRoot,
                nodes: nodes,
                permissionMarker: permissionMarker,
                permissionType: permissionType,
                toolName: toolName,
                allowButton: selectedButton,
                fallbackHostname: fallbackHostname
            )
        }

        guard let payloadText = nodes.map(\.displayedText).last(where: { batchPayload(from: $0) != nil }),
              let actions = batchPayload(from: payloadText)
        else {
            return .unknown(
                hostname: "unknown",
                permissionType: permissionType,
                reason: "Candidate browser_batch prompt did not expose a readable semantic JSON payload"
            )
        }

        let normalizedPayload = payloadText.lowercased()
        if let marker = protectedMarkers.first(where: normalizedPayload.contains) {
            return .protected(
                hostname: hostnames(in: actions).first ?? "unknown",
                permissionType: permissionType,
                reason: "Protected action marker in browser_batch payload: \(marker)"
            )
        }

        let actionNames = actions.compactMap { $0["name"] as? String }
        guard actionNames.count == actions.count, !actionNames.isEmpty else {
            return .unknown(
                hostname: hostnames(in: actions).first ?? "unknown",
                permissionType: permissionType,
                reason: "Candidate browser_batch payload contained an unnamed or empty action"
            )
        }
        guard actionNames.allSatisfy({ routineBatchActions.contains($0) }) else {
            let unsupported = actionNames.filter { !routineBatchActions.contains($0) }
            return .unknown(
                hostname: hostnames(in: actions).first ?? "unknown",
                permissionType: permissionType,
                reason: "Candidate browser_batch contained unsupported actions: \(unsupported.joined(separator: ", "))"
            )
        }

        let hosts = Array(Set(hostnames(in: actions)))
        guard hosts.count == 1, let hostname = hosts.first else {
            return .unknown(
                hostname: hosts.first ?? "unknown",
                permissionType: permissionType,
                reason: "Candidate browser_batch did not expose exactly one target hostname"
            )
        }
        guard isPublicHostname(hostname) else {
            return .protected(
                hostname: hostname,
                permissionType: permissionType,
                reason: "Non-public or local hostname"
            )
        }

        return .routine(
            PromptMatch(
                taskURL: taskRoot.url,
                hostname: hostname,
                permissionType: permissionType,
                actionDescriptor: permissionMarker,
                actionKind: "browser_batch:\(actionNames.joined(separator: ","))",
                selectedButton: selectedButton
            )
        )
    }

    private func detectReadOnlyJavaScriptPermission(
        _ taskRoot: SemanticNode,
        nodes: [SemanticNode],
        permissionMarker: String,
        permissionType: String,
        allowButton: String,
        fallbackHostname: String?
    ) -> DetectionResult {
        guard let payloadText = nodes.map(\.displayedText).last(where: {
            guard let payload = jsonObject(from: $0) else { return false }
            return payload["action"] as? String == "javascript_exec"
        }), let payload = jsonObject(from: payloadText),
              let script = payload["text"] as? String
        else {
            return .unknown(
                hostname: fallbackHostname ?? "unknown",
                permissionType: permissionType,
                reason: "Candidate javascript_tool prompt did not expose a readable javascript_exec payload"
            )
        }

        let normalizedScript = script.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ";"))
            .replacingOccurrences(of: #"\s+"#, with: "", options: .regularExpression)
            .lowercased()
        let approvedExpressions = [
            "document.title",
            "window.document.title",
            "({title:document.title,url:location.href})",
            "({title:document.title,url:window.location.href})",
        ]
        guard approvedExpressions.contains(normalizedScript) else {
            return .unknown(
                hostname: fallbackHostname ?? "unknown",
                permissionType: permissionType,
                reason: "Candidate javascript_tool script was not an approved read-only title expression"
            )
        }
        guard let hostname = fallbackHostname else {
            return .unknown(
                hostname: "unknown",
                permissionType: permissionType,
                reason: "Candidate javascript_tool prompt could not be associated with one visible public page"
            )
        }
        guard isPublicHostname(hostname) else {
            return .protected(
                hostname: hostname,
                permissionType: permissionType,
                reason: "Non-public or local hostname"
            )
        }

        return .routine(
            PromptMatch(
                taskURL: taskRoot.url,
                hostname: hostname,
                permissionType: permissionType,
                actionDescriptor: permissionMarker,
                actionKind: "javascript_tool:document.title",
                selectedButton: allowButton
            )
        )
    }

    private func detectSinglePermissionRequest(
        _ taskRoot: SemanticNode,
        nodes: [SemanticNode],
        permissionMarker: String,
        permissionType: String,
        toolName: String,
        allowButton: String,
        fallbackHostname: String?
    ) -> DetectionResult {
        guard routineBatchActions.contains(toolName) else {
            return .unknown(
                hostname: fallbackHostname ?? "unknown",
                permissionType: permissionType,
                reason: "Candidate Claude prompt requested unsupported tool \(toolName)"
            )
        }
        guard let payloadText = nodes.map(\.displayedText).last(where: { jsonObject(from: $0) != nil }),
              let payload = jsonObject(from: payloadText)
        else {
            return .unknown(
                hostname: fallbackHostname ?? "unknown",
                permissionType: permissionType,
                reason: "Candidate \(toolName) prompt did not expose a readable semantic JSON payload"
            )
        }

        let normalizedPayload = payloadText.lowercased()
        if let marker = protectedMarkers.first(where: normalizedPayload.contains) {
            return .protected(
                hostname: hostname(in: payload) ?? fallbackHostname ?? "unknown",
                permissionType: permissionType,
                reason: "Protected action marker in \(toolName) payload: \(marker)"
            )
        }

        guard let hostname = hostname(in: payload) ?? fallbackHostname else {
            return .unknown(
                hostname: "unknown",
                permissionType: permissionType,
                reason: "Candidate \(toolName) prompt could not be associated with one visible public page"
            )
        }
        guard isPublicHostname(hostname) else {
            return .protected(
                hostname: hostname,
                permissionType: permissionType,
                reason: "Non-public or local hostname"
            )
        }

        return .routine(
            PromptMatch(
                taskURL: taskRoot.url,
                hostname: hostname,
                permissionType: permissionType,
                actionDescriptor: permissionMarker,
                actionKind: toolName,
                selectedButton: allowButton
            )
        )
    }

    private func approvalButton(prefix: String, in labels: [String]) -> String? {
        labels.first { label in
            let normalized = label.trimmingCharacters(in: .whitespacesAndNewlines)
            guard normalized.hasPrefix(prefix) else { return false }
            let suffix = normalized.dropFirst(prefix.count)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            return suffix.isEmpty || suffix.allSatisfy(\.isNumber)
        }
    }

    private func batchPayload(from text: String) -> [[String: Any]]? {
        guard let data = text.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let actions = object["actions"] as? [[String: Any]]
        else { return nil }
        return actions
    }

    private func jsonObject(from text: String) -> [String: Any]? {
        guard let data = text.data(using: .utf8) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    private func hostname(in payload: [String: Any]) -> String? {
        guard let rawURL = payload["url"] as? String,
              let url = URL(string: rawURL),
              ["http", "https"].contains(url.scheme?.lowercased() ?? "")
        else { return nil }
        return url.host?.lowercased()
    }

    private func hostnames(in actions: [[String: Any]]) -> [String] {
        actions.compactMap { action in
            guard let input = action["input"] as? [String: Any],
                  let rawURL = input["url"] as? String,
                  let url = URL(string: rawURL),
                  ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
                  let host = url.host?.lowercased()
            else { return nil }
            return host
        }
    }

    private func isClaudeTaskURL(_ rawURL: String) -> Bool {
        guard let url = URL(string: rawURL),
              url.scheme == "https",
              url.host?.lowercased() == "claude.ai"
        else { return false }
        return url.path.hasPrefix("/cic/")
    }

    private func visiblePageHostname(in scope: SemanticNode) -> String? {
        scope.descendantsIncludingSelf().compactMap { node -> String? in
            guard node.role == "AXWebArea",
                  let url = URL(string: node.url),
                  ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
                  url.host?.lowercased() != "claude.ai"
            else { return nil }
            return url.host?.lowercased()
        }.first
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
