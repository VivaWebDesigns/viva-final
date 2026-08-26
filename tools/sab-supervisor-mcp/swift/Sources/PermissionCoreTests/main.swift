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

func batchSnapshot(
    taskURL: String = "https://claude.ai/cic/task/neutral-batch-task",
    hostname: String = "www.example.net",
    actionNames: [String] = ["navigate", "get_page_text"],
    buttons: [String] = ["Deny 1", "Allow once 2"],
    wrapper: SemanticNode? = nil
) -> SemanticNode {
    let actions: [[String: Any]] = actionNames.enumerated().map { index, name in
        var input: [String: Any] = ["tabId": 42]
        if index == 0 { input["url"] = "https://\(hostname)/reference" }
        return ["name": name, "input": input]
    }
    let payload = try! JSONSerialization.data(withJSONObject: ["actions": actions])
    let payloadText = String(data: payload, encoding: .utf8)!
    let task = SemanticNode(
        role: "AXWebArea",
        url: taskURL,
        children: [
            SemanticNode(
                role: "AXGroup",
                children: [
                    SemanticNode(role: "AXGroup", label: "Permission request: browser_batch"),
                    SemanticNode(role: "AXStaticText", label: payloadText),
                ] + buttons.map { SemanticNode(role: "AXButton", label: $0) }
            ),
        ]
    )
    let sidePanel = SemanticNode(
        role: "AXWebArea",
        url: "chrome-extension://\(extensionID)/sidepanel.html?tabId=42",
        children: [task]
    )
    return SemanticNode(role: "AXApplication", children: [wrapper ?? sidePanel])
}

func singleToolSnapshot(
    toolName: String = "get_page_text",
    pageURL: String = "https://www.example.edu/reference",
    payload: [String: Any] = ["tabId": 42]
) -> SemanticNode {
    let payloadData = try! JSONSerialization.data(withJSONObject: payload)
    let payloadText = String(data: payloadData, encoding: .utf8)!
    let task = SemanticNode(
        role: "AXWebArea",
        url: "https://claude.ai/cic/task/single-tool-task",
        children: [
            SemanticNode(role: "AXGroup", label: "Permission request: \(toolName)"),
            SemanticNode(role: "AXStaticText", label: payloadText),
            SemanticNode(role: "AXButton", label: "Deny 1"),
            SemanticNode(role: "AXButton", label: "Allow once 2"),
        ]
    )
    let panel = SemanticNode(
        role: "AXWebArea",
        url: "chrome-extension://\(extensionID)/sidepanel.html?tabId=42",
        children: [task]
    )
    return SemanticNode(
        role: "AXApplication",
        children: [
            SemanticNode(
                role: "AXWindow",
                children: [
                    SemanticNode(role: "AXWebArea", url: pageURL),
                    panel,
                ]
            ),
        ]
    )
}

func javascriptSnapshot(
    pageURL: String = "https://www.example.edu/reference",
    script: String = "document.title"
) -> SemanticNode {
    singleToolSnapshot(
        toolName: "javascript_tool",
        pageURL: pageURL,
        payload: [
            "action": "javascript_exec",
            "tabId": 42,
            "text": script,
        ]
    )
}

