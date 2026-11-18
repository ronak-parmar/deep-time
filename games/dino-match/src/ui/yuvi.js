// Yuvi, the helper dino: nine drawn pose frames (art/mascot/dino-<frame>.webp, 720 x 700, transparent, all aligned: feet baseline at
// y = 680, hat centre at x = 360) with whole-body motion on top. The motion is ported 1:1 from preview/yuvi-lab.html, the version the
// owner approved: idle bob and squash, talk flips the talk / idle frames at 5 Hz, wave sway, point lean, cheer hop with sparkles,
// think tilt, dig swing with rock chips (pickaxe on his right, chips fly right), sad droop + desaturate, surprised hop, walk waddle (idle frame, flipped when walking left),
// a squash-pop whenever the pose frame changes, and a speech bubble.
// The lab numbers are in px for a 350 px tall frame box; here they are scaled to the box (k = box height / 350).
//
// Drawing: nine stacked <img> (preloaded), only the current one is visible; per animation frame we write ONE transform on the body and
// one on the shadow (no layout reads). Reduced motion: no bob, hop, sway, walk or pop, no particles, the text appears at once; only
// the pose swaps.
// (The old rig puppet in ui/mascot.js + art/mascot/rig/* is kept but unused.)
import { h } from './dom.js';
import { YUVI, EASE } from '../render/motion.js';

const files = import.meta.glob('../../../../art/mascot/dino-{idle,wave,point,cheer,think,dig,sad,surprised,talk}.webp', { eager: true, query: '?url', import: 'default' });
export const FRAME_URLS = Object.fromEntries(Object.entries(files).map(([p, u]) => [p.split('/').pop().replace(/^dino-|\.webp$/g, ''), u]));
export const FRAMES = ['idle', 'wave', 'point', 'cheer', 'think', 'dig', 'sad', 'surprised', 'talk'];
// action -> frame(s) it draws (talk alternates two)
export const ACTION_FRAMES = { idle: ['idle'], talk: ['talk', 'idle'], wave: ['wave'], point: ['point'], cheer: ['cheer'], think: ['think'], dig: ['dig'], sad: ['sad'], surprised: ['surprised'], walk: ['idle'] };
export const ACTIONS = Object.keys(ACTION_FRAMES);
// the frame box (720 x 700) and where the drawing sits in it
export const BOX = { w: 720, h: 700, feet: 680, top: 88, left: 187 / 720, right: 620 / 720 };
const LAB_H = 350;   // the lab drew the box 350 px tall: its motion px are for that size

const S = Math.sin, PI = Math.PI;
// ---- the lab's motion, verbatim (t in seconds) -------------------------------------------------------------------------------
const LAB = {
  idle: { f: 'idle', m: (t) => ({ y: -2 * Math.abs(S(t * 2.2)), sy: 1 + 0.015 * S(t * 4.4), r: 0.8 * S(t * 1.1) }) },
  talk: { f: (t) => (Math.floor(t * 5) % 2 ? 'talk' : 'idle'), m: (t) => ({ y: -2 * Math.abs(S(t * 5)), r: 1.5 * S(t * 2.5) }) },
  wave: { f: 'wave', m: (t) => ({ r: 3 * S(t * 7), y: -2 * Math.abs(S(t * 3.5)) }) },
  point: { f: 'point', m: (t) => ({ x: 6 * Math.abs(S(t * 3)), r: 2 }) },
  cheer: { f: 'cheer', spark: 1, m: (t) => { const c = (t % 0.8) / 0.8, hh = Math.max(0, S(c * PI)); return { y: -60 * hh, sy: 1 + 0.06 * hh - (c < 0.06 || c > 0.94 ? 0.1 : 0), sx: 1 - 0.04 * hh + (c < 0.06 || c > 0.94 ? 0.08 : 0) }; } },
  think: { f: 'think', m: (t) => ({ r: -3 + 1.5 * S(t * 1.4), y: -1.5 * Math.abs(S(t * 1.4)) }) },
  dig: { f: 'dig', chips: 1, m: (t) => { const c = (t % 0.9) / 0.9; const r = c < 0.5 ? 6 * (c / 0.5) : 6 - 16 * Math.min(1, (c - 0.5) / 0.15); return { r: c > 0.65 ? -10 + 10 * ((c - 0.65) / 0.35) : r, y: c > 0.62 && c < 0.72 ? 3 : 0 }; } },
  sad: { f: 'sad', tint: 1, m: (t) => ({ y: 2 + 1.5 * S(t * 1.2), sy: 0.98, sx: 1.02, r: -1 }) },
  surprised: { f: 'surprised', m: (t) => { const c = (t % 1.6) / 1.6, hh = c < 0.3 ? S(c / 0.3 * PI) : 0; return { y: -40 * hh, sy: c < 0.04 ? 0.9 : 1 + 0.06 * hh, sx: c < 0.04 ? 1.08 : 1 }; } },
  walk: { f: 'idle', m: (t) => { const w = S(t * 8); return { y: -6 * Math.abs(w), r: 4 * w }; } }
};
const STILL = { x: 0, y: 0, r: 0, sx: 1, sy: 1 };

