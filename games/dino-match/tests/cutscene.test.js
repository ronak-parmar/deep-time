import { describe, it, expect } from 'vitest';
import { ROSTER } from '../src/data/roster.js';
import { buildScript, sceneAt, LIMITS } from '../src/data/cutscene.js';

describe('history cutscenes', () => {
  it('has one script per fossil, 20-30 s', () => {
    expect(ROSTER.length).toBe(47);
    for (const f of ROSTER) {
      const s = buildScript(f);
      expect(s.duration, f.id).toBeGreaterThanOrEqual(LIMITS.min);
      expect(s.duration, f.id).toBeLessThanOrEqual(LIMITS.max);
    }
  });
  it('beats are contiguous and show every fact once', () => {
    for (const f of ROSTER) {
      const s = buildScript(f);
      expect(s.beats[0].t0).toBe(0);
      s.beats.forEach((b, i) => { if (i) expect(b.t0).toBeCloseTo(s.beats[i - 1].t1, 6); });
      expect(s.beats.filter((b) => b.kind === 'fact').map((b) => b.fact)).toEqual(f.facts.map((_, i) => i));
    }
  });
  it('only Tyrannosaurus is the finale', () => {
    const fin = ROSTER.filter((f) => buildScript(f).finale);
    expect(fin.length).toBe(1);
    expect(fin[0].id).toMatch(/tyrannosaurus|trex|t-rex/i);
  });
  it('reveals parts in order up to all 10', () => {
    const f = ROSTER[0], s = buildScript(f);
    let last = 0;
    for (let t = 0; t <= s.duration; t += 0.25) {
      const r = sceneAt(s, f, t).revealed;
      expect(r).toBeGreaterThanOrEqual(last);
      last = r;
    }
    expect(last).toBe(10);
  });
});
