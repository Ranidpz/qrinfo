import SwiftUI
import AppKit

struct AgentView: View {
    @ObservedObject var agent: AgentController
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack(spacing: 12) {
                    Image(systemName: "bubble.left.and.bubble.right.fill").font(.system(size: 34)).foregroundStyle(.blue)
                    VStack(alignment: .leading, spacing: 4) { Text("סוכן וואטסאפ").font(.largeTitle.bold()); Text("The Q · חוברות מעודכנות, מאותו קוד QR").foregroundStyle(.secondary) }
                    Spacer()
                    Label(agent.snapshot.enabled ? "התזמון מופעל" : "התזמון כבוי", systemImage: agent.snapshot.enabled ? "checkmark.circle.fill" : "pause.circle").foregroundStyle(agent.snapshot.enabled ? .green : .secondary)
                }
                if agent.snapshot.syncState == "failed" { Text("הסנכרון למערכת נכשל. בדקו את החיבור ואת הרשאת המחשב באתר לפני המשך העבודה.").foregroundStyle(.orange) }
                if agent.busy { ProgressView().progressViewStyle(.linear) }
                Text(agent.message).foregroundStyle(.secondary).textSelection(.enabled)
                if !agent.error.isEmpty { Label(agent.error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red).textSelection(.enabled) }
                GroupBox {
                    VStack(alignment: .leading, spacing: 18) {
                        step("1", "הכנת הסוכן", detail: "רכיבי ההפעלה והדפדפן יותקנו אוטומטית. נדרש אינטרנט בהכנה הראשונה.", done: agent.prepared) {
                            Button(agent.prepared ? "עדכון רכיבי הסוכן" : "הכנת הסוכן") { agent.prepare() }.disabled(agent.busy || agent.connecting)
                        }
                        Divider()
                        step("2", "חיבור למערכת", detail: agent.snapshot.connected ? "מחובר לחשבון \(agent.snapshot.ownerEmail ?? "")" : "בחרו את קובץ החיבור שהורדתם מהאתר. אין צורך להעתיק מפתח.", done: agent.snapshot.connected) {
                            Button(agent.snapshot.connected ? "החלפת קובץ חיבור" : "בחירת קובץ חיבור") { agent.importKey() }.disabled(!agent.prepared || agent.busy || agent.connecting)
                        }
                        Divider()
                        step("3", "חיבור וואטסאפ ובדיקת החוברות", detail: "סרקו דרך החשבון העסקי בטלפון. הדפדפן נפרד מהוואטסאפ האישי שלכם.", done: agent.snapshot.paired) {
                            HStack {
                                Button("חיבור וואטסאפ") { agent.connect() }.disabled(!agent.snapshot.connected || agent.busy || agent.connecting)
                                if agent.connecting || agent.snapshot.state == "connected_needs_confirmation" {
                                    Button("אישור החשבון ובדיקת חוברות") { agent.confirmAndPreview() }.disabled(agent.busy || agent.snapshot.state != "connected_needs_confirmation")
                                } else if agent.snapshot.paired {
                                    Button("בדיקת התאמה") { agent.preview() }.disabled(agent.busy)
                                }
                            }
                        }
                    }.padding(12)
                }
                if !agent.snapshot.rows.isEmpty {
                    GroupBox("התאמת החוברות — הבדיקה האחרונה") {
                        VStack(alignment: .leading, spacing: 10) {
                            ForEach(agent.snapshot.rows) { row in
                                HStack(alignment: .top, spacing: 12) {
                                    Image(systemName: row.status == "matched" ? "checkmark.circle.fill" : "exclamationmark.circle.fill").foregroundStyle(row.status == "matched" ? .green : .orange)
                                    VStack(alignment: .leading, spacing: 3) { Text(row.title).fontWeight(.medium); Text(row.filename).font(.caption).foregroundStyle(.secondary).textSelection(.enabled) }
                                    Spacer()
                                }
                            }
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(10)
                    }
                }
                GroupBox {
                    HStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("עדכונים אוטומטיים").font(.headline)
                            Text("הימים והשעות מוגדרים באתר. הפעילו מחשב אחד בלבד לכל קבוצת חוברות.").font(.callout).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if agent.snapshot.enabled { Button("עצירת התזמון") { agent.pause() }.disabled(agent.busy || agent.connecting) }
                        else { Button("הפעלת עדכונים") { agent.activate() }.buttonStyle(.borderedProminent).disabled(!agent.snapshot.previewReady || agent.busy || agent.connecting) }
                    }.padding(12)
                }
                GroupBox("תיקיית ההורדות") {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(agent.snapshot.downloadDirectory ?? "התיקייה תיווצר בהכנת הסוכן, בתוך Application Support של המשתמש במק.")
                            .font(.system(.caption, design: .monospaced)).environment(\.layoutDirection, .leftToRight).textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading)
                        HStack { Text("קובצי PDF נשמרים גם לאחר העלאה. אין מחיקה אוטומטית.").font(.caption).foregroundStyle(.secondary); Spacer(); Button("פתיחת התיקייה") { agent.openDownloads() }.disabled(agent.snapshot.downloadDirectory == nil) }
                    }.padding(10)
                }
                HStack {
                    Button("פתיחת הניהול באתר") { NSWorkspace.shared.open(URL(string: "https://qr.playzones.app/he/content-intake")!) }
                    Button("הגדרות שינה במק") { NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.energysaver")!) }
                    Spacer()
                    Text("אפשר לסגור את החלון. לעדכונים ברקע השאירו את המק דולק, מחובר ולא ישן.").font(.caption).foregroundStyle(.secondary)
                }
            }.padding(28).frame(maxWidth: .infinity, alignment: .leading)
        }.frame(minWidth: 780, minHeight: 650)
        .environment(\.layoutDirection, .rightToLeft)
        .task { while !Task.isCancelled { await agent.refresh(); try? await Task.sleep(nanoseconds: 2_000_000_000) } }
    }
    private func step<Content: View>(_ number: String, _ title: String, detail: String, done: Bool, @ViewBuilder controls: () -> Content) -> some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack { Circle().fill(done ? Color.green.opacity(0.15) : Color.blue.opacity(0.12)).frame(width: 30, height: 30); if done { Image(systemName: "checkmark").foregroundStyle(.green) } else { Text(number).foregroundStyle(.blue) } }
            VStack(alignment: .leading, spacing: 8) { Text(title).font(.headline); Text(detail).font(.callout).foregroundStyle(.secondary); controls().controlSize(.large) }
            Spacer(minLength: 0)
        }
    }
}
