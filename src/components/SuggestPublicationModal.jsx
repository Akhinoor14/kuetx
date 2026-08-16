// SuggestPublicationModal.jsx
//
// "Suggest a publication" form for the public /publications browse page
// (student side only — see canEdit=false in PublicationsBrowse.jsx).
// Lets any signed-in user submit a publication on a teacher's behalf;
// this NEVER writes to facultyPublications directly — it always goes
// through pendingPublicationsSync.js's submitPublicationForReview,
// landing in the Founder/Admin Approvals queue first. Contrast with
// PublicationEditModal.jsx, which a teacher uses on their OWN profile to
// add/edit unmoderated (that's the teacher asserting authorship of their
// own record; this is a third party proposing an addition).
//
// v2 changes (previously: single free-text teacherEmail field, no
// verification, only title/authors/venue/year/link):
//   1. Live directory lookup as the student types the teacher's email
//      (same facultyDirectory collection + lookupFacultyDirectoryEntry
//      used by the faculty signup wizard — see facultyDirectoryMatch.js).
//      A typo'd or wrong email is now caught before submission instead
//      of silently producing a pending doc that can never match a real
//      teacher (or worse, drifting onto the wrong one by coincidence).
//      Name + department auto-fill from the match but stay editable,
//      matching the signup wizard's pattern.
//   2. Full field set — volume/issue/pages/category now exposed (the
//      pending-doc schema already carried these, the form just wasn't
//      collecting them).
//   3. Multiple publications per submission — a repeatable list of rows
//      instead of one modal per publication. Each row is independently
//      validated; "Submit all" fires one submitPublicationForReview
//      call per row. This does NOT change pendingPublicationsSync.js's
//      one-doc-per-call contract — it's still N individual pending
//      docs, just queued from one form session instead of N modal
//      re-opens. Bulk paste/import (e.g. a CSV or text-file upload) was
//      considered but deliberately left out of this pass: every row
//      still needs a live per-row directory-verification network call,
//      so a naive bulk-paste would either serialize into this same
//      one-row-at-a-time flow anyway or skip verification — revisit if
//      this becomes a real bottleneck for someone submitting many at
//      once.

//   4. CSV import — a "download template" link gives a starting .csv
//      with the right column headers; "Import CSV" parses it (Papaparse)
//      client-side and pours every row into the exact same row state
//      used by "+ Add another publication" above, so it goes through
//      the identical per-row directory-verification + preview + submit
//      path — no separate bulk-write code path to keep in sync. Column
//      names are matched case-insensitively; unrecognized columns are
//      ignored, missing optional columns just leave that field blank.
//      quartile (Q1-Q4) was added to the schema alongside category for
//      this — teacher self-reported co-authors stay a single
//      semicolon-joined "authors" text field, not separate structured
//      author records (each author having their own department is a
//      bigger data-model change than this pass covers; flagged for a
//      future revision if that granularity turns out to matter).

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import Modal from './Modal';
import { submitPublicationForReview } from '../lib/pendingPublicationsSync';
import { lookupFacultyDirectoryEntry } from '../lib/facultyDirectoryMatch';
import { notify } from '../lib/notify';

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
  height: 42, fontFamily: 'inherit',
};
const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, display: 'block' };
const fieldWrap = { marginBottom: 12 };

const CATEGORIES = ['Journal', 'Conference', 'Book chapter', 'Thesis', 'Other'];
const QUARTILES = ['', 'Q1', 'Q2', 'Q3', 'Q4'];

// CSV column -> row field. Matched case-insensitively after stripping
// spaces/underscores, so "Teacher Email", "teacher_email", and
// "TeacherEmail" all resolve to the same row field.
const CSV_COLUMN_MAP = {
  teacheremail: 'teacherEmail',
  email: 'teacherEmail',
  teachername: 'teacherName',
  name: 'teacherName',
  title: 'title',
  authors: 'authors',
  venue: 'venue',
  journal: 'venue',
  year: 'year',
  category: 'category',
  quartile: 'quartile',
  volume: 'volume',
  issue: 'issue',
  pages: 'pages',
  link: 'link',
  doi: 'link',
};

const CSV_TEMPLATE_HEADER = 'teacher_email,title,authors,venue,year,category,quartile,volume,issue,pages,link';
const CSV_TEMPLATE_EXAMPLE = 'jamali@ese.kuet.ac.bd,A study on maximin LHDs,Jamali A; Rahman S,Journal of Engineering Science,2023,Journal,Q1,12,3,45-60,https://doi.org/example';

