import { describe, it, expect } from 'vitest';
import { makeBrain, veteran, T0, fixedDay } from './helpers.js';

// rng = 0 means "every roll passes if probability > 0", so a block can only come from a rule.
describe('hard blocks (no forced ad ever)', () => {
  it('levels 1-3 never get a forced ad, even starved and at max streak', async () => {
    for (const level of [1, 2, 3]) {
      const t = await makeBrain({ state: veteran({ roundsSinceInterstitial: 30, winStreak: 9 }) });
      const d = t.win(level);
      expect(d.interstitial.show).toBe(false);
      expect(d.interstitial.reason).toBe('early_levels');
    }
    const t = await makeBrain({ state: veteran() });
    expect(t.win(4).interstitial.show).toBe(true);
  });

  it('level 1-3 limit cannot be lowered by config', async () => {
    const t = await makeBrain({ state: veteran(), config: { blocks: { minInterstitialLevel: 1 } } });
    expect(t.win(2).interstitial.reason).toBe('early_levels');
  });

  it('never at round start or mid-play', async () => {
    const t = await makeBrain({ state: veteran() });
    const start = t.brain.handleEvent('level_start', { level: 12 });
    expect(start.interstitial.show).toBe(false);
    expect(start.interstitial.reason).toBe('in_play');
    const mid = t.brain.requestInterstitial();
    expect(mid.interstitial.show).toBe(false);
    expect(mid.interstitial.reason).toBe('in_play');
    // after the round ends the same request is fine
    t.brain.handleEvent('level_complete', { level: 12 });
  });

  it('never on a lost round, and never straight after one', async () => {
    const t = await makeBrain({ state: veteran() });
    t.brain.handleEvent('level_start', { level: 12 });
    const lost = t.brain.handleEvent('level_failed', { level: 12 });
    expect(lost.interstitial.show).toBe(false);
    expect(lost.interstitial.reason).toBe('lost_round');
    const after = t.brain.requestInterstitial();
    expect(after.interstitial.show).toBe(false);
    expect(after.interstitial.reason).toBe('lost_round');
  });

  it('never on a near miss', async () => {
    const t = await makeBrain({ state: veteran() });
    t.brain.handleEvent('level_start', { level: 12, game: 'dino-break' });
    const d = t.brain.handleEvent('near_miss', { level: 12, game: 'dino-break' });
    expect(d.interstitial.show).toBe(false);
    expect(d.interstitial.reason).toBe('near_miss');
  });

  it('app_open, streak_broken and boosters_empty never trigger a forced ad', async () => {
    const t = await makeBrain({ state: veteran({ roundsSinceInterstitial: 30 }) });
    for (const e of ['app_open', 'streak_broken', 'boosters_empty']) {
      expect(t.brain.handleEvent(e, { level: 12, streak: 5 }).interstitial.show).toBe(false);
    }
  });

  it('first win after 3+ losses is blocked; after 2 losses it is not', async () => {
    const a = await makeBrain({ state: veteran() });
    a.lose(12); a.lose(12); a.lose(12);
    const w = a.win(12);
    expect(w.interstitial.show).toBe(false);
    expect(w.interstitial.reason).toBe('first_win_after_losses');
    // the next win is no longer "first win after losses"
    a.advance(120);
    expect(a.win(13).interstitial.show).toBe(true);

    const b = await makeBrain({ state: veteran() });
    b.lose(12); b.lose(12);
    expect(b.win(12).interstitial.show).toBe(true);
  });

  it('loss streak >= 4 blocks the next three wins, the fourth is free', async () => {
    const t = await makeBrain({ state: veteran() });
    for (let i = 0; i < 4; i++) t.lose(12);
    const reasons = [];
    for (let lvl = 12; lvl < 17; lvl++) {
      t.advance(120);
      reasons.push(t.win(lvl).interstitial.reason);
    }
    expect(reasons.slice(0, 3)).toEqual(['first_win_after_losses', 'loss_streak_block', 'loss_streak_block']);
    expect(reasons[3]).toBe('roll_passed');
    expect(reasons[4]).toBe('roll_passed');
  });

  it('a loss streak of 3 does not start the multi-level block', async () => {
    const t = await makeBrain({ state: veteran() });
    t.lose(12); t.lose(12); t.lose(12);
    t.win(12);
    t.advance(120);
    expect(t.win(13).interstitial.reason).toBe('roll_passed');
  });

  it('ads_removed segment never sees a forced ad', async () => {
    const t = await makeBrain({ state: veteran({ adsRemoved: true, roundsSinceInterstitial: 30 }) });
    const d = t.win(12);
    expect(d.interstitial.show).toBe(false);
    expect(d.interstitial.reason).toBe('ads_removed');
  });
});

