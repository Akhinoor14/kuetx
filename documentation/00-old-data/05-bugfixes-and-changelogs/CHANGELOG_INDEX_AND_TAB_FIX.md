# KUETx — দুইটা ইস্যুর ফিক্স (Bangla changelog)

## ইস্যু ১: Firestore `joinRequests` index missing — CODE বাগ না, DEPLOY গ্যাপ

### Console error
```
[groupSync] subscribeAllPendingJoinRequests error: FirebaseError:
The query requires a COLLECTION_GROUP_ASC index for collection
joinRequests and field status. That index is not ready yet.
```

### কারণ
`src/lib/groupSync.js`-এর `subscribeAllPendingJoinRequests()`:
```js
const q = query(collectionGroup(db, 'joinRequests'), where('status', '==', 'pending'));
```
এটা একটা **collection-group** query — সব `groups/{groupId}/joinRequests`
সাবকালেকশন জুড়ে `status == 'pending'` খোঁজে। Collection-group query-তে
`status` ফিল্ডের উপর index লাগবেই, `orderBy` ছাড়া single-field হলেও।

`firestore.indexes.json` ফাইলে দেখা গেছে **ইনডেক্স-কনফিগ ইতিমধ্যেই
সঠিকভাবে লেখা আছে**:
```json
"fieldOverrides": [
  {
    "collectionGroup": "joinRequests",
    "fieldPath": "status",
    "indexes": [
      { "order": "ASCENDING", "queryScope": "COLLECTION" },
      { "order": "ASCENDING", "queryScope": "COLLECTION_GROUP" },
      { "arrayConfig": "CONTAINS", "queryScope": "COLLECTION" }
    ]
  }
]
```
মানে কোডে বা কনফিগ-ফাইলে কোনো বাগ নেই — সমস্যাটা হলো **এই কনফিগ Firebase
প্রজেক্টে deploy হয়নি**, অথবা deploy হয়েছে কিন্তু index এখনো build হচ্ছে
("not ready yet")।

### Fix — deploy command চালাতে হবে
```bash
firebase deploy --only firestore:indexes
```
Deploy করার পর Firebase Console-এ গিয়ে Firestore → Indexes ট্যাবে
`joinRequests` / `status` (COLLECTION_GROUP) index-টার status
"Building" থেকে "Enabled" হওয়া পর্যন্ত অপেক্ষা করতে হবে (সাধারণত
কয়েক মিনিট, ডেটার সাইজের উপর নির্ভর করে বেশিও লাগতে পারে)। Building
অবস্থায় থাকতে থাকতেই query চালালে এই একই error আসবে — এটা normal,
নতুন কোনো বাগ না।

এই লিংকেও সরাসরি গিয়ে এক-ক্লিকে index তৈরি করা যায় (error message-এর
সাথেই দেওয়া ছিল):
`https://console.firebase.google.com/v1/r/project/kuetx-8a184/firestore/indexes?create_exemption=...`

**কোনো ফাইল পরিবর্তন করা হয়নি** এই ইস্যুর জন্য — শুধু deploy বাকি ছিল।

---

## ইস্যু ২: Founder + Campus Lead chip/tab এখনো দেখাচ্ছে না (LIVE সাইটে)

### স্ক্রিনশট রিভিউ
"Your roles: Founder · Campus Lead" লাইনের ঠিক নিচে কোনো chip
(Founder | Campus Lead — ২টা আলাদা ক্লিকযোগ্য বাটন) নেই — সরাসরি
Founder-এর pill row (Manage Batches, Approvals, Staff & Roles...)
দেখা যাচ্ছে। Sidebar-এ "**KUETx v4.1**" দেখাচ্ছে (৪.১.৬)।

### এটা আগের সেশনেই ধরা পড়া এবং ফিক্স করা bug — শুধু deploy হয়নি

আগের রিভিউতে `src/pages/StaffDashboard.jsx`-এ ঠিক এই race
condition-টাই পাওয়া গিয়েছিল এবং fix করা হয়েছিল:

