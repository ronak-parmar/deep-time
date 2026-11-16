# Two-game plan: brick breaker + gem match

Nov 16, 2026 · Kratos

Two Vite JS games, a brick breaker and a gem-match puzzle, will ship from one repo on a shared design system and one reusable ad-brain plugin; no game code starts until this plan and the design system are approved.

## Scope and goals

Both games are free, general-audience (13+), Android-first, built in Vite JS and wrapped with Capacitor, with progress saved through Play Games Services.

- Ship two games from one repo: a brick breaker and a gem-match puzzle themed on prehistoric stones and crystals.
- One `ad-brain` plugin drives the ads in both; only the config and the event mapping differ per game.
- The design system is built and approved first, so both games share one visual language without copying anyone else's.
- Success is judged on day-1 and day-7 retention, ads per user per day, and 30-day revenue per user. Numeric targets are set after the first simulator baseline, not guessed here.
- Out of scope: our own backend, multiplayer, kids' audience, and in-app purchases other than remove-ads.

## Theme and art direction

Both games share one prehistoric ice-age world: frozen tundra, glaciers, volcanoes, amber and fossils, with dinosaur and mammoth-era animals as backdrop silhouettes. It is a setting, not a franchise: every character, name and look is ours.

| Element | Direction |
| --- | --- |
| World | Night-ice palette of deep blues with glacier highlights and amber and lava accents; a slow parallax of glacier, aurora and volcano silhouettes |
| Creatures | Original geometric silhouettes drawn from code (long-necked grazers, horned beasts, tusked giants); none modeled on a character from an existing film, show or game |
| Mascot | One invented creature of our own for menus and reward screens, designed once in the style guide and reused in both games |
| Names | Working titles Dino Break and Dino Match until cleared; no "Ice Age", "Jurassic" or similar franchise words, and none of their character names |
| Sound | Synthesized low drums, ice cracks and crystal tones, in place of recorded or licensed effects |
| Why it fits | Cold blue against warm amber gives strong contrast on a phone, and ice, rock and lava give natural brick tiers and blocker types |

The era and real animals are free to depict; film franchises and their characters are not, so we stay clear of look-alikes.

## Eras and history videos

Levels are grouped into ten eras that follow the history of the planet, so progress feels like traveling through time; each era brings a new look, a new twist and short history videos about what happened then.

| Era | Levels | Approximate time | Look | Brick breaker twist | Gem match twist |
| --- | --- | --- | --- | --- | --- |
| Cambrian | 1 to 100 | 540 to 485 million years ago | Shallow sea floor, coral colors, shell blocks | None; teaches the basics | None; teaches swaps and specials |
| Devonian | 101 to 200 | 420 to 360 million years ago | Teal water and kelp, scale-pattern blocks | Rock-tier blocks appear | Sixth stone kind |
| Carboniferous | 201 to 300 | 360 to 300 million years ago | Giant ferns and swamp, bark blocks | Blocks that drift slowly sideways | Boulders |
| Permian | 301 to 400 | 300 to 250 million years ago | Dry red canyons, sandstone blocks | Unbreakable basalt columns | Crusted tiles that need two nearby matches |
| Triassic | 401 to 500 | 250 to 200 million years ago | Desert dusk and volcano glow, clay blocks | Blocks that regrow once after breaking | Vines that spread one tile if left alone |
| Jurassic | 501 to 600 | 200 to 145 million years ago | Ferns and mist, mossy stone | Explosive blocks that break their neighbors | Countdown bombs |
| Cretaceous | 601 to 700 | 145 to 66 million years ago | Red sunsets, basalt | Wind zones that nudge the ball | Portals linking two tiles |
| Age of mammals | 701 to 800 | 66 to 2.6 million years ago | Ash sky clearing to grassland, amber-resin blocks | Amber-sealed blocks that release a power-up | Amber-trapped stones that release a special gem |
| Ice age | 801 to 900 | 2.6 million to 12,000 years ago | Glaciers and aurora, ice blocks | Ice blocks that crack in stages | Frozen tiles that thaw |
| Early humans | 901 to 1000 | 300,000 to 5,000 years ago | Cave walls and firelight, painted stone blocks | Boss walls mixing earlier twists | Boss boards mixing earlier blockers |

