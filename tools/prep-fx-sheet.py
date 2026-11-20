#!/usr/bin/env python3
"""Cut the owner's EFFECT and AMBIENT sheets (flat dark navy background, ~#0F1424) into game art (Dino Match).

usage:
  prep-fx-sheet.py fx <sheet.png> <out.webp> --grid COLSxROWS [--row-modes fx,solid,...] [--preview p.png]
      (the sheets of the game: explosion 4x4, beam 1x8, rainbow 4x4, small 6x4; all fx: solid leaves dark rims round sparks)
      A frame sheet (frames left to right, top to bottom, on an even grid). Written as ONE matted atlas with the SAME grid
      (art/fx/<name>.webp; render/fxArt.js knows each grid). Frames keep their place in the cell (registration), the cell edge is
      feathered over a few px so a flame that pokes over a line is not cut hard.
  prep-fx-sheet.py ambient <sheet.png> <out_root> [--preview p.png]
      The ambient sheet: 3 columns x 10 rows, one row per era (src/core/eras.js order). Every element is found as a connected blob
      (dilated, so bubbles / motes / embers stay one element), assigned to its cell by its centre (the grid is NOT even: wings
      cross the lines), cropped with a margin and written to <out_root>/<era dir>/<n>.webp (n = column 1..3).
Matte (both): alpha from the colour distance to the navy, NOT brightness (dark bats, twigs and fish stay opaque); light soft
pixels (glow, smoke, mist, light rays) get the least alpha that explains them as light over the navy, so they stay see-through;
colours are un-mixed from the navy (C = a*F + (1-a)*BG -> F), so there is no navy halo on any background.
Exits 2 (nothing written) when a cell is empty or the element count is wrong. Needs pillow, numpy, scipy.
"""
import sys, os, argparse
import numpy as np
from PIL import Image
import scipy.ndimage as ndi

ERAS = ['cambrian', 'devonian', 'carboniferous', 'permian', 'triassic', 'jurassic', 'cretaceous', 'mammals', 'iceage', 'humans']
# ambient elements that are soft light / smoke / dust (alpha from light-over-navy only, they stay see-through)
SOFT = {('cambrian', 3), ('devonian', 2), ('carboniferous', 2), ('permian', 1), ('triassic', 2), ('jurassic', 3), ('iceage', 3), ('humans', 2), ('mammals', 2)}
NOISE = 7.0      # colour distance of sheet noise / jpeg-ish speckle (always transparent)


def bg_colour(rgb):
    b = np.concatenate([rgb[:4].reshape(-1, 3), rgb[-4:].reshape(-1, 3), rgb[:, :4].reshape(-1, 3), rgb[:, -4:].reshape(-1, 3)])
    return np.median(b.astype(float), 0)


def matte(rgb, bg, mode):
    """rgb float HxWx3 -> straight RGBA float (0..255). mode: fx (glow/fire/smoke frames) | solid | soft"""
    diff = rgb - bg; d = np.sqrt((diff ** 2).sum(-1))
    light = np.clip((diff / (255.0 - bg)).max(-1), 0, 1)                 # least alpha that explains the pixel as light over navy
    gate = np.clip((d - NOISE) / 10.0, 0, 1)
    if mode == 'soft':
        a = light
    elif mode == 'fx':
        a = np.maximum(light, np.clip((d - 110) / 80.0, 0, 1))            # bright fire / solid rocks: more opaque; smoke: see-through
    else:   # solid elements: opaque body (holes filled), anti-aliased rim from the distance ramp
        body = ndi.binary_erosion(ndi.binary_fill_holes(ndi.binary_closing(d > 45, iterations=2)), iterations=2)
        rim = ndi.binary_dilation(body, iterations=4)                     # the distance ramp only right at the body's edge:
        ramp = np.clip((d - 12) / 48.0, 0, 1) * rim                       # a glow round it stays light-over-navy (no dark halo)
        a = np.maximum.reduce([light, ramp, ndi.gaussian_filter(body.astype(float), 1.0)])
    a = a * gate
    a[a < 0.02] = 0
    aa = np.maximum(a, 1e-3)[..., None]
    col = np.clip((rgb - (1 - aa) * bg) / aa, 0, 255)
    return np.dstack([col, a * 255])


def to_img(rgba):
    out = rgba.copy(); out[out[..., 3] < 1] = 0
    return Image.fromarray(out.round().clip(0, 255).astype(np.uint8), 'RGBA')


def save_webp(im, path, q=88):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    im.save(path, 'WEBP', quality=q, alpha_quality=100, method=6)


