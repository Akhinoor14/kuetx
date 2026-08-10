import GuestShell from '../../components/guest/GuestShell';
import { GUEST_COURSES, GUEST_MARKS } from '../../data/guestDemoData';
import { ClipboardList } from 'lucide-react';

// GUEST MODE (Phase 2) — presentational-only demo page. Not the real
// Marks.jsx — see documentation/03-features/guest-mode/GUEST_MODE_PLAN_PROMPT.md Phase 2.3 status. Marks.jsx is the
// lightest-coupled of the four target pages (7 store/Firestore hits, no
// live subscriptions) but still reads store.get()/getAllCourses()
// directly at multiple call sites, not via props — same blocker applies.
// No input fields here at all: entering marks is a write action, out of
// scope for guest mode entirely (per the plan's "guest cannot write
// anything, anywhere, ever").
export default function GuestMarks() {
  return (
    <GuestShell>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text)' }}>
        <ClipboardList size={18} style={{ color: 'var(--accent)' }} /> Marks
      </div>
      {GUEST_COURSES.map((c) => {
        const m = GUEST_MARKS[c.id] || {};
        const continuous = (m.ctTeacher1 || 0) + (m.ctTeacher2 || 0);
        const total = (m.hall || 0) + continuous;
        return (
          <div key={c.id} style={{ padding: '1rem', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--text)' }}>{c.title}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent)' }}>{total} / 300</div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
              <span>Hall: {m.hall || 0}</span>
              <span>CT: {continuous}</span>
            </div>
          </div>
        );
      })}
    </GuestShell>
  );
}
