// Sound and haptics for the section 4 event table (docs/09). Synthesised with WebAudio, no samples.
// Palette: stone, wood, glass, soft chimes. Master 0.6, UI 0.4, max 6 voices, combo pitch +1 semitone per step (cap +7).
// This file may hold raw millisecond numbers (it is the sound side of the motion standard).
import { EVENTS } from './motion.js';
import { makeRng, next, hashSeed } from '../core/rng.js';
import { partTimes } from '../data/cutscene.js';

const MASTER = 0.6, UI = 0.4, MAX_VOICES = 6, MAX_STEPS = 7, HAPTIC_GAP = 80;
export const HAPTIC_MS = { light: 8, medium: 16, heavy: 30 };

// event -> { sound, haptic }. Keys must match motion.js RECIPES (a test checks it).
export const SOUND_MAP = {
  tapGem:         { sound: 'tick',      haptic: null },
  swapValid:      { sound: 'swap',      haptic: null },
  swapInvalid:    { sound: 'thudSoft',  haptic: 'light' },
  matchClear:     { sound: 'pop',       haptic: 'light' },
  fallRefill:     { sound: 'tickSoft',  haptic: null },
  cascadeStep:    { sound: 'pop',       haptic: 'light', ladder: true },
  digBlock:       { sound: 'crumble',   haptic: 'medium' },
  lastBlock:      { sound: 'reveal',    haptic: 'heavy' },
  foundBanner:    { sound: 'fanfare',   haptic: null },
  winScreen:      { sound: 'star',      haptic: 'light', ladder: true },
  loseScreen:     { sound: 'lowTone',   haptic: null },
  pickaxeSpend:   { sound: 'crumble',   haptic: 'medium', then: 'chime' },
  fossilComplete: { sound: 'fanfareBig', haptic: 'heavy' },
  buttonPress:    { sound: 'tick',      haptic: 'light', ui: true },
  screenChange:   { sound: null,        haptic: null },
  counterChange:  { sound: 'tick',      haptic: null, ui: true },
  lifeRegained:   { sound: 'chime',     haptic: 'light' },
  hitBlock:       { sound: 'chip',      haptic: 'light' },
  createSpecial:  { sound: 'chime',     haptic: 'light' },
  fireSpecial:    { sound: 'boom',      haptic: 'medium' },
  obstacleHit:    { sound: 'chip',      haptic: 'light' },
  obstacleBreak:  { sound: 'crumble',   haptic: 'medium' },
  collectItem:    { sound: 'chime',     haptic: 'light' },
  tarSpread:      { sound: 'lowTone',   haptic: null },
  lavaErupt:      { sound: 'boom',      haptic: 'medium' },
  targetPop:      { sound: 'tick',      haptic: null, ui: true },
  targetDone:     { sound: 'star',      haptic: 'light' }
};

const state = { muted: false, haptics: true, ctx: null, master: null, voices: 0, lastHaptic: -1e9 };
export const settings = state;

export function setMuted(m) { state.muted = !!m; }
export function setHaptics(h) { state.haptics = !!h; }

// Browsers need a user gesture before audio starts: call from the first pointerdown.
export function unlock() {
  if (state.ctx) { if (state.ctx.state === 'suspended') state.ctx.resume(); return; }
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  state.ctx = new AC(); state.master = state.ctx.createGain(); state.master.gain.value = MASTER; state.master.connect(state.ctx.destination);
}

const semis = (n) => Math.pow(2, n / 12);

// ---- voices: tone(freq, dur, {type, vol, slide, delay, attack}) and noise(dur, {vol, hp, lp, delay}) ----
function tone(f, dur, o = {}) {
  const { ctx, master } = state; if (!ctx) return;
  const t0 = ctx.currentTime + (o.delay || 0), osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t0);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f * o.slide), t0 + dur);
  const v = (o.vol ?? 0.5) * (o.ui ? UI / MASTER : 1);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(master); osc.start(t0); osc.stop(t0 + dur + 0.02);
  voice(dur + (o.delay || 0));
}
let noiseBuf = null;
function noise(dur, o = {}) {
  const { ctx, master } = state; if (!ctx) return;
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t0 = ctx.currentTime + (o.delay || 0), src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  src.buffer = noiseBuf; f.type = o.hp ? 'highpass' : 'lowpass'; f.frequency.value = o.hp || o.lp || 1200;
  g.gain.setValueAtTime(o.vol ?? 0.4, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t0); src.stop(t0 + dur + 0.02);
  voice(dur + (o.delay || 0));
}
function voice(sec) { state.voices++; setTimeout(() => { state.voices--; }, sec * 1000 + 40); }

