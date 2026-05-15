import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Award, AlertTriangle, BookOpen, CalendarCheck, Clock, Wallet, Star } from 'lucide-react';
import { store, cgpaToPercent, computeCGPA, computeTermGPAs, computeEffectiveAttendance, MIN_ATTENDANCE_PERCENT, SCHOLARSHIP_ATTENDANCE_PCT } from '../store/store';

function StatCard({ label, value, sub, color, icon: Icon, to }) {
  const inner = (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4, cursor: to ? 'pointer' : 'default', transition: 'border-color 0.15s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        {Icon && <Icon size={14} color="var(--muted)" />}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div>}
    </div>
  );
  return to ? <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}

export default function Dashboard() {
  const profile  = store.get('profile') || {};
  const courses  = store.get('courses') || [];

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
  const creditPct = Math.min(100, Math.round((earnedCredits / totalRequired) * 100));
  const cgpaStr = cgpa !== null ? cgpa.toFixed(2) : null;
  const cgpaColor = cgpaStr ? (parseFloat(cgpaStr) >= 3.75 ? 'var(--success)' : parseFloat(cgpaStr) < 2.20 ? 'var(--danger)' : 'var(--text)') : 'var(--muted)';

  const activeCourses = courses.filter(c => c.status === 'active').length;
  const expenses = store.get('expenses') || [];
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTotal = expenses.filter(e => e.date?.startsWith(thisMonth)).reduce((s, e) => s + (e.amount || 0), 0);

  const criticalAlerts = alerts.filter(a => a.type === 'critical');
  const warningAlerts  = alerts.filter(a => a.type === 'warning');

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5)  return 'ভালো রাত';
    if (h < 12) return 'সুপ্রভাত';
    if (h < 17) return 'শুভ দুপুর';
    if (h < 20) return 'শুভ বিকেল';
    return 'শুভ সন্ধ্যা';
  })();

  return (
    <div className="page-enter page-container">
      {/* Welcome */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em' }}>
          {profile.name ? `${greeting}, ${profile.name.split(' ')[0]} 👋` : 'Welcome to KUETx 👋'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
          {profile.dept && profile.session ? `${profile.dept} · Session ${profile.session} · ` : ''}
          {new Date().toLocaleDateString('en-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Setup prompt */}
      {!profile.name && (
        <div className="card" style={{ marginBottom: 14, borderColor: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 28 }}>🐢</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>প্রোফাইল সেট আপ করো</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>তোমার নাম ও ডিপার্টমেন্ট দাও — সব জায়গায় কাজে লাগবে</div>
          </div>
          <Link to="/profile" className="btn btn-primary">শুরু করো →</Link>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 10, marginBottom: 14 }}>
        <StatCard label="CGPA" value={cgpaStr || '—'} sub={cgpaStr ? `≈${cgpaToPercent(parseFloat(cgpaStr)).toFixed(1)}%` : 'No data yet'} color={cgpaColor} icon={TrendingUp} to="/results" />
        <StatCard label="Credits Earned" value={earnedCredits} sub={`of ${totalRequired} required`} icon={Award} to="/credits" />
        <StatCard label="Active Courses" value={activeCourses} sub="This term" icon={BookOpen} to="/courses" />
        <StatCard label="This Month" value={`৳${monthTotal.toLocaleString()}`} sub="Expenses" icon={Wallet} to="/money" />
      </div>

      {/* Credit progress */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Graduation Progress</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{creditPct}% · {earnedCredits}/{totalRequired} credits</span>
        </div>
        <div className="progress-bar" style={{ height: 8 }}>
          <div className="progress-fill" style={{ width: `${creditPct}%` }} />
        </div>
        {/* Year markers */}
        <div style={{ position: 'relative', marginTop: 4, height: 14 }}>
          {[{ label: '2nd Year', at: 30 }, { label: '3rd Year', at: 60 }, { label: '4th Year', at: 90 }].map(m => (
            <div key={m.label} style={{ position: 'absolute', left: `${(m.at / totalRequired) * 100}%`, fontSize: 9, color: 'var(--muted)', transform: 'translateX(-50%)', textAlign: 'center' }}>
              {m.label}<br/>({m.at}cr)
            </div>
          ))}
        </div>
      </div>

      {/* GPA Trend */}
      {termGPAs.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
            GPA Trend
            <Link to="/results" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>Full results →</Link>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={termGPAs}>
              <XAxis dataKey="term" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <YAxis domain={[0, 4]} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <Tooltip contentStyle={{ fontSize: 11, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6 }} formatter={(v) => [v.toFixed(2), 'GPA']} />
              <Line type="monotone" dataKey="gpa" stroke="var(--accent)" strokeWidth={2.5} dot={{ fill: 'var(--accent)', r: 4, strokeWidth: 2, stroke: 'var(--card)' }} />
            </LineChart>
          </ResponsiveContainer>
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
