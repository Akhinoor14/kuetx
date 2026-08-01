# KUETx — Services / Provider marketplace (Salon first) — approved plan

## এই ডকুমেন্ট কীভাবে ব্যবহার করবে
এটা একটা সম্পূর্ণ, আলোচনা করে চূড়ান্ত করা প্ল্যান — KUETx-এ নতুন "Services" ফিচার যোগ করার জন্য।
Salon প্রথম service, কিন্তু আর্কিটেকচার generic — ভবিষ্যতে medicine shop ইত্যাদি একই কাঠামোতে
যোগ হবে। কোনো নতুন Claude session/bot-কে এই পুরো ফাইলটা দিলেই ও পুরো context, সব সিদ্ধান্ত, এবং
কেন সেই সিদ্ধান্ত নেওয়া হয়েছে তা বুঝে যাবে। এটা KUETx repo-এর existing কোড প্যাটার্ন
(faculty/{uid}, useIsFaculty, RequireFaculty ইত্যাদি) অনুসরণ করে ডিজাইন করা — নতুন কোনো
আলাদা auth সিস্টেম বা ভিন্ন কাঠামো বানানো হচ্ছে না।

---

## ১. Product concept

- Campus Life sidebar-এ নতুন কার্ড: **"Services"**
- Student ক্লিক করলে available service list দেখবে (এখন শুধু salon, ভবিষ্যতে medicine shop ইত্যাদি)
- Login সবার জন্য একই জায়গা (student/faculty/provider) — শুধু signup ফর্ম আলাদা, role অনুযায়ী
- Service provider (salon owner) নিজে সাইন-আপ করবে, পুরো detail ফর্ম পূরণ করবে, তারপর Founder
  manually verify করবে (Founder-এর নাম্বার: 01724812042 — সরাসরি যোগাযোগ করে verify হবে)
- Verify হওয়ার আগ পর্যন্ত login করলে শুধু "Verification pending" স্ক্রিন দেখাবে, dashboard কিছুই
  দেখাবে না
- Verify হওয়ার পর provider dashboard-এ: pending bookings queue, open/closed toggle, offerings
  on/off, auto revenue tracker

---

## ২. Data model (Firestore) — future multi-service ready

প্রতিটা role-এর (student profile, faculty, admin) নিজের top-level collection আছে existing
কোডে — provider-এর জন্যও একই প্যাটার্নে আলাদা, সুসংগঠিত collection, কোনো role মিশে যাবে না।

```
providers/{uid}                          ← faculty/{uid}-এর একদম একই প্যাটার্নে top-level
  status: 'pending' | 'verified' | 'rejected' | 'deactivated'   ← শুধু verifiedAt না, explicit status
  verifiedAt: timestamp | null
  rejectedReason: string | null           ← reject হলে কারণ, provider আবার re-submit করতে পারবে
  displayName, phone, requestedAt
  serviceType: 'salon' | ...              ← ভবিষ্যতে নতুন category
  serviceIds: [serviceId]                 ← কাঠামো বহু-service ready, এখন একটাই থাকবে

services/{serviceId}
  type: 'salon' | 'medicine' | ...
  providerUid
  name, description, priceNote            ← student-facing: title → price → description (এই অর্ডারে)
  isOpen: boolean                         ← সবচেয়ে গুরুত্বপূর্ণ status, সবার আগে দেখাবে
  offerings: [ { id, label, isAvailable } ]
  revenueTotal: number                    ← শুধু 'done' booking থেকে auto যোগ হবে

services/{serviceId}/bookings/{bookingId}
  studentUid, studentName, studentPhone
  offeringId
  preferredTime: { date, time } | null     ← structured picker, free text না (Gap 9 ফিক্স)
  requestedAt: timestamp                   ← queue order (oldest first)
  status: 'pending' | 'confirmed' | 'done' | 'cancelled' | 'expired_shop_closed'
  cancelledBy: 'student' | 'owner' | null
  confirmedSlot: { date, time } | null
```

---

## ৩. Login/Signup আর্কিটেকচার

