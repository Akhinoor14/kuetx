// serviceSync.js
//
// PHASE 2: services/{serviceId} CRUD + the booking state machine
// (SERVICES_PROVIDER_PLAN.md §2, §5, §6, §7). This is deliberately a
// separate file from providerSync.js — providers/{uid} is the
// account-level identity+verification doc (Phase 1, one per provider,
// rarely written after onboarding), while services/{serviceId} and its
// bookings subcollection are the operational data that changes
// constantly (every booking, every open/closed toggle). Keeping them
// apart mirrors how faculty/{uid} (identity) stays separate from
// facultyClassSync.js (operational class data) elsewhere in this repo.
//
// Booking state machine (§7, verbatim from the spec):
//   pending    -> cancelled (by student)              [Gap 1]
//   pending    -> confirmed (by owner)                [Gap 8: transaction-guarded]
//   pending    -> expired_shop_closed (shop closes)    [Gap 4]
//   confirmed  -> cancelled (by student OR owner)      [Gap 1, Gap 3]
//   confirmed  -> done (owner finishes)
//   done / cancelled / expired_shop_closed = terminal, no further transitions
//
// Cancelling never deletes the document (Gap 2) — it's a status change,
// kept for history/analytics. Re-booking after a cancel is a brand new
// booking document with a fresh requestedAt, so queue order stays correct.

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, where, orderBy, serverTimestamp, runTransaction, writeBatch,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { queueBookingAlertWrite } from './bookingAlerts';

const serviceDocRef = (serviceId) => doc(db, 'services', serviceId);
const servicesCollectionRef = () => collection(db, 'services');
const bookingsCollectionRef = (serviceId) => collection(db, 'services', serviceId, 'bookings');
const bookingDocRef = (serviceId, bookingId) => doc(db, 'services', serviceId, 'bookings', bookingId);

// A tiny id generator for offering sub-ids — offerings live inside the
// service doc as an array (not a subcollection), since they're small,
// bounded, and always edited as a whole list from the provider dashboard.
// Matches the shape described in §2: offerings: [ { id, label, isAvailable } ].
function newOfferingId() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------
// Service (provider-owned) CRUD
// ---------------------------------------------------------------------

// MULTI_CATEGORY_SERVICES_PLAN.md Phase 1: type -> default interactionMode
// mapping. Booking-mode categories keep the existing pending/confirmed/done
// state machine untouched; inquiry-mode categories (medicine, bookstore,
// the new onlinemart) get the lighter open/answered/closed flow added in
// Phase 2. This map is the single source of truth for the default — a
// provider never picks interactionMode directly, it's derived from type.
const TYPE_TO_INTERACTION_MODE = {
  salon: 'booking',
  hotel: 'booking',
  medicine: 'inquiry',
  bookstore: 'inquiry',
  onlinemart: 'inquiry',
};

function defaultInteractionModeForType(type) {
  return TYPE_TO_INTERACTION_MODE[type] || 'booking';
}

// MULTI_CATEGORY_SERVICES_PLAN.md Phase 3: single source of truth for the
// five category labels (Bangla), shared by the provider onboarding
// category-select (this phase) and the student-facing category grid
// (Phase 6) — kept here rather than duplicated in two page files, since
// both need the exact same type<->label mapping.
export const SERVICE_TYPE_LABELS = {
  salon: 'Salon',
  hotel: 'Food',
  medicine: 'Pharmacy',
  bookstore: 'Stationery',
  onlinemart: 'Online Mart',
};

export const SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABELS);

/**
 * Creates a new services/{serviceId} doc for a verified provider (§2, §5.1).
 * Called once, right after Phase 1 verification, from the provider
 * dashboard's "set up your service" step. providers/{uid}.serviceIds gets
 * the new id appended in the same batch, so the two stay in sync — a
 * provider should never end up with a service doc that isn't listed in
 * their own serviceIds array (Phase 1 left serviceIds: [] for exactly
 * this to fill in).
 *
 * MULTI_CATEGORY_SERVICES_PLAN.md Phase 1: two new optional params —
 * locationText, hasDelivery — plus the schema-level fields below
 * (interactionMode, status, dormantReason, dormantSince, coverImageUrl)
 * that every new service now gets regardless of what the caller passes.
 * The existing (type, name, description, priceNote) signature and the
 * batch/serviceIds-sync logic are unchanged — this only adds fields to
 * the same object literal and the same destructured argument, per the
 * plan's explicit instruction not to introduce a parallel function.
 */
