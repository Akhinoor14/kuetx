# CR Write-Permission সম্প্রসারণ + ৮-ডিজিট Roll সাপোর্ট + Edit Log UI — মাস্টার প্ল্যান (UPDATED)

**Status: Phase A + Phase B + Phase C + Phase D কোড লেখা হয়ে গেছে, deploy/test বাকি (§Phase E)।**

এই ভার্সনটা original প্ল্যানের updated হ্যান্ড-অফ ডক — সব confirm হওয়া
decision + যা কোড হয়ে গেছে তার একটা সত্যিকারের status রেকর্ড।

---

## ০. Confirmed Decisions (Md.-এর সাথে, Aug 2026)

এই সবগুলো এখন **সিদ্ধান্ত হয়ে গেছে**, আর প্রশ্ন না:

1. **৮-ডিজিট roll layout**: `52513014` = leading `5` + normal ৭-ডিজিট
   roll (`2513014`)। Leading `5` বাদ দিলে বাকি ৭ ডিজিট ঠিক আগের মতোই
   parse হবে — batch = প্রথম ২ ডিজিট, dept = পরের ২ ডিজিট, seat = শেষ
   ৩ ডিজিট।
2. **দুই ফরম্যাট স্থায়ীভাবে সহাবস্থান করবে** — কোনো forced migration
   নেই। নতুন students ৭ অথবা ৮ যেকোনো ফরম্যাট দিতে পারবে।
3. **স্কোপ**: শুধু student roll। Faculty ID touch করা হয়নি।
4. **CR permission expansion স্কোপ**: `routineEntries`,
   `assignmentEntries`, `teacherProfiles` (teacher phone/contact) —
   এই ৩টা কালেকশন এখন **যেকোনো verified member** লিখতে পারে, CR থাকুক
   বা না থাকুক। `meta/plannerSettings` (courseTeacherMap সহ) এবং
   `meta/classSetup` **CR/ACR/CL/Admin-only-ই থেকে গেছে** (পুরনো
   no-CR-fallback সহ, অপরিবর্তিত)।
5. **plannerSettings-এর "নতুন mapping add" carve-out বাতিল**:
   আলোচনায় ঠিক হয়েছে যে `plannerSettings` একটাই shared document
   (courseTeacherMap + schedule overrides + plan targets একসাথে),
   এবং ক্লায়েন্ট সবসময় পুরো doc-টাই `setDoc(..., {merge:true})` দিয়ে
   লেখে — তাই "শুধু নতুন mapping add করতে দাও, existing change না" এই
   rule-টা field-level এ নিরাপদভাবে লেখা কঠিন। **সিদ্ধান্ত: এখন
   plannerSettings সম্পূর্ণ CR-only-ই থাকবে; future-এ courseTeacherMap
   আলাদা document/subcollection-এ split করলে তখন এই carve-out আবার
   বিবেচনা করা যাবে।**
6. **`notices` posting permission অপরিবর্তিত** — CR/ACR/CL-only-ই
   থাকবে, verified member-দের জন্য খোলা হচ্ছে না।
7. **`auditLog` write rule lockstep**: যে কালেকশনগুলোর gate function
   বদলেছে (routineEntries/assignmentEntries/teacherProfiles →
   isRoutineEditor), auditLog-এর নিজের create rule-ও একই function-এ
   বদলে দেওয়া হয়েছে — নাহলে নতুন-অনুমোদিত writer-রা নিজেদের audit
   entry silently লিখতে ব্যর্থ হতো (permission-denied, swallowed)।
8. **NoCRBanner**: persistent/non-dismissible-ই থেকে গেছে (CR এখনো
   দরকারি role — plannerSettings/classSetup এখনো CR-নির্ভর, এবং
   সাধারণভাবে class leadership হিসেবেও দরকার) — কিন্তু wording
   "urgent/blocking" থেকে সরিয়ে সাধারণ "CR নেই এখনো" framing-এ আনা
   হয়েছে, যেহেতু routine/assignment/teacherProfiles লেখা আর
   CR-নির্ভর না।

---

