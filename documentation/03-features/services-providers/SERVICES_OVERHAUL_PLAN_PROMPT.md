# KUETx Services Marketplace Overhaul — Plan Prompt

> **This file is a self-contained, reusable prompt.** Paste this whole
> file into any new AI coding session (Claude, or otherwise) working on
> the KUETx codebase. The session should read this file first, read
> `documentation/README.md` (the project's documentation rules — follow
> them for any doc edits made while executing this plan), then start
> from whichever phase below is marked `[ ] TODO` or `[~] IN PROGRESS`.
> Do not redo phases marked `[x] DONE`.

## Progress Badge

| Phase | Status |
|---|---|
| Phase 0 — Confirm scope & open questions | `[x] DONE` |
| Phase 1 — Central Orders/Bookings Hub (data layer) | `[x] DONE` |
| Phase 2 — Central Orders/Bookings Hub (UI: hub card + hub page) | `[x] DONE` |
| Phase 3 — Services Level-1 listing redesign (`/services`) | `[x] DONE` |
| Phase 4 — Shop/Service detail page UI polish | `[x] DONE` |
| Phase 5 — Remove "← Services" back-link from shop detail chip strip | `[x] DONE` |
| Phase 6 — Provider vs Student/Faculty flow audit | `[x] DONE` |
| Phase 7 — English-only UI text pass across services module | `[x] DONE` |
| Phase 8 — Final full-project build verification & handoff | `[x] DONE` |

