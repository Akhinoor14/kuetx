// PERFORMANCE FIX: this replaces the old departments/index.js, which
// statically imported ALL 16 departments' full curriculum (syllabus, all
// 8 terms, notes) — about 2.6MB of source, the single biggest contributor
// to the app's ~1.75MB eager main JS chunk. Every visitor's browser had to
// download and parse every other department's 4-year curriculum before
// the app could render anything, even though a given student only ever
// needs their own one department (occasionally a CR/faculty member looks
// at another department's course list, but that's rare and can afford a
// one-time fetch).
//
// This module keeps a synchronous-looking API (getDeptCurriculumSync)
// backed by an in-memory cache, so none of the ~25 existing call sites
// throughout the app need to change to handle a Promise. Each
// department's chunk is fetched via a dynamic import() the first time it's
// needed, and cached forever after (curriculum data is static per build).
// Until a department's data has loaded, getDeptCurriculumSync returns an
// empty-but-valid shape (matching the existing fallback in
// curriculumStore.js's getDeptCurriculum) and kicks off the load in the
// background; callers that already re-render on store/profile updates
// will pick up the real data on the next render once it resolves.
//
// preloadDeptCurriculum(deptCode) lets App.jsx warm the cache for the
// signed-in user's own department as early as possible (as soon as
// profile.dept is known), so in practice the data is usually already
// cached by the time any page actually needs it.

const loaders = {
  ECE: () => import('./departments/ECE/index.js').then((m) => m.ECE_DEPARTMENT),
  ESE: () => import('./departments/ESE/index.js').then((m) => m.ESE_DEPARTMENT),
  MTE: () => import('./departments/MTE/index.js').then((m) => m.MTE_DEPARTMENT),
  MSE: () => import('./departments/MSE/index.js').then((m) => m.MSE_DEPARTMENT),
  ME: () => import('./departments/ME/index.js').then((m) => m.ME_DEPARTMENT),
  IPE: () => import('./departments/IPE/index.js').then((m) => m.IPE_DEPARTMENT),
  LE: () => import('./departments/LE/index.js').then((m) => m.LE_DEPARTMENT),
  URP: () => import('./departments/URP/index.js').then((m) => m.URP_DEPARTMENT),
  BME: () => import('./departments/BME/index.js').then((m) => m.BME_DEPARTMENT),
  EEE: () => import('./departments/EEE/index.js').then((m) => m.EEE_DEPARTMENT),
  CSE: () => import('./departments/CSE/index.js').then((m) => m.CSE_DEPARTMENT),
  BECM: () => import('./departments/BECM/index.js').then((m) => m.BECM_DEPARTMENT),
  Arch: () => import('./departments/Arch/index.js').then((m) => m.Arch_DEPARTMENT),
  TE: () => import('./departments/TE/index.js').then((m) => m.TE_DEPARTMENT),
  ChE: () => import('./departments/ChE/index.js').then((m) => m.CHE_DEPARTMENT),
  CE: () => import('./departments/CE/index.js').then((m) => m.CE_DEPARTMENT),
};

const EMPTY_DEPARTMENT = (deptCode) => ({
  meta: { code: deptCode, name: deptCode, acronym: deptCode },
  terms: {},
  optional: [],
  notes: {},
  syllabus: { terms: {}, courses: {} },
});

// Resolved department data, once loaded.
const cache = new Map();
// In-flight promises, so concurrent callers for the same dept share one fetch.
const pending = new Map();
// Subscribers to notify when a department finishes loading, so synchronous
// consumers that got the empty placeholder can be told to re-check.
const listeners = new Set();

const notifyListeners = () => {
  for (const fn of listeners) {
    try { fn(); } catch { /* ignore listener errors */ }
  }
  // Also piggyback on the app's existing global store-update event, so
  // components that already re-render on it (Navbar, TodayCard, alerts,
  // etc.) pick up the newly-loaded department data automatically, without
  // each one needing to know about departmentLoader.js specifically.
  try {
    window.dispatchEvent(new CustomEvent('kuetx:store-updated', { detail: { key: 'curriculum' } }));
  } catch { /* not in a browser environment */ }
};

export const onDeptCurriculumLoaded = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const preloadDeptCurriculum = (deptCode) => {
  if (!deptCode || cache.has(deptCode) || pending.has(deptCode)) return pending.get(deptCode) || Promise.resolve();
  const loader = loaders[deptCode];
  if (!loader) return Promise.resolve();
  const promise = loader()
    .then((data) => {
      cache.set(deptCode, data);
      pending.delete(deptCode);
      notifyListeners();
      return data;
    })
    .catch((err) => {
      pending.delete(deptCode);
      console.error(`[curriculum] Failed to load department "${deptCode}":`, err);
    });
  pending.set(deptCode, promise);
  return promise;
};

// Synchronous accessor used by all existing call sites (via
// curriculumStore.js's getDeptCurriculum). Returns cached data if present;
// otherwise kicks off a background load and returns a harmless empty shape
// for this render — matches the pre-existing fallback behavior for unknown
// department codes, so no caller needed to change.
export const getDeptCurriculumSync = (deptCode) => {
  if (!deptCode) return null;
  if (cache.has(deptCode)) return cache.get(deptCode);
  preloadDeptCurriculum(deptCode);
  return EMPTY_DEPARTMENT(deptCode);
};

export const isDeptCurriculumLoaded = (deptCode) => cache.has(deptCode);
