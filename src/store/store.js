// KUETx Global Store
// Aligned with KUET Academic Ordinance (Effective 2nd Term, Session 2011-12)
// Approved: 18th & 19th Academic Council meetings (2012)
// Storage: IndexedDB (50MB+) with automatic migration from localStorage

import { initDB, getFromDB, setInDB, removeFromDB, getAllKeysFromDB, getAllFromDB, getAllEntriesFromDB, clearDB, migrateFromLocalStorage, getStorageUsage } from './indexeddb-store.js';

// PERFORMANCE FIX: this used to be `import { clearAllCoursesCache } from
// './curriculumStore.js'` at the top of the file. store.js is imported
// eagerly from App.jsx (it's the core data layer, needed before any route
// renders), and curriculumStore.js in turn statically imports CURRICULUM —
// the full syllabus/terms/notes data for ALL 16 KUET departments (~2.6MB
// source, the single largest contributor to the old ~1.75MB eager main
// chunk). That meant every visitor downloaded and parsed every department's
// full 4-year curriculum before the app could even show the login screen,
// regardless of which one department they actually belong to.
// The only thing store.js needs from curriculumStore.js is this tiny cache
// invalidation call (fire-and-forget, already wrapped in try/catch below),
// so it's loaded via a lazy dynamic import instead — this lets Rollup split
// CURRICULUM out into its own chunk(s) that only load when a page that
// actually needs course data (Courses, Dashboard, ClassSetup, etc.) is
// visited, not on every single page load.
const clearAllCoursesCache = () => {
  import('./curriculumStore.js').then((m) => m.clearAllCoursesCache()).catch(() => {});
};

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
    // BUGFIX: this used to call getAllKeysFromDB() and then loop through
    // every key with an individually-awaited getFromDB() call — each one
    // opening and committing its OWN IndexedDB transaction, one at a time,
    // fully sequentially. With the number of keys this app accumulates
    // (per-class assignments, notices, marks, diary entries, etc.), that's
    // dozens-to-hundreds of serialized storage round-trips on every single
    // page load/refresh — the main cause of the app-wide slow-loading
    // reports. getAllEntriesFromDB() reads every key AND value in exactly
    // one transaction instead.
    const entries = await getAllEntriesFromDB();
    for (const [cacheKey, value] of entries) {
      if (memoryCache.has(cacheKey)) continue;
      if (value !== null && value !== undefined) memoryCache.set(cacheKey, value);
    }
    dbReady = true;
    try { clearAllCoursesCache(); } catch {}
    emitStoreUpdate();
  } catch (err) {
    console.error('[KUETx Store] Initialization error:', err);
  }
}

// DB preloading is invoked by the app bootstrap before first render.

