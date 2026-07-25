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

import { doc, setDoc, getDoc, getDocs, collection, collectionGroup, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { store } from '../store/store';

// ─── Config ───────────────────────────────────────────────────────────────────

const PUSH_DEBOUNCE_MS  = 4_000;   // wait 4s after last change before writing
const PULL_INTERVAL_MS  = 15 * 60 * 1000; // pull every 15 min (background)
const MAX_BATCH_PUSH    = 20;      // max keys to push in one tick

// 'profile' added here for Phase 5 migration: it now lives at its own
// dedicated path (students/{dept}/{batch}/{uid} — see pushProfile/
// pullProfile below), not in the generic users/{uid}/data/{key} bucket.
// Every other personal key (Notes, Diary, Wallet, Settings, Schedule,
// Assignments, etc.) is completely unaffected and still flows through the
// generic mechanism below exactly as before.
const EXCLUDED_KEYS = ['autoBackup', 'lastBackupTime', 'kuetx_guide_seen', 'profile'];

// Same 2-digit roll-prefix -> dept-code map as ProfileSetupModal.jsx's
// extractDeptCodeFromRoll and firestore.rules' deptCodeFromRoll — kept in
// sync manually (three copies: client validation, this sync path, and the
// rules' own authoritative check) since rules can't be imported client-side.
const ROLL_DEPT_MAP = {
  '25': 'ARCH', '23': 'BECM', '15': 'BME', '01': 'CE', '29': 'CHE',
  '07': 'CSE', '09': 'ECE', '03': 'EEE', '13': 'ESE', '11': 'IPE',
  '19': 'LE', '05': 'ME', '27': 'MSE', '31': 'MTE', '21': 'TE', '17': 'URP',
};

const deptBatchFromRoll = (roll) => {
  const r = String(roll || '').trim();
  if (!/^\d{7}$/.test(r)) return null;
  const dept = ROLL_DEPT_MAP[r.slice(2, 4)];
  if (!dept) return null;
  return { dept, batch: '2K' + r.slice(0, 2) };
};

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

  // Pull once on start (replaces the initial onSnapshot burst).
  // NOTE: this generic pull no longer returns 'profile' (excluded — see
  // EXCLUDED_KEYS), so it's pulled separately below from its own
  // students/{dept}/{batch}/{uid} path and merged into the local store the
  // same way pullAllFromFirestore does for every other key. Every caller
  // of startFirebaseSync (Profile.jsx, useFirebaseAuth.js) gets this for
  // free with no changes needed on their end.
  await pullAllFromFirestore(uid);
  await hydrateProfileFromFirestore(uid);

  // Listen for local changes and push them up
  startStoreListener();

  // Periodically re-pull from Firestore (15 min)
  startPeriodicPull();
};

// Pulls the remote profile and writes it into the local store under the
// same 'kuetx_profile' key the rest of the app already reads via
// store.get('profile') / getProfile() — mirrors what pullAllFromFirestore
// does for generic keys, just for this one dedicated-path key. Passes the
// last-known local profile (if any) as the dept/batch hint so returning
// users on the same device skip the (more expensive) collectionGroup
// fallback and go straight to the direct doc path.
const hydrateProfileFromFirestore = async (uid) => {
  try {
    const localProfile = store.get('profile');
    const knownDeptBatch = (localProfile && localProfile.dept && localProfile.batch)
      ? { dept: localProfile.dept, batch: localProfile.batch }
      : null;
    const remote = await pullProfile(uid, knownDeptBatch);
    if (remote) await store.importAllReport({ kuetx_profile: remote });
  } catch (err) {
    console.warn('[KUETx Sync] Profile hydrate failed:', err.message);
  }
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

// ─── Profile — dedicated path (Phase 5 migration) ──────────────────────────
// 'profile' is deliberately NOT part of the generic key-value loop above
// (see EXCLUDED_KEYS). It now lives at students/{dept}/{batch}/{uid},
// dept/batch derived from the profile's own studentId (roll) — this must
// match firestore.rules' students/{dept}/{batch}/{uid} create/update rule
// exactly, or every profile write will be permission-denied. Called
// explicitly by ProfileSetupModal.jsx on save/update, not by the generic
// store-change listener.

/**
 * Push the local profile object to its dedicated Firestore location.
 * Requires profile.studentId to already be a valid 7-digit roll (the
 * caller — ProfileSetupModal.jsx — validates this before calling; this
 * function trusts the caller but will throw rather than write to a
 * garbage path if studentId can't be resolved to a dept/batch).
 */
export const pushProfile = async (uid, profile) => {
  if (!uid || !profile) return;
  const loc = deptBatchFromRoll(profile.studentId);
  if (!loc) {
    console.warn('[KUETx Sync] pushProfile: cannot resolve dept/batch from studentId, not writing', profile.studentId);
    return;
  }
  try {
    const docRef = doc(db, 'students', loc.dept, loc.batch, uid);
    // uid is stored explicitly on the doc (in addition to being the doc's
    // own id) because pullProfile's collectionGroup fallback (new client,
    // no known dept/batch) can only filter by a field value, not by doc id,
    // across a collectionGroup spanning many parent paths.
    await setDoc(docRef, { ...profile, uid, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.warn('[KUETx Sync] pushProfile failed:', err.message);
    emit('error', { message: err.message });
    throw err;
  }
};

/**
 * Pull the remote profile for uid back into the local store. Since the
 * doc's path now depends on dept/batch (which come FROM the roll that's
 * IN the profile), a fresh/unknown client can't locate the doc from uid
 * alone without already knowing dept/batch — callers should pass the
 * last-known local profile (if any) to supply that, or fall back to
 * collectionGroup('students') filtered by uid if no local copy exists at
 * all (e.g. first login on a new device).
 */
export const pullProfile = async (uid, knownDeptBatch = null) => {
  if (!uid) return null;
  try {
    let dept = knownDeptBatch?.dept;
    let batch = knownDeptBatch?.batch;
    if (!dept || !batch) {
      // No known dept/batch (e.g. first login on a new device) — can't
      // build the direct doc path, so fall back to a collectionGroup query
      // filtered by the explicit 'uid' field that pushProfile now stores
      // on every profile doc (doc id alone isn't filterable across a
      // collectionGroup spanning many different parent paths).
      const snap = await getDocs(query(collectionGroup(db, 'students'), where('uid', '==', uid)));
      if (!snap.empty) {
        return snap.docs[0].data();
      }
      return null;
    }
    const docRef = doc(db, 'students', dept, batch, uid);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.warn('[KUETx Sync] pullProfile failed:', err.message);
    return null;
  }
};