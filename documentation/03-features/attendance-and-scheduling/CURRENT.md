# Attendance & Scheduling — Current Status

> **এই ফাইলটাই এই ফিচারের একমাত্র active doc। নতুন কাজ/আপডেট হলে নতুন
> ফাইল না বানিয়ে এই ফাইলটাই এডিট করবে।**
>
> এই ফিচারের বড়, মাল্টি-ফেজ কাজের plan-prompt ফাইল (progress badge-সহ,
> নতুন সেশনে সরাসরি ফিড করার জন্য):
> [`TEACHER_ID_SESSIONAL_PLAN_PROMPT.md`](./TEACHER_ID_SESSIONAL_PLAN_PROMPT.md)
>
> **আলাদা related ফিচার:** Faculty Attendance Tab-এর রোস্টার/UI/এক্সপোর্ট/
> co-teacher রিবিল্ড (এই ফোল্ডারের স্কোপের বাইরে, নিজস্ব ফোল্ডারে) —
> [`../attendance-rebuild/CURRENT.md`](../attendance-rebuild/CURRENT.md)

---

## ফিচার কী

Class Routine (Schedule), Attendance (Daily Log / Live Attendance /
Combined mode), আর TermPlanner-এর মার্কস/অ্যাটেনডেন্স — এই তিনটা একে
অপরের সাথে জড়িত এরিয়া, একই `courseTeacherMap` / attendance-key ডেটা
মডেল শেয়ার করে।

## এখন পর্যন্ত যা হয়েছে

### Section 2 — Sessional/Lab ক্লাসে জোর করে টিচার সিলেক্ট করানো বন্ধ ✅
`Schedule.jsx`-এর Add/Edit Class ফর্মে Teacher ফিল্ড এখন
`isSessionalType(type)` হলে সম্পূর্ণ হাইড হয়ে যায় (main form +
quick-add form দুটোতেই), আর সেভ-পাথে কোনো fallback টিচার আর জোর করে
বসে না।

### Section 1 — টিচার আইডি মাইগ্রেশন ✅
- নতুন `src/lib/teacherRegistry.js` — group-shared
  `{teacherId: name}` registry, `resolveTeacherIdsForNames` /
  `resolveTeacherNames` / `migrateCourseTeacherMapToIds`।
- `courseTeacherMap` এখন group mode-এ নাম না রেখে `teacherId` রাখে
  (local/non-group mode ইচ্ছাকৃতভাবে নাম-ভিত্তিকই থেকে গেছে — কারণ
  single-device ইউজারের জন্য কোনো collision risk নেই)।
- One-time, idempotent client-side মাইগ্রেশন `App.jsx`-এ, শুধু CR/ACR-এর
  ক্লায়েন্ট থেকেই write হয় (`subscribeMyRole` দিয়ে ভেরিফাই করা রোল,
  self-ticked `profile.isCR` না)।
- 12+ ফাইল আপডেট হয়েছে যাতে display করার সময় id→name ঠিকভাবে resolve
  হয় — Courses.jsx, TermQS.jsx, Assignments.jsx, TermPlanner.jsx,
  CTQuizPlanning.jsx, ClassSetup.jsx, ClassSetupModal.jsx,
  ClassSetupTermCourses.jsx, useClassManagementState.js, Schedule.jsx,
  Attendance.jsx (শুধু fallback display path), facultyDisambiguation.js
  (comment fix)।
- **`Attendance.jsx`-এর মূল অ্যাটেনডেন্স/মার্কস key (`attLogs`,
  `attRotationLog`) ইচ্ছাকৃতভাবে নাম-ভিত্তিকই রাখা হয়েছে** — কারণ
  `getEffectiveForCourse` (whole-course prefix-sum) এমনিতেই rename-প্রুফ,
  আর routine entry-র `teacherName` সবসময় resolver দিয়ে fresh resolve
  হয়, তাই এই লেয়ারে id migration আসলে দরকার ছিল না।

#### 🔧 বাগ পাওয়া গেছে ও ফিক্স করা হয়েছে (এই সেশনে)
`CombinedAtt`-এর per-teacher breakdown (`getEffective()`) আর combined-mode-এর
`${courseId}_${teacherName}` key এখনও নাম-ভিত্তিক ছিল — মানে কোনো
নির্দিষ্ট টিচারের নাম বদলালে সেই টিচারের নিজস্ব সারিটার পুরনো ডেটা
ডিটাচ হয়ে যেত (whole-course total ঠিক থাকলেও, per-teacher breakdown
ভুল দেখাতো)।

