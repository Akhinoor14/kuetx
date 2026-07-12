# Round 6 — Class creation coverage + Students/CR permission bug

## "Sob batch sob course ney to?" — checked thoroughly, this part is fine

Traced the full chain: batch dropdown (`BATCH_START_DATES` keys) → dept
dropdown (`DEPARTMENTS` array) → `getGroupId` canonicalization → course list
(`getDeptTerms` → `CURRICULUM.departments[deptCode].terms`).

- Batch and dept dropdowns pull from the exact same canonical sources
  students' side uses — nothing narrowed or hardcoded separately for
  faculty.
- `getGroupId`'s `canonicalize()` upper-cases both batch and dept before
  building the Firestore path, and BOTH faculty class creation and student
  group-membership go through this same function — so a lowercase `2k23`
  from the faculty dropdown and a lowercase `2k23` derived from a student
  roll both end up as the same `2K23_XXX` path. No mismatch.
- Checked all 16 departments' curriculum data files exist and contain real
  term data (verified by file size, all in the several-hundred-byte range,
  not empty stubs). `Arch` (the one mixed-case dept code) matches
  consistently on both the `DEPARTMENTS` list and the curriculum data keys
  — initially looked suspicious, turned out fine.

No bug found in class-creation coverage. If you're seeing a SPECIFIC
batch+dept+term combination that shows zero courses, tell me exactly which
one and I'll trace that specific path rather than the general mechanism
(which checks out).

## "Student connection + class card permission shortage" — REAL BUG FOUND AND FIXED

This one was real. `firestore.rules`' `members/{memberUid}` read rule
(inside `groups/{groupId}`) only allowed: Admin, the member themself, a
fellow group member (students only), CL, Head of Ops, or SCL. **No branch
covered faculty at all.** A verified teacher opening "Students & CR" on
their own class card would hit `permission-denied` on every single read —
exactly the "permission shortage" you remembered seeing.

This block predates the Faculty Module entirely and was simply never
updated when faculty read-access was added elsewhere in the same file.

**Fixed:** added `isVerifiedFaculty(request.auth.uid)` to the read
condition — matching the exact same precedent already used a few blocks
down for `facultyAssignments`' own read rule (broad "any verified faculty
can read" rather than scoped to one specific class), so this is consistent
with a design decision already made elsewhere in the file, not a new one
invented just now.

Also checked `ClassmatesList.jsx` (the component `FacultyClassDetail.jsx`
reuses for this tab) for any client-side role gate that could still hide
the roster even after the rules fix — there isn't one; `viewerRole="faculty"`
with `showActions={false}` just renders the plain read-only grid, so the
rules fix alone is the complete fix here.

## File in this bundle

```
firestore.rules
```

**Must be redeployed** (`firebase deploy --only firestore:rules`) — same as
every other rules change, this doesn't take effect from a code push alone.

## Suggested test

As a verified faculty account, open any of your classes → Students & CR tab
→ confirm the roster now loads instead of showing empty/erroring silently
(check browser console for any lingering permission-denied — should be
gone).
