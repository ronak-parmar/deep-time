// The Yuvi director: one Yuvi for the whole game, on its own layer above every screen and overlay (z 45, under the debug panel),
// scaled with the 360-wide stage so all numbers here are game px. Yuvi always stands bottom-left; each place sets how high his feet
// are (to clear a dock or a button row) and where his speech bubble goes. Screens call the scene functions below; a new scene cancels
// the running one, a screen change walks him out. Settings > "Yuvi tips" off: every scene is a no-op (intro cards keep their text).
import './yuvi.css';
import { h } from './dom.js';
import { createYuvi, preloadYuvi } from './yuvi.js';
import { YUVI } from '../render/motion.js';
import { LINES, GREETING, pick } from '../data/yuvi.js';

const SIZE = 118;   // Yuvi's drawn height at 360 x 640 (feet to hat)
// feet: px above the stage bottom. bubble: px from the stage bottom to the bubble's bottom edge.
export const PLACES = {
  intro:  { feet: 4,  bubble: 100 },   // level intro cards: bubble above the booster bar (the board is dimmed under the card)
  soft:   { feet: 4,  bubble: 30 },    // tips during play: low, over the booster bar, never over the board; taps pass through Yuvi
  result: { feet: 4,  bubble: 8 },     // win / lose panel: under the last button
  offer:  { feet: 4,  bubble: 8 },
  lives:  { feet: 4,  bubble: 8 },
  dig:    { feet: 4,  bubble: 70 },    // stands on the work table above the dock (anchor), bubble beside his head
  shop:   { feet: 4,  bubble: 12 },
  home:   { feet: 72, bubble: 166 },   // world map: above the dock, bubble above the Play pill
  welcome:{ feet: 72, bubble: 166 },
  debug:  { feet: 4,  bubble: 60 }
};

let layer = null, stageEl = null, yuvi = null, enabled = () => true, reduced = () => false, cur = 0, place = null;
export function initHelper({ stage, isOn, isReduced }) {
  stageEl = stage; enabled = isOn; reduced = isReduced;
  layer = h('div', { class: 'yuvi-layer', 'aria-live': 'polite' });
  document.body.append(layer);
  preloadYuvi();
  sync();
}
// keep the layer on top of the stage (called from main.js fit())
export function sync() {
  if (!layer || !stageEl) return;
  layer.style.height = stageEl.style.height || '640px';
  layer.style.transform = stageEl.style.transform;
}
export const helperOn = () => !!layer && enabled();
export function getYuvi() {
  if (!yuvi && layer) yuvi = createYuvi(layer, { size: SIZE, reduced });
  return yuvi;
}
// a place can stand Yuvi on top of an element instead (the dig site: on the work table, above the dock)
const anchors = {};
export const anchor = (name, el) => { anchors[name] = el; };
function placeOf(name) {
  const p = PLACES[name] || PLACES.intro, a = anchors[name];
  if (!a || !a.isConnected || !layer) return p;
  const r = layer.getBoundingClientRect(), s = r.width / 360, feet = Math.max(p.feet, (r.bottom - a.getBoundingClientRect().top) / s + 2);
  return { feet, bubble: feet + (p.bubble - p.feet) };
}
// bubbleMin: keep the bubble's bottom at least this high (game px), e.g. above a lit button it must not cover
function setPlace(name, bubbleMin = 0) {
  const y = getYuvi(), p = placeOf(name); place = name;
  y.floor(p.feet); y.bubbleAt({ left: y.right + 12, bottom: Math.max(p.bubble, bubbleMin), width: 360 - y.right - 20 });
}
// screen rect -> its top edge in game px above the stage bottom (for bubbleMin)
export function above(rect, gap = 10) {
  if (!layer || !rect) return 0;
  const r = layer.getBoundingClientRect(), s = r.width / 360;
  return (r.bottom - rect.top) / s + gap;
}
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

// Run a scene: cancels the one before it. fn(ctx) gets ctx.live() (false once another scene or leave() took over).
// force: run even with Yuvi tips off (the welcome and the debug page).
export async function scene(name, fn, { force = false, bubbleMin = 0 } = {}) {
  if (!layer || (!force && !enabled())) return false;
  const my = ++cur, y = getYuvi(), live = () => my === cur;
  release();
  const wasIn = y.visible && !y.leaving && place === name;
  setPlace(name, bubbleMin);
  y.say(null);
  if (!wasIn) { y.play('idle'); await y.show(); }
  if (!live()) return false;
  await fn({ y, live, wait: async (ms) => { await wait(ms); return live(); } });
  return live();
}
// walk out (screen change, card closed). Safe to call any time.
export function leave() { cur++; release(); if (yuvi && yuvi.visible) return yuvi.hide(); return Promise.resolve(); }
export const currentPlace = () => (yuvi && yuvi.visible ? place : null);

// game px (x from the left, y up from the stage bottom) -> screen px, for things placed next to Yuvi
export function toScreen(x, yUp) {
  const r = layer ? layer.getBoundingClientRect() : { left: 0, bottom: innerHeight, width: 360 }, s = r.width / 360;
  return { x: r.left + x * s, y: r.bottom - yUp * s, s };
}
export const ARM = { x: 112, y: 0.5 * SIZE };   // where his pointing hand is (game px, y above his feet)

