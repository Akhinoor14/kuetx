# CR ↔ Teacher Linking — সব খুঁজে পাওয়া জিনিস + ডিজাইন নোট
(কোডবেস trace করে বের করা, ২য় পাস — যাতে হারিয়ে না যায়)

---

## ১. তিনটা আলাদা টিচার-ডেটা সিস্টেম, একে অপরের অজান্তে!

কোডে খুঁজে পাওয়া গেছে — এইটা শুধু ২টা না, **৩টা সম্পূর্ণ আলাদা "টিচার" রেকর্ড সিস্টেম** আছে, যেগুলো একে অপরের সাথে লিংক করা নাই:

1. **`routineEntries.teacherName`** (CR-এর হাতে লেখা free text) — student-facing রুটিন গ্রিড।
2. **`faculty/{uid}` + `facultyAssignments`** (টিচার নিজের একাউন্ট) — attendance/marks সিস্টেম।
3. **`groups/{groupId}/teacherProfiles`** (`crCourseTeachers.js`) — "My Current Term Teachers" পেজ (`/teachers`)। এইটা CR/ACR-রা লেখে, phone/officeRoom/rating/notes রাখে। **এইটার একটা `directoryEmail` ফিল্ড আছে যেটা `facultyDirectory`-এর (স্ক্র্যাপ করা ৪৩৬ জন টিচারের ডেটা) সাথে link করতে পারে** — কিন্তু এইটা `faculty/{uid}` account-এর সাথে সরাসরি link না, শুধু static ডিরেক্টরি ডেটার (নাম/dept/title/photo) সাথে read-only link।

**গুরুত্বপূর্ণ:** `facultyDirectory/{email}` — এই collection টাই আসলে **natural join key** হিসেবে already কাজ করছে দুই জায়গায় (স্বাধীনভাবে):
   - Teacher signup-এর সময় `facultyDirectoryMatch.js` email দিয়ে match করে auto-verify করে (`tryAutoVerifyFacultyFromDirectory`)।
   - CR-এর `teacherProfiles` doc-ও `directoryEmail` দিয়ে একই ডিরেক্টরিতে link করে।

   **মানে "class code" আলাদা বানানোর দরকার নেই** — email (KUET institutional email) already এই দুই সিস্টেমের common anchor। যদি CR-এর দেওয়া `teacherName`/`teacherProfiles` entry-টা directoryEmail দিয়ে facultyDirectory-তে ইতিমধ্যে link করা থাকে, আর সেই email দিয়ে কোনো টিচার সাইন-আপ করে verified হয়ে থাকে (`faculty/{uid}.verifiedAt != null`) — তাহলে **সেই email-ই ৩ নম্বর collection থেকে ২ নম্বর collection-এ (real account) পয়েন্ট করতে পারবে সরাসরি**, নতুন কোনো matching/guessing দরকার নাই। এটা matching থেকে অনেক বেশি নির্ভরযোগ্য কারণ email প্রায় সবসময় unique এবং institutional।

   **সুপারিশ:** নতুন link flow এই email-anchor ব্যবহার করা উচিত, নাম-ম্যাচিং (`facultyDisambiguation.js`-এর মতো fuzzy string match) শুধু fallback হিসেবে থাকবে যখন `directoryEmail` সেট করা নাই।

---

## ২. Security rules-এ যেটা পাওয়া গেছে — এটা শুধু design গ্যাপ না, **আসল security/data-integrity গ্যাপ**

`firestore.rules` ঘেঁটে confirm হলো:

```
match /facultyAssignments/{assignmentId} {
  allow create: if isVerifiedFaculty(...) || isGroupCR(...) || isGroupACR(...) || isCLFor(...) || isAdmin();
  allow update: if isFacultyFor(groupId, assignmentId) || isGroupCR(...) || isGroupACR(...) || isCLFor(...) || isAdmin();
}
```

- **CR/ACR সরাসরি `facultyAssignments` create বা update করতে পারে rules-লেভেলে** — যদিও app UI-তে এখন এই path ব্যবহার হয় না (মন্তব্যে লেখা "forward-compatible... a future CR-facing action wouldn't need another rules edit"), কিন্তু rule-টা এখনই খোলা আছে।
- **`joinFacultyAssignment` কোনো consent/notification ছাড়াই কাজ করে** — Teacher A এর `teacherUids`-এ Teacher B silently ঢুকে যায়, শুধু courseCode+term match হলেই। rules-ও এটা আটকায় না (`isFacultyFor` শুধু check করে uid টা array-তে আছে কিনা, কে ঢুকালো/কেন সেটা যাচাই করে না)।
- **`isFaculty(uid)` মানে শুধু `faculty/{uid}` document exists করা** (even unverified) — `facultyAssignments` **read** এ এইটাই যথেষ্ট, মানে **যেকোনো সাইন-আপ করা (even unverified) টিচার একাউন্ট গ্রুপের ভেতরের সব assignment পড়তে পারে**, শুধু নিজের গ্রুপ না, group membership check-ও নাই এখানে (`isGroupMember(groupId)` আলাদা, কিন্তু `isFaculty()` কোনো গ্রুপ-স্কোপড না)।

**এই তিনটাই এখনই বিদ্যমান ঝুঁকি — নতুন লিংকিং ফিচার বানানোর আগেও এগুলো ঠিক করা দরকার**, কারণ নতুন ফিচার এই একই foundation-এর উপর দাঁড়াবে।

---

## ৩. `joinFacultyAssignment` (২ নম্বর টিচার হিসেবে join) — বিস্তারিত

**কী হয়:** Teacher B "+ Add Class" থেকে dept/batch/term/course বাছলে, `findJoinableAssignment()` silently চেক করে একই courseCode+term+group-এ কোনো assignment আছে যেখানে ১ জন টিচার আছে (২ পূর্ণ না)। মিললে UI-তে join-offer দেখায়, চাপলেই সরাসরি array-তে ঢুকে যায়।

**Teacher A কিছুই জানে না, notification পায় না।**

**একমাত্র consent-based পথ:** Invite code (Teacher A কোড জেনারেট করে, Teacher B হাতে/মেসেজে পেয়ে কোড বসায়) — কিন্তু এটা optional, code ছাড়াও auto-match কাজ করে।

**ঝুঁকির উদাহরণ:** একই courseCode, একই term — কিন্তু ভিন্ন section, ভিন্ন আসল টিচার হওয়ার কথা — তাও match করে ফেলবে যদি section-check ঠিকমতো না থাকে। ভুল টিচার অন্য কারো ক্লাসে attendance/marks access পেয়ে যেতে পারে।

**সুপারিশ:** এখানেও Teacher A কে accept/reject করতে দেওয়া উচিত (invite code optional path রেখে, কিন্তু auto-match কে "request পাঠাও" এ downgrade করে, direct join না)।

