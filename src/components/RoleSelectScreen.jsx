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
// own. Faculty verification is manual-only now (Founder approves over
// WhatsApp — see ManualVerifyFallback.jsx) and isn't a blocking
// onboarding step; it's a route-level write-gate (RequireFaculty.jsx)
// the person can complete anytime from their Faculty profile page.
// Rendered full-screen and non-dismissable from App.jsx's queue, same as
// the 'auth'/'profile' steps.
//
// BUGFIX: this used to be a translucent rgba(0,0,0,0.5) overlay, so the
// half-loaded dashboard underneath was visible (dimmed) through it — looks
// unfinished/broken rather than intentional, and briefly leaks dashboard
// content that isn't this account's yet. Now a fully opaque, branded
// full-screen background — nothing behind it shows through at all.

import { useState } from 'react';
import { GraduationCap, User, Sparkles, Store } from 'lucide-react';
import { setAccountRole, persistAccountRoleToServer } from '../lib/accountRole';
import { createFacultyAccountDoc } from '../lib/facultySync';
import { createProviderShell } from '../lib/providerSync';
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
  // Provider signup needs a small detail form (name, phone) before the
  // providers/{uid} shell can be created (SERVICES_PROVIDER_PLAN.md §3 —
  // "পূর্ণ detail ফর্ম পূরণ করবে"), unlike Student/Faculty which need no
  // extra input at Role Select. Rather than a separate route/component,
  // this is a second local step inside the same screen — 'roles' (the
  // three cards) or 'provider-form' (the detail form), gated purely by
  // this component's own state, not the outer onboarding queue.
  const [step, setStep] = useState('roles');
  const [providerName, setProviderName] = useState('');
  const [providerPhone, setProviderPhone] = useState('');

  const choose = async (role) => {
    setError('');

    if (role === 'provider') {
      setStep('provider-form');
      return;
    }

    // Auth Simplification migration: the old faculty-only institutional-
    // email gate that used to live here has been removed. With Google
    // Sign-In as the only auth method, auth.currentUser.email is always a
    // personal Gmail address, not a KUET institutional address — this
    // check would now incorrectly block every real faculty member from
    // ever selecting the Faculty role. Institutional email verification
    // now happens at the Faculty Profile Setup step instead
    // (FacultyProfileSetupModal.jsx).

    setLoading(true);
    try {
      setAccountRole(role);
      await persistAccountRoleToServer(role);
      if (role === 'teacher') {
        // Faculty doc creation (verifiedAt: null) happens here now.
        // Under the manual verification policy, the account exists as
        // soon as this doc is created (so profile setup can proceed
        // right away), but Blue Tick approval — required for the real
        // /faculty/* routes — is handled separately by the Founder's
        // manual verification queue (AdminDashboard's Faculty → Pending
        // tab), not by any client-side self-verify step.
        await createFacultyAccountDoc(auth.currentUser.uid, auth.currentUser.email);
      }
      onSelect?.(role);
    } catch (err) {
      setError('Something went wrong saving your role. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const finishProviderSignup = async () => {
    setError('');
    if (!providerName.trim() || !providerPhone.trim()) {
      setError('নাম এবং ফোন নাম্বার দুটোই দিতে হবে।');
      return;
    }
    setLoading(true);
    try {
      setAccountRole('provider');
      await persistAccountRoleToServer('provider');
      // status: 'pending' at creation (§2, §4 Step 2) — Founder verifies
      // manually afterward; see providerSync.js's createProviderShell.
      await createProviderShell(auth.currentUser.uid, {
        displayName: providerName,
        phone: providerPhone,
        serviceType: 'salon',
      });
      onSelect?.('provider');
    } catch (err) {
      setError('Something went wrong submitting your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'provider-form') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
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
          width: '100%', maxWidth: 440,
          border: '1px solid var(--border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.16)',
        }}>
          <div style={{ marginBottom: 22, textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px',
              background: 'var(--accentSoft)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Store size={24} color="var(--accent)" />
            </div>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6, color: 'var(--text)' }}>
              Service Provider হিসেবে যোগ দিন
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              সাবমিট করার পর Founder সরাসরি যোগাযোগ করে verify করবেন।
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>নাম / দোকানের নাম</label>
              <input
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                placeholder="যেমন: Rafiq's Salon"
                style={{
                  width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--card)',
                  color: 'var(--text)', fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>ফোন নাম্বার</label>
              <input
                value={providerPhone}
                onChange={(e) => setProviderPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                style={{
                  width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--card)',
                  color: 'var(--text)', fontSize: 14,
                }}
              />
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

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              onClick={() => setStep('roles')}
              disabled={loading}
              className="btn btn-sm"
              style={{ flex: 1 }}
            >
              পিছনে
            </button>
            <button
              onClick={finishProviderSignup}
              disabled={loading}
              className="btn btn-primary btn-sm"
              style={{ flex: 2 }}
            >
              {loading ? 'পাঠানো হচ্ছে…' : 'সাবমিট করুন'}
            </button>
          </div>
        </div>
      </div>
    );
  }

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

          <div
            style={{ ...cardStyle, opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}
            onClick={() => choose('provider')}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: 'var(--accentSoft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Store size={26} color="var(--accent)" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Service Provider</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              Salon বা অন্যান্য সেবা প্রদানকারী হিসেবে যোগ দিন — বুকিং নিন, ম্যানেজ করুন।
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
