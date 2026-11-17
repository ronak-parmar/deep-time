# Dino Match (v1 vertical slice)

Match-3 with a dig-the-fossil goal. Vite + vanilla JS + canvas. Part of the Deep Time repo.

## Run it

```
cd games/dino-match
npm install        # first time (or `npm install` at the repo root: npm workspaces)
npm run dev        # http://localhost:5173, playable from level 1
npm test           # 217 unit tests (vitest): core rules, specials, dig, targets, art manifest, motion
npm run build      # static build in dist/ (base './', works from a file path or a Capacitor WebView)
npm run levels:check -- 1 200   # generate levels and run the validity/solvability check
```

Add `?debug` to the URL of a build to expose `window.__dino` (state, hint, renderer) for scripted tests. It is always on in `npm run dev`.
Progress is saved in `localStorage` (key `dino-match.profile.v1`). To restart from level 1, clear it.

## How it plays

- Swap two neighbours (swipe, or tap one then the other). 3 or more in a row or column pop, gems fall, new gems drop in, cascades chain. A swap that makes no match bounces back: no move spent.
- **Digging comes from matches** (docs/11): the dig plaque above the board holds blocks (tar 1 hit point, sand 2, stone 3), each tagged with a gem colour shown as a badge. Clearing gems of that colour hits the block: a 3-match is 1 hit, 4 is 2, 5+ is 3; special blasts hit several blocks; the wrong colour does nothing. Cracks and dots show the damage. Clear every block and the fossil is uncovered (win). Moves are the budget.
- **Specials**: 4 in a line = Firecracker (clears its row or column), T or L of 5 = Bomb (3x3), 6 connected = Dynamite (5x5 diamond), 7+ or a plus = TNT (7x7), straight 5 = Rainbow (swap it with a gem to clear that colour). Swap two specials for a combination. Unlock levels: firecracker 5, bomb 15, dynamite 25, tnt 35, rainbow 45. Hint pulses after 6 s idle; dead boards reshuffle fairly (specials stay put).
- **Targets**: every level has 1 to 3 targets (`dig` first, `collect` gems of a colour second); the pre-level screen shows them, the HUD Target panel tracks them.
- Out of moves first: "Out of moves", one primary action (Try again).
- Level N belongs to era `floor((N-1)/100) % 10`. Each era has its own scenery and gem sprites, falling back to code-drawn gems.

### Try the specials fast
Open `http://localhost:5173/?debug` (with `npm run dev`). The Debug box (top left) jumps to any level, or starts a board that is one swap away from each special or each combination: pick e.g. `bomb-t`, press Board, swap the two gems the hint pulses on (or wait 6 s). Pairs are named `combo:bomb+firecracker`. Scripted: `window.__dino.go.test('bomb-t')` then `__dino.renderer.onSwap(...window.__testSwap)`.

## Layout

```
src/core/     PURE logic, no DOM, no canvas. Everything the tests cover.
  config.js     every tunable number (dig hits, block types, special unlocks, chain depth)
  rules.js      hitsForMatch / applyHits / digStep = THE dig rule; judge(state) = THE win/lose rule; starsFor
  specials.js   special kinds, creation patterns, effect shapes, combination table (data)
  match.js      match groups, rule priority, special creation, spawn cell, legalSwaps
  chain.js      chain queue (each special once per move, depth cap 40)
  targets.js    target types (dig, collect), progress, labels
  testboards.js boards one swap away from each special (debug picker and tests)
  game.js       state, swap() -> event log, gravity/refill, deadlock reshuffle, save (JSON)
  board.js      match detection (3+ rows/cols), valid swaps
  level.js      generator (seed = level number), onboarding table, difficulty curve, validateLevel
  bot.js        casual-player bot used for the solvability sanity check
  eras.js       10 eras, level-to-era mapping, history-video levels
  profile.js    player profile v2, migrateProfile, settleLevel (rewards, life loss), doubleCoins, spendCoins, mergeProfiles
  lives.js      lives regeneration from timestamps, injectable clock (`now` is always a parameter)
  fossils.js    20 fossils, digPart (5 pickaxes per part), completion
  rng.js        seeded mulberry32, state is one integer so it serialises
src/render/   canvas: renderer.js (tweens, particles, input), atlas.js (sprite loader), gems.js
              (fallback gems), fossils.js, scenery.js (per-era backgrounds)
src/screens/  boot, home, play, result, dig (Dig site), lives (Out of lives), offer (near miss), history (placeholder)
src/ui/       tokens.js (design system -> CSS), components.js, glyphs.js, game.css, motion.js
src/ports/    ads.js (AdPort + mock), save.js (SaveStore: LocalStorage now, Play Games later)
tests/        core.test.js, progression.test.js
docs/screens/ screenshots of every screen
```

