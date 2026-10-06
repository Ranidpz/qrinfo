// Human-facing notification copy. Technical identifiers remain in the audit log.
export const agentEmailStates = ['review_required', 'login_required', 'run_failed', 'no_files', 'ready'] as const;
export type AgentEmailState = typeof agentEmailStates[number];
const messages: Record<AgentEmailState, {subject: string; outcome: string; action: string}> = {
  no_files: {subject:'לא נמצאו קבצים חדשים', outcome:'הבדיקה הסתיימה בלי למצוא קבצים בטווח שנבדק. החוברות במערכת לא שונו.', action:'אין צורך בפעולה אם לא נשלחו קבצים חדשים. אם ציפיתם לעדכון, בדקו שהקבצים נשלחו לקבוצה הנכונה.'},
  login_required: {subject:'צריך לחבר מחדש את וואטסאפ', outcome:'הסוכן לא הצליח להתחבר לוואטסאפ ולכן לא יכול להמשיך לבדוק קבצים.', action:'פתחו את סוכן וואטסאפ במחשב המצוין, ובחרו בהגדרות חיבור מחדש לוואטסאפ.'},
  run_failed: {subject:'הבדיקה לא הושלמה', outcome:'אירעה תקלה בבדיקת הקבצים או בעדכון. המייל הזה אינו מאשר שכל החוברות עודכנו.', action:'פתחו את סוכן וואטסאפ במחשב המצוין ופעלו לפי ההודעה. אם התקלה נמשכת, יצאו דוח לתמיכה דרך ההגדרות.'},
  review_required: {subject:'יש קבצים שדורשים הבהרה', outcome:'חלק מהקבצים ממתינים להבהרה ולא עודכנו. פירוט מה עודכן מופיע במייל סיכום העדכון.', action:'בקשו בקבוצה לשלוח את הקבצים שוב עם שם החוויה או המיקום בשם הקובץ. כשיש כמה גרסאות, בקשו לציין איזו מהן נכונה.'},
  ready: {subject:'הבדיקה הצליחה', outcome:'הסוכן חזר לבצע בדיקות בהצלחה. פירוט העלאות, אם בוצעו, מופיע במייל סיכום נפרד.', action:'אין צורך בפעולה.'},
};
export function buildAgentStatusEmail(state: AgentEmailState, computerName: unknown, at: Date) {
  const name = typeof computerName === 'string' && computerName.trim() ? computerName.trim().slice(0,80) : 'שם המחשב לא זמין';
  const date = new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(at);
  const message = messages[state];
  const text = [`סוכן וואטסאפ — חוברות פתאל`, `מחשב: ${name}`, `מועד הבדיקה: ${date} (שעון ישראל)`, '', message.outcome, '', `מה צריך לעשות: ${message.action}`].join('\n');
  const escape = (s:string) => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  return {subject:`סוכן וואטסאפ | ${name} | ${message.subject}`,text,
    html:`<div dir="rtl" lang="he" style="white-space:pre-line;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;max-width:600px">${escape(text)}</div>`};
}
