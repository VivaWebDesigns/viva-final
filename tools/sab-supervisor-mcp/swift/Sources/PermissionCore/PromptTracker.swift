import Foundation

public struct PromptTracker: Sendable {
    private var attempts: [String: Int] = [:]
    private var completed: Set<String> = []

    public init() {}

    public mutating func shouldAttempt(_ fingerprint: String, maxRetries: Int) -> Bool {
        guard !completed.contains(fingerprint) else { return false }
        return attempts[fingerprint, default: 0] < maxRetries
    }

    public mutating func recordAttempt(_ fingerprint: String) {
        attempts[fingerprint, default: 0] += 1
    }

    public mutating func recordCompletion(_ fingerprint: String) {
        completed.insert(fingerprint)
    }

    public mutating func clearAbsent(activeFingerprints: Set<String>) {
        attempts = attempts.filter { activeFingerprints.contains($0.key) }
        completed = completed.filter { activeFingerprints.contains($0) }
    }

    public func attemptCount(_ fingerprint: String) -> Int {
        attempts[fingerprint, default: 0]
    }
}
