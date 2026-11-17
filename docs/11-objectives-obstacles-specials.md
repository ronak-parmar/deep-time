# 11. Objectives, obstacles and special pieces (Dino Match)

Source: docs/10 (design notes). This file is the build spec. Rules stay data-driven and deterministic. Existing decisions stay: one star-equivalent (pickaxe) per first win, moves are the level budget, lives on a timer, coins buy +5 moves.

## Dig rule (changed after owner feedback: digging comes from MATCHES, not moves)

The old rule (every valid move digs one block) made the choice of match irrelevant. New rule, in `src/core/rules.js` and `config.js`:

- The dig plaque (above the board, nothing on the board) holds blocks. Each block has a **type** and a **gem colour**: tar = 1 hit point, sand = 2, stone = 3 (`CONFIG.dig.blockTypes`). The colour is shown as a small gem badge on the block (shape and colour), the remaining hit points as dots, lost hit points as cracks.
- Clearing gems of a block's colour hits it. One match = 3 cells 1 hit, 4 cells 2 hits, 5+ cells 3 hits (`hitsByMatchSize`). Each hit damages the first standing block of that colour in plaque order; extra hits spill to the next block of that colour; hits on a colour with nothing left are wasted. A match of another colour does nothing to that block (it can still progress other blocks).
- Special activations (blasts, combos, rainbow) hit several blocks: for every colour among the gems the blast cleared, one salvo of hits from the same table (at least 1 hit per colour present).
- Cascades dig too (every match counts). Moves are still the budget and are still spent on every valid move.
- The fossil is uncovered only when every block is cleared. The win is checked once the board has settled (the move that breaks the last block ends the level as won; the "Fossil found" beat is unchanged).
- Level data: `blocks` is a list `{ t, c }` (compact text form `'T0 S1 K2'`). Levels 1 to 10 are hand authored (`ONBOARDING` in `level.js`): level 1 and 2 use tar only, 2 to 3 colours that are not every colour on the board, 14 moves, so the plaque is forgiving but only the right colours dig; sand from level 5, stone from level 9. After level 10 blocks are generated: hit points (share of sand and stone) and colour spread rise with the difficulty target; the move budget comes from the hit points and is tuned with the casual-play bot (`generateLevel(n, { tune: true })`, a human margin of 30 percent and a floor of 1.2 moves per hit point on top).
- Tutorial lines: level 1 "Match the colours shown on the blocks to dig."; level 2 "Bigger matches hit harder: 4 in a row hits twice. A wrong colour does nothing."
- Near miss, +5 moves purchase, pickaxe on first win, lives and coins are unchanged (the near miss counts blocks still standing; the offer shows what is left of every target).

## Target framework (phase A)

A level has 1 to 3 **targets** (`src/core/targets.js`, data in the level: `targets: [{ type, n, ... }]`). `dig` (clear all plaque blocks) is the first type; `collect` (gems of one colour) is the second. Win = every target done. The HUD Target panel (icon plus progress, pops on a change, ticks when done) replaces the old "Dug 0/N"; the pre-level screen lists the targets, the colours to match, the moves, a new-special note and one line of advice; the near-miss and Lose screens list what is left; Home shows the next five levels as journey nodes with their target icons. New objective types in phase B only add an entry to `TARGET_TYPES`.

## Build in two phases

### Phase A: specials, combinations, chains, fairness

Special pieces, created by the move the player made (spawn in the swapped-to cell when it belongs to the group, else the intersection, else the centre of the longest run):

| Pattern (unique cells) | Special | Effect (default, tunable in data) |
| --- | --- | --- |
| 4 in a straight line | Firecracker | clears its row or column (axis from the match direction) |
| T or L of 5 | Bomb | clears a 3x3 area |
| 6-piece connected group | Dynamite | clears a 5x5 diamond |
| 7+ or cross-shaped | TNT | clears a 7x7 area |
| straight 5 | Rainbow | swap with a gem to clear all of that colour |

Rule priority (deterministic): special-to-special swap, then cross/T/L, then long straight runs, then fallback connected groups.

Combinations (data table): Firecracker+Firecracker = row and column cross; Firecracker+Bomb = 3-wide cross; Bomb+Bomb = 5x5; Bomb+Dynamite = 7x7; Dynamite+TNT = 9x9; Rainbow+gem = all of that colour; Rainbow+special = every gem of the colour becomes that special then fires; Rainbow+Rainbow = clears the board except blockers.

Chain queue (`src/core/chain.js`): activations are queued breadth first, each special fires at most once per move, max chain depth 40 (`CONFIG.specials.chainDepth`), cascades follow. Count unique cells (a set of cell ids), never run lengths.

