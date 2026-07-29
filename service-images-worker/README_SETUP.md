# Service Images R2 Worker Setup — Phase 3 (MULTI_CATEGORY_SERVICES_PLAN.md)

এই ফোল্ডারের কোড শুধু zip এডিট করে কাজ করবে না — Cloudflare অ্যাকাউন্টে
নতুন bucket + worker তৈরি করে deploy করাটা তোমাকেই করতে হবে (owner-only
account-level ধাপ, ঠিক `functions/README_PUSH_SETUP.md`-এর প্যাটার্নে)।

## ✅ ১. R2 bucket — তুমি ইতিমধ্যে করে ফেলেছ
`kuetx-service-images` bucket তৈরি ও public access enable করা হয়ে গেছে
(screenshot অনুযায়ী), public URL:

```
https://pub-97c3873f03ed4af0ae649f201326421f.r2.dev
```

এই URL-টাই নিচের ধাপ ৪-এ `.env`-এ বসবে।

## ✅ ২. `wrangler.toml`-এ real values — আগে থেকেই বসানো আছে
এই zip-এ `FIREBASE_PROJECT_ID = "kuetx-8a184"` ও
`ALLOWED_ORIGIN = "https://kuetx.vercel.app"` ইতিমধ্যে বসানো আছে —
`cloudflare-worker/wrangler.toml`-এর একই value, আলাদা করে কিছু বসাতে
হবে না। শুধু `bucket_name = "kuetx-service-images"` তোমার bucket-এর নাম
মিলছে কিনা একবার চোখ বুলিয়ে নিশ্চিত হও।

## ৩. Deploy করো
`wrangler` CLI না থাকলে প্রথমে ইনস্টল করো (`npm install -g wrangler`
অথবা প্রজেক্টের ভেতরে `npx wrangler`), তারপর:
```
cd service-images-worker
wrangler login          # প্রথমবার হলে, একই Cloudflare অ্যাকাউন্ট
wrangler deploy
```
এই ধাপ AI bot নিজে করতে পারবে না, CLI/account access দরকার।

## ৪. Deploy হওয়ার পর worker URL নোট করে `.env`-এ বসাও
Deploy সফল হলে `wrangler` একটা URL প্রিন্ট করবে (যেমন
`https://kuetx-service-images-worker.<subdomain>.workers.dev`)। repo
root-এ `.env` ফাইলে (না থাকলে `.env.example` কপি করে বানাও) এই দুই লাইন
যোগ/আপডেট করো:

```
VITE_SERVICE_IMAGES_WORKER_URL=https://kuetx-service-images-worker.<subdomain>.workers.dev
VITE_SERVICE_IMAGES_PUBLIC_BASE_URL=https://pub-97c3873f03ed4af0ae649f201326421f.r2.dev
```

দ্বিতীয় লাইনটা (public base URL) তোমার বেলায় এখন জানাই আছে (ওপরে ধাপ
১-এ দেওয়া) — শুধু প্রথম লাইনটা (worker URL) deploy করার পর বসাতে হবে।
তারপর dev server রিস্টার্ট করো (`npm run dev`) যাতে নতুন env var লোড
হয়।

## এই worker কী করে (কোড রিভিউ-এর জন্য সংক্ষেপে)
- `POST /upload` — multipart file + serviceId, Firebase ID-token
  ভেরিফাই করে (existing question-bank worker-এর token-verification কোড
  থেকে কপি — pure fetch + WebCrypto, কোনো dependency ছাড়া), তারপর
  Firestore REST দিয়ে re-verify করে আপলোডকারী uid-ই এই service-এর
  `providerUid` কিনা। 1MB সাইজ লিমিট ও image content-type চেক করে।
- `DELETE /image` — key থেকে serviceId re-derive করে (client-supplied
  serviceId trust করে না), owner-check করে delete করে।
- কোনো secret এই zip-এ নেই — placeholder values, তোমাকে বসাতে হবে।
