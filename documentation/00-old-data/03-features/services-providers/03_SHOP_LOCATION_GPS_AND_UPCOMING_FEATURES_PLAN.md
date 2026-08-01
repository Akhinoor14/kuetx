# KUETx — শপ লোকেশন (GPS) ইন্টিগ্রেশন + Delivery/Errand Runner + "Upcoming Features" নোট — পরিকল্পনা

## এই MD কীভাবে পড়তে/ব্যবহার করতে হবে (self-instruction)
> এই ফাইলটা শুধু একটা প্ল্যান-ডকুমেন্ট না — এটা একটা **লাইভ প্রোগ্রেস-ট্র্যাকার**।
> কেউ (future session/অন্য কেউ) যদি শুধু এই MD পড়ে, তাহলে তার নিজে থেকেই বুঝে
> যাওয়া উচিত: (ক) কোনটা সম্পন্ন, (খ) কোনটা বাকি, (গ) ঠিক কোন ফাইলে/কোন
> ফাংশনে কাজ চলছে। তাই যখনই কোনো ধাপ শেষ হবে:
> 1. উপরের STATUS চেকলিস্টে `[ ]` থেকে `[x]` করতে হবে।
> 2. সংশ্লিষ্ট সাব-সেকশনে **সম্পন্ন**/**বাকি** নোট আপডেট করতে হবে (ঠিক যেভাবে
>    Phase 4-এ আগে থেকেই করা আছে)।
> 3. **কোন ফাইলে কী করা হয়েছে** সেটা এক লাইনে লিখে রাখতে হবে, যাতে পরের
>    সেশন কোনো কিছু re-explore না করেই সরাসরি বাকি অংশে চলে যেতে পারে।
> এই self-instruction অংশটা কোনোভাবেই মুছে ফেলা যাবে না — শুধু বাড়বে/আপডেট
> হবে।

## STATUS
- [x] Phase 1 — **সম্পন্ন (ব্যাকএন্ড + UI দুটোই)** — শুধু rules deploy/live-test বাকি
  - [x] Phase 1.1 — UI প্লেসমেন্ট + বাটন-ফ্লো — **সম্পন্ন**
    - `src/pages/provider/ProviderShopSettingsPage.jsx`-এ `ShopMetaEditor`-এর ভেতর নতুন `GpsLocationSubsection` কম্পোনেন্ট, `locationText` ইনপুটের ঠিক নিচে বসানো হয়েছে। ফ্লো: idle → fetching (`navigator.geolocation.getCurrentPosition`, `enableHighAccuracy: true`) → accuracy ৫০ মিটারের বেশি হলে `low_accuracy` warning-ধাপ (retry বা "তবুও এগিয়ে যান") → `confirm` ধাপ (Google Maps লিংক + "✓ হ্যাঁ, এটাই সঠিক" / "✗ আবার চেষ্টা করুন") → `saving` → সেভ। Permission-denied/timeout/unavailable প্রতিটার জন্য আলাদা soft error message।
  - [x] Phase 1.2 — Map preview — **সম্পন্ন**
    - টেক্সট-ফলব্যাক পদ্ধতি: `googleMapsUrl(lat, lng)` হেল্পার `google.com/maps?q=lat,lng` লিংক বানায়, নতুন ট্যাবে খোলে (কোনো API key লাগে না)। low_accuracy ও confirm উভয় ধাপেই এই লিংক দেখানো হয়। Embed-key bonus layer ইমপ্লিমেন্ট করা হয়নি (প্ল্যানেই "nice to have, বাধ্যতামূলক না" বলা ছিল) — future-এ যোগ করা যাবে।
  - [x] Phase 1.3 — ডেটা মডেল + Firestore rules — **সম্পন্ন**
    - `src/lib/serviceSync.js`-এর `updateServiceDetails()`-এ `locationLat`/`locationLng`/`locationAccuracy` নতুন অপশনাল প্যারামিটার যোগ হয়েছে, lat/lng লেখা হলে `locationSetAt: serverTimestamp()` অটো-স্ট্যাম্প হয়। `firestore.rules`-এ নতুন `isValidLocationWrite()` হেল্পার (lat ২০-২৭, lng ৮৮-৯৩ রেঞ্জ-চেক) provider-owner update ব্র্যাঞ্চে যোগ করা হয়েছে।
    - **নতুন স্ট্রিং:** `src/lib/providerStrings.js`-এ `shopSettings.gps*` namespace (bn + en দুই ব্লকেই)।
    - **এখনো বাকি:** Firestore rules বাস্তবে deploy করে টেস্ট করা — এই এনভায়রনমেন্টে নেটওয়ার্ক অ্যাক্সেস (Firebase CLI) নেই বলে সম্ভব হয়নি, শুধু esbuild দিয়ে সব বদলানো ফাইলের syntax validate করা হয়েছে এবং rules ফাইলের brace/paren balance চেক করা হয়েছে। ডেভেলপার নিজে `firebase deploy --only firestore:rules` চালিয়ে verify করবে।
- [x] Phase 2 — **সম্পন্ন** (Student/Faculty সাইড: লোকেশন দেখানো)
  - `src/pages/ServiceDetail.jsx`-এ existing 📍 `locationText` badge-এর পাশে coordinate থাকলে (`locationLat`/`locationLng` উভয়ই number) "মানচিত্রে দেখুন" লিংক (নতুন ট্যাবে `google.com/maps?q=lat,lng` খোলে, কোনো API key লাগে না)। শুধু `locationText` বা `hasDelivery` না থাকলেও যদি শুধু coordinate থাকে, তাহলেও badge-row দেখাবে এমন এজ-কেস কভার করা হয়েছে (visibility condition-এ coordinate-চেক যোগ করে)।
  - `Services.jsx` গ্রিড-কার্ডে ইচ্ছাকৃতভাবে কিছু যোগ করা হয়নি (প্ল্যান অনুযায়ী) — coordinate না থাকলে চুপচাপ hide থাকে, existing locationText প্যাটার্নই অনুসরণ করে।
- [x] Phase 3 — **স্কিপ করা হয়েছে (ইচ্ছাকৃতভাবে, ডেভেলপারের সিদ্ধান্তে)** — কারণ নিচে দেখুন
- [x] Phase 4 — **সম্পন্ন (ব্যাকএন্ড + UI দুটোই)** — শুধু rules deploy/live-test ও targeted-picker UI বাকি (নিচে দেখুন)
  - [x] Phase 4.1 — Runner ক্যাটাগরি + approval (Founder-only) — **সম্পন্ন**
    - `serviceSync.js`-এ `errand` নতুন `type`/`interactionMode` যোগ হয়েছে, `SERVICE_TYPE_LABELS`(_BN)-এ "Delivery/Errand Runner" ক্যাটাগরি যোগ হয়েছে — এটা স্বয়ংক্রিয়ভাবে Role-Select signup dropdown ও Provider dashboard-এর ক্যাটাগরি-গ্রিডে দেখাবে (কোনো আলাদা কোড লাগেনি ওই দুই জায়গায়, কারণ দুটোই আগে থেকেই `SERVICE_TYPES`/`PROVIDER_SIGNUP_TYPES` থেকে ডাইনামিক্যালি রেন্ডার করে)
    - Approval ইতিমধ্যে Founder-only ছিল সিস্টেমে (`isAdmin()`-গেটেড, Campus Lead-এর কোনো provider-approval path আদতে ছিলই না) — তাই এই অংশে অতিরিক্ত rule-change লাগেনি, শুধু verify করা হয়েছে
  - [x] Phase 4.2 — Errand Request তৈরি (ব্যাকএন্ড + UI) — **সম্পন্ন**
    - ব্যাকএন্ড (আগে থেকেই ছিল): `createErrandRequest()` — broadcast/targeted visibility, প্রাইস validation, "এক active request" মার্কার সহ; Firestore rules-এ create-branch
    - **UI (নতুন সম্পন্ন):** `src/pages/ServiceDetail.jsx`-এ `ErrandForm` (আইটেম-বিবরণ, প্রস্তাবিত মূল্য, ফোন — student-এর নাম profile থেকে auto, faculty হলে নাম-ফিল্ড আলাদা দেখানো হয়) + `MyActiveErrand` (স্ট্যাটাস ভিউ)। `interactionMode === 'errand'` হলে এই দুইটাই booking/inquiry ফর্মের বদলে রেন্ডার হয়। **এখনো বাকি:** targeted-visibility Runner-picker dropdown — বর্তমান ফর্ম শুধু broadcast পাঠায়, backend targeted সাপোর্ট করলেও ফর্মে টগল/dropdown যোগ করা হয়নি
  - [x] Phase 4.3 — Runner Accept + re-surface-on-edit (ব্যাকএন্ড + UI) — **সম্পন্ন**
    - ব্যাকএন্ড (আগে থেকেই ছিল): `editErrandProposedPrice()`, `acceptErrandRequest()` (transaction-guarded), `subscribeOpenErrandRequestsForRunner()`; Firestore rules-এ open→open (এডিট) ও open→runner_accepted transitions
    - **UI (নতুন সম্পন্ন):** `src/pages/provider/ProviderDashboard.jsx`-এ `ErrandQueue` (Open Requests তালিকা + Accept বাটন, broadcast/targeted উভয়ই দেখায়), `ServiceManager`-এ errand-mode subscription wire করা হয়েছে (booking/inquiry-mode subscription-দের সাথে mutually exclusive)
  - [x] Phase 4.4 — 2-step confirmation + contact exchange (ব্যাকএন্ড + UI) — **সম্পন্ন**
    - ব্যাকএন্ড (আগে থেকেই ছিল): `confirmErrandRequest()`, `rejectErrandAccept()`; Firestore rules-এ runner_accepted→confirmed ও runner_accepted→open transitions
    - **UI (নতুন সম্পন্ন):** Student/Faculty সাইড কনফার্ম/বাতিল বাটন `MyActiveErrand`-এ (ServiceDetail.jsx); Provider সাইড বাতিল বাটন `RunnerActiveErrands`-এ (ProviderDashboard.jsx)। ফোন-নাম্বার reveal দুই দিকেই কাজ করে — student সাইডে `getProviderPhone(acceptedByRunnerUid)` কল করে (errand doc-এ phone ফিল্ড নেই বলে), provider সাইডে সরাসরি request doc-এর `requesterPhone` ফিল্ড থেকে
    - **বাগ-ফিক্স নোট (এই পাসে ধরা পড়েছে):** প্রথম ড্রাফটে ভুলবশত `errand.acceptedByRunnerPhone` নামে একটা নন-এক্সিস্টেন্ট ফিল্ড রেফারেন্স করা হয়েছিল — errand doc-এ আসলে কোনো Runner-phone ফিল্ড নেই, শুধু `acceptedByRunnerUid`। ঠিক করা হয়েছে: এখন `providers/{uid}/contact/phone`-এ আলাদা `getProviderPhone(uid)` কল হয়, `hasConfirmedBookingWithProvider` rule দিয়ে গেটেড (booking-mode-এও একই rule ব্যবহার হয়)
  - [x] Phase 4.5 — Ongoing → Finished flow + history (ব্যাকএন্ড + UI) — **সম্পন্ন**
    - ব্যাকএন্ড (আগে থেকেই ছিল): `finishErrandRequest()` (কোনো revenue-write নেই, cash অফলাইনে হাতবদল হয়); Firestore rules-এ confirmed→finished transition (requester বা Runner, উভয়েই মার্ক করতে পারবে)
    - **UI (নতুন সম্পন্ন):** `RunnerActiveErrands`-এ "সম্পন্ন হয়েছে বলে মার্ক করুন" বাটন (provider সাইড, শুধু confirmed status-এ দেখায়), `MyActiveErrand`-এ একই বাটন (student/faculty সাইড)

  **নতুন স্ট্রিং-ফাইল আপডেট:** `src/lib/providerStrings.js`-এ `dashboard.errand.*` namespace-এ নতুন key যোগ হয়েছে (bn + en দুই ব্লকেই), existing `dashboard.<section>.<key>` naming convention মেনে।

  - [x] **Targeted-visibility Runner-picker dropdown — সম্পন্ন (Phase 4.2 এর বাকি অংশ)**
    - `src/pages/ServiceDetail.jsx`-এর `ErrandForm`-এ নতুন broadcast/targeted টগল (দুইটা বাটন) + targeted হলে `<select>` dropdown যোগ হয়েছে। Runner-লিস্ট আসে `subscribeAllServices()` থেকে, ক্লায়েন্ট-সাইডে ফিল্টার করা হয় `type === 'errand' && isOpen && providerUid !== (এই পেজের নিজের Runner)` — নিজের Runner-কে টার্গেট করা redundant বলে বাদ দেওয়া হয়েছে (plain broadcast/submit-ই তাকে reach করে)। কোনো অন্য Runner না থাকলে টগল-UI সম্পূর্ণ hide থাকে (কোনো dead-end dropdown দেখানো হয় না)। dropdown-এর value হিসেবে Runner-এর `providerUid` ব্যবহার হয় — `createErrandRequest`/`acceptErrandRequest`/rules সব জায়গায় এই একই uid-কে `targetRunnerUid` হিসেবে ধরা হয়, তাই ম্যাচ করে।
    - ব্যাকএন্ড/rules-এ কোনো পরিবর্তন লাগেনি — `createErrandRequest` আগে থেকেই `visibility`/`targetRunnerUid` প্যারামিটার নিত (ডিফল্ট শুধু hardcoded 'broadcast' পাঠানো হচ্ছিল, এখন ফর্ম-স্টেট থেকে dynamic ভ্যালু যায়)।

  **এখনো বাকি:**
  - Firestore rules বাস্তবে deploy করে টেস্ট করা — এই কাজের এনভায়রনমেন্টে নেটওয়ার্ক অ্যাক্সেস (Firebase CLI/deploy) নেই বলে সম্ভব হয়নি, শুধু static brace/paren balance + esbuild দিয়ে সব বদলানো `.jsx`/`.js` ফাইলের syntax validate করা হয়েছে। ডেভেলপার নিজে `firebase deploy --only firestore:rules` চালিয়ে verify করবে

---

## Context

এখন `services/{serviceId}` ডকুমেন্টে শুধু একটা free-text ফিল্ড আছে —
`locationText` (যেমন: "KUET মেইন গেট সংলগ্ন")। কোনো real coordinate
(lat/lng) সংরক্ষিত হয় না, তাই Google Maps-এ সরাসরি পিন দেখানো যায় না।

চাওয়া হয়েছে: প্রোভাইডার একটা বাটনে ক্লিক করবে → ব্রাউজার নিজের GPS থেকে
তার বর্তমান লোকেশন নেবে → শর্ত থাকবে এটা তার **শপের আসল লোকেশন** হতে
হবে (ভুল জায়গা যেন সেভ না হয়) → দরকার হলে কনফার্মেশন নেওয়া হবে। এরপর
স্টুডেন্ট/ফ্যাকাল্টি সাইডে এই লোকেশনটা দেখানো হবে।

সাথে এটাও জানানো হয়েছে যে Home Delivery সিস্টেম এখনো পুরোপুরি তৈরি
হয়নি — সেটা নিয়ে কাজ চলছে। তাই Service Detail পেজে একটা সততাপূর্ণ
"প্রসেসে আছে" নোট দেখানো হবে, সাথে ভবিষ্যতে কী কী ফিচার আসতে পারে তার
একটা ছোট প্রিভিউ।

---

## Phase 1 — Provider সাইড: এক-ক্লিকে GPS লোকেশন + কনফার্মেশন

### Phase 1.1 — UI প্লেসমেন্ট + বাটন-ফ্লো

#### কোথায় বসবে (UI প্লেসমেন্ট)
`ProviderShopSettingsPage.jsx`-এর existing **"Location & delivery"** কার্ডের
ভেতরেই বসবে — আলাদা নতুন কার্ড খোলা হবে না। কারণ:
- Location ইতিমধ্যে ওই কার্ডের বিষয়বস্তু (`locationText` ফিল্ড এখানেই)।
- একই বিষয়ের দুইটা আলাদা জায়গায় ছড়িয়ে থাকলে প্রোভাইডারের জন্য
  confusing হয়ে যায় ("লোকেশন কোথায় বসাবো, উপরের কার্ডে না নিচের
  কার্ডে?")।
- Text-ফিল্ড (মানুষ যেটা পড়ে বুঝবে, যেমন "KUET মেইন গেট সংলগ্ন") এবং
  GPS coordinate (মানচিত্রে সঠিক পিন) — দুটোই আসলে "শপ কোথায়" এই একই
  প্রশ্নের উত্তর, তাই একসাথে একই কার্ডে থাকাই স্বাভাবিক ও পরিষ্কার।

তাই existing `ShopMetaEditor`-এ `locationText` ইনপুটের ঠিক নিচে একটা
নতুন ছোট সাব-সেকশন যোগ হবে — "সঠিক লোকেশন (GPS)"।

#### ফ্লো — ধাপে ধাপে

```
[Location & delivery কার্ড]
  locationText ইনপুট (আগের মতোই, অপরিবর্তিত)

  ── নতুন সাব-সেকশন ──
  যদি coordinate সেভ করা না থাকে:
    "📍 সঠিক শপ-লোকেশন এখনো যোগ করা হয়নি"
    [বাটন: "বর্তমান লোকেশন থেকে যোগ করুন"]

  যদি coordinate আগে থেকেই সেভ করা থাকে:
    "📍 লোকেশন সেভ করা আছে ✓ (শেষ আপডেট: ৩ দিন আগে)"
    [ছোট লিংক: "Google Maps-এ দেখুন"]  [বাটন: "আপডেট করুন"]
```

বাটনে ক্লিক করলে:

1. ব্রাউজারের `navigator.geolocation.getCurrentPosition()` কল হবে।
   এটা সম্পূর্ণ ফ্রি, কোনো Google Maps API key লাগে না — browser নিজে
   device-এর GPS/network থেকে coordinate দেয়।
2. ব্রাউজার নিজে থেকেই একটা permission popup দেখাবে ("এই সাইটকে আপনার
   লোকেশন জানতে দেবেন?") — এটা browser-level, আমাদের বানাতে হবে না।
3. Permission দিলে coordinate (lat, lng) + **accuracy** (মিটারে, কত
   নিশ্চিতভাবে সঠিক) পাওয়া যাবে।
4. **Accuracy-ভিত্তিক সতর্কতা** (শর্ত মানার সবচেয়ে বাস্তব উপায়):
   - accuracy ভালো হলে (≈ ৫০ মিটারের কম) → সরাসরি কনফার্মেশন ধাপে যাবে।
   - accuracy খারাপ হলে (৫০ মিটারের বেশি — সাধারণত indoor/দুর্বল
     GPS-এ হয়) → "লোকেশন সঠিকভাবে শনাক্ত করা যায়নি, একটু খোলা জায়গায়
     গিয়ে আবার চেষ্টা করুন" এই বার্তা দেখিয়ে আবার চেষ্টা করতে বলা হবে।
     (সম্পূর্ণ block না করে — accuracy একটু খারাপ হলেও তখনো এগোনোর
     অপশন থাকবে, কিন্তু warning সহ, যাতে ভুল করে খুব বাজে
     coordinate সেভ না হয়ে যায়)
5. **কনফার্মেশন ধাপ** (তোমার চাওয়া অনুযায়ী "শর্ত থাকতে হবে" এবং "ভুল
   জায়গায় না থাকে" এই দুইটার সবচেয়ে বাস্তবসম্মত সমাধান — কারণ
   ব্রাউজার technically ১০০% প্রমাণ করতে পারে না ইউজার সত্যিই শপে আছে
   কিনা, তাই মানুষের চোখে যাচাই করাটাই আসল সেফটি নেট):
   - coordinate পাওয়ার সাথে সাথে সেভ হবে না।
   - একটা preview দেখানো হবে (নিচে ব্যাখ্যা — "map preview" অংশ)।
   - সাথে স্পষ্ট লেখা থাকবে: **"নিশ্চিত করুন যে এই লোকেশনটাই আপনার
     শপের প্রকৃত অবস্থান"**।
   - দুইটা বাটন: **"✓ হ্যাঁ, এটাই সঠিক"** (তাহলেই Firestore-এ সেভ হবে) এবং
     **"✗ আবার চেষ্টা করুন"** (আগেরটা বাতিল, আবার থেকে শুরু)।

### Phase 1.2 — Map Preview

#### Map preview — কীভাবে দেখানো হবে (তোমার চূড়ান্ত সিদ্ধান্ত অনুযায়ী)

- **প্রধান/ডিফল্ট: টেক্সট ফলব্যাক** — coordinate-টা সরাসরি সংখ্যায়
  দেখানো হবে না (সেটা সাধারণ মানুষের কাছে অর্থহীন), বরং একটা
  **"Google Maps-এ দেখুন"** লিংক/বাটন দেখানো হবে যেটা নতুন ট্যাবে
  আসল Google Maps খুলবে (URL ফরম্যাট: `google.com/maps?q=lat,lng`) —
  এখানে কোনো API key লাগবে না, সম্পূর্ণ ফ্রি এবং কাজ করবেই করবে।
  কনফার্ম করার আগে প্রোভাইডার এই লিংকে ক্লিক করে নিজে থেকে Google
  Maps-এ গিয়ে verify করে নিতে পারবে যে পিনটা ঠিক জায়গায় পড়েছে
  কিনা, তারপর ফিরে এসে "✓ হ্যাঁ, এটাই সঠিক" চাপবে।
- **Bonus/optional layer**: যদি ভবিষ্যতে Google Maps Embed API key
  সেটআপ করা থাকে (এখন নেই, ভবিষ্যতে চাইলে যোগ করা যায়), তখন এই একই
  জায়গায় একটা ছোট ইনলাইন visual map (৩০০×১৫০px মতো) সরাসরি এখানেই
  বসিয়ে দেওয়া যাবে — কোড এমনভাবে লেখা হবে যাতে key না থাকলে
  স্বয়ংক্রিয়ভাবে লিংক-ফলব্যাকে চলে যায়, key যোগ হলে automatically
  visual map চালু হয়ে যায়। এটা "nice to have", Phase 1-এর জন্য
  বাধ্যতামূলক না — যেটা এখন আছে (ফ্রি টেক্সট+লিংক) সেটাই মূল সমাধান
  হিসেবে থাকবে।

এইভাবে ইউজারের জন্য এটাই সবচেয়ে সহজ ও নির্ভরযোগ্য — কোনো key
setup/billing configure করার দরকার নেই, কাজ শুরু করতে কোনো বাধা নেই,
অথচ ভবিষ্যতে visual map upgrade করার দরজা খোলা থাকছে।

### Phase 1.3 — ডেটা মডেল + Firestore Rules

#### ডেটা মডেল

`services/{serviceId}` ডকুমেন্টে নতুন ফিল্ড:
```
locationLat: number | null
locationLng: number | null
locationAccuracy: number | null   (মিটারে, GPS থেকে পাওয়া accuracy — শুধু তথ্যের জন্য, ভবিষ্যতে "কতটা নির্ভরযোগ্য" বোঝাতে কাজে লাগবে)
locationSetAt: timestamp | null
```
`locationText` (বিদ্যমান free-text) অপরিবর্তিত থাকবে — coordinate এটার
পরিপূরক, প্রতিস্থাপক না। একটা প্রোভাইডার চাইলে শুধু text দিয়ে রাখতে
পারবে (GPS optional), অথবা দুটোই দিতে পারবে।

#### Firestore rules
`services/{serviceId}`-এর existing "provider নিজের সার্ভিস আপডেট করতে
পারে" rule-এর মধ্যেই এই তিনটা নতুন ফিল্ড লেখার অনুমতি যোগ হবে (নতুন কোনো
আলাদা rule দরকার নেই, existing owner-check rule-ই যথেষ্ট) — শুধু
validation যোগ হবে: `locationLat`/`locationLng` যদি লেখা হয় তাহলে সংখ্যা
হতে হবে এবং বাংলাদেশের বাস্তবসম্মত সীমার মধ্যে থাকতে হবে (মোটামুটি
lat ২০-২৭, lng ৮৮-৯৩ — অস্বাভাবিক/ভুল coordinate ভুলবশত সেভ হওয়া
আটকাতে)।

---

## Phase 2 — Student/Faculty সাইড: লোকেশন কীভাবে দেখানো হবে

এখন `ServiceDetail.jsx`-এ একটা badge আছে যেখানে `locationText` দেখানো
হয় (📍 আইকন-সহ) — Services.jsx-এর grid কার্ডেও একই টেক্সট ছোট করে
দেখানো হয়। এই দুই জায়গাতেই coordinate থাকলে তার পাশে একটা ছোট,
আলাদা করে বোঝা যায় এমন uস্প্যাশন যোগ হবে:

- **`ServiceDetail.jsx`** (মূল ডিটেইল পেজ, যেখানে বেশি জায়গা আছে):
  বর্তমান 📍 locationText badge-এর পাশেই বা ঠিক নিচে একটা ছোট বাটন/লিংক
  **"মানচিত্রে দেখুন"** — ক্লিক করলে নতুন ট্যাবে Google Maps খুলে যাবে,
  সরাসরি ওই coordinate-এর পিন-সহ। এটা student এবং faculty উভয়ের জন্যই
  কাজ করবে যেহেতু `ServiceDetail.jsx`/`Services.jsx` একটাই শেয়ার্ড পেজ,
  student-mode/faculty-mode আলাদা করে গেট করা নেই।
- **`Services.jsx`** (গ্রিড লিস্ট, ছোট কার্ড, জায়গা কম): এখানে নতুন
  কিছু যোগ না করাই ভালো — কার্ডটা ইতিমধ্যে ছোট, বাড়তি বাটন এলোমেলো
  লাগবে। coordinate থাকা/না-থাকা grid-view-তে অদৃশ্য থাকবে, ডিটেইল
  পেজে গেলেই দেখা যাবে — এটাই সবচেয়ে পরিষ্কার (clean), কারণ grid হলো
  "browse করা"-র জায়গা, "action নেওয়া"-র জায়গা না।
- Coordinate না থাকলে (প্রোভাইডার এখনো GPS যোগ করেনি) — শুধু আগের মতো
  `locationText` badge-ই থাকবে, নতুন কিছু দেখানো হবে না। কোনো ভাঙা
  লিংক বা "লোকেশন নেই" জাতীয় নেতিবাচক বার্তা দেখানো হবে না — না থাকলে
  চুপচাপ hide থাকবে, ঠিক এখন `locationText`-এর বেলায় যেমন হয়।

---

## Phase 3 — "হোম ডেলিভারি সিস্টেম প্রসেসে আছে" নোট + Upcoming Features প্রিভিউ

> **স্কিপ করা হয়েছে।** কারণ: Phase 4 (Delivery/Errand Runner) already
> ecosystem-এর real delivery-need solve করে দিচ্ছে (bidding-style
> Runner request/accept/confirm/finish flow, contact exchange, সব
> UI-সহ সম্পন্ন)। Phase 3-এর "হোম ডেলিভারি সিস্টেম উন্নয়নাধীন" ব্যানার
> ছিল normal shop-এর নিজস্ব delivery-র জন্য একটা placeholder-নোট মাত্র
> (কোনো real functionality না, শুধু "শীঘ্রই আসছে" টাইপ বার্তা) — যেহেতু
> Runner ফিচার দিয়েই delivery বাস্তবে কাজ করছে, তাই এই ডুপ্লিকেট/অকার্যকর
> "আসছে" নোটটা আর দরকার নেই। নিচের বিস্তারিত প্ল্যান রেফারেন্সের জন্য
> রাখা হলো, কিন্তু ইমপ্লিমেন্ট করা হবে না।

### কোথায় বসবে
`ServiceDetail.jsx`-এ existing "🚚 হোম ডেলিভারি আছে" badge-টার ঠিক নিচে
(যে সার্ভিসগুলোর `hasDelivery === true` শুধু সেগুলোতেই — কারণ যাদের
delivery-ই নেই তাদের কাছে delivery নিয়ে কোনো নোট দেখানোর মানে নেই,
এটা অপ্রাসঙ্গিক এবং বিভ্রান্তিকর হবে) একটা ছোট, নরম-সুরের তথ্যমূলক
ব্যানার:

> 🔧 **হোম ডেলিভারি সিস্টেম উন্নয়নাধীন** — এখন সরাসরি প্রোভাইডারের
> সাথে যোগাযোগ করে ডেলিভারি রিকোয়েস্ট করুন। শীঘ্রই আসছে: ডেলিভারি
> চার্জ ও সময় নির্ধারণ, লাইভ অর্ডার-স্ট্যাটাস ট্র্যাকিং, এবং আরও অনেক
> কিছু।

এটা honest এবং non-blocking — কোনো ফিচার আটকে রাখা হচ্ছে না, শুধু
প্রত্যাশা ঠিক রাখা হচ্ছে যে ব্যাকএন্ডে পুরো ডেলিভারি সিস্টেম এখনো হাতে
তৈরি (booking flow দিয়ে ম্যানেজ হচ্ছে), অটোমেটেড ট্র্যাকিং না।

### Upcoming Features — কী কী আসতে পারে (Foodpanda/Pathao Food থেকে অনুপ্রাণিত)

নিচের তালিকাটা শুধু পরিকল্পনার জন্য বিবেচনা — এখনই সব বানানো হচ্ছে না,
বরং ছোট আকারে (২-৩টা bullet) student/faculty-কে "কী আসছে" আভাস দেওয়া
হবে ওই ব্যানারের নিচে একটা ছোট, collapsible "আরও দেখুন" লিংকে:

1. **ডেলিভারি চার্জ ও সময়** — এখন শুধু "delivery আছে/নাই" টগল; ভবিষ্যতে
   delivery radius (কত km পর্যন্ত), fixed/free-above-amount চার্জ,
   আনুমানিক ডেলিভারি সময় (যেমন "৩০-৪৫ মিনিট")।
2. **অর্ডার স্ট্যাটাস ট্র্যাকিং** — Pathao Food-স্টাইলে ধাপে ধাপে:
   অর্ডার নেওয়া হয়েছে → প্রস্তুত হচ্ছে → ডেলিভারির জন্য বের হয়েছে →
   ডেলিভারি সম্পন্ন। এখন শুধু pending/confirmed/finished আছে,
   ডেলিভারি-নির্দিষ্ট ধাপ নেই।
3. **রেটিং ও রিভিউ** — বুকিং শেষ হওয়ার পর স্টুডেন্ট/ফ্যাকাল্টি
   প্রোভাইডারকে রেট করতে পারা, অন্যরা সেই রেটিং দেখে সিদ্ধান্ত নিতে
   পারা।
4. **মেনু/ক্যাটালগ ছবি-সহ** — এখন একটা সার্ভিসের একটাই কভার-ছবি;
   ভবিষ্যতে একাধিক আইটেম (যেমন খাবারের প্রতিটা পদ) আলাদা ছবি ও দাম-সহ
   দেখানো।
5. **শিডিউলড অর্ডার** — এখন সব বুকিং তাৎক্ষণিক; ভবিষ্যতে "কাল সকাল
   ৯টায় লাগবে" টাইপ আগে থেকে সময় ঠিক করে অর্ডার দেওয়া।
6. **পেমেন্ট অপশন** — এখন পেমেন্ট মেথড নির্দিষ্ট করে দেখানো হয় না;
   ভবিষ্যতে ক্যাশ-অন-ডেলিভারি বনাম অনলাইন পেমেন্ট বেছে নেওয়া।
7. **আগের অর্ডার আবার করা** — এক ক্লিকে পুরনো বুকিং রিপিট করা।

এই লিস্টটা কেবল "roadmap প্রিভিউ" হিসেবে থাকবে — কোনো ফাংশনালিটি না,
শুধু স্বচ্ছতা যে এই ফিচারগুলো নিয়ে কাজ চলছে/পরিকল্পনায় আছে।

---

## Cross-cutting নোট

- Phase 1-এ browser geolocation ব্যবহারের জন্য প্রোভাইডারকে HTTPS
  কানেকশনে থাকতে হবে (localhost-এ dev করা যাবে, কিন্তু production-এ
  অবশ্যই HTTPS লাগবে — Vercel deployment-এ এটা এমনিতেই থাকে, তাই এটা
  বাস্তবিক কোনো বাধা না)।
- যদি ইউজার browser permission popup-এ "Deny" চাপে, তাহলে একটা
  soft error message দেখানো হবে ("লোকেশন পারমিশন দেওয়া হয়নি — ব্রাউজার
  সেটিংস থেকে আবার চালু করতে পারেন") — কোনো crash/dead-end না।
- সব নতুন টেক্সট/লেবেল `t()` / `providerStrings.js` (provider সাইড)
  এবং সংশ্লিষ্ট student-facing স্ট্রিং কনভেনশন মেনে বাংলা-ডিফল্ট হবে,
  বিদ্যমান cross-cutting rule অনুযায়ী।
- Phase 3-এর ব্যানার এবং upcoming-features লিস্ট সম্পূর্ণ
  non-blocking/আলাদা — Phase 1/2 (GPS লোকেশন) না থাকলেও এটা independently
  করা যায়, একে অপরের উপর নির্ভরশীল না।

---

## Phase 4 — Delivery/Errand Runner (নতুন সার্ভিস-ক্যাটাগরি)

> **ইমপ্লিমেন্টেশন-প্রোগ্রেস নোট (সর্বশেষ আপডেট):** ব্যাকএন্ড
> (`src/lib/serviceSync.js`) এবং Firestore rules (`firestore.rules`)
> সম্পূর্ণ লেখা হয়ে গেছে — `errand` নামে একটা তৃতীয়
> `interactionMode` (booking/inquiry-এর পাশে) হিসেবে, existing
> `services/{serviceId}/bookings/{bookingId}` subcollection-ই reuse
> করে, ঠিক প্ল্যানের "zero নতুন architecture" সিদ্ধান্ত মেনে। UI অংশ
> (`ServiceDetail.jsx`-এ request ফর্ম + status view,
> `ProviderDashboard.jsx`-এ Runner-এর queue) এখনো বাকি — নিচের প্রতিটা
> সাব-ফেজে বিস্তারিত অবস্থা মার্ক করা আছে। কোড ফাইল:
> `kuetx-phase4-errand-runner-partial.zip` (আউটপুট হিসেবে আগেই দেওয়া
> হয়েছে)।

### Context / কী এবং কেন

এখন KUETx-এর সব সার্ভিস-ক্যাটাগরি (খাবার, স্টেশনারি, মেডিসিন) একটা
নির্দিষ্ট **শপ**-কেন্দ্রিক — প্রোভাইডার একটা শপ চালায়, স্টুডেন্ট সেই
শপ থেকে বুক করে। কিন্তু **"Delivery/Errand Runner"** ভিন্ন প্যাটার্নের —
এটা কোনো নির্দিষ্ট দোকানের সার্ভিস না, বরং "মানুষ পাঠিয়ে জিনিস
আনিয়ে নেওয়া"-র সার্ভিস। Runner নিজে কিছু বিক্রি করে না — ক্যাম্পাসের
ভেতরে/আশেপাশে জিনিস কিনে/সংগ্রহ করে পৌঁছে দেয় (medicine, স্টেশনারি,
খাবার — যেকোনো কিছু, KUETx-এর ভেতরের কোনো লিস্টেড শপ থেকে বা বাইরের
যেকোনো দোকান থেকে)।

**গুরুত্বপূর্ণ ডিজাইন-সিদ্ধান্ত:** এটা নতুন role/architecture না —
existing provider + booking সিস্টেমের উপরেই দাঁড়িয়ে থাকবে। Runner হলো
provider-এর একটা নতুন সাব-ক্যাটাগরি ("অন্যান্য"-র আন্ডারে), request
হলো booking-এরই একটা extended ভার্সন (দাম-সহ, bidding-style)। কোনো
নতুন Firestore collection, নতুন role, বা payment integration লাগবে না।

Student এবং Faculty — দুই role-ই এই সুবিধা ব্যবহার করতে পারবে,
role-ভিত্তিক কোনো ব্লক থাকবে না (booking system-এর মতোই
role-নিরপেক্ষ)।

### Phase 4.1 — Runner ক্যাটাগরি + Approval

- Provider-onboarding-এ existing category dropdown/list-এ নতুন এন্ট্রি:
  **"Delivery/Errand Runner"** ("অন্যান্য" ক্যাটাগরির সাব-ক্যাটাগরি
  হিসেবে)।
- **Approval: শুধুমাত্র Founder** করতে পারবে — Campus Lead-এর এই
  permission থাকবে না (অন্য সাধারণ শপ-প্রোভাইডার approval-এর থেকে এই
  একটা ক্ষেত্রে আলাদা রুল)। Existing approval-flow-এর মধ্যেই
  category-চেক করে এই বিশেষ নিয়মটা বসবে।
- একাধিক Runner থাকতে পারবে — প্রত্যেকে independent provider-profile
  হিসেবে লিস্টেড (নাম, GPS লোকেশন যদি Phase 1 করা থাকে, যোগাযোগের
  নম্বর, description — যেখানে Runner নিজের ডেলিভারি-ফি নীতি লিখে
  রাখতে পারবে, যেমন "হলের বাইরে ১০ টাকা, রুম পর্যন্ত ২০ টাকা" —
  এটা এখন structured ফিল্ড না, existing free-text ফিল্ডেই থাকবে)।

### Phase 4.2 — Errand Request তৈরি (Student/Faculty সাইড)

নতুন request ফর্ম (existing booking form-এর একটা variant/extension):

- জিনিসের বিবরণ (কী লাগবে, কোথা থেকে হলে ভালো হয় — free text)
- প্রস্তাবিত মূল্য (Student/Faculty নিজে অফার করবে — জিনিসের দাম +
  ডেলিভারি ফি মিলিয়ে একটা সংখ্যা, বা আলাদা আলাদা — UI বানানোর সময়
  ঠিক করা হবে)
- **Broadcast vs Targeted** টগল:
  - ডিফল্ট: **Broadcast** — সব active Runner request দেখতে পাবে
  - Optional: **Targeted** — dropdown থেকে নির্দিষ্ট একজন Runner বেছে
    শুধু তাকেই পাঠানো যাবে (আগে থেকে চেনা/পছন্দের Runner থাকলে)
- Submit করার পর status: **`open`**

### Phase 4.3 — Runner Accept + Re-surface-on-Edit

- Runner-এর ড্যাশবোর্ডে দেখাবে: সব `open` broadcast request + নিজের
  নামে আসা targeted request।
- **Negotiation window** (Accept হওয়ার আগ পর্যন্ত): Student/Faculty
  চাইলে প্রস্তাবিত দাম এডিট করতে পারবে (বাড়ানো/কমানো)। এডিট হলে
  request-এর `updatedAt` বদলে যাবে এবং এটা Runner-দের তালিকায়
  **re-surface** করবে (উপরে চলে আসবে, fresh হিসেবে দেখাবে) — যাতে
  কেউ পুরনো/stale request মিস না করে।
- যেকোনো Runner Accept করলে status হয়ে যাবে:
  **`runner_accepted` (awaiting student confirmation)**
- **এই মুহূর্তেই request অন্য সব Runner-এর তালিকা থেকে সরে যাবে
  (hide)** — আর কেউ Accept করতে পারবে না, negotiation বন্ধ।

### Phase 4.4 — 2-Step Confirmation + Contact Exchange

- Student/Faculty-র কাছে UI-তে দেখাবে: "একজন Runner এটা Accept
  করেছে, কনফার্ম করবেন?" — দুইটা বাটন:
  - **"✓ হ্যাঁ, কনফার্ম করছি"** → status: **`confirmed`**, এই
    মুহূর্তেই দুইজনের ফোন নম্বর একে অপরকে দেখানো হবে (contact
    exchange)।
  - **"✗ বাতিল করুন"** → status ফিরে যাবে **`open`**-এ, আবার সব
    Runner দেখতে পাবে (Accept করা Runner-টা বাদ পড়বে না প্রথম দফায়,
    কিন্তু re-broadcast হবে)।
- Accept-এর পর Student বেশিক্ষণ Confirm না করলে (future
  improvement, v1-এ না): auto-timeout দিয়ে আবার `open`-এ ফিরিয়ে
  দেওয়া যেতে পারে (যেমন ৩০ মিনিট) — **v1-এ এটা বাদ, manual cancel-ই
  যথেষ্ট**।

### Phase 4.5 — Ongoing → Finished + History

- `confirmed` হওয়ার পর request দুইজনের **"Active/Ongoing"** তালিকায়
  চলে যাবে, `open` broadcast লিস্ট থেকে সম্পূর্ণ সরে যাবে।
- Runner বাইরে গিয়ে জিনিস কিনে/সংগ্রহ করে পৌঁছে দেবে — যোগাযোগ
  ফোনে/সরাসরি (in-app chat v1-এ লাগবে না)।
- কাজ শেষে existing booking-status প্যাটার্ন অনুসরণ করে কেউ একজন
  (Runner বা Student/Faculty) **"সম্পন্ন"** মার্ক করবে → status:
  **`finished`** → উভয়ের history-তে move করবে।
- **পেমেন্ট: সম্পূর্ণ Cash-on-Delivery** — জিনিসের দাম + সম্মত ফি
  হাতে হাতে লেনদেন হবে। অ্যাপ কোনো পেমেন্ট প্রসেস করবে না, কোনো
  payment gateway লাগবে না — অ্যাপ শুধু request ও তার status ট্র্যাক
  করবে।

### Status flow (সংক্ষেপে)

```
open (broadcast/targeted)
   │
   ├─ [Student/Faculty এডিট করলে প্রাইস] → আবার open, re-surface (fresh)
   │
   └─ [কোনো Runner Accept করল] → runner_accepted (অন্য Runner-দের থেকে hide)
          │
          ├─ [Student/Faculty Confirm] → confirmed (contact exchange)
          │        │
          │        └─ [কাজ শেষ, কেউ mark করল] → finished (উভয়ের history)
          │
          └─ [Student/Faculty Cancel] → ফিরে open (আবার broadcast)
```

### ডেটা মডেল (খসড়া)

Existing `bookings`-এর প্যাটার্নের সাথে মিলিয়ে, নতুন কিছু ফিল্ড/একটা
variant subtype হিসেবে চিন্তা করা যায় (চূড়ান্ত কোডিং-এর সময় existing
booking schema দেখে ঠিক করা হবে — এখানে শুধু কনসেপ্ট):

```
errandRequests/{requestId}
  requesterId: string           (student/faculty uid)
  requesterRole: 'student' | 'faculty'
  itemDescription: string       (কী লাগবে)
  proposedPrice: number
  visibility: 'broadcast' | 'targeted'
  targetRunnerId: string | null (শুধু targeted হলে)
  status: 'open' | 'runner_accepted' | 'confirmed' | 'finished' | 'cancelled'
  acceptedByRunnerId: string | null
  createdAt: timestamp
  updatedAt: timestamp          (এডিট/re-surface ট্র্যাক করতে)
  confirmedAt: timestamp | null
  finishedAt: timestamp | null
```

### Firestore rules (খসড়া নোট)

- `open` status-এর request যেকোনো active Runner পড়তে পারবে
  (broadcast) বা শুধু `targetRunnerId === request.auth.uid` হলে
  পড়তে পারবে (targeted)।
- Accept করার write শুধুমাত্র তখনই valid হবে যখন
  `status == 'open'` (race-condition এড়াতে — দুইজন Runner একসাথে
  Accept করার চেষ্টা করলে যে আগে পৌঁছাবে সে-ই জিতবে, দ্বিতীয়জনের
  write reject হবে কারণ status ততক্ষণে বদলে গেছে)।
- Contact info (phone number) ফিল্ড শুধু `status == 'confirmed'`
  হওয়ার পর উভয় পক্ষকে দেখানো হবে (UI-level gate; ডেটা এমনিতে
  profile-এ থাকতেই পারে, শুধু কবে "reveal" করা হবে সেটা UI-লজিক)।

### Cross-cutting নোট (Phase 4)

- সব নতুন টেক্সট/লেবেল বাংলা-ডিফল্ট হবে, existing string-convention
  মেনে (`providerStrings.js` / student-facing string ফাইলে যোগ হবে)।
- Phase 4 সম্পূর্ণ independent — Phase 1/2/3 (GPS, delivery-note)
  আগে করা না থাকলেও শুরু করা যায়, তবে Runner-প্রোফাইলে GPS লোকেশন
  থাকলে ভবিষ্যতে "কাছের Runner" ফিচার সহজে যোগ করা যাবে (future,
  v1-এ না)।
- Future-এ যোগ হতে পারে (v1-এ না): structured delivery-fee field
  (জোন সিলেক্ট করলে auto-calculate), ডেলিভারি-নির্দিষ্ট
  status-ধাপ (কেনা হচ্ছে → পথে আছে → পৌঁছে গেছে), nearest-Runner
  auto-suggest, in-app chat, online payment, auto-timeout on
  unconfirmed accepts।

---

## NEXT STEP (এখান থেকে শুরু করতে হবে)

> Phase 4 (Delivery/Errand Runner, targeted-picker dropdown-সহ), Phase 1
> (Provider GPS লোকেশন), এবং Phase 2 (Student/Faculty সাইডে coordinate
> দেখানো) — সবগুলো সম্পূর্ণ সম্পন্ন। Phase 3 ইচ্ছাকৃতভাবে স্কিপড (উপরে
> দেখুন কারণ)।
>
> **বাকি আছে শুধু একটাই আইটেম:**
> - **Firestore rules deploy/live-test** — dev নিজে
>   `firebase deploy --only firestore:rules` চালিয়ে verify করবে (এই
>   এনভায়রনমেন্টে নেটওয়ার্ক অ্যাক্সেস/Firebase CLI নেই বলে সম্ভব হয়নি)।
>   Deploy করার পর অন্তত এই কেসগুলো ম্যানুয়ালি টেস্ট করে দেখা ভালো:
>   - Provider GPS সেভ (Phase 1.3-এর lat/lng রেঞ্জ-চেক ভুল কোঅর্ডিনেট
>     আটকায় কিনা)
>   - Broadcast errand request অন্য verified Runner-রা দেখতে পাচ্ছে কিনা
>   - Targeted errand request শুধু বেছে নেওয়া Runner-ই দেখতে পাচ্ছে
>     কিনা, অন্যরা না
>
> এই মুহূর্তে কোনো নতুন ফিচার-কাজ বাকি নেই — এই একটা deploy/verify
> ধাপই বাকি প্রোডাকশনে যাওয়ার আগে।
