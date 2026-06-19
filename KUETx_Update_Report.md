# KUETx — Full Update & Fix Report
> Compiled from multi-session conversation history  
> Project: KUETx PWA (React + Vite + IndexedDB)

---

## 📋 Table of Contents

1. [Money Page — Full Overhaul](#1-money-page--full-overhaul)
2. [Money Page — Export Format (CSV → TXT)](#2-money-page--export-format-csv--txt)
3. [Money Page — Add Expense Form Fixes](#3-money-page--add-expense-form-fixes)
4. [Money Page — Modal z-index Fix](#4-money-page--modal-z-index-fix)
5. [Google Drive Sync — Architecture & Implementation](#5-google-drive-sync--architecture--implementation)
6. [Sidebar & BottomNav — Drive Status Badge](#6-sidebar--bottomnav--drive-status-badge)
7. [Results Page — Grade Points Bug Fix](#7-results-page--grade-points-bug-fix)
8. [Results Page — Ongoing Term Dropdown Disabled](#8-results-page--ongoing-term-dropdown-disabled)
9. [Results Page — Credit String Bug (Y2T2.js)](#9-results-page--credit-string-bug-y2t2js)
10. [Results Page — curriculumStore.js Defensive Fix](#10-results-page--curriculumstorejs-defensive-fix)
11. [Results Page — CGPA Card Mobile Layout Fix](#11-results-page--cgpa-card-mobile-layout-fix)
12. [Attendance Page — Combined Mode Fixes](#12-attendance-page--combined-mode-fixes)
13. [Attendance Page — Card Compaction](#13-attendance-page--card-compaction)
14. [Schedule Page — Edit Exams Modal Bug](#14-schedule-page--edit-exams-modal-bug)
15. [Extras Pages — Full Overhaul Plan (Tours, Projects, Tuition, Social, Food, Reports)](#15-extras-pages--full-overhaul-plan)
16. [CSS — Missing .stat-mini & .filter-tab Classes](#16-css--missing-stat-mini--filter-tab-classes)

---

## 1. Money Page — Full Overhaul

**ফাইল:** `src/pages/Money.jsx`  
**ধরন:** 🚀 New Features + 🐛 Bug Fixes

### কী কী সমস্যা ছিল
- Date parsing bug: `new Date("2025-01-15")` UTC midnight হিসেবে parse করত, BD timezone-এ off-by-one দেখাত
- `expenses.slice(0, 30)` — date filter না, array index দিয়ে কাটত; সঠিক month-এর data miss হত
- Form validation silent ছিল — amount empty থাকলে কোনো feedback নেই

### কী কী নতুন যোগ হয়েছে
| Feature | বিবরণ |
|---|---|
| Starting cash balance | Wallet button দিয়ে setup, net balance-এ count হয় |
| Income tracking | Income/Expense toggle + আলাদা income categories (Scholarship, Family, Freelance, Part-time, Sell) |
| Net Balance banner | Cash + income − expense = real-time balance |
| Month switcher | ← → দিয়ে যেকোনো past month দেখা যায় |
| Monthly budget + progress bar | 90%+ হলে warning দেখায় |
| Edit entry | Delete-এর পাশে Edit button |
| Daily line chart | Income vs Expense দিনে দিনে |
| Tab filter | All / Income / Expense |
| Category chips | Tap করে filter |
| Month-over-month delta | "↑ ৳800 vs last month" |
| CSV export (পরে TXT-এ রূপান্তর) | Download button |

### Bug fixes যা apply হয়েছে
- Date parsing: `new Date(date + 'T00:00:00')` দিয়ে local timezone force
- `slice(0,30)` সরিয়ে proper date-based grouping
- Form validation-এ inline error message

---

## 2. Money Page — Export Format (CSV → TXT)

**ফাইল:** `src/pages/Money.jsx`  
**ধরন:** ✨ Feature Change

### সিদ্ধান্ত
CSV export সরিয়ে plain text (`.txt`) memo format দিয়ে replace করা হয়েছে।

**কারণ:** CSV হলো data, কিন্তু student-দের দরকার memo — যেটা WhatsApp, Telegram, Gmail সব জায়গায় directly readable, কোনো app ছাড়াই।

### Output format
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MONEY REPORT — JUNE 2025
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Income   : +৳12,000
  Expense  :  ৳8,450
  Net      : +৳3,550

  Top Expenses
  ────────────────────────────────────────
  Meal/Food           ৳    3,200
  Transport           ৳    1,800

  Transactions
  ────────────────────────────────────────

  Fri, 14 Jun
    −৳      120  Meal/Food
    −৳       80  Transport      (rickshaw)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  18 entries  |  Generated 19 June 2025
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**File name format:** `money-report_june-2025.txt`

---

## 3. Money Page — Add Expense Form Fixes

**ফাইল:** `src/pages/Money.jsx`  
**ধরন:** 🐛 Bug Fix + ✨ UX Improvement

### সমস্যা ছিল
- `form-row-3` (Date + Category + Amount তিনটা একসাথে) modal-এর ভেতরে `maxWidth: 480` হওয়ায় single column-এ যাচ্ছিল না → mobile-এ খুব ছোট হয়ে যাচ্ছিল
- Amount field-এ `inputMode="decimal"` ছিল না — mobile-এ number keyboard আসত না
- Income/Expense type toggle-এ শুধু arrow symbol, color distinction ছিল না
- Save button-এ Enter key কাজ করত না
- Delete button-এ accidental tap-এ confirm ছিল না
- Category chips ছিল না — শুধু select dropdown

### যা fix করা হয়েছে
- Form layout: `form-row-3` বদলে smart 2-column grid (Amount বড় করে)
- Amount-এ `inputMode="decimal"` যোগ
- Type toggle-এ color: income → green, expense → red
- Enter key দিয়ে save কাজ করে
- Amount field-এ auto-focus যখন modal খোলে
- Delete button-এ confirm dialog
- Category chips — select-এর বদলে tappable chips (mobile friendly)
- Drag handle — bottom sheet-এ উপরে handle bar
- Today — component render-এ fixed, stale date bug fix
- Setup form-এ `inputMode="decimal"`

---

## 4. Money Page — Modal z-index Fix

**ফাইল:** `src/pages/Money.jsx`  
**ধরন:** 🐛 Bug Fix

### সমস্যা
Modal overlay-এর `zIndex: 100` — কিন্তু bottom nav-এর `z-index: 3500`, তাই mobile-এ modal bottom nav-এর নিচে চলে যাচ্ছিল।

### Fix
```jsx
// Money.jsx — modal overlay style-এ
zIndex: 4000  // was 100
```

---

## 5. Google Drive Sync — Architecture & Implementation

**নতুন ফাইলসমূহ:**
- `src/lib/driveSync.js` — Auth, upload, download logic
- `src/components/DriveConnectButton.jsx` — Reusable connect/disconnect button

**পরিবর্তিত ফাইলসমূহ:**
- `src/pages/Settings.jsx` — Drive Sync card section যোগ
- `src/components/ProfileSetupModal.jsx` — Step 2-এ optional Drive connect
- `src/components/Sidebar.jsx` — Bottom-এ Drive status badge
- `src/components/BottomNav.jsx` — Menu panel-এ Drive badge

### Architecture
- প্রতিটি user-এর data **তার নিজের Google Drive-এ** যায় (KUETx server-এ কিছু না)
- Scope: `drive.file` — শুধু KUETx-এর নিজের files, user-এর বাকি Drive-এ access নেই
- Token localStorage-এ device-specific

### User workflow
```
প্রথমবার:
  Settings → "Connect Google Drive"
  → Google OAuth popup → Allow
  → "KUETx Backup" folder Drive-এ তৈরি
  → First backup upload ✅

Daily:
  Data change → 24h debounce → background upload
  User কিছু করে না

নতুন device:
  Settings → "Restore from Drive"
  → Google login → latest backup fetch
  → সব data back ✅
```

### Settings page-এ Drive card layout
```
☁️ Google Drive Sync
[Connect Google Drive]          ← connected না হলে
✅ Connected: user@gmail.com   ← connected হলে
Last backup: today
[Backup Now] [Restore] [Disconnect]
```

### ⚠️ Security Note
Conversation-এ Client ID publicly share হয়ে গিয়েছিল — `console.cloud.google.com` থেকে rotate করতে বলা হয়েছে।  
`.env` file-এ রাখার নিয়ম:
```
VITE_GOOGLE_CLIENT_ID=your_client_id_here
```

---

## 6. Sidebar & BottomNav — Drive Status Badge

**ফাইল:** `src/components/Sidebar.jsx`, `src/components/BottomNav.jsx`  
**ধরন:** ✨ New Feature

### Sidebar-এ
Footer-এ (যেখানে "KUETx v3.2 · All data stored locally" লেখা) এখন:
- Connected হলে: `☁️ Drive · 2h ago`
- না হলে: `☁️ Connect Drive` → click করলে Settings-এ নেয়

### BottomNav Menu panel-এ
Settings card-এর উপরে Drive status badge:
- `☁️ Backup: Drive connected` বা `⚠️ Backup: Not set up`

---

## 7. Results Page — Grade Points Bug Fix

**ফাইল:** `src/pages/Results.jsx`  
**ধরন:** 🐛 Bug Fix (Label + Logic)

### সমস্যা ছিল
```jsx
// আগে (ভুল):
<div>Total Mark Points</div>
<div>{term.totalCredits} / {courseCount * 4.0}</div>
```

- **Label:** "Total Mark Points" — misleading
- **Left side:** `term.totalCredits` (credit sum, যেমন 21.5) — কিন্তু দেখাচ্ছিল grade points
- **Right side:** `courseCount * 4.0` (course-count × 4, unit mismatch — apple vs orange comparison)

**ফলে দেখাচ্ছিল:** `12.5333 / 32` বা `20.75 / 40` — কোনো valid meaning নেই

### Fix
```jsx
// এখন (সঠিক):
<div>Grade Points</div>
<div>{term.pts.toFixed(2)} / {(term.totalCredits * 4.0).toFixed(2)}</div>
```

- `term.pts` = Σ(gradePoint × credits) for published courses — actually achieved grade points
- `term.totalCredits * 4.0` = credit-weighted max — meaningful denominator
- **Example output:** `76.63 / 82.00` → user বুঝতে পারে সম্ভাব্য সর্বোচ্চের কতটুকু পেয়েছে

---

## 8. Results Page — Ongoing Term Dropdown Disabled

**ফাইল:** `src/pages/Results.jsx`  
**ধরন:** 🐛 Bug Fix + ✨ UX

### সমস্যা
Ongoing term-এ grade upload dropdown-এ `alert()` ছিল, কিন্তু `disabled` attribute ছিল না — user click করতে পারছিল।

### Fix
Course table-এর `tbody` → `tr` শুরুতে:
```jsx
const isOngoingCourse = term.key === currentTermKey && currentTermIsOngoing;
```

তারপর উভয় select (Sessional + Theory)-এ:
```jsx
<select
  disabled={isOngoingCourse}
  title={isOngoingCourse ? 'Ongoing term — result upload disabled' : ''}
>
  <option value="">{isOngoingCourse ? 'Ongoing term' : 'Upload grade'}</option>
  {!isOngoingCourse && GRADE_SCALE.map(g => <option key={g.grade} value={g.grade}>{g.grade}</option>)}
</select>
```

**Changes:**
- `disabled={isOngoingCourse}` — browser level-এ click কাজ করে না
- `title` attribute — hover-এ message দেখায়
- Ongoing হলে option text → "Ongoing term", grade list hide

---

## 9. Results Page — Credit String Bug (Y2T2.js)

**ফাইল:** `src/data/Y2T2.js`, `src/store/curriculumStore.js`  
**ধরন:** 🐛 Critical Bug Fix

### Root Cause
`Y2T2.js`-এ URP 2292 course-এর credit value ছিল string:
```js
"credits": "3"   // ❌ string হওয়া উচিত নয়
```

JavaScript-এ `number + string` → string concatenation:
```js
12.5 + "3"  // = "12.53" ← math না, text জোড়া!
```

তাই reduce loop-এ একবার string credit আসলে পুরো sum গার্বেল হয়ে যাচ্ছিল। ফলে:
- "Total Mark Points" এ `12.5333` দেখাচ্ছিল (invalid)
- "Weighted Average" এ `6.30` দেখাচ্ছিল (4.0 scale-এ impossible)

### Fix 1 — Data file
```js
// Y2T2.js — URP 2292
"credits": 3   // ✅ number (quote সরানো)
```

### Fix 2 — curriculumStore.js (defensive, future-proof)
```js
// getTermCreditsFromCurriculum()
return sum + Number(course.credits || 0);  // Number() wrap

// buildCourseRecord()
const resolvedCredits = Number(optionalCourse?.credits ?? base.credits);
```

এখন যেকোনো department/term-এ কেউ ভুলে string credit দিলেও app crash বা garbled হবে না।

---

## 10. Results Page — curriculumStore.js Defensive Fix

**ফাইল:** `src/store/curriculumStore.js`  
**ধরন:** 🛡️ Defensive Fix

দুটো function-এ `Number()` wrap যোগ:

| Function | আগে | পরে |
|---|---|---|
| `getTermCreditsFromCurriculum` | `sum + (course.credits \|\| 0)` | `sum + Number(course.credits \|\| 0)` |
| `buildCourseRecord` | `resolvedCredits = optionalCourse?.credits ?? base.credits` | `resolvedCredits = Number(optionalCourse?.credits ?? base.credits)` |

---

## 11. Results Page — CGPA Card Mobile Layout Fix

**ফাইল:** `src/pages/Results.jsx`  
**ধরন:** 🐛 Bug Fix (Responsive)

### সমস্যা
"MAX POSSIBLE CGPA" card mobile-এ clip হয়ে "Ceilin" দেখাচ্ছিল ("Ceiling" না)। দুটো card unequal size-এ দেখাচ্ছিল।

### Root Causes
1. `gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)'` + `overflow: hidden` মিলে right card clip হচ্ছিল
2. `padding: 18px 20px` + `fontSize: 56` — mobile-এ অনেক বড়
3. Badge-এ `minWidth` না থাকায় কাটা যাচ্ছিল

### Fix
```jsx
// Container: grid → flex + nowrap
flexWrap: 'nowrap'

// প্রতিটা card
flex: '1 1 0'
minWidth: 0

// Responsive sizing — clamp()
fontSize: 'clamp(24px, 9vw, 48px)'
padding: 'clamp(10px, 3vw, 18px)'

// Badge
flexShrink: 0
whiteSpace: 'nowrap'
```

**Result:** দুই card সবসময় পাশাপাশি থাকবে, কোনো screen size-এ wrap বা clip হবে না।

---

## 12. Attendance Page — Combined Mode Fixes

**ফাইল:** `src/pages/Attendance.jsx`  
**ধরন:** 🐛 Bug Fix + ✨ UX

### সমস্যাসমূহ
1. **Card position jump:** Input দিলে attendance % বদলে যায়, sort re-runs হয়, card লাফ দেয় — jarring UX
2. **Input labels নেই:** Combined tab-এ দুটো number input পাশাপাশি — কোনটা Held, কোনটা Attended বোঝার উপায় নেই
3. **Mode toggle unclear:** User বুঝতে পারে না ON/OFF মানে কী
4. **"Miss up to 0 safely":** 0 absences left মানে কোনো miss করা যাবে না — কিন্তু "safely" শব্দটা misleading
5. **একটা card-এ একাধিক hint:** Contradictory signals (e.g. "miss 0" + "attend 2 more")
6. **Progress bar 100%-এ কোনো distinction নেই**

### যা fix করা হয়েছে

**Card position lock:**
```jsx
const stableOrder = useRef(null);
// first render-এ একবার sort, তারপর আর না
if (!stableOrder.current) stableOrder.current = sorted;
```

**Input labels:**
```
HELD    ATTENDED
[__]    [__]
```

**Mode toggle label:**
```
OFF → "Auto — calculated from Daily Log entries"
ON  → "Manual — enter Held & Attended per teacher"
```

**Hint priority (একটাই per card):**
```
Danger → No absences left → canMiss ≤ 2 → needNext → Top slab ✓
```

**"Miss up to 0 safely" fix:**
```
canMiss === 0 → "⚠ No absences left"
```

---

## 13. Attendance Page — Card Compaction

**ফাইল:** `src/pages/Attendance.jsx`  
**ধরন:** ✨ UX Improvement (Responsive)

### লক্ষ্য
Cards maximum column নেবে, minimum row — single tight row, desktop + mobile উভয়ে কাজ করবে।

### আগের layout
```
[Course Name]           [MARKS]
[EE 2113 · 3cr]         [30/30]   [98%]
[per teacher info]
[progress bar]
[slab badge row]
Height: ~95–110px
```

### নতুন layout
```
[Course Name]                    [%pill]
[EE 2113 · ≥90% · 41/42 · hint]
[████████████ 2px progress bar]
Height: ~52px (desktop), ~50px (mobile)
```

**Changes:**
- MARKS badge সরানো hero card থেকে
- `%pill` fixed `46×32px`
- Padding: `6px 9px` (আগে `7px 10px`)
- Card gap: `4px` (আগে `5px`)
- Sub-info: code · slab · count · hint — সব inline, muted
- Progress bar: 2px, flush
- Mobile-এও same layout (flex + ellipsis)

---

## 14. Schedule Page — Edit Exams Modal Bug

**ফাইল:** `src/store/store.js`  
**ধরন:** 🐛 Critical Bug Fix

### সমস্যা
Edit Exams button click করলে modal আসছিল না।

### Root Cause (chain of failure)
```
Edit Exams click
  → getTermTimeline(termStartDate, dept, termKey)
    → getDeptTerms(deptCode)  ← store.js-এ import নেই! ReferenceError throws
      → catch{} swallows error
        → return null
  → if (!timeline) return notify(...)  ← এখানে আটকে যায়
  → setEditingExams(true)  ← কখনো reach করে না
```

`getDeptTerms` ছিল `curriculumStore.js`-এ কিন্তু `store.js`-এ import ছিল না।

### Fix
`store.js` — `getTermTimeline()` function-এর ভেতরে:
```js
// REMOVE (3 lines):
const deptTerms = getDeptTerms(deptCode);
const coursesInTerm = deptTerms[termKey] || [];
const theoryCourses = coursesInTerm.filter(c => c.type === 'Theory').length;

// REPLACE with:
const theoryCourses = 5; // safe default fallback
```

**Result:** শুধু `store.js` এক জায়গায় change, আর কোনো file touch করতে হয়নি। Edit Exams modal এখন open হয়।

---

## 15. Extras Pages — Full Overhaul Plan

**ফাইল:** `src/pages/Extras.jsx`  
**ধরন:** 🚀 Major Feature Addition + 🐛 Bug Fix

TimeTracker আর Syllabus unchanged রেখে বাকি ৬টা page overhaul করা হয়েছে।

### Tours
| আগে | পরে |
|---|---|
| Basic list | Hero card: Total spent / Tours count / Over budget / Last trip |
| No budget tracking | Budget overspend badge (লাল) |
| Delete only | Edit + Delete |
| No filter | Filter by type (Solo/Friends/Family/Dept) |
| — | Spent vs budget progress bar per card |
| — | Type color-coded tags |

### Projects
| আগে | পরে |
|---|---|
| Name/Type/Status/Deadline only | Subtask checklist inline |
| No progress | Progress % from subtask completion (auto-calculated) |
| No overdue detection | Overdue badge (লাল) if deadline passed |
| — | Status filter tab: All / Active / Done / Paused |
| — | Type color-coded (Academic/Personal/Freelance) |

### Tuition
| আগে | পরে |
|---|---|
| Basic session log | Per-student summary card |
| No income chart | Monthly income bar chart (last 6 months) |
| — | Hourly rate display per session (fee ÷ hours) |
| — | Student name autocomplete |
| — | Net per session: fee − travel |
| — | Filter by student or subject |

### Social
| আগে | পরে |
|---|---|
| Last 15 logs only | All logs visible |
| No chart | 7-day bar chart (social hours per day) |
| — | Top companions ranking |
| — | Activity breakdown % (Adda 40%, Gaming 25%...) |
| — | Weekly vs monthly toggle |
| — | Edit log entries |
| Dead state `chartPeriod` | Removed |

### Food
| আগে | পরে |
|---|---|
| BMI reset on reload | BMI persisted to store (fixed) |
| No TDEE context | Activity level dropdown for better TDEE |
| No history | 7-day calorie history bar chart |
| Today only | Past-date meal logs visible |
| — | Calorie bar: green = under target, red = over |

### Reports
**সবচেয়ে বড় overhaul।**

| আগে | পরে |
|---|---|
| 4 buttons (Daily/Weekly/Monthly/Semester) same data download করত | Actual date-range filtering per period |
| No preview | In-page preview before download |
| Minimal content (~7 lines) | Attendance + expense breakdown + time + social included |
| Plain text | Box-drawing character formatted TXT |
| — | Copy-to-clipboard button |
| — | CSV export option |

**নতুন TXT format:**
```
╔══════════════════════════════════════════════╗
║         KUETx Weekly Report                  ║
║         June 13 – June 19, 2025              ║
╚══════════════════════════════════════════════╝

ACADEMIC
  Courses enrolled  :  6
  Attendance avg    :  78.3%

TIME & FOCUS
  Productive hours  :  18.5 h
  Focus ratio       :  75%

EXPENSES
  Total spent       :  ৳2,840
  Top category      :  Food (৳1,200)

──────────────────────────────────────────────
Generated by KUETx · kuetx.vercel.app
```

---

## 16. CSS — Missing .stat-mini & .filter-tab Classes

**ফাইল:** `src/index.css`  
**ধরন:** 🐛 Critical Bug Fix

### সমস্যা
`Extras.jsx`-এর ৬টা page-এ `.stat-mini` আর `.filter-tab` class use করা হয়েছিল, কিন্তু ৮১১৭ লাইনের `index.css`-এ এই দুটো class কোথাও ছিল না।

**ফলে:**
- Stat boxes: কোনো box/border/background নেই, শুধু ভাসমান text, অস্বাভাবিক বড় gap
- Filter tabs: "DailyWeeklyMonthlySemester" বা "All (0)Active (0)Done (0)" — কোনো button/pill style বা space ছাড়াই গাদাগাদি

**TimeTracker ভালো ছিল** কারণ সে নিজের `.time-tracker-*` classes use করে, shared classes-এর উপর depend করে না।

### Fix
`index.css`-এ missing classes যোগ করা হয়েছে — existing design tokens (`--accent`, `--border`, `--card`, `--muted`) use করে, যাতে app-এর বাকি অংশের সাথে consistent থাকে।

---

## Summary — পরিবর্তনের সারণী

| # | File | Action | Type |
|---|---|---|---|
| 1 | `Money.jsx` | Full overhaul (income, balance, chart, filter, month switch) | 🚀 Feature |
| 2 | `Money.jsx` | CSV → TXT memo export | ✨ Change |
| 3 | `Money.jsx` | Form UX fixes (inputMode, color, Enter, chips) | 🐛 Fix |
| 4 | `Money.jsx` | Modal z-index 100 → 4000 | 🐛 Fix |
| 5 | `driveSync.js` | NEW — Google Drive auth/upload/download | 🚀 New |
| 6 | `DriveConnectButton.jsx` | NEW — Reusable Drive connect UI | 🚀 New |
| 7 | `Settings.jsx` | Drive Sync card section | ✨ Feature |
| 8 | `ProfileSetupModal.jsx` | Step 2 optional Drive connect | ✨ Feature |
| 9 | `Sidebar.jsx` | Drive status badge at bottom | ✨ Feature |
| 10 | `BottomNav.jsx` | Drive status badge in menu | ✨ Feature |
| 11 | `Results.jsx` | Grade Points label + formula fix | 🐛 Fix |
| 12 | `Results.jsx` | Ongoing term dropdown disabled | 🐛 Fix |
| 13 | `Results.jsx` | CGPA card mobile clip fix (clamp + nowrap) | 🐛 Fix |
| 14 | `Y2T2.js` | Credit "3" string → 3 number | 🐛 Fix |
| 15 | `curriculumStore.js` | Number() defensive wrap in 2 functions | 🛡️ Defensive |
| 16 | `Attendance.jsx` | Card position lock (stableOrder useRef) | 🐛 Fix |
| 17 | `Attendance.jsx` | Held/Attended input labels | ✨ UX |
| 18 | `Attendance.jsx` | Mode toggle clarified label text | ✨ UX |
| 19 | `Attendance.jsx` | Hint priority (single hint per card) | 🐛 Fix |
| 20 | `Attendance.jsx` | "Miss up to 0 safely" → "⚠ No absences left" | 🐛 Fix |
| 21 | `Attendance.jsx` | Card compaction (~52px height, 2px bar) | ✨ UX |
| 22 | `store.js` | getDeptTerms missing → theoryCourses = 5 fallback | 🐛 Fix |
| 23 | `Extras.jsx` | Tours full overhaul | 🚀 Feature |
| 24 | `Extras.jsx` | Projects + subtask checklist overhaul | 🚀 Feature |
| 25 | `Extras.jsx` | Tuition + student summary + chart | 🚀 Feature |
| 26 | `Extras.jsx` | Social + 7-day chart + companions ranking | 🚀 Feature |
| 27 | `Extras.jsx` | Food + BMI persist + TDEE + history | 🐛+🚀 |
| 28 | `Extras.jsx` | Reports + real filtering + rich TXT format | 🐛+🚀 |
| 29 | `index.css` | `.stat-mini` + `.filter-tab` classes added | 🐛 Fix |

---

*Generated from KUETx multi-session conversation history — June 2025*