### How core and renderer talk
`swap(state, a, b)` mutates the state to its final position and returns an **event log**
(`swap`, `combo`, `fire`, `clear`, `create`, `hit`, `fall`, `shuffle`, `end`). The renderer only replays that log with tweens, then snaps to the true state. Nothing in the renderer knows the rules, so reworking the rules means editing `core/` only.

### The rule functions
- `digStep(blocks, matches, blast)` in `core/rules.js`: how a clear step hurts the plaque blocks (see How it plays). Block layouts are level data (`blocks`, compact text `'T0 S1 K2'`).
- `judge(state)` in `core/rules.js`: `'won' | 'lost' | 'playing'` (all targets done / out of moves).

## Decisions

- **Dig rule**: owner feedback replaced "one block per valid move" with match-driven digging (above). The plaque stays above the board and nothing is added to the board.
- **Dirt is a plaque, not cells.** The blocks sit in a panel above the board over the fossil and are not tied to board cells, which keeps gravity simple.
- **Difficulty**: the curve is unchanged (docs/03: 0.10 + 0.025 per era + up to 0.30 across the era, cap 0.80, breathers on every 5th level and era start, milestones on every 10th). It now drives block count (5 to 13), the share of sand and stone, and the colour spread of the blocks; the move budget comes from the plaque's hit points, tuned with the casual-play bot (`generateLevel(n, { tune: true })`, used in play and by `npm run levels:check`) with a human margin.
- **Levels 1-10** are fully hand-authored (docs/11: block lists, tips, firecracker at 5, sand at 5, stone at 9); 11-15 keep the authored board size with generated blocks.
- **Gems**: colours red, green, blue, yellow, purple, amber with fixed silhouettes (octagon, oval, diamond, triangle, purple pentagon, teardrop). Era sprites replace the drawn gems when present. Cambrian uses 4-5 colours early; 6 appear from Devonian (docs/03 "sixth stone kind").
- **No deadlocks**: if no valid swap remains the same pieces are reshuffled (seeded) with a short message.
- **Stars**: 1 for a win, 2 with 25% of the moves left, 3 with 50%.
- **Reduced motion**: tweens become instant, no shake, particles or hint pulse (`prefers-reduced-motion`).
- **Design system**: `ui/tokens.js` reads `design-system/tokens.json` and injects every token as a CSS custom property, the Nunito fonts as `@font-face`, and `design-system/components/bundle.css`. The React components in `bundle.js` are not used (they need React on `window`); the pieces needed (Button, Stars, Progress, Toast, Counter, ResultScreen layout) are ported to vanilla DOM in `ui/components.js` using the same class names, markup and glyph geometry. Touch targets are 48px, numbers are tabular, one primary button per screen.
- **Layout**: a fixed 360 x 640 stage scaled to the window (design-system canvas size), drawn at device pixel ratio.

## v1 progression and economy (docs/04)

Everything below lives in `src/core` (pure, tested) with numbers in `src/core/config.js`.

- **Profile v2** (same localStorage key, `v` field bumped, `migrateProfile` on load): coins, pickaxes, lives (0-5), `lastLifeTimestamp`, `fossilProgress` (fossil id to parts 0-10), `completedFossils`. A v1 save keeps all progress and gets one pickaxe per level it had already won.
- **Win**: coins every win (`coins.win` 10 + 5 per star, so replays also pay coins), **+1 pickaxe only on the first win of a level**. The Win screen shows both, plus a mock rewarded "Double coins" button (pays the win coins a second time, once), Next level (primary), Dig site, Home.
- **Lose**: costs 1 life. At 0 lives the Lose button becomes "Out of lives" and starting any level is blocked: the Out of lives screen shows a live countdown, refill with coins (100) or a rewarded ad (mock), Dig site, and Play (enabled again when a life regenerates).
- **Lives** regenerate one per 25 minutes (`lives.regenMinutes`), computed from timestamps, so it works across reloads. Every core function takes `now`, so tests use a fake clock; in the browser `window.__clockOffset` (ms) shifts the clock for manual testing.
- **Dig site**: current fossil (the first one not complete, 2 per era, 20 in total) as 10 dirt tiles over placeholder art, pickaxe count, a Dig button costing 5 pickaxes (`fossils.pickaxesPerPart`). A part crumbles away with particles (instant under reduced motion). The 10th part marks the fossil complete and opens the placeholder history video (a plain text card, skippable, never an ad). Reachable from Home, Win, Lose and Out of lives. Cambrian fossils are named Anomalocaris and Trilobite; the rest are "<Era> fossil 1/2".
- **Near miss**: out of moves within 2 dirt blocks of done (`nearMiss.blocks`) offers +5 moves for 50 coins or a mock rewarded ad, once per attempt, and accepting costs no life. Anything else, or "No thanks", goes to the normal Lose screen. No interstitials anywhere.
- **Ads port**: new events `rewarded_offer`, `rewarded_completed`, `lives_empty`, `fossil_complete`. Rewarded offers are shown regardless of `requestDecision` for now. The mock rewarded ad completes after 0.7 s.

