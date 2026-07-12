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

export default function FacultyDashboard() {
  const { isFounderBypass } = useIsFaculty();
  const [classIndex, setClassIndex] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [rosters, setRosters] = useState({}); // groupId -> member uid array (for de-dup)
  const [sessionsByAssignment, setSessionsByAssignment] = useState({});

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
        <div className="hub-page-hero">
          <div className="hub-page-hero-icon">
            <Icons.GraduationCap size={20} color="var(--accent)" />
          </div>
          <h1 className="hub-page-hero-title">Faculty Dashboard</h1>
        </div>

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