The time spans are approximate and are checked against museum or scientific sources before any story script is written. The last level of each era is a milestone level. The ten eras give 1,000 planned levels, but levels never run out: each era is a data pack (theme tokens, twist, story card, journal entry), so a new era is added as data without code changes, and levels after the last era cycle back through the eras at a higher base difficulty.

**History videos.** Every 50 levels a short history video plays, so each era has two: one at level 50 on what lived in the era, and one at level 100 on how it ended and what came next, which leads into the next era. Each is 10 to 20 seconds, animated by us from one shared template (scenes drawn from code, captions on screen, no stock footage, no narrator voice in version 1), and each unlocks a field-journal entry, a fossil card with a longer fact, in a collection screen. At roughly 2 to 4 MB a clip, all 20 videos come to about 40 to 80 MB, so they can ship as on-demand asset packs; Play's current size limits are to be checked before release. A new era's two videos are one script plus its theme pack.

Four rules keep the videos honest and unobtrusive: they are never styled like an ad and never counted as one, they are always skippable (skipping still unlocks the journal entry), they contain no ads, and they play after any ad moment, so the order is level clear, celebration, possible ad, then the video. An optional rewarded offer to reveal a bonus fossil can sit on the journal screen, because opt-in rewards fit the plan.

## Play time per era

At 100 levels each, an era takes about 3.4 to 4.8 hours in brick breaker and 4.5 to 6.5 hours in gem match, and later eras take longer because players need more retries. A history video therefore arrives roughly every 1.5 to 2.8 hours of brick breaker play and every 2 to 3.7 hours of gem match play.

| Era | Levels | Average win rate | Brick breaker hours | Gem match hours | Days at 20 min a day (brick / gem) |
| --- | --- | --- | --- | --- | --- |
| Cambrian | 1 to 100 | 76% | 3.4 | 4.5 | 10 / 13 |
| Devonian | 101 to 200 | 73% | 3.5 | 4.6 | 10 / 14 |
| Carboniferous | 201 to 300 | 71% | 3.6 | 4.8 | 11 / 14 |
| Permian | 301 to 400 | 69% | 3.7 | 5.0 | 11 / 15 |
| Triassic | 401 to 500 | 66% | 3.9 | 5.2 | 12 / 15 |
| Jurassic | 501 to 600 | 64% | 4.0 | 5.4 | 12 / 16 |
| Cretaceous | 601 to 700 | 61% | 4.2 | 5.6 | 13 / 17 |
| Age of mammals | 701 to 800 | 59% | 4.4 | 5.9 | 13 / 18 |
| Ice age | 801 to 900 | 56% | 4.6 | 6.1 | 14 / 18 |
| Early humans | 901 to 1000 | 54% | 4.8 | 6.5 | 15 / 19 |

All ten eras add up to about 40 hours in brick breaker and 54 in gem match, or roughly 4 to 5.5 months at 20 minutes a day. The inputs are assumptions to be replaced with real data after launch: a win rate equal to one minus the difficulty target, 90 seconds per brick breaker attempt, 120 seconds per gem match attempt, and no time counted for the videos.

The check also caught a flaw in the first curve (0.04 per era, up to 0.45 across the era, capped at 0.95): it made the last era take 2.7 times as long as the first and let a milestone level fall to a 5 percent win rate. The curve was softened to the formula in Level scaling. To make the dinosaur eras feel bigger, add levels to them rather than steepening the curve.

## Architecture

[Diagram: see docs/02-architecture.md]

The games report events and ask the ad-brain for decisions; they never call an ad network directly, so swapping the mock provider for AdMob, or adding a third game, changes only an adapter or a config file.

## Design system

One `tokens.json` file defines every color, size and timing, and generates the CSS variables and the JavaScript constants both games read, so a change in one place restyles everything. The deliverable is a living style-guide page in the repo showing every token and component, approved before any game code starts. All art is drawn from code and all sound is synthesized, so there are no asset licenses to track.

**Color tokens** (night-ice theme, one palette for both games)

| Token | Hex | Use |
| --- | --- | --- |
| bg-0 | #0B1220 | App background |
| bg-1 | #14223A | Play field and panels |
| surface | #1D3354 | Cards and modals |
| text | #F2F8FF | Primary text |
| text-dim | #9DB4CF | Secondary text |
| action | #FFC24B | Primary buttons, focus ring |
| reward | #3DDC97 | Rewarded-ad buttons, success |
| danger | #FF6A4D | Lives lost, errors |
| info | #6FD3FF | Hints and links |
| violet | #A678FF | Special power-ups |

