# KUETx Faculty Module — MERGED FINAL PROMPT (single source of truth)

> এই ফাইলে `KUETx_Faculty_Module_FINAL_PROMPT.md` (মূল detailed spec) এবং
> `PROMPT.md` (deviations/override) — দুটো মিলিয়ে **একটাই** চূড়ান্ত ডকুমেন্ট
> বানানো হয়েছে। এখন থেকে শুধু এই ফাইলটাই অনুসরণ করতে হবে; বাকি দুইটা ফাইল
> deprecated।

---

## ০. পরিভাষা (Terminology)

| টার্ম | মানে | Status |
|---|---|---|
| **Group** | একটা dept+batch cohort (যেমন `2K23_ESE`) — সেই batch-এর পুরো KUET জীবনের জন্য স্থায়ী। `getGroupId()` দিয়ে derive হয়। | Existing |
| **Class Assignment** | একজন teacher একটা course পড়াচ্ছে একটা Group-কে, একটা term-এর জন্য। "Add/Edit/End Class" বলতে এইটাই বোঝানো হবে। | নতুন বানাতে হবে |
| **Session** | একটা Class Assignment-এর আওতায় একটা actual লেকচার instance। "Class 1", "Class 2" গণনা এইটার উপর হয়। | নতুন বানাতে হবে |
| **Faculty Account** | সাইন-আপ করা, verified teacher-এর live account (`faculty/{uid}`)। | নতুন বানাতে হবে |

> **বাতিল টার্ম:** "Faculty Directory" (curated admin allowlist) — মূল স্পেকে ছিল,
> কিন্তু Deviation 1-এ পুরোপুরি বাতিল হয়েছে (নিচে দেখুন)। `facultyDirectory`
> collection কোডে থেকে যাচ্ছে কিন্তু কোনো live gate তার উপর নির্ভর করে না।

---

## ১. Role ও Context

KUETx — React + Vite + Tailwind + Firebase v10 PWA (offline-first, IndexedDB-backed
local store)। Student side সম্পূর্ণ কাজ করছে — CR/ACR flow, Staff/Founder
hierarchy, schedule engine, marks/attendance self-tracker। কাজ: সম্পূর্ণ নতুন
**Faculty module** যোগ করা।

**শুরু করার আগে অবশ্যই পড়তে হবে (existing pattern, নতুন প্যাটার্ন উদ্ভাবন করা যাবে না):**

```
src/nav.js                              — NAV config structure (group/subgroup/hubPath/items)
src/App.jsx                             — buildQueue() onboarding sequencer, route definitions
src/store/store.js                      — DEFAULT_PROFILE, MARK_WEIGHTS, getAttendanceMarks(),
                                           GRADE_SCALE, roll-derived dept/batch logic
src/lib/groupSync.js                    — getGroupId(), softDeleteEntry()/restoreEntry() pattern
                                           (লাইন ~975-1025) — এই EXACT pattern reuse করতে হবে
                                           Class Assignment end/delete-এ
src/lib/kuetEmailVerify.js              — passwordless magic-link verification mechanism
                                           (secondary Firebase app instance, sendSignInLinkToEmail,
                                           ~1hr expiry, verifiedRolls/{roll} লেখে) — faculty verify-তে
                                           এই EXACT mechanism reuse হবে, শুধু আলাদা collection/app-name
src/lib/staffRoles.js, useIsStaff.js,
src/components/RequireStaff.jsx,
src/components/RequireCR.jsx            — server-verified role-guard pattern (self-reported flag
                                           কখনো trust করা যাবে না, exact pattern কপি করতে হবে)
src/pages/AdminEntryPoint.jsx           — Founder bypass pattern (admins/{uid} existing = বাকি সব
                                           গেট বাইপাস, আলাদা login লাগে না)
src/lib/founderCategories.js            — Admin dashboard category structure
src/components/TeacherSelector.jsx,
src/components/CourseTeacherDialog.jsx  — বর্তমান CR-side teacher assignment UI (free-text,
                                           maxTeachers = 2 — cap already exists!)
src/pages/Teachers.jsx                  — আলাদা জিনিস: student-এর নিজের PRIVATE teacher
                                           notes/ratings (local-only)। এইটা touch করবে না।
src/pages/ClassManagement.jsx           — Planner tab (auto-count from routine + manual +1,
                                           meta/plannerSettings-এ target সংরক্ষিত) — Session-count
                                           feature এইটার EXTENSION হবে, নতুন বানানো না
src/pages/Schedule.jsx                  — TIME_MODELS['50min'/'40min'] grid engine — faculty
                                           schedule-এ হুবহু reuse
src/pages/Classmates.jsx,
  ClassmatesList.jsx                    — roster + CR-badge pattern — faculty "Students & CR" tab
                                           read-only ভাবে reuse করবে
src/lib/noticeUtils.js                  — subscribeAllNotices(), postGroupNotice() — একই feed-এ
                                           faculty notice যাবে, নতুন feed বানানো যাবে না
src/pages/Attendance.jsx, Marks.jsx     — nav label "Term Planner" — ১০০% self-reported, LOCAL-ONLY
                                           আজকে। এই module-ই প্রথমবার teacher-verification layer
                                           যোগ করছে
src/components/ClaimCRCard.jsx          — "link this to real account?" claim-prompt UX pattern —
                                           free-text teacher নাম আর real Faculty Account link করার
                                           সময় এই EXACT UX pattern reuse হবে
src/index.css                           — CSS variables: --accent:#16a34a, --bg:#f5f5f2,
                                           --card:#ffffff, --border:#e2e0db, --text:#1c1c1a,
                                           --muted:#6b6860, --r:12px

--- Notification/Toast track (parallel, Phase A-F, ইতিমধ্যে merged) ---
src/nav.js                              — এতে ইতিমধ্যে একটা নতুন 'Notice' hub entry আছে
                                           (Phase A-F কাজ)। nav-faculty.js সম্পূর্ণ আলাদা ফাইল,
                                           nav.js edit করে না — সংঘর্ষ নেই, কিন্তু Phase 3-এর আগে
                                           latest nav.js পড়ে নিতে হবে branching ঠিকমতো বসানোর জন্য।
src/pages/AdminDashboard.jsx             — Phase 8-এ এখানে একটা নতুন "Faculty" category/sub-view
                                           যোগ হবে, existing sub-view গুলো (flicker-fix logic সহ)
                                           touch হবে না — শুধু নতুন case/view add।
```

