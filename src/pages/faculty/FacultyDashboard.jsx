// FacultyDashboard.jsx — §8.11 of the merged Faculty Module prompt
//
// Real content, replacing the earlier Phase 3 placeholder:
//   - Career stats card: de-duplicated unique students taught (§2 item 13
//     — NOT a raw sum across assignments, a genuine Set union of every
//     roster this teacher has ever had an active/ended assignment for)
//   - Classes remaining: sum of (plannedTotalClasses - loggedSessionCount)
//     across active assignments, only counted where plannedTotalClasses
//     is actually set (many assignments won't have it set yet — §8.6
//     doesn't require it at creation, so this only counts what's known)
//   - Founder-switch line (§7) — only rendered for isFounderBypass
//   - Pending-attendance reminder — an active assignment whose
//     dayTimeSlots includes TODAY's weekday, with no session doc yet for
//     today's date

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useIsFaculty } from '../../hooks/useIsFaculty';
import { subscribeMyClassIndex, getFacultyAssignment } from '../../lib/facultyClassSync';
import { subscribeMembers } from '../../lib/groupSync';
import { subscribeSessionAttendance } from '../../lib/facultyMarksSync';
import { DAYS } from '../../lib/timeModels';
import { getFacultyDoc } from '../../lib/facultySync';

