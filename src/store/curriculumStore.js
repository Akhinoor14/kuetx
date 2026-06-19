import { CURRICULUM } from '../data/curriculum/index.js';
import { DEPARTMENTS, TERM_KEYS, getCurrentTermKey, getTermIndex, getTermKeyFromLabel, getTermLabelFromKey, store } from './store.js';

// Simple in-memory memoization to avoid recomputing full course lists repeatedly
const allCoursesCache = new Map();
const buildCacheKey = (profile) => {
  try {
    const dept = profile?.dept || '';
    const term = getCurrentTermKey(profile) || TERM_KEYS[0];
    const optionals = JSON.stringify(store.get('optionalSelections') || {});
    const overrides = JSON.stringify(store.get('courseOverrides') || {});
    const customs = JSON.stringify(store.get('customCourses') || []);
    return `${dept}|${term}|${optionals}|${overrides}|${customs}`;
  } catch {
    return 'default';
  }
};

const clearAllCoursesCache = () => allCoursesCache.clear();

const inferCourseTypeFromCode = (code, currentType) => {
  if (!code || typeof code !== 'string') return currentType || 'Theory';

  const matches = code.match(/\d+/g);
  if (!matches || matches.length === 0) return currentType || 'Theory';

  const digits = matches.join('');
  if (digits.length === 0) return currentType || 'Theory';

  const lastDigit = digits[digits.length - 1];
  const numeric = parseInt(lastDigit, 10);

  if (!Number.isFinite(numeric)) return currentType || 'Theory';

  return (numeric % 2 === 0) ? 'Sessional' : 'Theory';
};

const parseTermKey = (termKey) => {
  const match = String(termKey || '').match(/Y(\d+)T(\d+)/);
  if (!match) return { year: null, term: null };
  return { year: Number(match[1]), term: Number(match[2]) };
};

const getDeptCurriculum = (deptCode) => {
  const found = CURRICULUM?.departments?.[deptCode];
  if (found) return found;
  const metaDef = DEPARTMENTS.find(department => department?.code === deptCode) || { code: deptCode, name: deptCode, acronym: deptCode };
  return {
    meta: { code: metaDef.code || deptCode, name: metaDef.name || deptCode, acronym: metaDef.acronym || metaDef.code || deptCode },
    terms: {},
    optional: [],
    notes: {},
    syllabus: { terms: {}, courses: {} },
  };
};

export const getDeptTerms = (deptCode) => getDeptCurriculum(deptCode)?.terms || {};

export const getTermCreditsFromCurriculum = (deptCode, termKey) => {
  const deptTerms = getDeptTerms(deptCode);
  const coursesInTerm = deptTerms[termKey] || [];
  return coursesInTerm.reduce((sum, course) => {
    if (course.type === 'NonCredit') return sum;
    return sum + (course.credits || 0);
  }, 0);
};

export const getDeptOptionalCourses = (deptCode) => getDeptCurriculum(deptCode)?.optional || [];

export const getDeptSyllabus = (deptCode) => getDeptCurriculum(deptCode)?.syllabus || null;

export const buildCourseId = (deptCode, termKey, code) => `${deptCode}:${termKey}:${code}`;

const getCustomCourses = () => {
  const custom = store.get('customCourses');
  if (Array.isArray(custom)) return custom;
  const legacy = store.get('courses') || [];
  if (legacy.length) {
    const migrated = legacy.map(c => ({ ...c, source: c.source || 'custom' }));
    store.set('customCourses', migrated);
    return migrated;
  }
  return [];
};

// Merge any stored course overrides into custom course records so UI updates (status, notes, etc.) apply
const getCustomCoursesWithOverrides = () => {
  const custom = store.get('customCourses') || [];
  const overrides = getCourseOverrides();
  if (!Array.isArray(custom)) return [];
  return custom.map(c => {
    const o = overrides[c.id];
    return o ? { ...c, ...o } : c;
  });
};

const getCourseOverrides = () => store.get('courseOverrides') || {};

const getOptionalSelections = () => store.get('optionalSelections') || {};

const resolveOptionalCourse = (deptCode, selectedCode) => {
  if (!selectedCode) return null;
  return getDeptOptionalCourses(deptCode).find(c => c.code === selectedCode) || null;
};

