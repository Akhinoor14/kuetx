// SuggestPublicationModal.jsx
//
// "Suggest a publication" form for the public /publications browse page
// (student side only — see canEdit=false in PublicationsBrowse.jsx).
// Lets any signed-in user submit a publication for someone ELSE (a
// teacher, a senior, anyone) OR for themselves.
//   - Someone else's publication: goes through pendingPublicationsSync.js's
//     submitPublicationForReview, landing in the Founder/Admin Approvals
//     queue first, same as always.
//   - The submitter's OWN publication (row.isOwn toggle, or
//     is_own_publication=yes in a CSV import): writes DIRECTLY to
//     facultyPublications via addPublication() from
//     facultyPublicationsSync.js — same unmoderated, instant-write path
//     PublicationEditModal.jsx uses. teacherEmail is locked to
//     auth.currentUser.email in this case (never free-typed), and
//     firestore.rules already allows any signed-in account to write a
//     facultyPublications doc as long as teacherEmail matches their own
//     auth token email — no rules change needed for this.
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

//   4. Bulk import — "Download template" gives a styled, branded .xlsx
//      (built with xlsx-js-style; see downloadCsvTemplate) with real
//      column widths and a colored header row — a plain .csv can't
//      carry any of that styling, Excel just renders raw comma-text
//      with cramped default columns, which is why this moved off CSV.
//      "Import file" accepts that .xlsx back (parsed via SheetJS'
//      xlsx-js-style build, sheet_to_json) OR a plain .csv (still
//      parsed via Papaparse) — either way rows funnel through the same
//      applyImportedRows() into the exact row state used by "+ Add
//      another publication" above, so both import paths go through the
//      identical per-row directory-verification + preview + submit
//      flow — no separate bulk-write code path to keep in sync. Column
//      names are matched case-insensitively; unrecognized columns are
//      ignored, missing optional columns just leave that field blank.
//      quartile (Q1-Q4) was added to the schema alongside category for
//      this — teacher self-reported co-authors stay a single
//      semicolon-joined "authors" text field, not separate structured
//      author records (each author having their own department is a
//      bigger data-model change than this pass covers; flagged for a
//      future revision if that granularity turns out to matter).
//   5. is_own_publication column (self-submission, see the header note
//      above) is wired into the same CSV_COLUMN_MAP / applyImportedRows
//      path, for both .xlsx and .csv imports.

import { useState, useRef } from 'react';
import Papa from 'papaparse';
// xlsx-js-style, not the plain xlsx package (which is still used
// elsewhere, e.g. attendanceExport.js, for un-styled export) — the
// community xlsx build silently ignores cell .s style objects on
// write, which is exactly why the earlier CSV-based template had no
// coloring at all. xlsx-js-style is a maintained fork that actually
// applies fill/font/alignment when writing .xlsx.
import * as XLSX from 'xlsx-js-style';
import Modal from './Modal';
import { submitPublicationForReview } from '../lib/pendingPublicationsSync';
import { addPublication } from '../lib/facultyPublicationsSync';
import { lookupFacultyDirectoryEntry } from '../lib/facultyDirectoryMatch';
import { notify } from '../lib/notify';
import { auth } from '../lib/firebase';

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
  isownpublication: 'isOwn',
  isown: 'isOwn',
  own: 'isOwn',
};

// Values in the is_own_publication CSV column that count as "yes".
const CSV_TRUTHY = new Set(['yes', 'y', 'true', '1']);

