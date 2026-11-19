#!/usr/bin/env python3
"""Self test for prep-specials-sheet.py with synthetic sheets (run by games/dino-match/tests/specialart.test.js). Exit 0 = ok."""
import os, sys, subprocess, tempfile
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
tmp = tempfile.mkdtemp()
COLS = [(200, 120, 60), (180, 100, 50), (70, 60, 60), (200, 40, 30), (150, 100, 50), (120, 60, 200)]

def sheet(name, n, rows=1, W=1800, H=600, gap_spark=True):
    im = Image.new('RGB', (W, H), (255, 255, 255)); d = ImageDraw.Draw(im)
    cols = (n + rows - 1) // rows; cw, ch = W // cols, H // rows
    for k in range(n):
        r, c = divmod(k, cols); x0, y0 = c * cw + cw // 5, r * ch + ch // 4; x1, y1 = x0 + cw * 3 // 5, y0 + ch // 2
        if k == 1: x0, x1 = x0 + cw // 8, x1 - cw // 8; y0, y1 = r * ch + ch // 8, r * ch + ch * 7 // 8   # tall (vertical firecracker)
        d.rounded_rectangle([x0, y0, x1, y1], radius=20, fill=COLS[k % 6], outline=(40, 20, 10), width=6)
        if gap_spark: d.ellipse([x0 - 30, (y0 + y1) // 2 - 14, x0 - 2, (y0 + y1) // 2 + 14], fill=(255, 220, 90))   # a spark touching the item
        for g in range(3): d.ellipse([x1 + 4 + g * 6, y0 + 10, x1 + 12 + g * 6, y0 + 18], fill=(255, 235, 170))      # soft glow dots
    p = os.path.join(tmp, name); im.save(p); return p

def run(path, *extra):
    return subprocess.run([sys.executable, os.path.join(HERE, 'prep-specials-sheet.py'), path, '--out', os.path.join(tmp, 'out'), *extra], capture_output=True, text=True)

names = ['firecracker-h', 'firecracker-v', 'bomb', 'dynamite', 'tnt', 'rainbow']
r = run(sheet('row.png', 6)); assert r.returncode == 0, r.stdout + r.stderr
for n in names:
    im = Image.open(os.path.join(tmp, 'out', n + '.webp')); assert im.size == (256, 256) and im.mode == 'RGBA', (n, im.size, im.mode)
    assert im.getpixel((0, 0))[3] == 0, n                                         # white cut to alpha
    assert im.getchannel('A').getbbox() is not None, n
v = Image.open(os.path.join(tmp, 'out', 'firecracker-v.webp')).getchannel('A').getbbox(); assert (v[3] - v[1]) > (v[2] - v[0]), 'vertical stays tall'
r = run(sheet('grid.png', 6, rows=2, W=1200, H=900)); assert r.returncode == 0, r.stdout + r.stderr   # a 3 x 2 grid works too
os.remove(os.path.join(tmp, 'out', 'bomb.webp'))
r = run(sheet('five.png', 5)); assert r.returncode == 2 and 'expected 6' in r.stderr, r.stdout + r.stderr
assert not os.path.exists(os.path.join(tmp, 'out', 'bomb.webp')), 'nothing written on a wrong count'
r = run(sheet('five.png', 5), '--one-firecracker'); assert r.returncode == 0, r.stderr
assert os.path.exists(os.path.join(tmp, 'out', 'firecracker.webp')) and not os.path.exists(os.path.join(tmp, 'out', 'firecracker-h.webp'))
r = run(os.path.join(tmp, 'missing.png')); assert r.returncode == 2
print('selftest ok')