---

## ২. চূড়ান্ত সিদ্ধান্ত (Negotiable না) — CONFIRMED DEVIATIONS সহ merged

1. ~~Faculty email validation curated whitelist দিয়ে~~ **[DEVIATION 1 — OVERRIDDEN]**
   **নতুন নিয়ম — Email Suffix Match, কোনো fixed roster না:**
   - কোনো `facultyDirectory` curated per-person exact-match লিস্ট **ব্যবহার হবে না** —
     এত department/teacher-এর নাম আগে থেকে বসিয়ে রাখা বাস্তবসম্মত না।
   - Signup-এ department dropdown নেই — teacher সরাসরি নিজের official email টাইপ করে।
   - শুধু email-এর **suffix/domain** চেক হবে: যেকোনো `*.kuet.ac.bd` subdomain
     (`@ese.kuet.ac.bd`, `@me.kuet.ac.bd`, `@cse.kuet.ac.bd` ইত্যাদি) মিললেই match।
     কোন department সেটা গুরুত্বপূর্ণ না (cross-dept assignment common)।
   - **হার্ড এক্সক্লুশন:** `@stud.kuet.ac.bd` — structurally `*.kuet.ac.bd`-এ মিলে
     গেলেও এটা student subdomain, সবসময় block, কোনো exception নেই।
   - Match না হলে সেখানেই block, পরের step নেই।
   - `facultyDirectory` ও `facultyApplications` collection কোড থেকে সরানো হচ্ছে না
     (ভবিষ্যতে Admin visibility কাজে লাগতে পারে), কিন্তু **live signup gate এগুলোর
     উপর নির্ভর করে না।**
   - **[DEVIATION 1b — টেস্টিং exception, hardcoded, single email]**
     `guluvai479@gmail.com` — এই একটা exact email suffix-check থেকে **সম্পূর্ণ
     বাদ**, hardcoded constant হিসেবে (কোনো collection/admin-toggle না, কোডেই
     লেখা থাকবে)। এই ইমেইল দিয়ে signup করলে suffix ব্যর্থ হলেও pass করবে —
     কিন্তু Deviation 2-এর hard verification gate (magic-link) **এখনো লাগবে**,
     শুধু suffix-check স্কিপ হয়। এটা শুধুই testing purpose, production roster না।
     Constant-এর নাম `TESTING_BYPASS_EMAILS` (array, ভবিষ্যতে দরকার হলে বাড়ানো
     যায়), `facultyEmailVerify.js`-এ সবচেয়ে উপরে, স্পষ্ট মন্তব্য সহ ("// TEMP:
     testing bypass, remove before public launch")।

2. ~~Verification soft badge~~ **[DEVIATION 2 — OVERRIDDEN]**
   **নতুন নিয়ম — Hard Gate:** যেহেতু কোনো curated whitelist নেই, inbox-মালিকানা
   প্রমাণই একমাত্র বাস্তব প্রমাণ যে কেউ real KUET faculty — verification তাই
   load-bearing, cosmetic না।

   **Flow:**
   1. Email suffix client-side check পাশ →
   2. Account তৈরি (email+password, Google Sign-In নেই) →
   3. `faculty/{uid}` doc তৈরি হয় কিন্তু **`verifiedAt: null`** — Teacher shell লক →
   4. সেই ইনবক্সে magic sign-in link (student-side `kuetEmailVerify.js`-এর হুবহু
      mechanism reuse, আলাদা secondary Firebase app instance + আলাদা collection
      `verifiedFacultyEmails/{email}`) →
   5. Link click → `faculty/{uid}.verifiedAt` set →
   6. তখনই `useIsFaculty()`/`RequireFaculty.jsx` account-কে real faculty ধরবে, shell unlock।

   Click করার আগে: "verify your email to continue" holding screen (auto-advance
   করবে live Firestore subscribe দিয়ে, `verifiedAt` set হলে)।

3. Auth flow শুধু email + password। Google Sign-In নেই, domain-ভিত্তিক
   conditional-toggle নেই — একটাই path, সব teacher-এর জন্য সমান।

4. প্রতি course-এ সবসময় ঠিক দুইজন teacher, ৪৫+৪৫ marks (complementary, মোট ৯০ না —
   প্রত্যেকে independently নিজের ৪৫-এর মধ্যে)। Single-teacher/parallel-grading
   edge-case handle করার দরকার নেই। `facultyAssignments.teacherUids` সবসময়
   exactly ২টা entry।

5. Marks-এ কোনো frozen/lock state নেই। Sent হওয়ার পরেও edit চলবে, re-save করলেই
   automatic re-send।

6. Teacher-verified marks/attendance existing self-reported Attendance.jsx/Marks.jsx
   field **overwrite করবে না** — student personal planning tool অপরিবর্তিত। নতুন
   "Teacher-Verified" section পাশে বসবে (§৯ বিস্তারিত)।

7. Short-name conflict rule: schedule grid-এ সবসময় CR-assigned `gridAlias`
   দেখাবে (কখনো teacher-এর নিজের preferred name না)। Teacher-এর নিজের
   preferred name শুধু নিজের Profile/Dashboard-এ।

8. Class Assignment "End" = soft-delete pattern, `groupSync.js`-এর existing
   `softDeleteEntry`/`restoreEntry` হুবহু reuse — নতুন delete-mechanism বানানো
   যাবে না। Attendance/marks history হারায় না, active grid থেকে সরে যায়।

9. Founder bypass: `admins/{uid}` doc থাকলেই Teacher shell unlock, `faculty/{uid}`
   doc বা campus email লাগবে না — pure UI bypass, দ্বিতীয় account না।
   `AdminEntryPoint.jsx`-এর exact pattern।

10. Marks review→send flow তিন ধাপে: `Draft → Reviewed → Sent (→ auto-resend on edit)`।
    Individual per-student "Send" বাটন + bulk "Send All Reviewed" বাটন। CR-কে
    message পাঠানোর আলাদা channel (marks থেকে সম্পূর্ণ আলাদা, broadcast না)।

11. PDF export দুই ধরনের: individual student report + full-class summary —
    `html2canvas` + `jsPDF` (free npm, MIT license), client-side, backend/paid API না।

12. Route namespace `/faculty/*` — student route থেকে সম্পূর্ণ আলাদা, single
    `RequireFaculty` guard clean রাখার জন্য।

13. "Career total students taught" = de-duplicated unique students, প্রতি Class
    Assignment-এ যোগ করা raw sum না।

14. **[DEVIATION 3 — নতুন]** Faculty-side UI সম্পূর্ণ English, কোনো Bangla নেই:
    `/faculty/*`-এর নিচে সব কিছু — UI copy, modal, notification/toast, error
    message — শুধুমাত্র English, professional/corporate tone (casual না)।
    Student-side সব কিছু অপরিবর্তিত (Bangla/Banglish/তুমি)।

    **ব্যতিক্রম:** Role Select screen (§৫ Step ১) — role বাছাইয়ের **আগেই**
    সবাইকে দেখানো হয়, তাই এটা Bangla/bilingual থাকবে। "Faculty Member" option
    বেছে নেওয়ার **পরে** থেকে সব English।

---

## ৩. Data Model — Firestore Collections

Existing convention: top-level doc + `groups/{groupId}/subcollection` shape,
identity-stamp (`createdBy`/`updatedBy`, `getIdentityStamp()`), append-heavy
log-এ soft-delete-only।

```
facultyDirectory/{entryId}                    // কোডে থাকছে, কিন্তু gate করে না (Deviation 1)
  name, title, dept, email, status: 'active' | 'on-leave'

faculty/{uid}
  name, title, dept, officialEmail, verifiedAt  // verifiedAt: null পর্যন্ত shell locked
  preferredName: string | null                  // শুধু self-facing UI-তে, schedule grid-এ না
  careerStats: { uniqueStudentsTaught: number, classesCompleted: number }
  createdAt

verifiedFacultyEmails/{email}
  // existence = mailbox-ownership proof, kuetEmailVerify.js mechanism reuse,
  // verifiedRolls/{roll}-এর সরাসরি faculty-সংস্করণ, secondary Firebase app দিয়ে লেখা

facultyApplications/{uid}                     // কোডে থাকছে (Deviation 1-এর মন্তব্য অনুযায়ী harmless),
                                               // কিন্তু live gate flow এটা ব্যবহার করে না

groups/{groupId}/facultyAssignments/{assignmentId}
  teacherUids: [uid1, uid2]              // সবসময় exactly ২টা
  displayName, gridAlias                  // CR-assigned, schedule grid-এ এইটাই দেখাবে
  courseId, courseCode, courseType        // 'Theory' | 'Sessional' | 'Project'
  term, dayTimeSlots: [...]
  plannedTotalClasses
  status: 'active' | 'ended'
  createdBy, createdAt, endedAt

groups/{groupId}/facultyAssignments/{id}/sessions/{sessionId}
  date, dayName, slot, source: 'auto' | 'manual'
  attendance: { [studentUid]: 'present' | 'absent' | 'late' | 'excused' }
  loggedBy: { uid, role: 'cr' | 'faculty', name }   // discrepancy signal, conflict না
  createdAt, updatedAt

groups/{groupId}/facultyAssignments/{id}/studentRecords/{studentUid}
  attendancePercent, attendanceMarksAuto     // getAttendanceMarks() থেকে computed, read-only এখানে
  teacher1Marks: { ctMarks, assignmentMarks, attendanceMarks, total }
  teacher2Marks: { ctMarks, assignmentMarks, attendanceMarks, total }
  status: 'draft' | 'reviewed' | 'sent'
  lastSentAt: timestamp | null
  history: [{ ts, field, oldValue, newValue, by }]   // audit trail, student invisible

faculty/{uid}/classIndex/{assignmentId}
  groupId, assignmentId, courseCode, dept, batch, term, status
  // denormalized fan-out pointer — "My Classes" এক-query রাখতে

groups/{groupId}/meta/plannerSettings   (existing doc, EXTEND)
  + teacherShortCodes: { [teacherUid]: "HA1" }

groups/{groupId}/notices/{noticeId}   (existing collection, EXTEND)
  + from: 'Teacher'
  + noticeType: 'general' | 'marks_release'
  + targetType: 'broadcast' | 'cr_only'

groups/{groupId}/routineEntries/{entryId}   (existing collection, EXTEND)
  + teacherUids?: [uid, ...]   // existing free-text teacherNames-এর পাশে, backward-compatible
```

**Marks doc shape `courseType` অনুযায়ী ভিন্ন** (existing `MARK_WEIGHTS` in `store.js`):

| `courseType` | Per-teacher fields | Cap |
|---|---|---|
| `Theory` | `ctMarks` (0–30) + `attendanceMarks` (0–15, auto from `getAttendanceMarks()`) | ৪৫ |
| `Sessional` | `attendanceMarks` (১০%) + `labQuizViva` (২০%) + `centralViva` (২০%) + `performance` (৫০%) | `MARK_WEIGHTS.sessional` |
| `Project` | Term ভেদে ভিন্ন: `supervisorMark` + `presentationViva` (+ Term 2-তে `externalExaminer`) | `MARK_WEIGHTS.project` |

Marks Entry UI অবশ্যই `course.courseType` দেখে input-field branch করবে — শুধু
Theory-shape হার্ডকোড করা যাবে না।

---

## ৪. দুই On-ramp — Class Assignment কীভাবে তৈরি হয়

1. **Teacher-initiated (primary)**: `/faculty/classes`-এ "+ Add Class" — Dept →
   Batch → Term → Course বেছে → নিজের Class Assignment তৈরি/join করে। একটা
   assignment-এ ১ জন teacher থাকলে, দ্বিতীয়জন যোগ দিতে পারবে। ২ জন পূর্ণ থাকলে
   block, message: "already fully assigned — contact your Campus Lead."
2. **CR-initiated (existing, upgraded)**: CR এখনও `TeacherSelector`/
   `CourseTeacherDialog` দিয়ে schedule grid-এ নাম বসায়। যেহেতু curated
   `facultyDirectory` search আর গেট না (Deviation 1), disambiguation lookup
   optional/best-effort হবে — না মিললে existing free-text fallback অপরিবর্তিত।
   এই ফ্লো শুধু `routineEntries`-এ লেখে, কখনো নিজে থেকে `facultyAssignments`
   তৈরি করে না — attendance/marks তখনই unlock হয় যখন real teacher নিজে সেই
   course-batch-term claim করে। **এই আলাদা রাখা ইচ্ছাকৃত**: CR নাম টাইপ করে
   কাউকে official grading-ক্ষমতা দিতে পারবে না।
3. Teacher-এর declared Class Assignment একটা existing CR free-text routine
   entry-র সাথে (একই dept+batch+course+term) মিলে গেলে, CR-কে "link this to
   the real account?" prompt — `ClaimCRCard.jsx`-এর exact UX shape reuse করে।
   Decline করলে সবকিছু আগের মতো চলবে।

---

## ৫. Auth ও Onboarding Flow — Exact Steps (Deviation 1+2 অনুযায়ী updated)

`App.jsx`-এর existing `buildQueue()`-এ নতুন প্রথম ধাপ:

```
buildQueue(isAnonymous, accountRole):
  if (!accountRole)                     → 'role-select'   ← নতুন, সবসময় প্রথম, একবারই
  if (isAnonymous)                      → 'auth'           ← existing, copy accountRole অনুযায়ী branch
  if (accountRole === 'teacher'
        ? !isFacultyProfileComplete()
        : !isProfileComplete())         → 'profile'        ← teacher হলে FacultyProfileSetupModal
  ...unchanged: announcement, communityHiring, backup
```

**Step 1 — Role Select** (নতুন, one-time, Bangla/bilingual — এই একটাই ব্যতিক্রম
Deviation 3-এর English-only rule-এ): "Student" / "Faculty Member" — দুটো বড় tap
target। Choice সাথে সাথে local store-এ (`accountRole`), queue rebuild। Founder-এর
existing session এই ধাপ সম্পূর্ণ skip করে (§৭)।

**Step 2 — Teacher Auth** (existing `AuthModal.jsx` extend, `variant="faculty"`
prop, নতুন component না):
```
১. Email input, client-side *.kuet.ac.bd suffix check (@stud.kuet.ac.bd হার্ড এক্সক্লুশন)
   → পাশ হলে: email+password দিয়ে account create
   → ফেল হলে: hard block, সেখানেই আটকে, "Request faculty access" এর মতো কোনো
     alternate path নেই (Deviation 2 — এইটা এখন real gate, soft badge না)
২. Account তৈরির পর: faculty/{uid} doc, verifiedAt: null
৩. kuetEmailVerify.js-এর secondary-Firebase-app magic-link mechanism reuse
   (আলাদা collection verifiedFacultyEmails/{email}) — এইটা এখন HARD GATE,
   soft badge না। Click না করা পর্যন্ত shell locked, holding screen auto-advance
   করবে verifiedAt set হলে (live Firestore subscribe)।
```
Google Sign-In কোথাও নেই।

**Step 3 — Faculty Profile Setup** (নতুন `FacultyProfileSetupModal.jsx`,
`ProfileSetupModal.jsx`-এর exact wizard/step-index UX পুনরাবৃত্তি): Name, Title/
Designation, Department (email suffix থেকে best-guess pre-fill, editable —
যেহেতু curated whitelist নেই তাই pre-fill guaranteed correct না), Phone
(optional), Office Room (optional), Photo (optional), preferredName (optional,
self-facing only)। কোনো roll-number/batch field নেই। Save করলে `faculty/{uid}` লেখা হয়।

---

## ৬. Navigation — Sidebar / BottomNav / Hubs

আলাদা config, component reuse — নতুন Sidebar/BottomNav বানানো যাবে না।

### ৬.১ `src/nav-faculty.js` (নতুন ফাইল, `nav.js`-এর exact schema কপি)

```js
export const NAV_FACULTY = [
  { group: 'Dashboard', isSubgroup: true, hubPath: '/faculty', hubIcon: 'Grid',
    items: [{ id: 'f-dashboard', label: 'Dashboard', icon: 'Grid', path: '/faculty' }] },

  { group: 'Profile', isSubgroup: true, hubPath: '/faculty/profile', hubIcon: 'User',
    items: [{ id: 'f-profile', label: 'Profile', icon: 'User', path: '/faculty/profile' }] },

  { group: 'My Classes', isSubgroup: true, hubPath: '/faculty/classes', hubIcon: 'BookOpen',
    items: [{ id: 'f-classes', label: 'My Classes', icon: 'BookOpen', path: '/faculty/classes' }] },

  { group: 'Schedule', isSubgroup: true, hubPath: '/faculty/schedule', hubIcon: 'Clock',
    items: [{ id: 'f-schedule', label: 'My Schedule', icon: 'Clock', path: '/faculty/schedule' }] },

  { group: 'Notices', isSubgroup: true, hubPath: '/faculty/notices', hubIcon: 'Bell',
    items: [{ id: 'f-notices', label: 'Notices', icon: 'Bell', path: '/faculty/notices' }] },

  { group: 'Campus', subgroups: [
      { name: 'Resources', hubPath: '/faculty/resources', hubIcon: 'BookMarked',
        items: [{ id: 'f-qbank', label: 'Question Bank', icon: 'BookMarked', path: '/faculty/question-bank' }] },
    ]},

  { group: 'Tools', isSubgroup: true, hubPath: '/faculty/tools', hubIcon: 'Wrench',
    items: [
      { id: 'f-contact',  label: 'Contact',  icon: 'Mail',     path: '/faculty/contact' },
      { id: 'f-settings', label: 'Settings', icon: 'Settings', path: '/settings' },   // shared route
      { id: 'f-about',    label: 'About',    icon: 'Info',     path: '/about' },       // shared route
    ]},

  { group: 'Admin', requiresAdmin: true, isSubgroup: true, hubPath: '/team', hubIcon: 'Briefcase',
    items: [{ id: 'f-team', label: 'Team & Administration', icon: 'Briefcase', path: '/team' }] },
];
```

**ইচ্ছাকৃতভাবে বাদ**: Roster/Attendance/Marks/Syllabus-এর আলাদা top-level nav row
নেই — এগুলো Class Detail-এর ভেতরে **tab** হিসেবে থাকবে, `ClassManagement.jsx`-এর
নিজের internal-tab pattern অনুসরণ করে।

`SubgroupHub.jsx` বর্তমানে hardcoded `import { NAV } from '../nav'` করে — একটা
optional `navSource` prop (default `NAV`) যোগ করো, একই hub/card-grid rendering
কোড দুটোই serve করতে পারবে, duplicate component না বানিয়ে।

**⚠️ Interaction note (§০ Prerequisite থেকে):** `nav.js`-এ parallel Notification
track একটা নতুন `Notice` hub entry যোগ করেছে। `nav-faculty.js` সম্পূর্ণ আলাদা
ফাইল বলে সরাসরি সংঘর্ষ নেই, কিন্তু Phase 3 শুরুর আগে latest `nav.js` পড়ে
branching-এর reference নেওয়া দরকার।

### ৬.২ Sidebar/BottomNav Branching

`Sidebar.jsx`-এ একটা `viewMode` (`'student' | 'teacher'`, `localStorage`-এ,
device-local UI preference, account data না) — `viewMode === 'teacher'` হলে
`NAV_FACULTY` (filterNav দিয়ে) render করবে। বাকি সব (quick strip, account
footer, sync badge) অপরিবর্তিত।

- **আসল Faculty Account**: `viewMode` সবসময় `'teacher'` (switch দেখাবে না)
- **আসল Student Account**: সবসময় `'student'`
- **Switch শুধু Founder-এর জন্য** visible

`BottomNav.jsx`-এর `FIXED_BUTTONS` swap হবে গোটা set হিসেবে (existing
role-aware 5th-button precedent অনুসরণ করে — append না): Home → My Classes →
Schedule → Campus (hub) → Profile/Admin (role-aware)।

---

## ৭. Founder Instant-Switch — Exact Placement

`isRealAdmin && adminLabel === 'Founder'` চেক (`useIsStaff()`-এ already computed)।

- **Topbar/Navbar**: sync-badge-এর পাশে ছোট pill toggle, "Student View ⇄ Teacher View"
- **`/faculty` dashboard-এর ভেতরেও**: "Viewing as: Teacher · Switch to Student" লাইন
- Toggle করলে শুধু `viewMode` localStorage-এ flip, Sidebar/BottomNav/Routes
  re-render — navigation/reload না
- Founder-এর Teacher-view নিজের (সাধারণত খালি) data দেখাবে — কোনো নির্দিষ্ট
  real teacher impersonate করা না (out of scope)

### Admin page (`/team`) — নতুন কিছু বানানোর দরকার নেই

`RequireStaff → TeamDashboard → AdminEntryPoint/StaffDashboard` — role-difference
ইতিমধ্যে ভেতরে resolve হয়। শুধু `founderCategories.js`-এ একটা entry:

```js
{
  key: 'faculty', label: 'Faculty', icon: 'GraduationCap',
  subtitle: 'Directory, verification, and class assignments',
  subcategories: [
    { key: 'directory', label: 'Directory', getCount: (ctx) => ctx.facultyCount },
    { key: 'pending',   label: 'Signup Requests', getCount: (ctx) => ctx.facultyPending },
    { key: 'assignments', label: 'Class Assignments' },
  ],
}
```

---

## ৮. Page-by-Page স্পেসিফিকেশন

Route map:

| Route | Page | Reuse করবে |
|---|---|---|
| *(pre-auth)* | Role Select | নতুন, ছোট, bilingual |
| *(pre-auth)* | Teacher Login/Signup | `AuthModal.jsx` + `variant="faculty"` |
| `/faculty` | Faculty Dashboard | নতুন |
| `/faculty/profile` | Faculty Profile | `ProfileSetupModal.jsx` pattern |
| `/faculty/classes` | My Classes | `hub-grid`/`hub-grid-item` CSS classes |
| `/faculty/classes/:assignmentId` | Class Detail (tabbed) | নতুন shell, tabs existing component reuse |
| `/faculty/schedule` | Faculty Schedule | `Schedule.jsx` `TIME_MODELS` |
| `/faculty/notices` | Faculty Notices | `noticeUtils.js`, `postGroupNotice()` |
| `/faculty/question-bank` | Question Bank | `QuestionBank.jsx` সরাসরি, read mode |
| `/faculty/contact` | Contact | `Footer.jsx`-এর contact modal content, page হিসেবে |
| `/settings`, `/about` | shared, অপরিবর্তিত | role-specific না |

### ৮.১ Role Select
প্রথম-রান, unauthenticated। দুই বড় tap target (bilingual, Deviation 3 ব্যতিক্রম)।
কিছু লেখা হয় না, শুধু route করে। একবার decide হলে cache।

### ৮.২ Teacher Login/Signup
`AuthModal.jsx` (`variant="faculty"`) — §৫ Step ২ অনুযায়ী, English UI।

### ৮.৩ Faculty Profile
`RequireFaculty` guard, প্রথম লগইনে mandatory। Fields §৫ Step ৩ অনুযায়ী। Data: `faculty/{uid}`।

### ৮.৪ My Classes
`RequireFaculty`। Card grid, প্রতি card = একটা active Class Assignment। "+ Add
Class": Dept → Batch → Term → Course → day/time (`TIME_MODELS` picker
Schedule.jsx-এর) → optional co-teacher search। Data: `faculty/{uid}/classIndex/*`
পড়ে, save-এ নতুন `facultyAssignments` doc + index pointer লেখে।

