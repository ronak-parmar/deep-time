// Parametric body plans. Each returns exactly 10 parts (arrays of primitives) in REVEAL ORDER: body first, the head
// (the payoff) near the end. A species recipe in roster.js is one call here with a few numbers, so adding a fossil
// is one data line; changing how all quadrupeds look is one edit in this file.
import { B, P, L, E, G, ell, curve, tube, place, local, HEADS, mirrorX } from './shapes.js';

const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

// ---- features: two parts each (placed as parts 8 and 9). g = geometry of the animal -------------
export const FEAT = {
  none: (g) => [[L([-g.bl * 0.4, g.bodyY - g.bh * 0.5, 0, g.bodyY - g.bh * 0.7, g.bl * 0.4, g.bodyY - g.bh * 0.5], 0.012, 1)], [L([-g.bl * 0.3, g.bodyY + g.bh * 0.1, 0, g.bodyY + g.bh * 0.25, g.bl * 0.3, g.bodyY + g.bh * 0.1], 0.012, 1)]],
  // triceratops: frill + three horns
  frill: (g, o = {}) => [
    [B(ell(g.hx - g.hl * 0.1, g.hy - g.hh * 0.5, g.hl * 0.55, g.hh * (o.big || 1.5), 14, -0.35)), ...[0.6, 0.35, 0.1, -0.15, -0.4].map((a) => E(g.hx - g.hl * 0.1 + Math.cos(a) * g.hl * 0.5, g.hy - g.hh * 0.5 - Math.sin(a) * g.hh * 1.3, 0.012, 0.012, 0, 1))],
    [P([...local(0.45, -0.3, g.hx, g.hy, g.hl, g.hh, g.ht), ...local(0.9, -1.9, g.hx, g.hy, g.hl, g.hh, g.ht), ...local(0.65, -0.35, g.hx, g.hy, g.hl, g.hh, g.ht)]),
     P([...local(0.15, -0.3, g.hx, g.hy, g.hl, g.hh, g.ht), ...local(0.3, -2.0, g.hx, g.hy, g.hl, g.hh, g.ht), ...local(0.35, -0.35, g.hx, g.hy, g.hl, g.hh, g.ht)]),
     P([...local(0.88, -0.2, g.hx, g.hy, g.hl, g.hh, g.ht), ...local(1.12, -0.95, g.hx, g.hy, g.hl, g.hh, g.ht), ...local(0.98, -0.05, g.hx, g.hy, g.hl, g.hh, g.ht)])]
  ],
  plates: (g) => {
    const mk = (i) => { const t = i / 6, x = -g.bl * 0.7 + t * g.bl * 1.35, h = 0.07 + Math.sin(t * Math.PI) * 0.13, y = g.bodyY - g.bh * (0.85 - Math.abs(t - 0.5) * 0.3) - 0.01; return P([x - 0.035, y, x, y - h, x + 0.035, y]); };
    return [[mk(0), mk(1), mk(2), mk(3)], [mk(4), mk(5), mk(6), P([-g.bl - g.tail * 0.65, g.bodyY - 0.02, -g.bl - g.tail * 0.82, g.bodyY - 0.14, -g.bl - g.tail * 0.74, g.bodyY]), P([-g.bl - g.tail * 0.85, g.bodyY + 0.02, -g.bl - g.tail * 1.02, g.bodyY - 0.1, -g.bl - g.tail * 0.93, g.bodyY + 0.03])]];
  },
  sail: (g, o = {}) => {
    const n = 9, top = [], base = [];
    for (let i = 0; i <= n; i++) { const t = i / n, x = -g.bl * 0.55 + t * g.bl * 1.15, h = (o.h || 0.3) * Math.sin(Math.PI * (0.08 + t * 0.84)); top.push(x, g.bodyY - g.bh * 0.8 - h); }
    const spines = [];
    for (let i = 1; i < n; i++) spines.push(L([top[i * 2], top[i * 2 + 1], top[i * 2], g.bodyY - g.bh * 0.7], 0.012, 1));
    return [[P([...top, top[n * 2], g.bodyY - g.bh * 0.7, top[0], g.bodyY - g.bh * 0.7], 1)], spines];
  },
  fangs: (g, o = {}) => [[P([...local(0.62, 0.3, g.hx, g.hy, g.hl, g.hh, g.ht), ...local(0.7, 1.35 * (o.len || 1), g.hx, g.hy, g.hl, g.hh, g.ht), ...local(0.78, 0.3, g.hx, g.hy, g.hl, g.hh, g.ht)])], [P([...local(0.82, 0.3, g.hx, g.hy, g.hl, g.hh, g.ht), ...local(0.9, 1.1 * (o.len || 1), g.hx, g.hy, g.hl, g.hh, g.ht), ...local(0.97, 0.25, g.hx, g.hy, g.hl, g.hh, g.ht)])]],
  tusks: (g, o = {}) => {   // long curved tusks and (optional) a trunk
    const a = local(0.8, 0.3, g.hx, g.hy, g.hl, g.hh, g.ht), L1 = o.len || 0.3;
    const trunk = o.trunk ? tube(curve(...local(0.9, 0.0, g.hx, g.hy, g.hl, g.hh, g.ht), a[0] + o.trunk * 0.5, a[1] + o.trunk * 0.9, a[0] + o.trunk * 0.1, a[1] + o.trunk * 1.5, 6), 0.045, 0.02) : E(a[0], a[1], 0.02, 0.02);
    return [[trunk], [tube(curve(a[0] - 0.02, a[1] - 0.02, a[0] + L1 * 0.9, a[1] + L1 * 0.9, a[0] + L1 * 1.2, a[1] - L1 * (o.curl || 0.2), 7), 0.025, 0.004)]];
  },
  antlers: (g) => {
    const b = local(0.25, -0.6, g.hx, g.hy, g.hl, g.hh, g.ht), K = 1.2, tine = (x, y, a, l) => L([x, y, x + Math.cos(a) * l, y + Math.sin(a) * l], 0.016);
    const palm = B([b[0] - 0.02 * K, b[1], b[0] + 0.02 * K, b[1] - 0.22 * K, b[0] - 0.14 * K, b[1] - 0.32 * K, b[0] - 0.3 * K, b[1] - 0.26 * K, b[0] - 0.2 * K, b[1] - 0.15 * K, b[0] - 0.12 * K, b[1] - 0.06 * K]);
    return [[palm], [tine(b[0] - 0.06, b[1] - 0.33, -2.3, 0.12), tine(b[0] - 0.17, b[1] - 0.37, -2.0, 0.14), tine(b[0] - 0.29, b[1] - 0.32, -1.4, 0.12), tine(b[0] - 0.36, b[1] - 0.29, -0.5, 0.12)]];
  },
  horns: (g, o = {}) => {
    const b = local(0.9, -0.3, g.hx, g.hy, g.hl, g.hh, g.ht), c = local(0.55, -0.45, g.hx, g.hy, g.hl, g.hh, g.ht);
    return [[P([b[0] - 0.035, b[1], b[0] + 0.1, b[1] - (o.h || 0.2), b[0] + 0.03, b[1] + 0.02])], [P([c[0] - 0.03, c[1], c[0] + 0.05, c[1] - 0.1, c[0] + 0.02, c[1] + 0.02]), ...(o.fringe ? [L([g.nx, g.bodyY - g.bh * 0.8, 0, g.bodyY - g.bh * 1.0, -g.bl * 0.7, g.bodyY - g.bh * 0.7], 0.02, 1)] : [])]];
  },
  armour: (g) => {
    const bumps = [];
    for (let i = 0; i < 7; i++) { const x = -g.bl * 0.75 + i * g.bl * 0.24; bumps.push(E(x, g.bodyY - g.bh * 0.72, 0.045, 0.04, 0, 1)); }
    const bx = -g.bl - g.tail * 0.9;
    return [bumps, [E(bx, g.bodyY + 0.02, 0.1, 0.075, 0, 1), P([bx + 0.05, g.bodyY - 0.07, bx + 0.07, g.bodyY - 0.15, bx + 0.1, g.bodyY - 0.05]), P([bx + 0.05, g.bodyY + 0.1, bx + 0.07, g.bodyY + 0.17, bx + 0.1, g.bodyY + 0.07])]];
  },
  hump: (g) => [[B(ell(g.nx - 0.04, g.bodyY - g.bh * 1.0, 0.16, 0.12, 10), 1)], [B([g.nx - 0.14, g.hy - 0.02, g.nx - 0.2, g.hy + 0.14, g.nx - 0.28, g.hy + 0.02], 1), L([g.bl * 0.4, g.bodyY - g.bh, 0, g.bodyY - g.bh * 1.15, -g.bl * 0.5, g.bodyY - g.bh * 0.9], 0.02, 1)]],
  claws: (g) => {
    const cl = (x) => P([x - 0.015, G - 0.04, x + 0.06, G - 0.02, x - 0.015, G - 0.0]);
    const hi = g.bodyY - g.bh * 0.4;
    return [[cl(-g.bl * 0.55 + 0.04), cl(-g.bl * 0.55 + 0.11)], [L([g.bl * 0.55, hi + 0.2, g.bl * 0.55 + 0.05, G - 0.06], 0.014, 1), cl(g.bl * 0.55 + 0.03), cl(g.bl * 0.55 + 0.1)]];
  },
  ears: (g) => [[B(ell(g.hx + g.hl * 0.1, g.hy - g.hh * 0.9, 0.04, 0.07, 8, -0.3), 1)], [E(...local(0.4, -0.15, g.hx, g.hy, g.hl, g.hh, g.ht), 0.012, 0.012, 0, 2), L([g.hx + g.hl * 0.9, g.hy + g.hh * 0.1, g.hx + g.hl * 1.0, g.hy + g.hh * 0.05], 0.01, 2)]],
  finTail: (g) => [[P([-g.bl - g.tail * 0.9, g.bodyY - 0.06, -g.bl - g.tail * 1.12, g.bodyY - 0.2, -g.bl - g.tail * 1.12, g.bodyY + 0.14, -g.bl - g.tail * 0.9, g.bodyY + 0.04], 1)], [L([-g.bl * 0.5, g.bodyY - g.bh * 0.9, -g.bl * 0.2, g.bodyY - g.bh * 1.15, g.bl * 0.1, g.bodyY - g.bh * 0.9], 0.018, 1)]]
};

