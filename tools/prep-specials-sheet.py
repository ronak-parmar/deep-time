#!/usr/bin/env python3
"""Cut the AI sheet of painted special pieces into art/specials/<slot>.webp (Dino Match, M10).

usage: prep-specials-sheet.py [art/sheets/specials.png] [--out art/specials] [--size 256] [--one-firecracker] [--preview contact.png] [--dry-run]

The sheet: a WHITE background with the items in a row or a grid, in reading order (rows top to bottom, left to right):
    firecracker horizontal, firecracker vertical, bomb, dynamite, TNT, rainbow            -> 6 items
  --one-firecracker: firecracker (horizontal), bomb, dynamite, TNT, rainbow               -> 5 items (firecracker.webp, turned for 'v')
Steps per item: white connected to the sheet border becomes alpha (soft, decontaminated edge; tools/prep-ui-sheet.py), cells are
auto-detected (pieces closer than --merge stay one item: a fuse spark, a loose flame), specks are ignored, then each item is trimmed,
padded to a square with a small margin, resized to --size px (default 256) and written as RGBA webp.
FAILS LOUDLY (exit 2, nothing written) when the item count is wrong, and prints every detected box so you can see what merged or split.
The slot names and their order are the game's (games/dino-match/src/render/specialArt.js SHEET_ORDER). Needs pillow, numpy, scipy.
"""
import sys, os, argparse, importlib.util
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location('uisheet', os.path.join(HERE, 'prep-ui-sheet.py')); U = importlib.util.module_from_spec(spec); spec.loader.exec_module(U)

ORDER = ['firecracker-h', 'firecracker-v', 'bomb', 'dynamite', 'tnt', 'rainbow']
ORDER_ONE = ['firecracker', 'bomb', 'dynamite', 'tnt', 'rainbow']

def square(piece, size, margin):
    """trim to the alpha box, pad to a centred square with `margin` (fraction) on every side, resize to size x size"""
    bb = piece.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if bb: piece = piece.crop(bb)
    w, h = piece.size; side = int(round(max(w, h) * (1 + 2 * margin)))
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.paste(piece, ((side - w) // 2, (side - h) // 2))
    return sq.resize((size, size), Image.LANCZOS)

def cut_sheet(path, names, a):
    rgb = np.asarray(Image.open(path).convert('RGB')); H, W = rgb.shape[:2]
    alpha, col, fg = U.cut(rgb, a.white)
    # --merge first; if the count is off, try tighter then looser merge distances (AI sheets often leave narrow gaps between items,
    # or a spark floats a little away from its fuse). Only an exact count is accepted.
    tries = [a.merge] + ([] if a.no_retry else [a.merge * k for k in (0.5, 0.25, 1.5, 2.5)])
    for m in tries:
        lab, items = U.boxes_of(fg, max(1, round(m * W)), a.min_area * W * H)
        items = U.reading_order(items, a.row_tol * H)
        if len(items) == len(names):
            if m != a.merge: print(f'note: used --merge {m:g} (the default {a.merge:g} found a different item count)')
            break
    if len(items) != len(names):
        print(f'ERROR {os.path.basename(path)}: found {len(items)} items, expected {len(names)} ({", ".join(names)}).', file=sys.stderr)
        for i, (_, b, ar) in enumerate(items): print(f'  item {i}: x {b[1].start}-{b[1].stop} y {b[0].start}-{b[0].stop} ({b[1].stop - b[1].start}x{b[0].stop - b[0].start}) area {int(ar)}', file=sys.stderr)
        print('  Typical causes: two items touching (merge), a spark or flame drawn apart from its item (raise --merge), a speck (raise --min-area),', file=sys.stderr)
        print('  an item cut by the sheet edge, a non-white background, or the sheet is in the 5-item layout (use --one-firecracker).', file=sys.stderr)
        return None
    out = []
    pad = max(2, round(0.004 * W))
    for (l, b, _), name in zip(items, names):
        ys = slice(max(0, b[0].start - pad), min(H, b[0].stop + pad)); xs = slice(max(0, b[1].start - pad), min(W, b[1].stop + pad))
        own = ndi.binary_dilation(lab[ys, xs] == l, iterations=3) & (alpha[ys, xs] > 0)
        piece = Image.fromarray(np.dstack([col[ys, xs], alpha[ys, xs] * own * 255]).astype(np.uint8), 'RGBA')
        out.append((name, (xs.stop - xs.start, ys.stop - ys.start), square(piece, a.size, a.margin)))
    return out

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sheet', nargs='?', default=os.path.join(ROOT, 'art/sheets/specials.png'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'art/specials'))
    ap.add_argument('--size', type=int, default=256); ap.add_argument('--margin', type=float, default=0.04)
    ap.add_argument('--one-firecracker', action='store_true', help='5-item sheet: one firecracker used for both axes')
    ap.add_argument('--merge', type=float, default=0.006, help='fraction of sheet width (retried tighter/looser automatically): pieces closer than this stay one item')
    ap.add_argument('--min-area', type=float, default=0.002, help='fraction of sheet area: smaller blobs are specks')
    ap.add_argument('--row-tol', type=float, default=0.15, help='fraction of sheet height: items within this of a row start belong to the row')
    ap.add_argument('--white', type=int, default=236); ap.add_argument('--quality', type=int, default=92)
    ap.add_argument('--preview', help='write a contact sheet (the cut items on a dark checker) to this png')
    ap.add_argument('--no-retry', action='store_true', help='use --merge only (no automatic tighter / looser tries)')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args(argv)
    if not os.path.exists(a.sheet):
        print(f'ERROR: sheet not found: {a.sheet}', file=sys.stderr); return 2
    names = ORDER_ONE if a.one_firecracker else ORDER
    rows = cut_sheet(a.sheet, names, a)
    if rows is None: return 2
    if not a.dry_run:
        os.makedirs(a.out, exist_ok=True)
        if a.one_firecracker:   # a 5-item sheet replaces any old pair, so the game does not mix two firecracker styles
            for old in ('firecracker-h', 'firecracker-v'):
                p = os.path.join(a.out, old + '.webp')
                if os.path.exists(p): os.remove(p)
        for name, _, im in rows: im.save(os.path.join(a.out, name + '.webp'), quality=a.quality, method=6)
    print(f'{"slot":15s} {"cut":>11s} {"saved":>9s}')
    for name, src, im in rows: print(f'{name:15s} {src[0]:>5d}x{src[1]:<5d} {im.size[0]:>4d}x{im.size[1]:<4d}' + ('  SMALL (under 128 px, will look soft)' if min(src) < 128 else ''))
    if a.preview:
        S = a.size; sheet = Image.new('RGBA', (S * len(rows), S), (40, 30, 22, 255))
        for i, (_, _, im) in enumerate(rows): sheet.alpha_composite(im, (i * S, 0))
        sheet.save(a.preview)
    print(f'{len(rows)} specials {"checked" if a.dry_run else "written to " + a.out}')
    return 0

if __name__ == '__main__':
    sys.exit(main())