### ৮.৫ Class Detail (tabbed hub)
`RequireFaculty`, নিজের assignment-ই শুধু (`teacherUids`-এ uid থাকতে হবে)। Tabs:
- **Students & CR** — `ClassmatesList.jsx` read-only reuse, এই Group-এ scoped
- **Syllabus** — existing curriculum data pipeline (`src/data/curriculum/`) থেকে read
- **Schedule (this class)** — এই assignment-এর `dayTimeSlots`, read-only filtered view
- **Sessions & Count** — §৮.৭
- **Attendance** — §৮.৮
- **Marks** — §৯ (সবচেয়ে গুরুত্বপূর্ণ)
- **Notices** — §৮.৯-এর shortcut, এই Group-এ pre-targeted

Header actions: Edit (day/time/co-teacher), End Class, Delete।

### ৮.৬ Add / End / Delete Class Assignment
**End**: `status: 'ended'` — active grid থেকে সরে যায়। **Delete**:
`groupSync.js`-এর `softDeleteEntry`/`restoreEntry` হুবহু reuse — history হারায় না।

### ৮.৭ Teacher Assignment/Disambiguation (CR-side)
`TeacherSelector.jsx`/`CourseTeacherDialog.jsx`-এ পরিবর্তন — §৪ item ২ অনুযায়ী।
`gridAlias` (short name) CR/ACR সেট করে, compact context-এ (schedule grid cell,
Planner tab) এটাই দেখাবে, full name বাকি জায়গায়। Real faculty uid বাছাই করলে
`facultyUid` existing plain-text field-এর **পাশে** যোগ হবে — downstream কিছু ভাঙবে না।

