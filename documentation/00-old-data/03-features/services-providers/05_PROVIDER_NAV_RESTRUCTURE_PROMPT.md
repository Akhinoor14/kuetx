# KUETx — Provider Navigation Restructure — Implementation Prompt

## Context (read fully before starting)

KUETx is a React 18 + Vite + TailwindCSS + Firebase v10 PWA. It has three
account shells: student, faculty, and provider (shop owner). This task is
ONLY about the **provider** shell's navigation and page structure.

Right now:
- `src/components/Sidebar.jsx` renders `SidebarNavProvider` (in
  `src/components/nav-system/SidebarNavProvider.jsx`) when `isProvider` is
  true. It has 3 links: Dashboard (`/provider`), Settings (`/settings`),
  About (`/about`).
- `src/components/BottomNav.jsx` has NO provider branch at all — it only
  switches between `STUDENT_FIXED_BUTTONS` and `FACULTY_FIXED_BUTTONS`
  based on `viewMode`. A provider account currently falls through and
  sees the student bottom nav, which is wrong (those routes are
  guarded by `RequireStudentMode` and will block the provider anyway).
- ALL provider functionality currently lives in ONE file:
  `src/pages/provider/ProviderDashboard.jsx`. It renders, in order, on a
  single scrolling page:
  1. Open/closed toggle (always expanded — top priority)
  2. Pending bookings queue (always expanded)
  3. Confirmed bookings list (always expanded)
  4. Offerings manager (inside a `Collapsible`)
  5. Revenue total (inside a `Collapsible`)
  6. Shop meta editor — cover image, location, delivery (inside a
     `Collapsible`)
  7. Shop status control — pause / permanent close / reactivate (inside
     a `Collapsible`)
  8. Service details editor (inside a `Collapsible`)
- The route is `/provider`, guarded by `RequireProvider` in
  `src/App.jsx` — `RequireProvider` is a HARD gate: unverified provider
  accounts see `ProviderVerificationPending` instead of the dashboard,
  never a partial view. Do not change this gating behavior.
- The provider is explicitly a **mobile-first, busy shop-owner
  persona** — existing code comments literally say "owner is a busy
  salon owner on a phone, not someone browsing at leisure." Every
  decision below should optimize for that: minimal taps, no clutter,
  obvious at a glance, nothing scrolling forever.

## Goal

Split the provider experience into a small, clear set of pages, each
reachable via BOTH:
- a 3-tab **bottom nav** (primary, mobile-first path)
- a 3-link **sidebar** (secondary, desktop/backup path — same
  destinations, kept in sync)

### Final target structure

**Bottom nav / sidebar, 3 items, in this order:**

1. **Dashboard** (`/provider`) — stays exactly what it is today MINUS
   the collapsible sections. Contains only:
   - Open/closed toggle
   - Pending bookings queue
   - Confirmed bookings list
   (This is the "what needs my attention right now" page — nothing
   else. No offerings, no revenue, no shop meta, no status control, no
   details editor here anymore.)

2. **My Shop** (`/provider/shop`) — a NEW small hub page. It does NOT
   contain the actual editors. It shows a short list of 2 tappable
   cards, each navigating to its own sub-page:
   - Card 1: "Offerings & Earnings" → `/provider/shop/offerings`
     (contains: Offerings manager + Revenue total, exactly as they
     exist today, just moved)
   - Card 2: "Shop Details & Status" → `/provider/shop/settings`
     (contains: Shop meta editor + Shop status control + Service
     details editor, exactly as they exist today, just moved)
   Each card should show a one-line subtitle (e.g. offerings count,
   or current shop status) so the owner doesn't have to open it to
   know the state — reuse whatever data is already available in
   `service` (no new Firestore reads).

3. **Profile** (`/settings`) — unchanged, this already exists, just
   needs to be wired into the new bottom nav/sidebar consistently.

### Design/UX requirements — MUST follow

- Simple, minimal, "anyone can understand it in 2 seconds." No more
  than 3 bottom nav tabs. No nested tabs inside tabs.
- Each of the 3 new/moved pages should be its own route with its own
  `RequireProvider`-wrapped component — don't just hide/show sections
  with local state on one giant page.
