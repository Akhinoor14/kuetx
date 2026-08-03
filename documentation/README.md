# KUETx — Documentation Index

এই ফোল্ডারে KUETx প্রজেক্টের সব `.md` ডকুমেন্টেশন, ক্যাটাগরি-ওয়াইজ সাজানো
আছে।

---

## 🔑 মূল নিয়ম (এখন থেকে সবসময় মানতে হবে)

### ১. প্রতি ফিচার/ক্যাটাগরির জন্য একটাই active ফাইল — `CURRENT.md`

**প্রতিটা ফিচার-ফোল্ডারে একটা `CURRENT.md` ফাইল থাকে — এটাই সেই
ফিচারের একমাত্র "লাইভ" ডকুমেন্টেশন।** নতুন কোনো কাজ, বাগফিক্স, বা
আপডেট হলে —

- **নতুন `.md` ফাইল বানাবে না।**
- বরং সংশ্লিষ্ট ফোল্ডারের `CURRENT.md` ফাইলটাই **এডিট/আপডেট** করবে —
  "এখন পর্যন্ত যা হয়েছে" লিস্টে নতুন পয়েন্ট যোগ করে, বা "সর্বশেষ
  অবস্থা" সেকশন বদলে।

এভাবে প্রতিটা ফিচারের ইতিহাস আর বর্তমান অবস্থা একটাই জায়গায় থাকবে,
আর `round1`, `round2`, `phase1`, `phase2`-এর মতো ফাইল বারবার না বেড়ে
একটা পরিষ্কার, maintainable ডকুমেন্টেশন ফর্ম তৈরি হবে।

### ২. পুরনো/অপ্রাসঙ্গিক ডেটা কোথায় যায় — `00-old-data/`

`documentation/00-old-data/` ফোল্ডারে (ভেতরে একই ক্যাটাগরি-স্ট্রাকচার
মিরর করে) সরিয়ে রাখা হয় —

- **পুরনো multi-part সিরিজ ফাইল** (round1-6, phase1-3, playbook 01-15
  ইত্যাদি) — যেগুলোর তথ্য এখন `CURRENT.md`-তে সারাংশ আকারে আছে
- **যেসব doc বর্তমান কোডবেস/প্রজেক্ট অবস্থার সাথে আর মেলে না** (যেমন
  বাতিল হয়ে যাওয়া auth পদ্ধতি নিয়ে migration doc) — raw ফাইল হিসেবে
  রেফারেন্সের জন্য রাখা, কিন্তু নতুন কাজে অনুসরণ করার জন্য না

এগুলো **ডিলিট করা হয় না** — শুধু সরিয়ে রাখা হয়, যাতে দরকার হলে পুরনো
বিস্তারিত প্ল্যান/স্পেসিফিকেশন ঘেঁটে দেখা যায়।

### ৩. Session summary-র ব্যতিক্রম

`06-session-summaries-and-reports/` ক্যাটাগরিতে **একটাই ফাইল** নিয়ম
প্রযোজ্য না — প্রতিটা সেশন/মাইলফলক রিপোর্ট স্বভাবতই point-in-time
স্ন্যাপশট, তাই নতুন সেশন সামারির জন্য নতুন (তারিখ-সহ নামের) ফাইল ঠিক
আছে। পুরনো হয়ে গেলে সেগুলোও `00-old-data/`-তে সরিয়ে রাখা যায়।

### ৪. Phase-wise Plan-Prompt ডকুমেন্ট — বড়, মাল্টি-ফেজ কাজের জন্য

কোনো কাজ এত বড় যে এক সেশনে শেষ হয় না — অনেকগুলো আলাদা ধাপ/ফেজে ভাগ
করে, সম্ভবত ভিন্ন ভিন্ন AI সেশনে/টুলে সম্পন্ন করতে হবে — তখন সেই কাজের
জন্য একটা **standalone, self-contained "plan-prompt" `.md` ফাইল**
বানানো হয়। এটা `CURRENT.md` না (status snapshot না) — এটা নিজেই একটা
runnable প্রম্পট, যেটা যেকোনো AI সেশনে কপি-পেস্ট করে দিলে সেই সেশন
নিজে থেকেই বুঝে নেবে কী করতে হবে, কোন ফেজ পর্যন্ত হয়েছে, আর পরের ফেজ
থেকে কীভাবে শুরু করবে।

