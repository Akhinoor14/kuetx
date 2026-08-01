// Rebuilt to match the current app (App.jsx routes + nav.js), scoped to
// Student + Class Rep (CR) features only — Faculty/Provider/Admin have
// their own separate areas and are intentionally not covered here.
//
// Bilingual: every section has both a Bangla and an English version of
// every text field (title/desc/blocks). GuideModal.jsx reads `lang`
// ('bn' | 'en', default 'bn') and picks the right one — see that file's
// language toggle button next to the search box.
//
// Sections removed since the last version because the page/route no
// longer exists or was never wired into navigation: Self Evaluation,
// Smart Score, Quick Access & Nav, Firebase Sync (folded into Profile).
// Sections added because they exist in the app but had no guide entry:
// Today, Classmates, Notice, Reports, Projects, Tours, Tuition, Services
// marketplace, Class Setup, full Class Rep toolset.

export const GUIDE_CATEGORIES_BN = [
  "শুরুর কথা",
  "একাডেমিক্স",
  "ক্যাম্পাস লাইফ",
  "টুলস",
  "ক্লাস রিপ্রেজেন্টেটিভ (CR)",
];

export const GUIDE_CATEGORIES_EN = [
  "Overview",
  "Academics",
  "Campus Life",
  "Tools",
  "Class Rep (CR)",
];

// Index-matched to *_BN above — GuideModal picks the right array by lang.
export const GUIDE_CATEGORIES = GUIDE_CATEGORIES_EN;

const CAT = {
  OVERVIEW: 0, ACADEMICS: 1, CAMPUS: 2, TOOLS: 3, CR: 4,
};

function catFor(lang, idx) {
  return (lang === 'bn' ? GUIDE_CATEGORIES_BN : GUIDE_CATEGORIES_EN)[idx];
}

