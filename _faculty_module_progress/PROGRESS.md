# Faculty Module — Progress Tracker

> Single source of truth for build state: `MERGED_FACULTY_MODULE_PROMPT.md`
> (merges old `PROMPT.md` deviations onto `KUETx_Faculty_Module_FINAL_PROMPT.md`).

## Status: Phase 1 — Foundations ✅ DONE

Confirmed via codebase audit (zip dated 2026-07-11) that none of Phase 1's
files existed yet — this is a genuine fresh start, not a resume.

### Files created this session
- `src/lib/facultyEmailVerify.js` — suffix-check (`*.kuet.ac.bd`, hard-excludes
  `@stud.kuet.ac.bd`) + magic-link mechanism, mirrors `kuetEmailVerify.js`
  exactly but writes to `verifiedFacultyEmails/{email}` via a separate
  secondary Firebase app instance (`kuetFacultyVerify`).
- `src/lib/facultySync.js` — `faculty/{uid}` CRUD: `createFacultyAccountDoc`
  (starts `verifiedAt: null`), `markFacultyVerifiedIfEmailConfirmed` (re-checks
  `verifiedFacultyEmails` before writing `verifiedAt` — hard gate enforced
  server-side-adjacent, not just in UI), `saveFacultyProfile`,
  `subscribeFacultyDoc`, `isFacultyProfileComplete`.
- `src/hooks/useIsFaculty.js` — mirrors `useIsStaff.js`'s parallel
  Founder-bypass + real-role check pattern, sessionStorage optimistic cache,
  `isResolved` flag for guards to wait on.
- `src/components/RequireFaculty.jsx` — mirrors `RequireCR.jsx`'s guard
  pattern. Three states: loading / Founder-bypass-or-verified (pass through)
  / unverified-but-has-account (holding screen, distinct copy) / no-account
  (generic denied). All copy in English per Deviation 3.

All 4 files syntax-checked with `@babel/core` (`@babel/preset-react`) — no errors.

### Not yet wired up (belongs to later phases, noted so it isn't forgotten)
- `App.jsx` doesn't call `createFacultyAccountDoc`/`markFacultyVerifiedIfEmailConfirmed`
  anywhere yet — that wiring is Phase 2 (Auth Branch: Role Select, AuthModal
  `variant="faculty"`, verification holding screen, `buildQueue()` update).
- No Firestore rules written yet for `faculty/{uid}`, `verifiedFacultyEmails/{email}` —
  belongs to §10 pass, done after Phase 8 per Build Order, but the client-side
  files above assume:
  - `faculty/{uid}`: create/update allowed for `request.auth.uid == uid`,
    EXCEPT the `verifiedAt` field must not be client-writable directly (only
    the Cloud-side-equivalent path this file uses should set it) — flag this
    explicitly when rules are written, otherwise the hard gate is bypassable
    by anyone who can write their own `faculty/{uid}` doc.
  - `verifiedFacultyEmails/{email}`: writable only via the secondary
    `kuetFacultyVerify` app's authenticated session (mirrors `verifiedRolls`
    rule shape), read-only from the main session.
- `facultyDirectory` / `facultyApplications` collections intentionally NOT
  created — Deviation 1 removed them from the live gate; they stay purely
  hypothetical unless a later Admin-visibility feature actually needs them.

## Status: Phase 2 — Auth Branch ✅ DONE

### Files created this session
- `src/lib/accountRole.js` — local `accountRole` flag (`'student' | 'teacher'`),
  self-reported UI-routing only, never a security boundary.
- `src/components/RoleSelectScreen.jsx` — one-time bilingual (Bangla/English)
  screen, §5 Step 1's deliberate exception to Deviation 3.
- `src/components/FacultyVerifyHoldingScreen.jsx` — hard-gate holding screen,
  auto-advances via live `subscribeFacultyDoc`, no manual "I've verified"
  button (mirrors the student KUET-email auto-poll pattern per §12
  Ambiguity Protocol). English copy throughout (Deviation 3).

### Files edited this session
- `src/components/AuthModal.jsx` — added `variant="faculty"` prop:
  - Suffix-gate (`isFacultyEmailFormat`) checked before submit on the
    register path only (not re-checked on login)
  - Calls `createFacultyAccountDoc()` right after Firebase account creation
  - No Google Sign-In button, no "skip for now" link, no Bengali copy
  - Everything else (password flow, typo/domain-warning UI, reset-password)
    reuses the exact same underlying `firebaseAuth.js` functions as the
    student path — no duplication of that logic
