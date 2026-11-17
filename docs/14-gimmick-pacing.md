# 14. Elements, intros and gimmick pacing

One registry says what every board element is: `games/dino-match/src/data/intros.js`.
Adding an element = one entry there (plus its rules in `core/`). A guard test fails if a level uses an element with no entry.

## Entry fields
`id, group, title, text (max 130 chars), first (level it is taught), slot (pacing group), hook {kind,key} (where the rules live), art {kind,key} (picture on the card), spot (what is lit on the board), tutorial? (scripted tutorial level that already teaches it), event? (shown the first time it happens)`.
Combos are in the same file: `COMBO_INTROS = [{ ids:[a,b], text }]`, keyed by the sorted pair.

## How it is shown
- Level start: for each element the level uses that the player has not seen (max 2 cards, newest first). Dim, light the element, tap to continue. "Turn off tips" uses the same switch as Skip tutorial (`profile.tutorial.off`).
- Seen ids are kept in `profile.tutorial.intros`. Elements taught by the scripted tutorial (levels 1 to 6) count as seen when that tutorial was seen.
- Soft cards (hint, shuffle, first combo): small, never block play, removed on the next move.
- Settings > How to play lists every element and combo; unseen ones show as locked with the level that teaches them.
- `?debug` > "All intros" opens the same page with everything unlocked (every element and combo, animated).

## Pacing rules (enforced by `tests/intros.test.js`)
1. Teach level: the new element appears alone on a hand-made, safe level (an obstacle layout holds only that obstacle).
2. Use level: it comes back within 15 levels.
3. Mixes: a level may only combine elements that were all taught before it.
4. After the hand-made onboarding (levels 1 to 10) a new element is taught at most once per 5 levels. Objective types are taught together with their obstacle (same slot).

## Schedule (first level)
| Level | Element |
|---|---|
| 1 | break gems (scripted) |
| 5 | Firecracker (scripted) |
| 6 | plaque and dig blocks (scripted) |
| 8 / 10 | sand block / stone block (onboarding, exempt from rule 4) |
| 11 | tar |
| 16 | Bomb |
| 21 | rock |
| 26 | Dynamite |
| 31 | sandstone (+ break stones goal) |
| 36 | TNT |
| 41 | fossil tile (+ collect fossils goal) |
| 46 | Rainbow gem |
| 55 | skeleton tile (+ uncover skeleton goal) |
| 70 | artefact (+ drop goal) |
| 101 | vine stone |
| 201 | crate |
| 301 | lava rock |
| 60 / 65 | Pickaxe / Rockslide booster |
| 75 / 80 | Brush / Amber Lure booster |
| 85 / 90 | Tremor / +5 Moves booster |
| 95 / 106 | Lucky Start / +3 Moves (pre-level boosters, picked on the start screen) |
Boosters (docs/16) sit in the free 5-level gaps after the existing gimmicks; change `first` in `data/boosters.js` and the pacing test checks the 5-level gap.
Shuffle and hint are event cards. Combos show the first time the pair is swapped.
Changed from the first plan to meet rule 4: Bomb 15 to 16, rock 18 to 21, Dynamite 25 to 26, sandstone 25 to 31, TNT 35 to 36, fossil 35 to 41, Rainbow 45 to 46.

## Adding an element (checklist)
1. Rules in `core/` (obstacle, special, target type).
2. One entry in `INTROS` (and combos in `COMBO_INTROS`). 3. Teach level in `level.js` INTRO (obstacles) or the unlock in `config.js`.
4. Run the tests: guard (entry exists, `first` equals the first use) and pacing (5 level gap) tell you what is missing.
