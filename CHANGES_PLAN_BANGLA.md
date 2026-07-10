# KUETx Notice + Bell System — Audit ও Fix Plan

## ১. যা যা সমস্যা পাওয়া গেছে

### ক) Sidebar-এ Notice পেজের কোনো এন্ট্রিই ছিল না
`src/nav.js` চেক করে দেখা গেছে — Notice পেজ (`/notice`) route হিসেবে `App.jsx`-এ আছে, কিন্তু sidebar-এর কোনো section/hub-এ এর link যোগ করা হয়নি। ইউজার শুধু bell dropdown-এর "View all notices" লিংক দিয়ে পেজে যেতে পারতো — sidebar থেকে direct navigate করার কোনো উপায় ছিল না। এটাই মূল কারণ কেন "sidebar এ notice আলাদা করে দেখা যাচ্ছে না।"

### খ) Bell icon-এ unread notice count কখনোই আপডেট হতো না (আসল bug)
`Navbar.jsx`-এ bell-এর badge count বের করার জন্য `noticeApi.getNotices()` কল করা হতো — কিন্তু `noticeUtils.js`-এর কমেন্টেই লেখা আছে এটা একটা **deprecated stub যেটা সবসময় খালি array (`[]`) রিটার্ন করে** (Firestore live subscription-এ migrate করার সময় এটা রিপ্লেস করতে ভুলে গেছিল)। ফলে:
- Bell-এর badge-এ notice কখনো কাউন্ট হতো না, শুধু Alerts (attendance/assignment) কাউন্ট হতো।
- এজন্যই notice আসলেও bell দেখে বোঝার উপায় ছিল না — badge সংখ্যা ঠিকই থাকতো কিন্তু notice ধরেই নিতো না।

`NotificationPanel.jsx` অবশ্য সঠিকভাবে live `subscribeAllNotices()` ব্যবহার করতো — তাই dropdown খুললে ঠিকই notice দেখা যেত, কিন্তু bell-এর নিজের badge number-এ সেটা প্রতিফলিত হতো না। দুই জায়গার লজিক sync ছিল না।

### গ) Bell icon-এর visual state — unread হলেও bell দেখতে একইরকম
Bell button সবসময় একই style-এ থাকতো (শুধু ছোট্ট লাল badge)। Unread থাকলে bell নিজে কোনোভাবে আলাদা দেখাতো না (কালার চেঞ্জ, রিং, animation কিছুই না) — তাই badge-টা miss করলে বোঝার উপায় কম ছিল।

### ঘ) Founder-এর notice আলাদাভাবে highlight হতো না
`AdminDashboard.jsx`-এ Founder notice পাঠানোর সময় `createdBy: { uid, name: 'Founder' }` সেভ হয় (Firestore-এ)। কিন্তু `noticeUtils.js`-এ live-merge করার সময় এই তথ্য ফেলে দিয়ে সব global notice-কে হার্ডকোডেড `from: 'Admin'` বানিয়ে দেওয়া হতো। ফলে Founder vs সাধারণ Admin notice আলাদা করার কোনো data-ই বাকি থাকতো না UI পর্যন্ত পৌঁছানোর আগে।

### ঙ) Notice পেজ section-wise ছিল না, full-width ছিল না
আগের `Notice.jsx` সব notice (Admin + CR/ACR) একটাই flat list-এ, `maxWidth: 720px` বক্সে দেখাতো। Section আলাদা ছিল না, Founder highlight ছিল না।

---

## ২. যা যা ঠিক করা হয়েছে (এই zip-এ থাকা ফাইলগুলোতে)

**`src/nav.js`** — একটা নতুন top-level sidebar hub যোগ করা হয়েছে:
```js
{ group: 'Notice', isSubgroup: true, hubPath: '/notice', hubIcon: 'Bell', items: [...] }
```
এখন desktop sidebar এবং mobile hamburger drawer — দুই জায়গাতেই "Notice" আলাদা row হিসেবে দেখা যাবে (Bell আইকনসহ), Dashboard/Profile-এর পাশে।

**`src/lib/noticeUtils.js`** — global notice merge করার সময় এখন `createdBy.name === 'Founder'` চেক করে প্রতিটা notice-এ `isFounder: true/false` এবং `section: 'admin' | 'class'` ফ্ল্যাগ যোগ করা হচ্ছে। এটাই UI-কে বলে দেয় কোনটা Founder-এর, কোনটা সাধারণ Admin-এর, কোনটা CR/ACR-এর।