---

## ৪. প্রস্তাবিত Notification/Link flow — যা আগে আলোচনা হয়েছে (পুনরায় সংক্ষেপে)

### মূলনীতি: সময়/স্লট ডেটা কখনো merge হবে না, শুধু identity link হবে
- CR-side (`routineEntries`) আর Teacher-side (`facultyAssignments`) এর `dayTimeSlots`/সময়/স্লট **সবসময় independent** থাকবে, কেউ কারো এডিট override করবে না।
- নতুন সংযোগ শুধু: `linkedFacultyUid`, `linkedAssignmentId` (routineEntry-তে) — identity pointer, সময় না।

### CR → Teacher
1. CR নাম বসালে সিস্টেম প্রথমে **email/directoryEmail anchor দিয়ে** (matching থাকলে) নাহলে fuzzy name-match দিয়ে suggest করে।
2. Auto-notify না — CR কে explicit **"Invite this teacher"** বাটনে চাপতে হবে।
3. টিচার notification পায়: কে পাঠালো, কোন কোর্স/ব্যাচ/সেকশন/টার্ম, CR এর দেওয়া raw teacherName, Accept/Decline।
4. Accept করলে: assignment না থাকলে auto-তৈরি হবে prefilled data দিয়ে, `linkedFacultyUid` সেট হবে। সময়-স্লট টিচার নিজে বসাবে, independent থাকবে।
5. Decline করলে: কিছু বদলাবে না, teacherName free text আগের মতোই কাজ করবে।

### Teacher → CR
1. টিচার ক্লাস তৈরি/join করলে সিস্টেম চেক করবে matching routineEntry আছে কিনা (dept+batch+section+term+courseCode)।
2. থাকলে CR(দের) notification যাবে, accept/decline।
3. না থাকলে বা decline হলে — টিচারের নিজের assignment স্বাধীনভাবে কাজ করবে, CR অনুমতি ছাড়াই।

### Link হওয়ার পর কী দেখাবে
- Grid-এ CR-এর দেওয়া নামই (`teacherName`) থাকবে অপরিবর্তিত — পাশে একটা verified badge, ক্লিক করলে real profile name (directory থেকে) দেখাবে।
- CR-side এ শুধু **summary/status** দেখা যাবে (কতগুলো session নেওয়া হয়েছে, marks আপলোড status) — individual student attendance/marks detail কখনোই CR দেখবে না (privacy boundary অপরিবর্তিত)।

---

## ৫. এখনো বাকি থাকা Decision points (তোমার input দরকার হবে যখন build শুরু হবে)

1. **Decline permanent naki retry হবে** — একবার decline করলে সেই জোড়ার (এই CR + এই টিচার + এই course) জন্য কি চিরতরে suggestion বন্ধ, নাকি নতুন করে কেউ আবার manual invite পাঠালে আবার আসবে।
2. **Multi-CR conflict** — একই batch/section-এ একাধিক CR থাকলে সবাই notification পাবে, নাকি প্রথম যে accept করবে সেটাই lock হয়ে বাকিদের request auto-withdraw হবে।
3. **`joinFacultyAssignment`-এর consent gap** — এটা কি এই একই phase-এ ঠিক করা হবে, নাকি আলাদা ticket হিসেবে পরে।
4. **Rules-এর CR/ACR direct `facultyAssignments` create/update permission** — এখন dead code (app এ ব্যবহার হয় না) কিন্তু rules এ খোলা আছে। এটা কি tighten করা হবে এখনই, নাকি নতুন CR-initiated flow বানানোর সময় ব্যবহার করা হবে (তখন legitimate হয়ে যাবে)।
5. **`isFaculty()` এর group-scope না থাকা** — যেকোনো signed-up (even unverified) টিচার সব গ্রুপের assignment পড়তে পারছে, এটা কি এই ফিচারের সাথেই ঠিক করা হবে।

---

## ৭. Personal Data Leak + Overwrite Audit (৩য় পাস — firestore.rules লাইন-বাই-লাইন)

**Scope:** ছাত্রের personal data অন্য কারো কাছে leak হয় কিনা, একজন টিচারের class-related info অন্য কারো কাছে leak হয় কিনা, কেউ কারো ডেটা overwrite করতে পারে কিনা — এই তিনটা angle থেকে পুরো rules ফাইল ঘেঁটে যা পাওয়া গেছে।

### 🔴 সবচেয়ে গুরুতর — Student Marks: CR/ACR পুরো ক্লাসের সব ছাত্রের marks পড়তে পারে

```
match /studentRecords/{studentUid} {
  allow read: if (uid == studentUid) || isFacultyFor(...) || isContentEditor(groupId) || isAdmin();
}
```

`isContentEditor(groupId)` = Admin, CL, **CR, ACR** — এবং **CR/ACR না থাকা অবস্থায় যেকোনো verified সাধারণ ছাত্রও** (`crCount(groupId) <= 0 && isVerifiedMember(groupId)` ক্লজ দিয়ে)।

**মানে:** `studentRecords/{studentUid}` ডকুমেন্টে `teacher1Marks` এবং `teacher2Marks` — দুটো টিচারের দেওয়া full grade breakdown — থাকে, আর এই পুরো ডকুমেন্ট CR/ACR-রা **প্রতিটা ছাত্রের জন্য আলাদা করে খুলে পড়তে পারে**, শুধু নিজের না, ক্লাসের সবার। এটা designed intent হতে পারে (CR-কে administrative oversight দেওয়ার জন্য), কিন্তু এটা যদি ইচ্ছাকৃত না হয়ে থাকে — **এটাই সবচেয়ে বড় personal/গ্রেড ডেটা exposure** পুরো সিস্টেমে। একজন ছাত্র হয়তো ভাবছে তার marks শুধু টিচার আর নিজে দেখতে পারবে, কিন্তু বাস্তবে CR/ACR ও পুরোটা দেখতে পারছে।

**Write দিকটা নিরাপদ আছে** — শুধু assigned verified টিচার নিজের স্লট (`teacher1Marks` বা `teacher2Marks`, নিজে যেটার owner) ছাড়া অন্য কিছু লিখতে পারে না, `hasOnly`/`affectedKeys` দিয়ে field-level lock করা। CR কখনো marks **লিখতে/বদলাতে** পারে না, শুধু **পড়তে** পারে — এটাই মূল সমস্যা।

**সুপারিশ:** যদি এটা ইচ্ছাকৃত না হয়ে থাকে, `studentRecords` read থেকে `isContentEditor(groupId)` সরিয়ে ফেলা উচিত, অথবা অন্তত marks-এর বদলে শুধু **summary status** (সাবমিট হয়েছে কিনা, কবে) আলাদা lighter doc-এ রেখে CR-কে সেটাই দেখানো উচিত — পুরো marks breakdown না।

