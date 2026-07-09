# QuestionBankSolutions — Visual Design & UX Plan

> এই document-এ আছে: কোন UI element কেমন দেখাবে, user কীভাবে পড়বে,  
> কোথায় চোখ যাবে, কোন CSS/layout change করলে reading experience সবচেয়ে ভালো হবে।

---

## 1. The Core Problem — Reading Flow

এখন QuestionCard এ সব কিছু একসাথে dump করা আছে:

```
┌─────────────────────────────────────────┐
│ Q1  What is GNU Octave? ...             │  ← question
│     [theory] [2022]                     │
├─────────────────────────────────────────┤
│ ⚡ QUICK ANSWER                         │  ← short_answer (always visible)
│   GNU Octave is a free...               │
├─────────────────────────────────────────┤
│ 📝 FULL SOLUTION                        │  ← detailed_answer (always visible)
│   [wall of text + equations + tables]   │
├─────────────────────────────────────────┤
│ 💡 বাংলায় ব্যাখ্যা                       │  ← explanation_bn (always visible)
│   [more text]                           │
├─────────────────────────────────────────┤
│ ⌨️ CODE                                  │  ← matlab/python (always visible)
│   [MATLAB tab] [Python tab]             │
└─────────────────────────────────────────┘
```

**সমস্যা:** User চোখ দিয়ে কোথায় যাবে বুঝত পারে না। সব same weight-এ দেখাচ্ছে।  
**আসল পড়ার flow:** Question পড়ো → Quick answer দেখো → বুঝলে এগিয়ে যাও, না বুঝলে Full solution খোলো।

---

## 2. New Question Card Anatomy

### 2A. Visual Hierarchy — 3 Layers

```
LAYER 1 — Always Visible (সবসময় দেখা যায়)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌──────────────────────────────────────────────┐
│ ●  Q3                              [theory]  │  ← strip: number + type badge
│                                              │
│    What are the functions of the             │  ← question text (bold, large)
│    following Octave commands?                │
│    (i) find  (ii) floor  (iii) plot          │
│                                              │
│ ─────── Quick Answer ───────────────────── ▼ │  ← collapsed by default
└──────────────────────────────────────────────┘

LAYER 2 — Peek (Quick Answer, সবসময় দেখা যায়)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│  find → indices of nonzero elements          │  ← 1-2 line summary
│  floor → rounds down to nearest integer      │
│                                              │
│              [ 📖 Full Solution ]  [ </> ]   │  ← action buttons
└──────────────────────────────────────────────┘

LAYER 3 — Expanded (click করলে খোলে)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│  📝 FULL SOLUTION                            │
│  [detailed steps, equations, tables]         │
│                                              │
│  💡 বাংলায় ব্যাখ্যা                            │
│  [bangla explanation]                        │
│                                              │
│  ⌨️ MATLAB / Python                          │
│  [code block with copy button]               │
└──────────────────────────────────────────────┘
```

### 2B. CSS Implementation

