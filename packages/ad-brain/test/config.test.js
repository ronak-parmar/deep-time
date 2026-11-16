import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, validateConfig, hardLimits } from '../src/index.js';
import { makeBrain, veteran, fixedDay, T0 } from './helpers.js';
const day = (n) => ({ key: fixedDay(T0), interstitials: n, rewardedOffered: 0, rewardedShown: 0, rounds: 0 });

describe('defaults are the docs/02 numbers', () => {
  it('match the spec', () => {
    const c = DEFAULT_CONFIG;
    expect(c.prob).toMatchObject({ base: 0.35, perWinStreak: 0.05, streakCap: 6, lossPenalty: 0.15, perAdToday: 0.04, milestoneBonus: 0.15, catchUpBonus: 0.1, starvationBonus: 0.3, starvationRounds: 8, max: 0.9 });
    expect(c.pacing).toMatchObject({ cooldownSec: 60, minRoundsBetween: 2, rewardedGuardSec: 90, softBudgetPerDay: 4, hardCapPerDay: 8, rewardedMaxPerDay: 10, rewardedMinGapSec: 15 });
    expect(c.blocks).toMatchObject({ minInterstitialLevel: 4, winAfterLossesThreshold: 3, lossStreakBlock: 4 });
    expect(c.moments).toMatchObject({ milestoneEvery: 10, historyVideoEvery: 50, helpLossStreak: 2 });
  });
  it('are frozen', () => {
    expect(Object.isFrozen(DEFAULT_CONFIG)).toBe(true);
    expect(Object.isFrozen(DEFAULT_CONFIG.prob)).toBe(true);
  });
  it('validate cleanly', () => {
    const r = validateConfig(DEFAULT_CONFIG);
    expect(r.issues).toEqual([]);
    expect(r.config).toEqual(DEFAULT_CONFIG);
  });
  it('undefined/null means defaults without issues', () => {
    expect(validateConfig(undefined).config).toBe(DEFAULT_CONFIG);
    expect(validateConfig(null).issues).toEqual([]);
  });
});

describe('clamping to hard ceilings', () => {
  const clamp = (partial) => validateConfig(partial).config;
  it('probability max never above 0.9', () => {
    expect(clamp({ prob: { max: 1 } }).prob.max).toBe(0.9);
    expect(clamp({ prob: { max: 5 } }).prob.max).toBe(0.9);
    expect(clamp({ prob: { max: 0.5 } }).prob.max).toBe(0.5); // stricter is fine
  });
  it('daily caps', () => {
    expect(clamp({ pacing: { hardCapPerDay: 100 } }).pacing.hardCapPerDay).toBe(8);
    expect(clamp({ pacing: { rewardedMaxPerDay: 99 } }).pacing.rewardedMaxPerDay).toBe(10);
    expect(clamp({ pacing: { hardCapPerDay: 2 } }).pacing.hardCapPerDay).toBe(2);
  });
  it('soft budget cannot exceed the hard cap', () => {
    const r = validateConfig({ pacing: { softBudgetPerDay: 8, hardCapPerDay: 3 } });
    expect(r.config.pacing.softBudgetPerDay).toBe(3);
    expect(r.issues.some((i) => i.path === 'pacing.softBudgetPerDay')).toBe(true);
  });
  it('spacing floors', () => {
    const c = clamp({ pacing: { cooldownSec: 0, minRoundsBetween: 0, rewardedGuardSec: 1, rewardedMinGapSec: -4 } });
    expect(c.pacing.cooldownSec).toBe(30);
    expect(c.pacing.minRoundsBetween).toBe(1);
    expect(c.pacing.rewardedGuardSec).toBe(45);
    expect(c.pacing.rewardedMinGapSec).toBe(10);
  });
  it('hard-block settings cannot be weakened', () => {
    const c = clamp({ blocks: { minInterstitialLevel: 1, lossStreakBlock: 9, winAfterLossesThreshold: 50, levelsBlockedAfterLossStreak: 0 } });
    expect(c.blocks.minInterstitialLevel).toBe(4);
    expect(c.blocks.lossStreakBlock).toBe(4);
    expect(c.blocks.winAfterLossesThreshold).toBe(3);
    expect(c.blocks.levelsBlockedAfterLossStreak).toBe(2);
  });
  it('can be made stricter', () => {
    const c = clamp({ pacing: { cooldownSec: 300 }, blocks: { minInterstitialLevel: 10 } });
    expect(c.pacing.cooldownSec).toBe(300);
    expect(c.blocks.minInterstitialLevel).toBe(10);
  });
  it('integers are rounded', () => {
    expect(clamp({ prob: { streakCap: 4.6 } }).prob.streakCap).toBe(5);
  });
  it('reports each clamp as an issue', () => {
    const r = validateConfig({ prob: { max: 2 } });
    expect(r.issues).toContainEqual(expect.objectContaining({ path: 'prob.max', used: 0.9 }));
  });
  it('every numeric leaf has a limit table entry that contains its default', () => {
    const lim = hardLimits();
    expect(Object.keys(lim).length).toBeGreaterThan(30);
    for (const [path, { min, max }] of Object.entries(lim)) {
      const v = path.split('.').reduce((o, k) => o[k], DEFAULT_CONFIG);
      expect(v, path).toBeGreaterThanOrEqual(min);
      expect(v, path).toBeLessThanOrEqual(max);
    }
  });
});

