import SwiftUI
import AppKit

@MainActor final class AppDelegate: NSObject, NSApplicationDelegate {
    weak var controller: AgentController?
    func applicationWillTerminate(_ notification: Notification) { controller?.shutdown() }
}

@main struct WhatsAppAgentApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @StateObject private var agent = AgentController()
    var body: some Scene {
        WindowGroup("The Q — סוכן וואטסאפ") {
            AgentView(agent: agent).onAppear {
                delegate.controller = agent
                if CommandLine.arguments.contains("--prepare-only") {
                    Task {
                        do {
                            _ = try await AgentPaths.runtime()
                            try await agent.checked(agent.rootScript, ["install"])
                            try await agent.verifyInstallation()
                            print("NATIVE_SETUP_VERIFIED")
                            NSApp.terminate(nil)
                        } catch { print("NATIVE_SETUP_FAILED: \(error.localizedDescription)"); exit(1) }
                    }
                }
                if CommandLine.arguments.contains("--fixture") {
                    agent.testFixture = true; agent.prepared = true
                    agent.snapshot.installed = true; agent.snapshot.connected = true; agent.snapshot.paired = true
                    agent.snapshot.ownerEmail = "biduratias@gmail.com"; agent.snapshot.previewReady = true
                    agent.snapshot.downloadDirectory = "~/Library/Application Support/TheQContentIntake/mac-example/downloads"
                    agent.snapshot.rows = [PreviewRow(filename: "לאונרדו פלאזה - ים המלח - 20.09.2026.pdf", title: "לאונרדו פלאזה ים המלח", status: "matched"), PreviewRow(filename: "הרודס - אילת - 20.09.2026.pdf", title: "הרודס אילת", status: "matched")]
                    agent.message = "בדיקת ההתאמה הסתיימה. עיינו בתוצאה לפני הפעלת הסוכן."
                }
                if let index = CommandLine.arguments.firstIndex(of: "--snapshot"), CommandLine.arguments.count > index + 1 {
                    let output = CommandLine.arguments[index + 1]
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        guard let view = NSApp.windows.first(where: { $0.isVisible })?.contentView,
                              let bitmap = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { return }
                        view.cacheDisplay(in: view.bounds, to: bitmap)
                        if let data = bitmap.representation(using: .png, properties: [:]) { try? data.write(to: URL(fileURLWithPath: output)) }
                    }
                }
            }
        }.defaultSize(width: 880, height: 950)
        .commands { CommandGroup(replacing: .newItem) {} }
    }
}
