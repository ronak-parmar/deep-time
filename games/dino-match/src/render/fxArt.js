// Painted effect frames (art/fx/<sheet>.webp, cut from the owner's sheets art/sheets/fx-*.png by tools/prep-fx-sheet.py). Each file is a
// matted ATLAS on the sheet's own grid; the frames of one effect are played across its life (motion.js FX). Every effect is optional:
// when its atlas is missing or not loaded yet the callers draw the code look (specials.js drawFx, the particle pool). None under
// reduced motion. Loaded lazily after boot (preloadFx), never on the loading screen.
import { load, peek } from './art.js';
import { FX } from './motion.js';
import { reducedMotion } from '../ui/motion.js';

// sheet -> grid; effect -> sheet, first frame, frame count, blend ('lighter' = additive glow, else drawn over)
const SHEETS = {
  explosion: { file: 'fx/explosion.webp', cols: 4, rows: 4 },
  beam:      { file: 'fx/beam.webp', cols: 1, rows: 8 },
  rainbow:   { file: 'fx/rainbow.webp', cols: 4, rows: 4 },
  small:     { file: 'fx/small.webp', cols: 6, rows: 4 }
};
export const EFFECTS = {
  explosion: { sheet: 'explosion', from: 0, n: 16 },
  beam:      { sheet: 'beam', from: 0, n: 8, blend: 'lighter' },
  rainbow:   { sheet: 'rainbow', from: 0, n: 16, blend: 'lighter' },
  sparkle:   { sheet: 'small', from: 0, n: 6, blend: 'lighter' },   // additive: no brown halo round the star
  dust:      { sheet: 'small', from: 6, n: 6 },
  chips:     { sheet: 'small', from: 12, n: 6 },
  confetti:  { sheet: 'small', from: 18, n: 6 }
};

let started = null;
export const preloadFx = () => (started ||= Promise.all(Object.values(SHEETS).map((s) => load(s.file))));
const img = (name) => peek(SHEETS[EFFECTS[name].sheet].file);
// painted frames can be used now (loaded, art on, motion on)
export const fxReady = (name) => !!img(name) && !reducedMotion();

// Draw effect `name` at progress t (0..1) centred at x, y, w x h (rot: radians). Frames cross-fade so few frames still play smoothly.
// fade: extra alpha (the tail fade-out). Returns false when the art is missing (caller draws the fallback).
export function drawFxFrame(c, name, t, x, y, w, h, { rot = 0, alpha = 1, clip = null } = {}) {
  const e = EFFECTS[name], im = img(name); if (!im) return false;
  const s = SHEETS[e.sheet], fw = im.width / s.cols, fh = im.height / s.rows;
  const f = Math.max(0, Math.min(e.n - 1, t * (e.n - 1))), i = Math.floor(f), k = f - i;
  c.save(); c.translate(x, y); if (rot) c.rotate(rot);
  if (clip) { c.beginPath(); c.rect(clip[0], clip[1], clip[2], clip[3]); c.clip(); }
  if (e.blend) c.globalCompositeOperation = e.blend;
  const one = (j, a) => {
    if (a <= 0.003) return; const n = e.from + j, sx = (n % s.cols) * fw, sy = Math.floor(n / s.cols) * fh;
    c.globalAlpha = a * alpha; c.drawImage(im, sx, sy, fw, fh, -w / 2, -h / 2, w, h);
  };
  one(i, 1 - k); if (i + 1 < e.n) one(i + 1, k);
  c.restore(); return true;
}
// tail fade: full alpha until FX.tail of the life, then eases out (the last smoke frames clear quicker)
export const tailFade = (t) => (t <= FX.tail ? 1 : Math.max(0, 1 - ((t - FX.tail) / (1 - FX.tail)) ** 1.5));

// One-shot sprite effects (sparkle / dust / chips / confetti) in their own little list; board and dig site share it.
// add() returns false when the art cannot play (missing, reduced motion): the caller keeps the particle look.
export class SpriteFx {
  constructor() { this.list = []; }
  add(name, x, y, size, now, { rot = 0, life = FX.small[name], alpha = 1 } = {}) {
    if (!fxReady(name)) return false;
    this.list.push({ name, x, y, size, t0: now, life, rot, alpha }); return true;
  }
  draw(c, now) {
    let w = 0;
    for (const f of this.list) {
      const t = (now - f.t0) / f.life; if (t > 1) continue; this.list[w++] = f; if (t < 0) continue;
      drawFxFrame(c, f.name, t, f.x, f.y, f.size, f.size, { rot: f.rot, alpha: f.alpha * tailFade(t) });
    }
    this.list.length = w;
  }
  clear() { this.list.length = 0; }
}
