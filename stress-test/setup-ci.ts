/**
 * CI-specific Setup Script for GitHub Actions
 * Creates test data in Firebase and outputs config for k6
 *
 * Required env vars:
 * - FIREBASE_SERVICE_ACCOUNT_KEY
 * - NEXT_PUBLIC_FIREBASE_PROJECT_ID
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const NUM_CANDIDATES = 100;
const NUM_VERIFIED_VOTERS = 500; // Less than local - CI has time limits
const STRESS_TEST_CODE_ID = `stress-test-ci-${Date.now()}`;
const STRESS_TEST_SHORT_ID = 'stress-ci';

async function setup() {
  console.log('Setting up stress test data for CI...');

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccount) {
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY not set');
    process.exit(1);
  }

  const parsedSA = JSON.parse(serviceAccount);
  const app = initializeApp({
    credential: cert(parsedSA),
    projectId: parsedSA.project_id,
  }, 'stress-test-ci-setup');

  const db = getFirestore(app);

  // Step 1: Create test code
  console.log('Creating test code...');
  await db.collection('codes').doc(STRESS_TEST_CODE_ID).set({
    id: STRESS_TEST_CODE_ID,
    shortId: STRESS_TEST_SHORT_ID,
    ownerId: 'ci-test-owner',
    name: 'CI Stress Test',
    type: 'qvote',
    isActive: true,
    media: [{
      id: 'ci-stress-test-media',
      type: 'qvote',
      createdAt: new Date(),
      qvoteConfig: {
        currentPhase: 'voting',
        maxSelectionsPerVoter: 3,
        minSelectionsPerVoter: 1,
        maxVoteChanges: 0,
        showVoteCount: false,
        showNames: true,
        enableCropping: true,
        allowSelfRegistration: true,
        enableFinals: false,
        shuffleCandidates: true,
        languageMode: 'choice',
        schedule: {},
        scheduleMode: 'manual',
        formFields: [
          { id: 'name', label: 'שם מלא', labelEn: 'Full Name', required: true, order: 0 },
        ],
        categories: [],
        gamification: { enabled: false, xpPerVote: 10, xpForPackThreshold: 50 },
        branding: {
          colors: {
            background: '#ffffff',
            text: '#1f2937',
            buttonBackground: '#3b82f6',
            buttonText: '#ffffff',
          },
        },
        messages: {},
        verification: { enabled: false },
        stats: {
          totalCandidates: NUM_CANDIDATES,
          approvedCandidates: NUM_CANDIDATES,
          totalVoters: 0,
          totalVotes: 0,
          lastUpdated: new Date(),
        },
      },
    }],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Step 2: Create candidates in batches
  console.log(`Creating ${NUM_CANDIDATES} candidates...`);
  const candidateIds: string[] = [];
  const batch = db.batch();

  for (let i = 0; i < NUM_CANDIDATES; i++) {
    const candidateId = `ci-candidate-${i + 1}`;
    candidateIds.push(candidateId);

    batch.set(
      db.collection('codes').doc(STRESS_TEST_CODE_ID).collection('candidates').doc(candidateId),
      {
        id: candidateId,
        codeId: STRESS_TEST_CODE_ID,
        name: `CI Candidate ${i + 1}`,
        isApproved: true,
        isFinalist: false,
        isHidden: false,
        voteCount: 0,
        finalsVoteCount: 0,
        displayOrder: i,
        photos: [{
          id: `photo-${i}`,
          url: `https://picsum.photos/seed/ci${i}/400/600`,
          thumbnailUrl: `https://picsum.photos/seed/ci${i}/200/300`,
          order: 0,
          uploadedAt: new Date(),
        }],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }
    );
  }
  await batch.commit();

  // Step 3: Create verified voters
  console.log(`Creating ${NUM_VERIFIED_VOTERS} verified voters...`);
  const verifiedVoters: { phone: string; sessionToken: string; voterId: string }[] = [];
  const BATCH_SIZE = 400;

  for (let batchStart = 0; batchStart < NUM_VERIFIED_VOTERS; batchStart += BATCH_SIZE) {
    const vBatch = db.batch();
    const batchEnd = Math.min(batchStart + BATCH_SIZE, NUM_VERIFIED_VOTERS);

    for (let i = batchStart; i < batchEnd; i++) {
      const phone = `+97250${String(i).padStart(7, '0')}`;
      const normalizedPhone = phone.replace(/\D/g, '');
      const sessionToken = randomUUID();
      const voterId = `voter-${randomUUID()}`;

      vBatch.set(
        db.collection('verifiedVoters').doc(`${STRESS_TEST_CODE_ID}_${normalizedPhone}`),
        {
          id: `${STRESS_TEST_CODE_ID}_${normalizedPhone}`,
          codeId: STRESS_TEST_CODE_ID,
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
  }

  // Step 4: Create stats doc
  await db.collection('codes').doc(STRESS_TEST_CODE_ID)
    .collection('qvoteStats').doc('current').set({
      totalVotes: 0,
      totalVoters: 0,
      lastUpdated: FieldValue.serverTimestamp(),
    });

  // Step 5: Write output files for k6
  const resultsDir = join(__dirname, 'results');
  mkdirSync(resultsDir, { recursive: true });

  // Candidate IDs as simple JSON array (used in GitHub Actions output)
  writeFileSync(
    join(resultsDir, 'candidate-ids.json'),
    JSON.stringify(candidateIds)
  );

  writeFileSync(
    join(resultsDir, 'test-config.json'),
    JSON.stringify({
      codeId: STRESS_TEST_CODE_ID,
      shortId: STRESS_TEST_SHORT_ID,
      candidateIds,
      numCandidates: NUM_CANDIDATES,
      numVerifiedVoters: NUM_VERIFIED_VOTERS,
      createdAt: new Date().toISOString(),
    }, null, 2)
  );

  writeFileSync(
    join(resultsDir, 'verified-voters.json'),
    JSON.stringify(verifiedVoters)
  );

  // Write code ID to a file for teardown
  writeFileSync(
    join(resultsDir, 'code-id.txt'),
    STRESS_TEST_CODE_ID
  );

  console.log(`\nSetup complete!`);
  console.log(`Code ID: ${STRESS_TEST_CODE_ID}`);
  console.log(`Candidates: ${NUM_CANDIDATES}`);
  console.log(`Verified Voters: ${NUM_VERIFIED_VOTERS}`);

  process.exit(0);
}

setup().catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});
