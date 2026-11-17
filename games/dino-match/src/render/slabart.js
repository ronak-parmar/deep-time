// Slab images with a dig reveal (docs/15). The picture is drawn full, a code-made dirt/rock cover is drawn OVER it, and each of the 10
// dig steps erases part of the cover along a brush stroke (soft edge, cracked by noise, with a lit rim). Pure canvas, no image tools.
import { IMAGES } from '../data/fossilImages.js';
import { CONFIG } from '../core/config.js';
import { FOSSILS } from '../core/fossils.js';
import { renderVectorSlab, VECTOR_COVER, vectorReveal } from './vectorslab.js';

const files = { ...import.meta.glob('../../art-standins/fossils/*.{webp,jpg,png}', { eager: true, query: '?url', import: 'default' }), ...import.meta.glob('../../../../art/fossils/*.{webp,jpg,png}', { eager: true, query: '?url', import: 'default' }) };
const urlFor = (id) => { let u = null; for (const [p, v] of Object.entries(files)) if (p.endsWith('/' + id + '.webp') || p.endsWith('/' + id + '.jpg') || p.endsWith('/' + id + '.png')) { if (!u || p.includes('/art/fossils/')) u = v; } return u; };

const cache = new Map();
// -> Promise<Slab | null>. A fossil without a picture gets a code-drawn slab in the same style (render/vectorslab.js);
// null only for an unknown id or when the picture cannot be read.
export function loadSlab(id) {
  if (cache.has(id)) return cache.get(id);
  const meta = IMAGES[id], url = meta && urlFor(id), f = FOSSILS.find((q) => q.id === id);
  const p = !url ? Promise.resolve(f ? createSlab(renderVectorSlab(f), { cover: VECTOR_COVER, reveal: vectorReveal(f), vector: true }) : null) : new Promise((res) => { const im = new Image(); im.onload = () => res(createSlab(im, meta)); im.onerror = () => res(null); im.src = url; });
  cache.set(id, p); return p;
}
export const hasSlab = (id) => !!urlFor(id) && !!IMAGES[id];

const PARTS = () => CONFIG.fossils.parts;
function defaultReveal(cover) {   // serpentine sweep over the cover's bounding box
  const xs = cover.map((p) => p[0]), ys = cover.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), n = PARTS();
  return Array.from({ length: n }, (_, i) => { const row = Math.floor(i / 2), left = row % 2 === 0 ? i % 2 === 0 : i % 2 === 1, y = y0 + (y1 - y0) * ((row + 0.5) / Math.ceil(n / 2)); const a = left ? x0 : (x0 + x1) / 2, b = left ? (x0 + x1) / 2 : x1; return [[a + 0.05, y, 0.12], [(a + b) / 2, y, 0.13], [b - 0.05, y, 0.12]]; });
}
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