// ---- taps -------------------------------------------------------------------------------------------------------------------
// A bubble never moves on by itself (M8): sayTap() types the line, shows "Tap to continue" and resolves on the next tap. block = a
// clear full-screen catcher so a tap anywhere counts (multi-bubble moments); otherwise only the bubble takes the tap and the screen
// stays usable.
const waiting = new Set();   // open sayTap waits: a new scene or leave() releases them (and removes their tap catchers)
const release = () => { for (const f of [...waiting]) f(); };
export function sayTap(y, line, { talk = false, after = 'idle', block = false } = {}) {
  return new Promise((res) => {
    let catcher = null;
    const done = () => { waiting.delete(done); catcher?.remove(); res(); };
    waiting.add(done);
    if (block) { catcher = h('div', { class: 'coach coach--clear coach--tap', onClick: () => { if (!y.skip()) done(); } }); document.body.append(catcher); }
    y.say(line, { talk, after, cue: true, tap: done });
  });
}

// ---- scenes -----------------------------------------------------------------------------------------------------------------
// Intro card line: point at the lit element (or think, for event cards), talk while the text types, idle after. greet = the very
// first intro of a player who has not met Yuvi yet: a wave and the greeting first (the card waits for a tap).
export function introLine(text, { pose = 'point', greet = false, onTap } = {}) {
  return scene('intro', async ({ y }) => {
    if (greet) { y.play('wave'); await y.say(GREETING, { tap: onTap, cue: true }); return; }
    y.play(pose);
    await y.say(text, { talk: true, after: 'idle', delay: reduced() ? 0 : YUVI.pointHold, tap: onTap, cue: true });
  });
}
// Where the Yuvi band starts (screen px) for a line at a place: cards are kept above it. Reads layout once.
export function bandTop(text, name = 'intro') {
  if (!layer) return innerHeight;
  const y = getYuvi(); setPlace(name);
  const p = placeOf(name), hgt = y.measure(text), r = layer.getBoundingClientRect(), s = r.width / 360;
  return r.bottom - (Math.max(p.bubble + hgt + 12, p.feet + SIZE) + 6) * s;
}
// a small tip during play (hint, shuffle, first combo): think or point, the line typed; never blocks (Yuvi lets taps through)
export function softTip(text, pose = 'think', onTap) {
  return scene('soft', async ({ y }) => { y.play(pose); await y.say(text, { tap: onTap || (() => leave()), cue: true }); });
}
// Win screen, every time: hop in, cheer with sparkles and a short line (3 stars: an extra-big hop and confetti). A fossil part:
// surprised first, the next bubble after a tap.
export function win({ stars = 1, part = false } = {}) {
  return scene('result', async ({ y, live }) => {
    if (part) { y.play('surprised'); await sayTap(y, pick(LINES.part), { block: true }); if (!live()) return; }
    y.play('cheer', { big: stars >= 3 });
    if (stars >= 3) y.confetti();
    await sayTap(y, pick(stars >= 3 ? LINES.threeStars : LINES.win));
    if (live()) y.say(null);
  });
}
// Lose / out of moves / out of lives, every time: sad first; after a tap he talks the encouraging line and points at the button.
export function lose(kind = 'lose') {
  const line = pick(kind === 'nearMiss' ? LINES.nearMiss : kind === 'noLives' ? LINES.noLives : LINES.lose);
  return scene(kind === 'nearMiss' ? 'offer' : kind === 'noLives' ? 'lives' : 'result', async ({ y, live }) => {
    y.play('sad');
    await sayTap(y, LINES.sad, { block: true }); if (!live()) return;
    await sayTap(y, line, { talk: true, after: 'point' });
    if (live()) y.say(null);
  });
}
// Dig site: dig while the pickaxe strikes run, cheer when the part is out, surprised on the last part (before the cutscene).
export const digEnter = (dock) => { anchor('dig', dock); return scene('dig', async () => {}); };
export const digStart = () => scene('dig', async ({ y }) => { y.say(null); y.play('dig'); });
export const digPart = () => scene('dig', async ({ y, live }) => { y.play('cheer'); await sayTap(y, pick(LINES.digPart)); if (live()) { y.play('idle'); y.say(null); } });
// the last part: cheer, then (tap) surprised at the whole fossil; resolves when the cutscene may start (tap)
export const digFossil = (name) => scene('dig', async ({ y, live }) => {
  y.play('cheer'); await sayTap(y, pick(LINES.digPart), { block: true }); if (!live()) return;
  y.play('surprised'); await sayTap(y, LINES.fossil(name), { block: true });
});
// Shop / an empty booster tapped: point at the shop list; a tap on the bubble sends him off (the list scrolls under him)
export const shop = (boosterName) => scene('shop', async ({ y, live }) => {
  y.play('point'); await sayTap(y, boosterName ? LINES.shopEmpty(boosterName) : pick(LINES.shop), { talk: true, after: 'point' });
  if (live()) leave();
});
// A new island on the world map: surprised, then (tap) wave, then (tap) he leaves.
export function island(eraName) {
  const [a, b] = LINES.island(eraName);
  return scene('home', async ({ y, live }) => {
    y.play('surprised'); await sayTap(y, a, { block: true }); if (!live()) return;
    y.play('wave'); await sayTap(y, b, { block: true }); if (live()) leave();
  });
}
