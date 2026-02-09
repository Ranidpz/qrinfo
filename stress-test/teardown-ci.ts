/**
 * CI-specific Teardown Script for GitHub Actions
 * Cleans up test data from Firebase
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

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
  }

  return deleted;
}

async function teardown() {
  console.log('Cleaning up CI stress test data...');

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccount) {
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY not set');
    process.exit(1);
  }

  const parsedSA = JSON.parse(serviceAccount);
  const app = initializeApp({
    credential: cert(parsedSA),
    projectId: parsedSA.project_id,
  }, 'stress-test-ci-teardown');

  const db = getFirestore(app);

  // Read the code ID from setup
  let codeId: string;
  try {
    codeId = readFileSync(join(__dirname, 'results', 'code-id.txt'), 'utf-8').trim();
  } catch {
    // Fallback: find any stress-test-ci codes
    console.log('code-id.txt not found, searching for CI test codes...');
    const snapshot = await db.collection('codes')
      .where('ownerId', '==', 'ci-test-owner')
      .get();

    if (snapshot.empty) {
      console.log('No CI test codes found. Nothing to clean up.');
      process.exit(0);
    }

    for (const doc of snapshot.docs) {
      codeId = doc.id;
      console.log(`Found CI code: ${codeId}`);
      await cleanupCode(db, codeId);
    }
    process.exit(0);
    return;
  }

  await cleanupCode(db, codeId);
  process.exit(0);
}

async function cleanupCode(db: FirebaseFirestore.Firestore, codeId: string) {
  console.log(`Cleaning up code: ${codeId}`);

  // Delete subcollections
  const votesDeleted = await deleteCollection(db, `codes/${codeId}/votes`);
  console.log(`  Deleted ${votesDeleted} votes`);

  const candidatesDeleted = await deleteCollection(db, `codes/${codeId}/candidates`);
  console.log(`  Deleted ${candidatesDeleted} candidates`);

  await deleteCollection(db, `codes/${codeId}/qvoteStats`);

  // Delete verified voters
  let votersDeleted = 0;
  while (true) {
    const snapshot = await db.collection('verifiedVoters')
      .where('codeId', '==', codeId)
      .limit(400)
      .get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    votersDeleted += snapshot.size;
  }
  console.log(`  Deleted ${votersDeleted} verified voters`);

  // Delete rate limits
  let rateLimitsDeleted = 0;
  while (true) {
    const snapshot = await db.collection('rateLimits').limit(400).get();
    const testDocs = snapshot.docs.filter(doc =>
      doc.id.includes(codeId) || doc.id.includes('stress')
    );
    if (testDocs.length === 0) break;
    const batch = db.batch();
    testDocs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    rateLimitsDeleted += testDocs.length;
    if (snapshot.size < 400) break;
  }
  console.log(`  Deleted ${rateLimitsDeleted} rate limits`);

  // Delete the code document
  await db.collection('codes').doc(codeId).delete();
  console.log(`  Deleted code document`);

  // Cleanup health check
  try { await db.collection('_health').doc('ping').delete(); } catch { /* ignore */ }

  console.log(`Cleanup complete for ${codeId}`);
}

teardown().catch((error) => {
  console.error('Teardown failed:', error);
  process.exit(1);
});
