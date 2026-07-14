// facultyNoticeSync.js
//
// §8.10 of the merged prompt: faculty notices write into the SAME
// groups/{groupId}/notices collection noticeUtils.js's subscribeAllNotices
// already merges from — no new feed. Deliberately does NOT reuse
// groupSync.js's postGroupNotice() as-is, because that function hardcodes
// getIdentityStamp(profile, uid), which is roll-number-shaped (student
// identity) — the exact mismatch flagged in this module's Phase 1
// PROGRESS.md notes. Rather than force a fake roll onto a faculty stamp
// (or edit getIdentityStamp's shared shape, which is out of scope and used
// by many other student-side call sites), this file writes the doc
// directly with a faculty-shaped identity stamp and the §8.10 tags:
//   - from: 'Teacher'
//   - noticeType: 'general' | 'marks_release'
//   - targetType: 'broadcast' | 'cr_only'

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getFacultyDisplayName } from './facultyTitle';

export async function postFacultyNotice(groupId, facultyDoc, uid, { title, body, targetType = 'broadcast', noticeType = 'general', courseCode = '', courseTitle = '' }) {
  if (!groupId) throw new Error('No class group to post this notice to.');
  await addDoc(collection(db, 'groups', groupId, 'notices'), {
    title,
    body,
    // Title + name (e.g. "Prof. Rahman"), not a bare name — same
    // composition the Faculty Dashboard/Profile hero already uses, so a
    // student sees the teacher's actual designation everywhere, not just
    // on that teacher's own profile page.
    postedBy: { uid, name: getFacultyDisplayName(facultyDoc?.preferredName || facultyDoc?.name, facultyDoc?.title), roll: '' },
    from: 'Teacher',
    // courseCode/courseTitle — which specific class this notice is about,
    // so the student sees "Prof. Rahman · EE 2113" instead of a bare
    // "Teacher" label with no way to tell who or which course. Optional
    // (empty string) for call sites without a single-class context, e.g.
    // the multi-class broadcaster where each fan-out write below already
    // sets its own per-group course info.
    courseCode,
    courseTitle,
    noticeType,
    targetType,
    createdAt: serverTimestamp(),
  });
}

// Sidebar "Broadcast Notice" page — a teacher can pick several classes at
// once (unlike the single-class notice tab inside My Classes -> Class
// Detail, which is always scoped to whichever class you're already inside).
// Firestore has no cross-collection multi-write primitive here (each class's
// notices live in its own groups/{groupId}/notices subcollection), so this
// fans out to one addDoc per selected group. targetType stays 'broadcast'
// (all students of that group) or 'cr_only' (that group's CR/ACR only) —
// same per-group semantics as the single-class notice, just applied to
// every selected group in one action.
export async function postFacultyNoticeMulti(groupIds, facultyDoc, uid, { title, body, targetType = 'broadcast', noticeType = 'general', courseInfoByGroupId = {} }) {
  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    throw new Error('Select at least one class to send this notice to.');
  }
  const postedBy = { uid, name: getFacultyDisplayName(facultyDoc?.preferredName || facultyDoc?.name, facultyDoc?.title), roll: '' };
  await Promise.all(
    groupIds.map((groupId) => {
      // courseInfoByGroupId lets each selected class stamp its OWN
      // courseCode/courseTitle on its copy of the notice — same reasoning
      // as postFacultyNotice above, just per-group since one call here
      // fans out across several different classes at once.
      const info = courseInfoByGroupId[groupId] || {};
      return addDoc(collection(db, 'groups', groupId, 'notices'), {
        title,
        body,
        postedBy,
        from: 'Teacher',
        courseCode: info.courseCode || '',
        courseTitle: info.courseTitle || '',
        noticeType,
        targetType,
        createdAt: serverTimestamp(),
      });
    }),
  );
}