### ৮.৮ Sessions & Count
`ClassManagement.jsx`-এর existing Planner tab **extend**, parallel counter না।
Assigned faculty-কে `plannerLogEntries`-এ write-access দাও (আজকে CR/ACR-only,
`isContentEditor()` চেক) — `loggedBy: {uid, role: 'cr'|'faculty', name}` স্ট্যাম্প
সহ। প্রতি logged session-এ auto-incrementing sequence number।

### ৮.৯ Attendance Entry
প্রতি student-এর row, present/absent toggle। Total classes auto-count schedule
থেকে, manual override সম্ভব (audit log সহ)। Save → student-side
`computeEffectiveAttendance()`/`getAttendanceMarks()`-এই feed হয় (existing
function)। Data privacy: শুধু সেই student + assigned teacher(s) + CR + Admin।

### ৮.১০ Faculty Notices
`groups/{groupId}/notices`-এ লেখে (existing collection, `subscribeAllNotices`
ইতিমধ্যে সব source merge করে) — `from: 'Teacher'` ট্যাগ সহ। CR-only message
channel একই জায়গা থেকে `targetType: 'cr_only'` দিয়ে যাবে (marks থেকে সম্পূর্ণ আলাদা)।

### ৮.১১ Faculty Dashboard
Career stats card: de-duplicated unique students taught। "Classes remaining" =
planned minus logged sessions। Founder-switch line এখানে (§৭)। Pending-attendance
reminder badge।

