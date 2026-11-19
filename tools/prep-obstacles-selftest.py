#!/usr/bin/env python3
"""Self test for prep-obstacles-sheet.py with synthetic sheets (run by tests/obstacleart.test.js). Exit 0 = ok.

Builds a 5 x 4 sheet of 20 painted-looking items (each its own colour, white highlights inside, a soft shadow, uneven placement,
narrow white gaps), cuts it, and checks: 20 files named in sheet order, square RGBA at --size, transparent corners, an opaque
centre in the item's own colour (so the order is right), the inner white highlight kept, no light halo on the edge.
Then: a sheet with one empty cell and a sheet whose items touch must both fail (exit 2) and write nothing."""
import os, sys, subprocess, tempfile, importlib.util
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('obs', os.path.join(HERE, 'prep-obstacles-sheet.py')); M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)
NAMES = M.sheet_order()
tmp = tempfile.mkdtemp()
COLS, ROWS, CW, CH = 5, 4, 300, 300
fail = []


def colour(k): return ((37 * k + 60) % 200 + 20, (91 * k + 30) % 180 + 30, (53 * k + 90) % 170 + 40)


def make(path, skip=None, touch=False):
    im = Image.new('RGB', (COLS * CW, ROWS * CH), (254, 254, 253)); sh = Image.new('L', im.size, 0)
    d = ImageDraw.Draw(im); ds = ImageDraw.Draw(sh); rng = np.random.default_rng(3)
    for k in range(len(NAMES)):
        if k == skip: continue
        r, c = divmod(k, COLS); jx, jy = rng.integers(-18, 18, 2)
        m = -8 if touch else 26
        x0, y0, x1, y1 = c * CW + m + jx, r * CH + m + jy, (c + 1) * CW - m + jx, (r + 1) * CH - m + jy
        ds.ellipse([x0 + 10, y1 - 30, x1 - 10, y1 + 4], fill=120)                         # soft drop shadow (grey, should stay)
        d.rounded_rectangle([x0, y0, x1, y1 - 14], radius=40, fill=colour(k), outline=(30, 20, 12), width=6)
        d.ellipse([x0 + 50, y0 + 40, x0 + 90, y0 + 70], fill=(255, 255, 255))           # white highlight inside: must survive
    sh = sh.filter(ImageFilter.GaussianBlur(6)); arr = np.asarray(im).astype(float); s = np.asarray(sh)[..., None] / 255.0
    base = (arr == [254, 254, 253]).all(-1)[..., None]
    arr = np.where(base, arr * (1 - 0.5 * s), arr)
    Image.fromarray(arr.astype(np.uint8)).save(path)


def run(sheet, out, *extra):
    return subprocess.run([sys.executable, os.path.join(HERE, 'prep-obstacles-sheet.py'), sheet, '--out', out, *extra], capture_output=True, text=True)


good = os.path.join(tmp, 'good.png'); make(good)
out = os.path.join(tmp, 'out'); r = run(good, out, '--size', '128', '--preview', os.path.join(tmp, 'contact.png'))
if r.returncode != 0: fail.append('good sheet failed: ' + r.stderr)
else:
    files = sorted(os.listdir(out))
    if files != sorted(n + '.webp' for n in NAMES): fail.append(f'files {files}')
    for k, n in enumerate(NAMES):
        a = np.asarray(Image.open(os.path.join(out, n + '.webp')).convert('RGBA')).astype(int)
        if a.shape != (128, 128, 4): fail.append(f'{n} shape {a.shape}'); continue
        if a[0, 0, 3] > 10 or a[-1, -1, 3] > 10: fail.append(f'{n} corners not transparent')
        cen = a[60:68, 60:68]
        if cen[..., 3].min() < 250: fail.append(f'{n} centre not opaque')
        if np.abs(cen[..., :3].mean((0, 1)) - colour(k)).max() > 12: fail.append(f'{n} centre colour {cen[..., :3].mean((0, 1)).round()} != {colour(k)} (order?)')
        if (a[..., 3] > 250).sum() and not ((a[..., :3].min(-1) > 245) & (a[..., 3] > 250)).any(): fail.append(f'{n} inner white highlight lost')
        edge = (a[..., 3] > 30) & (a[..., 3] < 200)
        if edge.any() and a[edge][:, :3].min(-1).mean() > 200: fail.append(f'{n} light halo on the edge')

bad = os.path.join(tmp, 'empty.png'); make(bad, skip=7); out2 = os.path.join(tmp, 'out2'); r = run(bad, out2)
if r.returncode != 2 or 'empty' not in r.stderr or os.path.exists(out2): fail.append(f'empty cell not caught: {r.returncode} {r.stderr[:200]}')
bad = os.path.join(tmp, 'touch.png'); make(bad, touch=True); out3 = os.path.join(tmp, 'out3'); r = run(bad, out3)
if r.returncode != 2 or os.path.exists(out3): fail.append(f'touching items not caught: {r.returncode} {r.stderr[:200]}')

if fail: print('selftest FAILED\n  ' + '\n  '.join(fail)); sys.exit(1)
print(f'selftest ok ({len(NAMES)} slots, {tmp})')
