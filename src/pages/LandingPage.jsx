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
  Layers, ShieldCheck, Users, Sparkles, Mail, MessageSquare, X,
  Flame, TrendingUp, Star, Zap, MapPin, ArrowDown,
} from 'lucide-react';
import usePageMeta from '../hooks/usePageMeta';
import { useIsMobileNav } from '../components/BottomNav';
import AuthModal from '../components/AuthModal';
import SignInPrompt from '../components/SignInPrompt';
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
  aerial: { src: '/landing/aerial.jpg', label: 'Campus, Aerial View', coord: 'সবুজ, ওয়াকওয়ে' },
  statue: { src: '/landing/statue-sunset.jpg', label: 'Liberation War Memorial', coord: 'সূর্যাস্তে, মূল ভবনের সামনে' },
  academic: { src: '/landing/academic.jpg', label: 'Academic Building', coord: 'ক্রিম কলাম, আর্চড জানালা' },
  sign: { src: '/landing/sign-dusk.jpg', label: 'KUET Sign, Dusk', coord: 'সন্ধ্যার ক্যাম্পাস' },
  auditorium: { src: '/landing/auditorium.jpg', label: 'Auditorium', coord: 'যেখানে ফেস্ট হয়' },
  mainBuilding: { src: '/landing/main-building.jpg', label: 'Main Building', coord: 'কলামযুক্ত, বহুতল' },
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
        background: var(--kx-bg);
        color: var(--kx-ink);
      }
      .kx-wrap { max-width: 1180px; margin: 0 auto; padding: 0 32px; }

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

