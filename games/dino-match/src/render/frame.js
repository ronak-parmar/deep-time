// Code-drawn era art: board frame, plaque, HUD plate, ambient particles. All read an era theme
// (eraTheme.js). Static art is drawn once into an offscreen canvas and cached by the renderer.
import { rng01, mix, shade, rgba } from './util.js';
import { drawSlot, slotReady, getArtVersion } from './art.js';
import { hashSeed } from '../core/rng.js';
import { themeFor, hudColors } from './eraTheme.js';

export const FRAME_T = 12;   // ring thickness
export const FRAME_M = 12;   // margin in the offscreen canvas for caps that overhang the ring

const seedOf = (id) => hashSeed(...id.split('').map((ch) => ch.charCodeAt(0)));

function rrPath(c, x, y, w, h, r) {
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

// ---- textures: drawn inside a clip, over the rect ---------------------------------------
const scatter = (r, rect, n, fn) => { for (let i = 0; i < n; i++) fn(rect.x + r() * rect.w, rect.y + r() * rect.h, i); };
const TEXTURES = {
  ripple(c, R, p, r) { // sand ripples
    c.strokeStyle = rgba(p.accent, 0.3); c.lineWidth = 1.4;
    for (let y = R.y + 3; y < R.y + R.h; y += 5) { c.beginPath(); for (let x = R.x; x <= R.x + R.w; x += 6) c.lineTo(x, y + Math.sin(x * 0.25 + y) * 1.6); c.stroke(); }
  },
  grain(c, R, p, r) { // wood grain
    c.strokeStyle = rgba(p.edge, 0.35); c.lineWidth = 1.2;
    for (let y = R.y + 2; y < R.y + R.h; y += 4 + r() * 3) { c.beginPath(); c.moveTo(R.x, y); c.bezierCurveTo(R.x + R.w * 0.3, y + r() * 3 - 1.5, R.x + R.w * 0.6, y + r() * 3 - 1.5, R.x + R.w, y); c.stroke(); }
    scatter(r, R, 6, (x, y) => { c.strokeStyle = rgba(p.edge, 0.4); c.beginPath(); c.ellipse(x, y, 4, 2, 0, 0, 6.283); c.stroke(); });
  },
  speckle(c, R, p, r) { // coal
    scatter(r, R, 420, (x, y, i) => { c.fillStyle = i % 5 ? rgba('#000000', 0.35) : rgba(p.light, 0.5); c.fillRect(x, y, 1 + r() * 2, 1 + r() * 2); });
  },
  cracks(c, R, p, r) { // sandstone strata and cracks
    c.strokeStyle = rgba(p.light, 0.3); c.lineWidth = 2;
    for (let y = R.y + 6; y < R.y + R.h; y += 9) { c.beginPath(); c.moveTo(R.x, y); c.lineTo(R.x + R.w, y + r() * 3); c.stroke(); }
    c.strokeStyle = rgba(p.edge, 0.55); c.lineWidth = 1.3;
    scatter(r, R, 26, (x, y) => { c.beginPath(); c.moveTo(x, y); let px = x, py = y; for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 9; py += (r() - 0.3) * 8; c.lineTo(px, py); } c.stroke(); });
  },
  ash(c, R, p, r) { // rock with ash flecks
    scatter(r, R, 300, (x, y) => { c.fillStyle = rgba(p.accent, 0.35); c.fillRect(x, y, 1.5, 1.5); });
    scatter(r, R, 40, (x, y) => { c.fillStyle = rgba(p.edge, 0.25); c.beginPath(); c.ellipse(x, y, 3 + r() * 3, 2 + r() * 2, r() * 3, 0, 6.283); c.fill(); });
  },
  leafy(c, R, p, r) { // overlapping leaves
    scatter(r, R, 110, (x, y, i) => { c.fillStyle = i % 2 ? rgba(p.dark, 0.5) : rgba(p.accent2, 0.22); c.beginPath(); c.ellipse(x, y, 5, 2, r() * 3.14, 0, 6.283); c.fill(); });
  },
  blocks(c, R, p, r) { // dressed stone blocks
    c.strokeStyle = rgba(p.edge, 0.4); c.lineWidth = 1.4;
    let row = 0;
    for (let y = R.y; y < R.y + R.h; y += 12, row++) {
      c.beginPath(); c.moveTo(R.x, y); c.lineTo(R.x + R.w, y); c.stroke();
      for (let x = R.x + (row % 2) * 14; x < R.x + R.w; x += 28) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 12); c.stroke(); }
    }
  },
  earth(c, R, p, r) { // packed earth with roots
    scatter(r, R, 200, (x, y, i) => { c.fillStyle = i % 3 ? rgba(p.dark, 0.35) : rgba(p.light, 0.3); c.fillRect(x, y, 2, 2); });
    c.strokeStyle = rgba(p.edge, 0.35); c.lineWidth = 1.2;
    scatter(r, R, 14, (x, y) => { c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 8, y + 4, x + 16, y - 2); c.stroke(); });
  },
  frost(c, R, p, r) { // ice facets and sparkles
    c.strokeStyle = rgba('#FFFFFF', 0.35); c.lineWidth = 1;
    scatter(r, R, 36, (x, y) => { const a = r() * 3.14, l = 6 + r() * 8; c.beginPath(); c.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); });
    scatter(r, R, 20, (x, y) => { c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(x, y, 1.5, 1.5); });
  },
  rock(c, R, p, r) { // cave wall blotches
    scatter(r, R, 60, (x, y, i) => { c.fillStyle = i % 4 ? rgba('#000000', 0.22) : rgba(p.accent, 0.12); c.beginPath(); c.ellipse(x, y, 4 + r() * 8, 3 + r() * 5, r() * 3, 0, 6.283); c.fill(); });
  }
};

