#!/usr/bin/env python3
"""Turn the owner's sheet of portrait era paintings (side by side, thin dark gaps) into game backgrounds (Dino Match).

usage: prep-era-backgrounds.py <sheet.png> --names triassic,jurassic,... [--art art] [--no-esrgan] [--cache DIR] [--preview p.png]

  1. SPLIT the sheet at its dark gaps (columns much darker than the paintings) into len(names) panels; 2 px trimmed off each side.
  2. UPSCALE each panel x4: Real-ESRGAN x4plus in numpy (tools/esrgan_np.py; ~10-25 min a panel on 2 cores, cached as
     <cache>/<name>-x4.png), or Lanczos + mild unsharp mask with --no-esrgan / when the weights are missing.
  3. FIT to the runtime aspect 768:1360 WITHOUT cutting the sky or the foreground: a few % are cropped at the top and bottom, the
     rest of the extra height is taken out of the MIDDLE band (smoothly, 40-65% of the height, where the board covers the painting).
  4. WRITE art/backgrounds/runtime/<name>.webp (768x1360, quality 85, what the game loads) and art/backgrounds/<name>.jpg
     (1536x2720 master, like the other eras; not bundled: the build only globs backgrounds/*.png and runtime/*.webp).
Needs pillow, numpy, scipy.
"""
import sys, os, argparse
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import map_coordinates

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
RW, RH = 768, 1360; MW, MH = 1536, 2720


def split(rgb, n):
    m = rgb.astype(float).mean((0, 2)); dark = m < 0.45 * np.median(m)
    runs, x = [], 0
    while x < len(m):
        if not dark[x]:
            x0 = x
            while x < len(m) and not dark[x]: x += 1
            runs.append((x0, x))
        x += 1
    runs = sorted(sorted(runs, key=lambda r: r[1] - r[0])[-n:])
    if len(runs) != n: raise SystemExit(f'ERROR: found {len(runs)} panels, expected {n}')
    return [rgb[:, a + 2:b - 2] for a, b in runs]


def upscale(panel, name, cache, use_esrgan):
    p = os.path.join(cache, f'{name}-x4.png')
    if os.path.exists(p):
        up = np.asarray(Image.open(p).convert('RGB'))
        d = up.shape[1] - panel.shape[1] * 4                       # a cache cut from a panel split a few px differently: centre-crop
        if -24 <= d <= 24: return (up[:, d // 2:up.shape[1] - (d - d // 2)] if d > 0 else up), 'esrgan (cached)'
    if use_esrgan:
        try:
            sys.path.insert(0, HERE); import esrgan_np as E
            up = E.upscale(panel, 'RealESRGAN_x4plus'); os.makedirs(cache, exist_ok=True); Image.fromarray(up).save(p); return up, 'esrgan'
        except Exception as e: print(f'note: Real-ESRGAN unavailable ({e}); Lanczos + unsharp', file=sys.stderr)
    im = Image.fromarray(panel).resize((panel.shape[1] * 4, panel.shape[0] * 4), Image.LANCZOS)
    return np.asarray(im.filter(ImageFilter.UnsharpMask(radius=3, percent=70, threshold=2))), 'lanczos'


def fit(up, aspect=RW / RH, top=0.02, bottom=0.03, band=(0.40, 0.65)):
    """crop `top` / `bottom` of the height, then squeeze the middle band so width / height = aspect -> float image"""
    H, W, _ = up.shape; y0, y1 = int(H * top), int(H * (1 - bottom)); src = y1 - y0
    out_h = int(round(W / aspect))
    if out_h >= src: return up[y0:y0 + out_h].astype(float)       # tall enough already: plain crop
    # source rows per output row: 1 outside the band, k inside (smooth cosine shoulders); k solves sum = src
    v = np.arange(out_h) / out_h; b0, b1 = band; sh = 0.06
    w = np.clip(np.minimum((v - b0 + sh) / sh, (b1 + sh - v) / sh), 0, 1); w = 0.5 - 0.5 * np.cos(np.pi * w)
    k = 1 + (src - out_h) / w.sum()
    rows = y0 + np.concatenate([[0], np.cumsum(1 + (k - 1) * w)[:-1]])
    yy, xx = np.meshgrid(rows, np.arange(W), indexing='ij')
    return np.dstack([map_coordinates(up[..., ch].astype(float), [yy, xx], order=3, mode='nearest') for ch in range(3)])


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sheet'); ap.add_argument('--names', required=True); ap.add_argument('--art', default=os.path.join(ROOT, 'art'))
    ap.add_argument('--no-esrgan', action='store_true'); ap.add_argument('--cache', default=os.path.expanduser('~/.cache/dino-sr/backgrounds'))
    ap.add_argument('--preview')
    a = ap.parse_args(argv); names = a.names.split(',')
    rgb = np.asarray(Image.open(a.sheet).convert('RGB'))
    thumbs = []
    for name, panel in zip(names, split(rgb, len(names))):
        up, how = upscale(np.ascontiguousarray(panel), name, a.cache, not a.no_esrgan)
        f = Image.fromarray(np.clip(fit(up), 0, 255).astype(np.uint8))
        master = f.resize((MW, MH), Image.LANCZOS); run = f.resize((RW, RH), Image.LANCZOS)
        run = run.filter(ImageFilter.UnsharpMask(radius=1.2, percent=35, threshold=2))
        os.makedirs(os.path.join(a.art, 'backgrounds/runtime'), exist_ok=True)
        master.save(os.path.join(a.art, f'backgrounds/{name}.jpg'), quality=90, optimize=True)
        run.save(os.path.join(a.art, f'backgrounds/runtime/{name}.webp'), 'WEBP', quality=85, method=6)
        print(f'{name:>11}: panel {panel.shape[1]}x{panel.shape[0]}, upscale {how}, -> runtime {RW}x{RH} webp, master {MW}x{MH} jpg')
        thumbs.append(run.resize((RW // 4, RH // 4)))
    if a.preview:
        sh = Image.new('RGB', (sum(t.width for t in thumbs) + 4 * len(thumbs), thumbs[0].height), (255, 255, 255))
        for i, t in enumerate(thumbs): sh.paste(t, (i * (t.width + 4), 0))
        sh.save(a.preview); print('wrote', a.preview)
    return 0


if __name__ == '__main__':
    sys.exit(main())
