import { describe, it, expect } from 'vitest';
import { makeBrain, veteran, fixedDay, T0, MockProvider } from './helpers.js';

const mkProvider = async (o) => {
  const p = new MockProvider({ seed: 1, ...o });
  await p.init();
  return p;
};
const types = (d) => d.rewardedOffers.map((o) => o.type);

describe('rewarded offers (need moments, opt-in)', () => {
  it('normal clear offers double coins', async () => {
    const t = await makeBrain({ state: veteran() });
    const d = t.win(12);
    expect(types(d)).toEqual(['double_coins']);
    expect(d.rewardedOffers[0].placement).toBe('clear');
  });

  it('first win after 3+ losses offers double coins (comeback)', async () => {
    const t = await makeBrain({ state: veteran() });
    t.lose(12); t.advance(20); t.lose(12); t.advance(20); t.lose(12); t.advance(20);
    const d = t.win(12);
    expect(types(d)).toEqual(['double_coins']);
    expect(d.rewardedOffers[0].placement).toBe('comeback');
  });

  it('streak just broken offers to save it', async () => {
    const t = await makeBrain({ state: veteran({ winStreak: 4 }) });
    const d = t.lose(12);
    expect(d.streakBroken).toEqual({ streak: 4 });
    expect(types(d)).toEqual(['save_streak']);
    expect(d.rewardedOffers[0].payload.streak).toBe(4);
  });

  it('a tiny streak is not worth a save offer', async () => {
    const t = await makeBrain({ state: veteran({ winStreak: 2 }) });
    const d = t.lose(12);
    expect(d.streakBroken).toBeNull();
    expect(types(d)).toEqual([]);
  });

  it('explicit streak_broken event offers once per round', async () => {
    const t = await makeBrain({ state: veteran({ winStreak: 4 }) });
    t.brain.handleEvent('level_start', { level: 12 });
    expect(types(t.brain.handleEvent('streak_broken', { streak: 4 }))).toEqual(['save_streak']);
    t.advance(20);
    const failed = t.brain.handleEvent('level_failed', { level: 12 });
    expect(types(failed)).toEqual([]); // already offered this round
  });

  it('near miss: +1 ball in Dino Break, +5 moves in Dino Match', async () => {
    const a = await makeBrain({ state: veteran() });
    a.brain.handleEvent('level_start', { level: 12, game: 'dino-break' });
    expect(types(a.brain.handleEvent('near_miss', { level: 12, game: 'dino-break' }))).toEqual(['extra_ball']);
    const b = await makeBrain({ state: veteran() });
    b.brain.handleEvent('level_start', { level: 12, game: 'dino-match' });
    expect(types(b.brain.handleEvent('near_miss', { level: 12, game: 'dino-match' }))).toEqual(['extra_moves']);
  });

  it('near-miss offer is not stacked with another offer on the same failed round', async () => {
    const t = await makeBrain({ state: veteran({ winStreak: 4 }) });
    t.brain.handleEvent('level_start', { level: 12, game: 'dino-break' });
    t.brain.handleEvent('near_miss', { level: 12, game: 'dino-break' });
    t.advance(20);
    expect(types(t.brain.handleEvent('level_failed', { level: 12, game: 'dino-break' }))).toEqual([]);
  });

  it('loss streak >= 2 offers help, a single loss does not', async () => {
    const t = await makeBrain({ state: veteran() });
    expect(types(t.lose(12))).toEqual([]);
    t.advance(20);
    expect(types(t.lose(12))).toEqual(['help']);
  });

  it('boosters empty offers a refill', async () => {
    const t = await makeBrain({ state: veteran() });
    t.brain.handleEvent('level_start', { level: 12, game: 'dino-match' });
    const d = t.brain.handleEvent('boosters_empty', { level: 12, game: 'dino-match' });
    expect(types(d)).toEqual(['refill_boosters']);
    expect(d.interstitial.show).toBe(false);
  });

  it('booster offer mid-round can be switched off by config', async () => {
    const t = await makeBrain({ state: veteran(), config: { moments: { boosterOfferAllowedInPlay: false } } });
    t.brain.handleEvent('level_start', { level: 12, game: 'dino-match' });
    expect(types(t.brain.handleEvent('boosters_empty', {}))).toEqual([]);
  });

  it('offers are allowed on levels 1-3 (opt-in) and for ads_removed players', async () => {
    const a = await makeBrain({ state: veteran() });
    expect(types(a.win(2))).toEqual(['double_coins']);
    const b = await makeBrain({ state: veteran({ adsRemoved: true }) });
    expect(types(b.win(12))).toEqual(['double_coins']);
  });

  it('no offer when the provider has no rewarded fill', async () => {
    const provider = await mkProvider({ rewardedFillRate: 0 });
    const t = await makeBrain({ state: veteran(), provider });
    const d = t.win(12);
    expect(d.rewardedOffers).toEqual([]);
    expect(d.rewardedSuppressed).toBe('no_fill');
  });
});

