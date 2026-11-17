// THE motion standard (docs/09-motion-and-feel.md). Every duration, easing, stagger, squash, shake and
// particle number in the game lives here, so one edit retunes everything. Era themes never change timing.
// Nothing outside this file (and sound.js) may hardcode a duration or easing: tests/motion.test.js enforces it.
import { reducedMotion } from '../ui/motion.js';

// ---- 3. tokens ---------------------------------------------------------------------------------
export const D = { instant: 80, quick: 140, base: 220, slow: 360, dramatic: 600, celebrate: 900 };
export const STAGGER = { column: 40, list: 80, reward: 120 };
export const SQUASH = { pop: 1.15, landTall: 0.88, landWide: 1.12, tapScale: 1.08, pressScale: 0.96 };
export const SHAKE = {
  tiny: { px: 2, ms: 100 }, small: { px: 4, ms: 160 }, medium: { px: 6, ms: 220 }, big: { px: 9, ms: 320 }
};
export const PARTICLES = {
  max: 200,
  sparkle: { min: 6, max: 10, life: 450 },
  dust: { min: 8, max: 12, life: 600 },
  confetti: { min: 30, max: 60, life: 1200 },
  shard: { count: 3, life: 520 }
};
export const SWAP = { overshoot: 0.04 };
export const FALL = { settleAmp: 0.12, settleAt: 0.8, maxCells: 4 };   // settle bounce = 12% of fall height, once
export const HOLD = { lastBlock: 120, banner: 220, skipAfter: 600 };   // last-block hold, banner hold, huge-reward skip gate
export const HINT_AFTER = 6000;                                         // idle ms before the hint pulses
export const LOOP = { hint: 160, ambient: 1000, scene: 12000 };                        // loop periods for looping ambient / hint

// ---- easings -----------------------------------------------------------------------------------------
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
  const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const e = X(t) - x; if (Math.abs(e) < 1e-5) break; const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    let lo = 0, hi = 1; if (t < 0 || t > 1) { t = x; for (let i = 0; i < 20; i++) { if (X(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; } }
    return Y(t);
  };
}
const outFn = bezier(0.2, 0, 0, 1), inFn = bezier(0.4, 0, 1, 1), popFn = bezier(0.34, 1.56, 0.64, 1);
// swap glide: ease out with a small overshoot (back-ease whose peak is SWAP.overshoot)
function solveBack(peak) {
  const f = (s, t) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  const maxOf = (s) => { let m = 0; for (let t = 0; t <= 1; t += 0.005) m = Math.max(m, f(s, t)); return m - 1; };
  let lo = 0, hi = 4; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (maxOf(mid) < peak) lo = mid; else hi = mid; }
  const s = (lo + hi) / 2; return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : f(s, t));
}
const glideFn = solveBack(SWAP.overshoot);
// fall: ease-in quadratic to the landing, then one settle bounce. Returns the fraction of the fall height.
// u in 0..1; the squash phase after landing is exposed via fallSquash(u).
function fallFn(u) {
  const L = FALL.settleAt;
  if (u <= 0) return 0;
  if (u < L) { const k = u / L; return k * k; }
  const s = (u - L) / (1 - L);
  return 1 - FALL.settleAmp * Math.sin(Math.PI * s) * (1 - s);
}
export const EASE = { out: outFn, in: inFn, pop: popFn, glide: glideFn, fall: fallFn, linear: (t) => t };
export const EASE_CSS = { out: 'cubic-bezier(0.2, 0, 0, 1)', in: 'cubic-bezier(0.4, 0, 1, 1)', pop: 'cubic-bezier(0.34, 1.56, 0.64, 1)' };
// squash factor after landing: 0 before landing, 1..0 over the settle phase
export const fallSquash = (u) => (u < FALL.settleAt ? 0 : Math.sin(Math.PI * Math.min(1, (u - FALL.settleAt) / (1 - FALL.settleAt))));

// ---- 8. reduced motion: durations halved, no shake, no particles, no ambient loops, banners fade only ------
export const dur = (ms) => (reducedMotion() ? Math.round(ms / 2) : ms);
export const shakeOf = (k) => (reducedMotion() ? null : SHAKE[k]);
export const particleCount = (kind, n) => {
  if (reducedMotion()) return 0;
  const p = PARTICLES[kind]; return Math.max(p.min ?? 0, Math.min(p.max ?? n, n));
};
export const DEBUG = { timeScale: 1 };

