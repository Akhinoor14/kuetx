// RoleSelectScreen.jsx
//
// RESTRUCTURE: this now runs AFTER account creation (Sign In/Up comes
// first), not before it — it's the step that fires right after a
// brand-new Register with no role decided yet. A real, non-anonymous
// auth.currentUser always exists by the time this renders (buildQueue()
// in App.jsx only ever pushes 'role-select' once that's true), so this
// is also where faculty-specific setup that needs a real uid — the
// institutional-email format check and the faculty/{uid} shell doc —
// now happens, instead of inside AuthModal's generic Register path.
//
// Purely local+server routing — writes users/{uid}.role (and, for
// Faculty, faculty/{uid}) to Firestore, grants no dashboard access on its
// own; 'faculty-verify' (the actual magic-link hard gate) still comes
// next for Faculty. Rendered full-screen and non-dismissable from
// App.jsx's queue, same as the 'auth'/'profile' steps.
//
// BUGFIX: this used to be a translucent rgba(0,0,0,0.5) overlay, so the
// half-loaded dashboard underneath was visible (dimmed) through it — looks
// unfinished/broken rather than intentional, and briefly leaks dashboard
// content that isn't this account's yet. Now a fully opaque, branded
// full-screen background — nothing behind it shows through at all.

import { useState } from 'react';
import { GraduationCap, User, Sparkles } from 'lucide-react';
import { setAccountRole, persistAccountRoleToServer } from '../lib/accountRole';
import { isFacultyEmailFormat } from '../lib/facultyEmailVerify';
import { createFacultyAccountDoc } from '../lib/facultySync';
import { auth } from '../lib/firebase';

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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const choose = async (role) => {
    setError('');

    if (role === 'teacher') {
      // Faculty-only gate (Deviation 1): checked here now instead of at
      // Register, since role (and therefore "does this need to be a KUET
      // institutional email") isn't known until this exact moment.
      const email = auth.currentUser?.email || '';
      if (!isFacultyEmailFormat(email)) {
        setError(
          "This doesn't look like a valid KUET institutional email " +
          '(a *.kuet.ac.bd address, not @stud.kuet.ac.bd). ' +
          'Faculty accounts need an institutional email — if you signed ' +
          'up with a personal address, use Student instead.'
        );
        return;
      }
    }

    setLoading(true);
    try {
      setAccountRole(role);
      await persistAccountRoleToServer(role);
      if (role === 'teacher') {
        // Faculty doc creation (verifiedAt: null) happens here now.
        // Under the auto-approval policy, faculty accounts are active as
        // soon as this doc exists; Blue Tick approval is handled separately
        // by the founder's manual verification queue, not by a client-side
        // faculty-verify step.
        await createFacultyAccountDoc(auth.currentUser.uid, auth.currentUser.email);
      }
      onSelect?.(role);
    } catch (err) {
      setError('Something went wrong saving your role. Please try again.');
    } finally {
      setLoading(false);
    }
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
            style={{ ...cardStyle, opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}
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
            style={{ ...cardStyle, opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}
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

        {error && (
          <div style={{
            marginTop: 16, fontSize: 12.5, color: 'var(--danger, #dc2626)',
            padding: '10px 12px', background: 'rgba(220,38,38,0.08)', borderRadius: 8,
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
