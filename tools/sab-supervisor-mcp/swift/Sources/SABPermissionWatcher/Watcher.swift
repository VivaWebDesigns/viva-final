import AppKit
import ApplicationServices
import Foundation
import PermissionCore

struct WatcherOptions {
    let dryRun: Bool
    let once: Bool
    let logDirectory: URL
    let pollIntervalMs: Int
    let resumeTimeoutMs: Int
    let maxRetries: Int
    let extensionID: String
    let debug: Bool
}

final class PermissionWatcher {
    private let options: WatcherOptions
    private let detector: PromptDetector
    private var tracker = PromptTracker()
    private var unknownFingerprints: Set<String> = []

    init(options: WatcherOptions) {
        self.options = options
        detector = PromptDetector(extensionID: options.extensionID)
    }

    func run() -> Int32 {
        guard AXIsProcessTrusted() else {
            fputs(
                "Accessibility access is required. Enable the watcher in System Settings > Privacy & Security > Accessibility.\n",
                stderr
            )
            return 2
        }

        repeat {
            let detected = runCycle()
            if options.once, detected == 0 {
                print("No matching Claude permission prompt detected.")
            }
            if options.once { break }
            Thread.sleep(forTimeInterval: Double(options.pollIntervalMs) / 1000.0)
        } while true
        return 0
    }

    private func runCycle() -> Int {
        var activeFingerprints = Set<String>()
        var detectedCount = 0
        for pid in AccessibilityReader.chromeProcessIdentifiers() {
            guard let root = AccessibilityReader.readChrome(pid: pid) else { continue }
            if options.debug { printDebugSignals(root.semantic) }
            process(
                detector.detectAll(in: root.semantic),
                pid: pid,
                root: root,
                activeFingerprints: &activeFingerprints,
                detectedCount: &detectedCount
            )
        }
        for pid in AccessibilityReader.claudeProcessIdentifiers() {
            guard let root = AccessibilityReader.readApplication(pid: pid) else { continue }
            if options.debug { printDebugSignals(root.semantic) }
            process(
                claudeDetections(root: root, pid: pid),
                pid: pid,
                root: root,
                activeFingerprints: &activeFingerprints,
                detectedCount: &detectedCount
            )
        }
        tracker.clearAbsent(activeFingerprints: activeFingerprints)
        unknownFingerprints = unknownFingerprints.filter { activeFingerprints.contains($0) }
        return detectedCount
    }

    private func claudeDetections(root: LiveNode, pid: pid_t) -> [DetectionResult] {
        let semantic = detector.detectClaudeContinuations(in: root.semantic)
            + detector.detectClaudeSupervisorPermissions(in: root.semantic)
        if !semantic.isEmpty { return semantic }

        let controlLabels = root.semantic.descendantsIncludingSelf().filter {
            $0.enabled && ["AXButton", "AXStaticText"].contains($0.role)
        }.map { $0.displayedText.trimmingCharacters(in: .whitespacesAndNewlines) }
        guard controlLabels.contains("Continue") || controlLabels.contains("Always allow"),
              let recognizedText = ClaudeVisualText.recognize(pid: pid)
        else { return [] }
        return detector.detectVisualClaudePrompt(
            recognizedText: recognizedText,
            controlLabels: controlLabels
        )
    }

    private func process(
        _ detections: [DetectionResult],
        pid: pid_t,
        root: LiveNode,
        activeFingerprints: inout Set<String>,
        detectedCount: inout Int
    ) {
        for detection in detections {
            switch detection {
            case .none:
                continue
            case let .routine(match):
                detectedCount += 1
                activeFingerprints.insert(match.fingerprint)
                handleRoutine(match, pid: pid, root: root)
            case let .protected(hostname, permissionType, reason):
                detectedCount += 1
                let fingerprint = "protected|\(hostname)|\(permissionType)|\(reason)"
                activeFingerprints.insert(fingerprint)
                if !unknownFingerprints.contains(fingerprint) {
                    unknownFingerprints.insert(fingerprint)
                    log(
                        hostname: hostname,
                        permissionType: permissionType,
                        actionKind: "protected",
                        button: "none",
                        result: "not_approved",
                        details: reason
                    )
                }
            case let .unknown(hostname, permissionType, reason):
                detectedCount += 1
                let fingerprint = "unknown|\(hostname)|\(permissionType)|\(reason)"
                activeFingerprints.insert(fingerprint)
                guard !unknownFingerprints.contains(fingerprint) else { continue }
                unknownFingerprints.insert(fingerprint)
                let screenshot = captureFailureScreenshot(hostname: hostname, pid: pid)
                log(
                    hostname: hostname,
                    permissionType: permissionType,
                    actionKind: "candidate",
                    button: "none",
                    result: "candidate_rejected",
                    details: reason,
                    screenshot: screenshot
                )
                WatcherNotification.show(
                    title: "Claude permission needs attention",
                    message: "The watcher could not safely identify a prompt for \(hostname). No click was made."
                )
            }
        }
    }

    private func printDebugSignals(_ root: SemanticNode) {
        for node in root.descendantsIncludingSelf() {
            let text = node.displayedText
            let containsContinue = node.descendantsIncludingSelf().contains {
                $0.displayedText.trimmingCharacters(in: .whitespacesAndNewlines) == "Continue"
            }
            if node.url.contains("claude")
                || node.url.contains("chrome-extension")
                || text.localizedCaseInsensitiveContains("allow claude")
                || text.localizedCaseInsensitiveContains("allow once")
                || text.localizedCaseInsensitiveContains("always allow")
                || text.localizedCaseInsensitiveContains("claude wants to use")
                || text.localizedCaseInsensitiveContains("tool-use limit")
                || text.localizedCaseInsensitiveContains("navigating")
                || text == PromptDetector.toolUseLimitMessage
                || text == "Continue"
                || containsContinue
            {
                print(
                    "AX_DEBUG role=\(node.role) enabled=\(node.enabled) label=\(text.debugDescription) url=\(node.url.debugDescription) actions=\(node.actions) children=\(node.children.count)"
                )
            }
        }
    }

