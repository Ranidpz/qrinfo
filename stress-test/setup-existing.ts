/**
 * Setup script for testing an EXISTING voting session
 *
 * Fetches the real candidates from an existing code (by shortId)
 * and sets the voting phase to 'voting' so k6 can submit votes.
 *
 * Required env vars:
 * - FIREBASE_SERVICE_ACCOUNT_KEY
 * - NEXT_PUBLIC_FIREBASE_PROJECT_ID
 * - SHORT_ID (the shortId from the voting URL, e.g. 'qaEe3V')
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function setup() {
  const shortId = process.env.SHORT_ID;
  if (!shortId) {
    console.error('SHORT_ID environment variable is required');
    process.exit(1);
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccount) {
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY not set');
    process.exit(1);
  }

  console.log(`Fetching voting session: ${shortId}`);

  const parsedSA = JSON.parse(serviceAccount);
  const app = initializeApp({
    credential: cert(parsedSA),
    projectId: parsedSA.project_id,
  }, 'setup-existing');

  const db = getFirestore(app);

  // Step 1: Find the code by shortId
  const codesSnapshot = await db.collection('codes')
    .where('shortId', '==', shortId)
    .limit(1)
    .get();

  if (codesSnapshot.empty) {
    console.error(`No code found with shortId: ${shortId}`);
    process.exit(1);
  }

  const codeDoc = codesSnapshot.docs[0];
  const codeId = codeDoc.id;
  const codeData = codeDoc.data();
  console.log(`Found code: ${codeId} (${codeData.name || 'unnamed'})`);

  // Step 2: Ensure voting phase is 'voting'
  const media = codeData.media || [];
  const qvoteMediaIndex = media.findIndex((m: { type: string }) => m.type === 'qvote');

  if (qvoteMediaIndex === -1) {
    console.error('This code does not have a Q.Vote configuration');
    process.exit(1);
  }

  const qvoteConfig = media[qvoteMediaIndex].qvoteConfig || {};
  const currentPhase = qvoteConfig.currentPhase;

  if (currentPhase !== 'voting' && currentPhase !== 'finals') {
    console.log(`Current phase is '${currentPhase}', temporarily setting to 'voting' for test...`);
    const updatedMedia = [...media];
    updatedMedia[qvoteMediaIndex] = {
      ...updatedMedia[qvoteMediaIndex],
      qvoteConfig: {
        ...qvoteConfig,
        currentPhase: 'voting',
        _originalPhase: currentPhase, // Save original to restore later
      },
    };
    await db.collection('codes').doc(codeId).update({ media: updatedMedia });
    console.log('Phase set to voting');
  } else {
    console.log(`Phase is already '${currentPhase}' - good`);
  }

  // Step 3: Get approved candidates
  const candidatesSnapshot = await db.collection('codes').doc(codeId)
    .collection('candidates')
    .where('isApproved', '==', true)
    .get();

  const candidateIds = candidatesSnapshot.docs.map(doc => doc.id);
  console.log(`Found ${candidateIds.length} approved candidates`);

  if (candidateIds.length === 0) {
    console.error('No approved candidates found! Approve some candidates first.');
    process.exit(1);
  }

  // Step 4: Write output files
  const resultsDir = join(__dirname, 'results');
  mkdirSync(resultsDir, { recursive: true });

  writeFileSync(join(resultsDir, 'code-id.txt'), codeId);
  writeFileSync(join(resultsDir, 'candidate-ids.json'), JSON.stringify(candidateIds));
  writeFileSync(join(resultsDir, 'original-phase.txt'), currentPhase || 'voting');
  writeFileSync(
    join(resultsDir, 'test-config.json'),
    JSON.stringify({
      codeId,
      shortId,
      candidateIds,
      numCandidates: candidateIds.length,
      originalPhase: currentPhase,
      createdAt: new Date().toISOString(),
    }, null, 2)
  );

  console.log(`\nSetup complete!`);
  console.log(`Code ID: ${codeId}`);
  console.log(`Short ID: ${shortId}`);
  console.log(`Candidates: ${candidateIds.length}`);

  process.exit(0);
}

setup().catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});
