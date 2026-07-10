# Push Notification (FCM) Setup — Phase E

এই phase-এর client অংশ (SW, permission banner, token save) zip-এ আছে এবং
কাজ করবে যদি নিচের সার্ভার/কনসোল সেটআপগুলো করা হয় — এগুলো শুধু zip এডিট
করে সম্ভব না, প্রজেক্ট-owner-কে (Firebase Console + deploy access) করতে হবে।

## ১. Firebase Console — Cloud Messaging enable
Firebase Console → Project Settings → Cloud Messaging ট্যাবে যাও।
"Web Push certificates" সেকশনে একটা key pair generate করো (যদি আগে থেকে
না থাকে)। ঐ key-টাই VAPID key।

## ২. `.env`-এ VAPID key যোগ করো
```
VITE_FIREBASE_VAPID_KEY=<the key pair value from step 1>
```
(বাকি `VITE_FIREBASE_*` env var গুলো আগে থেকেই আছে, নতুন করে লাগবে না।)

## ৩. `public/firebase-messaging-sw.js`-এ config বসাও
এই ফাইলে `REPLACE_WITH_...` placeholder গুলো তোমার আসল Firebase project
config দিয়ে replace করো (src/lib/firebase.js-এ যে config আছে, সেটাই —
service worker `import.meta.env` পড়তে পারে না বলে হার্ডকোড করতে হয়)।

## ৪. Firestore rules — `users/{uid}.fcmTokens` write allow করো
বর্তমান `firestore.rules`-এ user নিজের doc-এ write করতে পারে কিনা চেক করে
নাও; `fcmTokens` field-এর জন্য আলাদা কিছু লাগার কথা না যদি ইতিমধ্যে
`request.auth.uid == uid` হলে নিজের `users/{uid}` write করতে পারে। যদি
rules খুব strict (field-level allowlist) হয়, তাহলে `fcmTokens` field
allow করতে rules-এ এক লাইন যোগ করতে হবে — এটা zip-এ touch করা হয়নি,
কারণ rules ফাইল এই zip-এ পাঠানো হয়নি।

## ৫. Cloud Functions deploy করো
```
cd functions
npm install
firebase deploy --only functions
```
এটা `firebase-tools` CLI + প্রজেক্টের উপর deploy permission লাগবে।
`functions/index.js`-এ দুইটা trigger আছে:
- `onGlobalNoticeCreate` — root `notices/{id}` (admin broadcast হলে)
- `onGroupNoticeCreate` — `groups/{groupId}/notices/{id}` (CR/ACR notice হলে)

দুটোই সংশ্লিষ্ট audience-এর `fcmTokens` টেনে push পাঠায়, invalid token
পেলে সেগুলো user doc থেকে মুছেও দেয়।

## ৬. iOS Safari সীমাবদ্ধতা
iOS Safari-তে push কাজ করবে শুধু app টা "Add to Home Screen" দিয়ে PWA
হিসেবে install করা থাকলে (iOS 16.4+)। ব্রাউজার ট্যাবে খোলা অবস্থায় iOS-এ
push আসবে না — এটা Apple-এর platform সীমাবদ্ধতা, code দিয়ে বাইপাস করার
উপায় নেই। Android ও Desktop Chrome/Firefox/Edge-এ ব্রাউজার ট্যাবেই কাজ
করবে, install লাগবে না।

## Client অংশ যা ইতিমধ্যেই zip-এ আছে (কাজ করবে সেটাপের পর)
- `public/firebase-messaging-sw.js` — background push handler
- `src/lib/push.js` — token fetch/save/remove, permission state
- `src/components/PushPermissionBanner.jsx` — soft in-app ask (Allow/Not
  now), native browser prompt তখনই ট্রিগার হয় যখন ইউজার "Allow"-এ ক্লিক
  করে
- `src/App.jsx` — banner mount করা হয়েছে (post-onboarding, শুধু signed-in
  + complete-profile ইউজারদের জন্য)
