// KUETx Global Store
// Aligned with KUET Academic Ordinance (Effective 2nd Term, Session 2011-12)
// Approved: 18th & 19th Academic Council meetings (2012)
// Storage: IndexedDB (50MB+) with automatic migration from localStorage

import { initDB, getFromDB, setInDB, removeFromDB, getAllKeysFromDB, getAllFromDB, clearDB, migrateFromLocalStorage, getStorageUsage } from './indexeddb-store.js';
import { clearAllCoursesCache } from './curriculumStore.js';

const PREFIX = 'kuetx_';

// In-memory cache for synchronous access
const memoryCache = new Map();
let dbReady = false;

// Initialize database on first load
export async function ensureDBReady() {
  if (dbReady) return;
  try {
    await initDB();
    await migrateFromLocalStorage();
    // Pre-load all data into memory cache
    const allKeys = await getAllKeysFromDB();
    for (const key of allKeys) {
      const cacheKey = key;
      if (memoryCache.has(cacheKey)) continue;
      const value = await getFromDB(key.replace(PREFIX, ''));
      if (value !== null && value !== undefined) memoryCache.set(cacheKey, value);
    }
    dbReady = true;
    emitStoreUpdate();
  } catch (err) {
    console.error('[KUETx Store] Initialization error:', err);
  }
}

// DB preloading is invoked by the app bootstrap before first render.

const emitStoreUpdate = () => {
  try {
    window.dispatchEvent(new Event('kuetx:store-updated'));
  } catch {}
};

export const store = {
  get: (key) => {
    try {
      const cacheKey = PREFIX + key;
      if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey);
      // Sync fallback for instant reads
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          memoryCache.set(cacheKey, parsed);
          return parsed;
        } catch {}
      }
      return null;
    } catch {
      return null;
    }
  },
  
  set: (key, val) => {
    try {
      const cacheKey = PREFIX + key;
      memoryCache.set(cacheKey, val);
      try { localStorage.setItem(cacheKey, JSON.stringify(val)); } catch {}
      emitStoreUpdate();
      // Persist to IndexedDB asynchronously
      setInDB(key, val).catch(err => console.error('[KUETx Store] IDB set error:', err));
    } catch (err) {
      console.error('[KUETx Store] Set error:', err);
    }
  },
  
  remove: (key) => {
    try {
      const cacheKey = PREFIX + key;
      memoryCache.delete(cacheKey);
      try { localStorage.removeItem(cacheKey); } catch {}
      emitStoreUpdate();
      // Remove from IndexedDB asynchronously
      removeFromDB(key).catch(err => console.error('[KUETx Store] IDB remove error:', err));
    } catch (err) {
      console.error('[KUETx Store] Remove error:', err);
    }
  },
  
  exportAll: () => {
    const data = {};
    for (const [k, v] of memoryCache.entries()) {
      if (k.startsWith(PREFIX)) data[k] = v;
    }
    return data;
  },
  
  importAll: (data) => {
    try {
      Object.entries(data).forEach(([k, v]) => {
        if (k.startsWith(PREFIX)) {
          memoryCache.set(k, v);
          try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
          // Persist asynchronously
          setInDB(k.replace(PREFIX, ''), v).catch(err => console.error('[KUETx Store] IDB import error:', err));
        }
      });
      emitStoreUpdate();
    } catch (err) {
      console.error('[KUETx Store] Import error:', err);
    }
  },

  // Import with per-key reporting (returns { imported: [keys], failed: [{key,error}] })
  importAllReport: async (data) => {
    const report = { imported: [], failed: [] };
    try {
      for (const [k, v] of Object.entries(data)) {
        if (!k.startsWith(PREFIX)) continue;
        try {
          memoryCache.set(k, v);
          try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
          await setInDB(k.replace(PREFIX, ''), v);
          report.imported.push(k);
        } catch (err) {
          console.error('[KUETx Store] IDB import error:', err);
          report.failed.push({ key: k, error: String(err) });
        }
      }
      emitStoreUpdate();
    } catch (err) {
      console.error('[KUETx Store] ImportAllReport error:', err);
    }
    return report;
  },
  
  clearAll: () => {
    try {
      for (const k of memoryCache.keys()) {
        if (k.startsWith(PREFIX)) {
          memoryCache.delete(k);
          try { localStorage.removeItem(k); } catch {}
        }
      }
      emitStoreUpdate();
      // Clear IndexedDB asynchronously
      clearDB().catch(err => console.error('[KUETx Store] IDB clear error:', err));
    } catch (err) {
      console.error('[KUETx Store] Clear error:', err);
    }
  },
  
  // New: Get storage usage (for Settings page)
  getStorageUsage: async () => {
    try {
      return await getStorageUsage();
    } catch {
      return '0';
    }
  }
};

