# Faculty Module — Current Status

> **এই ফাইলটাই এই ফিচারের একমাত্র active doc। নতুন কাজ/আপডেট হলে নতুন
> ফাইল না বানিয়ে এই ফাইলটাই এডিট করবে।**
>
> পুরনো raw প্ল্যান/বাগফিক্স ফাইলগুলো সরিয়ে রাখা আছে:
> [`documentation/00-old-data/03-features/faculty-module/`](../../00-old-data/03-features/faculty-module/)

---

## ফিচার কী

Faculty-দের জন্য পূর্ণাঙ্গ পোর্টাল: profile, class management, schedule,
notices, admin-driven verification flow।

## এখন পর্যন্ত যা হয়েছে

- পূর্ণ faculty পোর্টাল তৈরি (profile, class management, schedule,
  notices, verification)
- Admin-only verification flow বাস্তবায়িত (আগের dead auto-approval কোড
  বাতিল করে)
- `RequireFaculty` / `RequireVerifiedFaculty` route guard যোগ হয়েছে
- Faculty dashboard: stat cards + auto-rotating per-course widget
- Unverified faculty-দের জন্য "Get Verified" কার্ড
- Role Select overlay bug ও "Continue does nothing" রুটিং বাগ ফিক্স হয়েছে
- **[নতুন] Official KUET directory auto-verify যোগ হয়েছে** —
  `scripts/kuet_faculty_scraper.py` (GitHub Actions cron দিয়ে দৈনিক
  auto-run, `.github/workflows/kuet-faculty-scrape.yml`) KUET-এর
  department faculty page থেকে নাম/designation/dept/email scrape করে
  `facultyDirectory/{email}`-এ push করে। Faculty signup-এর সময়
  `src/lib/facultyDirectoryMatch.js` এই directory-র সাথে name+email
  match করে দেখে; মিললে `manualVerifyRequests.js`-এর
  `ensureManualVerifyRequest` pending request বানানোর বদলে সরাসরি
  verified করে দেয় (`verifiedFacultyEmails` + `faculty/{uid}.verifiedAt`),
  request row-টা তখনও `status: 'approved', autoVerified: true` হিসেবে
  থেকে যায় Founder-এর audit/override-এর জন্য। **conscious product
  decision** — নিচের ⚠️ সেকশনের ম্যাগিক-লিংক removal-এর সাথে conflict
  করে দেখতে পারে, কিন্তু এটা সেই decision-কে ইচ্ছাকৃতভাবে override করা,
  ভুলে ফিরিয়ে আনা না।

## ⚠️ Outdated/superseded তথ্য (পুরনো ফাইলে ছিল, এখন আর প্রযোজ্য না)

- **Faculty magic-link verification সম্পূর্ণ সরিয়ে dead code হিসেবে বাদ
  দেওয়া হয়েছে।** পুরনো `BUGFIX_FACULTY_VERIFY_CROSS_DEVICE.md` ফাইলে
  magic-link ভিত্তিক verification fix নিয়ে আলোচনা আছে — সেটা এখন আর
  বর্তমান verification flow-এর সাথে মেলে না। রেফারেন্স হিসেবে
  old-data-তে রাখা আছে, কিন্তু নতুন কাজে এটা অনুসরণ কোরো না। **নোট:**
  এই ফাইলের "manual-only, no auto-verify" সিদ্ধান্তটা এখন partially
  superseded — উপরের নতুন directory auto-verify feature-টা একটা নতুন,
  স্বতন্ত্র trust source (KUET-এর নিজস্ব official directory) থেকে
  আসছে, পুরনো ভাঙা magic-link mechanism থেকে না।
- **Known security gap (এখনো fix হয়নি):** `verifiedFacultyEmails`
  collection-এ `allow write: if isSignedIn()` — যেকোনো signed-in
  account (student সহ) সরাসরি লিখতে পারে, directory match ছাড়াই।
  আসল fix-এর জন্য server-side (Cloud Function) validation লাগবে, যেটার
  জন্য Blaze plan দরকার — এই প্রজেক্ট Spark (free)-এ থাকার সিদ্ধান্ত
  নিয়েছে, তাই এখন এটা client-trust-এর উপর নির্ভরশীল।

## সর্বশেষ অবস্থা

Verification flow, guards, dashboard — সব স্থিতিশীল। Directory
auto-verify যোগ হয়েছে এবং CSE-এর জন্য selector real page HTML দিয়ে
verify করা হয়েছে (unit-tested, কাজ করে)। বাকি ১৯টা department একই
template ব্যবহার করে ধরে নেওয়া হচ্ছে (একই KUET CMS) — deploy করার আগে
অন্তত ২-৩টা ভিন্ন department page (যেমন EEE, ME) চোখে দেখে নিশ্চিত করা
ভালো, hard-crash না করলেও কোনো department-এর template একটু আলাদা হলে
সেটার teacher বাদ পড়ে যেতে পারে চুপচাপ। `iict`/`idm`/`iept` institute
তিনটার url pattern এখনো আলাদা করে verify করা হয়নি। নতুন কোনো কাজ হলে এই
সেকশনে যোগ করো।