def cmd_fx(a):
    cols, rows = map(int, a.grid.lower().split('x'))
    rgb = np.asarray(Image.open(a.sheet).convert('RGB')).astype(float); H, W, _ = rgb.shape; bg = bg_colour(rgb)
    cw, ch = W // cols, H // rows                                      # every frame the same size: the atlas is cols*cw x rows*ch
    out = np.zeros((ch * rows, cw * cols, 4)); F = 6
    modes = a.row_modes.split(',') if a.row_modes else None
    print(f'sheet {W}x{H}, grid {cols}x{rows}, background {bg.round().astype(int).tolist()}')
    for r in range(rows):
        for c in range(cols):
            y0, y1, x0, x1 = round(H * r / rows), round(H * (r + 1) / rows), round(W * c / cols), round(W * (c + 1) / cols)
            y0, x0 = y0 + (y1 - y0 - ch) // 2, x0 + (x1 - x0 - cw) // 2; y1, x1 = y0 + ch, x0 + cw   # centred cw x ch window
            m = matte(rgb[y0:y1, x0:x1], bg, modes[r] if modes else 'fx')
            if m[..., 3].max() < 8: print(f'ERROR cell {r},{c} is empty', file=sys.stderr); return 2
            h, w = y1 - y0, x1 - x0
            ey = np.minimum(np.arange(h), np.arange(h)[::-1]); ex = np.minimum(np.arange(w), np.arange(w)[::-1])
            m[..., 3] *= np.clip(np.minimum.outer(ey, ex) / F, 0, 1)
            out[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw] = m
            print(f'  frame {r * cols + c + 1:2d}: coverage {(m[..., 3] > 20).mean() * 100:5.1f}%')
    save_webp(to_img(out), a.out); print('wrote', a.out)
    if a.preview: preview([a.out], a.preview)
    return 0


def cmd_ambient(a):
    rgb = np.asarray(Image.open(a.sheet).convert('RGB')).astype(float); H, W, _ = rgb.shape; bg = bg_colour(rgb)
    cols, rows = 3, len(ERAS)
    d = np.sqrt(((rgb - bg) ** 2).sum(-1))
    lab, n = ndi.label(ndi.binary_dilation(d > 22, iterations=9))
    sl = ndi.find_objects(lab); area = ndi.sum(d > 22, lab, range(1, n + 1))
    cells = {}
    for k in range(n):
        if area[k] < 30: continue                                          # specks
        ys, xs = sl[k]; cy, cx = ndi.center_of_mass(d * (lab == k + 1))
        cells.setdefault((min(rows - 1, int(cy * rows / H)), min(cols - 1, int(cx * cols / W))), []).append(k + 1)
    if len(cells) != rows * cols:
        print(f'ERROR: {len(cells)} cells hold elements, expected {rows * cols}', file=sys.stderr); return 2
    written = []
    for (r, c), ks in sorted(cells.items()):
        mask = np.isin(lab, ks); ys, xs = np.where(mask); pad = 4
        y0, y1, x0, x1 = max(0, ys.min() - pad), min(H, ys.max() + pad + 1), max(0, xs.min() - pad), min(W, xs.max() + pad + 1)
        era = ERAS[r]; mode = 'soft' if (era, c + 1) in SOFT else 'solid'
        m = matte(rgb[y0:y1, x0:x1], bg, mode); m[..., 3] *= ndi.gaussian_filter(mask[y0:y1, x0:x1].astype(float), 2)
        im = to_img(m); bb = im.getbbox(); im = im.crop(bb)
        p = os.path.join(a.out_root, era, f'{c + 1}.webp'); save_webp(im, p); written.append(p)
        print(f'  {era:>13}/{c + 1}  {mode:5}  {im.width}x{im.height}  ({len(ks)} blob{"s" if len(ks) > 1 else ""})')
    if a.preview: preview(written, a.preview, cols=3)
    return 0


def preview(files, path, cols=1, cell=None):
    ims = [Image.open(f).convert('RGBA') for f in files]
    cw = cell or max(i.width for i in ims); ch = max(i.height for i in ims)
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw * 2, rows * ch), (255, 255, 255))
    for i, im in enumerate(ims):
        r, c = divmod(i, cols)
        for k, bgc in enumerate([(15, 20, 36), (150, 160, 150)]):
            p = Image.new('RGBA', (cw, ch), bgc + (255,)); p.alpha_composite(im, ((cw - im.width) // 2, (ch - im.height) // 2))
            sheet.paste(p.convert('RGB'), (k * cols * cw + c * cw, r * ch))
    sheet.save(path); print('wrote', path)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest='cmd', required=True)
    f = sp.add_parser('fx'); f.add_argument('sheet'); f.add_argument('out'); f.add_argument('--grid', required=True); f.add_argument('--preview')
    f.add_argument('--row-modes', help='matte per grid row: fx (default: glow, fire, smoke) or solid (rocks, confetti), e.g. fx,fx,solid,solid')
    m = sp.add_parser('ambient'); m.add_argument('sheet'); m.add_argument('out_root'); m.add_argument('--preview')
    a = ap.parse_args(argv)
    return cmd_fx(a) if a.cmd == 'fx' else cmd_ambient(a)


if __name__ == '__main__':
    sys.exit(main())
