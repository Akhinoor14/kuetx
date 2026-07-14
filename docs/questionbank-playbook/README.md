# Question Bank Playbook

This folder is the reusable runbook for mass question-bank cleanup, renaming, and safe moving.

Use it when you need to do the same kind of work again:
- inspect PDFs
- decide what can be safely moved
- rename files into the standard format
- keep ambiguous files untouched
- verify the result before and after a batch

## What this playbook assumes

- Source PDFs may live in legacy folders.
- Only confidently identified files should be moved.
- Files that cannot be mapped safely must stay where they are.
- The target structure is the `QuestionBank_NEW` tree.

## Start here

1. Read [Naming Rules](NAMING_RULES.md).
2. Read [Python Workflow](PYTHON_WORKFLOW.md).
3. Use [Safe Move Checklist](SAFE_MOVE_CHECKLIST.md).
4. If something breaks, use [Recovery Notes](RECOVERY.md).

## Current local script

The main organizer script in this repo is:

- `scripts/organize_questionbank.py`

It is the reference implementation for future cleanup runs.

## Current naming convention

The active filename style is:

- `Regular_2023.pdf`
- `Backlog_2024.pdf`
- `Special_2022.pdf`
- `MidTerm_2025.pdf`
- `FinalTerm_2025.pdf`
- `CT1_2025.pdf`
- `LabQuiz1_2025.pdf`

That format is prefix-first: `ExamType_Year.pdf`.

## Core safety rule

If a file is not clearly identifiable, do not move it.

That rule matters more than speed.