    private func handleRoutine(_ match: PromptMatch, pid: pid_t, root: LiveNode) {
        if options.dryRun {
            guard tracker.shouldAttempt(match.fingerprint, maxRetries: 1) else { return }
            tracker.recordAttempt(match.fingerprint)
            log(
                hostname: match.hostname,
                permissionType: match.permissionType,
                actionKind: match.actionKind,
                button: match.selectedButton,
                result: "dry_run_detected"
            )
            return
        }

        guard tracker.shouldAttempt(match.fingerprint, maxRetries: options.maxRetries) else {
            return
        }
        tracker.recordAttempt(match.fingerprint)
        let pressResult: AXError
        if match.taskURL.hasPrefix("claude-desktop://") {
            pressResult = AccessibilityReader.activateVisualTextControl(
                in: root,
                label: match.selectedButton
            )
        } else if match.actionKind == "tool_use_limit_continue" {
            pressResult = AccessibilityReader.pressContinuationButton(in: root, match: match)
        } else if match.actionKind.hasPrefix("supervisor_mcp:") {
            pressResult = AccessibilityReader.pressClaudePermissionButton(in: root, match: match)
        } else {
            pressResult = AccessibilityReader.pressButton(
                in: root,
                extensionID: options.extensionID,
                match: match
            )
        }
        guard pressResult == .success else {
            log(
                hostname: match.hostname,
                permissionType: match.permissionType,
                actionKind: match.actionKind,
                button: match.selectedButton,
                result: "press_failed",
                details: "AXError \(pressResult.rawValue); attempt \(tracker.attemptCount(match.fingerprint))"
            )
            return
        }

        let resumed = confirmResume(match: match, pid: pid)
        if resumed {
            tracker.recordCompletion(match.fingerprint)
        }
        log(
            hostname: match.hostname,
            permissionType: match.permissionType,
            actionKind: match.actionKind,
            button: match.selectedButton,
            result: resumed ? "approved_and_resumed" : "approval_not_confirmed",
            details: "attempt \(tracker.attemptCount(match.fingerprint))"
        )
    }

    private func confirmResume(match: PromptMatch, pid: pid_t) -> Bool {
        let deadline = Date().addingTimeInterval(Double(options.resumeTimeoutMs) / 1000.0)
        while Date() < deadline {
            Thread.sleep(forTimeInterval: 0.35)
            guard let current = AccessibilityReader.readApplication(pid: pid) else { continue }
            if match.taskURL.hasPrefix("claude-desktop://") {
                if match.actionKind == "tool_use_limit_continue",
                   detector.hasClaudeWorkingSignal(in: current.semantic)
                {
                    return true
                }
                if AccessibilityReader.visibleTextControlCount(
                    in: current,
                    label: match.selectedButton
                ) == 0 {
                    return true
                }
                continue
            }
            if match.actionKind == "tool_use_limit_continue" {
                if detector.hasClaudeWorkingSignal(in: current.semantic) { return true }
                let stillPresent = detector.detectClaudeContinuations(in: current.semantic)
                    .contains { detection in
                        if case let .routine(candidate) = detection {
                            return candidate.fingerprint == match.fingerprint
                        }
                        return false
                    }
                if !stillPresent { return true }
                continue
            }
            if match.actionKind.hasPrefix("supervisor_mcp:") {
                let stillPresent = detector.detectClaudeSupervisorPermissions(in: current.semantic)
                    .contains { detection in
                        if case let .routine(candidate) = detection {
                            return candidate.fingerprint == match.fingerprint
                        }
                        return false
                    }
                if !stillPresent { return true }
                continue
            }
            guard let task = AccessibilityReader.taskNode(
                in: current,
                extensionID: options.extensionID,
                taskURL: match.taskURL
            ) else {
                if match.taskURL.contains("mcpPermissionOnly=true") { return true }
                continue
            }
            let taskNodes = task.semantic.descendantsIncludingSelf()
            if taskNodes.contains(where: {
                $0.displayedText == match.actionDescriptor
            }) {
                continue
            }
            let text = taskNodes.map(\.displayedText).joined(separator: "\n")
            if text.contains("Claude is responding")
                || text.contains("Claude finished the response")
                || text.contains("Working on it")
                || text.contains("Using Claude in Chrome")
            {
                return true
            }
        }
        return false
    }

    private func captureFailureScreenshot(hostname: String, pid: pid_t) -> String? {
        let directory = options.logDirectory.appendingPathComponent("screenshots", isDirectory: true)
        try? FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )
        let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
        let path = directory.appendingPathComponent(
            "\(stamp)-\(sanitizedFileComponent(hostname)).png"
        )
        return ChromeScreenshot.capture(pid: pid, to: path) ? path.path : nil
    }

    private func log(
        hostname: String,
        permissionType: String,
        actionKind: String,
        button: String,
        result: String,
        details: String? = nil,
        screenshot: String? = nil
    ) {
        var record: [String: Any] = [
            "timestamp": isoTimestamp(),
            "hostname": hostname,
            "permission_type": permissionType,
            "action_kind": actionKind,
            "button_selected": button,
            "result": result,
        ]
        if let details { record["details"] = details }
        if let screenshot { record["screenshot"] = screenshot }
        StructuredLog.append(
            directory: options.logDirectory,
            fileName: "watcher.jsonl",
            record: record
        )
        print(record.map { "\($0.key)=\($0.value)" }.sorted().joined(separator: " "))
    }
}