export async function createService(providerUid, {
  type = 'salon', name, description = '', priceNote = '',
  locationText = null, hasDelivery = false,
}) {
  const batch = writeBatch(db);
  const serviceRef = doc(servicesCollectionRef());

  batch.set(serviceRef, {
    type,
    interactionMode: defaultInteractionModeForType(type),
    providerUid,
    name: String(name || '').trim(),
    description: String(description || '').trim(),
    priceNote: String(priceNote || '').trim(),
    locationText: locationText ? String(locationText).trim() : null,
    hasDelivery: Boolean(hasDelivery),
    isOpen: false, // starts closed — provider opens explicitly (§5.2)
    status: 'closed', // Phase 1: parallel higher-level bucket alongside isOpen — see plan's isOpen/status note
    dormantReason: null,
    dormantSince: null,
    coverImageUrl: null,
    offerings: [],
    revenueTotal: 0,
    createdAt: serverTimestamp(),
  });

  const providerRef = doc(db, 'providers', providerUid);
  const providerSnap = await getDoc(providerRef);
  const existingIds = providerSnap.exists() ? (providerSnap.data().serviceIds || []) : [];
  batch.update(providerRef, { serviceIds: [...existingIds, serviceRef.id] });

  await batch.commit();
  return serviceRef.id;
}

export async function getService(serviceId) {
  const snap = await getDoc(serviceDocRef(serviceId));
  return snap.exists() ? { id: serviceId, ...snap.data() } : null;
}

export function subscribeService(serviceId, callback) {
  return onSnapshot(serviceDocRef(serviceId), (snap) => {
    callback(snap.exists() ? { id: serviceId, ...snap.data() } : null);
  }, (err) => {
    console.error('[serviceSync] subscribeService error:', err);
    callback(null);
  });
}

/**
 * Live list of every non-deactivated service, for the student-facing
 * Services list (§6) — isOpen status shown first, per the spec's display
 * order. Deactivated providers' services are filtered out client-side by
 * the caller checking providers/{uid}.status, since "deactivated" lives
 * on the provider doc, not denormalized onto every service (Gap 9 keeps
 * a single source of truth rather than needing a fan-out write).
 */
export function subscribeAllServices(callback) {
  return onSnapshot(servicesCollectionRef(), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    // permission-denied here is almost always a startup race (this
    // listener attaching while auth is still anonymous/settling) rather
    // than a real access problem, since firestore.rules already allows
    // read to any isSignedIn() user. Log and fall back to an empty list
    // instead of leaving this uncaught — the Services page's own
    // loading state already handles an empty array gracefully.
    console.error('[serviceSync] subscribeAllServices error:', err);
    callback([]);
  });
}

/** Provider's own service(s) — most providers have exactly one in Phase 2, but this stays list-shaped per §2's multi-service-ready design. */
export function subscribeProviderServices(providerUid, callback) {
  return onSnapshot(
    query(servicesCollectionRef(), where('providerUid', '==', providerUid)),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[serviceSync] subscribeProviderServices error:', err);
      callback([]);
    },
  );
}

/**
 * Open/closed toggle (§5.2 — "সবচেয়ে গুরুত্বপূর্ণ, বড় সাইজে, এক ক্লিকে").
 * When closing (isOpen: false), also auto-expires every still-pending
 * booking (Gap 4) — a shop that just closed shouldn't leave students
 * stuck in a queue that will never be served today. Confirmed bookings
 * are left alone; the owner already committed to those and can still
 * complete or cancel them individually.
 */
export async function setServiceOpen(serviceId, isOpen) {
  await updateDoc(serviceDocRef(serviceId), { isOpen });
  if (!isOpen) {
    await expirePendingBookingsForClosedShop(serviceId);
  }
}

async function expirePendingBookingsForClosedShop(serviceId) {
  const snap = await getDocs(
    query(bookingsCollectionRef(serviceId), where('status', '==', 'pending')),
  );
  if (snap.empty) return;
  // Service name is read once up front (not per-booking) purely for the
  // alert message text — same batch still does the actual status writes,
  // so the alert can never land without the expiry landing too.
  const serviceSnap = await getDoc(serviceDocRef(serviceId));
  const serviceName = serviceSnap.exists() ? (serviceSnap.data().name || '') : '';

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { status: 'expired_shop_closed' });
    const booking = d.data();
    // Gap 7 marker cleanup: this booking is leaving the active
    // (pending/confirmed) state, so the student should be able to book
    // this service again — same batch as the status write, so the two
    // can never land out of sync.
    batch.delete(doc(db, 'services', serviceId, 'activeBooking', booking.studentUid));
    queueBookingAlertWrite(batch, booking.studentUid, {
      kind: 'booking_expired',
      serviceId,
      bookingId: d.id,
      serviceName,
      message: `${serviceName || 'দোকান'} বন্ধ হয়ে যাওয়ায় আপনার বুকিং বাতিল হয়ে গেছে।`,
    });
  });
  await batch.commit();
}

/**
 * PHASE 3 (closes the Gap 9 cascade flagged at the end of Phase 2):
 * forces every one of a provider's services closed and auto-expires
 * their pending bookings, exactly like a manual isOpen->false toggle
 * (setServiceOpen above) but applied to ALL of a provider's services at
 * once. Called from providerSync.js's adminDeactivateProvider() so
 * deactivation actually takes the shop off the student-facing list
 * immediately, instead of only flipping the account-level status and
 * leaving `isOpen: true` services visible and bookable in the meantime.
 * Confirmed bookings are left untouched here too, same reasoning as
 * setServiceOpen — the owner already committed to those.
 */
