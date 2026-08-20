// errandRequests.js
//
// OPEN ERRAND REQUEST FEED — replaces the old shop-based "errand mode"
// (a Runner's own services/{serviceId} doc with interactionMode ===
// 'errand', requests filed under that shop's own bookings subcollection —
// see serviceSync.js's createErrandRequest/acceptErrandRequest/etc, now
// deprecated in favor of this file).
//
// Person's explicit correction (this file exists BECAUSE of that
// correction): the old model required a Runner to already have a shop
// set up before anyone could ask for a delivery at all — "amader ei pick
// and drop e kono runner na thakelo etay req deya jabe na" was the bug.
// This new model has NO shop, NO provider account requirement for
// POSTING or ACCEPTING as a plain student. Any verified student or
// faculty account can post an open request (broadcast to everyone
// eligible — see visibility rules below); any verified student, or any
// verified Provider account running an 'errand'-type shop (a "Runner",
// see serviceCategoryConfig.js's CATEGORY_SETUP_CONFIG.errand), can
// accept one, acting as a one-off deliverer for that single request only
// — no persistent per-request Runner identity beyond the shop itself.
//
// VISIBILITY MODEL (person's explicit design, this session):
//   - POST: both students and faculty may create a request.
//   - BROADCAST FEED: only visible to students and Runners (verified
//     Provider accounts with an 'errand'-type shop). Faculty NEVER see
//     the open feed — not their own request in it (already excluded by
//     the self-filter), and not anyone else's — because faculty cannot
//     accept requests at all, browsing a feed they can't act on would
//     be pure clutter/noise for them. This is enforced client-side in
//     subscribeOpenErrandRequests below (viewer-role gate) AND is safe
//     to enforce there only because read access itself remains open at
//     the rules layer (see firestore.rules' errandRequests match) —
//     hiding a browsable-but-inert feed from one role is a UX decision,
//     not a privacy boundary, same reasoning the module previously used
//     for the self-exclude filter.
//   - ACCEPT: students and Runners only (mirrors the feed visibility —
//     you can't accept what you were never shown). Faculty accounts are
//     blocked from accepting at the rules layer regardless of feed
//     visibility (defense in depth, not just a hidden button).
//   - A faculty account's OWN posted requests, and their status/who-
//     accepted, remain fully visible to that faculty member via
//     subscribeMyErrandRequests — only the browsable feed of OTHER
//     people's open requests is faculty-hidden, never a user's own data.
//   - OPT-OUT (person's explicit ask): a student may turn the broadcast
//     feed off entirely for themselves via errandBroadcastOptOut/{uid}
//     (see getErrandBroadcastOptOut/setErrandBroadcastOptOut below) —
//     once off, new open requests simply stop appearing in their feed
//     until they turn it back on. This does not affect their ability to
//     post their own requests or see their own "My Requests" list.
//
// Data model — ONE top-level collection, not nested under any shop:
//
//   errandRequests/{requestId}
//     requesterUid, requesterName, requesterRole ('student'|'faculty')
//     itemDescription, itemImageUrl (nullable)
//     proposedPrice (number, 0 == free), isFree (bool, mirrors price==0
//       for cheap querying/display without re-deriving it everywhere)
//     deadlineAt (nullable Timestamp — "within this time" window)
//     status: 'open' | 'confirmed' | 'finished' | 'cancelled'
//     confirmedAcceptorUid (nullable — set once the requester picks one)
//     createdAt, updatedAt
//
//   errandRequests/{requestId}/accepts/{acceptorUid}
//     acceptorUid, acceptorName, acceptorPhone
//     acceptedAt (Timestamp — this is what orders the waiting queue;
//       first-to-accept is first in line, but ordering is DISPLAY ONLY,
//       the requester can confirm ANY acceptor, not just the earliest)
//     status: 'waiting' | 'confirmed' | 'rejected'
//
//   errandBroadcastOptOut/{uid}
//     optedOut (bool), updatedAt — single-purpose doc, same pattern as
//     errandContact/{uid} below. Absence of a doc == not opted out
//     (default: broadcast ON), matching every other opt-in-by-default
//     preference in this app.
//
// Why a doc-per-acceptor subcollection instead of an array field on the
// parent doc: concurrent accepts from different people racing to accept
// the same request must never clobber each other (an array field
// read-modify-write is exactly that race); a subcollection makes each
// accept its own atomic doc create, and the confirm step is the only
// place multiple docs get touched together (in one batch — see
// confirmErrandRequest below).
//
// Contact persistence (person's explicit request): an acceptor's phone
// number, once given, should never be asked again. Name/role already
// live on the account (mandatory KUETx registration — see store.js's
// profile / facultySync.js's faculty doc), only phone was missing on
// the student side. Rather than growing the large, already-complex
// student profile sync (firebaseSync.js's pushProfile/pullProfile,
// which the person did not ask to be touched here), this uses ONE small
// dedicated doc mirroring the exact pattern serviceSync.js's
// studentPreferences/{uid} already established for a single-purpose
// per-user flag/value — see errandContactDocRef below.

