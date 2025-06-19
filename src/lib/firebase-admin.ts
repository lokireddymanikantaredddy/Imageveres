// src/lib/firebase-admin.ts

import { getApps, initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let firestoreAdmin: Firestore | null = null;
let storageAdmin: Storage | null = null;

try {
  // Initialize the Firebase Admin SDK
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing one or more Firebase Admin environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)');
    }
    // Replace escaped newlines with actual newlines for private key
    privateKey = privateKey.replace(/\\n/g, '\n');

    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket: 'photogenius-6b87d.firebasestorage.app'
    });
  }

  // Get Firestore instance
  firestoreAdmin = getFirestore();
  // Get Storage instance
  storageAdmin = getStorage();
  console.log('[Firebase Admin] Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('[Firebase Admin] Error initializing Firebase Admin SDK:', error);
  // Keep firestoreAdmin as null - the application will handle this case
}

const STORAGE_BUCKET_NAME = 'photogenius-6b87d.firebasestorage.app';

export { firestoreAdmin, storageAdmin };
