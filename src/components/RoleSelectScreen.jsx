// RoleSelectScreen.jsx
//
// §5 Step 1 of the merged Faculty Module prompt — the very first onboarding
// step, shown before 'auth'/'profile'. This is the ONE deliberate exception
// to Deviation 3's "everything faculty-related is English-only" rule: role
// hasn't been chosen yet when this renders, so both student and faculty
// visitors see it, and it stays Bangla/bilingual like the rest of the
// pre-existing student-facing onboarding.
//
// Purely a local routing decision (accountRole.js) — writes nothing to
// Firestore, grants no access on its own. Rendered full-screen and
// non-dismissable from App.jsx's queue, same as the 'auth'/'profile' steps.

import { GraduationCap, User } from 'lucide-react';
import { setAccountRole } from '../lib/accountRole';

const cardStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
  padding: '28px 16px',
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  cursor: 'pointer',
  textAlign: 'center',
};

export default function RoleSelectScreen({ onSelect }) {
  const choose = (role) => {
    setAccountRole(role);
    onSelect?.(role);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 16,
    }}>
      <div style={{
        background: 'var(--bg)', borderRadius: 18, padding: 24,
        width: '100%', maxWidth: 480,
        border: '1px solid var(--border)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.28)',
      }}>
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>
            তুমি কি Student, নাকি Faculty Member?
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            এই বাছাই একবারই হবে — পরে আবার সাইন-ইন করলে জিজ্ঞেস করবে না।
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={cardStyle} onClick={() => choose('student')}>
            <User size={28} color="var(--accent)" />
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Student</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              Schedule, Marks, Attendance, CR টুলস
            </div>
          </div>

          <div style={cardStyle} onClick={() => choose('teacher')}>
            <GraduationCap size={28} color="var(--accent)" />
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Faculty Member</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              Class, Attendance ও Marks manage করার জন্য
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
