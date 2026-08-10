import GuestShell from '../../components/guest/GuestShell';
import { GUEST_COURSES, GUEST_ATTENDANCE } from '../../data/guestDemoData';
import { CalendarCheck, AlertTriangle } from 'lucide-react';

// GUEST MODE (Phase 2) — presentational-only demo page. Not the real
// Attendance.jsx (1,366 lines, 29 store/Firestore coupling points found
// in Phase 2.3's investigation) — see documentation/03-features/guest-mode/GUEST_MODE_PLAN_PROMPT.md Phase 2.3
// status. Every control here is display-only: no checkbox, no "mark
// present/absent" action exists on this page at all, since there's
// nothing to write to in guest mode.
const MIN_ATTENDANCE_PERCENT = 75; // mirrors store.js's threshold for demo purposes only

export default function GuestAttendance() {
  return (
    <GuestShell>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text)' }}>
        <CalendarCheck size={18} style={{ color: 'var(--accent)' }} /> Attendance
      </div>
      {GUEST_COURSES.map((c) => {
        const att = GUEST_ATTENDANCE[c.id] || { pct: 0, present: 0, total: 0 };
        const low = att.pct < MIN_ATTENDANCE_PERCENT;
        return (
          <div key={c.id} style={{ padding: '1rem', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>{c.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{att.present} / {att.total} classes</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: low ? '#dc2626' : 'var(--accent)' }}>{att.pct}%</div>
                {low && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#dc2626', fontWeight: 700 }}>
                    <AlertTriangle size={12} /> Below minimum
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </GuestShell>
  );
}
