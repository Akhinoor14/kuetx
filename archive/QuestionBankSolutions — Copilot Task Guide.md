# QuestionBankSolutions — Copilot Task Guide

> **Context:** KUETx is a Vite + React 18 app. `src/pages/QuestionBankSolutions.jsx` has been upgraded to ~1100 lines by a previous agent. You now need to add the remaining features. Each task below is self-contained. Do them in order.
>
> **Rules for every task:**
> - Inline styles only — no Tailwind classes in this file
> - No new npm packages — everything uses what's already installed (react, react-router-dom v6, lucide-react)
> - Do not touch `AVAILABLE_SOLUTIONS`, `T.dark`, `T.light`, `KatexStyle`, or any existing imports
> - After each task, the file must compile with `npm run dev` — no broken JSX

---

## TASK 1 — URL Routing (useSearchParams sync)

**File:** `src/pages/QuestionBankSolutions.jsx`

**What:** Sync navigation state to the URL so browser back/forward works and links are shareable.

**Current situation:** `useSearchParams` is already imported. Navigation state (`view`, `selectedDept`, `selectedTerm`, `selectedCourse`, `selectedYear`) lives only in React state — URL never changes.

**Do this:**

1. In the main component, after `const navigate = useNavigate();`, add:
```js
const [searchParams, setSearchParams] = useSearchParams();
```

2. Add a `useEffect` that reads URL params on mount and restores state:
```js
useEffect(() => {
  const dept   = searchParams.get('dept');
  const term   = searchParams.get('term');
  const course = searchParams.get('course');
  const year   = searchParams.get('year');
  if (dept && AVAILABLE_SOLUTIONS[dept]) {
    setSelectedDept(dept);
    if (term) setSelectedTerm(term);
    if (course && AVAILABLE_SOLUTIONS[dept]?.[term]?.[course]) {
      setSelectedCourse(course);
      if (year === 'all') {
        setView('all');
      } else if (year) {
        setSelectedYear(year);
        setView('solutions');
      } else {
        setView('years');
      }
    } else if (term) {
      setView('courses');
    }
  }
}, []); // runs once on mount only
```

3. Replace the nav helper functions so they also update the URL:
```js
function goHome() {
  setView('home'); setSelectedCourse(null); setSelectedYear(null);
  setSolutionData(null); setSearchRaw('');
  setSearchParams({});
}
function goCourses() {
  setView('courses'); setSelectedYear(null); setSolutionData(null); setSearchRaw('');
  setSearchParams({ dept: selectedDept, term: selectedTerm });
}
function goYears(code) {
  setSelectedCourse(code); setSelectedYear(null); setSolutionData(null);
  setView('years'); setSearchRaw('');
  setSearchParams({ dept: selectedDept, term: selectedTerm, course: code });
}
function goSolutions(year) {
  setSelectedYear(String(year)); setView('solutions'); setSearchRaw('');
  setSearchParams({ dept: selectedDept, term: selectedTerm, course: selectedCourse, year: String(year) });
}
function goAll() {
  setView('all'); setSearchRaw('');
  setFilterYears(new Set()); setFilterTypes(new Set());
  setSearchParams({ dept: selectedDept, term: selectedTerm, course: selectedCourse, year: 'all' });
}
```

**Verify:** Navigate to a course year. URL should change to something like `?dept=ESE&term=Y2T1&course=CSE2113&year=2022`. Press browser back — should go to previous view.

---

## TASK 2 — Year Card Question Count

**File:** `src/pages/QuestionBankSolutions.jsx`

**What:** Show question count on year cards in the `years` view (e.g. "28 questions").

**Current situation:** Year cards show "AVAILABLE" badge only. The probing effect already fetches HEAD requests to check which years exist.

**Do this:**

1. Add state for year metadata, after `const [availableYears, setAvailableYears] = useState([]);`:
```js
const [yearMeta, setYearMeta] = useState({}); // { '2022': { count: 28 } }
```