// CSV_TEMPLATE_HEADER / CSV_TEMPLATE_EXAMPLES define the column order and
// sample data. The downloadable TEMPLATE itself is a real .xlsx (built
// below with SheetJS, already a project dependency) — not a plain .csv —
// because plain CSV has no cell styling at all: no colored header, no
// column widths, no branding. Excel just renders raw comma-text with
// default 8-char-wide columns, which is exactly the "cramped, no
// polish" problem being fixed here. Import still accepts .csv OR .xlsx
// (see handleCsvFile below) so nothing about the import path changes —
// only the template Excel actually gets to open changed format.
const CSV_TEMPLATE_HEADER_COLS = [
  'teacher_email', 'title', 'authors', 'venue', 'year', 'category',
  'quartile', 'volume', 'issue', 'pages', 'link', 'is_own_publication',
];
const CSV_TEMPLATE_EXAMPLE_ROWS = [
  ['jamali@ese.kuet.ac.bd', 'A study on maximin LHDs', 'Jamali A; Rahman S', 'Journal of Engineering Science', 2023, 'Journal', 'Q1', 12, 3, '45-60', 'https://doi.org/example', 'no'],
  ['rahman@cse.kuet.ac.bd', 'Deep learning for traffic sign recognition', 'Rahman M; Hasan T', 'IEEE Access', 2024, 'Journal', 'Q2', 10, '', '1-15', 'https://doi.org/example2', 'no'],
  ['yourown7@stud.kuet.ac.bd', 'Design of a low-cost solar tracker', 'Your Name', 'ICEEE 2024', 2024, 'Conference', '', '', '', '', '', 'yes'],
  ['kabir@math.kuet.ac.bd', 'A note on maximin distance designs', 'Kabir S', 'Undergraduate Thesis', 2022, 'Thesis', '', '', '', '', '', 'no'],
];

function emptyRow() {
  return {
    _key: Math.random().toString(36).slice(2),
    teacherEmail: '', teacherName: '', teacherDeptCode: '',
    title: '', authors: '', venue: '', year: '', link: '',
    volume: '', issue: '', pages: '', category: 'Journal', quartile: '',
    // directory match state for this row: 'idle' | 'checking' | 'matched' | 'no-match'
    matchState: 'idle',
    // true = this is the submitter's OWN publication -> auto-published
    // directly via addPublication(), no moderation queue. false (default)
    // = someone else's -> unchanged pending-review flow.
    isOwn: false,
  };
}

