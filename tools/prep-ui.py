#!/usr/bin/env python3
"""Cut a painted UI kit sheet into one transparent PNG per element.

usage: prep-ui.py <sheet.png> <map.json> <out_dir> [--preview contact.png] [--max 512] [--merge 6] [--hard 55] [--row-gap 40] [--min-area 400]
  sheet.png  Gemini sheet on a flat navy background (#12172A), elements separated by clear margins
  map.json   {"elements": ["hud-sign", "hud-plaque", null, ...]}  element names in READING ORDER (rows top to bottom,
             left to right inside a row); null skips an element. Variant slots use their file stem, e.g. "tile-cream-1".
  out_dir    usually art/ui. Writes <name>.png (tight crop, transparent, longest side capped at --max px).
Same flood-fill cut as prep-gems.py (background = navy pixels connected to the image border), then connected-component
splitting: pieces closer than --merge px (leaf, vine, rope bits) stay together, tiny specks (< --min-area px) are dropped.
The preview contact sheet numbers every element in reading order, so a wrong mapping is easy to spot and fix.
Needs: pillow, numpy, scipy. Safe to re-run.
"""
import sys, os, json, argparse
import numpy as np
from PIL import Image, ImageDraw
import scipy.ndimage as ndi

BG = np.array([18, 23, 42], float)   # #12172A
HARD, FEATHER = 55, 30               # same thresholds as prep-gems.py

def background_mask(rgb):
    dist = np.sqrt(((rgb - BG) ** 2).sum(-1))
    lab, _ = ndi.label(dist < HARD)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    return np.isin(lab, list(border)), dist

def split(obj, merge, min_area):
    grown = ndi.binary_dilation(obj, iterations=max(1, merge // 2)) if merge else obj
    lab, n = ndi.label(grown)
    areas = ndi.sum(obj, lab, range(1, n + 1))
    boxes = ndi.find_objects(lab)
    items = [(i + 1, boxes[i]) for i in range(n) if areas[i] >= min_area]
    return lab, items

def reading_order(items, row_gap):
    """Group boxes into rows (by vertical centre, gap > row_gap starts a new row), then sort each row left to right."""
    cs = sorted(items, key=lambda it: (it[1][0].start + it[1][0].stop) / 2)
    rows, last = [], None
    for it in cs:
        cy = (it[1][0].start + it[1][0].stop) / 2
        if last is None or cy - last > row_gap: rows.append([])
        rows[-1].append(it); last = cy
    return [it for r in rows for it in sorted(r, key=lambda it: it[1][1].start)]

def cut_element(rgb, dist, obj, lab, idx, box, pad=4, maxside=512):
    ys, xs = box
    y0, y1, x0, x1 = max(0, ys.start - pad), min(rgb.shape[0], ys.stop + pad), max(0, xs.start - pad), min(rgb.shape[1], xs.stop + pad)
    mine = (lab[y0:y1, x0:x1] == idx) | ndi.binary_dilation((lab[y0:y1, x0:x1] == idx) & obj[y0:y1, x0:x1], iterations=2) & obj[y0:y1, x0:x1]
    mine = ndi.binary_fill_holes(mine)
    d = dist[y0:y1, x0:x1]
    near = ndi.distance_transform_edt(mine) <= 6                       # soft edge only where the cut meets the background
    soft = np.clip((d - HARD + FEATHER) / FEATHER, 0, 1)
    alpha = np.where(near, soft, 1.0) * mine
    im = Image.fromarray(np.dstack([rgb[y0:y1, x0:x1], alpha * 255]).astype(np.uint8), 'RGBA')
    if max(im.size) > maxside:
        s = maxside / max(im.size); im = im.convert('RGBa').resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS).convert('RGBA')
    return im

def preview(cuts, names, path):
    cell = 180; cols = 6; rows = (len(cuts) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cell, rows * (cell + 22)), (30, 36, 56, 255)); d = ImageDraw.Draw(sheet)
    for k, im in enumerate(cuts):
        t = im.copy(); t.thumbnail((cell - 12, cell - 12))
        x, y = (k % cols) * cell, (k // cols) * (cell + 22)
        sheet.alpha_composite(t, (x + (cell - t.width) // 2, y + (cell - t.height) // 2))
        d.text((x + 4, y + cell + 4), f'{k + 1}: {names[k] or "(skipped)"}', fill=(240, 240, 255, 255))
    sheet.convert('RGB').save(path)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('sheet'); ap.add_argument('map'); ap.add_argument('out')
    ap.add_argument('--preview'); ap.add_argument('--max', type=int, default=512); ap.add_argument('--merge', type=int, default=6)
    ap.add_argument('--hard', type=float, default=55, help='colour distance counted as background; lower it for very dark elements such as tar tiles'); ap.add_argument('--row-gap', type=float, default=40); ap.add_argument('--min-area', type=int, default=400)
    a = ap.parse_args()
    global HARD; HARD = a.hard
    names = json.load(open(a.map))['elements']
    rgb = np.asarray(Image.open(a.sheet).convert('RGB'), float)
    bg, dist = background_mask(rgb)
    obj = ~bg
    lab, items = split(obj, a.merge, a.min_area)
    ordered = reading_order(items, a.row_gap)
    if len(ordered) != len(names):
        print(f'WARNING: found {len(ordered)} elements but the map names {len(names)}. Check the preview and adjust --merge / --min-area / the map.', file=sys.stderr)
    os.makedirs(a.out, exist_ok=True)
    cuts, used, written = [], set(), 0
    for k, (idx, box) in enumerate(ordered):
        im = cut_element(rgb, dist, obj, lab, idx, box, maxside=a.max); cuts.append(im)
        name = names[k] if k < len(names) else None
        if not name: continue
        if name in used: print(f'WARNING: duplicate name {name}, skipping element {k + 1}', file=sys.stderr); continue
        used.add(name); im.save(os.path.join(a.out, name + '.png'), optimize=True); written += 1; print('wrote', name)
    if a.preview: preview(cuts, [names[k] if k < len(names) else None for k in range(len(cuts))], a.preview)
    print(f'{written} elements written, {len(ordered)} found')

if __name__ == '__main__':
    main()