// ─── KUET Academic Constants (Article references) ──────────────────────────
export const MIN_CREDITS_GRADUATION      = 160;  // Art. 7.5
export const MAX_CORE_CREDITS            = 150;  // Art. 7.5
export const MAX_IMPROVEMENT_CREDITS     = 15;   // Art. 24
export const MAX_BACKLOG_CREDITS_PER_YEAR= 12;   // Art. 21(iii)
export const MIN_CREDITS_FIRST_4_TERMS   = 36;   // Art. 12.1(iv)
export const MIN_CREDITS_FIRST_6_TERMS   = 54;   // Art. 12.1(iv)
export const MAX_YEARS                   = 7;    // Art. 25
export const MAX_TERMS                   = 14;   // Art. 25
export const MAX_DISCONTINUANCE_TERMS    = 4;    // Art. 12.6
export const MIN_CGPA_GRADUATION         = 2.20; // Art. 17
export const MIN_GPA_NORMAL              = 2.20; // Art. 17
export const HONORS_CGPA                 = 3.75; // Art. 18.1
export const DEANS_LIST_GPA              = 3.75; // Art. 18.2
export const GOLD_MEDAL_CGPA             = 3.75; // Art. 18.3
export const MAX_THEORY_COURSES_PER_TERM = 5;    // Art. 11.2
export const TERM_DURATION_DAYS          = 180;  // ~6 months (13 weeks class + exam + buffer)
export const MIN_CREDITS_PER_TERM        = 15;   // Art. 11.2
export const MAX_CREDITS_PER_TERM        = 24;   // Art. 11.2
export const REGISTRATION_WORKING_DAYS  = 8;    // Art. 11.5
export const LATE_REG_EXTRA_DAYS        = 7;    // Art. 11.5 (total 15)
export const COURSE_ADD_DAYS            = 10;   // Art. 11.7
export const COURSE_DROP_DAYS           = 15;   // Art. 11.7
export const MIN_ATTENDANCE_PERCENT     = 60;   // Art. 11.3
export const SCHOLARSHIP_ATTENDANCE_PCT = 75;   // Art. 14.2
export const BACKLOG_MAX_GRADE          = 'B+'; // Art. 16
export const BACKLOG_MAX_POINT          = 3.25; // Art. 16

// ─── KUET Departments — all 16 (Art. 2) ───────────────────────────────────
export const DEPARTMENTS = [
  { code: 'CE',   name: 'Civil Engineering',                          seats: 120 },
  { code: 'EEE',  name: 'Electrical & Electronic Engineering',        seats: 120 },
  { code: 'ME',   name: 'Mechanical Engineering',                     seats: 120 },
  { code: 'CSE',  name: 'Computer Science & Engineering',             seats: 120 },
  { code: 'ECE',  name: 'Electronics & Communication Engineering',    seats: 60  },
  { code: 'IPE',  name: 'Industrial Engineering & Management',        seats: 60  },
  { code: 'BECM', name: 'Building Engineering & Construction Management', seats: 60 },
  { code: 'Arch', name: 'Architecture',                               seats: 40  },
  { code: 'URP',  name: 'Urban & Regional Planning',                  seats: 60  },
  { code: 'LE',   name: 'Leather Engineering',                        seats: 60  },
  { code: 'TE',   name: 'Textile Engineering',                        seats: 60  },
  { code: 'BME',  name: 'Biomedical Engineering',                     seats: 30  },
  { code: 'MSE',  name: 'Materials Science & Engineering',            seats: 60  },
  { code: 'ESE',  name: 'Energy Science & Engineering',               seats: 30  },
  { code: 'ChE',  name: 'Chemical Engineering',                       seats: 30  },
  { code: 'MTE',  name: 'Mechatronics Engineering',                   seats: 30  },
];
export const DEPT_CODES = DEPARTMENTS.map(d => d.code);

// ─── Curriculum Term Helpers ─────────────────────────────────────────────
export const TERM_KEYS = ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];

// ─── KUET Grading Scale (Art. 13.1) ───────────────────────────────────────
export const GRADE_SCALE = [
  { grade: 'A+', label: 'A Plus',  point: 4.00, minPct: 80 },
  { grade: 'A',  label: 'A',       point: 3.75, minPct: 75 },
  { grade: 'A-', label: 'A Minus', point: 3.50, minPct: 70 },
  { grade: 'B+', label: 'B Plus',  point: 3.25, minPct: 65 },
  { grade: 'B',  label: 'B',       point: 3.00, minPct: 60 },
  { grade: 'B-', label: 'B Minus', point: 2.75, minPct: 55 },
  { grade: 'C+', label: 'C Plus',  point: 2.50, minPct: 50 },
  { grade: 'C',  label: 'C',       point: 2.25, minPct: 45 },
  { grade: 'D',  label: 'D',       point: 2.00, minPct: 40 },
  { grade: 'F',  label: 'F',       point: 0.00, minPct: 0  },
];
// Special grades (Art. 13.1): X=continuous assessment, W=withdrawal, S/U=non-credit
export const SPECIAL_GRADES = ['X', 'W', 'S', 'U'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(+value) ? +value : 0));

export const getGradePointByGrade = (grade) => {
  const item = GRADE_SCALE.find(g => g.grade === grade);
  return item ? item.point : 0;
};

export const getLegacyTermResults = () => {
  const raw = store.get('legacyTermResults');
  return Array.isArray(raw) ? raw : [];
};

export const setLegacyTermResults = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  store.set('legacyTermResults', list);
  return list;
};

export const getGradeFromPct = (pct) => {
  if (pct === null || pct === undefined || isNaN(pct)) return GRADE_SCALE[GRADE_SCALE.length - 1];
  for (const g of GRADE_SCALE) { if (pct >= g.minPct) return g; }
  return GRADE_SCALE[GRADE_SCALE.length - 1];
};

// ─── Attendance Marks (Art. 14.2) — 10% covers participation+attendance+assignments
export const getAttendanceMarks = (pct) => {
  if (pct >= 90) return 10;
  if (pct >= 85) return 9;
  if (pct >= 80) return 8;
  if (pct >= 75) return 7;
  if (pct >= 70) return 6;
  if (pct >= 65) return 5;
  if (pct >= 60) return 4;
  return 0; // below 60% → course cancelled (Art. 11.3)
};