Every text and background pair is checked against a 4.5:1 contrast ratio by a script in the build. Color never carries meaning alone: gems and bricks also differ by shape or marking.

**Type, spacing, shape and motion**

| Group | Decision |
| --- | --- |
| Typeface | Nunito (open license), bundled locally, with a system-font fallback; tabular numerals for scores |
| Type scale | 12, 14, 16, 20, 28, 40 px |
| Spacing | 4 px base: 4, 8, 12, 16, 24, 32, 48 |
| Shape | 8 px radius on buttons, 16 px on cards, full pill for counters; 1 px borders, no shadows |
| Touch targets | At least 48 px square, with 8 px or more between targets |
| Canvas | 360 by 640 logical portrait, scaled to the screen, respecting safe areas |
| Motion | 120 ms feedback, 220 ms interface, 400 ms rewards; ease-out; a reduced-motion setting turns off shake and particles |
| Sound | Synthesized with the browser audio API; one master mute; audio starts only after the first tap |

**Shared components and rules**

| Component | Rule |
| --- | --- |
| Primary and secondary button | Amber filled for the main action, outlined for the rest |
| Reward button | Green with a video glyph and the exact benefit in words (for example "Watch an ad: +1 ball"); never the same style as a game button |
| Ad overlay | Always labeled "Ad"; countdown visible; a real close control that appears on time and is never disguised |
| Placement | Reward buttons sit at least 24 px from the Next or Play button, on the opposite side where space allows |
| HUD | Lives, score, coins and level in one top bar, identical in both games |
| Level-complete and game-over screens | One template; the game fills in the stars, score and offers |
| Modal and toast | One style, one animation, used for consent, settings and messages |
| Consent screen | Shown before the first ad request where required; plain wording, equal-weight accept and manage buttons |

The design system is plain CSS and DOM, with no UI framework, so it works the same in both games and inside the Android wrapper.

Era theme packs and the history-video player are part of the system: each era overrides only the background, block skin and backdrop tokens, and the player has one template with a video frame, captions, a skip control and a progress bar.

## Game 1: brick breaker

The player slides a stone paddle to keep a boulder in play and smash a wall of blocks; a level is won when every breakable block is gone. The working title is Dino Break until a trademark and Play Store search clears it, and it will avoid "Arkanoid", "Breakout" and similar names.

| Area | Plan |
| --- | --- |
| Controls | Drag anywhere to move the paddle; tap to launch the ball |
| Lives | Three per level; a lost ball costs one life |
| Bricks | Blocks in five tiers by thickness, re-skinned for each era (shell, scale, bark, sandstone, clay, moss, basalt, amber, ice, painted stone), cracking visibly as they take hits and marked with notches so tier is readable without color; unbreakable blocks drawn as black basalt |
| Power-ups | Stampede (multi-ball), Tusk (wide paddle), Frost (slow ball) and Cave (one-time floor shield), each with our own icon |
| Coins | Earned per brick and per level; spent on cosmetic paddle and ball skins only, so nothing in the economy forces ad views |
| Art and sound | Ice, rock and lava textures, parallax backdrops and particles drawn on canvas; ice cracks, drum hits and crystal tones synthesized |
| Level source | Generated from the level number (see Level scaling), with the first ten levels hand-tuned |
| Original layouts | Pattern families (rows, pyramid, checkerboard, ring, mirrored shapes) written by us; no layout copied from any existing game |

Ball physics are deterministic: fixed 60 Hz update, angle set by where the ball hits the paddle, speed capped so a level cannot become unplayable. A stuck-ball detector nudges the ball if it loops without hitting a brick.

Events reported to the ad-brain: round start, round end (won or lost, with the fraction of bricks cleared), milestone every tenth level, and near-miss when the last ball is lost with 15 percent or less of the bricks left.

## Game 2: gem match

The player swaps two neighboring gems on an 8 by 8 board to line up three or more of one kind, within a limited number of moves, to hit the level goal. The working title is Dino Match, and the theme is prehistoric stones and crystals, so the name and art stay clear of candy, crush and saga wording that other publishers protect.

