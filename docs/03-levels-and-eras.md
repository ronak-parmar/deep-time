# 03. Levels, eras, play time and history videos

## Procedural levels

- Seed = level number (deterministic, reproducible).
- Difficulty target = base **0.10** + **0.025 per era** + up to **0.30** across the era, capped at **0.80**.
- Breather every 5th level and the first level of each era (the first level introduces the era's twist on an easy level, so a new mechanic is always taught gently).
- Milestone: every 10th level is harder.
- A bot plays each generated level; accepted when its win rate lands in the band `1 - target +/- 0.1`.
- Telemetry flags outlier levels (too easy/hard) in live play.
- Hand-authored only for onboarding: first 10 brick levels, first 15 gem levels.
- An earlier curve (0.04 per era, up to 0.45 across the era, cap 0.95) was rejected: last era took 2.7x as long as the first and a milestone could hit a 5% win rate. To make dinosaur eras feel bigger, add levels rather than steepening the curve.

## The 10 eras (100 levels each)

| Era | Levels | Approximate time | Look | Brick breaker twist | Gem match twist |
| --- | --- | --- | --- | --- | --- |
| Cambrian | 1 to 100 | 540 to 485 Ma | Shallow sea floor, coral colors, shell blocks | None; teaches the basics | None; teaches swaps and specials |
| Devonian | 101 to 200 | 420 to 360 Ma | Teal water and kelp, scale-pattern blocks | Rock-tier blocks appear | Sixth stone kind |
| Carboniferous | 201 to 300 | 360 to 300 Ma | Giant ferns and swamp, bark blocks | Blocks that drift slowly sideways | Boulders |
| Permian | 301 to 400 | 300 to 250 Ma | Dry red canyons, sandstone blocks | Unbreakable basalt columns | Crusted tiles needing two nearby matches |
| Triassic | 401 to 500 | 250 to 200 Ma | Desert dusk and volcano glow, clay blocks | Blocks that regrow once after breaking | Vines that spread one tile if left alone |
| Jurassic | 501 to 600 | 200 to 145 Ma | Ferns and mist, mossy stone | Explosive blocks that break neighbors | Countdown bombs |
| Cretaceous | 601 to 700 | 145 to 66 Ma | Red sunsets, basalt | Wind zones that nudge the ball | Portals linking two tiles |
| Age of mammals | 701 to 800 | 66 Ma to 2.6 Ma | Ash sky clearing to grassland, amber-resin blocks | Amber-sealed blocks releasing a power-up | Amber-trapped stones releasing a special gem |
| Ice age | 801 to 900 | 2.6 Ma to 12,000 years ago | Glaciers and aurora, ice blocks | Ice blocks that crack in stages | Frozen tiles that thaw |
| Early humans | 901 to 1000 | 300,000 to 5,000 years ago | Cave walls and firelight, painted stone blocks | Boss walls mixing earlier twists | Boss boards mixing earlier blockers |

Time spans are approximate and must be checked against museum/scientific sources before any script is written. The last level of each era is a milestone. Each era is a data pack (theme tokens, twist, story card, journal entry); levels after 1000 cycle back through the eras at higher base difficulty.

Fossil per era (art list): ammonite/trilobite (Cambrian), fish, fern, early reptile, early dinosaur piece, sauropod bone, meteor-era shell, mammal tusk, mammoth tooth, hand axe.

## History videos

- 2 per era (at levels 50 and 100 of the era, i.e. every 50 levels): 20 total.
- 10-20 seconds, made from code (animation), captions, no stock footage, no narrator in v1.
- Skippable; not an ad; unlocks a field-journal entry.
- Shipped as on-demand packs, about 40-80 MB total.
- Every fact checked against a source before the script is written.

## Play-time model

- Brick breaker: 3.4-4.8 h per era (about 40 h total).
- Gem match: 4.5-6.5 h per era (about 54 h total).
- Win rate drifts from 76% (early) to 54% (late).
- Assumptions: 90 s per attempt (brick), 120 s per attempt (gem).
- Full table with per-era numbers is in plan-full.md ("Play time per era").