### Decisions made for the progression work

- Coins are paid on replays too (the doc only restricts pickaxes). Easy to change in `settleLevel`.
- Pickaxe count is not capped and is never bought. 50 first-time wins fund exactly one fossil (tested).
- Dig site "Back" returns to where it was opened from, except from the Win screen where it returns Home.
- Only the first near-miss offer per attempt is shown; after +5 moves a second loss is a normal loss.
- Lost levels cost a life when the loss is final (after declining a near-miss offer), not when moves first hit zero.
- Boosters are still inert placeholders.

## Stubbed (inert placeholders)

- Boosters (pick, burst, brush): three disabled buttons along the bottom of the Play screen; counts and starting stock live in `profile` and `CONFIG.boosters` but nothing uses them.
- Special gems, 4/5-match bonuses, consent and ad-choice sheets, real history videos: not built. Ads are a mock: `AdPort` collects events, `showRewarded()` pretends to complete, `requestDecision` says "do not show". The ad-brain package is not imported.
- Home journey cards are display only (era progress); there is no level select yet.
- Per-era twists from docs/03 (boulders, crusted tiles, and so on) are not implemented.
- Pause screen: the back button leaves the level without saving it (no life is lost).
- Fossil art on the Dig site is the same code-drawn placeholder as in levels; the real fossil images and the history videos are still to come.

## Era themes (code-drawn board art)

Each era has one theme object in `src/render/eraTheme.js` (palette, material texture, corner style, trim, cap, plaque shape, ambient particles, scenery tint, board interior, optional glow). `frame.js` turns a theme into the board frame, the dirt-panel plaque, the HUD plate and the era name plaques; everything is cached on offscreen canvases.

- Preview all 10 eras (real Cambrian, Devonian and Carboniferous sprites, placeholders for the rest): `npm run dev`, then open `http://localhost:5173/preview-eras.html`. Contact sheet and one Play screenshot per era are in `docs/screens/eras/`.
- Add or tweak an era: edit its entry in `THEMES` (keys are era ids; art-folder ids such as `mammals`, `iceage`, `humans` are aliased in `themeFor`). Pick values from `TEXTURES`, `CORNERS`, `TRIMS`, `CAPS` in `frame.js`. Reload the preview. `tests/progression.test.js` fails if a theme is missing a field or if the HUD plate or board floor drops below the contrast floors (4.5 and 12), which keeps the six gems readable.
- Background scenery: each theme has a `scenery` list of `{ type, color, alpha, ... }` elements. The drawers live in `ELEMENTS` in `src/render/scenery.js` (`still` is baked once, `live` is drawn every frame behind the board). Every element type belongs to one era (a test enforces that), alpha stays low, and the old shared corner fronds and lava rocks are gone. Live elements loop at `LOOP.scene` in `motion.js` (12 s per cycle) and freeze at their rest pose under reduced motion. Tall elements put their first and last item in the side margins so they show beside the dirt panel.
- The board interior stays dark and neutral on purpose; only the frame carries era colour.
- Decisions: frame ring is 12 px so the cell size is `floor(320 / width)` (45 px gems on 7x7). The HUD plate is drawn on the canvas and the DOM HUD is transparent. Ambient particles live on the frame only and are off under reduced motion.

## Motion and feel (docs/09)

