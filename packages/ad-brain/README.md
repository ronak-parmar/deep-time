# @deep-time/ad-brain

Engine-agnostic ad decision plugin for Dino Break and Dino Match. Games report events and ask for decisions; they never call an ad network. Vanilla JS ES modules, no runtime dependencies, no DOM. The spec is `docs/02-ad-brain.md`; every number from it is a config default in `src/config.js`.

```
npm install      # dev dependency: vitest only
npm test         # 124 tests
npm run sim      # simulator (see "Tuning")
```

## Layout

| File | Role |
| --- | --- |
| `src/index.js` | public API |
| `src/brain.js` | decision engine (`AdBrain`, `createAdBrain`, `EVENTS`, `REASONS`, `OFFERS`) |
| `src/config.js` | defaults, hard limits, `validateConfig` (clamp / fallback) |
| `src/state.js` | persistent state shape, `SaveStore` adapters, `mergeStates` |
| `src/rng.js` | seedable RNG (`createRng(seed)`) |
| `src/analytics.js` | `IAnalytics` sink (`track(name, props)`), memory/null/callback sinks |
| `src/providers/IAdProvider.js` | provider interface (JSDoc typedef) |
| `src/providers/MockProvider.js` | fake network: fill rate, latency, failures |
| `sim/simulate.js`, `sim/profiles.js` | Node CLI simulator and its behaviour model |

## Integrating a game (about 15 lines)

```js
import { createAdBrain, LocalStorageSaveStore, MockProvider } from '@deep-time/ad-brain';

const provider = new MockProvider({ interstitialFillRate: 0.9 });   // AdMob adapter later
await provider.init();
const brain = await createAdBrain({
  store: new LocalStorageSaveStore(localStorage),   // Play Games saved games later
  provider,
  config: remoteConfigOrUndefined,                  // clamped; garbage falls back to defaults
});

brain.handleEvent('level_start', { level, game: 'dino-match' });         // no ads, ever, from here to the end of the round
// ...round plays...
const d = brain.handleEvent('level_complete', { level, game: 'dino-match' });
if (d.historyVideo) await playHistoryVideo();                            // NOT an ad
for (const offer of d.rewardedOffers) showRewardButton(offer);           // opt-in: on tap -> brain.showRewarded(offer)
if (d.interstitial.show) await brain.showInterstitial(d);                // goes through the provider and is recorded
// milestone levels: ad decision arrives after the celebration screen
// const m = brain.handleEvent('celebration_done', { level }); if (m.interstitial.show) await brain.showInterstitial(m);
```

## Events (`brain.handleEvent(name, payload)`)

| Event | When the game sends it | Can return |
| --- | --- | --- |
| `app_open` | app start / resume | nothing (no app-open ads); rolls the day, counts the session |
| `level_start` | round begins | nothing (`in_play`); marks mid-play |
| `level_complete` | round won | forced ad (not on milestones), `double_coins` offer, `historyVideo` flag |
| `level_failed` | round lost | never an ad; `save_streak` or `help` offer, `streakBroken` info |
| `near_miss` | round about to be lost but close | `extra_ball` (dino-break) / `extra_moves` (dino-match) offer; never an ad |
| `streak_broken` | optional explicit streak-lost signal (`{streak}`) | `save_streak` offer (the `level_failed` decision already carries it) |
| `celebration_done` | milestone celebration screen finished | the milestone forced ad (+0.15) |
| `boosters_empty` | Dino Match booster count hit zero | `refill_boosters` offer |

`payload`: `{ level, game: 'dino-break' | 'dino-match', streak? }`. Unknown event names throw. `brain.requestInterstitial()` is a safety-net query for any other moment; it is refused mid-play and straight after a loss.

Other calls: `showInterstitial(decision)`, `showRewarded(offer)`, `declineRewarded(offer)`, `commitInterstitial()` (decision-only mode, no provider), `recordPurchase({removesAds})`, `setAdsRemoved()`, `setSegmentOverride(name|null)`, `setCoins(n)`, `getState()`, `getSegment()`.

## Decision object

```js
{
  id: 7, event: 'level_complete', level: 12, game: 'dino-match', segment: 'regular',
  interstitial: {
    show: true,                 // approved: call brain.showInterstitial(decision)
    reason: 'roll_passed',      // or a block reason, 'roll_failed', 'await_celebration' (see REASONS)
    placement: 'level_clear',   // 'level_clear' | 'milestone' | 'custom'
    probability: 0.4, roll: 0.13,
    factors: { base, winStreak, loss, adsToday, milestone, catchUp, starvation, subtotal, segmentScale, final, ... },
  },
  rewardedOffers: [{ id: 'o3', type: 'double_coins', placement: 'clear', payload?: {...} }],
  rewardedSuppressed: null,     // or 'daily_offer_cap' | 'offer_gap' | 'no_fill'
  historyVideo: false,          // true on every 50th level: play the video, it is not an ad and counts for nothing
  streakBroken: null,           // or { streak: 5 }
  meta: { adsToday, rewardedOfferedToday, roundsSinceInterstitial, winStreak, lossStreak },
}
```

Offer types: `double_coins`, `save_streak`, `extra_ball`, `extra_moves`, `help`, `refill_boosters`. The brain says which offer to show; the game decides what it grants (except `save_streak`, which the brain restores in its own state). Keep reward buttons away from game buttons (docs/02).

Block reasons: `ads_removed`, `in_play`, `lost_round`, `near_miss`, `early_levels`, `first_win_after_losses`, `loss_streak_block`, `history_video`, `daily_hard_cap`, `cooldown`, `min_rounds`, `after_rewarded`, `not_ready`.

