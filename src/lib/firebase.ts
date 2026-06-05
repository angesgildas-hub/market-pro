import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, enableMultiTabIndexedDbPersistence, enableIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const config = firebaseConfig;
const app = initializeApp(firebaseConfig);

// Initialize Firestore with experimentalForceLongPolling to ensure robust connection 
// even in sandboxed host environments and restricted iframe web proxies.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth();

// Enable offline persistence
enableMultiTabIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore multi-tab persistence failed (multiple tabs open), falling back...');
    } else {
      console.warn('Firestore multi-tab persistence failed:', err.code);
      // Try single-tab persistence fallback
      enableIndexedDbPersistence(db).catch((singleErr) => {
        console.error('Firestore single-tab persistence also failed:', singleErr.code);
      });
    }
  });

// Validate Connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
