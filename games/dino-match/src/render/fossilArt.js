// Draws a fossil from its 10-part recipe (data/shapes.js). This file owns ALL fossil styling: bone colours, outline,
// the dirt that still covers unearthed parts, the reveal shine. Change a number here and every fossil changes.
export const STYLE = {
  bone: ['#F1E7C9', '#C9B88F', '#3A2E20'],          // fill per tone: 0 bone, 1 shade, 2 dark
  boneLight: '#FFF8E2', edge: '#5A472D', edgePx: 2.2,
  dirt: ['#6B4F37', '#563E2B', '#3A2A1D'], dirtEdge: '#2A1D13', dirtLight: 'rgba(214,170,120,.35)',
  stone: ['#3E4452', '#343A47', '#2A2F3A'], stoneEdge: '#1B1F28',   // locked silhouettes in the museum
  shine: 'rgba(255,248,214,.85)'
};

const pathCache = new WeakMap();
function smooth(p, closed) {
  const n = p.length / 2, path = new Path2D();
  if (n < 2) return path;
  if (closed) {
    const mx = (a, b) => [(p[a * 2] + p[b * 2]) / 2, (p[a * 2 + 1] + p[b * 2 + 1]) / 2];
    const s = mx(n - 1, 0); path.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) { const m = mx(i, (i + 1) % n); path.quadraticCurveTo(p[i * 2], p[i * 2 + 1], m[0], m[1]); }
    path.closePath();
  } else {
    path.moveTo(p[0], p[1]);
    for (let i = 1; i < n - 1; i++) path.quadraticCurveTo(p[i * 2], p[i * 2 + 1], (p[i * 2] + p[i * 2 + 2]) / 2, (p[i * 2 + 1] + p[i * 2 + 3]) / 2);
    path.lineTo(p[(n - 1) * 2], p[(n - 1) * 2 + 1]);
  }
  return path;
}
export function pathOf(prim) {
  let p = pathCache.get(prim);
  if (p) return p;
  if (prim.k === 'e') { p = new Path2D(); p.ellipse(prim.p[0], prim.p[1], Math.max(1e-4, prim.p[2]), Math.max(1e-4, prim.p[3]), prim.p[4] || 0, 0, Math.PI * 2); }
  else if (prim.k === 'p') { p = new Path2D(); for (let i = 0; i < prim.p.length; i += 2) (i ? p.lineTo(prim.p[i], prim.p[i + 1]) : p.moveTo(prim.p[0], prim.p[1])); p.closePath(); }
  else p = smooth(prim.p, prim.k === 'b');
  pathCache.set(prim, p);
  return p;
}

const boundsCache = new WeakMap();
export function boundsOf(parts) {
  let b = boundsCache.get(parts);
  if (b) return b;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const add = (x, y, r = 0) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
  for (const part of parts) for (const q of part) {
    if (q.k === 'e') add(q.p[0], q.p[1], Math.max(q.p[2], q.p[3]));
    else for (let i = 0; i < q.p.length; i += 2) add(q.p[i], q.p[i + 1], q.k === 'l' ? q.w / 2 : 0);
  }
  b = { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  boundsCache.set(parts, b);
  return b;
}
export function fitFor(parts, x, y, w, h, margin = 0.06) {
  const b = boundsOf(parts), s = Math.min((w * (1 - margin * 2)) / b.w, (h * (1 - margin * 2)) / b.h);
  return { s, ox: x + w / 2 - ((b.x0 + b.x1) / 2) * s, oy: y + h / 2 - ((b.y0 + b.y1) / 2) * s };
}
// centre of part i in canvas pixels (swing target, particles)
export function partCentre(parts, i, x, y, w, h) {
  const f = fitFor(parts, x, y, w, h), q = parts[i]; let sx = 0, sy = 0, n = 0;
  for (const pr of q) { if (pr.k === 'e') { sx += pr.p[0]; sy += pr.p[1]; n++; } else for (let k = 0; k < pr.p.length; k += 2) { sx += pr.p[k]; sy += pr.p[k + 1]; n++; } }
  return { x: f.ox + (sx / n) * f.s, y: f.oy + (sy / n) * f.s };
}

// the dirt that still covers a part: a small code-drawn texture (earth, grit, a few pebbles), tiled, built once
let dirtTex = null;
function dirtFill(c, tone, s) {
  if (typeof document === 'undefined') return STYLE.dirt[tone];
  if (!dirtTex) {
    dirtTex = document.createElement('canvas'); dirtTex.width = dirtTex.height = 64;
    const g = dirtTex.getContext('2d'); let r = 12345; const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
    g.fillStyle = '#6B4F37'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 160; i++) { const a = rnd(); g.fillStyle = a < 0.45 ? 'rgba(40,26,16,.35)' : a < 0.8 ? 'rgba(150,112,76,.28)' : 'rgba(210,180,140,.2)'; g.fillRect(rnd() * 64, rnd() * 64, 1 + rnd() * 3, 1 + rnd() * 2.5); }
    for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(30,20,12,.4)'; g.beginPath(); g.ellipse(rnd() * 64, rnd() * 64, 2 + rnd() * 3, 1.5 + rnd() * 2, rnd() * 3, 0, 7); g.fill(); }
  }
  const pat = c.createPattern(dirtTex, 'repeat');
  pat.setTransform(new DOMMatrix().scale(1.1 / s));
  return pat;
}

