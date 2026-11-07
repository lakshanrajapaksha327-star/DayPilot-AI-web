// DayPilot AI — Unified Progressive Web App & Firebase Cloud Messaging Service Worker
// Handles App Shell Precaching, Static Asset Caching, Offline Navigation Fallback,
// Safe Cache Invalidation, and FCM Background Push Notifications in a Single Scope.

/* eslint-disable no-undef */

const CACHE_VERSION = 'daypilot-v1.5.0';
const SHELL_CACHE = `daypilot-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `daypilot-runtime-${CACHE_VERSION}`;

// Core application shell resources required for offline operation
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/favicon.png',
];

// Domains and URL paths that MUST NEVER be stored in public caches
const SENSITIVE_PATTERNS = [
  /\/api\//,
  /identitytoolkit\.googleapis\.com/,
  /securetoken\.googleapis\.com/,
  /firestore\.googleapis\.com/,
  /generativelanguage\.googleapis\.com/,
  /firebaseinstallations\.googleapis\.com/,
  /fcmregistrations\.googleapis\.com/,
];

function isSensitive(url) {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(url));
}

// 1. Install: Precache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => {
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW]: App shell precache notice:', err);
        return self.skipWaiting();
      })
  );
});

// 2. Activate: Clean up obsolete caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => {
              console.log('[SW]: Purging outdated cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Fetch: Offline application shell & runtime asset caching
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle HTTP/HTTPS GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = request.url;

  // STRICT SECURITY: Never intercept or cache sensitive backend/API/auth requests
  if (isSensitive(url)) {
    return;
  }

  // A. Navigation requests: Network-First with cached App Shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(SHELL_CACHE).then((cache) => {
              cache.put('/index.html', responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline fallback: serve cached application shell
          const cachedShell = await caches.match('/index.html');
          if (cachedShell) {
            return cachedShell;
          }
          return caches.match('/');
        })
    );
    return;
  }

  // B. Static Assets (Scripts, Styles, Images, Fonts): Stale-While-Revalidate
  const isStaticAsset =
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.endsWith('.js') ||
    url.endsWith('.css') ||
    url.endsWith('.png') ||
    url.endsWith('.svg') ||
    url.endsWith('.ico') ||
    url.endsWith('.woff2');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Network failed, nothing to update
          });

        return cachedResponse || fetchPromise;
      })
    );
  }
});

// 4. Firebase Cloud Messaging: Background Web Push handler
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const notification = data.notification || {};
  const payloadData = data.data || {};

  const title = notification.title || payloadData.title || 'DayPilot AI — Study Reminder';
  const body =
    notification.body ||
    payloadData.body ||
    payloadData.message ||
    'Your scheduled study session is starting now.';
  const icon = notification.icon || payloadData.icon || '/icons/icon-192.png';
  const badge = notification.badge || '/favicon.png';

  const options = {
    body,
    icon,
    badge,
    data: {
      url: payloadData.url || '/',
      taskId: payloadData.taskId,
      planId: payloadData.planId,
      timestamp: Date.now(),
    },
    tag: payloadData.taskId ? `task-reminder-${payloadData.taskId}` : `reminder-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Open Task' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 5. Notification Click handler: Navigate to task or focus active window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// 6. Message handler (Skip waiting & cache version queries)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ version: CACHE_VERSION });
    }
  }
});
