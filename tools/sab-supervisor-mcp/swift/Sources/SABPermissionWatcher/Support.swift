import AppKit
import CoreGraphics
import Foundation
import Vision

enum StructuredLog {
    static func append(directory: URL, fileName: String, record: [String: Any]) {
        do {
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true,
                attributes: [.posixPermissions: 0o700]
            )
            let file = directory.appendingPathComponent(fileName)
            let data = try JSONSerialization.data(withJSONObject: record, options: [.sortedKeys])
            if !FileManager.default.fileExists(atPath: file.path) {
                FileManager.default.createFile(
                    atPath: file.path,
                    contents: nil,
                    attributes: [.posixPermissions: 0o600]
                )
            }
            let handle = try FileHandle(forWritingTo: file)
            try handle.seekToEnd()
            try handle.write(contentsOf: data)
            try handle.write(contentsOf: Data([0x0A]))
            try handle.close()
        } catch {
            fputs("Unable to write watcher log: \(error)\n", stderr)
        }
    }
}
enum ChromeScreenshot {
    static func capture(pid: pid_t, to path: URL) -> Bool {
        // Screen capture is an optional diagnostic. Never trigger the macOS
        // permission prompt from an unattended watcher; capture only when the
        // user has already granted access in System Settings.
        guard CGPreflightScreenCaptureAccess() else { return false }

        guard let info = (CGWindowListCopyWindowInfo(
            [.optionOnScreenOnly, .excludeDesktopElements],
            kCGNullWindowID
        ) as? [[String: Any]])?.filter({
            ($0[kCGWindowOwnerPID as String] as? Int32) == pid
                && ($0[kCGWindowLayer as String] as? Int) == 0
        }).max(by: { windowArea($0) < windowArea($1) }),
        let windowNumber = info[kCGWindowNumber as String] as? UInt32
        else { return false }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
        process.arguments = ["-x", "-l", String(windowNumber), path.path]
        do {
            try process.run()
            process.waitUntilExit()
            return process.terminationStatus == 0
                && FileManager.default.fileExists(atPath: path.path)
        } catch {
            return false
        }
    }

    private static func windowArea(_ info: [String: Any]) -> Double {
        guard let bounds = info[kCGWindowBounds as String] as? [String: Any],
              let width = bounds["Width"] as? Double,
              let height = bounds["Height"] as? Double
        else { return 0 }
        return width * height
    }
}

enum ClaudeVisualText {
    static func recognize(pid: pid_t) -> String? {
        guard CGPreflightScreenCaptureAccess() else { return nil }
        let path = FileManager.default.temporaryDirectory.appendingPathComponent(
            "viva-sab-visual-\(UUID().uuidString).png"
        )
        defer { try? FileManager.default.removeItem(at: path) }
        guard ChromeScreenshot.capture(pid: pid, to: path),
              let image = NSImage(contentsOf: path),
              let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
        else { return nil }

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        request.minimumTextHeight = 0.008
        do {
            try VNImageRequestHandler(cgImage: cgImage).perform([request])
        } catch {
            return nil
        }
        return (request.results ?? []).compactMap {
            $0.topCandidates(1).first?.string
        }.joined(separator: "\n")
    }
}

enum WatcherNotification {
    static func show(title: String, message: String) {
        let notification = NSUserNotification()
        notification.title = title
        notification.informativeText = message
        notification.soundName = NSUserNotificationDefaultSoundName
        NSUserNotificationCenter.default.deliver(notification)
    }
}

func isoTimestamp() -> String {
    ISO8601DateFormatter().string(from: Date())
}

func sanitizedFileComponent(_ value: String) -> String {
    let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._"))
    return value.unicodeScalars.map { allowed.contains($0) ? Character(String($0)) : "_" }
        .reduce("") { $0 + String($1) }
}
