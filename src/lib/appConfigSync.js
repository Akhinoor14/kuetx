// appConfigSync.js
//
// Founder-editable app-wide config, stored as small singleton docs under
// config/{key}. First (and currently only) use: config/batches — the list
// of active batches (e.g. 2k23/2k24/2k25) shown in every "Select batch"
// dropdown across the app (Faculty Add Class, My Classes grouping, etc).
//
// Why this exists: store.js's BATCH_START_DATES used to be the sole
// source of truth, hardcoded at build time. That's fine for the batch
// START dates (those genuinely are fixed once a batch begins), but the
// LIST of which batches currently show up in dropdowns needs to change
// every year — a new batch starts, an old one graduates — and shipping a
// code change for that each time isn't sustainable. This module makes the
// active-batch LIST founder-editable at runtime, while start dates stay
// in store.js (a batch's start date doesn't change once set, so there's
// no ongoing reason to move that part into Firestore too).
//
// Falls back to store.js's BATCH_START_DATES keys if config/batches
// doesn't exist yet (e.g. first deploy, before any Founder has opened the
// settings page) — so nothing breaks pre-migration.

import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { BATCH_START_DATES } from '../store/store';

const CONFIG_DOC = doc(db, 'config', 'batches');

const fallbackBatches = () => Object.keys(BATCH_START_DATES);

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
 * Founder-only write — replaces the whole active batch list. Firestore
 * rules gate the actual write permission; this function just shapes the
 * payload. Order matters: batch COLOR assignment (getBatchColor in
 * timeModels.js) is by position in this array, so reordering changes
 * colors app-wide — intentionally, since Founder-controlled reordering is
 * the escape hatch if a color collision ever needs fixing without a code
 * deploy.
 */
export async function setActiveBatches(batchKeys) {
  const cleaned = [...new Set(batchKeys.map((b) => String(b).trim().toLowerCase()).filter(Boolean))];
  await setDoc(CONFIG_DOC, { active: cleaned, updatedAt: serverTimestamp() }, { merge: true });
  return cleaned;
}
