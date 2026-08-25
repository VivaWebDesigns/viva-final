import Foundation

func argumentValue(_ name: String, in arguments: [String]) -> String? {
    guard let index = arguments.firstIndex(of: name), index + 1 < arguments.count else {
        return nil
    }
    return arguments[index + 1]
}

var arguments = Array(CommandLine.arguments.dropFirst())
guard arguments.first == "watch" || arguments.first == "inspect" else {
    print("Usage: sab-permission-watcher watch|inspect [--dry-run] [--once] [options]")
    exit(1)
}
let inspectMode = arguments.first == "inspect"
arguments.removeFirst()

let home = FileManager.default.homeDirectoryForCurrentUser
let defaultLogs = home.appendingPathComponent(".local/state/viva-sab-supervisor")
let options = WatcherOptions(
    dryRun: inspectMode || arguments.contains("--dry-run"),
    once: inspectMode || arguments.contains("--once"),
    logDirectory: URL(
        fileURLWithPath: argumentValue("--log-directory", in: arguments) ?? defaultLogs.path,
        isDirectory: true
    ),
    pollIntervalMs: Int(argumentValue("--poll-interval-ms", in: arguments) ?? "750") ?? 750,
    resumeTimeoutMs: Int(argumentValue("--resume-timeout-ms", in: arguments) ?? "10000") ?? 10_000,
    maxRetries: Int(argumentValue("--max-retries", in: arguments) ?? "2") ?? 2,
    extensionID: argumentValue("--extension-id", in: arguments)
        ?? "fcoeoabgfenejglbffodgkkbkcdhcgfn",
    debug: inspectMode || arguments.contains("--debug")
)

exit(PermissionWatcher(options: options).run())