// ---- corner ornaments: drawn for the top-left corner, local (0,0) is the frame's outer corner ---
const CORNERS = {
  shell(c, p) { // scallop fan
    c.translate(11, 11);
    for (let i = 0; i < 7; i++) { const a = Math.PI * (0.02 + i * 0.155) ; c.strokeStyle = p.edge; c.lineWidth = 3.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 17, Math.sin(a) * 17); c.stroke(); }
    c.fillStyle = p.accent2; c.strokeStyle = p.edge; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 17, 0, Math.PI * 1.0 / 2 + 0.2); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = rgba(p.edge, 0.6); c.lineWidth = 1; for (let i = 1; i < 6; i++) { const a = i * 0.28; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 17, Math.sin(a) * 17); c.stroke(); }
  },
  fern(c, p) {
    c.translate(10, 10); c.strokeStyle = p.edge; c.lineWidth = 2.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-2, -2); c.quadraticCurveTo(10, 6, 20, 20); c.stroke();
    for (let i = 1; i <= 6; i++) { const t = i / 7, x = -2 + 22 * t, y = -2 + 22 * t * t * 0.4 + t * 18 * t; for (const s of [-1, 1]) { c.fillStyle = i % 2 ? p.accent : p.accent2; c.strokeStyle = p.edge; c.lineWidth = 1; c.beginPath(); c.ellipse(x + s * 3, y - s * 3, 5, 1.8, Math.PI / 4 * s + 0.4, 0, 6.283); c.fill(); c.stroke(); } }
  },
  moss(c, p) {
    c.translate(8, 8);
    for (const [x, y, r, col] of [[2, 2, 9, p.accent], [12, 5, 6, p.accent2], [5, 13, 6, p.accent2], [14, 14, 4, p.accent]]) { c.fillStyle = col; c.strokeStyle = p.edge; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill(); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(-1, -1, 3, 0, 6.283); c.fill();
  },
  chip(c, p) { // angular capstone
    c.fillStyle = p.light; c.strokeStyle = p.edge; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-2, -2); c.lineTo(22, -2); c.lineTo(16, 7); c.lineTo(20, 14); c.lineTo(12, 18); c.lineTo(8, 24); c.lineTo(-2, 22); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = rgba(p.edge, 0.6); c.beginPath(); c.moveTo(4, 4); c.lineTo(11, 10); c.lineTo(8, 17); c.stroke();
  },
  ash(c, p) {
    c.fillStyle = p.accent; c.strokeStyle = p.edge; c.lineWidth = 1.6; c.beginPath(); c.ellipse(10, 10, 12, 9, 0.6, 0, 6.283); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(7, 6, 5, 3, 0.6, 0, 6.283); c.fill();
    c.save(); c.shadowColor = p.accent2; c.shadowBlur = 8; c.fillStyle = p.accent2; c.beginPath(); c.arc(13, 14, 2.4, 0, 6.283); c.fill(); c.restore();
  },
  vine(c, p) {
    c.translate(8, 8); c.strokeStyle = p.edge; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(-4, 20); c.bezierCurveTo(-4, 4, 4, -4, 22, -2); c.stroke();
    c.strokeStyle = p.accent2; c.lineWidth = 1.2; c.stroke();
    for (const [x, y, a] of [[-2, 12, 2.4], [2, 4, 3.6], [11, -1, 0.6], [18, -2, 5.6]]) { c.fillStyle = p.accent2; c.strokeStyle = p.edge; c.lineWidth = 1; c.beginPath(); c.ellipse(x, y, 5, 2.4, a, 0, 6.283); c.fill(); c.stroke(); }
    c.fillStyle = p.accent; c.strokeStyle = p.edge; c.beginPath(); c.arc(8, 8, 3.4, 0, 6.283); c.fill(); c.stroke();
  },
  flower(c, p) {
    c.translate(11, 11);
    for (let i = 0; i < 5; i++) { c.save(); c.rotate((i * 6.283) / 5); c.fillStyle = p.accent2; c.strokeStyle = p.edge; c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, -7, 4.2, 6, 0, 0, 6.283); c.fill(); c.stroke(); c.restore(); }
    c.save(); c.shadowColor = p.accent; c.shadowBlur = 6; c.fillStyle = p.accent; c.strokeStyle = p.edge; c.beginPath(); c.arc(0, 0, 4.4, 0, 6.283); c.fill(); c.stroke(); c.restore();
  },
  leaf(c, p) {
    c.translate(9, 9);
    for (const [a, col] of [[0.5, p.accent], [1.15, p.accent2]]) { c.save(); c.rotate(a); c.fillStyle = col; c.strokeStyle = p.edge; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(6, -11, 20, -2); c.quadraticCurveTo(8, 7, 0, 0); c.fill(); c.stroke(); c.strokeStyle = rgba(p.edge, 0.6); c.beginPath(); c.moveTo(1, 0); c.lineTo(15, -2); c.stroke(); c.restore(); }
  },
  snow(c, p) { // snow lump with sparkle
    c.fillStyle = p.accent; c.strokeStyle = p.edge; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-3, 16); c.bezierCurveTo(-4, -4, 12, -6, 18, 2); c.bezierCurveTo(24, 6, 16, 12, 14, 16); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = rgba(p.dark, 0.35); c.beginPath(); c.ellipse(9, 13, 8, 2.2, 0, 0, 6.283); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(6, 3); c.lineTo(6, 8); c.moveTo(3.5, 5.5); c.lineTo(8.5, 5.5); c.stroke();
  },
  hand(c, p) { // ochre handprint
    c.translate(11, 11); c.rotate(-0.5); c.fillStyle = rgba(p.accent, 0.9); c.strokeStyle = rgba(p.edge, 0.7); c.lineWidth = 1;
    c.beginPath(); c.ellipse(0, 3, 6, 6.5, 0, 0, 6.283); c.fill(); c.stroke();
    for (const [x, a, l] of [[-6, -0.5, 9], [-3, -0.2, 11], [0, 0, 11.5], [3, 0.2, 10.5]]) { c.save(); c.translate(x, -2); c.rotate(a); c.beginPath(); c.roundRect ? c.roundRect(-1.7, -l, 3.4, l, 1.7) : c.rect(-1.7, -l, 3.4, l); c.fill(); c.stroke(); c.restore(); }
    c.save(); c.translate(7, 3); c.rotate(1.1); c.beginPath(); c.roundRect ? c.roundRect(-1.7, -8, 3.4, 8, 1.7) : c.rect(-1.7, -8, 3.4, 8); c.fill(); c.stroke(); c.restore();
  }
};