const buildCourseRecord = ({ deptCode, termKey, base, status, optionalSlotIndex }) => {
  const { year, term } = parseTermKey(termKey);
  const overrides = getCourseOverrides();
  const courseId = base.isOptional
    ? `${deptCode}:${termKey}:OPT${(optionalSlotIndex || 0) + 1}`
    : buildCourseId(deptCode, termKey, base.code);
  const optionalSelections = getOptionalSelections();
  const selectedOptionalCode = optionalSlotIndex !== null
    ? optionalSelections?.[deptCode]?.[termKey]?.[optionalSlotIndex]
    : '';
  const optionalCourse = base.isOptional ? resolveOptionalCourse(deptCode, selectedOptionalCode) : null;
  const resolvedCode = optionalCourse?.code || base.code;
  const resolvedTitle = optionalCourse?.title || base.title;
  const resolvedCredits = optionalCourse?.credits ?? base.credits;
  const record = {
    id: courseId,
    source: 'curriculum',
    deptCode,
    year,
    term,
    status,
    isCore: true,
    notes: '',
    contactHours: base.contactHours || '',
    type: base.type,
    credits: resolvedCredits,
    code: resolvedCode,
    name: resolvedTitle,
    isOptional: !!base.isOptional,
    optionalSlotIndex,
    optionalCode: optionalCourse?.code || '',
    baseCode: base.code,
  };
  const override = overrides[record.id];
  return override ? { ...record, ...override } : record;
};

const buildBaseCoursesFromSyllabus = (termObj) => {
  if (!termObj || !termObj.courses || typeof termObj.courses !== 'object') return [];
  return Object.entries(termObj.courses).map(([code, info]) => ({
    code,
    title: info.title || info.name || '',
    credits: info.credit ?? info.credits ?? info.creditsPerTerm ?? 0,
    contactHours: info.contactHour || info.contactHours || '',
    type: info.type || (info.sessionalNote ? 'Sessional' : 'Theory'),
    isOptional: !!info.isOptional,
  }));
};

export const syncCurriculumCourses = (profile) => {
  const current = profile || {};
  if (!current?.dept) return getCustomCourses();
  const termKey = getCurrentTermKey(current) || TERM_KEYS[0];
  const currentIndex = Math.max(0, getTermIndex(termKey));
  const deptTerms = getDeptTerms(current.dept);
  const deptSyllabus = getDeptSyllabus(current.dept) || { terms: {} };

  const curriculumCourses = TERM_KEYS
    .filter((key, index) => index <= currentIndex)
    .flatMap((key, index) => {
      let baseCourses = Array.isArray(deptTerms[key]) ? deptTerms[key] : [];

      if ((!Array.isArray(baseCourses) || baseCourses.length === 0) && deptSyllabus?.terms?.[key]) {
        baseCourses = buildBaseCoursesFromSyllabus(deptSyllabus.terms[key]);
      }

      if (Array.isArray(baseCourses) && baseCourses.length > 0) {
        baseCourses = baseCourses.map(course => ({ ...course, type: inferCourseTypeFromCode(course.code, course.type) }));
      }

      let optionalSlot = 0;
      return (baseCourses || []).map(base => {
        const status = index === currentIndex ? 'active' : 'completed';
        const slotIndex = base.isOptional ? optionalSlot++ : null;
        return buildCourseRecord({ deptCode: current.dept, termKey: key, base, status, optionalSlotIndex: slotIndex });
      });
    });

  return [...curriculumCourses, ...getCustomCoursesWithOverrides()];
};

export const getAllCourses = (profile) => {
  const key = buildCacheKey(profile || {});
  if (allCoursesCache.has(key)) return allCoursesCache.get(key);
  const v = syncCurriculumCourses(profile);
  try { allCoursesCache.set(key, v); } catch {}
  return v;
};

export const setOptionalSelection = ({ deptCode, termKey, slotIndex, code }) => {
  const current = getOptionalSelections();
  const dept = current[deptCode] || {};
  const term = dept[termKey] || [];
  const nextTerm = term.slice();
  nextTerm[slotIndex] = code || '';
  const next = { ...current, [deptCode]: { ...dept, [termKey]: nextTerm } };
  store.set('optionalSelections', next);
  // Invalidate memoized course lists when optional selections change
  try { clearAllCoursesCache(); } catch {}
  return next;
};

export { clearAllCoursesCache };
