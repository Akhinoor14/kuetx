# Services / Provider Marketplace — Current Status

> **এই ফাইলটাই এই ফিচারের একমাত্র active doc। নতুন কোনো কাজ/আপডেট হলে
> নতুন ফাইল না বানিয়ে এই ফাইলটাই এডিট করবে — নিচে relevant সেকশনে
> যোগ করবে বা "সর্বশেষ অবস্থা" আপডেট করবে।**
>
> পুরনো raw প্ল্যান/প্রম্পট/changelog ফাইলগুলো (এই ফিচারের পুরো ইতিহাস,
> detailed spec সহ) সরিয়ে রাখা আছে:
> [`documentation/00-old-data/03-features/services-providers/`](../../00-old-data/03-features/services-providers/)
> — দরকার হলে ওখানে গিয়ে বিস্তারিত দেখা যাবে।

---

## ফিচার কী

Salon দিয়ে শুরু হওয়া, পরে multi-category (medicine shop ইত্যাদি একই
architecture-এ) — student/faculty-দের জন্য local service provider
marketplace। GPS-based shop location, delivery/errand runner অপশন,
founder panel থেকে provider management, service image upload (Cloudflare
R2 worker দিয়ে)।

## এখন পর্যন্ত যা হয়েছে (ইতিহাস সংক্ষেপে, পুরনো ফাইলের ক্রম অনুযায়ী)

1. **Phase 1** — Salon-first marketplace-এর মূল প্ল্যান অনুমোদিত হয়ে
   বাস্তবায়িত।
2. **Phase 2** — Multi-category সাপোর্ট যোগ হয়েছে (medicine shop-সহ
   generic architecture-এ implement করা)।
3. **GPS + delivery/errand** — শপ লোকেশন GPS ইন্টিগ্রেশন, delivery/errand
   runner ফিচার, এবং targeted-picker dropdown cleanup সম্পন্ন।
4. **Navigation restructure** — Provider-side navigation নতুন করে সাজানো
   হয়েছে।
5. **Founder Panel upgrade** — Founder panel থেকে service providers
   management সম্পূর্ণ upgrade হয়েছে (`providerSync.js` সহ একাধিক ফাইলে
   পরিবর্তন)।
6. **Service image upload** — Cloudflare R2 worker দিয়ে service image
   upload সিস্টেম সেটআপ সম্পন্ন (owner-only Cloudflare অ্যাকাউন্ট
   কনফিগারেশন প্রয়োজন হয়েছিল)।

## সর্বশেষ অবস্থা

Founder Panel upgrade আর R2 image worker সেটআপ পর্যন্ত সম্পন্ন। এর পরে
নতুন কোনো session-এর কাজ থাকলে এই সেকশনে যোগ করো।

## এই ফাইলে নতুন কাজ যোগ করার নিয়ম

নতুন কোনো আপডেট/বাগফিক্স/ফিচার এলে —
- **"সর্বশেষ অবস্থা"** সেকশনটা আপডেট করো নতুন তথ্য দিয়ে
- বড় কোনো পরিবর্তন হলে **"এখন পর্যন্ত যা হয়েছে"** লিস্টে একটা নতুন
  পয়েন্ট যোগ করো (তারিখসহ, চাইলে)
- বিস্তারিত টেকনিক্যাল স্পেসিফিকেশন (যদি খুব বড় হয়) দরকার হলে
  `00-old-data/`-তে না দিয়ে সরাসরি এই ফোল্ডারেই একটা নতুন সাপোর্টিং
  ফাইল রাখতে পারো, কিন্তু status/summary সবসময় এই `CURRENT.md`-তেই
  থাকবে।
