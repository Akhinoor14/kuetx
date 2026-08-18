// components/shared/TodayActionRow.jsx
//
// One uniform one-line row style (icon + text + right-aligned
// action/status) for every item type in Dashboard's Today's Actions
// column — attendance, assignments, CR link-outs, errand status. Per
// HANDOFF_dashboard_today_actions.md: this was the user's main clutter
// concern, so every action type renders through this ONE component
// rather than inventing its own row styling.
//
// Two kinds of right-aligned content:
//   - `action`  — clickable (button behavior). Row itself is also
//                 clickable when `onClick` is passed (e.g. opens a modal).
//   - `status`  — plain text/badge, not clickable (e.g. errand count).
// Exactly one of `onClick`/`href` should be used per row; `href` renders
// a <Link> (for CR link-outs to /class-notices etc.), `onClick` renders
// a clickable <div> (for opening the attendance modal in-place).
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function TodayActionRow({ icon: Icon, iconColor = 'var(--accent)', title, subtitle, action, onClick, href, dark }) {
  const inner = (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 10,
        background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
        border: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.05)',
        cursor: (onClick || href) ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {Icon && (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={14} color={iconColor} />
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 10.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
            {subtitle}
          </div>
        )}
      </div>
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
        {action}
        {(onClick || href) && !action && <ChevronRight size={14} color="var(--muted)" />}
      </span>
    </div>
  );

  if (href) {
    return <Link to={href} style={{ textDecoration: 'none' }}>{inner}</Link>;
  }
  if (onClick) {
    return (
      <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}>
        {inner}
      </div>
    );
  }
  return inner;
}
