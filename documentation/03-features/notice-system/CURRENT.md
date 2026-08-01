# Notice System — Current Status

> **এই ফাইলটাই এই ফিচারের একমাত্র active doc। নতুন কাজ/আপডেট হলে নতুন
> ফাইল না বানিয়ে এই ফাইলটাই এডিট করবে।**
>
> পুরনো raw প্ল্যান/সেটআপ ফাইলগুলো সরিয়ে রাখা আছে:
> [`documentation/00-old-data/03-features/notice-system/`](../../00-old-data/03-features/notice-system/)

---

## ফিচার কী

নোটিশ সিস্টেম — markdown tokenizer, composer toolbar, priority system,
filter/search, security hardening, acknowledgment ("Got it") ফ্লো, push
notification (FCM) ও Telegram bot ইন্টিগ্রেশন সহ।

## এখন পর্যন্ত যা হয়েছে (৬-ফেজ আপগ্রেড সম্পন্ন)

1. Markdown tokenizer
2. `NoticeComposerToolbar`
3. Priority system
4. Filter chips + search
5. Security hardening (role-gating, length caps)
6. Acknowledgment ("Got it") ফ্লো

এছাড়া:
- **Push Notification (FCM)** — client-side অংশ (SW, permission banner,
  token save) implement করা আছে; সার্ভার/কনসোল সাইড সেটআপ (owner-only)
  বাকি থাকতে পারে — Firebase কনসোলে FCM enable করতে হবে
- **Telegram notice bot** — সেটআপ করা আছে, কিন্তু auto-deploy না, Firebase
  deploy access থাকা কারো manually infra বসাতে হবে (WhatsApp official API
  সাপোর্ট না করায় Telegram বেছে নেওয়া হয়েছে)
- "Claims CR / Pending" স্টাক ব্যাজ বাগ ফিক্স হয়েছে

## সর্বশেষ অবস্থা

FCM push আর Telegram bot infra-side সেটআপ কারো করা বাকি থাকতে পারে
(owner-only পদক্ষেপ)। বাকি সব ফিচার সম্পন্ন ও স্থিতিশীল।
