import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { store, computeCourseGrade, computeCGPA, computeEffectiveAttendance, computeTermGPAs, MIN_ATTENDANCE_PERCENT, SCHOLARSHIP_ATTENDANCE_PCT, MAX_THEORY_COURSES_PER_TERM, MIN_CREDITS_FIRST_4_TERMS, MIN_CREDITS_FIRST_6_TERMS, HONORS_CGPA, DEANS_LIST_GPA, getAllCourses, getProfile, getCurrentTermKey, getTermTimeline } from '../store/store';

const normalizeTeacherLabel = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const formatDateLabel = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const getRoutineTeacherLabel = (courseId) => {
  const schedule = store.get('schedule') || [];
  const entries = Array.isArray(schedule) ? schedule : [];
  const matched = entries.find(item => item?.courseId === courseId && String(item.teacherName || '').trim());
  return normalizeTeacherLabel(matched?.teacherName || 'Teacher not set');
};

export function computeAlerts(profile) {
  const courses = getAllCourses(profile);
  const critical = [], warnings = [], positives = [];
  const assignmentAlerts = [];
  const marks = store.get('marks') || {};
  const currentTermKey = getCurrentTermKey(profile);
  const currentTermCourses = currentTermKey
    ? courses.filter(c => `Y${c.year}T${c.term}` === currentTermKey && (c.status === 'active' || c.status === 'backlog'))
    : [];
  const currentTermTimeline = currentTermKey ? getTermTimeline(profile?.termStartDate, profile?.dept, currentTermKey) : null;
  const currentTermIsOngoing = !!(
    (currentTermTimeline && new Date() <= currentTermTimeline.classEndDate) ||
    (currentTermKey && currentTermCourses.length > 0)
  );
  const currentTermCourseIds = new Set(currentTermCourses.map(c => c.id));

  // Attendance per course
  courses.filter(c => c.status === 'active' || c.status === 'backlog').forEach(c => {
    const { pct, held } = computeEffectiveAttendance(c.id);
    if (!held) return;
    if (pct < MIN_ATTENDANCE_PERCENT)
      critical.push({ msg: `${c.code}: Attendance ${pct}% — course will be CANCELLED (Art. 11.3)`, link: '/attendance' });
    else if (pct < SCHOLARSHIP_ATTENDANCE_PCT)
      warnings.push({ msg: `${c.code}: ${pct}% attendance — not eligible for scholarship (Art. 14.2)`, link: '/attendance' });
  });

  // Theory course count per term
  const theoryCounts = {};
  courses.filter(c => c.status === 'active' && c.type === 'Theory').forEach(c => {
    const k = `Y${c.year}T${c.term}`;
    theoryCounts[k] = (theoryCounts[k] || 0) + 1;
  });
  Object.entries(theoryCounts).forEach(([k, n]) => {
    if (n > MAX_THEORY_COURSES_PER_TERM)
      warnings.push({ msg: `${k}: ${n} theory courses — max is ${MAX_THEORY_COURSES_PER_TERM} (Art. 11.2)`, link: '/courses' });
  });

  // F in core courses
  courses.forEach(c => {
    const termKey = `Y${c.year}T${c.term}`;
    const courseMarks = marks[c.id] || {};
    const hasPublishedResult = !!String(courseMarks.publishedGrade || courseMarks.resultGrade || '').trim();
    const isCurrentOngoingCourse = currentTermIsOngoing && currentTermCourseIds.has(c.id);

    if (isCurrentOngoingCourse && !hasPublishedResult) return;

    const { grade } = computeCourseGrade(c);
    if (grade === 'F' && c.isCore)
      critical.push({ msg: `${c.code}: F grade in core course — must repeat (Art. 16)`, link: '/results' });
  });

  // Backlog grade cap warning
  courses.filter(c => c.status === 'backlog').forEach(c => {
    const { grade } = computeCourseGrade(c);
    if (grade === 'A+' || grade === 'A' || grade === 'A-')
      warnings.push({ msg: `${c.code}: Backlog course — grade capped at B+ (Art. 16)`, link: '/marks' });
  });

  // CGPA / GPA
  const { cgpa, earnedCredits } = computeCGPA(courses);
  if (cgpa !== null) {
    if (cgpa < 2.20)  critical.push({ msg: `CGPA ${cgpa.toFixed(2)} < 2.20 — Academic probation risk! (Art. 20)`, link: '/results' });
    if (cgpa >= HONORS_CGPA) positives.push({ msg: `CGPA ${cgpa.toFixed(2)} ≥ 3.75 — Honors eligible (Art. 18.1) 🎓`, link: '/results' });
    if (cgpa >= DEANS_LIST_GPA) positives.push({ msg: `On track for Dean's List — maintain in both terms, no F grades (Art. 18.2) 📋`, link: '/results' });
    if (cgpa >= 3.75 && earnedCredits >= 100) positives.push({ msg: `Gold Medal track — finish in 4 years with no F (Art. 18.3) 🏅`, link: '/results' });
  }

  // Current-term draft GPA and missing marks coverage
  if (currentTermCourses.length > 0) {
    let draftPts = 0;
    let draftCr = 0;
    let noMarkCount = 0;

    currentTermCourses.forEach(course => {
      const courseMarks = marks[course.id] || {};
      const hasAnyEntry = Object.values(courseMarks).some(v => v !== '' && v !== null && v !== undefined);
      if (!hasAnyEntry) noMarkCount += 1;

      const { grade, point, isX } = computeCourseGrade(course);
      if (isX) return;
      if (grade !== 'F' && grade !== 'W' && point >= 2.0 && course.credits) {
        draftPts += point * course.credits;
        draftCr += course.credits;
      }
    });

    const draftGpa = draftCr ? +(draftPts / draftCr).toFixed(2) : null;
    const currentTermLabel = computeTermGPAs(currentTermCourses)[0]?.label || currentTermKey;

    if (draftGpa !== null) {
      if (draftGpa < 2.20) {
        critical.push({ msg: `${currentTermLabel}: draft GPA ${draftGpa.toFixed(2)} < 2.20 — risk zone`, link: '/marks' });
      } else if (draftGpa >= 3.75) {
        positives.push({ msg: `${currentTermLabel}: draft GPA ${draftGpa.toFixed(2)} — strong Dean's List track`, link: '/marks' });
      } else {
        warnings.push({ msg: `${currentTermLabel}: draft GPA ${draftGpa.toFixed(2)} based on current marks`, link: '/marks' });
      }
    }

    // Marks entry warning starts 3 months after the NEXT term starts.
    if (noMarkCount > 0 && profile?.termStartDate && profile?.dept && currentTermKey) {
      const timeline = getTermTimeline(profile.termStartDate, profile.dept, currentTermKey);
      const nextTermStart = timeline?.nextSemesterStart;

      if (nextTermStart instanceof Date && !Number.isNaN(nextTermStart.getTime())) {
        const thresholdDate = new Date(nextTermStart);
        thresholdDate.setMonth(thresholdDate.getMonth() + 3);

        if (new Date() >= thresholdDate) {
          warnings.push({ msg: `${currentTermKey}: ${noMarkCount} course${noMarkCount > 1 ? 's' : ''} still need marks entry`, link: '/marks' });
        }
      }
    }
  }

  // Credit milestones
  const termKeys = [...new Set(courses.map(c => `Y${c.year}T${c.term}`))].sort();
  const first4Keys = termKeys.filter(k => k <= 'Y2T2');
  if (first4Keys.length === 4) {
    const first4cr = courses
      .filter(c => first4Keys.includes(`Y${c.year}T${c.term}`))
      .reduce((s, c) => { const { grade, point } = computeCourseGrade(c); return grade !== 'F' && point >= 2.0 ? s + (c.credits || 0) : s; }, 0);
    if (first4cr < MIN_CREDITS_FIRST_4_TERMS)
      critical.push({ msg: `Only ${first4cr}/${MIN_CREDITS_FIRST_4_TERMS} credits in first 4 terms — Struck-off risk! (Art. 12.1.iv)`, link: '/credits' });
  }

  // Graduation milestone
  if (earnedCredits >= (profile.totalCreditsRequired || 160))
    positives.push({ msg: `All credits completed — eligible to apply for graduation! (Art. 28) 🎉`, link: '/credits' });
  else if (earnedCredits >= 120)
    positives.push({ msg: `${earnedCredits} credits done — on track for graduation`, link: '/credits' });

  // Assignment reminders
  const assignments = store.get('assignments') || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  assignments
    .filter(a => a.status !== 'done' && a.due)
    .sort((a, b) => new Date(`${a.due}T00:00:00`) - new Date(`${b.due}T00:00:00`))
    .forEach(a => {
      const course = courses.find(c => c.id === a.courseId);
      const teacherLabel = course ? getRoutineTeacherLabel(course.id) : 'Teacher not set';
      const courseLabel = course?.code || 'Assignment';
      const dueDate = new Date(`${a.due}T00:00:00`);
      const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      const dueLabel = formatDateLabel(a.due);
      const topic = a.title ? ` — ${a.title}` : '';

      if (daysLeft < 0) {
        const overdueBy = Math.abs(daysLeft);
        assignmentAlerts.push({
          priority: 'overdue',
          kind: 'assignment',
          daysLeft,
          teacherLabel,
          courseLabel,
          dueLabel,
          title: a.title || a.topic || 'Assignment',
          msg: `Assignment for ${teacherLabel}${topic} is overdue by ${overdueBy} day${overdueBy > 1 ? 's' : ''} · ${courseLabel} · due ${dueLabel}`,
          link: '/assignments',
        });
      } else if (daysLeft === 0) {
        assignmentAlerts.push({
          priority: 'today',
          kind: 'assignment',
          daysLeft,
          teacherLabel,
          courseLabel,
          dueLabel,
          title: a.title || a.topic || 'Assignment',
          msg: `Assignment for ${teacherLabel}${topic} is due today · ${courseLabel} · ${dueLabel}`, link: '/assignments',
        });
      } else if (daysLeft <= 3) {
        assignmentAlerts.push({
          priority: 'soon',
          kind: 'assignment',
          daysLeft,
          teacherLabel,
          courseLabel,
          dueLabel,
          title: a.title || a.topic || 'Assignment',
          msg: `Assignment for ${teacherLabel}${topic} due in ${daysLeft} day${daysLeft > 1 ? 's' : ''} · ${courseLabel} · ${dueLabel}`,
          link: '/assignments',
        });
      }
    });

  return { critical, warnings, positives, assignmentAlerts };
}