// ---- 4. event recipes: the one place events map to motion --------------------------------------------------
// Fields are token NAMES or numbers built from tokens; sound.js maps the same event names to sound + haptic.
export const RECIPES = {
  tapGem:        { dur: D.quick, ease: 'out', scale: SQUASH.tapScale },
  swapValid:     { dur: D.base, ease: 'glide' },
  swapInvalid:   { dur: D.base, ease: 'glide', shake: 'tiny' },
  matchClear:    { dur: D.base, ease: 'pop', pop: SQUASH.pop, particles: 'sparkle' },
  fallRefill:    { dur: D.slow, ease: 'fall', stagger: STAGGER.column, squash: [SQUASH.landWide, SQUASH.landTall] },
  cascadeStep:   { dur: D.base, ease: 'pop', particles: 'sparkle', comboFrom: 2 },
  digBlock:      { dur: D.base, ease: 'in', particles: 'dust', shards: PARTICLES.shard.count, shake: 'small' },
  lastBlock:     { dur: D.slow, ease: 'out', hold: HOLD.lastBlock, shake: 'big', flash: D.quick },
  foundBanner:   { dur: D.slow, ease: 'pop', hold: HOLD.banner, leave: D.base, leaveEase: 'in' },
  winScreen:     { dur: D.slow, ease: 'out', stagger: STAGGER.reward, count: D.slow },
  loseScreen:    { dur: D.base, ease: 'out' },
  pickaxeSpend:  { dur: D.base, ease: 'in', reveal: D.slow, shake: 'small', particles: 'dust' },
  fossilComplete:{ dur: D.dramatic, ease: 'out', shake: 'big', particles: 'confetti', skipAfter: HOLD.skipAfter },
  buttonPress:   { dur: D.instant, ease: 'out', scale: SQUASH.pressScale, release: D.quick, releaseEase: 'pop' },
  screenChange:  { dur: D.base, ease: 'out', leave: D.quick, slide: 16 },
  counterChange: { dur: D.slow, ease: 'out', pulse: SQUASH.tapScale },
  lifeRegained:  { dur: D.base, ease: 'pop' },
  // phase A additions (docs/09 section 4 rows added with them)
  hitBlock:      { dur: D.quick, ease: 'out', particles: 'dust', shards: 2, shake: 'tiny' },
  createSpecial: { dur: D.base, ease: 'pop', pop: SQUASH.pop, particles: 'sparkle' },
  fireSpecial:   { dur: D.slow, ease: 'out', shake: 'medium', particles: 'sparkle', stagger: STAGGER.list },
  // phase B additions (obstacles)
  obstacleHit:   { dur: D.quick, ease: 'out', particles: 'dust', shards: 2, shake: 'tiny' },
  obstacleBreak: { dur: D.base, ease: 'in', particles: 'dust', shards: PARTICLES.shard.count, shake: 'small' },
  collectItem:   { dur: D.slow, ease: 'pop', pop: SQUASH.pop, particles: 'sparkle' },
  tarSpread:     { dur: D.slow, ease: 'out', shake: 'tiny' },
  lavaErupt:     { dur: D.slow, ease: 'out', shake: 'medium', particles: 'dust' },
  targetPop:     { dur: D.base, ease: 'pop', pop: SQUASH.pop },
  targetDone:    { dur: D.slow, ease: 'pop', pop: SQUASH.pop },
  // boosters (docs/16)
  boosterSelect: { dur: D.quick, ease: 'pop', pop: SQUASH.pop },
  boosterUse:    { dur: D.slow, ease: 'out', particles: 'sparkle', shake: 'small', stagger: STAGGER.column }
};
export const EVENTS = Object.keys(RECIPES);

// ---- helpers used by DOM screens --------------------------------------------------------------------------
export const sleep = (ms) => new Promise((res) => setTimeout(res, dur(ms)));
export function cssVars() {
  const v = [];
  for (const [k, ms] of Object.entries(D)) v.push(`--m-${k}:${ms}ms`);
  for (const [k, ms] of Object.entries(STAGGER)) v.push(`--m-stagger-${k}:${ms}ms`);
  for (const [k, e] of Object.entries(EASE_CSS)) v.push(`--m-ease-${k}:${e}`);
  v.push(`--m-slide:${RECIPES.screenChange.slide}px`, `--m-press:${SQUASH.pressScale}`, `--m-pop:${SQUASH.pop}`, `--m-tap:${SQUASH.tapScale}`);
  return `:root{${v.join(';')}}@media (prefers-reduced-motion:reduce){:root{${Object.entries(D).map(([k, ms]) => `--m-${k}:${Math.round(ms / 2)}ms`).join(';')}}}`;
}

// Count a number up/down in an element over the counterChange recipe; pulses the element when it ends.
export function roll(el, from, to, fmt = (n) => String(n), ms = RECIPES.counterChange.dur) {
  const total = dur(ms);
  if (!total || from === to) { el.textContent = fmt(to); return Promise.resolve(); }
  return new Promise((res) => {
    let t0 = -1;
    const step = (now) => {
      if (t0 < 0) t0 = now;
      const k = Math.min(1, (now - t0) / total);
      el.textContent = fmt(Math.round(from + (to - from) * EASE.out(k)));
      if (k < 1) requestAnimationFrame(step);
      else { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); res(); }
    };
    requestAnimationFrame(step);
  });
}
