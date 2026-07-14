// QBUploadForm.jsx
//
// Shared upload form for pushing a question-bank PDF into the review
// pipeline (qbUploadRequests.js). Used in two places:
//   - Campus Lead tab (StaffDashboard.jsx): dept + batch are locked to
//     the CL's own group (groupId), matching firestore.rules' scope
//     check exactly (groupId == batch + '_' + dept).
//   - Founder panel (AdminDashboard.jsx): dept is a free picker across
//     all QB_DEPARTMENTS, batch is free text — Founder bypasses the
//     group-scope check server-side, uploads publish immediately
//     (no review step, see qbUploadRequests.js's isFounderUpload flag).
//
// The user only ever picks: dept (if Founder), term, course code,
// course title (display only), exam type, exam year, and the file.
// Renaming to the R2 key convention (public/{DEPT}/{TERM}/{Course}/
// {ExamType}_{Year}.pdf) happens automatically — see buildLabel() in
// qbUploadRequests.js. Nothing about that convention is typed by hand.

import { useState } from 'react';
import { QB_DEPARTMENTS } from '../data/questionbank/questionBankData';
import { submitQBUpload, toQBDeptCode, EXAM_TYPES } from '../lib/qbUploadRequests';
import BatchQBUpload from './BatchQBUpload';

const TERMS = ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];
const CURRENT_YEAR = new Date().getFullYear();
const EXAM_YEARS = Array.from({ length: 8 }, (_, i) => String(CURRENT_YEAR - i));

/**
 * @param {object} props
 * @param {object} props.profile        - current user's profile (for CL mode: profile.dept/profile.batch)
 * @param {string} props.groupId        - CL's own groupId, e.g. "2K23_CSE" (omit for Founder mode)
 * @param {boolean} props.isFounder     - true renders the free dept picker + batch text field + auto-publish notice
 * @param {function} props.onUploaded   - called with the new request id after a successful submit
 */
export default function QBUploadForm({ profile, groupId, isFounder = false, onUploaded }) {
  const lockedDeptCode = !isFounder ? toQBDeptCode(profile?.dept) : null;
  const lockedBatch = !isFounder ? (profile?.batch || '') : '';

  // Batch (folder) upload is only offered in Founder mode — CL/SCL scope
  // is locked to one dept+batch anyway so single-file is already fast
  // enough there, and the R2/Firestore scope checks stay simplest when
  // only the Founder path exercises the bulk loop.
  const [mode, setMode] = useState('single'); // 'single' | 'batch'

  const [dept, setDept] = useState(lockedDeptCode || '');
  const [batch, setBatch] = useState(lockedBatch);
  const [term, setTerm] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [examType, setExamType] = useState('Regular');
  const [examYear, setExamYear] = useState(String(CURRENT_YEAR));
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const resolvedGroupId = isFounder ? null : (groupId || null);

  const canSubmit = dept && (isFounder || batch) && term && courseCode.trim() && examType && examYear && file && !busy;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setOkMsg('');
    if (!canSubmit) return;
    setBusy(true);
    try {
      const id = await submitQBUpload(
        file,
        {
          dept,
          term,
          courseCode: courseCode.trim(),
          courseTitle: courseTitle.trim(),
          examType,
          examYear,
          batch: isFounder ? (batch.trim() || null) : batch,
          groupId: isFounder ? null : resolvedGroupId,
        },
        { name: profile?.name, roll: profile?.studentId },
        isFounder,
      );
      setOkMsg(isFounder
        ? 'Uploaded and published live — no review needed for Founder uploads.'
        : 'Submitted — your department\'s Senior Campus Lead will review it next.');
      setCourseCode(''); setCourseTitle(''); setFile(null);
      onUploaded?.(id);
    } catch (e2) {
      setErr(e2?.message || 'Upload failed — try again.');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '6px 8px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--inputBg)', fontSize: 13,
  };
  const labelStyle = { fontSize: 11.5, fontWeight: 700, marginBottom: 4, display: 'block', color: 'var(--muted)' };
  const fieldWrap = { minWidth: 140, flex: '1 1 140px' };

  return (
    <div>
      {isFounder && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`btn btn-sm ${mode === 'single' ? 'btn-primary' : ''}`}
            style={mode !== 'single' ? { border: '1px solid var(--border)' } : undefined}
          >
            Single file
          </button>
          <button
            type="button"
            onClick={() => setMode('batch')}
            className={`btn btn-sm ${mode === 'batch' ? 'btn-primary' : ''}`}
            style={mode !== 'batch' ? { border: '1px solid var(--border)' } : undefined}
          >
            Batch (folder)
          </button>
        </div>
      )}

      {mode === 'batch' && isFounder ? (
        <BatchQBUpload profile={profile} onUploaded={onUploaded} />
      ) : (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 12 }}>
      {isFounder && (
        <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
          Founder uploads publish straight to the live Question Bank — no SCL review step.
        </p>
      )}
      {err && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{err}</div>}
      {okMsg && <div style={{ fontSize: 12, color: 'var(--success, #16a34a)', marginBottom: 8 }}>{okMsg}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <div style={fieldWrap}>
          <label style={labelStyle}>Department</label>
          {isFounder ? (
            <select value={dept} onChange={(e) => setDept(e.target.value)} style={inputStyle}>
              <option value="">Select…</option>
              {Object.keys(QB_DEPARTMENTS).map((code) => (
                <option key={code} value={code}>{code} — {QB_DEPARTMENTS[code]}</option>
              ))}
            </select>
          ) : (
            <input value={lockedDeptCode || '(unrecognized dept)'} disabled style={{ ...inputStyle, opacity: 0.7 }} />
          )}
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Batch</label>
          <input
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            disabled={!isFounder}
            placeholder={isFounder ? 'e.g. 2K23 (optional)' : ''}
            style={{ ...inputStyle, opacity: isFounder ? 1 : 0.7 }}
          />
        </div>

        <div style={fieldWrap}>
          <label style={labelStyle}>Term</label>
          <select value={term} onChange={(e) => setTerm(e.target.value)} style={inputStyle}>
            <option value="">Select…</option>
            {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <div style={fieldWrap}>
          <label style={labelStyle}>Course code</label>
          <input value={courseCode} onChange={(e) => setCourseCode(e.target.value)} placeholder="e.g. CSE 2109" style={inputStyle} />
        </div>
        <div style={{ ...fieldWrap, flex: '2 1 220px' }}>
          <label style={labelStyle}>Course title (optional, for display)</label>
          <input value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} placeholder="e.g. Data Structures" style={inputStyle} />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <div style={fieldWrap}>
          <label style={labelStyle}>Exam type</label>
          <select value={examType} onChange={(e) => setExamType(e.target.value)} style={inputStyle}>
            {EXAM_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle}>Exam year</label>
          <select value={examYear} onChange={(e) => setExamYear(e.target.value)} style={inputStyle}>
            {EXAM_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ ...fieldWrap, flex: '1 1 200px' }}>
          <label style={labelStyle}>PDF file (max 25MB)</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ ...inputStyle, padding: '4px 6px' }}
          />
        </div>
      </div>

      {courseCode.trim() && term && examYear && (
        <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
          Will be saved as: <code>{(dept || '···')}/{term}/{courseCode.trim().replace(/\s+/g, '')}/{examType}_{examYear}.pdf</code>
        </p>
      )}

      <button type="submit" className="btn btn-sm btn-primary" disabled={!canSubmit}>
        {busy ? 'Uploading…' : (isFounder ? 'Upload & publish' : 'Submit for review')}
      </button>
    </form>
      )}
    </div>
  );
}
