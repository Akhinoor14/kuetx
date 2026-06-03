# 🚀 Auto-Split CSS Guide - One Command Setup

আপনার **202 KB** CSS ফাইল এক কমান্ডে স্বয়ংক্রিয়ভাবে ভাগ করে ফেলুন!

---

## ✅ তিনটি সহজ ধাপ

### **ধাপ 1: ফোল্ডার স্ট্রাকচার তৈরি করুন (2 মিনিট)**

```powershell
.\scripts\setup-css-structure-v2.ps1
```

এটি এই স্ট্রাকচার তৈরি করবে:
```
src/styles/
├── base/                  (reset, themes, typography)
├── components/            (buttons, cards, inputs, tags, modal, progress, nav)
├── pages/                 (auto-populated by next step)
├── utils/                 (animations, layout, pwa)
└── index.css              (imports only)
```

### **ধাপ 2: স্বয়ংক্রিয় CSS বিভাজন (5 মিনিট)**

```powershell
python scripts/auto-split-css.py
```

**এটি করবে:**
- ✅ আপনার `src/index.css` পড়বে
- ✅ সব rules স্বয়ংক্রিয়ভাবে category করবে:
  - `.dashboard-*` → `pages/dashboard.css`
  - `.courses-*` → `pages/courses.css`
  - `.btn-*` → `components/buttons.css`
  - `@keyframes` → `utils/animations.css`
  - ইত্যাদি
- ✅ Duplicates সরিয়ে দেবে
- ✅ সব ফাইল তৈরি করবে
- ✅ নতুন `index.css` আপডেট করবে সব imports সহ

**আউটপুট দেখাবে:**
```
📖 Reading src/index.css...
   ✅ Read 202002 bytes

🔍 Parsing CSS rules...
   📊 Found 847 rules
   ⚠️  Removed 23 duplicate rules

📝 Generating CSS files...
   ✅ base/reset.css (1248 bytes)
   ✅ base/themes.css (2156 bytes)
   ✅ base/typography.css (892 bytes)
   ✅ components/buttons.css (2341 bytes)
   ✅ components/cards.css (1567 bytes)
   ... (আরো ফাইল)
   ✅ pages/dashboard.css (8942 bytes)
   ✅ pages/courses.css (6234 bytes)
   ... (সব পেজ)

📊 SUMMARY
======================================================
Original CSS size:   202,002 bytes
New total size:      198,456 bytes
Files created:       42
Compression ratio:   1.8% better

✅ NEXT STEPS
1. Review generated files in src/styles/
2. Run: npm run build
3. Test in browser: npm run dev
```

### **ধাপ 3: টেস্ট এবং যাচাই (3 মিনিট)**

```powershell
npm run build
npm run dev
```

ব্রাউজারে যান: http://localhost:5173

সব পেজ চেক করুন:
- ✅ ডেশবোর্ড
- ✅ কোর্সেস
- ✅ এটেন্ডেন্স
- ✅ মার্কস
- ✅ মোবাইল ভিউ (< 640px)
- ✅ ট্যাবলেট ভিউ (640-1024px)
- ✅ ডেস্কটপ ভিউ (> 1024px)

সবকিছু ঠিক থাকলে:
```powershell
# পুরানো backup ফাইল রাখুন (optional)
Rename-Item src/index.css src/index.css.backup
```

---

## 🎯 কী হচ্ছে Script এর মধ্যে?

### **Parsing:**
```
src/index.css (202 KB)
    ↓
Parser reads line by line
    ↓
Detects CSS rules {}
```

### **Categorization:**
```
Rule: .dashboard-grid { ... }
  → Pattern match: .dashboard-
  → Category: pages/dashboard.css

Rule: .btn-primary { ... }
  → Pattern match: .btn-
  → Category: components/buttons.css

Rule: @keyframes fadeIn { ... }
  → Pattern match: @keyframes
  → Category: utils/animations.css
```

### **Deduplication:**
```
Found: .btn-primary { ... }
Found: .btn-primary { ... } (duplicate)
  → Keep first, remove second
```

### **Output:**
```
src/styles/
├── base/reset.css
├── base/themes.css
├── components/buttons.css
├── pages/dashboard.css
├── pages/courses.css
└── index.css (আপডেট করা)
```

---

## 📊 ফলাফল দেখাবে এমন:

**Before:**
```
src/
├── index.css  (202 KB) ❌
└── (সব mixed)
```

