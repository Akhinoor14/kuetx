# KUETx — Founder Panel: Service Providers Management — Full Upgrade

## Context (read this fully before touching anything)

KUETx is a React/Vite + Firebase (Firestore, Auth) web app for KUET
students/faculty. The Founder dashboard (`src/pages/AdminDashboard.jsx`)
has a top-level category system driven entirely by
`src/lib/founderCategories.js` — a single registry array that generates
the chip row, the grid cards, and each category's SubcategoryTabs. Adding
a subcategory is a registry change, not a new component, unless it needs
genuinely new UI (which this task does, in `directory`).

A category called **"Service Providers"** (`key: 'providers'`) was just
added, with two sub-tabs:
- `verify` — the pending-verification queue (moved wholesale from an old
  buried location inside Approvals). Fully working: approve/reject with
  reason, phone number fetched and shown per request.
- `directory` — brand new "All Providers" list. Currently a **bare-bones
  MVP**: shows every provider account with a status badge, lets Founder
  Deactivate a verified provider or Reactivate a deactivated one. That's
  it. No search, no filter, no phone number, no delete, no sorting, no
  slow-load handling.

**Your job: take `directory` (and, where noted, `verify`) from MVP to
production-grade, complete, polished.** This prompt lists every gap found
in an audit of the current code, in priority order. Implement all of them
unless you find a concrete reason not to (state the reason if so).

---

## Files you'll touch

- `src/pages/AdminDashboard.jsx` — contains `ProviderManagementView`
  (the component for this whole category) and `ApprovalRow` (a small
  shared row component it currently reuses for the `verify` tab).
- `src/lib/providerSync.js` — has `subscribeProviderVerifyRequests`,
  `adminVerifyProvider`, `adminRejectProvider`, `adminDeactivateProvider`,
  `adminReactivateProvider`, `listAllProviderAccounts`, `getProviderPhone`,
  `isProviderVerified`, `isProviderPending`, `isProviderRejected`. You may
  need to add a new export here (e.g. a delete function) — check this
  file's existing exports and JSDoc comments for the established patterns
  (function-level dynamic imports to avoid circular deps, Firestore rules
  constraints documented inline) before adding anything.
- `src/lib/founderCategories.js` — the `providers` entry lives here if a
  badge count or subtitle needs to change.
- `firestore.rules` — check the `match /providers/{uid}` block (currently
  around line 649) before adding any new admin action that writes to this
  doc or deletes it. The existing `allow delete: if isAdmin();` already
  permits Founder-initiated deletes — confirm this covers whatever delete
  UX you build.

