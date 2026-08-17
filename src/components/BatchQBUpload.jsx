// BatchQBUpload.jsx
//
// Founder-only bulk upload: pick a local folder that already mirrors the
// R2 layout (DEPT/TERM/CourseCode/ExamType_Year.pdf) and every file inside
// gets parsed + queued automatically — no per-file manual field entry.
//
// Uses the browser's `webkitdirectory` input, which (Chrome/Edge/Firefox)
// gives every file in the selected tree with file.webkitRelativePath set
// to its path relative to the chosen folder, e.g.
//   "CSE/Y2T1/CSE2109/Regular_2023.pdf"
// That path IS the naming convention — nothing is retyped, we only parse
// what's already there. Files that don't match the expected 4-level shape
// or a known dept/term/exam-type are flagged and excluded from submit.
//
// The actual upload loop lives in src/lib/batchUploadManager.js, a
// singleton OUTSIDE React — this component only scans/parses the folder
// and then hands the parsed rows off to that manager, subscribing to its
// state for display. That's what lets a batch keep running after
// navigating away from this page (see FloatingUploadBar.jsx, mounted
// once in App.jsx, for the global progress indicator).
//
// Each valid row is still pushed through the exact same submitQBUpload()
// used by the single-file form, so Firestore review-doc creation + R2
// staging + (Founder) auto-publish behave identically — this is purely a
// bulk front-end for the existing pipeline, not a new upload path.

import { useState, useEffect } from 'react';
import { QB_DEPARTMENTS } from '../data/questionbank/questionBankData';
import { EXAM_TYPES } from '../lib/qbUploadRequests';
import {
  subscribeBatchUpload, loadBatchRows, removeBatchRow,
  startBatchUpload, pauseBatchUpload, getBatchProgress, getBatchDepts,
} from '../lib/batchUploadManager';

const TERM_RE = /^Y[1-5]T[0-2]$/;
// Accepts "Regular_2023.pdf", "Special_Backlog_2022.pdf" etc. — anything
// ending in _<4-digit-year>.pdf, exam type is whatever's left of that.
const FILE_RE = /^(.+)_(\d{4})\.pdf$/i;

// Older/manually-organized batches sometimes label the "special backlog"
// exam type just "Special" (missing the "_Backlog" suffix the canonical
// EXAM_TYPES list uses). Rather than reject those files and force a manual
// rename, normalize known aliases to the canonical EXAM_TYPES spelling
// before matching. Keys are lowercase with separators stripped so
// "Special", "special_backlog", "Special Backlog", "SpecialBacklog" etc.
// all resolve the same way. Add more aliases here if other variants show
// up in future batches.
const EXAM_TYPE_ALIASES = {
  special: 'Special_Backlog',
  specialbacklog: 'Special_Backlog',
};

function normalizeExamTypeLabel(rawType) {
  const stripped = rawType.toLowerCase().replace(/[\s_-]+/g, '');
  return EXAM_TYPE_ALIASES[stripped] || rawType;
}

