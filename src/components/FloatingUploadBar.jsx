// FloatingUploadBar.jsx
//
// Mounted once in App.jsx (alongside <GlobalToasts />) so it's visible on
// every route while a Founder's batch Question Bank upload is running or
// paused — the upload loop itself lives in src/lib/batchUploadManager.js,
// a singleton outside React, so it keeps going even after navigating
// away from the Batch upload tab under /team. This bar is just a thin
// subscriber + a "View" shortcut back to that tab.

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Upload, Pause, Play, X } from 'lucide-react';
import {
  subscribeBatchUpload, pauseBatchUpload, startBatchUpload,
  getBatchProgress, getBatchDepts, clearBatch,
  getInterruptedBatchSummary,
} from '../lib/batchUploadManager';

export default function FloatingUploadBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [batchState, setBatchState] = useState(() => ({ rows: [], running: false, paused: false, active: false }));
  // One-time notice shown after a page reload that interrupted a batch
  // still in progress — the live queue itself can't survive a reload
  // (see batchUploadManager.js), so this is the last known progress
  // snapshot instead of silently showing nothing.
  const [interrupted, setInterrupted] = useState(() => getInterruptedBatchSummary());

  useEffect(() => subscribeBatchUpload(setBatchState), []);

  if (interrupted) {
    return (
      <div
        style={{
          position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 78, zIndex: 1200,
          width: 'min(420px, calc(100vw - 24px))', background: 'var(--card, #fff)',
          border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
          padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6,
        }}
        role="status"
        aria-live="polite"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Upload size={16} style={{ color: 'var(--accent, #2563eb)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
            Page reloaded mid-batch — {interrupted.doneCount}/{interrupted.total} published before that
            {interrupted.errorCount > 0 && `, ${interrupted.errorCount} failed`}
          </div>
          <button
            type="button"
            onClick={() => setInterrupted(null)}
            aria-label="Dismiss"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, flexShrink: 0 }}
          >
            <X size={15} />
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          The remaining {interrupted.total - interrupted.doneCount - interrupted.errorCount} file(s) were not uploaded — re-select the folder and re-run to pick up where it left off (already-published files will be skipped as duplicates).
        </div>
      </div>
    );
  }

  if (!batchState.active || batchState.rows.length === 0) return null;

  // Batch (folder) upload lives inside the Founder QB upload panel under
  // /team — don't show the bar on top of that page itself, the inline
  // BatchQBUpload table already shows the same info there.
  const onUploadPage = location.pathname === '/team';

  const progress = getBatchProgress();
  const depts = getBatchDepts();
  const finished = !batchState.running && !batchState.paused && progress.done >= progress.total && progress.total > 0;
  const paused = batchState.paused && !batchState.running;
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  const handleToggle = () => {
    if (batchState.running) pauseBatchUpload();
    else startBatchUpload();
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 78,
        zIndex: 1200,
        width: 'min(420px, calc(100vw - 24px))',
        background: 'var(--card, #fff)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
        padding: '10px 12px',
        display: onUploadPage ? 'none' : 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Upload size={16} style={{ color: 'var(--accent, #2563eb)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
          {finished
            ? `Batch upload finished — ${progress.doneCount}/${progress.total} published`
            : `${batchState.running ? 'Uploading' : 'Paused'} ${progress.done}/${progress.total} question bank files`}
        </div>
        <button
          type="button"
          onClick={clearBatch}
          aria-label="Dismiss"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, flexShrink: 0 }}
        >
          <X size={15} />
        </button>
      </div>

      {depts.length > 1 && (
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          Spans {depts.length} departments: {depts.join(', ')}
        </div>
      )}

      <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: finished ? 'var(--success, #16a34a)' : 'var(--accent, #2563eb)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        {!finished && (
          <button
            type="button"
            onClick={handleToggle}
            className="btn btn-sm"
            style={{ border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}
          >
            {batchState.running ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Resume</>}
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate('/team')}
          className="btn btn-sm btn-primary"
          style={{ padding: '4px 10px' }}
        >
          View
        </button>
      </div>
    </div>
  );
}
