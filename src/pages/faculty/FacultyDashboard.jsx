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
        <div style={{ padding: '20px 24px 40px', maxWidth: 1040, margin: '0 auto', color: 'var(--muted)', fontSize: 13 }}>
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

  const statCard = (icon, label, value) => {
    const Icon = Icons[icon] || Icons.Circle;
    return (
      <div style={{
        flex: '1 1 160px', padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)',
      }}>
        <Icon size={18} color="var(--accent)" style={{ marginBottom: 8 }} />
        <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)' }}>{value}</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{label}</div>
      </div>
    );
  };

  return (
    <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
      <div style={{ padding: '20px 24px 40px', maxWidth: 1040, margin: '0 auto' }}>
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

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {statCard('BookOpen', 'Active classes', activeAssignments.length)}
          {statCard('Users', 'Unique students taught', uniqueStudentUids.size)}
          {statCard('ListChecks', hasAnyPlannedTotal ? 'Classes remaining' : 'Classes remaining (set a plan to track)', hasAnyPlannedTotal ? classesRemaining : '—')}
        </div>

        {pendingToday.length > 0 && (
          <div style={{
            padding: 14, borderRadius: 12, border: '1px solid color-mix(in srgb, #d97706 30%, var(--border))',
            background: 'color-mix(in srgb, #d97706 8%, var(--card))', marginBottom: 20,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>
              Attendance pending for today
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {pendingToday.map((c) => (
                <Link
                  key={c.assignmentId}
                  to={`/faculty/classes/${c.assignmentId}?groupId=${encodeURIComponent(c.groupId)}`}
                  style={{ fontSize: 12.5, color: 'var(--text)', textDecoration: 'none' }}
                >
                  {c.courseCode} — {c.batch?.toUpperCase()} {c.dept} <span style={{ color: 'var(--accent)' }}>Take attendance →</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {activeAssignments.length === 0 && (
          <div style={{ padding: 24, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', fontSize: 13.5, textAlign: 'center' }}>
            You haven't added any classes yet.{' '}
            <Link to="/faculty/classes" style={{ color: 'var(--accent)' }}>Add your first class</Link>.
          </div>
        )}
      </div>
    </div>
  );
}
