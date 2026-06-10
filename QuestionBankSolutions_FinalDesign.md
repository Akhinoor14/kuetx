# QuestionBankSolutions — Final Design (Master + Visual)

This file merges the Visual Design notes and the Master Plan into a single, actionable final design for the Solution Bank UI (desktop + mobile), CSS, math/derivation handling, and implementation steps.

---

## 1. Goal (one line)
Make QuestionCard readable, scannable, and responsive: collapse heavy content, keep Quick Answer visible, present derivations clearly, and provide consistent themeable CSS for both mobile and desktop.

## 2. Core UI Principles
- Three-layer card: Header (Q-number + question + badges), Quick Answer (peek), Expanded body (Full Solution, Bangla, Code).
- Strong visual hierarchy via size, color, and subtle dimming as sections descend.
- Color-coded left accent by `type` (theory / numerical / programming).
- Math: center/boxed KaTeX blocks with horizontal scroll on small screens.
- Code: tabbed MATLAB/Python with copy + collapse when long.
- Spacing: 4px base unit; card padding 14px, section gap 12px.

## 3. Final Component Anatomy
- Header (always visible)
  - `q-num` (mono badge 38–52px), `q-text` (14px, 600), `type` badge (9.5px)
  - click anywhere on header toggles expand
- Quick Answer (always visible)
  - `q-quick` strip, muted background, label `Quick Answer` (pill/dot style)
- Action row
  - `Full Solution` toggle, `Derivation Mode` (if derivation), bookmark/save on right
- Expanded body (`q-body`)
  - `Full Solution` (`q-section`)
  - `বাংলায় ব্যাখ্যা` (accent yellow block)
  - `Code` (tabbed `CodeBlock`) with copy and expand
  - `FormulaPanel` — optional course-level panel (ME/FLUID)

## 4. Key CSS (placed in `src/styles/questionbank.css`)
- Use JS to set theme variables on `:root` (done in `QuestionBankSolutions.jsx`): `--sol-card`, `--sol-text`, `--sol-accent`, `--sol-numbg`, `--sol-codebgm`, etc.
- Main rules included in `questionbank.css` (already added):
  - `.q-card`, `.q-header`, `.q-num`, `.q-text`, `.q-quick`, `.q-actions`, `.q-body`, `.q-section`
  - `.eq-block` with left accent, centered math, horizontal scroll on mobile
  - `.code-block` with tabbar, copy button, `pre` with `overflow-x:auto`
  - `.ans-table` with rounded table, hover rows
- Responsive overrides:
  - `@media (max-width:600px)`: collapse Q-number column to 38px, remove 64px left-indent from quick/sections, make filter pills horizontally scrollable.
  - `@media (min-width:900px)`: expand max-width to 980px.

## 5. Math & Derivation Rendering (FLUID etc.)
- Parse derivation segments using `parseDerivationSegments(text)`:
  - detect `Given:`, `Find:`, `Step N:`, `Result:` and return typed segments (`given`, `find`, `step`, `result`).
- Render segments with `DerivationBlock`:
  - `given`: subtle blue card with monospace lines
  - `find`: amber highlight
  - `step`: `STEP n` pill + bordered left content, each math line inside `.eq-block`
  - `result`: green result box with check
- KaTeX: lazy load once (kept), but render eq blocks as boxed with scrollable overflow to avoid horizontal cut off on mobile.

## 6. Code Blocks
- Use `CodeBlock` tabs for MATLAB/Python with:
  - top tab bar, copy button on right
  - preview first 20 lines, `show more` expands
  - font: `JetBrains Mono` 12.5px
  - background: `--sol-codebgm` / `--sol-codebgp`
- Add optional Prism.js later for syntax highlighting (priority 2).

## 7. Interaction & Microcopy
- Clicking header toggles expand; chevron rotates.
- Hover card: subtle lift and shadow.
- Copy success: change copy text/icon for 1.5s.
- Section labels use small colored dot + sentence case.

## 8. Accessibility & Performance
- Keyboard: enable focus on header and `Enter` toggles expand; `Ctrl+F` focuses search.
- Use `useDebounce` for search (220ms implemented) and highlight results later (priority 2).
- Avoid rendering all 300+ questions at once: paginate or virtualize in `all` view (visible 20 → load more). Implemented `visibleCount` and slice usage recommended.

## 9. File / Code Changes Made (so far)
- Added stylesheet import and variables wiring: `src/pages/QuestionBankSolutions.jsx` (sets `:root` variables from the `t` theme object).
- New CSS file: `src/styles/questionbank.css` (core card + responsive rules).
- Added classnames to `QuestionBankSolutions.jsx`: `page-header`, `icon-wrap`, `q-card`, `q-header`, `q-num`, `q-text`, `q-chevron`, `q-quick`, `q-actions`, `q-body`, `q-section`.

## 10. Remaining Implementation Tasks (recommended order)
1. Refactor remaining inline styles to CSS classes and variables (`QuestionCard`, `AnswerBlock`, `CodeBlock`) — reduces rerenders and centralizes design. (I can do this next.)
2. Implement `DerivationBlock` rendering using `parseDerivationSegments()` for derivation-heavy courses (ME/FLUID). (Priority: high for FLUID)
3. Add syntax highlighting with Prism.js (optional).
4. Add URL routing for question/year deep links and update `useEffect` to read `searchParams` (partially exists already). Make specific question link anchorable (e.g., `#Q12`).
5. Add bookmarks/`saved` view and `filterBookmarked` UI (some hooks already exist).
6. Add paginated/virtualized list for `all` view.
7. Implement FormulaPanel (course-specific) and Derivation Mode toggle.

## 11. Quick dev/test commands
- Start dev server (if using Vite / npm):

```powershell
npm install
npm run dev
```

(Adjust commands to your project script if different — `package.json` exists in repo root.)

## 12. Next step (pick one)
- I can refactor inline style blocks into CSS classes now (makes `questionbank.css` authoritative). OR
- I can implement the `DerivationBlock` parser + renderer to improve FLUID questions. OR
- I can wire Prism.js for code syntax highlighting.

Tell me which you prefer and I'll proceed.

---

File references:
- Visual design notes: [QuestionBankSolutions_VisualDesign.md](QuestionBankSolutions_VisualDesign.md)
- Master plan: [QuestionBankSolutions_MASTER.md](QuestionBankSolutions_MASTER.md)
- Final doc (this file): [QuestionBankSolutions_FinalDesign.md](QuestionBankSolutions_FinalDesign.md)

