# Painted UI kit: art direction and Gemini prompts

Target look: `art/reference/ui-target.jpg` (Gemini mockup the owner picked). Painted cartoon style, thick soft outlines, warm lighting, real-looking leaves, wooden signs with vines, grey stone plaques, cream stone board tiles, black tar dirt, cracked stone over fossils, lava rocks glowing. The gems keep the existing six-gem look (`art/reference/gem-style.png`).

Why: the vector era boards looked artificial next to the painted gems. Painted layers plus code animation (sway, parallax, glow, dust) is the fix.

## How assets are used

- Code draws all text (level, moves, target, counts). Plates and signs are generated BLANK.
- Generate on a flat dark navy background (#12172A) so `tools/prep-gems.py`-style cut-out works. One sheet per image, elements well separated.
- Shared kit (K1 to K3) is made once and reused for every era, with a light hue/tone shift in code. Per-era art (K4, K5) changes the scenery.
- Layers animate in code: leaves sway, lava glows, dust drifts, using the timings in docs/09.

## Always include in every prompt

"Match the art style of the attached reference image exactly: painted mobile-game UI, thick soft outlines, warm lighting, detailed hand-painted texture, same colour richness. No text, no letters, no numbers anywhere. Flat solid dark navy background (#12172A), every element fully separated with clear margins, nothing cropped. Portrait or square sheet, high resolution."

## K1. HUD kit (once)

"Game HUD parts sheet. Include: (1) a wide wooden sign with vines and lashed rope corners, blank face; (2) a grey carved stone plaque, wide, blank; (3) a smaller wooden header sign for the word target, blank; (4) a round stone medallion for a moves counter, blank; (5) a stone square button with a gear icon; (6) a stone back-arrow button; (7) a stone progress bar frame with a carved dinosaur footprint on the left, empty, plus a separate filled orange bar piece; (8) three stars: one gold lit, two dark empty. Leaf and vine details on the wood parts."

## K2. Board and dirt kit (once)

"Match-3 board parts sheet. Include: (1) 4 plain cream sandstone tiles (slightly different cracks); (2) 4 black tar dirt tiles with small bubbles; (3) 4 cracked pale stone tiles of the fossil layer; (4) a stone board rim made of 8 pieces: straight edge, outer corner, inner corner, each in cream stone; (5) 3 carved stone tablet tiles with a fossil impression (skull, footprint, fern); (6) a pile of loose dirt crumbs and a few dust puffs for effects."

## K3. Booster medallions (once)

"Three round stone medallion buttons, blank on the face except one icon each: (1) a dinosaur-skull pickaxe hammer on teal, (2) an erupting volcano on red, (3) a paintbrush on green. Plus three small round count badges: blue, red, green, blank."

## K4. Era background (per era, 9:16 portrait)

"Full portrait game background for the [ERA] era. Centre area calm, dark and empty so a board can sit on top. Painted foliage, props and fauna framing the left, right, top and bottom edges: [ERA ELEMENTS]. Atmospheric depth, soft glow, no UI, no gems, no text. Do not use a flat background colour for this one: fill the whole image."

## K5. Era props sheet (per era)

"Props sheet for the [ERA] era on flat navy: 4 to 6 separate foliage or rock clusters of different sizes, 2 small animals or creatures, and 3 glowing accents. Elements: [ERA ELEMENTS]."

## Era elements

| Era | Elements |
| --- | --- |
| cambrian | kelp, coral, sea sponges, shell shapes, glowing plankton, bubbles, wet stones |
| devonian | lycopod trees, giant horsetails, early ferns, swamp mist, mud banks |
| carboniferous | giant ferns, scale trees, mossy logs, dragonflies, fireflies |
| permian | red dunes, mesas, cracked red rock, dry scrub, heat haze |
| triassic | volcanic rock, ash, cycads, glowing lava cracks, smoke |
| jurassic | big tropical leaves, ferns, lava rocks, vines (closest to the reference) |
| cretaceous | flowering plants, magnolia, pink sky, ferns, small lava rocks |
| mammals | grass, acacia, boulders, flowers, drifting seeds |
| iceage | ice crystals, snow-laden pines, frozen rocks, icicles, aurora hints |
| humans | cave wall, ochre handprints, torch glow, bones, stone tools |

## Quota plan (Gemini limit is about 20 images a day)

1. Day 1: K1, K2, K3 (3 images), then Cambrian K4 and K5 (2 images) as the test era. Evaluate in the game before more.
2. Then 2 images per era (K4, K5) for the other nine, alternating with the 42 missing gems.