One timing config: `src/render/motion.js`. Duration tokens (`D`), stagger, squash, shake, particle budgets, easings (`EASE`), per-event `RECIPES` for all 17 section 4 events, and `cssVars()` which injects the same values as `--m-*` CSS variables. Nothing else in `src/` may contain a raw duration or easing; `tests/motion.test.js` scans for it and also checks every event has a recipe and a sound mapping.

- Tune a feel: change the number in `motion.js` (for example `D.base`, `SQUASH.pop`, `SHAKE.medium`, `RECIPES.fallRefill.stagger`) and reload. The CSS follows automatically.
- Sound: `src/render/sound.js` holds the synthesised voices and `SOUND_MAP` (event to sound and haptic). WebAudio unlocks on the first touch. Mute and Haptics toggles are on Home and stored in `profile.settings` (`muted`, `haptics`). Haptics use `navigator.vibrate` (8, 16 or 30 ms, at most one per 80 ms).
- Particles are pooled in typed arrays (`particles.js`, max 200, no per-frame allocation). Floating texts use a fixed pool of 8.
- Reduced motion (OS setting): durations halved, no shake, no particles, no ambient loops, banners fade only.
- Motion lab: `npm run dev`, open `http://localhost:5173/?motion` in a window at least 760 px wide. One button per event recipe, a speed dropdown (1x to 0.1x) and a reduced-motion checkbox. Frame sequences are in `docs/screens/motion/`.
- Perf (headless Chromium, software rendering, 800x660): average draw 0.8 to 1.3 ms per frame, worst frame 15 ms, average frame time 16.7 ms (60 fps), at most 2 frames over 20 ms in a 4.5 s cascade; peak pooled particles 72 (cap 200).
- Deviations from docs/09: input is locked while a move resolves (clear and fall) and the celebration is skippable by tap, rather than accepting moves mid-animation, because the board settle bounce moves gems after they land. Win and fossil celebrations are still tap-skippable so they never hold the player longer than needed.

## Painted art layers (how to add an era's art)

See the painted eras: `npm run dev`, open `http://localhost:5173/preview-eras.html` (all ten boards, built with the real renderer; Cambrian, Devonian, Carboniferous and Permian show the real painted backgrounds, the other six keep the vector look) or play at `http://localhost:5173/`.


The renderer draws, back to front: painted background, painted prop layers, ambient particles, the board (painted tiles), HUD plates, boosters. Code only does layout, text and animation. Every layer falls back to the vector look when its file is missing, so the game never breaks and each era (and each UI slot) switches over as art arrives.

