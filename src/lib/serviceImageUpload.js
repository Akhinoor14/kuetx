// serviceImageUpload.js
//
// MULTI_CATEGORY_SERVICES_PLAN.md Phase 3. Talks to the new Cloudflare
// Worker in service-images-worker/ (NOT the existing question-bank
// worker — that one is PDF-specific, see that folder's README/comments
// for why a separate worker+bucket was created instead of reusing it).
//
// Two env vars, set after the worker is deployed (see
// service-images-worker/README_SETUP.md):
//   VITE_SERVICE_IMAGES_WORKER_URL      — the deployed worker's own URL
//   VITE_SERVICE_IMAGES_PUBLIC_BASE_URL — the R2 bucket's public base URL
//
// The worker's /upload route returns only a bare R2 key (same pattern as
// the question-bank worker's handleList()); this file is what joins that
// key with the public bucket base URL to produce a usable <img src>.

import { auth } from './firebase';

const WORKER_URL = import.meta.env.VITE_SERVICE_IMAGES_WORKER_URL || '';
const PUBLIC_BASE_URL = import.meta.env.VITE_SERVICE_IMAGES_PUBLIC_BASE_URL || '';

export const MAX_IMAGE_BYTES = 1 * 1024 * 1024; // 1MB, per the plan

/** Joins a bare R2 key (as returned by the worker) into a full public URL. */
export function serviceImageUrl(key) {
  if (!key) return null;
  if (/^https?:\/\//i.test(key)) return key; // already a full URL — tolerate old data
  return `${PUBLIC_BASE_URL.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;
}

async function authHeader() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  const idToken = await user.getIdToken();
  return { Authorization: `Bearer ${idToken}` };
}

/**
 * Uploads one image file for a service (cover image, or one of an
 * offering's up-to-3 images — the caller decides which by what it does
 * with the returned key, this function doesn't distinguish). Validates
 * size client-side first (fast-fail before spending an upload), the
 * worker re-validates server-side too (never trust client-side-only
 * checks for something enforcing a real limit).
 *
 * `kind` ('service' default, or 'errand') tells the worker which
 * ownership check and key prefix to use — see the worker's own
 * ownsErrandRequest comment for why errand requests need a distinct
 * check (no services/{id} doc exists for them). `serviceId` doubles as
 * the errandRequests/{requestId} id when kind === 'errand' — same
 * param, different meaning, matching the worker's own field reuse.
 *
 * Returns the full public URL (via serviceImageUrl), not the bare key —
 * callers store this URL directly in coverImageUrl / offering.images[]
 * (or itemImageUrl for errand requests).
 */
export async function uploadServiceImage(serviceId, file, kind = 'service') {
  if (!WORKER_URL) throw new Error('Image upload isn\'t configured yet (VITE_SERVICE_IMAGES_WORKER_URL missing).');
  if (!file) throw new Error('No file given.');
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`ছবির সাইজ ১MB-এর বেশি হতে পারবে না (এটা ${(file.size / 1024 / 1024).toFixed(1)}MB)।`);
  }

  const form = new FormData();
  form.append('file', file);
  form.append('serviceId', serviceId);
  if (kind === 'errand') form.append('kind', 'errand');

  const headers = await authHeader();
  const res = await fetch(`${WORKER_URL.replace(/\/$/, '')}/upload`, {
    method: 'POST',
    headers,
    body: form,
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'ছবি আপলোড করতে সমস্যা হয়েছে।');
  }
  return serviceImageUrl(data.key);
}

/**
 * Deletes a previously uploaded image, given the full public URL (as
 * stored in coverImageUrl / offering.images[]) — this function strips
 * the public base URL back off to recover the bare R2 key the worker's
 * /image route expects. Best-effort: called from "replace" and "remove"
 * flows where the old image should be cleaned up, but a failed delete
 * here shouldn't block the new state from saving (an orphaned R2 object
 * is a storage-cost nuisance, not a correctness or privacy issue).
 */
export async function deleteServiceImage(url) {
  if (!WORKER_URL || !url) return;
  const key = url.startsWith(PUBLIC_BASE_URL) ? url.slice(PUBLIC_BASE_URL.length).replace(/^\//, '') : url;
  // Open Errand Request Feed migration — errand images use the same
  // worker/bucket under a separate errands/ prefix (see this file's
  // uploadServiceImage kind param and the worker's own key-shape
  // comment), so both prefixes are valid here now, not just services/.
  if (!key.startsWith('services/') && !key.startsWith('errands/')) return; // not one of ours (or already a bare non-matching value) — skip
  try {
    const headers = await authHeader();
    await fetch(`${WORKER_URL.replace(/\/$/, '')}/image`, {
      method: 'DELETE',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
  } catch (e) {
    console.error('deleteServiceImage: failed', e);
  }
}