- Login পেজ **একটাই**, সবার জন্য (student, faculty, provider)।
- Signup **আলাদা ফর্ম** — role-select-এর ভেতর নতুন অপশন "Service Provider হিসেবে যোগ দিন",
  Services কার্ড থেকে ট্রিগার হবে।
- `useIsProvider()` hook — `useIsFaculty()`-এর কোড কাঠামো হুবহু কপি করে বানানো (cache pattern,
  `providers/{uid}.status` চেক করা hard gate)।
- Sign-in করার পর role অনুযায়ী route।

---

## ৪. Provider verification flow

1. Services কার্ড → Provider signup → পূর্ণ detail ফর্ম → submit
2. `providers/{uid}.status = 'pending'` হয়ে যায়
3. Login করলে (verify না হওয়া পর্যন্ত) শুধু "Verification pending" স্ক্রিন — কোনো dashboard content
   না, বাংলায় সহজ instruction + Founder-এর নাম্বার (01724812042) যোগাযোগের জন্য
4. Founder সরাসরি যোগাযোগ করে verify করবে (bulk UI দরকার নেই এখন, manual)
5. Verify হলে → dashboard আনলক
6. Reject হলে → `status: 'rejected'` + `rejectedReason` দেখাবে, provider আবার re-submit করতে
   পারবে (একই uid দিয়ে, নতুন request তৈরি হবে)

---

## ৫. Provider dashboard (verify হওয়ার পর)

1. **Pending bookings queue** — লগইন করলেই প্রথম স্ক্রিন, oldest first (`requestedAt` অনুযায়ী),
   প্রতিটার পাশে Confirm বাটন + slot assign ফর্ম। যদি student preferred time দিয়ে থাকে সেটা
   highlighted দেখাবে।
2. **Open/Closed toggle** — সবচেয়ে গুরুত্বপূর্ণ, বড় সাইজে, এক ক্লিকে
3. **Offerings management** — কী কী সুবিধা আছে, প্রতিটা on/off — off থাকলে নতুন booking আটকাবে
   (কিন্তু আগে থেকে থাকা pending/confirmed booking অক্ষত থাকবে — Gap 4 ফিক্স)
4. **Revenue tracker** — শুধু `done` status-এর booking থেকে auto যোগ হবে

Mobile-first UI: owner মূলত মোবাইল ইউজার, তাই বড় টাচ-friendly কার্ড, কম scroll, বড় টগল।

---

## ৬. Student-side flow

- Services লিস্টে **open/closed status সবচেয়ে বড় করে** দেখাবে, তারপর queue-তে কতজন আছে (simple
  সংখ্যা)
- ক্লিক করলে detail page: **title → price → description** (এই অর্ডারে)
- বুকিং দেওয়ার সময় preferred time **optional**, কিন্তু **structured (date+time picker)**, free
  text না (Gap 9)
- Preferred time দিলে owner-এর queue-তে highlighted দেখাবে; owner চাইলে সেই সময় দিতে পারবে,
  না চাইলে অন্য slot অফার করবে

---

## ৭. Booking state machine (চূড়ান্ত, সব gap ফিক্স সহ)

```
pending
  → student cancel করলে → cancelled (cancelledBy: student, revenue যোগ হবে না)
  → owner confirm করলে → confirmed
  → shop হুট করে বন্ধ হলে → expired_shop_closed (Gap 3, student-কে জানানো হবে, আবার বুক করতে হবে)

confirmed
  → student cancel করলে → cancelled (cancelledBy: student) + owner-কে alert
  → owner cancel করলে (no-show ইত্যাদি) → cancelled (cancelledBy: owner) + student-কে alert
  → owner "Finish" চাপলে → done (revenue যোগ হবে)

done / cancelled / expired_shop_closed = terminal states, আর কোনো transition নেই
```

**মূলনীতি:** Cancel করলে নতুন approval লাগবে না (সরাসরি cancelled), কিন্তু document মুছে ফেলা হবে
না — status change হবে, history/analytics-এর জন্য থেকে যাবে। আবার prebook করলে সেটা সম্পূর্ণ নতুন
booking document (নতুন `requestedAt`, queue order ঠিক থাকার জন্য)।

