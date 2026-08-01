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
