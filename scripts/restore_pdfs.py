#!/usr/bin/env python3
import os
import sys
from pathlib import Path

try:
    import zstandard as zstd
except Exception:
    print('Missing Python dependency: zstandard. Run: pip install zstandard')
    sys.exit(2)

ROOT = Path(__file__).resolve().parents[1] / 'src' / 'data' / 'QUESTION Bank'

def restore_file(zst_path: Path):
    if not zst_path.name.lower().endswith('.pdf.zst'):
        print('Skipping (not a pdf.zst):', zst_path)
        return
    out_path = zst_path.with_suffix('')  # remove .zst
    if out_path.exists():
        print('Skipping (already restored):', out_path)
        return
    print('Restoring:', zst_path)
    dctx = zstd.ZstdDecompressor()
    with zst_path.open('rb') as ifp, out_path.open('wb') as ofp:
        dctx.copy_stream(ifp, ofp)
    print('Restored:', out_path)


def main():
    if not ROOT.exists():
        print('Root not found:', ROOT)
        sys.exit(1)
    zsts = list(ROOT.rglob('*.pdf.zst'))
    if not zsts:
        print('No .pdf.zst files found under', ROOT)
        return
    print(f'Found {len(zsts)} compressed PDFs. Restoring...')
    for p in zsts:
        try:
            restore_file(p)
        except Exception as e:
            print('Failed:', p, e)

if __name__ == '__main__':
    main()
