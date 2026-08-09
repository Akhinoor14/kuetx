# Account Deletion — Spark-Permanent Scope

**Decision (final): this project stays on Firebase Spark (free plan)
permanently.** No credit/postpaid card available for Blaze billing, and
that isn't changing. Cloud Functions deploy requires Blaze, so
`functions/index.js`'s `deleteMyAccount` callable will **never run** —
it is dead code, kept in the repo only as a reference for what a
"delete everything in one atomic server-side call" implementation looks
like, in case a future maintainer with billing access wants it. Nothing
in the client calls it, and nothing should.

Everything below describes the **actual, permanent** account-deletion
design: a client-side delete of whatever `firestore.rules` already lets
an owner delete, plus a manual-review queue for the rest. This is not a
stopgap waiting on Blaze — this is the real solution for this project.

## Why this isn't just a code gap

`firestore.rules` locks deletion down deliberately across most
collections — `allow delete: if false` or Admin/HeadOfOps-only, not an
oversight. Reasons documented inline in the rules file: audit trails
(`staffRoleHistory`, `manualVerifyRequests`) must survive even if the
account that triggered them is gone; `activity/{uid}` (usage tracking)
being self-deletable would let anyone erase their own usage stats;
`students/{uid}` and `users/{uid}` being self-deletable was never
designed for, since nothing before this feature ever needed it.

Opening owner-delete on all of these just to avoid a manual-review step
would widen the attack surface app-wide. Not worth it — the scoped
request-queue approach below is safer and needs no further rules
changes beyond what's already deployed.

## What the client CAN delete itself (current rules, already live)

Firestore delete permission the *owner* already has, right now:

| Path | Rule | Notes |
|---|---|---|
| `users/{uid}/data/{key}` | owner write (delete included) | personal store: Notes, Diary, Wallet, Settings, Schedule, etc. |
| `users/{uid}/meta/{docId}` | owner read/write | profile picture meta |
| `bookingAlerts/{uid}/items/{alertId}` | owner delete | booking notification inbox |
| `bloodDonors/{uid}` | owner delete | blood bank directory entry |
| `groups/{groupId}/members/{uid}` | owner delete, **only if `role == 'member'`** | CR/ACR must step down first (`handoffCR`/`requestLeaveCR`) — rules explicitly block a CR/ACR from self-deleting their membership doc |
| Firebase Auth user itself | `auth.currentUser.delete()` | not currently called — see "Auth user deletion" below for why |

This is what `lib/accountDeletion.js`'s `deleteMyAccount()` actually
does, in full, every time it runs. No Cloud Function involved, none
needed.

## What only a Founder can finish, by hand, in the Firebase Console