// ---- quadruped: sauropods, ceratopsians, mammals, early tetrapods ---------------------------
export function quad(o = {}) {
  const d = { bl: 0.4, bh: 0.15, legH: 0.24, hindExtra: 0, legW: 0.045, toe: 0.04, neckLen: 0.2, neckRise: 0.08, neckW: 0.075, neckW1: 0.05, head: 'wedge', hl: 0.2, hh: 0.1, ht: 0.1, tail: 0.4, tailW: 0.06, tailLift: 0, sprawl: false, tilt: 0, feat: 'none', fo: {}, ...o };
  const bodyY = G - d.legH - d.bh * 0.55 - d.hindExtra * 0.5, hipY = bodyY + d.bh * 0.35;
  const hx0 = -d.bl * 0.55, fx0 = d.bl * 0.55;
  const leg = (x, tone, hind) => {
    const lh = d.legH + (hind ? d.hindExtra : 0), top = hipY - (hind ? d.hindExtra * 0.2 : 0);
    if (d.sprawl) return [tube([x, bodyY + d.bh * 0.3, x + 0.07, G - 0.07, x + 0.13, G - 0.015], d.legW, d.legW * 0.7, tone), E(x + 0.15, G - 0.012, d.toe + 0.015, 0.02, 0, tone)];
    return [tube([x, top, x + 0.012, (top + G) / 2, x, G - 0.02], d.legW, d.legW * 0.7, tone), E(x + d.toe * 0.55, G - 0.012, d.toe + d.legW * 0.5, 0.022, 0, tone)];
  };
  const tail = tube(curve(-d.bl * 0.85, bodyY - d.bh * 0.05, -d.bl - d.tail * 0.5, bodyY + 0.01 - d.tailLift * 0.5, -d.bl - d.tail, bodyY + 0.05 - d.tailLift), d.tailW, 0.008);
  const nx0 = d.bl * 0.72, ny0 = bodyY - d.bh * 0.25, nx = nx0 + d.neckLen, ny = ny0 - d.neckRise;
  const neck = tube(curve(nx0, ny0, nx0 + d.neckLen * 0.35, ny0 - d.neckRise * 1.0, nx, ny), d.neckW, d.neckW1);
  const hy = ny + 0.005, hx = nx - 0.01;
  const g = { ...d, bodyY, hx, hy, nx, ny };
  const eye = local(0.36, -0.12, hx, hy, d.hl, d.hh, d.ht);
  const headParts = [B(place(HEADS[d.head], hx, hy, d.hl, d.hh, d.ht)), E(eye[0], eye[1], Math.max(0.01, d.hh * 0.09), Math.max(0.01, d.hh * 0.09), 0, 2)];
  const [fa, fb] = FEAT[d.feat](g, d.fo);
  const body = B(ell(0, bodyY, d.bl, d.bh, 14, d.tilt));
  const ribs = Array.from({ length: 5 }, (_, i) => { const x = -d.bl * 0.45 + i * d.bl * 0.22; return L([x, bodyY - d.bh * 0.55, x + 0.025, bodyY, x, bodyY + d.bh * 0.55], 0.01, 1); });
  return [[body, ...ribs], leg(hx0 + 0.11, 1, true), leg(fx0 + 0.11, 1, false), leg(hx0, 0, true), leg(fx0, 0, false), [tail], [neck], headParts, fa, fb].map((p) => p.flat());
}

