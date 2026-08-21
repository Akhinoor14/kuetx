# Attendance Tab Rebuild — Master Plan

**Status: GRID REDESIGN DONE (supersedes everything below the archive
marker). Read this top section first — it is the current source of
truth. The rest of this file, below "## ARCHIVED", is the OLD plan
(Phase A–D) kept only for historical context. Do not follow it — the
design it describes (lock/audit-trail, 4-button P/A/L/E toggle,
Sessions & Count card, planned swipeable mobile view) was explicitly
thrown out and replaced by the grid design below.**

Any AI or dev picking this up: read this whole top section before
touching Attendance code. If you need to change something, update this
top section — don't add to the archived plan below.

---

## 1. What Attendance is now (current, correct)

`AttendanceTab` lives in `src/pages/faculty/FacultyClassDetail.jsx`
(search for `function AttendanceTab`). It renders a single dense grid:
**Roll (rows) × Date (columns)**, reference: a simple external app
called "AttendEase" the founder (Md. Akhinoor Islam) screenshotted as
the target look — one grid, no clutter, P/A/L badges per cell.

Everything that isn't the grid itself (co-teacher management, export,
discontinued-student handling) was deliberately pulled out from under
the teacher's eyes and tucked behind a single `⋯` button, two levels
deep, so the page reads as "just the grid" at a glance.

### 1a. Top bar — two fixed rows, not flex-wrap

Two explicit rows (a real flex-wrap was rejected — it reflows
unpredictably at odd widths; two rows is deterministic):

- **Row 1:** course code (left), Section A|B toggle (right, only shown
  when `isMultiSectionDept(assignment.dept)` is true — CE/EEE/ME/CSE).
- **Row 2:** `+ Add student` button (opens an inline popover: just a
  roll input + Add — no name field, name is looked up from the real
  member doc if one exists), a save-status string (`Saving…` /
  `Saved ✓` / empty), then pushed right via `margin-left: auto`:
  `Summary` button, `⋯` button (shows a small red dot badge if there's
  a pending co-teacher join-request or CR link-invite).

On mobile (`≤480px`, class `.attendance-btn-label` in `src/index.css`)
the "Add student" text hides, leaving just the icon — row 2 stays
uncluttered. The whole top bar is `position: sticky; top: 0` so it
stays visible while the grid scrolls.

### 1b. The grid itself

- Left column is sticky/frozen: roll number, small dot next to it if
  that roll has no real KUETx account yet (`isPlaceholder`).
- One column per attendance date that has ever been logged (by
  *this* teacher — `mySessions = sessions.filter(s =>
  s.loggedBy?.uid === myUid)`), header shows `DD/MM`.
- **Cell click cycles a 3-state mark, default state is Present:**
  `P (green) → click → A (red) → click → L (amber, Late — counts as
  attended, same as before) → click → back to P`. There is NO 4th
  "Excused" state anymore — that was in the old plan, deliberately
  dropped.
