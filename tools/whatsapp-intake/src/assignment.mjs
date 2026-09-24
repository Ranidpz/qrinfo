import { createHash } from 'node:crypto';

export function senderFromMessageId(id) {
  // Group message identity includes the participant JID; display names are not identities.
  return /_(\d+(?::\d+)?@(?:c\.us|s\.whatsapp\.net|lid))$/.exec(id || '')?.[1] || '';
}
export function attachEvidence(files, rows, decisions = {}) {
  return files.map(file => {
    const evidence = [];
    const source = rows.find(r => r.id === file.messageId && r.filename);
    const senderId = source?.senderId || '';
    const make = row => ({ kind: row.id === file.messageId ? 'caption' : 'reply', text: row.text,
      targetMessageId: file.messageId, messageId: row.id, senderId: row.senderId,
      attachmentSenderId: senderId, at: row.receivedAt });
    if (senderId && source?.text && source.receivedAt) evidence.push(make(source));
    for (const row of rows) {
      if (row.quoteId === file.messageId && row.senderId === senderId && senderId && row.text && row.receivedAt) evidence.push(make(row));
    }
    const manual = decisions[file.key];
    if (manual?.sha256 === file.sha256 && manual.messageId === file.messageId) {
      evidence.push({ kind: 'manual', text: manual.reason, targetMessageId: file.messageId,
        messageId: file.messageId, senderId: 'local-operator', attachmentSenderId: senderId || 'unknown',
        at: manual.at, ...(manual.targetCodeId ? { targetCodeId: manual.targetCodeId } : {}), ...(manual.exclude ? { exclude: true } : {}) });
    }
    return { ...file, evidence };
  });
}
export function assignmentFingerprint(file) {
  return `${file.key}:${createHash('sha256').update(JSON.stringify(file.evidence || [])).digest('hex').slice(0, 16)}`;
}
export function isExpectedReview(report) {
  return report.results.every(result => ['updated', 'skipped_duplicate'].includes(result.status)
    || (result.status === 'skipped' && report.preview.matches.some(m => m.file.id === result.fileId && m.status !== 'matched')));
}