// ---- trims: items along the ring centre line; fn(c, theme palette, x, y, angle, i) ---------------
const TRIMS = {
  pearl: (c, p, x, y, a, i) => { c.fillStyle = i % 2 ? p.accent : p.accent2; c.strokeStyle = p.edge; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 2.6, 0, 6.283); c.fill(); c.stroke(); },
  leaf: (c, p, x, y, a, i) => { c.save(); c.translate(x, y); c.rotate(a + (i % 2 ? 0.5 : -0.5)); c.fillStyle = i % 2 ? p.accent : p.accent2; c.strokeStyle = p.edge; c.lineWidth = 1; c.beginPath(); c.ellipse(0, 0, 5, 2.2, 0, 0, 6.283); c.fill(); c.stroke(); c.restore(); },
  tuft: (c, p, x, y, a, i) => { if (i % 2) return; c.fillStyle = p.accent; c.strokeStyle = p.edge; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 3.4 + (i % 3), 0, 6.283); c.fill(); c.stroke(); },
  strata: (c, p, x, y, a, i) => { c.save(); c.translate(x, y); c.rotate(a); c.strokeStyle = rgba(p.accent, 0.8); c.lineWidth = 1.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(-6, -2); c.lineTo(6, -2); c.moveTo(-4, 2); c.lineTo(8, 2); c.stroke(); c.restore(); },
  ember: (c, p, x, y, a, i) => { if (i % 3) return; c.save(); c.shadowColor = p.accent2; c.shadowBlur = 7; c.fillStyle = p.accent2; c.beginPath(); c.arc(x, y, 2.2, 0, 6.283); c.fill(); c.restore(); },
  bone: (c, p, x, y, a, i) => { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = p.accent; c.strokeStyle = p.edge; c.lineWidth = 1; c.beginPath(); c.ellipse(0, 0, 6, 2.6, 0, 0, 6.283); c.fill(); c.stroke(); c.restore(); },
  amber: (c, p, x, y, a, i) => { c.save(); c.shadowColor = p.accent; c.shadowBlur = 4; c.fillStyle = p.accent; c.strokeStyle = p.edge; c.lineWidth = 1; c.beginPath(); c.ellipse(x, y, 2.8, 3.6, 0, 0, 6.283); c.fill(); c.stroke(); c.restore(); },
  grass: (c, p, x, y, a, i) => { c.save(); c.translate(x, y); c.rotate(a); c.strokeStyle = i % 2 ? p.accent : p.accent2; c.lineWidth = 1.8; c.lineCap = 'round'; c.beginPath(); c.moveTo(-3, 2); c.lineTo(-4, -3); c.moveTo(0, 2); c.lineTo(0, -5); c.moveTo(3, 2); c.lineTo(4, -3); c.stroke(); c.restore(); },
  crystal: (c, p, x, y, a, i) => { c.save(); c.translate(x, y); c.rotate(a + Math.PI / 4); c.fillStyle = i % 2 ? '#fff' : p.accent2; c.strokeStyle = p.edge; c.lineWidth = 1; c.fillRect(-2.6, -2.6, 5.2, 5.2); c.strokeRect(-2.6, -2.6, 5.2, 5.2); c.restore(); },
  ochre: (c, p, x, y, a, i) => { c.save(); c.translate(x, y); c.rotate(a); c.strokeStyle = rgba(p.accent, 0.85); c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); if (i % 2) { c.moveTo(-4, 0); c.lineTo(4, 0); } else { c.moveTo(-3, -2); c.lineTo(0, 2); c.lineTo(3, -2); } c.stroke(); c.restore(); }
};

