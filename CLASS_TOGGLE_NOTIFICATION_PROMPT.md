# KUETx — Class On/Off Toggle (Routine পেজ) + Telegram/SMS Notification (Blaze-ready)

## Progress

- [x] **Phase 1** — Data model + `isClassOff()`/`getClassOffReason()` (`store.js`) — ✅ সম্পন্ন, gap-fix সহ (`recurringOff` মডেল + precedence: dayOff > per-date 'on' > per-date 'off' > recurringOff > default-on)
- [x] **Phase 1b** — `groupSync.js`: `setSlotOverride(mode: 'off'|'on'|'clear')`, `setDayOverride`, `setRecurringOff`, `clearRecurringOff` — ✅ সম্পন্ন
- [x] **Phase 2** — `/class-routine`-এ toggle UI: draft/confirm প্যাটার্নে rewrite করা হয়েছে (auto-guess বাদ, explicit date picker + single-vs-recurring মোড selector) — ✅ মূলত সম্পন্ন, ⚠️ **একটা known bug আছে নিচে দেখো**
- [ ] **Phase 3** — `todayItems.js` ও `Attendance.jsx`-এ `isClassOff()` plug-in — ✅ কল করা আছে, কিন্তু **group data local store-এ mirror হয় না** (নিচে দেখো) — তাই group mode-এ আসলে কাজ করবে না এখনো
- [ ] **Phase 4** — Notice-write hook — ✅ কোডে বসানো আছে (`postGroupNotice` reuse, প্রতিটা toggle action-এ), টেস্ট করা হয়নি
- [ ] **Phase 5** — `TODO(Blaze)` কমেন্ট + `channelHints` field + `docs/NOTIFICATION_ARCHITECTURE.md` — ❌ শুরুই হয়নি

### এখন পর্যন্ত যা কোডে আছে

- `src/store/store.js`: `classOverrideSlotKey()`, `isClassOff()`, `getClassOffReason()`, `isSlotRecurringOff()`, `getNextDateForWeekday()` (শুধু date-picker-এর default suggestion হিসেবে ব্যবহৃত, আর কোথাও silent commit করে না)
- `src/lib/groupSync.js`: `setSlotOverride()`, `setDayOverride()`, `setRecurringOff()`, `clearRecurringOff()` — সবগুলো `plannerSettings.scheduleFields` doc-এ merge-write করে (`holidayDates`-এর মতোই প্যাটার্ন)
- `src/pages/useClassManagementState.js`: `overrideDraft` state + `openSlotOverrideDraft`/`openDayOverrideDraft`/`updateOverrideDraft`/`cancelOverrideDraft`/`confirmOverrideDraft` — draft ছাড়া কিছুই write হয় না, শুধু Confirm চাপলে write হয়
- `src/pages/ClassRoutine.jsx`: card-এ toggle বাটন + `OverrideConfirmPanel` কম্পোনেন্ট (date picker + mode selector + reason input + Confirm/বাতিল)
- `src/lib/todayItems.js`, `src/pages/Attendance.jsx`: `isClassOff()` কল বসানো আছে filter হিসেবে

### ⚠️ পরের সেশনের জন্য জরুরি — দুটো অসমাপ্ত/known-buggy জায়গা

**Bug ১ (confirmed, fix করা হয়নি):** `confirmOverrideDraft()`-এর slot "turn back on" পাথে (`useClassManagementState.js`, `else if (isSlotOff(entry, date))` ব্লক) — যদি slot **recurring off**-এর কারণে off দেখাচ্ছিল (per-date override না থাকা সত্ত্বেও), তাহলে `setSlotOverride({mode: 'clear'})` কল করাটা ভুল — এটা একটা non-existent per-date entry clear করবে, recurring suspension তখনও বহাল থাকবে, ক্লাস তখনও off-ই দেখাবে। এখানে distinguish করতে হবে: date-এর জন্য per-date override entry directly আছে কিনা (তাহলে `clear`), নাকি off asli recurring থেকে আসছে (তাহলে `mode: 'on'` — explicit per-date exception বসাতে হবে, recurring না ছুঁয়ে)।

