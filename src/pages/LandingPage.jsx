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
import { Wordmark } from '../components/Logo';
import {
  LogIn, GraduationCap, Presentation, Store, CheckCircle2,
  Monitor, Smartphone, Crown,
  Layers, ShieldCheck, Users, Sparkles, Mail, MessageSquare, X,
  Flame, TrendingUp, Star, Zap,
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
  { id: 'features', display: FEATURE_COUNT_DISPLAY, label: 'রিয়েল ফিচার' },
  { id: 'roles', display: '৩', label: 'Role — Student, Faculty, Provider' },
  { id: 'free', display: '১০০%', label: 'ফ্রি, চিরকাল' },
  {
    id: 'publications',
    display: '৫,৮৫৬',
    label: '৪৩৬ জন শিক্ষকের ৫,৮৫৬টি রিসার্চ পাবলিকেশন, ২৪টি ডিপার্টমেন্ট জুড়ে — যে কেউ নিজের বা অন্য কারো পাবলিকেশন যোগ করতে পারে',
  },
  {
    id: 'pick-and-drop',
    display: 'কাজ করিয়ে নিন',
    label: 'Student বা Faculty যে কেউ কাজ করিয়ে নেওয়ার জন্য পোস্ট করতে পারে (কিছু কিনে আনা, ডেলিভারি করা, ছোটখাটো কাজ), সব student-এর কাছে যায় — যেকোনো student accept করতে পারে, নিজেই দাম প্রস্তাব করা যায় বা ফ্রিও রাখা যায় — ফাঁকা সময়ে টাকা আয়েরও একটা উপায়',
  },
  {
    id: 'solution-bank',
    display: 'ধাপে ধাপে',
    label: 'এখন পর্যন্ত ESE ডিপার্টমেন্টের Y2T1-এ Computer Programming ও Fluid Mechanics-এর ধাপে ধাপে সমাধান আছে — ধীরে ধীরে আরও কোর্স ও ডিপার্টমেন্ট যোগ হচ্ছে',
  },
  {
    id: 'attendance',
    display: 'ট্র্যাকিং',
    label: 'Student নিজে নিজের personal attendance ট্র্যাক করতে পারে — আর Faculty অফিসিয়াল ক্লাস attendance নেয় (মূলত Present/Absent, প্রয়োজনে Late/Excused-ও সেট করা যায়), যেটা মার্কসের সাথে যুক্ত হয়ে যায়',
  },
  {
    id: 'cr-toolset',
    display: '৫+',
    label: 'CR হলে Class Setup, Routine, Class Planner, CT & Quiz Planner, Class Announcements-সহ ৫+ এক্সট্রা টুল পাওয়া যায়',
  },
  {
    id: 'my-classes-faculty',
    display: '৭',
    label: 'একটা ক্লাসে ৭টা রিয়েল টুল — Syllabus, Question Bank, Students & CR, Marks, Attendance, Schedule, Notices',
  },
  {
    id: 'online-mart',
    display: 'উদ্যোক্তা',
    label: 'Student চাইলে আলাদা একটা Provider account খুলে নিজের Online Mart চালু করতে পারে — student account থেকে সরাসরি না, শর্ত মেনে আলাদাভাবে provider হিসেবে যোগ দিতে হয়',
  },
];

const ROTATE_MS = 4500;

