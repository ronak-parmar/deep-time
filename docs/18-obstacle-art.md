# 18. Painted obstacle art (M11)

The board obstacles, the artefact piece and the dig-plaque blocks are still code-drawn. This is the pipeline for one painted
sheet that replaces them, in the same glossy painted style as the specials sheet (firecracker, bomb, dynamite, crate, rainbow).

## Slots

`art/obstacles/<slot>.webp`, 192 x 192 RGBA (the board draws them at about 48 px). Obstacles with hit points get one picture per
damage stage: `<kind>-<hits left>`, so the cracks grow as the player hits it. Every slot is optional: a missing picture keeps the
code-drawn look for that obstacle or stage (`src/render/obstacleArt.js`, `obstacleSlot`: stage picture, else the plain `<kind>`
picture, else the nearest stage).

| # | slot | what | game rule (core/obstacles.js) |
|---|------|------|------|
| 1 | `tar` | tar pit | 1 hit, spreads |
| 2 | `sandstone-2` | cracked sandstone, whole | 2 hits |
| 3 | `sandstone-1` | the same, badly cracked | |
| 4 | `fossil-2` | sandstone tile with an ammonite fossil, whole | 2 hits, gives a fossil |
| 5 | `fossil-1` | the same, cracked, more fossil showing | |
| 6 | `bone` | sandstone tile with one bone | 1 hit, skeleton piece |
| 7 | `vine-2` | grey stone wrapped in two vines | 2 matches, blasts do not cut it |
| 8 | `vine-1` | the same, one vine cut and hanging loose | |
| 9 | `crate` | ancient wooden crate, gold coin emblem | 1 blast, drops coins |
| 10 | `lava-3` | lava rock with glowing cracks, whole | 3 hits, erupts tar |
| 11 | `lava-2` | the same, cracked | |
| 12 | `lava-1` | the same, almost broken | |
| 13 | `rock` | unbreakable boulder | never breaks |
| 14 | `artefact` | golden relic piece (round) | collect item, falls like a gem |
| 15 | `dig-tar` | dig plaque block: dark tar dirt | 1 hit |
| 16 | `dig-sand-2` | dig plaque block: packed sand, whole | 2 hits |
| 17 | `dig-sand-1` | the same, cracked | |
| 18 | `dig-stone-3` | dig plaque block: grey stone, whole | 3 hits |
| 19 | `dig-stone-2` | the same, cracked | |
| 20 | `dig-stone-1` | the same, badly cracked | |

The order is the sheet's reading order (5 columns x 4 rows). The list lives once in code (`OBSTACLE_SHEET` in
`games/dino-match/src/render/obstacleArt.js`); the cutter reads it from there.

In game: the lava heat glow pulses on top of the picture, the tar wobbles a little, hit-point pips stay under multi-hit obstacles,
the dig blocks keep their gem badge in the middle (keep the centre of those blocks calm). Breaking: the picture shakes, then flies
apart in 4 chunks (docs/09, Obstacle breaks). `?vector` in the URL shows the old look for comparison.

## Steps

1. Paste the prompt below into the image tool. Ask for the largest size (2048 px wide or more). Check: 20 items, the order, a
   plain white gap round every item, nothing touching, no text.
2. Save it as `art/sheets/obstacles.png`.
3. `python3 tools/prep-obstacles-sheet.py --preview /tmp/obstacles-contact.png` (writes `art/obstacles/*.webp`). It fails loudly
   (exit 2, nothing written) if a cell is empty or an item touches its neighbour, and names the cell. One bad item: regenerate the
   sheet, or keep the sheet and fix that cell with `--only <slot>` after replacing it.
4. Run the game: every obstacle picks its picture up automatically (`npx vitest run`, `npm run build`).

Self test with a synthetic sheet: `python3 tools/prep-obstacles-selftest.py` (also run by `tests/obstacleart.test.js`).
Stand-ins for testing the renderer: `python3 games/dino-match/art-standins/make-obstacle-standins.py`, then open the game with
`?standins` (never shipped).

## Prompt (paste as is)

```
A sprite sheet of 20 game tiles for a mobile match-3 puzzle game about digging up fossils, in a strict grid of
5 columns and 4 rows, every item centred in its own square cell, with wide plain pure-white gaps between all items.
Style: the same glossy painted 3D look as my sheet of special pieces (stone rocket with a footprint, cracked lava
bomb, red dynamite bundle tied with rope and a tooth, sandstone crate with a glowing skull, rainbow ammonite orb):
chunky rounded shapes, rich saturated colours, soft painterly shading, glossy highlights, warm golden light from
the upper left, carved sandstone, rope and bone details. Every item is seen from the front, slightly from above,
fills its square cell (a square block shape for the tiles), and is the same size as the others. No drop shadows on
the ground, no background, no frame, no text, no letters, no numbers, no characters. Plain pure white background.

Items in reading order (row 1 left to right, then row 2, and so on):
1. Tar pit: a round blob of glossy black-purple tar with bubbles and a shine.
2. Cracked sandstone block, whole: a square golden sandstone block with layered strata lines.
3. The same sandstone block, badly cracked: deep cracks across it, small chips missing.
4. Fossil tile, whole: a square sandstone block with a spiral ammonite fossil pressed into its face.
5. The same fossil tile, cracked: cracks across it, the ammonite showing more clearly.
6. Skeleton tile: a square sandstone block with one ivory dinosaur bone embedded in its face.
7. Vine stone, whole: a square grey stone block wrapped crosswise by two thick green vines with leaves.
8. The same vine stone with one vine cut through, its loose end hanging down.
9. Ancient crate: a square wooden crate with stone corners and a round gold coin emblem on the front.
10. Lava rock, whole: a square dark basalt block with thin glowing orange lava cracks.
11. The same lava rock, cracked: wider glowing cracks, a chip missing.
12. The same lava rock, almost broken: big glowing cracks all over, pieces about to fall off.
13. Unbreakable boulder: a heavy rounded grey granite boulder, very solid, with a mossy spot.
14. Golden relic: a round golden amulet with a diamond-shaped amber stone in the middle (no face, no letters).
15. Dirt block: a square block of dark tar-black packed earth with small pebbles; plain calm centre.
16. Sand block, whole: a square block of packed golden sand; plain calm centre.
17. The same sand block, cracked around the edges, centre still calm.
18. Stone block, whole: a square block of grey cut stone; plain calm centre.
19. The same stone block, cracked around the edges.
20. The same stone block, badly cracked around the edges, corners chipped, centre still calm.
```

If the tool cannot keep 20 items apart, ask for two sheets of 10 (items 1-10, then 11-20, each a 5 x 2 grid, same prompt with
"10 game tiles ... 5 columns and 2 rows" and only those ten lines) and cut them into the same folder:
`prep-obstacles-sheet.py art/sheets/obstacles-1.png --rows 2` and `prep-obstacles-sheet.py art/sheets/obstacles-2.png --rows 2 --first 10`.
