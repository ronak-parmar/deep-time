#!/usr/bin/env python3
"""Island art sheet -> art/islands/<era-id>.webp (shipped world-map / island-screen pictures).

Source: art/sheets/islands-final.png, ten floating islands on plain white in a 5 x 2 grid, reading order =
  top row:    cambrian, devonian, carboniferous, permian, triassic
  bottom row: jurassic, cretaceous, age-of-mammals, ice-age, early-humans
(the era ids of src/core/eras.js, tools/roster-ids.json "islands").

Steps per island
  1. FIND: grid split by the empty white rows/columns between the islands (gaps are narrow, ~10 px), reading order.
           Every non-white pixel in a cell belongs to that island (smoke, spray). Fails loudly (exit 2) if not 10 cells.
  2. UPSCALE: the crop (+ white margin) x4 with Real-ESRGAN x4plus in numpy (tools/esrgan_np.py). Cached per crop hash in
           --cache (default ~/.cache/dino-sr/islands), so re-runs after the first (~2 min an island on 2 cores) are instant.
  3. CUT: (POCKET_R) enclosed white pockets between roots/canopies are cut first; then background = near-white pixels (min channel >= --white, low chroma) CONNECTED TO THE CROP BORDER (flood fill), so
           white inside the island (waterfall foam, snow, ice, icicle highlights) survives. Holes in the island silhouette
           that touch the outside through near-white (gaps between hanging roots) are cut too, which is what we want.
           Edge: in a thin band along the cut the alpha comes from how far the pixel is from white (soft, anti-aliased) and
           the colour is un-mixed from white (no light halo on a dark map); everything deeper is fully opaque. The silhouette is
           first shaved by EDGE_IN px (4x): the sheet has a thin pale outline round each island that reads as a halo.
  4. SAVE: trimmed to the alpha box, resized to --width (default 900) px wide, webp with alpha (quality 90).
  Also writes --contact (default docs/screens/m11/islands-contact.png): all ten on a dark background, to check halos.

usage: python3 tools/prep-islands.py [--sheet art/sheets/islands-final.png] [--only cambrian,ice-age] [--width 900]
                                     [--cache DIR] [--fast]   (--fast = Lanczos instead of ESRGAN, for a quick look)
Needs numpy, scipy, pillow. Deterministic, safe to re-run.
"""
import os, sys, json, argparse, hashlib
import numpy as np
from PIL import Image, ImageFilter
import scipy.ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
IDS = json.load(open(os.path.join(HERE, 'roster-ids.json')))['islands']
MARGIN = 14          # white px kept around each crop before upscaling (1x)
BAND = 5             # soft-edge band width (px at 4x)
EDGE_IN = 3          # px (4x) shaved off the whole silhouette: the sheet paints a thin pale rim round every island (halo on dark)
# Enclosed white pockets (sky seen between hanging roots or tree canopies) are cut when they reach the outside once the island's
# thin parts (roots, fronds) are eroded away by this many px (1x). 0 = keep every enclosed white (ice age: the snow is white).
# Tuned per island by eye on the sheet (docs/screens/m11/islands-pockets.png shows the result: red = cut, cyan = kept).
POCKET_R = {'default': 3, 'carboniferous': 9, 'jurassic': 9, 'ice-age': 0}
# Also cut: enclosed pockets of clean sheet white (mean min channel >= ROOT_WHITE) in the lower part of the island (below ROOT_V of
# the cell height): sky seen through loops of hanging roots under the cliff, where nothing white is painted.
ROOT_V, ROOT_WHITE = 0.55, 246


def _runs(prof, lo, hi):
    """[(start, stop)] runs of empty (<= 1 px) entries of a projection profile inside [lo, hi)"""
    out, st = [], None
    for i in range(lo, hi):
        e = prof[i] <= 1
        if e and st is None: st = i
        if not e and st is not None: out.append((st, i)); st = None
    if st is not None: out.append((st, hi))
    return out


