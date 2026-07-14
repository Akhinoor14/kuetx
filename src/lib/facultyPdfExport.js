// facultyPdfExport.js — §9.6 of the merged Faculty Module prompt
//
// HTML-snapshot route (html2canvas -> jsPDF), NOT the raw jsPDF table API
// per §13's explicit rule. Both exports build an offscreen styled HTML
// block matching this app's brand palette (--accent, --bg, --text from
// index.css), snapshot it to a canvas, then place that image into a jsPDF
// document. jsPDF itself is already a project dependency (used elsewhere
// per this codebase's own package.json); html2canvas is new, added to
// package.json alongside this file.

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const BRAND = { accent: '#16a34a', bg: '#f5f5f2', text: '#1c1c1a', muted: '#6b6860', border: '#e2e0db' };

function buildOffscreenContainer() {
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  el.style.top = '0';
  el.style.width = '760px';
  el.style.background = BRAND.bg;
  el.style.color = BRAND.text;
  el.style.fontFamily = 'system-ui, sans-serif';
  el.style.padding = '32px';
  document.body.appendChild(el);
  return el;
}

async function snapshotAndSave(container, filename) {
  try {
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: BRAND.bg });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
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

    pdf.save(filename);
  } finally {
    // Always remove the offscreen container, success or failure — a
    // failed html2canvas() call used to leave this -9999px-positioned div
    // permanently stuck in document.body, corrupting every export attempt
    // after the first failure (see comment on buildOffscreenContainer's
    // caller for the full story).
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}

function headerHtml(assignment, teacherNames) {
  const t1Label = teacherNames?.teacher1 ? `Teacher 1 — ${teacherNames.teacher1}` : 'Teacher 1';
  const t2Label = teacherNames?.teacher2 ? `Teacher 2 — ${teacherNames.teacher2}` : 'Teacher 2';
  return `
    <div style="border-bottom:2px solid ${BRAND.accent}; padding-bottom:14px; margin-bottom:20px;">
      <div style="font-size:20px; font-weight:800;">${assignment.courseCode}${assignment.courseTitle ? ' — ' + assignment.courseTitle : ''}</div>
      <div style="font-size:12px; color:${BRAND.muted}; margin-top:4px;">
        ${(assignment.batch || '').toUpperCase()} ${assignment.dept || ''} · ${assignment.term || ''} · ${assignment.courseType || ''}
      </div>
      <div style="font-size:11px; color:${BRAND.muted}; margin-top:6px;">
        ${t1Label}${teacherNames?.teacher2 || assignment?.teacherUids?.[1] ? ' &nbsp;·&nbsp; ' + t2Label : ''}
      </div>
    </div>
  `;
}

function marksTableRows(record) {
  const t1 = record.teacher1Marks || {};
  const t2 = record.teacher2Marks || {};
  // Field list is now teacher-defined (setTeacherMarkComponents), not a
  // fixed courseType set — derive the row list from whichever keys
  // actually exist across both teachers' marks objects, union'd, with
  // 'attendance' always first since it's the one component every teacher
  // always has (confirmed marks model — see facultyMarksSync.js header).
  const allKeys = Array.from(new Set([...Object.keys(t1), ...Object.keys(t2)]));
  const orderedKeys = ['attendance', ...allKeys.filter((k) => k !== 'attendance')];
  return orderedKeys.map((f) => `
    <tr>
      <td style="padding:6px 10px; border-bottom:1px solid ${BRAND.border}; text-transform:capitalize;">${f}</td>
      <td style="padding:6px 10px; border-bottom:1px solid ${BRAND.border}; text-align:center;">${t1[f] ?? '—'}</td>
      <td style="padding:6px 10px; border-bottom:1px solid ${BRAND.border}; text-align:center;">${t2[f] ?? '—'}</td>
    </tr>
  `).join('');
}

/** §9.6 individual student report — header block + student-info card +
 * component breakdown table + footer. */
