// batchUploadManager.js
//
// Singleton batch-upload queue living OUTSIDE React so a Founder's bulk
// Question Bank upload survives navigating away from the Batch upload
// page. BatchQBUpload.jsx (and FloatingUploadBar.jsx) both just
// subscribe to this module's state — neither of them owns the loop.
//
// submitQBUpload() has no abort signal, so "pause" here means "finish
// whatever file is currently in flight, then stop before starting the
// next one" — never a mid-request abort. "Resume" continues the same
// queue array from wherever it left off.
//
// Only one batch can run at a time (Founder-only feature, single person
// driving it) — starting a new batch while one is active/paused replaces
// the queue entirely.

import { submitQBUpload } from './qbUploadRequests';

// rows: [{ file, relPath, parsed, status: 'ready'|'uploading'|'done'|'error'|'paused', error }]
let state = {
  rows: [],
  running: false,   // actively uploading right now (in the middle of the loop)
  paused: false,     // pause requested — loop will stop after current file finishes
  active: false,     // there IS a batch loaded (running, paused, or done sitting idle)
  profile: null,
};

const listeners = new Set();

// ---------------------------------------------------------------------
// Reload-survival: `state.rows[].file` is a raw File object and can't be
// JSON-serialized, so the live queue itself can't be restored after a
// page reload — an in-flight fetch also dies with the reload regardless.
// What we CAN and DO persist is a lightweight progress summary (counts +
// which rows finished/failed, by relPath, not the File blobs). On boot,
// if a summary exists and looks like a batch was interrupted mid-run
// (running/paused with an incomplete count), we surface it once via
// getInterruptedBatchSummary() so the UI can show "37/50 published
// before the page reloaded" instead of silently showing nothing, which
// is what caused the confusion this was written to fix.
// ---------------------------------------------------------------------
const SUMMARY_KEY = 'kuetx_qb_batch_summary_v1';

function persistSummary() {
  if (!state.active) {
    sessionStorage.removeItem(SUMMARY_KEY);
    return;
  }
  try {
    const summary = {
      total: state.rows.length,
      doneCount: state.rows.filter((r) => r.status === 'done').length,
      errorCount: state.rows.filter((r) => r.status === 'error').length,
      running: state.running,
      paused: state.paused,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(SUMMARY_KEY, JSON.stringify(summary));
  } catch {
    // sessionStorage unavailable (private mode, quota, etc.) — best-effort only
  }
}

/**
 * Called once at load time by FloatingUploadBar/BatchQBUpload to check
 * whether a previous batch in this tab was interrupted (page reloaded
 * while `running` or `paused` was true, so it never reached a clean
 * finish). Returns null if nothing relevant was saved, or if the saved
 * summary already reached completion cleanly (nothing to report).
 * Clears the saved summary after reading — this is a one-time notice.
 */
export function getInterruptedBatchSummary() {
  try {
    const raw = sessionStorage.getItem(SUMMARY_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(SUMMARY_KEY);
    const summary = JSON.parse(raw);
    // Only interesting if the batch was still going (running/paused) —
    // a summary saved after a clean finish isn't an "interruption".
    if (!summary.running && !summary.paused) return null;
    return summary;
  } catch {
    return null;
  }
}

function emit() {
  const snapshot = state;
  persistSummary();
  listeners.forEach((cb) => cb(snapshot));
}

export function subscribeBatchUpload(callback) {
  listeners.add(callback);
  callback(state);
  return () => listeners.delete(callback);
}

export function getBatchUploadState() {
  return state;
}

/** Load a fresh set of parsed rows (replaces any previous batch). */
export function loadBatchRows(rows, profile) {
  state = { rows, running: false, paused: false, active: rows.length > 0, profile };
  emit();
}

export function updateBatchRow(idx, patch) {
  state = { ...state, rows: state.rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)) };
  emit();
}

export function removeBatchRow(idx) {
  state = { ...state, rows: state.rows.filter((_, i) => i !== idx) };
  emit();
}

export function clearBatch() {
  state = { rows: [], running: false, paused: false, active: false, profile: null };
  emit();
}

/** Departments represented among the currently-ready rows. */
export function getBatchDepts() {
  const depts = new Set(state.rows.filter((r) => r.status === 'ready' || r.status === 'uploading').map((r) => r.parsed?.dept).filter(Boolean));
  return [...depts];
}

export function pauseBatchUpload() {
  if (!state.running) return;
  state = { ...state, paused: true };
  emit();
}

/** Starts (or resumes) the upload loop. Safe to call repeatedly — no-ops if already running. */
export async function startBatchUpload(onUploaded) {
  if (state.running) return;
  state = { ...state, running: true, paused: false, active: true };
  emit();

  const profile = state.profile;

  // Loop by re-reading state.rows each iteration so edits (remove row)
  // made mid-run are respected, and so this survives whichever
  // component is (or isn't) mounted.
  while (true) {
    if (state.paused) break;
    const idx = state.rows.findIndex((r) => r.status === 'ready');
    if (idx === -1) break;

    const row = state.rows[idx];
    updateBatchRow(idx, { status: 'uploading' });

    try {
      const { dept, term, courseCode, examType, examYear } = row.parsed;
      await submitQBUpload(
        row.file,
        { dept, term, courseCode, courseTitle: '', examType, examYear, batch: null, groupId: null },
        { name: profile?.name, roll: profile?.studentId },
        true, // isFounderUpload — auto-publish, same as single-file Founder mode
      );
      updateBatchRow(idx, { status: 'done' });
      onUploaded?.();
    } catch (e) {
      updateBatchRow(idx, { status: 'error', error: e?.message || 'Upload failed' });
    }

    // A pause requested while this file was in flight takes effect now,
    // BEFORE the next file starts — matches the "finish current file,
    // then stop" contract.
    if (state.paused) break;
  }

  state = { ...state, running: false };
  emit();
}

export function getBatchProgress() {
  const total = state.rows.length;
  const done = state.rows.filter((r) => r.status === 'done' || r.status === 'error').length;
  const readyCount = state.rows.filter((r) => r.status === 'ready').length;
  const errorCount = state.rows.filter((r) => r.status === 'error').length;
  const doneCount = state.rows.filter((r) => r.status === 'done').length;
  return { total, done, readyCount, errorCount, doneCount };
}
