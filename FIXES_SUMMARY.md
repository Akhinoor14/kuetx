# Founder Dashboard — category system redesign

## যা করা হয়েছে

### ১. Duplicate UI সরানো (`src/pages/StaffDashboard.jsx`)
Founder tab-এ আগে দুটো UI stack হয়ে ছিল: `StaffDashboard.jsx`-এর পুরনো flat-scroll
block ("Pending Email Flags", "All Classes — CR & Leave Requests") + তার নিচে
`AdminDashboard.jsx`-এর card grid — দুটোই একই ডেটা আলাদা লেআউটে দেখাচ্ছিল।
পুরনো flat block বাদ দেওয়া হয়েছে (কোড কমেন্টে ব্যাখ্যা আছে কেন)। `RollUnlockSection`,
`AdminAllGroupsSection`, `EmailFlagReviewBlock` — এই তিনটা কম্পোনেন্ট Head of
Ops আর SCL context-এ এখনও ব্যবহৃত হচ্ছে, তাই মুছে ফেলা হয়নি, শুধু Founder tab
থেকে তাদের redundant কল সরানো হয়েছে।

### ২. Category registry (`src/lib/founderCategories.js` — নতুন ফাইল)
সব category (Approvals, Staff & Roles, Classes & Students, Trust & Safety,
Communication) আর তাদের subcategory একটাই array-তে define করা। Grid card,
top-bar pill, badge count — সবকিছু এই registry থেকে জেনারেট হয়। নতুন category
বা subcategory যোগ করতে হলে শুধু array-তে entry যোগ করলেই হবে, নতুন কম্পোনেন্ট
লাগবে না।

দুই ধরনের subcategory সাপোর্ট করে:
- `subcategories: [...]` — fixed sibling sections (যেমন Trust & Safety-এর
  Email Flags vs Roll Unlock) → pill-tab row হিসেবে রেন্ডার হয়
- `drilldown: true` — hierarchical path (Dept > Batch) → breadcrumb UI,
  আলাদাভাবে হ্যান্ডল করা হয় কারণ এটা sibling না, path

### ৩. দুইটা নতুন reusable কম্পোনেন্ট
- `src/components/CategorySubNav.jsx` — category-এর ভেতরে ঢোকার পর top-bar-এ
  সব sibling category-র pill দেখায়, এক ক্লিকে switch করা যায় (আগের `BackBar`-এর
  replacement, যেটা শুধু grid-এ ফিরে যাওয়ার বাটন ছিল)
- `src/components/SubcategoryTabs.jsx` — category-এর ভেতরে static sibling
  sub-section থাকলে সেগুলোর জন্য দ্বিতীয়-স্তরের pill row

### ৪. `src/pages/AdminDashboard.jsx` — পুরো পুনর্গঠন
- emoji icon (✅🧑‍🤝‍🧑🎓🚩📢) বাদ, `lucide-react` icon ব্যবহার — app-এর বাকি সব
  জায়গায় (Sidebar, BottomNav, SubgroupHub) এই একই icon সিস্টেম already আছে
- Card grid এখন `FOUNDER_CATEGORIES` registry থেকে জেনারেট হয় (hardcoded JSX না)
- প্রতিটা category view (Approvals, Staff & Roles, Classes & Students,
  Trust & Safety, Communication)-এ এখন `CategorySubNav` বসানো — এক category
  থেকে আরেক category-তে এক ক্লিকে যাওয়া যায়, grid-এ ফিরতে হয় না
- Approvals, Staff & Roles, Trust & Safety-এর ভেতরের sub-section গুলো এখন
  `SubcategoryTabs`-এর পেছনে (আগে সব সবসময় stacked ছিল)
- **Classes & Students flow flatten করা হয়েছে**: আগে Dept → Batch → Class
  (৩ লেভেল) ছিল, এখন Dept → Batch (২ লেভেল, breadcrumb-সহ) — কারণ group id
  ফরম্যাট `{BATCH}_{DEPT}` অনুযায়ী batch নিজেই class, আলাদা তৃতীয় লেয়ার লাগে না।
  Batch ক্লিক করলে সরাসরি সেই ক্লাসের roster/CR-request ভিউ খোলে।

### ৫. CSS (`src/index.css`)
নতুন `.category-subnav-*`, `.subcategory-tab*`, `.founder-category-card*`
ক্লাস যোগ করা হয়েছে, বিদ্যমান hub-page ভিজ্যুয়াল ল্যাঙ্গুয়েজ (accent-tinted
tile, `--accentRGB`, একই radius/spacing) অনুসরণ করে — যাতে পুরো app একই
সিস্টেমের মতো লাগে।

## যা টেস্ট করা হয়েছে
সব পরিবর্তিত/নতুন ফাইল `esbuild`-এর মাধ্যমে syntax-check করা হয়েছে (JSX
parse error নেই)। `index.css`-এর brace balance ভেরিফাই করা হয়েছে (1720/1720)।
পুরো project-এ node_modules ইনস্টল করা নেই বলে actual `npm run build`/Vite
build চালানো সম্ভব হয়নি — deploy করার আগে once local-এ `npm run build` চালিয়ে
নিশ্চিত হয়ে নিও।

## এই zip-এ কী আছে
শুধু পরিবর্তিত/নতুন ফাইল, তাদের আসল `src/` পাথেই:
- `src/pages/AdminDashboard.jsx` (পুনর্গঠিত)
- `src/pages/StaffDashboard.jsx` (Founder tab থেকে duplicate সরানো)
- `src/components/CategorySubNav.jsx` (নতুন)
- `src/components/SubcategoryTabs.jsx` (নতুন)
- `src/lib/founderCategories.js` (নতুন)
- `src/index.css` (নতুন CSS ব্লক যোগ করা)