```css
/* Card — base */
.q-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 14px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.q-card:hover {
  border-color: var(--accent-dim);
  box-shadow: 0 2px 16px rgba(0,0,0,0.12);
}

/* Left accent bar — color-coded by type */
.q-card[data-type="theory"]     { border-left: 4px solid #60A5FA; }  /* blue */
.q-card[data-type="numerical"]  { border-left: 4px solid #22C55E; }  /* green */
.q-card[data-type="programming"]{ border-left: 4px solid #F59E0B; }  /* amber */

/* Header strip */
.q-header {
  display: grid;
  grid-template-columns: 52px 1fr auto;
  align-items: start;
  gap: 0;
  cursor: pointer;
  user-select: none;
  padding: 0;
}

/* Q-number badge */
.q-num {
  background: var(--num-bg);
  color: var(--num-text);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
  border-right: 1px solid var(--border-sub);
  flex-shrink: 0;
}

/* Question text */
.q-text {
  padding: 14px 14px 10px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.6;
  color: var(--text);
}

/* Expand chevron */
.q-chevron {
  padding: 14px 14px 0 0;
  color: var(--text-muted);
  transition: transform 0.2s cubic-bezier(.4,0,.2,1);
}
.q-card[data-open="true"] .q-chevron {
  transform: rotate(180deg);
}

/* Quick answer strip — always visible */
.q-quick {
  padding: 10px 14px 10px 66px;  /* aligns with q-text */
  border-top: 1px solid var(--border-sub);
  background: var(--short-bg);
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-sub);
}
.q-quick-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 4px;
}

/* Action row */
.q-actions {
  display: flex;
  gap: 8px;
  padding: 8px 14px 10px 66px;
  border-top: 1px dashed var(--border-sub);
  background: var(--short-bg);
}
.q-btn {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.12s;
}
.q-btn-solution {
  border-color: var(--blue);
  color: var(--blue);
  background: var(--blue-bg);
}
.q-btn-code {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-glow);
}

/* Expanded body — animated */
.q-body {
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.3s cubic-bezier(.4,0,.2,1);
}
.q-card[data-open="true"] .q-body {
  max-height: 9999px;
}

/* Sections inside body */
.q-section {
  padding: 12px 14px 12px 66px;
  border-top: 1px solid var(--border-sub);
}
.q-section-label {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 8px;
}
```

---

## 3. Type-Based Color Coding

এখন সব question card একই রঙের। কিন্তু `type` field আছে JSON-এ — এটা ব্যবহার করে visual differentiation করা উচিত।

```
theory      → বাম দিকে Blue border  #60A5FA
              Badge: blue tinted
              
numerical   → বাম দিকে Green border #22C55E
              Badge: green tinted
              
programming → বাম দিকে Amber border #F59E0B
              Badge: amber tinted
```

```jsx
const TYPE_COLORS = {
  theory:      { border: '#60A5FA', bg: 'rgba(96,165,250,0.08)',  text: '#93C5FD' },
  numerical:   { border: '#22C55E', bg: 'rgba(34,197,94,0.08)',   text: '#4ADE80' },
  programming: { border: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  text: '#FCD34D' },
  default:     { border: '#4A6080', bg: 'rgba(74,96,128,0.06)',   text: '#8BA3C4' },
};

function getTypeColor(type) {
  return TYPE_COLORS[type?.toLowerCase()] || TYPE_COLORS.default;
}
```

---

## 4. Equation Block — Visual Upgrade

**এখন:** শুধু left blue border, plain background।

```
│ ← blue  $$\tau = \mu \frac{du}{dy}$$          │
```

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
  justify-content: center;   /* center the math */
  overflow-x: auto;
}

/* KaTeX inside equation block — larger */
.eq-block .katex {
  font-size: 1.15em;
}

