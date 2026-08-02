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
