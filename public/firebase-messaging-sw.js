// KUETx Firebase Messaging Service Worker — handles push while the app
// is closed/backgrounded. Registered separately from public/sw.js (the
// offline-cache SW); Firebase Messaging specifically expects a worker
// file named firebase-messaging-sw.js at the site root.
//
// NOTE: values below MUST be filled in with the same Firebase project
// config used in src/lib/firebase.js. Service workers can't read Vite
// env vars (import.meta.env), so these are hardcoded — that's expected
// and fine, since Firebase client config is not a secret.

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBElsYHPCtW9nX4TMHBIth5KZEiWQkIoWs',
  authDomain: 'kuetx-8a184.firebaseapp.com',
  projectId: 'kuetx-8a184',
  storageBucket: 'kuetx-8a184.firebasestorage.app',
  messagingSenderId: '666096030914',
  appId: '1:666096030914:web:f89780f45dabc0a76a575b',
});

const messaging = firebase.messaging();

// Background message → show a native OS notification.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'KUETx';
  const body = payload.notification?.body || payload.data?.body || '';
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: payload.data?.link || '/notice' },
    tag: payload.data?.noticeId || undefined,
  });
});

// Clicking the OS notification focuses/opens the app at /notice.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/notice';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => 'focus' in c);
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});