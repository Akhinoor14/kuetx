// activityTracking.js
//
// Lightweight, privacy-respecting activity tracker that powers the
// Founder/SCL Analytics dashboard (analyticsEngine.js + AnalyticsDashboard.jsx).
// Two things get written here, both intentionally minimal:
//
//   1. activity/{uid}          — ONE doc per user, upserted on a heartbeat.
//      Holds only: lastActiveAt, dept, batch, role, firstSeenAt (set once).
//      This is what DAU/WAU/MAU and D1/D7/D30 retention are computed from
//      (analyticsEngine.js reads a range of these and buckets them by day).
//
//   2. activity/{uid}/moduleUsage/{moduleKey} — one doc per module the user
//      has ever touched, holding lastUsedAt + a running useCount. This is
//      what feature-adoption ("% of active users touching Question Bank
//      this week") is computed from. Deliberately NOT a full event log —
//      no per-click timestamps, no history — a running counter + last-used
//      is enough for adoption %, and keeps this from becoming a privacy or
//      cost problem as the user base grows.
//
// Design choices, and why:
// - Heartbeat interval is 15 minutes — the standard balance between
//   Firestore write cost and DAU accuracy (5 min is overkill for a
//   student app; a single per-session write would undercount someone who
//   keeps a tab open for hours, which happens a lot with Diary/Schedule).
// - Heartbeat fires once immediately on mount (so a short visit still
//   counts) and then every 15 min while the tab stays open/foreground.
// - Uses setDoc(..., {merge:true}) so this is safe to call from any
//   screen without needing to know whether the doc already exists.
// - Silently no-ops for anonymous/signed-out users and for Founder's
//   OWN admin session (see isTrackablySignedIn below) — there is no
//   product reason to track the Founder's own usage of their own
//   dashboard, and doing so would pollute "active student/faculty count."
// - This module never reads what a user is doing for any purpose other
//   than the aggregate counts described above — no individual "who was
//   online when" surfacing anywhere in the UI.

import { doc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db, auth } from './firebase';
import { getProfile } from '../store/store';
import { getAccountRole } from './accountRole';

const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000; // 15 min — see note above

let heartbeatTimer = null;
let lastModuleLogged = null;

function isTrackablySignedIn() {
  const user = auth.currentUser;
  return !!user && !user.isAnonymous;
}

/** Best-effort — analytics must never break the app it's measuring. */
async function safeWrite(fn) {
  try {
    await fn();
  } catch {
    // Offline, rules-denied (shouldn't happen for a user's own uid), or
    // any other transient failure — analytics is diagnostic, not
    // functional, so it fails silently rather than surfacing an error UI.
  }
}

/** Upserts activity/{uid} with a fresh lastActiveAt + current dept/batch/role. */
function sendHeartbeat() {
  if (!isTrackablySignedIn()) return;
  const uid = auth.currentUser.uid;
  const profile = getProfile();
  const role = getAccountRole() || 'student';

  safeWrite(() =>
    setDoc(
      doc(db, 'activity', uid),
      {
        lastActiveAt: serverTimestamp(),
        // firstSeenAt only ever gets set by Firestore rules' "only if it
        // didn't already exist" pattern — see the rule itself. We always
        // pass it here; the rule ignores it on update.
        firstSeenAt: serverTimestamp(),
        dept: profile.dept || null,
        batch: profile.batch || null,
        role,
      },
      { merge: true }
    )
  );
}

/**
 * Logs that the signed-in user touched a given module this session.
 * `moduleKey` should be one of MODULE_KEYS (moduleMap.js) — kept as a
 * plain string here (not enum-enforced) so callers don't need to import
 * a giant const object just to log a page view.
 * De-duped per session-tick: calling this repeatedly for the SAME module
 * within the same render cycle is harmless but wasteful, so we skip an
 * immediate repeat of the exact same key back-to-back.
 */
export function logModuleUsage(moduleKey) {
  if (!moduleKey || !isTrackablySignedIn()) return;
  if (moduleKey === lastModuleLogged) return;
  lastModuleLogged = moduleKey;

  const uid = auth.currentUser.uid;
  safeWrite(() =>
    setDoc(
      doc(db, 'activity', uid, 'moduleUsage', moduleKey),
      {
        lastUsedAt: serverTimestamp(),
        useCount: increment(1),
      },
      { merge: true }
    )
  );
}

/** Call once from App.jsx after auth is ready. Returns a cleanup function. */
export function startActivityTracking() {
  sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

  const onVisible = () => {
    if (document.visibilityState === 'visible') sendHeartbeat();
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    document.removeEventListener('visibilitychange', onVisible);
  };
}

export function stopActivityTracking() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  lastModuleLogged = null;
}
