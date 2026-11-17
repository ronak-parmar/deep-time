// Drawing for board obstacles and the artefact piece (docs/11 phase B). Presentation only: the rules live in core/obstacles.js.
// Painted tiles (art/ui tile-sand, tile-stone, tile-dirt) are used when present; every obstacle also has a vector look,
// so the game never depends on art being there. Shapes differ as well as colours, so none relies on colour alone.
import { slot, drawSlot } from './art.js';

const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };

// crack stage 1: one fracture, stage 2+: a second branch (fixed shapes, offset per block so a row does not repeat)
export function drawCracks(c, h, stage, i) {
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; if (i % 2) c.scale(-1, 1);
  const paths = [[[-0.7, -0.8], [-0.25, -0.35], [-0.4, 0.05], [0.05, 0.3], [0.0, 0.85]], [[0.8, -0.2], [0.35, -0.05], [0.5, 0.45], [0.8, 0.7]], [[-0.8, 0.5], [-0.35, 0.4], [-0.2, 0.0]]];
  for (let k = 0; k < Math.min(stage + 1, 3); k++) {
    const p = paths[k]; c.beginPath(); p.forEach(([x, y], j) => (j ? c.lineTo(x * h, y * h) : c.moveTo(x * h, y * h)));
    c.strokeStyle = 'rgba(15,10,6,.9)'; c.lineWidth = 2.2; c.stroke(); c.strokeStyle = 'rgba(255,240,210,.45)'; c.lineWidth = 0.8; c.translate(0.8, 0.8); c.stroke(); c.translate(-0.8, -0.8);
  }
  c.restore();
}

function tileBase(c, name, h, i, c1, c2) {
  if (slot(name, i) && drawSlot(c, name, -h, -h, h * 2, h * 2, i)) return;
  const g = c.createLinearGradient(0, -h, 0, h); g.addColorStop(0, c1); g.addColorStop(1, c2);
  rr(c, -h, -h, h * 2, h * 2, h * 0.28); c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = '#2A1B10'; c.stroke();
}
const stroke = (c, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.stroke(); };

function strata(c, h) { c.save(); c.globalAlpha = 0.28; for (const y of [-0.45, 0.05, 0.5]) { c.beginPath(); c.moveTo(-h * 0.8, y * h); c.quadraticCurveTo(0, (y + 0.12) * h, h * 0.8, (y - 0.04) * h); stroke(c, '#5A3A1C', 2); } c.restore(); }
function ammonite(c, h, a) {
  c.save(); c.globalAlpha = a; c.beginPath();
  for (let t = 0; t < 12; t += 0.2) { const r = (0.08 + t * 0.045) * h * 1.3; c.lineTo(Math.cos(t) * r, Math.sin(t) * r); }
  stroke(c, '#F6E7C2', 2.4); c.restore();
}
function bone(c, h, a) {
  c.save(); c.globalAlpha = a; c.rotate(-0.6); c.fillStyle = '#F6EBCB'; c.strokeStyle = '#7A6240'; c.lineWidth = 1.2;
  rr(c, -h * 0.55, -h * 0.1, h * 1.1, h * 0.2, h * 0.1); c.fill(); c.stroke();
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) { c.beginPath(); c.arc(sx * h * 0.55, sy * h * 0.14, h * 0.13, 0, 6.283); c.fill(); c.stroke(); }
  c.restore();
}
function leaf(c, x, y, a, s) { c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.ellipse(0, 0, s, s * 0.45, 0, 0, 6.283); c.fillStyle = '#4FA14B'; c.fill(); stroke(c, '#1E4A22', 1); c.restore(); }

