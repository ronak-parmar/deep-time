# 16. Boosters

One registry: `games/dino-match/src/data/boosters.js` (id, name, kind, target, teach level `first`, coin `price`, intro text). Intro cards are generated from it into `data/intros.js` (group `booster`, ids `bst-<id>`), so How to play, the guard test and the pacing rule cover them.

| id | name | kind | target | first | price | effect |
|---|---|---|---|---|---|---|
| pick | Pickaxe | level | a tile | 60 | 60 | smashes the gem (blast: counts for goals and dig blocks) and hits any breakable obstacle under it once |
| rockslide | Rockslide | level | a row | 65 | 90 | clears the whole row as a blast |
| brush | Brush | level | 3x3 (centre tapped) | 75 | 100 | removes one layer from every obstacle in the area; gems do not move; refused if nothing to sweep |
| amber | Amber Lure | level | a gem | 80 | 120 | clears every gem of that colour (credits colour goals) |
| tremor | Tremor | level | none | 85 | 70 | fair reshuffle, always a legal move afterwards, specials stay |
| moves5 | +5 Moves | level | none | 90 | 80 | +5 moves and budget |
| lucky | Lucky Start | pre | none | 95 | 100 | one random plain gem starts as a Firecracker or Bomb |
| start3 | +3 Moves | pre | none | 106 | 60 | three extra moves at the start |

## Rules
- In-level: tap the booster, then the target (targeted ones show a gold ring on legal tiles and a prompt with Cancel). No move is spent. An illegal target changes nothing and spends nothing.
- Owned counts: `profile.boosters[id]`. New profiles own none; the intro card gifts one (`gift` in the registry). Buy in the Shop (map dock, or tap an empty booster). Pre-level boosters are picked on the level-start screen.
- Teaching: at the teach level an intro card shows an animated mini board of the effect, the line "Tap the booster, then tap where to use it", a spotlight on the booster button, then a forced first use (prompt "Your turn", Cancel = "Not now"). Pre-level boosters are explained on the start screen and picked automatically once.
- Logic: pure in `core/boosters.js` (targets, profile side) and `core/game.js` `useBooster()` (reuses the swap pipeline: clear step, obstacle hits, dig hits, gravity, cascades, collect, reshuffle, `end` event). The renderer replays the event log with an extra `booster` event (effect + sound hook `boosterUse`).
- There is no undo in the game; boosters go through the same lock/event queue as a move, so they cannot overlap an animation.
- Tests: `tests/boosters.test.js` (every effect, solvability and goal accounting under random use, guard: each booster has an intro entry) and `tests/intros.test.js` (pacing).
