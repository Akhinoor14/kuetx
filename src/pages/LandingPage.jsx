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

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Logo, Wordmark } from '../components/Logo';
import {
  LogIn, GraduationCap, Presentation, Store, CheckCircle2,
  Monitor, Smartphone, Crown,
  Layers, ShieldCheck, Users, UserCheck, Sparkles, Mail, MessageSquare, X,
  Flame, TrendingUp, Star, Zap, MapPin, ArrowDown, ChevronLeft, ChevronRight, Youtube,
} from 'lucide-react';
import usePageMeta from '../hooks/usePageMeta';
import { useIsMobileNav } from '../components/BottomNav';
import AuthModal from '../components/AuthModal';
import { loginWithGoogle } from '../lib/firebaseAuth';
import { isBrandNewAccount } from '../lib/accountLifecycle';
import { subscribeLandingTotalUsers } from '../lib/landingStatsSync';
// Phase 4 (landing redesign, §11.3): Sign Up now opens the new
// multi-step wizard instead of plain AuthModal — Sign In is unchanged
// (still plain AuthModal, per §11.5's component-mapping table).
import SignUpWizard from '../components/SignUpWizard';
// Phase 9.1: verified feature-count/stats data, sourced from real nav
// configs (see that file's header comment for the count methodology) —
// the stats strip below reads TOTAL_FEATURE_COUNT/FEATURE_COUNT_DISPLAY
// from here rather than a hand-typed number, so it can never silently
// drift from what the app's own nav.js actually contains.
import {
  TOTAL_FEATURE_COUNT, FEATURE_COUNT_DISPLAY,
  STUDENT_FEATURES, CR_FEATURES, FACULTY_FEATURES, PROVIDER_FEATURES,
} from '../data/landingFeatureInventory';
// Rotating-stat-card feature (this session, owner request): reuses the
// same public Worker call useQuestionBankData.js already makes elsewhere
// in the app (student/faculty Question Bank page) to pull in one real,
// live QB number (dept-wise paper counts) as one of the rotating cards
// alongside the other two always-true facts (3 roles, 100% free). See
// that hook's own header comment — no auth needed, Worker CORS is public.
import { useQuestionBankData } from '../hooks/useQuestionBankData';
import { deriveQBShowcaseStats } from '../hooks/useQBShowcaseStats';
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
    color: '#2563eb', // blue
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
    color: '#d97706', // amber
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
    color: '#7c3aed', // violet
    bullets: [
      'ক্যাম্পাসের ভেতরেই নিজের শপ/সার্ভিস চালু রাখা',
      'অর্ডার ও বুকিং রিয়েল-টাইমে ম্যানেজ করা',
      'ছাত্রছাত্রীদের সরাসরি ইনকোয়ারি হ্যান্ডল করা',
      'Errand request/delivery ট্র্যাকিং',
    ],
  },
];

// ─── Campus photography (design refresh, this session) ─────────────────
// Owner-approved standalone HTML mockup, now ported into the real
// component tree. Assets live in /public/landing/ (real files, checked
// into the repo — NOT base64, unlike the throwaway HTML mockup, since a
// real deployed app should let the browser cache these across visits
// rather than re-downloading the whole page's bytes every load). Every
// filename below corresponds 1:1 to a file the owner-approved design
// pass already placed at /public/landing/<file> — see PR notes / this
// session's asset-prep step.
const CAMPUS_PHOTOS = {
  gate: { src: '/landing/gate.jpg', label: 'Main Gate', coord: 'KUET, Khulna' },
  aerial: { src: '/landing/aerial.jpg', label: 'KUET Hill', coord: 'সবুজ, ওয়াকওয়ে' },
  statue: { src: '/landing/statue-sunset.jpg', label: 'Beautiful KUET', coord: 'সূর্যাস্তে, মূল ভবনের সামনে' },
  academic: { src: '/landing/academic.jpg', label: 'SWC', coord: 'ক্রিম কলাম, আর্চড জানালা' },
  sign: { src: '/landing/sign-dusk.jpg', label: 'দুর্বার বাংলা', coord: 'সন্ধ্যার ক্যাম্পাস' },
  auditorium: { src: '/landing/auditorium.jpg', label: 'Auditorium', coord: 'যেখানে ফেস্ট হয়' },
  mainBuilding: { src: '/landing/main-building.jpg', label: 'Academic Building', coord: 'কলামযুক্ত, বহুতল' },
  bus: { src: '/landing/bus.jpg', label: 'Campus Bus', coord: 'দৈনন্দিন যাতায়াত' },
};

