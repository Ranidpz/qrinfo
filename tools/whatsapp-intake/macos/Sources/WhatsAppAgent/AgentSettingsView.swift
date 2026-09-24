import SwiftUI
import AppKit

struct AgentSettingsView: View {
    @ObservedObject var agent: AgentController
    private var blocked: Bool { agent.busy || agent.connecting }
    var body: some View {
        ScrollView {
            Form {
                Section("חיבור ותוכנה") {
                    Text("גרסת יישום: \(agent.appVersion) · רכיבים: \(agent.snapshot.runnerVersion ?? "טרם הותקנו")")
                    Text(agent.snapshot.ownerEmail ?? "טרם חובר חשבון")
                    Button("עדכון רכיבי הסוכן") { agent.prepare() }.disabled(blocked)
                    Button("החלפת קובץ חיבור") { agent.importKey() }.disabled(blocked || !agent.prepared)
                    Button("חיבור מחדש לוואטסאפ") { agent.connect() }.disabled(blocked || !agent.snapshot.connected)
                }
                Section("פעילות ותזמון") {
                    Button("מועדי הבדיקות והמחשבים באתר") { NSWorkspace.shared.open(URL(string: "https://qr.playzones.app/he/content-intake")!) }
                    if agent.snapshot.enabled { Button("עצירת האוטומציה") { agent.pause() }.disabled(blocked) }
                    Button("הגדרות שינה במק") { NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.energysaver")!) }
                    Text("השאירו את המק דולק, מחובר לאינטרנט ומשתמש מחובר. אפשר לסגור את חלון הסוכן.").font(.caption)
                }
                Section("קבצים ותמיכה") {
                    Text(agent.snapshot.downloadDirectory ?? "תיקיית הקבצים תיווצר בהכנה")
                        .font(.system(.caption, design: .monospaced)).environment(\.layoutDirection, .leftToRight).textSelection(.enabled)
                    Text("הקבצים נשמרים לאחר ההעלאה. אין מחיקה אוטומטית.").font(.caption)
                    Button("פתיחת תיקיית הקבצים") { agent.openDownloads() }.disabled(agent.snapshot.downloadDirectory == nil)
                    Button("יצוא דוח לתמיכה") { agent.exportReview() }.disabled(blocked || !agent.prepared)
                    if (agent.snapshot.deliveryOutstanding ?? 0) > 0 {
                        Text("דיווחים ממתינים לאישור מסירה. הקבצים כבר אומתו במערכת; אין צורך להעלותם שוב.")
                        Button("בדיקת אישור הדיווח") { agent.recover() }.disabled(blocked)
                    }
                }
                if agent.busy { ProgressView(agent.message) }
                if !agent.error.isEmpty { Text(agent.error).foregroundStyle(.orange) }
            }.formStyle(.grouped).padding()
        }.frame(width: 600, height: 620).environment(\.layoutDirection, .rightToLeft)
    }
}
