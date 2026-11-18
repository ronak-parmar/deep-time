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

## Yuvi (M7)
With Settings > "Yuvi tips" on (default, `profile.settings.yuvi`), Yuvi stands bottom-left during a level-start card and says the card's `text` in his speech bubble (point toward the lit element, talk while it types, idle after; event cards think). The card keeps its title, picture and hint and is placed above him. A player who has not met him (`profile.yuvi.met`) gets "Hi! I'm Yuvi, your dig buddy!" (wave) first. Soft cards (hint, shuffle, first combo) become a Yuvi line instead of the small card. Tips off: cards exactly as before. `tests/yuvi.test.js` checks every entry has a line of 130 characters or less.
First launch: a 6-bubble welcome (`screens/welcome.js`, `profile.yuvi.welcomeSeen`), replayable from Settings and How to play.

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

## Difficulty tiers (normal, hard, super hard)
Every level has a `tier` (`cfg.tier`, from `core/difficulty.js` `tierOf(level)`); it is data-driven and deterministic, nothing is stored.
- No hard levels in the hand-made onboarding (levels 1 to 15). The first hard level is 16.
- After that, one hard level every 8 to 12 levels (a seeded gap per level), so two hard levels are never next to each other.
- Never on a breather or milestone level (level % 5 = 0) or an obstacle teach level (level % 10 = 1).
- In every 40-level window from level 41 on, the first hard level at or after the window start + 5 is **super hard** (first one: 47).
- Effect: moves x0.85 (hard) or x0.72 (super hard), never below the work the level needs x1.05; win coins x1.5 or x2.
  The board, gems and pieces stay exactly the same. Only the frame, HUD plates and background get a tint (crimson / violet).
- The first hard and the first super-hard level each show one intro card (`tier-hard`, `tier-super-hard` in `INTROS`, group `tier`).
  These cards do not count toward the 5-level gimmick pacing (they are not board elements).
- Where the player sees it: island screen = crimson coin with one flame badge (hard) or violet coin with two (super hard); pre-level =
  a crimson / violet ribbon "Hard level" / "Super hard" with the coin bonus (x1.5 / x2); in level = the tint above (render/renderer.js
  `TIER_TINT`); the first hard and first super-hard level show their intro card.
- Tests: `tests/intros.test.js` "difficulty tiers".
