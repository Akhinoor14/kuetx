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
8. **Offering cards → hover-to-manage + dedicated detail page** (সম্পূর্ণ
   — দেখো নিচের ডেডিকেটেড সেকশন)।
9. **Topbar chip-strip disappearing on shop detail page + missing errand
   pill + oversized single-offering card** (সম্পূর্ণ — দেখো নিচের
   ডেডিকেটেড সেকশন)।

## সর্বশেষ অবস্থা

Topbar chip-strip bugফিক্স + errand পিল যোগ + oversized single-offering
কার্ড ফিক্স (নিচের সেকশন দেখো) সম্পূর্ণ। এর পরে নতুন কোনো session-এর কাজ
থাকলে এই সেকশনে যোগ করো।

**আপডেট (first-time setup form থেকে "মোট মূল্য রেঞ্জ" ফিল্ড রিমুভ +
বর্ণনা ফিল্ডে সহজ guidance):** ব্যবহারকারীর ফিডব্যাক অনুযায়ী
`ServiceSetupForm`-এর (`ProviderDashboard.jsx`) "মোট মূল্য রেঞ্জ
(ঐচ্ছিক)" ফিল্ডটা **সম্পূর্ণ রিমুভ** করা হয়েছে — এটা misleading ছিল,
কারণ আসল per-item দাম পরের ধাপে ("দোকান → Offerings") আলাদাভাবে সেট
হয়, তাই একটা "মোট" রেঞ্জ এখানে জিজ্ঞেস করাটা confusing। `priceNote`
field/collection নিজেই (Firestore doc-এ, Shop Settings-এ) সরানো হয়নি —
শুধু এই **প্রথমবার সেটআপের ফর্ম** থেকে সরানো হয়েছে; provider পরে চাইলে
Shop Settings থেকে এখনো price note সেট করতে পারবে। পাশাপাশি "বর্ণনা
(ঐচ্ছিক)" ফিল্ডের নিচে একটা সহজ বাংলা hint যোগ করা হয়েছে (উদাহরণসহ),
কারণ অনেক provider বুঝতে পারে না "বর্ণনা"-তে ঠিক কী লিখতে হবে।

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

---

## Offering cards → Hover-to-Manage + Dedicated Detail Page

### সমস্যা যা ছিল

`ProviderOfferingsPage.jsx`-এর `OfferingsManager` কম্পোনেন্টে প্রতিটা
offering কার্ড e-commerce স্টাইলে সব কন্ট্রোল (কভার ফটো, লেবেল+দাম, ডিলিট
বাটন, availability টগল, দাম ইনপুট, ৩টা পর্যন্ত ফটো থাম্বনেইল + রিমুভ, অ্যাড
ফটো টাইল) **একবারেই, সবসময় দৃশ্যমান** দেখাত — লিস্টে বেশ কয়েকটা item
থাকলে পেজটা অনেক লম্বা ও ঘিঞ্জি হয়ে যেত।

### যা করা হয়েছে

- **লিস্ট পেজ কম্প্যাক্ট হয়েছে** — প্রতিটা কার্ডে এখন শুধু কভার ফটো,
  নাম, দাম, আর একটা read-only status pill দেখায়। বাকি সব এডিটিং
  (টগল/দাম/ফটো/ডিলিট) কার্ড থেকে সরিয়ে ফেলা হয়েছে।
- **Hover/tap-to-manage বাটন** — ডেস্কটপে (hover সাপোর্ট করা ডিভাইসে,
  `@media (hover: hover)` দিয়ে গেট করা) কার্ডের ওপর hover করলে একটা
  "Manage"/"পরিচালনা করুন" ওভারলে বাটন ভেসে ওঠে (কর্নারে, settings আইকনসহ)।
  টাচ ডিভাইসে (hover নেই) এই বাটন সবসময় দৃশ্যমান থাকে, ছোট আকারে। কার্ডের
  যেকোনো জায়গায় ক্লিক করলে অথবা এই বাটনে ক্লিক করলে — দুটোই একই ডেডিকেটেড
  ডিটেইল পেজে নিয়ে যায়।
- **নতুন রুট + পেজ: `src/pages/provider/ProviderOfferingDetailPage.jsx`**,
  `/provider/shop/offerings/:offeringId`-এ মাউন্ট করা, `App.jsx`-এ ঠিক
  `/provider/shop/offerings` ও `/provider/shop/settings`-এর মতোই
  route-guard (`RequireProvider`) আর `providerProfile` প্রপ ওয়্যারিং
  ফলো করে।
- সব per-offering এডিটিং লজিক (`toggleOffering`, `removeOffering`,
  `updatePrice`, ছবি আপলোড/রিমুভ হ্যান্ডলার, `uploadingFor` state) এই নতুন
  পেজে **হুবহু (verbatim)** মুভ করা হয়েছে — একই `setServiceOfferings`
  সেভ প্যাটার্ন, একই `MAX_OFFERING_IMAGES` ক্যাপ। পেজটা নিজে
  `subscribeProviderServices(uid, setServices)` কল করে (ঠিক
  `ProviderOfferingsPage.jsx` / `ProviderShopSettingsPage.jsx`-এর মতোই
  আলাদা সাবস্ক্রিপশন প্যাটার্ন), তারপর `offeringId` দিয়ে
  `service.offerings`-থেকে নির্দিষ্ট আইটেমটা খুঁজে বের করে।
- **দাম** — একই আন্ডারলাইং `updatePrice` প্যাটার্ন, কিন্তু ডেডিকেটেড পেজে
  on-blur-এর বদলে explicit "Save" বাটন (পড়তে সহজ লাগার জন্য)।
- **ডিলিট** — এখন একটা স্পষ্ট destructive বাটন,
  `ProviderShopSettingsPage.jsx`-এর `ConfirmBlock` প্যাটার্ন/ভিজ্যুয়াল
  স্টাইল রিইউজ করে confirm-step দেখায় (নতুন প্যাটার্ন বানানো হয়নি)।
  কনফার্ম করলে `/provider/shop/offerings`-এ ফিরে যায়।
- ভিজ্যুয়াল ভাষা `Services.jsx` / `ServiceDetail.jsx` /
  `ProviderMyShopHub.jsx`-এর এই সেশনের রিডিজাইনের সাথে মেলানো হয়েছে
  (rounded 16-20px কার্ড, subtle hover lift + shadow,
  `var(--accentRGB)`-বেসড টিন্টেড বর্ডার হোভারে)।
- `src/lib/providerStrings.js`-তে নতুন কী যোগ হয়েছে (`offerings.manage`,
  `offerings.detailBackLink`, `offerings.notFound`, `offerings.savePrice`,
  `offerings.priceSaved`, `offerings.deleteOffering`,
  `offerings.deleteConfirmText`, `offerings.deleteConfirmLabel`,
  `offerings.cancel`, `offerings.deleting`, `offerings.photosTitle`) —
  বাংলা আর ইংরেজি দুই টেবিলেই।
- "নতুন offering যোগ করুন" ফর্ম (লেবেল + দাম + ঐচ্ছিক ফটো) লিস্ট পেজেই
  থেকে গেছে, ডিটেইল পেজে সরানো হয়নি — সেটা নতুন আইটেম তৈরির জন্য, এই
  কাজের সাথে সম্পর্কিত না।
- লিস্ট পেজ থেকে এখন-অব্যবহৃত ইম্পোর্ট/state সরানো হয়েছে (`Trash2`,
  `Check`, `X as XIcon`, `deleteServiceImage`, `uploadingFor`,
  `fileInputsRef`, `MAX_OFFERING_IMAGES`)।

### ভেরিফাই করা হয়েছে

