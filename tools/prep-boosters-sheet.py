#!/usr/bin/env python3
"""Cut the AI sheet of booster medallions into art/ui/booster-<id>.png (Dino Match, docs/16).

usage: prep-boosters-sheet.py [art/sheets/boosters.png] [--out art/ui] [--size 256] [--fill 0.94] [--upscale none|lanczos|esrgan]
                              [--preview contact.png] [--dry-run]

The sheet: round medallions on a flat navy background (#0f1424-ish), a regular grid (default 4 columns x 2 rows), clear gaps,
in reading order (top row left to right, then the next row):
    pick, rockslide, brush, amber, tremor, moves5, lucky, start3   (games/dino-match/src/data/boosters.js BOOSTER_IDS order)
Each medallion becomes the UI slot booster-<id> (src/render/artManifest.js). The cutting is tools/prep-gems-sheet.py's: blobs
of non-background pixels assigned to the grid (FAILS LOUDLY, exit 2, nothing written, unless every cell holds one medallion),
navy un-mixed out of the soft glow, the medallion body (thin sparkle spikes ignored) centred and scaled to --fill of the square.
The medallions on the first sheet are ~370 px, bigger than the 256 px output, so no upscale is needed (--upscale esrgan for a small sheet).
Needs pillow, numpy, scipy.
"""
import sys, os, argparse, importlib.util
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
spec = importlib.util.spec_from_file_location('gemsheet', os.path.join(HERE, 'prep-gems-sheet.py')); G = importlib.util.module_from_spec(spec); spec.loader.exec_module(G)

ORDER = ['pick', 'rockslide', 'brush', 'amber', 'tremor', 'moves5', 'lucky', 'start3']


def preview(items, path, cell=280):
    w = cell * 4; rows = (len(items) + 3) // 4; sheet = Image.new('RGB', (w * 2 + 20, cell * rows), (255, 255, 255))
    for i, bgc in enumerate([(15, 20, 36), (226, 226, 222)]):
        panel = Image.new('RGB', (w, cell * rows), bgc)
        for k, (_, im) in enumerate(items):
            panel.paste(im, ((k % 4) * cell + (cell - im.width) // 2, (k // 4) * cell + (cell - im.height) // 2), im)
        sheet.paste(panel, (i * (w + 20), 0))
    sheet.save(path); print('wrote', path)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sheet', nargs='?', default=os.path.join(ROOT, 'art/sheets/boosters.png'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'art/ui'))
    ap.add_argument('--cols', type=int, default=4); ap.add_argument('--rows', type=int, default=2)
    ap.add_argument('--names', default=','.join(ORDER), help='booster ids in reading order')
    ap.add_argument('--size', type=int, default=256); ap.add_argument('--fill', type=float, default=0.94, help='medallion diameter / size')
    ap.add_argument('--upscale', default='none', choices=['none', 'lanczos', 'esrgan'])
    ap.add_argument('--preview'); ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args(argv)
    names = a.names.split(',')
    if len(names) != a.rows * a.cols: print(f'ERROR: {len(names)} names for a {a.cols}x{a.rows} grid', file=sys.stderr); return 2
    rgb = np.asarray(Image.open(a.sheet).convert('RGB')); bg = G.bg_colour(rgb)
    print(f'sheet {rgb.shape[1]}x{rgb.shape[0]}, background {bg.round().astype(int).tolist()}')
    try:
        cells, _ = G.detect(rgb, bg, a.rows, a.cols)
    except ValueError as e:
        print(f'ERROR {os.path.basename(a.sheet)}: {e}', file=sys.stderr); return 2
    up, how, s = G.upscale(a.sheet, rgb, a.upscale); print('upscale:', how)
    upf = up.astype(float); bgu = G.bg_colour(up); items = []
    for i, name in enumerate(names):
        y0, y1, x0, x1 = cells[i // a.cols][i % a.cols]
        col, alpha, body = G.matte(upf[y0 * s:y1 * s, x0 * s:x1 * s], bgu)
        im, bh, bw = G.frame(col, alpha, body, a.size, a.fill * a.size, s)
        o = os.path.join(a.out, f'booster-{name}.png'); items.append((name, im))
        print(f'{name:>10}  body {bw:.0f}x{bh:.0f} px (sheet)', '' if a.dry_run else '-> ' + o)
        if not a.dry_run: os.makedirs(a.out, exist_ok=True); im.save(o, optimize=True)
    if a.preview: preview(items, a.preview)
    return 0


if __name__ == '__main__':
    sys.exit(main())