---

## ৯. Marks Module — সবচেয়ে গুরুত্বপূর্ণ

**মূলনীতি**: `Attendance.jsx`/`Marks.jsx` (Term Planner) existing field
overwrite করা যাবে না। Teacher-verified data আলাদা জায়গায় (`studentRecords/
{studentUid}`), student-side-এ existing self-tracked number-এর পাশে নতুন
"Teacher-Verified" read-only card হিসেবে বসবে।

### ৯.১ State Cycle
```
Draft → Reviewed → Sent → (edited again → auto re-send, notification নতুন করে যায়)
```
- Draft: autosave, কেউ দেখে না
- Reviewed: teacher নিজের checkpoint, student দেখে না
- Sent: student notification পায়, Teacher-Verified card visible
- কোনো frozen/lock নেই — Sent-এর পরেও edit, save করলেই auto re-send, "Marks updated" ট্যাগ
- প্রতি edit `history` array-তে entry (audit trail, student invisible)
- Row visual state: Draft = grey dot, Sent = green check, Sent-but-edited-since = amber dot

### ৯.২ Two-teacher independent quota
প্রতি teacher নিজের ৪৫-quota-র মধ্যে independently marks দেয় (`teacher1Marks`/
`teacher2Marks` আলাদা)। Firestore rule: write শুধু `request.auth.uid == assignment-এর সেই teacher slot`।

