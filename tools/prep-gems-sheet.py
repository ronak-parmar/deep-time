#!/usr/bin/env python3
"""Cut an AI gem SHEET (one gem per cell, flat navy background) into game sprites art/sprites/<era>/<colour>.png (Dino Match).

usage: prep-gems-sheet.py <sheet.png> <out_root> --eras permian,triassic,... [--colours red,green,...] [--size 192] [--fill 178]
                          [--no-esrgan] [--preview contact.png] [--dry-run]

The sheet: a regular grid, flat dark navy background (#0f1424-ish, the same as tools/prep-gems.py), clear gaps, no text.
  columns, left to right = colours (default: CONFIG.gemKinds order: red, green, blue, yellow, purple, amber)
  rows, top to bottom    = --eras (art/sprites folder names, e.g. permian,triassic,jurassic,cretaceous,mammals,iceage,humans)
Steps:
  1. UPSCALE the whole sheet x4 with Real-ESRGAN x4plus in numpy (tools/esrgan_np.py, ~30 min on 2 cores for a 1200 px sheet),
     cached per sheet hash in ~/.cache/dino-sr/sheets. Falls back to Lanczos + mild unsharp mask when the weights are unavailable.
  2. DETECT the gems as connected blobs of non-background pixels on the original sheet and assign them to the rows x cols grid by
     their centres (the biggest gaps split rows / columns). FAILS LOUDLY (exit 2, nothing written) unless every cell holds one gem.
  3. MATTE each cell: alpha ramps with the colour distance from the navy (keeps the soft glow and sparkles), the solid gem body is
     opaque, colours of the soft pixels are un-mixed from the navy (no dark fringe), only the blob touching the gem is kept.
  4. FRAME like the existing sprites: the gem BODY (alpha > 0.5, thin sparkle spikes ignored) is centred and its longest side
     scaled to --fill px of the --size px square (the cambrian/devonian/carboniferous sprites: 178 of 192); glow fades out at the
     square's edge instead of being cut hard. Premultiplied Lanczos downsample, RGBA png.
--preview: contact sheet of every era folder in out_root (eras.js order), each row an era, on navy and on a light grey.
Needs pillow, numpy, scipy.
"""
import sys, os, re, argparse, hashlib
import numpy as np
from PIL import Image, ImageFilter
import scipy.ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
COLOURS = ['red', 'green', 'blue', 'yellow', 'purple', 'amber']   # games/dino-match/src/core/config.js gemKinds
ERAS_JS = os.path.join(ROOT, 'games/dino-match/src/core/eras.js')
S = 4            # upscale factor
DETECT = 40      # colour distance (1x sheet) that marks a gem pixel for blob detection
LO, HI = 10, 70  # alpha ramp: distance <= LO is background, >= HI opaque (only outside the solid body)
HARD = 55        # tools/prep-gems.py: distance over which a pixel is solid gem (holes filled)


def bg_colour(rgb):
    b = np.concatenate([rgb[:4].reshape(-1, 3), rgb[-4:].reshape(-1, 3), rgb[:, :4].reshape(-1, 3), rgb[:, -4:].reshape(-1, 3)])
    return np.median(b.astype(float), 0)


def upscale(path, rgb, mode='esrgan'):
    """mode esrgan | lanczos | none -> (image, how, factor)"""
    if mode == 'none': return rgb, 'none', 1
    if mode == 'esrgan':
        try:
            sys.path.insert(0, HERE); import esrgan_np as E
            h = hashlib.sha1(open(path, 'rb').read()).hexdigest()[:16]
            p = os.path.join(E.CACHE, 'sheets', f'{h}-x4.png')
            if not os.path.exists(p):
                os.makedirs(os.path.dirname(p), exist_ok=True)
                print(f'upscaling sheet x4 (Real-ESRGAN x4plus, numpy; slow, cached in {p})...', flush=True)
                Image.fromarray(E.upscale(rgb, 'RealESRGAN_x4plus', tile=100)).save(p + '.part.png'); os.replace(p + '.part.png', p)
            up = np.asarray(Image.open(p).convert('RGB'))
            if up.shape[:2] == (rgb.shape[0] * S, rgb.shape[1] * S): return up, 'esrgan', S
        except Exception as e:  # no weights / no network
            print(f'note: Real-ESRGAN unavailable ({e}); using Lanczos + unsharp mask', file=sys.stderr)
    im = Image.fromarray(rgb).resize((rgb.shape[1] * S, rgb.shape[0] * S), Image.LANCZOS)
    return np.asarray(im.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))), 'lanczos', S


