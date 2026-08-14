// demoWorld.js — cross-role demo dataset for the Phase A landing page's
// role demos (DEMO_MODE_FULL_PLAN_PROMPT.md Phase C onward).
//
// Per Phase 0's Findings #3 ("guestDemoData.js migrate/extend/replace
// সিদ্ধান্ত"): this file EXTENDS guestDemoData.js by importing its
// student-side values rather than duplicating them — guestDemoData.js
// stays the base and is still consumed as-is by the old /guest/* pages
// (GuestDashboard.jsx etc.), which are not touched here.
//
// Shape note (Phase C finding): GUEST_ATTENDANCE/GUEST_SCHEDULE's shapes
// were built for the OLD hand-written /guest/* pages, not for the real,
// now-shared AttendanceHero/StatCard components extracted in Phase B.
// Those components expect store.js-shaped props (combinedMode +
// combinedData keyed `${courseId}_${teacherName}`, and a flat schedule
// array with courseId/teacherName per slot) — reshaping GUEST_ATTENDANCE
// itself was avoided (would risk the old guest pages) so the
// combinedMode-shaped data below is new, purpose-built for the shared
// components, computed FROM the same underlying present/total numbers
// GUEST_ATTENDANCE already has (so the two stay consistent — no invented
// figures).
//
// ⚠️ Phase D reconciliation note: this file's first version (written
// during Phase C, before Phase F's schema draft further down in this
// plan-prompt had been re-read) invented a single fabricated
// `DEMO_TEACHER = { name: 'Dr. Demo Rahman' }` shared across every
// course. That diverged from two things already in the codebase: (a)
// GUEST_COURSES already has a real per-course `teacher` field with 5
// distinct names ('Demo Teacher 1'..'5'), and (b) the plan's own Phase F
// draft schema names the canonical faculty-demo persona
// `Dr. Kamal Hossain` with `id: 'demo-teacher-1'`. Reconciled below at
// the start of Phase D — DEMO_TEACHERS now derives one entry per course
// from GUEST_COURSES.teacher (so student-side course→teacher mapping
// still matches what GUEST_COURSES already said), and the faculty demo's
// own persona (the teacher whose classes THEY see) is pinned to
// `demo-teacher-1` / 'Dr. Kamal Hossain', teaching the first two courses
// (CSE 2101, CSE 2103) per the plan's schema
// (`DEMO_TEACHER.courses: ['CSE 2101', 'CSE 2103']`). Any code written in
// the Phase C pass that referenced the old singular DEMO_TEACHER has been
// updated in this same pass — see StudentDemoDashboard.jsx.

import {
  GUEST_PROFILE, GUEST_COURSES, GUEST_ATTENDANCE, GUEST_MARKS,
  GUEST_SCHEDULE, GUEST_NOTICES,
} from './guestDemoData';

// ─── Student ────────────────────────────────────────────────────────────
// demo-std-1 is deliberately consistent with GUEST_PROFILE (same
// roll-pattern family, 2307xxx) per Phase 0 Finding #3. Matches Phase F's
// draft schema's primary persona id.
//
// Phase F.5: the master plan-prompt's own Phase F draft schema (§"Demo
// World Schema") names THREE students, not one — demo-std-1 (Rafiul,
// primary persona/CR), demo-std-2 (Nusrat Jahan), demo-std-3 (Tanvir
// Ahmed). Only demo-std-1 had been added through Phase F.3. Added the
// other two here with the exact names/rolls the schema specifies, so
// DEMO_BOOKING's "Tanvir Ahmed" entry (previously an unlinked plain
// string, see Phase F.1 comment on DEMO_BOOKING below) can now be a real
// id reference too — the schema's own example order
// (`studentId: 'demo-std-1'`) is exactly this pattern applied to a
// different role pair (order, not booking, but same linking principle).
export const DEMO_STUDENTS = [
  {
    id: 'demo-std-1',
    ...GUEST_PROFILE,
    name: 'Rafiul Islam', // Phase F draft schema's named primary persona
    studentId: '2307001',
    isCR: true,
  },
  {
    id: 'demo-std-2',
    name: 'Nusrat Jahan',
    studentId: '2307014',
  },
  {
    id: 'demo-std-3',
    name: 'Tanvir Ahmed',
    studentId: '2307022',
  },
];