- **Every click auto-saves, debounced 500ms, straight to Firestore.
  There is no Save button, no lock, no "Edit this date" unlock flow,
  no `editHistory` audit trail.** This was a deliberate, explicit
  instruction from Md. — the old plan's lock/audit system (see
  archived section below) is gone completely, both in the UI
  (`AttendanceTab`) and in the backend
  (`createOrUpdateSessionAttendance` in `src/lib/facultyMarksSync.js`
  no longer accepts `isCorrection`, no longer writes `locked: true`,
  no longer writes `editHistory` — it's a plain upsert now).
- A `+` column on the right adds a new date column — either "Today" in
  one click, or any date via a date picker that appears when `+` is
  clicked.
- Small `−`/`+` zoom buttons above the grid resize cells across 3
  steps (28px/34px/42px) so more rolls/dates fit on screen at once.

### 1c. Discontinued students

"Discontinued" = a student who's no longer taking this course
(dropped, re-admission, etc). It's a **persistent per-student status**,
not a daily attendance mark — a discontinued roll disappears from both
the grid and all stats.

This is **not** a per-row button on the grid (that was considered and
rejected — too easy to mis-tap next to the attendance cells). It only
lives inside the `⋯ → Discontinued` modal: a roll-number input +
"Discontinue" button, and below it, already-discontinued rolls shown
as small removable chips (`2313008 ×`) — tapping `×` reactivates
instantly, no confirmation needed (reactivating isn't destructive).

### 1d. The `⋯` menu — two levels

**Level 1** (clicking `⋯` opens this — centered modal on desktop,
bottom sheet on mobile): three plain buttons, no descriptions, no
emoji:
```
Co-teacher   [badge count if pending]
Discontinued
Export
```

**Level 2** (clicking one of those opens its own modal, `✕` to close):
- **Co-teacher:** pending join requests (name + ✓/✕ icon buttons),
  pending CR link invites (same pattern), and if no second teacher is
  linked yet, an invite code + "Generate" button.
- **Discontinued:** the roll input + chip list described in §1c.
- **Export:** two lines, `Excel (.xlsx)` and `PDF` — clicking either
  calls the existing `exportAttendanceExcel`/`exportAttendancePdf`
  from `src/lib/attendanceExport.js`, unchanged.

### 1e. Summary — separate button, not inside `⋯`

`Summary` button (top bar, not the `⋯` menu) opens its own modal:
Class Performance % (color-coded), Most Regular (top 5, green), Most
Absent (top 5, red). This data is never shown inline in the grid —
on-demand only.

### 1f. Mobile behavior

Same component, CSS breakpoints handle density:
- All five modals (`⋯` menu, Co-teacher, Discontinued, Export,
  Summary) share two classes: `.attendance-modal-overlay` and
  `.attendance-modal-sheet` (both in `src/index.css`, right after the
  old `.attendance-history-scroll` rules). Below `640px` they flip
  from a centered box to a full-width bottom sheet (rounded top
  corners only, slides up from the bottom).
- Grid itself: horizontal + vertical scroll on both platforms, zoom
  buttons let the teacher shrink cells to fit more on a small screen
  rather than the layout trying to auto-compress (auto-compressing was
  explicitly rejected — tap accuracy on a touch screen matters more
  than fitting everything without scrolling).

## 2. What backend logic is reused vs what changed

**Reused as-is (no logic changes):**
- `mergedRoster` construction — generated dept+batch+section roll range
  (`generateDeptRollRoster`) merged with `backlogStudents`, matched
  against real `members` docs where they exist. This is the Phase C
  concept from the archived plan below and it's still exactly right —
  only the *rendering* of this roster changed, not how it's built.
- Co-teacher invite/join-request/link-invite functions
  (`generateInviteCode`, `subscribeJoinRequests`, `acceptJoinRequest`,
  `declineJoinRequest`, `subscribePendingLinkRequests`,
  `acceptLinkRequest`/`declineLinkRequest` from `teacherLinkRequests.js`).
- `exportAttendanceExcel`/`exportAttendancePdf` — untouched, just
  called from the new Export modal instead of an old button.
- `setStudentDiscontinued`/`clearStudentDiscontinued`/
  `subscribeDiscontinuedStudents` — untouched.
- `addBacklogStudent`/`subscribeBacklogStudents` — untouched, still
  how "+ Add student" adds a roll that isn't already in the generated
  range (or is in a different section than the generated default).

**Changed:**
- `createOrUpdateSessionAttendance` in `src/lib/facultyMarksSync.js` —
  stripped of the `locked`/`isCorrection`/`editHistory` mechanism
  entirely (see §1b above — this was a hard requirement discovered
  mid-rebuild: the old function threw a `session_locked` error on any
  second write to the same date, which is fundamentally incompatible
  with "every cell click saves immediately." Confirmed with Md. before
  removing it — explicit instruction: "পুরোপুরি বাদ দাও — প্রতি cell
  click = সরাসরি save, কোনো lock/edit-mode থাকবে না".)

**Removed entirely (no longer exists anywhere):**
- Sessions & Count card (classes-logged counter, "Set a plan"/"View
  log" links, `setPlannedTotalClasses`, manual session log entry via
  `logFacultySession`). Md.'s instruction: not needed.
- The old 4-button P/A/L/E per-row toggle — replaced by the 3-state
  cell-click cycle (§1b). "Excused" as a distinct state is gone; only
  Present/Absent/Late remain.
- Per-row "…" expand / per-row Discontinue button — moved into the
  `⋯ → Discontinued` modal (§1c).
- Add-student name field — roll number is enough now.

## 3. Also renamed in this pass (not Attendance-specific, but touched
   the same file)

- Tab label `Students & CR` → `Active Students`
- Tab label `Marks` → `CT Marks`
- Both changes mirrored in `TABS` array
  (`src/pages/faculty/FacultyClassDetail.jsx`) and the landing page's
  Bangla feature-list (`src/pages/LandingPage.jsx`, search for
  `nameBn:`).

## 4. Known follow-ups / not yet done

- None outstanding as of this writing — grid redesign, CSS, and tab
  renames are all done and `npm run build` passes clean.
- If picking this up again: check this file's top section (this one)
  first. If you find yourself reading the archived plan below and
  thinking about implementing lock/audit-trail, 4-state P/A/L/E, or
  the Sessions & Count card — stop, that's the old design, it was
  explicitly replaced.

---

## ARCHIVED — old plan (Phase A–D), superseded, kept for history only

Everything below this line describes the *previous* design and its
implementation history. It is NOT current. It's kept because parts of
the reasoning (roll-range generation, backlog/discontinued concepts)
are still accurate background — but any UI/interaction detail below
(locking, 4-button toggle, Sessions & Count, planned Phase E swipeable
mobile view) was thrown out. Read §1–§4 above for what's actually
true today.

> # Attendance Tab Rebuild — Master Plan
> 
> **Status: Phase D DONE — Phase E (Mobile UI rebuild) next**
> **This file is the single source of truth/hand-off doc for this feature.**
> Any AI or dev picking this up: read this whole file top to bottom before
> touching code. Update the "Progress Log" section at the bottom after
> *every* phase — that section always tells you exactly what to do next.
> 
> ---
> 
> ## 1. The problem, in plain terms
> 
> Right now `AttendanceTab` (in `src/pages/faculty/FacultyClassDetail.jsx`,
> function starts at the `function AttendanceTab(...)` line) only shows
> students who already have a real KUETx account and are in
> `groups/{groupId}/members` (a Firestore subcollection keyed by Firebase
> uid). Screenshot evidence: a class of 13 "students" shown is really just
> 13 people who happened to register — not the department's real roster.
> 
> A teacher taking attendance needs to see **every roll number that could
> possibly be in that batch+dept+section**, whether or not that student has
> ever opened KUETx. Right now roll numbers with no account are simply
> invisible — attendance for them can't be recorded at all.
> 
> ## 2. What we already have (don't rebuild these)
> 
> Read this section carefully — a lot of the infrastructure Akhinoor asked
> about ("kivabe connect korbo the two teachers?") **already exists**:
> 
> - **Roll number format is fully decodable.** `src/store/store.js` has
>   `ROLL_DEPT_MAP` (2-digit dept code) and roll format is a strict 7-digit
>   string: `[batch 2-digit][dept 2-digit][seat-in-dept 3-digit]`, e.g.
>   `2313014` = batch 23, dept digits `13` (ESE per `ROLL_DEPT_MAP`), seat
>   `014`. `getDeptCodeFromRoll()` and `extractBatchFromRoll()` already do
>   this parsing one direction. We need the **reverse**: given batch + dept
>   + seat count, generate every possible roll. That's pure arithmetic, no
>   new data entry needed from Akhinoor — the seat-count table he pasted is
>   already in `DEPARTMENTS` (`store.js` line ~364) and it matches exactly.
> - **groupId = dept+batch(+section) bucket already.** `getGroupId()` in
>   `src/lib/groupUtils.js` returns e.g. `2K23_ESE` (matches the screenshot
>   URL `?groupId=2K23_ESE`). This is exactly the right anchor to generate
>   "every roll in this batch+dept+section."
> - **Multi-teacher / co-teacher connection is ALREADY BUILT.** This
>   answers Akhinoor's question directly — no new feature needed here:
>   - `facultyAssignments/{assignmentId}` already stores `teacherUids: []`,
>     max 2 entries (`src/lib/facultyClassSync.js`).
>   - When a second teacher goes to **"+ Add Class"** and picks the exact
>     same dept+batch+section+term+course, `findJoinableAssignment()` (used
>     in `FacultyClasses.jsx`) silently detects the existing assignment and
>     shows a **"Join"** option instead of letting them create a duplicate
>     class. Clicking Join calls `joinFacultyAssignment()`, which appends
>     their uid to `teacherUids`. No code-sharing, no invite link needed —
>     it's automatic based on matching course selection.
>   - Once joined, `teacherSlot` (`'teacher1'` or `'teacher2'`, resolved by
>     array index) already gates **separate Marks entry** per teacher
>     (`MarksTab` in `FacultyClassDetail.jsx`) — each teacher has their own
>     45-mark quota split (`teacher1MarkComponents` / `teacher2MarkComponents`
>     Firestore fields).
>   - **Gap found:** `AttendanceTab` does NOT currently check `teacherSlot`
>     at all — both teachers, if joined, can currently mark attendance with
>     no distinction of who did what beyond the generic `loggedBy` field.
>     This is fine to leave as-is (attendance is usually a single shared
>     log, unlike marks) — flag this to Akhinoor as a design decision, not
>     a bug, in Phase A kickoff.
>   - **Action needed:** just surface this existing Join flow more clearly
>     in the UI/docs so Akhinoor knows it's there — no backend work.
> - **PDF export infra exists.** `src/lib/facultyPdfExport.js` uses
>   `jsPDF` + `jspdf-autotable` (already in `package.json`), with
>   `exportClassSummaryPdf()` as a close precedent for the new attendance
>   sheet export.
> - **No Excel (.xlsx) library yet.** Will add `xlsx` (SheetJS) via npm —
>   small, client-side, no backend needed (matches the Spark-plan
>   constraint).
> - **Firestore write rules are already scoped correctly.** Attendance
>   writes go through `groups/{groupId}/facultyAssignments/{assignmentId}/
>   sessions/{sessionId}`, gated by `teacherUids[0/1] == request.auth.uid`
>   (`firestore.rules` ~line 2868). None of this needs to change — the new
>   "full roll roster" is a *read-side, client-generated* list, not a new
>   Firestore collection, so existing rules are untouched.
> 
> ## 3. What's actually new (the real work)
> 
> ### 3a. Full-roster generation (core of the whole feature)
> A new pure function, e.g. `generateDeptRollRoster(dept, batch, section)`
> in `src/lib/groupUtils.js` (alongside `getGroupId`, same file, same
> import surface everywhere that needs it):
> - Looks up `dept`'s seat count from `DEPARTMENTS`.
> - Looks up dept's 2-digit code from the reverse of `ROLL_DEPT_MAP`
>   (needs a reverse map, e.g. `DEPT_ROLL_DIGITS`, built once from
>   `ROLL_DEPT_MAP`).
> - Batch's 2-digit prefix: batch strings look like `2K23` → need `23`.
>   Check `extractBatchFromRoll`'s inverse logic carefully here — reuse
>   existing normalization if any exists, otherwise write a small
>   `batchToRollPrefix('2K23') -> '23'` helper.
> - Returns array of `seats` roll strings, zero-padded 3-digit seat number,
>   e.g. `['2313001', '2313002', ..., '2313030']` for a 30-seat dept.
> - **Multi-section depts (CE/EEE/ME/CSE):** seat range must be split
>   in half per section (A = seats 1..60, B = seats 61..120, for 120-seat
>   depts) — confirm this splitting convention with Akhinoor before coding
>   (KUET's actual admin convention may not be a clean half-split; flag as
>   an open question in Phase A, don't guess).
> - **Seat counts are DEFAULTS, not hard caps — confirmed by Akhinoor
>   2026-08-15.** The real number of students in a batch+dept can be
>   slightly higher than the official seat count (extra 1-3 students from
>   re-admission, transfer, etc. — e.g. 122 real students in a nominally
>   120-seat CSE batch). The generated roster from this function is a
>   *starting default only*; it must NEVER be treated as an exhaustive/
>   closed list anywhere downstream. Any roll outside the generated range
>   is added the exact same way as any other extra student — through the
>   same "add student" action used for backlog (see 3c), no separate
>   mechanism needed. This also means: don't validate/reject a roll just
>   because its seat number exceeds the dept's `seats` value anywhere in
>   the UI or backlog-add flow — that check would incorrectly block a
>   legitimate 122nd CSE student. Akhinoor also confirmed he'll eventually
>   upload the real, authoritative student list — at that point actual
>   names/rolls take over and the generated-range concept matters even
>   less; build with that eventual reality in mind (i.e., don't hardcode
>   assumptions that only the generated range is ever valid).
> 
> ### 3b. Merge generated roster with real member data
> In `AttendanceTab`, build a merged roster:
> ```
> mergedRoster = generatedRollList.map(roll => {
>   const realMember = members.find(m => m.roll === roll);
>   return {
>     id: realMember?.id || `placeholder:${roll}`,   // placeholder id = roll-based, stable across renders
>     roll,
>     name: realMember?.name || roll,                 // fallback: roll IS the name until account exists
>     isPlaceholder: !realMember,
>   };
> }).concat(backlogEntries);  // see 3c
> ```
> Sort by roll using existing `sortByRoll()` (already roll-aware,
> reuse as-is).
> - Attendance marks for a placeholder id key off `roll` string (not
>   Firebase uid) since there's no uid yet. **Important:** when a real
>   student later registers with that roll, their uid becomes the new key
>   — old placeholder-keyed marks under `roll` as key would need a
>   migration path. Simplest correct approach: **always key attendance
>   records by roll number, never by uid**, for every student (placeholder
>   or real) — sidesteps the whole migration problem entirely. This is a
>   schema decision — flag clearly in Phase A output which of
>   `createOrUpdateSessionAttendance`'s `attendance: {}` map keys change
>   from uid to roll, and make sure `computeStudentAttendancePercent` /
>   `computeAttendanceComponentScore` (used by Marks tab) are updated to
>   match, since marks attendance-weighting reads the same sessions data.
>   **DONE (Phase B) + refined:** `attendance` is 100% roll-keyed, no
>   exceptions, and is the only thing any read path uses. A secondary
>   `rollToUid` map was added on the session doc — audit-only, `{ roll:
>   uid }` for rolls that had a real account at save time, merged/
>   accumulated across saves, never read by any actual attendance-percent
>   or UI logic. Purpose: if a data question ever comes up later ("which
>   account was actually behind this roll on this date"), there's a real
>   trail instead of nothing, at near-zero cost since the uid is already
>   in hand when a save happens.
> 
> ### 3c. Backlog / extra-student — manual add
> This single "add student" mechanism covers TWO real-world cases, both
> handled identically (confirmed with Akhinoor 2026-08-15 — no need to
> distinguish them in the data model or UI flow, just in labeling if
> helpful):
> 1. A genuine backlog student (from an earlier batch, doing a repeat
>    course with this batch).
> 2. A regular student of THIS batch+dept+section whose roll simply falls
>    outside the generated seat-range default (see 3a's note on seat
>    counts being defaults, not hard caps — e.g. student #122 in a
>    nominally-120-seat CSE batch).
> 
> - A "+ Add student" button/modal in the Attendance tab (and ideally also
>   visible from Marks, since backlogs affect both — but scope this to
>   Attendance only for Phase A/B, extend to Marks in a later phase if
>   Akhinoor wants).
> - Stores added entries in a new small Firestore doc, e.g.
>   `groups/{groupId}/facultyAssignments/{assignmentId}/backlogStudents/{roll}`
>   with `{ roll, name, addedBy, addedAt }` — scoped per-assignment (an
>   added entry is specific to *this course offering*, not the whole dept
>   group), so it doesn't pollute the dept's real member list or other
>   courses' rosters. (Collection name kept as `backlogStudents` even
>   though it also covers case 2 above — renaming later is cheap if
>   Akhinoor wants a clearer name once he sees it in use.)
> - Roll format: always the standard 7-digit KUET pattern
>   (`/^\d{7}$/`, confirmed with Akhinoor — reuse `store.js`'s existing
>   regex, don't write a new one). **Do not reject a roll just because its
>   seat-number portion exceeds the dept's official `seats` count** — see
>   3a, this is exactly the over-quota case this mechanism exists for.
> - These merge into `mergedRoster` above, clearly tagged (e.g. small
>   "Added" badge next to their row) so the teacher can tell them apart
>   from the generated default roster.
> 
> ### 3d. UI rebuild — desktop (spreadsheet-like)
> Full visual rebuild of the roster list block (currently ~line 1236-1264
> of `FacultyClassDetail.jsx`), per Akhinoor's spec:
> - Column 1: Name + Roll stacked (existing pattern, keep) — OR flatten
>   into two real columns for a truer spreadsheet feel; confirm preference
>   during Phase C build (mock both, let Akhinoor pick).
> - Column 2 (attendance marking): **simplify from the current 4-option
>   P/A/L/E button row down to a 2-state toggle: Present (default,
>   green) / Absent (click to flip, red).** This is an explicit,
>   deliberate simplification per Akhinoor's request — confirm whether
>   Late/Excused marks should be fully removed or just hidden from this
>   quick-entry view (e.g. accessible via a "..." expand). **Do not
>   silently drop Late/Excused from the data model** — `markColors`/
>   `markLabels`/`marks` array and the Marks tab's
>   `computeStudentAttendancePercent` logic (which treats `late` as
>   present-equivalent) depend on those values existing; removing the UI
>   option is fine, removing the underlying capability needs an explicit
>   go-ahead.
> - Default state when no mark exists yet for a date: **Present**, not
>   blank — this is the "just click absentees" speed workflow. Needs a
>   care-point: distinguishing "explicitly marked present" from "never
>   touched, defaulted present" so `handleSave` doesn't write bogus
>   present marks for a date the teacher never actually opened/saved. Only
>   materialize the default-present value into `draftMarks` at save time,
>   not at render time.
> - Trailing columns (right side, same row): Total classes held so far,
>   Present count for this student, Percentage — all derivable client-side
>   from `sessions` (already fetched), reuse the existing
>   `attendanceSummary` calc logic (~line 983-993) per-row instead of only
>   in the separate summary card.
> - Header row: class/course details + KUET branding block (dept name,
>   course code/title, batch, term, teacher name(s), date) — this is the
>   "print header" Akhinoor wants baked into the export, but showing it
>   live in the UI too (as a compact header bar) keeps WYSIWYG consistency
>   between on-screen and exported sheet.
> - Export button: generates the Excel (default) or PDF (secondary option)
>   of the *currently visible* table, header block included.
> 
> ### 3e. UI rebuild — mobile (2-row swipeable)
> - Row 1 (identity): defaults to Roll, swipe left↔right reveals Name.
> - Row 2 (attendance): defaults to today's/selected date's mark, swipe
>   left↔right cycles through other dates' marks (read history) — but the
>   *editable* mark (today/selected date) should probably stay pinned as
>   the default resting position after any swipe-away-and-back, so a
>   teacher marking attendance doesn't lose their place. Needs a small
>   interaction-design pass in Phase C — build a prototype, get Akhinoor's
>   hands-on feedback before finalizing, this is exactly the kind of thing
>   that reads fine as a spec but needs to actually be tried.
> - Use a lightweight swipe/gesture approach — check if a swipe library is
>   already in `package.json` (search before adding a new dependency).
> 
> ### 3f. Date auto-detect from Class Setup schedule
> - Currently `AttendanceTab` already defaults `date` to `todayStr()` and
>   has an `isAutoDate` ref that re-syncs on tab focus (existing code,
>   keep). The **new** piece: check today's day-of-week against
>   `assignment.dayTimeSlots` (or `ScheduleTab`'s routine data via
>   `subscribeRoutine`) — if today isn't a scheduled day for this class,
>   should the date field still default to today, or default to the last
>   scheduled class day? Confirm with Akhinoor in Phase A kickoff; his
>   message says "ajker date ta mile tahole sei date ta default dekhabe" —
>   reads as: only auto-set today if today IS a scheduled day, otherwise
>   leave it for the teacher to pick manually. Implement that interpretation
>   unless corrected.
> 
> ### 3g. Excel + PDF export
> - Add `xlsx` (SheetJS) as a new dependency (`npm install xlsx`).
> - New file `src/lib/attendanceExport.js`:
>   - `exportAttendanceExcel(assignment, mergedRoster, sessions, dateRange)`
>     — builds a worksheet: header rows (KUET + class details), then one
>     row per student (roll, name, per-date P/A columns or a summary
>     range — confirm with Akhinoor whether export is "today's sheet" or
>     "full term to-date sheet with a column per class date," since his
>     message implies the latter — a full running register, not just a
>     single day's snapshot).
>   - `exportAttendancePdf(...)` — reuse `jsPDF`/`jspdf-autotable` pattern
>     from `facultyPdfExport.js`'s `exportClassSummaryPdf` as the direct
>     template.
> - Both exposed via one "Export" button with a small format-choice menu
>   (Excel default per Akhinoor, PDF secondary).
> 
> ## 4. Open questions — ANSWERED (2026-08-15)
> 
> 1. **Multi-section dept (CE/EEE/ME/CSE) split — ANSWERED.** Clean 60/60
>    half split. Section A = seats 1-60, Section B = seats 61-120. A
>    section toggle bar (Section A / Section B) sits above the roster,
>    default view shows both as separate tabs. Teacher can:
>    - **Add** a new student into either section (reuses the backlog-add
>      mechanism from 3c, not a separate feature).
>    - **Swap** a student from Section A to Section B or vice versa —
>      keep this simple, no approval workflow, just a move action that
>      updates which section's placeholder/backlog list the student sits
>      in. Design as a lightweight action (e.g. a small "Move to Section
>      B" button on the student row), not a dedicated modal/flow.
>    - **Excel export combines both sections into one file** — the dept's
>      full batch (both sections) exports together, not two separate
>      downloads. This matters for Phase A's roster generator: it should
>      have a mode that returns the FULL dept+batch roster (both sections
>      merged, still section-tagged per student) for export purposes, in
>      addition to the per-section view used for daily attendance-taking.
> 2. **Backlog student roll format — ANSWERED.** Always the standard
>    7-digit KUET roll pattern (`/^\d{7}$/`, same regex already used
>    elsewhere in `store.js` for `studentId` validation). No free-text
>    rolls. Reuse the existing validation regex — don't write a new one.
> 3. **Excel export scope — ANSWERED.** Full running register: one column
>    per class date held so far this term (like a physical attendance
>    register), not a single-day snapshot. This is the bigger, more
>    valuable build — plan `attendanceExport.js` (Phase G) around
>    `sessions` (already fetched, one doc per held date) mapped to columns,
>    roster rows down the side, matching the classic register look.
> 4. Late/Excused marks — still open, not urgent, decide during Phase D
>    build (default to: keep in data model, hide from quick-entry UI,
>    revisit only if Akhinoor flags it).
> 5. `teacherSlot` enforcement on Attendance — still open, not urgent,
>    decide during Phase H (default to: leave attendance open to either
>    joined teacher, unlike Marks — matches "attendance is usually a
>    single shared log" reasoning in section 2).
> 
> ## 5. Working discipline for every phase (per Akhinoor's standing rule)
> 
> - Read the actual current source fully before touching it — don't assume
>   from this plan doc alone; the codebase may have shifted between
>   sessions.
> - Small, verifiable changes — one logical piece per phase, not a giant
>   rewrite in one shot.
> - Confirm a **zero-error `npm run build`** after every phase before
>   packaging output.
> - Every session's output: **two files** —
>   1. This same `ATTENDANCE_REBUILD_PLAN.md`, **updated** (not replaced)
>      — Progress Log section appended, phase statuses updated.
>   2. A **full project ZIP** (not just changed files) — `node_modules`
>      and `dist` excluded, everything else included, so the ZIP is always
>      a complete, buildable drop-in replacement.
> 
> ## 6. Phase breakdown
> 
> - **Phase A — Roster generation core.** `generateDeptRollRoster()` +
>   reverse dept-digit map + batch-prefix helper in `groupUtils.js`. Unit-
>   verify against a few known rolls (e.g. confirm `2313014` round-trips
>   correctly for ESE batch 2K23). No UI changes yet. Resolve open
>   questions #1 and #2 above before starting this phase.
> - **Phase B — Data model migration (uid-keyed → roll-keyed attendance).**
>   Switch `attendance: {}` map keys from uid to roll across
>   `createOrUpdateSessionAttendance`, `computeStudentAttendancePercent`,
>   `computeAttendanceComponentScore`, and `AttendanceTab`/`MarksTab`'s
>   read sites. This is the highest-risk phase (touches existing saved
>   data shape) — needs a migration/back-compat plan for any sessions
>   already saved uid-keyed in production. Flag this explicitly to
>   Akhinoor before writing migration code; do not silently assume old
>   data can be discarded.
> - **Phase C — Merged roster + backlog students.** Wire
>   `generateDeptRollRoster()` into `AttendanceTab`, add the backlog
>   add-student modal + Firestore doc, build the merged/sorted roster list
>   with placeholder-vs-real-vs-backlog tagging.
> - **Phase D — Desktop UI rebuild.** Spreadsheet-style columns, 2-state
>   Present/Absent toggle with default-present-on-save behavior, trailing
>   total/percentage columns, header block.
> - **Phase E — Mobile UI rebuild.** 2-row swipeable view (roll↔name,
>   today↔history).
> - **Phase F — Date auto-detect from schedule.**
> - **Phase G — Excel + PDF export.** Add `xlsx` dep, build
>   `attendanceExport.js`, wire the Export button + format picker.
> - **Phase H — Multi-teacher visibility polish (small).** No new backend
>   — just make the existing Join flow more discoverable/documented in the
>   Attendance tab context (e.g. a note or link near the roster if
>   `teacherUids.length < 2`), plus decide/resolve open question #5.
> 
> ## 7. Progress Log
> 
> *(Every phase's session ends with an entry here. Newest at the bottom.
> Next AI/dev: your starting point is always the last entry's "Next up"
> line.)*
> 
> - **2026-08-15 — Planning session.** Read `FacultyClassDetail.jsx`
>   (`AttendanceTab`, `MarksTab`), `groupSync.js` (`subscribeMembers`),
>   `facultyClassSync.js` (assignment + join-teacher flow),
>   `facultyMarksSync.js` (session/teacherSlot schema), `groupUtils.js`
>   (`getGroupId`), `store.js` (`DEPARTMENTS`, `ROLL_DEPT_MAP`,
>   roll-parsing helpers), `facultyPdfExport.js`, and `firestore.rules`
>   (relevant write-gate sections). Confirmed multi-teacher join flow
>   already fully exists and needs no new backend work. Wrote this plan.
> 
> - **2026-08-15 — Answers received.** Akhinoor confirmed: (1) CE/EEE/ME/
>   CSE section split is clean 60/60 (Section A = seats 1-60, Section B =
>   61-120), a section toggle bar sits above the roster with add/swap
>   actions kept intentionally simple (no approval flow), and Excel export
>   combines both sections into one file. (2) Backlog students always use
>   the standard 7-digit KUET roll pattern, no free-text. (3) Excel export
>   is a full term running register — one column per class date held so
>   far, not a single-day snapshot. Recorded all of this in section 4
>   above, replacing the open-questions list.
> 
> - **2026-08-15 — Phase A DONE.** Added to `src/lib/groupUtils.js`:
>   - `DEPT_TO_ROLL_DIGITS` — reverse of `store.js`'s `ROLL_DEPT_MAP` (dept
>     code -> 2-digit roll code), built once so it can't drift from the
>     single source of truth.
>   - `batchToRollPrefix(batch)` — `'2K23'`/`'2k23'`/`'23'` -> `'23'`.
>   - `generateDeptRollRoster(dept, batch, section)` — the core roster
>     generator. Single-section depts ignore `section` and return the full
>     seat range. Multi-section depts (CE/EEE/ME/CSE) require `'A'`/`'B'`
>     for the daily-attendance view, or return the full 120 with each
>     entry tagged `section: 'A'|'B'` when called with `'BOTH'`/omitted —
>     that combined mode is what Phase G's Excel export will use per
>     Akhinoor's "dui section eksathe" instruction.
>   - `store.js`: changed `const ROLL_DEPT_MAP` to `export const
>     ROLL_DEPT_MAP` (only change to that file — nothing else touched) so
>     `groupUtils.js` can derive the reverse map from it instead of
>     duplicating the table.
>   - **Verified correctness against real data**: generated roll for ESE
>     (dept digits `13`), batch `23`, seat `14` → `2313014`, which exactly
>     matches "MD AKHINOOR ISLAM · 2313014" visible in the Attendance
>     screenshot Akhinoor shared. CSE (120 seats) section split verified:
>     Section A = `2307001`-`2307060`, Section B = `2307061`-`2307120`.
>   - `npm run build` — zero errors, confirmed after `npm install` (deps
>     were stripped for the previous session's ZIP packaging).
>   - No UI changes yet — `generateDeptRollRoster()` exists but nothing
>     calls it yet. That's Phase B/C.
> 
>   **Next up: Phase B — data model migration (uid-keyed → roll-keyed
>   attendance).** This is flagged as the highest-risk phase in section 3b
>   — it changes what `createOrUpdateSessionAttendance`'s `attendance: {}`
>   map is keyed by (Firebase uid → roll number string) so a placeholder
>   student (no account yet) and a later-registered real account for the
>   same roll share the same attendance history with no migration step
>   needed. Read `facultyMarksSync.js` fully fresh before starting (session
>   schema, `computeStudentAttendancePercent`, `computeAttendanceComponentScore`)
>   plus `AttendanceTab`/`MarksTab`'s read sites in `FacultyClassDetail.jsx`,
>   since both consume the same `sessions` data. Before writing any code,
>   flag to Akhinoor: does any already-saved production attendance data
>   exist that would need migrating (old sessions keyed by uid), or is it
>   safe to treat this as a clean schema change since the feature is new
>   enough that little/no real attendance has been recorded yet? Do not
>   assume — ask.
> 
> - **2026-08-15 — Akhinoor confirmed: zero teachers on the platform yet,
>   completely fresh.** No production attendance data exists at all — safe
>   to treat Phase B as a clean schema change, no migration logic needed.
> 
> - **2026-08-15 — Phase B DONE.** Confirmed the full call chain first:
>   `computeStudentAttendancePercent`/`computeAttendanceComponentScore` in
>   `facultyMarksSync.js` are key-agnostic (just read
>   `sessions[i].attendance[key]`, don't care if the key is a uid or a
>   roll string) — so no logic changes needed inside that file, only doc
>   comments + param naming for clarity. Also confirmed (via
>   `grep -rn "\.attendance\?\.\["`) that only 3 call sites in the whole
>   codebase read a session's `attendance` map — all three already
>   reviewed, no student-side page touches this teacher-side collection.
> 
>   Changes made:
>   - `src/pages/faculty/FacultyClassDetail.jsx` — `AttendanceTab`:
>     `setMark`/`draftMarks` now keyed by `m.roll` instead of `m.id` (uid)
>     everywhere in the roster render loop and the `attendanceSummary`
>     calc (the Most Regular / Most Absent / Class Performance card).
>   - Same file — `MarksTab`: `attendancePctFor` now takes a roll, not a
>     uid (marks themselves — `studentRecords/{uid}` — deliberately STAY
>     uid-keyed, since marks entry inherently needs a real account; only
>     the attendance-percentage lookup inside marks changed).
>     `buildFieldsForSave`/`handleSave` now take both `studentUid` (for
>     where to save marks) and `studentRoll` (for the attendance % lookup)
>     — two different keys for two different purposes, kept explicit
>     rather than conflated.
>   - `src/lib/facultyMarksSync.js` — updated doc comments on
>     `createOrUpdateSessionAttendance` and
>     `computeStudentAttendancePercent` to state the new roll-keying
>     explicitly (so a future reader doesn't have to reverse-engineer it),
>     renamed the internal `uid`/`studentUid` variables in the
>     `editHistory` diffing logic to `roll`/`studentRoll` for consistency.
>     No functional/behavioral change in this file — pure clarity edits.
>   - `npm run build` — zero errors.
>   - **Scope note:** `AttendanceTab` still only loops over `members`
>     (real accounts) — the merged full-roster (placeholders + backlog)
>     isn't wired in yet, so there's nothing to manually test end-to-end
>     yet (a placeholder roll literally can't appear in the UI until Phase
>     C). This phase was purely "make the data layer roll-shaped so Phase
>     C has nothing left to migrate."
> 
>   **Next up: Phase C — merged roster + backlog students.** Wire
>   `generateDeptRollRoster()` (Phase A) into `AttendanceTab`: build the
>   merged roster (generated rolls + real `members` matched by roll +
>   backlog entries), tag each row `isPlaceholder`/`isBacklog`, sort with
>   `sortByRoll`. Add the Section A/B toggle bar for CE/EEE/ME/CSE (default
>   60/60 split, confirmed). Add the backlog-student add modal + swap-
>   section action (kept simple per Akhinoor — no approval flow) + the new
>   Firestore doc shape for backlog entries
>   (`facultyAssignments/{id}/backlogStudents/{roll}`, standard 7-digit
>   roll format only, confirmed). Read `AttendanceTab` fully fresh again
>   before starting — Phase B's edits changed several lines inside it.
> 
> - **2026-08-15 — Phase B follow-up: audit snapshot added.** Akhinoor
>   asked to weigh roll-only keying (Phase B as shipped) against also
>   keeping a uid trail, and asked for whichever is genuinely best rather
>   than picking for him. Recommended and built the hybrid: roll stays the
>   ONE source of truth for attendance (zero change to Phase B's actual
>   logic, every read path unchanged) plus a new optional `rollToUid`
>   snapshot map on the session doc for audit/debug traceability, at near-
>   zero added cost since the uid is already sitting in `members` when
>   `handleSave` runs.
>   - `facultyMarksSync.js` — `createOrUpdateSessionAttendance` now accepts
>     an optional `rollToUid` param, merges it into the existing map on
>     every save (accumulate, never overwritten wholesale — same spirit as
>     `editHistory`), documented clearly as audit-only / never a read
>     source for any real logic.
>   - `FacultyClassDetail.jsx` — `AttendanceTab.handleSave` now builds
>     `rollToUid` from the current `members` list (real accounts only —
>     rolls with no account simply aren't included, not stored as an
>     explicit `null`, since most of a roster stays placeholder for a long
>     time and hundreds of `null` entries would add nothing) and passes it
>     through.
>   - `npm run build` — zero errors.
>   - No other file needed touching — `computeStudentAttendancePercent`,
>     `MarksTab`, and the roster UI all still only ever read `attendance`
>     (roll-keyed), never `rollToUid`. This was purely additive.
> 
>   **Next up: still Phase C** (unchanged from the note above) — this
>   follow-up didn't change Phase C's plan at all, since `rollToUid` is
>   audit-only and Phase C's merged-roster work doesn't need to read it.
> 
> - **2026-08-15 — Design note recorded (no code yet): seat counts are
>   defaults, not hard caps.** Akhinoor flagged that the real number of
>   students in a batch+dept can run 1-3 over the official seat count
>   (e.g. 122 in a nominally-120-seat CSE batch). Updated sections 3a and
>   3c to make this explicit: the generated roster is a starting default
>   only, never an exhaustive/closed list, and any student outside that
>   range (whether a genuine backlog student or just an over-quota regular
>   student) is added through the exact same "add student" mechanism —
>   no separate flow, no seat-count validation that would incorrectly
>   reject a legitimate extra student. This doesn't change Phase A's
>   already-shipped `generateDeptRollRoster()` (it was never meant to be
>   a closed list) — it changes how Phase C's merged-roster + add-student
>   UI must be built. **Next up: still Phase C**, now with this
>   constraint in mind from the start.
> 
> - **2026-08-15 — Phase C DONE.** Read `AttendanceTab` fully fresh first
>   (confirmed Phase B's roll-keying was already in place, nothing left to
>   migrate). Changes made:
>   - `src/lib/facultyMarksSync.js` — added `backlogStudentsCollection()` +
>     `addBacklogStudent()` / `moveBacklogStudentSection()` /
>     `removeBacklogStudent()` / `subscribeBacklogStudents()`, scoped to
>     `groups/{groupId}/facultyAssignments/{assignmentId}/backlogStudents/{roll}`
>     per §3c. Roll validated against the same `/^\d{7}$/` pattern
>     `store.js` already uses (not reinvented) — no seat-count upper-bound
>     check anywhere, per 3a's "defaults, not hard caps" rule. Doc id =
>     roll, so re-adding the same roll for the same assignment overwrites
>     rather than duplicating. Added `deleteDoc` to that file's Firestore
>     import (needed for `removeBacklogStudent`).
>   - `firestore.rules` — **flagged and fixed a gap the plan's §2 missed**:
>     the plan claimed "existing rules are untouched" for the new roster,
>     but that's only true for the read-side roster generation itself —
>     the new `backlogStudents` subcollection is a real new write path with
>     no existing rule, which would have default-denied every write. Added
>     a `match /backlogStudents/{roll}` block alongside the existing
>     `sessions` block, same access tier (assigned faculty for this
>     assignment, or CR/ACR/CL for read, or Admin) — not the stricter
>     Blue-Tick-only `studentRecords` tier, since this isn't graded data.
>   - `src/lib/groupUtils.js` — no changes; `generateDeptRollRoster()` used
>     exactly as Phase A shipped it.
>   - `src/pages/faculty/FacultyClassDetail.jsx` — `AttendanceTab`:
>     - New `backlogStudents` state + `subscribeBacklogStudents` effect.
>     - New `activeSection` state (defaults to the assignment's own
>       `section` field if set, else `'A'`) + a Section A/B toggle bar,
>       shown only when `isMultiSectionDept(assignment.dept)` — single-
>       section depts render nothing extra here, unaffected.
>     - Built `mergedRoster`: `generateDeptRollRoster(assignment.dept,
>       assignment.batch, multiSection ? activeSection : null)` matched
>       against `members` by roll (`isPlaceholder` when no real account),
>       concatenated with this section's `backlogStudents` entries
>       (`isBacklog: true`), sorted with the existing `sortByRoll()` — all
>       reused as-is per the plan, no new sort logic. A backlog entry whose
>       roll falls inside the generated range takes over that row (e.g. a
>       real name was manually added for an already-generated placeholder)
>       rather than showing twice.
>     - Roster rows now show a "No account yet" badge for placeholders and
>       an "Added" badge for backlog entries, so a teacher can tell the
>       three kinds of row apart (real account / placeholder / manually
>       added) at a glance, per §3c's "clearly tagged" requirement.
>     - `attendanceSummary` (Most Regular/Most Absent/Class Performance
>       card) now iterates `mergedRoster` instead of `members`, so
>       placeholder and backlog students' attendance % show up in the
>       summary too, not just registered accounts.
>     - Added the "+ Add student" bar (roll + optional name + section
>       picker for multi-section depts) above the roster, using
>       `addBacklogStudent()`. Client-side disables Add unless the roll
>       passes `/^\d{7}$/` — same regex, no upper-seat-bound check (3a).
>     - Added a per-row "Move to Section {other}" action, shown only on
>       backlog rows in a multi-section dept (a generated-range row has no
>       backlog doc to move — moving it would need adding it as a backlog
>       entry first, which is out of scope for a plain toggle click; not
>       built, flagged below).
>     - Did NOT add a "swap section" action for a *generated-range*
>       placeholder/real row (only backlog rows can move) — plan §4 item 1
>       describes "swap a student from Section A to B" generally, but a
>       generated row has no per-student Firestore doc to move without
>       first creating a backlog-style override, which changes its shape
>       from "generated default" to "explicit entry." Flagging this as an
>       open scope question rather than guessing — Phase D's UI pass is a
>       natural place to revisit if Akhinoor wants every row swappable, not
>       just backlog ones.
>   - `npm run build` — zero errors, confirmed after `npm install`.
>   - Not built in this phase (explicitly out of scope per §3d/§3e/§3f):
>     the spreadsheet-style desktop rebuild, mobile 2-row swipe view, the
>     2-state Present/Absent toggle, default-present-on-save behavior, and
>     date auto-detect from schedule. This phase's roster (generated +
>     backlog, section-toggled) is wired into the EXISTING 4-button P/A/L/E
>     row UI as-is — Phase D is where that UI itself gets rebuilt.
> 
>   **Next up: Phase D — Desktop UI rebuild.** Spreadsheet-style columns
>   (see §3d), 2-state Present/Absent toggle (default Present, only
>   materialized into `draftMarks` at save time per §3d's care-point — the
>   current `setMark` toggle logic will need to change shape here, read it
>   fresh), trailing total/present-count/percentage columns per row (reuse
>   `attendanceSummary`'s per-student calc, now roster-complete after Phase
>   C), header block (dept/course/batch/term/teacher/date). Resolve the
>   flagged open scope question above (swap action for non-backlog rows)
>   with Akhinoor before or during this phase — don't guess.
> 
> - **2026-08-15 — Phase D DONE.** Read `AttendanceTab` fully fresh first
>   (Phase C's merged-roster edits changed several lines since the last
>   full read). Resolved the open scope question flagged at the end of
>   Phase C's entry, and one plan-default from §4, both recorded below
>   rather than silently picked.
> 
>   **Resolved: "swap section" scope (flagged end of Phase C).** Extended
>   the move action to every roster row, not just backlog ones — matches
>   §4 item 1's plain reading ("swap a student from Section A to B",
>   stated generally). New `moveStudentToSection()` in
>   `facultyMarksSync.js`: if a `backlogStudents` doc already exists for
>   that roll, plain section update (same as the old
>   `moveBacklogStudentSection`, which is left in place — still exported,
>   still correct for a pure-backlog-only call site — but no longer called
>   from `AttendanceTab`, which now always goes through the generic path).
>   If no doc exists yet (a generated-range row), moving it creates one —
>   a section move necessarily turns an implicit/derived row into an
>   explicit entry, which is exactly the same "outside the generated
>   default" mechanism §3c already describes for the over-quota case, so
>   this isn't a new concept, just applying the existing one to a new
>   trigger. The created doc is tagged `movedFromGenerated: true`
>   (informational only, no read path branches on it) so a future admin
>   data-audit can tell "added because we didn't know this student
>   existed" apart from "added because a section move happened." A moved
>   row now shows the "Added" badge, same as any other backlog row — this
>   is accurate, since it now genuinely IS an explicit Firestore entry, not
>   a generated default.
> 
>   **Resolved: Late/Excused (§4 item 4, "decide during Phase D").**
>   Confirmed default applied as stated in the plan: kept fully in the data
>   model (draftMarks/attendance can still hold 'late'/'excused',
>   `computeStudentAttendancePercent` unchanged, still treats both as
>   attended), hidden from the main quick-entry toggle, reachable per-row
>   via a "…" expand. The main Present/Absent button disables itself (with
>   a tooltip) while a row holds a Late/Excused mark, so a stray click on
>   the primary toggle can't silently downgrade a deliberate L/E mark —
>   the teacher has to reopen "…" to explicitly change it back.
> 
>   Changes made:
>   - `src/lib/facultyMarksSync.js` — added `moveStudentToSection()` (see
>     above). `moveBacklogStudentSection()` untouched, just no longer the
>     only move path.
>   - `src/pages/faculty/FacultyClassDetail.jsx` — `AttendanceTab`:
>     - Added a compact header block above the existing summary card:
>       dept full name (looked up from `DEPARTMENTS`, newly imported from
>       `store.js`) + course code/title, then batch(+active section)/term/
>       teacher name/date on a second line. Kept live in the UI (not just
>       baked into the eventual Phase G export) so on-screen and exported
>       views match — WYSIWYG per §3d.
>     - Rebuilt the roster block as an actual table: header row (Name/Roll,
>       Held, Present, %, Mark) + one row per `mergedRoster` entry, replacing
>       the old plain `.faculty-row` list. Trailing three columns
>       (Held/Present/%) come from a new `rowStatsByRoll` map — same calc
>       `attendanceSummary` already used, just not filtered to
>       `markedCount>0` (a brand-new placeholder correctly shows 0/0/— in
>       its own row instead of vanishing, unlike the ranked summary lists
>       where it should stay excluded).
>     - Replaced the 4-button P/A/L/E row with a single 2-state
>       Present/Absent toggle (`togglePresentAbsent`) + a "…" button that
>       expands Late/Excused as two small secondary buttons per row, per
>       §3d's explicit simplification instruction and §4 item 4's resolved
>       default above.
>     - Default-present-on-save: `draftMarks` itself is untouched by
>       rendering — the toggle's displayed state falls back to 'present'
>       only via `effectiveMark = draftMarks[m.roll] || 'present'` at
>       render time, and that default is only ever WRITTEN into what gets
>       saved inside `handleSave` (loops `mergedRoster`, fills in 'present'
>       for any roll with no explicit `draftMarks` entry, right before
>       calling `createOrUpdateSessionAttendance`). Opening a date and not
>       saving still leaves the underlying `sessions` doc exactly as it
>       was — nothing is committed just from rendering the default.
>     - "Move to Section" is now shown on every row (not just backlog
>       rows) in a multi-section dept, calling `handleMoveSection(roll,
>       name, newSection)` → `moveStudentToSection()`.
>   - `firestore.rules` — no changes needed this phase; `moveStudentToSection`
>     writes through the same `backlogStudents/{roll}` path Phase C already
>     opened up.
>   - `npm run build` — zero errors, confirmed after edits.
>   - Not built in this phase (explicitly out of scope, next phases per
>     the breakdown): mobile 2-row swipeable view (Phase E), date
>     auto-detect from schedule (Phase F), Excel/PDF export (Phase G) — the
>     live header block above is designed to be reused as-is by Phase G's
>     export, not rebuilt there.
> 
>   **Next up: Phase E — Mobile UI rebuild.** 2-row swipeable view (§3e):
>   Row 1 (identity) defaults to Roll, swipes to reveal Name; Row 2
>   (attendance) defaults to the selected date's mark (now the 2-state
>   toggle + "…" built in Phase D — reuse `effectiveMark`/`togglePresentAbsent`/
>   `setMark` as-is, don't reimplement), swipe cycles through other dates'
>   read-only history, editable mark should stay pinned as the resting
>   position after swiping away and back (needs a hands-on prototype pass
>   per the plan's note — build one, get feedback before finalizing). Check
>   `package.json` for an existing swipe/gesture library before adding a
>   new dependency (plan explicitly calls this out — search first).