/* Dark mode glow effect on equation blocks */
@media (prefers-color-scheme: dark) {
  .eq-block {
    box-shadow: 0 0 0 1px rgba(96,165,250,0.15),
                inset 0 1px 0 rgba(96,165,250,0.06);
  }
}
```

---

## 5. Code Block — Visual Upgrade

**এখন:** Tab + `<pre>` block। No copy, cuts at 400px।

**হওয়া উচিত:**

```
┌─────────────────────────────────────────────┐
│  MATLAB ●  │  Python ●       [Copy ✓] [↕]  │  ← tab bar
├─────────────────────────────────────────────┤
│  % Electric Field Intensity                  │
│  lambda = 1.7e-7;                            │  ← syntax colored
│  epsilon0 = 8.85e-12;                        │
│  R = 0.06;                                   │
│  ...                                          │
│  ─ ─ ─ ─ ─ ─ ─ show more (12 lines) ─ ─ ─  │  ← expand button if >20 lines
└─────────────────────────────────────────────┘
```

```jsx
function CodeBlock({ matlab, python, t }) {
  const [tab, setTab] = useState(matlab ? 'matlab' : 'python');
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const code = tab === 'matlab' ? matlab : python;
  const lines = (code || '').split('\n');
  const PREVIEW_LINES = 20;
  const shouldCollapse = lines.length > PREVIEW_LINES;
  const visibleLines = expanded ? lines : lines.slice(0, PREVIEW_LINES);

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${t.border}` }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', background: '#0A1422', padding: '0 8px' }}>
        {[matlab && 'matlab', python && 'python'].filter(Boolean).map(id => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '8px 16px',
            background: 'none',
            border: 'none',
            borderBottom: `2px solid ${tab === id ? (id === 'matlab' ? '#FFD700' : '#86EFAC') : 'transparent'}`,
            color: tab === id ? (id === 'matlab' ? '#FFD700' : '#86EFAC') : '#4A6080',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.08em',
          }}>
            {id === 'matlab' ? '⬡ MATLAB' : '🐍 Python'}
          </button>
        ))}
        {/* Copy button — pushed to right */}
        <button onClick={copy} style={{ marginLeft: 'auto', fontSize: 11, color: copied ? '#4ADE80' : '#4A6080', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", padding: '8px 10px' }}>
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>

      {/* Code area */}
      <pre style={{ margin: 0, padding: '12px 16px', background: tab === 'matlab' ? '#111827' : '#060D17', color: tab === 'matlab' ? '#D4D4D4' : '#C9D1D9', fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.75, overflowX: 'auto' }}>
        {visibleLines.join('\n')}
      </pre>

      {/* Expand/collapse if long */}
      {shouldCollapse && (
        <button onClick={() => setExpanded(e => !e)} style={{ width: '100%', padding: '7px', background: '#0A1422', border: 'none', borderTop: '1px dashed #1A2B44', color: '#4A6080', fontSize: 11, cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>
          {expanded ? '▲ show less' : `▼ show ${lines.length - PREVIEW_LINES} more lines`}
        </button>
      )}
    </div>
  );
}
```

---

## 6. Section Label Design

**এখন:** Emoji + uppercase text — visual noise।  
`⚡ QUICK ANSWER`, `📝 FULL SOLUTION`, `💡 বাংলায় ব্যাখ্যা`, `⌨️ CODE`

**হওয়া উচিত:** Clean pill labels, emoji সরিয়ে colored dot দিয়ে।

```
●  Quick Answer          (green dot)
●  Full Solution         (blue dot)
●  বাংলায় ব্যাখ্যা          (yellow dot)
●  Code                  (accent dot)
```

```jsx
function SectionLabel({ color, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}60` }} />
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: color }}>
        {children}
      </span>
    </div>
  );
}
```

---

## 7. Reading Flow — Eye Path Design

Student একটা question card পড়ার সময় চোখ এই order-এ যাওয়া উচিত:

```
1. Q-NUMBER (left badge) ─── সবচেয়ে বড়, monospace, green
        ↓
2. QUESTION TEXT ─────────── bold, 14px, full width
        ↓
3. TYPE BADGE ────────────── small, right side, color-coded
        ↓
4. QUICK ANSWER ──────────── slightly indented, muted bg, 13px
        ↓
5. ACTION BUTTONS ────────── [Full Solution] [Code] — only if needed
        ↓
6. (click) FULL SOLUTION ─── indented, white bg box, detailed
        ↓
7. BANGLA ────────────────── yellow tint, Bangla font
        ↓
8. CODE ──────────────────── dark code block, tabs
```

**এই flow নিশ্চিত করতে যা করতে হবে:**

| Element | CSS Property | Value |
|---------|-------------|-------|
| Q-number | `font-size` | `14px` bold monospace |
| Question text | `font-size` | `14–15px`, `font-weight: 600` |
| Type badge | `font-size` | `9.5px`, আলাদা color |
| Quick answer | `font-size` | `13px`, `color: textSub` (dim করো) |
| Full solution label | `font-size` | `9.5px` dot label |
| Full solution text | `font-size` | `13.5px`, `line-height: 1.85` |
| Bangla | `font-size` | `13px`, `line-height: 1.9` |
| Code | `font-size` | `12.5px` monospace |

**Key principle:** প্রতিটা section নিচে যাওয়ার সাথে সাথে *slightly dim* হওয়া উচিত যাতে visual priority বোঝা যায়।

---

## 8. Spacing System

এখন spacing arbitrary। একটা consistent system দরকার:

```
Base unit: 4px