**Gap ২ (design-level, code এখনো লেখা হয়নি):** group mode-এ `scheduleSettings.classOverrides`/`recurringOff` আসলে `plannerSettings.scheduleFields`-এ থাকে (Firestore), কিন্তু `todayItems.js` ও `Attendance.jsx` সরাসরি `store.get('scheduleSettings')` থেকে পড়ে — এই দুটো plain function module, React hook ব্যবহার করতে পারে না, তাই group-এর data local `store`-এ আগে থেকে mirror করা না থাকলে ওরা কিছুই দেখবে না। App.jsx-এ ইতিমধ্যে ঠিক এই প্যাটার্নের উদাহরণ আছে (`subscribeGroupTermStartDate`/`subscribeGroupCurrentTermKey` — boot-time এ group value local profile store-এ copy করে)। **এখনো লেখা হয়নি:** ঠিক এরকম একটা effect `App.jsx`-এ বসাতে হবে যেটা `plannerSettings.scheduleFields` subscribe করে local `store.set('scheduleSettings', merged)` করবে — নাহলে Phase 3 আসলে group member-দের জন্য কাজই করবে না (personal/non-group mode-এ যদিও ঠিকই কাজ করবে, কারণ সেখানে সরাসরি local store-ই ব্যবহৃত হয়)। এটাই পরের সেশনের **প্রথম কাজ** হওয়া উচিত, কারণ এটা ছাড়া বাকি সব feature silently broken থাকবে group mode-এ (যেটাই মূল ব্যবহারযোগ্য মোড, যেহেতু পুরো ক্লাস share করে)।

### পরের ধাপ (ক্রম অনুযায়ী)

1. **App.jsx মিরর ফিক্স** (উপরের Gap ২) — group-এর `scheduleFields` local `scheduleSettings`-এ subscribe/mirror করা।
2. **Bug ১ ফিক্স** — recurring-off vs per-date-off আলাদা করে "turn back on" লজিক ঠিক করা।
3. একবার এই দুইটা ঠিক হলে, পুরো flow ম্যানুয়ালি ট্রেস করে দেখা (CR toggle করলে Today/Attendance-এ সত্যিই off দেখায় কিনা)।
4. **Phase 5** — `TODO(Blaze)` কমেন্ট, `channelHints` field, `docs/NOTIFICATION_ARCHITECTURE.md`।
5. পুরো zip build/syntax-check করে final delivery।

এই prompt-টা `/class-routine` (Class Rep পেজ) থেকে CR/ACR-এর জন্য একটা
toggle যোগ করার জন্য, যেটা দিয়ে **নির্দিষ্ট একটা class (slot-level)** অথবা
**পুরো একটা দিনের সব class (day-level)** "হবে না" (off) মার্ক করা যাবে —
এবং সেই change app-এর সব জায়গায় (Today page, Attendance Daily Log,
Routine পেজ নিজে) সাথে সাথে reflect করবে। সাথে একটা notification hook
তৈরি করা, যেটা এখনই কাজ করবে (Telegram, যেহেতু bot ইতিমধ্যে আছে) এবং
ভবিষ্যতে Blaze চালু হলে SMS layer শুধু plug-in করলেই চলে যাবে — এখনই
architecture এমনভাবে সাজানো, যাতে পরে গিয়ে ভুলে না যাই বা re-architect
করতে না হয়।

---

## Context (স্ক্রিনশট থেকে কনফার্ম করা)

`/class-routine` পেজ (sidebar-এ "Class Rep") CR/ACR-only একটা পেজ, যেখানে:

- উপরে Days/Classes/Teachers-এর summary কার্ড আছে।
- নিচে দিনভিত্তিক tab (Sun/Mon/Tue/Wed/Thu) — প্রতিটা দিনের class card
  list (সময়, কোর্স কোড, শিক্ষকের নাম, রুম, Theory/Sessional ব্যাজ)।

এই পেজটাই ইতিমধ্যে CR/ACR-only route হওয়ায় (Class Rep sidebar আইটেম),
আলাদা করে permission-check যোগ করার দরকার নেই — শুধু existing route-guard
অনুসরণ করলেই হবে।

---

## 1. Data model: `scheduleSettings.classOverrides` + `scheduleSettings.recurringOff`

