# KUETx — Public Landing / Cross-Role Demo Mode — Plan-Prompt

> এই ফাইলটা project convention অনুযায়ী (`documentation/README.md`, §৪
> "Phase-wise Plan-Prompt ডকুমেন্ট") একটা standalone, self-contained,
> runnable প্রম্পট। এটা `CURRENT.md` না — এটা যেকোনো নতুন AI সেশনে
> কপি-পেস্ট করে দিলে সেই সেশন নিজে থেকেই বুঝে নেবে কী করতে হবে, কোন
> ফেজ পর্যন্ত হয়েছে, আর পরের ফেজ থেকে কীভাবে শুরু করবে। **কোনো নতুন
> রিসার্চ ছাড়াই এই ফাইল পড়েই কাজ শুরু করা সম্ভব হওয়া উচিত** — সব
> verified finding, gap, আর reasoning এখানেই লেখা আছে।

---

## 📊 PROGRESS BADGE (সবসময় আপ-টু-ডেট রাখতে হবে, প্রতিটা ফেজ শেষে)

| Phase | নাম | Status |
|---|---|---|
| 0 | পূর্ববর্তী Guest-Mode কাজের সাথে সমন্বয় (আবশ্যিক, সবার আগে) | `[x] DONE` |
| A | Public Landing / "Guest Room" পেজ (`/`) | `[x] DONE` |
| B | Shared Presentational Component Extraction | `[~] IN PROGRESS — student slice done (StatCard, AttendanceHero); DailyLog/CourseCard/CourseListRow/ServicesPreviewRow still pending` |
| C | Student Demo (নতুন, shared component + demo dataset ভিত্তিক) | `[~] IN PROGRESS — stat tiles + attendance hero wired, real nav NOT reused (blocker found), schedule/shop-order preview still open` |
| D | Faculty Demo | `[ ] TODO` |
| E | Provider Demo | `[ ] TODO` |
| F | Cross-Role Data Wiring + Dataset চূড়ান্তকরণ | `[ ] TODO` |
| G | Role-Aware Guide System (আগের প্ল্যানের Phase 5, এখনো বাকি) | `[ ] TODO` |
| H | Sign-In Prompt, Bounce-back, Mockup Toggle, Polish, QA | `[ ] TODO` |
| I | `About.jsx` Feature-List আপডেট (ভিন্ন কিন্তু related backlog item) | `[ ] TODO` |

**Resume instruction:** এই প্ল্যান নতুন সেশনে দেওয়া হলে, উপরের badge
দেখে যেই ফেজ `TODO`/`IN PROGRESS` আছে সেখান থেকে শুরু করো। আগের `DONE`
ফেজ আবার করার দরকার নেই — কিন্তু DONE ফেজের "Findings" সাব-সেকশনটা
অবশ্যই পড়ে নাও, কারণ পরের ফেজ প্রায়ই আগের ফেজের আবিষ্কার করা ডিটেইলের
ওপর নির্ভর করে।

### প্রস্তাবিত execution order (ফেজ নম্বর ক্রমে না, বাস্তবে যেভাবে করা উচিত)

Phase B ("Shared Presentational Component Extraction") একবারে পুরোটা
করার দরকার নেই — বরং প্রতিটা role-demo বানানোর ঠিক আগে সেই role-এর
জন্য যতটুকু extraction লাগে ততটুকুই করা উচিত। প্রস্তাবিত ক্রম:

```
Phase 0 → Phase A → Phase B(শুধু student অংশ) → Phase C
        → Phase B(শুধু faculty অংশ) → Phase D
        → Phase B(শুধু provider অংশ) → Phase E
        → Phase F → Phase G → Phase H → Phase I
```

এতে কাজ ছোট ছোট, প্রতি ধাপে verify-করা-যায় এমন অংশে ভাগ হয়, আর মাঝপথে
থামলেও প্রতিটা ধাপ standalone-ভাবে কাজ করে (অসম্পূর্ণ কোনো বড় extraction
ঝুলে থাকে না)। Badge টেবিলে Phase B-এর জন্য একটাই status থাকলেও,
বাস্তবায়নের সময় এই sub-split মাথায় রাখতে হবে — Phase C শুরু করার আগে
পুরো Phase B "DONE" হওয়া লাগবে না, শুধু student-related অংশ হলেই চলবে।

### Effort/Time Estimate (আনুমানিক, প্রতিটা ফেজের জন্য)

Clock-time না — availability-নির্ভর, তাই development-session হিসেবে
আনুমানিক effort + dependency দেওয়া হলো (ছোট-বড় bug ফিক্সের বাফার-সহ):

| ফেজ | কাজ | আনুমানিক effort | নির্ভরতা |
|---|---|---|---|
| **0** | পূর্ববর্তী কাজের সাথে সমন্বয় (pure investigation) | ছোট | কিছুই না, সবার আগে |
| **A** | Landing/guest-room পেজ | ছোট–মাঝারি | Phase 0-এর পর |
| **B** | Presentational component extraction (৩ role মিলিয়ে মোট) | মাঝারি–বড় (সবচেয়ে বেশি সাবধানতা লাগবে, প্রতি extraction-এর পর build verify) | Phase A-এর পর, বা সমান্তরালে শুরু করা যায় |
| **C** | Student demo | মাঝারি | Phase B (student অংশ) |
| **D** | Faculty demo | মাঝারি | Phase B (faculty অংশ) |
| **E** | Provider demo | মাঝারি | Phase B (provider অংশ) |
| **F** | Cross-role wiring + dataset চূড়ান্তকরণ | ছোট–মাঝারি (schema draft প্রায় রেডি) | C, D, E তিনটাই লাগবে |
| **G** | Role-aware Guide system | মাঝারি (আগের প্ল্যানে ডিজাইন করাই আছে, শুধু implement বাকি) | স্বাধীন — Phase A-এর সাথে সমান্তরালেও করা যায়, কিন্তু landing page লাইভ হওয়ার আগে শেষ হওয়া ভালো |
| **H** | Sign-in prompt + bounce-back + mockup toggle + polish + QA | মাঝারি | সবকিছুর পরে |
| **I** | `About.jsx` ফিচার-লিস্ট আপডেট | ছোট | স্বাধীন, Phase A-এর role-card content চূড়ান্ত হওয়ার পর করা ভালো (দুই জায়গার consistency check-এর জন্য) |

**প্রতিটা ফেজ শেষে বাধ্যতামূলক দুইটা আউটপুট** (project-wide নিয়ম,
`documentation/README.md` §৪ থেকে):
1. একটা **full updated project zip** (পুরো কোডবেস, সেই ফেজ পর্যন্ত সব
   পরিবর্তনসহ — `node_modules`/`dist` বাদে)
2. **এই একই plan-prompt `.md` ফাইলটাই**, progress badge আপডেট করে
   (যেই ফেজ শেষ হলো সেটা `[x] DONE`, পরের ফেজ যথাযথভাবে `[~]`/`[ ]`) —
   পাশাপাশি সেই ফেজের নিচে একটা `### Findings / Context (for future
   phases)` সাব-সেকশন যোগ করে, যেখানে কোড পড়ে যা আবিষ্কার হলো, কোন
   ফাইলের কোন লাইনে কী আছে, কোনো deviation/blocker হলে কেন — সব লেখা
   থাকবে। এই ফাইলের কোনো আগের ফেজের মূল টেক্সট কখনো মোছা/rewrite করা
   হবে না — শুধু append।

**এই ফাইল কোথায় থাকবে (project rule অনুযায়ী):** এটা ইতিমধ্যেই সঠিক
জায়গায় আছে — `documentation/03-features/guest-mode/
DEMO_MODE_FULL_PLAN_PROMPT.md`, `CURRENT.md`-এর পাশে। Root-এ বা অন্য
কোথাও কোনো `.md` কপি রাখা হবে না (`README.md`-এর ডকুমেন্টেশন নিয়ম
অনুযায়ী)।

---

## Context / Goal (ইউজারের ভাষায়, সারাংশ)

Signed-out visitor বর্তমানে `kuetx.com` খুললে সরাসরি Login/Register
মোডাল দেখে — কী পাচ্ছে তা না বুঝেই সাইন-আপ করতে বাধ্য হয়। লক্ষ্য: একটা
পাবলিক "Guest Room" landing page বানানো (route `/`) যেখানে signed-out
visitor Student/Faculty/Provider — এই তিন role-এর demo dashboard
দেখতে পারবে (read-only, কিছু edit করা যাবে না), একে অপরের সাথে সংযুক্ত
("cross-role") — অর্থাৎ student-এর একটা shop-order, provider-view
থেকেও একই order দেখা যাবে; একই class-এ student+teacher; class-এ পাঠানো
notice দুই দিক থেকেই দেখা যাবে; ইত্যাদি। Desktop-এ phone-mockup preview
প্যাটার্ন (A3KM Studio রেফারেন্স স্ক্রিনশট অনুযায়ী), Mobile-এ role-এ
ঢুকলে ফুল-স্ক্রিন (কারণ real app মোবাইলেও ফুল-স্ক্রিন)। Signed-in
ইউজার এই landing page কখনো দেখবে না — সরাসরি নিজের real dashboard-এ।

**মূল constraint যা ইউজার বারবার জোর দিয়েছে:**
- কম কোড, বুদ্ধি করে বানানো — duplicate UI/লজিক এড়ানো
- real app-এর production behavior কোনোভাবেই ভাঙা যাবে না
- role-এ ঢুকলে "হুবহু real app-এর মতো" লাগতে হবে
- demo-তে কোনো write/edit সম্ভব হবে না
- প্রতিটা ফেজ শেষে zip + updated plan-prompt md — যাতে যেকোনো AI
  সেশন resume করতে পারে

---

## ⚠️ সবচেয়ে গুরুত্বপূর্ণ আবিষ্কার — Phase 0 পড়ার আগে কিছু শুরু কোরো না

এই কাজটা **প্রথমবার হচ্ছে না।** কোডবেসে ইতিমধ্যেই একটা ৯৫৫-লাইনের
পূর্ববর্তী Guest-Mode প্ল্যান আছে যার **Phase 0–2 সম্পূর্ণ, Phase 3–4
সম্পূর্ণ, Phase 5 এখনো বাকি:**

- Root: `GUEST_MODE_PLAN.md`
- Copy: `documentation/03-features/guest-mode/GUEST_MODE_PLAN_PROMPT.md`

এর ফলে ইতিমধ্যেই কোডে আছে (verified, Phase 0-এ সম্পূর্ণ পড়া হয়েছে —
নিচে "সংশোধিত completion status" দেখো, কারণ কিছু ফেজ আগে ভুলভাবে
"সম্পূর্ণ" ধরে নেওয়া হয়েছিল):
- `src/components/RequireGuestMode.jsx` — signed-in ইউজার
  `/guest/*`-এ ম্যানুয়ালি গেলে `/dashboard`-এ bounce করে দেয়। **এই
  নতুন প্ল্যানের অংশ ৩.৫-এ (signed-in ইউজার landing page-এ ভুলে এলে
  কী হবে) যে লজিক দরকার, সেটা এই ফাইলে already আছে — নতুন করে বানানোর
  দরকার নেই, শুধু নতুন route (`/`)-এর জন্য reuse/extend করতে হবে।**