## ১. যা কোড হয়ে গেছে (Phase A + B সম্পূর্ণ)

### Phase A — ৮-ডিজিট Roll সাপোর্ট ✅ সম্পূর্ণ

- **`src/lib/rollFormat.js`** (নতুন ফাইল) — single source of truth:
  `isValidRoll`, `normalizeRoll`, `toSevenDigitCore`, `parseRoll`,
  `shortRoll`। ৭ ও ৮ ডিজিট দুটোই accept করে, leading `5` strip করে ৭-ডিজিট
  core বের করে।
- **সব call-site আপডেট হয়ে গেছে** (৮টার জায়গায় সব কটা, প্ল্যানের §৪
  ধাপ ২ অনুযায়ী):
  - `src/store/store.js` — `getDeptCodeFromRoll`, `extractBatchFromRoll`,
    `isProfileComplete`, `validateProfileForSave` সব আপডেট।
  - `src/components/SignUpWizard.jsx` — roll validation আপডেট।
  - `src/components/ProfileSetupModal.jsx` — `isRollValid` +
    live-typing dept-autofill helper (`extractDeptCodeFromRoll`, leading
    `5` strip করে তারপর parse করে) আপডেট।
  - `src/lib/kuetEmailVerify.js` — email regex **ইচ্ছাকৃতভাবে ৭-ডিজিটেই
    রাখা হয়েছে** (§৩ক.৭-এর open question, KUET-এর real email format
    এখনো unconfirmed), কিন্তু `emailRollMatchesProfile` এখন profile
    roll-এর ৭-ডিজিট core-এর বিপরীতে compare করে, যাতে ৮-ডিজিট roll-ধারী
    student-দের email ঠিকভাবে match করে।
  - `src/lib/groupSync.js` — `suggestedJoinMatch` (join-request hint,
    non-security) আপডেট, সাথে `_JOIN_REQUEST_DEPT_MAP` duplicate রাখা
    হয়েছে (dedupe করা হয়নি, শুধু parsing অংশ shared module ব্যবহার করে)।
  - `src/lib/firebaseSync.js` — `deptBatchFromRoll` আপডেট।
  - `src/lib/facultyMarksSync.js` — `addBacklogStudent`-এর roll
    validation আপডেট।
  - `src/pages/faculty/FacultyClassDetail.jsx` — Add Student বাটনের
    validation আপডেট।
- **`firestore.rules`-এর `verifiedRolls` regex** (dormant OTP path,
  §৩ক.৬) — **ইচ্ছাকৃতভাবে ৭-ডিজিটেই রাখা হয়েছে**, কারণ এটা
  `kuetEmailVerify.js`-এর একই ৭-ডিজিট email convention-এর ওপর নির্ভরশীল।
  পরিবর্তন না করার কারণ কোড কমেন্টে লেখা আছে।
- **সবচেয়ে বড় blast-radius bug ফিক্স হয়েছে (§৩ক.৮)**:
  `FacultyClassDetail.jsx`-এর Attendance roster merge logic-এ ৪টা জায়গায়
  `members.find((m) => m.roll === g.roll)` স্ট্রিং-ইকুয়ালিটি ম্যাচ
  ছিল — `g.roll` সবসময় ৭-ডিজিট (generated), কিন্তু real member-এর roll
  ৮-ডিজিট হতে পারে, ফলে ৮-ডিজিট student চিরকাল "কখনো অ্যাপ খোলেনি"
  (`isPlaceholder: true`) দেখাতো। এখন সবগুলো `findMemberByRoll()` নামের
  shared helper ব্যবহার করে, যেটা `toSevenDigitCore()` দিয়ে compare করে।

### Phase C (আংশিক) — Identity Stamp-এ Short Roll ✅

- **`src/lib/groupUtils.js`-এর `getIdentityStamp`** — এখন `shortRoll`
  ফিল্ড যোগ করে, `rollFormat.js`-এর shared `shortRoll()` হেল্পার ব্যবহার
  করে (hardcoded `slice(-3)` না)। এটা automatically সব write-এ
  propagate হয় (routineEntries, assignmentEntries, teacherProfiles,
  auditLog — সব একই `stamp` অবজেক্ট ব্যবহার করে)।

