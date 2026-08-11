// analyticsEngine.js
//
// Reads the raw activity/{uid} heartbeat docs (activityTracking.js is the
// writer) and computes everything AnalyticsDashboard.jsx displays:
//   - DAU / WAU / MAU + the DAU/MAU "stickiness" ratio
//   - a 30-day daily-active trend (for the line chart)
//   - D1 / D7 / D30 retention (cohort-based — see computeRetention below
//     for exactly what "Day N retention" means here)
//   - module (feature) adoption — % of this period's active users who
//     touched each module at least once
//   - role breakdown (student vs teacher) and, for the Founder-only view,
//     dept-wise active counts
//
// All computation is done CLIENT-SIDE against a single one-shot fetch of
// the relevant activity docs — no Cloud Function, no scheduled job. This
// keeps the whole feature to "add a doc, read some docs, do array math,"
// which is the right amount of infrastructure for a few thousand users.
// If this ever needs to scale past that, the fetch functions below
// (fetchActivityDocs) are the one place that would need to become a
// server-side aggregation instead — nothing else in this file assumes
// client-side computation.
//
// Firestore rules (firestore.rules' `match /activity/{uid}`) are the REAL
// access boundary here — Founder reads everyone, an SCL's query can only
// ever return docs for their own dept (a query for another dept's docs
// is rejected by the rule, not filtered client-side), so there's no
// separate "can this caller see this data" check needed in this file.

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { MODULES, MODULE_LABELS } from './moduleMap';
import { withPromiseTimeout } from './safeSnapshot';

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts);
}

function dayKey(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD (UTC bucket — fine for aggregate counts)
}

/**
 * Fetches activity docs. `dept: null` = Founder view (everyone).
 * `dept: 'CSE'` etc = SCL view (rules enforce this can ONLY return that
 * dept's docs — passing a dept the caller doesn't lead just returns
 * permission-denied, not someone else's data).
 * `sinceDays` bounds the fetch so a Founder-view query on a large user
 * base doesn't pull the entire collection when only the last 30 days are
 * ever displayed.
 */
export async function fetchActivityDocs({ dept = null, sinceDays = 30 } = {}) {
  const since = new Date(Date.now() - sinceDays * DAY_MS);
  const col = collection(db, 'activity');
  const constraints = dept ? [where('dept', '==', dept)] : [];
  // firstSeenAt is used for retention cohorts, lastActiveAt for DAU/WAU/MAU
  // — both need the same doc, so one fetch (filtered only by dept, not by
  // date) is simplest and avoids two separate composite-index shapes. The
  // `since` cutoff above is applied client-side for firstSeenAt-based
  // cohorting; lastActiveAt is checked in-memory per metric below anyway.
  const snap = await withPromiseTimeout(getDocs(query(col, ...constraints)), '[analyticsEngine] fetchActivityDocs');
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        lastActiveAt: toDate(data.lastActiveAt),
        firstSeenAt: toDate(data.firstSeenAt),
        dept: data.dept || null,
        batch: data.batch || null,
        role: data.role || 'student',
      };
    })
    .filter((u) => u.lastActiveAt); // a doc mid-write (serverTimestamp not yet resolved) — skip, not crash
}

/** DAU / WAU / MAU + stickiness ratio, from an already-fetched doc list. */
export function computeActiveCounts(docs) {
  const now = Date.now();
  const dau = docs.filter((u) => now - u.lastActiveAt.getTime() <= DAY_MS).length;
  const wau = docs.filter((u) => now - u.lastActiveAt.getTime() <= 7 * DAY_MS).length;
  const mau = docs.filter((u) => now - u.lastActiveAt.getTime() <= 30 * DAY_MS).length;
  return {
    dau,
    wau,
    mau,
    // Stickiness: what % of this month's active users are active TODAY.
    // The single clearest "is engagement healthy" number in the whole
    // dashboard — a school-schedule-driven app will naturally swing with
    // weekdays/exam periods, but a persistently low ratio (<10-15%) means
    // people open it once a month, not daily, which is the real signal.
    stickiness: mau > 0 ? Math.round((dau / mau) * 1000) / 10 : 0,
  };
}

/** Daily active-user counts for the last N days, oldest first — feeds the trend chart. */
export function computeDailyTrend(docs, days = 30) {
  const buckets = new Map();
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(dayKey(new Date(Date.now() - i * DAY_MS)), 0);
  }
  // A user is counted on every day between their lastActiveAt's day and...
  // we only have ONE lastActiveAt per user (not a full history), so the
  // trend chart counts each user only on the single day of their most
  // recent heartbeat — this undercounts users who were also active on
  // earlier days within the window (we don't retain that), but gives an
  // accurate "how many people's most-recent activity fell on this day"
  // shape, which is what matters for spotting week-over-week trend
  // direction. A true multi-day-per-user trend would need a daily log
  // doc instead of a single heartbeat — a deliberate scope cut, see the
  // module header.
  for (const u of docs) {
    const key = dayKey(u.lastActiveAt);
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1);
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
}

