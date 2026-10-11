import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { FATTAL_BOOKLET_TARGETS } from './fattal';
import { buildSetupReview, verifySetupProject, type SetupBindings } from './setup-review';
import { activeVersion, canonical, fileLedgerId, isHash, manifestId, parseManifest,
  requireCloud, requireOpenCloudTarget, validateGrantMetadata, type CloudManifest } from './cloud-policy';

export interface PdfDigest { sha256: string; size: number }
export type ReadCurrentPdf = (media: Record<string, unknown>) => Promise<PdfDigest>;
const approvalLifetime = 15 * 60 * 1000;
const connectionPattern = /^[a-f0-9]{32}$/;

export function createManifestApprovals(db: Firestore, bindings: SetupBindings,
  readCurrentPdf: ReadCurrentPdf, now = () => Date.now()) {
  const approvals = db.collection('fattalCloudApprovals');
  function config() {
    requireCloud(bindings.cloudOwnerId && bindings.cloudOwnerEmail && bindings.cloudProjectId, 409, 'Explicit server identity is required');
    requireCloud(verifySetupProject(bindings) === bindings.cloudProjectId, 409, 'Configured project mismatch');
    requireCloud((!bindings.legacyOwnerId || bindings.legacyOwnerId === bindings.cloudOwnerId)
      && (!bindings.legacyOwnerEmail || bindings.legacyOwnerEmail === bindings.cloudOwnerEmail), 409, 'Configured owner mismatch');
    return { enabled: true, writesEnabled: false, ownerId: bindings.cloudOwnerId,
      ownerEmail: bindings.cloudOwnerEmail, projectId: bindings.cloudProjectId };
  }
  async function candidate(tx: Transaction, actorId: string, connectionId: string, value: unknown) {
    requireCloud(connectionPattern.test(connectionId), 400, 'Invalid writer connection ID');
    const bounds = config();
    const [actor, owner, connection, codes] = await Promise.all([
      tx.get(db.collection('users').doc(actorId)), tx.get(db.collection('users').doc(bounds.ownerId)),
      tx.get(db.collection('fattalCloudConnections').doc(connectionId)),
      tx.get(db.collection('codes').where('shortId', 'in', FATTAL_BOOKLET_TARGETS.map(target => target.shortId))),
    ]);
    requireCloud(actor.data()?.role === 'super_admin', 403, 'Administrator required');
    const grant = validateGrantMetadata(connection.data(), bounds, 'write', now());
    const mapping = buildSetupReview({ ...bounds, durationHours: 1 }, bindings, owner.data(), codes.docs.map(doc => doc.data()), now());
    requireCloud(mapping.mappingVerified, 409, 'All twelve parent targets must verify');
    const manifest = parseManifest(value, grant, now());
    requireCloud(manifest.review.reviewer === actorId, 403, 'The authenticated administrator must review this manifest');
    requireOpenCloudTarget(manifest.shortId);
    const target = codes.docs.find(doc => doc.data().shortId === manifest.shortId)!;
    const media = target.data().media ?? [];
    requireCloud(Array.isArray(media) && (media.length === 0 || (media.length === 1 && media[0]?.type === 'pdf')), 409, 'Expected one active PDF or an empty target');
    requireCloud(activeVersion(media) === manifest.expectedVersion, 409, 'Active version changed; review again');
    requireCloud(!target.data().fattalCloudPending, 409, 'Target has an uncertain write; recover first');
    const [receipt, duplicate] = await Promise.all([
      tx.get(db.collection('fattalCloudRuns').doc(manifestId(manifest))),
      tx.get(db.collection('fattalCloudFiles').doc(fileLedgerId(manifest))),
    ]);
    requireCloud(!receipt.exists && !duplicate.exists, 409, 'This file or manifest already has a receipt; recover first');
    const intake = media[0]?.contentIntake;
    if (intake?.workflow === 'fattal-cloud-v1' && intake.sha256 !== manifest.sha256) {
      requireCloud(isHash(intake.cloudManifestId), 409, 'Current predecessor evidence is unavailable');
      const previous = (await tx.get(db.collection('fattalCloudRuns').doc(intake.cloudManifestId))).data();
      requireCloud(previous?.status === 'activated' && previous.codeId === target.id
        && previous.manifest?.sha256 === intake.sha256 && previous.object?.url === media[0].url
        && manifestId(previous.manifest) === intake.cloudManifestId, 409, 'Current predecessor evidence is unavailable');
      if (canonical(previous.manifest.period) === canonical(manifest.period)) {
        requireCloud(previous.manifest.sourceGroupId === manifest.sourceGroupId
          && Array.isArray(previous.manifest.sources) && previous.manifest.sources.every((source: { messageId: string; fileId: string; sha256: string }) =>
            manifest.supersedes.some(item => item.messageId === source.messageId && item.fileId === source.fileId && item.sha256 === source.sha256)),
        409, 'Same-period replacement must explicitly identify the predecessor sources');
      }
    }
    return { manifest, grant, media: media as Record<string, unknown>[] };
  }
  function normalizePreview(actorId: string, value: unknown) {
    requireCloud(value && typeof value === 'object' && !Array.isArray(value), 400, 'Manifest required');
    const manifest = value as CloudManifest;
    // The authenticated reviewer and server time replace any caller attribution.
    return { ...manifest, review: { ...manifest.review, reviewer: actorId, reviewedAt: now() } };
  }
  async function inspectBytes(media: Record<string, unknown>[], manifest: CloudManifest) {
    if (!media.length) return null;
    const digest = await readCurrentPdf(media[0]);
    requireCloud(isHash(digest.sha256) && Number.isSafeInteger(digest.size) && digest.size > 5, 503, 'Current PDF could not be verified');
    // Manual uploads may have no cloud hash metadata. Compare actual bytes, not names.
    requireCloud(digest.sha256 !== manifest.sha256, 409, 'These bytes are already active; do not upload them again');
    return { sha256: digest.sha256, size: digest.size, expectedVersion: manifest.expectedVersion };
  }
  async function preview(actorId: string, connectionId: string, value: unknown) {
    const input = normalizePreview(actorId, value);
    const initial = await db.runTransaction(tx => candidate(tx, actorId, connectionId, input));
    const predecessor = await inspectBytes(initial.media, initial.manifest);
    // The pointer, permissions or grant may change during the read-only PDF fetch.
    const checked = await db.runTransaction(tx => candidate(tx, actorId, connectionId, initial.manifest));
    return { protocol: 1, connectionId, manifest: checked.manifest, manifestId: manifestId(checked.manifest), predecessor,
      expiresAt: Math.min(now() + approvalLifetime, checked.grant.expiresAt, checked.manifest.review.reviewedAt + 3600000),
      persisted: false, uploadAllowed: false, notification: 'disabled', cleanup: 'disabled' };
  }
  async function approve(actorId: string, connectionId: string, value: unknown, expectedId: string) {
    requireCloud(isHash(expectedId), 400, 'Reviewed manifest ID required');
    const initial = await db.runTransaction(tx => candidate(tx, actorId, connectionId, value));
    requireCloud(manifestId(initial.manifest) === expectedId, 409, 'Reviewed manifest digest mismatch');
    const predecessor = await inspectBytes(initial.media, initial.manifest);
    return db.runTransaction(async tx => {
      const checked = await candidate(tx, actorId, connectionId, initial.manifest);
      const ref = approvals.doc(expectedId), existing = await tx.get(ref);
      if (existing.exists) {
        const record = existing.data()!;
        requireCloud(record.connectionId === connectionId && record.approvedBy === actorId
          && canonical(record.manifest) === canonical(checked.manifest)
          && record.revokedAt == null && record.disabledAt == null && record.expiresAt > now(), 409, 'Approval already exists; inspect its status');
        return { protocol: 1, manifestId: expectedId, state: 'approved', expiresAt: record.expiresAt, persisted: true, uploadPerformed: false };
      }
      const approvedAt = now();
      const expiresAt = Math.min(approvedAt + approvalLifetime, checked.grant.expiresAt, checked.manifest.review.reviewedAt + 3600000);
      requireCloud(expiresAt > approvedAt, 409, 'Review or writer expired');
      tx.create(ref, { reviewProtocol: 1, manifest: checked.manifest, connectionId, approvedBy: actorId, approvedAt, expiresAt, predecessor });
      return { protocol: 1, manifestId: expectedId, state: 'approved', expiresAt, persisted: true, uploadPerformed: false };
    });
  }
  async function status(actorId: string, id: string, revoke = false) {
    requireCloud(isHash(id), 400, 'Invalid manifest ID');
    return db.runTransaction(async tx => {
      const [actor, snapshot] = await Promise.all([tx.get(db.collection('users').doc(actorId)), tx.get(approvals.doc(id))]);
      requireCloud(actor.data()?.role === 'super_admin', 403, 'Administrator required');
      const record = snapshot.data();
      if (!record) {
        // A missing cancellation is not a fence. Never report it as revoked.
        requireCloud(!revoke, 409, 'Approval is missing; reconcile before retry');
        return { protocol: 1, manifestId: id, state: 'missing', retryAllowed: false };
      }
      const bounds = config();
      requireCloud(record.approvedBy === actorId && record.manifest?.ownerId === bounds.ownerId
        && record.manifest?.projectId === bounds.projectId && manifestId(record.manifest) === id, 403, 'Approval is outside reviewer scope');
      let state = record.revokedAt != null || record.disabledAt != null ? 'revoked'
        : !Number.isSafeInteger(record.expiresAt) || record.expiresAt <= now() ? 'expired' : 'approved';
      if (revoke && state !== 'revoked') { tx.update(snapshot.ref, { revokedAt: now() }); state = 'revoked'; }
      return { protocol: 1, manifestId: id, state, expiresAt: record.expiresAt, retryAllowed: false };
    });
  }
  return { preview, approve, status, revoke: (actorId: string, id: string) => status(actorId, id, true) };
}
