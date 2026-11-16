import { describe, it, expect } from 'vitest';
import { makeBrain, veteran, fixedDay, T0 } from './helpers.js';
import { createRng } from '../src/index.js';

const day = (o) => ({ key: fixedDay(T0), interstitials: 0, rewardedOffered: 0, rewardedShown: 0, rounds: 0, ...o });
const p = async (state, level = 12, config) => {
  const t = await makeBrain({ state: veteran(state), config });
  return t.win(level).interstitial;
};

describe('forced-ad probability (docs/02 table)', () => {
  it('base 0.35 plus 0.05 for the win just played', async () => {
    const i = await p({});
    expect(i.factors.base).toBe(0.35);
    expect(i.probability).toBeCloseTo(0.4, 10);
  });

  it('+0.05 per win in the streak', async () => {
    expect((await p({ winStreak: 3 })).probability).toBeCloseTo(0.35 + 4 * 0.05, 10);
  });

  it('streak counted up to 6', async () => {
    expect((await p({ winStreak: 9 })).probability).toBeCloseTo(0.35 + 6 * 0.05, 10);
    expect((await p({ winStreak: 5 })).probability).toBeCloseTo(0.35 + 6 * 0.05, 10);
  });

  it('-0.15 when the previous round was a loss', async () => {
    const i = await p({ lastRound: 'loss', lossStreak: 1 });
    expect(i.factors.loss).toBe(-0.15);
    expect(i.probability).toBeCloseTo(0.35 + 0.05 - 0.15, 10);
  });

  it('-0.04 per ad already shown today', async () => {
    expect((await p({ day: day({ interstitials: 2 }) })).probability).toBeCloseTo(0.4 - 0.08, 10);
  });

  it('+0.15 for a milestone level after the celebration', async () => {
    const t = await makeBrain({ state: veteran() });
    t.win(10);
    const i = t.brain.handleEvent('celebration_done', { level: 10 }).interstitial;
    expect(i.probability).toBeCloseTo(0.35 + 0.05 + 0.15, 10);
  });

  it('+0.10 catch-up when behind on expected revenue', async () => {
    const i = await p({ day: day({ rounds: 6 }) });
    expect(i.factors.catchUp).toBe(0.1);
    expect(i.probability).toBeCloseTo(0.5, 10);
    expect((await p({ day: day({ rounds: 1 }) })).factors.catchUp).toBe(0);
  });

  it('+0.30 starvation after 8 rounds without an ad', async () => {
    const hit = await p({ roundsSinceInterstitial: 7 }); // this win is the 8th
    expect(hit.factors.starvation).toBe(0.3);
    expect(hit.probability).toBeCloseTo(0.7, 10);
    expect((await p({ roundsSinceInterstitial: 6 })).factors.starvation).toBe(0);
  });

  it('maximum 0.9 however many bonuses stack', async () => {
    // milestone level 20 stacks every bonus
    const t2 = await makeBrain({ state: veteran({ winStreak: 9, roundsSinceInterstitial: 20, day: day({ rounds: 10 }) }) });
    t2.win(20);
    const i = t2.brain.handleEvent('celebration_done', { level: 20 }).interstitial;
    expect(i.factors.subtotal).toBeGreaterThan(0.9);
    expect(i.probability).toBe(0.9);
  });

  it('never certain: a roll of 0.95 fails even at max probability', async () => {
    const t = await makeBrain({ state: veteran({ winStreak: 9, roundsSinceInterstitial: 20 }), rng: 0.95 });
    const i = t.win(12).interstitial;
    expect(i.probability).toBeCloseTo(0.9, 10);
    expect(i.show).toBe(false);
    expect(i.reason).toBe('roll_failed');
  });

  it('never certain: a broken rng (>=1, NaN) cannot force an ad or crash', async () => {
    for (const bad of [1, 5, NaN, Infinity]) {
      const t = await makeBrain({ state: veteran({ winStreak: 9 }), rng: bad });
      expect(t.win(12).interstitial.show).toBe(false);
    }
  });

  it('never certain: over thousands of max-probability trials some are skipped, most shown', async () => {
    const rng = createRng(7);
    let shown = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const t = await makeBrain({ state: veteran({ winStreak: 9, roundsSinceInterstitial: 20 }), rng });
      if (t.win(12).interstitial.show) shown++;
    }
    expect(shown).toBeLessThan(N);
    expect(shown / N).toBeGreaterThan(0.85);
    expect(shown / N).toBeLessThan(0.95);
  });

  it('config cannot raise the maximum above 0.9', async () => {
    const i = await p({ winStreak: 9, roundsSinceInterstitial: 20 }, 12, { prob: { max: 1, base: 1, perWinStreak: 1 } });
    expect(i.probability).toBeLessThanOrEqual(0.9);
  });

  it('probability never goes below 0', async () => {
    const i = await p({ lastRound: 'loss', lossStreak: 1, day: day({ interstitials: 7 }) });
    expect(i.probability).toBe(0);
    expect(i.show).toBe(false);
  });
});

describe('segments', () => {
  const seg = (s) => p({ segmentOverride: s });
  it('scale the probability', async () => {
    expect((await seg('regular')).probability).toBeCloseTo(0.4, 10);
    expect((await seg('ad_averse')).probability).toBeCloseTo(0.2, 10);
    expect((await seg('spender')).probability).toBeCloseTo(0.24, 10);
    expect((await seg('new')).probability).toBeCloseTo(0.24, 10);
    expect((await seg('rewarded_lover')).probability).toBeCloseTo(0.32, 10);
  });

  it('ads_removed is always zero', async () => {
    const i = await seg('ads_removed');
    expect(i.show).toBe(false);
    expect(i.reason).toBe('ads_removed');
  });

  it('segment classification from behaviour', async () => {
    const mk = async (state) => (await makeBrain({ state: veteran(state) })).brain.getSegment();
    expect(await mk({})).toBe('regular');
    expect(await mk({ installedAt: T0, highestLevel: 5 })).toBe('new');
    expect(await mk({ lifetime: { purchases: 1 } })).toBe('spender');
    expect(await mk({ adsRemoved: true })).toBe('ads_removed');
    expect(await mk({ lifetime: { rewardedOffered: 10, rewardedAccepted: 7 } })).toBe('rewarded_lover');
    expect(await mk({ lifetime: { rewardedOffered: 10, rewardedAccepted: 0 } })).toBe('ad_averse');
    expect(await mk({ lifetime: { rewardedOffered: 3, rewardedAccepted: 0 } })).toBe('regular');
  });

  it('recordPurchase with removesAds switches to ads_removed', async () => {
    const t = await makeBrain({ state: veteran() });
    t.brain.recordPurchase({ removesAds: true });
    expect(t.brain.getSegment()).toBe('ads_removed');
    expect(() => t.brain.setSegmentOverride('whale')).toThrow();
  });

  it('segment scales are clamped by config validation', async () => {
    const i = await p({}, 12, { segments: { regular: { probScale: 50 } } });
    expect(i.probability).toBeLessThanOrEqual(0.9);
  });
});
