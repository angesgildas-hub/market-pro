import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const config = firebaseConfig;
const app = initializeApp(firebaseConfig);

// Use standard getFirestore initialization to avoid assertion crashes related to
// multi-tab IndexedDB storage lock collision in sandboxed preview environments.
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth();

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
