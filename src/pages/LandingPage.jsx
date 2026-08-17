// LandingPage.jsx — Phase A of DEMO_MODE_FULL_PLAN_PROMPT.md
// (documentation/03-features/guest-mode/DEMO_MODE_FULL_PLAN_PROMPT.md)
//
// Public "Guest Room" landing page, mounted at route `/` for signed-out
// visitors only. A signed-in account never sees this — App.jsx's root
// <Route> ternary (getAccountRole() check + RootRouteResolver) still runs
// first and redirects a signed-in session to its real dashboard before
// this component would ever render for them. This component's own
// RequireGuestMode wrapper (see App.jsx's new root route) is the second,
// server-verified layer of that same guarantee — see Phase 0's Findings
// #5 in the plan-prompt for why RequireGuestMode.jsx needed zero changes
// to be reused here.
//
// Phase A scope (per the plan-prompt): navbar + hero + 3 role cards with
// feature bullets. Clicking a role card sets `?role=<student|faculty|
// provider>` in the URL (client-side, no full navigation) — the actual
// demo dashboard content for each role is Phase C/D/E's job, not this
// file's. Until those phases land, selecting a role here shows a
// "coming soon" placeholder so the card-click interaction itself is
// already wired and testable.
//
// Desktop vs mobile mockup treatment (Phase A/H per the plan) is also
// deferred to Phase H for the full realistic-frame polish — this file
// wires the responsive branch point (useIsMobileNav, matching the rest
// of the app's breakpoint) so Phase H has a clean seam to build on
// rather than retrofitting responsive logic in afterward.

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wordmark } from '../components/Logo';
import {
  LogIn, GraduationCap, Presentation, Store, CheckCircle2,
  Monitor, Smartphone, ArrowLeft,
} from 'lucide-react';
import usePageMeta from '../hooks/usePageMeta';
import { useIsMobileNav } from '../components/BottomNav';
import AuthModal from '../components/AuthModal';
import SignInPrompt from '../components/SignInPrompt';
// Phase C of DEMO_MODE_FULL_PLAN_PROMPT.md — student role now renders the
// real demo dashboard instead of the placeholder. Phase D (D.2-D.6) added
// the faculty demo dashboard. Phase E adds the provider demo dashboard —
// all three roles now wired, DemoComingSoon is now dead code kept only as
// a fallback for any future unbuilt role.
import StudentDemoDashboard from '../components/StudentDemoDashboard';
import FacultyDemoDashboard from '../components/FacultyDemoDashboard';
import ProviderDemoDashboard from '../components/ProviderDemoDashboard';

// ─── Role card feature content ──────────────────────────────────────────
// Sourced from route-inventory + project history (memory), verified
// against App.jsx's actual route list — deliberately NOT derived from
// About.jsx's "Key Features" grid, which was found (Phase 0 investigation
// predecessor) to describe an older, single-user-tracker-era feature set
// that's missing CR Hub, Faculty Portal, Provider Marketplace, and the
// Question Bank system entirely. See the plan-prompt's "Role Card Feature
// Content (verified)" section — this array mirrors it exactly so the two
// stay in sync; if one changes, update the other.
const ROLE_CARDS = [
  {
    id: 'student',
    icon: GraduationCap,
    emoji: '🎓',
    title: 'Student',
    bullets: [
      'ক্লাস রুটিন, উপস্থিতি ও মার্কস ট্র্যাকিং — এক জায়গায়',
      'CR-পরিচালিত ক্লাস নোটিশ, roster, ও group কানেকশন',
      'কোর্স ম্যাটেরিয়াল, প্রশ্ন ব্যাংক ও সলিউশন',
      'ক্যাম্পাস সার্ভিস সরাসরি অর্ডার ও এরান্ড রিকোয়েস্ট',
    ],
  },
  {
    id: 'faculty',
    icon: Presentation,
    emoji: '👨‍🏫',
    title: 'Faculty',
    bullets: [
      'ক্লাস অ্যাটেন্ডেন্স ও মার্কস এন্ট্রি ডিজিটালি',
      'সরাসরি নোটিশ ব্রডকাস্ট নিজের ক্লাসে',
      'প্রশ্ন ব্যাংক আপলোড ও মিটিং শিডিউল',
      'সব CR ও ক্লাসের একসাথে ওভারভিউ',
    ],
  },
  {
    id: 'provider',
    icon: Store,
    emoji: '🏪',
    title: 'Provider',
    bullets: [
      'ক্যাম্পাসের ভেতরেই নিজের শপ/সার্ভিস চালু রাখা',
      'অর্ডার ও বুকিং রিয়েল-টাইমে ম্যানেজ করা',
      'ছাত্রছাত্রীদের সরাসরি ইনকোয়ারি হ্যান্ডল করা',
      'Errand request/delivery ট্র্যাকিং',
    ],
  },
];

