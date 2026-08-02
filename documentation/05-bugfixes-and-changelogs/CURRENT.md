# General Bugfixes & Changelogs — Current Status

> **এই ফাইলটাই app-wide (কোনো একক ফিচারের না) বাগফিক্স/changelog-এর
> একমাত্র active doc। নতুন কোনো general bugfix হলে নতুন ফাইল না বানিয়ে
> এই ফাইলে যোগ করো (উপরে নতুন এন্ট্রি, নতুনটা সবচেয়ে উপরে)।**
>
> সব পুরনো raw bugfix round/changelog ফাইল (round1-6, StaffDashboard fix,
> console permission fix, ইত্যাদি) সরিয়ে রাখা আছে:
> [`documentation/00-old-data/05-bugfixes-and-changelogs/`](../00-old-data/05-bugfixes-and-changelogs/)

---

## এখন পর্যন্ত সমাধান হওয়া উল্লেখযোগ্য বাগ (সংক্ষেপে, ইতিহাস)

- **তিন role-এর জন্যই role-resolve fallback অডিট + student-side fix
  (follow-up):** নিচের provider entry-টার পরে ব্যবহারকারীর অনুরোধে
  student আর teacher-এও একই ক্লাসের বাগ আছে কিনা চেক করা হয়েছে।
  Teacher-এর জন্য `faculty/{uid}` fallback আগে থেকেই ঠিক ছিল। কিন্তু
  **student**-এর জন্য এই গ্যাপ প্রকৃতপক্ষে provider-এর চেয়েও খারাপ
  ছিল — `RoleSelectScreen.jsx`-এর `choose('student')` teacher/provider-এর
  মতো কোনো আলাদা per-role Firestore doc তৈরি করে না (শুধু
  `persistAccountRoleToServer('student')` কল করে), তাই সেই একটা write
  fail করলে (বা পরে `users/{uid}.role` read fail করলে) কোনো server-side
  প্রমাণই অবশিষ্ট থাকত না — `accountRole` চিরকাল null থেকে যেত এবং
  `buildQueue()` `role-select` queue-এ push করত, মানে আগে থেকে থাকা real
  account-কেও বারবার Student/Teacher/Provider picker আবার দেখানো হতো,
  প্রতিটা লোডে। ফিক্স: `students/{uid}` doc (profile setup সম্পূর্ণ
  হলে `pushProfile` যেটা লেখে) থাকলে সেটাকে fallback signal হিসেবে
  ব্যবহার করা হয়েছে — `pullProfile()` দিয়ে (genuine server read, local
  cache না), ঠিক provider fallback-এর মতো একই প্যাটার্নে।
- **Provider account-এ প্রতি লোড/রিফ্রেশে student `ProfileSetupModal`
  (Full Name/Student ID/KUET Email/Department/Blood Group) `/provider`-এ
  দেখানো, রিফ্রেশ করলেও না যাওয়া:** এটা আগের provider-flash/role-leak
  বাগ (নিচে) থেকে আলাদা একটা ভিন্ন root cause। `App.jsx`-এর
  `buildQueue()`-এ role resolve করার সময় (`accountRole` লোকালি না
  থাকলে) `users/{uid}.role` সার্ভার রিড ফেইল করলে বা কখনো persist না
  হলে, faculty branch-এর জন্য একটা fallback ছিল (`faculty/{uid}` doc
  আছে কিনা চেক করে) কিন্তু provider-এর জন্য সমতুল্য কোনো fallback
  ছিলই না — `providers/{uid}` doc আছে এমন real provider account-এও
  `accountRole` কখনো resolve হতো না, ফলে কোড শেষমেশ student branch-এ
  পড়ে যেত (`q.push('profile')`) — প্রতিটা লোডে, কারণ কিছুই কখনো role
  ঠিক করে persist করত না। ফিক্স: `getProviderProfile()` দিয়ে
  `providers/{uid}` existence চেক যোগ করা হয়েছে, ঠিক faculty
  fallback-এর মতো একই প্যাটার্নে — পাওয়া গেলে `accountRole` local +
  server দুই জায়গাতেই `'provider'` হিসেবে সিঙ্ক করা হয়।
