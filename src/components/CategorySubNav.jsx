import { useEffect, useRef } from 'react';
import { Circle } from 'lucide-react';

/**
 * Sub-navigation bar shown at the top of a category's own view (e.g.
 * inside "Approvals" or "Staff & Roles"). Replaces the old BackBar,
 * which only offered a single "‹ Back to grid" action — every sibling
 * category is now one click away instead of requiring a trip back to
 * the grid first.
 *
 * Fully data-driven: pass the category registry array and it renders a
 * pill per entry, with the active one highlighted and a badge count if
 * `getCount` resolves > 0. Add a category to the registry and it shows
 * up here automatically — no changes needed in this file.
 *
 * `onBack` is intentionally unused now — since every category is already
 * one tap away via the pill row itself, a separate "‹ All categories"
 * link back to the top-level grid was a redundant extra step, not a
 * useful escape hatch. Kept as an accepted (ignored) prop so callers
 * don't need updating.
 */
export default function CategorySubNav({ categories, activeKey, onSelect, countCtx = {} }) {
  const rowRef = useRef(null);
  const activePillRef = useRef(null);

  // The pill row scrolls horizontally (.category-subnav-row is
  // overflow-x:auto) and this component re-renders fresh every time the
  // view changes, so without this the row silently resets to whatever
  // scroll position it happened to be at — leaving the just-selected
  // pill scrolled out of view instead of visible where the person
  // clicked/tapped it.
  //
  // Deliberately NOT using scrollIntoView here: with block:'nearest' it
  // can still nudge an ancestor's *vertical* scroll if the row isn't
  // perfectly in view top-to-bottom, which would move the whole page
  // out from under a mouse click — surprising on desktop and not what
  // this needs. Computing scrollLeft by hand guarantees this only ever
  // scrolls the pill row sideways, never the page, on mouse or touch.
  useEffect(() => {
    const row = rowRef.current;
    const pill = activePillRef.current;
    if (!row || !pill) return;
    const rowRect = row.getBoundingClientRect();
    const pillRect = pill.getBoundingClientRect();
    const overflowLeft = pillRect.left - rowRect.left;
    const overflowRight = pillRect.right - rowRect.right;
    if (overflowLeft < 0) {
      row.scrollBy({ left: overflowLeft, behavior: 'smooth' });
    } else if (overflowRight > 0) {
      row.scrollBy({ left: overflowRight, behavior: 'smooth' });
    }
  }, [activeKey]);

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="category-subnav-row" ref={rowRef}>
        {categories.map((cat) => {
          const Icon = Icons[cat.icon] || Circle;
          const active = cat.key === activeKey;
          const count = cat.getCount ? safeCount(cat, countCtx) : 0;
          return (
            <button
              key={cat.key}
              ref={active ? activePillRef : null}
              onClick={() => onSelect(cat.key)}
              className={`category-subnav-pill${active ? ' active' : ''}`}
            >
              <Icon size={14} />
              <span>{cat.label}</span>
              {count > 0 && <span className="category-subnav-badge">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function safeCount(cat, ctx) {
  try {
    return cat.getCount(ctx) || 0;
  } catch {
    return 0;
  }
}