describe('invalid config falls back to defaults', () => {
  it.each([['string', 'oops'], ['number', 42], ['array', []], ['function', () => 1], ['boolean', true]])('non-object (%s)', (_n, bad) => {
    const r = validateConfig(bad);
    expect(r.config).toBe(DEFAULT_CONFIG);
    expect(r.usedDefaults).toBe(true);
    expect(r.issues.length).toBe(1);
  });
  it('wrong-typed values fall back to that key default', () => {
    const r = validateConfig({ prob: { base: 'high', max: NaN, perWinStreak: Infinity, streakCap: null }, pacing: { cooldownSec: '60' }, moments: { historyVideoSuppressesInterstitial: 'yes' } });
    expect(r.config.prob.base).toBe(0.35);
    expect(r.config.prob.max).toBe(0.9);
    expect(r.config.prob.perWinStreak).toBe(0.05);
    expect(r.config.prob.streakCap).toBe(6);
    expect(r.config.pacing.cooldownSec).toBe(60);
    expect(r.config.moments.historyVideoSuppressesInterstitial).toBe(true);
    expect(r.issues.length).toBe(6);
  });
  it('group that is not an object falls back to defaults for the group', () => {
    const r = validateConfig({ pacing: 7 });
    expect(r.config.pacing).toEqual(DEFAULT_CONFIG.pacing);
  });
  it('unknown keys are ignored and reported', () => {
    const r = validateConfig({ hax: 1, prob: { godMode: true } });
    expect(r.config.hax).toBeUndefined();
    expect(r.config.prob.godMode).toBeUndefined();
    expect(r.issues.map((i) => i.path).sort()).toEqual(['hax', 'prob.godMode']);
  });
  it('does not mutate its input and ignores prototype pollution keys', () => {
    const input = JSON.parse('{"__proto__":{"polluted":1},"prob":{"base":0.5}}');
    const copy = structuredClone(input);
    const r = validateConfig(input);
    expect(input).toEqual(copy);
    expect({}.polluted).toBeUndefined();
    expect(r.config.prob.base).toBe(0.5);
  });
  it('a brain given garbage config behaves like defaults', async () => {
    const good = await makeBrain({ state: veteran() });
    const bad = await makeBrain({ state: veteran(), config: 'not json' });
    expect(bad.brain.config).toBe(DEFAULT_CONFIG);
    expect(bad.win(12).interstitial.probability).toBe(good.win(12).interstitial.probability);
    expect(bad.brain.configIssues.length).toBe(1);
  });
});

describe('remote config tuning works inside the limits', () => {
  it('a remote cooldown of 120 s is honoured', async () => {
    const t = await makeBrain({ state: veteran({ lastInterstitialAt: Date.UTC(2026, 0, 1, 12) - 100_000 }), config: { pacing: { cooldownSec: 120 } } });
    expect(t.win(12).interstitial.reason).toBe('cooldown');
  });
  it('a remote hard cap of 2 is honoured', async () => {
    const t = await makeBrain({ state: veteran({ day: day(2) }), config: { pacing: { hardCapPerDay: 2 } } });
    expect(t.win(12).interstitial.reason).toBe('daily_hard_cap');
  });
  it('a remote hard cap of 99 still stops at 8', async () => {
    const t = await makeBrain({ state: veteran({ day: day(8) }), config: { pacing: { hardCapPerDay: 99 } } });
    expect(t.win(12).interstitial.reason).toBe('daily_hard_cap');
  });
});
