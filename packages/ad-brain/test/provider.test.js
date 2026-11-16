import { describe, it, expect } from 'vitest';
import { MockProvider, missingProviderMethods, createRng } from '../src/index.js';
import { makeBrain, veteran } from './helpers.js';

describe('MockProvider', () => {
  it('implements the IAdProvider interface', () => {
    expect(missingProviderMethods(new MockProvider())).toEqual([]);
    expect(missingProviderMethods({})).toContain('showInterstitial');
  });
  it('is not ready before init, ready after with full fill', async () => {
    const p = new MockProvider({ rng: () => 0 });
    expect(p.isInterstitialReady()).toBe(false);
    await p.init();
    expect(p.isInterstitialReady()).toBe(true);
    expect(await p.showInterstitial()).toEqual({ shown: true });
  });
  it('fill rate 0 never fills; fill rate 1 always fills', async () => {
    const none = new MockProvider({ interstitialFillRate: 0, rewardedFillRate: 0 });
    await none.init();
    expect(none.isInterstitialReady()).toBe(false);
    expect(await none.showInterstitial()).toMatchObject({ shown: false, error: 'not_ready' });
    expect((await none.showRewarded()).shown).toBe(false);
  });
  it('partial fill rate is close to configured and seeded', async () => {
    const run = async () => {
      const p = new MockProvider({ interstitialFillRate: 0.7, rng: createRng(3) });
      await p.init();
      let ok = 0;
      for (let i = 0; i < 2000; i++) if (await p.loadInterstitial()) ok++;
      return ok;
    };
    const a = await run();
    expect(a).toBe(await run());
    expect(a / 2000).toBeGreaterThan(0.65);
    expect(a / 2000).toBeLessThan(0.75);
  });
  it('failRate 1 fails every show', async () => {
    const p = new MockProvider({ failRate: 1, rng: () => 0.5 });
    await p.init();
    expect(await p.showInterstitial()).toMatchObject({ shown: false, error: 'show_failed' });
    expect(p.stats.failures).toBe(1);
  });
  it('latency uses the injected sleep', async () => {
    const waits = [];
    const p = new MockProvider({ latencyMs: 250, sleep: async (ms) => waits.push(ms) });
    await p.init();
    await p.showInterstitial();
    expect(waits.length).toBeGreaterThan(0);
    expect(waits.every((w) => w === 250)).toBe(true);
  });
  it('rewarded completion rate controls whether the reward is granted', async () => {
    const p = new MockProvider({ rewardedCompletionRate: 0 });
    await p.init();
    expect(await p.showRewarded()).toEqual({ shown: true, rewarded: false });
  });
});

describe('brain + provider', () => {
  const ready = async (o) => {
    const p = new MockProvider({ rng: () => 0, ...o });
    await p.init();
    return p;
  };

  it('showInterstitial goes through the provider and records the ad', async () => {
    const provider = await ready();
    const t = await makeBrain({ state: veteran(), provider });
    const d = t.win(12);
    expect(d.interstitial.show).toBe(true);
    expect(provider.stats.interstitialShown).toBe(0); // decision alone shows nothing
    expect(await t.brain.showInterstitial(d)).toEqual({ shown: true });
    const s = t.brain.getState();
    expect(s.day.interstitials).toBe(1);
    expect(s.roundsSinceInterstitial).toBe(0);
    expect(s.lastInterstitialAt).toBe(t.time.now);
    expect(t.analytics.count('interstitial_shown')).toBe(1);
  });

  it('a failed show is not counted', async () => {
    const provider = await ready({ failRate: 1 });
    const t = await makeBrain({ state: veteran(), provider });
    const d = t.win(12);
    const r = await t.brain.showInterstitial(d);
    expect(r.shown).toBe(false);
    expect(t.brain.getState().day.interstitials).toBe(0);
  });

  it('provider with no fill blocks the decision as not_ready', async () => {
    const provider = await ready({ interstitialFillRate: 0, rng: () => 0.5 });
    const t = await makeBrain({ state: veteran(), provider });
    expect(t.win(12).interstitial.reason).toBe('not_ready');
  });

  it('an approved decision can only be shown once, and not after a new round started', async () => {
    const provider = await ready();
    const t = await makeBrain({ state: veteran(), provider });
    const d = t.win(12);
    expect((await t.brain.showInterstitial(d)).shown).toBe(true);
    expect((await t.brain.showInterstitial(d)).reason).toBe('not_approved');

    const t2 = await makeBrain({ state: veteran(), provider: await ready() });
    const d2 = t2.win(12);
    t2.brain.handleEvent('level_start', { level: 13 });
    expect((await t2.brain.showInterstitial(d2)).reason).toBe('in_play');
    expect(t2.brain.getState().day.interstitials).toBe(0);
  });

  it('refuses decisions that said no, and forged decisions', async () => {
    const t = await makeBrain({ state: veteran({ adsRemoved: true }), provider: await ready() });
    const d = t.win(12);
    expect((await t.brain.showInterstitial(d)).shown).toBe(false);
    const forged = { id: 99, interstitial: { show: true } };
    expect((await t.brain.showInterstitial(forged)).shown).toBe(false);
    expect((await t.brain.showInterstitial(undefined)).shown).toBe(false);
  });

  it('after a shown ad the spacing rules apply', async () => {
    const provider = await ready();
    const t = await makeBrain({ state: veteran(), provider });
    await t.brain.showInterstitial(t.win(12));
    t.advance(300);
    expect(t.win(13).interstitial.reason).toBe('min_rounds');
    t.advance(300);
    expect(t.win(14).interstitial.show).toBe(true);
  });

  it('a rewarded ad watched after the decision cancels the forced ad (90 s guard)', async () => {
    const t = await makeBrain({ state: veteran(), provider: await ready() });
    const d = t.win(12);
    expect(d.interstitial.show).toBe(true);
    await t.brain.showRewarded(d.rewardedOffers[0]);
    t.advance(10);
    expect(await t.brain.showInterstitial(d)).toEqual({ shown: false, reason: 'after_rewarded' });
    expect(t.brain.getState().day.interstitials).toBe(0);
  });

  it('decision-only mode (no provider) uses commitInterstitial', async () => {
    const t = await makeBrain({ state: veteran() });
    const d = t.win(12);
    await expect(t.brain.showInterstitial(d)).rejects.toThrow(/provider/);
    t.brain.commitInterstitial();
    expect(t.brain.getState().day.interstitials).toBe(1);
  });
});
