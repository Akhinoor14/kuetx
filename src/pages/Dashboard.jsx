import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { TrendingUp, Award, AlertTriangle, BookOpen, CalendarCheck, Clock, Wallet, Star } from 'lucide-react';
import { store, cgpaToPercent, computeCGPA, computeTermGPAs, computeEffectiveAttendance, MIN_ATTENDANCE_PERCENT, SCHOLARSHIP_ATTENDANCE_PCT, computeCourseGrade, deriveAcademicMetaFromCourses, syncProfileAcademicMeta, getAllCourses, getProfile, getTermLabelFromKey, getCurrentTermKey, getTermProgress, getTermTimeline, TERM_DURATION_DAYS } from '../store/store';

function StatCard({ label, value, sub, color, bgColor, icon: Icon, to }) {
  const inner = (
    <div className="card" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 8, 
      cursor: to ? 'pointer' : 'default', 
      transition: 'all 0.2s',
      padding: 'clamp(12px, 3vw, 20px)',
      border: `1.5px solid ${color}20`,
      background: bgColor || 'rgba(var(--accentRGB), 0.02)',
      boxShadow: `0 4px 12px ${color}12`,
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 12,
      minHeight: 'clamp(110px, 20vw, 140px)'
    }}>
      {/* Background accent blob */}
      <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: `${color}08` }} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
        <span style={{ fontSize: 'clamp(9px, 2vw, 10px)', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
        {Icon && <Icon size={18} color={color} strokeWidth={2.2} />}
      </div>
      <div style={{ fontSize: 'clamp(24px, 6vw, 32px)', fontWeight: 900, color: color, letterSpacing: '-0.02em', lineHeight: 1, zIndex: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 'clamp(11px, 2.5vw, 12px)', color: 'var(--muted)', fontWeight: 500, zIndex: 1, marginTop: 2 }}>{sub}</div>}
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}

