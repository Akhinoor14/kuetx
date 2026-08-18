# Faculty Module — Current Status

> **এই ফাইলটাই এই ফিচারের একমাত্র active doc। নতুন কাজ/আপডেট হলে নতুন
> ফাইল না বানিয়ে এই ফাইলটাই এডিট করবে।**
>
> পুরনো raw প্ল্যান/বাগফিক্স ফাইলগুলো সরিয়ে রাখা আছে:
> [`documentation/00-old-data/03-features/faculty-module/`](../../00-old-data/03-features/faculty-module/)

---

## ফিচার কী

Faculty-দের জন্য পূর্ণাঙ্গ পোর্টাল: profile, class management, schedule,
notices, admin-driven verification flow।

## এখন পর্যন্ত যা হয়েছে

- পূর্ণ faculty পোর্টাল তৈরি (profile, class management, schedule,
  notices, verification)
- Admin-only verification flow বাস্তবায়িত (আগের dead auto-approval কোড
  বাতিল করে)
- `RequireFaculty` / `RequireVerifiedFaculty` route guard যোগ হয়েছে
- Faculty dashboard: stat cards + auto-rotating per-course widget
- Unverified faculty-দের জন্য "Get Verified" কার্ড
- Role Select overlay bug ও "Continue does nothing" রুটিং বাগ ফিক্স হয়েছে
- **[নতুন] Official KUET directory auto-verify যোগ হয়েছে** —
  `scripts/kuet_faculty_scraper.py` (GitHub Actions cron দিয়ে দৈনিক
  auto-run, `.github/workflows/kuet-faculty-scrape.yml`) KUET-এর
  department faculty page থেকে নাম/designation/dept/email scrape করে
  `facultyDirectory/{email}`-এ push করে। Faculty signup-এর সময়
  `src/lib/facultyDirectoryMatch.js` এই directory-র সাথে name+email
  match করে দেখে; মিললে `manualVerifyRequests.js`-এর
  `ensureManualVerifyRequest` pending request বানানোর বদলে সরাসরি
  verified করে দেয় (`verifiedFacultyEmails` + `faculty/{uid}.verifiedAt`),
  request row-টা তখনও `status: 'approved', autoVerified: true` হিসেবে
  থেকে যায় Founder-এর audit/override-এর জন্য। **conscious product
  decision** — নিচের ⚠️ সেকশনের ম্যাগিক-লিংক removal-এর সাথে conflict
  করে দেখতে পারে, কিন্তু এটা সেই decision-কে ইচ্ছাকৃতভাবে override করা,
  ভুলে ফিরিয়ে আনা না।

## ⚠️ Outdated/superseded তথ্য (পুরনো ফাইলে ছিল, এখন আর প্রযোজ্য না)

- **Faculty magic-link verification সম্পূর্ণ সরিয়ে dead code হিসেবে বাদ
  দেওয়া হয়েছে।** পুরনো `BUGFIX_FACULTY_VERIFY_CROSS_DEVICE.md` ফাইলে
  magic-link ভিত্তিক verification fix নিয়ে আলোচনা আছে — সেটা এখন আর
  বর্তমান verification flow-এর সাথে মেলে না। রেফারেন্স হিসেবে
  old-data-তে রাখা আছে, কিন্তু নতুন কাজে এটা অনুসরণ কোরো না। **নোট:**
  এই ফাইলের "manual-only, no auto-verify" সিদ্ধান্তটা এখন partially
  superseded — উপরের নতুন directory auto-verify feature-টা একটা নতুন,
  স্বতন্ত্র trust source (KUET-এর নিজস্ব official directory) থেকে
  আসছে, পুরনো ভাঙা magic-link mechanism থেকে না।
