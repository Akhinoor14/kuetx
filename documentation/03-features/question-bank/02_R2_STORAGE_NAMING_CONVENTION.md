# KUETx Question Bank — R2 Storage Convention

This is the **single source of truth** for how question-bank PDFs are named
and organized in the Cloudflare R2 bucket. Everything else (Worker, upload
form, review UI) follows this file.

## Bucket layout

```
kuetx-question-bank/                      (R2 bucket)
├── public/
│   └── {DEPT}/{TERM}/{CourseCode}/{Label}.pdf     ← LIVE, browsable, publicly readable
└── staging/
    └── {requestId}.pdf                            ← pending review, private, NOT public
```

- **`public/`** — served straight through the R2 public dev URL
  (`https://pub-cee9fbc08d344601be081906d1dcf3d3.r2.dev/public/...`) and is
  exactly what `useQuestionBankData()`'s Worker listing reads.
- **`staging/`** — where a Campus Lead's upload lands *immediately* on
  submit, before anyone has approved it. Never listed publicly. Cleared out
  automatically on approve (moved) or reject (deleted).

## Key format (must match `QB_DEPARTMENTS` casing exactly)

```
public/{DEPT}/{TERM}/{CourseCode}/{Label}.pdf
```

| Segment | Rule | Example |
|---|---|---|
| `DEPT` | Exact key from `QB_DEPARTMENTS` in `questionBankData.js` (case-sensitive) | `ARCH`, `BME`, `BECM`, `CE`, `ChE`, `CSE`, `EEE`, `ECE`, `ESE`, `IPE`, `LE`, `MSE`, `ME`, `MTE`, `TE`, `URP` |
| `TERM` | `Y{1-4}T{0-2}` — T0 = year-level backlog | `Y1T1`, `Y3T0` |
| `CourseCode` | Course code with **all whitespace stripped**, casing preserved exactly as in `QB_COURSE_CODES` / curriculum data | `CE1109`, `PHY1107`, `Ph1101` |
| `Label` | `{ExamType}_{examYear}` — this exact string becomes `paper.label` shown in the UI | `Regular_2023`, `Special_Backlog_2022` |

`ExamType` is one of: `Regular`, `Backlog`, `Special_Backlog`, `Online` — matching the
existing vocabulary in `questionBankData.js`. Free text is allowed but the
upload form should default to these four as a dropdown.

### Full example

```
public/ESE/Y2T1/ESE2101/Regular_2023.pdf
```

renders in-app as: **ESE → Y2T1 → ESE2101 → "Regular_2023"**

## ⚠️ One casing conflict to resolve before go-live

Three different casings for the same 16 depts currently exist in the repo:

| Source | Casing used |
|---|---|
| `QB_DEPARTMENTS` (questionBankData.js) — **what the live QuestionBank page actually uses to build R2 keys** | `ARCH`, `ChE`, `BECM`, ... |
| `firestore.rules` `deptCodeFromRoll()` | `ARCH`, `CHE` (all caps) |
| Curriculum folders (`src/data/curriculum/departments/`) | `Arch`, `ChE`, ... |

**Decision: `QB_DEPARTMENTS` casing is authoritative for everything R2/Worker/upload-form
related**, since that's what `getR2FileUrl()` and the live tree parsing already assume.
The Worker and upload form below hard-code this list. The rules mismatch
(`CHE` vs `ChE`) is a pre-existing bug in `firestore.rules` unrelated to this
feature — flagged separately, not fixed here, since fixing it touches the roll
auto-verify path.
