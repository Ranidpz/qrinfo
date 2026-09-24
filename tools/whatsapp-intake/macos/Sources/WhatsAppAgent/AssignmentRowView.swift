import SwiftUI

@MainActor final class AssignmentForm: ObservableObject {
    @Published var editing = false
    @Published var selection = ""
}

struct AssignmentRowView: View {
    let row: PreviewRow
    let targets: [AssignmentTarget]
    let disabled: Bool
    let save: (String) -> Void
    @StateObject private var form = AssignmentForm()
    private var receipt: String {
        guard let raw = row.receivedAt, let date = ISO8601DateFormatter().date(from: raw) else { return row.receivedAt ?? "" }
        return date.formatted(date: .numeric, time: .shortened)
    }
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: row.status == "matched" ? "checkmark.circle.fill" : "exclamationmark.circle.fill").foregroundStyle(row.status == "matched" ? .green : .orange)
            VStack(alignment: .leading, spacing: 4) {
                Text(row.title).fontWeight(.medium)
                Text(row.filename).font(.caption).textSelection(.enabled)
                Text("התקבל: \(receipt) · מזהה \(row.id.suffix(6))").font(.caption).foregroundStyle(.secondary)
                if let reason = row.reason, !reason.isEmpty { Text(reason).font(.caption).foregroundStyle(.secondary).textSelection(.enabled) }
                if row.status != "matched" { Text(row.status == "duplicate" ? "יותר מקובץ אחד לאותה חוויה — נדרשת בחירה" : "ממתין לשיוך או לבדיקה; לא יועלה").font(.caption).foregroundStyle(.orange) }
            }
            Spacer()
            if !targets.isEmpty { Button("שיוך…") { form.selection = ""; form.editing = true }.disabled(disabled) }
        }
        .sheet(isPresented: $form.editing) {
            VStack(alignment: .leading, spacing: 16) {
                Text("שיוך הקובץ לחוויה").font(.title2.bold())
                Text(row.filename).textSelection(.enabled)
                Text("התקבל: \(receipt) · מזהה \(row.id.suffix(6))").foregroundStyle(.secondary)
                Text("ההחלטה חלה רק על הקובץ המסוים הזה. שם הקובץ המקורי נשמר. לא תתבצע העלאה בשמירה.")
                Picker("לאיזו חוויה שייך הקובץ?", selection: $form.selection) {
                    Text("בחרו חוויה או פעולה").tag("")
                    ForEach(targets) { target in Text(target.title).tag(target.id) }
                    Text("להשאיר קובץ זה ללא עדכון").tag("exclude")
                    Text("לבטל שיוך ידני ולבדוק מחדש").tag("clear")
                }
                HStack { Button("ביטול") { form.editing = false }; Spacer(); Button("שמירת החלטה ובדיקה") { form.editing = false; save(form.selection) }.buttonStyle(.borderedProminent).disabled(form.selection.isEmpty || disabled) }
            }.padding(24).frame(width: 520).environment(\.layoutDirection, .rightToLeft)
        }
    }
}