In code: shapes, creation patterns and the combination table are data in `src/core/specials.js`; grouping, rule priority and spawn cell in `src/core/match.js`; unlock levels in `CONFIG.specials.unlock` (firecracker 5, bomb 15, dynamite 25, tnt 35, rainbow 45; a locked kind just makes a plain match). Combination entries for pairs the table above does not name: Firecracker+Dynamite 5-wide cross, Firecracker+TNT 7-wide cross, Bomb+TNT 9x9, Dynamite+Dynamite diamond radius 4, TNT+TNT clears the board. Debug: open the game with `?debug` and use the picker (any level, or a board one swap away from each special and each pair).

Fairness: dead-board detection with a fair reshuffle (never creates an instant match, keeps specials and obstacles in place), valid-move hint after 6 s idle, specials never removed by gravity before shown.

Original names and art only (our own: Firecracker, Bomb, Dynamite, TNT, Rainbow can be renamed in the theme, e.g. Fossil Burst, Lava Bomb).

### Phase B: obstacles and objectives

Obstacles (each defined in data: occupiable, blocks movement, hits to clear, damaged by adjacent match, damaged by special blast, on-clear effect, counts toward objective):

| Obstacle | Behaviour |
| --- | --- |
| Tar pit | cell holds no gem; cleared by 1 adjacent match or any blast; may spread 1 cell every N moves in hard levels |
| Cracked sandstone | 2 hits (adjacent match or blast); shows crack stage 1 then crumbles |
| Fossil tile | sits under a tile; uncovered when the tile above is cleared; collectable |
| Buried skeleton | multi-cell excavation, each cell has its own tile; objective completes when all cells are uncovered |
| Vine stone | 2 hits and blocks swaps through it until cleared |
| Ancient crate | 1 hit by blast only (matches do not hurt it); drops a coin or a booster |
| Lava rock | hazard: heats every 3 moves then erupts a random 3x3 unless it was cleared by a blast; 3 hits |
| Unbreakable rock | permanent blocker that shapes the board |

Objectives (levels combine 1 to 3): dig N dirt blocks (the existing rule, now one objective type), collect N fossils, clear all tar, break N stone tiles, uncover a buried skeleton, drop an artefact to the bottom row, collect N gems of a colour, clear all of one obstacle type.

Win: all objectives done, checked immediately after a stable board. Fail: moves exhausted (near-miss offer stays). Reward on win unchanged (1 pickaxe on first win, coins).

Level format (data): board shape and blocked cells, gem colour count, start layout seed, moves, objectives, obstacle placements and health, special-piece rules, difficulty target. Generator and bot check updated to solve these; a level is rejected if the bot cannot clear it within moves at the target win rate.

Introduction schedule (one new thing at a time, in a safe level first): levels 1 to 10 plain matches and dig objective; firecracker first around level 5; tar around 11; bomb around 15; cracked sandstone around 25; fossil tiles around 35; rainbow around 45; then one new obstacle per era (Devonian vine stone, Carboniferous crate, Permian lava rock, later eras recombine), reconciled with the per-era twists already listed in docs/03.

### Phase B as built

Code: `src/core/obstacles.js` (data table, layout parsing, hit rules, hazards), `targets.js` (objective types), `level.js` (`INTRO` hand-authored levels, `placeObstacles`, `workOf`), `game.js` (gravity, artefacts, hazards), `bot.js`, `src/render/obstacles.js` (drawing). Tests: `tests/obstacles.test.js`.

