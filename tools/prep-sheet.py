#!/usr/bin/env python3
"""Cut the AI art sheets into single transparent images (docs/15).

usage: prep-sheet.py [fossils|islands|all] [--sheets art/sheets] [--out art] [--only fossils-3.png] [--dry-run]
  fossils: art/sheets/fossils-1..8.png (6 slabs each, 2 columns x 3 rows, white gaps; fossils-8 has 5) -> art/fossils/<roster-id>.webp
  islands: art/sheets/islands-1..2.png (5 islands each, 3 + 2 grid)                                    -> art/islands/<era-id>.webp
The cell order is reading order (rows top to bottom, left to right) and maps to the ids in tools/roster-ids.json, in the order of docs/15.
Per sheet: white background (connected to the border) becomes alpha with a soft edge, cells are auto-detected, specks are ignored.
FAILS LOUDLY (exit 2, nothing written for that sheet) when the cell count is wrong, and prints every detected box so you can see which
cell merged or vanished. Flags TOO SMALL cells (short side under --min-side px) and MISSING sheets. Safe to re-run.
Resolution-agnostic: all thresholds are fractions of the sheet size. Needs pillow, numpy, scipy.
"""
import sys, os, json, argparse, importlib.util
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('uisheet', os.path.join(HERE, 'prep-ui-sheet.py')); U = importlib.util.module_from_spec(spec); spec.loader.exec_module(U)
IDS = json.load(open(os.path.join(HERE, 'roster-ids.json')))

def plan(kind):
    """[(sheet file, [ids in reading order])]"""
    if kind == 'fossils':
        ids = IDS['fossils']; out = []
        for n in range(1, 9): out.append((f'fossils-{n}.png', ids[(n - 1) * 6:n * 6]))
        return [p for p in out if p[1]]
    isl = IDS['islands']; return [('islands-1.png', isl[:5]), ('islands-2.png', isl[5:10])]

def find_sheet(dir_, name):
    for ext in ('', '.png', '.jpg', '.jpeg', '.webp'):
        base = os.path.splitext(name)[0]
        for cand in ([name] if not ext else [base + ext]):
            p = os.path.join(dir_, cand)
            if os.path.exists(p): return p
    return None

def process(path, ids, outdir, a, label):
    rgb = np.asarray(Image.open(path).convert('RGB')); H, W = rgb.shape[:2]
    alpha, col, fg = U.cut(rgb, a.white)
    lab, items = U.boxes_of(fg, max(1, round(a.merge * W)), a.min_area * W * H)
    items = U.reading_order(items, a.row_tol * H)
    if len(items) != len(ids):
        print(f'ERROR {label}: found {len(items)} cells, expected {len(ids)} ({", ".join(ids)}).', file=sys.stderr)
        for i, (_, b, ar) in enumerate(items): print(f'  cell {i:2d}: x {b[1].start}-{b[1].stop} y {b[0].start}-{b[0].stop} ({b[1].stop - b[1].start}x{b[0].stop - b[0].start}) area {int(ar)}', file=sys.stderr)
        print('  Typical causes: two slabs touching (merge), a slab cut by the sheet edge, a speck counted as a cell, the white gap too narrow.', file=sys.stderr)
        return None
    rows = []
    pad = max(2, round(0.003 * W))
    for (l, b, ar), id_ in zip(items, ids):
        ys = slice(max(0, b[0].start - pad), min(H, b[0].stop + pad)); xs = slice(max(0, b[1].start - pad), min(W, b[1].stop + pad))
        own = ndi.binary_dilation(lab[ys, xs] == l, iterations=3) & (alpha[ys, xs] > 0)
        piece = Image.fromarray(np.dstack([col[ys, xs], alpha[ys, xs] * own * 255]).astype(np.uint8), 'RGBA')
        src = piece.size
        if max(piece.size) > a.max: piece.thumbnail((a.max, a.max), Image.LANCZOS)
        flag = 'TOO SMALL' if min(src) < a.min_side else ''
        if not a.dry_run:
            os.makedirs(outdir, exist_ok=True); piece.save(os.path.join(outdir, id_ + '.webp'), quality=a.quality, method=6)
        rows.append((id_, src, piece.size, flag))
    return rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('kind', nargs='?', default='all', choices=['fossils', 'islands', 'all'])
    ap.add_argument('--sheets', default='art/sheets'); ap.add_argument('--out', default='art'); ap.add_argument('--only'); ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--merge', type=float, default=0.004, help='fraction of sheet width: pieces closer than this stay one cell')
    ap.add_argument('--min-area', type=float, default=0.004, help='fraction of sheet area: smaller blobs are specks')
    ap.add_argument('--row-tol', type=float, default=0.12, help='fraction of sheet height: cells within this of a row start belong to the row')
    ap.add_argument('--max', type=int, default=1280); ap.add_argument('--min-side', type=int, default=420); ap.add_argument('--white', type=int, default=236); ap.add_argument('--quality', type=int, default=90)
    a = ap.parse_args()
    kinds = ['fossils', 'islands'] if a.kind == 'all' else [a.kind]
    failed = missing = small = made = 0
    print(f'{"id":30s} {"cut":>11s} {"saved":>11s}  note')
    for kind in kinds:
        outdir = os.path.join(a.out, kind)
        for name, ids in plan(kind):
            if a.only and a.only not in name: continue
            p = find_sheet(a.sheets, name)
            if not p: print(f'MISSING sheet {name} (needs {len(ids)} cells: {ids[0]} ... {ids[-1]})'); missing += 1; continue
            rows = process(p, ids, outdir, a, name)
            if rows is None: failed += 1; continue
            for id_, s, o, flag in rows:
                print(f'{id_:30s} {s[0]:5d}x{s[1]:<5d} {o[0]:5d}x{o[1]:<5d}  {flag}'); made += 1; small += bool(flag)
    print(f'\n{made} images written' + (' (dry run)' if a.dry_run else '') + f', {small} too small, {missing} sheets missing, {failed} sheets FAILED')
    if small: print('TOO SMALL means the cell is under --min-side px on its short side: regenerate that sheet larger (2048 px or more).')
    sys.exit(2 if failed else 0)

if __name__ == '__main__': main()
