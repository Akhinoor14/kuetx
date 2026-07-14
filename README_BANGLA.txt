KUETx Fix Bundle — Loading Hang + QB Upload Discoverability
=============================================================

Files (drop into your project at the SAME src/ paths):

  src/lib/safeSnapshot.js          [NEW] shared withTimeout()/safeOnSnapshot() helper
  src/lib/qbUploadRequests.js      onSnapshot error handlers added (index-building no longer hangs forever)
  src/lib/founderCategories.js     "Question Bank Uploads" tab label -> "Question Bank (Upload / Review)"
  src/components/QBReviewQueue.jsx shows a real error/warming-up message instead of infinite "Loading…"
  src/pages/AdminDashboard.jsx     all 5 stuck-risk listeners wrapped with withTimeout() + a visible
                                    "still loading" warning banner; qb-uploads tab now has a clear
                                    "Upload a paper" heading above the review queue
  src/pages/StaffDashboard.jsx     roles/RollUnlock/HeadOfOps listeners wrapped with withTimeout()

ROOT CAUSE (loading delay / stuck page):
  ~25 subscribeX() functions across the codebase call Firestore onSnapshot()
  with only a success callback — no error callback. If a composite index is
  still building (common right after `firebase deploy --only firestore:indexes`),
  offline, or a rules rejection happens, the listener errors ONCE and never
  fires again. Any `state === null` -> "Loading…" screen just hangs forever,
  which is exactly the "eshe abar chole jai" / stuck-loading symptom on both
  AdminDashboard and StaffDashboard.

  This bundle fixes the highest-traffic listeners (Founder + Staff dashboards'
  main tabs) with a 12s timeout fallback (src/lib/safeSnapshot.js's withTimeout).
  If Firestore hasn't responded in 12s, the state resolves to [] and a small
  warning banner explains why (usually: index still building, try again in
  a minute). The other ~20 subscribe*() functions (groupSync.js, facultySync.js,
  etc.) still have the same pattern but weren't touched this round — same fix
  pattern (wrap with withTimeout from safeSnapshot.js) applies to each.

ACTION YOU STILL NEED TO DO:
  firebase deploy --only firestore:indexes
  (then wait for the console link in the error to show "Enabled")

FOUNDER "UPLOAD TO ANY DEPT" UI:
  This already existed in the code (QBUploadForm isFounder + submitQBUpload's
  isFounderUpload flag, auto-approved/no review) — it just wasn't discoverable:
  Founder Dashboard -> Approvals -> "Question Bank (Upload / Review)" tab.
  The upload form is now labeled clearly above the review queue in that tab.
