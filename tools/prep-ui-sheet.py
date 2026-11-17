#!/usr/bin/env python3
"""Cut the AI UI-kit sheet (elements on a white sheet) into one transparent webp per element.

usage: prep-ui-sheet.py <sheet.jpg|png> [--manifest tools/prep-ui-sheet.manifest.json] [--out art/ui/kit] [--preview contact.png]
         [--merge 8] [--min-area 2500] [--max 1024] [--white 232]
The sheet may be a phone screenshot: the white sheet area is found automatically (black bars, toasts ignored).
Resolution-agnostic: every size below scales with the sheet width (the defaults are for ~1080 px).
Steps: crop sheet -> background = near-white pixels connected to the sheet border -> soft alpha on the edge (white decontaminated)
       -> connected components (pieces closer than --merge stay together: leaves, vines) -> reading order -> names from the manifest.
Manifest: {"names": ["panel-big", ...]}  names in reading order (null skips). Reading order = rows (top to bottom), left to right in a row;
          a row is a group of boxes whose vertical centres lie within --row-tol of the row's first box (fraction of sheet height).
          Wrong count fails loudly and prints every detected box so the manifest can be fixed.
Needs: pillow, numpy, scipy. Safe to re-run.
"""
import sys, os, json, argparse
import numpy as np
from PIL import Image, ImageDraw
import scipy.ndimage as ndi

def find_sheet(rgb, white):
    """The white sheet inside a screenshot: rows whose left/right edge strips are white (black bars, toasts and buttons are not),
    largest run with small gaps bridged; then the columns that hold white inside it."""
    H, W = rgb.shape[:2]; k = max(3, W // 200)
    w = (rgb.min(-1) >= white)
    edge = np.concatenate([w[:, :k], w[:, -k:]], 1).mean(1) > 0.6
    idx = np.where(edge)[0]
    if len(idx) == 0: return (0, 0, W, H)
    runs, s, p = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - p > max(8, int(0.03 * H)): runs.append((s, p)); s = i
        p = i
    runs.append((s, p))
    y0, y1 = max(runs, key=lambda r: r[1] - r[0])
    cx = np.where(w[y0:y1 + 1].mean(0) > 0.15)[0]
    return (int(cx.min()), int(y0), int(cx.max()) + 1, int(y1) + 1)

def cut(rgb, white):
    """returns rgba float arrays: alpha (0..1) and decontaminated colour"""
    near = rgb.min(-1) >= white
    lab, _ = ndi.label(near)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    fg = ~bg
    # soft edge: foreground pixels within 2 px of the background get alpha from how far from white they are
    edge = fg & ndi.binary_dilation(bg, iterations=2)
    a = fg.astype(float)
    m = rgb.min(-1).astype(float)
    a[edge] = np.clip((255 - m[edge]) / (255 - (white - 60)), 0.35, 1.0)
    a = ndi.gaussian_filter(a, 0.6) * fg + 0 * bg
    a = np.where(bg, 0, np.clip(a, 0, 1))
    col = rgb.astype(float)
    ae = np.maximum(a, 1e-3)[..., None]
    col = np.where(edge[..., None], (col - 255 * (1 - ae)) / ae, col)
    return a, np.clip(col, 0, 255), fg

def boxes_of(fg, merge, min_area):
    grown = ndi.binary_dilation(fg, iterations=max(1, merge)) if merge else fg
    lab, n = ndi.label(grown)
    areas = ndi.sum(fg, lab, range(1, n + 1))
    bx = ndi.find_objects(lab)
    return lab, [(i + 1, bx[i], areas[i]) for i in range(n) if areas[i] >= min_area]

def reading_order(items, tol):
    its = sorted(items, key=lambda it: (it[1][0].start + it[1][0].stop) / 2)
    rows, cur, y0 = [], [], None
    for it in its:
        cy = (it[1][0].start + it[1][0].stop) / 2
        if y0 is None or abs(cy - y0) <= tol: cur.append(it); y0 = y0 if y0 is not None else cy
        else: rows.append(cur); cur = [it]; y0 = cy
    if cur: rows.append(cur)
    out = []
    for r in rows: out += sorted(r, key=lambda it: it[1][1].start)
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet'); ap.add_argument('--manifest', default=os.path.join(os.path.dirname(__file__), 'prep-ui-sheet.manifest.json'))
    ap.add_argument('--out', default='art/ui/kit'); ap.add_argument('--preview')
    ap.add_argument('--merge', type=float, default=0.008, help='fraction of sheet width'); ap.add_argument('--min-area', type=float, default=0.0025, help='fraction of sheet area')
    ap.add_argument('--row-tol', type=float, default=0.045, help='fraction of sheet height'); ap.add_argument('--max', type=int, default=1024)
    ap.add_argument('--white', type=int, default=232); ap.add_argument('--quality', type=int, default=90)
    a = ap.parse_args()
    names = json.load(open(a.manifest))['names']
    im = Image.open(a.sheet).convert('RGB'); rgb0 = np.asarray(im)
    x0, y0, x1, y1 = find_sheet(rgb0, a.white)
    rgb = rgb0[y0:y1, x0:x1]; H, W = rgb.shape[:2]
    print(f'sheet area {W}x{H} at ({x0},{y0}) of {im.size[0]}x{im.size[1]}')
    alpha, col, fg = cut(rgb, a.white)
    lab, items = boxes_of(fg, max(1, round(a.merge * W)), a.min_area * W * H)
    items = reading_order(items, a.row_tol * H)
    if len(items) != len(names):
        print(f'ERROR: found {len(items)} elements, manifest has {len(names)} names. Detected (reading order):', file=sys.stderr)
        for i, (_, b, ar) in enumerate(items): print(f'  {i:2d}: x {b[1].start}-{b[1].stop} y {b[0].start}-{b[0].stop} area {int(ar)}', file=sys.stderr)
        sys.exit(2)
    os.makedirs(a.out, exist_ok=True)
    pad = max(2, round(0.004 * W)); report = []
    for (l, b, ar), name in zip(items, names):
        if not name: continue
        ys, xs = b[0], b[1]
        ys = slice(max(0, ys.start - pad), min(H, ys.stop + pad)); xs = slice(max(0, xs.start - pad), min(W, xs.stop + pad))
        own = (lab[ys, xs] == l)                      # only this element's pixels (neighbours' bits cut away)
        own = ndi.binary_dilation(own, iterations=3) & (alpha[ys, xs] > 0)
        al = alpha[ys, xs] * own
        out = np.dstack([col[ys, xs], al * 255]).astype(np.uint8)
        piece = Image.fromarray(out, 'RGBA')
        if max(piece.size) > a.max: piece.thumbnail((a.max, a.max), Image.LANCZOS)
        piece.save(os.path.join(a.out, name + '.webp'), quality=a.quality, method=6)
        report.append((name, piece.size))
    print(f'{"name":16s} size'); [print(f'{n:16s} {s[0]}x{s[1]}') for n, s in report]
    if a.preview:
        pv = Image.new('RGB', (W, H), (60, 40, 30)); pv.paste(Image.fromarray(np.dstack([col, alpha * 255]).astype(np.uint8), 'RGBA'), (0, 0), Image.fromarray((alpha * 255).astype(np.uint8)))
        d = ImageDraw.Draw(pv)
        for i, ((_, b, _), n) in enumerate(zip(items, names)):
            d.rectangle([b[1].start, b[0].start, b[1].stop, b[0].stop], outline=(0, 255, 255)); d.text((b[1].start + 4, b[0].start + 4), f'{i}:{n}', fill=(255, 255, 0))
        pv.save(a.preview)

if __name__ == '__main__': main()
