#!/usr/bin/env python3
"""Cut the AI sheet of painted board obstacles into art/obstacles/<slot>.webp (Dino Match, M11). Order + prompt: docs/18-obstacle-art.md.

usage: prep-obstacles-sheet.py [art/sheets/obstacles.png] [--out art/obstacles] [--size 192] [--cols 5 --rows 4] [--first 0]
                               [--preview contact.png] [--dry-run]

The sheet: a WHITE background, 20 items in a 5 x 4 grid, reading order (rows top to bottom, left to right) =
    tar, sandstone-2, sandstone-1, fossil-2, fossil-1,
    bone, vine-2, vine-1, crate, lava-3,
    lava-2, lava-1, rock, artefact, dig-tar,
    dig-sand-2, dig-sand-1, dig-stone-3, dig-stone-2, dig-stone-1
(<kind>-<n> = the picture shown while the obstacle has n hits left; the game's list is OBSTACLE_SHEET in
games/dino-match/src/render/obstacleArt.js, read from there so the two never drift apart.)

Steps: (1) the sheet is split into the grid by its empty white rows / columns (the widest white runs; AI sheets keep the cells
apart but the gaps can be narrow), falling back to equal cells when a gap is missing; (2) per cell, white connected to the cell
border becomes alpha with a soft, white-decontaminated edge (tools/prep-ui-sheet.py cut), specks are dropped; (3) the item is
trimmed, centred on a square with a small margin and resized to --size px (default 192, the game draws them at ~48 px, so 4x).
Checks: an empty cell or an item touching its cell edge (cut off by the split) FAILS LOUDLY (exit 2, nothing written).
--only tar,crate writes just those slots (others in the sheet are still checked). Needs pillow, numpy, scipy.
"""
import sys, os, re, argparse, importlib.util
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location('uisheet', os.path.join(HERE, 'prep-ui-sheet.py')); U = importlib.util.module_from_spec(spec); spec.loader.exec_module(U)
JS = os.path.join(ROOT, 'games', 'dino-match', 'src', 'render', 'obstacleArt.js')


def sheet_order():
    """slot names in sheet order, parsed from OBSTACLE_SHEET in obstacleArt.js"""
    src = open(JS).read(); block = src[src.index('OBSTACLE_SHEET = ['):]; block = block[:block.index('\n];')]
    return re.findall(r"\[\s*'([a-z0-9-]+)'\s*,", block)