---

### 🟡 CR/ACR সরাসরি ভুল টিচারের ক্লাসে ঢুকতে/বদলাতে পারার সুযোগ (rules-লেভেলে খোলা, এখন app এ ব্যবহার হয় না)

```
match /facultyAssignments/{assignmentId} {
  allow create: if isVerifiedFaculty(...) || isGroupCR(...) || isGroupACR(...) || isCLFor(...) || isAdmin();
  allow update: if isFacultyFor(...) || isGroupCR(...) || isGroupACR(...) || isCLFor(...) || isAdmin();
}
```

CR/ACR rules-লেভেলে `facultyAssignments` **create এবং update** দুটোই করতে পারে — মানে টেকনিক্যালি একজন CR সরাসরি Firestore-এ লিখে একটা assignment-এর `teacherUids` বদলে দিতে পারে (কে টিচার সেটাই বদলে দেওয়া), বা কোনো টিচারের `dayTimeSlots` overwrite করতে পারে — app-এর কোনো বাটন এখন এটা করে না (শুধু future compatibility-র জন্য রাখা), কিন্তু **rules রক্ষা করছে না**, শুধু app UI না থাকাটাই এখনকার একমাত্র সুরক্ষা — যেটা যথেষ্ট না, কারণ rules bypass করে সরাসরি Firestore call করাও সম্ভব (browser console, বা modified client দিয়ে)।

**সুপারিশ:** যেহেতু app এখন এই path ব্যবহার করছে না, `create`/`update`-এ CR/ACR/CL clause-টা এখনই সরিয়ে tighten করে রাখা উচিত, এবং নতুন CR-initiated linking ফিচার বানানোর সময় এই permission-টা নতুন করে, request-approval flow-এর ভেতর দিয়ে (সরাসরি write না) খুলে দেওয়া উচিত।

---

### 🟡 `joinFacultyAssignment` — Teacher A এর consent ছাড়াই ক্লাসে ঢোকার সুযোগ (আগেও উল্লেখ করা হয়েছে, rules দিয়ে confirm হলো)

`isFacultyFor(groupId, assignmentId)` rule শুধু চেক করে uid-টা `teacherUids` array-এ আছে কিনা — **কে, কীভাবে, কার অনুমতিতে ঢুকলো সেটা rules-এ কোনো constraint না**। `joinFacultyAssignment()` (app কোড) নিজেই বিনা approval-এ array-তে যোগ করে দেয় (আগের নোটে বিস্তারিত)। এটা marks-access-এর সাথে সরাসরি যুক্ত — একবার `teacherUids`-এ ঢুকে গেলে সেই "টিচার" পুরো ক্লাসের সব `studentRecords`-এ পুরো read/নিজের slot-এ write অধিকার পেয়ে যায়।

---

### 🟡 `facultyAssignments` collectionGroup read — সব গ্রুপের সব assignment যেকোনো (even unverified) টিচার পড়তে পারে

```
match /{path=**}/facultyAssignments/{assignmentId} {
  allow read: if isAdmin() || isFaculty(request.auth.uid);
}
```

`isFaculty(uid)` মানে শুধু `faculty/{uid}` ডকুমেন্ট থাকা (signup করেছে) — **verified হওয়া লাগে না, ওই গ্রুপের সাথে সম্পর্কও থাকা লাগে না**। মানে যেকোনো সাইন-আপ করা টিচার একাউন্ট — এমনকি এখনো Founder-approved না হওয়া — **পুরো প্ল্যাটফর্মের প্রতিটা গ্রুপের প্রতিটা ক্লাস-এসাইনমেন্ট** (কোন কোর্স, কোন ব্যাচ, কে টিচার, দিন-সময়) পড়ে ফেলতে পারে collectionGroup query দিয়ে।

**এটা graded/personal ডেটা না** (assignment doc নিজে student marks রাখে না), কিন্তু এটা প্রতিষ্ঠানের internal scheduling info — একজন এখনো-unverified/fake টিচার একাউন্ট পুরো university-র schedule enumerate করতে পারা উচিত না।

**সুপারিশ:** এখানে `isVerifiedFaculty()` ব্যবহার করা উচিত `isFaculty()`-এর বদলে, অন্তত।

---

### 🟢 যেগুলো ভালোভাবে সুরক্ষিত পাওয়া গেছে (comparison-এর জন্য, যাতে বোঝা যায় বাকিটা কেমন হওয়া উচিত)

- **`notices` (cr_only)** — server-side rules-এ `targetType == 'cr_only'` চেক আছে, শুধু client-side filter না। একজন ছাত্র direct SDK query দিয়েও CR-only notice পড়তে পারবে না।
- **`members/{uid}` update** — CR `role/verified/legacyCRClaim/mobile` ছাড়া আর কিছু বদলাতে পারে না (`affectedKeys().hasOnly(...)`)। অন্য ছাত্রের নাম/রোল overwrite করা সম্ভব না।
- **`faculty/{uid}.institutionalEmail`** — সচেতনভাবে আলাদা sub-doc-এ (`private/verification`) সরানো, main doc-এ leak হয় না, শুধু owner + Admin/HeadOfOps পড়তে পারে।
- **`studentRecords` write** — field-level lock (`hasOnly(['teacher1Marks', ...])`) দিয়ে একজন টিচার আরেকজনের marks slot overwrite করতে পারে না।

### 🟡 ছোট leak — CR/ACR এর নিজের `mobile` (ফোন নম্বর) faculty (even unverified) + pending applicant-দের কাছে দৃশ্যমান

`members/{memberUid}` read rule-এ `isFaculty(request.auth.uid)` (unverified সহ) এবং এখনো-approved-না-হওয়া joinRequest থাকা যেকেউ পুরো member doc পড়তে পারে, যার ভেতরে CR/ACR-এর `mobile` ফিল্ড থাকে (সাধারণ ছাত্রের `mobile` লেখা হয় না, শুধু CR/ACR হওয়ার সময় লেখা হয়)। ছোট কিন্তু বাস্তব — CR-এর personal phone number কোনো unverified/fake টিচার একাউন্ট বা এখনো-অনুমোদিত-না-হওয়া আবেদনকারী দেখে ফেলতে পারে।

---

## ৮. এই অডিট থেকে সামগ্রিক সিদ্ধান্ত

