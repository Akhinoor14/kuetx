# Attendance Tab Rebuild — Master Plan

**Progress badge (per documentation/README.md §৪'s required format):**
- [x] DONE — Phase A: Roster generation core
- [x] DONE — Phase B: Data model migration (uid-keyed → roll-keyed)
- [x] DONE — Phase C: Merged roster + backlog students
- [x] DONE — Phase D: Desktop UI rebuild
- [x] DONE — Phase E: Mobile UI rebuild
- [x] DONE — Phase F: Date auto-detect from schedule
- [x] DONE — Phase G: Excel + PDF export
- [x] DONE — Phase H: Multi-teacher session-collision fix + My/All toggle
      (2 small open items left, not blocking — see Progress Log bottom entry)
- [x] DONE — Phase I: Co-teacher invite code
      (3 small open items left, not blocking — see Progress Log bottom entry)

**Resume instruction:** every phase above is DONE — there is no queued
next phase. If this file is fed to a new session, start by asking
Akhinoor which of the small open items (listed in the last two Progress
Log entries) to pick up, or whether there's new scope to add as a new
Phase J. Don't assume a next phase — check the badges above first.

**This file is the single source of truth/hand-off doc for this feature.**
Any AI or dev picking this up: read this whole file top to bottom before
touching code. Update the "Progress Log" section at the bottom after
*every* phase — that section always tells you exactly what to do next.

---

## 1. The problem, in plain terms

Right now `AttendanceTab` (in `src/pages/faculty/FacultyClassDetail.jsx`,
function starts at the `function AttendanceTab(...)` line) only shows
students who already have a real KUETx account and are in
`groups/{groupId}/members` (a Firestore subcollection keyed by Firebase
uid). Screenshot evidence: a class of 13 "students" shown is really just
13 people who happened to register — not the department's real roster.

A teacher taking attendance needs to see **every roll number that could
possibly be in that batch+dept+section**, whether or not that student has
ever opened KUETx. Right now roll numbers with no account are simply
invisible — attendance for them can't be recorded at all.

## 2. What we already have (don't rebuild these)

Read this section carefully — a lot of the infrastructure Akhinoor asked
about ("kivabe connect korbo the two teachers?") **already exists**:

- **Roll number format is fully decodable.** `src/store/store.js` has
  `ROLL_DEPT_MAP` (2-digit dept code) and roll format is a strict 7-digit
  string: `[batch 2-digit][dept 2-digit][seat-in-dept 3-digit]`, e.g.
  `2313014` = batch 23, dept digits `13` (ESE per `ROLL_DEPT_MAP`), seat
  `014`. `getDeptCodeFromRoll()` and `extractBatchFromRoll()` already do
  this parsing one direction. We need the **reverse**: given batch + dept
  + seat count, generate every possible roll. That's pure arithmetic, no
  new data entry needed from Akhinoor — the seat-count table he pasted is
  already in `DEPARTMENTS` (`store.js` line ~364) and it matches exactly.
- **groupId = dept+batch(+section) bucket already.** `getGroupId()` in
  `src/lib/groupUtils.js` returns e.g. `2K23_ESE` (matches the screenshot
  URL `?groupId=2K23_ESE`). This is exactly the right anchor to generate
  "every roll in this batch+dept+section."
- **Multi-teacher / co-teacher connection is ALREADY BUILT.** This
  answers Akhinoor's question directly — no new feature needed here:
  - `facultyAssignments/{assignmentId}` already stores `teacherUids: []`,
    max 2 entries (`src/lib/facultyClassSync.js`).
  - When a second teacher goes to **"+ Add Class"** and picks the exact
    same dept+batch+section+term+course, `findJoinableAssignment()` (used
    in `FacultyClasses.jsx`) silently detects the existing assignment and
    shows a **"Join"** option instead of letting them create a duplicate
    class. Clicking Join calls `joinFacultyAssignment()`, which appends
    their uid to `teacherUids`. No code-sharing, no invite link needed —
    it's automatic based on matching course selection.
  - Once joined, `teacherSlot` (`'teacher1'` or `'teacher2'`, resolved by
    array index) already gates **separate Marks entry** per teacher
    (`MarksTab` in `FacultyClassDetail.jsx`) — each teacher has their own
    45-mark quota split (`teacher1MarkComponents` / `teacher2MarkComponents`
    Firestore fields).
  - **Gap found:** `AttendanceTab` does NOT currently check `teacherSlot`
    at all — both teachers, if joined, can currently mark attendance with
    no distinction of who did what beyond the generic `loggedBy` field.
    This is fine to leave as-is (attendance is usually a single shared
    log, unlike marks) — flag this to Akhinoor as a design decision, not
    a bug, in Phase A kickoff.
  - **Action needed:** just surface this existing Join flow more clearly
    in the UI/docs so Akhinoor knows it's there — no backend work.
- **PDF export infra exists.** `src/lib/facultyPdfExport.js` uses
  `jsPDF` + `jspdf-autotable` (already in `package.json`), with
  `exportClassSummaryPdf()` as a close precedent for the new attendance
  sheet export.
- **No Excel (.xlsx) library yet.** Will add `xlsx` (SheetJS) via npm —
  small, client-side, no backend needed (matches the Spark-plan
  constraint).
- **Firestore write rules are already scoped correctly.** Attendance
  writes go through `groups/{groupId}/facultyAssignments/{assignmentId}/
  sessions/{sessionId}`, gated by `teacherUids[0/1] == request.auth.uid`
  (`firestore.rules` ~line 2868). None of this needs to change — the new
  "full roll roster" is a *read-side, client-generated* list, not a new
  Firestore collection, so existing rules are untouched.

## 3. What's actually new (the real work)

### 3a. Full-roster generation (core of the whole feature)
A new pure function, e.g. `generateDeptRollRoster(dept, batch, section)`
in `src/lib/groupUtils.js` (alongside `getGroupId`, same file, same
import surface everywhere that needs it):
- Looks up `dept`'s seat count from `DEPARTMENTS`.
- Looks up dept's 2-digit code from the reverse of `ROLL_DEPT_MAP`
  (needs a reverse map, e.g. `DEPT_ROLL_DIGITS`, built once from
  `ROLL_DEPT_MAP`).
- Batch's 2-digit prefix: batch strings look like `2K23` → need `23`.
  Check `extractBatchFromRoll`'s inverse logic carefully here — reuse
  existing normalization if any exists, otherwise write a small
  `batchToRollPrefix('2K23') -> '23'` helper.
- Returns array of `seats` roll strings, zero-padded 3-digit seat number,
  e.g. `['2313001', '2313002', ..., '2313030']` for a 30-seat dept.
- **Multi-section depts (CE/EEE/ME/CSE):** seat range must be split
  in half per section (A = seats 1..60, B = seats 61..120, for 120-seat
  depts) — confirm this splitting convention with Akhinoor before coding
  (KUET's actual admin convention may not be a clean half-split; flag as
  an open question in Phase A, don't guess).
- **Seat counts are DEFAULTS, not hard caps — confirmed by Akhinoor
  2026-08-15.** The real number of students in a batch+dept can be
  slightly higher than the official seat count (extra 1-3 students from
  re-admission, transfer, etc. — e.g. 122 real students in a nominally
  120-seat CSE batch). The generated roster from this function is a
  *starting default only*; it must NEVER be treated as an exhaustive/
  closed list anywhere downstream. Any roll outside the generated range
  is added the exact same way as any other extra student — through the
  same "add student" action used for backlog (see 3c), no separate
  mechanism needed. This also means: don't validate/reject a roll just
  because its seat number exceeds the dept's `seats` value anywhere in
  the UI or backlog-add flow — that check would incorrectly block a
  legitimate 122nd CSE student. Akhinoor also confirmed he'll eventually
  upload the real, authoritative student list — at that point actual
  names/rolls take over and the generated-range concept matters even
  less; build with that eventual reality in mind (i.e., don't hardcode
  assumptions that only the generated range is ever valid).

### 3b. Merge generated roster with real member data
In `AttendanceTab`, build a merged roster:
```
mergedRoster = generatedRollList.map(roll => {
  const realMember = members.find(m => m.roll === roll);
  return {
    id: realMember?.id || `placeholder:${roll}`,   // placeholder id = roll-based, stable across renders
    roll,
    name: realMember?.name || roll,                 // fallback: roll IS the name until account exists
    isPlaceholder: !realMember,
  };
}).concat(backlogEntries);  // see 3c
```
Sort by roll using existing `sortByRoll()` (already roll-aware,
reuse as-is).
- Attendance marks for a placeholder id key off `roll` string (not
  Firebase uid) since there's no uid yet. **Important:** when a real
  student later registers with that roll, their uid becomes the new key
  — old placeholder-keyed marks under `roll` as key would need a
  migration path. Simplest correct approach: **always key attendance
  records by roll number, never by uid**, for every student (placeholder
  or real) — sidesteps the whole migration problem entirely. This is a
  schema decision — flag clearly in Phase A output which of
  `createOrUpdateSessionAttendance`'s `attendance: {}` map keys change
  from uid to roll, and make sure `computeStudentAttendancePercent` /
  `computeAttendanceComponentScore` (used by Marks tab) are updated to
  match, since marks attendance-weighting reads the same sessions data.
  **DONE (Phase B) + refined:** `attendance` is 100% roll-keyed, no
  exceptions, and is the only thing any read path uses. A secondary
  `rollToUid` map was added on the session doc — audit-only, `{ roll:
  uid }` for rolls that had a real account at save time, merged/
  accumulated across saves, never read by any actual attendance-percent
  or UI logic. Purpose: if a data question ever comes up later ("which
  account was actually behind this roll on this date"), there's a real
  trail instead of nothing, at near-zero cost since the uid is already
  in hand when a save happens.

### 3c. Backlog / extra-student — manual add
This single "add student" mechanism covers TWO real-world cases, both
handled identically (confirmed with Akhinoor 2026-08-15 — no need to
distinguish them in the data model or UI flow, just in labeling if
helpful):
1. A genuine backlog student (from an earlier batch, doing a repeat
   course with this batch).
2. A regular student of THIS batch+dept+section whose roll simply falls
   outside the generated seat-range default (see 3a's note on seat
   counts being defaults, not hard caps — e.g. student #122 in a
   nominally-120-seat CSE batch).

- A "+ Add student" button/modal in the Attendance tab (and ideally also
  visible from Marks, since backlogs affect both — but scope this to
  Attendance only for Phase A/B, extend to Marks in a later phase if
  Akhinoor wants).
- Stores added entries in a new small Firestore doc, e.g.
  `groups/{groupId}/facultyAssignments/{assignmentId}/backlogStudents/{roll}`
  with `{ roll, name, addedBy, addedAt }` — scoped per-assignment (an
  added entry is specific to *this course offering*, not the whole dept
  group), so it doesn't pollute the dept's real member list or other
  courses' rosters. (Collection name kept as `backlogStudents` even
  though it also covers case 2 above — renaming later is cheap if
  Akhinoor wants a clearer name once he sees it in use.)
- Roll format: always the standard 7-digit KUET pattern
  (`/^\d{7}$/`, confirmed with Akhinoor — reuse `store.js`'s existing
  regex, don't write a new one). **Do not reject a roll just because its
  seat-number portion exceeds the dept's official `seats` count** — see
  3a, this is exactly the over-quota case this mechanism exists for.
- These merge into `mergedRoster` above, clearly tagged (e.g. small
  "Added" badge next to their row) so the teacher can tell them apart
  from the generated default roster.

### 3d. UI rebuild — desktop (spreadsheet-like)
Full visual rebuild of the roster list block (currently ~line 1236-1264
of `FacultyClassDetail.jsx`), per Akhinoor's spec:
- Column 1: Name + Roll stacked (existing pattern, keep) — OR flatten
  into two real columns for a truer spreadsheet feel; confirm preference
  during Phase C build (mock both, let Akhinoor pick).
- Column 2 (attendance marking): **simplify from the current 4-option
  P/A/L/E button row down to a 2-state toggle: Present (default,
  green) / Absent (click to flip, red).** This is an explicit,
  deliberate simplification per Akhinoor's request — confirm whether
  Late/Excused marks should be fully removed or just hidden from this
  quick-entry view (e.g. accessible via a "..." expand). **Do not
  silently drop Late/Excused from the data model** — `markColors`/
  `markLabels`/`marks` array and the Marks tab's
  `computeStudentAttendancePercent` logic (which treats `late` as
  present-equivalent) depend on those values existing; removing the UI
  option is fine, removing the underlying capability needs an explicit
  go-ahead.
- Default state when no mark exists yet for a date: **Present**, not
  blank — this is the "just click absentees" speed workflow. Needs a
  care-point: distinguishing "explicitly marked present" from "never
  touched, defaulted present" so `handleSave` doesn't write bogus
  present marks for a date the teacher never actually opened/saved. Only
  materialize the default-present value into `draftMarks` at save time,
  not at render time.
- Trailing columns (right side, same row): Total classes held so far,
  Present count for this student, Percentage — all derivable client-side
  from `sessions` (already fetched), reuse the existing
  `attendanceSummary` calc logic (~line 983-993) per-row instead of only
  in the separate summary card.
- Header row: class/course details + KUET branding block (dept name,
  course code/title, batch, term, teacher name(s), date) — this is the
  "print header" Akhinoor wants baked into the export, but showing it
  live in the UI too (as a compact header bar) keeps WYSIWYG consistency
  between on-screen and exported sheet.
- Export button: generates the Excel (default) or PDF (secondary option)
  of the *currently visible* table, header block included.

### 3e. UI rebuild — mobile (2-row swipeable)
- Row 1 (identity): defaults to Roll, swipe left↔right reveals Name.
- Row 2 (attendance): defaults to today's/selected date's mark, swipe
  left↔right cycles through other dates' marks (read history) — but the
  *editable* mark (today/selected date) should probably stay pinned as
  the default resting position after any swipe-away-and-back, so a
  teacher marking attendance doesn't lose their place. Needs a small
  interaction-design pass in Phase C — build a prototype, get Akhinoor's
  hands-on feedback before finalizing, this is exactly the kind of thing
  that reads fine as a spec but needs to actually be tried.
- Use a lightweight swipe/gesture approach — check if a swipe library is
  already in `package.json` (search before adding a new dependency).

### 3f. Date auto-detect from Class Setup schedule
- Currently `AttendanceTab` already defaults `date` to `todayStr()` and
  has an `isAutoDate` ref that re-syncs on tab focus (existing code,
  keep). The **new** piece: check today's day-of-week against
  `assignment.dayTimeSlots` (or `ScheduleTab`'s routine data via
  `subscribeRoutine`) — if today isn't a scheduled day for this class,
  should the date field still default to today, or default to the last
  scheduled class day? Confirm with Akhinoor in Phase A kickoff; his
  message says "ajker date ta mile tahole sei date ta default dekhabe" —
  reads as: only auto-set today if today IS a scheduled day, otherwise
  leave it for the teacher to pick manually. Implement that interpretation
  unless corrected.

### 3g. Excel + PDF export
- Add `xlsx` (SheetJS) as a new dependency (`npm install xlsx`).
- New file `src/lib/attendanceExport.js`:
  - `exportAttendanceExcel(assignment, mergedRoster, sessions, dateRange)`
    — builds a worksheet: header rows (KUET + class details), then one
    row per student (roll, name, per-date P/A columns or a summary
    range — confirm with Akhinoor whether export is "today's sheet" or
    "full term to-date sheet with a column per class date," since his
    message implies the latter — a full running register, not just a
    single day's snapshot).
  - `exportAttendancePdf(...)` — reuse `jsPDF`/`jspdf-autotable` pattern
    from `facultyPdfExport.js`'s `exportClassSummaryPdf` as the direct
    template.
- Both exposed via one "Export" button with a small format-choice menu
  (Excel default per Akhinoor, PDF secondary).

## 4. Open questions — ANSWERED (2026-08-15)

1. **Multi-section dept (CE/EEE/ME/CSE) split — ANSWERED.** Clean 60/60
   half split. Section A = seats 1-60, Section B = seats 61-120. A
   section toggle bar (Section A / Section B) sits above the roster,
   default view shows both as separate tabs. Teacher can:
   - **Add** a new student into either section (reuses the backlog-add
     mechanism from 3c, not a separate feature).
   - **Swap** a student from Section A to Section B or vice versa —
     keep this simple, no approval workflow, just a move action that
     updates which section's placeholder/backlog list the student sits
     in. Design as a lightweight action (e.g. a small "Move to Section
     B" button on the student row), not a dedicated modal/flow.
   - **Excel export combines both sections into one file** — the dept's
     full batch (both sections) exports together, not two separate
     downloads. This matters for Phase A's roster generator: it should
     have a mode that returns the FULL dept+batch roster (both sections
     merged, still section-tagged per student) for export purposes, in
     addition to the per-section view used for daily attendance-taking.
2. **Backlog student roll format — ANSWERED.** Always the standard
   7-digit KUET roll pattern (`/^\d{7}$/`, same regex already used
   elsewhere in `store.js` for `studentId` validation). No free-text
   rolls. Reuse the existing validation regex — don't write a new one.
3. **Excel export scope — ANSWERED.** Full running register: one column
   per class date held so far this term (like a physical attendance
   register), not a single-day snapshot. This is the bigger, more
   valuable build — plan `attendanceExport.js` (Phase G) around
   `sessions` (already fetched, one doc per held date) mapped to columns,
   roster rows down the side, matching the classic register look.
4. Late/Excused marks — still open, not urgent, decide during Phase D
   build (default to: keep in data model, hide from quick-entry UI,
   revisit only if Akhinoor flags it).
5. `teacherSlot` enforcement on Attendance — still open, not urgent,
   decide during Phase H (default to: leave attendance open to either
   joined teacher, unlike Marks — matches "attendance is usually a
   single shared log" reasoning in section 2).

## 5. Working discipline for every phase (per Akhinoor's standing rule)

- Read the actual current source fully before touching it — don't assume
  from this plan doc alone; the codebase may have shifted between
  sessions.
- Small, verifiable changes — one logical piece per phase, not a giant
  rewrite in one shot.
- Confirm a **zero-error `npm run build`** after every phase before
  packaging output.
- Every session's output: **two files** —
  1. This same `ATTENDANCE_REBUILD_PLAN.md`, **updated** (not replaced)
     — Progress Log section appended, phase statuses updated.
  2. A **full project ZIP** (not just changed files) — `node_modules`
     and `dist` excluded, everything else included, so the ZIP is always
     a complete, buildable drop-in replacement.

## 6. Phase breakdown

- **Phase A — Roster generation core.** `generateDeptRollRoster()` +
  reverse dept-digit map + batch-prefix helper in `groupUtils.js`. Unit-
  verify against a few known rolls (e.g. confirm `2313014` round-trips
  correctly for ESE batch 2K23). No UI changes yet. Resolve open
  questions #1 and #2 above before starting this phase.
- **Phase B — Data model migration (uid-keyed → roll-keyed attendance).**
  Switch `attendance: {}` map keys from uid to roll across
  `createOrUpdateSessionAttendance`, `computeStudentAttendancePercent`,
  `computeAttendanceComponentScore`, and `AttendanceTab`/`MarksTab`'s
  read sites. This is the highest-risk phase (touches existing saved
  data shape) — needs a migration/back-compat plan for any sessions
  already saved uid-keyed in production. Flag this explicitly to
  Akhinoor before writing migration code; do not silently assume old
  data can be discarded.
- **Phase C — Merged roster + backlog students.** Wire
  `generateDeptRollRoster()` into `AttendanceTab`, add the backlog
  add-student modal + Firestore doc, build the merged/sorted roster list
  with placeholder-vs-real-vs-backlog tagging.
- **Phase D — Desktop UI rebuild.** Spreadsheet-style columns, 2-state
  Present/Absent toggle with default-present-on-save behavior, trailing
  total/percentage columns, header block.
- **Phase E — Mobile UI rebuild.** 2-row swipeable view (roll↔name,
  today↔history).
- **Phase F — Date auto-detect from schedule.**
- **Phase G — Excel + PDF export.** Add `xlsx` dep, build
  `attendanceExport.js`, wire the Export button + format picker.
- **Phase H — Multi-teacher visibility polish (small).** No new backend
  — just make the existing Join flow more discoverable/documented in the
  Attendance tab context (e.g. a note or link near the roster if
  `teacherUids.length < 2`), plus decide/resolve open question #5.

## 7. Progress Log

*(Every phase's session ends with an entry here. Newest at the bottom.
Next AI/dev: your starting point is always the last entry's "Next up"
line.)*

- **2026-08-15 — Planning session.** Read `FacultyClassDetail.jsx`
  (`AttendanceTab`, `MarksTab`), `groupSync.js` (`subscribeMembers`),
  `facultyClassSync.js` (assignment + join-teacher flow),
  `facultyMarksSync.js` (session/teacherSlot schema), `groupUtils.js`
  (`getGroupId`), `store.js` (`DEPARTMENTS`, `ROLL_DEPT_MAP`,
  roll-parsing helpers), `facultyPdfExport.js`, and `firestore.rules`
  (relevant write-gate sections). Confirmed multi-teacher join flow
  already fully exists and needs no new backend work. Wrote this plan.

- **2026-08-15 — Answers received.** Akhinoor confirmed: (1) CE/EEE/ME/
  CSE section split is clean 60/60 (Section A = seats 1-60, Section B =
  61-120), a section toggle bar sits above the roster with add/swap
  actions kept intentionally simple (no approval flow), and Excel export
  combines both sections into one file. (2) Backlog students always use
  the standard 7-digit KUET roll pattern, no free-text. (3) Excel export
  is a full term running register — one column per class date held so
  far, not a single-day snapshot. Recorded all of this in section 4
  above, replacing the open-questions list.

- **2026-08-15 — Phase A DONE.** Added to `src/lib/groupUtils.js`:
  - `DEPT_TO_ROLL_DIGITS` — reverse of `store.js`'s `ROLL_DEPT_MAP` (dept
    code -> 2-digit roll code), built once so it can't drift from the
    single source of truth.
  - `batchToRollPrefix(batch)` — `'2K23'`/`'2k23'`/`'23'` -> `'23'`.
  - `generateDeptRollRoster(dept, batch, section)` — the core roster
    generator. Single-section depts ignore `section` and return the full
    seat range. Multi-section depts (CE/EEE/ME/CSE) require `'A'`/`'B'`
    for the daily-attendance view, or return the full 120 with each
    entry tagged `section: 'A'|'B'` when called with `'BOTH'`/omitted —
    that combined mode is what Phase G's Excel export will use per
    Akhinoor's "dui section eksathe" instruction.
  - `store.js`: changed `const ROLL_DEPT_MAP` to `export const
    ROLL_DEPT_MAP` (only change to that file — nothing else touched) so
    `groupUtils.js` can derive the reverse map from it instead of
    duplicating the table.
  - **Verified correctness against real data**: generated roll for ESE
    (dept digits `13`), batch `23`, seat `14` → `2313014`, which exactly
    matches "MD AKHINOOR ISLAM · 2313014" visible in the Attendance
    screenshot Akhinoor shared. CSE (120 seats) section split verified:
    Section A = `2307001`-`2307060`, Section B = `2307061`-`2307120`.
  - `npm run build` — zero errors, confirmed after `npm install` (deps
    were stripped for the previous session's ZIP packaging).
  - No UI changes yet — `generateDeptRollRoster()` exists but nothing
    calls it yet. That's Phase B/C.

  **Next up: Phase B — data model migration (uid-keyed → roll-keyed
  attendance).** This is flagged as the highest-risk phase in section 3b
  — it changes what `createOrUpdateSessionAttendance`'s `attendance: {}`
  map is keyed by (Firebase uid → roll number string) so a placeholder
  student (no account yet) and a later-registered real account for the
  same roll share the same attendance history with no migration step
  needed. Read `facultyMarksSync.js` fully fresh before starting (session
  schema, `computeStudentAttendancePercent`, `computeAttendanceComponentScore`)
  plus `AttendanceTab`/`MarksTab`'s read sites in `FacultyClassDetail.jsx`,
  since both consume the same `sessions` data. Before writing any code,
  flag to Akhinoor: does any already-saved production attendance data
  exist that would need migrating (old sessions keyed by uid), or is it
  safe to treat this as a clean schema change since the feature is new
  enough that little/no real attendance has been recorded yet? Do not
  assume — ask.

- **2026-08-15 — Akhinoor confirmed: zero teachers on the platform yet,
  completely fresh.** No production attendance data exists at all — safe
  to treat Phase B as a clean schema change, no migration logic needed.

- **2026-08-15 — Phase B DONE.** Confirmed the full call chain first:
  `computeStudentAttendancePercent`/`computeAttendanceComponentScore` in
  `facultyMarksSync.js` are key-agnostic (just read
  `sessions[i].attendance[key]`, don't care if the key is a uid or a
  roll string) — so no logic changes needed inside that file, only doc
  comments + param naming for clarity. Also confirmed (via
  `grep -rn "\.attendance\?\.\["`) that only 3 call sites in the whole
  codebase read a session's `attendance` map — all three already
  reviewed, no student-side page touches this teacher-side collection.

  Changes made:
  - `src/pages/faculty/FacultyClassDetail.jsx` — `AttendanceTab`:
    `setMark`/`draftMarks` now keyed by `m.roll` instead of `m.id` (uid)
    everywhere in the roster render loop and the `attendanceSummary`
    calc (the Most Regular / Most Absent / Class Performance card).
  - Same file — `MarksTab`: `attendancePctFor` now takes a roll, not a
    uid (marks themselves — `studentRecords/{uid}` — deliberately STAY
    uid-keyed, since marks entry inherently needs a real account; only
    the attendance-percentage lookup inside marks changed).
    `buildFieldsForSave`/`handleSave` now take both `studentUid` (for
    where to save marks) and `studentRoll` (for the attendance % lookup)
    — two different keys for two different purposes, kept explicit
    rather than conflated.
  - `src/lib/facultyMarksSync.js` — updated doc comments on
    `createOrUpdateSessionAttendance` and
    `computeStudentAttendancePercent` to state the new roll-keying
    explicitly (so a future reader doesn't have to reverse-engineer it),
    renamed the internal `uid`/`studentUid` variables in the
    `editHistory` diffing logic to `roll`/`studentRoll` for consistency.
    No functional/behavioral change in this file — pure clarity edits.
  - `npm run build` — zero errors.
  - **Scope note:** `AttendanceTab` still only loops over `members`
    (real accounts) — the merged full-roster (placeholders + backlog)
    isn't wired in yet, so there's nothing to manually test end-to-end
    yet (a placeholder roll literally can't appear in the UI until Phase
    C). This phase was purely "make the data layer roll-shaped so Phase
    C has nothing left to migrate."

  **Next up: Phase C — merged roster + backlog students.** Wire
  `generateDeptRollRoster()` (Phase A) into `AttendanceTab`: build the
  merged roster (generated rolls + real `members` matched by roll +
  backlog entries), tag each row `isPlaceholder`/`isBacklog`, sort with
  `sortByRoll`. Add the Section A/B toggle bar for CE/EEE/ME/CSE (default
  60/60 split, confirmed). Add the backlog-student add modal + swap-
  section action (kept simple per Akhinoor — no approval flow) + the new
  Firestore doc shape for backlog entries
  (`facultyAssignments/{id}/backlogStudents/{roll}`, standard 7-digit
  roll format only, confirmed). Read `AttendanceTab` fully fresh again
  before starting — Phase B's edits changed several lines inside it.

- **2026-08-15 — Phase B follow-up: audit snapshot added.** Akhinoor
  asked to weigh roll-only keying (Phase B as shipped) against also
  keeping a uid trail, and asked for whichever is genuinely best rather
  than picking for him. Recommended and built the hybrid: roll stays the
  ONE source of truth for attendance (zero change to Phase B's actual
  logic, every read path unchanged) plus a new optional `rollToUid`
  snapshot map on the session doc for audit/debug traceability, at near-
  zero added cost since the uid is already sitting in `members` when
  `handleSave` runs.
  - `facultyMarksSync.js` — `createOrUpdateSessionAttendance` now accepts
    an optional `rollToUid` param, merges it into the existing map on
    every save (accumulate, never overwritten wholesale — same spirit as
    `editHistory`), documented clearly as audit-only / never a read
    source for any real logic.
  - `FacultyClassDetail.jsx` — `AttendanceTab.handleSave` now builds
    `rollToUid` from the current `members` list (real accounts only —
    rolls with no account simply aren't included, not stored as an
    explicit `null`, since most of a roster stays placeholder for a long
    time and hundreds of `null` entries would add nothing) and passes it
    through.
  - `npm run build` — zero errors.
  - No other file needed touching — `computeStudentAttendancePercent`,
    `MarksTab`, and the roster UI all still only ever read `attendance`
    (roll-keyed), never `rollToUid`. This was purely additive.

  **Next up: still Phase C** (unchanged from the note above) — this
  follow-up didn't change Phase C's plan at all, since `rollToUid` is
  audit-only and Phase C's merged-roster work doesn't need to read it.

- **2026-08-15 — Design note recorded (no code yet): seat counts are
  defaults, not hard caps.** Akhinoor flagged that the real number of
  students in a batch+dept can run 1-3 over the official seat count
  (e.g. 122 in a nominally-120-seat CSE batch). Updated sections 3a and
  3c to make this explicit: the generated roster is a starting default
  only, never an exhaustive/closed list, and any student outside that
  range (whether a genuine backlog student or just an over-quota regular
  student) is added through the exact same "add student" mechanism —
  no separate flow, no seat-count validation that would incorrectly
  reject a legitimate extra student. This doesn't change Phase A's
  already-shipped `generateDeptRollRoster()` (it was never meant to be
  a closed list) — it changes how Phase C's merged-roster + add-student
  UI must be built. **Next up: still Phase C**, now with this
  constraint in mind from the start.

- **2026-08-15 — Phase C DONE.** Read `AttendanceTab` fully fresh first
  (confirmed Phase B's roll-keying was already in place, nothing left to
  migrate). Changes made:
  - `src/lib/facultyMarksSync.js` — added `backlogStudentsCollection()` +
    `addBacklogStudent()` / `moveBacklogStudentSection()` /
    `removeBacklogStudent()` / `subscribeBacklogStudents()`, scoped to
    `groups/{groupId}/facultyAssignments/{assignmentId}/backlogStudents/{roll}`
    per §3c. Roll validated against the same `/^\d{7}$/` pattern
    `store.js` already uses (not reinvented) — no seat-count upper-bound
    check anywhere, per 3a's "defaults, not hard caps" rule. Doc id =
    roll, so re-adding the same roll for the same assignment overwrites
    rather than duplicating. Added `deleteDoc` to that file's Firestore
    import (needed for `removeBacklogStudent`).
  - `firestore.rules` — **flagged and fixed a gap the plan's §2 missed**:
    the plan claimed "existing rules are untouched" for the new roster,
    but that's only true for the read-side roster generation itself —
    the new `backlogStudents` subcollection is a real new write path with
    no existing rule, which would have default-denied every write. Added
    a `match /backlogStudents/{roll}` block alongside the existing
    `sessions` block, same access tier (assigned faculty for this
    assignment, or CR/ACR/CL for read, or Admin) — not the stricter
    Blue-Tick-only `studentRecords` tier, since this isn't graded data.
  - `src/lib/groupUtils.js` — no changes; `generateDeptRollRoster()` used
    exactly as Phase A shipped it.
  - `src/pages/faculty/FacultyClassDetail.jsx` — `AttendanceTab`:
    - New `backlogStudents` state + `subscribeBacklogStudents` effect.
    - New `activeSection` state (defaults to the assignment's own
      `section` field if set, else `'A'`) + a Section A/B toggle bar,
      shown only when `isMultiSectionDept(assignment.dept)` — single-
      section depts render nothing extra here, unaffected.
    - Built `mergedRoster`: `generateDeptRollRoster(assignment.dept,
      assignment.batch, multiSection ? activeSection : null)` matched
      against `members` by roll (`isPlaceholder` when no real account),
      concatenated with this section's `backlogStudents` entries
      (`isBacklog: true`), sorted with the existing `sortByRoll()` — all
      reused as-is per the plan, no new sort logic. A backlog entry whose
      roll falls inside the generated range takes over that row (e.g. a
      real name was manually added for an already-generated placeholder)
      rather than showing twice.
    - Roster rows now show a "No account yet" badge for placeholders and
      an "Added" badge for backlog entries, so a teacher can tell the
      three kinds of row apart (real account / placeholder / manually
      added) at a glance, per §3c's "clearly tagged" requirement.
    - `attendanceSummary` (Most Regular/Most Absent/Class Performance
      card) now iterates `mergedRoster` instead of `members`, so
      placeholder and backlog students' attendance % show up in the
      summary too, not just registered accounts.
    - Added the "+ Add student" bar (roll + optional name + section
      picker for multi-section depts) above the roster, using
      `addBacklogStudent()`. Client-side disables Add unless the roll
      passes `/^\d{7}$/` — same regex, no upper-seat-bound check (3a).
    - Added a per-row "Move to Section {other}" action, shown only on
      backlog rows in a multi-section dept (a generated-range row has no
      backlog doc to move — moving it would need adding it as a backlog
      entry first, which is out of scope for a plain toggle click; not
      built, flagged below).
    - Did NOT add a "swap section" action for a *generated-range*
      placeholder/real row (only backlog rows can move) — plan §4 item 1
      describes "swap a student from Section A to B" generally, but a
      generated row has no per-student Firestore doc to move without
      first creating a backlog-style override, which changes its shape
      from "generated default" to "explicit entry." Flagging this as an
      open scope question rather than guessing — Phase D's UI pass is a
      natural place to revisit if Akhinoor wants every row swappable, not
      just backlog ones.
  - `npm run build` — zero errors, confirmed after `npm install`.
  - Not built in this phase (explicitly out of scope per §3d/§3e/§3f):
    the spreadsheet-style desktop rebuild, mobile 2-row swipe view, the
    2-state Present/Absent toggle, default-present-on-save behavior, and
    date auto-detect from schedule. This phase's roster (generated +
    backlog, section-toggled) is wired into the EXISTING 4-button P/A/L/E
    row UI as-is — Phase D is where that UI itself gets rebuilt.

  **Next up: Phase D — Desktop UI rebuild.** Spreadsheet-style columns
  (see §3d), 2-state Present/Absent toggle (default Present, only
  materialized into `draftMarks` at save time per §3d's care-point — the
  current `setMark` toggle logic will need to change shape here, read it
  fresh), trailing total/present-count/percentage columns per row (reuse
  `attendanceSummary`'s per-student calc, now roster-complete after Phase
  C), header block (dept/course/batch/term/teacher/date). Resolve the
  flagged open scope question above (swap action for non-backlog rows)
  with Akhinoor before or during this phase — don't guess.

- **2026-08-15 — Phase D DONE.** Read `AttendanceTab` fully fresh first
  (Phase C's merged-roster edits changed several lines since the last
  full read). Resolved the open scope question flagged at the end of
  Phase C's entry, and one plan-default from §4, both recorded below
  rather than silently picked.

  **Resolved: "swap section" scope (flagged end of Phase C).** Extended
  the move action to every roster row, not just backlog ones — matches
  §4 item 1's plain reading ("swap a student from Section A to B",
  stated generally). New `moveStudentToSection()` in
  `facultyMarksSync.js`: if a `backlogStudents` doc already exists for
  that roll, plain section update (same as the old
  `moveBacklogStudentSection`, which is left in place — still exported,
  still correct for a pure-backlog-only call site — but no longer called
  from `AttendanceTab`, which now always goes through the generic path).
  If no doc exists yet (a generated-range row), moving it creates one —
  a section move necessarily turns an implicit/derived row into an
  explicit entry, which is exactly the same "outside the generated
  default" mechanism §3c already describes for the over-quota case, so
  this isn't a new concept, just applying the existing one to a new
  trigger. The created doc is tagged `movedFromGenerated: true`
  (informational only, no read path branches on it) so a future admin
  data-audit can tell "added because we didn't know this student
  existed" apart from "added because a section move happened." A moved
  row now shows the "Added" badge, same as any other backlog row — this
  is accurate, since it now genuinely IS an explicit Firestore entry, not
  a generated default.

  **Resolved: Late/Excused (§4 item 4, "decide during Phase D").**
  Confirmed default applied as stated in the plan: kept fully in the data
  model (draftMarks/attendance can still hold 'late'/'excused',
  `computeStudentAttendancePercent` unchanged, still treats both as
  attended), hidden from the main quick-entry toggle, reachable per-row
  via a "…" expand. The main Present/Absent button disables itself (with
  a tooltip) while a row holds a Late/Excused mark, so a stray click on
  the primary toggle can't silently downgrade a deliberate L/E mark —
  the teacher has to reopen "…" to explicitly change it back.

  Changes made:
  - `src/lib/facultyMarksSync.js` — added `moveStudentToSection()` (see
    above). `moveBacklogStudentSection()` untouched, just no longer the
    only move path.
  - `src/pages/faculty/FacultyClassDetail.jsx` — `AttendanceTab`:
    - Added a compact header block above the existing summary card:
      dept full name (looked up from `DEPARTMENTS`, newly imported from
      `store.js`) + course code/title, then batch(+active section)/term/
      teacher name/date on a second line. Kept live in the UI (not just
      baked into the eventual Phase G export) so on-screen and exported
      views match — WYSIWYG per §3d.
    - Rebuilt the roster block as an actual table: header row (Name/Roll,
      Held, Present, %, Mark) + one row per `mergedRoster` entry, replacing
      the old plain `.faculty-row` list. Trailing three columns
      (Held/Present/%) come from a new `rowStatsByRoll` map — same calc
      `attendanceSummary` already used, just not filtered to
      `markedCount>0` (a brand-new placeholder correctly shows 0/0/— in
      its own row instead of vanishing, unlike the ranked summary lists
      where it should stay excluded).
    - Replaced the 4-button P/A/L/E row with a single 2-state
      Present/Absent toggle (`togglePresentAbsent`) + a "…" button that
      expands Late/Excused as two small secondary buttons per row, per
      §3d's explicit simplification instruction and §4 item 4's resolved
      default above.
    - Default-present-on-save: `draftMarks` itself is untouched by
      rendering — the toggle's displayed state falls back to 'present'
      only via `effectiveMark = draftMarks[m.roll] || 'present'` at
      render time, and that default is only ever WRITTEN into what gets
      saved inside `handleSave` (loops `mergedRoster`, fills in 'present'
      for any roll with no explicit `draftMarks` entry, right before
      calling `createOrUpdateSessionAttendance`). Opening a date and not
      saving still leaves the underlying `sessions` doc exactly as it
      was — nothing is committed just from rendering the default.
    - "Move to Section" is now shown on every row (not just backlog
      rows) in a multi-section dept, calling `handleMoveSection(roll,
      name, newSection)` → `moveStudentToSection()`.
  - `firestore.rules` — no changes needed this phase; `moveStudentToSection`
    writes through the same `backlogStudents/{roll}` path Phase C already
    opened up.
  - `npm run build` — zero errors, confirmed after edits.
  - Not built in this phase (explicitly out of scope, next phases per
    the breakdown): mobile 2-row swipeable view (Phase E), date
    auto-detect from schedule (Phase F), Excel/PDF export (Phase G) — the
    live header block above is designed to be reused as-is by Phase G's
    export, not rebuilt there.

  **Next up: Phase E — Mobile UI rebuild.** 2-row swipeable view (§3e):
  Row 1 (identity) defaults to Roll, swipes to reveal Name; Row 2
  (attendance) defaults to the selected date's mark (now the 2-state
  toggle + "…" built in Phase D — reuse `effectiveMark`/`togglePresentAbsent`/
  `setMark` as-is, don't reimplement), swipe cycles through other dates'
  read-only history, editable mark should stay pinned as the resting
  position after swiping away and back (needs a hands-on prototype pass
  per the plan's note — build one, get feedback before finalizing). Check
  `package.json` for an existing swipe/gesture library before adding a
  new dependency (plan explicitly calls this out — search first).

- **2026-08-15 — Phase E DONE.** Checked `package.json` first, per the
  plan's explicit instruction — no swipe/gesture library present (no
  `hammer`, `react-swipeable`, `framer-motion`, `@use-gesture`, etc.
  anywhere in dependencies or devDependencies). Given the actual need is
  just a 2-row card with a snap-on-release horizontal swipe (not a
  drag-following animation, pinch, or multi-touch gesture), built it with
  plain pointer events (`onPointerDown`/`onPointerUp`/`onPointerCancel`)
  and a distance threshold, rather than adding a dependency for something
  this small — flagging the reasoning here in case Akhinoor wants a real
  gesture library later for a fancier drag-follow feel.

  **Read `AttendanceTab` fully fresh first** (Phase D's rebuild changed
  the roster block substantially since the last full read), then built
  the mobile view as a sibling block to Phase D's desktop table, not a
  replacement — both are always in the DOM, CSS media queries (768px,
  matching the project's dominant existing breakpoint per `index.css`)
  toggle which one is visible, so there's exactly one roster interactive
  at a time with zero duplicate state.

  Changes made:
  - `src/index.css` — appended `.attendance-desktop-roster` /
    `.attendance-mobile-roster` (display toggle at `max-width: 768px`)
    and `.attendance-mrow` / `.attendance-mrow-track` /
    `.attendance-mrow-identity` / `.attendance-mrow-swipehint` styles for
    the new mobile row. Nothing existing touched.
  - `src/pages/faculty/FacultyClassDetail.jsx`:
    - Desktop roster block (Phase D's table) now carries
      `attendance-desktop-roster` alongside its existing
      `faculty-summary-card` class — no structural change, just the new
      class for the CSS toggle.
    - New `AttendanceMobileRow` component (defined just above
      `AttendanceTab`, same file) — one instance per `mergedRoster` entry,
      rendered inside a new `attendance-mobile-roster`-classed block
      placed directly after the desktop table, before the Save button.
      Receives `effectiveMark`, `stats`, `expandedRoll`/`setExpandedRoll`,
      `togglePresentAbsent`, `setMark`, `draftMarks`, `handleMoveSection`,
      etc. straight from `AttendanceTab` as props — genuinely the same
      state Phase D built, not a parallel copy.
    - **Row 1 (identity):** resting shows Roll (monospace, matches the
      desktop roll styling), a left/right pointer-swipe past a 40px
      threshold flips to Name and back — momentary, no pinned state,
      matching the plan's plain reading of "swipe to reveal Name" (only
      Row 2 is specified as needing a pinned resting position). Also
      carries the placeholder/backlog badges and the %/count summary,
      condensed to fit one line.
    - **Row 2 (attendance):** resting position (`historyIndex === 0`) is
      the live editable mark — literally the same toggle/expand markup
      pattern as Phase D's desktop row, same handlers, so a mark set on
      mobile and one set on desktop write through the identical
      `draftMarks`/`handleSave` path with no divergent logic. Swiping
      left steps into `historyDates` (every other held session date for
      this assignment, newest first, built from the already-fetched
      `sessions` prop — no new Firestore reads), rendering that date's
      mark read-only with a small "read-only" label and a "→ today"
      shortcut. Swiping right steps back toward index 0. Per the plan's
      explicit pinning requirement, there's no way to "leave" history
      pinned — the live date is always index 0 and is the only state
      that persists into `handleSave`; browsing history is purely a
      transient view, never written anywhere.
    - "Move to Section" (multi-section depts) and the Late/Excused "…"
      expand are both present on the mobile row too, condensed to fit —
      same `handleMoveSection`/`setMark` calls as desktop, not
      reimplemented.
  - `npm run build` — zero errors, confirmed after `npm install`.
  - Not built in this phase (explicitly out of scope, next phases per the
    breakdown): date auto-detect from schedule (Phase F), Excel/PDF
    export (Phase G), `teacherSlot` enforcement (Phase H per §4 item 5).
    No hands-on device testing was possible in this environment (build-
    only, no live mobile device/browser to actually try the swipe feel
    on) — the plan's note about a "hands-on prototype pass, get feedback
    before finalizing" still stands; Akhinoor should try this on an
    actual phone before considering Phase E's interaction design final,
    especially the 40px threshold and whether snap-only (vs. drag-follow)
    feels right.

  **Next up: Phase F — Date auto-detect from Class Setup schedule (§3f).**
  Check today's day-of-week against `assignment.dayTimeSlots` (or
  `ScheduleTab`'s routine data via `subscribeRoutine`); per the plan's
  read of Akhinoor's "ajker date ta mile tahole sei date ta default
  dekhabe" — only auto-set today if today IS a scheduled day, otherwise
  leave the date field for the teacher to pick manually rather than
  defaulting to today or silently jumping to the last scheduled day. The
  existing `isAutoDate` ref/visibility-resync effect in `AttendanceTab`
  (kept as-is through Phases C/D/E) is the right hook point — extend its
  logic rather than adding a second date-management mechanism.

- **2026-08-15 — Phase F DONE.** Read `AttendanceTab` fully fresh first.
  Used `assignment.dayTimeSlots` (this faculty's own set day/time for
  THIS class, via `EditDayTimeModal`/`updateAssignmentDayTimeSlots`) as
  the anchor, not `BatchRoutineGrid`'s `subscribeRoutine` data — that's
  the whole batch+dept's routine (every course, every teacher), which
  isn't what "Class Setup schedule" means for a single assignment; using
  it would've meant "today has *some* class for this batch" rather than
  "today has *this* class," a different and wrong question. Confirmed
  `dayTimeSlots` entries carry a plain weekday string (`'Sunday'` etc.,
  matching `DAYS`/`FULL_WEEK_DAYS`), so no format conversion was needed —
  just a same-string comparison against today's weekday name.

  Implemented the plan's literal reading ("only auto-set today if today
  IS a scheduled day, otherwise leave it for the teacher to pick
  manually") exactly as stated, no reinterpretation:
  - New `isScheduledToday` — `assignment.dayTimeSlots` some-match against
    today's weekday (`new Date().toLocaleDateString('en-US', { weekday:
    'long' })`), recomputed every render so an in-session day/time edit
    via `EditDayTimeModal` takes effect immediately without needing a
    tab remount.
  - The existing `isAutoDate` ref + visibility/focus resync effect (the
    plan's own suggested hook point — extended, not replaced) now checks
    `isScheduledToday` before overwriting `date` on regaining focus/
    visibility: if today isn't scheduled, the effect simply does nothing
    and leaves `date` exactly where it was, rather than snapping to
    today or guessing a "last scheduled day" (explicitly not what was
    asked for).
  - Did NOT change the tab's very first mount value (`date` still
    initializes to `todayStr()` via the existing `useState`) — on an
    unscheduled day this means the field opens sitting on today rather
    than blank, which reads as more usable than an empty/undefined date
    input, and the teacher is free to change it immediately; what
    actually changes is that the auto-*resync* no longer keeps pulling
    it back to today going forward while unscheduled. Flagging this
    choice explicitly rather than silently picking it, since the plan
    only specified the resync behavior, not first-mount behavior.
  - Small UI addition (not in the plan text, but needed so the new
    behavior isn't silent/confusing): a muted one-line hint — "No class
    scheduled today — pick a date manually if needed." — next to the
    date input, shown only while `isAutoDate.current` is true, today
    isn't scheduled, and `date` is still sitting on today (i.e. exactly
    the state where the teacher might otherwise wonder why nothing
    auto-jumped). Disappears the moment the teacher picks any date
    manually (which already flips `isAutoDate.current` to false via the
    existing `onChange` handler).
  - `src/pages/faculty/FacultyClassDetail.jsx` — only file touched this
    phase. No new Firestore reads, no `firestore.rules` changes, no new
    dependency.
  - `npm run build` — zero errors, confirmed after edits.
  - Not built in this phase (next phases per the breakdown): Excel/PDF
    export (Phase G — the big one, full running register per §3g/§4
    item 3), `teacherSlot` enforcement (Phase H, §4 item 5).

  **Next up: Phase G — Excel + PDF export (§3g).** Add `xlsx` (SheetJS)
  via `npm install xlsx`. New `src/lib/attendanceExport.js`:
  `exportAttendanceExcel(assignment, mergedRoster, sessions, dateRange)`
  building a full running register (one column per held class date, per
  §4 item 3's confirmed answer — NOT a single-day snapshot), header rows
  reusing the same dept/course/batch/term/teacher block already built
  live in the UI (Phase D) for WYSIWYG consistency; `exportAttendancePdf`
  reusing the `jsPDF`/`jspdf-autotable` pattern from
  `facultyPdfExport.js`'s `exportClassSummaryPdf` as direct template. One
  "Export" button, Excel default / PDF secondary per Akhinoor's stated
  preference. For a multi-section dept, confirm export always combines
  both sections into one file (§4 item 1's answer) — `generateDeptRollRoster`
  already has (or needs, check Phase A's implementation) a full-dept mode
  for this, not just the per-section view `AttendanceTab` uses for daily
  marking.

- **2026-08-15 — Phase G DONE.** Read `AttendanceTab`, `facultyPdfExport.js`,
  and `groupUtils.js`'s `generateDeptRollRoster` fully fresh first, per
  standing rule §5.

  **Deviated from the plan doc's literal wording on ONE point, deliberately,
  not a guess:** §3g says "reuse the `jsPDF`/`jspdf-autotable` pattern."
  Reading `facultyPdfExport.js` (the only actual export precedent in this
  codebase) shows its own header comment explicitly rejects the raw
  jsPDF-autotable table API in favor of an HTML-snapshot route
  (`html2canvas` → `jsPDF`), citing "§13's explicit rule." Since §5's own
  working discipline says "read the actual current source... don't assume
  from this plan doc alone," the actual codebase convention was followed
  over the plan doc's summary wording — `attendanceExport.js`'s PDF export
  uses the same html2canvas-snapshot approach as every other PDF export in
  this app, not jspdf-autotable. `jspdf-autotable` itself is untouched,
  still a dependency, just not the mechanism used here (consistent with
  the rest of the codebase already not really using it either).

  **Full-dept (both sections) export — confirmed no change needed to
  `generateDeptRollRoster`.** Its existing signature already supports a
  "both sections merged, section-tagged" mode (`section = null` or
  `'BOTH'`) — this was built generically enough back in Phase A that §4
  item 1's export requirement just needed to be *called* correctly, not
  implemented from scratch. New `fullMergedRoster` in `AttendanceTab`
  rebuilds the full-dept version independently of the per-section
  `mergedRoster` used for daily marking (calls `generateDeptRollRoster`
  with `section: null` instead of `activeSection`, merges ALL backlog
  entries not just the active section's), so a multi-section dept's
  export always has both sections even while the teacher's currently
  looking at Section A for marking. Collapses to the same array as
  `mergedRoster` for a single-section dept (no separate code path needed
  there).

  **Register format — full running register, per §4 item 3's confirmed
  answer, not a snapshot.** One column per held session date, roster rows
  down the side, classic register look. Sessions sorted oldest→newest
  (left-to-right chronological, matching how a teacher reads a physical
  register) — this is the opposite order from `historyDates` in Phase E's
  mobile swipe view (which is newest-first, for "swipe left into recent
  history"), a deliberate difference since the two serve different
  reading directions, not an inconsistency.

  Changes made:
  - `package.json` — added `xlsx` (`^0.18.5`) as a real `dependencies`
    entry (caught and fixed a first-pass mistake of adding it under
    `devDependencies` instead — an export feature end users trigger at
    runtime needs to actually ship, not be dev-only).
  - New `src/lib/attendanceExport.js`:
    - `exportAttendanceExcel(assignment, fullMergedRoster, sessions,
      facultyName)` — builds the register as an AOA (array-of-arrays)
      sheet via `XLSX.utils.aoa_to_sheet`: 2 merged title rows (dept/
      course line, batch+section-note/term/teacher line — same content as
      the live UI header), blank spacer, column-header row (Section if
      multi-section, Roll, Name, one column per date, Present/Held/%),
      then one row per `fullMergedRoster` entry. Marks abbreviated P/A/L/E
      per cell, blank for a date the student has no entry for at all
      (distinct from an explicit mark — an empty cell, not a fabricated
      'A'). Per-student Present/Held/% reuses the exact same calc
      `AttendanceTab`'s `rowStatsByRoll`/`attendanceSummary` already use
      (`computeOverallStats`, same present-or-late / markedCount>0 logic),
      just run against the full session set rather than filtered to one
      date. Downloads via `XLSX.writeFile`.
    - `exportAttendancePdf(assignment, fullMergedRoster, sessions,
      facultyName)` — same register, HTML-snapshot → landscape A4 PDF
      (landscape specifically because a many-date-column register reads
      far better wide than portrait, unlike `facultyPdfExport.js`'s
      marks-summary exports which stay portrait). Offscreen container
      widened to 1400px (vs. `facultyPdfExport.js`'s 760px default) to
      keep per-date cells legible before the html2canvas scale-2 snapshot;
      multi-page vertical pagination loop copied from
      `facultyPdfExport.js`'s `snapshotAndSave` pattern since a full-term
      register can easily exceed one page's height even landscape.
  - `src/pages/faculty/FacultyClassDetail.jsx`:
    - Imported `exportAttendanceExcel`/`exportAttendancePdf`.
    - New `fullMergedRoster` (see above) computed right after the
      existing per-section `mergedRoster`.
    - New `handleExport(format)` — sets `exportingFormat` for a
      per-button loading state (doesn't block the rest of the tab, unlike
      Save, since export touches no Firestore write and no roster state),
      calls the matching export function, clears on completion/error.
    - "Export" button added into the existing Phase D header card
      (dept/course/batch/term/teacher/date block), not a new separate
      card — reuses the same visual anchor point the header itself is
      designed around (WYSIWYG). Small dropdown menu on click: "Excel
      (.xlsx)" (listed first, Excel is the stated default) and "PDF".
      Disabled with a tooltip when `sessions.length === 0` — nothing
      meaningful to export yet, avoids a confusing empty-register
      download on a brand-new class.
  - `npm run build` — zero errors, confirmed after `npm install` (added
    xlsx; bundle's `vendor` chunk grew accordingly — expected, this is a
    real new capability, not bloat from an unrelated import).
  - Not built in this phase (next/final phase per the breakdown):
    `teacherSlot` enforcement on Attendance (Phase H, §4 item 5) — still
    an open, not-urgent question per the plan; default remains "leave
    attendance open to either joined teacher."

  **Next up: Phase H — `teacherSlot` enforcement decision (§4 item 5).**
  Not urgent, no code assumed yet. Confirm with Akhinoor whether
  Attendance should stay a single shared log open to either joined
  teacher (the plan's stated default, matching "attendance is usually a
  single shared log" reasoning from §2) or whether Phase D/E/G's UI
  should start distinguishing `teacherSlot` the way Marks already does.
  If the default holds, Phase H may end up being a documentation-only
  confirmation rather than a code change — don't add gating logic
  speculatively before that's confirmed.

- **2026-08-15 — Phase H, ANSWERED by Akhinoor, NOT YET BUILT — full
  hand-off written here instead of guessing at implementation shape.**
  Akhinoor's answer is real design work, not a "pick shared vs. split"
  binary — read this whole entry before touching code, it supersedes the
  "documentation-only" assumption in the stub above.

  **Akhinoor's actual answer (his own words, translated/paraphrased,
  read carefully — this is NOT simply "split by teacherSlot"):**
  "Each teacher takes attendance separately (their own log), but at the
  end the two get merged into one combined view. Same date, same course
  can genuinely have two different sessions — even the SAME teacher can
  hold two classes on the same date (two periods), so more than one
  session per date is normal and expected, not an error case. The merged
  view shows sessions by teacher name — there's no 'conflict to resolve'
  between two teachers' marks for the same date, because two different
  sessions logged by two different people (or even the same person
  twice) are just... two different sessions. Don't try to auto-merge or
  pick a winner between them."

  Follow-up clarifications Akhinoor confirmed directly, don't re-ask:
  1. Session storage is ALREADY correct as-is — one session doc per
     save, tagged with `loggedBy: { uid, role, name }` (this has existed
     since Phase D/earlier, nothing new to build here). No schema change
     needed. The gap is entirely UI/query-side, not data-model-side.
  2. A simple two-state filter/toggle in `AttendanceTab` is the right
     shape: "My sessions" (default — current single-teacher behavior,
     unchanged) vs. "All sessions" (both teachers' sessions, each
     labeled with who logged it via `loggedBy.name`).
  3. Attendance % in "My sessions" mode = current student's own logged
     sessions only (unchanged from today). In "All sessions" mode = all
     sessions combined. Marks tab's `computeStudentAttendancePercent`
     attendance-weighting stays untouched — it already operates per
     teacher's own session set implicitly (each teacher's own marks
     entry reads from the same shared `sessions` array but each
     teacher's OWN attendanceWeight calc in existing code — verify this
     literally still holds before Phase H changes anything there; don't
     assume, re-read `computeStudentAttendancePercent`'s call sites
     fresh, since Phase G may have touched adjacent code).

  **A REAL BUG this surfaced, must be fixed as part of Phase H, not
  optional:** `AttendanceTab`'s `existingSessionForDate` (current line
  ~1175) is `(sessions || []).find((s) => s.date === date)` — date-only,
  no teacher/session disambiguation. Given Akhinoor's confirmation that
  multiple sessions CAN legitimately share one date (two teachers, or
  even one teacher with two periods), this line can silently grab the
  WRONG session — e.g. Teacher B opens today's date and this line hands
  them Teacher A's session doc, and Teacher B's Save then edits/overwrites
  Teacher A's attendance data under `isCorrection` logic never intended
  for this. This must be fixed BEFORE or AS PART OF building the
  toggle, not after — a UI toggle sitting on top of a broken single-session
  assumption would just make the bug more visible/frequent, not fix it.
  Suggested fix shape (verify against real code before committing, this
  is a starting hypothesis not a spec): `existingSessionForDate` should
  filter to `s.date === date && s.loggedBy?.uid === auth.currentUser.uid`
  for "my session to edit/save," while a separate `allSessionsForDate =
  sessions.filter(s => s.date === date)` feeds the "All sessions" merged
  view. `handleSave`'s `sessionId: existingSessionForDate?.id || null`
  and the whole locked/`isCorrection` flow need re-verification against
  this — a locked check must also be scoped to "is MY session for this
  date locked," not "is ANY session on this date locked" (Teacher A's
  locked session shouldn't block Teacher B from taking their own
  attendance same-day). Read `createOrUpdateSessionAttendance` in
  `facultyMarksSync.js` fresh too — check whether ITS own session-lookup
  logic (separate from `AttendanceTab`'s client-side lookup) has the
  same date-only assumption server/logic-side.

  **Scope for whoever picks this up (this session deliberately did NOT
  write code — flagged as too large/consequential a data-correctness fix
  to rush in the same pass as discovering it):**
  1. Fix `existingSessionForDate` → scope to own `loggedBy.uid`, add
     `allSessionsForDate` for the merged view. Re-verify `handleSave`,
     the locked/`unlockedForEdit` flow, and Sessions & Count auto-link
     (`wasFirstSaveForDate` — same date-only bug likely present there
     too, check `logsForCourse`/`alreadyLoggedThisDate` around current
     line ~1258) against the same "date alone isn't unique" fact.
  2. Add the "My sessions" / "All sessions" toggle to `AttendanceTab`'s
     UI (Phase D's header card is a natural spot — same visual anchor
     Export uses). "All sessions" mode needs a session-picker (not just
     a date picker) once a date can have 2+ sessions — e.g. a small list
     of "Teacher X — Period 1", "Teacher Y — Period 2" for that date,
     letting the viewer pick which one to look at, OR a stacked
     read-only view of all of them at once (Akhinoor didn't specify UI
     layout, only the toggle concept and the "show by teacher name, no
     auto-resolve" principle — this needs the same "mock it, confirm
     before finalizing" treatment Phase C used for the roster columns
     question).
  3. Recompute `rowStatsByRoll`/`attendanceSummary`/`classPerformancePct`
     against whichever session set the toggle currently has active (own
     vs. all) — these currently always read the full `sessions` array
     unfiltered by teacher, so check whether that's already accidentally
     "All sessions" behavior today (likely yes, since nothing currently
     filters by `loggedBy`) — meaning today's live % may ALREADY be
     silently blending both teachers' sessions with no visual attribution.
     Confirm this before Phase H, it may mean the "bug" is broader than
     just `existingSessionForDate`.
  4. Mobile (Phase E's `AttendanceMobileRow`) and Export (Phase G's
     `attendanceExport.js`) both currently read from the full `sessions`
     array too — decide whether they need the same My/All distinction or
     whether Export in particular should just always be "All sessions"
     (a register handed to admin/dept likely wants everything, teacher
     attribution included, not filtered to one teacher) — flag as an
     open sub-question for whoever builds this, don't guess.
  5. `npm run build` zero-error check + full-project zip re-package are
     still mandatory per §5 once this is actually built — this hand-off
     entry itself is NOT a completed phase, don't mark Phase H "DONE" in
     the status line at the top of this doc until the above is actually
     implemented and built clean.

- **2026-08-15 — NEW REQUIREMENT surfaced during Phase H discussion,
  NOT YET BUILT, NOT PART OF THE ORIGINAL PLAN — flagging clearly as a
  separate feature, its own phase (call it Phase I when picked up).**

  Akhinoor described a real gap in the *existing* co-teacher join flow
  (see plan §2's "already built" claim about `findJoinableAssignment` /
  `joinFacultyAssignment` — that claim is about the MECHANISM existing,
  not about it being discoverable/usable the way Akhinoor now wants):

  **What's being asked for:** a teacher-facing "invite code" flow.
  Teacher A (already has the class assignment) generates a short code
  from within their own class. Teacher A gives that code to Teacher B
  (outside the app — text message, in person, whatever). Teacher B
  enters that code somewhere in the app, and this automatically joins
  Teacher B onto the SAME assignment Teacher A already has — same
  dept+batch+section+term+course, same `assignmentId`, appended to
  `teacherUids` via the ALREADY-EXISTING `joinFacultyAssignment(uid,
  groupId, assignmentId)` in `facultyClassSync.js` (current line ~82) —
  that function's own logic (refuse if already 2 teachers, no-op if
  already joined) doesn't need to change, this is purely a NEW discovery/
  entry path INTO that same function, not a new joining mechanism.

  **Why this isn't just "the existing Join flow, just document it
  better"** (which is what §2 of this plan originally assumed was
  needed): the current `findJoinableAssignment` path requires Teacher B
  to independently pick the EXACT SAME dept+batch+section+term+course
  combination via "+ Add Class" for the silent auto-detect to even
  fire. That's fragile in practice — Teacher B has to know/guess the
  precise details Teacher A set up, and any mismatch (e.g. Teacher A set
  section 'A', Teacher B picks no section or 'B') means no match, no
  Join option shown, and Teacher B silently creates a DUPLICATE
  assignment instead. An explicit code sidesteps all of that — Teacher B
  doesn't need to know or re-enter any of the class details at all, the
  code IS the identifier.

  **This needs its own scoping pass before code — flagging the open
  questions rather than guessing:**
  1. Code generation: where does Teacher A generate this from — a button
     on the class detail page? A dedicated "Invite co-teacher" action?
     What's the code format (short alphanumeric? tied to `assignmentId`
     directly, e.g. a signed/short-hashed version of it, or a fully
     separate random code stored in a new small Firestore doc mapping
     code → assignmentId)?
  2. Code lifetime/security: expires after use? After a time window?
     Can Teacher A revoke/regenerate it? Does it need to be scoped so a
     found/leaked code can't let a random third teacher join a class
     they have nothing to do with (the existing `joinFacultyAssignment`
     already hard-caps at 2 teachers, but a code SHOULD probably still
     not be indefinitely guessable/reusable).
  3. Entry point for Teacher B: a new field somewhere in "+ Add Class"
     flow (e.g. "Have a code from your co-teacher? Enter it here"
     alternative to picking dept/batch/course manually), or a wholly
     separate "Join via code" entry point outside that flow?
  4. Firestore rules: a new code-lookup path (however it's shaped) needs
     its own read-rule scoping — a code lookup shouldn't leak assignment
     details to someone who doesn't have the code, and the write side
     (actually joining) should still go through the exact same
     `teacherUids` update rule that already gates `joinFacultyAssignment`
     today (per plan §2, "Firestore write rules are already scoped
     correctly" — verify that statement still holds for whatever new
     read-path a code lookup needs, since that statement was written
     about the ORIGINAL flow, not this one).

  **Explicitly NOT started:** no code, no schema, no UI mock. This is a
  clean hand-off note only, written so the next session (this one or a
  different AI/dev) can scope Phase I properly with Akhinoor rather than
  guessing at code format/expiry/entry-point, all of which materially
  change the Firestore schema and are hard to walk back once real invite
  codes exist in production data.

- **2026-08-15 — Phase H DONE (items 1-3 of the hand-off's 5-item scope;
  items 4's mobile piece done, export piece deliberately left unscoped —
  see below).** Read `AttendanceTab` fully fresh first, confirmed the bug
  exactly as the hand-off described: `existingSessionForDate` at (then)
  line 1175 matched on `s.date === date` alone, no `loggedBy.uid` check —
  so Teacher B opening the same date as Teacher A adopted Teacher A's
  session id, and `handleSave`'s `updateDoc(ref, data)` would silently
  overwrite Teacher A's attendance. Also confirmed `wasFirstSaveForDate`/
  `alreadyLoggedThisDate` share the same date-only pattern, and confirmed
  `attendanceSummary`/`rowStatsByRoll`/`classPerformancePct` were ALREADY
  silently blending both teachers' sessions with zero attribution (the
  hand-off's suspicion in item 3 — confirmed true).

  Changes made, `src/pages/faculty/FacultyClassDetail.jsx` (`AttendanceTab`):
  - `existingSessionForDate` now scoped to `s.loggedBy?.uid === myUid` —
    "my session to edit/save," per the hand-off's suggested fix shape.
    New `allSessionsForDate` (date-only filter) added alongside it for a
    future session-picker, though no picker UI consumes it yet (see open
    item below).
  - `wasFirstSaveForDate`/`alreadyLoggedThisDate` **deliberately left
    date-only, not changed to per-teacher** — on inspection this isn't
    the same bug: Sessions & Count auto-link answers "was a class held
    this day," a class-level fact, not a per-teacher one. A second
    teacher's save correctly should NOT create a second logged-class
    entry for the same day. Documented inline so a future pass doesn't
    "fix" this into the wrong scoping by pattern-matching the other fix.
  - New `sessionScope` state (`'mine'` | `'all'`, default `'mine'`) +
    `scopedSessions` derived value. `isJoinedClass` (`teacherUids.length
    > 1`) gates whether the toggle UI even shows — a solo teacher's mine/
    all are identical, so hiding it avoids a no-op control in the common
    (not-yet-joined) case.
  - `attendanceSummary`, `rowStatsByRoll`, `totalClasses` (and therefore
    `classPerformancePct`, which derives from `attendanceSummary`) now
    read `scopedSessions` instead of raw `sessions`.
  - `AttendanceMobileRow`'s `sessions` prop now receives `scopedSessions`
    too, so the mobile swipe-history view matches the desktop toggle's
    scope instead of silently always being "all."
  - Added the "My sessions / All sessions" toggle UI next to the
    "Attendance Summary" header, same visual anchor Export uses (per the
    hand-off's suggestion), only rendered when `isJoinedClass`.
  - `handleExport` (Excel/PDF) **deliberately left reading raw
    `sessions`, not `scopedSessions`** — resolves the hand-off's item 4
    open question for export specifically: a register handed to admin/
    dept wants the full picture (every joined teacher's sessions,
    attribution included via existing `loggedBy`), not whatever the
    on-screen toggle happens to be set to when Export is clicked.
    Documented inline with the reasoning.
  - Locked-check scoping (item 1's "must also be scoped to is MY session
    locked") came free from scoping `existingSessionForDate` itself —
    every UI site that reads `existingSessionForDate?.locked` (the
    "already saved" banner, "Edit this date" button, roster-locked flag,
    Save button label/disabled state) automatically became per-teacher
    without needing separate edits, since they all derive from the same
    now-scoped variable.
  - `createOrUpdateSessionAttendance` in `facultyMarksSync.js` — read
    fresh, confirmed it needed NO changes: it already takes `sessionId`
    as an opaque param and never does its own date-based lookup — the bug
    was entirely in `AttendanceTab`'s client-side `existingSessionForDate`
    resolution feeding it the wrong id, not in the sync function itself.
  - `npm run build` — zero errors.

  **Left open within Phase H (not guessed at, flagging per §5's
  discipline):**
  1. No session-picker UI was built for `allSessionsForDate` — when
     "All sessions" is selected and 2+ sessions exist for one date, there
     is currently no way to view them individually (e.g. "Teacher X —
     Period 1" vs "Teacher Y — Period 2"), only the blended stats. The
     hand-off flagged this exact UI (stacked view vs. picker) as needing
     Akhinoor's hands-on feedback before finalizing — still true, not
     built this pass.
  2. `teacherSlot` enforcement (open question #5, §4) is still
     unresolved — attendance stays open to either joined teacher, as
     before. Untouched by this pass.

  **Next up:** Phase I (co-teacher invite code) is still just a scoped
  hand-off note — needs the 4 open questions in that section answered
  with Akhinoor before any code. Alternatively, item 1 above (session-
  picker UI for "All sessions") could be picked up as a small Phase H
  follow-up if Akhinoor wants to see individual per-teacher sessions on a
  shared date, not just the blended total.

- **2026-08-15 — Unrelated feature merged in passing: KUET official
  faculty directory auto-verify.** Not part of this plan (Attendance
  Rebuild) at all — Akhinoor brought a separate, already-finished zip
  (`kuetx_faculty_directory_autoverify.zip`) mid-session and asked for it
  to be merged into the same working tree/output. Logged here only so
  this file stays the accurate single source of truth for what's in the
  zip being handed back, not because it's Attendance Rebuild scope.
  - New: `src/lib/facultyDirectoryMatch.js` (matches a faculty signup
    against `facultyDirectory/{email}`, scraped daily from KUET's own
    department pages via `scripts/kuet_faculty_scraper.py` + GitHub
    Actions cron), `scripts/kuet_faculty_scraper.py` +
    `requirements.txt` + `.gitignore`, `.github/workflows/
    kuet-faculty-scrape.yml`.
  - Changed: `src/lib/manualVerifyRequests.js` (`ensureManualVerifyRequest`
    now tries directory auto-verify before filing a pending request —
    still files the request row either way, `status: 'approved'` +
    `autoVerified: true` on a match, so Founder keeps audit visibility),
    `firestore.rules` (new read-only `facultyDirectory/{email}` match
    block, no write clause since only the scraper's Admin SDK service
    account writes there; `verifiedFacultyEmails` doc comment updated to
    describe the new auto-verify meaning of an `autoVerified: true` doc —
    rule itself unchanged, still `allow write: if isSignedIn()`, a
    pre-existing known gap documented but not fixed this pass since
    fixing it needs Blaze plan / a Cloud Function).
  - Full documentation of intent/rationale for this feature lives in
    `documentation/03-features/faculty-module/CURRENT.md` and each new
    file's own header comment — read those directly rather than this
    plan doc for anything about this feature going forward.
  - `npm run build` — zero errors after merge.
  - Not verified in this pass (per the feature's own CURRENT.md):
    template assumed-identical for 19 of 20 departments (only CSE's HTML
    confirmed against a real page), `iict`/`idm`/`iept` institute URL
    patterns not yet mapped, and the `verifiedFacultyEmails` open write
    gap is still just documented, not fixed.

- **2026-08-15 — Phase I DONE.** Answered the 4 open questions from the
  hand-off (code format/generation, lifetime/security, entry point,
  Firestore rules) with Akhinoor before writing any code, per the plan's
  own discipline. Answers used:
  1. **Code generation/format:** a separate random 6-char code (NOT
     derived from assignmentId), alphabet excludes 0/O/1/I to avoid
     read-aloud/typo ambiguity. Stored at `groups/{groupId}/
     facultyAssignments/{assignmentId}/inviteCodes/{code}`. Generated via
     a new "Invite co-teacher" button on the class detail page (shown
     whenever `!isJoinedClass`, same area as Phase H's My/All toggle).
  2. **Lifetime/security:** single-use (marked `used: true` AFTER a
     successful join, not before — so a join failure e.g. from a race on
     the 2-teacher cap does not burn a still-valid code), 24h expiry
     (`expiresAt` as a plain epoch-ms number, checked client-side).
     Teacher A can regenerate freely — every call to `generateInviteCode`
     deletes any earlier live code for that assignment first, so an old
     code (e.g. texted to the wrong person) stops working the moment a
     new one is generated, no separate "revoke" action needed.
  3. **Entry point:** "Have a code from your co-teacher?" link inside the
     existing "+ Add Class" modal (`AddClassModal` in
     `FacultyClasses.jsx`), collapsed by default. Expanding it shows a
     code input + Join button and completely bypasses the
     dept/batch/section/term/course picker below — a successful join
     calls `onCreated()` same as every other path in that modal.
  4. **Firestore rules:** new `inviteCodes/{code}` match block nested
     under the existing `facultyAssignments/{assignmentId}` block
     (read/create/delete gated to `isFacultyFor` i.e. Teacher A;
     `update` — Teacher B marking a code used — gated to
     `isVerifiedFaculty` only, since Teacher B isn't on `teacherUids`
     yet at that point and can't be checked via `isFacultyFor`) PLUS a
     separate top-level `collectionGroup` rule (mirroring the existing
     `facultyAssignments` collectionGroup rule's own pattern) so Teacher
     B's code-only lookup — which has no `groupId` yet, that's the whole
     point of a code — can actually run; scoped to `isVerifiedFaculty`
     only, and does not enable enumeration (an equality-filtered
     Firestore query only ever returns docs matching the exact code
     already typed in, never a listing). Confirmed §2's original "write
     rules already scoped correctly" claim does NOT extend to this new
     read path without this addition — flagged as needing verification in
     the hand-off, now added.

  Code changes:
  - `src/lib/facultyClassSync.js` — added `generateInviteCode(groupId,
    assignmentId)` and `joinViaInviteCode(uid, code)`. Both are pure
    NEW ENTRY/DISCOVERY paths as scoped — `joinViaInviteCode` does no
    `teacherUids` write of its own, it resolves a code down to
    `(groupId, assignmentId)` then calls the EXISTING
    `joinFacultyAssignment()` unchanged, so the 2-teacher cap and
    already-joined no-op guard are inherited automatically, not
    reimplemented.
  - `firestore.rules` — the two new match blocks described in point 4
    above. No existing rule changed.
  - `src/pages/faculty/FacultyClassDetail.jsx` — new "Invite co-teacher"
    card (collapsed to a button until clicked, then shows the generated
    code + a Regenerate button), only rendered when `!isJoinedClass`.
  - `src/pages/faculty/FacultyClasses.jsx` (`AddClassModal`) — new
    "Have a code from your co-teacher?" collapsible entry above the
    dept/batch picker, wired to `joinViaInviteCode`.
  - `npm run build` — zero errors.

  **Left open / not built (flagging, not guessing):**
  1. No visible countdown/expiry indicator on the generated code in the
     UI — a teacher sees the code but not literally "expires in
     23h 40m", just the static "expires in 24h" copy. Low-value polish,
     not built this pass.
  2. `inviteCode` state is session-local only (not re-read from
     Firestore on mount) — if Teacher A generates a code, navigates away,
     and comes back, the button resets to "Invite co-teacher" with no
     way to see the still-live code again without regenerating (which is
     harmless — regenerating just invalidates the old one — but means
     Teacher A can't "peek" at an already-shared code a second time).
     Could be fixed with a live subscription to the assignment's
     `inviteCodes` subcollection if this becomes a real friction point;
     not built this pass since it wasn't one of the 4 scoped questions.
  3. No admin/Founder visibility into invite codes (e.g. an audit list in
     AdminDashboard) — not asked for, not built.

  **Next up:** both hand-off items from the original Phase H/I scoping
  are now closed. Remaining open items are Phase H's own two (session-
  picker UI for "All sessions", `teacherSlot` enforcement on Attendance)
  and Phase I's three above — none blocking, all flagged for whenever
  Akhinoor wants to pick one up.