function emptyRow() {
  return {
    _key: Math.random().toString(36).slice(2),
    teacherEmail: '', teacherName: '', teacherDeptCode: '',
    title: '', authors: '', venue: '', year: '', link: '',
    volume: '', issue: '', pages: '', category: 'Journal', quartile: '',
    // directory match state for this row: 'idle' | 'checking' | 'matched' | 'no-match'
    matchState: 'idle',
  };
}

function downloadCsvTemplate() {
  const instructions = '# teacher_email = the teacher this publication belongs to (their KUET email) - NOT your own email. Delete this line before importing.';
  const blob = new Blob([`${instructions}\n${CSV_TEMPLATE_HEADER}\n${CSV_TEMPLATE_EXAMPLE}\n`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kuetx_publications_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function SuggestPublicationModal({ open, onClose }) {
  const [rows, setRows] = useState([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [csvError, setCsvError] = useState('');
  const debounceTimers = useRef({});
  const fileInputRef = useRef(null);

  if (!open) return null;

  function updateRow(key, patch) {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  function runDirectoryCheck(key, email) {
    clearTimeout(debounceTimers.current[key]);
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) return;
    debounceTimers.current[key] = setTimeout(async () => {
      updateRow(key, { matchState: 'checking' });
      try {
        const entry = await lookupFacultyDirectoryEntry(normalized);
        if (entry) {
          updateRow(key, {
            matchState: 'matched',
            teacherName: entry.name || '',
            teacherDeptCode: entry.deptCode || entry.department || '',
          });
        } else {
          updateRow(key, { matchState: 'no-match' });
        }
      } catch {
        updateRow(key, { matchState: 'idle' });
      }
    }, 500);
  }

  function handleEmailChange(key, value) {
    updateRow(key, { teacherEmail: value, matchState: 'idle' });
    runDirectoryCheck(key, value);
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r._key !== key) : prev));
  }

  function handleCsvFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCsvError('');
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      comments: '#',
      complete: (result) => {
        if (!result.data?.length) {
          setCsvError('No rows found in that file.');
          return;
        }
        const parsedRows = result.data.map((csvRow) => {
          const row = emptyRow();
          for (const [rawKey, rawValue] of Object.entries(csvRow)) {
            const normalizedKey = String(rawKey || '').trim().toLowerCase().replace(/[\s_]/g, '');
            const field = CSV_COLUMN_MAP[normalizedKey];
            if (field && rawValue != null) row[field] = String(rawValue).trim();
          }
          if (!CATEGORIES.includes(row.category)) row.category = 'Journal';
          if (!QUARTILES.includes(row.quartile)) row.quartile = '';
          return row;
        }).filter((r) => r.teacherEmail || r.title);

        if (!parsedRows.length) {
          setCsvError('Could not find a teacher_email or title column — check the template.');
          return;
        }

        setRows(parsedRows);
        parsedRows.forEach((r) => runDirectoryCheck(r._key, r.teacherEmail));
        notify(`Imported ${parsedRows.length} row${parsedRows.length === 1 ? '' : 's'} from CSV — review before submitting.`, 'success');
      },
      error: () => setCsvError('Could not read that file — make sure it is a valid CSV.'),
    });
  }

  function validate(row) {
    if (!row.teacherEmail.trim()) return 'Teacher email is required.';
    if (!row.title.trim()) return 'Title is required.';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    for (const row of rows) {
      const err = validate(row);
      if (err) {
        notify(`Row for "${row.title || row.teacherEmail || 'untitled'}": ${err}`, 'error');
        return;
      }
    }

    setSaving(true);
    let successCount = 0;
    try {
      for (const row of rows) {
        await submitPublicationForReview({
          teacherEmail: row.teacherEmail,
          teacherName: row.teacherName,
          teacherDeptCode: row.teacherDeptCode,
          title: row.title,
          authors: row.authors,
          venue: row.venue,
          year: row.year,
          link: row.link,
          volume: row.volume,
          issue: row.issue,
          pages: row.pages,
          category: row.category,
          quartile: row.quartile,
        });
        successCount += 1;
      }
      notify(
        successCount === 1
          ? 'Thanks! Sent to the Founder for review — it will appear once approved.'
          : `Thanks! ${successCount} publications sent to the Founder for review.`,
        'success'
      );
      setRows([emptyRow()]);
      onClose();
    } catch (err) {
      notify(
        `${err?.message || 'Could not submit — please try again.'} (${successCount} of ${rows.length} were sent before this failed.)`,
        'error'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={saving ? () => {} : onClose} closeOnOverlayClick={!saving} contentStyle={{ maxWidth: 560, width: '94vw', maxHeight: '86vh', overflowY: 'auto' }}>
      <form onSubmit={handleSubmit} style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Suggest publications</h3>
        <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
          Know a teacher's publication that's missing? Add as many as you like below — each is reviewed by the Founder before it appears. Adding a senior's or your own department's publications works the same way, one row per publication.
        </p>

        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
          border: '1px dashed var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, flex: 1, minWidth: 160 }}>
            Have a list already? Import a CSV instead of typing each row.
          </span>
          <button
            type="button"
            onClick={downloadCsvTemplate}
            style={{
              fontSize: 11.5, fontWeight: 700, color: 'var(--text)', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
            }}
          >
            Download template
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              fontSize: 11.5, fontWeight: 700, color: '#fff', background: 'var(--accent)',
              border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
            }}
          >
            Import CSV
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleCsvFile} style={{ display: 'none' }} />
        </div>
        {csvError && (
          <div style={{ fontSize: 12, color: '#e53e3e', fontWeight: 700, marginBottom: 14, marginTop: -8 }}>{csvError}</div>
        )}

        {rows.map((row, idx) => (
          <div
            key={row._key}
            style={{
              border: '1px solid var(--border)', borderRadius: 12, padding: 14,
              marginBottom: 14, position: 'relative', background: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--muted)' }}>Publication {idx + 1}</span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(row._key)}
                  style={{ fontSize: 11, color: '#e53e3e', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                >
                  Remove
                </button>
              )}
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>The teacher's KUET email (not your own) *</label>
              <input
                type="email"
                value={row.teacherEmail}
                onChange={(e) => handleEmailChange(row._key, e.target.value)}
                placeholder="teacher@dept.kuet.ac.bd"
                style={{
                  ...inputStyle,
                  borderColor: row.matchState === 'matched' ? '#38a169'
                    : row.matchState === 'no-match' ? '#e53e3e' : 'var(--border)',
                }}
                required
              />
              <div style={{ fontSize: 11, marginTop: 4, color: 'var(--muted)' }}>
                Whose publication is this? Your own supervisor's, a senior's, anyone's — just enter their KUET email, not yours. Your account is recorded separately as the submitter.
              </div>
              <div style={{ fontSize: 11, marginTop: 4, fontWeight: 700 }}>
                {row.matchState === 'checking' && <span style={{ color: 'var(--muted)' }}>Checking directory…</span>}
                {row.matchState === 'matched' && (
                  <span style={{ color: '#38a169' }}>Matched: {row.teacherName || 'directory record found'}</span>
                )}
                {row.matchState === 'no-match' && (
                  <span style={{ color: '#e53e3e' }}>No directory match — double-check the email, or continue if you're sure it's correct.</span>
                )}
              </div>
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>Teacher's name</label>
              <input
                value={row.teacherName}
                onChange={(e) => updateRow(row._key, { teacherName: e.target.value })}
                placeholder="Dr. ..."
                style={inputStyle}
              />
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>Publication title *</label>
              <input
                value={row.title}
                onChange={(e) => updateRow(row._key, { title: e.target.value })}
                style={inputStyle}
                required
              />
            </div>

            <div style={fieldWrap}>
              <label style={labelStyle}>Authors</label>
              <input
                value={row.authors}
                onChange={(e) => updateRow(row._key, { authors: e.target.value })}
                placeholder="Comma-separated"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 2 }}>
                <label style={labelStyle}>Venue</label>
                <input
                  value={row.venue}
                  onChange={(e) => updateRow(row._key, { venue: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Year</label>
                <input
                  value={row.year}
                  onChange={(e) => updateRow(row._key, { year: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Category</label>
                <select
                  value={row.category}
                  onChange={(e) => updateRow(row._key, { category: e.target.value })}
                  style={inputStyle}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Quartile</label>
                <select
                  value={row.quartile}
                  onChange={(e) => updateRow(row._key, { quartile: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">—</option>
                  {QUARTILES.filter(Boolean).map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Volume</label>
                <input value={row.volume} onChange={(e) => updateRow(row._key, { volume: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Issue</label>
                <input value={row.issue} onChange={(e) => updateRow(row._key, { issue: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Pages</label>
                <input value={row.pages} onChange={(e) => updateRow(row._key, { pages: e.target.value })} placeholder="12-20" style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 0 }}>
              <label style={labelStyle}>Link / DOI (optional)</label>
              <input
                value={row.link}
                onChange={(e) => updateRow(row._key, { link: e.target.value })}
                placeholder="https://doi.org/..."
                style={inputStyle}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          disabled={saving}
          style={{
            width: '100%', padding: '9px 0', borderRadius: 10, border: '1px dashed var(--border)',
            background: 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: 13,
            cursor: saving ? 'default' : 'pointer', marginBottom: 16,
          }}
        >
          + Add another publication
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text)', fontWeight: 700, fontSize: 13.5, cursor: saving ? 'default' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
              background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Submitting...' : rows.length === 1 ? 'Submit for review' : `Submit all ${rows.length} for review`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