export async function forceCloseProviderServices(providerUid) {
  const snap = await getDocs(
    query(servicesCollectionRef(), where('providerUid', '==', providerUid)),
  );
  await Promise.all(snap.docs.map(async (d) => {
    if (d.data().isOpen) {
      await setServiceOpen(d.id, false);
    } else {
      // Already closed — still need to expire any pending bookings that
      // may have been created before this deactivation (e.g. the
      // provider had briefly reopened, or a pending booking predates
      // this call for any other reason).
      await expirePendingBookingsForClosedShop(d.id);
    }
  }));
}

/**
 * Offerings management (§5.3, Gap 5). Offerings are replaced as a whole
 * array from the provider dashboard's edit form — simplest correct
 * approach for a small, bounded list, and avoids partial-update races
 * between two fields of the same offering. Turning an offering OFF only
 * blocks NEW bookings (enforced in createBooking below); any pending or
 * confirmed booking already referencing that offeringId is untouched.
 *
 * MULTI_CATEGORY_SERVICES_PLAN.md Phase 2: also stamps a new
 * `offeringsUpdatedAt` timestamp on every call — this is what the
 * dormant-detection onSchedule function (functions/index.js) reads to
 * know how long a service's offerings have been in their current
 * all-unavailable state, per the plan's 14-day-continuous condition.
 */
export async function setServiceOfferings(serviceId, offerings) {
  await updateDoc(serviceDocRef(serviceId), { offerings, offeringsUpdatedAt: serverTimestamp() });
}

export function addOfferingId() {
  return newOfferingId();
}

/**
 * MULTI_CATEGORY_SERVICES_PLAN.md Phase 1: adds locationText, hasDelivery,
 * coverImageUrl as optional patchable fields alongside the existing three
 * — same partial-patch pattern (only touch keys that were actually
 * passed), no new function needed for the plan's location/delivery/cover
 * image inputs that Phase 3's dashboard UI will call this with.
 */
export async function updateServiceDetails(serviceId, {
  name, description, priceNote, locationText, hasDelivery, coverImageUrl,
}) {
  const patch = {};
  if (name !== undefined) patch.name = String(name).trim();
  if (description !== undefined) patch.description = String(description).trim();
  if (priceNote !== undefined) patch.priceNote = String(priceNote).trim();
  if (locationText !== undefined) patch.locationText = locationText ? String(locationText).trim() : null;
  if (hasDelivery !== undefined) patch.hasDelivery = Boolean(hasDelivery);
  if (coverImageUrl !== undefined) patch.coverImageUrl = coverImageUrl || null;
  await updateDoc(serviceDocRef(serviceId), patch);
}

/**
 * MULTI_CATEGORY_SERVICES_PLAN.md Phase 3: manual status bucket control
 * (§ "Shop status — তিন bucket + manual pause flow"). This is the one
 * writer of `status`/`dormantReason`/`dormantSince` from the owner's own
 * dashboard — the OTHER writer is functions/index.js's onSchedule
 * (Phase 2), which only ever moves 'open' -> 'dormant' with reason
 * 'auto'. Kept as a single small function (not folded into
 * updateServiceDetails) because this is a deliberate state-machine
 * transition with its own three shapes, not a free-form field patch:
 *
 *   'reactivate'      -> status: 'open' or 'closed' (whatever isOpen
 *                         currently says — see plan's isOpen/status note:
 *                         reactivating doesn't touch isOpen itself, it
 *                         only clears the dormant bucket), dormantReason/
 *                         dormantSince -> null. Only meaningful coming
 *                         from 'manual_temporary' or 'auto' — the caller
 *                         (dashboard UI) is responsible for not offering
 *                         this button when dormantReason is
 *                         'manual_permanent', but the plan doesn't ask
 *                         for a rules-level block on it either (Founder
 *                         can already do anything via isAdmin(), and nothing
 *                         in the plan says a provider reactivating their
 *                         own permanently-closed shop must be
 *                         rules-blocked, just UI-discouraged).
 *   'pause'            -> status: 'dormant', dormantReason:
 *                         'manual_temporary', dormantSince: now.
 *   'permanent_close'  -> status: 'dormant', dormantReason:
 *                         'manual_permanent', dormantSince: now.
 *
 * All three are plain isOpen-preserving status-field writes — the
 * existing services/{serviceId} update rule already allows the owning
 * provider to touch status/dormantReason/dormantSince (validated only by
 * enum, not by an explicit from-state transition list), so no rules
 * change is needed for this to work.
 */