export const getAttendanceStatus = (pct) => {
  if (pct === null || pct === undefined) return null;
  if (pct < MIN_ATTENDANCE_PERCENT) return 'cancelled';
  if (pct < SCHOLARSHIP_ATTENDANCE_PCT) return 'noScholarship';
  return 'safe';
};

// ─── Mark Distribution (Art. 14) ──────────────────────────────────────────
export const MARK_WEIGHTS = {
  theory:    { participation: 10, classTests: 20, termFinal: 70 },
  sessional: { attendance: 10, labQuizViva: 20, centralViva: 20, performance: 50 },
  project:   { term1: { supervisorMark: 20, presentationViva: 10 },
               term2: { supervisorMark: 40, presentationViva: 20, externalExaminer: 10 } },
};

// ─── Course Types (Art. 7.4) ──────────────────────────────────────────────
export const COURSE_TYPES = [
  { id: 'Theory',    label: 'Theory / Lecture',    creditPerHr: 1.00, maxCredit: 4.0 },
  { id: 'Sessional', label: 'Lab / Sessional',     creditPerHr: 0.75, maxCredit: 3.0 },
  { id: 'Project',   label: 'Project / Thesis',    creditPerHr: 0.75, maxCredit: 3.0 },
  { id: 'Field',     label: 'Field Work',          creditPerHr: 1.00, maxCredit: 2.0 },
  { id: 'NonCredit', label: 'Non-Credit (S/U)',    creditPerHr: 0,    maxCredit: 0   },
];

export const COURSE_STATUSES = [
  { id: 'active',     label: 'Active (Current Term)' },
  { id: 'completed',  label: 'Completed' },
  { id: 'backlog',    label: 'Backlog (F — must repeat)' },
  { id: 'withdrawal', label: 'Withdrawal (Art. 11.8)' },
  { id: 'incomplete', label: 'Incomplete (Art. 9.7)' },
];

// ─── Grade Conversion (Art. 29) ───────────────────────────────────────────
export const cgpaToPercent = (cgpa) => {
  if (!cgpa) return 0;
  if (cgpa >= 3.75) return 79 + 80 * (cgpa - 3.75);
  if (cgpa >= 2.20) return 44 + 20 * (cgpa - 2.00);
  return 0;
};

// ─── Year Classification (Art. 19) ────────────────────────────────────────
export const getYearClass = (earned) => {
  if (earned > 90) return '4th Year';
  if (earned > 60) return '3rd Year';
  if (earned > 30) return '2nd Year';
  return '1st Year';
};

// ─── Utilities ────────────────────────────────────────────────────────────
export const uid = () => Math.random().toString(36).slice(2, 9);
export const formatGPA = (n) => (+n || 0).toFixed(2);

// ─── Time Tracker helpers ────────────────────────────────────────────────
const TIMER_ACTIVE_KEY = 'timerActiveState_v1';
const TIMER_SESSIONS_KEY = 'timerSessions_v1';
const TIMER_PREFS_KEY = 'timer_prefs_v1';

export const TIMER_MODES = {
  UP: 'up',
  DOWN: 'down',
};

export const PRODUCTIVE_TIME_CATEGORIES = ['Study', 'Class', 'Self Study', 'Exercise'];
export const DISTRACTION_TIME_CATEGORIES = ['Facebook/YouTube', 'Gaming'];

export const msToHms = (ms) => {
  const safeMs = Math.max(0, Number.isFinite(+ms) ? +ms : 0);
  const totalSeconds = Math.floor(safeMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return { hours, minutes, seconds, totalSeconds };
};

export const formatDurationMs = (ms) => {
  const { hours, minutes, seconds } = msToHms(ms);
  return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':');
};

export const hoursFromMs = (ms) => {
  const safeMs = Math.max(0, Number.isFinite(+ms) ? +ms : 0);
  return +(safeMs / 3600000).toFixed(2);
};

export const getTimerActiveState = () => {
  const raw = store.get(TIMER_ACTIVE_KEY);
  return raw && typeof raw === 'object' ? raw : null;
};

export const setTimerActiveState = (state) => {
  if (!state || typeof state !== 'object') return;
  store.set(TIMER_ACTIVE_KEY, state);
};

export const clearTimerActiveState = () => {
  store.remove(TIMER_ACTIVE_KEY);
};

const normalizeTimerSessions = (sessions) => {
  if (!Array.isArray(sessions)) return [];
  const seen = new Set();
  return sessions.map((session) => {
    const current = session && typeof session === 'object' ? { ...session } : { id: uid() };
    let nextId = current.id || uid();
    while (seen.has(nextId)) nextId = uid();
    seen.add(nextId);
    return { ...current, id: nextId };
  });
};

const getTimerSessionSortTs = (session) => {
  if (!session || typeof session !== 'object') return 0;
  return Number(session.savedAt || session.endedAt || session.updatedAt || session.createdAt || 0) || 0;
};