### ৯.৩ Send করার দুই মোড
1. **Individual "Send"**: প্রতি student row-এর পাশে বাটন
2. **"Send All Reviewed"**: bulk বাটন top-এ

### ৯.৪ CR broadcast channel (marks থেকে সম্পূর্ণ আলাদা)
"Message CR" বাটন — শুধু ওই Class Assignment-এর CR/ACR-কে direct message,
students না। `targetType: 'cr_only'` দিয়ে লেখা হয়।

### ৯.৫ Notification Design — দুই জায়গা, distinct
1. **Primary**: Term Planner (`Marks.jsx`)-এ "Teacher-Verified" card নিজে appear, pulse indicator
2. **Secondary**: existing Alerts feed-এ `noticeType: 'marks_release'` distinct icon/color

### ৯.৬ PDF Export
দুইটাই: **Individual student PDF** (header block, student-info card,
component breakdown table, footer) + **Full-class summary PDF** (একই header,
roster table)। `html2canvas` + `jsPDF`, client-side, brand palette
(`--accent: #16a34a`, `--bg: #f5f5f2`, `--text: #1c1c1a`)। Raw jsPDF table API না —
HTML-snapshot route।

### ৯.৭ Attendance% → Marks Formula
`store.js`-এর existing `getAttendanceMarks()` সরাসরি reuse, নতুন formula না।