| Area | Plan |
| --- | --- |
| Gems | Five kinds at the start, a sixth added later; each differs by shape as well as color: lava-stone diamond, amber hexagon, jade square, ice-crystal circle, geode triangle, and fossil-bone star as the sixth |
| Matches | Three or more in a row or column clear and score; chains from refills multiply the score |
| Special gems | Four in a line makes a row-or-column clearer, five in a line makes a color clearer, an L or T makes an area blast; each has its own look and name |
| Goals | Reach a score, collect a number of one gem kind, or thaw every frozen tile; later levels combine two |
| Blockers | Frozen tiles that take one or two nearby matches to thaw, and boulders that clear only by adjacent matches |
| Moves | A fixed move count per level; no lives or energy timer in version 1, so a failed level can be retried at once |
| Board rules | No match on the opening board, at least one valid swap always available, and an automatic shuffle when none remains |
| Fairness | Refills come from a seeded sequence per level so a replay is reproducible; difficulty assist can only make a level easier |
| Art and sound | Stones and crystals drawn from code with the design-system palette; synthesized crystal tones that rise in pitch with each chain step |
| Level source | Generated from the level number, with the first fifteen levels hand-tuned to teach swaps, specials and blockers |

Events reported to the ad-brain: round start, round end (won or lost, with the fraction of the goal reached), milestone every tenth level, and near-miss when the moves run out with 85 percent or more of the goal done. The equivalent of brick breaker's extra ball is a rewarded offer of five more moves.

## Ad moments per game

Forced ads appear only on happy moments, and optional rewarded offers appear on moments of need; the same `ad-brain` handles both games and only the offer wording differs.

| Moment | Interstitial (both games) | Brick breaker rewarded offer | Gem match rewarded offer |
| --- | --- | --- | --- |
| Levels 1 to 3 | Never | None | None |
| Normal level clear | Chance-based, if cooldown and caps allow | Double coins | Double coins |
| Win streak of 3 or more | Slightly higher chance, level-clear screen only | Bonus power-up for the next level | Free starting special gem |
| Milestone level (every 10th) | Higher chance, after the celebration screen | Bonus chest | Bonus chest |
| Streak just broken (loss after 3 or more wins) | Never | Save your streak: revive with a fresh ball | Save your streak: five more moves |
| Near miss | Never | One extra ball | Five more moves |
| Loss streak of 2 or more | Never | Help: wide paddle for the retry | Help: shuffle and hint boosters |
| Loss streak of 4 or more | No forced ads for the next few levels | Help offer, plus quiet difficulty easing | Help offer, plus quiet difficulty easing |
| First win after 3 or more losses | Never (recovery moment) | Double coins | Double coins |
| Level start or mid-play | Never | None | None |

The starting limits, all kept in each game's config file and tuned in the simulator before launch: a 60-second cooldown, at least two rounds between forced ads, no forced ad within 90 seconds of a rewarded one, a soft budget of 4 forced ads a day with a hard cap of 8, and at most 10 rewarded views a day. Forced-ad chance starts at 35 percent and moves with streaks, fatigue and player segment, and never reaches certainty, so the pattern stays unpredictable. A revenue floor nudges the chance up if a player has gone eight rounds without an ad. Limits in code cannot be exceeded by any config value.

## Level scaling

Levels are generated from a seed, never drawn one by one: the level number picks a difficulty target, the generator turns the target into a layout, and a bot checks it, so each game has unlimited levels with nothing to store.

1. The difficulty curve gives each level a target from 0 to 1. Within an era it ramps from easy to hard, each later era starts a little higher than the one before, every fifth level is an easier breather, and every tenth is a harder milestone. The starting formula is a base of 0.10 plus 0.025 per era, plus up to 0.30 across the era, capped at 0.80, so the average target win rate eases from about 76 percent in the first era to about 54 percent in the last.
2. The generator maps the target to a game's knobs (table below) using the level number as the seed, so level 347 is identical on every phone.
3. A bot plays the generated level many times in the simulator. If its win rate falls outside the band for that target, the generator moves to the next seed and tries again, so the result is still reproducible. As a starting rule the band is one minus the target, plus or minus 0.1; the bot is calibrated against real player data once the game is live.
4. After launch, each level reports attempts, wins and quits. A level whose fail or quit rate stands well above its neighbors is flagged, and the fix is a change to the curve or the generator, not a redrawn level.

