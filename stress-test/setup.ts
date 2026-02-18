/**
 * Stress Test Setup Script
 *
 * Creates test data in Firebase for k6 stress testing.
 * Run with: npx tsx stress-test/setup.ts
 *
 * Prerequisites:
 * - FIREBASE_SERVICE_ACCOUNT_KEY env variable set
 * - NEXT_PUBLIC_FIREBASE_PROJECT_ID env variable set
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Configurable via environment variables for large-scale tests
const NUM_CANDIDATES = parseInt(process.env.NUM_CANDIDATES || '100', 10);
const NUM_VERIFIED_VOTERS = parseInt(process.env.NUM_VOTERS || '2000', 10);
const STRESS_TEST_CODE_ID = 'stress-test-code';
const STRESS_TEST_SHORT_ID = 'stress-test';

console.log(`Config: ${NUM_CANDIDATES} candidates, ${NUM_VERIFIED_VOTERS} voters\n`);

async function setup() {
  console.log('🔧 Setting up stress test data...\n');

  // Initialize Firebase Admin
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccount) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY not set. Check .env.local');
    process.exit(1);
  }

  const parsedSA = JSON.parse(serviceAccount);
  const app = initializeApp({
    credential: cert(parsedSA),
    projectId: parsedSA.project_id,
  }, 'stress-test-setup');

  const db = getFirestore(app);

  // Step 1: Create test code document
  console.log('📝 Creating test code document...');
  const codeRef = db.collection('codes').doc(STRESS_TEST_CODE_ID);
  await codeRef.set({
    id: STRESS_TEST_CODE_ID,
    shortId: STRESS_TEST_SHORT_ID,
    ownerId: 'stress-test-owner',
    name: 'Stress Test Event',
    type: 'qvote',
    isActive: true,
    media: [{
      id: 'stress-test-media',
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
        verification: {
          enabled: false,
        },
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
  console.log(`  ✅ Code created: ${STRESS_TEST_CODE_ID}`);

  // Step 2: Create candidates (batched, supports up to 200+)
  console.log(`\n📸 Creating ${NUM_CANDIDATES} test candidates...`);
  const candidateIds: string[] = [];
  const CANDIDATE_BATCH_SIZE = 400;

  for (let batchStart = 0; batchStart < NUM_CANDIDATES; batchStart += CANDIDATE_BATCH_SIZE) {
    const batch = db.batch();
    const batchEnd = Math.min(batchStart + CANDIDATE_BATCH_SIZE, NUM_CANDIDATES);

    for (let i = batchStart; i < batchEnd; i++) {
      const candidateId = `stress-candidate-${i + 1}`;
      candidateIds.push(candidateId);

      const ref = db.collection('codes').doc(STRESS_TEST_CODE_ID)
        .collection('candidates').doc(candidateId);

      batch.set(ref, {
        id: candidateId,
        codeId: STRESS_TEST_CODE_ID,
        name: `Test Candidate ${i + 1}`,
        isApproved: true,
        isFinalist: false,
        isHidden: false,
        voteCount: 0,
        finalsVoteCount: 0,
        displayOrder: i,
        photos: [{
          id: `photo-${i + 1}`,
          url: `https://picsum.photos/seed/${i + 1}/400/600`,
          thumbnailUrl: `https://picsum.photos/seed/${i + 1}/200/300`,
          order: 0,
          uploadedAt: new Date(),
        }],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    console.log(`  ✅ Created ${batchEnd}/${NUM_CANDIDATES} candidates`);
  }

  // Step 3: Create verified voters (for scenario 3)
  console.log(`\n📱 Creating ${NUM_VERIFIED_VOTERS} verified voters...`);
  const verifiedVoters: { phone: string; sessionToken: string; voterId: string }[] = [];

  const BATCH_SIZE = 400;
  for (let batchStart = 0; batchStart < NUM_VERIFIED_VOTERS; batchStart += BATCH_SIZE) {
    const batch = db.batch();
    const batchEnd = Math.min(batchStart + BATCH_SIZE, NUM_VERIFIED_VOTERS);

    for (let i = batchStart; i < batchEnd; i++) {
      const phone = `+97250${String(i).padStart(7, '0')}`;
      const normalizedPhone = phone.replace(/\D/g, '');
      const sessionToken = randomUUID();
      const voterId = `voter-${randomUUID()}`;

      const verifiedVoterId = `${STRESS_TEST_CODE_ID}_${normalizedPhone}`;
      const ref = db.collection('verifiedVoters').doc(verifiedVoterId);

      batch.set(ref, {
        id: verifiedVoterId,
        codeId: STRESS_TEST_CODE_ID,
        phone: phone,
        votesUsed: 0,
        maxVotes: 1,
        sessionToken: sessionToken,
        sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        lastVerifiedAt: new Date(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      verifiedVoters.push({ phone, sessionToken, voterId });
    }

    await batch.commit();
    console.log(`  ✅ Created ${batchEnd}/${NUM_VERIFIED_VOTERS} verified voters`);
  }

  // Step 4: Create stats document
  console.log('\n📊 Creating stats document...');
  await db.collection('codes').doc(STRESS_TEST_CODE_ID)
    .collection('qvoteStats').doc('current').set({
      totalVotes: 0,
      totalVoters: 0,
      lastUpdated: FieldValue.serverTimestamp(),
    });
  console.log('  ✅ Stats document created');

  // Step 5: Save test data for k6
  const outputDir = join(__dirname, 'results');

  const testConfig = {
    codeId: STRESS_TEST_CODE_ID,
    shortId: STRESS_TEST_SHORT_ID,
    candidateIds: candidateIds,
    numCandidates: NUM_CANDIDATES,
    numVerifiedVoters: NUM_VERIFIED_VOTERS,
    createdAt: new Date().toISOString(),
  };

  writeFileSync(
    join(outputDir, 'test-config.json'),
    JSON.stringify(testConfig, null, 2)
  );

  writeFileSync(
    join(outputDir, 'verified-voters.json'),
    JSON.stringify(verifiedVoters)
  );

  console.log('\n📁 Output files:');
  console.log(`  test-config.json  - Code ID, candidate IDs, config`);
  console.log(`  verified-voters.json - Pre-created verified voters\n`);

  // Print k6 run commands
  console.log('═══════════════════════════════════════════════════');
  console.log('  🚀 Ready to run stress tests!');
  console.log('═══════════════════════════════════════════════════\n');

  const candidateIdsJson = JSON.stringify(candidateIds);

  console.log('1️⃣  Page Load Test:');
  console.log(`k6 run --env BASE_URL=https://qr.playzones.app --env SHORT_ID=${STRESS_TEST_SHORT_ID} stress-test/scenarios/01-load-page.js\n`);

  console.log('2️⃣  Anonymous Vote Storm:');
  console.log(`k6 run --env BASE_URL=https://qr.playzones.app --env CODE_ID=${STRESS_TEST_CODE_ID} --env CANDIDATE_IDS='${candidateIdsJson}' stress-test/scenarios/02-vote-storm.js\n`);

  console.log('3️⃣  Verified Vote Storm:');
  console.log(`k6 run --env BASE_URL=https://qr.playzones.app --env CODE_ID=${STRESS_TEST_CODE_ID} --env CANDIDATE_IDS='${candidateIdsJson}' --env VERIFIED_VOTERS="$(cat stress-test/results/verified-voters.json)" stress-test/scenarios/03-verified-vote-storm.js\n`);

  console.log('4️⃣  Sustained Load (15 min):');
  console.log(`k6 run --env BASE_URL=https://qr.playzones.app --env CODE_ID=${STRESS_TEST_CODE_ID} --env CANDIDATE_IDS='${candidateIdsJson}' stress-test/scenarios/04-sustained-load.js\n`);

  console.log('5️⃣  Spike Test (WhatsApp Blast):');
  console.log(`k6 run --env BASE_URL=https://qr.playzones.app --env SHORT_ID=${STRESS_TEST_SHORT_ID} --env CODE_ID=${STRESS_TEST_CODE_ID} --env CANDIDATE_IDS='${candidateIdsJson}' stress-test/scenarios/05-spike-test.js\n`);

  console.log('9️⃣  Production Event (10K voters, 30 min compressed):');
  console.log(`k6 run --env BASE_URL=https://qr.playzones.app --env SHORT_ID=${STRESS_TEST_SHORT_ID} --env CODE_ID=${STRESS_TEST_CODE_ID} --env CANDIDATE_IDS='${candidateIdsJson}' stress-test/scenarios/09-production-event.js\n`);

  console.log('    Full 2.5 hour simulation: add --env FULL=1\n');

  console.log('───────────────────────────────────────────────────');
  console.log('💡 After tests, run: npx tsx stress-test/teardown.ts');
  console.log('───────────────────────────────────────────────────\n');

  process.exit(0);
}

setup().catch((error) => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});