const sortTimerSessions = (sessions) => {
  return normalizeTimerSessions(sessions)
    .sort((a, b) => {
      const diff = getTimerSessionSortTs(b) - getTimerSessionSortTs(a);
      if (diff !== 0) return diff;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
};

export const getTimerSessions = () => {
  const raw = store.get(TIMER_SESSIONS_KEY);
  return sortTimerSessions(raw);
};

export const setTimerSessions = (sessions) => {
  store.set(TIMER_SESSIONS_KEY, sortTimerSessions(sessions));
};

export const appendTimerSession = (session) => {
  const list = getTimerSessions();
  const next = sortTimerSessions([session, ...list]).slice(0, 600);
  setTimerSessions(next);
  return next;
};

export const getTimerPrefs = () => {
  try {
    const raw = store.get(TIMER_PREFS_KEY);
    if (raw && typeof raw === 'object') return raw;
  } catch {}
  return { sound: true, vibrate: true, notify: true };
};

export const setTimerPrefs = (prefs) => {
  try {
    const next = { sound: true, vibrate: true, notify: true, ...(prefs || {}) };
    store.set(TIMER_PREFS_KEY, next);
    return next;
  } catch {
    return { sound: true, vibrate: true, notify: true };
  }
};

// Timer templates (per-category presets)
const TIMER_TEMPLATES_KEY = 'timer_templates_v1';
export const getTimerTemplates = () => {
  try {
    const raw = store.get(TIMER_TEMPLATES_KEY);
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
};

export const setTimerTemplates = (templates) => {
  try {
    const next = Array.isArray(templates) ? templates : [];
    store.set(TIMER_TEMPLATES_KEY, next);
    return next;
  } catch { return []; }
};

export const saveTimerTemplate = (template) => {
  try {
    const list = getTimerTemplates();
    const t = { id: template.id || uid(), name: template.name || 'Preset', category: template.category || 'Study', mode: template.mode || TIMER_MODES.DOWN, ms: template.ms || 1500000 };
    const next = [t, ...list.filter(x => x.id !== t.id)];
    setTimerTemplates(next);
    return t;
  } catch { return null; }
};

export const removeTimerTemplate = (id) => {
  try {
    const list = getTimerTemplates();
    const next = list.filter(t => t.id !== id);
    setTimerTemplates(next);
    return next;
  } catch { return getTimerTemplates(); }
};

// Working-day adder — skips Friday & Saturday (Bangladesh weekend)
export const addWorkingDays = (startDate, days) => {
  const date = new Date(startDate + 'T00:00:00');
  let count = 0;
  while (count < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 5 && day !== 6) count++;
  }
  return date;
};

const localDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getLocalDateKey = (date = new Date()) => localDateKey(date);

export const isRoutineHoliday = (dateStr, holidayDates = []) => {
  const dayOfWeek = new Date(`${dateStr}T00:00:00`).getDay();
  return dayOfWeek === 5 || dayOfWeek === 6 || holidayDates.includes(dateStr);
};

export const getNextRoutineDate = (startDateStr, holidayDates = []) => {
  const date = new Date(`${startDateStr}T00:00:00`);
  for (let i = 0; i < 400; i++) {
    const key = localDateKey(date);
    if (!isRoutineHoliday(key, holidayDates)) return key;
    date.setDate(date.getDate() + 1);
  }
  return startDateStr;
};

export const getRoutinePreviewDate = (holidayDates = [], now = new Date()) => {
  const base = new Date(now);
  if (base.getHours() >= 17) base.setDate(base.getDate() + 1);
  return getNextRoutineDate(localDateKey(base), holidayDates);
};

// ─── UNIFIED COMPUTATION FUNCTIONS ────────────────────────────────────────
// These are the single source of truth used by ALL pages.
// Reading from both 'attLogs' (daily) and 'attendance' (manual).

// Get effective attendance for a course — daily logs take priority
export const computeEffectiveAttendance = (courseId) => {
  const source = store.get('attAttendanceSource') || 'daily';
  if (source === 'combined') {
    const combined = store.get('attCombinedData') || {};
    let held = 0, attended = 0;
    Object.entries(combined).forEach(([key, value]) => {
      if (key === courseId || key.startsWith(`${courseId}_`)) {
        const h = Number(value?.held || 0);
        const a = Number(value?.attended || 0);
        held += h;
        attended += a;
      }
    });
    if (held > 0) return { held, attended, pct: Math.round((attended / held) * 100), source: 'combined' };
    return { held: 0, attended: 0, pct: null, source: 'combined' };
  }

  const logs   = store.get('attLogs') || {};
  const manual = store.get('attendance') || {};
  let held = 0, attended = 0;
  Object.values(logs).forEach(dayLog => {
    const v = dayLog[courseId];
    if (v === 'present' || v === 'absent') {
      held++;
      if (v === 'present') attended++;
    }
  });
  if (held > 0) return { held, attended, pct: Math.round((attended / held) * 100), source: 'log' };
  const m = manual[courseId];
  if (m?.held) {
    const a = m.attended || 0;
    return { held: m.held, attended: a, pct: Math.round((a / m.held) * 100), source: 'manual' };
  }
  return { held: 0, attended: 0, pct: null, source: 'none' };
};

// Compute grade for one course
export const computeCourseGrade = (course) => {
  if (!course) return { grade: 'F', point: 0, total: 0 };

  // Lightweight memoization: avoid recomputing grades repeatedly when marks object hasn't changed
  try {
    if (typeof computeCourseGrade._marksRef === 'undefined') {
      computeCourseGrade._marksRef = null;
      computeCourseGrade._cache = new Map();
    }
    const currentMarksRef = store.get('marks') || {};
    if (currentMarksRef !== computeCourseGrade._marksRef) {
      computeCourseGrade._marksRef = currentMarksRef;
      computeCourseGrade._cache = new Map();
    }
    if (computeCourseGrade._cache.has(course.id)) return computeCourseGrade._cache.get(course.id);
  } catch (e) {}
  const marks = store.get('marks') || {};
  const m = marks[course.id] || {};
  const hasAnyEntry = Object.entries(m).some(([key, value]) => key !== '__termMarkedNotPublished' && value !== '' && value !== null && value !== undefined);

  const termKey = `Y${course.year}T${course.term}`;
  const nyp = store.get('notYetPublishedTerms');
  const termMarkedNotPublished = Array.isArray(nyp) && nyp.includes(termKey);

  if (termMarkedNotPublished && !hasAnyEntry) {
    return { grade: 'NOT YET PUBLISHED', point: null, total: null, isNotPublished: true };
  }

  if (!hasAnyEntry && course.type !== 'NonCredit') {
    return { grade: '—', point: null, total: null, isNoEntry: true };
  }

  // If the term is explicitly marked as Not Yet Published in store,
  // treat the course as not-published so pages don't show F or count it.
  try {
    if (termMarkedNotPublished) {
      // compute a best-effort total for display but do not expose a failing grade
      // fall through to compute total below, then override result at return time
      m.__termMarkedNotPublished = true;
    }
  } catch (e) {}

  const publishedGrade = String(m.publishedGrade || '').trim().toUpperCase();
  if (publishedGrade) {
    let point = getGradePointByGrade(publishedGrade);
    if (course.status === 'backlog' && point > BACKLOG_MAX_POINT) {
      point = BACKLOG_MAX_POINT;
    }
    return {
      grade: publishedGrade,
      point,
      total: Number.isFinite(+m.publishedTotal) ? +(+m.publishedTotal).toFixed(1) : null,
      isPublished: true,
    };
  }

  if (course.type === 'NonCredit') {
    return { grade: m.suGrade || 'U', point: 0, total: 0, isNonCredit: true };
  }

  const { pct: attPct } = computeEffectiveAttendance(course.id);
  const attMarks = attPct !== null ? getAttendanceMarks(attPct) : 0;
  let total = 0;

  if (course.type === 'Theory') {
    const hasKuet300Fields = (
      m.hallTeacher1 !== undefined || m.hallTeacher2 !== undefined ||
      m.ctTeacher1 !== undefined || m.ctTeacher2 !== undefined ||
      m.assignment1 !== undefined || m.assignment2 !== undefined ||
      m.ctBonus1 !== undefined || m.ctBonus2 !== undefined
    );

    if (m.theoryMode === 'kuet300' || hasKuet300Fields) {
      const hallTeacher1 = clamp(m.hallTeacher1, 0, 105);
      const hallTeacher2 = clamp(m.hallTeacher2, 0, 105);

      const ctTeacher1 = clamp(m.ctTeacher1, 0, 30);
      const ctTeacher2 = clamp(m.ctTeacher2, 0, 30);
      const ctBonus1 = clamp(m.ctBonus1, 0, 30);
      const ctBonus2 = clamp(m.ctBonus2, 0, 30);

      const ctEffective1 = clamp(ctTeacher1 + ctBonus1, 0, 30);
      const ctEffective2 = clamp(ctTeacher2 + ctBonus2, 0, 30);

      const assignment1 = clamp(m.assignment1, 0, 15);
      const assignment2 = clamp(m.assignment2, 0, 15);

      const attendancePerTeacher = attPct !== null ? (attMarks / 10) * 15 : 0;
      const attendanceCap1 = Math.max(0, 15 - assignment1);
      const attendanceCap2 = Math.max(0, 15 - assignment2);

      const attendanceFromAuto1 = Math.min(attendancePerTeacher, attendanceCap1);
      const attendanceFromAuto2 = Math.min(attendancePerTeacher, attendanceCap2);

      const attendance1 = m.useAutoAtt === false
        ? clamp(m.attTeacher1, 0, attendanceCap1)
        : attendanceFromAuto1;
      const attendance2 = m.useAutoAtt === false
        ? clamp(m.attTeacher2, 0, attendanceCap2)
        : attendanceFromAuto2;

      const teacherContinuous1 = ctEffective1 + assignment1 + attendance1;
      const teacherContinuous2 = ctEffective2 + assignment2 + attendance2;

      const rawTotal = hallTeacher1 + hallTeacher2 + teacherContinuous1 + teacherContinuous2;
      const cappedTotal = clamp(rawTotal, 0, 300);
      total = (cappedTotal / 300) * 100;
    } else {
      // Backward-compatible flexible structure
      const finalMax   = +(m.finalMax   || 70);
      const ctTotalMax = +(m.ctTotalMax || 20);
      const partMax    = +(m.partMax    || 10);
      const rawMax     = finalMax + ctTotalMax + partMax;
      const finalObt   = +(m.final   || 0);
      const ctObt      = +(m.ctTotal || 0);
      let partObt;
      if (m.useAutoAtt && attPct !== null) {
        partObt = (attMarks / 10) * partMax;
      } else {
        partObt = +(m.part || 0);
      }
      const rawTotal = finalObt + ctObt + partObt;
      total = rawMax > 0 ? (rawTotal / rawMax) * 100 : 0;
    }
  } else if (course.type === 'Sessional') {
    const resultGrade = String(m.resultGrade || '').trim().toUpperCase();
    if (resultGrade) {
      return {
        grade: resultGrade,
        point: getGradePointByGrade(resultGrade),
        total: null,
        isPublished: true,
      };
    }
    const sessAtt = attPct !== null ? attMarks : +(m.manualAtt || 0);
    total = sessAtt + (m.quiz||0) + (m.centralViva||0) + (m.performance||0);
  } else if (course.type === 'Project') {
    // X grade in Term 1, final in Term 2
    if (m.projectComplete) {
      const t1 = (m.supervisorT1||0) + (m.vivaT1||0);       // 30%
      const t2 = (m.supervisorT2||0) + (m.vivaT2||0) + (m.external||0); // 70%
      total = t1 * 0.30 + t2 * 0.70;
    } else {
      return { grade: 'X', point: 0, total: 0, isX: true };
    }
  }

  let gradeObj = getGradeFromPct(total);
  if (course.status === 'backlog' && gradeObj.point > BACKLOG_MAX_POINT) {
    gradeObj = GRADE_SCALE.find(g => g.grade === 'B+');
  }
  // If this course's term was marked as Not Yet Published, don't expose a final grade
  if (m.__termMarkedNotPublished) {
    return { grade: 'NOT YET PUBLISHED', point: null, total: Number.isFinite(total) ? +total.toFixed(1) : null, isNotPublished: true };
  }
  return { grade: gradeObj.grade, point: gradeObj.point, total: +total.toFixed(1) };
  try { computeCourseGrade._cache.set(course.id, { grade: gradeObj.grade, point: gradeObj.point, total: +total.toFixed(1) }); } catch (e) {}
};

// Compute CGPA across all courses
export const computeCGPA = (courses) => {
  let pts = 0, cr = 0, earnedCredits = 0;
  // Per-term resolution for legacy import: 'use_legacy' | 'use_courses'
  const resolutions = store.get('legacyTermResolution') || {};
  const legacyRows = getLegacyTermResults();
  const legacyTermKeys = new Set(legacyRows.map(row => row?.termKey).filter(Boolean));

  courses.forEach(c => {
    if (c.type === 'NonCredit') return;
    const termKey = `Y${c.year}T${c.term}`;
    // If a legacy import exists for this term and the user has not chosen courses,
    // keep the imported value as the active source of truth.
    if (legacyTermKeys.has(termKey) && resolutions[termKey] !== 'use_courses') return;
    if (resolutions[termKey] === 'use_legacy') return;
    const { grade, point, isX } = computeCourseGrade(c);
    if (isX) return;
    if (grade !== 'F' && grade !== 'W' && point >= 2.0 && c.credits) {
      pts += point * c.credits;
      cr  += c.credits;
      earnedCredits += c.credits;
    }
  });

  // Add legacy term contributions unless the resolution forces using course data
  legacyRows.forEach(row => {
    const gpa = +row?.gpa;
    const credits = +row?.credits;
    const termKey = row?.termKey;
    if (!termKey) return;
    if (!Number.isFinite(gpa) || !Number.isFinite(credits) || credits <= 0) return;
    if (resolutions[termKey] === 'use_courses') return; // prefer course data
    pts += gpa * credits;
    cr += credits;
    if (gpa >= 2.0) earnedCredits += credits;
  });

  return { cgpa: cr ? pts / cr : null, earnedCredits };
};

// Return CGPA computed only from published grades and coverage info
export const getPublishedCGPA = (courses) => {
  let pts = 0, cr = 0, publishedCredits = 0, totalCredits = 0;
  courses.forEach(c => {
    if (c.type === 'NonCredit') return;
    totalCredits += c.credits || 0;
    const g = computeCourseGrade(c);
    if (g && g.isPublished && c.credits && Number.isFinite(g.point)) {
      pts += g.point * c.credits;
      cr += c.credits;
      publishedCredits += c.credits;
    }
  });
  return { cgpa: cr ? pts / cr : null, publishedCredits, totalCredits };
};

// Compute GPA per term
export const computeTermGPAs = (courses) => {
  const terms = {};
  courses.forEach(c => {
    if (c.type === 'NonCredit') return;
    const key = `Y${c.year}T${c.term}`;
    if (!terms[key]) terms[key] = { label: `Year ${c.year} · Term ${c.term}`, pts: 0, cr: 0, key };
    const { grade, point, isX } = computeCourseGrade(c);
    if (isX) return;
    if (grade !== 'F' && grade !== 'W' && point >= 2.0 && c.credits) {
      terms[key].pts += point * c.credits;
      terms[key].cr  += c.credits;
    }
  });

  getLegacyTermResults().forEach(row => {
    const key = row?.termKey || row?.key;
    const gpa = +row?.gpa;
    const credits = +row?.credits;
    if (!key || !Number.isFinite(gpa) || !Number.isFinite(credits) || credits <= 0) return;
    if (!terms[key]) terms[key] = { label: getTermLabelFromKey(key) || key, pts: 0, cr: 0, key };
    terms[key].pts += gpa * credits;
    terms[key].cr += credits;
  });

  return Object.values(terms)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(t => ({ term: t.key, label: t.label, gpa: t.cr ? +(t.pts / t.cr).toFixed(2) : 0 }));
};

const toOrdinal = (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

export const getTermLabelFromKey = (termKey) => {
  if (!termKey) return '';
  const match = String(termKey).match(/Y(\d+)T(\d+)/);
  if (!match) return '';
  const year = Number(match[1]);
  const term = Number(match[2]);
  return `${toOrdinal(year)} Year · ${toOrdinal(term)} Term`;
};

export const getTermKeyFromLabel = (label) => {
  if (!label) return '';
  const match = String(label).match(/(\d)\w*\s*Year\s*·\s*(\d)\w*\s*Term/i);
  if (!match) return '';
  return `Y${Number(match[1])}T${Number(match[2])}`;
};

export const getTermIndex = (termKey) => TERM_KEYS.indexOf(termKey);

const parseTermKey = (termKey) => {
  const match = String(termKey || '').match(/Y(\d+)T(\d+)/);
  if (!match) return { year: null, term: null };
  return { year: Number(match[1]), term: Number(match[2]) };
};

// ─── PERMANENT RULES FOR COURSE CLASSIFICATION ───────────────────────────────────────────────

/**
 * Extract Year and Term from course code using first two digits
 * Rule: 1st digit = Year (2 = Y2), 2nd digit = Term (1 = T1)
 * Example: ME 2100 → {year: 2, term: 1} → Y2T1
 * @param {string} code - Course code (e.g., "ME 2100", "EE 2105")
 * @returns {Object} {year: number|null, term: number|null}
 */
const extractYearTermFromCode = (code) => {
  if (!code || typeof code !== 'string') return { year: null, term: null };
  const m = code.match(/\d+/);
  if (!m) return { year: null, term: null };
  const numPart = m[0];
  if (numPart.length < 2) return { year: null, term: null };
  const year = parseInt(numPart[0], 10);
  const term = parseInt(numPart[1], 10);
  return { 
    year: (year >= 1 && year <= 4) ? year : null,
    term: (term >= 1 && term <= 2) ? term : null
  };
};

/**
 * Infer course type from course code using PERMANENT RULE
 * RULE: Last digit of numeric portion determines type (even = Sessional, odd = Theory)
 * This rule is ALWAYS applied and OVERRIDES any existing type marking
 * Example: ME 2100 (ends in 0, even) → Sessional, ME 2105 (ends in 5, odd) → Theory
 * @param {string} code - Course code (e.g., "ME 2100")
 * @param {string} currentType - Current type (ignored if code rule applies)
 * @returns {string} Course type: 'Sessional' or 'Theory'
 */
const inferCourseTypeFromCode = (code, currentType) => {
  // PERMANENT RULE: Extract last digit from course code and determine type
  if (!code || typeof code !== 'string') return currentType || 'Theory';
  
  const m = code.match(/\d+/g);
  if (!m || m.length === 0) return currentType || 'Theory';
  
  const nums = m.join('');
  if (nums.length === 0) return currentType || 'Theory';
  
  const last = nums[nums.length - 1];
  const d = parseInt(last, 10);
  
  if (!Number.isFinite(d)) return currentType || 'Theory';
  
  // PERMANENT RULE APPLICATION: even = Sessional, odd = Theory
  return (d % 2 === 0) ? 'Sessional' : 'Theory';
};

export { inferCourseTypeFromCode, extractYearTermFromCode };

export const getProfile = () => {
  const raw = store.get('profile') || {};
  const currentTermKey = raw.currentTermKey || getTermKeyFromLabel(raw.currentTerm) || '';
  return { ...DEFAULT_PROFILE, ...raw, currentTermKey };
};

export const getCurrentTermKey = (profile = {}) => {
  return profile.currentTermKey || getTermKeyFromLabel(profile.currentTerm) || '';
};

// Calculate term timeline with holidays, exams, and breaks
export const getTermTimeline = (termStartDate, deptCode, termKey) => {
  if (!termStartDate) return null;
  
  try {
    const start = new Date(termStartDate);
    
    // Get holidays from scheduleSettings
    const scheduleSettings = store.get('scheduleSettings') || {};
    const holidayDates = scheduleSettings.holidayDates || [];
    
    // Helper: Check if date is a holiday (Friday, Saturday, or in holiday list)
    const isHoliday = (date) => {
      const dayOfWeek = date.getDay();
      const dateStr = date.toISOString().split('T')[0];
      return dayOfWeek === 5 || dayOfWeek === 6 || holidayDates.includes(dateStr);
    };
    
    // Phase 1: Count 65 working days of classes (excluding Fri, Sat, and holidays)
    let workingDays = 0;
    let currentDate = new Date(start);
    while (workingDays < 65) {
      if (!isHoliday(currentDate)) workingDays++;
      currentDate.setDate(currentDate.getDate() + 1);
    }
    const classEndDate = new Date(currentDate);
    classEndDate.setDate(classEndDate.getDate() - 1);
    
    // Phase 2: 10-day preparation leave
    const prepLeaveStart = new Date(classEndDate);
    prepLeaveStart.setDate(prepLeaveStart.getDate() + 1);
    const prepLeaveEnd = new Date(prepLeaveStart);
    prepLeaveEnd.setDate(prepLeaveEnd.getDate() + 9);
    
    // Phase 3: Get number of theory courses for exams
    // Safe fallback — typically 5 theory courses per term
    // User can manually override exam dates via Edit Exams modal
    const theoryCourses = 5;
    
    // Schedule exams with gaps (skip holidays)
    let examDate = new Date(prepLeaveEnd);
    examDate.setDate(examDate.getDate() + 1);
    const examPhases = [];
    const specialPeriods = [];
    
    for (let i = 0; i < theoryCourses; i++) {
      // Skip to next valid exam date (after any holidays)
      while (isHoliday(examDate)) {
        examDate.setDate(examDate.getDate() + 1);
      }
      
      examPhases.push({
        course: i + 1,
        examDate: new Date(examDate),
        type: 'exam'
      });
      
      // Move to next day for gap
      examDate.setDate(examDate.getDate() + 1);
      
      // For gaps between exams, skip holidays automatically
      if (i < theoryCourses - 1) {
        let gapDays = 0;
        while (gapDays < 4) {
          if (!isHoliday(examDate)) {
            gapDays++;
          }
          if (gapDays < 4) examDate.setDate(examDate.getDate() + 1);
        }
        examDate.setDate(examDate.getDate() + 1);
        }
      }
    
    // Phase 4: 7-10 day post-exam break
    let postExamDate = new Date(examPhases[examPhases.length - 1].examDate);
    postExamDate.setDate(postExamDate.getDate() + 1);
    const postExamBreakEnd = new Date(postExamDate);
    postExamBreakEnd.setDate(postExamBreakEnd.getDate() + 8); // 7-10 days (default 9)
    
    // Next semester start
    const nextSemesterStart = new Date(postExamBreakEnd);
    nextSemesterStart.setDate(nextSemesterStart.getDate() + 1);
    
    return {
      classEndDate,
      prepLeaveStart,
      prepLeaveEnd,
      examPhases,
      specialPeriods,
      postExamBreakStart: postExamDate,
      postExamBreakEnd,
      nextSemesterStart,
      theoryCourses
    };
  } catch {
    return null;
  }
};

// Calculate term progress (0-100%) based on the 65 working-day class window.
// Holidays and Fri/Sat do not advance the counter.
export const getTermProgress = (termStartDate, holidayDates = []) => {
  if (!termStartDate) return 0;
  try {
    const start = new Date(`${termStartDate}T00:00:00`);
    const today = new Date();
    const cursor = new Date(start);
    let workingDays = 0;

    while (cursor <= today && workingDays < 65) {
      if (!isRoutineHoliday(localDateKey(cursor), holidayDates)) {
        workingDays++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return Math.round((workingDays / 65) * 100);
  } catch {
    return 0;
  }
};

export const buildCourseId = (deptCode, termKey, code) => `${deptCode}:${termKey}:${code}`;

export const getCustomCourses = () => {
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

export const setCustomCourses = (courses) => {
  store.set('customCourses', courses || []);
};

const getCourseOverrides = () => store.get('courseOverrides') || {};

export const setCourseOverride = (courseId, patch) => {
  const overrides = getCourseOverrides();
  const next = { ...overrides, [courseId]: { ...(overrides[courseId] || {}), ...(patch || {}) } };
  store.set('courseOverrides', next);
  try { clearAllCoursesCache(); } catch {}
  return next;
};

const getOptionalSelections = () => store.get('optionalSelections') || {};

export const setOptionalSelection = ({ deptCode, termKey, slotIndex, code }) => {
  const current = getOptionalSelections();
  const dept = current[deptCode] || {};
  const term = dept[termKey] || [];
  const nextTerm = term.slice();
  nextTerm[slotIndex] = code || '';
  const next = { ...current, [deptCode]: { ...dept, [termKey]: nextTerm } };
  store.set('optionalSelections', next);
  return next;
};

export const deriveAcademicMetaFromCourses = (courses, profile = {}) => {
  const list = Array.isArray(courses) ? courses : [];

  const latestActiveKey = list
    .filter(c => c?.status === 'active' && c?.year && c?.term)
    .map(c => `Y${c.year}T${c.term}`)
    .sort()
    .at(-1);

  const latestAnyKey = list
    .filter(c => c?.year && c?.term)
    .map(c => `Y${c.year}T${c.term}`)
    .sort()
    .at(-1);

  const latestTermKey = latestActiveKey || latestAnyKey || '';
  const currentTerm = getTermLabelFromKey(latestTermKey);
  const batch = profile?.batch || (profile?.session ? String(profile.session).slice(2, 4) : '');

  return { batch, currentTerm, latestTermKey };
};

export const syncProfileAcademicMeta = ({ profile, courses }) => {
  const current = profile || store.get('profile') || {};
  const list = courses || store.get('courses') || [];
  const { batch, currentTerm } = deriveAcademicMetaFromCourses(list, current);

  const next = { ...current };
  let changed = false;

  if (!next.batch && batch) {
    next.batch = batch;
    changed = true;
  }
  // Only auto-fill currentTerm when the user hasn't set a manual value.
  // Profile uses empty string for "Auto (from courses)"; do not overwrite a manual selection.
  const profileHasManualTerm = !!current.currentTermKey || !!current.currentTerm;
  if (currentTerm && !profileHasManualTerm) {
    const termKey = getTermKeyFromLabel(currentTerm);
    if (termKey && next.currentTermKey !== termKey) {
      next.currentTermKey = termKey;
      changed = true;
    }
  }

  if (changed) store.set('profile', next);
  return next;
};

// Default profile
export const DEFAULT_PROFILE = {
  name: '', studentId: '', dept: '', session: '', batch: '', currentTerm: '', currentTermKey: '',
  totalCreditsRequired: MIN_CREDITS_GRADUATION, yearStarted: new Date().getFullYear(),
  isCR: false, hallName: '', roomNo: '', advisorName: '', advisorContact: '',
  termStartDate: null, // ISO date string: YYYY-MM-DD
};

// ---------------- Audit & Snapshot helpers ----------------
export const recordAudit = (entry) => {
  try {
    const list = store.get('auditLog') || [];
    const next = [...list, { ts: new Date().toISOString(), ...entry }];
    store.set('auditLog', next);
    return next;
  } catch (e) { return null; }
};

export const getAuditLog = () => store.get('auditLog') || [];

// compute SHA-256 hex of JSON-stable string of data
export const computeHash = async (obj) => {
  try {
    const s = JSON.stringify(obj, Object.keys(obj).sort());
    const enc = new TextEncoder().encode(s);
    const digest = await crypto.subtle.digest('SHA-256', enc);
    const arr = Array.from(new Uint8Array(digest));
    return arr.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
};

export const saveSmartSnapshot = async (name, payload) => {
  const snaps = store.get('smartscoreSnapshots') || [];
  const hash = await computeHash(payload);
  const snap = { name: name || 'snapshot', ts: new Date().toISOString(), hash, payloadMeta: { keys: Object.keys(payload) } };
  const next = [...snaps, snap];
  store.set('smartscoreSnapshots', next);
  recordAudit({ action: 'save_snapshot', name: snap.name, ts: snap.ts, hash });
  return snap;
};

export const getLatestSmartSnapshot = () => {
  const snaps = store.get('smartscoreSnapshots') || [];
  return snaps.length ? snaps[snaps.length - 1] : null;
};
