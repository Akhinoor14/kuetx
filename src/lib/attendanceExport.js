// attendanceExport.js — Phase G of ATTENDANCE_REBUILD_PLAN.md (§3g).
//
// Two exports, one shared data-shaping step:
//   exportAttendanceExcel() — full running register: one column per class
//     date held so far this term (per §4 item 3's confirmed answer — NOT
//     a single-day snapshot), roster rows down the side, matching the
//     classic physical attendance-register look. Uses `xlsx` (SheetJS).
//   exportAttendancePdf() — same register, print-friendly. Built via the
//     HTML-snapshot route (html2canvas -> jsPDF), matching this codebase's
//     OWN existing convention in facultyPdfExport.js (that file's own
//     comment cites "§13's explicit rule" for HTML-snapshot over raw
//     jsPDF-autotable) — followed here instead of the plan doc's
//     `jspdf-autotable` wording, since the actual codebase precedent is
//     the more reliable source of truth per this project's own working
//     discipline (§5: "read the actual current source... don't assume").
//
// Both always export the FULL dept+batch roster (both sections merged,
// section-tagged) for a multi-section dept, never just the section
// currently being viewed for daily marking — per §4 item 1's confirmed
// answer ("Excel export combines both sections into one file"). This is
// why both functions take a `fullMergedRoster` built with
// generateDeptRollRoster(dept, batch, null) — i.e. "both" mode, already
// supported, no changes needed there — rather than reusing AttendanceTab's
// own per-section `mergedRoster` used for daily marking.

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const BRAND = { accent: '#16a34a', bg: '#f5f5f2', text: '#1c1c1a', muted: '#6b6860', border: '#e2e0db' };

const MARK_ABBR = { present: 'P', absent: 'A', late: 'L', excused: 'E' };

