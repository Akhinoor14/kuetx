# KUETx — Mobile Optimisation Update

> **Build status:** ✅ Passing — zero errors  
> **Desktop:** সম্পূর্ণ অপরিবর্তিত  
> **Scope:** Mobile only (`≤768px`)

---

## কী সমস্যা ছিল?

Mobile-এ sidebar কাজ করত না। Hamburger icon চাপলে sidebar overlap করত, navigation কষ্টকর ছিল, আর কোনো quick access ছিল না। Mobile user experience একদম desktop-এর মতো ছিল — যেটা mobile-এর জন্য উপযুক্ত না।

---

## কী কী আপডেট করা হয়েছে

---

### 1. `src/components/BottomNav.jsx` — **নতুন ফাইল**

**কী করা হয়েছে:**
- Fixed bottom navigation bar তৈরি করা হয়েছে যেটা mobile screen-এর নিচে সবসময় দেখা যায়
- Dashboard সবসময় প্রথম tab হিসেবে pinned থাকে
- User তার পছন্দের ৩টি page আলাদাভাবে select করে bottom bar-এ রাখতে পারে
- শেষ slot-এ "More" button — চাপলে সব page-এর full drawer খোলে
- Alert badge — যদি কোনো critical alert বা warning থাকে, More button-এ সংখ্যা দেখায়
- Active tab-এ উপরে accent color-এর indicator line দেখায়
- User-এর favourite selection IndexedDB-তে save হয়, app reload করলেও থাকে

**`AllPagesDrawer` (একই ফাইলে):**
- "More" চাপলে নিচ থেকে একটি sheet উঠে আসে (bottom sheet)
- সব ৩০টি page, section অনুযায়ী ভাগ করা, 3-column icon grid-এ দেখায়
- "Edit Tabs" button চাপলে edit mode — যেকোনো page tap করলে bottom bar-এ যোগ বা বাদ হয়
- Dashboard সবসময় locked — সরানো যাবে না (lock icon দিয়ে দেখানো আছে)
- Max ৩টি page select করা যাবে (Dashboard ছাড়া), তারপর disabled হয়ে যায়
- Selected page গুলোতে blue dot ও checkmark দেখায়
- Navigation করলে drawer automatically বন্ধ হয়ে যায়

**`useBottomNavFavourites` hook (একই ফাইলে):**
- Default favourites: `attendance`, `marks`, `schedule` — প্রথমবার ব্যবহারের জন্য
- `store.get` / `store.set` দিয়ে IndexedDB-তে persist করে

**কেন করা হয়েছে:**  
Sidebar mobile-এ কাজ করত না। Bottom navigation হলো mobile app-এর standard pattern (iOS / Android উভয়ই এটি follow করে)। Thumb-এর নাগালে থাকে, এক হাতে ব্যবহার করা যায়।

**এর effect:**
- Mobile-এ navigation দ্রুত ও সহজ হবে
- User নিজের most-used pages customise করতে পারবে
- New user-রা default টা দিয়েই শুরু করতে পারবে

---

### 2. `src/components/Navbar.jsx` — **আপডেট**

**কী পরিবর্তন করা হয়েছে:**
- Mobile-এ hamburger menu button সরিয়ে দেওয়া হয়েছে (sidebar দরকার নেই, bottom nav এসেছে)
- Mobile-এ logo বাম দিকে দেখায়
- Mobile-এ current page-এর নাম topbar-এর center-এ দেখায় (যেমন: "Attendance", "Results")
- Backup/Download icon mobile-এ hidden করা হয়েছে (Settings-এ accessible)
- Desktop-এ সব কিছু আগের মতোই — breadcrumb, theme toggle, bell, download

**কেন করা হয়েছে:**  
Hamburger button mobile-এ কোনো কাজের ছিল না যেহেতু bottom nav এসেছে। Page title center-এ রাখলে user সবসময় জানতে পারবে কোন page-এ আছে। Mobile topbar compact রাখতে কম important action গুলো লুকানো হয়েছে।

**এর effect:**
- Mobile topbar পরিষ্কার ও focused হবে
- User সবসময় current page জানতে পারবে
- Screen space বেশি content-এর জন্য পাবে

---

### 3. `src/pages/Dashboard.jsx` — **আপডেট**

**কী পরিবর্তন করা হয়েছে:**
- `useBottomNavFavourites` এবং `getAllNavItems` import করা হয়েছে
- `* as Icons` import যোগ করা হয়েছে (dynamic icon rendering-এর জন্য)
- Mobile-এ Dashboard-এর একদম উপরে একটি **Quick Access** section যোগ করা হয়েছে
  - User-এর selected favourite pages গুলো 4-column icon grid হিসেবে দেখায়
  - প্রতিটি icon tap করলে সরাসরি সেই page-এ যায়
  - Desktop-এ এই section সম্পূর্ণ hidden (`display: none`)

