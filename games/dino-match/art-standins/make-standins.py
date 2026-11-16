#!/usr/bin/env python3
"""Build TEMPORARY stand-in art so the painted-layer pipeline can be tested before the owner's art arrives.
usage: make-standins.py <ui-target.jpg> [out_dir]   (needs pillow, numpy)
Real art goes in art/ (same layout) and wins automatically; delete this folder once every slot is painted."""
import sys, os, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ref = Image.open(sys.argv[1]).convert('RGB')
out = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.abspath(__file__))
K = ref.width / 2000.0          # the reference is shown at 2000 px wide in the brief; crop boxes below use that scale
os.makedirs(out + '/ui', exist_ok=True); os.makedirs(out + '/backgrounds', exist_ok=True)

def crop(box, size, radius=0.18, circle=False):
    im = ref.crop(tuple(int(v * K) for v in box)).convert('RGBA').resize(size, Image.LANCZOS)
    m = Image.new('L', size, 0); d = ImageDraw.Draw(m)
    if circle: d.ellipse([1, 1, size[0] - 2, size[1] - 2], fill=255)
    else: d.rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=int(min(size) * radius), fill=255)
    im.putalpha(m); return im

def save(im, name): im.save(f'{out}/ui/{name}.png', optimize=True)

# ---- cropped from the mockup (clean areas only): tiles, stars, boosters, tablets, gear
for i, box in enumerate([(1700, 880, 1790, 960), (985, 770, 1075, 850), (1290, 880, 1380, 960), (1390, 770, 1480, 850)]):
    save(crop(box, (96, 96), 0.12), f'tile-cream-{i + 1}')
for i, box in enumerate([(880, 560, 980, 650), (985, 560, 1085, 650), (1500, 560, 1600, 650), (1600, 660, 1700, 740)]):
    save(crop(box, (96, 96), 0.12), f'tile-dirt-{i + 1}')
for i, box in enumerate([(1085, 770, 1180, 850), (1500, 770, 1590, 850), (1700, 770, 1790, 850), (1290, 770, 1385, 850)]):
    save(crop(box, (96, 96), 0.12), f'tile-cracked-{i + 1}')
save(crop((745, 70, 850, 175), (96, 96), 0.2), 'gear-button')
save(crop((885, 780, 975, 860), (96, 96), 0.15), 'tablet-skull'); save(crop((885, 880, 975, 960), (96, 96), 0.15), 'tablet-footprint'); save(crop((885, 880, 975, 960), (96, 96), 0.15), 'tablet-fern')
# left panel (the reference's left phone is 650 px wide in the 2000 px view): stars and booster medallions
save(crop((132, 188, 178, 232), (80, 80), 0.5, True), 'star-on'); save(crop((198, 188, 246, 232), (80, 80), 0.5, True), 'star-off')
save(crop((135, 975, 270, 1105), (112, 112), circle=True), 'booster-pick'); save(crop((298, 975, 432, 1105), (112, 112), circle=True), 'booster-burst'); save(crop((462, 975, 598, 1105), (112, 112), circle=True), 'booster-brush')

# ---- procedural plates (the mockup's plates have baked text, so stand-ins are drawn blank)
def vgrad(w, h, top, bot):
    a = np.linspace(0, 1, h)[:, None, None]; t = np.array(top, float); b = np.array(bot, float)
    return Image.fromarray((t * (1 - a) + b * a).repeat(w, 1).astype(np.uint8), 'RGB')