### Phase B — CR Write-Permission সম্প্রসারণ ✅ সম্পূর্ণ (confirmed scope অনুযায়ী)

- **`firestore.rules`**:
  - নতুন `isRoutineEditor(groupId)` ফাংশন — `isAdmin() || isCLFor(groupId)
    || isVerifiedMember(groupId)` (CR/ACR special-case বাদ, কারণ CR/ACR
    নিজেই verified member-এর subset)।
  - `routineEntries`, `assignmentEntries`, `teacherProfiles` — এখন
    `isRoutineEditor` দিয়ে গেটেড।
  - `auditLog` create rule-ও `isRoutineEditor`-এ আপডেট (lockstep fix,
    §০.৭ দেখুন)।
  - `meta/plannerSettings`, `meta/classSetup` — **অপরিবর্তিত**,
    `isContentEditor`-এই থেকে গেছে, সাথে ব্যাখ্যা-কমেন্ট যোগ করা হয়েছে
    কেন widen করা হয়নি।
  - `plannerLogEntries`, `notices` — **অপরিবর্তিত**।
- **`src/hooks/useCanEditGroup.js`** — এখন `scope` প্যারামিটার নেয়
  (`'routine'` ডিফল্ট, বা `'content'`)। দুটো আলাদা boolean বের করে
  (`canEditRoutine`/`canEditContent`) এবং scope অনুযায়ী রিটার্ন করে।
  - `Schedule.jsx`, `Assignments.jsx` → `scope: 'routine'` (explicit)।
  - `Courses.jsx`, `TermQS.jsx`, `Attendance.jsx`, `todayActions.js` →
    `scope: 'content'` (teacher-assignment/plannerSettings গেটিং,
    আগের মতোই narrow)।
  - `Teachers.jsx` — আগে হাতে-লেখা CR/ACR-only চেক ছিল
    (`subscribeMyRole` দিয়ে), এখন shared hook-এ migrate করা হয়েছে
    (`scope: 'routine'`), redundant subscription সরানো হয়েছে।
- **UI কপি আপডেট** (শুধু যে ৩টা কালেকশন widen হয়েছে তার জন্য):
  - `Teachers.jsx`, `GroupAssignments.jsx`, `GroupSchedule.jsx` —
    "Your CR hasn't added..." → role-agnostic wording।
  - `NoCRBanner.jsx` — persistent-ই থাকলো (Md.-এর সিদ্ধান্ত), wording
    softened।
  - `ClaimCRCard.jsx` — রিভিউ করা হয়েছে, কোনো পরিবর্তন লাগেনি (এর কপি
    কখনোই বলেনি যে writing CR-নির্ভর, শুধু CR role নেওয়ার pitch)।

---

## ২. যা এখনো বাকি

### Phase C ✅ সম্পূর্ণ
- ~~getIdentityStamp shortRoll~~ ✅

### Phase D — Edit Log UI ✅ কোড সম্পূর্ণ
- **`src/components/EditLogModal.jsx`** (নতুন ফাইল) — `subscribeAuditLog`
  (যেটা আগে থেকেই `groupSync.js`-এ ছিল, `auditLog` কালেকশন `at desc`
  order-এ, limit ১০০) ব্যবহার করে read করে। প্রতিটা row-এ
  `by.name` + `by.shortRoll` + action ("added a class in Schedule",
  "edited an assignment", ইত্যাদি — `ACTION_LABEL`/`COLLECTION_LABEL`
  ম্যাপ দিয়ে human-readable করা) + timestamp দেখায়। Pagination করা
  হয়নি (limit ১০০-ই যথেষ্ট মনে হয়েছে এই স্কেলে; দরকার হলে পরে cursor-
  based pagination যোগ করা যাবে)।
