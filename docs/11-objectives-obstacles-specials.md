# 11. Objectives, obstacles and special pieces (Dino Match)

Source: docs/10 (design notes). This file is the build spec. Rules stay data-driven and deterministic. Existing decisions stay: one star-equivalent (pickaxe) per first win, moves are the level budget, lives on a timer, coins buy +5 moves.

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

Chain queue: activations are queued, each special fires at most once per move, max chain depth 40, cascades follow. Count unique cells (HashSet by cell id), never run lengths.

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

## Tests

Match shapes (3, 4, 5 straight, T, L, cross, 6, 7+), unique-cell counting, spawn cell choice, every combination pair, chain termination, special fires once, gravity does not remove new specials, dead-board reshuffle, each obstacle's hit rules, each objective's completion, win and fail timing, reward granted once, bot solvability for generated levels.
