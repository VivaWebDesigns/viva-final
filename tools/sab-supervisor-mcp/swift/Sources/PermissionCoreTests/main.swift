import Foundation
import PermissionCore

let extensionID = "testclaudeextension"
var failures: [String] = []

@MainActor
func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    if !condition() { failures.append(message) }
}

func snapshot(
    prompt: String = "Allow Claude to use the browser on example.org?",
    descriptor: String = "Navigating to https://example.org/about",
    buttons: [String] = ["Allow once", "Always allow for this website", "Deny"],
    extensionURL: String? = nil
) -> SemanticNode {
    let promptNodes = [
        SemanticNode(role: "AXStaticText", label: prompt),
        SemanticNode(role: "AXButton", label: descriptor, enabled: false),
    ] + buttons.map { SemanticNode(role: "AXButton", label: $0) }
    let task = SemanticNode(
        role: "AXWebArea",
        url: "https://claude.ai/cic/task/neutral-task",
        children: [SemanticNode(role: "AXGroup", children: promptNodes)]
    )
    let sidePanel = SemanticNode(
        role: "AXWebArea",
        url: extensionURL ?? "chrome-extension://\(extensionID)/sidepanel.html?tabId=1",
        children: [task]
    )
    return SemanticNode(role: "AXApplication", children: [sidePanel])
}

let detector = PromptDetector(extensionID: extensionID)

if case let .routine(match) = detector.detect(in: snapshot()) {
    expect(match.hostname == "example.org", "routine hostname")
    expect(match.actionKind == "navigating", "routine action kind")
    expect(
        match.selectedButton == "Always allow for this website",
        "persistent approval preference"
    )
} else {
    failures.append("routine navigation was not detected")
}

if case let .routine(match) = detector.detect(
    in: snapshot(prompt: "Allow Claude to use the browser on ")
) {
    expect(match.hostname == "example.org", "split prompt hostname from descriptor")
} else {
    failures.append("real split accessibility prompt was not detected")
}

if case let .routine(match) = detector.detect(
    in: snapshot(buttons: ["Allow once", "Deny"])
) {
    expect(match.selectedButton == "Allow once", "allow-once fallback")
} else {
    failures.append("allow-once fallback was not routine")
}

let protectedDescriptors = [
    "Downloading invoice from https://example.org/invoice.pdf",
    "Entering password on https://example.org/login",
    "Authorizing OAuth on https://example.org/oauth",
    "Clicking purchase on https://example.org/checkout",
    "Deleting account on https://example.org/settings",
]
for descriptor in protectedDescriptors {
    if case .protected = detector.detect(in: snapshot(descriptor: descriptor)) {
        // Expected explicit protected classification.
    } else {
        failures.append("protected descriptor was not protected: \(descriptor)")
    }
}

if case .unknown = detector.detect(in: snapshot(buttons: ["Continue"])) {
    // Expected fail-closed result.
} else {
    failures.append("missing semantic buttons did not fail closed")
}

expect(
    detector.detect(
        in: snapshot(extensionURL: "https://unrelated.example/sidepanel")
    ) == .none,
    "unrelated application buttons must be ignored"
)

let multiplePanels = SemanticNode(
    role: "AXApplication",
    children: [
        snapshot(prompt: "No permission here"),
        snapshot(
            prompt: "Allow Claude to use the browser on ",
            descriptor: "Reading https://second.example.org/reference"
        ),
    ]
)
if case let .routine(match) = detector.detect(in: multiplePanels) {
    expect(match.hostname == "second.example.org", "multiple Claude panels")
} else {
    failures.append("routine prompt in a later Claude panel was not detected")
}

if case .protected = detector.detect(
    in: snapshot(
        prompt: "Allow Claude to use the browser on localhost?",
        descriptor: "Navigating to http://localhost:3000"
    )
) {
    // Expected protected result.
} else {
    failures.append("private hostname was not protected")
}

var tracker = PromptTracker()
let fingerprint = "neutral"
expect(tracker.shouldAttempt(fingerprint, maxRetries: 2), "first attempt")
tracker.recordAttempt(fingerprint)
expect(tracker.shouldAttempt(fingerprint, maxRetries: 2), "bounded retry")
tracker.recordAttempt(fingerprint)
expect(!tracker.shouldAttempt(fingerprint, maxRetries: 2), "retry cap")
tracker.recordCompletion(fingerprint)
expect(!tracker.shouldAttempt(fingerprint, maxRetries: 3), "deduplication")
tracker.clearAbsent(activeFingerprints: [])
expect(tracker.shouldAttempt(fingerprint, maxRetries: 2), "new prompt after disappearance")

if failures.isEmpty {
    print("PermissionCore mocked tests passed (routine, protected, unknown, targeting, dedupe, retry).")
    exit(0)
}

for failure in failures { fputs("FAIL: \(failure)\n", stderr) }
exit(1)
