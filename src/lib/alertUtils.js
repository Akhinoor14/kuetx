import { store, computeCourseGrade, computeCGPA, computeEffectiveAttendance, computeTermGPAs, MIN_ATTENDANCE_PERCENT, SCHOLARSHIP_ATTENDANCE_PCT, MAX_THEORY_COURSES_PER_TERM, MIN_CREDITS_FIRST_4_TERMS, MIN_CREDITS_FIRST_6_TERMS, HONORS_CGPA, DEANS_LIST_GPA, getCurrentTermKey, getTermTimeline, PRODUCTIVE_TIME_CATEGORIES, getTimerSessions } from '../store/store';
import { getAllCourses } from '../store/curriculumStore';

export const ALERT_DISMISSED_KEY = 'alertDismissedIds_v1';

const normalizeAlertPart = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

export const getAlertId = (group, item, index = 0) => {
  const parts = [
    group,
    item?.kind,
    item?.priority,
    item?.title,
    item?.teacherLabel,
    item?.courseLabel,
    item?.dueLabel,
    item?.link,
    item?.msg,
    index,
  ]
    .filter(part => part !== undefined && part !== null && String(part).trim() !== '')
    .map(normalizeAlertPart);

  return parts.join('|');
};

export const getDismissedAlertIds = () => {
  const saved = store.get(ALERT_DISMISSED_KEY);
  return new Set(Array.isArray(saved) ? saved : []);
};

export const setAlertDismissed = (id, dismissed = true) => {
  if (!id) return;
  const saved = store.get(ALERT_DISMISSED_KEY);
  const next = new Set(Array.isArray(saved) ? saved : []);
  if (dismissed) next.add(id);
  else next.delete(id);
  store.set(ALERT_DISMISSED_KEY, [...next]);
};

export const decorateAlerts = (alerts, dismissedIds) => ({
  critical: alerts.critical.map((item, index) => ({ ...item, id: getAlertId('critical', item, index) })),
  warnings: alerts.warnings.map((item, index) => ({ ...item, id: getAlertId('warnings', item, index) })),
  positives: alerts.positives.map((item, index) => ({ ...item, id: getAlertId('positives', item, index) })),
  assignmentAlerts: alerts.assignmentAlerts.map((item, index) => ({ ...item, id: getAlertId('assignments', item, index) })),
  dismissedIds,
});

export const filterUnreadAlerts = (items, dismissedIds) => items.filter(item => !dismissedIds.has(item.id));