- `src/App.jsx`:
  - `buildQueue()` is now **async** (needs a Firestore read for the teacher
    branch) — the calling `useEffect` and `handleAuthSuccess` were both
    updated to `await`/`.then()` it; guarded with a `cancelled` flag against
    stale application after a fast unmount/re-auth
  - New queue steps: `'role-select'` (always first if `accountRole` unset),
    `'faculty-verify'` (hard gate, before `'profile'` for teachers)
  - `'auth'` step branches: `variant="faculty"` `AuthModal` (register-only,
    `isUpgrade={false}`) for `accountRole === 'teacher'`, else the original
    student `AuthModal` unchanged
  - `'profile'` step now guarded to `accountRole !== 'teacher'` for the
    existing `ProfileSetupModal`, plus a **temporary placeholder** for the
    teacher case (see "Known gap" below)

All edited/created files syntax-checked with `@babel/core` — no errors.

### Known gap — intentional, not a silent assumption
`FacultyProfileSetupModal.jsx` (§8.3: Name/Title/Department/Phone/Office/
Photo/preferredName) is explicitly Phase 4 work ("Core Loop"), not Phase 2
("Auth Branch"). A verified teacher whose `faculty/{uid}` doc still has
`name`/`title`/`dept` unset currently sees a **temporary placeholder** in
`App.jsx` (clearly labeled "coming soon" in its own comment, with a
"Continue" button that just advances the queue) rather than a real form.
This is flagged here explicitly per Working Method (§12) rather than
silently building a half-spec'd form now — the real modal belongs to Phase
4 and should follow `ProfileSetupModal.jsx`'s wizard/step-index UX exactly,
per §8.3.

### Not yet wired up (belongs to later phases)
- Firestore rules for `faculty/{uid}` write restrictions (`verifiedAt` must
  not be client-writable directly) and `verifiedFacultyEmails/{email}` —
  still belongs to the §10 pass after Phase 8, as originally planned.
- Cross-device "needs-email" prompt for the magic-link flow (student side
  has `KuetVerifyEmailConfirmModal` for this case) — `FacultyVerifyHoldingScreen`
  currently no-ops on `'needs-email'`, matching the note left in that file's
  comments. Not required for Phase 2; can be added alongside Phase 4 or
  later without touching the hard-gate logic itself.
- Founder's Role-Select skip (§7: "Founder's existing session skips this
  step entirely") — not yet implemented; currently a Founder account with no
  `accountRole` set would still see Role Select once. Flagging this now
  rather than silently patching `buildQueue()` further without re-reading
  how `useIsStaff()`'s Founder check is best invoked from a plain (non-hook)
  async function context — needs a short design decision, not a guess.

## Status: Phase 3 (Shell) + Phase 4 (Core Loop) ✅ DONE

Did both phases together this session since Phase 4's core deliverable
(My Classes + Add Class flow) needed the shell (nav, routes, RequireFaculty
wiring) to actually be reachable — building them separately would have left
Phase 3 untestable on its own anyway.

### Phase 3 — Shell

Files created:
- `src/nav-faculty.js` — NAV_FACULTY per §6.1, read the *current* `nav.js`
  fresh first (confirmed the `Notice` hub entry from the parallel
  Notification track, no conflict — separate file).
- `src/pages/faculty/FacultyDashboard.jsx` — placeholder (§8.11 real content
  is Phase 8).

Files edited:
- `src/components/nav-system/SubgroupHub.jsx` — added `navSource` prop
  (default `NAV`), threaded through `resolveSection()`. Every existing
  call site is unaffected (prop is optional).
- `src/components/Sidebar.jsx` — `viewMode` state (`'student' | 'teacher'`),
  derived as: Founder → their own `localStorage` preference; real faculty
  → always `'teacher'`; everyone else → always `'student'`. Founder-only
  switch pill added in the header. `filteredNav`/`findNavItem` branch on
  `activeNavSource` (`NAV` vs `NAV_FACULTY`). Unread-notice badge now
  matches either `'Notice'` (student) or `'Notices'` (faculty) group name.
- `src/components/BottomNav.jsx` — same `viewMode` derivation duplicated
  (not extracted to a shared hook yet — see note in that file's comments:
  no second real consumer beyond Sidebar.jsx yet, so a shared hook felt
  premature). `FIXED_BUTTONS` renamed to `STUDENT_FIXED_BUTTONS`, new
  `FACULTY_FIXED_BUTTONS` (Home → Classes → Schedule → Campus), whole set
  swapped per §6.2, not appended. `ProfileButton` extended for the
  faculty-mode 5th-button destinations.

**Founder Role-Select skip (flagged as blocked in the Phase 2 update)**:
resolved by NOT touching `buildQueue()` again — instead, `useIsFaculty()`'s
`isFounderBypass` already exists and is exactly what Sidebar/BottomNav now
use for `viewMode`. A Founder's `accountRole` being unset only affects the
one-time Role Select screen in the onboarding queue, not `viewMode` (which
is a separate, always-live derivation). Decided NOT to also special-case
`buildQueue()` for Founder — a Founder seeing Role Select once and picking
either option has no real consequence, since `viewMode` overrides it
completely via `isFounderBypass` regardless of what `accountRole` ends up
set to. Flagging this resolution explicitly rather than leaving it silently
half-done: if this call turns out wrong (e.g. Founder onboarding needs to
feel more polished), it's a one-line addition to `buildQueue()`
(`if (isFounderBypass) return [...q without role-select]`), not a redesign.

