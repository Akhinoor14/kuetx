/**
 * Profile.jsx — KUETx Full Profile Dashboard
 * Pulls live data from all major pages for a complete student overview.
 * Fully responsive: mobile-first, desktop-enhanced.
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, BookMarked, BookOpen, BookOpenText, Calendar, Camera, Check, CheckCircle2, ChevronRight, ClipboardList, CloudSun, Crown, ExternalLink, Flame, GraduationCap, Home, KeyRound, Landmark, Lock, Moon, PenLine, Pencil, ShieldCheck, StickyNote, Sun, Sunrise, Sunset, Target, User, UserPlus, UserX } from 'lucide-react';
import {
  store, getProfile, DEFAULT_PROFILE, DEPARTMENTS,
  getLegacyTermResults, TERM_KEYS, MIN_ATTENDANCE_PERCENT,
  SCHOLARSHIP_ATTENDANCE_PCT, HONORS_CGPA, MIN_CGPA_GRADUATION,
  computeCGPA,
  normalizeProfileForSave,
  validateProfileForSave,
} from '../store/store';
import { getAllCourses } from '../store/curriculumStore';
import ProfileSetupModal from '../components/ProfileSetupModal';
import AuthModal from '../components/AuthModal';
import { onAuthChange, logout } from '../lib/firebaseAuth';
import { subscribeMyEmailFlag } from '../lib/emailFlags';
import { auth } from '../lib/firebase';
import { startFirebaseSync, pushProfile } from '../lib/firebaseSync';
import { syncLocalDataOnAuth, clearLocalDataOnLogout } from '../lib/accountLifecycle';
import { uploadProfilePicture, getProfilePhotoURL, deleteProfilePicture } from '../lib/profilePicture';
import { AvatarUploadModal } from '../components/AvatarUploadModal';
import { syncBloodDonorEntry } from '../lib/bloodDonorSync';
import { getGroupId } from '../lib/groupUtils';
import { subscribeMyRole, subscribeIsOwnMember, subscribeOwnMemberVerified, requestLeaveCR, leaveGroup } from '../lib/groupSync';
import ClaimCRCard, { ClaimCRInlineButton } from '../components/ClaimCRCard';
import JoinStatusCard from '../components/JoinStatusCard';
import CRMobileNumberBanner from '../components/CRMobileNumberBanner';
import EmailVerifyBanner from '../components/EmailVerifyBanner';
import EmailFlagBanner from '../components/EmailFlagBanner';
import BlueTick from '../components/BlueTick';


// ─── Helpers ─────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split('T')[0];

// KUET's 7 residential halls → their individual account/login portal URLs.
// Keys must exactly match the values produced by HALL_OPTIONS in
// ProfileSetupModal.jsx (profile.hallName is stored verbatim from there).
const HALL_LINKS = {
  'Rokeya Hall': 'https://hall.kuet.ac.bd/rkh',
  'Lalan Shah Hall': 'https://hall.kuet.ac.bd/lsh',
  'Shaheed Smriti Hall': 'https://hall.kuet.ac.bd/ssh',
  'Amar Ekushey Hall': 'https://hall.kuet.ac.bd/aeh',
  'Khan Jahan Ali Hall': 'https://hall.kuet.ac.bd/khaja',
  'Fazlul Haque Hall': 'https://hall.kuet.ac.bd/fhh',
  'Dr. M.A Rashid Hall': 'https://hall.kuet.ac.bd/marh',
};

// Academic system login — same for every student, no hall-specific variant.
const ACADEMIC_SYSTEM_LINK = 'https://academic.kuet.ac.bd/';

/** Compute overall attendance % from attLogs (daily mode) */
const computeOverallAttendance = (logs = {}) => {
  let held = 0, attended = 0;
  Object.values(logs).forEach(courseLog => {
    if (typeof courseLog !== 'object') return;
    Object.values(courseLog).forEach(teacherLog => {
      if (typeof teacherLog !== 'object') return;
      Object.values(teacherLog).forEach(v => {
        if (v === 'present' || v === 'absent') {
          held++;
          if (v === 'present') attended++;
        }
      });
    });
  });
  return held > 0 ? { held, attended, pct: Math.round((attended / held) * 100) } : null;
};

/** Compute current term CGPA from marks */
const computeCurrentTermGPA = (marks = {}, courses = []) => {
  let totalPoints = 0, totalCredits = 0;
  courses.forEach(c => {
    const m = marks[c.id] || {};
    const grade = m.publishedGrade || m.resultGrade;
    if (!grade) return;
    const gp = ({'A+':4,'A':3.75,'A-':3.5,'B+':3.25,'B':3,'B-':2.75,'C+':2.5,'C':2.25,'D':2,'F':0})[grade];
    if (gp !== undefined && c.credits) {
      totalPoints += gp * c.credits;
      totalCredits += c.credits;
    }
  });
  return totalCredits > 0 ? { gpa: (totalPoints / totalCredits).toFixed(2), credits: totalCredits } : null;
};

/** Compute CGPA — uses the same engine as Dashboard/Results so course-entered
 * grades are included, not just manually imported legacy terms. */
const computeFullCGPA = (courses) => {
  const { cgpa, earnedCredits } = computeCGPA(courses);
  return cgpa !== null ? { cgpa: cgpa.toFixed(2), credits: earnedCredits } : null;
};

// ─── Mini Components ──────────────────────────────────────────────────────────

const Ring = ({ pct, size = 56, stroke = 5, color = 'var(--accent)' }) => {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
    </svg>
  );
};

const StatCard = ({ icon, label, value, sub, color = 'var(--accent)', ring }) => (
  <div style={{
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
    padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14,
    transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default', minWidth: 0,
  }}
  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.09)'; }}
  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
    {ring != null ? (
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Ring pct={ring} size={52} stroke={5} color={color} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color }}>
          {ring}%
        </div>
      </div>
    ) : (
      <div style={{ width: 44, height: 44, borderRadius: 11, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color }}>
        {icon}
      </div>
    )}
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value ?? '—'}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

const InfoRow = ({ label, value, accent }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(60px, 110px) minmax(0, 1fr)', gap: 10, alignItems: 'flex-start' }}>
    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, paddingTop: 1 }}>{label}</span>
    <span style={{ fontSize: 14, color: accent ? 'var(--accent)' : 'var(--text)', fontWeight: accent ? 700 : 500, wordBreak: 'break-word', minWidth: 0 }}>{value || '—'}</span>
  </div>
);

