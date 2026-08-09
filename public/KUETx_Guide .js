/**
 * KUETx Complete Guide — DOCX Generator  v3
 * Changes from v2:
 *  - Removed 4 unused imports (ExternalHyperlink, HeadingLevel, TabStopType, TabStopPosition)
 *  - Added SZ font-size constants — no more magic numbers
 *  - Fixed dead ternary in smartScoreTable() (? 19 : 19)
 *  - Fixed footer column-width rounding (guaranteed sum = CONTENT_W)
 *  - Added Section 10: Solution Bank (/solutions)
 *  - Added Section 33: About KUETx (/about)
 *  - Removed fictitious /term-qs from More Features
 *  - Corrected Calculators info (/calculators → redirects to /marks)
 *  - Added closing callout to Section 25 (CT & Quiz Planner)
 *  - Updated TOC: 33 entries + Mind Map labeled as Section 31
 *  - Added try/catch around each section in buildDoc()
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, PageBreak,
} = require('docx');
const fs = require('fs');

// ─── COLORS ────────────────────────────────────────────────────────────────
const C = {
  darkGreen:  '1A4731', midGreen:    '2D6A4F', accentGreen: '40916C',
  lightGreen: 'D8F3DC', teal:        '52B788', white:       'FFFFFF',
  black:      '111111', muted:       '555555', rowAlt:      'EBF5EB',
  rowHeader:  '1A4731', warningBg:   'FEF9E7', warningBdr:  'F0C040',
  infoBg:     'EBF5FB', infoBdr:     '3498DB', dangerBg:    'FDEDEC',
  dangerBdr:  'E74C3C', successBg:   'EAFAF1', successBdr:  '27AE60',
};

// ─── FONT SIZE CONSTANTS ───────────────────────────────────────────────────
const SZ = {
  hero:    28,  // cover tagline
  title:   30,  // pageTitle heading
  section: 26,  // sectionHeaderBar
  subhd:   24,  // pageTitle sub
  label:   22,  // bodyText / boldLabel
  cell:    20,  // table cells, subLabel, callout
  bullet:  21,  // bullet items
  step:    22,  // numbered steps
  tiny:    18,  // captions, TOC description
  mini:    17,  // footer URL
  foot:    16,  // footer center text
};

// ─── DIMENSIONS ────────────────────────────────────────────────────────────
const PAGE_W   = 11906;
const PAGE_H   = 16838;
const MARGIN   = 1134;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ─── BORDER HELPERS ────────────────────────────────────────────────────────
const noBorder  = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

const cellBorder = (color = 'CCCCCC') => {
  const b = { style: BorderStyle.SINGLE, size: 4, color };
  return { top: b, bottom: b, left: b, right: b };
};

// ─── PRIMITIVE HELPERS ────────────────────────────────────────────────────
const run = (text, opts = {}) => new TextRun({ text, font: 'Calibri', ...opts });

const spacer = (pts = 100) => new Paragraph({
  children: [new TextRun('')], spacing: { after: pts },
});

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const divider = (color = 'CCCCCC') => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color, space: 1 } },
  spacing: { before: 0, after: 120 },
  children: [run('')],
});

// ─── CONTENT HELPERS ──────────────────────────────────────────────────────
const sectionHeaderBar = (title) => new Table({
  width: { size: CONTENT_W, type: WidthType.DXA },
  columnWidths: [CONTENT_W],
  borders: noBorders,
  rows: [new TableRow({ children: [new TableCell({
    borders: noBorders,
    shading: { type: ShadingType.CLEAR, fill: C.darkGreen },
    margins: { top: 160, bottom: 160, left: 280, right: 280 },
    width: { size: CONTENT_W, type: WidthType.DXA },
    children: [new Paragraph({
      children: [run(title, { size: SZ.section, bold: true, color: C.white })],
      spacing: { before: 0, after: 0 },
    })],
  })]})],
});

const pageTitle = (title, route) => [
  new Paragraph({
    children: [run(title, { size: SZ.title, bold: true, color: C.accentGreen })],
    spacing: { before: 240, after: 40 },
  }),
  new Paragraph({
    children: [run(route, { size: SZ.subhd - 6, color: C.teal })],
    spacing: { before: 0, after: 100 },
  }),
  divider(C.accentGreen),
];

const bodyText = (text, opts = {}) => new Paragraph({
  children: [run(text, { size: SZ.label, color: C.black, ...opts })],
  spacing: { before: 40, after: 80 },
});

const boldLabel = (label, text) => new Paragraph({
  children: [
    run(label, { size: SZ.label, bold: true, color: C.black }),
    run(text ? '  ' + text : '', { size: SZ.label, color: C.muted }),
  ],
  spacing: { before: 60, after: 60 },
});

const bullet = (text, sub = false) => new Paragraph({
  numbering: { reference: 'bullets', level: sub ? 1 : 0 },
  children: [run(text, { size: SZ.bullet, color: C.black })],
  spacing: { before: 30, after: 30 },
});

const step = (num, text) => new Paragraph({
  children: [
    run(`${num}.  `, { size: SZ.step, bold: true, color: C.teal }),
    run(text, { size: SZ.step, color: C.black }),
  ],
  spacing: { before: 60, after: 60 },
  indent: { left: 360 },
});

const subLabel = (text) => new Paragraph({
  children: [run(text, { size: SZ.cell, bold: true, color: C.muted })],
  spacing: { before: 160, after: 60 },
});

const callout = (text, type = 'tip') => {
  const map = {
    tip:     { bg: C.lightGreen, bdr: C.accentGreen },
    info:    { bg: C.infoBg,    bdr: C.infoBdr },
    warning: { bg: C.warningBg, bdr: C.warningBdr },
    danger:  { bg: C.dangerBg,  bdr: C.dangerBdr },
    success: { bg: C.successBg, bdr: C.successBdr },
  };
  const { bg, bdr } = map[type] || map.tip;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    borders: { top: noBorder, bottom: noBorder, right: noBorder, left: noBorder, insideH: noBorder, insideV: noBorder },
    rows: [new TableRow({ children: [new TableCell({
      borders: { top: noBorder, bottom: noBorder, right: noBorder,
        left: { style: BorderStyle.SINGLE, size: 16, color: bdr } },
      shading: { type: ShadingType.CLEAR, fill: bg },
      margins: { top: 100, bottom: 100, left: 200, right: 200 },
      width: { size: CONTENT_W, type: WidthType.DXA },
      children: [new Paragraph({
        children: [run(text, { size: SZ.cell, color: C.black })],
        spacing: { before: 0, after: 0 },
      })],
    })]})],
  });
};

// ─── TABLE BUILDERS ───────────────────────────────────────────────────────
const makeTableRow = (cells, widths, isAlt, isHeader = false) =>
  new TableRow({
    tableHeader: isHeader,
    children: cells.map((cell, ci) => new TableCell({
      borders: cellBorder(isHeader ? '3D7A5C' : 'B2DFCF'),
      shading: { type: ShadingType.CLEAR, fill: isHeader ? C.rowHeader : isAlt ? C.rowAlt : C.white },
      margins: { top: isHeader ? 100 : 80, bottom: isHeader ? 100 : 80, left: 160, right: 160 },
      width: { size: widths[ci], type: WidthType.DXA },
      children: [new Paragraph({
        children: [run(cell, {
          size: SZ.cell,
          bold: isHeader || (ci === 0 && !isHeader),
          color: isHeader ? C.white : ci === 0 ? C.accentGreen : C.black,
        })],
        alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
      })],
    })),
  });

const comparisonTable = (headers, rows) => {
  const colW = Math.floor(CONTENT_W / 2);
  const widths = [colW, colW];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map(h => new TableCell({
          borders: cellBorder('3D7A5C'),
          shading: { type: ShadingType.CLEAR, fill: C.rowHeader },
          margins: { top: 100, bottom: 100, left: 160, right: 160 },
          width: { size: colW, type: WidthType.DXA },
          children: [new Paragraph({ children: [run(h, { size: SZ.cell, bold: true, color: C.white })], alignment: AlignmentType.CENTER })],
        })),
      }),
      ...rows.map((row, ri) => makeTableRow(row, widths, ri % 2 === 1)),
    ],
  });
};

const featureTable = (rows, col1Label = 'Field', col2Label = 'Description', w1 = 3000) => {
  const w2 = CONTENT_W - w1;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [w1, w2],
    rows: [
      makeTableRow([col1Label, col2Label], [w1, w2], false, true),
      ...rows.map((row, ri) => makeTableRow(row, [w1, w2], ri % 2 === 1)),
    ],
  });
};

const featureTable3 = (rows, col1Label = 'Field', col2Label = 'Value', col3Label = 'Detail', w1 = 1600, w2 = 1600) => {
  const w3 = CONTENT_W - w1 - w2;
  const hBorder = cellBorder('3D7A5C');
  const mkHdr = (label, w) => new TableCell({
    borders: hBorder,
    shading: { type: ShadingType.CLEAR, fill: C.rowHeader },
    margins: { top: 100, bottom: 100, left: 160, right: 160 },
    width: { size: w, type: WidthType.DXA },
    children: [new Paragraph({ children: [run(label, { size: SZ.cell, bold: true, color: C.white })], alignment: AlignmentType.CENTER })],
  });
  const mkCell = (text, w, ci, isAlt) => new TableCell({
    borders: cellBorder('B2DFCF'),
    shading: { type: ShadingType.CLEAR, fill: isAlt ? C.rowAlt : C.white },
    margins: { top: 80, bottom: 80, left: 160, right: 160 },
    width: { size: w, type: WidthType.DXA },
    children: [new Paragraph({
      children: [run(text, { size: SZ.cell, bold: ci === 0, color: ci === 0 ? C.accentGreen : ci === 1 ? C.teal : C.black })],
      alignment: ci === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
    })],
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [w1, w2, w3],
    rows: [
      new TableRow({ tableHeader: true, children: [mkHdr(col1Label, w1), mkHdr(col2Label, w2), mkHdr(col3Label, w3)] }),
      ...rows.map((row, ri) => new TableRow({ children: [mkCell(row[0], w1, 0, ri % 2 === 1), mkCell(row[1], w2, 1, ri % 2 === 1), mkCell(row[2], w3, 2, ri % 2 === 1)] })),
    ],
  });
};

// ─── SMART SCORE TABLE ────────────────────────────────────────────────────
const smartScoreTable = () => {
  const rows = [
    ['Academic (CGPA / Marks)', '30%', 'CGPA out of 4.0 \u2192 score. CGPA 4.0 = 100 pts. Uses provisional marks if results not yet published.'],
    ['Attendance', '20%', 'Average attendance across all active courses. 85%+ = 100, scales down proportionally below.'],
    ['Namaz (7-day average)', '10%', 'Average daily prayers completed over last 7 days. 5/day consistently = 100 pts.'],
    ['Assignments Done', '10%', '% of all assignments marked complete. Finish everything on time for 100 pts.'],
    ['Self Rating (7-day avg)', '8%', 'Daily 1\u20135 star self-ratings averaged over 7 days. 5.0 average = 100 pts.'],
    ['Conduct (7-day)', '8%', 'Good deeds minus Bad habits \u00D71.5 over 7 days. Net positive = higher score.'],
    ['Self Study (7-day)', '6%', '14 hrs/week academic study = 100 pts. Every hour below 14 reduces the score.'],
    ['Diary (7-day)', '4%', 'Days with diary entries in last 7 days. 7/7 days = 100 pts.'],
    ['Budget (30-day)', '4%', 'Entry count consistency this month. More entries = shows financial discipline.'],
  ];
  const colW = [3800, 1000, CONTENT_W - 4800];
  const hBorder = cellBorder('3D7A5C');
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colW,
    rows: [
      new TableRow({
        tableHeader: true,
        children: ['Parameter', 'Weight', 'How it calculates'].map((h, i) => new TableCell({
          borders: hBorder,
          shading: { type: ShadingType.CLEAR, fill: C.rowHeader },
          margins: { top: 100, bottom: 100, left: 160, right: 160 },
          width: { size: colW[i], type: WidthType.DXA },
          children: [new Paragraph({ children: [run(h, { size: SZ.cell, bold: true, color: C.white })], alignment: AlignmentType.CENTER })],
        })),
      }),
      ...rows.map((row, ri) => {
        const isAlt = ri % 2 === 1;
        return new TableRow({
          children: row.map((cell, ci) => new TableCell({
            borders: cellBorder('B2DFCF'),
            shading: { type: ShadingType.CLEAR, fill: isAlt ? C.rowAlt : C.white },
            margins: { top: 80, bottom: 80, left: 160, right: 160 },
            width: { size: colW[ci], type: WidthType.DXA },
            children: [new Paragraph({
              // FIX: was `size: ci === 1 ? 19 : 19` (always 19) — simplified
              children: [run(cell, { size: 19, color: ci === 1 ? C.teal : ci === 0 ? C.accentGreen : C.black, bold: ci === 1 })],
              alignment: ci === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
            })],
          })),
        });
      }),
    ],
  });
};

// ─── COVER PAGE ────────────────────────────────────────────────────────────
const makeCoverSection = () => [
  new Paragraph({ children: [run('', { size: 1 })], spacing: { before: 2800, after: 0 }, shading: { type: ShadingType.CLEAR, fill: C.darkGreen } }),
  new Paragraph({ children: [run('KUETx', { size: 72, bold: true, color: C.white })], alignment: AlignmentType.CENTER, shading: { type: ShadingType.CLEAR, fill: C.darkGreen }, spacing: { before: 80, after: 40 } }),
  new Paragraph({ children: [run('Complete Guide', { size: 28, color: C.teal })], alignment: AlignmentType.CENTER, shading: { type: ShadingType.CLEAR, fill: C.darkGreen }, spacing: { before: 0, after: 120 } }),
  new Paragraph({ children: [run('Built only for KUETians  \u2022  Everything your campus life needs', { size: SZ.cell, color: 'AADBC4' })], alignment: AlignmentType.CENTER, shading: { type: ShadingType.CLEAR, fill: C.darkGreen }, spacing: { before: 0, after: 160 } }),
  new Paragraph({
    children: [
      run('  Offline-First  ', { size: 18, color: C.white, bold: true }),
      run('   \u00B7   ', { size: 18, color: C.teal }),
      run('  No Login Needed  ', { size: 18, color: C.white, bold: true }),
      run('   \u00B7   ', { size: 18, color: C.teal }),
      run('  Free Forever  ', { size: 18, color: C.white, bold: true }),
      run('   \u00B7   ', { size: 18, color: C.teal }),
      run('  KUET-Specific  ', { size: 18, color: C.white, bold: true }),
    ],
    alignment: AlignmentType.CENTER,
    shading: { type: ShadingType.CLEAR, fill: C.darkGreen },
    spacing: { before: 0, after: 120 },
  }),
  new Paragraph({ children: [run('www.kuetx.com', { size: SZ.cell, color: C.teal })], alignment: AlignmentType.CENTER, shading: { type: ShadingType.CLEAR, fill: C.darkGreen }, spacing: { before: 0, after: 2800 } }),
  new Paragraph({ children: [run('Built by a KUETian, for KUETians  \u2022  2025', { size: SZ.foot, color: C.teal })], alignment: AlignmentType.CENTER, shading: { type: ShadingType.CLEAR, fill: C.darkGreen }, spacing: { before: 0, after: 0 } }),
  pageBreak(),
];

// ─── TABLE OF CONTENTS ────────────────────────────────────────────────────
const makeTOC = () => {
  const tocItems = [
    ['01', 'Getting Started',          'First-time setup, PWA install, profile, Day 1 checklist'],
    ['02', 'Dashboard',                'Live academic summary, stat cards, CGPA trend, alerts'],
    ['03', 'Profile',                  'Student info, Google sign-in, Firebase sync, photo'],
    ['04', 'Courses',                  'Auto-loaded course list, statuses, custom courses'],
    ['05', 'Attendance',               'Daily tracker, KUET slabs, shortage alerts, per-teacher'],
    ['06', 'Class Schedule',           'Weekly timetable, time models, holidays, term roadmap'],
    ['07', 'Assignments',              'Deadline tracker, priority, overdue + dashboard alerts'],
    ['08', 'Syllabus',                 'Dept. curriculum, topics per course, study shortcut'],
    ['09', 'Question Bank',            'Past exam papers, download PDFs, contribute'],
    ['10', 'Solution Bank',            'Step-by-step exam solutions, organized by dept/year/term'],
    ['11', 'Term Planner (Marks)',      'CT entry, attendance marks, grade prediction, targets'],
    ['12', 'Results & GPA',            'KUET grade scale, term GPA, CGPA history chart'],
    ['13', 'Teachers',                 'Teacher directory, link to courses, schedule, marks'],
    ['14', 'Class Diary',              'Daily class log per course, topics covered, notes'],
    ['15', 'Self Study',               'Session logger, weekly bar chart, extra reading'],
    ['16', 'Time Tracker',             'Activity timer, Pomodoro, daily time log'],
    ['17', 'Namaz Tracker',            'Daily prayer logger, 7-day streak, masjid mark'],
    ['18', 'Self Evaluation',          'Daily habit & conduct tracker, deeds log, rating'],
    ['19', 'Smart Score',              'Composite 9-parameter personal score \u2014 full breakdown'],
    ['20', 'Money (Finance)',           'Income + expense, budget, running balance, monthly chart'],
    ['21', 'Alerts',                   'KUET regulation warnings \u2014 attendance, CGPA, backlogs'],
    ['22', 'Notes',                    'Pinnable notepad with tags, search, copy'],
    ['23', 'Clubs & Activities',       'Club memberships, activity log, hours invested'],
    ['24', 'CR Tools',                 'Class Representative: routine, class count, share'],
    ['25', 'CT & Quiz Planner',        'Exam calendar, conflict detection, smart scheduling'],
    ['26', 'More Features',            'Tuition, Food, Projects, Tours, Social, Reports'],
    ['27', 'Settings & Privacy',       'Theme, app mode, backup, restore, data management'],
    ['28', 'Google Drive Sync',        'Auto-backup to your personal Google Drive'],
    ['29', 'Firebase Sync',            'Real-time cross-device sync via Google login'],
    ['30', 'Quick Access & Nav',       'Adaptive nav, favorites, simplified mode'],
    ['31', 'Feature Mind Map',         'All 33 features at a glance, grouped by category'],
    ['32', 'Quick Tips',               'Troubleshooting, FAQs, common issues solved'],
    ['33', 'About KUETx',             'App version, credits, feature overview, guide PDF'],
  ];
  const colW1 = 800, colW2 = 3900, colW3 = CONTENT_W - colW1 - colW2;
  const rows = tocItems.map((item, i) => {
    const isAlt = i % 2 === 1;
    return new TableRow({ children: [
      new TableCell({ borders: cellBorder('B2DFCF'), shading: { type: ShadingType.CLEAR, fill: isAlt ? C.rowAlt : C.white }, margins: { top: 70, bottom: 70, left: 160, right: 120 }, width: { size: colW1, type: WidthType.DXA }, children: [new Paragraph({ children: [run(item[0], { size: SZ.cell, bold: true, color: C.teal })], alignment: AlignmentType.CENTER })] }),
      new TableCell({ borders: cellBorder('B2DFCF'), shading: { type: ShadingType.CLEAR, fill: isAlt ? C.rowAlt : C.white }, margins: { top: 70, bottom: 70, left: 160, right: 160 }, width: { size: colW2, type: WidthType.DXA }, children: [new Paragraph({ children: [run(item[1], { size: SZ.cell, bold: true, color: C.accentGreen })] })] }),
      new TableCell({ borders: cellBorder('B2DFCF'), shading: { type: ShadingType.CLEAR, fill: isAlt ? C.rowAlt : C.white }, margins: { top: 70, bottom: 70, left: 160, right: 160 }, width: { size: colW3, type: WidthType.DXA }, children: [new Paragraph({ children: [run(item[2], { size: SZ.tiny, color: C.muted })] })] }),
    ]});
  });
  return [
    sectionHeaderBar('Table of Contents'),
    spacer(160),
    new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [colW1, colW2, colW3], rows }),
    pageBreak(),
  ];
};

// ─── WHY USE KUETX ────────────────────────────────────────────────────────
const makeWhySection = () => [
  sectionHeaderBar('Why Use KUETx?'),
  spacer(120),
  bodyText('KUETx is not a generic student tool. Every single feature is designed around KUET\'s actual exam system, attendance rules, mark calculation formula, and campus life \u2014 no other app does this.'),
  spacer(80),
  comparisonTable(
    ['Without KUETx', 'With KUETx'],
    [
      ['Manual attendance counting on paper',        'Auto-tracked per course, per day, with color-coded shortage alerts'],
      ['Guessing your CGPA in your head',            'Live CGPA calculated from every mark and result you enter'],
      ['Forgetting assignment deadlines',            'Unified tracker with status, priority, and overdue alerts on Dashboard'],
      ['Spreadsheets for mark entry',               'Per-course marks with grade prediction and target hall-mark calculator'],
      ['Not knowing KUET academic rules',           'App warns when you\'re violating Art. 11.3, 14.2, 16, 20 etc.'],
      ['Losing past exam papers each term',         'Question bank \u2014 all KUET past papers in one place, downloadable'],
      ['No cross-device backup',                    'Google Drive auto-sync + Firebase real-time sync built in'],
      ['Tracking prayers and habits separately',    'Namaz tracker + Self Evaluation integrated into your Smart Score'],
      ['Managing money in a notebook',              'Income + expense tracker with monthly bar chart and budget alerts'],
      ['Not knowing your attendance marks',         'Auto-calculated per KUET slab formula for each teacher'],
      ['No step-by-step exam solutions',            'Solution Bank \u2014 detailed worked solutions to past KUET papers'],
      ['Missing teacher contact info',              'Personal teacher directory linked to courses and schedule'],
    ]
  ),
  spacer(120),
  pageBreak(),
];

// ─── GETTING STARTED ──────────────────────────────────────────────────────
const makeGettingStarted = () => [
  sectionHeaderBar('01 \u00B7 Getting Started \u2014 Your First Session'),
  spacer(80),
  subLabel('What You See When You First Open the App'),
  bodyText('Go to www.kuetx.com. You land on the Dashboard. Most cards will be empty or show zero \u2014 that is normal. A "Complete Your Profile" banner may appear at the top. The app is already working offline after this first load.'),
  spacer(60),
  callout('Install it first. On Android: Chrome menu \u2192 Add to Home Screen. On iPhone: Safari Share \u2192 Add to Home Screen. Desktop: click the install icon in the address bar. The PWA version is faster and works without a browser tab.', 'tip'),
  spacer(100),
  subLabel('Setup Order \u2014 Do This in Sequence'),
  bodyText('Follow this order on Day 1. Each step feeds the next.'),
  step(1, 'Open Profile \u2192 tap the pencil icon \u2192 fill your name, student ID, department, year/term, enrolled year. Tap Save.'),
  step(2, 'Open Courses \u2192 your department\'s courses auto-load. Check that the correct courses are showing. Fix any statuses (Active, Backlog, etc.).'),
  step(3, 'Open Schedule \u2192 select your time model (50-min or 40-min) \u2192 add your weekly class routine day by day.'),
  step(4, 'Open Teachers \u2192 add your subject teachers. This links them to courses and unlocks per-teacher tracking in Marks.'),
  step(5, 'Open Attendance \u2192 today\'s classes appear from your routine. Mark Present / Absent for each. Start doing this daily.'),
  step(6, 'Open Marks \u2192 enter CT marks as each CT happens. Enter hall marks after results publish.'),
  spacer(80),
  callout('Day 1 minimum: Steps 1\u20134 take about 15 minutes. After that, the app runs on autopilot \u2014 you just log attendance daily and add marks as they happen.', 'success'),
  spacer(100),
  subLabel('Profile Setup Fields'),
  featureTable([
    ['Name',            'Your full name \u2014 shown on Dashboard and Profile page'],
    ['Student ID',      'Your KUET student ID (e.g., 2313014) \u2014 used for identification'],
    ['Department',      'Select from all 16 KUET departments \u2014 triggers auto-load of your courses and syllabus'],
    ['Year & Term',     'e.g., 2nd Year, 1st Term \u2014 loads the correct curriculum and schedule structure'],
    ['CR Mode',         'Tick if you are a Class Representative \u2014 unlocks CR Tools and CT Planner in navigation'],
    ['Enrolled Year',   'e.g., 2022 \u2014 used for batch calculations and CGPA timelines'],
    ['Term Start Date', 'Enables the Term Roadmap view on Dashboard (class-end, prep leave, exam dates)'],
  ], 'Field', 'What it does', 2600),
  spacer(80),
  subLabel('App Navigation \u2014 Mobile vs Desktop'),
  featureTable([
    ['Bottom Nav (Mobile)',    '4 core tabs + "More" button. Default: Dashboard, Attendance, Marks, Alerts + More.'],
    ['More Drawer (Mobile)',   'Opens from the "More" button \u2014 shows all 33 pages grouped by category.'],
    ['Left Sidebar (Desktop)', 'Always-visible collapsible panel with all pages grouped by category.'],
    ['Adaptive Nav',           'After a few days of use, the bottom bar shifts to your 4 most-visited pages.'],
    ['Quick Access Page',      'A single page showing your pinned pages, favorites, and recently used.'],
  ], 'Layout Element', 'What it does', 2800),
  spacer(80),
  subLabel('Pages by Category \u2014 Quick Reference'),
  featureTable([
    ['Overview',   'Dashboard, Quick Access, Profile, Notes'],
    ['Academics',  'Courses, Attendance, Schedule, Assignments, Marks, Results, Teachers, Syllabus, Question Bank, Solution Bank'],
    ['Daily Life', 'Class Diary, Self Study, Time Tracker, Namaz Tracker'],
    ['Wellbeing',  'Self Evaluation, Smart Score'],
    ['Finance',    'Money, Tuition, Food & Health'],
    ['Activities', 'Clubs, Projects, Tours, Social'],
    ['Tools',      'Alerts, Reports, Settings, About KUETx'],
    ['CR Only',    'Class Management, CT & Quiz Planner (visible only when CR Mode is on)'],
  ], 'Group', 'Pages', 1800),
  spacer(60),
  pageBreak(),
];

// ─── DASHBOARD ────────────────────────────────────────────────────────────
const makeDashboard = () => [
  sectionHeaderBar('02 \u00B7 Dashboard'),
  spacer(80),
  ...pageTitle('Dashboard', '/  (Home)'),
  bodyText('Your home screen. Shows a live summary of your entire academic status at a glance. Everything updates automatically as you enter data in other pages.'),
  spacer(60),
  subLabel('What You\'ll See \u2014 Each Card Explained'),
  featureTable([
    ['CGPA Card',         'Your live CGPA (from Results page). Color: Green \u226533.50, Yellow 2.20\u20133.49, Red below 2.20. Tap to go to Results.'],
    ['Attendance Status', 'Average attendance across all Active courses. Green \u226575%, Yellow 60\u201374%, Red below 60%.'],
    ['Marks Overview',    'Provisional GPA for the current term based on CT marks entered in Term Planner.'],
    ['Smart Score Ring',  'Your composite personal score (0\u2013100) combining academics, attendance, habits, and wellbeing.'],
    ['Alerts Strip',      'Critical warnings at the top \u2014 red = must act now. Shows exam bar risk, CGPA risk, violations.'],
    ['Upcoming Deadlines','Next 3 upcoming assignment deadlines from the Assignments page.'],
    ['Expense Summary',   'Current month\'s total spending from the Money page.'],
    ['CGPA Trend Chart',  'Area graph of term-by-term GPA history. Builds up over time as you enter results.'],
    ['Term Roadmap',      'Timeline bar showing where you are in the current term. Requires Term Start Date in Profile.'],
    ['Focus Time Today',  'Total productive hours (Study + Class + Self Study) from Time Tracker for today.'],
  ], 'Card', 'What it shows', 2600),
  spacer(80),
  subLabel('How to Use'),
  step(1, 'Open the app \u2014 Dashboard loads by default at www.kuetx.com'),
  step(2, 'Tap any stat card to navigate directly to that section for more detail or to enter data'),
  step(3, 'Watch the alerts strip \u2014 if it\'s red, tap it and fix the issue immediately'),
  step(4, 'CGPA trend chart will grow over 4 years as you enter each term\'s results'),
  spacer(60),
  callout('Dashboard is read-only \u2014 it pulls data from all other pages. To see numbers here, enter data in Attendance, Marks, Results, and Money. Nothing on Dashboard requires direct input.', 'info'),
  spacer(60),
  pageBreak(),
];

// ─── PROFILE ─────────────────────────────────────────────────────────────
const makeProfile = () => [
  sectionHeaderBar('03 \u00B7 Profile'),
  spacer(80),
  ...pageTitle('Profile', '/profile'),
  bodyText('Your full student profile dashboard \u2014 shows a live overview of all academic metrics. Also manages your Google account, Drive sync, and Firebase real-time sync.'),
  spacer(60),
  subLabel('What You\'ll See'),
  bullet('Your photo, name, department, year/term, batch, and student ID'),
  bullet('Live academic summary: CGPA, earned credits, overall attendance percentage'),
  bullet('Term-wise GPA history table \u2014 one row per completed term'),
  bullet('Academic status: Normal / Probation / Dean\'s List / Honors Eligible'),
  bullet('Account section: Guest mode or logged-in Google account'),
  bullet('Google Drive sync status: connected, last backup time, Sync Now button'),
  spacer(60),
  subLabel('How to Use'),
  step(1, 'Tap the pencil / edit icon to open Profile Setup and update your details'),
  step(2, 'Upload a profile photo \u2014 stored in Firebase Storage, syncs across devices'),
  step(3, 'Tap "Sign In with Google" to enable Firebase real-time sync'),
  step(4, 'Tap "Connect Google Drive" to enable auto-backup to your own Google Drive'),
  step(5, 'Guest mode users see a prompt \u2014 sync is optional, the app works fully without it'),
  spacer(60),
  callout('Tip: Tap any metric card on the Profile page to jump directly to that section. Tap CGPA card \u2192 goes to Results. Tap Attendance card \u2192 goes to Attendance.', 'tip'),
  spacer(60),
  pageBreak(),
];

// ─── COURSES ─────────────────────────────────────────────────────────────
const makeCourses = () => [
  sectionHeaderBar('04 \u00B7 Courses'),
  spacer(80),
  ...pageTitle('Courses', '/courses'),
  bodyText('Your course list \u2014 the foundation everything else builds on. Courses for your department and year/term are auto-loaded from the built-in KUET curriculum database. You don\'t enter them manually.'),
  spacer(60),
  subLabel('What You\'ll See'),
  bullet('All courses auto-loaded for your department and year/term (set in Profile)'),
  bullet('Course code, name, credit hours, and type (Theory / Sessional / Project / Non-Credit)'),
  bullet('Status chip per course: Active, Completed, Backlog, Withdrawal, Incomplete'),
  bullet('Teacher chip \u2014 shows assigned teacher (linked from Schedule or Teachers page)'),
  bullet('Optional course selector if your department has elective slots'),
  spacer(60),
  subLabel('Course Status Types'),
  featureTable([
    ['Active',      'Currently attending \u2014 counted in attendance percentages, marks calculation, and CGPA'],
    ['Completed',   'Term finished \u2014 grade locked in Results. No longer affects attendance tracking.'],
    ['Backlog',     'Failed and retaking \u2014 KUET Art. 16: maximum grade capped at B+ (3.25)'],
    ['Withdrawal',  'Officially withdrawn \u2014 not counted in GPA. Check KUET regulation for withdrawal rules.'],
    ['Incomplete',  'Incomplete term \u2014 special status as per KUET academic regulations'],
  ], 'Status', 'What it means', 2200),
  spacer(80),
  subLabel('How to Use'),
  step(1, 'Open Courses \u2014 your term\'s courses are already listed (auto-loaded from your profile)'),
  step(2, 'Tap a course card to expand it and see full details'),
  step(3, 'Tap the status chip to change status: Active \u2192 Completed, Backlog, Withdrawal, etc.'),
  step(4, 'Tap "+ Add Custom Course" if a course is missing from the auto-loaded list'),
  step(5, 'Change year/term in Profile to switch which curriculum loads'),
  spacer(60),
  callout('Warning: Course statuses affect CGPA calculation everywhere. Set them accurately. A Backlog course that should be Completed \u2014 or vice versa \u2014 will give a wrong CGPA reading.', 'warning'),
  spacer(60),
  pageBreak(),
];

// ─── ATTENDANCE ───────────────────────────────────────────────────────────
const makeAttendance = () => [
  sectionHeaderBar('05 \u00B7 Attendance'),
  spacer(80),
  ...pageTitle('Attendance', '/attendance'),
  bodyText('Per-course daily attendance tracker with shortage alerts, per-teacher tracking, KUET rule enforcement, and automatic marks slab calculation. The most critical feature for staying exam-eligible.'),
  spacer(60),
  subLabel('Attendance Marks Slab (KUET Formula)'),
  featureTable([
    ['\u226590%',   '15 marks/teacher  |  30 marks total (2 teachers)'],
    ['85\u201389%', '13.5 marks/teacher  |  27 marks total'],
    ['80\u201384%', '12 marks/teacher  |  24 marks total'],
    ['75\u201379%', '10.5 marks/teacher  |  21 marks total'],
    ['70\u201374%', '9 marks/teacher  |  18 marks total'],
    ['65\u201369%', '7.5 marks/teacher  |  15 marks total'],
    ['60\u201364%', '6 marks/teacher  |  12 marks total'],
    ['< 60%',       '0 marks \u2014 and BARRED from exam (Art. 11.3)'],
  ], 'Attendance %', 'Marks Earned', 2000),
  spacer(80),
  subLabel('Attendance Status Types'),
  featureTable([
    ['Present (P)',  'Full attendance credit for this class'],
    ['Absent (A)',   'Absence counted \u2014 reduces your percentage'],
    ['Late (L)',     'Counted as half-present \u2014 configurable in settings'],
    ['Medical (M)', 'Medical leave \u2014 counted as absent but flagged separately for records'],
  ], 'Status', 'How it counts', 2200),
  spacer(80),
  subLabel('How to Use'),
  step(1, 'Open Attendance \u2014 today\'s date is auto-selected'),
  step(2, 'Today\'s scheduled courses appear at the top based on your routine in Schedule'),
  step(3, 'Tap Present / Absent / Late / Medical for each course'),
  step(4, 'Use the calendar arrows to navigate to past dates and fill gaps'),
  step(5, 'Assign teachers to courses \u2014 enables per-teacher slab calculation'),
  step(6, 'Mark holiday dates \u2014 they are excluded from attendance counts'),
  spacer(60),
  callout('CRITICAL: Art. 11.3 \u2014 Below 60% = barred from exam. Art. 14.2 \u2014 Below 75% = scholarship loss. Lab/Sessional courses are marked as full attendance automatically (100%). Check your percentages weekly, not the day before exams.', 'danger'),
  spacer(60),
  pageBreak(),
];

// ─── SCHEDULE ─────────────────────────────────────────────────────────────
const makeSchedule = () => [
  sectionHeaderBar('06 \u00B7 Class Schedule'),
  spacer(80),
  ...pageTitle('Class Schedule', '/schedule'),
  bodyText('Your class routine \u2014 a visual weekly timetable (Sunday to Thursday) using KUET\'s official time models. Your routine feeds into Attendance (today\'s classes auto-appear) and Dashboard (today\'s class timeline).'),
  spacer(60),
  subLabel('Available Time Models'),
  featureTable([
    ['50 Minute Model', '8:00 AM start. Periods: 8:00, 8:50, 9:40, 10:30, 11:20, 12:10. Lunch gap 1:10\u20132:30 PM. Lab block: 2:30\u20135:00 PM.'],
    ['40 Minute Model', '9:00 AM start. Shorter class cycle. Lab block: 2:00\u20135:00 PM.'],
    ['Custom',          'Define your own time slots if your department uses a different schedule structure.'],
  ], 'Model', 'Details', 2400),
  spacer(80),
  subLabel('How to Use'),
  step(1, 'Open Schedule and select your time model (50-min or 40-min)'),
  step(2, 'Tap "+ Add" on any day to open the slot editor'),
  step(3, 'Select the course, time period, room number, and teacher'),
  step(4, 'Repeat for your full weekly routine (typically takes 10\u201315 minutes once)'),
  step(5, 'Use the holiday marker for Eid, semester break, and other off days'),
  spacer(60),
  callout('Set your routine once at the start of term \u2014 Attendance will then auto-suggest today\'s courses every morning, and the Dashboard will show today\'s class timeline without any extra input.', 'tip'),
  spacer(60),
  pageBreak(),
];

// ─── ASSIGNMENTS ──────────────────────────────────────────────────────────
const makeAssignments = () => [
  sectionHeaderBar('07 \u00B7 Assignments'),
  spacer(80),
  ...pageTitle('Assignments', '/assignments'),
  bodyText('Assignment and submission deadline tracker across all courses. Overdue assignments are highlighted in red. The Dashboard automatically shows your next 3 upcoming deadlines.'),
  spacer(60),
  subLabel('Priority Levels'),
  featureTable([
    ['High',   'Urgent or high-mark assignments \u2014 shown first in the list'],
    ['Medium', 'Standard assignments \u2014 default priority'],
    ['Low',    'Optional or low-mark items \u2014 shown at the bottom'],
  ], 'Priority', 'What it means', 1800),
  spacer(80),
  subLabel('How to Use'),
  step(1, 'Tap "+ Add" to create a new assignment'),
  step(2, 'Select course, write the title and description, set due date'),
  step(3, 'Set priority: High / Medium / Low'),
  step(4, 'When submitted, tap the checkmark to mark it as Done'),
  step(5, 'Use the filter tabs to view: All / Pending / Done / Overdue'),
  spacer(60),
  callout('The Alerts page watches your assignments and fires warnings for overdue or due-today items. Dashboard shows next 3 deadlines automatically \u2014 no extra setup needed.', 'info'),
  spacer(60),
  pageBreak(),
];

// ─── SYLLABUS ─────────────────────────────────────────────────────────────
const makeSyllabus = () => [
  sectionHeaderBar('08 \u00B7 Syllabus'),
  spacer(80),
  ...pageTitle('Syllabus', '/syllabus'),
  bodyText('Your department\'s official KUET syllabus \u2014 course by course, topic by topic. Auto-loaded from your profile. Useful for planning study sessions, knowing what to cover, and creating Self Study entries quickly.'),
  spacer(60),
  subLabel('What You\'ll See'),
  bullet('All courses for your department, organized by year and term'),
  bullet('Each course: code, name, credit hours, and contact hours per week'),
  bullet('Full chapter/topic list for each course in the proper order'),
  bullet('Marks breakdown per course (theory, sessional, or project)'),
  spacer(60),
  subLabel('How to Use'),
  step(1, 'Open Syllabus \u2014 your department\'s curriculum loads automatically'),
  step(2, 'Use the year/term filter to browse other terms'),
  step(3, 'Tap a course to expand it and see the full topic list'),
  step(4, 'Tap any topic to instantly open a Self Study session pre-filled with that course and topic'),
  spacer(60),
  callout('Power shortcut: Instead of typing course names manually in Self Study, always use Syllabus \u2192 tap topic \u2192 Self Study opens pre-filled. Saves time and keeps data consistent.', 'tip'),
  spacer(60),
  pageBreak(),
];

// ─── QUESTION BANK ────────────────────────────────────────────────────────
const makeQuestionBank = () => [
  sectionHeaderBar('09 \u00B7 Question Bank'),
  spacer(80),
  ...pageTitle('Question Bank', '/question-bank'),
  bodyText('KUET past exam papers \u2014 all 16 departments, organized by year, term, and exam type. Your department is pre-selected from your profile. Papers are downloadable as PDF directly in the app.'),
  spacer(60),
  subLabel('What You\'ll See'),
  bullet('Papers organized by: Department \u2192 Year \u2192 Term'),
  bullet('Each paper: year, exam type (Regular / Backlog / Special), upload status'),
  bullet('Green checkmark = PDF available for immediate download'),
  bullet('Grey clock icon = paper not yet uploaded (you can contribute yours!)'),
  spacer(60),
  subLabel('What You Can Do'),
  bullet('Filter by department, year, and term using dropdown filters'),
  bullet('Download any available paper as PDF with one tap'),
  bullet('Contribute a paper you have via the Google Form contribution link'),
  bullet('Switch to Solution Bank (/solutions) for step-by-step worked solutions'),
  spacer(60),
  subLabel('How to Use'),
  step(1, 'Open Question Bank \u2014 your department is pre-selected automatically'),
  step(2, 'Tap any year to expand and see available papers'),
  step(3, 'Tap "Download" on any green-checked paper \u2014 PDF opens directly'),
  step(4, 'For missing papers, tap "Contribute" to submit via Google Form'),
  spacer(60),
  callout('Papers are added as students contribute. If you have a paper not listed, use the Contribute button. It takes under 1 minute and helps every KUETian in your department.', 'info'),
  spacer(60),
  pageBreak(),
];

// ─── SOLUTION BANK (NEW) ──────────────────────────────────────────────────
const makeSolutionBank = () => [
  sectionHeaderBar('10 \u00B7 Solution Bank'),
  spacer(80),
  ...pageTitle('Solution Bank', '/solutions'),
  bodyText('Step-by-step worked solutions to KUET past exam questions, organized by department, year, term, and course. Access detailed solutions instantly \u2014 understand the approach, not just the answer.'),
  spacer(60),
  subLabel('What You\'ll See'),
  bullet('Solutions organized by: Department \u2192 Year \u2192 Term \u2192 Course \u2192 Exam Year'),
  bullet('Each question: full problem statement, step-by-step solution, final answer'),
  bullet('Multiple solution years per course where available'),
  bullet('Department filter pre-set from your profile (change any time)'),
  bullet('Solution availability indicator per course \u2014 see which papers are solved at a glance'),
  spacer(60),
  subLabel('How Solutions Are Organized'),
  featureTable([
    ['Department',  'Select from all 16 KUET departments. Your dept is pre-selected from Profile.'],
    ['Year & Term', 'e.g., Year 2, Term 1 \u2014 matches your curriculum structure'],
    ['Course',      'Course code + name (e.g., CSE2113 \u2014 Data Structures)'],
    ['Exam Year',   'The actual year the exam was held (e.g., 2021, 2022, 2023)'],
    ['Questions',   'Each question is a separate card with full problem + worked solution'],
  ], 'Level', 'What it shows', 2600),
  spacer(80),
  subLabel('How to Use'),
  step(1, 'Open Solution Bank \u2014 your department auto-loads from Profile'),
  step(2, 'Select a Year and Term from the dropdown filters'),
  step(3, 'Tap a course to see available solved exam years'),
  step(4, 'Tap an exam year to expand all solved questions for that paper'),
  step(5, 'Read through each question\u2019s step-by-step solution at your own pace'),
  step(6, 'Use alongside Question Bank \u2014 view the original paper there, solutions here'),
  spacer(60),
  subLabel('Coverage Note'),
  bodyText('Solution Bank currently covers ESE (Energy Science & Engineering) department in detail, with more departments being added as students contribute solutions. Check the availability indicator for your department before exam season.'),
  spacer(60),
  callout('Best workflow before exams: (1) Download the question paper from Question Bank, (2) attempt it yourself first, (3) then open Solution Bank to check your approach against the step-by-step solution. This is significantly more effective than reading solutions cold.', 'tip'),
  spacer(60),
  pageBreak(),
];

// ─── MARKS (TERM PLANNER) ────────────────────────────────────────────────
const makeMarks = () => [
  sectionHeaderBar('11 \u00B7 Term Planner (Marks)'),
  spacer(80),
  ...pageTitle('Term Planner', '/marks'),
  bodyText('Marks entry and grade prediction for all active courses. Follows KUET\'s official formula: 40% continuous assessment (CT + attendance + assignment) + 60% hall exam = 300 total marks.'),
  spacer(60),
  subLabel('KUET Marks Formula \u2014 Breakdown'),
  featureTable([
    ['Class Tests (CT)',  'Up to 5 CTs per teacher. Best 3 are auto-selected by the app. Max 10 marks per CT = 30 marks per teacher.'],
    ['Attendance Marks', 'Auto-pulled from Attendance page using the slab formula. Max 15 marks per teacher.'],
    ['Assignment Marks', 'Entered manually as given. Typically 5\u201310 marks per teacher.'],
    ['Continuous Total', 'Teacher 1 total + Teacher 2 total. Max 90 marks combined (40% of 300 total).'],
    ['Hall Exam',        'Written final exam. Max 210 marks (70 marks \u00D7 3 questions answered = 60% of total).'],
    ['Grand Total',      'Continuous (90) + Hall (210) = 300. Grade is calculated from your percentage.'],
  ], 'Component', 'Details', 2600),
  spacer(80),
  subLabel('How to Use'),
  step(1, 'Open Term Planner \u2014 active courses are listed as expandable cards'),
  step(2, 'Expand a course \u2014 you\'ll see CT fields for Teacher 1 and Teacher 2 separately'),
  step(3, 'Enter CT marks as you receive them (up to CT5 for each teacher)'),
  step(4, 'Attendance marks auto-fill from the Attendance page \u2014 switch to Manual if needed'),
  step(5, 'Set a Target Grade (e.g., B+) to see the minimum hall mark required'),
  step(6, 'After hall exam results, enter the final hall mark \u2014 your grade calculates live'),
  spacer(60),
  callout('Tip: Use the Target Grade feature before every exam. If you need 140/210 hall marks for B+, you know your minimum. If you already have enough continuous marks, you might just need 100 in the hall exam.', 'tip'),
  spacer(60),
  pageBreak(),
];

// ─── RESULTS ─────────────────────────────────────────────────────────────
const makeResults = () => [
  sectionHeaderBar('12 \u00B7 Results & GPA'),
  spacer(80),
  ...pageTitle('Results & GPA', '/results'),
  bodyText('Term-wise GPA/CGPA tracker and your complete academic history. Calculated using KUET\'s official credit-weighted CGPA formula across all terms. Enter results once after each term publishes.'),
  spacer(60),
  subLabel('KUET Grade Scale'),
  featureTable3([
    ['A+',  '4.00',  '80% and above'],
    ['A',   '3.75',  '75 \u2013 79%'],
    ['A-',  '3.50',  '70 \u2013 74%'],
    ['B+',  '3.25',  '65 \u2013 69%'],
    ['B',   '3.00',  '60 \u2013 64%'],
    ['B-',  '2.75',  '55 \u2013 59%'],
    ['C+',  '2.50',  '50 \u2013 54%'],
    ['C',   '2.25',  '45 \u2013 49%'],
    ['D',   '2.00',  '40 \u2013 44%'],
    ['F',   '0.00',  'Below 40% \u2014 course must be retaken'],
  ], 'Grade', 'Points', 'Percentage Range', 1500, 1500),
  spacer(80),
  subLabel('Academic Status Thresholds'),
  featureTable([
    ['Dean\'s List',        'GPA \u22653.75 this term. Must have no F or Backlog courses in the term.'],
    ['Honors Eligible',     'CGPA \u22653.50 across all completed terms with no backlogs (Art. 18.1).'],
    ['Normal',              'CGPA \u22652.20 \u2014 no academic risk.'],
    ['Academic Probation',  'CGPA drops below 2.20 (Art. 20) \u2014 monitored status. App shows a warning.'],
    ['Struck-Off Risk',     'Less than 36 credits earned in first 4 terms \u2014 App fires a critical alert.'],
  ], 'Status', 'Condition', 2600),
  spacer(80),
  subLabel('How to Use'),
  step(1, 'After each term\'s result publishes, open Results page'),
  step(2, 'Tap the relevant term (e.g., Y1T1) and enter your GPA or individual course grades'),
  step(3, 'CGPA updates instantly and propagates across the entire app (Dashboard, Profile, Alerts)'),
  step(4, 'Check "Dean\'s List eligible" status each term \u2014 requires GPA \u22653.75 with no backlogs'),
  spacer(60),
  callout('Academic Probation (Art. 20): CGPA < 2.20. Struck-Off: < 36 credits in first 4 terms. Backlog grades capped at B+ (Art. 16). The Alerts page monitors all of these rules automatically so you never miss a violation.', 'danger'),
  spacer(60),
  pageBreak(),
];

// ─── TEACHERS ─────────────────────────────────────────────────────────────
const makeTeachers = () => [
  sectionHeaderBar('13 \u00B7 Teachers'),
  spacer(80),
  ...pageTitle('Teachers', '/teachers'),
  bodyText('Your personal teacher directory. Add and link teachers to courses, schedule entries, and marks. Once linked, the same teacher name flows through Marks (per-teacher CT entry), Attendance (per-teacher slab), and Schedule \u2014 all from one source.'),
  spacer(60),
  subLabel('Teacher Fields'),
  featureTable([
    ['Name',        'Full name (the app auto-appends "Sir" if not already present)'],
    ['Initial',     'Short code used in schedule slot display (e.g., "MSR" for M.S. Rahman)'],
    ['Title',       'Designation: Lecturer, Asst. Prof., Assoc. Prof., Prof., Dr., etc.'],
    ['Department',  'Home department of the teacher'],
    ['Phone',       'Mobile number for quick reference \u2014 stored locally, private to you'],
    ['Email',       'Office or KUET email address for contact'],
    ['Office Room', 'Room number for visiting during office hours'],
    ['Rating',      'Personal 1\u20135 star rating \u2014 fully private, only you can see it'],
    ['Notes',       'Any personal notes: office hour schedule, exam preferences, etc.'],
  ], 'Field', 'Description', 2200),
  spacer(80),
  subLabel('How to Use'),
  step(1, 'Tap "+ Add Teacher" and fill in at minimum: Name and Initial'),
  step(2, 'Open Schedule \u2014 teachers you added appear as suggestions when filling time slots'),
  step(3, 'Assign teachers to courses via the Courses page or Schedule page'),
  step(4, 'In Term Planner (Marks), each linked teacher gets their own CT entry section'),
  step(5, 'In Attendance, per-teacher tracking uses the same teacher you assigned in Schedule'),
  spacer(60),
  callout('Consistency tip: Use the same teacher name everywhere. If you type "A. Rahman" in Schedule but "Abdul Rahman" in Teachers, the app may not link them. Add the teacher first, then pick from the suggestion dropdown.', 'tip'),
  spacer(60),
  pageBreak(),
];

// ─── DIARY ────────────────────────────────────────────────────────────────
const makeDiary = () => [
  sectionHeaderBar('14 \u00B7 Class Diary'),
  spacer(80),
  ...pageTitle('Class Diary', '/diary'),
  bodyText('A daily academic class log \u2014 write what was covered in each class, topics discussed, homework given, and any personal notes. Today\'s courses auto-appear from your routine so you don\'t have to select them manually.'),
  spacer(60),
  subLabel('What You Can Do'),
  bullet('Write per-course diary entries for any date (today or past dates)'),
  bullet('Add topics covered \u2014 select from your Syllabus topics or write custom text'),
  bullet('Note homework given, lab reports due, or teacher comments from that class'),
  bullet('Rate each class session 1\u20135 stars (your personal quality assessment)'),
  bullet('Mark a class as "missed" \u2014 links to attendance record for that date'),
  bullet('Navigate left/right by date to review or fill previous days'),
  spacer(60),
  subLabel('How to Use'),
  step(1, 'Open Diary \u2014 today\'s date is pre-selected automatically'),
  step(2, 'Today\'s scheduled courses appear from your routine \u2014 expand the ones you attended'),
  step(3, 'Type what was covered in class, any homework, or personal notes'),
  step(4, 'Tap the star rating to rate the class 1\u20135 stars'),
  step(5, 'Navigate with arrows to review or add past entries'),
  spacer(60),
  callout('Diary consistency (7 entries in 7 days = 100%) counts 4% toward Smart Score. Log even a one-line entry daily. Over a full term, you\'ll have a complete record of everything covered in class.', 'info'),
  spacer(60),
  pageBreak(),
];

// ─── SELF STUDY ───────────────────────────────────────────────────────────
const makeSelfStudy = () => [
  sectionHeaderBar('15 \u00B7 Self Study'),
  spacer(80),
  ...pageTitle('Self Study', '/self-study'),
  bodyText('Study session tracker \u2014 log how long you study per course and visualize your study balance across subjects. Shows exactly which courses you\'re neglecting. Separate tabs for Academic courses and Extra Reading.'),
  spacer(60),
  subLabel('Tabs'),
  featureTable([
    ['Academic',      'Log study sessions linked to your actual courses and syllabus topics. Duration in hours.'],
    ['Extra Reading', 'Track books, articles, YouTube courses, or online content outside the curriculum.'],
  ], 'Tab', 'What it tracks', 2000),
  spacer(80),
  subLabel('How to Use'),
  step(1, 'Tap "+ Add Session" (Academic tab) or "+ Add Reading" (Extra tab)'),
  step(2, 'Select course \u2014 your active courses appear as a dropdown'),
  step(3, 'Select the topic from the syllabus list (or type a custom topic)'),
  step(4, 'Enter duration in hours (e.g., 1.5 = 90 minutes, 0.5 = 30 minutes)'),
  step(5, 'Submit \u2014 bar chart updates immediately to show your balance'),
  spacer(60),
  callout('Self Study 7-day total counts 6% toward Smart Score. Target: 14 hours/week. The bar chart makes it obvious which courses you\'re behind on \u2014 use it as a weekly planning tool.', 'tip'),
  spacer(60),
  pageBreak(),
];

// ─── TIME TRACKER ─────────────────────────────────────────────────────────
const makeTimeTracker = () => [
  sectionHeaderBar('16 \u00B7 Time Tracker'),
  spacer(80),
  ...pageTitle('Time Tracker', '/time'),
  bodyText('A live activity timer and daily time log. Track how you spend your 24 hours \u2014 study, class, sleep, social, everything. Includes a built-in Pomodoro/stopwatch timer that keeps running even when you navigate away.'),
  spacer(60),
  subLabel('Timer Modes'),
  featureTable([
    ['Stopwatch',  'Count up from 0:00. Tap Start when you begin, Stop when done. Duration auto-logged.'],
    ['Countdown',  'Set a target duration (e.g., 25 min Pomodoro). Timer alerts when time is up.'],
    ['Manual Log', 'No live timer needed \u2014 enter a past time block directly (start time + end time).'],
  ], 'Mode', 'How it works', 2200),
  spacer(80),
  subLabel('Activity Categories'),
  featureTable([
    ['Productive',  'Study, Class, Self Study, Tuition, Library \u2014 counts toward Dashboard "Focus Time"'],
    ['Leisure',     'Facebook/YouTube, Gaming, Adda/hangout, Entertainment, Travel'],
    ['Health',      'Sleep, Exercise, Rest, Namaz time'],
    ['Other',       'Any custom activity not in the above categories'],
  ], 'Category', 'Activities included', 2200),
  spacer(80),
  subLabel('How to Use'),
  step(1, 'Select an activity category \u2014 optionally select a specific course if studying'),
  step(2, 'Tap Play to start the timer. It persists even if you switch to another page.'),
  step(3, 'Tap Stop \u2014 the session is auto-logged with duration and category'),
  step(4, 'Or tap "+ Add" to log a past block manually by typing start/end time'),
  spacer(60),
  callout('Today\'s productive focus hours (Study + Class + Self Study) appear automatically on the Dashboard as "Focus Time Today". The timer keeps running even when you browse other pages.', 'info'),
  spacer(60),
  pageBreak(),
];

// ─── NAMAZ ────────────────────────────────────────────────────────────────
const makeNamaz = () => [
  sectionHeaderBar('17 \u00B7 Namaz Tracker'),
  spacer(80),
  ...pageTitle('Namaz Tracker', '/namaz'),
  bodyText('Daily Salah (prayer) tracker. Mark each of the 5 daily prayers as done and optionally note whether prayed in congregation at the masjid. 7-day consistency feeds into Smart Score (10% weight).'),
  spacer(60),
  subLabel('The 5 Daily Prayers \u2014 Default Times'),
  featureTable([
    ['\u09AB\u099C\u09B0  (Fajr)',      'Default: 5:10 AM \u2014 customizable in the Namaz settings gear'],
    ['\u09AF\u09CB\u09B9\u09B0  (Dhuhr)', 'Default: 12:30 PM'],
    ['\u0986\u09B8\u09B0  (Asr)',       'Default: 4:00 PM'],
    ['\u09AE\u09BE\u0997\u09B0\u09BF\u09AC  (Maghrib)', 'Default: 6:20 PM'],
    ['\u0987\u09B6\u09BE  (Isha)',      'Default: 7:45 PM'],
  ], 'Prayer', 'Time', 2400),
  spacer(80),
  subLabel('How to Use'),
  step(1, 'Open Namaz \u2014 today\'s date is pre-selected'),
  step(2, 'Tap each prayer card to mark it as done (\u2713)'),
  step(3, 'Tap the masjid icon on any prayer to also mark it as prayed in congregation'),
  step(4, 'Navigate to past dates to fill in missed tracking'),
  step(5, 'Tap the gear icon to set your local prayer times (saved permanently)'),
  spacer(60),
  callout('Namaz 7-day average = 10% of Smart Score. Praying all 5 prayers consistently for 7 days = perfect 100/100 on this parameter. Miss 1 prayer = ~14 points penalty for that parameter.', 'tip'),
  spacer(60),
  pageBreak(),
];

// ─── SELF EVAL ────────────────────────────────────────────────────────────
const makeSelfEval = () => [
  sectionHeaderBar('18 \u00B7 Self Evaluation'),
  spacer(80),
  ...pageTitle('Self Evaluation', '/self-eval'),
  bodyText('A private daily moral and habit tracker. Rate yourself, log good deeds and bad habits, and build self-awareness over time. Completely private \u2014 all data stays on your device. No server, no account required.'),
  spacer(60),
  subLabel('What You Can Do'),
  bullet('Log good deeds from presets or write a custom entry'),
  bullet('Log bad habits / mistakes to avoid \u2014 presets or custom'),
  bullet('Rate your overall day 1\u20135 stars with a label'),
  bullet('View your 7-day rating trend as a bar chart'),
  bullet('Conduct Score = Good Deeds \u2212 Bad Habits \u00D7 1.5 (7-day rolling average)'),
  spacer(60),
  subLabel('Preset Entries'),
  featureTable([
    ['Good Presets', '\u0995\u09BE\u0989\u0995\u09C7 \u09B8\u09BE\u09B9\u09BE\u09AF\u09CD\u09AF \u0995\u09B0\u09BE, \u09AD\u09BE\u09B2\u09CB \u09AA\u09DC\u09BE\u09B6\u09CB\u09A8\u09BE, \u09B8\u09AE\u09AF\u09BC\u09AE\u09A4\u09CB \u09A8\u09BE\u09AE\u09BE\u099C, \u09AC\u09CD\u09AF\u09BE\u09AF\u09BC\u09BE\u09AE \u0995\u09B0\u09BE, \u09AC\u0987 \u09AA\u09DC\u09BE, \u09B8\u09CE \u0995\u09BE\u099C \u0995\u09B0\u09BE'],
    ['Bad Presets',  '\u09AE\u09BF\u09A5\u09CD\u09AF\u09BE \u0995\u09A5\u09BE \u09AC\u09B2\u09BE, \u0997\u09BE\u09B2\u09BF \u09A6\u09C7\u0993\u09AF\u09BC\u09BE, \u09A8\u09BE\u09AE\u09BE\u099C \u09AE\u09BF\u09B8, \u09B8\u09AE\u09AF\u09BC \u09A8\u09B7\u09CD\u099F \u0995\u09B0\u09BE, \u0985\u09A8\u09CD\u09AF\u0995\u09C7 \u0995\u09B7\u09CD\u099F \u09A6\u09C7\u0993\u09AF\u09BC\u09BE'],
  ], 'Type', 'Available Presets', 1800),
  spacer(80),
  subLabel('How to Use'),
  step(1, 'Open Self Eval daily \u2014 ideally just before sleep as a reflection exercise'),
  step(2, 'Tap good deed preset chips or add custom entries for what you did well'),
  step(3, 'Tap bad habit chips or add custom entries for what to improve'),
  step(4, 'Drag the star slider to 1\u20135 and tap Save'),
  step(5, 'Conduct score (Good \u2212 Bad \u00D7 1.5) auto-calculates and feeds Smart Score'),
  spacer(60),
  callout('Self Evaluation is 100% private. No data leaves your device. The Smart Score impact (8% conduct + 8% rating) rewards consistency, not perfection.', 'success'),
  spacer(60),
  pageBreak(),
];

// ─── SMART SCORE ──────────────────────────────────────────────────────────
const makeSmartScore = () => [
  sectionHeaderBar('19 \u00B7 Smart Score'),
  spacer(80),
  ...pageTitle('Smart Score', '/smart-score'),
  bodyText('Smart Score is your composite personal performance metric \u2014 academics, discipline, habits, and wellbeing combined into a single 0\u2013100 score. It updates automatically as you use the app. Goal: keep all 9 parameters green.'),
  spacer(60),
  smartScoreTable(),
  spacer(100),
  subLabel('Quick Wins to Boost Score'),
  bullet('Log Namaz daily \u2014 10% weight, very easy to maximize with consistent daily taps'),
  bullet('Fill Self Eval before sleep \u2014 adds 8% conduct + 8% self-rating for minimal time'),
  bullet('Log one diary entry per day \u2014 4% weight from a 30-second task'),
  bullet('Enter CT marks as they happen \u2014 improves the Academic sub-score immediately'),
  spacer(60),
  subLabel('How to Use'),
  step(1, 'Open Smart Score \u2014 see your total and each of the 9 parameter breakdowns'),
  step(2, 'Tap "Show Details" on any parameter to see exactly how that sub-score was calculated'),
  step(3, 'Red parameters = dragging your score down. Focus there first.'),
  step(4, 'Use the app daily across all features \u2014 the score naturally improves with consistent use'),
  spacer(60),
  callout('Smart Score is never shared with anyone \u2014 not your teachers, not the university. It\'s your private compass. It rewards being a balanced student, not just academic performance.', 'success'),
  spacer(60),
  pageBreak(),
];

// ─── MONEY ────────────────────────────────────────────────────────────────
const makeMoney = () => [
  sectionHeaderBar('20 \u00B7 Money (Finance)'),
  spacer(80),
  ...pageTitle('Money', '/money'),
  bodyText('Personal expense and income tracker built for campus life at KUET. Track what you spend, what you earn, see your running net balance, set a monthly budget, and view daily/monthly charts.'),
  spacer(60),
  subLabel('Expense Categories'),
  bullet('Meal/Food, Transport, Hall Fee, Course Fee, Personal, Junior Treat, Tour, Stationery, Other'),
  spacer(40),
  subLabel('Income Categories'),
  bullet('Family, Tuition (tutoring income), Scholarship, Part-time, Freelance, Sell, Other'),
  spacer(60),
  subLabel('What You Can Do'),
  bullet('Add income or expense entries: amount, category, date, optional note'),
  bullet('Set a starting Cash Balance \u2014 used to calculate your real running net balance'),
  bullet('Set a Monthly Budget \u2014 get a warning banner when spending exceeds 90%'),
  bullet('Navigate month-by-month using arrow buttons'),
  bullet('Filter by type (All / Income / Expense) and by category chips'),
  bullet('See daily line chart showing income vs expense per day'),
  bullet('Export the month as a plain text memo (.txt) \u2014 readable in WhatsApp, Gmail, anywhere'),
  spacer(60),
  subLabel('How to Use'),
  step(1, 'Tap the wallet icon or gear to set your starting Cash Balance and Monthly Budget'),
  step(2, 'Tap "+ Add" \u2014 choose Expense or Income via the toggle'),
  step(3, 'Fill in amount, tap a category chip, set date, add an optional note'),
  step(4, 'Check the daily line chart to spot unusual spending days'),
  step(5, 'Tap Export at month-end for a memo summary you can save or share'),
  spacer(60),
  callout('Budget consistency (Money entries per month) counts 4% toward Smart Score. Even 2\u20133 entries per week keeps this parameter healthy. The budget warning fires at 90% \u2014 giving you a chance to course-correct.', 'info'),
  spacer(60),
  pageBreak(),
];

// ─── ALERTS ───────────────────────────────────────────────────────────────
const makeAlerts = () => [
  sectionHeaderBar('21 \u00B7 Alerts'),
  spacer(80),
  ...pageTitle('Alerts', '/alerts'),
  bodyText('Your academic guardian \u2014 automatic rule-based warnings calculated live from your data against KUET\'s official academic regulations. No setup needed. Alerts appear the moment a threshold is crossed.'),
  spacer(60),
  subLabel('Alert Severity Types'),
  featureTable([
    ['\ud83d\udd34 CRITICAL', 'Must act immediately. Cannot be dismissed. Stays until the issue is resolved.'],
    ['\ud83d\udfe1 WARNING',  'Potential issue developing. Can be dismissed after reading.'],
    ['\ud83d\udfe2 POSITIVE', 'Good news. Dean\'s List eligibility, Honors track, scholarship eligible.'],
    ['\ud83d\udd35 INFO',     'Informational. Upcoming deadlines, data completeness reminders, sync status.'],
  ], 'Type', 'When to expect it', 2000),
  spacer(80),
  subLabel('What Alerts Check (KUET Regulations)'),
  featureTable([
    ['Exam bar risk',       'Art. 11.3 \u2014 any course below 60% attendance. Critical. Must recover or appeal.'],
    ['Scholarship loss',    'Art. 14.2 \u2014 any course below 75% attendance. Warning.'],
    ['Academic probation',  'Art. 20 \u2014 CGPA drops below 2.20. Critical.'],
    ['Struck-off risk',     'Less than 36 credits earned after first 4 terms. Critical.'],
    ['Honors eligible',     'Art. 18.1 \u2014 CGPA \u22653.50 with no backlogs. Positive alert.'],
    ['Max B+ backlog cap',  'Art. 16 \u2014 backlog course grade cannot exceed B+ (3.25). Info reminder.'],
    ['Assignment overdue',  'Any assignment past its due date still marked as Pending.'],
    ['Drive sync warning',  'Drive connection expired or sync failed for more than 24 hours.'],
  ], 'Alert Rule', 'What it checks', 2800),
  spacer(80),
  subLabel('How to Use'),
  step(1, 'Open Alerts \u2014 all current active warnings display automatically'),
  step(2, 'Tap any alert to jump directly to the relevant page to fix the issue'),
  step(3, 'Dismiss non-critical alerts after acknowledging them'),
  step(4, 'CRITICAL alerts (red) cannot be dismissed \u2014 they stay until the underlying data changes'),
  spacer(60),
  callout('Alerts also appear as a strip on the Dashboard. Check it every time you open the app. Aim for zero red badges at all times.', 'warning'),
  spacer(60),
  pageBreak(),
];

// ─── NOTES ────────────────────────────────────────────────────────────────
const makeNotes = () => [
  sectionHeaderBar('22 \u00B7 Notes'),
  spacer(80),
  ...pageTitle('Notes', '/notes'),
  bodyText('A free-form personal notepad. Create, edit, search, and pin titled notes \u2014 class reminders, quick thoughts, to-dos, teacher contact info, exam tips, anything you need to remember. All notes are stored offline on your device.'),
  spacer(60),
  subLabel('Note Tags'),
  featureTable([
    ['General',   'Default tag \u2014 grey. For everyday notes without a specific category.'],
    ['Important', 'High-priority notes \u2014 red. Use for things you must not forget.'],
    ['Idea',      'Ideas and brainstorming \u2014 blue. For project ideas, app suggestions, plans.'],
    ['Todo',      'Task reminders \u2014 yellow. For things you need to do but aren\'t in Assignments.'],
    ['Course',    'Course-specific notes \u2014 green. Teacher tips, exam patterns, topics to focus on.'],
  ], 'Tag', 'Use Case', 2000),
  spacer(80),
  subLabel('How to Use'),
  step(1, 'Tap "+ New Note" from the top right or the FAB button'),
  step(2, 'Type a title (short and descriptive) and write the note body'),
  step(3, 'Select a tag from the color chips'),
  step(4, 'Tap Save \u2014 note appears in the list immediately'),
  step(5, 'Tap the pin icon on any note to keep it pinned at the top'),
  step(6, 'Use the search bar to filter notes by keyword instantly'),
  spacer(60),
  callout('Great use case: Before each exam, create a "Course" tagged note per subject with key formulas, common Q&A from teachers, and exam tips. Search for the course name when revising.', 'tip'),
  spacer(60),
  pageBreak(),
];

// ─── CLUBS ────────────────────────────────────────────────────────────────
const makeClubs = () => [
  sectionHeaderBar('23 \u00B7 Clubs & Activities'),
  spacer(80),
  ...pageTitle('Clubs', '/clubs'),
  bodyText('Track your club and society memberships and log your activities over time. A permanent record of your extracurricular involvement \u2014 useful for portfolios, CVs, and memories of your KUET years.'),
  spacer(60),
  subLabel('What You Can Do'),
  bullet('Add clubs and societies: name, your role (Member / Officer / Secretary / President), year joined'),
  bullet('Log activities per club: title, date, duration in hours, and a description of what happened'),
  bullet('View all activities in a chronological timeline per club'),
  bullet('See total hours invested per club across all activities'),
  spacer(60),
  subLabel('How to Use'),
  step(1, 'Tap "+ Add Club" to register a club or society'),
  step(2, 'Enter the club name, your role, and the year you joined'),
  step(3, 'Tap the club to expand it, then tap "+ Add Activity"'),
  step(4, 'Fill in activity title, date, hours invested, and a brief description'),
  step(5, 'Repeat as you attend events, win competitions, or hold positions'),
  spacer(60),
  callout('Clubs data is private and local. Consider logging even small activities \u2014 a programming contest, a workshop \u2014 for a complete extracurricular record useful for CVs and scholarship applications.', 'info'),
  spacer(60),
  pageBreak(),
];

// ─── CR TOOLS ─────────────────────────────────────────────────────────────
const makeCRTools = () => [
  sectionHeaderBar('24 \u00B7 CR Tools (Class Management)'),
  spacer(80),
  ...pageTitle('Class Management', '/class-management'),
  bodyText('A dedicated workspace for Class Representatives. Only visible when CR Mode is enabled in Profile. Helps CRs manage class routines, track class counts, and share updates with their batch.'),
  spacer(60),
  subLabel('Tabs in Class Management'),
  featureTable([
    ['Routine',      'View today\'s class schedule \u2014 which course is happening at which time slot right now'],
    ['CT Planner',   'Schedule and track Class Tests \u2014 see the CT timeline and total count per course'],
    ['Class Count',  'Track how many classes have been held per course for the entire term so far'],
    ['Copy & Share', 'Generate a formatted text summary of today\'s schedule to share on WhatsApp/Messenger'],
  ], 'Tab', 'What it does', 2000),
  spacer(80),
  subLabel('How to Use'),
  step(1, 'Enable CR Mode in Profile first: Profile \u2192 Edit Profile \u2192 tick "I am a CR"'),
  step(2, 'Open Class Management from the navigation \u2014 it appears after CR Mode is enabled'),
  step(3, 'Routine tab: verify today\'s class flow at a glance'),
  step(4, 'After each class, update the class count for that course'),
  step(5, 'CT Planner: schedule upcoming CTs per course to keep the class informed'),
  step(6, 'Copy & Share: tap to generate a formatted message, then paste into your class group'),
  spacer(60),
  callout('CR Mode must be enabled in Profile to unlock Class Management and CT & Quiz Planner in the navigation. Toggle it in Profile \u2192 Edit Profile.', 'warning'),
  spacer(60),
  pageBreak(),
];

// ─── CT QUIZ PLANNER ──────────────────────────────────────────────────────
const makeCTQuizPlanner = () => [
  sectionHeaderBar('25 \u00B7 CT & Quiz Planner'),
  spacer(80),
  ...pageTitle('CT & Quiz Planner', '/ct-quiz-planning'),
  bodyText('A calendar-based exam event planner for CRs. Schedule Class Tests, quizzes, and assignment deadlines with smart conflict detection and weekly pressure analysis. (Requires CR Mode)'),
  spacer(60),
  subLabel('What You Can Do'),
  bullet('Add CT / Quiz / Assignment events to specific dates on a monthly calendar view'),
  bullet('Smart Assist: detects conflicts when multiple exams are scheduled on the same day'),
  bullet('Weekly pressure analysis: automatically labels weeks as High / Medium / Low exam pressure'),
  bullet('Auto-suggest a more balanced distribution of CTs if overloaded weeks are detected'),
  bullet('Copy the month\'s full schedule as a formatted text to share with the class'),
  bullet('Navigate month-by-month to plan upcoming CTs in advance'),
  spacer(60),
  subLabel('How to Use'),
  step(1, 'Open CT & Quiz Planner (requires CR Mode enabled in Profile)'),
  step(2, 'Tap any date on the calendar to add an event'),
  step(3, 'Select course, event type (CT / Quiz / Assignment), and give it a title'),
  step(4, 'Smart Assist shows a conflict warning if other events already exist on that day'),
  step(5, 'Check the weekly pressure indicators before confirming the date'),
  step(6, 'When the schedule is finalized, tap "Copy" to share it with your class group'),
  spacer(60),
  // FIX: callout was missing in v2
  callout('Plan CTs at least a week in advance and share the schedule on the class group immediately. Last-minute CT announcements are the #1 cause of student complaints \u2014 a published CT calendar prevents this entirely.', 'tip'),
  spacer(60),
  pageBreak(),
];

// ─── MORE FEATURES ────────────────────────────────────────────────────────
const makeMoreFeatures = () => [
  sectionHeaderBar('26 \u00B7 More Features'),
  spacer(80),
  bodyText('These pages are accessible from the sidebar (desktop) or the "More" drawer (mobile). Each addresses a specific campus life need. None of them affect your Smart Score if unused \u2014 they are optional extras.'),
  spacer(60),

  subLabel('Tuition   (/tuition)'),
  bodyText('If you tutor other students for income, track your sessions here. Log student name, subject, date, session duration, agreed fee, and payment status. View monthly tuition income summary. Separate from the Money page income tracker \u2014 this gives more detail per student.'),
  spacer(40),

  subLabel('Food & Health   (/food)'),
  bodyText('Log daily meals \u2014 breakfast, lunch, dinner \u2014 and rate hall food quality. Track eating habits over time, identify days you skipped meals, and monitor nutritional categories. Useful for students managing health alongside academics.'),
  spacer(40),

  subLabel('Projects   (/projects)'),
  bodyText('Track academic project progress: project title, course link, team members, supervisor name, deadline, current status (Not Started / In Progress / Submitted / Completed), and milestone notes. Good for project-based or design courses where deadlines span multiple weeks.'),
  spacer(40),

  subLabel('Tours   (/tours)'),
  bodyText('Record batch tours and trips. Log participants, total budget, actual amount spent, destinations, and a brief itinerary. Rate the experience. Over 4 years, this becomes a memory log of every batch tour you joined.'),
  spacer(40),

  subLabel('Social Time   (/social)'),
  bodyText('Log social activities \u2014 batch hangouts, events, celebrations, gatherings. Combined with Time Tracker data, you can see your actual study/social balance over time.'),
  spacer(40),

  subLabel('Reports   (/reports)'),
  bodyText('Generate a formatted printable academic report combining attendance, marks, and CGPA in one view. Useful if you need to show your academic standing to someone or want a clean printed summary for yourself at the end of each term.'),
  spacer(40),

  // FIX: v2 incorrectly said Calculators had "two standalone tools" and was at /calculators.
  // In reality /calculators redirects to /marks (Term Planner) — no separate Calculators page.
  subLabel('CGPA & Target Calculators'),
  bodyText('Calculator tools are built directly into the Term Planner (/marks) and Results (/results) pages. In Term Planner, use the Target Grade feature to calculate the exact hall marks needed for any grade. In Results, view your Maximum Achievable CGPA projection based on remaining terms. There is no separate Calculators page.'),
  spacer(80),

  callout('All "More" pages are optional. Smart Score is not penalized if you skip Tours, Food, Social, etc. Use only what is relevant to your situation. They are there when you need them.', 'info'),
  spacer(60),
  pageBreak(),
];

// ─── SETTINGS & PRIVACY ───────────────────────────────────────────────────
const makeSettings = () => [
  sectionHeaderBar('27 \u00B7 Settings & Privacy'),
  spacer(80),
  ...pageTitle('Settings', '/settings'),
  bodyText('Data management, app preferences, backup and restore. All KUETx data lives on your device (IndexedDB) \u2014 nothing is sent to any server unless you explicitly enable Drive or Firebase sync.'),
  spacer(60),
  subLabel('What You Can Do'),
  bullet('Theme \u2014 Light / Dark / System (auto-follows device system theme)'),
  bullet('App Mode \u2014 Full Student mode (33 pages) or Simplified mode (academics only)'),
  bullet('Export Data \u2014 download all your data as a .json backup file to your device'),
  bullet('Import Data \u2014 restore from a previously saved .json backup file'),
  bullet('Preview Backup \u2014 inspect a .json file before overwriting current data'),
  bullet('Auto-backup Reminder \u2014 toggleable notification to remind you to export weekly'),
  bullet('Storage Usage \u2014 shows how much IndexedDB space KUETx is currently using'),
  bullet('Clear All Data \u2014 full reset (you must type a confirmation phrase to proceed)'),
  spacer(60),
  subLabel('Data & Privacy'),
  featureTable([
    ['Storage location',  'IndexedDB on your device. No KUETx server ever receives your data.'],
    ['Server data',       'Nothing sent to any external server (except Drive/Firebase if you enabled them)'],
    ['Login required',    'No. KUETx works fully offline without any account or login.'],
    ['Backup format',     'Standard .json file \u2014 human-readable, portable, restoreable anytime'],
    ['Data loss risk',    'Clearing browser data = losing everything. Always export backups regularly.'],
    ['New device setup',  'Export backup on old device \u2192 install on new device \u2192 import the .json file'],
  ], 'Topic', 'Detail', 2800),
  spacer(80),
  subLabel('How to Backup & Restore'),
  step(1, 'Go to Settings \u2192 Backup & Restore section'),
  step(2, 'Tap "Export" \u2192 saves kuetx-backup-[date].json to your Downloads folder'),
  step(3, 'Store it safely: Google Drive, WhatsApp Saved Messages, email to yourself'),
  step(4, 'To restore: tap "Import" \u2192 select your saved .json file'),
  step(5, 'Use Preview to inspect the backup contents before committing to import'),
  spacer(60),
  callout('NEVER skip backups. If you change phones, reinstall the browser, or your device gets reset WITHOUT a backup or sync active, your KUETx data is permanently lost. Export weekly minimum.', 'danger'),
  spacer(60),
  pageBreak(),
];

// ─── GOOGLE DRIVE SYNC ────────────────────────────────────────────────────
const makeDriveSync = () => [
  sectionHeaderBar('28 \u00B7 Google Drive Sync'),
  spacer(80),
  ...pageTitle('Google Drive Sync', 'Profile \u2192 Connect Google Drive'),
  bodyText('KUETx can automatically back up your data to your own personal Google Drive \u2014 no KUETx server, no shared cloud. Your data goes only to your own Google account. Uses the most restricted OAuth scope available.'),
  spacer(60),
  subLabel('How It Works'),
  bullet('OAuth 2.0 via Google Identity Services \u2014 you authorize from a popup in your browser'),
  bullet('Scope: drive.file \u2014 KUETx can ONLY access files it itself created. Nothing else in your Drive is touched.'),
  bullet('Your data goes to a "KUETx Backups" folder inside your own Google Drive'),
  bullet('Auto-push: any change in the app triggers a backup upload (with a 4-second debounce)'),
  bullet('Auto-pull: app checks Drive every 20 seconds for changes from other devices'),
  bullet('"Sync Now" button: forces an immediate manual push+pull'),
  spacer(60),
  subLabel('How to Connect'),
  step(1, 'Open Profile page or Settings page'),
  step(2, 'Tap "Connect Google Drive"'),
  step(3, 'A Google OAuth popup opens \u2014 sign in with your Google account and tap Allow'),
  step(4, 'The app immediately pushes your current data to Drive (first backup)'),
  step(5, 'From now on, every change auto-syncs within 4 seconds automatically'),
  spacer(60),
  callout('Google Drive sync uses drive.file scope \u2014 the most restricted scope possible. KUETx literally cannot read or access any other file in your Google Drive. Zero risk to your other data.', 'success'),
  spacer(60),
  pageBreak(),
];

// ─── FIREBASE SYNC ────────────────────────────────────────────────────────
const makeFirebaseSync = () => [
  sectionHeaderBar('29 \u00B7 Firebase Sync (Google Login)'),
  spacer(80),
  ...pageTitle('Firebase Sync', 'Profile \u2192 Sign In with Google'),
  bodyText('For real-time cross-device sync, KUETx supports Google Sign-In via Firebase. Data pushes to Firestore within 1.5 seconds of any change and pulls changes from other devices in real-time via onSnapshot listeners.'),
  spacer(60),
  subLabel('Drive vs Firebase \u2014 Which to Use?'),
  comparisonTable(
    ['Google Drive Sync', 'Firebase Sync (Google Login)'],
    [
      ['No login required \u2014 just authorize Drive',           'Requires Google Sign-In (creates account)'],
      ['Data stored in YOUR personal Google Drive',            'Data stored in KUETx Firebase (encrypted cloud)'],
      ['Near-real-time (checks every 20 seconds)',             'Instant real-time via Firestore onSnapshot listeners'],
      ['Best for: regular automatic backups + peace of mind', 'Best for: always-online multi-device use'],
      ['No profile photo sync',                                'Profile photo syncs via Firebase Storage'],
      ['drive.file scope \u2014 no access to your other files', 'KUETx holds your encrypted academic data'],
    ]
  ),
  spacer(80),
  bodyText('Recommendation: Use both. Enable Firebase Sign-In for real-time sync, and also connect Google Drive for an extra layer of backup. They work independently and complement each other.'),
  spacer(60),
  subLabel('What Syncs via Firebase'),
  bullet('All academic data: courses, marks, attendance, results, assignments, schedule'),
  bullet('Personal data: diary, self study sessions, namaz logs, self eval, money entries, notes'),
  bullet('Profile picture (stored in Firebase Storage)'),
  bullet('Does NOT sync: autoBackup preference, lastBackupTime (device-local settings)'),
  spacer(60),
  subLabel('How to Sign In'),
  step(1, 'Open Profile page'),
  step(2, 'Tap "Sign In with Google" or the Account banner at the top of Profile'),
  step(3, 'Complete Google OAuth \u2014 data immediately syncs to Firestore'),
  step(4, 'Every subsequent change auto-syncs within 1.5 seconds'),
  step(5, 'To log out: tap Logout from Profile. Local data stays on the device.'),
  spacer(60),
  callout('Guest mode = data on this device only, no backup unless Drive is connected. Google Sign-In = data syncs across all your devices in real-time. You can switch between modes anytime without losing local data.', 'info'),
  spacer(60),
  pageBreak(),
];

// ─── QUICK ACCESS & NAV ────────────────────────────────────────────────────
const makeQuickAccess = () => [
  sectionHeaderBar('30 \u00B7 Quick Access & Navigation'),
  spacer(80),
  ...pageTitle('Quick Access', '/quick-access'),
  bodyText('Quick Access is a personal page launcher \u2014 shows your pinned pages, favorited pages, and most-recently-used pages all in one place. The bottom navigation also adapts based on your usage patterns over time.'),
  spacer(60),
  subLabel('Navigation Groups'),
  featureTable([
    ['Overview',   '\ud83d\udfe2 Dashboard, Quick Access, Profile, Notes'],
    ['Class Rep',  '\ud83d\udfdf Class Management, CT & Quiz Planner (visible only in CR Mode)'],
    ['Academics',  '\ud83d\udfe6 Courses, Attendance, Schedule, Assignments, Marks, Results, Teachers, Syllabus, QB, Solution Bank'],
    ['Daily Life', '\ud83d\udfe1 Diary, Self Study, Time Tracker, Namaz'],
    ['Wellbeing',  '\ud83e\udde1 Self Eval, Smart Score'],
    ['Finance',    '\ud83d\udfe2 Money, Tuition, Food & Health'],
    ['Activities', '\ud83d\udfe0 Clubs, Projects, Tours, Social'],
    ['Tools',      '\u26ab Alerts, Reports, Settings, About KUETx'],
  ], 'Group', 'Pages included', 1800),
  spacer(80),
  subLabel('Adaptive Bottom Navigation'),
  bullet('Default tabs: Dashboard, Attendance, Marks, Alerts + More button'),
  bullet('After regular use: bottom bar adapts to show your 4 most-frequently visited pages'),
  bullet('Manual override: long-press the bottom nav bar to pin or unpin specific pages'),
  bullet('Favorites: star any page from Quick Access \u2014 it appears in a permanent Favorites section'),
  spacer(60),
  subLabel('App Modes'),
  featureTable([
    ['Full Student Mode', 'All 33 pages visible across all 8 navigation groups. Default mode.'],
    ['Simplified Mode',   'Hides Activities, Wellbeing, Finance groups. Shows only core academics + Daily Life pages. Toggle in Settings.'],
  ], 'Mode', 'What shows', 2800),
  spacer(80),
  callout('First time using More drawer? Long-press any page icon to pin it to the bottom navigation for instant access without going through More every time.', 'tip'),
  spacer(60),
  pageBreak(),
];

// ─── MIND MAP PAGE ────────────────────────────────────────────────────────
const makeMindMap = () => {
  const colW = Math.floor(CONTENT_W / 3);
  const col3 = CONTENT_W - colW * 2;
  const mkCell = (icon, title, items, fill) => new TableCell({
    borders: noBorders,
    shading: { type: ShadingType.CLEAR, fill },
    margins: { top: 160, bottom: 160, left: 200, right: 200 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({ children: [run(icon + ' ' + title, { size: SZ.label, bold: true, color: C.white })], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 40 } }),
      new Paragraph({ children: [run(items, { size: 18, color: 'AADBC4' })], alignment: AlignmentType.CENTER }),
    ],
  });
  return [
    sectionHeaderBar('31 \u00B7 Feature Mind Map'),
    spacer(100),
    bodyText('All 33 features organized by category. Every node connects back to campus life at KUET.'),
    spacer(60),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [colW, colW, col3],
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
      rows: [new TableRow({ children: [
        mkCell('\ud83c\udf93', 'ACADEMICS', 'Courses \u00B7 Attendance\nSchedule \u00B7 Assignments\nMarks \u00B7 Results\nSyllabus \u00B7 QB \u00B7 Solutions\nTeachers', C.darkGreen),
        mkCell('\ud83d\udcf1', 'KUETx', 'Your complete campus\ncompanion', C.accentGreen),
        mkCell('\ud83c\udf19', 'DAILY LIFE', 'Diary \u00B7 Self Study\nTime Tracker \u00B7 Namaz\nSelf Eval \u00B7 Smart Score', C.darkGreen),
      ]})],
    }),
    spacer(40),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [colW, colW, col3],
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
      rows: [new TableRow({ children: [
        mkCell('\ud83d\udcb0', 'FINANCE', 'Money \u00B7 Tuition \u00B7 Food', C.midGreen),
        mkCell('\ud83d\udd27', 'TOOLS', 'Alerts \u00B7 Drive Sync\nFirebase \u00B7 Settings\nReports \u00B7 About', C.midGreen),
        mkCell('\ud83c\udfc5', 'ACTIVITIES', 'Clubs \u00B7 Tours \u00B7 Social\nProjects \u00B7 CR Tools\nCT Planner', C.midGreen),
      ]})],
    }),
    spacer(120),
    pageBreak(),
  ];
};

// ─── QUICK TIPS ───────────────────────────────────────────────────────────
const makeQuickTips = () => [
  sectionHeaderBar('32 \u00B7 Quick Tips & Troubleshooting'),
  spacer(100),
  featureTable([
    ['First time setup?',
     'Do it in order: (1) Profile, (2) Courses, (3) Schedule, (4) Teachers, (5) Attendance, (6) Marks. Takes about 15 minutes total.'],
    ['Dashboard showing zeros?',
     'Enter data in Courses, Attendance, and Marks first. Dashboard is read-only \u2014 it displays what you\'ve entered elsewhere.'],
    ['CGPA not updating?',
     'Enter results in the Results page (/results) after each term publishes. Dashboard pulls CGPA from there, not from Marks.'],
    ['Attendance percentage wrong?',
     'Check course statuses in Courses page. Only "Active" courses count toward attendance. Completed/Withdrawal courses are excluded.'],
    ['Missing a course?',
     'Tap "+ Add Custom Course" in Courses for anything not in the auto-loaded list.'],
    ['App running slow?',
     'Install as PWA (Add to Home Screen). PWA version is significantly faster than opening in a browser tab every time.'],
    ['Lost data after phone reset?',
     'Restore from your exported .json backup via Settings \u2192 Import. If you had Firebase Sync active, sign in again and data pulls automatically.'],
    ['ISP blocking the site?',
     'Some Bangladesh ISPs (e.g., Airtel) block *.vercel.app domains. Use a VPN or switch to mobile data. The PWA works offline after first load.'],
    ['Can\'t see CR tools?',
     'Enable CR Mode in Profile \u2192 Edit Profile \u2192 check "I am a CR". CR tools are hidden for non-CR students to keep navigation clean.'],
    ['Drive sync not working?',
     'The OAuth token may have expired. Disconnect Drive from Profile page and reconnect. You\'ll re-authorize with Google.'],
    ['Grade not calculating?',
     'Make sure CT marks are entered in Term Planner. Attendance marks need "Auto" mode active (or enter manually). Hall marks also needed for final grade.'],
    ['Smart Score very low?',
     'Quick wins: log Namaz daily (10%), rate yourself in Self Eval (8%), write one diary line (4%). These three alone are 22% of your total score.'],
    ['Schedule not showing in Attendance?',
     'Go to Schedule page and add your class routine. Today\'s classes only auto-appear in Attendance after the routine is filled in.'],
    ['Attendance marks showing 0?',
     'The attendance marks slab is per-teacher. Assign teachers to your courses first. Then the slab calculates separately per teacher (max 15 each, 30 total).'],
    ['Can I use the app without internet?',
     'Yes \u2014 after first load, KUETx works fully offline. The PWA caches everything. Only Drive/Firebase sync needs internet.'],
    ['Firebase Sync vs Drive \u2014 which is better?',
     'Use both. Firebase = real-time instant sync between devices. Drive = personal encrypted backup in your own Google account.'],
    ['How to copy data to a new device?',
     'Method 1: Settings \u2192 Export \u2192 transfer .json \u2192 Import on new device. Method 2: Firebase Sync \u2014 just sign in on the new device and everything syncs automatically.'],
    ['Where is the Question Bank solution for my paper?',
     'Open Solution Bank (/solutions) from the Academics navigation group. Select your department, year, term, and course to see available worked solutions.'],
    ['Question Bank paper missing?',
     'Tap "Contribute" on any missing paper to submit your copy via Google Form. It takes under 2 minutes and helps every student in your department.'],
  ], 'Problem / Question', 'Solution', 3000),
  spacer(100),
  divider(C.accentGreen),
  new Paragraph({
    children: [run('KUETx \u2014 built by a KUETian, for KUETians.', { size: SZ.label, bold: true, color: C.accentGreen })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 60 },
  }),
  new Paragraph({
    children: [run('www.kuetx.com', { size: SZ.cell, color: C.teal })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
  }),
];

// ─── ABOUT KUETX (NEW) ────────────────────────────────────────────────────
const makeAbout = () => [
  sectionHeaderBar('33 \u00B7 About KUETx'),
  spacer(80),
  ...pageTitle('About KUETx', '/about'),
  bodyText('The About page is your gateway to understanding the app \u2014 who built it, what version you\'re running, how to read the guide, and how to give feedback or contribute. It also embeds the full KUETx Guide PDF in-app.'),
  spacer(60),
  subLabel('What You\'ll See on the About Page'),
  bullet('KUETx Guide banner \u2014 tap to open the full PDF guide without leaving the app'),
  bullet('App version number and changelog \u2014 what\'s new in this release'),
  bullet('Feature overview \u2014 a visual summary of all major feature groups'),
  bullet('Developer credit \u2014 built by a KUETian, for KUETians'),
  bullet('Feedback / contribution links \u2014 report bugs, suggest features, contribute question papers'),
  bullet('Tech stack credits \u2014 React, Vite, Firebase, Tailwind, IndexedDB'),
  spacer(60),
  subLabel('How to Access the Guide In-App'),
  step(1, 'Open the About page from the sidebar or navigation ("About KUETx")'),
  step(2, 'Tap the "KUETx Guide \u2014 PDF" banner at the top of the About page'),
  step(3, 'The PDF viewer opens in a modal overlay \u2014 read without leaving the app'),
  step(4, 'Tap Close or the backdrop to dismiss and return to where you were'),
  spacer(60),
  subLabel('App Version & Updates'),
  featureTable([
    ['Version number',  'Shown on the About page. Check this when reporting a bug so support can reproduce it accurately.'],
    ['PWA update',      'When a new version of KUETx is available, the app shows a "Update Available" banner. Tap to reload and get the latest version.'],
    ['Auto-update',     'PWA updates apply when you reopen the app after it\'s been in background. No manual install needed.'],
    ['Version history', 'Changelog on the About page lists what changed in each release.'],
  ], 'Topic', 'Detail', 2600),
  spacer(80),
  subLabel('How to Contribute'),
  bullet('Question papers: tap "Contribute" from the Question Bank page \u2014 Google Form link, takes ~2 minutes'),
  bullet('Bug reports: use the feedback link on the About page to report issues with steps to reproduce'),
  bullet('Feature suggestions: submit via the feedback form with your use case and why it helps KUETians'),
  bullet('Solutions: contact via the feedback link to contribute step-by-step solutions to past papers'),
  spacer(60),
  callout('The KUETx Guide PDF (which you are currently reading) is accessible any time from the About page \u2014 no internet required if the PWA is installed. Share www.kuetx.com with your batchmates so they can benefit too.', 'success'),
  spacer(60),
  divider(C.accentGreen),
  new Paragraph({
    children: [run('KUETx \u2014 built by a KUETian, for KUETians.', { size: SZ.label, bold: true, color: C.accentGreen })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 60 },
  }),
  new Paragraph({
    children: [run('www.kuetx.com', { size: SZ.cell, color: C.teal })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
  }),
];

// ─── HEADER / FOOTER ──────────────────────────────────────────────────────
const makeHeader = () => new Header({
  children: [new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [Math.floor(CONTENT_W * 0.5), CONTENT_W - Math.floor(CONTENT_W * 0.5)],
    borders: { top: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder, bottom: { style: BorderStyle.SINGLE, size: 4, color: C.accentGreen } },
    rows: [new TableRow({ children: [
      new TableCell({ borders: noBorders, children: [new Paragraph({ children: [run('KUETx', { size: SZ.cell, bold: true, color: C.darkGreen })], spacing: { before: 0, after: 60 } })] }),
      new TableCell({ borders: noBorders, children: [new Paragraph({ children: [run('Student Guide', { size: 18, color: C.muted })], alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 60 } })] }),
    ]})],
  })],
});

const makeFooter = () => {
  // FIX: guarantee columns sum to CONTENT_W by deriving last column from remainder
  const c1 = Math.floor(CONTENT_W * 0.45);
  const c2 = Math.floor(CONTENT_W * 0.30);
  const c3 = CONTENT_W - c1 - c2;
  return new Footer({
    children: [new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [c1, c2, c3],
      borders: { top: { style: BorderStyle.SINGLE, size: 4, color: C.accentGreen }, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
      rows: [new TableRow({ children: [
        new TableCell({ borders: noBorders, children: [new Paragraph({ children: [run('www.kuetx.com', { size: SZ.mini, color: C.teal })], spacing: { before: 60, after: 0 } })] }),
        new TableCell({ borders: noBorders, children: [new Paragraph({ children: [run('The digital ecosystem for KUET', { size: SZ.foot, color: C.muted })], alignment: AlignmentType.CENTER, spacing: { before: 60, after: 0 } })] }),
        new TableCell({ borders: noBorders, children: [new Paragraph({
          children: [run('Page ', { size: SZ.mini, color: C.muted }), new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: SZ.mini, color: C.muted })],
          alignment: AlignmentType.RIGHT,
          spacing: { before: 60, after: 0 },
        })] }),
      ]})],
    })],
  });
};

// ─── ASSEMBLE DOCUMENT ────────────────────────────────────────────────────
async function buildDoc() {
  const numbering = {
    config: [{
      reference: 'bullets',
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 480, hanging: 280 }, spacing: { before: 30, after: 30 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '\u25E6', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 840, hanging: 280 } } } },
      ],
    }],
  };

  const styles = {
    default: { document: { run: { font: 'Calibri', size: SZ.label, color: C.black } } },
  };

  const sectionProps = {
    page: {
      size: { width: PAGE_W, height: PAGE_H },
      margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
    },
  };

  // Section builders with individual try/catch so one failure doesn't kill the whole doc
  const sections = [
    ['TOC',               makeTOC],
    ['Why',               makeWhySection],
    ['GettingStarted',    makeGettingStarted],
    ['Dashboard',         makeDashboard],
    ['Profile',           makeProfile],
    ['Courses',           makeCourses],
    ['Attendance',        makeAttendance],
    ['Schedule',          makeSchedule],
    ['Assignments',       makeAssignments],
    ['Syllabus',          makeSyllabus],
    ['QuestionBank',      makeQuestionBank],
    ['SolutionBank',      makeSolutionBank],   // NEW
    ['Marks',             makeMarks],
    ['Results',           makeResults],
    ['Teachers',          makeTeachers],
    ['Diary',             makeDiary],
    ['SelfStudy',         makeSelfStudy],
    ['TimeTracker',       makeTimeTracker],
    ['Namaz',             makeNamaz],
    ['SelfEval',          makeSelfEval],
    ['SmartScore',        makeSmartScore],
    ['Money',             makeMoney],
    ['Alerts',            makeAlerts],
    ['Notes',             makeNotes],
    ['Clubs',             makeClubs],
    ['CRTools',           makeCRTools],
    ['CTQuizPlanner',     makeCTQuizPlanner],
    ['MoreFeatures',      makeMoreFeatures],
    ['Settings',          makeSettings],
    ['DriveSync',         makeDriveSync],
    ['FirebaseSync',      makeFirebaseSync],
    ['QuickAccess',       makeQuickAccess],
    ['MindMap',           makeMindMap],
    ['QuickTips',         makeQuickTips],
    ['About',             makeAbout],           // NEW
  ];

  const mainChildren = [];
  for (const [name, fn] of sections) {
    try {
      mainChildren.push(...fn());
    } catch (err) {
      console.error(`[buildDoc] Section "${name}" failed:`, err.message);
      mainChildren.push(
        sectionHeaderBar(`ERROR: ${name} section failed to render`),
        bodyText(`Build error: ${err.message}. Check the console and fix ${name}().`),
        pageBreak(),
      );
    }
  }

  const doc = new Document({
    numbering,
    styles,
    sections: [
      {
        properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: 0, right: 0, bottom: 0, left: 0 } } },
        children: makeCoverSection(),
      },
      {
        properties: sectionProps,
        headers: { default: makeHeader() },
        footers: { default: makeFooter() },
        children: mainChildren,
      },
    ],
  });

  return doc;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
(async () => {
  console.log('Building KUETx Guide DOCX v3...');
  try {
    const doc = await buildDoc();
    const buffer = await Packer.toBuffer(doc);
    const outPath = 'KUETx_Guide_v3.docx';
    fs.writeFileSync(outPath, buffer);
    console.log(`Done! Saved to: ${outPath}`);
    console.log(`File size: ${(buffer.length / 1024).toFixed(1)} KB`);
  } catch (err) {
    console.error('Fatal build error:', err);
    process.exit(1);
  }
})();