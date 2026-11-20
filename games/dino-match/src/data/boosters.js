// The booster registry (docs/16). ONE place that says what every booster is: where it is used, what it costs, when it is taught.
// Rules live in core/boosters.js + core/game.js (useBooster); the intro card of each is an entry in data/intros.js (group 'booster', generated
// from this file), so tutorials, How to play, the guard test and the pacing rule cover boosters like any other element.
//
// kind:   'level' = used during a level by tapping the booster, then a target; 'pre' = picked on the level-start screen.
// target: 'cell' (a tile) | 'row' | 'area' (3x3 around the tapped tile) | 'colour' (tap a gem, its colour is used) | 'none' (fires at once)
// first:  level where it is taught (one new element per 5 levels, after the hand-made onboarding: docs/14). price: coins in the Shop.
// slot:   the painted medallion (art/ui/booster-<id>.png, cut from art/sheets/boosters.png by tools/prep-boosters-sheet.py; code-drawn if missing).
// gift:   given free the moment the intro card is shown, so the forced first use costs nothing.
export const BOOSTERS = Object.fromEntries([
  { id: 'pick', name: 'Pickaxe', kind: 'level', target: 'cell', first: 60, price: 60, tone: 'teal', glyph: 'pick', slot: 'booster-pick', text: 'Smashes one tile. Gems, and any block or obstacle under it, take a hit.', hit: 'tap a tile' },
  { id: 'rockslide', name: 'Rockslide', kind: 'level', target: 'row', first: 65, price: 90, tone: 'red', glyph: 'rockslide', slot: 'booster-rockslide', text: 'Clears a whole row. It works like a blast, so crates and fossils crack too.', hit: 'tap a row' },
  { id: 'brush', name: 'Brush', kind: 'level', target: 'area', first: 75, price: 100, tone: 'green', glyph: 'brush', slot: 'booster-brush', text: 'Sweeps a 3 by 3 area: every obstacle in it loses one layer. Gems stay where they are.', hit: 'tap the middle' },
  { id: 'amber', name: 'Amber Lure', kind: 'level', target: 'colour', first: 80, price: 120, tone: 'amber', glyph: 'amber', slot: 'booster-amber', text: 'Tap a gem: every gem of that colour is drawn out and cleared. It counts for colour goals.', hit: 'tap a gem' },
  { id: 'tremor', name: 'Tremor', kind: 'level', target: 'none', first: 85, price: 70, tone: 'violet', glyph: 'tremor', slot: 'booster-tremor', text: 'Shakes the board: the gems shuffle, and there is always a move afterwards. Specials stay put.', hit: 'tap to shake' },
  { id: 'moves5', name: '+5 Moves', kind: 'level', target: 'none', first: 90, price: 80, tone: 'blue', glyph: 'moves', slot: 'booster-moves5', text: 'Five extra moves, right now. Keep it for the last turns.', hit: 'tap to add' },
  { id: 'lucky', name: 'Lucky Start', kind: 'pre', target: 'none', first: 95, price: 100, tone: 'gold', glyph: 'lucky', slot: 'booster-lucky', text: 'Pick it before a level: you start with a random special piece on the board.', hit: 'pick it before you play' },
  { id: 'start3', name: '+3 Moves', kind: 'pre', target: 'none', first: 106, price: 60, tone: 'blue', glyph: 'moves', slot: 'booster-start3', text: 'Pick it before a level: you start with three extra moves.', hit: 'pick it before you play' }
].map((b) => [b.id, { gift: 1, ...b }]));

export const BOOSTER_IDS = Object.keys(BOOSTERS);
export const LEVEL_BOOSTERS = BOOSTER_IDS.filter((k) => BOOSTERS[k].kind === 'level');
export const PRE_BOOSTERS = BOOSTER_IDS.filter((k) => BOOSTERS[k].kind === 'pre');
export const boosterIntroId = (id) => 'bst-' + id;
// boosters usable on a level (taught at or before it)
export const unlockedBoosters = (level, kind) => BOOSTER_IDS.filter((k) => BOOSTERS[k].first <= level && (!kind || BOOSTERS[k].kind === kind));
