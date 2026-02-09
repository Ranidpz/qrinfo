/**
 * Stress Test Teardown Script
 *
 * Cleans up all test data from Firebase after stress testing.
 * Run with: npx tsx stress-test/teardown.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const STRESS_TEST_CODE_ID = 'stress-test-code';

async function deleteCollection(db: FirebaseFirestore.Firestore, path: string, batchSize = 400) {
  const collectionRef = db.collection(path);
  let deleted = 0;

  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;
    console.log(`  🗑️  Deleted ${deleted} documents from ${path}`);
  }

  return deleted;
}

async function teardown() {
  console.log('🧹 Cleaning up stress test data...\n');

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccount) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY not set');
    process.exit(1);
  }

  const parsedSA = JSON.parse(serviceAccount);
  const app = initializeApp({
    credential: cert(parsedSA),
    projectId: parsedSA.project_id,
  }, 'stress-test-teardown');

  const db = getFirestore(app);

  // Delete subcollections
  console.log('📋 Deleting votes...');
  await deleteCollection(db, `codes/${STRESS_TEST_CODE_ID}/votes`);

  console.log('\n📸 Deleting candidates...');
  await deleteCollection(db, `codes/${STRESS_TEST_CODE_ID}/candidates`);

  console.log('\n📊 Deleting stats...');
  await deleteCollection(db, `codes/${STRESS_TEST_CODE_ID}/qvoteStats`);

  // Delete verified voters for this test
  console.log('\n📱 Deleting verified voters...');
  const votersRef = db.collection('verifiedVoters');
  let votersDeleted = 0;

  while (true) {
    const snapshot = await votersRef
      .where('codeId', '==', STRESS_TEST_CODE_ID)
      .limit(400)
      .get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    votersDeleted += snapshot.size;
    console.log(`  🗑️  Deleted ${votersDeleted} verified voters`);
  }

  // Delete rate limit entries for this test
  console.log('\n⏱️  Deleting rate limits...');
  const rateLimitsRef = db.collection('rateLimits');
  let rateLimitsDeleted = 0;

  while (true) {
    const snapshot = await rateLimitsRef.limit(400).get();
    // Only delete entries containing our test code ID or 'stress'
    const testDocs = snapshot.docs.filter(doc =>
      doc.id.includes(STRESS_TEST_CODE_ID) || doc.id.includes('stress')
    );
    if (testDocs.length === 0) break;

    const batch = db.batch();
    testDocs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    rateLimitsDeleted += testDocs.length;
    console.log(`  🗑️  Deleted ${rateLimitsDeleted} rate limit entries`);

    if (snapshot.size < 400) break; // No more documents
  }

  // Delete the test code document
  console.log('\n📝 Deleting test code document...');
  await db.collection('codes').doc(STRESS_TEST_CODE_ID).delete();
  console.log('  ✅ Code document deleted');

  // Delete health check pings
  try {
    await db.collection('_health').doc('ping').delete();
  } catch { /* ignore */ }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  ✅ All stress test data cleaned up!');
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(0);
}

teardown().catch((error) => {
  console.error('❌ Teardown failed:', error);
  process.exit(1);
});