**Class-related info (schedule, কে টিচার, কবে ক্লাস) এখন যতটা secure হওয়া উচিত ততটা না** — তোমার পর্যবেক্ষণ সঠিক। মূল কারণ তিনটা:
1. `isFaculty()` অনেক জায়গায় ব্যবহার হয়েছে যেখানে `isVerifiedFaculty()` হওয়া উচিত ছিল (unverified/fake একাউন্ট অনেক কিছু পড়তে পারছে)।
2. CR/ACR-কে "forward-compatible" ভেবে অনেক write permission আগেভাগে rules-এ খুলে রাখা হয়েছে, যেগুলো এখনো app ব্যবহার করে না — এগুলো attack surface, benefit কিছু না যতক্ষণ না feature টা আসলে বানানো হয়।
3. `studentRecords` read-এ CR/ACR অন্তর্ভুক্ত করাটা marks-এর মতো sensitive ডেটার জন্য সবচেয়ে বড় ঝুঁকি — এটা প্রথমে ঠিক করা উচিত, নতুন linking ফিচার বানানোর আগেই।

**নতুন CR↔Teacher linking ফিচার বানানোর সময় এই সবগুলো একসাথে সামলানো উচিত** — কারণ নতুন ফিচার এই একই `facultyAssignments`/`studentRecords`/`members` foundation ব্যবহার করবে; আগে থেকে থাকা গর্তের উপর নতুন কিছু বানালে গর্তগুলো আরো বেশি ব্যবহৃত/গুরুত্বপূর্ণ হয়ে উঠবে।

---

## ১০. চতুর্থ পাস — আরো যা পাওয়া গেছে ("হওয়া উচিত না, কিন্তু হচ্ছে")

### 🟢 (মিথ্যা alarm, কিন্তু ডকুমেন্টেশন বিভ্রান্তিকর) — `verifiedFacultyEmails` collection

`documentation/03-features/faculty-module/CURRENT.md`-এ নিজেই লেখা আছে "Known security gap (এখনো fix হয়নি)": এই collection-এ `allow write: if isSignedIn()` — যেকোনো signed-in একাউন্ট (ছাত্র সহ) সরাসরি লিখতে পারে, directory match ছাড়াই।

**কোড ঘেঁটে যাচাই করে দেখা গেল — এটা আসলে আর কোনো ক্ষতি করতে পারে না।** আসল Blue Tick flag (`faculty/{uid}.verifiedAt`) এখন rules-এ শক্তভাবে lock করা: `isAdmin() && affectedKeys().hasOnly(['verifiedAt', 'verifiedBy'])` — মানে **শুধু Admin এটা flip করতে পারে**, `verifiedFacultyEmails`-এ কেউ যাই লিখুক না কেন সেটা `verifiedAt`-কে সরাসরি প্রভাবিত করে না (rules কোথাও আর `exists(verifiedFacultyEmails/...)` চেক করেই না — পুরনো mechanism replace হয়ে গেছে, rules-এর নিজের comment-এই লেখা আছে "the old exists(...) check closed")।

**তাহলে সমস্যা কী:** documentation stale — এটা "known gap, fix করা হয়নি" লেখা আছে, কিন্তু বাস্তবে **codebase নিজেই এটা আগেই resolve করে ফেলেছে** (নতুন Admin-only verifiedAt path বানানোর সময়), কিন্তু ডকুমেন্টেশন আপডেট হয়নি। এটা ভবিষ্যতে বিভ্রান্তি তৈরি করবে — কেউ পরে দেখবে "known gap" লেখা আছে, সময় নষ্ট করে আবার এটা নিয়ে ভাববে, অথবা উল্টো — সত্যিই যদি কোনো ভবিষ্যৎ পরিবর্তনে আবার `verifiedFacultyEmails` কে trust source বানানো হয়, পুরনো "write: if isSignedIn()" rule-টা তখন real exploit হয়ে যাবে কারণ কেউ মনে রাখবে না এটা এখন খোলা আছে।

**সুপারিশ:** এই doc-টা আপডেট করে "resolved" মার্ক করা, আর সুযোগ পেলে rules-এও write access টা tighten করে দেওয়া (even though এখন functionally অকেজো, defense-in-depth হিসেবে ভালো)।

---

### 🟡 CR-approved student verification — cross-check করে দেখা হলো, এটা ঠিক আছে

`members/{uid}.verified` (ছাত্রের Blue Tick) শুধু CR/ACR/CL manual approve করলেই সেট হয় — কোনো self-grant পথ নেই, rules-ও এটা backup করছে। এটা designed-as-intended, কোনো গ্যাপ পাওয়া যায়নি এখানে।

---

### 🟢 R2/Cloudflare Worker uploads — যাচাই করা হলো, ঠিকঠাক

- **Question Bank worker** (`cloudflare-worker/src/index.js`): প্রতিটা sensitive route (`/stage`, `/stage-preview`, `/approve`) নিজে Firebase ID token verify করে, Firestore থেকে role cross-check করে (SCL/Founder/HeadOfOps)। ভালোভাবে গার্ড করা।
- **Service Images worker**: শুধু owning provider নিজের ছবি upload/delete করতে পারে, delete-এর সময় key থেকেই serviceId পুনরায় বের করে ownership যাচাই করে (client-supplied serviceId কে blindly trust করে না) — ভালো ডিজাইন প্যাটার্ন।

**একটা ছোট নোট (গ্যাপ না, শুধু পর্যবেক্ষণ):** এই marketplace images bucket সচেতনভাবেই public (product photo browsing দরকার), তাই এখানে privacy concern প্রযোজ্য না — শুধু নিশ্চিত করছি এটা ভুলে leak হয়নি, ইচ্ছাকৃতভাবে public।

---

### 🟢 `pendingPublicationSubmissions` (তোমার এখনকার active কাজ) — rules ইতিমধ্যে সঠিকভাবে লেখা আছে

চেক করে দেখা গেল rules ফাইলে এই collection-এর জন্য rule **ইতিমধ্যে বিদ্যমান এবং সঠিকভাবে লেখা** — read শুধু Admin/HeadOfOps, create নিজের submittedBy uid দিয়ে, update শুধু status/resolvedAt/resolvedBy field-এ lock করা (মূল submitted content immutable থাকে, audit trail এর জন্য), delete শুধু resolved doc-এর উপর। এটা তোমার earlier note-এ "Firestore rules writing বাকি" বলা হয়েছিল — কিন্তু **এটা আসলে ইতিমধ্যেই করা আছে।** (হয়তো তুমি অন্য কোনো related piece-এর কথা ভাবছিলে — `PendingPublicationsPanel` mount করা এখনো বাকি, কিন্তু rules না)।

---

## ১১. চার পাস মিলিয়ে চূড়ান্ত priority list (গুরুত্ব অনুযায়ী সাজানো)

