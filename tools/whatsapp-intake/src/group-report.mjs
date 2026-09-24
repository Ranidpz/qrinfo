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
  const unique = values => [...new Set(values.filter(Boolean))];
  const updated = unique(report.results.filter(r => r.status === 'updated').map(r => r.title || r.filename));
  const held = report.results.filter(r => r.status === 'skipped');
  const missing = unique(report.preview.missingTargets.map(r => r.target.title));
  const stamp = new Intl.DateTimeFormat('he-IL', {timeZone, day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'}).format(now);
  const lines = [`עדכון חוברות · ${stamp}`, updated.length ? `✅ עודכנו: ${updated.join(', ')}.` : 'לא עודכנו קבצים חדשים.'];
  if (held.length) {
    const groups = new Map();
    for (const item of held) groups.set(item.filename, (groups.get(item.filename) || 0) + 1);
    lines.push(`⚠️ לא עודכנו: ${[...groups].map(([name,count]) => `${count > 1 ? `${count} קבצים בשם ` : ''}״${name}״`).join(', ')}.`);
    if (held.some(r => r.reason === 'duplicate')) lines.push('נא לשלוח גרסה אחת מאושרת לכל חוויה.');
    if (held.some(r => r.reason !== 'duplicate')) lines.push('נא לשלוח מחדש עם שם החוויה והמיקום בשם הקובץ.');
  }
  if (missing.length) lines.push(`חסרות: ${missing.join(', ')}.`);
  if (!held.length && !missing.length && first) lines.push('כל החוברות מעודכנות.');
  return lines.join('\n');
}
