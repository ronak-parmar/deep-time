// History cutscenes are DATA: buildScript(fossil) turns a roster entry into a timeline of beats, and sceneAt(script, t)
// says what is on screen at time t (seconds). Pure functions, no canvas: render/cutscene.js draws them, the in-game player
// and tools/render-cutscene both step the same timeline, and tests/cutscene.test.js checks the rules.
//
//   title    era name, time range, fossil name; the fossil lies buried
//   assemble the 10 parts are unearthed one after the other (the last one is the big moment)
//   hold     the finished fossil lights up
//   fact     one checked fact each, as a caption
//   outro    "Added to your museum"
// A roster entry can replace the whole timeline with script.beats (same shape), or just tune it with script.timing.
export const LIMITS = { min: 20, max: 30 };               // seconds, every cutscene
export const TIMING = { title: 3, part: 0.65, hold: 0.8, fact: 4.4, outro: 3 };
export const TIMING_FINALE = { title: 4, part: 0.85, hold: 1, fact: 4.6, outro: 2.5 };   // Tyrannosaurus rex: slower, bigger reveal

export function buildScript(fossil) {
  if (fossil.script?.beats) return finish(fossil, fossil.script.beats);
  const T = { ...(fossil.script?.finale ? TIMING_FINALE : TIMING), ...(fossil.script?.timing || {}) };
  const parts = fossil.shape.length, beats = [];
  let t = 0;
  const add = (kind, len, extra = {}) => { beats.push({ kind, t0: t, t1: t + len, ...extra }); t += len; };
  add('title', T.title);
  add('assemble', T.part * parts, { parts });
  add('hold', T.hold);
  fossil.facts.forEach((_, i) => add('fact', T.fact, { fact: i }));
  add('outro', T.outro);
  return finish(fossil, beats);
}
function finish(fossil, beats) {
  const duration = beats.at(-1).t1;
  return { fossilId: fossil.id, motion: fossil.script?.motion || 'sway', finale: !!fossil.script?.finale, duration, beats };
}

// What is on screen at time t.
export function sceneAt(script, fossil, t) {
  t = Math.max(0, Math.min(script.duration, t));
  const beat = script.beats.find((b) => t < b.t1) || script.beats.at(-1);
  const local = beat.t1 > beat.t0 ? (t - beat.t0) / (beat.t1 - beat.t0) : 1;
  const out = { t, beat: beat.kind, local, beatIndex: script.beats.indexOf(beat), revealed: 0, anim: null, fact: null, factT: 0, done: false };
  const asm = script.beats.find((b) => b.kind === 'assemble');
  if (asm) {
    const per = (asm.t1 - asm.t0) / asm.parts;
    if (t >= asm.t1) { out.revealed = asm.parts; out.done = true; }
    else if (t >= asm.t0) { const k = (t - asm.t0) / per, i = Math.floor(k); out.revealed = i; out.anim = { index: i, t: k - i }; }
  }
  if (beat.kind === 'fact') { out.fact = fossil.facts[beat.fact]; out.factT = local; }
  return out;
}
// Times (seconds) at which each part is unearthed, for the music bed and the sound cues.
export function partTimes(script) {
  const asm = script.beats.find((b) => b.kind === 'assemble');
  if (!asm) return [];
  const per = (asm.t1 - asm.t0) / asm.parts;
  return Array.from({ length: asm.parts }, (_, i) => asm.t0 + i * per);
}
