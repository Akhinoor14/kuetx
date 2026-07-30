import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import LazyRechartsArea from '../components/LazyRechartsArea';
import { TrendingUp, Award, AlertTriangle, BookOpen, CalendarCheck, Clock, Wallet, Star, UserCircle, GraduationCap, ClipboardList, Medal, CheckCircle2, Store } from 'lucide-react';
import * as Icons from 'lucide-react';
import { store, cgpaToPercent, computeCGPA, computeTermGPAs, computeEffectiveAttendance, MIN_ATTENDANCE_PERCENT, SCHOLARSHIP_ATTENDANCE_PCT, computeCourseGrade, deriveAcademicMetaFromCourses, syncProfileAcademicMeta, getProfile, getTermLabelFromKey, getCurrentTermKey, getTermProgress, getTermTimeline, getTermIndex, TERM_KEYS, getTimerActiveState, formatDurationMs, PRODUCTIVE_TIME_CATEGORIES } from '../store/store';
import { getAllCourses } from '../store/curriculumStore';
import { NAV } from '../nav';
import ticker from '../lib/ticker';
import usePageMeta from '../hooks/usePageMeta';
import { subscribeAllServices, SERVICE_TYPE_LABELS, SERVICE_TYPES, withServiceDefaults } from '../lib/serviceSync';
import { subscribeClassSetup } from '../lib/groupSync';
import { subscribeGroupTermStartDate } from '../lib/termStartDateSync';
import { getGroupId } from '../lib/groupUtils';
import { CATEGORY_ICONS } from './Services';

function StatCard({ label, value, sub, color, bgColor, icon: Icon, to }) {
  const inner = (
    <div className="card" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 6, 
      cursor: to ? 'pointer' : 'default', 
      transition: 'all 0.2s',
      padding: '14px 16px',
      border: `1.5px solid ${color}20`,
      background: bgColor || 'rgba(var(--accentRGB), 0.02)',
      boxShadow: `0 4px 12px ${color}12`,
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 12,
      minHeight: 100
    }}>
      {/* Background accent blob */}
      <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: `${color}08` }} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
        {Icon && <Icon size={20} color={color} strokeWidth={2.2} />}
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color: color, letterSpacing: '-0.02em', lineHeight: 1, zIndex: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, zIndex: 1, marginTop: 2 }}>{sub}</div>}
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}