// ─── Placeholder shown inside the mockup/full-screen area until Phase
// C/D/E build the real demo dashboards for each role. Kept intentionally
// minimal — this is scaffolding, not a deliverable UI. ─────────────────
function DemoComingSoon({ role }) {
  const card = ROLE_CARDS.find(r => r.id === role);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '0.75rem', padding: '2.5rem 1.5rem',
      textAlign: 'center', minHeight: '320px',
    }}>
      <div style={{ fontSize: '2.5rem' }}>{card?.emoji}</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)' }}>
        {card?.title} demo শীঘ্রই আসছে
      </div>
      <div style={{ fontSize: '0.88rem', color: 'var(--muted)', maxWidth: '320px', lineHeight: 1.6 }}>
        এই role-এর interactive preview এখনো বানানো হচ্ছে (Phase{' '}
        {role === 'student' ? 'C' : role === 'faculty' ? 'D' : 'E'}
        ) — ততক্ষণে সরাসরি সাইন আপ করে real app ব্যবহার শুরু করতে পারো।
      </div>
    </div>
  );
}

// Dispatches to the real demo dashboard for each role. All three
// (student/faculty/provider) are now wired as of Phase E; DemoComingSoon
// remains only as a fallback for any role id that doesn't match.
function DemoContent({ role }) {
  if (role === 'student') return <StudentDemoDashboard />;
  if (role === 'faculty') return <FacultyDemoDashboard />;
  if (role === 'provider') return <ProviderDemoDashboard />;
  return <DemoComingSoon role={role} />;
}

