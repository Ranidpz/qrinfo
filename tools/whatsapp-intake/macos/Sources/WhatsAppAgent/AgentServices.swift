import Foundation
import CryptoKit

struct AgentFailure: LocalizedError { let message: String; var errorDescription: String? { message } }
struct ProcessOutput { let code: Int32; let text: String }
enum ProcessService {
    static func run(_ executable: URL, _ arguments: [String], process: Process = Process()) async throws -> ProcessOutput {
        try await Task.detached {
            process.executableURL = executable
            process.arguments = arguments
            var environment = ProcessInfo.processInfo.environment
            environment["PLAYWRIGHT_BROWSERS_PATH"] = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Caches/theq-playwright").path
            process.environment = environment
            let pipe = Pipe()
            process.standardOutput = pipe; process.standardError = pipe
            try process.run()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            process.waitUntilExit()
            return ProcessOutput(code: process.terminationStatus, text: String(decoding: data, as: UTF8.self))
        }.value
    }
}
enum AgentPaths {
    static let base = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/TheQContentIntake")
    static let payload = Bundle.main.resourceURL!.appendingPathComponent("payload")
    static var node: URL {
        #if arch(arm64)
        let arch = "arm64"
        #else
        let arch = "x64"
        #endif
        return base.appendingPathComponent("native-runtime/node-v24.21.0-darwin-\(arch)/bin/node")
    }
    static func runtime() async throws -> URL {
        if FileManager.default.isExecutableFile(atPath: node.path) { return node }
        #if arch(arm64)
        let arch = "arm64", checksum = "bed7eea5325e1108f32ce5228ddd6a5f0f08a499ee42aa7442aea583702f6057"
        #else
        let arch = "x64", checksum = "1462cb3b3046b815cf8ea436d3da450ec1a9f11dac7e5a46b0ada5305d7e8097"
        #endif
        let filename = "node-v24.21.0-darwin-\(arch).tar.gz"
        let folder = base.appendingPathComponent("native-runtime")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        var request = URLRequest(url: URL(string: "https://nodejs.org/dist/v24.21.0/\(filename)")!)
        request.timeoutInterval = 300
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200,
              SHA256.hash(data: data).map({ String(format: "%02x", $0) }).joined() == checksum else { throw AgentFailure(message: "הורדת רכיב ההפעלה לא אומתה. נסו שוב כשהאינטרנט זמין.") }
        let archive = folder.appendingPathComponent(UUID().uuidString + ".tar.gz")
        try data.write(to: archive, options: .atomic)
        defer { try? FileManager.default.removeItem(at: archive) }
        let result = try await ProcessService.run(URL(fileURLWithPath: "/usr/bin/tar"), ["-xzf", archive.path, "-C", folder.path])
        guard result.code == 0, FileManager.default.isExecutableFile(atPath: node.path) else { throw AgentFailure(message: "לא ניתן להכין את רכיבי הסוכן. \(result.text)") }
        return node
    }
}
struct PreviewRow: Decodable, Identifiable {
    let id: String; let filename: String; let title: String; let status: String
    var receivedAt: String?; var reason: String?; var warnings: [String]?
}
struct AssignmentTarget: Decodable, Identifiable { let id: String; let title: String }
struct MissingMessage: Decodable { var name: String?; var receivedAt: String? }
struct AgentSnapshot: Decodable {
    var missingMessages: [MissingMessage]?
    var installed = false, connected = false, paired = false, enabled = false, previewReady = false
    var rows: [PreviewRow] = []
    var targets: [AssignmentTarget]?
    var previewStale: Bool?
    var runnerVersion: String?, id: String?, groupName: String?, ownerEmail: String?, state: String?, syncState: String?, downloadDirectory: String?, configFile: String?
    var nextCheck: String?, lastCheckAt: String?, lastUpdateAt: String?, lastOutcome: String?, lastError: String?, activationReason: String?
    var deliveryOutstanding: Int?
    var pending: Bool?
}