func mcpPermissionOnlySnapshot(
    hostname: String = "www.example.gov",
    buttons: [String] = [
        "Allow this action",
        "Decline",
        "Always allow actions on this site Browse, click, and type",
    ]
) -> SemanticNode {
    SemanticNode(
        role: "AXApplication",
        children: [
            SemanticNode(
                role: "AXWindow",
                children: [
                    SemanticNode(
                        role: "AXWebArea",
                        url: "chrome-extension://\(extensionID)/sidepanel.html?mcpPermissionOnly=true&requestId=neutral",
                        children: [
                            SemanticNode(role: "AXHeading", label: "New permissions required"),
                            SemanticNode(
                                role: "AXStaticText",
                                label: "Claude wants to navigate to: \(hostname)"
                            ),
                        ] + buttons.map { SemanticNode(role: "AXButton", label: $0) }
                    ),
                ]
            ),
        ]
    )
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

if case let .routine(match) = detector.detect(in: batchSnapshot()) {
    expect(match.hostname == "www.example.net", "browser_batch hostname")
    expect(
        match.actionKind == "browser_batch:navigate,get_page_text",
        "browser_batch action kinds"
    )
    expect(match.selectedButton == "Allow once 2", "shortcut-suffixed allow button")
    expect(
        match.actionDescriptor == "Permission request: browser_batch",
        "browser_batch prompt identity"
    )
} else {
    failures.append("real browser_batch permission prompt was not detected")
}

if case let .routine(match) = detector.detect(in: singleToolSnapshot()) {
    expect(match.hostname == "www.example.edu", "single read uses same-window page hostname")
    expect(match.actionKind == "get_page_text", "single read action kind")
    expect(match.selectedButton == "Allow once 2", "single read allow button")
} else {
    failures.append("single get_page_text permission was not detected")
}

for toolName in ["tabs_create_mcp", "tabs_context_mcp"] {
    if case let .routine(match) = detector.detect(
        in: singleToolSnapshot(toolName: toolName)
    ) {
        expect(match.actionKind == toolName, "targetless routine tool action kind: \(toolName)")
        expect(match.selectedButton == "Allow once 2", "targetless routine tool button")
    } else {
        failures.append("targetless routine tool was not detected: \(toolName)")
    }
}

if case let .routine(match) = detector.detect(in: javascriptSnapshot()) {
    expect(match.hostname == "www.example.edu", "page-title JavaScript hostname")
    expect(
        match.actionKind == "javascript_tool:document.title",
        "page-title JavaScript action kind"
    )
    expect(match.selectedButton == "Allow once 2", "page-title JavaScript allow button")
} else {
    failures.append("read-only document.title JavaScript was not detected")
}

if case let .routine(match) = detector.detect(
    in: javascriptSnapshot(script: "({title: document.title, url: location.href})")
) {
    expect(
        match.actionKind == "javascript_tool:document.title",
        "read-only title-and-URL JavaScript action kind"
    )
} else {
    failures.append("read-only title-and-URL JavaScript was not detected")
}

if case let .routine(match) = detector.detect(in: mcpPermissionOnlySnapshot()) {
    expect(match.hostname == "www.example.gov", "MCP permission hostname")
    expect(match.actionKind == "mcp_navigate", "MCP permission action kind")
    expect(
        match.selectedButton == "Always allow actions on this site Browse, click, and type",
        "MCP persistent approval preference"
    )
} else {
    failures.append("MCP permission-only navigation was not detected")
}

if case .protected = detector.detect(
    in: mcpPermissionOnlySnapshot(hostname: "localhost")
) {
    // Expected private-host exclusion.
} else {
    failures.append("MCP permission-only private host was not protected")
}

for script in [
    "document.cookie",
    "document.body.innerText",
    "fetch('/private')",
    "document.querySelector('button').click()",
] {
    if case .unknown = detector.detect(in: javascriptSnapshot(script: script)) {
        // Arbitrary JavaScript remains fail-closed.
    } else {
        failures.append("non-whitelisted JavaScript did not fail closed: \(script)")
    }
}

if case .protected = detector.detect(
    in: singleToolSnapshot(pageURL: "http://localhost:8080/private")
) {
    // Expected local-page exclusion.
} else {
    failures.append("single read on local page was not protected")
}

if case .protected = detector.detect(
    in: batchSnapshot(hostname: "accounts.example.net", actionNames: ["navigate", "authorize"])
) {
    // Expected protected classification before unsupported-action handling.
} else {
    failures.append("OAuth browser_batch was not protected")
}

for protectedAction in [
    "download", "upload", "purchase", "enter_password", "delete", "type_sensitive_information",
] {
    if case .protected = detector.detect(
        in: batchSnapshot(actionNames: ["navigate", protectedAction])
    ) {
        // Expected protected classification.
    } else {
        failures.append("protected browser_batch action was not protected: \(protectedAction)")
    }
}

if case .protected = detector.detect(
    in: singleToolSnapshot(
        toolName: "click",
        payload: ["tabId": 42, "selector": "button#submit-payment"]
    )
) {
    // Expected protected semantic target.
} else {
    failures.append("protected single-tool click was not protected")
}

if case .unknown = detector.detect(
    in: batchSnapshot(actionNames: ["navigate", "evaluate_script"])
) {
    // Expected fail-closed result.
} else {
    failures.append("unsupported browser_batch action did not fail closed")
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

func continuationSnapshot(
    message: String = PromptDetector.toolUseLimitMessage,
    button: String = "Continue",
    enabled: Bool = true
) -> SemanticNode {
    SemanticNode(
        role: "AXApplication",
        children: [
            SemanticNode(
                role: "AXWindow",
                children: [
                    SemanticNode(
                        role: "AXWebArea",
                        url: "https://claude.ai/chat/neutral",
                        children: [
                            SemanticNode(
                                role: "AXGroup",
                                children: [
                                    SemanticNode(role: "AXStaticText", label: message),
                                    SemanticNode(role: "AXButton", label: button, enabled: enabled),
                                ]
                            ),
                        ]
                    ),
                ]
            ),
        ]
    )
}

let continuationResults = detector.detectClaudeContinuations(in: continuationSnapshot())
expect(continuationResults.count == 1, "exact tool-use limit continuation")
if case let .routine(match) = continuationResults.first {
    expect(match.actionKind == "tool_use_limit_continue", "continuation action kind")
    expect(match.selectedButton == "Continue", "continuation semantic button")
} else {
    failures.append("exact tool-use limit notice was not routine")
}

expect(
    detector.detectClaudeContinuations(
        in: continuationSnapshot(message: "Claude paused for another reason.")
    ).isEmpty,
    "altered continuation message must fail closed"
)
expect(
    detector.detectClaudeContinuations(in: continuationSnapshot(enabled: false)).isEmpty,
    "disabled continuation button must fail closed"
)

let ambiguousContinuation = SemanticNode(
    role: "AXGroup",
    children: [
        SemanticNode(role: "AXStaticText", label: PromptDetector.toolUseLimitMessage),
        SemanticNode(role: "AXButton", label: "Continue"),
        SemanticNode(role: "AXButton", label: "Cancel"),
    ]
)
expect(
    detector.detectClaudeContinuations(in: ambiguousContinuation).isEmpty,
    "notice with another enabled action must fail closed"
)

let unrelatedContinue = SemanticNode(
    role: "AXApplication",
    children: [
        SemanticNode(role: "AXStaticText", label: PromptDetector.toolUseLimitMessage),
        SemanticNode(role: "AXButton", label: "Continue"),
    ]
)
expect(
    detector.detectClaudeContinuations(in: unrelatedContinue).isEmpty,
    "message and generic Continue outside one bounded notice must be ignored"
)

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

let multipleWindowsAndGroups = SemanticNode(
    role: "AXApplication",
    children: [
        SemanticNode(
            role: "AXWindow",
            children: [
                SemanticNode(role: "AXTabGroup", children: [snapshot(prompt: "No permission here")]),
            ]
        ),
        SemanticNode(
            role: "AXWindow",
            children: [
                SemanticNode(
                    role: "AXTabGroup",
                    children: [batchSnapshot(
                        taskURL: "https://claude.ai/cic/new/side-panel-instance",
                        hostname: "docs.example.org"
                    )]
                ),
            ]
        ),
    ]
)
let allWindowResults = detector.detectAll(in: multipleWindowsAndGroups)
expect(allWindowResults.count == 1, "scan all Chrome windows and tab groups")
if case let .routine(match) = allWindowResults.first {
    expect(match.hostname == "docs.example.org", "later side-panel task instance")
} else {
    failures.append("later side-panel task instance was not detected")
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