| Knob | Brick breaker | Gem match |
| --- | --- | --- |
| Layout | Pattern family, density, symmetry | Board mask, frozen-tile and boulder positions |
| Pressure | Ball speed, paddle width | Move count, goal size |
| Variety | Brick hit points, unbreakable bricks | Gem kinds (five or six), goal type, blocker mix |
| Validity checks | Every breakable brick reachable by the ball | No opening match, a valid swap always exists, goal achievable |

Hand-authored levels are limited to the onboarding levels (the first ten in brick breaker, the first fifteen in gem match) and a few milestone set pieces. Levels 1 to 3 are always easy and ad-free.

The first level of each era is a breather by design and introduces that era's twist, so a new mechanic is always taught on an easy level.

## Roadmap

[Diagram: see docs/09-roadmap.md]

No dates are set yet: the bands show order and gates, not duration. The one external clock is the 14-day closed test, which can start only once a signed build is on Play's testing track.

## Release, security and IP checklist

Most of this is built into the code and the GitHub workflow; the account-only steps are marked, because only the account owner can do them.

| Area | Plan | Who |
| --- | --- | --- |
| App signing | Enroll in Play App Signing; the upload keystore lives only in GitHub Secrets and is backed up | Claude writes the workflow; account steps by Kratos |
| Build pipeline | GitHub Actions builds a signed `.aab`; third-party actions pinned to a commit; minimum permissions; secrets only on protected branches and tags | Claude |
| Play releases | Internal testing for quick builds, then closed testing, then production promoted by hand; a personal account created after November 13, 2023 needs 12 testers opted in for 14 consecutive days before production | Kratos for Play Console |
| Accounts | 2-step verification or a passkey on Google and GitHub; a personal Google account kept separate from work | Kratos |
| Ads | Google test ad unit IDs and a registered test device in development; live IDs only after AdMob approval; never click live ads; consent form before the first request where required | Claude builds; Kratos supplies live IDs |
| Ad safety | Hard ceilings in code that no config can exceed; remote values clamped; invalid config falls back to defaults; reward buttons kept away from game buttons | Claude |
| App shell | All code bundled in the app, navigation restricted, web debugging off in release, cleartext off, backup off | Claude |
| Saves | Play Games Services saved games with a custom merge: higher level, larger coin total, remove-ads kept if either copy has it | Claude; first device test needs a phone |
| Privacy | Privacy policy and `app-ads.txt` on GitHub Pages (a user site is likely to be accepted by AdMob; to be confirmed); Data safety form matching the real SDK behavior | Claude drafts; Kratos publishes and submits |
| Audience | General audience, declared as 13 and up; no kid-focused art or store wording | Both |
| IP | Original names cleared by a Play Store and trademark search; art and creatures from code, none modeled on an existing film, show or game; sound synthesized; a third-party notices file generated in the build | Kratos picks names; Claude checks notices |

## Open decisions

1. Names. The working titles are Dino Break and Dino Match. A web search found existing apps already called Dino Match, so that name is crowded; a Play Store and trademark search is needed for both before the art carries them.
2. Build order. Proposed default: design system, then `ad-brain` with its simulator, then brick breaker, then gem match.
3. Whether gem match stays without lives or an energy timer in version 1. Proposed default: no timer.
4. Whether to also publish a web build for quick testing and sharing. Proposed default: yes, for testing only.
5. The starting numbers in the ad-brain config are placeholders. They are tuned in the simulator, then by live data.

6) Mascot. Proposed default: one invented prehistoric creature of our own, drawn from code, used on menus and reward screens in both games.

7. History video format. Proposed default: 20 animated videos of 10 to 20 seconds, made by us with captions and no stock footage or narrator voice in version 1. Every fact is checked against a source before a script is written.

8) Launch slice. Proposed default: ship with the first four eras (400 levels) and add the other six as updates, about one era at a time, with levels cycling endlessly after the last released era.

9. Audience. Dinosaurs strongly attract children, so declaring 13 and up may not hold up in Play's review. Proposed default: a deliberately mature, stylized art direction aimed at teens and adults, with Play's Families policy requirements read before the store listing is written; if Play treats a game as child-appealing, its ad settings switch to the child-safe option, which earns less.

## Sources

- [Google Play Console Help: testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [AdMob Help: app-ads.txt setup and crawling](https://support.google.com/admob/answer/9363762?hl=en)
- [Play Games Services: saved games](https://developer.android.com/games/pgs/android/saved-games)
- [Play Games Services: sign-in on Android](https://developer.android.com/games/pgs/android/android-signin)
