// teacherLinkRequests.js — Phase 3 of CR_TEACHER_LINKING_NOTES.md
//
// CRUD + live subscription for groups/{groupId}/teacherLinkRequests/{id}.
//
// SCOPE DECISION (see CR_TEACHER_LINKING_NOTES.md Phase 3 entry for the
// full reasoning): the notes originally planned an email-anchor flow
// (teacherProfiles.directoryEmail -> facultyDirectory -> faculty/{uid}).
// Tracing the live codebase found that flow was never actually wired to
// anything a CR sees day-to-day — the real, already-working match is
// facultyDisambiguation.js's fuzzy name match of routineEntries.teacherName
// against facultyAssignments.displayName/gridAlias, surfaced (read-only,
// no real write) by TeacherClaimBanner.jsx. Rather than build a second,
// disconnected matching system, this file gives that EXISTING match a
// real accept/decline write path instead. The directoryEmail anchor is
// not removed — it can still be layered in later as a stronger fallback
// suggestion when the name match finds nothing — but it is not the
// foundation here.
//
// IDENTITY LINK ONLY, NEVER SCHEDULE DATA: accepting a request never
// merges dayTimeSlots/time information between routineEntries and
// facultyAssignments — each keeps editing its own independently, exactly
// as before. Accepting only ever writes two new fields onto the
// routineEntries doc: linkedFacultyUid, linkedAssignmentId. See
// applyLinkAfterAccept() below, which is the ONLY function in this file
// that touches routineEntries — everything else here only touches
// teacherLinkRequests.
//
// TWO DIRECTIONS, ONE COLLECTION (see firestore.rules' comment on this
// collection for the authority rules):
//   cr_to_teacher — CR/ACR invites a specific verified faculty account
//     (createInviteFromCr). Accepted/declined by that faculty account.
//   teacher_to_cr — a verified faculty account proposes linking their own
//     assignment to a matching routineEntry (createProposalFromTeacher).
//     Accepted/declined by any CR/ACR of the group (first to act wins —
//     see acceptRequest's status guard, mirrored in firestore.rules).
//
// Declining changes nothing else — the routineEntry's free-text
// teacherName keeps working exactly as it did before, matching §4's
// "convenience, not a gate" principle already used elsewhere in this
// module (facultyDisambiguation.js, joinFacultyAssignment's consent
// gate).

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { getIdentityStamp } from './groupUtils';

const SUBCOLLECTION = 'teacherLinkRequests';

function requestsCollection(groupId) {
  return collection(db, 'groups', groupId, SUBCOLLECTION);
}

/**
 * CR/ACR side: invite a specific verified faculty account to link, after
 * facultyDisambiguation.js has already found the match (this function
 * does not re-match — pass the assignmentId/targetFacultyUid it already
 * resolved). One pending cr_to_teacher request per (entryId,
 * targetFacultyUid) is the caller's responsibility to avoid duplicating —
 * see subscribeLinkRequests to check for an existing pending one first.
 *
 * @param {string} groupId
 * @param {object} profile - current user's profile, for the identity stamp
 * @param {{ entryId: string, teacherName: string, targetFacultyUid: string, assignmentId: string, courseCode?: string }} details
 */
export async function createInviteFromCr(groupId, profile, details) {
  if (!groupId) throw new Error('createInviteFromCr: groupId is required');
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('createInviteFromCr: must be signed in');
  const { entryId, teacherName, targetFacultyUid, assignmentId, courseCode } = details;
  if (!entryId || !targetFacultyUid || !assignmentId) {
    throw new Error('createInviteFromCr: entryId, targetFacultyUid, and assignmentId are required');
  }

  const stamp = getIdentityStamp(profile, uid);

  await addDoc(requestsCollection(groupId), {
    direction: 'cr_to_teacher',
    initiatedBy: uid,
    initiatedByName: stamp.name,
    targetFacultyUid,
    entryId,
    teacherName: teacherName || '',
    assignmentId,
    courseCode: courseCode || null,
    status: 'pending',
    createdAt: serverTimestamp(),
    resolvedAt: null,
    resolvedBy: null,
  });
}

