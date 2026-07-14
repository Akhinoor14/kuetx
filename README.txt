KUETx — Updated files from this chat session
==============================================

Copy each file below into the SAME path in your project
(D:\Skill\Website\kuetx\...), overwriting the existing one.

1. firestore.indexes.json
   -> D:\Skill\Website\kuetx\firestore.indexes.json
   - Added the "deleteRequests" composite index (status ASC,
     requestedAt ASC) so it matches what's live and stops the
     CLI delete-index prompt.
   - REMOVED the "members" COLLECTION_GROUP composite index —
     Firebase rejected it with "this index is not necessary,
     configure using single field index controls" because a
     single-field lookup (just "uid") must be a field override,
     not a composite index.
   - ADDED a fieldOverrides entry for members.uid enabling
     COLLECTION_GROUP scope (same pattern as the existing
     roles.role override). This is what actually fixes the
     getStaffDisplayInfo lookup on /team.

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
After copying, run again:
  firebase deploy --only firestore:rules,firestore:indexes,functions

This time the members index goes through fieldOverrides, which
Firebase accepts immediately (no build wait like composite
indexes). Once deployed, /team should show real names/depts
instead of raw UIDs.
