# KUETx — Service Detail Page (`/services/:id`) Redesign — Handoff/Progress Prompt

## Context — প্রজেক্ট সম্পর্কে

A3KM Studio-র KUETx প্রজেক্ট (React 18, Vite, TailwindCSS, Firebase v10,
IndexedDB, offline-first PWA)। Founder/lead builder সব coding-এর জন্য AI
tools ব্যবহার করেন, নিজে শুধু planning/design/feature decision নেন। Deploy
হয় GitHub → Vercel দিয়ে (কোনো local dev environment নেই — `npm run dev`
লোকালি চলে না)। Live site: **kuetx.com**।

Communication preference: Banglish/Bangla-য় input, reply বাংলা script-এ।
Direct, কোনো flattery না। শুধু changed/new files দেবে (full zip ছাড়া),
**প্রতিটা phase শেষে দুটো output**: (১) পরিবর্তিত কোড-সহ পুরো zip, (২) এই
progress doc-টাই আপডেট করে (phase status/notes সহ) আলাদা `.md` ফাইল হিসেবে —
যাতে এই একই prompt অন্য session/অন্য AI দিয়ে continue করা যায়।

## এই কাজের সূত্রপাত

Founder-এর observation: `/services/:id` (ServiceDetail.jsx) পেজ-এর booking
flow "কেমন জানি" দেখতে লাগছে — বিশেষত:
1. Offering picker card (ছবি+নাম+দাম) আর booking details form (phone/time)
   একই card-এ, একটার নিচে একটা — মনে হচ্ছে flow-order উল্টো (booking details
   আগে দেখা যাচ্ছে, service select পরে মনে হচ্ছে — আসলে order ঠিকই আছে কিন্তু
   mobile-এ compact card grid-এর নিচেই বড় form থাকায় ঠাসা লাগছে)।
2. Grid/list view toggle চাওয়া হয়েছিল, পরে confirm করা হয়েছে: **grid-only,
   list toggle লাগবে না।**
3. **সব service type-এর জন্য একই flow ঠিক না** — প্রতিটা service type-এর
   real-world nature অনুযায়ী আলাদা booking/order experience দরকার (salon vs
   hotel/food vs medicine vs bookstore vs onlinemart vs errand)।
4. Booking details step **modal/popup** হিসেবে হবে, আলাদা page না (context
   loss এড়াতে, দ্রুত interaction-এর জন্য) — এটা Founder-approved সিদ্ধান্ত।

## Codebase-এ বর্তমান অবস্থা (এই session-এ read-only investigate করা হয়েছে)

### Interaction modes — ইতিমধ্যেই টাইপ-ভিত্তিক আলাদা (`src/lib/serviceSync.js`)
```js
const TYPE_TO_INTERACTION_MODE = {
  salon: 'booking',
  hotel: 'booking',       // <- এটাই মূল gap, নিচে দেখুন
  medicine: 'inquiry',
  bookstore: 'inquiry',
  onlinemart: 'inquiry',
  errand: 'errand',
};
```

### `booking` mode → `BookingForm` (src/pages/ServiceDetail.jsx, ~line 862)
- **Single offering select** (radio-style card grid, `offeringId` state)
- Phone number, (faculty হলে) name, optional preferred date/time
- একটাই "Book now" button
- salon-এর জন্য এই single-select model ঠিকই আছে (একজন গ্রাহক একবারে একটা
  সার্ভিস বুক করে — hair cut অথবা shave, দুটো একসাথে "বুক" করার দরকার নেই,
  বাস্তবেও salon booking সাধারণত slot-based single-service হয়)
- **কিন্তু `hotel` (food/hotel-খাবার) এই একই single-select ব্যবহার করছে —
  এটা বাস্তবতার সাথে মেলে না।** কেউ food order করলে একাধিক আইটেম (২টা
  বিরিয়ানি + ১টা কোল্ড ড্রিংক) চায়, single "hair cut"-এর মতো একটা জিনিস
  বেছে বুক করা যায় না।

