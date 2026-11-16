/**
 * Behaviour model for synthetic players. EVERY number here is a guess, not data:
 * replace them with real telemetry once the games are live.
 *
 * skill            base win chance on an average level
 * sessionsPerDay   mean sessions on a day the player shows up
 * rounds           [min, max] rounds per session
 * roundSec         mean round length
 * acceptRewarded   chance to accept a rewarded offer (scaled up for near-miss / streak offers)
 * annoyance        how much each forced ad hurts (1 = typical)
 * baseChurn        daily churn hazard with no ads at all
 * returnRate       chance to come back on a given day
 * purchases        buys something on day 0 (not "remove ads"; they stay in the spender segment)
 */
export const PROFILES = {
  regular: { skill: 0.66, sessionsPerDay: 3, rounds: [4, 10], roundSec: 70, acceptRewarded: 0.3, annoyance: 1, baseChurn: 0.03, returnRate: 0.85, purchases: false },
  new: { skill: 0.74, sessionsPerDay: 3, rounds: [5, 12], roundSec: 60, acceptRewarded: 0.25, annoyance: 1.5, baseChurn: 0.08, returnRate: 0.9, purchases: false },
  rewarded_lover: { skill: 0.6, sessionsPerDay: 4, rounds: [6, 14], roundSec: 75, acceptRewarded: 0.7, annoyance: 0.8, baseChurn: 0.02, returnRate: 0.9, purchases: false },
  ad_averse: { skill: 0.64, sessionsPerDay: 2, rounds: [3, 8], roundSec: 65, acceptRewarded: 0.03, annoyance: 3, baseChurn: 0.04, returnRate: 0.75, purchases: false },
  spender: { skill: 0.66, sessionsPerDay: 3, rounds: [4, 10], roundSec: 70, acceptRewarded: 0.15, annoyance: 1.5, baseChurn: 0.02, returnRate: 0.9, purchases: true },
};

export const DEFAULT_MIX = { regular: 0.35, new: 0.25, rewarded_lover: 0.15, ad_averse: 0.15, spender: 0.1 };

/** Churn hazard added per forced ad shown that day, times profile annoyance. */
export const ANNOY_PER_AD = 0.012;
export const MAX_DAILY_HAZARD = 0.6;
