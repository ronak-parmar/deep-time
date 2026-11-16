import { describe, it, expect } from 'vitest';
import { createRng, hashSeed } from '../src/index.js';
import { makeBrain, veteran } from './helpers.js';

async function script(seed) {
  const t = await makeBrain({ state: veteran(), seed });
  const out = [];
  for (let i = 0; i < 80; i++) {
    t.advance(130);
    const d = i % 5 === 4 ? t.lose(20 + i) : t.win(20 + i * 1.0 + 0.5 | 0);
    out.push([d.interstitial.show, d.interstitial.reason, d.interstitial.roll, d.interstitial.probability, d.rewardedOffers.map((o) => o.type)]);
    if (d.interstitial.show) t.brain.commitInterstitial();
  }
  return JSON.stringify(out);
}

describe('seeded determinism', () => {
  it('same seed gives the same decisions', async () => {
    expect(await script(42)).toBe(await script(42));
  });
  it('different seeds differ', async () => {
    expect(await script(1)).not.toBe(await script(2));
  });
  it('rng is repeatable, in [0,1), and roughly uniform', () => {
    const a = createRng(9), b = createRng(9);
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
    }
    expect(sum / 10000).toBeGreaterThan(0.48);
    expect(sum / 10000).toBeLessThan(0.52);
  });
  it('string seeds hash stably; fork gives an independent stream', () => {
    expect(hashSeed('deep-time')).toBe(hashSeed('deep-time'));
    expect(createRng('x')()).toBe(createRng('x')());
    const r = createRng(5);
    expect(r.fork('a')()).not.toBe(r.fork('b')());
    expect(createRng(3).int(5, 5)).toBe(5);
  });
});