import {
  collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot,
  query, where, orderBy, limit, serverTimestamp, runTransaction, writeBatch,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { retryableOnSnapshot, withPromiseTimeout } from './safeSnapshot';
// Storage cleanup: an itemImageUrl's whole purpose ends the moment a
// request reaches a terminal state (finished/cancelled) — see
// finishErrandRequest/cancelErrandRequest below. deleteServiceImage()
// already exists (built for the shop-based provider gallery flow) and
// is generic over any R2 key under 'services/', which is exactly what
// uploadServiceImage(requestId, file) produces for errand images too
// (see ErrandFeed.jsx's PostRequestForm) — reused as-is, no new worker
// route needed.
import { deleteServiceImage } from './serviceImageUpload';

const requestsCollectionRef = () => collection(db, 'errandRequests');
const requestDocRef = (requestId) => doc(db, 'errandRequests', requestId);
const acceptsCollectionRef = (requestId) => collection(db, 'errandRequests', requestId, 'accepts');
const acceptDocRef = (requestId, acceptorUid) => doc(db, 'errandRequests', requestId, 'accepts', acceptorUid);
// Reused as-is from serviceSync.js's own servicesCollectionRef — a
// "Runner" is simply a verified Provider account with at least one
// services/{serviceId} doc whose type is 'errand' (see
// serviceCategoryConfig.js's CATEGORY_SETUP_CONFIG.errand). No separate
// "Runner" collection/flag was introduced; reusing the existing Provider
// shop-category system is the whole point of this session's change (the
// old shop-based errand mode's UI is reused, only its data dependency
// moves from services/{serviceId}/bookings to the open feed below).
const servicesCollectionRef = () => collection(db, 'services');

/**
 * True if this uid is a verified Provider running at least one
 * 'errand'-type shop ("Runner" in this app's terms — see module doc
 * comment's visibility model). Used by ErrandFeed.jsx to decide whether
 * a Provider viewer should see/accept from the open feed, same status
 * a plain student always has.
 */
export async function isErrandRunner(uid) {
  if (!uid) return false;
  const snap = await getDocs(query(servicesCollectionRef(), where('providerUid', '==', uid), where('type', '==', 'errand')));
  return !snap.empty;
}

// Mirrors studentPreferences/{uid}'s single-purpose-doc pattern —
// see serviceSync.js's studentPreferencesDocRef for the precedent this
// follows. Shared by both students and faculty (the field name doesn't
// say "student" specifically, unlike the older studentPreferences doc,
// since faculty also send/accept requests in this new model).
const errandContactDocRef = (uid) => doc(db, 'errandContact', uid);

// Broadcast opt-out — student-only toggle (person's explicit ask): a
// student who never wants to see the open feed can turn it off. Absence
// of a doc / optedOut !== true means broadcast stays ON, matching every
// other opt-in-by-default preference in this app (nobody is silently
// opted out just because this doc has never been touched).
const errandBroadcastOptOutDocRef = (uid) => doc(db, 'errandBroadcastOptOut', uid);

// ---------------------------------------------------------------------
// Contact number — save once, reuse forever (person's explicit ask).
// ---------------------------------------------------------------------

/** One-shot read of this account's saved phone number, or '' if never set. */
export async function getSavedErrandPhone(uid) {
  if (!uid) return '';
  const snap = await getDoc(errandContactDocRef(uid));
  return snap.exists() ? String(snap.data().phone || '') : '';
}

/** Saves (or updates) this account's phone number for future accepts — called once, silently, whenever an accept includes a phone that differs from what's already saved. */
export async function saveErrandPhone(uid, phone) {
  if (!uid || !phone) return;
  await setDoc(errandContactDocRef(uid), { phone: String(phone).trim(), updatedAt: serverTimestamp() }, { merge: true });
}

// ---------------------------------------------------------------------
// Broadcast opt-out (student-only toggle — see module doc comment).
// ---------------------------------------------------------------------

/** One-shot read of whether this account has turned the open feed off. Default false (feed ON) when no doc exists yet. */
export async function getErrandBroadcastOptOut(uid) {
  if (!uid) return false;
  const snap = await getDoc(errandBroadcastOptOutDocRef(uid));
  return snap.exists() && snap.data().optedOut === true;
}

/** Live subscription to this account's opt-out state, for the Pick and Drop toggle UI to reflect changes made elsewhere (e.g. another tab). */
export function subscribeErrandBroadcastOptOut(uid, callback) {
  if (!uid) { callback(false); return () => {}; }
  return retryableOnSnapshot(
    errandBroadcastOptOutDocRef(uid),
    (snap) => callback(snap.exists() && snap.data().optedOut === true),
    (err) => {
      console.error('[errandRequests] subscribeErrandBroadcastOptOut error:', err);
      callback(false);
    },
  );
}

/** Sets this account's broadcast opt-out state — student-only in the UI (see ErrandFeed.jsx), but not role-gated here since a faculty account already never sees the feed regardless of this flag. */
export async function setErrandBroadcastOptOut(uid, optedOut) {
  if (!uid) return;
  await setDoc(errandBroadcastOptOutDocRef(uid), { optedOut: !!optedOut, updatedAt: serverTimestamp() }, { merge: true });
}

// ---------------------------------------------------------------------
// Posting a request
// ---------------------------------------------------------------------

/**
 * Generates a fresh errandRequests/{id} — pass this straight through to
 * createOpenErrandRequest (as `requestId`) when the post has an image,
 * so the doc exists (status 'open', itemImageUrl still null) BEFORE the
 * image is uploaded. The image worker's ownership check
 * (ownsErrandRequest) needs the doc to already exist — it can't
 * authorize an upload against a request that isn't there yet — so the
 * real order is: generate id -> create doc (no image) -> upload image
 * against that id -> patchErrandRequestImage() attaches the URL. See
 * ErrandFeed.jsx's PostRequestForm for the full sequence.
 */
export function generateErrandRequestId() {
  return doc(requestsCollectionRef()).id;
}

/** Attaches (or clears) itemImageUrl on an already-created open request — the one allowed use of this narrow update path, see firestore.rules' matching 5th update branch for why this needed its own rule rather than reusing the create rule. */
export async function patchErrandRequestImage(requestId, itemImageUrl) {
  await updateDoc(requestDocRef(requestId), { itemImageUrl: itemImageUrl || null, updatedAt: serverTimestamp() });
}

/**
 * Creates a new open errand request, broadcast to everyone (minus the
 * requester themself — see subscribeOpenErrandRequests's own
 * requesterUid-excluding filter, applied client-side same as the old
 * subscribeAllMyBookings pattern did for merges).
 *
 * `requestId` is optional — pass a pre-generated id (via
 * generateErrandRequestId() below) when the caller needs to upload an
 * image BEFORE creating the doc (the image worker's ownsErrandRequest
 * check needs the errandRequests/{requestId} doc to already exist, and
 * separately, firestore.rules' update rule only allows the four
 * documented status transitions — an update-after-create just to attach
 * itemImageUrl would be rejected outright. Create-with-the-URL-already-
 * set is the only rules-compliant order.). If omitted, an id is
 * generated here as before (image-less requests, unaffected).
 */
export async function createOpenErrandRequest({
  requesterUid, requesterName, requesterRole = 'student',
  itemDescription, itemImageUrl = null, proposedPrice = 0, deadlineAt = null,
  requestId = null,
}) {
  const trimmedDescription = String(itemDescription || '').trim();
  if (!trimmedDescription) throw new Error('কী লাগবে সেটা লিখুন।');
  const price = Number(proposedPrice) || 0;
  if (!(price >= 0)) throw new Error('একটা বৈধ মূল্য দিন, অথবা ফ্রি রাখুন।');

  const ref = requestId ? requestDocRef(requestId) : doc(requestsCollectionRef());
  await setDoc(ref, {
    requesterUid,
    requesterName: String(requesterName || '').trim(),
    requesterRole: requesterRole === 'faculty' ? 'faculty' : 'student',
    itemDescription: trimmedDescription,
    itemImageUrl: itemImageUrl || null,
    proposedPrice: price,
    isFree: price === 0,
    deadlineAt: deadlineAt || null,
    status: 'open',
    confirmedAcceptorUid: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ---------------------------------------------------------------------
// Reading the feed
// ---------------------------------------------------------------------

/**
 * Live feed of every OTHER account's open requests (person's explicit
 * rule: "nijer req nije dekhbe na" — a requester never sees their own
 * post in the feed, everyone else's does). Firestore can't do a
 * not-equal-to-self filter server-side alongside a status filter and an
 * orderBy without an extra composite index headache, and this list is
 * small/short-lived by nature (open requests get removed from view the
 * moment they're confirmed elsewhere or finished), so the self-exclude
 * is a trivial client-side filter on an already-small snapshot — same
 * "fetch broad, filter client-side" split serviceSync.js's own
 * broadcast functions already use.
 *
 * VIEWER GATING (person's explicit design, see module doc comment):
 * faculty viewers and opted-out student viewers get an empty feed —
 * `viewerCanSeeFeed` is resolved by the caller (ErrandFeed.jsx, via
 * useIsFaculty + getErrandBroadcastOptOut) and passed in rather than
 * re-derived here, so this function stays a pure data-layer read with
 * no role/auth logic duplicated across call sites. Passing false simply
 * skips subscribing at all (no wasted listener for a feed the viewer
 * will never see).
 */
export function subscribeOpenErrandRequests(viewerUid, callback, viewerCanSeeFeed = true) {
  if (!viewerCanSeeFeed) { callback([]); return () => {}; }
  return retryableOnSnapshot(
    query(requestsCollectionRef(), where('status', '==', 'open'), orderBy('createdAt', 'desc')),
    (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(viewerUid ? all.filter((r) => r.requesterUid !== viewerUid) : all);
    },
    (err) => {
      console.error('[errandRequests] subscribeOpenErrandRequests error:', err);
      callback([]);
    },
  );
}

/** Live feed of the signed-in account's OWN requests (any status) — for their "my requests" view. */
export function subscribeMyErrandRequests(uid, callback) {
  if (!uid) { callback([]); return () => {}; }
  return retryableOnSnapshot(
    query(requestsCollectionRef(), where('requesterUid', '==', uid), orderBy('createdAt', 'desc')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[errandRequests] subscribeMyErrandRequests error:', err);
      callback([]);
    },
  );
}

/** Live feed of every request this account has accepted (any status) — for their "things I'm helping with" view, since an acceptor otherwise has no other way to find their own accepted requests again. Uses a collectionGroup query over every request's accepts subcollection, same pattern serviceSync.js's old subscribeAllMyBookings used for the bookings collectionGroup. */
export function subscribeMyAcceptedErrandRequests(uid, callback) {
  if (!uid) { callback([]); return () => {}; }
  let acceptDocs = null;
  let requestsById = new Map();
  const emit = () => {
    if (acceptDocs === null) return;
    callback(acceptDocs.map((a) => ({ ...a, request: requestsById.get(a.requestId) || null })));
  };
  const refreshRequests = async () => {
    const ids = [...new Set(acceptDocs.map((a) => a.requestId))];
    const fetched = await Promise.all(ids.map(async (id) => {
      try {
        const snap = await getDoc(requestDocRef(id));
        return snap.exists() ? [id, { id, ...snap.data() }] : null;
      } catch { return null; }
    }));
    requestsById = new Map(fetched.filter(Boolean));
    emit();
  };
  const unsub = onSnapshot(
    query(collectionGroup(db, 'accepts'), where('acceptorUid', '==', uid)),
    (snap) => {
      acceptDocs = snap.docs.map((d) => ({
        id: d.id,
        requestId: d.ref.parent.parent.id,
        ...d.data(),
      }));
      refreshRequests();
    },
    (err) => {
      console.error('[errandRequests] subscribeMyAcceptedErrandRequests error:', err);
      acceptDocs = [];
      emit();
    },
  );
  return unsub;
}

/** Live subscription to one request's accepts, ordered oldest-first (the display queue order — see the module doc comment: this ordering is display-only, any acceptor can still be confirmed). */
export function subscribeErrandAccepts(requestId, callback) {
  return retryableOnSnapshot(
    query(acceptsCollectionRef(requestId), orderBy('acceptedAt', 'asc')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[errandRequests] subscribeErrandAccepts error:', err);
      callback([]);
    },
  );
}

/** Live subscription to a single request doc (for a detail modal that needs to react to status changes made elsewhere). */
export function subscribeErrandRequest(requestId, callback) {
  return retryableOnSnapshot(
    requestDocRef(requestId),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => {
      console.error('[errandRequests] subscribeErrandRequest error:', err);
      callback(null);
    },
  );
}

// ---------------------------------------------------------------------
// Accepting
// ---------------------------------------------------------------------

/**
 * Any verified account accepts an open request. Multiple people may
 * accept the same request (person's explicit rule) — this just creates
 * one more doc in the queue, transaction-guarded only to re-check the
 * request is still 'open' (an already-confirmed/finished/cancelled
 * request can't be accepted into after the fact) and to prevent the
 * SAME acceptor from double-accepting (acceptDocRef is keyed by
 * acceptorUid, so a second call just overwrites their own first accept
 * rather than creating a duplicate — harmless either way, but the
 * transaction re-read still guards against accepting a request that
 * flipped to non-open in the moment between page-load and tap).
 *
 * Saves the phone number for next time if it's new/changed — this is
 * the ONE place a phone gets collected, so it's also the one place that
 * persists it, keeping "ask once" enforcement in a single spot rather
 * than scattered across every call site.
 *
 * `acceptorIsFaculty` (person's explicit design — see module doc
 * comment's visibility model): faculty accounts can never accept a
 * request, full stop. This client-side check is a fast-fail/better-
 * error-message convenience only — the real boundary is firestore.rules'
 * matching create rule on errandRequests/{requestId}/accepts/
 * {acceptorUid}, which independently blocks a faculty uid regardless of
 * what this function does, so a modified client can't bypass it.
 */
export async function acceptErrandRequest(requestId, { acceptorUid, acceptorName, acceptorPhone, acceptorIsFaculty = false }) {
  if (acceptorIsFaculty) throw new Error('Faculty অ্যাকাউন্ট দিয়ে রিকোয়েস্ট গ্রহণ করা যায় না।');
  const trimmedPhone = String(acceptorPhone || '').trim();
  if (!trimmedPhone) throw new Error('একটা ফোন নাম্বার দিন।');

  await runTransaction(db, async (tx) => {
    const reqSnap = await tx.get(requestDocRef(requestId));
    if (!reqSnap.exists()) throw new Error('এই রিকোয়েস্টটি আর নেই।');
    if (reqSnap.data().status !== 'open') throw new Error('এই রিকোয়েস্টটি আর খোলা নেই।');
    if (reqSnap.data().requesterUid === acceptorUid) throw new Error('নিজের রিকোয়েস্ট নিজে গ্রহণ করা যায় না।');
    tx.set(acceptDocRef(requestId, acceptorUid), {
      acceptorUid,
      acceptorName: String(acceptorName || '').trim(),
      acceptorPhone: trimmedPhone,
      acceptedAt: serverTimestamp(),
      status: 'waiting',
    });
  });

  // Best-effort, outside the transaction (a save failure here shouldn't
  // block the accept itself from having succeeded) — only writes if the
  // number actually changed, so this isn't a write on every accept.
  try {
    const saved = await getSavedErrandPhone(acceptorUid);
    if (saved !== trimmedPhone) await saveErrandPhone(acceptorUid, trimmedPhone);
  } catch (e) {
    console.error('[errandRequests] acceptErrandRequest: phone save failed (non-blocking)', e);
  }
}

/** An acceptor withdraws their own still-waiting accept (e.g. changed their mind before being confirmed). */
export async function withdrawErrandAccept(requestId, acceptorUid) {
  await updateDoc(acceptDocRef(requestId, acceptorUid), { status: 'withdrawn' });
}

// ---------------------------------------------------------------------
// Confirming — requester picks ONE acceptor, every other accept is
// auto-rejected (person's explicit rule).
// ---------------------------------------------------------------------

/**
 * Requester confirms one specific acceptor. Every other 'waiting' accept
 * for this request flips to 'rejected' in the SAME batch, so there's no
 * window where two acceptors could both look confirmed.
 */
export async function confirmErrandAcceptor(requestId, chosenAcceptorUid) {
  const acceptsSnap = await withPromiseTimeout(
    getDocs(acceptsCollectionRef(requestId)),
    '[errandRequests] confirmErrandAcceptor accepts read',
  );
  const batch = writeBatch(db);
  batch.update(requestDocRef(requestId), {
    status: 'confirmed',
    confirmedAcceptorUid: chosenAcceptorUid,
    updatedAt: serverTimestamp(),
  });
  acceptsSnap.docs.forEach((d) => {
    if (d.id === chosenAcceptorUid) {
      batch.update(d.ref, { status: 'confirmed' });
    } else if (d.data().status === 'waiting') {
      batch.update(d.ref, { status: 'rejected' });
    }
  });
  await batch.commit();
}

// ---------------------------------------------------------------------
// Finishing / cancelling — either terminal state removes the card from
// every open feed (person's explicit rule: "purota chole jabe, card
// gula remove hoye jabe finish er por" — subscribeOpenErrandRequests's
// own status=='open' filter already handles this automatically, nothing
// extra needed here beyond flipping status).
//
// Image cleanup (person's explicit ask: "chobi gula finish hoye gele r
// dorkar nei, database e rekhe lav nei"): once a request is finished or
// cancelled, its itemImageUrl (if any) is deleted from R2 via
// deleteServiceImage() — best-effort, run AFTER the status write
// succeeds and never allowed to block or fail it (a stray orphaned R2
// object is a storage-cost nuisance, same "non-blocking" tradeoff this
// file already made for the phone-save in acceptErrandRequest). The
// itemImageUrl field itself is deliberately left as-is on the doc
// rather than nulled out in the same write — firestore.rules' status-
// transition branches only permit a `status`+`updatedAt` diff for
// finish/cancel (see that file's comment), so clearing the field here
// would need a second write and gains nothing: a finished/cancelled
// request's stale image URL is never rendered anywhere (every feed/list
// view filters those statuses out), it's just an unused string sitting
// next to a real R2 object that's now actually gone.
// ---------------------------------------------------------------------

async function deleteErrandImageIfAny(requestId) {
  try {
    const snap = await getDoc(requestDocRef(requestId));
    const url = snap.exists() ? snap.data().itemImageUrl : null;
    if (url) await deleteServiceImage(url);
  } catch (e) {
    console.error('[errandRequests] deleteErrandImageIfAny failed (non-blocking)', e);
  }
}

/** Either the requester or the confirmed acceptor marks the request finished. */
export async function finishErrandRequest(requestId) {
  await updateDoc(requestDocRef(requestId), { status: 'finished', updatedAt: serverTimestamp() });
  deleteErrandImageIfAny(requestId);
}

/** Requester withdraws an open (not yet confirmed) request entirely. */
export async function cancelErrandRequest(requestId) {
  await updateDoc(requestDocRef(requestId), { status: 'cancelled', updatedAt: serverTimestamp() });
  deleteErrandImageIfAny(requestId);
}

// ---------------------------------------------------------------------
// Founder/Admin visibility (person's explicit ask): a centralized log
// of who has ever accepted a request and what they did. Rather than a
// separate write-on-every-accept "log" collection (redundant with the
// accepts subcollection data that already exists), this reads across
// every request's accepts via the same collectionGroup this file
// already uses for subscribeMyAcceptedErrandRequests — one extra
// function, no extra writes/collections.
// ---------------------------------------------------------------------

/** One-shot read for the Founder dashboard: every accept ever made, newest first, capped (dashboard pagination is a later concern, not needed for an initial launch-sized dataset). */
export async function getAllErrandAcceptsForAdmin(maxResults = 200) {
  const snap = await withPromiseTimeout(
    getDocs(query(collectionGroup(db, 'accepts'), orderBy('acceptedAt', 'desc'), limit(maxResults))),
    '[errandRequests] getAllErrandAcceptsForAdmin',
  );
  return snap.docs.map((d) => ({ id: d.id, requestId: d.ref.parent.parent.id, ...d.data() }));
}