export async function setServiceStatus(serviceId, action) {
  if (action === 'reactivate') {
    const svc = await getService(serviceId);
    const nextStatus = svc && svc.isOpen ? 'open' : 'closed';
    await updateDoc(serviceDocRef(serviceId), {
      status: nextStatus, dormantReason: null, dormantSince: null,
    });
    return;
  }
  const dormantReason = action === 'permanent_close' ? 'manual_permanent' : 'manual_temporary';
  await updateDoc(serviceDocRef(serviceId), {
    status: 'dormant', dormantReason, dormantSince: serverTimestamp(),
  });
}

/**
 * MULTI_CATEGORY_SERVICES_PLAN.md Phase 1 migration note: services created
 * before this phase won't have interactionMode/status on their doc yet.
 * Rather than a one-time backfill write, callers (Phase 4/6 UI) should
 * read services through this helper (or apply the same two defaults
 * inline) so an old salon doc silently behaves as
 * interactionMode: 'booking', status: 'open'|'closed' derived from its
 * existing isOpen — exactly the client-side default the plan specifies,
 * no migration script required.
 */
export function withServiceDefaults(service) {
  if (!service) return service;
  const interactionMode = service.interactionMode || defaultInteractionModeForType(service.type);
  const status = service.status || (service.isOpen ? 'open' : 'closed');
  return { ...service, interactionMode, status };
}

/**
 * §11 item 2 decision: a full DB-level uniqueness constraint on
 * confirmedSlot isn't practical here (Firestore has no cheap way to
 * enforce "no two bookings on this service share a {date,time}" without
 * either a transaction that reads every other confirmed booking on every
 * single confirm — expensive and still racy across two different
 * bookings being confirmed at once — or a denormalized slot-index
 * document, which is real complexity for a problem that's rare in
 * practice for a single-chair salon). Decided instead: a client-side,
 * non-blocking warning at confirm-time. The owner sees a flag and can
 * still choose to confirm anyway (e.g. two quick trims genuinely can
 * overlap, or the flagged slot is actually fine) — this is a UI nudge,
 * not an enforced invariant, which matches how habitual-no-show (item 1
 * below) is handled too: visible to the owner, not automated.
 *
 * Returns true if another CONFIRMED booking on this service already has
 * the exact same {date, time} as confirmedSlot. Only checks confirmed
 * bookings (not pending) — a pending booking hasn't been given a slot
 * yet, so there's nothing to collide with until it's confirmed.
 */
export async function hasConflictingConfirmedSlot(serviceId, confirmedSlot, excludeBookingId = null) {
  if (!confirmedSlot || !confirmedSlot.date || !confirmedSlot.time) return false;
  const snap = await getDocs(
    query(bookingsCollectionRef(serviceId), where('status', '==', 'confirmed')),
  );
  return snap.docs.some((d) => {
    if (d.id === excludeBookingId) return false;
    const slot = d.data().confirmedSlot;
    return slot && slot.date === confirmedSlot.date && slot.time === confirmedSlot.time;
  });
}

/**
 * §11 item 1 decision: in scope, kept deliberately simple — visible to
 * the owner only, no automated consequence (no booking limit, no
 * auto-block). A repeat-cancellation flag is informational context for
 * the owner's own judgment call, not a penalty this app hands down
 * unilaterally against a student's record. "No-show" specifically means
 * an owner-initiated cancel on a booking that had already reached
 * 'confirmed' (cancelledBy === 'owner' from a confirmed state, which is
 * exactly what ConfirmedList's "No-show / বাতিল" button produces) — a
 * student cancelling their own pending booking, or a shop-closed expiry,
 * is not the student's fault and must not count toward this.
 *
 * Returns the count of the given student's own past no-show-cancelled
 * bookings on this specific service (not global across all services —
 * same per-service scoping Gap 7 already uses, since a flaky pattern at
 * one shop doesn't necessarily predict behavior at another). Threshold
 * for showing a warning badge (>= 2) is decided in the dashboard UI, not
 * here — this just returns the raw count.
 */
export async function countStudentNoShowsOnService(serviceId, studentUid) {
  const snap = await getDocs(
    query(
      bookingsCollectionRef(serviceId),
      where('studentUid', '==', studentUid),
      where('status', '==', 'cancelled'),
      where('cancelledBy', '==', 'owner'),
    ),
  );
  return snap.size;
}

// ---------------------------------------------------------------------
// Bookings (student + provider)
// ---------------------------------------------------------------------