1. 🔴 **`studentRecords` read-এ CR/ACR অন্তর্ভুক্তি** — সবচেয়ে জরুরি, marks পুরো ক্লাসের জন্য exposed।
2. 🟡 **`facultyAssignments` create/update-এ CR/ACR-এর অব্যবহৃত rules-permission** — এখনই tighten করা উচিত, dead code হলেও attack surface।
3. 🟡 **`joinFacultyAssignment`-এ consent gate না থাকা** — CR↔Teacher linking ফিচারের সাথেই ঠিক করার সুযোগ আছে।
4. 🟡 **`facultyAssignments` collectionGroup read-এ `isFaculty()` (unverified সহ)** — `isVerifiedFaculty()`-এ tighten করা উচিত।
5. 🟡 **CR/ACR-এর নিজের phone number unverified faculty/pending applicant-দের কাছে দৃশ্যমান** — ছোট কিন্তু real।
6. 🟢 **Documentation ভুল/stale** — `verifiedFacultyEmails` niye "known gap" লেখা থাকলেও বাস্তবে আর exploit করা যায় না; doc আপডেট করা উচিত যাতে ভবিষ্যতে কেউ confuse না হয়।

কোনো নতুন **critical** ভুল পাওয়া যায়নি এই পাসে যা আগের তিন পাসে ধরা পড়েনি — বাকি সিস্টেম (notices, members field-lock, provider/faculty phone-splitting, R2 workers, publication submission queue) ভালোভাবে ডিজাইন করা পাওয়া গেছে। উপরের ৫টা আইটেমই এখন focus করার মতো আসল জিনিস।

---

## ১২. Phase-wise Implementation Plan (৫ phase-এ ভাগ করা)

**নিয়ম:** প্রতিটা phase শেষ হলে দুইটা output — (১) এই MD ফাইলটাই আপডেট হয়ে ফিরে আসবে (এই phase-এর status ✅ DONE হয়ে যাবে, পরের phase-এ "▶ NEXT" মার্ক থাকবে), (২) পুরো codebase-এর full updated zip (শুধু diff/changed files না, পুরো প্রজেক্ট)।

---

### Phase 0 — Security Rules Hardening: Student Data
**Status: ✅ DONE**

- [x] `studentRecords` read থেকে `isContentEditor(groupId)` সরানো — `firestore.rules` লাইন ~৩০৩১-৩০৫৮। এখন read শুধু: নিজের ডেটা হলে ছাত্র নিজে, assigned/verified টিচার (`isFacultyFor`), অথবা Admin। CR/ACR/CL আর কারো marks পড়তে পারবে না।
- [x] Summary-view কথাটা যাচাই করে দেখা হলো এই phase-এ দরকার নেই — কোডবেসে grep করে confirm করা হয়েছে `studentRecords` এখন পর্যন্ত **শুধু** teacher-side ফাইল (`facultyMarksSync.js`, `FacultyClassDetail.jsx`, `RequireFaculty.jsx`) থেকেই touched হয়, কোনো CR-facing page এই read কখনো ব্যবহার করেনি — তাই এই পরিবর্তনে কোনো existing UI ভাঙেনি, শুধু আগে থেকে unused একটা over-grant বন্ধ হলো। ভবিষ্যতে CR-facing summary view লাগলে সেটা Phase 4-এ আলাদা lightweight doc দিয়ে করা হবে (rules ফাইলে এই প্ল্যানটা comment হিসেবেও লিখে রাখা হয়েছে, যাতে ভবিষ্যতে কেউ ভুলে পুরনো broad grant আবার ফিরিয়ে না আনে)।
- [x] rules emulator না থাকায় (network/Java restriction) manual trace + brace-balance sanity check দিয়ে verify করা হয়েছে — edit syntactically সঠিক, এবং write rule (`create`/`update`) অপরিবর্তিত আছে, টিচারের নিজের marks-save flow-এ কোনো প্রভাব পড়েনি।

**নোট:** rules deploy করার পর বাস্তব Firebase project-এ একবার হাতে চেক করে নেওয়া ভালো (`firebase deploy --only firestore:rules`-এর পর একজন CR একাউন্ট দিয়ে সত্যিই আর marks পড়া যাচ্ছে না, আর একজন টিচার একাউন্ট দিয়ে নিজের marks read/write ঠিকমতো কাজ করছে) — কোড-লেভেল trace ঠিক থাকলেও deploy-পরবর্তী live verification phase 5-এর emulator/regression ধাপে করাই সবচেয়ে নিরাপদ।

---

### Phase 1 — Security Rules Hardening: Faculty/Assignment Access
**Status: ✅ DONE**

- [x] `facultyAssignments` create/update থেকে অব্যবহৃত CR/ACR/CL direct-write permission সরানো — create/update এখন শুধু verified teacher নিজে (create-এ) / assigned teacher বা Admin (update-এ)। Dead grant সম্পূর্ণ সরানো হয়েছে, কোনো narrower version রাখা হয়নি যেহেতু আগেই confirm করা ছিল app কোথাও এই path ব্যবহার করে না।
- [x] `facultyAssignments` collectionGroup read rule-এ `isFaculty()` কে `isVerifiedFaculty()`-এ বদলানো — nested per-group rule (`isFacultyFor`) আগে থেকেই verified-only ছিল, এখন collectionGroup variant-ও সামঞ্জস্যপূর্ণ। দুইটা legitimate caller (Admin dashboard, নিজের "My Classes") কেউই unverified access-এর উপর নির্ভর করছিল না।
- [x] `joinFacultyAssignment()`-এর auto-match পথে consent gate যোগ করা — নতুন `groups/{groupId}/facultyAssignments/{assignmentId}/joinRequests/{requestingUid}` subcollection (নিজস্ব rules সহ: create শুধু requester নিজে, read requester/Teacher A/Admin, update শুধু Teacher A এবং শুধু status/resolvedAt ফিল্ডে, delete requester/Teacher A/Admin)। Invite-code path অপরিবর্তিত রাখা হয়েছে (এখনও সরাসরি `joinFacultyAssignment()` কল করে) — code শেয়ার করাটাই consent।
  - `facultyClassSync.js`: নতুন ফাংশন `requestToJoinFacultyAssignment`, `subscribeJoinRequests`, `acceptJoinRequest`, `declineJoinRequest`, `withdrawJoinRequest`। পুরনো `joinFacultyAssignment()` অপরিবর্তিত রাখা হয়েছে, এখন শুধু invite-code path আর নতুন `acceptJoinRequest()`-এর ভেতর থেকে কল হয়।
  - `FacultyClasses.jsx`: auto-match "Join it instead" বাটন এখন `requestToJoinFacultyAssignment` কল করে (সরাসরি join না), কপি আপডেট হয়ে বলে "the other teacher will need to accept"।
  - `FacultyClassDetail.jsx` (AttendanceTab, `!isJoinedClass` অবস্থায়): নতুন pending-request accept/decline card, "Invite co-teacher" ব্লকের ঠিক উপরে। কোনো app-wide notification system নেই এখনো (`notify.js` শুধু same-session toast) — এই live Firestore subscription-ই আপাতত notification হিসেবে কাজ করছে; Teacher A পেজ খুললেই pending request দেখতে পাবে।
