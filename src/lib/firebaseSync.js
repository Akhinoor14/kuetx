/**
 * firebaseSync.js — KUETx Firebase Sync (Read-Optimised)
 *
 * Strategy (Spark plan friendly):
 * ─────────────────────────────────────────────────────────────────────────────
 * WRITES  store.set(key) → debounced 4s → single doc write per key
 *         Batch: up to 20 keys merged into one go to reduce round-trips
 *
 * READS   NO real-time onSnapshot listener (that was the quota killer).
 *         Instead:
 *           • Full pull once on login / app start (getDocs, 1 read per doc)
 *           • Periodic background pull every PULL_INTERVAL_MS
 *             (only if the tab is visible & user is online)
 *           • Manual pull via pullNow() (e.g. user taps "Sync now")
 *
 * Spark daily limits (free):
 *   50k reads / 20k writes / 20k deletes
 * Rough estimate with this strategy for 1 user, 1 device:
 *   ~30 store keys → 30 reads on login + 30 reads every PULL_INTERVAL
 *   At 15-min interval: 30 × (24×4) = ~2,880 reads/day — well within 50k
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { store } from '../store/store';

// ─── Config ───────────────────────────────────────────────────────────────────

const PUSH_DEBOUNCE_MS  = 4_000;   // wait 4s after last change before writing
const PULL_INTERVAL_MS  = 15 * 60 * 1000; // pull every 15 min (background)
const MAX_BATCH_PUSH    = 20;      // max keys to push in one tick

const EXCLUDED_KEYS = ['autoBackup', 'lastBackupTime', 'kuetx_guide_seen'];

// NOTE: 'schedule' and 'assignments' are intentionally NOT excluded here.
// Class-group routine/assignments (groupSync.js, groups/{groupId}/
// routineEntries|assignmentEntries) are a completely separate data source
// from this personal per-user store — joining a class group never pushes
// or merges a student's personal schedule into it, and a CR's group
// routine never overwrites anyone's personal copy. The Schedule/Assignments
// pages simply *choose which source to render* (group data when the class
// has an active CR-populated routine, personal otherwise) — the underlying
// storage never mixes, so personal sync needs no special-casing.
const shouldSync = (key) => !EXCLUDED_KEYS.some(ex => key.includes(ex));

// ─── Module state ─────────────────────────────────────────────────────────────

let _uid            = null;
let _pushTimers     = {};          // key → setTimeout id
let _storeListener  = null;
let _pullInterval   = null;
let _isSyncing      = false;

// ─── Status emitter ───────────────────────────────────────────────────────────

const emit = (status, detail = {}) => {
  try {
    window.dispatchEvent(new CustomEvent('kuetx:firebase-sync', {
      detail: { status, ...detail },
    }));
  } catch {}
};

// ─── Write helpers ────────────────────────────────────────────────────────────

const pushKey = async (key, value) => {
  if (!_uid || !shouldSync(key)) return;
  try {
    const docRef = doc(db, 'users', _uid, 'data', key);
    await setDoc(docRef, { value, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.warn('[KUETx Sync] Push failed:', key, err.message);
    emit('error', { message: err.message });
  }
};

// ─── Pull helpers ─────────────────────────────────────────────────────────────

/**
 * Pull all docs from Firestore and merge into local store.
 * This is a one-shot getDocs (not a listener) — each doc = 1 read.
 */
export const pullAllFromFirestore = async (uid) => {
  const targetUid = uid || _uid;
  if (!targetUid) return 0;
  try {
    emit('syncing');
    const colRef   = collection(db, 'users', targetUid, 'data');
    const snapshot = await getDocs(colRef);  // N reads where N = number of docs
    const remote   = {};
    snapshot.forEach(d => {
      const { value } = d.data();
      if (value !== undefined) remote[d.id] = value;
    });

    // Merge remote into local (remote wins — last-write-wins)
    const prefixed = {};
    for (const [k, v] of Object.entries(remote)) prefixed[`kuetx_${k}`] = v;
    if (Object.keys(prefixed).length > 0) await store.importAllReport(prefixed);

    emit('synced', { at: new Date().toISOString() });
    return snapshot.size;
  } catch (err) {
    if (err.code === 'permission-denied') {
      emit('synced', { at: new Date().toISOString() });
      return 0;
    }
    console.warn('[KUETx Sync] Pull failed:', err.message);
    emit('error', { message: err.message });
    return 0;
  }
};