/**
 * Student creates a booking (§6) OR an inquiry
 * (MULTI_CATEGORY_SERVICES_PLAN.md Phase 2). Single entry point, branching
 * on the service's interactionMode — the plan is explicit that this stays
 * one function with an `if (interactionMode === 'inquiry')` branch rather
 * than a second parallel function, so callers (ServiceDetail.jsx in
 * Phase 4) don't need to know which mode they're in before calling.
 *
 * booking mode (interactionMode !== 'inquiry', i.e. missing/'booking'):
 * exact same behavior as before this phase — offeringId required,
 * preferredTime optional, cancelledBy/confirmedSlot present, status
 * starts 'pending'. Enforces:
 *  - the target offering is currently isAvailable (Gap 5 — closed
 *    offerings can't receive new bookings)
 *  - the student doesn't already have an active (pending/confirmed)
 *    booking on this SAME service (Gap 7 — one active booking per
 *    service, not global across all services, since a student could
 *    reasonably want a haircut AND a pending medicine order elsewhere)
 * preferredTime is optional and, when present, is always the structured
 * { date, time } shape (Gap 10) — never accepted as a free-text string.
 *
 * inquiry mode (interactionMode === 'inquiry'): no preferredTime, no
 * single offeringId — instead takes `items: [{ offeringId, label, price,
 * quantity }]` (Phase 2's multi-item shape, single-shop-scoped per the
 * plan — every item must belong to THIS service's own offerings list).
 * status starts 'open' (not 'pending'), cancelledBy/confirmedSlot are
 * omitted entirely (booking-mode-specific concepts) and replaced with
 * `replyText: null`. The same activeBooking/{studentUid} marker doc and
 * "one active interaction per shop" rule apply — the plan treats
 * booking-active and inquiry-active as the same "active" concept, scoped
 * per-service, so a student can't open a second inquiry on a shop while
 * one is still open/unanswered, same as they can't double-book.
 */
export async function createBooking(serviceId, {
  studentUid, studentName, studentPhone,
  offeringId, preferredTime = null,
  items = null, question = '',
}) {
  const serviceSnap = await getDoc(serviceDocRef(serviceId));
  if (!serviceSnap.exists()) {
    throw new Error('This service no longer exists.');
  }
  const service = serviceSnap.data();
  if (!service.isOpen) {
    throw new Error('This shop is currently closed.');
  }

  const isInquiry = service.interactionMode === 'inquiry';

  // Gap 7 / Phase 2's same-marker rule: block a second active
  // booking/inquiry by the same student on the same service, regardless
  // of mode. Read-then-write is acceptable here (not inside a
  // transaction) — a double-submit race would at worst let one extra
  // doc through in a rare edge case, which the provider can simply
  // reject/close; this isn't a correctness-critical invariant the way
  // Gap 8's double-confirm is (that one directly risks double-serving
  // the same slot with two different students).
  const activeSnap = await getDocs(
    query(
      bookingsCollectionRef(serviceId),
      where('studentUid', '==', studentUid),
      where('status', 'in', isInquiry ? ['open', 'answered'] : ['pending', 'confirmed']),
    ),
  );
  if (!activeSnap.empty) {
    const err = new Error(isInquiry
      ? 'You already have an active inquiry for this shop.'
      : 'You already have an active booking for this service.');
    err.code = 'booking/already-active';
    throw err;
  }

  const bookingRef = doc(bookingsCollectionRef(serviceId));
  const batch = writeBatch(db);

  if (isInquiry) {
    const offeringsById = new Map((service.offerings || []).map((o) => [o.id, o]));
    const normalizedItems = (Array.isArray(items) ? items : [])
      .map((item) => {
        const offering = offeringsById.get(item.offeringId);
        const quantity = Number(item.quantity);
        if (!offering || !offering.isAvailable || !(quantity > 0)) return null;
        return {
          offeringId: offering.id,
          label: offering.label,
          price: typeof offering.price === 'number' ? offering.price : null,
          quantity,
        };
      })
      .filter(Boolean);
    if (normalizedItems.length === 0) {
      throw new Error('অন্তত একটা আইটেম বেছে নিন যেটা এখন available।');
    }

    // Phase 2: inquiry doc shape — no offeringId/preferredTime/
    // cancelledBy/confirmedSlot, those are booking-mode-specific.
    // replyText starts null, filled in by answerInquiry() below.
    batch.set(bookingRef, {
      studentUid,
      studentName: String(studentName || '').trim(),
      studentPhone: String(studentPhone || '').trim(),
      items: normalizedItems,
      question: String(question || '').trim(),
      requestedAt: serverTimestamp(),
      status: 'open',
      replyText: null,
    });
    // Alert the owning provider, same batch as the create — mirrors
    // confirmBooking's same-transaction alert write, since a new
    // inquiry is exactly the kind of event the provider needs to see
    // promptly (their "Pending inquiries" queue just gained an entry).
    queueBookingAlertWrite(batch, service.providerUid, {
      kind: 'new_inquiry',
      serviceId,
      bookingId: bookingRef.id,
      serviceName: service.name || '',
      message: `${studentName || 'কেউ একজন'} ${service.name || 'আপনার শপ'}-এ নতুন প্রশ্ন/অনুরোধ পাঠিয়েছেন।`,
    });
  } else {
    const offering = (service.offerings || []).find((o) => o.id === offeringId);
    if (!offering || !offering.isAvailable) {
      throw new Error('This offering is not currently available.');
    }
    const normalizedPreferredTime = preferredTime && preferredTime.date && preferredTime.time
      ? { date: preferredTime.date, time: preferredTime.time }
      : null;

    // Gap 7 (now also enforced server-side, see firestore.rules'
    // hasNoActiveBooking()): the booking doc and its activeBooking marker
    // are written in the same batch, so a client can never end up with
    // one but not the other. The rule's `create` check on the booking
    // itself re-verifies the marker doesn't already exist, closing the
    // race the earlier read-then-write check above couldn't fully close
    // on its own — a second concurrent createBooking() call from the same
    // student now fails at the rules layer even if both calls' own
    // getDocs() check (above) raced and both saw "no active booking".
    batch.set(bookingRef, {
      studentUid,
      studentName: String(studentName || '').trim(),
      studentPhone: String(studentPhone || '').trim(),
      offeringId,
      preferredTime: normalizedPreferredTime,
      requestedAt: serverTimestamp(),
      status: 'pending',
      cancelledBy: null,
      confirmedSlot: null,
    });
  }

  // Same activeBooking marker doc for both modes — Phase 2's decision to
  // treat "active booking" and "active inquiry" as the same underlying
  // per-service-per-student concept (see function doc above).
  batch.set(doc(db, 'services', serviceId, 'activeBooking', studentUid), {});
  await batch.commit();
  return bookingRef.id;
}

