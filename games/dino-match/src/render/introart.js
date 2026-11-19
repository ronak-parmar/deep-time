// Draws the little animated picture on an intro card from an entry's `art` slot, using the same painters as the board.
import { drawObstacle, drawArtefact } from './obstacles.js';
import { drawSpecialPiece } from './specials.js';
import { spriteFor } from './atlas.js';
import { drawGemShape } from './gems.js';
import { reducedMotion } from '../ui/motion.js';
import { paintObjective, objectiveEra } from '../ui/objectives.js';

// the plain gem the board would show: the era's painted sprite, else the code shape
const boardGem = (c, p, r) => { const sp = p.c >= 0 ? spriteFor(objectiveEra(), p.c) : null; if (sp) { const d = r * 2.3; c.drawImage(sp, -d / 2, -d / 2, d, d); } else drawGemShape(c, p.c, r); };

const HITS = { tar: 1, sand: 2, stone: 3 };

// ---- boosters: a little 4x4 board that plays the effect, looping (docs/16). size = the square it is painted in. ---------------------
const N = 4, COLOR = (x, y) => (x * 2 + y * 3 + (x > 1 ? 1 : 0)) % 4;
const ease = (u) => 1 - (1 - Math.min(1, Math.max(0, u))) ** 3, seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
function boosterBoard(c, id, size, t) {
  const pad = size * 0.09, cs = (size - pad * 2) / N, red = reducedMotion(), L = 3.4, u = red ? 1.6 : t % L;
  const cx = (x) => pad + (x + 0.5) * cs, cy = (y) => pad + (y + 0.5) * cs, r = cs * 0.38;
  const tile = (x, y) => { c.fillStyle = (x + y) % 2 ? 'rgba(255,240,200,.10)' : 'rgba(255,240,200,.17)'; c.beginPath(); c.roundRect(pad + x * cs + 1.5, pad + y * cs + 1.5, cs - 3, cs - 3, 5); c.fill(); };
  const gem = (x, y, k, a = 1, sc = 1, dy = 0, dx = 0) => { if (a <= 0 || sc <= 0) return; c.save(); c.globalAlpha = a; c.translate(cx(x) + dx, cy(y) + dy); c.scale(sc, sc); drawGemShape(c, COLOR(x, y) + k, r); c.restore(); };
  const spark = (x, y, p, col = '#FFE9A8') => { if (p <= 0 || p >= 1) return; c.fillStyle = col; for (let k = 0; k < 6; k++) { const a = k * 1.047 + 0.4, d = cs * 0.55 * ease(p); c.globalAlpha = 1 - p; c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2.2, 0, 6.283); c.fill(); } c.globalAlpha = 1; };
  const stone = (x, y, hp) => { c.fillStyle = '#B79A68'; c.beginPath(); c.roundRect(pad + x * cs + 2, pad + y * cs + 2, cs - 4, cs - 4, 6); c.fill(); c.strokeStyle = '#6E5530'; c.lineWidth = 2; c.stroke(); if (hp >= 2) { c.beginPath(); c.moveTo(cx(x) - r * 0.6, cy(y) - r * 0.2); c.lineTo(cx(x), cy(y) + r * 0.1); c.lineTo(cx(x) + r * 0.5, cy(y) - r * 0.5); c.stroke(); } };
  c.save(); c.translate(-size / 2, -size / 2);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) tile(x, y);
  const out = seg(u, 1.1, 1.5), back = ease(seg(u, 1.6, 2.2)), fade = 1 - seg(u, 2.9, 3.4);
  const drop = (x, y) => (1 - back) * -cs;
  if (id === 'pick') {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (x === 1 && y === 2) { gem(x, y, 0, 1 - ease(out) , 1 - 0.4 * out); if (u > 1.5) gem(x, y, 0, back, 0.6 + 0.4 * back, drop(x, y)); } else gem(x, y, 0); }
    const sw = ease(seg(u, 0.3, 1.1)); c.save(); c.translate(cx(1) + cs * 0.35 * (1 - sw), cy(2) - cs * 1.1 * (1 - sw)); c.rotate(-0.9 + sw * 0.9 - 0.2); c.globalAlpha = u < 1.6 ? 1 : fade;
    c.strokeStyle = '#8A5A2B'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, cs * 0.5); c.lineTo(0, -cs * 0.25); c.stroke(); c.strokeStyle = '#C9D1D8'; c.lineWidth = 5; c.beginPath(); c.arc(0, -cs * 0.15, cs * 0.42, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.restore();
    spark(cx(1), cy(2), seg(u, 1.1, 1.8));
  } else if (id === 'rockslide') {
    const sweep = seg(u, 0.5, 1.5), row = 2;
    c.fillStyle = 'rgba(255,214,110,.22)'; c.fillRect(pad, pad + row * cs, size - 2 * pad, cs);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (y === row) { const gone = sweep * N > x + 0.5; if (!gone) gem(x, y, 0); else if (u > 1.6) gem(x, y, 0, back, 0.6 + 0.4 * back, drop(x, y)); } else gem(x, y, 0); }
    if (u > 0.5 && u < 1.9) { const x = pad + sweep * (size - 2 * pad); c.fillStyle = '#8A7350'; c.beginPath(); c.arc(x, cy(row), cs * 0.36, 0, 6.283); c.fill(); c.fillStyle = '#B49A6C'; c.beginPath(); c.arc(x - 2, cy(row) - 3, cs * 0.2, 0, 6.283); c.fill(); }
  } else if (id === 'brush') {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const inArea = x >= 1 && x <= 2 && y >= 1 && y <= 2; if (inArea) stone(x, y, u < 1.4 ? 2 : 1); else gem(x, y, 0); }
    const sw = ease(seg(u, 0.4, 1.4)); c.save(); c.translate(cx(1) + (cx(2) - cx(1)) * sw, cy(1) + (cy(2) - cy(1)) * (0.5 + 0.5 * Math.sin(sw * 12))); c.rotate(-0.6);
    c.strokeStyle = '#8A5A2B'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(cs * 0.55, -cs * 0.4); c.stroke(); c.fillStyle = '#7ED35A'; c.beginPath(); c.ellipse(-cs * 0.1, cs * 0.08, cs * 0.2, cs * 0.12, 0, 0, 6.283); c.fill(); c.restore();
    spark(cx(1.5), cy(1.5), seg(u, 1.2, 2), '#B6F08F');
  } else if (id === 'amber') {
    const glow = seg(u, 0.4, 1.2), go = ease(seg(u, 1.2, 1.7));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (COLOR(x, y) === 0) { if (glow > 0) { c.fillStyle = `rgba(255,194,75,${0.5 * glow * (1 - go)})`; c.beginPath(); c.arc(cx(x), cy(y), r * 1.5, 0, 6.283); c.fill(); } gem(x, y, 0, 1 - go, 1 - 0.6 * go); if (u > 1.7) gem(x, y, 0, back, 0.6 + 0.4 * back, drop(x, y)); spark(cx(x), cy(y), seg(u, 1.2, 1.9), '#FFC24B'); }
      else gem(x, y, 0);
    }
  } else if (id === 'tremor') {
    const sh = seg(u, 0.4, 1.6), amp = Math.sin(u * 40) * cs * 0.06 * (u > 0.4 && u < 1.6 ? 1 : 0), mv = ease(seg(u, 0.9, 1.7));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const nx = (x + 2) % N, ny = (y + 1) % N; gem(x, y, 0, 1, 1, (ny - y) * cs * mv * 0 + amp * (x % 2 ? 1 : -1), (nx - x) * cs * mv * 0 + amp); void sh; }
    c.globalAlpha = 0.9; c.fillStyle = '#C9A8FF'; c.font = '800 13px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(u < 1.7 ? '~ ~ ~' : 'new move!', size / 2, size - 3); c.globalAlpha = 1;
  } else if (id === 'moves5' || id === 'start3') {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) gem(x, y, 0, 0.45);
    const add = id === 'moves5' ? 5 : 3, p = ease(seg(u, 0.5, 1.2)), n = Math.round(12 + add * seg(u, 1.0, 1.6));
    c.fillStyle = '#2B1D10'; c.strokeStyle = '#E9B24A'; c.lineWidth = 3; c.beginPath(); c.roundRect(size * 0.2, size * 0.36, size * 0.6, size * 0.28, 12); c.fill(); c.stroke();
    c.fillStyle = '#FFF3D0'; c.font = '800 22px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), size / 2, size * 0.5);
    c.globalAlpha = p * (1 - seg(u, 2.4, 3.2)); c.fillStyle = '#6FD3FF'; c.font = '900 26px Nunito, system-ui, sans-serif'; c.fillText(`+${add}`, size / 2, size * 0.28 - 8 * p); c.globalAlpha = 1;
  } else if (id === 'lucky') {
    const pop = ease(seg(u, 0.8, 1.4));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (x === 2 && y === 1) { gem(x, y, 0); if (pop > 0) { c.save(); c.translate(cx(x), cy(y)); c.scale(0.6 + 0.5 * pop, 0.6 + 0.5 * pop); drawSpecialPiece(c, { k: 'firecracker', o: 'h', c: COLOR(x, y) }, r, u * 1000, red, null); c.restore(); } } else gem(x, y, 0); }
    spark(cx(2), cy(1), seg(u, 0.8, 1.6));
  }
  c.restore();
}

