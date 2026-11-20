#!/usr/bin/env python3
"""Cut an AI sheet of loose pieces (navy background, regular grid, reading order) into named UI images (Dino Match).

usage: prep-pieces-sheet.py <preset> [sheet.png] [--out DIR] [--preview contact.png] [--dry-run]
  preset map    art/sheets/map-pieces.png -> art/ui/<name>.png   (4x3: level-node coins, map pin, stepping stones, clouds, mist)
  preset icons  art/sheets/ui-icons.png   -> art/ui/icons/<name>.png (4x3: dock / button icons and the tutorial hand)
  preset kit    art/sheets/kit-extra.png  -> art/ui/kit/<name>.webp (3x2: teal medallion, slot plate, speech bubble, card frame, toast, star slot)
The piece names, order and framing of each preset are in PRESETS below. Framing modes:
  coin   square --size; the COIN (not its halo or flame badges) is centred and fills COIN of the square, the same for every coin of
         the sheet (CSS draws the picture COIN-scaled round the node button: game.css .inode::after inset -21.43%)
  fit    square; the piece body fills `fill` of it
  trim   keeps the aspect: trimmed to the alpha box + `pad`, longest side `max` px
  soft   like trim, for white clouds / fog: alpha comes from brightness over the navy (soft, semi-transparent, no navy tint);
         `core` > 0 makes the inside of the cloud opaque (keeps its blue shading), 0 = fully see-through (mist)
Matting (navy un-mixed out of the edge, glow kept) and the grid detection (FAILS LOUDLY, exit 2, unless every cell holds one piece)
are tools/prep-gems-sheet.py's. Needs pillow, numpy, scipy.
"""
import sys, os, argparse, importlib.util
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location('gemsheet', os.path.join(HERE, 'prep-gems-sheet.py')); G = importlib.util.module_from_spec(spec); spec.loader.exec_module(G)

COIN = 0.7
PRESETS = {
    'map': dict(sheet='art/sheets/map-pieces.png', out='art/ui', rows=3, cols=4, pieces=[
        ('node-done', 'coin', {}), ('node-open', 'coin', {}), ('node-locked', 'coin', {}), ('node-current', 'coin', {'halo': True}),
        ('node-hard', 'coin', {'badge': True}), ('node-superhard', 'coin', {'badge': True}), ('map-pin', 'fit', {'size': 160, 'fill': 0.96}), ('step-stone-1', 'trim', {'max': 128}),
        ('step-stone-2', 'trim', {'max': 128}), ('cloud-1', 'soft', {'max': 360, 'core': 1}), ('cloud-2', 'soft', {'max': 280, 'core': 1}), ('mist-1', 'soft', {'max': 512, 'core': 0})]),
    'icons': dict(sheet='art/sheets/ui-icons.png', out='art/ui/icons', rows=3, cols=4, pieces=[
        (n, 'trim', {'max': 128, 'pad': 0.03}) for n in ['dig', 'shop', 'museum', 'settings', 'back', 'play', 'howto', 'info', 'lock', 'check', 'video', 'hand']]),
    'kit': dict(sheet='art/sheets/kit-extra.png', out='art/ui/kit', ext='webp', rows=2, cols=3, pieces=[
        ('medallion-teal', 'trim', {'max': 224, 'pad': 0.02}), ('slot', 'trim', {'max': 560, 'pad': 0.02}), ('bubble', 'trim', {'max': 480, 'pad': 0.02}),
        ('card', 'trim', {'max': 360, 'pad': 0.02}), ('toast', 'trim', {'max': 560, 'pad': 0.02}), ('star-slot', 'trim', {'max': 144, 'pad': 0.02})]),
}
COIN_SIZE = 256


def resize_rgba(col, alpha, w, h):
    pre = np.dstack([col * alpha[..., None], alpha * 255])
    return np.asarray(Image.fromarray(np.clip(pre, 0, 255).round().astype(np.uint8), 'RGBa').resize((w, h), Image.LANCZOS).convert('RGBA'))


def square_at(col, alpha, cx, cy, side, size):
    """square crop of `side` px centred at cx, cy (padded with transparency), resized to size; glow fades out at the edge"""
    H, W = alpha.shape; ox, oy = int(round(cx - side / 2)), int(round(cy - side / 2)); side = int(round(side))
    c2 = np.zeros((side, side, 3)); a2 = np.zeros((side, side))
    y0, x0, y1, x1 = max(0, oy), max(0, ox), min(H, oy + side), min(W, ox + side)
    c2[y0 - oy:y1 - oy, x0 - ox:x1 - ox] = col[y0:y1, x0:x1]; a2[y0 - oy:y1 - oy, x0 - ox:x1 - ox] = alpha[y0:y1, x0:x1]
    out = resize_rgba(c2, a2, size, size).astype(float)
    e = np.minimum.outer(np.minimum(np.arange(size), np.arange(size)[::-1]), np.minimum(np.arange(size), np.arange(size)[::-1]))
    out[..., 3] *= np.clip((e + 0.5) / 4, 0, 1); out[out[..., 3] < 2] = 0
    return Image.fromarray(out.round().astype(np.uint8), 'RGBA')


