# KUETx Question Bank — Developer Guide

## Overview

KUET has **16 departments**. The question bank currently has paper metadata for **14 departments**
(from the uploaded JSON). Two departments — Civil Engineering (CE) and Chemical Engineering (ChE) —
are **placeholders** with commented-out entries, ready to be filled in.

---

## All 16 Departments

| # | Code  | Department                                       | Status |
|---|-------|--------------------------------------------------|--------|
| 1 | ARCH  | Architecture                                     | ✅ Data |
| 2 | BME   | Biomedical Engineering                           | ✅ Data |
| 3 | BECM  | Building Engineering & Construction Management  | ✅ Data |
| 4 | CE    | Civil Engineering                                | ⏳ Placeholder |
| 5 | ChE   | Chemical Engineering                             | ⏳ Placeholder |
| 6 | CSE   | Computer Science & Engineering                   | ✅ Data |
| 7 | EEE   | Electrical & Electronic Engineering              | ✅ Data |
| 8 | ECE   | Electronics & Communication Engineering          | ✅ Data |
| 9 | ESE   | Energy Science & Engineering                     | ✅ Data |
|10 | IPE   | Industrial Engineering & Management              | ✅ Data |
|11 | LE    | Leather Engineering                              | ✅ Data |
|12 | MSE   | Materials Science & Engineering                  | ✅ Data |
|13 | ME    | Mechanical Engineering                           | ✅ Data |
|14 | MTE   | Mechatronics Engineering                         | ✅ Data |
|15 | TE    | Textile Engineering                              | ✅ Data |
|16 | URP   | Urban & Regional Planning                        | ✅ Data |

---

## File Storage Layout

```
public/
└── questions/
    ├── ESE/
    │   ├── Y1T1/
    │   │   ├── Regular_2017.pdf
    │   │   ├── Regular_2018.pdf
    │   │   └── ...
    │   ├── Y2T1/
    │   │   └── Regular_2022.pdf
    │   └── Y2T0/          ← year-level backlog (term 0)
    │       └── Backlog_2018.pdf
    ├── CSE/
    │   └── ...
    └── ...
```

**Pattern:** `public/questions/{DEPT}/Y{year}T{term}/{ExamType}_{examYear}.pdf`

- `term = 0` means a year-level backlog (not tied to 1st or 2nd term)
- ExamType in filename: `Regular` | `Backlog` | `Special_Backlog` | `Online`

---

## How to Add a New Question Paper (Step-by-Step)

### Step 1 — Convert and place the PDF

If you have a `.pdf.zst` file, decompress it first:
```bash
zstd -d "filename.pdf.zst" -o "Regular_2023.pdf"
```

Place the PDF:
```
public/questions/ESE/Y2T1/Regular_2023.pdf
```

### Step 2 — Set `available: true` in overrides

Open `src/data/questionbank/questionBankData.js`, find `QB_OVERRIDES`, and add:

```js
const QB_OVERRIDES = {
  'ESE_Y2T1_Regular_2023': { available: true, addedAt: '2025-05-21' },
};
```

The ID format is: `{DEPT}_Y{year}T{term}_{ExamType}_{examYear}`
- Spaces in ExamType are replaced with `_`
- Example: `ME_Y4T0_Special_Backlog_2023`

### Step 3 — Verify in app

Open the Question Bank page, filter by the department, and the paper should show a green ✓ with a Download button.

---

## How to Add a New Department (CE or ChE)

### Step 1 — Uncomment the placeholder entries

In `questionBankData.js`, find the CE or ChE section and uncomment the `makeEntries` lines,
adding the exam years from the department's question papers:

```js
// BEFORE (placeholder):
// ...makeEntries('CE', 1, 1, 'B.Sc. Engg', []),

// AFTER (filled in):
...makeEntries('CE', 1, 1, 'B.Sc. Engg', [2015, 2016, 2017, 2018]),
```

### Step 2 — Add to curriculum (optional)

If you also want the full curriculum data (course list, syllabus) for CE/ChE, create:
```
src/data/curriculum/departments/CE/
```
following the same structure as existing departments (e.g., `ESE/`).

### Step 3 — Update departments/index.js

Add an import and export in `src/data/curriculum/departments/index.js`.

---

## Exam Types Reference

| examType        | Folder slug      | When used |
|-----------------|------------------|-----------|
| Regular         | `Regular`        | Normal semester exam |
| Backlog         | `Backlog`        | Year-level backlog |
| Special Backlog | `Special_Backlog`| Special backlog |
| Online          | `Online`         | COVID-era online exam |

---

## ID Format

```
{DEPT}_Y{year}T{term}_{ExamType_slug}_{examYear}
```

Examples:
- `ESE_Y1T1_Regular_2023`
- `ME_Y4T0_Special_Backlog_2022`
- `ARCH_Y5T0_Backlog_2023`
- `ME_Y2T2_Online_2020`

---

## QB_OVERRIDES Cheatsheet

```js
const QB_OVERRIDES = {
  // Single paper
  'ESE_Y2T1_Regular_2023': { available: true, addedAt: '2025-05-21' },

  // With a note
  'CSE_Y3T2_Regular_2019': { available: true, addedAt: '2025-06-01', note: 'Contributed by batch 19' },
};
```

---

## Contribution Flow

Students contribute via the **Contribute** button → Google Form.
Admin reviews, converts `.pdf.zst` → `.pdf`, places in `public/questions/`, then adds override.
