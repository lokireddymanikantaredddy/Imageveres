
// src/lib/firebase-admin.ts

import * as admin from 'firebase-admin';

let firestoreAdmin: admin.firestore.Firestore | null = null;
let firebaseAdminInitialized = false;

function initializeFirebaseAdmin() {
  if (firebaseAdminInitialized) {
    return;
  }

  const credsEnvVar = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (credsEnvVar) {
    console.log(`[Firebase Admin] GOOGLE_APPLICATION_CREDENTIALS is set to: "${credsEnvVar}"`);

    if (admin.apps.length === 0) {
      try {
        console.log('[Firebase Admin] Initializing Firebase Admin SDK...');
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          // You can also explicitly set projectId if needed, though applicationDefault usually infers it.
          // projectId: process.env.FIREBASE_PROJECT_ID, 
        });
        firestoreAdmin = admin.firestore();
        firebaseAdminInitialized = true;
        console.log('[Firebase Admin] Firebase Admin SDK initialized successfully.');
      } catch (error) {
        console.error('[Firebase Admin] Firebase Admin SDK initialization failed. Error details:', error);
        // The flow using this will handle the null firestoreAdmin case and inform the user.
      }
    } else {
      // App already initialized
      firestoreAdmin = admin.firestore();
      firebaseAdminInitialized = true;
      console.log('[Firebase Admin] Firebase Admin SDK was already initialized.');
    }
  } else {
    console.warn(
      '[Firebase Admin] WARNING: GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. ' +
      'Firebase Admin SDK (for Firestore) will not be initialized. ' +
      'Feedback submission will not be saved to Firestore. ' +
      'Please refer to the setup instructions (e.g., in .env or README) to set this variable to the path of your service account key JSON file.'
    );
  }
}

// Initialize on module load
initializeFirebaseAdmin();

export { firestoreAdmin };
