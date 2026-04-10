import { initializeApp, getApps } from "firebase/app";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Singleton — no re-initialize if already created
const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

/**
 * Returns the Firebase Messaging instance, or null if:
 * - Running on the server (SSR)
 * - Browser doesn't support notifications/service-workers
 * - Firebase env vars are not configured
 */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  if (!firebaseConfig.apiKey || !firebaseConfig.messagingSenderId) return null;

  try {
    const supported = await isSupported();
    if (!supported) return null;
    return getMessaging(app);
  } catch {
    return null;
  }
}

export { app };
