# Architecture & Migrations — Current Status

> **এই ফাইলটাই এই ক্যাটাগরির একমাত্র active status doc। নতুন কোনো বড়
> architecture change/migration হলে নতুন ফাইল না বানিয়ে এই ফাইলে যোগ
> করো।**
>
> পুরনো migration summary/bugfix ফাইলগুলো সরিয়ে রাখা আছে:
> [`documentation/00-old-data/02-architecture-and-migrations/`](../00-old-data/02-architecture-and-migrations/)

---

## ⚠️ গুরুত্বপূর্ণ — Outdated migration doc

পুরনো `GOOGLE_ONLY_AUTH_MIGRATION.md` ফাইলে ছিল Google Sign-In-কে একমাত্র
auth পদ্ধতি বানানোর migration সামারি। **এটা এখন আর বর্তমান অবস্থার সাথে
মেলে না** — memory অনুযায়ী student auth পরবর্তীতে username+password
পদ্ধতিতে migrate হয়েছে (Google Sign-In students-দের জন্য সরিয়ে ফেলা
হয়েছে)। তাই এই ফাইলটা শুধু historical reference হিসেবে
`00-old-data/`-তে রাখা আছে — নতুন কাজে এটা অনুসরণ কোরো না।

## এখন পর্যন্ত হওয়া architecture-level পরিবর্তন (ইতিহাস, সংক্ষেপে)

- Auth সিস্টেম একাধিকবার migrate হয়েছে: প্রথমে Google-only, পরে
  student-দের জন্য username+password (বর্তমান)
- "Manage Batches" ফাউন্ডার শেল-এর ভেতরেই থাকার bug ফিক্স হয়েছে

## সর্বশেষ অবস্থা

বর্তমান auth architecture: student auth = username+password। Faculty ও
provider auth-এর জন্য আলাদা flow থাকতে পারে — নতুন migration হলে এই
ফাইলে current state স্পষ্ট করে লিখে রাখো, যাতে ভবিষ্যতে confusion না হয়।
