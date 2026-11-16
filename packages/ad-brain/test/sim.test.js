import { describe, it, expect } from 'vitest';
import { runSimulation, formatReport, parseArgs } from '../sim/simulate.js';

const small = { players: 60, days: 4, seed: 5 };

describe('simulator', () => {
  it('is deterministic for a seed', async () => {
    const a = await runSimulation(small);
    const b = await runSimulation(small);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('respects every hard limit across thousands of simulated rounds', async () => {
    const r = await runSimulation({ ...small, players: 200, days: 5 });
    expect(r.overall.rounds).toBeGreaterThan(3000);
    expect(r.hardLimitViolations).toEqual({});
    expect(r.adsPerDayDistribution.max).toBeLessThanOrEqual(8);
  });
  it('stays within limits even with a hostile remote config', async () => {
    const r = await runSimulation({ ...small, config: { prob: { base: 5, max: 5, starvationBonus: 9 }, pacing: { hardCapPerDay: 500, cooldownSec: 0, minRoundsBetween: 0, rewardedGuardSec: 0 }, blocks: { minInterstitialLevel: 0 } } });
    expect(r.hardLimitViolations).toEqual({});
    expect(r.adsPerDayDistribution.max).toBeLessThanOrEqual(8);
  });
  it('config changes move the numbers (tuning works)', async () => {
    const low = await runSimulation({ ...small, config: { prob: { base: 0.05, perWinStreak: 0, starvationBonus: 0, catchUpBonus: 0 } } });
    const high = await runSimulation({ ...small, config: { prob: { base: 0.6 } } });
    expect(high.overall.interstitialsPerActiveDay).toBeGreaterThan(low.overall.interstitialsPerActiveDay);
  });
  it('ad-averse players see fewer forced ads than the average', async () => {
    const r = await runSimulation({ players: 300, days: 6, seed: 2, mix: { ad_averse: 0.5, regular: 0.5 } });
    expect(r.byProfile.ad_averse.interstitialsPerActiveDay).toBeLessThan(r.byProfile.regular.interstitialsPerActiveDay);
  });
  it('prints a report and parses CLI args', async () => {
    const text = formatReport(await runSimulation(small));
    expect(text).toMatch(/forced ads per session/);
    expect(text).toMatch(/HARD-LIMIT CHECK: none/);
    const a = parseArgs(['--players', '10', '--set', 'prob.base=0.2', '--sweep', 'pacing.cooldownSec=60,90']);
    expect(a.players).toBe(10);
    expect(a.config.prob.base).toBe(0.2);
    expect(a.sweep).toEqual(['pacing.cooldownSec', [60, 90]]);
    expect(() => parseArgs(['--nope'])).toThrow();
    expect(() => parseArgs(['--players', 'abc'])).toThrow();
  });
});
