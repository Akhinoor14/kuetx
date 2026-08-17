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
  Monitor, Smartphone, ArrowLeft, Truck, Crown,
  Layers, ShieldCheck, Users, Sparkles, Mail, MessageSquare,
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

// Phase 9.2 (§8 owner-confirm: CSS/IntersectionObserver over a motion
// library — no framer-motion added, this app has no motion dependency
// anywhere else and stays on the free/Spark plan's "as light as
// possible" footprint per the tracker's own recurring notes; a 3-number
// count-up doesn't need a general-purpose animation library). Runs the
// animation once, when the stats strip first scrolls into view, using
// requestAnimationFrame directly rather than a timer loop — no new
// dependency, no CSS keyframes needed since the displayed value itself
// changes (keyframes can't animate text content).
function useCountUp(target, { duration = 1200, startWhenVisible = true } = {}) {
  const [value, setValue] = useState(startWhenVisible ? 0 : target);
  const [started, setStarted] = useState(!startWhenVisible);
  const ref = useRef(null);

  useEffect(() => {
    if (!startWhenVisible || started || !ref.current) return undefined;
    const node = ref.current;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setStarted(true);
        observer.disconnect();
      }
    }, { threshold: 0.4 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [startWhenVisible, started]);

  useEffect(() => {
    if (!started) return undefined;
    const start = performance.now();
    let frameId;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      // ease-out cubic — fast start, gentle settle, no external easing lib
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [started, target, duration]);

  return { value, ref };
}

// Phase 9.2 §8 owner-confirm: 4th stat is the real, verified feature
// count from landingFeatureInventory.js (Phase 9.1) — owner's explicit
// instruction was that this number must be real ("EI TA KINTU RAL
// HOITE HOBE"), not a rounded-up marketing figure, and that features
// should clearly outnumber routes since several routes bundle multiple
// features. The other two numbers here are simple, already-true facts
// (3 roles, 100% free) rather than anything needing its own
// verification pass — kept structurally identical (same StatCard, same
// count-up) so any of the three can be swapped independently later.
const STATS = [
  { id: 'features', value: TOTAL_FEATURE_COUNT, display: FEATURE_COUNT_DISPLAY, label: 'রিয়েল ফিচার' },
  { id: 'roles', value: 3, display: '৩', label: 'Role — Student, Faculty, Provider' },
  { id: 'free', value: 100, display: '১০০%', label: 'ফ্রি, চিরকাল' },
];

function StatCard({ stat }) {
  const { value, ref } = useCountUp(stat.value);
  // Bangla-digit stats (৬২+, ১০০%) don't have a clean way to animate the
  // trailing symbol through the count, so once the count-up reaches its
  // target we swap to the exact display string (with the % / + intact);
  // mid-animation we show the plain rounded number.
  const atTarget = value >= stat.value;
  return (
    <div ref={ref} style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
      <div style={{
        fontSize: 'clamp(1.6rem, 4vw, 2.1rem)', fontWeight: 800, color: 'var(--accent)',
        letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
      }}>
        {atTarget ? stat.display : value}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
        {stat.label}
      </div>
    </div>
  );
}

function StatsStrip() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '0.5rem', maxWidth: '520px', margin: '0 auto 2.5rem',
      padding: '1rem 0.5rem', borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
    }}>
      {STATS.map((stat) => <StatCard key={stat.id} stat={stat} />)}
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

function WhyKuetxCard({ card, index }) {
  const Icon = card.icon;
  const { ref, visible } = useRevealOnVisible();
  return (
    <div
      ref={ref}
      style={{
        padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border)',
        background: 'var(--surface)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(14px)',
        transition: `opacity 0.5s ease ${index * 90}ms, transform 0.5s ease ${index * 90}ms`,
      }}
    >
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '40px', height: '40px', borderRadius: '11px',
        background: 'rgba(var(--accentRGB),0.10)', marginBottom: '0.75rem',
      }}>
        <Icon size={20} style={{ color: 'var(--accent)' }} />
      </div>
      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.4rem' }}>
        {card.title}
      </div>
      <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.55, margin: 0 }}>
        {card.body}
      </p>
    </div>
  );
}