Card outer margin:   14px  (3.5×)
Card inner padding:  14px  (3.5×)
Section gap:         12px  (3×)
Label to content:     8px  (2×)
Inline gap:           6px  (1.5×)
```

```css
:root {
  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 12px;
  --sp-4: 14px;   /* main padding unit */
  --sp-5: 20px;
  --sp-6: 24px;
}
```

---

## 9. Typography Scale

এখন font sizes inconsistent (9px, 9.5px, 10px, 10.5px, 11px, 11.5px, 12px, 12.5px, 13px, 13.5px, 14px, 15px, 16px, 18px, 20px, 24px, 26px)।

**Clean করা scale:**

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

## 10. Subheading Rendering (inside AnswerBlock)

**এখন:**
```jsx
// All caps, accent color
<div style={{ fontWeight: 700, color: t.accent, fontSize: 11.5, 
              textTransform: 'uppercase', letterSpacing: '0.07em' }}>
  {seg.content}
</div>
```

**Problem:** Section headers যেমন "Given:", "Solution:", "Step 1:" এগুলো ALL CAPS হলে পড়তে কষ্ট হয়।

**Better:**
```jsx
<div style={{
  fontWeight: 700,
  color: t.accent,
  fontSize: 12.5,
  marginTop: 16,
  marginBottom: 4,
  paddingBottom: 4,
  borderBottom: `1px solid ${t.accent}25`,
  letterSpacing: '0.01em',
  textTransform: 'none',   // ← sentence case, not ALL CAPS
}}>
  {seg.content}
</div>
```

---

## 11. Table Visual Upgrade

**এখন:** Plain bordered table, alternating row colors।

**হওয়া উচিত:**

```css
.ans-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  margin: 10px 0;
  font-size: 12.5px;
}

.ans-table thead td {
  background: var(--num-bg);
  color: var(--num-text);
  font-weight: 700;
  padding: 8px 12px;
  border-bottom: 2px solid var(--border);
}

.ans-table tbody tr:nth-child(even) {
  background: var(--surface);
}
.ans-table tbody tr:nth-child(odd) {
  background: var(--card);
}
.ans-table tbody tr:hover {
  background: var(--card-hov);
}

.ans-table td {
  padding: 7px 12px;
  border-right: 1px solid var(--border-sub);
  vertical-align: top;
  line-height: 1.55;
}
.ans-table td:last-child {
  border-right: none;
}
```

---

## 12. Mobile Responsiveness

**এখন:** `maxWidth: 860`, `padding: '0 16px'` — এটা ঠিক আছে কিন্তু কিছু জায়গায় ভাঙে।

**Fix করার দরকার:**

```css
/* Question number badge — mobile এ narrow */
@media (max-width: 480px) {
  .q-num {
    min-width: 38px;
    font-size: 11px;
  }
  .q-quick,
  .q-actions,
  .q-section {
    padding-left: 14px;  /* remove the 52px indent on mobile */
  }
}