const emitStoreUpdate = (key = null) => {
  try {
    window.dispatchEvent(new CustomEvent('kuetx:store-updated', { detail: { key } }));
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
      // BUGFIX (store-updated feedback loop): store.set() used to
      // unconditionally dispatch 'kuetx:store-updated' even when `val`
      // was deep-equal to what's already cached. Any effect that reads
      // the store, derives a value, and writes it back on every render
      // (e.g. alertUtils.getOrStampAlertFirstSeenAt via
      // NotificationPanel) could therefore loop forever: write → event →
      // re-render → recompute → "changed" → write again. A cheap
      // JSON deep-equal short-circuit here breaks that class of loop at
      // the source, for every caller, without each call site needing
      // its own guard.
      let prevSerialized;
      try { prevSerialized = JSON.stringify(memoryCache.get(cacheKey)); } catch { prevSerialized = undefined; }
      let nextSerialized;
      try { nextSerialized = JSON.stringify(val); } catch { nextSerialized = undefined; }
      if (prevSerialized !== undefined && nextSerialized !== undefined && prevSerialized === nextSerialized) {
        return; // no-op write — value unchanged, don't re-dispatch
      }
      memoryCache.set(cacheKey, val);
      try { localStorage.setItem(cacheKey, JSON.stringify(val)); } catch {}
      emitStoreUpdate(key);
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

  // BUGFIX (stale localStorage bleeding into a brand-new account): the
  // earlier fix in App.jsx's handleAuthSuccess() only did
  // store.remove('profile') before a fresh Register/Login — but
  // pushAllToFirestore()/exportAll() sync EVERY kuetx_* key, not just
  // profile (courses, attendance, marks, notes, schedule, question-bank
  // bookmarks, timer state, etc. — anything a previous account on this
  // same browser/device left behind in localStorage/IndexedDB). Clearing
  // only 'profile' left all of those other keys still sitting there,
  // still readable by every page as if they belonged to the new account,
  // and still eligible to sync up the moment anything touched
  // pushAllToFirestore() again.
  //
  // This mirrors exportAll()'s own "every kuetx_* key" scope, minus a
  // short excludeKeys list of things that are legitimately per-device
  // rather than per-account (matches EXCLUDED_KEYS in firebaseSync.js —
  // theme/UI preference, the "have you seen the guide" flag, and backup
  // timestamps have no per-account meaning and resetting them on every
  // fresh sign-in would just be annoying, not a privacy/correctness fix).
  //
  // BUGFIX (2nd pass): this originally iterated memoryCache.keys() only.
  // memoryCache is LAZILY populated — get(key) only adds a key to it the
  // first time something actually calls store.get(key) (see get() above,
  // "Sync fallback for instant reads" reading from localStorage on a
  // cache miss). At the exact moment this runs (inside onAuthChange,
  // right after a fresh sign-in, before most pages have mounted and
  // called store.get() for their own data), most kuetx_* keys from a
  // previous account — courses, attendance, marks, notes, schedule,
  // timer state, anything no component happened to have already read —
  // were NEVER in memoryCache yet, so the old memoryCache-only scan
  // silently skipped them. Only keys something had already touched (like
  // 'profile', which App.jsx's own queue logic reads early) reliably got
  // cleared; everything else leaked through untouched.
  //
  // Fix: scan localStorage directly (it always has every persisted key,
  // regardless of whether memoryCache has caught up to it yet) instead of
  // memoryCache. store.remove() below still clears memoryCache too, so
  // this is a strict superset of the old behavior, not a replacement of
  // a different kind — it just no longer misses keys memoryCache hadn't
  // been warmed up with yet.
  clearAllForFreshAccount: (excludeKeys = ['autoBackup', 'lastBackupTime', 'guide_seen', 'theme']) => {
    const keysToRemove = new Set();
    // Anything already read into memoryCache (covers keys set/read this
    // session even before they'd have shown up in localStorage, e.g. via
    // set() calls that haven't finished their async IDB write yet).
    for (const k of memoryCache.keys()) {
      if (k.startsWith(PREFIX)) keysToRemove.add(k.slice(PREFIX.length));
    }
    // Everything actually persisted in localStorage — the authoritative
    // list, since it's synchronous and doesn't depend on what's already
    // been lazily loaded into memoryCache this session.
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) keysToRemove.add(k.slice(PREFIX.length));
      }
    } catch {}
    for (const bareKey of keysToRemove) {
      if (excludeKeys.some(ex => bareKey.includes(ex))) continue;
      store.remove(bareKey);
    }
  },

  // Async, more thorough sibling of clearAllForFreshAccount() above: also
  // scans IndexedDB directly via getAllKeysFromDB(), closing the gap the
  // synchronous version can't — a key that exists ONLY in IndexedDB (e.g.
  // localStorage hit its quota and a write silently fell back to
  // IDB-only, or a value was large enough that some earlier code path
  // stored it there without mirroring to localStorage) would be invisible
  // to a memoryCache/localStorage-only scan.
  //
  // BUGFIX (found on architecture review): this used to call store.remove()
  // per key, same as the sync version — but store.remove() only clears
  // memoryCache and localStorage SYNCHRONOUSLY; its IndexedDB deletion
  // (removeFromDB(key).catch(...)) is fire-and-forget, not awaited inside
  // store.remove() itself. That meant this function's own `await` did
  // nothing for the IndexedDB layer specifically — it could resolve while
  // IndexedDB deletes for a previous account's data were still in flight
  // in the background, silently defeating the entire point of being the
  // "thorough, awaitable" version that callers (accountLifecycle.js's
  // syncLocalDataOnAuth, awaited before startFirebaseSync attaches its
  // store-change listener) rely on to have FULLY finished before moving
  // on.
  //
  // Fix: clear memoryCache/localStorage directly here (synchronous,
  // instant, no reason to route through store.remove() for those two
  // layers) and explicitly await every IndexedDB removeFromDB() call via
  // Promise.all — so the promise this function returns only resolves once
  // every layer, including IndexedDB, is actually done.
  clearAllForFreshAccountThorough: async (excludeKeys = ['autoBackup', 'lastBackupTime', 'guide_seen', 'theme']) => {
    const keysToRemove = new Set();
    for (const k of memoryCache.keys()) {
      if (k.startsWith(PREFIX)) keysToRemove.add(k.slice(PREFIX.length));
    }
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) keysToRemove.add(k.slice(PREFIX.length));
      }
    } catch {}
    try {
      const idbKeys = await getAllKeysFromDB();
      idbKeys.forEach((k) => keysToRemove.add(k.slice(PREFIX.length)));
    } catch (err) {
      console.error('[KUETx Store] clearAllForFreshAccountThorough IDB scan error:', err);
    }

    const finalKeys = [...keysToRemove].filter(
      (bareKey) => !excludeKeys.some((ex) => bareKey.includes(ex))
    );

    // Synchronous layers first — instant, and gives the UI the fastest
    // possible "nothing stale left to read" state even before IndexedDB
    // (which can legitimately take a few ms per key) finishes.
    for (const bareKey of finalKeys) {
      const cacheKey = PREFIX + bareKey;
      memoryCache.delete(cacheKey);
      try { localStorage.removeItem(cacheKey); } catch {}
    }

    // IndexedDB layer — actually awaited this time, in parallel, so the
    // returned promise is a true "everything is gone" signal.
    await Promise.all(
      finalKeys.map((bareKey) =>
        removeFromDB(bareKey).catch((err) =>
          console.error(`[KUETx Store] clearAllForFreshAccountThorough IDB remove error for "${bareKey}":`, err)
        )
      )
    );
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

