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
                    NSApp.appearance = NSAppearance(named: .aqua)
                    agent.testFixture = true; agent.prepared = true
                    agent.snapshot.runnerVersion = agent.appVersion; agent.snapshot.installed = true; agent.snapshot.connected = true; agent.snapshot.paired = true
                    agent.snapshot.ownerEmail = "biduratias@gmail.com"; agent.snapshot.previewReady = true
                    agent.snapshot.downloadDirectory = "~/Library/Application Support/TheQContentIntake/mac-example/downloads"
                    agent.snapshot.targets = [AssignmentTarget(id: "one", title: "חוויה לדוגמה")]
                    agent.snapshot.rows = [PreviewRow(id: "local:one", filename: "לאונרדו פלאזה - ים המלח - 20.09.2026.pdf", title: "לאונרדו פלאזה ים המלח", status: "matched"), PreviewRow(id: "local:two", filename: "הרודס - אילת - 20.09.2026.pdf", title: "הרודס אילת", status: "matched"), PreviewRow(id: "local:three", filename: "תוכניית בידור סופש 240926.pdf", title: "לא זוהתה חוויה", status: "unmatched", receivedAt: "2026-09-24T01:24:00Z"), PreviewRow(id: "local:four", filename: "רויאל סופש 23.9.pdf", title: "רויאל ריזורט אילת", status: "duplicate", receivedAt: "2026-09-24T02:55:00Z")]
                    agent.snapshot.nextCheck = "יום חמישי, 24.9, 12:00"
                    agent.snapshot.enabled = true
                    agent.snapshot.lastCheckAt = "2026-09-24T07:05:00.000Z"
                    agent.snapshot.lastUpdateAt = "2026-09-24T07:07:00.000Z"
                    agent.snapshot.lastOutcome = "העדכון הסתיים; חלק מהקבצים ממתינים לתיקון"
                    agent.snapshot.deliveryOutstanding = 1
                    agent.snapshot.pending = CommandLine.arguments.contains("--pending-fixture")
                    if CommandLine.arguments.contains("--error-fixture") {
                        agent.snapshot.enabled = false; agent.snapshot.previewReady = false; agent.snapshot.rows = []
                        agent.snapshot.lastError = "HISTORY_KNOWN_MESSAGES_MISSING"
                        agent.snapshot.missingMessages = [MissingMessage(name: "תוכניית בידור סופש 240926.pdf", receivedAt: nil)]
                    }
                    agent.message = "בדיקת ההתאמה הסתיימה. עיינו בתוצאה לפני הפעלת הסוכן."
                }
                if let index = CommandLine.arguments.firstIndex(of: "--snapshot"), CommandLine.arguments.count > index + 1 {
                    let output = CommandLine.arguments[index + 1]
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        guard let view = NSApp.windows.first(where: { $0.isVisible })?.contentView,
                              let bitmap = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { return }
                        view.cacheDisplay(in: view.bounds, to: bitmap)
                        if let data = bitmap.representation(using: .png, properties: [:]) { try? data.write(to: URL(fileURLWithPath: output)) }
                        if CommandLine.arguments.contains("--quit-after-snapshot") { NSApp.terminate(nil) }
                    }
                }
            }
        }.defaultSize(width: 880, height: 780)
        .commands { CommandGroup(replacing: .newItem) {} }
        Settings { AgentSettingsView(agent: agent) }
    }
}