2. Replace the existing year probing `useEffect` with one that also fetches question count:
```js
useEffect(() => {
  if (!selectedCourse || !selectedDept || !selectedTerm) { setAvailableYears([]); return; }
  let cancelled = false;
  setYearMeta({});
  Promise.all(
    PROBE_YEARS.map(year =>
      fetch(`/solutions/${selectedDept}/${selectedTerm}/${selectedCourse}/${year}.json`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return null;
          if (!cancelled) {
            setYearMeta(prev => ({ ...prev, [String(year)]: { count: data.questions?.length || 0 } }));
          }
          return year;
        })
        .catch(() => null)
    )
  ).then(results => {
    if (!cancelled) setAvailableYears(results.filter(Boolean).sort((a, b) => b - a));
  });
  return () => { cancelled = true; };
}, [selectedDept, selectedTerm, selectedCourse]);
```

Note: This replaces the HEAD-only probe with a full JSON fetch. The JSON files are small (~30KB max) so this is fine.

3. In the `years` view JSX, find the available year card and add count below "AVAILABLE" badge:
```jsx
// Find this:
<div style={{ marginTop: 8, fontSize: 9.5, background: t.accentGlow, color: t.accent, borderRadius: 4, padding: '2px 7px', display: 'inline-block', fontWeight: 700, letterSpacing: '0.07em' }}>AVAILABLE</div>

// Add after it:
{yearMeta[String(year)]?.count > 0 && (
  <div style={{ fontSize: 10, color: t.textMut, marginTop: 4 }}>
    {yearMeta[String(year)].count} questions
  </div>
)}
```

**Verify:** Go to years view — each year card should show "28 questions" or similar count below "AVAILABLE".

---

## TASK 3 — Frequency Analysis Tab ("All Years" view)

**File:** `src/pages/QuestionBankSolutions.jsx`

**What:** Add a "Analysis" tab in the all-years view that shows a topic/type frequency table across years.

**Do this:**

1. Add tab state inside the main component:
```js
const [allViewTab, setAllViewTab] = useState('questions'); // 'questions' | 'analysis'
```
Reset it in `goAll()`: add `setAllViewTab('questions');`

2. Add a frequency computation (as a `useMemo`, after the existing `allUniqueTypes` memo):
```js
const frequencyData = useMemo(() => {
  if (allMergedQuestions.length === 0) return [];
  const types = allUniqueTypes.length > 0 ? allUniqueTypes : ['theory', 'numerical', 'programming'];
  const years = allUniqueYears;
  return types.map(type => {
    const byYear = {};
    let total = 0;
    years.forEach(y => {
      const count = allMergedQuestions.filter(q => q._year === y && q.type === type).length;
      byYear[y] = count;
      total += count;
    });
    return { type, byYear, total };
  }).filter(row => row.total > 0)
    .sort((a, b) => b.total - a.total);
}, [allMergedQuestions, allUniqueTypes, allUniqueYears]);
```

3. In the `all` view JSX, after the `!allLoading && allMergedQuestions.length > 0 &&` check, add tab bar before the filter bar:

```jsx
{/* Tab selector */}
<div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: `1px solid ${t.border}`, paddingBottom: 0 }}>
  {[
    { id: 'questions', label: `Questions (${allMergedQuestions.length})` },
    { id: 'analysis',  label: '📊 Analysis' },
  ].map(tab => (
    <button key={tab.id} onClick={() => setAllViewTab(tab.id)} style={{
      padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
      fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
      color: allViewTab === tab.id ? t.accent : t.textMut,
      borderBottom: `2px solid ${allViewTab === tab.id ? t.accent : 'transparent'}`,
      marginBottom: -1, transition: 'color .15s',
    }}>{tab.label}</button>
  ))}
</div>
```

4. Wrap the existing filter+questions JSX in `{allViewTab === 'questions' && (...)}` and add analysis view:

```jsx
{allViewTab === 'analysis' && frequencyData.length > 0 && (
  <div>
    <div style={{ fontSize: 13, color: t.textSub, marginBottom: 14 }}>
      Question type frequency across {allUniqueYears.length} exam years
    </div>
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', fontSize: 12.5, borderRadius: 8, overflow: 'hidden', border: `1px solid ${t.border}` }}>
        <thead>
          <tr style={{ background: t.numBg }}>
            <td style={{ padding: '9px 14px', fontWeight: 700, color: t.numText, borderBottom: `2px solid ${t.border}` }}>Type</td>
            {allUniqueYears.map(y => (
              <td key={y} style={{ padding: '9px 10px', fontWeight: 700, color: t.numText, textAlign: 'center', borderBottom: `2px solid ${t.border}` }}>{y}</td>
            ))}
            <td style={{ padding: '9px 10px', fontWeight: 700, color: t.accent, textAlign: 'center', borderBottom: `2px solid ${t.border}` }}>Total</td>
          </tr>
        </thead>
        <tbody>
          {frequencyData.map((row, ri) => (
            <tr key={row.type} style={{ background: ri % 2 === 0 ? t.surface : t.card }}>
              <td style={{ padding: '8px 14px', fontWeight: 600, color: t.text, textTransform: 'capitalize', borderRight: `1px solid ${t.borderSub}` }}>{row.type}</td>
              {allUniqueYears.map(y => (
                <td key={y} style={{ padding: '8px 10px', textAlign: 'center', color: row.byYear[y] > 0 ? t.text : t.textMut, borderRight: `1px solid ${t.borderSub}` }}>
                  {row.byYear[y] > 0 ? row.byYear[y] : '—'}
                </td>
              ))}
              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: t.accent }}>{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}
```

**Verify:** In all-years view, click "Analysis" tab — table should show type × year frequency grid.

---

## TASK 4 — Derivation Segment Parser (FLUID / Math courses)

**File:** `src/pages/QuestionBankSolutions.jsx`

**What:** Detect and visually render structured derivation steps in `detailed_answer` text. Applies when answer text contains "Given:", "Step N:", "Result:", etc. (common in FLUID/math questions).

**Do this:**

1. Add `parseDerivationSegments` function after the existing `parseAnswer` function:

```js
// Detects derivation structure in text. Returns null if no structure found.
function parseDerivationSegments(text) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const hasGiven  = lines.some(l => /^given[:\s]/i.test(l));
  const hasStep   = lines.some(l => /^step\s*\d+/i.test(l));
  const hasResult = lines.some(l => /^(result|ans|∴|therefore)[:\s]/i.test(l));
  // Only activate for content that clearly has derivation structure
  if (!((hasGiven || hasResult) && hasStep)) return null;

  const segments = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^given[:\s]/i.test(line)) {
      const items = [line.replace(/^given[:\s]*/i, '').trim()].filter(Boolean);
      i++;
      while (i < lines.length && !/^(find|step\s*\d+|result|ans|∴)/i.test(lines[i])) {
        if (lines[i]) items.push(lines[i]);
        i++;
      }
      segments.push({ type: 'given', items }); continue;
    }

    if (/^find[:\s]/i.test(line)) {
      segments.push({ type: 'find', text: line.replace(/^find[:\s]*/i, '') });
      i++; continue;
    }

    if (/^step\s*\d+/i.test(line)) {
      const num   = parseInt(line.match(/\d+/)[0]);
      const label = line.replace(/^step\s*\d+[:\s—-]*/i, '').trim();
      const content = [];
      i++;
      while (i < lines.length && !/^step\s*\d+/i.test(lines[i]) && !/^(result|ans|∴)/i.test(lines[i])) {
        content.push(lines[i]);
        i++;
      }
      segments.push({ type: 'step', num, label, content }); continue;
    }

    if (/^(result|ans|∴|therefore)[:\s]/i.test(line)) {
      segments.push({ type: 'result', text: line.replace(/^(result|ans|∴|therefore)[:\s]*/i, '') });
      i++; continue;
    }

    segments.push({ type: 'prose', text: line });
    i++;
  }
  return segments.length > 2 ? segments : null;
}
```

2. Add `DerivationBlock` render component after `EquationBlock`:

```jsx
function DerivationBlock({ segments, t }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {segments.map((seg, i) => {
        if (seg.type === 'given') return (
          <div key={i} style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#93C5FD', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>● Given</div>
            {seg.items.map((item, j) => (
              <div key={j} style={{ fontSize: 13, color: t.text, lineHeight: 1.8, fontFamily: item.includes('=') ? "'JetBrains Mono',monospace" : 'inherit' }}>
                <InlineMathLine text={item} t={t} mathStyle={isMathLine(item)} />
              </div>
            ))}
          </div>
        );

        if (seg.type === 'find') return (
          <div key={i} style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#FCD34D', letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>Find:</span>
            <span style={{ fontSize: 13, color: t.text }}><InlineMathLine text={seg.text} t={t} mathStyle={isMathLine(seg.text)} /></span>
          </div>
        );

        if (seg.type === 'step') return (
          <div key={i} style={{ paddingLeft: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ background: t.accent, color: '#000', borderRadius: 4, fontSize: 9.5, fontWeight: 800, padding: '2px 8px', fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>STEP {seg.num}</span>
              {seg.label && <span style={{ fontSize: 12.5, fontWeight: 600, color: t.textSub }}>{seg.label}</span>}
            </div>
            <div style={{ paddingLeft: 14, borderLeft: `2px solid ${t.border}` }}>
              {seg.content.map((line, j) => (
                hasLatex(line) || (line.startsWith('$$') && line.endsWith('$$'))
                  ? <EquationBlock key={j} content={line} t={t} />
                  : <div key={j} style={{ fontSize: 13, color: t.text, lineHeight: 1.75 }}>
                      <InlineMathLine text={line} t={t} mathStyle={isMathLine(line)} />
                    </div>
              ))}
            </div>
          </div>
        );

        if (seg.type === 'result') return (
          <div key={i} style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#4ADE80', fontSize: 16, flexShrink: 0 }}>✓</span>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#4ADE80' }}>
              <InlineMathLine text={seg.text} t={t} mathStyle={isMathLine(seg.text)} />
            </div>
          </div>
        );

        return (
          <div key={i} style={{ fontSize: 13.5, color: t.text, lineHeight: 1.85 }}>
            {renderInlineCode(seg.text, t)}
          </div>
        );
      })}
    </div>
  );
}
```

3. In the `AnswerBlock` component, modify the `detailed_answer` rendering section inside `QuestionCard`. Find where `q.detailed_answer` is passed to `<AnswerBlock>` and wrap it:

Actually: modify `AnswerBlock` itself to try derivation first. Replace the `AnswerBlock` function's opening:

```jsx
function AnswerBlock({ text, t, tryDerivation = false }) {
  if (tryDerivation) {
    const derivSegs = parseDerivationSegments(text);
    if (derivSegs) return <DerivationBlock segments={derivSegs} t={t} />;
  }
  const segs = parseAnswer(text);
  // ... rest unchanged
```

4. In `QuestionCard`, find the Full Solution section and add `tryDerivation`:
```jsx
// Find:
<AnswerBlock text={q.detailed_answer} t={t} />
// Inside the "Full Solution" expanded section — change to:
<AnswerBlock text={q.detailed_answer} t={t} tryDerivation />
```

**Verify:** Open a FLUID Mechanics (ME2115) question that has "Given:", "Step 1:", "Result:" in its detailed_answer. It should render with colored blocks instead of plain text.

---

## TASK 5 — Formula Reference Panel (FLUID course)

**File:** `src/pages/QuestionBankSolutions.jsx`

**What:** When viewing ME2115 (Fluid Mechanics), show a collapsible formula sheet button in the header area.

**Do this:**

1. Add formula data constant after `TYPE_COLORS`:

```js
const FORMULA_SHEETS = {
  ME2115: [
    { name: 'Continuity',             tex: 'A_1 V_1 = A_2 V_2' },
    { name: 'Bernoulli',              tex: '\\frac{p}{\\rho g} + \\frac{V^2}{2g} + z = C' },
    { name: 'Reynolds Number',        tex: 'Re = \\frac{\\rho V D}{\\mu}' },
    { name: "Newton's Viscosity",     tex: '\\tau = \\mu \\dfrac{du}{dy}' },
    { name: 'Kinematic Viscosity',    tex: '\\nu = \\dfrac{\\mu}{\\rho}' },
    { name: 'Darcy-Weisbach',         tex: 'h_f = f\\dfrac{L}{D}\\dfrac{V^2}{2g}' },
    { name: 'Hydrostatic Pressure',   tex: 'p = \\rho g h' },
    { name: 'Discharge',              tex: 'Q = A \\cdot V' },
  ],
};
```

2. Add formula panel state in the main component:
```js
const [showFormulas, setShowFormulas] = useState(false);
```

3. Add `FormulaPanel` component (before main component export):

