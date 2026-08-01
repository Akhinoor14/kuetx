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

## ⚠️ Outdated/superseded তথ্য (পুরনো ফাইলে ছিল, এখন আর প্রযোজ্য না)

- **Faculty magic-link verification সম্পূর্ণ সরিয়ে dead code হিসেবে বাদ
  দেওয়া হয়েছে।** পুরনো `BUGFIX_FACULTY_VERIFY_CROSS_DEVICE.md` ফাইলে
  magic-link ভিত্তিক verification fix নিয়ে আলোচনা আছে — সেটা এখন আর
  বর্তমান verification flow-এর সাথে মেলে না (এখন admin-driven)। রেফারেন্স
  হিসেবে old-data-তে রাখা আছে, কিন্তু নতুন কাজে এটা অনুসরণ কোরো না।

## সর্বশেষ অবস্থা

Verification flow, guards, dashboard — সব স্থিতিশীল। নতুন কোনো কাজ হলে
এই সেকশনে যোগ করো।