describe('pacing limits', () => {
  it('60 s cooldown between forced ads', async () => {
    const t = await makeBrain({ state: veteran({ lastInterstitialAt: T0 - 59_000 }) });
    expect(t.win(12).interstitial.reason).toBe('cooldown');
    const u = await makeBrain({ state: veteran({ lastInterstitialAt: T0 - 60_000 }) });
    expect(u.win(12).interstitial.show).toBe(true);
  });

  it('at least 2 rounds between forced ads', async () => {
    const a = await makeBrain({ state: veteran({ roundsSinceInterstitial: 0 }) });
    expect(a.win(12).interstitial.reason).toBe('min_rounds'); // only 1 round since the ad
    const b = await makeBrain({ state: veteran({ roundsSinceInterstitial: 1 }) });
    expect(b.win(12).interstitial.show).toBe(true); // this is the 2nd round
  });

  it('losses count as rounds for spacing', async () => {
    const t = await makeBrain({ state: veteran({ roundsSinceInterstitial: 0 }) });
    t.lose(12);
    expect(t.win(12).interstitial.show).toBe(true);
  });

  it('no forced ad within 90 s of a rewarded ad', async () => {
    const a = await makeBrain({ state: veteran({ lastRewardedAt: T0 - 89_000 }) });
    expect(a.win(12).interstitial.reason).toBe('after_rewarded');
    const b = await makeBrain({ state: veteran({ lastRewardedAt: T0 - 90_000 }) });
    expect(b.win(12).interstitial.show).toBe(true);
  });

  it('hard cap of 8 forced ads per day, resets next day', async () => {
    const t = await makeBrain({ state: veteran({ day: { key: fixedDay(T0), interstitials: 8, rewardedOffered: 0, rewardedShown: 0, rounds: 0 } }) });
    expect(t.win(12).interstitial.reason).toBe('daily_hard_cap');
    t.advance(24 * 3600);
    expect(t.win(13).interstitial.show).toBe(true);
    expect(t.brain.getState().day.interstitials).toBe(0);
  });

  it('seven ads today is still under the hard cap', async () => {
    const t = await makeBrain({ state: veteran({ day: { key: fixedDay(T0), interstitials: 7, rewardedOffered: 0, rewardedShown: 0, rounds: 0 } }) });
    expect(t.win(12).interstitial.show).toBe(true);
  });

  it('soft budget of 4 per day cuts the probability instead of blocking', async () => {
    const under = await makeBrain({ state: veteran({ day: { key: fixedDay(T0), interstitials: 3, rewardedOffered: 0, rewardedShown: 0, rounds: 0 } }) });
    const over = await makeBrain({ state: veteran({ day: { key: fixedDay(T0), interstitials: 4, rewardedOffered: 0, rewardedShown: 0, rounds: 0 } }) });
    const u = under.win(12).interstitial;
    const o = over.win(12).interstitial;
    expect(u.factors.overSoftBudget).toBe(false);
    expect(o.factors.overSoftBudget).toBe(true);
    expect(o.probability).toBeCloseTo((0.35 + 0.05 - 4 * 0.04) * 0.5, 10);
  });

  it('rewarded offers: max 10 per day', async () => {
    const t = await makeBrain({ state: veteran({ day: { key: fixedDay(T0), interstitials: 0, rewardedOffered: 10, rewardedShown: 0, rounds: 0 } }) });
    const d = t.win(12);
    expect(d.rewardedOffers).toHaveLength(0);
    expect(d.rewardedSuppressed).toBe('daily_offer_cap');
  });

  it('rewarded offers: minimum gap 15 s', async () => {
    const t = await makeBrain({ state: veteran() });
    expect(t.win(12).rewardedOffers).toHaveLength(1);
    t.advance(14);
    const second = t.win(13);
    expect(second.rewardedOffers).toHaveLength(0);
    expect(second.rewardedSuppressed).toBe('offer_gap');
    t.advance(1);
    expect(t.win(14).rewardedOffers).toHaveLength(1);
  });
});