def trimmed(col, alpha, mx, pad=0.04):
    ys, xs = np.where(alpha > 0.03)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    p = int(round(max(y1 - y0, x1 - x0) * pad)); H, W = alpha.shape
    y0, x0, y1, x1 = max(0, y0 - p), max(0, x0 - p), min(H, y1 + p), min(W, x1 + p)
    h, w = y1 - y0, x1 - x0; k = mx / max(h, w)
    out = resize_rgba(col[y0:y1, x0:x1], alpha[y0:y1, x0:x1], max(1, round(w * k)), max(1, round(h * k))).copy()
    out[out[..., 3] < 2] = 0
    return Image.fromarray(out, 'RGBA')


def soft_matte(rgb, bg, core):
    """white cloud / fog over navy: alpha from brightness above the background, colour un-mixed"""
    lum = rgb.mean(-1) - bg.mean()
    hi = np.percentile(lum[lum > 20], 97) if (lum > 20).any() else 200
    a = np.clip((lum - 3) / max(hi - 3, 1), 0, 1)
    lab, n = ndi.label(a > 0.04)
    if n:
        sizes = ndi.sum(np.ones_like(a), lab, range(1, n + 1)); a = a * np.isin(lab, 1 + np.flatnonzero(sizes >= 0.01 * sizes.max()))
    if core:   # the body of a cloud is opaque: alpha rises to 1 within R px inside its outline
        body = ndi.binary_fill_holes(a > 0.45); R = 0.035 * min(a.shape)
        a = np.maximum(a, np.clip(ndi.distance_transform_edt(body) / R, 0, 1) * (a > 0))
    aa = np.maximum(a, 0.05)[..., None]
    col = np.clip((rgb - (1 - aa) * bg) / aa, 0, 255)
    return col, a


def cut_sheet(path, preset, dry=False, out=None):
    P = PRESETS[preset]; out = out or os.path.join(ROOT, P['out'])
    rgb = np.asarray(Image.open(path).convert('RGB')); bg = G.bg_colour(rgb)
    print(f'sheet {rgb.shape[1]}x{rgb.shape[0]}, background {bg.round().astype(int).tolist()}')
    cells, _ = G.detect(rgb, bg, P['rows'], P['cols'])
    f = rgb.astype(float); mats = []
    for i, (name, mode, o) in enumerate(P['pieces']):
        y0, y1, x0, x1 = cells[i // P['cols']][i % P['cols']]
        cell = f[y0:y1, x0:x1]
        if mode == 'soft': col, a = soft_matte(cell, bg, o['core']); body = a > 0.5
        else: col, a, body = G.matte(cell, bg, keep_all=True, glow=o.get('halo', False))
        mats.append((name, mode, o, col, a, body))
    # the coin diameter: the width of the plain coins' bodies (the halo / badge coins use the same scale)
    widths = [np.ptp(np.where(b)[1]) + 1 for (n, m, o, c, a, b) in mats if m == 'coin' and not o]
    D = float(np.median(widths)) if widths else None
    items = []
    for name, mode, o, col, a, body in mats:
        ys, xs = np.where(body)
        if mode == 'coin':
            cx = (xs.min() + xs.max() + 1) / 2
            cy = ys.max() + 1 - D / 2 if o.get('badge') else (ys.min() + ys.max() + 1) / 2
            im = square_at(col, a, cx, cy, D / COIN, COIN_SIZE)
        elif mode == 'fit':
            cx, cy = (xs.min() + xs.max() + 1) / 2, (ys.min() + ys.max() + 1) / 2
            im = square_at(col, a, cx, cy, max(np.ptp(xs), np.ptp(ys)) / o['fill'], o['size'])
        else:
            im = trimmed(col, a, o['max'], o.get('pad', 0.04))
        fn = os.path.join(out, name + '.' + P.get('ext', 'png')); items.append((name, im))
        print(f'{name:>15}  {mode:<5} -> {im.width}x{im.height}', '' if dry else fn)
        if not dry:
            os.makedirs(out, exist_ok=True)
            if fn.endswith('.webp'): im.save(fn, quality=92, method=6, exact=False)
            else: im.save(fn, optimize=True)
    return items


def preview(items, path, cols=4, cell=300):
    rows = (len(items) + cols - 1) // cols; w = cell * cols
    sheet = Image.new('RGB', (w * 2 + 20, cell * rows), (255, 255, 255))
    for i, bgc in enumerate([(15, 20, 36), (226, 226, 222)]):
        panel = Image.new('RGB', (w, cell * rows), bgc)
        for k, (_, im) in enumerate(items):
            if max(im.size) > cell - 10: im = im.copy(); im.thumbnail((cell - 10, cell - 10), Image.LANCZOS)
            panel.paste(im, ((k % cols) * cell + (cell - im.width) // 2, (k // cols) * cell + (cell - im.height) // 2), im)
        sheet.paste(panel, (i * (w + 20), 0))
    sheet.save(path); print('wrote', path)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('preset', choices=sorted(PRESETS)); ap.add_argument('sheet', nargs='?')
    ap.add_argument('--out'); ap.add_argument('--preview'); ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args(argv)
    sheet = a.sheet or os.path.join(ROOT, PRESETS[a.preset]['sheet'])
    try:
        items = cut_sheet(sheet, a.preset, a.dry_run, a.out)
    except ValueError as e:
        print(f'ERROR {os.path.basename(sheet)}: {e}', file=sys.stderr); return 2
    if a.preview: preview(items, a.preview)
    return 0


if __name__ == '__main__':
    sys.exit(main())