// ─── Blood groups — used to validate/normalize profile.bloodGroup and by
// the Founder Blood Bank search (BloodBankView in AdminDashboard.jsx). ───
export const BLOOD_GROUP_VALUES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// ─── Official KUET website links, per department (Art. 2's 16 depts) ─────
// Kept as a separate map (not merged into DEPARTMENTS above) so nothing
// that consumes DEPARTMENTS/DEPT_CODES for roll-parsing, seat counts, etc.
// is affected — this is purely for places that want to link out to a
// department's own site (e.g. the Faculty profile dept picker).
export const DEPARTMENT_LINKS = {
  CE:   'https://www.kuet.ac.bd/ce',
  EEE:  'https://www.kuet.ac.bd/eee',
  ME:   'https://www.kuet.ac.bd/me',
  CSE:  'https://www.kuet.ac.bd/cse',
  ECE:  'https://www.kuet.ac.bd/ece',
  IPE:  'https://www.kuet.ac.bd/iem',
  BECM: 'https://www.kuet.ac.bd/becm',
  Arch: 'https://www.kuet.ac.bd/arch',
  URP:  'https://www.kuet.ac.bd/urp',
  LE:   'https://www.kuet.ac.bd/le',
  TE:   'https://www.kuet.ac.bd/te',
  BME:  'https://www.kuet.ac.bd/bme',
  MSE:  'https://www.kuet.ac.bd/mse',
  ESE:  'https://www.kuet.ac.bd/ese',
  ChE:  'https://www.kuet.ac.bd/che',
  MTE:  'https://www.kuet.ac.bd/mte',
};

// ─── KUET Institutes — separate from the 16 academic Departments above.
// Institutes (IICT/IDM/IEPT) don't take undergrad rolls the way
// Departments do, so they're deliberately NOT folded into DEPARTMENTS/
// DEPT_CODES (that would break roll-parsing and seat-count logic
// downstream). This exists so faculty who belong to an Institute rather
// than a Department have a correct, linkable option in the dept picker.
export const INSTITUTES = [
  { code: 'IICT', name: 'Institute of Information and Communication Technology', link: 'https://iict.kuet.ac.bd/iict/' },
  { code: 'IDM',  name: 'Institute of Disaster Management',                       link: 'https://www.kuet.ac.bd/idm' },
  { code: 'IEPT', name: 'Institute of Environment and Power Technology',          link: 'https://www.kuet.ac.bd/iept' },
];
export const INSTITUTE_CODES = INSTITUTES.map(i => i.code);

// ─── Basic Science & Humanities departments — MATH/CHEM/PHY/HUM. These
// don't admit undergrads via a roll number the way the 16 engineering
// Departments above do (no ROLL_DEPT_MAP entry, students aren't
// admitted "into" them), so — same rationale as INSTITUTES above —
// they're deliberately kept OUT of DEPARTMENTS/DEPT_CODES to avoid
// touching roll-parsing/seat-count logic. Faculty do belong to these,
// though, so they need a correct, linkable option in the dept picker
// just like Institutes.
export const BASIC_SCIENCE_DEPTS = [
  { code: 'MATH', name: 'Department of Mathematics',              link: 'https://www.kuet.ac.bd/math' },
  { code: 'CHEM', name: 'Department of Chemistry',                link: 'https://www.kuet.ac.bd/chem' },
  { code: 'PHY',  name: 'Department of Physics',                  link: 'https://www.kuet.ac.bd/phy' },
  { code: 'HUM',  name: 'Department of Humanities and Business',  link: 'https://www.kuet.ac.bd/hum' },
];
export const BASIC_SCIENCE_DEPT_CODES = BASIC_SCIENCE_DEPTS.map(d => d.code);

// ─── Combined list for pickers that need to offer Departments,
// Institutes, AND Basic Science/Humanities depts as one flat set of
// selectable "academic unit" values (e.g. FacultyProfileSetupModal's
// dept select) — each entry carries its own link so the UI can show/
// display it without a second lookup table.
export const ACADEMIC_UNITS = [
  ...DEPARTMENTS.map(d => ({ code: d.code, name: d.name, link: DEPARTMENT_LINKS[d.code] || null, kind: 'department' })),
  ...INSTITUTES.map(i => ({ code: i.code, name: i.name, link: i.link, kind: 'institute' })),
  ...BASIC_SCIENCE_DEPTS.map(d => ({ code: d.code, name: d.name, link: d.link, kind: 'basic_science' })),
];

export const ROLL_DEPT_MAP = {
  '25': 'Arch',
  '23': 'BECM',
  '15': 'BME',
  '01': 'CE',
  '29': 'ChE',
  '07': 'CSE',
  '09': 'ECE',
  '03': 'EEE',
  '13': 'ESE',
  '11': 'IPE',
  '19': 'LE',
  '05': 'ME',
  '27': 'MSE',
  '31': 'MTE',
  '21': 'TE',
  '17': 'URP',
};

export const getDeptCodeFromRoll = (roll) => {
  const r = String(roll || '').trim();
  if (!/^\d{7}$/.test(r)) return '';
  const deptDigits = r.slice(2, 4);
  return ROLL_DEPT_MAP[deptDigits] || '';
};

export const getCanonicalDeptCode = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = DEPT_CODES.find((code) => code.toLowerCase() === raw.toLowerCase());
  return match || '';
};

export const isAllowedDeptCode = (value) => Boolean(getCanonicalDeptCode(value));

// ─── Curriculum Term Helpers ─────────────────────────────────────────────
export const TERM_KEYS = ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];
const ARCH_TERM_KEYS = [...TERM_KEYS, 'Y5T1', 'Y5T2'];

export const getTermKeysForDept = (deptCode) => {
  if (String(deptCode || '').trim().toLowerCase() === 'arch') return ARCH_TERM_KEYS;
  return TERM_KEYS;
};

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

