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
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const NUM_VERIFIED_VOTERS = 2000;

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

  // Step 3: Temporarily disable verification for anonymous testing
  const verificationEnabled = qvoteConfig.verification?.enabled === true;
  if (verificationEnabled) {
    console.log('Verification is enabled - temporarily disabling for anonymous test scenarios...');
    const updatedMedia = [...media];
    updatedMedia[qvoteMediaIndex] = {
      ...updatedMedia[qvoteMediaIndex],
      qvoteConfig: {
        ...qvoteConfig,
        currentPhase: updatedMedia[qvoteMediaIndex].qvoteConfig.currentPhase, // keep phase from step 2
        verification: {
          ...qvoteConfig.verification,
          enabled: false,
          _originalEnabled: true, // flag to restore later
        },
      },
    };
    await db.collection('codes').doc(codeId).update({ media: updatedMedia });
    console.log('Verification temporarily disabled');
  } else {
    console.log('Verification is already disabled');
  }

  // Step 4: Create pre-verified voters for scenario 03
  console.log(`Creating ${NUM_VERIFIED_VOTERS} pre-verified voters...`);
  const verifiedVoters: { phone: string; sessionToken: string; voterId: string }[] = [];
  const BATCH_SIZE = 400;

  for (let batchStart = 0; batchStart < NUM_VERIFIED_VOTERS; batchStart += BATCH_SIZE) {
    const vBatch = db.batch();
    const batchEnd = Math.min(batchStart + BATCH_SIZE, NUM_VERIFIED_VOTERS);

    for (let i = batchStart; i < batchEnd; i++) {
      const phone = `+97250${String(i).padStart(7, '0')}`;
      const normalizedPhone = phone.replace(/\D/g, '');
      const sessionToken = randomUUID();
      const voterId = `stress-voter-${randomUUID()}`;

      vBatch.set(
        db.collection('verifiedVoters').doc(`${codeId}_${normalizedPhone}`),
        {
          id: `${codeId}_${normalizedPhone}`,
          codeId,
          phone,
          votesUsed: 0,
          maxVotes: 1,
          sessionToken,
          sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          lastVerifiedAt: new Date(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }
      );

      verifiedVoters.push({ phone, sessionToken, voterId });
    }
    await vBatch.commit();
    console.log(`  Created ${Math.min(batchEnd, NUM_VERIFIED_VOTERS)}/${NUM_VERIFIED_VOTERS} voters...`);
  }

  // Step 5: Get approved candidates
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

  // Step 6: Write output files
  const resultsDir = join(__dirname, 'results');
  mkdirSync(resultsDir, { recursive: true });

  writeFileSync(join(resultsDir, 'code-id.txt'), codeId);
  writeFileSync(join(resultsDir, 'candidate-ids.json'), JSON.stringify(candidateIds));
  writeFileSync(join(resultsDir, 'original-phase.txt'), currentPhase || 'voting');
  writeFileSync(join(resultsDir, 'original-verification.txt'), verificationEnabled ? 'true' : 'false');
  writeFileSync(join(resultsDir, 'verified-voters.json'), JSON.stringify(verifiedVoters));
  writeFileSync(
    join(resultsDir, 'test-config.json'),
    JSON.stringify({
      codeId,
      shortId,
      candidateIds,
      numCandidates: candidateIds.length,
      numVerifiedVoters: NUM_VERIFIED_VOTERS,
      originalPhase: currentPhase,
      verificationWasEnabled: verificationEnabled,
      createdAt: new Date().toISOString(),
    }, null, 2)
  );

  console.log(`\nSetup complete!`);
  console.log(`Code ID: ${codeId}`);
  console.log(`Short ID: ${shortId}`);
  console.log(`Candidates: ${candidateIds.length}`);
  console.log(`Verified Voters: ${NUM_VERIFIED_VOTERS}`);
  console.log(`Verification was: ${verificationEnabled ? 'enabled (now disabled for test)' : 'disabled'}`);

  process.exit(0);
}

setup().catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});