---

## ৮. সমস্ত চিহ্নিত gap (৯টা) এবং তাদের ফিক্স

| # | Gap | Fix |
|---|-----|-----|
| ১ | Booking confirmed অবস্থাতেও cancel করার উপায় ছিল না | confirmed-এও student cancel করতে পারবে, owner-কে alert যাবে |
| ২ | Cancel করার পর booking history-এর জায়গা অস্পষ্ট ছিল | status change হবে (soft), document delete হবে না; পুনরায় বুক করলে নতুন doc |
| ৩ | Confirmed booking-এ student no-show হলে চিরকাল ঝুলে থাকতো | owner-সাইড থেকেও cancel অপশন (no-show হিসেবে) |
| ৪ | Shop হুট করে বন্ধ হলে pending queue-এর কী হয় অস্পষ্ট ছিল | isOpen false হলে বাকি pending auto `expired_shop_closed`, student-কে জানানো হবে |
| ৫ | Offering off করলে তার আগের booking-এর কী হয় অস্পষ্ট ছিল | off শুধু নতুন booking আটকাবে, পুরনো pending/confirmed অক্ষত থাকবে |
| ৬ | Founder verify না করলে বা explicit reject-এর পথ ছিল না | `status: 'pending'/'verified'/'rejected'`, reject হলে কারণসহ, re-submit সম্ভব |
| ৭ | Student একসাথে একাধিক active booking রাখতে পারতো (এক service-এ) | একই service-এ ১টা active (pending+confirmed) booking-এর সীমা enforce করা হবে |
| ৮ | Owner ডাবল-ক্লিকে বা রেসে দুইবার confirm করে ফেলতে পারতো | Confirm লেখার আগে status এখনো 'pending' কিনা চেক করে লিখবে (Firestore transaction/rule দিয়ে) |
| ৯ | Provider একাউন্ট বন্ধ/deactivate করার পথ ছিল না | `status: 'deactivated'` — isOpen force false, student লিস্ট থেকে সরে যাবে, history থাকবে |
| ১০ | Preferred time free text ছিল, owner-এর জন্য বোঝা কঠিন হতো | Structured date+time picker field, free text না |

---

## ৯. Notification/Alert

- Booking confirm হলে student-কে notice bell/panel-এ alert (existing `alertUtils.js`
  pattern-এ নতুন alert group, `NotificationPanel.jsx`-এর bell dropdown-এ দেখাবে — আগের
  role-aware bell fix-এর কাঠামোর সাথেই fit করবে)
- Confirmed booking cancel হলে (যেই পক্ষই করুক) অপরপক্ষকে alert
- Shop বন্ধ হয়ে booking `expired_shop_closed` হলে student-কে alert

---

## ১০. Privacy / Firestore rules

- Owner-এর ফোন নাম্বার **শুধু** `status == 'confirmed'` (বা পরবর্তী) হলে সংশ্লিষ্ট student read
  করতে পারবে
- Student-রা একে অপরের booking document দেখতে পারবে না
- Booking-এর `status` client থেকে সরাসরি arbitrary ভ্যালুতে সেট করা যাবে না — rules দিয়ে valid
  transition-ই (উপরের state machine অনুযায়ী) allow করা হবে

---

## ১১. এখনও যা confirm করা হয়নি (পরবর্তী আলোচনার জন্য প্রশ্ন হিসেবে রাখা)

- একই student বার বার cancel করলে (habitual no-show) কোনো penalty/flag থাকবে কিনা
- Owner একই স্লট একাধিক student-কে ভুলবশত confirm করে ফেললে (double-booking on owner's own
  slot management, আলাদা students বিভিন্ন offering-এ) কীভাবে সতর্ক করা হবে
- Revenue tracker-এ breakdown (daily/weekly, per-offering) দরকার কিনা এখনই, নাকি শুধু total