export default function Dashboard() {
  const profile  = getProfile();
  const courses  = getAllCourses(profile);

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
    if (past4 >= 4 && earnedCredits < 36) alerts.push({ type: 'critical', msg: `Only ${earnedCredits}/36 credits in first 4 terms — Struck-off risk!`, link: '/credits' });

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

  const { batch: derivedBatch, currentTerm: derivedTermLabel } = deriveAcademicMetaFromCourses(courses, profile);

  const currentTermLabel = getTermLabelFromKey(profile.currentTermKey) || derivedTermLabel || profile.currentTerm || '';
  const currentTermKey = getCurrentTermKey(profile);
  const inferredBatch = profile.batch || derivedBatch;

  useEffect(() => {
    syncProfileAcademicMeta({ profile, courses });
  }, [profile, courses]);
  const creditPct = Math.min(100, Math.round((earnedCredits / totalRequired) * 100));
  const cgpaStr = cgpa !== null ? cgpa.toFixed(2) : null;
  const cgpaColor = cgpaStr ? (parseFloat(cgpaStr) >= 3.75 ? 'var(--success)' : parseFloat(cgpaStr) < 2.20 ? 'var(--danger)' : 'var(--text)') : 'var(--muted)';

  const activeCourses = courses.filter(c => c.status === 'active').length;
  const expenses = store.get('expenses') || [];
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTotal = expenses.filter(e => e.date?.startsWith(thisMonth)).reduce((s, e) => s + (e.amount || 0), 0);

  const criticalAlerts = alerts.filter(a => a.type === 'critical');
  const warningAlerts  = alerts.filter(a => a.type === 'warning');

  const dhakaNow = new Date();
  const dhakaTimeParts = new Intl.DateTimeFormat('en-BD', {
    timeZone: 'Asia/Dhaka',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(dhakaNow);
  const dhakaHour = Number(dhakaTimeParts.find(part => part.type === 'hour')?.value || 0);
  const dhakaDateLabel = new Intl.DateTimeFormat('en-BD', {
    timeZone: 'Asia/Dhaka',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dhakaNow);

  const greeting = (() => {
    const h = dhakaHour;
    if (h < 5) return 'Welcome';
    if (h < 12) return 'Good morning';
    if (h < 15) return 'Good day';
    if (h < 18) return 'Good afternoon';
    if (h < 20) return 'Good evening';
    return 'Welcome';
  })();

  return (
    <div className="page-enter page-container dashboard-page">
      {/* Welcome */}
      {profile.name && (
        <div className="card dashboard-hero" style={{
          marginBottom: 22,
          padding: 'clamp(16px, 3vw, 30px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'clamp(12px, 3vw, 18px)',
          alignItems: 'stretch',
          minHeight: 'auto',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', inset: 'auto -36px -44px auto', width: 'clamp(120px, 30vw, 180px)', height: 'clamp(120px, 30vw, 180px)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.14), transparent 68%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: '-42px auto auto -36px', width: 'clamp(100px, 25vw, 160px)', height: 'clamp(100px, 25vw, 160px)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.10), transparent 70%)', pointerEvents: 'none' }} />

          <div className="dashboard-hero-main" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 'clamp(12px, 2vw, 16px)', paddingRight: 'clamp(0px, 1vw, 8px)', zIndex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 2vw, 12px)' }}>
              <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8, padding: 'clamp(6px, 1vw, 7px) clamp(10px, 2vw, 12px)', borderRadius: 999, background: 'rgba(var(--accentRGB), 0.08)', border: '1px solid rgba(var(--accentRGB), 0.12)', color: 'var(--accent)', fontSize: 'clamp(10px, 1.5vw, 11px)', fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                {greeting}
              </div>

              {profile.name && (
                <div style={{ maxWidth: 760 }}>
                  <h1 style={{ fontSize: 'clamp(26px, 5.5vw, 44px)', fontWeight: 800, letterSpacing: '-0.06em', lineHeight: 0.98, margin: 0 }}>
                    {profile.name}
                  </h1>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 2, minHeight: 38 }}>
              {profile.isCR && <span className="tag tag-yellow">CR</span>}
            </div>
          </div>

          <div className="dashboard-hero-date" style={{ minWidth: 'clamp(180px, 100%, 250px)', padding: 'clamp(14px, 2.5vw, 22px)', borderRadius: 18, border: '1px solid rgba(var(--accentRGB), 0.12)', background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(var(--accentRGB), 0.04))', whiteSpace: 'normal', alignSelf: 'stretch', boxShadow: '0 12px 28px rgba(12, 34, 64, 0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 'clamp(10px, 2vw, 12px)', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 'clamp(10px, 1.5vw, 11px)', fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--muted)' }}>Today</div>
                <div style={{ marginTop: 'clamp(4px, 1vw, 6px)', fontSize: 'clamp(14px, 2.8vw, 18px)', fontWeight: 800, color: 'var(--text)', lineHeight: 1.25 }}>
                  {dhakaDateLabel}
                </div>
              </div>
              <div style={{ width: 12, height: 12, borderRadius: 999, background: 'linear-gradient(135deg, var(--accent2), var(--accent))', boxShadow: '0 0 0 6px rgba(var(--accentRGB), 0.08)' }} />
            </div>
            <div style={{ height: 1, background: 'rgba(var(--accentRGB), 0.10)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 'clamp(11px, 1.8vw, 12px)', fontWeight: 700, color: 'var(--muted)' }}>{profile.name ? 'Profile synced' : 'Set up your profile'}</div>
              {profile.isCR && <span className="tag tag-yellow">CR mode</span>}
            </div>
          </div>
        </div>
      )}

      {/* Setup prompt */}
      {!profile.name && (
        <div className="card" style={{ marginBottom: 14, borderColor: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 28 }}>🐢</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Set Up Profile</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Add your name and department — it'll be used everywhere</div>
          </div>
          <Link to="/profile" className="btn btn-primary">Get started →</Link>
        </div>
      )}

      {/* Critical alerts */}
      {criticalAlerts.length > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 12, background: '#fff1f1', border: '1px solid #fecaca' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--danger)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} /> {criticalAlerts.length} Critical Alert{criticalAlerts.length > 1 ? 's' : ''}
          </div>
          {criticalAlerts.slice(0, 3).map((a, i) => (
            <Link key={i} to={a.link} style={{ display: 'block', fontSize: 12, color: 'var(--danger)', marginBottom: 2, textDecoration: 'none' }}>
              • {a.msg}
            </Link>
          ))}
          {criticalAlerts.length > 3 && <Link to="/alerts" style={{ fontSize: 12, color: 'var(--danger)' }}>+ {criticalAlerts.length - 3} more →</Link>}
        </div>
      )}

      {warningAlerts.length > 0 && (
        <div style={{ padding: '8px 14px', borderRadius: 10, marginBottom: 12, background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div style={{ fontSize: 12, color: 'var(--warning)' }}>
            ⚠ {warningAlerts.length} warning{warningAlerts.length > 1 ? 's' : ''} — <Link to="/alerts" style={{ color: 'var(--warning)' }}>view all</Link>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="dashboard-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 10, marginBottom: 14 }}>
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
          to="/credits" 
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

      {/* Credit progress */}
      <div className="card dashboard-roadmap" style={{ marginBottom: 12, padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Graduation Progress</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Your 4-year journey through 8 terms</div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#3B82F6' }}>{creditPct}%</div>
        </div>

        {/* Overall credit progress bar */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ 
            position: 'relative',
            height: 12, 
            borderRadius: 10,
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1.5px solid rgba(59, 130, 246, 0.2)',
            overflow: 'hidden',
            marginBottom: 8
          }}>
            <div 
              style={{ 
                width: `${creditPct}%`,
                height: '100%',
                background: `linear-gradient(90deg, #3B82F6, #10B981)`,
                borderRadius: 10,
                transition: 'width 0.4s ease',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
              }} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
            <span>{earnedCredits} earned</span>
            <span>{totalRequired} required</span>
          </div>
        </div>

        {/* === Term Timeline (visual-only) === */}
        {(() => {
          const profile = getProfile();
          const termStartDate = profile?.termStartDate;
          const currentTerm = profile?.currentTerm || '';
          if (!termStartDate) {
            return (
              <div style={{ padding: '12px', backgroundColor: 'rgba(59, 130, 246, 0.05)', borderRadius: 8, border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                  💡 Add term start date in <a href="/profile" style={{ color: '#3B82F6', textDecoration: 'none', fontWeight: 600 }}>Profile</a> to see timeline.
                </p>
              </div>
            );
          }

          const deptCode = profile?.dept;
          const termKey = profile?.currentTermKey;
          const timeline = getTermTimeline(termStartDate, deptCode, termKey);
          const start = new Date(termStartDate);
          const today = new Date();
          const msDay = 1000 * 60 * 60 * 24;
          const totalDays = TERM_DURATION_DAYS || 180;

          if (!timeline) {
            // fallback to simple progress
            const progress = getTermProgress(termStartDate);
            const elapsedDays = Math.floor((today - start) / msDay);
            const weeksPassed = Math.floor(elapsedDays / 7);
            const totalWeeks = 13;
            return (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Term Roadmap: {currentTerm}
                </div>
                <div style={{ height: 12, borderRadius: 10, background: 'rgba(59,130,246,0.08)', overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg,#3B82F6,#10B981)', transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {Array.from({ length: totalWeeks }).map((_, i) => (
                    <div key={i} style={{ width: 10, height: 10, borderRadius: 999, background: i < weeksPassed ? '#3B82F6' : i === weeksPassed ? '#10B981' : 'rgba(59,130,246,0.12)' }} />
                  ))}
                  <div style={{ marginLeft: 8, fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{Math.min(totalWeeks, weeksPassed + 1)} / {totalWeeks} weeks</div>
                </div>
              </div>
            );
          }

          // Build segments (calendar-day lengths) for visual mapping
          const segs = [];
          const segAdd = (label, color, s, e) => {
            const startDay = Math.max(0, Math.floor((new Date(s) - start) / msDay));
            const endDay = Math.max(startDay, Math.floor((new Date(e) - start) / msDay));
            const days = endDay - startDay + 1;
            const pct = Math.max(1, Math.round((days / totalDays) * 100));
            segs.push({ label, color, startDay, endDay, days, pct, s: new Date(s), e: new Date(e) });
          };

          segAdd('Classes', '#3B82F6', start, timeline.classEndDate);
          segAdd('Prep Leave', '#8B5CF6', timeline.prepLeaveStart, timeline.prepLeaveEnd);
          if (timeline.specialPeriods && timeline.specialPeriods.length) {
            // mark special holidays as separate amber segments between exams
            timeline.specialPeriods.forEach(sp => segAdd('Holiday', '#F59E0B', sp.startDate, sp.endDate));
          }
          if (timeline.examPhases && timeline.examPhases.length) {
            const first = timeline.examPhases[0].examDate;
            const last = timeline.examPhases[timeline.examPhases.length - 1].examDate;
            segAdd('Exams', '#EC4899', first, last);
          }
          segAdd('Post-Exam', '#F59E0B', timeline.postExamBreakStart, timeline.postExamBreakEnd);

          // ensure segments sorted by startDay
          segs.sort((a, b) => a.startDay - b.startDay);

          const totalPct = segs.reduce((s, x) => s + x.pct, 0);

          const currentSeg = segs.find(s => today >= s.s && today <= s.e) || null;

          const formatShortDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const examRows = timeline.examPhases?.map((ep, idx) => ({
            label: `Exam ${idx + 1}`,
            value: formatShortDate(ep.examDate),
          })) || [];

          return (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Term Roadmap: {currentTerm}
                </div>
                <Link to="/schedule" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 700 }}>
                  Manual edit in Schedule →
                </Link>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(172px, 1fr))', gap: 8, marginBottom: 8 }}>
                <div style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(6,182,212,0.14)', background: 'rgba(6,182,212,0.04)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Current</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>{currentTerm}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#036b74' }}>Today</div>
                  </div>
                </div>

                <div style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(14,165,233,0.14)', background: 'rgba(14,165,233,0.04)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Classes end</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>65d</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{formatShortDate(timeline.classEndDate)}</div>
                  </div>
                </div>

                <div style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(139,92,246,0.14)', background: 'rgba(139,92,246,0.04)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Prep leave</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', lineHeight: 1.25 }}>{formatShortDate(timeline.prepLeaveStart)} → {formatShortDate(timeline.prepLeaveEnd)}</div>
                </div>

                {examRows.map((row, idx) => (
                  <div key={idx} style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(236,72,153,0.14)', background: 'rgba(236,72,153,0.04)' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>{row.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', lineHeight: 1.25 }}>{row.value}</div>
                  </div>
                ))}
              </div>

            </div>
          );
        })()}
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

      {/* GPA Trend */}
      {termGPAs.length > 0 && (
        <div className="card" style={{ marginBottom: 12, padding: 16, background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(var(--accentRGB), 0.02))', border: '1px solid rgba(var(--accentRGB), 0.10)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.10em' }}>Progress Trend</div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 4 }}>GPA per Term</div>
            </div>
            <Link to="/results" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Full results →</Link>
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={termGPAs.filter(t => t.gpa > 0)} margin={{ top: 40, right: 10, left: 30, bottom: 10 }}>
              <defs>
                  <linearGradient id="dashGpaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.9} />
                    <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0.18} />
                  </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--accentRGB), 0.08)" />
              <XAxis dataKey="term" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <YAxis domain={[0, 4]} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <ReferenceLine y={3.75} stroke="#10b981" strokeDasharray="4 2" opacity={0.5} label={{ value: 'Honors', position: 'right', fill: '#059669', fontSize: 10 }} />
              <ReferenceLine y={2.20} stroke="#f59e0b" strokeDasharray="4 2" opacity={0.5} label={{ value: 'Min Pass', position: 'right', fill: '#b45309', fontSize: 10 }} />
              
              {/* Current CGPA reference line with prominent marker */}
              {cgpaStr && (
                <>
                  <ReferenceLine 
                    y={parseFloat(cgpaStr)} 
                    stroke="#06b6d4" 
                    strokeWidth={2}
                    opacity={0.75}
                    strokeDasharray="4 3"
                    label={{
                      value: cgpaStr,
                      position: 'right',
                      fill: '#0891b2',
                      fontSize: 12,
                      fontWeight: 700,
                      background: 'rgba(255,255,255,0.96)',
                      padding: [4, 8],
                      borderRadius: 6
                    }}
                    shape={({ x1, x2, y1 }) => (
                      <g>
                        {/* Clean marker dot */}
                        <circle cx={(x1 + x2) / 2} cy={y1} r={5} fill="#06b6d4" stroke="#ffffff" strokeWidth={2.5} />
                        
                        {/* Simple chip with value */}
                        <rect 
                          x={(x1 + x2) / 2 - 20} 
                          y={y1 - 20} 
                          width="40" 
                          height="16" 
                          rx="5" 
                          fill="#ffffff" 
                          stroke="#06b6d4" 
                          strokeWidth={1}
                        />
                        <text 
                          x={(x1 + x2) / 2} 
                          y={y1 - 7} 
                          textAnchor="middle" 
                          fill="#06b6d4" 
                          fontSize="10" 
                          fontWeight="700"
                        >
                          {cgpaStr}
                        </text>
                      </g>
                    )}
                  />
                </>
              )}
              
              <Tooltip
                contentStyle={{
                  background: 'rgba(255,255,255,0.96)',
                  border: '1px solid rgba(var(--accentRGB), 0.18)',
                  borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
                  padding: '10px 12px'
                }}
                formatter={(v) => [v?.toFixed(2) || '—', 'GPA']}
                labelFormatter={(l) => `${l}`}
              />
              
              <Area
                type="monotone"
                dataKey="gpa"
                fill="url(#dashGpaGradient)"
                stroke="#7C3AED"
                strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  const g = payload?.gpa || 0;
                  const fillColor = g >= 3.5 ? '#10B981' : g >= 3.0 ? '#3B82F6' : g >= 2.2 ? '#F59E0B' : '#ef4444';
                  return (
                    <g key={`dot-${payload?.term}`}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={5}
                        fill={fillColor}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                      <text
                        x={cx}
                        y={cy - 28}
                        textAnchor="middle"
                        fill="#0f172a"
                        fontSize="11"
                        fontWeight="700"
                      >
                        {payload?.gpa?.toFixed(2)}
                      </text>
                    </g>
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {termGPAs.filter(t => t.gpa > 0).map((t, i) => {
              const g = t.gpa;
              const color = g >= 3.5 ? '#10B981' : g >= 3.0 ? '#3B82F6' : g >= 2.2 ? '#F59E0B' : '#ef4444';
              return (
                <div key={t.term} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 999, background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{t.term}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t.gpa.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Honors status */}
      {cgpa !== null && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Academic Standing</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cgpa >= 3.75 && <span className="tag tag-green">🎓 Honors Eligible (CGPA ≥ 3.75)</span>}
            {cgpa >= 3.75 && <span className="tag tag-blue">📋 Dean's List Track</span>}
            {cgpa >= 3.75 && <span className="tag tag-yellow">🏅 Gold Medal Track</span>}
            {cgpa >= 2.20 && cgpa < 3.75 && <span className="tag tag-green">✓ Good Standing</span>}
            {cgpa < 2.20 && <span className="tag tag-red">⚠ Below Minimum — Risk of Probation</span>}
          </div>
        </div>
      )}

      {/* Quick nav */}
      <div className="section-title">Quick Access</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
        {[
          { to: '/attendance', label: 'Attendance', icon: CalendarCheck, emoji: '📅' },
          { to: '/marks',      label: 'Marks & CT',  icon: BookOpen,      emoji: '📝' },
          { to: '/schedule',   label: 'Schedule',    icon: Clock,         emoji: '🗓' },
          { to: '/calculators',label: 'Calculators', icon: TrendingUp,    emoji: '🧮' },
          { to: '/namaz',      label: 'Namaz',       icon: Star,          emoji: '🕌' },
          { to: '/smart-score',label: 'Smart Score', icon: Award,         emoji: '⭐' },
          { to: '/alerts',     label: 'Alerts',      icon: AlertTriangle, emoji: '⚠' },
          { to: '/settings',   label: 'Backup',      icon: Award,         emoji: '💾' },
        ].map(({ to, label, emoji }) => (
          <Link key={to} to={to} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8,
            background: 'var(--card)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 500,
            color: 'var(--text)', textDecoration: 'none',
          }}>
            <span style={{ fontSize: 15 }}>{emoji}</span> {label}
          </Link>
        ))}
      </div>

      {courses.length === 0 && profile.name && (
        <div className="card" style={{ marginTop: 16, textAlign: 'center', color: 'var(--muted)', padding: 30 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
          <p style={{ fontSize: 13, marginBottom: 12 }}>কোনো course add করা হয়নি। প্রথমে courses যোগ করো।</p>
          <Link to="/courses" className="btn btn-primary">Courses যোগ করো →</Link>
        </div>
      )}
    </div>
  );
}