function downloadCsvTemplate() {
  // Row 1: short instructions (kept to one line, subtle KUETx branding
  // touch via the accent color — not a big banner, just a colored note
  // row so it reads as "from KUETx" without being loud).
  // Row 2: real header row, bold + colored fill so it's visually
  // distinct from the data beneath it.
  // Rows 3-6: the 4 example rows.
  const instructionText =
    'KUETx publications import — teacher_email = whose publication this is (their KUET email). ' +
    'is_own_publication = yes only for YOUR OWN work (auto-published instantly); no/blank for anyone else\'s (goes to Founder review). Delete this row before importing.';

  const aoa = [
    [instructionText],
    CSV_TEMPLATE_HEADER_COLS,
    ...CSV_TEMPLATE_EXAMPLE_ROWS,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Merge the instructions row across all columns so it reads as one
  // banner instead of overflowing into column B onward.
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: CSV_TEMPLATE_HEADER_COLS.length - 1 } }];

  // Column widths sized to the actual content — this is the concrete
  // fix for "columns too narrow, data overflows" from the screenshot.
  ws['!cols'] = [
    { wch: 26 }, // teacher_email
    { wch: 42 }, // title
    { wch: 26 }, // authors
    { wch: 30 }, // venue
    { wch: 7 },  // year
    { wch: 12 }, // category
    { wch: 9 },  // quartile
    { wch: 8 },  // volume
    { wch: 7 },  // issue
    { wch: 9 },  // pages
    { wch: 30 }, // link
    { wch: 16 }, // is_own_publication
  ];
  ws['!rows'] = [{ hpt: 20 }];

  // Cell styling — xlsx-js-style (not the plain xlsx package) honors
  // these .s style objects (fill/font/alignment) when writing .xlsx.
  const instructionsCellRef = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (ws[instructionsCellRef]) {
    ws[instructionsCellRef].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: '5B4FE9' } }, // KUETx accent purple
      alignment: { vertical: 'center', wrapText: true },
    };
  }
  CSV_TEMPLATE_HEADER_COLS.forEach((_, colIdx) => {
    const ref = XLSX.utils.encode_cell({ r: 1, c: colIdx });
    if (ws[ref]) {
      ws[ref].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '2D2A6E' } }, // darker KUETx accent
        alignment: { vertical: 'center' },
      };
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Publications');
  XLSX.writeFile(wb, 'kuetx_publications_template.xlsx');
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

  // Toggle "this is my own publication". When turning ON: lock the email
  // to the signed-in account's own email (no way to type a different one
  // — same reasoning as the handoff doc: Firebase auth email is already
  // the source of truth, so don't let the field lie about it) and skip
  // directory verification entirely, since we're not claiming to be
  // anyone else. When turning OFF: clear back to free-text mode.
  function toggleOwn(key, checked) {
    if (checked) {
      const myEmail = auth.currentUser?.email || '';
      updateRow(key, {
        isOwn: true,
        teacherEmail: myEmail,
        matchState: 'idle',
      });
    } else {
      updateRow(key, { isOwn: false, teacherEmail: '', teacherName: '', teacherDeptCode: '', matchState: 'idle' });
    }
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r._key !== key) : prev));
  }

  // Shared by both the .csv (Papa.parse) and .xlsx (SheetJS) import
  // paths below — takes an array of plain {columnName: value} row
  // objects (however they were parsed) and turns them into row state,
  // applying the same field-mapping, category/quartile fallback, and
  // "own" email-lock logic either way. One conversion function to keep
  // in sync, not two.
  function applyImportedRows(rawRows) {
    const myEmail = auth.currentUser?.email || '';
    const parsedRows = rawRows.map((csvRow) => {
      const row = emptyRow();
      for (const [rawKey, rawValue] of Object.entries(csvRow)) {
        const normalizedKey = String(rawKey || '').trim().toLowerCase().replace(/[\s_]/g, '');
        const field = CSV_COLUMN_MAP[normalizedKey];
        if (!field || rawValue == null || rawValue === '') continue;
        if (field === 'isOwn') {
          row.isOwn = CSV_TRUTHY.has(String(rawValue).trim().toLowerCase());
        } else {
          row[field] = String(rawValue).trim();
        }
      }
      if (!CATEGORIES.includes(row.category)) row.category = 'Journal';
      if (!QUARTILES.includes(row.quartile)) row.quartile = '';
      // Same lock as the manual toggle: an "own" row always uses the
      // signed-in account's real email, never whatever the file said.
      if (row.isOwn) row.teacherEmail = myEmail;
      return row;
    }).filter((r) => r.teacherEmail || r.title);

    if (!parsedRows.length) {
      setCsvError('Could not find a teacher_email or title column — check the template.');
      return;
    }

    setRows(parsedRows);
    parsedRows.forEach((r) => { if (!r.isOwn) runDirectoryCheck(r._key, r.teacherEmail); });
    notify(`Imported ${parsedRows.length} row${parsedRows.length === 1 ? '' : 's'} — review before submitting.`, 'success');
  }

  function handleCsvFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCsvError('');

    const isExcel = /\.xlsx?$/i.test(file.name);

    if (isExcel) {
      // The downloadable template is now itself an .xlsx (see
      // downloadCsvTemplate above), so this is the common path — read
      // it as binary, take the first sheet, convert to the same
      // {header: value} row-object shape Papa.parse would give a CSV.
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const wb = XLSX.read(evt.target.result, { type: 'array' });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          // range: 1 skips row 0 (the merged instructions banner) and
          // reads row 1 onward as header + data, same as sheet_to_json's
          // default header-row behavior would if the banner weren't
          // there.
          const rawRows = XLSX.utils.sheet_to_json(firstSheet, { range: 1, defval: '' });
          if (!rawRows.length) {
            setCsvError('No rows found in that file.');
            return;
          }
          applyImportedRows(rawRows);
        } catch {
          setCsvError('Could not read that file — make sure it is a valid Excel (.xlsx) file.');
        }
      };
      reader.onerror = () => setCsvError('Could not read that file.');
      reader.readAsArrayBuffer(file);
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      comments: '#',
      complete: (result) => {
        if (!result.data?.length) {
          setCsvError('No rows found in that file.');
          return;
        }
        applyImportedRows(result.data);
      },
      error: () => setCsvError('Could not read that file — make sure it is a valid CSV.'),
    });
  }

  function validate(row) {
    if (!row.teacherEmail.trim()) return row.isOwn ? 'You must be signed in.' : 'Teacher email is required.';
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
    let publishedCount = 0;
    let queuedCount = 0;
    try {
      for (const row of rows) {
        if (row.isOwn) {
          // Own publication -> instant, unmoderated write straight into
          // facultyPublications via the same direct path
          // PublicationEditModal.jsx uses for a teacher's own entries.
          // No queue, no Founder approval needed.
          await addPublication(row.teacherEmail, {
            title: row.title,
            authors: row.authors,
            venue: row.venue,
            year: row.year,
            link: row.link,
            volume: row.volume,
            issue: row.issue,
            pages: row.pages,
            category: row.category,
            // Marks this doc for the Founder-facing "Self-published
            // (recent)" audit feed (see subscribeToSelfSubmittedPublications
            // in facultyPublicationsSync.js). Instant-publish stays instant;
            // this just makes it auditable after the fact.
            selfSubmitted: true,
          });
          publishedCount += 1;
        } else {
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
          queuedCount += 1;
        }
      }

      const parts = [];
      if (publishedCount) parts.push(`${publishedCount} publication${publishedCount === 1 ? '' : 's'} published immediately`);
      if (queuedCount) parts.push(`${queuedCount} sent to the Founder for review`);
      notify(`Thanks! ${parts.join(', ')}.`, 'success');

      setRows([emptyRow()]);
      onClose();
    } catch (err) {
      const doneCount = publishedCount + queuedCount;
      notify(
        `${err?.message || 'Could not submit — please try again.'} (${doneCount} of ${rows.length} were sent before this failed.)`,
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
          Know a teacher's publication that's missing — or have your own thesis or paper to add? Add as many as you like below. Someone else's publication is reviewed by the Founder before it appears; mark a row as your own to publish it instantly.
        </p>

        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
          border: '1px dashed var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, flex: 1, minWidth: 160 }}>
            Have a list already? Import an Excel or CSV file instead of typing each row.
          </span>
          <button
            type="button"
            onClick={downloadCsvTemplate}
            style={{
              fontSize: 11.5, fontWeight: 700, color: 'var(--text)', background: 'transparent',
              border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
            }}
          >
            Download template (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              fontSize: 11.5, fontWeight: 700, color: '#fff', background: 'var(--accent)',
              border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
            }}
          >
            Import file
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={handleCsvFile} style={{ display: 'none' }} />
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

            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                fontSize: 12.5, fontWeight: 700, color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', marginBottom: 12,
                background: row.isOwn ? 'rgba(56,161,105,0.08)' : 'transparent',
              }}
            >
              <input
                type="checkbox"
                checked={row.isOwn}
                onChange={(e) => toggleOwn(row._key, e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              এটা কি আপনার নিজের publication? (Is this your own publication?)
            </label>

            <div style={fieldWrap}>
              <label style={labelStyle}>
                {row.isOwn ? 'Your KUET email *' : "Their KUET email (not your own) *"}
              </label>
              <input
                type="email"
                value={row.teacherEmail}
                onChange={(e) => handleEmailChange(row._key, e.target.value)}
                placeholder="teacher@dept.kuet.ac.bd"
                disabled={row.isOwn}
                style={{
                  ...inputStyle,
                  opacity: row.isOwn ? 0.75 : 1,
                  borderColor: row.matchState === 'matched' ? '#38a169'
                    : row.matchState === 'no-match' ? '#e53e3e' : 'var(--border)',
                }}
                required
              />
              {row.isOwn ? (
                <div style={{ fontSize: 11, marginTop: 4, color: '#38a169', fontWeight: 700 }}>
                  This is your own publication — it publishes immediately, no review needed.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 11, marginTop: 4, color: 'var(--muted)' }}>
                    Whose publication is this? Your supervisor's, a senior's, anyone's — enter their KUET email. It goes to the Founder for review before it appears.
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
                </>
              )}
            </div>

            {!row.isOwn && (
              <div style={fieldWrap}>
                <label style={labelStyle}>Teacher's name</label>
                <input
                  value={row.teacherName}
                  onChange={(e) => updateRow(row._key, { teacherName: e.target.value })}
                  placeholder="Dr. ..."
                  style={inputStyle}
                />
              </div>
            )}

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
            {saving
              ? 'Submitting...'
              : rows.length === 1
                ? (rows[0].isOwn ? 'Publish' : 'Submit for review')
                : `Submit all ${rows.length}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