/**
 * Faculty side: propose linking an assignment the teacher already
 * created/joined to a matching routineEntry the CR maintains. Caller
 * (Phase 3's "Teacher -> CR reverse flow" UI, not yet built) is
 * responsible for finding the matching entryId first (mirrors
 * facultyDisambiguation.js's matching, run in the other direction).
 *
 * @param {string} groupId
 * @param {{ entryId: string, assignmentId: string, courseCode?: string }} details
 */
export async function createProposalFromTeacher(groupId, details) {
  if (!groupId) throw new Error('createProposalFromTeacher: groupId is required');
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('createProposalFromTeacher: must be signed in');
  const { entryId, assignmentId, courseCode } = details;
  if (!entryId || !assignmentId) {
    throw new Error('createProposalFromTeacher: entryId and assignmentId are required');
  }

  await addDoc(requestsCollection(groupId), {
    direction: 'teacher_to_cr',
    initiatedBy: uid,
    initiatedByName: null, // faculty display name isn't stamped client-side elsewhere in this module either (see facultyClassSync.js) — left for a future profile-name backfill, not required for the accept/decline flow to work
    targetFacultyUid: uid, // same account either accepts nothing (CR side accepts) — kept for read-rule symmetry with cr_to_teacher, not used to gate here
    entryId,
    assignmentId,
    courseCode: courseCode || null,
    status: 'pending',
    createdAt: serverTimestamp(),
    resolvedAt: null,
    resolvedBy: null,
  });
}

/**
 * Live-subscribe to a group's pending link requests, both directions.
 * Caller filters by direction/uid as needed for its own UI (e.g. a CR
 * page wants pending teacher_to_cr ones; a faculty page wants pending
 * cr_to_teacher ones targeting its own uid).
 */