| Path | Rule | Why it's locked to Admin |
|---|---|---|
| `users/{uid}` | `allow delete: if false` | root role/fcmTokens doc — no delete path exists at all, for anyone, even Admin |
| `students/{uid}` | `allow delete: if false` | profile (dept/batch/roll) — same, unconditional |
| `faculty/{uid}` (+ `private/verification`) | Admin only | verification/audit concerns |
| `providers/{uid}` (+ `contact/phone`) | Admin only | marketplace listing, Admin-gated by design |
| `activity/{uid}` (+ `moduleUsage/*`) | Admin only | usage-tracking heartbeat, self-delete would let anyone erase their own analytics |
| `emailFlags/{uid}` | Admin/HeadOfOps only | moderation flag record |
| `staff/{targetUid}/roles/{roleId}` | Admin only | staff role assignment, deliberately not self-revocable |
| `groups/{groupId}/members/{uid}` while `role` is `'cr'` or `'acr'` | blocked | must hand off / step down first |
| The Firebase Auth user itself | needs Admin SDK | client SDK can only delete the *currently signed-in* session's own user, and only with a recent login — deleting a *different* uid's Auth account (e.g. resolving someone else's queued request later) is only possible via Admin SDK, which means Cloud Functions, which means Blaze. Not happening. |

This list is permanent, not a waiting-on-Blaze list. `users/{uid}` and
`students/{uid}` having `if false` in particular means **no amount of
billing upgrade changes this without also editing the rules file** —
Blaze wouldn't have fixed those two rows anyway; only a Cloud Function
with Admin SDK (bypasses rules entirely) or a deliberate rules change
would. Worth remembering if this ever comes up again: "just enable
Blaze" was never a complete fix for the `if false` rows either — a
Cloud Function was always required for those regardless.

### Auth user deletion, specifically

`auth.currentUser.delete()` exists and could self-delete a signed-in
account's own Auth record without any Blaze/Admin SDK requirement — but
`lib/accountDeletion.js` doesn't call it, on purpose: the Firestore
`accountDeleteRequests/{uid}` doc is written using the still-signed-in
session (needs `request.auth.uid == requestId` at create time — see
`firestore.rules`), and deleting the Auth user first would sign the
session out mid-function, potentially before that write lands. Auth
deletion is left to the Founder doing manual cleanup, at the same time
as the rest of the Console work, not attempted client-side at all.

## The permanent design: request queue for the Admin-only part

`lib/accountDeletion.js`'s `deleteMyAccount()` does, every time:

1. **Deletes immediately, client-side** — everything in the "CAN
   delete" table above.
2. **Writes one doc** to `accountDeleteRequests/{uid}` — status
   `'pending'`, listing exactly which collections still need clearing
   (mirrors `manualVerifyRequests.js`'s existing request-queue pattern)
   — for everything in the "Founder must finish" table.
3. Clears local storage and signs out.

The person is told plainly (see `DeleteAccountModal.jsx`'s copy) that
their personal data and this device are cleared immediately, and that
full account removal is a *request* a Founder completes afterward —
not an instant, fully-automatic delete. That's the honest, permanent
behavior of this feature, not a temporary caveat.

**Resolving a request (Founder's manual steps, Firebase Console):**
1. Open `accountDeleteRequests`, find a `status: 'pending'` doc.
2. Delete the docs listed in `pendingAdminCleanup` on that doc
   (`users/{uid}`, `students/{uid}`, and whichever of
   `faculty`/`providers`/`activity`/`emailFlags`/`staff roles` actually
   exist for that uid — most accounts will only have a few of these).
3. Go to Authentication tab, delete the Auth user by uid/email.
4. Back in Firestore, update the request doc's `status` to
   `'completed'` (optional bookkeeping — rules allow Admin to update it,
   nothing currently reads this field back, but keeping it accurate
   costs nothing and helps if a review UI gets built later).

## Follow-up work (optional, not currently planned)

- **Founder-side review UI** for `accountDeleteRequests` — would turn
  the 4 manual Console steps above into one in-app click for the
  Firestore-side cleanup (Auth deletion would still need the Console
  regardless, self-delete-only limitation described above). Worth
  building only if request volume ever makes the manual Console
  workflow genuinely painful — for KUETx's likely scale (a handful of
  deletions a month at most), it probably never will be.
- **Re-signup handling for a pending-delete account** — if the same
  Gmail signs in again before a queued request is resolved,
  `RoleSelectScreen`/`buildQueue()` don't currently check
  `accountDeleteRequests/{uid}` status. It'll likely just resume
  wherever the old (partially-cleared) account left off, which is
  confusing but not data-unsafe (the sensitive Admin-only collections
  are still there, would just look like a return visit). Low priority
  given how rarely both conditions (delete requested AND same email
  re-used before Founder resolves it) would coincide in practice.

## What NOT to do

- Do not re-open the Blaze conversation as a way to "finish" this
  feature — that door is closed for this project. `functions/index.js`'s
  `deleteMyAccount` is reference code, not a to-do item.
- Do not loosen `firestore.rules` on `users/{uid}`, `students/{uid}`,
  `faculty/{uid}`, `providers/{uid}`, `activity/{uid}`,
  `emailFlags/{uid}`, or `staff/*/roles/*` to make this "fully
  self-service" — that trade (see "Why this isn't just a code gap"
  above) was deliberately not taken, and remains not worth taking.