def find_islands(rgb, white, cols=5, rows=2):
    """Grid split by projection: the widest empty row run near the middle splits the rows, the cols-1 widest empty column
    runs inside each row band split the columns (the gaps on the sheet are only ~10 px, so blob dilation would merge
    islands). Each cell's non-white pixels are that island (smoke, spray and loose leaves included).
    -> fg mask, [(cell slices, cell index)] in reading order"""
    mn, mx = rgb.min(2), rgb.max(2)
    fg = ~((mn >= white) & (mx - mn < 12))
    fg = ndi.binary_opening(fg, iterations=1)
    H, W = fg.shape
    rr = [r for r in _runs(fg.sum(1), int(H * 0.25), int(H * 0.75))]
    if rows == 1 or not rr: ys = [0, H]
    else: g = max(rr, key=lambda r: r[1] - r[0]); ys = [0, (g[0] + g[1]) // 2, H]
    cells = []
    for r in range(len(ys) - 1):
        band = fg[ys[r]:ys[r + 1]]
        cr = [q for q in _runs(band.sum(0), 1, W - 1) if q[0] > W * 0.05 and q[1] < W * 0.95]
        cuts = sorted(sorted(cr, key=lambda q: q[0] - q[1])[:cols - 1])
        xs = [0] + [(q[0] + q[1]) // 2 for q in cuts] + [W]
        for c in range(len(xs) - 1):
            m = np.zeros_like(fg); m[ys[r]:ys[r + 1], xs[c]:xs[c + 1]] = fg[ys[r]:ys[r + 1], xs[c]:xs[c + 1]]
            if not m.any(): continue
            yy, xx = np.where(m)
            cells.append(((slice(yy.min(), yy.max() + 1), slice(xx.min(), xx.max() + 1)), m))
    return cells


def pockets(crop, white, r):
    """1x mask of enclosed near-white pockets that are background (see POCKET_R)"""
    if r <= 0: return np.zeros(crop.shape[:2], bool), np.zeros(crop.shape[:2], bool)
    c = crop.astype(int); mn, mx = c.min(2), c.max(2)
    wh = np.pad((mn >= white) & (mx - mn < 14), 2, constant_values=True)
    lab, n = ndi.label(wh)
    border = set(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]).tolist())
    l2, _ = ndi.label(~ndi.binary_erosion(~wh, iterations=r))
    outer = np.isin(l2, list(set(np.concatenate([l2[0], l2[-1], l2[:, 0], l2[:, -1]]).tolist()) - {0}))
    inner = [k for k in range(1, n + 1) if k not in border]
    H = crop.shape[0]
    def rootsky(k):
        ys, xs = np.where(lab == k)
        return ys.mean() - 2 > ROOT_V * H and mn[ys - 2, xs - 2].mean() >= ROOT_WHITE
    cut = [k for k in inner if (outer & (lab == k)).any() or rootsky(k)]
    keep = [k for k in inner if k not in cut]
    return np.isin(lab, cut)[2:-2, 2:-2], np.isin(lab, keep)[2:-2, 2:-2]


def upscale(crop, cache, fast):
    if fast: return np.asarray(Image.fromarray(crop).resize((crop.shape[1] * 4, crop.shape[0] * 4), Image.LANCZOS))
    key = hashlib.sha1(crop.tobytes() + str(crop.shape).encode()).hexdigest()[:16]
    p = os.path.join(cache, key + '.png')
    if os.path.exists(p): return np.asarray(Image.open(p).convert('RGB'))
    import esrgan_np as E
    up = E.upscale(crop, 'RealESRGAN_x4plus', tile=100)
    os.makedirs(cache, exist_ok=True); Image.fromarray(up).save(p)
    return up


def cut(up, own4, white, pocket4):
    """up: 4x RGB, own4: 4x mask of this island's cell (dilated), pocket4: 4x mask of enclosed pockets to cut. -> RGBA"""
    f = up.astype(np.float32)
    mn, mx = f.min(2), f.max(2)
    whiteish = (mn >= white) & (mx - mn < 14)
    # background = whiteish connected to the crop border, plus everything outside this island's own blob
    lab, _ = ndi.label(whiteish | ~own4 | pocket4)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0]) | pocket4
    fg = ~bg
    fg = ndi.binary_opening(fg, iterations=1)                      # drop single-pixel ESRGAN speckle on the white
    lab2, n2 = ndi.label(fg)                                       # and any small floating crumbs
    if n2 > 1:
        sz = ndi.sum(np.ones(fg.shape), lab2, range(1, n2 + 1)); big = sz.max()
        fg = np.isin(lab2, [i + 1 for i in range(n2) if sz[i] > 0.002 * big])
    fg = ndi.binary_erosion(fg, iterations=EDGE_IN)
    dist = ndi.distance_transform_edt(fg)
    # soft alpha in the band: distance from white (max over channels of how much darker than white the pixel is)
    dark = (255.0 - f).max(2)
    a_soft = np.clip(dark / 70.0, 0, 1)
    a = np.where(dist >= BAND, 1.0, np.where(fg, np.maximum(a_soft, np.clip(dist / BAND, 0, 1) ** 2), 0.0))
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255 * (ndi.binary_dilation(fg, iterations=1))
    # un-mix white from the edge colours (C = a*F + (1-a)*255  ->  F)
    af = np.maximum(a, 0.05)[..., None]
    col = np.clip((f - (1 - af) * 255.0) / af, 0, 255)
    col = np.where((a < 0.999)[..., None], col, f)
    return np.dstack([col, a * 255]).astype(np.uint8)


