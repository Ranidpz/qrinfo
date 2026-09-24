import SwiftUI

struct AgentView: View {
    @ObservedObject var agent: AgentController
    private var flow: AgentWorkflow { .resolve(agent.snapshot, prepared: agent.prepared, appVersion: agent.appVersion) }
    private var problem: String { !agent.error.isEmpty ? agent.error : agent.friendly(agent.snapshot.lastError ?? "") }
    private var blocked: Bool { agent.busy || (agent.connecting && flow != .confirm) }
    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    steps
                    VStack(alignment: .leading, spacing: 8) {
                        Text(flow == .active ? "הסוכן פעיל" : "שלב \(flow.step) מתוך 3").font(.title2.bold())
                        Text(flow.detail).foregroundStyle(.secondary)
                        if agent.snapshot.enabled == false && agent.snapshot.activationReason == "upgrade" {
                            Text("לאחר עדכון גרסה נדרשת בדיקה והפעלה מחדש.").font(.callout).foregroundStyle(.secondary)
                        }
                    }
                    if agent.busy {
                        ProgressView().progressViewStyle(.linear)
                        Text(agent.message).foregroundStyle(.secondary)
                    }
                    if !problem.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Label("הבדיקה דורשת טיפול", systemImage: "exclamationmark.triangle.fill").font(.headline).foregroundStyle(.orange)
                            Text(problem).textSelection(.enabled)
                            ForEach(Array((agent.snapshot.missingMessages ?? []).enumerated()), id: \.offset) { _, item in
                                Text(item.name ?? "קובץ ללא שם").font(.callout).textSelection(.enabled)
                            }
                            Button("יצוא דוח לתמיכה") { agent.exportReview() }.disabled(blocked || !agent.prepared)
                        }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                    }
                    if agent.snapshot.syncState == "failed" {
                        Label("הסנכרון לאתר נכשל. בדקו את האינטרנט ואת הרשאת המחשב בהגדרות.", systemImage: "wifi.exclamationmark").foregroundStyle(.orange)
                    }
                    if agent.snapshot.connected {
                        AgentActivityView(snapshot: agent.snapshot)
                    }
                    if !agent.snapshot.rows.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("תוצאת בדיקת הקבצים").font(.headline)
                            Text("קבצים עם התאמה ודאית יעודכנו; קבצים לא מזוהים ימתינו לתיקון.").font(.callout).foregroundStyle(.secondary)
                            ForEach(agent.snapshot.rows) { row in
                                AssignmentRowView(row: row, targets: agent.snapshot.targets ?? [], disabled: blocked || agent.snapshot.pending == true) { target in agent.assign(row, targetId: target) }
                                Divider()
                            }
                        }
                    } else if flow == .preview && problem.isEmpty {
                        Text(agent.snapshot.state == "no_files" ? "לא נמצאו קבצים בטווח הבדיקה. אפשר לבדוק שוב או לייצא דוח דרך ההגדרות." : "תוצאות ההתאמה יוצגו כאן לאחר הבדיקה.").foregroundStyle(.secondary)
                    }
                }.padding(24).frame(maxWidth: .infinity, alignment: .leading)
            }
            Divider()
            footer
        }.frame(minWidth: 720, minHeight: 600)
        .environment(\.layoutDirection, .rightToLeft)
        .task { while !Task.isCancelled { await agent.refresh(); try? await Task.sleep(nanoseconds: 2_000_000_000) } }
    }
    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: "bubble.left.and.bubble.right.fill").font(.title).foregroundStyle(.blue)
            VStack(alignment: .leading, spacing: 3) {
                Text("סוכן וואטסאפ").font(.title2.bold())
                Text("The Q · גרסה \(agent.appVersion)").font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Label(agent.snapshot.enabled ? "מופעל" : "לא מופעל", systemImage: agent.snapshot.enabled ? "checkmark.circle.fill" : "pause.circle").foregroundStyle(agent.snapshot.enabled ? .green : .secondary)
            SettingsLink { Label("הגדרות", systemImage: "gearshape") }
        }.padding(20)
    }
    private var steps: some View {
        HStack {
            ForEach(Array(["חיבור", "בדיקת קבצים", "הפעלה"].enumerated()), id: \.offset) { index, title in
                HStack(spacing: 7) {
                    Image(systemName: index + 1 < flow.step || flow == .active ? "checkmark.circle.fill" : "\(index + 1).circle.fill")
                    Text(title)
                }.font(.callout.weight(.semibold)).foregroundStyle(index + 1 == flow.step ? Color.accentColor : Color.secondary)
                if index < 2 { Rectangle().fill(.quaternary).frame(height: 1) }
            }
        }.accessibilityElement(children: .combine)
    }
    private var footer: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(agent.busy ? "הפעולה מתבצעת…" : agent.connecting && flow != .confirm ? "ממתינים לחיבור בחלון וואטסאפ…" : flow.button).font(.headline)
                Text(agent.snapshot.enabled ? "המק צריך להישאר דולק, מחובר ולא ישן." : "הפעולה הבאה זמינה כאן תמיד.").font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            if flow == .activate {
                Button("עדכון עכשיו") { agent.updateNow() }.disabled(blocked)
            }
            if flow == .active {
                Button("בדיקה ללא העלאה") { agent.preview() }.disabled(blocked)
            }
            Button(flow.button) { primaryAction() }.buttonStyle(.borderedProminent).controlSize(.large).disabled(blocked)
        }.padding(20).background(.bar)
    }
    private func primaryAction() {
        switch flow {
        case .prepare: agent.prepare()
        case .importKey: agent.importKey()
        case .connect: agent.connect()
        case .confirm: agent.confirmAndPreview()
        case .recover: agent.recover()
        case .preview: agent.preview()
        case .activate: agent.activate()
        case .active: agent.updateNow()
        }
    }
}