const VOICES = {
  tick: (p, ui) => tone(1400 * p, 0.04, { type: 'triangle', vol: 0.25, ui }),
  tickSoft: (p) => tone(900 * p, 0.05, { type: 'sine', vol: 0.12 }),
  swap: (p) => { tone(420 * p, 0.12, { type: 'triangle', vol: 0.3, slide: 1.5 }); noise(0.06, { hp: 3000, vol: 0.06 }); },
  thudSoft: (p) => { tone(130 * p, 0.14, { type: 'sine', vol: 0.4, slide: 0.6 }); },
  pop: (p) => { tone(620 * p, 0.12, { type: 'sine', vol: 0.4, slide: 1.8 }); tone(1240 * p, 0.09, { type: 'triangle', vol: 0.15, delay: 0.02 }); },
  crumble: (p) => { noise(0.22, { lp: 900, vol: 0.5 }); noise(0.12, { lp: 2200, vol: 0.25, delay: 0.03 }); tone(110 * p, 0.18, { type: 'triangle', vol: 0.3, slide: 0.5 }); },
  reveal: () => { tone(220, 0.28, { type: 'triangle', vol: 0.35, slide: 2 }); tone(660, 0.28, { type: 'sine', vol: 0.25, delay: 0.1 }); tone(990, 0.28, { type: 'sine', vol: 0.2, delay: 0.1 }); },
  fanfare: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i === 3 ? 0.55 : 0.18, { type: 'triangle', vol: 0.3, delay: i * 0.11 })),
  fanfareBig: () => { [523, 659, 784, 1046, 1319].forEach((f, i) => tone(f, i === 4 ? 0.9 : 0.2, { type: 'triangle', vol: 0.32, delay: i * 0.12 })); tone(262, 0.9, { type: 'sine', vol: 0.25, delay: 0.5 }); },
  star: (p) => { tone(784 * p, 0.2, { type: 'sine', vol: 0.35 }); tone(1568 * p, 0.2, { type: 'sine', vol: 0.15, delay: 0.03 }); },
  lowTone: () => { tone(196, 0.45, { type: 'sine', vol: 0.3, slide: 0.8 }); tone(147, 0.5, { type: 'sine', vol: 0.25, delay: 0.14, slide: 0.8 }); },
  chip: (p) => { noise(0.08, { lp: 1800, vol: 0.35 }); tone(180 * p, 0.09, { type: 'triangle', vol: 0.25, slide: 0.6 }); },
  boom: () => { noise(0.35, { lp: 700, vol: 0.55 }); tone(90, 0.3, { type: 'sine', vol: 0.45, slide: 0.4 }); noise(0.2, { hp: 2500, vol: 0.18, delay: 0.02 }); },
  chime: () => { tone(1175, 0.3, { type: 'sine', vol: 0.28 }); tone(1568, 0.3, { type: 'sine', vol: 0.2, delay: 0.09 }); }
};

// Play the sound + haptic for a section 4 event. opts: { step } (cascade/win ladder), { size } (match size pitch).
export function cue(event, opts = {}) {
  const m = SOUND_MAP[event]; if (!m) return;
  if (m.haptic && (event !== 'cascadeStep' || (opts.step || 1) >= 2)) haptic(m.haptic);
  if (state.muted || !state.ctx || !m.sound || state.voices >= MAX_VOICES) return;
  const step = Math.min(MAX_STEPS, Math.max(0, (opts.step || 1) - 1));
  let p = m.ladder ? semis(step) : 1;
  if (event === 'matchClear' && opts.size) p *= semis(Math.min(4, Math.max(0, opts.size - 3)));
  VOICES[m.sound](p, !!m.ui);
  if (m.then) setTimeout(() => VOICES[m.then](1, false), 180);
}

export function haptic(kind) {
  if (!state.haptics || !globalThis.navigator?.vibrate) return;
  const now = performance.now();
  if (now - state.lastHaptic < HAPTIC_GAP) return;
  state.lastHaptic = now;
  navigator.vibrate(HAPTIC_MS[kind] || HAPTIC_MS.light);
}
export const SOUND_EVENTS = EVENTS;

// ---- music bed for the history cutscenes ---------------------------------------------------------------------------
// One soft synthesised bed per cutscene: a slow pad, a low drone, sparse plucks from the era's scale, a bell for every unearthed
// part (rising through the scale, so the reveal is heard) and a closing chord. It only needs a WebAudio context, so the same
// code plays live in the game (startBed) and renders offline into the mp4 (OfflineAudioContext in tools/render-cutscene).
// Deterministic: the random plucks use a seeded RNG, so a re-render is identical.
const SCALES = { penta: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10], dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11], phryg: [0, 1, 3, 5, 7, 8, 10] };
export const BED_MOODS = {
  cambrian: { root: 50, scale: 'lydian', bpm: 54 }, devonian: { root: 52, scale: 'penta', bpm: 60 }, carboniferous: { root: 48, scale: 'dorian', bpm: 58 },
  permian: { root: 45, scale: 'phryg', bpm: 52 }, triassic: { root: 55, scale: 'minor', bpm: 62 }, jurassic: { root: 50, scale: 'dorian', bpm: 66 },
  cretaceous: { root: 53, scale: 'minor', bpm: 70 }, 'age-of-mammals': { root: 57, scale: 'penta', bpm: 60 }, 'ice-age': { root: 52, scale: 'dorian', bpm: 48 },
  'early-humans': { root: 48, scale: 'penta', bpm: 64 }
};
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const degree = (mood, i) => { const sc = SCALES[mood.scale]; return mood.root + sc[((i % sc.length) + sc.length) % sc.length] + 12 * Math.floor(i / sc.length); };

