#!/usr/bin/env python3
"""Downscale full-size era backgrounds for runtime (originals are kept untouched).
  python tools/prep-bg.py [art/backgrounds]
Reads <dir>/<era>.jpg|png (e.g. 1536x2720) and writes <dir>/runtime/<era>.webp at 768x1360 (portrait 9:16-ish).
The game only loads <dir>/runtime/*.webp, so 5 MB originals never ship in the APK."""
import sys, pathlib
from PIL import Image
src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parents[1] / 'art' / 'backgrounds')
out = src / 'runtime'; out.mkdir(exist_ok=True)
W, H = 768, 1360
for f in sorted(list(src.glob('*.jpg')) + list(src.glob('*.jpeg')) + list(src.glob('*.png'))):
    im = Image.open(f).convert('RGB')
    r = max(W / im.width, H / im.height)                 # cover, centre crop
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    l, t = (im.width - W) // 2, (im.height - H) // 2
    im.crop((l, t, l + W, t + H)).save(out / (f.stem + '.webp'), quality=80, method=6)
    print(f.name, '->', f'runtime/{f.stem}.webp', (out / (f.stem + '.webp')).stat().st_size // 1024, 'KB')