`check_imports.mjs` (শুধু আগে থেকে থাকা `routePreload.js`-এর অপ্রাসঙ্গিক
warning, এই কাজের সাথে সম্পর্কহীন) আর `npm run build` — দুটোই ক্লিন পাস
করেছে, নতুন/পরিবর্তিত দুটো পেজই আলাদা chunk হিসেবে বান্ডল হয়েছে।

---

## Topbar chip-strip + errand pill + oversized offering card

### সমস্যা যা ছিল (৩টা, স্ক্রিনশট থেকে রিপোর্ট করা)

1. `/services/category/salon` (শপ লিস্ট) পেজে টপবারে Salon/Food/Pharmacy/
   Stationery/Online Mart পিল-স্ট্রিপ দেখা যেত, কিন্তু একটা শপে ঢুকে
   `/services/:serviceId` (ServiceDetail.jsx)-এ গেলে এই পুরো স্ট্রিপটাই
   উধাও হয়ে যেত।
2. সেই পিল-স্ট্রিপে "Delivery"/"পিক অ্যান্ড ড্রপ" (errand) ক্যাটাগরির
   কোনো পিলই ছিল না — বাকি ৫টা ক্যাটাগরির পাশে।
3. একটামাত্র offering থাকা শপে (booking form-এর "যা করাতে চান, বেছে
   নিন" গ্রিড) সেই একটা item-এর কার্ড পুরো কন্টেইনার প্রস্থ জুড়ে
   বিশাল হয়ে দেখাত, বাকি ছোট-ছোট কার্ডের মতো compact না।

### রুট কজ + যা করা হয়েছে

1. **`src/components/Navbar.jsx`-এর `getPageMeta()`** — টপবার
   chip-strip `nav.js`-এর "Services" পুল-এর item path গুলোর সাথে
   `pathname.startsWith(item.path)` মিলিয়ে বানানো হয়, আর সেই path গুলো
   সব `/services/category/:type` (একটা `/category/` সেগমেন্ট সহ)।
   `/services/:serviceId`-এ কোনো `/category/` নেই, তাই কোনো ম্যাচ হতো
   না আর siblings/siblingGroups খালি রিটার্ন হতো — পুরো স্ট্রিপ উধাও।
   ফিক্স: "Services" পুলের জন্য একটা স্পেশাল-কেস যোগ হয়েছে —
   `/services/`-দিয়ে শুরু হওয়া যেকোনো path (Level-1 গ্রিড `/services`
   বাদে) এখন এই পুলেই ম্যাচ করে, তাই শপ ডিটেইল পেজেও স্ট্রিপ দেখা যায়।
2. **`src/nav.js`** — Services আইটেম লিস্টে একটা নতুন এন্ট্রি যোগ হয়েছে:
   `services-errand` (label "Delivery", `/services/category/errand`,
   icon `Bike`) — বাকি ৫টা ক্যাটাগরির মতো একই প্যাটার্নে।
3. **`src/lib/iconRegistry.js`** — নতুন `Bike` আইকন import + `ICONS`
   ম্যাপে যোগ করা হয়েছে (এই ফাইলের নিজস্ব নিয়ম অনুযায়ী — কোনো নতুন
   `icon: 'X'` স্ট্রিং যোগ হলে এখানেও যোগ করতে হয়, নাহলে সাইডবারে
   silently `Circle`-এ fallback করে)।
4. **`src/pages/ServiceDetail.jsx`-এর দুটো গ্রিড** (`kx-pick-grid` —
   booking form-এর offering picker, আর `kx-offering-grid` — quantity-cart
   স্টাইল শপের item গ্রিড) — `grid-template-columns` এর
   `repeat(auto-fit, minmax(Npx, 1fr))` বদলে
   `repeat(auto-fill, minmax(Npx, Mpx))` করা হয়েছে। `auto-fit` + `1fr`
   এক কলাম হলে সেই একটা কার্ডকে পুরো width জুড়ে স্ট্রেচ করে দেয়;
   `auto-fill` + ম্যাক্স-উইথ ক্যাপ একই compact কার্ড সাইজ বজায় রাখে
   item সংখ্যা যাই হোক না কেন।

### ভেরিফাই করা হয়েছে

`npm run build` ক্লিন পাস করেছে।

## Faculty side-এ একই ইস্যুগুলোর ফলো-আপ ফিক্স

উপরের চারটা ফিক্স স্টুডেন্ট সাইডে (`nav.js` / student `Navbar` flow)
করা হয়েছিল, কিন্তু **Faculty শেল (`/faculty/*`) সম্পূর্ণ আলাদা একটা
nav config (`nav-faculty.js`-এর `NAV_FACULTY`) ব্যবহার করে**, যেটা
`Navbar.jsx`-এর `getPageMeta()`-তে একেবারেই পাস হতো না। ফলে একই বাগ
faculty সাইডে ভিন্নভাবে প্রকাশ পাচ্ছিল:

1. **Faculty top bar-এ সবসময় generic "KUETx" টাইটেল** — `getPageMeta`
   শুধু `NAV`/`NAV_DESKTOP` (স্টুডেন্ট) বা `getNavProvider()` (provider)
   চিনতো; `NAV_FACULTY` কোথাও navSource হিসেবে পাস হতো না। তাই
   Dashboard/Profile/My Classes/Schedule — প্রতিটা faculty পেজেই path
   ম্যাচ ফেইল করে ডিফল্ট fallback-এ পড়তো, কোনো chip strip-ও দেখাতো না।
   **ফিক্স:** `useIsFaculty()` হুক যোগ করে `isProvider`-এর মতোই
   `isFacultyResolved && isFaculty` চেক করে `getFacultyNav(isMobileNav)`
   (নতুন `NAV_FACULTY_DESKTOP`/`NAV_FACULTY_MOBILE` থেকে সঠিকটা বেছে
   দেয়) navSource হিসেবে পাস করা হয়েছে — provider ব্রাঞ্চের ঠিক পাশে,
   একই isResolved-গেটেড প্যাটার্নে (flash এড়াতে)।
2. **Faculty-এর নিজস্ব Services subgroup-এও Delivery/Runner পিল মিসিং
   ছিল** — `nav-faculty.js`-এর "More → Services" সাবগ্রুপ স্টুডেন্ট
   `nav.js`-এর মতো ৫টা ক্যাটাগরি কপি করেছিল, কিন্তু `errand` বাদ পড়ে
   গিয়েছিল। যোগ করা হয়েছে (`f-services-errand`, label "Delivery", icon
   `Bike` — এই আইকন আগেই student fix-এ `iconRegistry.js`-তে রেজিস্টার
   করা আছে, তাই নতুন কিছু আলাদা করে দরকার হয়নি)।
3. **শপ ডিটেইল পেজের গ্রিড ফিক্স আলাদা করে কিছু লাগেনি** —
   `ServiceDetail.jsx` role-agnostic শেয়ার্ড পেজ (`/services/...` রুট
   student আর faculty দুই শেলেই একই কম্পোনেন্টে ল্যান্ড করে), তাই
   `auto-fill`/max-width ফিক্স ইতিমধ্যেই faculty ভিউয়ের জন্যও কার্যকর
   ছিল।

### ভেরিফাই করা হয়েছে (faculty ফলো-আপ)

`npm run build` আবার ক্লিন পাস করেছে।

## Services Marketplace Overhaul — Phase 1 (Orders Hub ডেটা লেয়ার)

পূর্ণ প্ল্যান: `SERVICES_OVERHAUL_PLAN_PROMPT.md` (এই একই ফোল্ডারে) —
৯-ফেজের পুরো overhaul প্ল্যান, progress badge সহ।

**Phase 1 সম্পন্ন — cross-service booking query।** আগে প্রতিটা
booking/inquiry/errand subscribe ফাংশন একটা নির্দিষ্ট `serviceId`-এ
scoped ছিল — কোনো "সব শপ মিলিয়ে আমার সব বুকিং" ফাংশন ছিলই না।

- **`src/lib/serviceSync.js`-এ নতুন `subscribeAllMyBookings(uid, callback)`**
  — একটা uid-এর সব booking/inquiry/errand request, সব শপ জুড়ে, লাইভ।
  Booking/inquiry/errand তিনটাই আসলে একই `services/{serviceId}/bookings`
  সাবকালেকশনে থাকে (verified করা হয়েছে `createBooking`/
  `createErrandRequest` পড়ে) — শুধু `studentUid` (booking/inquiry) বনাম
  `requesterUid` (errand) আলাদা ফিল্ড। তাই দুইটা `collectionGroup('bookings')`
  listener চালিয়ে client-side merge করা হয়েছে (ঠিক যেমন
  `subscribeOpenErrandRequestsForRunner` আগে থেকেই করে)। প্রতিটা রেকর্ড
  শপের নাম/ক্যাটাগরি দিয়ে enrich করা হয় (একটা one-shot
  `getDocs(servicesCollectionRef())` থেকে), যাতে হাব পেজে extra
  per-item fetch না লাগে।
- **`firestore.indexes.json`-এ `fieldOverrides` যোগ করা হয়েছে** —
  `bookings.studentUid` আর `bookings.requesterUid`-এর জন্য
  `COLLECTION_GROUP` scope single-field indexing enable করা হয়েছে
  (ডিফল্টে এগুলো শুধু `COLLECTION` scope-এ auto-indexed থাকে; নতুন
  collectionGroup query কাজ করার আগে এই override deploy করতে হবে —
  `joinRequests.status`-এর existing override-এর ঠিক একই প্যাটার্ন)।
- **Firestore rules-এ কোনো পরিবর্তন লাগেনি** — `bookings/{bookingId}`-এর
  read rule আগে থেকেই per-document `studentUid`/`requesterUid` চেক
  করে, যেটা collectionGroup query-তেও একইভাবে apply হয়।

**ডিপ্লয়মেন্ট নোট:** production-এ এই ফিচার কাজ করার আগে
`firebase deploy --only firestore:indexes` চালিয়ে নতুন
`fieldOverrides` deploy করতে হবে — না করলে `subscribeAllMyBookings`
একটা permission/failed-precondition error দেবে (কনসোল লিংক সহ
auto-create করার অপশন)।

### ভেরিফাই করা হয়েছে (Phase 1)

`npm run build` ক্লিন পাস করেছে। `firestore.indexes.json` valid JSON
verify করা হয়েছে।

## Services Marketplace Overhaul — Phase 2 (Orders Hub UI)

**Phase 2 সম্পন্ন — hub card + hub page।**

- **`src/pages/Services.jsx`-এ নতুন hub-entry card** — Level-1 grid-এর
  একদম উপরে, category grid-এর বাইরে আলাদাভাবে রেন্ডার করা হয়েছে
  (দুই কলাম জুড়ে, `.kx-category-grid`-এর অংশ না)। আলাদা রঙ/স্টাইল
  (accent-tinted gradient background, accent border) দিয়ে বাকি
  category card থেকে visually distinct করা হয়েছে, নিচে একটা
  divider line দিয়ে regular listing থেকে আলাদা করা।
- **নতুন পেজ `src/pages/ServiceOrdersHub.jsx`** — "My Orders" নামে,
  route `/services/orders`-এ `App.jsx`-এ রেজিস্টার করা হয়েছে (literal
  segment, তাই `/services/:serviceId` param route-এর সাথে conflict
  করে না — React Router specificity দিয়ে ঠিক resolve করে)।
  - Phase 1-এর `subscribeAllMyBookings(uid, callback)` থেকে ডেটা
    নেয়, status অনুযায়ী তিনটা গ্রুপে ভাগ করে দেখায়: Active,
    Completed, Cancelled/Closed।
  - প্রতিটা রেকর্ডের shape (booking/inquiry/errand) client-side
    detect করা হয় ফিল্ড উপস্থিতি দিয়ে (নতুন কোনো "kind" ফিল্ড ডেটাতে
    যোগ করা হয়নি, Phase 1-এর নোট অনুযায়ী)।
  - Cancel action আছে শুধু Active গ্রুপে, existing
    `cancelBooking`/`cancelErrandRequest`/`closeInquiry` ফাংশনই
    reuse করা হয়েছে — নতুন কোনো mutation logic লেখা হয়নি।
  - কোনো নতুন nav entry (sidebar/bottom-nav) যোগ করা হয়নি — Phase 0
    অনুযায়ী hub card-ই primary entry point।
  - পুরো পেজ সরাসরি simple English-এ লেখা (নতুন ফাইল বলে, Phase 7-এর
    Bangla-sweep অপেক্ষা করার দরকার ছিল না)।

### ভেরিফাই করা হয়েছে (Phase 2)

`npm run build` ক্লিন পাস করেছে। `ServiceOrdersHub` আলাদা lazy chunk
হিসেবে সঠিকভাবে বিল্ড হয়েছে যাচাই করা হয়েছে।

## Services Marketplace Overhaul — Phase 3 (Level-1 listing redesign)

**Phase 3 সম্পন্ন — `/services` এখন flat e-commerce-style feed।**

- **`src/pages/Services.jsx`-এর default export (Level-1) সম্পূর্ণ
  পুনর্গঠন** — আগের "category grid + Coming soon placeholder, আগে
  ক্যাটাগরি সিলেক্ট করতে হবে" লেআউট সরিয়ে এখন সব active (non-dormant)
  শপ সরাসরি একটা flat grid-এ দেখায়, লোড হওয়ার সাথে সাথেই — কোনো forced
  category-first navigation gate নেই।
- **Sort By + Filter টুলবার** যোগ হয়েছে grid-এর উপরে —
  - Sort: Open now first (ডিফল্ট), Name (A–Z), Newest।
  - Filter: All categories (ডিফল্ট) অথবা নির্দিষ্ট একটা ক্যাটাগরি —
    আগে যা Level-2 পেজ (`/services/category/:type`) আলাদা route হিসেবে
    করত, এখন সেটাই Level-1-এই inline filter অপশন হিসেবে পাওয়া যায়।
  - দুটোই একই `OptionSheet` shared bottom-sheet কম্পোনেন্ট ব্যবহার করে
    (নতুন, এই ফাইলেই local — প্রজেক্টে আগে থেকে generic picker
    কম্পোনেন্ট ছিল না)।
- **Phase 2-এর "My Orders" hub card অপরিবর্তিত থেকেছে** — এখনো প্রথম
  row-এ fixed, sort/filter pipeline-এর বাইরে, নিচে divider সহ, আলাদা
  রঙ/স্টাইল সহ — Phase 3 এই কার্ডে কোনো পরিবর্তন করেনি।
- **ডেটা সোর্স অপরিবর্তিত** — `subscribeAllServices`,
  `SERVICE_TYPE_LABELS`, `CATEGORY_ICONS`, `serviceSync.js`-এর কোনো
  exported ফাংশনের signature টাচ করা হয়নি। এই ফেজ শুধু layout/
  interaction — data model-এ কোনো পরিবর্তন নেই।
- **Dormant শপ** এখনো আলাদা "Currently inactive" সেকশনে নিচে দেখায়
  (আগে Level-2-এ যেভাবে দেখাত, একই প্যাটার্ন, Level-1-এ move করা
  হয়েছে)।
- **Level 2 (`CategoryShopList`, `/services/category/:categoryType`)
  অক্ষত রাখা হয়েছে** — এখনো route হিসেবে কাজ করে (deep link ইত্যাদির
  জন্য), কিন্তু এখন Level-1-এর Filter দিয়েই একই কাজ হয়ে যাওয়ায় এটা
  আর একমাত্র পথ না।
- Phase 0-এ রেকর্ড করা decision অনুযায়ী করা হয়েছে (flatten + filter
  option, category-first landing না) — owner feedback পেলে সহজেই
  "category chip filter" স্টাইলে flip করা যাবে যদি ফলাফল intent-এর
  সাথে না মেলে।

### ভেরিফাই করা হয়েছে (Phase 3)

`npm run build` ক্লিন পাস করেছে। Hub card এখনো সঠিক জায়গায় (fixed
first row, divider সহ) রেন্ডার হচ্ছে যাচাই করা হয়েছে। Sort/Filter
state শুধু client-side (কোনো নতুন Firestore query লাগেনি)।

## Services Marketplace Overhaul — Phase 4 (Shop detail page UI polish)

**Phase 4 সম্পন্ন — `ServiceDetail.jsx`-এ visual polish, বুকিং/ইনকোয়ারি/
এরান্ড লজিক অপরিবর্তিত।**

- **নতুন `GalleryMedia` কম্পোনেন্ট** — cover image-এর জায়গায় big
  active image + thumbnail strip (e-commerce product-detail স্টাইল)।
  ছবি আসে service-এর নিজের cover image + প্রতিটা available offering-এর
  প্রথম image থেকে, deduped। ০ বা ১টা ছবি থাকলে thumbnail strip
  স্বয়ংক্রিয়ভাবে হাইড হয়ে যায় (single static image বা আগের মতো store
  icon placeholder) — Phase 0-এর decision অনুযায়ী graceful degrade।
- **Top-right icon বাটন** যোগ হয়েছে (Package আইকন) — সরাসরি
  `/services/orders` ("My Orders" hub)-এ নিয়ে যায়। সত্যিকারের cart
  concept KUETx-এ নেই (appointment/inquiry-based marketplace), তাই
  reference screenshot-এর cart-icon স্পটে এই shortcut বসানো হয়েছে।
- **Colour/quantity-style variant selector যোগ করা হয়নি** — Phase 0-এ
  আগে থেকেই সিদ্ধান্ত ছিল, KUETx-এর সার্ভিসগুলো appointment/inquiry-
  based, physical color-variant প্রোডাক্ট না, তাই এই ধরনের selector-এর
  জন্য কোনো ডেটা নেই।
- **BookingForm/InquiryForm/ErrandForm/MyActiveBooking/MyActiveInquiry/
  MyActiveErrand — কোনো state বা mutation logic টাচ করা হয়নি।**
  `createBooking`/`cancelBooking`/`createErrandRequest` ইত্যাদি সব
  ফাংশন কল অক্ষত। এই ফেজ শুধু layout wrapper — booking state machine
  পুনর্লিখন করা হয়নি, plan-এর explicit স্কোপ অনুযায়ী।
- **`.kx-offering-grid` / `.kx-pick-grid`-এর আগে-ফিক্স করা grid bug**
  (`auto-fill` + `minmax(min,max)`, `auto-fit`/`1fr` না) verify করা
  হয়েছে — অপরিবর্তিত আছে, regress হয়নি।
- Header layout সামান্য reorganize হয়েছে — "← Services" ব্যাক-লিংক আর
  নতুন cart-shortcut আইকন এখন একটা `.kx-detail-topbar` row-এ পাশাপাশি
  (Phase 5-এ এই ব্যাক-লিংক সরানো হবে বলে এখনো এখানেই রাখা হয়েছে)।

### ভেরিফাই করা হয়েছে (Phase 4)

`npm run build` ক্লিন পাস করেছে। বিভিন্ন সংখ্যক offering-images সহ
(০, ১, একাধিক) `GalleryMedia`-এর graceful-degrade behavior কোড-লেভেলে
verify করা হয়েছে। একটা লাইভ অ্যাকাউন্ট দিয়ে click-through test এখনো
মানুষ টেস্টারের করা উচিত — sandbox-এ production Firebase-এ sign-in
করার উপায় নেই।

## Services Marketplace Overhaul — Phase 5 ("← Services" back-link অপসারণ)

**Phase 5 সম্পন্ন।**

- **`src/pages/ServiceDetail.jsx`-এর `.kx-detail-topbar` থেকে "←
  Services" ব্যাক-লিংক বাটন সরানো হয়েছে** — এটাই ছিল shop detail
  পেজের টপে দেখানো back-link (owner "chip strip"-এ বলেছিলেন, কোডে
  এটা আসলে `Navbar.jsx`-এর chip strip-এ ছিল না, বরং
  `ServiceDetail.jsx`-এর নিজস্ব header row-এ — investigation করে এটাই
  পাওয়া গেছে, `Navbar.jsx`-এ কোনো "← Services" টেক্সট বা এই বাটন নেই)।
- Phase 4-এ যোগ করা "My Orders" shortcut আইকন (Package আইকন,
  top-right) অপরিবর্তিত রাখা হয়েছে — শুধু ব্যাক-লিংক বাটনটাই সরানো
  হয়েছে, topbar row-টা এখন `justify-content: flex-end` দিয়ে ডানে
  align হয়ে আছে।
- **`Navbar.jsx`-এর আসল chip strip (category pill row, `getPageMeta`-র
  Services pool special-case সহ) টাচ করা হয়নি** — শপ detail পেজে
  category pill strip এখনো ঠিকমতো visible থাকে, শুধু
  `ServiceDetail.jsx`-এর নিজস্ব header-এর ব্যাক-বাটনটাই সরানো হয়েছে।
- **Level-1 (`/services`) এবং Level-2
  (`/services/category/:categoryType`)-এ কোনো back-link ছিল না প্রথম
  থেকেই** — শুধু shop-detail পেজের এই একটাই ব্যাক-লিংক ছিল, এবং এটাই
  owner-এর specific request অনুযায়ী সরানো হয়েছে; বাকি navigation flow
  অক্ষত।
- Unused `ArrowLeft` import সরানো হয়েছে।

### ভেরিফাই করা হয়েছে (Phase 5)

`npm run build` ক্লিন পাস করেছে। Shop detail পেজের টপবারে এখন শুধু
"My Orders" আইকন বাটন দেখায়, কোনো ব্যাক-লিংক নেই। `Navbar.jsx`-এর chip
strip অপরিবর্তিত থাকা visually confirm করা হয়েছে (কোড-লেভেলে — কোনো
লাইনই টাচ করা হয়নি)।

## Services Marketplace Overhaul — Phase 6 (Provider vs Student/Faculty flow audit)

**Phase 6 সম্পন্ন — কোনো ইস্যু পাওয়া যায়নি, কোনো কোড পরিবর্তনের দরকার
হয়নি।**

Clean-slate walkthrough করা হয়েছে (Phase 0-এ noted, কোনো নির্দিষ্ট bug
report ছিল না), যা যা চেক করা হয়েছে:

- **Route-level গার্ড** — `/provider`, `/provider/shop`,
  `/provider/shop/offerings`, `/provider/shop/offerings/:id`,
  `/provider/shop/settings`, `/provider/profile`,
  `/provider/notifications` — সবগুলো `App.jsx`-এ `RequireProvider`
  দিয়ে wrap করা, যাচাই করা হয়েছে। `RequireProvider` তিনটা অবস্থা
  সঠিকভাবে হ্যান্ডেল করে: provider না হলে "Access required" স্ক্রিন,
  pending/rejected/deactivated হলে `ProviderVerificationPending`,
  verified হলেই আসল ড্যাশবোর্ড।
- **`/services*` route-এ ইচ্ছাকৃতভাবে কোনো role গার্ড নেই** —
  `App.jsx`-এ আগে থেকেই কমেন্ট করা আছে কেন (একজন provider নিজের নিজের
  শপও ব্রাউজ করতে পারে বলে ধরে নেওয়া হয়েছে) — এটা bug না, ইচ্ছাকৃত
  ডিজাইন, Phase 1-6-এর কোনো কাজ এটা পরিবর্তন করেনি।
- **Phase 1-এর `subscribeAllMyBookings`** — `where('studentUid', '==',
  uid)` এবং `where('requesterUid', '==', uid)` দিয়ে সবসময় শুধু নিজের
  রেকর্ড ফেরত দেয়, provider হোক বা student — কোনো provider-এর নিজের
  শপের সব বুকিং এই হুকের মাধ্যমে leak হয় না। `firestore.rules`-এর
  `bookings` subcollection read rule দিয়েও এটা ডাবল-এনফোর্সড (ছাত্র
  একে অপরের বুকিং কখনো পড়তে পারে না, provider শুধু নিজের সার্ভিসের
  বুকিং পড়তে পারে)।
- **Provider পেজগুলো** (`ProviderDashboard.jsx`,
  `ProviderMyShopHub.jsx`, ইত্যাদি) **কেউই** `ServiceOrdersHub.jsx`
  বা `subscribeAllMyBookings` import/reuse করে না — student hub আর
  provider dashboard সম্পূর্ণ আলাদা কোড পাথ, কোনো accidental mixing
  নেই।
- **Nav-level আইসোলেশন** — `nav.js`-এর ৪টা provider-stub group শুধু
  `getPageMeta`-র জন্য (provider পেজে topbar title resolve করতে),
  provider-এর নিজের sidebar/bottom-nav render করে না — সেটা
  `SidebarNavProvider.jsx`-এ `isProvider` চেক দিয়ে সম্পূর্ণ আলাদা
  সোর্স থেকে আসে। Student account কখনো provider nav item দেখে না,
  provider account কখনো student nav item দেখে না।
- Phase 1-5-এ যা টাচ করা হয়েছে (`Services.jsx`, `ServiceDetail.jsx`,
  `ServiceOrdersHub.jsx`, `Navbar.jsx`-এর topbar) — কোথাও কোনো
  provider-only action (edit/delete offering, শপ সেটিংস, ইত্যাদি)
  ছাত্র-ফেসিং কোডে leak হয়নি; `ServiceDetail.jsx`-এর "মূল্য পরিবর্তন"
  বাটনটা student-এর নিজের errand counter-offer, provider action না —
  ভুল করে provider-only মনে হতে পারে বলে এটা এখানে আলাদা করে নোট করা
  হলো।

**উপসংহার: কোনো role-gating ইস্যু পাওয়া যায়নি, কোনো ফিক্সের দরকার
হয়নি।**

### ভেরিফাই করা হয়েছে (Phase 6)

`npm run build` ক্লিন পাস করেছে (কোনো কোড পরিবর্তন হয়নি, শুধু audit)।

## Services Marketplace Overhaul — Phase 7 (English-only UI text pass)

**Phase 7 সম্পন্ন — services module-এর সব user-facing বাংলা টেক্সট
ইংরেজিতে রূপান্তরিত।**

- **`ServiceDetail.jsx`** — `STATUS_LABEL`/`INQUIRY_STATUS_LABEL`/
  `ERRAND_STATUS_LABEL` ম্যাপ, not-found মেসেজ, open/closed স্ট্যাটাস
  টেক্সট, location/delivery ব্যাজ, dormant ব্যানার, এবং
  `BookingForm`/`InquiryForm`/`ErrandForm`/`MyActiveBooking`/
  `MyActiveInquiry`/`MyActiveErrand`-এর সব label, placeholder, error
  message, বাটন টেক্সট — সবকিছু ইংরেজিতে অনুবাদ করা হয়েছে। কোনো
  state/mutation লজিক টাচ করা হয়নি, শুধু স্ট্রিং লিটারেল বদলানো
  হয়েছে।
- **`Services.jsx`** — Level-2 (`CategoryShopList`)-এর empty-state ও
  "Currently inactive" heading, এবং `ShopCard`-এর open/closed/
  dormant/action label ইংরেজিতে অনুবাদ করা হয়েছে।
- **`ServiceOrdersHub.jsx`** — আগে থেকেই সম্পূর্ণ ইংরেজি ছিল (Phase
  1-2 তেই ইংরেজিতে লেখা হয়েছিল), কোনো পরিবর্তনের দরকার হয়নি।
- **কোড কমেন্ট অপরিবর্তিত রাখা হয়েছে** — plan-এর explicit scope
  অনুযায়ী, শুধু UI copy বদলানো হয়েছে, developer-facing comment-এ কিছু
  বাংলা শব্দ (যেমন "বন্ধ", "কতজন আছে") এখনো আছে, ইচ্ছাকৃতভাবে টাচ করা
  হয়নি।
- **`৳` কারেন্সি সিম্বল** সব জায়গায় অক্ষত রাখা হয়েছে — এটা ভাষার
  টেক্সট না, তাই "no Bangla" স্কোপের বাইরে।
- **এই পরিবর্তন services module-এই সীমাবদ্ধ** — বাকি অ্যাপের বাংলা-
  ফার্স্ট কনভেনশন (memory-তে নোট করা আছে) অপরিবর্তিত, শুধু owner-এর
  explicit ইনস্ট্রাকশন অনুযায়ী services module-এ এই একটা ব্যতিক্রম
  করা হয়েছে।

### ভেরিফাই করা হয়েছে (Phase 7)

`npm run build` ক্লিন পাস করেছে। Python-এ Unicode Bangla-script রেঞ্জ
(`\u0980-\u09FF`) দিয়ে `Services.jsx`, `ServiceDetail.jsx`,
`ServiceOrdersHub.jsx` পুরোপুরি স্ক্যান করা হয়েছে — বাকি যা পাওয়া
গেছে তার সবই দেব-কমেন্ট বা ৳ সিম্বল, কোনো user-facing string বাকি
নেই।

## Services Marketplace Overhaul — Phase 8 (Final handoff)

**সম্পূর্ণ overhaul সম্পন্ন — সব ৮টা ফেজ `[x] DONE`।**

সংক্ষিপ্ত সারাংশ, পুরো plan জুড়ে যা যা হয়েছে:

1. **Phase 0** — স্কোপ নিশ্চিত করা হয়েছে, ওপেন প্রশ্নগুলোর best-
   judgement উত্তর রেকর্ড করা হয়েছে (Level-1 flatten-with-filter,
   gallery graceful-degrade, hub নাম "My Orders" @ `/services/orders`,
   Phase 6 clean-slate audit)।
2. **Phase 1** — `serviceSync.js`-এ `subscribeAllMyBookings(uid,
   callback)` যোগ হয়েছে — booking/inquiry/errand তিনটাই একই
   `services/{id}/bookings` subcollection-এ, তাই একটা collectionGroup
   query দিয়েই সব কভার হয়।
3. **Phase 2** — নতুন `ServiceOrdersHub.jsx` পেজ (`/services/orders`),
   cross-shop সব বুকিং/ইনকোয়ারি/এরান্ড এক জায়গায়, প্লাস `Services.jsx`
   Level-1-এ "My Orders" hub card যোগ হয়েছে (fixed first row,
   divider সহ)।
4. **Phase 3** — `/services` Level-1 লিস্টিং পুরোপুরি পুনর্গঠন —
   category-first landing সরিয়ে flat e-commerce-style feed, Sort By +
   Filter টুলবার সহ।
5. **Phase 4** — `ServiceDetail.jsx`-এ visual polish — image gallery +
   thumbnail strip, "My Orders" শর্টকাট আইকন — বুকিং/ইনকোয়ারি/এরান্ড
   state machine অপরিবর্তিত।
6. **Phase 5** — shop detail পেজের "← Services" ব্যাক-লিংক সরানো
   হয়েছে (`ServiceDetail.jsx`-এর নিজস্ব header-এ ছিল, `Navbar.jsx`-এ
   না) — `Navbar.jsx`-এর আসল chip strip অক্ষত।
7. **Phase 6** — Provider vs Student/Faculty flow audit — clean-slate
   walkthrough, কোনো role-gating ইস্যু পাওয়া যায়নি, কোনো ফিক্সের
   দরকার হয়নি।
8. **Phase 7** — Services module-এর সব user-facing বাংলা টেক্সট
   ইংরেজিতে অনুবাদ করা হয়েছে (`ServiceDetail.jsx`, `Services.jsx`) —
   বাকি অ্যাপ Bangla-first-ই থেকে গেছে, শুধু services module-এ এই
   ব্যতিক্রম।

**টাচ করা মূল ফাইলসমূহ:**
- `src/lib/serviceSync.js` (Phase 1 — নতুন export যোগ, বাকি অপরিবর্তিত)
- `src/pages/ServiceOrdersHub.jsx` (নতুন, Phase 2)
- `src/pages/Services.jsx` (Phase 2, 3, 7)
- `src/pages/ServiceDetail.jsx` (Phase 2, 4, 5, 7)
- `src/App.jsx` (Phase 2 — নতুন route যোগ)

**টাচ করা হয়নি (ইচ্ছাকৃতভাবে):**
- `firestore.rules` — কোনো নতুন read/write pattern লাগেনি
- `src/pages/provider/*` — Phase 6 audit শুধু verify করেছে, কিছু
  পাল্টায়নি
- `src/components/Navbar.jsx` — Phase 5-এ ভুল ধারণা সংশোধন করে বোঝা
  গেছে আসল টার্গেট এখানে ছিলই না

### ভেরিফাই করা হয়েছে (Phase 8 — Final)

সম্পূর্ণ ক্লিন `rm -rf node_modules dist && npm install && npm run
build` — শুরু থেকে শেষ পর্যন্ত — ক্লিন পাস করেছে, কোনো ওয়ার্নিং/এরর
ছাড়া (শুধু প্যাকেজ-লেভেল deprecation নোটিশ, কোড ইস্যু না)। `Services`,
`ServiceDetail` নিজস্ব lazy chunk হিসেবে সঠিকভাবে বিল্ড হয়েছে যাচাই
করা হয়েছে। প্রতিটা আগের ফেজের ভেরিফিকেশন নোট এই ফাইলেই উপরে রেকর্ড
করা আছে।

**সম্পূর্ণ overhaul-এর স্ট্যাটাস: সব ৮টা ফেজ `[x] DONE`।** এখন থেকে
নতুন কোনো কাজ এই module-এ এলে নিচের নিয়ম অনুযায়ী এই ফাইলে যোগ করা
হবে।

## Post-Phase-8 বাগফিক্স — মোবাইলে ২ column জোর করা (`.kx-shop-grid`)

**সমস্যা:** owner AppleGadgets-এর mobile catalog page (375px width)
রেফারেন্স হিসেবে দেখিয়েছেন — সেখানে সবসময় ২টা column থাকে। কিন্তু
KUETx-এর `.kx-shop-grid`-এ `auto-fill` + `minmax(220px, 1fr)` ব্যবহার
করায় ছোট ফোনে (~360-400px viewport) মাঝে মাঝে ১টা column-ই ফিট হচ্ছিল,
কারণ ২টা 220px card + gap মিলিয়ে সেই width-এ জায়গা হয় না।

**ফিক্স:** `Services.jsx`-এর তিন জায়গার `.kx-shop-grid` CSS (Level-1
main grid, Level-2 `CategoryShopList` grid, আর loading skeleton) —
৪৮০px-এর নিচে এখন `repeat(2, 1fr)` দিয়ে **fixed ২ column** force করা
হয়েছে, gap 12px। ৪৮০px-এর উপরে (larger phones/tablets) আগের
`auto-fill` + `minmax(220px, 1fr)` আচরণ ফিরে আসে, যেখানে content-এর
জায়গা এমনিতেই থাকে। ৯০০px+ (ডেস্কটপ) breakpoint অপরিবর্তিত।

`ShopCard`-এর নিজের CSS আগে থেকেই relative unit (%, aspect-ratio,
flex) ব্যবহার করত, কোনো fixed pixel width ছিল না, তাই ~১৭০-১৮০px card
width-এও ভেঙে পড়েনি — শুধু grid-template-columns বদলালেই যথেষ্ট ছিল।

`npm run build` ক্লিন পাস করেছে।

## Open Errand Request Feed migration — shop-less Pick and Drop (চলমান)

**সমস্যা যেটা fix হচ্ছে:** পুরনো "Pick n Drop" (errand) ফিচার
shop-based ছিল — একজন Runner-কে আগে থেকে নিজের shop/service সেটআপ করতে
হতো, তারপরই কেউ request পাঠাতে পারত। ভুল মডেল হিসেবে চিহ্নিত হয়েছে —
কোনো shop/Runner account ছাড়াই যেকোনো verified student/faculty
সরাসরি open request পোস্ট করতে পারবে এমন নতুন মডেলে migrate করা হচ্ছে।

**নতুন মডেল (owner-confirmed, চূড়ান্ত):**
- কোনো shop/Runner account লাগে না — verified যেকেউ open request পোস্ট
  করতে পারে, broadcast হয়ে যায় সবার কাছে (নিজেরটা নিজে দেখে না)
- যেকেউ accept করতে পারে (multiple accept সম্ভব) — timestamp-ভিত্তিক
  queue তৈরি হয়, কিন্তু requester যেকোনো একজনকে confirm করতে পারে
  (প্রথমজনই হতে হবে এমন না)
- Confirm করলে বাকি সব accept auto-reject (atomic batch)
- Finish হলে ফিড থেকে card সরে যায় (status filter দিয়েই হয়)
- Optional deadline, phone number persist (`errandContact/{uid}`, একবার
  দিলে আর জিজ্ঞেস করে না)
- Founder/Admin dashboard-এ centralized accept log
- আগে থেকে থাকা broadcast opt-out টগল (Settings.jsx,
  `studentPreferences/{uid}`) নতুন ফিডেও respect করা হয়

**ডেটা লেয়ার + রুলস (সম্পূর্ণ, deploy বাকি):**
- `src/lib/errandRequests.js` — নতুন ফাইল, সম্পূর্ণ CRUD + subscription
  সেট (creation, feed, accept, confirm, finish/cancel, admin log,
  contact persistence)। Collections: `errandRequests/{requestId}`,
  `errandRequests/{requestId}/accepts/{acceptorUid}`,
  `errandContact/{uid}`
- `firestore.rules` — errandRequests/accepts/errandContact rules যোগ
  হয়েছে (`studentPreferences` ব্লকের পরে)। পুরনো shop-based `bookings`
  errand-mode rules legacy ডেটার জন্য এখনো আছে, সরানো হয়নি
- `firestore.indexes.json` — composite indexes + collectionGroup field
  overrides যোগ হয়েছে
- **⚠️ Deploy pending:** `firebase deploy --only
  firestore:rules,firestore:indexes` owner-কে চালাতে হবে, নাহলে নতুন
  কালেকশন "Missing or insufficient permissions" দেবে

**নাম-সংঘর্ষ সতর্কতা:** `serviceSync.js`-এ পুরনো shop-based
`createErrandRequest`/`acceptErrandRequest`/`cancelErrandRequest`/
`finishErrandRequest` আগে থেকেই আছে। নতুন `errandRequests.js`-এ প্রায়
একই নামের ফাংশন আছে। দুটো ফাইল থেকে একসাথে import করলে conflict হবে —
alias ব্যবহার করতে হবে।

### UI — ধাপ ১-৩ সম্পন্ন: পোস্ট ফর্ম + Open Feed + Detail Modal

- **`src/pages/ErrandFeed.jsx`** (নতুন ফাইল, route `/services/errands`)
  — একটা কম্বাইন্ড পেজ, তিনটা closely-coupled অংশ নিয়ে:
  - **পোস্ট ফর্ম** (Modal): item description, optional ছবি (পুরনো
    `uploadServiceImage()` reuse করা হয়েছে — `serviceId`-এর বদলে
    freshly-generated `requestId` key হিসেবে ব্যবহার করা হয়, কোনো
    পরিবর্তন লাগেনি `serviceImageUpload.js`-এ), price/free toggle,
    optional deadline (datetime-local picker)। Requester-এর
    নাম/role — student হলে `getProfile()` (store.js), faculty হলে
    `subscribeFacultyProfile` (facultySync.js), `useIsFaculty()`
    দিয়ে সার্ভার-ভেরিফায়েড রোল নির্ধারণ করে (self-reported না)
  - **Open Feed**: `subscribeOpenErrandRequests()` — কার্ডে item
    description, ছবি (থাকলে), price/free badge, deadline, লাইভ accept
    count (প্রতি কার্ড নিজের `subscribeErrandAccepts()` সাবস্ক্রাইব
    করে, কোনো denormalized counter field ছাড়াই)
  - **Detail Modal**: তিনটা ভিউ — (ক) Requester নিজে: accept queue
    (নাম/ফোন/সময়সহ) + Confirm/Finish/Cancel বাটন, (খ) Confirmed
    acceptor নিজে: requester-এর নাম + Finish বাটন, (গ) অন্য যেকেউ:
    Accept বাটন — ট্যাপ করলে `getSavedErrandPhone()` দিয়ে prefill,
    নতুন হলে ফোন নাম্বার ফিল্ড দেখায়
  - "আমার রিকোয়েস্ট" বাটন `/services/errands/mine`-এ পয়েন্ট করে (পরের
    ধাপে বানানো হবে — এখনো route নেই)

- **`App.jsx`**: `/services/errands` route যোগ হয়েছে
  (`/services/orders`-এর মতোই literal segment, `/services/:serviceId`
  param route-এর আগে declare করা, নাহলে React Router ভুল route
  ম্যাচ করত)

- **`Services.jsx`**: errand category card এখন সরাসরি
  `/services/errands`-এ নেভিগেট করে (আগে shop list-এ যেত)। Badge এখন
  live open-request count দেখায় (`subscribeOpenErrandRequests()`) —
  shop count-এর বদলে, কারণ এই মডেলে আর কোনো shop নেই। কার্ডের
  gold/amber accent, প্রথম position — অপরিবর্তিত

**Verified:** ক্লিন `npm install && npm run build` পাস করেছে, কোনো
error/warning ছাড়া।

### UI — ধাপ ৪-৫ সম্পন্ন: My Requests/My Accepted পেজ + Admin dashboard

- **`src/pages/ErrandMyRequests.jsx`** (নতুন ফাইল, route
  `/services/errands/mine`) — দুইটা ট্যাব:
  - **"আমার পোস্ট করা"**: `subscribeMyErrandRequests(uid)` — নিজের
    পোস্ট করা সব request (any status)
  - **"আমি রাজি হয়েছি"**: `subscribeMyAcceptedErrandRequests(uid)` —
    যেগুলোতে accept দিয়েছি, নেস্টেড `.request` object থেকে card-এর
    দরকারি ফিল্ড বের করে flatten করা হয়
  - উভয় ট্যাব `ServiceOrdersHub.jsx`-এর established pattern অনুসরণ
    করে: active/done/closed গ্রুপিং, progress bar, tap-card-to-open-
    modal — কিন্তু detail modal-এর জন্য নতুন কম্পোনেন্ট লেখা হয়নি,
    `ErrandFeed.jsx`-এর `RequestDetailModal` সরাসরি reuse করা হয়েছে
    (`ErrandFeed.jsx`-এ `RequestDetailModal`, `useRequesterIdentity`,
    `ErrandDeadline` এখন named export)
  - `App.jsx`-এ `/services/errands/mine` route যোগ হয়েছে

- **Admin dashboard** — Founder-এর "Service Providers" ক্যাটাগরির
  অধীনে নতুন subcategory "Errand Requests" যোগ হয়েছে
  (`founderCategories.js`, `providers` ক্যাটাগরির subcategories-এ)।
  `AdminDashboard.jsx`-এর `ProviderManagementView` কম্পোনেন্টে নতুন
  `subTab === 'errands'` ব্র্যাঞ্চ — `getAllErrandAcceptsForAdmin()`
  দিয়ে one-shot fetch (live subscription না, launch-sized dataset
  ধরে নিয়ে), শুধু ট্যাব খোলা হলে lazy-load হয়। প্রতিটা accept-এর
  acceptor নাম/ফোন, status (waiting/confirmed/rejected রঙ-কোডেড),
  request ID, accepted-at টাইমস্ট্যাম্প দেখায়। কোনো নতুন top-level
  ক্যাটাগরি বানানো হয়নি — এটা এখনো conceptually "Campus Services"
  ক্লাস্টারেরই অংশ, শুধু আর shop-based না।

**Verified:** এই পরিবর্তনগুলোসহ আবার ক্লিন `npm install && npm run
build` পাস করেছে।

### বাগ ফিক্স — chip strip-এ পুরনো path (owner deploy করার পর ধরা পড়েছে)

Deploy করার পর owner স্ক্রিনশট দিয়ে দেখান: Campus Life-এর top chip
strip-এ "Pick n Drop" চিপ ক্লিক করলে এখনো পুরনো
`/services/category/errand` route-এ যাচ্ছে ("No shops in this category
yet")। কারণ — **এই chip strip `Services.jsx`-এর কার্ড গ্রিড থেকে
সম্পূর্ণ আলাদা একটা static config**:

- `src/nav.js` (student sidebar/chip strip) — `services-errand` entry-র
  `path` হার্ডকোডেড ছিল `/services/category/errand`
- `src/nav-faculty.js` (faculty-side একই) — একই সমস্যা

আমি আগে শুধু `Services.jsx`-এর কার্ড গ্রিডের ক্লিক-হ্যান্ডলার বদলেছিলাম
(errand card যেটা `/services`-এ দেখা যায়), কিন্তু `nav.js`/
`nav-faculty.js`-এর এই আলাদা chip strip config দুটো মিস করে গিয়েছিলাম
— দুটোই এখন `/services/errands`-এ পয়েন্ট করছে।

(`/services/errands` সরাসরি URL দিলে "This service couldn't be found"
দেখানোটা এই বাগ না — সেটা নতুন build deploy না হওয়ার লক্ষণ ছিল, deploy
করার পরে ঠিক হয়ে যাওয়ার কথা, যেহেতু route App.jsx-এ সঠিক জায়গায়
আগে থেকেই আছে।)

**পরিবর্তিত ফাইল**: `src/nav.js`, `src/nav-faculty.js`

**Verified:** আবার ক্লিন `npm install && npm run build` পাস করেছে।

### পুরনো `/services/category/errand` route — কেন এখনো আছে, কিন্তু এখন redirect করে

Owner-এর প্রশ্ন: পুরনো route-টা কেন এখনো আছে, সরিয়ে ফেলা উচিত না?

**কেন পুরো route সরানো যায় না**: `/services/category/:categoryType`
route-টা (`CategoryShopList` component, `App.jsx`-এ declare করা) salon,
hotel, medicine, bookstore, onlinemart — এই ৫টা category-র জন্য এখনো
সক্রিয়ভাবে ব্যবহৃত হচ্ছে (এরা এখনো সবাই shop-based)। এই route/component
সরিয়ে দিলে ওই ৫টা category-ই ভেঙে যাবে — শুধু errand-এর জন্য এই
shared route/component ডিলিট করা সম্ভব না।

**যা করা হয়েছে**: `CategoryShopList` কম্পোনেন্টে একটা redirect যোগ করা
হয়েছে — `categoryType === 'errand'` হলে সাথে সাথে `/services/errands`
(আসল নতুন ফিড)-এ পাঠিয়ে দেয় (`navigate(..., { replace: true })`, তাই
browser history-তে dead route থাকে না)। বাকি ৫টা category-র জন্য এই
কম্পোনেন্ট আগের মতোই কাজ করে, কোনো পরিবর্তন নেই।

**ফলাফল**: কেউ যদি পুরনো bookmark/লিংক দিয়ে
`/services/category/errand`-এ যায়, সাথে সাথে সঠিক জায়গায় বাউন্স হয়ে
যাবে — "No shops in this category yet" আর কখনো দেখাবে না।

**পরিবর্তিত ফাইল**: `src/pages/Services.jsx` (`CategoryShopList`)

**Verified:** আবার ক্লিন `npm install && npm run build` পাস করেছে।



Owner ধরিয়ে দিয়েছিলেন: request finish হয়ে গেলে সেই ছবি R2-তে পড়ে থাকার
কোনো মানে নেই। খুঁজতে গিয়ে দুটো real bug পাওয়া গেছে, দুটোই ফিক্স
করা হয়েছে:

1. **Upload আসলে কখনোই কাজ করত না** — `service-images-worker`-এর
   `ownsService()` চেক করে `services/{id}` ডকুমেন্ট, কিন্তু errand
   request থাকে `errandRequests/{id}`-এ। ফলে errand ছবি আপলোড করলে
   worker সবসময় "Not authorized" রিটার্ন করত — কিন্তু আমার আগের কোডে
   এই fail সাইলেন্টলি catch হয়ে যেত (non-blocking try/catch), তাই কেউ
   খেয়ালই করত না। **Fix**: worker-এ নতুন `ownsErrandRequest()` চেক
   যোগ হয়েছে, `errands/{requestId}/...` নামের আলাদা key prefix
   (আগের `services/{serviceId}/...`-এর পাশাপাশি), upload/delete দুটো
   route-ই এখন `kind` ফিল্ড দেখে কোন চেক ব্যবহার করবে ঠিক করে।
2. **Create-then-patch flow rules-এর সাথে মিলত না** — doc তৈরি হওয়ার
   পর আলাদা `updateDoc({itemImageUrl})` কল rules-এর 4-transition
   whitelist-এ পড়ত না, reject হতো। **Fix**: নতুন flow —
   `generateErrandRequestId()` দিয়ে আগে থেকে id বানানো →
   `createOpenErrandRequest({requestId, ...})` দিয়ে doc তৈরি (ছবি
   ছাড়া) → এখন doc-টা exist করে বলে worker upload authorize করে →
   `patchErrandRequestImage()` দিয়ে URL বসানো (`firestore.rules`-এ
   নতুন ৫ম update-branch, শুধু `itemImageUrl`+`updatedAt` diff-এর
   জন্য, শুধু `open` স্ট্যাটাসে)

**Storage cleanup (মূল অনুরোধ)**: `finishErrandRequest()` আর
`cancelErrandRequest()` এখন request finish/cancel হওয়ার পরে
best-effort ভাবে `deleteServiceImage()` কল করে R2 থেকে ছবিটা মুছে
দেয়। `itemImageUrl` ফিল্ডটা doc-এ থেকে যায় (মুছে ফেলা হয় না) — কারণ
সেটা মুছতে গেলে rules-এর status-transition-only diff-এর বাইরে
আরেকটা write লাগত, আর finished/cancelled request কোথাও দেখানো হয়
না বলে ওই স্টেল URL আসলে অদৃশ্য/নিরীহ। Worker-এর delete route এখন
requester **এবং** confirmed acceptor দুজনকেই authorize করে (যেহেতু
finish দুইজনের যে কেউ করতে পারে)।

**পরিবর্তিত ফাইল**: `service-images-worker/src/index.js`,
`src/lib/serviceImageUpload.js` (kind param, errands/ prefix
delete-allow), `src/lib/errandRequests.js`
(`generateErrandRequestId`, `patchErrandRequestImage`,
`deleteErrandImageIfAny`), `src/pages/ErrandFeed.jsx` (post flow
reorder), `firestore.rules` (৫ম update branch)।

**⚠️ Worker আবার deploy করতে হবে** — `service-images-worker/`-এ কোড
বদলেছে, শুধু Firestore rules/indexes deploy করলে হবে না, worker-ও
নতুন করে deploy করতে হবে (`wrangler deploy` বা যেভাবে আগে করা
হয়েছিল)।

**Verified:** ক্লিন `npm install && npm run build` আবার পাস
করেছে। **তবে real worker/R2-এর বিরুদ্ধে লাইভ টেস্ট করা হয়নি** —
deploy করার পরে actual upload → finish → R2-তে ছবি আসলেই delete
হচ্ছে কিনা owner-কে হাতে চেক করে দেখতে হবে।

**বাকি (এখনো owner-side/পরের সিদ্ধান্তের অপেক্ষায়):**
- পুরনো কোড cleanup (ServiceDetail.jsx-এর `ErrandForm`/
  `MyActiveErrand`, serviceSync.js-এর পুরনো shop-based errand
  ফাংশন) — **ইচ্ছাকৃতভাবে touch করা হয়নি**, legacy ডেটার কারণে owner
  confirm করার আগে সরানো হবে না বলে hand-off prompt-এ স্পষ্ট বলা ছিল
- Deploy (`firebase deploy --only firestore:rules,firestore:indexes`
  + frontend build/Vercel push) — **owner-কে করতে হবে**, নাহলে নতুন
  কালেকশন "Missing or insufficient permissions" দেবে

## এই ফাইলে নতুন কাজ যোগ করার নিয়ম

নতুন কোনো আপডেট/বাগফিক্স/ফিচার এলে —
- **"সর্বশেষ অবস্থা"** সেকশনটা আপডেট করো নতুন তথ্য দিয়ে
- বড় কোনো পরিবর্তন হলে **"এখন পর্যন্ত যা হয়েছে"** লিস্টে একটা নতুন
  পয়েন্ট যোগ করো (তারিখসহ, চাইলে)
- বিস্তারিত টেকনিক্যাল স্পেসিফিকেশন (যদি খুব বড় হয়) দরকার হলে
  `00-old-data/`-তে না দিয়ে সরাসরি এই ফোল্ডারেই একটা নতুন সাপোর্টিং
  ফাইল রাখতে পারো, কিন্তু status/summary সবসময় এই `CURRENT.md`-তেই
  থাকবে।