// courses shaped for AttendanceHero: { id, code, name, type }. GUEST_COURSES
// uses `title` (not `name`) and has no `type` — AttendanceHero's
// isAutoFull(c.type) needs `type` to decide sessional/lab vs theory, and
// getDisplayCourseName/StatCard read `.code`/`.name`. Mapped here rather
// than changing GUEST_COURSES, which the old /guest/* pages still rely on
// as-is.
export const DEMO_COURSES = GUEST_COURSES.map((c) => ({
  id: c.id,
  code: c.code,
  name: c.title,
  credit: c.credit,
  type: 'theory',
  teacher: c.teacher, // kept for DEMO_TEACHERS derivation below
}));

// One teacher entry per distinct GUEST_COURSES.teacher name, each with a
// stable demo-teacher-N id — this is the roster Phase D's faculty demo
// (class list, "which teacher am I") and Phase F's cross-role notice/
// question-bank/meeting linking both read from. The first entry
// (demo-teacher-1) is pinned to the plan's canonical faculty persona name
// 'Dr. Kamal Hossain' — everyone signs in AS this teacher in the faculty
// demo — the rest keep GUEST_COURSES' existing generic names since
// nothing references them by identity yet.
export const DEMO_TEACHERS = Array.from(
  new Set(GUEST_COURSES.map((c) => c.teacher))
).map((name, i) => ({
  id: `demo-teacher-${i + 1}`,
  name: i === 0 ? 'Dr. Kamal Hossain' : name,
  designation: 'Associate Professor',
}));

// The faculty-demo "you are this teacher" persona — teaches CSE 2101 +
// CSE 2103 per the plan's Phase F draft schema.
export const DEMO_FACULTY_PERSONA = DEMO_TEACHERS[0];

// courseId -> teacher name, derived from GUEST_COURSES (not invented) —
// used both for settings.courseTeacherMap below and for anything that
// needs "which teacher teaches this course" without re-deriving it.
const courseIdToTeacherName = Object.fromEntries(
  DEMO_COURSES.map((c) => [
    c.id,
    c.teacher === GUEST_COURSES[0].teacher ? DEMO_FACULTY_PERSONA.name : c.teacher,
  ])
);

// settings.courseTeacherMap — AttendanceHero's getTeachersForCourse reads
// this FIRST (before falling back to scanning `schedule`), so this alone
// is enough to resolve a teacher name per course; the demo schedule below
// does not need per-slot teacherName fields as a result.
export const DEMO_SCHEDULE_SETTINGS = {
  courseTeacherMap: Object.fromEntries(
    DEMO_COURSES.map((c) => [c.id, [courseIdToTeacherName[c.id]]])
  ),
};

// AttendanceHero's combinedMode branch reads combinedData keyed
// `${courseId}_${teacherName}` -> { held, attended }. Derived directly
// from GUEST_ATTENDANCE's existing present/total numbers (present ==
// attended, total == held) so the demo's attendance percentages match
// GUEST_ATTENDANCE exactly — same underlying numbers, reshaped for the
// props this component actually reads.
export const DEMO_ATTENDANCE_COMBINED = Object.fromEntries(
  DEMO_COURSES.map((c) => {
    const a = GUEST_ATTENDANCE[c.id] || { present: 0, total: 0 };
    return [`${c.id}_${courseIdToTeacherName[c.id]}`, { held: a.total, attended: a.present }];
  })
);

// Re-exported as-is for Marks/Schedule widgets that read the simpler
// shapes directly (no reshaping needed there). DEMO_NOTICES (GUEST_NOTICES
// re-export) is kept for any old /guest/* consumer still reading it, but
// is NO LONGER what DEMO_WORLD_STUDENT.notices points to as of Phase F.4
// — see that field's patch further down this file.
export { GUEST_MARKS as DEMO_MARKS, GUEST_SCHEDULE as DEMO_SCHEDULE_PREVIEW, GUEST_NOTICES as DEMO_NOTICES };