### `inquiry` mode → `InquiryForm` (src/pages/ServiceDetail.jsx, ~line 565)
- **Multi-item selection with quantity stepper** (+/− per item), running
  estimated total, optional free-text question, single submit creates
  one inquiry doc with an `items[]` array
- medicine/bookstore/onlinemart-এর জন্য এই flow ইতিমধ্যেই সঠিক এবং ভালোভাবে
  বানানো — **touch করার দরকার নেই**
- Status flow হালকা: open → answered → closed (booking mode-এর
  pending/confirmed/done state machine থেকে আলাদা, ইচ্ছাকৃতভাবে)

### `errand` mode → `ErrandForm`
- কোনো fixed offerings নেই — free-form "pick and drop" request
- এই redesign-এর scope-এর বাইরে (আলাদা nature, touch করা হবে না)

### Backend already multi-item-ready
`createBooking()` (src/lib/serviceSync.js, line ~548) ইতিমধ্যেই
`items` array parameter নেয় (InquiryForm এটা ব্যবহার করে) পাশাপাশি single
`offeringId়`ও নেয় (BookingForm ব্যবহার করে) — অর্থাৎ **hotel-কে multi-item
বানাতে backend/data-model কোনো নতুন কাজ লাগবে না**, শুধু `hotel`-এর জন্য কোন
form component ব্যবহার হবে সেটা পাল্টাতে হবে।

### Existing shared components/patterns যা নতুন কাজে reuse করা উচিত
- `src/components/Modal.jsx` — shared portal-based modal, booking-details
  popup-এর জন্য এটাই ব্যবহার হবে (নতুন modal system বানানোর দরকার নেই)
- `src/pages/Services.jsx`-এর `SORT_OPTIONS`/`sortServices()` pattern
  (line ~184-210) — level-1 shop-list page-এ ইতিমধ্যেই "Sort By" dropdown
  আছে (Open now first / Name A-Z / Newest); এই idiom-ই offering-level
  sort-এর জন্য reuse করা উচিত, নতুন UI pattern আবিষ্কার করার দরকার নেই
- `.kx-pick-grid`/`.kx-offering-grid` CSS classes (ServiceDetail.jsx-এর
  ভেতরেই `<style>` block হিসেবে) — card grid-এর existing visual language,
  redesign-এ এগুলোর উপর ভিত্তি করেই আরও পালিশ করা উচিত, একদম নতুন শুরু না

## চূড়ান্ত সিদ্ধান্ত (Founder-approved, এই session-এ confirm করা হয়েছে)

1. **Grid-only** offering picker — list-view toggle বাদ।
2. Offering card-এ **শুধু ছবি + নাম + দাম** থাকবে, booking form সেখানে
   embedded থাকবে না।
3. Booking details **Modal (popup)** হিসেবে খুলবে, আলাদা full page না।
4. **প্রতিটা service type-এর জন্য আলাদা, তার nature-উপযোগী flow**:
   - salon → single-select booking (বর্তমান BookingForm-এর কাছাকাছি,
     শুধু UI polish + 2-step modal flow)
   - hotel (food) → multi-item cart-style (InquiryForm-এর pattern থেকে
     adapt করা, কিন্তু booking-mode-এর pending/confirmed/done status রাখা
     হবে — inquiry-mode-এ swap করা হবে না, কারণ food order accept/reject
     হওয়ার concept booking-এর মতোই থাকা উচিত, inquiry-র মতো "answered"
     না)
   - medicine/bookstore/onlinemart → **অপরিবর্তিত** (ইতিমধ্যে সঠিক)
   - errand → **অপরিবর্তিত** (scope-এর বাইরে)
5. **প্রতিটা phase শেষে দুটো ফাইল output**: (ক) সম্পূর্ণ codebase zip,
   (খ) এই progress-md ফাইলটাই phase-status আপডেট করে আলাদা করে দেওয়া
   হবে, যাতে future session-এ পুরো context ছাড়াই কাজ continue করা যায়।

## Phase breakdown

