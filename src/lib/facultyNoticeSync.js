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

export async function postFacultyNotice(groupId, facultyDoc, uid, { title, body, targetType = 'broadcast', noticeType = 'general' }) {
  if (!groupId) throw new Error('No class group to post this notice to.');
  await addDoc(collection(db, 'groups', groupId, 'notices'), {
    title,
    body,
    postedBy: { uid, name: facultyDoc?.preferredName || facultyDoc?.name || 'Faculty', roll: '' },
    from: 'Teacher',
    noticeType,
    targetType,
    createdAt: serverTimestamp(),
  });
}
