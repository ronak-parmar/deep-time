#!/usr/bin/env python3
"""Procedural painted UI kit for Dino Match (no external image generator).
  python tools/gen-ui.py [out_dir] [--contact contact.png]
Writes transparent PNGs named like src/render/artManifest.js slots (hud-sign.png, tile-cream-1.png ...) at 2x the logical slot size.
Pipeline: layered noise albedo -> signed-distance shape with hand-wobbled edges -> bevel height map -> lambert light from the top left
-> ambient occlusion toward the edge -> thick dark outline -> rim highlight. Rendered at 4x, downscaled to 2x (LANCZOS, premultiplied).
Needs pillow, numpy, scipy. Deterministic (fixed seeds)."""
import sys, math, pathlib, re
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

S = 4                                   # internal supersample (relative to logical px); output is S/2 = 2x
OUT_S = 2
OUTLINE = np.array([40, 25, 17]) / 255.0
LIGHT = np.array([-0.55, -0.65, 0.52]); LIGHT /= np.linalg.norm(LIGHT)

# ---- slot table (mirrors UI_SLOTS in src/render/artManifest.js; test in tests/art.test.js keeps them in sync) -----------------------------
def slots_from_manifest():
    src = (pathlib.Path(__file__).resolve().parents[1] / 'games/dino-match/src/render/artManifest.js').read_text()
    out = {}
    for m in re.finditer(r"'([a-z\-]+)':\s*\{\s*w:\s*(\d+),\s*h:\s*(\d+)(?:,\s*nine:[^}]*?)?(?:,\s*n:\s*(\d+))?", src):
        out[m.group(1)] = (int(m.group(2)), int(m.group(3)), int(m.group(4) or 1))
    return out

# ---- noise / shapes ---------------------------------------------------------------------------------------------------------------------
def fbm(h, w, r, base=8.0, octs=4, aniso=(1, 1)):
    out = np.zeros((h, w)); amp = 1.0; tot = 0.0
    for o in range(octs):
        sg = max(base / (2 ** o), 0.7)
        n = ndi.gaussian_filter(r.standard_normal((h, w)), (sg * aniso[0], sg * aniso[1]), mode='wrap')
        n /= n.std() + 1e-9; out += n * amp; tot += amp; amp *= 0.55
    return out / tot

def rrect_d(h, w, r, rad, inset, wob=1.0, cx=None, cy=None, hw=None, hh=None):
    """signed distance (negative inside) of a rounded rect, with low-frequency wobble so no edge is ruler straight."""
    y, x = np.mgrid[0:h, 0:w].astype(float)
    cx = (w - 1) / 2 if cx is None else cx; cy = (h - 1) / 2 if cy is None else cy
    hw = w / 2 - inset if hw is None else hw; hh = h / 2 - inset if hh is None else hh
    rad = min(rad, hw, hh)
    qx = np.abs(x - cx) - (hw - rad); qy = np.abs(y - cy) - (hh - rad)
    d = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - rad
    return d + fbm(h, w, r, base=max(min(h, w) / 5, 3), octs=2) * wob * S * 0.35

def d_from_mask(m):
    m = m.astype(bool)
    return ndi.distance_transform_edt(~m) - ndi.distance_transform_edt(m)

def lerp3(a, b, t): return np.array(a)[None, None, :] * (1 - t[..., None]) + np.array(b)[None, None, :] * t[..., None]
def rgb(*c): return np.array(c, float) / 255.0

# ---- albedo textures ---------------------------------------------------------------------------------------------------------------------
def tex_wood(h, w, r, dark=rgb(86, 52, 28), light=rgb(158, 104, 56), planks=1):
    g = fbm(h, w, r, base=14 * S / 4, octs=3, aniso=(0.25, 6))            # long grain along x
    g2 = fbm(h, w, r, base=3 * S, octs=2, aniso=(0.2, 5))
    ring = 0.5 + 0.5 * np.sin((np.mgrid[0:h, 0:w][0] / S) * 1.1 + g * 3.0)  # soft ring bands
    t = np.clip(0.5 + 0.22 * g + 0.12 * g2 + 0.18 * (ring - 0.5), 0, 1)
    a = lerp3(dark, light, t)
    y = np.mgrid[0:h, 0:w][0]
    for k in range(1, planks):                                              # plank seams
        yy = h * k / planks; a *= (1 - 0.55 * np.exp(-((y - yy) / (1.2 * S)) ** 2))[..., None]
    return a

