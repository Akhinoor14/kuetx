/**
 * firebaseSync.js — KUETx Firebase Real-Time Sync
 *
 * HOW IT WORKS:
 * - store.set(key, val) → debounced push to Firestore (users/{uid}/data/{key})
 * - Firestore onSnapshot() → any change from another device instantly pulls to local store
 * - On login: full pull from Firestore → merge into local store
 * - Each store key is a separate Firestore document → only changed keys are synced
 *
 * CONFLICT RULE: last-write-wins per key (Firestore timestamp based)
 */

import { doc, setDoc, onSnapshot, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { store } from '../store/store';

// Keys we never sync to Firebase (device-local things)
const EXCLUDED_KEYS = [
  'autoBackup', 'lastBackupTime',
];

const shouldSync = (key) => {
  if (EXCLUDED_KEYS.some(ex => key.includes(ex))) return false;
  return true;
};

// ─── State ────────────────────────────────────────────────────────────────────

let _uid = null;
let _unsubscribers = [];
let _pushTimers = {};
let _storeListener = null;
let _isSyncing = false;
let _onSyncStatus = null;
let _lastPullCount = 0; // callback(status: 'synced'|'syncing'|'error'|'offline')

const PUSH_DEBOUNCE_MS = 1500;

const emitStatus = (status, detail = {}) => {
  try {
    window.dispatchEvent(new CustomEvent('kuetx:firebase-sync', { detail: { status, ...detail } }));
    if (_onSyncStatus) _onSyncStatus(status, detail);
  } catch {}
};

// ─── Push a single key to Firestore ──────────────────────────────────────────

const pushKey = async (key, value) => {
  if (!_uid || !shouldSync(key)) return;
  try {
    const docRef = doc(db, 'users', _uid, 'data', key);
    await setDoc(docRef, { value, updatedAt: serverTimestamp() });
  } catch (err) {
    console.warn('[KUETx Firebase] Push failed for key:', key, err.message);
    emitStatus('error', { message: err.message });
  }
};

// ─── Pull all data from Firestore → merge into local store ───────────────────

export const pullAllFromFirestore = async (uid) => {
  if (!uid) return;
  try {
    emitStatus('syncing');
    const colRef = collection(db, 'users', uid, 'data');
    const snapshot = await getDocs(colRef);
    const remoteData = {};
    snapshot.forEach(docSnap => {
      const key = docSnap.id;
      const { value } = docSnap.data();
      if (value !== undefined) remoteData[key] = value;
    });

    // Merge: remote overwrites local for same keys
    const prefixedData = {};
    for (const [key, value] of Object.entries(remoteData)) {
      prefixedData[`kuetx_${key}`] = value;
    }

    if (Object.keys(prefixedData).length > 0) {
      await store.importAllReport(prefixedData);
    }

    emitStatus('synced', { at: new Date().toISOString() });
    return Object.keys(remoteData).length; // how many docs were pulled
  } catch (err) {
    // New anonymous users have no data yet → permission-denied is expected, skip silently
    if (err.code === 'permission-denied') {
      emitStatus('synced', { at: new Date().toISOString() });
      return 0;
    }
    console.warn('[KUETx Firebase] Pull failed:', err.message);
    emitStatus('error', { message: err.message });
    return 0;
  }
};

// ─── Push ALL local data to Firestore (on first login / account upgrade) ─────

export const pushAllToFirestore = async (uid) => {
  if (!uid) return;
  try {
    emitStatus('syncing');
    const allData = store.exportAll();
    const promises = [];
    for (const [prefixedKey, value] of Object.entries(allData)) {
      const key = prefixedKey.replace('kuetx_', '');
      if (!shouldSync(key)) continue;
      const docRef = doc(db, 'users', uid, 'data', key);
      promises.push(setDoc(docRef, { value, updatedAt: serverTimestamp() }));
    }
    await Promise.all(promises);
    emitStatus('synced', { at: new Date().toISOString() });
  } catch (err) {
    console.warn('[KUETx Firebase] Push all failed:', err.message);
    emitStatus('error', { message: err.message });
  }
};

// ─── Real-time listener: Firestore → local store ──────────────────────────────

const startRealtimeListener = (uid) => {
  const colRef = collection(db, 'users', uid, 'data');

  const unsubscribe = onSnapshot(colRef, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'modified' || change.type === 'added') {
        const key = change.doc.id;
        const { value } = change.doc.data();

        // Don't apply if WE just pushed this (avoid echo)
        if (_pushTimers[key]) return;

        if (value !== undefined) {
          store.set(key, value);
        }
      }
    });
    emitStatus('synced', { at: new Date().toISOString(), remote: true });
  }, (err) => {
    // Anonymous users with no Firestore data yet → permission-denied is expected
    if (err.code === 'permission-denied') return;
    console.warn('[KUETx Firebase] Snapshot error:', err.message);
    emitStatus('error', { message: err.message });
  });

  _unsubscribers.push(unsubscribe);
};

// ─── Listen to local store changes → push to Firestore ───────────────────────

const startStoreListener = () => {
  _storeListener = (e) => {
    if (!_uid) return;

    // Only push the key that actually changed (passed via event detail)
    const changedKey = e.detail?.key;
    if (!changedKey || !shouldSync(changedKey)) return;

    const value = store.get(changedKey);
    if (value === null || value === undefined) return;

    // Debounce per-key to batch rapid changes
    if (_pushTimers[changedKey]) clearTimeout(_pushTimers[changedKey]);

    emitStatus('pending');

    _pushTimers[changedKey] = setTimeout(async () => {
      delete _pushTimers[changedKey];
      if (!_isSyncing) { _isSyncing = true; emitStatus('syncing'); }
      await pushKey(changedKey, value);
      if (Object.keys(_pushTimers).length === 0) {
        _isSyncing = false;
        emitStatus('synced', { at: new Date().toISOString() });
      }
    }, PUSH_DEBOUNCE_MS);
  };

  window.addEventListener('kuetx:store-updated', _storeListener);
};

// ─── Start full sync engine ───────────────────────────────────────────────────

export const startFirebaseSync = async (uid, { onSyncStatus } = {}) => {
  if (!uid) return;

  stopFirebaseSync();

  _uid = uid;
  _onSyncStatus = onSyncStatus || null;

  // 1. Pull remote data first (so we don't lose data from other devices)
  const pulledCount = await pullAllFromFirestore(uid);
  _lastPullCount = pulledCount ?? 0;

  // 2. Start real-time listener (Firestore → local)
  startRealtimeListener(uid);

  // 3. Start store listener (local → Firestore)
  startStoreListener();
};

// ─── Stop sync engine ─────────────────────────────────────────────────────────

export const stopFirebaseSync = () => {
  _uid = null;
  _onSyncStatus = null;
  _isSyncing = false;

  // Unsubscribe all Firestore listeners
  _unsubscribers.forEach(unsub => { try { unsub(); } catch {} });
  _unsubscribers = [];

  // Clear all pending push timers
  Object.values(_pushTimers).forEach(t => clearTimeout(t));
  _pushTimers = {};

  // Remove store listener
  if (_storeListener) {
    window.removeEventListener('kuetx:store-updated', _storeListener);
    _storeListener = null;
  }
};

export const isFirebaseSyncing = () => _isSyncing;
export const getFirebaseUid = () => _uid;
export const getLastPullCount = () => _lastPullCount;