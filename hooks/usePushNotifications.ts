"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  requestPermissionAndRegister,
  setupForegroundHandler,
} from "@/lib/fcm";
import type { MessagePayload } from "firebase/messaging";

interface PushState {
  /** Whether the browser supports push notifications */
  supported: boolean;
  /** Current notification permission: 'granted' | 'denied' | 'default' */
  permission: NotificationPermission;
}

/**
 * Hook that initializes browser push notifications after user login.
 *
 * - Requests permission & registers FCM token with the backend.
 * - Sets up a foreground message listener.
 * - Provides a way for consumers (e.g. NotificationBell) to subscribe to
 *   incoming foreground messages via `onForegroundMessage`.
 */
export function usePushNotifications(
  onMessage?: (payload: MessagePayload) => void
): PushState {
  const { user } = useAuth();
  const [state, setState] = useState<PushState>({
    supported: false,
    permission: "default",
  });
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Check browser support once
  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setState((s) => ({ ...s, supported }));
  }, []);

  // Request permission & register token after login
  useEffect(() => {
    if (!user?.uid || !state.supported) return;

    let cancelled = false;

    requestPermissionAndRegister().then((perm) => {
      if (!cancelled) {
        setState((s) => ({ ...s, permission: perm }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user?.uid, state.supported]);

  // Set up foreground message handler
  useEffect(() => {
    if (!user?.uid || !state.supported || state.permission !== "granted") return;

    const unsubscribe = setupForegroundHandler((payload) => {
      onMessageRef.current?.(payload);
    });

    return unsubscribe;
  }, [user?.uid, state.supported, state.permission]);

  return state;
}
