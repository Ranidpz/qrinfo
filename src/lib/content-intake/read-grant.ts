import type { Firestore } from 'firebase-admin/firestore';
import { FATTAL_BOOKLET_TARGETS } from './fattal';
import { buildSetupReview, parseSetupSelection, SetupReviewError, type SetupBindings } from './setup-review';
import { CloudIntakeError, requireCloud, type CloudGrant } from './cloud-policy';

export const READ_GRANT_LIFETIME_MS = 3600000;
export type ReadGrantFailureCode = 'same_origin_required' | 'issuance_disabled' | 'server_identity_required'
  | 'owner_mismatch' | 'project_mismatch' | 'targets_unverified' | 'administrator_required'
  | 'connection_exists' | 'issuer_scope' | 'invalid_request' | 'unavailable';
class ReadGrantFailure extends CloudIntakeError {
  constructor(status: number, public code: ReadGrantFailureCode) { super(status, code); }
}
export function requireReadGrant(condition: unknown, status: number, code: ReadGrantFailureCode): asserts condition {
  if (!condition) throw new ReadGrantFailure(status, code);
}
// Only fixed codes leave the server: never exception messages, identities or key hashes.
export function readGrantFailureCode(error: unknown): ReadGrantFailureCode {
  if (error instanceof ReadGrantFailure) return error.code;
  if (error instanceof SetupReviewError) return error.code === 'ownerMismatch' ? 'owner_mismatch'
    : error.code === 'projectMismatch' ? 'project_mismatch' : 'invalid_request';
  return error instanceof CloudIntakeError && [400, 413].includes(error.status) ? 'invalid_request' : 'unavailable';
}
// A current configuration check is not evidence of why an earlier POST failed.
// No database writes, secret values, owner inference, or retry authorization.
export function readGrantConfiguration(bindings: SetupBindings, enabled: boolean) {
  const blockers: ReadGrantFailureCode[] = [];
  if (!enabled) blockers.push('issuance_disabled');
  if (!bindings.cloudOwnerId || !bindings.cloudOwnerEmail || !bindings.cloudProjectId) blockers.push('server_identity_required');
  if (!bindings.projectId || bindings.projectId !== bindings.publicProjectId
    || (bindings.cloudProjectId && bindings.cloudProjectId !== bindings.projectId)) blockers.push('project_mismatch');
  if ((bindings.cloudOwnerId && bindings.legacyOwnerId && bindings.cloudOwnerId !== bindings.legacyOwnerId)
    || (bindings.cloudOwnerEmail && bindings.legacyOwnerEmail && bindings.cloudOwnerEmail !== bindings.legacyOwnerEmail)) blockers.push('owner_mismatch');
  return { currentConfigurationOnly: true, blockers, retryAllowed: false };
}
export function parseReadGrant(value: unknown) {
  requireCloud(value && typeof value === 'object' && !Array.isArray(value), 400, 'Invalid request');
  const input = value as Record<string, unknown>;
  requireCloud(Object.keys(input).sort().join(',') === 'connectionId,durationHours,keyHash,ownerEmail,ownerId,projectId', 400, 'Invalid request');
  requireCloud(typeof input.connectionId === 'string' && /^[a-f0-9]{32}$/.test(input.connectionId)
    && typeof input.keyHash === 'string' && /^[a-f0-9]{64}$/.test(input.keyHash)
    && input.durationHours === 1, 400, 'Only a one-hour read grant is supported');
  requireCloud(['ownerId', 'ownerEmail', 'projectId'].every(key => typeof input[key] === 'string'), 400, 'Invalid identity');
  const selection = parseSetupSelection(new URLSearchParams({ ownerId: String(input.ownerId), ownerEmail: String(input.ownerEmail),
    projectId: String(input.projectId), durationHours: '1' }));
  return { selection, connectionId: input.connectionId, keyHash: input.keyHash };
}

