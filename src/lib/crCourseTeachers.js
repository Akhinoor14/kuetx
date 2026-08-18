// crCourseTeachers.js
//
// CRUD + live subscription for groups/{groupId}/teacherProfiles/{teacherId}
// — "My Current Term Teachers" on /teachers (see src/pages/Teachers.jsx).
//
// PHASE 2 CORRECTION: this was originally a per-CR personal collection
// (courseTeacherLinks/{autoId}, keyed by ownerUid). The owner corrected
// this — it's class-wide shared, same authority model as the existing
// courseTeacherMap/teacherRegistry system in
// groups/{groupId}/meta/plannerSettings (CR/ACR write, every member of
// that class reads). Kept the SAME filename across this correction (a
// rename would make the diff harder to follow for a same-phase fix) —
// the file/functions now talk about "group teachers" while the filename
// still says "cr" + "course teachers"; a rename pass later is a purely
// cosmetic cleanup, not a correctness fix.
//
// This mirrors groupSync.js's addEntry/updateEntry/softDeleteEntry exactly
// (soft-delete via `deleted: true`, `updatedBy` identity stamp via
// getIdentityStamp, append-only auditLog write) — the same pattern already
// used for routineEntries/assignmentEntries. The one difference: those use
// addDoc() with an auto-generated id, but a teacherProfiles doc's id
// (teacherId) is always caller-supplied (either reused from
// teacherRegistry when the name matches an already-assigned course
// teacher, or freshly minted client-side with uid() — see Teachers.jsx),
// so create here uses setDoc() at that specific id instead of addDoc.
//
// FIELD CONTRACT (read before touching this file):
//   directoryEmail — string|null. Set when this entry is LINKED to a real
//                     facultyDirectory record; null when it's a fully
//                     freehand entry.
//   name, initial, title, honorific, dept
//                  — ONLY meaningful/stored when directoryEmail is null.
//                     When directoryEmail is set, these fields are never
//                     written here — name/dept/designation/photo are
//                     always read live from facultyDirectory (via
//                     facultyDirectoryCache.js), which is read-only for
//                     every client, including CR/ACR.
//   phone, officeRoom, rating, notes, courses
//                  — always writable by any CR/ACR of this group,
//                     regardless of match status. Shared, not
//                     per-editor — the last CR/ACR to save wins, same as
//                     every other groupSync.js entry collection.
//   deleted        — soft-delete flag. firestore.rules disallows real
//                     delete() on this collection; deleteGroupTeacher
//                     below sets deleted: true via update, same as
//                     routineEntries/assignmentEntries.
//   updatedBy      — identity stamp from getIdentityStamp(profile, uid).
//                     firestore.rules requires
//                     request.resource.data.updatedBy.uid ==
//                     request.auth.uid on every create/update.
//   createdAt, updatedAt — serverTimestamp().
//
// This file is careful to NEVER write directory-owned fields (name/
// initial/title/honorific/dept) into a doc that has directoryEmail set —
// see stripDirectoryOwnedFields() below, applied on every create/update
// so a caller accidentally passing stale form state (e.g. leftover
// `dept` from before a name was matched to a directory suggestion)
// can't silently write directory data into this doc.

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { getIdentityStamp } from './groupUtils';

const SUBCOLLECTION = 'teacherProfiles';

// Fields that only make sense for a freehand (directoryEmail == null)
// entry — never written when directoryEmail is set, since those fields
// are owned by facultyDirectory and must always be read live from there.
const DIRECTORY_OWNED_FIELDS = ['name', 'initial', 'title', 'honorific', 'dept'];

function stripDirectoryOwnedFields(fields) {
  const out = { ...fields };
  for (const key of DIRECTORY_OWNED_FIELDS) delete out[key];
  return out;
}

async function writeAuditLog(groupId, action, entryId, stamp) {
  try {
    await addDoc(collection(db, 'groups', groupId, 'auditLog'), {
      action, collection: SUBCOLLECTION, entryId, by: stamp, at: serverTimestamp(),
    });
  } catch (e) {
    // audit logging must never block the actual write from succeeding —
    // same fire-and-forget convention as groupSync.js's _writeAuditLog.
    console.warn('[crCourseTeachers] audit log write failed:', e);
  }
}

/**
 * Live-subscribe to a group's shared teacherProfiles. Every member of
 * the group (student or CR/ACR) can read this — firestore.rules'
 * isGroupMember(groupId) enforces that boundary; this file has no
 * client-side membership check of its own.
 */
