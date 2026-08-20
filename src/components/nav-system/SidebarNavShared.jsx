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
import { ICONS } from '../../lib/iconRegistry';
import { useState } from 'react';
import { preloadRoute } from '../../lib/routePreload';
import { perfMark } from '../../lib/perfLog';

export const GROUP_ICONS = {
  'Dashboard':   'Grid',
  'Profile':     'User',
  'Class Rep':   'Shield',
  'Academics':   'GraduationCap',
  'Daily Life':  'Sunrise',
  'Campus Life': 'Layers',
  'Tools':       'Wrench',
};

export function NavRow({ to, label, iconName, active, onClose, unreadCount = 0, dot = null }) {
  const Icon = ICONS[iconName] || Circle;
  const [hovered, setHovered] = useState(false);
  const hasUnread = unreadCount > 0;

  return (
    <Link
      to={to}
      onClick={() => { perfMark(`nav click -> ${to}`); onClose?.(); }}
      onMouseEnter={() => { setHovered(true); preloadRoute(to); }}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => preloadRoute(to)}
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
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {label}
        {/* Status dot — used by hub rows (Founder/Campus Lead/Class Rep)
            instead of a number badge: green = nothing pending, red =
            something needs review. Owner's explicit ask — a raw count
            next to a role name read as noisy; a color dot answers the
            only question that matters at a glance ("do I need to look?")
            without a number competing with the label for space. */}
        {dot && (
          <span style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: dot === 'red' ? 'var(--danger, #ef4444)' : 'var(--success, #22c55e)',
          }} />
        )}
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

// A path is only a genuine PARENT of another if it's followed by a '/'
// boundary — plain string prefix matching (location.pathname.startsWith
// (item.path)) wrongly treats e.g. '/faculty' as a match for
// '/faculty/profile', '/faculty/classes', etc. too, since they all
// literally start with the string '/faculty'. That made the Faculty
// Dashboard row (hubPath/path === '/faculty') stay highlighted on every
// other faculty page. Requiring the next character to be '/' (or an exact
// match) fixes this without needing a special-cased '/' exclusion like the
// student Dashboard row already had.
function isPathOrDescendant(pathname, itemPath) {
  if (pathname === itemPath) return true;
  return pathname.startsWith(itemPath.endsWith('/') ? itemPath : `${itemPath}/`);
}

// A path is only a genuine PARENT of another if it's followed by a '/'
// boundary — plain string prefix matching (pathname.startsWith(itemPath))
// wrongly treats e.g. '/faculty' as matching '/faculty/profile',
// '/faculty/classes', etc. too, since they all literally start with the
// string '/faculty'. Requiring a '/' boundary avoids that, while still
// correctly matching genuine descendant routes like
// '/faculty/classes/:assignmentId' under '/faculty/classes'.
function isPathDescendant(pathname, itemPath) {
  return pathname.startsWith(itemPath.endsWith('/') ? itemPath : `${itemPath}/`);
}

// Hub active-state matching: exact match always counts; descendant
// matching only applies when item.path is a genuine sub-page root
// (different from the section/subgroup's own hubPath) — a hub's
// self-referencing root item (e.g. the Faculty Dashboard row, whose single
// item.path === '/faculty' === its own hubPath) must NOT swallow every
// sibling faculty route just because they share that string prefix. See
// the Profile page screenshot report this fixed.
function isActiveItem(pathname, itemPath, hubPath) {
  if (pathname === itemPath) return true;
  if (itemPath === hubPath) return false; // self-referencing root — exact match only
  if (itemPath === '/') return false; // '/' would prefix-match everything
  return isPathDescendant(pathname, itemPath);
}

// Shared row-list renderer: takes an already-filtered nav source and draws
// it. Both SidebarNavStudent and SidebarNavFaculty call this with their own
// (never each other's) filtered nav array.
export function NavList({ filteredNav, location, onClose, unreadNoticeCount = 0, groupBadgeCounts = {} }) {
  return (
    <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 6px 16px' }}>
      {filteredNav.map((section, idx) => {
        const isHub = section.isSubgroup && !section.subgroups;

        if (isHub) {
          const active = location.pathname === section.hubPath
            || section.items.some(item => isActiveItem(location.pathname, item.path, section.hubPath));
          // Notice keeps its own dedicated prop/number badge (unread
          // messages aren't a "pending approval" count and predates this
          // generalized map). Every other hub (Admin/Founder/Campus
          // Lead/Class Rep) reads from groupBadgeCounts and renders as a
          // dot, not a number — red when count > 0, green when 0 — per
          // owner's explicit ask that a raw number next to the role name
          // read as noisy; the dot answers "do I need to look?" at a
          // glance instead.
          const isNoticeGroup = section.group === 'Notice' || section.group === 'Notices';
          const groupCount = groupBadgeCounts[section.group];
          const hasDot = !isNoticeGroup && groupCount !== undefined;
          return (
            <div key={section.group}>
              {idx > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px', opacity: 0.6 }} />}
              <NavRow
                to={section.hubPath}
                label={section.group}
                iconName={section.hubIcon || GROUP_ICONS[section.group] || 'Circle'}
                active={active}
                onClose={onClose}
                unreadCount={isNoticeGroup ? unreadNoticeCount : 0}
                dot={hasDot ? (groupCount > 0 ? 'red' : 'green') : null}
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
                  || sub.items.some(item => isActiveItem(location.pathname, item.path, sub.hubPath));
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
                active={item.matchPrefix
                  ? isActiveItem(location.pathname, item.path, null)
                  : location.pathname === item.path}
                onClose={onClose}
              />
            ))}
          </div>
        );
      })}
    </nav>
  );
}