def splits(empty, n, size):
    """n-1 cut positions: centres of the widest runs of empty lines, kept in order; equal spacing if there are too few runs"""
    runs, st = [], None
    for i, e in enumerate(empty):
        if e and st is None: st = i
        if not e and st is not None: runs.append((st, i)); st = None
    runs = [r for r in runs if r[0] > 0 and r[1] < size]                       # inner runs only
    if len(runs) < n - 1: return [round(size * k / n) for k in range(1, n)], False
    best = sorted(sorted(runs, key=lambda r: r[0] - r[1])[:n - 1])
    return [(r[0] + r[1]) // 2 for r in best], True


def square(piece, size, margin):
    bb = piece.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if bb: piece = piece.crop(bb)
    w, h = piece.size; side = int(round(max(w, h) * (1 + 2 * margin)))
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.paste(piece, ((side - w) // 2, (side - h) // 2))
    return sq.resize((size, size), Image.LANCZOS)


def cut_sheet(path, names, a):
    rgb = np.asarray(Image.open(path).convert('RGB')); H, W = rgb.shape[:2]
    mn, mx = rgb.min(2).astype(int), rgb.max(2).astype(int)
    fg = ndi.binary_opening(~((mn >= a.white) & (mx - mn < 14)), iterations=1)
    ys, oky = splits(fg.sum(1) <= 1, a.rows, H); xs, okx = splits(fg.sum(0) <= 1, a.cols, W)
    if not (oky and okx): print('note: a white gap between rows or columns is missing, using equal cells', file=sys.stderr)
    ys = [0] + ys + [H]; xs = [0] + xs + [W]
    out, errors = [], []
    for k, name in enumerate(names):
        r, c = divmod(k, a.cols)
        if r >= a.rows: errors.append(f'{name}: the grid has only {a.rows * a.cols} cells'); continue
        y0, y1, x0, x1 = ys[r], ys[r + 1], xs[c], xs[c + 1]
        cell = np.ascontiguousarray(rgb[y0:y1, x0:x1])
        cf = fg[y0:y1, x0:x1]
        if cf.sum() < a.min_area * cf.size: errors.append(f'{name}: cell {r},{c} (x {x0}-{x1} y {y0}-{y1}) is empty'); continue
        alpha, col, _ = U.cut(np.pad(cell, ((2, 2), (2, 2), (0, 0)), constant_values=255), a.white)
        alpha, col = alpha[2:-2, 2:-2], col[2:-2, 2:-2]
        lab, n = ndi.label(alpha > 0.04)
        if n > 1:                                                               # drop specks (keep pieces >= 3% of the biggest)
            sz = ndi.sum(np.ones(lab.shape), lab, range(1, n + 1)); keep = np.isin(lab, [i + 1 for i in range(n) if sz[i] >= 0.03 * sz.max()])
            alpha = alpha * ndi.binary_dilation(keep, iterations=2)
        edge = np.concatenate([alpha[0], alpha[-1], alpha[:, 0], alpha[:, -1]])
        if (edge > 0.5).mean() > 0.02: errors.append(f'{name}: the item touches its cell edge (cell {r},{c}): items too close or the grid is not {a.cols}x{a.rows}')
        piece = Image.fromarray(np.dstack([col, alpha * 255]).astype(np.uint8), 'RGBA')
        out.append((name, (x1 - x0, y1 - y0), square(piece, a.size, a.margin)))
    if errors:
        print(f'ERROR {os.path.basename(path)}:', file=sys.stderr)
        for e in errors: print('  ' + e, file=sys.stderr)
        print(f'  rows cut at y {ys[1:-1]}, columns at x {xs[1:-1]}', file=sys.stderr)
        return None
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sheet', nargs='?', default=os.path.join(ROOT, 'art/sheets/obstacles.png'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'art/obstacles'))
    ap.add_argument('--size', type=int, default=192); ap.add_argument('--margin', type=float, default=0.03)
    ap.add_argument('--cols', type=int, default=5); ap.add_argument('--rows', type=int, default=4)
    ap.add_argument('--first', type=int, default=0, help='sheet holds the slots from this index on (two half sheets: --rows 2, then --rows 2 --first 10)')
    ap.add_argument('--min-area', type=float, default=0.02, help='fraction of a cell: less ink than this = empty cell')
    ap.add_argument('--white', type=int, default=236); ap.add_argument('--quality', type=int, default=92)
    ap.add_argument('--only', help='comma list of slots to write'); ap.add_argument('--preview'); ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args(argv)
    if not os.path.exists(a.sheet): print(f'ERROR: sheet not found: {a.sheet}', file=sys.stderr); return 2
    names = sheet_order()[a.first:a.first + a.cols * a.rows]
    rows = cut_sheet(a.sheet, names, a)
    if rows is None: return 2
    only = set(a.only.split(',')) if a.only else None
    if not a.dry_run:
        os.makedirs(a.out, exist_ok=True)
        for name, _, im in rows:
            if not only or name in only: im.save(os.path.join(a.out, name + '.webp'), quality=a.quality, method=6)
    print(f'{"slot":13s} {"cell":>11s} {"saved":>9s}')
    for name, src, im in rows: print(f'{name:13s} {src[0]:>5d}x{src[1]:<5d} {im.size[0]:>4d}x{im.size[1]:<4d}' + ('  SMALL (cell under 160 px, will look soft)' if min(src) < 160 else ''))
    if a.preview:
        S = a.size; cols = a.cols; sheet = Image.new('RGBA', (S * cols, S * ((len(rows) + cols - 1) // cols)), (40, 30, 22, 255))
        for i, (_, _, im) in enumerate(rows): sheet.alpha_composite(im, ((i % cols) * S, (i // cols) * S))
        sheet.save(a.preview)
    print(f'{len(rows)} obstacle pictures {"checked" if a.dry_run else "written to " + a.out}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
