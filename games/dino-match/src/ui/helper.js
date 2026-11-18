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
function setPlace(name) {
  const y = getYuvi(), p = placeOf(name); place = name;
  y.floor(p.feet); y.bubbleAt({ left: y.right + 12, bottom: p.bubble, width: 360 - y.right - 20 });
}
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

// Run a scene: cancels the one before it. fn(ctx) gets ctx.live() (false once another scene or leave() took over).
// force: run even with Yuvi tips off (the welcome and the debug page).
export async function scene(name, fn, { force = false } = {}) {
  if (!layer || (!force && !enabled())) return false;
  const my = ++cur, y = getYuvi(), live = () => my === cur;
  const wasIn = y.visible && !y.leaving && place === name;
  setPlace(name);
  y.say(null);
  if (!wasIn) { y.play('idle'); await y.show(); }
  if (!live()) return false;
  await fn({ y, live, wait: async (ms) => { await wait(ms); return live(); } });
  return live();
}
// walk out (screen change, card closed). Safe to call any time.
export function leave() { cur++; if (yuvi && yuvi.visible) return yuvi.hide(); return Promise.resolve(); }
export const currentPlace = () => (yuvi && yuvi.visible ? place : null);

// game px (x from the left, y up from the stage bottom) -> screen px, for things placed next to Yuvi
export function toScreen(x, yUp) {
  const r = layer ? layer.getBoundingClientRect() : { left: 0, bottom: innerHeight, width: 360 }, s = r.width / 360;
  return { x: r.left + x * s, y: r.bottom - yUp * s, s };
}
export const ARM = { x: 112, y: 0.5 * SIZE };   // where his pointing hand is (game px, y above his feet)

// ---- scenes -----------------------------------------------------------------------------------------------------------------
// Intro card line: point at the lit element (or think, for event cards), talk while the text types, idle after. greet = the very
// first intro of a player who has not met Yuvi yet: a wave and the greeting first (the card waits for a tap).
export function introLine(text, { pose = 'point', greet = false, onTap } = {}) {
  return scene('intro', async ({ y }) => {
    if (greet) { y.play('wave'); await y.say(GREETING, { tap: onTap }); return; }
    y.play(pose);
    await y.say(text, { talk: true, after: 'idle', delay: reduced() ? 0 : YUVI.pointHold, tap: onTap });
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
  return scene('soft', async ({ y }) => { y.play(pose); await y.say(text, { tap: onTap || (() => leave()) }); });
}
// Win screen, every time: hop in, surprised first if a fossil part was earned, then cheer with sparkles and a short line.
// 3 stars: an extra-big hop and confetti.
export function win({ stars = 1, part = false } = {}) {
  return scene('result', async ({ y, wait: w }) => {
    if (part) { y.play('surprised', { say: pick(LINES.part) }); if (!(await w(YUVI.longBeat))) return; }
    y.play('cheer', { say: pick(stars >= 3 ? LINES.threeStars : LINES.win), big: stars >= 3 });
    if (stars >= 3) y.confetti();
  });
}
// Lose / out of moves / out of lives, every time: sad first, then talk the encouraging line and point at the retry / moves button.
export function lose(kind = 'lose') {
  const line = pick(kind === 'nearMiss' ? LINES.nearMiss : kind === 'noLives' ? LINES.noLives : LINES.lose);
  return scene(kind === 'nearMiss' ? 'offer' : kind === 'noLives' ? 'lives' : 'result', async ({ y, wait: w }) => {
    y.play('sad', { say: LINES.sad });
    if (!(await w(YUVI.beat))) return;
    await y.say(line, { talk: true, after: 'point' });
  });
}
// Dig site: dig while the pickaxe strikes run, cheer when the part is out, surprised on the last part (before the cutscene).
export const digEnter = (dock) => { anchor('dig', dock); return scene('dig', async () => {}); };
export const digStart = () => scene('dig', async ({ y }) => { y.play('dig'); });
export const digPart = () => scene('dig', async ({ y, wait: w }) => { y.play('cheer', { say: pick(LINES.digPart) }); if (await w(YUVI.longBeat)) { y.play('idle'); y.say(null); } });
// the last part: cheer with the confetti, then surprised at the whole fossil; resolves when the cutscene may start
export const digFossil = (name) => scene('dig', async ({ y, wait: w }) => {
  y.play('cheer', { say: pick(LINES.digPart) }); if (!(await w(YUVI.beat))) return;
  y.play('surprised', { say: LINES.fossil(name) }); await w(YUVI.longBeat);
});
// Shop / an empty booster tapped: point at the shop list
// (he walks out again after a moment: the shop list scrolls under him)
export const shop = (boosterName) => scene('shop', async ({ y, wait: w }) => {
  y.play('point'); await y.say(boosterName ? LINES.shopEmpty(boosterName) : pick(LINES.shop), { talk: true, after: 'point' });
  if (await w(YUVI.longBeat)) leave();
});
// A new island on the world map: surprised, then wave. Resolves when done (tap the bubble to finish early).
export function island(eraName) {
  const [a, b] = LINES.island(eraName);
  return scene('home', async ({ y, wait: w }) => {
    y.play('surprised', { say: a }); if (!(await w(YUVI.longBeat))) return;
    y.play('wave', { say: b }); if (!(await w(YUVI.longBeat))) return;
    leave();
  });
}