- **Layout is data**: `layout` is a list of text rows (`.` gem, `T` tar, `S` sandstone, `F` fossil tile, `B` skeleton tile, `V` vine stone, `C` crate, `L` lava rock, `#` rock, `a` artefact). `spread` (tar spreads every N moves) is optional. The state holds `obst[i] = null | { k, hp, max, heat? }`; a cell with an obstacle holds no gem.
- **Gravity**: gems fall within the free stretch of their column, and every stretch refills from its own top (the pieces come out from behind the obstacle above). Swaps into an obstacle are invalid. The dead-board reshuffle moves plain gems only (obstacles, specials and artefacts stay).
- **Hit rules (one hit per obstacle per clear step)**: `byMatch` = a match group touches it (4-neighbours); `byBlast` = a special's blast area covers its cell. Tar 1 hp (match or blast); cracked sandstone 2 hp (match or blast); fossil tile 2 hp, collecting a fossil when it breaks; skeleton tile 1 hp each; vine stone 2 hp, matches only (blasts do not cut vines); ancient crate 1 hp, blasts only, and a blast reaching the cell next to it is enough (`blastReach`, so a bot or a casual player can plan it), drops `CONFIG.obstacles.crateCoins` coins that are added on a win; lava rock 3 hp, heat +1 per valid move, at 3 it erupts and turns `lavaTar` random gems in a random 3x3 around it into tar, and a cleared lava rock never erupts; unbreakable rock never takes damage.
- **Tar spread** (`spread` in the level, hard generated levels only): every N moves one tar pit turns a neighbouring plain gem into tar unless tar was cleared that move.
- **Artefact**: a piece without colour that never matches and is never cleared by a blast. It falls with the gems; on the bottom row it is collected (counts toward `drop`) and the cell refills. A rainbow cannot swap with it.
- **Objective types** (data in `targets.js`): `dig`, `collect`, `fossils`, `skeleton`, `drop`, `stones` (sandstone and vine tiles), `clearAll` (`k` = obstacle kind, `n` = how many at the start; done when none are left, so spreading tar adds work). The `dig` target stays in every level (the plaque and the fossil win beat are unchanged); other objectives sit next to it, 1 to 3 in total.
- **Schedule** (`CONFIG.obstacles.unlock`, intro levels hand-authored in `INTRO`): tar 11, rock 18, sandstone 25, fossil tile 35, skeleton 55, artefact drop 70, vine 101, crate 201, lava 301. After its intro level an obstacle may appear in generated levels (about two thirds of the normal and milestone levels; breathers stay plain). The pre-level screen says "New: <obstacle>" on the intro level.
- **Bot and move budgets**: the bot scores matches that touch breakable obstacles, matches under artefacts, 4-matches in a crate's row or column, and specials whose blast covers crates. Move budgets come from `workOf` (plaque hit points + half the obstacle hit points + 3 per artefact) tuned with the bot; levels with crates or artefacts need planning the bot lacks, so the bot only has to reach `1 - target - plannedSlack` (0.25).
- **Level checks**: `validateLevel` rejects a layout whose size does not match, a column with fewer than 3 free cells, a rock under an artefact, and objective counts that exceed what the layout contains. `npm run levels:check` prints objectives and obstacles per level.

### Early levels and first-time tutorial (owner feedback)

- **Levels 1 to 5 are collect-only**: no dig plaque and no fossil-block row, just the board and the Target panel ("Break 10 red", "Break 12 blue", two colours on 3 and 5, "Break 15 green"; level 5 also teaches the Firecracker). The dig plaque is introduced on **level 6** ("Match the colours shown on the blocks to dig."), sand arrives on 8 and stone on 10, levels 8 and 10 mix dig and collect, and obstacles follow the schedule above (tar 11, ...). Data: `AUTHORED` in `level.js` (`blocks: ''` = no plaque, `collect: [[colour, n]]`).
- **A level without a plaque** has `dirtTotal = 0`, no dig target and `state.hasDig = false`. Win beat: a level with a plaque shows the "Fossil found!" banner and result title; a level without one shows "Level complete!". The win still pays the pickaxe on the first win, coins and the fossil part counter exactly as before.
- **Target panel**: collect targets show the colour gem icon and `got/n`; the HUD caption reads "Break" when every target is a collect target. Labels: "Break 10 red gems"; near miss counts 4 gems of a colour as one block (`TARGET_TYPES.collect.units`).
- **Generator after level 10** (`modeFor`, seeded by the level number): 40 percent dig only, 35 percent dig + collect, 25 percent collect only (two colours at higher difficulty). Obstacle objectives stack on top (1 to 3 targets). Move budgets use `workOf` with `CONFIG.levels.gemsPerMove` (2.6 gems per move of the wanted colour) and are tuned with the bot, which now scores matches of unfinished collect colours.
- **Tutorial** (`core/tutorial.js`, overlay `screens/tutorial.js`, state `profile.tutorial = { seen: [levels], off }`): levels 1 to 6, one idea per level, shown once, skippable at any time (Skip turns the whole tutorial off), never on a level already won. A dimmed screen with a spotlight, a card and, on levels 1 and 5, an animated hand pointer that shows a real swap (a 3-match of the target colour, a straight 4-match on level 5); tap to continue, or just make the move. L1 target panel then swap; L2 wrong colours cost a move; L3 two targets and the 4-in-a-line teaser; L4 chains; L5 firecracker; L6 the plaque. Timing uses the docs/09 tokens only. Levels 1 to 6 have fixed `seed` boards; tests prove every start board holds a valid move of the wanted colour and size.

## Tests

Match shapes (3, 4, 5 straight, T, L, cross, 6, 7+), unique-cell counting, spawn cell choice, every combination pair, chain termination, special fires once, gravity does not remove new specials, dead-board reshuffle, each obstacle's hit rules, each objective's completion, win and fail timing, reward granted once, bot solvability for generated levels.

## Level range (M1)
Levels are validated for the whole range 1..2350 (plus a cycle margin) by `npm run levels:check`; `tests/obstacles.test.js` checks up to TOTAL_LEVELS + 150. Era boundaries come from the roster, not fixed 100-level blocks.