// Pure: which frame an action shows at time t.
export function frameAt(action, t) { const A = LAB[action] || LAB.idle; return typeof A.f === 'function' ? A.f(t) : A.f; }
// Pure: the body motion at time t, in lab px. opts: { reduced, dir: 'right' (default: the drawing points right) | 'left', big (3-star cheer) }.
// Reduced motion returns the still pose for every action and time.
export function motionAt(action, t, { reduced = false, dir = 'right', big = false } = {}) {
  if (reduced) return { ...STILL, flip: dir === 'left' && action === 'point' };
  const A = LAB[action] || LAB.idle, m = { ...STILL, ...A.m(t) };
  if (big && action === 'cheer') m.y *= 1.6;   // 3 stars: an extra-big hop
  const flip = action === 'walk' ? dir === 'left' : action === 'point' && dir === 'left';   // the drawing points right; mirrored only for a target on the left (walking left is flipped too, as in the lab)
  if (flip && action === 'point') { m.x = -m.x; m.r = -m.r; }
  return { ...m, flip };
}
// Pure: the CSS transform for a motion, k = box px per lab px, pop = 0..1 progress of the pose-change squash-pop (1 = done).
export function transformOf(m, k = 1, pop = 1) {
  const ps = 1 + 0.08 * S(Math.min(1, pop) * PI);
  return `translate(${((m.x || 0) * k).toFixed(2)}px,${((m.y || 0) * k).toFixed(2)}px) rotate(${(m.r || 0).toFixed(2)}deg) scale(${((m.sx || 1) * (m.flip ? -1 : 1) * ps).toFixed(4)},${((m.sy || 1) / ps).toFixed(4)})`;
}
export const tinted = (action) => !!(LAB[action] && LAB[action].tint);

let preloaded = null;
export function preloadYuvi() {
  if (!preloaded) preloaded = Promise.all(FRAMES.map((f) => new Promise((res) => { const im = new Image(); im.onload = im.onerror = () => res(im); im.src = FRAME_URLS[f] || ''; })));
  return preloaded;
}