// Convenience bundle for LandingPage's student demo wiring.
// `notices` is set to GUEST_NOTICES here at first (this object literal is
// defined before DEMO_NOTICE further down in this file — same
// forward-reference situation as activeBooking), then overwritten by the
// Phase F.4 patch below once DEMO_NOTICE exists.
export const DEMO_WORLD_STUDENT = {
  profile: DEMO_STUDENTS[0],
  courses: DEMO_COURSES,
  attendanceCombined: DEMO_ATTENDANCE_COMBINED,
  scheduleSettings: DEMO_SCHEDULE_SETTINGS,
  marks: GUEST_MARKS,
  schedulePreview: GUEST_SCHEDULE,
  notices: GUEST_NOTICES,
};

// ─── Faculty (Phase D, Step D.1) ───────────────────────────────────────────
// Everything below is new for the faculty demo persona (DEMO_FACULTY_PERSONA
// / demo-teacher-1 / 'Dr. Kamal Hossain'), who teaches CSE 2101 + CSE 2103
// per the reconciliation note at the top of this file. Nothing here is
// invented from scratch — each block derives its course/teacher linkage
// from DEMO_COURSES / DEMO_FACULTY_PERSONA above so the faculty and student
// demo worlds stay cross-consistent (same course ids, same teacher name).

// The two courses DEMO_FACULTY_PERSONA teaches, per plan's Phase F schema.
const FACULTY_COURSE_IDS = DEMO_COURSES.slice(0, 2).map((c) => c.id);

// DEMO_CLASS — one class-group per faculty course, shaped for whatever
// FacultyClassDetail-style components read (id, courseId, course code/name,
// section, studentCount). studentCount is deliberately small and stated
// here rather than backed by a full per-student roster, since no faculty
// screen found so far in Phases D.2–D.6 needs individual student rows —
// only aggregate counts (StatCard-style). If a later step needs a roster,
// it should be added as its own block, not retrofitted here.
export const DEMO_CLASS = FACULTY_COURSE_IDS.map((courseId, i) => {
  const course = DEMO_COURSES.find((c) => c.id === courseId);
  return {
    id: `demo-class-${i + 1}`,
    courseId,
    courseCode: course.code,
    courseName: course.name,
    section: 'A',
    batch: '2k23',
    studentCount: 42,
    teacherId: DEMO_FACULTY_PERSONA.id,
    teacherName: DEMO_FACULTY_PERSONA.name,
  };
});

// DEMO_NOTICE — faculty-authored notices for their own classes. Distinct
// from GUEST_NOTICES/DEMO_NOTICES (student-facing, CR-authored) — this is
// the faculty compose/manage side, keyed to DEMO_CLASS ids above.
export const DEMO_NOTICE = [
  {
    id: 'demo-fnotice-1',
    classId: DEMO_CLASS[0].id,
    courseId: DEMO_CLASS[0].courseId,
    title: 'Midterm syllabus confirmed',
    body: 'Midterm will cover chapters 1–5. Bring calculator; no phones allowed.',
    authorId: DEMO_FACULTY_PERSONA.id,
    authorName: DEMO_FACULTY_PERSONA.name,
    createdAt: '2026-08-05T09:00:00+06:00',
  },
  {
    id: 'demo-fnotice-2',
    classId: DEMO_CLASS[1].id,
    courseId: DEMO_CLASS[1].courseId,
    title: 'Lab report deadline extended',
    body: 'Lab report 3 deadline moved to next Sunday due to holiday.',
    authorId: DEMO_FACULTY_PERSONA.id,
    authorName: DEMO_FACULTY_PERSONA.name,
    createdAt: '2026-08-09T14:30:00+06:00',
  },
];

// ─── Phase F.4: faculty ↔ student notice link ──────────────────────────────
// GUEST_NOTICES (student-facing, re-exported above as DEMO_NOTICES) is
// old guest-mode placeholder content — read in full (guestDemoData.js
// lines 104-108, confirmed): two fabricated entries with no courseId
// field at all, generic "sign up to see your real class notices" body
// text. It was never meant to represent "notices from Dr. Kamal Hossain's
// class" — it predates the faculty demo entirely. Rather than silently
// reusing it as if it were course-linked, DEMO_WORLD_STUDENT.notices is
// repointed here to DEMO_NOTICE instead — the actual faculty-authored
// notices, both of which are already for DEMO_CLASS[0]/[1], i.e.
// DEMO_COURSES[0]/[1] (see FACULTY_COURSE_IDS above), the student
// persona's own first two courses. So no filtering is needed: every
// DEMO_NOTICE entry is one this student would see. GUEST_NOTICES/
// DEMO_NOTICES stays exported as-is for any old /guest/* page still
// reading it directly — not deleted, just no longer what the student
// demo dashboard itself reads.
DEMO_WORLD_STUDENT.notices = DEMO_NOTICE;

