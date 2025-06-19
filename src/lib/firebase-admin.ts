// src/lib/firebase-admin.ts

import { getApps, initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let firestoreAdmin: Firestore | null = null;
let storageAdmin: Storage | null = null;

try {
  // Initialize the Firebase Admin SDK
  if (getApps().length === 0) {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!serviceAccountPath) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set');
    }

    initializeApp({
      credential: cert(serviceAccountPath),
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
