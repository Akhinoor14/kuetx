import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarClock, CalendarCheck, ClipboardList } from 'lucide-react';

// GUEST MODE (Phase 2.5) — a small dedicated nav, not a fourth branch
// bolted onto Sidebar.jsx's existing student/faculty/provider conditional
// (per this section's own recommendation: "a thin new component is
// cleaner than forcing a fourth branch into Sidebar.jsx"). Only links to
// the four demo pages this plan scopes guest mode to — no 30+ route list.
const GUEST_LINKS = [
  { to: '/guest/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/guest/schedule', label: 'Schedule', icon: CalendarClock },
  { to: '/guest/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/guest/marks', label: 'Marks', icon: ClipboardList },
];

export default function GuestNav() {
  return (
    <nav style={{
      display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
      padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      {GUEST_LINKS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.5rem 0.85rem', borderRadius: 10,
            fontSize: '0.86rem', fontWeight: 700, textDecoration: 'none',
            color: isActive ? '#fff' : 'var(--text)',
            background: isActive ? 'var(--accent)' : 'transparent',
            border: isActive ? 'none' : '1px solid var(--border)',
          })}
        >
          <Icon size={15} /> {label}
        </NavLink>
      ))}
    </nav>
  );
}
