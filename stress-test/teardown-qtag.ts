/**
 * Q.Tag Stress Test Teardown Script
 *
 * Cleans up all Q.Tag test data from Firebase after stress testing.
 * Run with: npx tsx stress-test/teardown-qtag.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const STRESS_TEST_CODE_ID = 'stressTestQtag';

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

async function deleteByQuery(
  db: FirebaseFirestore.Firestore,
  collectionPath: string,
  field: string,
  value: string,
  batchSize = 400
) {
  let deleted = 0;

  while (true) {
    const snapshot = await db.collection(collectionPath)
      .where(field, '==', value)
      .limit(batchSize)
      .get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;
    console.log(`  🗑️  Deleted ${deleted} documents from ${collectionPath}`);
  }

  return deleted;
}

async function teardown() {
  console.log('🧹 Cleaning up Q.Tag stress test data...\n');

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccount) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY not set');
    process.exit(1);
  }

  const parsedSA = JSON.parse(serviceAccount);
  const app = initializeApp({
    credential: cert(parsedSA),
    projectId: parsedSA.project_id,
  }, 'stress-test-qtag-teardown');

  const db = getFirestore(app);

  // Delete guests subcollection
  console.log('👥 Deleting Q.Tag guests...');
  await deleteCollection(db, `codes/${STRESS_TEST_CODE_ID}/qtagGuests`);

  // Delete stats subcollection
  console.log('\n📊 Deleting Q.Tag stats...');
  await deleteCollection(db, `codes/${STRESS_TEST_CODE_ID}/qtagStats`);

  // Delete token mappings (query-based, safe for production)
  console.log('\n🔑 Deleting QR token mappings...');
  await deleteByQuery(db, 'qrTokenMappings', 'codeId', STRESS_TEST_CODE_ID);

  // Delete verification codes if any
  console.log('\n📱 Deleting verification codes...');
  await deleteByQuery(db, 'verificationCodes', 'codeId', STRESS_TEST_CODE_ID);

  // Delete the test code document
  console.log('\n📝 Deleting test code document...');
  await db.collection('codes').doc(STRESS_TEST_CODE_ID).delete();
  console.log('  ✅ Code document deleted');

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  ✅ All Q.Tag stress test data cleaned up!');
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(0);
}

teardown().catch((error) => {
  console.error('❌ Teardown failed:', error);
  process.exit(1);
});