// DEMO_QUESTION_BANK_ENTRY — sample entries for the faculty Question Bank
// tab, one per faculty course, matching the plan's Phase D.4 impurity note
// (QuestionBankTab reads entries keyed by courseId).
export const DEMO_QUESTION_BANK_ENTRY = [
  {
    id: 'demo-qb-1',
    courseId: DEMO_CLASS[0].courseId,
    title: 'Midterm 2025 - Set A',
    type: 'midterm',
    year: 2025,
    uploadedBy: DEMO_FACULTY_PERSONA.name,
    createdAt: '2026-07-20T10:00:00+06:00',
  },
  {
    id: 'demo-qb-2',
    courseId: DEMO_CLASS[1].courseId,
    title: 'Final 2025 - Set B',
    type: 'final',
    year: 2025,
    uploadedBy: DEMO_FACULTY_PERSONA.name,
    createdAt: '2026-07-22T10:00:00+06:00',
  },
];

// DEMO_MEETING — shaped to match exactly what MeetingCard (pure component,
// confirmed at FacultyMeetings.jsx:59 — resolves D.5) reads: meeting.title,
// .type, .date, .time, .location, .link, .notes. `type` values must be one
// of MEETING_TYPES from facultyMeetingSync.js — using the common ones
// ('class', 'department', 'consultation') so getMeetingTypeMeta resolves
// without needing a fallback icon/color.
export const DEMO_MEETING = [
  {
    id: 'demo-meeting-1',
    title: 'Department Coordination Meeting',
    type: 'department',
    date: new Date().toISOString().slice(0, 10),
    time: '11:00',
    location: 'CSE Seminar Room',
    link: '',
    notes: 'Discuss midterm scheduling across sections.',
  },
  {
    id: 'demo-meeting-2',
    title: 'CSE 2103 Online Class',
    type: 'class',
    date: new Date().toISOString().slice(0, 10),
    time: '14:00',
    location: '',
    link: 'https://meet.example.com/demo-class',
    notes: '',
  },
  {
    id: 'demo-meeting-3',
    title: 'Student Consultation — Rafiul Islam',
    type: 'consultation',
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    time: '15:30',
    location: 'Faculty Office 204',
    link: '',
    notes: 'Discuss CGPA improvement plan.',
  },
];

// Convenience bundle for LandingPage's faculty demo wiring (Step D.1 output
// consumed by D.2–D.6). Mirrors DEMO_WORLD_STUDENT's shape/naming pattern.
export const DEMO_WORLD_FACULTY = {
  profile: DEMO_FACULTY_PERSONA,
  classes: DEMO_CLASS,
  notices: DEMO_NOTICE,
  questionBank: DEMO_QUESTION_BANK_ENTRY,
  meetings: DEMO_MEETING,
};

// ─── Provider (Phase E, Step E.2) ──────────────────────────────────────────
// ProviderDashboard.jsx and ServiceDetail.jsx were read in full this phase
// (Phase E resume-point instruction — see plan-prompt) and confirmed
// Firestore-coupled the same way NoticesTab/ScheduleTab/QuestionBankTab
// and provider's own real screens are: live subscriptions
// (subscribeProviderServices, subscribeConfirmedBookings,
// subscribeOpenErrandRequestsForRunner, ...) plus real writes
// (confirmBooking, cancelBooking, finishBooking, acceptErrandRequest,
// createBooking, createErrandRequest — real money/order flow). Same
// conclusion as Phase D: not safely convertible to props-driven. This
// block instead feeds a new, standalone ProviderDemoDashboard.jsx, same
// pattern as StudentDemoDashboard/FacultyDemoDashboard.
//
// Category chosen: 'salon' — matches CATEGORY_SETUP_CONFIG.salon in
// serviceCategoryConfig.js (real field/copy source, not invented), and is
// the category the plan's own examples elsewhere already reference.
const DEMO_PROVIDER_PERSONA = {
  id: 'demo-provider-1',
  uid: 'demo-provider-1',
  displayName: 'Noor Saloon',
  type: 'salon',
  status: 'verified',
};