- **Wiring, ৩টা জায়গায়** (যে ৩টা কালেকশন `isRoutineEditor`-এ widen
  হয়েছে সেগুলোর UI-তেই):
  - `Schedule.jsx` — toolbar-এ "Edit Log" বাটন (group mode হলেই দেখায়,
    `canEditSchedule`-এর ওপর নির্ভরশীল না, যেহেতু auditLog read rule
    write rule-এর চেয়ে broader)।
  - `GroupAssignments.jsx` — একই প্যাটার্নে বাটন যোগ, list header-এ।
  - `Teachers.jsx` — hero actions-এ বাটন, `groupId` থাকলেই দেখায়
    (আগে পুরো actions div `canEdit &&`-এ ছিল, এখন সেটা `(canEdit ||
    groupId) &&`-এ চেঞ্জ করে ভেতরে আলাদাভাবে দুইটা বাটন গেট করা হয়েছে)।
- **Known gap (আগের প্ল্যানেই নোট করা ছিল, এখনো আনসলভড, ইচ্ছাকৃতভাবে
  out of scope)**: auditLog স্কিমায় before/after snapshot নেই, শুধু
  "কে কখন কী কালেকশনে" জানা যায় — `EditLogModal.jsx`-এ কমেন্ট আকারে
  এই সীমাবদ্ধতা নোট করা আছে। Diff view চাইলে write-side (`_writeAuditLog`,
  `groupSync.js`) থেকে snapshot data পাঠানো শুরু করতে হবে, যেটা আলাদা কাজ।

### Phase E — টেস্ট ও ভেরিফিকেশন (শুরু হয়নি, কোড deploy করার আগে দরকার)
মূল টেস্ট ম্যাট্রিক্স অপরিবর্তিত আছে আগের প্ল্যান থেকে:
- ৭-ডিজিট ও ৮-ডিজিট roll দিয়ে সাইন-আপ (regression + নতুন)
- দুই ফরম্যাটের batch/dept সঠিকভাবে বের হওয়া
- **Attendance roster-এ ৮-ডিজিট real student ঠিকভাবে match হওয়া**
  (এই ফিক্সটা সবচেয়ে বেশি টেস্ট দরকার, যেহেতু silent failure ছিল)
- CR থাকা অবস্থায় সাধারণ verified member routine/assignment/teacher
  info এডিট করতে পারছে কিনা (নতুন বিহেভিয়ার)
- Unverified member এখনো এডিট করতে **পারছে না**
- plannerSettings/classSetup এখনো CR/ACR/CL/Admin-only আছে কিনা
  (regression — এগুলো widen হয়নি এটা নিশ্চিত করা)
- auditLog entry ঠিকভাবে লেখা হচ্ছে কিনা নতুন-permitted writer-দের জন্যও
  (lockstep fix ভেরিফাই করা)
- ৭ ও ৮ উভয় ফরম্যাটের `shortRoll` সঠিকভাবে বসছে কিনা identity stamp-এ

---

## ৩. Deploy করার আগে মনে রাখার বিষয়

- **`firestore.rules` deploy করতে হবে** (`firebase deploy --only
  firestore:rules`) — কোড লেখা হয়েছে, কিন্তু deploy না করলে এখনো
  পুরনো rule-ই live থাকবে। **এটা এখন আগের চেয়েও জরুরি** — এই
  সেশনের `members/{memberUid}/private/mobile` nesting ফিক্স ছাড়া
  CR step-down/appoint/handoff-এর পুরো flow production-এ ভাঙা
  থেকে যাবে, deploy না হওয়া পর্যন্ত।
- Rules-এর কোনো syntax ভুল নেই কিনা `firebase deploy --only
  firestore:rules --dry-run` (বা equivalent lint) দিয়ে চেক করে নেওয়া
  ভালো, যেহেতু বড় edit হয়েছে।

---

## ৪. পরবর্তী কাজ কোথায় শুরু হবে (এখন — কোডিং শেষ, শুধু deploy+test বাকি)

সব কোডিং কাজ (Phase A/B/C/D) **শেষ**। এখন থেকে যা বাকি, সেটা কোনো
এডিটরে না — production/staging Firebase-এ:

1. **প্রথমে `firestore.rules` deploy** —
   `firebase deploy --only firestore:rules`
   (dry-run/lint চেক আগে করে নেওয়া ভালো, §৩ দেখো)।