// ---- bipedal dinosaurs (theropods, ornithopods, prosauropods) ----------------------------------
export function biped(o = {}) {
  const d = { bl: 0.3, bh: 0.13, legL: 0.32, thigh: 0.085, tail: 0.5, tailW: 0.065, neckLen: 0.12, neckRise: 0.1, neckW: 0.06, head: 'box', hl: 0.26, hh: 0.14, ht: 0.12, arm: 0.1, armW: 0.02, tilt: -0.06, feat: 'none', fo: {}, teeth: 7, sickle: false, ...o };
  const hipY = G - d.legL * 0.95, bodyY = hipY - d.bh * 0.35, bx = 0.04;
  const leg = (dx, tone) => [tube([bx + dx, hipY, bx + dx + 0.1, hipY + d.legL * 0.38, bx + dx - 0.01, hipY + d.legL * 0.7, bx + dx + 0.01, G - 0.025], d.thigh, d.thigh * 0.3, tone), E(bx + dx + 0.07, G - 0.014, 0.085, 0.022, 0, tone), ...(d.sickle ? [P([bx + dx + 0.1, G - 0.03, bx + dx + 0.19, G - 0.1, bx + dx + 0.14, G - 0.03], 1)] : [])];
  const tail = tube(curve(bx - d.bl * 0.7, bodyY, bx - d.bl - d.tail * 0.5, bodyY - 0.02, bx - d.bl - d.tail, bodyY + 0.04), d.tailW, 0.007);
  const body = B(ell(bx, bodyY, d.bl, d.bh, 14, d.tilt));
  const nx0 = bx + d.bl * 0.85, ny0 = bodyY - d.bh * 0.35, nx = nx0 + d.neckLen, ny = ny0 - d.neckRise;
  const neck = tube(curve(nx0, ny0, nx0 + d.neckLen * 0.2, ny0 - d.neckRise * 0.9, nx, ny), d.neckW, d.neckW * 0.7);
  const hx = nx - 0.01, hy = ny, g = { ...d, bodyY, hx, hy, nx, ny, bl: d.bl };
  const arm = [tube([bx + d.bl * 0.7, bodyY + d.bh * 0.35, bx + d.bl * 0.7 + d.arm * 0.7, bodyY + d.bh * 0.9, bx + d.bl * 0.7 + d.arm, bodyY + d.bh * 1.1 + d.arm * 0.3], d.armW * 1.4, d.armW * 0.7), P([bx + d.bl * 0.7 + d.arm, bodyY + d.bh * 1.1 + d.arm * 0.3, bx + d.bl * 0.7 + d.arm + 0.045, bodyY + d.bh * 1.25 + d.arm * 0.3, bx + d.bl * 0.7 + d.arm - 0.01, bodyY + d.bh * 1.3 + d.arm * 0.3])];
  const eye = local(0.36, -0.15, hx, hy, d.hl, d.hh, d.ht);
  const skull = [B(place(HEADS[d.head], hx, hy, d.hl, d.hh, d.ht)), E(eye[0], eye[1], Math.max(0.011, d.hh * 0.09), Math.max(0.011, d.hh * 0.09), 0, 2)];
  const jaw = [B([...local(0.1, 0.35, hx, hy, d.hl, d.hh, d.ht), ...local(0.95, 0.2, hx, hy, d.hl, d.hh, d.ht), ...local(0.9, 0.5, hx, hy, d.hl, d.hh, d.ht), ...local(0.35, 0.7, hx, hy, d.hl, d.hh, d.ht)], 1)];
  for (let i = 0; i < d.teeth; i++) { const t = 0.5 + (i / Math.max(1, d.teeth - 1)) * 0.46, a = local(t - 0.025, 0.3, hx, hy, d.hl, d.hh, d.ht), b = local(t, 0.62, hx, hy, d.hl, d.hh, d.ht), c = local(t + 0.025, 0.3, hx, hy, d.hl, d.hh, d.ht); jaw.push(P([...a, ...b, ...c])); }
  const [fa, fb] = FEAT[d.feat](g, d.fo);
  const ribs = Array.from({ length: 4 }, (_, i) => { const x = bx - d.bl * 0.35 + i * d.bl * 0.24; return L([x, bodyY - d.bh * 0.5, x + 0.02, bodyY, x, bodyY + d.bh * 0.5], 0.01, 1); });
  return [[tail], leg(0.12, 1), [body, ...ribs], leg(0, 0), arm, [neck], skull, jaw, fa, fb].map((p) => p.flat());
}

