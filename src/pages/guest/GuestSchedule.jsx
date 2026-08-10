import GuestShell from '../../components/guest/GuestShell';
import { GUEST_SCHEDULE, GUEST_COURSES } from '../../data/guestDemoData';
import { CalendarClock } from 'lucide-react';

// GUEST MODE (Phase 2) — presentational-only demo page. Not the real
// Schedule.jsx (2,793 lines, 31 store/Firestore coupling points found in
// Phase 2.3's investigation) — see documentation/03-features/guest-mode/GUEST_MODE_PLAN_PROMPT.md Phase 2.3 status.
export default function GuestSchedule() {
  const courseTitle = (id) => GUEST_COURSES.find((c) => c.id === id)?.title || id;

  return (
    <GuestShell>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text)' }}>
        <CalendarClock size={18} style={{ color: 'var(--accent)' }} /> Weekly Schedule
      </div>
      {GUEST_SCHEDULE.map((day) => (
        <div key={day.day} style={{ padding: '1rem', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', marginBottom: '0.75rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>{day.day}</div>
          {day.slots.map((slot, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none', fontSize: '0.86rem' }}>
              <span style={{ color: 'var(--muted)' }}>{slot.time}</span>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{courseTitle(slot.courseId)}</span>
              <span style={{ color: 'var(--muted)' }}>{slot.room}</span>
            </div>
          ))}
        </div>
      ))}
    </GuestShell>
  );
}
