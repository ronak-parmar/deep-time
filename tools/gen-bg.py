#!/usr/bin/env python3
"""Procedural painterly era backgrounds (no external generators). Same layout as the four painted ones:
calm dark centre for the board, scenery on the left/right edges, sky on top, ground at the bottom.
  python tools/gen-bg.py [era ...]        default: all six missing eras
Writes art/backgrounds/runtime/<era>.webp at 768x1360 (what the game loads) and a contact sheet to
art/backgrounds/_procedural-sheet.png. Deterministic (seeded). Needs numpy, scipy, pillow."""
import sys, math, pathlib
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'art' / 'backgrounds' / 'runtime'
W, H = 1024, 1813                                  # work size; downscaled to 768x1360
def hexc(s): s = s.lstrip('#'); return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255
def mixc(a, b, t): return a * (1 - t) + b * t

class Cv:
    def __init__(s, seed):
        s.r = np.random.default_rng(seed); s.a = np.zeros((H, W, 3), np.float32)
        s.yy, s.xx = np.mgrid[0:H, 0:W].astype(np.float32)
    def noise(s, scale, aniso=(1, 1)):
        h, w = max(2, int(H / scale / aniso[0])), max(2, int(W / scale / aniso[1]))
        g = s.r.random((h, w)).astype(np.float32)
        return ndi.zoom(g, (H / h, W / w), order=3)[:H, :W]
    def fbm(s, scale=120, octs=4, aniso=(1, 1)):
        n = np.zeros((H, W), np.float32); amp = 1; tot = 0
        for _ in range(octs): n += amp * s.noise(scale, aniso); tot += amp; amp *= .5; scale /= 2
        return n / tot
    def sky(s, stops):                                # stops: [(t, '#hex')] over y 0..1
        t = s.yy[:, :1] / H; out = np.zeros((H, 1, 3), np.float32)
        ts = [p[0] for p in stops]; cs = [hexc(p[1]) for p in stops]
        for c in range(3): out[:, :, c] = np.interp(t, ts, [x[c] for x in cs])
        s.a[:] = out
    def glow(s, cx, cy, rad, col, k=1.0, sy=1.0):
        d = ((s.xx - cx) ** 2 + ((s.yy - cy) / sy) ** 2) / rad ** 2
        s.a += hexc(col)[None, None, :] * (np.exp(-d * 2.2) * k)[..., None]
    def blend(s, col, alpha):                          # alpha: HxW
        s.a = s.a * (1 - alpha[..., None]) + hexc(col)[None, None, :] * alpha[..., None]
    def stamp(s, m, col, col2=None, rim=0.55, tex=0.22, outline=0.55, haze=None, hazek=0.0, lit='#ffffff', litk=0.0):
        """m: PIL L mask. Lambert-ish bevel from the mask itself, vertical colour gradient, brushy noise."""
        a = np.asarray(m, np.float32) / 255; a = ndi.gaussian_filter(a, 0.9)
        if a.max() < .01: return
        h = ndi.gaussian_filter(a, 6); gy, gx = np.gradient(h)
        sh = np.clip((gx * .6 + gy * .8) * 14, -1, 1)
        c1 = hexc(col); c2 = hexc(col2) if col2 else c1
        ys = np.where(a > .3)[0]; y0, y1 = ys.min(), ys.max() + 1
        t = np.clip((s.yy - y0) / max(1, y1 - y0), 0, 1)[..., None]
        base = c1 * (1 - t) + c2 * t
        n = (s.fbm(34, 3, (1, .4)) - .5)[..., None] * 2
        base = base * (1 + tex * n)
        base = base * (1 + rim * sh[..., None] * .8)
        edge = np.clip(a - ndi.gaussian_filter(a, 2.4) * 1.0, 0, 1) * 2.2
        base = base * (1 - outline * np.clip(edge, 0, 1)[..., None])
        if litk: base = base + hexc(lit)[None, None, :] * (np.clip(sh, 0, 1) * litk)[..., None]
        if haze is not None: base = mixc(base, hexc(haze)[None, None, :], hazek)
        s.a = s.a * (1 - a[..., None]) + base * a[..., None]
    def finish(s, calm, calm_a=.82, cx=.5, hw=.27, top=.1, bot=.92, grain=.035):
        m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
        d.rounded_rectangle([W * (cx - hw), H * top, W * (cx + hw), H * bot], radius=int(W * .3), fill=255)
        m = ndi.gaussian_filter(np.asarray(m, np.float32) / 255, 70)
        n = s.fbm(260, 3)
        tone = hexc(calm)[None, None, :] * (.8 + .4 * n)[..., None]
        s.a = s.a * (1 - m[..., None] * calm_a * .75) + (tone * (m[..., None] * calm_a * .75)) * 1
        s.a = s.a * (1 - m[..., None] * .22)            # extra darkening, keeps a faint texture of the scenery
        # edge vignette
        v = np.clip(((s.xx - W / 2) / (W * .75)) ** 2 + ((s.yy - H / 2) / (H * .72)) ** 2, 0, 1)
        s.a *= (1 - .38 * v)[..., None]
        s.a += (s.r.random((H, W, 1)).astype(np.float32) - .5) * grain
        return Image.fromarray((np.clip(s.a, 0, 1) * 255).astype(np.uint8)).resize((768, 1360), Image.LANCZOS)

