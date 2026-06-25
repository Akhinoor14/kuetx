/**
 * profilePicture.js — Firebase Storage profile picture upload/delete
 *
 * Path: profile-pics/{uid}/avatar.jpg
 * After upload: URL saved to Firestore users/{uid}/meta/photoURL
 * Max size: 3MB, accepts image/* only
 */

import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { storage, db, auth } from './firebase';

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB

/** Compress + resize image to max 400×400 via canvas */
const resizeImage = (file, maxPx = 400, quality = 0.85) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = url;
  });

/**
 * Upload profile picture.
 * @param {File} file
 * @param {function} onProgress  — called with 0–100
 * @returns {Promise<string>}    — download URL
 */
export const uploadProfilePicture = async (file, onProgress) => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not logged in');
  if (!file.type.startsWith('image/')) throw new Error('Only image files allowed');
  if (file.size > MAX_BYTES) throw new Error('File too large (max 3 MB)');

  const blob = await resizeImage(file);
  const storageRef = ref(storage, `profile-pics/${uid}/avatar.jpg`);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });
    task.on('state_changed',
      snap => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          // Save URL to Firestore so it syncs across devices
          await setDoc(doc(db, 'users', uid, 'meta', 'profile'), { photoURL: url }, { merge: true });
          resolve(url);
        } catch (e) { reject(e); }
      }
    );
  });
};

/** Fetch saved photoURL from Firestore */
export const getProfilePhotoURL = async () => {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'meta', 'profile'));
    return snap.exists() ? snap.data().photoURL || null : null;
  } catch { return null; }
};

/** Delete profile picture from Storage + Firestore */
export const deleteProfilePicture = async () => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await deleteObject(ref(storage, `profile-pics/${uid}/avatar.jpg`));
  } catch {}
  try {
    await setDoc(doc(db, 'users', uid, 'meta', 'profile'), { photoURL: null }, { merge: true });
  } catch {}
};
