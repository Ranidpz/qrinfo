#!/usr/bin/env node
/**
 * One-off migration: move per-media secrets off the world-readable codes/{id} doc into
 * the owner-only codes/{id}/private/secrets doc.
 *
 *   raffleConfig.token              → media.{mediaId}.raffleToken
 *   selfiebeamContent.photographerToken → media.{mediaId}.photographerToken
 *   qtagConfig.scannerPin           → media.{mediaId}.scannerPin
 *
 * Safe to re-run: a value already in the private doc is never overwritten, and the public
 * field is removed only after the private copy is committed (same transaction).
 * Existing links keep working — the server resolves private first, legacy second.
 *
 * Usage (dry run by default):
 *   node --env-file=.env.local scripts/migrate-code-secrets.mjs            # dry run, project from env
 *   node --env-file=.env.local scripts/migrate-code-secrets.mjs --apply
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY for the target project.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const SECRET_FIELDS = [
  ['raffleToken', 'raffleConfig', 'token'],
  ['photographerToken', 'selfiebeamContent', 'photographerToken'],
  ['scannerPin', 'qtagConfig', 'scannerPin'],
];

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!raw) {
  console.error('FIREBASE_SERVICE_ACCOUNT_KEY is not set');
  process.exit(1);
}
const serviceAccount = JSON.parse(raw);
initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();

console.log(`Project: ${serviceAccount.project_id} — ${APPLY ? 'APPLY' : 'dry run'}`);

const codes = await db.collection('codes').get();
let codesWithSecrets = 0;
let secretsMoved = 0;

for (const codeDoc of codes.docs) {
  const media = codeDoc.data().media;
  if (!Array.isArray(media)) continue;
  const found = [];
  for (const m of media) {
    for (const [secretKey, configKey, field] of SECRET_FIELDS) {
      if (m?.[configKey] && Object.prototype.hasOwnProperty.call(m[configKey], field)) {
        found.push({ mediaId: m.id, secretKey, configKey, field, value: m[configKey][field] });
      }
    }
  }
  if (found.length === 0) continue;
  codesWithSecrets++;
  console.log(`${codeDoc.id} (${codeDoc.data().shortId}): ${found.map((f) => `${f.mediaId}.${f.secretKey}`).join(', ')}`);
  if (!APPLY) continue;

  const codeRef = codeDoc.ref;
  const secretsRef = codeRef.collection('private').doc('secrets');
  await db.runTransaction(async (tx) => {
    const [fresh, secretsSnap] = await Promise.all([tx.get(codeRef), tx.get(secretsRef)]);
    const freshMedia = fresh.data()?.media;
    if (!Array.isArray(freshMedia)) return;
    const stored = secretsSnap.data()?.media || {};
    const toStore = {};

    const cleaned = freshMedia.map((m) => {
      let next = m;
      for (const [secretKey, configKey, field] of SECRET_FIELDS) {
        const config = next?.[configKey];
        if (!config || !Object.prototype.hasOwnProperty.call(config, field)) continue;
        const value = config[field];
        if (typeof value === 'string' && m.id && stored[m.id]?.[secretKey] === undefined) {
          toStore[m.id] = { ...toStore[m.id], [secretKey]: value };
          secretsMoved++;
        }
        const { [field]: _removed, ...rest } = config;
        next = { ...next, [configKey]: rest };
      }
      return next;
    });

    if (Object.keys(toStore).length > 0) tx.set(secretsRef, { media: toStore }, { merge: true });
    tx.update(codeRef, { media: cleaned });
  });
}

console.log(`\n${codesWithSecrets} code(s) with on-doc secrets${APPLY ? `, ${secretsMoved} secret value(s) moved` : ' (dry run — nothing written)'}`);