**কেন করা হয়েছে:**  
Dashboard হলো app-এর home। Mobile-এ Dashboard খুললেই সবচেয়ে দরকারি page গুলোতে one-tap access থাকা উচিত — bottom nav-এর বাইরেও।

**এর effect:**
- Dashboard home screen হিসেবে আরও functional হবে
- Favourite পরিবর্তন করলে Dashboard quick access-ও automatically আপডেট হবে

---

### 4. `src/App.jsx` — **আপডেট**

**কী পরিবর্তন করা হয়েছে:**
- `BottomNav` এবং `AllPagesDrawer` import যোগ করা হয়েছে
- `Layout` component-এ `allPagesOpen` state যোগ করা হয়েছে
- `<BottomNav onOpenFavourites={...} />` render করা হয়েছে main content area-র শেষে
- `<AllPagesDrawer open={...} onClose={...} />` render করা হয়েছে

**কেন করা হয়েছে:**  
BottomNav ও Drawer সব page-এ কাজ করার জন্য Layout-level-এ রাখা দরকার ছিল।

**এর effect:**
- যেকোনো page থেকে bottom nav ও drawer accessible থাকবে

---

### 5. `src/index.css` — **আপডেট**

**কী যোগ করা হয়েছে (+183 lines):**

```
Bottom nav styles         → .bottom-nav, .bottom-nav-tab, .bottom-nav-tab.active
Active indicator          → ::before pseudo-element (accent line উপরে)
All pages drawer          → .all-pages-drawer, .all-pages-drawer.open
Drawer animation          → translateY(100%) → translateY(0), cubic-bezier transition
Dashboard quick access    → .dashboard-mobile-quickaccess, .dashboard-quickaccess-item, .dashboard-quickaccess-icon
Small screen adjustments  → @media (max-width: 400px) icon size reduction
iOS safe area support     → env(safe-area-inset-bottom, 0px) — notch/home bar-এর জন্য
Page bottom padding       → .main-content { padding-bottom: calc(70px + safe-area) }
Tap highlight removal     → -webkit-tap-highlight-color: transparent
```

**কেন করা হয়েছে:**  
প্রতিটি style mobile-এর জন্য আলাদা `@media (max-width: 768px)` block-এর মধ্যে রাখা হয়েছে। Desktop-এর কোনো existing style touch করা হয়নি।

**এর effect:**
- iPhone-এর home indicator-এর উপরে content চলে যাবে না
- Page content bottom nav-এর নিচে ঢাকা থাকবে না
- Smooth drawer animation থাকবে

---

## যা পরিবর্তন হয়নি

| যা ছিল | এখনও আছে |
|---|---|
| Desktop sidebar | সম্পূর্ণ একই |
| Desktop navbar/topbar | সম্পূর্ণ একই |
| সব 30টি page-এর content | একটিও পরিবর্তন হয়নি |
| Store / IndexedDB logic | একটিও পরিবর্তন হয়নি |
| Theme system (Light/Milky/Dark) | একই |
| PWA / service worker | একই |
| সব existing CSS | নতুন block append করা হয়েছে, পুরনোটা ছোঁয়া হয়নি |

---

## ভবিষ্যতে যা করা যায়

- [x] `BottomNav`-এ swipe gesture দিয়ে drawer open করা (touch event)
- [x] Favourite drag-and-drop reorder (edit mode-এ)
- [x] Bottom nav-এ individual page-এর notification badge (শুধু alerts-এর জন্য নয়)
- [x] Bundle splitting (Vite `manualChunks`) — বর্তমান bundle split করা
- [ ] CE, CSE, Arch, TE, BECM, ChE department-এর curriculum data manually import করা

> Note: curriculum import workflow-এর placeholder stubs প্রস্তুত আছে; real syllabus/data তুমি manually paste/import করবে।

---

## File Summary

| File | Status | Lines changed |
|---|---|---|
| `src/components/BottomNav.jsx` | ✅ Updated | swipe, drag reorder, per-tab badges |
| `src/components/Navbar.jsx` | ✅ Updated | mobile hamburger removed |
| `src/pages/Dashboard.jsx` | ✅ Updated | mobile quick access |
| `src/App.jsx` | ✅ Updated | bottom nav and drawers wired |
| `src/index.css` | ✅ Updated | bottom nav, drawer, badge, drag styles |
| `src/data/curriculum/departments/index.js` | ✅ Updated | placeholder departments registered |

---

*KUETx — Student Life OS for KUET · v3.2 · 100% offline · সব data locally stored*
