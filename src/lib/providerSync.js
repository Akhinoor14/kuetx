// providerSync.js
//
// CRUD for providers/{uid} — the Service Provider account doc (see
// SERVICES_PROVIDER_PLAN.md §2, §3, §4). Deliberately top-level, same
// pattern as faculty/{uid} (facultySync.js) — one provider account, its
// own directory entry, never mixed into the student profile shape.
//
// Unlike faculty/{uid}, provider verification is a HARD GATE at the
// dashboard level (spec §4): status must be 'verified' before the
// provider dashboard renders at all — an unverified/pending account only
// ever sees the "Verification pending" screen. This is the deliberate
// difference from the Faculty Module's relaxed browse-but-don't-write
// policy (see RequireFaculty.jsx's doc comment) — a fake/unverified
// salon account has nothing legitimate to browse; there's no read-only
// value in letting it see a provider dashboard shell before Founder
// approval, so Phase 1 simply doesn't render one.
//
// status: 'pending' | 'verified' | 'rejected' | 'deactivated'
// (§2 data model, §6 of the 10-gap table — Gap 6 and Gap 9).

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { retryableOnSnapshot } from './safeSnapshot';

const providerDocRef = (uid) => doc(db, 'providers', uid);
const providerCollectionRef = () => collection(db, 'providers');
const providerPhoneRef = (uid) => doc(db, 'providers', uid, 'contact', 'phone');

/**
 * Create the initial providers/{uid} doc right after Provider signup
 * (§3, §4 Step 1-2). status is always 'pending' at creation — verified
 * status can ONLY ever be granted by the Founder (see firestore.rules),
 * mirroring faculty/{uid}.verifiedAt's client-can-never-self-grant rule.
 *
 * PHASE 3 PART 2 (§10 fix): phone is written to providers/{uid}/contact/phone,
 * a separate sub-document, NOT a field on this parent doc. firestore.rules
 * now forbids 'phone' on the parent create/update entirely — see that
 * rule's own comment for why: Firestore has no field-level read
 * restriction within a single document, so gating the phone number to
 * "only a student with a confirmed booking can read it" (§10) required
 * splitting it into its own doc with its own rule, while displayName/
 * status/serviceType etc. stay openly readable on the parent as before.
 */
export async function createProviderShell(uid, fields) {
  const ref = providerDocRef(uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data();

  const {
    displayName, phone, serviceType, serviceTypeOther, location,
  } = fields || {};

  const data = {
    status: 'pending',
    verifiedAt: null,
    rejectedReason: null,
    displayName: String(displayName || '').trim(),
    requestedAt: serverTimestamp(),
    // One of serviceSync.js's PROVIDER_SIGNUP_TYPES — the five plan-
    // approved SERVICE_TYPES plus 'other' for a business that doesn't fit
    // any of them yet (decision: keep 'other' at signup/verification only,
    // not promoted to the student-facing Services grid until there's real
    // demand for a new category).
    serviceType: serviceType || 'salon',
    // Only meaningful when serviceType === 'other' — the free-text label
    // the provider typed in for their own category.
    serviceTypeOther: serviceType === 'other' ? String(serviceTypeOther || '').trim() : '',
    // Free-text shop/location address (Founder-verification gap fix) —
    // Founder has no way to sanity-check or physically verify a request
    // without knowing where the shop actually is.
    location: String(location || '').trim(),
    serviceIds: [],
  };
  await setDoc(ref, data);
  await setDoc(providerPhoneRef(uid), { value: String(phone || '').trim() });
  return { ...data, phone: String(phone || '').trim() };
}

/** Plain one-shot read of the current user's provider doc. Returns null if it doesn't exist. */
export async function getProviderProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(providerDocRef(uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

/** Live subscription to the current user's provider doc — used by useIsProvider and the pending/dashboard screens. */
export function subscribeProviderProfile(uid, callback) {
  if (!uid) return () => {};
  return retryableOnSnapshot(providerDocRef(uid), (snap) => {
    callback(snap.exists() ? { uid, ...snap.data() } : null);
  }, (err) => {
    console.error('[providerSync] subscribeProviderProfile error:', err);
    callback(null);
  });
}

/**
 * Read the provider's own phone number — for their own dashboard header,
 * the Founder's Approvals tab, or (§10) a student with standing (a
 * confirmed/done booking, per firestore.rules' hasConfirmedBookingWithProvider).
 * A caller without any of those three kinds of standing gets a
 * permission-denied from Firestore, not a silently empty result — this
 * function doesn't swallow that, so callers should expect it to reject.
 */
export async function getProviderPhone(uid) {
  const snap = await getDoc(providerPhoneRef(uid));
  return snap.exists() ? (snap.data().value || '') : '';
}

/**
 * Provider re-submits their detail form after a rejection (§4 Step 6).
 * Resets status back to 'pending' and clears the rejection reason —
 * same uid, new request, per spec. Only touches the fields a provider is
 * allowed to edit; verifiedAt/status transitions beyond this are
 * Founder-only (enforced in firestore.rules, not just here). phone (if
 * provided) is written to the contact/phone sub-doc, same split as
 * createProviderShell above.
 */
export async function resubmitProviderRequest(uid, fields) {
  const {
    displayName, phone, serviceType, serviceTypeOther, location,
  } = fields || {};
  const ref = providerDocRef(uid);
  await updateDoc(ref, {
    status: 'pending',
    rejectedReason: null,
    ...(displayName !== undefined ? { displayName: String(displayName).trim() } : {}),
    ...(serviceType !== undefined ? { serviceType } : {}),
    ...(serviceType !== undefined
      ? { serviceTypeOther: serviceType === 'other' ? String(serviceTypeOther || '').trim() : '' }
      : {}),
    ...(location !== undefined ? { location: String(location).trim() } : {}),
    requestedAt: serverTimestamp(),
  });
  if (phone !== undefined) {
    await setDoc(providerPhoneRef(uid), { value: String(phone).trim() });
  }
}

/** Founder-only: list every provider account, for the Approvals queue. */
export async function listAllProviderAccounts() {
  const snap = await getDocs(providerCollectionRef());
  return snap.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() }));
}