### Phase 4 — Core Loop

Files created:
- `src/lib/timeModels.js` — TIME_MODELS/DAYS duplicated from Schedule.jsx's
  local (non-exported) constant — see that file's header comment for why
  this is a known, flagged duplication rather than a refactor of
  Schedule.jsx (2600+ lines, out of scope to safely touch here).
- `src/lib/facultyClassSync.js` — `facultyAssignments` + `classIndex` CRUD:
  `createFacultyAssignment`, `joinFacultyAssignment` (enforces exactly-2
  cap per Deviation §2 item 4), `endFacultyAssignment`/
  `softDeleteFacultyAssignment`/`restoreFacultyAssignment` (status-flag
  pattern, not a literal reuse of `groupSync.js`'s `softDeleteEntry` since
  that helper's queries are hardcoded to the `routineEntries` collection
  shape — same PATTERN, different collection, per §0's own reuse framing),
  `findJoinableAssignment` (§4 item 2 best-effort join-offer, never a hard
  block).
- `src/lib/facultyNoticeSync.js` — `postFacultyNotice`, deliberately NOT
  reusing `groupSync.js`'s `postGroupNotice()` as-is because that function
  hardcodes `getIdentityStamp()` (roll-shaped, student-only — the exact
  mismatch flagged back in Phase 1's notes). Writes the same
  `groups/{groupId}/notices` collection with `from: 'Teacher'`,
  `noticeType`, `targetType` per §8.10.
- `src/pages/faculty/FacultyClasses.jsx` — My Classes card grid + Add Class
  modal (Dept → Batch → Term → Course cascading selects, sourced from
  `store.js`'s `DEPARTMENTS`/`BATCH_START_DATES`/`TERM_KEYS` and
  `curriculumStore.js`'s `getDeptTerms(deptCode)` — deliberately NOT
  `getAllCourses(profile)`, which is keyed to a student's own current term
  and can't list an arbitrary dept+term a teacher picks for someone else's
  batch). Day/time slot + join-offer UI included.
- `src/pages/faculty/FacultyProfile.jsx` — functional (not wizard-styled)
  form wired to real `facultySync.js` reads/writes, upgrading the "coming
  soon" placeholder `App.jsx`'s queue pointed to after Phase 2. The full
  `ProfileSetupModal.jsx`-style wizard UX is still explicitly open (see
  "Known gap" below) — this is a working stand-in, not the final form.
- `src/pages/faculty/FacultySchedule.jsx` — simple list view of each active
  class's day/time slot(s) (not a grid layout matching `Schedule.jsx`'s
  visual grid — see "Known gap").
- `src/pages/faculty/FacultyNotices.jsx` — per-class notice feed (reuses
  `noticeUtils.js`'s `subscribeAllNotices`, scoped by a group picker since
  a teacher can teach multiple groups) + compose box (broadcast vs CR-only
  radio, §9.4/§8.10).
- `src/pages/faculty/FacultyContact.jsx` — simplified standalone version,
  NOT a literal reuse of `Footer.jsx`'s contact modal content (that
  component's `developerInfo` object is defined inline, not exported —
  duplicating it here would drift the moment one copy changes without the
  other). Flagged as an intentional simplification, not a silent one.

Files edited:
- `src/App.jsx` — added `/faculty/*` route block, all wrapped in
  `RequireFaculty` except none (every real destination IS gated). Hub route
  `/faculty/resources` reuses `SubgroupHub` via its new `navSource` prop
  rather than a duplicate hub renderer. `/faculty/question-bank` routes
  directly to the existing `QuestionBank.jsx` component unmodified — that
  component reads `getProfile()` internally for an optional dept-scoping
  convenience only; a faculty account with no student profile just gets
  `myDept = null`, which the component's existing code already treats as
  "no pre-scoping", so no wrapper/props were needed.

All new/edited files syntax-checked with `@babel/core` — no errors.

### Known gaps — intentional, flagged not silent
- **Faculty Profile is a functional form, not the full wizard.** §8.3 calls
  for `ProfileSetupModal.jsx`'s exact step-index UX. What's shipped now is
  a single-screen form using the same underlying `facultySync.js` calls —
  fully functional, just not the polished multi-step experience. Upgrading
  the UI later doesn't require any data-layer changes.
- ~~**Faculty Schedule is a list, not a grid.**~~ **RESOLVED** — rewritten
  as a real weekly grid matching `Schedule.jsx`'s visual language exactly
  (sticky header, day-column highlight, time-column styling, colored class
  chips), without touching `Schedule.jsx` itself. What's deliberately NOT
  copied: rowspan/lab-merging logic (a teacher's own schedule only ever
  places one class per slot, no CR-editing affordances needed here) — see
  the file's own header comment for the full reasoning.
