# KUETx — Teacher-ID Migration + Sessional Scheduling Fix — Plan Prompt

> **Resume instruction:** এই প্ল্যান যদি আবার কোনো নতুন AI সেশনে দেওয়া
> হয়, নিচের progress badge দেখে যেই ফেজ TODO/IN PROGRESS আছে সেখান
> থেকে শুরু করো। নিচের সব ফেজ এখন `[x] DONE, verified` — কোনো নতুন কাজ
> এলে সেটা [`CURRENT.md`](./CURRENT.md)-এ যোগ হবে, এই ফাইলে না, যদি না
> নতুন কোনো বড় মাল্টি-ফেজ কাজ শুরু হয়।

## Progress badge

- [x] **Phase 1 — Section 2: sessional/lab টাইপের জন্য teacher field সরানো** — DONE, verified
- [x] **Phase 2 — Section 1: teacher-ID migration (registry + key rewrite + rename bugfix)** — DONE, verified
- [x] **Phase 3 — Section 3: sessional/lab alternating-week cadence** — DONE, verified

---

## 1. Context / Goal

মূল সমস্যা (ব্যবহারকারীর `IMPLEMENTATION_PROMPT.md`-তে দেওয়া, পুরো
টেক্সট `documentation/00-old-data/03-features/attendance-and-scheduling/IMPLEMENTATION_PROMPT_original.md`-এ
সংরক্ষিত আছে):

1. **টিচারের নাম বদলালে অ্যাটেনডেন্স/মার্কস হারিয়ে যায়** —
   অ্যাটেনডেন্স/মার্কস key `${courseId}_${teacherName}` — নাম
   দিয়ে বানানো হতো, কোনো স্টেবল id ছাড়াই। নাম বদলালে পুরনো ডেটা
   silently orphan হয়ে যেত।
2. **Sessional/Lab ক্লাসে জোর করে টিচার সিলেক্ট করাতে হতো** — যদিও
   এই টাইপের ক্লাসের নির্দিষ্ট কোনো টিচার থাকে না।
3. **Sessional/Lab কোর্স alternating week-এ চলে** (এক সপ্তাহ হয়,
   পরের সপ্তাহ হয় না) — কিন্তু অ্যাপে এই প্যাটার্ন মডেল করার কোনো
   কোড ছিল না, শুধু ব্লান্ট app-wide `holidayDates` ছিল।

## 2. Phases

### Phase 1 — Section 2 ✅
**কী করতে হয়েছে:** `Schedule.jsx`-এর Add/Edit Class ফর্মে (main +
quick-add দুটোতেই) "Teacher (Select One)" ফিল্ড + সংশ্লিষ্ট বাটন/হিন্ট
টেক্সট `isSessionalType(type)` হলে হাইড করা, আর সেভ-পাথে কোনো
fallback টিচার জোর করে না বসানো।

**টাচ হওয়া ফাইল:** `src/pages/Schedule.jsx`

**Done হওয়ার শর্ত:**
- Type = Sessional সিলেক্ট করলে Teacher ফিল্ড সাথে সাথে হাইড হয়
- Sessional এন্ট্রি সেভ করলে কোনো `teacherName` অ্যাটাচ থাকে না
- Theory থেকে Sessional-এ টাইপ বদলালে আগের teacher ভ্যালু ক্লিয়ার হয়ে যায়

### Phase 2 — Section 1 ✅
**কী করতে হয়েছে:**
- নতুন `src/lib/teacherRegistry.js` — group-shared
  `{teacherId: name}` registry, নাম↔id resolver ফাংশন, one-time
  idempotent মাইগ্রেশন pure function।
- `courseTeacherMap` group mode-এ নাম থেকে id-তে বদলানো (local mode
  ইচ্ছাকৃতভাবে নাম-ভিত্তিকই)।
- `App.jsx`-এ CR/ACR-only boot-time মাইগ্রেশন effect।
- সব display-only consumer (Courses.jsx, TermQS.jsx, Assignments.jsx,
  TermPlanner.jsx, CTQuizPlanning.jsx, ClassSetupTermCourses.jsx) —
  id→name resolve করে দেখানো।
- সব write site (ClassSetup.jsx, ClassSetupModal.jsx,
  useClassManagementState.js, Schedule.jsx) — নাম→id resolve করে লেখা।
- **rename bugfix:** `resolveTeacherIdsForNames`-এ `existingIds`
  parameter যোগ — deliberate rename (retyped নাম যেটা পুরনো বানানের
  সাথে ম্যাচ করে না) এখন positional slot অনুযায়ী পুরনো id-ই reuse
  করে, নতুন id মিন্ট করে না।

**টাচ হওয়া ফাইল:** `src/lib/teacherRegistry.js` (নতুন), `App.jsx`,
`ClassSetup.jsx`, `ClassSetupModal.jsx`, `ClassSetupTermCourses.jsx`,
`useClassManagementState.js`, `Schedule.jsx`, `Courses.jsx`,
`TermQS.jsx`, `Assignments.jsx`, `TermPlanner.jsx`,
`CTQuizPlanning.jsx`, `Attendance.jsx` (শুধু fallback display path),
`facultyDisambiguation.js` (comment fix)।