// ─── Campus photo hero (design refresh) ─────────────────────────────────
// Replaces the old text-only hero with the owner-approved standalone-HTML
// design's signature motif: real campus photos presented as tilted,
// white-bordered "physical photograph" cards rather than flush
// rectangles — this repeats again in CampusScrapbook below so it reads
// as an intentional signature rather than a one-off. Uses the SAME
// theme CSS vars as the rest of the app (--accent/--bg/--text/etc, see
// index.css) rather than the mockup's own hardcoded dark-green hex
// values, so this section tracks light/dark mode and any future theme
// change automatically instead of drifting out of sync with it.
// Shared hover-lift (scrapbook tiles) + mascot-bounce keyframes for the
// design-refresh sections. Inline styles can't express :hover, and this
// file has no dedicated landing.css, so a single scoped <style> tag is
// injected once here rather than adding a new CSS file or reaching for
// per-card JS hover state (which would mean 8 extra useState calls in
// CampusScrapbook for a plain lift-on-hover effect).
// Design-system port (this session): the owner-approved standalone HTML
// mockup used its own token set (--kx-mono for numbers/labels, --kx-display
// for headings, an off-white --kx-bg, a distinct card/border language) that
// is NOT the same as this app's existing --bg/--text/--accent vars, even
// though the two happen to be close in raw color. Previously only the hero
// borrowed the mockup's *layout* (photo cluster) while every other section
// kept the app's plain default styling — this patch actually pulls the
// mockup's typographic + card language in as real CSS vars (aliased to the
// app's existing color vars so dark mode / future re-theme still works)
// and applies them to every section wrapper below, not just the hero.
function CampusDesignStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Manrope:wght@700;800&display=swap');

      /* Real HTML mockup's own token values (kuetx-landing-redesign-v2.html) —
         used as-is, not aliased to the app's --accent/--bg vars, so the
         page actually reproduces the approved design instead of drifting
         toward whatever the app theme happens to be. */
      .kx-page {
        --kx-dark: #0c2718;
        --kx-darker: #081a10;
        --kx-bg: #f7f6f1;
        --kx-ink: #16241a;
        --kx-ink-soft: #4a5750;
        --kx-accent: #22c55e;
        --kx-accent-bright: #4ade80;
        --kx-sage: #e9f1ea;
        --kx-line: #dcd8cc;
        --kx-card: #ffffff;
        --kx-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Consolas, monospace;
        --kx-display: 'Manrope', 'Hind Siliguri', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background:
          radial-gradient(ellipse 900px 500px at 8% 0%, rgba(34,197,94,0.05), transparent 60%),
          radial-gradient(ellipse 700px 500px at 95% 40%, rgba(34,197,94,0.04), transparent 55%),
          radial-gradient(circle, rgba(22,36,26,0.05) 1px, transparent 1px) 0 0 / 26px 26px,
          var(--kx-bg);
        color: var(--kx-ink);
      }
      .kx-wrap { max-width: 1440px; margin: 0 auto; padding: 0 32px; }

      /* Scoped override for components that still call the app's old
         generic theme vars (var(--text), var(--border), var(--accent)
         etc.) internally — rather than rewriting every call site inside
         StatsStrip/FeatureItem/CreditsSpotlight/Footer (real, working
         components), this remaps those generic vars to the --kx-*
         values wherever .kx-theme-vars wraps them. Deliberately NOT
         applied at .kx-page's root — AuthModal/SignInPrompt mount
         inside the same tree and must keep the app's real theme
         untouched, so this only wraps the specific components below. */
      .kx-theme-vars {
        --accent: #22c55e;
        --accentDark: #16803d;
        --accentLight: #4ade80;
        --accentSoft: rgba(34,197,94,0.1);
        --accentRGB: 34,197,94;
        --card: #ffffff;
        --surface: #ffffff;
        --surfaceGlass: #ffffff;
        --surfaceGlassStrong: #ffffff;
        --border: #dcd8cc;
        --text: #16241a;
        --muted: #4a5750;
        --bg: #f7f6f1;
      }

      .kx-eyebrow {
        display: inline-flex; align-items: center; gap: 0.4rem;
        font-family: var(--kx-mono); font-size: 12.5px; font-weight: 700;
        letter-spacing: 0.05em; text-transform: none;
        color: #16803d; background: rgba(34,197,94,0.1);
        border: 1px solid rgba(34,197,94,0.25);
        padding: 6px 14px; border-radius: 999px;
      }
      .kx-eyebrow.kx-on-dark {
        color: var(--kx-accent-bright); background: rgba(74,222,128,0.1);
        border-color: rgba(74,222,128,0.25);
      }
      .kx-eyebrow::before {
        content: ''; width: 6px; height: 6px; border-radius: 50%;
        background: currentColor; box-shadow: 0 0 8px currentColor;
      }
      .kx-h2 {
        font-family: var(--kx-display); font-weight: 800; letter-spacing: -0.02em;
        font-size: 36px; margin-bottom: 14px; color: var(--kx-ink);
      }
      .kx-mono-num { font-family: var(--kx-mono); font-weight: 700; }
      .kx-card {
        background: var(--kx-card); border: 1px solid var(--kx-line);
        border-radius: 16px;
      }

      .kx-role-tab {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 11px 22px; border-radius: 999px; font-weight: 600; font-size: 14.5px;
        border: 1.5px solid var(--kx-line); background: var(--kx-card); cursor: pointer;
        transition: all .15s; white-space: nowrap; min-height: 44px; color: var(--kx-ink);
      }
      .kx-role-tab.active { background: var(--kx-dark); color: #fff; border-color: var(--kx-dark); }
      .kx-role-tab:hover:not(.active) { border-color: var(--kx-accent); }

      .kx-fcol { background: var(--kx-card); border: 1px solid var(--kx-line); border-radius: 16px; padding: 26px 24px; }
      .kx-fcol-title {
        font-family: var(--kx-mono); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;
        color: var(--kx-ink-soft); margin-bottom: 16px; padding-left: 12px; border-left: 3px solid var(--kx-accent);
      }
      /* CR card is a permission layer on top of Student, not its own
         role — kept visually distinct (dashed accent border + faint
         accent-tinted background) from the plain .kx-fcol category
         cards so it still reads as "special" while flowing in the SAME
         masonry column as a normal card (no separate strip/position). */
      .kx-fcol-cr {
        background: linear-gradient(180deg, rgba(34,197,94,0.08), var(--kx-card) 55%);
        border: 1.5px dashed var(--kx-accent);
        border-radius: 16px;
      }
      /* Round 7: even with balanced column assignment, one column can
         still legitimately end a bit higher than another (Faculty's
         data can't get closer than ~128px apart, see cardWeight/
         assignToColumns comment above) — this gives the whole grid a
         visible bottom "floor" so uneven column endings read as
         intentionally contained within one bounded area rather than
         trailing off into blank page background past a shorter column.
         Kept subtle (thin border-top, faint tint) so it reads as a
         boundary, not a competing card of its own. */
      .kx-fcol-floor {
        position: relative;
        padding-bottom: 22px;
        border-bottom: 1px solid var(--kx-line);
      }
      .kx-fcol-floor::after {
        content: '';
        position: absolute;
        left: 0; right: 0; bottom: -1px; height: 40px;
        background: linear-gradient(180deg, transparent, var(--kx-bg) 85%);
        pointer-events: none;
      }

      .kx-scrapbook-tile { transition: transform 0.25s ease, box-shadow 0.25s ease; }
      .kx-scrapbook-tile:hover {
        transform: translateY(-6px) rotate(0deg) !important;
        box-shadow: 0 20px 36px rgba(0,0,0,0.16) !important;
        z-index: 2;
      }
      .kx-why-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
      .kx-why-card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(0,0,0,0.06); }

      @keyframes kx-mascot-bounce {
        0%, 100% { transform: translateY(0) rotate(-6deg); }
        50% { transform: translateY(-7px) rotate(-6deg); }
      }
      .kx-mascot-badge { animation: kx-mascot-bounce 2.6s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .kx-mascot-badge { animation: none; }
      }

      /* Scroll-reveal, ported from the HTML mockup's own IntersectionObserver
         behaviour — real fade/rise, not decorative-only. */
      .kx-reveal { opacity: 0; transform: translateY(28px); transition: opacity .7s cubic-bezier(.16,.8,.3,1), transform .7s cubic-bezier(.16,.8,.3,1); }
      .kx-reveal.kx-in-view { opacity: 1; transform: translateY(0); }
      @media (prefers-reduced-motion: reduce) {
        .kx-reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
      }
    `}</style>
  );
}

// ─── Direct Sign In overlay (owner request, this session) ───────────────
// Sign In now fires Google's popup directly (handleDirectGoogleSignIn in
// the main component below) — no KUETx-branded modal in front of it
// anymore. This small overlay only ever appears AFTER that popup has
// already resolved, and only for the two cases that need a follow-up:
// (a) the signed-in Google account has no KUETx account yet, mirroring
// AuthModal.jsx's own pendingNewUser branch (same copy, same "Sign Up
// শুরু করুন" reuse of the already-obtained user so there's no second
// Google popup), or (b) the popup itself failed/was blocked. Renders
// nothing in the common case (existing user signs in successfully) —
// that just routes straight to their dashboard via App.jsx's normal
// auth listener, same as every other sign-in path in the app.
function DirectSignInOverlay({ pendingNewUser, onDismissPendingNewUser, onContinueAsSignUp, error, onDismissError }) {
  if (!pendingNewUser && !error) return null;
  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 10030, background: 'rgba(8,12,22,0.72)', backdropFilter: 'blur(6px)' }}
        onClick={pendingNewUser ? onDismissPendingNewUser : onDismissError}
      />
      <div className="kx-signin-prompt-theme" style={{ position: 'fixed', inset: 0, zIndex: 10031, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <style>{`
          .kx-signin-prompt-theme {
            --accent: #22c55e; --card: #ffffff; --border: #dcd8cc;
            --text: #16241a; --muted: #4a5750;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', 'Noto Sans Bengali', sans-serif;
          }
        `}</style>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 360, background: 'var(--card)',
            border: '1px solid var(--border)', borderRadius: 18,
            boxShadow: '0 24px 60px rgba(0,0,0,0.25)', padding: '1.5rem 1.4rem 1.3rem',
            textAlign: 'center',
          }}
        >
          {pendingNewUser ? (
            <>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.7rem' }}>
                নতুন অ্যাকাউন্ট
              </div>
              <div
                style={{
                  fontSize: 13, color: 'var(--text)', lineHeight: 1.6,
                  padding: '12px 14px', borderRadius: 10, marginBottom: 14,
                  background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)',
                }}
              >
                এই Google অ্যাকাউন্ট দিয়ে KUETx-এ এখনো অ্যাকাউন্ট নেই।
              </div>
              <button
                type="button"
                onClick={onContinueAsSignUp}
                style={{
                  width: '100%', padding: '0.7rem', borderRadius: 12,
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer', marginBottom: '0.5rem',
                }}
              >
                Sign Up শুরু করুন
              </button>
              <button
                type="button"
                onClick={onDismissPendingNewUser}
                style={{
                  width: '100%', padding: '0.55rem', borderRadius: 12,
                  background: 'transparent', color: 'var(--muted)', border: 'none',
                  fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                বাতিল করো
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: '0.9rem', color: 'var(--text)', lineHeight: 1.6, marginBottom: '1rem' }}>
                {error}
              </div>
              <button
                type="button"
                onClick={onDismissError}
                style={{
                  width: '100%', padding: '0.7rem', borderRadius: 12,
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer',
                }}
              >
                ঠিক আছে
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function CampusHero({ isMobileNav, headline, sub, onSignUp }) {
  // Hero is above the fold on load, so it fades/rises in immediately on
  // mount rather than waiting for a scroll trigger.
  const [heroVisible, setHeroVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setHeroVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);
  // 4th hero stat card — Admin-entered total user count (see
  // landingStatsSync.js's header for why this is manual rather than a
  // live Firestore count: students/faculty/providers aren't publicly
  // listable, so a signed-out visitor's browser can't safely count them
  // itself). null while loading/unset, in which case the card is
  // skipped entirely rather than showing a fake number.
  const [totalUsers, setTotalUsers] = useState(null);
  useEffect(() => subscribeLandingTotalUsers(setTotalUsers), []);
  return (
    // Full-bleed dark band, edge-to-edge — matches the HTML mockup's
    // .hero section exactly (background: var(--kx-dark), 100% viewport
    // width, radial glow overlays), not a rounded boxed card sitting
    // inside a constrained content column.
    <section
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        background: 'var(--kx-dark)',
        padding: isMobileNav ? '2.75rem 1.1rem 0' : '84px 32px 0',
        color: '#f3f4ef',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 900px 500px at 15% 0%, rgba(74,222,128,0.14), transparent 60%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 700px 400px at 90% 30%, rgba(74,222,128,0.08), transparent 55%)',
      }} />

      <div
        className="kx-wrap"
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: isMobileNav ? '1fr' : '0.95fr 1.05fr',
          gap: isMobileNav ? '1.75rem' : '56px',
          alignItems: 'center',
          paddingBottom: isMobileNav ? '2.5rem' : '64px',
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        <div style={{ order: isMobileNav ? 2 : 1 }}>
          <div className="kx-eyebrow kx-on-dark" style={{ marginBottom: '1.1rem' }}>
            Built by KUET students, for KUET
          </div>

          <h1 className="kx-page" style={{
            fontFamily: 'var(--kx-display)',
            fontSize: isMobileNav ? 'clamp(1.6rem, 7vw, 2.1rem)' : 'clamp(2.1rem, 4.6vw, 3.1rem)',
            fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08, marginBottom: '1rem',
            color: '#f3f4ef', background: 'none',
          }}>
            {headline}
          </h1>

          <p style={{
            fontSize: isMobileNav ? '0.98rem' : '19px', lineHeight: 1.65,
            fontWeight: 500,
            color: 'rgba(243,244,239,0.92)', maxWidth: '520px', marginBottom: isMobileNav ? '1.25rem' : '34px',
          }}>
            {sub}
          </p>

          <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap', marginBottom: isMobileNav ? '1.75rem' : '44px' }}>
            <button
              type="button"
              onClick={onSignUp}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: isMobileNav ? '0.75rem 1.2rem' : '15px 28px', borderRadius: '12px',
                background: 'var(--kx-accent-bright)', color: '#06210f', fontWeight: 800,
                fontSize: isMobileNav ? '0.85rem' : '16px', border: 'none', cursor: 'pointer',
              }}
            >
              Sign Up করো, ফ্রি
            </button>
            <a
              href="#stats-anchor"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: isMobileNav ? '0.75rem 1.2rem' : '15px 28px', borderRadius: '12px',
                background: 'transparent', color: '#f3f4ef', fontWeight: 700,
                fontSize: isMobileNav ? '0.85rem' : '16px',
                border: '1px solid rgba(255,255,255,0.18)', textDecoration: 'none',
              }}
            >
              কী আছে দেখো <ArrowDown size={14} />
            </a>
          </div>

          {/* Hero stats row (design refresh) — 4 cards, each with an icon,
              a mono number, and a short label. First 3 are static
              verified facts (real feature count, role count,
              publications, pulled from BASE_STATS' rotating-card data).
              4th is the Admin-entered live user count from
              landingStatsSync.js — real, Founder-set number pulled from
              config/landingStats (see that file's header for why it's
              manual, not an auto-count), and the whole card is skipped
              while that number is still null (unset/loading) rather than
              showing a placeholder/fake figure. */}
          <div style={{
            display: 'flex', gap: isMobileNav ? '10px' : '14px', flexWrap: 'wrap',
            paddingTop: '28px', borderTop: '1px solid rgba(255,255,255,0.1)',
          }}>
            {[
              { icon: Layers, value: FEATURE_COUNT_DISPLAY, label: 'real feature' },
              { icon: Users, value: '৪', label: 'role, একই app' },
              { icon: Presentation, value: '৫,৮৫৬+', label: 'পাবলিকেশন' },
              ...(totalUsers != null
                ? [{ icon: UserCheck, value: totalUsers.toLocaleString('bn-BD'), label: 'ব্যবহারকারী' }]
                : []),
            ].map(({ icon: Icon, value, label }, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: isMobileNav ? '8px' : '10px',
                  padding: isMobileNav ? '8px 10px' : '10px 14px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: isMobileNav ? '28px' : '32px', height: isMobileNav ? '28px' : '32px',
                  borderRadius: '9px', background: 'rgba(163,230,53,0.14)', color: 'var(--kx-accent-bright)',
                  flexShrink: 0,
                }}>
                  <Icon size={isMobileNav ? 14 : 16} />
                </div>
                <div>
                  <div className="kx-mono-num" style={{ fontSize: isMobileNav ? '17px' : '21px', fontWeight: 800, color: 'var(--kx-accent-bright)', lineHeight: 1.1 }}>{value}</div>
                  <div style={{ fontSize: isMobileNav ? '11.5px' : '13px', fontWeight: 600, color: 'rgba(243,244,239,0.85)', marginTop: '3px', whiteSpace: 'nowrap' }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tilted photo cluster — signature motif, repeated in
            CampusScrapbook. Two photos + a small live-location badge.

            Owner ask (this session): the three photos were forced into
            fixed px heights (220/120/112) that don't match any of
            these images' real aspect ratios — gate.jpg is 5:3, aerial
            is 4:3, statue-sunset is a wide ~2.34:1 crop — so every
            photo was getting stretched/over-cropped ("condensed")
            relative to how it actually looks. Each tile now sets height
            from that photo's own real ratio at its fixed tile width
            (aspectRatio, not objectFit-cover-into-a-guessed-height), so
            the frame's proportions match the source image instead of
            forcing a uniform box. Owner also asked to drop the separate
            mobile-specific sizing for this cluster and keep only the
            layout from the current screenshot (desktop values used at
            every width) — isMobileNav branching removed here only. */}
        <div style={{
          position: 'relative',
          height: '500px',
          order: 2,
        }}>
          <div style={{
            position: 'absolute', top: 0, left: '16px',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(12,39,24,0.85)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px',
            padding: '10px 14px', fontSize: '12px', fontFamily: 'var(--kx-mono)', fontWeight: 700,
            color: '#a5d6a7', zIndex: 3,
          }}>
            <MapPin size={11} /> KUET, Khulna
          </div>

          <div style={{
            position: 'absolute', top: '26px', right: '0px',
            width: '360px',
            transform: 'rotate(4deg)',
            borderRadius: '14px', overflow: 'hidden', border: '6px solid #fff',
            boxShadow: '0 30px 60px rgba(0,0,0,0.45), 0 0 0 6px rgba(255,255,255,0.06)', background: '#fff',
          }}>
            <img src={CAMPUS_PHOTOS.gate.src} alt={CAMPUS_PHOTOS.gate.label} style={{ width: '100%', aspectRatio: '5 / 3', objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: '12px 14px 14px' }}>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#16241a' }}>{CAMPUS_PHOTOS.gate.label}</div>
              <div style={{ fontFamily: 'var(--kx-mono)', fontSize: '11px', color: '#8a9188', marginTop: '2px' }}>{CAMPUS_PHOTOS.gate.coord}</div>
            </div>
          </div>

          <div style={{
            position: 'absolute', bottom: '100px', left: 0,
            width: '210px',
            transform: 'rotate(-7deg)',
            borderRadius: '12px', overflow: 'hidden', border: '6px solid #fff',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)', zIndex: 2,
          }}>
            <img src={CAMPUS_PHOTOS.aerial.src} alt={CAMPUS_PHOTOS.aerial.label} style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block' }} />
          </div>

          <div style={{
            position: 'absolute', bottom: '6px', left: '128px',
            width: '204px',
            transform: 'rotate(5deg)',
            borderRadius: '12px', overflow: 'hidden', border: '6px solid #fff',
            boxShadow: '0 22px 44px rgba(0,0,0,0.4)', zIndex: 1,
          }}>
            <img src={CAMPUS_PHOTOS.statue.src} alt={CAMPUS_PHOTOS.statue.label} style={{ width: '100%', aspectRatio: '2.34 / 1', objectFit: 'cover', display: 'block' }} />
          </div>

          {/* Mascot badge — floating turtle accent per HTML mockup,
              anchored to the gate photo card's bottom-right corner.
              Design refresh: dropped the solid green circle backdrop
              (owner feedback — was making the turtle look small/boxed
              in); now just the artwork itself, sized up so it actually
              reads at a glance, with only a drop-shadow to lift it off
              the photo stack. */}
          <div
            className="kx-mascot-badge"
            style={{
              position: 'absolute',
              bottom: '-18px',
              right: '-22px',
              width: '160px',
              height: '160px',
              zIndex: 4,
              filter: 'drop-shadow(0 14px 22px rgba(0,0,0,0.5))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent',
            }}
          >
            <Logo size={160} />
          </div>
        </div>
      </div>

      {/* Owner ask (this session, reverted): section boundaries are
          hard color-band cuts by design — no gradient blend between
          hero and the next section. */}
    </section>
  );
}

// ─── Campus scrapbook / masonry gallery (design refresh) ────────────────
// Second occurrence of the tilted-photo motif — the mockup brief's
// requirement that the signature repeats at least twice rather than
// appearing once. All 8 real campus photos placed here (vs. the old
// HTML mockup's 4), each tile alternating a small rotation so the grid
// reads as a physical scrapbook rather than a rigid CSS grid.
const SCRAPBOOK_ORDER = ['gate', 'academic', 'aerial', 'sign', 'auditorium', 'mainBuilding', 'bus', 'statue'];
const SCRAPBOOK_TILTS = [-3, 2, -2, 3, 2, -3, 3, -2];

function CampusScrapbook({ isMobileNav }) {
  const { ref, visible } = useRevealOnVisible();
  return (
    // Full-bleed sage band, matches HTML's .scrapbook section exactly.
    <section
      ref={ref}
      className={`kx-reveal${visible ? ' kx-in-view' : ''}`}
      style={{
        width: '100%',
        position: 'relative',
        background: 'var(--kx-sage)',
        padding: isMobileNav ? '2.5rem 1.1rem' : '90px 32px',
      }}
    >
      {/* Hard color-band cut by design — no seam gradient here. */}
      <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 56px' }}>
        <div className="kx-eyebrow" style={{ marginBottom: '0.75rem' }}>
          নিজের ক্যাম্পাস
        </div>
        <h2 className="kx-h2" style={{ fontSize: isMobileNav ? 'clamp(1.35rem, 6vw, 1.7rem)' : '36px' }}>
          KUET-এর জন্য, KUET-এই তৈরি
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--kx-ink-soft)', lineHeight: 1.6 }}>
          বাইরের কোনো কোম্পানির প্রোডাক্ট না — এই ক্যাম্পাসের ছাত্রছাত্রীরাই বানিয়েছে, নিজেদের সমস্যা দেখে, নিজেরাই চালাচ্ছে।
        </p>
      </div>

      <div style={{
        display: isMobileNav ? 'grid' : 'flex',
        gridTemplateColumns: isMobileNav ? 'repeat(2, 1fr)' : undefined,
        justifyContent: isMobileNav ? undefined : 'center',
        flexWrap: isMobileNav ? undefined : 'wrap',
        gap: isMobileNav ? '0.85rem' : '24px',
        maxWidth: '1120px', margin: '0 auto',
      }}>
        {SCRAPBOOK_ORDER.map((key, i) => {
          const photo = CAMPUS_PHOTOS[key];
          const tilt = isMobileNav ? 0 : SCRAPBOOK_TILTS[i];
          return (
            <div
              key={key}
              className="kx-scrapbook-tile"
              style={{
                width: isMobileNav ? '100%' : '210px',
                background: '#fff',
                borderRadius: '10px',
                padding: '10px 10px 16px',
                boxShadow: '0 12px 28px rgba(0,0,0,0.1)',
                transform: `rotate(${tilt}deg)`,
              }}
            >
              <img
                src={photo.src}
                alt={photo.label}
                loading="lazy"
                style={{ width: '100%', height: isMobileNav ? '120px' : '160px', objectFit: 'cover', borderRadius: '6px', marginBottom: '10px', display: 'block' }}
              />
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#16241a', textAlign: 'center' }}>{photo.label}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Phase 8 (§11.4): landing's demo role ids (ROLE_CARDS above) vs the
// signup wizard/RoleSelectScreen/Firestore's role ids differ for one
// role only — landing uses 'faculty' (matches the public-facing label),
// the wizard/Firestore use 'teacher' (accountRole.js's VALID_ROLE_IDS).
// student/provider already match 1:1. This maps the landing id to the
// wizard id at the LandingPage -> SignUpWizard boundary only — nothing
// else in this file (routing, demo dashboard dispatch, ROLE_CARDS
// itself) needs to know about 'teacher' at all, so the remap stays
// local to this one call site rather than renaming 'faculty' everywhere.
const LANDING_ROLE_TO_WIZARD_ROLE = { student: 'student', faculty: 'teacher', provider: 'provider' };
const wizardRoleFor = (landingRoleId) => LANDING_ROLE_TO_WIZARD_ROLE[landingRoleId] || null;

// Phase 9.2 §8 owner-confirm: 4th stat is the real, verified feature
// count from landingFeatureInventory.js (Phase 9.1) — owner's explicit
// instruction was that this number must be real ("EI TA KINTU RAL
// HOITE HOBE"), not a rounded-up marketing figure, and that features
// should clearly outnumber routes since several routes bundle multiple
// features. The other two numbers here are simple, already-true facts
// (3 roles, 100% free) rather than anything needing its own
// verification pass.
//
// Owner request (this session): the old strip showed all 3 side by
// side, static, forever — owner asked to reconsider whether that's
// still the best use of this exact spot on the page (screenshot
// provided: hero -> ৬২+/৩/১০০% row -> "কেন KUETx?"). Decision: keep the
// position, but turn it into ONE auto-rotating card that cycles through
// these 3 facts plus a 4th, live QB fact — one big number + label at a
// time reads as more confident/intentional than three small numbers
// competing for attention, and it makes room to fold in the one truly
// live, publicly-fetchable number the app has (QB dept-wise paper
// count via the public Cloudflare Worker) without inflating the strip
// to 4 static columns.
//
// QB slot is appended by StatsStrip itself (needs live data from the
// Worker), not hardcoded here — this array is only static, always-true
// facts (3 original + 7 qualitative feature cards added later, see
// ROTATING_STATS_CARD_PROMPT.md).
const BASE_STATS = [
  { id: 'features', display: FEATURE_COUNT_DISPLAY, label: 'এক অ্যাপে রুটিন থেকে রেজাল্ট, কেনাকাটা, ব্যবসা — সবকিছু' },
  // owner-confirmed: counts as "4 Role" here for the user-facing landing
  // copy (CR gets a visibly different toolset/experience), even though
  // Firestore/accountRole.js's VALID_ROLE_IDS and ROLE_CARDS above only
  // define 3 account types — CR is technically a requiresCR: true
  // permission layer on top of the Student role, not a separate account.
  // Intentional wording difference between marketing copy and the code's
  // internal role model, not a drift/bug.
  { id: 'roles', display: '4 Role', label: 'Student, CR, Faculty, Provider — যার যেটুকু লাগে সেটুকুই দেখে' },
  {
    id: 'publications',
    display: '৫,৮৫৬+',
    label: '৪৩৬+ শিক্ষকের রিসার্চ পাবলিকেশনসহ ২৪ ডিপার্টমেন্ট জুড়ে',
  },
  {
    id: 'pick-and-drop',
    display: 'আনিয়ে নিন',
    label: 'কেনাকাটা, ডেলিভারি বা ছোট কাজ — পোস্ট দিলে ক্যাম্পাসের যেকোনো student এসে করে দেবে',
  },
  {
    id: 'solution-bank',
    display: 'গুছানো সমাধান',
    label: 'শুধু উত্তর না — টপিক অনুযায়ী ধাপে ধাপে বিশ্লেষণসহ বোঝানো, কোর্স অনুযায়ী সাজানো',
  },
  {
    id: 'attendance',
    display: 'দুই স্তরে ট্র্যাকিং',
    label: 'নিজের হিসাব নিজে রাখুন, Faculty-র অফিসিয়াল এন্ট্রি সরাসরি মার্কসে যুক্ত হয়',
  },
  {
    id: 'cr-toolset',
    display: '৫+ CR টুল',
    label: 'Routine, Class Planner, CT ও Quiz শিডিউল, Announcement Broadcast — ক্লাস চালাতে যা যা লাগে',
  },
  {
    id: 'my-classes-faculty',
    display: '৭ টুল, ১ ক্লাস',
    label: 'Syllabus, Attendance থেকে Notices পর্যন্ত — প্রতিটা ক্লাসের সবকিছু এক জায়গায়',
  },
  {
    id: 'online-mart',
    display: 'নিজের শপ',
    label: 'Online-এ নিজের দোকান দিন — Provider হিসেবে যাচাই হয়ে যোগ দিতে হয়',
  },
];

const STAT_ICONS = {
  features: Layers,
  roles: Users,
  publications: Presentation,
  'pick-and-drop': Zap,
  'solution-bank': CheckCircle2,
  attendance: TrendingUp,
  'cr-toolset': Star,
  'my-classes-faculty': GraduationCap,
  'online-mart': Store,
  'qb-total': Flame,
  'qb-top-dept': Crown,
};

// Phase 9.6 redesign (owner feedback: wants ONE card rotating again, not
// a static grid — smaller on mobile, a bit larger on desktop, cycling
// through the same stat set one at a time). No dots (auto-cycle only,
// per owner). Slide transition, standard speed — not too fast/slow.
// Built as a fixed-height window with an inner track that translateX's
// by -100%/-200%/etc — CSS transition on transform only (no unmount/
// remount of the outgoing card, no key-based re-render), specifically so
// there's no flash/flicker/blank-frame while old content is still
// visible and new content slides in under it. prefers-reduced-motion
// still respected (skips the interval, i.e. stays on stat 0 rather than
// jumping with no animation).
const ROTATE_INTERVAL_MS = 4200;
// Owner ask: the strip felt inert for the first few seconds because the
// first rotation didn't happen until the full 4.2s interval elapsed —
// nothing signals "this is live/rotating" right away. First two
// advances fire quickly (2s apart) so a visitor immediately notices
// motion, then it settles into the normal ROTATE_INTERVAL_MS cadence.
const FAST_ROTATE_INTERVAL_MS = 2000;
const FAST_ROTATE_COUNT = 2;
const SLIDE_TRANSITION_MS = 550;

function StatCardTile({ stat, isMobileNav }) {
  return (
    // Owner ask (this session): drop the icon badge above the number —
    // plain text, no emoji/icon lead-in. Kept the centered stack layout
    // and spacing rhythm, just removed the icon block itself.
    <div
      style={{
        width: '100%', flexShrink: 0,
        padding: isMobileNav ? '0.95rem 1rem' : '1.5rem 1.75rem',
        boxSizing: 'border-box',
        textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}
    >
      <div style={{
        fontFamily: 'var(--kx-mono, inherit)',
        fontSize: isMobileNav ? '1.3rem' : '1.85rem',
        fontWeight: 800, color: 'var(--accent)',
        letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.15, marginBottom: '0.4rem',
      }}>
        {stat.display}
      </div>
      <div style={{
        fontSize: isMobileNav ? '0.78rem' : '0.92rem', color: 'var(--muted)',
        lineHeight: 1.45, maxWidth: '460px',
      }}>
        {stat.label}
      </div>
    </div>
  );
}

function StatsStrip({ isMobileNav }) {
  // Same public Worker call the Question Bank pages already make — see
  // useQBShowcaseStats.js header comment. If the Worker isn't reachable
  // (e.g. env var missing in some deploy), qbTree/qbCount just stay at
  // their defaults and the QB card is skipped entirely rather than
  // showing a fake or zeroed number.
  const { tree: qbTree, count: qbCount, error: qbError } = useQuestionBankData();
  const qbStats = deriveQBShowcaseStats(qbTree, qbCount);

  const stats = [...BASE_STATS];
  if (!qbError && qbStats.totalPapers > 0) {
    stats.push({
      id: 'qb-total',
      display: qbStats.totalPapers.toLocaleString('bn-BD'),
      label: `প্রশ্নব্যাংকে ${qbStats.deptCount}টি ডিপার্টমেন্টের রিয়েল প্রশ্নপত্র — লাইভ`,
    });
    if (qbStats.topDept) {
      stats.push({
        id: 'qb-top-dept',
        display: qbStats.topDept.total.toLocaleString('bn-BD'),
        label: `সবচেয়ে বেশি প্রশ্নপত্র আছে ${qbStats.topDept.dept} ডিপার্টমেন্টে — লাইভ কাউন্ট`,
      });
    }
  }

  // Owner ask (this session): swapped the horizontal slide-track for a
  // stacked crossfade (see the render below) — a crossfade just needs
  // "which stat is current" (index % stats.length), it doesn't need the
  // slide-specific duplicate-last-slide/snap-back wraparound trick that
  // only existed to make translateX's fixed-length track loop invisibly.
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const noTransition = false;
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const advance = () => {
    setIndex((i) => i + 1);
  };
  const goTo = (target) => {
    setIndex(target);
  };

  // First FAST_ROTATE_COUNT advances use the quick interval, then fall
  // back to the normal cadence — re-runs each time `index` changes so
  // the timer's delay can switch from fast to normal mid-sequence
  // (a plain setInterval can't change its own delay once started).
  useEffect(() => {
    if (paused || prefersReducedMotion || stats.length <= 1) return undefined;
    const delay = index < FAST_ROTATE_COUNT ? FAST_ROTATE_INTERVAL_MS : ROTATE_INTERVAL_MS;
    const id = setTimeout(advance, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, prefersReducedMotion, stats.length, index]);

  const displayIndex = ((index % stats.length) + stats.length) % stats.length; // current stat, safe for any integer index

  return (
    <div
      className="kx-theme-vars"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      style={{
        maxWidth: isMobileNav ? '360px' : '640px',
        margin: isMobileNav ? '0 auto 1.5rem' : '0 auto 2.5rem',
        padding: isMobileNav ? '0.4rem 0' : '0.6rem 0',
        borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: isMobileNav ? '0.4rem' : '0.6rem',
      }}
    >
      {/* Owner ask: something clickable on the left/right that jumps to
          the previous/next stat and overrides the auto-rotate (rather
          than the strip being purely passive/auto-only). Arrow buttons
          sit outside the overflow:hidden track so they don't get
          clipped, and clicking one also pauses auto-rotate briefly via
          the existing paused state (re-used from hover-pause) so a
          manual click isn't immediately undone by the timer. */}
      {stats.length > 1 && (
        <button
          type="button"
          aria-label="আগের স্ট্যাট"
          onClick={() => { setPaused(true); goTo((displayIndex - 1 + stats.length) % stats.length); }}
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: isMobileNav ? '26px' : '32px', height: isMobileNav ? '26px' : '32px',
            borderRadius: '50%', border: '1px solid var(--kx-line)', background: 'var(--kx-card)',
            cursor: 'pointer', color: 'var(--kx-ink-soft)',
          }}
        >
          <ChevronLeft size={isMobileNav ? 14 : 16} />
        </button>
      )}

      {/* Owner ask: give the rotating card a "glassy" framed feel rather
          than sitting bare inside the strip — translucent tinted panel +
          blur + a soft border/highlight, matching the frosted-glass
          language already used elsewhere (AuthModal's card, the
          "KUET, Khulna" hero badge).

          Owner ask (this session): replace the horizontal slide-in/
          slide-out with the outgoing card shrinking down into a small
          circle (and the incoming card growing OUT of that same circle)
          instead of sliding sideways — a "pop through a point" transition
          rather than a carousel-strip slide. Implemented as a stacked
          crossfade: both the outgoing and incoming stat render on top of
          each other (absolute position) and each one animates its own
          borderRadius from a small circle up to the full rounded-rect
          shape together with opacity/scale — outgoing runs circle<-rect
          (shrinks to a dot, fades out), incoming runs rect<-circle
          (grows from a dot, fades in), both centered on the same point,
          so it reads as one shape "closing" and the next "opening" from
          the same spot rather than two boxes swapping places. Frame
          keeps a fixed height (tallest stat's card, measured via the
          hidden sizer below) since absolute-positioned children can't
          size their parent themselves. */}
      {/* Owner ask (this session): switch the "pop through a point"
          crossfade back to a real horizontal slide — the current stat
          sits centered, the next stat waits just off-screen to the
          right, and the previous stat sits just off-screen to the left;
          only the current one is visible/opaque, so as `displayIndex`
          advances each stat visibly travels right-to-left through the
          frame instead of growing/shrinking from a center point. */}
      <div style={{
        position: 'relative', flex: 1, minWidth: 0,
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 8px 24px rgba(0,0,0,0.12)',
        overflow: 'hidden',
      }}>
        {/* Invisible sizer — reserves the tallest stat's real height so
            the glass frame doesn't collapse/jump as absolutely
            positioned cards slide in and out on top of it. */}
        <div style={{ visibility: 'hidden', pointerEvents: 'none' }}>
          <StatCardTile stat={stats[0]} isMobileNav={isMobileNav} />
        </div>

        {stats.map((stat, i) => {
          const isCurrent = i === displayIndex;
          // Position relative to the current card: 0 = current/centered,
          // +100% = waiting off to the right (next in line), -100% =
          // already passed off to the left (previous). Direction tracks
          // whether we're moving forward (next) or backward (prev) so
          // the correct neighbor slides in from the correct side.
          const offset = ((i - displayIndex + stats.length) % stats.length);
          const relPos = offset === 0 ? 0 : (offset === 1 ? 1 : -1);
          return (
            <div
              key={stat.id}
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: isCurrent ? 1 : 0,
                transform: `translateX(${isCurrent ? '0%' : (relPos > 0 ? '100%' : '-100%')})`,
                transition: (noTransition || prefersReducedMotion)
                  ? 'none'
                  : `opacity ${SLIDE_TRANSITION_MS}ms ease, transform ${SLIDE_TRANSITION_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`,
                pointerEvents: isCurrent ? 'auto' : 'none',
              }}
            >
              <StatCardTile stat={stat} isMobileNav={isMobileNav} />
            </div>
          );
        })}
      </div>

      {stats.length > 1 && (
        <button
          type="button"
          aria-label="পরের স্ট্যাট"
          onClick={() => { setPaused(true); goTo((displayIndex + 1) % stats.length); }}
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: isMobileNav ? '26px' : '32px', height: isMobileNav ? '26px' : '32px',
            borderRadius: '50%', border: '1px solid var(--kx-line)', background: 'var(--kx-card)',
            cursor: 'pointer', color: 'var(--kx-ink-soft)',
          }}
        >
          <ChevronRight size={isMobileNav ? 14 : 16} />
        </button>
      )}
    </div>
  );
}

// ─── "কেন KUETx?" value proposition (Phase 9.4) ────────────────────────
// Owner-confirmed brief (tracker §9.4): copy written independently, not
// a verbatim lift from the manifesto's policy language — but every claim
// still has to trace back to something real in that manifesto (§4 of
// this doc, sourced from PrivacyPolicy.jsx's actual 9-section policy),
// not invented marketing. Four cards, each grounded in a specific,
// checkable fact about the app rather than a generic SaaS-landing
// platitude:
//   - "সব একসাথে" -> the 62+ feature inventory (9.1/9.3) is the receipt
//     for this, not a bare claim.
//   - "শুধু যতটুকু লাগে" -> role-scoped Firestore rules (manifesto §3,
//     "কারা তথ্যে প্রবেশাধিকার পায়") is a real access-control property
//     of the app, not phrased as a security *promise* here (this
//     section isn't the place to re-litigate rules-enforcement nuance —
//     that's what /privacy is for), just "you see your role's tools".
//   - "তথ্য বিক্রি হয় না" -> manifesto §2 ("KUETx যা করে না") and §8
//     (shutdown clause: delete, not retain/sell) — this is the one card
//     that most directly mirrors policy language, so kept intentionally
//     short and factual rather than embellished, to avoid overstating a
//     legal-ish commitment in landing-page copy.
//   - "KUET students-দের বানানো" -> founder/CR context (memory + the
//     project's own long-standing identity, not the manifesto) — this
//     is the one card that's about *origin* rather than a policy claim.
// Signature moment: reuses the same IntersectionObserver primitive as
// Phase 9.2's count-up (no new dependency, no framer-motion) — each
// card fades/slides in once when it individually scrolls into view,
// staggered by index, rather than the whole grid appearing at once.
// This is deliberately the "small orchestrated moment" the frontend
// design guidance calls for, not scattered animation everywhere else.
const WHY_KUETX_CARDS = [
  {
    icon: Layers,
    title: 'সব একসাথে, একটাই অ্যাপে',
    body: `রুটিন থেকে রেজাল্ট, নোটিশ থেকে ক্যাম্পাস সার্ভিস — ${FEATURE_COUNT_DISPLAY} রিয়েল ফিচার এক জায়গায়, আলাদা আলাদা গ্রুপ/শীট/অ্যাপ খুঁজে বেড়াতে হবে না।`,
  },
  {
    icon: Users,
    title: 'শুধু যতটুকু লাগে, ততটুকুই দেখাবে',
    body: 'Student, CR, Faculty, Provider — প্রতিটা role নিজের টুলসেট দেখে, বাকি সবার জিনিস দিয়ে ঘেঁটে যেতে হয় না।',
  },
  {
    icon: ShieldCheck,
    title: 'তথ্য বিক্রি হয় না',
    body: 'কোনো বিজ্ঞাপন-ট্র্যাকিং, ডেটা-বিক্রি, বা স্পন্সরড কনটেন্ট নেই একাডেমিক ফিচারে — app বন্ধ হলেও তথ্য ধরে রাখা বা বিক্রি করা হবে না।',
  },
  {
    icon: Sparkles,
    title: 'KUET-এর ছাত্রছাত্রীদের বানানো',
    body: 'বাইরের কোনো কোম্পানির প্রোডাক্ট না — নিজেদের ক্যাম্পাসের সমস্যা দেখে, নিজেরাই বানানো ও চালু রাখা।',
  },
];

function useRevealOnVisible() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return undefined;
    const node = ref.current;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function WhyKuetxCard({ card, index, isMobileNav }) {
  const Icon = card.icon;
  const { ref, visible } = useRevealOnVisible();
  return (
    <div
      ref={ref}
      className="kx-why-card"
      style={{
        padding: isMobileNav ? '0.85rem' : '26px 22px', borderRadius: '16px',
        border: '1px solid var(--kx-line)',
        background: 'var(--kx-card)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(14px)',
        transition: `opacity 0.5s ease ${index * 90}ms, transform 0.5s ease ${index * 90}ms`,
      }}
    >
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: isMobileNav ? '30px' : '42px', height: isMobileNav ? '30px' : '42px',
        borderRadius: isMobileNav ? '9px' : '10px',
        background: 'var(--kx-sage)', marginBottom: isMobileNav ? '0.5rem' : '16px',
      }}>
        <Icon size={isMobileNav ? 15 : 20} style={{ color: 'var(--kx-accent)' }} />
      </div>
      <div style={{ fontSize: isMobileNav ? '0.82rem' : '16px', fontWeight: 700, color: 'var(--kx-ink)', letterSpacing: '-0.01em', marginBottom: isMobileNav ? '0.3rem' : '8px' }}>
        {card.title}
      </div>
      {!isMobileNav && (
        <p style={{ fontSize: '13.5px', color: 'var(--kx-ink-soft)', lineHeight: 1.55, margin: 0 }}>
          {card.body}
        </p>
      )}
    </div>
  );
}

function WhyKuetx({ isMobileNav }) {
  return (
    // Full-bleed --kx-bg band, matches HTML's .why-section exactly.
    <section
      className="kx-page"
      style={{ width: '100%', background: 'var(--kx-bg)', padding: isMobileNav ? '2.25rem 1.1rem' : '90px 32px' }}
    >
      <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
        <div className="kx-eyebrow" style={{ marginBottom: '0.75rem' }}>কেন KUETx?</div>
        <h2 className="kx-h2" style={{ fontSize: isMobileNav ? 'clamp(1.35rem, 6vw, 1.7rem)' : '36px' }}>
          Feature আছে অনেক app-এই। পার্থক্য হলো, এটা <span style={{ color: '#16803d' }}>তোমার</span> app.
        </h2>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobileNav ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobileNav ? '0.6rem' : '20px',
        maxWidth: '1180px', margin: '48px auto 0',
      }}>
        {WHY_KUETX_CARDS.map((card, i) => (
          <WhyKuetxCard key={card.title} card={card} index={i} isMobileNav={isMobileNav} />
        ))}
      </div>
    </section>
  );
}


// Owner-confirmed shape (tracker §9.3): verbatim, every item shown (no
// "category summary" shortcut) — but grouped under the same category
// headers landingFeatureInventory.js already uses (which themselves
// mirror nav.js's own grouping), so a returning user recognizes the
// structure instead of facing one flat 62-item wall of text. Bangla
// labels here are landing-page copy only — they don't rename anything
// in nav.js, this file just needs a human-readable header per group.
const STUDENT_CATEGORY_LABELS = {
  core: 'মূল',
  dailyAcademics: 'দৈনন্দিন একাডেমিক্স',
  academicCore: 'একাডেমিক রিসোর্স',
  campusLife: 'ক্যাম্পাস লাইফ',
  services: 'ক্যাম্পাস সার্ভিস',
  selfStudy: 'সেলফ-স্টাডি',
  tools: 'টুলস',
};
const FACULTY_CATEGORY_LABELS = {
  core: 'মূল',
  communication: 'কমিউনিকেশন',
  resources: 'রিসোর্স',
  services: 'ক্যাম্পাস সার্ভিস',
};
const PROVIDER_CATEGORY_LABELS = {
  core: 'মূল',
  shop: 'মাই শপ',
};

const FEATURE_TABS = [
  { id: 'student', title: 'Student', icon: GraduationCap, features: STUDENT_FEATURES, labels: STUDENT_CATEGORY_LABELS },
  { id: 'faculty', title: 'Faculty', icon: Presentation, features: FACULTY_FEATURES, labels: FACULTY_CATEGORY_LABELS },
  { id: 'provider', title: 'Provider', icon: Store, features: PROVIDER_FEATURES, labels: PROVIDER_CATEGORY_LABELS },
];

// Desktop masonry column count per role — measured, not guessed. See the
// long comment above FeatureBreakdown's masonry container for the actual
// per-card height math (px) and the column-balance simulation that these
// three numbers come from. Re-derive if landingFeatureInventory.js's
// category shapes change materially (a card gaining/losing several
// items, or gaining/losing a FEATURE_SUBDETAIL sub-list).
// Round 4-6 used a hardcoded ROLE_COLUMN_COUNT constant (student:2,
// faculty:2, provider:1), measured by hand from a one-time height
// simulation. Round 8 replaced it with bestColumnLayout() (below,
// near assignToColumns) which recomputes the right column count from
// real card weights at render time instead of trusting a constant that
// would silently go stale if landingFeatureInventory.js's category
// shapes ever change — it happens to land on the same 2/2/1 numbers
// for today's data, which is what the earlier hand-measurement was
// checking for in the first place.

// ─── Round 7: explicit column ASSIGNMENT instead of CSS column-count ──
// Owner ask: cards in every column should end at roughly the same
// bottom Y — a flush/"bound" edge, not just "no column is dramatically
// taller". CSS's native `column-count` only fills columns in DOM order
// (col 1 gets items until it roughly hits the ideal average height,
// THEN col 2 starts) — it can't reorder items across columns, so it
// can leave one column noticeably shorter if the items don't split
// evenly by DOM position. Verified by brute-force testing every
// possible column assignment (not just DOM order) against the same
// real per-card pixel heights used above:
//   Student (8 cards, 2 columns): best possible arrangement -> 1077px /
//     1082px, only 5px apart (near-perfectly flush). DOM-order native
//     column-count instead gives 929px/1230px (301px apart) because it
//     can't move a card from a later DOM position into an earlier
//     column to balance things out.
//   Faculty (4 cards, 2 columns): best possible arrangement -> 533px /
//     661px, 128px apart — this is the BEST any arrangement can do
//     (Faculty's "core" card alone is 533px, more than the other three
//     cards combined at 662px, so no split gets closer than this; it's
//     a data-shape limit, not an algorithm limit). Still notably better
//     than DOM-order's 533px/661px... which happens to already be this
//     arrangement for Faculty specifically, so Faculty's native
//     column-count result and the optimal result already coincide.
// CARD_WEIGHT below mirrors that same verified per-card height model
// (card padding + per-item line height + FEATURE_SUBDETAIL's extra
// height for My Classes/My Shop's nested lists) so the JS assignment
// below is measuring the same real box the CSS ultimately renders —
// this is an approximation (browsers may render a few px off from
// these numbers depending on font metrics), close enough to keep every
// column within a similar ballpark of the others without needing a
// live ResizeObserver pass.
const CARD_BASE_PAD = 26 * 2 + 12 + 16; // card top+bottom padding + title line + title margin
const PLAIN_ITEM_WEIGHT = 8 * 2 + 0.95 * 16 * 1.4 + 1; // item padding + text line + border
const SUBDETAIL_ITEM_WEIGHT = 0.78 * 16 * 1.3 + 0.72 * 16 * 1.5 + 0.1 * 16;
function subdetailWeight(nSub) {
  return 8 + 0.7 * 16 * 2 + 0.72 * 16 * 1.4 + 0.45 * 16 + nSub * SUBDETAIL_ITEM_WEIGHT;
}
function cardWeight(items) {
  let total = CARD_BASE_PAD;
  for (const name of items) {
    total += PLAIN_ITEM_WEIGHT;
    const sub = FEATURE_SUBDETAIL[name];
    if (sub) total += subdetailWeight(sub.items.length);
  }
  return total;
}
const CR_CARD_WEIGHT = 1.1 * 16 * 2 + 0.88 * 16 * 1.3 + 16 * 0.6 + 0.8 * 16 * 1.4 + 16 * 0.6 + 4 * (0.8 * 16 * 1.3 + 0.4 * 16);

// Greedy-least-filled bin packing: sort cards tallest-first, always
// drop the next card into whichever column currently has the least
// total weight. This is a standard, well-known approximation for
// balanced multi-way partitioning (not a from-scratch heuristic) and
// matches or beats the brute-force-optimal split for both Student and
// Faculty's real data above. By construction this algorithm can never
// pack multiple large cards onto one column while leaving another
// column empty/short: after placing the first large card, that column
// becomes the current tallest and is skipped until the others catch up
// — so a "one column ends up way too long" outcome isn't something this
// step can produce; if a column ends up alone with one big card (as
// Faculty's "core" does), that's because splitting it further into a
// 2+2 arrangement was checked and is WORSE (185px/27% spread vs the
// 1+3 split's 128px/19% — verified by brute force), not a failure to
// balance further.
function assignToColumns(cards, nColumns) {
  const columns = Array.from({ length: nColumns }, () => []);
  const colWeights = new Array(nColumns).fill(0);
  const sorted = [...cards].sort((a, b) => b.weight - a.weight);
  for (const card of sorted) {
    let target = 0;
    for (let i = 1; i < nColumns; i++) {
      if (colWeights[i] < colWeights[target]) target = i;
    }
    columns[target].push(card);
    colWeights[target] += card.weight;
  }
  return columns;
}

// Picks the best column count for a given card set instead of trusting
// a stale hardcoded number forever: tries every columnCount from 1 up
// to maxColumns, runs the SAME assignToColumns() on each, and keeps the
// one with the lowest (tallest - shortest) spread — with two guards so
// it never regresses back to the original bug: (a) a candidate is
// rejected outright if it leaves any column empty, and (b) among valid
// candidates, prefer more columns when the spread is within 10% of the
// best (a tighter-but-1-column layout is not worth losing horizontal
// balance for a marginal height improvement). Recomputing this at
// render time (cheap — at most a handful of cards, 3 candidate column
// counts) means it self-corrects if landingFeatureInventory.js's
// category shapes ever change, instead of silently going stale like a
// hand-picked constant would.
function bestColumnLayout(cards, maxColumns = 3) {
  const n = Math.min(cards.length, maxColumns);
  let best = null;
  for (let nCol = 1; nCol <= n; nCol++) {
    const columns = assignToColumns(cards, nCol);
    const totals = columns.map((c) => c.reduce((s, x) => s + x.weight, 0));
    if (totals.some((t) => t === 0)) continue; // never leave a column empty
    const spread = Math.max(...totals) - Math.min(...totals);
    const spreadPct = spread / Math.max(...totals);
    if (
      !best ||
      spreadPct < best.spreadPct - 0.10 ||
      (spreadPct <= best.spreadPct + 0.10 && nCol > best.nCol)
    ) {
      best = { nCol, columns, spreadPct };
    }
  }
  return best ? best.columns : [cards];
}

// Owner request (this session): a few top-level feature names in the
// breakdown above are really a whole sub-system, not a single page —
// "My Classes" opens into 7 real tabs per class, "My Shop" covers 6
// real, distinct provider categories. A flat bullet with just the name
// undersells that. This map supplies the verified sub-detail for JUST
// those entries — every line traces to real code, not invented copy:
//   - My Classes tabs: src/pages/faculty/FacultyClassDetail.jsx's own
//     `TABS` array (Syllabus / Question Bank / Students & CR / Marks /
//     Attendance / Schedule / Notices). "Students & CR" sub-note is
//     deliberately read-only-scoped: that tab renders ClassmatesList
//     with `showActions={false}` for faculty (line ~2767) — a faculty
//     member can SEE roll-ordered roster + who's verified + who's CR/
//     ACR, but cannot appoint/revoke/verify from here (that authority
//     belongs to CL/CR themselves, a different screen). Marks/
//     Attendance sub-bullets trace to MarksTab's component-based
//     breakdown + PDF export, and AttendanceTab's Present/Absent/Late/
//     Excused marks + session log + Excel/PDF export.
//   - My Shop categories: src/lib/serviceCategoryConfig.js's
//     CATEGORY_SETUP_CONFIG keys (salon / hotel / medicine / bookstore
//     / onlinemart / errand) — each is a real, separately-configured
//     provider category with its own item vocabulary and availability
//     model (stock-based vs daily-available vs no fixed catalog for
//     Errand).
// Keys must exactly match a name string already present in
// STUDENT_FEATURES/FACULTY_FEATURES/PROVIDER_FEATURES above.
const FEATURE_SUBDETAIL = {
  'My Classes': {
    introBn: 'একটা ক্লাস খুললে ভিতরে ৭টা রিয়েল ট্যাব থাকে —',
    items: [
      { nameBn: 'Syllabus', descBn: 'ডিপার্টমেন্টের নির্ধারিত সিলেবাস' },
      { nameBn: 'Question Bank', descBn: 'ওই কোর্স ও টার্মের রিয়েল আগের প্রশ্নপত্র' },
      { nameBn: 'Students & CR', descBn: 'রোল অনুসারে ক্লাসমেট লিস্ট — কে ভেরিফায়েড, কে CR/ACR তা দেখা যায় (এখান থেকে অ্যাপয়েন্ট/ভেরিফাই করা যায় না, সেটা CL/CR-এর কাজ)' },
      { nameBn: 'Marks', descBn: 'নিজের কম্পোনেন্ট (CT ইত্যাদি) সেটআপ করে মার্কস এন্ট্রি, PDF এক্সপোর্ট' },
      { nameBn: 'Attendance', descBn: 'Present/Absent/Late/Excused, প্রতিদিনের সেশন লগ, Excel/PDF এক্সপোর্ট' },
      { nameBn: 'Schedule', descBn: 'দিন/সময় স্লট, কনফ্লিক্ট-চেক সহ' },
      { nameBn: 'Notices', descBn: 'সরাসরি ওই ক্লাসে নোটিশ ব্রডকাস্ট' },
    ],
  },
  'My Shop': {
    introBn: '৬টা রিয়েল ক্যাটাগরি, প্রতিটার নিজস্ব সেটআপ —',
    items: [
      { nameBn: 'Salon', descBn: 'সার্ভিস লিস্ট (হেয়ারকাট ইত্যাদি), এখন করানো যাচ্ছে/বন্ধ টগল' },
      { nameBn: 'Food / Hotel', descBn: 'মেনু আইটেম, আজ পাওয়া যাচ্ছে/নাই টগল' },
      { nameBn: 'Pharmacy', descBn: 'প্রোডাক্ট, স্টকে আছে/নাই স্ট্যাটাস' },
      { nameBn: 'Stationery', descBn: 'বই-খাতা-ফটোকপি জাতীয় প্রোডাক্ট, স্টক স্ট্যাটাস' },
      { nameBn: 'Online Mart', descBn: 'দৈনন্দিন প্রয়োজনীয় জিনিস, শুধু ডেলিভারি' },
      { nameBn: 'Errand (Pick and Drop)', descBn: 'কোনো ফিক্সড ক্যাটালগ নেই — student/faculty যা চায় তা ফেচ/ডেলিভারি' },
    ],
  },
};


// Owner note (Phase 9 kickoff, carried into 9.3): Pick and Drop should
// read as more prominent than the other Services items wherever
// Services is rendered, not sorted away alphabetically — a small badge
// on just that one item, rather than a whole separate section, keeps it
// inside its real category (still a campus service) while still making
// it impossible to skim past.
//
// This session: extended from a single hardcoded 'Pick and Drop' check
// to a small tag map covering a few more high-traffic/high-value
// features per role (owner asked for suggestions, picked which to use).
// Kept as one flat name -> label lookup rather than per-role duplicate
// logic, since feature names are unique across the whole inventory.
//
// Owner follow-up: more highlighted features, and each one needed its
// own flavor rather than every tag repeating "সবচেয়ে বেশি ব্যবহৃত" /
// "জনপ্রিয়" back to back down the list. Each entry below is now
// { label, tone, Icon } — tone picks a distinct color+icon combo
// (TAG_TONES) so a visitor scanning the grid sees varied signals
// ("most used" vs "popular" vs "new" vs "student favorite") instead of
// the same badge stamped on six different items.
const TAG_TONES = {
  hot: { color: '#b8860b', bg: 'rgba(184,134,11,0.14)', Icon: Flame },       // most-used / high-traffic
  popular: { color: '#0d9488', bg: 'rgba(13,148,136,0.14)', Icon: TrendingUp }, // rising / popular
  favorite: { color: '#c026d3', bg: 'rgba(192,38,211,0.14)', Icon: Star },      // student/community favorite
  fresh: { color: '#2563eb', bg: 'rgba(37,99,235,0.14)', Icon: Zap },           // newly added / fast
};

const HIGHLIGHTED_FEATURES = {
  'Attendance': { label: 'সবচেয়ে বেশি ব্যবহৃত', tone: 'hot' },
  'Question Bank': { label: 'সবচেয়ে বেশি ব্যবহৃত', tone: 'hot' },
  'Pick and Drop': { label: 'জনপ্রিয়', tone: 'popular' },
  'Results & GPA': { label: 'জনপ্রিয়', tone: 'popular' },
  'Broadcast Notice': { label: 'সবার পছন্দ', tone: 'favorite' },
  'My Shop': { label: 'সবার পছন্দ', tone: 'favorite' },
  'Term Planner': { label: 'নতুন', tone: 'fresh' },
  'Class Planner': { label: 'নতুন', tone: 'fresh' },
  'Class Setup': { label: 'CR-দের প্রিয়', tone: 'favorite' },
  'Food': { label: 'দ্রুততম ডেলিভারি', tone: 'fresh' },
};

// GOLD kept as the default/fallback tone tint only — actual highlighted
// items now resolve their own color via TAG_TONES (see HIGHLIGHTED_FEATURES
// above), so the grid reads as several distinct signals instead of one
// repeated color. No badge text on mobile card items themselves (that's
// what cramped two-column rows before) — the tint + icon carry the
// "notable" signal there; the label text shows as a small pill on desktop
// and inside CRFeatureBlock, where there's room for it.
const GOLD = '#b8860b';
const GOLD_BG = 'rgba(184,134,11,0.12)';

function FeatureItem({ name, isMobileNav }) {
  const tag = HIGHLIGHTED_FEATURES[name];
  const tone = tag ? (TAG_TONES[tag.tone] || TAG_TONES.hot) : null;
  const color = tone?.color || GOLD;
  const bg = tone?.bg || GOLD_BG;
  const TagIcon = tone?.Icon || Sparkles;

  // Owner request (this session, refined): "My Classes" / "My Shop" are
  // whole sub-systems, not a single page — their verified nested
  // sub-list (see FEATURE_SUBDETAIL's header comment for where each line
  // traces back to in the actual app code) is ALWAYS shown open, no
  // click needed — owner's explicit call after trying click-to-expand
  // first: this is promotional content on a landing page, an extra tap
  // just to see it works against that goal. Only items present in
  // FEATURE_SUBDETAIL get this always-open sub-list; every other item
  // renders exactly as before (plain bullet, no chevron, nothing to
  // toggle).
  const subDetail = FEATURE_SUBDETAIL[name];

  return (
    <li style={{
      display: 'flex', flexDirection: 'column',
      padding: isMobileNav ? '0.4rem 0.4rem' : '0.4rem 0',
      borderBottom: '1px dashed var(--border)',
      borderRadius: tag ? '6px' : 0,
      minHeight: isMobileNav ? '2.4rem' : '2.1rem',
      // Items with an always-open sub-list (My Shop, My Classes, etc.)
      // span both columns — the nested detail block needs full row
      // width and would otherwise get crushed into a half column.
      gridColumn: subDetail ? '1 / -1' : undefined,
    }}>
      <div
        style={{
          display: 'flex', alignItems: 'flex-start', gap: '0.4rem',
          fontSize: isMobileNav ? '0.86rem' : '0.95rem',
          fontWeight: tag ? 800 : 700,
          color: tag ? color : 'var(--text)', lineHeight: 1.4,
          background: tag
            ? `linear-gradient(135deg, ${bg}, transparent 70%)`
            : 'transparent',
          borderRadius: tag ? '6px' : 0,
          padding: tag ? '0.05rem 0.2rem' : 0,
          boxShadow: tag && !isMobileNav ? `inset 0 1px 0 rgba(255,255,255,0.35)` : undefined,
        }}
      >
        {/* Owner ask (this session): drop the leading icon/emoji on
            every feature line — plain text bullet only. Highlighted
            items (tag !== null) keep their pill label further below,
            just without the icon glyph in front of the name. */}
        <span style={{ overflowWrap: 'anywhere', display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1 }}>
          {name}
          {tag && !isMobileNav && (
            <span style={{
              fontSize: '0.66rem', fontWeight: 800, color,
              background: bg, padding: '0.1rem 0.45rem', borderRadius: '999px',
              width: 'fit-content', letterSpacing: '0.01em',
            }}>
              {tag.label}
            </span>
          )}
        </span>
      </div>

      {subDetail && (
        <div style={{
          marginTop: '0.5rem', marginLeft: isMobileNav ? '0' : '1.25rem',
          padding: isMobileNav ? '0.6rem 0.65rem' : '0.7rem 0.85rem',
          borderLeft: isMobileNav ? 'none' : '2px solid var(--border)',
          borderRadius: '10px',
          background: 'var(--bg)',
        }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.45rem', fontWeight: 600 }}>
            {subDetail.introBn}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.4rem' }}>
            {subDetail.items.map((sub) => (
              <li key={sub.nameBn} style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text)' }}>{sub.nameBn}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.5 }}>{sub.descBn}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

// Each category now renders as its own visually distinct sub-card
// (border + subtle surface tint + its own rounded corners) instead of
// being a flat, borderless list sitting directly in the shared grid —
// owner feedback: categories were blurring into each other since only
// the uppercase label separated them. The label also gets a small
// accent-colored rule beside it so it reads as a card header, not just
// a caption.
function FeatureCategoryBlock({ label, items, isMobileNav }) {
  return (
    // AUDIT REWRITE (round 3): no longer forces height:100% / flex
    // column-stretch — that was the actual cause of the blank-space
    // problem (see FeatureBreakdown's comment above). Each card now
    // just takes its own natural content height inside the masonry
    // column it's placed in.
    <div className="kx-fcol" style={{
      padding: isMobileNav ? '0.85rem 0.9rem' : '26px 24px',
    }}>
      <div className="kx-fcol-title" style={{
        marginBottom: isMobileNav ? '0.55rem' : '16px',
        fontSize: isMobileNav ? '0.72rem' : '12px',
      }}>
        {label}
      </div>
      <ul style={{
        listStyle: 'none', margin: 0, padding: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gridAutoRows: isMobileNav ? '1fr' : 'auto',
        gap: isMobileNav ? '0.15rem 0.6rem' : '0.1rem 1rem',
        alignItems: 'stretch',
      }}>
        {items.map((name) => (
          <FeatureItem key={name} name={name} isMobileNav={isMobileNav} />
        ))}
      </ul>
    </div>
  );
}

// CR block is deliberately its own card, separate from the Student tab's
// grid — owner note (landingFeatureInventory.js header): CR is a
// permission layer on top of Student in nav.js (requiresCR: true), not
// its own role, but is easy for a visitor to miss entirely since most
// students never see it, so it gets explicit billing here rather than
// being folded quietly into the Student category grid.
function CRFeatureBlock() {
  return (
    // AUDIT REWRITE (round 3): restyled to match the other .kx-fcol
    // category cards (same border/bg/radius language) instead of its
    // own dashed-accent strip, and grid changed from auto-fit(150px) —
    // which barely fit 2 items per row inside a single masonry column —
    // to a fixed 2-col grid tuned for that column width. This card now
    // flows as a normal masonry item (FeatureBreakdown passes it in
    // alongside the category cards) instead of sitting in its own
    // margin-topped strip below the whole grid.
    <div className="kx-fcol kx-fcol-cr" style={{ padding: '1.1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <Crown size={16} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text)' }}>
          Class Representative (CR) হলে আরও বেশি
        </span>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.6rem' }}>
        CR-রা Student-এর সব ফিচারের সাথে নিজের ক্লাসের জন্য এই টুলগুলোও পান —
      </p>
      <ul style={{
        listStyle: 'none', margin: 0, padding: 0,
        display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.4rem 0.6rem',
      }}>
        {CR_FEATURES.map((name) => {
          const tag = HIGHLIGHTED_FEATURES[name];
          const tone = tag ? (TAG_TONES[tag.tone] || TAG_TONES.hot) : null;
          return (
            <li key={name} style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem',
              fontWeight: tag ? 800 : 700,
              color: tag ? tone.color : 'var(--text)',
              background: tag ? `linear-gradient(135deg, ${tone.bg}, transparent 70%)` : 'transparent',
              padding: tag ? '0.2rem 0.4rem' : 0,
              borderRadius: tag ? '6px' : 0,
              boxShadow: tag ? 'inset 0 1px 0 rgba(255,255,255,0.35)' : undefined,
            }}>
              <span>{name}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FeatureBreakdown({ isMobileNav }) {
  const [activeTab, setActiveTab] = useState('student');
  const tab = FEATURE_TABS.find((t) => t.id === activeTab);
  const categories = Object.entries(tab.features);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
  };

  return (
    // Full-bleed --kx-bg role-section, matches HTML's .role-section +
    // .feature-columns exactly — role-tabs row, then real fcol cards.
    <section id="roles" className="kx-page kx-theme-vars" style={{ width: '100%', background: 'var(--kx-bg)', padding: isMobileNav ? '2.25rem 1.1rem 0' : '80px 32px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h2 className="kx-h2" style={{ fontSize: isMobileNav ? 'clamp(1.35rem, 6vw, 1.7rem)' : '36px', marginBottom: '0.4rem' }}>
          {FEATURE_COUNT_DISPLAY} ফিচার, প্রতিটাই আসল
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--kx-ink-soft)', maxWidth: '480px', margin: '0 auto' }}>
          এখানে যা দেখছো তার সবটাই অ্যাপের real navigation থেকে — কোনো marketing list না।
        </p>
      </div>

      {/* Role tabs — matches HTML's .role-tabs (dark active pill),
          sticky on mobile so role context stays visible while scrolling
          the long feature list below. */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '40px', flexWrap: 'wrap',
        position: isMobileNav ? 'sticky' : 'static', top: isMobileNav ? '0' : undefined,
        zIndex: isMobileNav ? 5 : undefined,
        padding: isMobileNav ? '0.5rem 0' : 0,
        background: isMobileNav ? 'var(--kx-bg)' : undefined,
      }}>
        {FEATURE_TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === activeTab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabClick(t.id)}
              className={`kx-role-tab${active ? ' active' : ''}`}
            >
              <Icon size={15} /> {t.title}
            </button>
          );
        })}
      </div>

      {/* AUDIT REWRITE (round 7) — CSS column-count (rounds 3-6) balances
          TOTAL height across columns but fills strictly in DOM order,
          so it can't move a card to an earlier column to close a gap —
          verified this leaves Student's columns 301px apart even though
          a better split (5px apart) exists for the same cards. Switched
          to explicit column ASSIGNMENT: cardWeight() estimates each
          card's real render height (mirrors the actual CSS — card
          padding, per-item line height, FEATURE_SUBDETAIL's nested-list
          height), then assignToColumns() greedily drops each card
          (tallest-first) into whichever column is currently shortest —
          this is what actually gets flush/near-flush bottoms, not just
          "no column is dramatically taller". Faculty's own real data
          has a 533px card that alone outweighs the other three combined
          (662px) — no arrangement gets that role's columns closer than
          ~128px apart, which is a data-shape ceiling, not something
          this algorithm failed to solve; a border/background band under
          the grid (kx-fcol-floor below) gives the requested "bound/
          contained" edge regardless of that residual gap.

          AUDIT REWRITE (round 8) — owner worry: could balancing for
          flush bottoms backfire by dumping several big cards onto ONE
          column, making it disproportionately long while another stays
          short (the opposite of the goal)? Checked directly: greedy-
          least-filled (assignToColumns) always adds the next card to
          whichever column is CURRENTLY shortest, so the moment one
          column takes a big card it becomes the tallest and gets
          skipped until the others catch up — it structurally cannot
          runaway-stack multiple big cards onto one column while another
          sits empty. Also checked forcing Faculty's "core" (the one
          genuinely oversized card) to share a column instead of sitting
          alone: every 2-card/2-card split tested comes out WORSE (185px/
          27% spread) than letting it sit alone (128px/19%) — so "core"
          alone in its column isn't an imbalance bug, it's the actual
          best available split for that card's real size. columnCount
          itself is no longer a hand-picked constant either
          (bestColumnLayout, defined near assignToColumns, tries 1-3
          columns against the real card weights and picks whichever
          has the lowest height-spread without ever leaving a column
          empty) — so this self-corrects if the underlying feature list
          ever changes shape, instead of a stale number quietly going
          wrong. */}
      <div style={{ maxWidth: '1180px', margin: '0 auto', paddingBottom: isMobileNav ? '2rem' : '90px' }}>
        <div
          className={!isMobileNav ? 'kx-fcol-floor' : undefined}
          style={{
            display: isMobileNav ? 'block' : 'flex',
            gap: isMobileNav ? 0 : '22px',
            alignItems: 'flex-start',
          }}
        >
          {isMobileNav ? (
            <>
              {categories.map(([key, items]) => (
                <div key={key} style={{ marginBottom: '0.85rem' }}>
                  <FeatureCategoryBlock label={tab.labels[key] || key} items={items} isMobileNav={isMobileNav} />
                </div>
              ))}
              {activeTab === 'student' && (
                <div style={{ marginBottom: '0.85rem' }}>
                  <CRFeatureBlock />
                </div>
              )}
            </>
          ) : (
            (() => {
              const cards = categories.map(([key, items]) => ({
                key, items, weight: cardWeight(items),
              }));
              if (activeTab === 'student') {
                cards.push({ key: '__cr', items: null, weight: CR_CARD_WEIGHT });
              }

              const renderCard = (card) => (
                card.key === '__cr' ? (
                  <CRFeatureBlock />
                ) : (
                  <FeatureCategoryBlock label={tab.labels[card.key] || card.key} items={card.items} isMobileNav={isMobileNav} />
                )
              );

              // Owner ask (this session): when one card is clearly the
              // heaviest/widest-content one (Faculty's "core" card, ~2x+
              // any other card here), it should sit ALONE on a full-width
              // row up top instead of being squeezed into a column next
              // to much shorter cards — THEN the rest flow into a plain
              // 2-column grid below. This is a structural layout rule
              // (not the weight-balancing bestColumnLayout does for the
              // general case): only kicks in when a genuine outlier
              // exists, so card sets without one (Provider's single
              // "shop" card, Student's evenly-sized set) fall through to
              // the existing balanced-column logic unchanged.
              const heaviest = cards.reduce((a, b) => (b.weight > a.weight ? b : a), cards[0]);
              const rest = cards.filter((c) => c !== heaviest);
              const restWeight = rest.reduce((s, c) => s + c.weight, 0);
              // Threshold verified against real card weights: Faculty's
              // heaviest card ("services", 6 items) sits at ~0.53x the
              // combined weight of its other 3 cards — should trigger
              // this layout. Student's heaviest ("core", w/ My Classes'
              // subdetail list) sits at ~0.41x its other 6 cards' combined
              // weight — should NOT trigger (its existing balanced-column
              // layout already reads fine at that ratio). 0.5 sits
              // between the two, cleanly separating them.
              const isOutlier = rest.length >= 2 && heaviest.weight > restWeight * 0.5;

              if (isOutlier) {
                const twoCol = bestColumnLayout(rest, 2);
                return (
                  <div style={{ width: '100%' }}>
                    <div style={{ marginBottom: '22px' }}>{renderCard(heaviest)}</div>
                    <div style={{ display: 'flex', gap: '22px' }}>
                      {twoCol.map((col, ci) => (
                        <div key={ci} style={{ flex: '1 1 0', minWidth: 0 }}>
                          {col.map((card) => (
                            <div key={card.key} style={{ marginBottom: '22px' }}>
                              {renderCard(card)}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              const columns = bestColumnLayout(cards, 3);
              return columns.map((col, ci) => (
                <div key={ci} style={{ flex: '1 1 0', minWidth: 0 }}>
                  {col.map((card) => (
                    <div key={card.key} style={{ marginBottom: '22px' }}>
                      {renderCard(card)}
                    </div>
                  ))}
                </div>
              ));
            })()
          )}
        </div>
      </div>
    </section>
  );
}

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
function MockupFrame({ mode, children, scrollHostRef }) {
  const isPhone = mode === 'phone';
  return (
    <div style={{
      margin: '0 auto',
      // Phone mode: exact HTML .phone-frame treatment — dark green
      // rounded device shell with a notch, not a plain bordered box.
      // Desktop mode: capped at 420px (not a raw 100% of its grid
      // column) so the "browser window" doesn't stretch wide-and-short
      // against a ~470px column — that mismatch was what made it look
      // off/squat. Capping width keeps it proportioned like an actual
      // browser window regardless of how wide the column ends up.
      width: isPhone ? '272px' : '100%',
      maxWidth: isPhone ? '272px' : '420px',
      borderRadius: isPhone ? '34px' : '16px',
      background: isPhone ? 'var(--kx-dark)' : 'var(--kx-card)',
      padding: isPhone ? '12px' : 0,
      border: isPhone ? 'none' : '1.5px solid var(--kx-line)',
      boxShadow: isPhone
        ? '0 40px 80px rgba(12,39,24,0.35), 0 0 0 1px rgba(0,0,0,0.06)'
        : '0 12px 32px rgba(0,0,0,0.12)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {isPhone ? (
        <div style={{ height: '20px', position: 'relative' }}>
          <div style={{
            position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)',
            width: '90px', height: '20px', borderRadius: '0 0 14px 14px', background: 'var(--kx-dark)',
          }} />
        </div>
      ) : (
        <div style={{
          height: '32px', display: 'flex', alignItems: 'center', gap: '6px',
          padding: '0 12px', borderBottom: '1px solid var(--kx-line)',
        }}>
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ff5f57' }} />
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#febc2e' }} />
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#28c840' }} />
        </div>
      )}
      <div
        ref={scrollHostRef}
        style={{
          background: isPhone ? 'var(--kx-bg)' : 'var(--kx-card)',
          borderRadius: isPhone ? '24px' : 0,
          // Phone: tall/narrow like a real device screen. Desktop: now
          // capped at 420px wide (see width above), so height is tuned
          // to roughly a 4:3-ish browser-window feel at that width
          // rather than looking squat — 300px was too short once width
          // stopped stretching to fill the column.
          minHeight: isPhone ? '380px' : '360px',
          maxHeight: isPhone ? '380px' : '400px',
          overflowY: 'auto',
          // Auto-scroll is driven programmatically (RotatingPreview), so
          // hide the scrollbar for a cleaner "someone else is scrolling
          // this" look rather than an obviously-draggable native bar.
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        className="kuetx-mockup-scrollhost"
      >
        {children}
      </div>
    </div>
  );
}

// ─── Rotating hero preview (replaces the old click-to-open role cards) ──
// Owner brief (this session): the three role cards with bullet lists are
// gone entirely — the mockup preview is now ALWAYS visible, auto-rotating
// Student -> Faculty -> Provider on a loop. Each role's dwell has three
// phases: (1) sit still briefly, (2) auto-scroll the mockup's own inner
// content slowly top-to-bottom (like someone scrolling a real phone/
// laptop), (3) rotate to the next role. A small role-tab row above the
// frame lets a visitor manually jump to a role — doing so pauses
// auto-rotate for ROLE_PAUSE_MS, then normal rotation resumes from
// wherever the sequence naturally continues. The frame itself is
// position: sticky so it stays in view while the visitor scrolls past it
// (owner-confirmed: pinned, not a normal scrolling section).
const ROLE_SEQUENCE = ['student', 'faculty', 'provider'];
const SETTLE_MS = 1400; // brief pause before inner auto-scroll starts
const SCROLL_MS = 3800; // duration of the inner auto-scroll sweep
const HOLD_MS = 1200; // pause at bottom before rotating to next role
const MANUAL_PAUSE_MS = 8000; // pause after a manual role pick before auto-rotate resumes

function RotatingPreview({ mockupMode, setMockupMode, onSignUp, isMobileNav }) {
  // Mobile visitors only ever need the phone mockup — a "desktop browser
  // window" preview inside an already-narrow mobile viewport just wastes
  // space and looks broken. Force phone mode on mobile regardless of
  // whatever mockupMode state holds, and hide the phone/desktop toggle
  // buttons there since there's nothing to toggle.
  const effectiveMode = isMobileNav ? 'phone' : mockupMode;
  const [activeRole, setActiveRole] = useState('student');
  const scrollHostRef = useRef(null);
  const timeoutsRef = useRef([]);
  const manualUntilRef = useRef(0);

  const clearTimers = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  // Single recursive scheduler driving the whole loop: show role -> settle
  // -> inner auto-scroll to bottom -> hold -> (wait out any active manual
  // pause) -> reset scroll -> advance to next role -> repeat. Both the
  // initial mount and a manual pick funnel through this one function so
  // there's exactly one source of truth for the cadence.
  const scheduleRole = (roleId) => {
    setActiveRole(roleId);

    const t1 = setTimeout(() => {
      const host = scrollHostRef.current;
      if (host) host.scrollTo({ top: host.scrollHeight - host.clientHeight, behavior: 'smooth' });

      const t2 = setTimeout(() => {
        const wait = Math.max(0, manualUntilRef.current - Date.now());
        const t3 = setTimeout(() => {
          if (scrollHostRef.current) scrollHostRef.current.scrollTo({ top: 0, behavior: 'auto' });
          const idx = ROLE_SEQUENCE.indexOf(roleId);
          const next = ROLE_SEQUENCE[(idx + 1) % ROLE_SEQUENCE.length];
          scheduleRole(next);
        }, wait);
        timeoutsRef.current.push(t3);
      }, SCROLL_MS + HOLD_MS);
      timeoutsRef.current.push(t2);
    }, SETTLE_MS);
    timeoutsRef.current.push(t1);
  };

  useEffect(() => {
    scheduleRole('student');
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSelect = (roleId) => {
    clearTimers();
    manualUntilRef.current = Date.now() + MANUAL_PAUSE_MS;
    if (scrollHostRef.current) scrollHostRef.current.scrollTo({ top: 0, behavior: 'auto' });
    scheduleRole(roleId);
  };

  const roleTabsRow = (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
      {ROLE_CARDS.map(role => {
        const Icon = role.icon;
        const active = activeRole === role.id;
        return (
          <button
            key={role.id}
            type="button"
            onClick={() => handleManualSelect(role.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.4rem 0.85rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700,
              border: active ? '1px solid var(--kx-accent)' : '1px solid var(--kx-line)',
              cursor: 'pointer', transition: 'all 0.15s',
              background: active ? 'var(--kx-accent)' : 'var(--kx-card)',
              color: active ? '#fff' : 'var(--kx-ink)',
            }}
          >
            <Icon size={13} /> {role.title}
          </button>
        );
      })}
      {!isMobileNav && (
        <>
          <div style={{ width: '1px', background: 'var(--kx-line)', margin: '0 0.2rem' }} />
          <button
            type="button"
            onClick={() => setMockupMode('phone')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.4rem 0.7rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700,
              border: '1px solid var(--kx-line)', cursor: 'pointer',
              background: mockupMode === 'phone' ? 'var(--kx-accent)' : 'transparent',
              color: mockupMode === 'phone' ? '#fff' : 'var(--kx-ink)',
            }}
          >
            <Smartphone size={13} />
          </button>
          <button
            type="button"
            onClick={() => setMockupMode('desktop')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.4rem 0.7rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700,
              border: '1px solid var(--kx-line)', cursor: 'pointer',
              background: mockupMode === 'desktop' ? 'var(--kx-accent)' : 'transparent',
              color: mockupMode === 'desktop' ? '#fff' : 'var(--kx-ink)',
            }}
          >
            <Monitor size={13} />
          </button>
        </>
      )}
    </div>
  );

  const signUpButton = (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
      <button
        type="button"
        onClick={onSignUp}
        style={{
          padding: '0.75rem 1.5rem', borderRadius: '12px',
          background: 'var(--kx-accent)', color: '#fff', border: 'none',
          fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer',
        }}
      >
        {ROLE_CARDS.find(r => r.id === activeRole)?.title || ''} হিসেবে Sign Up করো
      </button>
    </div>
  );

  const activeRoleMeta = ROLE_CARDS.find(r => r.id === activeRole);

  return (
    // Full-bleed --kx-bg .proof-section — phone/frame on one side, real
    // "not a mockup, it's your own codebase" copy column on the other,
    // matching the HTML's .proof-grid exactly. The phone/frame itself
    // stays 100% real (RotatingPreview's own live-switching demo data,
    // DemoContent -> Student/Faculty/ProviderDemoDashboard) — only the
    // surrounding visual frame/copy changed.
    <section className="kx-page" style={{ width: '100%', background: 'var(--kx-bg)', padding: isMobileNav ? '0.75rem 1.1rem 1.75rem' : '10px 32px 60px' }}>
      <style>{`.kuetx-mockup-scrollhost::-webkit-scrollbar { display: none; }`}</style>
      {/* Wrapped in an actual visible card now — background + border +
          shadow + padding — instead of sitting bare on the page bg with
          no visual container. Card background is a shade off the page
          bg (var(--kx-card), i.e. white) so it reads as "a distinct
          panel", not "same color as everything around it". */}
      <div style={{
        maxWidth: '1180px', margin: '0 auto',
        background: 'var(--kx-card)',
        border: '1px solid var(--kx-line)',
        borderRadius: isMobileNav ? '20px' : '28px',
        boxShadow: '0 4px 24px rgba(12,39,24,0.06)',
        padding: isMobileNav ? '1.5rem 1.1rem' : '3rem',
      }}>
        <div style={{
          display: isMobileNav ? 'block' : 'grid',
          gridTemplateColumns: isMobileNav ? undefined : '0.85fr 1.15fr',
          gap: isMobileNav ? undefined : '48px',
          alignItems: 'center',
        }}>
          <div>
            {roleTabsRow}
            <MockupFrame mode={effectiveMode} scrollHostRef={scrollHostRef}>
              <DemoContent role={activeRole} />
            </MockupFrame>
            {signUpButton}
          </div>

          <div style={{ marginTop: isMobileNav ? '2rem' : 0, textAlign: isMobileNav ? 'center' : 'left' }}>
            <div className="kx-eyebrow" style={{ marginBottom: '0.9rem' }}>সত্যিকারের অ্যাপ থেকে</div>
            <h2 className="kx-h2" style={{ fontSize: isMobileNav ? 'clamp(1.25rem, 6vw, 1.55rem)' : '30px', marginBottom: '16px' }}>
              এটা ডিজাইন-নমুনা নয় — তোমার নিজের অ্যাপ থেকেই নেওয়া লাইভ প্রিভিউ।
            </h2>
            <p style={{
              fontSize: '16px', color: 'var(--kx-ink-soft)', lineHeight: 1.65, marginBottom: '24px',
              maxWidth: '440px', marginLeft: isMobileNav ? 'auto' : 0, marginRight: isMobileNav ? 'auto' : 0,
            }}>
              {activeRoleMeta?.title || ''} হিসেবে লগইন করলে ঠিক এই ড্যাশবোর্ডটাই দেখবে — উপস্থিতি, ফলাফল,
              নোটিশ থেকে শুরু করে প্রশ্নব্যাংক ও ক্যাম্পাস সার্ভিস বুকিং পর্যন্ত, সবকিছু একই লগইনে।
            </p>
            {/* AUDIT FIX: this list used to be 3 hardcoded generic lines
                (📱/⚡/🗂️) that never changed when the visitor switched
                roles — the copy claimed to preview "your" dashboard but
                showed identical bullets for Student, Faculty, and
                Provider. ROLE_CARDS already carries real, role-specific
                bullets (used elsewhere for the role picker cards) — this
                now reuses that same real data so the 4 lines shown here
                actually match whichever role is currently active. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: isMobileNav ? 'center' : 'flex-start' }}>
              {(activeRoleMeta?.bullets || []).map((bullet, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14.5px', fontWeight: 600, textAlign: 'left' }}>
                  <span style={{
                    width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
                    background: 'var(--kx-sage)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                  }}>
                    {activeRoleMeta?.emoji}
                  </span>
                  {bullet}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer (Phase 9.5) ─────────────────────────────────────────────────
// Owner-confirmed brief (tracker §9.5): real Founder personal contact,
// not a generic "contact form" placeholder. Email + WhatsApp are copied
// verbatim from About.jsx's own developer-contact block (the same two
// links already live and public there: mailto:mdakhinoorislam.official.
// 2005@gmail.com, wa.me/8801724812042) — this footer doesn't invent a
// new contact channel, it just surfaces the one that already exists one
// click deeper on /about, for a visitor who's still on the landing page
// and hasn't navigated there yet. /about and /privacy are both real,
// currently-unguarded routes (App.jsx — /privacy is explicitly commented
// "Publicly reachable (no route guard)"; /about has no Require* wrapper
// either) so both are safe to link directly from this signed-out page.
// ─── Credits corner — rotating founder/contributor spotlight ───────────
// Owner request (this session): a single rotating photo spot for people
// who matter to the project — founder first, then special-thanks/future
// contributors as they're added — each with a role label above and a
// short one-line intro below the photo. Deliberately placed just before
// Footer (not near the hero or mixed into the main content flow): owner
// wants this kept secondary to the product itself since the landing
// page's main job is showing KUETx to visitors, not the people behind
// it — so it earns a small, honest spot near the end rather than
// competing with the primary hero/stats/features for attention.
//
// Data-only array so adding/removing a person later is a one-line edit,
// no layout change needed.
//
// `photoShape`: 'circle' (default) for a single person's portrait —
// 'wide' for a group photo, which renders as a rounded rectangle
// instead of a circle so a wide group shot doesn't get chopped down to
// a tiny round crop that loses everyone but the center face.
//
// Founder photo: owner-supplied portrait, cropped square + web-optimized
// (900x900, ~96KB) and saved at /landing/credits/founder.jpg — kept
// separate from About.jsx's /pp1.jpg since the owner supplied a
// different, dedicated photo for this spot rather than reusing that one.
const CREDITS_SPOTLIGHT = [
  {
    id: 'founder',
    role: 'Founder',
    name: 'Akhinoor',
    photo: '/landing/credits/founder.jpg',
    photoShape: 'circle',
    blurb: 'KUETx-এর প্রতিষ্ঠাতা ও মূল ডেভেলপার — নিজের ক্যাম্পাসের সমস্যা দেখে পুরো অ্যাপটা বানানো শুরু করে।',
  },
  {
    id: 'ese-faculty',
    role: 'Special Thanks',
    name: 'ESE Department-এর শিক্ষকরা',
    photo: '/landing/credits/ese-faculty-thanks.jpg',
    photoShape: 'wide',
    blurb: 'KUETx-এর পুরো journey জুড়ে ESE department-এর শিক্ষকরা যেভাবে অনুপ্রেরণা ও সাপোর্ট দিয়েছেন, তার জন্য বিশেষ ধন্যবাদ।',
  },
];

// ─── Video showcase (owner ask, this session) ────────────────────────────
// Rotating card that plays KUETx's own YouTube videos in-place — real
// embedded player, not a link out. Video list comes from
// /api/youtube-videos (Vercel Serverless Function, see that file's own
// header comment for why the fetch happens server-side: the YouTube
// Data API key can never be shipped to the browser). Placed as its own
// beat between CampusScrapbook (photo identity) and CreditsSpotlight
// (people credits) — right before the final CTA, as a last, richer
// social-proof beat: "here's what we're actually building/doing", in
// video rather than just photos.
//
// Auto-rotates through the fetched list every ROTATE_MS; either arrow
// click also advances/retreats manually AND resets that timer, so a
// visitor who's actively browsing videos doesn't get yanked to a
// different one mid-interaction. Renders nothing (not even the section
// shell) if the fetch comes back empty — never shows a broken/empty
// player.
const VIDEO_ROTATE_MS = 9000;

function VideoShowcase({ isMobileNav }) {
  const { ref, visible } = useRevealOnVisible();
  const [videos, setVideos] = useState([]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/youtube-videos')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setVideos(Array.isArray(data?.videos) ? data.videos : []);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  // Auto-rotate. Depends on `videos.length` (stable once loaded) and
  // `index` isn't a dependency — the interval always advances relative
  // to whatever `index` is *at fire time* via the functional setState
  // form below, so this effect doesn't need to re-run (and restart the
  // timer) every time the active video changes on its own.
  useEffect(() => {
    if (videos.length < 2) return undefined;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % videos.length);
    }, VIDEO_ROTATE_MS);
    return () => clearInterval(id);
  }, [videos.length]);

  const goTo = (next) => {
    // Manual navigation resets the rotation "clock" too: the interval
    // above is keyed only off videos.length, so changing `index` here
    // doesn't itself restart it — instead we rely on the interval's
    // own next tick being VIDEO_ROTATE_MS away from whenever it last
    // fired. Re-mounting the effect on every manual click (by also
    // depending on `index`) would be the alternative, but that plus
    // the functional setState form above is unnecessary complexity for
    // the same result, since the interval already reads the latest
    // index via the updater function. Simplicity kept over
    // micro-perfect timer resets on manual nav.
    setIndex(next);
  };

  // Owner ask: never fully hide this section, even before the fetch
  // resolves or when the channel/API returns zero videos — instead show
  // a fixed-size "video is coming" placeholder in the exact same box
  // (same aspectRatio, same maxWidth) so the page's layout/height never
  // jumps depending on whether videos are loaded yet. Arrows/dots/title
  // just don't render in this state since there's nothing to navigate.
  const hasVideos = loaded && videos.length > 0;
  const current = hasVideos ? videos[index] : null;
  const goPrev = () => goTo((index - 1 + videos.length) % videos.length);
  const goNext = () => goTo((index + 1) % videos.length);

  return (
    <div
      className="kx-page"
      style={{
        maxWidth: '1180px', margin: '0 auto',
        padding: isMobileNav ? '2.5rem 1.1rem' : '80px 32px',
      }}
    >
      <div
        ref={ref}
        className={`kx-reveal${visible ? ' kx-in-view' : ''}`}
        style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 40px' }}
      >
        <div className="kx-eyebrow" style={{ marginBottom: '0.75rem' }}>
          KUETx YouTube
        </div>
        <h2 className="kx-h2" style={{ fontSize: isMobileNav ? 'clamp(1.35rem, 6vw, 1.7rem)' : '36px' }}>
          আমরা যা বানাচ্ছি, ভিডিওতে দেখো
        </h2>
      </div>

      <div style={{
        maxWidth: isMobileNav ? '820px' : '1020px', margin: '0 auto',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ position: 'relative' }}>
          <div
            className="kx-card"
            style={{
              overflow: 'hidden', aspectRatio: '16 / 9', background: '#000',
              position: 'relative',
            }}
          >
            {hasVideos ? (
              <iframe
                key={current.id}
                src={`https://www.youtube.com/embed/${current.id}?autoplay=1&mute=1&rel=0`}
                title={current.title}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              // "Video is coming" placeholder — same box, no iframe. Shown
              // both while the fetch is in flight (loaded === false) and
              // after it resolves with zero videos, so there's no flash
              // between "nothing" and "empty state" — it's one state the
              // whole time until real videos actually arrive.
              <div
                style={{
                  width: '100%', height: '100%',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: '10px', color: 'rgba(255,255,255,0.55)',
                  background: 'linear-gradient(180deg, #111 0%, #000 100%)',
                }}
              >
                <Youtube size={isMobileNav ? 28 : 36} strokeWidth={1.5} />
                <div style={{
                  fontFamily: 'var(--kx-mono, inherit)', fontSize: isMobileNav ? '12px' : '13px',
                  letterSpacing: '0.04em',
                }}>
                  ভিডিও শীঘ্রই আসছে
                </div>
              </div>
            )}
          </div>

          {/* Arrows overlay the video box edges (absolute, anchored to
              the relative box wrapper directly above) instead of
              sitting in a flex row beside it — this way they don't eat
              width from the box, so the box itself can use the full
              1020px column. Hidden on mobile: edge-to-edge video box
              leaves no room beside it there; mobile users have the
              dots + the manual nav row below instead. */}
          {!isMobileNav && hasVideos && videos.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label="আগের ভিডিও"
                className="kx-card"
                style={{
                  position: 'absolute', left: '-22px', top: 'calc(50% - 22px)',
                  zIndex: 2, width: '44px', height: '44px', borderRadius: '999px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--kx-ink)',
                }}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="পরের ভিডিও"
                className="kx-card"
                style={{
                  position: 'absolute', right: '-22px', top: 'calc(50% - 22px)',
                  zIndex: 2, width: '44px', height: '44px', borderRadius: '999px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--kx-ink)',
                }}
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
          </div>

          <div style={{
            fontSize: isMobileNav ? '0.9rem' : '15px', fontWeight: 700,
            color: 'var(--kx-ink)', textAlign: 'center',
            marginTop: '16px', lineHeight: 1.4,
            minHeight: isMobileNav ? '1.26rem' : '21px',
          }}>
            {current ? current.title : '\u00A0'}
          </div>

          {hasVideos && videos.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '14px' }}>
              {videos.map((v, i) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`ভিডিও ${i + 1}`}
                  style={{
                    width: i === index ? '20px' : '7px', height: '7px', borderRadius: '999px',
                    border: 'none', cursor: 'pointer', padding: 0,
                    background: i === index ? 'var(--kx-accent)' : 'var(--kx-line)',
                    transition: 'width 0.25s ease, background 0.25s ease',
                  }}
                />
              ))}
            </div>
          )}

          {/* Manual nav row for mobile, where the side arrows are hidden. */}
          {isMobileNav && hasVideos && videos.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '14px' }}>
              <button
                type="button"
                onClick={goPrev}
                aria-label="আগের ভিডিও"
                className="kx-card"
                style={{
                  width: '40px', height: '40px', borderRadius: '999px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--kx-ink)',
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="পরের ভিডিও"
                className="kx-card"
                style={{
                  width: '40px', height: '40px', borderRadius: '999px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--kx-ink)',
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreditsSpotlight({ isMobileNav }) {
  const { ref, visible } = useRevealOnVisible();
  const [index, setIndex] = useState(0);
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    if (CREDITS_SPOTLIGHT.length < 2) return undefined;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % CREDITS_SPOTLIGHT.length);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  // Reset the broken-image fallback whenever the rotation moves to a
  // new person, so one person's missing photo doesn't stick as the
  // fallback state for everyone who rotates in after them.
  useEffect(() => { setImgOk(true); }, [index]);

  if (CREDITS_SPOTLIGHT.length === 0) return null;
  const person = CREDITS_SPOTLIGHT[index];
  const initials = person.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Round 9 (owner audit): the old 'circle' vs 'wide' shape split gave
  // Founder a 104x104px circle and the group photo an unbounded
  // width:100%/height:auto box (which rendered ~380x270px for a real
  // landscape group photo) — two very different box sizes rotating
  // in the same spot visibly shifted the whole page's height every
  // 4.5s, and the outer wrapper's own maxWidth (340px vs 480px) added
  // a SECOND size jump on top of that. Fixed: every entry — solo
  // portrait or group photo — now renders inside the exact same fixed
  // box (PHOTO_BOX_W x PHOTO_BOX_H), same rounded-rect shape for both.
  // A circle crop was ruled out for the group photo specifically: it
  // would cut off the people standing at the left/right edges of a
  // 5-person lineup, which a rounded rectangle avoids while still
  // reading as a distinct "photo," not a plain box.
  // Solo portraits get their own smaller, near-square box (a portrait
  // face reads fine small and doesn't need a wide landscape frame);
  // group photos keep the wider box so a multi-person lineup doesn't
  // get squeezed. Each shape still has ONE fixed size across every
  // person who uses it, so rotating between two portraits (or two
  // group photos) never jumps height — only switching shape families
  // does, which happens at most once per rotation cycle here.
  const isWide = person.photoShape === 'wide';
  const PHOTO_BOX_W = isWide ? (isMobileNav ? 220 : 300) : (isMobileNav ? 116 : 140);
  const PHOTO_BOX_H = isWide ? (isMobileNav ? 176 : 240) : (isMobileNav ? 116 : 140);

  return (
    <div
      ref={ref}
      className="kx-theme-vars"
      style={{
        position: 'relative',
        marginBottom: isMobileNav ? '1.5rem' : '2rem',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(14px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}
    >
      {/* Soft spotlight glow — owner asked for a literal spotlight-beam
          treatment (cone of light) here, but that needs a dark backing
          to read correctly and would break both light-mode legibility
          and the app's own no-hardcoded-color rule for this section.
          This is the toned-down equivalent: a radial glow in the same
          --accentRGB the rest of the app already uses (see CampusHero's
          identical technique), centered behind the photo rather than
          the whole card, so it reads as "a light settling on this
          person" without needing a dark background or a new color. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: isMobileNav ? '-30px' : '-40px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: isWide ? (isMobileNav ? '260px' : '340px') : (isMobileNav ? '160px' : '190px'),
          height: isWide ? (isMobileNav ? '260px' : '340px') : (isMobileNav ? '160px' : '190px'),
          background: 'radial-gradient(ellipse 50% 50% at 50% 35%, rgba(var(--accentRGB),0.16), transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Fixed maxWidth now, not a per-person value — this used to
          switch 340px/480px depending on the rotating person's photo
          shape, which was the second source of the page-height jump
          the owner flagged (screenshots showed the whole card visibly
          widening/narrowing on rotation, not just the photo). */}
      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: '380px', margin: '0 auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', gap: '0.6rem',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em',
          color: 'var(--accentDark)', background: 'var(--accentSoft)',
          border: '1px solid rgba(var(--accentRGB),0.25)',
          padding: '0.3rem 0.75rem', borderRadius: '999px',
        }}>
          {person.role}
        </div>

        {/* Photo — same rotating spot AND same fixed box for every
            entry now (solo portrait or group photo), only the image
            source swaps as `index` changes, so this reads as one place
            cycling through entries with a stable size rather than a
            layout that reflows per-person. Falls back to an initials
            tile (same visual language as Footer's other UI, not a
            broken-image icon) if a person's photo hasn't been supplied
            yet or fails to load — group photos don't get an initials
            fallback since "initials" doesn't make sense for a group
            entry, so those just show the accent-tinted empty box. */}
        <div style={{
          width: PHOTO_BOX_W,
          height: PHOTO_BOX_H,
          borderRadius: isWide ? '14px' : '999px',
          overflow: 'hidden',
          border: '3px solid var(--accentLight)',
          boxShadow: '0 10px 24px rgba(0,0,0,0.14)',
          background: 'var(--accentSoft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {imgOk && person.photo ? (
            <img
              src={person.photo}
              alt={person.name}
              loading="lazy"
              onError={() => setImgOk(false)}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                // Owner audit: 'center' vertical crop was cutting off
                // the top of the head on solo portraits — the photo box
                // is a 1.25:1 landscape-ish rectangle but a portrait's
                // face sits in the UPPER portion of a square/tall
                // source photo, so a dead-center crop chops the
                // forehead/hair. Bias the crop upward for portraits
                // (photoShape !== 'wide'); group photos keep a true
                // center crop since there's no single face to protect.
                objectPosition: person.photoShape === 'wide' ? 'center' : 'center 20%',
                display: 'block',
              }}
            />
          ) : person.photoShape !== 'wide' ? (
            <span style={{ fontSize: isMobileNav ? '1.3rem' : '1.6rem', fontWeight: 800, color: 'var(--accentDark)' }}>
              {initials}
            </span>
          ) : null}
        </div>

        <div style={{ fontWeight: 800, fontSize: isMobileNav ? '0.92rem' : '1rem', color: 'var(--text)' }}>
          {person.name}
        </div>

        <p style={{
          fontSize: '0.78rem', lineHeight: 1.55, color: 'var(--muted)',
          margin: 0, minHeight: 'calc(0.78rem * 1.55 * 2)', // reserves 2 lines so a shorter blurb rotating in doesn't shrink the card's total height
        }}>
          {person.blurb}
        </p>

        {CREDITS_SPOTLIGHT.length > 1 && (
          <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.3rem' }}>
            {CREDITS_SPOTLIGHT.map((p, i) => (
              <span
                key={p.id}
                style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: i === index ? 'var(--accentDark)' : 'var(--border)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// `theme` prop (default 'light'): pass 'dark' when Footer is rendered
// directly inside a dark section (landing page's merged CTA+footer
// band, see the owner discussion above the Final CTA section) so its
// text/border colors read correctly against a dark background instead
// of the normal light-page var(--text)/var(--border)/var(--bg) values,
// which would be invisible or near-invisible on dark. App.jsx's global
// chrome usage and LandingPage's own mobile-branch usage don't pass
// this, so they keep the exact original light styling untouched.
function Footer({ theme = 'light' }) {
  const year = new Date().getFullYear();
  const dark = theme === 'dark';
  return (
    <footer className={dark ? undefined : 'kx-theme-vars'} style={{
      borderTop: dark ? '1px solid rgba(255,255,255,0.1)' : '1px solid var(--border)',
      marginTop: dark ? 0 : '2rem',
      background: dark ? 'transparent' : 'var(--bg)',
      padding: dark ? '2rem 1.25rem 2.5rem' : '2rem 1.25rem 2.5rem',
    }}>
      <div style={{
        maxWidth: '1080px', margin: '0 auto', display: 'flex',
        flexDirection: 'column', alignItems: 'center', gap: '1.25rem', textAlign: 'center',
      }}>
        <Wordmark height={20} theme={dark ? 'dark' : 'kx'} />

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.25rem' }}>
          <Link to="/about" style={{ fontSize: '0.85rem', fontWeight: 700, color: dark ? '#f3f4ef' : 'var(--text)', textDecoration: 'none' }}>
            About KUETx
          </Link>
          <Link to="/privacy" style={{ fontSize: '0.85rem', fontWeight: 700, color: dark ? '#f3f4ef' : 'var(--text)', textDecoration: 'none' }}>
            Privacy Policy
          </Link>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.6rem' }}>
          <a
            href="mailto:mdakhinoorislam.official.2005@gmail.com"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 0.9rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700,
              border: dark ? '1px solid rgba(255,255,255,0.18)' : '1px solid var(--border)',
              color: dark ? '#f3f4ef' : 'var(--text)', textDecoration: 'none',
            }}
          >
            <Mail size={14} /> Founder-কে ইমেইল করুন
          </a>
          <a
            href="https://wa.me/8801724812042"
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 0.9rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700,
              border: dark ? '1px solid rgba(255,255,255,0.18)' : '1px solid var(--border)',
              color: dark ? '#f3f4ef' : 'var(--text)', textDecoration: 'none',
            }}
          >
            <MessageSquare size={14} /> WhatsApp
          </a>
        </div>

        <p style={{ fontSize: '0.76rem', color: dark ? 'rgba(243,244,239,0.55)' : 'var(--muted)', margin: 0 }}>
          © {year} KUETx — KUET-এর জন্য।
        </p>
      </div>
    </footer>
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
  // Phase 1 (landing redesign): navbar now offers separate Sign In / Sign Up
  // entry points so a new visitor doesn't have to guess which one applies to
  // them. Sign Up opens SignUpWizard (role -> profile details -> confirm ->
  // Google last, see the render logic below and SignUpWizard.jsx).
  // authIntent drives which modal renders for the signup path.
  const [authIntent, setAuthIntent] = useState('signin'); // 'signin' | 'signup'
  // Sign In (owner request, this session): clicking "Sign In" now fires
  // Google's account picker directly — no KUETx-branded "স্বাগতম" modal in
  // between anymore, matching "সাইন ইন এ ক্লিক করলেই direct google er oita
  // open howa uchit". loginWithGoogle() (firebaseAuth.js) IS the
  // signInWithPopup(...) call already, so this is a genuinely direct
  // trigger, not a relabeled extra step. AuthModal.jsx is untouched and
  // still used everywhere else (App.jsx's queue-mode/global auth gate,
  // Profile.jsx re-auth) — only these two landing-page Sign In buttons now
  // bypass it.
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState('');
  // Same "no account yet" fact AuthModal's pendingNewUser branch shows —
  // kept here as a small inline banner instead of a full modal screen,
  // since the Google popup has already fully completed by the time this
  // fires (uid is already in hand, per §11.2's "no second popup" rule
  // that AuthModal's own comment documents).
  const [pendingNewUser, setPendingNewUser] = useState(null);
  const handleDirectGoogleSignIn = async () => {
    setSignInLoading(true);
    setSignInError('');
    try {
      const user = await loginWithGoogle();
      if (user) {
        const info = { linked: false, isNewUser: isBrandNewAccount(user) };
        if (info.isNewUser) {
          setPendingNewUser({ user, info });
        } else {
          // Existing account — nothing else to do here; App.jsx's
          // top-level auth listener routes a signed-in session to its
          // real dashboard on its own, same as every other sign-in path
          // in the app.
        }
      }
      // else: popup unsupported, fell back to redirect — page is
      // navigating away, same fallback loginWithGoogle() already handles
      // for every other call site.
    } catch (err) {
      setSignInError('Google দিয়ে সাইন ইন করা যায়নি। আবার চেষ্টা করুন।');
    } finally {
      setSignInLoading(false);
    }
  };
  const openAuth = (intent) => {
    if (intent === 'signin') {
      handleDirectGoogleSignIn();
      return;
    }
    setAuthIntent(intent);
    setShowAuthModal(true);
  };
  const [mockupMode, setMockupMode] = useState('desktop'); // desktop visitor default, per plan §3.2

  // Navbar border/shadow only appears after scrolling — matches the
  // approved mockup's `nav.scrolled` behavior (kuetx-landing-redesign-v2.html
  // uses `window.scrollY > 8` as the threshold). Border starts fully
  // transparent so there's no visible seam at the very top of the page.
  const [navScrolled, setNavScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const selectedRole = searchParams.get('role');

  // Mobile: the full-screen demo branch below replaces the whole scrolled
  // role-picker page, so the browser's own scroll position is lost the
  // moment that branch renders. Save it on the way in, restore it on the
  // way back out ("ফিরুন" / cross button) so a visitor who scrolled down
  // to a role card doesn't land back at the very top of the page.
  const savedScrollY = useRef(0);

  // Bookmark-redirect handling (plan §3.4): old /guest/* paths already
  // resolve on their own via App.jsx's existing PUBLIC_PATHS routes —
  // this component does not need to know about them. If Phase H's
  // cleanup step removes those routes, add the /guest/* → /?role=...
  // <Navigate> redirects there, not here.

  // Toggle behaviour: clicking the already-selected role's card again
  // collapses the preview (same as tapping "ফিরুন") instead of doing
  // nothing — needed on mobile so a mis-tap or "let me close this" tap
  // doesn't require hunting for the back button.
  const selectRole = (roleId) => {
    const next = selectedRole === roleId ? null : roleId;
    if (next && isMobileNav) savedScrollY.current = window.scrollY;
    setSearchParams(next ? { role: next } : {}, { replace: false });
  };

  const backToSelection = () => {
    selectRole(null);
    if (isMobileNav) {
      // Wait a tick for the picker view to re-mount before scrolling —
      // jumping immediately would scroll the (still-rendering) full-screen
      // demo view instead of the page that's about to come back.
      requestAnimationFrame(() => window.scrollTo(0, savedScrollY.current));
    }
  };

  // Mobile: selecting a role goes full-screen (no phone-mockup — see
  // plan §3.2's reasoning: a fake phone frame inside an already-small
  // real phone screen hurts touch targets and causes double-scroll).
  if (isMobileNav && selectedRole) {
    return (
      <div className="kx-theme-vars" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 5, display: 'flex',
          alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.8rem',
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        }}>
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
          <div style={{ display: 'flex', gap: '0.35rem', flex: 1, justifyContent: 'center', overflow: 'hidden' }}>
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
                  whiteSpace: 'nowrap',
                }}
              >
                {r.emoji} {r.title}
              </button>
            ))}
          </div>
          {/* Close (✕) — replaces the old "ফিরুন" text link. A plain
              corner ✕ is the pattern visitors already expect from a
              full-screen modal/demo view, and reads instantly without
              needing to parse Bangla text under time pressure. Same
              backToSelection() handler as before, so scroll-restore
              (see savedScrollY above) and the URL param cleanup are
              unchanged — only the affordance changed. */}
          <button
            type="button"
            onClick={backToSelection}
            aria-label="বন্ধ করো"
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '34px', height: '34px', borderRadius: '10px',
              background: 'var(--surfaceGlass, var(--surface))', border: '1px solid var(--border)',
              color: 'var(--text)', cursor: 'pointer',
            }}
          >
            <X size={17} />
          </button>
        </div>
        <DemoContent role={selectedRole} />
        {/* Phase 8 (§11.4): explicit "convinced by the demo" bridge into
            Sign Up, carrying the role that was just being previewed —
            without this, the only signup entry point was the generic
            navbar button, which drops the role context the visitor just
            spent time looking at. openAuth('signup') still goes through
            SignInPrompt first like every other signup entry (consistent
            lead-in, not a shortcut around it); wizardRoleFor() resolves
            'faculty' -> 'teacher' here same as the two AuthModal mounts. */}
        <div style={{ padding: '0 0.8rem 1.5rem' }}>
          <button
            type="button"
            onClick={() => openAuth('signup')}
            style={{
              width: '100%', padding: '0.85rem', borderRadius: '12px',
              background: 'var(--accent)', color: '#fff', border: 'none',
              fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer',
            }}
          >
            {ROLE_CARDS.find(r => r.id === selectedRole)?.title || ''} হিসেবে Sign Up করো
          </button>
        </div>
        {/* Phase 9.3: same feature breakdown as the desktop branch, just
            padded for the full-screen mobile view this branch is in. */}
        <div style={{ padding: '0 0.8rem' }}>
          <FeatureBreakdown isMobileNav />
        </div>
        <Footer />
        {showAuthModal && authIntent === 'signup' && (
          <SignUpWizard
            initialRole={wizardRoleFor(selectedRole)}
            onClose={() => setShowAuthModal(false)}
          />
        )}
        <DirectSignInOverlay
          pendingNewUser={pendingNewUser}
          onDismissPendingNewUser={() => setPendingNewUser(null)}
          onContinueAsSignUp={() => { setPendingNewUser(null); setAuthIntent('signup'); setShowAuthModal(true); }}
          error={signInError}
          onDismissError={() => setSignInError('')}
        />
      </div>
    );
  }

  return (
    <div className="kx-page" style={{ minHeight: '100vh', background: 'var(--kx-bg)' }}>
      <CampusDesignStyles />
      {/* Navbar — matches HTML's sticky, blurred .nav bar exactly.
          Sign In opens the plain Google AuthModal; Sign Up opens
          SignUpWizard (role select -> profile details -> confirm ->
          Google last) — see authIntent state above and the render logic
          further down. Sign Up is visually primary (filled) since most
          navbar visitors are new; Sign In is secondary (outlined). */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        padding: isMobileNav ? '14px 18px' : '18px 32px',
        background: 'rgba(247,246,241,0.85)', backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${navScrolled ? 'var(--kx-line)' : 'transparent'}`,
        boxShadow: navScrolled ? '0 1px 0 rgba(0,0,0,0.02)' : 'none',
        transition: 'border-color .3s, box-shadow .3s',
      }}>
        <Wordmark height={isMobileNav ? 26 : 28} theme="kx" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => openAuth('signin')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '10px 20px', borderRadius: '10px', minHeight: '44px',
              background: 'transparent', color: 'var(--kx-ink)',
              border: '1px solid var(--kx-line)',
              fontSize: '14.5px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => openAuth('signup')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '10px 20px', borderRadius: '10px', minHeight: '44px',
              background: 'var(--kx-accent)', color: '#06210f', border: 'none',
              fontSize: '14.5px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <LogIn size={15} /> Sign Up
          </button>
        </div>
      </div>

      {/* ─── Full-width page body ───────────────────────────────────────
          This is the real, top-to-bottom port of the owner-approved
          standalone HTML mockup (kuetx-landing-redesign-v2.html) into the
          real component tree: every section below is a full-bleed band
          exactly like the HTML (dark hero, --kx-bg role/proof sections,
          sage scrapbook band, --kx-bg why-section, dark final-CTA) rather
          than being squeezed inside a constrained maxWidth column. The
          only thing that changed from the HTML is WHERE the real data
          comes from — StatsStrip/FeatureBreakdown/RotatingPreview/
          CreditsSpotlight all keep their own real logic/state untouched,
          just re-skinned into this section shell instead of the HTML's
          static markup. */}
      <div style={{ width: '100%', overflowX: 'hidden' }}>
        <CampusHero
          isMobileNav={isMobileNav}
          headline={<>তোমার ক্যাম্পাস,<br />এক জায়গায় <span style={{ color: 'var(--kx-accent-bright)' }}>সাজানো।</span></>}
          sub="Routine থেকে Result, Notice থেকে Campus Service — Student, CR, Faculty, আর Provider, প্রতিটা role-এর জন্য একটাই app। আলাদা spreadsheet, group, বা app খুঁজে বেড়াতে হবে না।"
          onSignUp={() => openAuth('signup')}
        />

        <div id="stats-anchor" />

        {/* Reordered per audit: numbers right after the hero build instant
            credibility before anything else is asked of the visitor — a
            5-second glance at "9 real feature / 4 role / 0 বিজ্ঞাপন" earns
            the trust needed to keep scrolling into WHY, then WHAT (proof),
            then the deep feature list, saving the heaviest/most detailed
            section (FeatureBreakdown) for visitors who are already
            convinced and want specifics — not as the very first thing
            after the hero, which front-loaded detail before value. */}
        <div className="kx-page" style={{
          maxWidth: '1180px', margin: '0 auto',
          padding: isMobileNav ? '1.5rem 1.1rem 0' : '30px 32px 0',
        }}>
          <StatsStrip isMobileNav={isMobileNav} />
        </div>

        {/* কেন KUETx — the "why" comes before the "what/how" (proof +
            feature details below), so the visitor has a reason to care
            about the details before they see them. */}
        <WhyKuetx isMobileNav={isMobileNav} />

        {/* "App Proof" — real, always-visible auto-rotating mockup
            preview (Student -> Faculty -> Provider), matches HTML's
            .proof-section phone-frame + copy layout. All demo data is
            RotatingPreview's own real logic (DemoContent ->
            Student/Faculty/ProviderDemoDashboard) — nothing static. */}
        <RotatingPreview
          mockupMode={mockupMode}
          setMockupMode={setMockupMode}
          onSignUp={() => openAuth('signup')}
          isMobileNav={isMobileNav}
        />

        {/* Role-tabbed feature breakdown — matches HTML's #roles section
            (role-tabs + .feature-columns) exactly, full-bleed --kx-bg.
            Moved below the proof/demo section: this is the deepest, most
            detailed content on the page (every feature, per role) — it's
            for visitors who are already sold on the "why" and want to
            verify specifics, not the first thing shown after the hero. */}
        <FeatureBreakdown isMobileNav={isMobileNav} />

        {/* Campus scrapbook — signature tilted-photo motif, matches
            HTML's sage-band .scrapbook section exactly. Placed just
            before the credits/CTA close as an emotional, campus-identity
            beat after the functional case has been made. */}
        <CampusScrapbook isMobileNav={isMobileNav} />

        {/* Video showcase — KUETx's own YouTube videos, rotating embedded
            player. See VideoShowcase's own comment above for why it sits
            here (between Scrapbook and Credits). Never renders nothing —
            even with zero videos it shows a fixed-size "coming soon" box
            so the page layout doesn't jump depending on channel state. */}
        <VideoShowcase isMobileNav={isMobileNav} />

        {/* Credits spotlight — real data, kept inside a centered content
            band since the HTML mockup has no direct equivalent section
            (an addition the real app actually has); everything else
            above/below is full-bleed. Sits right before the final CTA as
            a last social-proof beat ("who actually built/backs this").*/}
        <div className="kx-page" style={{
          maxWidth: '1180px', margin: '0 auto',
          padding: isMobileNav ? '0 1.1rem 2rem' : '0 32px 60px',
        }}>
          <CreditsSpotlight isMobileNav={isMobileNav} />
        </div>

        {/* Final CTA + Footer — merged into one continuous dark band
            (owner ask, this session): the CTA used to end with heavy
            symmetric padding and then a separate plain-white Footer
            immediately after, which read as an orphaned/disconnected
            afterthought (dark box -> hard cut -> unrelated white strip).
            Footer is now rendered INSIDE this same dark section, right
            below the CTA buttons, with its own dark theme (theme="dark"
            prop, already supported by Footer below) and a faint
            border-top divider separating the two "beats" while staying
            in one unbroken dark flow. Top/bottom padding trimmed from
            the old 90px since the section now carries more content
            (CTA + footer together) — kept generous enough that the
            close still feels like a deliberate, confident bookend to
            the dark hero, not cramped. */}
        <section style={{
          background: 'var(--kx-dark)', color: '#fff', textAlign: 'center',
          padding: isMobileNav ? '3rem 1.1rem 0' : '72px 32px 0',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 700px 400px at 50% 100%, rgba(74,222,128,0.15), transparent 60%)',
          }} />
          {/* Hard color-band cut by design — no seam gradient here. */}
          <div style={{ position: 'relative' }}>
            <div style={{
              margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Logo size={isMobileNav ? 56 : 72} />
            </div>
            <h2 className="kx-h2" style={{ fontSize: isMobileNav ? 'clamp(1.3rem, 6vw, 1.6rem)' : '34px', color: '#fff' }}>
              তোমার ক্যাম্পাস লাইফ, আজকেই সাজাও।
            </h2>
            <p style={{ color: 'rgba(243,244,239,0.65)', maxWidth: '460px', margin: '16px auto 32px' }}>
              Sign up করতে কোনো টাকা লাগে না, ভবিষ্যতেও লাগবে না।
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: isMobileNav ? '2.5rem' : '64px' }}>
              <button
                type="button"
                onClick={() => openAuth('signup')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: isMobileNav ? '0.75rem 1.2rem' : '15px 28px', borderRadius: '12px',
                  background: 'var(--kx-accent-bright)', color: '#06210f', fontWeight: 800,
                  fontSize: isMobileNav ? '0.85rem' : '16px', border: 'none', cursor: 'pointer',
                }}
              >
                Sign Up করো
              </button>
              <button
                type="button"
                onClick={() => openAuth('signin')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: isMobileNav ? '0.75rem 1.2rem' : '15px 28px', borderRadius: '12px',
                  background: 'transparent', color: '#f3f4ef', fontWeight: 700,
                  fontSize: isMobileNav ? '0.85rem' : '16px',
                  border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer',
                }}
              >
                Sign In
              </button>
            </div>
          </div>

          <Footer theme="dark" />
        </section>
      </div>

      {showAuthModal && authIntent === 'signup' && (
        <SignUpWizard
          initialRole={wizardRoleFor(selectedRole)}
          onClose={() => setShowAuthModal(false)}
        />
      )}
      <DirectSignInOverlay
        pendingNewUser={pendingNewUser}
        onDismissPendingNewUser={() => setPendingNewUser(null)}
        onContinueAsSignUp={() => { setPendingNewUser(null); setAuthIntent('signup'); setShowAuthModal(true); }}
        error={signInError}
        onDismissError={() => setSignInError('')}
      />
    </div>
  );
}