**⚠️ Design note (post-review fix):** প্রাথমিক ডিজাইনে toggle-এর dateKey
weekday ট্যাব থেকে "next occurrence" auto-guess করে বসানো হতো — এতে তিনটা
gap ছিল: (ক) CR "এই সপ্তাহ" নাকি "পরের সপ্তাহ" বোঝাচ্ছে তা অস্পষ্ট ছিল,
(খ) CR আজকের weekday ট্যাবে থাকলে "আজকের জন্য" নাকি "পরের সপ্তাহের জন্য"
সেটাও অস্পষ্ট ছিল, (গ) সবচেয়ে বড় গ্যাপ — "শুধু এই একদিন বন্ধ" vs "এখন
থেকে প্রতি সপ্তাহে বন্ধ (শিক্ষক অসুস্থ/কোর্স বাতিল-জাতীয় দীর্ঘমেয়াদি
কারণে)" — এই দুটো সম্পূর্ণ আলাদা বাস্তব case-কে একই per-date override
দিয়ে model করা যায় না। সমাধান: **explicit date picker (guess না) + দুই
আলাদা off-mode**।

`scheduleSettings`-এ দুটো নতুন field:

```js
// scheduleSettings.classOverrides: {
//   [dateKey]: {                 // CR নিজে বেছে দেওয়া 'YYYY-MM-DD', guess না
//     dayOff: boolean,
//     dayOffReason: string | null,
//     slots: {
//       [slotKey]: {              // `${courseId}::${day}::${slot}`
//         status: 'on' | 'off',   // 'on' = এই নির্দিষ্ট তারিখে explicit
//                                 //   make-up/override (recurringOff থাকা
//                                 //   সত্ত্বেও চালু), 'off' = এই তারিখে বন্ধ
//         reason: string | null,
//         setBy: uid,
//         setAt: <timestamp>,
//       }
//     }
//   }
// }
//
// scheduleSettings.recurringOff: {
//   [slotKey]: {
//     from: 'YYYY-MM-DD',        // এই তারিখ (এবং এর পরের প্রতিটা matching
//                                 //   weekday) থেকে কার্যকর, until CR আবার
//                                 //   চালু না করা পর্যন্ত
//     reason: string | null,
//     setBy: uid,
//     setAt: <timestamp>,
//   }
// }
```

### Resolve করার নিয়ম (একটাই জায়গায় — `isClassOff(dateKey, slotKey)`)

Precedence, উপর থেকে নিচে (প্রথম match জিতবে):

1. `classOverrides[dateKey].dayOff === true` → **off** (recurring/slot override যাই থাকুক)
2. `classOverrides[dateKey].slots[slotKey].status === 'on'` → **on** (recurring off থাকলেও এই
   নির্দিষ্ট তারিখে explicit make-up/exception হিসেবে override করে)
3. `classOverrides[dateKey].slots[slotKey].status === 'off'` → **off**
4. `recurringOff[slotKey]` exists এবং `dateKey >= recurringOff[slotKey].from`
   এবং সেই slot-এর নিজস্ব weekday-র সাথে dateKey মেলে → **off**
5. অন্য কিছু না মিললে → **on** (normal, ডিফল্ট আচরণ, আজকের মতোই)

এই precedence-টা **শুধুমাত্র `isClassOff()`-এর ভিতরে** লেখা থাকবে (store.js),
যাতে Today page, Attendance Daily Log — সব জায়গায় একই যুক্তি প্রযোজ্য হয়,
কোথাও duplicate/ভিন্ন logic না বসে।

## 2. UI: toggle করার সময় CR কী দেখবে

কোনো weekday ট্যাব থেকে date auto-guess করা হবে **না**। প্রতিটা class
card-এর toggle বাটনে ক্লিক করলে একটা ছোট inline panel/popover খুলবে
যেখানে CR স্পষ্টভাবে বেছে দেবে:

- **তারিখ (date picker)** — ডিফল্ট হিসেবে "এই weekday-র সবচেয়ে কাছের
  আসন্ন তারিখ" pre-fill করা থাকবে (সুবিধার জন্য), কিন্তু CR সেটা বদলে
  দিতে পারবে — কোনো silent guess-based commit হবে না, CR-কে confirm
  করতেই হবে।
- **মোড বাছাই (radio/toggle)**:
  - "শুধু এই তারিখে বন্ধ" → `classOverrides[date].slots[slotKey] = {status:'off', ...}`
  - "আজ থেকে প্রতি সপ্তাহে বন্ধ (পরবর্তী নির্দেশ না দেওয়া পর্যন্ত)" →
    `recurringOff[slotKey] = {from: date, ...}`
