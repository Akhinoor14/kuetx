# Python Workflow

This is the recommended Python-first workflow for repeating a question-bank cleanup.

## Environment

- Use `py -3` on Windows.
- Existing scripts in this repo already rely on `PyPDF2`.
- If you need PDF text extraction outside the repo scripts, `PyPDF2` is the default lightweight choice.

## Main script

Current organizer script:

- `scripts/organize_questionbank.py`

What it does:

- scans PDFs recursively
- extracts text from the first pages
- infers department, term, course, year, and exam type
- builds target paths under `questionbank/QuestionBank_NEW`
- skips files that are ambiguous
- supports dry-run first, then execute

## Standard run pattern

Dry run:

```powershell
py -3 scripts\organize_questionbank.py
```

Execute after review:

```powershell
py -3 scripts\organize_questionbank.py --execute
```

## What the script should do before moving anything

1. Detect the source department from the path.
2. Detect the term from the source path first.
3. Extract PDF text and search for the course code.
4. Detect the exam year.
5. Detect the exam type.
6. Build the target path.
7. Skip if the file is still ambiguous.

## Safe heuristics

Prefer this order:

- exact source folder clues
- PDF first-page text
- filename clues
- fallback to skip

Do not reverse that order.

## Rename behavior

Use prefix-first output names:

- `Regular_2023.pdf`
- `MidTerm_2025.pdf`
- `CT1_2025.pdf`

Do not write year-first names unless you are intentionally preserving a legacy file that cannot be normalized safely.

## If the Python script needs to change later

Keep these rules in mind:

- preserve dry-run mode
- never auto-move ambiguous files
- never rename a file to a guessed course folder
- report skips clearly
- count moved, skipped, and conflicted files separately