- **Student-shell leak — সম্পূর্ণ sweep + আসল flash root cause fix:**
  আগের এন্ট্রি (নিচে, "Provider shell-এ student-only Layout-global
  component leak") `NoCRBanner`, `NoticeToast`, `ProfileCompleteReminder`
  ফিক্স করেছিল। ব্যবহারকারীর অনুরোধে পুরো codebase আবার সম্পূর্ণভাবে
  sweep করা হয়েছে — `getProfile()`/`getGroupId()` কল করা প্রতিটা ফাইল
  (৪২টা) চেক করে দেখা হয়েছে route-guard আছে কিনা। অতিরিক্ত ২টা leak
  পাওয়া গেছে যেগুলো route-lvl guard-এর বাইরে ছিল:
  - **`Sidebar.jsx`**: `isProvider ? Provider-nav : viewMode==='teacher' ?
    Faculty-nav : Student-nav` — কোনো `isResolved` চেক ছাড়া। এছাড়া
    unread-notice-count subscription আর `isRealCR`/`subscribeMembers`
    effect-ও কোনো role-চেক ছাড়া চলত।
  - **`Navbar.jsx`**: চিপ-স্ট্রিপ/টাইটেলের জন্য `navSource` নির্বাচন
    (`isProvider ? getNavProvider() : NAV/NAV_DESKTOP`), notice-bell
    subscription (`profileForNotices`/`groupId`/`notices`), আর
    `unreadAlertCount` — সবকটাই একই কোনো `isResolved`-গার্ড ছাড়া
    সমস্যা।
  সব কটাতে `isProviderResolved`/(`isProviderResolved && isProvider` /
  `!isProvider`) গার্ড যোগ করা হয়েছে — resolve হওয়ার আগে নিরপেক্ষ
  (student না ধরে নিয়ে) অবস্থায় থাকে।

  **আসল root cause (flash-এর প্রকৃত কারণ) — এইবার খুঁজে বের করা
  হয়েছে:** `useIsProvider()`/`useIsFaculty()` হুক দুটোর নিজস্ব
  `onAuthStateChanged` কলব্যাক একটা নতুন/ভিন্ন uid দেখলে
  `subscribeProviderProfile`/`subscribeFacultyProfile`-এর async রেজাল্ট
  আসার আগ পর্যন্ত `isResolved`-কে **সাথে সাথে `false`-এ রিসেট করত না** —
  ফলে account switch/পুরনো session-এ আগের account-এর stale
  `isResolved=true` + stale `isProvider`/`isFaculty` মান একটা ছোট
  সময়ের জন্য পড়া যেত, ঠিক যে window-এ downstream সব `isResolved`-গার্ড
  (Sidebar, Navbar, NoCRBanner, NoticeToast, ProfileCompleteReminder,
  RootRouteResolver) ভুলভাবে "resolved" ধরে নিত। ফিক্স:
  `useIsProvider.js`/`useIsFaculty.js`-এর `onAuthStateChanged` কলব্যাকে
  নতুন uid দেখামাত্রই (async subscribe শুরু হওয়ার আগেই)
  `setIsResolved(false)` কল করা হয় — তাই resolve হওয়ার আগ পর্যন্ত
  প্রতিটা গেটেড consumer সঠিকভাবে neutral/loading state দেখায়, কখনো
  আগের account-এর ভুল মান না।

  সহায়ক ফিক্স: `firebaseAuth.js`-এর `logout()` এখন
  `kuetx:lastKnownFacultyStatus`, `kuetx:lastKnownProviderStatus`,
  `kuetx:lastKnownIsRealCR` — এই তিনটা sessionStorage cache-ও সাইন-আউটের
  সময় ক্লিয়ার করে দেয় (আগে কখনো ক্লিয়ার হতো না), যাতে একই ট্যাবে পরের
  account-এর optimistic paint শুরু হয় fresh state থেকে, আগের
  account-এর cached মান থেকে না।

  এই ফিক্সের ফলে `RootRouteResolver.jsx`-এর আগের `{() => <Dashboard
  />}` ফাংশন-চিলড্রেন প্যাটার্ন (আগের এন্ট্রি দেখো) এখনো ঠিক আছে ও
  দরকারও ছিল, কিন্তু সেটা একা যথেষ্ট ছিল না — `isResolved` নিজেই
  stale-true থাকতে পারত, তাই guard থাকা সত্ত্বেও ভুল শাখা নিতে পারত।
  এই দুই ফিক্স (hook-লেভেল + component-লেভেল isResolved গার্ড) একসাথে
  পুরো flash class-টা বন্ধ করে।
- **Provider shell-এ student-only Layout-global component leak** —
  Provider account দিয়ে সাইন-ইন করা অবস্থায় `/provider`, `/provider/shop`,
  `/provider/profile`, `/settings` ইত্যাদি পেজে student-only ব্যানার/টোস্ট
  দেখা যাচ্ছিল (যেমন "2K23 · ESE has no CR yet — tap to claim CR")। Route
  লেভেলে কোনো ফাঁক ছিল না — `/provider/*` সব route ইতিমধ্যে
  `RequireProvider`-এ wrap করা। আসল কারণ: `App.jsx`-এর `Layout`-এ
  globally mount হওয়া কিছু কম্পোনেন্ট (`NoCRBanner`, `NoticeToast`,
  `ProfileCompleteReminder`) `getProfile()`/`getGroupId()` কল করে সরাসরি
  একটা **local, role-scoped না এমন store cache** (`store.get('profile')`)
  থেকে ডেটা পড়ত, কোনো `useIsProvider()`/`useIsFaculty()` চেক ছাড়াই —
  ফলে ওই একই ব্রাউজারে আগে থেকে cached (বা কোনোভাবে রয়ে যাওয়া)
  student-shaped profile ডেটা (batch/dept/studentId) থাকলে, account
  আসলে provider হলেও এই কম্পোনেন্টগুলো ধরে নিত account student। এটা
  ঠিক সেই একই root cause যেটা root route (`/`) role-bleed বাগে ছিল —
  local/cached ডেটাকে সত্য ধরে নেওয়া, server-verified চেক ছাড়া। `Sidebar`
  আর `Navbar` (যেগুলো একই ডেটা পড়ে) আগে থেকেই `useIsProvider()`
  চেক করত, কিন্তু এই তিনটা component সেই প্যাটার্ন মিস করেছিল। ফিক্স:
  তিনটা কম্পোনেন্টেই `useIsProvider()`/`useIsFaculty()` (দুটোই resolve
  হওয়া পর্যন্ত অপেক্ষা, `RootRouteResolver`-এর একই `isGenuineFaculty`
  শর্ত সহ Founder bypass respect করে) দিয়ে একটা `isStudentShell` গার্ড
  যোগ করা হয়েছে — `isStudentShell` false হলে evaluate/subscribe/render
  কিছুই হয় না। `BottomNav`-এর provider-mode আইটেম (ড্যাশবোর্ড, আমার
  দোকান, প্রোফাইল) স্ক্রিনশটে দেখতে যা মনে হয়েছিল সেটা আসলে সঠিক provider
  nav-ই ছিল, বাগ ছিল না — bottom orange ব্যানারটাই ছিল আসল leak।
- **Root route (`/`) role-bleed বাগ — ফলো-আপ (auto-redirect):** আগের
  ফিক্স (নিচে) root route-এর `<Dashboard />` fallback-কে
  `RequireStudentMode`-এ wrap করেছিল, যেটা server-verified চেক দিয়ে
  role mismatch ধরত ঠিকই, কিন্তু ধরা পড়লে একটা ব্লক স্ক্রিন ("এই পেজ
  শুধু student account-এর জন্য" + ম্যানুয়াল বাটন) দেখাত। ব্যবহারকারীর
  চাহিদা ছিল: root-এ ঢুকলে role অনুযায়ী স্বয়ংক্রিয়ভাবে সঠিক
  dashboard-এ redirect হওয়া উচিত, কোনো ম্যানুয়াল ক্লিক ছাড়াই — ব্লক
  স্ক্রিন root-এর জন্য ভুল UX, কারণ এটাই সেই entry point যেখানে সব
  signed-in account (role নির্বিশেষে) স্বাভাবিকভাবে ল্যান্ড করে। ফিক্স:
  নতুন `src/components/RootRouteResolver.jsx` কম্পোনেন্ট বানানো হয়েছে
  (শুধু root route-এর জন্য, `RequireStudentMode`-এর পাশাপাশি, সেটাকে
  replace না করে) — এটাও একই server-verified `useIsFaculty()`/
  `useIsProvider()` চেক আর একই `isGenuineFaculty` শর্ত ব্যবহার করে
  (Founder bypass respect করে), কিন্তু mismatch পেলে ব্লক স্ক্রিনের
  বদলে সরাসরি `<Navigate to="/faculty" replace />` বা
  `<Navigate to="/provider" replace />` করে দেয়। `App.jsx`-এর root
  `<Route>`-এ `RequireStudentMode` সরিয়ে `RootRouteResolver` বসানো
  হয়েছে; মডেল: client-cached `getAccountRole()` দিয়ে প্রথম দ্রুত
  paint (optimistic), তারপর server-verified হুক resolve হলে সেটা যদি
  client flag-এর সাথে না মেলে তাহলে দ্বিতীয় `<Navigate replace />` দিয়ে
  সংশোধন — pure client-trust থেকে "client-trust + server-verified
  correction" মডেলে। `RequireStudentMode` অপরিবর্তিত রয়ে গেছে ও
  `/profile`, `/courses` ইত্যাদি বাকি সব student route-এ আগের মতোই
  ব্লক-স্ক্রিন আচরণ বহাল আছে (ওগুলো root না, তাই সেখানে ব্লক স্ক্রিনই
  এখনো সঠিক আচরণ)।
  **আপডেট (flash ফিক্স):** প্রথম ভার্সনে redirect হওয়ার ঠিক আগে
  ~১ সেকেন্ডের জন্য student Dashboard-এর একটা flash দেখা যাচ্ছিল।
  কারণ: `App.jsx` `<RootRouteResolver><Dashboard /></RootRouteResolver>`
  আকারে plain JSX pass করছিল, যেটা caller-এর প্রতি render-এই
  `React.createElement(Dashboard)` কল করে ফেলত (Dashboard-এর lazy-chunk
  load/mount cycle শুরু করে দিত) — `RootRouteResolver`-এর নিজের
  `isResolved` গার্ড ঠিকমতো "Checking access…" রিটার্ন করছিল, কিন্তু
  ততক্ষণে Dashboard আগে থেকেই React tree-তে বসে ছিল ও আংশিক render
  হয়ে যাচ্ছিল। এটাও উন্মোচন করেছে: `App.jsx`-এর `buildQueue()`-এ
  `if (!accountRole)` গার্ড শুধু তখনই server-verify করে যখন local
  `getAccountRole()` একদম খালি — আগে থেকে সেট থাকা (কিন্তু stale) role
  কখনো re-verify হয় না, তাই `queueBuilt = true` হওয়াটা
  `getAccountRole()` সঠিক হওয়ার গ্যারান্টি না। ফিক্স:
  `RootRouteResolver` এখন `children` কে element না নিয়ে একটা function
  হিসেবে নেয় (`{() => <Dashboard />}`) — এই function শুধু তখনই কল হয়
  যখন `isResolved` true এবং কোনো mismatch redirect ট্রিগার হয়নি, তাই
  Dashboard construct/mount হওয়ার আগেই resolution সম্পূর্ণ নিশ্চিত হয়ে
  যায়। `buildQueue()`-এর stale-role গ্যাপটা একটা বড়, আলাদা
  architectural বিষয় (শুধু root route না, পুরো onboarding queue-কে
  ছোঁয়) — এই ফিক্সের স্কোপে ধরা হয়নি, ভবিষ্যতে আলাদা কাজ হিসেবে
  বিবেচনা করা যেতে পারে।
- **Root route (`/`) role-bleed বাগ** — `kuetx.vercel.app` (কোনো
  `/provider` পাথ ছাড়া, খালি root) খুললে মাঝে মাঝে student Dashboard
  দেখাত even যখন signed-in account আসলে একটা provider (verified বা
  pending)। Root cause: `App.jsx`-এর `/` route শুধু client-cached
  `getAccountRole()` (localStorage flag) চেক করত — `/profile`,
  `/courses`-এর মতো বাকি সব student route ইতিমধ্যে `RequireStudentMode`
  দিয়ে wrap করা ছিল (যেটা server-verified `useIsProvider()`/
  `useIsFaculty()` দিয়ে ডাবল-চেক করে), কিন্তু root route-এ সেই wrapper
  ছিল না — তাই local flag stale/out-of-sync হলে (যেমন logout timing,
  একই ব্রাউজারে account switch করার race) কোনো দ্বিতীয় চেক ছাড়াই ভুল
  ড্যাশবোর্ড রেন্ডার হয়ে যেত। ফিক্স: root route-এর `<Dashboard />`
  fallback এখন `<RequireStudentMode>`-এ wrap করা, যাতে এটাও বাকি সব
  student route-এর মতো একই server-verified সত্য ব্যবহার করে।
- Faculty module: "My Schedule empty" bug, Tools page missing route,
  Profile Setup loop (round 3 অনুযায়ী root cause পাওয়া গিয়েছিল), email
  double-binding, class creation coverage, students/CR permission বাগ
- Signup role save timing ফিক্স (account creation-এর সাথেই role save)
- Firestore `joinRequests` index missing (deploy gap, কোড বাগ না)
- StaffDashboard multi-role tab বাগ
- Console permission error ফিক্স
- Notice + Bell system audit ও ফিক্স

## ⚠️ সক্রিয়/এখনো-চলমান ইস্যু (memory অনুযায়ী)

- **Profile Setup Modal প্রতি refresh-এ আবার দেখানো**, যদিও Firestore-এ
  profile data সেভ আছে — root cause candidate: `useFirebaseAuth.js`-এ
  race condition, stale/undeployed Firestore security rules, অথবা
  `accountLifecycle.js`-এর `isBrandNewAccount()` মিসফায়ার। পুরনো
  `BUGFIX_NOTES_round3.md` (old-data-তে) একটা আগের profile-setup-loop
  বাগের root cause বর্ণনা করে, কিন্তু এটা current active বাগ কিনা বা
  সেই ফিক্সটা fully hold করছে কিনা যাচাই করা দরকার — কারণ সমস্যাটা
  আবার দেখা দিয়েছে বলে মনে হচ্ছে।

## এই ফাইলে নতুন এন্ট্রি যোগ করার নিয়ম

নতুন কোনো app-wide বাগ ফিক্স হলে "এখন পর্যন্ত সমাধান হওয়া" লিস্টে
সংক্ষেপে যোগ করো, আর যদি কোনো active issue সমাধান হয় তাহলে "সক্রিয়/
এখনো-চলমান ইস্যু" সেকশন থেকে সরিয়ে উপরে নিয়ে যাও।
