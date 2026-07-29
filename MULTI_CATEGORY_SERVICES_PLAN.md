# KUETx — Multi-category Service Provider support — full implementation prompt (v2, merged)

## এই ডকুমেন্ট কাকে দেওয়া হচ্ছে এবং কীভাবে ব্যবহার হবে

তুমি (AI bot) এই প্রজেক্টের আগের কোনো কথোপকথন দেখনি — এই ফাইলটাই তোমার একমাত্র
context। এটা KUETx (KUET student PWA) রিপোর জন্য একটা সম্পূর্ণ, চূড়ান্ত করা
কাজের প্ল্যান, যেটা পুরনো booking/inquiry split প্ল্যান এবং নতুন category-browse
+ location + delivery + dormant-shop + Online Mart প্ল্যান — দুইটা একসাথে merge
করে লেখা। **কোনো নতুন প্রশ্ন করার দরকার নেই** — নিচে যা লেখা আছে সেটাই চূড়ান্ত
সিদ্ধান্ত, শুধু বাস্তবায়ন করতে হবে।

**কাজের ধরন:** এই প্ল্যান Phase 0 থেকে শুরু করে ধাপে ধাপে বাস্তবায়ন হবে।
প্রতিটা Phase আলাদা সেশনে হতে পারে (তুমি এই ফাইলের আগের কনটেক্সট নাও দেখে
থাকতে পারো) — তাই প্রতিটা Phase শুরুর আগে অবশ্যই এই ফাইলের "Progress
tracking" সেকশন পড়ে দেখো আগের কোন Phase পর্যন্ত হয়েছে, তারপর পরের
Phase-টাই কাজ করো, আগের কোনো Phase পুনরাবৃত্তি বা স্কিপ কোরো না। প্রতিটা
Phase শেষে zip + updated markdown ফাইল আলাদা করে দেবে (নিচের "Phase শেষে
বাধ্যতামূলক" অংশ দ্রষ্টব্য) — ব্যবহারকারী সেটা রিভিউ করে ঠিক থাকলে পরের
Phase-এর নির্দেশ দেবে।

কাজ শুরুর আগে অবশ্যই repo-র এই ফাইলগুলো পড়ে নাও, কারণ এই প্ল্যান সেগুলোর
existing structure-এর ওপর ভিত্তি করে লেখা, প্রতিস্থাপন করার জন্য না:

- `SERVICES_PROVIDER_PLAN.md` (repo root) — মূল Services/Provider marketplace
  স্পেসিফিকেশন, salon প্রথম service হিসেবে approved
- `_services_provider_progress/PROGRESS.md` — Phase 1-3 এর implementation
  progress log (সব already DONE হিসেবে marked)
- `src/lib/serviceSync.js`, `src/lib/providerSync.js` — বর্তমান backend logic
- `src/pages/provider/ProviderDashboard.jsx`, `src/pages/ServiceDetail.jsx`,
  `src/pages/Services.jsx` — বর্তমান UI
- `src/components/AuthModal.jsx`, `src/lib/providerPhoneAuth.js` — provider
  signup (phone নাম্বার ভিত্তিক login, ইতিমধ্যে ঠিক করা হয়েছে, এই ফাইলে
  আর হাত দেওয়ার দরকার নেই)
- `firestore.rules` — এই প্ল্যানের সব Firestore rule change এই ফাইলে যোগ
  হবে, প্রতিস্থাপন না
- `src/nav.js` — বর্তমান sidebar/bottom-nav গ্রুপ হায়ারার্কি (Overview, Class
  Rep, Academics, Campus Life, Daily Life, Tools) — Services এর entry point
  এই ফাইলের Campus Life গ্রুপের ভেতরেই থাকবে, নতুন top-level গ্রুপ বানানো
  হবে না

---

## পটভূমি — কেন এই প্ল্যান দরকার হলো

Salon-এর জন্য যে booking সিস্টেম বানানো হয়েছিল (pending → confirmed → done,
preferred time picker, "Finish" চাপলে দাম বসিয়ে revenue যোগ) সেটা ধরে নেয়:

- একজন owner, একটা physical জায়গা, সময়ভিত্তিক slot booking
- এক booking = এক offering (কোনো multiple item/quantity নেই)
- Offerings-এর নিজস্ব দাম নেই — শুধু service-level `priceNote` (free text)

এই মডেল সেলুন এবং হোটেল/খাবারের জন্য মোটামুটি ঠিক আছে। কিন্তু মেডিসিন শপ,
বই/স্টেশনারি/ফটোকপি এবং নতুন Online Mart category-র জন্য এই মডেল
**owner-এর দৃষ্টিকোণ থেকে ভুল ফিট** — এই category-গুলোতে owner দ্রুত
"আছে/নাই" উত্তর দিতে চায়, সময়ভিত্তিক queue বা booking manage করতে চায় না।

সেই সাথে এখন প্রয়োজন হয়েছে:

- Services-কে category-wise browse করার UI (এখন সব provider এক লিস্টে মেশানো)
- Provider-এর শপের location (free-text address)
- Home delivery আছে কিনা flag, যেটা student profile থেকে on/off করতে পারবে
- দীর্ঘদিন inactive/dormant শপ আলাদাভাবে চিহ্নিত করা, বাতিল না করে
- Online Mart — fixed shop ছাড়া, শুধু delivery-ভিত্তিক বিক্রেতাদের জন্য নতুন
  category, image upload সহ

তাই backend data model (Firestore schema, provider auth, verification flow,
dashboard shell) সব category-র জন্য **এক এবং অভিন্ন** থাকবে, কিন্তু
booking/inquiry layer এবং browse/discovery layer-এ নতুন কাঠামো যোগ হবে।

---

## Phase 0 — Repo reconnaissance ফলাফল (already done, নিচের সিদ্ধান্তগুলো চূড়ান্ত)

repo zip (`kuetx-fixed`) দেখে নিচের প্রতিটা প্রশ্নের উত্তর পাওয়া গেছে এবং
সেই অনুযায়ী উপরের/নিচের সব Phase-এর ডিটেইল **এই ফলাফল ধরেই** লেখা —
implementation-এর আগে আবার এগুলো re-verify করার দরকার নেই, শুধু নিচের
সিদ্ধান্তগুলো অনুসরণ করলেই হবে।

**১. Field নাম সংশোধন (গুরুত্বপূর্ণ)** — `src/lib/serviceSync.js`-এর
`createService()` দেখে যা পাওয়া গেছে: বর্তমান schema-তে category বোঝানোর
ফিল্ডের নাম **`type`** (যেমন `type: 'salon'`), **`serviceType` নামে কোনো
ফিল্ড নেই**। এই পুরো প্ল্যানের বাকি অংশে যেখানেই "serviceType" লেখা
আছে, ধরে নিতে হবে সেটা আসলে বিদ্যমান **`type`** ফিল্ডকেই বোঝাচ্ছে —
নতুন কোনো প্যারালাল ফিল্ড বানানো হবে না, existing `type` ফিল্ডের enum-এই
`'onlinemart'` value যোগ হবে।

**২. Routing pattern** — `src/App.jsx`-এ ইতিমধ্যে nested route প্যাটার্ন
আছে: `/services` এবং `/services/:serviceId`। তাই category browse-ও একই
প্যাটার্নে **nested route** হবে: `/services` (category grid) →
`/services/category/:categoryType` (filtered shop list) →
`/services/:serviceId` (detail, অপরিবর্তিত)। Query param ব্যবহার হবে না।

**৩. Dormant auto-detection mechanism** — `functions/index.js`-এ বর্তমানে
শুধু `onDocumentCreated` ও `onCall` triggers আছে (notice/group/faculty/OTP
সংক্রান্ত), **কোনো scheduled/cron function নেই**। নতুন scheduled function
(`onSchedule`, firebase-functions/v2/scheduler) যোগ করাই এই প্ল্যানে
ব্যবহৃত হবে — Phase 2-তে এটাই default approach, client-side lazy-check না।

**৪. Cloudflare R2 — bucket আছে কিন্তু ভিন্ন উদ্দেশ্যে** — `cloudflare-worker/`
এ যে worker আছে সেটা সম্পূর্ণভাবে **Question Bank PDF সিস্টেমের জন্য**
(bucket bindings `QB_BUCKET`/`QB_STAGING_BUCKET`, শুধু PDF routে
approve/reject/stage, department/term/course-ভিত্তিক key naming)। এটা
generic image-upload worker না — Services-এর product image upload-এর জন্য
সরাসরি reuse করা যাবে না। **সিদ্ধান্ত:** একই Cloudflare অ্যাকাউন্টে
**নতুন একটা R2 bucket** (যেমন `kuetx-service-images`) ও worker-এর ভেতরে
**নতুন route** (existing question-bank worker-এ না জুড়ে, বরং সেই worker-এরই
কাঠামো/auth-verification প্যাটার্ন — Firebase ID-token verify করার
Web-Crypto-ভিত্তিক অংশ — copy করে নতুন lightweight endpoint বানানো, যেহেতু
সেই token-verification কোড pure fetch+WebCrypto, কোনো dependency ছাড়াই
reuse-যোগ্য) — bucket infrastructure নতুন লাগবে, কিন্তু auth-verification
approach reuse হবে।

**৫. Rich text description — reuse নিশ্চিত** — `src/lib/noticeFormat.jsx`-এ
আগে থেকেই একটা হালকা, dependency-free markdown-subset renderer আছে
(`**bold**`, `*italic*`, `==highlight==`, `#/##/### heading`, `- bullet`,
`1. numbered`, `renderFormattedNoticeBody()` + `flattenNoticePreview()`)।
**এটাই সরাসরি reuse হবে** offering description-এর জন্য — নতুন কোনো
markdown library আনা হবে না। প্রয়োজনে ফাইলের নাম/export generalize করা
যেতে পারে (যেমন `formatUtils.jsx`-এ move, বা যেমন আছে তেমনই import করে
ব্যবহার) কিন্তু parsing logic নতুন করে লেখা হবে না।

**৬. Category card grid layout** — `src/pages/Services.jsx` বর্তমানে
একটা **flat vertical list** (grid না, প্রতিটা card ফুল-উইথ row, ৪৪px আইকন
+ Circle status dot + name + queue count)। কোনো existing card-grid
pattern repo-তে নেই যেটা copy করা যায় — category grid **নতুন করেই
বানাতে হবে**। ডিফল্ট: mobile-এ ২-কলাম CSS grid, প্রতিটা category card-এ
আইকন + নাম + active-shop count, বর্তমান `Services.jsx`-এর রঙ/spacing/
CSS-variable প্যাটার্ন (`var(--accent)`, `var(--accentSoft)`, `var(--text)`,
`var(--muted)`, `var(--border)`, `.card` class) অনুসরণ করে theme-consistent
রাখতে হবে।

### Phase 0.5 — গভীর কোড রিভিউ (exact function/rule/field-level facts)

উপরের ৬টা প্রশ্নের বাইরেও, Phase 1-7 লেখার আগে নিচের ফাইলগুলো **সম্পূর্ণ
পড়া হয়েছে** (গ্রেপ না, পুরো ফাইল): `src/lib/serviceSync.js` (৬১৬ লাইন),
`src/pages/provider/ProviderDashboard.jsx` (৬৩১ লাইন),
`src/pages/ServiceDetail.jsx` (২৬৯ লাইন), `src/lib/bookingAlerts.js`,
`src/nav.js`-এর Campus Life গ্রুপ, `firestore.rules`-এর
`services`/`bookings`/`confirmedStudents`/`activeBooking` ম্যাচ ব্লক।
এখান থেকে যা যা exact detail বেরিয়েছে, যা প্রতিটা Phase-এর ভিত্তি:

- **`createService(providerUid, { type, name, description, priceNote })`**
  — exact signature, batch-এ `providers/{uid}.serviceIds` array-ও আপডেট
  হয়। নতুন optional params (`locationText`, `hasDelivery`) এই একই
  ফাংশনের destructured argument-এ যোগ করতে হবে, বাকি logic (batch,
  serviceIds sync) অপরিবর্তিত রাখতে হবে।
- **`ServiceSetupForm` (ProviderDashboard.jsx লাইন ৯৬-১৪৩) বর্তমানে
  `type: 'salon'` hardcoded পাঠায়** — provider onboarding ফর্মে category
  select করার কোনো UI **এখনো নেই**। Phase 3-এ এই ফর্মে category dropdown
  (Salon/Medicine/Hotel/Bookstore/Online Mart) যোগ করা **বাধ্যতামূলক
  নতুন কাজ**, শুধু existing field যোগ করা না — এটা একটা gap যেটা আগের
  ড্রাফটে explicit ছিল না।
- **Offerings array shape সঠিক**: `{ id, label, isAvailable }`,
  `setServiceOfferings(serviceId, offerings)` পুরো array replace করে
  (partial update না) — নতুন `price`/`images` ফিল্ড যোগ করার সময়
  `OfferingsManager` কম্পোনেন্ট-এর `addOffering`/`toggleOffering`/
  `removeOffering` — এই তিনটা ফাংশনের object literal-এ নতুন ফিল্ড যোগ
  করে পুরো array-ই save করতে হবে, ঠিক এই একই প্যাটার্নে।
- **Booking doc-এর exact ফিল্ড সেট** (`createBooking`-এর batch.set থেকে):
  `studentUid, studentName, studentPhone, offeringId, preferredTime,
  requestedAt, status, cancelledBy, confirmedSlot`। Inquiry mode-এ নতুন
  `items` array যোগ হলে `offeringId` (single) থাকবে কিনা বাদ যাবে সেটা
  Phase 2-তে explicit সিদ্ধান্ত (নিচে দ্রষ্টব্য) — booking mode-এর জন্য এই
  পুরনো shape অক্ষত থাকবে।
- **`activeBooking/{studentUid}` marker doc** — booking create-এর একই
  batch-এ লেখা হয়, "one active booking per service" backend-enforce করে
  (client read-then-write + rules-এর `hasNoActiveBooking()` দুই স্তরে)।
  Inquiry mode-এও multi-item inquiry create করার সময় এই একই marker
  প্যাটার্ন অনুসরণ করতে হবে যদি "এক student-এর একটাই active inquiry per
  shop" নিয়ম রাখা হয় (Phase 2-তে এই সিদ্ধান্ত স্পষ্ট করে লেখা আছে)।
- **Firestore rules-এর transition pattern**: প্রতিটা booking status
  transition আলাদা `||` branch, প্রতিটাতে
  `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`
  দিয়ে ঠিক কোন ফিল্ড বদলাতে পারবে সেটা lock করা। Inquiry-এর নতুন
  transition-ও (`open`→`answered`, `open`→`closed`) ঠিক এই same প্যাটার্নে
  লিখতে হবে — নতুন কোনো different rule-style চালু করা হবে না।
- **Offering-bookability check rules-এ bounded recursion দিয়ে করা**
  (`_offeringMatches`/`_anyOfferingBookable`, সর্বোচ্চ ১০টা offering পর্যন্ত
  index করে) — কারণ Firestore rules-এ loop/lambda নেই। Multi-item
  inquiry-এর rules লেখার সময় (প্রতিটা `items[]` entry-র `quantity > 0` চেক)
  এই same bounded-recursion টেকনিক লাগবে, `.filter()`/arrow-function কাজ
  করবে না।
- **`queueBookingAlertWrite(batchOrTx, uid, { kind, serviceId, bookingId,
  serviceName, message })`** — exact signature; নতুন inquiry alert kind
  (`inquiry_answered`, `new_inquiry` ইত্যাদি) এই একই ফাংশন কল করেই পাঠাতে
  হবে, নতুন alert-writing ফাংশন বানানো হবে না।
- **`nav.js`-এ Services entry ইতিমধ্যে আছে** (`{ id: 'services', label:
  'Services', icon: 'Store', accent: 'blue', path: '/services' }`,
  Campus Life subgroup-এর ভেতরে) — Phase 6-এ nav.js-এ **কোনো পরিবর্তন
  লাগবে না**, শুধু `/services` রুটের ভেতরের component বদলাবে।
- **Home page ফাইল হলো `src/pages/Dashboard.jsx`** (৪০৬ লাইন) — এখানে
  কোনো Services-সম্পর্কিত section এখনো নেই, তাই Home preview row সম্পূর্ণ
  নতুন কম্পোনেন্ট, existing অংশ বদলানো লাগবে না, শুধু যোগ করতে হবে।
- **`Collapsible` কম্পোনেন্ট** (`src/components/Collapsible.jsx`)
  ProviderDashboard-এ কম-প্রায়োগিক sections (Offerings, revenue, details
  editor) collapse করতে ব্যবহৃত হয় — নতুন location/delivery/image/status
  fields-ও এই same `Collapsible` প্যাটার্নে বসবে, নতুন UI primitve বানানো
  হবে না।

---

## চূড়ান্ত সিদ্ধান্ত — কী same থাকছে, কী আলাদা হচ্ছে

### Same থাকছে (সব category-র জন্য, কোনো পরিবর্তন নেই)

- `providers/{uid}` schema, verification flow (pending/verified/rejected/
  deactivated), Founder manual verify, provider phone+password login
- `services/{serviceId}` টপ-লেভেল schema-র মূল কাঠামো (name, description,
  providerUid) — নতুন ফিল্ড যোগ হবে, পুরনো কিছু বাদ যাবে না
- Provider dashboard-এর shell — Open/Closed টগল, offerings management,
  revenue tracker section headers — এইগুলোর জায়গা/অবস্থান বদলায় না
- Firestore rules-এর কাঠামো (owner/Founder/student read-write split)
- Deactivation cascade (booking mode-এর জন্য existing), no-show tracking,
  alert/notification প্যাটার্ন
- Sidebar/bottom-nav গ্রুপ হায়ারার্কি — Services, Campus Life গ্রুপের ভেতরেই
  submenu হিসেবে থাকবে, নতুন top-level nav item হবে না

### আলাদা হচ্ছে (category-অনুযায়ী)

একটা নতুন ফিল্ড: **`services/{serviceId}.interactionMode`**, value
`'booking' | 'inquiry'`।

| Category | type | interactionMode | কারণ |
|---|---|---|---|
| সেলুন | salon | booking | সময়ভিত্তিক slot, physical presence দরকার |
| হোটেল/খাবার | hotel | booking | সিট/সময়ভিত্তিক, multi-item সীমাবদ্ধতা নিয়েই থাকবে (নিচে দ্রষ্টব্য) |
| মেডিসিন শপ | medicine | inquiry | স্টক-ভিত্তিক প্রশ্ন, সময়ের প্রয়োজন নেই |
| বই/স্টেশনারি/ফটোকপি | bookstore | inquiry | walk-in-heavy, দ্রুত প্রশ্ন-উত্তর |
| **Online Mart (নতুন)** | **onlinemart** | **inquiry** | কোনো fixed shop নেই, শুধু delivery — product showcase + multi-item request |

**booking mode** = বর্তমান সিস্টেম প্রায় অপরিবর্তিত (pending→confirmed→done
state machine, preferred time picker, PendingQueue UI)।

**inquiry mode** = নতুন, হালকা flow:
- কোনো preferred time picker নেই
- Booking state machine এর বদলে সরল দুই-অবস্থার message: `open` → `answered`
  (owner উত্তর দিলে) অথবা `closed` (ছাত্র নিজে বন্ধ করলে)
- Owner dashboard-এ "Pending bookings queue" এর বদলে "Pending inquiries"
  লিস্ট — কনফার্ম/ফিনিশ বাটনের বদলে একটা reply/answer বাটন
- কোনো revenue tracking নেই inquiry-তে
- **একই shop-এর ভেতরে একাধিক offering/item + quantity একসাথে একটা inquiry
  doc-এ পাঠানো যাবে** (নিচে "Multi-item inquiry" সেকশন দ্রষ্টব্য)

### Offerings-এ প্রতিটা item-এর নিজস্ব দাম

`offerings: [ { id, label, isAvailable } ]` structure-এ optional `price`
(number) ফিল্ড যোগ হবে। সেলুন/হোটেল চাইলে service-level `priceNote`
ব্যবহার চালিয়ে যেতে পারবে (backward compatible)।

### হোটেল/খাবারের multi-item সমস্যা — এই প্ল্যানে সমাধান করা হচ্ছে না

হোটেল/খাবার আপাতত `booking` mode-এ থাকবে, এক বুকিং = এক offering
সীমাবদ্ধতা নিয়েই — ভবিষ্যতে আলাদা প্ল্যান হিসেবে বিবেচনা করা হবে।

### Multi-item inquiry (নতুন — Online Mart / medicine / bookstore-এর জন্য)

- inquiry mode-এ booking doc-এ single `offeringId`-এর বদলে
  `items: [ { offeringId, label, price, quantity } ]` array থাকবে
- **Single-shop-scoped**: এক inquiry-তে শুধু একটা service/shop-এর item
  থাকতে পারবে। একাধিক শপ থেকে একসাথে অর্ডার করার (Daraz-এর মতো multi-shop
  cart) সাপোর্ট **এই প্ল্যানের scope-এ নেই** — কারণ multi-shop cart আসলে
  backend-এ প্রতি-শপ আলাদা order-split, আলাদা delivery/inventory tracking
  দাবি করে, যেটা hotel-এর multi-item সমস্যার মতোই সম্পূর্ণ আলাদা
  architecture। ছাত্র আলাদা শপের জিনিস চাইলে আলাদা আলাদা inquiry পাঠাবে
  (এখন যেমন আলাদা booking করে)
- নতুন cart collection লাগবে না — student-side UI-তে "cart" শুধু একটা
  local (client-state) selection, submit করলে একটাই inquiry doc তৈরি হয়

### Category browse — নতুন discovery layer

বর্তমানে `Services.jsx` সব provider-এর service একসাথে দেখায়। নতুন flow:

1. Services page ওপেন করলে প্রথমে **category card grid** দেখাবে (Salon,
   Medicine, Hotel/Food, Bookstore, Online Mart) — প্রতিটা কার্ডে
   category-র নাম, আইকন, কতগুলো active shop আছে তার count
2. একটা category কার্ডে click করলে সেই category-র সব shop/provider-এর
   card list দেখাবে (বর্তমান Services.jsx layout, কিন্তু filtered)
3. একটা shop card-এ click করলে বর্তমান `ServiceDetail.jsx`-এর মতো ডিটেইল
   পেজ খুলবে

**Entry point:** এই পুরো flow Campus Life submenu-এর ভেতরেই থাকবে (nav
ভারী করার দরকার নেই)। এর পাশাপাশি Home page-এর নিচের দিকে একটা ছোট preview
row থাকবে — ৫টা category card + "See all" লিংক, যেটা সরাসরি category
grid page-এ নিয়ে যাবে।

### Location (provider-side, free text)

- `services/{serviceId}`-এ নতুন optional ফিল্ড `locationText` (string,
  free text, যেমন "Hall-3 Gate", "Fazlul Haque Hall market")
- Online Mart-এর জন্য এই ফিল্ড খালি/N-A থাকবে (fixed shop নেই)
- Student-side location নেওয়া হবে না এই ফেজে — শুধু provider তার নিজের
  location সেট করবে, ডিটেইল পেজে দেখাবে

### Home delivery flag

- `services/{serviceId}`-এ নতুন boolean ফিল্ড `hasDelivery` (default
  `false`)
- Provider dashboard-এ toggle থাকবে
- Student ServiceDetail পেজে "Home delivery available" ব্যাজ দেখাবে যদি true
- Online Mart-এর জন্য এটা কার্যত সবসময় true থাকবে (fixed shop নেই মানে
  delivery-ই একমাত্র পথ) — কিন্তু ফিল্ডটা সাধারণ রাখা হচ্ছে যাতে ভবিষ্যতে
  অন্য category-ও ব্যবহার করতে পারে

### Shop status — তিন bucket + manual pause flow

বর্তমান Open/Closed টগলের পাশাপাশি নতুন **dormant** bucket:

- **Open** / **Closed** — আগের মতোই দৈনিক টগল, বদলায় না
- **Dormant** — নতুন bucket, দুইভাবে সেট হতে পারে:
  - **Automatic**: system detect করবে যদি (ক) কোনো offering/product
    `isAvailable: true` না থাকে (সব sold out) **এবং** (খ) নতুন কোনো
    offering যোগ/আপডেট হয়নি, **এবং** (গ) এই অবস্থা **১৪ দিন** ধরে
    continuous থাকে — তাহলে service auto-flag হয়ে dormant bucket-এ যাবে
  - **Manual**: owner dashboard থেকে "Deactivate" চাপলে দুইটা option
    দেখাবে:
    1. **Temporary pause** — শপ dormant bucket-এ যাবে, owner যেকোনো সময়
       "Reactivate" চেপে ফিরিয়ে আনতে পারবে, ডেটা/offerings সব অক্ষত থাকবে
    2. **Permanent close** — শপ dormant bucket-এ যাবে এবং provider profile-এ
       "closed" হিসেবে চিহ্নিত হবে (Founder-level review ছাড়া নিজে থেকে আর
       reactivate করা যাবে না)
    - যেটা বেছে নেবে তার জন্য একটা ছোট explainer text দেখাবে ("Temporary
      pause করলে ... হবে" / "Permanent close করলে ... হবে"), তারপর confirm
      ধাপ
- Dormant bucket-এর শপ student-facing category list-এ **বাদ পড়বে না**,
  কিন্তু list-এর নিচে/আলাদা "Currently inactive" sub-section-এ কম-প্রাধান্যে
  দেখাবে

### Image upload (Cloudflare R2 bucket)

- সব category-র জন্য প্রযোজ্য (শুধু Online Mart না):
  - প্রতিটা **service/shop**-এর একটা cover/profile image
  - প্রতিটা **offering/product**-এর জন্য সর্বোচ্চ **৩টা** image
- Upload সীমা: প্রতি ছবি সর্বোচ্চ **1MB**
- Storage: নতুন Cloudflare R2 bucket + নতুন worker route (existing
  question-bank worker আলাদা কাজের জন্য, reuse হবে না — শুধু তার
  token-verification কোড reuse হবে; বিস্তারিত Phase 0 ফলাফল দ্রষ্টব্য)
- UI reference/inspiration: Daraz, Apple-এর product gallery প্যাটার্ন থেকে
  আইডিয়া নিয়ে KUETx-এর existing থিমে (রং, টাইপোগ্রাফি, spacing) মানিয়ে
  বানানো হবে — কপি-পেস্ট করা হবে না, শুধু layout logic থেকে অনুপ্রাণিত

### Rich text description (Online Mart focus, কিন্তু সব category-তে সহজলভ্য)

- Offering/product description ফিল্ডে সীমিত formatting সাপোর্ট: **bold**,
  একটা heading সাইজ (H1-এর মতো ছোট sub-heading), bullet list
- Phase 0-এ resolved: `src/lib/noticeFormat.jsx`-এর existing
  markdown-subset renderer (`renderFormattedNoticeBody`,
  `flattenNoticePreview`) সরাসরি reuse হবে অফারিং description-এর জন্য —
  নতুন কোনো markdown library আনা হবে না

---

## Phase বিভাজন

কাজ ৭টা Phase-এ ভাগ করা — প্রতিটা Phase শেষে **একটা সম্পূর্ণ zip আউটপুট
দিতে হবে**, এবং এই একই markdown ফাইলের নিচের "Progress tracking" অংশ
আপডেট করে সেটাও zip-এর ভেতরে দিতে হবে (repo root-এ
`MULTI_CATEGORY_SERVICES_PLAN.md` হিসেবে, যাতে পরের Phase-এ বা অন্য কোনো
সেশনে এই একই ফাইল পড়েই বোঝা যায় কতটুকু হয়েছে)।

**প্রতিটা Phase শেষে বাধ্যতামূলক:**
1. Syntax/parse check (Babel বা যেই টুল available, JSX সহ)
2. এই ফাইলের "Progress tracking" সেকশনে সেই Phase-এর নিচে ফলাফল লেখা
   (কী করা হলো, কোন ফাইল বদলালো, কী কী verify হলো, কী কী known gap থেকে
   গেল) — ঠিক `_services_provider_progress/PROGRESS.md`-এর টোন ও format
   অনুসরণ করে
3. পুরো repo-র (node_modules ছাড়া) zip বানিয়ে output করা
4. এই updated markdown ফাইলটাও আলাদা করে output করা (zip-এর ভেতরেও থাকবে,
   কিন্তু আলাদা ফাইল হিসেবেও দিতে হবে, যাতে পরের Phase শুরুর আগে এটা পড়েই
   fresh context নেওয়া যায়)

---

### Phase 1 — Data model বিস্তৃতি (কোনো UI পরিবর্তন নেই এই Phase-এ)

**লক্ষ্য:** নতুন সব ফিল্ড যোগ করা, migration নিশ্চিত করা, কোনো ফিচার এখনো
ব্যবহারকারীর সামনে দৃশ্যমান হবে না।

কাজ:
- `services/{serviceId}`-এ নতুন ফিল্ড:
  - `interactionMode: 'booking' | 'inquiry'` — `createService()`-এ default
    assign হবে `type` অনুযায়ী (টেবিল অনুযায়ী mapping, `onlinemart`
    সহ)
  - `locationText: string | null` (optional, free text)
  - `hasDelivery: boolean` (default `false`)
  - `status: 'open' | 'closed' | 'dormant'` এবং `dormantReason: 'auto' |
    'manual_temporary' | 'manual_permanent' | null`, `dormantSince:
    timestamp | null` — **নোট:** বিদ্যমান `isOpen` (boolean) ফিল্ড
    **বাদ যাবে না**, এটা অপরিবর্তিত থাকবে এবং booking mode-এর সব existing
    লজিক (`setServiceOpen`, `expirePendingBookingsForClosedShop`,
    rules-এর `offeringIsBookable`) ঠিক আগের মতোই `isOpen` পড়বে/লিখবে।
    নতুন `status` ফিল্ড একটা **সমান্তরাল, higher-level** ফিল্ড —
    `dormant` হলে UI dormant bucket দেখাবে, কিন্তু `isOpen` টগল নিজে
    আলাদাভাবে কাজ করতে থাকবে (owner dormant অবস্থায়ও চাইলে `isOpen`
    টগল করতে পারবে, Reactivate চাপলে `status` আবার `open`/`closed`-এ
    ফিরবে, `isOpen`-এর তখনকার value যা থাকে তাই থাকবে)
  - `coverImageUrl: string | null`
- `type` enum-এ নতুন value `onlinemart` যোগ করা
- Offerings-এর প্রতিটা item-এ optional `price` (number) এবং
  `images: string[]` (max ৩টা URL) ফিল্ড যোগ করার সাপোর্ট —
  `setServiceOfferings()`/`addOfferingId()` আপডেট, না দিলেও চলবে
- Firestore rules-এ নতুন ফিল্ডগুলোর valid value check যোগ করা
  (`interactionMode`, `type` enum-এ `onlinemart`, `status` enum)
- বিদ্যমান সেলুন service migration note — পুরোনো ডকুমেন্টে
  `interactionMode`/`status` না থাকলে UI-তে যথাক্রমে `'booking'` ও
  `'open'` হিসেবে client-side default ধরা হবে

**এই Phase-এ কোনো নতুন UI/booking-collection পরিবর্তন হবে না — শুধু schema
readiness।**

---

### Phase 2 — Inquiry mode + multi-item backend

**লক্ষ্য:** `services/{serviceId}/bookings/{bookingId}` collection পুনর্ব্যবহার
করে inquiry mode এবং multi-item request সাপোর্ট করা।

কাজ:
- `createBooking()`-এ শাখা (exact বর্তমান signature:
  `createBooking(serviceId, { studentUid, studentName, studentPhone,
  offeringId, preferredTime = null })`, বর্তমান batch.set-এর ফিল্ড:
  `studentUid, studentName, studentPhone, offeringId, preferredTime,
  requestedAt, status, cancelledBy, confirmedSlot`): `interactionMode ===
  'inquiry'` হলে `preferredTime`/`offeringId` (single) বাদ, নতুন
  `items: [{offeringId, label, price, quantity}]` array parameter নেওয়া
  হবে, status শুরু হবে `'open'`। `cancelledBy`/`confirmedSlot` inquiry
  doc-এ থাকবে না (booking-mode-নির্দিষ্ট concept), বদলে inquiry-নির্দিষ্ট
  `replyText: null` শুরুতে সেট হবে। বর্তমান booking-mode শাখা (single
  `offeringId`, `preferredTime`, `cancelledBy`, `confirmedSlot`) হুবহু
  অক্ষত থাকবে — একই ফাংশনের ভেতরে `if (interactionMode === 'inquiry')`
  branch, আলাদা ফাংশন না (single entry point বজায় রাখতে)
- **`activeBooking/{studentUid}` marker-এর same প্যাটার্ন inquiry-তেও**:
  student-এর একটা shop-এ একটাই active (open/answered) inquiry থাকতে
  পারবে — booking mode-এ যেমন `hasNoActiveBooking()` rules-এ চেক হয়,
  inquiry create-এর সময়ও এই same marker doc ব্যবহার হবে (booking আর
  inquiry উভয়েই "active" হলে একই marker সেট করবে, যেহেতু এটা
  service-স্কোপড, mode-নির্বিশেষে "এক student-এর একটাই সক্রিয়
  interaction per shop" — booking mode-এর existing নিয়মের সাথে সামঞ্জস্যপূর্ণ)
- নতুন ফাংশন `answerInquiry(serviceId, bookingId, replyText)` — status
  `'answered'`, `replyText` যোগ (booking mode-এর `confirmBooking`-এর
  transaction-guard প্যাটার্ন অনুসরণ করে, re-read status inside
  transaction যাতে ডাবল-answer রেস না হয়)
- নতুন ফাংশন `closeInquiry(serviceId, bookingId)` — status `'closed'`,
  `activeBooking` marker delete করবে (booking mode-এর `cancelBooking`-এর
  cleanup প্যাটার্নের সমতুল্য)
- `confirmBooking`, `finishBooking` — শুধু booking mode-এ, inquiry mode
  নতুন ফাংশন ব্যবহার করবে (কোনো revenue/confirmedSlot ধারণা নেই)
- Firestore rules — inquiry-এর status transition (`open`→`answered`,
  `open`→`closed`) booking mode-এর exact same প্যাটার্নে আলাদা `||`
  branch হিসেবে যোগ, প্রতিটাতে
  `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`
  দিয়ে lock করা। `items[]` array-এর প্রতিটা entry-তে `quantity > 0` check
  করতে হলে rules-এ bounded-recursion helper লিখতে হবে (existing
  `_offeringMatches`/`_anyOfferingBookable`-এর ঠিক same টেকনিক, ১০টা
  পর্যন্ত bound রেখে — Firestore rules-এ `.filter()`/লুপ নেই)
- bookingAlerts-এ inquiry-এর নতুন alert `kind` (`'new_inquiry'`,
  `'inquiry_answered'`) — existing
  `queueBookingAlertWrite(batchOrTx, uid, { kind, serviceId, bookingId,
  serviceName, message })` ফাংশনটাই কল হবে, নতুন কোনো alert-writing
  ফাংশন বানানো হবে না
- Dormant-detection backend logic: `functions/index.js`-এ নতুন
  `onSchedule` (firebase-functions/v2/scheduler) function যোগ করা —
  দিনে একবার চলবে, প্রতিটা `status: 'open'`-এর service-এ দেখবে সব
  offering `isAvailable: false` কিনা এবং শেষ offering-আপডেট ১৪ দিনের
  পুরনো কিনা — শর্ত মিললে `status: 'dormant'`, `dormantReason: 'auto'`,
  `dormantSince: serverTimestamp()` সেট করবে (Phase 0-এ resolved:
  scheduled function ব্যবহার হবে, client-side lazy check না)

---

### Phase 3 — Provider dashboard: location, delivery, image upload, status control

**লক্ষ্য:** Owner-side dashboard-এ নতুন সব ইনপুট ফিল্ড ও status control যোগ
করা।

কাজ:
- **`ServiceSetupForm` (ProviderDashboard.jsx লাইন ৯৬-১৪৩)-এ category
  select যোগ করা — এটা বাধ্যতামূলক নতুন কাজ**, কারণ বর্তমানে এই ফর্ম
  `createService()`-কে hardcoded `type: 'salon'` পাঠায়, কোনো dropdown/
  radio নেই। নতুন provider signup করলে ৫টা category (সেলুন, মেডিসিন,
  হোটেল/খাবার, বই-স্টেশনারি, Online Mart)-এর মধ্যে থেকে বেছে নেওয়ার UI
  যোগ করতে হবে, এবং সেই selection অনুযায়ী `createService()`-কে সঠিক
  `type` পাঠাতে হবে (যেটা থেকে `interactionMode` default assign হবে,
  Phase 1-এর লজিক অনুযায়ী)
- `ProviderDashboard.jsx`-এ (বা service-edit ফর্মে) নতুন ইনপুট:
  - `locationText` free-text field
  - `hasDelivery` toggle
  - Cover image upload (Cloudflare R2, max 1MB, preview + replace/remove)
  - Offering editor-এ প্রতি item সর্বোচ্চ ৩টা image upload
  - Offering editor-এ item-ভিত্তিক `price` input (ঐচ্ছিক)
  - Rich description input (bold/heading/bullet সাপোর্ট) offering-এর জন্য
- Offerings editor-এ নতুন ফিল্ড যোগ করার সময় বর্তমান
  `OfferingsManager`-এর exact প্যাটার্ন অনুসরণ করতে হবে:
  `addOffering`/`toggleOffering`/`removeOffering` — তিনটাই local state
  বদলে পুরো array `setServiceOfferings(service.id, next)`-এ পাঠায় (partial
  update না) — নতুন `price`/`images` ফিল্ড এই same object-literal-এ যোগ
  হবে, আলাদা কোনো নতুন save-function লাগবে না
- Cloudflare R2 integration (Phase 0-এ resolved: existing question-bank
  worker/bucket reuse হবে না, কারণ সেটা PDF-নির্দিষ্ট): নতুন R2 bucket
  (`kuetx-service-images` বা উপযুক্ত নাম) তৈরি, নতুন worker route বা
  নতুন ছোট worker (existing `cloudflare-worker/src/index.js`-এর
  Firebase ID-token verification অংশ — pure fetch+WebCrypto, dependency
  ছাড়া — কপি করে reuse), signed upload flow, size validation (1MB),
  delete-on-replace ফ্লো
- Status control UI (নতুন `Collapsible` section হিসেবে, existing
  Offerings/revenue/details-editor collapsible-দের same প্যাটার্নে):
  - Open/Closed টগল অপরিবর্তিত (`isOpen` boolean, `setServiceOpen()`
    ফাংশন হুবহু অক্ষত)
  - "Deactivate" বাটন → Temporary pause vs Permanent close বেছে নেওয়ার
    modal, প্রতিটার effect explain করে, তারপর confirm ধাপ
  - Dormant bucket-এ থাকা অবস্থায় "Reactivate" বাটন (শুধু
    `manual_temporary` বা `auto` reason-এর জন্য; `manual_permanent`-এর
    জন্য দেখাবে না)

---

### Phase 4 — Student-facing UI: ServiceDetail.jsx-এ শাখা + multi-item inquiry ফর্ম

**লক্ষ্য:** ছাত্র booking mode আর inquiry mode-এ সম্পূর্ণ ভিন্ন ফর্ম দেখবে,
এবং inquiry mode-এ multi-item selection করতে পারবে।

কাজ:
- `ServiceDetail.jsx`-এ `service.interactionMode` চেক করে দুইটা আলাদা
  component:
  - `booking` — বর্তমান ফর্ম অপরিবর্তিত
  - `inquiry` — নতুন ফর্ম: offering/item list থেকে multiple select করা
    যাবে, প্রতিটার পাশে quantity stepper, একটা free-text প্রশ্ন বক্স
    (ঐচ্ছিক), "প্রশ্ন/অনুরোধ পাঠান" বাটন — সব selection মিলিয়ে একটাই
    inquiry doc submit হবে (client-side local cart-state, নতুন collection
    না)
- Offering-এর `price` ফিল্ড থাকলে তালিকায় দেখানো, না থাকলে
  service-level `priceNote` fallback
- Offering/service image gallery প্রদর্শন
- `locationText` ও `hasDelivery` badge ডিটেইল পেজে দেখানো
- ছাত্রের নিজের active inquiry থাকলে status + owner-এর reply দেখানো
- Dormant bucket-এ থাকা শপ ওপেন করলে একটা informational ব্যানার ("এই শপ
  আপাতত সক্রিয় না") দেখাবে, কিন্তু পেজ ব্লক করবে না

---

### Phase 5 — Owner-side dashboard: inquiry queue UI

**লক্ষ্য:** Owner booking mode আর inquiry mode-এ সম্পূর্ণ ভিন্ন dashboard
section দেখবে, multi-item inquiry properly রেন্ডার করবে।

কাজ:
- `ProviderDashboard.jsx`-এ `service.interactionMode` চেক করে:
  - `booking` — বর্তমান `PendingQueue` + `ConfirmedList` + revenue tracker
    অপরিবর্তিত
  - `inquiry` — নতুন `PendingInquiries` কম্পোনেন্ট: প্রতিটা inquiry-তে
    item + quantity লিস্ট, একটা reply text বক্স + "উত্তর দিন" বাটন, কোনো
    confirm/finish/revenue নেই
- Open/Closed টগল, Offerings management — উভয় mode-এই একই থাকে

---

### Phase 6 — Category browse UI (Services.jsx পুনর্গঠন)

**লক্ষ্য:** ছাত্র প্রথমে category card grid দেখবে, তারপর shop list।

কাজ:
- `Services.jsx`-কে দুই-স্তরে ভাঙা:
  - Level 1: category card grid (Salon, Medicine, Hotel/Food, Bookstore,
    Online Mart) — প্রতিটা কার্ডে Lucide আইকন (Scissors, Pill/Cross,
    UtensilsCrossed, Book/Printer, ShoppingBag বা উপযুক্ত আইকন Online
    Mart-এর জন্য) + active shop count
  - Level 2: category-ভিত্তিক filtered shop list, route
    `/services/category/:categoryType` (Phase 0-এ resolved: existing
    `/services/:serviceId` nested-route প্যাটার্ন অনুসরণ করে, query param
    না)
- Dormant bucket-এর শপ list-এর নিচে আলাদা "Currently inactive" sub-section
- Home page-এ নতুন preview row কম্পোনেন্ট — ৫টা category card (compact) +
  "See all" লিংক যেটা Level 1 category grid-এ নিয়ে যায়

---

### Phase 7 — Polish, dormant-bucket QA, end-to-end verification

**লক্ষ্য:** পুরো flow (booking + inquiry + multi-item + dormant + image
upload) end-to-end verify করা।

কাজ:
- সব চারটা+এক (৫টা) category দিয়ে manual test matrix চালানো:
  booking flow (salon/hotel), inquiry flow single-item (medicine/
  bookstore), inquiry flow multi-item (online mart)
- Dormant auto-detection logic টেস্ট (mock করে ১৪ দিনের threshold যাচাই)
- Manual temporary vs permanent deactivate flow টেস্ট, reactivate flow
- Image upload size-limit (1MB) ও ৩-image-per-offering limit যাচাই
- Rich text description rendering যাচাই (bold/heading/bullet সব category়
  ঠিকভাবে দেখাচ্ছে কিনা)
- Firestore rules-এর সব নতুন branch-এর জন্য basic security review
  (owner-only write, student read-only যেখানে প্রযোজ্য)
- Mobile-first layout QA — category grid, shop card, multi-item inquiry
  ফর্ম, image gallery — সব মোবাইল viewport-এ প্রাইমারি টার্গেট হিসেবে
  চেক করা, desktop-এ graceful reflow যাচাই

---

## Progress tracking

*(প্রতিটা Phase শেষে এই সেকশনের নিচে নতুন এন্ট্রি যোগ করবে, আগের এন্ট্রি
মুছবে না — `_services_provider_progress/PROGRESS.md`-এর মতোই append-only
history রাখা হবে এখানে)*

### Phase 0 — Repo reconnaissance: DONE

`kuetx-fixed` repo zip পড়ে সব ৬টা open question resolve করা হয়েছে (Phase 0
সেকশন), তারপর একটা দ্বিতীয় গভীর পাস (Phase 0.5) দিয়ে
`serviceSync.js`/`ProviderDashboard.jsx`/`ServiceDetail.jsx`/
`bookingAlerts.js`/`firestore.rules`/`nav.js` **সম্পূর্ণ পড়ে** exact
function signature, field shape, rule pattern নোট করা হয়েছে — বিস্তারিত
ফলাফল উপরে দুইটা সেকশনে। সংক্ষেপে:
- Category field-এর নাম `type` (`serviceType` না) — সব Phase-এ এটাই ব্যবহার হবে
- Routing: nested route `/services/category/:categoryType`, query param না
- Dormant detection: নতুন `onSchedule` Cloud Function (existing repo-তে কোনো
  scheduled function ছিল না)
- Image storage: existing question-bank R2 worker/bucket reuse হবে না
  (PDF-নির্দিষ্ট) — নতুন bucket + নতুন worker route, কিন্তু existing
  worker-এর token-verification কোড reuse হবে
- Rich text: `src/lib/noticeFormat.jsx`-এর existing renderer সরাসরি reuse
- Category grid: `Services.jsx` বর্তমানে flat list, grid UI নতুন বানাতে হবে
  (থিম CSS variable/`.card` class অনুসরণ করে)
- **নতুন-পাওয়া gap:** `ServiceSetupForm`-এ category select UI নেই
  (hardcoded `type: 'salon'`) — Phase 3-এ এটা বাধ্যতামূলক নতুন কাজ
- Booking doc exact shape, `activeBooking` marker প্যাটার্ন,
  `queueBookingAlertWrite` signature, rules-এর bounded-recursion
  offering-check প্যাটার্ন — সব নোট করা হয়েছে, Phase 2/3 এই প্যাটার্নগুলো
  অনুসরণ করেই লেখা

কোনো কোড পরিবর্তন হয়নি এই Phase-এ, শুধু সিদ্ধান্ত ও ground-truth lock করা
হয়েছে।

### Phase 1 — Data model বিস্তৃতি: DONE

**যা করা হলো:**

- `src/lib/serviceSync.js`:
  - নতুন `TYPE_TO_INTERACTION_MODE` map ও `defaultInteractionModeForType()`
    হেল্পার যোগ হলো (salon/hotel → booking, medicine/bookstore/onlinemart →
    inquiry), প্ল্যানের টেবিল অনুযায়ী।
  - `createService()`-এর signature-এ নতুন optional params `locationText`,
    `hasDelivery` যোগ হলো (existing `type, name, description, priceNote`
    অপরিবর্তিত)। নতুন doc-এ এখন লেখা হচ্ছে: `interactionMode` (derived),
    `locationText`, `hasDelivery`, `status: 'closed'` (নতুন সার্ভিস সবসময়
    বন্ধ অবস্থায় শুরু হয়, `isOpen: false`-এর সাথে সামঞ্জস্যপূর্ণ),
    `dormantReason: null`, `dormantSince: null`, `coverImageUrl: null`।
    Batch/serviceIds-sync লজিক অপরিবর্তিত।
  - `updateServiceDetails()`-এ নতুন optional patchable field
    `locationText`, `hasDelivery`, `coverImageUrl` যোগ হলো — same
    partial-patch প্যাটার্ন (শুধু পাঠানো key-ই আপডেট হয়)।
  - নতুন এক্সপোর্ট `withServiceDefaults(service)` — migration হেল্পার,
    পুরনো (Phase 0-এর আগের) সার্ভিস ডকে `interactionMode`/`status` না
    থাকলে client-side default বসায় (`interactionMode` ← type থেকে derive,
    `status` ← `isOpen` থেকে derive) — প্ল্যানের migration নোট অনুযায়ী,
    কোনো ব্যাচ-migration script চালানো হয়নি।
  - `setServiceOfferings()`-এর comment আপডেট হলো নতুন optional
    `price`/`images` offering ফিল্ডের কথা উল্লেখ করে — ফাংশনের নিজের
    logic (whole-array replace) অপরিবর্তিত, Phase 3-এ `OfferingsManager`
    এই ফিল্ডগুলো populate করা শুরু করবে।
- `firestore.rules`:
  - নতুন enum validator ফাংশন `isValidServiceType()` (৫টা category:
    salon/hotel/medicine/bookstore/onlinemart), `isValidInteractionMode()`
    (booking/inquiry), `isValidServiceStatus()` (open/closed/dormant) —
    `ownsService()`-এর ঠিক পরে যোগ হলো।
  - `services/{serviceId}` create rule-এ এই তিনটা validator যোগ হলো,
    সাথে `status == 'closed'`, `dormantReason == null`, `dormantSince ==
    null` চেক — নতুন সার্ভিস কখনো dormant অবস্থায় "জন্ম" নিতে পারবে না।
  - update rule-এ (owning-provider branch এবং isAdmin() branch দুটোতেই)
    একই তিনটা validator যোগ হলো — Phase 2-এর `onSchedule` dormant-detection
    function admin-privilege দিয়ে চললে সেটাও এই validator-এর আওতায় পড়বে।
- Offerings array-এর ভেতরের `price`/`images` ফিল্ডের জন্য rules-এ কোনো
  নতুন validator যোগ করা হয়নি এই Phase-এ (Phase 1 স্কোপ শুধু
  service-top-level enum লক করা; offering-এর ভেতরের নতুন ফিল্ড
  optional/free-form থেকে গেছে, কারণ Phase 1-এর কাজের তালিকায় শুধু
  "সাপোর্ট" যোগ করার কথা বলা আছে, নতুন rule না — এটা একটা known gap,
  প্রয়োজনে Phase 3-এ image-URL/price ভ্যালিডেশন যোগ করা যেতে পারে)।

**Verify করা হলো:**
- `serviceSync.js` ও `ProviderDashboard.jsx` Babel (`@babel/preset-react`)
  দিয়ে parse করে সিনট্যাক্স ভ্যালিড কিনা চেক করা হয়েছে — দুটোই pass করেছে।
- `firestore.rules`-এ brace/paren balance স্ক্রিপ্ট দিয়ে চেক করা হয়েছে
  (250/250 braces, 1162/1162 parens) — কোনো unbalanced bracket নেই।
- `ProviderDashboard.jsx`-এর `ServiceSetupForm` **ইচ্ছাকৃতভাবে অপরিবর্তিত**
  রাখা হয়েছে (এখনো hardcoded `type: 'salon'` পাঠায়) — প্ল্যান অনুযায়ী
  category-select UI Phase 3-এর কাজ, Phase 1-এ কোনো UI বদলায়নি।

**Known gaps / পরের Phase-এর জন্য নোট:**
- Offering-এর `price`/`images` ফিল্ডের rules-level validation এখনো নেই
  (ওপরে উল্লেখ করা হয়েছে)।
- বিদ্যমান কোনো পুরনো সার্ভিস ডকে সরাসরি migration write করা হয়নি —
  `withServiceDefaults()` শুধু client-side read-time default; যদি কোনো
  ভবিষ্যৎ rules বা query সরাসরি `interactionMode`/`status` ফিল্ড না থাকা
  পুরনো ডকের ওপর নির্ভর করে, সেটা fail করতে পারে — Phase 2+ যেখানেই
  পুরনো ডক পড়া হবে, `withServiceDefaults()` ব্যবহার করা উচিত।
- `type` enum lock করার ফলে Phase 0.5-এ পাওয়া তথ্য অনুযায়ী শুধু salon
  ইতিমধ্যে ব্যবহৃত হচ্ছে বলে জানা গেছে — যদি production-এ অন্য কোনো
  আগে থেকে-ব্যবহৃত `type` value থেকে থাকে যেটা এই ৫টার বাইরে, সেই সার্ভিসের
  future update rules-এ block হয়ে যাবে (কারণ update rule-ও এখন
  `isValidServiceType()` চেক করে) — deploy করার আগে এই সম্ভাবনা যাচাই করে
  নেওয়া ভালো।

### Phase 2 — Inquiry mode + multi-item backend: DONE

**যা করা হলো:**

- `src/lib/serviceSync.js`:
  - `createBooking()` এখন single entry point-এই দুইটা শাখায় ভাগ, প্ল্যান
    অনুযায়ী `if (interactionMode === 'inquiry')` স্টাইলে (আলাদা ফাংশন না):
    - booking mode: হুবহু আগের মতো (offeringId, preferredTime,
      cancelledBy, confirmedSlot, status শুরু `pending`)।
    - inquiry mode (নতুন): `items: [{offeringId, label, price, quantity}]`
      নেয়, প্রতিটা item validate হয় (offering exist করে, available,
      quantity > 0) — invalid item silently বাদ যায়, সব বাদ গেলে error।
      `question` (free-text, ঐচ্ছিক) ফিল্ডও নেওয়া হয়। status শুরু
      `'open'`, `replyText: null`। `cancelledBy`/`confirmedSlot`/
      `offeringId`/`preferredTime` inquiry doc-এ থাকে না।
    - দুই মোডেই same `activeBooking/{studentUid}` marker doc লেখা হয়
      same batch-এ — "এক student-এর একটাই active interaction per shop"
      নিয়ম মোড-নির্বিশেষে।
    - Inquiry create হলে owner-কে `new_inquiry` alert যায় (একই
      `queueBookingAlertWrite`, একই batch)।
  - নতুন `answerInquiry(serviceId, bookingId, replyText)` — transaction-
    guarded (`confirmBooking`-এর re-read-inside-transaction প্যাটার্ন
    অনুসরণ করে), status `open` → `answered`, ছাত্রকে `inquiry_answered`
    alert পাঠায়।
  - নতুন `closeInquiry(serviceId, bookingId)` — ছাত্র নিজে বন্ধ করে,
    status → `closed`, `activeBooking` marker delete (best-effort,
    `cancelBooking`-এর marker-cleanup প্যাটার্নের মতোই)।
  - নতুন `subscribePendingInquiries(serviceId, callback)` —
    `subscribePendingBookings`-এর inquiry-mode সমতুল্য, Phase 5-এ
    `PendingInquiries` কম্পোনেন্ট এটা ব্যবহার করবে।
  - `setServiceOfferings()` এখন প্রতি কলে `offeringsUpdatedAt:
    serverTimestamp()`-ও লেখে — dormant-detection function এটা পড়ে
    বুঝবে "শেষ কবে offering আপডেট হয়েছে"।
- `firestore.rules`:
  - নতুন bounded-recursion helper `_inquiryItemValid`/
    `_allInquiryItemsValid` (existing `_offeringMatches`/
    `_anyOfferingBookable`-এর same টেকনিক, ১০টা item পর্যন্ত bound) —
    `items[]`-এর প্রতিটা entry-তে offeringId/label/quantity>0 চেক করে।
  - নতুন `serviceAcceptsInquiry(serviceId)` helper — parent service
    open এবং `interactionMode == 'inquiry'` কিনা।
  - `bookings/{bookingId}` create rule এখন দুইটা শাখা: booking-shaped
    (আগের মতো) অথবা inquiry-shaped (status `open`, replyText null,
    `serviceAcceptsInquiry` + `_allInquiryItemsValid` চেক) — উভয় শাখাতেই
    same `hasNoActiveBooking()` মার্কার চেক।
  - update rule-এ দুইটা নতুন transition যোগ হলো: `open` → `answered`
    (owner-only, শুধু `status`+`replyText` বদলাতে পারে) এবং
    `open`/`answered` → `closed` (ছাত্র নিজে, শুধু `status`) — booking
    mode-এর exact same `diff().affectedKeys().hasOnly([...])` lock
    প্যাটার্নে।
  - Terminal-states কমেন্ট আপডেট হলো inquiry-এর `closed` state-এর কথা
    উল্লেখ করে।
- `functions/index.js`:
  - নতুন `onSchedule('every 24 hours', ...)` — `detectDormantServices`।
    প্রতিটা `status: 'open'` সার্ভিসে চেক করে: কোনো offering available
    না এবং `offeringsUpdatedAt` (বা fallback `createdAt`) ১৪ দিনের বেশি
    পুরনো — মিললে `status: 'dormant'`, `dormantReason: 'auto'`,
    `dormantSince: serverTimestamp()`। শুধু `open` থেকেই dormant করে,
    already-dormant বা `closed` সার্ভিসে হাত দেয় না।
  - `firebase-functions/v2/scheduler`-এর `onSchedule` import যোগ হলো —
    `functions/package.json`-এর `firebase-functions: ^5.0.0` dependency
    এমনিতেই এটা সাপোর্ট করে, নতুন কোনো dependency যোগ করার দরকার হয়নি।
- `src/lib/bookingAlerts.js`: doc-comment আপডেট, নতুন `new_inquiry`/
  `inquiry_answered` `kind` value উল্লেখ করে (কোড অপরিবর্তিত — `kind`
  আগে থেকেই free-form string ছিল)।

**Verify করা হলো:**
- `serviceSync.js`, `bookingAlerts.js` Babel দিয়ে parse — pass।
- `functions/index.js` `node --check` দিয়ে syntax-verify — pass।
- `firestore.rules` brace/paren balance স্ক্রিপ্ট দিয়ে চেক (253/253
  braces, 1225/1225 parens) — pass।

**Owner-কে যা করতে হবে (এই Phase-এর জন্য, প্ল্যানের নিজের নোট অনুযায়ী):**
- Firebase project (`kuetx-8a184`) Blaze প্ল্যানে আছে কিনা নিশ্চিত করা
  (Firebase Console → Project Settings → Usage and billing) —
  `onSchedule` Blaze ছাড়া চলে না।
- `cd functions && npm install` (নতুন কোনো dependency লাগেনি, কিন্তু
  local ফোল্ডার freshly unzip করা হলে `node_modules` নেই তাই এটা লাগবে),
  তারপর `firebase deploy --only functions`।

**Known gaps / পরের Phase-এর জন্য নোট:**
- `detectDormantServices`-এর প্রথম রানের আগে, purely নতুন
  `offeringsUpdatedAt` ফিল্ড না থাকা পুরনো সার্ভিসে fallback হিসেবে
  `createdAt` ব্যবহার হচ্ছে — এটা মানে একটা পুরনো, দীর্ঘদিন
  offering-না-বদলানো সার্ভিস `createdAt`-এর ১৪ দিন পরই dormant হয়ে
  যেতে পারে প্রথম রানেই, প্রকৃত "১৪ দিন ধরে sold-out" অবস্থা কিনা তা
  নিশ্চিতভাবে না জেনেই — এটা একটা known trade-off (real-world data নেই
  বলে ধরে নেওয়া), Phase 7-এর QA-তে এটা যাচাই করে দেখা উচিত।
- Inquiry-তে owner-side "close"/reject করার কোনো path এই Phase-এ নেই
  (শুধু ছাত্র নিজে close করতে পারে) — প্ল্যানের scope-এই এটা explicit
  ছিল না, ভবিষ্যতে দরকার হলে আলাদা সিদ্ধান্ত হিসেবে যোগ করতে হবে।
- Multi-item inquiry-র `items[]`-এ কোনো duplicate-offeringId চেক নেই
  (একই offering দুইবার আলাদা entry হিসেবে থাকতে পারে) — ছোট গ্যাপ,
  UI-স্তরে (Phase 4) সহজে আটকানো যাবে ভেবে rules-এ যোগ করা হয়নি।

### Phase 3 — Provider dashboard (location/delivery/image/status): DONE

**যা করা হলো:**

- `src/lib/serviceSync.js`:
  - নতুন `SERVICE_TYPE_LABELS`/`SERVICE_TYPES` export — পাঁচটা category-র
    Bangla label-এর একমাত্র সোর্স, যাতে এই Phase-এর provider onboarding
    category-select এবং Phase 6-এর student-facing category grid একই
    mapping ব্যবহার করে (দুই জায়গায় duplicate না হয়)।
  - নতুন `setServiceStatus(serviceId, action)` — `'pause'` |
    `'permanent_close'` | `'reactivate'` — manual dormant bucket control।
    Reactivate করলে `status` আগের `isOpen` অনুযায়ী `open`/`closed`-এ
    ফেরে (plan-এর isOpen/status independence নোট অনুযায়ী, `isOpen`
    নিজে touch হয় না), pause/permanent_close করলে `status: 'dormant'`
    + যথাযথ `dormantReason` + `dormantSince: serverTimestamp()`। কোনো
    নতুন rules লাগেনি — existing `services/{serviceId}` update rule
    ইতিমধ্যে owning provider-কে এই তিনটা ফিল্ড টাচ করতে দেয় (শুধু enum
    validate করে, নির্দিষ্ট from-state list না)।
- `src/pages/provider/ProviderDashboard.jsx`:
  - **`ServiceSetupForm`-এ category select যোগ হলো** (Phase 0.5-এ পাওয়া
    বাধ্যতামূলক gap বন্ধ হলো) — ৫টা category card (২-কলাম grid,
    `SERVICE_TYPE_LABELS` থেকে label), নির্বাচিত `type`
    `createService()`-কে পাঠানো হয় hardcoded `'salon'`-এর বদলে।
  - `ServiceManager` এখন `withServiceDefaults()` দিয়ে service doc
    পড়ে (migration-safe, পুরনো ডকেও কাজ করবে), এবং dormant হলে ওপরে
    একটা `DormantBanner` দেখায় (reason অনুযায়ী আলাদা Bangla ব্যাখ্যা)।
  - নতুন `Collapsible` সেকশন **"ছবি, লোকেশন ও ডেলিভারি"**
    (`ShopMetaEditor`) — কভার ইমেজ আপলোড/পরিবর্তন/মুছা (R2, প্রিভিউ
    সহ), `locationText` ফ্রি-টেক্সট ইনপুট, `hasDelivery` টগল
    (custom switch, existing থিম রঙে) — সব existing
    `Collapsible`/`.card`/CSS-variable প্যাটার্নে।
  - নতুন `Collapsible` সেকশন **"শপ স্ট্যাটাস"** (`ShopStatusControl`) —
    active থাকলে Temporary pause / Permanent close বেছে নেওয়ার দুইটা
    বাটন, প্রতিটাতে ট্যাপ করলে explainer text + confirm ধাপ
    (`ConfirmBlock`); dormant থাকলে Reactivate বাটন (শুধু
    `manual_temporary`/`auto` reason-এ দেখায়, `manual_permanent`-এ
    "নিজে থেকে reactivate করা যাবে না" মেসেজ দেখায়, প্ল্যানের নির্দিষ্ট
    নিয়ম অনুযায়ী)।
  - `OfferingsManager` বিস্তৃত হলো: প্রতি offering-এ ঐচ্ছিক `price`
    input (blur-এ সেভ) এবং সর্বোচ্চ ৩টা image upload/preview/remove
    (R2, dashed "+"-বাটন limit-এ পৌঁছালে অদৃশ্য হয়ে যায়)। তিনটা
    core ফাংশন (`addOffering`/`toggleOffering`/`removeOffering`) —
    এখনো সেই same whole-array `setServiceOfferings()` কল প্যাটার্নই
    অনুসরণ করে, নতুন কোনো partial-update ফাংশন যোগ হয়নি — `price`/
    `images` নতুন object-literal ফিল্ড হিসেবেই বসেছে, ঠিক প্ল্যানের
    নির্দেশ অনুযায়ী। Offering মুছলে তার images best-effort R2 থেকেও
    delete হয়।
- `src/lib/serviceImageUpload.js` (নতুন) — client-side R2 upload/delete
  helper: `uploadServiceImage(serviceId, file)` (1MB client-side
  fast-fail check, তারপর worker-এ POST, ফেরত bare key-কে পুরো public
  URL-এ জোড়া দেয়), `deleteServiceImage(url)` (best-effort, ব্যর্থ হলেও
  save block করে না), `serviceImageUrl(key)` (key↔URL join helper)।
- `service-images-worker/` (নতুন ফোল্ডার, repo root):
  - `src/index.js` — Cloudflare Worker: `POST /upload`
    (multipart file+serviceId, Firebase ID-token verify করে
    pure-fetch+WebCrypto দিয়ে — existing question-bank worker থেকে
    কপি করা reuse-approach, প্ল্যানের Phase 0 সিদ্ধান্ত অনুযায়ী — তারপর
    Firestore REST দিয়ে re-verify করে uploader uid-ই সেই service-এর
    `providerUid` কিনা, 1MB + content-type সার্ভার-সাইড revalidate,
    `services/{serviceId}/{uuid}.{ext}` key-এ R2-তে সেভ করে বেয়ার key
    ফেরত দেয়) এবং `DELETE /image` (key থেকে serviceId re-derive করে
    owner-check করে delete করে, client-supplied serviceId trust করে
    না)।
  - `wrangler.toml` — নতুন bucket binding `SERVICE_IMAGES_BUCKET` →
    `kuetx-service-images` (owner ইতিমধ্যে Cloudflare dashboard-এ এই
    bucket বানিয়ে public access enable করেছেন)। `FIREBASE_PROJECT_ID`/
    `ALLOWED_ORIGIN`-এ real value বসানো হয়েছে
    (`cloudflare-worker/wrangler.toml`-এর একই value — এগুলো secret না,
    existing worker-এও plain text আছে)।
  - `README_SETUP.md` — deploy instructions, owner-এর ইতিমধ্যে করা R2
    bucket-এর public URL (`https://pub-97c3873f03ed4af0ae649f201326421f.r2.dev`)
    সহ, `.env`-এ কী বসাতে হবে তার exact লাইন।
- `.env.example` — নতুন `VITE_SERVICE_IMAGES_WORKER_URL`,
  `VITE_SERVICE_IMAGES_PUBLIC_BASE_URL` এন্ট্রি যোগ হলো, comment সহ।

**Rich text description (offering-এর জন্য):** এই Phase-এর কাজ-তালিকায়
ছিল, কিন্তু `OfferingsManager`-এর `label` ফিল্ড এখনো plain text —
`src/lib/noticeFormat.jsx`-এর `renderFormattedNoticeBody()` reuse করে
offering-এর জন্য আলাদা rich `description` ফিল্ড ও তার bold/heading/bullet
input UI **এই Phase-এ যোগ করা হয়নি**, নিচে "Known gaps"-এ explicit করে
রাখা হলো — Phase 4 (student-facing ServiceDetail rendering)-এর সাথেই
একসাথে করা বেশি সংগত হবে, যেহেতু editor UI ছাড়া render-only অংশ যোগ করলে
অর্ধেক কাজ হয়ে থাকত।

**Verify করা হলো:**
- `serviceSync.js`, `ProviderDashboard.jsx`, `serviceImageUpload.js` —
  Babel (`@babel/preset-react` + `@babel/preset-env`) দিয়ে parse করে
  তিনটাই pass করেছে।
- `node checksyntax.cjs` (repo-র নিজস্ব full syntax checker, JSX সহ) →
  `OK`।
- `node check_imports.mjs` → শুধু ২টা pre-existing failure দেখাচ্ছে
  (`src/routePreload.js`-এর একটা কমেন্টের ভেতরের উদাহরণ `./pages/X`,
  আসল import না) — এই Phase-এর কোনো নতুন ফাইল/import এর সাথে সম্পর্কিত
  না, আগে থেকেই ছিল।
- `firestore.rules` brace/paren balance আবার চেক করা হয়েছে (253/253,
  1225/1225) — Phase 2-এর সংখ্যার সাথে অপরিবর্তিত, কারণ এই Phase-এ
  rules ফাইলে কোনো এডিট হয়নি (plan অনুযায়ী প্রয়োজনও ছিল না — existing
  update rule ইতিমধ্যেই owning provider-কে নতুন সব ফিল্ড টাচ করতে দেয়)।
- `service-images-worker/src/index.js` — `node --check` দিয়ে syntax
  ভ্যালিড কিনা চেক করা হয়েছে (pass)।

**Owner-কে যা করতে হবে (এই zip পাওয়ার পর):**
1. `service-images-worker/wrangler.toml`-এ `bucket_name` তোমার আসল R2
   bucket নামের সাথে মিলছে কিনা একবার দেখো (already `kuetx-service-images`
   বসানো আছে, তোমার screenshot-এর bucket নামের সাথে মিলে যায়)।
2. `cd service-images-worker && wrangler deploy` চালাও (তোমার লোকাল
   মেশিনে, `E:\website\kuetx...`-এর ভেতরে এই zip extract করার পর — নিচে
   এই চ্যাটেই exact command-sequence দেওয়া হয়েছে)।
3. Deploy-এর পর যে worker URL পাবে সেটা + তোমার ইতিমধ্যে-করা public
   bucket URL (`https://pub-97c3873f03ed4af0ae649f201326421f.r2.dev`)
   `.env`-এ বসাও (`service-images-worker/README_SETUP.md`-এ exact লাইন
   আছে)।
4. Dev server রিস্টার্ট করো (`npm run dev`) নতুন env var লোড হওয়ার জন্য।

**Known gaps / পরের Phase-এর জন্য নোট:**
- **Rich text offering description এখনো যোগ হয়নি** (ওপরে ব্যাখ্যা করা
  হয়েছে) — Phase 4-এ student-facing rendering-এর সাথে একসাথে করার
  পরিকল্পনা, `noticeFormat.jsx`-এর existing renderer-ই ব্যবহার হবে,
  নতুন library না।
- **Offering-এর `price`/`images` ফিল্ডের rules-level validation এখনো
  নেই** — Phase 1-এর নিজস্ব known-gap নোট অনুযায়ী এটা তখনই deliberate
  scope-cut ছিল, এই Phase-এও যোগ করা হয়নি (client-side upload flow
  নিজেই 1MB/content-type check করে, কিন্তু rules-এ offering array-এর
  ভেতরের এই দুই ফিল্ডের shape lock করা নেই)।
- **Cover/offering image upload worker এখনো deploy হয়নি** — কোড
  zip-এ আছে, কিন্তু owner নিজে `wrangler deploy` না চালানো পর্যন্ত
  `uploadServiceImage()` কল করলে "Image upload isn't configured yet"
  error দেখাবে (worker URL env var খালি থাকলে `serviceImageUpload.js`
  নিজেই এই early-error ছোড়ে) — এটা প্ল্যানের নিজের নোট অনুযায়ী প্রত্যাশিত,
  bug না।
- **`ShopStatusControl`-এর permanent-close-এর পর Founder-side কোনো
  review/reactivate UI এই Phase-এ যোগ হয়নি** — প্ল্যানের scope অনুযায়ী
  এটা AdminDashboard-এর কাজ, যা এই Phase-এর তালিকায় ছিল না; ভবিষ্যতে
  দরকার হলে আলাদা কাজ হিসেবে যোগ করতে হবে।
- **Offering price input `onBlur`-এ সেভ হয়**, প্রতি কি-স্ট্রোকে না —
  ইচ্ছাকৃত (প্রতি অক্ষরে Firestore write পাঠানো অপচয়), কিন্তু মানে
  owner ইনপুট বক্স থেকে বের না হলে দাম সেভ হয় না, যা প্রথমবার একটু
  অস্পষ্ট মনে হতে পারে — ছোট UX নোট, functional bug না।

### Phase 4 — Student-facing UI (multi-item inquiry): DONE

**যা করা হলো:** `src/pages/ServiceDetail.jsx` পুরোপুরি বদলানো হয়েছে
(booking-mode `BookingForm` কোনো পরিবর্তন ছাড়াই আগের মতো রাখা হয়েছে,
নতুন সব কোড এর পাশে যোগ):

- মূল কম্পোনেন্ট এখন `withServiceDefaults()` দিয়ে service data wrap করে
  (`interactionMode`/`status` default resolve করার জন্য, Phase 1-এর মতো
  পুরনো সেলুন doc-এও কাজ করবে)
- `service.interactionMode === 'inquiry'` চেক করে দুইটা সম্পূর্ণ আলাদা
  পাথ:
  - `booking` — অপরিবর্তিত `BookingForm`/`MyActiveBooking`
  - `inquiry` — নতুন `InquiryForm`/`MyActiveInquiry`
- **`InquiryForm`**: প্রতিটা available offering-এর পাশে quantity stepper
  (Minus/Plus বাটন, local `quantities` state — কোনো নতুন collection না),
  offering-এর `price` থাকলে দেখানো + মোট আনুমানিক দাম, ফোন নাম্বার input,
  ঐচ্ছিক free-text প্রশ্ন বক্স। Submit করলে সব selected item নিয়ে একটাই
  `createBooking(service.id, { items, question, ... })` কল হয় (Phase
  2-এর already-branching ফাংশন, কোনো নতুন backend কোড লাগেনি)
- **`MyActiveInquiry`**: student-এর নিজের open/answered inquiry-র item
  লিস্ট, মোট, প্রশ্ন, এবং owner-এর `replyText` (থাকলে) দেখায় +
  `closeInquiry()` কল করার বাটন
- **Offering price fallback**: `o.price` (number) থাকলে item লিস্টে
  দেখানো, service-level `priceNote` শুধু booking-mode display-এ যেমন
  ছিল তেমনই আছে (অপরিবর্তিত)
- **Image gallery**: `service.coverImageUrl` থাকলে টপে বড় cover image
  (না থাকলে আগের icon fallback), প্রতিটা offering-এ `images[0]` থাকলে
  ছোট thumbnail (Phase 3-এর progress note অনুযায়ী offering-level image
  upload UI এখনো owner side-এ যোগ হয়নি, কিন্তু render-side সাপোর্ট এখানে
  রেডি রাখা হলো যাতে ডেটা এলেই দেখাবে)
- **Badges**: `locationText` (MapPin আইকন সহ) ও `hasDelivery` true হলে
  Truck আইকন সহ ব্যাজ, দুটোই ঐচ্ছিক (কোনোটাই না থাকলে সারি সম্পূর্ণ hide)
- **Dormant banner**: `service.status === 'dormant'` হলে
  `DormantInfoBanner` — `dormantReason` অনুযায়ী আলাদা বার্তা (auto/
  manual_temporary/manual_permanent), শুধু informational, পেজের বাকি
  অংশ (booking/inquiry ফর্ম সহ) স্বাভাবিকভাবেই render হতে থাকে, ব্লক করে
  না — প্ল্যানের spec অনুযায়ী
- **Rich text description**: `service.description` এখন
  `src/lib/noticeFormat.jsx`-এর `renderFormattedNoticeBody()` দিয়ে
  render হয় (আগে plain text ছিল) — Phase 0-এ resolved সিদ্ধান্ত অনুযায়ী
  reuse, নতুন library আনা হয়নি

**বদলানো ফাইল:** শুধু `src/pages/ServiceDetail.jsx` (কোনো backend/rules
ফাইল ছোঁয়া হয়নি, Phase 1-3-এর সব ফাংশন যেমন ছিল তেমনই আছে)।

**Verify করা হলো:**
- `node checksyntax.cjs` → `OK`
- `node check_imports.mjs` → শুধু ২টা pre-existing failure (আগের
  Phase-গুলোর মতোই, `routePreload.js`-এর কমেন্টের ভেতরের উদাহরণ,
  এই Phase-এর কোনো নতুন ফাইলের সাথে সম্পর্কিত না)

**Known gaps / পরের Phase-এর জন্য নোট:**
- **Offering-level image upload UI এখনো owner side-এ নেই** (Phase
  3-এর নিজস্ব known-gap, এখনো অপরিবর্তিত) — তাই এই Phase-এ যোগ করা
  `o.images[0]` thumbnail render বাস্তবে এখনও কোনো data দেখাবে না, শুধু
  future-ready রাখা হলো
- **`MyActiveInquiry`/`InquiryForm`-এর টাকার হিসাব "আনুমানিক" লেবেল
  দিয়ে দেখানো হচ্ছে** কারণ delivery charge বা partial-availability change
  এই মোটে ধরা হয় না — শুধু owner-সেট `price × quantity`-র যোগফল, চূড়ান্ত
  দাম নয়
- **Phase 5 (owner-side inquiry queue UI) এখনো শুরু হয়নি** — এই Phase
  student একটা inquiry পাঠাতে পারবে এবং তার নিজের status/reply দেখতে
  পারবে, কিন্তু owner dashboard-এ এখনো `subscribePendingInquiries()`-এর
  কোনো UI consumer নেই (ফাংশন Phase 2 থেকেই আছে, শুধু ব্যবহার হয়নি) —
  তাই বাস্তবে owner এখনো নতুন inquiry দেখতে/উত্তর দিতে পারবেন না যতক্ষণ
  না Phase 5 হয়

### Phase 5 — Owner-side inquiry queue UI: DONE

**যা করা হলো:** `src/pages/provider/ProviderDashboard.jsx`-এ
`ServiceManager` কম্পোনেন্ট `service.interactionMode` চেক করে এখন দুই
সম্পূর্ণ আলাদা path রেন্ডার করে (booking-mode অংশ কোনো পরিবর্তন ছাড়াই
আগের মতো রাখা হয়েছে):

- **Subscription split**: `isInquiryMode` অনুযায়ী হয় (booking-mode)
  `subscribePendingBookings`/`subscribeConfirmedBookings` নয়তো
  (inquiry-mode) নতুন `subscribePendingInquiries` — দুইটার মধ্যে শুধু
  একটাই একটিভ থাকে, mutually exclusive, যেমন rendering-ও mutually
  exclusive
- **`PendingInquiries`** (নতুন কম্পোনেন্ট, `PendingQueue`-র inquiry
  সমতুল্য): "Pending Inquiries (count)" হেডার, প্রতিটা inquiry
  `InquiryQueueCard`-এ রেন্ডার হয়
- **`InquiryQueueCard`**: student name, request time, phone, প্রতিটা
  item + quantity লিস্ট (+ price থাকলে line total এবং grand total
  "আনুমানিক" লেবেল সহ — Phase 4-এর student-side একই hedge), student-এর
  ঐচ্ছিক প্রশ্ন (থাকলে), একটা reply textarea + "উত্তর দিন" বাটন যেটা
  `answerInquiry(serviceId, bookingId, replyText)` কল করে (Phase 2
  থেকেই বিদ্যমান ফাংশন, নতুন backend কোড লাগেনি) — কোনো confirm/finish
  বাটন নেই, কোনো revenue প্রসঙ্গ নেই, প্ল্যানের স্পষ্ট নির্দেশ অনুযায়ী
- **Revenue tracker Collapsible**-টা এখন `!isInquiryMode` দিয়ে গার্ড
  করা — inquiry-mode-এ পুরোপুরি hide হয়ে যায় ("কোনো revenue tracking
  নেই inquiry-তে")
- **অপরিবর্তিত উভয় mode-এই** (প্ল্যানের শেষ লাইন অনুযায়ী): Open/Closed
  টগল, Offerings management Collapsible, ছবি/লোকেশন/ডেলিভারি
  Collapsible, শপ স্ট্যাটাস (dormant/pause) Collapsible, সার্ভিস বিবরণ
  এডিটর — এগুলোর কোনোটাই interactionMode চেক করে না, দুই mode-এই
  একইভাবে দেখায়/কাজ করে, যেমনটা প্ল্যানে বলা ছিল

**বদলানো ফাইল:** শুধু `src/pages/provider/ProviderDashboard.jsx`
(`subscribePendingInquiries`/`answerInquiry` import যোগ হয়েছে —
দুইটাই Phase 2 থেকে বিদ্যমান ফাংশন, serviceSync.js-এ কোনো পরিবর্তন
লাগেনি)।

**Verify করা হলো:**
- `node checksyntax.cjs` → `OK`
- `node check_imports.mjs` → শুধু ২টা pre-existing failure (আগের সব
  Phase-এর মতোই, এই Phase-এর সাথে সম্পর্কহীন)

**Known gaps / পরের Phase-এর জন্য নোট:**
- এই Phase-এর পর booking + inquiry উভয় flow-ই end-to-end কাজ করার কথা
  (student পাঠাতে পারবে, owner দেখতে/উত্তর দিতে পারবে) — কিন্তু এখনো
  manual test করা হয়নি (সেটা Phase 7-এর কাজ)
- **Category browse UI (Phase 6) এখনো শুরু হয়নি** — `Services.jsx`
  এখনো flat list, category card grid নেই
- Offering-level image upload UI (Phase 3-এর known gap) এখনো
  অপরিবর্তিত — এই Phase-এ ছোঁয়া হয়নি, স্কোপের বাইরে ছিল

### Phase 6 — Category browse UI: DONE

**যা করা হলো:** `src/pages/Services.jsx` দুই-স্তরে ভাঙা হয়েছে, একই
ফাইলে দুইটা export (Phase 0-এর routing সিদ্ধান্ত অনুযায়ী, query param
ছাড়া nested route):

- **Level 1 — `export default function Services()`** (`/services`):
  category card grid, `SERVICE_TYPES`/`SERVICE_TYPE_LABELS`
  (serviceSync.js-এ Phase 3 থেকেই বিদ্যমান single-source-of-truth) দিয়ে
  ৫টা কার্ড রেন্ডার করে, প্রতিটাতে Lucide আইকন (`CATEGORY_ICONS` ম্যাপ:
  Scissors/salon, Cross/medicine, UtensilsCrossed/hotel, BookOpen/
  bookstore, ShoppingBag/onlinemart) + active (non-dormant) shop count।
  Mobile-এ ২-কলাম CSS grid (Phase 0.5-এর সিদ্ধান্ত অনুযায়ী)। কার্ডে ক্লিক
  করলে `/services/category/:type`-এ navigate করে
- **Level 2 — `export function CategoryShopList()`** (নতুন রুট
  `/services/category/:categoryType`): সেই category-র শপ লিস্ট, আগের
  flat-list কার্ড লেআউট অনুসরণ করে (cover image থাকলে thumbnail, না
  থাকলে আগের icon fallback, open/closed dot, locationText, booking-mode
  হলে queue count আর inquiry-mode হলে "প্রশ্ন/অনুরোধ পাঠান" টেক্সট)।
  **Dormant bucket** আলাদা "বর্তমানে নিষ্ক্রিয়" sub-section-এ (কম opacity,
  নিচে) দেখায়, বাদ পড়ে না — প্ল্যানের স্পষ্ট নির্দেশ অনুযায়ী
- **`useVisibleServices()`** নামে একটা shared hook বানানো হয়েছে (আগের
  `useDeactivatedProviderUids`/`subscribeAllServices` লজিক একত্র করে,
  প্রতিটা service-এ `withServiceDefaults()` চালিয়ে) — Level 1 আর Level 2
  দুইটাই এটা ব্যবহার করে, কোনো ডুপ্লিকেট subscription লজিক নেই
- **`App.jsx`**: নতুন lazy route `/services/category/:categoryType` ->
  `CategoryShopList` (named export থেকে lazy-wrap করা), existing
  `/services` ও `/services/:serviceId` রুট অপরিবর্তিত
- **Home page preview row**: `src/pages/Dashboard.jsx`-এ নতুন
  `ServicesPreviewRow` কম্পোনেন্ট — ৫টা compact category card (আইকন +
  লেবেল + active count) + "সব দেখুন →" লিংক, Academic Journey card-এর
  পরে, courses-empty state-এর পরে বসানো হয়েছে (existing sections কোনোটা
  সরানো/বদলানো হয়নি, শুধু নতুন card যোগ)
- **`nav.js`**: প্ল্যানের Phase 0 সিদ্ধান্ত অনুযায়ী কোনো পরিবর্তন করা হয়নি
  — existing Services entry (`path: '/services'`) Campus Life গ্রুপেই
  আগের মতো থাকল

**বদলানো ফাইল:** `src/pages/Services.jsx` (সম্পূর্ণ পুনর্গঠন),
`src/App.jsx` (একটা lazy import + একটা route যোগ), `src/pages/
Dashboard.jsx` (import যোগ + `ServicesPreviewRow` কম্পোনেন্ট + render-এ
এক লাইন যোগ)। `serviceSync.js`/rules-এ কোনো পরিবর্তন লাগেনি (`SERVICE_
TYPE_LABELS`/`SERVICE_TYPES`/`withServiceDefaults` সবই আগে থেকে
বিদ্যমান)।

**Verify করা হলো:**
- `node checksyntax.cjs` → `OK`
- `node check_imports.mjs` → শুধু ২টা pre-existing failure (আগের সব
  Phase-এর মতোই)
- `lucide-react`-এ `Cross`/`Scissors`/`UtensilsCrossed`/`BookOpen`/
  `ShoppingBag` — সব আইকন existing installed version (`^0.462.0`)-এ
  উপলব্ধ কিনা চেক করা হয়েছে

**Known gaps / পরের Phase-এর জন্য নোট:**
- **Phase 7 (polish + end-to-end verification) এখনো শুরু হয়নি** — এই
  Phase-এর পর পুরো ৭-ধাপের feature set কোড-লেভেলে সম্পূর্ণ, কিন্তু কোনো
  manual test matrix চালানো হয়নি এখনো
- Category grid-এর active-count এবং preview row-এর active-count দুই
  জায়গায় একই লজিক আলাদা করে লেখা হয়েছে (Services.jsx-এর Level 1 আর
  Dashboard.jsx-এর ServicesPreviewRow) — duplicate logic, কিন্তু ছোট
  (কয়েক লাইনের loop) এবং দুই ফাইল আলাদা module বলে shared helper বের
  করার প্রয়োজন মনে হয়নি; ভবিষ্যতে চাইলে `serviceSync.js`-এ একটা
  `computeActiveCountByType(services)` হেলপার বের করে দুই জায়গায় reuse
  করা যেতে পারে

### Phase 7 — Polish & end-to-end verification: DONE (static/code-level; see honest gaps below)

**পদ্ধতি:** নতুন feature কোড এই Phase-এ যোগ হয়নি (plan-এর নিজের সংজ্ঞা
অনুযায়ী এটা QA/polish pass) — কাজ ছিল checklist-এর প্রতিটা আইটেম কোড
পড়ে/script চালিয়ে সত্যিই যাচাই করা।

- **Dormant auto-detection** — `DORMANT_THRESHOLD_DAYS = 14` ঠিক আছে,
  `offeringsUpdatedAt` সত্যিই `setServiceOfferings()`-এ স্ট্যাম্প হয়,
  শুধু `status: 'open'` + সব offering unavailable + ১৪ দিন পার হলেই flag
  হয়, আগে dormant/closed থাকা কোনো service ছোঁয় না।
- **Manual pause/permanent-close/reactivate** — তিনটা action সঠিকভাবে
  আলাদা: `pause`→`manual_temporary`, `permanent_close`→`manual_permanent`,
  `reactivate`→দুইটাই null + status আগের isOpen অনুযায়ী ফেরে।
- **🔴 নিরাপত্তা গ্যাপ পাওয়া গেছে ও ফিক্স করা হয়েছে (`firestore.rules`):**
  আগে owning-provider update branch-এ `dormantReason`-এর কোনো enum
  validation ছিল না — একজন provider client থেকে `dormantReason: 'auto'`
  (যেটা শুধু `detectDormantServices` cloud function-এর exclusive marker
  হওয়ার কথা) স্পুফ করে manual pause-কে auto-detected বলে দেখাতে পারত,
  বা যেকোনো arbitrary string বসাতে পারত। নতুন
  `isValidProviderDormantReason()` হেল্পার যোগ হয়েছে — provider-এর
  নিজের update-এ শুধু `null`/`manual_temporary`/`manual_permanent`
  allow করে; `isAdmin()` branch অপরিবর্তিত (Founder + trusted server
  function উভয়েরই path)।
- **Image upload limits** — `MAX_IMAGE_BYTES = 1MB` worker-এ server-side
  enforced ✓, `MAX_OFFERING_IMAGES = 3` per-offering enforced ✓।
- **Rich text রেন্ডারিং** — `ServiceDetail.jsx` সব ৫টা category-র জন্য
  একই কম্পোনেন্ট/রেন্ডারার ব্যবহার করে, category-ভিত্তিক আলাদা কোনো
  branching নেই যা ভাঙতে পারে।
- **Mobile-first layout** — `ServiceDetail.jsx`-এ কোনো বড় fixed-pixel
  width পাওয়া যায়নি, `maxWidth: 640, margin: '0 auto'` প্যাটার্ন সর্বত্র।
- **`node checksyntax.cjs`** → `OK` (rules ফিক্সের পরেও)
- **`node check_imports.mjs`** → শুধু আগের ২টা pre-existing
  `routePreload.js` failure
- **`firestore.rules`** bracket-balance sanity check (braces/parens
  উভয়ই সমান) — rules-ভাষার নিজস্ব linter এই পরিবেশে না থাকায় এটাই সম্ভব
  ছিল

**সততার সাথে যা এখনো বাকি (সব "PASS" দেখানো হয়নি):**
- কোনো real Firebase emulator/live device দিয়ে ম্যানুয়ালি ক্লিক করে
  booking/inquiry submit flow টেস্ট করা হয়নি — এই verification সম্পূর্ণ
  static code review + script-ভিত্তিক (এই পরিবেশে emulator/device নেই)।
  Booking (salon/hotel), single-item inquiry (medicine/bookstore),
  multi-item inquiry (online mart) — কোড পড়ে লজিক সঠিক মনে হয়েছে, কিন্তু
  runtime behavior এখনো unverified।
- Cloudflare Worker deploy, নতুন R2 bucket তৈরি, Cloud Function deploy —
  এগুলো owner-only পদক্ষেপ, এখনো deploy হয়নি ধরে নেওয়া হচ্ছে, তাই
  production-এ actual behavior এখনো live verify করা যায়নি।
- নতুন `isValidProviderDormantReason` rules ফিক্স **এখনো deploy হয়নি**
  — `firebase deploy --only firestore:rules` বাকি (owner-only পদক্ষেপ)।

---

### Follow-up (post-Phase 7) — Faculty access to Services: DONE

**প্রসঙ্গ:** ব্যবহারকারী প্রশ্ন তুলেছিলেন — Services (`/services`) এখন
শুধু student sidebar (`nav.js`)-এ আছে, Faculty account
(`nav-faculty.js`)-এ কোনো entry নেই। route নিজে unguarded ছিল (App.jsx-এ
`/services` কোনো `RequireFaculty`/role-check ছাড়াই render হয়, যেহেতু
student আর faculty উভয়েই একই shared authenticated shell-এর ভেতর দিয়ে
যায়), তাই সরাসরি URL দিলে আগেও কাজ করত — শুধু **discover করার কোনো
sidebar/hub entry ছিল না**।

আলোচনায় একটা তৃতীয় angle (provider account নিজে customer হিসেবে
Services ব্যবহার করতে পারা উচিত কিনা) ওঠা হয়েছিল কিন্তু ব্যবহারকারী
স্পষ্টভাবে সেটা **বাদ দিতে বলেছেন** — provider শুধু provider-ই থাকবে,
এই স্কোপে কোনো পরিবর্তন হয়নি।

**যা করা হলো:** `src/nav-faculty.js`-এর "More" গ্রুপের "Resources"
subgroup-এ একটা নতুন item যোগ — `{ id: 'f-services', label: 'Services',
icon: 'Store', path: '/services' }`, Question Bank আর Contact-এর মাঝে
বসানো হয়েছে।

**কেন এখানে, নতুন bottom-nav বাটন কেন না:** Faculty mobile bottom nav
মাত্র ৪+১ (Home/Classes/Schedule/More + role-aware Profile) — এই সেট
`BottomNavFaculty.js`-এ deliberately fixed হিসেবে ডকুমেন্টেড। নতুন বাটন
মানে পুরো কাঠামো ভাঙা। কিন্তু "More" ঠিক এই ধরনের occasional-use
utility-দের জন্যই বানানো (কমেন্ট: "communication tools together,
resource/settings tools together")। Services-ও একটা occasional campus
utility (salon/medicine/hotel/bookstore/online-mart) — Question
Bank/Contact-এর মতোই "মাঝেমধ্যে দরকার হয়" ক্যাটাগরির, তাই নতুন subgroup
না বানিয়ে existing "Resources" section-এই যোগ করা হয়েছে।

`SubgroupHub.jsx` `NAV_FACULTY`-কেই সরাসরি navSource হিসেবে ব্যবহার করে
(`App.jsx`-এর `/faculty/more` route), এবং desktop `Sidebar.jsx`-ও
`viewMode === 'teacher'`-এ `SidebarNavFaculty`-কে একই `NAV_FACULTY`
দিয়ে render করে — তাই এই একটামাত্র এন্ট্রি desktop sidebar আর mobile
`/faculty/more` হাব, দুই জায়গাতেই automatically প্রতিফলিত হয়, আলাদা
কোনো কম্পোনেন্ট ছোঁয়া লাগেনি।

`Store` icon `lib/iconRegistry.js`-এর `ICONS` রেজিস্ট্রিতে ইতিমধ্যেই
আছে (student nav.js-এও এই একই icon Services-এর জন্য ব্যবহৃত), তাই নতুন
import লাগেনি।

**বদলানো ফাইল:** শুধু `src/nav-faculty.js` (একটা array entry যোগ)।

**Verify করা হলো:**
- `node checksyntax.cjs` → `OK`
- `node check_imports.mjs` → শুধু আগের ২টা pre-existing `routePreload.js`
  failure, এই পরিবর্তনের সাথে সম্পর্কহীন

**Known gap / সচেতনভাবে বাদ দেওয়া হয়েছে:**
- `serviceSync.js`-এর booking-notification স্ট্রিং-এ hardcoded
  "একজন student পাঠিয়েছেন" — Faculty booking/inquiry পাঠালেও এখনো
  "student" বলে দেখাবে। এটা একটা পরিচিত ছোট inconsistency, এই follow-up
  এর স্কোপে ইচ্ছাকৃতভাবে ছোঁয়া হয়নি — ব্যবহারকারী চাইলে আলাদা ছোট কাজ
  হিসেবে ঠিক করা যাবে।
- Provider-as-customer angle সম্পূর্ণ বাদ — ব্যবহারকারীর স্পষ্ট
  সিদ্ধান্ত অনুযায়ী।

AI bot repo-র ভেতরে কোড/config ফাইল বানাতে পারবে, কিন্তু Cloudflare/Firebase
Console-এর ভেতরে গিয়ে account-level জিনিস তৈরি করাটা তোমাকেই করতে হবে —
ঠিক এই repo-তেই আগে থাকা `functions/README_PUSH_SETUP.md`-এর মতো প্যাটার্ন
(push notification setup-এও একই ধরনের owner-only ধাপ ছিল)। কোন Phase-এ কোনটা
লাগবে সেই ক্রম অনুযায়ী নিচে দেওয়া হলো:

### Phase 2 শুরুর আগে/সময় — Firebase Cloud Functions (scheduled)
- Firebase project **`kuetx-8a184`** (existing `functions/` ফোল্ডার থেকে
  পাওয়া) Blaze (pay-as-you-go) প্ল্যানে আছে কিনা Firebase Console →
  Project Settings → Usage and billing-এ গিয়ে চেক করো। `onSchedule`
  (scheduled Cloud Function) Blaze প্ল্যান ছাড়া চলে না। যেহেতু
  `functions/` ফোল্ডার ও deploy flow (`firebase deploy --only
  functions`) আগে থেকেই আছে, সম্ভবত Blaze-এ আছ, কিন্তু নিশ্চিত হয়ে নাও।
- Phase 2-এর কোড আসার পর: `cd functions && npm install`, তারপর
  `firebase deploy --only functions` — এই কমান্ড তোমাকেই চালাতে হবে
  (AI bot শুধু কোড দেবে, deploy করার permission/CLI access ওর নেই)

### Phase 3 শুরুর আগে — Cloudflare R2 নতুন bucket + worker
বর্তমান `cloudflare-worker/wrangler.toml` দেখে বুঝেছি তোমার Cloudflare
অ্যাকাউন্টে ইতিমধ্যে `kuetx-question-bank-worker` নামে একটা worker ও দুইটা
R2 bucket (`kuetx-question-bank`, `kuetx-question-bank-staging`) আছে।
Services-এর image upload-এর জন্য এর পাশাপাশি **নতুন** bucket/worker লাগবে:

1. Cloudflare dashboard → R2 → **নতুন bucket তৈরি করো**, নাম যেমন
   `kuetx-service-images` (public bucket, question-bank-এর মূল bucket-এর
   মতোই — public read দরকার হবে ছবি দেখানোর জন্য)
2. Cloudflare dashboard → Workers → **নতুন Worker তৈরি করো** (অথবা AI bot
   যদি existing worker repo-র ভেতরেই নতুন ফাইল/route হিসেবে কোড দেয়,
   তাহলে সেই কোড deploy করার জন্য তোমাকে `wrangler deploy` চালাতে হবে —
   এটাও AI bot নিজে করতে পারবে না, CLI/account access লাগে)
3. নতুন worker-এর জন্য একটা `wrangler.toml`-এ (বা existing-এর পাশে নতুন
   ফাইলে) নতুন bucket bind করতে হবে — exact syntax existing
   `wrangler.toml`-এর মতোই (`[[r2_buckets]]`, `binding`, `bucket_name`)
4. `FIREBASE_PROJECT_ID = "kuetx-8a184"` ও `ALLOWED_ORIGIN =
   "https://kuetx.vercel.app"` — এই দুইটা env var existing worker-এ যেমন
   আছে, নতুন worker-এও same বসাতে হবে (AI bot কোড দিলেও তোমাকেই
   Cloudflare dashboard-এ বা `wrangler.toml`-এ বসিয়ে দিতে হবে, বিশেষ করে
   যদি কোনো secret/token লাগে সেটা `wrangler secret put` দিয়ে তোমাকেই সেট
   করতে হবে — secret কখনো কোডে/zip-এ থাকবে না)
5. Deploy: `cd <new-worker-folder> && wrangler deploy` — তোমাকেই চালাতে
   হবে (একই Cloudflare অ্যাকাউন্টে login করা `wrangler` CLI লাগবে)

### সব সময়ে প্রযোজ্য
- AI bot যা zip দেবে তার ভেতরে কোনো secret/API key/token থাকবে না —
  placeholder থাকবে (`REPLACE_WITH_...` স্টাইল, existing
  `README_PUSH_SETUP.md`-এর মতোই), সেগুলো তোমাকে নিজে বসাতে হবে
- প্রতিটা Phase-এর zip-এর সাথে যদি "এই Phase-এ owner-কে যা করতে হবে" এমন
  কোনো note থাকে (AI bot-কে বলে দেওয়া আছে প্রতিটা zip-এর সাথে progress
  update দিতে), সেটা মন দিয়ে পড়ে নিও — উপরের তালিকা generic assumption,
  Phase-ভিত্তিক zip-এর সাথে দেওয়া নোটই বেশি নির্ভরযোগ্য হবে যদি তাতে
  আলাদা কিছু বলা থাকে

---

### Follow-up 2 — Firestore rules security audit + student-only route guards + notification wording fix: DONE

**প্রসঙ্গ:** ব্যবহারকারী উদ্বিগ্ন ছিলেন route-level guard-এর অভাব নিয়ে —
"keu hacking kore ek jon theke arek joner data-y jete pare naki" ধরনের
প্রশ্ন। এটা সিরিয়াসলি নেওয়া হয়েছে, দুই ধাপে।

**ধাপ ১ — Firestore rules-এর পূর্ণাঙ্গ audit (আসল security boundary):**
নিচের প্রতিটা sensitive collection-এর read rule হাতে-হাতে চেক করা
হয়েছে — `users/{uid}/data`, `users/{uid}/meta`,
`students/{dept}/{batch}/{uid}`, `faculty/{uid}`,
`services/{serviceId}/bookings`, `bookingAlerts/{uid}/items`,
`bloodDonors/{uid}`, `groups/{groupId}/members`,
`groups/{groupId}/facultyAssignments/{id}/studentRecords` (marks),
`rollUnlockRequests`, `manualVerifyRequests`। **ফলাফল: কোনো actual
cross-account data leak পাওয়া যায়নি** — প্রতিটা sensitive read হয়
`request.auth.uid == <owner field>` (identity-scoped) দিয়ে, নয়তো
server-verified role function (`isAdmin()`, `isVerifiedFaculty()`
ইত্যাদি, যেগুলো client-claimed কিছু না, Firestore নিজেই resolve করে)
দিয়ে গার্ডেড। `bloodDonors` ইচ্ছাকৃতভাবে open-read (emergency directory,
ডকুমেন্টেড কারণসহ)। **উপসংহার: Firestore rules-এ নতুন কোনো ফিক্স
প্রয়োজন হয়নি — আসল security boundary আগে থেকেই সঠিক ছিল।**

**ধাপ ২ — `RequireStudentMode` route guard (defense-in-depth + UX
fix, নিরাপত্তা-leak fix না):** নতুন কম্পোনেন্ট
`src/components/RequireStudentMode.jsx` — `RequireFaculty.jsx`-এর
উল্টো দিকের mirror, `useIsFaculty()`-এর `isFaculty`/`isFounderBypass`
দিয়ে গেট করে। শুধু genuine (non-Founder) faculty account-কে ব্লক করে
— Founder-এর dual-shell অধিকার (`useViewMode.js`) অক্ষত থাকে, প্লেইন
student account প্রভাবিত হয় না। App.jsx-এ dept/batch/group-নির্ভর
পেজগুলোতে বসানো হয়েছে: `/courses`, `/attendance`, `/marks`,
`/marks/:courseId`, `/results`, `/schedule`, `/syllabus`, `/diary`,
`/assignments`, `/question-bank`, `/question-bank/view`, `/solutions`,
`/alerts`, `/classmates`, এবং ৬টা Class Rep পেজ (`/class-routine`,
`/class-planner`, `/ct-quiz-planning`, `/class-roster`,
`/class-notices`, `/class-my-role` — এগুলোতে `RequireStudentMode` বাইরে,
`RequireCR` ভেতরে, যাতে faculty account স্পষ্ট "student-only" মেসেজ
পায়, `RequireCR`-এর "not a CR" মেসেজে confuse না হয়)।

**যা ইচ্ছাকৃতভাবে গার্ড করা হয়নি (role-agnostic utility, উভয় শেলের
জন্যই বৈধ):** `/profile`, `/teachers`, `/self-study/*`, `/time`,
`/namaz`, `/money`, `/tuition`, `/clubs`, `/services*`, `/projects`,
`/tours`, `/notice`, `/reports`, `/notes`, `/settings`, `/about`।

**ধাপ ৩ — `serviceSync.js`-এর hardcoded "student" শব্দ ফিক্স:**
আগের follow-up-এ চিহ্নিত inconsistency ঠিক করা হয়েছে — দুই জায়গায়
notification message-এ fallback ছিল `'একজন student'`
(booking/inquiry পাঠানো ব্যক্তির নাম না থাকলে), যেটা এখন faculty
account Services ব্যবহার করলেও ভুল দেখাত। উভয় জায়গায়ই
`'কেউ একজন'`-এ বদলানো হয়েছে (role-neutral):
- new-inquiry alert message (owning provider-কে পাঠানো)
- booking-cancelled alert message (owning provider-কে পাঠানো)

ফিল্ড নাম (`studentUid`/`studentName`/`studentPhone`) নিজে পাল্টানো
হয়নি — সেটা larger migration, শুধু internal naming, user-facing কিছু
না।

**বদলানো/নতুন ফাইল:**
- নতুন: `src/components/RequireStudentMode.jsx`
- বদলানো: `src/App.jsx` (import + ১৯টা route wrap)
- বদলানো: `src/lib/serviceSync.js` (২টা hardcoded string ফিক্স)

**Verify করা হলো:**
- `node checksyntax.cjs` → `OK`
- `node check_imports.mjs` → শুধু আগের ২টা pre-existing
  `routePreload.js` failure, এই পরিবর্তনগুলোর সাথে সম্পর্কহীন
- App.jsx-এ `RequireStudentMode` ব্যবহারের সংখ্যা হাতে গুনে যাচাই
  (১৯টা route, কোনো duplicate/missing নেই)