function CampusHero({ isMobileNav, headline, sub, onSignUp }) {
  // Hero is above the fold on load, so it fades/rises in immediately on
  // mount rather than waiting for a scroll trigger.
  const [heroVisible, setHeroVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setHeroVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);
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
        padding: isMobileNav ? '2.25rem 1.1rem 0' : '64px 32px 0',
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
          gridTemplateColumns: isMobileNav ? '1fr' : '1.05fr 0.95fr',
          gap: isMobileNav ? '1.75rem' : '56px',
          alignItems: 'center',
          paddingBottom: isMobileNav ? '2rem' : '40px',
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
            fontSize: isMobileNav ? '0.9rem' : '17px', lineHeight: 1.65,
            color: 'rgba(243,244,239,0.72)', maxWidth: '480px', marginBottom: isMobileNav ? '1.25rem' : '34px',
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

          {/* Hero stats row — matches HTML's .hero-stats exactly (mono
              numbers, top border divider). */}
          <div style={{
            display: 'flex', gap: isMobileNav ? '1.4rem' : '36px', flexWrap: 'wrap',
            paddingTop: '28px', borderTop: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div>
              <div className="kx-mono-num" style={{ fontSize: isMobileNav ? '20px' : '26px', color: 'var(--kx-accent-bright)' }}>{FEATURE_COUNT_DISPLAY}</div>
              <div style={{ fontSize: '12.5px', color: 'rgba(243,244,239,0.55)', marginTop: '2px' }}>real feature</div>
            </div>
            <div>
              <div className="kx-mono-num" style={{ fontSize: isMobileNav ? '20px' : '26px', color: 'var(--kx-accent-bright)' }}>4</div>
              <div style={{ fontSize: '12.5px', color: 'rgba(243,244,239,0.55)', marginTop: '2px' }}>role, একই app</div>
            </div>
            <div>
              <div className="kx-mono-num" style={{ fontSize: isMobileNav ? '20px' : '26px', color: 'var(--kx-accent-bright)' }}>0</div>
              <div style={{ fontSize: '12.5px', color: 'rgba(243,244,239,0.55)', marginTop: '2px' }}>বিজ্ঞাপন / ডেটা বিক্রি</div>
            </div>
          </div>
        </div>

        {/* Tilted photo cluster — signature motif, repeated in
            CampusScrapbook. Two photos + a small live-location badge. */}
        <div style={{
          position: 'relative',
          height: isMobileNav ? '230px' : '420px',
          order: isMobileNav ? 1 : 2,
        }}>
          <div style={{
            position: 'absolute', top: 0, left: isMobileNav ? '8px' : '16px',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(12,39,24,0.85)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px',
            padding: '10px 14px', fontSize: '12px', fontFamily: 'var(--kx-mono)', fontWeight: 700,
            color: '#a5d6a7', zIndex: 3,
          }}>
            <MapPin size={11} /> KUET, Khulna
          </div>

          <div style={{
            position: 'absolute', top: isMobileNav ? '28px' : '26px', right: isMobileNav ? '2px' : '6px',
            width: isMobileNav ? '58%' : '300px',
            transform: isMobileNav ? 'rotate(2.5deg)' : 'rotate(4deg)',
            borderRadius: '14px', overflow: 'hidden', border: '6px solid #fff',
            boxShadow: '0 30px 60px rgba(0,0,0,0.45), 0 0 0 6px rgba(255,255,255,0.06)', background: '#fff',
          }}>
            <img src={CAMPUS_PHOTOS.gate.src} alt={CAMPUS_PHOTOS.gate.label} style={{ width: '100%', height: isMobileNav ? '110px' : '220px', objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: '12px 14px 14px' }}>
              <div style={{ fontWeight: 700, fontSize: isMobileNav ? '0.68rem' : '13.5px', color: '#16241a' }}>{CAMPUS_PHOTOS.gate.label}</div>
              <div style={{ fontFamily: 'var(--kx-mono)', fontSize: '11px', color: '#8a9188', marginTop: '2px' }}>{CAMPUS_PHOTOS.gate.coord}</div>
            </div>
          </div>

          <div style={{
            position: 'absolute', bottom: isMobileNav ? '60px' : '92px', left: 0,
            width: isMobileNav ? '48%' : '175px',
            transform: isMobileNav ? 'rotate(-5deg)' : 'rotate(-7deg)',
            borderRadius: '12px', overflow: 'hidden', border: '6px solid #fff',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)', zIndex: 2,
          }}>
            <img src={CAMPUS_PHOTOS.aerial.src} alt={CAMPUS_PHOTOS.aerial.label} style={{ width: '100%', height: isMobileNav ? '78px' : '120px', objectFit: 'cover', display: 'block' }} />
          </div>

          <div style={{
            position: 'absolute', bottom: isMobileNav ? '2px' : '6px', left: isMobileNav ? '76px' : '108px',
            width: isMobileNav ? '46%' : '168px',
            transform: isMobileNav ? 'rotate(4deg)' : 'rotate(5deg)',
            borderRadius: '12px', overflow: 'hidden', border: '6px solid #fff',
            boxShadow: '0 22px 44px rgba(0,0,0,0.4)', zIndex: 1,
          }}>
            <img src={CAMPUS_PHOTOS.statue.src} alt={CAMPUS_PHOTOS.statue.label} style={{ width: '100%', height: isMobileNav ? '80px' : '112px', objectFit: 'cover', display: 'block' }} />
          </div>

          {/* Mascot badge — floating turtle accent per HTML mockup,
              anchored to the gate photo card's bottom-right corner. */}
          <div
            className="kx-mascot-badge"
            style={{
              position: 'absolute',
              bottom: isMobileNav ? '-6px' : '-6px',
              right: isMobileNav ? '-4px' : '-10px',
              width: isMobileNav ? '68px' : '92px',
              height: isMobileNav ? '68px' : '92px',
              zIndex: 4,
              filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.5))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%',
              background: 'var(--kx-accent-bright)',
              border: '3px solid #06210f',
              boxShadow: '0 10px 22px rgba(0,0,0,0.35)',
            }}
          >
            <Logo size={isMobileNav ? 30 : 42} />
          </div>
        </div>
      </div>
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
        background: 'var(--kx-sage)',
        padding: isMobileNav ? '2.5rem 1.1rem' : '90px 32px',
      }}
    >
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
              <div style={{ fontFamily: 'var(--kx-mono)', fontSize: '10px', color: '#8a9188', textAlign: 'center', marginTop: '2px' }}>{photo.coord}</div>
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
const SLIDE_TRANSITION_MS = 550;

