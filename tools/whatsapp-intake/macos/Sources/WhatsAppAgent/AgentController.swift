import SwiftUI
import AppKit
import UniformTypeIdentifiers

@MainActor final class AgentController: ObservableObject {
    @Published var snapshot = AgentSnapshot()
    @Published var prepared = false
    @Published var busy = false
    @Published var connecting = false
    @Published var message = "ברוכים הבאים. ההקמה מתבצעת כאן, ללא פקודות."
    @Published var error = ""
    private var browserProcess: Process?
    var testFixture = false
    var rootScript: URL { AgentPaths.payload.appendingPathComponent("src/gui.mjs") }
    var installedScript: URL { AgentPaths.base.appendingPathComponent("app/src/gui.mjs") }
    func refresh() async {
        guard !testFixture, FileManager.default.isExecutableFile(atPath: AgentPaths.node.path), FileManager.default.fileExists(atPath: installedScript.path) else { return }
        do {
            let output = try await ProcessService.run(AgentPaths.node, [installedScript.path, "status"])
            guard output.code == 0 else { return }
            snapshot = try JSONDecoder().decode(AgentSnapshot.self, from: Data(output.text.utf8))
            prepared = snapshot.installed
        } catch { /* Initial or interrupted install is recoverable through Prepare. */ }
    }
    func perform(_ label: String, work: @escaping () async throws -> Void) {
        guard !busy, !testFixture else { return }
        busy = true; message = label; error = ""
        Task { do { try await work() } catch { self.error = self.friendly(error.localizedDescription) }; await refresh(); busy = false }
    }
    func checked(_ script: URL, _ args: [String]) async throws {
        let output = try await ProcessService.run(AgentPaths.node, [script.path] + args)
        guard output.code == 0 else { throw AgentFailure(message: output.text) }
    }
    func verifyInstallation() async throws {
        let output = try await ProcessService.run(AgentPaths.node, [installedScript.path, "status"])
        guard output.code == 0, let state = try? JSONDecoder().decode(AgentSnapshot.self, from: Data(output.text.utf8)), state.installed, state.runnerVersion == "0.8.0" else { throw AgentFailure(message: "ההתקנה לא הושלמה. לחצו שוב על הכנת הסוכן.") }
        snapshot = state; prepared = true
    }
    func prepare() {
        perform("מכינים את הסוכן ומורידים דפדפן ייעודי. בפעם הראשונה זה עשוי לקחת כמה דקות…") {
            _ = try await AgentPaths.runtime()
            try await self.checked(self.rootScript, ["install"])
            try await self.verifyInstallation()
            self.message = "הסוכן מוכן. בחיבור קיים בצעו בדיקת התאמה והפעילו עדכונים מחדש; בחיבור חדש בחרו את קובץ החיבור מהאתר."
        }
    }
    func importKey() {
        let panel = NSOpenPanel(); panel.allowedContentTypes = [.json]; panel.allowsMultipleSelection = false
        panel.message = "בחרו את TheQ-connection.json שהורדתם מדף סוכן וואטסאפ"; panel.prompt = "חיבור"
        guard panel.runModal() == .OK, let file = panel.url else { return }
        perform("מחברים את המחשב למערכת…") {
            try await self.checked(self.installedScript, ["import", file.path])
            self.message = "המפתח נקלט. כעת חברו את חשבון הוואטסאפ העסקי."
        }
    }
    var cli: URL { AgentPaths.base.appendingPathComponent("app/src/cli.mjs") }
    var configArguments: [String] { ["--config", AgentPaths.base.appendingPathComponent("config.json").path, "--data", AgentPaths.base.path] }
    func connect() {
        guard !connecting && !busy && !testFixture else { return }
        error = ""; connecting = true; message = "סרקו את ה־QR בחלון שנפתח דרך וואטסאפ העסקי בטלפון. המתינו לפתיחת קבוצת החוברות."
        let process = Process(); browserProcess = process
        Task {
            do { let output = try await ProcessService.run(AgentPaths.node, [cli.path, "connect"] + configArguments, process: process)
                if output.code != 0 && output.code != 15 { error = friendly(output.text) }
            } catch { self.error = friendly(error.localizedDescription) }
            connecting = false; browserProcess = nil; await refresh()
        }
    }
    func stopBrowser() async {
        if let process = browserProcess, process.isRunning { process.terminate() }
        while connecting { try? await Task.sleep(nanoseconds: 150_000_000) }
    }
    func confirmAndPreview() {
        let alert = NSAlert(); alert.messageText = "זה החשבון העסקי הנכון?"
        alert.informativeText = "ודאו שבחלון הוואטסאפ מופיע החשבון העסקי והקבוצה ״\(snapshot.groupName ?? "חוברות QR פתאל")״. הבדיקה הבאה תציג את התאמת החוברות ללא העלאה."
        alert.addButton(withTitle: "כן, בדיקת חוברות"); alert.addButton(withTitle: "ביטול")
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        perform("בודקים את החוברות ואת ההתאמה למערכת. לא מתבצעת העלאה…") {
            await self.stopBrowser()
            try await self.checked(self.cli, ["confirm", "--confirm-business"] + self.configArguments)
            try await self.checked(self.cli, ["run"] + self.configArguments)
            self.message = "הבדיקה הסתיימה. עיינו בשם החוויה ובשם הקובץ לפני ההפעלה."
        }
    }
    func preview() {
        perform("בודקים התאמות ללא העלאה…") {
            try await self.checked(self.cli, ["run"] + self.configArguments)
            self.message = "הבדיקה הסתיימה. הקבצים לא הוחלפו במערכת."
        }
    }
    func updateNow() {
        let alert = NSAlert(); alert.messageText = "עדכון עכשיו"
        alert.informativeText = "תתבצע סריקה חדשה והעלאת קבצים עם התאמה ודאית בלבד, ולאחריה הודעת סיכום לקבוצה. מועדי הבדיקות הבאים לא ישתנו."
        alert.addButton(withTitle: "עדכון עכשיו"); alert.addButton(withTitle: "ביטול")
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        perform("סורקים ומעדכנים עכשיו…") {
            try await self.checked(self.cli, ["run", "--commit"] + self.configArguments)
            self.message = "הבדיקה הסתיימה. תוצאות העדכון ומצב הדיווח מופיעים למטה."
        }
    }
    func recover() {
        perform("בודקים את הפעולה הקודמת מול המערכת, ללא העלאה חוזרת…") {
            try await self.checked(self.cli, ["resume"] + self.configArguments)
            self.message = "הפעולה הקודמת נבדקה. אפשר לבצע עדכון עכשיו; הפעלת התזמון היא פעולה נפרדת."
        }
    }
    func activate() {
        let alert = NSAlert(); alert.messageText = "הפעלת עדכונים אוטומטיים"
        alert.informativeText = "הסוכן יעדכן התאמות ודאיות בלבד. קבצים לא מזוהים או סותרים יישארו ללא עדכון ותישלח בקשת הבהרה לקבוצה במועדים שקבעתם. ודאו שרק מחשב אחד מעדכן את הקבוצה."
        alert.addButton(withTitle: "הפעלת הסוכן"); alert.addButton(withTitle: "ביטול")
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        perform("מפעילים עדכונים אוטומטיים…") { try await self.checked(self.installedScript, ["enable"]); self.message = "הסוכן פעיל. אפשר לסגור את החלון; המחשב צריך להישאר דולק ומחובר." }
    }
    func assign(_ row: PreviewRow, targetId: String) {
        perform("שומרים החלטה ובודקים מחדש ללא העלאה…") {
            try await self.checked(self.installedScript, ["assign", row.id, targetId])
            try await self.checked(self.cli, ["run"] + self.configArguments)
            self.message = "השיוך נשמר ונבדק. רק התאמות ודאיות יעודכנו במועד הבא."
        }
    }
    func exportReview() {
        let panel = NSSavePanel(); panel.allowedContentTypes = [.json]; panel.nameFieldStringValue = "TheQ-review.json"
        panel.message = "הדוח כולל שמות קבצים ופרטי הודעות הדרושים לבדיקת השיוך. הוא אינו כולל מפתחות או חיבור לוואטסאפ."
        guard panel.runModal() == .OK, let file = panel.url else { return }
        perform("מייצאים דוח בדיקה…") {
            try await self.checked(self.installedScript, ["export-review", file.path])
            self.message = "דוח הבדיקה נשמר במיקום שבחרתם."
        }
    }
    func pause() {
        perform("עוצרים את התזמון…") { try await self.checked(self.installedScript, ["disable"]); self.message = "התזמון נעצר. חיבור הוואטסאפ והקבצים נשמרו." }
    }
    func shutdown() { if let process = browserProcess, process.isRunning { process.terminate() } }
    func openDownloads() {
        guard let path = snapshot.downloadDirectory else { return }
        let folder = URL(fileURLWithPath: path)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        NSWorkspace.shared.open(folder)
    }
    func friendly(_ text: String) -> String {
        if text.contains("BATCH_STILL_RUNNING") { return "המערכת עדיין מסמנת פעולה קודמת כפעילה. לא בוצעה העלאה חוזרת. יצאו דוח בדיקה לבירור." }
        if text.contains("BATCH_NEEDS_REVIEW") || text.contains("UNCONFIRMED_BATCH") { return "תוצאת הפעולה הקודמת טרם אומתה. לחצו על בדיקת הפעולה הקודמת; אם החסימה נשארת, יצאו דוח בדיקה." }
        if text.contains("RECOVERY_API_UPGRADE_REQUIRED") { return "יש לעדכן את המערכת באתר לפני בדיקת הפעולה הקודמת." }
        if text.contains("ASSIGNMENT_API_UPGRADE_REQUIRED") { return "יש לעדכן את המערכת באתר לפני הפעלת השיוך החדש." }
        if text.contains("MESSAGE_DATE_UNREADABLE") { return "לא ניתן לקרוא את תאריך ההודעה. המתינו לטעינת וואטסאפ ולחצו שוב על בדיקת התאמה." }
        if text.contains("RUN_LOCKED") { return "כבר מתבצעת בדיקה במחשב. המתינו לסיומה ונסו שוב." }
        if text.contains("LOGIN") { return "נדרש חיבור לוואטסאפ. לחצו על חיבור וואטסאפ וסרקו שוב." }
        if text.contains("HTTP_401") || text.contains("HTTP_403") { return "החיבור למערכת חסום או שהמפתח בוטל. בדקו את המחשב בדף סוכן וואטסאפ באתר." }
        if text.contains("PREVIEW_REQUIRED") { return "יש לבצע בדיקת התאמה עדכנית ותקינה לפני הפעלת עדכונים." }
        if text.contains("CONNECTION") { return "לא ניתן לייבא את קובץ החיבור. בחרו את קובץ ה־JSON שהורד מהאתר." }
        return String(text.suffix(1200))
    }
}