const normalizeTeacherLabel = (value) => String(value || '').trim().replace(/\s+/g, ' ');

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

  courses.filter(c => c.status === 'active' || c.status === 'backlog').forEach(c => {
    const { pct, held } = computeEffectiveAttendance(c.id);
    if (!held) return;
    if (pct < MIN_ATTENDANCE_PERCENT)
      critical.push({ msg: `${c.code}: Attendance ${pct}% — course will be CANCELLED (Art. 11.3)`, link: '/attendance' });
    else if (pct < SCHOLARSHIP_ATTENDANCE_PCT)
      warnings.push({ msg: `${c.code}: ${pct}% attendance — not eligible for scholarship (Art. 14.2)`, link: '/attendance' });
  });

  const theoryCounts = {};
  courses.filter(c => c.status === 'active' && c.type === 'Theory').forEach(c => {
    const k = `Y${c.year}T${c.term}`;
    theoryCounts[k] = (theoryCounts[k] || 0) + 1;
  });
  Object.entries(theoryCounts).forEach(([k, n]) => {
    if (n > MAX_THEORY_COURSES_PER_TERM)
      warnings.push({ msg: `${k}: ${n} theory courses — max is ${MAX_THEORY_COURSES_PER_TERM} (Art. 11.2)`, link: '/courses' });
  });

  courses.forEach(c => {
    const courseMarks = marks[c.id] || {};
    const hasPublishedResult = !!String(courseMarks.publishedGrade || courseMarks.resultGrade || '').trim();
    const isCurrentOngoingCourse = currentTermIsOngoing && currentTermCourseIds.has(c.id);

    if (isCurrentOngoingCourse && !hasPublishedResult) return;

    const { grade } = computeCourseGrade(c);
    if (grade === 'F' && c.isCore)
      critical.push({ msg: `${c.code}: F grade in core course — must repeat (Art. 16)`, link: '/results' });
  });

  courses.filter(c => c.status === 'backlog').forEach(c => {
    const { grade } = computeCourseGrade(c);
    if (grade === 'A+' || grade === 'A' || grade === 'A-')
      warnings.push({ msg: `${c.code}: Backlog course — grade capped at B+ (Art. 16)`, link: '/marks' });
  });

  const { cgpa, earnedCredits } = computeCGPA(courses);
  if (cgpa !== null) {
    if (cgpa < 2.20)  critical.push({ msg: `CGPA ${cgpa.toFixed(2)} < 2.20 — Academic probation risk! (Art. 20)`, link: '/results' });
    if (cgpa >= HONORS_CGPA) positives.push({ msg: `CGPA ${cgpa.toFixed(2)} ≥ 3.75 — Honors eligible (Art. 18.1) 🎓`, link: '/results' });
    if (cgpa >= DEANS_LIST_GPA) positives.push({ msg: `On track for Dean's List — maintain in both terms, no F grades (Art. 18.2) 📋`, link: '/results' });
    if (cgpa >= 3.75 && earnedCredits >= 100) positives.push({ msg: `Gold Medal track — finish in 4 years with no F (Art. 18.3) 🏅`, link: '/results' });
  }

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

  const allTermKeys = [...new Set(courses.map(c => `Y${c.year}T${c.term}`))].sort();
  const termsWithNoEntry = {};
  allTermKeys.forEach(termKey => {
    if (termKey === currentTermKey) return;
    const termCourses = courses.filter(c => `Y${c.year}T${c.term}` === termKey && (c.status === 'active' || c.status === 'backlog'));
    if (termCourses.length === 0) return;
    const allNoEntry = termCourses.every(c => {
      const courseMarks = marks[c.id] || {};
      const hasAnyEntry = Object.values(courseMarks).some(v => v !== '' && v !== null && v !== undefined);
      return !hasAnyEntry;
    });
    if (allNoEntry) {
      termsWithNoEntry[termKey] = true;
    }
  });

  Object.keys(termsWithNoEntry).sort().forEach(termKey => {
    warnings.push({ msg: `${termKey}: Please enter your result`, link: '/results' });
  });

  const termKeys = [...new Set(courses.map(c => `Y${c.year}T${c.term}`))].sort();
  const first4Keys = termKeys.filter(k => k <= 'Y2T2');
  if (first4Keys.length === 4) {
    const first4cr = courses
      .filter(c => first4Keys.includes(`Y${c.year}T${c.term}`))
      .reduce((s, c) => { const { grade, point } = computeCourseGrade(c); return grade !== 'F' && point >= 2.0 ? s + (c.credits || 0) : s; }, 0);
    if (first4cr < MIN_CREDITS_FIRST_4_TERMS)
      critical.push({ msg: `Only ${first4cr}/${MIN_CREDITS_FIRST_4_TERMS} credits in first 4 terms — Struck-off risk! (Art. 12.1.iv)`, link: '/results' });
  }

  if (earnedCredits >= 160) {
    positives.push({ msg: `Graduation credit milestone reached: ${earnedCredits}/160`, link: '/results' });
  }

  const totalCompletedCr = courses
    .filter(c => c.status === 'completed')
    .reduce((sum, course) => sum + (course.credits || 0), 0);

  if (totalCompletedCr < MIN_CREDITS_FIRST_6_TERMS && termKeys.length >= 6) {
    warnings.push({ msg: `Only ${totalCompletedCr}/${MIN_CREDITS_FIRST_6_TERMS} credits completed in the first 6 terms`, link: '/results' });
  }

  const sessions = getTimerSessions();
  const productiveMs = sessions
    .filter(session => PRODUCTIVE_TIME_CATEGORIES.includes(session.category))
    .reduce((sum, session) => sum + (session.actualMs || 0), 0);
  if (productiveMs > 0) {
    positives.push({ msg: `Productive focus: ${(productiveMs / 3600000).toFixed(1)}h logged`, link: '/time' });
  }

  return { critical, warnings, positives, assignmentAlerts };
}