def split(vals, n):
    """indices of vals grouped into n bands, split at the n-1 biggest gaps -> band index per value"""
    order = np.argsort(vals); gaps = np.diff(np.asarray(vals)[order])
    cuts = set(np.argsort(gaps)[::-1][:n - 1].tolist()); band = np.zeros(len(vals), int); b = 0
    for k, i in enumerate(order):
        band[i] = b
        if k in cuts: b += 1
    return band


def detect(rgb, bg, rows, cols):
    """-> grid[r][c] = (y0, y1, x0, x1) cell box on the 1x sheet, or raise ValueError"""
    dist = np.sqrt(((rgb.astype(float) - bg) ** 2).sum(-1))
    lab, n = ndi.label(dist > DETECT)
    area = ndi.sum(np.ones_like(dist), lab, range(1, n + 1)); big = np.argsort(area)[::-1][:rows * cols]
    keep = [i for i in big if area[i] > 0.25 * np.median(area[big])]
    if len(keep) != rows * cols: raise ValueError(f'found {len(keep)} gem blobs, expected {rows}x{cols} = {rows * cols}')
    sl = ndi.find_objects(lab)
    boxes = [(sl[i][0].start, sl[i][0].stop, sl[i][1].start, sl[i][1].stop) for i in keep]
    cy = [(b[0] + b[1]) / 2 for b in boxes]; cx = [(b[2] + b[3]) / 2 for b in boxes]
    rb, cb = split(cy, rows), split(cx, cols)
    grid = [[None] * cols for _ in range(rows)]
    for b, r, c in zip(boxes, rb, cb):
        if grid[r][c] is not None: raise ValueError(f'two blobs in row {r} col {c}: {grid[r][c]} and {b}')
        grid[r][c] = b
    if any(g is None for row in grid for g in row): raise ValueError('a grid cell holds no gem')
    # cell edges: halfway across the gap between neighbouring bands
    H, W = dist.shape
    ry = [(min(grid[r][c][0] for c in range(cols)), max(grid[r][c][1] for c in range(cols))) for r in range(rows)]
    cx_ = [(min(grid[r][c][2] for r in range(rows)), max(grid[r][c][3] for r in range(rows))) for c in range(cols)]
    ey = [0] + [(ry[i][1] + ry[i + 1][0]) // 2 for i in range(rows - 1)] + [H]
    ex = [0] + [(cx_[i][1] + cx_[i + 1][0]) // 2 for i in range(cols - 1)] + [W]
    return [[(ey[r], ey[r + 1], ex[c], ex[c + 1]) for c in range(cols)] for r in range(rows)], grid


def matte(rgb, bg, keep_all=False, glow=False):
    """rgb: one cell (upscaled, float) -> (straight colour, alpha 0..1, body mask).
    keep_all: keep every sizeable blob of the cell (pieces drawn in parts, like the dot of an "i"), not just the biggest
    glow: a wide light halo round the piece: outside the solid body alpha is the least that explains the pixel as light over the
          navy (bright, see-through glow instead of a dark brown ring)"""
    dist = np.sqrt(((rgb - bg) ** 2).sum(-1))
    ramp = np.clip((dist - LO) / (HI - LO), 0, 1)
    # the gem: biggest blob of clearly non-background pixels; plus everything soft that touches it (glow, sparkles)
    lab, n = ndi.label(dist > DETECT)
    sizes = ndi.sum(np.ones_like(dist), lab, range(1, n + 1))
    core = np.isin(lab, 1 + np.flatnonzero(sizes >= 0.02 * sizes.max())) if keep_all else lab == (1 + int(np.argmax(sizes)))
    lab2, _ = ndi.label(ramp > 0)
    own = np.isin(lab2, np.unique(lab2[core])) & (lab2 > 0)
    solid = ndi.binary_fill_holes(ndi.binary_closing(dist > HARD, iterations=2) & own)
    solid = ndi.binary_erosion(solid, iterations=3)          # rim pixels keep their ramp (anti-aliased edge)
    if glow: ramp = np.clip(((rgb - bg) / (255 - bg)).max(-1), 0, 1)
    alpha = np.where(solid, 1.0, ramp) * own
    alpha = np.maximum(alpha, ndi.gaussian_filter(solid.astype(float), 1.0) * own)
    # un-mix the navy: C = a*F + (1-a)*BG  ->  F = (C - (1-a)*BG) / a
    a = np.maximum(alpha, 1e-3)[..., None]
    col = np.clip((rgb - (1 - a) * bg) / a, 0, 255)
    body = ndi.binary_opening(alpha > 0.5, structure=np.ones((3, 3)), iterations=6)   # drops thin sparkle spikes
    return col, alpha, body


def frame(col, alpha, body, size, fill, s=S):
    ys, xs = np.where(body)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    k = fill / max(y1 - y0, x1 - x0)                         # upscaled px -> output px
    side = int(round(size / k)); cy, cx = (y0 + y1) / 2, (x0 + x1) / 2
    oy, ox = int(round(cy - side / 2)), int(round(cx - side / 2))
    H, W = alpha.shape; pre = np.dstack([col * alpha[..., None], alpha * 255])
    canvas = np.zeros((side, side, 4))
    sy0, sx0, sy1, sx1 = max(0, oy), max(0, ox), min(H, oy + side), min(W, ox + side)
    canvas[sy0 - oy:sy1 - oy, sx0 - ox:sx1 - ox] = pre[sy0:sy1, sx0:sx1]
    out = np.asarray(Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8), 'RGBa').resize((size, size), Image.LANCZOS).convert('RGBA')).astype(float)
    # glow that reaches the square's edge fades out over the outer 4 px instead of being cut
    e = np.minimum.outer(np.minimum(np.arange(size), np.arange(size)[::-1]), np.minimum(np.arange(size), np.arange(size)[::-1]))
    out[..., 3] *= np.clip((e + 0.5) / 4, 0, 1)
    out[out[..., 3] < 2] = 0
    return Image.fromarray(out.round().astype(np.uint8), 'RGBA'), (y1 - y0) / s, (x1 - x0) / s