// ---- caps: overhang on top (and a few drips below). x0..x1 is the outer top edge, y its y ------------
const CAPS = {
  snow(c, p, x0, x1, y, r) {
    c.fillStyle = '#fff'; c.strokeStyle = p.edge; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x0 + 14, y + 2);
    for (let x = x0 + 14; x < x1 - 14; x += 14) c.quadraticCurveTo(x + 7, y - 9 - r() * 4, x + 14, y + 2);
    c.lineTo(x1 - 14, y + 5); c.lineTo(x0 + 14, y + 5); c.closePath(); c.fill(); c.stroke();
    for (let x = x0 + 26; x < x1 - 26; x += 22 + r() * 18) { const l = 6 + r() * 7; c.fillStyle = p.light; c.strokeStyle = p.edge; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 3, y + FRAME_T - 1); c.lineTo(x + 3, y + FRAME_T - 1); c.lineTo(x, y + FRAME_T + l); c.closePath(); c.fill(); c.stroke(); }
  },
  moss(c, p, x0, x1, y, r) {
    for (let x = x0 + 18; x < x1 - 18; x += 10 + r() * 8) { c.fillStyle = r() > 0.5 ? p.accent : p.accent2; c.strokeStyle = p.edge; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y + 3, 4 + r() * 3, Math.PI, 0); c.fill(); c.stroke(); }
  },
  grass(c, p, x0, x1, y, r) {
    c.lineCap = 'round';
    for (let x = x0 + 16; x < x1 - 16; x += 5 + r() * 3) { c.strokeStyle = r() > 0.5 ? p.accent : p.accent2; c.lineWidth = 1.8; c.beginPath(); c.moveTo(x, y + 3); c.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 5); c.stroke(); }
  },
  vines(c, p, x0, x1, y, r) {
    for (let x = x0 + 30; x < x1 - 30; x += 46 + r() * 30) { const l = 10 + r() * 14; c.strokeStyle = p.edge; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y + FRAME_T - 2); c.quadraticCurveTo(x + 5, y + FRAME_T + l / 2, x - 1, y + FRAME_T + l); c.stroke(); c.strokeStyle = p.accent2; c.lineWidth = 1; c.stroke(); c.fillStyle = p.accent2; c.strokeStyle = p.edge; c.lineWidth = 1; c.beginPath(); c.ellipse(x + 3, y + FRAME_T + l * 0.7, 4, 2, 0.8, 0, 6.283); c.fill(); c.stroke(); }
  }
};