---

## ১০. Firestore Rules — যোগ করার মূলনীতি

```
function isVerifiedFacultyFor(groupId, assignmentId) {
  return exists(/databases/$(database)/documents/faculty/$(request.auth.uid))
    && get(/databases/$(database)/documents/faculty/$(request.auth.uid)).data.verifiedAt != null
    && request.auth.uid in
       get(/databases/$(database)/documents/groups/$(groupId)/facultyAssignments/$(assignmentId)).data.teacherUids;
}
```
> **Merged addition:** উপরের rule-এ `verifiedAt != null` চেক যোগ করা হয়েছে
> মূল sketch-এর তুলনায় — Deviation 2 (hard gate) অনুযায়ী unverified account
> কখনো `isVerifiedFacultyFor` পাশ করবে না, শুধু `faculty/{uid}` doc থাকাই যথেষ্ট না।

- `facultyAssignments/{id}` — create: verified faculty অথবা CR/ACR
- `studentRecords/{studentUid}` — read: `request.auth.uid == studentUid ||
  isVerifiedFacultyFor(...) || isContentEditor(groupId)`; write: শুধু
  `isVerifiedFacultyFor(...)`, নিজের quota-field-এ সীমিত (§৯.২)
- `notices` — existing CR/ACR write check widen (replace না) — `isVerifiedFacultyFor` যোগ
- `plannerLogEntries` — একইভাবে widen, `loggedBy.role` স্ট্যাম্প সহ (§৮.৮)
- `faculty/{uid}` — create: `request.auth.uid == uid` (নিজের doc), `verifiedAt`
  field শুধু verify-flow-এর secondary app write করতে পারবে (client থেকে সরাসরি
  `verifiedAt` set করা যাবে না, নাহলে hard gate বাইপাস হয়ে যাবে)
- `verifiedFacultyEmails/{email}` — শুধু secondary verify-app write, main session read-only
- `facultyDirectory` — শুধু Founder/Staff write, বাকি সবার read-only (রাখা হচ্ছে কিন্তু গেট না)
- Exact-path `exists()`/`get()` pattern — collectionGroup query এড়িয়ে চলো

---

## ১১. Build Order (Phased — এই সিকোয়েন্সেই)

```
Phase 1 — Foundations
  → faculty/{uid} collection (facultyDirectory কোডে থাকছে কিন্তু seed/gate লাগবে না)
  → RequireFaculty.jsx + useIsFaculty.js (RequireCR.jsx/useIsStaff.js-এর সরাসরি কপি-pattern)
  → facultyEmailVerify.js (suffix-check + magic-link, Deviation 1+2 অনুযায়ী)
  → facultySync.js (faculty/{uid} CRUD)

Phase 2 — Auth Branch
  → role-select step (§৫ Step ১, bilingual), AuthModal faculty variant (§৫ Step ২, English),
    email verification hard-gate holding screen (§৫ Step ২.৩), App.jsx buildQueue wiring

Phase 3 — Shell
  → nav-faculty.js (§৬.১, latest nav.js পড়ে নিয়ে), Sidebar/BottomNav viewMode
    branching (§৬.২), Founder switch (§৭)
  → এই ধাপ শেষে shell navigable হবে placeholder page দিয়ে, content ছাড়াই

Phase 4 — Core Loop
  → Faculty Profile + My Classes + Add Class flow (§৮.৩, ৮.৪)

Phase 5 — Class Detail Read-only Tabs (কম ঝুঁকিপূর্ণ, আগে করো)
  → Students & CR, Syllabus, Schedule tabs — কোনো write নেই

Phase 6 — Sessions & Count
  → existing Planner tab-এর write-access extend (§৮.৮) — marks touch করার আগে

Phase 7 — Attendance + Marks (সবচেয়ে দামি, একবারেই ঠিকমতো)
  → §৮.৯ (Attendance) + §৯ (Marks সম্পূর্ণ) + student-side "Teacher-Verified" card
  → এই ধাপের পরে existing student Attendance.jsx/Marks.jsx flow manually test

Phase 8 — বাকি সব (independent, যেকোনো ক্রমে)
  → Notices (§৮.১০), CR-side disambiguation (§৮.৭), Admin Faculty category
    (§৭, AdminDashboard.jsx-এ নতুন view add — flicker-fix logic touch হবে না),
    Dashboard stats (§৮.১১)

  → Firestore rules pass (§১০)
  → Final regression pass — student-side flow-এ কিছু ভাঙেনি তা নিশ্চিত করা
```