- **ঐচ্ছিক কারণ (reason)** টেক্সট ইনপুট — দুই মোডেই।
- Day-level toggle ("আজকের সব ক্লাস বন্ধ")-এও একই date picker থাকবে,
  কিন্তু এটা সবসময় single-date (`dayOff`) — recurring day-level off এই
  স্কোপে সাপোর্ট করা হচ্ছে না (বাস্তবে দরকার হলে ভবিষ্যতে আলাদা
  `recurringDayOff` যোগ করা যাবে, কিন্তু এখন over-engineering এড়ানো)।
- Recurring-off অবস্থায় থাকা slot-এ card-এ একটা persistent badge
  ("প্রতি সপ্তাহে বন্ধ — নির্দেশ না আসা পর্যন্ত") দেখাবে এবং একটা
  "আবার চালু করুন" বাটন থাকবে যেটা `recurringOff[slotKey]` মুছে দেবে।

## 3. `courseTeacherMap`-এর মতোই group-shared, একই sync প্যাটার্ন

`classOverrides` ও `recurringOff` দুটোই `scheduleSettings`-এর অংশ
(group mode: `plannerSettings.scheduleFields.classOverrides` /
`.recurringOff`), `holidayDates`-এর মতোই একই doc, একই merge-write
প্যাটার্ন — নতুন কোনো sync mechanism লাগবে না।

## 3. যেখানে plug-in হবে

- **Today page / `todayItems.js`**: `buildTodayItems`-এর
  `schedule.filter((e) => e.day === todayWeekday ...)` ব্লকে, প্রতিটা entry
  include করার আগে `isClassOff(todayKey, slotKey)` চেক করা — true হলে
  skip (holiday-এর মতোই treat করা, কিন্তু আলাদা reason স্ট্রিং সহ, যেমন
  "CR marked off" বনাম "Holiday")।
- **Attendance Daily Log** (`Attendance.jsx`-এর
  `getScheduleCoursesForDate`): একই চেক — off থাকা slot attendance মার্ক
  করার লিস্টে দেখাবে না।
- **Routine পেজ নিজে**: off করা card নিজেই dim/strikethrough অবস্থায়
  থাকবে (মুছে ফেলা হবে না — CR চাইলে আবার on করতে পারবে)।
- **Schedule grid** (weekly template view): অপরিবর্তিত থাকবে, কারণ grid
  abstract weekly template দেখায়, কোনো নির্দিষ্ট calendar date না
  (`IMPLEMENTATION_PROMPT.md`-এর sessional cadence সেকশনে একই যুক্তি
  আছে — grid-এর scope-এর বাইরে)।

## 4. Notification hook (Telegram এখন, SMS পরে — Blaze-ready architecture)

Codebase-এ ইতিমধ্যে existing Telegram infra আছে (`functions/index.js`):
`groups/{groupId}/notices/{noticeId}` কালেকশনে নতুন doc create হলেই
`onGroupNoticeCreateTelegram` trigger হয়ে সেই গ্রুপের linked Telegram
chat-এ push করে দেয়। **এই একই pipeline reuse করা** — আলাদা কোনো নতুন
notification pathway বানানোর দরকার নেই।

- যখনই CR toggle করে কোনো class/day off করে (বা আবার on করে), client
  থেকে সেই group-এর `notices` sub-collection-এ একটা system-authored
  notice ডকুমেন্ট add করা — ঠিক যেভাবে `functions/index.js`-এ কমেন্ট করা
  "system-authored notice in the SAME group notices feed" প্যাটার্ন
  ইতিমধ্যে আছে (দেখো `db.collection('groups').doc(groupId)
  .collection('notices').add({...})` কল, লাইন ~292 এর কাছে)।
- Notice-এর টেক্সট টেমপ্লেট, যেমন:
  - Slot off: `"⚠️ {courseCode} ({time}) আজকে হবে না — CR মার্ক করেছে। কারণ: {reason || 'জানানো হয়নি'}"`
  - Day off: `"⚠️ আজকে ({date}) সব ক্লাস বন্ধ — CR মার্ক করেছে।"`
  - Slot/day আবার on করা হলে: `"✅ {courseCode} ({time}) আসলে হবে — আগের 'বন্ধ' নোটিশ বাতিল।"`
- এই notice document তৈরি হওয়া মাত্রই existing
  `onGroupNoticeCreateTelegram` trigger অটোমেটিক্যালি ফায়ার করবে এবং
  linked Telegram group-এ পাঠিয়ে দেবে — এই অংশের জন্য কোনো নতুন Cloud
  Function লেখার দরকার নেই, existing trigger already group-agnostic।
