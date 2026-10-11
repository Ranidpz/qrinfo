import type { Firestore } from 'firebase-admin/firestore';
import { FATTAL_BOOKLET_TARGETS } from './fattal';
import { verifySetupProject, type SetupBindings } from './setup-review';
import { activeVersion, canonical, isHash, manifestId, parseManifest, requireCloud } from './cloud-policy';
import type { ReadCurrentPdf } from './cloud-approval';

// Independently authenticated administrator GET: no writer token, local journal,
// mutation capability, retry, grant renewal or activation is needed or supplied.
export function createSupervisedReconciliation(db: Firestore, bindings: SetupBindings, readPdf: ReadCurrentPdf) {
  async function snapshot(actorId: string, id: string) {
    requireCloud(isHash(id), 400, 'Invalid manifest ID');
    requireCloud(bindings.cloudOwnerId && bindings.cloudOwnerEmail && bindings.cloudProjectId
      && verifySetupProject(bindings) === bindings.cloudProjectId
      && (!bindings.legacyOwnerId || bindings.legacyOwnerId === bindings.cloudOwnerId)
      && (!bindings.legacyOwnerEmail || bindings.legacyOwnerEmail === bindings.cloudOwnerEmail), 409, 'Verified server identity required');
    const ownerId = bindings.cloudOwnerId, ownerEmail = bindings.cloudOwnerEmail, projectId = bindings.cloudProjectId;
    return db.runTransaction(async tx => {
      const [actor, owner, approved, run] = await Promise.all([
        tx.get(db.collection('users').doc(actorId)), tx.get(db.collection('users').doc(ownerId)),
        tx.get(db.collection('fattalCloudApprovals').doc(id)), tx.get(db.collection('fattalCloudRuns').doc(id)),
      ]);
      requireCloud(actor.data()?.role === 'super_admin', 403, 'Administrator required');
      requireCloud(owner.data()?.email === ownerEmail, 403, 'Owner mismatch');
      const review = approved.data();
      requireCloud(review && review.approvedBy === actorId && /^[a-f0-9]{32}$/.test(review.connectionId), 404, 'Scoped approval unavailable');
      const manifest = parseManifest(review.manifest, { ownerId, projectId, allowedTargets: FATTAL_BOOKLET_TARGETS.map(t => t.shortId) }, Date.now(), false);
      requireCloud(manifestId(manifest) === id && manifest.review.reviewer === actorId, 409, 'Stored review mismatch');
      const [connection, targets] = await Promise.all([
        tx.get(db.collection('fattalCloudConnections').doc(review.connectionId)),
        tx.get(db.collection('codes').where('shortId', '==', manifest.shortId)),
      ]);
      const grant = connection.data();
      // Expiry/revocation disables new writes but does not hide this administrator's evidence.
      requireCloud(grant?.writeMode === 'supervised' && grant.ownerId === ownerId && grant.ownerEmail === ownerEmail
        && grant.projectId === projectId && grant.workflow === 'fattal-cloud-v1'
        && Array.isArray(grant.allowedTargets) && grant.allowedTargets.length === 1 && grant.allowedTargets[0] === manifest.shortId
        && (grant.attemptManifestId === undefined || grant.attemptManifestId === id), 403, 'Writer bounds mismatch');
      requireCloud(targets.docs.length === 1 && targets.docs[0].data().ownerId === ownerId
        && !targets.docs[0].data().parentCodeShortId, 403, 'Target ownership mismatch');
      const target = targets.docs[0], media = target.data().media ?? [];
      requireCloud(Array.isArray(media) && (media.length === 0 || (media.length === 1 && media[0]?.type === 'pdf')), 409, 'Target media mismatch');
      const receipt = run.data();
      if (receipt) requireCloud(receipt.connectionId === review.connectionId && receipt.executionMode === 'supervised'
        && receipt.codeId === target.id && canonical(receipt.manifest) === canonical(manifest)
        && ['pending', 'activated'].includes(receipt.status) && grant.attemptManifestId === id, 409, 'Receipt bounds mismatch');
      const object = receipt?.object;
      const matches = receipt?.status === 'activated' && object?.storageProvider === 'cloudflare-r2'
        && typeof object.storageKey === 'string' && typeof object.storageBucket === 'string'
        && media[0]?.url === object.url && media[0]?.contentIntake?.cloudManifestId === id
        && media[0]?.contentIntake?.sha256 === manifest.sha256;
      const status = receipt?.status === 'activated' && !matches ? 'superseded' : 'uncertain';
      return { manifest, receiptPresent: !!receipt, attemptRegistered: grant.attemptManifestId === id,
        status, matches, object, fingerprint: canonical({ review, receipt, version: activeVersion(media), pending: target.data().fattalCloudPending ?? null }) };
    });
  }
  async function reconcile(actorId: string, id: string) {
    const before = await snapshot(actorId, id);
    let verified = false;
    if (before.matches) {
      try {
        const digest = await readPdf({ ...before.object!, type: 'pdf' });
        verified = digest.sha256 === before.manifest.sha256 && digest.size === before.manifest.size;
      } catch { /* Unavailable storage is uncertainty, never permission to write. */ }
    }
    // Recheck actor, owner, target and receipt after public-object I/O.
    const after = await snapshot(actorId, id);
    verified = verified && after.matches && before.fingerprint === after.fingerprint;
    return { protocol: 1, manifestId: id, manifest: after.manifest, status: verified ? 'verified' : after.status,
      verified, receiptPresent: after.receiptPresent, attemptRegistered: after.attemptRegistered,
      retryAllowed: false, uploadAllowed: false, notification: 'disabled', cleanup: 'disabled' };
  }
  return { reconcile };
}
