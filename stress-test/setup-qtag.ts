/**
 * Q.Tag Stress Test Setup Script
 *
 * Creates a test Q.Tag event with 600 pre-registered guests for load testing.
 * Run with: npx tsx stress-test/setup-qtag.ts
 *
 * Prerequisites:
 * - FIREBASE_SERVICE_ACCOUNT_KEY env variable set
 * - NEXT_PUBLIC_FIREBASE_PROJECT_ID env variable set
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const NUM_PRE_REGISTERED_GUESTS = 600;
const BATCH_SIZE = 400;
const STRESS_TEST_CODE_ID = 'stressTestQtag';
const STRESS_TEST_SHORT_ID = 'stressqtag';

function generateQRToken(): string {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

async function setup() {
  console.log('🔧 Setting up Q.Tag stress test data...\n');

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
  }, 'stress-test-qtag-setup');

  const db = getFirestore(app);

  // Step 1: Create test Q.Tag code document
  console.log('📝 Creating Q.Tag test code document...');
  const codeRef = db.collection('codes').doc(STRESS_TEST_CODE_ID);
  await codeRef.set({
    id: STRESS_TEST_CODE_ID,
    shortId: STRESS_TEST_SHORT_ID,
    ownerId: 'stress-test-qtag-owner',
    name: 'Q.Tag Stress Test Event',
    type: 'qtag',
    media: [{
      type: 'qtag',
      qtagConfig: {
        eventName: 'Stress Test Event',
        currentPhase: 'registration',
        allowPlusOne: true,
        maxGuestsPerRegistration: 2,
        requireGuestGender: false,
        maxRegistrations: 0, // Unlimited for stress testing (scenario 06 tests capacity separately)
        verification: {
          enabled: false,
          method: 'whatsapp',
          codeLength: 4,
          codeExpiryMinutes: 5,
          maxAttempts: 5,
        },
        sendQrViaWhatsApp: false,
        scannerEnabled: true,
        branding: {
          imageOverlayOpacity: 40,
          logoScale: 1.0,
          colors: {
            background: '#1a1a2e',
            text: '#ffffff',
            buttonBackground: '#3b82f6',
            buttonText: '#ffffff',
          },
        },
      },
    }],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`  ✅ Code created: ${STRESS_TEST_CODE_ID}`);

  // Step 2: Create stats document
  console.log('\n📊 Creating stats document...');
  await db.collection('codes').doc(STRESS_TEST_CODE_ID)
    .collection('qtagStats').doc('current').set({
      totalRegistered: 0,
      totalGuests: 0,
      totalArrived: 0,
      totalArrivedGuests: 0,
      lastUpdated: FieldValue.serverTimestamp(),
    });
  console.log('  ✅ Stats document created');

  // Step 3: Pre-register 600 guests with valid QR tokens
  console.log(`\n👥 Creating ${NUM_PRE_REGISTERED_GUESTS} pre-registered guests...`);
  const guestTokens: { guestId: string; qrToken: string; phone: string }[] = [];

  for (let batchStart = 0; batchStart < NUM_PRE_REGISTERED_GUESTS; batchStart += BATCH_SIZE) {
    const batch = db.batch();
    const batchEnd = Math.min(batchStart + BATCH_SIZE, NUM_PRE_REGISTERED_GUESTS);

    for (let i = batchStart; i < batchEnd; i++) {
      const phone = `+97258${String(i + 1).padStart(7, '0')}`;
      const qrToken = generateQRToken();
      const guestRef = db.collection('codes').doc(STRESS_TEST_CODE_ID)
        .collection('qtagGuests').doc();

      // Create guest document
      batch.set(guestRef, {
        id: guestRef.id,
        codeId: STRESS_TEST_CODE_ID,
        name: `Test Guest ${i + 1}`,
        phone,
        plusOneCount: i % 3 === 0 ? 1 : 0, // ~33% bring +1
        plusOneDetails: [],
        qrToken,
        isVerified: true,
        status: 'registered',
        qrSentViaWhatsApp: false,
        registeredAt: FieldValue.serverTimestamp(),
        registeredByAdmin: false,
      });

      // Create token mapping for fast check-in lookup
      const tokenRef = db.collection('qrTokenMappings').doc(qrToken);
      batch.set(tokenRef, {
        codeId: STRESS_TEST_CODE_ID,
        guestId: guestRef.id,
        type: 'qtag',
        createdAt: FieldValue.serverTimestamp(),
      });

      guestTokens.push({
        guestId: guestRef.id,
        qrToken,
        phone,
      });
    }

    await batch.commit();
    console.log(`  ✅ Created ${batchEnd}/${NUM_PRE_REGISTERED_GUESTS} guests + token mappings`);
  }

  // Step 4: Update stats to reflect pre-registered guests
  console.log('\n📊 Updating stats...');
  const totalPlusOne = guestTokens.filter((_, i) => i % 3 === 0).length;
  await db.collection('codes').doc(STRESS_TEST_CODE_ID)
    .collection('qtagStats').doc('current').update({
      totalRegistered: NUM_PRE_REGISTERED_GUESTS,
      totalGuests: NUM_PRE_REGISTERED_GUESTS + totalPlusOne,
      lastUpdated: FieldValue.serverTimestamp(),
    });
  console.log(`  ✅ Stats updated: ${NUM_PRE_REGISTERED_GUESTS} registered, ${NUM_PRE_REGISTERED_GUESTS + totalPlusOne} total guests`);

  // Step 5: Save output files
  const outputDir = join(__dirname, 'results');
  mkdirSync(outputDir, { recursive: true });

  const testConfig = {
    codeId: STRESS_TEST_CODE_ID,
    shortId: STRESS_TEST_SHORT_ID,
    numPreRegistered: NUM_PRE_REGISTERED_GUESTS,
    numGuestTokens: guestTokens.length,
    createdAt: new Date().toISOString(),
  };

  writeFileSync(
    join(outputDir, 'qtag-test-config.json'),
    JSON.stringify(testConfig, null, 2)
  );

  writeFileSync(
    join(outputDir, 'qtag-guest-tokens.json'),
    JSON.stringify(guestTokens)
  );

  console.log('\n📁 Output files:');
  console.log('  qtag-test-config.json  - Code ID, config');
  console.log(`  qtag-guest-tokens.json - ${guestTokens.length} guest tokens for scanner tests\n`);

  // Print k6 run commands
  console.log('═══════════════════════════════════════════════════');
  console.log('  🚀 Ready to run Q.Tag stress tests!');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('6️⃣  Registration Burst (600 users):');
  console.log(`k6 run --env BASE_URL=https://qr.playzones.app --env CODE_ID=${STRESS_TEST_CODE_ID} stress-test/scenarios/06-registration-burst.js\n`);

  console.log('7️⃣  Scanner Flood (5 phones, 600 guests):');
  console.log(`k6 run --env BASE_URL=https://qr.playzones.app stress-test/scenarios/07-scanner-flood.js\n`);

  console.log('8️⃣  Combined Event Day:');
  console.log(`k6 run --env BASE_URL=https://qr.playzones.app --env CODE_ID=${STRESS_TEST_CODE_ID} stress-test/scenarios/08-combined-event-day.js\n`);

  console.log('───────────────────────────────────────────────────');
  console.log('💡 After tests, run: npx tsx stress-test/teardown-qtag.ts');
  console.log('───────────────────────────────────────────────────\n');

  process.exit(0);
}

setup().catch((error) => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});