**কোথায় থাকে:** সংশ্লিষ্ট ফিচার-ফোল্ডারে (`03-features/<feature>/`),
`CURRENT.md`-এর পাশে একটা আলাদা ফাইল হিসেবে (যেমন
`SERVICES_OVERHAUL_PLAN_PROMPT.md`) — `00-old-data/`-এ না, active
reference/runbook ফাইলের মতোই সরাসরি ফিচার-ফোল্ডারে।

**প্ল্যান-প্রম্পট ফাইলের বাধ্যতামূলক গঠন:**
1. **Context/Goal** — পুরো কাজটা কী, কেন দরকার, ইউজার আসল ভাষায় কী
   বলেছিল (summarize করে, বাংলা বা ইংরেজি যেভাবেই বলা হোক)
2. **Phases** — কাজটা স্পষ্ট, ক্রমিক ফেজে ভাগ করা, প্রতিটা ফেজে:
   - কী কী করতে হবে (concrete, checkable বুলেট পয়েন্ট)
   - কোন ফাইল/এরিয়া টাচ হবে (যতটা জানা যায়)
   - Done হওয়ার শর্ত (verification — যেমন `npm run build` পাস করা)
3. **Progress badge** — ফাইলের একদম উপরে, প্রতিটা ফেজের পাশে স্ট্যাটাস
   ব্যাজ:
   - `[ ] TODO` — শুরু হয়নি
   - `[~] IN PROGRESS` — চলছে
   - `[x] DONE` — শেষ, verified
   প্রতিটা ফেজ সম্পূর্ণ হলে **এই ফাইলেই badge আপডেট করে রাখতে হবে** —
   পরের সেশন/AI যেন এক নজরে বুঝতে পারে ঠিক কোথা থেকে শুরু করবে।
4. **Resume instruction** — একটা ছোট নোট: "যদি এই প্ল্যান আবার কোনো
   নতুন সেশনে দেওয়া হয়, উপরের badge দেখে যেই ফেজ TODO/IN PROGRESS আছে
   সেখান থেকে শুরু করো, আগের DONE ফেজ আবার করার দরকার নেই।"

**প্রতিটা ফেজ শেষে বাধ্যতামূলক দুইটা আউটপুট:**
- একটা **full updated project zip** (পুরো কোডবেস, সেই ফেজ পর্যন্ত সব
  পরিবর্তনসহ — `node_modules`/`dist` বাদে)
- **এই একই plan-prompt `.md` ফাইলটাই**, তার progress badge আপডেট করে
  (যেই ফেজ শেষ হলো সেটা `[x] DONE` করে, পরের ফেজ `[~]`/`[ ]` অনুযায়ী) —
  যাতে ফাইলটা reusable থাকে এবং পরের সেশনে সরাসরি আবার ফিড করা যায়

এই দুইটা আউটপুট ছাড়া কোনো ফেজ "শেষ" ধরা হবে না।

---



## কোন কাজ কোন ফোল্ডারে যাবে

| কাজের ধরন | ফোল্ডার |
|---|---|
| প্রজেক্টের সাধারণ পরিচিতি, README, marketing copy | `01-project-overview/` |
| Auth migration, বড় architecture change, cross-cutting refactor | `02-architecture-and-migrations/` |
| নির্দিষ্ট ফিচারের কাজ — আগে থেকে থাকা ফিচার-ক্যাটাগরির `CURRENT.md`-এ | `03-features/<feature-name>/` |
| বড়, মাল্টি-ফেজ কাজ যেটা ধাপে ধাপে/আলাদা সেশনে হবে — plan-prompt ডকুমেন্ট | `03-features/<feature-name>/` (§৪ দেখো — `CURRENT.md`-এর পাশে আলাদা ফাইল) |
| একদম নতুন ফিচার হলে | `03-features/` এর ভেতরে নতুন সাবফোল্ডার + `CURRENT.md` দিয়ে শুরু |
| Deploy/setup গাইড (Firebase, Cloudflare Worker ইত্যাদি) | `04-infrastructure-setup/` (বা সংশ্লিষ্ট ফিচার ফোল্ডারে) |
| App-wide bugfix/changelog, কোনো একক ফিচারের না | `05-bugfixes-and-changelogs/CURRENT.md` |
| নির্দিষ্ট session/দিনের কাজের সামারি | `06-session-summaries-and-reports/` (নতুন ফাইল, ব্যতিক্রম দেখো উপরে) |
| CSS আর্কিটেকচার সংক্রান্ত | `07-css-and-frontend/CURRENT.md` |
| পুরনো/stale/superseded যেকোনো কিছু | `00-old-data/<matching-category>/` |