// ---- hand-built bodies --------------------------------------------------------------------------
export function trilobite(o = {}) {
  const n = o.segs || 6, parts = [];
  parts.push([B(ell(-0.66, 0, 0.19, 0.21, 12))]);
  const seg = [];
  for (let i = 0; i < n; i++) { const x = -0.5 + (i * 0.92) / n, k = 1 - Math.abs(i - n / 2) * 0.03; seg.push([B(ell(x, 0, 0.09, 0.27 * k, 10)), L([x, -0.18, x + 0.02, 0, x, 0.18], 0.012, 1)]); }
  parts.push(...seg.slice(0, 5).map((s) => s));
  parts.push([...(seg[5] || [])]);
  parts.push([B(ell(0.55, 0, 0.29, 0.31, 14), 0), L([0.34, -0.2, 0.5, -0.04, 0.34, 0.2], 0.014, 1)]);
  parts.push([E(0.52, -0.14, 0.04, 0.06, 0.3, 2), E(0.52, 0.14, 0.04, 0.06, -0.3, 2)]);
  while (parts.length < 9) parts.splice(1, 0, [L([-0.5, 0, 0.5, 0], 0.03, 1)]);
  parts.length = 9;
  parts.push([L([-0.74, 0, -0.2, 0, 0.3, 0], 0.03, 1), L([0.82, -0.1, 0.98, -0.2], 0.012), L([0.82, 0.1, 0.98, 0.2], 0.012)]);
  return parts.map((p) => p.flat());
}
export function lobed(o = {}) {   // anomalocaris, opabinia: a swimmer with lobes along the sides
  const d = { len: 0.55, h: 0.12, lobes: 6, fan: 3, eyes: 2, front: 'arms', ...o };
  const body = [B(ell(0, 0, d.len, d.h, 16))];
  const lobe = (i, up) => { const x = -d.len * 0.7 + (i / (d.lobes - 1)) * d.len * 1.3; return E(x, up ? -d.h * 1.0 : d.h * 1.05, 0.075, 0.045, up ? -0.5 : 0.5, up ? 0 : 1); };
  const far = [], near = [];
  for (let i = 0; i < d.lobes; i++) { far.push(lobe(i, true)); near.push(lobe(i, false)); }
  const fan = []; for (let i = 0; i < d.fan; i++) { const a = (i - (d.fan - 1) / 2) * 0.35; fan.push(P([-d.len + 0.04, 0, -d.len - 0.22, Math.sin(a) * 0.22 - 0.02, -d.len - 0.2, Math.sin(a) * 0.22 + 0.04], i % 2 ? 1 : 0)); }
  const head = [B(ell(d.len * 0.95, 0, 0.12, d.h * 0.9, 10))];
  const eyes = []; for (let i = 0; i < d.eyes; i++) eyes.push(E(d.len * (0.72 + i * 0.12), -d.h * 1.15 - i * 0.01, 0.035, 0.035, 0, 2));
  const mouth = [E(d.len * 1.02, d.h * 0.45, 0.06, 0.04, 0, 2), L([d.len * 0.95, d.h * 0.45, d.len * 1.1, d.h * 0.45], 0.01, 1)];
  const arm = (s, t) => d.front === 'arms'
    ? [tube(curve(d.len * 1.05, s * 0.05, d.len * 1.3, -0.05 * s - 0.05, d.len * 1.42, 0.12 * s + 0.05), 0.04, 0.012, t), L([d.len * 1.42, 0.12 * s + 0.05, d.len * 1.36, 0.2 * s + 0.07], 0.016, t), L([d.len * 1.3, 0.0, d.len * 1.26, 0.07], 0.014, t)]
    : [tube(curve(d.len * 1.05, 0.0, d.len * 1.4, 0.06, d.len * 1.5, 0.22), 0.03, 0.02, t), P([d.len * 1.5, 0.22, d.len * 1.62, 0.3, d.len * 1.46, 0.28, d.len * 1.4, 0.34, d.len * 1.42, 0.24], t)];
  return [body, far, near, fan, head, eyes, mouth, arm(1, 1), arm(-1, 0), [L([-d.len * 0.7, 0, 0, 0, d.len * 0.7, 0], 0.02, 1)]].map((p) => p.flat());
}
export function segmented(o = {}) {   // arthropleura: a long millipede-like body of segments with legs
  const n = 7, parts = [];
  const segAt = (i) => { const x = -0.8 + i * 0.2; return [B(ell(x, 0.02, 0.11, 0.17 - Math.abs(i - 3) * 0.004, 10)), L([x - 0.03, 0.16, x - 0.06, 0.3], 0.018, 1), L([x + 0.03, 0.17, x + 0.06, 0.3], 0.018, 1), L([x, -0.12, x, 0.12], 0.01, 1)]; };
  for (let i = 0; i < n; i++) parts.push(segAt(i));
  parts.push([B(ell(0.72, 0.02, 0.13, 0.15, 10)), E(0.78, -0.03, 0.025, 0.025, 0, 2)]);
  parts.push([L([0.8, -0.1, 0.92, -0.3, 0.98, -0.34], 0.012), L([0.82, 0.0, 0.98, -0.14], 0.012)]);
  parts.push([L([-0.88, 0.1, -0.96, 0.2], 0.012, 1), L([-0.88, 0.0, -0.98, 0.06], 0.012, 1)]);
  return parts.map((p) => p.flat());
}
export function dragonfly(o = {}) {
  const wing = (x, y, r, t) => [B(ell(x, y, 0.24, 0.05, 12, r), t), L([x - Math.cos(r) * 0.2, y - Math.sin(r) * 0.2, x + Math.cos(r) * 0.2, y + Math.sin(r) * 0.2], 0.008, 1)];
  const parts = [
    [B(ell(-0.1, 0, 0.42, 0.045, 12)), ...Array.from({ length: 7 }, (_, i) => L([-0.4 + i * 0.1, -0.04, -0.4 + i * 0.1, 0.04], 0.01, 1))],
    wing(0.1, -0.17, 0.55, 1), wing(0.1, 0.17, -0.55, 1),
    wing(-0.08, -0.17, 0.35, 0), wing(-0.08, 0.17, -0.35, 0),
    [B(ell(0.3, 0, 0.1, 0.06, 10))],
    [B(ell(0.4, -0.02, 0.075, 0.075, 10), 1), E(0.42, -0.05, 0.03, 0.03, 0, 2), L([0.4, 0.04, 0.5, 0.05], 0.01, 2)],
    [L([0.28, 0.04, 0.34, 0.14, 0.3, 0.18], 0.012, 1), L([0.22, 0.04, 0.2, 0.14, 0.14, 0.18], 0.012, 1)],
    [L([0.12, 0.04, 0.1, 0.14, 0.04, 0.18], 0.012, 1), L([0.04, 0.04, 0.0, 0.12, -0.06, 0.16], 0.012, 1)],
    [L([-0.52, -0.01, -0.62, 0.0], 0.012, 1), L([0.46, -0.07, 0.56, -0.14], 0.008, 1), L([0.46, -0.03, 0.58, -0.08], 0.008, 1)]
  ];
  return parts.map((p) => p.flat());
}
export function fish(o = {}) {   // armoured fish (Dunkleosteus) or shark (Helicoprion, with its tooth whorl)
  const d = { len: 0.8, h: 0.2, armour: true, whorl: false, ...o };
  const body = tube(curve(-0.55, 0.0, -0.1, 0.02, d.len * 0.3, 0), d.h * 0.8, d.h);
  const tailTube = tube(curve(-0.55, 0.0, -0.75, -0.02, -0.88, 0.0, 5), d.h * 0.55, 0.025);
  const tailFin = P([-0.86, 0, -1.05, -0.28, -0.98, 0, -1.05, 0.28], 1);
  const dorsal = P([-0.3, -d.h * 0.85, -0.12, -d.h * 1.9, 0.02, -d.h * 0.95], 1);
  const pelvic = P([-0.1, d.h * 0.8, -0.2, d.h * 1.5, 0.0, d.h * 0.9], 1);
  const pectoral = P([0.2, d.h * 0.5, 0.05, d.h * 1.4, 0.34, d.h * 0.7], 1);
  const head = B(ell(0.5, 0, 0.3, d.h * 1.0, 14));
  const eye = E(0.6, -d.h * 0.25, 0.04, 0.04, 0, 2);
  const jaw = [B([0.42, d.h * 0.35, 0.78, d.h * 0.25, 0.8, d.h * 0.62, 0.55, d.h * 0.85], 1)];
  for (let i = 0; i < 5; i++) jaw.push(P([0.5 + i * 0.06, d.h * 0.3, 0.52 + i * 0.06, d.h * 0.5, 0.54 + i * 0.06, d.h * 0.3]));
  const extra = d.whorl
    ? [L(Array.from({ length: 26 }, (_, i) => { const a = i * 0.42, r = 0.02 + i * 0.0075; return [0.55 + Math.cos(a) * r, d.h * 0.85 + Math.sin(a) * r]; }).flat(), 0.022, 1), ...Array.from({ length: 8 }, (_, i) => { const a = i * 1.05, r = 0.03 + i * 0.022; return L([0.55 + Math.cos(a) * r, d.h * 0.85 + Math.sin(a) * r, 0.55 + Math.cos(a) * (r + 0.045), d.h * 0.85 + Math.sin(a) * (r + 0.045)], 0.018, 2); })]
    : [B(ell(0.2, 0, 0.2, d.h * 0.9, 10), 1), L([0.04, -d.h * 0.5, 0.1, 0.0, 0.04, d.h * 0.5], 0.012, 2), L([0.2, -d.h * 0.6, 0.26, 0.0, 0.2, d.h * 0.6], 0.012, 2)];
  return [[body], [tailTube, tailFin], [dorsal], [pelvic, pectoral], extra, [head], [eye], jaw, [P([0.7, d.h * 0.18, 0.84, d.h * 0.08, 0.84, d.h * 0.3, 0.72, d.h * 0.34], 2)], [L([0.4, -d.h * 0.9, 0.5, -d.h * 0.4, 0.6, d.h * 0.1], 0.012, 1)]].map((p) => p.flat());
}
export function ichthyo(o = {}) {   // marine reptile with a fish-shaped body (Shonisaurus)
  const body = tube(curve(-0.6, 0.02, -0.1, -0.02, 0.4, 0.02), 0.07, 0.17);
  const head = tube(curve(0.36, 0.0, 0.7, 0.0, 0.98, 0.02), 0.14, 0.02);
  return [
    [body], [tube(curve(-0.55, 0.02, -0.8, 0.03, -0.88, 0.04, 5), 0.05, 0.015)],
    [P([-0.84, 0.04, -0.98, -0.2, -0.92, 0.04, -0.98, 0.26], 1)], [P([-0.15, -0.13, -0.05, -0.3, 0.1, -0.15], 1)],
    [P([0.18, 0.12, 0.04, 0.34, 0.3, 0.2], 1)], [P([-0.2, 0.14, -0.34, 0.3, -0.08, 0.17], 1)],
    [head], [E(0.54, -0.04, 0.022, 0.022, 0, 2)], [L([0.5, 0.06, 0.8, 0.08, 0.97, 0.05], 0.01, 1)],
    [L([0.1, 0.02, 0.0, 0.0, -0.3, 0.0], 0.01, 1), L([0.2, -0.06, 0.1, -0.08], 0.01, 1)]
  ].map((p) => p.flat());
}
export function plesio(o = {}) {
  const d = { neck: 1, ...o };
  const body = B(ell(0, 0.02, 0.38, 0.16, 14));
  const neck = tube(curve(0.3, -0.04, 0.62, -0.2, 0.66, -0.4, 8), 0.09, 0.03);
  const flip = (x, y, a, t) => B(ell(x, y, 0.18, 0.05, 10, a), t);
  return [
    [body], [flip(0.22, 0.2, 0.9, 1)], [flip(-0.22, 0.2, 0.9, 1)], [flip(0.32, 0.18, 0.7, 0)], [flip(-0.12, 0.19, 0.7, 0)],
    [tube(curve(-0.34, 0.04, -0.6, 0.1, -0.76, 0.08, 5), 0.07, 0.01)], [neck],
    [B(ell(0.74, -0.42, 0.09, 0.045, 10, 0.15))], [E(0.77, -0.44, 0.014, 0.014, 0, 2), L([0.68, -0.4, 0.82, -0.4], 0.008, 1)],
    [L([-0.2, -0.12, 0.0, -0.15, 0.2, -0.12], 0.012, 1), L([-0.2, 0.0, 0.0, -0.03, 0.2, 0.0], 0.012, 1)]
  ].map((p) => p.flat());
}
export function serpent(o = {}) {   // Basilosaurus: very long whale
  const path = curve(-0.92, 0.12, -0.2, -0.16, 0.6, 0.02, 12);
  const body = tube(path, 0.03, 0.1);
  const mid = tube(curve(-0.5, 0.0, 0.0, -0.1, 0.5, 0.02, 7), 0.06, 0.1);
  return [
    [body], [tube(curve(-0.55, 0.04, -0.2, -0.1, 0.1, -0.06, 6), 0.04, 0.09)],
    [P([-0.93, 0.12, -1.0, -0.02, -0.97, 0.1, -1.0, 0.26], 1)], [B(ell(0.2, 0.12, 0.09, 0.03, 8, 0.8), 1)],
    [mid], [B(ell(-0.05, 0.1, 0.06, 0.025, 8, 0.7), 1)],
    [B([0.5, -0.06, 0.8, -0.04, 0.99, 0.02, 0.8, 0.1, 0.5, 0.14])], [E(0.66, -0.01, 0.015, 0.015, 0, 2)],
    [...Array.from({ length: 6 }, (_, i) => P([0.74 + i * 0.04, 0.07, 0.755 + i * 0.04, 0.12, 0.77 + i * 0.04, 0.07]))],
    [L([-0.8, 0.1, -0.4, -0.12, 0.2, -0.12], 0.012, 1)]
  ].map((p) => p.flat());
}
export function pterosaur(o = {}) {
  const d = { crest: 0.3, beak: 0.5, span: 1, ...o }, S = d.span;
  // a wing: arm out to the wrist, long finger to the tip, scalloped membrane back to the hip. s = +1 down-left, -1 down-right
  const wing = (dx, dy, t) => P([0.02, 0.04, 0.02 + dx * 0.4, dy * 0.45, dx * 0.55, dy * 0.55, dx, dy, dx * 0.82, dy * 0.45 + 0.1, dx * 0.55, 0.16, dx * 0.3, 0.12, 0.02, 0.2], t);
  const bone = (dx, dy) => L([0.02, 0.04, dx * 0.55, dy * 0.55, dx, dy], 0.014, 1);
  return [
    [B(ell(0.0, 0.1, 0.12, 0.07, 10, -0.2))],
    [wing(-0.95 * S, -0.35 * S, 1), bone(-0.95 * S, -0.35 * S)],
    [wing(0.95 * S, -0.3 * S, 0), bone(0.95 * S, -0.3 * S)],
    [L([0.0, 0.16, -0.1, 0.34, -0.04, 0.4], 0.012, 1), L([0.04, 0.16, 0.06, 0.36], 0.012, 1)],
    [tube(curve(0.08, 0.04, 0.16, -0.08, 0.2, -0.16), 0.035, 0.028)],
    [B([0.16, -0.22, 0.34, -0.23, 0.16 + d.beak * 0.6, -0.17, 0.16 + d.beak * 0.6, -0.15, 0.34, -0.12, 0.14, -0.12])],
    [E(0.24, -0.185, 0.012, 0.012, 0, 2)],
    [P([0.16, -0.23, 0.16 - d.crest * 0.6, -0.36, 0.22, -0.2], 1)],
    [L([-0.1, 0.1, -0.4, 0.12, -0.6, 0.2], 0.01, 1)],
    [L([0.05, 0.06, 0.1, 0.12], 0.012, 2)]
  ].map((p) => p.flat());
}
export function bird(o = {}) {   // Archaeopteryx
  const feather = (x, y, a, l) => B(ell(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5, l * 0.5, 0.025, 8, a), 0);
  return [
    [B(ell(0, 0.0, 0.22, 0.12, 12, -0.25))],
    [tube(curve(-0.15, 0.04, -0.5, 0.12, -0.9, 0.18, 7), 0.03, 0.012), ...Array.from({ length: 5 }, (_, i) => feather(-0.4 - i * 0.1, 0.1 + i * 0.015, 0.2 + (i - 2) * 0.05, 0.22))],
    [tube([-0.04, 0.1, -0.02, 0.26, -0.06, 0.4], 0.035, 0.014), E(-0.03, 0.4, 0.06, 0.018, 0, 1)],
    [tube([0.08, 0.1, 0.1, 0.26, 0.07, 0.4], 0.035, 0.014, 1), E(0.1, 0.4, 0.06, 0.018, 0, 1)],
    [...Array.from({ length: 6 }, (_, i) => feather(-0.02, -0.08, -2.0 + i * 0.22, 0.34)), tube(curve(-0.0, -0.08, 0.1, -0.2, 0.2, -0.28), 0.03, 0.012, 1)],
    [...Array.from({ length: 6 }, (_, i) => feather(0.04, -0.08, -2.4 + i * 0.22, 0.3))],
    [tube(curve(0.15, -0.05, 0.3, -0.12, 0.34, -0.22), 0.045, 0.035)],
    [B(ell(0.4, -0.25, 0.1, 0.06, 10, 0.2)), E(0.42, -0.27, 0.012, 0.012, 0, 2)],
    [P([0.46, -0.22, 0.54, -0.2, 0.46, -0.18]), ...[0, 1, 2, 3].map((i) => P([0.44 + i * 0.025, -0.2, 0.455 + i * 0.025, -0.17, 0.47 + i * 0.025, -0.2]))],
    [L([0.1, 0.0, 0.2, 0.0], 0.012, 1), L([0.1, -0.03, 0.18, -0.1], 0.012, 1)]
  ].map((p) => p.flat());
}
export function skull(o = {}) {   // hominin skull, side view
  const d = { brow: 0.05, crest: 0, face: 0.3, jaw: 0.2, dome: 0.3, ...o };
  const cx = -0.12;
  return [
    [B(ell(cx, -0.08, 0.38, 0.3 * (0.8 + d.dome), 16))],
    [B(ell(cx - 0.22, 0.0, 0.18, 0.22, 10), 1)],
    [B([cx + 0.1, 0.05, cx + 0.4, 0.0, cx + 0.38 + d.face, 0.14, cx + 0.34 + d.face, 0.3, cx + 0.12, 0.28])],
    [L([cx + 0.1, -0.12, cx + 0.3 + d.brow, -0.14, cx + 0.42 + d.brow, -0.1], 0.05 + d.brow * 0.5, 1)],
    [E(cx + 0.3, -0.03, 0.065, 0.07, 0, 2)],
    [P([cx + 0.4, 0.05, cx + 0.5 + d.face * 0.3, 0.14, cx + 0.4, 0.18], 1)],
    [B([cx + 0.04, 0.22, cx + 0.3 + d.face * 0.8, 0.26, cx + 0.3 + d.face * 0.8, 0.28 + d.jaw, cx + 0.0, 0.3 + d.jaw * 1.2, cx - 0.14, 0.18], 1)],
    [...Array.from({ length: 6 }, (_, i) => P([cx + 0.18 + i * 0.045, 0.27, cx + 0.2 + i * 0.045, 0.34, cx + 0.22 + i * 0.045, 0.27]))],
    [E(cx - 0.12, 0.04, 0.035, 0.035, 0, 2), ...(d.crest ? [L([cx - 0.3, -0.35, cx, -0.46, cx + 0.2, -0.3], 0.03, 1)] : [])],
    [L([cx + 0.05, -0.3, cx + 0.2, -0.2], 0.012, 1), L([cx - 0.2, -0.3, cx - 0.02, -0.24], 0.012, 1)]
  ].map((p) => p.flat());
}