describe('moments', () => {
  it('history video every 50 levels is not an ad and does not touch ad counters', async () => {
    const t = await makeBrain({ state: veteran({ winStreak: 3 }) });
    const d = t.win(50);
    expect(d.historyVideo).toBe(true);
    const before = t.brain.getState();
    expect(before.day.interstitials).toBe(0);
    expect(before.lastInterstitialAt).toBeNull();
    expect(before.lifetime.interstitials).toBe(0);
    for (const lvl of [49, 51, 99]) {
      t.advance(300);
      expect(t.win(lvl).historyVideo).toBe(false);
    }
    t.advance(300);
    expect(t.win(100).historyVideo).toBe(true);
  });

  it('history video level does not also get a forced ad (default), but can if configured', async () => {
    const a = await makeBrain({ state: veteran() });
    a.win(50);
    const done = a.brain.handleEvent('celebration_done', { level: 50 });
    expect(done.historyVideo).toBe(true);
    expect(done.interstitial.show).toBe(false);
    expect(done.interstitial.reason).toBe('history_video');

    const b = await makeBrain({ state: veteran(), config: { moments: { historyVideoSuppressesInterstitial: false } } });
    b.win(50);
    expect(b.brain.handleEvent('celebration_done', { level: 50 }).interstitial.show).toBe(true);
  });

  it('milestone level: ad waits for the celebration screen', async () => {
    const t = await makeBrain({ state: veteran() });
    const c = t.win(20);
    expect(c.interstitial.show).toBe(false);
    expect(c.interstitial.reason).toBe('await_celebration');
    const done = t.brain.handleEvent('celebration_done', { level: 20 });
    expect(done.interstitial.show).toBe(true);
    expect(done.interstitial.placement).toBe('milestone');
    expect(done.interstitial.factors.milestone).toBe(0.15);
  });

  it('celebration_done without a pending milestone does nothing', async () => {
    const t = await makeBrain({ state: veteran() });
    t.win(12);
    const d = t.brain.handleEvent('celebration_done', { level: 12 });
    expect(d.interstitial.show).toBe(false);
    expect(d.interstitial.reason).toBe('no_pending_milestone');
    // and a milestone can only be cashed once
    t.advance(300);
    t.win(20);
    expect(t.brain.handleEvent('celebration_done', { level: 20 }).interstitial.show).toBe(true);
    expect(t.brain.handleEvent('celebration_done', { level: 20 }).interstitial.reason).toBe('no_pending_milestone');
  });

  it('celebration after a milestone still honours the hard blocks', async () => {
    const t = await makeBrain({ state: veteran({ lastInterstitialAt: T0 - 10_000 }) });
    t.win(20);
    expect(t.brain.handleEvent('celebration_done', { level: 20 }).interstitial.reason).toBe('cooldown');
  });

  it('app_open starts a session and rolls the day over', async () => {
    const t = await makeBrain({ state: veteran({ day: { key: fixedDay(T0), interstitials: 5, rewardedOffered: 3, rewardedShown: 1, rounds: 9 } }) });
    t.advance(25 * 3600);
    t.brain.handleEvent('app_open');
    const s = t.brain.getState();
    expect(s.day.interstitials).toBe(0);
    expect(s.day.rewardedOffered).toBe(0);
    expect(s.lifetime.sessions).toBe(1);
  });

  it('unknown events are rejected loudly', async () => {
    const t = await makeBrain();
    expect(() => t.brain.handleEvent('level_clear')).toThrow(/unknown/);
  });
});
