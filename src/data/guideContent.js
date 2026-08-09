// Rebuilt to match the current app (App.jsx routes + nav.js), covering
// the real Student, Class Rep (CR), Faculty, Provider, and Team/Admin
// shells that ship in the app today.
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
// marketplace, Class Setup, full Class Rep toolset, plus the separate
// Faculty, Provider, and Team/Admin shells.

export const GUIDE_CATEGORIES_BN = [
  "শুরুর কথা",
  "একাডেমিক্স",
  "ক্যাম্পাস লাইফ",
  "টুলস",
  "ক্লাস রিপ্রেজেন্টেটিভ (CR)",
  "ফ্যাকাল্টি পোর্টাল",
  "সার্ভিস প্রোভাইডার",
  "টিম ও অ্যাডমিন",
];

export const GUIDE_CATEGORIES_EN = [
  "Overview",
  "Academics",
  "Campus Life",
  "Tools",
  "Class Rep (CR)",
  "Faculty Portal",
  "Service Provider",
  "Team & Admin",
];

// Index-matched to *_BN above — GuideModal picks the right array by lang.
export const GUIDE_CATEGORIES = GUIDE_CATEGORIES_EN;

const CAT = {
  OVERVIEW: 0, ACADEMICS: 1, CAMPUS: 2, TOOLS: 3, CR: 4, FACULTY: 5, PROVIDER: 6, STAFF: 7,
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
    num: "00", id: "start-here", route: null, icon: "Sparkles", catIdx: CAT.OVERVIEW,
    titleBn: "শুরুটা কীভাবে",
    titleEn: "Start Here",
    descBn: "অ্যাপে প্রথম ঢুকে কী করবেন, কোন ক্রমে করবেন, আর কেন করবেন — আগে সেটা দেখে নিন।",
    descEn: "See what to do first in the app, in what order, and why — before anything else.",
    blocksBn: [
      { type: 'text', text: 'প্রথমে Google দিয়ে সাইন ইন করুন। তারপর Role Select-এ গিয়ে নিজের ভূমিকা বেছে নিন। এরপর Profile পূরণ করুন। এই তিনটি ধাপ ঠিকমতো না করলে বাকি অনেক ফিচার ঠিকভাবে কাজ করবে না।' },
      { type: 'step', num: 1, text: 'Google দিয়ে সাইন ইন করুন। এতে আপনার ডেটা নিরাপদ থাকে আর পরে অন্য ডিভাইসেও ফিরে পাবেন।' },
      { type: 'step', num: 2, text: 'Role Select-এ যান এবং Student, Faculty Member, বা Service Provider বেছে নিন। এটা একবারই করতে হয়।' },
      { type: 'step', num: 3, text: 'Profile খুলে নিজের তথ্য পূরণ করুন। এর ওপরই কোর্স, রুটিন, আর অনেক personalized অংশ নির্ভর করে।' },
      { type: 'callout', variant: 'info', text: 'উপরে Guide button আছে। কিছু বুঝতে না পারলে আগে গাইড খুলে নিন, তারপর আবার এই পেজে ফিরে আসুন।' },
    ],
    blocksEn: [
      { type: 'text', text: 'First sign in with Google. Then go to Role Select and choose your role. After that, fill in your Profile. If these three steps are not done properly, many other features will not work as expected.' },
      { type: 'step', num: 1, text: 'Sign in with Google. This keeps your data safe and lets you get it back on another device later.' },
      { type: 'step', num: 2, text: 'Open Role Select and choose Student, Faculty Member, or Service Provider. You only do this once.' },
      { type: 'step', num: 3, text: 'Open Profile and fill in your details. Courses, schedule, and many personalized parts depend on it.' },
      { type: 'callout', variant: 'info', text: 'There is a Guide button above. If anything is unclear, open the guide first, then come back here.' },
    ],
  },

  {
    num: "01", id: "why", route: null, icon: "Sparkles", catIdx: CAT.OVERVIEW,
    titleBn: "কেন KUETx ব্যবহার করবেন?",
    titleEn: "Why Use KUETx?",
    descBn: "KUETx সাধারণ কোনো স্টুডেন্ট অ্যাপ নয়। KUET-এর পরীক্ষা, উপস্থিতি, নম্বরের হিসাব আর ক্যাম্পাস জীবনের কথা ভেবেই প্রতিটি ফিচার বানানো হয়েছে।",
    descEn: "KUETx is not a generic student tool. Every feature is designed around KUET's actual exam system, attendance rules, mark calculation formula, and campus life.",
    blocksBn: [
      { type: 'text', text: 'KUETx সাধারণ কোনো স্টুডেন্ট টুল নয়। KUET-এর পরীক্ষা পদ্ধতি, উপস্থিতির নিয়ম, নম্বরের হিসাব আর ক্যাম্পাস জীবনের কথা ভেবেই প্রতিটি ফিচার বানানো হয়েছে।' },
      { type: 'table', headers: ['KUETx ছাড়া', 'KUETx দিয়ে'], rows: [
        ['কাগজে হাতে-গোনা উপস্থিতি', 'প্রতিটি কোর্সে, প্রতিদিনের জন্য অটো ট্র্যাকিং আর রঙভিত্তিক সতর্কতা'],
        ['মাথায় মাথায় CGPA আন্দাজ', 'প্রতিটি নম্বর ও রেজাল্ট থেকে লাইভ CGPA'],
        ['অ্যাসাইনমেন্টের সময় ভুলে যাওয়া', 'Dashboard-এ স্ট্যাটাস, অগ্রাধিকার আর দেরির সতর্কতা সহ এক জায়গার ট্র্যাকার'],
        ['মার্ক রাখার জন্য আলাদা স্প্রেডশিট', 'গ্রেডের ধারণা আর টার্গেট মার্ক ক্যালকুলেটরসহ প্রতি কোর্সের হিসাব'],
        ['KUET-এর নিয়ম না জানা', 'নিয়মের বাইরে গেলে অ্যাপ নিজেই সতর্ক করে'],
        ['পুরনো প্রশ্ন হারিয়ে ফেলা', 'প্রশ্নব্যাংক - সব পুরনো প্রশ্ন এক জায়গায়, ডাউনলোডও করা যায়'],
        ['ডিভাইস বদলালে ব্যাকআপ না থাকা', 'সাইন ইন করলে Firebase-এ রিয়েল-টাইম সিঙ্ক'],
        ['নামাজ আর অভ্যাস আলাদা রাখা', 'নামাজ ট্র্যাকার আর অভ্যাসের হিসাব এক জায়গায়'],
        ['খাতায় টাকার হিসাব রাখা', 'মাসিক চার্টসহ আয়-ব্যয়ের ট্র্যাকার'],
        ['উপস্থিতির হিসাব না জানা', 'প্রতিটি শিক্ষকের জন্য KUET স্ল্যাব ফর্মুলা অনুযায়ী অটো হিসাব'],
        ['ধাপে ধাপে সমাধান না পাওয়া', 'সলিউশন ব্যাংক - আগের প্রশ্নের বিস্তারিত সমাধান'],
        ['শিক্ষকের যোগাযোগ হারিয়ে ফেলা', 'কোর্স আর রুটিনের সাথে যুক্ত টিচার ডিরেক্টরি'],
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
        ['Tracking prayers and habits separately', 'Namaz tracker + daily habit tracking in one place'],
        ['Managing money in a notebook', 'Income + expense tracker with monthly chart'],
        ['Not knowing your attendance marks', 'Auto-calculated per KUET slab formula for each teacher'],
        ['No step-by-step exam solutions', 'Solution Bank — detailed worked solutions to past papers'],
        ['Missing teacher contact info', 'Personal teacher directory linked to courses and schedule'],
      ]},
    ],
  },

  {
    num: "02", id: "getting-started", route: null, icon: "Rocket", catIdx: CAT.OVERVIEW,
    titleBn: "শুরু করবেন কীভাবে",
    titleEn: "Getting Started",
    descBn: "www.kuetx.com-এ যান। আপনি Dashboard-এ পৌঁছে যাবেন। প্রথমে বেশিরভাগ কার্ড খালি থাকবে - এটাই স্বাভাবিক।",
    descEn: "Go to www.kuetx.com. You land on the Dashboard. Most cards will be empty at first — that is normal.",
    blocksBn: [
      { type: 'subhead', text: 'প্রথমবার অ্যাপ খুললে কী দেখবেন' },
      { type: 'text', text: 'www.kuetx.com-এ যান। Dashboard-এ পৌঁছে যাবেন। বেশিরভাগ কার্ড খালি বা শূন্য দেখাবে - এটা স্বাভাবিক। উপরে "Complete Your Profile" ব্যানারও দেখা যেতে পারে। প্রথমবার লোড হওয়ার পর অ্যাপ অফলাইনেও কাজ করবে।' },
      { type: 'callout', variant: 'tip', text: 'আগে ইনস্টল করে নিন। Android-এ: Chrome মেনু → Add to Home Screen। iPhone-এ: Safari Share → Add to Home Screen। ডেস্কটপে: অ্যাড্রেস বারের ইনস্টল আইকনে ক্লিক করুন। PWA ভার্সন দ্রুত চলে এবং ব্রাউজার ট্যাব ছাড়াই কাজ করে।' },
      { type: 'subhead', text: 'সেটআপের ক্রম' },
      { type: 'text', text: 'প্রথম দিন এই ক্রমে কাজ করুন। প্রতিটি ধাপের সাথে পরের ধাপের সম্পর্ক আছে।' },
      { type: 'step', num: 1, text: 'Profile খুলুন → পেন্সিল আইকনে ট্যাপ করুন → নাম, স্টুডেন্ট আইডি, বিভাগ, বছর/টার্ম, ভর্তির বছর লিখুন। তারপর Save করুন।' },
      { type: 'step', num: 2, text: 'Courses-এ গিয়ে এই টার্মের কোর্সগুলো দেখুন। আপনার বিভাগ ও ব্যাচ অনুযায়ী এগুলো কারিকুলাম থেকে অটো লোড হয়।' },
      { type: 'step', num: 3, text: 'Schedule-এ গিয়ে ক্লাস রুটিন ঠিক আছে কিনা দেখুন। CR যদি Class Setup করে থাকে, রুটিন অটো লোড হবে।' },
      { type: 'step', num: 4, text: 'Attendance-এ প্রতিটি কোর্সের বর্তমান উপস্থিতি (held/attended) লিখুন, যাতে শুরু থেকেই সঠিক হিসাব থাকে।' },
      { type: 'step', num: 5, text: 'সবশেষে Settings-এ গিয়ে Google দিয়ে সাইন ইন করুন। এতে ডিভাইস বদলালেও ডেটা হারাবে না, ক্লাউডে সিঙ্ক থাকবে।' },
      { type: 'callout', variant: 'info', text: 'সাইন ইন না করলেও অ্যাপ পুরোপুরি চলে। তখন ডেটা শুধু এই ডিভাইসেই থাকে। সাইন ইন করলে সেটা Firebase-এ সিঙ্ক হয়, আর নতুন ডিভাইসেও ফিরে পান।' },
    ],
    blocksEn: [
      { type: 'subhead', text: 'What You See When You First Open the App' },
      { type: 'text', text: 'Go to www.kuetx.com. You land on the Dashboard. Most cards will be empty or show zero — that is normal. A "Complete Your Profile" banner may appear at the top. The app is already working offline after this first load.' },
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
    num: "03", id: "dashboard", route: "/", icon: "Grid", catIdx: CAT.OVERVIEW,
    titleBn: "ড্যাশবোর্ড",
    titleEn: "Dashboard",
    descBn: "লগইন করার পর প্রথমে যা দেখবেন - আজকের ক্লাস, উপস্থিতির অবস্থা, পেন্ডিং অ্যাসাইনমেন্ট আর নোটিশ, সব একসাথে।",
    descEn: "The first thing you see on login — today's classes, attendance status, pending assignments, and notices all in one place.",
    blocksBn: [
      { type: 'text', text: 'Dashboard আপনার হোম পেজ। এখান থেকে এক নজরে আজকের ক্লাস, কোন কোর্সে উপস্থিতি কম, কোন অ্যাসাইনমেন্টের সময় কাছাকাছি, আর নতুন কোনো নোটিশ এসেছে কি না দেখা যায়।' },
      { type: 'bullet', text: 'আজকের ক্লাস রুটিন কার্ড - Schedule থেকে অটো টানা' },
      { type: 'bullet', text: 'উপস্থিতির সারাংশ - ঝুঁকিতে থাকা কোর্সগুলো লাল বা হলুদে দেখায়' },
      { type: 'bullet', text: 'পেন্ডিং/ওভারডিউ অ্যাসাইনমেন্ট তালিকা' },
      { type: 'bullet', text: 'সাম্প্রতিক নোটিশ (ক্লাস অ্যানাউন্সমেন্ট)' },
      { type: 'callout', variant: 'tip', text: 'প্রোফাইল সম্পূর্ণ না থাকলে উপরে একটি ব্যানার দেখাবে। এটা বন্ধ করতে Profile পূরণ করুন।' },
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
    num: "04", id: "today", route: "/today", icon: "Sunrise", catIdx: CAT.OVERVIEW,
    titleBn: "আজকের দিন (Today)",
    titleEn: "Today",
    descBn: "আজকের সব কিছু এক জায়গায় - ক্লাস, অ্যাসাইনমেন্ট, নামাজের সময় আর নোটিশ।",
    descEn: "Everything about today in one focused page — classes, assignments, prayer times, and notices.",
    blocksBn: [
      { type: 'text', text: 'Today পেজটা Dashboard-এর মতোই, তবে শুধু আজকের দিনের ওপর ফোকাস করে। সকালে একবার খুললেই পুরো দিনের পরিকল্পনা বুঝে নিতে পারবেন।' },
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
    num: "05", id: "profile", route: "/profile", icon: "User", catIdx: CAT.OVERVIEW,
    titleBn: "প্রোফাইল",
    titleEn: "Profile",
    descBn: "নাম, স্টুডেন্ট আইডি, বিভাগ আর ব্যাচ - এগুলোর ওপরই কোর্স, রুটিন, প্রশ্নব্যাংকসহ বাকি ফিচারগুলো নির্ভর করে। এখান থেকেই Google সাইন ইন করা যায়।",
    descEn: "Your name, student ID, department, batch — the rest of the app (courses, schedule, question bank) is built on this. Google sign-in also lives here.",
    blocksBn: [
      { type: 'text', text: 'Profile হলো ভিত্তি। এখানকার তথ্য অনুযায়ী আপনার কারিকুলাম, কোর্স তালিকা আর প্রশ্নব্যাংক ফিল্টার হয়। ভুল বিভাগ বা ব্যাচ দিলে ভুল কোর্স দেখাবে, তাই শুরুতেই সঠিকভাবে পূরণ করুন।' },
      { type: 'bullet', text: 'নাম, স্টুডেন্ট আইডি, বিভাগ, বর্তমান ইয়ার/টার্ম, ভর্তির বছর' },
      { type: 'bullet', text: 'প্রোফাইল ছবি আপলোড' },
      { type: 'bullet', text: 'Google দিয়ে সাইন ইন/সিঙ্ক - এখান থেকেও করা যায়, Settings থেকেও করা যায়' },
      { type: 'callout', variant: 'warning', text: 'বিভাগ ও ব্যাচ পরে বদলানো গেলেও, একবার সেট করার পর কোর্স ও রুটিনের ডেটা সেই অনুযায়ী রিফ্রেশ হয়। তাই শুরুতেই ঠিকভাবে দিন।' },
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
    descBn: "আপনার বিভাগ আর টার্ম অনুযায়ী এই সেমিস্টারের কোর্সগুলো কারিকুলাম ডেটা থেকে অটো লোড হয়।",
    descEn: "This term's courses auto-load based on your department and term, pulled from the curriculum data.",
    blocksBn: [
      { type: 'text', text: 'Profile-এ বিভাগ ও টার্ম ঠিক দিলে Courses পেজে এই সেমিস্টারের কোর্সগুলো (কোড, নাম, ক্রেডিট) নিজে থেকেই চলে আসে। হাতে কিছু লিখতে হয় না।' },
      { type: 'bullet', text: 'কোর্স কোড, নাম, ক্রেডিট আওয়ার' },
      { type: 'bullet', text: 'প্রতিটি কোর্স Attendance, Marks, Syllabus, Teachers পেজের সাথে যুক্ত থাকে' },
      { type: 'callout', variant: 'info', text: 'কোর্স তালিকা ভুল দেখালে Profile-এ গিয়ে বিভাগ ও টার্ম ঠিক আছে কিনা দেখুন, বা CR-কে জিজ্ঞেস করুন Class Setup ঠিকমতো হয়েছে কি না।' },
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
    descBn: "প্রতিটি কোর্সের held আর attended লিখুন - অ্যাপ KUET-এর স্ল্যাব ফর্মুলা দিয়ে নম্বর আর আর কত ক্লাস মিস করা যাবে তা বের করে।",
    descEn: "Enter held/attended for each course — the app calculates your slab-based marks and how many more classes you can safely miss, using KUET's formula.",
    blocksBn: [
      { type: 'text', text: 'প্রতিটি কোর্সের জন্য কত ক্লাস হয়েছে (held) আর কতটায় আপনি উপস্থিত ছিলেন (attended) তা লিখুন। অ্যাপ KUET-এর স্ল্যাব অনুযায়ী (৯০%+, ৭৫-৮৯%, ৬০-৭৪%, ৬০%-এর নিচে) আপনার নম্বর আর রঙভিত্তিক অবস্থা দেখায়।' },
      { type: 'bullet', text: 'প্রতি কোর্সে held/attended এন্ট্রি এবং শতাংশ' },
      { type: 'bullet', text: 'স্ল্যাব অনুযায়ী অটো-ক্যালকুলেটেড উপস্থিতি নম্বর' },
      { type: 'bullet', text: 'পরের স্ল্যাবে নামার আগে আর কত ক্লাস মিস করা যাবে তার হিসাব' },
      { type: 'bullet', text: 'পেজের নিচে সব স্ল্যাবের রেফারেন্স টেবিল আছে' },
      { type: 'callout', variant: 'warning', text: '৬০%-এর নিচে নামলে উপস্থিতির নম্বর শূন্য হয়ে যায়। অ্যাপ সেটা লাল রঙে সতর্ক করে দেখায়।' },
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
    descBn: "সাপ্তাহিক ক্লাস রুটিন - CR যদি Class Setup করে থাকে, তাহলে পুরো ব্যাচের জন্য অটো লোড হয়।",
    descEn: "Your weekly class routine — auto-loaded for the whole batch once your CR completes Class Setup.",
    blocksBn: [
      { type: 'text', text: 'CR একবার Class Setup পেজে গিয়ে ব্যাচের রুটিন সেট করে দিলে, সেই ব্যাচের প্রতিটি শিক্ষার্থীর Schedule পেজে সেটা অটোমেটিক দেখা যায়। আলাদা করে কিছু করতে হয় না।' },
      { type: 'bullet', text: 'দিন অনুযায়ী ক্লাসের সময়, কোর্স ও রুম' },
      { type: 'bullet', text: 'Dashboard ও Today পেজেও একই রুটিন থেকে ডেটা টানা হয়' },
      { type: 'callout', variant: 'info', text: 'রুটিন খালি দেখালে বুঝবেন CR এখনো Class Setup শেষ করেনি। তাদের বলুন "CR Tools → Class Setup" থেকে সেটআপ করে দিতে।' },
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
    descBn: "সব অ্যাসাইনমেন্ট এক জায়গায় - স্ট্যাটাস, অগ্রাধিকার আর ডেডলাইনসহ ট্র্যাক করুন।",
    descEn: "Track all your assignments in one place with status, priority, and deadlines.",
    blocksBn: [
      { type: 'text', text: 'প্রতিটি কোর্সের অ্যাসাইনমেন্ট লিখুন। ডেডলাইন, অগ্রাধিকার আর স্ট্যাটাস (Pending/Done/Overdue) রাখতে পারবেন। ডেডলাইন কাছে এলে বা পেরিয়ে গেলে Dashboard-এ সতর্কতা দেখাবে।' },
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
    descBn: "কোর্সভিত্তিক সিলেবাস - বিভাগ ও টার্ম অনুযায়ী কারিকুলাম ডেটা থেকে অটো লোড হয়।",
    descEn: "Course-wise syllabus, auto-loaded from curriculum data by department and term.",
    blocksBn: [
      { type: 'text', text: 'আপনার প্রতিটি কোর্সের বিস্তারিত সিলেবাস (টপিকভিত্তিক ব্রেকডাউন) এখানে দেখা যায়। Profile-এর বিভাগ ও টার্ম অনুযায়ী এগুলো অটো লোড হয়।' },
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
    descBn: "KUET-এর আগের পরীক্ষার প্রশ্ন এক জায়গায় রাখা আছে, R2 স্টোরেজে এবং ডাউনলোডযোগ্য।",
    descEn: "All past KUET exam papers in one place, stored on R2, downloadable.",
    blocksBn: [
      { type: 'text', text: 'কোর্স অনুযায়ী আগের টার্মের প্রশ্ন খুঁজে দেখুন আর ডাউনলোড করুন। প্রশ্নগুলো Cloudflare R2-তে রাখা, তাই দ্রুত লোড হয়।' },
      { type: 'bullet', text: 'কোর্স, টার্ম, পরীক্ষার ধরন অনুযায়ী ফিল্টার' },
      { type: 'bullet', text: 'ইন-অ্যাপ ভিউয়ারে PDF দেখা যায় (/question-bank/view)' },
      { type: 'bullet', text: 'নতুন প্রশ্ন আপলোডও করা যায় (আগে পর্যালোচনা কিউতে যায়, তারপর পাবলিশ হয়)' },
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
      { type: 'text', text: 'এখানে শুধু প্রশ্ন নয়, ধাপে ধাপে সমাধানও পাওয়া যায়। যেসব প্রশ্নের সলিউশন আপলোড করা হয়েছে, সেগুলোর জন্য এটা কাজ করে।' },
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
    descBn: "প্রতি কোর্সে CT, কুইজ, অ্যাসাইনমেন্টের নম্বর লিখুন - গ্রেডের ধারণা আর টার্গেট মার্ক ক্যালকুলেটর পাবেন।",
    descEn: "Enter your CT, quiz, and assignment marks per course — get grade prediction and a target-mark calculator.",
    blocksBn: [
      { type: 'text', text: 'প্রতিটি কোর্সের নম্বর (CT, কুইজ, অ্যাসাইনমেন্ট) লিখলে অ্যাপ আপনার বর্তমান অবস্থা আর ফাইনালে কত পেলে কোন গ্রেড আসতে পারে তা দেখায়। নির্দিষ্ট কোর্সের জন্য সরাসরি /marks/:courseId-ও খোলা যায়।' },
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
    descBn: "সব টার্মের রেজাল্ট লিখুন, লাইভ CGPA দেখুন - গ্র্যাজুয়েশনে সর্বোচ্চ কত CGPA সম্ভব তাও দেখা যায়।",
    descEn: "Enter results for every term and see live CGPA — including the maximum possible CGPA at graduation.",
    blocksBn: [
      { type: 'text', text: 'টার্ম ধরে GPA লিখলে অ্যাপ CGPA বের করে দেয়। ৮ টার্মের কারিকুলাম ধরে গ্র্যাজুয়েশনে সর্বোচ্চ কত CGPA সম্ভব, সেটাও দেখায়।' },
      { type: 'bullet', text: 'প্রতি টার্মের GPA এন্ট্রি' },
      { type: 'bullet', text: 'লাইভ ওভারঅল CGPA' },
      { type: 'bullet', text: 'গ্র্যাজুয়েশনে সম্ভাব্য সর্বোচ্চ CGPA ব্যানার' },
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
    descBn: "যেসব কোর্সে উপস্থিতি বা নম্বরে নিয়ম ভাঙার ঝুঁকি আছে, সেগুলো এক জায়গায় দেখুন।",
    descEn: "See every course at risk of an attendance or mark-related rule violation, in one place.",
    blocksBn: [
      { type: 'text', text: 'Attendance আর Marks-এর ডেটা মিলিয়ে অ্যাপ নিজে থেকেই বুঝে নেয় কোন কোর্সে ঝুঁকি আছে। এখানে সব একসাথে দেখা যায়, আলাদা আলাদা করে দেখতে হয় না।' },
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
    descBn: "নিজের টিচার ডিরেক্টরি - কোর্স আর রুটিনের সাথে যুক্ত।",
    descEn: "A personal teacher directory linked to your courses and schedule.",
    blocksBn: [
      { type: 'text', text: 'প্রতিটি কোর্সের শিক্ষকের তথ্য এখানে সেভ রাখা যায় - নাম, যোগাযোগ ইত্যাদি। এগুলো কোর্স আর রুটিনের সাথে যুক্ত থাকে।' },
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
    descBn: "প্রতিদিন ক্লাসে কী পড়ানো হয়েছে, তার নোট রাখুন।",
    descEn: "Keep notes on what was taught in class each day.",
    blocksBn: [
      { type: 'text', text: 'প্রতিদিন কোন ক্লাসে কী পড়ানো হয়েছে, তার ছোট নোট এখানে রাখতে পারেন। পরে রিভিশনের সময় কাজে লাগে।' },
    ],
    blocksEn: [
      { type: 'text', text: "Keep a quick daily note of what got taught in each class — handy when revising later." },
    ],
  },

  {
    num: "18", id: "clubs", route: "/clubs", icon: "Star", catIdx: CAT.CAMPUS,
    titleBn: "ক্লাব ও অ্যাক্টিভিটিজ",
    titleEn: "Clubs & Activities",
    descBn: "ক্যাম্পাসের ক্লাব ও অ্যাক্টিভিটিজের তথ্য - Campus Life-এর অংশ।",
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
    descBn: "একাডেমিক প্রজেক্ট ট্র্যাক করুন - Campus Life-এর অংশ।",
    descEn: "Track academic projects — part of Campus Life.",
    blocksBn: [
      { type: 'text', text: 'আপনার একাডেমিক প্রজেক্টগুলো এখানে ট্র্যাক করতে পারবেন।' },
    ],
    blocksEn: [
      { type: 'text', text: 'Track your academic projects here.' },
    ],
  },

  {
    num: "20", id: "tours", route: "/tours", icon: "MapPin", catIdx: CAT.CAMPUS,
    titleBn: "ট্যুর",
    titleEn: "Tours",
    descBn: "ব্যাচ বা ডিপার্টমেন্ট ট্যুরের তথ্য - Campus Life-এর অংশ।",
    descEn: "Batch/department tour info — part of Campus Life.",
    blocksBn: [
      { type: 'text', text: 'ব্যাচ বা ডিপার্টমেন্ট ট্যুরের তথ্য এখানে পাওয়া যায়।' },
    ],
    blocksEn: [
      { type: 'text', text: 'Batch or department tour-related information.' },
    ],
  },

  {
    num: "21", id: "money", route: "/money", icon: "Wallet", catIdx: CAT.CAMPUS,
    titleBn: "টাকা-পয়সা (Money)",
    titleEn: "Money (Finance)",
    descBn: "আয়-ব্যয় ট্র্যাকার, মাসিক বার চার্ট আর বাজেট সতর্কতা সহ।",
    descEn: "Income + expense tracker with monthly bar chart and budget alerts.",
    blocksBn: [
      { type: 'text', text: 'প্রতিদিনের খরচ ও আয় লিখুন, তারপর মাসিক চার্টে দেখুন কোথায় বেশি খরচ হচ্ছে। বাজেট সেট করলে অ্যাপ সতর্ক করে।' },
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
    descBn: "টিউশন ট্র্যাক করুন - Campus Life-এর অংশ।",
    descEn: "Track tuition — part of Campus Life.",
    blocksBn: [
      { type: 'text', text: 'নিজের টিউশন সংক্রান্ত তথ্য এখানে ট্র্যাক করতে পারবেন।' },
    ],
    blocksEn: [
      { type: 'text', text: 'Track your own tuition-related information here.' },
    ],
  },

  {
    num: "23", id: "notes", route: "/notes", icon: "StickyNote", catIdx: CAT.CAMPUS,
    titleBn: "নোটস",
    titleEn: "Notes",
    descBn: "সাধারণ নোট রাখার জায়গা - Campus Life-এর অংশ।",
    descEn: "A general place to jot down notes — part of Campus Life.",
    blocksBn: [
      { type: 'text', text: 'যেকোনো টেক্সট নোট এখানে সেভ করে রাখতে পারেন।' },
    ],
    blocksEn: [
      { type: 'text', text: 'Save any text note here.' },
    ],
  },

  {
    num: "24", id: "time", route: "/time", icon: "Timer", catIdx: CAT.CAMPUS,
    titleBn: "টাইম ট্র্যাকার",
    titleEn: "Time Tracker",
    descBn: "পড়াশোনা বা অন্য যেকোনো কাজে কত সময় দিচ্ছেন, তা ট্র্যাক করুন।",
    descEn: "Track how much time you're spending on study or any task.",
    blocksBn: [
      { type: 'text', text: 'পড়াশোনা বা যেকোনো কাজে কত সময় যাচ্ছে, তার হিসাব রাখতে এই টুল সাহায্য করে।' },
    ],
    blocksEn: [
      { type: 'text', text: "This tool helps you keep track of time spent studying or on any activity." },
    ],
  },

  {
    num: "25", id: "namaz", route: "/namaz", icon: "Moon", catIdx: CAT.CAMPUS,
    titleBn: "নামাজ ট্র্যাকার",
    titleEn: "Namaz Tracker",
    descBn: "দৈনিক পাঁচ ওয়াক্ত নামাজ ট্র্যাক করুন।",
    descEn: "Track your five daily prayers.",
    blocksBn: [
      { type: 'text', text: 'প্রতিদিনের পাঁচ ওয়াক্ত নামাজ পড়া হয়েছে কি না, তা মার্ক করে রাখতে পারেন। সময়ের সাথে নিয়মিততা দেখা যাবে।' },
    ],
    blocksEn: [
      { type: 'text', text: "Mark each of the five daily prayers as they're completed — see consistency over time." },
    ],
  },

  {
    num: "26", id: "self-study", route: "/self-study/academic", icon: "Activity", catIdx: CAT.CAMPUS,
    titleBn: "সেলফ স্টাডি",
    titleEn: "Self Study",
    descBn: "একাডেমিক পড়াশোনা আর ডিপ ফোকাস সেশন আলাদা করে ট্র্যাক করুন।",
    descEn: "Track academic study and Deep Focus sessions separately.",
    blocksBn: [
      { type: 'text', text: 'Self Study-এর দুটো অংশ আছে: Academic - একাডেমিক পড়াশোনার সময়, আর Deep Focus - বিরতিহীন মনোযোগী কাজের সেশন।' },
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
    descBn: "সেলুন, খাবার, ফার্মেসি, স্টেশনারি, অনলাইন মার্ট - ক্যাম্পাসের আশেপাশের সার্ভিস এক জায়গায়।",
    descEn: "Salon, food, pharmacy, stationery, online mart — campus-adjacent service providers in one place.",
    blocksBn: [
      { type: 'text', text: 'ক্যাম্পাসের আশেপাশের সার্ভিস প্রোভাইডারদের (দোকান, সেলুন, খাবার ইত্যাদি) খুঁজে বুক করার জায়গা। ক্যাটাগরি অনুযায়ী ব্রাউজ করা যায়।' },
      { type: 'bullet', text: 'ক্যাটাগরি: সেলুন, খাবার, ফার্মেসি, স্টেশনারি, অনলাইন মার্ট' },
      { type: 'bullet', text: 'প্রতিটা শপের বিস্তারিত পেজ আছে (/services/:serviceId)' },
      { type: 'callout', variant: 'info', text: 'গোপনীয়তার কারণে প্রোভাইডারের যোগাযোগ নম্বর তখনই দেখা যায়, যখন আপনার নিশ্চিত বুকিং থাকে। আগে থেকে দেখানো হয় না।' },
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
    descBn: "থিম, সাইন ইন/সিঙ্ক, ভাষা আর ডেটা রিসেট - সব এখানে।",
    descEn: "Theme, sign-in/sync, language, and data reset — all in one place.",
    blocksBn: [
      { type: 'text', text: 'অ্যাপের সব সেটিংস এখানে আছে।' },
      { type: 'bullet', text: 'থিম বদলান - Light, Milky, Dark' },
      { type: 'bullet', text: 'Google দিয়ে সাইন ইন করে ক্লাউড সিঙ্ক চালু করুন' },
      { type: 'bullet', text: 'স্টোরেজ ব্যবহার কতটা হচ্ছে, তা দেখুন' },
      { type: 'bullet', text: 'সব ডেটা মুছে ফেলার অপশন আছে (একটি নিশ্চিতকরণ বাক্য লিখতে হয়)' },
      { type: 'callout', variant: 'danger', text: '"delete all my data" অপশনটি স্থায়ী। একবার মুছে ফেললে আর ফেরত আনা যায় না, তাই খুব সাবধানে ব্যবহার করুন।' },
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
    descBn: "CR বা ফ্যাকাল্টি থেকে আসা ক্লাসের নোটিশ এখানে দেখুন।",
    descEn: "See class announcements sent by your CR or faculty.",
    blocksBn: [
      { type: 'text', text: 'আপনার ক্লাস গ্রুপে CR বা ফ্যাকাল্টি যে নোটিশ পাঠায়, তা এখানে টাইমলাইন আকারে দেখা যায়।' },
    ],
    blocksEn: [
      { type: 'text', text: 'Notices sent by your CR or faculty to your class group show up here as a timeline.' },
    ],
  },

  {
    num: "30", id: "reports", route: "/reports", icon: "BarChart2", catIdx: CAT.TOOLS,
    titleBn: "রিপোর্টস",
    titleEn: "Reports",
    descBn: "আপনার একাডেমিক ডেটার সারাংশ ও পরিসংখ্যান।",
    descEn: "A summary and statistics view of your academic data.",
    blocksBn: [
      { type: 'text', text: 'উপস্থিতি, নম্বর আর অন্যান্য ডেটার একটা সারাংশ এখানে পাওয়া যায়।' },
    ],
    blocksEn: [
      { type: 'text', text: 'A summary view of your attendance, marks, and other tracked data.' },
    ],
  },

  {
    num: "31", id: "about", route: "/about", icon: "Info", catIdx: CAT.TOOLS,
    titleBn: "About KUETx",
    titleEn: "About KUETx",
    descBn: "KUETx কী, কারা বানিয়েছেন, আর KUETx ম্যানিফেস্টো - এই পেজে।",
    descEn: "What KUETx is, who built it, and the KUETx Manifesto — all on this page.",
    blocksBn: [
      { type: 'text', text: 'KUETx-এর উদ্দেশ্য, ফাউন্ডার, টিম আর পুরো KUETx Manifesto এখান থেকে পড়া যায়।' },
    ],
    blocksEn: [
      { type: 'text', text: "Read about KUETx's mission, founder, team, and the full KUETx Manifesto here." },
    ],
  },

  {
    num: "32", id: "class-setup", route: "/class-setup", icon: "CalendarClock", catIdx: CAT.CR,
    titleBn: "ক্লাস সেটআপ (CR)",
    titleEn: "Class Setup (CR)",
    descBn: "CR হিসেবে প্রথম কাজ - ব্যাচের কোর্স আর রুটিন সেট করা, যাতে পুরো ব্যাচের Schedule ও Courses পেজে অটো লোড হয়।",
    descEn: "The first thing a CR does — set the batch's courses and routine so it auto-loads on Schedule and Courses for the whole batch.",
    blocksBn: [
      { type: 'text', text: 'CR হিসেবে প্রথমে নিজের ব্যাচের এই টার্মের কোর্স আর ক্লাস রুটিন সেট করতে হবে। একবার সেট হলে, ব্যাচের প্রতিটি শিক্ষার্থীর Schedule ও Courses পেজে সেটা দেখা যাবে।' },
      { type: 'callout', variant: 'tip', text: 'CR হতে হলে আগে "CR হিসেবে দাবি করুন" (Claim CR) প্রক্রিয়া শেষ করতে হয়। তারপরই Class Rep টুলগুলো ব্যবহার করা যায়।' },
    ],
    blocksEn: [
      { type: 'text', text: "This is the first thing a CR should do — set this term's courses and class routine for your batch. Once set, every student in the batch automatically sees it on their Schedule and Courses pages." },
      { type: 'callout', variant: 'tip', text: 'To become a CR, you first need to complete the "Claim CR" process — only then do you get access to the Class Rep tools.' },
    ],
  },

  {
    num: "33", id: "class-routine", route: "/class-routine", icon: "CalendarDays", catIdx: CAT.CR,
    titleBn: "রুটিন পরিচালনা (CR)",
    titleEn: "Routine Management (CR)",
    descBn: "ব্যাচের সাপ্তাহিক ক্লাস রুটিন এডিট করুন - সব শিক্ষার্থীর Schedule পেজে সরাসরি প্রভাব ফেলে।",
    descEn: "Edit the batch's weekly class routine — directly affects every student's Schedule page.",
    blocksBn: [
      { type: 'text', text: 'এখানে যেকোনো পরিবর্তন সঙ্গে সঙ্গে পুরো ব্যাচের Schedule পেজে দেখা যাবে। তাই সাবধানে আপডেট করুন।' },
    ],
    blocksEn: [
      { type: 'text', text: "Any change here reflects immediately on the whole batch's Schedule page, so update carefully." },
    ],
  },

  {
    num: "34", id: "class-planner", route: "/class-planner", icon: "CalendarCheck", catIdx: CAT.CR,
    titleBn: "ক্লাস প্ল্যানার (CR)",
    titleEn: "Class Planner (CR)",
    descBn: "ব্যাচের জন্য ক্লাস-সম্পর্কিত পরিকল্পনা আর শিডিউল পরিচালনা করুন।",
    descEn: "Manage class-related planning and scheduling for the batch.",
    blocksBn: [
      { type: 'text', text: 'ব্যাচের একাডেমিক পরিকল্পনার কাজ এখান থেকে পরিচালনা করা যায়।' },
    ],
    blocksEn: [
      { type: 'text', text: "Manage academic planning tasks for the batch from here." },
    ],
  },

  {
    num: "35", id: "ct-quiz-planning", route: "/ct-quiz-planning", icon: "CalendarClock", catIdx: CAT.CR,
    titleBn: "CT ও কুইজ প্ল্যানার (CR)",
    titleEn: "CT & Quiz Planner (CR)",
    descBn: "ব্যাচের সব CT ও কুইজের তারিখ এক ক্যালেন্ডারে মিলিয়ে নিন, যাতে একই দিনে বেশি পরীক্ষা না পড়ে।",
    descEn: "Coordinate all of the batch's CT and quiz dates on one calendar, avoiding clashes on the same day.",
    blocksBn: [
      { type: 'text', text: 'বিভিন্ন কোর্সের CT ও কুইজ একই দিনে পড়ে গেলে তা মিলিয়ে নেওয়া CR-এর গুরুত্বপূর্ণ দায়িত্ব। এই টুল সেই কাজ সহজ করে।' },
    ],
    blocksEn: [
      { type: 'text', text: "Coordinating CT/quiz dates across courses so they don't clash on the same day is a key CR responsibility — this tool makes that easier." },
    ],
  },

  {
    num: "36", id: "class-roster", route: "/class-roster", icon: "Users", catIdx: CAT.CR,
    titleBn: "রোস্টার (CR)",
    titleEn: "Roster (CR)",
    descBn: "ব্যাচের সব শিক্ষার্থীর তালিকা পরিচালনা করুন।",
    descEn: "Manage the full list of students in the batch.",
    blocksBn: [
      { type: 'text', text: 'ব্যাচের শিক্ষার্থী তালিকা দেখা আর পরিচালনা করার জায়গা।' },
    ],
    blocksEn: [
      { type: 'text', text: 'View and manage the batch\'s student list.' },
    ],
  },

  {
    num: "37", id: "class-notices", route: "/class-notices", icon: "Megaphone", catIdx: CAT.CR,
    titleBn: "ক্লাস অ্যানাউন্সমেন্ট (CR)",
    titleEn: "Class Announcements (CR)",
    descBn: "ব্যাচকে নোটিশ পাঠান - সেটা তাদের Notice পেজে দেখা যাবে।",
    descEn: "Send notices to the batch — they show up on students' Notice page.",
    blocksBn: [
      { type: 'text', text: 'ব্যাচকে গুরুত্বপূর্ণ তথ্য জানাতে এখান থেকে নোটিশ পাঠান। সেটা প্রতিটি শিক্ষার্থীর Notice পেজে টাইমলাইনে যোগ হবে।' },
    ],
    blocksEn: [
      { type: 'text', text: "Send notices from here to keep the batch informed — they'll appear on the Notice timeline for every student." },
    ],
  },

  {
    num: "38", id: "class-my-role", route: "/class-my-role", icon: "Shield", catIdx: CAT.CR,
    titleBn: "আমার ভূমিকা (CR)",
    titleEn: "My Role (CR)",
    descBn: "আপনার CR/ACR স্ট্যাটাস আর ব্যাচের তথ্য দেখুন।",
    descEn: "See your CR/ACR status and batch information.",
    blocksBn: [
      { type: 'text', text: 'আপনার CR বা ACR ভূমিকা, কোন ব্যাচের জন্য, আর সংশ্লিষ্ট তথ্য এখানে দেখা যায়।' },
    ],
    blocksEn: [
      { type: 'text', text: 'See your CR or ACR role, which batch it applies to, and related information.' },
    ],
  },

  {
    num: "39", id: "faculty-portal", route: "/faculty", icon: "GraduationCap", catIdx: CAT.FACULTY,
    titleBn: "ফ্যাকাল্টি পোর্টাল",
    titleEn: "Faculty Portal",
    descBn: "যাচাই করা ফ্যাকাল্টি অ্যাকাউন্টের জন্য ক্লাস পরিচালনা, রুটিন, নোটিশ আর সাপোর্ট টুলসের কেন্দ্র।",
    descEn: "The verified-faculty home for class management, schedules, notices, and support tools.",
    blocksBn: [
      { type: 'text', text: 'শুধু যাচাই করা Faculty account দিয়েই /faculty shell-এ ঢোকা যায়। এখানে নিজের ক্লাস, রুটিন, নোটিশ আর রিসোর্সগুলো এক জায়গায় থাকে।' },
      { type: 'bullet', text: 'Dashboard-এ চলমান ক্লাস, সাম্প্রতিক নোটিশ আর দ্রুত স্ট্যাটাস দেখা যায়' },
      { type: 'bullet', text: 'Mobile আর desktop দুই ভিউতেই আলাদা faculty nav আছে' },
    ],
    blocksEn: [
      { type: 'text', text: 'Only a verified faculty account can enter the /faculty shell. It keeps class work, schedules, notices, and resources together.' },
      { type: 'bullet', text: 'The dashboard shows current classes, recent notices, and quick status' },
      { type: 'bullet', text: 'Faculty navigation is separate from the student shell on both mobile and desktop' },
    ],
  },

  {
    num: "40", id: "faculty-profile", route: "/faculty/profile", icon: "User", catIdx: CAT.FACULTY,
    titleBn: "ফ্যাকাল্টি প্রোফাইল",
    titleEn: "Faculty Profile",
    descBn: "নাম, পদবি, ফোন, অফিস রুম আর পরিচয়-সংক্রান্ত তথ্য ঠিক করুন।",
    descEn: "Set your name, title, phone, office room, and identity details.",
    blocksBn: [
      { type: 'text', text: 'এই পেজে ফ্যাকাল্টি প্রোফাইল পূরণ ও আপডেট করা যায়। সেটআপ ঠিক না হলে ক্লাস পরিচালনা আর নোটিশের কাজ অসম্পূর্ণ থেকে যায়।' },
      { type: 'bullet', text: 'নাম, পদবি, ফোন নম্বর, অফিস রুম' },
      { type: 'bullet', text: 'প্রয়োজনীয় পরিচয় তথ্য দিয়ে faculty profile সম্পূর্ণ রাখুন' },
    ],
    blocksEn: [
      { type: 'text', text: 'Use this page to keep your faculty profile current. If it is incomplete, class management and notice workflows stay incomplete too.' },
      { type: 'bullet', text: 'Name, title/designation, phone number, office room' },
      { type: 'bullet', text: 'Keep the faculty identity record complete for the portal to work cleanly' },
    ],
  },

  {
    num: "41", id: "faculty-classes", route: "/faculty/classes", icon: "BookOpen", catIdx: CAT.FACULTY,
    titleBn: "আমার ক্লাসসমূহ",
    titleEn: "My Classes",
    descBn: "ডিপার্টমেন্ট, ব্যাচ, টার্ম, কোর্স আর সময়-স্লট বেছে নতুন class assignment বানান বা বিদ্যমান ক্লাসে join করুন।",
    descEn: "Create class assignments or join existing ones by choosing department, batch, term, course, and time slot.",
    blocksBn: [
      { type: 'text', text: 'FacultyClasses পেজে dept → batch → term → course → day/time slot ক্রমে নতুন class assignment বানানো যায়। মিল থাকা assignment পেলে join করার অপশনও আসে।' },
      { type: 'bullet', text: 'Sessional/Lab কোর্সে full block বা single slot বেছে নেওয়া যায়' },
      { type: 'bullet', text: 'Co-teacher যোগ করা বা বিদ্যমান assignment join করা যায়' },
      { type: 'bullet', text: 'Batch/term mismatch হলে soft warning দেখায়, hard block নয়' },
    ],
    blocksEn: [
      { type: 'text', text: 'FacultyClasses uses a dept → batch → term → course → day/time slot flow to create new assignments. When a matching class already exists, it can offer a join path instead.' },
      { type: 'bullet', text: 'Sessional/lab courses can use a full block or a single slot' },
      { type: 'bullet', text: 'Best-effort flow for adding a co-teacher or joining an existing assignment' },
      { type: 'bullet', text: 'Batch/term mismatches are surfaced as soft warnings, not hard blocks' },
    ],
  },

  {
    num: "42", id: "faculty-class-detail", route: "/faculty/classes/:assignmentId", icon: "FileText", catIdx: CAT.FACULTY,
    titleBn: "ক্লাস ডিটেইল",
    titleEn: "Class Detail",
    descBn: "একটি নির্দিষ্ট class assignment-এর Students & CR, Syllabus আর Schedule ট্যাব দেখুন।",
    descEn: "Open one class assignment to see the Students & CR, Syllabus, and Schedule tabs.",
    blocksBn: [
      { type: 'text', text: 'এই পেজে একেকটি ক্লাসের ভেতরের তথ্য দেখা যায়। এখনকার built অংশগুলো read-only, আর ভবিষ্যতের ট্যাবগুলো visibly disabled রাখা হয়েছে, যাতে ধাপে ধাপে অগ্রগতি পরিষ্কার থাকে।' },
      { type: 'bullet', text: 'Students & CR, Syllabus, এবং Schedule ট্যাব live আছে' },
      { type: 'bullet', text: 'Attendance, Marks, Notices, আর session-related ট্যাবগুলো এখনো future phase' },
    ],
    blocksEn: [
      { type: 'text', text: 'This page shows the inside of one class assignment. The built tabs are read-only for now, and later-phase tabs stay visibly disabled so the rollout stays honest.' },
      { type: 'bullet', text: 'Students & CR, Syllabus, and Schedule are live tabs' },
      { type: 'bullet', text: 'Attendance, Marks, Notices, and session-related tabs are still future phase work' },
    ],
  },

  {
    num: "43", id: "faculty-schedule", route: "/faculty/schedule", icon: "Clock", catIdx: CAT.FACULTY,
    titleBn: "ফ্যাকাল্টি রুটিন",
    titleEn: "Faculty Schedule",
    descBn: "নিজের weekly teaching routine এক জায়গায় দেখুন।",
    descEn: "See your weekly teaching routine in one place.",
    blocksBn: [
      { type: 'text', text: 'এই পেজে সপ্তাহজুড়ে আপনার teaching schedule দেখা যায়। কোন দিন কোন ক্লাস, কোন assignment আর কোন slot আছে, তা দ্রুত বোঝার জন্য এটি আলাদা পেজ।' },
      { type: 'bullet', text: 'সাপ্তাহিক teaching timetable' },
      { type: 'bullet', text: 'ক্লাস-ভিত্তিক schedule review' },
    ],
    blocksEn: [
      { type: 'text', text: 'This page shows your teaching schedule across the week. It is a separate place to scan which classes and slots you have on each day.' },
      { type: 'bullet', text: 'Weekly teaching timetable' },
      { type: 'bullet', text: 'A quick class-by-class schedule review' },
    ],
  },

  {
    num: "44", id: "faculty-more", route: "/faculty/more", icon: "LayoutGrid", catIdx: CAT.FACULTY,
    titleBn: "আরও টুলস",
    titleEn: "Faculty More",
    descBn: "Meetings, broadcast notices, question bank, contact, settings আর about - সব একসাথে থাকা hub।",
    descEn: "A combined hub for meetings, broadcast notices, question bank, contact, settings, and About.",
    blocksBn: [
      { type: 'text', text: 'Mobile faculty shell-এর More hub-এ কম ব্যবহার হলেও জরুরি টুলগুলো একসাথে থাকে। Desktop-এ এগুলো আলাদা sidebar group হিসেবে ভাগ হয়ে যায়।' },
      { type: 'bullet', text: 'Meetings, Broadcast Notice, Question Bank, Contact, Settings, About' },
      { type: 'bullet', text: '/faculty/resources আর /faculty/tools পুরনো link হলে /faculty/more-এ redirect হয়' },
    ],
    blocksEn: [
      { type: 'text', text: 'The mobile Faculty More hub gathers the less-frequent but still important tools in one place. On desktop, the same items are split into separate sidebar groups.' },
      { type: 'bullet', text: 'Meetings, Broadcast Notice, Question Bank, Contact, Settings, About' },
      { type: 'bullet', text: 'Old /faculty/resources and /faculty/tools links redirect here' },
    ],
  },

  {
    num: "45", id: "provider-portal", route: "/provider", icon: "Store", catIdx: CAT.PROVIDER,
    titleBn: "সার্ভিস প্রোভাইডার পোর্টাল",
    titleEn: "Service Provider Portal",
    descBn: "যাচাই করা provider account-এর জন্য dashboard, shop setup আর verification state এক জায়গায়।",
    descEn: "The verified-provider home for dashboard, shop setup, and verification state.",
    blocksBn: [
      { type: 'text', text: 'Provider shell-এ ঢুকতে যাচাই করা provider হতে হয়। Pending থাকলে আলাদা pending screen দেখা যায়। Verified হলে নিজের shop dashboard খোলে।' },
      { type: 'bullet', text: 'Open/closed shop state, bookings/inquiries আর revenue status' },
      { type: 'bullet', text: 'Provider shell-এ bottom nav আর hamburger panel student shell থেকে আলাদা' },
    ],
    blocksEn: [
      { type: 'text', text: 'You need a verified provider account to enter this shell. Pending providers see a separate pending screen; verified providers land in their own dashboard.' },
      { type: 'bullet', text: 'Open/closed shop state, bookings/inquiries, and revenue status' },
      { type: 'bullet', text: 'Provider bottom nav and hamburger panel are separate from the student shell' },
    ],
  },

  {
    num: "46", id: "provider-profile", route: "/provider/profile", icon: "User", catIdx: CAT.PROVIDER,
    titleBn: "প্রোভাইডার প্রোফাইল",
    titleEn: "Provider Profile",
    descBn: "ব্যবসার পরিচয়, নাম, ফোন আর public-facing profile ঠিক করুন।",
    descEn: "Set the business identity, name, phone, and public-facing profile details.",
    blocksBn: [
      { type: 'text', text: 'এই পেজে provider-এর public identity ঠিক করা হয়। Shop owner-এর নাম, যোগাযোগ আর display info পরিষ্কার থাকলে students-এর কাছে shop বোঝা সহজ হয়।' },
      { type: 'bullet', text: 'Business নাম ও যোগাযোগ তথ্য' },
      { type: 'bullet', text: 'Public-facing profile / cover setup' },
    ],
    blocksEn: [
      { type: 'text', text: 'This page is where a provider keeps the public identity of the shop clean and current. Clear name and contact details make the listing easier for students to understand.' },
      { type: 'bullet', text: 'Business name and contact details' },
      { type: 'bullet', text: 'Public-facing profile / cover setup' },
    ],
  },

  {
    num: "47", id: "provider-shop", route: "/provider/shop", icon: "ShoppingBag", catIdx: CAT.PROVIDER,
    titleBn: "আমার দোকান",
    titleEn: "My Shop",
    descBn: "Offerings আর shop settings খোলার একটি ছোট hub page।",
    descEn: "The hub page that leads into offerings and shop settings.",
    blocksBn: [
      { type: 'text', text: 'My Shop পেজে provider সরাসরি দুটো জিনিসে যায়: offerings/revenue আর shop settings। Shop এখনও সেটআপ না থাকলে onboarding-style prompt দেখায়।' },
      { type: 'bullet', text: 'Offerings & Revenue card' },
      { type: 'bullet', text: 'Shop Details & Status card' },
    ],
    blocksEn: [
      { type: 'text', text: 'The My Shop page is the small hub that takes a provider into offerings/revenue or shop settings. If the shop has not been set up yet, it shows a setup-style state first.' },
      { type: 'bullet', text: 'Offerings & Revenue card' },
      { type: 'bullet', text: 'Shop Details & Status card' },
    ],
  },

  {
    num: "48", id: "provider-offerings", route: "/provider/shop/offerings", icon: "Wallet", catIdx: CAT.PROVIDER,
    titleBn: "Offerings ও Revenue",
    titleEn: "Offerings & Revenue",
    descBn: "Service item যোগ বা edit করুন, available রাখুন, image দিন আর revenue দেখুন।",
    descEn: "Add or edit service items, toggle availability, add images, and review revenue.",
    blocksBn: [
      { type: 'text', text: 'এই পেজে shop-এর service item গুলো manage করা হয়। Booking-mode হলে revenue total দেখায়। Inquiry-mode হলে revenue অংশ থাকে না।' },
      { type: 'bullet', text: 'নতুন offering যোগ, remove, বা available/unavailable toggle করা যায়' },
      { type: 'bullet', text: 'প্রতিটি offering-এ price আর image আপলোড করা যায়' },
      { type: 'bullet', text: 'Booking-mode এ revenue total দেখায়' },
    ],
    blocksEn: [
      { type: 'text', text: 'This page manages the shop’s service items. In booking mode it also shows revenue; in inquiry mode the revenue block is intentionally absent.' },
      { type: 'bullet', text: 'Add, remove, or toggle each offering on and off' },
      { type: 'bullet', text: 'Set a price and upload images for each offering' },
      { type: 'bullet', text: 'Revenue total is shown in booking mode' },
    ],
  },

  {
    num: "49", id: "provider-settings", route: "/provider/shop/settings", icon: "Settings", catIdx: CAT.PROVIDER,
    titleBn: "দোকানের সেটিংস",
    titleEn: "Shop Settings",
    descBn: "Location, GPS pin, delivery আর shop status (pause / close / reactivate) নিয়ন্ত্রণ করুন।",
    descEn: "Control location, GPS pin, delivery, and shop status (pause / close / reactivate).",
    blocksBn: [
      { type: 'text', text: 'এই পেজে provider তার shop-এর location আর operational status ঠিক করে। GPS confirm flow থাকায় pin অন্ধভাবে save হয় না।' },
      { type: 'bullet', text: 'Location text, GPS capture, আর delivery toggle' },
      { type: 'bullet', text: 'Pause, permanent close, বা reactivate control' },
    ],
    blocksEn: [
      { type: 'text', text: 'This page controls the shop’s location and operational state. The GPS flow includes confirmation so the pin is not saved blindly.' },
      { type: 'bullet', text: 'Location text, GPS capture, and delivery toggle' },
      { type: 'bullet', text: 'Pause, permanent close, or reactivate controls' },
    ],
  },

  {
    num: "50", id: "provider-notifications", route: "/provider/notifications", icon: "Bell", catIdx: CAT.PROVIDER,
    titleBn: "প্রোভাইডার নোটিফিকেশন",
    titleEn: "Provider Notifications",
    descBn: "Founder বা Admin থেকে আসা provider-targeted notice এখানে দেখুন।",
    descEn: "See provider-targeted notices from the Founder or Admin here.",
    blocksBn: [
      { type: 'text', text: 'Provider notice page-এ provider audience-এর জন্য পাঠানো notice দেখা যায়। এটা bottom nav-এ না থেকে hamburger panel থেকে খোলে।' },
      { type: 'bullet', text: 'Founder বা Admin audience message' },
      { type: 'bullet', text: 'Personal notice হলে “just for you” tag দেখায়' },
    ],
    blocksEn: [
      { type: 'text', text: 'The provider notice page shows messages sent to provider audiences. It opens from the hamburger panel instead of the bottom nav.' },
      { type: 'bullet', text: 'Messages from Founder or Admin' },
      { type: 'bullet', text: 'Personal notices are tagged as just for you' },
    ],
  },

  {
    num: "51", id: "team-dashboard", route: "/team", icon: "Users", catIdx: CAT.STAFF,
    titleBn: "টিম ও অ্যাডমিন ড্যাশবোর্ড",
    titleEn: "Team & Administration Dashboard",
    descBn: "Founder, Head of Ops, Campus Lead আর অন্য staff roles এক জায়গায় দেখুন।",
    descEn: "View Founder, Head of Ops, Campus Lead, and other staff roles in one place.",
    blocksBn: [
      { type: 'text', text: 'TeamDashboard role-tab ভিত্তিক। URL tab state ধরে, তাই Back চাপলে role change history-ও ঠিকমতো কাজ করে। Founder tab-এ গেলে admin entry point দেখা যায়।' },
      { type: 'bullet', text: 'Founder, Head of Ops, Senior Campus Lead, Campus Lead, Content Lead, Growth, Finance & Legal tabs' },
      { type: 'bullet', text: 'Founder view-এ dedicated admin command center খোলে' },
    ],
    blocksEn: [
      { type: 'text', text: 'TeamDashboard is tab-driven. The active tab lives in the URL, so browser Back steps through role changes correctly. The Founder tab opens the admin entry point.' },
      { type: 'bullet', text: 'Tabs for Founder, Head of Ops, Senior Campus Lead, Campus Lead, Content Lead, Growth, and Finance & Legal' },
      { type: 'bullet', text: 'The Founder tab exposes the dedicated admin command center' },
    ],
  },

  {
    num: "52", id: "admin-hub", route: "/admin-hub", icon: "Briefcase", catIdx: CAT.STAFF,
    titleBn: "অ্যাডমিন হাব",
    titleEn: "Admin Hub",
    descBn: "Profile, CR tools আর Team & Administration একত্রে থাকা staff-friendly hub।",
    descEn: "A staff-friendly hub that combines Profile, CR tools, and Team & Administration.",
    blocksBn: [
      { type: 'text', text: 'এই হাব staff identity-এর সাথে CR identity থাকলে দুটোই একসাথে দেখায়। Profile আগে, তারপর CR tools, তারপর Team & Administration section।' },
      { type: 'bullet', text: 'Staff role + CR/ACR role একসাথে দেখাতে পারে' },
      { type: 'bullet', text: 'Founder/Head of Ops/CL কাজের জন্য merged entry point' },
    ],
    blocksEn: [
      { type: 'text', text: 'If a staff member is also CR or ACR, this hub shows both identities together. Profile comes first, then CR tools, then Team & Administration.' },
      { type: 'bullet', text: 'Can show both staff and CR/ACR identities together' },
      { type: 'bullet', text: 'Merged entry point for Founder, Head of Ops, and Campus Lead work' },
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