/** Provider's pending queue, oldest-first (§5.1's display order). */
export function subscribePendingBookings(serviceId, callback) {
  return onSnapshot(
    query(
      bookingsCollectionRef(serviceId),
      where('status', '==', 'pending'),
      orderBy('requestedAt', 'asc'),
    ),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[serviceSync] subscribePendingBookings error:', err);
      callback([]);
    },
  );
}

/** Provider's confirmed (not yet done) bookings — needed for the "Finish" / cancel-as-no-show actions. */
export function subscribeConfirmedBookings(serviceId, callback) {
  return onSnapshot(
    query(
      bookingsCollectionRef(serviceId),
      where('status', '==', 'confirmed'),
      orderBy('requestedAt', 'asc'),
    ),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[serviceSync] subscribeConfirmedBookings error:', err);
      callback([]);
    },
  );
}

/**
 * MULTI_CATEGORY_SERVICES_PLAN.md Phase 2: provider's open (unanswered)
 * inquiries, oldest-first — the inquiry-mode equivalent of
 * subscribePendingBookings above. Phase 5's ProviderDashboard will render
 * this as the new "Pending inquiries" list when interactionMode ===
 * 'inquiry', in place of the booking-mode PendingQueue.
 */
export function subscribePendingInquiries(serviceId, callback) {
  return onSnapshot(
    query(
      bookingsCollectionRef(serviceId),
      where('status', '==', 'open'),
      orderBy('requestedAt', 'asc'),
    ),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[serviceSync] subscribePendingInquiries error:', err);
      callback([]);
    },
  );
}

/** A student's own bookings across a single service (for "my booking" status display). */
export function subscribeMyBookingsForService(serviceId, studentUid, callback) {
  return onSnapshot(
    query(bookingsCollectionRef(serviceId), where('studentUid', '==', studentUid)),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[serviceSync] subscribeMyBookingsForService error:', err);
      callback([]);
    },
  );
}

/**
 * Owner confirms a pending booking (Gap 8 — transaction-guarded against
 * a double-click or race confirming the same booking twice). The
 * transaction re-reads status inside the write; if another confirm (or
 * a shop-close auto-expire) already landed first, this throws instead of
 * silently double-confirming. confirmedSlot lets the owner offer a
 * different time than the student's preferredTime if needed (§6).
 */
export async function confirmBooking(serviceId, bookingId, confirmedSlot = null) {
  const ref = bookingDocRef(serviceId, bookingId);
  const svcRef = serviceDocRef(serviceId);
  await runTransaction(db, async (tx) => {
    // Firestore transactions require all reads before any writes, so the
    // service-name lookup (needed only for the alert message) happens
    // here alongside the booking read, not as a separate getDoc before
    // the transaction opens — that would reintroduce the exact
    // read-then-write race Gap 8 already closed.
    const [snap, svcSnap] = await Promise.all([tx.get(ref), tx.get(svcRef)]);
    if (!snap.exists()) {
      throw new Error('Booking not found.');
    }
    if (snap.data().status !== 'pending') {
      const err = new Error('This booking is no longer pending — it may have already been actioned.');
      err.code = 'booking/not-pending';
      throw err;
    }
    const normalizedSlot = confirmedSlot && confirmedSlot.date && confirmedSlot.time
      ? { date: confirmedSlot.date, time: confirmedSlot.time }
      : null;
    tx.update(ref, { status: 'confirmed', confirmedSlot: normalizedSlot });

    // §10: mark this student as having a confirmed booking with this
    // service, so providers/{uid}/contact/phone's read rule can gate on
    // it (see that rule's own comment for why a marker doc is needed
    // instead of a live query). Existence-only doc — no fields required,
    // but Firestore needs at least an empty object for set().
    tx.set(doc(db, 'services', serviceId, 'confirmedStudents', snap.data().studentUid), {});

    const serviceName = svcSnap.exists() ? (svcSnap.data().name || '') : '';
    const slotText = normalizedSlot ? ` (${normalizedSlot.date}, ${normalizedSlot.time})` : '';
    queueBookingAlertWrite(tx, snap.data().studentUid, {
      kind: 'booking_confirmed',
      serviceId,
      bookingId,
      serviceName,
      message: `${serviceName || 'আপনার বুকিং'} কনফার্ম হয়েছে${slotText}।`,
    });
  });
}

