# Services/Provider marketplace — Firestore Emulator rules tests

Closes the "no emulator tests" gap flagged in every phase of
`_services_provider_progress/PROGRESS.md`. Covers all three rule
surfaces this feature touches, in one suite (per Phase 2's own note that
these should be tested together, not separately):

- `providers/{uid}` + `providers/{uid}/contact/phone` (Phase 1, §3-4, §10)
- `services/{serviceId}` + `bookings/{bookingId}` + `activeBooking/{uid}`
  + `confirmedStudents/{uid}` (Phase 2, §2, §5-7, Gap 5/7/8, §10)
- `bookingAlerts/{uid}/items/{alertId}` (Phase 3 Part 2, §9)

## Running

Requires Node.js and the Firebase CLI (`npm i -g firebase-tools`, or use
`npx firebase-tools` below if you don't want a global install).

```bash
cd _services_provider_progress/emulator-tests
npm install
npm test
```

`npm test` runs `firebase emulators:exec --only firestore "mocha ..."` —
this starts a real Firestore emulator, points it at the actual
`firestore.rules` two directories up (not a copy), runs every test
against it, then tears the emulator down. No live Firebase project or
network access is used; everything runs locally.

If `firebase` isn't on your PATH, replace the `test` script's
`firebase emulators:exec` with `npx firebase-tools emulators:exec` in
`package.json`, or run:

```bash
npx firebase-tools emulators:exec --only firestore "mocha --timeout 20000"
```

## What's covered

- **Provider verification** — can't self-verify, can't self-assign
  `phone` onto the parent doc, rejected→pending resubmit works, only
  `isAdmin()` can flip to `verified`.
- **Phone gating (§10)** — owner reads their own number; Founder reads
  it; a student with a `confirmedStudents` marker reads it; a student
  without one is denied; a student can never write their own marker.
- **Service creation hard-gate** — only a *verified* provider can create
  a service, only for their own `providerUid`, only starting closed with
  zero revenue; `revenueTotal` can never be inflated directly by the
  provider.
- **Booking create-time gates, now server-side (Gap 5, Gap 7)** —
  booking a closed service, a disabled offering, or a second active
  booking on the same service are all rejected at the rules layer, not
  just the client.
- **Booking state machine (§7)** — every transition in the spec is
  tested for the correct actor; double-confirm (Gap 8) is rejected;
  terminal states can't be re-transitioned; cross-role student/provider
  reads are scoped correctly (§10 booking privacy).
- **bookingAlerts (§9)** — cross-write between student/provider works
  for legitimate pairs; forged alerts for uninvolved uids are rejected;
  only `read` can be updated post-write; another user can't read or
  delete someone else's alert.

## What's intentionally NOT covered here

- Client-side-only checks that PROGRESS.md documents as deliberate scope
  cuts rather than gaps — e.g. `hasConflictingConfirmedSlot` (§11 item 2,
  a UI nudge, not an enforced invariant by design) and
  `countStudentNoShowsOnService` (§11 item 1, informational only). These
  have no rules-layer behavior to test since they were never meant to be
  enforced server-side.
- `isAdmin()`'s exact claim-checking mechanism is assumed from this
  repo's existing pattern (`authenticatedContext(uid, { admin: true })`
  in the helpers at the top of the test file) — if the real `isAdmin()`
  implementation checks something else (a Firestore lookup rather than a
  custom claim, for instance), update `asAdmin()` here to match before
  trusting the admin-path results.
