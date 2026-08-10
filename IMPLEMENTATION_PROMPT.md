# KUETx — Teacher-ID Migration + Sessional Scheduling Fix

This is a scoped implementation prompt for three related changes to the KUETx
codebase. Read all three sections before starting — sections 2 and 3 touch
the same files as section 1, so doing them together avoids re-touching the
same code twice.

---

## 1. Teacher identity: move from name-string keys to stable teacher IDs

### The problem (confirmed in code, not hypothetical)

Every place that records or reads attendance/marks against a teacher builds
its storage key by string-concatenating `courseId` and the teacher's
**display name** — e.g. `` `${courseId}_${teacherName}` `` — in:

- `src/pages/Attendance.jsx` (`mark()`, `getEffective`, `getEffectiveForCourse`,
  `resolveTeachersForDate`, `attSlotTeacherPool`, `attRotationLog`, the
  `attCombinedData` combined-mode keys)
- `src/store/store.js` (`computeEffectiveAttendance`)
- `src/pages/TermPlanner.jsx` (formerly `Marks.jsx` — reads the same keys via
  `computeEffectiveAttendance` and its own `getTeachersForCourse`)

The name itself lives in `courseTeacherMap`, a **group-shared, Firestore-synced**
setting (`groups/{groupId}/meta/plannerSettings.courseTeacherMap`), shaped as
`{ [courseId]: [teacherName, teacherName] }` — plain strings, no IDs. It's
read/written from at least 13 files (grep `courseTeacherMap` across `src/` to
get the current list before starting — the exact file set may have grown
since this prompt was written).

Consequence: **editing a teacher's display name anywhere silently detaches
every attendance/marks entry already recorded under the old name.** The data
isn't lost — it's still sitting in `attLogs`/`attCombinedData` under the old
string key — but nothing reads that key anymore, so it stops counting. This
is a structural problem, not a typo problem: it happens on *every* rename,
even a deliberate, correctly-executed one (e.g. fixing a spelling mistake,
or changing "Ma'am" to "Miss" because that's what the teacher actually goes
by), not just accidental retyping.

### The fix: stable teacher IDs, name is just a display field

**Do NOT** try to solve this by improving name-matching, fuzzy comparison, or
re-normalization — that was tried and explicitly rejected (see git history /
prior conversation: normalization logic was removed on purpose because it
caused its own mismatches). The correct fix is that **no attendance/marks
key should ever contain a teacher's name.** Names change; IDs don't.

#### 1a. New shared teacher registry (group-scoped, not the existing local `teachers` store)