def tex_stone(h, w, r, dark=rgb(104, 101, 98), light=rgb(176, 172, 164), chips=14):
    t = np.clip(0.5 + 0.20 * fbm(h, w, r, base=9 * S / 4, octs=4) + 0.06 * fbm(h, w, r, base=1.2, octs=1), 0, 1)
    a = lerp3(dark, light, t)
    for _ in range(chips):                                                  # chips: dark nick with a light lower lip
        cx, cy, rad = r.uniform(0, w), r.uniform(0, h), r.uniform(1.2, 3.2) * S
        y, x = np.mgrid[0:h, 0:w]; dd = np.hypot((x - cx) * 1.3, y - cy)
        a *= (1 - 0.38 * np.clip(1 - dd / rad, 0, 1))[..., None]
        dd2 = np.hypot((x - cx) * 1.3, y - cy - rad * 0.55); a += (0.10 * np.clip(1 - dd2 / (rad * 0.8), 0, 1))[..., None]
    return np.clip(a, 0, 1)

def tex_cream(h, w, r):
    t = np.clip(0.55 + 0.20 * fbm(h, w, r, base=10 * S / 4, octs=4) + 0.05 * fbm(h, w, r, base=1.1, octs=1), 0, 1)
    a = lerp3(rgb(206, 176, 126), rgb(240, 218, 170), t)
    return a

def tex_sand(h, w, r):
    t = np.clip(0.5 + 0.22 * fbm(h, w, r, base=6 * S / 4, octs=4) + 0.12 * fbm(h, w, r, base=1.0, octs=1), 0, 1)
    a = lerp3(rgb(150, 102, 58), rgb(216, 170, 106), t)
    y, x = np.mgrid[0:h, 0:w]
    for _ in range(26):                                                     # pebbles
        cx, cy, rad = r.uniform(.08 * w, .92 * w), r.uniform(.08 * h, .92 * h), r.uniform(1.0, 2.6) * S
        dd = np.hypot(x - cx, y - cy); a *= (1 - 0.35 * np.clip(1 - dd / rad, 0, 1))[..., None]
        a += (0.18 * np.clip(1 - np.hypot(x - cx + rad * .3, y - cy + rad * .3) / (rad * .6), 0, 1))[..., None]
    return np.clip(a, 0, 1)

def tex_rock(h, w, r):
    t = np.clip(0.5 + 0.22 * fbm(h, w, r, base=8 * S / 4, octs=4), 0, 1)
    a = lerp3(rgb(78, 80, 88), rgb(150, 152, 160), t)
    # angular facets: two crossing low-frequency gradients give a chiselled look
    f = fbm(h, w, r, base=14 * S / 4, octs=2); a = a * (0.85 + 0.2 * np.sign(f) * np.minimum(abs(f), 1))[..., None]
    return np.clip(a, 0, 1)

def tex_tar(h, w, r):
    t = np.clip(0.4 + 0.25 * fbm(h, w, r, base=7 * S / 4, octs=3), 0, 1)
    a = lerp3(rgb(20, 18, 24), rgb(58, 52, 60), t)
    y, x = np.mgrid[0:h, 0:w]
    for gy_ in range(3):                                                    # tar bubbles in a jittered 3x3 grid, glossy highlight
        for gx_ in range(3):
            cx, cy = (gx_ + .5) / 3 * w + r.normal(0, .05 * w), (gy_ + .5) / 3 * h + r.normal(0, .05 * h); rad = r.uniform(3.4, 5.2) * S
            dd = np.hypot(x - cx, y - cy)
            a *= (1 - 0.55 * np.clip(1 - dd / rad, 0, 1) ** 0.6)[..., None]
            a += (0.10 * np.clip(1 - np.hypot(x - cx - rad * .25, y - cy - rad * .3) / rad, 0, 1))[..., None]
            hl = np.hypot(x - (cx - rad * .3), y - (cy - rad * .35)); a += (0.6 * np.clip(1 - hl / (rad * .32), 0, 1))[..., None] * rgb(255, 245, 235)
    return np.clip(a, 0, 1)

def add_cracks(a, d, r, n=3, width=1.3):
    h, w = a.shape[:2]; im = Image.new('L', (w, h), 0); dr = ImageDraw.Draw(im)
    for _ in range(n):
        x, y = r.uniform(.2 * w, .8 * w), r.uniform(.15 * h, .85 * h); ang = r.uniform(0, 6.28)
        for seg in range(r.integers(6, 11)):
            ang += r.normal(0, .5); l = r.uniform(.04, .09) * w
            nx, ny = x + math.cos(ang) * l, y + math.sin(ang) * l
            dr.line([(x, y), (nx, ny)], fill=255, width=int(width * S)); x, y = nx, ny
            if r.random() < .3:
                a2 = ang + r.choice([-1, 1]) * .9; dr.line([(x, y), (x + math.cos(a2) * l * 1.2, y + math.sin(a2) * l * 1.2)], fill=255, width=max(2, int(width * S * .7)))
    m = np.asarray(im.filter(ImageFilter.GaussianBlur(.6 * S))) / 255.0
    shade = m[..., None] * 0.85; a = a * (1 - shade) + rgb(60, 38, 22) * shade
    lip = np.roll(np.roll(m, S, 0), S, 1); a = a + (np.clip(lip - m, 0, 1) * 0.35)[..., None]
    return np.clip(a, 0, 1)

