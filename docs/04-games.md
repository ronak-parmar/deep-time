# 04. The two games

Full original text is in plan-full.md ("Game 1", "Game 2"). This file adds decisions made after the plan.

## Common

- Canvas 360 x 640 portrait, HUD 56 px, touch targets 48 px.
- Same design system, same ad-brain, same save layer.
- Result screen after every round with coins, stars, and the ad moments in docs/02.
- History card/video every 50 levels.

## Dino Break (brick breaker)

- Paddle + ball + bricks. Bricks have 5 tiers (1 to 5 hits) shown by material.
- Per-era twist (e.g. new brick behaviours) introduced on the first, easy level of the era.
- Juice in the preview: ball trail, hit flash, squash/stretch, screen shake, combo counter.
- Near miss offers rewarded +1 ball.
- Avoid names and layouts that copy Arkanoid/Breakout.

## Dino Match (gem match with dig goal)

- Grid of gems; swipe or tap-tap to swap; match 3+, cascades, bounce/ease animation.
- **Dig the fossil goal**: 12 dirt cells sit over a buried fossil (ammonite in the Cambrian preview). Matches next to dirt crumble it; clear all dirt to reveal the fossil and win.
- **Boosters**: pick (break one cell), burst (area clear), brush (clear dirt/line). In the preview they refill via a demo rewarded ad. In the real game they refill via rewarded ads and coins.
- Six gems with unique silhouettes (lava diamond, amber hexagon, jade rounded square, ice circle, geode triangle, bone star).
- Near miss offers rewarded +5 moves.
- Per-era twist (e.g. more dirt, locked cells) introduced on the era's first level.
- Moves limit per level; the target is the dig goal.

## Preview behaviours worth keeping in the real build

- Swipe and tap input; gem tween/ease/bounce; cascade() chain; tryMove() validates swap; afterMove() checks goals; crumble() animates dirt.
- Interstitial countdown screen in preview demonstrates the ad pacing UI.
- Era chips switch the whole scenery (see docs/06).

## v1 progression and economy (decided Nov 2026, applies first to Dino Match)

Inspired by Gardenscapes: stars there become pickaxes here, and the garden becomes a fossil dig.

### Currencies

- **Moves** (in-level): the budget for one level. A move that makes a match digs one dirt block. Coins buy +5 moves on a near miss; a rewarded ad can give the same +5.
- **Pickaxes** (progress): 1 per win (optional bonus for leftover moves, later). Replaying a won level gives none. Spent only on unearthing fossil parts.
- **Coins** (flexible): earned from wins and bonuses; spent on +5 moves, booster refills, and life refills. A rewarded ad on the win screen can double the win coins.

Pickaxes are never sold or bought with ads. Ads and coins only help win levels.

### Fossils

- Each fossil has **10 parts**. A part costs **5 pickaxes**, so one part every 5 levels and one fossil every 50 levels.
- The player taps to spend pickaxes and unearth a part (a small reveal animation). Pickaxes pile up until spent.
- Each era is 100 levels = 2 fossils. 10 eras = 20 fossils at launch scale. Rich eras (e.g. Jurassic) can get extra fossils in later updates.
- **History video** plays when a fossil is complete (every 50 levels, so it matches docs/01). Skippable, made from code, not an ad, unlocks a field-journal entry about that creature.
- The fossils tie in with the era's gem emblem creatures (e.g. Cambrian: Anomalocaris, trilobite).

### Lives

- 5 lives. Losing a level costs 1 life; winning costs nothing. Lives regenerate on a timer (start generous, about 25 to 30 minutes each; tune later).
- Refill options: wait, rewarded ad (opt-in), or coins.
- When lives are gone the player can still spend pickaxes on fossil parts, so the wait is useful.
- Supersedes the earlier "no energy timer" lean in HANDOFF.md.

### Ads fit

- "Out of moves" popup only on near misses: +5 moves for coins or a rewarded ad. No forced ads after a loss.
- "Out of lives" popup offers rewarded refill only, never a forced ad.
- Double-coins rewarded offer stays on the win screen.
- No ad in the middle of a history video; any ad comes after it, on the milestone rules in docs/02.

### Audience (decided for now)

- Everyone, 13+, as in CLAUDE.md. A kids / child-directed build (non-personalised ads, minimal data, local saves) is deferred. Note: under India's DPDP law anyone under 18 counts as a child, with obligations from 13 May 2027, so revisit before launching in India.

## Roster-driven eras (M1)
The fossil roster (`games/dino-match/src/data/roster.js`, 47 fossils) drives everything. Each fossil = 50 levels (`CONFIG.fossils.levelsPerFossil`), so era length = 50 x fossil count. Levels per era: Cambrian 150, Devonian 150, Carboniferous 150, Permian 200, Triassic 300, Jurassic 400, Cretaceous 350, Age of mammals 200, Ice age 300, Early humans 150. Total 2350, then the game cycles with harder numbers. A fossil has 10 parts and 5 pickaxes per part (50 pickaxes). Facts list: docs/13-fossil-facts.md.