function ringPath(c, x, y, w, h, t) {
  c.beginPath(); rrPath(c, x, y, w, h, 14); rrPath(c, x + t, y + t, w - 2 * t, h - 2 * t, 5);
}

// Offscreen frame for an outer size w x h (stage px). Draw it at (x - FRAME_M, y - FRAME_M, w + 2M, h + 2M).
export function buildFrame(theme, w, h, scale = 1) {
  const M = FRAME_M, T = FRAME_T, p = theme.palette, r = rng01(seedOf(theme.id) ^ 0x51);
  const cv = document.createElement('canvas');
  cv.width = Math.ceil((w + 2 * M) * scale); cv.height = Math.ceil((h + 2 * M) * scale);
  const c = cv.getContext('2d'); c.setTransform(scale, 0, 0, scale, 0, 0);
  const R = { x: M, y: M, w, h };
  // base material
  c.save(); ringPath(c, M, M, w, h, T);
  const g = c.createLinearGradient(0, M, 0, M + h); g.addColorStop(0, p.light); g.addColorStop(0.35, p.base); g.addColorStop(1, p.dark);
  c.fillStyle = g; c.fill('evenodd'); c.clip('evenodd');
  TEXTURES[theme.material](c, R, p, r);
  if (theme.glow) for (const gx of [M + 10, M + w - 10]) { const rg = c.createRadialGradient(gx, M + 8, 0, gx, M + 8, 40); rg.addColorStop(0, rgba(theme.glow, 0.55)); rg.addColorStop(1, rgba(theme.glow, 0)); c.fillStyle = rg; c.fillRect(M, M, w, 60); }
  c.restore();
  // bevels and outline
  c.lineJoin = 'round';
  c.strokeStyle = p.edge; c.lineWidth = 3; c.beginPath(); rrPath(c, M, M, w, h, 14); c.stroke(); c.beginPath(); rrPath(c, M + T, M + T, w - 2 * T, h - 2 * T, 5); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.32)'; c.lineWidth = 1.5; c.beginPath(); rrPath(c, M + 2.5, M + 2.5, w - 5, h - 5, 12); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.beginPath(); rrPath(c, M + T - 1.5, M + T - 1.5, w - 2 * T + 3, h - 2 * T + 3, 5); c.stroke();
  // trim along the ring centre line, skipping the corners
  const trim = TRIMS[theme.trim], mid = T / 2, step = 17; let i = 0;
  for (let x = M + 28; x <= M + w - 28; x += step, i++) { trim(c, p, x, M + mid, 0, i); trim(c, p, x, M + h - mid, 0, i + 1); }
  for (let y = M + 28; y <= M + h - 28; y += step, i++) { trim(c, p, M + mid, y, Math.PI / 2, i); trim(c, p, M + w - mid, y, Math.PI / 2, i + 1); }
  // top-edge extras
  if (theme.cap) CAPS[theme.cap](c, p, M, M + w, M, r);
  // corners (mirrored)
  const corner = CORNERS[theme.corner];
  for (const [sx, sy, ox, oy] of [[1, 1, M, M], [-1, 1, M + w, M], [1, -1, M, M + h], [-1, -1, M + w, M + h]]) { c.save(); c.translate(ox, oy); c.scale(sx, sy); c.lineJoin = 'round'; corner(c, p); c.restore(); }
  return cv;
}