export function subscribePendingLinkRequests(groupId, onChange, onError) {
  if (!groupId) {
    onChange([]);
    return () => {};
  }
  const q = query(requestsCollection(groupId), where('status', '==', 'pending'));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

/**
 * PHASE 4 (§6/§12 Phase 4's "decline-permanent-naki-retry" decision,
 * resolved as "manual only"): a passive auto-suggest UI (TeacherClaimBanner
 * matches, FacultyClassDetail's "Link to CR's grid" card) should NOT keep
 * re-offering a pair someone already declined — but declining never
 * blocks a deliberate, manual re-invite/re-propose from either side
 * later (matching this whole feature's "convenience, not a gate"
 * principle — see facultyDisambiguation.js/joinFacultyAssignment). This
 * queries for any declined doc matching (entryId, direction) and returns
 * true if one exists, so passive-suggestion callers can filter it out of
 * their auto-shown matches while leaving any explicit "invite"/"propose"
 * action fully available regardless.
 *
 * One-shot (not a subscription) — callers run this alongside their
 * existing match-finding effect, not on every render.
 */
export async function wasDeclinedFor(groupId, entryId, direction) {
  if (!groupId || !entryId) return false;
  const q = query(
    requestsCollection(groupId),
    where('entryId', '==', entryId),
    where('direction', '==', direction),
    where('status', '==', 'declined'),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * Accept a pending request. Only flips status/resolvedAt/resolvedBy here
 * — firestore.rules enforces who's allowed to call this for a given
 * request's direction (target faculty for cr_to_teacher, any CR/ACR for
 * teacher_to_cr). Does NOT itself write the identity link onto
 * routineEntries — call applyLinkAfterAccept() next (see that function's
 * own doc comment for why this is a deliberately separate call).
 *
 * PHASE 4 (§6/§12 Phase 4's "multi-CR conflict" decision, resolved):
 * getGroupId() already folds `section` into groupId for every
 * multi-section department (CE/EEE/ME/CSE) — see groupUtils.js — so two
 * CRs of different sections are already in different `groups/{groupId}`
 * docs and can never both see the same teacherLinkRequests doc to begin
 * with. The only real multi-CR conflict is multiple CR/ACR of the SAME
 * section/group racing to accept the SAME teacher_to_cr proposal (or,
 * symmetrically, a teacher having sent more than one cr_to_teacher-
 * targeted... no, that direction only ever has one target anyway). After
 * this accept succeeds, best-effort withdraw any OTHER still-pending
 * request for the same entryId+direction so a second CR doesn't act on a
 * now-stale one. Best-effort and non-blocking: if this cleanup step
 * fails (e.g. a race where another CR already resolved it), the accept
 * itself has already succeeded and this function still returns
 * successfully — a stray already-resolved sibling doc is harmless, it
 * just sits there until Phase 5's regression pass or a future cleanup.
 */
export async function acceptRequest(groupId, requestId) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('acceptRequest: must be signed in');
  const ref = doc(db, 'groups', groupId, SUBCOLLECTION, requestId);
  await updateDoc(ref, {
    status: 'accepted',
    resolvedAt: serverTimestamp(),
    resolvedBy: uid,
  });

  try {
    const snap = await getDocs(requestsCollection(groupId));
    const accepted = snap.docs.find((d) => d.id === requestId)?.data();
    if (!accepted) return;
    const siblings = snap.docs.filter((d) =>
      d.id !== requestId
      && d.data().status === 'pending'
      && d.data().direction === accepted.direction
      && d.data().entryId === accepted.entryId
    );
    await Promise.all(siblings.map((d) =>
      updateDoc(doc(db, 'groups', groupId, SUBCOLLECTION, d.id), {
        status: 'declined',
        resolvedAt: serverTimestamp(),
        resolvedBy: uid,
      }).catch((e) => {
        // Non-fatal — see doc comment above.
        console.warn('[teacherLinkRequests] sibling auto-withdraw failed for', d.id, e);
      })
    ));
  } catch (e) {
    console.warn('[teacherLinkRequests] sibling auto-withdraw lookup failed:', e);
  }
}

/**
 * Decline a pending request. Nothing else changes — the routineEntry's
 * free-text teacherName keeps working exactly as before.
 */
export async function declineRequest(groupId, requestId) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('declineRequest: must be signed in');
  await updateDoc(doc(db, 'groups', groupId, SUBCOLLECTION, requestId), {
    status: 'declined',
    resolvedAt: serverTimestamp(),
    resolvedBy: uid,
  });
}

/** Withdraw your own still-pending request (either direction). */
export async function withdrawRequest(groupId, requestId) {
  await deleteDoc(doc(db, 'groups', groupId, SUBCOLLECTION, requestId));
}

/**
 * CR/ACR side, called after acceptRequest() resolves an accepted
 * cr_to_teacher or teacher_to_cr request: writes the identity pointer
 * (linkedFacultyUid/linkedAssignmentId) onto the routineEntries doc.
 * Deliberately a SEPARATE write/call from acceptRequest — firestore.rules
 * gates "who can flip a request's status" (either side, depending on
 * direction) and "who can edit a routineEntry" (isContentEditor(groupId)
 * — CR/ACR/CL/Admin only) as two independent permissions; a faculty
 * account accepting a cr_to_teacher invite can flip the request's status
 * but can never itself write to routineEntries. So for a cr_to_teacher
 * accept, the CR's own client (subscribed to this group's requests) is
 * what notices the acceptance and calls this. For a teacher_to_cr accept,
 * the accepting CR's client already has both pieces of info and can call
 * this immediately after acceptRequest() in the same action.
 *
 * Never writes/touches dayTimeSlots or any time-related field — see this
 * file's header.
 */
export async function applyLinkAfterAccept(groupId, profile, { entryId, linkedFacultyUid, linkedAssignmentId }) {
  if (!groupId || !entryId) throw new Error('applyLinkAfterAccept: groupId and entryId are required');
  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);
  await updateDoc(doc(db, 'groups', groupId, 'routineEntries', entryId), {
    linkedFacultyUid: linkedFacultyUid || null,
    linkedAssignmentId: linkedAssignmentId || null,
    updatedBy: stamp,
    updatedAt: serverTimestamp(),
  });
}
