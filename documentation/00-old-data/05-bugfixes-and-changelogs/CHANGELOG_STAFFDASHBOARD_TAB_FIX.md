# StaffDashboard.jsx — Multi-role Tab Fix (Bangla changelog)

## যা পাওয়া গেছে (root cause)

পুরো `StaffDashboard.jsx` review করে দেখা গেছে multi-role tab-switching
logic (`RoleTabBar` কম্পোনেন্ট, `tabs` array বানানো, `currentTab` state,
`show(key)` দিয়ে conditional render) **আগে থেকেই সঠিকভাবে বানানো ছিল** —
কোনো missing কম্পোনেন্ট বা ভাঙা render path ছিল না। প্রতিটা role-section
(`CampusLeadBlock`, `SeniorCampusLeadBlock`, `HeadOfOpsSection`,
`ContentLeadSection`, `GrowthSection`) নিজের `show('key') &&` condition
দিয়েই আলাদাভাবে গার্ড করা ছিল, এবং কোনোটার ভেতরেই আরেকটা role-এর data
leak হচ্ছিল না।

আসল সমস্যাটা ছিল একটা **race condition**:

- `roles` (staff/{uid}/roles collection) আসে `subscribeMyRoles()` থেকে।
- Founder status (`isAdminUser`) আসে আলাদা একটা listener,
  `subscribeIsAdmin()` থেকে।
- এই দুইটা সম্পূর্ণ independent async listener — কোনো guarantee নেই যে
  একসাথে resolve হবে। বাস্তবে `roles` প্রায় সবসময় আগে আসে।
- `isAdminUser` এর initial default ছিল `false` (`useState(false)`),
  `null` না। ফলে `roles` লোড হওয়ার সাথে সাথেই tab-computation effect
  একবার চলে যেত **Founder status না জেনেই** — একজন Founder + Campus
  Lead ইউজারের জন্য তখন tabs list হতো শুধু `[{key:'cl'}]`, আর
  `?tab=cl` সাথে সাথে URL-এ লেখা হয়ে যেত।
- কিছুক্ষণ পর `isAdminUser` সত্যিকারের `true` value নিয়ে resolve করত,
  Founder tab তখন list-এ যোগ হতো ঠিকই — কিন্তু `activeTab` ততক্ষণে
  `'cl'`-এ lock হয়ে গেছে, আর সেটা এখনও valid tab (তালিকায় আছে) বলে
  auto-correct হতো না। ফলে ইউজার নিজে ক্লিক না করা পর্যন্ত Founder
  tab-টা দেখেও বুঝতে পারত না যে সেটা একটা আলাদা tab, মনে হতো সব
  role-এর content একসাথে মিশে আছে বা tab bar কাজ করছে না।

## Fix (StaffDashboard.jsx-এ কী পরিবর্তন করা হয়েছে)

1. `isAdminUser` state-এর default value `false` থেকে `null`
   ("এখনো জানা নেই") করা হয়েছে।
2. Tab-list বানানোর `useEffect`-এ একটা guard যোগ করা হয়েছে:
   `if (isAdminUser === null) return;` — অর্থাৎ `roles` আর
   `isAdminUser` দুইটাই resolve হওয়ার আগে tabs একবারও compute হবে না।
   ফলে tabs list প্রথমবারই সম্পূর্ণ ও সঠিক হবে, পরে fix-up করার দরকার
   পড়বে না।
3. Loading guard-টাও (`if (roles === null) ...`) আপডেট করে
   `isAdminUser === null`-ও check করা হয়েছে, যাতে effect আর render —
   দুই জায়গাতেই একই শর্তে "লোড হয়ে গেছে" ধরা হয়।

## Test করা হয়েছে (logic-level simulation দিয়ে)

- **Single role** (শুধু Campus Lead): tab bar দেখায় না (single role হলে
  bar লুকানোই ইচ্ছাকৃত), কিন্তু content ঠিকভাবে দেখায়।
- **Dual role — Founder + Campus Lead**: "Founder" ও "Campus Lead" — ২টা
  আলাদা tab দেখায়, প্রথমবারেই সঠিকভাবে Founder-এ landing হয়, ক্লিক
  করলে switch হয়, একসাথে মিশে না।
- **Dual role — SCL + CL**: "Senior Campus Lead" ও "Campus Lead" আলাদা
  tab, একটাই সময়ে একটা active থাকে।
- **Triple role — Founder + Head of Ops + Content Lead**: ৩টা আলাদা
  tab, প্রথমবারেই সঠিক landing tab (Founder), বাকি দুইটা hidden থাকে
  যতক্ষণ না ক্লিক করা হয়।

## যা ভাঙা হয়নি

- Founder tab-এর ভেতরের actual content (Approvals, Staff & Roles,
  Classes & Students ইত্যাদি) আগের মতোই `AdminDashboard.jsx`-এ থেকে
  `TeamDashboard.jsx` থেকে `AdminEntryPoint` দিয়ে mount হয় —
  architecture অপরিবর্তিত।
- `RoleTabBar`, `SectionTabs`, প্রতিটা role-section কম্পোনেন্ট
  (`CampusLeadBlock` ইত্যাদি) অপরিবর্তিত রাখা হয়েছে — শুধু
  race-condition-টাই ঠিক করা হয়েছে।

## পরিবর্তিত ফাইল

- `src/pages/StaffDashboard.jsx` — শুধু এই একটা ফাইলে edit করা হয়েছে
  (৩টা targeted change: state default, effect guard, loading-guard
  condition)। অন্য কোনো ফাইল স্পর্শ করা হয়নি।
