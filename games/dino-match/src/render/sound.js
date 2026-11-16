// Sound and haptics for the section 4 event table (docs/09). Synthesised with WebAudio, no samples.
// Palette: stone, wood, glass, soft chimes. Master 0.6, UI 0.4, max 6 voices, combo pitch +1 semitone per step (cap +7).
// This file may hold raw millisecond numbers (it is the sound side of the motion standard).
import { EVENTS } from './motion.js';

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
  lifeRegained:   { sound: 'chime',     haptic: 'light' }
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