export default function FacultyDashboard() {
  const { isFounderBypass } = useIsFaculty();
  const [classIndex, setClassIndex] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [rosters, setRosters] = useState({}); // groupId -> member uid array (for de-dup)
  const [sessionsByAssignment, setSessionsByAssignment] = useState({});
  const [facultyProfile, setFacultyProfile] = useState(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getFacultyDoc(uid).then(setFacultyProfile);
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setClassIndex([]); return; }
    return subscribeMyClassIndex(uid, setClassIndex);
  }, []);

  useEffect(() => {
    if (!classIndex) return;
    let cancelled = false;
    Promise.all(classIndex.map((c) => getFacultyAssignment(c.groupId, c.assignmentId).then((a) => [c.assignmentId, a])))
      .then((pairs) => { if (!cancelled) setAssignments(Object.fromEntries(pairs)); });
    return () => { cancelled = true; };
  }, [classIndex]);

  // De-duplicated roster fetch — one subscription per DISTINCT groupId
  // (not per assignment), since the same group can have multiple course
  // assignments but the same students.
  useEffect(() => {
    if (!classIndex) return;
    const distinctGroupIds = [...new Set(classIndex.map((c) => c.groupId))];
    const unsubs = distinctGroupIds.map((gid) =>
      subscribeMembers(gid, (members) => {
        setRosters((prev) => ({ ...prev, [gid]: (members || []).map((m) => m.id) }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [classIndex]);

  useEffect(() => {
    const active = (classIndex || []).filter((c) => c.status === 'active');
    let cancelled = false;
    const unsubs = active.map((c) =>
      subscribeSessionAttendance(c.groupId, c.assignmentId, (sessions) => {
        if (cancelled) return;
        setSessionsByAssignment((prev) => ({ ...prev, [c.assignmentId]: sessions }));
      })
    );
    return () => { cancelled = true; unsubs.forEach((u) => u()); };
  }, [classIndex]);

  const timeGreeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return 'Welcome';
    if (h < 12) return 'Good morning';
    if (h < 15) return 'Good noon';
    if (h < 18) return 'Good afternoon';
    if (h < 20) return 'Good evening';
    return 'Good night';
  })();
  const today = new Date();
  const todayDateLine = today.toLocaleDateString('en-BD', { day: 'numeric', month: 'long', year: 'numeric' });
  const todayDayLine = today.toLocaleDateString('en-BD', { weekday: 'long' });
  const facultyDisplayName = facultyProfile?.preferredName || facultyProfile?.name || '';

  if (classIndex === null) {
    return (
      <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
        <div style={{ padding: '20px 24px 40px', width: '97%', maxWidth: 'none', margin: '0 auto', color: 'var(--muted)', fontSize: 13 }}>
          Loading…
        </div>
      </div>
    );
  }

  const activeAssignments = (classIndex || []).filter((c) => c.status === 'active');

  // §2 item 13 — de-duplicated unique students, not a raw sum.
  const uniqueStudentUids = new Set();
  activeAssignments.forEach((c) => {
    (rosters[c.groupId] || []).forEach((uid) => uniqueStudentUids.add(uid));
  });

  // Classes remaining — only where plannedTotalClasses is actually set.
  let classesRemaining = 0;
  let hasAnyPlannedTotal = false;
  activeAssignments.forEach((c) => {
    const a = assignments[c.assignmentId];
    if (a?.plannedTotalClasses) {
      hasAnyPlannedTotal = true;
      const logged = (sessionsByAssignment[c.assignmentId] || []).length;
      classesRemaining += Math.max(0, a.plannedTotalClasses - logged);
    }
  });

  // Pending-attendance reminder — active assignment scheduled for today's
  // weekday, no session doc yet for today's date.
  const todayName = DAYS[new Date().getDay()] || null;
  const todayDate = new Date().toISOString().slice(0, 10);
  const pendingToday = activeAssignments.filter((c) => {
    const a = assignments[c.assignmentId];
    if (!a || !todayName) return false;
    const scheduledToday = (a.dayTimeSlots || []).some((s) => s.day === todayName);
    if (!scheduledToday) return false;
    const hasSessionToday = (sessionsByAssignment[c.assignmentId] || []).some((s) => s.date === todayDate);
    return !hasSessionToday;
  });

  const statCard = (icon, label, value, sub, color) => {
    const Icon = Icons[icon] || Icons.Circle;
    const c = color || 'var(--accent)';
    return (
      <div className="card" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'all 0.2s',
        padding: '14px 16px',
        border: `1.5px solid ${c}20`,
        background: `${c}08`,
        boxShadow: `0 4px 12px ${c}12`,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 12,
        minHeight: 100,
        flex: '1 1 160px',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: `${c}08` }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
          <Icon size={20} color={c} strokeWidth={2.2} />
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: c, letterSpacing: '-0.02em', lineHeight: 1, zIndex: 1 }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, zIndex: 1, marginTop: 2 }}>{sub}</div>}
      </div>
    );
  };

  return (
    <div className="hub-page-bg page-enter dashboard-page" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '20px 24px 40px', width: '97%', maxWidth: 'none', margin: '0 auto' }}>
        {/* Welcome hero — same warm greeting + today-date pattern as the
            student Dashboard's clickable hero card, adapted for faculty
            (name/title instead of dept/batch), linking to Faculty Profile. */}
        <Link to="/faculty/profile" style={{ textDecoration: 'none' }}>
          <div className="card dashboard-hero" style={{ marginBottom: 22, padding: 'clamp(16px, 4vw, 30px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 18, alignItems: 'stretch', minHeight: 'auto', cursor: 'pointer' }}>
            <div className="dashboard-hero-main" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 18, paddingRight: 'clamp(0px, 2vw, 8px)' }}>
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', marginBottom: 8, letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                  {timeGreeting}
                </div>
                <h1 style={{ fontSize: 'clamp(28px, 6vw, 36px)', fontWeight: 800, letterSpacing: '-0.055em', lineHeight: 1.0, margin: 0 }}>
                  {facultyDisplayName || 'Faculty'}
                </h1>
                {facultyProfile?.title && (
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, fontWeight: 600 }}>
                    {facultyProfile.title}
                  </div>
                )}
              </div>
            </div>

            <div className="dashboard-hero-date" style={{ minWidth: 'clamp(200px, 90vw, 240px)', padding: 'clamp(16px, 3vw, 20px)', borderRadius: 16, border: '1px solid rgba(var(--accentRGB), 0.12)', background: 'linear-gradient(180deg, rgba(var(--accentRGB), 0.05), var(--surfaceGlassStrong))', whiteSpace: 'normal', alignSelf: 'stretch', boxShadow: '0 8px 22px rgba(12, 34, 64, 0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--muted)' }}>Today</div>
              <div className="dashboard-hero-date-lines" style={{ fontSize: 'clamp(13px, 3vw, 15px)', fontWeight: 700, color: 'var(--text)', whiteSpace: 'normal', lineHeight: 1.35, display: 'grid', gap: 4 }}>
                <div>{todayDateLine}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{todayDayLine}</div>
              </div>
            </div>
          </div>
        </Link>

        {!facultyDisplayName && (
          <div className="card" style={{ marginBottom: 14, borderColor: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 28 }}>🎓</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Set Up Profile</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Add your name, title and department — it'll be used everywhere</div>
            </div>
            <Link to="/faculty/profile" className="btn btn-primary">Get started →</Link>
          </div>
        )}

        {isFounderBypass && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 14px',
            borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 8%, var(--card))',
            border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', fontSize: 12.5, color: 'var(--text)',
          }}>
            <Icons.Repeat size={14} color="var(--accent)" />
            Viewing as: Teacher — switch back from the Admin dashboard.
          </div>
        )}

        {pendingToday.length > 0 && (
          <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 12, background: 'var(--dangerBg, rgba(217,119,6,0.08))', border: '1px solid color-mix(in srgb, #d97706 28%, var(--border))' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#d97706', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icons.AlertTriangle size={14} /> Attendance pending for today
            </div>
            {pendingToday.map((c) => (
              <Link
                key={c.assignmentId}
                to={`/faculty/classes/${c.assignmentId}?groupId=${encodeURIComponent(c.groupId)}`}
                style={{ display: 'block', fontSize: 12, color: '#d97706', marginBottom: 2, textDecoration: 'none' }}
              >
                • {c.courseCode} — {c.batch?.toUpperCase()} {c.dept} <span style={{ fontWeight: 700 }}>Take attendance →</span>
              </Link>
            ))}
          </div>
        )}

        {/* Stat cards */}
        <div className="dashboard-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          {statCard('BookOpen', 'Active Classes', activeAssignments.length, 'This term', '#3B82F6')}
          {statCard('Users', 'Students Taught', uniqueStudentUids.size, 'Unique, all classes', '#10B981')}
          {statCard('ListChecks', 'Classes Remaining', hasAnyPlannedTotal ? classesRemaining : '—', hasAnyPlannedTotal ? 'Across active classes' : 'Set a plan to track', '#F59E0B')}
        </div>

        {/* Classes overview — mirrors the student dashboard's "Academic Journey" progress card */}
        {activeAssignments.length > 0 && (
          <div className="card dashboard-roadmap" style={{ marginBottom: 12, padding: '18px 18px 16px', border: '1px solid rgba(var(--accentRGB), 0.10)', background: 'linear-gradient(180deg, rgba(var(--accentRGB), 0.04), var(--surfaceGlassStrong))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--muted)' }}>My Classes</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{activeAssignments.length} active class{activeAssignments.length !== 1 ? 'es' : ''} this term</div>
              </div>
              <Link to="/faculty/classes" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>All classes →</Link>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {activeAssignments.map((c) => {
                const a = assignments[c.assignmentId];
                const logged = (sessionsByAssignment[c.assignmentId] || []).length;
                const planned = a?.plannedTotalClasses;
                const pct = planned ? Math.min(100, Math.round((logged / planned) * 100)) : null;
                return (
                  <Link
                    key={c.assignmentId}
                    to={`/faculty/classes/${c.assignmentId}?groupId=${encodeURIComponent(c.groupId)}`}
                    style={{ textDecoration: 'none', color: 'var(--text)' }}
                  >
                    <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(var(--accentRGB), 0.04)', border: '1px solid rgba(var(--accentRGB), 0.10)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: pct !== null ? 6 : 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>{c.courseCode} — {c.batch?.toUpperCase()} {c.dept}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                          {planned ? `${logged}/${planned} classes` : `${logged} logged`}
                        </div>
                      </div>
                      {pct !== null && (
                        <div style={{ height: 8, borderRadius: 999, background: 'rgba(var(--accentRGB), 0.08)', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #3B82F6, #10B981)', transition: 'width 0.3s ease' }} />
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {activeAssignments.length === 0 && (
          <div className="card" style={{ marginTop: 16, textAlign: 'center', color: 'var(--muted)', padding: 30 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
            <p style={{ fontSize: 13, marginBottom: 12 }}>You haven't added any classes yet.</p>
            <Link to="/faculty/classes" className="btn btn-primary">Add your first class →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
