#!/usr/bin/env python3
"""Loading-screen backgrounds (Dino Match, M10; docs/19-loading-art.md).

usage:
  make-loading-bg.py --first-paint [art/boot/loading-bg-final.webp] [--out art/boot/loading-bg.webp] [--max-kb 80]
      THE USUAL ONE: the small first-paint copy of the default painting (index.html shows it before any script runs, under the same
      CSS vignette the boot screen lays over the full image, so the hand-over is seamless). Cover-cropped to 9:16, 540x960, plain (no
      blur, no grade), quality lowered step by step until it is under --max-kb.
  make-loading-bg.py [art/backgrounds/carboniferous.jpg] [--out art/boot/loading-bg.webp] [--blur 3] [--size 720x1280] [--quality 74]
      Legacy interim background from an era painting (blurred, graded, vignette baked in); only needed if there is no painting yet.
Takes one of the real painted era backgrounds, cover-crops it to 9:16, blurs it slightly (the logo and the bar are the heroes),
grades it warm, adds a golden glow behind the logo (upper middle) and a warm vignette that darkens the edges and the lower third
toward #2A1A0C (the splash base colour). Small enough (< 80 KB) to be bundled and shown on the very first frame.
Rotation slots (art/boot/loading-<name>.webp, loading-era-<era-id>.webp, portrait 1080x1920) are used as they are: no processing.
Needs pillow, numpy.
"""
import os, sys, argparse
import numpy as np
from PIL import Image, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def treat(src, out, blur=3.0, W=720, H=1280, q=74):
    im = Image.open(src).convert('RGB')
    s = max(W / im.width, H / im.height); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    l, t = (im.width - W) // 2, (im.height - H) // 2; im = im.crop((l, t, l + W, t + H))
    if blur: im = im.filter(ImageFilter.GaussianBlur(blur))
    a = np.asarray(im).astype(float) / 255
    yy, xx = np.mgrid[0:H, 0:W]; cx, cy = W / 2, H * 0.36
    a = a * np.array([1.1, 1.0, 0.8]) + np.array([0.035, 0.015, 0])                       # warm grade
    d = np.sqrt(((xx - cx) / (W * 0.62)) ** 2 + ((yy - cy) / (H * 0.34)) ** 2)            # golden glow behind the logo (screen)
    g = np.clip(1 - d, 0, 1) ** 1.5 * 0.7
    a = 1 - (1 - a) * (1 - g[..., None] * np.array([1.0, 0.76, 0.38]))
    v = np.sqrt(((xx - cx) / (W * 0.75)) ** 2 + ((yy - H * 0.45) / (H * 0.62)) ** 2)      # vignette + darker lower third
    dark = np.clip((v - 0.45) / 0.7, 0, 1) * 0.62 + np.clip((yy / H - 0.62) / 0.38, 0, 1) * 0.35
    base = np.array([0x2A, 0x1A, 0x0C]) / 255
    a = a * (1 - dark[..., None]) + base * dark[..., None]
    os.makedirs(os.path.dirname(out), exist_ok=True)
    Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(out, quality=q, method=6)
    return os.path.getsize(out)

def first_paint(src, out, W=540, H=960, max_kb=80):
    im = Image.open(src).convert('RGB')
    s = max(W / im.width, H / im.height); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    l, t = (im.width - W) // 2, (im.height - H) // 2; im = im.crop((l, t, l + W, t + H))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    for q in range(82, 30, -4):
        im.save(out, quality=q, method=6)
        if os.path.getsize(out) <= max_kb * 1024: return os.path.getsize(out), q
    return os.path.getsize(out), q

if __name__ == '__main__':
    if '--first-paint' in sys.argv:
        ap = argparse.ArgumentParser(); ap.add_argument('--first-paint', action='store_true')
        ap.add_argument('src', nargs='?', default=os.path.join(ROOT, 'art/boot/loading-bg-final.webp'))
        ap.add_argument('--out', default=os.path.join(ROOT, 'art/boot/loading-bg.webp')); ap.add_argument('--max-kb', type=int, default=80)
        a = ap.parse_args()
        if not os.path.exists(a.src): print(f'ERROR: {a.src} not found', file=sys.stderr); sys.exit(2)
        n, q = first_paint(a.src, a.out, max_kb=a.max_kb)
        print(f'{a.out}: 540x960 first-paint copy, {n // 1024} KB (quality {q})' + ('  WARNING: still over the limit' if n > a.max_kb * 1024 else ''))
        sys.exit(0)
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src', nargs='?', default=os.path.join(ROOT, 'art/backgrounds/carboniferous.jpg'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'art/boot/loading-bg.webp'))
    ap.add_argument('--blur', type=float, default=3.0); ap.add_argument('--size', default='720x1280'); ap.add_argument('--quality', type=int, default=74)
    a = ap.parse_args(); W, H = map(int, a.size.split('x'))
    n = treat(a.src, a.out, a.blur, W, H, a.quality)
    print(f'{a.out}: {W}x{H}, {n // 1024} KB' + ('  WARNING: over 80 KB, lower --quality or --size' if n > 80 * 1024 else ''))