// MULTI_CATEGORY_SERVICES_PLAN.md Phase 6: compact 5-category preview
// row for the Home page, linking to the full category grid at
// /services. Deliberately a lightweight one-shot-ish subscription (not
// wired into any of Dashboard's academic state) — this is a self-
// contained widget, same spirit as the Focus Timer card below it.
function ServicesPreviewRow() {
  const [services, setServices] = useState(null);

  useEffect(() => subscribeAllServices(setServices), []);

  const activeCountByType = {};
  SERVICE_TYPES.forEach((t) => { activeCountByType[t] = 0; });
  (services || []).forEach((raw) => {
    const s = withServiceDefaults(raw);
    if (s.status !== 'dormant' && activeCountByType[s.type] !== undefined) {
      activeCountByType[s.type] += 1;
    }
  });

  return (
    <div className="card" style={{ marginBottom: 12, padding: '16px 16px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>Services</div>
        <Link to="/services" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>
          সব দেখুন →
        </Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SERVICE_TYPES.length}, 1fr)`, gap: 8 }}>
        {SERVICE_TYPES.map((type) => {
          const Icon = CATEGORY_ICONS[type] || Store;
          return (
            <Link
              key={type}
              to={`/services/category/${type}`}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '10px 6px', borderRadius: 12, background: 'rgba(217,119,6,0.08)',
                border: '1px solid rgba(217,119,6,0.18)', textDecoration: 'none', textAlign: 'center',
              }}
            >
              <Icon size={18} color="#d97706" />
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{SERVICE_TYPE_LABELS[type]}</span>
              <span style={{ fontSize: 9.5, color: 'var(--muted)' }}>{activeCountByType[type]} সক্রিয়</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}


export default function Dashboard() {
  usePageMeta(
    'KUETx — Student Life OS for KUET Students',
    'Comprehensive student life tracker for KUET students — academics, attendance, GPA, finance, wellbeing and more. 100% offline.'
  );
  const profile  = getProfile();
  const courses  = getAllCourses(profile);
  const [, setStoreRefreshTick] = useState(0);
  const groupId = getGroupId(profile);
  const [classSetup, setClassSetup] = useState(null);
  const [groupTermStartDate, setGroupTermStartDate] = useState(null);
  useEffect(() => {
    if (!groupId) { setClassSetup(null); setGroupTermStartDate(null); return; }
    const unsubSetup = subscribeClassSetup(groupId, setClassSetup);
    const unsubTerm = subscribeGroupTermStartDate(groupId, setGroupTermStartDate);
    return () => { unsubSetup(); unsubTerm(); };
  }, [groupId]);
  // Quick access removed — kept minimal dashboard content

  const { cgpa, earnedCredits, termGPAs, alerts } = useMemo(() => {
    const { cgpa, earnedCredits } = computeCGPA(courses);
    const termGPAs = computeTermGPAs(courses);

    // Build alerts
    const alerts = [];

    // Attendance alerts
    courses.filter(c => c.status === 'active' || c.status === 'backlog').forEach(c => {
      const { held, attended } = computeEffectiveAttendance(c.id);
      if (!held) return;
      const pct = Math.round((attended / held) * 100);
      if (pct < MIN_ATTENDANCE_PERCENT) alerts.push({ type: 'critical', msg: `${c.code}: ${pct}% attendance — Course may be CANCELLED`, link: '/attendance' });
      else if (pct < SCHOLARSHIP_ATTENDANCE_PCT) alerts.push({ type: 'warning', msg: `${c.code}: ${pct}% — No scholarship eligibility`, link: '/attendance' });
    });

    if (cgpa !== null && cgpa < 2.20) alerts.push({ type: 'critical', msg: `CGPA ${cgpa.toFixed(2)} < 2.20 — Probation risk!`, link: '/results' });

    // Credit milestones
    const termMap = {};
    courses.forEach(c => {
      const k = `Y${c.year}T${c.term}`;
      termMap[k] = true;
    });
    const past4 = ['Y1T1','Y1T2','Y2T1','Y2T2'].filter(k => termMap[k]).length;
    if (past4 >= 4 && earnedCredits < 36) alerts.push({ type: 'critical', msg: `Only ${earnedCredits}/36 credits in first 4 terms — Struck-off risk!`, link: '/results' });

    return { cgpa, earnedCredits, termGPAs, alerts };
  }, [courses]);

  const totalRequired = profile.totalCreditsRequired || 160;
  // aggregate earned credits per term (Y1T1 .. Y4T2)
  const byTerm = {};
  courses.forEach(c => {
    const k = `Y${c.year}T${c.term}`;
    if (!byTerm[k]) byTerm[k] = { key: k, earned: 0 };
    const { grade, point, isX } = computeCourseGrade(c);
    if (!isX && grade !== 'F' && grade !== 'W' && point >= 2.0 && c.credits) {
      byTerm[k].earned += c.credits;
    }
  });

  const { batch: derivedBatch, currentTerm: derivedTermLabel, latestTermKey } = deriveAcademicMetaFromCourses(courses, profile);

  const currentTermKey = getCurrentTermKey(profile) || latestTermKey;
  const currentTermLabel = getTermLabelFromKey(currentTermKey) || derivedTermLabel || profile.currentTerm || '';
  const inferredBatch = profile.batch || derivedBatch;
  const scheduleSettings = store.get('scheduleSettings') || {};
  // Prefer the CR-set, group-wide term start date (classSetup, then the
  // older deptBatchConfig doc) over the per-student profile value — a
  // single class shouldn't have each student's own guess driving their
  // Dashboard's Academic Journey %.
  const effectiveTermStartDate = classSetup?.termStartDate || groupTermStartDate || profile?.termStartDate || null;
  // Same for the class timeline (classEndDate/prepLeaveEndDate/examCount/
  // postExamEndDate) — classSetup is now the group-wide source; Schedule's
  // old per-student local roadmapConfig only applies if the CR hasn't
  // filled in classSetup yet (backward compat for classes mid-migration).
  const localRoadmapConfig = store.get('roadmapConfig') || {};
  const effectiveRoadmapConfig = classSetup && (classSetup.classEndDate || classSetup.prepLeaveEndDate || classSetup.postExamEndDate)
    ? classSetup
    : localRoadmapConfig;
  const currentTermTimeline = currentTermKey && effectiveTermStartDate ? getTermTimeline(effectiveTermStartDate, profile?.dept, currentTermKey, effectiveRoadmapConfig) : null;
  const currentTermProgress = currentTermTimeline ? getTermProgress(effectiveTermStartDate, scheduleSettings.holidayDates || []) : 0;
  const completedTerms = currentTermKey ? Math.max(0, Math.min(TERM_KEYS.length - 1, getTermIndex(currentTermKey))) : 0;
  const shortDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const classEndLabel = currentTermTimeline?.classEndDate ? shortDate(currentTermTimeline.classEndDate) : '';
  const prepLeaveLabel = currentTermTimeline ? `${shortDate(currentTermTimeline.prepLeaveStart)} → ${shortDate(currentTermTimeline.prepLeaveEnd)}` : '';
  // getTermTimeline() itself always leaves examDate as null (see store.js —
  // "filled in by examOverrides in the UI"); the actual per-exam name/date
  // CR/ACR set on the Class Setup page lives in classSetup.examOverrides,
  // keyed by term. Without applying it here these labels were always blank.
  const examOverridesForTerm = (effectiveRoadmapConfig?.examOverrides && effectiveRoadmapConfig.examOverrides[currentTermKey]) || [];
  const filledExamPhases = (currentTermTimeline?.examPhases || []).map((p, i) => {
    const o = examOverridesForTerm[i];
    return { ...p, examDate: o?.examDate ? new Date(o.examDate + 'T00:00:00') : null, name: o?.name || '' };
  }).filter((p) => p.examDate);
  const examStartLabel = filledExamPhases.length ? shortDate(filledExamPhases[0].examDate) : '';
  const examEndLabel = filledExamPhases.length ? shortDate(filledExamPhases[filledExamPhases.length - 1].examDate) : '';
  const today = new Date();
  const todayDateLine = today.toLocaleDateString('en-BD', { day: 'numeric', month: 'long', year: 'numeric' });
  const todayDayLine = today.toLocaleDateString('en-BD', { weekday: 'long' });

  useEffect(() => {
    syncProfileAcademicMeta({ profile, courses });
  }, [profile, courses]);

  useEffect(() => {
    const refresh = () => setStoreRefreshTick(v => v + 1);
    window.addEventListener('kuetx:store-updated', refresh);
    const unsubTick = ticker.subscribeTicker(() => setStoreRefreshTick(v => v + 1));
    return () => { window.removeEventListener('kuetx:store-updated', refresh); unsubTick(); };
  }, []);

  const creditPct = Math.min(100, Math.round((earnedCredits / totalRequired) * 100));
  // Only count completedTerms toward the journey % once we actually know how
  // far into the current term we are (termStartDate set). Without a start
  // date, `getTermIndex` alone would silently assume every prior term is
  // 100% finished just because a later term was selected — inflating the
  // percentage even if the semester barely started or dates were never set.
  const termJourneyPct = currentTermKey && effectiveTermStartDate
    ? Math.min(100, Math.round(((completedTerms + (currentTermProgress / 100)) / TERM_KEYS.length) * 100))
    : creditPct;
  const cgpaStr = cgpa !== null ? cgpa.toFixed(2) : null;
  const cgpaColor = cgpaStr ? (parseFloat(cgpaStr) >= 3.75 ? 'var(--success)' : parseFloat(cgpaStr) < 2.20 ? 'var(--danger)' : 'var(--text)') : 'var(--muted)';

  const activeCourses = courses.filter(c => c.status === 'active').length;
  const moneyEntries = store.get('money_entries') || [];
  const timelogs = store.get('timelogs') || [];
  const timerState = getTimerActiveState();
  const _dm = new Date(); const thisMonth = `${_dm.getFullYear()}-${String(_dm.getMonth()+1).padStart(2,'0')}`;
  const monthTotal = moneyEntries.filter(e => e.type === 'expense' && e.date?.startsWith(thisMonth)).reduce((s, e) => s + (e.amount || 0), 0);
  const _dk = new Date(); const todayKey = `${_dk.getFullYear()}-${String(_dk.getMonth()+1).padStart(2,'0')}-${String(_dk.getDate()).padStart(2,'0')}`;
  const todayFocusHours = timelogs
    .filter(item => item?.date === todayKey && PRODUCTIVE_TIME_CATEGORIES.includes(item?.category))
    .reduce((sum, item) => sum + (Number(item?.hours) || 0), 0);
  const timerDisplayMs = (() => {
    if (!timerState) return 0;
    const base = Math.max(0, Number(timerState.accumulatedMs) || 0);
    if (timerState.status !== 'running') return base;
    const startedAt = Number(timerState.startedAt) || Date.now();
    return base + Math.max(0, Date.now() - startedAt);
  })();

  const criticalAlerts = alerts.filter(a => a.type === 'critical');
  const warningAlerts  = alerts.filter(a => a.type === 'warning');

  const timeGreeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return 'Welcome';
    if (h < 12) return 'Good morning';
    if (h < 15) return 'Good noon';
    if (h < 18) return 'Good afternoon';
    if (h < 20) return 'Good evening';
    return 'Good night';
  })();

  return (
    <div className="page-enter page-container dashboard-page">
      {/* Welcome */}
      {(profile.name || profile.dept || inferredBatch || currentTermLabel) && (
        <Link to="/profile" style={{ textDecoration: 'none' }}>
        <div className="card dashboard-hero" style={{ marginBottom: 22, padding: 'clamp(16px, 4vw, 30px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 18, alignItems: 'stretch', minHeight: 'auto', cursor: 'pointer' }}>
          <div className="dashboard-hero-main" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 18, paddingRight: 'clamp(0px, 2vw, 8px)' }}>
            {profile.name && (
              <div style={{ marginBottom: 4 }}>
                
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', marginBottom: 8, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                  {timeGreeting}
                </div>
                <h1 style={{ fontSize: 'clamp(28px, 6vw, 36px)', fontWeight: 800, letterSpacing: '-0.055em', lineHeight: 1.0, margin: 0 }}>
                  {profile.name}
                </h1>
              </div>
            )}
          </div>

          <div className="dashboard-hero-date" style={{ minWidth: 'clamp(200px, 90vw, 240px)', padding: 'clamp(16px, 3vw, 20px)', borderRadius: 16, border: '1px solid rgba(var(--accentRGB), 0.12)', background: 'linear-gradient(180deg, rgba(var(--accentRGB), 0.05), var(--surfaceGlassStrong))', whiteSpace: 'normal', alignSelf: 'stretch', boxShadow: '0 8px 22px rgba(12, 34, 64, 0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--muted)' }}>Today</div>
            <div className="dashboard-hero-date-lines" style={{ fontSize: 'clamp(13px, 3vw, 15px)', fontWeight: 700, color: 'var(--text)', whiteSpace: 'normal', lineHeight: 1.35, display: 'grid', gap: 4 }}>
              <div>{todayDateLine}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{todayDayLine}</div>
            </div>
          </div>
            {/* Class Rep card removed per request */}
        </div>
        </Link>
      )}

      {/* Quick Access removed */}

      {/* Setup prompt */}
      {!profile.name && (
        <div className="card" style={{ marginBottom: 14, borderColor: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <UserCircle size={28} color="var(--accent)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Set Up Profile</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Add your name and department — it'll be used everywhere</div>
          </div>
          <Link to="/profile" className="btn btn-primary">Get started →</Link>
        </div>
      )}

      {/* Critical alerts */}
      {criticalAlerts.length > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 12, background: 'var(--dangerBg)', border: '1px solid color-mix(in srgb, var(--danger) 28%, var(--border))' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--danger)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} /> {criticalAlerts.length} Critical Alert{criticalAlerts.length > 1 ? 's' : ''}
          </div>
          {criticalAlerts.slice(0, 3).map((a, i) => (
            <Link key={i} to={a.link} style={{ display: 'block', fontSize: 12, color: 'var(--danger)', marginBottom: 2, textDecoration: 'none' }}>
              • {a.msg}
            </Link>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="dashboard-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
        <StatCard 
          label="CGPA" 
          value={cgpaStr || '—'} 
          sub={cgpaStr ? `≈${cgpaToPercent(parseFloat(cgpaStr)).toFixed(1)}%` : 'No data yet'} 
          color="#3B82F6"
          bgColor="rgba(59, 130, 246, 0.08)"
          icon={TrendingUp}
          to="/results" 
        />
        <StatCard 
          label="Credits Earned" 
          value={earnedCredits} 
          sub={`of ${totalRequired} required`} 
          color="#10B981"
          bgColor="rgba(16, 185, 129, 0.08)"
          icon={Award} 
        />
        <StatCard 
          label="Active Courses" 
          value={activeCourses} 
          sub="This term" 
          color="#F59E0B"
          bgColor="rgba(245, 158, 11, 0.08)"
          icon={BookOpen} 
          to="/courses" 
        />
        <StatCard 
          label="This Month" 
          value={`৳${monthTotal.toLocaleString()}`} 
          sub="Expenses" 
          color="#8B5CF6"
          bgColor="rgba(139, 92, 246, 0.08)"
          icon={Wallet} 
          to="/money" 
        />
      </div>

      {/* GPA Trend Chart (lazy) */}
      {termGPAs.length > 0 && (
        <div className="card" style={{ marginBottom: 12, padding: 16, background: 'linear-gradient(180deg, var(--surfaceGlassStrong), rgba(var(--accentRGB), 0.02))', border: '1px solid rgba(var(--accentRGB), 0.10)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.10em' }}>Progress Trend</div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 4 }}>GPA per Term</div>
            </div>
            <Link to="/results" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Full results →</Link>
          </div>
          <LazyRechartsArea data={termGPAs.filter(t => t.gpa > 0)} height={180} />
        </div>
      )}

      <div className="card" style={{ marginBottom: 12, padding: 14, border: '1px solid rgba(var(--accentRGB), 0.18)', background: 'linear-gradient(180deg, rgba(var(--accentRGB), 0.05), var(--surfaceGlassStrong))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>Focus Timer</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
              {timerState?.status === 'running' ? 'Running now' : timerState?.status === 'paused' ? 'Paused' : 'No active session'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              Today productive: {todayFocusHours.toFixed(2)}h
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}>
              {formatDurationMs(timerDisplayMs)}
            </div>
            <Link to="/time" style={{ display: 'inline-block', marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>
              Open Time Tracker →
            </Link>
          </div>
        </div>
      </div>

      {/* Academic journey */}
      <div className="card dashboard-roadmap" style={{ marginBottom: 12, padding: '18px 18px 16px', border: '1px solid rgba(var(--accentRGB), 0.10)', background: 'linear-gradient(180deg, rgba(var(--accentRGB), 0.04), var(--surfaceGlassStrong))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--muted)' }}>Academic Journey</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>8 terms total. Each term contributes 12.5%.</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1 }}>{termJourneyPct}%</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 2 }}>Journey complete</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${TERM_KEYS.length}, 1fr)`, gap: 5, marginBottom: 12 }}>
          {TERM_KEYS.map((termKey, index) => {
            const isCurrent = termKey === currentTermKey;
            const isDone = index < completedTerms;
            const fill = isDone ? 100 : isCurrent ? Math.max(8, currentTermProgress) : 0;
            return (
              <div key={termKey} style={{ height: 10, borderRadius: 999, background: 'rgba(var(--accentRGB), 0.08)', overflow: 'hidden', position: 'relative' }} title={getTermLabelFromKey(termKey)}>
                <div style={{ width: `${fill}%`, height: '100%', borderRadius: 999, background: isDone ? '#10B981' : isCurrent ? 'linear-gradient(90deg, #3B82F6, #10B981)' : 'transparent', transition: 'width 0.3s ease' }} />
              </div>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 8 }}>
          <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(var(--accentRGB), 0.04)', border: '1px solid rgba(var(--accentRGB), 0.10)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Current term</div>
            <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.25 }}>{currentTermLabel || 'Not set'}</div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.10)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Terms done</div>
            <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.25 }}>{completedTerms} completed</div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.12)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Term progress</div>
            <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.25 }}>{currentTermKey ? `${currentTermProgress}% done` : 'Set term start date'}</div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span>{currentTermProgress > 0 ? `${currentTermProgress}% of this term done` : 'Term progress updates automatically'}</span>
          <span>{classEndLabel ? `Class end ${classEndLabel}${examEndLabel ? ` · Exams ${examStartLabel} → ${examEndLabel}` : ''}` : 'Add term start date to show dates'}</span>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, textAlign: 'right' }}>
          <Link to="/schedule" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}>
            Open Schedule →
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            opacity: 0;
          }
          100% {
            transform: scale(1.2);
            opacity: 0;
          }
        }
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(6px);
          }
        }
        @keyframes crawl {
          0%, 100% {
            transform: translateX(-50%) scaleX(1);
          }
          50% {
            transform: translateX(-50%) scaleX(-1);
          }
        }
      `}</style>

      {/* Honors status */}
      {cgpa !== null && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Academic Standing</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cgpa >= 3.75 && <span className="tag tag-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GraduationCap size={12} /> Honors Eligible (CGPA ≥ 3.75)</span>}
            {cgpa >= 3.75 && <span className="tag tag-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ClipboardList size={12} /> Dean's List Track</span>}
            {cgpa >= 3.75 && <span className="tag tag-yellow" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Medal size={12} /> Gold Medal Track</span>}
            {cgpa >= 2.20 && cgpa < 3.75 && <span className="tag tag-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> Good Standing</span>}
            {cgpa < 2.20 && <span className="tag tag-red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={12} /> Below Minimum — Risk of Probation</span>}
          </div>
        </div>
      )}

      {courses.length === 0 && profile.name && (
        <div className="card" style={{ marginTop: 16, textAlign: 'center', color: 'var(--muted)', padding: 30 }}>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><BookOpen size={32} color="var(--muted)" /></div>
          <p style={{ fontSize: 13, marginBottom: 12 }}>No courses have been added yet. Start by adding courses.</p>
          <Link to="/courses" className="btn btn-primary">Add courses →</Link>
        </div>
      )}

      {/* MULTI_CATEGORY_SERVICES_PLAN.md Phase 6: Home page preview row */}
      <ServicesPreviewRow />
    </div>
  );
}