KUETx — Worker auth fix (this session)
========================================

1. cloudflare-worker/src/index.js
   -> D:\Skill\Website\kuetx\cloudflare-worker\src\index.js

   Root cause fix for "Missing groupId" / Founder-not-recognized
   errors during upload (single AND batch — same bug, same fix).

   isFounder / isSCLFor / isCLFor / isHeadOfOps were calling
   Firestore's REST API with NO auth header. Your Firestore rules
   require isSignedIn() (and an exact uid match for admins/{uid})
   to read those docs, so the Worker's unauthenticated request was
   always rejected -> every role check silently returned false for
   everyone, regardless of actual role.

   Fix: the caller's Firebase ID token (already verified earlier in
   each handler) is now passed as a Bearer header on every one of
   these Firestore REST calls, so the rules see request.auth.uid
   correctly and grant read access when it matches.

--------------------------------------------------------------
After copying, redeploy the Worker:

  cd /d D:\Skill\Website\kuetx\cloudflare-worker
  npx wrangler deploy

Then retry both single-file and batch-folder uploads.

--------------------------------------------------------------
Note on "pause during upload": checked the codebase — there is
currently NO pause/resume control for uploads (single or batch).
If a batch upload is interrupted (tab closed, navigation, lost
connection), it simply stops with no way to resume from where it
left off. This is a missing feature, not something broken by
these changes — let me know if you want it built.
