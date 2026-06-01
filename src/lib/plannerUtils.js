export const DEFAULT_TERM_WEEKS = 13;

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getCourseTermKey = (course = {}) => {
  if (course.termKey) return String(course.termKey);
  if (course.year && course.term) return `Y${course.year}T${course.term}`;
  return '';
};

export const matchesTerm = (course = {}, termKey = '') => {
  if (!termKey) return true;
  const courseTermKey = getCourseTermKey(course);
  return !courseTermKey || courseTermKey === termKey;
};

export const computeDefaultTotalClasses = (credits = 0, type = 'Theory') => {
  const credit = safeNumber(credits, 0);
  const normalizedType = String(type || 'Theory').toLowerCase();

  if (normalizedType === 'theory') {
    if (credit >= 4) return 52;
    if (credit >= 3) return 39;
    if (credit >= 2) return 26;
    return Math.max(13, Math.round(credit * 13) || 13);
  }

  if (normalizedType === 'sessional' || normalizedType === 'lab') {
    if (Math.abs(credit - 0.75) < 0.01) return 6;
    if (Math.abs(credit - 1.5) < 0.01) return 12;
    return Math.max(4, Math.round(credit * 8) || 4);
  }

  return Math.max(4, Math.round(credit * 13) || 4);
};

export const computePerWeekTarget = (totalClasses = 0, weeksInTerm = DEFAULT_TERM_WEEKS) => {
  const total = safeNumber(totalClasses, 0);
  const weeks = Math.max(1, safeNumber(weeksInTerm, DEFAULT_TERM_WEEKS));
  if (total <= 0) return 0;
  return Math.max(1, Math.ceil(total / weeks));
};

export const distributeBetweenTeachers = (totalClasses = 0, teacherCount = 2) => {
  const total = Math.max(0, safeNumber(totalClasses, 0));
  const count = Math.max(1, Math.min(2, safeNumber(teacherCount, 2)));
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
};

export const normalizeTeacherList = (teachers = []) => {
  if (!Array.isArray(teachers)) return [];
  return [...new Set(teachers.map(value => String(value || '').trim()).filter(Boolean))].slice(0, 2);
};

export const createDefaultCoursePlan = ({ course, termKey, teachers = [], weeksInTerm = DEFAULT_TERM_WEEKS }) => {
  const assignedTeachers = normalizeTeacherList(teachers);
  const plannedTotalClasses = computeDefaultTotalClasses(course?.credits, course?.type);
  const teacherShares = distributeBetweenTeachers(plannedTotalClasses, assignedTeachers.length || 1);

  return {
    termKey,
    courseId: course?.id || '',
    code: course?.code || '',
    name: course?.name || '',
    credits: safeNumber(course?.credits, 0),
    type: course?.type || 'Theory',
    plannedTotalClasses,
    perWeekTarget: computePerWeekTarget(plannedTotalClasses, weeksInTerm),
    teachers: assignedTeachers,
    teacherShares,
    completed: 0,
    completedByTeacher: {},
    logs: [],
    updatedAt: new Date().toISOString(),
  };
};

export const getPlanCompletionCount = (plan = {}) => {
  if (Number.isFinite(plan.completed)) return plan.completed;
  return Array.isArray(plan.logs) ? plan.logs.length : 0;
};

export const getPlanTeacherCounts = (plan = {}) => {
  const counts = {};
  (Array.isArray(plan.logs) ? plan.logs : []).forEach(log => {
    const teacher = String(log?.teacher || '').trim();
    if (!teacher) return;
    counts[teacher] = (counts[teacher] || 0) + 1;
  });
  return counts;
};

export const getCourseTeacherCountsFromSchedule = (schedule = [], courseId = '') => {
  const counts = {};
  (Array.isArray(schedule) ? schedule : []).forEach(entry => {
    if (!entry || entry.courseId !== courseId) return;
    const teacher = String(entry.teacherName || '').trim();
    if (!teacher) return;
    counts[teacher] = (counts[teacher] || 0) + 1;
  });
  return counts;
};

export const getCourseScheduleEntries = (schedule = [], courseId = '') => {
  return (Array.isArray(schedule) ? schedule : [])
    .filter(entry => entry && entry.courseId === courseId)
    .slice();
};

export const buildExportPayload = ({ termKey, plannerState, settings, schedule }) => ({
  meta: {
    version: 1,
    termKey,
    exportedAt: new Date().toISOString(),
  },
  classManagementPlans: plannerState || {},
  scheduleSettings: settings || {},
  schedule: Array.isArray(schedule) ? schedule : [],
});
