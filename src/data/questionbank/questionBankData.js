/**
 * KUETx Question Bank Data
 * Total departments: 16 (14 with uploaded data + 2 placeholders)
 *
 * ─── HOW TO ADD NEW PAPERS ────────────────────────────────────────────────
 * 1. Place the PDF in:
 *      public/questions/{DEPT}/Y{year}T{term}/{ExamType}_{examYear}.pdf
 *    Example: public/questions/ESE/Y2T1/Regular_2023.pdf
 *
 * 2. Set available: true in QB_OVERRIDES (bottom of this file):
 *      'ESE_Y2T1_Regular_2023': { available: true, addedAt: '2025-05-21' }
 *
 * ─── FILE NAMING RULES ────────────────────────────────────────────────────
 *   ExamType values: Regular | Backlog | Special_Backlog | Online
 *   Term 0 = year-level backlog (not tied to a specific term)
 *
 * ─── ADDING A NEW DEPARTMENT ─────────────────────────────────────────────
 * 1. Add dept code + full name to QB_DEPARTMENTS below
 * 2. Add makeEntries() lines in the RAW_QB array under the correct dept
 * 3. Add code mapping in QB_DEPT_CODE_MAP
 * 4. See QUESTION_BANK_GUIDE.md for full reference
 *
 * ─── DEPT CODES ──────────────────────────────────────────────────────────
 *   ARCH  Architecture
 *   BME   Biomedical Engineering
 *   BECM  Building Engineering & Construction Management
 *   CE    Civil Engineering           ← placeholder, no data yet
 *   ChE   Chemical Engineering        ← placeholder, no data yet
 *   CSE   Computer Science & Engineering
 *   EEE   Electrical & Electronic Engineering
 *   ECE   Electronics & Communication Engineering
 *   ESE   Energy Science & Engineering
 *   IPE   Industrial Engineering & Management
 *   LE    Leather Engineering
 *   MSE   Materials Science & Engineering
 *   ME    Mechanical Engineering
 *   MTE   Mechatronics Engineering
 *   TE    Textile Engineering
 *   URP   Urban & Regional Planning
 */

// ─────────────────────────────────────────────────────────────────────────────
// DEPARTMENT MAP  (all 16 KUET departments)
// ─────────────────────────────────────────────────────────────────────────────
export const QB_DEPARTMENTS = {
  ARCH: 'Department of Architecture',
  BME:  'Department of Biomedical Engineering',
  BECM: 'Department of Building Engineering and Construction Management',
  CE:   'Department of Civil Engineering',         // placeholder — no data yet
  ChE:  'Department of Chemical Engineering',       // placeholder — no data yet
  CSE:  'Department of Computer Science and Engineering',
  EEE:  'Department of Electrical and Electronic Engineering',
  ECE:  'Department of Electronics and Communication Engineering',
  ESE:  'Department of Energy Science and Engineering',
  IPE:  'Department of Industrial Engineering and Management',
  LE:   'Department of Leather Engineering',
  MSE:  'Department of Materials Science and Engineering',
  ME:   'Department of Mechanical Engineering',
  MTE:  'Department of Mechatronics Engineering',
  TE:   'Department of Textile Engineering',
  URP:  'Department of Urban and Regional Planning',
};