// Alias for manual "Sync now" button
export const pullNow = () => pullAllFromFirestore(_uid);

// ─── Push ALL on first login / upgrade ───────────────────────────────────────

export const pushAllToFirestore = async (uid) => {
  if (!uid) return;
  try {
    emit('syncing');
    const allData = store.exportAll();
    // Push in chunks to avoid flooding
    const entries = Object.entries(allData)
      .map(([k, v]) => [k.replace('kuetx_', ''), v])
      .filter(([k]) => shouldSync(k));

    for (let i = 0; i < entries.length; i += MAX_BATCH_PUSH) {
      const chunk = entries.slice(i, i + MAX_BATCH_PUSH);
      await Promise.all(chunk.map(([key, value]) => {
        const docRef = doc(db, 'users', uid, 'data', key);
        return setDoc(docRef, { value, updatedAt: serverTimestamp() }, { merge: true });
      }));
    }
    emit('synced', { at: new Date().toISOString() });
  } catch (err) {
    console.warn('[KUETx Sync] Push all failed:', err.message);
    emit('error', { message: err.message });
  }
};

// ─── Local store → Firestore (debounced, on change) ──────────────────────────

const startStoreListener = () => {
  _storeListener = (e) => {
    if (!_uid) return;
    const key = e.detail?.key;
    if (!key || !shouldSync(key)) return;

    const value = store.get(key);
    if (value === null || value === undefined) return;

    if (_pushTimers[key]) clearTimeout(_pushTimers[key]);
    emit('pending');

    _pushTimers[key] = setTimeout(async () => {
      delete _pushTimers[key];
      _isSyncing = true;
      emit('syncing');
      await pushKey(key, value);
      if (Object.keys(_pushTimers).length === 0) {
        _isSyncing = false;
        emit('synced', { at: new Date().toISOString() });
      }
    }, PUSH_DEBOUNCE_MS);
  };

  window.addEventListener('kuetx:store-updated', _storeListener);
};

// ─── Periodic background pull (no listener, just scheduled getDocs) ───────────

const startPeriodicPull = () => {
  _pullInterval = setInterval(() => {
    // Only pull when tab is visible and online — save reads
    if (document.visibilityState !== 'visible') return;
    if (!navigator.onLine) return;
    if (!_uid) return;
    pullAllFromFirestore(_uid);
  }, PULL_INTERVAL_MS);
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const startFirebaseSync = async (uid, { onSyncStatus } = {}) => {
  if (!uid) return;
  stopFirebaseSync();

  _uid = uid;

  // Pull once on start (replaces the initial onSnapshot burst)
  await pullAllFromFirestore(uid);

  // Listen for local changes and push them up
  startStoreListener();

  // Periodically re-pull from Firestore (15 min)
  startPeriodicPull();
};

export const stopFirebaseSync = () => {
  _uid       = null;
  _isSyncing = false;

  // No Firestore listeners to unsubscribe (we dropped onSnapshot entirely)

  Object.values(_pushTimers).forEach(t => clearTimeout(t));
  _pushTimers = {};

  if (_storeListener) {
    window.removeEventListener('kuetx:store-updated', _storeListener);
    _storeListener = null;
  }

  if (_pullInterval) {
    clearInterval(_pullInterval);
    _pullInterval = null;
  }
};

export const isFirebaseSyncing = () => _isSyncing;
export const getFirebaseUid    = () => _uid;
export const getLastPullCount  = () => 0; // kept for API compat