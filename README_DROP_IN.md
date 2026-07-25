# CR-Approval Migration — verified drop-in files

Extract this directly over your project root — paths match exactly, it
overwrites 11 files. Nothing else in the project is touched.

## What I actually did before packaging this

I did not just trust the handoff doc's claims. I extracted the real
project, read every file involved, and checked ground truth:

- Confirmed the `members/{memberUid}` `create` rule blocker (the one
  thing the handoff doc flagged as "must fix before production") is
  genuinely fixed — self-join branch removed, new CR/ACR-approves
  branch requires a matching `pending` `joinRequests` doc, CL-vacant
  bootstrap path preserved in its own branch.
- Confirmed `approveJoinRequest()`'s actual batch write in
  `groupSync.js` matches exactly what the new rule branch expects
  (`role: 'member'`, `verified: true`).
- Confirmed the `meta/crStatus` and `meta/clStatus` read-rule bugs
  (which silently broke `NoCRBanner` and `ClaimCRCard` for the exact
  non-member audience that needed them) are fixed.
- Confirmed `NoCRBanner.jsx`'s dead `/setup` pathname check was
  actually removed and replaced with a correct guard (`/profile` only).
- Checked the handoff doc's "remaining work" checklist item by item
  against the real files — items #2 (join-status card) and #3 (leave
  class UI) were listed as "not yet built" but are in fact already
  built: `JoinStatusCard.jsx` exists and is mounted in `Profile.jsx`;
  `leaveGroup()` has a working UI button with a confirmation dialog,
  correctly hidden for CR/ACR.
- Grepped the whole `src/` tree for stray `joinGroup(` self-join calls,
  stray `verified: true/false` writes outside the legitimate files, and
  misleading "auto-join"/"invite link" copy — none found.
- Ran an actual `npm install` + `npx vite build` (not just a babel
  syntax check) — clean build, no errors.

## Files in this zip

```
firestore.rules
src/lib/groupSync.js
src/App.jsx
src/components/ClassJoinIntro.jsx
src/components/ClaimCRCard.jsx
src/components/JoinRequestsPanel.jsx
src/components/ClassNoticesPanel.jsx
src/components/ClassNoticeFeed.jsx
src/components/NoCRBanner.jsx
src/components/JoinStatusCard.jsx
src/pages/ClassRoster.jsx
src/pages/Profile.jsx
```

## Still genuinely open (not code bugs — separate follow-up work)

1. `otpVerify.js` cleanup was intentionally not touched — it's not
   confirmed yet whether it's fully separate from `kuetEmailVerify.js`/
   `rollOwnership.js`. Don't remove anything there without reading
   `functions/index.js`'s OTP Cloud Functions first.
2. No end-to-end test against a real Firestore emulator/staging project
   yet (join → approve → notice unlock → leave → rejoin-needs-approval).
   The rules logic and client code match each other on inspection and
   the build is clean, but nobody has clicked through it live yet.
3. `JoinRequestsPanel.jsx` mobile layout wasn't explicitly re-tested,
   though it reuses `ClassRoster.jsx`'s existing mobile-safe patterns.

Deploy `firestore.rules` to a staging project (or the emulator) before
production, same as any rules change — that's normal practice, not a
sign anything here is unfinished.
