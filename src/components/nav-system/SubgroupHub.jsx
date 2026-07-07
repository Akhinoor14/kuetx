import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { NAV } from '../../nav';

const GROUP_COLORS = {
  'Overview':    'var(--accent)',
  'Class Rep':   '#a78bfa',
  'Academics':   '#3b82f6',
  'Daily Life':  '#f59e0b',
  'Campus Life': '#f97316',
  'Tools':       '#64748b',
};

// Resolve the { title, items, color, icon } for a hub route from NAV.
// group: top-level group name (e.g. 'Campus Life', 'Class Rep', 'Daily Life')
// subgroup: optional subgroup name when the group has `subgroups` (e.g. 'Academic Core')
function resolveHub(group, subgroup) {
  const section = NAV.find(s => s.group === group);
  if (!section) return null;

  if (subgroup) {
    const sub = (section.subgroups || []).find(s => s.name === subgroup);
    if (!sub) return null;
    return {
      title: sub.name,
      items: sub.items,
      color: GROUP_COLORS[group] || 'var(--muted)',
      icon: sub.hubIcon || 'Circle',
    };
  }

  return {
    title: section.group,
    items: section.items || [],
    color: GROUP_COLORS[group] || 'var(--muted)',
    icon: section.hubIcon || 'Circle',
  };
}

export default function SubgroupHub({ group, subgroup }) {
  const hub = resolveHub(group, subgroup);

  if (!hub) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'var(--muted)' }}>This section isn't available.</p>
      </div>
    );
  }

  const { title, items, color, icon } = hub;
  const HeaderIcon = Icons[icon] || Icons.Circle;

  return (
    <div style={{ padding: '20px 16px 40px', maxWidth: 880, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: `color-mix(in srgb, ${color} 15%, var(--surface))`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <HeaderIcon size={18} color={color} />
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</h1>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 10,
      }}>
        {items.map(item => {
          const Icon = Icons[item.icon] || Icons.Circle;
          return (
            <Link
              key={item.id}
              to={item.path}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10,
                padding: '16px 14px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                textDecoration: 'none',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `color-mix(in srgb, ${color} 15%, var(--surface))`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={16} color={color} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