function WhyKuetx() {
  return (
    <div style={{ marginBottom: '3rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: 'clamp(1.35rem, 3.5vw, 1.7rem)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          কেন KUETx?
        </h2>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
      }}>
        {WHY_KUETX_CARDS.map((card, i) => <WhyKuetxCard key={card.title} card={card} index={i} />)}
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

// Owner note (Phase 9 kickoff, carried into 9.3): Pick and Drop should
// read as more prominent than the other Services items wherever
// Services is rendered, not sorted away alphabetically — a small badge
// on just that one item, rather than a whole separate section, keeps it
// inside its real category (still a campus service) while still making
// it impossible to skim past.
function FeatureItem({ name, highlight }) {
  return (
    <li style={{
      display: 'flex', alignItems: 'center', gap: '0.4rem',
      fontSize: '0.84rem', color: 'var(--text)', lineHeight: 1.5,
      padding: '0.3rem 0', borderBottom: '1px dashed var(--border)',
    }}>
      {highlight ? (
        <Truck size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      ) : (
        <CheckCircle2 size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
      )}
      <span>{name}</span>
      {highlight && (
        <span style={{
          fontSize: '0.66rem', fontWeight: 800, color: 'var(--accent)',
          background: 'rgba(var(--accentRGB),0.10)', borderRadius: '999px',
          padding: '0.1rem 0.45rem', marginLeft: 'auto',
        }}>
          জনপ্রিয়
        </span>
      )}
    </li>
  );
}

function FeatureCategoryBlock({ label, items }) {
  return (
    <div>
      <div style={{
        fontSize: '0.72rem', fontWeight: 800, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem',
      }}>
        {label}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((name) => (
          <FeatureItem key={name} name={name} highlight={name === 'Pick and Drop'} />
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
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.3rem 1rem',
      }}>
        {CR_FEATURES.map((name) => (
          <li key={name} style={{ display: 'flex', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text)' }}>
            <CheckCircle2 size={13} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '0.15rem' }} />
            <span>{name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeatureBreakdown() {
  const [activeTab, setActiveTab] = useState('student');
  const tab = FEATURE_TABS.find((t) => t.id === activeTab);
  const categories = Object.entries(tab.features);

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

      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {FEATURE_TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === activeTab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
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

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem', padding: '1.5rem', borderRadius: '18px',
        border: '1px solid var(--border)', background: 'var(--surfaceGlass, var(--surface))',
      }}>
        {categories.map(([key, items]) => (
          <FeatureCategoryBlock key={key} label={tab.labels[key] || key} items={items} />
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
          <FeatureBreakdown />
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
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.3rem 0.75rem', borderRadius: '999px',
            background: 'var(--surfaceGlass, var(--surface))', border: '1px solid var(--border)',
            fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)',
            letterSpacing: '0.02em', marginBottom: '1rem',
          }}>
            KUET-এর জন্য বানানো, KUET-এর ছাত্রছাত্রীদের দিয়ে
          </div>
          <h1 style={{
            fontSize: 'clamp(1.9rem, 6vw, 3.1rem)', fontWeight: 900,
            color: 'var(--text)', marginBottom: '0.75rem', letterSpacing: '-0.04em',
            lineHeight: 1.08,
          }}>
            The Digital Ecosystem<br />for KUET
          </h1>
          <p style={{ fontSize: '1.02rem', color: 'var(--muted)', maxWidth: '560px', margin: '0 auto' }}>
            Student, Faculty, আর Service Provider — তিন role-ই একটা কার্ডে ক্লিক করে দেখো
            KUETx-এ তোমার জন্য কী আছে।
          </p>
        </div>

        <StatsStrip />

        <WhyKuetx />

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
            {/* Phase 8 (§11.4): same "convinced by the demo" bridge as the
                mobile branch above — see that comment for the reasoning.
                Centered/max-width here since desktop has room, unlike the
                full-width mobile button. */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => openAuth('signup')}
                style={{
                  padding: '0.85rem 1.75rem', borderRadius: '12px',
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer',
                }}
              >
                {ROLE_CARDS.find(r => r.id === selectedRole)?.title || ''} হিসেবে Sign Up করো
              </button>
            </div>
          </div>
        )}

        {/* Phase 9.3: full verbatim feature breakdown, role-tabbed. Placed
            after the role cards/mockup rather than above them — a visitor
            picks a role and sees the demo first (the "show, don't list"
            moment), then this section backs that impression up with the
            complete, real list for whichever role they want to check. */}
        <FeatureBreakdown />
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
