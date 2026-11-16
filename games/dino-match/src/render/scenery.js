// Per-era background scenery, drawn from shapes. Each era lists its own elements in eraTheme.js (`scenery`); every
// element type below belongs to exactly one era. Elements are low contrast and sit behind the board.
//   still(c, el, s)       baked once into the scenery canvas
//   live(c, el, s, t)     drawn every frame (t = loop phase in cycles, frozen at 0 under reduced motion)
// Loop speed comes from LOOP.scene in motion.js, so the ambient motion stays slow.
import { rng01, shade, mix, rgba } from './util.js';
import { themeFor } from './eraTheme.js';
import { hashSeed } from '../core/rng.js';
import { eraPalette } from '../ui/tokens.js';
import { LOOP } from './motion.js';

export { shade, mix };
const TAU = Math.PI * 2, W = 360, H = 640;
const wrap = (v) => ((v % 1) + 1) % 1;
const mound = (c, base, amp, f, col, ph = 0) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 10) c.lineTo(x, base + Math.sin(x * f + ph) * amp); c.lineTo(W, H); c.fill(); };
const blob = (c, x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };
const poly = (c, pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill(); };
const spread = (rnd, n, lo = 0, hi = W) => Array.from({ length: n }, (_, i) => lo + ((i + 0.2 + rnd() * 0.6) / n) * (hi - lo));
// Most of the middle of the screen is covered by the board, so tall elements put their first and last item in the
// side margins beside the dirt panel (x about 28 and 332) where they stay visible.
const flank = (arr, hs) => { arr[0].x = 26 + (arr[0].x % 10); arr[arr.length - 1].x = 334 - (arr[arr.length - 1].x % 10); arr[0].h = hs[0]; arr[arr.length - 1].h = hs[1]; return arr; };
const A = (el, k = 1) => rgba(el.color, Math.min(0.9, el.alpha * k));
function glowDot(c, x, y, r, col, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
function sauro(c, x, y, s, col) {
  blob(c, x, y, 22 * s, 11 * s, col);
  c.fillStyle = col; c.beginPath(); c.moveTo(x + 14 * s, y - 6 * s); c.quadraticCurveTo(x + 34 * s, y - 10 * s, x + 30 * s, y - 40 * s); c.lineTo(x + 35 * s, y - 40 * s); c.quadraticCurveTo(x + 40 * s, y - 8 * s, x + 16 * s, y + 2 * s); c.fill();
  c.beginPath(); c.moveTo(x - 18 * s, y); c.quadraticCurveTo(x - 42 * s, y + 8 * s, x - 52 * s, y + 2 * s); c.lineTo(x - 18 * s, y - 6 * s); c.fill();
  for (const l of [-12, -3, 8, 16]) c.fillRect(x + l * s - 2 * s, y + 6 * s, 4 * s, 16 * s);
}
function hand(c, x, y, s, col) {
  blob(c, x, y, 9 * s, 11 * s, col); c.strokeStyle = col; c.lineWidth = 4 * s; c.lineCap = 'round';
  [[-10, -8, -0.35, 17], [-4, -12, -0.12, 21], [3, -12, 0.1, 22], [9, -9, 0.3, 19], [13, 2, 1.0, 14]].forEach(([dx, dy, a, l]) => { c.beginPath(); c.moveTo(x + dx * s * 0.8, y + dy * s); c.lineTo(x + dx * s * 0.8 + Math.sin(a) * l * s, y + dy * s - Math.cos(a) * l * s); c.stroke(); });
}

export const ELEMENTS = {
  // ---- cambrian: seabed, swaying kelp, bubbles, light rays
  seabed: { still(c, el) { mound(c, 592, 10, 0.05, A(el)); const r = rng01(11); for (let i = 0; i < 12; i++) blob(c, r() * W, 612 + r() * 24, 4 + r() * 6, 2 + r() * 2, A(el, 0.8)); } },
  lightRays: { live(c, el, s, t) { for (let i = 0; i < el.count; i++) { const x = 60 + i * 80, a = el.alpha * (0.7 + 0.3 * Math.sin(t * TAU + i * 1.7)); poly(c, [[x, 0], [x + 40, 0], [x + 60, 440], [x - 20, 440]], rgba(el.color, a)); } } },
  kelp: {
    make(el, r) { return flank(spread(r, el.count, 10, 350).map((x) => ({ x, h: 80 + r() * 120, p: r() * TAU })), [470, 430]); },
    live(c, el, s, t) { c.strokeStyle = A(el); c.lineWidth = 4; c.lineCap = 'round'; for (const k of s) { c.beginPath(); c.moveTo(k.x, H); for (let j = 1; j <= 8; j++) c.lineTo(k.x + Math.sin(t * TAU + k.p + j * 0.55) * 9 * (j / 8), H - (k.h * j) / 8); c.stroke(); } }
  },
  bubbles: {
    make(el, r) { return Array.from({ length: el.count }, () => ({ x: r() * W, o: r(), r: 2 + r() * 5, p: r() * TAU })); },
    live(c, el, s, t) { c.strokeStyle = A(el); c.lineWidth = 1.5; for (const b of s) { const y = H - wrap(b.o + t) * 600; c.beginPath(); c.arc(b.x + Math.sin(t * TAU + b.p) * 5, y, b.r, 0, TAU); c.stroke(); } }
  },
  // ---- devonian: swamp, lycopod silhouettes, mist
  swampWater: { still(c, el) { mound(c, 606, 5, 0.04, A(el)); c.strokeStyle = rgba(el.color === '#0A2A22' ? '#7FD4B0' : el.color, 0.12); c.lineWidth = 1.5; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(20 + i * 38, 620 + (i % 3) * 7); c.lineTo(48 + i * 38, 620 + (i % 3) * 7); c.stroke(); } } },
  lycopod: {
    make(el, r) { return flank(spread(r, el.count, 15, 345).map((x) => ({ x, h: 190 + r() * 150, w: 9 + r() * 4 })), [470, 440]); },
    still(c, el, s) {
      for (const t of s) {
        const y0 = 620, y1 = y0 - t.h;
        poly(c, [[t.x - t.w, y0], [t.x - t.w * 0.5, y1], [t.x + t.w * 0.5, y1], [t.x + t.w, y0]], A(el));
        c.strokeStyle = A(el); c.lineCap = 'round'; c.lineWidth = 5;
        for (const d of [-1, 1]) { c.beginPath(); c.moveTo(t.x, y1); c.lineTo(t.x + d * 26, y1 - 28); c.lineTo(t.x + d * 38, y1 - 30); c.moveTo(t.x + d * 26, y1 - 28); c.lineTo(t.x + d * 24, y1 - 50); c.stroke(); for (const [ex, ey] of [[t.x + d * 38, y1 - 30], [t.x + d * 24, y1 - 50]]) for (let k = -2; k <= 2; k++) { c.lineWidth = 1.6; c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex + k * 5, ey - 11); c.stroke(); } c.lineWidth = 5; }
      }
    }
  },
  mist: {
    make(el, r) { return Array.from({ length: el.count }, (_, i) => ({ x: r(), y: 180 + i * 150 + r() * 40, w: 120 + r() * 60 })); },
    live(c, el, s, t) { for (const m of s) { const x = wrap(m.x + t * 0.6) * (W + 2 * m.w) - m.w; blob(c, x, m.y, m.w, 20, A(el)); blob(c, x + 40, m.y + 12, m.w * 0.7, 14, A(el, 0.8)); } }
  },
  // ---- carboniferous: dark forest, giant fern, horsetail, fireflies
  forestFloor: { still(c, el) { mound(c, 598, 8, 0.045, A(el)); mound(c, 622, 5, 0.07, A(el, 1.1), 2); } },
  giantFern: {
    make(el, r) { return flank(spread(r, el.count, 30, 330).map((x) => ({ x, h: 150 + r() * 90 })), [440, 400]); },
    still(c, el, s) {
      for (const t of s) {
        const top = 620 - t.h; c.fillStyle = A(el); c.fillRect(t.x - 4, top, 8, t.h);
        c.strokeStyle = A(el); c.lineWidth = 2.5; c.lineCap = 'round';
        for (let l = 0; l < 9; l++) { const a = -Math.PI / 2 + (l - 4) * 0.42, len = 62; c.beginPath(); c.moveTo(t.x, top); c.quadraticCurveTo(t.x + Math.cos(a) * len * 0.6, top + Math.sin(a) * len * 0.6 - 18, t.x + Math.cos(a) * len, top + Math.sin(a) * len + 16); c.stroke(); }
      }
    }
  },
  horsetail: {
    make(el, r) { return flank(spread(r, el.count, 5, 355).map((x) => ({ x, h: 90 + r() * 120 })), [450, 420]); },
    still(c, el, s) { c.strokeStyle = A(el); c.lineWidth = 3; for (const t of s) { c.beginPath(); c.moveTo(t.x, 625); c.lineTo(t.x, 625 - t.h); c.stroke(); c.lineWidth = 1.4; for (let j = 1; j <= 5; j++) { const y = 625 - (t.h * j) / 5.5, l = 9 - j; c.beginPath(); c.moveTo(t.x - l, y + 5); c.lineTo(t.x, y); c.lineTo(t.x + l, y + 5); c.stroke(); } c.lineWidth = 3; } }
  },
  fireflies: {
    make(el, r) { return Array.from({ length: el.count }, () => ({ x: r() * W, y: 120 + r() * 480, p: r() * TAU, q: r() * TAU })); },
    live(c, el, s, t) { for (const f of s) glowDot(c, f.x + Math.sin(t * TAU + f.p) * 14, f.y + Math.cos(t * TAU + f.q) * 10, 7, el.color, el.alpha * (0.5 + 0.5 * Math.sin(t * TAU * 2 + f.p))); }
  },
  // ---- permian: dunes, mesas, heat shimmer
  sunDisc: { still(c, el) { glowDot(c, 250, 120, 80, el.color, el.alpha); c.fillStyle = rgba(el.color, el.alpha * 0.9); c.beginPath(); c.arc(250, 120, 34, 0, TAU); c.fill(); } },
  mesas: { still(c, el) { for (const m of [[50, 150, 70], [210, 190, 90], [322, 120, 60]]) poly(c, [[m[0] - m[1] / 2, 590], [m[0] - m[1] / 2 + 10, 590 - m[2]], [m[0] + m[1] / 2 - 10, 590 - m[2]], [m[0] + m[1] / 2, 590]], A(el)); } },
  dunes: { still(c, el) { for (let i = 0; i < el.count; i++) mound(c, 575 + i * 22, 14 - i * 2, 0.018 + i * 0.01, rgba(shade(el.color, -0.05 * i), el.alpha + i * 0.1), i * 2); } },
  heatShimmer: { live(c, el, s, t) { c.strokeStyle = A(el); c.lineWidth = 2; for (let i = 0; i < el.count; i++) { c.beginPath(); for (let x = 0; x <= W; x += 12) { const y = 500 + i * 16 + Math.sin(x * 0.06 + t * TAU + i) * 3; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); } } },
  // ---- triassic: ash sky, volcano glow, ash fall
  ashSky: { still(c, el) { const r = rng01(31); for (let i = 0; i < el.count; i++) blob(c, r() * W, 30 + r() * 150, 60 + r() * 50, 16 + r() * 12, A(el)); } },
  volcano: {
    still(c, el) { poly(c, [[160, 640], [240, 520], [300, 520], [360, 640]], A(el)); },
    live(c, el, s, t) { glowDot(c, 270, 518, 70 + 6 * Math.sin(t * TAU), el.glow, 0.3 + 0.08 * Math.sin(t * TAU)); c.strokeStyle = rgba(el.glow, 0.35); c.lineWidth = 2; c.beginPath(); c.moveTo(262, 524); c.lineTo(250, 580); c.moveTo(280, 524); c.lineTo(292, 590); c.stroke(); }
  },
  ridge: { still(c, el) { const r = rng01(37); c.fillStyle = A(el); c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 18) c.lineTo(x, 600 - r() * 22); c.lineTo(W, H); c.fill(); } },
  ashFall: {
    make(el, r) { return Array.from({ length: el.count }, () => ({ x: r() * W, o: r(), r: 1 + r() * 1.8 })); },
    live(c, el, s, t) { c.fillStyle = A(el); for (const f of s) { c.beginPath(); c.arc(f.x + Math.sin(t * TAU + f.o * 9) * 6, wrap(f.o + t) * H, f.r, 0, TAU); c.fill(); } }
  },
  // ---- jurassic: conifers, cycads, distant long-neck
  conifer: {
    make(el, r) { return flank(spread(r, el.count, 10, 350).map((x) => ({ x, h: 110 + r() * 110 })), [430, 380]); },
    still(c, el, s) { for (const t of s) { for (let k = 0; k < 4; k++) { const y = 620 - t.h * (0.2 + k * 0.22), w = 26 - k * 5; poly(c, [[t.x - w, y + 26], [t.x, y - 22], [t.x + w, y + 26]], A(el)); } c.fillStyle = A(el); c.fillRect(t.x - 3, 620 - t.h * 0.25, 6, t.h * 0.25 + 20); } }
  },
  cycad: {
    make(el, r) { return spread(r, el.count, 60, 300).map((x) => ({ x })); },
    still(c, el, s) { c.strokeStyle = A(el); c.lineWidth = 3; c.lineCap = 'round'; for (const t of s) { c.fillStyle = A(el); c.fillRect(t.x - 7, 575, 14, 50); for (let l = 0; l < 11; l++) { const a = -Math.PI + (l / 10) * Math.PI, len = 44; c.beginPath(); c.moveTo(t.x, 575); c.quadraticCurveTo(t.x + Math.cos(a) * len * 0.7, 575 + Math.sin(a) * len * 0.8 - 10, t.x + Math.cos(a) * len, 575 + Math.sin(a) * len * 0.4 + 14); c.stroke(); } } }
  },
  longNeck: { live(c, el, s, t) { c.save(); c.translate(0, Math.sin(t * TAU) * 1.5); sauro(c, 255, 548, 0.9, A(el)); c.restore(); } },
  // ---- cretaceous: flowering plants, pink-orange sky, drifting petals
  skyGlow: { still(c, el) { const g = c.createLinearGradient(0, 0, 0, 560); g.addColorStop(0, rgba('#FF7AA0', el.alpha * 0.6)); g.addColorStop(1, rgba('#FFB070', el.alpha)); c.fillStyle = g; c.fillRect(0, 0, W, 560); glowDot(c, 70, 540, 90, '#FFD08A', el.alpha); } },
  flowerPlants: {
    make(el, r) { return flank(spread(r, el.count, 12, 348).map((x) => ({ x, h: 70 + r() * 90, k: r() })), [440, 400]); },
    still(c, el, s) { for (const p of s) { c.strokeStyle = A(el); c.lineWidth = 3; c.beginPath(); c.moveTo(p.x, 640); c.quadraticCurveTo(p.x + 10, 640 - p.h / 2, p.x, 640 - p.h); c.stroke(); blob(c, p.x - 10, 640 - p.h * 0.4, 10, 4, A(el)); for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; blob(c, p.x + Math.cos(a) * 8, 640 - p.h + Math.sin(a) * 8, 6, 4, rgba(el.bloom, el.alpha * 0.9)); } blob(c, p.x, 640 - p.h, 4, 4, rgba('#FFE08A', el.alpha)); } }
  },
  petals: {
    make(el, r) { return Array.from({ length: el.count }, () => ({ x: r() * W, o: r(), p: r() * TAU })); },
    live(c, el, s, t) { c.fillStyle = A(el); for (const p of s) { const k = wrap(p.o + t * 0.8); c.save(); c.translate(wrap(p.x / W + k * 0.25) * W, k * H); c.rotate(t * TAU + p.p); c.beginPath(); c.ellipse(0, 0, 5, 2.5, 0, 0, TAU); c.fill(); c.restore(); } }
  },
  // ---- age of mammals: grassland horizon, drifting herd
  sunGlow: { still(c, el) { glowDot(c, 290, 520, 120, el.color, el.alpha); } },
  grassHorizon: { still(c, el) { mound(c, 560, 8, 0.02, A(el, 0.8)); mound(c, 600, 6, 0.03, A(el), 1); c.strokeStyle = A(el); c.lineWidth = 1.5; const r = rng01(53); for (let i = 0; i < 70; i++) { const x = r() * W, y = 600 + r() * 38; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 5, y - 8 - r() * 8); c.stroke(); } } },
  acacia: { make(el, r) { return spread(r, el.count, 50, 310); }, still(c, el, s) { for (const x of s) { c.fillStyle = A(el); c.fillRect(x - 3, 540, 6, 60); blob(c, x, 538, 38, 9, A(el)); blob(c, x + 14, 530, 22, 7, A(el)); } } },
  herd: {
    make(el, r) { return Array.from({ length: el.count }, (_, i) => ({ x: i / el.count, s: 0.8 + r() * 0.4 })); },
    live(c, el, s, t) { c.fillStyle = A(el); for (const a of s) { const x = wrap(a.x + t * 0.4) * (W + 80) - 40, y = 585 + (a.x * 9) % 5, k = a.s; blob(c, x, y, 11 * k, 5 * k, A(el)); blob(c, x + 11 * k, y - 4 * k, 4 * k, 3 * k, A(el)); c.fillRect(x - 8 * k, y + 2 * k, 2, 8 * k + Math.sin(t * TAU * 4 + a.x * 20) * 1); c.fillRect(x + 6 * k, y + 2 * k, 2, 8 * k); } }
  },
  // ---- ice age: glacier cliffs, snowfall, aurora
  glacierCliffs: {
    still(c, el) {
      poly(c, [[0, 640], [0, 380], [50, 330], [70, 410], [110, 440], [140, 640]], A(el)); poly(c, [[W, 640], [W, 350], [305, 300], [280, 400], [240, 450], [215, 640]], A(el));
      poly(c, [[110, 640], [160, 560], [200, 520], [250, 570], [260, 640]], A(el, 0.7)); c.strokeStyle = rgba('#FFFFFF', el.alpha * 0.6); c.lineWidth = 2; c.beginPath(); c.moveTo(50, 330); c.lineTo(70, 410); c.moveTo(305, 300); c.lineTo(280, 400); c.stroke();
    }
  },
  aurora: { live(c, el, s, t) { for (let i = 0; i < el.count; i++) { const a = el.alpha * (0.7 + 0.3 * Math.sin(t * TAU + i * 2)), sh = Math.sin(t * TAU + i) * 14; c.strokeStyle = rgba(i % 2 ? '#78C8FF' : el.color, a); c.lineWidth = 20; c.beginPath(); c.moveTo(0, 70 + i * 26); c.bezierCurveTo(100, 30 + i * 30 + sh, 230, 120 - i * 20 - sh, W, 56 + i * 30); c.stroke(); } } },
  snowfall: {
    make(el, r) { return Array.from({ length: el.count }, () => ({ x: r() * W, o: r(), r: 0.8 + r() * 1.6, p: r() * TAU })); },
    live(c, el, s, t) { c.fillStyle = A(el); for (const f of s) { c.beginPath(); c.arc(f.x + Math.sin(t * TAU + f.p) * 10, wrap(f.o + t * (0.8 + f.r * 0.2)) * H, f.r, 0, TAU); c.fill(); } }
  },
  // ---- early humans: cave wall, ochre handprints, flickering torch
  caveWall: { still(c, el) { c.fillStyle = A(el, 0.6); c.fillRect(0, 0, W, H); const r = rng01(67); for (let i = 0; i < 26; i++) blob(c, r() * W, r() * H, 20 + r() * 40, 10 + r() * 24, rgba('#000000', 0.05 + r() * 0.06)); poly(c, [[0, H], [0, 250], [40, 280], [60, H]], A(el)); poly(c, [[W, H], [W, 230], [320, 270], [300, H]], A(el)); } },
  stalactites: { make(el, r) { return spread(r, el.count, 10, 350).map((x) => ({ x, h: 20 + r() * 50 })); }, still(c, el, s) { for (const t of s) poly(c, [[t.x - 10, 0], [t.x + 10, 0], [t.x, t.h]], A(el)); } },
  handprints: { make(el, r) { return [[40, 110], [300, 90], [320, 330], [30, 400], [160, 60]].slice(0, el.count).map(([x, y]) => ({ x, y, s: 0.8 + r() * 0.5 })); }, still(c, el, s) { for (const h of s) hand(c, h.x, h.y, h.s, A(el)); } },
  torchLight: {
    live(c, el, s, t) {
      for (const x of [22, 338]) {
        const f = 0.85 + 0.1 * Math.sin(t * TAU * 3 + x) + 0.05 * Math.sin(t * TAU * 7 + x * 2);
        glowDot(c, x, 300, 130 * f, el.color, el.alpha * f);
        c.fillStyle = '#3A2414'; c.fillRect(x - 2, 304, 4, 26);
        c.fillStyle = rgba(el.color, 0.8 * f); c.beginPath(); c.moveTo(x - 5, 304); c.quadraticCurveTo(x - 6, 288, x, 276 - 4 * f); c.quadraticCurveTo(x + 6, 288, x + 5, 304); c.fill();
      }
    }
  }
};

const cache = {};
// Scenery for an era: baked canvas (sky + still elements) plus the live element list.
export function buildScenery(eraId) {
  const th = themeFor(eraId), pal = eraPalette(th.id);
  if (cache[th.id]) return cache[th.id];
  const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
  const c = oc.getContext('2d'), rnd = rng01(hashSeed(...th.id.split('').map((ch) => ch.charCodeAt(0))));
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, pal.top); g.addColorStop(1, pal.bottom);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const live = [];
  for (const el of th.scenery) {
    const E = ELEMENTS[el.type], s = E.make ? E.make(el, rng01(hashSeed(...el.type.split('').map((ch) => ch.charCodeAt(0))))) : null;
    E.still?.(c, el, s); if (E.live) live.push({ E, el, s });
  }
  c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(0, 0, W, H);
  c.fillStyle = th.tint; c.globalAlpha = th.tintAlpha; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
  void rnd;
  return (cache[th.id] = { image: oc, live });
}

// Animated elements, drawn behind the board. `reduced` freezes them at their rest pose.
export function drawSceneryLive(c, scene, now, reduced) {
  const t = reduced ? 0 : now / LOOP.scene;
  for (const { E, el, s } of scene.live) E.live(c, el, s, t);
}
