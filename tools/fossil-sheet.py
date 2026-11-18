#!/usr/bin/env python3
"""Turn the fossil art sheet (art/sheets/fossils-final.png: 8 carved sandstone panels, 47 fossils with brass name plaques) into the
game's fossil pictures (docs/15):

  art/fossils/<id>.webp        1080x1740 dig/museum slab: the T. rex slab's frame (arch, pillars, stands, blank brass plaque, brush,
                               bowl) with its slab face re-carved: sandstone synthesised from the SHEET's own empty stone (image
                               quilting), colour/lighting matched to the T. rex slab, the upscaled fossil centred and large in a recess.
  art/fossils/thumb/<id>.webp  <=256 px RGBA cut-out of the carving (alpha = carving silhouette) for the museum grid and island map.
  src/data/fossilSlabs.js      generated: per fossil the 10 dig strokes (head to tail, following the carving) + thumb aspect.
  docs/screens/m9/fossils-contact.png   contact sheet of every slab.

Steps: (1) CUT: per fossil a hand-tuned box (tools/fossil-sheet-boxes.json, panel-local px, above the plaque); the carving mask is the
lighter, yellower, less saturated relief vs. the orange stone, closed + hole-filled. (2) UPSCALE: Real-ESRGAN x4plus in numpy
(tools/esrgan_np.py; compared against Lanczos+USM, EDSR, ESPCN, FSRCNN, x4plus_anime_6B, general-x4v3: sharpest and cleanest),
whole panel faces at once (cached in --cache). (3) SLAB: see above. (4) DIG: 10 strokes split the carving into 10 equal-area slices
head to tail; each stroke runs along its slice with a radius that covers it. (5) THUMBS.

usage: python3 tools/fossil-sheet.py [--only id,id] [--cache ~/.cache/dino-sr/panels] [--keep-trex] [--no-slabs]
The T. rex is re-made from the sheet too (so all 47 match); its original slab is kept as art/reference/slab-frame-trex.webp, the frame.
Needs numpy, opencv-python(-headless), pillow. Deterministic (seeded per fossil). Re-run safe.
"""
import os, sys, json, argparse, hashlib
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
CFG = json.load(open(os.path.join(HERE, 'fossil-sheet-boxes.json')))
PW, PH = CFG['panel']; FACE_Y0, FACE_Y1 = 80, 480       # the part of each panel that is upscaled (the slab face)
SC = 4
FRAME = os.path.join(ROOT, 'art', 'fossils', 'cretaceous-tyrannosaurus.webp')
FRAME_KEEP = os.path.join(ROOT, 'art', 'reference', 'slab-frame-trex.webp')   # pristine copy of the T. rex slab = the frame template
OUT = os.path.join(ROOT, 'art', 'fossils'); THUMBS = os.path.join(OUT, 'thumb')
JS = os.path.join(ROOT, 'games', 'dino-match', 'src', 'data', 'fossilSlabs.js')
SW, SH = 1080, 1740
# slab face of the T. rex frame (px of 1080x1740) that gets re-carved; the rock rim, plaque, stands and props outside it are kept
FACE = [(150, 340), (300, 240), (470, 205), (720, 205), (900, 285), (995, 420), (1020, 600), (1025, 900), (1012, 1130), (965, 1250),
        (760, 1290), (330, 1292), (150, 1262), (78, 1150), (70, 900), (76, 600), (98, 430)]
# envelope of the original T. rex skeleton in that frame (erased before the new fossil goes in)
TREX = [(90, 400), (200, 318), (430, 318), (505, 500), (800, 515), (995, 700), (1035, 950), (1005, 1170), (860, 1255), (400, 1225),
        (330, 1030), (200, 1015), (100, 890), (78, 600)]
FIT = (545, 770, 880, 800)          # fossil fit box: centre x, centre y, max w, max h
TH, CLOSE, VSHADE, OPEN = 0.40, 6, 36, 4     # carving mask: score threshold, closing and opening radius (px at 4x)
MAXZOOM = 1.6                       # never enlarge the 4x fossil more than this (blur)


