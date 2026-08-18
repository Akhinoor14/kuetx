# TASK: Rotating stat card — content update

`src/pages/LandingPage.jsx`-এ `StatsStrip`/`RotatingStatCard`/`BASE_STATS`
ইতিমধ্যে বানানো আছে (hero-এর নিচে, আগে যেখানে static ৬২+/৩/১০০% ছিল সেই
জায়গায়) — এই prompt শুধু তার **content সম্প্রসারণ**, নতুন mechanism বানানোর
দরকার নেই।

বর্তমানে `BASE_STATS`-এ ৩টা static fact আছে (৬২+ ফিচার, ৩ Role, ১০০% ফ্রি),
আর `StatsStrip` ফাংশনে `useQuestionBankData()` থেকে ২টা live QB card append
হয় (`deriveQBShowcaseStats` via `src/hooks/useQBShowcaseStats.js`)।

## কাজ: আরও ৭টা static qualitative card যোগ করা

`BASE_STATS` অ্যারের ধরন অনুসরণ করে (`{ id, display, label }`), অথবা যদি
এই কার্ডগুলোর কোনো ছোট "headline number" না থাকে (যেমন Publications-এর
সংখ্যা `৫,৮৫৬`-কে display বানানো যায়, কিন্তু Pick and Drop-এর কোনো number
নেই), তাহলে `display` field-এ ছোট একটা icon/emoji বা প্রাসঙ্গিক শব্দ
(যেমন "নতুন" জাতীয় কিছু না — বরং আসল descriptive শব্দ) ব্যবহার করে, আর
পুরো detail `label`-এ রাখা যেতে পারে। প্রতিটা entry নিচের ভেরিফায়েড কনটেন্ট
হুবহু ব্যবহার করবে — কোনো re-write বা re-interpret না, কারণ প্রতিটা লাইন
codebase থেকে সরাসরি verify করা হয়েছে ownerর সাথে multi-round correction-এর
মাধ্যমে।

### নতুন কার্ডগুলোর কনটেন্ট (verified, চূড়ান্ত):

1. **Publications**
   label: "৪৩৬ জন শিক্ষকের ৫,৮৫৬টি রিসার্চ পাবলিকেশন, ২৪টি ডিপার্টমেন্ট
   জুড়ে — যে কেউ নিজের বা অন্য কারো পাবলিকেশন যোগ করতে পারে"
   (source: `documentation/HANDOFF_publications_merged.md`,
   `src/components/SuggestPublicationModal.jsx` — যেকোনো signed-in user
   নিজের/অন্যের পাবলিকেশন suggest করতে পারে, নিজের হলে সরাসরি লেখা যায়)

