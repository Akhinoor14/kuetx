# Guest / Preview Mode — Current Status

> **এই ফাইলটাই এই ফিচারের একমাত্র active status doc। নতুন কাজ/আপডেট
> হলে নতুন ফাইল না বানিয়ে এই ফাইলটাই এডিট করবে।**
>
> পুরো plan-prompt (৫টা ফেজের সম্পূর্ণ স্পেক + প্রতিটা ফেজের ফাইন্ডিংস/
> ডিভিয়েশন সহ running log) এখানে:
> [`GUEST_MODE_PLAN_PROMPT.md`](./GUEST_MODE_PLAN_PROMPT.md)

---

## ফিচার কী

সাইন-আপ ছাড়াই একজন নতুন ভিজিটর `/about` পেজে (কোনো auth wall ছাড়া)
KUETx কী দেখতে পারে, আর চাইলে "Continue as Guest" চেপে `/guest/*` রুটে
স্ট্যাটিক ডেমো ডেটা দিয়ে Dashboard/Schedule/Attendance/Marks-এর প্রিভিউ
ব্রাউজ করতে পারে — কোনো Firestore write, কোনো Firebase Auth সেশন
(anonymous-ও না) তৈরি না করে। সাথে Guide সিস্টেমকে path-based থেকে
account-role-based-এ বদলানো, যাতে guest/faculty/provider/staff প্রত্যেকে
নিজের role অনুযায়ী সঠিক Overview + guide content পায়।

## এখন পর্যন্ত যা হয়েছে (সব ৫টা ফেজ সম্পন্ন)

1. **Phase 1 — Public About Page:** `/about` auth wall ছাড়াই reachable,
   "Sign In / Sign Up" ও "Continue as Guest" বাটন যোগ হয়েছে।
2. **Phase 2 — Guest Shell & Demo Data:** `/guest/dashboard|schedule|
   attendance|marks` — চারটা presentational-only demo page,
   `guestDemoData.js`-এর স্ট্যাটিক ডেটা দিয়ে চলে। কোনো real store/
   Firestore read/write নেই। **ডিভিয়েশন:** আসল
   Dashboard/Schedule/Attendance/Marks কম্পোনেন্ট reuse করার বদলে হাতে
   লেখা আলাদা ফাইল বানানো হয়েছে — কারণ আসল পেজগুলোর data-coupling এতটাই
   গভীর যে prop-injection বা store-context রিফ্যাক্টর একটা আলাদা বড়
   কাজ হয়ে যেত (বিস্তারিত plan-prompt-এর Phase 2.3-এ)।
3. **Phase 3 — Guest → Real Account Conversion:** সব Sign Up এন্ট্রি
   পয়েন্ট একই `AuthModal` ব্যবহার করে, ডেমো ডেটা কোথাও leak হয় না।
4. **Phase 4 — Polish & Edge Cases:** signed-in ইউজার `/guest/...`-এ
   গেলে `RequireGuestMode` গার্ড দিয়ে `/dashboard`-এ রিডাইরেক্ট হয়। বাকি
   ৪টা আইটেম (direct link, back button, mobile responsiveness,
   `usePageMeta`) কোড না লাগিয়েই already-ঠিক ছিল, verify করা হয়েছে।
5. **Phase 5 — Role-Aware Guide Overhaul:** `GuideModal`-এর
   path-based `getShellContext()` সরিয়ে `resolvedRole` prop-based করা
   হয়েছে। guest/faculty/provider/staff প্রত্যেকের জন্য নতুন Overview
   guide section যোগ হয়েছে (student-এর মূল Overview অক্ষত)। CR-merge
   behavior আগের মতোই কাজ করে।

## সর্বশেষ অবস্থা

পুরো প্ল্যান সম্পন্ন, স্থিতিশীল। `npx vite build` প্রতিটা ফেজের পরে
clean pass করেছে। ভবিষ্যতে যদি Phase 2-এর demo page-গুলো আসল
Dashboard/Schedule/Attendance/Marks কম্পোনেন্ট দিয়ে সত্যিকার reuse করতে
হয় (store-context রিফ্যাক্টর), সেটা এই প্ল্যানের বাইরের, আলাদা একটা
future কাজ — plan-prompt-এর Phase 2.3-এ বিস্তারিত অপশন লেখা আছে।
