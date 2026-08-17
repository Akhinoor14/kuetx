# LANDING PAGE REDESIGN — PLANNING PROMPT

এই ডকুমেন্টটা কোনো কোড না — এটা একটা রিসার্চ-ব্যাকড প্ল্যানিং প্রম্পট।
এখানে যা কিছু "ফিচার", "সংখ্যা", "policy text" হিসেবে লেখা আছে, সবটাই
সরাসরি প্রজেক্টের real source code থেকে (nav.js, nav-faculty.js,
SidebarNavProvider.jsx, PrivacyPolicy.jsx, App.jsx-এর route list,
scraper output) টেনে আনা — কোনো অংশই অনুমান/বানানো না। যেখানে পুরনো/
inconsistent তথ্য পাওয়া গেছে (যেমন About.jsx-এর "100% Offline"
claim, যেটা এখন cloud-sync ভিত্তিক অ্যাপের সাথে মেলে না), সেটা আলাদা
করে চিহ্নিত করা আছে যাতে ভুলে landing page-এ চলে না যায়।

পরবর্তী ধাপে (কোডিং সেশনে) এই ফাইলটাকে সরাসরি প্রম্পট হিসেবে ব্যবহার
করা যাবে — "এই ফাইল অনুযায়ী LandingPage.jsx রিকনস্ট্রাক্ট করো" বললেই
এখানের সব section/content/data হাতে থাকবে।

---

## ⚙️ META-INSTRUCTIONS — এই doc কীভাবে reuse করতে হবে (প্রতি সেশনে পড়া বাধ্যতামূলক)

**এই সেকশনটা কখনো মুছে ফেলা যাবে না, শুধু "প্রোগ্রেস ট্র্যাকার"
টেবিলটা (নিচে) আপডেট হবে প্রতি সেশনে।** এই ডকুমেন্টটা একটা
reusable, phase-wise কাজের প্রম্পট — প্রতিটা নতুন কোডিং সেশনে এই
ফাইলটাকেই আবার আপলোড/রেফারেন্স করে কাজ চালিয়ে যাওয়া হবে, তাই ফরম্যাট
বদলানো যাবে না।

### কাজ কীভাবে ভাগ হয়েছে
পুরো landing page + auth redesign কাজটাকে ছোট ছোট, স্বয়ংসম্পূর্ণ
**Phase**-এ ভাগ করা হয়েছে (নিচে "প্রোগ্রেস ট্র্যাকার" টেবিলে পূর্ণ
তালিকা)। প্রতিটা Phase একটা একক বসায় শেষ করা যায় এমন সাইজের —
কোনো Phase একসাথে অনেক ফাইল/অনেক সিদ্ধান্ত জড়ায় না।

### প্রতিটা Phase শেষে — বাধ্যতামূলক দুইটা output

Phase-এর কাজ শেষ হলে (কোড লেখা/এডিট করা শেষে), প্রতিবার **ঠিক দুইটা
output** দিতে হবে, এই নিয়ম মেনে:

1. **Full project zip** — পুরো প্রজেক্টের (kuetx.zip থেকে extract
   করা, এই Phase-এর পরিবর্তনসহ) একটা সম্পূর্ণ, ফ্রেশ zip ফাইল।
   এতে আগের Phase-গুলোর সব পরিবর্তনও থাকবে (cumulative, শুধু এই
   Phase-এর diff না) — যাতে যেকোনো Phase-এর শেষে এই zip-টা নিয়ে
   সরাসরি deploy/continue করা যায়।
2. **এই একই MD ফাইল, আপডেট করা** — এই ফাইলটাই ফেরত দিতে হবে, শুধু
   নিচের "প্রোগ্রেস ট্র্যাকার" টেবিলে যে Phase-টা শেষ হলো সেটার
   Status/Notes আপডেট করে, আর "পরবর্তী কোন Phase থেকে শুরু হবে"
   সেটা স্পষ্ট করে লিখে। **বাকি সব কনটেন্ট (Section ১-১৩, meta-
   instructions, asset reference) অপরিবর্তিত থাকবে** — এটা একটা
   living tracker+reference doc, প্রতি Phase-এ নতুন করে লেখা হবে
   না, শুধু tracker table-টা এডিট হবে।

এই দুটো output ছাড়া কোনো Phase "সম্পূর্ণ" ধরা হবে না। যদি কোনো কারণে
একটা Phase আংশিক শেষ হয় (সময়/scope-এর কারণে), সেটাও tracker-এ
সততার সাথে লিখতে হবে (কতটুকু হলো, কতটুকু বাকি, কোথায় আটকে ছিল) —
"সম্পূর্ণ" না লিখে "আংশিক" লিখতে হবে।

### Phase শুরু করার নিয়ম
নতুন সেশনে কাজ শুরুর আগে প্রথমে "প্রোগ্রেস ট্র্যাকার" টেবিল দেখে
বুঝতে হবে গত সেশনে কোন Phase পর্যন্ত হয়েছে, তারপর ঠিক তার পরের
Phase থেকে (বা আংশিক-সম্পন্ন Phase হলে সেটার বাকি অংশ থেকে) কাজ
চালিয়ে যেতে হবে। আগের Phase-গুলোর সিদ্ধান্ত/কাজ আবার নতুন করে করা
যাবে না, শুধু resume করতে হবে।

### Assets (visual mockup/diagram reference)
এই zip-এর `assets/` ফোল্ডারে auth flow redesign-এর জন্য বানানো
visual mockup/diagram আছে — এগুলো শুধু reference/inspiration, সরাসরি
কোডে কপি-পেস্ট করার জন্য না (এগুলো plain HTML/SVG demo, actual React
কম্পোনেন্ট না):
- `assets/mockup_navbar_signin_signup.html` — Navbar-এ Sign In/Sign
  Up বাটন কীভাবে বসবে (desktop label+style, mobile icon-only) —
  §১১.১-এর ভিজ্যুয়াল রেফারেন্স
- `assets/mockup_signup_wizard.html` — Sign Up multi-step wizard-এর
  mobile (full-screen, progress dots) বনাম desktop (centered card,
  step labels) layout — §১১.৩-এর ভিজ্যুয়াল রেফারেন্স
- `assets/diagram_signin_signup_isnewuser_flow.svg` — Sign In vs
  Sign Up-এর পুরো ফ্লো, Firebase-এর `isNewUser` চেক অনুযায়ী branching
  সহ — §৯.৩/§১১.২-এর ভিজ্যুয়াল রেফারেন্স

---

## 📋 প্রোগ্রেস ট্র্যাকার (প্রতি Phase শেষে এই টেবিল আপডেট করতে হবে)

| Phase | নাম | Status | Notes |
|---|---|---|---|
| ০ | Planning doc + auth flow redesign + visual mockup (এই সেশন) | ✅ সম্পূর্ণ | Section ১-১৩ (feature inventory, visual research, auth flow redesign, wizard UI plan) লেখা হয়েছে। Assets (navbar mockup, wizard mockup, flow diagram) তৈরি। কোনো actual কোড এখনো এডিট হয়নি। |
| ০.৫ | Gap analysis — প্ল্যানের দুর্বলতা খুঁজে বের করা (এই সেশন) | ✅ সম্পূর্ণ | Section ১৪-১৫ যোগ হয়েছে। **গুরুত্বপূর্ণ finding:** `claimRoll()` uid ছাড়া কাজ করে না (silent no-op), `FacultyProfileSetupModal.jsx`-এর নিজস্ব ৩-ধাপ async wizard আছে — এই দুটো আগের প্ল্যানের একটা মূল ধরে নেওয়া ("সব local, Google popup-এর শেষে") ভেঙে দেয়। **Phase ১ শুরুর আগে §১৫-এর প্রশ্নগুলো owner-confirm লাগবে, নাহলে Phase ৫/৬ (profile form, roll claim) গিয়ে আটকে যাবে।** কোনো কোড এডিট হয়নি এই সেশনেও। |
| ০.৭ | Owner-confirm + কোড verify (§১৫-এর ৪ প্রশ্নের উত্তর) (এই সেশন) | ✅ সম্পূর্ণ | Section ১৬ যোগ হয়েছে — ৪টা প্রশ্নেরই decision + supporting কোড-প্রমাণ লেখা আছে। **সবচেয়ে গুরুত্বপূর্ণ finding: anonymous session আসলে এখন dead code** — `loginAnonymously()` কোথাও call হয় না (App.jsx-এর comment নিজেই এটা confirm করে), তাই `upgradeWithGoogle()`/`isUpgrade` branch বাস্তবে কখনো true হয় না। এটা আগের প্ল্যানের পুরো §৯.৪/§১৩-এর "guest upgrade flow" অংশটাকেই বাতিল করে দেয় — Phase ১০ (Guest/anonymous upgrade ফ্লো সমন্বয়) এখন **প্রয়োজনই নেই**, dead-code cleanup হিসেবে বিবেচনা করা যেতে পারে ভবিষ্যতে (আলাদা, non-blocking)। কোনো কোড এডিট হয়নি এই সেশনে, শুধু verify + doc আপডেট। |
| ১ | Navbar — Sign In/Sign Up দুই বাটন | ✅ সম্পূর্ণ | **নতুন finding (কোড থেকে, Phase শুরুর আগে verify করা হয়েছে):** `AuthModal.jsx` আসলে Google-only, একটাই ফ্লো — `mode` prop already dead (`void mode;`), Login/Register-এর কোনো আলাদা branch নেই; নতুন/পুরনো ইউজার নির্ণয় হয় Google popup-এর *পরে*, `RoleSelectScreen.jsx`-এ। তাই এই Phase পুরোপুরি cosmetic রাখা হলো: main desktop navbar-এ এখন দুইটা বাটন (outlined "Sign In" + filled "Sign Up"), দুটোই একই `SignInPrompt`→`AuthModal` ফ্লো খোলে, নতুন `authIntent` state ('signin'/'signup') শুধু `SignInPrompt`-এর heading/button copy বদলায় ("সাইন ইন করা লাগবে" বনাম "নতুন অ্যাকাউন্ট বানান")। Mid-demo mobile sticky bar-এর icon-only বাটন (§secondary entry, §১১.১-এর scope না) ইচ্ছাকৃতভাবে একটাই রাখা হয়েছে (space-constrained), `openAuth('signin')`-এ wire করা। কোনো auth logic/AuthModal বদলায়নি। Edited: `LandingPage.jsx`, `SignInPrompt.jsx`। esbuild দিয়ে syntax verify করা হয়েছে, full `npm run build` (network/node_modules install লাগে) এই sandbox-এ চালানো যায়নি — owner প্রথম deploy-এর আগে একবার local build/dev-server-এ visual check করে নিক। |
| ২ | Firebase `isNewUser` detection wiring | ✅ সম্পূর্ণ | **নতুন finding (Phase শুরুর আগে verify করা হয়েছে):** `accountLifecycle.js`-এ আগে থেকেই `isBrandNewAccount(user)` নামে একটা helper আছে (creationTime === lastSignInTime দিয়ে হিসাব করে), যেটা ইতিমধ্যে `useFirebaseAuth.js`-এ sync/cache decision-এর জন্য ব্যবহৃত হচ্ছে — আর এটা `additionalUserInfo.isNewUser` ফ্ল্যাগের চেয়ে বেশি reliable (popup/redirect দুই পাথেই সঠিক)। এছাড়া `App.jsx`-এর `buildQueue()` role routing পুরোপুরি Firestore-ভিত্তিক (`users/{uid}.role` ইত্যাদি), `isNewUser`-এর উপর নির্ভরই করে না। তাই মূল প্ল্যানের "firebaseAuth.js-এ নতুন isNewUser রিটার্ন করা" বাদ দিয়ে, existing `isBrandNewAccount()` **re-use** করা হলো: `AuthModal.jsx`-এর `handleGoogle()`-এ import করে popup-success পাথে `onSuccess(user, { linked, isNewUser })`-এ যোগ করা হয়েছে। Redirect-fallback পাথ (popup ব্যর্থ হলে) এখনো cover হয়নি এই ছোট scope-এ — ভবিষ্যতে wizard যদি সেই পাথ থেকেও `isNewUser` লাগে, `useFirebaseAuth.js`-এর existing `isBrandNewAccount()` কলের কাছ থেকেই নিতে হবে (কোড কমেন্টে নোট করা আছে)। কোনো নতুন detection logic লেখা হয়নি, শুধু existing helper-এর নতুন এক্সপোজার পয়েন্ট। Edited: `AuthModal.jsx` শুধু। সব existing `onSuccess` caller (App.jsx ৩টা, LandingPage.jsx ২টা, Profile.jsx ২টা) backward-compatible যাচাই করা হয়েছে — এক্সট্রা `info.isNewUser` ফিল্ড additive, কেউ ভাঙবে না। esbuild দিয়ে syntax verify করা হয়েছে। |
| ৩ | Sign In flow (simple + inline "সাইন আপ করুন" notice) | ✅ সম্পূর্ণ | §১১.২ অনুযায়ী বাস্তবায়িত: `AuthModal.jsx`-এ কোনো নতুন screen/popup যোগ হয়নি — একই modal-এর ভেতরে `pendingNewUser` state দিয়ে conditional render করা হয়েছে। যখন Phase ২-এর `isNewUser` true আসে **এবং** caller explicitly `intent="signin"` পাস করে (শুধু LandingPage-এর plain "Sign In" বাটন এটা করে — "Sign Up" বাটন করে না, আর App.jsx/Profile.jsx-এর অন্য সব existing `AuthModal` call site কোনো `intent` পাস করেই না, তাই ডিফল্ট `null`-এ safely bypass হয়), তখন inline red-tint notice card দেখায়: "এই Google অ্যাকাউন্ট দিয়ে KUETx-এ এখনো অ্যাকাউন্ট নেই" + "Sign Up শুরু করুন" বাটন। এই বাটন **already-obtained user/info দিয়ে সরাসরি `onSuccess()` কল করে** — কোনো দ্বিতীয় Google popup দেখায় না (§১১.২-এর explicit "popup আবার দেখাতে হবে না" পূরণ) — App.jsx-এর existing `buildQueue()` এমনিতেই brand-new account-কে `RoleSelectScreen`-এ route করে দেয়, তাই কোনো নতুন destination বানানো লাগেনি। "অন্য Google অ্যাকাউন্ট দিয়ে চেষ্টা করুন" ghost বাটনও যোগ করা হয়েছে (notice থেকে ফিরে আসার পথ)। Edited: `AuthModal.jsx` (নতুন `intent` prop, default `null` — opt-in, backward-compatible), `LandingPage.jsx` (দুইটা `AuthModal` কলে `intent={authIntent}` পাস করা)। esbuild দিয়ে দুইটা ফাইলই syntax verify করা হয়েছে। |
| ৪ | Sign Up wizard — ধাপ ১ (Role select) | ⬜ শুরু হয়নি | Scope: §১১.৩, §১১.৩.১, §১১.৩.২ অনুযায়ী নতুন wizard শেল + ধাপ ১ (mobile one-column vs desktop 3-column grid), local state (Firestore write নেই এখনো)। |
| ৫ | Sign Up wizard — ধাপ ২ (role-অনুযায়ী profile ফর্ম) | ⬜ শুরু হয়নি | Scope: Student/Faculty/Provider তিনটা profile ফর্ম re-use করে wizard-এর ভেতরে local state-এ বসানো (Firestore write এখনো না)। |
| ৬ | Sign Up wizard — ধাপ ৩ (Confirm) + Google popup + Firestore commit | ⬜ শুরু হয়নি | Scope: নতুন Confirm/Summary স্ক্রিন (§১১.৩.৩) + `isNewUser` চেক + local state → Firestore atomic write + dashboard redirect। এখানেই পুরো Sign Up ফ্লো end-to-end কাজ করা শুরু করবে। |
| ৭ | `App.jsx` `buildQueue()` bypass (নতুন ফ্লো থেকে আসা অ্যাকাউন্টের জন্য) | ⬜ শুরু হয়নি | Scope: §৯.৪ অনুযায়ী নতুন-ফ্লো অ্যাকাউন্টের জন্য `role-select`/`profile` queue step স্কিপ করা, পুরনো/অসম্পূর্ণ অ্যাকাউন্টের জন্য পুরনো queue logic অক্ষত রাখা। |
| ৮ | Demo mockup ↔ wizard সংযোগ (role pre-fill) | ⬜ শুরু হয়নি | Scope: §১১.৪ — demo role card ক্লিক করে দেখার পর wizard-এ গেলে সেই role pre-selected থাকা। (এটা §১৩-এর একটা open question — শুরুর আগে owner confirm লাগবে ঠিক কখন এই Phase-টা করা হবে, landing visual redesign-এর আগে না পরে) |
| ৯ | Landing page visual redesign — Section ৫/৬/৭ অনুযায়ী (feature breakdown, hero, footer ইত্যাদি) | ⬜ শুরু হয়নি | Scope: Section ৫ (নতুন section কাঠামো), ৬ (visual direction — typography/signature moment/motion, owner-confirm লাগবে §৮-এর প্রশ্নগুলোর উত্তর অনুযায়ী), ৭ (hero deep dive)। এটা auth flow থেকে independent, আলাদা যেকোনো সময় করা যায়। |
| ১০ | Guest/anonymous upgrade ফ্লো সমন্বয় | ⬜ শুরু হয়নি | Scope: §১৩-এর প্রথম open question অনুযায়ী — owner confirm করার পরে। |