// ─── Adaptive mockup frame (desktop only) ───────────────────────────────
// Phase H's "halfway-realistic" decision (plan §Phase H trade-off table):
// not a full bezel/camera-dot/speaker-grille frame (heavy, per-device
// maintenance), not a bare rounded-rectangle either (no "this is a
// phone/browser" cue at all) — minimum cue only. Phone: thicker border +
// a notch-cutout at the top. Desktop: a browser-chrome dot bar with real
// traffic-light colors (red/yellow/green), not plain gray dots — that
// specific detail ("traffic-light dot bar") is named in the plan's own
// desktop-mockup description, previous pass's gray dots didn't quite
// match it.
function MockupFrame({ mode, children }) {
  const isPhone = mode === 'phone';
  return (
    <div style={{
      margin: '0 auto',
      width: isPhone ? '340px' : '100%',
      maxWidth: isPhone ? '340px' : '640px',
      border: isPhone ? '3px solid var(--border)' : '1.5px solid var(--border)',
      borderRadius: isPhone ? '36px' : '16px',
      background: 'var(--surface)',
      boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {isPhone ? (
        <div style={{ height: '26px', position: 'relative' }}>
          {/* Notch-cutout — a small centered pill at the very top, like a
              phone's camera/speaker cutout. Purely decorative (no real
              camera/speaker), just enough to read as "phone" at a glance. */}
          <div style={{
            position: 'absolute', top: '6px', left: '50%', transform: 'translateX(-50%)',
            width: '90px', height: '16px', borderRadius: '999px', background: 'var(--bg)',
            border: '1px solid var(--border)',
          }} />
        </div>
      ) : (
        <div style={{
          height: '32px', display: 'flex', alignItems: 'center', gap: '6px',
          padding: '0 12px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#febc2e' }} />
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#28c840' }} />
        </div>
      )}
      <div style={{ minHeight: isPhone ? '480px' : '360px' }}>
        {children}
      </div>
    </div>
  );
}

export default function LandingPage() {
  usePageMeta(
    'KUETx — The Digital Ecosystem for KUET',
    'KUETx দিয়ে দেখো Student, Faculty, আর Service Provider — এই তিন role-এর জন্য কী কী আছে। ক্লাস অ্যাটেন্ডেন্স, মার্কস, নোটিশ, প্রশ্ন ব্যাংক, ক্যাম্পাস সার্ভিস — সব একসাথে, একটাই অ্যাপে।'
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const isMobileNav = useIsMobileNav();
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Phase H: the "Sign In" navbar button (and, in future, any
  // write-trigger touched inside a demo view) opens SignInPrompt FIRST —
  // a short "why sign in" step — rather than AuthModal's full form
  // appearing with no lead-in. Confirming inside SignInPrompt swaps to
  // AuthModal; "পরে করবো" just closes it.
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  // Phase 1 (landing redesign): navbar now offers separate Sign In / Sign Up
  // entry points so a new visitor doesn't have to guess which one applies to
  // them. This is UI-only — AuthModal itself has no Login/Register branch
  // (Google Sign-In only, mode prop is a no-op), so both intents open the
  // exact same modal; this just changes the SignInPrompt copy/button label
  // shown first, to set the right expectation before Google's redirect.
  const [authIntent, setAuthIntent] = useState('signin'); // 'signin' | 'signup'
  const openAuth = (intent) => { setAuthIntent(intent); setShowSignInPrompt(true); };
  const [mockupMode, setMockupMode] = useState('desktop'); // desktop visitor default, per plan §3.2

  const selectedRole = searchParams.get('role');

  // Bookmark-redirect handling (plan §3.4): old /guest/* paths already
  // resolve on their own via App.jsx's existing PUBLIC_PATHS routes —
  // this component does not need to know about them. If Phase H's
  // cleanup step removes those routes, add the /guest/* → /?role=...
  // <Navigate> redirects there, not here.

  const selectRole = (roleId) => {
    setSearchParams(roleId ? { role: roleId } : {}, { replace: false });
  };

  const backToSelection = () => selectRole(null);

  // Mobile: selecting a role goes full-screen (no phone-mockup — see
  // plan §3.2's reasoning: a fake phone frame inside an already-small
  // real phone screen hurts touch targets and causes double-scroll).
  if (isMobileNav && selectedRole) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 5, display: 'flex',
          alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.8rem',
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        }}>
          <button
            type="button"
            onClick={backToSelection}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              background: 'transparent', border: 'none', color: 'var(--text)',
              fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', padding: '0.4rem',
            }}
          >
            <ArrowLeft size={16} /> ফিরুন
          </button>
          <div style={{ display: 'flex', gap: '0.35rem', flex: 1, justifyContent: 'center' }}>
            {ROLE_CARDS.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => selectRole(r.id)}
                style={{
                  padding: '0.35rem 0.7rem', borderRadius: '999px', fontSize: '0.78rem',
                  fontWeight: 700, border: '1px solid var(--border)', cursor: 'pointer',
                  background: selectedRole === r.id ? 'var(--accent)' : 'transparent',
                  color: selectedRole === r.id ? '#fff' : 'var(--text)',
                }}
              >
                {r.emoji} {r.title}
              </button>
            ))}
          </div>
          {/* Phase H: mobile full-screen branch returns early, before the
              desktop return's SignInPrompt/AuthModal block further down —
              so this branch needs its own Sign In entry point, not just
              the desktop one. Small icon-only button here (space is
              tight in this sticky bar) rather than the full Sign In/Sign Up
              label buttons the main navbar uses below — this is a secondary,
              mid-demo entry point, not the primary §11.1 navbar, so it stays
              a single combined icon (Phase 1) rather than splitting into two. */}
          <button
            type="button"
            onClick={() => openAuth('signin')}
            aria-label="Sign In"
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '34px', height: '34px', borderRadius: '10px',
              background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >
            <LogIn size={15} />
          </button>
        </div>
        <DemoContent role={selectedRole} />
        {showSignInPrompt && (
          <SignInPrompt
            intent={authIntent}
            onSignIn={() => { setShowSignInPrompt(false); setShowAuthModal(true); }}
            onClose={() => setShowSignInPrompt(false)}
          />
        )}
        {showAuthModal && (
          <AuthModal
            mode="login"
            intent={authIntent}
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => setShowAuthModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Navbar — logo + Sign In/Sign Up, sticky, non-forcing.
          Phase 1 (landing redesign, §11.1): split the single "Sign In"
          button into two separate entry points so a new visitor doesn't
          have to guess which one applies to them. Both open the exact
          same AuthModal (Google-only, no Login/Register branch) — see
          authIntent state above — this only changes the SignInPrompt
          copy shown first. Sign Up is visually primary (filled) since
          most navbar visitors are new; Sign In is secondary (outlined). */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        padding: '0.85rem 1.25rem', background: 'var(--surfaceGlassStrong)',
        backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)',
      }}>
        <Wordmark height={22} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => openAuth('signin')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.55rem 0.9rem', borderRadius: '12px',
              background: 'transparent', color: 'var(--text)',
              border: '1px solid var(--border)',
              fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => openAuth('signup')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.55rem 1rem', borderRadius: '12px',
              background: 'var(--accent)', color: '#fff', border: 'none',
              fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer',
            }}
          >
            <LogIn size={15} /> Sign Up
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '2.5rem 1.25rem 4rem' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{
            fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', fontWeight: 900,
            color: 'var(--text)', marginBottom: '0.6rem', letterSpacing: '-0.03em',
          }}>
            The Digital Ecosystem for KUET
          </h1>
          <p style={{ fontSize: '0.98rem', color: 'var(--muted)', maxWidth: '560px', margin: '0 auto' }}>
            Student, Faculty, আর Service Provider — তিন role-ই একটা কার্ডে ক্লিক করে দেখো
            KUETx-এ তোমার জন্য কী আছে।
          </p>
        </div>

        {/* Role cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem', marginBottom: selectedRole ? '2rem' : 0,
        }}>
          {ROLE_CARDS.map(role => {
            const Icon = role.icon;
            const active = selectedRole === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => selectRole(role.id)}
                style={{
                  textAlign: 'left', cursor: 'pointer', padding: '1.25rem',
                  borderRadius: '18px', border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: active
                    ? 'linear-gradient(180deg, rgba(var(--accentRGB),0.08), rgba(var(--accentRGB),0.02))'
                    : 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))',
                  boxShadow: active ? '0 8px 24px rgba(var(--accentRGB),0.15)' : '0 4px 12px rgba(0,0,0,0.06)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: 'rgba(var(--accentRGB),0.10)', marginBottom: '0.75rem',
                }}>
                  <Icon size={22} style={{ color: 'var(--accent)' }} />
                </div>
                <div style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.6rem' }}>
                  {role.emoji} {role.title}
                </div>
                <ul style={{ listStyle: 'none', display: 'grid', gap: '0.4rem', margin: 0, padding: 0 }}>
                  {role.bullets.map((b, i) => (
                    <li key={i} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                      <CheckCircle2 size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '0.15rem' }} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* Mockup preview (desktop only — mobile branches out above this point) */}
        {selectedRole && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => setMockupMode('phone')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.45rem 0.85rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700,
                  border: '1px solid var(--border)', cursor: 'pointer',
                  background: mockupMode === 'phone' ? 'var(--accent)' : 'transparent',
                  color: mockupMode === 'phone' ? '#fff' : 'var(--text)',
                }}
              >
                <Smartphone size={14} /> Mobile
              </button>
              <button
                type="button"
                onClick={() => setMockupMode('desktop')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.45rem 0.85rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700,
                  border: '1px solid var(--border)', cursor: 'pointer',
                  background: mockupMode === 'desktop' ? 'var(--accent)' : 'transparent',
                  color: mockupMode === 'desktop' ? '#fff' : 'var(--text)',
                }}
              >
                <Monitor size={14} /> Desktop
              </button>
            </div>
            <MockupFrame mode={mockupMode}>
              <DemoContent role={selectedRole} />
            </MockupFrame>
          </div>
        )}
      </div>

      {showSignInPrompt && (
        <SignInPrompt
          intent={authIntent}
          onSignIn={() => { setShowSignInPrompt(false); setShowAuthModal(true); }}
          onClose={() => setShowSignInPrompt(false)}
        />
      )}
      {showAuthModal && (
        <AuthModal
          mode="login"
          intent={authIntent}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}
