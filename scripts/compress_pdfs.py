#!/usr/bin/env python3
import os
import sys
import hashlib
from pathlib import Path

try:
    import zstandard as zstd
except Exception:
    print('Missing Python dependency: zstandard. Run: pip install zstandard')
    sys.exit(2)

ROOT = Path(__file__).resolve().parents[1] / 'src' / 'data' / 'QUESTION Bank'
LEVEL = 10  # compression level

def sha256_of_path(p: Path):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


def compress_file(path: Path):
    zst_path = path.with_suffix(path.suffix + '.zst')
    if zst_path.exists():
        print('Skipping (already compressed):', path)
        return
    print('Compressing:', path)
    original_hash = sha256_of_path(path)
    cctx = zstd.ZstdCompressor(level=LEVEL)
    with path.open('rb') as ifp, zst_path.open('wb') as ofp:
        cctx.copy_stream(ifp, ofp)
    # verify by decompressing to memory and comparing hash
    dctx = zstd.ZstdDecompressor()
    with zst_path.open('rb') as zfp:
        decompressed = dctx.decompress(zfp.read())
    decompressed_hash = hashlib.sha256(decompressed).hexdigest()
    if decompressed_hash != original_hash:
        print('ERROR: verification failed for', path)
        zst_path.unlink(missing_ok=True)
        return
    # if verified, remove original
    path.unlink()
    print('Done:', zst_path)


def main():
    if not ROOT.exists():
        print('Root not found:', ROOT)
        sys.exit(1)
    pdfs = list(ROOT.rglob('*.pdf'))
    if not pdfs:
        print('No PDF files found under', ROOT)
        return
    print(f'Found {len(pdfs)} PDFs. Compressing with zstandard level {LEVEL}.')
    for p in pdfs:
        try:
            compress_file(p)
        except Exception as e:
            print('Failed:', p, e)

if __name__ == '__main__':
    main()
