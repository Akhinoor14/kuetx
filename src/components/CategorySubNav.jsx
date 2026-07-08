import * as Icons from 'lucide-react';

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
 * `onBack` is optional; when provided a small "‹ All categories" link
 * sits above the pill row for jumping straight back to the grid.
 */
export default function CategorySubNav({ categories, activeKey, onSelect, onBack, countCtx = {} }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {onBack && (
        <button
          onClick={onBack}
          className="btn btn-sm btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12 }}
        >
          <Icons.ChevronLeft size={14} /> All categories
        </button>
      )}
      <div className="category-subnav-row">
        {categories.map((cat) => {
          const Icon = Icons[cat.icon] || Icons.Circle;
          const active = cat.key === activeKey;
          const count = cat.getCount ? safeCount(cat, countCtx) : 0;
          return (
            <button
              key={cat.key}
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