// BUGFIX (wrong Morning/Afternoon/Evening bucket + wrong "today" for Daily
// Log attendance): every "now" in the app used to be a plain `new Date()`,
// which reads the VISITOR'S device/browser clock and timezone — not
// Bangladesh time. KUETx only ever means Bangladesh time (Asia/Dhaka,
// UTC+6, no DST), so any device set to a different timezone (or a clock
// that's simply wrong) would silently push classes into the wrong
// Morning/Afternoon/Evening section on Today, and could resolve the Daily
// Log's "today" to the wrong weekday entirely — making a class marked
// Present appear to "not update" because it was actually being read/written
// against a different day than the one the routine matches.
//
// getBDNow() returns a real Date object whose getHours/getMinutes/getDay/etc.
// all read as Bangladesh wall-clock time, regardless of the device's own
// timezone — so every getHours()-based bucket and every todayStr()-style
// "today" lookup agrees, everywhere in the app.
export const getBDNow = () => {
  const now = new Date();
  const bdMs = now.getTime() + now.getTimezoneOffset() * 60000 + 6 * 60 * 60000;
  return new Date(bdMs);
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

// ─── CLASS ON/OFF TOGGLE (CR-triggered ad-hoc / recurring cancellation) ────
// Separate from holidayDates on purpose: holidayDates is app-wide/blunt (one
// date cancels EVERY course), while this is CR-triggered and per-slot. Lives
// in scheduleSettings.classOverrides + scheduleSettings.recurringOff (group
// mode: synced via groups/{groupId}/meta/plannerSettings.scheduleFields,
// same doc/merge pattern as holidayDates — see groupSync.js's
// setSlotOverride/setDayOverride/setRecurringOff and App.jsx's mirror
// effect that copies scheduleFields into the local store for non-React
// readers like this module).
//
// Two independent mechanisms, because two genuinely different real-world
// cases exist and conflating them created a design gap (see prior review):
//   1. classOverrides — a ONE-OFF exception for a single, CR-picked date
//      (e.g. "this Monday's class is cancelled" or, less commonly, "this
//      Monday's class IS happening" as a make-up/exception to a recurring
//      off-state below).
//   2. recurringOff — an ONGOING suspension of a slot starting from a given
//      date, every matching weekday, until the CR explicitly turns it back
//      on (e.g. "teacher is on leave indefinitely, skip this slot every
//      week from now on"). This does NOT auto-expire and does NOT need the
//      CR to keep re-toggling it week after week.
//
// Shape:
//   classOverrides: {
//     [dateKey]: {                 // 'YYYY-MM-DD', CR-picked explicitly —
//                                   // NEVER auto-guessed from a weekday tab
//       dayOff: boolean,           // true = every slot off THIS date only
//       dayOffReason: string | null,
//       slots: {
//         [slotKey]: {             // `${courseId}::${day}::${slot}` — same
//                                   // shape as Attendance.jsx's slotKey()
//           status: 'off' | 'on',  // 'on' = explicit exception that wins
//                                   //   over a recurringOff entry for this
//                                   //   one date (a single make-up class)
//           reason: string | null,
//           setBy: uid,
//           setAt: <timestamp>,
//         }
//       }
//     }
//   }
//   recurringOff: {
//     [slotKey]: {
//       from: 'YYYY-MM-DD',        // effective this date and every matching
//                                   //   weekday after it, until removed
//       reason: string | null,
//       setBy: uid,
//       setAt: <timestamp>,
//     }
//   }
export const classOverrideSlotKey = (courseId, day, slot) => `${courseId}::${day}::${slot}`;

// A slotKey embeds its own weekday (`${courseId}::${day}::${slot}`), so a
// recurringOff entry only ever needs to be checked against dates that fall
// on that same weekday — extracted here rather than re-parsed at each call
// site.
function weekdayFromSlotKey(slotKey) {
  const parts = String(slotKey || '').split('::');
  return parts.length >= 2 ? parts[1] : null;
}

// Single source of truth for "is this class actually happening on this
// date" — every consumer (Today page, Attendance Daily Log, Routine page's
// own card dimming) calls this ONE function so the precedence rule below
// only ever has to be correct in one place.
//
// Precedence (first match wins):
//   1. classOverrides[dateKey].dayOff === true           → OFF (whole day)
//   2. classOverrides[dateKey].slots[slotKey] === 'on'    → ON  (explicit
//      exception/make-up, overrides a recurring suspension for this date)
//   3. classOverrides[dateKey].slots[slotKey] === 'off'   → OFF (one-off)
//   4. recurringOff[slotKey] exists, dateKey >= its .from,
//      and dateKey's weekday matches the slot's own weekday → OFF (ongoing)
//   5. otherwise                                          → ON  (default,
//      unchanged from today's behavior for slots with no override at all)
export function isClassOff(dateKey, slotKey, groupOverrides = null) {
  // GROUP-MODE FIX: this originally only ever read
  // store.get('scheduleSettings') — the device's LOCAL, personal copy.
  // That's correct for personal (non-group) mode, where a student's own
  // local overrides are the only thing that exists. But in group mode,
  // the CR/ACR's on/off toggles (Class Routine page) write to Firestore's
  // groups/{groupId}/meta/plannerSettings.scheduleFields.classOverrides —
  // a completely different place — and nothing was ever reading THAT
  // back into local scheduleSettings. The result: a CR marks a class off
  // for a date, the Routine page (which reads Firestore directly via
  // useClassManagementState.js) correctly shows it as off, but
  // Attendance.jsx and the Today page (both of which call isClassOff())
  // kept reading stale/empty local data and still showed the class as ON
  // for every student, including the CR, on Attendance and Today.
  //
  // Fix: callers in group mode now pass the live Firestore
  // classOverrides/recurringOff object (groupOverrides) explicitly —
  // sourced from subscribePlannerSettings, same live data
  // useClassManagementState.js already uses correctly — and this
  // function prefers that over the local personal copy when provided.
  // Personal (non-group) callers are unaffected: they simply don't pass
  // groupOverrides, so the local-storage path below runs exactly as
  // before.
  const overrides = groupOverrides ?? (store.get('scheduleSettings') || {}).classOverrides ?? {};
  const recurringOffMap = groupOverrides?.recurringOff ?? (store.get('scheduleSettings') || {}).recurringOff ?? {};
  const forDate = overrides[dateKey];

  if (forDate?.dayOff) return true;

  const slotOverride = forDate?.slots?.[slotKey]?.status;
  if (slotOverride === 'on') return false;
  if (slotOverride === 'off') return true;

  const recurring = recurringOffMap[slotKey];
  if (recurring?.from && dateKey >= recurring.from) {
    const slotWeekday = weekdayFromSlotKey(slotKey);
    const dateWeekday = getWeekdayName(new Date(`${dateKey}T00:00:00`));
    if (!slotWeekday || slotWeekday === dateWeekday) return true;
  }

  return false;
}

// Returns the reason string for an off slot/day, if the CR left one —
// used by Today page / Daily Log to show *why* a class isn't listed
// (vs. a plain holiday, which has its own separate message). Mirrors the
// same precedence as isClassOff() above (dayOff > per-date slot > recurring).
export function getClassOffReason(dateKey, slotKey, groupOverrides = null) {
  // Same group-mode fix as isClassOff() above.
  const overrides = groupOverrides ?? (store.get('scheduleSettings') || {}).classOverrides ?? {};
  const recurringOffMap = groupOverrides?.recurringOff ?? (store.get('scheduleSettings') || {}).recurringOff ?? {};
  const forDate = overrides[dateKey];

  if (forDate?.dayOff) return forDate.dayOffReason || null;

  const slotEntry = forDate?.slots?.[slotKey];
  if (slotEntry?.status === 'off') return slotEntry.reason || null;
  if (slotEntry?.status === 'on') return null; // explicit exception — not off

  const recurring = recurringOffMap[slotKey];
  if (recurring?.from && dateKey >= recurring.from) {
    const slotWeekday = weekdayFromSlotKey(slotKey);
    const dateWeekday = getWeekdayName(new Date(`${dateKey}T00:00:00`));
    if (!slotWeekday || slotWeekday === dateWeekday) return recurring.reason || null;
  }

  return null;
}

// Whether a slot currently has an ongoing recurring suspension (regardless
// of any per-date exceptions) — used by the Routine page to show the
// persistent "off every week" badge and the "turn back on" action.
export function isSlotRecurringOff(slotKey) {
  return !!(store.get('scheduleSettings')?.recurringOff || {})[slotKey];
}

// Given a weekday name ('Monday' etc.), finds the nearest upcoming calendar
// date (today or later) that falls on that weekday. This is ONLY used to
// pre-fill the date picker's default value in the Routine page's toggle UI
// — never used to silently decide which date gets toggled. The CR always
// sees and can change this date before confirming (see the earlier design
// gap: auto-guessing a date from a weekday tab was ambiguous — "this
// Monday" vs "next Monday" — so the picker now requires an explicit,
// visible date, this is just its starting suggestion).
export const getNextDateForWeekday = (weekdayName, now = getBDNow()) => {
  const targetIdx = FULL_WEEK_DAYS.indexOf(weekdayName);
  if (targetIdx === -1) return getLocalDateKey(now);
  const date = new Date(now);
  for (let i = 0; i < 8; i++) {
    if (date.getDay() === targetIdx) return getLocalDateKey(date);
    date.setDate(date.getDate() + 1);
  }
  return getLocalDateKey(now);
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

export const getRoutinePreviewDate = (holidayDates = [], now = getBDNow()) => {
  const base = new Date(now);
  if (base.getHours() >= 17) base.setDate(base.getDate() + 1);
  return getNextRoutineDate(localDateKey(base), holidayDates);
};

// ─── TODAY PAGE ────────────────────────────────────────────────────────────
// today_plans holds two kinds of user-created rows, both self-contained on
// the /today page (no other page reads or writes this key):
//   { id, type: 'tuition', title, subject, days: ['Sunday', ...], time, note }
//   { id, type: 'todo',    title, date: 'YYYY-MM-DD', time, note }
// 'tuition' rows repeat every week on each listed day (any of all 7 days —
// tuition/personal items are not limited to the Sun–Thu class week).
// 'todo' rows fire once, on their single date.
export const FULL_WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const getTodayPlans = () => {
  const raw = store.get('today_plans');
  return Array.isArray(raw) ? raw : [];
};

export const saveTodayPlan = (plan) => {
  const list = getTodayPlans();
  const next = plan.id
    ? list.map((p) => (p.id === plan.id ? { ...p, ...plan } : p))
    : [{ ...plan, id: uid() }, ...list];
  store.set('today_plans', next);
  return next;
};

export const deleteTodayPlan = (id) => {
  const next = getTodayPlans().filter((p) => p.id !== id);
  store.set('today_plans', next);
  return next;
};

// Weekday name for any date (defaults to now), matching the Sunday-first
// naming already used across Schedule.jsx (DAYS / DAY_INDEX).
export const getWeekdayName = (date = new Date()) => FULL_WEEK_DAYS[date.getDay()];

// Parses a "8:00 AM-8:50 AM"-style routine slot (see Schedule.jsx TIME_MODELS)
// or a plain "5:00 PM" time string into 24h minutes-since-midnight, for sorting
// items on a single merged timeline. Returns null if it can't be parsed.
//
// BUGFIX: slot ranges can use any of →, ->, – (en-dash), — (em-dash), or a
// plain hyphen as the separator (see Schedule.jsx's normalizeSlotKey /
// parseSlotRange, which already handle all five). This used to split only
// on a plain hyphen, so any slot saved with an arrow or en/em-dash (a
// supported, common format) failed to parse here, silently fell to `null`,
// and got sorted to the top of the Today page / miscounted as "still
// upcoming" no matter what time it actually was.
export const parseTimeToMinutes = (raw) => {
  if (!raw) return null;
  const first = String(raw).split(/→|->|–|—|-/)[0].trim();
  const m = first.match(/^(\d{1,2}):(\d{2})\s*([AP]M)?$/i);
  if (!m) return null;
  let [, h, min, ampm] = m;
  h = parseInt(h, 10);
  min = parseInt(min, 10);
  if (ampm) {
    ampm = ampm.toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
  }
  return h * 60 + min;
};

// ─── UNIFIED COMPUTATION FUNCTIONS ────────────────────────────────────────
// These are the single source of truth used by ALL pages.
// Reading from both 'attLogs' (daily) and 'attendance' (manual).

// Get effective attendance for a course — daily logs take priority
//
// BUGFIX (Attendance → Marks auto-sync always returned "none"): daily-log
// marks are saved keyed as `${courseId}_${teacherName}` (see Attendance.jsx's
// mark() and getEffective()) — never as a bare courseId. This function used
// to read `dayLog[courseId]` directly, a key that literally never exists in
// attLogs, so `held` stayed 0 and this always fell through to manual/none —
// regardless of how much was actually marked in the Daily Log, and
// regardless of any teacher-name edits. Fix: sum every log key that belongs
// to this course (`courseId` itself, or `courseId_<any teacher>`), the same
// way computeCourseGrade/other unified readers already expect attendance to
// be looked up.
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
    Object.entries(dayLog).forEach(([key, v]) => {
      if (key !== courseId && !key.startsWith(`${courseId}_`)) return;
      if (v === 'present' || v === 'absent') {
        held++;
        if (v === 'present') attended++;
      }
    });
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
  // Official entry = only what the student explicitly submitted via the
  // Results page's own "Upload grade" dropdown (publishedGrade for
  // Theory/Project, resultGrade for Sessional). Term Planner (Marks.jsx)
  // fields — hall, ctTeacher1/2, attTeacher1/2, manualTeacher1/2, etc. —
  // are scratch calculator inputs for the student's own GPA planning and
  // must NEVER be treated as an official result, no matter how many of
  // them are filled in. Mixing the two used to mean: touch the Term
  // Planner's calculator, never open Results at all, and Results would
  // still show a grade computed from those scratch numbers (including a
  // stray F when a field like `hall` picked up an accidental 0) — as if
  // the student had actually submitted a result. hasOfficialEntry below
  // is the one and only gate for whether this course has a REAL entry.
  // hasOfficialEntry checks the field this specific course TYPE actually
  // uses for its official entry (resultGrade for Sessional via Results.jsx,
  // publishedGrade for everything else) — not just "either field is set" —
  // since a Sessional course's resultGrade being present should never make
  // a Theory course elsewhere look like it has an official entry, and
  // vice versa (they're keyed per-course, but this keeps the check exact
  // rather than accidentally permissive).
  const hasOfficialEntry = course.type === 'Sessional'
    ? !!String(m.resultGrade || '').trim()
    : !!String(m.publishedGrade || '').trim();

  const termKey = `Y${course.year}T${course.term}`;
  const nyp = store.get('notYetPublishedTerms');
  const termMarkedNotPublished = Array.isArray(nyp) && nyp.includes(termKey);

  if (termMarkedNotPublished && !hasOfficialEntry) {
    return { grade: 'NOT YET PUBLISHED', point: null, total: null, isNotPublished: true };
  }

  if (!hasOfficialEntry && course.type !== 'NonCredit') {
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

export const getTermIndex = (termKey) => {
  const match = String(termKey || '').match(/^Y(\d+)T(\d+)$/);
  if (!match) return -1;
  const year = Number(match[1]);
  const term = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(term) || year < 1 || term < 1 || term > 2) return -1;
  return ((year - 1) * 2) + (term - 1);
};

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
    year: (year >= 1 && year <= 9) ? year : null,
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

export const normalizeProfileForSave = (input = {}) => {
  const raw = input || {};
  const studentId = String(raw.studentId || '').trim();
  const derivedBatch = extractBatchFromRoll(studentId);
  const derivedDept = getDeptCodeFromRoll(studentId);
  const canonicalDept = getCanonicalDeptCode(raw.dept) || derivedDept;
  // Section only makes sense for the 4 multi-section depts (120 seats/
  // batch: CE/EEE/ME/CSE) — if the dept isn't one of those, or the dept
  // changed since section was picked, drop it rather than saving a stale
  // value that no longer corresponds to a real class split.
  const deptSeats = (DEPARTMENTS.find((d) => d.code === canonicalDept) || {}).seats;
  const sectionValue = deptSeats === 120
    ? String(raw.section || '').trim().toUpperCase()
    : '';

  return {
    ...DEFAULT_PROFILE,
    ...raw,
    studentId,
    dept: canonicalDept,
    section: sectionValue,
    batch: derivedBatch || '',
    currentTermKey: String(raw.currentTermKey || '').trim(),
    currentTerm: String(raw.currentTerm || '').trim(),
    hallName: String(raw.hallName || '').trim(),
    roomNo: String(raw.roomNo || '').trim(),
    advisorName: String(raw.advisorName || '').trim(),
    advisorContact: String(raw.advisorContact || '').trim(),
    bio: String(raw.bio || '').trim().slice(0, 160),
    bloodGroup: BLOOD_GROUP_VALUES.includes(String(raw.bloodGroup || '').trim().toUpperCase())
      ? String(raw.bloodGroup || '').trim().toUpperCase() : '',
    termStartDate: raw.termStartDate || null,
    yearStarted: raw.yearStarted || null,
  };
};

// BUGFIX (stale profile prefill): ProfileSetupModal's initialProfile used
// to be fed straight from getProfile() with no ownership check at all —
// so a genuinely NEW account (freshly signed in on a device/browser that
// still has a previous account's or an earlier abandoned attempt's
// half-filled profile sitting in localStorage under the same 'profile'
// key) would see that old person's name/roll/dept/hall silently
// pre-filled into their own onboarding form. isNewlyCreatedAccount() in
// App.jsx already detects the "this account is brand new" half of this,
// but had no way to also know "...and is this stored profile actually
// mine?" — nothing previously recorded which account a saved profile
// belonged to.
//
// Fix: tag the profile with its owner's uid at save time (below), and
// give callers a cheap way to check that tag against the currently
// signed-in uid before trusting the stored profile as a prefill source.
// This only affects what App.jsx decides to pass into initialProfile —
// getProfile() itself is unchanged and still returns the raw stored
// profile for every other existing caller (Classmates matching,
// attendance, term roadmap, etc.), so nothing downstream of a completed
// profile is touched by this.
export const tagProfileOwner = (profile, uid) => {
  if (!uid) return profile;
  return { ...profile, __ownerUid: uid };
};

/**
 * True if `profile` was saved by a DIFFERENT uid than `uid` (or has no
 * owner tag at all, e.g. from before this fix / a wiped-and-reused
 * device) AND isn't actually complete yet — i.e. it's safe-looking
 * leftover data, not a real finished profile, so it shouldn't be trusted
 * as a prefill source for someone else's fresh onboarding. A COMPLETE
 * profile with no tag (pre-existing users updating through this fix) is
 * deliberately left alone here — this only guards the brand-new-account
 * prefill case, not established profiles.
 */
export const isProfileStaleForUid = (profile, uid) => {
  const p = profile || {};
  if (isProfileComplete(p)) return false; // never second-guess a real, finished profile
  if (!uid) return false;
  const owner = p.__ownerUid;
  return !!owner && owner !== uid;
};

export const getProfile = () => {
  const raw = store.get('profile') || {};
  const currentTermKey = raw.currentTermKey || getTermKeyFromLabel(raw.currentTerm) || '';
  const merged = { ...DEFAULT_PROFILE, ...raw, currentTermKey };
  const studentId = String(merged.studentId || '').trim();
  const batchKey = extractBatchFromRoll(studentId);
  const fixedStart = batchKey && BATCH_START_DATES[batchKey];

  if (fixedStart) {
    merged.yearStarted = fixedStart;
  }

  if (batchKey) {
    merged.batch = batchKey;
  } else {
    merged.batch = '';
  }

  const canonicalDept = getCanonicalDeptCode(merged.dept) || getDeptCodeFromRoll(studentId);
  merged.dept = canonicalDept;

  return merged;
};

export const getCurrentTermKey = (profile = {}) => {
  return profile.currentTermKey || getTermKeyFromLabel(profile.currentTerm) || '';
};

// Calculate term timeline with holidays, exams, and breaks
// Batch university start dates (not term — set by university, auto-fills Profile)
export const BATCH_START_DATES = {
  '2k23': '2024-10-28',
  '2k24': '2025-09-17',
  '2k25': '2026-06-28',
};

// Derives batch (e.g. "2k23") from a student roll number's first two digits.
// Rejects batches that are newer than the current year, since those are
// invalid for KUET roll numbers in the present academic timeline.
export const extractBatchFromRoll = (roll) => {
  const r = String(roll || '').trim();
  if (r.length < 2) return '';
  const firstTwoDigits = r.slice(0, 2);
  const year = parseInt(firstTwoDigits, 10);
  const currentYearSuffix = Number(String(new Date().getFullYear()).slice(-2));
  if (!Number.isFinite(year) || year > currentYearSuffix) return '';
  return `2k${firstTwoDigits}`;
};

export const getTermTimeline = (termStartDate, deptCode, termKey, roadmapConfig = {}) => {
  if (!termStartDate) return null;

  try {
    const start = new Date(termStartDate + 'T00:00:00');

    // Get holidays from scheduleSettings
    const scheduleSettings = store.get('scheduleSettings') || {};
    const holidayDates = scheduleSettings.holidayDates || [];

    const isHoliday = (date) => {
      const dayOfWeek = date.getDay();
      const dateStr = localDateKey(date);
      return dayOfWeek === 5 || dayOfWeek === 6 || holidayDates.includes(dateStr);
    };

    // Count working days between two dates (inclusive)
    const countWorkingDays = (from, to) => {
      let count = 0;
      const d = new Date(from);
      while (d <= to) {
        if (!isHoliday(d)) count++;
        d.setDate(d.getDate() + 1);
      }
      return count;
    };

    // Phase 1: Class period — requires classEndDate (date picker)
    let classEndDate = null;
    let classDays = null;
    if (roadmapConfig.classEndDate) {
      classEndDate = new Date(roadmapConfig.classEndDate + 'T00:00:00');
      classDays = countWorkingDays(start, classEndDate);
    }

    // Phase 2: Prep leave — requires prepLeaveEndDate (date picker)
    let prepLeaveStart = classEndDate ? new Date(classEndDate.getTime() + 86400000) : null;
    let prepLeaveEnd = null;
    let prepLeaveDays = null;
    if (roadmapConfig.prepLeaveEndDate) {
      prepLeaveEnd = new Date(roadmapConfig.prepLeaveEndDate + 'T00:00:00');
      if (prepLeaveStart) {
        prepLeaveDays = Math.round((prepLeaveEnd - prepLeaveStart) / 86400000) + 1;
      }
    }

    // Phase 3: Exams — examCount (number) only; dates come from examOverrides
    const examCount = Math.max(1, Math.min(12, Number(roadmapConfig.examCount) || 5));
    const examPhases = Array.from({ length: examCount }, (_, i) => ({
      course: i + 1,
      examDate: null, // filled in by examOverrides in the UI
      type: 'exam',
    }));

    // Phase 4: Post-exam break — requires postExamEndDate (date picker)
    let postExamBreakEnd = null;
    let postExamBreakStart = null;
    let nextSemesterStart = null;
    if (roadmapConfig.postExamEndDate) {
      postExamBreakEnd = new Date(roadmapConfig.postExamEndDate + 'T00:00:00');
      nextSemesterStart = new Date(postExamBreakEnd.getTime() + 86400000);
    }

    // Duration: term start → post-exam end (if available), else class end
    const durationEnd = postExamBreakEnd || classEndDate;
    let durationDays = null, durationWeeks = null, durationMonths = null;
    if (durationEnd) {
      durationDays = Math.round((durationEnd - start) / 86400000);
      durationWeeks = Math.round(durationDays / 7);
      durationMonths = parseFloat((durationDays / 30.44).toFixed(1));
    }

    return {
      classEndDate,
      classDays,
      prepLeaveStart,
      prepLeaveEnd,
      prepLeaveDays,
      examPhases,
      specialPeriods: [],
      postExamBreakStart,
      postExamBreakEnd,
      nextSemesterStart,
      theoryCourses: examCount,
      durationDays,
      durationWeeks,
      durationMonths,
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
  bloodGroup: '', bio: '',
  termStartDate: null, // ISO date string: YYYY-MM-DD
};

// Minimum fields needed for the app (classmates matching, attendance
// slabs, term roadmap, etc.) to work at all. Used to force first-run
// users through ProfileSetupModal before anything else — half-filled
// profiles were the root cause of several "why is X missing/broken"
// reports (Classmates match, roll-based verification, term dates).
export const isProfileComplete = (profile) => {
  const p = profile || {};
  const studentId = String(p.studentId || '').trim();
  const hasName = !!String(p.name || '').trim();
  const hasStudentId = /^\d{7}$/.test(studentId);
  const hasValidDept = isAllowedDeptCode(p.dept) || isAllowedDeptCode(getDeptCodeFromRoll(studentId));
  const hasValidBatch = Boolean(extractBatchFromRoll(studentId));
  // Migration gate: the 4 multi-section depts (CE/EEE/ME/CSE, 120 seats/
  // batch) additionally require profile.section — without it getGroupId()
  // returns null and every class feature (CR, roster, routine, notices)
  // silently stops working. Routing this through isProfileComplete means
  // existing pre-migration profiles (saved before the section field
  // existed) get the same "please complete your profile" force-reopen
  // that App.jsx already uses for any other incomplete profile — no
  // separate migration-prompt code path needed.
  const effectiveDept = isAllowedDeptCode(p.dept) ? p.dept : getDeptCodeFromRoll(studentId);
  const deptSeats = (DEPARTMENTS.find((d) => d.code === effectiveDept) || {}).seats;
  const hasValidSection = deptSeats === 120 ? ['A', 'B'].includes(String(p.section || '').trim().toUpperCase()) : true;
  return hasName && hasStudentId && hasValidDept && hasValidBatch && hasValidSection;
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

// Validate a profile before saving. Returns { ok: boolean, errors: { field: message } }
export const validateProfileForSave = (input = {}) => {
  const normalized = normalizeProfileForSave(input);
  const errors = {};
  const studentId = String(normalized.studentId || '').trim();

  if (!/^\d{7}$/.test(studentId)) {
    errors.studentId = 'Student ID must be a 7-digit KUET roll number';
  }

  if (!String(normalized.batch || '').trim()) {
    errors.batch = 'Batch could not be derived from the roll number; provide a valid roll';
  }

  if (!isAllowedDeptCode(normalized.dept)) {
    errors.dept = 'Department must be one of KUET\'s 16 approved department codes';
  }

  return { ok: Object.keys(errors).length === 0, errors };
};