// one primitive in a given look: 'bone' | 'dirt' | 'stone'
function paintPrim(c, q, look, s, alpha = 1) {
  const path = pathOf(q), px = 1 / s;
  const col = look === 'bone' ? STYLE.bone[q.t] : look === 'dirt' ? STYLE.dirt[q.t] : STYLE.stone[q.t];
  const edge = look === 'bone' ? STYLE.edge : look === 'dirt' ? STYLE.dirtEdge : STYLE.stoneEdge;
  c.globalAlpha = alpha; c.lineJoin = 'round'; c.lineCap = 'round';
  if (q.k === 'l') {
    const w = Math.max(q.w, 1.6 * px);
    c.strokeStyle = edge; c.lineWidth = w + STYLE.edgePx * 2 * px; c.stroke(path);
    c.strokeStyle = look === 'dirt' ? dirtFill(c, q.t, s) : col; c.lineWidth = w; c.stroke(path);
  } else {
    c.fillStyle = look === 'dirt' ? dirtFill(c, q.t, s) : col; c.fill(path);
    if (look === 'dirt' && q.t === 1) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fill(path); }
    if (look === 'bone') {   // soft top-left light so the bone reads as rounded
      c.save(); c.clip(path); c.strokeStyle = STYLE.boneLight; c.globalAlpha = alpha * 0.55; c.lineWidth = 5 * px; c.translate(1.6 * px, 1.8 * px); c.stroke(path); c.restore();
    } else if (look === 'dirt') {
      c.save(); c.clip(path); c.strokeStyle = STYLE.dirtLight; c.lineWidth = 4 * px; c.translate(1.4 * px, 1.6 * px); c.stroke(path); c.restore();
    }
    c.globalAlpha = alpha; c.strokeStyle = edge; c.lineWidth = STYLE.edgePx * px; c.stroke(path);
  }
  c.globalAlpha = 1;
}

// opt: { revealed: parts shown as bone (0..10), anim: { index, t } (part being unearthed, t 0..1), look: 'dig' | 'bone' | 'stone',
//        glow: 0..1, shineT: 0..1 sweep over the whole fossil (cutscene), visible: parts drawn at all (cutscene assembling) }
export function drawFossilArt(c, parts, x, y, w, h, opt = {}) {
  const { revealed = 0, anim = null, look = 'dig', glow = 0, shineT = -1, visible = 10 } = opt;
  const f = fitFor(parts, x, y, w, h, opt.margin ?? 0.06);
  c.save();
  c.translate(f.ox, f.oy); c.scale(f.s, f.s);
  if (glow > 0) { c.shadowColor = '#FFE9A8'; c.shadowBlur = 26 * glow; }
  for (let i = 0; i < parts.length && i < visible; i++) {
    const part = parts[i], isAnim = anim && anim.index === i;
    let lk = look === 'bone' ? 'bone' : look === 'stone' ? 'stone' : i < revealed ? 'bone' : 'dirt';
    if (isAnim) {
      const t = Math.max(0, Math.min(1, anim.t)), k = 1 - Math.pow(1 - t, 3);
      const jx = (1 - t) * 0.004 * Math.sin(t * 60), jy = (1 - t) * 0.003 * Math.cos(t * 50);
      c.save(); c.translate(jx, jy);
      for (const q of part) paintPrim(c, q, 'bone', f.s, 1);
      for (const q of part) paintPrim(c, q, 'dirt', f.s, 1 - k);
      c.restore();
      if (t > 0.15) shine(c, part, (t - 0.15) / 0.85, f.s);
    } else for (const q of part) paintPrim(c, q, lk, f.s, 1);
  }
  c.shadowBlur = 0;
  if (shineT >= 0) for (let i = 0; i < Math.min(parts.length, visible); i++) shine(c, parts[i], shineT, f.s, 0.6);
  c.restore();
}

function shine(c, part, t, s, a = 1) {
  const b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 }, whole = new Path2D();
  for (const q of part) {
    if (q.k === 'l') continue;
    whole.addPath(pathOf(q));
    if (q.k === 'e') { b.x0 = Math.min(b.x0, q.p[0] - q.p[2]); b.x1 = Math.max(b.x1, q.p[0] + q.p[2]); }
    else for (let i = 0; i < q.p.length; i += 2) { b.x0 = Math.min(b.x0, q.p[i]); b.x1 = Math.max(b.x1, q.p[i]); }
  }
  if (b.x0 > b.x1) return;
  c.save(); c.clip(whole);
  const x = b.x0 - 0.1 + t * (b.x1 - b.x0 + 0.2), g = c.createLinearGradient(x - 0.08, 0, x + 0.08, 0);
  g.addColorStop(0, 'rgba(255,248,214,0)'); g.addColorStop(0.5, STYLE.shine); g.addColorStop(1, 'rgba(255,248,214,0)');
  c.globalAlpha = a * Math.sin(Math.min(1, t) * Math.PI); c.fillStyle = g; c.fillRect(-2, -2, 4, 4); c.restore();
}