// Sessions sorted oldest -> newest, matching a physical register's
// left-to-right date order (a teacher scanning a printed sheet expects the
// term to read left-to-right chronologically, not newest-first).
function sortedSessions(sessions) {
  return [...(sessions || [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// Per-student overall stats across the FULL session set, same calc
// AttendanceTab already uses (attendanceSummary/rowStatsByRoll) — 'late'
// counts as present-equivalent, denominator is sessions where the student
// actually has a mark (not sessions held in total), matching how the
// Marks tab's attendance-weighting reads the same data elsewhere.
function computeOverallStats(roll, sessions) {
  const presentCount = sessions.filter((s) => {
    const mark = s.attendance?.[roll];
    return mark === 'present' || mark === 'late';
  }).length;
  const markedCount = sessions.filter((s) => s.attendance?.[roll]).length;
  const pct = markedCount > 0 ? Math.round((presentCount / markedCount) * 100) : null;
  return { presentCount, markedCount, pct };
}

const headerLines = (assignment, facultyName, fullRosterNote) => {
  const deptLine = [assignment?.deptName || assignment?.dept, assignment?.courseCode, assignment?.courseTitle]
    .filter(Boolean).join(' · ');
  const metaLine = [assignment?.batch, fullRosterNote, assignment?.term, facultyName]
    .filter(Boolean).join('  ·  ');
  return { deptLine, metaLine };
};

/**
 * exportAttendanceExcel — full running register as an .xlsx file.
 * @param {object} assignment - the faculty assignment (dept/courseCode/courseTitle/batch/term)
 * @param {Array}  fullMergedRoster - full dept+batch roster, BOTH sections merged & section-tagged
 *                 (build via generateDeptRollRoster(dept, batch, null) merged with backlog, same
 *                 shape as AttendanceTab's mergedRoster: { id, roll, name, section, isPlaceholder, isBacklog })
 * @param {Array}  sessions - this assignment's session docs, each { date, attendance: { [roll]: mark } }
 * @param {string} facultyName - display name, goes in the header block
 */
export function exportAttendanceExcel(assignment, fullMergedRoster, sessions, facultyName) {
  const sessionsAsc = sortedSessions(sessions);
  const multiSection = fullMergedRoster.some((m) => m.section);
  const { deptLine, metaLine } = headerLines(
    assignment, facultyName, multiSection ? 'Sections A + B' : null,
  );

  // Row layout: 2 header text rows, 1 blank spacer, 1 column-header row,
  // then one row per student. Columns: Section (if multi-section) | Roll |
  // Name | one column per held date | Present | Held | %.
  const aoa = [];
  aoa.push([deptLine]);
  aoa.push([metaLine]);
  aoa.push([]);

  const colHeader = [];
  if (multiSection) colHeader.push('Section');
  colHeader.push('Roll', 'Name');
  sessionsAsc.forEach((s) => colHeader.push(s.date));
  colHeader.push('Present', 'Held', '%');
  aoa.push(colHeader);

  fullMergedRoster.forEach((m) => {
    const row = [];
    if (multiSection) row.push(m.section || '—');
    row.push(m.roll || '—', m.name || 'Unnamed');
    sessionsAsc.forEach((s) => {
      const mark = s.attendance?.[m.roll];
      row.push(mark ? (MARK_ABBR[mark] || mark) : '');
    });
    const { presentCount, markedCount, pct } = computeOverallStats(m.roll, sessionsAsc);
    row.push(presentCount, markedCount, pct === null ? '' : `${pct}%`);
    aoa.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths — narrow date columns (register-style), wider Name.
  const fixedCols = multiSection ? 3 : 2; // Section?, Roll, Name
  const widths = [];
  if (multiSection) widths.push({ wch: 8 });
  widths.push({ wch: 10 }, { wch: 22 });
  sessionsAsc.forEach(() => widths.push({ wch: 9 }));
  widths.push({ wch: 8 }, { wch: 6 }, { wch: 7 });
  ws['!cols'] = widths;

  // Merge the two header text rows across the full width so they read as
  // a title block, not squeezed into column A alone.
  const lastCol = fixedCols + sessionsAsc.length + 2; // + Present/Held/%
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  const filenameSafe = (assignment?.courseCode || 'class').replace(/[^\w-]/g, '_');
  XLSX.writeFile(wb, `${filenameSafe}_attendance_register.xlsx`);
}

/**
 * exportAttendancePdf — same full running register, print-friendly PDF.
 * Same HTML-snapshot approach as facultyPdfExport.js (html2canvas -> jsPDF)
 * for visual consistency with every other export already in this app.
 * A wide register (many date columns) is rendered at a wider offscreen
 * width than facultyPdfExport.js's 760px default, since a term's worth of
 * date columns genuinely needs more horizontal room to stay legible —
 * html2canvas + the multi-page loop in snapshotAndSave-equivalent below
 * still handle vertical pagination the same way.
 */
export async function exportAttendancePdf(assignment, fullMergedRoster, sessions, facultyName) {
  const sessionsAsc = sortedSessions(sessions);
  const multiSection = fullMergedRoster.some((m) => m.section);
  const { deptLine, metaLine } = headerLines(
    assignment, facultyName, multiSection ? 'Sections A + B' : null,
  );

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  // Wider than facultyPdfExport.js's 760px — a running register with many
  // date columns needs the extra room to stay readable per-cell; landscape
  // A4 on the PDF side (below) is sized to match.
  container.style.width = '1400px';
  container.style.background = BRAND.bg;
  container.style.color = BRAND.text;
  container.style.fontFamily = 'system-ui, sans-serif';
  container.style.padding = '28px';
  document.body.appendChild(container);

  const dateHeaders = sessionsAsc.map((s) => `
    <th style="padding:5px 3px; background:${BRAND.accent}22; font-size:8px; white-space:nowrap;">${s.date.slice(5)}</th>
  `).join('');

  const rows = fullMergedRoster.map((m) => {
    const { presentCount, markedCount, pct } = computeOverallStats(m.roll, sessionsAsc);
    const dateCells = sessionsAsc.map((s) => {
      const mark = s.attendance?.[m.roll];
      const abbr = mark ? (MARK_ABBR[mark] || mark) : '';
      const color = mark === 'absent' ? '#dc2626' : mark === 'present' ? BRAND.accent : mark ? '#d97706' : BRAND.muted;
      return `<td style="padding:4px 3px; border-bottom:1px solid ${BRAND.border}; text-align:center; font-size:9px; color:${color}; font-weight:700;">${abbr}</td>`;
    }).join('');
    return `
      <tr>
        ${multiSection ? `<td style="padding:5px 6px; border-bottom:1px solid ${BRAND.border}; font-size:9.5px;">${m.section || '—'}</td>` : ''}
        <td style="padding:5px 6px; border-bottom:1px solid ${BRAND.border}; font-size:9.5px; white-space:nowrap;">${m.roll || '—'}</td>
        <td style="padding:5px 6px; border-bottom:1px solid ${BRAND.border}; font-size:9.5px;">${m.name || 'Unnamed'}</td>
        ${dateCells}
        <td style="padding:5px 6px; border-bottom:1px solid ${BRAND.border}; text-align:center; font-size:9.5px; font-weight:700;">${presentCount}/${markedCount}</td>
        <td style="padding:5px 6px; border-bottom:1px solid ${BRAND.border}; text-align:center; font-size:9.5px; font-weight:700;">${pct === null ? '—' : pct + '%'}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div style="border-bottom:2px solid ${BRAND.accent}; padding-bottom:12px; margin-bottom:16px;">
      <div style="font-size:17px; font-weight:800;">${deptLine}</div>
      <div style="font-size:11px; color:${BRAND.muted}; margin-top:3px;">${metaLine}</div>
    </div>
    <table style="width:100%; border-collapse:collapse;">
      <thead>
        <tr>
          ${multiSection ? `<th style="text-align:left; padding:5px 6px; background:${BRAND.accent}22; font-size:9px;">Sec</th>` : ''}
          <th style="text-align:left; padding:5px 6px; background:${BRAND.accent}22; font-size:9px;">Roll</th>
          <th style="text-align:left; padding:5px 6px; background:${BRAND.accent}22; font-size:9px;">Name</th>
          ${dateHeaders}
          <th style="padding:5px 6px; background:${BRAND.accent}22; font-size:9px;">P/Held</th>
          <th style="padding:5px 6px; background:${BRAND.accent}22; font-size:9px;">%</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:18px; font-size:9px; color:${BRAND.muted}; text-align:center;">
      Generated via KUETx Faculty Portal — ${new Date().toLocaleDateString()}
    </div>
  `;

  try {
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: BRAND.bg });
    const imgData = canvas.toDataURL('image/png');
    // Landscape — a wide date-column register fits far better landscape
    // than portrait, unlike facultyPdfExport.js's marks summaries which
    // stay portrait since they're not column-per-date.
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 40;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 20;
    pdf.addImage(imgData, 'PNG', 20, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - 40);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 20;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 20, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - 40);
    }

    const filenameSafe = (assignment?.courseCode || 'class').replace(/[^\w-]/g, '_');
    pdf.save(`${filenameSafe}_attendance_register.pdf`);
  } finally {
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}
