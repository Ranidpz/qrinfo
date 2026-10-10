import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { StoredObject } from '@/lib/media-storage';
import { FATTAL_BOOKLET_TARGETS } from './fattal';
import {
  activeVersion, canonical, cloudTokenId, fileLedgerId, isHash, manifestId, parseManifest,
  requireCloud, sha256, validateGrant,
  type CloudConfig, type CloudManifest, type CloudScope,
} from './cloud-policy';

export interface CloudStorage {
  upload(key: string, bytes: Buffer): Promise<StoredObject>;
  verify(object: StoredObject, hash: string, size: number): Promise<boolean>;
}
// Dependency injection keeps all tests off Firebase, object storage and messaging.
// There is intentionally no notification or deletion capability in this service.
export function createCloudService(db: Firestore, config: CloudConfig, token: string, storage: CloudStorage, now = () => Date.now()) {
  const connectionId = cloudTokenId(token);
  const grantRef = db.collection('fattalCloudConnections').doc(connectionId);
  const ownerRef = db.collection('users').doc(config.ownerId);
  const runs = db.collection('fattalCloudRuns');
  const ledger = db.collection('fattalCloudFiles');

  async function context(scope: CloudScope, tx?: Transaction) {
    const grantDoc = tx ? await tx.get(grantRef) : await grantRef.get();
    const grant = validateGrant(grantDoc.data(), token, config, scope, now());
    const ownerDoc = tx ? await tx.get(ownerRef) : await ownerRef.get();
    requireCloud(ownerDoc.exists && ownerDoc.data()?.email === config.ownerEmail, 403, 'Verified owner account mismatch');
    const query = db.collection('codes').where('shortId', 'in', grant.allowedTargets);
    const targets = tx ? await tx.get(query) : await query.get();
    for (const shortId of grant.allowedTargets) {
      const matches = targets.docs.filter(d => d.data().shortId === shortId);
      requireCloud(matches.length === 1 && matches[0].data().ownerId === grant.ownerId && !matches[0].data().parentCodeShortId,
        403, 'Target ownership, uniqueness or parent check failed');
    }
    return { grant, targets: targets.docs, owner: ownerDoc.data()! };
  }
  function targetFor(ctx: Awaited<ReturnType<typeof context>>, shortId: string) {
    const target = ctx.targets.find(d => d.data().shortId === shortId);
    requireCloud(target, 403, 'Target is outside credential bounds');
    const media = target.data().media ?? [];
    requireCloud(Array.isArray(media) && (media.length === 0 || (media.length === 1 && media[0]?.type === 'pdf')), 409, 'Cloud replacement requires one PDF or an empty target');
    return { doc: target, media };
  }
  async function approval(manifest: CloudManifest, tx: Transaction) {
    const record = (await tx.get(db.collection('fattalCloudApprovals').doc(manifestId(manifest)))).data();
    requireCloud(record && record.connectionId === connectionId && record.approvedBy === manifest.review.reviewer
      && record.revokedAt == null && record.disabledAt == null
      && Number.isSafeInteger(record.approvedAt) && record.approvedAt >= manifest.review.reviewedAt && record.approvedAt <= now()
      && Number.isSafeInteger(record.expiresAt) && record.expiresAt > now()
      && canonical(record.manifest) === canonical(manifest), 403, 'A valid administrator approval for this exact manifest and connection is required');
  }
  async function replacementEvidence(manifest: CloudManifest, target: ReturnType<typeof targetFor>, tx?: Transaction) {
    const intake = target.media[0]?.contentIntake;
    if (intake?.workflow !== 'fattal-cloud-v1' || intake.sha256 === manifest.sha256) return;
    requireCloud(isHash(intake.cloudManifestId), 409, 'Current cloud receipt is unavailable');
    const ref = runs.doc(intake.cloudManifestId);
    const predecessor = (tx ? await tx.get(ref) : await ref.get()).data();
    requireCloud(predecessor?.status === 'activated' && predecessor.codeId === target.doc.id
      && predecessor.manifest?.sha256 === intake.sha256 && predecessor.object?.url === target.media[0].url
      && manifestId(predecessor.manifest) === intake.cloudManifestId, 409, 'Current cloud receipt is unavailable');
    if (canonical(predecessor.manifest.period) !== canonical(manifest.period)) return;
    requireCloud(Array.isArray(predecessor.manifest.sources) && predecessor.manifest.sources.every((source: { messageId: string; fileId: string; sha256: string }) =>
      manifest.supersedes.some(s => s.messageId === source.messageId && s.fileId === source.fileId && s.sha256 === source.sha256)),
    409, 'Same-period correction must explicitly supersede the active source identities');
  }
  async function health() {
    const ctx = await context('read');
    return { protocol: 1, ownerId: config.ownerId, ownerEmail: config.ownerEmail, projectId: config.projectId,
      scopes: ctx.grant.scopes, expiresAt: ctx.grant.expiresAt, writesEnabled: config.writesEnabled,
      notificationsEnabled: false, cleanupEnabled: false,
      targets: ctx.targets.map(d => ({ shortId: d.data().shortId, hotel: FATTAL_BOOKLET_TARGETS.find(t => t.shortId === d.data().shortId)!.key,
        expectedVersion: activeVersion(d.data().media), pending: !!d.data().fattalCloudPending })) };
  }
  async function preview(value: unknown) {
    const ctx = await context('read');
    const manifest = parseManifest(value, ctx.grant, now());
    const target = targetFor(ctx, manifest.shortId);
    requireCloud(activeVersion(target.media) === manifest.expectedVersion, 409, 'Active version changed; review again');
    await replacementEvidence(manifest, target);
    const previous = await ledger.doc(fileLedgerId(manifest)).get();
    return { protocol: 1, manifest, manifestId: manifestId(manifest), saved: false,
      duplicate: previous.exists, pending: !!target.doc.data().fattalCloudPending,
      notification: 'disabled', cleanup: 'disabled' };
  }
  async function recovery(id: string) {
    requireCloud(isHash(id), 400, 'Invalid manifest ID');
    const ctx = await context('read');
    const receipt = (await runs.doc(id).get()).data();
    requireCloud(receipt && receipt.manifest?.ownerId === ctx.grant.ownerId
      && receipt.manifest?.projectId === config.projectId && ctx.grant.allowedTargets.includes(receipt.manifest?.shortId), 404, 'Scoped receipt not found');
    const manifest = parseManifest(receipt.manifest, ctx.grant, now(), false);
    requireCloud(manifestId(manifest) === id, 409, 'Stored receipt does not match its manifest digest');
    const target = targetFor(ctx, manifest.shortId);
    const current = target.media[0];
    const matches = receipt.status === 'activated' && receipt.object && target.doc.id === receipt.codeId
      && current?.url === receipt.object.url && current?.contentIntake?.cloudManifestId === id
      && current?.contentIntake?.sha256 === manifest.sha256;
    let verified = !!matches && await storage.verify(receipt.object, manifest.sha256, manifest.size);
    if (verified) {
      // A pointer/permission may change while the public object is being fetched.
      const after = targetFor(await context('read'), manifest.shortId);
      verified = after.doc.id === receipt.codeId && activeVersion(after.media) === activeVersion(target.media);
    }
    return { protocol: 1, manifestId: id, status: verified ? 'verified' : receipt.status === 'activated' && !matches ? 'superseded' : 'uncertain',
      verified, retryAllowed: false, filename: manifest.filename, shortId: manifest.shortId, sha256: manifest.sha256,
      sources: manifest.sources, supersedes: manifest.supersedes, activatedAt: receipt.activatedAt ?? null,
      notification: 'disabled', cleanup: 'disabled' };
  }
  async function commit(value: unknown, reviewedId: string, bytes: Buffer) {
    const ctx = await context('write');
    requireCloud(config.writesEnabled, 403, 'Cloud writes are disabled');
    const manifest = parseManifest(value, ctx.grant, now());
    const id = manifestId(manifest);
    requireCloud(isHash(reviewedId) && reviewedId === id, 409, 'Reviewed manifest digest mismatch');
    requireCloud(bytes.length === manifest.size && sha256(bytes) === manifest.sha256 && bytes.subarray(0, 5).toString() === '%PDF-', 400, 'PDF bytes differ from reviewed manifest');
    const runRef = runs.doc(id);
    // A durable claim precedes any external write. A timeout, crash or ambiguous
    // storage result leaves the claim in place. There is no timeout-based takeover.
    const claim = await db.runTransaction(async tx => {
      const fresh = await context('write', tx);
      parseManifest(manifest, fresh.grant, now());
      const target = targetFor(fresh, manifest.shortId);
      const existing = await tx.get(runRef);
      const duplicate = await tx.get(ledger.doc(fileLedgerId(manifest)));
      if (existing.exists) return { upload: false, id };
      if (duplicate.exists) return { upload: false, id: String(duplicate.data()!.manifestId) };
      await approval(manifest, tx);
      await replacementEvidence(manifest, target, tx);
      requireCloud(activeVersion(target.media) === manifest.expectedVersion, 409, 'Active version changed; review again');
      requireCloud(!target.doc.data().fattalCloudPending, 409, 'Target has an uncertain write; recover before retry');
      const usage = Number(fresh.owner.storageUsed ?? 0);
      const limit = Number(fresh.owner.storageLimit ?? 0);
      requireCloud(Number.isFinite(usage) && usage >= 0 && Number.isFinite(limit) && limit >= 0
        && (!limit || usage + manifest.size <= limit), 409, 'Storage quota exceeded or unavailable');
      // Charge the new bytes without subtracting the retained predecessor. Failed
      // staging keeps a conservative reservation until separately audited cleanup.
      tx.update(ownerRef, { storageUsed: usage + manifest.size });
      tx.update(target.doc.ref, { fattalCloudPending: id });
      tx.create(runRef, { status: 'pending', manifest, connectionId, codeId: target.doc.id, claimedAt: now(), reservedBytes: manifest.size });
      return { upload: true, id };
    });
    if (!claim.upload) return recovery(claim.id);

    try {
      const object = await storage.upload(`fattal-cloud/${manifest.ownerId}/${manifest.shortId}/${id}.pdf`, bytes);
      requireCloud(object.size === manifest.size && await storage.verify(object, manifest.sha256, manifest.size), 409, 'Staged PDF could not be verified');
      await db.runTransaction(async tx => {
        const fresh = await context('write', tx); // Revocation/expiry rechecked at activation.
        parseManifest(manifest, fresh.grant, now());
        const target = targetFor(fresh, manifest.shortId);
        const receipt = await tx.get(runRef);
        const duplicate = await tx.get(ledger.doc(fileLedgerId(manifest)));
        requireCloud(receipt.data()?.status === 'pending' && target.doc.data().fattalCloudPending === id
          && !duplicate.exists && activeVersion(target.media) === manifest.expectedVersion, 409, 'Activation precondition changed; recover before retry');
        await approval(manifest, tx);
        await replacementEvidence(manifest, target, tx);
        const activatedAt = now();
        const old = target.media[0] ?? {};
        // Preserve display settings and predecessor identity, but never an old page count.
        const { pageCount: _oldPageCount, ...display } = old;
        void _oldPageCount;
        const media = { ...display, id: old.id || `cloud_${id.slice(0, 20)}`, type: 'pdf', url: object.url,
          filename: manifest.filename, size: manifest.size, uploadedBy: manifest.ownerId,
          title: old.title || manifest.filename, order: old.order ?? 0,
          storageProvider: object.storageProvider, storageKey: object.storageKey, storageBucket: object.storageBucket,
          contentType: 'application/pdf', createdAt: old.createdAt || new Date(activatedAt),
          contentIntake: { workflow: 'fattal-cloud-v1', cloudManifestId: id, sha256: manifest.sha256, updatedAt: new Date(activatedAt) } };
        requireCloud(object.storageProvider === 'cloudflare-r2' && object.storageKey && object.storageBucket, 409, 'Verified R2 storage metadata is required');
        tx.update(target.doc.ref, { media: [media], fattalCloudPending: null, updatedAt: new Date(activatedAt) });
        // Receipt and active pointer are atomic: an uncertain transaction response
        // must NEVER trigger deletion of an object that might now be current.
        tx.update(runRef, { status: 'activated', object, predecessor: target.media[0] ?? null, activatedAt });
        tx.create(ledger.doc(fileLedgerId(manifest)), { manifestId: id, ownerId: manifest.ownerId, shortId: manifest.shortId, sha256: manifest.sha256 });
      });
      return await recovery(id); // Read pointer and hash again before confirming.
    } catch {
      // No writes or retries in recovery, including no cleanup after uncertainty.
      return { protocol: 1, manifestId: id, status: 'uncertain', verified: false, retryAllowed: false,
        recoveryRequired: true, notification: 'disabled', cleanup: 'disabled' };
    }
  }
  return { health, preview, commit, recovery };
}