// Called only by the authenticated, separately enabled route. No raw key enters
// this service. Recheck administrator, owner and all twelve parents atomically.
export async function issueReadGrant(db: Firestore, actorId: string, bindings: SetupBindings,
  input: ReturnType<typeof parseReadGrant>, now = () => Date.now()) {
  requireReadGrant(bindings.cloudProjectId && bindings.cloudOwnerId && bindings.cloudOwnerEmail, 409, 'server_identity_required');
  requireReadGrant(bindings.cloudProjectId === bindings.projectId, 409, 'project_mismatch');
  requireReadGrant(bindings.cloudOwnerId === input.selection.ownerId
    && bindings.cloudOwnerEmail === input.selection.ownerEmail, 409, 'owner_mismatch');
  const ref = db.collection('fattalCloudConnections').doc(input.connectionId);
  return db.runTransaction(async tx => {
    const [actor, owner, codes, existing] = await Promise.all([
      tx.get(db.collection('users').doc(actorId)), tx.get(db.collection('users').doc(input.selection.ownerId)),
      tx.get(db.collection('codes').where('shortId', 'in', FATTAL_BOOKLET_TARGETS.map(t => t.shortId))), tx.get(ref),
    ]);
    requireReadGrant(actor.data()?.role === 'super_admin', 403, 'administrator_required');
    const checkedAt = now();
    const review = buildSetupReview(input.selection, bindings, owner.data(), codes.docs.map(d => d.data()), checkedAt);
    requireReadGrant(review.mappingVerified, 409, 'targets_unverified');
    // Never reuse, rotate, extend, reactivate or overwrite an existing identity.
    requireReadGrant(!existing.exists, 409, 'connection_exists');
    const grant: CloudGrant = { workflow: 'fattal-cloud-v1', keyHash: input.keyHash,
      ownerId: review.ownerId, ownerEmail: review.ownerEmail, projectId: review.projectId,
      ownerVerifiedBy: actorId, ownerVerifiedAt: checkedAt, scopes: ['read'],
      allowedTargets: review.targets.map(t => t.shortId), expiresAt: checkedAt + READ_GRANT_LIFETIME_MS };
    tx.create(ref, grant);
    return { connectionId: ref.id, state: 'active', expiresAt: grant.expiresAt, scopes: ['read'] };
  });
}

export async function inspectReadGrant(db: Firestore, actorId: string, connectionId: string, revoke = false, now = () => Date.now()) {
  requireCloud(/^[a-f0-9]{32}$/.test(connectionId), 400, 'Invalid connection');
  const ref = db.collection('fattalCloudConnections').doc(connectionId);
  const evaluate = (record: CloudGrant | undefined) => {
    if (!record) return { connectionId, state: 'missing' };
    requireReadGrant(record.workflow === 'fattal-cloud-v1' && record.ownerVerifiedBy === actorId
      && record.scopes?.length === 1 && record.scopes[0] === 'read', 403, 'issuer_scope');
    return { connectionId, state: record.revokedAt != null || record.disabledAt != null ? 'revoked'
      : !Number.isSafeInteger(record.expiresAt) || record.expiresAt <= now() ? 'expired' : 'active', expiresAt: record.expiresAt, scopes: ['read'] };
  };
  if (!revoke) return evaluate((await ref.get()).data() as CloudGrant | undefined);
  return db.runTransaction(async tx => {
    const [actor, snapshot] = await Promise.all([tx.get(db.collection('users').doc(actorId)), tx.get(ref)]);
    requireCloud(actor.data()?.role === 'super_admin', 403, 'Administrator required');
    const result = evaluate(snapshot.data() as CloudGrant | undefined);
    if (result.state === 'missing' || result.state === 'revoked') return result;
    tx.update(ref, { revokedAt: now() });
    return { ...result, state: 'revoked' };
  });
}

export function readGrantError(error: unknown) {
  return error instanceof CloudIntakeError ? error.status : 503;
}