2. **তারপর Phase E-এর পুরো টেস্ট ম্যাট্রিক্স চালানো** (§২-এর Phase E
   লিস্ট) — বিশেষভাবে জোর দিতে হবে:
   - Attendance roster-এ ৮-ডিজিট real student ঠিকভাবে match হওয়া
     (সবচেয়ে বেশি bug-prone ছিল, silent failure হতো আগে)।
   - CR না থাকা অবস্থায়ও verified member routine/assignment/teacher
     info এডিট করতে পারছে কিনা, কিন্তু plannerSettings/classSetup
     এখনো CR/ACR/CL/Admin-only আছে কিনা (regression চেক)।
   - Edit Log মডাল-এ entry ঠিকভাবে দেখাচ্ছে কিনা, বিশেষ করে নতুন-
     অনুমোদিত (non-CR verified member) writer-দের entry।
3. Test pass হলে সেটাই এই ফিচারের ইতি — নতুন কোনো Phase প্ল্যান করা
   হয়নি।

এই ডকুমেন্টের কোডিং-সাইড কাজ এখানেই সমাপ্ত।

---

## ৫. Bonus fix (এই সেশনে, স্কোপের বাইরের কিন্তু একই session-এ করা)

**Install button landing page mascot-এর উপর overlap করছিল** —
screenshot দিয়ে রিপোর্ট করা হয়েছিল যে fixed bottom-right Install FAB
landing page-এর turtle mascot/gallery art-এর কর্নারের উপর বসে যাচ্ছিল
(scroll করলে page content-টা fixed button-এর নিচ দিয়ে চলে যায় বলে)।

- **`src/components/FloatingInstallButton.jsx`** — নতুন `side` prop
  (default `'right'`, আগের behavior অপরিবর্তিত)। `side="left"` দিলে
  `.kx-install-fab-left` CSS ক্লাস যোগ হয়, যেটা horizontal anchor-টা
  right থেকে left-এ ফ্লিপ করে (mobile: `left: 16px`; desktop: `left:
  236px`, sidebar-এর ২২০px clear করে) — bottom offset/pulse animation/
  sizing সব অপরিবর্তিত।
- **`src/App.jsx`-এর `SignedOutRouter`** — শুধু landing route (`/`)
  -এর `<FloatingInstallButton />`-এ `side="left"` পাস করা হয়েছে;
  `/about`, `/privacy`, আর signed-in `Layout`-এর মাউন্ট সব আগের মতোই
  default right-এ থেকে গেছে।
- Test করার সময় দেখো: landing page-এ mascot/gallery art আর Install
  button আর overlap করছে না (bottom-left-এ চলে গেছে), কিন্তু `/about`,
  `/privacy`, আর signed-in ড্যাশবোর্ডে button আগের জায়গাতেই (bottom-
  right) আছে।

**Mobile hero-এ KUET Main Gate ছবি কেটে যাচ্ছিল (height cropped)** —
আরেকটা screenshot-based রিপোর্ট: mobile hero photo (`gate.src`) পুরো
gate structure না দেখিয়ে উপরের অংশ কেটে ফেলছিল।

- **Root cause**: `LandingPage.jsx`-এ mobile hero-র `<img>`-এ
  `aspectRatio: '21 / 9'` জোর করে বসানো ছিল, কিন্তু gate ছবির আসল
  ratio ৫:৩ (desktop-এর নিজের tile-এ এটাই ঠিকভাবে ব্যবহার হচ্ছিল,
  line ~776)। ২১:৯ অনেক বেশি চওড়া/খাটো crop, তাই `objectFit: 'cover'`
  লম্বা gate arch-টার উপরের/নিচের অংশ কেটে ফেলছিল।
- **Fix**: mobile hero `<img>`-এর `aspectRatio` `'21 / 9'` থেকে
  `'5 / 3'`-এ বদলানো হয়েছে, desktop tile-এর সাথে মিলিয়ে — এখন পুরো
  gate structure দেখা যাবে, mobile আর desktop উভয় জায়গাতেই।