// Full-screen in-app overlay that shows an external KUET portal (Hall or
// Academic system) inside an iframe, so it visually feels like a page
// within KUETx rather than jumping out to a new browser tab.
//
// Back-button behaviour: when opened, we push a history entry. The device/
// browser back gesture then fires `popstate`, which we catch to close the
// overlay — so "back" returns to KUETx instead of closing the whole app or
// browser tab. If the overlay is closed via the X button instead, we undo
// that pushed history entry ourselves so back-stack stays clean.
//
// Google OAuth inside academic.kuet.ac.bd cannot load inside an iframe
// (Google blocks it for security — "This browser or app may not be
// secure"). Students log in there with Roll/Password instead, which works
// fine in an iframe. As a safety net, if the iframe fails to load at all
// (blocked by X-Frame-Options/CSP, or a dead network), we show a fallback
// "Open in Browser" button rather than a stuck blank screen.
const InAppWebView = ({ url, title, onClose }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const pushedRef = useRef(false);

  useEffect(() => {
    window.history.pushState({ kuetxWebview: true }, '');
    pushedRef.current = true;

    const onPop = () => onClose();
    window.addEventListener('popstate', onPop);

    // If the portal takes too long (blocked frame, dead host), fall back
    // to an "open externally" prompt instead of an endless blank screen.
    const failSafe = setTimeout(() => { if (!loaded) setFailed(true); }, 9000);

    return () => {
      window.removeEventListener('popstate', onPop);
      clearTimeout(failSafe);
      // Closed via the X button rather than a real back gesture — undo the
      // history entry we pushed so the back-stack doesn't grow forever.
      if (pushedRef.current && window.history.state?.kuetxWebview) {
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100060, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* App-style top bar — this is what sells the "still inside KUETx"
          feeling; without it an edge-to-edge iframe just looks like a
          random website. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: 'max(10px, env(safe-area-inset-top, 0px)) 14px 10px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          aria-label="Back"
          style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'var(--bg)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <ArrowLeft size={18} color="var(--text)" />
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{url.replace(/^https?:\/\//, '')}</div>
        </div>
        <a
          href={url} target="_blank" rel="noopener noreferrer"
          aria-label="Open in browser"
          style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'var(--bg)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
          }}
        >
          <ExternalLink size={15} color="var(--muted)" />
        </a>
      </div>

      {/* Thin progress hint while the iframe is loading */}
      {!loaded && !failed && (
        <div style={{ height: 2, background: 'var(--border)', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{
            height: '100%', width: '40%',
            background: 'linear-gradient(90deg, var(--accent), var(--accent2))',
            animation: 'profileWebviewLoad 1.1s ease-in-out infinite',
          }} />
        </div>
      )}

      <div style={{ flex: 1, position: 'relative' }}>
        {failed ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center',
          }}>
            <Lock size={36} color="var(--muted)" />
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>This page can't load here</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 280 }}>Some KUET portals (and Google sign-in) don't allow embedding. Open it in your browser instead.</div>
            <a href={url} target="_blank" rel="noopener noreferrer" style={{
              padding: '10px 20px', borderRadius: 10, background: 'var(--accent)', color: 'var(--accentFg)',
              fontSize: 13, fontWeight: 700, textDecoration: 'none',
            }}>
              Open in Browser →
            </a>
          </div>
        ) : (
          <iframe
            src={url}
            title={title}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            style={{ width: '100%', height: '100%', border: 'none', background: 'var(--bg)' }}
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          />
        )}
      </div>
    </div>
  );
};

// One tile inside the "Quick Accounts" card — either the student's specific
// hall portal or the shared academic system, both external KUET logins.
// Opens inside the full-screen InAppWebView (not a new tab) so it reads as
// part of KUETx; the device back button closes it back into this page.
// Themed with the accent gradient so the pair reads as a single cohesive
// feature rather than a generic link list.
const AccountLinkTile = ({ icon, title, subtitle, href, disabled, disabledHint }) => {
  const [webviewOpen, setWebviewOpen] = useState(false);
  const content = (
    <>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: disabled ? 'var(--border)' : 'linear-gradient(135deg, var(--accent), var(--accent2))',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
        boxShadow: disabled ? 'none' : '0 4px 12px color-mix(in srgb, var(--accent) 35%, transparent)',
      }}>
        <span style={{ display: 'inline-flex', filter: disabled ? 'grayscale(1) opacity(0.6)' : 'none' }}>{icon}</span>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
        <div style={{
          fontSize: 11, color: disabled ? '#f59e0b' : 'var(--muted)', fontWeight: disabled ? 600 : 500,
          marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {disabled ? disabledHint : subtitle}
        </div>
      </div>
      {!disabled && <ChevronRight size={15} color="var(--muted)" style={{ flexShrink: 0 }} />}
    </>
  );

  const sharedStyle = {
    display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 12,
    background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none',
    transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s', minWidth: 0,
    cursor: disabled ? 'default' : 'pointer', width: '100%', textAlign: 'left', font: 'inherit',
  };

  if (disabled) {
    return <div style={{ ...sharedStyle, opacity: 0.85 }}>{content}</div>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setWebviewOpen(true)}
        style={sharedStyle}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'var(--border)'; }}
      >
        {content}
      </button>
      {webviewOpen && (
        <InAppWebView url={href} title={title} onClose={() => setWebviewOpen(false)} />
      )}
    </>
  );
};

// Lets a student hand their uid to whoever needs to assign them a KUETx
// staff role (Head of Ops, Campus Lead, etc.) — those roles are just a
// Firestore doc keyed by uid, no new account/password needed, so this is
// the one piece of information that actually has to be shared manually.
const CopyMyIdRow = () => {
  const [copied, setCopied] = useState(false);
  const uid = auth.currentUser?.uid;

  const handleCopy = async () => {
    if (!uid) return;
    try {
      await navigator.clipboard.writeText(uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail in some embedded/insecure contexts — the
      // uid is still visible on screen for manual copy either way.
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, paddingTop: 1 }}>My ID</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{uid || '—'}</span>
        <button
          onClick={handleCopy}
          disabled={!uid}
          className="btn btn-sm btn-secondary"
          style={{ flexShrink: 0 }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
};

const Section = ({ title, icon, children, className, action }) => (
  <div className={className} style={{
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
    overflow: 'hidden', transition: 'border-color 0.2s, box-shadow 0.2s',
  }}
  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.07)'; }}
  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = ''; }}>
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 3, height: 16, borderRadius: 2, background: 'linear-gradient(var(--accent), var(--accent2))' }} />
      {icon && <span style={{ display: 'inline-flex', color: 'var(--muted)', flexShrink: 0 }}>{icon}</span>}
      <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text)', flex: 1 }}>{title}</span>
      {action}
    </div>
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {children}
    </div>
  </div>
);

const Badge = ({ label, color = '#16a34a', bg }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
    borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
    background: bg || `${color}18`, color,
    border: `1px solid ${color}30`,
  }}>{label}</span>
);

const ProgressBar = ({ pct, color = 'var(--accent)', height = 6 }) => (
  <div style={{ background: 'var(--border)', borderRadius: 99, overflow: 'hidden', height }}>
    <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
  </div>
);

// ─── Account Banner ───────────────────────────────────────────────────────────

