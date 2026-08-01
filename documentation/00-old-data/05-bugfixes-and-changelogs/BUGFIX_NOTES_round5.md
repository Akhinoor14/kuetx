# Round 5 — Popup balance, honest correction

You were right to push on this — my last round's fix was incomplete.

## What I got wrong last time

I only fixed `shouldShowCommunityHiring` having no minimum delay on its
FIRST appearance, and staggered the three thresholds (2 / 3-9 / 7 days) so
they wouldn't all become eligible on the very next session after
onboarding. That handled the first-time collision only.

## The actual ongoing problem (this is what you were seeing)

Staggering the thresholds does nothing to stop RECURRING collisions. Once
someone has used the app for 10+ days, all three conditions
(announcement / community hiring / backup) end up independently true on
MANY sessions afterward — not just one. Every one of those sessions used to
queue all three at once: dismiss the announcement, community-hiring pops up
immediately, dismiss that, backup pops up immediately. Same session,
back-to-back, over and over on any day all three happened to line up. That
ongoing stacking — not just the first appearance — is what you meant.

## Real fix this time

Changed `if / if / if` to `if / else if / else if` — only ONE of these three
non-essential popups can ever be queued per session now, picked by a fixed
priority order (announcement > community hiring > backup). The other two
stay eligible in the background and simply get reconsidered on a later
session instead of firing back-to-back in the same one.

Confirmed this actually works end-to-end: the queue is only built once per
app load (`queueBuilt` guard), and `advance()` just pops the front item
without rebuilding — so with only one non-essential item ever entering the
queue in the first place, there's no way for a second one to sneak in after
the first is dismissed, same session.

## File in this bundle

```
src/App.jsx
```

## Suggested test

Manually set `announcementV2LastShown`, `communityHiringFirstEligibleAt`,
and `lastBackupTime` in devtools/IndexedDB to values far enough in the past
that all three should independently qualify, reload, and confirm only ONE
popup appears — not three in a row.
