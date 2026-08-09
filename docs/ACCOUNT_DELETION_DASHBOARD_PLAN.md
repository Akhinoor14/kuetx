# Account Deletion Dashboard — Plan

## What this is

A new sub-tab inside the existing Founder dashboard (Approvals category
— same place as CL Applications, CR Requests, Student Manual
Verification) that lists every pending `accountDeleteRequests/{uid}`
doc and lets the Founder resolve one with a single click, instead of
digging through the Firebase Console by hand.

## Why this is worth building (and why it wasn't automatic already)

`lib/accountDeletion.js` already deletes what a user can delete about
themself, and files `accountDeleteRequests/{uid}` for the rest — but
"the rest" (root `users/{uid}`, `students/{uid}`, and whichever of
`faculty`/`providers`/`activity`/`emailFlags`/`staff roles` exist for
that account) is locked to Admin-only in `firestore.rules`. The Founder
IS an Admin, so the Founder's own browser session already has delete
permission on every one of those collections — this dashboard is just a
UI for exercising a permission that already exists, not a new
permission grant. No rules changes needed beyond what's already live.

**One piece stays manual no matter what: the Firebase Auth user
itself.** The client SDK can only delete the *currently signed-in*
session's own Auth account — there is no client-side way for the
Founder's session to delete a *different* uid's Auth record. That needs
the Admin SDK (Cloud Functions), which this project isn't using (see
`docs/ACCOUNT_DELETION_PLAN.md` — Spark-permanent decision). So: **this
dashboard removes the Firestore-cleanup Console trips, not the
Authentication-tab trip.** Worth building anyway — the Firestore side is
most of the manual work (up to 7 collections to check per request vs.
1 Auth-tab lookup).

## What "Approve & Delete" actually does

For a given `accountDeleteRequests/{uid}` doc, one button:

1. Deletes `users/{uid}` (root doc — role, fcmTokens).
2. Deletes `students/{uid}` (profile: dept/batch/roll).
3. Deletes `faculty/{uid}` and its `private/verification` sub-doc, if
   the faculty doc exists.
4. Deletes `providers/{uid}` and its `contact/phone` sub-doc, if the
   provider doc exists.
5. Deletes `activity/{uid}` and its `moduleUsage/*` sub-collection, if
   the activity doc exists.
6. Deletes `emailFlags/{uid}`, if it exists.
7. Deletes every doc in `staff/{uid}/roles/*`, if any exist.
8. If the request's `pendingAdminCleanup` flagged a blocked CR/ACR
   group membership, deletes `groups/{groupId}/members/{uid}` too (the
   Founder is exempt from the "can't self-delete while CR/ACR" rule —
   that rule only blocks the *member themself*, `isAdmin()` already has
   its own unconditional delete branch there).
9. Updates the request doc: `status: 'completed'`, `resolvedAt`,
   `resolvedBy` (Founder's uid).

Existence is checked before each delete (`getDoc` first) rather than
blind-deleting every path — most accounts will only have 2-3 of these
docs (root + maybe one role-specific doc), so the rest are silent
no-ops rather than wasted writes.

**"Reject" isn't offered as an option here** — unlike CL Applications
or CR Requests, there's no legitimate reason to deny someone's own
account-deletion request once filed. If the Founder needs to stall one
(e.g. suspected abuse, or a CR who hasn't handed off yet), that's a
conversation outside the dashboard, not a button — the request just
sits pending until resolved.

## What the row displays

- Email + uid (so the Founder can cross-reference the Auth tab
  afterward).
- `requestedAt` (relative time, e.g. "3 days ago").
- The exact list from `pendingAdminCleanup` on that request doc — the
  Founder sees precisely what's left before clicking, no guessing.
- A visible flag if `pendingAdminCleanup` mentions the CR/ACR-blocked
  case, since that one needs the extra members-doc delete step (#8
  above) and is worth a second look before approving.

## After "Approve & Delete" — what's still manual

A one-line reminder stays visible after a request is marked
`completed`: *"Firestore data cleared. Still needed: delete the Auth
user for this email in Console → Authentication."* Not automatable
without Blaze — see `docs/ACCOUNT_DELETION_PLAN.md`.

## Where it lives

- New subcategory in `lib/founderCategories.js`'s `approvals` entry:
  `{ key: 'account-deletion', label: 'Account Deletion', getCount: ... }`
  — same shape as `manual-verify`/`qb-uploads` siblings.
- New functions in `lib/accountDeletion.js` (or a small new
  `lib/accountDeleteRequests.js` mirroring `manualVerifyRequests.js`'s
  shape): `subscribeAccountDeleteRequests(callback)` and
  `resolveAccountDeleteRequest(requestId)`.
- New `subTab === 'account-deletion'` block inside `ApprovalsView` in
  `pages/AdminDashboard.jsx`, following the exact same
  `Section`/loading-state/`EmptyState` pattern as the other Approvals
  sub-tabs already there.

## Firestore rules — already sufficient, no changes needed

`accountDeleteRequests/{requestId}` already allows:
- `read`: Admin/HeadOfOps, or the requester themself.
- `update`: Admin/HeadOfOps only — exactly what setting `status:
  'completed'` needs.

The target collections (`users`, `students`, `faculty`, `providers`,
`activity`, `emailFlags`, `staff/*/roles/*`, `groups/*/members/*`)
already grant `isAdmin()` delete, per `docs/ACCOUNT_DELETION_PLAN.md`'s
tables. Nothing in `firestore.rules` needs to change for this
dashboard — it's purely a client UI built on permissions that already
exist.

## Status

Built. `lib/accountDeleteRequests.js` (subscribe + resolve, reusing
`adminDeleteFaculty`, `adminDeleteProvider`, and `removeRole` rather
than raw deletes — see that file's header for why each of those
specifically), the `account-deletion` subcategory in
`lib/founderCategories.js`, and the corresponding tab in
`ApprovalsView` (`pages/AdminDashboard.jsx`) are all in place and build
cleanly.

One deviation from the original plan worth noting: `faculty/{uid}`'s
`classIndex` and `meetings` sub-collections are NOT deleted by "Approve
& Delete" — `firestore.rules` scopes both to owner-only
(`request.auth.uid == uid`), with no Admin branch, so even the
Founder's session can't reach another account's docs there. This
matches an existing, already-accepted limitation in
`adminDeleteFaculty()` (`facultySync.js`), not a new gap introduced
here. Left as small harmless orphans (unreadable by anyone once the
parent `faculty/{uid}` doc is gone).