**পরবর্তী সেশনে কাজ শুরু হবে: Phase ৪ (Sign Up wizard — ধাপ ১: Role select) থেকে।**

---

## ১. এখন কী আছে (বেসলাইন)

`src/pages/LandingPage.jsx` (~460 লাইন, আজকেই এডিট করা হয়েছে):

- Navbar (logo + Sign In বাটন)
- Hero heading + subtitle
- Stats strip (৩টা সংখ্যা — আজ যোগ করা হয়েছে)
- "কীভাবে কাজ করে" ৩-ধাপ generic explainer (আজ যোগ করা হয়েছে)
- ৩টা role card (Student / Faculty / Provider), প্রতিটায় ৪টা bullet
- Role card ক্লিক করলে mockup preview (desktop: phone/desktop frame
  toggle; mobile: full-screen) — `StudentDemoDashboard.jsx` /
  `FacultyDemoDashboard.jsx` / `ProviderDemoDashboard.jsx` রেন্ডার করে,
  demoWorld.js-এর static fake data দিয়ে
- Demo data notice ব্যানার (আজ যোগ করা হয়েছে — "sample demo data, real
  account না")
- SignInPrompt → AuthModal ফ্লো

**যা মিসিং / দুর্বল (ইউজারের অভিযোগ অনুযায়ী):**
- মাত্র ৩০+ real feature-এর মধ্যে role card-এ মাত্র ৪টা bullet দেখানো
  হচ্ছে — বাকি সব লুকানো
- কে কী সুবিধা পাচ্ছে তার কোনো comparison/breakdown নেই
- "কেন এটা ব্যবহার করবে" — এই প্রশ্নের উত্তর স্পষ্টভাবে কোথাও নেই
- User policy (privacy/terms) landing page-এ কোথাও reference/preview
  নেই — শুধু ফুটার-জাতীয় কিছুই নেই আসলে, পুরো পেজে কোনো ফুটার-ই নেই
- কোনো "who built this / কেন বিশ্বাসযোগ্য" section নেই

---

## ২. Real feature inventory — role অনুযায়ী (source: nav.js, nav-faculty.js, SidebarNavProvider.jsx, App.jsx)

এই তালিকাগুলো সরাসরি নেভিগেশন কনফিগ ফাইল থেকে — প্রতিটা entry একটা
real, live route, কোনো placeholder না।

### ২.১ Student (`src/nav.js`)

**Dashboard** — হোম ওভারভিউ

**Today** — আজকের ক্লাস/কাজ এক নজরে

**Profile** — নিজের প্রোফাইল

**Notice** — নোটিশ ফিড

**Academics → Daily Academics:**
- Attendance (উপস্থিতি ট্র্যাকিং)
- Class Schedule
- Assignments
- Teachers (শিক্ষক তালিকা)
- Classmates
- Class Diary

**Academics → Academic Core:**
- Courses
- Syllabus
- Question Bank
- Publications (শিক্ষকদের গবেষণাপত্র ব্রাউজ — ফ্যাকাল্টি স্ক্র্যাপার
  থেকে; স্ট্যাটাস: `canEdit={false}` — student শুধু দেখতে পারে)
- Solution Bank
- Term Planner (মার্কস)
- Results & GPA
- Alerts

**Campus Life → Campus Life:**
- Projects
- Notes
- Time Tracker
- Money (খরচ ট্র্যাকার)
- Namaz Tracker
- Clubs
- Tuition
- Tours

**Campus Life → Services (ক্যাম্পাস মার্কেটপ্লেস):**
- Salon
- Food (hotel ক্যাটাগরি)
- Pharmacy
- Stationery
- Online Mart
- Pick and Drop (errand/delivery request feed)

**Campus Life → Self Study:**
- Academic self-study mode
- Deep Focus mode

**Class Rep (শুধু CR/ACR অ্যাকাউন্টের জন্য — `requiresCR: true`):**
- Class Setup
- Routine
- Class Planner
- CT & Quiz Planner
- Roster
- Class Announcements
- My Role

**Tools:**
- Reports
- Settings
- About KUETx

**Admin** (শুধু নির্দিষ্ট staff অ্যাকাউন্টের জন্য, `requiresAdmin: true`)
— landing page-এ highlight করার দরকার নেই, এটা internal role।

---

### ২.২ Faculty (`src/nav-faculty.js`)

**Dashboard** — ফ্যাকাল্টি ওভারভিউ

**Profile**

**My Classes** — নিজের পড়ানো ক্লাসগুলোর তালিকা; প্রতিটা ক্লাসের
detail page-এ Roster/Attendance/Marks/Syllabus ট্যাব হিসেবে আছে
(আলাদা নেভিগেশন রো না — nav-faculty.js-এর কমেন্টে স্পষ্ট বলা)

**My Schedule** — নিজের ক্লাস রুটিন

**Communication:**
- Meetings (শিডিউল করা মিটিং)
- Broadcast Notice (নিজের ক্লাসে সরাসরি নোটিশ পাঠানো)

**Resources:**
- Question Bank (আপলোড করা)
- Publications (নিজের গবেষণাপত্র — `canEdit={true}`, নিজে add/edit/
  delete করতে পারে; scraper-written entry manual edit করলে
  `isManuallyEdited: true` হয়ে যায় আর ভবিষ্যতের re-scrape সেটা আর
  ছুঁতে পারে না — এটা বাস্তবিক, উল্লেখযোগ্য একটা ফিচার)
- Contact
- Settings (shared route)
- About (shared route)

**Services** (student-দের মতোই একই মার্কেটপ্লেস অ্যাক্সেস — Salon,
Food, Pharmacy, Stationery, Online Mart, Pick and Drop)

**Admin** (শুধু staff, `requiresAdmin: true`)

---

### ২.৩ Provider (`SidebarNavProvider.jsx`)

Provider-এর নেভিগেশন ইচ্ছাকৃতভাবে ছোট রাখা হয়েছে (কমেন্টে বলা: "an
occasional-use... busy shop owner, 2-second glance UI") — মাত্র ৫টা
top-level destination:

- **Dashboard** — অর্ডার/বুকিং ওভারভিউ
- **My Shop** — নিজের শপ ম্যানেজমেন্ট (Offerings, Shop Settings —
  App.jsx route অনুযায়ী `/provider/shop/offerings`,
  `/provider/shop/settings` sub-pages আছে)
- **Profile**
- **Settings**
- **About**

**যা App.jsx route থেকে অতিরিক্ত পাওয়া গেছে (nav config-এ নাম না
থাকলেও route হিসেবে live):**
- `/provider/shop/offerings/:offeringId` — নির্দিষ্ট offering-এর
  বিস্তারিত পেজ
- `/provider/notifications` — প্রোভাইডার নোটিফিকেশন

**Note:** Provider dashboard demo (`ProviderDemoDashboard.jsx`)-এর
বর্তমান landing-page bullet ("অর্ডার ও বুকিং রিয়েল-টাইমে ম্যানেজ
করা", "ছাত্রছাত্রীদের সরাসরি ইনকোয়ারি হ্যান্ডল করা", "Errand
request/delivery ট্র্যাকিং") — এই তিনটাই real feature-এর সাথে মেলে,
রাখা যায়। "ক্যাম্পাসের ভেতরেই নিজের শপ/সার্ভিস চালু রাখা" bullet-টাও
My Shop ফিচারের সাথে ম্যাচ করে।

---

## ৩. Real, যাচাই করা সংখ্যা (কোনো অনুমান না)

| সংখ্যা | মান | সোর্স |
|---|---|---|
| Faculty প্রোফাইল | ৪৩৬+ | `kuet_faculty_data.json` → `total_teachers` |
| Publications | ৬,২৪৩+ | `kuet_faculty_data.json` → `total_publications` |
| Department/Institute | ২৩ | `kuet_faculty_scraper.py` → `SLUG_TO_DEPT_CODE` key count |
| Student-side top-level route | ৩৬টা (Route path গোনা, `/faculty/*`, `/provider/*`, `/admin/*` বাদে) | `App.jsx` |
| Services মার্কেটপ্লেস ক্যাটাগরি | ৬টা (Salon, Food, Pharmacy, Stationery, Online Mart, Pick and Drop) | `nav.js` |

**সতর্কতা:** faculty/publication সংখ্যা `kuet_faculty_data.json`-এর
`last_run: 2026-08-16T14:16:08` স্ন্যাপশট থেকে — এটা সেই পুরনো,
`teacherEmail` bug-সহ রান। migration script চালানোর পর সংখ্যা
পরিবর্তিত না হওয়ার কথা (migration শুধু field rename করে, document
যোগ/বাদ দেয় না), তবু কোডিং সেশনে বসানোর আগে একবার Firestore Console
থেকে `facultyDirectory`/`facultyPublications` কালেকশনের document
count দিয়ে re-confirm করে নেওয়া ভালো — বিশেষ করে যদি ততদিনে নতুন
biweekly scrape রান হয়ে যায়।

**যা ব্যবহার করা যাবে না (ভুল/পুরনো তথ্য হিসেবে চিহ্নিত):**
- About.jsx-এর "100% Offline. No server, no tracking" এবং
  "Browser localStorage for persistent data management" — এই দুটো
  দাবি এখনকার আর্কিটেকচারের (Firebase/Firestore cloud sync,
  `facultyPublicationsSync.js`, ইত্যাদি) সাথে সরাসরি বিপরীত। এটা
  পুরনো, single-user-tracker-era কপি (LandingPage.jsx-এর নিজের
  কমেন্টেও এই একই flag আগে থেকে করা আছে)। নতুন landing page-এ এই
  claim কোনোভাবেই ব্যবহার করা যাবে না।

---

## ৪. Real Privacy Policy / User Policy কনটেন্ট (source: `PrivacyPolicy.jsx`)

সম্পূর্ণ নীতিমালা `src/pages/PrivacyPolicy.jsx`-এ Bangla+English দুই
ভাষায় বিদ্যমান (KUETx Manifesto v1.1, আগস্ট ২০২৬)। ৯টা সেকশন:

1. **আমরা কী তথ্য সংগ্রহ করি** — একাডেমিক তথ্য (রুটিন, উপস্থিতি,
   বিভাগ/ব্যাচ), বেসিক প্রোফাইল, ফ্যাকাল্টি ভেরিফিকেশন তথ্য, প্রোভাইডার
   ব্যবসা/যোগাযোগ তথ্য
2. **KUETx যা করে না** — তথ্য বিক্রি/শেয়ার না করা, scope-বহির্ভূত
   ব্যবহার না করা, একাডেমিক ফিচারে স্পনসর কনটেন্ট না ঢোকানো
3. **কারা তথ্যে প্রবেশাধিকার পায়** — role-scoped Firestore security
   rules-ভিত্তিক অ্যাক্সেস (Data & Systems Lead/Backend Engineer,
   Admin, CR/ACR, Faculty, Service Provider — প্রতিটার নির্দিষ্ট
   সীমা বর্ণিত)
4. **ব্রিচ রেসপন্স** — সমস্যা পেলে সাথে সাথে জানানো, affected
   student-দের সহজ ভাষায় জানানো, ডকুমেন্টেড রাখা
5. **আচরণবিধি** — সম্মান, সততা, গোপনীয়তা — তিনটা core commitment
6. **মেধাস্বত্ব ও ওপেন-সোর্স অবস্থান** — Founder-owned codebase,
   contributor credit + portfolio use অধিকার, এখনো ওপেন-সোর্স না
7. **স্পনসরশিপ ও বিজ্ঞাপন** — একাডেমিক ফিচার সবসময় বিজ্ঞাপনমুক্ত,
   sponsor-কে কোনো প্রভাব না দেওয়া
8. **ধারাবাহিকতা / শাটডাউন হলে কী হবে** — advance notice, data
   export সুযোগ, শাটডাউনের পর তথ্য মুছে ফেলা (retain/sell করা হবে না)
9. **যোগাযোগ** — Founder-এর সাথে

**Landing page-এ এটা কীভাবে ব্যবহার করা যায় (সাজেশন, চূড়ান্ত না):**
পুরো ৯ সেকশন কপি-পেস্ট না করে, একটা "Privacy & Trust" সংক্ষিপ্ত
section — ৩-৪টা এক-লাইন highlight (যেমন "তথ্য কখনো বিক্রি হয় না",
"role-based access — শুধু যতটুকু দরকার ততটুকুই কে দেখতে পারবে তা
নির্ধারিত", "app বন্ধ হলে data মুছে ফেলা হবে, বিক্রি না") — সাথে
"সম্পূর্ণ নীতিমালা পড়ুন" লিংক যেটা `/privacy` রুটে নিয়ে যায় (আগে
থেকেই আছে, নতুন কিছু বানাতে হবে না)।

---

## ৫. প্রস্তাবিত নতুন Section কাঠামো (redesign-এর জন্য প্রাথমিক রূপরেখা)

এটা একটা প্রাথমিক প্রস্তাব — চূড়ান্ত না, কোডিং সেশনে owner-এর সাথে
confirm করে নেওয়া উচিত প্রতিটা section-এর exact content/অর্ডার।

1. **Navbar** (অপরিবর্তিত)
2. **Hero** — heading + subtitle (অপরিবর্তিত, বা সংক্ষিপ্ত রিফাইন)
3. **Stats strip** (আজ যোগ করা, রাখা যায়) — ৪৩৬+ faculty, ৬,২৪৩+
   publication, ২৩ department, [+ student-side ৩৬+ feature/route যোগ
   করা যায় চতুর্থ stat হিসেবে]
4. **"কেন KUETx?" — value proposition** (নতুন) — ৩-৪টা কার্ড: "সব
   একসাথে, একটাই অ্যাপে" / "role-based, শুধু যা লাগে তাই দেখাবে" /
   "তথ্য নিরাপদ ও বিক্রি হয় না" / ইত্যাদি — policy থেকেই সততার সাথে
   derive করা, বানানো marketing না
5. **Role selector + FULL feature breakdown** (redesign-এর মূল অংশ) —
   এখনকার ৪-bullet card-এর বদলে প্রতিটা role-এর জন্য categorized,
   collapsible/expandable feature list — উপরের সেকশন ২-এর পুরো
   inventory থেকে, ক্যাটাগরি অনুযায়ী গ্রুপ করা (যেমন Student-এর জন্য
   "Academics", "Campus Life", "Services", "CR Tools" — আলাদা
   sub-section হিসেবে, nav.js-এর নিজের গ্রুপিং অনুসরণ করে, না হলে
   ৩৬টা bullet একসাথে দেখালে সেটাও ঘেঁটে যাবে)
6. **"কীভাবে কাজ করে"** (আজ যোগ করা ৩-ধাপ, রাখা যায় বা role
   breakdown-এর সাথে মিশিয়ে দেওয়া যায়)
7. **Demo preview** (mockup, অপরিবর্তিত — DemoDataNotice সহ)
8. **Privacy & Trust** (নতুন) — উপরের সেকশন ৪ থেকে সংক্ষিপ্ত highlight
   + `/privacy` লিংক
9. **Footer** (নতুন, বর্তমানে নেই) — About KUETx লিংক, Privacy Policy
   লিংক, Contact/Founder তথ্য (About.jsx-এ ইমেইল/WhatsApp আছে,
   ব্যবহার করা যায় যদি owner চান পাবলিক রাখতে), copyright/built-with
   note (কিন্তু "100% Offline" claim বাদ দিয়ে)

---

## ৬. ভিজ্যুয়াল ডিজাইন রিসার্চ — কীভাবে info-এর সাথে সাথে visual quality-ও বাড়ানো যায়

এই সেকশনটা শুধু "আরও section যোগ করা" না — কীভাবে সেই sectionগুলো
**দেখতে এবং ব্যবহার করতে ভালো লাগবে** তার জন্য। রিসার্চ প্রজেক্টের
নিজের codebase (`index.css`, `package.json`, `index.html`) থেকে করা,
কোনো generic "landing page best practices" article থেকে কপি না।

### ৬.১ এখন যা আছে (audit)

**Color system** (`src/index.css` `:root`):
- Background `#f5f5f2` (হালকা ক্রিম-সাদা), Surface `#ffffff`
- Text `#1c1c1a`, Muted `#6b6860`
- Accent (primary) `#16a34a` — একটা সুনির্দিষ্ট, saturated সবুজ; সাথে
  `--accentLight` (#22c55e), `--accentDark` (#15803d), `--accent2`
  (#0ea5e9 — নীল, secondary), `--accentSoft` (#dcfce7 — হালকা সবুজ
  ব্যাকগ্রাউন্ড টিন্ট)
- Glass-morphism layer আছে already: `--surfaceGlassStrong`,
  `--surfaceGlass`, `--surfaceGlassSoft` — এগুলো এখনো landing
  page-এ navbar-এ ব্যবহৃত হচ্ছে (`backdropFilter: 'blur(10px)'`)
- Dark mode variant-ও সংজ্ঞায়িত আছে (`.dark` selector) — মানে নতুন
  section বানানোর সময় hardcoded color না দিয়ে সবসময় `var(--...)`
  ব্যবহার করা আবশ্যক, নাহলে dark mode-এ ভেঙে যাবে

**Typography — ⚠️ গুরুত্বপূর্ণ finding:**
- CSS-এ `font-family: 'Sora', 'Hind Siliguri', ...` বহু জায়গায়
  declare করা আছে, কিন্তু **এই ফন্টগুলো আসলে কোথাও load হচ্ছে না** —
  `index.html`-এ স্পষ্ট comment আছে: `<!-- offline: no external
  preconnect to fonts --> <!-- Use system fonts for full offline
  support -->`, এবং সরাসরি body-তে
  `font-family: system-ui,-apple-system,Segoe UI,Roboto,"Noto
  Sans",...` বসানো
  - ব্যতিক্রম: `src/styles/questionbank.css`-এ সরাসরি
    `@import url('fonts.googleapis.com/...Inter...JetBrains+Mono')`
    আছে — Question Bank section-এর জন্য Google Fonts আসলেই load হয়,
    বাকি অ্যাপ system font-এ পড়ে থাকে
  - **এর মানে:** এখন প্রতিটা ব্রাউজার/OS-এ landing page ভিন্ন ফন্টে
    দেখাচ্ছে (Windows-এ Segoe UI, Mac-এ San Francisco, ইত্যাদি) —
    Bangla অংশ 'Hind Siliguri' declare করেও আসলে যেকোনো available
    Bangla-supporting system font-এ পড়ছে, যেটা device-ভেদে
    inconsistent দেখাবে
  - এই "offline-first, no external font" সিদ্ধান্তটা সম্ভবত
    About.jsx-এর একই পুরনো "100% Offline" যুগের সিদ্ধান্ত — এখন
    app cloud-sync নির্ভর হয়ে যাওয়ায় এই constraint-ও পুনর্বিবেচনার
    দাবি রাখে (নিচে ৬.৩-এ প্রস্তাব)

**Iconography:** `lucide-react` (v0.462.0) — outline-style, ধারাবাহিক
stroke-width আইকন সেট, ইতিমধ্যেই পুরো অ্যাপে ব্যবহৃত। নতুন যেকোনো
আইকন এই একই লাইব্রেরি থেকেই নেওয়া উচিত ধারাবাহিকতার জন্য — অন্য কোনো
icon set (react-icons, heroicons) মেশানো ঠিক হবে না।

**Animation:** কোনো animation library নেই (framer-motion ইনস্টল করা
নেই) — যা কিছু motion আছে তা plain CSS `transition` (যেমন role
card-এর `transition: 'all 0.2s'`)। নতুন section-এ heavy scroll-reveal
animation দরকার হলে হয় CSS-only (Intersection Observer + CSS class
toggle) করতে হবে, অথবা framer-motion নতুন dependency হিসেবে যোগ করার
সিদ্ধান্ত নিতে হবে (dependency যোগ করা ছোট কিন্তু আলোচনাযোগ্য সিদ্ধান্ত)।

**বিদ্যমান কম্পোনেন্ট প্যাটার্ন যা landing page ইতিমধ্যে ব্যবহার
করছে (ধারাবাহিকতার জন্য নতুন section-এও এই একই ভাষা রাখা উচিত):**
- Card: `borderRadius: 18px`, gradient background
  (`linear-gradient(180deg, var(--surfaceGlassStrong),
  var(--surfaceGlass))`), soft shadow
- Active/selected state: 2px accent border + subtle accent-tinted
  gradient + accent-tinted box-shadow
- Icon badge: ছোট (44px) rounded-square container, accent tint
  ব্যাকগ্রাউন্ড, তার ভেতরে lucide icon
- Pill buttons: `borderRadius: 999px`, toggle-style (Mobile/Desktop
  টগল-এ যেমন আছে)

### ৬.২ কী দুর্বল — নির্দিষ্ট পর্যবেক্ষণ

- **Visual hierarchy সমতল** — Hero, stats, role card, mockup — সবকটা
  section প্রায় একই rhythm-এ (padding, card style) চলে, তাই চোখ কোথায়
  থামবে সেটা স্পষ্ট না। frontend-design নীতি অনুযায়ী: "spend your
  boldness in one place" — এখন কোনো single signature moment নেই যেটা
  পুরো পেজের মধ্যে সবচেয়ে বেশি মনোযোগ টানে।
- **কোনো real content preview নেই hero-তে** — hero শুধু heading +
  paragraph টেক্সট। ফ্যাকাল্টি ডেটা (৪৩৬+ প্রোফাইল, real department
  নাম), অথবা demo dashboard-এর একটা ঝলক হিরোতেই দেখানো গেলে "এটা কী"
  প্রশ্নের উত্তর স্ক্রল করার আগেই পাওয়া যেত।
- **সব role card visually সমান ওজনের** — Student/Faculty/Provider
  তিনটাই একই আকার, একই bullet count। বাস্তবে student audience-ই
  সংখ্যায় সবচেয়ে বড় (nav.js-এর feature সংখ্যাও সবচেয়ে বেশি,
  ৩৬+) — visual weight দিয়ে সেটা প্রতিফলিত করা যায় (বড় card, বা
  ডিফল্ট-selected state)।
- **Numbered structure নেই যেখানে দরকার** — "কীভাবে কাজ করে" section-এ
  ১/২/৩ নাম্বার আছে, যেটা সঠিক ব্যবহার (real sequence — sign up তারপর
  dashboard তারপর connect)। কিন্তু feature list-এ কোনো numbering নেই,
  ঠিকই আছে (এলোমেলো ক্রম, sequence না) — frontend-design নীতি অনুযায়ী
  এটা সঠিক সিদ্ধান্ত, feature list-এ নাম্বার বসানো ভুল হতো।
- **কোনো scroll-triggered reveal নেই** — পুরো পেজ static, একবারে সব
  দেখা যায়। Section বেশি হলে (৯টা প্রস্তাবিত section) কিছু motion
  (fade/slide-in on scroll) না থাকলে পেজ লম্বা, ক্লান্তিকর মনে হতে
  পারে।

### ৬.৩ প্রস্তাবিত ভিজ্যুয়াল দিকনির্দেশনা (owner confirm করার জন্য বিকল্পসহ)

**Typography fix (সবচেয়ে জরুরি, কম ঝুঁকির পরিবর্তন):**
Google Fonts import করার সিদ্ধান্ত (`questionbank.css`-এর মতো,
সম্ভবত `Hind Siliguri` জন্য + একটা display-weight Latin face) নাকি
"offline-first" নীতি বজায় রেখে system font-এ থাকা — এটা redesign
শুরুর আগে confirm করা দরকার, কারণ এটা পুরো টাইপোগ্রাফি সিদ্ধান্তের
ভিত্তি বদলে দেয়। যদি Google Fonts আনা হয়, landing page একাই আনবে
নাকি পুরো অ্যাপ-ব্যাপী (আরেকটা বড় সিদ্ধান্ত, এই redesign-এর scope-এর
বাইরে যেতে পারে)।

**Signature moment (frontend-design নীতির "spend your boldness in
one place"):**
তিনটা সম্ভাব্য দিক — চূড়ান্ত সিদ্ধান্ত owner-এর:
1. **Live-feeling hero preview** — hero section-এই একটা ছোট,
   non-interactive animated preview (যেমন attendance percentage বা
   notice ঘুরেফিরে বদলানো) — "এটা আসলে কী দেখতে" প্রশ্নের উত্তর
   scroll করার আগেই
2. **Role card-ভিত্তিক dynamic hero** — role card hover/select করলে
   পুরো page-এর accent gradient/mood হালকা বদলে যাওয়া (Student =
   সবুজ accent, Faculty = নীল accent2, Provider = অন্য কোনো tone) —
   ইতিমধ্যেই `--accent2` (নীল) ভেরিয়েবল আছে, ব্যবহারযোগ্য
3. **Stats-কে animate করে count-up করা** (৪৩৬+ সংখ্যাটা ০ থেকে scroll
   এ আসলে গুনে গুনে উঠবে) — ছোট কিন্তু লক্ষণীয় detail, অতিরিক্ত
   library ছাড়াই CSS/JS দিয়ে সম্ভব

**Section rhythm ভাঙা (সব section একই rhythm না রেখে):**
- Stats + How-it-works — হালকা, compact, background থেকে আলাদা না
  (এখন যেমন আছে)
- Feature breakdown (role অনুযায়ী, বড় section) — এখানে alternating
  background tint (`var(--surfaceGlassSoft)` ব্যবহার করে zebra-style
  section আলাদা করা) যোগ করলে লম্বা section-ও চোখে easier লাগবে
- Demo preview — এটাই বর্তমানে সবচেয়ে "concrete" section (real UI
  দেখাচ্ছে), তাই এটাকেই visual anchor রাখা উচিত — বাকি সব section
  এটার দিকে চোখ নিয়ে যাওয়ার কাজ করবে

**Motion (framer-motion না এনে, CSS-only path):**
`IntersectionObserver` দিয়ে একটা ছোট `useInView`-স্টাইল hook বানিয়ে,
section আসলে viewport-এ ঢুকলে একটা CSS class (`.reveal-visible`)
টগল করা — এটা কোনো নতুন dependency ছাড়াই "scroll-triggered reveal"
frontend-design নীতিটা satisfy করে। Hover micro-interaction
(button/card lift on hover) ইতিমধ্যেই আছে, feature breakdown card-এও
একই pattern বাড়ানো যায়।

**Feature breakdown-এর visual treatment (সেকশন ৫-এর ওপেন প্রশ্নের
সাথে যুক্ত):**
যদি owner "categorized, সংক্ষিপ্ত" পথ বেছে নেন (সেকশন ৬-এর নিচের
open question অনুযায়ী), তাহলে প্রতিটা category একটা
collapsible/accordion card হিসেবে দেখানো যায় — nav.js-এর নিজের
group/subgroup structure অনুসরণ করে (Academics → Daily Academics/
Academic Core; Campus Life → Campus Life/Services/Self Study) —
এতে app-এর ভেতরের নেভিগেশন mental model-এর সাথেও মিলবে, landing
page দেখেই কেউ পরে অ্যাপের ভেতরে গিয়ে হারিয়ে যাবে না।

**Accessibility/quality floor (frontend-design নীতির "quality floor
without announcing it"):**
- সব নতুন interactive element-এ visible keyboard focus state (এখন
  button-গুলোতে explicit `:focus-visible` style dedicated ভাবে
  দেখা যায়নি এই ফাইলে — নতুন section বানানোর সময় যোগ করা উচিত)
- `prefers-reduced-motion` respect করা (scroll-reveal/count-up
  animation-এ)
- Mobile-এ landing page ইতিমধ্যে আলাদা full-screen branch আছে
  (role select করলে) — নতুন section (stats/feature-breakdown/
  footer) সেই একই mobile branch-এর ভেতরেও ঠিকভাবে বসবে কিনা, নাকি
  landing page-এর মূল (role-select-পূর্ব) অংশেই শুধু থাকবে — এটা
  স্পষ্ট করা দরকার নতুন section লেখার সময়

---

## ৭. Hero / Entry-Point Deep Dive — ভিজিটর প্রথম যা দেখবে

এই সেকশনটা সরাসরি ইউজারের অনুরোধ অনুযায়ী — landing page-এ visitor
প্রথম scroll ছাড়াই যা দেখে (viewport-এর প্রথম fold), সেটাকেই "best"
বানানোর জন্য গভীর research। বাকি সব section (feature breakdown,
stats, policy) hero-এর *পরে* আসে — কিন্তু ভিজিটর ৩-৫ সেকেন্ডে hero
দেখেই ঠিক করে ফেলে থাকবে না চলে যাবে, তাই এইটাই সবচেয়ে বেশি weight
পাওয়ার যোগ্য অংশ।

### ৭.১ এখন hero-তে কী আছে (বেসলাইন)

শুধু texts — কোনো visual/interactive উপাদান নেই:
- H1: "The Digital Ecosystem for KUET"
- Subtitle: এক লাইনে Student/Faculty/Provider-এর কথা বলে, "ক্লিক করে
  দেখো" বলে scroll করতে উৎসাহ দেয়

Screenshot-এ (ইউজারের নিজের পাঠানো ছবি) দেখা গেছে hero-র ঠিক নিচে
role card, তারপর অনেকটা নিচে (scroll করে) demo mockup। **অর্থাৎ hero
থেকে আসল "product" (demo dashboard) দেখতে visitor-কে role card ক্লিক
করে + scroll করে যেতে হয় — hero নিজে কোনো প্রোডাক্ট-প্রুফ দেখায় না,
শুধু ঘোষণা করে।**

### ৭.২ কেন এটা দুর্বল entry point (নির্দিষ্ট কারণ, generic উপদেশ না)

- **"Digital Ecosystem" — বিমূর্ত শব্দ।** এটা কী করে সেটা বলে না,
  শুধু দাবি করে। একজন নতুন ভিজিটর (ধরা যাক ১ম বর্ষের KUET student,
  বন্ধুর পাঠানো লিংক থেকে এসেছে) ৩ সেকেন্ডে বুঝতে পারবে না এটা exact
  কী — routine app? social app? admin tool?
- **কোনো concrete proof নেই fold-এর ভেতরে।** ৪৩৬+ faculty, ৬,২৪৩+
  publication-এর মতো সংখ্যা (যেগুলো আসলে বিশ্বাসযোগ্যতা তৈরি করে)
  এখন hero-র *নিচে*, একটা আলাদা stats strip-এ — hero নিজে খালি হাতে।
- **role card নিজেই একটা siphon, hero-র অংশ না।** Visitor hero পড়ে,
  তারপর card দেখে, তারপর card-এ ক্লিক করে, *তারপরই* আসল app-এর
  ঝলক (mockup) পায়। এই chain-এ প্রতিটা ধাপে কিছু মানুষ ঝরে পড়ে
  (drop-off) — hero-তেই যদি একটা ছোট real ঝলক থাকত, click-before-you-
  see বাধাটা কমত।
- **Personalization নেই fold-এর ভেতরে।** "Student, Faculty, আর
  Service Provider" — সবাইকে একসাথে সম্বোধন করা মানে কাউকেই সরাসরি
  সম্বোধন করা হয় না। বাস্তবে এই সাইটের সিংহভাগ visitor probably
  student (nav.js-এর ফিচার সংখ্যাও (৩৬+) student-এর জন্যই সবচেয়ে
  বেশি বলে সেটাই ইঙ্গিত দেয়)।

### ৭.৩ Entry-point দিকনির্দেশনা — বিকল্প approach (owner বাছবেন)

**Option A — "Proof-first" hero (ডেটা দিয়ে বিশ্বাসযোগ্যতা প্রথমেই)**
Hero-র ভেতরেই stats strip নিয়ে আসা (এখন যেটা আলাদা section, নিচে
আছে) — heading-এর ঠিক পাশে বা নিচে, scroll ছাড়াই "৪৩৬+ শিক্ষক, ৬,২৪৩+
পাবলিকেশন, ২৩ ডিপার্টমেন্ট" দেখা যাবে। যুক্তি: এই সংখ্যাগুলো verified,
real, এবং তাৎক্ষণিক বিশ্বাসযোগ্যতা দেয় — "এটা একটা টয় প্রজেক্ট না,
আসলেই পুরো KUET-এর ডেটা এখানে আছে" বার্তাটা এক নজরেই পৌঁছায়।
- সুবিধা: কম ঝুঁকির পরিবর্তন, কোনো নতুন asset/animation লাগবে না,
  ইতিমধ্যেই বানানো stats data ব্যবহার করে
- সীমাবদ্ধতা: এখনো "দেখো, কাজ করে" প্রমাণ করে না — শুধু "ডেটা আছে"
  প্রমাণ করে

**Option B — "Live glimpse" hero (real UI-এর ছোট ঝলক, fold-এর ভেতরেই)**
`demoWorld.js`-এর real demo data (যেমন attendance percentage, বা
একটা notice card — "Midterm syllabus confirmed", "Lab report deadline
extended" — এই দুটো ইতিমধ্যেই কোডে বিদ্যমান, বানাতে হবে না) থেকে
একটা ছোট, non-interactive card hero-র পাশে/নিচে দেখানো — role select
করার আগেই। যুক্তি: "দেখো, ঠিক এরকম দেখতে" — বিমূর্ত claim-এর বদলে
concrete visual proof, scroll/click ছাড়াই।
- সুবিধা: সবচেয়ে শক্তিশালী "এটা আসলে কী" উত্তর, ভিজিটরকে scroll
  করতে বাধ্য করে না
- সীমাবদ্ধতা: hero-তে "sample data" স্পষ্ট করে বলতে হবে (আগে যোগ করা
  DemoDataNotice-এর মতোই) — নাহলে বিভ্রান্তি (ইউজারের আগের কনসার্ন,
  mockup বনাম real data)। বেশি জায়গা নেয়, hero heavier হয়ে যায়।

**Option C — "Role-first" hero (personalization আগে, প্রমাণ পরে)**
Hero heading-এই "তুমি কে?" প্রশ্ন সরাসরি প্রথমে জিজ্ঞাসা করা (এখনকার
subtitle-এর "তিন role-ই দেখো" বার্তার বদলে) — role card তিনটাকে
hero-র *ভেতরেই* নিয়ে আসা, আলাদা section না বানিয়ে। যুক্তি: একজন
student ভিজিটর "Student" শব্দ/আইকন হেরোতেই দেখলে সাথে সাথে নিজের
জন্য প্রাসঙ্গিক মনে করবে, বিমূর্ত "Ecosystem" শব্দের চেয়ে দ্রুত।
- সুবিধা: personalization দ্রুততম, কম abstract
- সীমাবদ্ধতা: role card তো এমনিতেই hero-র ঠিক নিচে আছে — এই
  পরিবর্তন মূলত visual/layout একত্রীকরণ, নতুন তথ্য যোগ করে না

**সুপারিশ (গবেষণার ভিত্তিতে, তবে চূড়ান্ত সিদ্ধান্ত owner-এর):**
Option A + C মেশানো — সবচেয়ে কম ঝুঁকি, সবচেয়ে বেশি তথ্য fold-এর
ভেতরে আনে, আর কোনো নতুন heavy asset/animation লাগে না। Option B
(live glimpse) সবচেয়ে শক্তিশালী কিন্তু সবচেয়ে বেশি কাজ ও ঝুঁকি
(বিভ্রান্তির সম্ভাবনা) — এটা একটা *পরবর্তী* iteration হিসেবে রাখা
যায়, প্রথম redesign pass-এ না।

### ৭.৪ Copy — hero-র exact শব্দ নিয়ে (frontend-design নীতি: "words are design material")

"The Digital Ecosystem for KUET" — এই heading রাখা বা বদলানো নিয়ে
বিবেচ্য পয়েন্ট (সিদ্ধান্ত না, শুধু trade-off):
- রাখার পক্ষে: এটা এখন brand-এর সাথে যুক্ত হয়ে গেছে (page title,
  meta description, About page — সব জায়গায় এই একই ভাষা ব্যবহৃত,
  `usePageMeta` কলে দেখা গেছে), বদলালে ধারাবাহিকতা ভাঙে
- বদলানোর পক্ষে: frontend-design নীতি অনুযায়ী "name things by what
  people control and recognize" — "Ecosystem" শব্দটা system-এর
  ভাষা, ব্যবহারকারীর ভাষা না। একজন student "আমি routine, marks,
  notice সব একসাথে পাব" শুনলে বেশি concrete বুঝবে "Digital Ecosystem"
  শোনার চেয়ে।
- মাঝামাঝি পথ: heading রেখে, subtitle-টা concrete করা — এখনকার
  "তিন role-ই একটা কার্ডে ক্লিক করে দেখো" (যেটা কী পাবে তা বলে না,
  শুধু action বলে) বদলে "রুটিন, উপস্থিতি, মার্কস, নোটিশ, প্রশ্ন
  ব্যাংক — সব এক জায়গায়" জাতীয় concrete-ফিচার-ভিত্তিক subtitle
  (এটা আসলে `usePageMeta`-র meta description-এ প্রায় এই ভাষাতেই
  ইতিমধ্যে লেখা আছে — subtitle-এ সেটার সংক্ষিপ্ত রূপ আনাই যুক্তিসঙ্গত,
  নতুন copy বানানো লাগবে না)

---

## ৮. এখনো যা confirm করা বাকি (কোডিং সেশনের আগে owner-কে জিজ্ঞাসা করার মতো প্রশ্ন)

- Section ৫-এর role feature breakdown কি **সব ৩৬+ item** verbatim
  দেখাবে, নাকি ক্যাটাগরি-লেভেলে সংক্ষিপ্ত করে ("Academics: ৮টা টুল
  — Attendance, Marks, Question Bank...") রাখবে?
- Footer-এ Founder-এর ব্যক্তিগত ইমেইল/WhatsApp পাবলিক landing
  page-এ রাখতে চান, নাকি generic contact form/link?
- "কেন KUETx?" section-এর exact ৩-৪টা value-prop লাইন — নতুন করে
  লেখা হবে, নাকি policy-এর ভাষা প্রায় হুবহু রাখা হবে?
- Stats strip-এ চতুর্থ সংখ্যা (feature/route count) যোগ করা হবে
  কিনা, আর সেটার সঠিক সংজ্ঞা কী হবে ("৩৬+ ফিচার" বলাটা কি ঠিক
  representative, নাকি বিভ্রান্তিকর যেহেতু কিছু route sub-page/
  detail view মাত্র)?
- **Typography:** Google Fonts import করে Hind Siliguri/একটা display
  face আনা হবে, নাকি বর্তমান "no external font, offline-first" নীতি
  বজায় থাকবে? এই সিদ্ধান্ত পুরো visual direction-এর ভিত্তি, তাই
  কোডিং শুরুর আগেই লাগবে।
- **Signature moment:** ৬.৩-এ প্রস্তাবিত তিনটা দিক (animated hero
  preview / role-ভিত্তিক dynamic accent / stats count-up animation)
  — একটা, একাধিক, নাকি সম্পূর্ণ ভিন্ন কোনো আইডিয়া owner-এর পছন্দ?
- **Motion library:** framer-motion নতুন dependency হিসেবে যোগ করা
  ঠিক আছে, নাকি CSS-only/IntersectionObserver পথে থাকতে হবে?

---

## ৯. Auth ফ্লো redesign — Sign In vs Sign Up আলাদা করা

**(owner-এর explicit priority — "onek important, onek beshi")। এই
সেকশনটা landing page-এর visual redesign-এর সাথে সরাসরি জড়িত কারণ
Navbar/Hero-এর CTA বাটনগুলো (এখন শুধু একটা "Sign In") এই নতুন ফ্লো
অনুযায়ী বদলাবে।**

### ৯.১ এখন আসলে কী আছে (কোড থেকে যাচাই করা, অনুমান না)

`AuthModal.jsx`-এর মাথায় নিজেই লেখা আছে — এটা Auth Simplification
migration-এর ফল, যেখানে email/username/phone-password সব সরিয়ে
**শুধু Google Sign-In** রাখা হয়েছে। ফলে বর্তমানে:

- **Sign In আর Sign Up শব্দগত ভাবেই আলাদা নেই** — `AuthModal`-এর
  `mode` prop এখনো আছে ("backward compatibility"-র জন্য) কিন্তু
  কিছুই বদলায় না। একটাই বাটন: "Google দিয়ে সাইন ইন করুন" — নতুন
  আর পুরনো ইউজার একই বাটনে যায়।
- **Info/profile ফর্ম account তৈরির পরে আসে** — flow টা এখন:
  `AuthModal` (Google popup, কোনো তথ্য নেয় না) → `RoleSelectScreen`
  (Student/Faculty/Provider বাছাই + Provider হলে name/phone/
  serviceType/location) → `ProfileSetupModal` (roll, batch, hall,
  blood group ইত্যাদি বিস্তারিত তথ্য) — এই পুরো সিকোয়েন্স
  `App.jsx`-এর `buildQueue()`-এ hardcoded (`q.push('auth')` →
  `q.push('role-select')` → `q.push('profile')`), অ্যাকাউন্ট
  ইতিমধ্যে বানানো হয়ে যাওয়ার **পরে**।
- এটা owner-এর অভিযোগ অনুযায়ী ideal না — একজন existing user Sign In
  করতে গেলেও (ভুলবশত বা প্রথমবার) এই একই পপআপে পড়ে, আর নতুন ইউজার
  পুরো ফর্ম পূরণ করার আগেই একটা অসম্পূর্ণ Google অ্যাকাউন্ট তৈরি হয়ে
  যায় — যেটা পরে user "wrong account" চাইলে মুছে ফেলতে হয়
  (`RoleSelectScreen.jsx`-এর `wrongAccount()` / `deleteMyAccount()`
  — এটা আসলে বর্তমান ডিজাইনের এই দুর্বলতারই একটা প্যাচ/escape-hatch)।

### ৯.২ টেকনিক্যাল ভিত্তি — Firebase কীভাবে নতুন vs পুরনো ইউজার আলাদা করে

রিসার্চ অনুযায়ী (Firebase অফিসিয়াল docs + কমিউনিটি প্যাটার্ন):
Firebase-এর `signInWithPopup()`/`signInWithRedirect()` নিজে থেকে Sign
In আর Sign Up-কে আলাদা এন্ডপয়েন্ট হিসেবে দেয় না — popup-এ ক্লিক করার
আগে জানার কোনো উপায় নেই যে এই Google অ্যাকাউন্টটা আগে থেকেই আছে কিনা।
কিন্তু popup **resolve হওয়ার পরে**, result থেকে এটা নির্ভুলভাবে জানা
যায়:

```js
import { getAdditionalUserInfo } from 'firebase/auth';
const result = await signInWithPopup(auth, googleProvider);
const isNewUser = getAdditionalUserInfo(result)?.isNewUser; // true | false
```

`isNewUser` সঠিকভাবে বলে দেয় এই Google অ্যাকাউন্ট দিয়ে Firebase-এ
এই প্রথম sign-in নাকি আগে থেকেই সেই uid-তে অ্যাকাউন্ট ছিল। এটাই এই
পুরো নতুন ফ্লোর কারিগরি ভিত্তি — `firebaseAuth.js`-এর
`loginWithGoogle()`/`upgradeWithGoogle()` দুটোতেই এই চেক যোগ করতে
হবে।

### ৯.৩ প্রস্তাবিত নতুন ফ্লো

**দুটো আলাদা entry point — Navbar/Hero-তে "Sign In" আর "Sign Up"
আলাদা বাটন হিসেবে থাকবে (এখন যেমন একটাই "Sign In" আছে)।**

**Sign In (Login) — existing user, দ্রুততম পথ:**
1. "Sign In" ক্লিক
2. সরাসরি Google popup খোলে (কোনো ফর্ম নেই, কোনো বাধা নেই)
3. popup resolve হলে `isNewUser` চেক হয়:
   - `false` (স্বাভাবিক কেস) → dashboard-এ direct চলে যায়, `role-select`/
     `profile` queue skip (এই অ্যাকাউন্টের এগুলো আগে থেকেই করা আছে)
   - `true` (মানে Google অ্যাকাউন্টটা KUETx-এ নতুন, কিন্তু user ভুলে
     "Sign In" চেপেছে) → সাথে সাথে সেই আধা-তৈরি অ্যাকাউন্ট delete +
     sign-out (ঠিক `RoleSelectScreen.jsx`-এর `wrongAccount()`/
     `deleteMyAccount()` যে প্যাটার্ন এখন ব্যবহার করছে, একই যুক্তি) —
     আর একটা friendly message: "এই Google অ্যাকাউন্ট দিয়ে KUETx-এ
     এখনো অ্যাকাউন্ট নেই। আগে Sign Up করুন।" সাথে Sign Up-এ পাঠানোর
     বাটন।

**Sign Up (Register) — new user, ধাপে ধাপে info আগে, Google শেষে:**
1. "Sign Up" ক্লিক → **Google popup তখনই খোলে না** — বরং একটা
   multi-step form শুরু হয়:
   - **ধাপ ১: Role বাছাই** (Student / Faculty / Provider) — এটাই
     owner confirm করেছে যে **form-এর প্রথম ধাপ হিসেবে** থাকবে (আলাদা
     pre-form screen না) — কার্যত এখনকার `RoleSelectScreen.jsx`-এর
     UI/লজিক প্রায় হুবহু re-use হবে, শুধু এটা এখন *আগে* চলে আসছে।
   - **ধাপ ২: Role-অনুযায়ী profile info** — Student হলে
     `ProfileSetupModal.jsx`-এর ফিল্ডগুলো (roll, batch/term, hall,
     blood group ইত্যাদি), Faculty হলে
     `FacultyProfileSetupModal.jsx`-এর ফিল্ডগুলো, Provider হলে
     এখনকার `RoleSelectScreen.jsx`-এর provider-form ধাপে যা আছে
     (name, phone, serviceType, location) — এই তিনটা কম্পোনেন্টের
     ফর্ম-লজিক অলরেডি existing, শুধু trigger হওয়ার timing বদলাবে
     (account তৈরির আগে, local state-এ, Firestore-এ কিছু লেখা হবে
     না যতক্ষণ না uid থাকে)।
   - **ধাপ ৩ (শেষ ধাপ): "Sign Up with Google" বাটন** — এতক্ষণ যা
     ফিল করা হয়েছে সব local state/form data-তে জমা থাকবে, এই বাটনে
     ক্লিক করলেই Google popup খোলে।
2. popup resolve হলে `isNewUser` চেক:
   - `true` (স্বাভাবিক কেস, নতুন অ্যাকাউন্ট) → uid পাওয়ার সাথে সাথে
     আগে থেকে local-এ জমা রাখা role + profile data **একসাথে/atomic-
     ভাবে** Firestore-এ লেখা হবে (`users/{uid}`, role-অনুযায়ী
     `faculty/{uid}` বা provider shell ইত্যাদি) — `role-select`/
     `profile` queue step-দুটো তখন আর দরকার নেই কারণ সব তথ্য
     ইতিমধ্যে হাতে আছে, সরাসরি dashboard-এ চলে যাবে।
   - `false` (user আগে থেকেই আছে, কিন্তু ভুলে Sign Up চেপেছে) →
     এবার account delete করার দরকার নেই যেহেতু এটা তার নিজের existing
     অ্যাকাউন্ট — বরং শুধু sign-in সম্পন্ন করে dashboard-এ পাঠানো, সাথে
     একটা non-blocking notice: "আপনার তো আগে থেকেই একটা KUETx
     অ্যাকাউন্ট আছে — সেটাতেই সাইন ইন করা হলো।" (এতে ভরা ফর্ম ডেটা
     ফেলে দেওয়া হবে, existing অ্যাকাউন্টের পুরনো ডেটা ওভাররাইট করা
     হবে না)।

### ৯.৪ ইমপ্লিমেন্টেশন নোট (কোডিং সেশনের জন্য)

- `firebaseAuth.js`: `loginWithGoogle()` আর `upgradeWithGoogle()`
  (এবং redirect fallback path — `handleGoogleRedirectResult()`)
  প্রতিটাতে `getAdditionalUserInfo(result).isNewUser` রিটার্ন করতে
  হবে, শুধু `user` না — কলার-দের এই ফ্ল্যাগ অনুযায়ী branch করতে হবে।
- `AuthModal.jsx`-এর `mode` prop এখন সত্যিকারের অর্থ ফিরে পাবে —
  `'login'` বনাম `'signup'` দুটো সত্যিই আলাদা UI/flow রেন্ডার করবে,
  এখনকার মতো no-op থাকবে না।
- নতুন multi-step Sign Up ফ্লোর local state (role + profile ফর্ম
  ডেটা, uid তৈরি হওয়ার আগে) — role-অনুযায়ী `RoleSelectScreen.jsx`,
  `ProfileSetupModal.jsx`, `FacultyProfileSetupModal.jsx`-এর বিদ্যমান
  ফর্ম-কম্পোনেন্ট/ফিল্ড লজিক re-use করা, কিন্তু Firestore write বাদ
  দিয়ে শুধু local state ধরে রাখা — শেষ ধাপে uid পাওয়ার পর একসাথে
  commit করা হবে।
- `App.jsx`-এর `buildQueue()`: নতুন Sign Up ফ্লো দিয়ে আসা অ্যাকাউন্টের
  জন্য `role-select`/`profile` queue step আর লাগবে না (কারণ সেগুলো
  account তৈরির আগেই সম্পন্ন) — কিন্তু পুরনো/অসম্পূর্ণ অ্যাকাউন্ট
  (মাঝপথে ফেলে যাওয়া) এখনো এই queue দিয়ে resume করতে পারবে, তাই
  পুরনো লজিক পুরোপুরি ফেলে দেওয়া যাবে না, শুধু নতুন ফ্লোর জন্য
  bypass যোগ করতে হবে।
- Navbar/Hero CTA: এখনকার একটামাত্র "Sign In" বাটনের জায়গায়
  landing page redesign-এ দুইটা আলাদা বাটন/CTA (Sign In / Sign Up)
  ডিজাইন করতে হবে — এটা landing page redesign-এর visual scope-এর
  ভেতরেই পড়ে, তাই section ২/৩ (Navbar design)-এর সাথে সমন্বয় করে
  করা উচিত।
- Anonymous/guest-mode আপগ্রেড পথ (`upgradeWithGoogle`, queueMode)
  এই নতুন Sign In/Sign Up বিভাজনের সাথে conflict করে কিনা — guest
  থেকে সরাসরি "সেভ করুন" চাপলে সেটা কার্যত Sign Up (নতুন অ্যাকাউন্ট
  তৈরি + local anonymous data link), তাই সেটাও Sign Up-এর মতো আগে
  profile info নেবে, নাকি guest-এর ক্ষেত্রে ব্যতিক্রম থাকবে — এটা
  owner confirm করার একটা প্রশ্ন (নিচে ১০ নম্বরে যোগ করা হলো)।

---

## ১১. Auth ফ্লো — UI/visual/mockup redesign (mobile + desktop, ডিটেইলড)

**(owner-এর দ্বিতীয় দফা priority — "onek beshi kaj korte hobe", "kono kichu bad rakhio na")। Section ৯ শুধু ফ্লো-লজিক ঠিক করেছে, এই সেকশন সেই ফ্লো-টা landing page-এ visually কোথায় কীভাবে বসবে, mobile আর desktop-এ কী আলাদা, আর mockup/preview interaction কীভাবে কাজ করবে — সেটা কভার করে।**

### ১১.১ Navbar entry point — Sign In vs Sign Up বাটন

এখন landing page-এর navbar-এ (desktop আর mobile দুটোতেই) একটামাত্র
"Sign In" বাটন আছে (`LogIn` icon + লেবেল, desktop-এ; icon-only, mobile
full-screen role-view-এর sticky bar-এ)। নতুন ডিজাইনে:

- **Desktop navbar:** দুটো বাটন পাশাপাশি — "Sign In" (quiet/secondary
  style — border শুধু, fill না, কারণ এটা দ্রুত/low-commitment action)
  আর "Sign Up" (primary/accent-filled style — এটাই মূল conversion CTA,
  landing page-এর প্রধান লক্ষ্য visitor-কে account বানানো)। Sign Up
  বাটন visually বেশি ভারী হবে (accent fill), Sign In হালকা (শুধু
  বর্ডার) — কারণ বেশিরভাগ landing-page visitor নতুন, existing user
  কম।
- **Mobile navbar (compact, icon-only):** দুটো ছোট icon বাটন পাশাপাশি
  — Sign In-এর জন্য `LogIn`/login আইকন (quiet/bordered), Sign Up-এর
  জন্য `UserPlus` আইকন (accent-filled) — ৩৪×৩৪px, একই সাইজ যেমন
  এখনকার একক Sign In বাটন আছে, শুধু দুটো পাশাপাশি (একসাথে
  ~৭৬px প্রস্থ নেবে, sticky bar-এর ডান পাশে জায়গা করে নিতে হবে —
  role-chip strip-টা প্রয়োজনে একটু সংকুচিত হতে পারে)।
- মোবাইলে যেহেতু জায়গা কম, "Sign In / Sign Up" আলাদা label লেখার
  বদলে শুধু icon + `aria-label` — ঠিক এখনকার single Sign In icon
  বাটনের প্যাটার্ন অনুসরণ করে, দ্বিগুণ করে।
- `SignInPrompt.jsx`-এর ভেতরের "Sign In / Sign Up" (একটাই বাটন, দুটো
  শব্দ) বাটনটাও এখন সত্যিকারের দুটো আলাদা বাটনে ভাগ হবে (একই compact
  modal-এর ভেতরে দুটো অপশন), কারণ এই প্রম্পটটা "কেন সাইন-ইন লাগবে"
  বলার পরে visitor-কে choice দেওয়ার জায়গা — এখানেই প্রথমবার জিজ্ঞেস
  করা উচিত "আগে থেকে অ্যাকাউন্ট আছে, নাকি নতুন বানাবে?"

### ১১.২ Sign In — কোনো নতুন UI স্ক্রিন লাগে না

Sign In flow বর্তমান `AuthModal`-এর মতোই simple/single-screen থাকবে —
শুধু ভেতরের বাটনের label আর behavior বদলাবে ("Google দিয়ে সাইন ইন
করুন" থেকে exact same UI, কিন্তু এখন এটা truly login-only, no `mode`
no-op)। `isNewUser: true` বেরোলে এই একই modal-এর ভেতরেই একটা inline
error/notice card দেখাবে (নতুন popup/screen লাগবে না) — লাল/warning
tint background, "এই Google অ্যাকাউন্ট দিয়ে KUETx-এ এখনো অ্যাকাউন্ট
নেই" মেসেজ, আর একটা বাটন "Sign Up শুরু করুন" যেটা সরাসরি Sign Up
wizard-এর প্রথম ধাপে (role select) নিয়ে যাবে — Google popup আবার
দেখাতে হবে না যেহেতু এই মুহূর্তে uid ইতিমধ্যে হাতে আছে, শুধু বাকি
profile info নিতে হবে (এইটা Section ১০-এর তৃতীয় open question-এর
উত্তর — Google popup আবার না দেখানোই ভালো UX, তাই account delete না
করে সরাসরি remaining Sign Up steps-এ চালান করা)।

### ১১.৩ Sign Up — নতুন multi-step wizard (মূল visual কাজ)

এটাই সবচেয়ে বড় নতুন UI piece। এখনকার `RoleSelectScreen.jsx` (role
card গ্রিড) আর `ProfileSetupModal.jsx`/`FacultyProfileSetupModal.jsx`
(ফর্ম ফিল্ড)-এর ভিজ্যুয়াল ভাষা প্রায় হুবহু re-use হবে (card style,
field style, color token — সবই ইতিমধ্যে ভালোভাবে বানানো আছে), কিন্তু
এখন এই তিনটা একটা একক **multi-step wizard**-এর ভেতরে চেইন হবে,
progress indicator সহ।

**সাধারণ wizard কাঠামো (mobile আর desktop দুটোতেই একই ৩-ধাপ লজিক,
শুধু layout আলাদা):**
- ধাপ ১ — Role select (Student/Faculty/Provider card, এখনকার
  `RoleSelectScreen`-এর card style প্রায় হুবহু)
- ধাপ ২ — Role-অনুযায়ী profile ফর্ম (Student → `ProfileSetupModal`-এর
  ফিল্ড; Faculty → `FacultyProfileSetupModal`-এর ফিল্ড; Provider →
  বর্তমান `RoleSelectScreen`-এর provider-form ধাপের ফিল্ড)
- ধাপ ৩ — Confirm/Summary + "Sign Up with Google" বাটন (নতুন স্ক্রিন,
  এখন কোথাও নেই — নিচে ১১.৩.৩-এ বিস্তারিত)

**১১.৩.১ Mobile layout (viewport < 768px, `isMobileNav` অনুযায়ী):**
- **পুরো স্ক্রিন জুড়ে** (full-screen modal/route, এখনকার mobile
  role-view-এর মতোই — landing page-এর বাকি অংশ দেখা যাবে না যতক্ষণ
  wizard চলছে) — ছোট স্ক্রিনে একটা modal-এর ভেতরে modal রাখলে
  claustrophobic লাগে।
- **উপরে sticky header:** বাম দিকে back arrow (আগের ধাপে ফেরত, ধাপ ১
  থেকে "back" করলে wizard বন্ধ হয়ে landing page-এ ফিরে যাবে), মাঝে
  progress dots (৩টা ছোট pill, active ধাপ accent-filled, বাকিগুলো
  muted border — সংখ্যা না, শুধু dots, কারণ owner-এর role-select
  আলাদা pre-form screen না চাওয়ায় এই ৩ ধাপ এখন একটাই continuous flow,
  আর dots সেটাই বোঝায় ভালো, বড় "১/৩" টেক্সট-এর চেয়ে হালকা), ডানে
  ফাঁকা জায়গা (balance-এর জন্য)।
- **এক কলাম ফর্ম:** role card-গুলো stacked vertically (grid না, এক
  কলাম লিস্ট) — টাচ টার্গেট বড় রাখার জন্য, এখনকার
  `RoleSelectScreen`-এর ৩-কলাম গ্রিড মোবাইলে wrap হয়ে যেত, এখানে সরাসরি
  stacked।
- **নিচে sticky footer bar:** "Continue" বাটন (full-width, accent
  fill) — কীবোর্ড খোলা অবস্থায়ও (profile ফর্মে টাইপ করার সময়) এই বাটন
  দেখা যাবে/reachable থাকবে।
- Confirm ধাপে (ধাপ ৩) sticky footer-এর বাটনটাই "Sign Up with Google"
  হয়ে যাবে (icon সহ)।

**১১.৩.২ Desktop layout (viewport ≥ 768px):**
- **Centered card/modal** (এখনকার `AuthModal`/`RoleSelectScreen`-এর
  মতো — পুরো ভিউপোর্ট জুড়ে না, একটা max-width ~৪৬০-৫২০px card,
  background-এ landing page dimmed/blurred দেখা যাবে) — desktop-এ
  পর্যাপ্ত জায়গা আছে তাই full-screen takeover দরকার নেই।
  **BUGFIX note reference:** `RoleSelectScreen.jsx`-এ আগে একটা bugfix
  হয়েছিল যেখানে translucent overlay-এর বদলে fully opaque background
  করা হয়েছিল (dashboard leak এড়াতে) — landing page-এর প্রেক্ষিতে
  এখানে সমস্যা নেই কারণ পেছনে dashboard না, শুধু public landing page,
  তাই dimmed/blurred backdrop স্বাভাবিক থাকবে, একদম কালো/opaque করার
  দরকার নেই।
- **উপরে horizontal step label bar** — "১ Role · ২ Details · ৩
  Confirm" পাশাপাশি, active ধাপ accent রঙে বাকিগুলো muted (dots না,
  কারণ desktop-এ label লেখার জায়গা আছে, আর এটা বেশি informative)।
- **Role card গ্রিড** — এখনকার মতোই ৩-কলাম গ্রিড (`repeat(3, 1fr)`,
  card হভার effect সহ)।
- **নিচে ডান-align করা "Continue"** বাটন (card-এর ফুটারে, পুরো width
  না নিয়ে শুধু ডান পাশে — desktop convention অনুযায়ী)।
- Confirm ধাপে একই জায়গায় "Sign Up with Google" বাটন বসবে।

**১১.৩.৩ ধাপ ৩ — Confirm/Summary স্ক্রিন (নতুন, mobile+desktop একই
কনটেন্ট, শুধু width আলাদা):**
এটা এখন কোথাও নেই — নতুন বানাতে হবে। এতক্ষণ যা ফিল করা হয়েছে তার একটা
ছোট সারাংশ কার্ড (নাম যদি থাকে/roll/dept ইত্যাদি role-অনুযায়ী ২-৩টা
key fact), তারপর "Sign Up with Google" বাটন। উদ্দেশ্য: visitor যেন
popup-এ ক্লিক করার আগে একবার confirm করতে পারে যে সব ঠিকভাবে দিয়েছে
— Google popup-এর পরে আর ফেরত এসে ফর্ম এডিট করার সুযোগ থাকবে না (uid
তৈরি হয়ে যাওয়ার পরে সরাসরি dashboard), তাই এই শেষ ধাপটাই একমাত্র
"double-check" মোমেন্ট।

### ১১.৪ Mockup/preview section-এর সাথে সমন্বয় (owner-এর "eta niyeo ki
korbe" প্রশ্নের জবাব)

Landing page-এর role-card ক্লিক করলে যে demo dashboard mockup
(`MockupFrame`, phone/desktop টগল) দেখানো হয় — সেটা এই নতুন auth
ফ্লো থেকে **স্বতন্ত্র** থাকবে, কনফিউজ করা যাবে না দুটো জিনিস:
- **Demo mockup** (role card ক্লিক) = read-only preview, sample data,
  কোনো commitment নেই, এখনকার মতোই থাকবে।
- **Sign Up wizard** (navbar-এর Sign Up বাটন) = আসল account তৈরির
  ফ্লো, উপরে ১১.৩-এ বর্ণিত।

তবে একটা connection পয়েন্ট: demo mockup-এর ভেতরে `DemoDataNotice`
("এটা sample demo data... Sign In করুন")-তে এখন থেকে "Sign In করুন"
কথাটা "Sign In অথবা Sign Up করুন" হবে, এবং mockup দেখার পরে visitor
যদি convinced হয় ("এই role-টাই আমার লাগবে"), সেই role pre-select
হয়ে wizard-এর ধাপ ১-এ নিয়ে যাওয়া যায় (query param `?role=student`
থেকে wizard-এর ধাপ ১-এর card auto-select করে দেওয়া) — যাতে demo
mockup দেখে সিদ্ধান্ত নেওয়া visitor-কে আবার নতুন করে role বাছাই না
করতে হয়। এটা landing page-এর role-card selection state
(`selectedRole` in `LandingPage.jsx`) আর wizard-এর প্রথম ধাপের মধ্যে
একটা হালকা data-passing হবে (URL param বা component state via prop),
নতুন কোনো জটিল persistence লাগবে না।

### ১১.৫ Component-mapping সারাংশ (কোডিং সেশনের জন্য quick reference)

| এখনকার কম্পোনেন্ট | নতুন role wizard-এ কী হবে |
|---|---|
| `AuthModal.jsx` | Sign In-এর জন্য অপরিবর্তিত (mode সত্যিকারের অর্থ ফিরে পায়) |
| `RoleSelectScreen.jsx`-এর role card গ্রিড | Wizard ধাপ ১ (visual প্রায় হুবহু re-use) |
| `RoleSelectScreen.jsx`-এর provider-form ধাপ | Wizard ধাপ ২ (provider role হলে) |
| `ProfileSetupModal.jsx` | Wizard ধাপ ২ (student role হলে) |
| `FacultyProfileSetupModal.jsx` | Wizard ধাপ ২ (faculty role হলে) |
| — (নতুন) | Wizard ধাপ ৩ — Confirm/Summary + Google বাটন |
| `SignInPrompt.jsx` | দুটো আলাদা বাটনে ভাগ (Sign In / Sign Up), single "Sign In / Sign Up" বাটনের বদলে |
| `LandingPage.jsx`-এর navbar | দুটো বাটন (desktop: label+style ভিন্ন; mobile: দুটো icon বাটন) |

### ১১.৬ owner-এর "first impression matters" নোট — কেন এই ডিজাইন
সেটা সম্মান করে

- Sign In দ্রুত/friction-less থাকছে (existing user-দের জন্য এক-ক্লিকে
  dashboard) — প্রথম ইম্প্রেশনে বিরক্ত করা হচ্ছে না তাদের যারা আগে
  থেকেই convinced।
- Sign Up-এ Google popup **সবার শেষে** আসায় visitor আগে দেখে নিতে
  পারে ঠিক কী কী তথ্য দিচ্ছে, কোনো আধা-অসম্পূর্ণ Google অ্যাকাউন্ট
  তৈরি হয় না মাঝপথে ছেড়ে দিলে (ব্রাউজার বন্ধ করলে কোনো account-ই
  তৈরি হয়নি, শুধু local state হারায়) — এটা এখনকার সমস্যার (ভুল
  account/অসম্পূর্ণ account delete করা লাগে) মূল কারণটাই দূর করে
  দেয়।
- Progress indicator (dots/labels) থাকায় visitor জানে কতদূর বাকি —
  কোনো "কতক্ষণ লাগবে" অনিশ্চয়তা নেই, যেটা প্রথমবার সাইন আপ করা কারো
  জন্য গুরুত্বপূর্ণ প্রথম ইম্প্রেশন ফ্যাক্টর।

---

## ১২. Section ১০ (আগের owner-confirm প্রশ্ন) থেকে যা confirm হয়েছে

- Role select কখন হবে — **form-এর মধ্যেই একটা ধাপ হিসেবে** (owner
  কনফার্ম করেছে) — এটাই Section ১১.৩-এ wizard ধাপ ১ হিসেবে প্ল্যান
  করা হয়েছে।

## ১৩. এখনো বাকি owner-confirm প্রশ্ন (Section ১০ থেকে অবশিষ্ট + নতুন)

- Guest/anonymous মোড থেকে "অ্যাকাউন্ট সেভ করুন" (upgrade) ফ্লো কি
  নতুন Sign Up-এর মতোই আগে profile info নেবে, নাকি guest-এর ইতিমধ্যে
  local ডেটা থাকায় এটা একটা আলাদা/ছোট ফ্লো থাকবে?
- Sign Up ফ্লোতে কেউ শেষ ধাপ (Google popup) পর্যন্ত না গিয়ে মাঝপথে
  ব্রাউজার বন্ধ করলে — সেই ফিল করা form data (role, profile) কি কোনো
  ভাবে সংরক্ষণ হবে (যেমন localStorage draft), নাকি প্রতিবার নতুন করে
  শুরু করতে হবে?
- ~~Sign In চেপে isNewUser: true বেরোলে অ্যাকাউন্ট delete করা হবে
  কিনা~~ — **সমাধান হয়েছে (§১১.২):** delete করা হবে না, বরং
  already-authenticated অবস্থায় সরাসরি Sign Up wizard-এর বাকি ধাপে
  (role+profile) চালান করা হবে, দ্বিতীয়বার Google popup ছাড়াই।
- **নতুন (visual):** Wizard-এর ধাপ ৩ (Confirm/Summary)-এ role-অনুযায়ী
  কোন ২-৩টা key fact দেখানো হবে তা নির্দিষ্ট করা দরকার — Student-এর
  জন্য roll/dept/session যথেষ্ট, নাকি hall/blood group-ও দেখাবে?
  Provider-এর জন্য business name/service type/location দেখাবে?
- **নতুন (visual):** Progress indicator-এ dots (mobile) বনাম labels
  (desktop) আলাদা প্যাটার্ন প্রস্তাব করা হয়েছে (§১১.৩.১, ১১.৩.২) —
  owner কি এতে একমত, নাকি দুই platform-এই একই স্টাইল (শুধু dots,
  বা শুধু labels) চান consistency-র জন্য?
- **নতুন (visual):** Demo mockup থেকে role pre-fill করে wizard-এ
  পাঠানো (§১১.৪) কি এই ধাপেই implement হবে, নাকি landing page
  redesign-এর বাকি অংশ (section ৬-৮) শেষ হওয়ার পরে আলাদা ছোট
  ফলো-আপ হিসেবে করা ভালো — কারণ এটা দুই বড় কাজের (auth redesign +
  visual redesign) সংযোগস্থল, কোনো একটা আগে শেষ না হলে ভুল জায়গায়
  আটকে যাওয়ার ঝুঁকি আছে।

---

## ১৪. এখনো যা দুর্বল/ফাঁকা আছে এই প্ল্যানে (honest gap list — কোডিং শুরুর আগে অবশ্যই resolve করা উচিত)

**এই সেকশনটা owner-এর সরাসরি প্রশ্নের জবাবে যোগ করা হয়েছে ("ei plan
e ki ki dubolota ache")। কোডে হাত দেওয়ার আগে Phase ১ শুরু করার আগে
এই লিস্টটা আবার রিভিউ করা উচিত — এর মধ্যে কিছু findings আগের প্ল্যানের
একটা মূল ধরে নেওয়া (assumption) ভেঙে দেয়।**

### ১৪.১ গুরুতর — plan-এর মূল ধরে নেওয়া (assumption) ভাঙছে

- **`claimRoll()` uid ছাড়া silently no-op করে — "সব local, uid শেষে"
  প্ল্যানটা roll number-এর ক্ষেত্রে কাজ করবে না।** কোড যাচাই করে
  দেখা গেছে (`rollOwnership.js`): `claimRoll(roll)` ফাংশনের প্রথম
  লাইনেই `const uid = auth.currentUser?.uid;` তারপর
  `if (!uid || !cleanRoll) return { ok: true };` — মানে **uid না
  থাকলে এটা কিছুই claim করে না, শুধু চুপচাপ `{ ok: true }` রিটার্ন
  করে**, যেটা ভুলভাবে "roll available" বলে মনে হবে। `rollOwners/
  {roll}` একটা Firestore-এ server-side enforced unique constraint
  (`firestore.rules`-এ `rollOwners/{roll}` match ব্লকে সেই enforce
  করা আছে) — **একই roll দুইজন claim করার collision check আসলে uid
  থাকা অবস্থাতেই সম্ভব, Google popup-এর আগে না।**
  **এর মানে:** Sign Up wizard-এর ধাপ ২-এ (Student profile form,
  roll number ইনপুট) roll uniqueness-এর real-time validation/error
  ("এই roll আগে থেকেই claimed") **দেখানো সম্ভব না যতক্ষণ uid না
  থাকে** — অর্থাৎ, Google popup-এর *আগে*। তাহলে হয় (ক) roll
  uniqueness check Confirm ধাপের (ধাপ ৩) *পরে*, Google popup হয়ে
  যাওয়ার পরেই দেখাতে হবে (যেটা মূল প্ল্যানের "popup-এর আগে সব ঠিক
  আছে কনফার্ম করা" নীতির সাথে সরাসরি সাংঘর্ষিক), অথবা (খ) roll
  claim ব্যর্থ হলে (collision) সেই নতুন Google অ্যাকাউন্ট delete
  করে ফেরত পাঠাতে হবে (যেটা ঠিক এই redesign-এর মূল লক্ষ্য — আধা-
  তৈরি অ্যাকাউন্ট এড়ানো — তার বিপরীত)। **এটা Section ১৩-এ নতুন
  owner-confirm প্রশ্ন হিসেবে যোগ করা হলো (§১৩-এর শেষে)।**

- **`FacultyProfileSetupModal.jsx`-এর নিজস্ব already-existing ৩-ধাপ
  internal wizard আছে, এবং সেটার প্রথম ধাপই async/live network
  lookup।** কোড যাচাই করে দেখা গেছে এই কম্পোনেন্টের মাথার কমেন্টেই
  লেখা: ধাপ ১ (Email) একটা "live-debounced facultyDirectory lookup"
  করে ইউজার টাইপ করার সাথে সাথে (`useDebouncedDirectoryLookup`),
  ধাপ ২ (Preview) সেই match দেখায়, ধাপ ৩ (Details+confirm)-এ submit।
  **এই তিন-ধাপ ফ্লো ইতিমধ্যেই নিজে থেকেই একটা mini-wizard** —
  আমাদের নতুন Sign Up wizard-এর "ধাপ ২: role-অনুযায়ী profile form"-এর
  ভেতরে এই পুরনো ৩-ধাপ wizard-টা কীভাবে বসবে (nested wizard-এর
  ভেতরে wizard?, নাকি flatten করে সব একসাথে আমাদের নতুন wizard-এর
  ধাপ ২/৩-এ ছড়িয়ে দেওয়া হবে?) — এটা আগের প্ল্যানে ("ফিল্ড লজিক
  re-use করা, শুধু trigger timing বদলাবে") অতিসরলীকৃত ছিল, বাস্তবে
  এটা faculty role-এর জন্য আলাদা sub-flow design লাগবে।

### ১৪.২ মাঝারি — নতুন edge case যা প্ল্যানে ছিল না

- **Faculty-এর email-lookup পুরোপুরি network-নির্ভর, uid ছাড়াই কাজ
  করে (এটা পাবলিক ডিরেক্টরি lookup, Firestore write না) —** কিন্তু
  ধীর/অস্থির নেটওয়ার্কে (KUET ক্যাম্পাসের ভেতরে এটা প্রাসঙ্গিক
  সমস্যা হতে পারে) এই লাইভ-লুকআপ আগে থেকেই সাইন আপ শুরু করা কাউকে
  আটকে রাখতে পারে যদি ভালোভাবে loading/timeout state ডিজাইন করা না
  হয় — এই ব্যাপারটা §১১.৩.২-তে (desktop wizard) বা §১১.৩.১-এ
  (mobile) কোনো loading/error state ডিজাইন উল্লেখই করা হয়নি।
- **Provider role-এর জন্য কোনো uid-নির্ভর uniqueness/duplicate-check
  নেই বলে ধরে নেওয়া হয়েছে, কিন্তু যাচাই করা হয়নি** — Student-এর roll
  এর মতো Provider-এর phone number/business name-এও কোনো Firestore
  uniqueness rule/duplicate-provider-check আছে কিনা কোড খুঁটিয়ে
  দেখা হয়নি এই সেশনে। যদি থাকে, একই সমস্যা (uid লাগে validate করতে)
  প্রযোজ্য হবে।
- **Anonymous/guest সেশনের সাথে conflict-এর সুযোগ** — `App.jsx`-এর
  `buildQueue(isAnonymous, pathname)` ফাংশন এখন `isAnonymous ||
  !auth.currentUser?.uid` চেক দিয়ে পুরো auth queue নিয়ন্ত্রণ করে।
  কেউ যদি আগে থেকে **anonymous/guest মোডে** থাকে (demo browse করার
  সময় guest session শুরু হয়ে যায় কিনা — এটাও verify করা হয়নি এই
  সেশনে) এবং তারপর নতুন Sign Up wizard শুরু করে, `upgradeWithGoogle()`
  পাথ ট্রিগার হবে `loginWithGoogle()`-এর বদলে (§৯.৪-তে এই প্রশ্ন
  তোলা হয়েছিল কিন্তু resolve হয়নি) — এই দুই পাথের `isNewUser`
  সেমান্টিক্স আলাদা হতে পারে (একটা naya Google sign-in, আরেকটা
  existing anonymous uid-তে linking), সেটা §৯.২-এর কোড উদাহরণ
  cover করেনি।
- **Wizard-এর URL/route শেয়ারযোগ্য কিনা, বা browser back button চাপলে
  কী হয়** — কোনো routing-এর কথা প্ল্যানে বলা হয়নি (modal-ভিত্তিক
  নাকি আলাদা route, `/signup?step=2` জাতীয়) — এটা ঠিক না করলে
  ব্রাউজার back বাটনে মাঝপথের ফর্ম ডেটা হারানোর ঝুঁকি প্ল্যানে
  ধরা পড়েনি (§১৩-এর "ব্রাউজার বন্ধ করলে কী হয়" প্রশ্নের কাছাকাছি
  কিন্তু আলাদা সমস্যা — এটা "ট্যাব বন্ধ" না, "ভুলে/ইচ্ছাকৃত back
  চাপা")।

### ১৪.৩ হালকা — visual/content polish বাকি

- **Mockup-গুলো (assets/) generic design-token রঙ দিয়ে বানানো**
  (`--fill-accent` ইত্যাদি জেনেরিক নীল), **KUETx-এর নিজের
  `var(--accent)`/`var(--accentRGB)` থিম কালার/ফন্ট verify করে বসানো
  হয়নি** — visual mockup শুধু layout/স্ট্রাকচার বোঝানোর জন্য,
  রঙ/টাইপোগ্রাফি চূড়ান্ত না।
- Section ৬-৮ (typography, signature moment, motion library)-এর
  owner-confirm এখনো বাকি (§৮-এ প্রশ্নগুলো তালিকাভুক্ত)।
- Wizard ধাপ ৩ (Confirm)-এর exact field content role-ভিত্তিক এখনো
  চূড়ান্ত না (§১৩)।
- কোনো mockup **dark mode**-এ কেমন দেখাবে তা যাচাই করা হয়নি — KUETx
  অ্যাপে dark mode আছে (`--accentSoft` ফিক্স ইত্যাদি memory-তে
  উল্লেখ আছে), কিন্তু এই সেশনের mockup শুধু light mode-এ বানানো।
- **Accessibility/keyboard-navigation** wizard ডিজাইনে উল্লেখ করা
  হয়নি — screen reader-এর জন্য step announcement, ফোকাস ম্যানেজমেন্ট
  ধাপ পরিবর্তনের সময়, ইত্যাদি প্ল্যানে নেই।

---

## ১৫. §১৪.১ থেকে নতুন জরুরি owner-confirm প্রশ্ন

- **Roll uniqueness collision কীভাবে হ্যান্ডল হবে (§১৪.১-এর প্রথম
  পয়েন্ট)?** তিনটা সম্ভাব্য পথ:
  1. Google popup-এর *পরে* roll claim করা, ব্যর্থ হলে account
     delete + "এই roll আগে থেকেই ব্যবহৃত, KUETx সাপোর্টে যোগাযোগ
     করুন" মেসেজ (delete পুরোপুরি এড়ানো যায় না এই কেসে)।
  2. Confirm ধাপে (ধাপ ৩) Google popup-এর *আগে* একটা best-effort
     "roll available কিনা" preview-check করা (uid ছাড়া
     `rollOwners/{roll}` doc সরাসরি read করে, write/claim না —
     Firestore rules-এ read কি uid ছাড়া allowed তা যাচাই করতে হবে),
     তারপর popup-এর পরে real claim — preview accurate না হতে পারে
     (race condition — দুইজন একই মুহূর্তে চেক করলে) কিন্তু বেশিরভাগ
     কেসে UX ভালো থাকবে।
  3. Roll number input-টাই wizard থেকে সরিয়ে, Sign Up সম্পূর্ণ হওয়ার
     পরে dashboard-এর প্রথম-লগইন onboarding-এ নিয়ে যাওয়া (পুরনো
     `role-select`→`profile` queue প্যাটার্নের কাছাকাছি ফিরে যাওয়া,
     শুধু roll number-এর জন্য বিশেষ ব্যতিক্রম রেখে)।
- **Faculty role-এর জন্য wizard কি ৩ ধাপের বদলে ৪-৫ ধাপ হবে**
  (§১৪.১-এর দ্বিতীয় পয়েন্ট — role select + email-lookup sub-steps +
  details + confirm), নাকি `FacultyProfileSetupModal`-এর নিজের
  ৩-ধাপ wizard-টা compress করে আমাদের নতুন wizard-এর একটামাত্র
  "ধাপ ২"-এর ভেতরে গুঁজে দেওয়া হবে (কম ধাপ কিন্তু প্রতি ধাপে বেশি
  কাজ)?
- Guest/anonymous session থেকে সরাসরি demo browse করার সময় সত্যিই
  anonymous Firebase sign-in শুরু হয় কিনা (নাকি demo সম্পূর্ণ
  client-side static, কোনো auth session লাগে না) — এটা যাচাই করা
  দরকার Phase ৬/১০ শুরুর আগে, কারণ এর উপর নির্ভর করে
  `upgradeWithGoogle()` পাথ আদৌ Sign Up wizard-এর সাথে interact
  করবে কিনা।
- Wizard কি modal-based থাকবে (এখনকার `AuthModal`/`RoleSelectScreen`
  প্যাটার্নের মতো) নাকি dedicated route (`/signup`) — এটা browser
  back-button behavior নির্ধারণ করবে, তাই Phase ৪ শুরুর আগে ঠিক করা
  দরকার।

উপরের Phase-গুলোর "Scope" কলাম নিচের section-গুলো point করে।
নিচের অংশ নিজে কোনো "কাজ" না — এটা research/decision/design
reference, যা প্রতিটা Phase বাস্তবায়নের সময় consult করা হবে।

---

## ১৬. §১৫-এর ৪ প্রশ্নের চূড়ান্ত owner-confirm সিদ্ধান্ত (Phase ০.৭)

**মূল নীতি যা প্রতিটা সিদ্ধান্তে apply করা হয়েছে:** এই পুরো redesign-এর
আসল লক্ষ্য ফিচার যোগ করা না — **ভুলবশত/আধা-তৈরি account creation
থেকে বাঁচানো।** প্রতিটা অপশন এই টেস্ট দিয়ে যাচাই করা হয়েছে: *"এটা কি
এমন কোনো অবস্থা তৈরি করতে পারে যেখানে Google account তৈরি হয়ে গেছে
কিন্তু KUETx-এর দিক থেকে অসম্পূর্ণ/broken অবস্থায় আটকে আছে?"*

### ১৬.১ Roll uniqueness collision — সিদ্ধান্ত: **অপশন ২ (best-effort preview-check, popup-এর আগে)**

- অপশন ১ (popup-এর পরে claim, fail হলে account delete) বাতিল —
  সরাসরি "account বানিয়ে delete করা"-র ঝুঁকি রাখে, যেটা এই
  redesign-এর মূল লক্ষ্যের বিপরীত।
- অপশন ৩ (roll wizard থেকে বাদ) বাতিল — পুরনো queue প্যাটার্নে ফিরিয়ে
  নেয়, যেটা এই redesign avoid করতে চাইছে।
- **কোড verify করে দেখা গেছে এটা সম্ভব:** `firestore.rules` লাইন
  ২০৫৭: `match /rollOwners/{roll} { allow read: if isSignedIn(); ... }`
  — read করতে শুধু signed-in হলেই চলে, নির্দিষ্ট uid ownership লাগে
  না। মানে Google popup সম্পন্ন হওয়ার সাথে সাথে (uid পাওয়ার পরপরই,
  কিন্তু Firestore-এ profile write করার *আগেই*) `rollOwners/{roll}`
  read করে preview দেখানো যায়, real `claimRoll()` তার পরে।
- এছাড়া `rollOwnership.js`-এ ইতিমধ্যেই একটা সম্পূর্ণ self-service +
  admin-assisted unlock path আছে যেটা আগের গ্যাপ-অ্যানালিসিসে খেয়াল
  করা হয়নি: `verifiedRolls/{roll}` থাকলে auto-reclaim, না থাকলে
  `requestRollUnlockRequest()` দিয়ে Founder-কে request পাঠানো যায়
  (`resolveRollUnlockRequest`/`dismissRollUnlockRequest` দিয়ে admin
  resolve করে)। তাই collision হলেও ইউজার পুরোপুরি আটকে যায় না — এটা
  race-condition edge case-এর জন্য একটা existing safety net।

### ১৬.২ Faculty wizard — সিদ্ধান্ত: **existing 3-step compress করে নতুন wizard-এর একটামাত্র ধাপে বসানো, আলাদা ৪-৫ ধাপ না**

- আলাদা ৪-৫ ধাপ বানালে দুইটা wizard duplicate logic maintain করতে
  হতো — bug-এর সুযোগ বাড়ে, আর bug মানেই নতুন জায়গায় account আটকে
  থাকার ঝুঁকি।
- `FacultyProfileSetupModal.jsx`-এর existing ৩-ধাপ (email lookup →
  preview → details+confirm) কনসেপ্টগতভাবে নতুন wizard-এর "profile
  form → confirm" কাঠামোর সাথেই মেলে — নতুন কিছু শেখাতে হচ্ছে না,
  কোড সরাসরি reuse হচ্ছে।

### ১৬.৩ Anonymous/guest session — সিদ্ধান্ত: **প্রযোজ্যই না, dead code — এটা §১৩/§১৪.২-এর পুরো "guest upgrade" প্রশ্নটাই বাতিল করে**

- **কোড verify করে নিশ্চিত করা হয়েছে:** `src/lib/firebaseAuth.js`-এ
  `loginAnonymously()` ফাংশন define করা আছে (`signInAnonymously`
  ব্যবহার করে) কিন্তু **কোথাও call হয় না** — `grep` করে পুরো
  `src/`-এ এর একমাত্র usage নিজের definition আর একটা comment-এ।
- **App.jsx-এর নিজস্ব কমেন্ট (লাইন ~১৪০৮-১৪১৮) এটা confirm করে:**
  "the anonymous-session flow this was built for no longer runs
  anywhere in the app (loginAnonymously() is defined but never
  called; both isUpgrade={...} call sites are gated behind
  conditions ... that can now never be true)." এটা একটা প্রকৃত prior
  bug ছিল (info.linked সবসময় false হওয়ায় প্রতিটা plain Login-এ
  returning user-এর local data মুছে যাচ্ছিল) যেটা আগেই এক সেশনে
  ঠিক করা হয়েছে।
- অ্যাপ এখন ডিফল্টভাবে anonymous অবস্থায় বুট করে না — বরং
  `useFirebaseAuth.js`-এর `isAnonymous: user?.isAnonymous ?? true`
  fallback শুধু auth ready না হওয়া পর্যন্ত UI-কে conservative রাখার
  জন্য, বাস্তবে কোনো actual anonymous sign-in trigger হয় না।
- **ফলাফল:** নতুন Sign Up wizard সবসময় plain `loginWithGoogle()`
  পাথ ব্যবহার করবে, কখনো `upgradeWithGoogle()`/anonymous-uid-linking
  পাথ ট্রিগার হবে না — §৯.২/§৯.৪-এর সেই dual-path কোড উদাহরণ আসলে
  এখন এক-পাথই, সরল হয়ে গেল। **Phase ১০ (Guest/anonymous upgrade ফ্লো
  সমন্বয়) বাতিল/অপ্রয়োজনীয় — ভবিষ্যতে চাইলে `loginAnonymously()`
  dead code হিসেবে সরানো যায়, কিন্তু সেটা এই redesign-এর scope-এর
  বাইরে, আলাদা non-blocking cleanup।**

### ১৬.৪ Wizard modal vs dedicated route — সিদ্ধান্ত: **modal-based**

- Existing pattern (`AuthModal`, `RoleSelectScreen`) আগে থেকেই
  modal-ভিত্তিক — consistency বজায় থাকে।
- Dedicated route (`/signup`) মানে নতুন routing/deep-link logic লিখতে
  হতো এবং সেটা `buildQueue()`-এর সাথে conflict resolve করতে হতো
  (§১৪.২-এ flag করা হয়েছিল) — এক্সট্রা জটিলতা, আর নতুন জায়গায় bug/
  আটকে-যাওয়া account-এর নতুন সুযোগ তৈরি করে।
- Modal রাখলে browser back মানেই স্বাভাবিকভাবে modal বন্ধ হওয়া
  (ইচ্ছাকৃত বন্ধ করার কাছাকাছি আচরণ) — আলাদা route-history handling
  লাগে না, existing battle-tested queue/redirect logic-এর উপরেই
  build হয়।

**সারসংক্ষেপ — Phase ১ থেকে শুরু করার জন্য এখন যা নিশ্চিত:**
roll preview-check popup-এর ঠিক পরেই (profile write-এর আগে) হবে;
Faculty-র জন্য নতুন ধাপ যোগ হবে না, existing modal-এর logic নতুন
wizard-এর মধ্যে বসবে; শুধু `loginWithGoogle()` পাথ লাগবে, কোনো
upgrade/anonymous-linking কোড নতুন করে লিখতে হবে না; wizard modal-
based থাকবে, নতুন route লাগবে না। Phase ১০ বাতিল বিবেচনা করা হলো।

---
