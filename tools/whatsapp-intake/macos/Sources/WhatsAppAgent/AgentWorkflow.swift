import Foundation

enum AgentWorkflow: Equatable {
    case prepare, importKey, connect, confirm, recover, preview, activate, active
    static func resolve(_ state: AgentSnapshot, prepared: Bool, appVersion: String) -> Self {
        if !prepared || state.runnerVersion != appVersion { return .prepare }
        if !state.connected { return .importKey }
        if state.state == "connected_needs_confirmation" { return .confirm }
        if !state.paired { return .connect }
        if state.pending == true { return .recover }
        if !state.previewReady && !state.enabled { return .preview }
        return state.enabled ? .active : .activate
    }
    var step: Int {
        switch self { case .prepare, .importKey, .connect, .confirm: return 1
        case .recover, .preview: return 2
        case .activate, .active: return 3 }
    }
    var button: String {
        switch self {
        case .prepare: return "הכנת הסוכן והמשך"
        case .importKey: return "בחירת קובץ חיבור"
        case .connect: return "חיבור וואטסאפ"
        case .confirm: return "אישור החשבון ובדיקה"
        case .recover: return "בדיקת הפעולה הקודמת"
        case .preview: return "בדיקת הקבצים"
        case .activate: return "הפעלת האוטומציה"
        case .active: return "עדכון עכשיו"
        }
    }
    var detail: String {
        switch self {
        case .prepare: return "נכין או נעדכן את הרכיבים. החיבור והקבצים הקיימים נשמרים."
        case .importKey: return "בחרו את קובץ החיבור שהורדתם מדף סוכן וואטסאפ באתר."
        case .connect: return "סרקו את קוד ה־QR דרך חשבון הוואטסאפ המיועד לקבוצה."
        case .confirm: return "ודאו שהחשבון והקבוצה בחלון וואטסאפ נכונים, ואז המשיכו."
        case .recover: return "תחילה נוודא מול המערכת מה כבר בוצע. הקבצים לא יועלו שוב."
        case .preview: return "נסרוק את הקבוצה ונציג לאן מתאים כל קובץ. בשלב הזה אין העלאה."
        case .activate: return "עיינו בהתאמות. ההפעלה תעדכן אוטומטית במועדים שהגדרתם באתר."
        case .active: return "האוטומציה מופעלת. אפשר גם לבדוק ולעדכן עכשיו, בלי לשנות את המועדים."
        }
    }
}
