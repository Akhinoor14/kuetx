/**
 * Profile.jsx — KUETx Full Profile Dashboard
 * Pulls live data from all major pages for a complete student overview.
 * Fully responsive: mobile-first, desktop-enhanced.
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as Icons from 'lucide-react';
import {
  store, getProfile, DEFAULT_PROFILE, DEPARTMENTS,
  getLegacyTermResults, TERM_KEYS, MIN_ATTENDANCE_PERCENT,
  SCHOLARSHIP_ATTENDANCE_PCT, HONORS_CGPA, MIN_CGPA_GRADUATION,
  computeCGPA,
} from '../store/store';
import { getAllCourses } from '../store/curriculumStore';
import ProfileSetupModal from '../components/ProfileSetupModal';
import AuthModal from '../components/AuthModal';
import { onAuthChange, logout } from '../lib/firebaseAuth';
import { pushAllToFirestore, startFirebaseSync } from '../lib/firebaseSync';
import { uploadProfilePicture, getProfilePhotoURL, deleteProfilePicture } from '../lib/profilePicture';


// ─── Helpers ─────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split('T')[0];

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
      <div style={{ width: 44, height: 44, borderRadius: 11, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
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
  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, alignItems: 'flex-start' }}>
    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, paddingTop: 1 }}>{label}</span>
    <span style={{ fontSize: 14, color: accent ? 'var(--accent)' : 'var(--text)', fontWeight: accent ? 700 : 500, wordBreak: 'break-word' }}>{value || '—'}</span>
  </div>
);

const Section = ({ title, icon, children }) => (
  <div style={{
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
    overflow: 'hidden', transition: 'border-color 0.2s, box-shadow 0.2s',
  }}
  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.07)'; }}
  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = ''; }}>
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 3, height: 16, borderRadius: 2, background: 'linear-gradient(var(--accent), var(--accent2))' }} />
      <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text)' }}>{icon} {title}</span>
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
      <span style={{ fontSize: 22 }}>{anon ? '🔓' : '🔐'}</span>
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

// ─── Avatar Upload Modal (local-first + drag-to-reposition) ──────────────────

function AvatarUploadModal({ currentURL, isAnon, onClose, onUploaded, onDeleted }) {
  const [preview, setPreview] = useState(null);   // raw objectURL for drag canvas
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef();

  // Drag-to-reposition state
  const [offset, setOffset] = useState({ x: 0, y: 0 });        // pixel offset in original image coords
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);   // { mouseX, mouseY, offsetX, offsetY }
  const imgNatural = useRef({ w: 1, h: 1 });  // natural image dimensions
  const PREVIEW_PX = 200;  // preview circle diameter px

  const handleFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Only image files allowed'); return; }
    if (f.size > 1 * 1024 * 1024) { setError('Max 1 MB'); return; }
    setError('');
    setFile(f);
    setOffset({ x: 0, y: 0 });
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { imgNatural.current = { w: img.naturalWidth, h: img.naturalHeight }; };
    img.src = url;
    setPreview(url);
  };

  const handleDrop = (e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); };

  // Mouse drag handlers on the preview circle
  const onMouseDown = (e) => {
    if (!preview || !file) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, offsetX: offset.x, offsetY: offset.y };
  };
  const onMouseMove = (e) => {
    if (!dragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.mouseX;
    const dy = e.clientY - dragStart.current.mouseY;
    // Scale mouse pixels → image pixels
    const { w, h } = imgNatural.current;
    const size = Math.min(w, h);
    const scale = size / PREVIEW_PX;
    setOffset({ x: dragStart.current.offsetX - dx * scale, y: dragStart.current.offsetY - dy * scale });
  };
  const onMouseUp = () => { setDragging(false); dragStart.current = null; };

  // Touch support
  const onTouchStart = (e) => {
    if (!preview || !file) return;
    const t = e.touches[0];
    setDragging(true);
    dragStart.current = { mouseX: t.clientX, mouseY: t.clientY, offsetX: offset.x, offsetY: offset.y };
  };
  const onTouchMove = (e) => {
    if (!dragging || !dragStart.current) return;
    e.preventDefault();
    const t = e.touches[0];
    const dx = t.clientX - dragStart.current.mouseX;
    const dy = t.clientY - dragStart.current.mouseY;
    const { w, h } = imgNatural.current;
    const size = Math.min(w, h);
    const scale = size / PREVIEW_PX;
    setOffset({ x: dragStart.current.offsetX - dx * scale, y: dragStart.current.offsetY - dy * scale });
  };
  const onTouchEnd = () => { setDragging(false); dragStart.current = null; };

  // Compute background-position for the CSS preview (% based)
  const bgPosition = () => {
    if (!preview) return 'center center';
    const { w, h } = imgNatural.current;
    const size = Math.min(w, h);
    // center offset in original image pixels, clamped
    const maxOff = (Math.max(w, h) - size) / 2;
    const cx = Math.max(-maxOff, Math.min(maxOff, offset.x));
    const cy = Math.max(-maxOff, Math.min(maxOff, offset.y));
    // convert to % for background-position
    const px = w > size ? 50 + (cx / (w - size)) * 100 : 50;
    const py = h > size ? 50 + (cy / (h - size)) * 100 : 50;
    return `${px.toFixed(1)}% ${py.toFixed(1)}%`;
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setError('');
    try {
      const url = await uploadProfilePicture(file, setProgress, offset.x, offset.y);
      onUploaded(url);
      onClose();
    } catch (e) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Profile picture মুছে ফেলবে?')) return;
    try { await deleteProfilePicture(); onDeleted(); onClose(); } catch {}
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
      onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Profile Picture</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><Icons.X size={18} /></button>
        </div>

        {/* Info banner */}
        <div style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
          <Icons.HardDrive size={13} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Photo এই device-এ সেভ হবে (offline)।{!isAnon ? ' Firebase-এও backup হবে।' : ' Sign in করলে সব device-এ sync হবে।'}</span>
        </div>

        {/* Drop zone (only when no file) */}
        {!file && (
          <div
            onDrop={handleDrop} onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '28px 20px', border: '2px dashed var(--border)', borderRadius: 16, cursor: 'pointer', background: 'var(--inputBg)', transition: 'border-color 0.15s, background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accentSoft)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--inputBg)'; }}
          >
            {currentURL
              ? <img src={currentURL} alt="Current" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)' }} />
              : <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.Camera size={32} color="white" /></div>
            }
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Click or drag & drop</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>JPG, PNG, WebP · Max 1 MB</div>
            </div>
          </div>
        )}

        {/* Drag-to-reposition preview (shown when file selected) */}
        {file && preview && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            {/* Circle preview — draggable */}
            <div
              onMouseDown={onMouseDown}
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
              style={{
                width: PREVIEW_PX, height: PREVIEW_PX, borderRadius: '50%',
                border: '3px solid var(--accent)',
                boxShadow: '0 4px 20px rgba(22,163,74,0.25)',
                cursor: dragging ? 'grabbing' : 'grab',
                overflow: 'hidden',
                backgroundImage: `url(${preview})`,
                backgroundSize: 'cover',
                backgroundPosition: bgPosition(),
                backgroundRepeat: 'no-repeat',
                userSelect: 'none', WebkitUserSelect: 'none',
                flexShrink: 0,
                touchAction: 'none',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
              <Icons.Move size={13} />
              Drag to reposition
            </div>
            {/* Change photo button */}
            <button onClick={() => { setFile(null); setPreview(null); setOffset({ x: 0, y: 0 }); inputRef.current?.click(); }}
              style={{ fontSize: 12, color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
              Choose different photo
            </button>
          </div>
        )}

        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />

        {/* Progress */}
        {uploading && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 5 }}>
              <span>Saving…</span><span>{progress}%</span>
            </div>
            <div style={{ background: 'var(--border)', borderRadius: 99, height: 5 }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', borderRadius: 99, transition: 'width 0.25s' }} />
            </div>
          </div>
        )}

        {error && <div style={{ fontSize: 13, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>{error}</div>}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          {currentURL && (
            <button onClick={handleDelete} style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Remove
            </button>
          )}
          <button onClick={handleUpload} disabled={!file || uploading}
            style={{ flex: 1, padding: '10px 16px', borderRadius: 9, border: 'none', background: file && !uploading ? 'var(--accent)' : 'var(--border)', color: file && !uploading ? '#fff' : 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: file && !uploading ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
            {uploading ? 'Saving…' : 'Save Photo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Profile() {
  const [profile, setProfile] = useState(getProfile() || DEFAULT_PROFILE);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [photoURL, setPhotoURL] = useState(null);
  const autoOpenedRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthChange(async u => {
      setFirebaseUser(u);
      if (u) {
        const url = await getProfilePhotoURL();
        setPhotoURL(url);
      }
    });
    return unsub;
  }, []);

  const getDeptName = code => (DEPARTMENTS.find(d => d.code === code)?.name || code);
  const hasMinProfile = !!(profile?.name && profile?.studentId && profile?.dept && profile?.session && profile?.currentTermKey);

  useEffect(() => {
    if (!hasMinProfile && !autoOpenedRef.current) {
      setIsModalOpen(true);
      autoOpenedRef.current = true;
    }
  }, [hasMinProfile]);

  const handleSave = formData => {
    const next = { ...DEFAULT_PROFILE, ...formData };
    store.set('profile', next);
    setProfile(next);
    setIsModalOpen(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleLogout = async () => {
    if (!confirm('Sign out করবে? Local data ঠিকই থাকবে।')) return;
    try { await logout(); } catch {}
  };

  // Called when user logs in from Profile page — push local data up then start sync
  const handleAuthSuccess = async (user) => {
    setShowAuthModal(false);
    if (user && !user.isAnonymous) {
      try {
        await pushAllToFirestore(user.uid);
        await startFirebaseSync(user.uid, {});
      } catch (err) {
        console.warn('[KUETx Profile] Post-login sync failed:', err.message);
      }
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
    const selfEval = store.get('selfeval') || {};
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

    // Today's self-eval rating
    const todayEval = selfEval[today];

    // Notes & Diary  
    const recentNotes = (Array.isArray(notes) ? notes : []).slice(0, 3);
    const recentDiary = (Array.isArray(diary) ? diary : []).slice(0, 3);

    // Study sessions
    const studySessions = store.get('selfstudy_academic') || [];
    const studyHours = (Array.isArray(studySessions) ? studySessions : [])
      .reduce((s, ss) => s + Number(ss.hours || 0), 0);

    // Self eval streak
    const evalDays = Object.keys(selfEval).sort().reverse();
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 30; i++) {
      const key = d.toISOString().split('T')[0];
      if (selfEval[key]) { streak++; d.setDate(d.getDate() - 1); } else break;
    }

    return {
      attData, upcomingAssignments, doneAssignments, totalAssignments,
      monthExpense, monthIncome, cashBalance, budget,
      cgpaData, currentTermGPA, currentTermCourses,
      todayEval, recentNotes, recentDiary, studyHours,
      streak, legacyTerms, diary, notes, marks, courses,
    };
  }, [profile]);

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
    : cgpa >= HONORS_CGPA ? 'With Honors 🏅'
    : cgpa >= MIN_CGPA_GRADUATION ? 'Good Standing'
    : 'Below Minimum';

  if (!hasMinProfile) {
    return (
      <div className="page-enter page-container">
        <AccountBanner user={firebaseUser} onLogin={() => setShowAuthModal(true)} onLogout={handleLogout} />
        <div style={{ height: 24 }} />
        <div style={{
          background: 'linear-gradient(135deg, #16a34a 0%, #0ea5e9 60%, #a3e635 100%)',
          borderRadius: 20, padding: 'clamp(48px,10vw,100px) clamp(20px,5vw,56px)',
          textAlign: 'center', position: 'relative', overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(22,163,74,0.28)',
        }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ fontSize: 'clamp(80px,18vw,120px)', marginBottom: 20, display: 'inline-block', animation: 'profileFloat 6s ease-in-out infinite' }}>🐢</div>
            <h2 style={{ fontSize: 'clamp(26px,7vw,46px)', fontWeight: 950, margin: '0 0 10px', color: 'white', letterSpacing: '-0.03em' }}>Welcome to KUETx</h2>
            <p style={{ fontSize: 'clamp(13px,3vw,16px)', color: 'rgba(255,255,255,0.9)', margin: '0 0 32px', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.7 }}>
              Set up your profile for personalized GPA tracking, attendance insights, and more.
            </p>
            <button onClick={() => setIsModalOpen(true)} style={{
              padding: '13px 38px', background: 'rgba(255,255,255,0.95)', color: '#16a34a',
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
    <div className="page-enter page-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Account Banner ── */}
      <AccountBanner user={firebaseUser} onLogin={() => setShowAuthModal(true)} onLogout={handleLogout} />

      {/* ── Save toast ── */}
      {saved && (
        <div style={{
          padding: '12px 18px', borderRadius: 10, background: '#dcfce7', color: '#166534',
          fontSize: 14, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600,
        }}>✓ Profile updated!</div>
      )}

      {/* ── Hero: Avatar + Name + Edit ── */}
      <div className="hero-bg" style={{
        borderRadius: 20, padding: 'clamp(20px,4vw,32px) clamp(20px,4vw,32px)',
        display: 'flex', alignItems: 'center', gap: 'clamp(14px,3vw,24px)',
        boxShadow: '0 8px 32px rgba(22,163,74,0.18)', flexWrap: 'wrap',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative orb */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />

        {/* Avatar — clickable to upload */}
        <div
          onClick={() => setShowAvatarModal(true)}
          title="Click to change profile picture"
          style={{
            width: 'clamp(64px,12vw,88px)', height: 'clamp(64px,12vw,88px)', borderRadius: '50%',
            background: photoURL ? 'transparent' : 'rgba(255,255,255,0.25)',
            border: '3px solid rgba(255,255,255,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'clamp(26px,6vw,40px)', fontWeight: 900, color: 'white',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)', flexShrink: 0,
            cursor: 'pointer', overflow: 'hidden', position: 'relative',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'; }}
        >
          {photoURL
            ? <img src={photoURL} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>{profile.name ? profile.name.trim().charAt(0).toUpperCase() : '🎓'}</span>
          }
          {/* Camera overlay on hover */}
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: 'opacity 0.2s', borderRadius: '50%',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
            <Icons.Camera size={20} color="white" />
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <div style={{ fontSize: 'clamp(18px,4vw,26px)', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.2, fontFamily: "'Space Grotesk', 'Sora', 'Hind Siliguri', system-ui, sans-serif" }}>
              {profile.name}
            </div>
            {profile.isCR && <Badge label="👑 CR" color="#fff" bg="rgba(255,255,255,0.2)" />}
          </div>
          <div style={{ fontSize: 'clamp(12px,2.5vw,14px)', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, fontFamily: "'Space Grotesk', 'Sora', 'Hind Siliguri', system-ui, sans-serif" }}>
            {profile.studentId && <span>{profile.studentId}</span>}
            {profile.dept && <span> · {getDeptName(profile.dept)}</span>}
          </div>
          <div style={{ fontSize: 'clamp(11px,2vw,13px)', color: 'rgba(255,255,255,0.7)', marginTop: 2, fontFamily: "'Space Grotesk', 'Sora', 'Hind Siliguri', system-ui, sans-serif" }}>
            {profile.session && <span>Session: {profile.session}</span>}
            {profile.currentTerm && <span> · {profile.currentTerm}</span>}
          </div>
        </div>

        {/* Edit button */}
        <button onClick={() => setIsModalOpen(true)} style={{
          padding: 'clamp(8px,2vw,11px) clamp(14px,3vw,20px)',
          background: 'rgba(255,255,255,0.15)', color: 'white',
          border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: 10,
          fontSize: 13, fontWeight: 700, cursor: 'pointer',
          transition: 'background 0.2s', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 7,
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
          <Icons.Pencil size={13} /> Edit
        </button>
      </div>

      {/* ── CR Banner ── */}
      {profile.isCR && (
        <div style={{
          padding: '13px 18px', borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.1) 100%)',
          border: '1.5px solid rgba(59,130,246,0.3)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>👑</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Class Representative</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Class Management tools available in the sidebar.</div>
          </div>
          <button onClick={() => {
            const next = { ...profile, isCR: false };
            store.set('profile', next); setProfile(next);
          }} style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Disable CR
          </button>
        </div>
      )}

      {/* ── Stats Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12 }}>
        {/* CGPA */}
        {liveData.cgpaData ? (
          <StatCard icon="🎓" label="CGPA" value={liveData.cgpaData.cgpa} sub={cgpaLabel} color={cgpaColor} />
        ) : liveData.currentTermGPA ? (
          <StatCard icon="📊" label="Term GPA" value={liveData.currentTermGPA.gpa} sub={`${liveData.currentTermGPA.credits} credits`} color="#0ea5e9" />
        ) : (
          <StatCard icon="🎓" label="CGPA" value="No data" color="var(--muted)" />
        )}

        {/* Assignments */}
        <StatCard
          icon="✅" label="Assignments"
          value={`${liveData.doneAssignments}/${liveData.totalAssignments}`}
          sub={liveData.totalAssignments > 0 ? `${Math.round((liveData.doneAssignments / liveData.totalAssignments) * 100)}% done` : null}
          color="#a855f7"
        />

        {/* Study hours */}
        <StatCard icon="📖" label="Study Hours" value={liveData.studyHours ? `${liveData.studyHours}h` : '—'} sub="Self study logged" color="#f59e0b" />

        {/* Diary */}
        <StatCard icon="✍️" label="Diary Entries" value={Array.isArray(liveData.diary) ? liveData.diary.length : 0} color="#06b6d4" />

        {/* Eval streak */}
        <StatCard icon="🔥" label="Eval Streak" value={liveData.streak > 0 ? `${liveData.streak}d` : '—'} sub="Daily self-eval" color="#ef4444" />
      </div>

      {/* ── Two-column layout below stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 20, alignItems: 'start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Academic Info */}
          <Section title="Academic Info" icon="📚">
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

          {/* Personal Info */}
          <Section title="Personal Info" icon="👤">
            <InfoRow label="Full Name" value={profile.name} />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <InfoRow label="Student ID" value={profile.studentId} />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <InfoRow label="Year Started" value={profile.yearStarted} />
            {profile.termStartDate && (
              <>
                <div style={{ height: 1, background: 'var(--border)' }} />
                <InfoRow label="Term Started" value={new Date(profile.termStartDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
              </>
            )}
          </Section>

          {/* Accommodation + Advisor */}
          {(profile.hallName || profile.roomNo || profile.advisorName) && (
            <Section title="Hall & Advisor" icon="🏠">
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Attendance Breakdown */}
          {liveData.attData && (
            <Section title="Attendance" icon="📅">
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
            <Section title="Upcoming Assignments" icon="📝">
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
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{urgent ? '🔴' : '🟡'}</span>
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

          {/* Money Summary */}
          {(liveData.monthExpense > 0 || liveData.cashBalance > 0) && (
            <Section title="Money This Month" icon="💰">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Income</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981', marginTop: 4 }}>৳{liveData.monthIncome.toLocaleString()}</div>
                </div>
                <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Expense</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444', marginTop: 4 }}>৳{liveData.monthExpense.toLocaleString()}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Cash Balance</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: liveData.cashBalance >= 0 ? '#10b981' : '#ef4444' }}>৳{Number(liveData.cashBalance).toLocaleString()}</span>
              </div>
              {liveData.budget > 0 && (
                <>
                  <ProgressBar pct={(liveData.monthExpense / liveData.budget) * 100} color={liveData.monthExpense > liveData.budget ? '#ef4444' : '#f59e0b'} />
                  <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>৳{liveData.monthExpense.toLocaleString()} / ৳{liveData.budget.toLocaleString()} budget</div>
                </>
              )}
              <a href="/money" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                onMouseEnter={e => e.currentTarget.style.gap = '8px'}
                onMouseLeave={e => e.currentTarget.style.gap = '4px'}>
                View Money Tracker →
              </a>
            </Section>
          )}

          {/* Today's Self-Eval */}
          {liveData.todayEval && (
            <Section title="Today's Self Eval" icon="🌟">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 36 }}>
                  {['', '😞', '😕', '😐', '😊', '🤩'][liveData.todayEval.rating || 3]}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                    {['', 'খুব খারাপ', 'খারাপ', 'ঠিক আছে', 'ভালো', 'অসাধারণ'][liveData.todayEval.rating || 3]}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {liveData.streak > 0 && `🔥 ${liveData.streak} day streak`}
                  </div>
                </div>
              </div>
              {liveData.todayEval.note && (
                <div style={{ fontSize: 13, color: 'var(--text)', background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', fontStyle: 'italic', borderLeft: '3px solid var(--accent)' }}>
                  "{liveData.todayEval.note}"
                </div>
              )}
            </Section>
          )}

          {/* Recent Notes */}
          {liveData.recentNotes.length > 0 && (
            <Section title="Recent Notes" icon="📌">
              {liveData.recentNotes.map((n, i) => (
                <div key={n.id || i} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 9, borderLeft: '3px solid var(--accent2)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title || 'Untitled'}</div>
                  {n.content && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.content}</div>}
                </div>
              ))}
              <a href="/notes" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>All Notes →</a>
            </Section>
          )}
        </div>
      </div>

      {/* ── Legacy Term Results ── */}
      {liveData.legacyTerms.length > 0 && (
        <Section title="Term Results History" icon="📊">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
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

      {/* ── Quick Links ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
        {[
          { href: '/attendance', icon: '📅', label: 'Attendance' },
          { href: '/marks', icon: '📝', label: 'Marks' },
          { href: '/results', icon: '🎓', label: 'Results' },
          { href: '/assignments', icon: '✅', label: 'Assignments' },
          { href: '/diary', icon: '📖', label: 'Diary' },
          { href: '/money', icon: '💰', label: 'Money' },
          { href: '/self-eval', icon: '🌟', label: 'Self Eval' },
          { href: '/notes', icon: '📌', label: 'Notes' },
        ].map(({ href, icon, label }) => (
          <a key={href} href={href} style={{
            padding: '14px 12px', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, textDecoration: 'none', textAlign: 'center',
            transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accentSoft)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.transform = ''; }}>
            <span style={{ fontSize: 22 }}>{icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
          </a>
        ))}
      </div>

      {/* ── CR Toggle ── */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', justifyContent: 'center' }}>
        <button onClick={() => {
          const next = { ...profile, isCR: !profile.isCR };
          store.set('profile', next); setProfile(next);
          setSaved(true); setTimeout(() => setSaved(false), 2200);
        }} className={`profile-cr-pill ${profile.isCR ? 'active' : ''}`}>
          <Icons.Users size={14} />
          <span>{profile.isCR ? 'CR Mode ON' : 'Simulate CR Mode'}</span>
        </button>
      </div>

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