- [x] Brace-balance sanity check + esbuild parse check (তিনটা ফাইলই — rules-এর জন্য brace count, JS/JSX-এর জন্য esbuild) দিয়ে verify করা হয়েছে; rules emulator না থাকায় (আগের মতোই) deploy-পরবর্তী লাইভ ভেরিফিকেশন Phase 5-এ বাকি।

**নোট:** `requestedByName` আপাতত `auth.currentUser?.displayName` থেকে denormalize করা হয়েছে — এটা শুধু UI display-এর জন্য, কোনো rules/access decision এর উপর নির্ভর করে না। Phase 3-এর email-anchor identity-link ফিচারের সাথে এটার কোনো conflict নেই, দুইটা আলাদা collection (`joinRequests` বনাম ভবিষ্যতের `teacherLinkRequests`), ইচ্ছাকৃতভাবে আলাদা রাখা হয়েছে যেহেতু সম্পর্কের ধরন ভিন্ন (Teacher↔Teacher, existing assignment বনাম CR↔Teacher, নতুন identity link)।

---

### Phase 2 — Security Rules Hardening: Misc + Documentation Cleanup
**Status: 🟡 IN PROGRESS — items 1-3 DONE, item 4 ▶ NEXT**

- [x] `members/{uid}` থেকে CR/ACR-এর `mobile` field আলাদা privacy-scoped sub-doc-এ সরানো — **DONE, কোড + rules দুটোই।**
  - প্রথমে ভুল পথে গিয়েছিলাম: `members` read rule-টাই `isFaculty()` থেকে `isVerifiedFaculty()`-এ tighten করার চেষ্টা করেছিলাম — কিন্তু এটা `RequireFaculty.jsx`-এর ডকুমেন্টেড পলিসি ভেঙে দিত ("unverified faculty can browse everything read-only")। **সেই পরিবর্তনটা revert করা হয়েছে**, `members` read rule আগের মতোই (`isFaculty()` branch অপরিবর্তিত)।
  - আসল ফিক্স: `mobile` field-টা `members/{memberUid}` থেকে সরিয়ে নতুন sub-doc `members/{memberUid}/private/mobile`-এ নেওয়া হয়েছে, নিজস্ব read rule সহ (owner নিজে, CL/Admin/HeadOfOps/SCL, group-এর CR/ACR, অথবা **verified** faculty — unverified faculty signup আর এই নম্বর পড়তে পারবে না, কিন্তু roster-এর বাকি সব field আগের মতোই পড়তে পারবে)। Write rule আগের authority tier-গুলোই মিরর করে (single `value` key)।
  - `groupSync.js`-এ নতুন হেল্পার `writeMemberMobile`/`getMemberMobileOnce` যোগ হয়েছে; ৭টা আসল write site আপডেট হয়েছে (`updateOwnMobile`, `clApproveCRRequest`-এর bootstrap merge, `clAppointCR`, `clRevokeCR`, `handoffCR`, `assignACR`, `clApproveLeaveCR`) — সবগুলো এখন parent doc-এ role/verified লেখার সাথে একটা আলাদা sub-doc write করে (batch হলে batch-এর ভেতরেই দ্বিতীয় entry হিসেবে)। `crRequests/{uid}`-এর নিজস্ব `mobile` field (bootstrap flow-এর জন্য) ইচ্ছাকৃতভাবে অপরিবর্তিত রাখা হয়েছে — সেটা আলাদা collection, CL/Admin/requester-only read, faculty exposure নেই, তাই scope-এর বাইরে।
  - তিনটা read site ঠিক করা হয়েছে: `CRMobileNumberBanner.jsx` (নিজের সাবস্ক্রিপশন sub-doc-এ রিপয়েন্ট), `ClassmatesList.jsx` (৩টা `defaultValue` prefill এখন prompt খোলার সময় `getMemberMobileOnce` দিয়ে on-demand fetch করে), `FacultyAllCR.jsx` (আসল target page — CR/ACR row-গুলোর জন্য batched fetch, card grid-এর "no mobile on file" badge আর `CRDetailModal` দুটোতেই merge করা)।
  - esbuild দিয়ে ৪টা edited ফাইলই (rules বাদে) syntax-check করা হয়েছে, pass করেছে। rules brace-balance ঠিক আছে।
  - **এই আইটেমটা এখনও পুরোপুরি verify করা হয়নি** — rules emulator না থাকায় লাইভ টেস্ট বাকি (Phase 5-এর regression ধাপে হবে, আগের phase-গুলোর মতোই), তবে কোড-লেভেলে সব write/read site trace করে consistent পাওয়া গেছে।

- [x] `verifiedFacultyEmails` write rule tighten করা (defense-in-depth) — **DONE**। দুইটা আসল writer trace করে confirm করা হলো: `facultyDirectoryMatch.js`-এর auto-verify path নিজের email-এর জন্যই লেখে (signed-in faculty session), আর `manualVerifyRequests.js`-এর `approveManualVerifyRequest()` Admin session থেকে **অন্য কারো** email-এর জন্য লেখে। তাই simple `token.email == email`-only গেট দিলে Admin path ভেঙে যেত — এখন rule হয়েছে: `isAdmin() || (isSignedIn() && request.auth.token.email.lower() == email)`। এটা "এক account অন্য কারো email নিয়ে fake claim লেখা" বন্ধ করে, কিন্তু পুরো গ্যাপ resolve করে না — একজন malicious/compromised faculty session এখনো নিজের email-এর জন্য ভুয়া `autoVerified: true` লিখতে পারে actual directory match ছাড়াই (client-JS-only validation এখনও, real fix-এর জন্য Cloud Function/Blaze লাগবেই)। Brace-balance sanity check pass করেছে।
- [x] `documentation/03-features/faculty-module/CURRENT.md`-এ "known gap" নোটটা আপডেট করা হয়েছে — **DONE**। "resolved" বলা হয়নি (কারণ হয়নি), বরং "narrowed (defense-in-depth), root cause still open" হিসেবে সঠিকভাবে লেখা হয়েছে — কী বন্ধ হলো (cross-account write) আর কী এখনও বাকি (self-write-without-real-match) দুটোই স্পষ্ট করে আলাদা করা আছে, যাতে ভবিষ্যতে কেউ ভুল করে ভাবতে না পারে এটা পুরোপুরি ঠিক হয়ে গেছে।
- [ ] Phase 0-2 এর সব rules একসাথে emulator-এ পুরো regression টেস্ট (student/CR/teacher/admin) — শুরু হয়নি, Phase 5-এ প্ল্যান করা আছে।

---

