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
import { BookOpen, GraduationCap, User, Sparkles, Store, X } from 'lucide-react';
import { setAccountRole, persistAccountRoleToServer } from '../lib/accountRole';
import { createFacultyAccountDoc } from '../lib/facultySync';
import { createProviderShell } from '../lib/providerSync';
import { SERVICE_TYPES, PROVIDER_SIGNUP_TYPES, PROVIDER_SIGNUP_TYPE_LABELS_BN } from '../lib/serviceSync';
import { auth } from '../lib/firebase';
import { deleteMyAccount } from '../lib/accountDeletion';
import Modal from './Modal';
import GuideModal from './GuideModal';
import { PrivacyPolicyBody } from '../pages/PrivacyPolicy';

const cardStyle = {
  flex: 1,
  minWidth: 140,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
  padding: '28px 16px',
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
  const [guideOpen, setGuideOpen] = useState(false);
  // Provider signup needs a small detail form (name, phone) before the
  // providers/{uid} shell can be created (SERVICES_PROVIDER_PLAN.md §3 —
  // "পূর্ণ detail ফর্ম পূরণ করবে"), unlike Student/Faculty which need no
  // extra input at Role Select. Rather than a separate route/component,
  // this is a second local step inside the same screen — 'roles' (the
  // three cards) or 'provider-form' (the detail form), gated purely by
  // this component's own state, not the outer onboarding queue.
  const [step, setStep] = useState('roles');
  // Required Terms & Conditions / Privacy Policy checkbox — must be
  // checked before any role card can be chosen (§ policy requirement:
  // every new user hits Role Select right after signup, before any role
  // is decided, so this is the one guaranteed place to gate on it).
  // Points at the same /privacy page linked from Navbar.jsx's hamburger
  // menu (PrivacyPolicy.jsx — currently placeholder/trial content).
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [providerName, setProviderName] = useState('');
  const [providerPhone, setProviderPhone] = useState('');
  // Founder-verification gap fix: 'salon' used to be hardcoded with no
  // way for the provider to say otherwise, and there was no location
  // field at all — Founder had nothing to actually verify a request
  // against. serviceType uses PROVIDER_SIGNUP_TYPES — the same five
  // plan-approved categories already defined once in serviceSync.js
  // (SERVICE_TYPES), plus 'other' for a business that doesn't fit any of
  // them (§ new-category-demand decision: keep 'other' at signup/
  // verification time so a Founder can still onboard it, but don't add a
  // sixth card to the student-facing Services grid until there's real
  // demand for one — see serviceSync.js's PROVIDER_SIGNUP_TYPES comment).
  // 'other' reveals a free-text box for serviceTypeOther. location is
  // plain free-text address, no preset list.
  const [providerServiceType, setProviderServiceType] = useState(SERVICE_TYPES[0]);
  const [providerServiceTypeOther, setProviderServiceTypeOther] = useState('');
  const [providerLocation, setProviderLocation] = useState('');
  // Escape hatch: someone can land here by signing in with the wrong
  // Google account (e.g. a personal Gmail instead of the one they meant
  // to use). Before this, role-select was a dead end — no back button,
  // no sign-out, no way to retry with a different account.
  //
  // Calls deleteMyAccount (see lib/accountDeletion.js) — the permanent,
  // client-side deletion path this project uses (Spark plan, no Cloud
  // Functions; see docs/ACCOUNT_DELETION_PLAN.md). Deletes what the
  // client SDK can under current firestore.rules and queues the rest
  // (accountDeleteRequests/{uid}) for manual Founder cleanup. For an
  // account at THIS exact stage that's a non-issue in practice — nothing
  // has been created yet except an empty users/{uid} shell — but the
  // queued request still gets filed, same as any other deletion, so
  // there's one consistent cleanup path rather than a special case here.
  // No typed confirmation is asked for here (unlike the real
  // Settings > Delete Account flow) — there's no data on this account
  // yet for a confirmation step to protect against losing.
  const [signingOut, setSigningOut] = useState(false);

  const wrongAccount = async () => {
    setSigningOut(true);
    try {
      const email = auth.currentUser?.email;
      if (email) {
        await deleteMyAccount(email);
      } else {
        // No email on this session at all (shouldn't normally happen at
        // role-select, since Google sign-in always provides one) — fall
        // back to a plain sign-out rather than getting stuck with no
        // escape at all.
        await auth.signOut();
      }
    } catch (err) {
      setSigningOut(false);
      setError('আগের অ্যাকাউন্ট মুছে সাইন আউট করা যায়নি। আবার চেষ্টা করুন।');
    }
  };

  const choose = async (role) => {
    setError('');

    if (!agreedToTerms) {
      setError('চালিয়ে যাওয়ার আগে গোপনীয়তা নীতি ও শর্তাবলী মেনে নিতে হবে।');
      return;
    }

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
    if (!providerName.trim() || !providerPhone.trim() || !providerLocation.trim()) {
      setError('নাম, ফোন নাম্বার এবং ঠিকানা — সবগুলো দিতে হবে।');
      return;
    }
    if (providerServiceType === 'other' && !providerServiceTypeOther.trim()) {
      setError('আপনার সার্ভিসের ধরনটি লিখুন।');
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
        serviceType: providerServiceType,
        serviceTypeOther: providerServiceTypeOther,
        location: providerLocation,
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
              সার্ভিস প্রোভাইডার হিসেবে যোগ দিন
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
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>সার্ভিসের ধরন</label>
              <select
                value={providerServiceType}
                onChange={(e) => setProviderServiceType(e.target.value)}
                style={{
                  width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--card)',
                  color: 'var(--text)', fontSize: 14,
                }}
              >
                {PROVIDER_SIGNUP_TYPES.map((t) => (
                  <option key={t} value={t}>{PROVIDER_SIGNUP_TYPE_LABELS_BN[t]}</option>
                ))}
              </select>
            </div>
            {providerServiceType === 'other' && (
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>সার্ভিসের ধরন লিখুন</label>
                <input
                  value={providerServiceTypeOther}
                  onChange={(e) => setProviderServiceTypeOther(e.target.value)}
                  placeholder="যেমন: মোবাইল সার্ভিসিং"
                  style={{
                    width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10,
                    border: '1px solid var(--border)', background: 'var(--card)',
                    color: 'var(--text)', fontSize: 14,
                  }}
                />
              </div>
            )}
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>দোকানের ঠিকানা</label>
              <input
                value={providerLocation}
                onChange={(e) => setProviderLocation(e.target.value)}
                placeholder="যেমন: KUET মেইন গেটের পাশে, ২য় তলা"
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
        padding: '40px 36px',
        width: '100%', maxWidth: 760,
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
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4, color: 'var(--text)' }}>
            Join KUETx as...
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            One-time setup — you won't be asked again.
          </div>
          {auth.currentUser?.email && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
              সাইন ইন করা আছে <strong style={{ color: 'var(--text)' }}>{auth.currentUser.email}</strong> দিয়ে
              {' — ভুল অ্যাকাউন্ট? '}
              <button
                type="button"
                onClick={wrongAccount}
                disabled={signingOut || loading}
                style={{
                  background: 'none', border: 'none', padding: 0, margin: 0,
                  color: 'var(--accent)', fontWeight: 700, fontSize: 12,
                  textDecoration: 'underline', cursor: 'pointer',
                }}
              >
                {signingOut ? 'অ্যাকাউন্ট মুছে ফেলা হচ্ছে…' : 'এই অ্যাকাউন্ট মুছে অন্য অ্যাকাউন্ট দিয়ে ঢুকুন'}
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            style={{
              padding: '8px 12px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--accent)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}
          >
            <BookOpen size={14} /> KUETx Guide
          </button>
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div
            style={{ ...cardStyle, opacity: (loading || !agreedToTerms) ? 0.6 : 1, pointerEvents: (loading || !agreedToTerms) ? 'none' : 'auto' }}
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
          </div>

          <div
            style={{ ...cardStyle, opacity: (loading || !agreedToTerms) ? 0.6 : 1, pointerEvents: (loading || !agreedToTerms) ? 'none' : 'auto' }}
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
          </div>

          <div
            style={{ ...cardStyle, opacity: (loading || !agreedToTerms) ? 0.6 : 1, pointerEvents: (loading || !agreedToTerms) ? 'none' : 'auto' }}
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
          </div>
        </div>

        {/* Required Terms & Conditions / Privacy Policy checkbox — blocks
            all three role cards above until checked (see choose()'s
            agreedToTerms guard too).
            BUGFIX: this used to be an <a href="/privacy" target="_blank">,
            which opened a whole new browser tab — reads as an accidental
            redirect away from signup rather than a deliberate "read the
            terms" action, and since RoleSelectScreen renders as a
            full-screen blocking overlay outside the normal route tree
            (see App.jsx), it could strand the person mid-onboarding in a
            second tab with no way back to finish. Now a plain button that
            opens the same PrivacyPolicyBody content in an in-app Modal
            popup instead — no tab, no navigation, no route change. */}
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          marginTop: 22, cursor: 'pointer', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6,
        }}>
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => { setAgreedToTerms(e.target.checked); setError(''); }}
            style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
          />
          <span>
            আমি KUETx-এর{' '}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowTermsModal(true); }}
              style={{
                color: 'var(--accent)', fontWeight: 600, textDecoration: 'none',
                background: 'none', border: 'none', padding: 0, margin: 0,
                font: 'inherit', cursor: 'pointer',
              }}
            >
              গোপনীয়তা নীতি ও শর্তাবলী
            </button>
            {' '}পড়েছি এবং সম্মত আছি।
          </span>
        </label>

        {showTermsModal && (
          <Modal
            onClose={() => setShowTermsModal(false)}
            contentStyle={{
              background: 'var(--bg)',
              borderRadius: 16,
              width: '100%',
              maxWidth: 640,
              maxHeight: '85dvh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                গোপনীয়তা নীতি ও শর্তাবলী
              </div>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                aria-label="Close"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 6, display: 'flex', color: 'var(--muted)',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
              <PrivacyPolicyBody />
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => {
                  setAgreedToTerms(true);
                  setError('');
                  setShowTermsModal(false);
                }}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
                  background: 'var(--accent)', color: '#fff', fontWeight: 700,
                  fontSize: 13.5, cursor: 'pointer',
                }}
              >
                পড়েছি ও সম্মত আছি
              </button>
            </div>
          </Modal>
        )}

        <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />

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
