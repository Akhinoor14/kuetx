KUETx — Updated files from this chat session
==============================================

Copy each file below into the SAME path in your project
(D:\Skill\Website\kuetx\...), overwriting the existing one.

1. firestore.indexes.json
   -> D:\Skill\Website\kuetx\firestore.indexes.json
   Added the missing composite index for the "deleteRequests"
   collection (status ASC, requestedAt ASC) so it matches what's
   already live on Firebase and stops the CLI delete-index prompt.

2. src/nav.js
   -> D:\Skill\Website\kuetx\src\nav.js
   Reorganized the "Campus Life" group into two subgroups:
     - "Campus Life": Clubs, Projects, Tours, Money, Tuition,
       Notes, Time Tracker, Namaz Tracker
     - "Self Study": Academic, Deep Focus
   Removed the old standalone "Daily Life" and top-level "Self
   Study" groups (fixes the "This section isn't available" bug
   on /daily-life). Simplified NAV_MOBILE since desktop/mobile
   nav is now identical.

3. src/App.jsx
   -> D:\Skill\Website\kuetx\src\App.jsx
   Removed the dead /daily-life hub route. Updated /self-study
   route to point at the new Self Study subgroup inside Campus
   Life. Leaf routes (/notes, /time, /namaz, /self-study/academic,
   /self-study/deep-focus) are unchanged.

4. src/components/nav-system/SidebarNavStudent.jsx
   -> D:\Skill\Website\kuetx\src\components\nav-system\SidebarNavStudent.jsx
   Comment-only fix (no logic change) — corrected a stale comment
   that described the old desktop/mobile Self Study split.

--------------------------------------------------------------
Still needed on your end (not a code change):
Re-run `firebase deploy --only firestore:indexes` and let it
finish without interrupting, so the "members" COLLECTION_GROUP_ASC
index actually builds. That's why staff cards on /team were
showing raw UID instead of name/dept.
