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
7. **ক্যাটাগরি-স্পেসিফিক সেটআপ ফ্লো + item-level ছবি আপলোড পালিশ**
   (সম্পূর্ণ — দেখো নিচের ডেডিকেটেড সেকশন)।

## সর্বশেষ অবস্থা

ক্যাটাগরি-স্পেসিফিক সেটআপ ফ্লো (নিচের সেকশন দেখো) সম্পূর্ণ। এর পরে নতুন
কোনো session-এর কাজ থাকলে এই সেকশনে যোগ করো।

---

## ক্যাটাগরি-স্পেসিফিক সার্ভিস সেটআপ + ইমেজ আপলোড + Item-level Availability

> **নোট:** এই কাজটা ভুলবশত আগে একটা আলাদা ফাইলে
> (`CATEGORY_SPECIFIC_SETUP_PLAN.md`, প্রজেক্ট রুটে) প্ল্যান করা হয়েছিল —
> এই README-এর "একটাই active `CURRENT.md`" নিয়ম মানা হয়নি। এই সেকশনে সেই
> ফাইলের সারাংশ এখন এখানে merge করা হলো, নিয়ম অনুযায়ী। ভবিষ্যতে এই
> ফিচারের যেকোনো নতুন কাজ **এই CURRENT.md ফাইলেই** যোগ হবে, নতুন `.md`
> ফাইল বানিয়ে না।

### সমস্যা যা ছিল

প্রোভাইডার প্রথমবার সার্ভিস সেট আপ করার সময় (`ServiceSetupForm`,
`ProviderDashboard.jsx`) সব ৬টা ক্যাটাগরির (Salon, Food, Pharmacy,
Stationery, Online Mart, Errand/Pick-and-drop) জন্য হুবহু একই ফর্ম দেখাত —
কোনো ক্যাটাগরি-স্পেসিফিক ভাষা/উদাহরণ ছিল না, এবং কোনো নির্দেশনা ছিল না যে
এই ফর্মে item/দাম দিতে হবে না (সেটা পরের ধাপে, Offerings পেজে হয়)। এছাড়া
item যোগ করার সময় ছবি upload করার জন্য প্রথমে item সেভ করতে হতো, তারপর
আলাদা ধাপে ছবি বাটন দেখা যেত — দুই ধাপ লাগত।

### যা করা হয়েছে

- **`src/lib/serviceCategoryConfig.js` (নতুন ফাইল)** — প্রতিটা ক্যাটাগরির
  জন্য আলাদা item-শব্দ, শপ-নাম/দাম placeholder, ক্যাটাগরি-হিন্ট,
  availability লেবেল (`স্টকে আছে` / `এখন করানো যাচ্ছে` ইত্যাদি) সংজ্ঞায়িত
  করা আছে — `CATEGORY_SETUP_CONFIG` অবজেক্ট, `getCategorySetupConfig()`
  helper সহ।
- **`ServiceSetupForm` (`ProviderDashboard.jsx`)** এখন সম্পূর্ণ
  category-aware: ক্যাটাগরি বাটনের নিচে হিন্ট সাবটেক্সট, dynamic শপ-নাম ও
  মূল্য-রেঞ্জ placeholder, এবং সাবমিট বাটনের আগে একটা তথ্য-বক্স যা স্পষ্ট
  করে item/দাম পরের ধাপে যোগ হবে। "মূল্য নোট" ফিল্ড লেবেল বদলে **"মোট
  মূল্য রেঞ্জ (ঐচ্ছিক)"** করা হয়েছে, সাথে একটা ছোট hint টেক্সট যোগ হয়েছে
  ("শুধু মোটামুটি একটা আন্দাজ...") যাতে এই ফিল্ড আর নিচের তথ্য-বক্স
  পরস্পরবিরোধী না লাগে।
- **সাবমিট সফল হলে** `hasFixedCatalog: true` ক্যাটাগরির জন্য সরাসরি
  `/provider/shop/offerings`-এ রিডাইরেক্ট হয়; Errand/Pick-and-drop
  ক্যাটাগরির জন্য রিডাইরেক্ট হয় না (ওদের ফিক্সড ক্যাটালগ নেই)।
- **`ProviderOfferingsPage.jsx` / `OfferingsManager`** এখন
  `service.type` অনুযায়ী কনফিগ পড়ে — পেজ টাইটেল, item-নাম placeholder,
  ON/OFF লেবেল, ছবির হেল্পার টেক্সট সব dynamic। Errand/Pick-and-drop
  ক্যাটাগরির জন্য এখন একটা ব্যাখ্যামূলক ইনফরমেশনাল কার্ড দেখায় (খালি
  স্ক্রিনের বদলে)।
