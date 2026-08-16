// qbUploadRequests.js
//
// Question Bank upload pipeline: Campus Lead stages a PDF into R2 +
// creates a qbUploadRequests/{id} review doc -> that dept's Senior
// Campus Lead approves/rejects -> approve moves the file from R2
// staging/ into public/ (live, browsable via useQuestionBankData()).
// Founder uploads bypass review entirely (pre-approved at create time).
//
// Mirrors the shape of manualVerifyRequests.js / staffSync.js's CL
// application flow on purpose — same submit -> subscribe -> approve/
// reject lifecycle, same universal SCL-vacant-falls-to-Founder fallback.

import {
  collection, doc, addDoc, getDoc, updateDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { QB_DEPARTMENTS } from '../data/questionbank/questionBankData';

const COLLECTION = 'qbUploadRequests';
const WORKER_URL = import.meta.env.VITE_QB_WORKER_URL;

export const EXAM_TYPES = ['Regular', 'Backlog', 'Special_Backlog', 'Online'];

// canonicalize() elsewhere in the app uppercases dept (profile.dept ==
// 'CSE', 'CHE', etc.) but QB_DEPARTMENTS' keys are NOT uniformly
// uppercase (e.g. 'ChE', 'BECM'). This resolves an uppercased profile
// dept back to the exact QB_DEPARTMENTS casing the Worker/R2 keys need.
const UPPER_TO_QB_DEPT = Object.fromEntries(
  Object.keys(QB_DEPARTMENTS).map((code) => [code.toUpperCase(), code])
);
export function toQBDeptCode(profileDept) {
  return UPPER_TO_QB_DEPT[String(profileDept || '').toUpperCase()] || null;
}

function buildLabel(examType, examYear) {
  return `${examType}_${examYear}`;
}

/**
 * Full upload flow for a Campus Lead (or Founder, any dept):
 *   1. create the Firestore review doc (status: pending, or 'approved'
 *      pre-set for Founder — rules enforce only Founder may do that)
 *   2. stage the raw PDF bytes into R2 via the Worker's /stage endpoint
 * Both steps use the SAME requestId so the Worker can later move
 * staging/{requestId}.pdf into its final public/ location on approval.
 *
 * @param {File} file - the PDF File object from an <input type=file>
 * @param {{dept, term, courseCode, courseTitle, examType, examYear, groupId, batch}} meta
 * @param {{name, roll}} uploaderInfo - for display in the review queue
 * @param {boolean} isFounderUpload - true only for the Founder's own-dept-agnostic upload panel
 */
export async function submitQBUpload(file, meta, uploaderInfo, isFounderUpload = false, allowOverwrite = false) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  if (!file || file.type !== 'application/pdf') throw new Error('File must be a PDF');
  // Cloudflare Workers cap request bodies well below "unlimited" in
  // practice, so this stays a real ceiling rather than removed entirely
  // — 100MB comfortably covers scanned question-bank PDFs while still
  // failing fast instead of hanging on an accidental huge upload.
  if (file.size > 100 * 1024 * 1024) throw new Error('File exceeds 100MB limit');
  if (!QB_DEPARTMENTS[meta.dept]) throw new Error(`Unknown department: ${meta.dept}`);
  if (!meta.term || !meta.courseCode || !meta.examType || !meta.examYear) {
    throw new Error('Missing required fields');
  }

  const label = buildLabel(meta.examType, meta.examYear);
  const cleanCourseCode = String(meta.courseCode).replace(/\s+/g, '');

  // "already-existing file -> don't accept the input" check, done against
  // the LIVE tree before we even touch R2/Firestore — the Worker's
  // /approve endpoint re-checks this again server-side as the real
  // backstop (this client-side check is just to fail fast with a clear
  // message instead of silently sitting in the queue until an SCL
  // discovers the conflict). Skipped entirely when the caller has already
  // confirmed a replace (allowOverwrite) — in that case we WANT to proceed
  // past the dupe and let the Worker's /approve overwrite=true path run.
  if (!allowOverwrite) {
    const dupe = await checkDuplicateExists(meta.dept, meta.term, cleanCourseCode, label);
    if (dupe) {
      throw new Error(`"${label}" already exists for ${cleanCourseCode} in ${meta.term} — rename and resubmit.`);
    }
  }

  const docRef = await addDoc(collection(db, COLLECTION), {
    uploadedBy: uid,
    uploaderName: uploaderInfo?.name || '',
    uploaderRoll: uploaderInfo?.roll || '',
    dept: meta.dept,
    term: meta.term,
    batch: meta.batch || null,
    groupId: meta.groupId || null,
    courseCode: cleanCourseCode,
    courseTitle: meta.courseTitle || '',
    examType: meta.examType,
    examYear: meta.examYear,
    label,
    fileSize: file.size,
    fileName: file.name,
    status: isFounderUpload ? 'approved' : 'pending',
    requestedAt: serverTimestamp(),
    ...(isFounderUpload ? { reviewedBy: uid, reviewedAt: serverTimestamp() } : {}),
  });

  try {
    await stageFileInR2(docRef.id, file, meta);
  } catch (e) {
    // Firestore doc exists but R2 stage failed — mark it so the review
    // queue doesn't show a phantom request with no actual file behind it.
    await updateDoc(doc(db, COLLECTION, docRef.id), { status: 'stage_failed', error: String(e.message || e) });
    throw e;
  }

  // Founder uploads are pre-approved — immediately ask the Worker to
  // promote the file from staging straight to public, no human review step.
  if (isFounderUpload) {
    await promoteApprovedUpload(docRef.id, meta.dept, meta.term, cleanCourseCode, label, allowOverwrite);
  }

  return docRef.id;
}

