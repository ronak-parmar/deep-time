# 02. ad-brain: ad-revenue decision plugin

## Principle

Games report events and ask for decisions. They never call ad networks. The brain is engine-agnostic and testable in a simulator before any real ad ID exists.

## Adapters

- `IAdProvider`: Mock first, then AdMob.
- `SaveStore`: Local first, then Play Games saved games (custom merge: higher level wins, larger coin total, remove-ads kept if either copy has it).
- Analytics adapter.

## Forced (interstitial) ad probability

Starts at **35%** and is adjusted, never certain. Design numbers:

| Input | Effect |
| --- | --- |
| Base | 0.35 |
| Win streak | +0.05 per win, streak counted up to 6 |
| Loss | -0.15 |
| Ads already shown today | -0.04 each |
| Milestone level (every 10th) after the celebration | +0.15 |
| Catch-up (behind on expected revenue) | +0.10 |
| Starvation: 8 rounds without an ad | +0.30 (revenue-floor nudge) |
| Maximum | 0.9 (never certain) |

Segment adjusts the numbers: new, rewarded-lover, ad-averse, spender, ads-removed.

## Pacing limits

- Cooldown 60 s between forced ads.
- At least 2 rounds between forced ads.
- No forced ad within 90 s of a rewarded ad.
- Soft budget 4 forced ads per day; hard cap 8 per day.
- Rewarded offers at most 10 per day, minimum gap about 15 s.

## Hard blocks (no forced ad ever)

- Levels 1-3.
- Round start or mid-play.
- Lost rounds.
- Near-miss.
- First win after 3 or more losses.
- After loss streak >= 4: no forced ads for the next few levels.

## Ad moments per game

Interstitials only on happy moments:

- Level clear (streak >= 3 slightly higher chance).
- Milestone every 10th level: higher chance after the celebration screen.

Rewarded offers on need moments:

- Streak just broken: offer to save the streak.
- Near miss: +1 ball (brick) / +5 moves (gem).
- Loss streak >= 2: help offers.
- First win after >= 3 losses: double coins.
- Normal clear: double coins.
- Boosters empty (Dino Match): refill pick/burst/brush.
- Reward buttons are kept away from game buttons to avoid accidental taps.

## Config safety

- Hard ceilings in code that no config can exceed.
- Remote config values are clamped to those ceilings.
- Invalid config falls back to defaults.
- Starting numbers are placeholders; tune in simulator, then live data.

## Simulator

Build a simulator that runs synthetic player profiles (new, rewarded-lover, ad-averse, spender) over thousands of sessions to measure ads/day, revenue proxy and churn proxy before wiring AdMob.

## Ad safety in development

AdMob test ad unit IDs and a registered test device only. Never click live ads. UMP consent form before first request where required. Live IDs only after AdMob approval.