- **নতুন item + ছবি একসাথে, এক ধাপে যোগ করা যায় এখন** — "নতুন item"
  ইনপুট রো-তে সরাসরি একটা ছবি-পিকার বাটন আছে, প্রিভিউ থাম্বনেইল দেখা যায়,
  আর "+" চাপলে item সেভ + ছবি আপলোড একই একশনে হয়। Enter চাপলেও item যোগ
  হয় (আগে শুধু বাটনে ট্যাপ করতে হতো)। আপলোডের সময় স্পিনার + "আপলোড
  হচ্ছে…" টেক্সট দেখায়।
- **`errand` ক্যাটাগরির নাম বদলানো হয়েছে** — প্রথমে "Delivery/Errand
  Runner" (ইংরেজি) ছিল, তারপর "দৌড়াদৌড়ি সার্ভিস" ট্রাই করা হয়েছিল কিন্তু
  সেটা casual/হাস্যকর মনে হয়েছে, তাই চূড়ান্তভাবে **"পিক অ্যান্ড ড্রপ"**
  করা হয়েছে (`SERVICE_TYPE_LABELS_BN.errand`, `serviceSync.js`) — এই একই
  ম্যাপ ছাত্র-facing Services গ্রিড এবং provider setup ফর্ম দুই জায়গাতেই
  ব্যবহৃত হয়।
- **dark mode বাগ ফিক্স (এই ফিচারের বাইরেও প্রভাব ফেলে):**
  `src/hooks/useTheme.jsx`-এ কোনো থিমেই `--accentSoft` ভ্যারিয়েবল সেট করা
  ছিল না — শুধু `index.css`-এর `:root`-এ একবার হালকা সবুজ হার্ডকোড ছিল।
  dark মোডে এটা ব্যবহার করা যেকোনো UI (নতুন info-box সহ, আর codebase-এর
  আগে থেকে থাকা কিছু জায়গাও, যেমন group-chip active state) ভুল রঙে দেখাত।
  প্রতিটা থিমে তার নিজস্ব accent থেকে derive করা `--accentSoft` (rgba,
  low-opacity) যোগ করে ঠিক করা হয়েছে।
- মোবাইল viewport safety (`minWidth: 0`, `wordBreak`/`overflowWrap`)
  ক্যাটাগরি বাটন ও offering item row-তে যোগ করা হয়েছে, লম্বা বাংলা টেক্সট
  narrow স্ক্রিনে overflow না করার জন্য।
- পুরোনো ডেটা compatibility ভেরিফাই করা হয়েছে — `SERVICE_TYPES` আর
  `CATEGORY_SETUP_CONFIG`-এর key সেট হুবহু মিলে যায় (salon, hotel,
  medicine, bookstore, onlinemart, errand), তাই fallback config কখনো
  স্বাভাবিক অবস্থায় ট্রিগার হবে না।

### ডিজাইন সিদ্ধান্ত যা রিভিউ হয়েছে

ব্যবহারকারী জিজ্ঞেস করেছিলেন সব item/দাম শুরুতেই ফর্মে নেওয়া উচিত কিনা।
সিদ্ধান্ত: **না** — বর্তমান দুই-ধাপ ফ্লো (আগে শপ প্রোফাইল, পরে এক এক করে
item/দাম যোগ) সঠিক ও best-practice, কারণ ২০টা item একসাথে টাইপ করানো
ক্লান্তিকর ও error-prone। এই ফ্লো অক্ষুণ্ণ রাখা হয়েছে, শুধু communication
স্পষ্ট করা হয়েছে (ওপরের বুলেট দেখো)।

## এই ফাইলে নতুন কাজ যোগ করার নিয়ম

নতুন কোনো আপডেট/বাগফিক্স/ফিচার এলে —
- **"সর্বশেষ অবস্থা"** সেকশনটা আপডেট করো নতুন তথ্য দিয়ে
- বড় কোনো পরিবর্তন হলে **"এখন পর্যন্ত যা হয়েছে"** লিস্টে একটা নতুন
  পয়েন্ট যোগ করো (তারিখসহ, চাইলে)
- বিস্তারিত টেকনিক্যাল স্পেসিফিকেশন (যদি খুব বড় হয়) দরকার হলে
  `00-old-data/`-তে না দিয়ে সরাসরি এই ফোল্ডারেই একটা নতুন সাপোর্টিং
  ফাইল রাখতে পারো, কিন্তু status/summary সবসময় এই `CURRENT.md`-তেই
  থাকবে।
