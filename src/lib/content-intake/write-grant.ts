import type { Firestore } from 'firebase-admin/firestore';
import { FATTAL_BOOKLET_TARGETS } from './fattal';
import { buildSetupReview, parseSetupSelection, type SetupBindings } from './setup-review';
import { requireCloud, requireOpenCloudTarget } from './cloud-policy';
import { requireReadGrant } from './read-grant';

export const WRITE_GRANT_LIFETIME_MS = 15 * 60 * 1000;
const scopes = ['read', 'write'];
export function parseWriteGrant(value: unknown) {
  requireCloud(value && typeof value === 'object' && !Array.isArray(value), 400, 'Invalid request');
  const input = value as Record<string, unknown>;
  requireCloud(Object.keys(input).sort().join(',') === 'connectionId,durationMinutes,keyHash,ownerEmail,ownerId,projectId,shortId', 400, 'Invalid request');
  requireCloud(typeof input.connectionId === 'string' && /^[a-f0-9]{32}$/.test(input.connectionId)
    && typeof input.keyHash === 'string' && /^[a-f0-9]{64}$/.test(input.keyHash)
    && input.durationMinutes === 15 && typeof input.shortId === 'string'
    && FATTAL_BOOKLET_TARGETS.some(t => t.shortId === input.shortId), 400, 'Invalid writer bounds');
  requireOpenCloudTarget(input.shortId);
  requireCloud(['ownerId', 'ownerEmail', 'projectId'].every(k => typeof input[k] === 'string'), 400, 'Invalid identity');
  const selection = parseSetupSelection(new URLSearchParams({ ownerId: String(input.ownerId), ownerEmail: String(input.ownerEmail),
    projectId: String(input.projectId), durationHours: '1' }));
  return { connectionId: input.connectionId, keyHash: input.keyHash, shortId: input.shortId, selection };
}
function selectionFor(bindings: SetupBindings) {
  requireReadGrant(bindings.cloudOwnerId && bindings.cloudOwnerEmail && bindings.cloudProjectId, 409, 'server_identity_required');
  requireReadGrant(bindings.cloudProjectId === bindings.projectId, 409, 'project_mismatch');
  return parseSetupSelection(new URLSearchParams({ ownerId: bindings.cloudOwnerId, ownerEmail: bindings.cloudOwnerEmail,
    projectId: bindings.cloudProjectId, durationHours: '1' }));
}
export async function issueWriteGrant(db: Firestore, actorId: string, bindings: SetupBindings,
  input: ReturnType<typeof parseWriteGrant>, now = () => Date.now()) {
  const selection = selectionFor(bindings);
  requireReadGrant(selection.ownerId === input.selection.ownerId && selection.ownerEmail === input.selection.ownerEmail, 409, 'owner_mismatch');
  requireReadGrant(selection.projectId === input.selection.projectId, 409, 'project_mismatch');
  const ref = db.collection('fattalCloudConnections').doc(input.connectionId);
  return db.runTransaction(async tx => {
    const [actor, owner, codes, existing] = await Promise.all([
      tx.get(db.collection('users').doc(actorId)), tx.get(db.collection('users').doc(selection.ownerId)),
      tx.get(db.collection('codes').where('shortId', 'in', FATTAL_BOOKLET_TARGETS.map(t => t.shortId))), tx.get(ref),
    ]);
    requireReadGrant(actor.data()?.role === 'super_admin', 403, 'administrator_required');
    const at = now(), review = buildSetupReview(selection, bindings, owner.data(), codes.docs.map(d => d.data()), at);
    requireReadGrant(review.mappingVerified, 409, 'targets_unverified');
    requireReadGrant(!existing.exists, 409, 'connection_exists'); // Includes read grants and cancellation tombstones.
    const expiresAt = at + WRITE_GRANT_LIFETIME_MS;
    tx.create(ref, { workflow: 'fattal-cloud-v1', keyHash: input.keyHash, ownerId: selection.ownerId,
      ownerEmail: selection.ownerEmail, projectId: selection.projectId, ownerVerifiedBy: actorId, ownerVerifiedAt: at,
      scopes, allowedTargets: [input.shortId], expiresAt, writeMode: 'supervised' });
    return { connectionId: ref.id, state: 'active', expiresAt, scopes, allowedTargets: [input.shortId], writeMode: 'supervised', retryAllowed: false };
  });
}
export async function inspectWriteGrant(db: Firestore, actorId: string, bindings: SetupBindings, id: string,
  revoke = false, now = () => Date.now()) {
  requireCloud(/^[a-f0-9]{32}$/.test(id), 400, 'Invalid connection');
  const selection = selectionFor(bindings), ref = db.collection('fattalCloudConnections').doc(id);
  return db.runTransaction(async tx => {
    const [actor, owner, codes, existing] = await Promise.all([
      tx.get(db.collection('users').doc(actorId)), tx.get(db.collection('users').doc(selection.ownerId)),
      tx.get(db.collection('codes').where('shortId', 'in', FATTAL_BOOKLET_TARGETS.map(t => t.shortId))), tx.get(ref),
    ]);
    requireReadGrant(actor.data()?.role === 'super_admin', 403, 'administrator_required');
    // Revoke existing grants even if a target has moved; missing cancellation must verify the mapping.
    const review = buildSetupReview(selection, bindings, owner.data(), codes.docs.map(d => d.data()), now());
    const record = existing.data();
    if (!record) {
      if (!revoke) return { connectionId: id, state: 'missing', retryAllowed: false };
      requireReadGrant(review.mappingVerified, 409, 'targets_unverified');
      tx.create(ref, { recordType: 'revocation_tombstone', workflow: 'fattal-cloud-v1', writeMode: 'supervised',
        ownerId: selection.ownerId, ownerEmail: selection.ownerEmail, projectId: selection.projectId,
        ownerVerifiedBy: actorId, ownerVerifiedAt: now(), scopes, revokedAt: now() });
      return { connectionId: id, state: 'revoked', retryAllowed: false };
    }
    requireReadGrant(record.workflow === 'fattal-cloud-v1' && record.writeMode === 'supervised'
      && record.ownerVerifiedBy === actorId && record.ownerId === selection.ownerId && record.ownerEmail === selection.ownerEmail
      && record.projectId === selection.projectId && Array.isArray(record.scopes)
      && record.scopes.length === 2 && scopes.every(s => record.scopes.includes(s)), 403, 'issuer_scope');
    const revoked = record.revokedAt != null || record.disabledAt != null;
    if (revoke && !revoked) tx.update(ref, { revokedAt: now() });
    return { connectionId: id, state: revoke || revoked ? 'revoked' : !Number.isSafeInteger(record.expiresAt) || record.expiresAt <= now() ? 'expired' : 'active',
      ...(Number.isSafeInteger(record.expiresAt) ? { expiresAt: record.expiresAt } : {}), retryAllowed: false };
  });
}