// Each section stores bn/en pairs for title/desc, and blocks are stored
// once per language (blocksBn / blocksEn) since block text differs by
// language, not just labels. `catIdx` picks category name per language
// via catFor() at render time (see guideContent helpers below).
const RAW_SECTIONS = [
  {
    num: "00", id: "why", route: null, icon: "Sparkles", catIdx: CAT.OVERVIEW,
    titleBn: "কেন KUETx ব্যবহার করবে?",
    titleEn: "Why Use KUETx?",
    descBn: "KUETx কোনো সাধারণ স্টুডেন্ট অ্যাপ না। প্রতিটা ফিচার বানানো হয়েছে KUET-এর নিজস্ব পরীক্ষা পদ্ধতি, উপস্থিতির নিয়ম, নম্বর গণনার সূত্র আর ক্যাম্পাস লাইফ মাথায় রেখে।",
    descEn: "KUETx is not a generic student tool. Every feature is designed around KUET's actual exam system, attendance rules, mark calculation formula, and campus life.",
    blocksBn: [
      { type: 'text', text: 'KUETx কোনো সাধারণ স্টুডেন্ট টুল না — প্রতিটা ফিচার KUET-এর নিজস্ব পরীক্ষা সিস্টেম, উপস্থিতির নিয়ম, নম্বর গণনার সূত্র, আর ক্যাম্পাস লাইফ মাথায় রেখে বানানো — অন্য কোনো অ্যাপ এভাবে বানায় না।' },
      { type: 'table', headers: ['KUETx ছাড়া', 'KUETx দিয়ে'], rows: [
        ['কাগজে ম্যানুয়ালি উপস্থিতি গোনা', 'প্রতিটা কোর্স, প্রতিদিনের জন্য অটো-ট্র্যাক, কালার-কোডেড শর্টেজ অ্যালার্ট সহ'],
        ['মাথায় মাথায় CGPA আন্দাজ করা', 'প্রতিটা নম্বর ও রেজাল্ট থেকে লাইভ CGPA'],
        ['অ্যাসাইনমেন্টের ডেডলাইন ভুলে যাওয়া', 'Dashboard-এ স্ট্যাটাস, প্রায়োরিটি ও ওভারডিউ অ্যালার্টসহ ইউনিফাইড ট্র্যাকার'],
        ['মার্ক এন্ট্রির জন্য স্প্রেডশিট', 'গ্রেড প্রেডিকশন ও টার্গেট মার্ক ক্যালকুলেটরসহ প্রতি-কোর্স মার্ক'],
        ['KUET-এর একাডেমিক নিয়ম না জানা', 'নিয়ম ভঙ্গ হলে অ্যাপ সতর্ক করে'],
        ['প্রতি টার্মে আগের প্রশ্ন হারিয়ে ফেলা', 'প্রশ্নব্যাংক — সব KUET পুরনো প্রশ্ন এক জায়গায়, ডাউনলোডযোগ্য'],
        ['ডিভাইস বদলালে ব্যাকআপ না থাকা', 'সাইন-ইন করলে Firebase রিয়েল-টাইম সিঙ্ক'],
        ['নামাজ ও অভ্যাস আলাদা ট্র্যাক করা', 'নামাজ ট্র্যাকার + সেলফ ইভ্যালুয়েশন এক জায়গায়'],
        ['খাতায় টাকার হিসাব রাখা', 'মাসিক চার্টসহ আয়-ব্যয় ট্র্যাকার'],
        ['নিজের উপস্থিতির মার্ক না জানা', 'প্রতিটা শিক্ষকের জন্য KUET স্ল্যাব ফর্মুলা অনুযায়ী অটো-ক্যালকুলেটেড'],
        ['ধাপে ধাপে সমাধান না পাওয়া', 'সলিউশন ব্যাংক — আগের প্রশ্নের বিস্তারিত সমাধান'],
        ['শিক্ষকের যোগাযোগ নম্বর হারিয়ে ফেলা', 'কোর্স ও রুটিনের সাথে যুক্ত টিচার ডিরেক্টরি'],
      ]},
    ],
    blocksEn: [
      { type: 'text', text: "KUETx is not a generic student tool. Every single feature is designed around KUET's actual exam system, attendance rules, mark calculation formula, and campus life — no other app does this." },
      { type: 'table', headers: ['Without KUETx', 'With KUETx'], rows: [
        ['Manual attendance counting on paper', 'Auto-tracked per course, per day, with color-coded shortage alerts'],
        ['Guessing your CGPA in your head', 'Live CGPA calculated from every mark and result you enter'],
        ['Forgetting assignment deadlines', 'Unified tracker with status, priority, and overdue alerts on Dashboard'],
        ['Spreadsheets for mark entry', 'Per-course marks with grade prediction and target hall-mark calculator'],
        ["Not knowing KUET academic rules", "App warns when you're violating attendance/mark rules"],
        ['Losing past exam papers each term', 'Question bank — all KUET past papers in one place, downloadable'],
        ['No cross-device backup', 'Sign in and get Firebase real-time sync'],
        ['Tracking prayers and habits separately', 'Namaz tracker + Self Evaluation in one place'],
        ['Managing money in a notebook', 'Income + expense tracker with monthly chart'],
        ['Not knowing your attendance marks', 'Auto-calculated per KUET slab formula for each teacher'],
        ['No step-by-step exam solutions', 'Solution Bank — detailed worked solutions to past papers'],
        ['Missing teacher contact info', 'Personal teacher directory linked to courses and schedule'],
      ]},
    ],
  },

  {
    num: "01", id: "getting-started", route: null, icon: "Rocket", catIdx: CAT.OVERVIEW,
    titleBn: "শুরু করবে কীভাবে",
    titleEn: "Getting Started",
    descBn: "kuetx.vercel.app এ যাও, Dashboard-এ পৌঁছাবে। প্রথমে বেশিরভাগ কার্ড খালি থাকবে — এটাই স্বাভাবিক।",
    descEn: "Go to kuetx.vercel.app. You land on the Dashboard. Most cards will be empty at first — that is normal.",
    blocksBn: [
      { type: 'subhead', text: 'প্রথমবার অ্যাপ খুললে যা দেখবে' },
      { type: 'text', text: 'kuetx.vercel.app-এ যাও। Dashboard-এ পৌঁছে যাবে। বেশিরভাগ কার্ড খালি বা শূন্য দেখাবে — এটা স্বাভাবিক। উপরে "Complete Your Profile" ব্যানার দেখা যেতে পারে। প্রথম লোডের পর অ্যাপ অফলাইনেও কাজ করবে।' },
      { type: 'callout', variant: 'tip', text: 'আগে ইনস্টল করে নাও। Android-এ: Chrome মেনু → Add to Home Screen। iPhone-এ: Safari Share → Add to Home Screen। ডেস্কটপে: অ্যাড্রেস বারের ইনস্টল আইকনে ক্লিক করো। PWA ভার্সন দ্রুত কাজ করে এবং ব্রাউজার ট্যাব ছাড়াই চলে।' },
      { type: 'subhead', text: 'সেটআপ অর্ডার — এই ক্রমে করো' },
      { type: 'text', text: 'প্রথম দিনই এই ক্রমটা অনুসরণ করো। প্রতিটা ধাপ পরেরটার জন্য দরকার।' },
      { type: 'step', num: 1, text: 'Profile খোলো → পেন্সিল আইকনে ট্যাপ করো → নাম, স্টুডেন্ট আইডি, বিভাগ, ইয়ার/টার্ম, ভর্তির বছর পূরণ করো। Save করো।' },
      { type: 'step', num: 2, text: 'Courses-এ গিয়ে এই টার্মের কোর্সগুলো (তোমার বিভাগ/ব্যাচ অনুযায়ী কারিকুলাম থেকে অটো-লোড হয়) দেখে নিশ্চিত করো।' },
      { type: 'step', num: 3, text: 'Schedule-এ গিয়ে ক্লাস রুটিন ঠিক আছে কিনা দেখো — CR যদি ক্লাস সেটআপ করে থাকে, রুটিন অটো-লোড হবে।' },
      { type: 'step', num: 4, text: 'Attendance-এ প্রতিটা কোর্সের বর্তমান উপস্থিতি (held/attended) এন্ট্রি দাও যাতে দিন থেকেই সঠিক ট্র্যাকিং শুরু হয়।' },
      { type: 'step', num: 5, text: 'সবার শেষে Settings-এ গিয়ে Google দিয়ে সাইন ইন করো — এতে ডেটা ডিভাইস বদলালেও হারাবে না, ক্লাউডে সিঙ্ক থাকবে।' },
      { type: 'callout', variant: 'info', text: 'সাইন ইন না করলেও অ্যাপ পুরোপুরি কাজ করে — ডেটা তখন শুধু এই ডিভাইসে (localStorage) থাকে। সাইন ইন করলে সেটা Firebase-এ সিঙ্ক হয়ে যায়, নতুন ডিভাইসেও ফিরে পাবে।' },
    ],
    blocksEn: [
      { type: 'subhead', text: 'What You See When You First Open the App' },
      { type: 'text', text: 'Go to kuetx.vercel.app. You land on the Dashboard. Most cards will be empty or show zero — that is normal. A "Complete Your Profile" banner may appear at the top. The app is already working offline after this first load.' },
      { type: 'callout', variant: 'tip', text: 'Install it first. On Android: Chrome menu → Add to Home Screen. On iPhone: Safari Share → Add to Home Screen. Desktop: click the install icon in the address bar. The PWA version is faster and works without a browser tab.' },
      { type: 'subhead', text: 'Setup Order — Do This in Sequence' },
      { type: 'text', text: 'Follow this order on Day 1. Each step feeds the next.' },
      { type: 'step', num: 1, text: 'Open Profile → tap the pencil icon → fill your name, student ID, department, year/term, enrolled year. Tap Save.' },
      { type: 'step', num: 2, text: "Go to Courses and confirm this term's courses (auto-loaded from the curriculum for your department/batch)." },
      { type: 'step', num: 3, text: "Check Schedule for your class routine — if your CR has already set up the class, the routine loads automatically." },
      { type: 'step', num: 4, text: 'Enter your current attendance (held/attended) for each course in Attendance so tracking starts accurate from day one.' },
      { type: 'step', num: 5, text: 'Finally, sign in with Google under Settings — this keeps your data synced to the cloud so nothing is lost across devices.' },
      { type: 'callout', variant: 'info', text: 'The app fully works without signing in — data just stays on this device (localStorage). Signing in syncs it to Firebase so it follows you to a new device.' },
    ],
  },

  {
    num: "02", id: "dashboard", route: "/", icon: "Grid", catIdx: CAT.OVERVIEW,
    titleBn: "ড্যাশবোর্ড",
    titleEn: "Dashboard",
    descBn: "লগইন করলে যা প্রথমে দেখো — আজকের ক্লাস, উপস্থিতির অবস্থা, পেন্ডিং অ্যাসাইনমেন্ট, নোটিশ সব একসাথে।",
    descEn: "The first thing you see on login — today's classes, attendance status, pending assignments, and notices all in one place.",
    blocksBn: [
      { type: 'text', text: 'Dashboard হলো তোমার হোম পেজ — এখান থেকে একনজরে দেখা যায় আজকের ক্লাস কী, কোন কোর্সে উপস্থিতি কম, কোন অ্যাসাইনমেন্টের ডেডলাইন কাছে, আর নতুন কোনো নোটিশ এসেছে কিনা।' },
      { type: 'bullet', text: 'আজকের ক্লাস রুটিন কার্ড — Schedule থেকে অটো-টানা' },
      { type: 'bullet', text: 'উপস্থিতি সামারি — কোন কোর্সে শর্টেজের ঝুঁকি আছে সেটা লাল/হলুদে দেখায়' },
      { type: 'bullet', text: 'পেন্ডিং/ওভারডিউ অ্যাসাইনমেন্ট তালিকা' },
      { type: 'bullet', text: 'সাম্প্রতিক নোটিশ (ক্লাস অ্যানাউন্সমেন্ট)' },
      { type: 'callout', variant: 'tip', text: 'প্রোফাইল সম্পূর্ণ না করা থাকলে উপরে একটা ব্যানার দেখাবে — এটা বন্ধ করতে Profile পূরণ করো।' },
    ],
    blocksEn: [
      { type: 'text', text: 'Dashboard is your home page — a one-glance view of today\'s classes, which courses have low attendance, which assignments are due soon, and any new notices.' },
      { type: 'bullet', text: "Today's class routine card — pulled automatically from Schedule" },
      { type: 'bullet', text: 'Attendance summary — courses at risk of shortage are flagged red/amber' },
      { type: 'bullet', text: 'Pending/overdue assignment list' },
      { type: 'bullet', text: 'Recent notices (class announcements)' },
      { type: 'callout', variant: 'tip', text: "If your profile isn't complete, a banner shows up at the top — fill in Profile to dismiss it." },
    ],
  },

  {
    num: "03", id: "today", route: "/today", icon: "Sunrise", catIdx: CAT.OVERVIEW,
    titleBn: "আজকের দিন (Today)",
    titleEn: "Today",
    descBn: "আজকের দিনের সবকিছু একসাথে — ক্লাস, অ্যাসাইনমেন্ট, নামাজের সময়, নোটিশ — একটাই ফোকাসড পেজে।",
    descEn: "Everything about today in one focused page — classes, assignments, prayer times, and notices.",
    blocksBn: [
      { type: 'text', text: 'Today পেজটা Dashboard-এর মতোই কিন্তু শুধু আজকের দিনের ওপর ফোকাস করা — সকালে একবার খুলে পুরো দিনের প্ল্যান বুঝে নেওয়ার জন্য বানানো।' },
      { type: 'bullet', text: 'আজকের সব ক্লাস, সময়সহ' },
      { type: 'bullet', text: 'আজকের নামাজের সময়সূচি' },
      { type: 'bullet', text: 'আজ যেসব অ্যাসাইনমেন্ট জমা দিতে হবে' },
    ],
    blocksEn: [
      { type: 'text', text: "The Today page is like Dashboard but focused only on today — built to open once in the morning and see the whole day's plan at a glance." },
      { type: 'bullet', text: "All of today's classes, with times" },
      { type: 'bullet', text: "Today's prayer time schedule" },
      { type: 'bullet', text: 'Assignments due today' },
    ],
  },

  {
    num: "04", id: "profile", route: "/profile", icon: "User", catIdx: CAT.OVERVIEW,
    titleBn: "প্রোফাইল",
    titleEn: "Profile",
    descBn: "নাম, স্টুডেন্ট আইডি, বিভাগ, ব্যাচ — এগুলোর ওপরই বাকি সব ফিচার (কোর্স, রুটিন, প্রশ্নব্যাংক) নির্ভর করে। এখান থেকেই Google সাইন-ইন করা যায়।",
    descEn: "Your name, student ID, department, batch — the rest of the app (courses, schedule, question bank) is built on this. Google sign-in also lives here.",
    blocksBn: [
      { type: 'text', text: 'Profile হলো ভিত্তি — এখানকার তথ্য অনুযায়ী তোমার কারিকুলাম, কোর্স তালিকা আর প্রশ্নব্যাংক ফিল্টার হয়। ভুল বিভাগ/ব্যাচ দিলে ভুল কোর্স দেখাবে, তাই শুরুতে ঠিকমতো পূরণ করাটা জরুরি।' },
      { type: 'bullet', text: 'নাম, স্টুডেন্ট আইডি, বিভাগ, বর্তমান ইয়ার/টার্ম, ভর্তির বছর' },
      { type: 'bullet', text: 'প্রোফাইল ছবি আপলোড' },
      { type: 'bullet', text: 'Google দিয়ে সাইন-ইন/সিঙ্ক — এখান থেকেও করা যায় (Settings থেকেও করা যায়)' },
      { type: 'callout', variant: 'warning', text: 'বিভাগ ও ব্যাচ পরে বদলানো গেলেও, একবার সেট করার পর কোর্স/রুটিন ডেটা সেই অনুযায়ী রিফ্রেশ হয় — তাই শুরুতেই সঠিকভাবে দাও।' },
    ],
    blocksEn: [
      { type: 'text', text: "Profile is the foundation — your curriculum, course list, and question bank filtering all depend on this data. Wrong department/batch means wrong courses show up, so fill this in correctly on day one." },
      { type: 'bullet', text: 'Name, student ID, department, current year/term, enrolled year' },
      { type: 'bullet', text: 'Profile photo upload' },
      { type: 'bullet', text: 'Google sign-in/sync — can be done here too (also available in Settings)' },
      { type: 'callout', variant: 'warning', text: 'Department and batch can be changed later, but course/schedule data refreshes based on whatever is set — so get it right the first time.' },
    ],
  },

  {
    num: "05", id: "courses", route: "/courses", icon: "BookOpen", catIdx: CAT.ACADEMICS,
    titleBn: "কোর্সসমূহ",
    titleEn: "Courses",
    descBn: "তোমার বিভাগ ও টার্ম অনুযায়ী এই সেমিস্টারের সব কোর্স অটো-লোড হয়ে যায় — কারিকুলাম ডেটা থেকে।",
    descEn: "This term's courses auto-load based on your department and term, pulled from the curriculum data.",
    blocksBn: [
      { type: 'text', text: 'Profile-এ বিভাগ ও টার্ম ঠিক দিলে Courses পেজে এই সেমিস্টারের সব কোর্স (কোড, নাম, ক্রেডিট) নিজে থেকেই চলে আসে — হাতে টাইপ করা লাগে না।' },
      { type: 'bullet', text: 'কোর্স কোড, নাম, ক্রেডিট আওয়ার' },
      { type: 'bullet', text: 'প্রতিটা কোর্স Attendance, Marks, Syllabus, Teachers পেজে লিংক করা থাকে' },
      { type: 'callout', variant: 'info', text: 'কোর্স তালিকা ভুল দেখালে Profile-এ গিয়ে বিভাগ/টার্ম ঠিক আছে কিনা যাচাই করো, অথবা CR-কে জিজ্ঞেস করো তারা Class Setup ঠিকমতো করেছে কিনা।' },
    ],
    blocksEn: [
      { type: 'text', text: "Set the right department and term in Profile, and Courses auto-fills this semester's course list (code, name, credits) — nothing to type manually." },
      { type: 'bullet', text: 'Course code, name, credit hours' },
      { type: 'bullet', text: 'Each course links out to Attendance, Marks, Syllabus, and Teachers' },
      { type: 'callout', variant: 'info', text: 'If the course list looks wrong, double-check department/term in Profile, or ask your CR if Class Setup was completed correctly.' },
    ],
  },

  {
    num: "06", id: "attendance", route: "/attendance", icon: "CheckSquare", catIdx: CAT.ACADEMICS,
    titleBn: "উপস্থিতি (Attendance)",
    titleEn: "Attendance",
    descBn: "প্রতিটা কোর্সের held/attended এন্ট্রি দাও — অ্যাপ KUET-এর স্ল্যাব ফর্মুলা দিয়ে অটো নম্বর ও কতগুলো ক্লাস মিস করা যাবে তা বের করে দেয়।",
    descEn: "Enter held/attended for each course — the app calculates your slab-based marks and how many more classes you can safely miss, using KUET's formula.",
    blocksBn: [
      { type: 'text', text: 'প্রতিটা কোর্সের জন্য কতটা ক্লাস হয়েছে (held) আর তুমি কতটায় উপস্থিত ছিলে (attended) এন্ট্রি দাও। অ্যাপ KUET-এর স্ল্যাব অনুযায়ী (৯০%+, ৭৫-৮৯%, ৬০-৭৪%, ৬০%-এর নিচে) তোমার নম্বর ও রঙ-কোডেড স্ট্যাটাস বের করে।' },
      { type: 'bullet', text: 'প্রতি কোর্সে held/attended এন্ট্রি এবং শতাংশ' },
      { type: 'bullet', text: 'স্ল্যাব অনুযায়ী অটো-ক্যালকুলেটেড উপস্থিতি নম্বর' },
      { type: 'bullet', text: '"আর কতটা ক্লাস মিস করা যাবে" হিসাব — পরের স্ল্যাবে নামার আগে' },
      { type: 'bullet', text: 'পেজের নিচে সব স্ল্যাবের রেফারেন্স টেবিল আছে' },
      { type: 'callout', variant: 'warning', text: '৬০%-এর নিচে নামলে উপস্থিতির নম্বর শূন্য হয়ে যায় — অ্যাপ সেটা লাল রঙে সতর্ক করে দেখায়।' },
    ],
    blocksEn: [
      { type: 'text', text: "Enter how many classes have been held vs how many you attended, per course. The app calculates your marks using KUET's slab system (90%+, 75-89%, 60-74%, below 60%) with color-coded status." },
      { type: 'bullet', text: 'Held/attended entry and percentage per course' },
      { type: 'bullet', text: 'Auto-calculated attendance marks by slab' },
      { type: 'bullet', text: '"How many classes you can still miss" before dropping a slab' },
      { type: 'bullet', text: 'A full slab reference table at the bottom of the page' },
      { type: 'callout', variant: 'warning', text: 'Dropping below 60% zeroes out your attendance marks — the app flags this in red.' },
    ],
  },

  {
    num: "07", id: "schedule", route: "/schedule", icon: "Clock", catIdx: CAT.ACADEMICS,
    titleBn: "ক্লাস রুটিন",
    titleEn: "Class Schedule",
    descBn: "সাপ্তাহিক ক্লাস রুটিন — CR যদি Class Setup করে থাকে তাহলে পুরো ব্যাচের জন্য অটো-লোড হয়ে যায়।",
    descEn: "Your weekly class routine — auto-loaded for the whole batch once your CR completes Class Setup.",
    blocksBn: [
      { type: 'text', text: 'CR একবার Class Setup পেজে গিয়ে ব্যাচের রুটিন সেট করে দিলে, সেই ব্যাচের প্রতিটা শিক্ষার্থীর Schedule পেজে অটোমেটিক দেখা যায় — আলাদা করে কিছু করতে হয় না।' },
      { type: 'bullet', text: 'দিন অনুযায়ী ক্লাসের সময়, কোর্স ও রুম' },
      { type: 'bullet', text: 'Dashboard ও Today পেজেও একই রুটিন থেকে ডেটা টানা হয়' },
      { type: 'callout', variant: 'info', text: 'রুটিন খালি দেখাচ্ছে? মানে তোমার CR এখনো Class Setup সম্পূর্ণ করেনি — তাদের বলো "CR Tools → Class Setup" থেকে সেটআপ করে দিতে।' },
    ],
    blocksEn: [
      { type: 'text', text: "Once your CR sets the routine through Class Setup, every student in that batch automatically sees it on their Schedule page — nothing extra to do." },
      { type: 'bullet', text: 'Class time, course, and room, per day' },
      { type: 'bullet', text: 'Dashboard and Today both pull from this same schedule' },
      { type: 'callout', variant: 'info', text: 'Schedule showing empty? Your CR hasn\'t completed Class Setup yet — ask them to do it from "CR Tools → Class Setup".' },
    ],
  },

  {
    num: "08", id: "assignments", route: "/assignments", icon: "FileText", catIdx: CAT.ACADEMICS,
    titleBn: "অ্যাসাইনমেন্ট",
    titleEn: "Assignments",
    descBn: "সব অ্যাসাইনমেন্ট এক জায়গায় — স্ট্যাটাস, প্রায়োরিটি ও ডেডলাইন সহ ট্র্যাক করো।",
    descEn: "Track all your assignments in one place with status, priority, and deadlines.",
    blocksBn: [
      { type: 'text', text: 'প্রতিটা কোর্সের অ্যাসাইনমেন্ট এন্ট্রি দাও — ডেডলাইন, প্রায়োরিটি, স্ট্যাটাস (Pending/Done/Overdue) সহ। ডেডলাইন কাছে এলে বা পার হয়ে গেলে Dashboard-এ অ্যালার্ট দেখাবে।' },
      { type: 'bullet', text: 'কোর্স, শিরোনাম, ডেডলাইন, প্রায়োরিটি সহ এন্ট্রি' },
      { type: 'bullet', text: 'Done হিসেবে মার্ক করা যায়' },
      { type: 'bullet', text: 'Overdue হলে আলাদা করে হাইলাইট হয়' },
    ],
    blocksEn: [
      { type: 'text', text: 'Add assignments per course with deadline, priority, and status (Pending/Done/Overdue). Dashboard alerts you as deadlines approach or pass.' },
      { type: 'bullet', text: 'Entry with course, title, deadline, priority' },
      { type: 'bullet', text: 'Mark as Done' },
      { type: 'bullet', text: 'Overdue items get highlighted separately' },
    ],
  },

  {
    num: "09", id: "syllabus", route: "/syllabus", icon: "List", catIdx: CAT.ACADEMICS,
    titleBn: "সিলেবাস",
    titleEn: "Syllabus",
    descBn: "কোর্সভিত্তিক সিলেবাস — কারিকুলাম ডেটা থেকে অটো-লোড, বিভাগ ও টার্ম অনুযায়ী।",
    descEn: "Course-wise syllabus, auto-loaded from curriculum data by department and term.",
    blocksBn: [
      { type: 'text', text: 'তোমার প্রতিটা কোর্সের বিস্তারিত সিলেবাস (টপিক অনুযায়ী ব্রেকডাউন) এখানে দেখা যায় — Profile-এর বিভাগ/টার্ম অনুযায়ী অটো-লোড হয়।' },
      { type: 'bullet', text: 'কোর্স অনুযায়ী টপিক তালিকা' },
      { type: 'bullet', text: 'Question Bank ও Solution Bank-এর সাথে ক্রস-রেফারেন্স করা যায়' },
    ],
    blocksEn: [
      { type: 'text', text: "See the detailed syllabus (topic breakdown) for each of your courses — auto-loaded based on department/term from Profile." },
      { type: 'bullet', text: 'Topic list per course' },
      { type: 'bullet', text: 'Cross-reference against Question Bank and Solution Bank' },
    ],
  },

  {
    num: "10", id: "question-bank", route: "/question-bank", icon: "BookMarked", catIdx: CAT.ACADEMICS,
    titleBn: "প্রশ্নব্যাংক",
    titleEn: "Question Bank",
    descBn: "KUET-এর আগের পরীক্ষার প্রশ্ন এক জায়গায়, R2 স্টোরেজে রাখা, ডাউনলোডযোগ্য।",
    descEn: "All past KUET exam papers in one place, stored on R2, downloadable.",
    blocksBn: [
      { type: 'text', text: 'কোর্স অনুযায়ী আগের টার্মের প্রশ্ন খুঁজে দেখো ও ডাউনলোড করো। প্রশ্নগুলো Cloudflare R2-তে স্টোর করা, তাই লোড দ্রুত হয়।' },
      { type: 'bullet', text: 'কোর্স, টার্ম, পরীক্ষার ধরন অনুযায়ী ফিল্টার' },
      { type: 'bullet', text: 'ইন-অ্যাপ ভিউয়ারে PDF দেখা যায় (/question-bank/view)' },
      { type: 'bullet', text: 'নতুন প্রশ্ন আপলোডও করা যায় (রিভিউ কিউতে যায়, তারপর পাবলিশ হয়)' },
    ],
    blocksEn: [
      { type: 'text', text: 'Search and download past-term question papers by course. Papers are stored on Cloudflare R2, so loading is fast.' },
      { type: 'bullet', text: 'Filter by course, term, exam type' },
      { type: 'bullet', text: 'View PDFs in the in-app viewer (/question-bank/view)' },
      { type: 'bullet', text: 'You can also upload new papers (goes into a review queue before publishing)' },
    ],
  },

  {
    num: "11", id: "solutions", route: "/solutions", icon: "Lightbulb", catIdx: CAT.ACADEMICS,
    titleBn: "সলিউশন ব্যাংক",
    titleEn: "Solution Bank",
    descBn: "আগের প্রশ্নের ধাপে ধাপে সমাধান — Question Bank-এর সাথে যুক্ত।",
    descEn: "Step-by-step worked solutions to past papers, linked with Question Bank.",
    blocksBn: [
      { type: 'text', text: 'শুধু প্রশ্ন না, ধাপে ধাপে সমাধানও পাওয়া যায় এখানে — যেসব প্রশ্নের সলিউশন আপলোড করা হয়েছে সেগুলোর জন্য।' },
      { type: 'bullet', text: 'কোর্স ও টপিক অনুযায়ী খোঁজো' },
      { type: 'bullet', text: 'প্রতিটা সলিউশন সংশ্লিষ্ট প্রশ্নের সাথে যুক্ত' },
    ],
    blocksEn: [
      { type: 'text', text: "Not just the questions — step-by-step solutions are here too, for papers where a solution has been uploaded." },
      { type: 'bullet', text: 'Search by course and topic' },
      { type: 'bullet', text: 'Each solution links back to its source question' },
    ],
  },

  {
    num: "12", id: "marks", route: "/marks", icon: "ClipboardList", catIdx: CAT.ACADEMICS,
    titleBn: "টার্ম প্ল্যানার (মার্কস)",
    titleEn: "Term Planner (Marks)",
    descBn: "প্রতি কোর্সে CT, কুইজ, অ্যাসাইনমেন্ট নম্বর এন্ট্রি দাও — গ্রেড প্রেডিকশন ও টার্গেট মার্ক ক্যালকুলেটর পাবে।",
    descEn: "Enter your CT, quiz, and assignment marks per course — get grade prediction and a target-mark calculator.",
    blocksBn: [
      { type: 'text', text: 'প্রতিটা কোর্সের নম্বর (CT, কুইজ, অ্যাসাইনমেন্ট) এন্ট্রি দিলে অ্যাপ বর্তমান অবস্থান আর ফাইনালে কত পেলে কোন গ্রেড আসবে তার হিসাব দেখায়। নির্দিষ্ট কোর্সের জন্য সরাসরি /marks/:courseId দিয়েও যাওয়া যায়।' },
      { type: 'bullet', text: 'প্রতি কোর্সে সব ধরনের নম্বর এন্ট্রি' },
      { type: 'bullet', text: 'লাইভ গ্রেড প্রেডিকশন' },
      { type: 'bullet', text: 'টার্গেট গ্রেড পেতে ফাইনালে কত লাগবে তার ক্যালকুলেটর' },
    ],
    blocksEn: [
      { type: 'text', text: "Enter your marks (CT, quizzes, assignments) per course and the app shows your current standing plus what you'd need on the final for each grade. A specific course can be opened directly at /marks/:courseId." },
      { type: 'bullet', text: 'Entry for every mark type, per course' },
      { type: 'bullet', text: 'Live grade prediction' },
      { type: 'bullet', text: 'Calculator for the final marks needed to hit a target grade' },
    ],
  },

  {
    num: "13", id: "results", route: "/results", icon: "TrendingUp", catIdx: CAT.ACADEMICS,
    titleBn: "রেজাল্ট ও CGPA",
    titleEn: "Results & GPA",
    descBn: "সব টার্মের রেজাল্ট এন্ট্রি দাও, লাইভ CGPA দেখো — সাথে গ্র্যাজুয়েশনের ম্যাক্সিমাম সম্ভাব্য CGPA-ও দেখানো হয়।",
    descEn: "Enter results for every term and see live CGPA — including the maximum possible CGPA at graduation.",
    blocksBn: [
      { type: 'text', text: 'টার্ম-বাই-টার্ম GPA এন্ট্রি দিলে অ্যাপ CGPA বের করে দেয়, এবং ৮টা টার্মের কারিকুলাম হিসাব করে গ্র্যাজুয়েশনে ম্যাক্সিমাম কত CGPA সম্ভব সেটাও দেখায় — বর্তমান অবস্থান বনাম ম্যাক্সিমাম সিলিং।' },
      { type: 'bullet', text: 'প্রতি টার্মের GPA এন্ট্রি' },
      { type: 'bullet', text: 'লাইভ ওভারঅল CGPA' },
      { type: 'bullet', text: 'গ্র্যাজুয়েশনে সম্ভাব্য ম্যাক্সিমাম CGPA ব্যানার' },
    ],
    blocksEn: [
      { type: 'text', text: 'Enter GPA term by term and the app computes your CGPA — plus, using the 8-term curriculum, the maximum CGPA still reachable at graduation, shown against your current standing.' },
      { type: 'bullet', text: 'Per-term GPA entry' },
      { type: 'bullet', text: 'Live overall CGPA' },
      { type: 'bullet', text: 'A banner showing max possible CGPA at graduation' },
    ],
  },

  {
    num: "14", id: "alerts", route: "/alerts", icon: "BellRing", catIdx: CAT.ACADEMICS,
    titleBn: "অ্যালার্ট",
    titleEn: "Alerts",
    descBn: "যেসব কোর্সে উপস্থিতি বা নম্বরে নিয়ম ভঙ্গের ঝুঁকি আছে, সেগুলো এক জায়গায় দেখো।",
    descEn: "See every course at risk of an attendance or mark-related rule violation, in one place.",
    blocksBn: [
      { type: 'text', text: 'Attendance ও Marks-এর ডেটা মিলিয়ে অ্যাপ নিজে থেকে বুঝে নেয় কোন কোর্সে ঝুঁকি আছে — এখানে সেগুলো একসাথে দেখা যায়, প্রতিটা কোর্সে আলাদা করে না গিয়ে।' },
      { type: 'bullet', text: 'উপস্থিতি শর্টেজের ঝুঁকিতে থাকা কোর্স' },
      { type: 'bullet', text: 'নম্বরের দিক থেকে খারাপ অবস্থানে থাকা কোর্স' },
    ],
    blocksEn: [
      { type: 'text', text: 'The app cross-references Attendance and Marks data to automatically flag at-risk courses — seen all together here, instead of checking each course separately.' },
      { type: 'bullet', text: 'Courses at risk of attendance shortage' },
      { type: 'bullet', text: 'Courses in a weak marks position' },
    ],
  },

  {
    num: "15", id: "teachers", route: "/teachers", icon: "GraduationCap", catIdx: CAT.ACADEMICS,
    titleBn: "শিক্ষকবৃন্দ",
    titleEn: "Teachers",
    descBn: "ব্যক্তিগত টিচার ডিরেক্টরি — কোর্স ও রুটিনের সাথে যুক্ত।",
    descEn: "A personal teacher directory linked to your courses and schedule.",
    blocksBn: [
      { type: 'text', text: 'প্রতিটা কোর্সের শিক্ষকের তথ্য এখানে সেভ রাখা যায় — নাম, যোগাযোগ ইত্যাদি — যা কোর্স ও রুটিনের সাথে যুক্ত থাকে।' },
      { type: 'bullet', text: 'কোর্স অনুযায়ী শিক্ষকের তথ্য' },
      { type: 'bullet', text: 'রুটিন থেকে সরাসরি লিংক করা' },
    ],
    blocksEn: [
      { type: 'text', text: "Save teacher information per course — name, contact, etc — linked with courses and schedule." },
      { type: 'bullet', text: 'Teacher info per course' },
      { type: 'bullet', text: 'Linked directly from Schedule' },
    ],
  },

  {
    num: "16", id: "classmates", route: "/classmates", icon: "Users2", catIdx: CAT.ACADEMICS,
    titleBn: "ক্লাসমেট",
    titleEn: "Classmates",
    descBn: "একই ক্লাস গ্রুপের সহপাঠীদের তালিকা।",
    descEn: "The list of classmates in your class group.",
    blocksBn: [
      { type: 'text', text: 'CR যে ক্লাস গ্রুপ সেটআপ করেছে, সেই গ্রুপের সব সহপাঠীর তালিকা এখানে দেখা যায়।' },
    ],
    blocksEn: [
      { type: 'text', text: "See everyone in the class group your CR has set up." },
    ],
  },

  {
    num: "17", id: "diary", route: "/diary", icon: "BookOpenCheck", catIdx: CAT.ACADEMICS,
    titleBn: "ক্লাস ডায়েরি",
    titleEn: "Class Diary",
    descBn: "প্রতিদিন ক্লাসে কী পড়ানো হয়েছে তার নোট রাখো।",
    descEn: "Keep notes on what was taught in class each day.",
    blocksBn: [
      { type: 'text', text: 'প্রতিদিন কোন ক্লাসে কী পড়ানো হয়েছে তার সংক্ষিপ্ত নোট এখানে রাখতে পারো — পরে রিভিশনের সময় কাজে লাগে।' },
    ],
    blocksEn: [
      { type: 'text', text: "Keep a quick daily note of what got taught in each class — handy when revising later." },
    ],
  },

  {
    num: "18", id: "clubs", route: "/clubs", icon: "Star", catIdx: CAT.CAMPUS,
    titleBn: "ক্লাব ও অ্যাক্টিভিটিজ",
    titleEn: "Clubs & Activities",
    descBn: "ক্যাম্পাসের ক্লাব ও অ্যাক্টিভিটিজের তথ্য — Campus Life-এর অংশ।",
    descEn: "Campus club and activity information — part of Campus Life.",
    blocksBn: [
      { type: 'text', text: 'KUET-এর বিভিন্ন ক্লাব ও অ্যাক্টিভিটিজ সম্পর্কে তথ্য এখানে পাওয়া যায়।' },
    ],
    blocksEn: [
      { type: 'text', text: "Information about various KUET clubs and activities." },
    ],
  },

  {
    num: "19", id: "projects", route: "/projects", icon: "Cpu", catIdx: CAT.CAMPUS,
    titleBn: "প্রজেক্ট",
    titleEn: "Projects",
    descBn: "একাডেমিক প্রজেক্ট ট্র্যাক করো — Campus Life-এর অংশ।",
    descEn: "Track academic projects — part of Campus Life.",
    blocksBn: [
      { type: 'text', text: 'তোমার একাডেমিক প্রজেক্টগুলো এখানে ট্র্যাক করতে পারো।' },
    ],
    blocksEn: [
      { type: 'text', text: 'Track your academic projects here.' },
    ],
  },

  {
    num: "20", id: "tours", route: "/tours", icon: "MapPin", catIdx: CAT.CAMPUS,
    titleBn: "ট্যুর",
    titleEn: "Tours",
    descBn: "ব্যাচ/ডিপার্টমেন্ট ট্যুর সংক্রান্ত তথ্য — Campus Life-এর অংশ।",
    descEn: "Batch/department tour info — part of Campus Life.",
    blocksBn: [
      { type: 'text', text: 'ব্যাচ বা ডিপার্টমেন্ট ট্যুর সংক্রান্ত তথ্য এখানে পাওয়া যায়।' },
    ],
    blocksEn: [
      { type: 'text', text: 'Batch or department tour-related information.' },
    ],
  },

  {
    num: "21", id: "money", route: "/money", icon: "Wallet", catIdx: CAT.CAMPUS,
    titleBn: "টাকা-পয়সা (Money)",
    titleEn: "Money (Finance)",
    descBn: "আয়-ব্যয় ট্র্যাকার, মাসিক বার চার্ট ও বাজেট অ্যালার্ট সহ।",
    descEn: "Income + expense tracker with monthly bar chart and budget alerts.",
    blocksBn: [
      { type: 'text', text: 'প্রতিদিনের খরচ ও আয় এন্ট্রি দাও, মাসিক চার্টে দেখো কোথায় বেশি খরচ হচ্ছে। বাজেট সেট করলে অ্যাপ সতর্ক করে দেয়।' },
      { type: 'bullet', text: 'ক্যাটাগরি-ভিত্তিক আয়-ব্যয় এন্ট্রি' },
      { type: 'bullet', text: 'মাসিক বার চার্ট' },
      { type: 'bullet', text: 'বাজেট ছাড়িয়ে গেলে অ্যালার্ট' },
    ],
    blocksEn: [
      { type: 'text', text: 'Log daily expenses and income, see a monthly chart of where the money goes. Set a budget and get alerted when you exceed it.' },
      { type: 'bullet', text: 'Category-wise income/expense entries' },
      { type: 'bullet', text: 'Monthly bar chart' },
      { type: 'bullet', text: 'Alert when a budget is exceeded' },
    ],
  },

  {
    num: "22", id: "tuition", route: "/tuition", icon: "UserCog", catIdx: CAT.CAMPUS,
    titleBn: "টিউশন",
    titleEn: "Tuition",
    descBn: "টিউশন ট্র্যাক করো — Campus Life-এর অংশ।",
    descEn: "Track tuition — part of Campus Life.",
    blocksBn: [
      { type: 'text', text: 'নিজের টিউশন সংক্রান্ত তথ্য এখানে ট্র্যাক করতে পারো।' },
    ],
    blocksEn: [
      { type: 'text', text: 'Track your own tuition-related information here.' },
    ],
  },

  {
    num: "23", id: "notes", route: "/notes", icon: "StickyNote", catIdx: CAT.CAMPUS,
    titleBn: "নোটস",
    titleEn: "Notes",
    descBn: "সাধারণ নোট রাখার জায়গা — Campus Life-এর অংশ।",
    descEn: "A general place to jot down notes — part of Campus Life.",
    blocksBn: [
      { type: 'text', text: 'যেকোনো টেক্সট নোট এখানে সেভ করে রাখতে পারো।' },
    ],
    blocksEn: [
      { type: 'text', text: 'Save any text note here.' },
    ],
  },

  {
    num: "24", id: "time", route: "/time", icon: "Timer", catIdx: CAT.CAMPUS,
    titleBn: "টাইম ট্র্যাকার",
    titleEn: "Time Tracker",
    descBn: "পড়াশোনা বা যেকোনো কাজে কত সময় দিচ্ছো তা ট্র্যাক করো।",
    descEn: "Track how much time you're spending on study or any task.",
    blocksBn: [
      { type: 'text', text: 'পড়াশোনা বা যেকোনো অ্যাক্টিভিটিতে কত সময় ব্যয় হচ্ছে তার হিসাব রাখতে সাহায্য করে এই টুল।' },
    ],
    blocksEn: [
      { type: 'text', text: "This tool helps you keep track of time spent studying or on any activity." },
    ],
  },

  {
    num: "25", id: "namaz", route: "/namaz", icon: "Moon", catIdx: CAT.CAMPUS,
    titleBn: "নামাজ ট্র্যাকার",
    titleEn: "Namaz Tracker",
    descBn: "দৈনিক পাঁচ ওয়াক্ত নামাজ ট্র্যাক করো।",
    descEn: "Track your five daily prayers.",
    blocksBn: [
      { type: 'text', text: 'প্রতিদিনের পাঁচ ওয়াক্ত নামাজ পড়া হয়েছে কিনা তা মার্ক করে রাখো — নিয়মিততা দেখা যায় সময়ের সাথে।' },
    ],
    blocksEn: [
      { type: 'text', text: "Mark each of the five daily prayers as they're completed — see consistency over time." },
    ],
  },

  {
    num: "26", id: "self-study", route: "/self-study/academic", icon: "Activity", catIdx: CAT.CAMPUS,
    titleBn: "সেলফ স্টাডি",
    titleEn: "Self Study",
    descBn: "একাডেমিক পড়াশোনা ও ডিপ ফোকাস সেশন আলাদা করে ট্র্যাক করো।",
    descEn: "Track academic study and Deep Focus sessions separately.",
    blocksBn: [
      { type: 'text', text: 'Self Study-র দুটো অংশ আছে: Academic (একাডেমিক পড়াশোনার সময়) এবং Deep Focus (বিরতিহীন মনোযোগী কাজের সেশন)।' },
      { type: 'bullet', text: 'Academic — /self-study/academic' },
      { type: 'bullet', text: 'Deep Focus — /self-study/deep-focus' },
    ],
    blocksEn: [
      { type: 'text', text: 'Self Study has two parts: Academic (time spent on academic study) and Deep Focus (uninterrupted focused work sessions).' },
      { type: 'bullet', text: 'Academic — /self-study/academic' },
      { type: 'bullet', text: 'Deep Focus — /self-study/deep-focus' },
    ],
  },

  {
    num: "27", id: "services", route: "/services", icon: "ShoppingBag", catIdx: CAT.CAMPUS,
    titleBn: "সার্ভিস মার্কেটপ্লেস",
    titleEn: "Services Marketplace",
    descBn: "সেলুন, খাবার, ফার্মেসি, স্টেশনারি, অনলাইন মার্ট — ক্যাম্পাসের আশেপাশের সার্ভিস প্রোভাইডার এক জায়গায়।",
    descEn: "Salon, food, pharmacy, stationery, online mart — campus-adjacent service providers in one place.",
    blocksBn: [
      { type: 'text', text: 'ক্যাম্পাস-সংলগ্ন সার্ভিস প্রোভাইডারদের (দোকান, সেলুন, খাবার ইত্যাদি) খুঁজে বুক করার জায়গা। ক্যাটাগরি অনুযায়ী ব্রাউজ করা যায়।' },
      { type: 'bullet', text: 'ক্যাটাগরি: সেলুন, খাবার, ফার্মেসি, স্টেশনারি, অনলাইন মার্ট' },
      { type: 'bullet', text: 'প্রতিটা শপের বিস্তারিত পেজ আছে (/services/:serviceId)' },
      { type: 'callout', variant: 'info', text: 'গোপনীয়তার কারণে প্রোভাইডারের যোগাযোগ নম্বর তখনই দেখা যায় যখন তোমার কনফার্মড বুকিং থাকে — আগে থেকে দেখানো হয় না।' },
    ],
    blocksEn: [
      { type: 'text', text: 'A place to find and book campus-adjacent service providers (shops, salons, food, etc). Browsable by category.' },
      { type: 'bullet', text: 'Categories: Salon, Food, Pharmacy, Stationery, Online Mart' },
      { type: 'bullet', text: "Each shop has its own detail page (/services/:serviceId)" },
      { type: 'callout', variant: 'info', text: "For privacy, a provider's contact number is only shown once you have a confirmed booking — not before." },
    ],
  },

  {
    num: "28", id: "settings", route: "/settings", icon: "Settings", catIdx: CAT.TOOLS,
    titleBn: "সেটিংস",
    titleEn: "Settings",
    descBn: "থিম, সাইন-ইন/সিঙ্ক, ভাষা এবং ডেটা রিসেট — সব এখানে।",
    descEn: "Theme, sign-in/sync, language, and data reset — all in one place.",
    blocksBn: [
      { type: 'text', text: 'অ্যাপের সব কনফিগারেশন এখানে।' },
      { type: 'bullet', text: 'থিম বদলাও — Light, Milky, Dark' },
      { type: 'bullet', text: 'Google দিয়ে সাইন-ইন করে ক্লাউড সিঙ্ক চালু করো' },
      { type: 'bullet', text: 'স্টোরেজ ব্যবহারের তথ্য দেখো' },
      { type: 'bullet', text: 'সব ডেটা মুছে ফেলার অপশন (একটি কনফার্মেশন ফ্রেজ টাইপ করতে হয়)' },
      { type: 'callout', variant: 'danger', text: '"delete all my data" — এই অপশন স্থায়ী, একবার মুছে ফেললে ফিরিয়ে আনা যায় না, তাই খুব সাবধানে ব্যবহার করো।' },
    ],
    blocksEn: [
      { type: 'text', text: 'Every app-wide configuration lives here.' },
      { type: 'bullet', text: 'Switch theme — Light, Milky, Dark' },
      { type: 'bullet', text: 'Sign in with Google to enable cloud sync' },
      { type: 'bullet', text: 'See storage usage info' },
      { type: 'bullet', text: 'Delete all data option (requires typing a confirmation phrase)' },
      { type: 'callout', variant: 'danger', text: 'The "delete all my data" option is permanent and cannot be undone — use with real caution.' },
    ],
  },

  {
    num: "29", id: "notice", route: "/notice", icon: "Bell", catIdx: CAT.TOOLS,
    titleBn: "নোটিশ",
    titleEn: "Notice",
    descBn: "CR/ফ্যাকাল্টি থেকে আসা ক্লাস অ্যানাউন্সমেন্ট এখানে দেখো।",
    descEn: "See class announcements sent by your CR or faculty.",
    blocksBn: [
      { type: 'text', text: 'তোমার ক্লাস গ্রুপে CR বা ফ্যাকাল্টি যে নোটিশ পাঠায়, তা এখানে টাইমলাইন আকারে দেখা যায়।' },
    ],
    blocksEn: [
      { type: 'text', text: 'Notices sent by your CR or faculty to your class group show up here as a timeline.' },
    ],
  },

  {
    num: "30", id: "reports", route: "/reports", icon: "BarChart2", catIdx: CAT.TOOLS,
    titleBn: "রিপোর্টস",
    titleEn: "Reports",
    descBn: "তোমার একাডেমিক ডেটার সামারি ও পরিসংখ্যান।",
    descEn: "A summary and statistics view of your academic data.",
    blocksBn: [
      { type: 'text', text: 'উপস্থিতি, নম্বর ও অন্যান্য ডেটার একটা সামারি ভিউ এখানে পাওয়া যায়।' },
    ],
    blocksEn: [
      { type: 'text', text: 'A summary view of your attendance, marks, and other tracked data.' },
    ],
  },

  {
    num: "31", id: "about", route: "/about", icon: "Info", catIdx: CAT.TOOLS,
    titleBn: "About KUETx",
    titleEn: "About KUETx",
    descBn: "KUETx কী, কারা বানিয়েছে, এবং KUETx ম্যানিফেস্টো — এই পেজে।",
    descEn: "What KUETx is, who built it, and the KUETx Manifesto — all on this page.",
    blocksBn: [
      { type: 'text', text: 'KUETx-এর মিশন, ফাউন্ডার, টিম এবং পূর্ণাঙ্গ KUETx Manifesto এখান থেকে পড়া যায়।' },
    ],
    blocksEn: [
      { type: 'text', text: "Read about KUETx's mission, founder, team, and the full KUETx Manifesto here." },
    ],
  },

  {
    num: "32", id: "class-setup", route: "/class-setup", icon: "CalendarClock", catIdx: CAT.CR,
    titleBn: "ক্লাস সেটআপ (CR)",
    titleEn: "Class Setup (CR)",
    descBn: "CR হিসেবে প্রথম কাজ — ব্যাচের কোর্স ও রুটিন সেট করা, যাতে পুরো ব্যাচের Schedule ও Courses পেজে অটো-লোড হয়।",
    descEn: "The first thing a CR does — set the batch's courses and routine so it auto-loads on Schedule and Courses for the whole batch.",
    blocksBn: [
      { type: 'text', text: 'একজন CR হিসেবে এটাই প্রথম করতে হবে — নিজের ব্যাচের এই টার্মের কোর্স ও ক্লাস রুটিন সেট করে দাও। একবার সেট হলে, ব্যাচের প্রতিটা শিক্ষার্থীর Schedule ও Courses পেজে অটোমেটিক দেখা যাবে।' },
      { type: 'callout', variant: 'tip', text: 'কারো CR হতে হলে প্রথমে "CR হিসেবে দাবি করো" (Claim CR) প্রক্রিয়া সম্পন্ন করতে হয় — এরপরই Class Rep টুলগুলোর অ্যাক্সেস পাওয়া যায়।' },
    ],
    blocksEn: [
      { type: 'text', text: "This is the first thing a CR should do — set this term's courses and class routine for your batch. Once set, every student in the batch automatically sees it on their Schedule and Courses pages." },
      { type: 'callout', variant: 'tip', text: 'To become a CR, you first need to complete the "Claim CR" process — only then do you get access to the Class Rep tools.' },
    ],
  },

  {
    num: "33", id: "class-routine", route: "/class-routine", icon: "CalendarDays", catIdx: CAT.CR,
    titleBn: "রুটিন ম্যানেজমেন্ট (CR)",
    titleEn: "Routine Management (CR)",
    descBn: "ব্যাচের সাপ্তাহিক ক্লাস রুটিন এডিট করো — সব শিক্ষার্থীর Schedule পেজে সরাসরি প্রভাব ফেলে।",
    descEn: "Edit the batch's weekly class routine — directly affects every student's Schedule page.",
    blocksBn: [
      { type: 'text', text: 'এখানে যেকোনো পরিবর্তন সাথে সাথে পুরো ব্যাচের Schedule পেজে দেখা যাবে, তাই সাবধানে আপডেট করো।' },
    ],
    blocksEn: [
      { type: 'text', text: "Any change here reflects immediately on the whole batch's Schedule page, so update carefully." },
    ],
  },

  {
    num: "34", id: "class-planner", route: "/class-planner", icon: "CalendarCheck", catIdx: CAT.CR,
    titleBn: "ক্লাস প্ল্যানার (CR)",
    titleEn: "Class Planner (CR)",
    descBn: "ব্যাচের জন্য ক্লাস-সম্পর্কিত পরিকল্পনা ও শিডিউল ম্যানেজ করো।",
    descEn: "Manage class-related planning and scheduling for the batch.",
    blocksBn: [
      { type: 'text', text: 'ব্যাচের একাডেমিক পরিকল্পনা সংক্রান্ত কাজ এখান থেকে পরিচালনা করা যায়।' },
    ],
    blocksEn: [
      { type: 'text', text: "Manage academic planning tasks for the batch from here." },
    ],
  },

  {
    num: "35", id: "ct-quiz-planning", route: "/ct-quiz-planning", icon: "CalendarClock", catIdx: CAT.CR,
    titleBn: "CT ও কুইজ প্ল্যানার (CR)",
    titleEn: "CT & Quiz Planner (CR)",
    descBn: "ব্যাচের সব CT ও কুইজের তারিখ এক ক্যালেন্ডারে সমন্বয় করো, যাতে একই দিনে বেশি পরীক্ষা না পড়ে।",
    descEn: "Coordinate all of the batch's CT and quiz dates on one calendar, avoiding clashes on the same day.",
    blocksBn: [
      { type: 'text', text: 'বিভিন্ন কোর্সের CT ও কুইজ একই দিনে পড়ে গেলে সেটা সমন্বয় করাটা CR-এর গুরুত্বপূর্ণ দায়িত্ব — এই টুল সেই কাজ সহজ করে দেয়।' },
    ],
    blocksEn: [
      { type: 'text', text: "Coordinating CT/quiz dates across courses so they don't clash on the same day is a key CR responsibility — this tool makes that easier." },
    ],
  },

  {
    num: "36", id: "class-roster", route: "/class-roster", icon: "Users", catIdx: CAT.CR,
    titleBn: "রোস্টার (CR)",
    titleEn: "Roster (CR)",
    descBn: "ব্যাচের সব শিক্ষার্থীর তালিকা ম্যানেজ করো।",
    descEn: "Manage the full list of students in the batch.",
    blocksBn: [
      { type: 'text', text: 'ব্যাচের শিক্ষার্থী তালিকা দেখা ও পরিচালনা করার জায়গা।' },
    ],
    blocksEn: [
      { type: 'text', text: 'View and manage the batch\'s student list.' },
    ],
  },

  {
    num: "37", id: "class-notices", route: "/class-notices", icon: "Megaphone", catIdx: CAT.CR,
    titleBn: "ক্লাস অ্যানাউন্সমেন্ট (CR)",
    titleEn: "Class Announcements (CR)",
    descBn: "ব্যাচকে নোটিশ পাঠাও — যা তাদের Notice পেজে দেখা যাবে।",
    descEn: "Send notices to the batch — they show up on students' Notice page.",
    blocksBn: [
      { type: 'text', text: 'ব্যাচকে গুরুত্বপূর্ণ তথ্য জানাতে এখান থেকে নোটিশ পাঠাও — সেটা প্রতিটা শিক্ষার্থীর Notice পেজে টাইমলাইনে যোগ হবে।' },
    ],
    blocksEn: [
      { type: 'text', text: "Send notices from here to keep the batch informed — they'll appear on the Notice timeline for every student." },
    ],
  },

  {
    num: "38", id: "class-my-role", route: "/class-my-role", icon: "Shield", catIdx: CAT.CR,
    titleBn: "আমার ভূমিকা (CR)",
    titleEn: "My Role (CR)",
    descBn: "তোমার CR/ACR স্ট্যাটাস ও ব্যাচের তথ্য দেখো।",
    descEn: "See your CR/ACR status and batch information.",
    blocksBn: [
      { type: 'text', text: 'তোমার CR বা ACR ভূমিকা, কোন ব্যাচের জন্য, এবং সংশ্লিষ্ট তথ্য এখানে দেখা যায়।' },
    ],
    blocksEn: [
      { type: 'text', text: 'See your CR or ACR role, which batch it applies to, and related information.' },
    ],
  },
];

// Flatten into GUIDE_SECTIONS shape GuideModal.jsx already reads (title,
// desc, blocks — no lang split at this layer) for the default English
// render, and export the bn/en raw list separately so GuideModal can
// switch between them.
function toLangShape(lang) {
  return RAW_SECTIONS.map(s => ({
    num: s.num,
    id: s.id,
    title: lang === 'bn' ? s.titleBn : s.titleEn,
    route: s.route,
    icon: s.icon,
    category: catFor(lang, s.catIdx),
    desc: lang === 'bn' ? s.descBn : s.descEn,
    blocks: lang === 'bn' ? s.blocksBn : s.blocksEn,
  }));
}

export const GUIDE_SECTIONS_BN = toLangShape('bn');
export const GUIDE_SECTIONS_EN = toLangShape('en');

// Default export kept for anything importing GUIDE_SECTIONS directly —
// GuideModal.jsx uses GUIDE_SECTIONS_BN/EN + the lang toggle instead,
// but this keeps any other consumer from breaking.
export const GUIDE_SECTIONS = GUIDE_SECTIONS_BN;
