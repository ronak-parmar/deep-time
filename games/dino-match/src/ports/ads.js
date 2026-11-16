// AdPort: the only thing the game knows about ads. Mock adapter for now (no ads are shown in v1).
// Event names follow docs/02. ad-brain plugs in here later (it is not imported in this game).
export const AD_EVENTS = Object.freeze({
  levelStart: 'level_start',
  levelComplete: 'level_complete',
  levelFailed: 'level_failed',
  nearMiss: 'near_miss',
  streakBroken: 'streak_broken',
  boosterEmpty: 'booster_empty',
  rewardedOffer: 'rewarded_offer',       // payload: { kind: 'double_coins' | 'extra_moves' | 'refill_lives' }
  rewardedCompleted: 'rewarded_completed',
  livesEmpty: 'lives_empty',
  fossilComplete: 'fossil_complete'
});

// The mock never shows interstitials. Its rewarded ad "completes" after `delayMs` (set `completes:false` to test skips).
export function createMockAdPort({ log = false, delayMs = 700, completes = true } = {}) {
  const sent = [];
  return {
    sent,
    report(event, payload = {}) {
      sent.push({ event, payload });
      if (log) console.debug('[ads]', event, payload);
    },
    // kind: 'interstitial' | 'rewarded_offer'. The mock never shows anything.
    async requestDecision(kind) {
      return { kind, show: false };
    },
    async showRewarded() {
      await new Promise((r) => setTimeout(r, delayMs));
      return { completed: completes };
    }
  };
}