async function stageFileInR2(requestId, file, meta) {
  if (!WORKER_URL) throw new Error('VITE_QB_WORKER_URL is not configured');
  const idToken = await auth.currentUser.getIdToken();
  const form = new FormData();
  form.append('file', file);
  form.append('dept', meta.dept);
  form.append('term', meta.term);
  form.append('courseCode', meta.courseCode);
  form.append('groupId', meta.groupId || '');
  form.append('requestId', requestId);

  const res = await fetch(`${WORKER_URL}/stage`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to stage file');
  return data;
}

async function promoteApprovedUpload(requestId, dept, term, courseCode, label, overwrite = false) {
  if (!WORKER_URL) throw new Error('VITE_QB_WORKER_URL is not configured');
  const idToken = await auth.currentUser.getIdToken();
  const res = await fetch(`${WORKER_URL}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, dept, term, courseCode, label, overwrite }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Failed to publish file');
    err.code = data.code;
    err.existing = data.existing;
    throw err;
  }
  return data;
}

/** Check the LIVE R2 tree for a name collision before submitting. */
async function checkDuplicateExists(dept, term, courseCode, label) {
  if (!WORKER_URL) return false;
  try {
    const res = await fetch(WORKER_URL, { cache: 'no-store' });
    const data = await res.json();
    const papers = data?.tree?.[dept]?.[term]?.[courseCode] || [];
    return papers.some((p) => p.label === label);
  } catch {
    return false; // offline/worker down — don't block submission on this soft check
  }
}
// Exposed for BatchQBUpload's single-file dupe check (e.g. re-checking one
// row after an edit) — keeps the single-file submitQBUpload path above
// using its own private call, this is just the same logic made reusable.
export { checkDuplicateExists };

/**
 * Fetch the whole live tree ONCE. Used by batch upload to pre-check
 * duplicate status for potentially hundreds of files without hitting the
 * Worker once per file — `findExisting()` below then matches locally
 * against this single snapshot.
 */
export async function fetchLiveTree() {
  if (!WORKER_URL) return {};
  try {
    const res = await fetch(WORKER_URL, { cache: 'no-store' });
    const data = await res.json();
    return data?.tree || {};
  } catch {
    return {}; // offline/worker down — batch scan just shows everything as "ready"
  }
}

/**
 * Look up whether {dept/term/courseCode/label} already exists in a tree
 * previously returned by fetchLiveTree(). Returns the existing paper's
 * {label, key, size, uploaded} info (for "old vs new" display) or null.
 */
export function findExisting(tree, dept, term, courseCode, label) {
  const papers = tree?.[dept]?.[term]?.[courseCode] || [];
  return papers.find((p) => p.label === label) || null;
}

/** Live queue for a Senior Campus Lead's own dept (StaffDashboard review tab). */
export function subscribeQBUploadRequestsForDept(dept, callback, onError) {
  return onSnapshot(
    query(
      collection(db, COLLECTION),
      where('dept', '==', dept),
      where('status', '==', 'pending'),
      orderBy('requestedAt')
    ),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[qbUploadRequests] dept listener failed:', err.code, err.message);
      callback([]);
      onError?.(err);
    }
  );
}

/** Founder/Head of Ops view — every pending request system-wide (fallback net). */
export function subscribeAllQBUploadRequests(callback, onError) {
  return onSnapshot(
    query(collection(db, COLLECTION), where('status', '==', 'pending'), orderBy('requestedAt')),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[qbUploadRequests] all-requests listener failed:', err.code, err.message);
      callback([]);
      onError?.(err);
    }
  );
}

/** SCL (or Head of Ops/Founder override) approves — promotes R2 file + marks resolved. */
export async function approveQBUpload(requestId) {
  const snap = await getDoc(doc(db, COLLECTION, requestId));
  if (!snap.exists()) return;
  const reqData = snap.data();
  const reviewerUid = auth.currentUser?.uid;

  await promoteApprovedUpload(requestId, reqData.dept, reqData.term, reqData.courseCode, reqData.label);

  await updateDoc(doc(db, COLLECTION, requestId), {
    status: 'approved', reviewedBy: reviewerUid, reviewedAt: serverTimestamp(),
  });
}

/**
 * Fetch a staged (not-yet-approved) upload's PDF bytes so a reviewer
 * (SCL/Founder/Head of Ops) can preview it before approving/rejecting —
 * reuses the same PDFViewer already used for live, approved papers.
 * Returns a blob: URL the caller must revokeObjectURL() when done.
 */
export async function fetchStagedPreviewUrl(requestId, dept) {
  if (!WORKER_URL) throw new Error('VITE_QB_WORKER_URL is not configured');
  const idToken = await auth.currentUser.getIdToken();
  const url = `${WORKER_URL}/stage-preview?requestId=${encodeURIComponent(requestId)}&dept=${encodeURIComponent(dept)}&token=${encodeURIComponent(idToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not load PDF for preview');
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function rejectQBUpload(requestId, reason = '') {
  const idToken = await auth.currentUser.getIdToken();
  if (WORKER_URL) {
    await fetch(`${WORKER_URL}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId }),
    }).catch(() => {}); // best-effort staging cleanup; Firestore status is the real record

  }
  await updateDoc(doc(db, COLLECTION, requestId), {
    status: 'rejected', reviewedBy: auth.currentUser?.uid, reviewedAt: serverTimestamp(), rejectReason: reason,
  });
}