describe('rewarded is strictly opt-in', () => {
  it('events never start a rewarded ad; only showRewarded does', async () => {
    const provider = await mkProvider();
    const t = await makeBrain({ state: veteran({ winStreak: 4 }), provider });
    const o = t.lose(12).rewardedOffers[0];
    t.advance(20);
    t.win(12);
    expect(o).toBeDefined();
    expect(provider.stats.rewardedShown).toBe(0); // offers alone show nothing
    const res = await t.brain.showRewarded(o);
    expect(res.granted).toBe(true);
    expect(provider.stats.rewardedShown).toBe(1);
  });

  it('an offer cannot be played twice or invented', async () => {
    const provider = await mkProvider();
    const t = await makeBrain({ state: veteran(), provider });
    const o = t.win(12).rewardedOffers[0];
    expect((await t.brain.showRewarded(o)).shown).toBe(true);
    expect((await t.brain.showRewarded(o)).error).toBe('unknown_offer');
    expect((await t.brain.showRewarded({ id: 'nope', type: 'double_coins' })).shown).toBe(false);
  });

  it('declining is recorded and the offer is gone', async () => {
    const provider = await mkProvider();
    const t = await makeBrain({ state: veteran(), provider });
    const o = t.win(12).rewardedOffers[0];
    t.brain.declineRewarded(o);
    expect(t.brain.getState().lifetime.rewardedDeclined).toBe(1);
    expect((await t.brain.showRewarded(o)).error).toBe('unknown_offer');
  });

  it('watching a rewarded ad blocks forced ads for 90 s', async () => {
    const provider = await mkProvider();
    const t = await makeBrain({ state: veteran(), provider });
    const o = t.win(12).rewardedOffers[0];
    await t.brain.showRewarded(o);
    t.advance(30);
    expect(t.win(13).interstitial.reason).toBe('after_rewarded');
    t.advance(61);
    expect(t.win(14).interstitial.reason).not.toBe('after_rewarded');
  });

  it('save_streak reward restores the streak', async () => {
    const provider = await mkProvider();
    const t = await makeBrain({ state: veteran({ winStreak: 5 }), provider });
    const o = t.lose(12).rewardedOffers[0];
    expect(t.brain.getState().winStreak).toBe(0);
    await t.brain.showRewarded(o);
    const s = t.brain.getState();
    expect(s.winStreak).toBe(5);
    expect(s.lossStreak).toBe(0);
  });

  it('closing the ad early gives no reward and no streak', async () => {
    const provider = await mkProvider({ rewardedCompletionRate: 0 });
    const t = await makeBrain({ state: veteran({ winStreak: 5 }), provider });
    const o = t.lose(12).rewardedOffers[0];
    const res = await t.brain.showRewarded(o);
    expect(res.shown).toBe(true);
    expect(res.granted).toBe(false);
    expect(t.brain.getState().winStreak).toBe(0);
  });
});