// One obstacle. (x, y) = cell centre, cs = cell size, o = { k, hp, max, heat?, jolt?, s?, a? }, i = cell index (variant), now = ms.
export function drawObstacle(c, o, x, y, cs, i, now, reduced = false) {
  const h = cs * 0.5 - 2, s = o.s ?? 1; if (s <= 0 || (o.a ?? 1) <= 0) return;
  c.save(); c.globalAlpha = o.a ?? 1; c.translate(x + (o.jolt || 0) * 3 * (i % 2 ? 1 : -1), y); c.scale(s, s);
  const stage = (o.max || 1) - o.hp;
  switch (o.k) {
    case 'sandstone': tileBase(c, 'tile-sand', h, i, '#E2C48A', '#B58D58'); strata(c, h); if (stage > 0) drawCracks(c, h, stage, i); break;
    case 'fossil': tileBase(c, 'tile-sand', h, i, '#D9BB84', '#AA8350'); strata(c, h); ammonite(c, h, 0.5 - stage * 0.1); if (stage > 0) drawCracks(c, h, stage, i); break;
    case 'bone': tileBase(c, 'tile-sand', h, i, '#CDAE78', '#9C7547'); strata(c, h); bone(c, h, 0.55); break;
    case 'vine':
      tileBase(c, 'tile-stone', h, i, '#8C8A84', '#5D5C58');
      c.save(); c.globalAlpha = stage > 0 ? 0.55 : 1; c.lineCap = 'round';
      for (const [x0, y0, x1, y1] of [[-0.9, -0.5, 0.9, 0.55], [-0.9, 0.55, 0.9, -0.5]]) { c.beginPath(); c.moveTo(x0 * h, y0 * h); c.bezierCurveTo(-0.3 * h, y1 * h, 0.3 * h, y0 * h, x1 * h, y1 * h); stroke(c, '#2F7A34', 3.2); }
      leaf(c, -h * 0.4, -h * 0.25, 0.6, h * 0.22); leaf(c, h * 0.35, h * 0.3, -0.5, h * 0.22); leaf(c, h * 0.45, -h * 0.35, 0.2, h * 0.18);
      c.restore(); if (stage > 0) drawCracks(c, h, stage, i); break;
    case 'crate': {
      rr(c, -h, -h, h * 2, h * 2, h * 0.18); const g = c.createLinearGradient(0, -h, 0, h); g.addColorStop(0, '#B07A3E'); g.addColorStop(1, '#7B4F25'); c.fillStyle = g; c.fill(); stroke(c, '#2A180B', 2);
      c.strokeStyle = 'rgba(40,22,8,.55)'; c.lineWidth = 1.6; for (const t of [-0.33, 0.33]) { c.beginPath(); c.moveTo(-h * 0.92, t * h); c.lineTo(h * 0.92, t * h); c.stroke(); }
      c.strokeStyle = '#D8B14A'; c.lineWidth = 3; c.beginPath(); c.moveTo(-h * 0.85, -h * 0.85); c.lineTo(h * 0.85, h * 0.85); c.moveTo(h * 0.85, -h * 0.85); c.lineTo(-h * 0.85, h * 0.85); c.stroke();
      c.fillStyle = '#F6D56A'; c.beginPath(); c.arc(0, 0, h * 0.16, 0, 6.283); c.fill(); stroke(c, '#5A3A10', 1.2); break;
    }
    case 'lava': {
      const heat = (o.heat || 0) / 3, pulse = reduced ? 0 : 0.5 + 0.5 * Math.sin(now / 260);
      tileBase(c, 'tile-stone', h, i, '#4A3A3A', '#231A1C');
      c.save(); c.shadowColor = '#FF6A1E'; c.shadowBlur = 6 + heat * 10 + pulse * 3; c.lineCap = 'round';
      for (const p of [[[-0.7, -0.6], [-0.2, -0.1], [-0.35, 0.4], [0.1, 0.8]], [[0.7, -0.5], [0.2, 0], [0.5, 0.5]]]) { c.beginPath(); p.forEach(([a, b], j) => (j ? c.lineTo(a * h, b * h) : c.moveTo(a * h, b * h))); stroke(c, `rgb(255,${Math.round(150 - heat * 70)},40)`, 2.6 + heat * 1.4); }
      c.restore();
      c.fillStyle = '#FFD27A'; for (let k = 0; k < o.hp; k++) { c.beginPath(); c.arc((k - (o.hp - 1) / 2) * 6, h - 5, 2, 0, 6.283); c.fill(); }
      if (stage > 0) drawCracks(c, h, stage, i); break;
    }
    case 'rock': {
      tileBase(c, 'tile-stone', h, i, '#9A9892', '#5E5C58');
      c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.moveTo(-h * 0.7, -h * 0.2); c.lineTo(-h * 0.2, -h * 0.7); c.lineTo(h * 0.35, -h * 0.5); c.lineTo(0, -h * 0.05); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.moveTo(h * 0.1, h * 0.1); c.lineTo(h * 0.7, -h * 0.1); c.lineTo(h * 0.6, h * 0.7); c.lineTo(-h * 0.3, h * 0.65); c.closePath(); c.fill(); break;
    }
    default: {   // tar
      const wob = reduced ? 0 : Math.sin(now / 420 + i) * 0.04;
      c.beginPath(); c.moveTo(-h * 0.85, h * 0.1);
      c.bezierCurveTo(-h * 0.95, -h * 0.75, -h * 0.1, -h * (0.95 + wob), h * 0.45, -h * 0.7); c.bezierCurveTo(h * 1.0, -h * 0.4, h * 0.95, h * 0.55, h * 0.4, h * 0.85);
      c.bezierCurveTo(-h * 0.2, h * (1 + wob), -h * 0.85, h * 0.8, -h * 0.85, h * 0.1); c.closePath();
      const g = c.createRadialGradient(-h * 0.3, -h * 0.3, h * 0.1, 0, 0, h * 1.1); g.addColorStop(0, '#3C3246'); g.addColorStop(1, '#0F0B14'); c.fillStyle = g; c.fill(); stroke(c, '#050308', 2);
      c.fillStyle = 'rgba(210,190,255,.5)'; c.beginPath(); c.ellipse(-h * 0.3, -h * 0.35, h * 0.22, h * 0.1, -0.5, 0, 6.283); c.fill();
      c.fillStyle = 'rgba(190,170,230,.35)'; for (const [bx, by, br] of [[0.35, 0.2, 0.1], [0.1, 0.5, 0.07]]) { c.beginPath(); c.arc(bx * h, by * h, br * h, 0, 6.283); c.fill(); }
    }
  }
  if (o.hp !== Infinity && o.max > 1 && o.k !== 'lava') { c.fillStyle = '#FFE9A8'; for (let k = 0; k < o.hp; k++) { c.beginPath(); c.arc((k - (o.hp - 1) / 2) * 5, h - 3, 1.7, 0, 6.283); c.fill(); } }
  c.restore();
}

// The artefact piece: a golden relic (diamond with a ring), clearly not a gem. r = the piece radius used for gems.
export function drawArtefact(c, r, now, reduced = false) {
  const glint = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(now / 300);
  c.save();
  c.beginPath(); c.arc(0, 0, r * 1.05, 0, 6.283); const g = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1); g.addColorStop(0, '#FFE9A0'); g.addColorStop(1, '#A8741C'); c.fillStyle = g; c.fill(); stroke(c, '#4A300A', 2);
  c.beginPath(); c.moveTo(0, -r * 0.62); c.lineTo(r * 0.5, 0); c.lineTo(0, r * 0.62); c.lineTo(-r * 0.5, 0); c.closePath(); c.fillStyle = '#5A3A10'; c.fill();
  c.beginPath(); c.moveTo(0, -r * 0.4); c.lineTo(r * 0.3, 0); c.lineTo(0, r * 0.4); c.lineTo(-r * 0.3, 0); c.closePath(); c.fillStyle = '#FFD25A'; c.fill();
  c.fillStyle = `rgba(255,255,255,${0.35 + glint * 0.5})`; c.beginPath(); c.arc(-r * 0.45, -r * 0.5, r * 0.12, 0, 6.283); c.fill();
  c.restore();
}