2. **Pick and Drop**
   label: "Student বা Faculty যে কেউ errand পোস্ট করতে পারে (কিছু কিনে
   আনা, ডেলিভারি করা, ছোটখাটো কাজ), সব student-এর কাছে যায় — যেকোনো
   student accept করতে পারে, নিজেই দাম প্রস্তাব করা যায় বা ফ্রিও রাখা
   যায় — ফাঁকা সময়ে টাকা আয়েরও একটা উপায়"
   (source: `src/lib/errandRequests.js`, `src/pages/ErrandFeed.jsx` —
   owner-clarified: faculty request করতে পারে কিন্তু ব্যবহারিকভাবে সবই
   student-এর কাছে যায়/student accept করে; `proposedPrice`/`isFree`
   দিয়ে দাম customizable)
   ⚠️ landing copy-তে বা যেকোনো জায়গায় ইংরেজি শব্দ **"errand"** ব্যবহার
   করা যাবে না — owner-এর মতে বেশিরভাগ মানুষ এই শব্দ বুঝবে না। এর বদলে
   বাংলায় বর্ণনামূলক ভাষা ব্যবহার করা (যেমন "কাজ করিয়ে নেওয়া", "ছোটখাটো
   কাজ" ইত্যাদি) — উপরের label-এ যেভাবে লেখা হয়েছে সেভাবেই, কোথাও
   "এরান্ড" শব্দ না বসানো।

3. **Solution Bank**
   label: "এখন পর্যন্ত ESE ডিপার্টমেন্টের Y2T1-এ Computer Programming ও
   Fluid Mechanics-এর ধাপে ধাপে সমাধান আছে — ধীরে ধীরে আরও কোর্স ও
   ডিপার্টমেন্ট যোগ হচ্ছে"
   (source: `public/solution-data/index.json` — verified: বর্তমানে শুধু
   ESE, Y2T1, ২টা কোর্স কভার করা আছে, এটা ছোট স্কেলে overstate না করা)

4. **Attendance**
   label: "Student নিজে নিজের personal attendance ট্র্যাক করতে পারে —
   আর Faculty অফিসিয়াল ক্লাস attendance নেয় (মূলত Present/Absent,
   প্রয়োজনে Late/Excused-ও সেট করা যায়), যেটা মার্কসের সাথে যুক্ত হয়ে
   যায়"
   (source: `src/pages/Attendance.jsx` — student self-tracking, শুধু
   present/absent, local/personal, official record না;
   `src/pages/faculty/FacultyClassDetail.jsx`-এর `AttendanceTab` —
   faculty official attendance, quick-toggle মূলত Present/Absent,
   Late/Excused একটা secondary "..." বাটনের ভেতরে থাকা option, owner
   অনুযায়ী প্র্যাক্টিক্যালি এটাই মূল ব্যবহার না তাই headline-এ জোর না
   দেওয়া)

5. **CR Toolset**
   label: "CR হলে Class Setup, Routine, Class Planner, CT & Quiz
   Planner, Class Announcements-সহ ৫+ এক্সট্রা টুল পাওয়া যায়"
   (source: `src/data/landingFeatureInventory.js`-এর `CR_FEATURES`)

6. **My Classes (Faculty)**
   label: "একটা ক্লাসে ৭টা রিয়েল টুল — Syllabus, Question Bank,
   Students & CR, Marks, Attendance, Schedule, Notices"
   (source: `src/pages/faculty/FacultyClassDetail.jsx`-এর `TABS` array)

7. **Online Mart**
   label: "Student চাইলে আলাদা একটা Provider account খুলে নিজের Online
   Mart চালু করতে পারে — student account থেকে সরাসরি না, শর্ত মেনে
   আলাদাভাবে provider হিসেবে যোগ দিতে হয়"
   (source: owner-confirmed — Online Mart student-এর জন্য একটা
   entrepreneurship pathway, কিন্তু এটা student role-এর ভেতরের ফিচার
   না, বরং student আলাদা Provider account খুলে করে; `src/hooks/
   useIsProvider.js`, `src/lib/serviceCategoryConfig.js`-এর `onlinemart`
   category। এই পয়েন্টে আর কোনো নতুন code-investigation দরকার নেই,
   owner ইতিমধ্যে confirm করেছে — শুধু এই টেক্সটাই ব্যবহার করতে হবে)

## যা এখনো card-এ যাবে না (শুধু feature-list-এ থাকবে)

Today, Class Schedule/My Schedule, Syllabus, Term Planner, Money, Namaz
Tracker, Notes, Tours, Academic Self-Study, Deep Focus — এগুলোর কোনো
strong "headline" angle নেই বলে rotating card থেকে বাদ, কিন্তু
`FeatureBreakdown` section-এ (Student/Faculty/Provider ট্যাবের নিচে)
আগের মতোই bullet আকারে থাকবে, কোনো পরিবর্তন নয়।

## Implementation নোট

- সব label বাংলায়, plain text — কোনো নতুন visual/emoji/color scheme
  বানানোর দরকার নেই, existing `RotatingStatCard` component-এর ভেতরেই
  বসবে।
- QB-এর ২টা লাইভ কার্ড (total papers, top department) অপরিবর্তিত থাকবে
  — সেগুলো `useQuestionBankData()` থেকে dynamically আসে, static array-তে
  hardcode করা যাবে না।
- মোট card সংখ্যা দাঁড়াবে: ৩ (base static) + ২ (QB live, conditional)
  + ৭ (নতুন qualitative) = সর্বোচ্চ ১২টা, rotate করবে `ROTATE_MS` (৪৫০০ms)
  ইন্টারভালে, existing pause-on-hover/dot-navigation/prefers-reduced-motion
  সব যেমন আছে তেমনই থাকবে।
- কোনো নতুন Firestore read/rule change লাগবে না — সবগুলো static fact,
  QB বাদে।