- **Security gap — narrowed (Phase 2, defense-in-depth), root cause still open:**
  `verifiedFacultyEmails` collection-এর write rule আগে ছিল
  `allow write: if isSignedIn()` — যেকোনো signed-in account (student সহ)
  **যেকোনো ইমেইল-এর জন্য** সরাসরি লিখতে পারত, directory match ছাড়াই।
  এখন rule tighten করা হয়েছে: শুধু Admin (manual-approval path,
  অন্য কারো email-এর জন্য লেখে) অথবা signed-in user নিজের
  `request.auth.token.email`-এর সাথে মিলে এমন doc (auto-verify path,
  নিজের email-এর জন্য লেখে) লিখতে পারবে। **এটা পুরোপুরি resolved না** —
  একজন malicious/compromised faculty session এখনো নিজের email-এর জন্য
  ভুয়া `autoVerified: true` doc লিখতে পারে directory-তে আসল match ছাড়াই,
  কারণ directory-match validation টা এখনও শুধু client JS-এ
  (`facultyDirectoryMatch.js`)। যেটা বন্ধ হয়েছে সেটা হলো এক account
  অন্য কারো email-এর জন্য claim লেখার সুযোগ। আসল fix-এর জন্য এখনো
  server-side (Cloud Function) validation লাগবে, যেটার জন্য Blaze plan
  দরকার — এই প্রজেক্ট Spark (free)-এ থাকার সিদ্ধান্ত নিয়েছে।

## সর্বশেষ অবস্থা

Verification flow, guards, dashboard — সব স্থিতিশীল। Directory
auto-verify যোগ হয়েছে এবং CSE-এর জন্য selector real page HTML দিয়ে
verify করা হয়েছে (unit-tested, কাজ করে)। বাকি ১৯টা department একই
template ব্যবহার করে ধরে নেওয়া হচ্ছে (একই KUET CMS) — deploy করার আগে
অন্তত ২-৩টা ভিন্ন department page (যেমন EEE, ME) চোখে দেখে নিশ্চিত করা
ভালো, hard-crash না করলেও কোনো department-এর template একটু আলাদা হলে
সেটার teacher বাদ পড়ে যেতে পারে চুপচাপ। `iict`/`idm`/`iept` institute
তিনটার url pattern এখনো আলাদা করে verify করা হয়নি। নতুন কোনো কাজ হলে এই
সেকশনে যোগ করো।

---

## CR ↔ Teacher Linking (CR_TEACHER_LINKING_NOTES.md, Phase 0–5)

**পূর্ণ বিস্তারিত ইতিহাস/reasoning `CR_TEACHER_LINKING_NOTES.md`-এ আছে
(root-এ) — এইটা সেটার সংক্ষিপ্ত, স্থিতিশীল সারাংশ।**

### কী তৈরি হলো

তিনটা আলাদা "টিচার" রেকর্ড সিস্টেম (`routineEntries.teacherName` free
text, `faculty/{uid}`+`facultyAssignments` real account, `groups/{groupId}
/teacherProfiles` CR-লেখা ডিরেক্টরি-লিংক) — এর মধ্যে প্রথম দুইটাকে
consent-based identity link দিয়ে জোড়া লাগানো হয়েছে, সময়/স্লট ডেটা
merge না করে।

- **নতুন collection:** `groups/{groupId}/teacherLinkRequests/{id}` —
  দুই দিক (`cr_to_teacher`, `teacher_to_cr`), প্রতিটা নিজস্ব create/read/
  update/delete rule দিয়ে গার্ড করা।
- **Matching:** মূল, আগে থেকেই কাজ করা fuzzy name-match
  (`facultyDisambiguation.js`: routineEntries.teacherName ↔
  facultyAssignments.displayName/gridAlias) ব্যবহার করা হয়েছে — নোটের
  original email-anchor প্ল্যান (`teacherProfiles.directoryEmail`) বাদ
  দেওয়া হয়েছে, কারণ সেটা কখনো routineEntries-এর সাথে connected ছিল না।
- **CR → Teacher:** `TeacherClaimBanner.jsx` (Schedule.jsx-এ mount করা) —
  match দেখায়, "Invite this teacher" চাপলে real request লেখে, accept
  হলে CR-এর client `linkedFacultyUid`/`linkedAssignmentId` লেখে
  routineEntries-এ।
- **Teacher → CR:** `FacultyClassDetail.jsx`-এ "Link to Class
  Representative's grid" card — একই প্যাটার্নের উল্টো দিক।
- **Grid-এ verified badge:** `Schedule.jsx`-এর `LinkedTeacherBadge` —
  green BlueTick variant, ক্লিক করলে real profile name + (CR/ACR-only)
  marks-submission count summary popover দেখায়। CR-এর free-text
  `teacherName` সবসময় primary label থাকে, কখনো replace হয় না।
- **Decline policy:** "manual only" — decline করলে passive
  auto-suggest বন্ধ হয় (`wasDeclinedFor`), কিন্তু explicit re-invite/
  re-propose সবসময় সম্ভব, কোনো write কখনো ব্লক হয় না।