- Where files go (the owner's `art/` folder wins over the temporary `games/dino-match/art-standins/` with the same layout):
  - Background: the game loads `art/backgrounds/runtime/<era>.webp` (768x1360). Drop the full-size original (for example 1536x2720 `<era>.jpg`) into `art/backgrounds/` and run `python tools/prep-bg.py`; originals are kept and never shipped. A plain `art/backgrounds/<era>.png` also works (era id such as `cambrian`, `ice-age`; art-folder ids `iceage`, `mammals`, `humans` also work). Portrait 9:16. Keep the middle calm and dark, scenery on the edges. It is drawn 6% oversize so it can drift.
  - Props: `art/props/<era>/<name>-<anchor>[-glow].png`, transparent. Anchor is `tl tr bl br` (corners), `t b` (full-width edge), `l r` (side edge) or `c`. Corner and side props are drawn 150 px wide, edge props 360 px. A `-glow` suffix makes the prop pulse. Example: `fern-tl.png`, `lava-br-glow.png`.
  - UI kit: `art/ui/<slot>.png`, transparent. All slot names, sizes and 9-slice insets are in `src/render/artManifest.js` (the only place to edit). Paint at 2x to 3x the listed size. Plates with `nine` insets stretch between them. Tiles are `tile-cream-1..4.png`, `tile-dirt-1..4.png`, `tile-cracked-1..4.png`.
- Per-era feel is in `eraTheme.js` under `paint`: `drift` (parallax px), `sway` (prop shear), `glow` (pulse depth) and `ambient` (drifting dust, bubbles, snow, embers or spores). All of it uses `LOOP.scene` from `motion.js`, is slow and subtle, uses no per-frame allocations and is off under reduced motion.
- Generated kit (no external image generator): `python tools/gen-ui.py art/ui --contact contact.png` paints every manifest slot procedurally (layered noise textures, wobbled edges, bevel light from the top left, ambient occlusion, thick outline; rendered at 4x, written at 2x). Contact sheet: `docs/screens/painted/kit-contact-sheet.png`. Restart `npm run dev` after adding files to `art/` (the glob is read at start). `--only name,name` rebuilds single slots.
- Procedural era backgrounds: `python tools/gen-bg.py [era ...]` paints triassic, jurassic, cretaceous, mammals, iceage and humans (calm dark centre, scenery on the edges, same 768x1360 webp as the four painted ones) into `art/backgrounds/runtime/`. In-game contact sheet: `docs/screens/backgrounds/contact-in-game.png`. Delete a file there to get the vector fallback back for that era.
- Cutting a kit sheet: `python tools/prep-ui.py sheet.png map.json art/ui --preview contact.png`. The sheet is flat navy `#12172A` with separated elements. `map.json` lists slot names in reading order (see `tools/prep-ui-map.example.json`). The preview numbers each cut so a wrong mapping is easy to see. Use `--hard 22` for very dark elements such as the tar tiles, `--merge` to keep leaf and vine bits attached.
- Compare with the vector look: add `?vector` to the URL (or set `window.__noArt = true`).
- Stand-ins: `art-standins/` holds temporary images (crops of `art/reference/ui-target.jpg`, procedural plates, flat-colour backgrounds, and test props for Jurassic). Rebuild with `python art-standins/make-standins.py art/reference/ui-target.jpg`. Delete a stand-in file once the real one exists; delete the folder when all art is in.
- Reserved slots not used by a screen yet: `gear-button`, `tablet-*`, `dirt-crumbs`.
- Painted layout: the HUD row is still 56 px and the DOM text sits on the plates using `HUD_LAYOUT` in the manifest. The dirt counter plaque stays above the board and fossils stay on the Dig site.


## Obstacles and objectives (phase B)

Eight obstacles sit in board cells (tar pit, cracked sandstone, fossil tile, skeleton tile, vine stone, ancient crate, lava rock, unbreakable rock) plus the artefact piece, and the target framework has seven objective types (dig, collect, fossils, skeleton, drop, stones, clearAll). Rules and schedule: `docs/11-objectives-obstacles-specials.md` (Phase B as built). Try them: `?debug`, open the DBG tab, enter 11 (tar), 18 (rock), 25 (sandstone), 35 (fossil tiles), 55 (skeleton), 70 (artefact), 101 (vine), 201 (crate) or 301 (lava), Go. Screens: `docs/screens/phaseB/`. New files: `src/core/obstacles.js`, `src/render/obstacles.js`, `tests/obstacles.test.js`.


## Early levels and tutorial

Levels 1 to 5 are collect-only (no plaque; "Break 10 red" and similar); the dig plaque starts on level 6. Levels 1 to 6 show a one-time skippable tutorial (spotlight, hand pointer, tap to continue) kept in `profile.tutorial`. To see it again clear the save (browser storage for the page) or use a private window. Screens: `docs/screens/collect/`. Details: `docs/11-objectives-obstacles-specials.md` (early levels and tutorial).

## Android debug APK (GitHub Actions)

The app is wrapped with Capacitor (`com.deeptime.dinomatch`, name "Dino Match", web files from `dist`).

Build the APK on GitHub (no Android Studio needed):
1. Push to `main`, or open the repo on GitHub > Actions > "apk" > Run workflow.
2. The job runs the tests (it fails if a test fails), builds the web app, runs `cap add android` (only if `android/` is missing), `cap sync`, and `./gradlew assembleDebug`.
3. When it is green, open the run > Artifacts > download `dino-match-debug-apk` (a zip, kept 30 days).
4. Unzip it, copy `app-debug.apk` to the phone, open it, allow "install unknown apps". 

This is a DEBUG APK: good for testing on your own phone, not for the Play Store (that needs a signed release build).

Smaller APK: `DM_NO_VIDEOS=1 npm run build` leaves the history videos (`art/videos/*.mp4`) out; the cutscenes then play with the canvas renderer.

Not tested yet: the Gradle build and a real CI run (they cannot run in the author's sandbox). If the first run fails, read the failing step in the Actions log.

## Roster, dig site and museum (data-driven)

`src/data/roster.js` is the only list of fossils (47). Eras, level ranges (50 levels per fossil), journey cards, dig site, museum and cutscenes are all derived from it. To add a fossil: add one `F(...)` entry (10 parts from a shape recipe, 2-3 facts, cutscene motion); levels and screens follow. Old save ids are migrated by `migrateFossilId`.