export default function Alerts() {
  const profile = getProfile();
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const handleStoreUpdate = () => setRefreshTick(t => t + 1);
    window.addEventListener('kuetx:store-updated', handleStoreUpdate);
    return () => window.removeEventListener('kuetx:store-updated', handleStoreUpdate);
  }, []);

  const { critical, warnings, positives, assignmentAlerts } = useMemo(() => computeAlerts(profile), [profile, refreshTick]);
  const totalCount = critical.length + warnings.length + positives.length + assignmentAlerts.length;
  const assignmentCounts = {
    overdue: assignmentAlerts.filter(a => a.priority === 'overdue').length,
    today: assignmentAlerts.filter(a => a.priority === 'today').length,
    soon: assignmentAlerts.filter(a => a.priority === 'soon').length,
  };

  const tone = (color) => {
    if (color === 'var(--danger)') {
      return {
        bg: 'var(--dangerBg)',
        border: 'color-mix(in srgb, var(--danger) 28%, var(--border))',
        iconBg: 'rgba(248, 113, 113, 0.14)',
      };
    }
    if (color === 'var(--warning)') {
      return {
        bg: 'var(--warningBg)',
        border: 'color-mix(in srgb, var(--warning) 28%, var(--border))',
        iconBg: 'rgba(251, 191, 36, 0.14)',
      };
    }
    return {
      bg: 'var(--successBg)',
      border: 'color-mix(in srgb, var(--success) 28%, var(--border))',
      iconBg: 'rgba(74, 222, 128, 0.14)',
    };
  };

  const Section = ({ title, items, color, emoji }) => (
    <div style={{
      marginBottom: 16,
      padding: 16,
      borderRadius: 18,
      border: '1px solid var(--border)',
      background: 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))',
      boxShadow: '0 10px 28px rgba(0,0,0,0.10)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            display: 'grid',
            placeItems: 'center',
            background: tone(color).iconBg,
            border: `1px solid ${tone(color).border}`,
          }}>{emoji}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{items.length} item{items.length === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color, padding: '6px 10px', borderRadius: 999, background: tone(color).iconBg, border: `1px solid ${tone(color).border}` }}>
          {items.length || '0'}
        </div>
      </div>
      {items.length === 0
        ? <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 2px' }}>None — all clear ✓</div>
        : items.map((a, i) => (
          <Link key={i} to={a.link || '#'} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', borderRadius: 14, marginBottom: 8,
            background: tone(color).bg,
            border: `1px solid ${tone(color).border}`,
            textDecoration: 'none', color: 'var(--text)', fontSize: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 4, boxShadow: `0 0 0 4px ${tone(color).iconBg}` }} />
            <span style={{ flex: 1, lineHeight: 1.55 }}>{a.msg}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, paddingTop: 1 }}>→</span>
          </Link>
        ))
      }
    </div>
  );

  const AssignmentChip = ({ label, count, color }) => (
    <div style={{
      padding: '7px 10px',
      borderRadius: 999,
      border: `1px solid ${color}`,
      background: 'var(--surface)',
      color,
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: '0.02em',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      whiteSpace: 'nowrap',
    }}>
      <span>{label}</span>
      <span style={{ minWidth: 18, textAlign: 'center', padding: '1px 6px', borderRadius: 999, background: color, color: 'white' }}>{count}</span>
    </div>
  );

  const AssignmentGroup = ({ title, items, color, badge }) => (
    <div style={{
      marginTop: 10,
      padding: 14,
      borderRadius: 16,
      border: `1px solid color-mix(in srgb, ${color} 28%, var(--border))`,
      background: 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 9, display: 'grid', placeItems: 'center', background: color, color: 'white', fontWeight: 900, fontSize: 12 }}>{badge}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{items.length} item{items.length === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color, padding: '6px 10px', borderRadius: 999, background: 'color-mix(in srgb, ' + color + ' 12%, transparent)', border: `1px solid color-mix(in srgb, ${color} 28%, var(--border))` }}>
          {items.length}
        </div>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>None — all clear ✓</div>
      ) : items.map((item, index) => (
        <Link key={`${item.link}-${index}`} to={item.link || '#'} style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 12,
          marginBottom: 8,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          textDecoration: 'none',
          color: 'var(--text)',
          fontSize: 12,
          lineHeight: 1.45,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ padding: '3px 8px', borderRadius: 999, background: color, color: 'white', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>{item.priority}</span>
              <span style={{ padding: '3px 8px', borderRadius: 999, background: 'rgba(0,0,0,0.04)', color: 'var(--muted)', fontSize: 10, fontWeight: 700 }}>Due {item.dueLabel}</span>
            </div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{item.teacherLabel}</div>
            <div style={{ color: 'var(--muted)' }}>{item.msg}</div>
          </div>
        </Link>
      ))}
    </div>
  );

  return (
    <div className="page-enter page-container">
      <div className="hero-banner" style={{ marginBottom: 18, padding: 18, border: '1px solid rgba(var(--accentRGB), 0.14)', background: 'radial-gradient(circle at top left, rgba(var(--accentRGB), 0.12), transparent 34%), linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--muted)', marginBottom: 6 }}>Notifications</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', marginBottom: 4 }}>Alerts & Suggestions</h1>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
              {totalCount} total signals · {critical.length} critical · {warnings.length} warnings · {positives.length} good news · {assignmentAlerts.length} assignments
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, minWidth: 'min(100%, 360px)' }}>
            <div style={{ padding: '10px 12px', borderRadius: 14, border: '1px solid color-mix(in srgb, var(--danger) 28%, var(--border))', background: 'var(--dangerBg)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>Critical</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--danger)' }}>{critical.length}</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 14, border: '1px solid color-mix(in srgb, var(--warning) 28%, var(--border))', background: 'var(--warningBg)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>Warnings</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--warning)' }}>{warnings.length}</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 14, border: '1px solid color-mix(in srgb, var(--success) 28%, var(--border))', background: 'var(--successBg)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>Good</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--success)' }}>{positives.length}</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 16, padding: 16, borderRadius: 18, border: '1px solid var(--border)', background: 'linear-gradient(180deg, var(--surfaceGlassStrong), var(--surfaceGlass))', boxShadow: '0 10px 28px rgba(0,0,0,0.10)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>📌 Assignment Alerts</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Grouped by urgency: overdue, today, and next 3 days</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <AssignmentChip label="Overdue" count={assignmentCounts.overdue} color="var(--danger)" />
            <AssignmentChip label="Today" count={assignmentCounts.today} color="var(--warning)" />
            <AssignmentChip label="Next 3 Days" count={assignmentCounts.soon} color="var(--success)" />
          </div>
        </div>

        <AssignmentGroup
          title="Overdue"
          items={assignmentAlerts.filter(a => a.priority === 'overdue')}
          color="var(--danger)"
          badge="!"
        />
        <AssignmentGroup
          title="Due Today"
          items={assignmentAlerts.filter(a => a.priority === 'today')}
          color="var(--warning)"
          badge="1"
        />
        <AssignmentGroup
          title="Next 3 Days"
          items={assignmentAlerts.filter(a => a.priority === 'soon')}
          color="var(--success)"
          badge="3"
        />
      </div>
      <Section title="Critical Alerts" items={critical} color="var(--danger)" emoji="🔴" />
      <Section title="Warnings" items={warnings} color="var(--warning)" emoji="🟡" />
      <Section title="Good News" items={positives} color="var(--success)" emoji="🟢" />
    </div>
  );
}