// One large stat + label, fading/sliding in on change. Deliberately
// re-fires the same useCountUp-style ease-out on every rotation (not
// just once on first scroll-into-view like the old StatCard) — a card
// that visibly counts up each time it appears reads as "alive" rather
// than a plain text swap, and this is a single number so the animation
// is cheap.
function RotatingStatCard({ stat, isMobileNav }) {
  const [displayValue, setDisplayValue] = useState(stat.display);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setAnimating(true);
    const t = setTimeout(() => setAnimating(false), 350);
    setDisplayValue(stat.display);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stat.id, stat.display]);

  return (
    <div
      key={stat.id}
      style={{
        textAlign: 'center', width: '100%',
        opacity: animating ? 0.35 : 1,
        transform: animating ? 'translateY(4px)' : 'translateY(0)',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
      }}
    >
      <div style={{
        fontSize: isMobileNav ? 'clamp(1.3rem, 7vw, 1.7rem)' : 'clamp(1.9rem, 4.5vw, 2.5rem)',
        fontWeight: 800, color: 'var(--accent)',
        letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.15,
      }}>
        {displayValue}
      </div>
      <div style={{
        fontSize: isMobileNav ? '0.72rem' : '0.85rem', color: 'var(--muted)',
        marginTop: '0.2rem', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto',
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
    }, ROTATE_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, prefersReducedMotion, stats.length]);

  // Guard against index momentarily pointing past the array right after
  // the QB cards get appended/removed (data arrives async after first
  // render).
  const safeIndex = index % stats.length;
  const current = stats[safeIndex];

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      style={{
        maxWidth: '520px', margin: isMobileNav ? '0 auto 1.25rem' : '0 auto 2.5rem',
        padding: isMobileNav ? '0.7rem 0.5rem' : '1.15rem 0.5rem',
        borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
      }}
    >
      <RotatingStatCard stat={current} isMobileNav={isMobileNav} />

      {stats.length > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '0.35rem',
          marginTop: isMobileNav ? '0.5rem' : '0.75rem',
        }}>
          {stats.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={s.label}
              onClick={() => setIndex(i)}
              style={{
                width: i === safeIndex ? '1.1rem' : '0.4rem', height: '0.4rem',
                borderRadius: '999px', border: 'none', padding: 0,
                background: i === safeIndex ? 'var(--accent)' : 'var(--border)',
                cursor: 'pointer', transition: 'width 0.25s ease, background 0.25s ease',
              }}
            />
          ))}
        </div>
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
      style={{
        padding: isMobileNav ? '0.85rem' : '1.25rem', borderRadius: isMobileNav ? '13px' : '16px',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(14px)',
        transition: `opacity 0.5s ease ${index * 90}ms, transform 0.5s ease ${index * 90}ms`,
      }}
    >
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: isMobileNav ? '30px' : '40px', height: isMobileNav ? '30px' : '40px',
        borderRadius: isMobileNav ? '9px' : '11px',
        background: 'rgba(var(--accentRGB),0.10)', marginBottom: isMobileNav ? '0.5rem' : '0.75rem',
      }}>
        <Icon size={isMobileNav ? 15 : 20} style={{ color: 'var(--accent)' }} />
      </div>
      <div style={{ fontSize: isMobileNav ? '0.82rem' : '0.95rem', fontWeight: 800, color: 'var(--text)', marginBottom: isMobileNav ? '0.3rem' : '0.4rem' }}>
        {card.title}
      </div>
      {/* Body copy dropped on mobile — this section is a value-prop
          appetizer, not reference material a mobile visitor needs to
          read in full; title + icon carries the point in far less
          vertical space, and the desktop branch keeps the full body. */}
      {!isMobileNav && (
        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.55, margin: 0 }}>
          {card.body}
        </p>
      )}
    </div>
  );
}

