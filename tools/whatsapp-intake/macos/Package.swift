// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "WhatsAppAgent", platforms: [.macOS(.v14)], products: [.executable(name: "WhatsAppAgent", targets: ["WhatsAppAgent"])], targets: [.executableTarget(name: "WhatsAppAgent")])
