// StatCard.jsx — shared presentational component.
//
// Extracted from Dashboard.jsx by DEMO_MODE_FULL_PLAN_PROMPT.md Phase B
// (student slice). Verified pure before the move (see plan-prompt Phase B
// Findings): props-only, no store/Firestore imports, no hooks. Used as-is
// by the real Dashboard.jsx AND by the student demo dashboard (Phase C)
// with demo-data props — same component, two different data sources, zero
// duplicated JSX.
import { Link } from 'react-router-dom';

export default function StatCard({ label, value, sub, color, bgColor, icon: Icon, to }) {
  const inner = (
    <div className="card" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      cursor: to ? 'pointer' : 'default',
      transition: 'all 0.2s',
      padding: '14px 16px',
      border: `1.5px solid ${color}20`,
      background: bgColor || 'rgba(var(--accentRGB), 0.02)',
      boxShadow: `0 4px 12px ${color}12`,
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 12,
      minHeight: 100
    }}>
      {/* Background accent blob */}
      <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: `${color}08` }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
        {Icon && <Icon size={20} color={color} strokeWidth={2.2} />}
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color: color, letterSpacing: '-0.02em', lineHeight: 1, zIndex: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, zIndex: 1, marginTop: 2 }}>{sub}</div>}
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}
