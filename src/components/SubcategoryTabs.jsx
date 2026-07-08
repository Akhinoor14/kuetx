/**
 * Second-level tabs, used inside a category view when that category has
 * a fixed handful of independent sibling sections (see founderCategories.js
 * for the distinction between this and a `drilldown` category, which uses
 * its own breadcrumb instead).
 *
 * Renders nothing if `subcategories` is empty/undefined — a category like
 * Communication, which is just one form, doesn't need this row at all.
 */
export default function SubcategoryTabs({ subcategories, activeKey, onSelect, countCtx = {} }) {
  if (!subcategories || subcategories.length === 0) return null;

  return (
    <div className="subcategory-tabs-row">
      {subcategories.map((sub) => {
        const active = sub.key === activeKey;
        const count = sub.getCount ? safeCount(sub, countCtx) : 0;
        return (
          <button
            key={sub.key}
            onClick={() => onSelect(sub.key)}
            className={`subcategory-tab${active ? ' active' : ''}`}
          >
            {sub.label}
            {count > 0 && <span className="subcategory-tab-badge">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function safeCount(sub, ctx) {
  try {
    return sub.getCount(ctx) || 0;
  } catch {
    return 0;
  }
}
