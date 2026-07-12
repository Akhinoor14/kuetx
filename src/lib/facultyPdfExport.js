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
  const canvas = await html2canvas(container, { scale: 2, backgroundColor: BRAND.bg });
  document.body.removeChild(container);

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
}

function headerHtml(assignment) {
  return `
    <div style="border-bottom:2px solid ${BRAND.accent}; padding-bottom:14px; margin-bottom:20px;">
      <div style="font-size:20px; font-weight:800;">${assignment.courseCode}${assignment.courseTitle ? ' — ' + assignment.courseTitle : ''}</div>
      <div style="font-size:12px; color:${BRAND.muted}; margin-top:4px;">
        ${(assignment.batch || '').toUpperCase()} ${assignment.dept || ''} · ${assignment.term || ''} · ${assignment.courseType || ''}
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
      <td style="padding:6px 10px; border-bottom:1px solid ${BRAND.border};">${f}</td>
      <td style="padding:6px 10px; border-bottom:1px solid ${BRAND.border}; text-align:center;">${t1[f] ?? '—'}</td>
      <td style="padding:6px 10px; border-bottom:1px solid ${BRAND.border}; text-align:center;">${t2[f] ?? '—'}</td>
    </tr>
  `).join('');
}

/** §9.6 individual student report — header block + student-info card +
 * component breakdown table + footer. */
export async function exportStudentMarksPdf(assignment, student, record) {
  const container = buildOffscreenContainer();
  container.innerHTML = `
    ${headerHtml(assignment)}
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

/** §9.6 full-class summary — same header, roster table (one row per
 * student, teacher1+teacher2 totals). */
export async function exportClassSummaryPdf(assignment, members, recordsByUid) {
  const container = buildOffscreenContainer();
  const rows = members.map((m) => {
    const rec = recordsByUid[m.id] || {};
    const t1total = Object.values(rec.teacher1Marks || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    const t2total = Object.values(rec.teacher2Marks || {}).reduce((a, b) => a + (Number(b) || 0), 0);
    return `
      <tr>
        <td style="padding:6px 10px; border-bottom:1px solid ${BRAND.border};">${m.roll || '—'}</td>
        <td style="padding:6px 10px; border-bottom:1px solid ${BRAND.border};">${m.name || 'Unnamed'}</td>
        <td style="padding:6px 10px; border-bottom:1px solid ${BRAND.border}; text-align:center;">${t1total}</td>
        <td style="padding:6px 10px; border-bottom:1px solid ${BRAND.border}; text-align:center;">${t2total}</td>
        <td style="padding:6px 10px; border-bottom:1px solid ${BRAND.border}; text-align:center;">${t1total + t2total}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    ${headerHtml(assignment)}
    <table style="width:100%; border-collapse:collapse; font-size:11px;">
      <thead>
        <tr>
          <th style="text-align:left; padding:8px 10px; background:${BRAND.accent}22;">Roll</th>
          <th style="text-align:left; padding:8px 10px; background:${BRAND.accent}22;">Name</th>
          <th style="padding:8px 10px; background:${BRAND.accent}22;">Teacher 1</th>
          <th style="padding:8px 10px; background:${BRAND.accent}22;">Teacher 2</th>
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