- **Faculty Contact is simplified, not a literal Footer.jsx reuse** — see
  that file's own header comment. `developerInfo` isn't exported from
  `Footer.jsx`, so this page has its own minimal contact info instead of
  duplicating (and risking drifting from) that inline object.
- **Class Detail (§8.5) route is not yet added** — deliberately omitted
  rather than pointing `/faculty/classes/:id` at a placeholder. Adding it
  is a pure route addition later; `FacultyClasses.jsx`'s card `onClick`
  already targets the right URL shape (`/faculty/classes/:id?groupId=...`).
- **`viewMode` derivation duplicated** between `Sidebar.jsx` and
  `BottomNav.jsx` rather than extracted into a shared hook — flagged in
  both files' comments; worth doing once (if ever) a third consumer needs
  it, not preemptively.

## Status: Phase 5 (Class Detail Read-only Tabs) + Phase 6 (Sessions & Count) ✅ DONE

### Phase 5 — Class Detail Read-only Tabs

Files created:
- `src/pages/faculty/FacultyClassDetail.jsx` — `/faculty/classes/:assignmentId`
  route. Tab bar shows all 7 tabs from §8.5 up front (Students & CR,
  Syllabus, Schedule enabled; Sessions & Count, Attendance, Marks, Notices
  visible-but-disabled with a "Coming in a later phase" tooltip) so the tab
  bar's final shape is stable across phases rather than growing/shifting
  tabs in as they're built.
  - **Students & CR tab**: `ClassmatesList.jsx` reused directly with
    `showActions={false}` — that component already supports a read-only
    mode via this existing prop, so no edits to it were needed at all.
  - **Syllabus tab**: `curriculumStore.js`'s `getDeptSyllabus(deptCode)`,
    reading `.courses[courseCode]` for title/credit/contactHour/topics.
  - **Schedule tab**: reads the assignment's own `dayTimeSlots` directly
    (no shared component needed, it's just the array already on the doc).

Header actions (Edit day/time/co-teacher, End Class, Delete — §8.6) were
NOT built in this phase; flagged as the natural next step once Phase
6+ needs assignment-mutation UI anyway. This page currently only reads.

### Phase 6 — Sessions & Count

Files created:
- `src/lib/facultySessionSync.js` — `logFacultySession()`, writing into the
  SAME `groups/{groupId}/plannerLogEntries` subcollection CR/ACR's
  `quickLogClass()` (in `ClassManagement.jsx`) already writes to — this is
  a genuine **extension**, not a parallel counter, per §8.8's explicit
  requirement. Matches that function's exact doc shape (`courseId`,
  `displayName`, `type`, `teacherName`, `loggedAt`, `day`, `slot`, `note`)
  so CR's own Planner tab correctly sees and counts faculty-logged sessions
  too. Adds the `loggedBy: {uid, role, name}` field §8.8 asks for, on top
  of the same `updatedBy`-stamp convention every other `groups/{groupId}/*`
  collection uses (for its existing audit-log consistency) — computes an
  auto-incrementing `sequenceNumber` from the live log count rather than a
  separate counter doc.
  - Deliberately did NOT call `groupSync.js`'s `addPlannerLogEntry()`
    directly — traced that it internally calls `getIdentityStamp(profile,
    uid)` for the `updatedBy` stamp (roll-shaped, student-only), the exact
    mismatch flagged since Phase 1 and resolved the same way again here:
    write the doc directly instead of forcing faculty data through a
    student-shaped helper.

Files edited:
- `src/pages/faculty/FacultyClassDetail.jsx` — added `SessionsTab`
  component (course-scoped session count, "+1 Log Class" button, log list
  showing who logged each one — CR vs Faculty), enabled the `sessions` tab
  entry in `TABS`.

**`ClassManagement.jsx` itself was NOT edited** — per this session's own
scoping decision (flagged explicitly, not silently): that file's Planner
tab is deeply CR-permission-coupled (`isContentEditor()`-style gating,
`groupId`/CR role assumptions throughout a ~970-line file) and granting
faculty write-access by editing it directly risked breaking existing CR
behavior in ways this session couldn't fully verify. Writing into the same
underlying collection from a separate, faculty-scoped function achieves
the spec's actual requirement (shared session-count fact, visible to both
CR and faculty) without touching CR-only code at all. If a tighter
integration is wanted later (e.g. faculty logging FROM inside
`ClassManagement.jsx`'s own UI), that's a deliberate follow-up decision,
not an oversight.

All new/edited files syntax-checked with `@babel/core` — no errors.

## Status: Phase 7 (Attendance + Marks) + Phase 8 (the rest) ✅ DONE

### ✅ MARKS MODEL — corrected per direct project-owner confirmation

The earlier draft of this session had incorrectly tried to force-fit
`store.js`'s student-facing `MARK_WEIGHTS`/`getAttendanceMarks()` into the
Faculty Module and flagged a conflict as a result. The project owner
clarified the actual intended model directly, which is simpler and now
fully implemented:

- **Fixed**: each of the two teachers on a course gets exactly **45
  marks**. Total across both teachers = 90, fixed, never configurable.
- **Attendance is always its own separate component** within a teacher's
  45, computed as `(student's attendance % on this assignment) × (that
  teacher's own chosen weight for it) / 100` — a brand-new formula
  (`computeAttendanceComponentScore` in `facultyMarksSync.js`), NOT
  `store.js`'s `getAttendanceMarks()` (that function is confirmed to be
  the wrong fit — different formula, different purpose).
