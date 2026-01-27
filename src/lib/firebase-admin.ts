import { initializeApp, getApps, cert, App, getApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getDatabase, Database } from 'firebase-admin/database';

const ADMIN_APP_NAME = 'firebase-admin';

let adminApp: App;
let adminDb: Firestore;
let adminRtdb: Database;

function getAdminApp(): App {
  if (adminApp) {
    return adminApp;
  }

  // Check if admin app already exists
  const apps = getApps();
  const existingAdminApp = apps.find(app => app.name === ADMIN_APP_NAME);
  if (existingAdminApp) {
    adminApp = existingAdminApp;
    return adminApp;
  }

  // Check for service account credentials
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
    `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`;

  if (serviceAccount) {
    try {
      const parsedServiceAccount = JSON.parse(serviceAccount);
      adminApp = initializeApp({
        credential: cert(parsedServiceAccount),
        projectId: parsedServiceAccount.project_id,
        databaseURL,
      }, ADMIN_APP_NAME);
    } catch (error) {
      console.error('Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:', error);
      // Fallback to default credentials (works in Google Cloud environments)
      adminApp = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        databaseURL,
      }, ADMIN_APP_NAME);
    }
  } else {
    // Use default credentials or project ID only
    // This works if running in Google Cloud or with Application Default Credentials
    adminApp = initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      databaseURL,
    }, ADMIN_APP_NAME);
  }

  return adminApp;
}

export function getAdminDb(): Firestore {
  if (adminDb) {
    return adminDb;
  }

  const app = getAdminApp();
  adminDb = getFirestore(app);
  return adminDb;
}

export function getAdminRtdb(): Database {
  if (adminRtdb) {
    return adminRtdb;
  }

  const app = getAdminApp();
  adminRtdb = getDatabase(app);
  return adminRtdb;
}
