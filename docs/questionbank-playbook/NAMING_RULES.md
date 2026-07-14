# Naming Rules

This repo now uses a single practical filename style for question-bank PDFs.

## Standard PDF name

`{ExamType}_{ExamYear}.pdf`

## Allowed exam types

- `Regular`
- `Backlog`
- `Special`
- `MidTerm`
- `FinalTerm`
- `CT1`, `CT2`, ...
- `LabQuiz1`, `LabQuiz2`, ...
- `Online`

## Examples

- `Regular_2023.pdf`
- `Backlog_2024.pdf`
- `Special_2022.pdf`
- `MidTerm_2025.pdf`
- `FinalTerm_2025.pdf`
- `CT1_2025.pdf`
- `CT2_2025.pdf`
- `LabQuiz1_2025.pdf`
- `LabQuiz2_2025.pdf`

## What not to use

- `2023.pdf` alone unless that is the only surviving safe mapping in a legacy folder
- year-first names like `2023_Regular.pdf`
- mixed legacy names with extra spaces or duplicate markers when you can normalize them first

## Move policy

Only rename to this format if all of these are known:

- department
- term
- course
- exam type
- exam year

If any of them is uncertain, keep the file untouched.

## Practical note

Legacy PDFs often carry the course code and exam year in the first page text even when the filename is dirty. Use the PDF text first, then the folder name, then the filename. Do not guess if the result is still ambiguous.