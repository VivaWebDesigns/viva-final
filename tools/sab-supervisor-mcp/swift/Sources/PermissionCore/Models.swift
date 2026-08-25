import Foundation

public struct SemanticNode: Equatable, Sendable {
    public var role: String
    public var label: String
    public var value: String
    public var url: String
    public var enabled: Bool
    public var actions: [String]
    public var children: [SemanticNode]

    public init(
        role: String,
        label: String = "",
        value: String = "",
        url: String = "",
        enabled: Bool = true,
        actions: [String] = [],
        children: [SemanticNode] = []
    ) {
        self.role = role
        self.label = label
        self.value = value
        self.url = url
        self.enabled = enabled
        self.actions = actions
        self.children = children
    }

    public var displayedText: String {
        if !label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return label }
        return value
    }

    public func descendantsIncludingSelf() -> [SemanticNode] {
        [self] + children.flatMap { $0.descendantsIncludingSelf() }
    }
}

public struct PromptMatch: Equatable, Sendable {
    public let taskURL: String
    public let hostname: String
    public let permissionType: String
    public let actionDescriptor: String
    public let actionKind: String
    public let selectedButton: String

    public init(
        taskURL: String,
        hostname: String,
        permissionType: String,
        actionDescriptor: String,
        actionKind: String,
        selectedButton: String
    ) {
        self.taskURL = taskURL
        self.hostname = hostname
        self.permissionType = permissionType
        self.actionDescriptor = actionDescriptor
        self.actionKind = actionKind
        self.selectedButton = selectedButton
    }

    public var fingerprint: String {
        "\(taskURL)|\(hostname.lowercased())|\(permissionType)|\(actionKind)"
    }
}

public enum DetectionResult: Equatable, Sendable {
    case none
    case routine(PromptMatch)
    case protected(hostname: String, permissionType: String, reason: String)
    case unknown(hostname: String, permissionType: String, reason: String)
}