function StatCardTile({ stat, isMobileNav }) {
  const Icon = STAT_ICONS[stat.id] || Sparkles;
  return (
    <div
      style={{
        width: '100%', flexShrink: 0,
        padding: isMobileNav ? '0.95rem 1rem' : '1.5rem 1.75rem',
        boxSizing: 'border-box',
      }}
    >
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: isMobileNav ? '30px' : '42px', height: isMobileNav ? '30px' : '42px',
        borderRadius: isMobileNav ? '9px' : '12px',
        background: 'rgba(var(--accentRGB),0.10)', marginBottom: isMobileNav ? '0.55rem' : '0.8rem',
      }}>
        <Icon size={isMobileNav ? 16 : 21} color="var(--accent)" strokeWidth={2.3} />
      </div>
      <div style={{
        fontFamily: 'var(--kx-mono, inherit)',
        fontSize: isMobileNav ? '1.15rem' : '1.6rem',
        fontWeight: 700, color: 'var(--accent)',
        letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.15, marginBottom: '0.35rem',
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

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (paused || prefersReducedMotion || stats.length <= 1) return undefined;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % stats.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, prefersReducedMotion, stats.length]);

  // Guard against index momentarily pointing past the array right after
  // the QB cards get appended/removed (data arrives async after first
  // render) — clamp instead of letting translateX go out of bounds.
  const safeIndex = Math.min(index, stats.length - 1);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      style={{
        maxWidth: isMobileNav ? '360px' : '640px',
        margin: isMobileNav ? '0 auto 1.5rem' : '0 auto 2.5rem',
        padding: isMobileNav ? '0.4rem 0' : '0.6rem 0',
        borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: `${stats.length * 100}%`,
          transform: `translateX(-${(100 / stats.length) * safeIndex}%)`,
          transition: prefersReducedMotion ? 'none' : `transform ${SLIDE_TRANSITION_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`,
        }}
      >
        {stats.map((stat) => (
          <div key={stat.id} style={{ width: `${100 / stats.length}%`, flexShrink: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <StatCardTile stat={stat} isMobileNav={isMobileNav} />
          </div>
        ))}
      </div>
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
      style={{ width: '100%', padding: isMobileNav ? '2.25rem 1.1rem' : '90px 32px' }}
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
};

const FEATURE_TABS = [
  { id: 'student', title: 'Student', icon: GraduationCap, features: STUDENT_FEATURES, labels: STUDENT_CATEGORY_LABELS },
  { id: 'faculty', title: 'Faculty', icon: Presentation, features: FACULTY_FEATURES, labels: FACULTY_CATEGORY_LABELS },
  { id: 'provider', title: 'Provider', icon: Store, features: PROVIDER_FEATURES, labels: PROVIDER_CATEGORY_LABELS },
];

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
      padding: isMobileNav ? '0.4rem 0.4rem' : '0.5rem 0',
      borderBottom: '1px dashed var(--border)',
      borderRadius: tag ? '6px' : 0,
      minHeight: isMobileNav ? '2.4rem' : undefined,
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
        {tag ? (
          <TagIcon size={13} style={{ color, flexShrink: 0, marginTop: '0.15rem', filter: `drop-shadow(0 0 3px ${bg})` }} />
        ) : (
          <CheckCircle2 size={13} style={{ color: 'var(--muted)', flexShrink: 0, marginTop: '0.15rem' }} />
        )}
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
        display: isMobileNav ? 'grid' : 'block',
        gridTemplateColumns: isMobileNav ? 'repeat(2, minmax(0, 1fr))' : undefined,
        gridAutoRows: isMobileNav ? '1fr' : undefined,
        gap: isMobileNav ? '0.15rem 0.6rem' : 0,
        alignItems: isMobileNav ? 'stretch' : undefined,
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
    <div style={{
      marginTop: '1.5rem', padding: '1.1rem 1.25rem', borderRadius: '16px',
      border: '1px dashed var(--accent)',
      background: 'linear-gradient(180deg, rgba(var(--accentRGB),0.06), transparent)',
    }}>
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
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.4rem 1rem',
      }}>
        {CR_FEATURES.map((name) => {
          const tag = HIGHLIGHTED_FEATURES[name];
          const tone = tag ? (TAG_TONES[tag.tone] || TAG_TONES.hot) : null;
          const TagIcon = tone?.Icon || CheckCircle2;
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
              <TagIcon size={13} style={{ color: tag ? tone.color : 'var(--accent)', flexShrink: 0 }} />
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
    // .feature-columns exactly — role-tabs row, then 3 real fcol cards.
    <section id="roles" className="kx-page" style={{ width: '100%', padding: isMobileNav ? '2.25rem 1.1rem 0' : '80px 32px 0' }}>
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

      {/* Three-column fcol grid on desktop, stacked on mobile — matches
          HTML's .feature-columns exactly (real bordered cards, mono
          uppercase category header with accent left-border). */}
      <div style={{
        display: isMobileNav ? 'block' : 'grid',
        gridTemplateColumns: isMobileNav ? undefined : 'repeat(3, 1fr)',
        gap: isMobileNav ? undefined : '22px',
        maxWidth: '1180px', margin: '0 auto', paddingBottom: isMobileNav ? '2rem' : '90px',
      }}>
        {categories.map(([key, items]) => (
          <div key={key} style={{ marginBottom: isMobileNav ? '0.85rem' : 0 }}>
            <FeatureCategoryBlock label={tab.labels[key] || key} items={items} isMobileNav={isMobileNav} />
          </div>
        ))}
      </div>

      {activeTab === 'student' && <CRFeatureBlock />}
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
      width: isPhone ? '272px' : '100%',
      maxWidth: isPhone ? '272px' : '100%',
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
          minHeight: isPhone ? '480px' : '360px',
          maxHeight: isPhone ? '480px' : '420px',
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
const SETTLE_MS = 2800; // brief pause before inner auto-scroll starts
const SCROLL_MS = 6500; // duration of the inner auto-scroll sweep
const HOLD_MS = 2200; // pause at bottom before rotating to next role
const MANUAL_PAUSE_MS = 12000; // owner said 10-15s; 12s split the difference

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
    <section className="kx-page" style={{ width: '100%', padding: isMobileNav ? '1rem 1.1rem 2.5rem' : '10px 32px 90px' }}>
      <style>{`.kuetx-mockup-scrollhost::-webkit-scrollbar { display: none; }`}</style>
      <div style={{
        display: isMobileNav ? 'block' : 'grid',
        gridTemplateColumns: isMobileNav ? undefined : '0.85fr 1.15fr',
        gap: isMobileNav ? undefined : '56px',
        alignItems: 'center',
        maxWidth: '1180px', margin: '0 auto',
      }}>
        <div>
          {roleTabsRow}
          <MockupFrame mode={effectiveMode} scrollHostRef={scrollHostRef}>
            <DemoContent role={activeRole} />
          </MockupFrame>
          {signUpButton}
        </div>

        <div style={{ marginTop: isMobileNav ? '2rem' : 0, textAlign: isMobileNav ? 'center' : 'left' }}>
          <div className="kx-eyebrow" style={{ marginBottom: '0.9rem' }}>রিয়েল অ্যাপ, রিয়েল ফিচার</div>
          <h2 className="kx-h2" style={{ fontSize: isMobileNav ? 'clamp(1.25rem, 6vw, 1.55rem)' : '30px', marginBottom: '16px' }}>
            মকআপ না — এটা তোমার নিজের অ্যাপ থেকেই নেওয়া লাইভ প্রিভিউ।
          </h2>
          <p style={{
            fontSize: '16px', color: 'var(--kx-ink-soft)', lineHeight: 1.65, marginBottom: '24px',
            maxWidth: '440px', marginLeft: isMobileNav ? 'auto' : 0, marginRight: isMobileNav ? 'auto' : 0,
          }}>
            {activeRoleMeta?.title || ''} হিসেবে লগইন করলে ঠিক এই ড্যাশবোর্ডটাই দেখবে — Attendance, Marks,
            Notice, Question Bank থেকে ক্যাম্পাস সার্ভিস বুকিং পর্যন্ত, সবকিছু একই লগইনে।
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: isMobileNav ? 'center' : 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14.5px', fontWeight: 600 }}>
              <span style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'var(--kx-sage)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>📱</span>
              Role অনুযায়ী নিজের ড্যাশবোর্ড
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14.5px', fontWeight: 600 }}>
              <span style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'var(--kx-sage)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>⚡</span>
              রিয়েল-টাইম Attendance &amp; Notice
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14.5px', fontWeight: 600 }}>
              <span style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'var(--kx-sage)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>🗂️</span>
              বছরভিত্তিক Question &amp; Solution Bank
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
  const isWide = person.photoShape === 'wide';
  const initials = person.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      ref={ref}
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
          width: isMobileNav ? '260px' : '340px',
          height: isMobileNav ? '260px' : '340px',
          background: 'radial-gradient(ellipse 50% 50% at 50% 35%, rgba(var(--accentRGB),0.16), transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: isWide ? '480px' : '340px', margin: '0 auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', gap: '0.6rem',
        transition: 'max-width 0.3s ease',
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

        {/* Photo/initials — same rotating spot, only the source (and,
            for a 'wide' group photo, the shape) swaps as `index`
            changes, so this reads as one place cycling through entries
            rather than a list. Falls back to an initials circle (same
            visual language as Footer's other UI, not a broken-image
            icon) if a person's photo hasn't been supplied yet or fails
            to load — group photos don't get an initials fallback since
            "initials" doesn't make sense for a group entry. */}
        {isWide ? (
          <div style={{
            width: '100%',
            maxWidth: isMobileNav ? '280px' : '380px',
            borderRadius: '14px',
            overflow: 'hidden',
            border: '3px solid var(--accentLight)',
            boxShadow: '0 10px 24px rgba(0,0,0,0.14)',
            background: 'var(--accentSoft)',
          }}>
            <img
              src={person.photo}
              alt={person.name}
              loading="lazy"
              style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
            />
          </div>
        ) : (
          <div style={{
            width: isMobileNav ? '84px' : '104px',
            height: isMobileNav ? '84px' : '104px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '3px solid var(--accentLight)',
            boxShadow: '0 10px 24px rgba(0,0,0,0.14)',
            background: 'var(--accentSoft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'opacity 0.4s ease',
          }}>
            {imgOk && person.photo ? (
              <img
                src={person.photo}
                alt={person.name}
                loading="lazy"
                onError={() => setImgOk(false)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <span style={{ fontSize: isMobileNav ? '1.3rem' : '1.6rem', fontWeight: 800, color: 'var(--accentDark)' }}>
                {initials}
              </span>
            )}
          </div>
        )}

        <div style={{ fontWeight: 800, fontSize: isMobileNav ? '0.92rem' : '1rem', color: 'var(--text)' }}>
          {person.name}
        </div>

        <p style={{
          fontSize: '0.78rem', lineHeight: 1.55, color: 'var(--muted)',
          margin: 0,
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

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer style={{
      borderTop: '1px solid var(--border)', marginTop: '2rem',
      padding: '2rem 1.25rem 2.5rem',
    }}>
      <div style={{
        maxWidth: '1080px', margin: '0 auto', display: 'flex',
        flexDirection: 'column', alignItems: 'center', gap: '1.25rem', textAlign: 'center',
      }}>
        <Wordmark height={20} />

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.25rem' }}>
          <Link to="/about" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>
            About KUETx
          </Link>
          <Link to="/privacy" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>
            Privacy Policy
          </Link>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.6rem' }}>
          <a
            href="mailto:mdakhinoorislam.official.2005@gmail.com"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 0.9rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700,
              border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none',
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
              border: '1px solid var(--border)', color: 'var(--text)', textDecoration: 'none',
            }}
          >
            <MessageSquare size={14} /> WhatsApp
          </a>
        </div>

        <p style={{ fontSize: '0.76rem', color: 'var(--muted)', margin: 0 }}>
          © {year} KUETx — KUET-এর ছাত্রছাত্রীদের বানানো, KUET-এর জন্য।
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
  // Phase H: the "Sign In" navbar button (and, in future, any
  // write-trigger touched inside a demo view) opens SignInPrompt FIRST —
  // a short "why sign in" step — rather than AuthModal's full form
  // appearing with no lead-in. Confirming inside SignInPrompt swaps to
  // AuthModal for Sign In intent, or SignUpWizard for Sign Up intent
  // (see the render logic below); "পরে করবো" just closes it.
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  // Phase 1 (landing redesign): navbar now offers separate Sign In / Sign Up
  // entry points so a new visitor doesn't have to guess which one applies to
  // them. Sign In still opens the single Google-only AuthModal (no Login/
  // Register branch there). Sign Up is different as of Phase 4/5/6: it opens
  // SignUpWizard instead (role -> profile details -> confirm -> Google last,
  // see the render logic below and SignUpWizard.jsx) — NOT the same AuthModal
  // as Sign In. authIntent below drives both which modal renders AND the
  // SignInPrompt copy/button label shown first.
  const [authIntent, setAuthIntent] = useState('signin'); // 'signin' | 'signup'
  // Sign Up skips SignInPrompt entirely — it's a redundant extra click
  // before SignUpWizard's own role-select step. Only Sign In goes
  // through SignInPrompt first.
  const openAuth = (intent) => {
    setAuthIntent(intent);
    if (intent === 'signup') {
      setShowAuthModal(true);
    } else {
      setShowSignInPrompt(true);
    }
  };
  const [mockupMode, setMockupMode] = useState('desktop'); // desktop visitor default, per plan §3.2

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
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
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
        {showSignInPrompt && (
          <SignInPrompt
            intent={authIntent}
            onSignIn={() => { setShowSignInPrompt(false); setShowAuthModal(true); }}
            onClose={() => setShowSignInPrompt(false)}
          />
        )}
        {showAuthModal && authIntent === 'signup' && (
          <SignUpWizard
            initialRole={wizardRoleFor(selectedRole)}
            onClose={() => setShowAuthModal(false)}
          />
        )}
        {showAuthModal && authIntent !== 'signup' && (
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
        borderBottom: '1px solid var(--kx-line)',
      }}>
        <Wordmark height={isMobileNav ? 26 : 28} />
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

        {/* Role-tabbed feature breakdown — matches HTML's #roles section
            (role-tabs + .feature-columns) exactly, full-bleed --kx-bg. */}
        <FeatureBreakdown isMobileNav={isMobileNav} />

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

        {/* Campus scrapbook — signature tilted-photo motif, matches
            HTML's sage-band .scrapbook section exactly. */}
        <CampusScrapbook isMobileNav={isMobileNav} />

        {/* কেন KUETx — matches HTML's .why-section exactly. */}
        <WhyKuetx isMobileNav={isMobileNav} />

        {/* Live stats + credits spotlight — real data, kept inside a
            centered content band since the HTML mockup has no direct
            equivalent section for these (they're additions the real app
            actually has); everything else above/below is full-bleed. */}
        <div className="kx-page" style={{
          maxWidth: '1180px', margin: '0 auto',
          padding: isMobileNav ? '0 1.1rem 2rem' : '0 32px 60px',
        }}>
          <StatsStrip isMobileNav={isMobileNav} />
          <CreditsSpotlight isMobileNav={isMobileNav} />
        </div>

        {/* Final CTA — matches HTML's dark .final-cta band exactly. */}
        <section style={{
          background: 'var(--kx-dark)', color: '#fff', textAlign: 'center',
          padding: isMobileNav ? '3rem 1.1rem' : '90px 32px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 700px 400px at 50% 100%, rgba(74,222,128,0.15), transparent 60%)',
          }} />
          <div style={{ position: 'relative' }}>
            <div style={{
              width: isMobileNav ? '52px' : '64px', height: isMobileNav ? '52px' : '64px',
              margin: '0 auto 20px', borderRadius: '50%',
              background: 'var(--kx-accent-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Logo size={isMobileNav ? 30 : 38} />
            </div>
            <h2 className="kx-h2" style={{ fontSize: isMobileNav ? 'clamp(1.3rem, 6vw, 1.6rem)' : '34px', color: '#fff' }}>
              তোমার ক্যাম্পাস লাইফ, আজকেই সাজাও।
            </h2>
            <p style={{ color: 'rgba(243,244,239,0.65)', maxWidth: '460px', margin: '16px auto 32px' }}>
              Sign up করতে কোনো টাকা লাগে না, ভবিষ্যতেও লাগবে না।
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
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
        </section>
      </div>

      <Footer />

      {showSignInPrompt && (
        <SignInPrompt
          intent={authIntent}
          onSignIn={() => { setShowSignInPrompt(false); setShowAuthModal(true); }}
          onClose={() => setShowSignInPrompt(false)}
        />
      )}
      {showAuthModal && authIntent === 'signup' && (
        <SignUpWizard
          initialRole={wizardRoleFor(selectedRole)}
          onClose={() => setShowAuthModal(false)}
        />
      )}
      {showAuthModal && authIntent !== 'signup' && (
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
