# KUETx — Console Permission Error Fix (Changelog)

তারিখ: ৩০ জুলাই ২০২৬

## সংক্ষেপে
DeepSeek-এর রিপোর্ট আংশিক সঠিক ছিল — মূল লক্ষণ (Missing or insufficient permissions) ঠিক ছিল, কিন্তু root cause "Firestore rules-এ read permission নেই" ছিল না। আসল কারণ দুইটা আলাদা bug, দুইটাই client-side কোডে (rules-এ না):

---

## Bug 1: `globalNotices` শুধু 🔴 (আসল bug, ফিক্স করা হয়েছে)

**ফাইল:** `src/lib/groupSync.js` → `subscribeGlobalNotices()`

**সমস্যা:** এই ফাংশনটা root `notices` কালেকশনে কোনো `where()` filter ছাড়াই একটা unfiltered listener চালাচ্ছিল:
```js
query(collection(db, 'notices'), orderBy('createdAt', 'desc'), limit(50))
```
কিন্তু `firestore.rules`-এ `/notices/{noticeId}` এর read rule per-document — `audience.type` ফিল্ডের ওপর ভিত্তি করে (all/batch/group/faculty_all/faculty_uids/student_uids)। Firestore-এর নিয়ম হলো: **list query** (`onSnapshot` collection-এর ওপর) allow হবে শুধু তখনই যখন rule-টা query-র নিজের `where()` clause থেকেই প্রমাণ করা যায় — প্রতিটা doc আলাদা করে চেক করে না। যেহেতু এই query-তে `audience.type` নিয়ে কোনো filter ছিল না, Firestore পুরো query-টাই সরাসরি reject করে দিচ্ছিল — এইজন্যই `globalNotices` listener বারবার permission-denied error দিচ্ছিল।

**মজার ব্যাপার:** ঠিক এই একই bug আগে `groupNotices` (broadcast/legacy/crOnly) এর জন্যও ছিল, এবং সেটা আগেই ফিক্স করা হয়েছিল (কোডে কমেন্ট আছে) — কিন্তু `subscribeGlobalNotices()` ফাংশনে এই একই fix apply করা হয়নি, সেটা miss হয়ে গিয়েছিল।

**ফিক্স:** `subscribeGroupNotices()` যে pattern ব্যবহার করে সেই একই pattern এখানে apply করা হয়েছে — audience.type অনুযায়ী আলাদা আলাদা `where()`-scoped listener বানিয়ে client-side এ merge করা হয়েছে:
- `audience.type in ['all', 'batch', 'group']` — সবার জন্য
- `audience.type == 'student_uids' && audience.uids array-contains uid` — শুধু targeted student-দের জন্য
- `audience.type == 'faculty_all'` এবং `audience.type == 'faculty_uids'` — শুধু faculty account হলে (একটা হালকা `getDoc(faculty/{uid})` চেক দিয়ে নিশ্চিত করা হয়, যেটা সব signed-in user read করতে পারে বলে সস্তা)

---

## Bug 2: `manualVerifyRequests` ensureManualVerifyRequest failed 🔴 (আসল bug, ফিক্স করা হয়েছে)

**ফাইল:** `src/lib/manualVerifyRequests.js` → `ensureManualVerifyRequest()`

**সমস্যা:** এই ফাংশন প্রথমে `getDoc(manualVerifyRequests/{uid})` দিয়ে চেক করত doc আগে থেকে আছে কিনা। কিন্তু rules-এ read rule হলো:
```
allow read: if ... resource.data.uid == request.auth.uid
```
যখন doc **এখনো তৈরিই হয়নি** (প্রথমবার app খোলার সময়), তখন Firestore rules-এ `resource` হয়ে যায় `null` — আর `resource.data.uid` এক্সেস করতে গেলে সেটা deny হয়ে যায়, এমনকি সেই user নিজের future doc পড়তে চাইলেও। ফলে **প্রতিটা প্রথমবার-এর user-এর জন্যই** এই read fail করছিল — কোনো role/verification সমস্যা ছিল না।

**ফিক্স:** এই pre-check `getDoc` read সরিয়ে ফেলা হয়েছে। এটা আসলে দরকারও ছিল না — create rule-এ আগে থেকেই server-side `!exists()` guard আছে, তাই duplicate request তৈরি হওয়া ঠেকানো এমনিতেই enforced। এখন সরাসরি `setDoc()` (create হিসেবে) কল করা হয়, আর যদি doc আগে থেকেই থাকে, rule নিজেই সেটা reject করবে (silently caught, no-op) — reviewer-এর status/reviewedAt/reviewedBy কখনো clobber হবে না, কারণ update rule শুধু Admin/HeadOfOps-এর জন্য।

---

## `groupNotices` (broadcast/legacy) 🟢 — কোনো bug নেই

কোড দেখে নিশ্চিত হয়েছি — এগুলো আগেই সঠিকভাবে fix করা আছে (per-audience where()-scoped listener pattern)। রিপোর্টে যে errors দেখা গেছে সেগুলো সম্ভবত এই fix deploy হওয়ার আগের অবস্থার log, অথবা `crOnly` listener কোনো non-CR viewer-এর জন্য ভুলবশত attach হয়েছিল (এখন `canSeeCrOnly` flag ছাড়া attach হয় না)। আলাদা কোনো কোড পরিবর্তনের দরকার নেই এখানে।

---

## পরবর্তী পদক্ষেপ
1. এই দুইটা ফাইল (`groupSync.js`, `manualVerifyRequests.js`) তোমার repo-তে replace করো।
2. Firestore rules পরিবর্তনের দরকার নেই — সমস্যাটা rules-এ না, client query শেপে ছিল।
3. Deploy করার দরকার নেই rules-এর জন্য, শুধু frontend rebuild/redeploy করলেই হবে।
4. টেস্ট করার সময় লক্ষ্য রাখো: নতুন signed-in user (আগে কখনো verify request পাঠায়নি) এবং faculty account দুইটাতেই `globalNotices` আর `manualVerifyRequests` ঠিকমতো কাজ করছে কিনা।
