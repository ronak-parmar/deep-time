#!/usr/bin/env python3
"""Cut Gemini gem renders out of their navy background and shrink them to game sprites.

usage: prep-gems.py <src_root> <dst_root> [size]
  src_root/<era>/<colour>.png  (2048px, flat navy background)
  dst_root/<era>/<colour>.png  (size x size, transparent)
Needs: pillow, numpy, scipy.  Safe to re-run; only changed/missing files need rebuilding.
"""
import sys, os
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

BG = np.array([18, 23, 42], float)   # Gemini's flat navy (#0f1424-ish)
HARD = 55      # colour distance under which a pixel counts as background
FEATHER = 30   # width of the soft edge, in colour-distance units

def cut(img):
    rgb = np.asarray(img.convert('RGB'), float)
    dist = np.sqrt(((rgb - BG) ** 2).sum(-1))
    low = dist < HARD
    lab, n = ndi.label(low)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    obj = ~bg
    # keep only the biggest blob (drops Gemini's corner sparkle mark)
    lab2, n2 = ndi.label(obj)
    if n2 > 1:
        sizes = ndi.sum(obj, lab2, range(1, n2 + 1))
        obj = lab2 == (1 + int(np.argmax(sizes)))
    obj = ndi.binary_fill_holes(obj)
    # soft edge: only pixels close to the background fade out
    near_bg = ndi.distance_transform_edt(obj) <= 6
    soft = np.clip((dist - HARD + FEATHER) / FEATHER, 0, 1)
    alpha = np.where(near_bg, np.minimum(1.0, soft + 0.0), 1.0) * obj
    alpha = ndi.gaussian_filter(alpha, 0.8) * obj.astype(float).clip(0, 1) if False else alpha
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

def square_crop(im, pad=0.04):
    a = np.asarray(im)[..., 3]
    ys, xs = np.where(a > 8)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    w, h = x1 - x0 + 1, y1 - y0 + 1
    s = int(max(w, h) * (1 + pad * 2))
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    canvas = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    canvas.paste(im.crop((x0, y0, x1 + 1, y1 + 1)), ((s - w) // 2, (s - h) // 2))
    return canvas

def main():
    src, dst = sys.argv[1], sys.argv[2]
    size = int(sys.argv[3]) if len(sys.argv) > 3 else 192
    done = 0
    for era in sorted(os.listdir(src)):
        d = os.path.join(src, era)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if not f.endswith('.png'):
                continue
            o = os.path.join(dst, era, f)
            os.makedirs(os.path.dirname(o), exist_ok=True)
            im = cut(Image.open(os.path.join(d, f)))
            im = square_crop(im)
            im = im.convert('RGBa').resize((size, size), Image.LANCZOS).convert('RGBA')
            im.save(o, optimize=True)
            done += 1
            print('wrote', o)
    print(done, 'sprites')

if __name__ == '__main__':
    main()
