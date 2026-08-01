# Role Select, faculty routing, and "Continue does nothing" — root causes & fixes

## 1. Role Select overlay showed the dashboard through it
**Bug:** `RoleSelectScreen.jsx` used `background: 'rgba(0,0,0,0.5)'` — a
50%-translucent dark overlay, so the half-rendered Dashboard underneath was
visible (dimmed) right through the modal, as seen in the screenshot.

**Fix:** Replaced with a fully opaque, branded full-screen background (soft
radial gradient using the existing `--accentSoft` token blended into
`--bg`, plus a frosted `--surfaceGlassStrong` card) — nothing behind it is
visible anymore, and it now looks like an intentional welcome screen
instead of a semi-broken overlay. Added icon circles, hover states, and
better spacing for a more polished first impression. No new dependency or
library was needed — everything uses CSS variables already defined in
`src/index.css`, so it automatically matches both light/dark themes.

## 2. Role was being asked again on every login (existing users especially)
**Bug:** `accountRole` was stored **only** in `localStorage` — a per-
browser flag never synced anywhere. This broke in two ways:
- A genuinely-registered faculty account signing in on a new device, a
  different browser, or after clearing site data saw Role Select again,
  even though their role was already decided and provable.
- **Every pre-existing account** (created before this feature existed)
  has no `accountRole` in localStorage at all — so *every single one of
  them* was going to hit Role Select on their very next login, despite
  having used the app for months. This is what "amar jara age user tader
  ki hobe" was asking about.

**Fix:** `buildQueue()` in `App.jsx` now checks the one fact that's
actually authoritative before ever falling back to the local flag: does
`faculty/{uid}` exist for this signed-in, non-anonymous user? That doc is
only ever created once, by `createFacultyShell()`, at the moment someone
registers as faculty — so its existence is unambiguous, server-side proof
of role, unlike a browser-local flag.
- If `faculty/{uid}` exists → sync `accountRole = 'teacher'` locally and
  skip Role Select entirely, on any device.
- If it doesn't exist and the account isn't anonymous → sync
  `accountRole = 'student'` (the safe, correct default for the
  overwhelming majority of existing accounts) and skip Role Select.
- Role Select now only ever appears for a genuinely brand-new, not-yet-
  decided anonymous/guest session — exactly once, at sign-up, matching
  what was asked: "shign up er shomoy tokhoni ekbar dibe, shetai set hobe,
  erpore shei account diye login korle abar chaibe na."

## 3. Faculty account landed on the Student dashboard, not Faculty
**Bug:** the root route was hardcoded: `<Route path="/" element={<Dashboard />} />`
— always the **student** dashboard, for every signed-in account, with no
role check at all. `FacultyDashboard` only ever existed at `/faculty`,
which nothing ever navigated a teacher to automatically.

**Fix:** `/` now checks `accountRole` and redirects verified teacher
accounts straight to `/faculty`:
```
<Route path="/" element={getAccountRole() === 'teacher' ? <Navigate to="/faculty" replace /> : <Dashboard />} />
```
The sidebar's nav-switching logic (`Sidebar.jsx`, via `useIsFaculty()`'s
server-verified `isRealFaculty`) was already correct and needed no
change — it was only the initial landing page after login that ignored
role.

## 4. "Continue" on the faculty placeholder did nothing
**Bug:** `isFacultyProfileComplete(fdoc)` checks for `name`, `title`, and
`dept` fields — but no UI anywhere writes those fields yet (the real
Faculty Profile Setup form is unbuilt, Phase 4 work). So for every
verified faculty account, this check was **permanently false**. Clicking
"Continue" called `advance()`, which only shifts the **local** queue array
for that one render — it never fixes the actual reason `'profile'` got
queued (the doc still has empty `name`/`title`/`dept`). The very next
time `buildQueue()` ran (next reload, or any re-render triggered by an
auth-state change), `'profile'` got pushed right back — an infinite loop
that looked exactly like "Continue e click korle kichu e hoy na."

**Fix:** since there is currently no real form for a verified faculty
account to fill in, `buildQueue()` (and the two other places that inserted
`'profile'` for teachers — the sign-up completion handler and the
verify-holding-screen's `onVerified` callback) no longer queue `'profile'`
for teacher accounts at all. A verified faculty account now goes straight
from `'faculty-verify'` to the dashboard, with nothing left to block on.
The dead placeholder modal and its now-unreachable render branch were
removed (kept only as a defensive one-line fallback that auto-advances,
in case a stale queue somehow still contains `'profile'` for a teacher).
When Phase 4 ships the real `FacultyProfileSetupModal`, re-adding the
`'profile'` push back into these three spots is the only change needed.

## Files touched
- `src/App.jsx` — `buildQueue()`, root `/` route, sign-up completion
  handler, `faculty-verify` `onVerified` callback, removed dead
  placeholder render branch.
- `src/components/RoleSelectScreen.jsx` — opaque, polished full-screen
  background.

No Firestore rules or collection changes were needed — `faculty/{uid}`
already existed and was already the correct source of truth; it just
wasn't being consulted in the places that needed it.