function parseRelativePath(relPath) {
  // relPath looks like "CSE/Y2T1/CSE2109/Regular_2023.pdf" (4 levels), but
  // the picker's root can also be one level higher — e.g. selecting a
  // "QuestionBank" wrapper folder that itself contains the dept folders —
  // which gives "QuestionBank/CSE/Y2T1/CSE2109/Regular_2023.pdf" (5 levels).
  // Rather than force everyone to always select exactly the dept-parent
  // folder, accept an optional single leading wrapper segment: if there
  // are 5 parts and the first one isn't a known dept, drop it and parse
  // the remaining 4 normally.
  let parts = relPath.split('/');
  if (parts.length === 5 && !QB_DEPARTMENTS[parts[0]]) {
    parts = parts.slice(1);
  }
  if (parts.length !== 4) {
    return { ok: false, reason: `Expected DEPT/TERM/COURSE/FILE.pdf (got ${parts.length} levels)` };
  }
  const [dept, term, rawCourse, filename] = parts;
  const courseCode = rawCourse.replace(/\s+/g, '');

  if (!QB_DEPARTMENTS[dept]) {
    return { ok: false, reason: `Unknown dept folder "${dept}"` };
  }
  if (!TERM_RE.test(term)) {
    return { ok: false, reason: `Bad term folder "${term}" (expected e.g. Y2T1)` };
  }
  if (!courseCode) {
    return { ok: false, reason: 'Empty course folder name' };
  }
  const m = filename.match(FILE_RE);
  if (!m) {
    return { ok: false, reason: `Filename must be ExamType_Year.pdf (got "${filename}")` };
  }
  const [, rawTypeOriginal, examYear] = m;
  const rawType = normalizeExamTypeLabel(rawTypeOriginal);
  const examType = EXAM_TYPES.find((t) => t.toLowerCase() === rawType.toLowerCase());
  if (!examType) {
    return { ok: false, reason: `Unknown exam type "${rawTypeOriginal}" (expected one of ${EXAM_TYPES.join(', ')})` };
  }
  const normalized = examType !== rawTypeOriginal;

  return { ok: true, dept, term, courseCode, examType, examYear, normalized, rawTypeOriginal };
}

