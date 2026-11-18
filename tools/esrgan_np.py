#!/usr/bin/env python3
"""Real-ESRGAN inference in plain numpy (no torch): loads the official .pth weights and runs RRDBNet (RealESRGAN_x4plus,
x4plus_anime_6B) or SRVGGNetCompact (realesr-general-x4v3). Slow (a few seconds per 150x90 crop on 2 CPU cores) but needs only
numpy. Used by tools/fossil-sheet.py.

Weights (GitHub releases of xinntao/Real-ESRGAN), downloaded on demand into ~/.cache/dino-sr:
  RealESRGAN_x4plus.pth            https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth
  RealESRGAN_x4plus_anime_6B.pth   https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth
  realesr-general-x4v3.pth         https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth
"""
import os, io, pickle, zipfile, urllib.request
import numpy as np

URLS = {
    'RealESRGAN_x4plus': 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth',
    'RealESRGAN_x4plus_anime_6B': 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth',
    'realesr-general-x4v3': 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth',
}
CACHE = os.environ.get('DINO_SR_CACHE', os.path.expanduser('~/.cache/dino-sr'))


def weights_path(name):
    p = os.path.join(CACHE, name + '.pth')
    if not os.path.exists(p):
        os.makedirs(CACHE, exist_ok=True)
        urllib.request.urlretrieve(URLS[name], p + '.part'); os.replace(p + '.part', p)
    return p


# ---- torch zip-checkpoint reader (only what these checkpoints use) ----
_DT = {'FloatStorage': np.float32, 'HalfStorage': np.float16, 'DoubleStorage': np.float64, 'LongStorage': np.int64, 'IntStorage': np.int32}


class _Storage:
    def __init__(self, kind): self.kind = kind


def load_pth(path):
    z = zipfile.ZipFile(path); names = z.namelist(); root = names[0].split('/')[0]
    pkl = [n for n in names if n.endswith('data.pkl')][0]; root = pkl[:-len('data.pkl')]
    cache = {}

    def storage(kind, key):
        if key not in cache: cache[key] = np.frombuffer(z.read(root + 'data/' + key), dtype=_DT[kind])
        return cache[key]

    def rebuild(st, offset, size, stride, *a):
        arr = st
        if not size: return arr[offset:offset + 1].reshape(()).copy()
        item = arr.itemsize
        return np.lib.stride_tricks.as_strided(arr[offset:], shape=tuple(size), strides=tuple(s * item for s in stride)).copy()

    class U(pickle.Unpickler):
        def find_class(self, mod, name):
            if name == '_rebuild_tensor_v2': return rebuild
            if name in _DT: return _Storage(name)
            if mod == 'collections' and name == 'OrderedDict':
                import collections; return collections.OrderedDict
            if name == '_rebuild_parameter': return lambda t, *a: t
            raise pickle.UnpicklingError(f'unsupported {mod}.{name}')

        def persistent_load(self, pid):
            _, kind, key, loc, n = pid
            return storage(kind.kind if isinstance(kind, _Storage) else kind, key)

    sd = U(io.BytesIO(z.read(pkl))).load()
    for k in ('params_ema', 'params', 'state_dict'):
        if isinstance(sd, dict) and k in sd: sd = sd[k]; break
    return {k: v.astype(np.float32) for k, v in sd.items()}


# ---- layers (NHWC, float32) ----
def conv(x, w, b, pad=1):
    """x: H x W x Cin, w: Cout x Cin x k x k"""
    H, W, C = x.shape; co, ci, k, _ = w.shape
    xp = np.pad(x, ((pad, pad), (pad, pad), (0, 0)), mode='constant') if pad else x
    Ho, Wo = H + 2 * pad - k + 1, W + 2 * pad - k + 1
    out = np.zeros((Ho * Wo, co), np.float32)
    wt = w.transpose(2, 3, 1, 0)  # k k cin cout
    for dy in range(k):
        for dx in range(k):
            out += xp[dy:dy + Ho, dx:dx + Wo, :].reshape(-1, C) @ wt[dy, dx]
    out += b
    return out.reshape(Ho, Wo, co)


def lrelu(x, s=0.2): return np.where(x > 0, x, x * s)


def up2(x): return x.repeat(2, axis=0).repeat(2, axis=1)


def rrdbnet(sd, img, nb=None):
    g = lambda n: (sd[n + '.weight'], sd[n + '.bias'])
    nb = nb or len({k.split('.')[1] for k in sd if k.startswith('body.')})
    fea = conv(img, *g('conv_first'))
    x = fea
    for i in range(nb):
        y = x
        for r in (1, 2, 3):
            p = f'body.{i}.rdb{r}.'
            x1 = lrelu(conv(y, *g(p + 'conv1')))
            x2 = lrelu(conv(np.concatenate([y, x1], 2), *g(p + 'conv2')))
            x3 = lrelu(conv(np.concatenate([y, x1, x2], 2), *g(p + 'conv3')))
            x4 = lrelu(conv(np.concatenate([y, x1, x2, x3], 2), *g(p + 'conv4')))
            x5 = conv(np.concatenate([y, x1, x2, x3, x4], 2), *g(p + 'conv5'))
            y = x5 * 0.2 + y
        x = y * 0.2 + x
    fea = fea + conv(x, *g('conv_body'))
    fea = lrelu(conv(up2(fea), *g('conv_up1')))
    fea = lrelu(conv(up2(fea), *g('conv_up2')))
    return conv(lrelu(conv(fea, *g('conv_hr'))), *g('conv_last'))


def srvgg(sd, img):
    # body.0 conv, body.1 prelu, body.2 conv, body.3 prelu, ... last conv, then pixelshuffle x4 and + nearest upsample
    keys = sorted({int(k.split('.')[1]) for k in sd if k.startswith('body.')})
    x = img
    for i in keys:
        if f'body.{i}.bias' in sd and sd[f'body.{i}.weight'].ndim == 4: x = conv(x, sd[f'body.{i}.weight'], sd[f'body.{i}.bias'])
        else: a = sd[f'body.{i}.weight']; x = np.where(x > 0, x, x * a)
    H, W, C = x.shape; r = 4
    x = x.reshape(H, W, 3, r, r).transpose(0, 3, 1, 4, 2).reshape(H * r, W * r, 3)
    return x + img.repeat(4, 0).repeat(4, 1)


_MODELS = {}


def upscale(rgb_u8, name='RealESRGAN_x4plus', tile=96):
    """rgb uint8 H x W x 3 -> uint8 4H x 4W x 3. Tiled with overlap to bound memory."""
    if name not in _MODELS: _MODELS[name] = load_pth(weights_path(name))
    sd = _MODELS[name]
    run = (lambda t: srvgg(sd, t)) if name == 'realesr-general-x4v3' else (lambda t: rrdbnet(sd, t))
    img = rgb_u8.astype(np.float32) / 255.0
    H, W, _ = img.shape; ov = 10; out = np.zeros((H * 4, W * 4, 3), np.float32)
    for y0 in range(0, H, tile):
        for x0 in range(0, W, tile):
            y1, x1 = min(H, y0 + tile), min(W, x0 + tile)
            ya, xa, yb, xb = max(0, y0 - ov), max(0, x0 - ov), min(H, y1 + ov), min(W, x1 + ov)
            r = run(img[ya:yb, xa:xb])
            out[(y0) * 4:(y1) * 4, (x0) * 4:(x1) * 4] = r[(y0 - ya) * 4:(y0 - ya + y1 - y0) * 4, (x0 - xa) * 4:(x0 - xa + x1 - x0) * 4]
    return (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)