- `src/data/guestDemoData.js` — `GUEST_PROFILE`, `GUEST_COURSES`,
  `GUEST_ATTENDANCE`, `GUEST_MARKS`, `GUEST_SCHEDULE`,
  `GUEST_NOTICES` এক্সপোর্ট করে। এই নতুন প্ল্যানের Phase F-এ প্রস্তাবিত
  `demoWorld.js`-এর সাথে **সরাসরি ওভারল্যাপ করে।** Phase 0-এ প্রথম কাজ:
  ঠিক করা এই ফাইলটা migrate/extend করা হবে, নাকি রিপ্লেস করা হবে —
  আলাদা করে দুইটা প্রায়-একই ডেটা ফাইল রাখা হবে না।
- `src/pages/guest/GuestDashboard.jsx`, `GuestSchedule.jsx`,
  `GuestAttendance.jsx`, `GuestMarks.jsx` — এগুলো real page component
  reuse করে না, standalone hand-written page (কারণ নিচের ব্লকার)।
- `src/components/guest/GuestNav.jsx` — বিদ্যমান guest-mode nav।
- `App.jsx`-এর `PUBLIC_PATHS` array: `['/about', '/guest',
  '/guest/dashboard', '/guest/schedule', '/guest/attendance',
  '/guest/marks']` (verified, App.jsx লাইন ৬৫৮)।

### 🔴 জানা ব্লকার (আগের প্ল্যানের Phase 2.3 status note থেকে, verbatim গুরুত্বপূর্ণ অংশ)

