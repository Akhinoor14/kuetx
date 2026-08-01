# Round 3 — Profile Setup Loop, Email Verify Confusion, Popup Timing

## 1. "Profile setup shows again and again" — REAL BUG, ROOT CAUSE FOUND

`main.jsx` races `ensureDBReady()` (IndexedDB warm-up) against a 2-second
timeout, and renders the app either way:

```js
const dbInit = ensureDBReady();
const timeout = new Promise((resolve) => setTimeout(resolve, 2000));
await Promise.race([dbInit, timeout]);
```

If IndexedDB takes longer than 2s to open (slow device, first load, storage
pressure — not rare), the app renders with an EMPTY in-memory profile cache.
`App.jsx`'s `buildQueue()` used to run immediately once auth was ready,
calling `getProfile()` before the real data had finished loading from
IndexedDB — so it saw an incomplete/empty profile and pushed `'profile'`
back onto the onboarding queue, even though the actual saved profile
(including anything set afterward, like a photo) was sitting safely in
IndexedDB a moment away from finishing its load.

This is exactly the reported symptom: data really was saved, picture really
was set, but setup reappears anyway on a later open.

**Fixed:** `App.jsx` now awaits `ensureDBReady()` itself before building the
queue. `ensureDBReady()` is idempotent (instant no-op if already resolved),
so this costs nothing on a normal fast load and closes the gap on a slow one.

**This most likely also explains the Classmates page issue** — anything else
reading `getProfile()`/`getGroupId()` early during the same slow boot would
hit the same stale-empty-cache window. Worth retesting Classmates
specifically after this fix; if it's still wrong afterward, that's a
separate bug and needs its own trace.

## 2. Email verification — clarity fix, not a logic bug

Traced through `KuetEmailVerifyWidget.jsx` and both places it's embedded in
`ProfileSetupModal.jsx`. The actual verification mechanism (passwordless
magic link) is working as designed — the problem is real people don't
understand what's being asked of them:

- The widget asks for "just the name part" of the email but that instruction
  was buried in small text below the input, not explained up front.
- After sending, nothing told people clearly "now go check your email inbox
  and click the link there" as a numbered step — it just said a link was
  sent.
- The roll-conflict variant (shown when someone's roll number is already
  claimed by another account) had a vague, alarming heading — "নিজে নিজে
  ঠিক করো" ("fix it yourself") — with no explanation of WHY they're seeing
  this or what it means.

**Fixed:**
- Added a clear 3-step numbered mini-guide inside the widget itself
  (appears before the input, in both the roll-conflict and normal-verify
  contexts since it's the same widget in both places): type name part →
  press send → go check inbox and click the link.
- Replaced the vague "fix it yourself" heading with a direct explanation of
  what's happening: "this roll number is already used by someone else — to
  prove it's really yours."

No changes to `kuetEmailVerify.js` itself — verification remains the
Deviation 2 hard gate as designed, just explained better.

## 3. Popups all appearing at once

Checked `shouldShowAnnouncement`, `shouldShowCommunityHiring`,
`shouldShowBackup` in `App.jsx`. The first and third already had real
first-session deferral + time-based thresholds (3-9 days, 7 days). The
second (`shouldShowCommunityHiring`) only deferred until "the next app
open" with **no minimum elapsed time** — reopening the app minutes after
finishing onboarding (very normal for a PWA) would show it immediately.

**Fixed:** `shouldShowCommunityHiring` now requires a real 2+ day gap since
first becoming eligible, matching the spirit of the other two. Also added a
comment above all three calls in `buildQueue()` noting they're intentionally
staggered (2 / 3-9 / 7 days) so a future threshold change doesn't
accidentally re-align them and reintroduce the "everything at once" problem.

## Files in this bundle

```
src/App.jsx
src/components/KuetEmailVerifyWidget.jsx
src/components/ProfileSetupModal.jsx
```

## Suggested test

1. Fill out profile setup fully, including a photo (wherever that's set),
   fully close the app/browser tab, reopen — profile setup should NOT
   reappear. If your device/browser is fast this may have always worked;
   the bug is most visible on a slow reopen (throttle network/CPU in
   devtools to simulate, or test on an older phone).
2. Check Classmates page after step 1 to see if that's also fixed now.
3. Trigger the roll-conflict flow (or just read the copy) to confirm the
   new heading/step-by-step guide reads clearly.
4. Can't easily test the popup timing fix without waiting real days, but
   confirm the code change is present (`shouldShowCommunityHiring` requires
   `elapsedDays >= 2` now).
