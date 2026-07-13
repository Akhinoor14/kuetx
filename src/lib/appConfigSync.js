// appConfigSync.js
//
// Founder-editable app-wide config, stored as small singleton docs under
// config/{key}. First (and currently only) use: config/batches — the list
// of active batches (e.g. 2k23/2k24/2k25) shown in every "Select batch"
// dropdown across the app (Faculty Add Class, My Classes grouping, etc.),
// AND each batch's university start date (used to auto-fill a student's
// yearStarted on Profile setup, and to power the batch/term plausibility
// warning in Faculty Add Class).
//
// v2 shape (this file): { active: string[], startDates: { [batch]: 'YYYY-MM-DD' }, updatedAt }
// Previously only `active` lived here and start dates were a build-time
// constant (store.js's BATCH_START_DATES) — meaning a Founder adding a new
// batch through the Manage Batches page had no way to set its start date
// without a code deploy, so newly-added batches silently got NO start date
// (yearStarted stayed blank, term-plausibility checks were skipped). Start
// dates now live in Firestore alongside the active list, so adding a batch
// and setting its date is a single in-app action, no deploy required.
//
// store.js's BATCH_START_DATES is kept as a seed/fallback ONLY — it is
// merged UNDER whatever's in Firestore (Firestore always wins per-key), so
// pre-migration deployments and offline/first-load moments still have
// correct dates for 2k23/2k24/2k25, and any Firestore-added batch's date
// overrides or extends that seed. Nothing reads BATCH_START_DATES directly
// anymore outside this module — always go through getActiveBatches() /
// subscribeActiveBatches() / getBatchStartDates() / subscribeBatchStartDates().

import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { BATCH_START_DATES } from '../store/store';

const CONFIG_DOC = doc(db, 'config', 'batches');

const fallbackBatches = () => Object.keys(BATCH_START_DATES);

function mergeStartDates(firestoreDates) {
  // Firestore-provided dates win per-key; the static object only fills in
  // keys Firestore doesn't have an entry for yet.
  return { ...BATCH_START_DATES, ...(firestoreDates || {}) };
}

/**
 * One-time fetch of the active batch list. Returns store.js's static keys
 * if the config doc hasn't been created yet.
 */
export async function getActiveBatches() {
  try {
    const snap = await getDoc(CONFIG_DOC);
    if (snap.exists() && Array.isArray(snap.data().active) && snap.data().active.length) {
      return snap.data().active;
    }
  } catch {
    // Firestore rules may not allow read pre-migration on some deployments
    // — fall through to the static fallback rather than throwing.
  }
  return fallbackBatches();
}

/**
 * Live-subscribe to the active batch list. Callback fires once
 * immediately (with the fallback list if the doc doesn't exist yet, then
 * again the moment real data arrives) and again on every Founder edit.
 */
export function subscribeActiveBatches(callback) {
  return onSnapshot(CONFIG_DOC, (snap) => {
    if (snap.exists() && Array.isArray(snap.data().active) && snap.data().active.length) {
      callback(snap.data().active);
    } else {
      callback(fallbackBatches());
    }
  }, () => {
    callback(fallbackBatches());
  });
}

/**
 * One-time fetch of the merged { batchKey: 'YYYY-MM-DD' } start-date map —
 * Firestore's config/batches.startDates overlaid on the static seed.
 */
export async function getBatchStartDates() {
  try {
    const snap = await getDoc(CONFIG_DOC);
    if (snap.exists()) {
      return mergeStartDates(snap.data().startDates);
    }
  } catch {
    // Same pre-migration/rules fallback as getActiveBatches().
  }
  return mergeStartDates(null);
}

/**
 * Live-subscribe to the merged start-date map. Fires once immediately with
 * the seed-only map, then again the moment Firestore data arrives/changes.
 */
export function subscribeBatchStartDates(callback) {
  return onSnapshot(CONFIG_DOC, (snap) => {
    callback(mergeStartDates(snap.exists() ? snap.data().startDates : null));
  }, () => {
    callback(mergeStartDates(null));
  });
}

/**
 * Founder-only write — replaces the whole active batch list. Firestore
 * rules gate the actual write permission; this function just shapes the
 * payload. Order matters: batch COLOR assignment (getBatchColor in
 * timeModels.js) is by position in this array, so reordering changes
 * colors app-wide — intentionally, since Founder-controlled reordering is
 * the escape hatch if a color collision ever needs fixing without a code
 * deploy.
 *
 * startDates is optional and merges into (not replaces) whatever's already
 * stored, so callers that only touch the active list (reorder, remove)
 * don't need to also pass every batch's date every time.
 */
export async function setActiveBatches(batchKeys, startDates) {
  const cleaned = [...new Set(batchKeys.map((b) => String(b).trim().toLowerCase()).filter(Boolean))];
  const payload = { active: cleaned, updatedAt: serverTimestamp() };
  if (startDates && Object.keys(startDates).length) {
    payload.startDates = startDates;
  }
  await setDoc(CONFIG_DOC, payload, { merge: true });
  return cleaned;
}

/**
 * Founder-only write — sets/overwrites a single batch's start date without
 * touching the active list or any other batch's date. Used by "Edit date"
 * on an existing batch row, and by "Add Batch" when a date is supplied.
 */
export async function setBatchStartDate(batchKey, dateStr) {
  const key = String(batchKey).trim().toLowerCase();
  if (!key) throw new Error('No batch key given.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error('Date should be in YYYY-MM-DD format.');
  }
  await setDoc(CONFIG_DOC, {
    startDates: { [key]: dateStr },
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
