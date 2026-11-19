#!/usr/bin/env python3
"""TEMPORARY obstacle stand-ins (M11): builds a fake painted sheet in the docs/18 order from the painted UI tiles (art/ui/tile-*.png)
plus drawn cracks / vines / glow, then cuts it with tools/prep-obstacles-sheet.py into art-standins/obstacles/ (end-to-end test of
the pipeline; only used with ?standins in the URL, never shipped). The owner's sheet replaces all of it: art/obstacles/.
usage: python3 games/dino-match/art-standins/make-obstacle-standins.py"""
import os, sys, subprocess, math
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
UI = os.path.join(ROOT, 'art', 'ui'); CELL = 300; S = 220
tile = lambda n: Image.open(os.path.join(UI, n + '.png')).convert('RGBA').resize((S, S), Image.LANCZOS)

def cracks(d, n, col=(25, 15, 8), w=6):
    paths = [[(-0.7, -0.8), (-0.25, -0.35), (-0.4, 0.05), (0.05, 0.3), (0.0, 0.85)], [(0.8, -0.2), (0.35, -0.05), (0.5, 0.45), (0.8, 0.7)],
             [(-0.8, 0.5), (-0.35, 0.4), (-0.2, 0.0)], [(0.1, -0.85), (0.2, -0.4), (0.45, -0.3)]]
    for p in paths[:n]: d.line([(S / 2 + x * S * 0.42, S / 2 + y * S * 0.42) for x, y in p], fill=col, width=w, joint='curve')

def item(base, n=0, extra=None):
    im = tile(base); d = ImageDraw.Draw(im); cracks(d, n)
    if extra: extra(im, d)
    return im

def vine(k):
    def f(im, d):
        for j, (a, b) in enumerate([((10, 60), (210, 170)), ((10, 170), (210, 60))][:k]): d.line([a, (110, 115), b], fill=(40, 120, 50), width=14, joint='curve')
        if k == 1: d.line([(10, 170), (60, 200), (70, 216)], fill=(60, 130, 60), width=10)
    return f
def lava(h):
    def f(im, d):
        g = Image.new('RGBA', im.size, 0); gd = ImageDraw.Draw(g)
        for p in [[(40, 50), (90, 100), (70, 150), (120, 200)], [(180, 50), (130, 110), (170, 170)]]: gd.line(p, fill=(255, 120, 30, 255), width=8 + h * 3)
        im.alpha_composite(g.filter(ImageFilter.GaussianBlur(3))); im.alpha_composite(g)
    return f
def ammonite(im, d):
    pts = [(S / 2 + math.cos(t) * (6 + t * 6), S / 2 + math.sin(t) * (6 + t * 6)) for t in [i * 0.2 for i in range(60)]]; d.line(pts, fill=(250, 235, 200), width=7)
def bone(im, d):
    d.rounded_rectangle([50, 100, 170, 120], 10, fill=(246, 235, 203), outline=(120, 98, 64), width=3)
    for x in (50, 170):
        for y in (98, 122): d.ellipse([x - 14, y - 14, x + 14, y + 14], fill=(246, 235, 203), outline=(120, 98, 64), width=3)
def crate(im, d):
    d.rectangle([0, 0, S, S], fill=(160, 110, 58)); d.rectangle([4, 4, S - 4, S - 4], outline=(60, 34, 12), width=8)
    d.line([(14, 14), (S - 14, S - 14)], fill=(216, 177, 74), width=14); d.line([(S - 14, 14), (14, S - 14)], fill=(216, 177, 74), width=14)
    d.ellipse([S / 2 - 30, S / 2 - 30, S / 2 + 30, S / 2 + 30], fill=(246, 213, 106), outline=(90, 58, 16), width=5)
def relic():
    im = Image.new('RGBA', (S, S), 0); d = ImageDraw.Draw(im)
    d.ellipse([8, 8, S - 8, S - 8], fill=(222, 170, 60), outline=(74, 48, 10), width=8)
    d.polygon([(S / 2, 40), (S - 60, S / 2), (S / 2, S - 40), (60, S / 2)], fill=(90, 58, 16)); d.polygon([(S / 2, 70), (S - 85, S / 2), (S / 2, S - 70), (85, S / 2)], fill=(255, 210, 90))
    return im
def tar():
    im = Image.new('RGBA', (S, S), 0); d = ImageDraw.Draw(im); d.ellipse([10, 20, S - 10, S - 14], fill=(30, 24, 40), outline=(5, 3, 8), width=6)
    d.ellipse([50, 50, 110, 76], fill=(140, 120, 180)); return im

ITEMS = {
    'tar': tar(), 'sandstone-2': item('tile-sand-1'), 'sandstone-1': item('tile-sand-1', 3),
    'fossil-2': item('tile-cracked-1', 0, ammonite), 'fossil-1': item('tile-cracked-1', 2, ammonite), 'bone': item('tile-sand-2', 0, bone),
    'vine-2': item('tile-stone-1', 0, vine(2)), 'vine-1': item('tile-stone-1', 1, vine(1)), 'crate': item('tile-dirt-1', 0, crate),
    'lava-3': item('tile-stone-2', 0, lava(1)), 'lava-2': item('tile-stone-2', 1, lava(1)), 'lava-1': item('tile-stone-2', 3, lava(2)),
    'rock': item('tile-stone-3'), 'artefact': relic(), 'dig-tar': item('tile-dirt-2'),
    'dig-sand-2': item('tile-sand-3'), 'dig-sand-1': item('tile-sand-3', 2), 'dig-stone-3': item('tile-stone-4'), 'dig-stone-2': item('tile-stone-4', 1), 'dig-stone-1': item('tile-stone-4', 3)
}
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import importlib.util
spec = importlib.util.spec_from_file_location('obs', os.path.join(ROOT, 'tools', 'prep-obstacles-sheet.py')); M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)
names = M.sheet_order(); assert sorted(names) == sorted(ITEMS), set(names) ^ set(ITEMS)
sheet = Image.new('RGBA', (CELL * 5, CELL * 4), (255, 255, 255, 255))
for k, n in enumerate(names): r, c = divmod(k, 5); sheet.alpha_composite(ITEMS[n], (c * CELL + (CELL - S) // 2, r * CELL + (CELL - S) // 2))
p = '/tmp/obstacle-standin-sheet.png'; sheet.convert('RGB').save(p)
sys.exit(subprocess.call([sys.executable, os.path.join(ROOT, 'tools', 'prep-obstacles-sheet.py'), p, '--out', os.path.join(HERE, 'obstacles')]))