**প্রতিটা Phase শেষে**: existing student-side core flow (Login, Schedule, Marks,
Attendance, CR flow) manually verify — বিশেষ করে Phase 7-এর পর।

---

## ১২. Working Method (Merged থেকে, প্রতিটা session-এ মেনে চলতে হবে)

- **টোকেন শেষ হয়ে গেলে**, ঠিক যেখানে থেমেছে সেখান থেকেই continue — re-plan
  বা পুনরায় শুরু করা যাবে না।
- একটা persistent `_faculty_module_progress/PROGRESS.md` ফাইল রাখা হবে — প্রতিটা
  meaningful step-এর পরে আপডেট: কী কী ফাইল তৈরি/edit হলো, পরের ধাপ কী,
  কোনো blocked/ambiguous জায়গা।
- Existing কোডের pattern (`groupSync.js`-এর soft-delete shape,
  `useIsStaff.js`/`RequireCR.jsx`-এর guard pattern, `kuetEmailVerify.js`-এর
  magic-link mechanism) **অনুসরণ ও reuse** — নতুন প্যাটার্ন উদ্ভাবন না।
- Ambiguity হলে **থেমে জিজ্ঞাসা** — চুপচাপ assume না, বিশেষ করে যা explicit
  লেখা নেই এমন সিদ্ধান্তে।
- প্রতিটা phase শেষে edited/created ফাইল `outputs` ফোল্ডারে (আসল folder
  structure অক্ষুণ্ণ রেখে) কপি।

---

## ১৩. Ambiguity Protocol — কখনো নিজে থেকে বদলাবে না

এই brief-এ যা স্পষ্ট লেখা নেই (ছোটখাটো spacing, microcopy, icon choice) সেখানে
existing codebase-এর নিকটতম analogous student-side pattern অনুসরণ করো। কিন্তু
নিচের জিনিসগুলো **কখনো নিজে থেকে বদলাবে না** — সত্যিই দ্বন্দ্ব লাগলে থামিয়ে জিজ্ঞেস করো:

- Data model shape (§৩) — বিশেষত `facultyAssignments.teacherUids` সবসময় exactly ২
- Faculty email validation = **suffix-match, whitelist না** (§২ item ১ — merged override)
- `TESTING_BYPASS_EMAILS` constant-এ শুধু `guluvai479@gmail.com` — নতুন কোনো
  email এই লিস্টে নিজে থেকে যোগ করা যাবে না, এবং verification hard-gate এই
  bypass-emails-এর জন্যও skip করা যাবে না (§২ item ১ — Deviation 1b)
- Verification = **hard gate, soft badge না** (§২ item ২ — merged override)
- Auth flow = email+password only, Google Sign-In যোগ করা যাবে না
- ৪৫+৪৫ marks quota shape ও marks-এ frozen/lock state না থাকা
- Existing Attendance.jsx/Marks.jsx data model touch না করা — Teacher-Verified আলাদা layer
- Short-name priority rule
- CR-initiated vs teacher-initiated Class Assignment-এর আলাদা authority (§৪)
- Route namespace `/faculty/*`
- PDF library choice: `html2canvas` + `jsPDF`, অন্য কিছু না
- Faculty-side UI = **সম্পূর্ণ English**, Role Select ছাড়া (§২ item ১৪ — merged addition)
- Build order (§১১) — Phase আগে-পিছে করা যাবে না, বিশেষত Phase 7 সবার শেষে

---

## ১৪. এই মুহূর্তে Reuse Status (audit করে confirm করা)

Codebase audit করে (২০২৬-০৭-১১ zip) নিশ্চিত হয়েছে — নিচের কোনো ফাইলই এখনো
তৈরি হয়নি। এটা সত্যিকারের fresh start, Phase 1 থেকেই শুরু করতে হবে:

| ফাইল | Status |
|---|---|
| `src/hooks/useIsFaculty.js` | ❌ নেই |
| `src/lib/facultySync.js` | ❌ নেই |
| `src/lib/facultyEmailVerify.js` | ❌ নেই |
| `src/components/RequireFaculty.jsx` | ❌ নেই |
| `src/nav-faculty.js` | ❌ নেই |
| `src/components/AuthModal.jsx` | ✅ আছে (৩৫৭ লাইন) — `variant="faculty"` prop এতে যোগ করতে হবে |

Reference pattern ফাইলগুলো (সবগুলো verify করা, সব আছে ও readable):
`useIsStaff.js`, `RequireCR.jsx`, `kuetEmailVerify.js`, `nav.js`, `groupSync.js`,
`staffRoles.js`।

---

## ১৫. পরবর্তী ধাপ

**Phase 1 (Foundations) দিয়ে শুরু** — এখনই করতে হবে:
1. `src/lib/facultyEmailVerify.js` — `kuetEmailVerify.js`-এর mechanism reuse
   করে, কিন্তু suffix-match logic (`*.kuet.ac.bd` বাদে `@stud.kuet.ac.bd`) এবং
   `verifiedFacultyEmails/{email}` collection দিয়ে
2. `src/lib/facultySync.js` — `faculty/{uid}` CRUD, `groupSync.js`-এর
   identity-stamp pattern অনুসরণ করে
3. `src/hooks/useIsFaculty.js` — `useIsStaff.js`-এর pattern কপি (parallel
   founder+role check, sessionStorage cache, `isResolved` flag) — কিন্তু এখানে
   `founder` না, `faculty/{uid}.verifiedAt != null` চেক করবে
4. `src/components/RequireFaculty.jsx` — `RequireCR.jsx`-এর guard-pattern কপি,
   English copy (Deviation 3)