- **Everything else in that teacher's 45 is fully teacher-defined**: each
  teacher names their own components (CT, Assignment, Presentation, Quiz —
  any label, any count, any max) via a one-time setup step
  (`setTeacherMarkComponents`), as long as `attendanceWeight + sum(all
  other components) == 45`. This fully replaces the earlier
  `courseType`-branching design (Theory/Sessional/Project fixed field
  sets) — there is now ONE flexible per-teacher component system for
  every course type, confirmed as the correct model.

Files changed to implement this:
- `src/lib/facultyMarksSync.js` — replaced `computeAttendanceMarks()` with
  `computeAttendanceComponentScore(pct, attendanceWeight)`; added
  `setTeacherMarkComponents()` (validates the 45-total, throws a clear
  error otherwise) and `getTeacherMarkComponents()`. `saveStudentMarks()`
  itself needed no logic changes — it was already component-agnostic
  (just merges whatever `fields` object it's given), only its docstring
  was corrected.
- `src/pages/faculty/FacultyClassDetail.jsx` — `MarksTab` rewritten
  entirely around this model: a new `MarksSetupForm` sub-component (shown
  once per teacher per assignment if they haven't configured their
  breakdown yet — add/remove/name components, live running total with a
  red/green indicator, blocks saving unless the total is exactly 45), then
  the actual marks-entry table renders columns dynamically from
  `markConfig.components` instead of hardcoded Theory/Sessional/Project
  field sets.
- `src/lib/facultyPdfExport.js` — `marksTableRows()` made component-agnostic:
  derives its row list from whichever keys actually exist on each
  teacher's marks object (attendance always first, since every teacher
  always has it), instead of a `courseType`-keyed fixed field-name lookup.
- Firestore rules additions (`FACULTY_MODULE_FIRESTORE_RULES_ADDITIONS.rules`)
  needed NO changes for this — the per-teacher-slot write boundary check
  there only inspects the top-level `teacher1Marks`/`teacher2Marks` key
  names via `affectedKeys().hasOnly([...])`, never the field names inside
  them, so it was already compatible with teacher-defined components.

The earlier flagged "40 vs 45" discrepancy no longer applies — every
teacher's total is now guaranteed to be exactly 45 by
`setTeacherMarkComponents()`'s own validation before it will save.


### Phase 7 — Attendance + Marks

Files created:
- `src/lib/facultyMarksSync.js` — the file with the flagged conflict above.
  Also implements:
  - `createOrUpdateSessionAttendance`/`subscribeSessionAttendance` (§8.9) —
    writes to `groups/{groupId}/facultyAssignments/{id}/sessions/{sessionId}`
    per §3's own data model.
  - `computeStudentAttendancePercent(sessions, studentUid)` — 'late'/
    'excused' counted as attended, NOT absent. This is a judgment call
    §8.9 doesn't specify explicitly — flagged in the function's own
    comment as the one line to change if KUET policy treats it differently.
  - `saveStudentMarks` — Draft → Reviewed → Sent → auto-resend-on-edit
    (§9.1, no frozen state), full `history` audit trail, `teacherSlot`
    ('teacher1'/'teacher2') keeps each teacher's writes independent
    (§9.2). `sendAllReviewed` for §9.3's bulk action.
  - `getMyTeacherVerifiedRecords`/`subscribeMyTeacherVerifiedRecords` —
    student-side read, powers the new card below.
- `src/components/TeacherVerifiedCard.jsx` (§9.5 primary channel) — renders
  nothing at all unless real sent records exist; fully additive.
