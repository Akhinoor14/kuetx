// facultyMeetingSync.js
//
// CRUD + live subscription for faculty/{uid}/meetings — a faculty
// account's own list of scheduled meetings (department meetings, viva
// boards, thesis defenses, student consultations, online class links,
// etc). Deliberately a private per-faculty subcollection, same owner-only
// shape as faculty/{uid}/classIndex (see firestore.rules) — this is NOT a
// shared/group calendar, just a personal list the teacher keeps for
// themselves, so no roster/group plumbing is needed at all.
//
// Shape of a meeting doc:
//   { title, type, date ('YYYY-MM-DD'), time ('HH:MM'), location,
//     link, notes, createdAt, updatedAt }
// `type` is one of MEETING_TYPES below (used for the colored chip/icon).

import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export const MEETING_TYPES = [
  { id: 'class', label: 'Online Class', icon: 'Video', color: '#3B82F6' },
  { id: 'exam_invigilation', label: 'Exam / Invigilation', icon: 'ClipboardCheck', color: '#EF4444' },
  { id: 'department', label: 'Department Meeting', icon: 'Users', color: '#8B5CF6' },
  { id: 'academic_council', label: 'Academic Council / Syndicate', icon: 'Landmark', color: '#6366F1' },
  { id: 'viva', label: 'Viva / Defense', icon: 'GraduationCap', color: '#F59E0B' },
  { id: 'thesis_supervision', label: 'Thesis / Research Supervision', icon: 'FlaskConical', color: '#14B8A6' },
  { id: 'consultation', label: 'Student Consultation', icon: 'MessageCircle', color: '#10B981' },
  { id: 'committee', label: 'Committee / Board Meeting', icon: 'Briefcase', color: '#0EA5E9' },
  { id: 'conference', label: 'Conference / Seminar / Workshop', icon: 'Presentation', color: '#EC4899' },
  { id: 'paper_review', label: 'Paper / Grant Review', icon: 'FileSearch', color: '#A855F7' },
  { id: 'admin', label: 'Administrative Duty', icon: 'FolderKanban', color: '#D97706' },
  { id: 'training', label: 'Training / Workshop (Attending)', icon: 'BookOpenCheck', color: '#22C55E' },
  { id: 'other', label: 'Other', icon: 'Calendar', color: '#64748B' },
];

export function getMeetingTypeMeta(typeId) {
  return MEETING_TYPES.find((t) => t.id === typeId) || MEETING_TYPES[MEETING_TYPES.length - 1];
}

const meetingsRef = (uid) => collection(db, 'faculty', uid, 'meetings');
const meetingDocRef = (uid, meetingId) => doc(db, 'faculty', uid, 'meetings', meetingId);

/** Live subscription, ordered soonest-first by date then time. */
export function subscribeMyMeetings(uid, callback) {
  if (!uid) { callback([]); return () => {}; }
  const q = query(meetingsRef(uid), orderBy('date', 'asc'), orderBy('time', 'asc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => callback([]), // permission-denied / offline → empty, same pattern as subscribeMyClassIndex
  );
}

export async function createMeeting(uid, { title, type, date, time, location, link, notes }) {
  if (!uid) throw new Error('Not signed in.');
  if (!title?.trim()) throw new Error('Meeting title is required.');
  if (!date) throw new Error('Date is required.');
  await addDoc(meetingsRef(uid), {
    title: title.trim(),
    type: type || 'other',
    date,
    time: time || '',
    location: location || '',
    link: link || '',
    notes: notes || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateMeeting(uid, meetingId, patch) {
  if (!uid || !meetingId) throw new Error('Missing meeting reference.');
  await updateDoc(meetingDocRef(uid, meetingId), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteMeeting(uid, meetingId) {
  if (!uid || !meetingId) throw new Error('Missing meeting reference.');
  await deleteDoc(meetingDocRef(uid, meetingId));
}