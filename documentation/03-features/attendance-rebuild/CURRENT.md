# Attendance Tab Rebuild — Current Status

> **এই ফাইলটাই এই ফিচারের একমাত্র active doc। নতুন কাজ/আপডেট হলে নতুন
> ফাইল না বানিয়ে এই ফাইলটাই এডিট করবে।**
>
> এই ফিচারের সম্পূর্ণ ৯-ফেজ প্ল্যান, প্রতিটা ফেজের বিস্তারিত কাজ, আর
> পুরো Progress Log (প্রতিটা সেশনে ঠিক কী কী কোড পরিবর্তন হয়েছে,
> কেন, আর কী ইচ্ছাকৃতভাবে বাদ রাখা হয়েছে) এখানে আছে — নতুন সেশন এই
> ফাইলটা প্রথমে সম্পূর্ণ পড়বে:
> [`ATTENDANCE_REBUILD_PLAN_PROMPT.md`](./ATTENDANCE_REBUILD_PLAN_PROMPT.md)

---

## ফিচার কী

`AttendanceTab` (`src/pages/faculty/FacultyClassDetail.jsx`) — একটা
ক্লাসের real KUETx member-দের বাইরেও পুরো dept+batch+section-এর
সম্ভাব্য সব roll number দেখানো (generated + backlog), স্প্রেডশিট-স্টাইল
UI, মোবাইল swipe view, শিডিউল থেকে date auto-detect, Excel/PDF
export, আর দুই-টিচার একসাথে ক্লাস নেওয়ার সাপোর্ট (join flow +
invite code + সেশন-কলিশন ফিক্স)।

## এখন পর্যন্ত যা হয়েছে

**সবগুলো ৯টা ফেজই DONE** — বিস্তারিত breakdown, কোড-লেভেল প্রমাণ, আর
প্রতিটা ফেজের নিজস্ব progress-log এন্ট্রি জন্য পুরো plan-prompt ফাইলটা
দেখো। সংক্ষেপে:

- **A–C:** roll-number জেনারেশন (dept+batch+section থেকে), attendance
  ডেটা roll-keyed-এ মাইগ্রেট করা, generated + real + backlog রোস্টার
  মার্জ করা
- **D–G:** ডেস্কটপ স্প্রেডশিট UI (2-state Present/Absent টগল), মোবাইল
  swipe view, শিডিউল থেকে auto-date, Excel/PDF export (ফুল টার্ম
  রানিং রেজিস্টার)
- **H:** দুই টিচার একই dateতে attendance নিলে একজনের ডেটা অন্যজনের
  save চেপে বসে যাচ্ছিল (`existingSessionForDate` শুধু date দিয়ে
  ম্যাচ করতো, teacher না দেখেই) — ফিক্স হয়েছে, প্রতি-টিচার স্কোপড।
  সাথে "My sessions / All sessions" টগল যোগ হয়েছে (আগে সামারি % সব
  টিচারের ডেটা silently ব্লেন্ড করছিল, এখন visible + কন্ট্রোলযোগ্য)।
- **I:** Co-teacher invite code — Teacher A একটা 6-ক্যারেক্টার কোড
  জেনারেট করে (24h মেয়াদ, single-use, regenerate করলে পুরনোটা মরে
  যায়), Teacher B "+ Add Class"-এ কোড দিয়ে সরাসরি join করতে পারে,
  dept/batch/course ম্যানুয়ালি পিক করার দরকার নেই।

## এখনো খোলা (blocking না, ছোট আইটেম)

- Phase H: "All sessions" মোডে একই dateতে ২+ সেশন থাকলে আলাদা করে
  দেখার picker UI নেই (শুধু ব্লেন্ডেড টোটাল দেখা যায়); `teacherSlot`
  enforcement Attendance-এ এখনো decide হয়নি
- Phase I: কোডের expiry countdown UI-তে দেখায় না (শুধু স্ট্যাটিক "24h"
  লেখা), জেনারেট করা কোড পেজ ছেড়ে গেলে আবার দেখার উপায় নেই
  (regenerate করাই ওয়ার্কঅ্যারাউন্ড), admin-এর জন্য কোনো invite-code
  audit ভিউ নেই
- ছোট নিরাপত্তা নোট: `inviteCodes` doc-এর `update` rule যেকোনো
  verified faculty-কে অন্যের কোড `used` মার্ক করতে দেয় (privilege
  escalation না, শুধু denial-of-service সম্ভাবনা) — flagged, fix হয়নি

## সর্বশেষ অবস্থা

সব ৯ ফেজ কোড-লেভেলে সম্পূর্ণ, প্রতি ফেজের পরে `npm run build` ক্লিন
কনফার্ম করা হয়েছে। নতুন কোনো কাজ (উপরের open আইটেম বা সম্পূর্ণ নতুন
স্কোপ) হলে এই ফাইলে + plan-prompt ফাইলের Progress Log-এ যোগ করো।
