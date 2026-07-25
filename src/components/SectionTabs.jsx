// SectionTabs.jsx
//
// Small, reusable in-page tab bar for splitting a long single-scroll page
// into focused sections — used by ClassRoster.jsx (CR/ACR) and
// StaffDashboard.jsx (Campus Lead block) to replace their old "everything
// stacked in one scroll" layout.
//
// Mobile-first: horizontally scrollable row of pill buttons (same pattern
// as StaffDashboard's existing RoleTabBar), so on narrow screens tabs that
// don't fit just scroll sideways instead of wrapping awkwardly or shrinking
// text unreadably. No JS breakpoint logic needed — overflow-x handles it.
//
// tabs: [{ key, label, badge? }] — badge is an optional number; 0/undefined
// renders no badge dot at all, so tabs with nothing pending stay clean.

export default function SectionTabs({ tabs, active, onChange }) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 8,
        marginBottom: 14,
        borderBottom: '1px solid var(--border)',
      }}
    >
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(t.key)}
            className="btn btn-sm"
            style={{
              whiteSpace: 'nowrap',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: isActive ? 'var(--accentBg, #eef2ff)' : 'transparent',
              color: isActive ? 'var(--accent, #4f46e5)' : 'var(--muted)',
              border: isActive ? '1px solid var(--accent, #4f46e5)' : '1px solid var(--border)',
              fontWeight: isActive ? 700 : 500,
            }}
          >
            {t.label}
            {!!t.badge && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
                fontSize: 10.5, fontWeight: 800, lineHeight: 1,
                background: isActive ? 'var(--accent, #4f46e5)' : 'var(--danger, #dc2626)',
                color: '#fff',
              }}>
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