The existing `store.get('teachers')` (`src/pages/Teachers.jsx`) is a
**personal, per-device, local-only** contact directory — it already has a
stable `id: uid()` per record, but it's the wrong data: it's never
group-synced, and it's not what actually drives Schedule/Attendance/Marks
(that's `courseTeacherMap`, which has no IDs at all).

Add a new group-shared registry, `groups/{groupId}/meta/teachers` (or fold it
into the existing `plannerSettings` doc as a `teacherRegistry` field —
whichever fits the existing `groupSync.js` doc-update patterns better; check
`updatePlannerSettings`/`subscribePlannerSettings` for the existing pattern
to follow). Shape:

```js
// teacherRegistry: { [teacherId]: { name: string, createdAt, createdBy } }
```

- `teacherId` is a generated `uid()`, stable for the life of the teacher
  record within that group.
- `name` is freely editable (per the earlier decision: **no forced
  honorific, no normalization** — whatever the CR types is what's stored,
  full free text).
- This registry is shared per-group (same scope as `courseTeacherMap`
  already is), so every classmate sees the same teacher list.

#### 1b. `courseTeacherMap` changes shape: names → IDs

`courseTeacherMap` becomes `{ [courseId]: [teacherId, teacherId] }` instead
of `{ [courseId]: [name, name] }`.

Any code that currently does `courseTeacherMap[courseId]` and expects an
array of display-ready strings must now resolve each ID through the new
teacher registry to get a name for display. Search for every
`courseTeacherMap?.[courseId]` / `courseTeacherMap[courseId]` read (the grep
list from section 1's problem statement) and update each to resolve IDs →
names via the registry before rendering.

#### 1c. Attendance/marks keys change from `courseId_teacherName` to `courseId_teacherId`

Update every write and read site:

- `Attendance.jsx`: `mark()`, `getEffective`, `getEffectiveForCourse`,
  `resolveTeachersForDate`/`slotKey`, `attSlotTeacherPool`,
  `attRotationLog`, `attCombinedData` key construction, and the
  `AttendanceHero`/`CombinedAtt`/`DailyLog` components that build these keys.
- `store.js`: `computeEffectiveAttendance`.
- `TermPlanner.jsx`: anywhere it reads `attLogs`/`combinedData` keyed by
  teacher.

Because the *routine* (`schedule` / `schedule_group_cache` entries) also
currently stores `teacherName` as a plain string per slot (see
`Schedule.jsx`'s `normalizeScheduleEntries`, `getUniqueTeacherNames`, and
every routine-entry shape), routine entries should also gain a `teacherId`
field alongside (or instead of) `teacherName`, so the Daily Log's
rotation-detection logic (`attSlotTeacherPool`, which currently pools
*names* seen for a slot) pools **IDs** instead. This is what makes a genuine
teacher-rotation (two different real teachers covering the same weekly slot
across the term) still distinguishable from a same-teacher rename — rotation
pools multiple *different* IDs; a rename is the same ID with an updated
registry `name`.

#### 1d. Migration for existing data (must run once, automatically, per group)

Existing groups already have `courseTeacherMap` full of name strings and
`attLogs`/`attCombinedData` full of name-keyed entries. On first load after
this change ships, for each group:

1. Read the existing `courseTeacherMap` (name-keyed).
2. For each unique name encountered, create one `teacherId` in the new
   registry with that name.
3. Rewrite `courseTeacherMap` to use the new IDs.
4. Rewalk every local `attLogs` entry and every `attCombinedData` entry: for
   each key matching `${courseId}_${oldName}`, rewrite it to
   `${courseId}_${teacherId}` using the mapping built in step 2. (`attLogs`
   is local/per-student, not group-shared, so this migration runs
   client-side, once, gated by a version flag in the local store so it never
   re-runs and never double-migrates a key that's already ID-based.)
5. Do the same for `attRotationLog`/`attSlotTeacherPool` (currently
   name-keyed slot identities).

This migration must be idempotent and safe to run concurrently across
several classmates' devices without corrupting the shared `courseTeacherMap`
(last-write-wins is already the existing Firestore behavior elsewhere in
this app — follow the same pattern, don't introduce a new conflict-resolution
scheme).

#### 1e. Every "select a teacher" UI becomes ID-based dropdown-only, no free text

Per the standing decision already made in this codebase: teacher name entry
happens in exactly one place, `src/components/CourseTeacherDialog.jsx`
(free-text, CR's own judgment, no forced normalization — keep this part as
is). Every *other* place that currently lets someone pick/type a teacher for
a class slot, attendance mark, or plan (Schedule.jsx's Add Class form,
Attendance.jsx's Daily Log rotation-pick and Switch-teacher controls,
TermPlanner.jsx, TermQS.jsx, Assignments.jsx, ClassManagement.jsx,
ClassPlanner.jsx) must become a **plain `<select>` populated from the
group's teacher registry, storing the selected teacherId** — not a text
input, not a datalist-with-free-typing. Renaming a teacher only ever happens
in `CourseTeacherDialog.jsx`, editing that teacher's registry `name`; the ID
these dropdowns store never changes, so historical data never detaches.

### Acceptance criteria

- Renaming a teacher (via `CourseTeacherDialog.jsx`) immediately shows all
  historical attendance/marks data for every course they're assigned to,
  under the new name, with zero data loss and zero manual re-marking.
- No file in `src/` builds an attendance/marks/rotation key using a teacher
  display name string. (Grep for `_${teacherName` / `_${t}\`` /
  `${courseId}_${` patterns as a final check — none should concatenate a
  name.)
- Existing groups' historical data survives the one-time migration with
  correct held/attended counts (write a quick manual test: mark a course
  present twice under a name, rename the teacher, confirm the Live
  Attendance card and TermPlanner's auto-attendance % are unchanged).
- No free-text teacher-name input exists anywhere except
  `CourseTeacherDialog.jsx`.

---

## 2. Sessional/Lab classes: remove the teacher field entirely from the Add/Edit Class form

### Current bug

In `src/pages/Schedule.jsx`'s Add/Edit Class modal, the "Teacher (Select
One)" field is rendered unconditionally, regardless of `form.type`. The
timetable *grid* already hides the teacher label for sessional cells at
render time (`isSessionalType(item.type)` branches in the grid-cell
renderer), but the input form itself still forces a teacher to be picked/set
for Sessional, Project, and Tutorial-type slots, which don't track a single
per-slot teacher the way Theory classes do.

### Fix

In the Add/Edit Class form, wrap the "Teacher (Select One)" field (and its
helper "Add Teacher"/"Edit Teachers" button and the related warning text
below it) in a condition that hides it whenever
`isSessionalType(form.type)` is true (i.e. for `Sessional` — check whether
`Project`/`Tutorial` should also be excluded; base this on whatever the grid
rendering already treats as teacher-less, for consistency between the form
and the grid). When hidden, `form.teacherName` (or, after section 1's
migration, `form.teacherId`) should be cleared/omitted for that entry rather
than silently keeping a stale value.

Also update the inline hint text ("Select a course to enable teacher setup")
so it doesn't show for sessional-type slots either, since it currently
implies a teacher step is still coming.

### Acceptance criteria

- Selecting Type = Sessional (or whatever set of teacher-less types is
  decided above) in the Add/Edit Class form immediately hides the entire
  teacher field and its helper controls.
- Switching Type back to Theory brings the teacher field back, still working
  as before (or as migrated in section 1).
- No sessional-type schedule entry has a lingering teacher value saved from
  before the type was changed.

---

## 3. Sessional/Lab (0.75 credit) alternating-week scheduling

### The real-world pattern to model

KUET's 0.75-credit sessional/lab courses commonly run on an **alternating
weekly cadence** — held one week, skipped the next, repeating — rather than
every week like a Theory course. On top of that base cadence:

- A specific occurrence can be **cancelled ad hoc** (e.g. a single week's
  session is called off, regardless of whether that week would normally be
  an "on" week or an "off" week).
- The gap pattern can **break** — e.g. two "on" weeks can occur back-to-back
  instead of strictly alternating, because a missed week gets made up the
  following week, shifting the rest of the term's cadence.

This is a genuinely different recurrence model from Theory classes (which
this app already treats as "every week on this weekday, minus global
holidays" via `isRoutineHoliday`/`holidayDates`). There is currently **no
code anywhere in this app that models alternating/skip-week recurrence** —
confirmed by searching for `biweekly`/`alternate`/`weekParity`/`oddWeek`/
`skipWeek`/etc. across `src/pages/Schedule.jsx` and `src/store/store.js`:
none exist. The only existing "this class doesn't happen this day"
primitive is the single, app-wide `scheduleSettings.holidayDates` list,
which is blunt (it cancels that date for *every* course, not per-slot) and
has no concept of a recurring pattern.

### Design goal

Sessional slots need their own, **per-slot** occurrence schedule that is:

1. **Editable, not purely computed** — because real-world gaps drift (a
   missed week shifts everything after it), the app cannot reliably compute
   "is this sessional on this week" from a pure alternating-parity formula
   alone forever; the CR needs to be able to override/adjust it as the term
   actually unfolds.
2. **Defaults to alternating cadence** so the CR doesn't have to manually
   configure every week from scratch — the common case (strict
   every-other-week from the term start date) should be the zero-effort
   default.
3. **Supports one-off cancellation** without disturbing the underlying
   cadence — cancelling a single occurrence shouldn't require re-deriving
   the whole term's schedule.
4. **Supports cadence drift** (two "on" weeks in a row, or an extra skipped
   week) as a deliberate adjustment, not just a cancellation.

### Suggested data model

Add a per-sessional-slot occurrence record, keyed by the same stable slot
identity already used elsewhere in this codebase for rotation-tracking (see
`Attendance.jsx`'s `slotKey = ${courseId}::${day}::${slot}` pattern — reuse
this exact key shape for consistency rather than inventing a new one):

```js
// scheduleSettings.sessionalCadence: {
//   [slotKey]: {
//     mode: 'alternating' | 'weekly' | 'manual',
//     anchorDate: 'YYYY-MM-DD',   // the first date this sessional actually runs
//     // 'alternating': runs on anchorDate, then every 14 days from there,
//     //   by default — this is the computed baseline.
//     overrides: {
//       // per-date exceptions layered on top of the computed baseline —
//       // this is what absorbs cancellations and cadence drift without
//       // needing to touch anchorDate or recompute anything before/after it.
//       'YYYY-MM-DD': 'on' | 'off',
//     },
//   }
// }
```

- **Baseline occurrence** for a given calendar date = computed from `mode` +
  `anchorDate` (for `alternating`: on if `(date - anchorDate) / 7 days` is an
  even number of weeks; for `weekly`: same as a Theory class, every week; for
  `manual`: nothing happens unless `overrides` says so — full manual
  control from day one, for edge-case courses that don't fit either
  pattern).
- **Effective occurrence** for a date = `overrides[date]` if present,
  otherwise the baseline. This is how a single ad-hoc cancellation
  (`overrides[date] = 'off'`) or a make-up/extra week
  (`overrides[date] = 'on'`) gets recorded without disturbing anything else
  — and critically, **without shifting the baseline for every date after
  it**, which is what would happen if the cadence were re-anchored on every
  exception instead of using a sparse override map.
- If a real, sustained drift happens (e.g. the whole rest of the term shifts
  by a week because of a long break), that's the case where re-setting
  `anchorDate` going forward *is* appropriate — but that should be an
  explicit CR action ("shift this sessional's cadence from here"), not
  something the app infers automatically. Don't try to auto-detect drift
  from override density; let the CR trigger it deliberately, with a
  confirmation of what changes.

### Where this plugs in

- **Today page / `todayItems.js`**: `buildTodayItems` currently includes
  every routine entry matching today's weekday unconditionally (see the
  `schedule.filter((e) => e.day === todayWeekday ...)` block). For sessional
  entries, additionally check the effective occurrence for today's date
  before including them — skip if `'off'`.
- **Attendance Daily Log** (`Attendance.jsx`'s `getScheduleCoursesForDate`):
  same additional check — a sessional slot with an "off" effective
  occurrence for the selected date shouldn't appear as something to mark
  attendance for at all (not "holiday", just "not scheduled this
  particular week").
- **Schedule grid**: the weekly grid view is inherently a single-week
  template (it doesn't currently render a specific calendar date, just "the
  Sunday slot", "the Monday slot", etc.), so it likely keeps showing
  sessional slots as always-present in the template — that's fine and
  expected; the alternating logic only matters when resolving *today* or
  *a specific date*, not the abstract weekly template. Don't try to make the
  grid itself show "on/off this week" — that's outside the grid's current
  scope and would need a separate week-picker UI to even make sense.
- A small settings UI (likely inside `ClassSetup.jsx`/`ClassManagement.jsx`,
  wherever sessional slots already get configured) to let the CR: set the
  anchor date and mode when a sessional slot is first created; toggle a
  specific date on/off; and trigger the explicit "shift cadence from here"
  action described above.

### Acceptance criteria

- A newly created Sessional slot defaults to alternating cadence anchored on
  its first scheduled date, with zero extra CR configuration required for
  the common case.
- Marking a single date as cancelled doesn't change what the Today page or
  Daily Log show for any other date, past or future.
- Marking a single date as an extra/make-up session doesn't require
  touching the slot's anchor date or any other date's status.
- A deliberate "shift from here" action correctly re-anchors the cadence for
  future dates only, leaving past dates' recorded occurrences untouched.
- Theory-type slots are completely unaffected — this cadence system only
  applies to slots explicitly configured with `mode !== 'weekly'`, and the
  default for any slot without a `sessionalCadence` entry is "runs every
  week" (today's existing behavior), so nothing changes for courses that
  don't opt into this.

---

## Suggested implementation order

1. Section 2 first (small, isolated, no data-model change, quick win).
2. Section 1 (teacher IDs) — this is the largest change and section 3
   benefits from reusing its `slotKey` pattern, so land this before section 3.
3. Section 3 (sessional cadence) last, once the slot-identity plumbing from
   section 1 is in place.

Do not attempt to ship all three in a single pass without testing each
independently — section 1 alone touches 13+ files and a Firestore schema
change; bundling it with untested new scheduling logic makes it much harder
to isolate a regression if one appears.
