/**
 * Cleanup script: Deletes test votes and restores voting phase
 *
 * After a load test, this removes all votes created during the test
 * and resets candidate vote counts to 0, restoring the session to clean state.
 *
 * Also restores the original voting phase and verification setting if changed.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

async function cleanup() {
  console.log('Cleaning up test votes...');

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccount) {
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY not set');
    process.exit(1);
  }

  const parsedSA = JSON.parse(serviceAccount);
  const app = initializeApp({
    credential: cert(parsedSA),
    projectId: parsedSA.project_id,
  }, 'cleanup-votes');

  const db = getFirestore(app);

  // Read test config
  let codeId: string;
  let originalPhase: string;
  let originalVerification = 'false';
  try {
    codeId = readFileSync(join(__dirname, 'results', 'code-id.txt'), 'utf-8').trim();
    originalPhase = readFileSync(join(__dirname, 'results', 'original-phase.txt'), 'utf-8').trim();
    try {
      originalVerification = readFileSync(join(__dirname, 'results', 'original-verification.txt'), 'utf-8').trim();
    } catch { /* optional file */ }
  } catch {
    console.log('No test config found. Nothing to clean up.');
    process.exit(0);
  }

  console.log(`Code ID: ${codeId}`);

  // Step 1: Delete all votes
  console.log('Deleting votes...');
  let votesDeleted = 0;
  while (true) {
    const snapshot = await db.collection('codes').doc(codeId)
      .collection('votes').limit(400).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    votesDeleted += snapshot.size;
    console.log(`  Deleted ${votesDeleted} votes...`);
  }

  // Step 2: Reset candidate vote counts
  console.log('Resetting candidate vote counts...');
  const candidatesSnapshot = await db.collection('codes').doc(codeId)
    .collection('candidates').get();

  const BATCH_SIZE = 400;
  for (let i = 0; i < candidatesSnapshot.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = candidatesSnapshot.docs.slice(i, i + BATCH_SIZE);
    chunk.forEach(doc => {
      batch.update(doc.ref, {
        voteCount: 0,
        finalsVoteCount: 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }
  console.log(`  Reset ${candidatesSnapshot.size} candidates`);

  // Step 3: Delete qvoteStats
  try {
    await db.collection('codes').doc(codeId)
      .collection('qvoteStats').doc('current').delete();
    console.log('  Deleted stats document');
  } catch { /* ignore */ }

  // Step 4: Clean rate limits created during test
  console.log('Cleaning rate limits...');
  let rateLimitsDeleted = 0;
  while (true) {
    const snapshot = await db.collection('rateLimits')
      .where('__name__', '>=', `vote_`)
      .where('__name__', '<', `vote_~`)
      .limit(400).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    rateLimitsDeleted += snapshot.size;
  }
  if (rateLimitsDeleted > 0) {
    console.log(`  Deleted ${rateLimitsDeleted} rate limit entries`);
  }

  // Step 5: Delete test verified voters
  console.log('Cleaning test verified voters...');
  let votersDeleted = 0;
  while (true) {
    const snapshot = await db.collection('verifiedVoters')
      .where('codeId', '==', codeId)
      .limit(400)
      .get();
    // Only delete stress-test voters (phone starts with +97250)
    const testDocs = snapshot.docs.filter(doc => {
      const data = doc.data();
      return data.phone?.startsWith('+97250');
    });
    if (testDocs.length === 0) break;

    const batch = db.batch();
    testDocs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    votersDeleted += testDocs.length;
    if (snapshot.size < 400) break;
  }
  if (votersDeleted > 0) {
    console.log(`  Deleted ${votersDeleted} test verified voters`);
  }

  // Step 6: Restore original phase and verification setting
  const needsPhaseRestore = originalPhase && originalPhase !== 'voting' && originalPhase !== 'finals';
  const needsVerificationRestore = originalVerification === 'true';

  if (needsPhaseRestore || needsVerificationRestore) {
    console.log('Restoring original settings...');
    const codeDoc = await db.collection('codes').doc(codeId).get();
    const codeData = codeDoc.data();
    const media = codeData?.media || [];
    const qvoteMediaIndex = media.findIndex((m: { type: string }) => m.type === 'qvote');

    if (qvoteMediaIndex !== -1) {
      const updatedMedia = [...media];
      const config = { ...updatedMedia[qvoteMediaIndex].qvoteConfig };

      if (needsPhaseRestore) {
        config.currentPhase = originalPhase;
        delete config._originalPhase;
        console.log(`  Phase restored to '${originalPhase}'`);
      }

      if (needsVerificationRestore) {
        config.verification = {
          ...(config.verification || {}),
          enabled: true,
        };
        delete config.verification._originalEnabled;
        console.log('  Verification re-enabled');
      }

      updatedMedia[qvoteMediaIndex] = {
        ...updatedMedia[qvoteMediaIndex],
        qvoteConfig: config,
      };
      await db.collection('codes').doc(codeId).update({ media: updatedMedia });
    }
  }

  console.log(`\nCleanup complete!`);
  console.log(`  Votes deleted: ${votesDeleted}`);
  console.log(`  Candidates reset: ${candidatesSnapshot.size}`);
  console.log(`  Test voters deleted: ${votersDeleted}`);
  console.log(`  Session ready for use`);

  process.exit(0);
}

cleanup().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
