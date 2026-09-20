import { dateParts } from './messages.mjs';

export function cycleDay(now, timeZone) {
  const p = dateParts(now, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function hasNewFiles(files, checkpoint, day) {
  if (!checkpoint || checkpoint.day !== day) return true;
  const acknowledged = new Set(checkpoint.fileKeys);
  return files.some((file) => !acknowledged.has(file.key));
}

export function buildGroupUpdate(report, { first, now = new Date(), timeZone }) {
  if (report.results.some((r) => !['updated', 'skipped_duplicate'].includes(r.status))) throw new Error('UNCONFIRMED_GROUP_REPORT');
  const updated = report.results.filter((r) => r.status === 'updated');
  const received = report.results.length;
  const names = updated.map((r) => r.title || r.filename);
  const missing = report.preview.missingTargets.map((r) => r.target.title);
  const date = new Intl.DateTimeFormat('he-IL', { timeZone, day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const lines = [`עדכון חוברות — ${date}`, first
    ? `התקבלו ${received} חוברות; ${updated.length} הועלו${updated.length ? ' ✅' : '.'}`
    : `בוצע ✅ הועלו ${updated.length} חוברות נוספות.`];
  if (names.length) lines.push(`הועלו: ${names.join(', ')}.`);
  if (first && received > updated.length) lines.push(`${received - updated.length} כבר היו מעודכנות.`);
  lines.push(missing.length ? `חסרות: ${missing.join(', ')}.` : 'כל החוברות התקבלו ועודכנו.');
  return lines.join('\n');
}
