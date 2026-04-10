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
 * Wait for a ServiceWorkerRegistration to reach the "activated" state.
 * Resolves immediately if it's already active, otherwise listens for
 * statechange events on the installing/waiting worker.
 */
function waitForSwActive(reg: ServiceWorkerRegistration): Promise<void> {
  if (reg.active) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const sw = reg.installing ?? reg.waiting;
    if (!sw) {
      navigator.serviceWorker.ready.then(() => resolve());
      return;
    }
    sw.addEventListener("statechange", () => {
      if (sw.state === "activated") resolve();
    });
  });
}

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
  if (!messaging) return "granted";

  try {
    // ── 1. Unregister any stale FCM service worker ──
    const existingRegs = await navigator.serviceWorker.getRegistrations();
    for (const reg of existingRegs) {
      if (reg.active?.scriptURL.includes("firebase-messaging-sw")) {
        await reg.unregister();
      }
    }

    // ── 2. Register the SW fresh ──
    const swRegistration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      { updateViaCache: "none" }
    );

    // ── 3. Wait until the SW reaches "activated" state ──
    await waitForSwActive(swRegistration);

    // ── 4. Clear any stale push subscription ──
    try {
      const existingSub =
        await swRegistration.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }
    } catch {
      /* ignore — subscription might not exist */
    }

    // ── 5. Get FCM token ──
    const currentToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (currentToken) {
      // Only POST to backend if token changed
      const storedToken = getStoredToken();
      if (currentToken !== storedToken) {
        await registerFcmToken(currentToken);
        setStoredToken(currentToken);
      }
    }
  } catch (err) {
    // Some browsers (Brave, privacy-focused) block the push service.
    // This is expected — notifications will fall back to polling.
    if (
      err instanceof Error &&
      err.message.includes("push service")
    ) {
      console.info(
        "[FCM] Push service blocked by browser — falling back to polling."
      );
    } else {
      console.warn("[FCM] Error obtaining token:", err);
    }
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
