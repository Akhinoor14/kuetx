// SidebarNavShared.jsx
//
// Presentational-only pieces (row styling, section labels, the group->icon
// map) shared by SidebarNavStudent.jsx and SidebarNavFaculty.jsx. This file
// deliberately contains NO role logic and NO knowledge of NAV vs
// NAV_FACULTY — it only knows how to draw a row. Splitting rendering
// primitives out like this means the two nav lists can share a consistent
// look without either one importing the other's data or logic.

import { Link } from 'react-router-dom';
import { Circle } from 'lucide-react';
import { useState } from 'react';

export const GROUP_ICONS = {
  'Dashboard':   'Grid',
  'Profile':     'User',
  'Class Rep':   'Shield',
  'Academics':   'GraduationCap',
  'Daily Life':  'Sunrise',
  'Campus Life': 'Layers',
  'Tools':       'Wrench',
};

export function NavRow({ to, label, iconName, active, onClose, unreadCount = 0 }) {
  const Icon = Icons[iconName] || Circle;
  const [hovered, setHovered] = useState(false);
  const hasUnread = unreadCount > 0;

  return (
    <Link
      to={to}
      onClick={onClose}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px 8px 8px',
        borderRadius: 8,
        textDecoration: 'none',
        marginBottom: 1,
        borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
        transition: 'background 0.12s, color 0.12s, border-color 0.12s',
        background: active
          ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))'
          : hovered
          ? 'var(--inputBg)'
          : 'transparent',
      }}
    >
      <span style={{ position: 'relative', flexShrink: 0, display: 'inline-flex' }}>
        <Icon
          size={16}
          strokeWidth={active ? 2.4 : 1.8}
          style={{ color: active ? 'var(--accent)' : 'var(--muted)' }}
        />
        {hasUnread && (
          <span
            className="sidebar-notice-dot"
            style={{
              position: 'absolute', top: -3, right: -3,
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--accent)',
              boxShadow: '0 0 0 2px var(--surface)',
            }}
          />
        )}
      </span>
      <span style={{
        flex: 1,
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        color: active ? 'var(--accent)' : 'var(--text)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      {hasUnread && (
        <span style={{
          fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--accent)',
          borderRadius: 999, minWidth: 16, height: 16, padding: '0 4px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, lineHeight: 1,
        }}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}

export function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700,
      color: 'var(--muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      padding: '10px 10px 4px',
    }}>
      {children}
    </div>
  );
}

// Shared row-list renderer: takes an already-filtered nav source and draws
// it. Both SidebarNavStudent and SidebarNavFaculty call this with their own
// (never each other's) filtered nav array.
export function NavList({ filteredNav, location, onClose, unreadNoticeCount = 0 }) {
  return (
    <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 6px 16px' }}>
      {filteredNav.map((section, idx) => {
        const isHub = section.isSubgroup && !section.subgroups;

        if (isHub) {
          const active = location.pathname === section.hubPath
            || section.items.some(item => location.pathname === item.path
              || (item.path !== '/' && location.pathname.startsWith(item.path)));
          return (
            <div key={section.group}>
              {idx > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px', opacity: 0.6 }} />}
              <NavRow
                to={section.hubPath}
                label={section.group}
                iconName={section.hubIcon || GROUP_ICONS[section.group] || 'Circle'}
                active={active}
                onClose={onClose}
                unreadCount={(section.group === 'Notice' || section.group === 'Notices') ? unreadNoticeCount : 0}
              />
            </div>
          );
        }

        if (section.subgroups) {
          return (
            <div key={section.group}>
              {idx > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px', opacity: 0.6 }} />}
              <SectionLabel>{section.group}</SectionLabel>
              {section.subgroups.map(sub => {
                const subActive = location.pathname === sub.hubPath
                  || sub.items.some(item => location.pathname === item.path
                    || (item.path !== '/' && location.pathname.startsWith(item.path)));
                return (
                  <NavRow
                    key={sub.name}
                    to={sub.hubPath}
                    label={sub.name}
                    iconName={sub.hubIcon || 'Circle'}
                    active={subActive}
                    onClose={onClose}
                  />
                );
              })}
            </div>
          );
        }

        return (
          <div key={section.group}>
            {idx > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px', opacity: 0.6 }} />}
            <SectionLabel>{section.group}</SectionLabel>
            {section.items.map(item => (
              <NavRow
                key={item.id}
                to={item.path}
                label={item.label}
                iconName={item.icon}
                active={location.pathname === item.path}
                onClose={onClose}
              />
            ))}
          </div>
        );
      })}
    </nav>
  );
}
