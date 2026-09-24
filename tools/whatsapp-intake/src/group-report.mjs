import { assignmentFingerprint, isExpectedReview } from './assignment.mjs';
import { dateParts } from './messages.mjs';

export function cycleDay(now, timeZone) {
  const p = dateParts(now, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function hasNewFiles(files, checkpoint, day) {
  if (!checkpoint || checkpoint.day !== day) return true;
  const acknowledged = new Set(checkpoint.fileKeys);
  return files.length !== acknowledged.size || files.some(file => !acknowledged.has(assignmentFingerprint(file)));
}

export function buildGroupUpdate(report, { first, now = new Date(), timeZone }) {
  if (!isExpectedReview(report)) throw new Error('UNCONFIRMED_GROUP_REPORT');
  const updated = report.results.filter((r) => r.status === 'updated');
  const received = report.results.length;
  const unresolved = report.results.filter(r => r.status === 'skipped' && r.reason !== 'manual_excluded');
  const excluded = report.results.filter(r => r.reason === 'manual_excluded').length;
  const duplicates = report.results.filter(r => r.status === 'skipped_duplicate').length;
  const names = updated.map((r) => r.title || r.filename);
  const missing = report.preview.missingTargets.map((r) => r.target.title);
  const date = new Intl.DateTimeFormat('he-IL', { timeZone, day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const lines = [`עדכון חוברות — ${date}`, first
    ? `התקבלו ${received} חוברות; ${updated.length} הועלו${updated.length ? ' ✅' : '.'}`
    : updated.length ? `בוצע ✅ הועלו ${updated.length} חוברות נוספות.` : 'לא הועלו קבצים חדשים.'];
  if (names.length) lines.push(`הועלו: ${names.join(', ')}.`);
  if (first && duplicates) lines.push(`${duplicates} כבר היו מעודכנות.`);
  if (excluded) lines.push(`${excluded} קבצים נשארו ללא עדכון לפי בחירה ידנית.`);
  if (unresolved.length) {
    lines.push(`ממתינים לבדיקה (${unresolved.length}):`);
    for (const item of unresolved) {
      const match = report.preview.matches.find(m => m.file.id === item.fileId);
      const time = match?.file.receivedAt ? new Intl.DateTimeFormat('he-IL', {timeZone, day:'numeric', month:'numeric', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).format(new Date(match.file.receivedAt)) : '';
      lines.push(`• ${item.filename} · ${time} · מזהה ${item.fileId?.slice(-6) || ''}${item.reason === 'duplicate' ? ' — יותר מקובץ אחד לאותה חוויה' : ''}`);
    }
    lines.push('לא זוהה שיוך חד־משמעי. נא להשיב לקובץ עם שם החוויה כפי שמופיע במערכת, או לשלוח אותו מחדש עם השם בשם הקובץ. אפשר גם לשייך בממשק הסוכן.');
  }
  lines.push(missing.length ? `חסרות: ${missing.join(', ')}.` : unresolved.length ? 'הקבצים המפורטים לעיל עדיין ממתינים להבהרה.' : 'כל החוברות התקבלו ועודכנו.');
  return lines.join('\n');
}
