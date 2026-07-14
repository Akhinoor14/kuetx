# QuestionBankSolutions — Master Plan
> **Single source of truth:** Analysis + Upgrade Plan + Visual Design + Mobile/Desktop Layout + Math Course Specifics  
> **JSON Sources:** CSE2113 (2018–2023) + FLUID Mechanics (2018–2023) — 12 files, ~300+ questions  
> **Courses covered:** Programming (MATLAB/Python), Theory, Numerical — এবং FLUID-এর মতো derivation-heavy mathematical courses

---

## Table of Contents

1. [Current State — What It Does](#1-current-state)
2. [All Problems — What's Wrong or Missing](#2-all-problems)
3. [Visual Design — How It Should Look](#3-visual-design)
4. [Mobile & Desktop Layout Plan](#4-mobile--desktop-layout)
5. [Math & Derivation Course Specifics (FLUID etc.)](#5-math--derivation-course-specifics)
6. [Upgrade Plan — What to Change and How](#6-upgrade-plan)
7. [Before vs After](#7-before-vs-after)
8. [Implementation Order](#8-implementation-order)

---

## 1. Current State

### Architecture
- Single-file React component (~970 lines)
- Inline style objects (no Tailwind, no CSS modules)
- System-preference dark/light theme via `useSystemTheme()`
- KaTeX for math rendering (lazy-loaded)
- 5 views: `home → courses → years → solutions → all`
- Data fetched from `/solutions/{DEPT}/{TERM}/{COURSE}/{YEAR}.json`

### Features Present

| Feature | Status |
|---|---|
| Dark / Light theme (system) | ✅ |
| KaTeX math rendering (`$` and `$$`) | ✅ |
| Fenced code blocks (MATLAB / Python tabs) | ✅ |
| Markdown table rendering | ✅ |
| Bullet / numbered / prose / equation block parsing | ✅ |
| Inline backtick code rendering | ✅ |
| Bengali explanation section | ✅ |
| Search (per-year + all-years) | ✅ basic |
| Filter by year + type (all-years view) | ✅ basic |
| "All years combined" view | ✅ |
| Breadcrumb navigation | ✅ |
| Year probing via HEAD requests | ✅ |
| Responsive grid layouts | ✅ basic |

### JSON Data Fields Used
```
id, question, type, short_answer, detailed_answer,
explanation_bn, matlab, python, _year (injected)
```

---

## 2. All Problems

### 2.1 UX / Navigation

| # | Problem | Impact |
|---|---|---|
| P1 | No expand/collapse on QuestionCard — every card always fully open | Page extremely long with 25+ questions |
| P2 | No scroll-to-top or sticky nav when reading long question lists | Users lose context scrolling through 30-question papers |
| P3 | No question number jump (e.g., "Go to Q12") | Hard to navigate directly to a known question |
| P4 | `view='home'` and `view='courses'` are nearly identical, redundant step | Extra click to get to years |
| P5 | Year cards show only "AVAILABLE" — no question count | Can't compare papers at a glance |
| P6 | "All years combined" loads ALL years at once, no pagination | Loading 300+ questions freezes UI on slow connections |
| P7 | No browser back button support — all navigation is internal state | Browser back breaks the app; URL never changes |

### 2.2 Search

| # | Problem | Impact |
|---|---|---|
| S1 | Search only checks `question` + `short_answer` — not `detailed_answer` or `explanation_bn` | Misses results in solution body |
| S2 | No search result highlighting | Hard to spot why a result appeared |
| S3 | Search clears on every view change | Annoying when switching views |
| S4 | No debounce — filters on every keystroke | Performance hit with 300+ questions |

### 2.3 Code Block

| # | Problem | Impact |
|---|---|---|
| C1 | No syntax highlighting — plain monospace only | MATLAB/Python code hard to read |
| C2 | No copy-to-clipboard button | Students must manually select code |
| C3 | `maxHeight: 400` with no expand — long code silently cut off | Critical code hidden with no indicator |
| C4 | Language detection only `python` vs everything else | Fragile for other languages |

### 2.4 Math Rendering

| # | Problem | Impact |
|---|---|---|
| M1 | KaTeX loaded async per `MathSpan` render — causes flash/layout shift | Jarring on first load |
| M2 | No error state UI if KaTeX fails — falls back to raw LaTeX string | Confusing raw text visible to users |
| M3 | `isMathLine()` heuristic applies math font to non-math content sometimes | Wrong font on plain text lines |
| **M4** | **Derivation steps in FLUID questions render as a single block** | **No visual separation between "Given → Find → Solution → Result" — very hard to follow a derivation** |
| **M5** | **Long equation chains (e.g. Navier-Stokes) overflow on mobile horizontally** | **Equations cut off, students can't read the full expression** |
| **M6** | **No "step number" indicator for multi-step derivations** | **Can't tell which step you're on in a 10-step derivation** |

### 2.5 Architecture / Code Quality

| # | Problem | Impact |
|---|---|---|
| A1 | Everything in one 970-line file | Hard to maintain or test |
| A2 | `AVAILABLE_SOLUTIONS` hardcoded inside component | Adding new course requires editing JSX |
| A3 | Inline style objects defined inside render — recreated every render | Minor perf issue; makes theming messy |
| A4 | `QuestionCard` not memoized — re-renders all cards on any state change | Performance degrades with many cards |
| A5 | No URL routing | Can't share a link to specific question/year |
| A6 | `useSystemTheme()` only — no manual toggle | Users can't override system preference |

### 2.6 Missing Features (High Value)

| # | Missing Feature | Why It Matters |
|---|---|---|
| F1 | **Bookmark / Save questions** | Students mark important questions for revision |
| F2 | **Print / Export to PDF** | Common student workflow |
| F3 | **Question frequency heatmap** | Most valuable exam-prep analysis |
| F4 | **Similar questions across years** | "This appeared in 2019, 2021, 2022" |
| F5 | **Progress tracking** — mark as "reviewed" | Helps track study progress |
| F6 | **Font size control** | Accessibility on small screens |
| F7 | **Manual dark/light toggle** | System preference isn't always right |
| F8 | **Keyboard shortcuts** | Power user navigation |
| **F9** | **"Derivation mode" view for FLUID-type questions** | **Step-by-step expandable derivation with equation numbering** |
| **F10** | **Formula reference panel** | **Quick lookup of key formulas used across a course (e.g., Bernoulli, continuity equation)** |

---

## 3. Visual Design

### 3.1 The Core Reading Problem

এখন QuestionCard-এ সব কিছু একসাথে dump করা:

```
┌─────────────────────────────────────────┐
│ Q1  What is GNU Octave? ...             │  ← question
│     [theory] [2022]                     │
├─────────────────────────────────────────┤
│ ⚡ QUICK ANSWER                         │  ← always visible
│   GNU Octave is a free...               │
├─────────────────────────────────────────┤
│ 📝 FULL SOLUTION                        │  ← always visible (problem!)
│   [wall of text + equations + tables]   │
├─────────────────────────────────────────┤
│ 💡 বাংলায় ব্যাখ্যা                       │  ← always visible (problem!)
│   [more text]                           │
├─────────────────────────────────────────┤
│ ⌨️ CODE                                  │  ← always visible (problem!)
│   [MATLAB tab] [Python tab]             │
└─────────────────────────────────────────┘
```

**আসল পড়ার flow:** Question → Quick answer → বুঝলে next, না বুঝলে Full solution।

---

### 3.2 New QuestionCard — 3-Layer Anatomy

```
LAYER 1 — Always Visible
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌──────────────────────────────────────────────┐
│ ●  Q3                              [theory]  │
│                                              │
│    What are the functions of the             │
│    following Octave commands?                │
│    (i) find  (ii) floor  (iii) plot          │
│                                              │
│ ─────── Quick Answer ────────────────────  ▼ │
└──────────────────────────────────────────────┘

LAYER 2 — Always Visible (Quick Answer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│  find → indices of nonzero elements          │
│  floor → rounds down to nearest integer      │
│                                              │
│              [ 📖 Full Solution ]  [ </> ]   │
└──────────────────────────────────────────────┘

LAYER 3 — Expanded (click করলে খোলে)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│  ● Full Solution                             │
│  [detailed steps, equations, tables]         │
│                                              │
│  ● বাংলায় ব্যাখ্যা                            │
│  [bangla explanation]                        │
│                                              │
│  ● MATLAB / Python                           │
│  [code block with copy button]               │
└──────────────────────────────────────────────┘
```

---

### 3.3 Type-Based Color Coding

```
theory      → বাম দিকে Blue border  #60A5FA
numerical   → বাম দিকে Green border #22C55E
programming → বাম দিকে Amber border #F59E0B
```

```jsx
const TYPE_COLORS = {
  theory:      { border: '#60A5FA', bg: 'rgba(96,165,250,0.08)',  text: '#93C5FD' },
  numerical:   { border: '#22C55E', bg: 'rgba(34,197,94,0.08)',   text: '#4ADE80' },
  programming: { border: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  text: '#FCD34D' },
  default:     { border: '#4A6080', bg: 'rgba(74,96,128,0.06)',   text: '#8BA3C4' },
};
```

---

### 3.4 Equation Block — Visual Upgrade

**এখন:** শুধু left blue border।

**হওয়া উচিত:**

```
┌───────────────────────────────────────────────┐
│  ▌  τ = μ (du/dy)          [centered, larger] │
└───────────────────────────────────────────────┘
```

```css
.eq-block {
  background: var(--eq-bg);
  border: 1px solid var(--eq-border);
  border-left: 4px solid var(--blue);
  border-radius: 0 10px 10px 0;
  padding: 14px 20px;
  margin: 10px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-x: auto;          /* horizontal scroll for long equations */
}
.eq-block .katex {
  font-size: 1.15em;
}
/* Dark mode glow */
.eq-block {
  box-shadow: 0 0 0 1px rgba(96,165,250,0.15),
              inset 0 1px 0 rgba(96,165,250,0.06);
}
```

---

### 3.5 Code Block — Visual Upgrade

```
┌─────────────────────────────────────────────┐
│  MATLAB ●  │  Python ●       [Copy ✓] [↕]  │
├─────────────────────────────────────────────┤
│  % Electric Field Intensity                  │
│  lambda = 1.7e-7;                            │
│  epsilon0 = 8.85e-12;                        │
│  ─ ─ ─ show more (12 lines) ─ ─ ─ ─ ─ ─ ─ │
└─────────────────────────────────────────────┘
```

Key changes:
- Copy button → top right of tab bar
- Expand/collapse if >20 lines
- MATLAB: dark `#111827` bg, `#FFD700` tab
- Python: darker `#060D17` bg, `#86EFAC` tab
- Font: `JetBrains Mono` 12.5px

---

### 3.6 Section Label Design

**এখন:** `⚡ QUICK ANSWER`, `📝 FULL SOLUTION` — visual noise।

**হওয়া উচিত:** Clean colored dot + sentence case।

```jsx
function SectionLabel({ color, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color,
                     flexShrink: 0, boxShadow: `0 0 6px ${color}60` }} />
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em',
                     textTransform: 'uppercase', color: color }}>
        {children}
      </span>
    </div>
  );
}
```

---

### 3.7 Reading Eye Path

```
1. Q-NUMBER (left badge) ─── monospace, green, largest
        ↓
2. QUESTION TEXT ─────────── bold 14px, full width
        ↓
3. TYPE BADGE ────────────── small, right, color-coded
        ↓
4. QUICK ANSWER ──────────── muted bg, 13px
        ↓
5. ACTION BUTTONS ────────── [Full Solution] [Code]
        ↓
6. (click) FULL SOLUTION ─── indented, detailed
        ↓
7. BANGLA ────────────────── yellow tint, Bangla font
        ↓
8. CODE ──────────────────── dark code block, tabs
```

প্রতিটা section নিচে যাওয়ার সাথে slightly dim হওয়া উচিত — visual priority।

---

### 3.8 Typography Scale

```
Display:   22px  800  Inter   → page titles
Title:     16px  700  Inter   → course name, section heading
Body:      14px  600  Inter   → question text
Small:     13px  400  Inter   → answer text, prose
Caption:   11px  500  Inter   → labels, meta info
Tag:        9.5px 700 Inter   → badges, section dots (UPPERCASE)
Mono:      12.5px 400 JetBrains Mono → code
Math:       inherit            → KaTeX (1.06em)
Bangla:    13px   400 Nirmala UI / Hind Siliguri
```

---

### 3.9 Spacing System (4px base)

```
Card outer margin:   14px  (3.5×)
Card inner padding:  14px  (3.5×)
Section gap:         12px  (3×)
Label to content:     8px  (2×)
Inline gap:           6px  (1.5×)
```

---

### 3.10 Micro-interactions

```css
/* Card hover — subtle lift */
.q-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

/* Expand animation */
.q-body {
  transition: max-height 0.28s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.2s ease;
}

/* Button press */
.q-btn:active { transform: scale(0.97); }

/* Copy success */
.copy-btn.copied {
  color: #4ADE80;
  border-color: #4ADE80;
}
```

---

### 3.11 Table Visual Upgrade

```css
.ans-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  font-size: 12.5px;
}
.ans-table thead td {
  background: var(--num-bg);
  font-weight: 700;
  padding: 8px 12px;
  border-bottom: 2px solid var(--border);
}
.ans-table tbody tr:nth-child(even) { background: var(--surface); }
.ans-table tbody tr:hover           { background: var(--card-hov); }
.ans-table td {
  padding: 7px 12px;
  border-right: 1px solid var(--border-sub);
  vertical-align: top;
  line-height: 1.55;
}
```

---

### 3.12 Subheading Rendering (inside AnswerBlock)

**এখন:** ALL CAPS — পড়তে কষ্ট হয়।

```jsx
// Before
textTransform: 'uppercase', fontSize: 11.5

// After — sentence case, subtle border
<div style={{
  fontWeight: 700,
  color: t.accent,
  fontSize: 12.5,
  marginTop: 16,
  marginBottom: 4,
  paddingBottom: 4,
  borderBottom: `1px solid ${t.accent}25`,
  letterSpacing: '0.01em',
  textTransform: 'none',   // ← sentence case
}}>
  {seg.content}
</div>
```

---

## 4. Mobile & Desktop Layout

### 4.1 Layout Breakpoints

```
Mobile:   ≤ 480px   → single column, compact
Tablet:   481–768px → single column, comfortable
Desktop:  > 768px   → max-width 860px, centered
```

---

### 4.2 Desktop Layout

```
┌──────────────────────────────────────────────────────────┐
│  [🔍 KUETx Solutions]   CSE2113 › 2022   [🌙] [Aa] [☰]  │  ← sticky header
├──────────────────────────────────────────────────────────┤
│  Search: [_________________________] [Filter ▼]          │
│  Chips: [All] [Theory] [Numerical] [Programming]         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 3   Q1                              [theory] [2022]│  │  ← QuestionCard (max-w: 820px)
│  │     Define viscosity and derive Newton's law...    │  │
│  │─────────────────────────────────────────────────── │  │
│  │  ● Quick Answer                                    │  │
│  │  Viscosity is a fluid's resistance to flow...      │  │
│  │                         [📖 Full Solution] [</> ]  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘

Max content width: 860px, centered with auto margins.
Q-number column: 52px fixed, border-right.
```

---

### 4.3 Mobile Layout

```
┌────────────────────────────┐
│ [←] CSE2113 › 2022   [🌙] │  ← compact sticky header
├────────────────────────────┤
│ [🔍 Search...]             │  ← full width search
│ [All][Theory][Num][Prog]   │  ← scrollable filter pills
├────────────────────────────┤
│ ┌──────────────────────┐   │
│ │Q1         [theory]▼  │   │  ← header: full width, tap to expand
│ │ Define viscosity...  │   │
│ ├──────────────────────┤   │
│ │ ● Quick Answer       │   │  ← no left indent on mobile (52px removed)
│ │ Viscosity is...      │   │
│ │ [Full Solution][</>] │   │
│ └──────────────────────┘   │
└────────────────────────────┘
```

**Key mobile changes:**
- Q-number column থেকে `padding-left: 66px` সরিয়ে `padding-left: 14px`
- Header sticky, height: 48px (not 64px)
- Filter chips horizontally scrollable, not wrapping to 2 rows
- Code block: `overflow-x: auto; -webkit-overflow-scrolling: touch`
- Action buttons full width on very small screens (< 360px)

---

### 4.4 Mobile CSS Overrides

```css
@media (max-width: 480px) {
  /* Remove 52px Q-number indent in answer sections */
  .q-quick,
  .q-actions,
  .q-section {
    padding-left: 14px;
  }

  /* Compact Q-number badge */
  .q-num {
    min-width: 38px;
    font-size: 11px;
  }

  /* Full-width search box */
  .search-input {
    width: 100%;
  }

  /* Filter pills — horizontal scroll, no wrap */
  .filter-bar {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .filter-bar::-webkit-scrollbar { display: none; }

  /* Equation blocks — horizontal scroll */
  .eq-block {
    overflow-x: auto;
    justify-content: flex-start;   /* don't center when scrollable */
  }

  /* Code pre — touch scroll */
  .q-code pre {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* Year cards grid — 2 columns on mobile instead of 3 */
  .year-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  /* Course cards — single column */
  .course-grid {
    grid-template-columns: 1fr;
  }
}
```

---

### 4.5 Navigation — Desktop vs Mobile

**Desktop:**
```
Breadcrumb: [Home] › [ESE Y2T1] › [CSE2113] › [2022]  (clickable at each level)
Browser back: works via URL routing
```

**Mobile:**
```
Header: [← back]  CSE2113 › 2022   [☰ menu]
No breadcrumb (space-constrained)
Browser back: works via URL routing
Bottom tab bar (optional): [📚 Courses] [⭐ Saved] [📊 Analysis]
```

---

### 4.6 Home / Course Selection — Desktop vs Mobile

**Desktop (grid):**
```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ CSE2113  │  │ CSE2215  │  │  FLUID   │
│ Prog Fund│  │ Algo     │  │ Mechanics│
│ 6 years  │  │ 5 years  │  │ 6 years  │
└──────────┘  └──────────┘  └──────────┘
```

**Mobile (list):**
```
┌──────────────────────────────┐
│ CSE2113  Programming Fund.   │
│           6 years available  │
├──────────────────────────────┤
│ FLUID    Fluid Mechanics      │
│           6 years available  │
└──────────────────────────────┘
```

---

## 5. Math & Derivation Course Specifics

> এই section টা FLUID Mechanics-এর মতো courses-এর জন্য, যেখানে questions শুধু "define X" না — বরং পুরো derivation, differential equations, boundary conditions, এবং numerical calculation আছে।

---

### 5.1 FLUID-type Question Types

FLUID course-এ মূলত যা থাকে:

| Type | Example |
|------|---------|
| **Derivation** | "Derive the Navier-Stokes equation for incompressible flow" |
| **Numerical** | "Water flows at 2 m/s. Find the Reynolds number. Is it laminar?" |
| **Concept + Formula** | "State Bernoulli's equation and list its assumptions" |
| **Graph/Diagram interpretation** | "Explain the velocity profile in fully developed pipe flow" |
| **Multi-part** | "(a) Define... (b) Derive... (c) Calculate..." |

CSE-type questions (define, write code, explain) আর FLUID-type questions-এর rendering একই হলে হবে না।

---

### 5.2 Derivation Step Rendering

FLUID-এর detailed_answer এ derivation steps থাকে এভাবে:

```
Given: μ = 0.89 × 10⁻³ Pa·s, du/dy = 0.5 s⁻¹
Find: τ (shear stress)

Solution:
Step 1: Apply Newton's law of viscosity
         τ = μ × (du/dy)

Step 2: Substitute values
         τ = (0.89 × 10⁻³) × 0.5

Step 3: Calculate
         τ = 4.45 × 10⁻⁴ Pa

Result: τ = 4.45 × 10⁻⁴ Pa  ✓
```

**এখন:** এটা একটা flat text block হিসেবে render হয় — কোনো visual structure নেই।

**হওয়া উচিত:**

```
┌─────────────────────────────────────────────────┐
│  GIVEN                                          │
│  μ = 0.89 × 10⁻³ Pa·s                         │
│  du/dy = 0.5 s⁻¹                               │
├─────────────────────────────────────────────────┤
│  FIND: τ                                        │
├─────────────────────────────────────────────────┤
│  STEP 1   Apply Newton's law of viscosity       │
│  ┌──────────────────────────────────────────┐   │
│  │  τ = μ · (du/dy)                        │   │   ← centered equation block
│  └──────────────────────────────────────────┘   │
│                                                 │
│  STEP 2   Substitute values                     │
│  ┌──────────────────────────────────────────┐   │
│  │  τ = (0.89 × 10⁻³) × 0.5               │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  STEP 3   Calculate                             │
│  ┌──────────────────────────────────────────┐   │
│  │  τ = 4.45 × 10⁻⁴ Pa                    │   │
│  └──────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│  ✓ RESULT:  τ = 4.45 × 10⁻⁴ Pa               │   ← green result box
└─────────────────────────────────────────────────┘
```

---

### 5.3 Detecting Derivation Structure in AnswerBlock

`parseAnswer()` function-এ নতুন segment types যোগ করতে হবে:

```js
// New segment types for math/derivation courses:
{ type: 'given_block', items: ['μ = 0.89e-3 Pa·s', 'du/dy = 0.5 s⁻¹'] }
{ type: 'find_block',  text: 'τ (shear stress)' }
{ type: 'step',        number: 1, label: 'Apply Newton\'s law', content: [...] }
{ type: 'result_box',  text: 'τ = 4.45 × 10⁻⁴ Pa' }
{ type: 'assumption_list', items: [...] }   // for "State Bernoulli's eq + assumptions"
{ type: 'diagram_note', text: 'See velocity profile diagram below' }
```

**Detection heuristics:**

```js
function parseDerivationSegments(text) {
  const lines = text.split('\n');
  const segments = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Given block
    if (/^given[:\s]/i.test(line)) {
      const items = [];
      while (i + 1 < lines.length && lines[i+1].trim() !== '') {
        items.push(lines[++i].trim());
      }
      segments.push({ type: 'given_block', items });
      continue;
    }

    // Find block
    if (/^find[:\s]/i.test(line)) {
      segments.push({ type: 'find_block', text: line.replace(/^find[:\s]*/i, '') });
      continue;
    }

    // Step N
    if (/^step\s*\d+/i.test(line)) {
      const num = parseInt(line.match(/\d+/)[0]);
      const label = line.replace(/^step\s*\d+[:\s]*/i, '');
      const content = [];
      while (i + 1 < lines.length && !/^step\s*\d+/i.test(lines[i+1]) && lines[i+1].trim() !== '') {
        content.push(lines[++i].trim());
      }
      segments.push({ type: 'step', number: num, label, content });
      continue;
    }

    // Result box
    if (/^result[:\s]|^ans[:\s]|^∴|^therefore/i.test(line)) {
      segments.push({ type: 'result_box', text: line.replace(/^(result|ans|∴|therefore)[:\s]*/i, '') });
      continue;
    }

    // Assumption list
    if (/^assumption/i.test(line)) {
      const items = [];
      while (i + 1 < lines.length && /^\d+\.|^[-•]/.test(lines[i+1])) {
        items.push(lines[++i].replace(/^\d+\.|^[-•]\s*/, '').trim());
      }
      segments.push({ type: 'assumption_list', items });
      continue;
    }

    // Default — pass to existing parseAnswer logic
    segments.push({ type: 'text', text: line });
  }

  return segments;
}
```

---

### 5.4 Rendering Derivation Segments

```jsx
function DerivationSegment({ seg, t }) {
  switch (seg.type) {
    case 'given_block':
      return (
        <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
          <SectionLabel color={t.blue}>Given</SectionLabel>
          {seg.items.map((item, i) => (
            <div key={i} style={{ fontFamily: 'monospace', fontSize: 13, color: t.text, lineHeight: 1.8 }}>
              <InlineMathLine text={item} t={t} />
            </div>
          ))}
        </div>
      );

    case 'find_block':
      return (
        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 10 }}>
          <SectionLabel color={t.amber}>Find</SectionLabel>
          <InlineMathLine text={seg.text} t={t} />
        </div>
      );

    case 'step':
      return (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ background: t.accent, color: '#000', borderRadius: 4, fontSize: 10, fontWeight: 800, padding: '2px 7px', fontFamily: 'monospace' }}>
              STEP {seg.number}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: t.textSub }}>{seg.label}</span>
          </div>
          <div style={{ paddingLeft: 16, borderLeft: `2px solid ${t.border}` }}>
            {seg.content.map((line, i) => (
              <div key={i}>
                {/\$/.test(line)
                  ? <div style={{ background: t.eqBg, border: `1px solid ${t.eqBorder}`, borderLeft: `3px solid ${t.blue}`, borderRadius: '0 8px 8px 0', padding: '10px 16px', margin: '6px 0', textAlign: 'center', overflowX: 'auto' }}>
                      <MathSpan tex={line.replace(/\$/g, '')} display />
                    </div>
                  : <div style={{ fontSize: 13, color: t.text, lineHeight: 1.7 }}>
                      <InlineMathLine text={line} t={t} />
                    </div>
                }
              </div>
            ))}
          </div>
        </div>
      );

    case 'result_box':
      return (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 14px', marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#4ADE80', fontSize: 16 }}>✓</span>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#4ADE80' }}>
            <InlineMathLine text={seg.text} t={t} />
          </div>
        </div>
      );

    case 'assumption_list':
      return (
        <div style={{ marginBottom: 10 }}>
          <SectionLabel color={t.textMut}>Assumptions</SectionLabel>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {seg.items.map((item, i) => (
              <li key={i} style={{ fontSize: 13, color: t.textSub, lineHeight: 1.75 }}>
                <InlineMathLine text={item} t={t} />
              </li>
            ))}
          </ol>
        </div>
      );

    default:
      return null;
  }
}
```

---

### 5.5 Long Equation Overflow Handling

FLUID-এর equations অনেক সময় খুব লম্বা হয়:

```
∂u/∂x + ∂v/∂y + ∂w/∂z = 0   (continuity)
ρ(∂u/∂t + u∂u/∂x + v∂u/∂y) = -∂p/∂x + μ(∂²u/∂x² + ∂²u/∂y²)   (momentum)
```

**Mobile-এ এটা overflow করে।**

```css
/* Equation blocks always scrollable */
.eq-block {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  /* On mobile: left-align, not center */
}

@media (max-width: 480px) {
  .eq-block {
    justify-content: flex-start;
    padding: 10px 12px;
  }
  /* Slightly smaller KaTeX on mobile */
  .eq-block .katex {
    font-size: 0.95em;
  }
}
```

---

### 5.6 Formula Reference Panel

FLUID-এর questions-এ একই formulas বারবার আসে: Bernoulli, Continuity, Reynolds number, Darcy-Weisbach, etc.

**Feature:** Sidebar/drawer যেখানে key formulas সবসময় দেখা যাবে।

```
┌──────────────────────────────────┐
│  📐 Formula Sheet                │
├──────────────────────────────────┤
│  Continuity:                     │
│  A₁V₁ = A₂V₂                   │
│                                  │
│  Bernoulli:                      │
│  p/ρg + V²/2g + z = const       │
│                                  │
│  Reynolds Number:                │
│  Re = ρVD/μ                      │
│                                  │
│  Newton's Viscosity Law:         │
│  τ = μ(du/dy)                   │
│                                  │
│  Darcy-Weisbach:                 │
│  hf = f(L/D)(V²/2g)            │
└──────────────────────────────────┘
```

**Desktop:** Right sidebar (fixed, 220px wide, appears when in FLUID course).  
**Mobile:** Bottom sheet (slide up), triggered by [📐] button in header.

```jsx
// Formula panel data — course-specific
const FORMULA_SHEETS = {
  FLUID: [
    { name: 'Continuity', tex: 'A_1 V_1 = A_2 V_2' },
    { name: 'Bernoulli', tex: '\\frac{p}{\\rho g} + \\frac{V^2}{2g} + z = \\text{const}' },
    { name: 'Reynolds Number', tex: 'Re = \\frac{\\rho V D}{\\mu}' },
    { name: "Newton's Viscosity Law", tex: '\\tau = \\mu \\frac{du}{dy}' },
    { name: 'Darcy-Weisbach', tex: 'h_f = f \\frac{L}{D} \\frac{V^2}{2g}' },
    { name: 'Hydrostatic Pressure', tex: 'p = \\rho g h' },
    { name: 'Chezy Formula', tex: 'V = C\\sqrt{Ri}' },
  ],
  // Add CSE, EEE formulas here as needed
};
```

---

### 5.7 Multi-Part Question Rendering

FLUID-এ "(a) ... (b) ... (c) ..." structure অনেক common। এটাকে আলাদাভাবে render করা দরকার।

```
┌─────────────────────────────────────────────┐
│ Q5   A pipe carries water...                │
├─────────────────────────────────────────────┤
│  (a) Find the velocity at section 2         │
│  (b) Determine the pressure difference      │
│  (c) Is the flow laminar or turbulent?      │
│                                             │
│ Parts: [a] [b] [c]  ← tab selector         │
└─────────────────────────────────────────────┘
```

Multi-part detection:

```js
// If question contains "(a)" "(b)" pattern → split and show tabs
function hasMultiParts(text) {
  return /\(a\)|\(i\)|part\s+a/i.test(text);
}
```

---

### 5.8 Unit Highlighting

FLUID numerical problems-এ units গুরুত্বপূর্ণ। Units কে visually highlight করলে ভালো হয়।

```jsx
// Wrap units in a styled span
function highlightUnits(text) {
  // Match common units: m/s, Pa, kg/m³, N/m², m², kPa, etc.
  return text.replace(
    /\b(m\/s|Pa|kPa|MPa|N\/m[²2]|kg\/m[³3]|m[²2³3]|m\/s[²2]|rpm|°C|K)\b/g,
    '<span class="unit">$1</span>'
  );
}
```

```css
.unit {
  color: var(--amber);
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9em;
}
```

---

### 5.9 "Derivation Mode" — Expandable Steps

FLUID long derivations-এর জন্য একটা special view mode:

```
[📐 Derivation Mode]  toggle button on card action bar

When ON:
├── Step 1  [Given & Setup]          ← click to expand
├── Step 2  [Apply continuity eq]    ← click to expand
├── Step 3  [Apply Bernoulli]        ← click to expand  ← currently expanded
│   ┌─────────────────────────────┐
│   │  p₁/ρg + V₁²/2g + z₁ =    │
│   │  p₂/ρg + V₂²/2g + z₂      │
│   └─────────────────────────────┘
├── Step 4  [Solve for V₂]
└── Step 5  [Result]                 ← always visible
```

This is a **Priority 2** feature — after core collapse/expand is done.

---

### 5.10 FLUID vs CSE Card Differentiation

একই `QuestionCard` component use করা যাবে, কিন্তু course type-এ কিছু visual difference থাকা উচিত:

| Aspect | CSE (programming) | FLUID (math) |
|--------|-------------------|---------------|
| Left border color | `#F59E0B` (amber) for programming | `#60A5FA` (blue) for numerical |
| Code section | Always visible (MATLAB/Python) | Rarely present |
| Equation blocks | Occasional | Frequent, often multi-line |
| Step structure | Bullet lists | Given/Step N/Result |
| Formula panel | Not shown | Available in header |
| Question length | Usually shorter | Usually longer (derivations) |

---

## 6. Upgrade Plan

### Priority 1 — High Impact, Low Effort (Week 1)

#### 6.1 Collapse/Expand Question Cards
```jsx
function QuestionCard({ question: q, globalIdx, showYearBadge, t }) {
  const [open, setOpen] = useState(false);
  // ...
  // Default: show Q + quick answer only
  // Click header → expand full solution + bangla + code
}
```
**Result:** Page height reduced ~70%.

#### 6.2 Copy Button on Code Blocks
```jsx
function handleCopy() {
  navigator.clipboard.writeText(code).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  });
}
```

#### 6.3 Search Debounce + Highlight + Full Field Search
```jsx
const search = useDebounce(searchRaw, 200);

// Search across all fields
function matchesSearch(q, s) {
  const lower = s.toLowerCase();
  return (
    q.question?.toLowerCase().includes(lower) ||
    q.short_answer?.toLowerCase().includes(lower) ||
    q.detailed_answer?.toLowerCase().includes(lower) ||
    q.explanation_bn?.includes(s)
  );
}
```

#### 6.4 Manual Theme Toggle
```jsx
function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('kuetx-theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  function toggle() {
    setDark(d => {
      localStorage.setItem('kuetx-theme', !d ? 'dark' : 'light');
      return !d;
    });
  }
  return { t: dark ? T.dark : T.light, dark, toggle };
}
```

#### 6.5 Question Count on Year Cards
```jsx
const [yearMeta, setYearMeta] = useState({});
// After probing or loading: store { '2022': { count: 28 } }
// Show on card: "28 questions"
```

---

### Priority 2 — Core Improvements (Week 2)

#### 6.6 URL Routing

```
/solutions                                        → home
/solutions?dept=ESE&term=Y2T1                    → courses
/solutions?dept=ESE&term=Y2T1&course=FLUID       → years
/solutions?dept=ESE&term=Y2T1&course=FLUID&year=2022  → solutions
/solutions?dept=ESE&term=Y2T1&course=FLUID&year=all   → all view
```

```jsx
const [searchParams, setSearchParams] = useSearchParams();
useEffect(() => {
  const dept = searchParams.get('dept');
  // restore state from URL on mount
}, []);
```

#### 6.7 Bookmarks (localStorage)
```jsx
function useBookmarks() {
  const [bookmarks, setBookmarks] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('kuetx-bookmarks') || '[]')); }
    catch { return new Set(); }
  });
  function toggle(key) { // key = `${course}_${year}_${id}`
    setBookmarks(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      localStorage.setItem('kuetx-bookmarks', JSON.stringify([...next]));
      return next;
    });
  }
  return { bookmarks, toggle };
}
```

#### 6.8 Paginated List for "All Years" View
```jsx
const [visibleCount, setVisibleCount] = useState(20);
const visible = filteredAllQuestions.slice(0, visibleCount);
// Load more button at bottom
```

#### 6.9 Derivation Segment Parser (for FLUID)
See Section 5.3 above — add `parseDerivationSegments()` and use it inside `AnswerBlock` when course is FLUID or question type is `numerical` / `derivation`.

---

### Priority 3 — Value Features (Week 3)

#### 6.10 Question Frequency Heatmap
```
Topic          | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | Total
---------------|------|------|------|------|------|------|------
theory         |  12  |  11  |   8  |  14  |  13  |  10  |  68
numerical      |   8  |   9  |   7  |   8  |   8  |  10  |  50
programming    |   6  |   5  |   3  |   7  |   6  |   6  |  33
```
Add "Analysis" tab in all-years view.

#### 6.11 File Split / Refactor
```
components/QuestionBankSolutions/
  index.jsx
  theme.js
  parseAnswer.js        ← add parseDerivationSegments() here
  mathHelpers.js
  components/
    QuestionCard.jsx
    CodeBlock.jsx
    AnswerBlock.jsx
    DerivationSegment.jsx   ← NEW for FLUID
    EquationBlock.jsx
    FilterBar.jsx
    FormulaPanel.jsx        ← NEW for FLUID
  hooks/
    useBookmarks.js
    useDebounce.js
    useAvailableYears.js
```

#### 6.12 Syntax Highlighting
```jsx
import Prism from 'prismjs';
import 'prismjs/components/prism-matlab';
import 'prismjs/components/prism-python';
```

---

### Priority 4 — Polish (Week 4)

#### 6.13 Print / Export
```jsx
<button onClick={() => window.print()}>🖨️ Print</button>
// @media print: hide nav, show only question + solution
```

#### 6.14 Font Size Control
```jsx
const [fontSize, setFontSize] = useState(13.5); // slider: 12–16px
```

#### 6.15 Keyboard Shortcuts
```jsx
// Ctrl+F → focus search
// n / p → next/prev question (when a card is focused)
useEffect(() => {
  function onKey(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchRef.current?.focus();
    }
  }
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);
```

#### 6.16 Formula Panel for FLUID
See Section 5.6 — desktop sidebar, mobile bottom sheet.

---

## 7. Before vs After

| Dimension | Before | After |
|---|---|---|
| **File structure** | Single 970-line JSX | 10–12 focused files |
| **Card interaction** | Always fully expanded | Collapsed default, expand on click |
| **Code blocks** | No copy, cuts at 400px | Copy + visual feedback, expand |
| **Search** | No debounce, 2 fields, no highlight | Debounced, all fields, highlights |
| **URL** | Never changes | Full routing, shareable links |
| **Theme** | System preference only | System default + manual toggle |
| **Bookmarks** | None | Save/unsave, view saved-only |
| **Analysis** | None | Topic frequency heatmap |
| **Performance** | All 300+ questions in DOM | Paginated, 20 at a time |
| **Year cards** | No question count | Shows count per year |
| **Mobile layout** | Mostly works, some breaks | Q-number indent fixed, proper scrolls |
| **Equation blocks** | Left border only, no scroll | Centered, glow, horizontal scroll on mobile |
| **FLUID derivations** | Flat text, no structure | Given/Step/Result visual blocks |
| **Formula reference** | None | Course-specific formula panel |
| **Multi-part questions** | Renders as plain text | Tab selector for (a), (b), (c) |
| **Unit highlighting** | None | Amber-colored units in FLUID numericals |

---

## 8. Implementation Order

```
Week 1 — Quick wins (ship immediately):
  ✅ 6.1  Collapse/expand cards
  ✅ 6.2  Copy button on code
  ✅ 6.3  Search debounce + full-field + highlight
  ✅ 6.4  Manual theme toggle
  ✅ 6.5  Year card question count
  ✅      Mobile CSS fixes (indent, filter pills, equation scroll)

Week 2 — Core improvements:
  ✅ 6.6  URL routing (useSearchParams)
  ✅ 6.7  Bookmarks
  ✅ 6.8  Paginated list
  ✅ 6.9  Derivation segment parser for FLUID

Week 3 — Value features:
  ✅ 6.10 Frequency analysis heatmap
  ✅ 6.11 File split / refactor
  ✅ 6.12 Syntax highlighting
  ✅      DerivationSegment.jsx component
  ✅      FormulaPanel.jsx (FLUID)

Week 4 — Polish:
  ✅ 6.13 Print / export
  ✅ 6.14 Font size control
  ✅ 6.15 Keyboard shortcuts
  ✅ 6.16 Multi-part question tabs
  ✅      Unit highlighting in numericals
```

---

## Summary

**সবচেয়ে বড় single change:** Card collapse/expand → reading experience ৭০% improve।  
**দ্বিতীয়:** URL routing → browser nav ঠিক হয়, links shareable।  
**তৃতীয় (CSE):** Frequency heatmap → exam prep tool হয়ে যায়।  
**তৃতীয় (FLUID):** Derivation segment rendering → math course-এর questions পড়া অনেক সহজ হয়।

FLUID-এর মতো derivation-heavy courses-এর জন্য যোগ করতে হবে:
- `parseDerivationSegments()` → Given/Step/Result visual blocks
- Equation block overflow scroll (mobile)
- Formula reference panel
- Unit highlighting in numerical answers
- Multi-part question tab selector