- `isAdminUser` স্টেটের default value ছিল `false` (`null` না)।
- `roles` (staff/{uid}/roles) আর Founder-status (admins/{uid}) — দুইটা
  আলাদা async Firestore listener, একসাথে resolve হওয়ার guarantee নেই।
  `roles` সাধারণত আগে আসে।
- ফলে tabs একবার Founder-status না জেনেই compute হয়ে যেত — Founder +
  Campus Lead ইউজারের জন্য তখন `tabs = [{key:'cl'}]` (শুধু ১টা), আর
  `RoleTabBar` `tabs.length <= 1` হলে **কিছুই render করে না**
  (`return null`) — এটাই ইচ্ছাকৃত single-role behavior, কিন্তু এখানে
  ভুলভাবে trigger হয়ে যাচ্ছিল কারণ Founder status তখনও জানা ছিল না।
- পরে Founder status `true` রেজল্ভ হয়ে Founder tab যোগ হলেও, ইতিমধ্যে
  URL/`activeTab` অন্য কোনো ভ্যালুতে (যেমন `cl` বা সরাসরি deep-link
  `founder`) লক হয়ে গিয়েছিল বলে chip bar-টা প্রথম render-এই ঠিকভাবে
  দেখা যায়নি।

### যা ফিক্স করা হয়েছে (আগের সেশনেই, `src/pages/StaffDashboard.jsx`)
```js
// আগে:
const [isAdminUser, setIsAdminUser] = useState(false);

// এখন:
const [isAdminUser, setIsAdminUser] = useState(null); // null = এখনো জানা নেই
```
আর tabs বানানোর effect + loading guard — দুই জায়গাতেই
`isAdminUser === null` হলে কিছুই compute না করে অপেক্ষা করে, যাতে
`roles` আর Founder-status দুইটাই না জানা পর্যন্ত tabs একবারও ভুলভাবে
compute না হয়:
```js
useEffect(() => {
  if (!roles) return;
  if (isAdminUser === null) return;   // ← নতুন guard
  ...
}, [...]);

if (roles === null || isAdminUser === null) return <div>Loading…</div>;  // ← guard extended
```

### কেন এখনো লাইভ সাইটে fix দেখা যাচ্ছে না
Screenshot-টা `kuetx.vercel.app`-এর লাইভ ডিপ্লয়মেন্ট থেকে, যেখানে
sidebar-এ v4.1.6 দেখাচ্ছে — এটা এখনো **পুরনো, un-fixed build**। এই
zip-এর `StaffDashboard.jsx`-টাই fixed version — এটা রিপোতে বসিয়ে
নতুন করে build+deploy (Vercel-এ push) করলেই chip bar ঠিকভাবে দেখাবে।

### Verify করার উপায় (deploy-এর পর)
- Hard refresh / cache clear করে (বা Incognito-তে) `/team` পেজে যাওয়া।
- Founder + Campus Lead ইউজার দিয়ে লগইন করে দেখা — "Your roles:
  Founder · Campus Lead" লাইনের ঠিক নিচে **দুইটা আলাদা chip** ("Founder"
  আর "Campus Lead") আসছে কিনা, এবং একটাতে ক্লিক করলে content
  switch হচ্ছে কিনা, দুইটা একসাথে মিশছে না কিনা।

---

## ফাইল সামারি
- **`src/lib/groupSync.js`** — কোনো পরিবর্তন নেই (কোড ঠিকই ছিল)।
- **`firestore.indexes.json`** — কোনো পরিবর্তন নেই (কনফিগ ঠিকই ছিল,
  শুধু deploy করা বাকি — `firebase deploy --only firestore:indexes`)।
- **`src/pages/StaffDashboard.jsx`** — আগের সেশনের fix এখানে বহাল
  আছে (`isAdminUser` default `null`, effect + loading guard আপডেট) —
  এই zip-এ সেই fixed version-ই দেওয়া হলো, deploy করলেই chip bar ফিরে
  আসবে।