- **কিন্তু** — Telegram bot এখন off (Blaze নেই বলে token/webhook সেট করা
  নেই এখনো)। তাই deploy করার সময় এই notice-write অংশ **live করে রাখা**
  ঠিক আছে (harmless — bot connect করা না থাকলে `telegramChatId` ফাঁকা
  থাকবে, existing trigger silently no-op করবে, comment অনুযায়ী)।

### SMS-এর জন্য future-proofing (Blaze আসার পর)

এখনই SMS layer বানানোর দরকার নেই, কিন্তু নিচের জিনিসগুলো এখনই রেখে দেওয়া,
যাতে পরে ভুলে না যাই:

1. Notice write করার সময় একটা `channelHints: ['telegram', 'sms']`
   ধরনের optional field সাথে পাঠানো (এখন শুধু telegram consume করবে)।
2. `functions/index.js`-এ একটা `TODO(Blaze):` কমেন্ট ব্লক যোগ করা,
   ঠিক `onGroupNoticeCreateTelegram`-এর পাশে, যেখানে লেখা থাকবে:
   Blaze account সচল হলে এখানে একটা `onGroupNoticeCreateSms` (বা
   একই ফাংশনের ভিতরে fan-out) যোগ করতে হবে, যেটা group-এর
   `smsOptInNumbers` (নতুন field, এখনো তৈরি করার দরকার নেই, শুধু নাম
   ঠিক করে রাখা) থেকে নাম্বার নিয়ে SMS gateway (Blaze billing লাগবে বলে
   এখন available না — Twilio/local gateway যেটাই ঠিক হয়) কল করবে।
3. `docs/` ফোল্ডারে একটা ছোট `NOTIFICATION_ARCHITECTURE.md` লিখে রাখা,
   যাতে future session-এ (Blaze আসার পর) context হারিয়ে না যায় — এই
   prompt-এর "4. Notification hook" সেকশনটার সারমর্মই যথেষ্ট।

## Acceptance criteria

- `/class-routine`-এ CR/ACR প্রতিটা class card-এ ও প্রতিটা দিনের হেডারে
  toggle দেখতে পাবে; অন্য কোনো role এই toggle দেখবে না।
- একটা slot off করলে সেটা শুধু সেই নির্দিষ্ট date + slot-এর জন্যই প্রযোজ্য
  হবে — routine grid বা অন্য দিনের কিছু বদলাবে না।
- একটা দিন পুরোপুরি off করলে Today page ও Attendance Daily Log সেই
  dateKey-এর সব class বাদ দেখাবে, কিন্তু routine grid template
  অপরিবর্তিত থাকবে।
- Toggle অন করার/বন্ধ করার সাথে সাথেই group-এর `notices` ফিডে একটা
  system notice আসবে এবং (Telegram bot connected থাকলে) সেই গ্রুপের
  Telegram chat-এ push হবে — নতুন কোনো trigger লেখা ছাড়াই, existing
  pipeline দিয়ে।
- Telegram bot বর্তমানে off থাকা অবস্থায়ও কোনো error/crash হবে না
  (existing silent no-op behavior বজায় থাকবে)।
- SMS layer এখনো বানানো হয়নি, কিন্তু `channelHints` field এবং
  `TODO(Blaze)` কমেন্ট কোডে বসানো থাকবে, যাতে Blaze আসার পর দ্রুত
  wire করা যায়।

## Suggested implementation order

1. `scheduleSettings.classOverrides` data model + `isClassOff()` helper
   (`store.js`)।
2. `/class-routine` পেজে toggle UI (slot-level + day-level)।
3. `todayItems.js` ও `Attendance.jsx`-এ `isClassOff()` plug-in করা।
4. Notice-write hook (existing `notices` sub-collection pattern reuse)।
5. `TODO(Blaze)` কমেন্ট + `channelHints` field + `docs/NOTIFICATION_ARCHITECTURE.md`।

কোনো নতুন Cloud Function এই ফিচারের জন্য লেখার দরকার নেই — সবকিছু
existing `onGroupNoticeCreateTelegram` trigger ও existing
`scheduleSettings`/`groupSync.js` প্যাটার্ন পুনর্ব্যবহার করেই হবে।
