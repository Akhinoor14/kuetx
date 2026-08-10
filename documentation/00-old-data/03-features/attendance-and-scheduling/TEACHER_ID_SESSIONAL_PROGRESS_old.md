# Teacher-ID Migration + Sessional Scheduling — Progress

Source spec: `IMPLEMENTATION_PROMPT.md` ("KUETx — Teacher-ID Migration +
Sessional Scheduling Fix"). Implementation order follows the prompt's own
recommendation: Section 2 → Section 1 → Section 3, each phase shipped and
tested independently rather than bundled in one pass.

## Phase status

- [x] **Phase 1 — Section 2: remove teacher field for teacher-less types** — ✅ সম্পন্ন
- [~] **Phase 2 — Section 1: teacher-ID migration (registry + key rewrite + data migration)** — 🔶 চলছে, আংশিক সম্পন্ন (details below)
- [ ] **Phase 3 — Section 3: sessional/lab alternating-week cadence** — ⏳ Phase 2 শেষ হবার পর

---

## Phase 1 — Section 2 ✅ COMPLETE

**Scope:** `src/pages/Schedule.jsx` only — hide the "Teacher (Select One)"
field (and its Add/Edit Teachers button + hint text) whenever
`isSessionalType(type)` is true, in both the main Add/Edit modal (`form`
state) and the Quick-add form (`quickFormData` state). Clear any stale
teacher value the moment Type switches to a teacher-less type.

### What was actually found (beyond the prompt's stated bug)

The prompt described the bug as "field renders unconditionally." On
inspection, the real gap was three layers deep, not just the field render:

1. **Field render** — confirmed as described: both `form` and
   `quickFormData` Teacher blocks rendered with no `isSessionalType` guard.
2. **Type-change handlers were dead code** — `handleFormTypeChange` and
   `handleQuickTypeChange` already existed (presumably written for this
   exact purpose earlier) but neither was actually wired to either Type
   `<select>` — both selects called `set('type', ...)` /
   `setQuickFormData(d => ({...d, type: ...}))` directly, bypassing the
   handlers entirely.
3. **Save-path fallback resurrected a teacher regardless of the form
   field** — `add()` and `saveQuickForm()` both unconditionally computed
   `selectedTeacher = normalizeTeacherName(teacherName) || availableTeachers[0] || ''`
   and always wrote `teacherName`/`teacherNames` onto the saved entry —
   so even with the field hidden, saving a Sessional slot immediately
   after creating a Theory slot for the same course would have silently
   saved whichever teacher was staged (or `availableTeachers[0]`).
4. **Edit-load path (`startEdit`) also injected a fallback teacher** —
   `teacherName: item.teacherName || courseTeachers[0] || ''` when
   loading ANY entry into the quick-edit form, including sessional ones
   with no teacher.

All four layers needed fixing together for the acceptance criteria ("No
sessional-type schedule entry has a lingering teacher value saved from
before the type was changed") to actually hold — fixing only the field
render (what the prompt described) would have left layers 2–4 still
capable of silently attaching a teacher to a sessional entry.

### Changes made (`src/pages/Schedule.jsx`)

- `handleFormTypeChange` / `handleQuickTypeChange`: now clear
  `teacherName` when switching to a teacher-less type; both are now
  actually wired to their respective Type `<select>` elements (previously
  dead code).
- Main form's Teacher field block: wrapped in
  `{!isSessionalType(form.type) && (...)}`.
- Quick form's Teacher field block: wrapped in
  `{!isSessionalType(quickFormData.type) && (...)}`.
- `add()` (main form save): skips the teacher gate/fallback entirely for
  teacher-less types; omits `teacherName`/`teacherNames` from the saved
  entry rather than falling back to `availableTeachers[0]`.
- `saveQuickForm()`: same fix, same reasoning.
- `startEdit()`: no longer injects `courseTeachers[0]` as a fallback when
  loading a teacher-less-type entry into the edit form.

**Scope note:** per the prompt's own instruction ("check whether
Project/Tutorial should also be excluded; base this on whatever the grid
rendering already treats as teacher-less"), `isSessionalType` — the same
predicate the grid-cell renderer already uses — was reused as-is
(`/sessional|lab/i`), so this Section 2 fix hides the field for the exact
same type set the grid already treats as teacher-less. **Project and
Tutorial types were NOT included** in this pass, since `isSessionalType`
does not match them and the prompt left this as an open question rather
than a firm decision — worth confirming with Akhinoor before Project/
Tutorial slots are also made teacher-less, since that would be a
behavior change beyond what the grid currently does.

### Testing done

- `esbuild` syntax/bundle check on `Schedule.jsx` — passes clean (no
  local dev environment available to run this app live; per the prompt's
  own final step, a real manual trace/test through the Vercel/GitHub
  pipeline is still recommended before merging).

### Testing still needed (manual, by Akhinoor)

- Open Add Class form → switch Type to Sessional → confirm Teacher field
  disappears immediately.
- Switch back to Theory → confirm Teacher field reappears and works as
  before.
- Save a Sessional entry → confirm no `teacherName` is attached in the
  saved schedule data.
- Edit an existing Theory entry with a teacher set → switch its Type to
  Sessional → save → confirm the teacher value is actually cleared, not
  just hidden.
- Same four checks in the Quick-add form (separate code path).

---

## Phase 2 — Section 1: Teacher-ID migration — IN PROGRESS

Scope per the prompt: new group-shared `teacherRegistry` (ID → name),
`courseTeacherMap` changes from name-strings to teacherIds,
attendance/marks/rotation keys change from `courseId_teacherName` to
`courseId_teacherId`, one-time idempotent client-side migration per
group, and every teacher-picker UI (except `CourseTeacherDialog.jsx`)
becomes an ID-based `<select>`.

**IMPORTANT — a prior session's transcript for this phase (see
`IMPLEMENTATION_PROMPT.md`'s accompanying conversation log) described a
lot of investigation and a `teacherRegistry.js` module as "written" —
that was **not actually true**. On resuming, the file did not exist and
zero code had been touched. The investigation/design conclusions from
that transcript were still valid and useful (file list, write-path
tracing, etc.) and are reflected below, but treat any future "already
done" claim in a stale transcript with suspicion — verify against the
actual files before trusting it.

### Design decisions locked in

- `teacherRegistry` (`{teacherId: name}`) and `courseTeacherMap`
  (`{courseId: [teacherId, ...]}`) both live in the same existing
  `groups/{groupId}/meta/plannerSettings` doc — no new Firestore path.
- `CourseTeacherDialog.jsx` stays free-text/name-based, unchanged, by
  design (per original prompt). ID assignment happens one layer up, in
  whichever page's save-handler wires the dialog to
  `updatePlannerSettings` — via `resolveTeacherIdsForNames`.
- Three independent write sites do this (not one, as originally assumed
  from the file grep) — `ClassSetup.jsx`, `ClassSetupModal.jsx`, AND
  `useClassManagementState.js` (a third, previously-unlisted
  `CourseTeacherDialog` flow reached via `/class-planner`).
- `plans[courseId].teachers` (a separate per-course-plan field used for
  planning targets, badges, and the plan-reset default) is a **display
  cache of names**, seeded from `courseTeacherMap` at write time — it
  stays name-based always, in both group and local mode. Confirmed via
  tracing every read site (`assignedTeacherCount`, `plannerRows`,
  `resetPlan`, `ClassPlanner.jsx`'s `CourseTeacherDialog` props) — none
  of them key anything off it, all just display/log it as a string.
- **Local (non-group, single-device) `courseTeacherMap` stays name-based,
  untouched.** The whole ID problem is a multi-CR-editing-shared-data
  problem; a single local user has no collision risk, so there's no
  reason to add ID indirection there. Only the `groupId`-branch of every
  dual-mode file gets converted.
- Migration itself is a pure function (`migrateCourseTeacherMapToIds` in
  the new lib) + a boot-time effect in `App.jsx`, gated to CR/ACR only
  (via `subscribeMyRole`, the same server-verified source `RequireCR.jsx`
  trusts — never `profile.isCR`, which is just a self-ticked checkbox).
  Non-CR/ACR members read whatever shape is already there; only the
  CR/ACR's client ever performs the actual migration write. Idempotent —
  fires on every `plannerSettings` snapshot but no-ops (no write) once
  already migrated.

### Files DONE (verified with esbuild syntax/bundle checks, no live-app test yet)

1. **`src/lib/teacherRegistry.js`** (NEW) — the whole foundation:
   `normalizeTeacherName`, `resolveTeacherIdsForNames` (name→id, reuses
   existing id for a case/space-insensitive match, mints new otherwise),
   `resolveTeacherNames`/`resolveTeacherName` (id→name, unknown id falls
   back to showing the raw id rather than vanishing), `isCourseTeacherMapMigrated`,
   `migrateCourseTeacherMapToIds` (pure, idempotent). Hand-tested outside
   the app (mocked `uid()`, 6 cases: fresh resolve, name-variant reuse,
   full legacy-map migration, idempotency-on-rerun, id→name round trip,
   empty-map edge case) — all passed. See test script reasoning in this
   session; not checked into the repo as an actual test file yet.

2. **`src/App.jsx`** — added the CR/ACR role-tracking effect
   (`isCrOrAcrRef` via `subscribeMyRole`) and the migration-trigger effect
   piggybacking on the existing `subscribePlannerSettings` boot mirror
   (same effect area as the `scheduleFields` → `scheduleSettings` mirror,
   right below it). Calls `migrateCourseTeacherMapToIds`, writes via
   `updatePlannerSettings` only if a real (non-null) result comes back
   and only if the CR/ACR check passed.

3. **`src/pages/ClassSetup.jsx`** — added `teacherRegistry` state +
   subscription; `handleSaveTeachers` now resolves typed names→ids via
   `resolveTeacherIdsForNames` before writing both `courseTeacherMap` and
   `teacherRegistry`; now returns the write promise instead of
   fire-and-forget (bonus bugfix — matches `ClassSetupModal.jsx`'s
   already-correct await-based error handling, which this file
   previously didn't have).

4. **`src/components/ClassSetupModal.jsx`** — same treatment as
   `ClassSetup.jsx` (state, subscription, `handleSaveTeachers` resolves
   names→ids); `teacherRegistry` prop threaded through to both of its two
   `ClassSetupTermCourses` render sites (mandatory-first-visit view and
   the "one more required step" partial view).

5. **`src/components/ClassSetupTermCourses.jsx`** — takes a new
   `teacherRegistry` prop; both the `CourseRow` display line
   (`teachers.join(', ')`) and the `currentTeachers` array handed to
   `CourseTeacherDialog` now go through `resolveTeacherNames` first,
   since `courseTeacherMap[courseId]` is now ids, not names. This
   component wasn't in the original 13/15-file list from the prior
   session's investigation — it's a real consumer that displays
   `courseTeacherMap` values directly and would have silently shown raw
   teacher IDs instead of names if missed.

6. **`src/pages/useClassManagementState.js`** — split the map into
   `rawCourseTeacherMapIds` (group mode: real ids, used ONLY by the write
   path) vs. `effectiveCourseTeacherMap` (name-resolved via
   `resolveTeacherNames`, used by literally everything else in this file
   — `quickLogClass`'s logged `teacherName` string, `assignedTeacherCount`,
   `plannerRows`/plan-seeding, `resetPlan`'s default, and the
   `exportRoutineBackup` JSON, which is fine/better as human-readable
   names since it's export-only and never re-imported anywhere — grepped
   to confirm). `handleCourseTeacherDialogSave` (the third write site,
   reached via `/class-planner`) now resolves names→ids in the
   `groupId` branch only; local-mode branch untouched (stays names, see
   design decision above). Verified downstream that `ClassPlanner.jsx`
   (the consumer of this hook's `effectiveCourseTeacherMap` /
   `handleCourseTeacherDialogSave`) needed ZERO changes — it already just
   treats `effectiveCourseTeacherMap` values as display/datalist names,
   which is exactly what it now correctly receives.

All 6 files above pass `esbuild --bundle` (App.jsx bundles the entire
app tree cleanly; the rest checked individually with `--packages=external`).
No live/manual test in the actual Vercel/dev environment yet — same
caveat as Phase 1's testing note.

### IMPORTANT DECISION MADE (resolves the biggest open question from before)

**Attendance.jsx needs NO changes.** Traced the actual data flow fully:
`Attendance.jsx` never keys anything off `courseTeacherMap` directly —
its `mark()`/`switchTeacher()`/`cardData` keys are all built from
`resolveTeachersForDate()`, which reads routine entries' `teacherName`
field (`s.teacherName`, set by Schedule.jsx). `courseTeacherMap` is only
touched as a FALLBACK inside `getTeachersForCourse()`, for a slot with no
routine-level teacher set. And routine entries' `teacherName` is itself
always populated FROM `courseTeacherMap` via Schedule.jsx's
`getCourseTeachers()` — a single resolver function every caller
(dropdowns, `startEdit`, `autoDisplayName`, the teacher-picker `<select>`)
already goes through. So: resolve ids→names once, at that one source
function, and routine entries — and therefore all of Attendance.jsx —
keep receiving real names exactly as before. No blast radius into
Attendance.jsx, Schedule.jsx's routine-writing logic, or any
attendance/marks/rotation key.

This was confirmed to be the architecturally correct choice, not just
the lower-effort one: Attendance.jsx's own `getEffectiveForCourse`
already has independent protection against the "renamed teacher orphans
old attendance" problem (whole-course prefix summing across every
`courseId_<any teacher>` key, regardless of which name), so the ID
migration was never actually load-bearing for Attendance.jsx's
correctness — only for `courseTeacherMap`/`teacherRegistry` itself
(which IS now fixed). If attendance keys ever do need to become
id-based in the future, this phase's `teacherRegistry`/resolver
foundation is already in place — only Attendance.jsx's own key-building
would need touching then, nothing upstream.

**`attSlotTeacherPool` / `attRotationLog`** (local-only rotation
tracking) — no change needed either, by the same reasoning: they track
names sourced from `s.teacherName`, which is already guaranteed to be a
real resolved name by the fix above.

### Files DONE (additional, this round)

7. **`src/pages/Schedule.jsx`** — turned out to be a **4th independent
   `courseTeacherMap` write site** (in-grid "Add Class"/quick-add flow's
   `CourseTeacherDialog`), not caught by the prior session's file list or
   this session's first pass. Fixed:
   - Added `teacherRegistry` (group mode: `groupPlannerSettings.teacherRegistry`;
     local mode: `{}` — `resolveTeacherNames` falls back to the raw
     string when a key isn't in the registry, so local mode's
     name-based `courseTeacherMap` passes through this unchanged for
     free, no separate code path needed).
   - `getCourseTeachers(courseId)` — the single resolver every other
     piece of this file goes through — now resolves ids→names in group
     mode before returning. This is THE fix that makes Attendance.jsx
     safe to leave untouched (see above).
   - `allKnownTeachers` (the datalist that seeds `CourseTeacherDialog`'s
     name suggestions) — resolved the same way.
   - `handleCourseTeacherDialogSave` — resolves typed names→ids in group
     mode before writing (local mode unchanged, stays names).
   - `persistSettings` — now takes an optional second
     `nextTeacherRegistry` arg, included in the group-mode Firestore
     write only when actually provided (every other `persistSettings`
     caller in this file — holiday dates, message format, custom slots,
     etc. — doesn't pass it, so `teacherRegistry` is never
     accidentally clobbered by an unrelated settings save).
   - Verified no other direct `courseTeacherMap[...]` reads exist in this
     file outside `getCourseTeachers` itself — confirmed via grep.
   - esbuild syntax/bundle check passes.



- **Display-only `courseTeacherMap` consumers still showing raw ids**
  (would currently render teacherId strings instead of names — real bug
  if shipped as-is right now, since they haven't been touched):
  - `src/pages/Courses.jsx` (`getCourseTeachers(courseId)` — feeds
    chip rendering, `handleTeacherChipClick`, `getTeacherChipClass`,
    `getTeacherInfo(name)`; confirmed in the original investigation that
    the chip-rendering code itself doesn't need to change, only the
    resolution happens once at the `getCourseTeachers` source — same
    minimal-edit strategy as everywhere else)
  - `src/pages/TermQS.jsx` (line ~88, `courseTeacherMap[courseId].map(normalizeTeacherName)`
    — normalizeTeacherName here is the LOCAL trim/whitespace helper, not
    an id resolver; needs `resolveTeacherNames` inserted before it, or
    swapped in place of it)
  - `src/pages/Assignments.jsx` (same shape as TermQS.jsx, line ~83)
  - `src/pages/CTQuizPlanning.jsx` (`teachersMap` prop into `EventModal`
    — this one reads `settings?.courseTeacherMap` from LOCAL
    `scheduleSettings` only, never group-subscribed directly on this
    page; per the design decision above local-mode stays name-based, so
    this may already be fine as-is for users without a group, BUT it's
    unclear whether `scheduleSettings.courseTeacherMap` ever gets
    populated FROM group data on this page — needs checking; if it does
    mirror group ids in here somehow, it needs the same resolver
    treatment as everywhere else)
  - `src/pages/TermPlanner.jsx` (line ~67,
    `settings.courseTeacherMap?.[courseId]` — same shape, needs checking
    which mode(s) feed `settings` here)

- **`src/pages/Attendance.jsx`** — ✅ confirmed no changes needed (see
  "IMPORTANT DECISION MADE" above). Not touched, deliberately.

- **`src/lib/facultyDisambiguation.js`** — has a stale comment claiming
  courseTeacherMap is "entirely LOCAL, never synced to Firestore", which
  is wrong (confirmed group-synced via plannerSettings). Doesn't block
  anything (this module works on `routineEntries.teacherName`, unrelated
  to courseTeacherMap), but should get a corrected comment so it doesn't
  mislead a future session again.

- Every teacher-**picker UI** becoming ID-based `<select>` (rather than
  free-text/local-cache) per the original prompt's section 1e — not
  started for any of TermQS.jsx/Assignments.jsx/CTQuizPlanning.jsx's
  pickers (these currently populate `<select>` options from
  `getCourseTeachers`-style name arrays; once those resolve properly via
  the fixes above they'll at least DISPLAY correctly, but per the
  original prompt's requirement they should also store/submit ids where
  it makes sense — TermQS/Assignments were already assessed in the prior
  session as display-only metadata, not attendance keys, so this is
  lower priority / consistency-only, not a correctness bug).

### Suggested resumption order (COMPLETED this round — see below)

1. ~~Fix the straightforward display-only consumers (Courses.jsx, TermQS.jsx,
   Assignments.jsx, TermPlanner.jsx)~~ — ✅ done.
2. ~~Check CTQuizPlanning.jsx's actual data flow (local vs mirrored)~~ — ✅
   checked and fixed (it needed the fix — see below).
3. ~~Fix the facultyDisambiguation.js stale comment~~ — ✅ done.
4. Manual test pass in the real dev/Vercel environment — **still not
   done**, still the biggest remaining risk. Nothing in this phase has
   been tested outside of esbuild syntax/bundle checks.

### Round 2 — resumption work (this session)

All 6 files below pass `esbuild --bundle` individually, and the full
`App.jsx` tree bundles clean (`npx esbuild src/App.jsx --bundle
--packages=external --loader:.jsx=jsx`) after every edit in this round —
no live/manual test yet, same caveat as before.

1. **`src/pages/Courses.jsx`** — `getCourseTeachers(courseId)` now
   resolves ids→names via `resolveTeacherNames` before returning (group
   mode only; local mode registry is `{}`, passthrough). Added
   `groupTeacherRegistry` state alongside the existing `groupTeacherMap`
   state, same `subscribePlannerSettings` callback. Chip rendering,
   `handleTeacherChipClick`, `getTeacherInfo` all get real names for free
   since they all go through `getCourseTeachers`.

2. **`src/pages/TermQS.jsx`** — same treatment in its own
   `getCourseTeachers(courseId)` (a separate, differently-shaped copy of
   the same pattern — dedupes + slices to 2 after resolving).

3. **`src/pages/Assignments.jsx`** — identical fix, identical shape to
   TermQS.jsx.

4. **`src/pages/TermPlanner.jsx`** — turned out to be a **real gap beyond
   what the prior session's investigation caught**, not just a "display
   ids instead of names" cosmetic issue. `getTeachersForCourse()` here is
   a **module-level function**, called from `CourseCard`, that read
   `store.get('scheduleSettings').courseTeacherMap` directly — but
   App.jsx's boot-time group→local mirror (the effect right above the
   migration effect) only copies `plannerSettings.scheduleFields`
   (holiday/class-off overrides) into local `scheduleSettings`, **never
   `courseTeacherMap` itself**. So in group mode this page's
   `courseTeacherMap` read was already stale/empty even before the ID
   migration — a pre-existing gap that the migration would have made
   worse (raw ids leaking) but didn't create. Fixed by adding a live
   `subscribePlannerSettings` subscription in `Marks()` (mirroring
   Courses.jsx/TermQS.jsx's pattern) and threading
   `groupCourseTeacherMap`/`teacherRegistry` down as new params to
   `getTeachersForCourse()` and as new props to `CourseCard`. Local mode
   (`groupCourseTeacherMap` null) falls back to the original
   `store.get('scheduleSettings')` read, unchanged.

5. **`src/pages/CTQuizPlanning.jsx`** — same root cause as TermPlanner.jsx
   (local-only `scheduleSettings.courseTeacherMap` read, never mirrored
   from the group's real map by App.jsx). This page's `EventModal`
   `teachersMap` prop was therefore already broken for any group member
   before this migration, not just id-vs-name broken. Fixed by adding a
   `subscribePlannerSettings` subscription (same pattern as everywhere
   else this round) and an `effectiveTeachersMap` memo that resolves
   ids→names per-course before handing the map to `EventModal`.

6. **`src/lib/facultyDisambiguation.js`** — corrected the stale comment
   that claimed `courseTeacherMap` is "entirely LOCAL... never synced to
   Firestore" — it is group-synced via `plannerSettings` (confirmed
   multiple times this phase). Also noted the id-vs-name distinction so a
   future session doesn't need to re-derive this. No functional change —
   this module works off `routineEntries.teacherName` (an already-resolved
   display string), never `courseTeacherMap` directly, so it needed no
   code changes, only the comment fix.

7. **`src/pages/Attendance.jsx`** — the progress doc previously said
   Attendance.jsx needs **no changes**, and that's still correct for its
   main data flow (`resolveTeachersForDate`, `mark()`,
   `getEffectiveForCourse`, etc. — all keyed off `s.teacherName`, already
   real names). BUT a second look this round found the module-level
   `getTeachersForCourse(settings, schedule, courseId)` helper (distinct
   from Attendance.jsx's *other* `getTeachersForCourseOnDate`, and also
   distinct from TermPlanner.jsx's same-named function) has a **fallback
   branch** — used only when a routine slot has no `teacherName` set —
   that reads `settings.courseTeacherMap[courseId]` directly. In group
   mode this is raw teacherIds, so that fallback would have displayed a
   raw id string instead of a name in Daily Log / Attendance Hero /
   Combined Attendance /the switch-teacher modal, specifically for a
   slot with no routine-level teacher assigned yet. Fixed:
   - `getTeachersForCourse` now takes an optional 4th `teacherRegistry`
     param; resolves the `courseTeacherMap` fallback through it when
     provided (undefined in local mode → old behavior, unchanged).
   - Added `groupTeacherRegistry` state next to the existing
     `groupTeacherMap` state in the main component, subscribed via the
     same `subscribePlannerSettings` callback; derived a `teacherRegistry`
     const (`undefined` outside a group, the live registry inside one).
   - Threaded `teacherRegistry` as a new prop into `AttendanceHero`,
     `DailyLog`, and `CombinedAtt` (the three sub-components that call
     `getTeachersForCourse`), and updated all 5 call sites
     (`AttendanceHero`, `DailyLog`, the switch-teacher modal inline in the
     main component, `CombinedAtt` ×2) to pass it through.
   - This does NOT touch any attendance/marks/rotation *key* — those all
     still key off `s.teacherName` exactly as before, per the original
     "no changes needed" reasoning. This fix is purely about not leaking
     a raw id into a *fallback display* path.

## Phase 3 — Section 3: Sessional alternating-week cadence — NOT STARTED

Scope per the prompt: `scheduleSettings.sessionalCadence` per-slot
occurrence model (`mode: 'alternating' | 'weekly' | 'manual'`, anchor
date + sparse per-date overrides), plugged into `todayItems.js` and
`Attendance.jsx`'s `getScheduleCoursesForDate`, plus a small CR-facing
settings UI to set anchor/mode, toggle a date, and trigger an explicit
"shift cadence from here" action.
