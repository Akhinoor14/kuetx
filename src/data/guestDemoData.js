// KUETx Guest Mode — hardcoded demo data (Phase 2.2)
//
// Every value here is CLEARLY FICTIONAL — never a real KUET roll number,
// never a real name, never a real course/teacher. Shaped to exactly match
// what the real store getters return (see store.js's DEFAULT_PROFILE and
// getProfile(), isProfileComplete(), and DEPARTMENTS) so that whichever
// data-injection approach Phase 2.3 ends up using (see that section's
// BLOCKED status in this plan) can hand this straight to the real page
// components without an intermediate reshaping step.
//
// IMPORTANT: this file is display-only demo data. It is never written to
// store.js / localStorage / IndexedDB / Firestore — per the plan's Product
// Decision #2 and #3, guest mode must not touch the real store at all.

// ─── Demo profile ────────────────────────────────────────────────────────
// Roll '2007001' -> batch '2k07'... but that's in the past relative to
// BATCH_START_DATES' newest entries, so instead we use a roll consistent
// with an existing seeded batch (2k23) so getTermTimeline()/attendance
// math etc. have a real, non-empty BATCH_START_DATES entry to compute
// against if Phase 2.3 wires this data all the way through. Matches
// isProfileComplete()'s requirements: valid 7-digit roll, valid dept code,
// valid batch (derivable from roll), and section (CSE is a 120-seat dept,
// so section is required).
export const GUEST_PROFILE = {
  name: 'Demo Student',
  studentId: '2307000', // obviously-fake — real KUET rolls never end in 000
  dept: 'CSE',
  section: 'A',
  session: '2023-24',
  batch: '2k23',
  currentTerm: '2nd Year 1st Term',
  currentTermKey: 'L2T1',
  totalCreditsRequired: 160,
  yearStarted: 2023,
  isCR: false,
  hallName: 'Amar Ekushey Hall (Demo)',
  roomNo: '000',
  advisorName: 'Demo Advisor',
  advisorContact: '',
  bloodGroup: '',
  bio: 'This is a preview account — sign up to set up your own profile.',
  termStartDate: '2025-01-01',
  __isGuestDemo: true,
};

// ─── Demo courses ────────────────────────────────────────────────────────
// Shaped like getAllCourses() entries: id, code, title, credit, teacher.
// Course codes/titles are generic/plausible, not copied from any real
// KUET curriculum document.
export const GUEST_COURSES = [
  { id: 'demo-cse201', code: 'CSE 2101', title: 'Data Structures (Demo)', credit: 3.0, teacher: 'Demo Teacher 1' },
  { id: 'demo-cse203', code: 'CSE 2103', title: 'Digital Logic Design (Demo)', credit: 3.0, teacher: 'Demo Teacher 2' },
  { id: 'demo-math201', code: 'Math 2101', title: 'Linear Algebra (Demo)', credit: 3.0, teacher: 'Demo Teacher 3' },
  { id: 'demo-eee201', code: 'EEE 2101', title: 'Electrical Circuits (Demo)', credit: 3.0, teacher: 'Demo Teacher 4' },
  { id: 'demo-hum201', code: 'Hum 2101', title: 'Economics (Demo)', credit: 2.0, teacher: 'Demo Teacher 5' },
];

// ─── Demo attendance ─────────────────────────────────────────────────────
// Keyed by course id, shaped like computeEffectiveAttendance()'s return:
// { pct, present, total }. Deliberately varied (one course below the
// minimum threshold) so the demo shows both a healthy and a warning state
// — a flat 100% everywhere would look fake in a different way.
export const GUEST_ATTENDANCE = {
  'demo-cse201': { pct: 92, present: 23, total: 25 },
  'demo-cse203': { pct: 88, present: 22, total: 25 },
  'demo-math201': { pct: 76, present: 19, total: 25 },
  'demo-eee201': { pct: 68, present: 17, total: 25 }, // below MIN_ATTENDANCE_PERCENT — shows the warning state
  'demo-hum201': { pct: 96, present: 24, total: 25 },
};

// ─── Demo marks ──────────────────────────────────────────────────────────
// Shaped like Marks.jsx's per-course `marks[course.id]` object.
export const GUEST_MARKS = {
  'demo-cse201': { hall: 165, ctTeacher1: 24, ctTeacher2: 26, attMode: 'auto' },
  'demo-cse203': { hall: 150, ctTeacher1: 22, ctTeacher2: 20, attMode: 'auto' },
  'demo-math201': { hall: 140, ctTeacher1: 18, ctTeacher2: 19, attMode: 'auto' },
  'demo-eee201': { hall: 120, ctTeacher1: 15, ctTeacher2: 17, attMode: 'auto' },
  'demo-hum201': { hall: 175, ctTeacher1: 27, ctTeacher2: 28, attMode: 'auto' },
};

// ─── Demo schedule ───────────────────────────────────────────────────────
// A small fabricated weekly routine — enough to populate a Schedule demo
// view without implying it's the visitor's real class routine.
export const GUEST_SCHEDULE = [
  { day: 'Sunday', slots: [
    { time: '09:00–09:55', courseId: 'demo-cse201', room: 'Demo Room 301' },
    { time: '10:00–10:55', courseId: 'demo-math201', room: 'Demo Room 204' },
  ] },
  { day: 'Monday', slots: [
    { time: '09:00–09:55', courseId: 'demo-eee201', room: 'Demo Room 105' },
    { time: '11:00–11:55', courseId: 'demo-cse203', room: 'Demo Lab 2' },
  ] },
  { day: 'Tuesday', slots: [
    { time: '10:00–10:55', courseId: 'demo-hum201', room: 'Demo Room 401' },
  ] },
  { day: 'Wednesday', slots: [
    { time: '09:00–09:55', courseId: 'demo-cse201', room: 'Demo Room 301' },
    { time: '10:00–10:55', courseId: 'demo-cse203', room: 'Demo Lab 2' },
  ] },
  { day: 'Thursday', slots: [
    { time: '09:00–09:55', courseId: 'demo-math201', room: 'Demo Room 204' },
  ] },
];

// ─── Demo notices ────────────────────────────────────────────────────────
// A couple of fabricated class notices, in case Dashboard/notices widgets
// end up in scope for a demo page later.
export const GUEST_NOTICES = [
  { id: 'demo-notice-1', title: 'Welcome to the KUETx preview', body: 'This is sample content — sign up to see your real class notices.', createdAt: '2026-08-01T09:00:00.000Z', priority: 'normal' },
  { id: 'demo-notice-2', title: 'Demo: Midterm schedule posted (example)', body: 'This is a fabricated example notice for preview purposes only.', createdAt: '2026-07-20T09:00:00.000Z', priority: 'high' },
];

// Convenience bundle, for whichever injection approach Phase 2.3 lands on.
export const GUEST_DEMO_DATA = {
  profile: GUEST_PROFILE,
  courses: GUEST_COURSES,
  attendance: GUEST_ATTENDANCE,
  marks: GUEST_MARKS,
  schedule: GUEST_SCHEDULE,
  notices: GUEST_NOTICES,
};