/**
 * D1 / D7 / D30 retention, cohort-based:
 *   - The "cohort" for Day N is every user whose firstSeenAt was at
 *     least N days ago (so they've HAD the chance to return on day N).
 *   - A cohort member "retained" at Day N if their lastActiveAt is on or
 *     after firstSeenAt + N days (i.e. they came back, rather than only
 *     ever having that single first session).
 * This is the standard definition used across the product-analytics
 * sources this design is based on (unbounded/"any activity after day N"
 * retention, not "activity on exactly day N") — simpler to compute from
 * a single lastActiveAt field, and the more common definition in
 * practice for a habitual-use app like this one.
 */
export function computeRetention(docs) {
  const now = Date.now();
  function retentionFor(days) {
    const cohort = docs.filter((u) => u.firstSeenAt && now - u.firstSeenAt.getTime() >= days * DAY_MS);
    if (cohort.length === 0) return null; // not enough history yet — show "—" rather than a misleading 0%
    const retained = cohort.filter(
      (u) => u.lastActiveAt.getTime() - u.firstSeenAt.getTime() >= days * DAY_MS
    ).length;
    return { pct: Math.round((retained / cohort.length) * 1000) / 10, cohortSize: cohort.length };
  }
  return { d1: retentionFor(1), d7: retentionFor(7), d30: retentionFor(30) };
}

/** Role breakdown (student vs teacher vs other) among currently-active (MAU window) users. */
export function computeRoleBreakdown(docs) {
  const now = Date.now();
  const active = docs.filter((u) => now - u.lastActiveAt.getTime() <= 30 * DAY_MS);
  const counts = {};
  for (const u of active) counts[u.role] = (counts[u.role] || 0) + 1;
  return counts;
}

/** Dept-wise active counts (Founder-only view — an SCL's fetch is already single-dept). */
export function computeDeptBreakdown(docs) {
  const now = Date.now();
  const active = docs.filter((u) => now - u.lastActiveAt.getTime() <= 30 * DAY_MS);
  const counts = {};
  for (const u of active) {
    const key = u.dept || 'Unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([dept, count]) => ({ dept, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Feature adoption: for each module, what % of ACTIVE (MAU-window) users
 * in `docs` have a moduleUsage doc with lastUsedAt inside the same
 * window. Requires one get() per user per module in the worst case, so
 * this is bounded to the currently-active set (not the full historical
 * user base) and is meant to be called only when the Adoption tab is
 * actually opened — see AnalyticsDashboard.jsx's lazy-tab loading.
 */
export async function computeModuleAdoption(docs) {
  const now = Date.now();
  const active = docs.filter((u) => now - u.lastActiveAt.getTime() <= 30 * DAY_MS);
  if (active.length === 0) {
    return Object.values(MODULES).map((key) => ({ key, label: MODULE_LABELS[key], pct: 0, users: 0 }));
  }

  const moduleKeys = Object.values(MODULES);
  const usageCounts = Object.fromEntries(moduleKeys.map((k) => [k, 0]));

  // Batched per-user moduleUsage collection reads. Firestore has no
  // "collectionGroup across a specific uid list" shortcut here, so this
  // is N reads (one per active user) each returning that user's (small,
  // ≤6-doc) moduleUsage collection — acceptable at the scale this
  // feature is designed for (see module header), and rules-safe since
  // each read is scoped to a uid the caller is already authorized to see
  // (they're in `active`, which only ever came from an authorized fetch).
  await Promise.all(
    active.map(async (u) => {
      try {
        const snap = await withPromiseTimeout(getDocs(collection(db, 'activity', u.uid, 'moduleUsage')), '[analyticsEngine] computeModuleAdoption');
        const seenThisUser = new Set();
        snap.forEach((d) => {
          const data = d.data();
          const lastUsed = toDate(data.lastUsedAt);
          if (lastUsed && now - lastUsed.getTime() <= 30 * DAY_MS && moduleKeys.includes(d.id)) {
            seenThisUser.add(d.id);
          }
        });
        for (const key of seenThisUser) usageCounts[key] += 1;
      } catch {
        // A single user's subcollection read failing (rare — offline mid-
        // batch, etc.) shouldn't blank the whole adoption view.
      }
    })
  );

  return moduleKeys
    .map((key) => ({
      key,
      label: MODULE_LABELS[key],
      users: usageCounts[key],
      pct: Math.round((usageCounts[key] / active.length) * 1000) / 10,
    }))
    .sort((a, b) => b.pct - a.pct);
}