/**
 * Live list of pending provider verification requests, for the Founder's
 * Approvals → Provider Verification tab — same shape as
 * manualVerifyRequests.js's subscribeManualVerifyRequests. Only
 * status === 'pending' shows up here; verified/rejected/deactivated
 * accounts have already been actioned and don't need to keep appearing.
 */
export function subscribeProviderVerifyRequests(callback) {
  return retryableOnSnapshot(
    query(providerCollectionRef(), where('status', '==', 'pending')),
    (snap) => callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
    (err) => {
      console.error('[providerSync] subscribeProviderVerifyRequests error:', err);
      callback([]);
    },
  );
}

export function isProviderVerified(pdoc) {
  return Boolean(pdoc && pdoc.status === 'verified');
}

export function isProviderPending(pdoc) {
  return Boolean(pdoc && pdoc.status === 'pending');
}

export function isProviderRejected(pdoc) {
  return Boolean(pdoc && pdoc.status === 'rejected');
}

/** Convenience for the current signed-in user — most call sites don't have a uid handy otherwise. */
export function getCurrentProviderUid() {
  return auth.currentUser?.uid || null;
}

/**
 * Founder-only: grant verification directly from AdminDashboard's
 * Approvals → Provider Verification tab. Firestore rules restrict the
 * writable keys on this update to exactly {status, verifiedAt,
 * verifiedBy, rejectedReason} and require isAdmin(), same protection
 * shape as facultySync.js's adminVerifyFaculty.
 */
export async function adminVerifyProvider(uid) {
  await updateDoc(providerDocRef(uid), {
    status: 'verified',
    verifiedAt: serverTimestamp(),
    verifiedBy: auth.currentUser?.uid || null,
    rejectedReason: null,
  });
}

/**
 * Founder-only: reject a pending provider request, with a reason shown
 * back to the provider on their pending screen (§4 Step 6, Gap 6).
 * The provider can re-submit afterward via resubmitProviderRequest().
 */
export async function adminRejectProvider(uid, reason) {
  await updateDoc(providerDocRef(uid), {
    status: 'rejected',
    verifiedAt: null,
    rejectedReason: String(reason || '').trim() || 'No reason given.',
  });
}

/**
 * Founder-only: deactivate a previously-verified provider account
 * (Gap 9 — §8 of the plan). PHASE 3: now also force-closes every one of
 * the provider's services and auto-expires their pending bookings (via
 * serviceSync.js's forceCloseProviderServices) in the SAME call, so
 * deactivation actually takes effect immediately on the student-facing
 * side — Phase 2 had left this cascade as a known, explicitly-flagged
 * gap (flipping only providers/{uid}.status while isOpen stayed
 * whatever it was).
 *
 * This import is deliberately function-level (inside the function body,
 * not a top-of-file import) to avoid a circular import: serviceSync.js
 * doesn't import providerSync.js, but keeping the cross-file dependency
 * localized here — rather than adding a top-level
 * `import { forceCloseProviderServices } from './serviceSync'` next to
 * the firebase/firestore imports — makes it easy to see at the call
 * site exactly why this one function reaches into the other module.
 */
export async function adminDeactivateProvider(uid) {
  await updateDoc(providerDocRef(uid), {
    status: 'deactivated',
  });
  const { forceCloseProviderServices } = await import('./serviceSync');
  await forceCloseProviderServices(uid);
}
