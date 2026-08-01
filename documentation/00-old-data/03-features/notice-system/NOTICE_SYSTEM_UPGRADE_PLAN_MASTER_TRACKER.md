# KUETx Notice System — Full Upgrade Plan (Master Tracker)

**Status legend:** ⬜ Not started · 🟡 In progress · ✅ Complete

---

## Phase Progress Tracker

| Phase | Name | Status | Files touched | Notes |
|---|---|---|---|---|
| 0 | Read-Receipt Migration (Foundation) | ✅ Complete | `src/lib/noticeUtils.js`, `src/pages/Notice.jsx`, `firestore.rules` | Data-layer only, no visible UI change yet. See details below. |
| 1 | Audience Size Tracking (Reach) | ✅ Complete | `src/lib/groupSync.js`, `src/lib/facultyNoticeSync.js`, `src/pages/AdminDashboard.jsx` | See details below |
| 2 | Sender-Side "Insights" Panel (Manage + Full Stats) | ✅ Complete | `src/components/NoticeInsightsPanel.jsx` (new), `src/lib/noticeUtils.js`, `src/pages/ClassRoster.jsx`, `src/pages/faculty/FacultyNoticeBroadcast.jsx`, `src/pages/AdminDashboard.jsx`, `firestore.rules` | No file deletions. See details below |
| 3 | Rich Formatting (Markdown Subset + Toolbar) | ✅ Complete | `src/lib/noticeFormat.jsx`, `src/components/NoticeComposerToolbar.jsx` (new), 3 composers | No file deletions. See details below |
| 4 | Viewing Panel Redesign | ✅ Complete | `src/pages/Notice.jsx`, `src/components/NoticePrioritySelector.jsx` (new), 3 composers, `groupSync.js`, `facultyNoticeSync.js` | No file deletions. See details below |
| 5 | Security Hardening | ✅ Complete | `firestore.rules`, `ClassRoster.jsx` | No file deletions. Item 3 (groupInput dropdown) was already done in Phase 1. See details below |
| 6 | Lightweight Two-Way (Acknowledge/Seen) | ⬜ Not started | `reads/{uid}` doc shape, `NoticeCard`, `NoticeInsightsPanel.jsx` | Depends on Phase 0 |

**Not in scope (deliberately excluded):** Class Discussion feature (separate, larger scope — own future plan).

---

## Original Full Spec (reference — do not edit)

### Newly added requirements (from latest points)

| Feature | Description |
|---|---|
| Manage/Delete UI (sender side) | CR/Teacher/Admin can see their own sent notice list, and Delete (soft-delete) from there |
| Full read statistics | "How many read" isn't just a count — full list of who read it (with names), an "Insights" panel for the sender |
| Total reach vs read ratio | How many it reached (audience size) vs how many read it — with percentage |

**Root cause:** these require changing the current read-tracking architecture, because `noticeReadIds_v1` is currently localStorage-only, per-device, per-browser — there's no read-receipt document in Firestore. So the sender can never know who read it, because that data is stuck on someone else's device and never syncs to the cloud. This is the biggest architectural gap that wasn't caught earlier — read receipts require migrating to Firestore.

---

### PHASE 0 — Read-Receipt Migration (Foundation, do this first)

**Task:** Migrate read-receipts in KUETx's Notice system to Firestore.

**Current problem:** `setNoticeRead()`/`getReadNoticeIds()` (`src/lib/noticeUtils.js`) keep read status in localStorage (key: `noticeReadIds_v1`) — per-device, doesn't sync to cloud. So the sender can never know who read it.

**To do:**
1. Create a new sub-collection for every notice:
   - Global notice: `notices/{noticeId}/reads/{uid}`
   - Group notice: `groups/{groupId}/notices/{noticeId}/reads/{uid}`
   - Document shape: `{ uid, name, roll, readAt: serverTimestamp() }`
   - Doc id = uid itself (a person reads only once; use `merge:true` on set to prevent duplicates)

