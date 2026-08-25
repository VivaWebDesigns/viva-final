// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SABPermissionWatcher",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "PermissionCore", targets: ["PermissionCore"]),
        .executable(name: "sab-permission-watcher", targets: ["SABPermissionWatcher"]),
        .executable(name: "permission-core-tests", targets: ["PermissionCoreTests"]),
    ],
    targets: [
        .target(name: "PermissionCore"),
        .executableTarget(
            name: "SABPermissionWatcher",
            dependencies: ["PermissionCore"]
        ),
        .executableTarget(
            name: "PermissionCoreTests",
            dependencies: ["PermissionCore"]
        ),
    ]
)