const NOISE = new Map();
export function createSlab(img, meta) {
  const AR = img.height / img.width, WW = 360, WH = Math.round(WW * AR);
  const cover = meta.cover || [[.08, .1], [.92, .1], [.92, .8], [.08, .8]], reveal = meta.reveal || defaultReveal(cover);
  // average colour of the slab face = the colour of the dirt, so the cover sits in the picture
  const s = document.createElement('canvas'); s.width = 12; s.height = 12 * AR | 0 || 12; const sc = s.getContext('2d'); sc.drawImage(img, 0, 0, s.width, s.height);
  let ar = 0, ag = 0, ab = 0, an = 0; const sd = sc.getImageData(0, 0, s.width, s.height).data;
  for (let y = Math.floor(s.height * 0.25); y < s.height * 0.7; y++) for (let x = 2; x < s.width - 2; x++) { const i = (y * s.width + x) * 4; ar += sd[i]; ag += sd[i + 1]; ab += sd[i + 2]; an++; }
  const base = [ar / an, ag / an, ab / an].map((v) => v | 0);
  // ---- the cover texture (built once): rock colour, soft blotches, strata, grit, pebbles, darker toward its edge
  const tex = document.createElement('canvas'); tex.width = WW; tex.height = WH; const t = tex.getContext('2d');
  const sh = (k) => `rgb(${base.map((v) => Math.max(0, Math.min(255, v * k | 0))).join(',')})`;
  t.fillStyle = sh(0.78); t.fillRect(0, 0, WW, WH);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 260; i++) { const x = rnd() * WW, y = rnd() * WH, r = 14 + rnd() * 46, g = t.createRadialGradient(x, y, 0, x, y, r), k = rnd() > 0.5 ? 1.0 + rnd() * 0.25 : 0.55 + rnd() * 0.2; g.addColorStop(0, sh(k).replace('rgb', 'rgba').replace(')', ',.38)')); g.addColorStop(1, sh(k).replace('rgb', 'rgba').replace(')', ',0)')); t.fillStyle = g; t.fillRect(x - r, y - r, r * 2, r * 2); }
  t.lineCap = 'round';
  for (let i = 0; i < 34; i++) { let x = rnd() * WW, y = rnd() * WH; t.strokeStyle = `rgba(60,34,14,${0.18 + rnd() * 0.22})`; t.lineWidth = 0.8 + rnd() * 1.6; t.beginPath(); t.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (rnd() - 0.35) * 26; y += (rnd() - 0.5) * 16; t.lineTo(x, y); } t.stroke(); }
  for (let i = 0; i < 70; i++) { const x = rnd() * WW, y = rnd() * WH, r = 2 + rnd() * 6; t.fillStyle = sh(0.5 + rnd() * 0.3); t.beginPath(); t.ellipse(x, y, r, r * 0.7, rnd() * 3, 0, 6.283); t.fill(); t.fillStyle = sh(1.25); t.beginPath(); t.ellipse(x - r * 0.25, y - r * 0.3, r * 0.5, r * 0.3, 0, 0, 6.283); t.fill(); }
  const gd = t.getImageData(0, 0, WW, WH), d = gd.data;
  for (let i = 0; i < d.length; i += 4) { const n = (hash(i >> 2, 9) - 0.5) * 26; d[i] += n; d[i + 1] += n * 0.9; d[i + 2] += n * 0.7; }
  // alpha = the cover outline, feathered a few px
  const poly = document.createElement('canvas'); poly.width = WW; poly.height = WH; const pc = poly.getContext('2d');
  pc.filter = 'blur(2px)'; pc.fillStyle = '#fff'; pc.beginPath(); cover.forEach(([x, y], i) => { const [nx, ny] = cover[(i + 1) % cover.length], mx = (x + nx) / 2 * WW, my = (y + ny) / 2 * WH; if (!i) pc.moveTo(((x + cover[cover.length - 1][0]) / 2) * WW, ((y + cover[cover.length - 1][1]) / 2) * WH); pc.quadraticCurveTo(x * WW, y * WH, mx, my); }); pc.closePath(); pc.fill();
  const pd = pc.getImageData(0, 0, WW, WH).data, edgeD = new Float32Array(WW * WH);
  for (let i = 0; i < WW * WH; i++) { d[i * 4 + 3] = pd[i * 4 + 3]; }
  const cover0 = gd;
  // crack noise for the erased edge: 3 octaves of value noise
  const nk = WW + 'x' + WH, noise = NOISE.get(nk) || new Float32Array(WW * WH), fresh = !NOISE.has(nk); NOISE.set(nk, noise);
  if (fresh) for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) { let v = 0, a = 0.5, f = 1 / 28; for (let o = 0; o < 3; o++) { const X = x * f, Y = y * f, xi = Math.floor(X), yi = Math.floor(Y), fx = X - xi, fy = Y - yi, u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy); v += a * ((hash(xi, yi + o * 91) * (1 - u) + hash(xi + 1, yi + o * 91) * u) * (1 - w) + (hash(xi, yi + 1 + o * 91) * (1 - u) + hash(xi + 1, yi + 1 + o * 91) * u) * w); a *= 0.5; f *= 2.1; } noise[y * WW + x] = v / 0.875; }
  void edgeD;
  const mask = document.createElement('canvas'); mask.width = WW; mask.height = WH; const mc = mask.getContext('2d', { willReadFrequently: true });
  const out = document.createElement('canvas'); out.width = WW; out.height = WH; const oc = out.getContext('2d');
  const outData = oc.createImageData(WW, WH);
  let key = '';

  // one brush stroke, drawn up to progress p (0..1) along its polyline
  function stroke(pts, p) {
    const seg = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot((pts[i][0] - pts[i - 1][0]) * WW, (pts[i][1] - pts[i - 1][1]) * WH); seg.push(l); tot += l; }
    const upto = tot * p, step = 5; let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0, r0] = pts[i - 1], [x1, y1, r1] = pts[i];
      for (let d2 = 0; d2 <= seg[i - 1]; d2 += step) { if (acc + d2 > upto) return; const k = d2 / seg[i - 1], x = (x0 + (x1 - x0) * k) * WW, y = (y0 + (y1 - y0) * k) * WH, r = (r0 + (r1 - r0) * k) * WW, g = mc.createRadialGradient(x, y, r * 0.35, x, y, r); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); mc.fillStyle = g; mc.fillRect(x - r, y - r, r * 2, r * 2); }
      acc += seg[i - 1];
    }
  }
  const tip = (i, p) => { const pts = reveal[i] || reveal[reveal.length - 1], seg = []; let tot = 0; for (let k = 1; k < pts.length; k++) { const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); seg.push(l); tot += l; } let u = tot * Math.max(0, Math.min(1, p)); for (let k = 1; k < pts.length; k++) { if (u <= seg[k - 1] || k === pts.length - 1) { const f = seg[k - 1] ? Math.min(1, u / seg[k - 1]) : 0; return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f]; } u -= seg[k - 1]; } return pts[0]; };

  // composes the cover for `revealed` finished parts plus one part in progress (anim = { index, t })
  function compose(revealed, anim) {
    const k = revealed + '|' + (anim ? anim.index + ':' + Math.round(anim.t * 40) : '-'); if (k === key) return; key = k;
    mc.clearRect(0, 0, WW, WH);
    for (let i = 0; i < Math.min(revealed, PARTS()); i++) stroke(reveal[i] || reveal[reveal.length - 1], 1);
    if (anim) stroke(reveal[anim.index] || reveal[reveal.length - 1], Math.max(0, Math.min(1, anim.t)));
    const m = mc.getImageData(0, 0, WW, WH).data, c0 = cover0.data, o = outData.data;
    for (let i = 0, n = WW * WH; i < n; i++) {
      const j = i * 4, v = m[j + 3] / 255 + (noise[i] - 0.5) * 0.7, e = v < 0.42 ? 0 : v > 0.55 ? 1 : (v - 0.42) / 0.13, rim = e > 0 && e < 0.55 ? (1 - Math.abs(e - 0.25) / 0.3) : 0;
      o[j] = Math.min(255, c0[j] + rim * 70); o[j + 1] = Math.min(255, c0[j + 1] + rim * 50); o[j + 2] = Math.min(255, c0[j + 2] + rim * 20);
      o[j + 3] = c0[j + 3] * (1 - e);
    }
    oc.putImageData(outData, 0, 0);
  }

  return {
    img, meta, AR, base,
    // Draws into the box (x, y, w, h) 'cover' style (fills the box, crops the overflow). opt: revealed, anim, glow, dim.
    draw(c, x, y, w, h, opt = {}) {
      const r = opt.fit === 'contain' ? this.fit(x, y, w, h) : this.rect(x, y, w, h);
      c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
      c.drawImage(img, r.x, r.y, r.w, r.h);
      const rev = opt.revealed ?? PARTS();
      if (rev < PARTS() || opt.anim) { compose(rev, opt.anim || null); c.drawImage(out, r.x, r.y, r.w, r.h); }
      if (opt.glow > 0) { const g = c.createRadialGradient(r.x + r.w * 0.5, r.y + r.h * 0.4, 0, r.x + r.w * 0.5, r.y + r.h * 0.4, r.w * 0.8); g.addColorStop(0, `rgba(255,214,120,${0.4 * opt.glow})`); g.addColorStop(1, 'rgba(255,214,120,0)'); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(x, y, w, h); }
      if (opt.dim) { c.fillStyle = `rgba(8,10,18,${opt.dim})`; c.fillRect(x, y, w, h); }
      c.restore();
    },
    // where the image lands in the box (cover fit; `focus` 0..1 vertical anchor)
    rect(x, y, w, h, focus = 0.45) { const k = Math.max(w / img.width, h / img.height), iw = img.width * k, ih = img.height * k; return { x: x + (w - iw) / 2, y: y + (h - ih) * focus, w: iw, h: ih }; },
    // whole picture inside the box (never cropped), centred
    fit(x, y, w, h) { const k = Math.min(w / img.width, h / img.height), iw = img.width * k, ih = img.height * k; return { x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih }; },
    // screen position of stroke `part` (progress p along it), for dust and the pickaxe
    point(part, p, x, y, w, h) { const r = this.rect(x, y, w, h), [nx, ny] = tip(part, p); return { x: r.x + nx * r.w, y: r.y + ny * r.h }; },
    centre(part, x, y, w, h) { return this.point(part, 0.5, x, y, w, h); },
    reset() { key = ''; }
  };
}