export function subscribeToGroupTeachers(groupId, onChange, onError) {
  if (!groupId) {
    onChange([]);
    return () => {};
  }
  const q = query(collection(db, 'groups', groupId, SUBCOLLECTION), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onChange(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((t) => !t.deleted)
    ),
    onError
  );
}

/**
 * Create a new teacherProfiles doc at a caller-supplied teacherId (either
 * reused from teacherRegistry, or freshly minted with uid() — see
 * Teachers.jsx's resolveTeacherIdForName). Uses setDoc rather than addDoc
 * since the id is meaningful (it's the join key back to
 * courseTeacherMap/teacherRegistry) and must be caller-controlled, not
 * auto-generated.
 *
 * Callers should guard against overwriting an existing profile at this id
 * BEFORE calling this (Teachers.jsx does — see its duplicate-id check) —
 * this function does not re-check, since firestore.rules' isContentEditor
 * already allows a CR/ACR to overwrite any doc in this subcollection, so
 * an overwrite guard here would only be a UX nicety, not a security
 * boundary, and the caller is in a better position to surface that as an
 * inline error rather than a thrown exception.
 */
export async function addGroupTeacher(groupId, teacherId, profile, fields) {
  if (!groupId) throw new Error('addGroupTeacher: groupId is required');
  if (!teacherId) throw new Error('addGroupTeacher: teacherId is required');

  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);

  const normalizedDirectoryEmail = fields.directoryEmail
    ? String(fields.directoryEmail).trim().toLowerCase()
    : null;

  const payload = {
    ...fields,
    directoryEmail: normalizedDirectoryEmail,
    deleted: false,
    updatedBy: stamp,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(
    doc(db, 'groups', groupId, SUBCOLLECTION, teacherId),
    normalizedDirectoryEmail ? stripDirectoryOwnedFields(payload) : payload
  );
  await writeAuditLog(groupId, 'create', teacherId, stamp);
  return teacherId;
}

/**
 * Update an existing teacherProfiles doc. Same directory-owned-field
 * stripping as addGroupTeacher — this matters especially here since a
 * form re-submit after switching from freehand to a matched suggestion
 * (or vice versa) is exactly the case where stale fields are most likely
 * to still be sitting in local form state.
 *
 * Callers should always pass the FULL current form state (as the
 * Teachers.jsx Add/Edit form does), including `directoryEmail` — that
 * way this function can tell, for this specific call, whether the
 * resulting doc is matched or freehand and strip accordingly. If a
 * caller genuinely wants a partial update unrelated to matching, it's
 * still safe to omit `directoryEmail`; in that case no stripping is
 * applied, since we can't know the doc's matched status without an extra
 * read.
 */
export async function updateGroupTeacher(groupId, teacherId, profile, fields) {
  if (!groupId) throw new Error('updateGroupTeacher: groupId is required');
  if (!teacherId) throw new Error('updateGroupTeacher: teacherId is required');

  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);

  const directoryEmailProvided = fields.directoryEmail !== undefined;
  const normalizedDirectoryEmail = directoryEmailProvided
    ? (fields.directoryEmail ? String(fields.directoryEmail).trim().toLowerCase() : null)
    : undefined;

  const payload = {
    ...fields,
    ...(directoryEmailProvided ? { directoryEmail: normalizedDirectoryEmail } : {}),
    updatedBy: stamp,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(
    doc(db, 'groups', groupId, SUBCOLLECTION, teacherId),
    directoryEmailProvided && normalizedDirectoryEmail
      ? stripDirectoryOwnedFields(payload)
      : payload
  );
  await writeAuditLog(groupId, 'edit', teacherId, stamp);
}

/**
 * Soft-delete a teacherProfiles doc (sets deleted: true via update — same
 * convention as routineEntries/assignmentEntries; firestore.rules
 * disallows a real delete() on this subcollection). "It won't affect the
 * faculty directory" (per Teachers.jsx's confirm dialog) holds regardless
 * — this never touches facultyDirectory/facultyPublications.
 */
export async function deleteGroupTeacher(groupId, teacherId, profile) {
  if (!groupId) throw new Error('deleteGroupTeacher: groupId is required');
  if (!teacherId) throw new Error('deleteGroupTeacher: teacherId is required');

  const uid = auth.currentUser?.uid;
  const stamp = getIdentityStamp(profile, uid);

  await updateDoc(doc(db, 'groups', groupId, SUBCOLLECTION, teacherId), {
    deleted: true,
    updatedBy: stamp,
    updatedAt: serverTimestamp(),
  });
  await writeAuditLog(groupId, 'delete', teacherId, stamp);
}
