# Question Bank — Current Status

> **এই ফাইলটাই এই ফিচারের একমাত্র active status doc। নতুন কাজ/আপডেট হলে
> নতুন ফাইল না বানিয়ে এই ফাইলটাই এডিট করবে।**
>
> এই ফোল্ডারে থাকা `02_R2_STORAGE_NAMING_CONVENTION.md` এবং
> `03`–`07` (playbook README, naming rules, python workflow, recovery,
> safe-move checklist) — এগুলো **এখনো active reusable reference/runbook**,
> তাই সরানো হয়নি। মাস কনটেন্ট cleanup করার সময় এগুলোই অনুসরণ করবে।
>
> পুরনো plan/report/older-guide-version ফাইলগুলো (backend structure
> notes, developer guide, PDF compression workflow, QuestionBankSolutions
> ডিজাইন সিরিজ ইত্যাদি) সরিয়ে রাখা আছে:
> [`documentation/00-old-data/03-features/question-bank/`](../../00-old-data/03-features/question-bank/)

---

## ফিচার কী

Cloudflare R2-backed question bank সিস্টেম — static data থেকে migrate
করা হয়েছে, upload approval flow (Campus Lead → SCL → Founder fallback),
role-based permission, ১৬টা department-এর ১,১৪৬টা course folder সহ।
QuestionBankSolutions পেজ (সমাধান দেখানোর UI) আলাদা সাব-প্রজেক্ট হিসেবে
ডিজাইন-বিল্ড হয়েছে।

## এখন পর্যন্ত যা হয়েছে

- Static data থেকে R2-backed সিস্টেমে migrate, Cloudflare Worker সহ
- Upload approval flow implement (Campus Lead → SCL → Founder fallback)
- Role-based permission সিস্টেম
- ১৬টা department, ১,১৪৬টা course folder verify করে scaffold করা
- QuestionBankSolutions UI (desktop+mobile) ডিজাইন করে বাস্তবায়িত —
  CSE2113 (2018-2023) + Fluid Mechanics (2018-2023), ১২টা JSON ফাইল,
  ৩০০+ প্রশ্ন দিয়ে শুরু

## সর্বশেষ অবস্থা

R2 pipeline আর naming convention স্থিতিশীল রেফারেন্স হিসেবে ব্যবহার হচ্ছে
(এই ফোল্ডারের `02`-`07` ফাইল)। নতুন course/department যোগ হলে বা কোনো
বড় আপডেট হলে এই সেকশনে যোগ করো।