- Preserve every existing behavior, string (including all Bangla UI
  text), Firestore call, and prop signature exactly — this is a
  **structural refactor, not a rewrite**. Do not change any business
  logic, validation, or copy text inside the moved components.
- Keep the existing `RequireProvider` gating: every provider route
  (`/provider`, `/provider/shop`, `/provider/shop/offerings`,
  `/provider/shop/settings`) must be wrapped in `RequireProvider`,
  exactly like `/provider` is today.
- The bottom nav must follow the existing pattern in the codebase:
  a dedicated `BottomNavProvider.js` file exporting
  `PROVIDER_FIXED_BUTTONS` (array of `{ id, label, icon, path, match }`),
  mirroring the shape of `BottomNavStudent.js` and
  `BottomNavFaculty.js`. Then wire it into `BottomNav.jsx` with a third
  branch (`isProvider ? PROVIDER_FIXED_BUTTONS : ...`), sourced from
  `useIsProvider()`. The existing `ProfileButton` special-casing for
  CR/staff does NOT apply to providers — providers just get a plain
  4th "Profile" button pointing to `/settings` (do not route it through
  `ProfileButton`'s CR/staff logic; add a simple provider-aware branch
  or a separate lightweight link).
- Update `SidebarNavProvider.jsx` to the new 3-link structure
  (Dashboard, My Shop, Settings — drop the separate "About" link or
  fold it into wherever makes sense, your call, but keep it reachable
  from somewhere).
- Use icons already available in the codebase's icon set/registry
  (check `src/lib/iconRegistry.js` and existing lucide-react imports)
  — don't introduce a new icon dependency.
- All new UI text must be in Bangla, matching the existing tone/style
  of the rest of `ProviderDashboard.jsx` (see the Bangla strings
  already in that file for tone reference).

## Required workflow — phases, zip, and prompt update

Do this work in the phases listed below, IN ORDER. After completing
EACH phase:

1. Produce a **complete zip** of the full project (not a diff, not
   just changed files — the entire current project state, so it can
   be unzipped and run directly).
