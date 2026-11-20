// One in-context coaching step (M8): an optional spotlight, Yuvi's bubble, and a wait.
//   wait 'tap'    : dimmed, a tap anywhere (or on the bubble) continues; the bubble shows "Tap to continue". First tap = whole text.
//   wait 'action' : the lit element stays usable and everything else is blocked; the step ends when the caller calls done() (the
//                   player did the thing). No tap cue: tapping the bubble only completes the text.
// Optional: a hand pointer showing a swap (hand = { a: [x, y], b: [x, y] } in screen px), Skip (onSkip) and a second button
// (alt = { label, fn }, e.g. "Not now"). With Yuvi tips off the line shows in a plain parchment card instead.
// Returns { promise, done(result), destroy() }; promise resolves with 'tap' | 'action' | 'skip' | 'alt' | 'gone'.
import { handArt } from '../ui/glyphs.js';
import { h } from '../ui/dom.js';
import { KButton } from '../ui/kit.js';
import { reducedMotion } from '../ui/motion.js';
import { scene, helperOn, getYuvi, above } from '../ui/helper.js';

const HAND = `<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><path d="M20 6a4 4 0 0 1 8 0v16l3-1a4 4 0 0 1 5 2l1 2a4 4 0 0 1 5 2v8c0 7-5 12-12 12h-4c-5 0-8-3-11-8l-5-8a4 4 0 0 1 6-4l3 3z" fill="#FFF1D0" stroke="#3A2610" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
const rectOf = (spot) => {
  if (!spot) return null;
  if (typeof spot === 'function') return rectOf(spot());
  if (spot.getBoundingClientRect) { const r = spot.getBoundingClientRect(), pad = 6; return { x: r.left - pad, y: r.top - pad, w: r.width + 2 * pad, h: r.height + 2 * pad }; }
  return spot;
};

let current = null;
export const activeCoach = () => current;

export function coachStep({ say, action = 'point', then = null, dir = 'right', wait = 'tap', spot = null, hand = null, onSkip = null, alt = null, place = 'intro', dim = true, lift = true }) {
  current?.destroy();
  let resolve, dead = false;
  const promise = new Promise((r) => { resolve = r; });
  const r = rectOf(spot);
  const el = h('div', { class: 'coach' + (wait === 'tap' ? ' coach--tap' : ''), id: 'coach', role: 'dialog', 'aria-label': 'Yuvi explains', onClick: () => { if (wait !== 'tap') return; if (getYuvi()?.skip()) return; done('tap'); } });
  if (wait !== 'tap') el.style.pointerEvents = 'none';
  if (r) {
    el.append(h('div', { class: 'coach__spot', style: { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', boxShadow: dim ? '' : 'none' } }));
    if (wait === 'action') {   // block everything but the lit element
      const W = innerWidth, H = innerHeight, b = (x, y, w, hh) => h('div', { class: 'coach__block', style: { left: x + 'px', top: y + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, hh) + 'px', pointerEvents: 'auto' }, onClick: (e) => { e.stopPropagation(); getYuvi()?.skip(); } });
      el.append(b(0, 0, W, r.y), b(0, r.y + r.h, W, H - r.y - r.h), b(0, r.y, r.x, r.h), b(r.x + r.w, r.y, W - r.x - r.w, r.h));
    }
  } else if (dim) el.append(h('div', { class: 'coach__dim' }));
  if (hand) {
    const [ax, ay] = hand.a, [bx, by] = hand.b;
    const trail = h('div', { class: 'tut__trail', style: { left: ax + 'px', top: ay + 'px', width: Math.hypot(bx - ax, by - ay) + 'px', transform: `rotate(${Math.atan2(by - ay, bx - ax)}rad)` } });
    const hd = h('div', { class: 'tut__hand', 'aria-hidden': 'true' }); const hi = handArt(); if (hi) hd.append(hi); else hd.innerHTML = HAND;
    for (const [k, v] of [['--x0', ax - 10], ['--y0', ay - 4], ['--x1', bx - 10], ['--y1', by - 4]]) hd.style.setProperty(k, v + 'px');
    if (reducedMotion()) { hd.style.animation = 'none'; hd.style.transform = `translate(${bx - 10}px, ${by - 4}px)`; }
    el.append(trail, hd);
  }
  const btns = h('div', { class: 'coach__btns' });
  if (alt) btns.append(KButton({ variant: 'stone', class: 'coach__btn', id: 'coach-alt', onClick: (e) => { e.stopPropagation(); alt.fn?.(); done('alt'); } }, alt.label));
  if (onSkip) btns.append(KButton({ variant: 'stone', class: 'coach__btn', id: 'coach-skip', onClick: (e) => { e.stopPropagation(); onSkip(); done('skip'); } }, 'Skip tutorial'));
  if (btns.childElementCount) {
    btns.style.pointerEvents = 'auto'; el.append(btns);
    if (r && r.y < 120) btns.style.top = Math.round(r.y + r.h + 8) + 'px';   // never over a lit element at the top (the HUD)
  }
  document.body.append(el);

  if (helperOn()) {
    // keep the bubble clear of a lit element in the lower half of the screen
    const min = r && lift && r.y + r.h / 2 > innerHeight * 0.55 ? above({ top: r.y }) : 0;
    scene(place, async ({ y }) => {
      y.play(action, { dir });
      await y.say(say, { cue: wait === 'tap', tap: wait === 'tap' ? () => done('tap') : null });
      if (then && !dead) y.play(then, { dir });
    }, { bubbleMin: min });
  } else {
    el.append(h('div', { class: 'coach__card', role: 'status' }, say, wait === 'tap' ? h('small', {}, 'Tap to continue ▸') : null));
    if (wait === 'tap') el.querySelector('.coach__card').style.pointerEvents = 'auto';
  }
  function done(result = 'action') { if (dead) return; dead = true; el.remove(); if (current === api) current = null; resolve(result); }
  const api = { el, promise, done, destroy: () => done('gone'), get dead() { return dead; } };
  current = api;
  return api;
}