- Mascot-এর position (`top: -30px, right: -14px`) outer wrapper-এর
  উপর ভিত্তি করে বসানো, image ratio-র সাথে coupled না — তাই এই
  height পরিবর্তনে mascot placement-এ কোনো side-effect নেই, আলাদা
  কোনো ফিক্স লাগেনি।

**CR "step down" flow পুরোপুরি ভাঙা ছিল (৩টা bug, একসাথে)** —
screenshot-এ দেখা গেছে একজন CL/Founder, যে নিজেই তার ক্লাসের CR, নিজের
CR status সরাতে গিয়ে "Missing or insufficient permissions" পাচ্ছিল, আর
Roster-এর "Class Roles" picker-এ নিজেকে select করলে "No role actions
available for this member" দেখাচ্ছিল।

1. **Root cause (আসল ৪০৩ error)** — `firestore.rules`-এ
   `members/{memberUid}/private/mobile` sub-document-এর জন্য যে
   `allow read`/`allow write` লেখা ছিল, সেটা কখনোই আলাদা `match
   /private/{docId} { ... }` block দিয়ে wrap করা ছিল না — সরাসরি
   parent `members/{memberUid}` block-এর ভেতরে বসানো ছিল। ফলে
   Firestore-এর কাছে `private/mobile` path-টার জন্য **কোনো rule-ই
   ছিল না** (comment-এ যা লেখা ছিল, বাস্তবে rule সেটা কভার করছিল না)
   — সব write (`clAppointCR`, `clApproveLeaveCR`, `handoffCR`,
   `assignACR`, নিজের self-write) default-deny-তে পড়ে যাচ্ছিল।
   `clApproveLeaveCR`-এর `writeBatch` এই sub-doc-এও লিখতে চেষ্টা
   করে, batch-এর যেকোনো একটা write deny হলে পুরো batch fail করে —
   এটাই ছিল আসল "Missing or insufficient permissions" error-এর উৎস।
   **Fix**: rule-টাকে সঠিকভাবে `match /private/{docId}` block-এর
   ভেতরে নেস্ট করা হয়েছে (rule-এর লজিক অপরিবর্তিত, শুধু জায়গা ঠিক
   করা হয়েছে)।
2. **`clApproveLeaveCR` কখনো `crRequests` doc resolve করতো না** —
   approve করার পরও request `status: 'pending'`-ই থেকে যেত, তাই
   Approvals list-এ বারবার দেখাতো যেন কিছুই হয়নি। `clRejectLeaveCR`
   এটা ঠিকভাবে করতো, কিন্তু approve path-এ এই লাইনটা মিসিং ছিল।
   **Fix**: `clApproveLeaveCR`-এর batch-এ
   `crRequests/{requestDocId}` কে `status: 'approved'` করার update
   যোগ করা হয়েছে।
3. **`ClassmatesList.jsx`-এর "Class Roles" picker-এ নিজের CR status
   সরানোর কোনো option-ই ছিল না** — `viewerRole === 'cl'` branch-এ
   picked member যদি নিজেই CR হয়, `m.id !== currentUid` guard-এর
   কারণে কোনো action render হতো না (empty fallthrough), তাই "No role
   actions available" দেখাতো। এই guard আসলে বসানো ছিল CL-status
   সরানো ঠেকাতে (যেটা ঠিক আছে, CL per-class role না), কিন্তু ভুলবশত
   CR-status remove-ও ব্লক করে দিচ্ছিল, যেটা "Make yourself CR"-এর
   মতোই একটা বৈধ self-action হওয়া উচিত ছিল। **Fix**: guard সরিয়ে
   `m.id === currentUid`-এর জন্য "Remove your CR status" label +
   confirm dialog সহ action যোগ করা হয়েছে, যেটা `clRevokeCR` কল করে
   (এটা `clApproveLeaveCR`-এর চেয়েও ভালো — `crRequests` doc-ও ঠিকভাবে
   resolve করে এবং কোনো pending leave request থাকলে সেটাও পরিষ্কার
   করে)।