// ---- plaques and plates ----------------------------------------------------------------------------
function plaquePath(c, shape, x, y, w, h, r) {
  c.beginPath();
  if (shape === 'notch') { const k = Math.min(12, h / 3); c.moveTo(x + k, y); c.lineTo(x + w - k, y); c.lineTo(x + w, y + k); c.lineTo(x + w, y + h - k); c.lineTo(x + w - k, y + h); c.lineTo(x + k, y + h); c.lineTo(x, y + h - k); c.lineTo(x, y + k); c.closePath(); }
  else if (shape === 'arch') { const a = Math.min(h * 0.45, 24); c.moveTo(x, y + h - 8); c.lineTo(x, y + a); c.quadraticCurveTo(x, y, x + a, y); c.lineTo(x + w - a, y); c.quadraticCurveTo(x + w, y, x + w, y + a); c.lineTo(x + w, y + h - 8); c.quadraticCurveTo(x + w, y + h, x + w - 8, y + h); c.lineTo(x + 8, y + h); c.quadraticCurveTo(x, y + h, x, y + h - 8); c.closePath(); }
  else if (shape === 'ragged') { c.moveTo(x + 6, y + 2); for (let i = 1; i <= 9; i++) c.lineTo(x + 6 + ((w - 12) * i) / 9, y + (i % 2 ? 0 : 3.5) + r() * 1.5); c.lineTo(x + w, y + h / 2 + r() * 3); c.lineTo(x + w - 5, y + h - 1); for (let i = 8; i >= 0; i--) c.lineTo(x + 6 + ((w - 12) * i) / 9, y + h - (i % 2 ? 0 : 3.5) - r() * 1.5); c.lineTo(x, y + h / 2 + r() * 3); c.closePath(); }
  else rrPath(c, x, y, w, h, 12);
}

// Plaque in the era's material. opts.dark = darker variant under text (era name plaques). Draw at x,y,w,h.
export function drawPlaque(c, theme, x, y, w, h, opts = {}) {
  const p = theme.palette, r = rng01(seedOf(theme.id) ^ 0x77);
  c.save();
  plaquePath(c, theme.plaque, x, y, w, h, r);
  const top = opts.dark ? mix(p.base, '#06101C', 0.6) : p.light, bot = opts.dark ? mix(p.dark, '#06101C', 0.45) : p.dark;
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, top); g.addColorStop(1, bot);
  c.fillStyle = g; c.fill(); c.save(); c.clip();
  c.globalAlpha = opts.dark ? 0.55 : 1; TEXTURES[theme.material](c, { x, y, w, h }, p, rng01(seedOf(theme.id) ^ 0x33)); c.restore();
  c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = p.edge; plaquePath(c, theme.plaque, x, y, w, h, rng01(seedOf(theme.id) ^ 0x77)); c.stroke();
  c.lineWidth = 1.4; c.strokeStyle = opts.dark ? rgba(p.accent, 0.55) : 'rgba(255,255,255,.4)';
  plaquePath(c, theme.plaque, x + 3.5, y + 3.5, w - 7, h - 7, rng01(seedOf(theme.id) ^ 0x78)); c.stroke();
  for (const [px, py] of [[x + 8, y + h / 2], [x + w - 8, y + h / 2]]) { c.fillStyle = p.accent; c.strokeStyle = p.edge; c.lineWidth = 1; c.beginPath(); c.arc(px, py, 2.4, 0, 6.283); c.fill(); c.stroke(); }
  c.restore();
}