- `src/lib/facultyPdfExport.js` (§9.6) — `html2canvas` + `jsPDF`
  HTML-snapshot route (not raw jsPDF tables, per §13's rule). Individual
  student report + full-class summary, brand-palette styled.
- `package.json` — added `html2canvas` as a new dependency (`jspdf` was
  already present in this codebase).

Files edited:
- `src/pages/faculty/FacultyClassDetail.jsx` — added `AttendanceTab` (P/A/L/E
  per-student toggle, date-scoped, pre-fills from an existing session for
  that date so re-opening today's attendance doesn't blank it) and
  `MarksTab` (per-`courseType` field branching — Theory/Sessional/Project,
  Save Draft / Send buttons, per-student + class-wide PDF export buttons,
  Send All Reviewed). Both tabs enabled in `TABS`.
- `src/pages/Marks.jsx` — one import + one render call
  (`<TeacherVerifiedCard profile={profile} />`) inserted right after the
  existing header, before the "Content" section comment. Nothing else in
  this 443-line file was touched — no existing state, logic, or JSX
  restructured, per §2 item 6's "must not overwrite existing fields" rule.
- **`src/pages/Attendance.jsx` was NOT edited** — §9.5 names Term Planner
  (`Marks.jsx`) as the primary Teacher-Verified location; touching the
  larger, higher-risk `Attendance.jsx` (1071 lines) wasn't required by
  spec and was skipped to avoid unnecessary risk, matching this session's
  established caution pattern for large files.

**FLAGGED GAP — §9.5 secondary channel not wired.** The "existing Alerts
feed with `noticeType: 'marks_release'`" requirement was audited and found
to have no real hook point: `alertUtils.js`'s `computeAlerts()` is entirely
local-store-driven (no Firestore at all), and the existing
`groups/{groupId}/notices` collection is group-broadcast-shaped, not
per-student (posting a marks-release event there would incorrectly notify
the whole class about one student's grade). Building a real per-student
server-side alert channel is a genuinely new subsystem, not an extension of
an existing one — left undone rather than forced into either wrong shape.
Full detail in `facultyMarksSync.js`'s comment above `saveStudentMarks`.

### Phase 8 — the rest

Done:
- **Firestore rules (§10)** — written as `FACULTY_MODULE_FIRESTORE_RULES_ADDITIONS.rules`,
  a SEPARATE file with explicit splice instructions, rather than edited
  in-place into the real 663-line `firestore.rules`. Reasoning: a syntax
  mistake in a live security rules file breaks every collection's access,
  not just the Faculty Module's — too high-risk to hand-edit blind in this
  session without a way to actually deploy-test against the emulator.
  Covers `faculty/{uid}` (create-unverified-only, update-self-except-
  verifiedAt, the `exists(verifiedFacultyEmails/...)` check that's the
  actual hard-gate enforcement point), `verifiedFacultyEmails/{email}`,
  `facultyAssignments` (+ `sessions`/`studentRecords` subcollections, with
  the per-teacher-slot write-boundary enforced via `diff().affectedKeys()`,
  not just trusted client-side). **Part C (widening `plannerLogEntries`/
  `notices`'s existing create rules) is written as an instruction/pattern,
  NOT a verbatim diff** — this session grepped for structure but did not
  re-read those two match blocks' exact current lines, so applying Part C
  requires opening the real file and finding the exact text by hand.
- **Admin Faculty category (§7)** — `founderCategories.js` got a new
  `faculty` entry (Directory/Signup Requests/Class Assignments
  subcategories); `AdminDashboard.jsx` got a new `FacultyView` component
  (follows the exact null-first flicker-fix pattern from Phase A) + one
  dispatch line. **Caught and fixed a real Rules-of-Hooks bug during this
  edit**: the new `useState`/`useEffect` for `facultyList` were initially
  placed after the component's `if (!authorized) return null` early
  return — moved above it, matching every other hook in that component.
  Flagging this explicitly since it's the kind of mistake that would have
  broken the ENTIRE Admin Dashboard at runtime (not just the Faculty tab)
  if it had shipped, not just a Faculty Module-scoped bug.
  - `assignments` subcategory shows a placeholder (cross-group
    `facultyAssignments` listing needs a `collectionGroup` query, which
    §10's own rule-writing guidance cautions against — not added
    speculatively without confirming an index exists for it).
- **Dashboard stats (§8.11)** — NOT done this session; `FacultyDashboard.jsx`
  is still Phase 3's placeholder. Not reached due to time; flagged as the
  cleanest remaining well-scoped task for a future session (career stats
  card, classes-remaining count, Founder-switch line, pending-attendance
  reminder — all straightforward reads from data structures that already
  exist: `faculty/{uid}/classIndex`, `facultyAssignments`, `sessions`).

NOT done — **CR-side disambiguation (§8.7)**, flagged as a real blocker,
not an oversight:
- Audited `TeacherSelector.jsx` closely: `selectedTeachers` is a plain
  `string[]` (just names) end-to-end — `onTeachersChange(updated)` always
  passes back a new array of strings, and `CourseTeacherDialog.jsx` (its
  only known caller) presumably expects that same shape. Adding a
  `facultyUid`/`gridAlias` concept per §8.7 means changing the data shape
  to `{name, facultyUid?, gridAlias?}[]` — a breaking change to both
  files' contract, not an additive one. This session did not trace
  `CourseTeacherDialog.jsx`'s own caller(s) or the Firestore write shape
  the resulting array feeds into (`routineEntries.teacherNames`,
  presumably), so making this change blind risked silently breaking the
  existing CR teacher-assignment flow in ways this session couldn't verify.
  **Left undone rather than risked** — a future session should first trace
  the full write path (`CourseTeacherDialog` → whatever calls it → the
  exact `routineEntries` field written) before touching either file.

All new/edited files syntax-checked with `@babel/core` — no errors. The
Rules-of-Hooks bug above was NOT something babel's syntax check would have
caught (it's valid JS syntax, just wrong React usage) — worth remembering
that a clean babel pass doesn't guarantee no runtime bugs.

## Status: FINAL CLEANUP PASS — all previously-flagged gaps closed

This session revisited every item on the prior "Next step" list and either
closed it for real or corrected an earlier wrong assumption. One genuinely
serious bug was caught and fixed in the process (see below) — worth reading
even if skimming the rest.

### 🛑 Critical bug caught and fixed: `FacultyClassDetail.jsx` had NO default export

During Phase 7's `MarksTab` rewrite (the Python-script wholesale
replacement that swapped in the flexible marks-components model), the
line-range slice used to splice in the new code accidentally cut out the
entire `export default function FacultyClassDetail() { ... }` wrapper —
the tab bar, the header, the assignment-loading logic, and the dispatch
that decides which tab component renders. The file still had valid syntax
(babel passed it every time it was checked), so this went undetected
through the rest of Phase 7 and all of Phase 8 — **a clean babel pass does
not guarantee the file actually exports what its importer expects.**

This was only caught by a project-wide static cross-file import/export
consistency check run at the start of this cleanup pass (see the
methodology note at the end of this section) — not by babel, not by
anything tried earlier. Every route under `/faculty/classes/:id` — meaning
all of Phases 5, 6, and 7's tab work — would have rendered nothing (a
runtime "does not provide an export named default" error) until this was
found and the wrapper reconstructed. Fixed now; verified the reconstructed
version matches the last-known-good structure (header, 7-tab bar with the
now-3-newly-enabled tabs wired to their components, loading/no-groupId
states) and re-passed both babel and the cross-file check.

**Takeaway for future sessions**: after any large wholesale text-splice
edit (Python script, sed range-delete, etc.) to a file with a default
export, explicitly grep for `export default` to confirm it survived —
babel syntax-checking a file is not the same as confirming its public
shape is intact.

### Item 1 (Firestore rules) — ✅ actually spliced into the real file

The earlier separate `FACULTY_MODULE_FIRESTORE_RULES_ADDITIONS.rules`
splice-instructions file is superseded — this session had more room to
verify carefully, so the real `firestore.rules` (663 lines) was edited
directly: `isVerifiedFaculty`/`isVerifiedFacultyFor` helpers added after
`isContentEditor`; `faculty/{uid}` + `verifiedFacultyEmails/{email}`
top-level collections added after `verifiedRolls`; `facultyAssignments`
(+ `sessions`/`studentRecords` subcollections) added inside
`groups/{groupId}`, right after `notices`; `plannerLogEntries` and
`notices`'s existing create/update rules widened in place (both exact
existing lines were re-read directly this time, not paraphrased).

**A second real bug was caught and fixed while writing this**:
`studentRecords`'s write rule originally used a single `allow write` with
`request.resource.data.diff(resource.data)` — but `resource` doesn't exist
on a genuine Firestore `create` (the very first save for any student,
which `saveStudentMarks()` always triggers via `setDoc(...,{merge:true})`),
so `.diff()` would throw at runtime and **break the very first marks save
for every single student**. Split into separate `allow create` (checks
`request.resource.data.keys()` only) and `allow update` (safely diffs
against `resource.data`) rules.

Brace/paren balance verified (118/118, 535/535). Full `firebase deploy
--only firestore:rules --dry-run` compile-check was NOT possible in this
sandbox (no network/auth for firebase-tools) — this is the one piece of
this fix that still needs a real deploy-environment verification, though
the rule syntax was checked line-by-line against the existing file's own
established patterns rather than invented fresh.

Also added: `firestore.indexes.json` got a new `collectionGroup:
facultyAssignments` index (status ASC + createdAt DESC), needed for the
Admin cross-group assignments listing below. Valid JSON confirmed.

### Item 2 (§8.7 CR-side disambiguation) — ✅ done, and the earlier blocker was based on a wrong assumption

This session actually traced the full call chain (not done carefully
enough in the earlier pass) and found the earlier flagged blocker was
based on an incorrect premise:

- **Wrong earlier assumption**: `TeacherSelector.jsx` feeds
  `CourseTeacherDialog.jsx`, and changing their shared `string[]` shape
  would break 6+ pages.
- **Actual traced reality**: `TeacherSelector.jsx` has **zero callers
  anywhere in the codebase** — it's dead code, nothing renders it, there
  was never a shared-shape risk. `CourseTeacherDialog.jsx` is a completely
  separate, simpler component (two plain text inputs), and its output
  feeds `store.js`'s `courseTeacherMap` — **entirely local device storage**,
  never synced to Firestore. The REAL Firestore-shared field CR/teacher
  disambiguation needs to work against is
  `groups/{groupId}/routineEntries/{id}.teacherName` (a single string,
  written from `Schedule.jsx`, which explicitly strips the local-only
  `teacherNames` array before writing to Firestore).

Given this corrected understanding, implemented as fully additive,
zero-risk pieces:
- `src/lib/facultyDisambiguation.js` — best-effort name-matching between a
  routine entry's free-text `teacherName` and any active
  `facultyAssignments`' `displayName`/`gridAlias` in the same group.
- `src/components/TeacherClaimBanner.jsx` — informational banner (mirrors
  `ClaimCRCard.jsx`'s "renders nothing until resolved" UX pattern per
  §8.7's own instruction), dismissible per-entry via localStorage.
- `src/pages/Schedule.jsx` — **exactly 2 lines added** (one import, one
  conditional render `{isGroupMode && <TeacherClaimBanner groupId={groupId} />}`)
  right after the existing header card, before the grid. Nothing else in
  this 2681-line file was touched — confirmed via `diff` against the
  original, showing only those two additions.

### Item 3 (§8.11 Dashboard stats) — ✅ done

`FacultyDashboard.jsx` rewritten with real content: active-classes count,
de-duplicated unique-students-taught (§2 item 13 — genuine `Set` union
across every active assignment's roster, not a raw per-assignment sum),
classes-remaining (only counted where `plannedTotalClasses` is actually
set, since it's optional at creation), Founder-switch line (only rendered
when `isFounderBypass`), and a pending-attendance-today reminder (active
assignment scheduled for today's weekday with no session doc yet for
today's date, linking straight to that class's Attendance tab).

### Item 4 (§9.5 secondary Alerts channel) — ✅ done, turned out simpler than expected

Re-examined rather than accepting the earlier "needs a whole new
subsystem" conclusion. `TeacherVerifiedCard.jsx` (built in Phase 7) is
*already* a live Firestore subscription, already scoped to the student's
own group, and already renders nothing until a real `'sent'` record
exists — mounting that SAME component on `Alerts.jsx` (right after the
existing `ClassNoticesPanel`, matching that exact same
already-established additive-mount pattern) satisfies §9.5's "secondary
channel" requirement without inventing a second notification pathway that
would need to be kept in sync with the first. `alertUtils.js`/
`computeAlerts()` were NOT touched at all.

### Item 5 (final regression pass) — done as thoroughly as this sandbox allows

No live dev server/browser is available in this environment, so a literal
click-through wasn't possible. Instead, ran:
1. Full babel syntax check on every one of the 33 edited/created files
   (all pass).
2. A project-wide static cross-file import/export consistency checker
   (Python script, walks every file, extracts every `export function`/
   `export const`/`export default`, then verifies every relative import
   anywhere in the edited-file set actually resolves to something that
   exists) — this is what caught the `FacultyClassDetail.jsx` missing
   default-export bug above. Re-run after the fix: **zero issues**.
3. Manual verification that `Schedule.jsx`'s diff against the original is
   exactly the 2 intended lines, nothing else.
4. Direct visual re-inspection of both `AdminDashboard.jsx` hook-ordering
   sites (the main component and the separate `FacultyView` component) to
   confirm the earlier Rules-of-Hooks fix held and no new violation was
   introduced by this session's edits.

This is NOT a substitute for actually running the app and clicking
through Login → Schedule → Marks → Attendance → CR flow once a real
dev/staging environment is available — that step is still open and
should happen before this ships to real users, especially given how
serious the `FacultyClassDetail.jsx` bug was and how silently it would
have shipped without the static check above.

## Everything from the original 8-phase build order is now built and verified to the extent this sandbox allows

Genuinely remaining open items, none of them blockers to a first real
deploy attempt, all clearly bounded:
1. **Deploy-environment verification of `firestore.rules`** — `firebase
   deploy --only firestore:rules --dry-run` (or the emulator) against a
   real project, since this sandbox has no network/auth for that.
2. **A real click-through regression pass** in an actual dev/staging
   environment — Login, Schedule (student + CR modes), Marks, Attendance,
   CR flow, then the whole `/faculty/*` flow end to end (signup → verify →
   profile → add class → sessions → attendance → marks → PDF export).
3. `FacultyProfile.jsx` is still a functional single-screen form, not the
   full `ProfileSetupModal.jsx`-style wizard §8.3 describes — noted back
   in Phase 4, still true, still just a polish item, not a functional gap.
4. `npm install` needs to actually run in the real project to pull in
   `html2canvas` (added to `package.json` in Phase 7) before the PDF
   export feature can work.



