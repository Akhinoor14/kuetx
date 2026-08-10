import GuestShell from '../../components/guest/GuestShell';
import { GUEST_PROFILE, GUEST_COURSES, GUEST_ATTENDANCE, GUEST_NOTICES } from '../../data/guestDemoData';
import { UserCircle, BookOpen, Bell } from 'lucide-react';

// GUEST MODE (Phase 2) — presentational-only demo page. NOTE: this is
// deliberately NOT the real Dashboard.jsx reused with injected data — see
// documentation/03-features/guest-mode/GUEST_MODE_PLAN_PROMPT.md Phase 2.3's BLOCKED status for why (Dashboard.jsx is
// too deeply coupled to store.js singletons and 3 live Firestore
// subscriptions to safely inject demo data into without a larger,
// separately-scoped refactor). This hand-built page reads only from
// guestDemoData.js — zero store.js calls, zero Firestore reads — and
// mirrors the real Dashboard's general shape (profile card, course list,
// notices) so a visitor gets a reasonable sense of the app. Every element
// here is read-only; there is nothing that writes anywhere.
export default function GuestDashboard() {
  const avgAttendance = Math.round(
    Object.values(GUEST_ATTENDANCE).reduce((sum, a) => sum + a.pct, 0) / Object.values(GUEST_ATTENDANCE).length
  );

  return (
    <GuestShell>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)', marginBottom: '1rem' }}>
        <UserCircle size={40} style={{ color: 'var(--accent)' }} />
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>{GUEST_PROFILE.name}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{GUEST_PROFILE.dept} · {GUEST_PROFILE.currentTerm} · Sec {GUEST_PROFILE.section}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ padding: '1rem', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--accent)' }}>{avgAttendance}%</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>Avg. Attendance</div>
        </div>
        <div style={{ padding: '1rem', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', textAlign: 'center' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--accent)' }}>{GUEST_COURSES.length}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>Courses This Term</div>
        </div>
      </div>

      <div style={{ padding: '1rem', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, marginBottom: '0.6rem' }}>
          <BookOpen size={16} style={{ color: 'var(--accent)' }} /> Courses
        </div>
        {GUEST_COURSES.map((c) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderTop: '1px solid var(--border)', fontSize: '0.88rem' }}>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{c.title}</span>
            <span style={{ color: 'var(--muted)' }}>{c.code}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '1rem', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, marginBottom: '0.6rem' }}>
          <Bell size={16} style={{ color: 'var(--accent)' }} /> Notices
        </div>
        {GUEST_NOTICES.map((n) => (
          <div key={n.id} style={{ padding: '0.5rem 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>{n.title}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{n.body}</div>
          </div>
        ))}
      </div>
    </GuestShell>
  );
}
