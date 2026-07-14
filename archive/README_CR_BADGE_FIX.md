# "Claims CR / Pending" stuck badge — fix summary

## আসল কারণ

`legacyCRClaim` field member doc-এ শুধু **একবার**, `joinGroup()`-এর সময়
(profile-এর `isCR` checkbox থেকে) সেট হতো। এরপর CR role change করার
তিনটা function-ই (`clApproveLeaveCR`, `clRevokeCR`, `handoffCR`)
`role` field update করত কিন্তু `legacyCRClaim` কখনো `false` করত না —
তাই "Claims CR" badge (`ClassmatesList.jsx` লাইন 123:
`m.role !== 'cr' && m.legacyCRClaim`) role চলে যাওয়ার পরও লেগে থাকত।

এইটা permission-error বা stale-cache সমস্যা না — codebase-এর
`_subscribeSingleton` (groupSync.js) আগে থেকেই retry-with-backoff সহ
সঠিকভাবে বানানো, live data ঠিকই আসছিল। সমস্যাটা ছিল শুধু একটা field
কখনো reset না হওয়া।

## যা যা পরিবর্তন হয়েছে

### 1. `src/lib/groupSync.js`
তিনটা জায়গায় `legacyCRClaim: false` add করা হয়েছে, role reset-এর সাথেই:
- `clApproveLeaveCR` (CL leave-request approve করলে)
- `clRevokeCR` (CL সরাসরি revoke করলে)
- `handoffCR` (CR নিজে successor-কে হ্যান্ডঅফ করলে)

### 2. `firestore.rules`
`members/{memberUid}` update rule-এর CR self-service branch
(`isGroupCR(groupId) && ...`)-এ `legacyCRClaim` কে allowed field হিসেবে
যোগ করা হয়েছে (আগে শুধু `role`, `verified` allowed ছিল) — নাহলে
`handoffCR`-এর self-demote write reject হয়ে যেত। সাথে একটা guard
যোগ করা হয়েছে যাতে এই branch দিয়ে `legacyCRClaim` কখনো `true`-তে সেট
করা না যায়, শুধু `false` করা যায় — privilege-widening আটকাতে।

### 3. `scripts/fix_stale_legacyCRClaim.cjs` (নতুন)
One-time migration script — সব group-এর সব member doc scan করে
`role !== 'cr' && legacyCRClaim === true` এমন সবাইকে খুঁজে বের করে ও
fix করে। এই fix future writes-এ automatic, কিন্তু যারা আগে থেকেই leave
নিয়েছে তাদের badge already stuck হয়ে আছে — এই script সেগুলো clean করবে।

## Deploy করার ধাপ

1. **Rules deploy করো:**
   ```
   firebase deploy --only firestore:rules
   ```

2. **Code deploy করো** (normal build/deploy flow যেভাবে করো)।

3. **Migration script চালাও** (existing stuck accounts fix করতে):
   ```
   # প্রথমে Firebase Console > Project settings > Service accounts
   # থেকে একটা private key download করে scripts/serviceAccountKey.json
   # নামে save করো (এটা .gitignore-এ যোগ করা আছে, commit হবে না)

   cd scripts
   node fix_stale_legacyCRClaim.cjs           # dry run — শুধু report দেখাবে
   node fix_stale_legacyCRClaim.cjs --apply   # আসল fix, writes করবে
   ```

   Dry run আগে চালিয়ে report দেখে নিশ্চিত হয়ে নিও কতজনের badge stuck
   আছে, তারপর `--apply` দিয়ে actual fix করো।

## যা পরীক্ষিত/verify করা হয়েছে

- `subscribeMembers`, `subscribeCRRequests`, `subscribeLeaveRequests` —
  সবগুলোই `_subscribeSingleton`-এর মধ্য দিয়ে যায়, যেখানে permission-denied
  হলে ৩ বার retry + ৫ সেকেন্ড পর background retry হয়। এটা আগে থেকেই ঠিকমতো
  বানানো ছিল, কোনো change লাগেনি।
- `assignACR`/`revokeACR` — এগুলো `legacyCRClaim` touch করে না, তাই
  অপরিবর্তিত রাখা হয়েছে (ACR-দের এই flag কখনো set হয়ওনি)।
- Firestore rules-এর brace/paren balance manually check করা হয়েছে
  (এই sandbox-এ firebase CLI না থাকায় local lint চালানো যায়নি —
  deploy করার আগে একবার নিজে `firebase deploy --only firestore:rules
  --dry-run` বা staging project-এ test করে নিও, extra সাবধানতার জন্য)।
