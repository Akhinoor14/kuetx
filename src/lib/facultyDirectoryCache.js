// facultyDirectoryCache.js
//
// Read-optimized access layer for the facultyDirectory collection.
//
// WHY THIS EXISTS: facultyDirectory is populated by a scraper that runs
// only twice a month (1st and 3rd Friday, 03:00 BD time — see
// .github/workflows/kuet-faculty-scrape.yml). Reading it live via
// onSnapshot on every page visit would burn Firestore's Spark-plan
// read quota for data that's essentially static between scrapes. This
// file does a ONE-TIME getDocs() fetch, caches the result in
// localStorage with a TTL, and every caller in the app reads through
// this cache instead of querying Firestore directly.
//
// firestore.rules confirms facultyDirectory is read-only for every
// client (no write clause at all — only the scraper's Admin SDK service
// account writes here, bypassing rules entirely). So this file is
// exclusively a READ path; there is no corresponding write function
// here and there never should be.
//
// TTL: 3 days. The real scrape cadence is ~14 days apart (1st & 3rd
// Friday), so a 3-day TTL means data is refreshed several times between
// scrapes (never more than 3 days stale) while still cutting reads by
// roughly 95%+ versus reading on every visit for an app used daily.

import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';

const CACHE_KEY = 'kuetx:facultyDirectoryCache:v1';
const TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

// In-memory copy for the current tab/session — avoids even a
// localStorage read+JSON.parse for every caller once the first one in
// this page load has populated the cache. Cleared naturally on reload;
// localStorage is the layer that survives across reloads.
let memoryCache = null;

// Coalesces concurrent callers during a cold-cache fetch (e.g. several
// components mounting at once) into a single Firestore read instead of
// each firing its own getDocs().
let inFlightFetch = null;

function readLocalStorageCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries) || typeof parsed.fetchedAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    // Corrupt JSON, private-browsing storage denial, etc. — treat as a
    // cache miss, never let a storage error break the page.
    return null;
  }
}

function writeLocalStorageCache(entries) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), entries }));
  } catch {
    // Quota exceeded / storage disabled — non-fatal. The cache is a
    // pure optimization; the freshly-fetched data is still returned to
    // the caller from fetchFromFirestore() regardless of whether the
    // write here succeeded.
  }
}

async function fetchFromFirestore() {
  const snap = await getDocs(collection(db, 'facultyDirectory'));
  const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  writeLocalStorageCache(entries);
  memoryCache = { fetchedAt: Date.now(), entries };
  return entries;
}

/**
 * Returns every facultyDirectory entry, using the cache when it's fresh.
 * @param {{ forceRefresh?: boolean }} [opts]
 */
export async function getAllFacultyDirectory(opts = {}) {
  const { forceRefresh = false } = opts;

  if (!forceRefresh && memoryCache && Date.now() - memoryCache.fetchedAt < TTL_MS) {
    return memoryCache.entries;
  }

  if (!forceRefresh) {
    const stored = readLocalStorageCache();
    if (stored && Date.now() - stored.fetchedAt < TTL_MS) {
      memoryCache = stored;
      return stored.entries;
    }
  }

  // Cold cache or forced refresh — coalesce concurrent callers into one
  // Firestore read.
  if (!inFlightFetch) {
    inFlightFetch = fetchFromFirestore().finally(() => { inFlightFetch = null; });
  }
  return inFlightFetch;
}

/**
 * Look up a single teacher by email through the same cache. Falls back
 * to a direct getDoc() ONLY when the email genuinely isn't in the
 * cached set (e.g. a deep link to a brand-new teacher added since the
 * cache was last warmed) — so a shared/bookmarked /teachers/:email link
 * never dead-ends on stale data.
 */
export async function getFacultyDirectoryEntry(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const entries = await getAllFacultyDirectory();
  const found = entries.find((e) => e.id === normalizedEmail);
  if (found) return found;

  // Not in the cached snapshot — try a direct read before giving up,
  // in case this is a teacher added after the cache was last warmed.
  try {
    const snap = await getDoc(doc(db, 'facultyDirectory', normalizedEmail));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch {
    return null;
  }
}

/**
 * Local substring search across name/department/designation/phone on
 * the cached array — no Firestore query per keystroke. Used by the
 * "All Teachers" search box.
 */
export async function searchFacultyDirectory(queryText) {
  const q = String(queryText || '').trim().toLowerCase();
  if (!q) return getAllFacultyDirectory();

  const entries = await getAllFacultyDirectory();
  return entries.filter((e) => {
    const haystack = [e.name, e.department, e.designation, e.phone]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