/**
 * MULTI_CATEGORY_SERVICES_PLAN.md Phase 2: owner answers an open inquiry
 * — status 'open' -> 'answered', replyText filled in. Mirrors
 * confirmBooking()'s transaction-guard pattern above (re-reads status
 * inside the transaction) so a double-click or race can't double-answer
 * the same inquiry. No revenue/confirmedSlot concept here — inquiry mode
 * never tracks revenue (§ plan decision, "কোনো revenue tracking নেই
 * inquiry-তে").
 */
export async function answerInquiry(serviceId, bookingId, replyText) {
  const ref = bookingDocRef(serviceId, bookingId);
  const svcRef = serviceDocRef(serviceId);
  await runTransaction(db, async (tx) => {
    const [snap, svcSnap] = await Promise.all([tx.get(ref), tx.get(svcRef)]);
    if (!snap.exists()) {
      throw new Error('Inquiry not found.');
    }
    if (snap.data().status !== 'open') {
      const err = new Error('This inquiry is no longer open — it may have already been answered or closed.');
      err.code = 'inquiry/not-open';
      throw err;
    }
    tx.update(ref, { status: 'answered', replyText: String(replyText || '').trim() });

    const serviceName = svcSnap.exists() ? (svcSnap.data().name || '') : '';
    queueBookingAlertWrite(tx, snap.data().studentUid, {
      kind: 'inquiry_answered',
      serviceId,
      bookingId,
      serviceName,
      message: `${serviceName || 'আপনার প্রশ্নের'} উত্তর দেওয়া হয়েছে।`,
    });
  });
}

/**
 * MULTI_CATEGORY_SERVICES_PLAN.md Phase 2: student closes their own
 * inquiry (open or answered) — status -> 'closed', and the
 * activeBooking marker is deleted so the student is free to open a new
 * inquiry on this same shop. Mirrors cancelBooking()'s activeBooking
 * cleanup below; best-effort in the same spirit — a missed marker
 * cleanup is a UX inconvenience (can't immediately reopen), not a
 * correctness or privacy issue, so it doesn't block the status write.
 */
