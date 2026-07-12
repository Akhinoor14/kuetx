# Faculty Module — Round 2 Fixes (Tools page + Founder switch placement + Teacher directory)

## 1. Tools page was genuinely broken — missing route

`nav-faculty.js` declares the "Tools" group with `hubPath: '/faculty/tools'`
(Contact, Settings, About), but `App.jsx` never registered a matching
`<Route path="/faculty/tools" ...>`. Clicking into Tools from the faculty
sidebar hit React Router's no-match — this is exactly "kichu nei" (nothing's
there).

**Fixed:** added the missing route in `App.jsx`, same pattern as the other
hub routes (`SubgroupHub` pointed at `NAV_FACULTY`, `group="Tools"`).

## 2. Founder Student/Teacher switch — moved to the Admin dashboard

You were right: the switch button only ever rendered for the Founder
(`isFounderBypass`) — a real faculty or real student account never saw it at
all. Having it sit inside the everyday sidebar header and Faculty Dashboard
banner was confusing because it looked like a real feature to real users, when
it's actually Founder-only testing tooling.

**What changed:**
- Removed the switch button from `Sidebar.jsx`'s header (the underlying
  `viewModePref`/localStorage state stays there — it's what Sidebar/BottomNav
  actually read to decide which nav renders, that part was correct all along
  and didn't move).
- Removed the now-pointless "use the switch in the sidebar" note from
  `FacultyDashboard.jsx`'s Founder banner, updated to point at the new
  location instead.
- Added a proper `FounderViewSwitchCard` at the top of `AdminDashboard.jsx`'s
  landing grid (the Founder/Admin dashboard) — shows current view state
  ("Currently viewing as: Student/Teacher") with a clear toggle button. This
  component only ever renders inside `AdminDashboard.jsx`, which itself
  early-returns for anyone who isn't Founder-authorized, so it's naturally
  Founder-only with no extra guard needed.
- Confirmed: the Founder can already hold both a Teacher shell (via
  `isFounderBypass` in `useIsFaculty.js`, no separate account) and the
  Student shell (their real account) simultaneously — this was already true,
  just badly surfaced. Nothing needed to change in the underlying access
  logic, only where the control lives.

## 3. Teacher directory redesigned — "Total Teachers" now sundor

`FacultyView`'s Directory tab (inside Admin → Faculty) was a plain flat list
with no summary numbers — much less polished than the student-side dept/batch
breakdown.

**Redesigned to include:**
- Three stat cards at the top: **Total Teachers**, **Departments
  Represented**, **Awaiting Verification** — same visual card style already
  used on the Faculty Dashboard's own stat row (`statCard` pattern), so it's
  visually consistent across the app, not a new one-off style.
- A row of small department pill-badges showing per-dept teacher counts
  (e.g. "ESE · 4", "CSE · 2"), sorted by count.
- The teacher list itself now shows a colored initial avatar, name (bold),
  a title badge (e.g. "Assistant Professor") and department inline, and the
  official email — instead of the old single-line "Name — Title · Dept ·
  Email" text dump.

No data model or backend changes — this is a pure read-side redesign using
the exact same `listAllFacultyAccounts()` data that was already being
fetched.

## Files in this bundle (drop into matching repo paths)

```
src/App.jsx
src/components/Sidebar.jsx
src/pages/AdminDashboard.jsx
src/pages/faculty/FacultyDashboard.jsx
```

## Suggested test

1. As Founder, open Admin dashboard → confirm the new switch card appears
   at the top with correct current-view label and a working toggle.
2. As Founder, switch to Teacher view → confirm sidebar still switches to
   NAV_FACULTY correctly (mechanism unchanged, only the button moved).
3. Open `/faculty/tools` (or tap Tools in the faculty sidebar) → confirm it
   now shows Contact/Settings/About cards instead of a blank page.
4. Open Admin → Faculty → Directory tab → confirm the new stat cards, dept
   pills, and redesigned teacher list render correctly with real data.
