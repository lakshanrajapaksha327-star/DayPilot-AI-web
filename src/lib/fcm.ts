/**
 * DayPilot AI - Firebase Cloud Messaging Client & Device Registration
 * Cross-device FCM Web Push setup, VAPID key exchange, service worker registration,
 * and user device token management.
 */

import { getMessaging, getToken, deleteToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from './firebase.ts';
import { DeviceRecord } from '../types/index.ts';
import { detectBrowserAndPlatform } from '../utils/reminderEngine.ts';

const DEVICE_ID_STORAGE_KEY = 'daypilot_device_id';

/**
 * Check if the current browser environment supports Push Notifications
 */
export function isWebPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current browser notification permission state
 */
export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Request notification permission from the user with clear rationale
 */
export async function requestNotificationPermission(): Promise<{
  granted: boolean;
  permission: NotificationPermission;
  error?: string;
}> {
  if (!isWebPushSupported()) {
    return {
      granted: false,
      permission: 'denied',
      error: 'Web Push Notifications are not supported in this browser.',
    };
  }

  const currentPermission = Notification.permission;

  if (currentPermission === 'denied') {
    return {
      granted: false,
      permission: 'denied',
      error:
        'Notifications are blocked in your browser settings. To enable reminders, click the padlock/settings icon in your browser address bar, set Notifications to "Allow", and reload the page.',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    return {
      granted: permission === 'granted',
      permission,
    };
  } catch (err) {
    console.error('Failed to request notification permission:', err);
    return {
      granted: false,
      permission: 'denied',
      error: 'An error occurred while requesting notification permission.',
    };
  }
}

/**
 * Get existing persistent device ID or generate a unique ID for this browser
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server-device';
  let deviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (!deviceId) {
    deviceId = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Register Service Worker for FCM Web Push
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    return registration;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

/**
 * Retrieve FCM Web Push token from Firebase
 */
export async function getFCMToken(vapidKey?: string): Promise<string | null> {
  const supported = await isSupported();
  if (!supported) {
    console.warn('Firebase Messaging is not supported in this browser environment.');
    return null;
  }

  try {
    const messaging = getMessaging(app);
    const swRegistration = await registerServiceWorker();

    const options: { vapidKey?: string; serviceWorkerRegistration?: ServiceWorkerRegistration } = {};
    if (vapidKey) options.vapidKey = vapidKey;
    if (swRegistration) options.serviceWorkerRegistration = swRegistration;

    const token = await getToken(messaging, options);
    return token || null;
  } catch (err) {
    console.warn('Could not retrieve FCM token:', err);
    return null;
  }
}

/**
 * Register device record under authenticated user in Firestore and backend
 */
export async function registerDevice(
  userId: string,
  token: string
): Promise<DeviceRecord> {
  const deviceId = getOrCreateDeviceId();
  const { browser, platform, deviceName } = detectBrowserAndPlatform(navigator.userAgent);

  const deviceRecord: DeviceRecord = {
    id: deviceId,
    userId,
    fcmToken: token,
    browser,
    platform,
    deviceName,
    enabled: true,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };

  // 1. Save to user's isolated subcollection in Firestore
  try {
    const deviceRef = doc(db, 'users', userId, 'devices', deviceId);
    await setDoc(deviceRef, {
      ...deviceRecord,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to save device to Firestore, registering via backend API:', err);
  }

  // 2. Sync with backend API
  try {
    await fetch('/api/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deviceRecord),
    });
  } catch (err) {
    console.warn('Failed to sync device with backend:', err);
  }

  return deviceRecord;
}

/**
 * Unregister device token
 */
export async function unregisterDevice(userId: string, deviceId: string): Promise<void> {
  try {
    // Delete from Firestore
    const deviceRef = doc(db, 'users', userId, 'devices', deviceId);
    await deleteDoc(deviceRef);
  } catch (err) {
    console.warn('Failed to delete device from Firestore:', err);
  }

  // Delete from backend
  try {
    await fetch(`/api/devices/${deviceId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
  } catch (err) {
    console.warn('Failed to delete device from backend:', err);
  }

  // Delete FCM token if this is current device
  if (deviceId === getOrCreateDeviceId()) {
    try {
      const supported = await isSupported();
      if (supported) {
        const messaging = getMessaging(app);
        await deleteToken(messaging);
      }
    } catch (err) {
      console.warn('Failed to delete FCM token from browser:', err);
    }
  }
}

/**
 * Listen for foreground push messages when app is actively open
 */
export function setupForegroundMessageListener(
  onNotificationReceived: (payload: { title: string; body: string; data?: Record<string, unknown> }) => void
): () => void {
  let unsubscribe: (() => void) | null = null;

  isSupported().then((supported) => {
    if (!supported) return;
    try {
      const messaging = getMessaging(app);
      unsubscribe = onMessage(messaging, (payload) => {
        const title = payload.notification?.title || payload.data?.title || 'DayPilot AI Reminder';
        const body = payload.notification?.body || payload.data?.body || payload.data?.message || 'Study session alert';
        onNotificationReceived({ title, body, data: payload.data });
      });
    } catch (err) {
      console.warn('Foreground messaging listener initialization skipped:', err);
    }
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
}