def contact(pieces, path, cell=300):
    cols = 5; rows = (len(pieces) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cell, rows * cell), (22, 26, 36))
    for i, (id_, im) in enumerate(pieces):
        t = im.copy(); t.thumbnail((cell - 20, cell - 20), Image.LANCZOS)
        x = (i % cols) * cell + (cell - t.size[0]) // 2; y = (i // cols) * cell + (cell - t.size[1]) // 2
        sheet.paste(t, (x, y), t)
    os.makedirs(os.path.dirname(path), exist_ok=True); sheet.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet', default=os.path.join(ROOT, 'art', 'sheets', 'islands-final.png'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'art', 'islands'))
    ap.add_argument('--only'); ap.add_argument('--width', type=int, default=900); ap.add_argument('--white', type=int, default=238)
    ap.add_argument('--cache', default=os.path.expanduser('~/.cache/dino-sr/islands')); ap.add_argument('--fast', action='store_true')
    ap.add_argument('--contact', default=os.path.join(ROOT, 'games', 'dino-match', 'docs', 'screens', 'm11', 'islands-contact.png'))
    a = ap.parse_args()
    rgb = np.asarray(Image.open(a.sheet).convert('RGB')); H, W = rgb.shape[:2]
    boxes = find_islands(rgb, a.white)
    if len(boxes) != len(IDS):
        print(f'ERROR: found {len(boxes)} islands, expected {len(IDS)} (5 x 2 grid with white gaps)', file=sys.stderr)
        for (b, _) in boxes: print(f'  x {b[1].start}-{b[1].stop} y {b[0].start}-{b[0].stop}', file=sys.stderr)
        sys.exit(2)
    only = set(a.only.split(',')) if a.only else None
    pieces, debug = [], []
    os.makedirs(a.out, exist_ok=True)
    for (b, cellmask), id_ in zip(boxes, IDS):
        y0, y1 = max(0, b[0].start - MARGIN), min(H, b[0].stop + MARGIN); x0, x1 = max(0, b[1].start - MARGIN), min(W, b[1].stop + MARGIN)
        outp = os.path.join(a.out, id_ + '.webp')
        if only and id_ not in only:
            if os.path.exists(outp): pieces.append((id_, Image.open(outp).convert('RGBA')))
            continue
        crop = rgb[y0:y1, x0:x1].copy()
        own = ndi.binary_dilation(cellmask[y0:y1, x0:x1], iterations=6)
        crop[~own] = 255                                            # neighbours' bits out
        print(f'{id_:16s} crop {x1 - x0}x{y1 - y0} at ({x0},{y0}) ...', flush=True)
        up = upscale(crop, a.cache, a.fast)
        own4 = np.asarray(Image.fromarray(own.astype(np.uint8) * 255).resize((up.shape[1], up.shape[0]), Image.NEAREST)) > 0
        pk, kept = pockets(crop, a.white, POCKET_R.get(id_, POCKET_R['default']))
        dbg = crop.copy(); dbg[pk] = (255, 0, 0); dbg[kept] = (0, 200, 255); debug.append(Image.fromarray(dbg))
        pocket4 = np.asarray(Image.fromarray(pk.astype(np.uint8) * 255).resize((up.shape[1], up.shape[0]), Image.NEAREST)) > 0
        rgba = cut(up, own4, a.white, pocket4)
        im = Image.fromarray(rgba, 'RGBA'); bb = im.getchannel('A').point(lambda v: 255 if v > 6 else 0).getbbox(); im = im.crop(bb)
        k_ = a.width / im.size[0]
        im = im.resize((a.width, round(im.size[1] * k_)), Image.LANCZOS)
        im.save(outp, quality=90, method=6)
        print(f'{"":16s} -> {outp} {im.size[0]}x{im.size[1]}')
        pieces.append((id_, im))
    order = {k: i for i, k in enumerate(IDS)}; pieces.sort(key=lambda p: order[p[0]])
    if a.contact and pieces: contact(pieces, a.contact); print('contact sheet ->', a.contact)
    if a.contact and debug:
        w = sum(d.size[0] for d in debug); hh = max(d.size[1] for d in debug); im = Image.new('RGB', (w, hh), 'white'); x = 0
        for d in debug: im.paste(d, (x, 0)); x += d.size[0]
        im.save(a.contact.replace('contact', 'pockets'))


if __name__ == '__main__': main()