## Rules implemented (docs/02)

- Hard blocks (hard-coded, not configurable away): levels 1 to 3; round start / mid-play; lost rounds and straight after one; near-miss; first win after 3+ losses; after a loss streak of 4+, the next 3 wins; `ads_removed` segment.
- Pacing: 60 s cooldown; at least 2 rounds between ads; 90 s after a rewarded ad; soft budget 4/day; hard cap 8/day; rewarded offers 10/day with a 15 s gap.
- Probability: 0.35 base, +0.05 per win in streak (up to 6), -0.15 after a loss, -0.04 per ad already shown today, +0.15 after a milestone celebration, +0.10 catch-up, +0.30 after 8 rounds without an ad, scaled by segment, capped at 0.9. The draw is clamped below 1, so a forced ad is never certain, even with a broken RNG.
- Segments: `regular`, `new`, `rewarded_lover`, `ad_averse`, `spender`, `ads_removed`. Classified from behaviour (see `segmentRules`) or forced with `setSegmentOverride`.
- Config safety: every numeric key has a hard `[min, max]` (`hardLimits()`); remote values are clamped; wrong types fall back to that key's default; a config that is not an object falls back to all defaults; `brain.configIssues` lists what was changed. Remote config can only make ad rules stricter than the ceilings, never looser.

## Tuning with the simulator

```
node sim/simulate.js --players 1000 --days 7 --seed 1
node sim/simulate.js --set prob.base=0.25 --set pacing.softBudgetPerDay=3
node sim/simulate.js --sweep prob.base=0.2,0.35,0.5
node sim/simulate.js --config remote.json --json
```

It runs the real brain against `MockProvider` on a virtual clock and reports forced ads per session and per day, rewarded watched, revenue proxy (eCPM assumptions `--ecpm-int` / `--ecpm-rew`), churn-risk proxy, soft/hard cap hit rates, why each ad moment did or did not show, and an independent check that no hard limit was broken. The player behaviour model (`sim/profiles.js`: skill, sessions per day, rewarded accept rate, annoyance, churn) is guesswork; replace it with real telemetry after launch, and treat the dollar figures as relative, not absolute.

Sample (1000 players, 7 days, seed 1): about 0.96 forced ads per session, 2.9 per active day (p90 5, max 8), $0.069 revenue proxy per active day, hard-limit check clean.

## Decisions I made (docs/02 was ambiguous)

All are config keys unless noted, so they are easy to change.

1. "Loss -0.15" applies to the win that directly follows a loss (previous round lost), since ads never show on a lost round itself.
2. "Streak >= 3 slightly higher chance" is covered by the +0.05 per win; no extra bonus on top.
3. "At least 2 rounds between ads": the round that ends right now counts, so ad after round N, then rounds N+1 and N+2 played, then eligible at the end of N+2. Losses count as rounds.
4. "Soft budget 4": not a block. Once reached (scaled by segment), probability is multiplied by `prob.softBudgetOverageScale` (0.5). The hard cap of 8 is a real block.
5. "Catch-up": behind when today's ads are below `softBudget / expectedRoundsPerDay * roundsToday - tolerance` (20 rounds/day expected, tolerance 0.5, needs 4+ rounds).
6. "After loss streak >= 4: next few levels": the next 3 won rounds (`blocks.levelsBlockedAfterLossStreak`). The first of those is also covered by the first-win rule.
7. Milestone ads are decided on `celebration_done`, not on `level_complete`. If a game never sends `celebration_done`, milestone levels simply get no ad.
8. A history-video level (every 50th) gets no forced ad (`moments.historyVideoSuppressesInterstitial`, default on). The video is never counted as an ad: no counter, cooldown or budget is touched.
9. `near_miss` is an offer-only event; the loss itself is accounted on the later `level_failed`. A round shows at most one offer when a near-miss offer was already made.
10. `save_streak` is offered when the broken streak was at least 3 (`moments.streakSaveMin`). If granted, the brain restores the streak and undoes the loss streak.
11. "Loss streak >= 2: help offers": one generic `help` offer; the game decides the help.
12. Rewarded offers are counted when issued (the 10/day cap and 15 s gap apply to offers, not just watched ads). Rewarded offers are allowed on levels 1 to 3 (opt-in, the hard block is for forced ads) and for `ads_removed` players. A `refill_boosters` offer is allowed mid-round (`moments.boosterOfferAllowedInPlay`).
13. If a rewarded ad was watched between the ad decision and `showInterstitial`, the forced ad is cancelled (90 s guard re-checked at show time).
14. If the provider has no ad ready the forced ad is skipped (`not_ready`) and a preload is requested; the same for rewarded (`no_fill`).
15. Segment multipliers (probScale, budgetScale) and classification thresholds are placeholders. `ads_removed` is fixed in code.
16. Time-based rules use the injected clock (`Date.now` by default); the "day" is the local calendar date.

## Open questions

- The `double_coins` offer on every normal clear burns the 10/day offer cap quickly in the simulator (about 90% of simulated player-days hit it with the placeholder behaviour model). Should it be offered on a fraction of clears, or only after the first few?
- Should rewarded offers count only when shown to the player, rather than when the brain issues them? (Needs the game to report "button was displayed".)
- Soft budget over-run: reduce probability (current) or stop starvation/catch-up boosts entirely?
- Is `ads_removed` meant to keep rewarded offers? Current: yes, they are opt-in.
- Child-safe mode for the Play Families risk (docs/05): not built; it would be a config preset with lower caps, not new code.
- Real eCPMs and the behaviour model need real data; the dollar numbers are placeholders.