def score_of(bgr):
    """0..1 'carving-ness': yellower hue, less saturated, not in shadow."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    return (np.clip((H - 12) / 10, 0, 1) * 0.5 + np.clip((200 - S) / 120, 0, 1) * 0.5) * np.clip((V - 90) / 80, 0, 1)


def fill_holes(m):
    inv = (1 - m).astype(np.uint8); pad = np.pad(inv, 1, constant_values=1); h, w = pad.shape
    cv2.floodFill(pad, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 2)
    return ((pad[1:-1, 1:-1] != 2)).astype(np.uint8)


def disk(r): return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


# ---------------------------------------------------------------- upscale (cached per panel)
def panels(sheet_bgr, cache):
    os.makedirs(cache, exist_ok=True); out = {}
    for n in range(1, 9):
        p = os.path.join(cache, f'panel{n}.png')
        if not os.path.exists(p):
            import esrgan_np as E
            px, py = ((n - 1) % 4) * PW, ((n - 1) // 4) * PH
            print(f'upscaling panel {n} (Real-ESRGAN x4plus, numpy, ~2-3 min)...', flush=True)
            r = E.upscale(sheet_bgr[py + FACE_Y0:py + FACE_Y1, px:px + PW][..., ::-1].copy(), 'RealESRGAN_x4plus', tile=100)
            cv2.imwrite(p, r[..., ::-1])
        out[n] = cv2.imread(p)
    return out


# ---------------------------------------------------------------- cut
def cut(up, f):
    """-> (bgr crop at 4x, silhouette mask 0/1, box offset) for one fossil"""
    x0, y0, x1, y1 = f['box']; pad = 14
    X0, Y0 = max(0, (x0 - pad) * SC), max(0, (y0 - FACE_Y0 - pad) * SC)
    X1, Y1 = min(up.shape[1], (x1 + pad) * SC), min(up.shape[0], (y1 - FACE_Y0 + pad) * SC)
    crop = up[Y0:Y1, X0:X1].copy()
    sc = cv2.GaussianBlur(score_of(crop), (0, 0), 1.2)
    inbox = np.zeros(sc.shape, np.uint8); bx0, by0 = x0 * SC - X0, (y0 - FACE_Y0) * SC - Y0; bx1, by1 = x1 * SC - X0, (y1 - FACE_Y0) * SC - Y0
    inbox[by0:by1, bx0:bx1] = 1
    lit = cv2.morphologyEx((sc > TH).astype(np.uint8) & inbox, cv2.MORPH_OPEN, disk(2))
    # the light comes from the top left: the lower/right half of a bone is in shade and has the stone's own colour, so colour alone
    # finds only the lit half. Grow the lit mask DOWN (and a little right) by up to `shade` px, then close and fill holes.
    K = f.get('shade', VSHADE); m = lit.copy()
    for k in range(2, K + 1, 2): m |= np.roll(np.roll(lit, k, 0), k // 3, 1)
    m = fill_holes(cv2.morphologyEx(m, cv2.MORPH_CLOSE, disk(CLOSE)))
    m &= inbox
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 1:   # keep the body and parts close to it (feet, fins); drop far specks (stone highlights)
        areas = st[1:, cv2.CC_STAT_AREA]; big = areas.max(); core = np.isin(lab, 1 + np.where(areas >= big * 0.25)[0]).astype(np.uint8)
        near = cv2.dilate(core, disk(16)); keep = np.zeros(n, bool)
        for i in range(1, n): keep[i] = areas[i - 1] >= big * 0.25 or (areas[i - 1] >= 300 and (near[lab == i]).any())
        m = keep[lab].astype(np.uint8)
    if f.get('fill') == 'hull':   # compact bodies (trilobite, skulls): the convex hull of each part
        cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); hm = np.zeros_like(m)
        for c in cnts: cv2.fillPoly(hm, [cv2.convexHull(c)], 1)
        m = hm & inbox
    m = cv2.morphologyEx(fill_holes(m), cv2.MORPH_OPEN, disk(OPEN))
    return crop, m, (bx0, by0, bx1, by1)


# ---------------------------------------------------------------- stone texture (image quilting from the sheet's empty stone)
def stone_pool(ups, sheet_bgr):
    """(upscaled panel, free-stone mask) per panel: the slab face minus every carving (its silhouette grown a lot, so no bone edge or
    recess shadow is sampled), the brass plaques and anything bright and yellow (plaques, carvings the mask missed)."""
    pool = []
    for n, up in ups.items():
        busy = np.zeros(up.shape[:2], np.uint8)
        for f in CFG['fossils']:
            if f['sheet'] != n: continue
            x0, y0, x1, y1 = f['box']; pad = 14
            X0, Y0 = max(0, (x0 - pad) * SC), max(0, (y0 - FACE_Y0 - pad) * SC)
            _, sil, _ = cut(up, f); busy[Y0:Y0 + sil.shape[0], X0:X0 + sil.shape[1]] |= sil
        busy = cv2.dilate(busy, disk(36))
        hot = (cv2.GaussianBlur(score_of(up), (0, 0), 2) > 0.5).astype(np.uint8)
        busy |= cv2.dilate(cv2.morphologyEx(hot, cv2.MORPH_OPEN, disk(3)), disk(30))
        free = 1 - busy; m = 28 * SC; free[:, :m] = 0; free[:, -m:] = 0; free[:14 * SC] = 0; free[(468 - FACE_Y0) * SC:] = 0
        pool.append((up, free))
    return pool


def quilt(pool, w, h, rng, B=128, O=36):
    lab_pool = [(cv2.cvtColor(u, cv2.COLOR_BGR2LAB).astype(np.float32), F) for u, F in pool]
    cands = []
    for k, (u, F) in enumerate(lab_pool):
        bad = cv2.integral((1 - F).astype(np.uint8))
        ys, xs = np.mgrid[0:u.shape[0] - B:6, 0:u.shape[1] - B:6]
        s = bad[ys + B, xs + B] - bad[ys, xs + B] - bad[ys + B, xs] + bad[ys, xs]
        for y, x in zip(ys[s == 0], xs[s == 0]): cands.append((k, y, x))
    cands = np.array(cands)
    step = B - O; nx = int(np.ceil((w - O) / step)); ny = int(np.ceil((h - O) / step))
    out = np.zeros((ny * step + O, nx * step + O, 3), np.float32)
    for j in range(ny):
        for i in range(nx):
            y, x = j * step, i * step
            pick = cands[rng.choice(len(cands), 240, replace=False)]
            patches = [lab_pool[k][0][py:py + B, px:px + B] for k, py, px in pick]
            if i == 0 and j == 0: best = patches[0]
            else:
                errs = []
                for p in patches:
                    e = 0.0
                    if i: e += ((p[:, :O] - out[y:y + B, x:x + O]) ** 2).sum()
                    if j: e += ((p[:O, :] - out[y:y + O, x:x + B]) ** 2).sum()
                    errs.append(e)
                errs = np.array(errs); ok = np.where(errs <= errs.min() * 1.08)[0]; best = patches[rng.choice(ok)]
            mask = np.ones((B, B), np.float32)
            if i: mask[:, :O] = np.minimum(mask[:, :O], mincut(((best[:, :O] - out[y:y + B, x:x + O]) ** 2).sum(2)))
            if j: mask[:O, :] = np.minimum(mask[:O, :], mincut(((best[:O, :] - out[y:y + O, x:x + B]) ** 2).sum(2).T).T)
            mask = cv2.GaussianBlur(mask, (0, 0), 1.5) if (i or j) else mask
            region = out[y:y + B, x:x + B]
            out[y:y + B, x:x + B] = region * (1 - mask[..., None]) + best * mask[..., None]
    return cv2.cvtColor(np.clip(out[:h, :w], 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)


def mincut(err):
    """err: B x O (rows along the seam). -> mask B x O, 1 right of the min-error vertical path."""
    Bh, O = err.shape; E = err.copy(); back = np.zeros((Bh, O), int)
    for r in range(1, Bh):
        for c in range(O):
            lo, hi = max(0, c - 1), min(O, c + 2); k = lo + int(np.argmin(E[r - 1, lo:hi])); back[r, c] = k; E[r, c] += E[r - 1, k]
    m = np.zeros((Bh, O), np.float32); c = int(np.argmin(E[-1]))
    for r in range(Bh - 1, -1, -1): m[r, c:] = 1; c = back[r, c]
    return m


# ---------------------------------------------------------------- colour helpers
def lab_match(src_bgr, src_sel, ref_mean, ref_std, strength=1.0):
    L = cv2.cvtColor(src_bgr, cv2.COLOR_BGR2LAB).astype(np.float32); px = L[src_sel > 0]
    m, s = px.mean(0), px.std(0) + 1e-3
    out = (L - m) / s * ref_std + ref_mean
    out = L + (out - L) * strength
    return cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)


def poly_mask(pts, w, h):
    m = np.zeros((h, w), np.uint8); cv2.fillPoly(m, [np.array(pts, np.int32)], 1); return m


# ---------------------------------------------------------------- frame analysis (once)
def frame_info(frame):
    """The T. rex slab as a frame: its old bones (to erase), its clean stone (patch pool), the rock outline (fills stay inside it)."""
    face = poly_mask(FACE, SW, SH); rock = cv2.erode(rock_mask(frame), disk(12))
    old = poly_mask(TREX, SW, SH)    # hand-drawn envelope of the old T. rex skeleton (fixed art, so a polygon beats colour detection)
    bones = cv2.GaussianBlur(cv2.dilate(old, disk(20)).astype(np.float32), (0, 0), 14)
    free = (face & rock & (1 - cv2.dilate(old, disk(40)))).astype(np.uint8)
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV); L = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB).astype(np.float32)
    cream = (old > 0) & (score_of(frame) > 0.45); bp = L[cream]
    return dict(bone_mean=bp.mean(0), bone_std=bp.std(0), bones=bones, rock=cv2.GaussianBlur(rock.astype(np.float32), (0, 0), 4), pool_lab=cv2.cvtColor(frame, cv2.COLOR_BGR2LAB).astype(np.float32), pool_free=free)


def rock_mask(frame):
    """the slab rock (warm, fairly bright) as one blob, for limiting the replace region"""
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV); m = ((hsv[..., 2] > 110) & (hsv[..., 0] < 30)).astype(np.uint8)
    m[:150] = 0; m[1300:] = 0
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, disk(15)); return fill_holes(m)


# ---------------------------------------------------------------- dig strokes from the silhouette
def strokes(mask, head, parts=10):
    ys, xs = np.nonzero(mask)
    if head == 'top': t, u = ys.astype(float), xs.astype(float)
    elif head == 'right': t, u = -xs.astype(float), ys.astype(float)
    else: t, u = xs.astype(float), ys.astype(float)
    order = np.argsort(t); qs = np.array_split(order, parts); out = []
    for q in qs:
        tq, uq = t[q], u[q]; span_t = tq.max() - tq.min() + 1; span_u = uq.max() - uq.min() + 1
        k = int(np.clip(np.ceil(span_u / max(40, span_t * 1.1)), 1, 4))
        ou = np.argsort(uq); groups = np.array_split(ou, k)
        pts = [(tq[g].mean(), uq[g].mean()) for g in groups]
        if k == 1:   # a single point: stretch along the slice so the brush visibly travels
            c = pts[0]; pts = [(c[0], uq.min() + span_u * 0.2), (c[0], uq.max() - span_u * 0.2)] if span_u > 30 else [(tq.min() + span_t * 0.25, c[1]), (tq.max() - span_t * 0.25, c[1])]
        P = np.array(pts); Q = np.stack([tq, uq], 1)
        d = np.full(len(Q), 1e9)
        for a, b in zip(P[:-1], P[1:]):
            ab = b - a; L2 = (ab ** 2).sum() + 1e-9; s = np.clip(((Q - a) @ ab) / L2, 0, 1); d = np.minimum(d, np.hypot(*(Q - (a + s[:, None] * ab)).T))
        reff = np.percentile(d, 97) + 10
        r = reff / 0.6
        res = []
        for pt, pu in P:
            if head == 'top': x, y = pu, pt
            elif head == 'right': x, y = -pt, pu
            else: x, y = pt, pu
            res.append([x, y, r])
        out.append(res)
    return out


def coverage(mask, strokes_px):
    cov = np.zeros_like(mask)
    for s in strokes_px:
        for (x0, y0, r0), (x1, y1, r1) in zip(s[:-1], s[1:]):
            for k in np.linspace(0, 1, 12):
                cv2.circle(cov, (int(x0 + (x1 - x0) * k), int(y0 + (y1 - y0) * k)), int((r0 + (r1 - r0) * k) * 0.6), 1, -1)
    return (cov & mask).sum() / max(1, mask.sum())


# ---------------------------------------------------------------- one slab
def fill_hole(lab, hole, pool_lab, pool_free, rng, B=160, ncand=260):
    """Fill `hole` (float 0..1) in the Lab image with patches of the T. rex slab's own clean stone: raster order over the hole, each patch
    chosen to match what is already there (original stone outside the hole, earlier patches inside), pasted with a feathered weight."""
    H, W = hole.shape; out = lab.copy(); known = (hole < 0.02).astype(np.float32)
    bad = cv2.integral((1 - pool_free).astype(np.uint8))
    ys, xs = np.mgrid[0:pool_lab.shape[0] - B:6, 0:pool_lab.shape[1] - B:6]
    ok = (bad[ys + B, xs + B] - bad[ys, xs + B] - bad[ys + B, xs] + bad[ys, xs]) == 0
    cands = np.stack([ys[ok], xs[ok]], 1)
    step = B // 2; feather = np.outer(np.hanning(B + 2)[1:-1], np.hanning(B + 2)[1:-1]).astype(np.float32)
    acc = np.zeros_like(lab); wsum = np.zeros((H, W), np.float32); used = set()
    hy, hx = np.nonzero(hole > 0.02); y0, y1, x0, x1 = hy.min(), hy.max(), hx.min(), hx.max()
    for y in range(max(0, y0 - B // 2), min(H - B, y1) + 1, step):
        for x in range(max(0, x0 - B // 2), min(W - B, x1) + 1, step):
            hpatch = hole[y:y + B, x:x + B]
            if hpatch.max() < 0.02: continue
            ws = wsum[y:y + B, x:x + B]; cur = np.where((ws > 0.05)[..., None], acc[y:y + B, x:x + B] / np.maximum(ws, 1e-6)[..., None], out[y:y + B, x:x + B])
            kw = np.clip(known[y:y + B, x:x + B] + (ws > 0.05), 0, 1)
            pick = cands[rng.choice(len(cands), min(ncand, len(cands)), replace=False)]
            pick = np.array([p for p in pick if (p[0] // 24, p[1] // 24) not in used] or pick)
            errs = np.array([(((pool_lab[py:py + B, px:px + B] - cur) ** 2).sum(2) * kw).sum() for py, px in pick]) if kw.sum() > 50 else rng.random(len(pick))
            py, px = pick[rng.choice(np.argsort(errs)[:4])]; used.add((py // 24, px // 24))
            acc[y:y + B, x:x + B] += pool_lab[py:py + B, px:px + B] * feather[..., None]; wsum[y:y + B, x:x + B] += feather
    syn = np.where((wsum > 1e-3)[..., None], acc / np.maximum(wsum, 1e-6)[..., None], out)
    return out * (1 - hole[..., None]) + syn * hole[..., None]


def make_slab(f, crop, sil, frame, fi, pool, seed):
    rng = np.random.default_rng(seed)
    # fossil: scale into the fit box
    ys, xs = np.nonzero(sil); bx, by, bw, bh = xs.min(), ys.min(), xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
    cx, cy, fw, fh = FIT; z = min(fw / bw, fh / bh, MAXZOOM)
    W, H = int(crop.shape[1] * z), int(crop.shape[0] * z)
    cz = cv2.resize(crop, (W, H), interpolation=cv2.INTER_LANCZOS4); sz = cv2.resize(sil.astype(np.float32), (W, H), interpolation=cv2.INTER_LINEAR)
    ox, oy = int(cx - (bx + bw / 2) * z), int(cy - (by + bh / 2) * z)
    S = np.zeros((SH, SW), np.float32); C = np.zeros((SH, SW, 3), np.uint8)
    ya, xa = max(0, oy), max(0, ox); yb, xb = min(SH, oy + H), min(SW, ox + W)
    S[ya:yb, xa:xb] = sz[ya - oy:yb - oy, xa - ox:xb - ox]; C[ya:yb, xa:xb] = cz[ya - oy:yb - oy, xa - ox:xb - ox]
    valid = np.zeros((SH, SW), np.float32); valid[ya:yb, xa:xb] = 1
    valid = cv2.GaussianBlur(cv2.erode(valid, disk(10)), (0, 0), 6)
    sil_full = (S > 0.5).astype(np.uint8)
    # 1) erase the old T. rex: fill its bones (and where the new fossil goes) with the slab's own stone
    hole = np.maximum(fi['bones'], cv2.GaussianBlur(cv2.dilate(sil_full, disk(50)).astype(np.float32), (0, 0), 12)) * fi['rock']
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB).astype(np.float32)
    lab = fill_hole(lab, hole, fi['pool_lab'], fi['pool_free'], rng)
    face = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)
    # 2) colour-match the fossil crop: its stone ring -> the slab stone around it (the same transform lifts the bone)
    ring = cv2.dilate(sil_full, disk(30)) & (1 - cv2.dilate(sil_full, disk(6))) & (valid > 0.5).astype(np.uint8)
    tgt = cv2.cvtColor(face, cv2.COLOR_BGR2LAB).astype(np.float32)[ring > 0]
    # two looks: the stone of the crop -> the slab's stone, the lit bone -> the cream of the original T. rex bones; blended by bone-ness
    Csrc = C.copy(); bw_ = np.clip((cv2.GaussianBlur(score_of(Csrc), (0, 0), 1.5) - 0.22) / 0.3, 0, 1) * (S > 0.2)
    Cst = lab_match(Csrc, ring, tgt.mean(0), tgt.std(0), 1.0)
    boneSel = ((bw_ > 0.8) & (S > 0.5)).astype(np.uint8)
    Cb = lab_match(Csrc, boneSel, fi['bone_mean'], fi['bone_std'], 1.0) if boneSel.sum() > 200 else Cst
    C = np.clip(Cst.astype(np.float32) * (1 - bw_[..., None]) + Cb.astype(np.float32) * bw_[..., None], 0, 255).astype(np.uint8)
    # 3) carved recess: a soft dark hollow around the fossil, a lit lip on its top-left
    grown = cv2.dilate(sil_full, disk(34)).astype(np.float32)
    near = cv2.GaussianBlur(grown, (0, 0), 18)
    hi = np.clip(cv2.GaussianBlur(np.roll(np.roll(grown, -7, 0), -7, 1), (0, 0), 5) - cv2.GaussianBlur(grown, (0, 0), 5), 0, 1)
    lo = np.clip(cv2.GaussianBlur(np.roll(np.roll(grown, 7, 0), 7, 1), (0, 0), 5) - cv2.GaussianBlur(grown, (0, 0), 5), 0, 1)
    fl = face.astype(np.float32)
    fl *= (1 - 0.13 * near)[..., None]; fl *= (1 - 0.35 * lo)[..., None]
    fl += (hi * 40)[..., None] * np.array([0.5, 0.8, 1.0])
    # 4) paste the fossil with a generous feathered stone ring (keeps the shaded halves the mask may miss)
    A = cv2.GaussianBlur(cv2.dilate(sil_full, disk(20)).astype(np.float32), (0, 0), 9) * valid
    fl = fl * (1 - A[..., None]) + C.astype(np.float32) * A[..., None]
    fl += rng.normal(0, 2.6, (SH, SW)).astype(np.float32)[..., None] * A[..., None]   # grain on the upscaled part only
    return np.clip(fl, 0, 255).astype(np.uint8), sil_full


def thumb(crop, sil, size=256):
    a = cv2.GaussianBlur(cv2.dilate(sil, disk(4)).astype(np.float32), (0, 0), 1.6)
    ys, xs = np.nonzero(a > 0.02); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([crop[y0:y1, x0:x1][..., ::-1], (a[y0:y1, x0:x1] * 255).astype(np.uint8)])
    im = Image.fromarray(rgba, 'RGBA'); im.thumbnail((size, size), Image.LANCZOS); return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default=''); ap.add_argument('--cache', default=os.path.expanduser('~/.cache/dino-sr/panels'))
    ap.add_argument('--keep-trex', action='store_true', help='keep the original T. rex slab (art/reference/slab-frame-trex.webp) instead of re-making it from the sheet')
    ap.add_argument('--no-slabs', action='store_true'); ap.add_argument('--quality', type=int, default=80)
    a = ap.parse_args()
    sheet = cv2.imread(os.path.join(ROOT, CFG['sheet']))
    assert sheet is not None and sheet.shape[:2] == (PH * 2, PW * 4), 'sheet must be 1536x1024'
    ids = json.load(open(os.path.join(HERE, 'roster-ids.json')))['fossils']
    assert [f['id'] for f in CFG['fossils']] == ids, 'boxes JSON order != roster-ids.json'
    ups = panels(sheet, a.cache)
    if not os.path.exists(FRAME_KEEP):
        import shutil; os.makedirs(os.path.dirname(FRAME_KEEP), exist_ok=True); shutil.copyfile(FRAME, FRAME_KEEP)
    frame = cv2.cvtColor(np.asarray(Image.open(FRAME_KEEP).convert('RGB')), cv2.COLOR_RGB2BGR)
    fi = frame_info(frame); pool = None
    only = set(filter(None, a.only.split(',')))
    os.makedirs(THUMBS, exist_ok=True)
    side = os.path.join(a.cache, 'meta.json')   # per-fossil results, so --only runs keep the others
    meta = json.load(open(side)) if os.path.exists(side) else {}
    for f in CFG['fossils']:
        if only and f['id'] not in only: continue
        crop, sil, _ = cut(ups[f['sheet']], f)
        th = thumb(crop, sil); th.save(os.path.join(THUMBS, f['id'] + '.webp'), quality=86, method=6)
        rec = {'thumb': [th.size[0], th.size[1]], 'head': f['head']}
        keep_trex = f['id'] == 'cretaceous-tyrannosaurus' and a.keep_trex
        if not a.no_slabs and not keep_trex:
            seed = int(hashlib.md5(f['id'].encode()).hexdigest()[:8], 16)
            img, S = make_slab(f, crop, sil, frame, fi, pool, seed)
            Image.fromarray(img[..., ::-1]).save(os.path.join(OUT, f['id'] + '.webp'), quality=a.quality, method=6)
            st = strokes(S, f['head']); cov = coverage(S, st)
            rec['reveal'] = [[[round(x / SW, 4), round(y / SH, 4), round(r / SW, 4)] for x, y, r in s] for s in st]
            rec['coverage'] = round(float(cov), 3)
            print(f"{f['id']:28s} fossil {S.sum() / (SW * SH) * 100:4.1f}% of slab, strokes cover {cov * 100:.0f}%", flush=True)
        elif keep_trex:
            import shutil; shutil.copyfile(FRAME_KEEP, os.path.join(OUT, f['id'] + '.webp'))
            print(f"{f['id']:28s} slab = the original art, thumb from the sheet (fossilImages.js needs its hand strokes back)", flush=True)
        old = {k: v for k, v in meta.get(f['id'], {}).items() if not (keep_trex and k in ('reveal', 'coverage'))}
        meta[f['id']] = {**old, **rec}
    json.dump(meta, open(side, 'w'), indent=0)
    write_js(meta)
    contact(ids)


def contact(ids, cols=8, tw=216):
    """docs/screens/m9/fossils-contact.png: every slab, small, with its id"""
    th = int(tw * SH / SW); rows = (len(ids) + cols - 1) // cols; lab = 18
    sheet = np.full((rows * (th + lab), cols * tw, 3), 24, np.uint8)
    for i, id_ in enumerate(ids):
        p = os.path.join(OUT, id_ + '.webp')
        if not os.path.exists(p): continue
        im = cv2.resize(cv2.cvtColor(np.asarray(Image.open(p).convert('RGB')), cv2.COLOR_RGB2BGR), (tw, th), interpolation=cv2.INTER_AREA)
        r, c = divmod(i, cols); y, x = r * (th + lab), c * tw
        sheet[y:y + th, x:x + tw] = im
        cv2.putText(sheet, id_, (x + 3, y + th + 13), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (220, 220, 220), 1, cv2.LINE_AA)
    out = os.path.join(ROOT, 'docs', 'screens', 'm9'); os.makedirs(out, exist_ok=True)
    cv2.imwrite(os.path.join(out, 'fossils-contact.png'), sheet)


def write_js(meta):
    cover = [[round(x / SW, 4), round(y / SH, 4)] for x, y in FACE]
    lines = ['// GENERATED by tools/fossil-sheet.py from art/sheets/fossils-final.png. Do not edit by hand: change tools/fossil-sheet-boxes.json',
             '// and re-run. Per fossil: the 10 dig strokes ([x, y, r] in 0..1 of the 1080x1740 slab, head to tail along the carving), the',
             '// head side (left/right/top) and thumbnail size (art/fossils/thumb/<id>.webp, RGBA cut-out of the carving). SLAB_COVER = the slab\n// face (dirt-covered area) shared by every slab made from the T. rex frame.',
             f'export const SLAB_COVER = {json.dumps(cover)};', 'export const SLABS = {']
    for k in json.load(open(os.path.join(HERE, 'roster-ids.json')))['fossils']:
        if k not in meta: continue
        m = meta[k]; parts = [f"head: '{m['head']}'", f"thumb: {json.dumps(m['thumb'])}"]
        if 'reveal' in m: parts.append('reveal: [\n    ' + ',\n    '.join(json.dumps(s) for s in m['reveal']) + '\n  ]')
        lines.append(f"  '{k}': {{ " + ', '.join(parts) + ' },')
    lines.append('};')
    open(JS, 'w').write('\n'.join(lines) + '\n')


if __name__ == '__main__':
    main()
