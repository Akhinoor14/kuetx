import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function Collapsible({
  title,
  subtitle,
  children,
  defaultCollapsed = true,
  storageKey,
  right,
  rightCollapsed, // optional: show when collapsed
  className = '',
  contentClassName = '',
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === 'open') setCollapsed(false);
      if (raw === 'closed') setCollapsed(true);
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, collapsed ? 'closed' : 'open');
    } catch {}
  }, [collapsed, storageKey]);

  return (
    <div className={`card collapsible-shell ${className}`}>
      <button
        className="collapsible-head"
        type="button"
        onClick={() => setCollapsed(v => !v)}
        aria-expanded={!collapsed}
      >
        <div className="collapsible-meta">
          <div className="collapsible-title">{title}</div>
          {subtitle ? <div className="collapsible-subtitle">{subtitle}</div> : null}
        </div>
        <div className="collapsible-right">
          {collapsed && rightCollapsed ? rightCollapsed : right}
          {collapsed ? <ChevronDown size={18} color="var(--muted)" /> : <ChevronUp size={18} color="var(--muted)" />}
        </div>
      </button>

      <div className={`collapsible-content ${collapsed ? 'is-collapsed' : 'is-open'} ${contentClassName}`}>
        <div className="collapsible-inner">{children}</div>
      </div>
    </div>
  );
}