// Schedules the whole bed on `ctx` into `dest`, starting at time t0. Returns the bed's master gain (fade it to stop early).
export function renderBed(ctx, dest, t0, script, fossil) {
  const mood = BED_MOODS[fossil.era] || BED_MOODS.cambrian, D = script.duration, beat = 60 / mood.bpm, rnd = makeRng(hashSeed(fossil.index || 0, 5));
  const out = ctx.createGain(); out.connect(dest);
  out.gain.setValueAtTime(0.0001, t0); out.gain.exponentialRampToValueAtTime(1, t0 + 1.4); out.gain.setValueAtTime(1, t0 + D - 2.2); out.gain.exponentialRampToValueAtTime(0.0001, t0 + D - 0.05);
  const pan = (v) => { if (!ctx.createStereoPanner) return out; const p = ctx.createStereoPanner(); p.pan.value = v; p.connect(out); return p; };
  const env = (g, at, atk, hold, rel, vol) => { g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + atk); g.gain.setValueAtTime(vol, at + atk + hold); g.gain.exponentialRampToValueAtTime(0.0001, at + atk + hold + rel); };
  const osc = (type, f, at, atk, hold, rel, vol, to, slideTo) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, at); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + atk + hold + rel);
    env(g, at, atk, hold, rel, vol); o.connect(g); g.connect(to); o.start(at); o.stop(at + atk + hold + rel + 0.05);
  };
  // pad: a triad of the scale on every 4th beat, cycling 0 - 3 - 4 - 2
  const chordLen = beat * 4, prog = [0, 3, 4, 2], lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.connect(out);
  for (let k = 0, at = 0; at < D - 0.5; k++, at += chordLen) {
    const d0 = prog[k % 4];
    for (const [j, off] of [[0, 0], [2, 0], [4, 0]]) osc('triangle', hz(degree(mood, d0 + j) + 12 * off), t0 + at, 1.2, chordLen - 1.2, 1.6, 0.075, lp);
  }
  osc('sine', hz(mood.root - 12), t0, 2, D - 4.5, 2, 0.16, out);                     // low drone
  // plucks
  for (let at = beat * 2; at < D - 2; at += beat / 2) if (next(rnd) < 0.42) {
    const n = degree(mood, 7 + Math.floor(next(rnd) * 8)), to = pan(next(rnd) * 1.4 - 0.7);
    osc('sine', hz(n), t0 + at, 0.01, 0.02, 1.3, 0.1, to); osc('triangle', hz(n + 12), t0 + at, 0.01, 0.01, 0.7, 0.03, to);
  }
  // a bell for each unearthed part, rising through the scale; the last one is a full chord (and a drum for the finale)
  const times = partTimes(script);
  times.forEach((at, i) => {
    const last = i === times.length - 1, n = degree(mood, 7 + i), to = pan(-0.5 + (i / Math.max(1, times.length - 1)));
    osc('sine', hz(n), t0 + at, 0.005, 0.05, last ? 2.4 : 1.1, last ? 0.2 : 0.15, to); osc('sine', hz(n + 12) * 1.002, t0 + at, 0.005, 0.02, last ? 1.6 : 0.6, 0.06, to);
    if (last) for (const j of [0, 2, 4, 7]) osc('triangle', hz(degree(mood, 7 + j)), t0 + at, 0.02, 0.2, 2.6, 0.08, out);
    if (last && script.finale) { osc('sine', hz(mood.root - 24) * 1.9, t0 + at, 0.004, 0.02, 1.3, 0.5, out, hz(mood.root - 24)); }
  });
  // closing chord on the outro
  const outro = script.beats.find((b) => b.kind === 'outro');
  if (outro) for (const j of [0, 2, 4]) osc('triangle', hz(degree(mood, j + 7)), t0 + outro.t0, 0.15, 1.2, 1.5, 0.07, out);
  return out;
}

let bed = null;
// Live playback in the game. Respects the mute setting; silent when WebAudio is not unlocked yet.
export function startBed(script, fossil) {
  stopBed();
  if (state.muted || !state.ctx) return;
  const g = renderBed(state.ctx, state.master, state.ctx.currentTime + 0.05, script, fossil);
  bed = g;
}
export function stopBed() {
  if (!bed || !state.ctx) { bed = null; return; }
  const t = state.ctx.currentTime, g = bed; bed = null;
  g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  setTimeout(() => g.disconnect(), 450);
}