// ─────────────────────────────────────────────────────────────────────────────
// YEAR-TERM LABEL HELPER
// ─────────────────────────────────────────────────────────────────────────────
export function ytLabel(year, term) {
  const yMap = ['', '1st', '2nd', '3rd', '4th', '5th'];
  const tMap = ['', '1st', '2nd'];
  if (term === 0) return `${yMap[year] || year} Year Backlog`;
  return `${yMap[year] || year} Year ${tMap[term] || term} Term`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
function makeEntries(dept, year, term, degree, examYears, examType = 'Regular') {
  const typeSlug = examType.replace(/\s+/g, '_');
  return examYears.map(ey => ({
    id: `${dept}_Y${year}T${term}_${typeSlug}_${ey}`,
    dept,
    deptName: QB_DEPARTMENTS[dept] || dept,
    year,          // academic year (1–5)
    term,          // 1 | 2 | 0 = backlog (not term-specific)
    examYear: ey,  // calendar year of the exam paper
    examType,      // Regular | Backlog | Special Backlog | Online
    degree,        // B.Sc. Engg | B. Arch
    // Relative to /public/:
    filePath: `questions/${dept}/Y${year}T${term}/${typeSlug}_${ey}.pdf`,
    available: false,  // flip to true via QB_OVERRIDES once PDF is in place
    addedAt: null,
  }));
}

import { QB_GENERATED_OVERRIDES } from './generatedQuestionBankAvailability.js';

// ─────────────────────────────────────────────────────────────────────────────
// QB OVERRIDES
// Generated availability is merged with any hand-maintained overrides.
// ─────────────────────────────────────────────────────────────────────────────
const QB_OVERRIDES = {
  ...QB_GENERATED_OVERRIDES,
  // 'ESE_Y2T1_Regular_2023': { available: true, addedAt: '2025-05-21' },
};

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION BANK — ALL 16 DEPARTMENTS
// ─────────────────────────────────────────────────────────────────────────────
const RAW_QB = [

  // ══════════════════════════════════════════════════════════════════════════
  // 1. ARCHITECTURE (ARCH)
  //    Source: Department of Architecture — JSON verified
  // ══════════════════════════════════════════════════════════════════════════
  ...makeEntries('ARCH', 1, 1, 'B. Arch', [2017, 2018, 2019, 2023]),
  ...makeEntries('ARCH', 1, 2, 'B. Arch', [2017, 2018, 2019, 2022, 2023]),
  ...makeEntries('ARCH', 2, 1, 'B. Arch', [2018, 2019, 2023]),
  ...makeEntries('ARCH', 2, 2, 'B. Arch', [2018, 2019, 2022]),
  ...makeEntries('ARCH', 3, 1, 'B. Arch', [2019, 2023]),
  ...makeEntries('ARCH', 3, 2, 'B. Arch', [2019, 2022]),
  ...makeEntries('ARCH', 4, 1, 'B. Arch', [2023]),
  ...makeEntries('ARCH', 4, 2, 'B. Arch', [2022]),
  ...makeEntries('ARCH', 5, 1, 'B. Arch', [2023]),
  // Backlog
  ...makeEntries('ARCH', 1, 0, 'B. Arch', [2017, 2018, 2022],       'Backlog'),
  ...makeEntries('ARCH', 1, 0, 'B. Arch', [2022],                   'Special Backlog'),
  ...makeEntries('ARCH', 2, 0, 'B. Arch', [2022],                   'Backlog'),
  ...makeEntries('ARCH', 2, 0, 'B. Arch', [2022],                   'Special Backlog'),
  ...makeEntries('ARCH', 3, 0, 'B. Arch', [2022],                   'Backlog'),
  ...makeEntries('ARCH', 3, 0, 'B. Arch', [2022],                   'Special Backlog'),
  ...makeEntries('ARCH', 4, 0, 'B. Arch', [2022],                   'Backlog'),
  ...makeEntries('ARCH', 5, 0, 'B. Arch', [2022],                   'Backlog'),
  ...makeEntries('ARCH', 5, 0, 'B. Arch', [2023],                   'Special Backlog'),

  // ══════════════════════════════════════════════════════════════════════════
  // 2. BIOMEDICAL ENGINEERING (BME)
  //    Source: Department of Biomedical Engineering — JSON verified
  // ══════════════════════════════════════════════════════════════════════════
  ...makeEntries('BME', 1, 1, 'B.Sc. Engg', [2015,2016,2017,2018,2019,2020,2021,2022,2023]),
  ...makeEntries('BME', 1, 2, 'B.Sc. Engg', [2015,2016,2017,2018,2019,2020,2021,2022,2023]),
  ...makeEntries('BME', 2, 1, 'B.Sc. Engg', [2016,2017,2018,2019,2020,2021,2022,2023]),
  ...makeEntries('BME', 2, 2, 'B.Sc. Engg', [2016,2017,2018,2019,2020,2021,2022]),
  ...makeEntries('BME', 3, 1, 'B.Sc. Engg', [2017,2018,2019,2020,2021,2022,2023]),
  ...makeEntries('BME', 3, 2, 'B.Sc. Engg', [2017,2018,2019,2020,2021,2022]),
  ...makeEntries('BME', 4, 1, 'B.Sc. Engg', [2018,2019,2020,2021,2022,2023]),
  ...makeEntries('BME', 4, 2, 'B.Sc. Engg', [2018,2019,2020,2021,2022]),

  // ══════════════════════════════════════════════════════════════════════════
  // 3. BUILDING ENGINEERING & CONSTRUCTION MANAGEMENT (BECM)
  //    Source: Department of Building Engineering and Construction Management — JSON verified
  // ══════════════════════════════════════════════════════════════════════════
  ...makeEntries('BECM', 1, 1, 'B.Sc. Engg', [2015,2016,2017,2018,2019]),
  ...makeEntries('BECM', 1, 2, 'B.Sc. Engg', [2015,2016,2017,2018]),
  ...makeEntries('BECM', 2, 1, 'B.Sc. Engg', [2015,2016,2017,2018,2019]),
  ...makeEntries('BECM', 2, 2, 'B.Sc. Engg', [2015,2017,2018]),
  ...makeEntries('BECM', 3, 1, 'B.Sc. Engg', [2016,2017,2018,2019]),
  ...makeEntries('BECM', 3, 2, 'B.Sc. Engg', [2016,2017,2018]),
  ...makeEntries('BECM', 4, 1, 'B.Sc. Engg', [2017,2018,2019]),
  ...makeEntries('BECM', 4, 2, 'B.Sc. Engg', [2017,2018]),

  // ══════════════════════════════════════════════════════════════════════════
  // 4. CIVIL ENGINEERING (CE)
  //    ⚠ PLACEHOLDER — no question papers uploaded yet.
  //    Structure mirrors other 4-year B.Sc. Engg departments.
  //    Add year ranges and examYears below once papers are available,
  //    then set available: true in QB_OVERRIDES after placing PDFs.
  // ══════════════════════════════════════════════════════════════════════════
  // ...makeEntries('CE', 1, 1, 'B.Sc. Engg', []),  // add years when available
  // ...makeEntries('CE', 1, 2, 'B.Sc. Engg', []),
  // ...makeEntries('CE', 2, 1, 'B.Sc. Engg', []),
  // ...makeEntries('CE', 2, 2, 'B.Sc. Engg', []),
  // ...makeEntries('CE', 3, 1, 'B.Sc. Engg', []),
  // ...makeEntries('CE', 3, 2, 'B.Sc. Engg', []),
  // ...makeEntries('CE', 4, 1, 'B.Sc. Engg', []),
  // ...makeEntries('CE', 4, 2, 'B.Sc. Engg', []),

  // ══════════════════════════════════════════════════════════════════════════
  // 5. CHEMICAL ENGINEERING (ChE)
  //    ⚠ PLACEHOLDER — no question papers uploaded yet.
  //    Same format as other 4-year B.Sc. Engg departments.
  // ══════════════════════════════════════════════════════════════════════════
  // ...makeEntries('ChE', 1, 1, 'B.Sc. Engg', []),
  // ...makeEntries('ChE', 1, 2, 'B.Sc. Engg', []),
  // ...makeEntries('ChE', 2, 1, 'B.Sc. Engg', []),
  // ...makeEntries('ChE', 2, 2, 'B.Sc. Engg', []),
  // ...makeEntries('ChE', 3, 1, 'B.Sc. Engg', []),
  // ...makeEntries('ChE', 3, 2, 'B.Sc. Engg', []),
  // ...makeEntries('ChE', 4, 1, 'B.Sc. Engg', []),
  // ...makeEntries('ChE', 4, 2, 'B.Sc. Engg', []),

  // ══════════════════════════════════════════════════════════════════════════
  // 6. COMPUTER SCIENCE & ENGINEERING (CSE)
  //    Source: Department of Computer Science and Engineering — JSON verified
  // ══════════════════════════════════════════════════════════════════════════
  ...makeEntries('CSE', 1, 1, 'B.Sc. Engg', [2015,2016,2017,2018,2019]),
  ...makeEntries('CSE', 1, 2, 'B.Sc. Engg', [2015,2016,2017,2018]),
  ...makeEntries('CSE', 2, 1, 'B.Sc. Engg', [2015,2016,2017,2018,2019]),
  ...makeEntries('CSE', 2, 2, 'B.Sc. Engg', [2015,2016,2017,2018]),
  ...makeEntries('CSE', 3, 1, 'B.Sc. Engg', [2015,2016,2017,2018,2019]),
  ...makeEntries('CSE', 3, 2, 'B.Sc. Engg', [2015,2016,2017,2018]),
  ...makeEntries('CSE', 4, 1, 'B.Sc. Engg', [2015,2016,2017,2018,2019]),
  ...makeEntries('CSE', 4, 2, 'B.Sc. Engg', [2015,2016,2017,2018]),

  // ══════════════════════════════════════════════════════════════════════════
  // 7. ELECTRICAL & ELECTRONIC ENGINEERING (EEE)
  //    Source: Department of Electrical and Electronic Engineering — JSON verified
  // ══════════════════════════════════════════════════════════════════════════
  ...makeEntries('EEE', 1, 1, 'B.Sc. Engg', [2017]),
  ...makeEntries('EEE', 1, 2, 'B.Sc. Engg', [2016,2017,2018]),
  ...makeEntries('EEE', 2, 1, 'B.Sc. Engg', [2017]),
  ...makeEntries('EEE', 2, 2, 'B.Sc. Engg', [2016,2017,2018]),
  ...makeEntries('EEE', 3, 1, 'B.Sc. Engg', [2017,2018]),
  ...makeEntries('EEE', 3, 2, 'B.Sc. Engg', [2016,2017,2018]),
  ...makeEntries('EEE', 4, 1, 'B.Sc. Engg', [2017,2018]),
  ...makeEntries('EEE', 4, 2, 'B.Sc. Engg', [2016,2017,2018]),
  // Backlog
  ...makeEntries('EEE', 0, 0, 'B.Sc. Engg', [2018], 'Special Backlog'),  // EE 2211
  ...makeEntries('EEE', 0, 0, 'B.Sc. Engg', [2018], 'Special Backlog'),  // EE 3113

  // ══════════════════════════════════════════════════════════════════════════
  // 8. ELECTRONICS & COMMUNICATION ENGINEERING (ECE)
  //    Source: Department of Electronics and Communication Engineering — JSON verified
  // ══════════════════════════════════════════════════════════════════════════
  ...makeEntries('ECE', 1, 1, 'B.Sc. Engg', [2016,2017,2018,2019]),
  ...makeEntries('ECE', 1, 2, 'B.Sc. Engg', [2015,2016,2017,2018]),
  ...makeEntries('ECE', 2, 1, 'B.Sc. Engg', [2015,2016,2017,2018,2019]),
  ...makeEntries('ECE', 2, 2, 'B.Sc. Engg', [2015,2016,2017,2018]),
  ...makeEntries('ECE', 3, 1, 'B.Sc. Engg', [2015,2016,2017,2018,2019]),
  ...makeEntries('ECE', 3, 2, 'B.Sc. Engg', [2015,2016,2017,2018]),
  ...makeEntries('ECE', 4, 1, 'B.Sc. Engg', [2015,2016,2017,2018,2019]),
  ...makeEntries('ECE', 4, 2, 'B.Sc. Engg', [2015,2016,2017,2018]),

  // ══════════════════════════════════════════════════════════════════════════
  // 9. ENERGY SCIENCE & ENGINEERING (ESE)
  //    Source: Department of Energy Science and Engineering — JSON verified
  // ══════════════════════════════════════════════════════════════════════════
  ...makeEntries('ESE', 1, 1, 'B.Sc. Engg', [2017,2018,2019,2020,2021,2022,2023]),
  ...makeEntries('ESE', 1, 2, 'B.Sc. Engg', [2017,2018,2019,2020,2021,2022,2023]),
  ...makeEntries('ESE', 2, 1, 'B.Sc. Engg', [2018,2019,2020,2021,2022,2023]),
  ...makeEntries('ESE', 2, 2, 'B.Sc. Engg', [2018,2019,2021,2022]),
  ...makeEntries('ESE', 3, 1, 'B.Sc. Engg', [2019,2020,2021,2022,2023]),
  ...makeEntries('ESE', 3, 2, 'B.Sc. Engg', [2019,2020,2021,2022]),
  ...makeEntries('ESE', 4, 1, 'B.Sc. Engg', [2020,2021,2022,2023]),
  ...makeEntries('ESE', 4, 2, 'B.Sc. Engg', [2020,2021,2022]),
  // Backlog
  ...makeEntries('ESE', 2, 0, 'B.Sc. Engg', [2018], 'Backlog'),

  // ══════════════════════════════════════════════════════════════════════════
  // 10. INDUSTRIAL ENGINEERING & MANAGEMENT (IPE)
  //     Source: Department of Industrial Engineering and Management — JSON verified
  // ══════════════════════════════════════════════════════════════════════════
  ...makeEntries('IPE', 1, 1, 'B.Sc. Engg', [2015,2016,2017,2018,2019]),
  ...makeEntries('IPE', 1, 2, 'B.Sc. Engg', [2015,2017,2018]),
  ...makeEntries('IPE', 2, 1, 'B.Sc. Engg', [2015,2017,2018,2019]),
  ...makeEntries('IPE', 2, 2, 'B.Sc. Engg', [2015,2016,2017,2018]),
  ...makeEntries('IPE', 3, 1, 'B.Sc. Engg', [2015,2016,2017,2018,2019]),
  ...makeEntries('IPE', 3, 2, 'B.Sc. Engg', [2015,2016,2017]),
  ...makeEntries('IPE', 4, 1, 'B.Sc. Engg', [2015,2016,2017,2018,2019]),
  ...makeEntries('IPE', 4, 2, 'B.Sc. Engg', [2015,2016,2017,2018]),
  // Backlog
  ...makeEntries('IPE', 4, 0, 'B.Sc. Engg', [2018], 'Special Backlog'),

  // ══════════════════════════════════════════════════════════════════════════
  // 11. LEATHER ENGINEERING (LE)
  //     Source: Department of Leather Engineering — JSON verified
  // ══════════════════════════════════════════════════════════════════════════
  ...makeEntries('LE', 1, 1, 'B.Sc. Engg', [2020,2021,2022]),
  ...makeEntries('LE', 1, 2, 'B.Sc. Engg', [2019,2021,2022]),
  ...makeEntries('LE', 2, 1, 'B.Sc. Engg', [2019,2020,2021,2023]),
  ...makeEntries('LE', 3, 1, 'B.Sc. Engg', [2019,2020,2021,2022,2023]),
  ...makeEntries('LE', 3, 2, 'B.Sc. Engg', [2019,2021,2022]),
  ...makeEntries('LE', 4, 1, 'B.Sc. Engg', [2019,2020,2021,2022,2023]),
  ...makeEntries('LE', 4, 2, 'B.Sc. Engg', [2019,2020,2021,2022]),
  // Backlog
  ...makeEntries('LE', 2, 0, 'B.Sc. Engg', [2021], 'Backlog'),
  ...makeEntries('LE', 3, 0, 'B.Sc. Engg', [2021], 'Backlog'),

  // ══════════════════════════════════════════════════════════════════════════
  // 12. MATERIALS SCIENCE & ENGINEERING (MSE)
  //     Source: Department of Materials Science and Engineering — JSON verified
  // ══════════════════════════════════════════════════════════════════════════
  ...makeEntries('MSE', 1, 1, 'B.Sc. Engg', [2017,2018,2019,2020,2021,2022]),
  ...makeEntries('MSE', 1, 2, 'B.Sc. Engg', [2017,2018,2020,2021,2023]),
  ...makeEntries('MSE', 2, 1, 'B.Sc. Engg', [2018,2019,2020,2021,2022,2023]),
  ...makeEntries('MSE', 2, 2, 'B.Sc. Engg', [2018,2020,2021]),
  ...makeEntries('MSE', 3, 1, 'B.Sc. Engg', [2019,2020,2021,2022,2023]),
  ...makeEntries('MSE', 3, 2, 'B.Sc. Engg', [2020,2021]),
  ...makeEntries('MSE', 4, 1, 'B.Sc. Engg', [2020,2021,2022,2023]),
  ...makeEntries('MSE', 4, 2, 'B.Sc. Engg', [2020,2021]),
  // Backlog
  ...makeEntries('MSE', 1, 0, 'B.Sc. Engg', [2018,2020], 'Backlog'),

  // ══════════════════════════════════════════════════════════════════════════
  // 13. MECHANICAL ENGINEERING (ME)
  //     Source: Department of Mechanical Engineering — JSON verified
  // ══════════════════════════════════════════════════════════════════════════
  ...makeEntries('ME', 1, 1, 'B.Sc. Engg', [2011,2012,2015,2017,2018,2019,2020,2021,2022,2023,2025]),
  ...makeEntries('ME', 1, 2, 'B.Sc. Engg', [2015,2017,2019,2021,2022,2024]),
  ...makeEntries('ME', 1, 2, 'B.Sc. Engg', [2020],                        'Online'),
  ...makeEntries('ME', 2, 1, 'B.Sc. Engg', [2017,2019,2020,2021,2022]),
  ...makeEntries('ME', 2, 1, 'B.Sc. Engg', [2020],                        'Online'),
  ...makeEntries('ME', 2, 2, 'B.Sc. Engg', [2016,2017,2018,2019,2021,2022,2024]),
  ...makeEntries('ME', 2, 2, 'B.Sc. Engg', [2020],                        'Online'),
  ...makeEntries('ME', 3, 1, 'B.Sc. Engg', [2017,2018,2021,2022,2024]),
  ...makeEntries('ME', 3, 1, 'B.Sc. Engg', [2020],                        'Online'),
  ...makeEntries('ME', 3, 2, 'B.Sc. Engg', [2018,2019,2021,2022]),
  ...makeEntries('ME', 4, 1, 'B.Sc. Engg', [2014,2015,2017,2018,2019,2021,2022,2024]),
  ...makeEntries('ME', 4, 1, 'B.Sc. Engg', [2020],                        'Online'),
  ...makeEntries('ME', 4, 2, 'B.Sc. Engg', [2012,2013,2014,2015,2016,2018,2019,2021,2022]),
  // Backlog
  ...makeEntries('ME', 3, 0, 'B.Sc. Engg', [2017,2018,2019,2021,2022],    'Backlog'),
  ...makeEntries('ME', 4, 0, 'B.Sc. Engg', [2014,2015,2017,2018,2019,2020,2021,2022], 'Backlog'),
  ...makeEntries('ME', 4, 0, 'B.Sc. Engg', [2016,2018,2019,2020,2021,2023],           'Special Backlog'),
  ...makeEntries('ME', 0, 0, 'B.Sc. Engg', [2023],                        'Special Backlog'),

  // ══════════════════════════════════════════════════════════════════════════
  // 14. MECHATRONICS ENGINEERING (MTE)
  //     Source: Department of Mechatronics Engineering — JSON verified
  // ══════════════════════════════════════════════════════════════════════════
  ...makeEntries('MTE', 1, 1, 'B.Sc. Engg', [2019,2020,2021,2022,2023]),
  ...makeEntries('MTE', 1, 2, 'B.Sc. Engg', [2020,2021,2022,2023]),
  ...makeEntries('MTE', 2, 1, 'B.Sc. Engg', [2020,2021,2022,2023]),
  ...makeEntries('MTE', 2, 2, 'B.Sc. Engg', [2020,2021,2022]),
  ...makeEntries('MTE', 3, 1, 'B.Sc. Engg', [2021,2022,2023]),
  ...makeEntries('MTE', 3, 2, 'B.Sc. Engg', [2021,2022]),
  ...makeEntries('MTE', 4, 1, 'B.Sc. Engg', [2022,2023]),

  // ══════════════════════════════════════════════════════════════════════════
  // 15. TEXTILE ENGINEERING (TE)
  //     Source: Department of Textile Engineering — JSON verified
  // ══════════════════════════════════════════════════════════════════════════
  ...makeEntries('TE', 1, 1, 'B.Sc. Engg', [2016,2017,2018,2019]),
  ...makeEntries('TE', 1, 2, 'B.Sc. Engg', [2015,2016,2017,2018]),
  ...makeEntries('TE', 2, 1, 'B.Sc. Engg', [2016,2017,2018,2019]),
  ...makeEntries('TE', 2, 2, 'B.Sc. Engg', [2016,2017,2018]),
  ...makeEntries('TE', 3, 1, 'B.Sc. Engg', [2016,2017,2018,2019]),
  ...makeEntries('TE', 3, 2, 'B.Sc. Engg', [2016,2017,2018]),
  ...makeEntries('TE', 4, 1, 'B.Sc. Engg', [2016,2017,2018,2019]),
  ...makeEntries('TE', 4, 2, 'B.Sc. Engg', [2016,2017,2018]),
  // Backlog
  ...makeEntries('TE', 1, 0, 'B.Sc. Engg', [2016,2018],          'Backlog'),
  ...makeEntries('TE', 2, 0, 'B.Sc. Engg', [2016,2017,2018],     'Backlog'),
  ...makeEntries('TE', 3, 0, 'B.Sc. Engg', [2016,2018],          'Backlog'),
  ...makeEntries('TE', 4, 0, 'B.Sc. Engg', [2016,2018],          'Backlog'),

  // ══════════════════════════════════════════════════════════════════════════
  // 16. URBAN & REGIONAL PLANNING (URP)
  //     Source: Department of Urban and Regional Planning — JSON verified
  // ══════════════════════════════════════════════════════════════════════════
  ...makeEntries('URP', 1, 1, 'B.Sc. Engg', [2014,2015,2016,2017,2018,2019,2020,2021,2022,2023]),
  ...makeEntries('URP', 1, 2, 'B.Sc. Engg', [2014,2015,2016,2017,2018,2019,2020,2021,2022,2023]),
  ...makeEntries('URP', 2, 1, 'B.Sc. Engg', [2014,2015,2016,2017,2018,2019,2020,2021,2022,2023]),
  ...makeEntries('URP', 2, 2, 'B.Sc. Engg', [2014,2015,2016,2017,2018,2019,2020,2021,2022]),
  ...makeEntries('URP', 3, 1, 'B.Sc. Engg', [2014,2015,2016,2017,2019,2020,2021,2022,2023]),
  ...makeEntries('URP', 3, 2, 'B.Sc. Engg', [2014,2015,2016,2017,2018,2019,2020,2021,2022]),
  ...makeEntries('URP', 4, 1, 'B.Sc. Engg', [2014,2015,2016,2018,2019,2020,2021,2022,2023]),
  ...makeEntries('URP', 4, 2, 'B.Sc. Engg', [2014,2015,2016,2017,2018,2019,2020,2021,2022]),

]; // ── END RAW_QB ────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// APPLY OVERRIDES
// ─────────────────────────────────────────────────────────────────────────────
export const QUESTION_BANK = RAW_QB.map(q => ({
  ...q,
  ...(QB_OVERRIDES[q.id] || {}),
}));

// ─────────────────────────────────────────────────────────────────────────────
// STATS HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export function getQBStats(dept = null) {
  const items = dept ? QUESTION_BANK.filter(q => q.dept === dept) : QUESTION_BANK;
  return {
    total: items.length,
    available: items.filter(q => q.available).length,
    depts: new Set(items.map(q => q.dept)).size,
    years: [...new Set(items.map(q => q.examYear))].sort(),
  };
}

export function getQBForDept(dept)           { return QUESTION_BANK.filter(q => q.dept === dept); }
export function getQBForTerm(dept, year, term){ return QUESTION_BANK.filter(q => q.dept === dept && q.year === year && q.term === term); }
export function hasQBForTerm(dept, year, term){ return QUESTION_BANK.some(q => q.dept === dept && q.year === year && q.term === term); }
export function getAvailableQB(dept = null)  {
  const items = dept ? QUESTION_BANK.filter(q => q.dept === dept) : QUESTION_BANK;
  return items.filter(q => q.available);
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPT CODE MAP  (curriculum dept code → QB dept code)
// ─────────────────────────────────────────────────────────────────────────────
export const QB_DEPT_CODE_MAP = {
  ESE: 'ESE', BME: 'BME', CSE: 'CSE', EEE: 'EEE', ECE: 'ECE',
  ME:  'ME',  MTE: 'MTE', MSE: 'MSE', IPE: 'IPE', LE:  'LE',
  URP: 'URP', TE:  'TE',  ARCH: 'ARCH', BECM: 'BECM',
  CE:  'CE',  ChE: 'ChE',
};
