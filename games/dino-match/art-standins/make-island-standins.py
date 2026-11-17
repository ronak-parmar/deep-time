#!/usr/bin/env python3
"""Cuts feathered stand-in islands from a reference screenshot (test only; real islands come from art/sheets via tools/prep-sheet.py).
usage: make-island-standins.py reference.jpg"""
import sys, os
from PIL import Image, ImageFilter, ImageDraw
src = Image.open(sys.argv[1]).convert('RGB')
K = src.width / 923.0                       # boxes below are in the 923 px wide preview space
# paint out the reference's numbered level coins and the pin (they would read as level numbers in the game): OpenCV inpaint
COINS = [(210, 1515), (388, 1458), (552, 1380), (745, 1175), (546, 1095), (395, 1030), (147, 935), (256, 845), (361, 766), (769, 730),
         (604, 665), (511, 577), (756, 422), (604, 345), (661, 265)]
try:
    import cv2, numpy as np
    a = cv2.cvtColor(np.array(src), cv2.COLOR_RGB2BGR); m = np.zeros(a.shape[:2], np.uint8)
    for x, y in COINS: cv2.ellipse(m, (int(x * K), int((y + 8) * K)), (int(60 * K), int(50 * K)), 0, 0, 360, 255, -1)
    for x, y in [(210, 1515), (552, 1380)]: cv2.ellipse(m, (int(x * K), int(y * K)), (int(78 * K), int(62 * K)), 0, 0, 360, 255, -1)   # glowing ones
    cv2.ellipse(m, (int(552 * K), int(1295 * K)), (int(70 * K), int(100 * K)), 0, 0, 360, 255, -1)       # the glowing pin
    m = cv2.dilate(m, np.ones((9, 9), np.uint8))
    a = cv2.inpaint(a, m, int(24 * K), cv2.INPAINT_TELEA)
    # soften the filled spots so the smear reads as ground, not a hole
    bl = cv2.GaussianBlur(a, (0, 0), 6 * K); mm = cv2.GaussianBlur(m, (0, 0), 6 * K)[..., None] / 255.0; a = (a * (1 - mm * .6) + bl * mm * .6).astype(np.uint8)
    src = Image.fromarray(cv2.cvtColor(a, cv2.COLOR_BGR2RGB))
except ImportError:
    print('opencv missing: coins stay in the stand-ins')
BOX = {'jungle': (0, 1230, 900, 1800), 'aqua': (200, 900, 910, 1300), 'desert': (0, 650, 530, 1150),
       'swamp': (290, 490, 900, 930), 'ice': (385, 195, 923, 510)}
USE = {'cambrian': 'aqua', 'devonian': 'jungle', 'carboniferous': 'swamp', 'permian': 'desert', 'triassic': 'desert',
       'jurassic': 'swamp', 'cretaceous': 'jungle', 'age-of-mammals': 'jungle', 'ice-age': 'ice', 'early-humans': 'desert'}
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'islands'); os.makedirs(out, exist_ok=True)
cut = {}
for name, b in BOX.items():
    im = src.crop(tuple(int(v * K) for v in b)); w, h = im.size
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).ellipse((w * .04, h * .06, w * .96, h * .94), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(w * .035)); im = im.convert('RGBA'); im.putalpha(m)
    s = 900 / w; cut[name] = im.resize((900, int(h * s)), Image.LANCZOS)
for era, name in USE.items(): cut[name].save(os.path.join(out, era + '.webp'), quality=88)
print('wrote', len(USE), 'stand-ins to', out)