### Phase 3 — CR ↔ Teacher Linking: Core Flow
**Status: ✅ DONE (core flow both directions; badge/summary UI intentionally deferred to Phase 4; §6 product-decision points still need your confirmation, see below)**

**এই সেশনে যা করা হলো — শুরুতে একটা কারেকশন সহ:** notes-এর original প্ল্যান ধরে নিয়েছিল matching হবে `teacherProfiles.directoryEmail` anchor দিয়ে। কোডবেস ট্রেস করে দেখা গেল আসল, ইতিমধ্যে কাজ করা matching সিস্টেম হলো `facultyDisambiguation.js` (routineEntries.teacherName-কে facultyAssignments.displayName/gridAlias-এর সাথে fuzzy name-match করে) + `TeacherClaimBanner.jsx` (যেটা এই match দেখাতো কিন্তু আসল কোনো link লিখতো না, শুধু localStorage dismiss)। Email-anchor সিস্টেমটা routineEntries-এর সাথে কখনো connected ছিলই না। মালিকের কনফার্মেশন নিয়ে (email-anchor বাতিল, existing name-match-কে আপগ্রেড করা) এই পথেই এগোনো হলো।

- [x] নতুন collection: `groups/{groupId}/teacherLinkRequests/{id}` + rules লেখা — **DONE**। `facultyAssignments/{id}/joinRequests` (Phase 1)-এর consent-gate প্যাটার্ন হুবহু মিরর করে বানানো হয়েছে। দুই দিক একই doc shape-এ, `direction` ফিল্ড দিয়ে আলাদা (`cr_to_teacher` / `teacher_to_cr`)। Create/read/update/delete সব আলাদাভাবে গেট করা — update শুধু status/resolvedAt/resolvedBy ফিল্ডে lock, original content (initiatedBy/direction/targetFacultyUid) কখনো বদলানো যায় না। Brace-balance sanity check pass করেছে (354/354)।
- [x] CR → Teacher invite flow — **আংশিক DONE**। `TeacherClaimBanner.jsx` এখন শুধু read-only দেখানো না, আসল "Invite this teacher" বাটন আছে যেটা `teacherLinkRequests.js`-এর `createInviteFromCr()` দিয়ে real request লেখে। Email/directoryEmail anchor **এখনও যোগ করা হয়নি** — শুধু existing fuzzy name-match ব্যবহার হচ্ছে। Banner এখন `canEdit` (CR/ACR-only, `useCanEditGroup` থেকে) দিয়ে গেটেড — সাধারণ ছাত্র এই বাটন দেখবে না বা ট্রিগার করতে পারবে না, যেহেতু rules-ও তাদের এই write আটকাবে।
- [x] Accept হলে identity link — **DONE, দুই ধাপে split করে (rules-এর সাথে সামঞ্জস্যপূর্ণ থাকতে)**। Teacher-এর accept শুধু request-এর status flip করে (`FacultyClassDetail.jsx`-এ নতুন "Class Representative invite" card, join-requests card-এর ঠিক নিচে, হুবহু একই প্যাটার্নে)। CR-এর client (এখনও TeacherClaimBanner-এই) একটা `accepted` status subscription রাখে, দেখলেই `applyLinkAfterAccept()` কল করে routineEntries-এ `linkedFacultyUid`/`linkedAssignmentId` লেখে — সময়/স্লট কখনো ছোঁয়া হয় না, শুধু identity pointer। এই split দরকার ছিল কারণ rules-এ teacher account routineEntries লিখতেই পারে না (`isContentEditor` শুধু CR/ACR/CL/Admin)।
- [x] Decline হলে কিছুই না বদলানো — **DONE**। `declineRequest()` শুধু status flip করে, routineEntries-এ কোনো write হয় না, teacherName free-text আগের মতোই কাজ করে।
- [x] Teacher → CR reverse flow — **DONE**। `facultyDisambiguation.js`-এ নতুন `findMatchingRoutineEntryForAssignment()` যোগ হয়েছে (forward-direction match-এর হুবহু উল্টো: assignment-এর displayName/gridAlias + courseCode দিয়ে সেই একই গ্রুপের routineEntries-এ scan করে, courseCode দিয়ে filter করে false-positive এড়ানো হয়েছে, আর ইতিমধ্যে অন্য কোনো assignment-এর সাথে linked entry স্বয়ংক্রিয়ভাবে skip হয়)। `FacultyClassDetail.jsx`-এ নতুন "Link to Class Representative's grid" card (join-requests/CR-invite card-গুলোর ঠিক নিচে, একই visual প্যাটার্নে) — match পাওয়া গেলে "Propose link" বাটন দেখায় (`createProposalFromTeacher` কল করে), pending থাকলে "Withdraw" দেখায়। CR-side: `TeacherClaimBanner.jsx`-এ নতুন block, existing `pendingRequests` subscription থেকেই `teacher_to_cr` ফিল্টার করে card রেন্ডার করে, Accept করলে `acceptRequest()` + `applyLinkAfterAccept()` দুটোই একসাথে (একই ক্লায়েন্টে, যেহেতু CR নিজেই accept করছে — cr_to_teacher-এর মতো আলাদা subscription-wait দরকার নেই), Decline করলে শুধু status flip। Banner-এর early-return guard-ও ঠিক করা হয়েছে (আগে শুধু name-match suggestion থাকলেই দেখাতো, এখন pending proposal একাও দেখায়)। esbuild syntax-check pass করেছে সব edited ফাইলে (facultyDisambiguation.js, FacultyClassDetail.jsx, TeacherClaimBanner.jsx)।
- [x] Notification wiring — **Phase 1-এর মতোই সামঞ্জস্যপূর্ণভাবে সম্পন্ন**। Real app-wide notification system এখনও নাই (`notify.js` শুধু same-session toast) — উভয় দিকের (cr_to_teacher, teacher_to_cr) live Firestore subscription-ই "notification" হিসেবে কাজ করছে, যেমনটা Phase 1/আগের Phase 3 sub-items-এ ছিল। এটা ইচ্ছাকৃত সিদ্ধান্ত, future scope না এই ফিচারের জন্য দরকার।
- [ ] `facultyDisambiguation.js` + `TeacherClaimBanner.jsx` upgrade — **আংশিক, Phase 4-এর scope-এর সাথে ওভারল্যাপ করে**। TeacherClaimBanner এখন আসল write করে (এটাই মূল upgrade ছিল), কিন্তু grid-এ verified badge UI, CR-side summary view, ইত্যাদি এখনও Phase 4-এই বাকি আছে যেমন প্ল্যান করা ছিল।
- [ ] §6-এর decision points এখনও resolve করা হয়নি (decline-permanent-naki-retry, multi-CR conflict lock policy — আপাতত "first accept wins" ধরে নেওয়া হয়েছে rules-এ, কিন্তু এটা প্রোডাক্ট-লেভেলে কনফার্ম করা হয়নি), `joinFacultyAssignment` consent gap আগেই Phase 1-এ resolved হয়ে গেছে তাই এই আইটেমটা আর প্রযোজ্য না।