def rrect(size, radius, fill_top, fill_bot, outline=(40, 28, 20), line=6, grain=0.0):
    S = 4; w, h = size[0] * S, size[1] * S
    im = vgrad(w, h, fill_top, fill_bot).convert('RGBA'); m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius * S, fill=255); im.putalpha(m)
    d = ImageDraw.Draw(im); d.rounded_rectangle([0, 0, w - 1, h - 1], radius=radius * S, outline=outline + (255,), width=line * S // 2)
    d.rounded_rectangle([line * S, line * S, w - line * S, h // 2], radius=radius * S, outline=(255, 255, 255, 40), width=S)   # soft top light
    return im.resize(size, Image.LANCZOS)
def circle(size, top, bot, outline=(40, 40, 46), rim=(120, 124, 132)):
    S = 4; w = size[0] * S; im = vgrad(w, w, top, bot).convert('RGBA'); m = Image.new('L', (w, w), 0); ImageDraw.Draw(m).ellipse([0, 0, w - 1, w - 1], fill=255); im.putalpha(m)
    d = ImageDraw.Draw(im); d.ellipse([0, 0, w - 1, w - 1], outline=outline + (255,), width=5 * S // 2)
    d.ellipse([w * 0.13, w * 0.13, w * 0.87, w * 0.87], outline=rim + (255,), width=3 * S // 2); d.ellipse([w * 0.16, w * 0.16, w * 0.84, w * 0.84], fill=(86, 88, 96, 255))
    return im.resize(size, Image.LANCZOS)
STONE = ((150, 150, 156), (104, 104, 112)); WOOD = ((138, 92, 56), (96, 60, 36))
def wood_sign(size):
    im = rrect(size, 10, *WOOD, outline=(58, 34, 20)); d = ImageDraw.Draw(im)
    for y in range(8, size[1], 11): d.line([(6, y), (size[0] - 6, y)], fill=(70, 42, 24, 90), width=1)
    inner = rrect((size[0] - 28, size[1] - 20), 8, *STONE, outline=(62, 62, 70), line=4); im.alpha_composite(inner, (14, 10)); return im
save(wood_sign((280, 112)), 'hud-sign')
save(rrect((320, 96), 14, *STONE, outline=(60, 60, 68)), 'hud-plaque')
save(circle((112, 112), (170, 170, 176), (110, 110, 118)), 'moves-medallion')
t = rrect((180, 112), 10, *WOOD, outline=(58, 34, 20)); t.alpha_composite(rrect((152, 66), 8, *STONE, outline=(62, 62, 70), line=4), (14, 36)); save(t, 'target-sign')
b = rrect((96, 96), 16, *STONE, outline=(60, 60, 68)); d = ImageDraw.Draw(b); d.polygon([(54, 22), (28, 48), (54, 74), (54, 58), (74, 58), (74, 38), (54, 38)], fill=(52, 52, 60, 255)); save(b, 'back-button')
pf = rrect((400, 56), 12, *STONE, outline=(60, 60, 68)); d = ImageDraw.Draw(pf); d.rounded_rectangle([40, 14, 384, 42], radius=8, fill=(44, 40, 38, 255), outline=(30, 26, 24, 255), width=2)
for cx in (14,): d.ellipse([cx, 18, cx + 16, 38], fill=(70, 70, 78, 255))
save(pf, 'progress-frame')
fill = vgrad(360, 28, (255, 190, 70), (230, 120, 20)).convert('RGBA'); m = Image.new('L', (360, 28), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, 359, 27], radius=10, fill=255); fill.putalpha(m); save(fill, 'progress-fill')
for name, col in (('blue', (60, 140, 230)), ('red', (220, 70, 60)), ('green', (70, 180, 90))): save(circle((40, 40), tuple(min(255, v + 40) for v in col), col, outline=(255, 255, 255), rim=col), f'count-badge-{name}')
rnd = random.Random(5); cr = Image.new('RGBA', (128, 128), (0, 0, 0, 0)); d = ImageDraw.Draw(cr)
for _ in range(40): x, y, r = rnd.randint(20, 108), rnd.randint(50, 110), rnd.randint(3, 10); d.ellipse([x - r, y - r, x + r, y + r], fill=(70 + rnd.randint(0, 40), 48, 30, 255))
save(cr.filter(ImageFilter.SMOOTH), 'dirt-crumbs')

# ---- backgrounds: flat-colour placeholders, calm dark centre, brighter edges so parallax drift is visible
ERA = {'cambrian': ((18, 90, 110), (6, 40, 56)), 'devonian': ((20, 90, 74), (6, 40, 32)), 'carboniferous': ((28, 84, 40), (6, 30, 14)), 'permian': ((150, 70, 34), (70, 28, 14)),
       'triassic': ((110, 52, 70), (40, 18, 28)), 'jurassic': ((34, 96, 52), (10, 38, 22)), 'cretaceous': ((190, 90, 100), (80, 34, 44)), 'mammals': ((120, 130, 60), (44, 52, 24)),
       'iceage': ((90, 160, 210), (24, 60, 96)), 'humans': ((96, 62, 36), (30, 18, 10))}
for name, (top, bot) in ERA.items():
    W, H = 540, 960; im = vgrad(W, H, top, bot).convert('RGB'); a = np.asarray(im, float)
    yy, xx = np.mgrid[0:H, 0:W]; r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    a *= (0.55 + 0.45 * np.clip(r, 0, 1.2) ** 1.5)[..., None]           # dark centre
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(im, 'RGBA'); rr = random.Random(name)
    for _ in range(18):                                                  # soft edge lumps standing in for foliage
        side = rr.choice('lrtb'); x = rr.randint(0, 90) if side == 'l' else W - rr.randint(0, 90) if side == 'r' else rr.randint(0, W); y = rr.randint(0, 110) if side == 't' else H - rr.randint(0, 110) if side == 'b' else rr.randint(0, H)
        s = rr.randint(40, 110); d.ellipse([x - s, y - s, x + s, y + s], fill=tuple(min(255, int(v * 1.5)) for v in top) + (70,))
    im.filter(ImageFilter.GaussianBlur(10)).save(f'{out}/backgrounds/{name}.png', optimize=True)

# ---- props for jurassic: leaf clusters (sway) and a lava glow (pulse), transparent
os.makedirs(out + '/props/jurassic', exist_ok=True)
def leaves(anchor_flip):
    S = 300; im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for k in range(9):
        ang = math.radians(10 + k * 9); L = 250 - k * 12
        pts = [(0, 0), (L * 0.5 * math.cos(ang) - 28 * math.sin(ang), L * 0.5 * math.sin(ang) + 28 * math.cos(ang)), (L * math.cos(ang), L * math.sin(ang)), (L * 0.5 * math.cos(ang) + 28 * math.sin(ang), L * 0.5 * math.sin(ang) - 28 * math.cos(ang))]
        d.polygon(pts, fill=(30 + k * 8, 120 + k * 8, 50, 255), outline=(14, 50, 24, 255))
    return im.transpose(Image.FLIP_LEFT_RIGHT) if anchor_flip else im
leaves(False).save(out + '/props/jurassic/leaves-tl.png'); leaves(True).save(out + '/props/jurassic/leaves-tr.png')
g = Image.new('RGBA', (300, 300), (0, 0, 0, 0)); ImageDraw.Draw(g).ellipse([120, 120, 300, 300], fill=(255, 140, 40, 200)); g.filter(ImageFilter.GaussianBlur(24)).save(out + '/props/jurassic/lava-br-glow.png')
print('stand-ins written to', out)