### নতুন ফিচার শুরু করলে
1. `03-features/` এর ভেতরে ফিচারের নামে নতুন সাবফোল্ডার বানাও
2. সেখানে সরাসরি `CURRENT.md` দিয়ে শুরু করো — ফিচার কী, প্ল্যান, অবস্থা
3. কাজ এগোলে ওই একই `CURRENT.md` এডিট করতে থাকো — নতুন ফাইল যোগ না
   করে

---

## ফোল্ডার স্ট্রাকচার

```
documentation/
├── README.md                          ← এই ফাইল (নিয়ম/ইনডেক্স)
│
├── 00-old-data/                       ← পুরনো/superseded raw ফাইল, category-wise মিরর
│   ├── 01-project-overview/
│   ├── 02-architecture-and-migrations/
│   ├── 03-features/
│   │   ├── curriculum-and-departments/
│   │   ├── faculty-module/
│   │   ├── notice-system/
│   │   ├── question-bank/
│   │   └── services-providers/
│   ├── 05-bugfixes-and-changelogs/
│   ├── 06-session-summaries-and-reports/
│   └── 07-css-and-frontend/
│
├── 01-project-overview/
│   ├── CURRENT.md
│   └── README_original.md             ← প্রজেক্টের মূল README, active
│
├── 02-architecture-and-migrations/
│   └── CURRENT.md
│
├── 03-features/
│   ├── services-providers/
│   │   └── CURRENT.md
│   ├── faculty-module/
│   │   └── CURRENT.md
│   ├── notice-system/
│   │   └── CURRENT.md
│   ├── question-bank/
│   │   ├── CURRENT.md
│   │   ├── 02_R2_STORAGE_NAMING_CONVENTION.md   ← active reference
│   │   └── 03–07_playbook_*.md                  ← active runbook
│   └── curriculum-and-departments/
│       ├── CURRENT.md
│       ├── COURSE_CLASSIFICATION_RULES.md       ← active reference
│       ├── INCOMPLETE_DEPARTMENTS.md            ← active tracking
│       ├── TWO_STAGE_NEW_DEPARTMENT_PROCESS.md  ← active reference
│       └── Y2T1_MARKS_WARNING_3MONTH_SYSTEM.md  ← active reference
│
├── 04-infrastructure-setup/
│   └── QUICK_START_COMMANDS.md        ← active reference
│
├── 05-bugfixes-and-changelogs/
│   └── CURRENT.md
│
├── 06-session-summaries-and-reports/
│   └── CURRENT.md                     ← ব্যাখ্যা করে যে এই ক্যাটাগরিতে নতুন ফাইল ঠিক আছে
│
└── 07-css-and-frontend/
    ├── CURRENT.md
    └── 05_CSS_QUICK_REFERENCE.md      ← active reference
```

---

## নোট

- প্রতিটা ফিচার-ফোল্ডারে যেসব ফাইল "active reference" হিসেবে চিহ্নিত
  (যেমন naming convention, playbook, quick reference) — সেগুলো
  `CURRENT.md` না, কারণ এগুলো evolving status না, বরং স্থায়ী নিয়ম/গাইড।
  এগুলো দরকার হলে সরাসরি এডিট করা যায়, কিন্তু নতুন ফাইল হিসেবে ভাঙা
  বা ডুপ্লিকেট করা যাবে না।
- কোনো তথ্য ডিলিট করা হয়নি — সব পুরনো raw ফাইল `00-old-data/`-এ
  সংরক্ষিত আছে।
