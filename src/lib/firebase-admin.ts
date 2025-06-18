// src/lib/firebase-admin.ts
'use server';

import * as admin from 'firebase-admin';

let firestoreAdmin: admin.firestore.Firestore | null = null;
let firebaseAdminInitialized = false;

function initializeFirebaseAdmin() {
  if (firebaseAdminInitialized) {
    return;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Check if the path to credentials might be relative and needs resolving
    // For Firebase App Hosting, GOOGLE_APPLICATION_CREDENTIALS might be set directly
    // to the content of the key or a system path. Usually, just providing the filename
    // (if in root) or a relative path for local dev is fine.
    // The SDK handles finding the file based on this env var.

    if (admin.apps.length === 0) {
      try {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          // You can also explicitly set projectId if needed, though applicationDefault usually infers it.
          // projectId: process.env.FIREBASE_PROJECT_ID, 
        });
        firestoreAdmin = admin.firestore();
        firebaseAdminInitialized = true;
        console.log('Firebase Admin SDK initialized successfully.');
      } catch (error) {
        console.error('Firebase Admin SDK initialization failed:', error);
        // Log the error but don't throw, so the app can still run if other parts don't depend on it.
        // The flow using this will handle the null firestoreAdmin case.
      }
    } else {
      // App already initialized
      firestoreAdmin = admin.firestore();
      firebaseAdminInitialized = true;
    }
  } else {
    console.warn(
      'WARNING: GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. ' +
      'Firebase Admin SDK (for Firestore) will not be initialized. ' +
      'Feedback submission will not be saved to Firestore. ' +
      'Please refer to the setup instructions in the .env file or README.'
    );
  }
}

// Initialize on module load
initializeFirebaseAdmin();

export { firestoreAdmin };
