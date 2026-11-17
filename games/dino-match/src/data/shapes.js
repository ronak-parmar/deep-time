// Fossil drawing vocabulary. A fossil is 10 PARTS, revealed in order. A part is a list of primitives (so a part can be
// a bone plus its eye, or a leg plus its foot). Everything lives in a unit space: x -1..1 (left to right, the animal
// faces right), y -0.5..0.5 (top to bottom, ground near y = 0.34). The renderer (render/fossilArt.js) scales it into
// any rectangle and owns ALL styling (colours, outline, dirt, shine), so a style change is one edit there.
//
// Primitive = { k, p, t, w? }  k: 'b' smooth closed blob (flat x,y list), 'p' polygon, 'l' smooth stroke (w = width),
//                              'e' ellipse [cx, cy, rx, ry, rot]; t: tone 0 bone, 1 shade, 2 dark (eyes, teeth gaps).
export const B = (p, t = 0) => ({ k: 'b', p, t });
export const P = (p, t = 0) => ({ k: 'p', p, t });
export const L = (p, w = 0.02, t = 0) => ({ k: 'l', p, w, t });
export const E = (cx, cy, rx, ry, rot = 0, t = 0) => ({ k: 'e', p: [cx, cy, rx, ry, rot], t });

export const G = 0.34;   // ground line

// points on an ellipse (flat list)
export function ell(cx, cy, rx, ry, n = 12, rot = 0) {
  const out = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; out.push(cx + x * c - y * s, cy + x * s + y * c); }
  return out;
}
// quadratic bezier path points (flat list), n points
export function curve(x0, y0, cx, cy, x1, y1, n = 6) {
  const out = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1), u = 1 - t; out.push(u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1); }
  return out;
}
// a tapered tube along a centre path (flat list): half-width w0 at the start, w1 at the end
export function tube(path, w0, w1, t = 0) {
  const n = path.length / 2, left = [], right = [];
  let tx0 = 1, ty0 = 0, tx1 = 1, ty1 = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let dx = path[b * 2] - path[a * 2], dy = path[b * 2 + 1] - path[a * 2 + 1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    if (i === 0) { tx0 = dx; ty0 = dy; } if (i === n - 1) { tx1 = dx; ty1 = dy; }
    const w = w0 + (w1 - w0) * (i / (n - 1));
    left.push(path[i * 2] - dy * w, path[i * 2 + 1] + dx * w); right.push(path[i * 2] + dy * w, path[i * 2 + 1] - dx * w);
  }
  // rounded ends: one extra point beyond each end so the blob does not finish in a flat edge
  const out = [path[0] - tx0 * w0 * 0.9, path[1] - ty0 * w0 * 0.9, ...left, path[(n - 1) * 2] + tx1 * w1 * 0.9, path[(n - 1) * 2 + 1] + ty1 * w1 * 0.9];
  for (let i = n - 1; i >= 0; i--) out.push(right[i * 2], right[i * 2 + 1]);
  return B(out, t);
}
// place a head template (unit shape, origin at the neck joint, length 1) at x, y with length hl, height hh, tilt rot
export function place(tpl, x, y, hl, hh, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), out = [];
  for (let i = 0; i < tpl.length; i += 2) { const px = tpl[i] * hl, py = tpl[i + 1] * hh; out.push(x + px * c - py * s, y + px * s + py * c); }
  return out;
}
export const local = (x, y, ox, oy, hl, hh, rot = 0) => { const c = Math.cos(rot), s = Math.sin(rot), px = x * hl, py = y * hh; return [ox + px * c - py * s, oy + px * s + py * c]; };
export const mirrorX = (p) => p.map((v, i) => (i % 2 ? v : -v));
export const shift = (prim, dx, dy) => ({ ...prim, p: prim.p.map((v, i) => (prim.k === 'e' ? (i === 0 ? v + dx : i === 1 ? v + dy : v) : v + (i % 2 ? dy : dx))) });

// head templates, facing right
export const HEADS = {
  wedge: [0, -0.4, 0.5, -0.5, 1, -0.15, 1, 0.15, 0.55, 0.45, 0, 0.5],
  round: [0, -0.5, 0.5, -0.6, 0.95, -0.2, 1, 0.15, 0.6, 0.5, 0, 0.55],
  long:  [0, -0.45, 0.4, -0.42, 1, -0.12, 1, 0.12, 0.4, 0.38, 0, 0.5],
  box:   [0, -0.5, 0.6, -0.5, 1, -0.32, 1, 0.3, 0.6, 0.42, 0, 0.5],
  croc:  [0, -0.3, 0.45, -0.28, 1, -0.2, 1, 0.2, 0.45, 0.3, 0, 0.4],
  beak:  [0, -0.5, 0.55, -0.45, 0.9, -0.2, 1, 0, 0.85, 0.25, 0.5, 0.4, 0, 0.5],
  tiny:  [0, -0.5, 0.5, -0.5, 1, -0.1, 1, 0.2, 0.5, 0.5, 0, 0.5]
};