const AccountBanner = ({ user, onLogin, onLogout }) => {
  const anon = !user || user.isAnonymous;
  return (
    <div style={{
      background: anon
        ? 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(249,115,22,0.06) 100%)'
        : 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(14,165,233,0.06) 100%)',
      border: `1.5px solid ${anon ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.25)'}`,
      borderRadius: 14, padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    }}>
      {anon ? <UserX size={20} color="#f59e0b" /> : <ShieldCheck size={20} color="#16a34a" />}
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
          {anon ? 'Guest Mode — Data saved locally' : (user?.displayName || user?.email || 'Signed In')}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
          {anon
            ? 'Sign in to sync across devices & keep your data safe.'
            : `Firebase synced · ${user?.email || 'Google Account'}`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {anon ? (
          <button onClick={onLogin} style={{
            padding: '7px 16px', background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>Sign In</button>
        ) : (
          <button onClick={onLogout} style={{
            padding: '7px 14px', background: 'transparent', color: 'var(--muted)',
            border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
            Sign Out
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(getProfile() || DEFAULT_PROFILE);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [photoURL, setPhotoURL] = useState(null);
  const autoOpenedRef = useRef(false);
  const [namazTick, setNamazTick] = useState(0);
  const [reminderTick, setReminderTick] = useState(0);
  const reminderTimerRef = useRef(null);

  // BUGFIX: useState(getProfile() ...) above only ever runs its initializer
  // ONCE, at the exact instant this component first mounts. If IndexedDB is
  // still warming up at that moment (see store.js's ensureDBReady — can
  // take longer than main.jsx's 2s race allows for), this page was
  // permanently stuck showing whatever was in the empty/partial cache at
  // that instant, never re-reading even after the real data finished
  // loading a moment later. store.js already fires a 'kuetx:store-updated'
  // event on every write AND once when ensureDBReady() itself resolves —
  // this just needed a listener to actually use it.
  useEffect(() => {
    const onStoreUpdated = () => setProfile(getProfile() || DEFAULT_PROFILE);
    window.addEventListener('kuetx:store-updated', onStoreUpdated);
    return () => window.removeEventListener('kuetx:store-updated', onStoreUpdated);
  }, []);

  const advanceReminder = useCallback(() => {
    setReminderTick(t => t + 1);
    // reset the hourly timer
    if (reminderTimerRef.current) clearInterval(reminderTimerRef.current);
    reminderTimerRef.current = setInterval(() => {
      setReminderTick(t => t + 1);
    }, 3600000);
  }, []);

  // Hourly reminder shuffle + namaz sync every minute
  useEffect(() => {
    reminderTimerRef.current = setInterval(() => {
      setReminderTick(t => t + 1);
    }, 3600000);
    const namazInterval = setInterval(() => {
      setNamazTick(t => t + 1);
    }, 60000);
    return () => {
      clearInterval(reminderTimerRef.current);
      clearInterval(namazInterval);
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthChange(async u => {
      setFirebaseUser(u);
      // Compute emailVerified here, from the resolved user object, instead
      // of the [profile]-keyed effect below (removed) — that one called the
      // synchronous isEmailVerified() (backed by auth.currentUser), which is
      // still null on first paint before Firebase Auth restores the
      // session, causing the "not verified" banner to flash for already-
      // verified users. u is only non-null once auth state is known.
      if (u) {
        setEmailVerified(!!u.emailVerified);
        const url = await getProfilePhotoURL();
        setPhotoURL(url);
      }
    });
    return unsub;
  }, []);

  const getDeptName = code => (DEPARTMENTS.find(d => d.code === code)?.name || code);
  // BUGFIX: this used to also require profile?.session — but Academic
  // Session was never part of the mandatory first-run (minimal)
  // ProfileSetupModal form; it's only asked in the full Settings/
  // "Complete Profile" version, filled in later. That meant hasMinProfile
  // stayed permanently false for anyone who only ever completed the
  // mandatory onboarding (Name, Student ID, dept auto-derived, Current
  // Term, Blood Group) — the "Welcome to KUETx / Setup Profile" screen
  // kept reappearing forever, looking like nothing had saved, because it
  // was checking a field structurally impossible to fill at that stage.
  // Now matches exactly what onboarding actually collects and requires.
  const hasMinProfile = !!(profile?.name && profile?.studentId && profile?.dept && profile?.currentTermKey && profile?.bloodGroup);

  // Blue Tick reflects members/{uid}.verified — a human-approval fact
  // (set by approveJoinRequest / CL bootstrap), same source
  // ClassmatesList.jsx already uses for every other member's tick. There
  // is no email-OTP tier anymore.
  const [isKuetVerified, setIsKuetVerified] = useState(false);
  // null = auth state not resolved yet (avoid flashing the "email not
  // verified" banner before we know); true/false once onAuthChange fires.
  const [emailVerified, setEmailVerified] = useState(null);
  const [emailFlag, setEmailFlag] = useState(null);
  useEffect(() => {
    const unsub = subscribeMyEmailFlag((flag) => {
      setEmailFlag(flag && flag.status === 'pending' ? flag : null);
    });
    return unsub;
  }, []);
  useEffect(() => {
    const groupId = getGroupId(profile);
    if (!groupId || !auth.currentUser?.uid) { setIsKuetVerified(false); return; }
    return subscribeOwnMemberVerified(groupId, auth.currentUser.uid, setIsKuetVerified);
  }, [profile?.dept, profile?.batch, profile?.studentId]);

  // Real, server-verified CR/ACR status — profile.isCR is just a
  // self-ticked checkbox from Profile Setup with no verification behind
  // it, so it must never be used to show a "CR" badge/banner on someone's
  // own profile (which classmates can also see). This mirrors the same
  // members/{uid}.role check used by RequireCR.jsx / Sidebar.jsx.
  // null = not yet checked (avoid flashing the "Claim CR" card for
  // already-CR/ACR users while the role subscription is still loading);
  // false = checked and confirmed not CR/ACR; true = confirmed CR/ACR.
  const [isRealCR, setIsRealCR] = useState(null);
  // Same subscription, kept as the raw role string too (not just the
  // cr/acr boolean) so CRMobileNumberBanner below can tell "cr" from
  // "acr" for its copy without a second subscribeMyRole listener.
  const [ownRole, setOwnRole] = useState(null);
  // Accurate "actually an approved member" boolean — subscribeMyRole
  // alone can't distinguish a real plain member from someone with no
  // members/{uid} doc at all (both report the string 'member'), which
  // matters here specifically because a non-member must NOT see a
  // "Leave Class" button that would try to delete a doc that doesn't
  // exist. See subscribeIsOwnMember's own doc-comment in groupSync.js.
  const [isOwnMember, setIsOwnMember] = useState(null);
  const [leaveCRState, setLeaveCRState] = useState('idle'); // idle | sending | sent
  const [leaveClassState, setLeaveClassState] = useState('idle'); // idle | leaving
  useEffect(() => {
    const groupId = getGroupId(profile);
    if (!groupId || !auth.currentUser?.uid) { setIsRealCR(false); setOwnRole(null); setIsOwnMember(null); return; }
    const unsubRole = subscribeMyRole(groupId, auth.currentUser.uid, (role) => {
      setIsRealCR(role === 'cr' || role === 'acr');
      setOwnRole(role);
    });
    const unsubMember = subscribeIsOwnMember(groupId, auth.currentUser.uid, setIsOwnMember);
    return () => { unsubRole(); unsubMember(); };
  }, [profile?.dept, profile?.batch, profile?.studentId]);

  // Admin/staff status card removed from this page — Team & Administration
  // access now lives solely in Sidebar/BottomNav (see useIsStaff.js), so
  // this component no longer needs its own duplicate admin subscription.

  useEffect(() => {
    if (!hasMinProfile && !autoOpenedRef.current) {
      setIsModalOpen(true);
      autoOpenedRef.current = true;
    }
  }, [hasMinProfile]);

  const handleSave = formData => {
    const result = validateProfileForSave(formData);
    if (!result.ok) {
      const msgs = Object.values(result.errors).join('\n');
      alert('Profile cannot be saved:\n' + msgs);
      return;
    }
    const next = normalizeProfileForSave(formData);
    store.set('profile', next);
    setProfile(next);
    // Keep the Founder's Blood Bank directory in sync with later edits
    // too, not just first-run onboarding — see bloodDonorSync.js.
    if (auth.currentUser?.uid && !auth.currentUser.isAnonymous) {
      syncBloodDonorEntry(auth.currentUser.uid, next).catch(() => {});
      // Phase 5: 'profile' is excluded from the generic per-key sync loop
      // (see EXCLUDED_KEYS in firebaseSync.js) — it now lives at its own
      // students/{dept}/{batch}/{uid} path, so it must be pushed
      // explicitly here rather than relying on the generic store-change
      // listener to pick it up. Fire-and-forget: local store + UI state
      // are already updated above, so a slow/failed network push doesn't
      // block the save from completing for the user.
      pushProfile(auth.currentUser.uid, next).catch(err => {
        console.warn('[KUETx Profile] pushProfile failed:', err.message);
      });
    }
    setIsModalOpen(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleLogout = async () => {
    if (!confirm('Sign out? This device will be cleared — log back in anytime and everything comes right back from the cloud.')) return;
    try {
      await logout();
    } catch {}
    // BUGFIX (design change after review): logout used to leave local
    // data untouched ("stays on this device"), which directly worked
    // against this whole session's fix — a DIFFERENT person registering
    // a brand-new account on the same device afterward would still
    // trigger the clear anyway (syncLocalDataOnAuth's isBrandNewAccount
    // check), silently breaking the promise this dialog made. Since this
    // app is cloud-based and a returning account's data comes right back
    // via startFirebaseSync()'s pull in well under a second, there was no
    // real benefit to keeping it around locally after logout — only risk.
    // Clearing here makes the promise simple and always true instead.
    await clearLocalDataOnLogout();
    // Full reload after sign-out clears any stale cached React state
    // (roles, faculty/staff status, profile, etc.) that was loaded for
    // the previous session — same pattern used in Settings.jsx and
    // Navbar.jsx. Runs even if logout() throws, so a broken session never
    // gets stuck showing signed-in UI.
    setTimeout(() => window.location.reload(), 800);
  };

  // Called when user logs in from Profile page.
  //
  // BUGFIX (logic gap found on review — same class of bug as App.jsx's
  // handleAuthSuccess and useFirebaseAuth.js's onAuthChange, but in a
  // COMPLETELY SEPARATE handler that neither of those fixes touched,
  // since this one is wired directly to AccountBanner's onLogin here on
  // the Profile page rather than going through App.jsx at all).
  //
  // This used to unconditionally call pushAllToFirestore(user.uid) for
  // ANY non-anonymous login/register success from this page — no
  // isBrandNewAccount check, no isProfileStaleForUid check, nothing. A
  // brand-new account created via this exact modal (Profile page's own
  // AccountBanner "Login"/"Sign up" button) would immediately have
  // whatever local kuetx_* data happened to be sitting in this browser
  // (a previous account's leftovers on a shared/reused device) pushed
  // straight to its Firestore doc — the same "new account inherits old
  // data" bug this whole session has been about, just reachable through
  // a different door than App.jsx's own AuthModal instances.
  //
  // Fix: route through accountLifecycle.js's syncLocalDataOnAuth(), the
  // same single source of truth every other auth-success call site in
  // the app now uses — see that file for the full new-vs-returning
  // account reasoning. Three copies of this same logic (here, App.jsx,
  // useFirebaseAuth.js) were exactly how this bug slipped through
  // review the first time; there is now exactly one copy.
  const handleAuthSuccess = async (user) => {
    setShowAuthModal(false);
    if (!user || user.isAnonymous) return;

    try {
      await syncLocalDataOnAuth(user);
      await startFirebaseSync(user.uid, {});
    } catch (err) {
      console.warn('[KUETx Profile] Post-login sync failed:', err.message);
    }
  };

  // ── Live data from store ──────────────────────────────────────────────────

  const liveData = useMemo(() => {
    const marks = store.get('marks') || {};
    const attLogs = store.get('attLogs') || {};
    const combinedData = store.get('attCombinedData') || {};
    const combinedMode = !!store.get('attCombinedMode');
    const assignments = store.get('assignments') || [];
    const diary = store.get('diary') || [];
    const notes = store.get('notes') || [];
    const moneyEntries = store.get('money_entries') || [];
    const cashBalance = store.get('money_cash') ?? 0;
    const budget = store.get('money_budget') ?? 0;
    const legacyTerms = getLegacyTermResults() || [];
    const courses = getAllCourses(profile) || [];

    // Attendance
    const attData = combinedMode
      ? (() => {
          let h = 0, a = 0;
          Object.values(combinedData).forEach(v => { h += Number(v?.held || 0); a += Number(v?.attended || 0); });
          return h > 0 ? { held: h, attended: a, pct: Math.round((a / h) * 100) } : null;
        })()
      : computeOverallAttendance(attLogs);

    // Upcoming assignments
    const today = todayStr();
    const upcomingAssignments = (Array.isArray(assignments) ? assignments : [])
      .filter(a => a.dueDate >= today && !a.done)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 3);
    const doneAssignments = (Array.isArray(assignments) ? assignments : []).filter(a => a.done).length;
    const totalAssignments = Array.isArray(assignments) ? assignments.length : 0;

    // Money
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthEntries = moneyEntries.filter(e => (e.date || '').startsWith(thisMonth));
    const monthExpense = monthEntries.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount || 0), 0);
    const monthIncome = monthEntries.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount || 0), 0);

    // GPA
    const cgpaData = computeFullCGPA(courses);
    const currentTermCourses = courses.filter(c => `Y${c.year}T${c.term}` === profile.currentTermKey);
    const currentTermGPA = computeCurrentTermGPA(marks, currentTermCourses);

    // Notes & Diary  
    const recentNotes = (Array.isArray(notes) ? notes : []).slice(0, 3);
    const recentDiary = (Array.isArray(diary) ? diary : []).slice(0, 3);

    // Study sessions
    const studySessions = store.get('selfstudy_academic') || [];
    const studyHours = (Array.isArray(studySessions) ? studySessions : [])
      .reduce((s, ss) => s + Number(ss.hours || 0), 0);

    // Study streak (consecutive days with any session)
    const studyByDate = {};
    (Array.isArray(studySessions) ? studySessions : []).forEach(ss => {
      if (ss.date) studyByDate[ss.date] = true;
    });
    let studyStreak = 0;
    const sd = new Date();
    for (let i = 0; i < 60; i++) {
      const key = sd.toISOString().split('T')[0];
      if (studyByDate[key]) { studyStreak++; sd.setDate(sd.getDate() - 1); } else break;
    }

    // Namaz today
    const namazRecords = store.get('namaz') || {};
    const todayNamaz = namazRecords[today] || {};
    const namazDone = ['Fajr','Dhuhr','Asr','Maghrib','Isha'].map(p => !!todayNamaz[p]?.done);

    return {
      attData, upcomingAssignments, doneAssignments, totalAssignments,
      monthExpense, monthIncome, cashBalance, budget,
      cgpaData, currentTermGPA, currentTermCourses,
      recentNotes, recentDiary, studyHours,
      legacyTerms, diary, notes, marks, courses,
      studyStreak, namazDone,
    };
  }, [profile, namazTick]);

  // ── Attendance status ─────────────────────────────────────────────────────
  const attPct = liveData.attData?.pct;
  const attColor = attPct == null ? 'var(--muted)'
    : attPct >= SCHOLARSHIP_ATTENDANCE_PCT ? '#16a34a'
    : attPct >= MIN_ATTENDANCE_PERCENT ? '#f59e0b'
    : '#ef4444';
  const attLabel = attPct == null ? null
    : attPct >= SCHOLARSHIP_ATTENDANCE_PCT ? 'Scholarship Eligible'
    : attPct >= MIN_ATTENDANCE_PERCENT ? 'Safe'
    : 'At Risk!';

  // ── CGPA status ───────────────────────────────────────────────────────────
  const cgpa = parseFloat(liveData.cgpaData?.cgpa);
  const cgpaColor = isNaN(cgpa) ? 'var(--muted)'
    : cgpa >= HONORS_CGPA ? '#16a34a'
    : cgpa >= MIN_CGPA_GRADUATION ? '#0ea5e9'
    : '#ef4444';
  const cgpaLabel = isNaN(cgpa) ? null
    : cgpa >= HONORS_CGPA ? 'With Honors'
    : cgpa >= MIN_CGPA_GRADUATION ? 'Good Standing'
    : 'Below Minimum';

  if (!hasMinProfile) {
    return (
      <div className="page-enter page-container">
        {(!firebaseUser || firebaseUser.isAnonymous) && (
          <>
            <AccountBanner user={firebaseUser} onLogin={() => setShowAuthModal(true)} onLogout={handleLogout} />
            <div style={{ height: 24 }} />
          </>
        )}
        <div style={{
          background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
          borderRadius: 20, padding: 'clamp(48px,10vw,100px) clamp(20px,5vw,56px)',
          textAlign: 'center', position: 'relative', overflow: 'hidden',
          boxShadow: '0 24px 64px color-mix(in srgb, var(--accent) 28%, transparent)',
        }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{
              width: 'clamp(80px,18vw,120px)', height: 'clamp(80px,18vw,120px)', margin: '0 auto 20px',
              borderRadius: '50%', background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'profileFloat 6s ease-in-out infinite',
            }}>
              <UserPlus size={48} color="white" strokeWidth={1.75} style={{ width: 'clamp(36px,8vw,56px)', height: 'clamp(36px,8vw,56px)' }} />
            </div>
            <h2 style={{ fontSize: 'clamp(26px,7vw,46px)', fontWeight: 950, margin: '0 0 10px', color: 'white', letterSpacing: '-0.03em' }}>Welcome to KUETx</h2>
            <p style={{ fontSize: 'clamp(13px,3vw,16px)', color: 'rgba(255,255,255,0.9)', margin: '0 0 32px', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.7 }}>
              Set up your profile for personalized GPA tracking, attendance insights, and more.
            </p>
            <button onClick={() => setIsModalOpen(true)} style={{
              padding: '13px 38px', background: 'rgba(255,255,255,0.95)', color: 'var(--accent)',
              border: '2px solid rgba(255,255,255,0.3)', borderRadius: 14,
              fontSize: 16, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 12px 36px rgba(0,0,0,0.2)',
              transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
              display: 'inline-flex', alignItems: 'center', gap: 10,
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = ''}>
              <span>+</span> Setup Profile →
            </button>
          </div>
        </div>
        <ProfileSetupModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} initialProfile={profile} />
        {showAuthModal && <AuthModal mode="login" isUpgrade={!!firebaseUser?.isAnonymous} onClose={() => setShowAuthModal(false)} onSuccess={handleAuthSuccess} />}
      </div>
    );
  }

  return (
    <div className="page-enter page-container content-page-bg" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Account Banner — only shown for guest/anonymous accounts.
           Signed-in users already see their name in the hero card below,
           and Sign Out lives in the hamburger menu, so this banner would
           be pure redundant clutter for them. ── */}
      {(!firebaseUser || firebaseUser.isAnonymous) && (
        <AccountBanner user={firebaseUser} onLogin={() => setShowAuthModal(true)} onLogout={handleLogout} />
      )}

      {/* ── Save toast ── */}
      {saved && (
        <div style={{
          padding: '12px 18px', borderRadius: 10, background: '#dcfce7', color: '#166534',
          fontSize: 14, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600,
        }}><CheckCircle2 size={16} /> Profile updated!</div>
      )}

      {/* ── Hero: minimal — Avatar (top) + Name (below). Same layout on
           mobile and desktop now; Edit button moved into Personal Info,
           Sign Out lives in the hamburger menu. ── */}
      <div className="profile-hero-plain" style={{
        borderRadius: 20, padding: 'clamp(28px,5vw,40px) clamp(20px,4vw,32px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 14,
        position: 'relative', overflow: 'hidden', textAlign: 'center',
      }}>
        {/* Avatar — clickable to upload, with glow ring + click-to-edit hint */}
        <div
          onClick={() => setShowAvatarModal(true)}
          title="Click to change profile picture"
          className="profile-hero-avatar"
          style={{
            borderRadius: '50%',
            background: photoURL ? 'transparent' : 'var(--accentSoft)',
            border: '3px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, color: 'var(--accent)',
            flexShrink: 0, cursor: 'pointer', overflow: 'hidden', position: 'relative',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
        >
          {photoURL
            ? <img src={photoURL} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span>{profile.name ? profile.name.trim().charAt(0).toUpperCase() : <User size={28} />}</span>
          }
          {/* Camera overlay on hover — desktop affordance, kept as-is */}
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: 'opacity 0.2s', borderRadius: '50%',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
            <Camera size={22} color="white" />
          </div>
          {/* Always-visible camera badge — hover-only affordances are invisible
              on touch devices, so users had no way of knowing the avatar was
              tappable. This badge sits in the corner permanently. */}
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: '30%', height: '30%', minWidth: 26, minHeight: 26,
            borderRadius: '50%', background: 'var(--accent)',
            border: '2.5px solid var(--card, #fff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
          }}>
            <Camera size={14} color="#fff" style={{ width: '46%', height: '46%' }} />
          </div>
        </div>

        {/* Name only — Student ID / Session / Term already shown in
             Academic Info / Personal Info cards below. Edit lives there too. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ fontSize: 'clamp(19px,4.5vw,28px)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.2, fontFamily: "'Space Grotesk', 'Sora', 'Hind Siliguri', system-ui, sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
            {profile.name}
            {isKuetVerified && <BlueTick size={18} />}
          </div>
          {isRealCR && <Badge label="CR" color="var(--accent)" bg="var(--accentSoft)" />}
        </div>
      </div>

      {/* ── Staff-flagged Email Banner (existing account, human-reviewed) ── */}
      {emailFlag && (
        <EmailFlagBanner flag={emailFlag} onGoToSettings={() => { window.location.href = '/settings'; }} />
      )}

      {/* ── Account Email Verify Banner (password-recovery reachability) ── */}
      {emailVerified === false && (
        <EmailVerifyBanner onVerified={() => setEmailVerified(true)} />
      )}

      {/* ── KUET Email OTP/magic-link verify flow removed entirely (no
          Tier-1 self-verify anymore). Blue Tick above now reflects
          member.verified — set only by a human CL/Faculty approval — via
          subscribeOwnMemberVerified, same source of truth ClassmatesList.jsx
          uses. ── */}

      {/* ── CR Banner ──
          NOTE: the old "Disable CR" button here only flipped the local,
          dead `profile.isCR` flag — it never touched the server-verified
          members/{uid}.role or legacyCRClaim fields. That let people think
          they'd stepped down as CR while the server still had role: 'cr'
          (or, after a real leave via a path that predates legacyCRClaim
          cleanup, left a stale legacyCRClaim: true behind) — producing the
          "Claims CR" ghost badge on Classmates/Team pages. Routing this
          through requestLeaveCR (same CL-approved flow as ClassRoster.jsx)
          ensures role and legacyCRClaim actually get cleared together via
          clApproveLeaveCR once the CL approves.

          Two distinct exits are offered:
            - "Leave CR" fires requestLeaveCR() directly from here — no CL
              approval needed to SUBMIT the request (CL still has to
              approve it to actually vacate the slot), so this is a single
              click, no extra page.
            - "Hand over CR" is NOT a direct action — picking a specific
              successor requires seeing the class roster (handoffCR needs
              a target uid), so this navigates to /class-roster where that
              picker UI already lives, rather than duplicating it here. */}
      {isRealCR && (
        <div style={{
          padding: '13px 18px', borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.1) 100%)',
          border: '1.5px solid rgba(59,130,246,0.3)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <Crown size={22} color="var(--accent)" />
          <div style={{ flex: '1 1 auto', minWidth: 160 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Class Representative</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Class Management tools available in the sidebar.</div>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginLeft: 'auto' }}>
            <button
              onClick={() => navigate('/class-roster', { state: { intent: 'handoff' } })}
              style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Hand over CR
            </button>
            <button
              disabled={leaveCRState === 'sending' || leaveCRState === 'sent'}
              onClick={async () => {
                if (!window.confirm("Send a request to your Class Lead to step down as CR? You'll remain CR until it's approved.")) return;
                setLeaveCRState('sending');
                try {
                  const groupId = getGroupId(profile);
                  await requestLeaveCR(groupId, profile);
                  setLeaveCRState('sent');
                } catch (err) {
                  alert(`Failed: ${err?.message || err}`);
                  setLeaveCRState('idle');
                }
              }}
              style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              {leaveCRState === 'sent' ? 'Request sent ✓' : leaveCRState === 'sending' ? 'Sending…' : 'Leave CR'}
            </button>
          </div>
        </div>
      )}

      {/* Claim CR now lives in profile-col-right, next to Quick Accounts
          (desktop), plus a compact inline button next to Personal Info's
          Edit button (mobile) — see profile-two-col below. */}

      {/* ── Leave Class ──
          Plain-member-only exit (never shown to CR/ACR — they must step
          down via "Hand over CR"/"Leave CR" above first, matching the
          rules' self-leave restriction to role=='member'; a CR/ACR who
          wants out has to vacate their slot before this becomes an
          option, so a class is never left CR-less by this button).
          Deliberately understated (small text link, not a big red
          button) since this isn't a frequent action, but a real
          confirmation dialog is still required since leaveGroup() is
          immediate and re-joining afterward always needs a fresh CR
          approval — no silent auto-rejoin even if previously verified. */}
      {isOwnMember === true && !isRealCR && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            disabled={leaveClassState === 'leaving'}
            onClick={async () => {
              if (!window.confirm(
                "Leave this class? You'll lose access to class notices, roster, and shared content. " +
                'Rejoining later will require a fresh approval from the CR/ACR — being previously ' +
                'approved does not let you back in automatically.'
              )) return;
              setLeaveClassState('leaving');
              try {
                const groupId = getGroupId(profile);
                await leaveGroup(groupId);
              } catch (err) {
                alert(`Failed: ${err?.message || err}`);
              } finally {
                setLeaveClassState('idle');
              }
            }}
            style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            {leaveClassState === 'leaving' ? 'Leaving…' : 'Leave class'}
          </button>
        </div>
      )}

      {/* Admin/Staff shortcut card removed — access to Team & Administration
          is now solely via the Sidebar/BottomNav entries, which already
          only render for verified staff/Founder. See useIsStaff.js. */}


      {/* ── Stats Grid ── */}
      <div className="profile-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12 }}>
        {/* CGPA */}
        {liveData.cgpaData ? (
          <StatCard icon={<GraduationCap size={20} />} label="CGPA" value={liveData.cgpaData.cgpa} sub={cgpaLabel} color={cgpaColor} />
        ) : liveData.currentTermGPA ? (
          <StatCard icon={<BarChart3 size={20} />} label="Term GPA" value={liveData.currentTermGPA.gpa} sub={`${liveData.currentTermGPA.credits} credits`} color="#0ea5e9" />
        ) : (
          <StatCard icon={<GraduationCap size={20} />} label="CGPA" value="No data" color="var(--muted)" />
        )}

        {/* Assignments */}
        <StatCard
          icon={<CheckCircle2 size={20} />} label="Assignments"
          value={`${liveData.doneAssignments}/${liveData.totalAssignments}`}
          sub={liveData.totalAssignments > 0 ? `${Math.round((liveData.doneAssignments / liveData.totalAssignments) * 100)}% done` : null}
          color="#a855f7"
        />

        {/* Study hours */}
        <StatCard icon={<BookOpen size={20} />} label="Study Hours" value={liveData.studyHours ? `${liveData.studyHours}h` : '—'} sub="Self study logged" color="#f59e0b" />

        {/* Diary */}
        <StatCard icon={<PenLine size={20} />} label="Diary Entries" value={Array.isArray(liveData.diary) ? liveData.diary.length : 0} color="#06b6d4" />
      </div>

      {/* Quick Accounts moved into the right column below, next to
          Recent Notes — see profile-col-right. */}

      {/* ── Two-column layout below stats ──
          On mobile this collapses to one column and stacks LEFT column
          fully before RIGHT column (DOM order), which buried important
          things like Attendance under Academic/Personal Info. The
          profile-two-col / profile-col-left / profile-col-right classes
          let CSS reorder children by priority on small screens without
          touching the desktop layout at all. */}
      <div className="profile-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 20, alignItems: 'start' }}>

        {/* LEFT COLUMN */}
        <div className="profile-col-left" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Personal Info — Edit button lives here (moved off the
              minimal hero card) */}
          <Section className="ord-personal" title="Personal Info" icon={<User size={14} />} action={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isRealCR === false && hasMinProfile && (
                <div className="claim-cr-inline-mobile-only">
                  <ClaimCRInlineButton groupId={getGroupId(profile)} profile={profile} />
                </div>
              )}
              <button onClick={() => setIsModalOpen(true)} style={{
                padding: '6px 12px', background: 'var(--bg)', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 8,
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Pencil size={12} /> Edit
              </button>
            </div>
          }>
            <InfoRow label="Full Name" value={profile.name} />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <InfoRow label="Student ID" value={profile.studentId} />
            <div className="mobile-only-uid-row">
              <div style={{ height: 1, background: 'var(--border)' }} />
              <CopyMyIdRow />
            </div>
            <div style={{ height: 1, background: 'var(--border)' }} />
            <InfoRow label="Year Started" value={profile.yearStarted} />
            {profile.termStartDate && (
              <>
                <div style={{ height: 1, background: 'var(--border)' }} />
                <InfoRow label="Term Started" value={new Date(profile.termStartDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
              </>
            )}
          </Section>

          {/* Academic Info */}
          <Section className="ord-academic" title="Academic Info" icon={<BookMarked size={14} />}>
            <InfoRow label="Department" value={getDeptName(profile.dept)} />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <InfoRow label="Session" value={profile.session} />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <InfoRow label="Current Term" value={profile.currentTerm} />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <InfoRow label="Credits Req." value={profile.totalCreditsRequired} />
            {liveData.cgpaData && (
              <>
                <div style={{ height: 1, background: 'var(--border)' }} />
                <InfoRow label="Earned Credits" value={`${liveData.cgpaData.credits} / ${profile.totalCreditsRequired}`} accent />
                <ProgressBar pct={(liveData.cgpaData.credits / profile.totalCreditsRequired) * 100} color="var(--accent)" />
              </>
            )}
          </Section>

          {/* Accommodation + Advisor */}
          {(profile.hallName || profile.roomNo || profile.advisorName) && (
            <Section className="ord-hall-advisor" title="Hall & Advisor" icon={<Home size={14} />}>
              {profile.hallName && <InfoRow label="Hall" value={profile.hallName} />}
              {profile.roomNo && (
                <>
                  <div style={{ height: 1, background: 'var(--border)' }} />
                  <InfoRow label="Room No." value={profile.roomNo} />
                </>
              )}
              {profile.advisorName && (
                <>
                  <div style={{ height: 1, background: 'var(--border)' }} />
                  <InfoRow label="Advisor" value={profile.advisorName} />
                </>
              )}
              {profile.advisorContact && (
                <>
                  <div style={{ height: 1, background: 'var(--border)' }} />
                  <InfoRow label="Contact" value={profile.advisorContact} />
                </>
              )}
            </Section>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="profile-col-right" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Join-request status: not-requested / pending / declined states
              for a user who isn't an approved member of their class group
              yet. Renders nothing once they're an approved member. */}
          {hasMinProfile && <JoinStatusCard groupId={getGroupId(profile)} profile={profile} />}

          {/* Migration nudge: existing CR/ACR (appointed before mobile
              numbers were mandatory) get prompted once to add theirs. */}
          <CRMobileNumberBanner groupId={getGroupId(profile)} ownRole={ownRole} />

          {/* Claim CR — full card. Primary surface on desktop (sits next
              to Quick Accounts); on mobile it's ordered further down since
              the compact inline button next to Personal Info already
              covers the immediate action there (see ord-claim-cr below). */}
          {isRealCR === false && hasMinProfile && (
            <div className="ord-claim-cr">
              <ClaimCRCard groupId={getGroupId(profile)} profile={profile} />
            </div>
          )}

          {/* Quick Accounts — Hall & Academic system logins. Placed first
              in this column since it's the thing students reach for most.
              These are external KUET portals (not part of this app), so
              each tile opens in a new tab. Hall tile resolves from
              profile.hallName via HALL_LINKS; Academic tile is the same
              for every student. */}
          <Section className="ord-accounts" title="Quick Accounts" icon={<KeyRound size={14} />}>
            <div className="profile-accounts-grid" style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10,
            }}>
              {profile.hallName && HALL_LINKS[profile.hallName] ? (
                <AccountLinkTile
                  icon={<Home size={18} />}
                  title="Hall Account"
                  subtitle={profile.hallName}
                  href={HALL_LINKS[profile.hallName]}
                />
              ) : (
                <AccountLinkTile
                  icon={<Home size={18} />}
                  title="Hall Account"
                  disabled
                  disabledHint="Set your hall in profile"
                />
              )}
              <AccountLinkTile
                icon={<GraduationCap size={18} />}
                title="Academic Account"
                subtitle="academic.kuet.ac.bd"
                href={ACADEMIC_SYSTEM_LINK}
              />
            </div>
          </Section>

          {/* Attendance Breakdown */}
          {liveData.attData && (
            <Section className="ord-attendance" title="Attendance" icon={<Calendar size={14} />}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Ring pct={attPct} size={80} stroke={7} color={attColor} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 17, fontWeight: 900, color: attColor }}>{attPct}%</div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{liveData.attData.attended}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted)' }}>/{liveData.attData.held}</span></div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Classes attended</div>
                  {attLabel && <div style={{ marginTop: 8 }}><Badge label={attLabel} color={attColor} /></div>}
                </div>
              </div>
              <ProgressBar pct={attPct} color={attColor} height={7} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
                <span>Minimum: {MIN_ATTENDANCE_PERCENT}%</span>
                <span>Scholarship: {SCHOLARSHIP_ATTENDANCE_PCT}%</span>
              </div>
            </Section>
          )}

          {/* Upcoming Assignments */}
          {liveData.upcomingAssignments.length > 0 && (
            <Section className="ord-assignments" title="Upcoming Assignments" icon={<ClipboardList size={14} />}>
              {liveData.upcomingAssignments.map((a, i) => {
                const daysLeft = Math.ceil((new Date(a.dueDate) - new Date()) / 86400000);
                const urgent = daysLeft <= 2;
                return (
                  <div key={a.id || i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '10px 12px', borderRadius: 10,
                    background: urgent ? 'rgba(239,68,68,0.06)' : 'var(--bg)',
                    border: `1px solid ${urgent ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                      background: urgent ? '#ef4444' : '#eab308',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title || a.name}</div>
                      <div style={{ fontSize: 11, color: urgent ? '#ef4444' : 'var(--muted)', marginTop: 2 }}>
                        Due: {new Date(a.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {daysLeft === 0 ? ' · Today!' : daysLeft === 1 ? ' · Tomorrow' : ` · ${daysLeft} days`}
                      </div>
                    </div>
                  </div>
                );
              })}
              <a href="/assignments" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}
                onMouseEnter={e => e.currentTarget.style.gap = '8px'}
                onMouseLeave={e => e.currentTarget.style.gap = '4px'}>
                All Assignments →
              </a>
            </Section>
          )}

          {/* Recent Notes */}
          {liveData.recentNotes.length > 0 && (
            <Section className="ord-notes" title="Recent Notes" icon={<StickyNote size={14} />}>
              {liveData.recentNotes.map((n, i) => (
                <div key={n.id || i} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 9, borderLeft: '3px solid var(--accent2)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title || 'Untitled'}</div>
                  {n.content && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.content}</div>}
                </div>
              ))}
              <a href="/notes" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>All Notes →</a>
            </Section>
          )}

          {/* ── Today's Focus (standalone — no profile.currentTermKey dependency) ── */}
          {(() => {
            const PRAYERS_LIST = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
            const PRAYER_AR = { Fajr: 'Fajr', Dhuhr: 'Dhuhr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Isha' };
            const PRAYER_ICON = {
              Fajr: <Sunrise size={14} />,
              Dhuhr: <Sun size={14} />,
              Asr: <CloudSun size={14} />,
              Maghrib: <Sunset size={14} />,
              Isha: <Moon size={14} />,
            };

            // Re-read namaz from store directly so it's always fresh (namazTick triggers useMemo)
            const freshNamaz = store.get('namaz') || {};
            const todayKey = new Date().toISOString().split('T')[0];
            const todayNamazFresh = freshNamaz[todayKey] || {};
            const namazStatus = PRAYERS_LIST.map(p => ({
              done: !!todayNamazFresh[p]?.done,
              masjid: !!todayNamazFresh[p]?.masjid,
            }));
            const namazCount = namazStatus.filter(s => s.done).length;

            // Quran / Islamic bani — hourly shuffle, click to advance
            const QURAN_BANIS = [
              { text: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا', ref: 'Surah At-Talaq 65:2', bn: 'যে ব্যক্তি আল্লাহকে ভয় করে, আল্লাহ তার জন্য উত্তরণের পথ করে দেন।' },
              { text: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', ref: 'Surah Ash-Sharh 94:6', bn: 'নিশ্চয়ই কষ্টের সাথে স্বস্তি আছে।' },
              { text: 'وَقُل رَّبِّ زِدْنِي عِلْمًا', ref: 'Surah Taha 20:114', bn: 'বলো, হে আমার প্রতিপালক, আমার জ্ঞান বৃদ্ধি করে দাও।' },
              { text: 'فَاذْكُرُونِي أَذْكُرْكُمْ', ref: 'Surah Al-Baqarah 2:152', bn: 'তোমরা আমাকে স্মরণ করো, আমিও তোমাদের স্মরণ করব।' },
              { text: 'إِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ', ref: 'Surah At-Tawbah 9:120', bn: 'নিশ্চয়ই আল্লাহ সৎকর্মশীলদের প্রতিদান নষ্ট করেন না।' },
              { text: 'وَتَوَكَّلْ عَلَى اللَّهِ ۚ وَكَفَىٰ بِاللَّهِ وَكِيلًا', ref: 'Surah An-Nisa 4:81', bn: 'আল্লাহর উপর ভরসা করো, কার্যনির্বাহী হিসেবে আল্লাহই যথেষ্ট।' },
              { text: 'اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ', ref: 'Surah Al-Alaq 96:1', bn: 'পড়ো তোমার প্রতিপালকের নামে, যিনি সৃষ্টি করেছেন।' },
              { text: 'وَأَن لَّيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَىٰ', ref: 'Surah An-Najm 53:39', bn: 'মানুষ তা-ই পায়, যার জন্য সে চেষ্টা করে।' },
              { text: 'يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ', ref: 'Surah Al-Mujadila 58:11', bn: 'তোমাদের মধ্যে যারা ঈমান এনেছে এবং যাদের জ্ঞান দেওয়া হয়েছে, আল্লাহ তাদের মর্যাদা উঁচু করে দেন।' },
              { text: 'وَبَشِّرِ الصَّابِرِينَ', ref: 'Surah Al-Baqarah 2:155', bn: 'ধৈর্যশীলদের সুসংবাদ দাও।' },
              { text: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ', ref: 'Surah Aal-E-Imran 3:173', bn: 'আল্লাহই আমাদের জন্য যথেষ্ট, তিনিই উত্তম কার্যনির্বাহী।' },
              { text: 'وَعَسَىٰ أَن تَكْرَهُوا شَيْئًا وَهُوَ خَيْرٌ لَّكُمْ', ref: 'Surah Al-Baqarah 2:216', bn: 'হতে পারে তোমরা কোনো কিছু অপছন্দ করছ, অথচ তা তোমাদের জন্য কল্যাণকর।' },
              { text: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', ref: 'Surah Al-Baqarah 2:153', bn: 'নিশ্চয়ই আল্লাহ ধৈর্যশীলদের সাথে আছেন।' },
              { text: 'فَإِذَا فَرَغْتَ فَانصَبْ', ref: 'Surah Ash-Sharh 94:7', bn: 'যখন তুমি অবসর পাও, তখন পরিশ্রমে মনোনিবেশ করো।' },
              { text: 'وَاللَّهُ يُحِبُّ الْمُحْسِنِينَ', ref: 'Surah Aal-E-Imran 3:134', bn: 'আল্লাহ সৎকর্মশীলদের ভালোবাসেন।' },
              { text: 'إِنَّ اللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّىٰ يُغَيِّرُوا مَا بِأَنفُسِهِمْ', ref: "Surah Ar-Ra'd 13:11", bn: 'নিশ্চয়ই আল্লাহ কোনো জাতির অবস্থা পরিবর্তন করেন না, যতক্ষণ না তারা নিজেদের অবস্থা পরিবর্তন করে।' },
              { text: 'وَقَالَ رَبُّكُمُ ادْعُونِي أَسْتَجِبْ لَكُمْ', ref: 'Surah Ghafir 40:60', bn: 'তোমাদের প্রতিপালক বলেছেন, তোমরা আমাকে ডাকো, আমি সাড়া দেব।' },
              { text: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ', ref: 'Surah At-Talaq 65:3', bn: 'যে আল্লাহর উপর ভরসা করে, তার জন্য আল্লাহই যথেষ্ট।' },
              { text: 'وَلَا تَهِنُوا وَلَا تَحْزَنُوا وَأَنتُمُ الْأَعْلَوْنَ', ref: 'Surah Aal-E-Imran 3:139', bn: 'হতোদ্যম হয়ো না এবং দুঃখ কোরো না, তোমরাই বিজয়ী হবে।' },
              { text: 'سَنُرِيهِمْ آيَاتِنَا فِي الْآفَاقِ وَفِي أَنفُسِهِمْ', ref: 'Surah Fussilat 41:53', bn: 'আমি শীঘ্রই তাদের আমার নিদর্শন দেখাব দিগন্তে এবং তাদের নিজেদের মধ্যে।' },
              { text: 'وَفَوْقَ كُلِّ ذِي عِلْمٍ عَلِيمٌ', ref: 'Surah Yusuf 12:76', bn: 'প্রত্যেক জ্ঞানীর উপরে আরেক জ্ঞানী রয়েছেন।' },
              { text: 'وَمَا أُوتِيتُم مِّنَ الْعِلْمِ إِلَّا قَلِيلًا', ref: 'Surah Al-Isra 17:85', bn: 'তোমাদের সামান্য জ্ঞানই দেওয়া হয়েছে।' },
              { text: 'يُؤْتِي الْحِكْمَةَ مَن يَشَاءُ ۚ وَمَن يُؤْتَ الْحِكْمَةَ فَقَدْ أُوتِيَ خَيْرًا كَثِيرًا', ref: 'Surah Al-Baqarah 2:269', bn: 'তিনি যাকে ইচ্ছা প্রজ্ঞা দান করেন, আর যাকে প্রজ্ঞা দেওয়া হয়, তাকে যেন প্রচুর কল্যাণ দেওয়া হলো।' },
              { text: 'أَفَلَا يَتَدَبَّرُونَ الْقُرْآنَ', ref: 'Surah An-Nisa 4:82', bn: 'তারা কি কুরআন নিয়ে গভীরভাবে চিন্তা করে না?' },
              { text: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْأَخِرَةِ حَسَنَةً', ref: 'Surah Al-Baqarah 2:201', bn: 'হে আমাদের প্রতিপালক, আমাদের দুনিয়াতে কল্যাণ দাও এবং আখিরাতেও কল্যাণ দাও।' },
              { text: 'إِنَّمَا يَخْشَى اللَّهَ مِنْ عِبَادِهِ الْعُلَمَاءُ', ref: 'Surah Fatir 35:28', bn: 'তাঁর বান্দাদের মধ্যে শুধু জ্ঞানীরাই আল্লাহকে সত্যিকারভাবে ভয় করে।' },
              { text: 'وَاصْبِرْ وَمَا صَبْرُكَ إِلَّا بِاللَّهِ', ref: 'Surah An-Nahl 16:127', bn: 'ধৈর্য ধরো, আর তোমার ধৈর্য কেবল আল্লাহরই মাধ্যমে সম্ভব।' },
              { text: 'وَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُ', ref: 'Surah Az-Zalzalah 99:7', bn: 'যে অণু পরিমাণ সৎকাজ করবে, সে তা দেখতে পাবে।' },
              { text: 'خُذِ الْعَفْوَ وَأْمُرْ بِالْعُرْفِ وَأَعْرِضْ عَنِ الْجَاهِلِينَ', ref: "Surah Al-A'raf 7:199", bn: 'ক্ষমাশীলতা অবলম্বন করো, সৎকাজের নির্দেশ দাও এবং অজ্ঞদের থেকে মুখ ফিরিয়ে নাও।' },
              { text: 'وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ', ref: 'Surah Yusuf 12:87', bn: 'আল্লাহর রহমত থেকে নিরাশ হয়ো না।' },
              { text: 'وَاللَّهُ خَيْرُ الرَّازِقِينَ', ref: "Surah Al-Jumu'ah 62:11", bn: 'আল্লাহই উত্তম রিযিকদাতা।' },
              { text: 'هُوَ الَّذِي جَعَلَ لَكُمُ الْأَرْضَ ذَلُولًا فَامْشُوا فِي مَنَاكِبِهَا', ref: 'Surah Al-Mulk 67:15', bn: 'তিনিই পৃথিবীকে তোমাদের জন্য সহজবোধ্য করে দিয়েছেন, তাই তোমরা এর পথে বিচরণ করো।' },
              { text: 'إِنَّ مَعَ الصَّبْرِ النَّصْرَ وَمَعَ الْكَرْبِ الْفَرَجَ', ref: 'Hadith — Tirmidhi', bn: 'নিশ্চয়ই ধৈর্যের সাথে সাহায্য আসে এবং কষ্টের সাথে স্বস্তি আসে।' },
            ];
            const bani = QURAN_BANIS[reminderTick % QURAN_BANIS.length];

            return (
              <>
                {/* Today's Focus */}
                <Section className="ord-focus" title="Today's Focus" icon={<Target size={14} />}>
                  {/* ── Namaz tracker ── */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Landmark size={12} /> Salah - Today
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                      {PRAYERS_LIST.map((p, i) => {
                        const s = namazStatus[i];
                        const bgColor = s.masjid ? 'var(--accent)' : s.done ? '#16a34a' : 'var(--border)';
                        const textColor = (s.done || s.masjid) ? '#fff' : 'var(--muted)';
                        return (
                          <div key={p} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1 }}>
                            <div style={{
                              width: '100%', aspectRatio: '1', borderRadius: 10,
                              background: bgColor,
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                              gap: 2,
                              transition: 'all 0.2s',
                              boxShadow: (s.done || s.masjid) ? `0 2px 8px ${bgColor}60` : 'none',
                              minWidth: 40, maxWidth: 56,
                            }}>
                              <span style={{ display: 'inline-flex' }}>{PRAYER_ICON[p]}</span>
                              {s.masjid && <span style={{ fontSize: 8, color: '#fff', fontWeight: 700, letterSpacing: 0.3 }}>Mosque</span>}
                              {s.done && !s.masjid && <Check size={11} color={textColor} strokeWidth={3} />}
                            </div>
                            <span style={{ fontSize: 9, color: (s.done || s.masjid) ? 'var(--accent)' : 'var(--muted)', fontWeight: 700 }}>
                              {PRAYER_AR[p]}
                            </span>
                          </div>
                        );
                      })}
                      <div style={{ marginLeft: 8, textAlign: 'right', paddingBottom: 18 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: namazCount === 5 ? '#16a34a' : 'var(--accent)', lineHeight: 1 }}>
                          {namazCount}<span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>/5</span>
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                          {namazCount === 5 ? <><CheckCircle2 size={10} color="#16a34a" /> Complete</> : `${5 - namazCount} left`}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 1, background: 'var(--border)' }} />

                  {/* ── Study streak ── */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                      <BookOpen size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                        {liveData.studyStreak > 0
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{liveData.studyStreak} day{liveData.studyStreak > 1 ? 's' : ''} <Flame size={13} color="#f59e0b" /></span>
                          : <span style={{ color: 'var(--muted)', fontWeight: 600 }}>—</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        Study streak · {liveData.studyHours > 0 ? `${liveData.studyHours.toFixed(1)}h logged` : 'No sessions yet'}
                      </div>
                    </div>
                    {liveData.studyHours > 0 && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#f59e0b' }}>{liveData.studyHours.toFixed(1)}h</div>
                        <div style={{ fontSize: 9, color: 'var(--muted)' }}>total</div>
                      </div>
                    )}
                  </div>

                  <div style={{ height: 1, background: 'var(--border)' }} />

                  {/* ── Quran Daily Reminder (hourly shuffle, click to advance) ── */}
                  <div
                    onClick={advanceReminder}
                    style={{
                      padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                      background: 'color-mix(in srgb, var(--accent) 6%, var(--bg))',
                      border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                      transition: 'opacity 0.15s',
                      userSelect: 'none',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><BookOpenText size={11} /> Quran verse</span>
                      <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, letterSpacing: 0 }}>tap for next ›</span>
                    </div>
                    <div style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.7, fontFamily: '"Amiri", serif', textAlign: 'right', direction: 'rtl', marginBottom: 6 }}>
                      {bani.text}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.55, fontStyle: 'italic', marginBottom: 4 }}>
                      "{bani.bn}"
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{bani.ref}</div>
                  </div>
                </Section>
              </>
            );
          })()}

        </div>
      </div>

      {/* ── Legacy Term Results ── */}
      {liveData.legacyTerms.length > 0 && (
        <Section title="Term Results History" icon={<BarChart3 size={14} />}>
          <div className="profile-terms-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
            {liveData.legacyTerms.map((t, i) => {
              const gpa = parseFloat(t.gpa);
              const col = gpa >= 3.75 ? '#16a34a' : gpa >= 3.0 ? '#0ea5e9' : gpa >= 2.2 ? '#f59e0b' : '#ef4444';
              return (
                <div key={i} style={{
                  padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${col}30`,
                  background: `${col}08`, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.termKey}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: col, marginTop: 4 }}>{gpa.toFixed(2)}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{t.credits} cr</div>
                </div>
              );
            })}
          </div>
          {liveData.cgpaData && (
            <div style={{
              padding: '12px 18px', borderRadius: 10, marginTop: 4,
              background: `${cgpaColor}10`, border: `1.5px solid ${cgpaColor}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Overall CGPA</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: cgpaColor }}>{liveData.cgpaData.cgpa}</span>
                {cgpaLabel && <Badge label={cgpaLabel} color={cgpaColor} />}
              </div>
            </div>
          )}
          <a href="/results" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            Full Results & GPA →
          </a>
        </Section>
      )}

      {/* "Simulate CR Mode" toggle removed — CR access is now decided
          entirely by the server-verified role (members/{uid}.role via
          RequireCR / isRealCR), so flipping profile.isCR here no longer
          unlocks anything and was only confusing people into thinking
          they had CR tools when they didn't. */}

      {/* Modals */}
      <ProfileSetupModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} initialProfile={profile} />
      {showAuthModal && (
        <AuthModal mode="login" isUpgrade={!!firebaseUser?.isAnonymous} onClose={() => setShowAuthModal(false)} onSuccess={handleAuthSuccess} />
      )}
      {showAvatarModal && (
        <AvatarUploadModal
          currentURL={photoURL}
          isAnon={!firebaseUser || firebaseUser.isAnonymous}
          onClose={() => setShowAvatarModal(false)}
          onUploaded={url => setPhotoURL(url)}
          onDeleted={() => setPhotoURL(null)}
        />
      )}
    </div>
  );
}