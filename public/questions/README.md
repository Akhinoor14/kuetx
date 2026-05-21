# KUETx Question Bank PDFs

Place converted PDF files here following this structure:

```
questions/
└── {DEPT}/
    └── Y{year}T{term}/
        └── {ExamType}_{examYear}.pdf
```

**Example:**
```
questions/ESE/Y2T1/Regular_2023.pdf
questions/ME/Y4T0/Special_Backlog_2022.pdf
```

After placing the file, set `available: true` in `QB_OVERRIDES` inside:
`src/data/questionbank/questionBankData.js`

See `src/data/questionbank/QUESTION_BANK_GUIDE.md` for full documentation.