def new_mask(): im = Image.new('L', (W, H), 0); return im, ImageDraw.Draw(im)
def wob(r, n, amp, base=1.0):
    ph = r.random(4) * 6.28; k = np.arange(n) / n * 6.28
    return base + amp * (np.sin(k * 2 + ph[0]) * .5 + np.sin(k * 3 + ph[1]) * .3 + np.sin(k * 5 + ph[2]) * .2)
def rock(d, r, cx, cy, rw, rh, n=18, amp=.18):
    w = wob(r, n, amp); pts = [(cx + math.cos(i / n * 6.283) * rw * w[i], cy + math.sin(i / n * 6.283) * rh * w[i]) for i in range(n)]
    d.polygon(pts, fill=255)
def ridge(d, r, y0, amp, x0=0, x1=W, scale=260, bottom=H):
    xs = np.arange(x0, x1, 8); n = np.zeros(len(xs)); sc = scale; a = 1
    for _ in range(4):
        n += a * np.interp(xs / sc, np.arange(0, 40), r.random(40)); a *= .5; sc /= 2
    n /= 1.875; pts = [(x, y0 + (v - .5) * amp * 2) for x, v in zip(xs, n)]
    d.polygon(pts + [(x1, bottom), (x0, bottom)], fill=255)
def bez(p0, p1, p2, n=14):
    t = np.linspace(0, 1, n)[:, None]; p0, p1, p2 = map(np.array, (p0, p1, p2))
    return (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t ** 2 * p2
def frond(d, x, y, length, ang, droop, wid=7, leaf=.34, n=16, leaflets=True):
    ex, ey = x + math.cos(ang) * length, y + math.sin(ang) * length
    mid = (x + math.cos(ang) * length * .55, y + math.sin(ang) * length * .55 - length * droop * .5)
    pts = bez((x, y), mid, (ex, ey + length * droop * .6), n)
    for i in range(len(pts) - 1):
        t = i / (len(pts) - 1); w = max(1, int(wid * (1 - t * .8)))
        d.line([tuple(pts[i]), tuple(pts[i + 1])], fill=255, width=w)
        if leaflets and i > 1:
            dx, dy = pts[i + 1] - pts[i]; L = math.hypot(dx, dy) or 1; nx, ny = -dy / L, dx / L
            ll = length * leaf * math.sin(math.pi * min(1, t * 1.05)) ** .8
            for sgn in (-1, 1):
                tip = (pts[i][0] + (nx * sgn * .8 + dx / L * .7) * ll, pts[i][1] + (ny * sgn * .8 + dy / L * .7) * ll + ll * .25)
                d.line([tuple(pts[i]), tip], fill=255, width=max(1, int(wid * .45 * (1 - t * .5))))
def trunk(d, r, x, y0, y1, w0, w1, lean=0, root=True):
    n = 14; ys = np.linspace(y0, y1, n); pts_l, pts_r = [], []
    for i, y in enumerate(ys):
        t = i / (n - 1); w = w0 + (w1 - w0) * t; cx = x + lean * (1 - t) + math.sin(t * 5 + x) * w * .05
        pts_l.append((cx - w / 2, y)); pts_r.append((cx + w / 2, y))
    d.polygon(pts_l + pts_r[::-1], fill=255)
    if root:
        d.polygon([(x - w1 / 2 - w1 * .5, y1), (x - w1 / 2, y1 - w1), (x + w1 / 2, y1 - w1), (x + w1 / 2 + w1 * .5, y1)], fill=255)
def conifer(d, x, y, h, w, tiers=7):
    d.rectangle([x - w * .05, y - h * .1, x + w * .05, y], fill=255)
    for i in range(tiers):
        t = i / tiers; ty = y - h * .08 - t * h * .92; tw = w * (1 - t * .85) * .5
        d.polygon([(x - tw, ty), (x, ty - h * .22), (x + tw, ty)], fill=255)
def blades(d, r, x0, x1, y, hmin, hmax, n):
    for _ in range(n):
        x = r.uniform(x0, x1); h = r.uniform(hmin, hmax); b = r.uniform(-.5, .5) * h * .5; w = r.uniform(5, 11)
        d.polygon([(x - w, y), (x + b, y - h), (x + w, y)], fill=255)
def vine(d, r, x, y, length, leaf=16):
    ph = r.random() * 6; pts = [(x + math.sin(ph + i * .45) * 14, y + i * length / 24) for i in range(25)]
    d.line(pts, fill=255, width=4)
    for i in range(3, 25, 3):
        px, py = pts[i]; sg = 1 if i % 2 else -1
        d.ellipse([px - leaf * .5 + sg * leaf * .6, py - leaf * .3, px + leaf * .5 + sg * leaf * .6, py + leaf * .5], fill=255)
def edge_x(r, side, lo=0.0, hi=0.27):                  # random x in the left/right scenery band
    return (r.uniform(lo, hi) if side < 0 else 1 - r.uniform(lo, hi)) * W
def particles(cv, r, n, col, size=(1.5, 4), alpha=.7, band=(0, 1)):
    m, d = new_mask()
    for _ in range(n):
        x, y = r.uniform(0, W), r.uniform(H * band[0], H * band[1]); s = r.uniform(*size); d.ellipse([x - s, y - s, x + s, y + s], fill=int(255 * alpha))
    a = ndi.gaussian_filter(np.asarray(m, np.float32) / 255, .8)
    cv.a += hexc(col)[None, None, :] * a[..., None]
def clouds(cv, col, alpha, band, seed, scale=300):
    n = cv.fbm(scale, 4, (1, 2.2)); n = np.clip((n - .5) * 3.2 + .35, 0, 1)
    yy = (cv.yy / H); band_m = np.exp(-((yy - np.mean(band)) / ((band[1] - band[0]) / 2.2)) ** 2)
    cv.blend(col, np.clip(n * band_m * alpha, 0, 1))

# ---------------------------------------------------------------- eras
def triassic():
    cv = Cv(31); r = cv.r
    cv.sky([(0, '#2c1a2e'), (.28, '#6e2f3a'), (.5, '#c4553a'), (.64, '#f09a52'), (1, '#4a2418')])
    cv.glow(W * .5, H * .62, 520, '#ff9a4a', .5, .6); clouds(cv, '#3b2230', .8, (.05, .4), 1)
    clouds(cv, '#8a4a44', .35, (.3, .55), 2, 240)
    m, d = new_mask()
    prof = [(-40, H * .6), (W * .05, H * .5), (W * .13, H * .4), (W * .2, H * .325), (W * .235, H * .298), (W * .255, H * .298), (W * .29, H * .33), (W * .35, H * .41), (W * .45, H * .52), (W * .6, H * .62), (W * .6, H), (-40, H)]
    d.polygon(prof, fill=255); d.ellipse([W * .22, H * .288, W * .27, H * .31], fill=0)
    cv.stamp(m, '#4a2430', '#6a3238', haze='#c4553a', hazek=.3, tex=.3)
    cv.glow(W * .245, H * .292, 160, '#ff6a2a', 1.0); cv.glow(W * .245, H * .292, 60, '#ffd27a', .9)
    m, d = new_mask()                                  # lava streaks down the cone
    for dx in (-60, -15, 40):
        pts = [(W * .245 + dx * .2, H * .3)] + [(W * .245 + dx + math.sin(i) * 12 + i * dx * .05, H * .3 + i * 38) for i in range(1, 7)]
        d.line(pts, fill=255, width=7)
    cv.stamp(m, '#ff7a2e', '#ffc25a', rim=0, outline=0, tex=.1); cv.glow(W * .245, H * .38, 140, '#ff6a2a', .35, 1.8)
    m, d = new_mask(); ridge(d, r, H * .64, 40, scale=200); cv.stamp(m, '#4a2422', '#2e1620', haze='#c4553a', hazek=.28)
    for side in (-1, 1):                               # red-brown buttes on the edges
        m, d = new_mask()
        mb, db = new_mask()
        for i in range(4):
            x = edge_x(r, side, .0, .17); w = r.uniform(60, 115); top = H * r.uniform(.42, .64); k = side
            pts = [(x - w * 1.25, H * .92), (x - w * .95, top + 140), (x - w * .8, top + 40), (x - w * .55, top), (x + w * .55, top - 8), (x + w * .85, top + 50), (x + w * 1.0, top + 150), (x + w * 1.3, H * .92)]
            d.polygon(pts, fill=255)
            for q in range(6): db.line([(x - w * 1.0, top + 50 + q * 62), (x + w * 1.0, top + 40 + q * 62 + r.uniform(-8, 8))], fill=255, width=7)
        mb = Image.fromarray((np.minimum(np.asarray(mb), np.asarray(m)))); cv.stamp(m, '#a2583a', '#5a2c1c', tex=.3, haze='#c4553a', hazek=.1, litk=.1, lit='#ffc080'); cv.stamp(mb, '#5a2c1e', '#3a1c14', tex=.2, outline=0, rim=0); continue
        cv.stamp(m, '#8a4a30', '#4a2418', tex=.3, haze='#c4553a', hazek=.12)
    for side in (-1, 1):                               # cycads
        m, d = new_mask()
        for i in range(3):
            x = edge_x(r, side, .02, .2); yb = H * r.uniform(.8, .92); hgt = r.uniform(180, 300)
            trunk(d, r, x, yb - hgt, yb, 22, 30, lean=r.uniform(-25, 25), root=False)
            for k in range(8): frond(d, x, yb - hgt, r.uniform(170, 250), -math.pi / 2 + (k / 7 - .5) * 3.0, .55, 8, .3)
        cv.stamp(m, '#2a1c18', '#4a3626', tex=.25)
    m, d = new_mask(); ridge(d, r, H * .9, 26, scale=180); cv.stamp(m, '#2e1a1a', '#1a0e12')
    for side in (-1, 1):                               # glowing lava cracks at the foot
        m, d = new_mask()
        for _ in range(4):
            x = edge_x(r, side, .0, .26); y = H * r.uniform(.91, .98); pts = [(x + i * 34 * side, y + math.sin(i * 1.7) * 14) for i in range(6)]; d.line(pts, fill=255, width=5)
        cv.stamp(m, '#ff7a2e', '#ffd070', rim=0, outline=0, tex=.1)
    cv.glow(W * .1, H * .96, 260, '#ff5a1e', .5, .5); cv.glow(W * .9, H * .96, 260, '#ff5a1e', .5, .5)
    particles(cv, r, 90, '#ffb36a', (1.2, 3.2), .9, (.2, .95)); particles(cv, r, 70, '#a89aa0', (1.5, 4), .35, (0, .6))
    return cv.finish('#190c18')

def jurassic():
    cv = Cv(47); r = cv.r
    cv.sky([(0, '#16503a'), (.3, '#3d8a56'), (.55, '#b6c96e'), (.7, '#e6e29a'), (1, '#1d3a22')])
    cv.glow(W * .5, H * .22, 420, '#f6f3b8', .5, .8)
    m, d = new_mask()                                  # distant sauropod on a far ridge (right band)
    ridge(d, r, H * .56, 26, scale=220)
    bx, by = W * .8, H * .5
    d.ellipse([bx - 90, by - 40, bx + 70, by + 30], fill=255); d.polygon([(bx + 40, by - 20), (bx + 100, by - 120), (bx + 118, by - 190), (bx + 140, by - 192), (bx + 125, by - 120), (bx + 75, by + 10)], fill=255)
    d.polygon([(bx - 80, by), (bx - 150, by + 30), (bx - 170, by + 40), (bx - 90, by + 20)], fill=255)
    for lx in (-60, -20, 30, 60): d.rectangle([bx + lx - 10, by + 10, bx + lx + 10, by + 80], fill=255)
    cv.stamp(m, '#4f7f56', '#355c3c', haze='#cfe0a0', hazek=.4)
    clouds(cv, '#e8efc0', .35, (.35, .65), 4, 260)
    for side in (-1, 1):                               # tall araucaria trunks
        m, d = new_mask()
        for i in range(2):
            x = edge_x(r, side, .02 + i * .09, .08 + i * .09); trunk(d, r, x, -20, H * .92, 70, 120, lean=r.uniform(-20, 20) * side)
            for k in range(6):                         # branch + needle clumps
                by = H * (.06 + k * .09); dx = (1 if side < 0 else -1) * 1
                for q in range(5): frond(d, x, by, r.uniform(120, 200), (0 if dx > 0 else math.pi) + r.uniform(-.7, .5) * dx, .35, 7, .28)
        cv.stamp(m, '#4a3a2c', '#2b221a', tex=.35, haze='#2d6e46', hazek=.12)
    for side in (-1, 1):                               # giant tree ferns and cycads
        m, d = new_mask()
        for i in range(4):
            x = edge_x(r, side, .02, .24); yb = H * r.uniform(.78, .94)
            for k in range(10): frond(d, x, yb, r.uniform(210, 330), math.pi * 2 * k / 10 - math.pi * .5 + r.uniform(-.1, .1), .38, 9, .32)
        cv.stamp(m, '#2a7a3c', '#16421f', tex=.28, litk=.12, lit='#d6f5a0')
    m, d = new_mask()                                  # hanging vines from the top corners
    for side in (-1, 1):
        for _ in range(8): vine(d, r, edge_x(r, side, 0, .3), -10, r.uniform(250, 600), 20)
    cv.stamp(m, '#57a84a', '#2c6a30', tex=.2, litk=.1, lit='#e0ff9a')
    cv.blend('#d8ecb0', np.clip(cv.fbm(210, 3, (1, 2)) - .55, 0, 1) * 1.1 * np.exp(-((cv.yy / H - .74) / .12) ** 2))
    m, d = new_mask(); ridge(d, r, H * .91, 22, scale=160); cv.stamp(m, '#16301c', '#0a1a0f')
    m, d = new_mask()
    for side in (-1, 1): blades(d, r, 0 if side < 0 else W * .72, W * .28 if side < 0 else W, H * .96, 90, 220, 26)
    cv.stamp(m, '#2f7a3a', '#1a4524', litk=.1, lit='#c8f090')
    particles(cv, r, 50, '#f6f3b8', (1.5, 3.5), .6, (.2, .9))
    return cv.finish('#08170f')

def cretaceous():
    cv = Cv(63); r = cv.r
    cv.sky([(0, '#3a2a5e'), (.25, '#9a4a74'), (.45, '#ee7e5e'), (.6, '#ffc578'), (1, '#4b2c34')])
    clouds(cv, '#ffd3a0', .55, (.25, .5), 5, 220); clouds(cv, '#5a3464', .5, (.02, .22), 6, 280)
    cv.glow(W * .72, H * .13, 150, '#ffe8c0', .9); cv.glow(W * .72, H * .13, 50, '#ffffff', 1.0)
    m, d = new_mask()                                  # comet streak
    d.line([(W * .72, H * .13), (W * .9, H * .02)], fill=255, width=22); d.ellipse([W * .72 - 24, H * .13 - 24, W * .72 + 24, H * .13 + 24], fill=255)
    cv.a += hexc('#ffe9c8')[None, None, :] * (ndi.gaussian_filter(np.asarray(m, np.float32) / 255, 5) * .9)[..., None]
    m, d = new_mask(); d.rectangle([0, H * .6, W, H], fill=255)                # sea
    cv.stamp(m, '#f4a07a', '#4a4468', outline=0, rim=0, tex=.12)
    cv.glow(W * .5, H * .6, 500, '#ffd9a0', .45, .1)
    m, d = new_mask(); ridge(d, r, H * .63, 24, scale=150, x0=0, x1=W * .3); ridge(d, r, H * .63, 24, scale=150, x0=W * .72, x1=W)
    cv.stamp(m, '#5a3a4c', '#3a2638', haze='#ee7e5e', hazek=.35)
    for side in (-1, 1):                               # flowering magnolia branches from the top corners
        m, d = new_mask(); mc, dc = new_mask()
        for i in range(3):
            x0 = 0 if side < 0 else W; y0 = H * (.02 + i * .1); ang = (0 if side < 0 else math.pi) + r.uniform(.15, .5)
            pts = bez((x0, y0), (x0 + side * -1 * 110, y0 + 40 + i * 20), (x0 + side * -1 * 210 + r.uniform(-30, 30), y0 + 100 + i * 30), 10)
            d.line([tuple(p) for p in pts], fill=255, width=22 - i * 4)
            for p in pts[2:]:
                for _ in range(2):
                    bx, by = p[0] + r.uniform(-35, 35), p[1] + r.uniform(-30, 40); rad = r.uniform(18, 30)
                    for k in range(5):
                        a = k / 5 * 6.28 + r.random(); dc.ellipse([bx + math.cos(a) * rad * .6 - rad * .5, by + math.sin(a) * rad * .6 - rad * .5, bx + math.cos(a) * rad * .6 + rad * .5, by + math.sin(a) * rad * .6 + rad * .5], fill=255)
                    d.ellipse([bx - 18, by + 8, bx + 18, by + 30], fill=255)
        cv.stamp(m, '#3e2a30', '#2a1a24'); cv.stamp(mc, '#ffb8cc', '#e0689a', litk=.2, lit='#fff0f4', tex=.15)
        m, d = new_mask()
        for i in range(6): frond(d, W * (.03 if side < 0 else .97), H * (.1 + i * .045), 110, (0.2 if side < 0 else math.pi - .2) + r.uniform(-.4, .5), .2, 5, .28)
        cv.stamp(m, '#5a8a48', '#2e5a34')
    for side in (-1, 1):                               # palms and rock stacks with ammonites
        m, d = new_mask()
        for i in range(2):
            x = edge_x(r, side, .04 + i * .1, .12 + i * .1); yb = H * .9; hg = r.uniform(520, 760); trunk(d, r, x, yb - hg, yb, 26, 36, lean=r.uniform(40, 90) * -side, root=False)
            for k in range(9): frond(d, x + (-side) * 60, yb - hg, r.uniform(160, 230), math.pi * 2 * k / 9 - math.pi * .5, .55, 8, .3)
        cv.stamp(m, '#27333a', '#3a2c34', tex=.2)
        m, d = new_mask()
        for i in range(5): rock(d, r, edge_x(r, side, .0, .25), H * r.uniform(.88, .97), r.uniform(60, 130), r.uniform(55, 100))
        cv.stamp(m, '#a56a5a', '#5a3a42', tex=.3, litk=.12, lit='#ffd9b0')
        m, d = new_mask()
        for i in range(2):
            cx = edge_x(r, side, .05 + i * .1, .1 + i * .1); cy = H * (.93 + i * .02); pts = [(cx + math.cos(t) * (6 + t * 6), cy + math.sin(t) * (6 + t * 6)) for t in np.linspace(0, 14, 80)]
            d.line(pts, fill=255, width=9)
        cv.stamp(m, '#f2dcb4', '#c8a070', tex=.1, outline=.7)
    particles(cv, r, 60, '#ffd9a0', (1.2, 3), .7, (.15, .85))
    return cv.finish('#1a0f1e')

def mammals():
    cv = Cv(79); r = cv.r
    cv.sky([(0, '#2c3f7a'), (.3, '#6f6aa8'), (.52, '#f0a87a'), (.62, '#ffd58e'), (1, '#2a2e1c')])
    clouds(cv, '#ffe0b8', .5, (.25, .5), 7, 240); clouds(cv, '#3a3b78', .45, (.02, .25), 8, 260)
    cv.glow(W * .5, H * .6, 460, '#ffe2a0', .55, .45); cv.glow(W * .3, H * .17, 30, '#ffffff', .8)
    for i, (hy, col, col2, hz) in enumerate([(.58, '#7a6f9a', '#5c5784', .45), (.66, '#5a6f5a', '#3e5442', .3), (.78, '#3a5a34', '#243e24', .14)]):
        m, d = new_mask(); ridge(d, r, H * hy, 44, scale=300 - i * 50); cv.stamp(m, col, col2, haze='#f0a87a', hazek=hz)
    m, d = new_mask()                                  # distant herd silhouettes
    for i in range(7):
        x = W * (.08 + i * .13); y = H * .64 + r.uniform(-6, 10); d.ellipse([x, y - 20, x + 46, y + 8], fill=255); d.rectangle([x + 6, y, x + 12, y + 20], fill=255); d.rectangle([x + 34, y, x + 40, y + 20], fill=255); d.ellipse([x + 38, y - 24, x + 58, y - 6], fill=255)
    cv.stamp(m, '#3a3548', '#2a2638', haze='#f0a87a', hazek=.3, outline=.2)
    for side in (-1, 1):                               # acacia trees
        m, d = new_mask(); mc, dc = new_mask()
        for i in range(2):
            x = edge_x(r, side, .03 + i * .12, .1 + i * .12); yb = H * (.9 - i * .02); hg = r.uniform(520, 700)
            trunk(d, r, x, yb - hg, yb, 34, 52, lean=r.uniform(-60, 60), root=True)
            for k in range(4):
                bx, by = x + r.uniform(-60, 60), yb - hg - r.uniform(-40, 40); dc.ellipse([bx - 150, by - 36, bx + 150, by + 30], fill=255); d.line([(x, yb - hg + 40), (bx, by + 10)], fill=255, width=14)
        cv.stamp(m, '#3a2a22', '#241812', tex=.3); cv.stamp(mc, '#4f7a3a', '#2c5228', tex=.3, litk=.15, lit='#f0d98a')
    m, d = new_mask(); ridge(d, r, H * .9, 20, scale=140); cv.stamp(m, '#2e4a28', '#16281a', tex=.3)
    for side in (-1, 1):
        m, d = new_mask(); blades(d, r, 0 if side < 0 else W * .66, W * .34 if side < 0 else W, H * .985, 120, 320, 46)
        cv.stamp(m, '#6a8a3a', '#2e4a22', litk=.2, lit='#ffe9a0', tex=.15)
    particles(cv, r, 60, '#ffe2a0', (1.2, 3), .55, (.4, .95))
    m, d = new_mask()                                  # a few birds
    for _ in range(6):
        x, y = r.uniform(.08, .9) * W, r.uniform(.2, .45) * H; d.line([(x - 18, y - 6), (x, y), (x + 18, y - 6)], fill=255, width=3)
    cv.stamp(m, '#2a2440', outline=0, rim=0, tex=0)
    return cv.finish('#0f1410')

def iceage():
    cv = Cv(97); r = cv.r
    cv.sky([(0, '#0c1c44'), (.3, '#2c5a98'), (.55, '#9cc8e6'), (.7, '#e2f2fa'), (1, '#8aa2b8')])
    for col, cx0, k in (('#4ff0a8', .3, .55), ('#8a6cf0', .62, .4)):     # aurora ribbons
        n = cv.fbm(200, 3, (3, 1)); ribbon = np.exp(-((cv.yy / H - (.1 + .08 * np.sin(cv.xx / W * 5 + cx0 * 9) + .06 * n)) / .045) ** 2)
        cv.blend(col, np.clip(ribbon * k, 0, 1))
    particles(cv, r, 90, '#ffffff', (.8, 2), .8, (0, .35))
    clouds(cv, '#ffffff', .35, (.35, .55), 9, 260); cv.glow(W * .5, H * .66, 420, '#ffffff', .5, .4)
    m, d = new_mask(); ridge(d, r, H * .6, 70, scale=330); cv.stamp(m, '#b4cde4', '#8aa8c8', haze='#e2f2fa', hazek=.35)
    for side in (-1, 1):                               # glacier walls and ice spikes
        m, d = new_mask(); mi, di = new_mask()
        x = 0 if side < 0 else W; edge = W * .2
        pts = [(x, H * .06)]; y = H * .06
        while y < H * .95:
            w = edge * r.uniform(.45, 1.0); pts.append((x - side * -1 * w if False else x + (w * (1 if side < 0 else -1)), y)); y += r.uniform(60, 140)
        pts.append((x, H * .95)); d.polygon(pts, fill=255)
        for _ in range(7):
            bx = x + (1 if side < 0 else -1) * r.uniform(20, W * .2); by = H * r.uniform(.5, .93); hgt = r.uniform(120, 300); w = r.uniform(30, 55)
            di.polygon([(bx - w, by), (bx - w * .1, by - hgt), (bx + w * .3, by - hgt * .85), (bx + w, by)], fill=255)
        cv.stamp(m, '#a6d4ec', '#4a86b8', tex=.2, litk=.25, lit='#ffffff', rim=.8); cv.stamp(mi, '#d6f2ff', '#78b6e0', litk=.3, lit='#ffffff', rim=.9)
    for side in (-1, 1):                               # snowy pines
        m, d = new_mask(); ms, ds = new_mask()
        for i in range(5):
            x = edge_x(r, side, .02, .24); y = H * r.uniform(.84, .95); h = r.uniform(220, 400); w = h * .45
            conifer(d, x, y, h, w); conifer(ds, x, y - 2, h * .97, w * .9, 7)
        cv.stamp(m, '#1c3a40', '#0e2228', tex=.25); cv.stamp(ms, '#e8f4ff', '#a8c8e0', litk=.1, lit='#ffffff', tex=.1)
    m, d = new_mask(); ridge(d, r, H * .92, 20, scale=190); cv.stamp(m, '#eef6ff', '#a8c0d8', tex=.1, outline=.25, litk=.2, lit='#ffffff')
    particles(cv, r, 110, '#ffffff', (1.5, 3.8), .85, (.1, 1))
    return cv.finish('#0a1626', calm_a=.88)

def humans():
    cv = Cv(113); r = cv.r
    cv.sky([(0, '#0a0f2e'), (.3, '#232a62'), (.55, '#7a4a7a'), (.7, '#e0825a'), (1, '#2a1410')])
    particles(cv, r, 130, '#fff4d6', (.8, 2.2), .85, (0, .5))
    cv.glow(W * .5, H * .68, 420, '#ff9a5a', .45, .35)
    m, d = new_mask(); ridge(d, r, H * .66, 36, scale=260); cv.stamp(m, '#3a2a4a', '#241838', haze='#e0825a', hazek=.3)
    for side in (-1, 1):                               # cave mouth: heavy rock walls framing the edges
        m, d = new_mask(); x = 0 if side < 0 else W; sg = 1 if side < 0 else -1
        pts = [(x, 0)]; y = 0
        while y < H:
            frac = y / H; w = W * (.3 - .06 * math.sin(frac * 3.14)) * r.uniform(.75, 1.1); pts.append((x + sg * w, y)); y += r.uniform(50, 110)
        pts.append((x, H)); d.polygon(pts, fill=255)
        for i in range(10):                            # stalactite teeth on top
            bx = x + sg * r.uniform(0, W * .36); w = r.uniform(26, 56); d.polygon([(bx - w, -4), (bx + w, -4), (bx + r.uniform(-8, 8), r.uniform(90, 230))], fill=255)
        cv.stamp(m, '#4a3a38', '#2a1e22', tex=.4, litk=.12, lit='#e0825a', rim=.9)
        m, d = new_mask()                              # ochre hand prints and strokes on the wall
        for i in range(3):
            cx = x + sg * r.uniform(W * .05, W * .17); cy = H * (.34 + i * .1) + r.uniform(-20, 20)
            d.ellipse([cx - 26, cy - 8, cx + 26, cy + 40], fill=255)
            for f in range(5):
                a = -1.95 + f * .5; d.line([(cx + (f - 2) * 9, cy), (cx + math.cos(a) * 62 * (1 - abs(f - 2) * .08), cy + math.sin(a) * 62)], fill=255, width=12)
        for i in range(3):
            y = H * (.62 + i * .06); d.line([(x + sg * W * .05, y), (x + sg * W * .12, y - 18), (x + sg * W * .19, y + 4)], fill=255, width=8)
        cv.stamp(m, '#c8693a', '#8a3a22', tex=.35, outline=0, rim=0)
        m, d = new_mask(); ridge(d, r, H * .94, 24, x0=0, x1=W, scale=140); cv.stamp(m, '#2a1a16', '#140a0a', tex=.35)
    for fx in (W * .14, W * .86):                      # camp fires in the lower corners
        cv.glow(fx, H * .9, 300, '#ff7a2a', .8, .9); cv.glow(fx, H * .92, 120, '#ffd27a', .7)
        m, d = new_mask()
        for k, (sx, sy, sc) in enumerate([(0, 0, 1), (-26, 8, .7), (26, 10, .65)]):
            x, y = fx + sx, H * .945 + sy; d.polygon([(x - 28 * sc, y), (x - 20 * sc, y - 60 * sc), (x - 6 * sc, y - 100 * sc), (x + 2 * sc, y - 150 * sc), (x + 14 * sc, y - 90 * sc), (x + 30 * sc, y - 50 * sc), (x + 28 * sc, y)], fill=255)
        cv.stamp(m, '#ff7a1e', '#ffd25a', outline=0, rim=0, tex=.15)
        m, d = new_mask(); d.polygon([(fx - 20, H * .945 - 20), (fx - 2, H * .945 - 80), (fx + 12, H * .945 - 20)], fill=255)
        cv.stamp(m, '#fff0b0', '#ffd25a', outline=0, rim=0, tex=0)
        m, d = new_mask()
        for a in (-.4, .4): d.line([(fx - math.cos(a) * 70, H * .945 + math.sin(a) * 20), (fx + math.cos(a) * 70, H * .945 - math.sin(a) * 20)], fill=255, width=14)
        cv.stamp(m, '#4a2e1e', '#2a1810', tex=.3)
    particles(cv, r, 80, '#ffb36a', (1.2, 3), .9, (.45, .95))
    return cv.finish('#120a0e', calm_a=.86)

ERAS = dict(triassic=triassic, jurassic=jurassic, cretaceous=cretaceous, mammals=mammals, iceage=iceage, humans=humans)

def main():
    names = sys.argv[1:] or list(ERAS); OUT.mkdir(parents=True, exist_ok=True); made = []
    for n in names:
        im = ERAS[n](); im.save(OUT / f'{n}.webp', quality=82, method=6); made.append(im); print(n, (OUT / f'{n}.webp').stat().st_size // 1024, 'KB')
    sheet = Image.new('RGB', (len(made) * 260, 470), (12, 12, 14))
    for i, im in enumerate(made): sheet.paste(im.resize((256, 453), Image.LANCZOS), (i * 260 + 2, 8))
    sheet.save(ROOT / 'art' / 'backgrounds' / '_procedural-sheet.png')

if __name__ == '__main__': main()