---

### Phase 4 — CR ↔ Teacher Linking: UI + Verified Display
**Status: ✅ DONE**

- [x] Grid-এ verified badge UI — **DONE**। `Schedule.jsx`-এ নতুন `LinkedTeacherBadge` কম্পোনেন্ট, existing `BlueTick.jsx`-এর green (faculty) variant পুনর্ব্যবহার করে (নতুন কোনো badge shape বানানো হয়নি, app-wide "verified" convention-এর সাথে সামঞ্জস্যপূর্ণ থাকতে)। শুধু `routineEntries.linkedFacultyUid` সেট থাকলেই দেখায় — CR-এর দেওয়া `teacherName` primary label হিসেবেই থাকে, কখনো replace হয় না, badge শুধু পাশে বসে। ক্লিক করলে lazy-fetch করে (`getFacultyProfile`) real profile name popover-এ দেখায়। দুই জায়গায় বসানো হয়েছে: desktop/mobile main week-grid cell (`Teacher: {name}`-এর পাশে) আর mobile day-detail list cell (`→ {name}`-এর পাশে)।
- [x] CR-side summary view — **DONE, count-only aggregate দিয়ে**। Phase 0-এর constraint (marks কখনো CR-কে দেখানো যাবে না, শুধু status) মেনে নতুন পথ বানানো হয়েছে: `facultyMarksSync.js`-এ নতুন `recomputeMarksSummary()` — `saveStudentMarks`/`sendAllReviewed`-এর পর fire-and-forget কল হয়, `studentRecords` স্ক্যান করে **শুধু count** (draft/reviewed/sent/total, কোনো grade value বা per-student data না) বের করে **parent `facultyAssignments` doc**-এ (`marksSummary` ফিল্ড) লেখে — এই doc-এ CR/ACR-এর আগে থেকেই read access আছে (`isGroupMember()`), তাই নতুন কোনো rules change লাগেনি, আর `studentRecords`-এর নিজের read rule (Phase 0-এ CR/ACR থেকে বন্ধ করা) অপরিবর্তিত/অক্ষত থাকল। `LinkedTeacherBadge`-এর একই popover-এ badge ক্লিক করলে এই summary-ও দেখায় ("Marks: X sent · Y reviewed · Z draft (of total)")।
- [x] Multi-CR conflict handling — **DONE, তোমার section-scoping observation অনুযায়ী confirm করে**। ট্রেস করে দেখা গেল `getGroupId()` আগে থেকেই multi-section dept (CE/EEE/ME/CSE)-এ `section` fold করে নেয় (`groupUtils.js`) — মানে CSE sec 1-এর CR আর sec 2-এর CR আসলে দুইটা আলাদা `groups/{groupId}` doc-এ, কখনো একই `teacherLinkRequests` doc দেখতেই পারে না। তাই আসল conflict শুধু **একই section**-এর একাধিক CR/ACR race করে একই request accept করলে হতে পারে — এই সংকীর্ণ কেসে "first accept wins" implement করা হয়েছে: `teacherLinkRequests.js`-এর `acceptRequest()` এখন accept সফল হওয়ার পর একই `entryId`+`direction`-এর অন্য যেকোনো pending sibling request স্বয়ংক্রিয়ভাবে declined করে দেয় (best-effort, non-blocking — এই cleanup fail করলেও মূল accept-টা আগেই সফল হয়ে গেছে ধরে নেওয়া হয়)।
- [x] Decline-retry policy — **DONE, "manual only" হিসেবে resolve করা হয়েছে**। `teacherLinkRequests.js`-এ নতুন `wasDeclinedFor(groupId, entryId, direction)` — কোনো pair আগে decline হয়ে থাকলে সেটা **passive auto-suggest UI**-তে (TeacherClaimBanner-এর matches, FacultyClassDetail-এর "Link to CR's grid" card) আর দেখানো হয় না, কিন্তু এটা কখনো কোনো write আটকায় না — deliberate manual re-invite/re-propose সবসময় সম্ভব থাকে (এই পুরো ফিচারের "convenience, not a gate" নীতির সাথে সামঞ্জস্যপূর্ণ)। দুই দিকেই wired: CR-side matches filter করা হয়েছে (cr_to_teacher direction), teacher-side routineMatch filter করা হয়েছে (teacher_to_cr direction)।
- [x] `facultyDisambiguation.js` + `TeacherClaimBanner.jsx` — **DONE**। কোনো dead code পাওয়া যায়নি upgrade/সরানোর মতো (dismiss-vs-decline দুটো ইচ্ছাকৃতভাবে আলাদা concept — dismiss শুধু local/per-device hide, decline server-side real action, দুটোই এখনো দরকার)। যেটা পাওয়া গেছে: `facultyDisambiguation.js`-এর file header-এ পুরনো stale claim ছিল ("READ-ONLY enrichment layer", "no existing file was edited to support this") — এগুলো Phase 3/4-এর পর আর সত্যি না (real write path আছে এখন, আর Schedule.jsx সরাসরি edit হয়েছে badge UI-এর জন্য)। দুই ফাইলের header-ই আপডেট করে সঠিক ইতিহাস লেখা হয়েছে (§10-এর stale-documentation নীতি মেনে)। `TeacherSelector.jsx` — আলাদা, আগে থেকেই dead/unreferenced ফাইল, এই ফিচারের scope-এর বাইরে, touch করা হয়নি।

---

### Phase 5 — End-to-End Testing + Final Cleanup
**Status: ⬜ NOT STARTED**

- [ ] End-to-end টেস্ট: CR invite → teacher accept → grid badge → CR summary view
- [ ] End-to-end টেস্ট: teacher creates class → CR notified → accept → link, decline path
- [ ] End-to-end টেস্ট: `joinFacultyAssignment` consent flow (Phase 1 থেকে)
- [ ] Firestore rules-এর পূর্ণ emulator regression টেস্ট (সব phase-এর rules একসাথে)
- [ ] সব phase-এর checklist ক্রস-চেক করে কিছু বাদ পড়েছে কিনা দেখা, ডকুমেন্টেশন (CURRENT.md ফাইলগুলো) final আপডেট

---

**পরবর্তী মেসেজে বলবে কোন Phase দিয়ে শুরু করতে চাও। Phase 0 → 5 ক্রমানুসারে করাই সবচেয়ে নিরাপদ (প্রতিটা পরের ধাপ আগেরটার উপর নির্ভর করে), কিন্তু চাইলে যেকোনো একটা phase আলাদাভাবেও শুরু করতে পারো।**