```jsx
function FormulaPanel({ courseCode, t, onClose }) {
  const formulas = FORMULA_SHEETS[courseCode];
  if (!formulas) return null;
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12,
      padding: '14px', marginBottom: 16,
      boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: t.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>📐 Formula Sheet — {courseCode}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMut, fontSize: 16, padding: '0 4px' }}>×</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        {formulas.map((f, i) => (
          <div key={i} style={{ background: t.card, border: `1px solid ${t.borderSub}`, borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: t.textMut, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{f.name}</div>
            <MathSpan src={f.tex} display={false} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

4. In the `solutions` and `all` views, add formula toggle button in the meta/header area. Find the existing meta bar in the `solutions` view (the one with "Course", "Exam", "Questions" info) and add a button to its right side:

```jsx
// After the "All years" button in the solutions view meta bar, add:
{FORMULA_SHEETS[selectedCourse] && (
  <button onClick={() => setShowFormulas(v => !v)} style={{
    background: showFormulas ? t.accentGlow : t.surface,
    color: showFormulas ? t.accent : t.textMut,
    border: `1px solid ${showFormulas ? t.accent + '40' : t.border}`,
    borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', gap: 5,
  }}>
    📐 Formulas
  </button>
)}
```

5. Render the panel in both `solutions` and `all` views, directly after the meta bar and before the search box:
```jsx
{showFormulas && <FormulaPanel courseCode={selectedCourse} t={t} onClose={() => setShowFormulas(false)} />}
```

**Verify:** Open ME2115 (Fluid Mechanics) any year. A "📐 Formulas" button should appear in the header. Click it — formula sheet with KaTeX renders below.

---

## TASK 6 — Scroll to Top Button

**File:** `src/pages/QuestionBankSolutions.jsx`

**What:** Show a "↑ Top" floating button when user has scrolled down more than 400px in solutions/all views.

**Do this:**

1. Add scroll state in main component:
```js
const [showScrollTop, setShowScrollTop] = useState(false);
useEffect(() => {
  function onScroll() { setShowScrollTop(window.scrollY > 400); }
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}, []);
```

2. Add scroll-to-top button in the JSX of both `solutions` and `all` views, just before the closing `</div>` of `s.wrap`:

```jsx
{showScrollTop && (
  <button
    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    style={{
      position: 'fixed', bottom: 80, right: 20, zIndex: 100,
      background: t.accent, color: '#fff', border: 'none', borderRadius: 24,
      padding: '9px 16px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
      boxShadow: '0 4px 16px rgba(0,0,0,0.25)', fontFamily: 'inherit',
      display: 'flex', alignItems: 'center', gap: 5,
    }}
  >
    ↑ Top
  </button>
)}
```

**Verify:** Open a year with many questions. Scroll down — "↑ Top" button appears. Click it — scrolls to top.

---

## TASK 7 — Print / Export

**File:** `src/pages/QuestionBankSolutions.jsx`

**What:** Add a print button that triggers browser print with clean layout (no nav, no sidebar).

**Do this:**

1. Add CSS to `KatexStyle` component's `<style>` string. Find the closing backtick of the style template literal and add:

```css
@media print {
  body > * { display: none !important; }
  .qs-print-area { display: block !important; }
  .qs-no-print { display: none !important; }
  .q-card-body { max-height: none !important; }
}
```

2. Add a print button in the solutions view meta bar (same area as "All years" button):

```jsx
<button onClick={() => window.print()} style={{
  background: t.surface, color: t.textMut, border: `1px solid ${t.border}`,
  borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', gap: 5,
}} className="qs-no-print">
  🖨️ Print
</button>
```

3. Wrap the entire solutions content div with `className="qs-print-area"`:
```jsx
<div className="qs-print-area" style={{ display: 'block' }}>
  {/* all solutions content */}
