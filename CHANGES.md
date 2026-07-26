# KUETx Fixes

## 1. src/pages/Profile.jsx — Blank space below name/bio on Profile page

The inner hero card (avatar + name + bio) reused the `content-page-bg`
class, which was also applied to the outer page wrapper. That class sets
`min-height: 100vh`, so the hero card itself was being forced to be at
least full-viewport-tall, even though its actual content only filled the
top portion — leaving a large empty green area below the bio.

Fix: added `minHeight: 0` inline on the hero card to override the
inherited `min-height: 100vh`, so it sizes to its content instead.

## 2. src/pages/StaffDashboard.jsx — Slow/unresponsive tab switching, navigation throttling

The `useEffect` that syncs the resolved active tab back to the parent
(`onTabChange?.(nextTab)`) had `onTabChange` in its dependency array.
`onTabChange` is `setActiveTab` from `useUrlTabState`, which is backed by
react-router-dom's `setSearchParams` — a function that gets a new
identity on every render. This caused the effect to re-run on essentially
every render, each time pushing a new `?tab=` history entry, which
triggered Chrome's "Throttling navigation to prevent the browser from
hanging" protection. Once throttled, real clicks (switching tabs, or
navigating to other pages) got delayed/dropped, making the whole
dashboard feel slow or unresponsive.

Fix: removed `onTabChange` from the effect's dependency array and only
call `onTabChange(nextTab)` when the resolved tab actually differs from
the current `activeTab`, so the effect no longer fires (and pushes
history) on every render.
