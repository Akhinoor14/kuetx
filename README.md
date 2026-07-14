# KUETx fixes — Team & Administration / Staff & Roles round

## 1. "Assign a Role" ↔ "Current Holders" chips not switching — FIXED

**File:** `src/pages/AdminDashboard.jsx`

**Root cause:** In `StaffRolesView`, the pill row was wired as:
```js
<SubcategoryTabs subcategories={category.subcategories} activeKey="holders" onSelect={() => {}} countCtx={subCtx} />
```
`activeKey` was a hardcoded literal string, and `onSelect` was a no-op function. Clicking either pill did nothing — both the "Assign a staff role" and "Current role holders" sections were always rendered together underneath, regardless of which pill was "active" (which itself never actually changed).

**Fix:** Added real `subTab` state (`useState('assign')`), wired the pill row to it (`activeKey={subTab} onSelect={setSubTab}`), and gated each section behind `subTab === 'assign'` / `subTab === 'holders'` so they now show one at a time and the pills genuinely control what's visible.

## 2. Staff & Roles showing raw UIDs instead of names — FIXED

**Files:** `src/lib/staffSync.js`, `src/lib/groupSync.js`

**Root cause:** `getStaffDisplayInfo(uid)` tried to resolve a name via:
```js
query(collectionGroup(db, 'members'), where(documentId(), '==', uid))
```
`documentId()` in a Firestore **collectionGroup** query requires the full document path (e.g. `groups/2K23_ESE/members/abc123`), not a bare uid. This is exactly the console error you saw: *"the value provided must result in a valid document path, but 'XWgrt4iLILX0RT3dp3kaghXl9Fk1' is not because it has an odd number of segments (1)."* This lookup failed 100% of the time, silently fell back to an empty name, and the UI showed the raw uid instead.

**Fix, two parts:**
1. `groupSync.js`'s `joinGroup()` now also writes a plain `uid` field onto every member doc (on both create and update), in addition to it already being the doc ID. This self-heals existing docs the next time that student opens the app (their `joinGroup()` re-runs and updates the doc).
2. `staffSync.js`'s `getStaffDisplayInfo()` now queries `where('uid', '==', uid)` instead of `documentId()` — a normal field-equality query, which collectionGroup queries handle natively. It now also returns `dept`, `batch`, `groupId`, `verified`, and `memberRole` (previously only `name`/`roll`), used by the new detail popup below.

**Note:** since this relies on the member doc being updated at least once after this deploy, a staff holder who hasn't opened the app since this fix went live will still show as a raw uid until their next login. This resolves itself automatically — no manual backfill script needed, but it's not instant for 100% of existing holders.

## 3. Staff holder detail popup — ADDED

**File:** `src/pages/AdminDashboard.jsx`

Tapping a name in "Current role holders" now opens a modal (`StaffHolderDetailModal`) showing:
- Staff position (role label)
- Scope (department or class)
- Roll, Department, Batch, Class (groupId)
- Class-level role (CR / ACR / Member), if they're a group member
- Verified status
- UID

**What's NOT included:** a "log/activity history" section, as you asked about. There is currently no per-person activity log anywhere in the app — the only audit trail that exists is `groups/{groupId}/auditLog`, which records routine/assignment entry edits, not staff-role assignment history. Rather than fabricate a fake history section, I left it out. If you want real history, we'd need to add a write to a new log collection every time `assignRole`/`removeRole` runs (in `staffSync.js`) — that's a small, doable follow-up if you want it, just say so.

## 4. Mobile roster row overlap — strengthened fix

**File:** `src/index.css`

Your screenshot still showed the roll number sitting close against the button row on mobile. Strengthened the existing mobile CSS (from the previous round) with:
- Explicit `margin-bottom` on the name/roll block before the button row wraps below it
- A visible top border + padding separating the two wrapped sections
- `flex-wrap` on the button row itself too, so long button labels (Revoke/Make CR/Remove from class) wrap onto their own lines with row-gap instead of just shrinking

If this is still visually off after deploying, it's worth double-checking the deployed build actually includes the previous round's CSS — the original overlap fix (`.classmates-list-card` rules) should already have been present but the screenshot suggested otherwise.

## 5. Console error: missing Firestore index — index definition added, needs deploy

**File:** `firestore.indexes.json`

The console showed: *"The query requires an index... manualVerifyRequests..."* — this is `manualVerifyRequests.js`'s `where('status', '==', 'pending').orderBy('requestedAt')` query, which needs a composite index that didn't exist yet.

Added the index definition to `firestore.indexes.json`:
```json
{
  "collectionGroup": "manualVerifyRequests",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "requestedAt", "order": "ASCENDING" }
  ]
}
```

**This requires a deploy to take effect** — adding it to the file alone doesn't create the index on Firebase's servers. Run:
```
firebase deploy --only firestore:indexes
```
Or click the link directly from the console error (`https://console.firebase.google.com/v1/r/project/kuetx-8a184/firestore/indexes?create_composite=...`) which does the same thing without needing the CLI.

## Not touched — needs your call

The 3-second-interval error retry loop in the console log (`Uncaught Error in snapshot listener` repeating every few seconds) will stop on its own once the index above is deployed — the manual-verify-requests listener has been failing and silently retrying this whole time, which is also unrelated to app performance (it's a background admin-only listener), but it's noisy in the console.