export async function closeInquiry(serviceId, bookingId) {
  const ref = bookingDocRef(serviceId, bookingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Inquiry not found.');
  const inquiry = snap.data();
  if (inquiry.status !== 'open' && inquiry.status !== 'answered') {
    throw new Error('This inquiry can no longer be closed.');
  }
  await updateDoc(ref, { status: 'closed' });
  try {
    await deleteDoc(doc(db, 'services', serviceId, 'activeBooking', inquiry.studentUid));
  } catch (e) {
    console.error('closeInquiry: activeBooking marker cleanup failed', e);
  }
}

/**
 * Cancel a booking — works for both pending and confirmed (Gap 1, Gap 3).
 * cancelledBy records who initiated it ('student' | 'owner'), used by
 * Phase 3's alert system to notify the *other* party. Terminal states
 * (done/cancelled/expired_shop_closed) reject the cancel outright —
 * there's nothing left to cancel once a booking is already finished.
 */
export async function cancelBooking(serviceId, bookingId, cancelledBy) {
  if (cancelledBy !== 'student' && cancelledBy !== 'owner') {
    throw new Error("cancelledBy must be 'student' or 'owner'.");
  }
  const ref = bookingDocRef(serviceId, bookingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Booking not found.');
  const booking = snap.data();
  const current = booking.status;
  if (current !== 'pending' && current !== 'confirmed') {
    throw new Error('This booking can no longer be cancelled.');
  }
  const wasConfirmed = current === 'confirmed';
  await updateDoc(ref, { status: 'cancelled', cancelledBy });

  // Gap 7 marker cleanup: cancelling always ends this booking's
  // pending/confirmed run, so the student is free to book this service
  // again — clear the activeBooking marker unconditionally on cancel
  // (unlike the confirmedStudents/phone-standing marker below, which
  // only clears if no OTHER confirmed/done booking remains — Gap 7 has
  // no such "still has standing" nuance, since it's scoped to a single
  // booking's active-or-not state, not an accumulating privacy grant).
  // Best-effort: same reasoning as the alert writes further down — a
  // missed delete here just means the student can't immediately rebook
  // until it's cleaned up, a UX inconvenience, not a privacy or
  // correctness issue the way a missed confirm/status write would be.
  try {
    await deleteDoc(doc(db, 'services', serviceId, 'activeBooking', booking.studentUid));
  } catch (e) {
    console.error('cancelBooking: activeBooking marker cleanup failed', e);
  }

  // §10 marker cleanup: only relevant if the booking being cancelled was
  // itself 'confirmed' — a 'pending' cancel never had a marker written
  // (confirmBooking is the only place that writes one). Only remove the
  // marker if the student has no OTHER confirmed/done booking left on
  // this service — the marker means "has standing to see the phone
  // number", and cancelling one booking shouldn't revoke that standing
  // if another confirmed/done booking with the same provider still
  // exists. Best-effort, same reasoning as the alert writes just below —
  // a missed cleanup leaves the number visible slightly longer than
  // strictly necessary, which is a much smaller privacy concern than a
  // missed grant would be, so this never blocks the cancel itself.
  if (wasConfirmed) {
    try {
      const stillHasStanding = await getDocs(
        query(
          bookingsCollectionRef(serviceId),
          where('studentUid', '==', booking.studentUid),
          where('status', 'in', ['confirmed', 'done']),
        ),
      );
      if (stillHasStanding.empty) {
        await deleteDoc(doc(db, 'services', serviceId, 'confirmedStudents', booking.studentUid));
      }
    } catch (e) {
      console.error('cancelBooking: confirmedStudents marker cleanup failed', e);
    }
  }

  // Alert the OTHER party — not a transaction with the status update
  // above, unlike confirmBooking/expirePendingBookingsForClosedShop.
  // Those two use a transaction/batch because a lost alert there would
  // sit next to a state change with real business meaning (a slot
  // confirmed, a queue cleared) that the recipient needs to know about
  // right when it happens. A missed cancel alert is recoverable the same
  // way a missed notice already is elsewhere in this app — the booking's
  // own status (visible on both ServiceDetail.jsx and ProviderDashboard)
  // is still the source of truth, the alert is a convenience nudge on
  // top of it, not the only place the fact is recorded.
  try {
    const serviceSnap = await getDoc(serviceDocRef(serviceId));
    const serviceName = serviceSnap.exists() ? (serviceSnap.data().name || '') : '';
    if (cancelledBy === 'owner') {
      const batch = writeBatch(db);
      queueBookingAlertWrite(batch, booking.studentUid, {
        kind: 'booking_cancelled',
        serviceId,
        bookingId,
        serviceName,
        message: `${serviceName || 'আপনার বুকিং'} owner বাতিল করেছেন।`,
      });
      await batch.commit();
    } else {
      // Student cancelled -> alert the owning provider.
      const batch = writeBatch(db);
      queueBookingAlertWrite(batch, providerUidFromServiceSnap(serviceSnap), {
        kind: 'booking_cancelled',
        serviceId,
        bookingId,
        serviceName,
        message: `${booking.studentName || 'কেউ একজন'} তার বুকিং বাতিল করেছেন (${serviceName || 'সার্ভিস'})।`,
      });
      await batch.commit();
    }
  } catch (e) {
    // Best-effort — never let a failed alert write turn a successful
    // cancel into a thrown error the caller has to handle.
    console.error('cancelBooking: alert write failed', e);
  }
}

function providerUidFromServiceSnap(serviceSnap) {
  return serviceSnap.exists() ? serviceSnap.data().providerUid : null;
}

/**
 * Owner marks a confirmed booking as done (§7) — the ONLY transition
 * that adds to revenueTotal (§5.4, §2's `revenueTotal` note: "শুধু 'done'
 * booking থেকে auto যোগ হবে"). Uses a transaction so revenueTotal can
 * never be double-added if this were somehow called twice.
 */
export async function finishBooking(serviceId, bookingId, priceForRevenue = 0) {
  const bookingRef = bookingDocRef(serviceId, bookingId);
  const svcRef = serviceDocRef(serviceId);
  await runTransaction(db, async (tx) => {
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists()) throw new Error('Booking not found.');
    if (bookingSnap.data().status !== 'confirmed') {
      const err = new Error('Only a confirmed booking can be marked done.');
      err.code = 'booking/not-confirmed';
      throw err;
    }
    const svcSnap = await tx.get(svcRef);
    const currentTotal = svcSnap.exists() ? (svcSnap.data().revenueTotal || 0) : 0;
    tx.update(bookingRef, { status: 'done' });
    if (Number(priceForRevenue) > 0) {
      tx.update(svcRef, { revenueTotal: currentTotal + Number(priceForRevenue) });
    }
    // Gap 7 marker cleanup: 'done' also leaves the active
    // (pending/confirmed) state, same as a cancel — the student should
    // be free to book this service again afterward (e.g. a repeat
    // customer). Same transaction as the status/revenue write so it can
    // never land out of sync.
    tx.delete(doc(db, 'services', serviceId, 'activeBooking', bookingSnap.data().studentUid));
  });
}