আসল root cause আরও গভীরে ছিল: `CourseTeacherDialog.jsx` free-text
হওয়ায়, কোনো CR যখন সত্যিকারের rename করতো (টাইপো ফিক্স, "Sir" →
"Ma'am"), `resolveTeacherIdsForNames` পুরনো বানানের সাথে case-insensitive
match না পেয়ে **নতুন teacherId মিন্ট করে ফেলতো** — অর্থাৎ পুরো ID
সিস্টেমটাই যেই সমস্যা সমাধান করার জন্য বানানো হয়েছিল, সেই একই সমস্যা
একধাপ উপরে (নাম থেকে id লেয়ারে) থেকেই যাচ্ছিল।

**ফিক্স:** `resolveTeacherIdsForNames` এখন একটা optional
`existingIds` array নেয় — সেই কোর্সের বর্তমান teacherId লিস্ট, একই
positional order-এ যেই order-এ `CourseTeacherDialog`-এর
`currentTeachers` prop সাজানো থাকে। কোনো slot-এ আগে থেকেই id থাকলে,
নতুন টাইপ করা নাম সেই **একই id**-তে বসে (rename in place) — নাম
ম্যাচ করার দরকার পড়ে না। চারটা write site-ই (`ClassSetup.jsx`,
`ClassSetupModal.jsx`, `useClassManagementState.js`,
`Schedule.jsx`) আপডেট হয়েছে এই নতুন প্যারামিটার পাস করার জন্য।

### Section 3 — Sessional/Lab alternating-week cadence ✅
- নতুন `src/lib/sessionalCadence.js` (pure functions) —
  `getBaselineOccurrence`, `getEffectiveOccurrence`, `isSessionalOff`,
  `toggleDateOverride`, `shiftCadenceFrom`, `defaultCadenceForNewSlot`।
  ২৮টা assertion দিয়ে হ্যান্ড-টেস্ট করা (alternating/weekly/manual মোড,
  override precedence, non-mutation, shift-এ পুরনো override ঠিক থাকে) —
  সব পাস।
- `groupSync.js`-এ `setSessionalCadence`/`clearSessionalCadence` —
  আগে থেকেই লেখা ছিল, একই `plannerSettings.scheduleFields` doc/merge
  প্যাটার্ন অনুসরণ করে।
- `todayItems.js` আর `Attendance.jsx`-এর `getScheduleCoursesForDate`
  দুই জায়গাতেই effective occurrence চেক হয় — 'off' সপ্তাহে সেশনাল
  ক্লাস Today page/Daily Log-এ দেখায় না।
- `useClassManagementState.js` + `ClassRoutine.jsx`-এ পূর্ণ cadence
  প্যানেল (mode picker, anchor date, per-date on/off toggle, "shift
  from here") — শুধু Sessional/Lab এন্ট্রিতে, একটা 📆 বাটন দিয়ে খোলে।
  Theory স্লট এই বাটনই পায় না (`isSessionalType` গার্ড কনফার্ম করা)।
- `App.jsx`-এর `scheduleFields` → local `scheduleSettings` mirror-এ
  `sessionalCadence` তুলনা যোগ করা হয়েছে — নাহলে শুধু cadence বদলালে
  সেটা silently discard হয়ে যেত।

## ⚠️ এই সেশনে যা নতুন ভেরিফাই হয়েছে (আগের progress doc দুইবার ভুল দাবি করেছিল)

আগের progress doc (`00-old-data/03-features/attendance-and-scheduling/`-এ
সরানো) দুইবার দাবি করেছিল `src/lib/sessionalCadence.js` লেখা হয়ে
গেছে, ২৭টা টেস্ট পাস করেছে — কিন্তু বাস্তবে ফাইলটা ডিস্কেই ছিল না,
আর অ্যাপের বিল্ড ব্রেক করছিল (৩টা "Could not resolve" এরর)। এই
সেশনে ফাইলটা সত্যিই লেখা হয়েছে ও এই দাবিগুলো সরাসরি চালিয়ে
ভেরিফাই করা হয়েছে —

- `npx esbuild src/App.jsx --bundle --packages=external
  --loader:.jsx=jsx` — ক্লিন, কোনো এরর নেই
- `sessionalCadence.js`-এর ২৮টা assertion — সব পাস
- `teacherRegistry.js`-এর rename-bugfix-এর ১০টা assertion — সব পাস

## সর্বশেষ অবস্থা

তিনটা সেকশনই কোড-লেভেলে সম্পূর্ণ এবং বিল্ড ক্লিন। **লাইভ
manual/browser টেস্ট এখনো বাকি** — Firestore round-trip
(`setSessionalCadence`/`clearSessionalCadence`), rename করার পর
Live Attendance card ও per-teacher breakdown সত্যিই ঠিক থাকে কিনা,
আর Today page/Daily Log-এ "off week" সেশনাল সত্যিই হাইড হয় কিনা —
এইগুলা Vercel/dev এনভায়রনমেন্টে হাতে চেক করা দরকার।

নতুন কোনো কাজ হলে এই সেকশনেই যোগ করো।
