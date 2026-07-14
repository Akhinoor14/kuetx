# Safe Move Checklist

Use this before every batch.

## Before the run

- Confirm the target naming convention.
- Confirm the source tree you are scanning.
- Confirm the target tree you are writing into.
- Make sure the script has a dry-run mode.
- Make sure duplicate detection is enabled.
- Back up anything you do not want to lose.

## During the run

- Review the planned move list first.
- Check the skip list.
- Look for false positives.
- Check for conflicts with existing target files.
- Do not force files into a folder if the course is not certain.

## After the run

- Count PDFs in the target tree.
- Count PDFs left in the source tree.
- Sample a few renamed folders.
- Open a few PDFs and confirm the expected filename matches the course.
- Keep a record of what was intentionally skipped.

## Red flags

Stop and review if you see any of these:

- multiple course codes in one PDF and no obvious winner
- OCR noise that changes digits
- old folder names like `Ece/1.1/` where the course is not obvious
- filename collisions with already-moved files
- target course folder does not exist

## Good outcome

A good cleanup run usually ends with:

- a large set of confident moves
- a smaller set of skipped legacy files
- no guessed folders
- no accidental overwrites