</div>
```

**Verify:** In solutions view, click "🖨️ Print" — browser print dialog opens. Only the questions show, not the sidebar or navbar (because the global layout hides with `display:none`).

---

## TASK 8 — Bookmark Filter in "All Years" View

**File:** `src/pages/QuestionBankSolutions.jsx`

**What:** Add a "Saved only" filter chip in the all-years view filter bar so students can view only their bookmarked questions.

**Do this:**

1. Add filter state:
```js
const [filterBookmarked, setFilterBookmarked] = useState(false);
```
Reset in `goAll()`: add `setFilterBookmarked(false);`

2. In `filteredAllQuestions` useMemo, add a bookmarks filter at the start:
```js
// After: let qs = allMergedQuestions;
// Add:
if (filterBookmarked) {
  qs = qs.filter(q => {
    const key = `${selectedDept}_${selectedTerm}_${selectedCourse}_${q._year || ''}_${q.id}`;
    return bookmarks.has(key);
  });
}
```

3. In the `FilterBar` component call inside the `all` view, it currently receives certain props. The `FilterBar` component renders pills for years and types. Add a "Saved" pill after the type pills section. Find the filter bar area and add:

```jsx
{/* Add inside the filter bar area, after type pills */}
<button onClick={() => { setFilterBookmarked(v => !v); setVisibleCount(20); }} style={{
  fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, cursor: 'pointer',
  border: `1px solid ${filterBookmarked ? '#FBBF24' : t.border}`,
  background: filterBookmarked ? 'rgba(251,191,36,0.12)' : 'transparent',
  color: filterBookmarked ? '#FBBF24' : t.textMut,
  transition: 'all .12s', display: 'flex', alignItems: 'center', gap: 4,
}}>
  ⭐ Saved{filterBookmarked && bookmarks.size > 0 ? ` (${bookmarks.size})` : ''}
</button>
```

**Verify:** Bookmark some questions. Go to all-years view. Click "⭐ Saved" — only bookmarked questions show.

---

## TASK 9 — Final Wiring Check

After completing all tasks above, do these checks:

### Check 1 — No duplicate state declarations
```bash
grep -n "useState" src/pages/QuestionBankSolutions.jsx | grep -v "//\|import" | awk -F"const \[" '{print $2}' | awk -F"," '{print $1}' | sort | uniq -d
```
Output should be empty (no duplicates).

### Check 2 — All new functions exist
```bash
grep -n "function parseDerivationSegments\|function DerivationBlock\|function FormulaPanel" src/pages/QuestionBankSolutions.jsx
```
Should show 3 results.

### Check 3 — AVAILABLE_SOLUTIONS unchanged
```bash
grep -A8 "^const AVAILABLE_SOLUTIONS" src/pages/QuestionBankSolutions.jsx
```
Must still show:
```
ESE: {
  Y2T1: {
    CSE2113: { name: 'Computer Programming', courseCode: 'CSE 2113' },
    ME2115:  { name: 'Fluid Mechanics',       courseCode: 'ME 2115'  },
```

### Check 4 — Build passes
```bash
npm run build
```
No errors. `dist/` folder created.

### Check 5 — Manual browser test
Open `npm run dev` → `http://localhost:5173/question-bank/solutions`

Test these flows:
- [ ] Navigate to ME2115 2022 → URL updates → browser back works
- [ ] Year cards show question count
- [ ] All years view → Analysis tab shows frequency table
- [ ] FLUID question with derivation renders Given/Step/Result blocks
- [ ] "📐 Formulas" button shows formula sheet for ME2115
- [ ] Bookmark a question → go to all years → "⭐ Saved" filter works
- [ ] Scroll down → "↑ Top" button appears
- [ ] Print button opens print dialog

---

## Reference — File Locations

| What | Where |
|------|-------|
| Main file | `src/pages/QuestionBankSolutions.jsx` |
| JSON solutions | `public/solutions/{DEPT}/{TERM}/{COURSE}/{YEAR}.json` |
| App routing | `src/App.jsx` line 94 — do not touch |
| Global theme | `src/hooks/useTheme.jsx` — do not import into Solutions |
| QB data | `src/data/questionbank/questionBankData.js` |

## Reference — Existing hooks in the upgraded file

| Hook/function | Purpose |
|---------------|---------|
| `useSolutionsTheme()` | Returns `{ t, dark, toggle }` — local theme with localStorage |
| `useDebounce(val, ms)` | Debounces search input |
| `useBookmarks()` | Returns `{ bookmarks: Set, toggleBookmark }` |
| `parseAnswer(text)` | Parses text into segments for rendering |
| `parseDerivationSegments(text)` | (Task 4) Parses Given/Step/Result structure |
| `getTypeColor(type)` | Returns color object for theory/numerical/programming |
| `isMathLine(text)` | Returns true if text looks like a math expression |

## Reference — localStorage keys used

| Key | What |
|-----|------|
| `kuetx-sol-theme` | `'dark'` or `'light'` |
| `kuetx-sol-bookmarks` | JSON array of bookmark keys |