### Phase 1 — Offering picker card redesign + Sort dropdown (salon + hotel উভয়ের জন্য shared)
**Scope:**
- `.kx-pick-card`/`.kx-offering-card` visual polish: বড়, স্পষ্ট product-card
  look (ছবি dominant, নাম+দাম নিচে clean spacing-এ, hover/tap subtle
  elevation/border), 2-column grid বজায় থাকবে (মোবাইল), বড় screen-এ বেশি
  column
- প্রতিটা card-এর নিচে স্পষ্ট **"Book"**/**"Order"** call-to-action (শুধু
  select-highlight না, একটা button/badge — click করলেই modal open হবে)
- Offerings ৫+ হলে ওপরে ছোট **Sort dropdown** (Services.jsx-এর
  SORT_OPTIONS pattern থেকে adapt: "Price: Low to High", "Price: High to
  Low", "Name A-Z") — offerings কম থাকলে (≤4) sort dropdown না-ও দেখানো
  যেতে পারে (unnecessary clutter এড়াতে)
- এই phase-এ **click করলে এখনো পুরনো inline form-ই খুলবে** (modal এখনো
  না) — শুধু card visual + sort ঠিক হবে, এতে ছোট, verify-করা-সহজ ধাপে ধাপে
  আগানো যায়

**Files touched (expected):** `src/pages/ServiceDetail.jsx` (BookingForm ও
InquiryForm উভয়ের card-grid + style অংশ, shared CSS হলে ভালো)

**Verify (Founder browser-এ manually):** `/services/[কোনো salon/hotel id]`
এবং `/services/[কোনো medicine/bookstore id]` — card grid দেখতে সুন্দর
লাগছে কিনা, sort dropdown কাজ করছে কিনা

---

### Phase 2 — Modal-based 2-step flow (salon-এর জন্য প্রথমে, বর্তমান single-select model অক্ষুণ্ণ রেখে)
**Scope:**
- Offering card click → `Modal.jsx` দিয়ে booking-details popup খোলা
- Modal-এর ভেতরে ওপরে selected offering-এর summary (thumbnail + name +
  price) + "পাল্টাতে চাও?" জন্য "Change" link (modal বন্ধ করে picker-এ
  ফিরে যায়)
- তারপর existing phone/name/preferred-time fields + submit — এই অংশের
  logic/validation অপরিবর্তিত থাকবে, শুধু placement modal-এ move হবে
- BookingForm-এর state management (offeringId, studentPhone ইত্যাদি)
  অপরিবর্তিত রাখা — শুধু render structure পাল্টানো

**Files touched (expected):** `src/pages/ServiceDetail.jsx` (BookingForm)

**Scope-এর বাইরে এই phase-এ:** hotel-কে multi-item বানানো (সেটা Phase 3)

**Verify:** salon-type shop-এ গিয়ে booking flow শুরু থেকে শেষ পর্যন্ত টেস্ট
করা — card click → modal open → change link কাজ করে কিনা → submit successful
হয় কিনা, existing booking history/status view (MyActiveBooking) এখনো ঠিক
আছে কিনা

---

### Phase 3 — Hotel (food) multi-item flow
**Scope:**
- `hotel` type-এর জন্য নতুন multi-item booking flow — InquiryForm-এর
  quantity-stepper + running-total pattern থেকে adapt, কিন্তু:
  - Backend interactionMode এখনো `'booking'` থাকবে (inquiry-তে swap করা
    হবে না) — `createBooking()` কে `items` array পাঠানো হবে (parameter
    already সাপোর্ট করে), শুধু `interactionMode` field অপরিবর্তিত
  - Status flow booking-mode-এর pending/confirmed/done-ই থাকবে (owner-কে
    accept/reject করতে হবে, inquiry-র মতো শুধু "answered" reply না)
  - `MyActiveBooking`/relevant display component-কে multi-item booking
    render করতে হবে (এখন single offeringId ধরে নেয়, items array-ও handle
    করতে হবে) — এই অংশ verify/আপডেট লাগবে
- Offering card grid-এ প্রতিটা card-এ quantity stepper (InquiryForm-এর
  মতো +/−), তারপর "Review Order" বা "Continue" button যেটা modal খোলে
  (একাধিক selected item-এর summary + phone/preferred-time + submit)
- salon-এর booking flow (Phase 2) অপরিবর্তিত থাকবে — এই phase শুধু hotel-
  specific

**Files touched (expected):** `src/pages/ServiceDetail.jsx` (নতুন
HotelOrderForm বা BookingForm-এর ভেতরে type-conditional branch — কোনটা
cleaner সেটা implement করার সময় ঠিক করা যাবে), সম্ভবত `src/lib/serviceSync.js`
(যদি booking-doc read/display-এ multi-item field না থাকে), provider-side
booking-detail view (যেখানেই owner booking request দেখেন) যদি single-item
ধরে নিয়ে থাকে

**Verify:** hotel-type shop-এ গিয়ে একাধিক item select করে order দেওয়া,
তারপর owner-side dashboard-এ গিয়ে সেই multi-item order ঠিকভাবে দেখা যাচ্ছে
কিনা যাচাই করা (এটা critical — provider-side render না বদলালে multi-item
order broken/incomplete দেখাবে)

---

### Phase 4 — Final polish pass (সব service type একসাথে দেখা)
**Scope:**
- সব ৬ service type (salon, hotel, medicine, bookstore, onlinemart,
  errand) একবার side-by-side ঘুরে দেখা — visual consistency, spacing,
  color/accent ব্যবহার সব জায়গায় সামঞ্জস্যপূর্ণ কিনা
- Empty states, loading states, closed-shop states — নতুন card
  design-এর সাথে সব ঠিকভাবে মেলে কিনা
- কোনো leftover dead code (পুরনো inline form markup যা আর ব্যবহার হয় না)
  পরিষ্কার করা

**Verify:** ৬ type-এর অন্তত একটা করে shop-এ পুরো flow শুরু থেকে শেষ পর্যন্ত
manually টেস্ট করা

---

## এই কাজে যা করা হবে না (scope-এর বাইরে, স্পষ্টভাবে বাদ)
- `medicine`/`bookstore`/`onlinemart` (inquiry mode) — অপরিবর্তিত, এগুলো
  ইতিমধ্যেই সঠিক multi-item pattern-এ আছে
- `errand` — অপরিবর্তিত, আলাদা nature (fixed offerings নেই)
- Provider-side offering management UI (`ProviderOfferingsPage.jsx` ইত্যাদি)
  — এই redesign শুধু student-facing booking flow নিয়ে, provider dashboard
  আলাদা কাজ
- List-view toggle — explicitly বাদ দেওয়া হয়েছে (grid-only চূড়ান্ত)
- Provider testing-view / role-switch related কোনো কাজ — এটা আলাদা,
  ইতিমধ্যে আলোচিত ও বাদ দেওয়া হয়েছে টপিক (এই session-এরই আগের অংশ, কিন্তু
  এই redesign-এর সাথে সম্পর্কহীন)

## Phase status (এই ফাইল প্রতি phase শেষে আপডেট হবে)

- [ ] Phase 1 — Offering picker card redesign + sort dropdown — **শুরু হয়নি**
- [ ] Phase 2 — Modal-based 2-step flow (salon) — **শুরু হয়নি**
- [ ] Phase 3 — Hotel multi-item flow — **শুরু হয়নি**
- [ ] Phase 4 — Final polish pass (Part A সম্পূর্ণ) — **শুরু হয়নি**
- [ ] Phase 5 — Shop/Provider details page + review system — **শুরু হয়নি**
- [ ] Phase 6 — Errand visibility customization (request-flow-এর দিক) — **শুরু হয়নি**
- [ ] Phase 7 — Errand broadcast/offer flow (নতুন mechanism) — **শুরু হয়নি**
- [ ] Phase 8 — Errand card redesign + list-page repositioning — **শুরু হয়নি**

*(প্রতিটা phase সম্পূর্ণ হলে এখানে checkbox টিক করে, তারিখ ও কী কী ফাইল
পাল্টানো হয়েছে সংক্ষেপে নোট করে এই ফাইলটাই নতুন করে output করা হবে, পাশাপাশি
পুরো codebase-এর একটা zip।)*

---

# Part B — Shop Detail Page, Reviews, এবং Errand/Pick-and-Drop Redesign

## এই অংশের সূত্রপাত (Founder-এর দ্বিতীয় দফার observation)

Part A (উপরে) মূলত booking-flow-এর card/modal UI নিয়ে। এই Part B সম্পূর্ণ
নতুন, বড় scope — তিনটা আলাদা কিন্তু সম্পর্কিত জিনিস:

1. Shop/Provider-এর জন্য একটা পূর্ণাঙ্গ **details page** (location সহ),
   এবং সার্ভিস নেওয়ার পর **review/comment** দেওয়ার সিস্টেম — দুটোই একসাথে
   এই details page-এ দেখানো।
2. **Errand (Pick and Drop)** সম্পূর্ণ নতুন design পাবে — আলাদা রঙ (gold/
   golden accent), তালিকার সবার আগে থাকবে (mobile + desktop উভয়ে), এবং
   এর **flow দুই ধরনের হবে** (নিচে বিস্তারিত):
   - বর্তমান request-flow (student/faculty → Runner-কে request পাঠায়)
     বহাল থাকবে, কিন্তু visibility-customization যোগ হবে
   - **নতুন** broadcast/offer flow (Runner → সব student স্বয়ংক্রিয়ভাবে
     দেখে, শপ-কার্ডের মতো) যোগ হবে — দুটো mechanism **একসাথে সহাবস্থান
     করবে**, একটা আরেকটাকে replace করবে না
3. Errand list-item-এর **card content ছোট করা** — এখন title + money-টুকুই
   card-এ দেখাবে, পুরো detail পড়ার জন্য আলাদা page/route।

---

## Phase 5 — Shop/Provider Details Page + Review System

### Scope
- নতুন route: `/services/:id/about` (বা অনুরূপ) — বর্তমান
  `/services/:id` (booking flow) থেকে আলাদা, শুধু **shop/provider পরিচিতি**র
  জন্য:
  - Provider-এর নাম, cover/gallery images (ServiceDetail.jsx-এর existing
    `GalleryMedia` reuse করা যায়)
  - Location (locationText + GPS "View on map" — ইতিমধ্যে ServiceDetail.jsx-এ
    আছে, এখান থেকে সরিয়ে/duplicate করে এই about-page-এ আনা)
  - Description, open/closed status, hasDelivery badge — সবই বর্তমান
    ServiceDetail.jsx-এ ইতিমধ্যে আছে, এই নতুন page-এ পুনর্বিন্যাস করে
    আনা হবে
  - Contact info (phone) — FloatingContactButton-এর তথ্যই এখানে static
    ভাবেও দেখানো যেতে পারে
- বর্তমান `/services/:id` main page থেকে এই about-info-এর একটা লিংক/ট্যাব
  ("Shop-টা সম্পর্কে জানুন" / "About this shop") থাকবে যেটা `/about`
  sub-page-এ নিয়ে যায় — booking flow (Part A) এবং shop-info (Part B)
  আলাদা concerns হিসেবে আলাদা থাকবে, একই page-এ গাদাগাদি না করে

### Review/Comment system (নতুন feature, নতুন Firestore সাব-কালেকশন লাগবে)
- **কারা review দিতে পারবে**: যে student/faculty একটা service থেকে
  সফলভাবে বুকিং/অর্ডার/ইনকোয়ারি সম্পন্ন করেছে (status `confirmed`/`done`/
  `finished`/`answered`+closed — booking mode-ভেদে ঠিক কোন status
  "সম্পন্ন" ধরা হবে সেটা implement করার সময় প্রতিটা interactionMode
  অনুযায়ী ঠিক করা লাগবে) — **যে service নেয়নি সে review দিতে পারবে না**
  (fake/spam review প্রতিরোধে)
- Review-এ: rating (star, ১-৫) + optional text comment
- নতুন Firestore path প্রস্তাবিত: `services/{serviceId}/reviews/{reviewId}`
  — fields: `reviewerUid`, `reviewerName`, `rating`, `comment`,
  `createdAt`, `bookingId` (কোন booking/order-এর ভিত্তিতে review সেটার
  রেফারেন্স, duplicate-review-প্রতিরোধ + audit-এর জন্য)
- Shop-এর average rating (aggregate) কোথাও cache করা লাগবে কিনা
  (Firestore-এ প্রতিবার সব review sum করে average বের করা costly হতে
  পারে অনেক review হলে) — ছোট scale-এ শুরুতে client-side aggregate
  ঠিক আছে, পরে দরকার হলে Cloud Function দিয়ে denormalize করা যায়
  (এখনই over-engineer করার দরকার নেই)
- এই review/rating info **শুধু নতুন about-page-এ না, বরং overall shop
  card (Services.jsx list)-এও** ছোট করে (⭐ 4.5 (12) এর মতো) দেখানো
  যেতে পারে — Founder confirm করবেন list-card-এও দেখাবে কিনা implement
  করার সময়

### Firestore rules
- নতুন `reviews` subcollection-এর জন্য নতুন security rule লিখতে হবে
  (firestore.rules) — write শুধু "verified booking আছে" এমন uid-এর জন্য
  অনুমোদিত হবে, এটা rule-এ enforce করা বেশ জটিল (booking doc আরেকটা
  subcollection-এ, cross-collection check লাগবে) — Cloud Function দিয়ে
  server-side validate করা বেশি নিরাপদ ও সহজ হতে পারে ক্লায়েন্ট-সাইড rule-এর
  চেয়ে; implement করার সময় এই trade-off বিবেচনা করা লাগবে

### Files touched (expected)
`src/pages/ServiceDetail.jsx` (about-tab লিংক), নতুন
`src/pages/ServiceAbout.jsx` (বা যেই নাম দেওয়া হয়), `src/lib/serviceSync.js`
(review read/write functions), `src/App.jsx` (নতুন route),
`firestore.rules`

### Verify
কোনো একটা service-এ successful booking সম্পন্ন করে review দেওয়া, review
না-নেওয়া service-এ review-form না দেখানো নিশ্চিত করা, about-page-এ
location/gallery/contact সব ঠিক দেখাচ্ছে কিনা

---

## Phase 6 — Errand Request-Flow Visibility Customization

*(এটা বর্তমান request-flow-এর উপর — student/faculty Runner-কে request
পাঠায়, সেই mechanism-টাই বহাল থাকবে, শুধু "কার কাছে request দৃশ্যমান হবে"
কাস্টমাইজ হবে)*

### Scope — দুই পক্ষের customization
1. **Provider/Runner-এর নিজের সেটিং**: তার service-এ কোন ধরনের
   requester (all / faculty-only / student-only) থেকে request accept
   করবে সেটা টগল করতে পারবে — ProviderOfferingsPage বা
   ProviderShopSettingsPage-এ একটা নতুন সেটিং হিসেবে
2. **প্রতিটা individual Student-এর নিজের সেটিং**: "আমাকে errand/pick-and-drop
   request পাঠানো/দেখানো বন্ধ করো" — এটা মূলত Phase 7-এর broadcast-flow-এর
   সাথে বেশি প্রাসঙ্গিক (নিচে দেখুন), কারণ **বর্তমান request-flow-এ
   Student কখনোই "request পায়" না — Student নিজেই request *পাঠায়***।
   তাই "keo jodi chay je tar kache req asbe na" — এই চাওয়াটা আসলে
   **Phase 7-এর নতুন broadcast-flow-এর জন্য প্রযোজ্য**, request-flow-এর
   জন্য না (request-flow-এ student receiver না, sender)। এই distinction
   Phase 7-এ বিস্তারিতভাবে হ্যান্ডল হবে।

### Files touched (expected)
`src/pages/provider/ProviderShopSettingsPage.jsx` (বা যেখানে provider
service-level সেটিংস রাখে), `src/lib/serviceSync.js` (visibility-filter
লজিক), request-creation flow-এ requester role অনুযায়ী block করা

### Verify
Provider "faculty-only" সেট করলে student থেকে request block হয় কিনা
(অথবা UI-তেই request-button hide/disable হয় কিনা), "all" থাকলে সবাই
পারে কিনা

---

## Phase 7 — Errand Broadcast/Offer Flow (সম্পূর্ণ নতুন mechanism)

*(এটা বর্তমান request-flow থেকে আলাদা, নতুন সংযোজন — দুটো mechanism
একসাথে থাকবে, একটা আরেকটাকে replace করবে না)*

### ব্যবহারকারীর ভাষায় যা বলা হয়েছে (রেফারেন্সের জন্য অবিকৃত রাখা হলো)
> "erpor eitay studnet faculty jekeo to freely request dite pare... but
> ekhn theke eita sobar kache req jabe, sokol student er kache jabe,
> kintu kono faculty er kache jabe na... service provider vitore
> customisation dui pokkho ei korte parbe, je user like order korbe se
> customis ekore dite parbe, je se ki faculty provider or only student,
> only provider evabe dite parbe... keo jodi chay je tar kache req asbe
> na, se chaiole toggle on of kore rakhte parbe"

### Interpretation (implement করার আগে Founder-এর সাথে confirm করা জরুরি —
### এই phase শুরুর আগে একটা clarification round লাগবে)
একটা Runner/provider একটা errand-service "খুললে" (বা on রাখলে), সেটা
**স্বয়ংক্রিয়ভাবে প্রতিটা Student-এর সামনে একটা broadcast/notification/
card হিসেবে ভেসে ওঠে** — student নিজে থেকে খুঁজে গিয়ে request পাঠানোর
বদলে, Runner-ই যেন ঘোষণা দিচ্ছে "আমি এখন ডেলিভারি করছি, কারো কিছু লাগলে
বলো"। এটা Faculty-দের কাছে যাবে না ডিফল্টে (ব্যবহারকারীর নির্দিষ্ট শর্ত)।

**Open questions যা এই phase শুরুর আগে Founder-কে জিজ্ঞেস করা দরকার**
(এই ফাইলে placeholder হিসেবে রাখা হলো, যাতে future session প্রথমেই এগুলো
স্পষ্ট করে নেয়):
1. "সবার কাছে যাবে" মানে কি literally **প্রতিটা student-এর phone-এ push
   notification/in-app notification** যাবে, নাকি Services list/Dashboard-এ
   একটা highlighted card হিসেবে **passively দেখা যাবে** (student নিজে
   app খুললে দেখবে, কিন্তু আলাদা করে push notify হবে না)? — এই দুটোর
   engineering cost অনেক আলাদা (push notification মানে প্রতিটা broadcast-এ
   কয়েক হাজার notification write/send, rate-limit ও cost বিবেচনা লাগবে)।
2. একটা Runner কি বারবার "broadcast" করতে পারবে (প্রতিদিন/প্রতি শিফটে),
   নাকি service `isOpen` হওয়া মাত্রই এটা এক ধরনের persistent broadcast
   অবস্থা?
3. Student-এর "toggle on/off" সেটিং কি per-Runner (নির্দিষ্ট Runner-এর
   broadcast বন্ধ করা) নাকি global (সব Runner-এর broadcast-ই বন্ধ করা)?

### Draft technical approach (clarification-এর পর চূড়ান্ত হবে)
- Errand-mode service-এর doc-এ নতুন boolean field, যেমন
  `broadcastActive` — Runner টগল করলে on/off হয়
- Student-side: `profile`-এ (বা আলাদা `users/{uid}/preferences` doc-এ)
  একটা `errandBroadcastOptOut` flag (বা per-Runner হলে একটা set/array)
- Dashboard/Services list-এ broadcast-active errand card গুলো আলাদা
  section-এ (Phase 8-এর gold-accent card design অনুযায়ী) — student-এর
  opt-out flag চেক করে সেই card দেখানো/লুকানো হবে
- **Faculty account হলে ডিফল্টে কখনোই এই broadcast section দেখাবে না**
  (role-check, Phase 6-এর provider-level customization থেকে আলাদা —
  এটা platform-level rule, provider override করতে পারবে না বলেই মনে
  হচ্ছে বর্তমান বিবরণ অনুযায়ী, কিন্তু এটাও confirm করা দরকার)

### Files touched (expected — draft, clarification-এর পর বদলাতে পারে)
`src/lib/serviceSync.js` (broadcastActive read/write + student-visible
query), `src/pages/Services.jsx` / `src/pages/Dashboard.jsx` (broadcast
section render), `src/pages/provider/*` (Runner-এর broadcast toggle UI),
সম্ভবত নতুন Cloud Function (যদি push-notification approach বেছে নেওয়া হয়)

### Verify
Runner broadcast on করলে student-side list-এ card ভেসে ওঠে কিনা, opt-out
করা student-এর কাছে না-আসা নিশ্চিত করা, faculty account-এ কখনোই না
দেখানো নিশ্চিত করা

---

## Phase 8 — Errand Card Redesign + List-Page Repositioning

### Scope
1. **রঙ**: Errand/Pick-and-Drop card-এর জন্য আলাদা accent — gold/golden
   রঙের ধরন (বাকি service-type card থেকে visually আলাদা করে চেনা যাবে)
2. **অবস্থান**: Services list page (mobile + desktop উভয়ে)-এ errand
   card(s) সবার **সবচেয়ে ওপরে** থাকবে, category-alphabetical বা
   sort-অনুযায়ী মিশে না গিয়ে
3. **Card content সংক্ষিপ্ত করা**: বর্তমানে card-এ যা আছে তার বদলে এখন
   থেকে শুধু **title + money (proposed price/rate)** — বাকি বিস্তারিত
   বিবরণ (item description, ইত্যাদি) card-এ না দেখিয়ে **আলাদা page/route**-এ
   নিয়ে যাওয়া (ক্লিক করলে সেই detail page খোলে)
   - এটা মূলত request-list (Runner-এর ইনবক্স, যেখানে open errand
     requests সারি সারি দেখা যায়) এবং/অথবা broadcast-card (Phase 7) —
     দুটোরই card-content ছোট রাখার কথা বলা হচ্ছে, ঠিক কোনটা (বা দুটোই)
     implement করার সময় Founder-এর reference screenshot লাগবে যদি আরও
     স্পষ্ট করা দরকার হয়

### Files touched (expected)
`src/pages/Services.jsx` (ServiceCategoryGrid/card list-এ errand-এর
জন্য special-case ordering + color), errand request-list component
(Runner ইনবক্স, যদি আলাদা ফাইলে থাকে — এই session-এ এখনো locate করা হয়নি,
Phase শুরুর আগে খুঁজে বের করতে হবে), নতুন detail-page/route (errand
request-এর পূর্ণ বিবরণের জন্য)

### Verify
Services list-এ errand card সবার ওপরে ও gold-accent-এ দেখা যাচ্ছে কিনা
(mobile + desktop), card-এ শুধু title+money দেখাচ্ছে কিনা, ক্লিক করলে detail
page-এ সব তথ্য ঠিকভাবে দেখা যাচ্ছে কিনা

---

## Phase 5-8 শুরুর আগে যা করতে হবে (পরবর্তী session-এর জন্য নোট)
- Phase 7-এর "Open questions" (৩টা প্রশ্ন) Founder-কে জিজ্ঞেস করে confirm
  করা — এই ফাইলেই উত্তর যোগ করে আপডেট করা, তারপর implement শুরু
- Runner-এর "ইনবক্স" (open errand requests-এর list, Runner নিজে যেটা
  accept করে) কোন ফাইলে আছে সেটা locate করা — এখনো এই session-এ খোঁজা
  হয়নি, Phase 8 শুরুর আগে দরকার
- Review system (Phase 5)-এর জন্য "সফল বুকিং" ঠিক কোন status মানে সেটা
  প্রতিটা interactionMode (booking/inquiry/errand) অনুযায়ী precisely
  সংজ্ঞায়িত করা — এই ফাইলে এখনো draft/approximate লেখা আছে