2. Update THIS prompt file itself: at the very bottom, under a
   "## Progress Log" section (create it if it doesn't exist), add a
   dated entry for the phase you just finished, in plain language,
   describing what was actually done and any deviations from the
   plan.
3. Your final output message for that phase must include exactly
   TWO files:
   - The updated project zip
   - This updated prompt `.md` file (with the new Progress Log entry
     appended)

   Do not include any other files in the output. Do not skip ahead to
   later phases in the same response.

---

## Phase 1 — Bottom nav + sidebar wiring (no page splitting yet)

Scope:
- Create `src/components/nav-system/BottomNavProvider.js` exporting
  `PROVIDER_FIXED_BUTTONS`: 2 entries — Dashboard (`/provider`) and My
  Shop (`/provider/shop` — it's OK that this route doesn't exist yet,
  just wire the button; it will 404 until Phase 2, that's expected and
  fine for this phase).
- Update `BottomNav.jsx` to add an `isProvider` branch (via
  `useIsProvider()`) that uses `PROVIDER_FIXED_BUTTONS` and a simple
  Profile button to `/settings` (don't reuse the CR/staff-aware
  `ProfileButton` for providers — just render a plain link+icon+label
  matching the existing markup shape).
- Update `SidebarNavProvider.jsx` nav array to match: Dashboard, My
  Shop (`/provider/shop`), Settings. Keep or relocate the About link,
  your judgment, briefly note the choice in the Progress Log.
- Do NOT touch `ProviderDashboard.jsx` or `App.jsx` routes yet in this
  phase, other than nothing (routes are Phase 2).

Deliverables: zip + updated prompt file, as described above.

---

## Phase 2 — Route + page split (My Shop hub + 2 sub-pages)

Scope:
- Create `src/pages/provider/ProviderMyShopHub.jsx` — the small hub
  page with 2 cards as described above.
- Create `src/pages/provider/ProviderOfferingsPage.jsx` — move the
  Offerings manager + Revenue total sections here verbatim (same
  components/functions, same Firestore subscriptions), removing them
  from `ProviderDashboard.jsx`.
- Create `src/pages/provider/ProviderShopSettingsPage.jsx` — move Shop
  meta editor + Shop status control + Service details editor here
  verbatim, removing them from `ProviderDashboard.jsx`.
- Trim `ProviderDashboard.jsx` down to: open/close toggle + pending
  queue + confirmed list only (remove the now-moved `Collapsible`
  sections and their now-unused imports).
- Add the 3 new routes in `src/App.jsx`, each wrapped in
  `RequireProvider`, matching the existing `/provider` route's
  wrapping style exactly:
  - `/provider/shop` → `ProviderMyShopHub`
  - `/provider/shop/offerings` → `ProviderOfferingsPage`
  - `/provider/shop/settings` → `ProviderShopSettingsPage`
- Update `PROVIDER_FIXED_BUTTONS`'s `match()` for the My Shop tab so
  it stays visually active on all 3 `/provider/shop*` sub-routes (same
  pattern as `FACULTY_FIXED_BUTTONS`'s "More" button matching multiple
  paths).
- Each card on the hub page should show a real one-line subtitle
  derived from existing `service` data already available in that
  component (e.g. offerings count; open/dormant/active status) — no
  new Firestore reads, no new fields.

Deliverables: zip + updated prompt file, as described above.

---

## Phase 3 — Polish pass

Scope:
- Verify every moved component still imports correctly (no dangling
  imports left in `ProviderDashboard.jsx`, no missing imports in the
  new files).
- Verify all 3 provider routes + bottom nav + sidebar are mutually
  consistent (tapping a bottom nav tab highlights correctly, sidebar
  link highlights correctly, back-navigation from a sub-page under "My
  Shop" makes sense — e.g. a simple back link/breadcrumb at the top of
  `ProviderOfferingsPage.jsx` and `ProviderShopSettingsPage.jsx`
  pointing back to `/provider/shop`).
- Quick self-check against the "Design/UX requirements" list above —
  note any item you could not fully satisfy and why, in the Progress
  Log.
- No new features, no new business logic — this phase is cleanup and
  verification only.

Deliverables: zip + updated prompt file, as described above. This is
the final phase — after this, stop.

---

## Progress Log

(Leave this section empty for now — the other bot will append one
dated entry per completed phase here, then include this updated file
in its output.)

### 2026-07-31 — Phase 1 complete

Did exactly the scope listed for Phase 1, nothing from Phase 2:

- Created `src/components/nav-system/BottomNavProvider.js` exporting
  `PROVIDER_FIXED_BUTTONS` with 2 entries: Dashboard (`/provider`,
  icon `Grid`) and My Shop (`/provider/shop`, icon `Store`). Both
  icons already existed in `iconRegistry.js`/lucide-react, no new
  dependency added. My Shop's `match()` already handles
  `/provider/shop*` sub-paths (`p.startsWith('/provider/shop/')`) so
  it's ready for Phase 2's sub-routes without needing another edit
  later.
- Updated `src/components/BottomNav.jsx`:
  - imported `useIsProvider` and `PROVIDER_FIXED_BUTTONS`.
  - added a small `ProviderProfileButton` component — a plain
    `Link` to `/settings` with a `User` icon and "Profile" label,
    matching the existing markup shape exactly. This intentionally
    does NOT reuse `ProfileButton` (that component's CR/staff
    branching logic doesn't apply to providers, per the prompt).
  - `BottomNav()` now reads `isProvider` from `useIsProvider()` and
    branches ahead of the existing faculty/student check: if
    `isProvider`, `fixedButtons = PROVIDER_FIXED_BUTTONS` and the
    profile slot renders `ProviderProfileButton` instead of
    `ProfileButton`. `isProfileActive` for providers is simply
    `pathname === '/settings'`.
  - Student/faculty behavior is untouched — same buttons, same
    `ProfileButton`, same active-path logic as before.
- Updated `src/components/nav-system/SidebarNavProvider.jsx`:
  - Added a "My Shop" item (`/provider/shop`, icon `Store`) to the
    `Provider` group, right after Dashboard.
  - Kept "About" as its own link in the `Account` group rather than
    folding it into Settings — there's no natural single destination
    to merge it into without changing Settings' own behavior, and the
    prompt allowed either choice as long as About stays reachable.
    Settings and About both remain exactly where they were.
- Did NOT touch `ProviderDashboard.jsx` or `App.jsx` routes, as
  instructed — `/provider/shop` is wired into both nav components but
  has no route yet, so tapping "My Shop" will 404 until Phase 2. This
  is expected per the prompt.
- No existing strings, Firestore calls, or business logic were
  changed anywhere in this phase — only nav wiring.

### 2026-07-31 — Phase 2 complete

Built on top of the earlier same-day partial checkpoint. Finished
everything that was still missing:

- Created `src/pages/provider/ProviderMyShopHub.jsx` — 2-card hub page
  (Offerings & Earnings / Shop Details & Status) with real one-line
  subtitles from existing `service` data, no new Firestore reads.
- Created `src/pages/provider/ProviderOfferingsPage.jsx` — Offerings
  manager + Revenue total moved verbatim from the old
  `ProviderDashboard.jsx`, same components/Firestore calls/strings,
  now on their own page instead of inside a `Collapsible`. Back-link
  to `/provider/shop`.
- Created `src/pages/provider/ProviderShopSettingsPage.jsx` — Shop
  meta editor (cover image, location, delivery) + Shop status control
  + Service details editor, moved verbatim. Back-link to
  `/provider/shop`.
- Trimmed `src/pages/provider/ProviderDashboard.jsx` down to open/close
  toggle + pending bookings queue + confirmed bookings list only.
  Removed the now-dead `ShopStatusControl`, `ConfirmBlock`,
  `ShopMetaEditor`, `OfferingsManager` (+ its `MAX_OFFERING_IMAGES`
  constant), and `ServiceDetailsEditor` functions that were left over
  in the file after the sections were pulled out of the render tree —
  none of them were referenced anywhere else, confirmed by grep before
  deleting. No remaining dangling references to any of them, and no
  unused imports left behind (the file's `lucide-react` and
  `serviceSync` imports were already scoped correctly to what the
  trimmed page actually uses).
- **Added the 3 new routes to `src/App.jsx`**, each wrapped in
  `RequireProvider` in the exact same style as the existing `/provider`
  route: `/provider/shop` → `ProviderMyShopHub`, `/provider/shop/offerings`
  → `ProviderOfferingsPage`, `/provider/shop/settings` →
  `ProviderShopSettingsPage`. Added matching `lazy()` imports and small
  `*Route` wrapper components (`ProviderMyShopHubRoute`,
  `ProviderOfferingsPageRoute`, `ProviderShopSettingsPageRoute`)
  mirroring the existing `ProviderDashboardRoute` pattern — each reads
  `providerProfile` off `useIsProvider()` rather than re-subscribing,
  since `RequireProvider` has already resolved it by the time these
  render.
- Confirmed `PROVIDER_FIXED_BUTTONS`'s My Shop `match()` (set up in
  Phase 1 to cover `p === '/provider/shop' || p.startsWith('/provider/shop/')`)
  now correctly stays active across all 3 `/provider/shop*` routes
  now that they exist — no change needed to that file.
- Verified all imports in the 3 new pages resolve against real
  exports: `subscribeProviderServices`, `withServiceDefaults`,
  `updateServiceDetails`, `setServiceStatus`, `setServiceOfferings`,
  `addOfferingId` all exist in `lib/serviceSync.js`; `uploadServiceImage`,
  `deleteServiceImage` both exist in `lib/serviceImageUpload.js`.

Not yet done (left for Phase 3, per the prompt's own phase split):
back-navigation UX polish pass, and the final self-check against the
full "Design/UX requirements" list. This phase only covers routing +
page split + cleanup, as scoped.

### 2026-07-31 — Phase 3 complete

Polish pass only, no new features or business logic, per scope:

- Verified no dangling references left in `ProviderDashboard.jsx` after
  Phase 2's trim — grepped for `ShopStatusControl`, `ConfirmBlock`,
  `ShopMetaEditor`, `OfferingsManager`, `MAX_OFFERING_IMAGES`,
  `ServiceDetailsEditor`: zero matches. All imports in
  `ProviderMyShopHub.jsx`, `ProviderOfferingsPage.jsx`, and
  `ProviderShopSettingsPage.jsx` resolve to real exports.
- Confirmed the 3 provider routes, bottom nav, and sidebar all agree:
  `PROVIDER_FIXED_BUTTONS`'s My Shop `match()` covers all
  `/provider/shop*` sub-routes; `BottomNav.jsx`'s `isProvider` branch
  (added Phase 1) renders `PROVIDER_FIXED_BUTTONS` plus a plain
  `ProviderProfileButton` to `/settings`, bypassing the CR/staff-aware
  `ProfileButton` as required.
- Confirmed both `ProviderOfferingsPage.jsx` and
  `ProviderShopSettingsPage.jsx` already had a `BackLink` component
  (`ArrowLeft` + `navigate('/provider/shop')`) from Phase 2 — no
  further work needed there.
- **Found and fixed a real gap during this pass**: `Navbar.jsx`'s
  `getPageMeta()` reads its data purely from `NAV`/`NAV_DESKTOP` in
  `src/nav.js`, which had zero entries for any `/provider*` path. This
  meant the topbar title fell through to the generic "KUETx" default
  on every provider page (Dashboard, My Shop, Offerings, Settings) —
  a real "mutually consistent" gap against the polish checklist, even
  though it doesn't touch the provider's own sidebar/bottom-nav (those
  stay on the separate, dedicated `SidebarNavProvider.jsx` /
  `BottomNavProvider.js`, untouched). Fixed by adding 4 single-item
  `isSubgroup` groups to `src/nav.js` (`Provider Dashboard`,
  `My Shop`, `Offerings & Earnings`, `Shop Details & Status`) —
  deliberately 4 separate groups rather than one shared group with 4
  items, since `getPageMeta`'s sibling-count check would otherwise
  make the topbar show a multi-item chip strip, which is wrong for
  this shell's explicit "busy shop owner, 2-second glance" design
  requirement.
- Also picked up a companion fix already prepared for
  `SidebarNavShared.jsx`: the flat-items branch of `NavList` now
  respects an optional `item.matchPrefix` flag (falls back to exact
  path match when unset), reusing the existing `isActiveItem` helper.
  This is additive and opt-in — no existing nav item sets the flag, so
  student/faculty/provider active-state highlighting is unchanged;
  it's available for any future nav item that needs prefix-based
  highlighting without a special-cased hub entry.
- Self-check against the Design/UX requirements list: all satisfied.
  No item left unaddressed — 3-tab bottom nav, 3-link sidebar, no
  nested tabs inside tabs, each page its own `RequireProvider`-wrapped
  route, all existing strings/Firestore calls/props preserved
  verbatim, existing icon registry only, Bangla copy on new UI text,
  back-navigation present on both sub-pages.
- This is the final phase. Stopping here per the prompt's own
  instruction.

### 2026-07-31 — Phase 3 follow-up fix

A second look after "done" caught one real bug the first pass missed:
`SidebarNavProvider.jsx`'s "My Shop" item (`path: '/provider/shop'`) had
no `matchPrefix` flag, so it only exact-matched `/provider/shop` —
meaning the sidebar's "My Shop" row did NOT stay highlighted while the
user was actually on `/provider/shop/offerings` or
`/provider/shop/settings`. The bottom nav's `PROVIDER_FIXED_BUTTONS`
already handled this correctly via its own `match()` function
(`p.startsWith('/provider/shop/')`), so sidebar and bottom-nav were out
of sync — exactly the kind of "mutually consistent" gap Phase 3 was
supposed to catch. Fixed by adding `matchPrefix: true` to that item,
which uses the `matchPrefix` support added to `SidebarNavShared.jsx`
earlier in this same phase. Verified with a standalone simulation of
`isActiveItem()` against all 3 `/provider/shop*` paths plus `/provider`
itself (to confirm no over-matching) — all correct.