// Paints one frame of `art` centred in a size x size box at time t (seconds).
export function paintIntroArt(c, art, size, t) {
  const m = size / 2, r = size * 0.3, red = reducedMotion();
  c.clearRect(0, 0, size, size); c.save(); c.translate(m, m);
  switch (art.kind) {
    case 'obstacle': { c.translate(-m, -m); drawObstacle(c, { k: art.key, hp: art.key === 'lava' ? 3 : 2, max: art.key === 'lava' ? 3 : 2, heat: (t * 1.2) % 3 }, m, m, size * 0.96, 0, t * 1000, red); break; }
    case 'artefact': drawArtefact(c, r * 1.2, t * 1000, red); break;
    case 'gem': { const b = size * 0.8; c.translate(-b / 2, -b / 2); paintObjective(c, { kind: 'gem', key: art.key }, b, undefined, false); break; }   // the painted gem the board uses
    case 'special': {
      const k = art.key;
      drawSpecialPiece(c, { k, o: 'h', c: k === 'rainbow' ? -1 : 0 }, r * 1.2, t * 1000, red, boardGem);
      break;
    }
    case 'block': {   // the painted plaque tile the board uses, with its hit points as pips
      const b = size * 0.74; c.save(); c.translate(-b / 2, -b / 2); paintObjective(c, { kind: 'block', key: art.key, badge: art.badge, pick: art.pick }, b, undefined, false); c.restore();
      if (art.pick) break;   // the dig goal: tile, gem badge and pickaxe, as in the HUD
      const n = HITS[art.key] || 1; c.fillStyle = '#FFE9A8'; c.strokeStyle = 'rgba(40,20,0,.8)'; c.lineWidth = 1.5;
      for (let i = 0; i < n; i++) { c.beginPath(); c.arc((i - (n - 1) / 2) * r * 0.42, b * 0.36, r * 0.12, 0, 6.283); c.fill(); c.stroke(); }
      break;
    }
    case 'booster': boosterBoard(c, art.key, size, t); break;
    case 'tier': {   // a level coin in the tier colour with a flame badge (two for super hard), gently pulsing
      const sup = art.key === 'super-hard', k = 1 + (red ? 0 : 0.04 * Math.sin(t * 4)), R = r * 1.25 * k;
      const g = c.createRadialGradient(-R * 0.3, -R * 0.35, 1, 0, 0, R); g.addColorStop(0, sup ? '#E6C8FF' : '#FFB4A0'); g.addColorStop(0.55, sup ? '#9A4BE0' : '#D8392B'); g.addColorStop(1, sup ? '#4E1A86' : '#7A1410');
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(0, R * 0.12, R * 1.05, 0, 6.283); c.fill();
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, 6.283); c.fill(); c.lineWidth = R * 0.14; c.strokeStyle = sup ? '#2E0E52' : '#4A0C08'; c.stroke();
      const flame = (x, y, s) => { c.save(); c.translate(x, y); c.scale(s, s); c.beginPath(); c.moveTo(0, -1); c.bezierCurveTo(0.7, -0.4, 0.6, 0.6, 0, 0.8); c.bezierCurveTo(-0.6, 0.6, -0.7, -0.2, -0.15, -0.45); c.bezierCurveTo(-0.1, -0.1, 0.2, -0.2, 0, -1); c.fillStyle = '#FFD24A'; c.fill(); c.lineWidth = 0.12; c.strokeStyle = '#7A2A08'; c.stroke(); c.restore(); };
      if (sup) { flame(-R * 0.32, 0, R * 0.42); flame(R * 0.32, 0, R * 0.42); } else flame(0, 0, R * 0.55);
      break;
    }
    default: break;
  }
  c.restore();
}
