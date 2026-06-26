/**
 * profilePicture.js — Local-first profile picture storage (IndexedDB)
 *
 * Works fully offline / without sign-in. Image is cropped (using the
 * drag offset from the upload modal) and resized to a square JPEG,
 * stored as a base64 data URL in IndexedDB under key `profile-photo`.
 *
 * If a Firebase user is signed in (non-anonymous), we *also* try to
 * upload to Firebase Storage as a backup/sync mechanism — but that is
 * best-effort only and never blocks or fails the local save.
 */

import { auth } from './firebase';

const DB_NAME = 'kuetx-profile';
const STORE_NAME = 'photos';
const DB_VERSION = 1;
const PHOTO_KEY = 'profile-photo';
const MAX_BYTES = 1 * 1024 * 1024; // 1 MB max upload size
const OUTPUT_PX = 400; // final square avatar size

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Load the image, crop it to a centered square using the given pixel
 * offset (in *original image* pixel coordinates, same convention as
 * the modal's drag state), then resize to OUTPUT_PX and return a JPEG
 * data URL.
 */
function cropAndResize(file, offsetX = 0, offsetY = 0, maxPx = OUTPUT_PX, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const size = Math.min(w, h);

      // Clamp offset so the crop window stays inside the image
      const maxOffX = (w - size) / 2;
      const maxOffY = (h - size) / 2;
      const cx = Math.max(-maxOffX, Math.min(maxOffX, offsetX));
      const cy = Math.max(-maxOffY, Math.min(maxOffY, offsetY));

      const srcX = (w - size) / 2 + cx;
      const srcY = (h - size) / 2 + cy;

      const canvas = document.createElement('canvas');
      canvas.width = maxPx;
      canvas.height = maxPx;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, srcX, srcY, size, size, 0, 0, maxPx, maxPx);

      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });
}

/** Best-effort Firebase Storage backup. Never throws to the caller. */
async function backupToFirebase(dataUrl) {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid || auth.currentUser?.isAnonymous) return;
    const { ref, uploadString, getDownloadURL } = await import('firebase/storage');
    const { doc, setDoc } = await import('firebase/firestore');
    const { storage, db } = await import('./firebase');
    const storageRef = ref(storage, `profile-pics/${uid}/avatar.jpg`);
    // Remove any previous avatar first so only one ever exists for this user
    try { const { deleteObject } = await import('firebase/storage'); await deleteObject(storageRef); } catch {}
    await uploadString(storageRef, dataUrl, 'data_url');
    const url = await getDownloadURL(storageRef);
    await setDoc(doc(db, 'users', uid, 'meta', 'profile'), { photoURL: url }, { merge: true });
  } catch (e) {
    // Offline, no storage rules, anonymous user, etc. — local save already succeeded.
    console.warn('Profile picture Firebase backup skipped:', e?.message || e);
  }
}

/**
 * Save a profile picture locally (always works, offline-safe) and
 * try to back it up to Firebase if signed in.
 *
 * @param {File} file
 * @param {function} onProgress  — called with 0–100
 * @param {number} offsetX        — drag offset X in original image px
 * @param {number} offsetY        — drag offset Y in original image px
 * @returns {Promise<string>}     — local data URL to display immediately
 */
export const uploadProfilePicture = async (file, onProgress, offsetX = 0, offsetY = 0) => {
  if (!file.type.startsWith('image/')) throw new Error('Only image files allowed');
  if (file.size > MAX_BYTES) throw new Error('File too large (max 1 MB)');

  onProgress?.(10);
  const dataUrl = await cropAndResize(file, offsetX, offsetY);
  onProgress?.(60);

  await idbSet(PHOTO_KEY, dataUrl);
  onProgress?.(85);

  // Fire-and-forget; don't block the UI on network/Firebase
  backupToFirebase(dataUrl).finally(() => onProgress?.(100));

  return dataUrl;
};

/** Get the saved photo (local first, falls back to Firestore if available) */
export const getProfilePhotoURL = async () => {
  try {
    const local = await idbGet(PHOTO_KEY);
    if (local) return local;
  } catch {}

  try {
    const uid = auth.currentUser?.uid;
    if (!uid || auth.currentUser?.isAnonymous) return null;
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    const snap = await getDoc(doc(db, 'users', uid, 'meta', 'profile'));
    return snap.exists() ? snap.data().photoURL || null : null;
  } catch {
    return null;
  }
};

/** Delete profile picture locally and (best-effort) from Firebase */
export const deleteProfilePicture = async () => {
  try { await idbDelete(PHOTO_KEY); } catch {}

  try {
    const uid = auth.currentUser?.uid;
    if (!uid || auth.currentUser?.isAnonymous) return;
    const { ref, deleteObject } = await import('firebase/storage');
    const { doc, setDoc } = await import('firebase/firestore');
    const { storage, db } = await import('./firebase');
    try { await deleteObject(ref(storage, `profile-pics/${uid}/avatar.jpg`)); } catch {}
    await setDoc(doc(db, 'users', uid, 'meta', 'profile'), { photoURL: null }, { merge: true });
  } catch {}
};