export async function exportStudentMarksPdf(assignment, student, record, teacherNames) {
  const container = buildOffscreenContainer();
  container.innerHTML = `
    ${headerHtml(assignment, teacherNames)}
    <div style="background:#fff; border:1px solid ${BRAND.border}; border-radius:10px; padding:16px; margin-bottom:20px;">
      <div style="font-size:15px; font-weight:700;">${student.name || 'Unnamed'}</div>
      <div style="font-size:12px; color:${BRAND.muted};">${student.roll || '—'}</div>
    </div>
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <thead>
        <tr>
          <th style="text-align:left; padding:8px 10px; background:${BRAND.accent}22;">Component</th>
          <th style="padding:8px 10px; background:${BRAND.accent}22;">Teacher 1</th>
          <th style="padding:8px 10px; background:${BRAND.accent}22;">Teacher 2</th>
        </tr>
      </thead>
      <tbody>
        ${marksTableRows(record)}
      </tbody>
    </table>
    <div style="margin-top:24px; font-size:10px; color:${BRAND.muted}; text-align:center;">
      Generated via KUETx Faculty Portal — ${new Date().toLocaleDateString()}
    </div>
  `;
  await snapshotAndSave(container, `${assignment.courseCode}_${student.roll || student.name}_marks.pdf`);
}

/** §9.6 full-class summary — header, then a roster table broken down by
 * component (Attendance + every other teacher-defined component, e.g.
 * CT/Assignment/Quiz — NOT just a lump Teacher1/Teacher2/Total number),
 * so a class summary shows the same level of detail as the per-student
 * export, just for every student at once. Column set is the union of
 * whatever components teacher1 and teacher2 have each configured via
 * setTeacherMarkComponents, discovered from the records themselves (same
 * approach as marksTableRows) since a teacher's component config can
 * differ from course to course and isn't hardcoded here. */
export async function exportClassSummaryPdf(assignment, members, recordsByUid, teacherNames) {
  const container = buildOffscreenContainer();

  // Discover every component key actually in use across every student's
  // record, for both teacher slots — 'attendance' always first, matching
  // marksTableRows' ordering, so "Attendance" and "CT" (or whatever else a
  // teacher named their components) always show as distinct columns
  // instead of being collapsed into one opaque total.
  const allKeysSet = new Set();
  members.forEach((m) => {
    const rec = recordsByUid[m.id] || {};
    Object.keys(rec.teacher1Marks || {}).forEach((k) => allKeysSet.add(k));
    Object.keys(rec.teacher2Marks || {}).forEach((k) => allKeysSet.add(k));
  });
  const componentKeys = ['attendance', ...[...allKeysSet].filter((k) => k !== 'attendance')];

  const rows = members.map((m) => {
    const rec = recordsByUid[m.id] || {};
    const t1 = rec.teacher1Marks || {};
    const t2 = rec.teacher2Marks || {};
    const t1total = Object.values(t1).reduce((a, b) => a + (Number(b) || 0), 0);
    const t2total = Object.values(t2).reduce((a, b) => a + (Number(b) || 0), 0);
    const componentCells = componentKeys.map((k) => {
      const t1v = t1[k];
      const t2v = t2[k];
      // Both teachers' values for this component in one cell (T1 / T2),
      // since the table is already wide with one column per component —
      // adding two columns per component would make a multi-component
      // course summary unreadably wide on an A4 page.
      const display = `${t1v ?? '—'} / ${t2v ?? '—'}`;
      return `<td style="padding:6px 8px; border-bottom:1px solid ${BRAND.border}; text-align:center; font-size:10.5px;">${display}</td>`;
    }).join('');
    return `
      <tr>
        <td style="padding:6px 10px; border-bottom:1px solid ${BRAND.border};">${m.roll || '—'}</td>
        <td style="padding:6px 10px; border-bottom:1px solid ${BRAND.border};">${m.name || 'Unnamed'}</td>
        ${componentCells}
        <td style="padding:6px 10px; border-bottom:1px solid ${BRAND.border}; text-align:center; font-weight:700;">${t1total + t2total}</td>
      </tr>
    `;
  }).join('');

  const componentHeaders = componentKeys.map((k) => `
    <th style="padding:8px 6px; background:${BRAND.accent}22; font-size:10.5px; text-transform:capitalize;">${k}<br/><span style="font-weight:400; font-size:9px;">(T1 / T2)</span></th>
  `).join('');

  container.innerHTML = `
    ${headerHtml(assignment, teacherNames)}
    <table style="width:100%; border-collapse:collapse; font-size:11px;">
      <thead>
        <tr>
          <th style="text-align:left; padding:8px 10px; background:${BRAND.accent}22;">Roll</th>
          <th style="text-align:left; padding:8px 10px; background:${BRAND.accent}22;">Name</th>
          ${componentHeaders}
          <th style="padding:8px 10px; background:${BRAND.accent}22;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:24px; font-size:10px; color:${BRAND.muted}; text-align:center;">
      Generated via KUETx Faculty Portal — ${new Date().toLocaleDateString()}
    </div>
  `;
  await snapshotAndSave(container, `${assignment.courseCode}_class_summary.pdf`);
}
