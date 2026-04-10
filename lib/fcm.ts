import { getToken, onMessage, type MessagePayload } from "firebase/messaging";
import { getFirebaseMessaging } from "./firebase";
import { registerFcmToken } from "./api";

// ── Constants ────────────────────────────────────────────────
const FCM_TOKEN_KEY = "kia_fcm_token";
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

// ── Helpers ──────────────────────────────────────────────────
function getStoredToken(): string | null {
  try {
    return localStorage.getItem(FCM_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string): void {
  try {
    localStorage.setItem(FCM_TOKEN_KEY, token);
  } catch {
    /* quota exceeded or private mode */
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(FCM_TOKEN_KEY);
  } catch {
    /* noop */
  }
}

// ── Request Permission & Register Token ──────────────────────
/**
 * 1. Checks browser support
 * 2. Requests notification permission if not yet decided
 * 3. Gets FCM token from Firebase
 * 4. Registers token with backend (skips if already registered)
 *
 * Returns the current permission state.
 */
export async function requestPermissionAndRegister(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }

  // If already denied, don't insist
  if (Notification.permission === "denied") {
    return "denied";
  }

  // Ask for permission if not yet granted
  let permission: NotificationPermission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return permission;
  }

  // Get Firebase Messaging instance
  const messaging = await getFirebaseMessaging();
  if (!messaging) return "granted"; // permission granted but messaging not supported

  try {
    // Register the service worker explicitly so FCM uses our custom SW
    const swRegistration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    const currentToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!currentToken) return "granted";

    // Only POST to backend if token changed
    const storedToken = getStoredToken();
    if (currentToken !== storedToken) {
      await registerFcmToken(currentToken);
      setStoredToken(currentToken);
    }
  } catch (err) {
    console.warn("[FCM] Error obtaining token:", err);
  }

  return "granted";
}

// ── Foreground Message Handler ───────────────────────────────
/**
 * Sets up a listener for messages that arrive while the tab is in focus.
 * Returns an unsubscribe function.
 */
export function setupForegroundHandler(
  callback: (payload: MessagePayload) => void
): () => void {
  let unsubscribe: (() => void) | null = null;

  getFirebaseMessaging().then((messaging) => {
    if (!messaging) return;
    unsubscribe = onMessage(messaging, callback);
  });

  return () => {
    unsubscribe?.();
  };
}