- **Multi-CR conflict:** "first accept wins" — accept সফল হলে একই
  entryId+direction-এর অন্য pending sibling request auto-decline হয়ে
  যায় (best-effort, non-blocking)।

### নিরাপত্তা hardening (এই ফিচারের ভিত্তি হিসেবে আগে করা)

- `studentRecords` read থেকে CR/ACR/CL বাদ — শুধু নিজের ডেটা (ছাত্র),
  assigned verified টিচার, বা Admin পড়তে পারবে।
- `facultyAssignments` create/update থেকে অব্যবহৃত CR/ACR/CL direct-write
  grant সরানো হয়েছে — এখন শুধু verified teacher নিজে বা Admin।
- `facultyAssignments` collectionGroup read: `isFaculty()` থেকে
  `isVerifiedFaculty()`-এ tighten করা হয়েছে (cross-group enumeration
  বন্ধ)। **নোট:** nested per-group read এখনও `isFaculty()` (unverified
  সহ) — এটা bug না, ইচ্ছাকৃত, কারণ app-এর ডকুমেন্টেড policy হলো
  unverified faculty নিজের দেখা group-এর ভেতরে সবকিছু read-only browse
  করতে পারবে (দেখো `RequireFaculty.jsx` আর `members/{memberUid}`-এর
  rules comment) — শুধু write-এর জন্য verification লাগে।
- `joinFacultyAssignment`-এর auto-match পথে consent gate যোগ হয়েছে —
  নতুন `facultyAssignments/{id}/joinRequests` subcollection, Teacher A
  accept/decline না করলে silently আর কেউ ঢুকতে পারবে না। Invite-code
  path অপরিবর্তিত (code শেয়ার করাই consent)।
- CR/ACR-এর নিজের `mobile` ফোন নম্বর `members/{uid}` থেকে সরিয়ে আলাদা
  privacy-scoped sub-doc (`members/{uid}/private/mobile`)-এ নেওয়া
  হয়েছে — unverified faculty/pending applicant আর দেখতে পারবে না।

### Phase 5 রেগ্রেশন পাসে যা পাওয়া গেছে

- **RESOLVED:** marks-summary badge popover মূলত সব group member
  (সাধারণ ছাত্র সহ) দেখতে পারত, যদিও প্ল্যানে এটা "CR-side" হিসেবে
  স্কোপ করা ছিল। এখন `LinkedTeacherBadge`-এ `canSeeSummary` prop যোগ
  করে CR/ACR-only করা হয়েছে (fetch নিজেই gated, শুধু render না) —
  ছাত্রের client এই read আর করেই না। Verified-name reveal সবার জন্যই
  আগের মতো আছে (marks-related না)। এটা কখনো real data leak ছিল না
  (শুধু count: sent/reviewed/draft/total, কোনো grade value বা
  per-student breakdown না) — শুধু scope-এর চেয়ে বেশি জায়গায় visible
  ছিল।
- অন্য যে সন্দেহজনক জায়গাগুলো ট্রেস করা হয়েছে (sibling auto-decline
  cross-CR case, isFaculty vs isVerifiedFaculty nested-rule
  inconsistency) — দুটোই trace করে confirmed non-issue পাওয়া গেছে,
  বিস্তারিত reasoning `CR_TEACHER_LINKING_NOTES.md`-এর Phase 5 এন্ট্রিতে
  আছে যাতে ভবিষ্যতে কেউ আবার একই সন্দেহে সময় নষ্ট না করে।

### এখনো বাকি (Phase 5-এর শেষ ধাপ, deploy-নির্ভর)

- **Live smoke test (deploy করার পর, sandbox-এ করা যায়নি):** একটা CR
  account + একটা teacher account দিয়ে দুই দিকের flow-ই (CR→Teacher
  invite, Teacher→CR propose) একবার সরাসরি চালিয়ে accept/decline দেখা,
  আর একটা সাধারণ student account দিয়ে confirm করা যে marks-summary
  আর দেখা যাচ্ছে না।
- Firestore rules-এর পূর্ণ emulator regression — এই sandbox-এ চালানো
  যায়নি (`storage.googleapis.com` network-এ ব্লকড, ইচ্ছাকৃতভাবে সময়
  না দিয়ে deploy-time manual test-কেই বেছে নেওয়া হয়েছে)। কোড-লেভেল
  trace + brace-balance sanity check দিয়ে যাচাই করা হয়েছে যতটা সম্ভব।