function WhyKuetx({ isMobileNav }) {
  return (
    <div style={{ marginBottom: isMobileNav ? '1.5rem' : '3rem' }}>
      <div style={{ textAlign: 'center', marginBottom: isMobileNav ? '0.75rem' : '1.25rem' }}>
        <h2 style={{ fontSize: 'clamp(1.35rem, 3.5vw, 1.7rem)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          কেন KUETx?
        </h2>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobileNav ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: isMobileNav ? '0.6rem' : '1rem',
      }}>
        {WHY_KUETX_CARDS.map((card, i) => (
          <WhyKuetxCard key={card.title} card={card} index={i} isMobileNav={isMobileNav} />
        ))}
      </div>
    </div>
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
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: '14px',
      background: 'var(--surface)',
      padding: isMobileNav ? '0.85rem 0.9rem' : '1.1rem 1.25rem',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        marginBottom: isMobileNav ? '0.55rem' : '0.75rem',
      }}>
        <span style={{
          width: '3px', height: isMobileNav ? '0.85rem' : '1rem',
          borderRadius: '999px', background: 'var(--accent)', flexShrink: 0,
        }} />
        <span style={{
          fontSize: isMobileNav ? '0.74rem' : '0.82rem', fontWeight: 800, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {label}
        </span>
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
    <div style={{ marginTop: '3.5rem', marginBottom: '3rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 'clamp(1.35rem, 3.5vw, 1.7rem)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '0.4rem' }}>
          {FEATURE_COUNT_DISPLAY} ফিচার, প্রতিটাই আসল
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--muted)', maxWidth: '480px', margin: '0 auto' }}>
          এখানে যা দেখছো তার সবটাই অ্যাপের real navigation থেকে — কোনো marketing list না।
        </p>
      </div>

      {/* Tabs — sticky on mobile so the Student/Faculty/Provider context
          stays visible once the visitor scrolls past it into the long
          feature list below (owner feedback: it scrolled out of view
          and the two-column list lost its role context). */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap',
        position: isMobileNav ? 'sticky' : 'static', top: isMobileNav ? '0' : undefined,
        zIndex: isMobileNav ? 5 : undefined,
        padding: isMobileNav ? '0.5rem 0' : 0,
        background: isMobileNav ? 'var(--bg)' : undefined,
      }}>
        {FEATURE_TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === activeTab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabClick(t.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 1rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 700,
                border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                cursor: 'pointer', transition: 'all 0.15s',
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? '#fff' : 'var(--text)',
              }}
            >
              <Icon size={15} /> {t.title}
            </button>
          );
        })}
      </div>

      {/* Card removed as a single bordered wrapper — each category is now
          its own sub-card (see FeatureCategoryBlock), so this outer
          container is just a responsive grid, no border/background of
          its own. Desktop: auto-fit columns sized off a minimum card
          width, so the grid actually uses the available page width
          (student tab's 7 categories now spread 3–4 wide on a normal
          desktop viewport instead of being capped at a narrow 2-column,
          860px-wide strip with dead space on both sides). Mobile keeps
          the previous 2-column-per-category-block behavior untouched. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobileNav
          ? 'minmax(0, 1fr)'
          : 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: isMobileNav ? '0.85rem' : '1.25rem',
        maxWidth: isMobileNav ? undefined : '1080px',
        margin: isMobileNav ? undefined : '0 auto',
      }}>
        {categories.map(([key, items]) => (
          <FeatureCategoryBlock key={key} label={tab.labels[key] || key} items={items} isMobileNav={isMobileNav} />
        ))}
      </div>

      {activeTab === 'student' && <CRFeatureBlock />}
    </div>
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
      width: isPhone ? '340px' : '100%',
      maxWidth: isPhone ? '340px' : '100%',
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
      <div
        ref={scrollHostRef}
        style={{
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

  return (
    <div style={{ marginBottom: '2rem' }}>
      <style>{`.kuetx-mockup-scrollhost::-webkit-scrollbar { display: none; }`}</style>
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
                border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                cursor: 'pointer', transition: 'all 0.15s',
                background: active ? 'var(--accent)' : 'var(--surfaceGlassStrong, var(--surface))',
                color: active ? '#fff' : 'var(--text)',
              }}
            >
              <Icon size={13} /> {role.title}
            </button>
          );
        })}
        {!isMobileNav && (
          <>
            <div style={{ width: '1px', background: 'var(--border)', margin: '0 0.2rem' }} />
            <button
              type="button"
              onClick={() => setMockupMode('phone')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.4rem 0.7rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700,
                border: '1px solid var(--border)', cursor: 'pointer',
                background: mockupMode === 'phone' ? 'var(--accent)' : 'transparent',
                color: mockupMode === 'phone' ? '#fff' : 'var(--text)',
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
                border: '1px solid var(--border)', cursor: 'pointer',
                background: mockupMode === 'desktop' ? 'var(--accent)' : 'transparent',
                color: mockupMode === 'desktop' ? '#fff' : 'var(--text)',
              }}
            >
              <Monitor size={13} />
            </button>
          </>
        )}
      </div>

      <MockupFrame mode={effectiveMode} scrollHostRef={scrollHostRef}>
        <DemoContent role={activeRole} />
      </MockupFrame>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
        <button
          type="button"
          onClick={onSignUp}
          style={{
            padding: '0.75rem 1.5rem', borderRadius: '12px',
            background: 'var(--accent)', color: '#fff', border: 'none',
            fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer',
          }}
        >
          {ROLE_CARDS.find(r => r.id === activeRole)?.title || ''} হিসেবে Sign Up করো
        </button>
      </div>
    </div>
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
  const openAuth = (intent) => { setAuthIntent(intent); setShowSignInPrompt(true); };
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
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Navbar — logo + Sign In/Sign Up, sticky, non-forcing.
          Phase 1 (landing redesign, §11.1): split the single "Sign In"
          button into two separate entry points so a new visitor doesn't
          have to guess which one applies to them. Sign In opens the plain
          Google AuthModal; Sign Up opens SignUpWizard instead (as of
          Phase 4/5/6) — role select -> profile details -> confirm ->
          Google last — see authIntent state above and the render logic
          further down. Sign Up is visually primary (filled) since most
          navbar visitors are new; Sign In is secondary (outlined). */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        padding: '0.85rem 1.25rem', background: 'var(--surfaceGlassStrong)',
        backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)',
      }}>
        <Wordmark height={isMobileNav ? 26 : 28} />
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

      <div style={{
        maxWidth: '1080px', margin: '0 auto',
        padding: isMobileNav ? '1.25rem 1rem 2.5rem' : '2.5rem 1.25rem 4rem',
      }}>
        {/* Hero — Phase 9.2 visual pass: no external font added (index.html's
            own "offline: no external preconnect to fonts" / "Use system
            fonts for full offline support" comment is a documented product
            policy for this offline-first PWA — an external Google Fonts
            request would be a real, permanent regression against that, not
            just a style nitpick, so the §8 "whichever's best" call lands on
            keeping the system stack here). Distinction instead comes from a
            small kicker label + tighter/heavier weight contrast on the
            headline than before, both achievable with the existing system
            font stack (index.html already loads system-ui/-apple-system/
            Segoe UI/Roboto/Noto Sans/Helvetica Neue/Arial — all of which
            carry a genuine 800-900 weight, so the heavier heading below
            isn't faking boldness the way an underweight webfont would). */}
        <div style={{ textAlign: 'center', marginBottom: isMobileNav ? '0.9rem' : '1.5rem' }}>
          {/* "KUET-এর জন্য বানানো..." kicker badge removed — it duplicated
              the footer's "KUETx — KUET-এর ছাত্রছাত্রীদের বানানো, KUET-এর
              জন্য" line for no added value at the top of the page. */}
          <h1 style={{
            fontSize: isMobileNav ? 'clamp(1.5rem, 7vw, 2rem)' : 'clamp(1.9rem, 6vw, 3.1rem)', fontWeight: 900,
            color: 'var(--text)', marginBottom: isMobileNav ? '0.5rem' : '0.75rem', letterSpacing: '-0.04em',
            lineHeight: 1.08,
          }}>
            The Digital Ecosystem<br />for KUET
          </h1>
          <p style={{
            fontSize: isMobileNav ? '0.85rem' : '1.02rem', color: 'var(--muted)',
            maxWidth: '560px', margin: '0 auto',
          }}>
            Student, Faculty, আর Service Provider — তিন role-ই একটা কার্ডে ক্লিক করে দেখো
            KUETx-এ তোমার জন্য কী আছে।
          </p>
        </div>

        <StatsStrip isMobileNav={isMobileNav} />

        <WhyKuetx isMobileNav={isMobileNav} />

        {/* Phase 9.3: full verbatim feature breakdown, role-tabbed. */}
        <FeatureBreakdown isMobileNav={isMobileNav} />

        {/* Always-visible, auto-rotating mockup preview — replaces the old
            click-to-open role cards entirely (owner decision, this
            session). Moved below FeatureBreakdown (owner request): the
            "৬২+ ফিচার" list now comes first, and the live mockup preview
            sits right after it. See RotatingPreview's own header comment
            for the full behavior spec. */}
        <RotatingPreview
          mockupMode={mockupMode}
          setMockupMode={setMockupMode}
          onSignUp={() => openAuth('signup')}
          isMobileNav={isMobileNav}
        />
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