**Done হওয়ার শর্ত:**
- টিচার rename করলে সেই টিচারের সব পুরনো অ্যাটেনডেন্স/মার্কস (whole-course
  total এবং per-teacher breakdown, দুটোই) নতুন নামের নিচে ঠিক থাকে
- কোনো ফাইলে raw teacherId ডিসপ্লে হয় না
- `CourseTeacherDialog.jsx` ছাড়া আর কোথাও free-text টিচার ইনপুট নেই
  (dead/unreachable কোড বাদে — `GroupSchedule.jsx`/`TeacherSelector.jsx`,
  কোনো ফাইল থেকে import হয় না, তাই স্কোপের বাইরে)
- `npx esbuild src/App.jsx --bundle --packages=external --loader:.jsx=jsx` পাস করে

### Phase 3 — Section 3 ✅
**কী করতে হয়েছে:**
- নতুন `src/lib/sessionalCadence.js` (pure functions) —
  `getBaselineOccurrence`, `getEffectiveOccurrence`, `isSessionalOff`,
  `toggleDateOverride`, `shiftCadenceFrom`, `defaultCadenceForNewSlot`।
- `groupSync.js`-এ writer (`setSessionalCadence`/`clearSessionalCadence`)।
- `todayItems.js` + `Attendance.jsx`-এর `getScheduleCoursesForDate` —
  effective occurrence 'off' হলে সেই সপ্তাহে ক্লাস স্কিপ।
- `useClassManagementState.js` + `ClassRoutine.jsx`-এ cadence প্যানেল
  (mode/anchor/override/shift), শুধু Sessional/Lab এন্ট্রিতে।
- `App.jsx`-এর mirror guard-এ `sessionalCadence` তুলনা যোগ।

**টাচ হওয়া ফাইল:** `src/lib/sessionalCadence.js` (নতুন),
`src/lib/todayItems.js`, `src/pages/Attendance.jsx`,
`src/pages/useClassManagementState.js`, `src/pages/ClassRoutine.jsx`,
`src/lib/groupSync.js`, `src/App.jsx`।

**Done হওয়ার শর্ত:**
- নতুন Sessional স্লট ডিফল্টভাবে alternating cadence পায়, শূন্য এক্সট্রা
  কনফিগারেশনে
- একদিন ক্যান্সেল করলে অন্য কোনো তারিখ প্রভাবিত হয় না
- মেকআপ/এক্সট্রা সেশন যোগ করলে anchorDate টাচ করতে হয় না
- "shift from here" শুধু ভবিষ্যতের তারিখ re-anchor করে, পুরনো তারিখ
  অপরিবর্তিত থাকে
- Theory স্লট সম্পূর্ণ অপ্রভাবিত (`isSessionalType` গার্ড UI-তে কনফার্ম করা)
- `npx esbuild src/App.jsx --bundle --packages=external --loader:.jsx=jsx` পাস করে

## 3. Verification যা সত্যিই চালানো হয়েছে (দাবি না, রান করে দেখা)

- `npx esbuild src/App.jsx --bundle --packages=external --loader:.jsx=jsx`
  — ক্লিন, কোনো error নেই (শেষবার রান: এই সেশনে)
- `sessionalCadence.js`-এর ২৮টা standalone assertion (alternating/weekly/manual
  মোড, override precedence, non-mutation, shift preserves overrides) —
  সব পাস
- `teacherRegistry.js`-এর rename-bugfix-এর ১০টা standalone assertion
  (positional id reuse, cross-course name-match fallback, ghost-id
  fallback) — সব পাস

## 4. এখনো যা বাকি (লাইভ টেস্ট, কোড-লেভেলে না)

কোনো লাইভ browser/Vercel টেস্ট এখনো হয়নি — শুধু esbuild বান্ডল চেক আর
standalone Node script দিয়ে pure-function টেস্ট করা সম্ভব হয়েছে এই
পরিবেশে। Akhinoor-কে হাতে চেক করতে হবে:

- Firestore round-trip: `setSessionalCadence`/`clearSessionalCadence`
  আসলেই লিখছে ও অন্য ডিভাইসে সিঙ্ক হচ্ছে কিনা
- একজন টিচারকে rename করে Live Attendance card + per-teacher breakdown
  (Combined mode-সহ) ঠিক থাকে কিনা কনফার্ম করা
- Today page/Daily Log-এ একটা "off week" সেশনাল সত্যিই হাইড হচ্ছে
  কিনা

এই তিনটা লাইভ চেক ছাড়া phase-গুলো "code-complete, build-clean" —
কিন্তু production-এ পুশ করার আগে অন্তত একবার হাতে ট্রেস করে দেখা
recommended (যেমনটা মূল `IMPLEMENTATION_PROMPT.md`-ও শেষে বলেছিল)।
