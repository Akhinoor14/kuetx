# KUETx Fix — Manage Batches now stays inside the Founder shell

## Problem
"Manage Batches" was the only Founder section implemented as a real
route (`<Link to="/admin/batches">`), instead of an internal `view`
inside `AdminDashboard`. So clicking it left the `TeamDashboard` shell
entirely — losing the "Founder / Senior campus lead / Campus lead"
role-tab chips and the "Team & Administration" hero, and it wasn't in
the category pill row (`CategorySubNav`) either — it hung off to the
side as an `extraLink`.

## Fix
- `src/pages/FounderBatchSettings.jsx` — split into:
  - `export function BatchesContent()` — all the state/logic/JSX, minus
    the outer page hero/background. Reusable.
  - `export default function FounderBatchSettings()` — thin wrapper that
    adds back the standalone page hero, so the direct `/admin/batches`
    route still works exactly as before (any existing links/bookmarks
    keep working).
- `src/lib/founderCategories.js` — added `batches` as a normal entry in
  `FOUNDER_CATEGORIES` (icon: Users, no subcategories — same shape as
  `comms`), so it's auto-generated into the grid and the pill row like
  every other section.
- `src/pages/AdminDashboard.jsx`:
  - Imports `BatchesContent`.
  - Added `BatchesView`, which wraps `<BatchesContent />` in the same
    `CategoryShell` every other section uses (role-tab chips stay
    visible, pill subnav shown, in-shell back button).
  - Wired `view === 'batches'` into the view switch.
  - Removed the special-cased `<Link>` grid card and the `extraLink`
    prop on `CategorySubNav` — Manage Batches is now just another
    `FOUNDER_CATEGORIES` entry, rendered the same way as Approvals,
    Communication, etc.

## Result
Manage Batches now opens inside the Founder tab shell — same header,
same role-tab chips, same category pill row as Approvals/Communication/
etc — instead of navigating away to a bare standalone page.