আগের প্ল্যান ঠিক এই approach-টাই try করেছিল যা এই নতুন প্ল্যানের Phase
B প্রস্তাব করছে ("real page component-কে props দিয়ে demo data inject
করে reuse করা")। **সেটা BLOCKED হয়েছিল** — status note বলে:
> "🟡 RESOLVED PRAGMATICALLY... Deviation from this section's literal
> instruction: the 'reuse with demo props instead of live
> subscriptions' half didn't end up happening... the pages that
> actually consume this file are hand-built rather than the real
> components with props."

**এর মানে:** Phase B শুরু করার আগে `GUEST_MODE_PLAN.md`-এর Phase 2.3
সেকশনটা (লাইন ~৩৭১-৬৭৭, `git show`/zip-এ থাকা ফাইলে) **সম্পূর্ণ পড়ে**
বুঝতে হবে ঠিক কোন কারণে props-driven reuse কাজ করেনি (সম্ভবত
Dashboard.jsx/Schedule.jsx-এর ভেতরের `store.js` কল এতটাই ছড়ানো ছিল
যে props দিয়ে পুরোপুরি override করা বাস্তবসম্মত ছিল না)। যদি নতুন
Phase B-এর "Shared Presentational Component" approach (পুরো পেজ props
দিয়ে override না করে, শুধু ছোট pure sub-component বের করে আনা) এই
ব্লকার এড়াতে পারে তাহলে এগোনো ঠিক আছে — কিন্তু এটা explicitly যাচাই
করে Phase 0-এর ফাইন্ডিং-এ লিখতে হবে, অনুমান করা যাবে না।

### 🔴 Phase 5 (আগের প্ল্যানের) এখনো অসম্পূর্ণ — এই নতুন কাজের সরাসরি dependency

`GuideModal.jsx`-এর `getShellContext(pathname)` এখনো **route-based**,
account-role-based না:
```js
function getShellContext(pathname) {
  if (pathname.startsWith('/provider')) return 'provider';
  if (pathname.startsWith('/faculty')) return 'faculty';
  if (pathname.startsWith('/team') || pathname.startsWith('/admin-hub') || pathname.startsWith('/admin')) return 'staff';
  return 'student';
}
```
নতুন landing page (`/`) signed-out visitor-দের জন্য বানালে, ওই visitor
`?` গাইড আইকনে ক্লিক করলে **fallback হিসেবে পুরো student feature guide**
দেখবে (Attendance walkthrough, GPA calculator ইত্যাদি) — যেটা তার
জন্য অর্থহীন, কারণ সে তখনো সাইন-আপই করেনি। এই সমস্যাটা আগের প্ল্যানের
Phase 5-এ ধরা পড়েছিল এবং সমাধানও ডিজাইন করা আছে (নিচে Phase G দেখো),
কিন্তু implement হয়নি। **এই নতুন landing page লাইভ করার আগে হয় Phase G
শেষ করতে হবে, নয়তো landing/demo-mode পেজগুলোতে সাময়িকভাবে `?` গাইড
আইকন hide করে রাখতে হবে** — নাহলে ভুল guide content দেখানো হবে।

### 🟡 SEO প্রভাব — নতুন তথ্য যা আগের কোনো প্ল্যানেই ছিল না

মেমোরি/প্রজেক্ট ইতিহাস অনুযায়ী সম্প্রতি (২০২৬ জুলাই-আগস্ট)
`kuetx.com` কাস্টম ডোমেইনে migrate করে Google Search Console ও Bing
Webmaster Tools-এ SEO সেটআপ করা হয়েছে। Root route (`/`)-এর content
সম্পূর্ণ বদলে গেলে (Login modal থেকে landing page-এ) ইনডেক্সড
root page-এর structure বদলাবে — Phase H-এ (polish/QA) SEO re-verify/
re-submit করার একটা চেকলিস্ট আইটেম যোগ করা হয়েছে, দেখো নিচে।

---

## Phase 0 — পূর্ববর্তী কাজের সাথে সমন্বয় (আবশ্যিক প্রথম ধাপ)

**লক্ষ্য:** নতুন কিছু বানানোর আগে নিশ্চিত হওয়া যে আমরা আগের কাজ
duplicate করছি না বা আগের known blocker-এ আবার পড়ছি না।

### কী করতে হবে
1. `GUEST_MODE_PLAN.md` (root) সম্পূর্ণ পড়ো — বিশেষত Phase 2.3-এর
   "BLOCKED"/deviation নোট আর Phase 0-এর investigation findings।
2. `src/data/guestDemoData.js` পুরোটা পড়ো। সিদ্ধান্ত নাও (এবং এখানে
   লিখে রাখো): এই ফাইলকে নতুন `demoWorld.js`-এ merge/rename/extend
   করা হবে, নাকি guestDemoData রেখে দিয়ে পাশে আলাদা cross-role
   `demoWorld.js` বানানো হবে (যদি পরেরটা করা হয়, তাহলে কেন দুইটা আলাদা
   রাখা যুক্তিসঙ্গত তা এক লাইনে লিখে রাখতে হবে, নাহলে ভবিষ্যতে কেউ
   বিভ্রান্ত হবে কোনটা source-of-truth)।
3. পুরনো `/guest/*` route/page/nav (`GuestDashboard.jsx` ইত্যাদি,
   `GuestNav.jsx`, `App.jsx`-এর guest route ব্লক) — নতুন landing
   page লাইভ হওয়ার পর এগুলো মুছে ফেলা হবে, নাকি আপাতত রেখে দেওয়া হবে
   (নতুন `/` আর পুরনো `/guest/dashboard` দুটোই সাময়িক সময় সহাবস্থান
   করবে)? সিদ্ধান্ত এখানে লিখে রাখো। প্রস্তাবিত ডিফল্ট: Phase C
   (Student demo) সম্পূর্ণ ও verified না হওয়া পর্যন্ত পুরনো
   `/guest/*` রুট **মুছবে না** (fallback হিসেবে কাজ করবে যদি নতুন
   কিছু ভেঙে যায়) — Phase C DONE হওয়ার পর একটা ছোট cleanup ধাপে মুছে
   ফেলা হবে ও `App.jsx`-এর `PUBLIC_PATHS`/routes থেকে বাদ দেওয়া হবে।
4. `RequireGuestMode.jsx` reuse করার জন্য exact কী পরিবর্তন লাগবে তা
   বের করো (এটা এখন `/guest/*`-নির্দিষ্ট রুটে বসানো — নতুন `/` route-এ
   বসানোর জন্য কি নাম বদলাতে হবে, নাকি একইভাবে prop pass করলেই চলবে?)।
5. `GuideModal.jsx`, `guideContent.js` পড়ে Phase 5 (এই প্ল্যানের Phase
   G) ঠিক কতটা কাজ বাকি তা নিশ্চিত করো — উপরে যা লেখা আছে তা এখনো সত্যি
   কিনা কোড পড়ে verify করো (এই প্ল্যান লেখার সময়কার observation, কোড
   পরিবর্তিত হয়ে থাকলে আপডেট করে নাও)।

### Done হওয়ার শর্ত
- উপরের ৫টা প্রশ্নের প্রতিটার উত্তর এই ফাইলের Phase 0 Findings
  সাব-সেকশনে লেখা আছে।
- কোনো কোড এখনো বদলানো হয়নি (এটা pure investigation phase, আগের
  DEMO_MODE_FULL_PLAN-এর "Analysis Only, No Code Yet" নীতি অনুযায়ী)।

### Findings / Context (for future phases)

**১. `GUEST_MODE_PLAN.md` সম্পূর্ণ পড়া হয়েছে — completion status সংশোধন
(⚠️ এই প্ল্যান-প্রম্পটের আগের ড্রাফটে ভুলভাবে লেখা হয়েছিল "Phase 3-4
সম্পূর্ণ" — সেটা ভুল ছিল, সংশোধিত অবস্থা নিচে):**

| Phase (পুরনো প্ল্যানের) | প্রকৃত Status |
|---|---|
| 0 — Investigation | ✅ Done |
| 1 — Public About page | ✅ Done |
| 2.1 — Guest mode flag (URL-prefix) | ✅ Done |
| 2.2 — Demo data source | ✅ Done |
| 2.3 — Guest-mode page wrappers | 🟡 Done, কিন্তু **deviated** — নিচে ২ নং পয়েন্ট দেখো |
| 2.4 — Persistent guest banner | ✅ Done |
| 2.5 (GuestNav) | ✅ Done |
| **3 — Guest→Real conversion** | ❌ **কোনো Status line নেই — অসম্পূর্ণ/অযাচাইকৃত**, এই ফাইলে "grep করে Status: ✅ Done খুঁজেছি, Phase 3-এর heading-এর নিচে কিছু পাইনি |
| **4 — Polish & Edge Cases** | ❌ **কোনো Status line নেই — অসম্পূর্ণ** (bookmark direct-link, browser back, signed-in bounce, mobile responsiveness, SEO/meta — এর কোনোটাই confirmed-done হিসেবে মার্ক করা নেই) |
| **5 — Role-Aware Guide System** | ❌ **অসম্পূর্ণ** (নিচে বিস্তারিত) |

**গুরুত্বপূর্ণ সংশোধন:** তাই এই নতুন প্ল্যানের Phase A/H লেখার সময়
"browser back", "bookmark redirect", "signed-in bounce-back",
"SEO/meta" — এগুলোকে **শূন্য থেকে ধরে না নিয়ে**, বরং Phase 4-এর
আইটেমগুলো *প্রথমে verify* করতে হবে বাস্তবে কাজ করছে কিনা (হয়তো কোড
লেখা হয়ে গেছে কিন্তু status line আপডেট করা হয়নি — অথবা সত্যিই বাকি)।
Phase A/H শুরু করার সময় প্রথম কাজ: `RequireGuestMode.jsx`,
`App.jsx`-এর bookmark-redirect লজিক, আর `About.jsx`-এর `usePageMeta()`
কল ম্যানুয়ালি টেস্ট করে দেখা প্রতিটা সত্যিই কাজ করছে কিনা, তারপরই ধরে
নেওয়া যে সেই অংশ নতুন করে বানাতে হবে না।

**২. Phase 2.3 BLOCKED-এর পুরো কারণ (verbatim সারমর্ম, পুরনো প্ল্যানের
Findings থেকে) — Phase B শুরুর আগে এটা অবশ্যই মাথায় রাখতে হবে:**

আগের সেশন props-injection (Option A) আর store-context override (Option
B) দুটোই বিস্তারিত investigate করেছিল, বাস্তবায়ন করেনি:
- **Option A (props + fallback)** ব্যর্থ কারণ: `Dashboard.jsx`
  (তখন ৫২৬ লাইন), `Schedule.jsx` (২৭৯৩), `Attendance.jsx` (১৩৬৬),
  `Marks.jsx` (৬১১) — কোনোটাই props নেয় না, প্রতিটা সরাসরি module-level
  singleton (`store.js`) থেকে **দশ-বিশ জায়গায় ছড়িয়ে** read করে, এক
  জায়গায় centralized data-fetch ব্লক নেই। এছাড়া `Dashboard.jsx` একাই
  ৩টা লাইভ Firestore subscription খোলে ইনলাইনে
  (`subscribeAllServices`, `subscribeClassSetup`,
  `subscribeGroupTermStartDate`) — এগুলো `store.js` override দিয়েও
  বন্ধ হয় না, কারণ এরা সরাসরি `onSnapshot` কল করে।
- **Option B (store.js-কে context-aware বানানো)** ব্যর্থ কারণ:
  `store.get`/`store.set` শুধু React component না, `serviceSync.js`,
  `groupSync.js`, `termStartDateSync.js`-এর মতো plain non-component
  module থেকেও কল হয় — React Context সেখানে পৌঁছায় না prop-drilling
  ছাড়া, যেটা "thin wrapper" ধারণাটাই ভেঙে দেয়। আর এখানেও same
  Firestore subscription সমস্যা থেকেই যায়।
- **যা শেষমেশ করা হয়েছিল (Option 1 — hand-built standalone pages):**
  real page একদমই ছোঁয়া হয়নি; বদলে `GuestDashboard.jsx` ইত্যাদি ৪টা
  নতুন ফাইল লেখা হয়েছিল যেগুলো শুধু `guestDemoData.js` থেকে read করে,
  visual shape মেলায় কিন্তু আসল component reuse করে না। **এই decision
  পুরনো প্ল্যানের নিজস্ব "do NOT fork... duplicated JSX" নিয়মের flagged
  deviation** — reasoning ছিল: real page-গুলোর coupling এতটাই গভীর যে
  duplication-avoidance-এর চেয়ে "heavily-bugfixed live page না ভাঙা"
  বেশি গুরুত্বপূর্ণ মনে হয়েছিল।

**এর মানে নতুন প্ল্যানের Phase B (Shared Presentational Component
Extraction) কীভাবে ভিন্ন/নিরাপদ তা স্পষ্ট করে বলতে হবে:** Phase B পুরো
পেজ props দিয়ে override করছে না (যা Option A ছিল, এবং ব্যর্থ হয়েছিল) —
বরং শুধু pure, already-isolated sub-component (যেমন `StatCard`,
`AttendanceHero`, `MeetingCard` — এগুলো verified pure, কোনো
store/Firestore কল নেই ভেতরে) আলাদা ফাইলে **move** করছে, আর সেই
component-গুলোকে demo page থেকে নতুন demo props দিয়ে আলাদাভাবে render
করা হবে (real page-এর ভেতরের data-fetching লজিক অক্ষত থাকবে, শুধু
presentation-layer আলাদা করা হচ্ছে)। তাই Option A-এর মূল ব্লকার
(centralized fetch না থাকা, inline Firestore subscription) Phase B-কে
প্রভাবিত করে না — কারণ Phase B পুরো পেজের data-flow বদলাচ্ছে না, শুধু
UI-এর ছোট, ইতিমধ্যে-বিচ্ছিন্ন অংশ বের করে আনছে। **তবে সতর্কতা:** যেসব
sub-component "⚠️ verify করতে হবে" (Phase B টেবিলে চিহ্নিত —
`ServicesPreviewRow`, `NoticesTab`, `ScheduleTab`, `QuestionBankTab`,
`InquiryQueueCard`, `ConfirmedList`) সেগুলোর ভেতরেও নিজস্ব Firestore
কল থাকতে পারে (ঠিক Dashboard.jsx-এর মতোই) — এই component-গুলোর জন্য
Phase B-তে একই Option A সমস্যায় পড়ার ঝুঁকি আছে, তাই সেগুলো extract
করার আগে সম্পূর্ণ ফাইল পড়ে pure কিনা তা নিশ্চিত করা **must**, অনুমান
না করে।

**৩. `guestDemoData.js` migrate/extend/replace সিদ্ধান্ত:**

ফাইলটা সম্পূর্ণ পড়া হয়েছে — এটা pure data ফাইল (`GUEST_PROFILE`,
`GUEST_COURSES`, `GUEST_ATTENDANCE`, `GUEST_MARKS`, `GUEST_SCHEDULE`,
`GUEST_NOTICES`, আর `GUEST_DEMO_DATA` bundle), zero Firebase/store
import (verified)। এটা **single-student-persona** ডেটা — cross-role
(teacher/provider দিক থেকে একই ঘটনা) কনসেপ্ট নেই, কারণ পুরনো প্ল্যান
শুধু student-side demo scope করেছিল।

**সিদ্ধান্ত: EXTEND করা হবে, রিপ্লেস না।** নতুন `demoWorld.js`
(Phase F) `guestDemoData.js`-এর student-side value-গুলো (বিশেষত
`GUEST_PROFILE`-এর roll/batch/section সমন্বয়, যেটা
`extractBatchFromRoll()`/`isProfileComplete()`-এর সাথে সামঞ্জস্যপূর্ণ
হতে সাবধানে বাছাই করা হয়েছিল) **পুনর্ব্যবহার করবে হুবহু কপি না করে
import করে**, আর তার ওপরে teacher/provider persona ও cross-role
link (order/notice/question-bank/meeting) যোগ করবে। এতে দুইটা আলাদা
সোর্স-অফ-ট্রুথ তৈরি হবে না। `demoWorld.js`-এ শুধু:
```js
import { GUEST_PROFILE, GUEST_COURSES, GUEST_ATTENDANCE, GUEST_MARKS,
         GUEST_SCHEDULE, GUEST_NOTICES } from './guestDemoData';
```
করে তার ওপর নতুন `DEMO_TEACHER`, `DEMO_SHOP`, `DEMO_ORDER`,
`DEMO_QUESTION_BANK_ENTRY`, `DEMO_MEETING` — যোগ হবে, আর
`DEMO_STUDENTS` অ্যারের প্রথম entry (`demo-std-1`) হবে
`GUEST_PROFILE`-এর সাথে সামঞ্জস্যপূর্ণ (একই roll-প্যাটার্ন,
`2307xxx`)। **`guestDemoData.js` ফাইলটা মুছে ফেলা হবে না** — Phase F
পর্যন্ত এটাই থাকবে base হিসেবে।

**৪. পুরনো `/guest/*` cleanup timing — চূড়ান্ত সিদ্ধান্ত:**

প্রস্তাবিত ডিফল্ট অনুযায়ী: **Phase C (Student demo) সম্পূর্ণ ও
verified হওয়ার আগ পর্যন্ত পুরনো `/guest/*` রুট মুছে ফেলা হবে না।**
কারণ: পুরনো রুট এখনো কাজ করছে (production-এ live থাকতে পারে), আর নতুন
landing page (`/`) থেকে student demo রেডি না হওয়া পর্যন্ত এটাই একমাত্র
কার্যকরী preview অভিজ্ঞতা signed-out visitor-দের জন্য — সরিয়ে ফেললে
মাঝপথে কোনো preview-ই থাকবে না। Phase H-এ (cleanup ধাপে) পুরনো
`GuestDashboard.jsx` ইত্যাদি ৪টা ফাইল, `GuestNav.jsx`,
`RequireGuestMode.jsx`-এর `/guest/*`-নির্দিষ্ট routing, এবং
`App.jsx`-এর `PUBLIC_PATHS`-এর পুরনো এন্ট্রি মুছে ফেলা হবে — নতুন `/`
route-ভিত্তিক landing পুরোপুরি প্রতিস্থাপন করার পর।

**৫. `RequireGuestMode.jsx` নতুন `/` route-এ reuse করার জন্য exact
পরিবর্তন:**

ফাইলটা পড়া হয়েছে (`src/components/RequireGuestMode.jsx`)। এটা
generic-ই আছে — কোনো `/guest`-নির্দিষ্ট hardcoded পাথ নেই ভেতরে,
শুধু `authState.authReady && authState.user` চেক করে signed-in হলে
`/dashboard`-এ `<Navigate>` করে। **তাই এই কম্পোনেন্টটা নাম/লজিক কিছু না
বদলিয়ে সরাসরি নতুন `/` route-এ ব্যবহার করা যাবে** — শুধু
`<Route path="/" element={<RequireGuestMode authState={authState}>
<LandingPage /></RequireGuestMode>} />` আকারে বসালেই চলবে (Phase A)।
নতুন কোনো `RequireLandingMode` বা অনুরূপ কম্পোনেন্ট বানানোর দরকার নেই।

**৬. Phase 5 (Guide system) — পুনরায় নিশ্চিত করা:**

`GuideModal.jsx`/`guideContent.js` দেখে নিশ্চিত হওয়া গেছে (কোনো
Status line নেই সেই heading-এর নিচে) — এই কাজ এখনো বাকি, উপরের ছকেও
তাই দেখানো হয়েছে। এই নতুন প্ল্যানের **Phase G** ঠিক এই কাজটাই করবে,
বিস্তারিত সেই সেকশনেই আছে।

### কী করতে হবে
- Root `/`-কে public করা (`PUBLIC_PATHS`-এ যোগ করা, `App.jsx`-এর
  auth-queue লজিক bypass করে)।
- Signed-in ইউজার root-এ এলে (RootRouteResolver-এর existing লজিক দিয়ে)
  সরাসরি নিজের real dashboard-এ — landing page কখনো render হবে না তার
  জন্য। (Phase 0-এ নিশ্চিত করা `RequireGuestMode`-এর সমতুল্য গার্ড
  এখানে বসাও।)
- Navbar: KUETx লোগো + "Sign In" বাটন (sticky, কিন্তু force করবে না)।
- মূল অংশ: সংক্ষিপ্ত পরিচিতি + ৩টা Role Card (Student/Faculty/Provider),
  প্রতিটাতে feature বুলেট — **এই বুলেটের কনটেন্ট এই ফাইলের নিচে "Role
  Card Feature Content (verified)" সেকশনে READY লেখা আছে, `About.jsx`
  থেকে না নিয়ে সরাসরি ওখান থেকে ব্যবহার করো** (কেন `About.jsx` সোর্স
  হিসেবে ভুল ছিল, তার কারণ নিচে ব্যাখ্যা করা আছে)।
- role card ক্লিক করলে mockup/full-screen-এ demo dashboard view বদলে
  যায় (implementation Phase C/D/E-তে, এখানে শুধু placeholder/empty
  state দেখালেই চলবে যতক্ষণ না সেই role-এর demo রেডি)।
- URL-এ role state রাখা (`/?role=student`) যাতে browser back কাজ করে
  (client-side query update, full navigation না)।
- পুরনো `/guest/*` bookmark → root-এ redirect, role auto-select সহ
  (`/guest/dashboard` → `/?role=student`) — **যদি Phase 0-এ পুরনো
  guest রুট এখনই না মুছার সিদ্ধান্ত হয়, তাহলে এই redirect যোগ করার
  দরকার নেই, বদলে দুটো coexist করবে যতক্ষণ cleanup না হয়।**
- **`?` Guide আইকন landing page-এ সাময়িকভাবে hide রাখা** (Phase G শেষ
  না হওয়া পর্যন্ত) — যাতে ভুল (student feature) guide content না
  দেখানো হয়।

### Done হওয়ার শর্ত
- `npx vite build` পাস করে।
- Signed-in ইউজার root-এ গেলে landing page দেখে না (ম্যানুয়ালি টেস্ট)।
- Signed-out visitor root-এ গেলে landing page দেখে, ৩টা role card
  দৃশ্যমান।
- পুরনো `/guest/dashboard` ইত্যাদি এখনো কাজ করে (fallback হিসেবে,
  Phase 0-এর সিদ্ধান্ত অনুযায়ী)।

### Findings / Context (for future phases)

**যা বানানো হয়েছে:**
- `src/pages/LandingPage.jsx` (নতুন ফাইল) — role card selection screen +
  desktop mockup toggle scaffold + mobile full-screen demo-placeholder
  view। `App.jsx`-এ lazy-import করা (অন্য সব page-এর মতোই একই প্যাটার্নে)।
- `App.jsx`-এর root `<Route path="/">` পরিবর্তন — এখন প্রথমে
  `!auth.currentUser` চেক করে (signed-out visitor কিনা), তারপরই আগের
  `getAccountRole()` ternary চালায় (শুধু signed-in সেশনের জন্য
  অপরিবর্তিত)। `RequireGuestMode` (Phase 0-এ চিহ্নিত reusable component,
  **কোনো পরিবর্তন ছাড়াই** reuse হয়েছে) landing page-কে wrap করে —
  race-condition এ signed-in সেশন ভুলে এই branch-এ পড়লেও `/dashboard`-এ
  bounce করবে।
- `PUBLIC_PATHS`-এ `'/'` যোগ করা হয়েছে (`/about`-এর ঠিক পাশে) — এটা
  ছাড়া `buildQueue()` signed-out visitor-এর জন্য root-এ `'auth'` push
  করত আর Layout কখনো mount-ই হতো না, তাই নতুন root-route branch
  render হওয়ার সুযোগই পেত না।

**Role card content:** plan-prompt-এর নিজস্ব "Role Card Feature Content
(verified)" সেকশন থেকে হুবহু কপি করা হয়েছে (`About.jsx` থেকে না) —
`ROLE_CARDS` array-এ কমেন্ট আছে যেন দুই জায়গা future-এ sync থাকে সেই
নোট সহ।

**যা এই ফেজে ইচ্ছাকৃতভাবে বানানো হয়নি (পরের ফেজের কাজ):**
- Role card ক্লিক করলে এখন `DemoComingSoon` প্লেসহোল্ডার দেখায় — আসল
  demo dashboard Phase C/D/E-এর কাজ। placeholder-এর নিজেই লেখা আছে কোন
  phase সেটা বানাবে (`role === 'student' ? 'C' : ...`), যাতে future
  session এক নজরে বুঝতে পারে কোথায় hook করতে হবে।
- Mockup frame (`MockupFrame` কম্পোনেন্ট) এখন **minimal scaffold** —
  শুধু rounded-rectangle + ন্যূনতম notch/dot-bar cue, halfway-realistic
  পূর্ণ পলিশ (Phase H-এর কাজ অনুযায়ী) এখনো করা হয়নি। CSS-only toggle
  (`mockupMode` state) already কাজ করছে, তাই Phase H শুধু styling
  বদলাবে, নতুন করে toggle-logic বানাতে হবে না।
- পুরনো `/guest/*` bookmark → নতুন `/?role=...` redirect **এখনো যোগ
  করা হয়নি** — কারণ Phase 0-এর সিদ্ধান্ত অনুযায়ী পুরনো `/guest/*` রুট
  এখনো সচল রাখা হচ্ছে (Phase C শেষ না হওয়া পর্যন্ত), তাই এই মুহূর্তে
  দুটো path-ই সমান্তরালে কাজ করে — কোনো conflict নেই, কিন্তু bookmark
  redirect যোগ করার প্রয়োজনও এখনই নেই। Phase H-এর cleanup ধাপে এটা
  করা হবে যখন পুরনো রুট সরিয়ে ফেলা হবে।
- `?` Guide আইকন এই landing page-এ **এখনো hide করা হয়নি** — কারণ
  `LandingPage.jsx` কোনো Navbar/Sidebar কম্পোনেন্ট ব্যবহার করছে না
  (নিজস্ব minimal navbar আছে, শুধু Logo + Sign In বাটন) — তাই real
  app-এর `?` আইকন এই পেজে ধরাই পড়ে না, Phase G-এর ওপর নির্ভরতা তাই এই
  ফেজে প্রযোজ্য হয়নি। **তবে সতর্কতা:** Phase C/D/E-এ যখন role-এর demo
  dashboard বানানো হবে (real Sidebar/BottomNav reuse করে, plan-prompt-এর
  Part ৫ অনুযায়ী), তখন real Navbar-এর `?` আইকনও সাথে আসবে — সেই ফেজে
  Phase G সম্পূর্ণ না হলে এই আইকন hide করতে হবে।
- SEO re-submit (Phase H-এর কাজ) — `usePageMeta()` কল যোগ করা হয়েছে
  (title+description সহ), কিন্তু Search Console/Bing-এ re-submit করার
  ম্যানুয়াল কাজ এখনো বাকি।

**Verified:**
- `npx vite build` পাস — `LandingPage-6eCPy1Op.js` (৯.১৩ kB gzip: ২.৮৮
  kB) নিজস্ব lazy chunk হিসেবে তৈরি হয়েছে, কোনো build error নেই।
- `Wordmark` কম্পোনেন্ট (`src/components/Logo.jsx`) named export
  হিসেবে verified আছে, import সঠিক।
- `useSearchParams` — `react-router-dom` ^6.26.2 (package.json-এ
  verified) এই hook বহু আগে থেকেই সমর্থন করে।
- `PUBLIC_PATHS`/root-route এডিট গ্রেপ করে ম্যানুয়ালি নিশ্চিত করা
  হয়েছে দুটোই ঠিক জায়গায় বসেছে।

**ম্যানুয়াল টেস্ট এখনো বাকি (dev environment না থাকায় এই সেশনে করা
যায়নি — পরের সেশনে বা person নিজে করে দেখতে পারে):**
- Signed-out ব্রাউজারে `/` খুলে landing page দেখা যায় কিনা।
- Signed-in একাউন্ট দিয়ে `/` এ গেলে এখনো সরাসরি real dashboard-এ
  পৌঁছায় কিনা (landing page একদমই ফ্ল্যাশ না করে)।
- Role card ক্লিক করলে URL `?role=student` ইত্যাদি হচ্ছে কিনা, আর
  browser back বাটন কাজ করছে কিনা।
- Mobile viewport (< 767.98px)-এ role card ক্লিক করলে full-screen
  view-তে যাচ্ছে কিনা, phone-mockup না দেখিয়ে।

⚠️ **শুরু করার আগে Phase 0-এর Phase-2.3-ব্লকার ফাইন্ডিং অবশ্যই পড়ো।**

### Verified purity table (কোড পড়ে যাচাই করা, লাইন নম্বর সহ)

| Real ফাইল | Component | Line | Purity (verified) |
|---|---|---|---|
| `Dashboard.jsx` | `StatCard` | 18 | ✅ pure — props: label/value/sub/color/bgColor/icon/to, কোনো store/Firestore কল নেই |
| `Dashboard.jsx` | `ServicesPreviewRow` | 56 | ❌ নিজস্ব Firestore subscription — props-driven বানাতে হবে আগে |
| `Attendance.jsx` | `AttendanceHero` | 487 | ✅ pure — props: courses/logs/schedule/settings/combinedMode/combinedData/teacherRegistry |
| `Attendance.jsx` | `DailyLog` | 624 | ⚠️ props নেয়, কিন্তু `setLogs`/`onEditTeachers` callback আছে — demo-তে no-op callback দিলে read-only হবে |
| `Marks.jsx` | `CourseCard` | 99 | ⚠️ props নেয়, `onChange`/`onClearCourse` callback — no-op দিলে read-only |
| `Marks.jsx` | `CourseListRow` | 355 | ✅ pure — props: course/marks/onOpen |
| `FacultyMeetings.jsx` | `MeetingCard` | 59 | ✅ pure — props: meeting/onEdit/onDelete/isToday (verified: শুধু render, কোনো internal store/firestore কল নেই) |
| `FacultyClassDetail.jsx` | `NoticesTab` | 303 | ❌ props: groupId/isVerified/assignment — ভেতরে নিজস্ব Firestore read, props-driven বানাতে হবে |
| `FacultyClassDetail.jsx` | `ScheduleTab` | 546 | ⚠️ verify করতে হবে — internal store call আছে কিনা এই ফেজের শুরুতে চেক করো |
| `FacultyClassDetail.jsx` | `QuestionBankTab` | 1293 | ⚠️ verify করতে হবে — সম্ভবত internal fetch আছে |
| `ProviderDashboard.jsx` | `PendingBookingCard` | 598 | ✅ pure — props: booking data |
| `ProviderDashboard.jsx` | `InquiryQueueCard` | 719 | ⚠️ verify করতে হবে |
| `ProviderDashboard.jsx` | `ConfirmedList` | 789 | ⚠️ props: serviceId/bookings/offerings — data fetch আছে কিনা verify করতে হবে |

### কী করতে হবে
1. প্রতিটা "⚠️ verify করতে হবে" আইটেমের জন্য সম্পূর্ণ ফাইল পড়ে নিশ্চিত
   হও pure কিনা — অনুমান না করে।
2. যেগুলো pure (✅), সেগুলো **কপি না করে move** করো
   `src/components/shared/`-এ, real page থেকে সেই নতুন location থেকে
   import করো।
3. প্রতিটা move-এর পর `npx vite build` চালিয়ে verify করো real app-এ
   কিছু ভাঙেনি।
4. যেগুলো এখনো pure না (❌), সেগুলোকে হয় props-driven বানাও (fetch
   অংশ বাইরে বের করে parent থেকে props পাঠাও), নয়তো demo-র জন্য আলাদা
   ছোট presentational ভার্সন লেখো — কোনটা করবে তা কেস-বাই-কেস, প্রতিটা
   সিদ্ধান্তের কারণ Findings-এ লিখে রাখো।
5. **এই ফেজ role-অনুযায়ী ভাগ করে করো** — সব component একসাথে extract
   না করে, যেই role demo বানানো হবে তার ঠিক আগে সেই role-এর জন্য যতটুকু
   লাগে ততটুকু extract করো (Student → C, Faculty → D, Provider → E,
   এই ক্রমে)।

### কেন এই approach নেওয়া হয়েছে (reasoning, প্রশ্ন উঠলে রেফারেন্স করার জন্য)
Schedule.jsx (২৯৩১ লাইন), FacultyClassDetail.jsx (১৯১০ লাইন),
ProviderDashboard.jsx (১১৪০ লাইন) — এগুলো এতটাই গভীরভাবে real-time
Firestore listener/transaction-এর সাথে জড়ানো যে পুরো পেজকে "demo mode"
দিয়ে চালানো মানে পুরো ফাইল রিরাইট করার ঝুঁকি। Demo-তে edit করা যাবে
না — এই constraint-এর মানে সব write-path বাদ দিতেই হবে। ছোট, ইতিমধ্যে
বিদ্যমান pure sub-component বের করে আনা কম কোড, কম ঝুঁকি, আর real
page-এর আচরণ অপরিবর্তিত রাখে (component move করা হচ্ছে, copy না — তাই
এক জায়গায় UI বদলালে দুই জায়গাতেই reflect হয়)।

### Done হওয়ার শর্ত
- প্রতিটা extracted component-এর জন্য move-পরবর্তী `npx vite build`
  পাস।
- Real page-গুলোর (Dashboard/Attendance/Marks/FacultyMeetings ইত্যাদি)
  visual output অপরিবর্তিত (ম্যানুয়াল spot-check)।

### Findings / Context (for future phases)

**এই সেশনে করা হয়েছে — শুধু Student-slice (প্রস্তাবিত execution order
অনুযায়ী, পুরো Phase B না):**

**১. `StatCard` (Dashboard.jsx লাইন ১৮) — ✅ verified pure, MOVED।**
`src/components/shared/StatCard.jsx`-এ move করা হয়েছে (কপি না — আসল
ফাইল থেকে বডি সরিয়ে নতুন ফাইলে বসানো, `Dashboard.jsx` এখন
`import StatCard from '../components/shared/StatCard'` করে)। শুধু
props নেয় (label/value/sub/color/bgColor/icon/to), `react-router-dom`-এর
`Link` ছাড়া অন্য কোনো dependency নেই। `Dashboard.jsx`-এর ৪টা call site
অপরিবর্তিত।

**২. `AttendanceHero` (Attendance.jsx, পুরনো লাইন ৪৮৭) — ✅ verified
pure, MOVED।** `src/components/shared/AttendanceHero.jsx`-এ। এই
কম্পোনেন্টের কয়েকটা pure helper function-এর ওপর নির্ভরতা ছিল
(`isAutoFull`, `getTeachersForCourse`, `getEffectiveForCourse`,
`getFullCourseMarks`, `classesUntilDrop`, `classesNeededForNextSlab`,
`getCurrentSlab`, `getHint`, `attColor`/`attBg`/`attBorder`,
`getDisplayCourseName`) — **প্রতিটা আলাদাভাবে verify করা হয়েছে pure
কিনা** (কোনোটাই `store.get`/Firestore কল করে না, সব props/argument
নেয়)। এগুলো নতুন `src/components/shared/attendanceHeroHelpers.js`-এ
কপি করা হয়েছে (⚠️ **move না, deliberate COPY** — কারণ নিচে ৩ নং
পয়েন্ট দেখো)। `useDark()` হুকটাও `AttendanceHero.jsx`-এর ভেতরেই
component-local ভাবে রাখা হয়েছে (এটা শুধু
`document.documentElement.classList` পড়ে, কোনো store dependency নেই)।

**৩. কেন helper function গুলো MOVE না করে COPY করা হয়েছে (গুরুত্বপূর্ণ
deviation, পরের ফেজের জন্য মাথায় রাখতে হবে):** `Attendance.jsx`-এ
verify করে দেখা গেছে এই একই helper function গুলো `AttendanceHero`
ছাড়াও `DailyLog` (লাইন ৬২৪-এর কাছে) আর `CombinedAtt` (লাইন
১০৭৫-এর কাছে) কম্পোনেন্টও সরাসরি কল করে — এই দুটো কম্পোনেন্ট এখনো move
হয়নি (কারণ `DailyLog`-এর `setLogs`/`onEditTeachers` callback আছে, plan-এর
নিজস্ব টেবিলে "⚠️ no-op callback দিলে read-only হবে" হিসেবে চিহ্নিত —
এই সেশনে সেই কাজ করা হয়নি)। তাই helper গুলো `Attendance.jsx` থেকে পুরোপুরি
মুছে ফেললে `DailyLog`/`CombinedAtt` ভেঙে যেত। সিদ্ধান্ত: `Attendance.jsx`-এ
আসল helper গুলো **অক্ষত রাখা হয়েছে** (duplicate থেকে গেছে ইচ্ছাকৃতভাবে),
আর `attendanceHeroHelpers.js`-এ একটা কপি বানানো হয়েছে শুধু
`AttendanceHero.jsx`-এর জন্য। **Trade-off স্বীকার করা হচ্ছে:** এটা plan-এর
নিজস্ব "duplicate UI/লজিক এড়ানো" constraint-এর একটা ছোট ব্যতিক্রম —
কিন্তু `DailyLog`/`CombinedAtt` move না করা পর্যন্ত পুরোপুরি deduplicate
করার সুযোগ নেই কোড না ভেঙে। **পরের সেশনের কাজ:** `DailyLog`/`CombinedAtt`
যখন move হবে (সম্ভবত এই একই Phase B-এর future sub-pass-এ, বা যদি demo-তে
"Daily Log" দেখানোর দরকার পড়ে), তখন `Attendance.jsx`-এর স্থানীয় copy
মুছে ফেলে সবাইকে `attendanceHeroHelpers.js` থেকে import করানো ঠিক হবে
— এখনই না।

**৪. ⚠️ প্ল্যানের নিজস্ব verified-purity-টেবিলে ভুল পাওয়া গেছে —
সংশোধন:** টেবিলে `Marks.jsx`-এর `CourseListRow` (লাইন ৩৫৫) কে "✅ pure"
হিসেবে চিহ্নিত করা হয়েছিল। কোড পড়ে verify করে দেখা গেছে **এটা আসলে pure
না** — `CourseListRow` → `getCourseSummary(course, marks)` কল করে
(`Marks.jsx` লাইন ৩০), আর `getCourseSummary` নিজে
`computeEffectiveAttendance(course.id)` কল করে (`store.js` লাইন ১০৪৭),
যেটা সরাসরি `store.get('attAttendanceSource')`/`store.get('attCombinedData')`
পড়ে prop হিসেবে না নিয়ে। **এই কম্পোনেন্ট এই সেশনে move করা হয়নি** —
Phase C-তে Marks list দরকার হলে, হয় `getCourseSummary`-কে props-driven
বানাতে হবে (attendance percentage বাইরে থেকে param হিসেবে পাঠিয়ে), নয়তো
demo-র জন্য আলাদা ছোট presentational ভার্সন লিখতে হবে — copy-paste করে
সরাসরি move করলে ভাঙবে। **শিক্ষা: প্ল্যানের নিজস্ব টেবিলকেও blind trust
না করে re-verify করা জরুরি, এই সেশন সেটাই করেছে বলে ধরা পড়েছে।**

**৫. `ServicesPreviewRow` (Dashboard.jsx লাইন ৫৬) — এই সেশনে ছোঁয়া
হয়নি।** প্ল্যানের টেবিল অনুযায়ীই এটা ❌ (নিজস্ব `subscribeAllServices`
Firestore subscription খোলে) — যা verify করেই আগে চিহ্নিত হয়েছিল, তাই
নতুন করে verify করার দরকার ছিল না। যদি Phase C-তে Dashboard demo-তে
services preview দেখাতে হয়, এটাকে props-driven বানাতে হবে অথবা আলাদা
static demo ভার্সন লিখতে হবে (fetch অংশ বাদ দিয়ে)।

**৬. `MeetingCard` (`FacultyMeetings.jsx` অনুযায়ী প্ল্যানের টেবিলে ছিল)
— **কোডে খোঁজা হয়েছে, পাওয়া যায়নি।** `grep -rn "MeetingCard"
src/`— কোনো match নেই। প্ল্যানের টেবিলের এই এন্ট্রিটা vestigial/ভুল মনে
হচ্ছে, অথবা `FacultyMeetings.jsx` ফাইলটাই বর্তমান zip-এ ভিন্ন নামে/গঠনে
আছে — যাচাই করা হয়নি কারণ এটা student slice-এর বাইরে (faculty-side)।
Phase D (Faculty demo) শুরুর আগে এটা re-verify করা দরকার।

**৭. build verification:** প্রতিটা move-এর পরে না, কিন্তু দুটো move
একসাথে শেষ করার পর `npx vite build` চালানো হয়েছে (একবারই, দুটো
পরিবর্তনই ছোট আর independent ছিল বলে) — **পাস করেছে**, কোনো error/warning
নেই। Bundle output: `Dashboard-DMms9ww2.js` (২২.৪৪ kB gzip ৭.১৬ kB),
`Attendance-gqOlPwiI.js` (৪৮.০৭ kB gzip ১২.৫৪ kB) — দুটোই আলাদা lazy
chunk হিসেবে আগের মতোই তৈরি হয়েছে। `Dashboard.jsx`-এর `Link` import
এখনো ব্যবহৃত (StatCard সরানোর পরেও অন্য জায়গায় লাগে), তাই dead-import
warning আসেনি।

**৮. এই সেশনে যা করা হয়নি (পরের সেশনের জন্য, Phase C শুরুর আগে):**
- `DailyLog`/`CourseCard`(Marks.jsx)-এর no-op-callback-দিয়ে-read-only
  বানানোর কাজ (প্ল্যানের নিজস্ব ⚠️ নোট, "Done হওয়ার শর্ত"-এ নেই তাই
  বাধ্যতামূলক ছিল না এই স্লাইসে)।
- `Marks.jsx`-এর `CourseListRow` fix (৪ নং পয়েন্ট দেখো) — props-driven
  বানানো বা demo-ভার্সন লেখা বাকি।
- `ServicesPreviewRow` props-driven বানানো (৫ নং পয়েন্ট) — Phase C-তে
  Dashboard demo-তে services preview না দেখালে এটা এড়ানো যায়।
- Schedule preview/Notice feed/Shop order preview (Phase C-এর বাকি
  বুলেট) — এগুলোর জন্য আলাদা component pull করা এখনো বাকি, এই সেশনে
  Dashboard+Attendance-এর বাইরে হাত দেওয়া হয়নি।
- `LandingPage.jsx`-এ এখনো নতুন এই দুটো shared component ব্যবহার করে
  student demo বসানো হয়নি — সেটা Phase C-এর কাজ, এই ফেজ শুধু
  extraction, wiring না।

---

## Phase C — Student Demo

### কী করতে হবে
- Phase B-তে extract করা shared component + Phase F-এর (বা এই ফেজেই
  আংশিক তৈরি করা) demo dataset দিয়ে student role-এর demo dashboard
  বানাও।
- কভার করতে হবে: Dashboard stat tiles, Attendance summary, Marks
  list, Schedule preview, Notice feed (class notice দেখাবে — Phase F
  cross-role wiring-এর ওপর নির্ভর করে), Shop order preview।
- সব write-triggering control hide/disabled (no-op callback pattern,
  Phase B-তে চিহ্নিত)।
- Real `Sidebar.jsx`/`BottomNav.jsx` reuse (নতুন demo-nav বানাবে না) —
  `isDemoMode` prop দিয়ে write-triggering nav item hide করো।

### Done হওয়ার শর্ত
- `npx vite build` পাস।
- Student role card থেকে demo dashboard-এ ঢোকা যায়, কোনো real
  Firestore write ট্রিগার হয় না (নেটওয়ার্ক ট্যাব দিয়ে verify করো)।

### Findings / Context (for future phases)

**এই সেশনে করা হয়েছে:**

**১. `src/data/demoWorld.js` (নতুন ফাইল) — Phase 0 Finding #৩-এর
সিদ্ধান্ত অনুযায়ী `guestDemoData.js` থেকে import করে extend করা
হয়েছে (কপি না)।** `guestDemoData.js` অপরিবর্তিত রাখা হয়েছে, পুরনো
`/guest/*` পেজগুলো এখনো ঠিক আগের মতোই ওটা থেকে সরাসরি import করছে।

**২. ⚠️ গুরুত্বপূর্ণ শেপ-মিসম্যাচ পাওয়া গেছে (নতুন finding, প্ল্যানে
আগে ছিল না):** `GUEST_ATTENDANCE`/`GUEST_SCHEDULE`-এর শেপ পুরনো
hand-written `/guest/*` পেজের জন্য বানানো হয়েছিল — Phase B-তে extract
করা real `AttendanceHero`/`StatCard` কম্পোনেন্ট যা আশা করে তার সাথে
মেলে না:
   - `AttendanceHero`-এর `combinedMode` branch `combinedData` চায় যা
     `${courseId}_${teacherName}` কী দিয়ে `{held, attended}` — কিন্তু
     `GUEST_ATTENDANCE`-এ আছে flat `{pct, present, total}` প্রতি কোর্সে।
   - `getTeachersForCourse` (AttendanceHero-এর dependency) হয় flat
     `schedule` array চায় (প্রতি slot-এ সরাসরি `courseId`) নয়তো
     `settings.courseTeacherMap` — কিন্তু `GUEST_SCHEDULE` day-গ্রুপড,
     নেস্টেড `slots` অ্যারে সহ, ভিন্ন শেপ।

   **সমাধান (এই সেশনে করা হয়েছে):** `GUEST_ATTENDANCE` না বদলে
   (পুরনো `/guest/*` পেজ ভাঙার ঝুঁকি এড়াতে), `demoWorld.js`-এ
   `DEMO_ATTENDANCE_COMBINED` নামে একটা নতুন reshape বানানো হয়েছে —
   কিন্তু **সংখ্যাগুলো `GUEST_ATTENDANCE`-এর present/total থেকেই
   derive করা** (নতুন করে বানানো হয়নি), তাই দুই জায়গার attendance %
   সবসময় consistent থাকবে। Schedule matching সম্পূর্ণ এড়ানো হয়েছে —
   `getTeachersForCourse` কে `settings.courseTeacherMap` দিয়ে সরাসরি
   resolve করানো হয়েছে (`DEMO_SCHEDULE_SETTINGS`), তাই `schedule` prop-এ
   খালি array পাঠালেও কাজ করে (AttendanceHero-এর courseTeacherMap-first
   lookup logic ব্যবহার করে, schedule-fallback পথে যায়ই না)।

**৩. `src/components/StudentDemoDashboard.jsx` (নতুন ফাইল) —**
`StatCard` (৩টা tile: Attendance/Courses/Marks Entries) আর
`AttendanceHero` (Phase B-তে extract করা, অপরিবর্তিত) real কম্পোনেন্ট
হিসেবে reuse করে, `demoWorld.js`-এর ডেটা দিয়ে। এছাড়া একটা সাধারণ static
Notice-feed preview (২টা notice) আর একটা "Campus Services — সাইন আপ
করলে দেখা যাবে" টিজার লাইন — এই দুটো কোনো real কম্পোনেন্ট থেকে extract
করা না, নতুন লেখা সাধারণ presentational markup।

**৪. 🔴 নতুন ব্লকার আবিষ্কৃত — Real `Sidebar.jsx`/`BottomNav.jsx` reuse
সম্ভব হয়নি এই সেশনে (প্ল্যানের Phase C নির্দেশনা থেকে deviation, কারণ
সহ):** প্ল্যানের "কী করতে হবে"-তে লেখা ছিল "Real Sidebar.jsx/
BottomNav.jsx reuse... isDemoMode prop দিয়ে write-triggering nav item
hide করো"। কোড পড়ে verify করা হয়েছে — **`isDemoMode` নামে কোনো prop
আজ কোনোটাতেই নেই, আর দুটো কম্পোনেন্টই এমনভাবে বানানো যে সহজে অ্যাড করা
যায় না:**
   - `BottomNav.jsx`: সরাসরি `auth.currentUser`, `getProfile()` (real
     local store, demo data না), `subscribeMyRole()` (Firestore),
     আর `useIsStaff`/`useViewMode`/`useIsProvider` হুক কল করে।
   - `Sidebar.jsx`: একই তিনটা হুক (`useIsStaff`, `useViewMode`,
     `useIsProvider`) plus `auth.currentUser?.uid` সরাসরি কল করে।
   - `useViewMode.js` বিশেষভাবে ঝুঁকিপূর্ণ পাওয়া গেছে: এটা
     `localStorage`-এর `kuetx:viewMode` key পড়ে — signed-out visitor-এর
     browser-এ যদি **আগের কোনো real সেশন থেকে** সেই key বসানো থাকে
     (একই ডিভাইসে আগে কেউ সাইন-ইন করেছিল), landing page demo সেই
     leftover local state পড়ে ফেলতে পারত — এটা শুধু crash risk না,
     **real-session-leak risk।**

   **সিদ্ধান্ত (owner-approved এই সেশনে):** real nav জোর করে বসানো হয়নি।
   বদলে `StudentDemoDashboard.jsx`-এর ভেতরে একটা ছোট, purpose-built demo
   nav strip লেখা হয়েছে (নাম/dept/batch + "Preview — read only" ব্যাজ) —
   দেখতে ইচ্ছাকৃতভাবে real app-এর chrome থেকে ভিন্ন, যাতে কেউ ভুল করে
   এটাকে real nav ভেবে confuse না হয়। **এটা প্ল্যানের মূল নির্দেশনা থেকে
   একটা deliberate deviation** — owner-কে জানানো হয়েছিল ও approval
   নেওয়া হয়েছে ("demo-র জন্য যা best/safe সেটাই করো, user experience
   যেন সবসময় ঠিক থাকে")। real Sidebar/BottomNav reuse করার কাজ এখনো
   বাকি — future সেশনে `isDemoMode` prop নিরাপদে অ্যাড করতে হলে অন্তত এই
   তিনটা কাজ লাগবে: (ক) `useViewMode`-কে override করার উপায় বের করা
   (localStorage-leak এড়িয়ে), (খ) `getProfile()` কে demo profile দিয়ে
   override করার mechanism, (গ) `auth.currentUser`-নির্ভর প্রতিটা branch
   signed-out state-এ safely no-op হয় তা যাচাই করা। এটা ছোট কাজ না —
   প্ল্যানের নিজস্ব ভাষায় "কম কোড" constraint-এর সাথে সরাসরি টেনশনে আছে,
   তাই future সেশনে আলাদাভাবে সময় নিয়ে সিদ্ধান্ত নেওয়া উচিত (isDemoMode
   prop থ্রেড করা বনাম আরেকটা purpose-built strip যথেষ্ট কিনা)।

**৫. LandingPage.jsx-এ wiring:** `DemoContent({ role })` নামে একটা ছোট
dispatcher কম্পোনেন্ট যোগ করা হয়েছে — `role === 'student'` হলে নতুন
`StudentDemoDashboard` রেন্ডার করে, অন্য role-এর জন্য এখনো
`DemoComingSoon` (আগের মতোই, Phase D/E বাকি)। দুটো render call site
(mobile full-screen branch + desktop mockup branch) দুটোই
`DemoComingSoon` থেকে `DemoContent`-এ বদলানো হয়েছে।

**৬. build verification:** `npx vite build` পাস, কোনো error/warning
নেই। `LandingPage` chunk ৯.১৩ kB থেকে ১২.৪১ kB (gzip ৩.৯৭ kB) হয়েছে
নতুন কন্টেন্টের কারণে — এখনো নিজস্ব lazy chunk হিসেবেই আলাদা।

**৭. ⚠️ ম্যানুয়াল টেস্ট এখনো বাকি (dev environment না থাকায় এই সেশনে
সম্ভব হয়নি):**
- Student role card ক্লিক করে actually demo dashboard দেখা যাচ্ছে
  কিনা — attendance %, stat tiles ঠিক সংখ্যা দেখাচ্ছে কিনা visually।
- Mobile viewport-এ demo nav strip ঠিকভাবে বসছে কিনা (sticky role
  pill-switcher-এর নিচে না ওপরে, ইত্যাদি)।
- Network ট্যাবে verify করা যে কোনো Firestore write/subscription call
  হচ্ছে না — কোড-লেভেলে verified (কোনো store.get/subscribe কল নেই
  StudentDemoDashboard.jsx-এ), কিন্তু browser-এ ম্যানুয়ালি confirm
  করা হয়নি।

**৮. এই সেশনে যা করা হয়নি (Phase C-এর বাকি বুলেট, পরের সেশনের জন্য):**
- Real Sidebar/BottomNav reuse (৪ নং পয়েন্ট — বড় আলাদা কাজ)।
- Schedule preview — এখনো যোগ করা হয়নি এই ফেজে (Marks list-ও না,
  কারণ Phase B-এর Finding #৪-এ পাওয়া `CourseListRow`-এর impurity এখনো
  fix হয়নি)।
- Shop order preview — শুধু একটা static "সাইন আপ করলে দেখা যাবে" টিজার
  লাইন, আসল preview না (Phase F-এর cross-role order data-এর ওপর নির্ভর
  করে, যা এখনো বানানো হয়নি)।
- Notice feed — static ২-item list, real `ClassNoticeFeed.jsx`/
  `ClassNoticesPanel.jsx` কম্পোনেন্ট থেকে extract করা presentational
  অংশ ব্যবহার করা হয়নি (সময়াভাবে; ভবিষ্যতে সেগুলোও verify করে extract
  করা যেতে পারে, এই সেশনে করা হয়নি)।
- write-triggering control hide/disabled প্যাটার্ন প্রযোজ্য হয়নি কারণ
  এই ফেজে যা রেন্ডার হয়েছে তার কোনোটাতেই edit/write control নেই
  (StatCard/AttendanceHero দুটোই pure display, `to`/`onClick` handler
  কোথাও পাস করা হয়নি)।

---

## Phase D — Faculty Demo

### কী করতে হবে
- Phase B-তে faculty-অংশের extraction শেষ করে (যদি Phase B-তে student
  অংশই আগে করা হয়ে থাকে) এখন faculty demo বানাও।
- কভার করতে হবে: class roster view, notice broadcast history
  (`NoticesTab`), schedule tab, question bank tab, meeting list
  (`MeetingCard`)।
- Cross-role: এই demo teacher-এর পাঠানো notice, student demo-র notice
  feed-এ যেন দেখা যায় (Phase F-এর dataset link অনুযায়ী)।

### Done হওয়ার শর্ত
- `npx vite build` পাস।
- Faculty role card থেকে demo-তে ঢোকা যায়, write control সব
  disabled/hidden।

### Findings / Context (for future phases)
*(এই ফেজ শেষ হলে এখানে লেখা হবে)*

---

## Phase E — Provider Demo

### কী করতে হবে
- Phase B-তে provider-অংশের extraction শেষ করে provider demo বানাও।
- কভার করতে হবে: `PendingBookingCard`, `InquiryQueueCard`,
  `ConfirmedList`।
- Cross-role: student demo-র order, এখানে provider-এর pending queue-তে
  একই order হিসেবে দেখা যাবে।

### Done হওয়ার শর্ত
- `npx vite build` পাস।
- Provider role card থেকে demo-তে ঢোকা যায়, student demo-র order এখানে
  consistent দেখা যায়।

### Findings / Context (for future phases)
*(এই ফেজ শেষ হলে এখানে লেখা হবে)*

---

## Phase F — Cross-Role Data Wiring + Dataset চূড়ান্তকরণ

### Demo World Schema (draft, Phase 0-এর সিদ্ধান্ত অনুযায়ী guestDemoData.js-এর সাথে সমন্বয় করে চূড়ান্ত করতে হবে)

```js
// src/data/demo/demoWorld.js  (Phase 0-এর সিদ্ধান্ত অনুযায়ী নাম/লোকেশন
// বদলাতে পারে — guestDemoData.js-এর সাথে merge/extend করা হলে সেই
// অনুযায়ী)

DEMO_CLASS = {
  id: 'demo-class-cse23a',
  name: 'CSE 23 Section A',
  dept: 'CSE', batch: '2k23', section: 'A',
}

DEMO_STUDENTS = [
  { id: 'demo-std-1', name: 'Rafiul Islam', roll: '2307001', isCR: true },
  { id: 'demo-std-2', name: 'Nusrat Jahan', roll: '2307014' },
  { id: 'demo-std-3', name: 'Tanvir Ahmed', roll: '2307022' },
]
// প্রধান demo-persona (student-view-তে "তুমি"): demo-std-1 (Rafiul, CR)

DEMO_TEACHER = {
  id: 'demo-teacher-1', name: 'Dr. Kamal Hossain',
  courses: ['CSE 2101', 'CSE 2103'],
}
// faculty-view-তে "তুমি" এই persona

DEMO_SHOP = {
  id: 'demo-shop-1', name: 'Print Point', ownerUid: 'demo-provider-1',
  category: 'printing',
}
// provider-view-তে "তুমি" এই shop owner persona

DEMO_ORDER = {
  id: 'demo-order-1', shopId: 'demo-shop-1', studentId: 'demo-std-1',
  item: 'Lab Report Print (12 pages)', status: 'pending',
}

DEMO_NOTICE = {
  id: 'demo-notice-1', classId: 'demo-class-cse23a',
  fromTeacherId: 'demo-teacher-1',
  title: 'CT-1 Schedule Published',
  body: 'ফাব্রিকেটেড demo বডি টেক্সট',
}

DEMO_QUESTION_BANK_ENTRY = {
  id: 'demo-qb-1', courseId: 'CSE 2101', uploadedByTeacherId: 'demo-teacher-1',
  title: 'CT-1 Question (2025)',
}

DEMO_MEETING = {
  id: 'demo-meeting-1', classId: 'demo-class-cse23a',
  scheduledByTeacherId: 'demo-teacher-1',
  topic: 'Mid-term Review', date: '<future demo date>',
}
```

গুরুত্বপূর্ণ পূর্ব-অভিজ্ঞতা (`guestDemoData.js`-এর Phase 2.2 status
note থেকে, নতুন dataset বানানোর সময় মনে রাখতে হবে): `GUEST_PROFILE.
studentId` ইচ্ছাকৃতভাবে `'2307000'` (না `'0000000'`) বাছাই করা
হয়েছিল যাতে `extractBatchFromRoll()` real, seeded `'2k23'` batch key-তে
resolve করে (`store.js`-এর `BATCH_START_DATES`)। নতুন `DEMO_STUDENTS`
রোল নম্বরগুলোও (`2307001` ইত্যাদি) এই একই প্যাটার্নে বাছাই করা হয়েছে —
এটা বজায় রাখতে হবে, নাহলে downstream attendance/batch গণনা লজিক null
বা crash দিতে পারে। এছাড়া `GUEST_ATTENDANCE`-এ ইচ্ছাকৃতভাবে একটা
non-uniform (৬৮%, warning-level) কোর্স রাখা হয়েছিল যাতে UI-এর warning
state-ও demo-তে দেখা যায় — নতুন dataset-এও অন্তত একটা কোর্স/আইটেমে এই
প্যাটার্ন রাখা উচিত (সব "সবুজ" demo না, বাস্তবসম্মত মিশ্রণ)।

### কী করতে হবে
- উপরের schema চূড়ান্ত করো (Phase 0-এর guestDemoData.js
  merge/extend সিদ্ধান্ত অনুযায়ী ফাইল বসাও)।
- প্রতিটা role demo (C/D/E)-তে এই একই dataset থেকে data feed করো,
  যাতে ID reference মিলে যায় (student-এর order provider-এ, class-এর
  notice দুই দিকেই, ইত্যাদি)।
- pure data ফাইল হিসেবে রাখো — কোনো Firebase/store import না
  (`guestDemoData.js`-এর মতোই grep দিয়ে verify করো:
  `grep -rn "firebase|firestore|store\.get|store\.set|onSnapshot"`)।

### Done হওয়ার শর্ত
- `npx vite build` পাস।
- তিন role demo-তে ঢুকে cross-reference manually verify করা — student
  view-তে order দেখা যায় এবং provider view-তে একই order pending
  queue-তে দেখা যায় (একইভাবে notice/question bank/meeting)।

### Findings / Context (for future phases)
*(এই ফেজ শেষ হলে এখানে লেখা হবে)*

---

## Phase G — Role-Aware Guide System (আগের প্ল্যানের Phase 5, এখনো implement হয়নি)

⚠️ এই ফেজ আগের `GUEST_MODE_PLAN.md`-এর Phase 5-এর হুবহু বিবরণ — এখানে
পুনরায় দেওয়া হলো যাতে এই নতুন প্ল্যান-প্রম্পট ফাইল **সম্পূর্ণ
self-contained** থাকে (পুরনো ফাইল খুঁজে বের করতে না হয়)।

### সমস্যা (verified, `GuideModal.jsx`/`guideContent.js` পড়ে)
`getShellContext(pathname)` এখনো path-based:
```js
function getShellContext(pathname) {
  if (pathname.startsWith('/provider')) return 'provider';
  if (pathname.startsWith('/faculty')) return 'faculty';
  if (pathname.startsWith('/team') || pathname.startsWith('/admin-hub') || pathname.startsWith('/admin')) return 'staff';
  return 'student';
}
```
চারটা সমস্যা:
1. Path-based, account-based না — ভুল role-এর guide দেখাতে পারে।
2. শুধু student shell-এর "Overview" ক্যাটাগরি আছে (`visibleCategories.
   student = [0,1,2,3]`); faculty/provider/staff শুধু একটা feature
   category পায়, কোনো general intro ছাড়া।
3. Signed-out visitor-এর জন্য কোনো guide content নেই — fallback
   `'student'`-এ পড়ে ভুল (পুরো student feature) guide দেখায়। **এটাই
   নতুন landing page-এর সরাসরি blocker।**
4. CR-merge লজিক (`isViewerCR` হলে category ৪ যোগ হয়) ঠিকই আছে, রাখতে
   হবে অপরিবর্তিত।

### কী করতে হবে
1. `getShellContext(pathname)`-কে account-role-based বানাও:
   `useIsFaculty()`, `useIsProvider()`, `useIsStaff()` (আছে কিনা
   `hooks/`-এ চেক করো, না থাকলে `App.jsx`/`Sidebar.jsx` যেভাবে shell
   selection করে সেই প্যাটার্ন reuse করো)। ছয়টা resolved context:
   `'guest'` (নতুন), `'student'`, `'student-cr'`, `'faculty'`,
   `'provider'`, `'staff'`।
2. `GuideModal`-কে resolved role prop হিসেবে নিতে হবে (caller থেকে),
   নিজে `useLocation()` দিয়ে derive করবে না। সব call site
   (`Navbar.jsx`, `AuthModal.jsx`, `RoleSelectScreen.jsx` — grep করে
   বাকিগুলো খুঁজে বের করো) আপডেট করো।
3. `guideContent.js`-এ চারটা নতুন "Overview" সেকশন যোগ করো (BN+EN
   দুইটাই, বিদ্যমান সেকশনের ঠিক ফরম্যাট/structure মিলিয়ে):
   - **Guest Overview** — "What is KUETx?" সংক্ষিপ্ত পরিচিতি, ৪টা
     role-এর কনসেপ্ট, sign-up CTA। ২-৪টা ছোট সেকশন, feature-walkthrough
     না।
   - **Faculty Overview**, **Provider Overview**, **Staff Overview** —
     একইভাবে, প্রতিটার existing feature category-র আগে বসবে।
4. `visibleCategories` নতুন করে compose করো:
   ```js
   {
     guest:    [/* Guest Overview only */],
     student:  [/* Overview, Academics, Campus Life, Tools */], // অপরিবর্তিত
     faculty:  [/* Faculty Overview, Faculty Portal */],
     provider: [/* Provider Overview, Service Provider */],
     staff:    [/* Staff Overview, Team & Admin */],
   }
   ```
   `student-cr` = `student` + CR category (আগের মতোই), শুধু
   `isViewerCR` derive করার সোর্স route থেকে account-role-এ বদলাও
   (থ্রেড করা আছে কিনা আগে দেখে নাও)।
5. Guest-mode landing page/demo-তে `?` guide icon হয় `'guest'` resolve
   করবে এবং শুধু Guest Overview দেখাবে, নয়তো — সহজ বিকল্প হিসেবে —
   guide icon-টাই আপাতত hide রাখা যেতে পারে আর "what is KUETx" content
   সরাসরি landing page-এর body copy-তে থাকবে (Phase A)। কোনটা করেছ তা
   Findings-এ লেখো।

### Done হওয়ার শর্ত
- অন্তত ২টা ভিন্ন route থেকে একই account-এর জন্য গাইড খুলে একই সঠিক
  content দেখা যায়।
- সব ৬টা role/context-এর জন্য Overview সেকশন আছে, কোনোটা ফিচার-ডকে
  সরাসরি না ঢুকে।
- বিদ্যমান CR-merge, বিদ্যমান কোনো গাইড কনটেন্ট (BN/EN) মোছা/rewrite
  হয়নি।
- `npx vite build` পাস।

### Findings / Context (for future phases)
*(এই ফেজ শেষ হলে এখানে লেখা হবে)*

---

## Phase H — Sign-In Prompt, Bounce-back, Mockup Toggle, Polish, QA

### কী করতে হবে
- একটা reusable "Sign in korun" prompt component — প্রতিটা demo
  পেজে আলাদা না বানিয়ে একবার বানিয়ে import করো।
- Desktop mockup: adaptive single mockup component (📱⟷🖥️ টগল, শুধু
  CSS dimension বদলায়) — halfway-realistic frame (phone: rounded-rect
  + পাতলা border + notch-cutout; desktop: rounded-rect + traffic-light
  dot bar)। Default: desktop visitor প্রথমে "🖥️ Desktop" mode দেখবে।

  **এই approach বাছাইয়ের কারণ (trade-off বিবেচনা করে):**

  | বিকল্প | দেখতে কেমন | Effort | ঝুঁকি |
  |---|---|---|---|
  | Realistic frame (পূর্ণ bezel, notch/camera-dot, speaker গ্রিল, browser হলে URL bar+tab+traffic-light) | A3KM Studio রেফারেন্স স্ক্রিনশটের মতো premium | বেশি — প্রতিটা ডিভাইস-শেপের জন্য আলাদা CSS/SVG, বেশি maintenance | কম — শুধু visual, functional risk নেই |
  | সাধারণ rounded-rectangle container (হালকা shadow/border) | পরিষ্কার, professional কিন্তু কম "wow" | কম | কম |

  **চূড়ান্ত সিদ্ধান্ত: halfway approach** (ওপরে বর্ণিত) — পূর্ণ
  bezel/notch/speaker না বানিয়ে ন্যূনতম cue (phone: border+notch-cutout;
  desktop: dot-bar) দিয়েই "এটা ফোন/ব্রাউজার" বার্তা স্পষ্ট করা, কিন্তু
  জটিল SVG/গ্রাফিক্স ছাড়াই। এটা বদলাতে চাইলে (পূর্ণ realistic frame-এ
  upgrade), effort কলামটা মাথায় রেখে সিদ্ধান্ত নিও — শুরুতে halfway দিয়ে
  শুরু করে পরে upgrade করা, প্রথমেই ভারী frame বানানোর চেয়ে নিরাপদ।
- Mobile: role card ক্লিক করলে full-screen demo (কোনো ফোন-মকআপ না),
  উপরে sticky role pill-switcher + "← landing-এ ফিরুন" বাটন।
- Sign In বাটনে ক্লিক বা কোনো write-trigger ছোঁয়ায় → Sign In prompt।
- **SEO re-check (নতুন finding, আগের কোনো প্ল্যানে ছিল না):** root
  `/`-এর content সম্পূর্ণ বদলে যাওয়ায়, সম্প্রতি সেটআপ করা Google
  Search Console + Bing Webmaster Tools-এ নতুন root page re-submit/
  re-crawl-request করা দরকার কিনা যাচাই করো — অন্তত `usePageMeta()`
  hook root route-এ ঠিকভাবে বসানো আছে তা নিশ্চিত করো (About.jsx-এ যেভাবে
  বসানো আছে, একইভাবে)।
- Mobile/desktop breakpoint নিশ্চিত করো `BottomNav.jsx`-এর
  `MOBILE_NAV_QUERY` (`(max-width: 767.98px)`, verified) এর সাথে
  মিলছে।
- Phase 0-এ যদি পুরনো `/guest/*` cleanup-এর সিদ্ধান্ত "পরে মুছবে" হয়ে
  থাকে, এই ফেজে সেই cleanup করো (route, page ফাইল, `PUBLIC_PATHS`
  এন্ট্রি মুছে ফেলা)।

### Done হওয়ার শর্ত
- Full manual QA pass: desktop + mobile উভয়ে, ৩ role, sign-in flow,
  browser back button, bookmark redirect।
- `npx vite build` পাস, কোনো console error নেই।

### Findings / Context (for future phases)
*(এই ফেজ শেষ হলে এখানে লেখা হবে)*

---

## Phase I — `About.jsx` Feature-List আপডেট (ভিন্ন কাজ, কিন্তু directly related)

### সমস্যা (verified, `src/pages/About.jsx` লাইন ৩২৫-৩৬৯)
`About.jsx`-এর "Key Features" সেকশন ("Organized into four powerful
modules": Academics / Daily Life / Finance & Activities / Tools &
Analytics) এখনো পুরনো **single-user personal-tracker era**-র ফিচার
তালিকা দেখাচ্ছে (Namaz Reminder, Self Evaluation, Money Management,
Smart Score ইত্যাদি) — অথচ route inventory (`App.jsx`) অনুযায়ী প্রোডাক্ট
অনেক দূর এগিয়ে গেছে:

| সিস্টেম যা এখন প্রোডাক্টে আছে | About.jsx-এ আছে? |
|---|---|
| CR Hub (class setup/planner/roster/notices/CT-quiz) | ❌ না |
| Faculty Portal (class management, marks quota, Blue Tick) | ❌ না |
| Provider/Service Marketplace (booking, inquiry) | ❌ না |
| Errand system | ❌ না |
| Question Bank (R2-backed, approval flow) | ⚠️ শুধু "প্রশ্ন ব্যাংক" এক লাইনে |
| Notice system (Phase 2-6, markdown, acknowledgment) | ❌ না |

**এটা demo-mode প্ল্যানের বাইরের কাজ, কিন্তু Phase A-তে landing page
বানানোর সময় `About.jsx` পড়া হবেই (role card content-এর সোর্স হিসেবে
ভুলভাবে বিবেচিত হয়েছিল আগে) — তাই সেই সময়েই এই inconsistency ধরা পড়বে,
আলাদা backlog আইটেম হিসেবে আগে থেকে প্ল্যানে লিখে রাখা ভালো, নাহলে
"কোনটা সঠিক দাবি — About নাকি landing page" এই বিভ্রান্তি হবে।**

### কী করতে হবে
1. `About.jsx`-এর "Key Features" গ্রিড (লাইন ~৩৩২-৩৬৮) নতুন করে লেখো —
   memory/project history-তে verified আসল module structure থেকে, যেমন:
   - **Academics** (অপরিবর্তিত রাখা যায় — এখনো relevant): Attendance
     Tracking, Marks & Results, Class Schedule, Syllabus Browser,
     Teacher Directory, Question Bank
   - **Class Rep (CR) System** (নতুন ক্যাটাগরি): Class Setup, Roster
     Management, Notice Broadcasting, CT/Quiz Planning
   - **Faculty Portal** (নতুন ক্যাটাগরি): Class & Schedule Management,
     Session Tracking, Marks Entry, Notices, Meetings
   - **Campus Services** (নতুন, পুরনো "Finance & Activities"-এর
     replacement): Service/Provider Marketplace, Booking & Inquiries,
     Errand Requests
   - পুরনো ব্যক্তিগত-ট্র্যাকার আইটেম (Namaz, Money, Self Eval, Clubs)
     যেগুলো এখনো কোডে আছে (`/namaz`, `/money`, `/clubs` route verified)
     সেগুলো বাদ না দিয়ে, ছোট একটা "Personal Tools" ক্যাটাগরিতে সরিয়ে
     রাখা যায় (মুছে ফেলার দরকার নেই — এখনো real ফিচার হিসেবে কোডে
     আছে, শুধু এখন secondary)।
2. সংখ্যা/module-count claim ("four powerful modules") নতুন
   ক্যাটাগরি-সংখ্যার সাথে মিলিয়ে আপডেট করো।
3. Landing page (Phase A)-এর role-card বুলেটের সাথে এই আপডেট করা
   `About.jsx` content-এর দাবি যেন **সামঞ্জস্যপূর্ণ** থাকে (একটা
   double-check pass, দুই জায়গার lists পাশাপাশি রেখে পড়ে)।

### Done হওয়ার শর্ত
- `npx vite build` পাস।
- `About.jsx`-এর ফিচার-লিস্ট আর landing page role-card বুলেট
  একই সিস্টেম-সেট বর্ণনা করছে, কোনো contradiction নেই।

### Findings / Context (for future phases)
*(এই ফেজ শেষ হলে এখানে লেখা হবে)*

---

## Role Card Feature Content (verified — Phase A/I দুটোতেই এখান থেকে নাও, `About.jsx` থেকে না)

Route inventory (`App.jsx`) + memory-র "Recent months" history থেকে
cross-verified করে বানানো। Review করে edit/approve করো — এটা draft,
lock না।

**🎓 Student card:**
- ক্লাস রুটিন, উপস্থিতি ও মার্কস ট্র্যাকিং — এক জায়গায়
- CR-পরিচালিত ক্লাস নোটিশ, roster, ও group কানেকশন
- কোর্স ম্যাটেরিয়াল, প্রশ্ন ব্যাংক (approval-flow সহ) ও সলিউশন
- ক্যাম্পাস সার্ভিস (প্রিন্ট, খাবার, টিউশন) সরাসরি অর্ডার ও এরান্ড রিকোয়েস্ট

**👨‍🏫 Faculty card:**
- ক্লাস অ্যাটেন্ডেন্স ও মার্কস এন্ট্রি ডিজিটালি (session counting, marks quota সহ)
- সরাসরি নোটিশ ব্রডকাস্ট নিজের ক্লাসে
- প্রশ্ন ব্যাংক আপলোড ও মিটিং শিডিউল
- সব CR ও ক্লাসের একসাথে ওভারভিউ (Blue Tick verification-সহ)

**🏪 Provider card:**
- ক্যাম্পাসের ভেতরেই নিজের শপ/সার্ভিস চালু রাখা
- অর্ডার ও বুকিং রিয়েল-টাইমে ম্যানেজ করা (multi-item booking সহ)
- ছাত্রছাত্রীদের সরাসরি ইনকোয়ারি হ্যান্ডল করা
- Errand request/delivery ট্র্যাকিং

**৪র্থ role (Staff/Admin) কেন demo-তে নেই — এক্সপ্লিসিট কারণ:**
Admin/Staff role (`/team`, `/admin-hub`) internal, sensitive পারমিশন
(faculty verification, batch settings) নিয়ন্ত্রণ করে — এটা public
demo-র জন্য উপযুক্ত না। শুধু Student/Faculty/Provider — এই ৩টা
public-facing role-ই demo-তে দেখানো হবে। (Guide system-এর Phase G-তে
অবশ্য `'staff'` context এখনো signed-in staff account-দের জন্য দরকার,
সেটা আলাদা বিষয়।)

---

## যাচাই করা টেকনিক্যাল রেফারেন্স (সব কোড পড়ে verified, ২০২৬-০৮-১৩ তারিখে)

- Mobile breakpoint: `(max-width: 767.98px)` —
  `src/components/BottomNav.jsx` লাইন ১৭, constant নাম
  `MOBILE_NAV_QUERY`।
- `PUBLIC_PATHS` (বর্তমান): `App.jsx` লাইন ৬৫৮ — `['/about', '/guest',
  '/guest/dashboard', '/guest/schedule', '/guest/attendance',
  '/guest/marks']`।
- Line counts: `Dashboard.jsx` ৫৩৫, `Schedule.jsx` ২৯৩১,
  `Attendance.jsx` ১৫০৭, `FacultyClassDetail.jsx` ১৯১০,
  `ProviderDashboard.jsx` ১১৪০।
- `About.jsx` মোট ৬২৪ লাইন; "Key Features" সেকশন লাইন ৩২০-৩৬৯।
- সব পেজ ইনভেন্টরি (৭৫টা `.jsx` ফাইল `src/pages/`-এ, faculty/provider/
  guest সাব-ফোল্ডার সহ) — CR Hub, Errand system, Admin/Staff role,
  Question Bank, Notice system সব রুটে verified উপস্থিত।
- Documentation placement rule: এই ফাইলটা
  `documentation/03-features/guest-mode/` এ থাকবে,
  `CURRENT.md`-এর পাশে — root বা অন্য কোথাও না
  (project rule, `README.md` + `documentation/README.md` §৪)।

---

*এই ফাইলটা ইউজারের original DEMO_MODE_FULL_PLAN.md (analysis-only)
এবং একটা সম্পূর্ণ কোডবেস + পূর্ববর্তী-প্ল্যান cross-check থেকে বানানো।
সব gap/finding মূল বিশ্লেষণে যাচাই করা, অনুমান না।*
