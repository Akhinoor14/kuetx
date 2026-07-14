import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore';
import app, { db, auth } from './firebase';
import { store } from '../store/store';
import { notify } from './notify';

/**
 * Push notifications (FCM) — Phase E.
 *
 * Client responsibilities only (this file):
 *   1. Register public/firebase-messaging-sw.js
 *   2. Ask for browser notification permission (via a soft in-app
 *      banner first — see PushPermissionBanner.jsx — never the raw
 *      browser popup cold)
 *   3. Get an FCM token, save it onto the signed-in user's Firestore
 *      profile doc (users/{uid}.fcmTokens: array, one per device)
 *   4. Foreground messages (app open) — funnel into the SAME NoticeToast
 *      popup system from Phase D by simply doing nothing extra here:
 *      new Firestore notice docs already trigger NoticeToast via
 *      subscribeAllNotices(). onMessage() below is only a safety-net
 *      for edge cases (e.g. payload with no matching Firestore doc yet)
 *      and just shows a plain browser Notification if the tab isn't
 *      focused.
 *
 * Sending pushes to devices when a notice is created is a SERVER-SIDE
 * concern (Cloud Function that reads fcmTokens off matching users and
 * calls admin.messaging().sendEachForMulticast()) — see
 * functions/README_PUSH_SETUP.md in this same delivery. This file
 * cannot do that part; it only gets tokens into Firestore for that
 * function to read.
 *
 * VAPID key: required by getToken(). Set VITE_FIREBASE_VAPID_KEY in
 * your .env (Firebase Console → Project Settings → Cloud Messaging →
 * Web Push certificates → generate/copy the "Key pair").
 */

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export async function isPushSupported() {
  try {
    return (await isSupported()) && 'serviceWorker' in navigator && 'Notification' in window;
  } catch {
    return false;
  }
}

export function getPushPermissionState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

// Soft in-app ask happens in PushPermissionBanner.jsx BEFORE this is
// called — this function is what actually triggers the native browser
// permission prompt + token fetch, only once the user has already
// tapped "Allow" on our own banner.
export async function enablePush() {
  if (!(await isPushSupported())) {
    return { ok: false, reason: 'unsupported' };
  }
  if (!VAPID_KEY) {
    console.warn('[push] VITE_FIREBASE_VAPID_KEY not set — cannot fetch FCM token.');
    return { ok: false, reason: 'no-vapid-key' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'denied' };
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return { ok: false, reason: 'no-token' };

    await saveTokenForCurrentUser(token);

    // Foreground fallback — if a push arrives while the tab is open and
    // focused, Firestore's own onSnapshot already surfaces it via
    // NoticeToast (Phase D), so we deliberately do NOT duplicate it as
    // a second popup here. This listener exists only so the SDK doesn't
    // warn about an unhandled foreground message.
    onMessage(messaging, () => {});

    return { ok: true, token };
  } catch (e) {
    console.warn('[push] enablePush failed', e);
    return { ok: false, reason: 'error', error: e };
  }
}

async function saveTokenForCurrentUser(token) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await setDoc(
    doc(db, 'users', uid),
    { fcmTokens: arrayUnion(token) },
    { merge: true }
  );
  store.set('pushEnabled', true);
}

export async function disablePush() {
  try {
    const uid = auth.currentUser?.uid;
    if (!(await isPushSupported()) || !uid) return;
    const messaging = getMessaging(app);
    const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (registration) {
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      }).catch(() => null);
      if (token) {
        await setDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(token) }, { merge: true });
      }
    }
    store.set('pushEnabled', false);
    notify('Push notifications have been turned off.', 'info');
  } catch (e) {
    console.warn('[push] disablePush failed', e);
  }
}
