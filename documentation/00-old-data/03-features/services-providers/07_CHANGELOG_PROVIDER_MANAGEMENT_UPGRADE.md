# Service Providers — Founder Panel Upgrade — Changelog

## যা যা পরিবর্তন হয়েছে (৩টা ফাইল)

### 1. `src/lib/providerSync.js`
- নতুন `adminDeleteProvider(uid)` ফাংশন যোগ হয়েছে — provider account
  স্থায়ীভাবে delete করার জন্য।
- শুধু `pending` / `rejected` / `deactivated` status-এর account delete
  করা যাবে। `verified` (এখনো active) provider delete করতে চাইলে আগে
  Deactivate করতে হবে — কারণ deactivate নিজেই services force-close করে
  আর pending booking expire করে দেয়, তাই delete-এর আগে সেই cascade
  আলাদা করে চালানোর দরকার নেই।
- Delete করলে `providers/{uid}` doc-এর সাথে সাথে
  `providers/{uid}/contact/phone` sub-doc-ও মুছে যাবে (best-effort)।

### 2. `firestore.rules`
- `providers/{uid}/contact/phone` sub-document-এ নতুন
  `allow delete: if isAdmin();` rule যোগ হয়েছে। আগে parent doc delete
  করার permission থাকলেও phone sub-doc delete করার কোনো rule ছিল না —
  ফলে Founder কোনো provider delete করলে phone doc orphan হয়ে থেকে
  যেত। এখন ঠিক করা হয়েছে।

### 3. `src/pages/AdminDashboard.jsx` (`ProviderManagementView`)

**Directory tab (All Providers) — নতুন যা যোগ হলো:**
- 🔍 **Search box** — নাম বা ফোন নম্বর দিয়ে খোঁজা যাবে (case-insensitive)।
  ফোন নম্বর দিয়ে search করতে হলে আগে সেই row-টা একবার expand/click
  করতে হবে (কারণ phone lazy-load হয়, নিচে দেখুন কেন)।
- 🏷️ **Status filter chips** — All / Pending / Verified / Rejected /
  Deactivated, প্রতিটার পাশে count দেখাবে। Search আর filter একসাথে কাজ
  করে (AND লজিক)।
- ☎️ **Phone number** — এখন directory-তেও দেখা যাবে, কিন্তু row-এ click
  করলে তবেই load হবে (lazy-load) — কারণ শত শত provider-এর জন্য একসাথে
  সবার phone fetch করাটা ভারী হয়ে যেত।
- 🗑️ **Delete button** — যেসব account verified না (pending/rejected/
  deactivated), তাদের জন্য permanent delete option। Confirm dialog
  ছাড়া কিছু হবে না, আর এটা একদম irreversible।
- ↕️ **Sort dropdown** — Name (A-Z) [default] / Recently verified /
  Status অনুযায়ী sort করা যাবে।
- ⏳ **Slow-load warning** — Approvals tab-এ যেমন আছে, এখন এখানেও আছে।
  Firestore index deploy হতে দেরি হলে Founder সেটা বুঝতে পারবে, আর
  আন্তহীন loading spinner দেখতে হবে না।

**Verify tab — নতুন যা যোগ হলো:**
- ✅ **Bulk approve** — "Select all" checkbox + "Approve selected"
  button। অনেকগুলো pending request একসাথে approve করা যাবে। Bulk
  reject ইচ্ছাকৃতভাবে বানানো হয়নি — reject-এর জন্য প্রতিটার আলাদা কারণ
  লিখতে হয়, তাই সেটা আগের মতোই এক-এক করে করতে হবে।

**যা করা হয়নি (স্কিপ করা হয়েছে):**
- **Pagination** — এখন করা হয়নি। কারণ, বর্তমান দুই-তিন ডজন provider-এর
  scale-এ দরকার নেই, আর client-side search/filter/sort-এর সাথে
  pagination মেলাতে গেলে হয় সব fetch করে filter করতে হবে (তখন
  pagination-এর কোনো লাভ থাকে না), নাহলে filtering server-side নিয়ে
  যেতে হবে। এটা future scale বাড়লে আলাদাভাবে করা ভালো — এখন করলে
  বাকি সব কাজের simplicity নষ্ট হতো।

## Verification
- দুইটা JS ফাইল esbuild দিয়ে syntax-check করা হয়েছে — কোনো error নেই।
- `firestore.rules`-এর brace balance check করা হয়েছে — ঠিক আছে।
- Output zip আবার extract করে verify করা হয়েছে যে সব change আসলেই
  zip-এর ভেতরে আছে (আগের সেশনের ভুল থেকে শিক্ষা নিয়ে)।
- `verify` tab-এর existing logic (approve/reject single row) অক্ষত
  আছে — শুধু bulk-approve checkbox যোগ হয়েছে তার পাশে।

## যা এখনো করা লাগবে (আপনার তরফ থেকে)
- `firestore.rules` deploy করতে হবে (`firebase deploy --only firestore:rules`)
  নাহলে নতুন delete button কাজ করবে না — permission-denied error দেখাবে।
- Sanity test: Deactivate → Delete flow একবার হাতে চালিয়ে দেখুন।