/* Code block — horizontal scroll on mobile */
.q-code pre {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* Filter pills — wrap cleanly */
.filter-bar {
  flex-wrap: wrap;
  gap: 6px;
}
```

---

## 13. Micro-interactions

```css
/* Card hover — subtle lift */
.q-card {
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
}
.q-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

/* Expand animation — smooth */
.q-body {
  transition: max-height 0.28s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.2s ease;
}

/* Button press */
.q-btn:active {
  transform: scale(0.97);
}

/* Copy success */
.copy-btn.copied {
  color: #4ADE80;
  border-color: #4ADE80;
}
```

---

## 14. Full Implementation — Revised QuestionCard Structure

```jsx
function QuestionCard({ question: q, globalIdx, showYearBadge, t }) {
  const [open, setOpen] = useState(false);
  const typeColor = getTypeColor(q.type);
  const hasCode = q.matlab || q.python;

  return (
    <div
      data-type={q.type}
      data-open={open}
      style={{
        background: t.card,
        border: `1px solid ${open ? typeColor.border + '60' : t.border}`,
        borderLeft: `4px solid ${typeColor.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 14,
        transition: 'border-color .15s, box-shadow .15s',
        boxShadow: open ? `0 4px 20px rgba(0,0,0,0.12)` : 'none',
      }}
    >
      {/* ── LAYER 1: Header (always visible) ── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'grid', gridTemplateColumns: '52px 1fr 28px', cursor: 'pointer', userSelect: 'none' }}
      >
        {/* Q-number */}
        <div style={{ background: t.numBg, color: t.numText, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: `1px solid ${t.borderSub}` }}>
          {q.id}
        </div>

        {/* Question text + badges */}
        <div style={{ padding: '13px 12px 10px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.6, color: t.text }}>
            <InlineMathLine text={q.question} t={t} mathStyle={isMathLine(q.question)} />
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
            {q.type && (
              <span style={{ fontSize: 9.5, fontWeight: 700, color: typeColor.text, background: typeColor.bg, border: `1px solid ${typeColor.border}30`, borderRadius: 4, padding: '2px 8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {q.type}
              </span>
            )}
            {showYearBadge && q._year && (
              <span style={{ fontSize: 9.5, fontWeight: 600, color: t.blue, background: t.blueBg, border: `1px solid ${t.blue}30`, borderRadius: 4, padding: '2px 8px' }}>
                {q._year}
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 16, color: t.textMut, transition: 'transform .22s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <ChevronDown size={14} />
        </div>
      </div>

      {/* ── LAYER 2: Quick Answer (always visible) ── */}
      {q.short_answer && (
        <div style={{ borderTop: `1px solid ${t.borderSub}`, background: t.shortBg, padding: '9px 14px 9px 66px' }}>
          <SectionLabel color={t.accent}>Quick Answer</SectionLabel>
          <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.7 }}>
            <AnswerBlock text={q.short_answer} t={t} />
          </div>
        </div>
      )}

      {/* ── LAYER 3: Expanded body (click to open) ── */}
      {open && (
        <div>
          {q.detailed_answer && (
            <div style={{ borderTop: `1px solid ${t.borderSub}`, padding: '12px 14px 12px 14px', background: t.surface }}>
              <SectionLabel color={t.blue}>Full Solution</SectionLabel>
              <AnswerBlock text={q.detailed_answer} t={t} />
            </div>
          )}

          {q.explanation_bn && (
            <div style={{ borderTop: `1px solid ${t.borderSub}`, background: t.bnBg, padding: '10px 14px 10px 14px' }}>
              <SectionLabel color={t.yellow}>বাংলায় ব্যাখ্যা</SectionLabel>
              <div style={{ fontFamily: "'Nirmala UI','Hind Siliguri',sans-serif", color: t.yellowText, fontSize: 13, lineHeight: 1.9 }}>
                <AnswerBlock text={q.explanation_bn} t={t} />
              </div>
            </div>
          )}

          {hasCode && (
            <div style={{ borderTop: `1px solid ${t.borderSub}`, padding: '10px 14px' }}>
              <SectionLabel color={t.accent}>Code</SectionLabel>
              <CodeBlock matlab={q.matlab} python={q.python} t={t} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 15. Summary — Changes at a Glance

| Component | Current | After |
|-----------|---------|-------|
| **QuestionCard** | Always fully open | Collapsed default, expand on click |
| **Card border** | Same gray for all | Color-coded by question type |
| **Q-number** | `Q1, Q2...` (global index) | Actual `q.id` from JSON |
| **Section labels** | Emoji + ALL CAPS | Colored dot + sentence case |
| **Subheadings** | ALL CAPS green | Normal weight, subtle bottom border |
| **Equation block** | Left border only | Centered math, subtle glow |
| **Code block** | Cuts at 400px | Expand button, copy button |
| **Table** | Plain border | Rounded, hover rows |
| **Typography** | 15+ arbitrary sizes | 8-stop clean scale |
| **Spacing** | Arbitrary px values | 4px base-unit system |
| **Micro-interactions** | Hover only on year cards | Card lift, button press, copy feedback |
| **Mobile** | Mostly works | Q-number indent removed, proper scroll |

**সবচেয়ে বড় single change:** `open` state দিয়ে card collapse → এটাই reading experience সবচেয়ে বেশি improve করবে।
