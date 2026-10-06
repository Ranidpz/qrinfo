import SwiftUI
struct AgentActivityView: View {
    let snapshot: AgentSnapshot
    var body: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 8) {
                Text(snapshot.groupName ?? "קבוצת וואטסאפ").font(.headline)
                if let at = snapshot.cycleStartedAt { Text("תחילת המחזור החדש: \(displayTime(at))").font(.callout) }
                Text("הבדיקה הבאה: \(snapshot.nextCheck ?? "האוטומציה אינה מופעלת")")
                Text("ניסיון בדיקה אחרון: \(displayTime(snapshot.lastCheckAt))")
                Text("עדכון שאומת במערכת: \(displayTime(snapshot.lastUpdateAt))")
                if snapshot.enabled {
                    Label(snapshot.power?.active == true ? "מניעת שינה אוטומטית פעילה — המסך יכול להיכבות" : "מניעת השינה לא אומתה — בדקו בהגדרות", systemImage: snapshot.power?.active == true ? "checkmark.shield.fill" : "exclamationmark.triangle.fill")
                        .foregroundStyle(snapshot.power?.active == true ? .green : .orange)
                }
                if let outcome = snapshot.lastOutcome { Text(outcome).foregroundStyle(.secondary) }
                if (snapshot.deliveryOutstanding ?? 0) > 0 {
                    Text("דיווח ממתין לאישור מסירה; אינו חוסם עדכונים. פרטים בהגדרות.").font(.caption).foregroundStyle(.secondary)
                }
            }.frame(maxWidth: .infinity, alignment: .leading).padding(10)
        }
    }
    private func displayTime(_ value: String?) -> String {
        guard let value else { return "טרם נרשם" }
        let parser = ISO8601DateFormatter(); parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = parser.date(from: value) ?? ISO8601DateFormatter().date(from: value) else { return value }
        let formatter = DateFormatter(); formatter.timeZone = TimeZone(identifier: "Asia/Jerusalem"); formatter.dateFormat = "dd/MM/yyyy HH:mm"
        return formatter.string(from: date) + " (ישראל)"
    }
}