// createYuvi(container, { size, reduced }) -> { el, play(action, { say, duration, dir, big, then }), say(text, opts), hide(), show(), ... }
// size = drawn height of Yuvi in px (feet to hat). reduced = boolean or function (read live).
export function createYuvi(container, { size = 118, reduced = false } = {}) {
  preloadYuvi();
  const isReduced = typeof reduced === 'function' ? reduced : () => !!reduced;
  const boxH = size * BOX.h / (BOX.feet - BOX.top), boxW = boxH * BOX.w / BOX.h, k = boxH / LAB_H;
  const imgs = new Map(FRAMES.map((f) => [f, h('img', { class: 'yuvi__f', src: FRAME_URLS[f], alt: '', draggable: 'false', 'data-f': f })]));
  const body = h('div', { class: 'yuvi__body' }, ...imgs.values());
  const shadow = h('div', { class: 'yuvi__shadow' });
  const head = h('b', { class: 'yuvi__name' }, 'Yuvi'), shown = h('span', {}), rest = h('span', { class: 'yuvi__rest', 'aria-hidden': 'true' });
  const text = h('span', { class: 'yuvi__text' }, shown, rest);
  const bubble = h('div', { class: 'yuvi__bubble', role: 'status', 'aria-live': 'polite', hidden: true, onClick: (e) => { e.stopPropagation(); tapBubble(); } }, head, text);
  const fxLayer = h('div', { class: 'yuvi__fx', 'aria-hidden': 'true' });
  const el = h('div', { class: 'yuvi', hidden: true, 'aria-label': 'Yuvi, your helper dino', style: { width: boxW + 'px', height: boxH + 'px', '--yuvi-w': boxW + 'px', '--yuvi-h': boxH + 'px' } }, shadow, body, fxLayer, bubble);
  container.append(el);
  // the drawing's left edge sits at x = 4 px of the container
  el.style.left = (4 - BOX.left * boxW) + 'px';

  let action = 'idle', opts = {}, t0 = 0, popAt = -1e9, frame = '', raf = 0, alive = true, visible = false, walking = null, typing = null, onTap = null, lastFx = 0, fxCount = 0;
  const fx = [];   // pooled particles: { el, x, y, vx, vy, g, life, age }
  const now = () => performance.now();

  function setFrame(f) {
    if (f === frame) return;
    if (frame) imgs.get(frame)?.classList.remove('on');
    imgs.get(f)?.classList.add('on'); frame = f;
  }
  function spawn(cls, x, y, vx, vy, g, color) {
    if (fx.length >= 60) return;
    const d = h('i', { class: 'yuvi__p ' + cls }); if (color) d.style.background = color;
    fxLayer.append(d); fx.push({ el: d, x, y, vx, vy, g, age: 0 });
  }
  function tick() {
    if (!alive) return;
    raf = 0;
    if (!visible) return;
    const n = now(), t = (n - t0) / 1000, red = isReduced();
    let m;
    if (walking) {
      const u = Math.min(1, (n - walking.t0) / walking.ms);
      m = red ? { ...STILL } : motionAt('walk', t);
      m.flip = !red && walking.dir < 0;
      const off = -(boxW * 0.9);   // fully off the left edge
      m.x = (walking.dir > 0 ? off * (1 - EASE.out(u)) : off * EASE.in(u)) / k;   // ease out to arrive, ease in to leave (docs/09)
      setFrame('idle');
      if (u >= 1) { const w = walking; walking = null; w.done(); }
    } else {
      m = motionAt(action, t, { reduced: red, dir: opts.dir, big: opts.big });
      setFrame(frameAt(action, red ? 0 : t));
    }
    const pop = red ? 1 : (n - popAt) / YUVI.swapPop;
    body.style.transform = transformOf(m, k, pop);
    shadow.style.transform = `translateX(${((m.x || 0) * k).toFixed(1)}px) scale(${(1 + Math.min(0, m.y || 0) / 180).toFixed(3)})`;
    // particles (lab: sparkles above the head while cheering, rock chips at the pickaxe strike while digging)
    if (!red && !walking) {
      const A = LAB[action];
      if (A.spark && (fxCount++ % YUVI.sparkleEvery === 0)) spawn('yuvi__sp', boxW / 2 + (Math.random() - 0.5) * 220 * k, boxH * 0.97 - 250 * k, (Math.random() - 0.5) * 30 * k, -40 * k, 0);
      if (A.chips) { const c = (t % 0.9) / 0.9; if (c > 0.64 && c < 0.7 && n - lastFx > YUVI.swapPop) { lastFx = n; for (let i = 0; i < 3; i++) spawn('yuvi__chip', boxW / 2 + 110 * k + (Math.random() - 0.5) * 30 * k, boxH * 0.97 - 20 * k, (Math.random() - 0.5) * 200 * k, (-180 - Math.random() * 100) * k, 700 * k); } }
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const p = fx[i]; p.age += 1 / 60; p.vy += p.g / 60; p.x += p.vx / 60; p.y += p.vy / 60;
      const life = p.life || YUVI.fxLife / 1000;
      if (p.age >= life || red) { p.el.remove(); fx.splice(i, 1); continue; }
      p.el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)${p.spin ? ` rotate(${(p.age * p.spin).toFixed(0)}deg)` : ''}`; p.el.style.opacity = String(1 - p.age / life);
    }
    // typing
    if (typing) {
      const nChars = red ? typing.text.length : Math.floor((n - typing.t0) / YUVI.typeChar);
      if (typing.talk && !typing.talked && nChars >= 0) { typing.talked = true; play('talk', { dir: opts.dir }); }   // talk while the text types
      if (nChars !== typing.n) { typing.n = Math.min(nChars, typing.text.length); shown.textContent = typing.text.slice(0, typing.n); rest.textContent = typing.text.slice(typing.n); }
      if (typing.n >= typing.text.length) { const ty = typing; typing = null; ty.done(); }
    }
    raf = requestAnimationFrame(tick);
  }
  const run = () => { if (!raf && alive && visible) raf = requestAnimationFrame(tick); };

  function play(a, { say: line, duration, dir = 'right', big = false, then, talk } = {}) {
    if (!ACTION_FRAMES[a]) a = 'idle';
    if (a !== action || dir !== opts.dir) popAt = now();
    action = a; opts = { dir, big }; t0 = now();
    el.classList.toggle('yuvi--sad', tinted(a));
    if (visible) run();
    const p = [];
    if (line != null) p.push(say(line, { talk }));
    if (duration) p.push(new Promise((res) => setTimeout(res, duration)).then(() => { if (action === a && then) play(then, { dir }); }));
    return Promise.all(p);
  }
  // Show a line in the bubble; it types out (tap: finish typing, then tap again = onTap). talk: true = talk pose while it types, then
  // back to `after` (default idle). Resolves when the whole line is shown.
  function say(line, { talk = false, after = 'idle', tap = null, delay = 0 } = {}) {
    onTap = tap;
    if (typing) { const ty = typing; typing = null; ty.done(); }
    if (!line) { bubble.hidden = true; bubble.classList.remove('on'); return Promise.resolve(); }
    shown.textContent = ''; rest.textContent = line; bubble.hidden = false;
    bubble.classList.remove('on'); void bubble.offsetWidth; bubble.classList.add('on');
    return new Promise((res) => {
      typing = { text: line, n: -1, t0: now() + YUVI.bubbleDelay + delay, talk, talked: false,
        done: () => { shown.textContent = line; rest.textContent = ''; if (talk && action === 'talk') play(after, { dir: opts.dir }); res(); } };
      run(); if (!visible) { const ty = typing; typing = null; ty.done(); }
    });
  }
  // the bubble's height (game px) for a line, without showing it (cards are placed above Yuvi before he speaks)
  function measure(line) {
    const wasHidden = el.hidden, bh = bubble.hidden, a = shown.textContent, b = rest.textContent;
    el.style.visibility = 'hidden'; el.hidden = false; bubble.hidden = false; shown.textContent = ''; rest.textContent = line;
    const hgt = bubble.offsetHeight;
    shown.textContent = a; rest.textContent = b; bubble.hidden = bh; el.hidden = wasHidden; el.style.visibility = '';
    return hgt;
  }
  function skip() { if (typing) { const ty = typing; typing = null; ty.done(); return true; } return false; }
  function tapBubble() { if (skip()) return; const f = onTap; if (f) f(); }
  function walk(dir) {
    return new Promise((res) => {
      if (isReduced()) return res();
      walking = { dir, t0: now(), ms: YUVI.walk, done: res }; run();
    });
  }
  async function show({ walk: w = true } = {}) {
    if (visible && !walking) return;
    el.hidden = false; visible = true; run();
    if (w) await walk(1);
  }
  async function hide({ walk: w = true } = {}) {
    if (!visible) return;
    bubble.hidden = true; onTap = null; skip();
    if (w) await walk(-1);
    visible = false; el.hidden = true;
    for (const p of fx) p.el.remove(); fx.length = 0;
  }
  // 3-star confetti: a burst over Yuvi's head (pooled like the lab sparkles)
  function confetti(n = YUVI.confetti) {
    if (isReduced()) return;
    const cols = ['#FFC24B', '#7FD8A0', '#FF8A65', '#8EC9FF', '#F7E27A'];
    for (let i = 0; i < n; i++) { spawn('yuvi__conf', boxW / 2 + (Math.random() - 0.5) * 60 * k, boxH * 0.97 - 340 * k, (Math.random() - 0.5) * 900 * k, (-380 - Math.random() * 320) * k, 900 * k, cols[i % cols.length]); const p = fx[fx.length - 1]; if (p) { p.spin = (Math.random() - 0.5) * 900; p.life = YUVI.fxLife * 1.5 / 1000; } }
    run();
  }
  // bubble placement: x from the container's left, bottom above the container bottom, max width (px)
  function bubbleAt({ left, bottom, width }) {
    const ex = parseFloat(el.style.left) || 0, eb = parseFloat(el.style.bottom) || 0;
    Object.assign(bubble.style, { left: (left - ex) + 'px', bottom: (bottom - eb) + 'px', maxWidth: width + 'px' });
  }
  function floor(px) { el.style.bottom = (px - (BOX.h - BOX.feet) / BOX.h * boxH) + 'px'; }
  floor(4);
  return {
    el, bubble, size, boxW, boxH,
    play, say, skip, show, hide, confetti, bubbleAt, floor, measure,
    get action() { return action; }, get frame() { return frame; }, get typing() { return !!typing; }, get visible() { return visible; }, get leaving() { return !!(walking && walking.dir < 0); },
    // the drawing's right edge, in container px (for placing the bubble)
    get right() { return 4 + (BOX.right - BOX.left) * boxW; },
    destroy() { alive = false; cancelAnimationFrame(raf); el.remove(); }
  };
}
