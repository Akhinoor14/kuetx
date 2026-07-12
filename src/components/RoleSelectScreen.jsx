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
//
// BUGFIX: this used to be a translucent rgba(0,0,0,0.5) overlay, so the
// half-loaded dashboard underneath was visible (dimmed) through it — looks
// unfinished/broken rather than intentional, and briefly leaks dashboard
// content that isn't this account's yet. Now a fully opaque, branded
// full-screen background — nothing behind it shows through at all.

import { GraduationCap, User, Sparkles } from 'lucide-react';
import { setAccountRole, persistAccountRoleToServer } from '../lib/accountRole';

const cardStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
  padding: '32px 20px',
  borderRadius: 18,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
};

export default function RoleSelectScreen({ onSelect }) {
  const choose = (role) => {
    setAccountRole(role);
    persistAccountRoleToServer(role);
    onSelect?.(role);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      // Fully opaque — a soft brand-tinted gradient, not a see-through dim.
      background: `
        radial-gradient(1200px 600px at 15% -10%, var(--accentSoft), transparent 60%),
        radial-gradient(900px 500px at 110% 110%, var(--accentSoft), transparent 55%),
        var(--bg)
      `,
    }}>
      <div style={{
        background: 'var(--surfaceGlassStrong, var(--card))',
        backdropFilter: 'blur(6px)',
        borderRadius: 22,
        padding: '32px 28px',
        width: '100%', maxWidth: 520,
        border: '1px solid var(--border)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.16)',
      }}>
        <div style={{ marginBottom: 26, textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px',
            background: 'var(--accentSoft)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={24} color="var(--accent)" />
          </div>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6, color: 'var(--text)' }}>
            Join KUETx as...
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Choose the role that fits you. This is a one-time setup — you won't be asked again.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div
            style={cardStyle}
            onClick={() => choose('student')}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: 'var(--accentSoft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <User size={26} color="var(--accent)" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Student</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              Access schedule, attendance, marks, question bank, and student tools.
            </div>
          </div>

          <div
            style={cardStyle}
            onClick={() => choose('teacher')}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: 'var(--accentSoft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GraduationCap size={26} color="var(--accent)" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Faculty Member</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              Manage classes, attendance, marks, and academic activities.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
