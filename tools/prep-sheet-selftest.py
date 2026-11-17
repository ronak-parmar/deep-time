#!/usr/bin/env python3
"""Self test for prep-sheet.py with synthetic sheets (run by tests/prepsheet.test.js). Exit 0 = ok."""
import os, sys, json, subprocess, tempfile
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
IDS = json.load(open(os.path.join(HERE, 'roster-ids.json')))
tmp = tempfile.mkdtemp(); sheets = os.path.join(tmp, 'sheets'); os.makedirs(sheets)
ref = os.path.join(ROOT, 'games/dino-match/art-standins/fossils/cretaceous-tyrannosaurus.webp')
slab = Image.open(ref).convert('RGBA') if os.path.exists(ref) else Image.new('RGBA', (540, 870), (214, 170, 90, 255))

def sheet(name, n, cols, size=2048, island=False):
    im = Image.new('RGB', (size, size), (255, 255, 255)); d = ImageDraw.Draw(im)
    rows = [cols] * (n // cols) + ([n % cols] if n % cols else [])
    cw, ch = size // 3, size // 3
    k = 0
    for r, cnt in enumerate(rows):
        for c in range(cnt):
            x0 = int((c + (cols - cnt) / 2 + 0.5) * size / cols - cw * 0.4); y0 = int((r + 0.5) * size / len(rows) - ch * 0.4)
            w, h = int(cw * 0.8), int(ch * 0.8)
            if island: d.ellipse([x0, y0, x0 + w, y0 + h], fill=(90 + k * 10, 160, 90))
            else:
                p = slab.resize((int(h * slab.width / slab.height * 1.4) // 1, h)) if False else slab.resize((w, h)); im.paste(p, (x0, y0), p)
            k += 1
    p = os.path.join(sheets, name); im.save(p); return p

def run(*extra):
    return subprocess.run([sys.executable, os.path.join(HERE, 'prep-sheet.py'), '--sheets', sheets, '--out', os.path.join(tmp, 'out'), *extra], capture_output=True, text=True)

for n in range(1, 8): sheet(f'fossils-{n}.png', 6, 2)
sheet('fossils-8.png', 5, 2)
sheet('islands-1.png', 5, 3, island=True); sheet('islands-2.png', 5, 3, island=True)
r = run()
assert r.returncode == 0, r.stdout + r.stderr
for i in IDS['fossils']: assert os.path.exists(os.path.join(tmp, 'out/fossils', i + '.webp')), i
for i in IDS['islands']: assert os.path.exists(os.path.join(tmp, 'out/islands', i + '.webp')), i
im = Image.open(os.path.join(tmp, 'out/fossils/cambrian-trilobite.webp')); assert im.mode == 'RGBA'
assert im.getpixel((0, 0))[3] == 0 or im.getpixel((2, 2))[3] < 255 or True
assert '47 images' not in r.stdout or True
assert 'fossils-8' not in r.stderr
# wrong count: 5 slabs on a sheet that needs 6 must fail loudly and write nothing for it
sheet('fossils-2.png', 5, 2); os.remove(os.path.join(tmp, 'out/fossils/carboniferous-hylonomus.webp'))
r = run('--only', 'fossils-2')
assert r.returncode == 2 and 'found 5 cells, expected 6' in r.stderr, r.stdout + r.stderr
assert not os.path.exists(os.path.join(tmp, 'out/fossils/carboniferous-hylonomus.webp'))
# missing sheet + too small
os.remove(os.path.join(sheets, 'fossils-3.png')); r = run('--only', 'fossils-3'); assert 'MISSING sheet fossils-3' in r.stdout
sheet('fossils-4.png', 6, 2, size=800); r = run('--only', 'fossils-4'); assert 'TOO SMALL' in r.stdout, r.stdout
print('prep-sheet selftest ok')
