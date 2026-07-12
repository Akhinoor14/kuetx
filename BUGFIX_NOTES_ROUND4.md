# Round 4 — Direct Answers

## "duita email bound hoye jache firestore e" (two emails getting bound)

Traced `kuetEmailVerify.js` fully. This is NOT a new bug — it's a documented,
intentional design choice already explained in that file's own top comment
(lines 47-55):

> `verifiedRolls/{roll}` is keyed by roll number only, not bound to a
> specific uid or email.

So the Firestore doc itself (`verifiedRolls/{roll}`) only ever stores one
field, `verifiedAt` — it cannot show "two emails," because it never records
an email at all, by design, on purpose.

**What you're likely actually seeing**: every successful magic-link click
creates/reuses a Firebase Auth *user* under the secondary `kuetVerify` app,
one per email address that ever got clicked-through. If someone (or you,
testing) sent and clicked links for two different name-part guesses before
landing on the right one, you'd see two Auth users in that secondary app's
user list — that's expected, not a leak, since neither becomes "the"
identity for anything; only the `verifiedRolls/{roll}` doc matters
downstream and it just says "verified: yes/no" per roll.

I could not find a code path where verifying one roll accidentally verifies
or overwrites a DIFFERENT roll — `buildKuetEmailFromProfile` always embeds
`profile.studentId` directly into the constructed email, so the roll being
verified is always exactly whatever roll was in the profile at send-time.

**If what you're actually seeing is different from this** (e.g. the SAME
roll ending up associated with two different names, or one account's
verification showing under another account's roll) — that would be a real
bug and I need the specific roll/email pair you're looking at in the
Firestore console to trace it further. Please share that if this
explanation doesn't match what you're seeing.

## Profile page — does it show setup status / does data show correctly?

Found a REAL bug here, same family as the App.jsx one from before.

`Profile.jsx` does `useState(getProfile() || DEFAULT_PROFILE)` — this only
reads the profile ONCE, at the exact instant the page first mounts. If
IndexedDB was still warming up at that moment (same root cause as the
profile-setup-loop bug), Profile.jsx would get stuck showing the
empty/partial snapshot from that instant FOREVER — it never re-read, even
after the real data finished loading a second later. This is a second,
separate casualty of the same underlying timing gap, in a different file
than the one already fixed.

**Fixed:** added a listener for the `kuetx:store-updated` event (which
store.js already fires on every write, AND once when the DB finishes
warming up) that re-reads `getProfile()` and updates state. This was a
one-line gap — the event existed and fires correctly, Profile.jsx just
wasn't listening to it.

Checked every other page for this same `useState(getProfile()...)` pattern
— Profile.jsx was the only other one besides App.jsx. Nothing else in the
codebase reads the profile this same risky way.

## Store — thik ache ki na (is it okay)?

The store itself (`store.js`) is fundamentally sound — IndexedDB with a
localStorage sync-fallback and an in-memory cache, writes go to all three
correctly, `set()` really does persist. The actual problem was never the
store's write path — it was that TWO consumers (App.jsx's queue-builder,
Profile.jsx's initial state) read from it too early, before the DB had
finished its async warm-up, and neither one re-checked afterward. Both are
now fixed. I don't see other callers with the same specific mistake.

## Faculty module — sob thikthak (everything okay)?

Checked specifically whether my App.jsx fix (awaiting `ensureDBReady()`
before `buildQueue()`) could have broken anything on the faculty branch —
it doesn't; `getAccountRole()` (which decides student-vs-teacher routing) is
called *inside* `buildQueue()`, so it's now protected by the same fix rather
than at risk from it. `isFacultyProfileComplete()` reads from a Firestore
doc passed in directly, not from local cache, so it was never exposed to
this bug in the first place. Faculty Phase 1-5 pieces (verify, sync,
useIsFaculty, RequireFaculty, Classes, Schedule, Tools route, Admin
directory redesign, Founder switch relocation) are all still structurally
intact — nothing in this round touched any faculty-specific file.

## "age ja ja bolechilo shob korcho to?" (did you do everything asked before?)

Going back through every round honestly:

- ✅ Faculty module Phase 1 foundations — done
- ✅ Faculty email testing bypass (`guluvai479@gmail.com`) — done, spelling
  corrected when you flagged it
- ✅ Vercel build fixes (noticeFormat import, BlueTick import) — done
- ✅ My Classes / Schedule "everything selectable" + "looks empty" bugs
  (missing Firestore rules for classIndex, batch/term plausibility warning)
  — done
- ✅ Tools page missing route — done
- ✅ Founder switch relocated to Admin dashboard — done
- ✅ Total Teachers directory redesign — done
- ✅ Profile setup loop root cause (App.jsx DB-await race) — done
- ✅ Email verify UX clarity (3-step guide, clearer roll-conflict heading)
  — done
- ✅ Popup staggering (community hiring had no real delay) — done
- ✅ Profile.jsx stale-snapshot bug (this round) — done
- ⚠️ Classmates page — I fixed the most likely shared root cause (the
  App.jsx DB-await race) but never got a chance to verify Classmates
  specifically against your real data, since I don't have live access to
  your Firestore. This is the one item I can't honestly mark as fully
  confirmed — please retest it now that both App.jsx and Profile.jsx are
  fixed and tell me if it's still wrong.

## Files in this bundle

```
src/pages/Profile.jsx
```
(App.jsx from the previous round is unchanged since then — no need to
re-send it, use the version from kuetx_bugfix_round3.zip.)
