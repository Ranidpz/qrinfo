import { getAdminDb } from '@/lib/firebase-admin';
import { buildFattalPreview, type FattalPreviewParams } from './fattal';
import { buildDedupeId } from './file-dedupe';
import type { ConfirmedIntakeFileUpdate } from './types';

// Only server-owned, successful receipts can establish an already-applied
// baseline. Request bodies and client checkpoints cannot supply this evidence.
export async function buildVerifiedFattalPreview(params: Omit<FattalPreviewParams, 'confirmedUpdates'>) {
  const initial = buildFattalPreview(params);
  const conflicting = initial.matches.filter(m => m.status === 'duplicate'
    && m.target && m.file.source === 'whatsapp' && /^[a-f0-9]{64}$/.test(m.file.sha256 || ''));
  if (!conflicting.length) return initial;
  const db = getAdminDb();
  const ids = [...new Set(conflicting.map(m => buildDedupeId(m.target!.codeId, m.file.sha256!)))];
  const snapshots = await Promise.all(ids.map(id => db.collection('contentIntakeFileUpdates').doc(id).get()));
  const confirmedUpdates: ConfirmedIntakeFileUpdate[] = [];
  for (const snapshot of snapshots) {
    const r = snapshot.data();
    if (!r || r.workflow !== 'fattal-booklets' || r.status !== 'updated' || r.source !== 'whatsapp') continue;
    const updatedAt = typeof r.replacedAt === 'string' ? r.replacedAt : r.updatedAt?.toDate?.().toISOString();
    if (![r.ownerId, r.codeId, r.fileHash, r.filename, r.sourceMessageId, r.detectedDate, updatedAt, r.url]
      .every(v => typeof v === 'string' && v.length > 0)) continue;
    confirmedUpdates.push({ ownerId:r.ownerId, codeId:r.codeId, fileHash:r.fileHash, filename:r.filename,
      sourceMessageId:r.sourceMessageId, detectedDate:r.detectedDate, updatedAt, url:r.url });
  }
  return buildFattalPreview({ ...params, confirmedUpdates });
}
