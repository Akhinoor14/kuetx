# Recovery Notes

If a batch move or rename goes wrong, use this order.

## 1. Stop immediately

Do not run another batch until you know what happened.

## 2. Inspect what changed

Check:

- moved files
- renamed files
- duplicate targets
- skipped files

## 3. Compare source and target counts

Count PDFs in:

- the source tree
- `questionbank/QuestionBank_NEW`

## 4. Restore from the original source if needed

If files were moved into the wrong target folder, move them back manually.

If a file was renamed incorrectly, rename it back from the target folder.

## 5. Keep ambiguous files untouched

If you cannot prove the correct destination, do not try to repair by guessing.

## 6. Use a narrower rule next time

Examples:

- infer the term from the path first
- match the course code from the PDF text before the filename
- only allow move rules for one department at a time

## Typical failure modes we already saw

- year-first file naming when the convention expects prefix-first
- OCR noise in the exam year, such as `20217` instead of `2017`
- course-code mismatch between source folder and target folder
- some legacy `Ece/1.1/` files that cannot be mapped safely without a manual pass