# ---- lighting ----------------------------------------------------------------------------------------------------------------------------
def shade(alb, d, r, bevel=4.5, outline=1.6, bump=None, spec=0.28, ao=0.28, ocol=OUTLINE, aa=1.0):
    """alb HxWx3, d signed distance. returns float RGBA (straight alpha)."""
    bevel *= S; ow = outline * S
    depth = np.clip(-d, 0, None)
    hgt = np.clip(depth / bevel, 0, 1); hgt = hgt * hgt * (3 - 2 * hgt)
    hgt = ndi.gaussian_filter(hgt, 0.5 * S)
    if bump is not None: hgt = hgt + bump
    gy, gx = np.gradient(hgt * bevel * 0.9)
    n = np.stack([-gx, -gy, np.ones_like(gx)], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True)
    lam = np.clip((n * LIGHT).sum(-1), 0, 1)
    lit = alb * (0.50 + 0.78 * lam)[..., None]
    rim = np.clip(-(gx * LIGHT[0] + gy * LIGHT[1]), 0, 1); lit = lit + spec * (rim / (rim.max() + 1e-6))[..., None] * 0.55
    occ = 1 - ao * np.exp(-depth / (3.2 * S)); lit = lit * occ[..., None]
    a_in = np.clip(0.5 - d / aa, 0, 1); a_all = np.clip(0.5 - (d - ow) / aa, 0, 1)
    col = ocol[None, None, :] * (1 - a_in[..., None]) + np.clip(lit, 0, 1) * a_in[..., None]
    return np.dstack([col, a_all])

def over(base, top):
    ab, at = base[..., 3:4], top[..., 3:4]; ao_ = at + ab * (1 - at)
    c = (top[..., :3] * at + base[..., :3] * ab * (1 - at)) / np.maximum(ao_, 1e-6)
    return np.dstack([c, ao_[..., 0]])

def blank(h, w): return np.zeros((h, w, 4))

