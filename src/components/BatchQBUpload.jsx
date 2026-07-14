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
// Each valid row is still pushed through the exact same submitQBUpload()
// used by the single-file form, so Firestore review-doc creation + R2
// staging + (Founder) auto-publish behave identically — this is purely a
// bulk front-end for the existing pipeline, not a new upload path.

import { useState } from 'react';
import { QB_DEPARTMENTS } from '../data/questionbank/questionBankData';
import { submitQBUpload, EXAM_TYPES } from '../lib/qbUploadRequests';

const TERM_RE = /^Y[1-4]T[0-2]$/;
// Accepts "Regular_2023.pdf", "Special_Backlog_2022.pdf" etc. — anything
// ending in _<4-digit-year>.pdf, exam type is whatever's left of that.
const FILE_RE = /^(.+)_(\d{4})\.pdf$/i;

function parseRelativePath(relPath) {
  // relPath looks like "CSE/Y2T1/CSE2109/Regular_2023.pdf"
  const parts = relPath.split('/');
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
  const [, rawType, examYear] = m;
  const examType = EXAM_TYPES.find((t) => t.toLowerCase() === rawType.toLowerCase());
  if (!examType) {
    return { ok: false, reason: `Unknown exam type "${rawType}" (expected one of ${EXAM_TYPES.join(', ')})` };
  }

  return { ok: true, dept, term, courseCode, examType, examYear };
}

export default function BatchQBUpload({ profile, onUploaded }) {
  const [rows, setRows] = useState([]); // { file, relPath, parsed, status, error }
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

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
    setRows(parsedRows);
    setScanning(false);
    // allow re-selecting the same folder later without needing a page reload
    e.target.value = '';
  };

  const readyCount = rows.filter((r) => r.status === 'ready').length;
  const errorCount = rows.filter((r) => r.status === 'error').length;

  const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const handleUploadAll = async () => {
    const toUpload = rows.filter((r) => r.status === 'ready');
    if (!toUpload.length) return;
    setRunning(true);
    setProgress({ done: 0, total: toUpload.length });

    for (const row of toUpload) {
      const idx = rows.indexOf(row);
      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, status: 'uploading' } : r)));
      try {
        const { dept, term, courseCode, examType, examYear } = row.parsed;
        await submitQBUpload(
          row.file,
          { dept, term, courseCode, courseTitle: '', examType, examYear, batch: null, groupId: null },
          { name: profile?.name, roll: profile?.studentId },
          true, // isFounderUpload — auto-publish, same as single-file Founder mode
        );
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, status: 'done' } : r)));
        onUploaded?.();
      } catch (e) {
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, status: 'error', error: e?.message || 'Upload failed' } : r)));
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setRunning(false);
  };

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
        nothing is retyped. Publishes straight to live, same as single Founder uploads.
      </p>

      <label className="btn btn-sm" style={{ border: '1px solid var(--border)', display: 'inline-block', marginBottom: 10, cursor: 'pointer' }}>
        {rows.length ? 'Select a different folder' : 'Select folder…'}
        <input
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderSelect}
          style={{ display: 'none' }}
        />
      </label>

      {scanning && <p style={{ fontSize: 12 }}>Scanning…</p>}

      {rows.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 14, fontSize: 12, marginBottom: 8 }}>
            <span style={{ color: 'var(--success, #16a34a)' }}>{readyCount} ready</span>
            {errorCount > 0 && <span style={{ color: 'var(--danger)' }}>{errorCount} skipped (bad path/name)</span>}
            <span style={{ color: 'var(--muted)' }}>{rows.length} total files found</span>
          </div>

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
                    <td style={cellStyle}>{r.parsed ? `${r.parsed.examType} ${r.parsed.examYear}` : '—'}</td>
                    <td style={{ ...cellStyle, color: statusColor[r.status] }}>
                      {statusLabel[r.status]}
                      {r.error && r.status === 'error' && (
                        <div style={{ fontSize: 10.5, opacity: 0.85 }}>{r.error}</div>
                      )}
                    </td>
                    <td style={cellStyle}>
                      {r.status !== 'uploading' && r.status !== 'done' && (
                        <button type="button" onClick={() => removeRow(i)} className="btn btn-sm" style={{ border: '1px solid var(--border)', padding: '2px 8px' }}>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {running && (
            <p style={{ fontSize: 12, marginBottom: 8 }}>
              Uploading {progress.done}/{progress.total}…
            </p>
          )}

          <button
            type="button"
            onClick={handleUploadAll}
            disabled={!readyCount || running}
            className="btn btn-sm btn-primary"
          >
            {running ? 'Uploading…' : `Upload & publish ${readyCount} file${readyCount === 1 ? '' : 's'}`}
          </button>
        </>
      )}
    </div>
  );
}