**After:**
```
src/styles/
├── base/
│   ├── reset.css      (1.2 KB)
│   ├── themes.css     (2.1 KB)
│   └── typography.css (0.8 KB)
├── components/
│   ├── buttons.css    (2.3 KB)
│   ├── cards.css      (1.5 KB)
│   ├── inputs.css     (1.8 KB)
│   ├── tags.css       (0.9 KB)
│   ├── modal.css      (1.2 KB)
│   ├── progress.css   (0.7 KB)
│   └── nav.css        (1.6 KB)
├── pages/
│   ├── dashboard.css     (8.9 KB)
│   ├── courses.css       (6.2 KB)
│   ├── attendance.css    (4.5 KB)
│   ├── marks.css         (7.1 KB)
│   └── ... (26+ more)
├── utils/
│   ├── animations.css (2.1 KB)
│   ├── layout.css     (1.4 KB)
│   └── pwa.css        (0.8 KB)
└── index.css (updated - 3 KB) ✅
```

---

## 🔍 Script কী Detect করে?

### **Page-Specific Selectors:**
```
.dashboard-*        → pages/dashboard.css
.courses-*          → pages/courses.css
.attendance-*       → pages/attendance.css
.marks-*            → pages/marks.css
.assignments-*      → pages/assignments.css
.schedule-*         → pages/schedule.css
... (26+ pages)
```

### **Component Selectors:**
```
.btn-*              → components/buttons.css
.card-*             → components/cards.css
.input-*, .form-*   → components/inputs.css
.tag-*, .badge-*    → components/tags.css
.modal-*, .drawer-* → components/modal.css
.progress-*         → components/progress.css
.nav-*, .navbar-*   → components/nav.css
```

### **Utility/Base:**
```
:root               → base/themes.css
@keyframes          → utils/animations.css
h1, p, text         → base/typography.css
html, body, *       → base/reset.css
.container, .grid   → utils/layout.css
.pwa-*, .install-*  → utils/pwa.css
```

---

## ⚠️ গুরুত্বপূর্ণ নোট

### **Python ইনস্টলেশন**

Windows 11 তে Python সাধারণত ইতিমধ্যে থাকে। যদি না থাকে:

**অপশন 1: Windows Store থেকে (সহজতম)**
```powershell
# PowerShell খুলুন (Admin)
irm https://github.com/ps-extensions/python/releases/download/v3.11.0/install.ps1 | iex
```

**অপশন 2: Direct থেকে**
```powershell
# PowerShell এ
python --version
# যদি কাজ না করে, python.org থেকে ডাউনলোড করুন
```

**অপশন 3: Verify করুন**
```powershell
# ইতিমধ্যে আছে কিনা চেক করুন
python --version
# Output: Python 3.x.x
```

### **Script টেস্ট করুন**
```powershell
# প্রথমে একটু দেখুন
python scripts/auto-split-css.py --help

# তারপর রান করুন
python scripts/auto-split-css.py
```

---

## 🎨 Mobile-First Approach (গুরুত্বপূর্ণ!)

Script সব media queries preserve করে। এখানে example:

```css
/* pages/dashboard.css */

/* Mobile defaults (< 640px) - NO media query needed */
.dashboard-grid {
  grid-template-columns: 1fr;
  padding: 12px;
}

/* Tablet (640px - 1023px) */
@media (min-width: 640px) {
  .dashboard-grid {
    grid-template-columns: repeat(2, 1fr);
    padding: 16px;
  }
}

/* Desktop (> 1024px) */
@media (min-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: repeat(3, 1fr);
    padding: 20px;
  }
}
```

---

## 📋 Quality Checklist

After script completes:

- [ ] `npm run build` সফলভাবে চলে
- [ ] কোনো CSS errors নেই
- [ ] সব পেজ ঠিকঠাক দেখা যায়
- [ ] মোবাইল লেআউট কাজ করে
- [ ] ডেস্কটপ লেআউট কাজ করে
- [ ] `src/styles/index.css` শুধু @import দিয়ে ভরা
- [ ] কোনো large CSS file নেই (max 10 KB)

---

## 🚀 এখনই শুরু করুন!

```powershell
# 1. Setup
.\scripts\setup-css-structure-v2.ps1

# 2. Auto-split
python scripts/auto-split-css.py

# 3. Test
npm run build && npm run dev

# ✅ Done!
```

**মাত্র ৩টি কমান্ড এবং আপনার CSS সংগঠিত!** ✨

---

## 📞 Troubleshooting

### **Python not found?**
```powershell
# Check if Python is installed
python --version

# If not, install from python.org or use Windows Store
# Then restart PowerShell
```

### **Script fails?**
```powershell
# Try with full path
python C:\path\to\scripts\auto-split-css.py

# Or check for syntax errors
python -m py_compile scripts/auto-split-css.py
```

### **CSS not working after?**
```powershell
# Check if index.css exists and has imports
Get-Content src/styles/index.css | head -20

# Check if build includes CSS
npm run build
# Look for CSS file in dist/

# If issue, restore backup
Rename-Item src/styles/index.css src/styles/index.css.broken
Rename-Item src/index.css.backup src/index.css
```

---

**আর দেরি না করে শুরু করুন!** 🎯

```powershell
.\scripts\setup-css-structure-v2.ps1
python scripts/auto-split-css.py
npm run build
npm run dev
```

Happy organizing! 🎉