def to_img(a):
    im = Image.fromarray((np.clip(a, 0, 1) * 255 + .5).astype(np.uint8), 'RGBA').convert('RGBa')
    w, h = im.size
    return im.resize((w * OUT_S // S, h * OUT_S // S), Image.LANCZOS).convert('RGBA')

# ---- drawing helpers for icons ------------------------------------------------------------------------------------------------------------
def layer(h, w, fn, color=None, grad=(1.18, 0.78)):
    """draw shapes with PIL (fn(draw) paints white on an L mask) -> shaded RGBA with its own outline."""
    im = Image.new('L', (w, h), 0); fn(ImageDraw.Draw(im)); m = np.asarray(im.filter(ImageFilter.GaussianBlur(.5))) / 255.0 > .5
    return m

def paint_shape(m, r, col, hi=None, outline=1.3, bevel=2.2, bump=None):
    h, w = m.shape; d = d_from_mask(m).astype(float)
    alb = np.ones((h, w, 3)) * np.array(col)[None, None, :]
    yy = np.mgrid[0:h, 0:w][0] / h; alb = alb * (1.12 - 0.3 * yy)[..., None]
    if hi is not None: alb = alb + (np.array(hi) * 0.0)[None, None, :]
    return shade(alb, d, r, bevel=bevel, outline=outline, ao=.2, spec=.2)

def leaf_mask(h, w, pts):
    im = Image.new('L', (w, h), 0); dr = ImageDraw.Draw(im)
    for (x, y, ang, ln, wd) in pts:
        ca, sa = math.cos(ang), math.sin(ang); poly = []
        for t in np.linspace(0, 1, 9):
            wv = math.sin(t * math.pi) * wd * (1 - .25 * t); poly.append((x + ca * ln * t - sa * wv, y + sa * ln * t + ca * wv))
        for t in np.linspace(1, 0, 9):
            wv = math.sin(t * math.pi) * wd * (1 - .25 * t); poly.append((x + ca * ln * t + sa * wv, y + sa * ln * t - ca * wv))
        dr.polygon(poly, fill=255)
    return np.asarray(im) > 127

def vine(h, w, r, corner='tl', n=7, length=0.5):
    """vine + leaves growing from a corner. returns RGBA layer."""
    pts = []; im = Image.new('L', (w, h), 0); dr = ImageDraw.Draw(im)
    sx = 1 if 'l' in corner else -1; sy = 1 if 't' in corner else -1
    x0, y0 = (0 if sx > 0 else w), (0 if sy > 0 else h)
    ang = (0.15 if sx > 0 else math.pi - .15); path = [(x0 + sx * 2 * S, y0 + sy * 6 * S)]
    for i in range(n * 3):
        ang += r.normal(0, .22) + 0.02 * sy * sx; l = w * length / (n * 3)
        px, py = path[-1]; path.append((px + math.cos(ang) * l, py + math.sin(ang) * l * 0.5 * sy + sy * 0.4 * S))
        if i % 3 == 1:
            side = 1 if (i // 3) % 2 else -1
            pts.append((px, py, ang + side * r.uniform(.8, 1.3), r.uniform(7, 11) * S, r.uniform(2.6, 3.8) * S))
    dr.line(path, fill=255, width=int(1.8 * S))
    vm = np.asarray(im) > 127; lm = leaf_mask(h, w, pts)
    out = blank(h, w)
    for m, col, bv in ((vm, rgb(74, 120, 44), 1.4), (lm, rgb(52, 150, 58), 2.4)):
        d = d_from_mask(m).astype(float); alb = lerp3(col * .7, np.minimum(col * 1.5, 1), np.clip(.5 + .2 * fbm(h, w, r, base=4 * S, octs=2), 0, 1))
        out = over(out, shade(alb, d, r, bevel=bv, outline=1.0, ao=.15, spec=.3))
    return out

# ---- slot builders -----------------------------------------------------------------------------------------------------------------------
def b_sign(w, h, seed, label_face=True):
    W, H = w * S, h * S; r = np.random.default_rng(seed)
    wd = rrect_d(H, W, r, 9 * S, 2 * S, wob=1.0)
    out = shade(tex_wood(H, W, r, planks=2 if h > 40 else 1), wd, r, bevel=4.5, outline=1.7)
    if label_face:
        fi = 9 * S if h >= 50 else 8 * S
        fd = rrect_d(H, W, r, 6 * S, fi, wob=.8)
        nail = [(fi * .5, fi * .5), (W - fi * .5, fi * .5), (fi * .5, H - fi * .5), (W - fi * .5, H - fi * .5)]
        out = over(out, shade(tex_stone(H, W, r), fd, r, bevel=3.0, outline=1.2, ao=.4))
        for (nx_, ny_) in nail:
            nm = layer(H, W, lambda dr, nx_=nx_, ny_=ny_: dr.ellipse([nx_ - 1.3 * S, ny_ - 1.3 * S, nx_ + 1.3 * S, ny_ + 1.3 * S], fill=255)); out = over(out, paint_shape(nm, r, rgb(120, 112, 104), outline=.6, bevel=1.0))
    out = over(out, vine(H, W, r, 'tl', n=5, length=.30))
    out = over(out, vine(H, W, r, 'br', n=4, length=.22))
    return out

def b_plaque(w, h, seed):
    W, H = w * S, h * S; r = np.random.default_rng(seed)
    d = rrect_d(H, W, r, 9 * S, 2 * S, wob=1.1)
    out = shade(tex_stone(H, W, r, chips=22), d, r, bevel=5, outline=1.7)
    out = over(out, vine(H, W, r, 'tr', n=4, length=.28))
    return out

def b_medallion(w, h, seed, inner=None):
    W, H = w * S, h * S; r = np.random.default_rng(seed)
    d = rrect_d(H, W, r, 99 * S, 2 * S, wob=.8)
    out = shade(tex_stone(H, W, r, chips=10), d, r, bevel=6, outline=1.8)
    ring = rrect_d(H, W, r, 99 * S, 9 * S, wob=.6)
    if inner is None:
        face = lerp3(rgb(70, 68, 70), rgb(112, 108, 106), np.clip(.5 + .2 * fbm(H, W, r, base=6 * S, octs=3), 0, 1))
    else:
        yy, xx = np.mgrid[0:H, 0:W]; rad = np.hypot(xx - W / 2, yy - H / 2) / (W / 2)
        face = lerp3(inner[0], inner[1], np.clip(rad * 1.2, 0, 1)) * (.9 + .12 * fbm(H, W, r, base=5 * S, octs=2))[..., None]
    out = over(out, shade(np.clip(face, 0, 1), -(-ring), r, bevel=5, outline=1.2, ao=.5, ocol=rgb(30, 22, 18)))
    return out

def b_button(w, h, seed, glyph):
    W, H = w * S, h * S; r = np.random.default_rng(seed)
    d = rrect_d(H, W, r, 10 * S, 2 * S, wob=1.0)
    out = shade(tex_stone(H, W, r, chips=12), d, r, bevel=5.5, outline=1.8)
    cx, cy = W / 2, H / 2
    if glyph == 'gear':
        def fn(dr):
            R = 13 * S; pts = []
            for i in range(16):
                a0 = i * math.pi / 8
                rr = R if i % 2 == 0 else R * .78
                pts += [(cx + math.cos(a0 - .12) * rr, cy + math.sin(a0 - .12) * rr), (cx + math.cos(a0 + .12) * rr, cy + math.sin(a0 + .12) * rr)]
            dr.polygon(pts, fill=255); dr.ellipse([cx - 4.5 * S, cy - 4.5 * S, cx + 4.5 * S, cy + 4.5 * S], fill=0)
        m = layer(H, W, fn); out = over(out, paint_shape(m, r, rgb(150, 150, 152), bevel=2.2))
    else:
        def fn(dr):
            dr.polygon([(cx - 13 * S, cy), (cx - 1 * S, cy - 12 * S), (cx - 1 * S, cy - 5 * S), (cx + 12 * S, cy - 5 * S), (cx + 12 * S, cy + 5 * S), (cx - 1 * S, cy + 5 * S), (cx - 1 * S, cy + 12 * S)], fill=255)
        m = layer(H, W, fn); out = over(out, paint_shape(m, r, rgb(240, 222, 172), bevel=2.2))
    return out

def b_tile(w, h, seed, kind):
    W, H = w * S, h * S; r = np.random.default_rng(seed)
    d = rrect_d(H, W, r, 6 * S, 1.0 * S, wob=.9)
    if kind == 'cream': alb = tex_cream(H, W, r); ocol = rgb(120, 86, 52)
    elif kind == 'dirt': alb = tex_tar(H, W, r); ocol = rgb(10, 9, 12)
    elif kind == 'sand': alb = tex_sand(H, W, r); ocol = rgb(70, 42, 22)
    elif kind == 'stone': alb = tex_rock(H, W, r); ocol = rgb(28, 28, 34)
    else: alb = add_cracks(tex_cream(H, W, r) * .94, d, r, n=3); ocol = rgb(110, 78, 46)
    return shade(alb, d, r, bevel=4.0, outline=.9, ocol=ocol, ao=.35, spec=.22 if kind != 'dirt' else .5)

def b_badge(w, h, seed, col):
    W, H = w * S, h * S; r = np.random.default_rng(seed)
    d = rrect_d(H, W, r, 99 * S, 1.5 * S, wob=.4)
    alb = lerp3(col * 1.25, col * .7, np.clip(np.mgrid[0:H, 0:W][0] / H, 0, 1))
    out = shade(np.clip(alb, 0, 1), d, r, bevel=3.2, outline=1.2, spec=.5)
    ring = rrect_d(H, W, r, 99 * S, 1.5 * S + 2.4 * S, wob=.3)
    return out

def b_pframe(w, h, seed):
    W, H = w * S, h * S; r = np.random.default_rng(seed)
    d = rrect_d(H, W, r, 11 * S, 2 * S, wob=1.0)
    out = shade(tex_stone(H, W, r, chips=16), d, r, bevel=4.5, outline=1.6)
    tr = rrect_d(H, W, r, 5 * S, 0, wob=.5, cx=W * .56, cy=H / 2, hw=W * .42, hh=H * .30)
    out = over(out, shade(lerp3(rgb(54, 44, 40), rgb(84, 72, 62), np.clip(.5 + .2 * fbm(H, W, r, base=5 * S, octs=2), 0, 1)), tr, r, bevel=2.5, outline=1.0, ocol=rgb(30, 22, 18), ao=.6))
    cx, cy = W * .10, H / 2
    def fn(dr):
        dr.ellipse([cx - 3 * S, cy - 1 * S, cx + 3 * S, cy + 5 * S], fill=255)
        for k, ox in enumerate((-4.2, -1.4, 1.4, 4.2)): dr.ellipse([cx + ox * S - 1.1 * S, cy - 5 * S + abs(ox) * .5 * S, cx + ox * S + 1.1 * S, cy - 2.4 * S + abs(ox) * .5 * S], fill=255)
    m = layer(H, W, fn); out = over(out, paint_shape(m, r, rgb(70, 62, 58), outline=.6, bevel=1.2))
    return out

def b_pfill(w, h, seed):
    W, H = w * S, h * S; r = np.random.default_rng(seed)
    d = rrect_d(H, W, r, 99 * S, 1.0 * S, wob=.5)
    yy = np.mgrid[0:H, 0:W][0] / H
    alb = lerp3(rgb(255, 190, 70), rgb(224, 110, 22), np.clip(yy * 1.1, 0, 1)) * (.95 + .08 * fbm(H, W, r, base=4 * S, octs=2))[..., None]
    return shade(np.clip(alb, 0, 1), d, r, bevel=3.0, outline=.8, ocol=rgb(110, 50, 12), spec=.7, ao=.2)

def b_star(w, h, seed, on):
    W, H = w * S, h * S; r = np.random.default_rng(seed); cx, cy = W / 2, H * .54; R = min(W, H) * .43
    pts = [(cx + math.cos(-math.pi / 2 + i * math.pi / 5) * (R if i % 2 == 0 else R * .46), cy + math.sin(-math.pi / 2 + i * math.pi / 5) * (R if i % 2 == 0 else R * .46)) for i in range(10)]
    m = layer(H, W, lambda dr: dr.polygon(pts, fill=255)); m = ndi.binary_opening(ndi.gaussian_filter(m.astype(float), 1.6 * S) > .5, iterations=1)
    d = d_from_mask(m).astype(float)
    yy = np.mgrid[0:H, 0:W][0] / H
    alb = lerp3(rgb(255, 232, 120), rgb(226, 150, 28), np.clip(yy * 1.2, 0, 1)) if on else lerp3(rgb(104, 92, 84), rgb(62, 54, 52), np.clip(yy * 1.2, 0, 1))
    alb = alb * (.95 + .1 * fbm(H, W, r, base=4 * S, octs=2))[..., None]
    return shade(np.clip(alb, 0, 1), d, r, bevel=5, outline=1.8 if on else 1.5, ocol=rgb(92, 50, 14) if on else rgb(30, 24, 22), spec=.7 if on else .15)

def icon_skull(out, r, cx, cy, u, H, W):
    def fn(dr):
        dr.ellipse([cx - 8 * u, cy - 11 * u, cx + 8 * u, cy + 5 * u], fill=255); dr.rectangle([cx - 5 * u, cy, cx + 5 * u, cy + 9 * u], fill=255)
        for ex in (-3.4, 3.4): dr.ellipse([cx + ex * u - 2.3 * u, cy - 3.6 * u, cx + ex * u + 2.3 * u, cy + 1 * u], fill=0)
        for tx in (-3, 0, 3): dr.rectangle([cx + tx * u - .35 * u, cy + 5.2 * u, cx + tx * u + .35 * u, cy + 9 * u], fill=0)
    m = layer(H, W, fn); return over(out, paint_shape(m, r, rgb(244, 236, 214), outline=1.2, bevel=2.0))

def b_booster(w, h, seed, kind):
    W, H = w * S, h * S; r = np.random.default_rng(seed)
    pal = {'pick': (rgb(70, 190, 190), rgb(26, 110, 120)), 'burst': (rgb(240, 96, 64), rgb(150, 36, 36)), 'brush': (rgb(110, 200, 90), rgb(40, 120, 54))}[kind]
    out = b_medallion(w, h, seed, inner=pal); cx, cy, u = W / 2, H / 2, W / 56
    if kind == 'pick':
        def hnd(dr): dr.polygon([(cx - 15 * u, cy + 17 * u), (cx - 11 * u, cy + 18 * u), (cx + 13 * u, cy - 12 * u), (cx + 9.5 * u, cy - 14 * u)], fill=255)
        out = over(out, paint_shape(layer(H, W, hnd), r, rgb(150, 98, 52), outline=1.1, bevel=1.8))
        def hd(dr): dr.polygon([(cx + 4 * u, cy - 19 * u), (cx + 19 * u, cy - 9 * u), (cx + 15 * u, cy - 6 * u), (cx + 8 * u, cy - 12 * u)], fill=255)
        out = over(out, paint_shape(layer(H, W, hd), r, rgb(170, 172, 176), outline=1.1, bevel=1.6))
        out = icon_skull(out, r, cx - 3 * u, cy - 2 * u, u * 1.0, H, W)
    elif kind == 'burst':
        def cone(dr): dr.polygon([(cx - 17 * u, cy + 17 * u), (cx - 6 * u, cy - 4 * u), (cx + 6 * u, cy - 4 * u), (cx + 17 * u, cy + 17 * u)], fill=255)
        out = over(out, paint_shape(layer(H, W, cone), r, rgb(96, 60, 44), outline=1.2, bevel=2.2))
        def lava(dr): dr.polygon([(cx - 6 * u, cy - 4 * u), (cx - 2 * u, cy + 10 * u), (cx + 1 * u, cy + 3 * u), (cx + 4 * u, cy + 12 * u), (cx + 6 * u, cy - 4 * u)], fill=255)
        out = over(out, paint_shape(layer(H, W, lava), r, rgb(255, 170, 40), outline=.6, bevel=1.2))
        def plume(dr):
            for (ox, oy, rr) in ((0, -10, 7), (-7, -8, 5.5), (7, -9, 5.5), (-3, -15, 5), (4, -15, 5)): dr.ellipse([cx + (ox - rr) * u, cy + (oy - rr) * u, cx + (ox + rr) * u, cy + (oy + rr) * u], fill=255)
        out = over(out, paint_shape(layer(H, W, plume), r, rgb(255, 150, 60), outline=1.2, bevel=2.6))
    else:
        def hnd(dr): dr.polygon([(cx - 15 * u, cy + 17 * u), (cx - 11 * u, cy + 18 * u), (cx + 4 * u, cy - 3 * u), (cx + 1 * u, cy - 6 * u)], fill=255)
        out = over(out, paint_shape(layer(H, W, hnd), r, rgb(150, 98, 52), outline=1.1, bevel=1.8))
        def fer(dr): dr.polygon([(cx + 0 * u, cy - 6 * u), (cx + 4 * u, cy - 3 * u), (cx + 11 * u, cy - 11 * u), (cx + 7 * u, cy - 14 * u)], fill=255)
        out = over(out, paint_shape(layer(H, W, fer), r, rgb(222, 178, 70), outline=1.1, bevel=1.6))
        def bri(dr): dr.polygon([(cx + 7 * u, cy - 14 * u), (cx + 11 * u, cy - 11 * u), (cx + 20 * u, cy - 17 * u), (cx + 15 * u, cy - 21 * u)], fill=255)
        out = over(out, paint_shape(layer(H, W, bri), r, rgb(236, 214, 160), outline=1.1, bevel=1.6))
    return out

def b_tablet(w, h, seed, kind):
    W, H = w * S, h * S; r = np.random.default_rng(seed)
    d = rrect_d(H, W, r, 7 * S, 2 * S, wob=1.1)
    out = shade(tex_stone(H, W, r, chips=10, dark=rgb(120, 112, 100), light=rgb(184, 174, 158)), d, r, bevel=4.5, outline=1.7)
    cx, cy, u = W / 2, H / 2, W / 48
    def carve(fn):
        nonlocal out
        m = layer(H, W, fn); dd = d_from_mask(m).astype(float)
        sh = np.clip(1 - np.abs(dd) / (1.4 * S), 0, 1) * (np.roll(np.roll(m, S // 2 + 1, 0), S // 2 + 1, 1) | m)
        out = over(out, np.dstack([np.ones((H, W, 3)) * rgb(58, 46, 36), (m * .75).astype(float)]))
        hi = np.roll(np.roll(m, -S // 2, 0), -S // 2, 1) & ~m; out = over(out, np.dstack([np.ones((H, W, 3)) * rgb(236, 226, 206), hi * .6]))
    if kind == 'skull':
        def fn(dr):
            dr.ellipse([cx - 9 * u, cy - 11 * u, cx + 9 * u, cy + 4 * u], fill=255); dr.rectangle([cx - 5 * u, cy, cx + 5 * u, cy + 9 * u], fill=255)
            for ex in (-3.6, 3.6): dr.ellipse([cx + ex * u - 2.6 * u, cy - 4 * u, cx + ex * u + 2.6 * u, cy + 1 * u], fill=0)
        carve(fn)
    elif kind == 'footprint':
        def fn(dr):
            dr.ellipse([cx - 5 * u, cy - 1 * u, cx + 5 * u, cy + 10 * u], fill=255)
            for ox, oy in ((-7, -4), (-2.5, -9), (3, -9), (7.5, -4)): dr.ellipse([cx + ox * u - 2.4 * u, cy + oy * u - 2.6 * u, cx + ox * u + 2.4 * u, cy + oy * u + 2.6 * u], fill=255)
        carve(fn)
    else:
        def fn(dr):
            dr.line([(cx, cy + 12 * u), (cx, cy - 12 * u)], fill=255, width=int(1.6 * u))
            for i in range(6):
                y = cy - 10 * u + i * 3.6 * u; ln = (11 - i * .9) * u
                dr.line([(cx, y + 2 * u), (cx - ln, y - 2 * u)], fill=255, width=int(1.5 * u)); dr.line([(cx, y + 2 * u), (cx + ln, y - 2 * u)], fill=255, width=int(1.5 * u))
        carve(fn)
    return out

def b_crumbs(w, h, seed):
    W, H = w * S, h * S; r = np.random.default_rng(seed); out = blank(H, W)
    pts = []
    for i in range(46):
        a = r.uniform(0, 6.28); rr = min(abs(r.normal(0, .17)), .34) * W; pts.append((W / 2 + math.cos(a) * rr * 1.2, H * .62 + math.sin(a) * rr * .45 - rr * .15, r.uniform(1.6, 4.6) * S))
    pts.sort(key=lambda p: p[1])
    for (x, y, rad) in pts:
        m = layer(H, W, lambda dr: dr.ellipse([x - rad, y - rad * .8, x + rad, y + rad * .8], fill=255))
        out = over(out, paint_shape(m, r, rgb(*[int(v) for v in r.choice([(70, 52, 40), (92, 68, 48), (54, 42, 36)])]), outline=.8, bevel=1.4))
    return out

BUILD = {
    'hud-sign': lambda w, h, s: b_sign(w, h, s), 'target-sign': lambda w, h, s: b_sign(w, h, s + 1),
    'hud-plaque': lambda w, h, s: b_plaque(w, h, s), 'moves-medallion': lambda w, h, s: b_medallion(w, h, s),
    'gear-button': lambda w, h, s: b_button(w, h, s, 'gear'), 'back-button': lambda w, h, s: b_button(w, h, s, 'back'),
    'progress-frame': lambda w, h, s: b_pframe(w, h, s), 'progress-fill': lambda w, h, s: b_pfill(w, h, s),
    'star-on': lambda w, h, s: b_star(w, h, s, True), 'star-off': lambda w, h, s: b_star(w, h, s, False),
    'booster-pick': lambda w, h, s: b_booster(w, h, s, 'pick'), 'booster-burst': lambda w, h, s: b_booster(w, h, s, 'burst'), 'booster-brush': lambda w, h, s: b_booster(w, h, s, 'brush'),
    'count-badge-blue': lambda w, h, s: b_badge(w, h, s, rgb(58, 128, 232)), 'count-badge-red': lambda w, h, s: b_badge(w, h, s, rgb(226, 62, 52)), 'count-badge-green': lambda w, h, s: b_badge(w, h, s, rgb(66, 176, 70)),
    'tile-cream': lambda w, h, s: b_tile(w, h, s, 'cream'), 'tile-dirt': lambda w, h, s: b_tile(w, h, s, 'dirt'), 'tile-sand': lambda w, h, s: b_tile(w, h, s, 'sand'), 'tile-stone': lambda w, h, s: b_tile(w, h, s, 'stone'), 'tile-cracked': lambda w, h, s: b_tile(w, h, s, 'cracked'),
    'tablet-skull': lambda w, h, s: b_tablet(w, h, s, 'skull'), 'tablet-footprint': lambda w, h, s: b_tablet(w, h, s, 'footprint'), 'tablet-fern': lambda w, h, s: b_tablet(w, h, s, 'fern'),
    'dirt-crumbs': lambda w, h, s: b_crumbs(w, h, s),
}

def main():
    args = sys.argv[1:]; contact = None
    if '--contact' in args: i = args.index('--contact'); contact = args[i + 1]; del args[i:i + 2]
    only = None
    if '--only' in args: i = args.index('--only'); only = set(args[i + 1].split(',')); del args[i:i + 2]
    out_dir = pathlib.Path(args[0]) if args else pathlib.Path(__file__).resolve().parents[1] / 'art' / 'ui'
    out_dir.mkdir(parents=True, exist_ok=True)
    spec = slots_from_manifest(); made = []
    for name, (w, h, n) in spec.items():
        if only and name not in only: continue
        if name not in BUILD: print('no builder for', name); continue
        for v in range(n):
            im = to_img(BUILD[name](w, h, 1000 + hash_name(name) + v * 7))
            fn = f'{name}-{v + 1}.png' if n > 1 else f'{name}.png'
            im.save(out_dir / fn); made.append((fn, im)); print(fn, im.size)
    if contact: contact_sheet(made, contact)

def hash_name(s): return sum(ord(c) * (i + 1) for i, c in enumerate(s))

def contact_sheet(made, path, cols=4, pad=14):
    cell_w = max(im.width for _, im in made) + pad; rows = []; cur = []; x = 0
    W = 1500; y = pad; maxh = 0; pos = []
    for fn, im in made:
        if x + im.width + pad > W: x = 0; y += maxh + pad + 14; maxh = 0
        pos.append((fn, im, x + pad, y)); x += im.width + pad; maxh = max(maxh, im.height)
    H = y + maxh + pad
    bg = Image.new('RGBA', (W + pad, H + pad), (58, 44, 34, 255)); dr = ImageDraw.Draw(bg)
    for fn, im, px, py in pos: bg.alpha_composite(im, (px, py))
    bg.convert('RGB').save(path); print('contact sheet', path)

if __name__ == '__main__': main()
