import { doc, setDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { store } from '../store/store';
import { db } from './firebase';
import { subscribeGlobalNotices, subscribeGroupNotices, noticeAppliesTo } from './groupSync';

/**
 * Notice system — separate from Alerts (lib/alertUtils.js).
 *
 * Alerts = academic signals computed from the student's own data
 * (attendance shortage, assignment deadlines, results, term-planner
 * flags). Lives under Academic Core now.
 *
 * Notice = a universal inbox for things OTHER people/systems push to the
 * student: admin broadcasts, CR/ACR announcements, Campus Lead / SCL
 * messages, anything cross-cutting that isn't tied to one specific
 * academic module. Lives behind the top-bar bell icon.
 *
 * Two real sources feed this now, both live via Firestore onSnapshot:
 *   (a) global admin broadcasts — root `notices` collection, filtered
 *       per-user client-side via noticeAppliesTo(notice, profile, groupId)
 *       (audience: {type:'all'|'batch'|'group'})
 *   (b) group-level CR/ACR notices — groups/{groupId}/notices
 * subscribeAllNotices() merges both into one live, sorted list. Use this
 * instead of the old synchronous getNotices() wherever possible.
 *
 * Expected shape, per notice:
 *   {
 *     id: string,          // stable unique id
 *     title: string,
 *     body: string,
 *     from: string,        // 'Admin' or 'CR'
 *     link: string | null, // optional deep link
 *     createdAt: number,   // epoch ms (converted from Firestore Timestamp)
 *   }
 */

export const NOTICE_READ_KEY = 'noticeReadIds_v1';

// Group-notice audience split. The SAME raw groups/{groupId}/notices
// collection now holds both CR/ACR-authored notices and Teacher-authored
// notices (from: 'Teacher', written by facultyNoticeSync.js). Student-side
// surfaces see everything meant for students EXCEPT a Teacher's cr_only
// notice, which is hidden entirely from any viewer who isn't CR/ACR in
// this group — not just visually de-emphasized, genuinely filtered out,
// since a cr_only notice is meant for the CR/ACR only. The Faculty
// sent-history surface sees ONLY the signed-in teacher's own posted
// notices (isViewerCR is irrelevant there).
export function filterStudentFacingNotices(notices, isViewerCR = false) {
  return notices.filter((n) => {
    if (n.from !== 'Teacher') return true; // CR/ACR/Admin notices: always visible to students
    if (n.targetType !== 'cr_only') return true; // Teacher broadcast: visible to all
    return isViewerCR; // Teacher cr_only: visible only to CR/ACR viewers
  });
}

// BUGFIX: this used to only check `n.from === 'Teacher'` — meaning ANY
// faculty subscribed to a group's notices (which happens for every
// teacher who has an active class assignment to that dept+batch, since
// groupId is derived from dept+batch alone, not per-course/per-teacher —
// see facultyClassSync.js's getGroupId) saw every OTHER teacher's
// Teacher-authored notices in that same group too, including cr_only
// ones meant for a different teacher's specific CR/ACR pick. Now also
// requires the notice's postedBy.uid to match the viewing faculty's own
// uid — each teacher only ever sees their own sent notices in this feed.
export function filterFacultyFacingNotices(notices, viewerUid = null) {
  return notices.filter((n) => n.from === 'Teacher' && (!viewerUid || n.postedBy?.uid === viewerUid));
}

function toMillis(createdAt) {
  // Firestore Timestamp (serverTimestamp()) has .toMillis(); guard for the
  // brief window right after a write where local cache may not have
  // resolved the server value yet (serverTimestamp() placeholder is null).
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (typeof createdAt === 'number') return createdAt;
  return 0;
}

/**
 * Live/reactive notice feed. Subscribes to both global (admin) and
 * group (CR/ACR) notices, merges, de-dupes by id, sorts newest-first,
 * and calls back with the combined array on every change from either
 * source. Returns a single combined unsubscribe function.
 *
 * opts.isViewerCR (student audience only): whether the signed-in viewer
 * holds 'cr'/'acr' role in this group — determines whether a Teacher's
 * cr_only notice is included. Callers that already know this synchronously
 * (e.g. a component with its own live role subscription) can pass it in
 * directly; if omitted, cr_only notices are hidden by default (safer to
 * under- than over-expose a CR-only notice).
 */
export function subscribeAllNotices(profile, groupId, callback, audience = 'student', opts = {}) {
  let globalList = [];
  let groupList = [];
  const isViewerCR = !!opts.isViewerCR;

  const applyAudienceFilter = (list) => (
    audience === 'faculty' ? filterFacultyFacingNotices(list, opts.viewerUid) : filterStudentFacingNotices(list, isViewerCR)
  );

  const emit = () => {
    const merged = [...globalList, ...applyAudienceFilter(groupList)];
    const seen = new Set();
    const deduped = [];
    for (const n of merged) {
      if (seen.has(n.id)) continue;
      // Phase 2 of the Notice upgrade: soft-deleted notices (deleted:
      // true) are hidden from every feed that goes through here — the
      // sender's OWN "sent notices" list uses subscribeGroupNotices/
      // subscribeGlobalNotices directly (not this merged feed) so it can
      // still show a "Deleted" tag as an audit trail; see
      // NoticeInsightsPanel / ClassRoster / FacultyNoticeBroadcast /
      // AdminDashboard's sent-notices sections.
      if (n.deleted) continue;
      seen.add(n.id);
      deduped.push(n);
    }
    deduped.sort((a, b) => b.createdAt - a.createdAt);
    callback(deduped);
  };

  // Global (admin) broadcasts are a student-facing concept only.
  const unsubGlobal = audience === 'faculty'
    ? () => {}
    : subscribeGlobalNotices((notices) => {
        // Handoff item 2: opts.uid (current signed-in student's uid) is
        // threaded through to noticeAppliesTo so a student_uids-targeted
        // notice is actually SHOWN to its target — the firestore.rules
        // fix already makes it READABLE (the real privacy boundary), but
        // without this the client-side filter here would silently drop it
        // for everyone, target included, since noticeAppliesTo's default
        // uid=null never matches a student_uids audience.
        globalList = notices
          .filter((n) => noticeAppliesTo(n, profile, groupId, opts.uid))
          .map((n) => {
            const isFounder = n.createdBy?.name === 'Founder';
            return {
              ...n,
              from: isFounder ? 'Founder' : (n.createdBy?.name || 'Admin'),
              roleTag: isFounder ? 'Founder' : 'Admin',
              isFounder,
              section: 'admin',
              createdAt: toMillis(n.createdAt),
              // "Just for you" tag: only meaningful on the student-facing
              // branch, and only for the individually-targeted audience
              // type (student_uids) — 'batch'/'group'/'all' are
              // population-level, not personal, even though they're also
              // narrowed client-side by noticeAppliesTo(). Faculty-side
              // personal tagging (faculty_uids) is handled separately in
              // subscribeFacultyGlobalNotices (groupSync.js), since that's
              // a different code path entirely.
              isPersonal: n.audience?.type === 'student_uids',
            };
          });
        emit();
      });

  const unsubGroup = groupId
    ? subscribeGroupNotices(groupId, (notices) => {
        groupList = notices.map((n) => ({
          ...n,
          // BUGFIX: this used to be `n.from || n.postedBy?.name || 'CR'` —
          // since faculty notices always stamp the literal string
          // from: 'Teacher', that check short-circuited BEFORE ever
          // looking at postedBy.name, so the real teacher's name (already
          // saved on every notice doc) never actually reached the UI.
          // Prefer the real name first; fall back to the generic role tag
          // only when no name was stored at all.
          from: n.postedBy?.name || n.from || 'CR',
          // Keep the raw role tag separately too — the notice card uses
          // this to decide between a "Teacher" vs "CR" badge/icon without
          // re-deriving it from the (now name-first) `from` field.
          roleTag: n.from || 'CR',
          isFounder: false,
          section: 'class',
          createdAt: toMillis(n.createdAt),
          // Phase 2 of the Notice upgrade: stamp the owning groupId onto
          // every group notice item. subscribeGroupNotices() is already
          // scoped to one groupId, but that id was never attached to the
          // mapped object itself — callers that merge notices from
          // several groups at once (e.g. FacultyNoticeBroadcast.jsx,
          // which subscribes per taught-class and flattens the results)
          // had no way to tell which group a given notice belonged to
          // afterward. Needed for building the reads-subcollection path
          // (subscribeNoticeReadStats) and the soft-delete call
          // (deleteNoticeSoft) from a flat, already-merged notice list.
          groupId,
        }));
        emit();
      })
    : () => {};

  return () => {
    unsubGlobal();
    unsubGroup();
  };
}

// Kept for backward compatibility — old synchronous callers (none left
// in this codebase as of this wiring) get an empty list rather than a
// crash. Prefer subscribeAllNotices for anything new.
export const getNotices = () => {
  return [];
};

export const getReadNoticeIds = () => {
  const saved = store.get(NOTICE_READ_KEY);
  return new Set(Array.isArray(saved) ? saved : []);
};

export const setNoticeRead = (id, read = true) => {
  if (!id) return;
  const saved = store.get(NOTICE_READ_KEY);
  const next = new Set(Array.isArray(saved) ? saved : []);
  if (read) next.add(id);
  else next.delete(id);
  store.set(NOTICE_READ_KEY, [...next]);

  try {
    window.dispatchEvent(new Event('kuetx:store-updated'));
  } catch {}
};

export const getUnreadNotices = (notices, readIds) =>
  notices.filter(n => !readIds.has(n.id));

// Phase 6 of the Notice upgrade: PER-DEVICE local "have I acknowledged
// this" tracking, same localStorage pattern as NOTICE_READ_KEY above —
// needed because a reader has no read access to their OWN reads/{uid}
// doc back out of Firestore (see the reads/{uid} rules: only the
// notice's sender/CL/Admin can READ that subcollection; a reader can
// only WRITE their own doc, never read it back). Without this local
// mirror, NoticeCard's "✅ Got it" button would have no way to know
// whether IT should currently render as pressed after a page reload.
export const ACKNOWLEDGED_NOTICE_KEY = 'noticeAckIds_v1';

export const getAcknowledgedNoticeIds = () => {
  const saved = store.get(ACKNOWLEDGED_NOTICE_KEY);
  return new Set(Array.isArray(saved) ? saved : []);
};

export const setNoticeAcknowledgedLocal = (id, acknowledged = true) => {
  if (!id) return;
  const saved = store.get(ACKNOWLEDGED_NOTICE_KEY);
  const next = new Set(Array.isArray(saved) ? saved : []);
  if (acknowledged) next.add(id);
  else next.delete(id);
  store.set(ACKNOWLEDGED_NOTICE_KEY, [...next]);

  try {
    window.dispatchEvent(new Event('kuetx:store-updated'));
  } catch {}
};

// ---------------------------------------------------------------------
// Read-receipts (Phase 0 of the Notice upgrade — Firestore migration)
// ---------------------------------------------------------------------
//
// getReadNoticeIds()/setNoticeRead() above are PER-DEVICE (localStorage
// key noticeReadIds_v1) and never sync to the cloud — a sender can never
// know who actually read a notice, because that state is stuck on each
// reader's own device. The functions below add a real Firestore
// read-receipt doc per (notice, reader), so a sender-side "who has read
// this" view becomes possible (see NoticeInsightsPanel, Phase 2).
//
// Doc path:
//   global notice:  notices/{noticeId}/reads/{uid}
//   group notice:   groups/{groupId}/notices/{noticeId}/reads/{uid}
// Doc id is the reader's own uid — a person reads a notice once, so a
// second call just re-sets (merge:true) the same doc rather than
// creating a duplicate.
//
// This is ADDITIVE, not a replacement: callers should keep calling the
// existing setNoticeRead() too (see Notice.jsx's markRead()), so the
// unread-dot / localStorage-based UI keeps working exactly as before,
// offline included. markNoticeReadInFirestore() below is best-effort —
// if it fails (e.g. offline, or a permission edge case), the read is
// still recorded locally by the existing local call and the UI does not
// break.

/**
 * Build the Firestore doc ref for a notice's reads/{uid} subcollection
 * doc. Pass groupId for a group (CR/ACR/Teacher) notice, or null/undefined
 * for a root/global (Admin/Founder) notice.
 */
export function getNoticeReadsCollection(noticeId, groupId = null) {
  return groupId
    ? collection(db, 'groups', groupId, 'notices', noticeId, 'reads')
    : collection(db, 'notices', noticeId, 'reads');
}

/**
 * Mark a notice as read for the current user in Firestore (in addition
 * to, not instead of, the existing local setNoticeRead() call). Safe to
 * call every time a notice is opened — merge:true means re-marking an
 * already-read notice just refreshes readAt rather than erroring or
 * duplicating.
 *
 * @param {string} noticeId
 * @param {string|null} groupId - null/undefined for a global notice
 * @param {{name?: string, studentId?: string}} profile - used for the
 *   reader's display name/roll shown in the sender's Insights panel
 * @param {string} uid - current user's uid
 */
export async function markNoticeReadInFirestore(noticeId, groupId, profile, uid) {
  if (!noticeId || !uid) return;
  try {
    const readsCollection = getNoticeReadsCollection(noticeId, groupId);
    await setDoc(doc(readsCollection, uid), {
      uid,
      name: profile?.name || 'Unknown',
      roll: profile?.studentId || '',
      readAt: serverTimestamp(),
    }, { merge: true });
  } catch {
    // Best-effort — local read state (setNoticeRead) already covers the
    // unread-dot UI even if this write fails (offline, rules edge case).
  }
}

/**
 * Live-subscribe to a single notice's read receipts. Only useful for the
 * SENDER of the notice (or Admin/CL) — Firestore rules restrict read
 * access on reads/{uid} accordingly, so calling this as a non-sender
 * will error/return nothing.
 *
 * callback is called with { count, acknowledgedCount, readers } on every
 * change, where readers is [{ uid, name, roll, readAt, acknowledged,
 * acknowledgedAt }], readAt/acknowledgedAt as epoch ms (acknowledgedAt is
 * 0 if never acknowledged).
 *
 * Phase 6 of the Notice upgrade: acknowledgedCount is a SUBSET of count,
 * not a separate population — a reader can only acknowledge a notice
 * they've already read (see acknowledgeNoticeInFirestore below, which
 * merge-writes onto the same reads/{uid} doc rather than a new
 * sub-collection, extending Phase 0's shape rather than replacing it).
 *
 * @param {string} noticeId
 * @param {string|null} groupId - null/undefined for a global notice
 * @param {(stats: {count: number, acknowledgedCount: number, readers: Array}) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeNoticeReadStats(noticeId, groupId, callback) {
  if (!noticeId) return () => {};
  const readsCollection = getNoticeReadsCollection(noticeId, groupId);
  return onSnapshot(readsCollection, (snap) => {
    const readers = snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: data.uid || d.id,
        name: data.name || 'Unknown',
        roll: data.roll || '',
        readAt: toMillis(data.readAt),
        acknowledged: data.acknowledged === true,
        acknowledgedAt: toMillis(data.acknowledgedAt),
      };
    });
    readers.sort((a, b) => b.readAt - a.readAt);
    const acknowledgedCount = readers.filter((r) => r.acknowledged).length;
    callback({ count: readers.length, acknowledgedCount, readers });
  }, () => {
    // Permission-denied (non-sender) or offline — fail quietly, same
    // spirit as the rest of this file's best-effort error handling.
    callback({ count: 0, acknowledgedCount: 0, readers: [] });
  });
}

/**
 * Mark a notice as acknowledged ("✅ Got it") for the current user in
 * Firestore. Phase 6 of the Notice upgrade — extends the SAME reads/{uid}
 * doc Phase 0 already writes (markNoticeReadInFirestore), rather than a
 * new sub-collection: a person can only acknowledge a notice after
 * they've opened it, so the read doc already exists (or this call's own
 * merge:true creates it) by the time this fires. Safe to call more than
 * once — merge:true just refreshes acknowledgedAt.
 *
 * Callers should already gate WHEN this button is shown (CR/Teacher
 * class notices only, not Admin broadcasts — see the spec's reasoning:
 * Admin audience is much bigger, acknowledge is less useful there); this
 * function itself doesn't enforce that, it just performs the write.
 *
 * @param {string} noticeId
 * @param {string|null} groupId - null/undefined for a global notice
 * @param {{name?: string, studentId?: string}} profile
 * @param {string} uid
 */
export async function acknowledgeNoticeInFirestore(noticeId, groupId, profile, uid) {
  if (!noticeId || !uid) return;
  try {
    const readsCollection = getNoticeReadsCollection(noticeId, groupId);
    await setDoc(doc(readsCollection, uid), {
      uid,
      name: profile?.name || 'Unknown',
      roll: profile?.studentId || '',
      acknowledged: true,
      acknowledgedAt: serverTimestamp(),
    }, { merge: true });
  } catch {
    // Best-effort, same spirit as markNoticeReadInFirestore — a failed
    // write here shouldn't crash the "Got it" button; the UI can retry
    // on next click since this is idempotent (merge:true).
  }
}

// ---------------------------------------------------------------------
// Manage / soft-delete (Phase 2 of the Notice upgrade)
// ---------------------------------------------------------------------

/**
 * Soft-delete a notice. Merge-updates `deleted: true` on the notice doc
 * rather than a hard delete — keeps the doc (and its reads/{uid}
 * subcollection, any audit-log references) intact, so a sender's own
 * "Sent notices" list can still show a "Deleted" tag as an audit trail
 * (see ClassRoster.jsx / FacultyNoticeBroadcast.jsx / AdminDashboard.jsx).
 * subscribeAllNotices()'s emit() filters deleted:true out of every
 * OTHER feed (the student-facing view), so a soft-deleted notice
 * disappears from the normal inbox immediately.
 *
 * Callers should already have confirmed the signed-in user is allowed to
 * do this in the UI — firestore.rules independently enforces the real
 * permission check regardless (CR/ACR/CL/Admin for a group notice,
 * matching postedBy.uid for a Teacher notice, Admin/HeadOfOps for a
 * root/global notice), so this call simply fails if the rule denies it.
 *
 * @param {string} noticeId
 * @param {string|null} groupId - null/undefined for a global/root notice
 */
export async function deleteNoticeSoft(noticeId, groupId = null) {
  if (!noticeId) return;
  const ref = groupId
    ? doc(db, 'groups', groupId, 'notices', noticeId)
    : doc(db, 'notices', noticeId);
  await setDoc(ref, { deleted: true }, { merge: true });
}