export default function BatchQBUpload({ profile, onUploaded }) {
  const [batchState, setBatchState] = useState(() => ({ rows: [], running: false, paused: false, active: false }));
  const [scanning, setScanning] = useState(false);

  useEffect(() => subscribeBatchUpload(setBatchState), []);

  const rows = batchState.rows;
  const running = batchState.running;
  const paused = batchState.paused && batchState.active && !batchState.running;
  const progress = getBatchProgress();
  const depts = getBatchDepts();

  const handleFolderSelect = (e) => {
    setScanning(true);
    const files = Array.from(e.target.files || []);
    const parsedRows = files
      .filter((f) => f.name.toLowerCase().endsWith('.pdf'))
      .map((file) => {
        const relPath = file.webkitRelativePath || file.name;
        const parsed = parseRelativePath(relPath);
        return {
          file,
          relPath,
          parsed: parsed.ok ? parsed : null,
          status: parsed.ok
            ? (file.size > 100 * 1024 * 1024 ? 'error' : 'ready')
            : 'error',
          error: parsed.ok
            ? (file.size > 100 * 1024 * 1024 ? 'Exceeds 100MB limit' : '')
            : parsed.reason,
        };
      });
    loadBatchRows(parsedRows, profile);
    setScanning(false);
    // allow re-selecting the same folder later without needing a page reload
    e.target.value = '';
  };

  const readyCount = rows.filter((r) => r.status === 'ready').length;
  const errorCount = rows.filter((r) => r.status === 'error').length;

  const removeRow = (idx) => removeBatchRow(idx);

  const handleUploadAll = () => {
    if (!readyCount && !running) return;
    startBatchUpload(onUploaded);
  };

  const handlePause = () => pauseBatchUpload();

  const cellStyle = { padding: '5px 8px', fontSize: 12, borderBottom: '1px solid var(--border)' };
  const statusColor = {
    ready: 'var(--muted)',
    uploading: 'var(--accent, #2563eb)',
    done: 'var(--success, #16a34a)',
    error: 'var(--danger)',
  };
  const statusLabel = {
    ready: 'Ready',
    uploading: 'Uploading…',
    done: '✓ Published',
    error: 'Error',
  };

  return (
    <div className="card" style={{ padding: 12 }}>
      <p style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>
        Select a folder shaped like <code>DEPT/TERM/CourseCode/ExamType_Year.pdf</code> (e.g.{' '}
        <code>CSE/Y2T1/CSE2109/Regular_2023.pdf</code>). Every PDF inside is parsed automatically —
        nothing is retyped. A folder that contains more than one department at the top level
        works too — every file is parsed independently. You can also select one level higher
        (a wrapper folder that just contains the dept folders, e.g. <code>QuestionBank/</code>) —
        that extra top segment is detected and skipped automatically. Publishes straight to live, same as
        single Founder uploads. Once started, the upload keeps running even if you leave this
        page — check the floating progress bar.
      </p>

      <label className="btn btn-sm" style={{ border: '1px solid var(--border)', display: 'inline-block', marginBottom: 10, cursor: 'pointer' }}>
        {rows.length ? 'Select a different folder' : 'Select folder…'}
        <input
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderSelect}
          disabled={running}
          style={{ display: 'none' }}
        />
      </label>

      {scanning && <p style={{ fontSize: 12 }}>Scanning…</p>}

      {rows.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 14, fontSize: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--success, #16a34a)' }}>{readyCount} ready</span>
            {errorCount > 0 && <span style={{ color: 'var(--danger)' }}>{errorCount} skipped (bad path/name)</span>}
            <span style={{ color: 'var(--muted)' }}>{rows.length} total files found</span>
          </div>

          {depts.length > 1 && (
            <div style={{
              fontSize: 12, marginBottom: 8, padding: '6px 10px', borderRadius: 8,
              background: 'var(--accent, #2563eb)', color: '#fff', opacity: 0.9,
            }}>
              Spans {depts.length} departments: {depts.join(', ')}
            </div>
          )}

          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...cellStyle, textAlign: 'left' }}>File</th>
                  <th style={{ ...cellStyle, textAlign: 'left' }}>Dept</th>
                  <th style={{ ...cellStyle, textAlign: 'left' }}>Term</th>
                  <th style={{ ...cellStyle, textAlign: 'left' }}>Course</th>
                  <th style={{ ...cellStyle, textAlign: 'left' }}>Type / Year</th>
                  <th style={{ ...cellStyle, textAlign: 'left' }}>Status</th>
                  <th style={cellStyle} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.relPath + i}>
                    <td style={cellStyle} title={r.relPath}>{r.relPath}</td>
                    <td style={cellStyle}>{r.parsed?.dept || '—'}</td>
                    <td style={cellStyle}>{r.parsed?.term || '—'}</td>
                    <td style={cellStyle}>{r.parsed?.courseCode || '—'}</td>
                    <td style={cellStyle}>
                      {r.parsed ? `${r.parsed.examType} ${r.parsed.examYear}` : '—'}
                      {r.parsed?.normalized && (
                        <div style={{ fontSize: 10.5, opacity: 0.75 }} title={`Original filename said "${r.parsed.rawTypeOriginal}"`}>
                          (normalized from "{r.parsed.rawTypeOriginal}")
                        </div>
                      )}
                    </td>
                    <td style={{ ...cellStyle, color: statusColor[r.status] }}>
                      {statusLabel[r.status]}
                      {r.error && r.status === 'error' && (
                        <div style={{ fontSize: 10.5, opacity: 0.85 }}>{r.error}</div>
                      )}
                    </td>
                    <td style={cellStyle}>
                      {r.status !== 'uploading' && r.status !== 'done' && (
                        <button type="button" onClick={() => removeRow(i)} className="btn btn-sm" style={{ border: '1px solid var(--border)', padding: '2px 8px' }} disabled={running}>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(running || paused) && (
            <p style={{ fontSize: 12, marginBottom: 8 }}>
              {running ? 'Uploading' : 'Paused'} {progress.doneCount + progress.errorCount}/{progress.total}
              {paused && ' — will resume from where it left off'}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            {!running && !paused && (
              <button
                type="button"
                onClick={handleUploadAll}
                disabled={!readyCount}
                className="btn btn-sm btn-primary"
              >
                {`Upload & publish ${readyCount} file${readyCount === 1 ? '' : 's'}`}
              </button>
            )}
            {running && (
              <button type="button" onClick={handlePause} className="btn btn-sm" style={{ border: '1px solid var(--border)' }}>
                Pause
              </button>
            )}
            {paused && (
              <button type="button" onClick={handleUploadAll} className="btn btn-sm btn-primary">
                Resume
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