**`src/components/Navbar.jsx`** — দুইটা মূল ফিক্স:
1. মৃত `getNotices()` স্টাব সরিয়ে `subscribeAllNotices()`-এর real-time Firestore subscription বসানো হয়েছে (ঠিক `NotificationPanel.jsx`-এর মতোই) — এখন bell badge আসল unread notice count সঠিকভাবে দেখাবে, লাইভ।
2. Bell icon-এর visual state বদলে দেওয়া হয়েছে — unread কিছু থাকলে:
   - Bell-এর বর্ডার ও আইকনের রং accent color হয়ে যাবে (fill সহ)
   - হালকা "ring" animation (bell নিজে subtle ভাবে দোলে, প্রতি ২.৪ সেকেন্ডে একবার)
   - Badge number-এ soft pulsing glow

**`src/pages/Notice.jsx`** — সম্পূর্ণ নতুন করে লেখা হয়েছে:
- পেজ এখন **100% width** (আগের 720px cap সরানো হয়েছে)
- Section-wise ভাগ: **Founder** → **Admin** → **Class (CR/ACR)** — Founder ও Admin এক কলামে, Class notices পাশে (wide screen-এ ২-কলাম গ্রিড, ছোট স্ক্রিনে এক কলামে stack হয়ে যাবে)
- Founder-এর notice special card-এ দেখানো হয় — accent-color gradient background, thicker border, glow shadow, উপরে ছোট্ট **"👑 Founder"** ব্যাজ, title বড় ও bold/highlighted
- Unread notice-এ ছোট ডট + হালকা accent-tinted background থাকে, read হয়ে গেলে normal হয়ে যায়
- প্রতিটা notice card-এ সময় (relative — "5m ago", "2h ago" ইত্যাদি) ও কে পাঠিয়েছে সেটা দেখায়

---

## ৩. আর কী কী মিসিং/দুর্বল জায়গা পাওয়া গেছে (এখনো ফিক্স করা হয়নি — future scope)

1. **Notice delete/expire নেই** — Founder বা CR একবার notice পাঠালে সেটা চিরস্থায়ী থাকে (৫০টা পর্যন্ত fetch হয় `fsLimit(50)`)। Old/stale notice mute বা auto-expire করার কোনো সিস্টেম নেই।
2. **Mark-all-as-read নেই** — Notice পেজে বা bell dropdown-এ "সব read করো" বাটন নেই, একটা একটা করে ক্লিক করে read করতে হয়।
3. **Push notification নেই** — শুধু app খোলা অবস্থায় (Firestore `onSnapshot`) notice আসে; app বন্ধ থাকলে বা background-এ থাকলে কোনো push/FCM notification যায় না।
4. **CR/ACR notice-এর মধ্যে CR vs ACR আলাদা করা হয় না** — `postedBy.name` যা সেভ হয় তাই দেখায়, কিন্তু কোনো role-based badge (CR/ACR আলাদা রং) নেই যেমন Founder-এর জন্য করা হলো।
5. **Notice-এ attachment/image সাপোর্ট নেই** — শুধু title+body টেক্সট।
6. **"Read" state per-device, per-browser (localStorage-based)** — অন্য ডিভাইসে লগইন করলে আগের read notice আবার unread দেখাবে, কারণ `NOTICE_READ_KEY` sync হয় না Firestore-এ, শুধু local store-এ থাকে।
7. **Batch/Group audience-এর কোনো preview/reach-estimate নেই** — Founder notice পাঠানোর সময় জানে না ঠিক কতজন এই batch/group-এ পড়বে সেটা পৌঁছাবে।

---

## ৪. Output ফাইল

শুধু edited/created ৪টা ফাইল zip করে দেওয়া হচ্ছে, একই folder structure বজায় রেখে যাতে সরাসরি প্রজেক্টে overwrite করা যায়:
```
src/nav.js
src/lib/noticeUtils.js
src/components/Navbar.jsx
src/pages/Notice.jsx
```
`npx vite build` চালিয়ে confirm করা হয়েছে — কোনো build error নেই।
