// bookingAlerts.js
//
// PHASE 3 PART 2 (SERVICES_PROVIDER_PLAN.md §9). Per-recipient booking
// notifications — booking confirmed, booking cancelled (either direction),
// and shop-close auto-expiry.
//
// Why a new collection instead of reusing noticeUtils.js: notices there
// are broadcast/audience-based (global admin notices + group-level CR/ACR
// notices, filtered client-side by noticeAppliesTo/filterStudentFacingNotices).
// A booking event is inherently single-recipient (this one student or this
// one provider, about this one booking) — there's no audience to filter by,
// just a uid. Forcing that into the notices shape would mean inventing a
// fake "audience of one" for every alert, which the existing filter
// functions aren't built for. manualVerifyRequests.js was checked as a
// precedent too, but that's a request/response queue read only by the
// Founder — not a per-recipient inbox either.
//
// Shape mirrors the existing users/{uid}/data/{key} ownership pattern
// (firestore.rules) — read/write scoped to request.auth.uid == uid, same
// as everywhere else per-user data lives in this app — just nested under
// its own top-level collection instead of the generic data/{key} bucket,
// since these are system-generated events (not user-authored key/value
// data) and want their own rule shape (write restricted to the specific
// serviceSync.js call sites below, not a blanket "owner can write
// anything").
//
// bookingAlerts/{uid}/items/{alertId}
//   kind: 'booking_confirmed' | 'booking_cancelled' | 'booking_expired'
//   serviceId, bookingId, serviceName
//   message: short, already-composed display string (Bangla, matches the
//            rest of the student/provider-facing UI)
//   createdAt: serverTimestamp()
//   read: boolean

import {
  collection, doc, addDoc, updateDoc, onSnapshot, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

const itemsRef = (uid) => collection(db, 'bookingAlerts', uid, 'items');
const itemRef = (uid, alertId) => doc(db, 'bookingAlerts', uid, 'items', alertId);

/**
 * Write one alert for one recipient. Called from serviceSync.js at the
 * same time a booking's status changes — see the call sites in
 * confirmBooking/cancelBooking/expirePendingBookingsForClosedShop for
 * why each one uses the batch/transaction that's already open there
 * rather than a bare addDoc, so an alert can never be created without
 * the status change landing, or vice versa.
 */
export function queueBookingAlertWrite(batchOrTx, uid, {
  kind, serviceId, bookingId, serviceName, message,
}) {
  const ref = doc(itemsRef(uid));
  const payload = {
    kind,
    serviceId,
    bookingId,
    serviceName: serviceName || '',
    message,
    createdAt: serverTimestamp(),
    read: false,
  };
  if (typeof batchOrTx.set === 'function') {
    // both writeBatch and Transaction expose .set(ref, data)
    batchOrTx.set(ref, payload);
  }
  return ref.id;
}

/** Live list of a user's booking alerts, newest first — for NotificationPanel. */
export function subscribeBookingAlerts(uid, callback) {
  if (!uid) return () => {};
  return onSnapshot(
    query(itemsRef(uid), orderBy('createdAt', 'desc')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      // This listener is mounted via NotificationPanel inside Navbar, so
      // it's alive on essentially every page for every signed-in user.
      // An uncaught permission-denied here (e.g. during the anonymous ->
      // real-user auth transition on first load) was surfacing as a raw
      // Firestore console error with no user-visible symptom otherwise —
      // log it and fall back to an empty list instead of throwing.
      console.error('[bookingAlerts] subscribeBookingAlerts error:', err);
      callback([]);
    },
  );
}

export async function markBookingAlertRead(uid, alertId) {
  await updateDoc(itemRef(uid, alertId), { read: true });
}