**Before writing any code:** open all of the above files and read them in
full. Do not assume the snippets pasted below are the complete picture —
they're excerpts to anchor you, the actual files have more context
(comments explaining *why* things are shaped the way they are — respect
that reasoning, don't strip it out or contradict it).

---

## Current `ProviderManagementView` (as of this prompt — verify it's
## still accurate before starting, the codebase may have moved on)

```jsx
function ProviderManagementView({ onBack, onSelectCategory, countCtx }) {
  const [subTab, setSubTab] = useUrlTabState('providersTab', 'verify');
  const [err, setErr] = useState('');

  // --- Verification Requests (moved from ApprovalsView, unchanged logic) ---
  const [providerVerifyRequests, setProviderVerifyRequests] = useState(null);
  const [providerPhonesByUid, setProviderPhonesByUid] = useState({});

  useEffect(() => withTimeout((cb) => subscribeProviderVerifyRequests(cb), setProviderVerifyRequests), []);
  useEffect(() => {
    if (!providerVerifyRequests || providerVerifyRequests.length === 0) return;
    let cancelled = false;
    Promise.all(
      providerVerifyRequests.map((r) => getProviderPhone(r.uid).then((p) => [r.uid, p]).catch(() => [r.uid, ''])),
    ).then((pairs) => {
      if (cancelled) return;
      setProviderPhonesByUid(Object.fromEntries(pairs));
    });
    return () => { cancelled = true; };
  }, [providerVerifyRequests]);
  const providerVerifyLoading = providerVerifyRequests === null;

  // --- All Providers directory (new) ---
  const [allProviders, setAllProviders] = useState(null);
  const [actioning, setActioning] = useState({});

  const reloadDirectory = () => listAllProviderAccounts().then(setAllProviders).catch(() => setAllProviders([]));
  useEffect(() => {
    if (subTab !== 'directory' || allProviders !== null) return;
    reloadDirectory();
  }, [subTab]);

  const handle = async (fn, ...args) => {
    setErr('');
    try { await fn(...args); } catch (e) { setErr(e?.message || 'Action failed — try again.'); }
  };

  const handleDeactivate = async (p) => { /* confirmDialog + adminDeactivateProvider + reload */ };
  const handleReactivate = async (p) => { /* adminReactivateProvider + reload */ };

  // ...renders SubcategoryTabs, verify tab (reuses ApprovalRow), directory
  // tab (flat .map() over allProviders, status badge, Deactivate/
  // Reactivate buttons only — no search bar, no filter chips, no phone,
  // no delete, no sort control anywhere in this component).
}
```

`listAllProviderAccounts()` in `providerSync.js` is a plain one-shot
`getDocs()` — not a live subscription. That's intentional (Founder
doesn't need real-time here), keep it that way; just make sure your new
UI re-fetches (`setAllProviders(null)` then let the effect refire, or
call `reloadDirectory()` directly) after every mutating action so the
list reflects the change immediately, same pattern already used for
Deactivate/Reactivate.

---

## Required upgrades — implement all of these

### 1. Search box (directory tab) — HIGH PRIORITY
A text input above the provider list. Filters client-side (no new
Firestore query needed — `allProviders` is already fully loaded) by
`displayName` and phone number (case-insensitive substring match). Phone
numbers aren't on `allProviders` yet — see item 3, this depends on it.
Empty state when search yields zero results should say something like
"No providers match '{query}'" (distinct from the "no providers at all"
empty state).

### 2. Status filter chips (directory tab) — HIGH PRIORITY
A row of small filter chips/pills: **All / Pending / Verified / Rejected
/ Deactivated**, each showing a count (e.g. "Verified (12)"). Clicking one
filters the list to just that status; "All" (default) shows everyone.
Combine with search (item 1) — both filters apply together (AND, not
OR). Follow the visual style already used for status badges in the
current directory row (see `statusColors` map in the existing code) so
the filter chips visually match the badges.

### 3. Phone number in directory tab — HIGH PRIORITY
Right now only the `verify` tab fetches and shows phone (via
`getProviderPhone(uid)`, since phone lives on a `providers/{uid}/contact/phone`
sub-document per Firestore rules, not on the main doc — see the existing
comment in the code about this split). The `directory` tab needs the same
treatment: once `allProviders` loads, fetch phone for every provider
(not just pending ones) and display it in each row. Consider whether
fetching phone for potentially hundreds of providers on every directory
load is the right call — if this feels heavy, lazy-load phone only for
providers the Founder actually expands/clicks into, or paginate first
(see item 8) and only fetch phone for the visible page. Use your
judgment and note which approach you took and why.

### 4. Delete (permanent remove) — HIGH PRIORITY
Add a **Delete** action for deactivated (and probably pending/rejected —
your call, argue for whichever scope you pick) provider accounts — for
spam signups or accounts that should be permanently gone, not just
deactivated. `firestore.rules`' `providers/{uid}` already has
`allow delete: if isAdmin();`, so the rules already support this — check
whether deleting the parent doc needs to also clean up the
`providers/{uid}/contact/phone` sub-document and any `services/{id}` docs
tied to this provider (check `serviceSync.js` for how
`forceCloseProviderServices` handles the services relationship, and
decide if delete needs a similar cascade, or if force-close + doc-delete
is enough since services should already be closed if the provider was
deactivated first). Add this as a new `adminDeleteProvider(uid)` export
in `providerSync.js`, following the same JSDoc-comment-explaining-why
style as the existing admin functions. Require a confirmation dialog
before calling it (this is destructive and irreversible) — use the same
`confirmDialog` helper already imported and used elsewhere in
`AdminDashboard.jsx` for Deactivate.

### 5. Sort control (directory tab) — MEDIUM PRIORITY
A simple sort dropdown/toggle: by name (A-Z), by most-recently-verified
first, by status. Default to whatever feels most useful for a Founder
scanning the list day-to-day — argue for your choice.

### 6. Slow-load / error handling parity — MEDIUM PRIORITY
`ApprovalsView` elsewhere in this same file has a `flagSlowLoad` pattern
(a `loadWarning` state shown if a Firestore listener/read takes too long,
via `withTimeout`'s `onTimeout` option) that `ProviderManagementView`
currently lacks entirely for both its `verify` subscription and its
`directory` one-shot fetch. Bring this component in line with that
pattern so a stuck/slow load (e.g. a missing Firestore index right after
deploy) is visible to the Founder instead of an indefinite spinner.

### 7. Bulk approve (verify tab) — LOWER PRIORITY, only if time allows
Currently verify/reject is strictly one-at-a-time via individual buttons
per row (`ApprovalRow`). If there's ever a backlog (e.g. after a launch
event with many signups), a "select all" + bulk-approve action would
help. This is explicitly lower priority — the existing code has a
comment noting bulk UI was deliberately deferred; only build this if the
higher-priority items above are done and there's room.

### 8. Pagination (directory tab) — LOWER PRIORITY, only if time allows
`listAllProviderAccounts()` currently fetches every provider in one
`getDocs()` call with no limit. Fine at current scale; will not stay fine
forever. If you have time after the above, consider adding pagination
(cursor-based, using Firestore's `startAfter`) — but only if it doesn't
compromise the simplicity of the search/filter/sort work above, since
client-side filtering across a paginated dataset is trickier (you'd
either need to fetch-all-then-filter, defeating the point of pagination,
or move filtering server-side). Flag this tradeoff explicitly rather than
silently picking one; ask if unsure which the Founder would prefer at
current provider volume (a few dozen accounts) vs. future scale.

---

## Non-negotiable constraints (from the project's existing conventions)

- **Match the existing visual style exactly** — inline styles using CSS
  vars like `var(--text)`, `var(--muted)`, `var(--accent)`,
  `var(--border)`, `var(--card)`, `var(--surface)`, `var(--danger)`
  (see the current `statusColors` map and row-rendering code for the
  established palette/spacing/border-radius conventions in this exact
  component). Do not introduce a new styling approach (no CSS modules, no
  Tailwind, no styled-components) — this file is 100% inline `style={{}}`
  objects, stay consistent.
- **Reuse existing helper components** where they fit: `EmptyState`,
  `Section`, `CategoryShell`, `SubcategoryTabs` are all already imported/
  defined in `AdminDashboard.jsx` and used by every other Founder view —
  don't reinvent them.
- **Loading state discipline**: every other view in this file uses
  `useState(null)` (not `[]`/`{}`) as the "not yet loaded" sentinel,
  specifically so a genuinely-empty result doesn't flash the same as
  "still loading" on first render. Keep this pattern for any new state
  you add.
- **In-flight action discipline**: buttons that trigger a Firestore write
  (Deactivate/Reactivate/Delete/bulk-approve) must disable themselves and
  show some in-flight indication while the write is pending, using a
  `{uid: true}` map pattern (see `actioning` state already in the code,
  and `FacultyView`'s `verifying`/`deleting` maps elsewhere in the same
  file for the established pattern) — never let a double-click fire the
  same mutating call twice.
- **No `localStorage`/`sessionStorage`** anywhere (this is a Vite app
  running in a browser tab, not a sandboxed artifact, so this specific
  restriction may not technically apply — but check `package.json`/
  existing state-persistence patterns in the codebase, e.g.
  `useUrlTabState`, before reaching for browser storage regardless; URL
  state or React state should cover search/filter/sort UI state instead,
  so a page refresh doesn't silently lose the Founder's place. Use
  `useUrlTabState` — already imported and used for `subTab` in this exact
  component — for anything that should survive a refresh, like the active
  status filter).
- **Bengali strings**: this codebase mixes English UI copy with Bengali
  strings in a few founder-facing spots (e.g. `sublabel={p.location ?
  \`ঠিকানা: ${p.location}\` : 'ঠিকানা দেওয়া হয়নি'}` in the existing verify
  tab). Match whatever pattern is already established per-field — don't
  translate everything to Bengali or revert existing Bengali strings to
  English; preserve what's there and follow its lead for anything new
  that's clearly analogous (e.g. if you add a location display in the
  directory tab, mirror the same Bengali label used in `verify`).

---

## Verification checklist before you consider this done

- [ ] Read every file listed above in full before writing code — do not
      work from this prompt's excerpts alone, they may be stale.
- [ ] Every new Firestore-writing function has a matching `firestore.rules`
      check — read the rule, don't assume; if a new rule is genuinely
      needed, write it and explain why the existing rule didn't cover it.
- [ ] Every new async action (Delete, bulk-approve, etc.) has: a
      confirmation dialog if destructive, an in-flight/disabled button
      state, an error message shown to the Founder on failure (via the
      existing `err`/`setErr` pattern already in this component), and a
      directory reload/refresh after success.
- [ ] Search + filter + sort all compose correctly together (test: filter
      to "Verified", then search a name, then sort by date — all three
      should apply simultaneously, not override each other).
- [ ] Syntax-check every modified file (e.g. via `esbuild <file> --bundle=false
      --outfile=/tmp/out.js` or equivalent) before considering it done.
- [ ] Confirm you haven't broken the `verify` tab while working on
      `directory` — they share `ProviderManagementView`'s scope but should
      stay functionally independent.
- [ ] If you package a zip of the project, verify the changes are actually
      inside it by re-extracting the *output* zip (not just checking your
      live working directory) before delivering it — a prior session on
      this exact project once shipped a zip that silently reverted edits
      due to a careless re-extract-over-edited-files mistake. Don't repeat
      that.

## What to deliver

A short written summary of what was added/changed, file by file, plus
whichever concrete deliverable format you're set up to produce (updated
project files, a diff, or a packaged zip — match whatever your own
environment/workflow already does for handing off finished code).