def era_order(out_root):
    have = [d for d in os.listdir(out_root) if os.path.isdir(os.path.join(out_root, d))]
    order = re.findall(r"dir: '([^']+)'", open(ERAS_JS).read()) if os.path.exists(ERAS_JS) else []
    return [d for d in order if d in have] + sorted(d for d in have if d not in order)


def preview(out_root, colours, path, cell=200):
    eras = era_order(out_root); w, h = cell * len(colours), cell * len(eras)
    sheet = Image.new('RGB', (w * 2 + 20, h), (255, 255, 255))
    for i, bgc in enumerate([(15, 20, 36), (226, 226, 222)]):
        panel = Image.new('RGB', (w, h), bgc)
        for r, era in enumerate(eras):
            for c, k in enumerate(colours):
                p = os.path.join(out_root, era, k + '.png')
                if os.path.exists(p):
                    im = Image.open(p).convert('RGBA'); panel.paste(im, (c * cell + (cell - im.width) // 2, r * cell + (cell - im.height) // 2), im)
        sheet.paste(panel, (i * (w + 20), 0))
    sheet.save(path); print('wrote', path, '(rows:', ', '.join(eras) + ')')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sheet'); ap.add_argument('out_root')
    ap.add_argument('--eras', required=True, help='comma-separated art/sprites folder names, one per sheet row (top to bottom)')
    ap.add_argument('--colours', default=','.join(COLOURS), help='comma-separated colour names, one per sheet column')
    ap.add_argument('--size', type=int, default=192); ap.add_argument('--fill', type=float, default=178, help='gem body longest side, px')
    ap.add_argument('--no-esrgan', action='store_true'); ap.add_argument('--preview'); ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args(argv)
    eras, colours = a.eras.split(','), a.colours.split(',')
    rgb = np.asarray(Image.open(a.sheet).convert('RGB')); bg = bg_colour(rgb)
    print(f'sheet {rgb.shape[1]}x{rgb.shape[0]}, background {bg.round().astype(int).tolist()}')
    try:
        cells, blobs = detect(rgb, bg, len(eras), len(colours))
    except ValueError as e:
        print(f'ERROR {os.path.basename(a.sheet)}: {e}', file=sys.stderr); return 2
    up, how, s = upscale(a.sheet, rgb, 'lanczos' if a.no_esrgan else 'esrgan'); print('upscale:', how)
    upf = up.astype(float); bg4 = bg_colour(up)
    for r, era in enumerate(eras):
        for c, k in enumerate(colours):
            y0, y1, x0, x1 = cells[r][c]
            col, alpha, body = matte(upf[y0 * s:y1 * s, x0 * s:x1 * s], bg4)
            im, bh, bw = frame(col, alpha, body, a.size, a.fill, s)
            o = os.path.join(a.out_root, era, k + '.png')
            print(f'{era:>14}/{k:<7} cell {x1 - x0}x{y1 - y0}  body {bw:.0f}x{bh:.0f} px (sheet)', '' if a.dry_run else '-> ' + o)
            if not a.dry_run:
                os.makedirs(os.path.dirname(o), exist_ok=True); im.save(o, optimize=True)
    if a.preview: preview(a.out_root, colours, a.preview)
    return 0


if __name__ == '__main__':
    sys.exit(main())