**Resume instruction:** if this file is fed into a new session later,
check the badge table above. Skip every `[x] DONE` phase. Start at the
first `[ ] TODO` or `[~] IN PROGRESS` phase and continue in order —
phases build on each other (Phase 2 needs Phase 1's data layer, etc.),
so do not skip ahead out of order even if a later phase looks easier.

---

## Context / Goal

KUETx is a React + Vite + Firebase PWA for KUET students and faculty
(A3KM Studio project). It has a Services marketplace
(`src/pages/Services.jsx`, `src/pages/ServiceDetail.jsx`,
`src/lib/serviceSync.js`) where students/faculty book or inquire about
campus services (Salon, Food, Pharmacy, Stationery, Online Mart,
Delivery/Errand) from providers (shop owners).

The owner (Akhinoor, founder/lead builder/designer at A3KM Studio)
reviewed the current Services UI and flagged a full overhaul, in his own
words (paraphrased from a mixed Bangla/English chat):

1. **Services Level-1 listing (`/services`)** currently shows a
   category grid with "Coming soon" placeholders. He wants it to work
   like an e-commerce category/product listing page (reference: an
   AppleGadgets-style Earbuds category page — grid of real items, a
   **Sort By** and **Filter** bar at the top, no "you must first select
   a category" gate).
2. **Shop/Service detail page** should get a UI polish pass inspired by
   an e-commerce product-detail page (reference screenshots: image
   gallery with thumbnail strip, a small cart icon top-right, tabs like
   Specification/Description/Warranty, colour/quantity-style selectors
   where relevant) — **the existing booking/inquiry/errand business
   logic must NOT be broken or rewritten**, this is a visual/layout
   pass on top of it.
3. **Remove the "← Services" back-link** that currently shows in the
   chip strip at the top of the shop detail page — user does not want
   it there.
4. **Provider vs Student/Faculty flow** needs an explicit audit —
   confirm the customer-facing flow (used by both students and
   faculty) and the provider-facing flow are cleanly separated and both
   correct. (Scope to be nailed down in Phase 0 — this was flagged but
   not fully specified yet.)
5. **Central Orders/Bookings Hub — the most important, currently
   missing piece.** Confirmed by codebase inspection: every booking
   query in `serviceSync.js` is scoped to one `serviceId`
   (`subscribeMyBookingsForService(serviceId, uid)`,
   `subscribeMyErrandRequestsForService(serviceId, uid)`, etc.) — there
   is **no cross-service query** that lets a student/faculty user see
   all their bookings/orders across every shop in one place. The owner
   wants:
   - On the `/services` listing page, the **first row, spanning both
     grid columns**, is a special card — visually distinct (different
     colour/style) from ordinary shop/item cards — with a divider line
     below it separating it from the regular listing.
   - Tapping this card opens a **central hub page** showing every
     order/booking/inquiry/errand the user has across all shops,
     neatly organised by status, with cancel/status-change actions
     available right there (not just inside each individual shop's
     page).
   - This is conceptually like a shopping cart / order-history hub.
     **Needs a name** — pick one during Phase 1/2 and use it
     consistently in code (component names, route, file names) and in
     the UI copy. Candidate names to consider: "My Orders", "My
     Bookings", "Orders Hub", "Activity Hub" — pick whichever reads
     best in the simple-English UI copy (see point 6).
6. **All UI copy in this module (both student/customer and faculty
   side) should be simple, easy English** — not Bangla. Existing
   internal code comments can stay whatever language they are; this is
   about user-facing strings only.

**Why this file exists (meta):** this is a large, multi-session piece
of work. Per `documentation/README.md` §4 (added specifically for this
kind of task), it is broken into ordered phases below, each independently
completable, each phase producing two deliverables when done: a full
updated project zip, and this same plan-prompt file with its progress
badge updated.

---

## Ground rules for every phase

- Read `documentation/README.md` before touching any `.md` file. Update
  `documentation/03-features/services-providers/CURRENT.md` (not a new
  file) with a summary of what each phase did, per that file's own
  established format (see its "নতুন কাজ যোগ করার নিয়ম" section at the
  bottom).
- Do not break existing booking/inquiry/errand logic in
  `serviceSync.js` or `ServiceDetail.jsx` unless a phase explicitly
  calls for a data-layer change (Phase 1 does; UI-only phases must not
  touch `serviceSync.js`'s existing exported function signatures).
- Run `npm install && npm run build` (with `--break-system-packages`
  for any pip use, not relevant here but noted for consistency) after
  every phase and confirm a clean build before considering the phase
  done.
- Keep changes role-aware: `useIsProvider()` gates provider accounts,
  `useIsFaculty()` gates faculty accounts, everyone else is a student.
  The Services module today is reachable by both students and faculty
  (see `nav.js` and `nav-faculty.js`'s Services subgroups) — any new
  page/route added in this plan (e.g. the hub) must be reachable from
  both nav configs, not just one.
- All new user-facing strings: simple English (per point 6 above).
- Prefer editing existing files over creating new ones unless a phase
  clearly needs a new component/page file (e.g. the hub page itself).

---

## Phase 0 — Confirm scope & open questions

**Status:** `[x] DONE`

Owner said "start it" without answering the open questions individually
— proceeding on best-judgement defaults, recorded here so later phases
don't re-ask:

- [x] **Level-1 listing (Phase 3):** flatten all shops/items into one
  feed by default, with category available as a Filter option (not a
  mandatory landing grid). Confirm with owner during/after Phase 3 if
  the result doesn't match intent — easy to flip to "categories as
  filter chips at top" instead if so.
- [x] **Detail page polish (Phase 4):** image gallery + thumbnail strip
  applies broadly (most services likely have at most one cover image
  today — gallery UI should degrade gracefully to a single image
  without looking broken). Colour/quantity-style selectors: skip for
  now, most KUETx services are appointment/inquiry-based, not
  colour-variant physical products — Phase 4 should confirm this
  against real service data before deciding whether any selector-style
  UI is worth adding.
- [x] **Hub name/route (Phase 1/2):** name chosen — **"My Orders"**.
  Reasoning: reads naturally in simple English for both a booking
  ("my order for a haircut") and an errand request; shorter than
  "Activity Hub", clearer to a non-technical student than "Orders Hub".
  Route: **`/services/orders`** (nested under services, consistent with
  the existing `/services/:serviceId` and `/services/category/:type`
  nesting pattern already in `App.jsx`). Component file:
  `src/pages/ServiceOrdersHub.jsx`, exported function name
  `ServiceOrdersHub`.
- [x] **Provider vs student/faculty audit (Phase 6):** no specific
  issues were reported by the owner beyond the general request to
  audit — Phase 6 should do a clean-slate walkthrough rather than
  chase a known bug.

**Done when:** open questions above are answered and noted in this
file, OR the owner explicitly says "use your best judgement, proceed."
— the latter happened; decisions recorded above.

---

## Phase 1 — Central Orders/Bookings Hub (data layer)

**Status:** `[x] DONE`

Added `subscribeAllMyBookings(uid, callback)` in `src/lib/serviceSync.js`:

- [x] Confirmed booking/inquiry/errand all live in the SAME
  `services/{serviceId}/bookings` subcollection (not separate
  collections) — one collectionGroup query design covers all three.
- [x] Two `collectionGroup(db, 'bookings')` listeners (one on
  `studentUid == uid`, one on `requesterUid == uid`, since Firestore
  can't OR two different field names in one query), merged client-side
  — same two-listener-merge pattern already used by
  `subscribeOpenErrandRequestsForRunner`.
- [x] Each record enriched with `serviceName`/`serviceType`
  (`service.type`, e.g. 'salon')/`providerUid` from a one-shot
  `getDocs(servicesCollectionRef())`, refreshed on every listener
  emission — no per-item extra fetch needed at render time.
- [x] Sorted newest-first by `requestedAt` across all shops combined.
- [x] Reuses existing `cancelBooking`/`cancelErrandRequest`/
  `closeInquiry` — Phase 1 added no new mutation functions, only the
  new read/subscribe function. Phase 2's hub UI should call those
  exact existing functions for its cancel/status-change actions.
- [x] `firestore.indexes.json`: added `fieldOverrides` entries for
  `bookings.studentUid` and `bookings.requesterUid` at
  `COLLECTION_GROUP` scope (same pattern as the existing
  `joinRequests.status` override) — required before
  `subscribeAllMyBookings` will work against production Firestore.
  **Not yet deployed** — running `firebase deploy --only
  firestore:indexes` is an infra step outside this codebase change,
  flagged in `CURRENT.md`'s deployment note for whoever runs deploys.
- [x] No `firestore.rules` change needed — the existing
  `bookings/{bookingId}` read rule already checks `studentUid`/
  `requesterUid` per-document, which applies identically whether the
  query arrives via direct collection or collectionGroup path.

**For Phase 2:** call `subscribeAllMyBookings(uid, callback)` from the
new hub page. Each record in the callback array has: `{ id, serviceId,
serviceName, serviceType, providerUid, ...<original booking/inquiry/
errand fields> }`. Use the record's `status` field (or presence of
`requesterUid` vs `studentUid`) to tell booking/inquiry/errand records
apart when rendering — no separate "kind" field was added, the shape
itself already disambiguates (booking has `offeringId`+`confirmedSlot`,
inquiry has `items[]`+`replyText`, errand has `requesterUid`+
`itemDescription`).

**Done when:** a new subscribe function exists, returns live
cross-service data for a test account, and `npm run build` passes. —
build confirmed clean; live-account verification deferred to Phase 2
since there's no UI to observe it through yet.

---

## Phase 2 — Central Orders/Bookings Hub (UI: hub card + hub page)

**Status:** `[x] DONE`

- [x] Added the hub-entry card at the top of `src/pages/Services.jsx`'s
  Level-1 listing — rendered OUTSIDE `.kx-category-grid` (not one of
  the SERVICE_TYPES cards), spans full width, accent-gradient
  background + accent border to read as visually distinct from
  ordinary category cards, with a `.kx-orders-hub-divider` line
  beneath it before the regular grid starts.
- [x] Built `src/pages/ServiceOrdersHub.jsx`, route `/services/orders`,
  registered in `App.jsx` as a literal-segment route (placed before
  `/services/:serviceId` for readability — React Router resolves by
  specificity regardless of order, so this was a readability choice,
  not a functional requirement):
  - Uses Phase 1's `subscribeAllMyBookings(uid, callback)`, groups
    results into three buckets by status: Active, Completed,
    Cancelled/Closed (skeleton loading state while `records === null`,
    empty-state card if a user has never booked anything).
  - Record kind (booking/inquiry/errand) detected client-side from
    field shape (`recordKind()` helper) — no new "kind" field was
    added to the data itself, matching Phase 1's note that the shape
    already disambiguates.
  - Each card shows kind badge, shop name, booked-item/description,
    and a plain-English status line; tapping a card (outside the
    Cancel button) navigates to that shop's own `/services/:serviceId`
    page for full detail.
  - Cancel button appears only on Active-bucket cards, reuses
    `cancelBooking(serviceId, id, 'student')` /
    `cancelErrandRequest(serviceId, id)` / `closeInquiry(serviceId,
    id)` depending on record kind — exactly Phase 1's reused
    functions, no new mutation code.
- [x] No nav.js/nav-faculty.js entry added — per Phase 0's decision,
  the hub card is the primary (and for now, only) entry point. Easy to
  add a sidebar entry later if wanted; not done here to avoid guessing
  at unwanted scope.
- [x] Written entirely in English (new file — no reason to write it in
  Bangla first and re-sweep it in Phase 7; Phase 7 targets EXISTING
  Bangla strings in files that predate this plan, like
  `ServiceDetail.jsx`'s STATUS_LABEL maps).

**Done when:** the hub card renders in the correct spot on `/services`,
clicking it opens a working hub page showing real cross-shop data for
a test account, cancel actions work, and `npm run build` passes. — build
confirmed clean, `ServiceOrdersHub` verified to produce its own lazy
chunk; live-account click-through verification still recommended by a
human tester with a real logged-in account before shipping, since this
sandbox has no way to sign in against production Firebase.

---

## Phase 3 — Services Level-1 listing redesign (`/services`)

**Status:** `[x] DONE`

- [x] Replaced the category-grid-with-"Coming soon" layout in
  `Services.jsx`'s default export with a flat listing: every active
  (non-dormant) shop across every category renders immediately on
  load, no category-first navigation gate. Dormant shops moved into
  their own "Currently inactive" section below the main feed (same
  treatment Level 2 already had, ported to Level 1).
- [x] Added a **Sort By** control (Open now first [default],
  Name A–Z, Newest) and a **Filter** control (All categories
  [default], or one specific category) as pill buttons above the
  grid, each opening a shared `OptionSheet` bottom-sheet component
  (new, local to this file — no existing generic picker in the
  codebase to reuse).
- [x] Phase 2's "My Orders" hub card is untouched: still the fixed
  first row, still outside the sort/filter pipeline (not part of
  `sortedShops`), still has its divider and distinct accent styling.
- [x] Data source untouched — still `subscribeAllServices`,
  `SERVICE_TYPE_LABELS`, `CATEGORY_ICONS`, `withServiceDefaults`; no
  `serviceSync.js` exported function signature was touched. Sort/
  filter state is plain client-side `useState`, no new Firestore
  query added.
- [x] Level 2 (`CategoryShopList`, `/services/category/:categoryType`)
  left in place and still routable, just no longer the only way to
  browse one category now that Level 1's Filter covers the same job
  inline.
- [x] `pendingCounts` (per-service live pending-booking count, used by
  `ShopCard`'s queue badge) now computed once for the whole flat list
  via the existing `usePendingCounts` hook, same hook Level 2 already
  used — no new subscription pattern introduced.

**Done when:** `/services` shows real items/shops on load with working
sort and filter controls, the hub card still appears correctly above
the divider, and `npm run build` passes. — build confirmed clean;
live-account click-through (sort/filter behavior, hub-card position)
still recommended by a human tester with a real logged-in account,
same caveat as Phases 1–2, since this sandbox can't sign in against
production Firebase.

---

## Phase 4 — Shop/Service detail page UI polish

**Status:** `[x] DONE`

- [x] Applied a visual refresh to `ServiceDetail.jsx`: cover image
  replaced with a `GalleryMedia` component (big active image +
  thumbnail strip, sourced from the service's cover image plus each
  available offering's first image, deduped). A small top-right icon
  button (Package icon) was added, linking to `/services/orders` — the
  closest sane stand-in for an e-commerce cart icon on a marketplace
  that has no shopping-cart concept.
- [x] Did NOT touch `BookingForm` / `InquiryForm` / `ErrandForm` /
  `MyActiveBooking` / `MyActiveInquiry` / `MyActiveErrand` state or any
  `createBooking`/`cancelBooking`/`createErrandRequest`/etc. mutation
  calls — this phase wraps them in better visuals only.
- [x] Verified the previously-fixed grid bug (`kx-offering-grid` /
  `kx-pick-grid` using `auto-fill` with `minmax(min,max)`, not
  `auto-fit`/`1fr`) is unchanged and not regressed.
- [x] Colour/quantity-style selectors confirmed still not applicable
  per Phase 0's decision — KUETx services remain appointment/inquiry-
  based, not colour-variant physical products, so skipped again here.

**Done when:** shop detail page has an updated look, all existing
booking/inquiry/errand flows still work end-to-end for a test account,
and `npm run build` passes. — build confirmed clean; gallery's 0/1/
many-image degrade paths verified at the code level; live end-to-end
click-through for a real test account still recommended by a human
tester, same sandbox-can't-sign-in-to-production-Firebase caveat as
every prior phase.

---

## Phase 5 — Remove "← Services" back-link from shop detail chip strip

**Status:** `[x] DONE`

- [x] Investigation found the "← Services" back-link the owner meant
  actually lived in `ServiceDetail.jsx`'s own header row
  (`.kx-detail-topbar`, added originally alongside this file, not in
  `Navbar.jsx`) — there is no "← Services" text or back-arrow button
  anywhere in `Navbar.jsx`. Removed it from there; `Navbar.jsx`'s real
  chip strip (the category pill row, including the Services
  pool special-case in `getPageMeta`) was left completely untouched.
- [x] Phase 4's "My Orders" shortcut icon button stayed in place — only
  the back-link button was removed; the topbar row now right-aligns
  (`justify-content: flex-end`) instead of space-between.
- [x] Confirmed Level-1 (`/services`) and Level-2
  (`/services/category/:categoryType`) never had a back-link of their
  own to begin with — only the shop-detail page had one, and that's
  exactly what was removed, per the owner's specific request.
- [x] Removed the now-unused `ArrowLeft` icon import.

**Done when:** shop detail page's top bar no longer shows a "←
Services" back-link, everything else in the chip strip still works,
`npm run build` passes. — build confirmed clean; `Navbar.jsx`'s actual
chip strip is unmodified (zero lines touched in that file this phase),
so its category pills and the earlier faculty-nav fix are unaffected
by construction, not just by testing.

---

## Phase 6 — Provider vs Student/Faculty flow audit

**Status:** `[x] DONE`

Clean-slate walkthrough, no known bug to chase (per Phase 0). Findings:

- [x] All `/provider/*` routes (`/provider`, `/provider/shop`,
  `/provider/shop/offerings`, `/provider/shop/offerings/:id`,
  `/provider/shop/settings`, `/provider/profile`,
  `/provider/notifications`) confirmed wrapped in `RequireProvider` in
  `App.jsx`, which correctly gates on not-a-provider (blocked) →
  pending/rejected/deactivated (`ProviderVerificationPending`) →
  verified (dashboard renders).
- [x] `/services*` confirmed to intentionally have no role guard
  (documented inline in `App.jsx` already) — a provider can legitimately
  browse the student-facing shop pages too; not a gap.
- [x] `subscribeAllMyBookings` (Phase 1) verified to always scope to
  `studentUid == uid` / `requesterUid == uid` — never returns a
  provider's shop-wide booking list, for any account type. Also
  double-enforced server-side by `firestore.rules`' `bookings`
  subcollection read rule (students can never read each other's
  bookings; providers only read their own service's bookings).
- [x] Confirmed no provider page imports or reuses
  `ServiceOrdersHub.jsx` or `subscribeAllMyBookings` — student hub and
  provider dashboard are fully separate code paths.
- [x] Confirmed nav-level isolation: `nav.js`'s 4 provider-stub groups
  exist only so `getPageMeta` can resolve a topbar title on
  `/provider/*` pages — they do not render as the provider's actual
  sidebar/bottom-nav (that comes from `SidebarNavProvider.jsx`'s
  separate `isProvider`-gated source). No cross-leakage of nav items
  between account types.
- [x] Re-checked every file touched in Phases 1–5
  (`Services.jsx`, `ServiceDetail.jsx`, `ServiceOrdersHub.jsx`,
  `Navbar.jsx`'s topbar) for provider-only actions leaking into
  student-facing UI — none found. Note: `ServiceDetail.jsx`'s "Change
  price" button on an errand is the *student's own* counter-offer
  edit, not a provider action — flagged explicitly here since it could
  look like a provider-only control at a glance.

**No issues found; no code changes were needed this phase.**

**Done when:** both flows are confirmed clean (or fixed), and
`npm run build` passes. — build confirmed clean (no code changed this
phase, audit-only).

---

## Phase 7 — English-only UI text pass across services module

**Status:** `[x] DONE`

- [x] `ServiceDetail.jsx`: translated `STATUS_LABEL` /
  `INQUIRY_STATUS_LABEL` / `ERRAND_STATUS_LABEL` maps, the not-found
  message, open/closed status text, location/delivery badges, the
  dormant banner, and every label/placeholder/error message/button
  text in `BookingForm`, `InquiryForm`, `ErrandForm`,
  `MyActiveBooking`, `MyActiveInquiry`, and `MyActiveErrand` — string
  literals only, no state/mutation logic touched.
- [x] `Services.jsx`: translated Level-2 (`CategoryShopList`)'s
  empty-state and "Currently inactive" heading, plus `ShopCard`'s
  open/closed/dormant/action labels.
- [x] `ServiceOrdersHub.jsx`: already fully English from Phase 1–2, no
  changes needed.
- [x] Left code comments as-is — a couple of Bangla words remain in
  developer-facing comments only (e.g. `Services.jsx`'s own doc
  comments), per the plan's explicit "UI copy only" scope.
- [x] Left the ৳ currency symbol untouched everywhere — it's a
  currency symbol, not language text, so out of scope for "no Bangla
  string."
- [x] Confirmed scope stayed limited to the services module — no
  non-services pages touched, KUETx's general Bangla-first convention
  elsewhere is unaffected.

**Verification:** scanned `Services.jsx`, `ServiceDetail.jsx`, and
`ServiceOrdersHub.jsx` with a Python Unicode Bangla-script-range sweep
(`\u0980`–`\u09FF`) — every remaining hit is a dev comment or the ৳
symbol; no user-facing Bangla string remains.

**Done when:** no Bangla user-facing string remains in the touched
services-module files, `npm run build` passes. — both confirmed.

---

## Phase 8 — Final full-project build verification & handoff

**Status:** `[x] DONE`

- [x] Full clean `rm -rf node_modules dist && npm install && npm run
  build` run from scratch — passed cleanly, no errors, no warnings
  beyond routine package-level deprecation notices (not code issues).
- [x] `documentation/03-features/services-providers/CURRENT.md`
  updated with a final summary of the whole overhaul (all 8 phases),
  per the file's own "নতুন কাজ যোগ করার নিয়ম" convention.
- [x] Final full project zip produced (excluding `node_modules`/
  `dist`) alongside this plan-prompt file, badge table above showing
  every phase `[x] DONE`.

**Summary of the whole overhaul, phase by phase:**

1. **Phase 0** — scope confirmed; best-judgement defaults recorded for
   every open question (Level-1 flatten-with-filter, gallery graceful
   degrade, hub name "My Orders" @ `/services/orders`, Phase 6
   clean-slate audit approach).
2. **Phase 1** — `subscribeAllMyBookings(uid, callback)` added to
   `serviceSync.js`; booking/inquiry/errand all share one
   `services/{id}/bookings` subcollection, so a single collectionGroup
   query covers all three.
3. **Phase 2** — new `ServiceOrdersHub.jsx` page (`/services/orders`)
   for a student's cross-shop bookings/inquiries/errands, plus a "My
   Orders" hub card added to `Services.jsx` Level-1 (fixed first row,
   divider beneath).
4. **Phase 3** — `/services` Level-1 listing rebuilt from a
   category-first landing grid into a flat, e-commerce-style feed with
   Sort By + Filter controls.
5. **Phase 4** — `ServiceDetail.jsx` visual polish: image gallery +
   thumbnail strip, "My Orders" shortcut icon; booking/inquiry/errand
   state machine untouched.
6. **Phase 5** — removed the shop-detail page's "← Services" back-link
   (found to live in `ServiceDetail.jsx`'s own header, not
   `Navbar.jsx`); `Navbar.jsx`'s actual chip strip left untouched.
7. **Phase 6** — provider vs student/faculty flow audit; clean-slate
   walkthrough found no role-gating issues, no fixes needed.
8. **Phase 7** — every user-facing Bangla string in the services
   module (`ServiceDetail.jsx`, `Services.jsx`) translated to English;
   rest of the app's Bangla-first convention untouched.

**Files touched across the whole plan:**
- `src/lib/serviceSync.js` (Phase 1 — one new export added, everything
  else unchanged)
- `src/pages/ServiceOrdersHub.jsx` (new, Phase 2)
- `src/pages/Services.jsx` (Phases 2, 3, 7)
- `src/pages/ServiceDetail.jsx` (Phases 2, 4, 5, 7)
- `src/App.jsx` (Phase 2 — new routes added)

**Deliberately not touched:**
- `firestore.rules` — no new read/write pattern was needed
- `src/pages/provider/*` — Phase 6 only audited, changed nothing
- `src/components/Navbar.jsx` — Phase 5 investigation found the real
  target was never here to begin with

**Done when:** both final deliverables are produced and the badge table
at the top of this file shows all phases `[x] DONE`. — both done; see
badge table above and the two files delivered alongside this plan.