// DEMO_OFFERING — shaped like offerings[] items real ServiceManager/
// ProviderOfferingsPage render (name, priceNote, available). Two items,
// one open one closed, to show both availableLabelBn/unavailableLabelBn
// states from serviceCategoryConfig.js's salon entry.
export const DEMO_OFFERING = [
  {
    id: 'demo-offering-1',
    name: 'হেয়ারকাট',
    priceNote: '৳100 - ৳200',
    available: true,
  },
  {
    id: 'demo-offering-2',
    name: 'শেভ',
    priceNote: '৳50',
    available: true,
  },
  {
    id: 'demo-offering-3',
    name: 'ফেসিয়াল',
    priceNote: '৳300 - ৳500',
    available: false,
  },
];

// DEMO_BOOKING — shaped like the booking docs ProviderDashboard's
// PendingBookingCard / confirmed-bookings list read (offeringId,
// studentName, status, requestedAt). Single-offering shape only (not the
// multi-item items[] shape) since salon is single-offering per booking —
// see bookingSummaryText's offeringId fallback branch in
// ProviderDashboard.jsx.
//
// Phase F cross-role linking: demo-booking-1's requester is DEMO_STUDENTS[0]
// (the same "you are this student" persona the student demo signs in as) —
// linked by studentId (real booking docs don't carry a studentId field
// today per ProviderDashboard.jsx/serviceSync.js, only studentName as a
// display string, so studentId here is demo-only scaffolding for the
// cross-role UI link below, not a real schema field). Previously this was
// just a hardcoded 'Rafiul Islam' string match with no actual reference —
// Phase E's own resume-point note flagged that as unfinished, fixed in
// Phase F.1. demo-booking-2 is a DIFFERENT person (demo-std-3, Tanvir
// Ahmed — Phase F.5) so the provider demo doesn't look like a
// single-person world, but is still a real id link now, not a bare name
// string.
export const DEMO_BOOKING = [
  {
    id: 'demo-booking-1',
    offeringId: 'demo-offering-1',
    offeringLabel: 'হেয়ারকাট',
    studentId: DEMO_STUDENTS[0].id,
    studentName: DEMO_STUDENTS[0].name,
    status: 'pending',
    requestedAt: '2026-08-13T10:15:00+06:00',
  },
  {
    id: 'demo-booking-2',
    offeringId: 'demo-offering-2',
    offeringLabel: 'শেভ',
    studentId: DEMO_STUDENTS[2].id, // Phase F.5: was a bare 'Tanvir Ahmed' string, now linked to demo-std-3 per the schema's named third student
    studentName: DEMO_STUDENTS[2].name,
    status: 'confirmed',
    requestedAt: '2026-08-12T16:40:00+06:00',
  },
];

// Convenience bundle for LandingPage's provider demo wiring. Mirrors
// DEMO_WORLD_STUDENT/DEMO_WORLD_FACULTY's shape/naming pattern.
export const DEMO_WORLD_PROVIDER = {
  profile: DEMO_PROVIDER_PERSONA,
  offerings: DEMO_OFFERING,
  bookings: DEMO_BOOKING,
  revenueTotal: DEMO_BOOKING
    .filter((b) => b.status === 'confirmed')
    .reduce((sum) => sum + 150, 0), // static demo total, not derived from a real price field — offerings above use priceNote ranges, not fixed numbers
};

// ─── Phase F: cross-role linking patch ─────────────────────────────────────
// DEMO_WORLD_STUDENT was defined above DEMO_BOOKING in this file (student
// section comes first), so this field is attached here via assignment
// rather than inside that object literal — avoids a forward reference to
// DEMO_BOOKING, which didn't exist yet at that point in the file. Exposes
// the one demo booking already linked to DEMO_STUDENTS[0] by id (see
// DEMO_BOOKING's own comment above) so the student demo dashboard can show
// "your own" active booking in Phase F.3, instead of the student and
// provider demos being two disconnected worlds that happen to share a name
// string.
DEMO_WORLD_STUDENT.activeBooking = DEMO_BOOKING.find(
  (b) => b.studentId === DEMO_STUDENTS[0].id
) || null;