// HUD plate across the top of the stage (0..360 x 0..56).
export function drawHudPlate(c, theme, w = 360, h = 56) {
  const p = theme.palette, hc = hudColors(theme);
  c.save();
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, hc.top); g.addColorStop(1, hc.bottom);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip(); c.globalAlpha = 0.5; TEXTURES[theme.material](c, { x: 0, y: 0, w, h }, p, rng01(seedOf(theme.id) ^ 0x99)); c.restore();
  c.fillStyle = p.edge; c.fillRect(0, h - 4, w, 4);
  c.fillStyle = p.base; c.fillRect(0, h - 4, w, 2);
  c.fillStyle = rgba(p.accent, 0.55); for (let x = 8; x < w; x += 16) c.fillRect(x, h - 3, 6, 1.5);
  c.restore();
}

// Small cached data-URL plaque for DOM backgrounds (Home era cards, Dig site title).
const urlCache = {};
export function plaqueUrl(eraId, w, h, opts = { dark: true }) {
  const key = `${eraId}|${w}|${h}|${!!opts.dark}|${getArtVersion()}|${slotReady('hud-plaque')}`;
  if (urlCache[key]) return urlCache[key];
  const th = themeFor(eraId), s = 2, cv = document.createElement('canvas');
  cv.width = w * s; cv.height = h * s;
  const c = cv.getContext('2d'); c.scale(s, s);
  if (!drawSlot(c, 'hud-plaque', 2, 2, w - 4, h - 4)) drawPlaque(c, th, 2, 2, w - 4, h - 4, opts);   // painted stone plaque when available
  return (urlCache[key] = cv.toDataURL('image/png'));
}

// ---- ambient particles (skipped by the caller under reduced motion) ------------------------------
const ambientCache = {};
export function drawAmbient(c, theme, rect, now) {
  const a = theme.ambient; if (!a) return;
  const ps = ambientCache[theme.id + a.kind + a.count] ||= (() => { const r = rng01(seedOf(theme.id) ^ 0xa1); return Array.from({ length: a.count }, () => ({ x: r(), y: r(), s: 0.4 + r() * 0.8, r: 1 + r() * 2.2, ph: r() * 6.28 })); })();
  const t = now / 1000;
  for (const q of ps) {
    let px, py;
    if (a.kind === 'snow') { px = rect.x + ((q.x + Math.sin(t * 0.6 + q.ph) * 0.02) % 1 + 1) % 1 * rect.w; py = rect.y + ((q.y + t * 0.03 * q.s) % 1) * rect.h; }
    else if (a.kind === 'bubble' || a.kind === 'ember') { px = rect.x + q.x * rect.w + Math.sin(t + q.ph) * 4; py = rect.y + rect.h - ((q.y + t * 0.035 * q.s) % 1) * rect.h; }
    else { px = rect.x + ((q.x + t * 0.012 * q.s) % 1) * rect.w; py = rect.y + q.y * rect.h + Math.sin(t * 0.8 + q.ph) * 5; }
    c.globalAlpha = 0.55 + 0.35 * Math.sin(t * 2 + q.ph);
    if (a.kind === 'bubble') { c.strokeStyle = a.color; c.lineWidth = 1; c.beginPath(); c.arc(px, py, q.r + 1, 0, 6.283); c.stroke(); }
    else { if (a.kind === 'ember') { c.shadowColor = a.color; c.shadowBlur = 6; } c.fillStyle = a.color; c.beginPath(); c.arc(px, py, q.r, 0, 6.283); c.fill(); c.shadowBlur = 0; }
  }
  c.globalAlpha = 1;
}
export { ringPath };
