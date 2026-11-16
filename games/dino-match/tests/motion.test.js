import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { RECIPES, EVENTS, D, EASE, EASE_CSS, SHAKE, PARTICLES } from '../src/render/motion.js';
import { SOUND_MAP } from '../src/render/sound.js';

// docs/09 section 4: every event needs a recipe (and a sound + haptic mapping).
const SECTION4 = ['tapGem', 'swapValid', 'swapInvalid', 'matchClear', 'fallRefill', 'cascadeStep', 'digBlock', 'lastBlock', 'foundBanner', 'winScreen', 'loseScreen', 'pickaxeSpend', 'fossilComplete', 'buttonPress', 'screenChange', 'counterChange', 'lifeRegained'];

describe('motion recipes', () => {
  it('has a recipe for every section 4 event', () => { for (const e of SECTION4) expect(RECIPES[e], e).toBeTruthy(); expect(EVENTS.sort()).toEqual([...SECTION4].sort()); });
  it('every recipe uses a known duration and easing', () => {
    const durs = new Set(Object.values(D));
    for (const [k, r] of Object.entries(RECIPES)) { expect(durs.has(r.dur), k).toBe(true); expect(EASE[r.ease] || EASE_CSS[r.ease], k).toBeTruthy(); if (r.shake) expect(SHAKE[r.shake], k).toBeTruthy(); }
  });
  it('every event has a sound mapping', () => { for (const e of SECTION4) expect(SOUND_MAP[e], e).toBeTruthy(); });
  it('particle pool respects the cap', () => { expect(PARTICLES.max).toBeLessThanOrEqual(200); });
  it('easings run 0 to 1', () => { for (const k of ['out', 'in', 'pop', 'glide', 'fall']) { expect(EASE[k](0), k).toBeCloseTo(0, 2); expect(EASE[k](1), k).toBeCloseTo(1, 2); } });
});

// No raw durations or easing curves outside motion.js / sound.js (audio envelopes live in sound.js).
describe('no hardcoded timing', () => {
  const root = join(import.meta.dirname, '../src');
  const files = [];
  (function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : /\.(js|css)$/.test(n) && files.push(p); } })(root);
  const ALLOW = ['render/motion.js', 'render/sound.js', 'ports/ads.js', 'render/motionlab.js'];
  const rules = [
    [/\b\d+(\.\d+)?\s*ms\b/, 'millisecond literal'],
    [/cubic-bezier\(/, 'cubic-bezier'],
    [/\b(transition|animation)(-duration)?\s*:[^;{}]*\b\d+(\.\d+)?m?s\b/, 'css time literal'],
    [/setTimeout\([^)]*,\s*\d+\s*\)/, 'setTimeout with a number'],
    [/\bsleep\(\s*\d+/, 'sleep with a number'],
    [/\.(tween|wait)\(\s*\d+/, 'tween/wait with a number']
  ];
  for (const f of files) {
    const rel = relative(root, f).replaceAll('\\', '/');
    if (ALLOW.includes(rel)) continue;
    it(rel, () => {
      const lines = readFileSync(f, 'utf8').split('\n');
      const bad = [];
      lines.forEach((l, i) => { if (/^\s*(\/\/|\*|\/\*)/.test(l)) return; for (const [re, why] of rules) if (re.test(l)) bad.push(`${rel}:${i + 1} ${why}: ${l.trim()}`); });
      expect(bad).toEqual([]);
    });
  }
});