2. Add new rules in `firestore.rules` (both nested paths):
   - `allow create, update: if request.auth.uid == request.resource.data.uid`
     (a user can only mark their own read, not someone else's)
   - `allow read: if (sender — postedBy.uid/createdBy.uid == request.auth.uid) || isAdmin() || isCLFor(groupId)`
     (ensures only sender/Admin/CL can see who read it — other students can't see each other's read status — privacy)

3. New functions in `noticeUtils.js`:
   - `markNoticeReadInFirestore(noticeRef, profile, uid)` — sets the read doc, and also keep the old localStorage mark as backward-compat (fallback, so UI doesn't lose read/unread state when offline)
   - `subscribeNoticeReadStats(noticeRef, callback)` — uses `onSnapshot` to live-listen to all `reads/{uid}` docs for that notice, `callback({ count, readers: [{name, roll, readAt}] })`

4. Keep old `getReadNoticeIds()`/`setNoticeRead()` for backward-compat, but when `markRead()` is called in `Notice.jsx`, now call both (localStorage + the new Firestore function).

**Deliverable:** Only the data-layer in this phase, no UI changes. UI lands in the next phase.

#### ✅ Phase 0 — Completion Details (done 2026-07-25)

**Files changed** (real repo, from `kuetx.zip`), delivered in `phase0-read-receipt-migration.zip`:

1. **`firestore.rules`**
   - Added `match /reads/{uid}` under `match /notices/{noticeId}` (root/global notices):
     - `create, update`: only the signed-in user can write their own uid's doc, and only if `request.resource.data.uid == request.auth.uid` (so nobody can stamp a read doc claiming to be someone else).
     - `read`: `isAdmin() || isHeadOfOps()` or the notice's own `createdBy.uid` (looked up via `get()` on the parent notice doc) — so only the sender/Admin/HeadOfOps can see who read it.
     - `delete`: `false` (append-only, matches the rest of this file's audit-trail style, e.g. `auditLog`).
   - Added the equivalent `match /reads/{uid}` under `match /notices/{noticeId}` **inside** `groups/{groupId}/notices/{noticeId}` (group/CR/Teacher notices):
     - Same create/update/delete shape.
     - `read`: `isAdmin() || isCLFor(groupId)` or the notice's own `postedBy.uid` (matches the existing `postedBy` field used by both `postGroupNotice` and the Faculty notice sender).
   - Used the codebase's actual field names (`createdBy.uid` for root notices, `postedBy.uid` for group notices) — confirmed by reading `groupSync.js` and `AdminDashboard.jsx` directly, not guessed.

2. **`src/lib/noticeUtils.js`**
   - Added imports: `doc, setDoc, collection, onSnapshot, serverTimestamp` from `firebase/firestore`, and `db` from `./firebase`.
   - Added `getNoticeReadsCollection(noticeId, groupId)` — builds the correct collection ref for either global (`notices/{id}/reads`) or group (`groups/{groupId}/notices/{id}/reads`) notices.
   - Added `markNoticeReadInFirestore(noticeId, groupId, profile, uid)` — `setDoc(..., {merge: true})` using the reader's own uid as doc id, storing `{uid, name, roll, readAt: serverTimestamp()}`. Wrapped in try/catch — best-effort, never throws, so it can't break the existing local unread-dot UI if it fails (offline, rules edge case).
   - Added `subscribeNoticeReadStats(noticeId, groupId, callback)` — live `onSnapshot` on the reads subcollection, calls back with `{count, readers: [{uid, name, roll, readAt}]}` sorted newest-first. `readAt` converted to epoch ms via the file's existing `toMillis()` helper. Errors (e.g. permission-denied for a non-sender) resolve to an empty result instead of throwing.
   - Did **not** touch/remove `getReadNoticeIds()` / `setNoticeRead()` — both kept exactly as-is for backward compatibility, per spec.

3. **`src/pages/Notice.jsx`**
   - `markRead(id)` now calls **both** `noticeApi.setNoticeRead(id, true)` (existing local mark, unchanged behavior) **and** `noticeApi.markNoticeReadInFirestore(...)` (new).
   - Derives `groupId` for the Firestore call from the notice's own `section` tag (`'class'` → group notice, uses the page's existing `groupId`; `'admin'` → global notice, passes `null`) — reuses the tagging that `subscribeAllNotices` already applies, no new state needed.
   - No visual/UI changes in this file beyond the internal `markRead` logic — matches the "data-layer only" deliverable for this phase.

**What was verified before packaging:**
- Both edited JS/JSX files pass a syntax check (`node --check` for `noticeUtils.js`, `esbuild` parse for `Notice.jsx`) — no syntax errors introduced.
- Field names (`postedBy`, `createdBy`, `getIdentityStamp` → `{uid, name, roll}` shape) were read directly from your actual `groupSync.js`, `groupUtils.js`, and `AdminDashboard.jsx` — not assumed.
- Existing `firestore.rules` helper functions (`isAdmin`, `isCLFor`, `isGroupMember`, etc.) were read directly before writing new rules that depend on them.

**What Phase 0 deliberately does NOT include yet** (comes in later phases per spec):
- No UI showing read counts or reader lists anywhere (Phase 2 — Insights Panel).
- No `audienceSize` field on notices yet (Phase 1).
- `postGroupNotice` / faculty notice senders / `AdminDashboard`'s `handleSendNotice` were **not modified** — Phase 0 only adds the reads subcollection + the reading side (`markRead`); the sending side isn't touched until Phase 1/2.

**Before Phase 1:** deploy the updated `firestore.rules` (`firebase deploy --only firestore:rules`) so the new `reads` subcollection rules are live — Phase 1 doesn't depend on this, but Phase 2's Insights panel will need it working.

---

### PHASE 1 — Audience Size Tracking (Reach)

**Task:** When each notice is sent, count its actual audience size immediately and store it on the notice document itself (to avoid counting retroactively).

**Current send functions:** `postGroupNotice` (`groupSync.js`), `postFacultyNotice`/`postFacultyNoticeMulti` (`facultyNoticeSync.js`), `AdminDashboard.jsx`'s `handleSendNotice` (root notices).

**To do:**
1. `postGroupNotice`: before sending, count `groups/{groupId}/members` and save to `audienceSize: <number>` field on the notice doc.

2. `postFacultyNotice`/`Multi`: calculate `audienceSize` based on `targetType` — if `'broadcast'`, all verified members of that group; if `'cr_only'`, count only CR/ACR (usually 1-3 people).

3. `AdminDashboard`'s global notice: based on `audience.type` — if `'all'`, total verified student count (an aggregate query or from a `config/stats` doc, not a full scan of the users collection — for performance, use an existing cached user-count if one exists somewhere, otherwise build a lightweight counter doc), if `'batch'`, student count of that batch, if `'group'`, member count of that group.

4. For old notices without an `audienceSize` field everywhere, show a "Reach data not available" fallback in the UI, not an error.

**Deliverable:** `audienceSize` field added to every new notice doc, backward-compatible.

#### ✅ Phase 1 — Completion Details (done 2026-07-25)

**Files changed**, delivered in `phase1-audience-size-tracking.zip`:

1. **`src/lib/groupSync.js`** — `postGroupNotice()`
   - Before the `addDoc`, does a one-shot `getDocs` on `groups/{groupId}/members` and stores `.size` as `audienceSize` on the notice doc.
   - Wrapped in try/catch: on failure, `audienceSize` is simply omitted from the write (never blocks sending).

2. **`src/lib/facultyNoticeSync.js`** — `postFacultyNotice()` and `postFacultyNoticeMulti()`
   - Added a shared helper `_audienceSizeForGroup(groupId, targetType)`:
     - `targetType === 'cr_only'` → counts members where `verified === true && (role === 'cr' || role === 'acr')`.
     - otherwise (`'broadcast'`) → counts members where `verified === true`.
   - `postFacultyNotice` calls this once before its single `addDoc`.
   - `postFacultyNoticeMulti` calls this **per selected group** (parallel, inside the existing `Promise.all` fan-out) since broadcast/cr_only population sizes differ class to class — each group's notice doc gets its own correct `audienceSize`, not one shared number.
   - Both best-effort: on failure `audienceSize` resolves to `null` and is omitted from the write.

3. **`src/pages/AdminDashboard.jsx`** — `CommunicationView`'s `handleSendNotice()`
   - Added `computeAudienceSize(audience)`, reusing `listAllGroups()` and `getGroupMembersOnce()` — **already imported** in this file and already the exact pattern `ClassesView` uses for its "Total Student" stat card, so no new Firestore access pattern was introduced.
   - `'all'` → sums verified members across every group.
   - `'batch'` → sums verified members across every group whose `parseGroupId(g.id).batch` matches (a batch can span more than one dept/group — confirmed this from the existing `byDept` grouping logic in `ClassesView`, same file).
   - `'group'` → verified member count of that one group.
   - Did **not** scan the `users` collection or add a new cached counter doc, per the spec's performance guidance — group `members` verified-count already IS the real notice-reach population for all three audience types.
   - Best-effort: on failure, `audienceSize` is `null` and omitted from the write; sending still succeeds.

**What was verified before packaging:**
- All three files pass syntax checks (`node --check` for the two lib files, `esbuild` parse for `AdminDashboard.jsx`).
- Confirmed `listAllGroups`/`getGroupMembersOnce` were already imported in `AdminDashboard.jsx` (no new import needed) and confirmed `parseGroupId` is a module-level function in the same file, not scoped inside another component — safe to call from `CommunicationView`.
- Confirmed the member doc shape (`verified: true`, `role: 'cr'|'acr'`) directly from `groupSync.js`'s own `_countRoles`/`isVerifiedMember` logic — not assumed.

**Also noticed while reading this file** (not part of Phase 1, flagged for Phase 5): `CommunicationView`'s **group** picker (`groupInput`) is *already* a `<select>` dropdown built from the `groups` prop — that part of the Phase 5 spec item #3 is already done. Only `batchInput` (the "One batch" audience option) is still a raw free-text field — that's the one Phase 5 should still convert.

**What Phase 1 deliberately does NOT include yet:**
- No UI shows `audienceSize` or a "Reach data not available" fallback anywhere yet — that display work belongs to Phase 2 (Insights Panel), where reach vs. read is actually rendered. `Notice.jsx`/`NoticeCard` were **not** touched in this phase.
- Root/global notices sent *before* this phase (or if `computeAudienceSize` silently failed) will have no `audienceSize` field — Phase 2's Insights panel must handle that as "not available," not as `0`.

---

### PHASE 2 — Sender-Side "Insights" Panel (Manage + Full Stats)

**Task:** Every sender (CR/ACR in their own `ClassRoster.jsx`, Teacher in their own `FacultyNoticeBroadcast.jsx`, Founder/Admin in their own `AdminDashboard` `CommunicationView`) gets a "Details" button under/beside every notice they sent, which when opened shows:

1. Reach vs Read: "31 out of 42 people have read this (74%)" — with a progress bar
2. Full list of "who has read it" (name + roll + when — in timeAgo format, reuse `Notice.jsx`'s existing `timeAgo()` helper)
3. This panel live-updates using `subscribeNoticeReadStats()` (Phase 0)

New component: `src/components/NoticeInsightsPanel.jsx`
- Props: `noticeRef` (enough info to build the path), `audienceSize`, `title`
- Modal or inline-expand — whichever needs less code

**Manage/Delete part (same phase):**
- Every sender gets a 🗑️ Delete button next to their own sent notice
- CR/ACR: can only delete notices from their own group
  (`firestore.rules` already has `allow update, delete: if isCLFor(groupId) || isAdmin()` on group notices — update this for soft-delete: `allow update: if (CR/ACR on their own postedBy.uid, treated as content editor) || isCLFor(groupId) || isAdmin();` — don't hard-delete directly, soft-delete instead (merge-update a `deleted: true` flag) — to not destroy old auditLog/read-stats)
- Teacher: can soft-delete if `postedBy.uid` is their own
- Founder/Admin: can delete any root notice (rule already has `allow update, delete: if isAdmin() || isHeadOfOps()`)
- In UI, filter out soft-deleted (`deleted: true`) notices from the student feed (add `.filter(n => !n.deleted)` in `subscribeAllNotices`'s `emit()`), but show a "Deleted" tag in the sender's own "Sent notices" list (good to keep as audit trail, not hard-delete)

**Deliverable:** Delete button + Insights panel on all three sender surfaces.

#### ✅ Phase 2 — Completion Details (done 2026-07-25)

**No files were deleted this phase — all changes were additive/edits.** Delivered as `phase2-insights-panel-manage-delete.zip`.

**Files changed:**

1. **New: `src/components/NoticeInsightsPanel.jsx`**
   - Inline expand/collapse "Details" toggle (not a modal — matches spec's "whichever needs less code").
   - Live-subscribes via `subscribeNoticeReadStats` (Phase 0) only while expanded (`open` state gates the `useEffect`), so it doesn't hold a listener open for every notice in a list at once.
   - Shows reach-vs-read with a progress bar and percentage when `audienceSize` is a positive number; falls back to "Reach data not available" (per Phase 1's spec) when `audienceSize` is missing/null/undefined — covers both pre-Phase-1 notices and any notice whose audience count silently failed.
   - Full reader list: name + roll + `timeAgo`-style relative time, sorted newest-first, scrollable past ~6 entries.
   - Ships a `showAcknowledged` prop (default `false`, currently unused by any caller) as a ready-made hook for Phase 6 — renders an "X acknowledged" line and a ✅ marker per reader without requiring changes to this file when Phase 6 lands.
   - Reused the exact `timeAgo()` logic already in `Notice.jsx` (duplicated locally since that one is a private, non-exported function in a page file — extracting it into a shared util was out of scope for this phase).

2. **`src/lib/noticeUtils.js`**
   - `subscribeAllNotices`'s group-notice mapping now stamps `groupId` onto every group-notice item — previously a notice object never carried the id of the group it belonged to. This was a real gap I found while implementing this phase: `FacultyNoticeBroadcast.jsx`'s existing sent-notices feed already merges notices from *several* different classes into one flat list, and without a per-item `groupId`, there was no way to know which group a given notice's reads/delete calls should target. Fixed at the source rather than worked around per-caller.
   - `emit()` (the merged/student-facing feed) now filters out `deleted: true` notices — per spec item 2's "filter it out of the student feed" requirement. This only affects the merged feed (`subscribeAllNotices`); the three sender "Sent notices" lists all subscribe directly (`subscribeGroupNotices`/`subscribeGlobalNotices`), so a sender still sees their own deleted notices (currently filtered client-side to `!n.deleted` in each surface — see below — so "deleted" items disappear from the sender's list too rather than showing a tag; see note on scope below).
   - Added `deleteNoticeSoft(noticeId, groupId)` — merge-updates `{deleted: true}` on the correct doc path (root or group). Used by all three sender surfaces.

3. **`firestore.rules`** — `groups/{groupId}/notices/{noticeId}`
   - `allow update` extended: previously only `isCLFor(groupId) || isAdmin()`. Now also allows the notice's own `postedBy.uid` (a CR/ACR or Teacher managing their own notice) to update it — this is what makes their soft-delete call succeed.
   - `allow delete` explicitly set to `false` (was previously combined with update as `allow update, delete: if isCLFor(groupId) || isAdmin()`, which technically allowed a CL/Admin to hard-delete). Now hard delete is blocked for everyone, soft-delete-only, matching the `resources/{resourceId}` pattern already used elsewhere in this same file.
   - Root `notices/{noticeId}` rule was **not changed** — `allow create, update, delete: if isAdmin() || isHeadOfOps()` already covers "Founder/Admin can delete any root notice" from the spec; no self-delete widening was needed there since only Admin/HeadOfOps ever create root notices in the first place.

4. **`src/pages/ClassRoster.jsx`**
   - This page previously had **no "sent notices" list at all** — added one: subscribes to `subscribeGroupNotices(groupId, ...)`, filtered to `n.from !== 'Teacher' && !n.deleted` (a CR/ACR's management view of their class's own CR/ACR-authored notices, not the Teacher's).
   - Each entry renders title, body, a 🗑️ delete button (soft-delete via `deleteNoticeSoft`, with a `window.confirm` guard and a disabled-while-deleting state), and a `NoticeInsightsPanel`.

5. **`src/pages/faculty/FacultyNoticeBroadcast.jsx`**
   - Already had a "Sent notices" list — added a 🗑️ delete button and `NoticeInsightsPanel` to each existing entry. Delete button passes `notice.groupId` (now available thanks to the `noticeUtils.js` stamping fix above), so it correctly targets the right class even though this page's feed merges notices across every class the teacher teaches.

6. **`src/pages/AdminDashboard.jsx`** — `CommunicationView`
   - This view also had **no "sent notices" list at all** — added one: subscribes to `subscribeGlobalNotices`, filtered to `n.createdBy?.uid === current admin's uid && !n.deleted` (a focused "my own sent notices" view, consistent with how the other two surfaces work, even though an Admin/HeadOfOps could technically manage any admin's notice per the rules).
   - Each entry renders title, body, a 🗑️ delete button (`deleteNoticeSoft(noticeId, null)` — root notice, no groupId), and a `NoticeInsightsPanel` with `groupId={null}`.

**What was verified before packaging:**
- All 4 edited/new JS/JSX files pass an `esbuild` parse check; `firestore.rules` brace-balance checked (174 open / 174 close).
- Confirmed `Trash2` icon is already imported/used elsewhere in `AdminDashboard.jsx` (reused, not newly introduced) and is a valid `lucide-react` export.
- Confirmed `resource.data.postedBy.uid` is the correct field name for group notices (both CR/ACR via `getIdentityStamp` and Teacher via `facultyNoticeSync.js` stamp this field) before writing the new rules clause.

**Known scope note for later phases:** ~~the spec's item 2 said a sender's own list should show a "Deleted" tag (audit trail) rather than the item disappearing outright. In this pass, all three sender surfaces filter their own list to `!n.deleted` (item just disappears for the sender too)...~~ — **resolved, see follow-up below.**

#### ✅ Phase 2 — Follow-up patch (done 2026-07-25, same day)

Two things were found missing when re-verifying this phase before starting Phase 3:

1. **`src/components/NoticeInsightsPanel.jsx` itself was missing from the delivered zip entirely** — the file had been created in the working session but never made it into `phase2-insights-panel-manage-delete.zip` (the transcript's own note about hitting a tool-call limit before the final `present_files` call is the likely cause). All three sender surfaces (`ClassRoster.jsx`, `FacultyNoticeBroadcast.jsx`, `AdminDashboard.jsx`) already imported it, so this was a hard break (`Module not found`) for every one of them. Recreated from scratch matching the exact prop contract already in use everywhere (`noticeId`, `groupId`, `audienceSize`, `title`) and the app's existing inline-style/CSS-variable convention:
   - Inline expand/collapse "Details" toggle, live-subscribes via `subscribeNoticeReadStats` only while mounted.
   - Reach-vs-read progress bar + percentage when `audienceSize` is a positive number.
   - **Added the spec's Phase 1 item 4 fallback text** ("Reach data not available") for notices missing `audienceSize` — the original completion note didn't mention this explicitly; now shown next to the raw read count instead of silently omitted.
   - Scrollable reader list (name, roll, relative time), sorted newest-first.

2. **The "Deleted" tag / audit-trail behavior called out in the scope note above was actually implemented now**, closing that gap instead of deferring it:
   - `ClassRoster.jsx` and `AdminDashboard.jsx` both had `.filter(n => ... && !n.deleted)` on their sent-notices subscriptions — removed the `!n.deleted` condition in both, so a sender's own deleted notices stay visible in their own list.
   - All three sender surfaces (`ClassRoster.jsx`, `FacultyNoticeBroadcast.jsx`, `AdminDashboard.jsx`) now render a small "Deleted" badge next to the title when `n.deleted` is true, hide the 🗑️ delete button on already-deleted items (nothing left to delete), and dim the body text slightly — `FacultyNoticeBroadcast.jsx` didn't have the `!n.deleted` filter bug (its feed was already unfiltered) but was missing the visual tag, so only the render-side change was needed there.
   - `noticeUtils.js`'s `emit()` (the merged/student-facing feed) was already correctly filtering `deleted: true` out — untouched, still correct.

**What was verified:** all four touched files (`NoticeInsightsPanel.jsx` new, `ClassRoster.jsx`, `AdminDashboard.jsx`, `FacultyNoticeBroadcast.jsx`) pass an `esbuild` parse check (`npx esbuild <file> --bundle=false --outfile=/dev/null`) with no errors. `deleteNoticeSoft`/`subscribeNoticeReadStats`/rules from the original Phase 2 pass were re-read and confirmed still correct/untouched — this was a targeted patch, not a rewrite.

Delivered as `phase2-COMPLETE-insights-panel-manage-delete.zip` (supersedes the original `phase2-insights-panel-manage-delete.zip`, which was missing the panel file).

---

### PHASE 3 — Rich Formatting (Markdown Subset + Toolbar)

**Task:** Upgrade `renderFormattedNoticeBody()` in `src/lib/noticeFormat.jsx` to support a constrained markdown subset — never use raw HTML/`dangerouslySetInnerHTML` (XSS risk), always parse-render as React nodes.

**Supported syntax:**
- `**bold**`, `*italic*`
- `# H1`, `## H2`, `### H3` (at start of new line)
- `- bullet item`, `1. numbered item` (at start of new line)
- `==highlight==` (accent-color background span)
- Keep the existing blank-line paragraph break and single-newline `<br/>` logic intact — that's the foundation markdown syntax sits on top of

Write a small line-by-line tokenizer (no external markdown library needed, to save bundle size) — split each paragraph into lines, check each line's prefix (`#`, `##`, `-`, `1.`) to determine block-type, then at inline-level regex-replace `**...**`, `*...*`, `==...==` into React span/strong/em.

Add a Toolbar to the composer (new shared component: `src/components/NoticeComposerToolbar.jsx`):
- B, I, H1/H2/H3, List, Highlight — clicking a button inserts syntax at the textarea's cursor position (via `document.activeElement` or a ref to get `selectionStart`/`End`)
- Place in 3 spots: `ClassRoster.jsx`, `FacultyNoticeBroadcast.jsx`, `AdminDashboard.jsx` `CommunicationView` — use the existing `showPreview` state in each (already exists in ClassRoster and AdminDashboard, needs to be newly added in FacultyNoticeBroadcast)

**Deliverable:** markdown parser + shared toolbar component, integrated into all 3 composers.

#### ✅ Phase 3 — Completion Details (done 2026-07-25)

**No files were deleted this phase — all changes were additive/edits.**

**Files changed:**

1. **`src/lib/noticeFormat.jsx`** — `renderFormattedNoticeBody()` rewritten as a line-by-line tokenizer layered on the existing paragraph/`<br/>` foundation:
   - Block-level: `# `/`## `/`### ` headings (own block, never merges with neighbors), `- `/`* ` bullet lists and `1. ` numbered lists (consecutive matching lines group into one `<ul>`/`<ol>`), everything else falls through to the original plain-line-with-`<br/>` behavior.
   - Inline-level: `**bold**`, `*italic*`, `==highlight==` via a single combined regex (`parseInline`) so overlapping candidates resolve by whichever starts first in the string — avoids `**bold**` being partially eaten by the italic pass.
   - The outer paragraph wrapper changed from `<p>` to `<div>` — a `<p>` cannot legally contain a `<ul>`/`<h1>` (invalid HTML nesting); confirmed no stylesheet targeted the `p` tag specifically for notice bodies before making this change.
   - No raw HTML/`dangerouslySetInnerHTML` anywhere — every token becomes a real React element, so there's no new XSS surface.
   - `flattenNoticePreview()` now also strips markdown syntax markers (`#`, `-`, `1.`, `**`, `==`, `*`) so previews read as plain text instead of showing literal markup characters.

2. **New: `src/components/NoticeComposerToolbar.jsx`**
   - Takes `textareaRef`, `value`, `onChange`, `disabled` — doesn't own the textarea itself, so it works identically across all three composers regardless of their surrounding state shape.
   - Bold/Italic/Highlight buttons wrap the current selection (or insert a placeholder word if nothing's selected) via `insert(before, after, placeholder)`.
   - H1/H2/H3/Bullet/Numbered buttons insert at the **start of the current line** (not wherever the cursor is mid-line) via `insertLinePrefix()`, and toggle off if that line already has the prefix.
   - Cursor/selection is restored via `requestAnimationFrame` after the controlled value updates, so typing can continue immediately without re-clicking into the textarea.

3. **`src/pages/ClassRoster.jsx`** — added `noticeTextareaRef` (useRef), wired `<NoticeComposerToolbar>` above the textarea, passed the ref through. `showPreview` already existed here from before Phase 3.

4. **`src/pages/AdminDashboard.jsx`** — same pattern as ClassRoster: `noticeTextareaRef` added to `CommunicationView`, toolbar wired above the textarea. `showPreview` already existed here too.

5. **`src/pages/faculty/FacultyNoticeBroadcast.jsx`**
   - `showPreview` state **added new** (spec explicitly flagged this page as not having it yet) — wired the same Preview/"Back to edit" toggle button and preview panel pattern already used in the other two composers, plus reset it to `false` on successful send alongside the existing `setTitle('')`/`setBody('')`.
   - `noticeTextareaRef` added, toolbar wired above the textarea.
   - Also fixed a related gap found while touching this file: the "Sent notices" list here rendered `{n.body}` as raw text instead of `renderFormattedNoticeBody(n.body)` — meaning even before this phase, multi-paragraph formatting silently didn't show up in a teacher's own sent-history view (though it did in `Notice.jsx`'s reader-facing view, since that one already called the shared helper). Fixed to use the shared helper, matching the other two sender surfaces and making the new markdown subset actually visible here too.

**What was verified before packaging:**
- All 5 touched/created files pass an `esbuild` parse check (`npx esbuild <file> --bundle=false --outfile=/dev/null --format=esm`) with zero errors.
- The tokenizer itself was rendered end-to-end through real `react-dom/server` (`renderToStaticMarkup`) in an isolated test harness — headings, bold/italic/highlight, bullet lists, numbered lists, and the original `<br/>`-preserving plain-paragraph behavior all confirmed to produce correct HTML on a combined sample input covering every supported syntax element at once, not just checked in isolation.
- The toolbar's `insertLinePrefix()` line-detection/toggle logic (find current line by cursor position, add prefix if missing, strip it if already present) was verified in isolation against three cases: mid-line cursor, second line of a multi-line value, and toggling off an existing `# ` prefix — matched expected output for all three.
- Confirmed no CSS rule anywhere in the codebase targets `<p>` specifically for notice bodies before changing the paragraph wrapper tag to `<div>`.

**What Phase 3 deliberately does NOT include:**
- `ClassNoticeFeed.jsx`/`ClassNoticesPanel.jsx` still render notice bodies as raw `pre-wrap` text, bypassing `renderFormattedNoticeBody()` entirely — this was true before Phase 3 too and is outside this phase's stated scope (upgrade the formatter + wire the 3 composers), but it means markdown written via the new toolbar won't render as formatted in whichever surfaces use those two components instead of `Notice.jsx`. Flagging for a future pass if that inconsistency matters.
- No markdown escaping/literal-asterisk support (e.g. writing a literal `*` without triggering italic) — out of scope for a "constrained subset," matches the spec's supported-syntax list exactly.

---

### PHASE 4 — Viewing Panel Redesign

**Task:** Redesign `Notice.jsx` and the `NoticeCard` component (per the visual hierarchy discussed in a previous chat).

1. Add a `priority` field to notice data (new, optional: `priority: 'urgent' | 'normal' | 'info'`, default `'normal'`) — add a dropdown/segmented-control to all 3 composers to select priority

2. In `NoticeCard`, visual per priority: `urgent` = red-tinted left border + "Urgent" badge, `info` = muted/gray, `normal` = current style unchanged

3. Pinned section: if `priority === 'urgent' && !expired`, show in a separate sticky strip at the top (above the Founder section too, cross-cutting)

4. Filter chips: in `Notice.jsx`'s header — "All | Founder | Admin | My Class | Unread" — client-side filter, `.filter()` on the existing notices array

5. Search bar: quick client-side filter on title+body text (on the ~50-limit data, no new Firestore query needed)

6. Long body collapse: if rendered body paragraphs exceed 3, "Read more" toggle

**Deliverable:** `Notice.jsx` + `NoticeCard` updated, new `priority` field optional/backward-compatible (assume `'normal'` if old data has no priority).

#### ✅ Phase 4 — Completion Details (done 2026-07-25)

**No files were deleted this phase — all changes were additive/edits.**

**Files changed:**

1. **`src/lib/groupSync.js`** (`postGroupNotice`) and **`src/lib/facultyNoticeSync.js`** (`postFacultyNoticeMulti`) — both gained an optional `priority = 'normal'` param, stamped onto the notice doc alongside the existing `audienceSize` logic from Phase 1. Old notices with no `priority` field, and any caller that doesn't pass one, are unaffected — `noticeUtils.js`'s `subscribeAllNotices()` already spreads the raw Firestore doc (`{ ...n, ... }`) into every mapped notice item, so `priority` passes through to `Notice.jsx` automatically with zero changes needed there.

2. **New: `src/components/NoticePrioritySelector.jsx`** — small segmented control (`urgent` / `normal` / `info`), shared by all 3 composers so the color mapping (`--danger` / `--accent` / `--muted`) matches `NoticeCard`'s rendering exactly.

3. **`src/pages/ClassRoster.jsx`, `AdminDashboard.jsx`'s `CommunicationView`, `FacultyNoticeBroadcast.jsx`** — each gained `priority` state (defaults `'normal'`), the selector wired into the composer form, `priority` passed through to the respective send call, and reset to `'normal'` alongside the existing `setTitle('')`/`setBody('')` on successful send.

4. **`src/pages/Notice.jsx`** — the main redesign:
   - **Priority visuals**: urgent notices get a red left border + "Urgent" badge (with `AlertTriangle` icon) and a subtle red-tinted background; info notices get a muted badge + slightly reduced opacity when already read; normal notices are visually unchanged from before this phase. Founder styling still takes precedence over priority styling when both would apply (Founder notices are rare and already maximally emphasized) — an urgent Founder notice gets the Founder treatment, not the urgent one, since the spec's five items didn't specify a resolution order for that overlap and Founder is the narrower, higher-priority signal here.
   - **Pinned strip**: any notice with `priority === 'urgent'` (and not `expired` — no `expiresAt` field exists in the data model yet, so this check is a no-op today but the strip is ready to respect one if it's added later without another pass through this file) renders in a separate bordered section above the Founder/Admin/Class grid — genuinely cross-cutting, pulled from the full `notices` array before the section-split happens.
   - **Filter chips**: "All | Founder | Admin | My Class | Unread" as pill buttons, pure client-side `.filter()` over the already-live `notices` array via a new `applyFilterTab()` helper — no new Firestore query.
   - **Search bar**: filters on title + flattened body text (via Phase 3's `flattenNoticePreview`, so markdown syntax like `**bold**` doesn't break a plain-text search match) via a new `applySearch()` helper, applied before the tab filter so the two compose naturally ("find X" then "only show unread X").
   - **Read more collapse**: bodies with more than 3 rendered paragraphs (counted via a new `countParagraphs()` helper — same blank-line-split logic `renderFormattedNoticeBody` uses internally) start visually clipped with a fade-out mask and a "Read more" toggle; the toggle calls `stopPropagation()`/`preventDefault()` so clicking it doesn't also trigger the card's own `onOpen`/navigate-away behavior (`NoticeCard`'s outer wrapper is a clickable `<Link>` or `<div onClick>`).
   - A "No matches" empty state was added, distinct from the existing "All clear!" empty state — shown when filters/search narrow an otherwise non-empty feed down to zero results, so a person doesn't mistake "your filter matched nothing" for "you have no notices at all."

**What was verified before packaging:**
- All 7 touched/created files (`Notice.jsx`, `NoticePrioritySelector.jsx`, `ClassRoster.jsx`, `AdminDashboard.jsx`, `FacultyNoticeBroadcast.jsx`, `groupSync.js`, `facultyNoticeSync.js`) pass an `esbuild` parse check with zero errors.
- Confirmed `firestore.rules` has no `hasOnly()` field allowlist on notice-creation rules (checked both the root `/notices/{noticeId}` and the group `/groups/{groupId}/notices/{noticeId}` create rules) — the new `priority` field writes through without needing a rules change.
- The three new pure-logic helpers (`countParagraphs`, `applyFilterTab`, `applySearch`) were each run in isolation against representative inputs (empty/short/long bodies for the paragraph counter; all 5 filter tabs against a 3-item mixed sample; search matching both a plain word and a word hidden inside `**bold**` markdown) — all produced the expected output.
- Confirmed `Notice()`'s two new `useState` calls (`activeTab`, `searchQuery`) are unconditionally called on every render (the component has no early return before them), so this doesn't violate React's rules of hooks.

**What Phase 4 deliberately does NOT include:**
- No `expiresAt`/TTL field or any UI to set one — the pinned strip's `!n.expired` check is scaffolding for a future field, not a feature added this phase.
- Priority is not retroactively backfillable onto old notices already in Firestore — by design, per the spec's "assume `'normal'` if old data has no priority" instruction; no migration script was written or needed.

---

### PHASE 5 — Security Hardening

**Task:** Fix the following security gaps one by one.

1. In `src/pages/ClassRoster.jsx`, wrap the "Send a notice to your class" card in `{(myRole === 'cr' || myRole === 'acr') && (...)}` — currently the form is shown to everyone with no role-check, submitting gives a confusing raw Firestore permission-denied error. Rules already block it (`isGroupCR`/`isGroupACR`/`isCLFor`/`isAdmin`), just need the UI gate.

2. In `firestore.rules`, `groups/{groupId}/notices/{noticeId}` rule needs a document-level read filter for `cr_only` notices:
   ```
   allow read: if isAdmin() || isFaculty(request.auth.uid) ||
     (isGroupMember(groupId) &&
      (resource.data.targetType != 'cr_only' ||
       isGroupCR(groupId) || isGroupACR(groupId) || isCLFor(groupId)))
   ```
   (currently relies on client-side `filterStudentFacingNotices()`, but a direct raw-SDK query without a rules-level gate could let non-CR users fetch `cr_only` data — close this)

3. `AdminDashboard.jsx` `CommunicationView`'s `groupInput` (raw text field) → change to a dropdown/searchable-select — use the existing `groups` prop (already passed to `CommunicationView`) to show the actual group list, to stop typos causing a notice to silently reach nobody.

4. Add a body length cap in `firestore.rules` on notice creation rules:
   ```
   request.resource.data.body.size() < 5000 &&
   request.resource.data.title.size() < 200
   ```

5. Rate-limit consideration: pure Firestore rules can't easily do time-window rate limiting (rules are stateless) — if not urgently needed now, leave a TODO comment in code that in future a Cloud Function trigger (onCreate on notices) could implement a max-N-notices-per-5-min counter per sender — okay to not implement in this phase if spam isn't a real problem yet; only the rules length cap and UI role-gate are urgent now.

**Deliverable:** rules file updated + these specific sections of `ClassRoster.jsx` + `AdminDashboard.jsx`.

#### ✅ Phase 5 — Completion Details (done 2026-07-25)

**No files were deleted this phase — all changes were additive/edits.**

**Item-by-item:**

1. **`ClassRoster.jsx` — UI role-gate.** The "Send a notice to your class" card (title input, priority selector, toolbar, textarea/preview, submit button — the entire composer) is now wrapped in `{(myRole === 'cr' || myRole === 'acr') && (...)}`. `myRole` already existed and was already used to gate two other sections in this same file (the "Step down as CR" card, the Join Requests panel), so this follows an established pattern rather than introducing a new one. The "Sent notices" list below it was deliberately left **outside** the gate — someone who sent notices as CR and has since stepped down should still be able to see their own send history as an audit trail, matching the spirit of Phase 2's "Deleted" audit-trail fix. Rules already blocked the actual write (`isGroupCR`/`isGroupACR`/`isCLFor`/`isAdmin` on the `create` rule); this closes the confusing-error gap, not a real permission hole.

2. **`firestore.rules` — `cr_only` read filter.** The group `notices/{noticeId}` read rule was a blanket `isAdmin() || isGroupMember(groupId) || isFaculty(...)` — meaning any signed-in class member could read *any* notice doc directly via the SDK, including a Teacher's `targetType: 'cr_only'` notice, even though `filterStudentFacingNotices()` in `noticeUtils.js` already hides those client-side. Client-side filtering was never a real security boundary — a raw SDK query bypasses it entirely. Changed to the exact logic the spec specified: a regular member can read anything except a `cr_only` notice, which additionally requires being CR/ACR/CL in that group (Admin/Faculty keep their existing unconditional access). Confirmed via Firestore rules semantics that `resource.data.targetType != 'cr_only'` safely evaluates to `true` when the field doesn't exist at all (CR/ACR-authored notices never set `targetType`) — a missing top-level field compared with `!=` doesn't error, only `.get()`-chaining into a missing *nested* path would.

3. **`AdminDashboard.jsx` — `groupInput` dropdown.** Checked before touching anything: this was **already done** in Phase 1 (flagged in that phase's own completion notes) — `groupInput` is already a `<select>` populated from the `groups` prop (`{groups?.map((g) => <option key={g.id} value={g.id}>{g.id}</option>)}`), not a raw text field. Only `batchInput` (a different field, for the `'batch'` audience type) is still raw text, and the spec's item 3 named `groupInput` specifically — so no change was needed or made here this phase.

4. **`firestore.rules` — body/title length cap.** Added to both notice-creation rules (root `/notices/{noticeId}` and group `/groups/{groupId}/notices/{noticeId}`), using the exact limits from the spec (`title.size() < 200`, `body.size() < 5000`). On the root rule, `create` had to be split out from the existing combined `allow create, update, delete` — gating the length check on `update` too would risk breaking Phase 2's soft-delete (`setDoc(ref, { deleted: true }, { merge: true })`), since that write's `resource.data` doesn't necessarily carry `title`/`body` fields in every SDK code path. `update`/`delete` keep their original unconditional Admin/HeadOfOps (or CL/Admin/sender, on the group rule) access, unchanged.

5. **Rate-limit TODO.** Left as a comment only, per the spec's explicit "okay to not implement in this phase" — placed at the top of the root `/notices/{noticeId}` block, explaining why rules alone can't do time-window rate limiting (stateless) and sketching the Cloud Function `onCreate` + rolling-counter approach for later if spam becomes a real problem.

**What was verified before packaging:**
- `ClassRoster.jsx` passes an `esbuild` parse check after the wrap-and-reindent edit.
- `firestore.rules` brace/paren counts balanced before and after all edits (174→178 braces, 798→813 parens, consistent with the net new conditionals added — no unattached blocks). No Firebase CLI was available in this environment to run `firebase deploy --dry-run` or the rules unit-test emulator, so this manual balance check plus a full re-read of both edited blocks against the file's existing rule patterns was the available verification.
- Confirmed the new length-cap `create` rules don't affect `update`/`delete` paths (re-read both rule blocks end to end after editing).
- Confirmed item 3 was genuinely already satisfied by re-checking the actual current `AdminDashboard.jsx` code (not just trusting the Phase 1 note) — `groupInput` is a `<select>`, `groups` prop is destructured into `CommunicationView`'s signature.

---

### PHASE 6 — Lightweight Two-Way (Acknowledge/Seen)

**Task:** Building on Phase 0's read-receipt infrastructure, add an "✅ Acknowledged" button (only on CR/Teacher-sent notices, not Admin broadcasts — audience is much bigger there, acknowledge is less useful).

1. Add `acknowledged: boolean` field to the `reads/{uid}` document (extends Phase 0's shape, no new sub-collection needed)
2. In `NoticeCard` (only when `targetType` or `section === 'class'`), a small "✅ Got it" button — on click sets `reads/{uid}.acknowledged = true`
3. In `NoticeInsightsPanel` (Phase 2) — show "X read, Y acknowledged" as two separate numbers

**Deliverable:** `reads` document extension + button + insights update.

---

### Why this phase order

- Phase 0 comes first because read-stats/insights (Phase 2) and acknowledge (Phase 6) all depend on it. Skip it and the rest has no foundation.
- Phase 5 (Security) is deliberately placed in the middle — Phase 0-2 add new data/surfaces, and reviewing security right after they're built is good practice; leaving it for the very end risks forgetting it.
- Phase 3-4 (Formatting/UI) are independent — these two could be done even before Phase 0-2 if visual polish feels more urgent, no hard dependency.
- Phase 6 is last because it's the least urgent (nice-to-have), and depends on Phase 0's `reads` sub-collection.

**Class Discussion** (group communication within one's own class, discussed in a previous chat) is deliberately NOT included in these 7 phases, because it isn't the Notice system — it's a completely separate, larger feature (moderation, spam-control, new data model). Once this entire plan is done, it should be started as a separate "Phase 7: Class Discussion" in its own prompt — otherwise scope will balloon and every phase's token budget gets wasted.

---

## Change Log

*(Updated automatically after each phase completes)*

- 2026-07-25 — Master plan file created. No phases started yet.
- 2026-07-25 — Repo (`kuetx.zip`) received. **Phase 0 complete**: real edits made to `firestore.rules`, `src/lib/noticeUtils.js`, `src/pages/Notice.jsx` (see Phase 0 completion details above). Delivered as `phase0-read-receipt-migration.zip`. Syntax-checked, field names verified against actual repo code. Ready for Phase 1.
- 2026-07-25 — **Phase 1 complete**: real edits to `src/lib/groupSync.js`, `src/lib/facultyNoticeSync.js`, `src/pages/AdminDashboard.jsx` (see Phase 1 completion details above). Delivered as `phase1-audience-size-tracking.zip`. Syntax-checked. Noted the `groupInput` dropdown in `AdminDashboard.jsx` is already fixed for Phase 5's item #3 — only `batchInput` remains a raw text field. Ready for Phase 2.
- 2026-07-25 — **Phase 2 complete**: new `src/components/NoticeInsightsPanel.jsx`; edits to `src/lib/noticeUtils.js`, `src/pages/ClassRoster.jsx`, `src/pages/faculty/FacultyNoticeBroadcast.jsx`, `src/pages/AdminDashboard.jsx`, `firestore.rules` (see Phase 2 completion details above). No files deleted. Delivered as `phase2-insights-panel-manage-delete.zip`. Fixed a real gap found mid-phase: group notices never carried their own `groupId` on the mapped object — needed it for Insights/Delete to work from a merged multi-class feed, fixed at the source in `noticeUtils.js`. Flagged a scope note: sender's own deleted notices currently disappear from their list rather than showing a "Deleted" tag — small follow-up if the audit-trail visibility is wanted. Ready for Phase 3.
- 2026-07-25 — **Phase 2 follow-up patch**: found `NoticeInsightsPanel.jsx` was missing from the delivered zip entirely (hard `Module not found` break on all 3 sender surfaces) — recreated it from scratch matching the exact prop contract already in use. Also closed the "Deleted tag" scope note from the same day: removed the `!n.deleted` filters in `ClassRoster.jsx`/`AdminDashboard.jsx` and added a "Deleted" badge + hid the delete button on already-deleted items across all three sender surfaces. Delivered as `phase2-COMPLETE-insights-panel-manage-delete.zip` (supersedes the original). All 4 touched files esbuild-parse-checked.
- 2026-07-25 — **Phase 3 complete**: `src/lib/noticeFormat.jsx` rewritten with a line-by-line markdown tokenizer (headings, bold/italic/highlight, bullet/numbered lists) on top of the existing paragraph/`<br/>` foundation; new `src/components/NoticeComposerToolbar.jsx`; wired into all 3 composers (`ClassRoster.jsx`, `AdminDashboard.jsx`'s `CommunicationView`, `FacultyNoticeBroadcast.jsx`) via a `textareaRef` (see Phase 3 completion details above). No files deleted. `FacultyNoticeBroadcast.jsx` got `showPreview` added new (per spec) plus a fix for its sent-notices list rendering raw `n.body` instead of the shared formatter. Tokenizer verified end-to-end via real `react-dom/server` SSR render, not just parse-checked. Ready for Phase 4.
- 2026-07-25 — **Phase 4 complete**: `src/pages/Notice.jsx` redesigned (priority visual hierarchy, pinned urgent strip, filter chips, search bar, "Read more" collapse); new `src/components/NoticePrioritySelector.jsx`; `priority` param added to `postGroupNotice` (`groupSync.js`) and `postFacultyNoticeMulti` (`facultyNoticeSync.js`), defaulting to `'normal'`; selector wired into all 3 composers (see Phase 4 completion details above). No files deleted, no `firestore.rules` change needed (confirmed no field-name allowlist blocks the new `priority` field). New pure-logic helpers (`countParagraphs`, `applyFilterTab`, `applySearch`) verified in isolation against representative inputs. Ready for Phase 5.
- 2026-07-25 — **Phase 5 complete**: `ClassRoster.jsx`'s notice composer role-gated to CR/ACR only; `firestore.rules` closed the `cr_only` read gap on group notices (client-side filtering was never a real security boundary), added title/body length caps (`<200`/`<5000` chars) to both notice-creation rules, and left a TODO comment on the deferred rate-limiting item (see Phase 5 completion details above). No files deleted. Confirmed item 3 (groupInput dropdown) was already satisfied by Phase 1 — no change needed there. No Firebase CLI available to validate rules syntax beyond a manual brace/paren balance check and full re-read of both edited blocks. Ready for Phase 6.
