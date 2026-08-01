This folder uses reversible compression to keep repository size small while preserving original PDFs.

Workflow

- Compression (done by `scripts/compress_pdfs.py`):
  - Recursively finds `.pdf` files and compresses them to `.pdf.zst` using Python `zstandard` library.
  - Verifies each compressed file by decompressing in-memory and checking SHA256.
  - Deletes original `.pdf` only after successful verification.

- Restore (done by `scripts/restore_pdfs.py`):
  - Recursively finds `.pdf.zst` files and decompresses them back to `.pdf`.

Commands

1) Install dependency:

```powershell
pip install zstandard
```

2) Compress all PDFs:

```powershell
python scripts/compress_pdfs.py
```

3) Restore all PDFs:

```powershell
python scripts/restore_pdfs.py
```

Notes

- Compressed files are lossless and fully restorable.
- Keep `question_bank_structure.json` up-to-date if you need an index.
- If you prefer `zstd` binary, you can use it instead of installing the Python library.
