# Art brief for Gemini (Dino Break + Dino Match)

Use this brief to generate original game art with Gemini (or any image generator). Save results in the matching folder here using the exact file names so the game code and a future session can load them without renaming. Anything generated must be **original**: do not upload or reference screenshots of other games, and do not ask for "in the style of <game name>".

## Master style paragraph (paste at the start of every Gemini prompt)

> Stylized 2D casual mobile-game art, glossy hand-painted look with soft gradients, a bold dark outline, a single warm top-left light source and subtle inner highlights, rich saturated colour on a deep navy night palette, chunky readable shapes, premium polished finish, no text, no watermark, no logo, no characters from any existing franchise. Mature, teen-and-adult friendly, not cartoonish or childlike. Prehistoric "deep time" theme (ice-age night world: deep blue ice with amber and lava accents): stone, fossil, amber, lava rock, ferns, bone. Every asset on a fully transparent background unless stated, centred, with 8% padding, consistent lighting and outline weight across the whole set.

## Rules

1. PNG with transparent background (except full backgrounds).
2. Same outline weight, light direction and palette across every asset.
3. **Six gems must have six different silhouettes** (not just colours): lava = diamond, amber = hexagon, jade = rounded square, ice = circle, geode = triangle, bone = star. This is an accessibility rule.
4. Readable at 48 px: strong contrast, no tiny detail.
5. Era backgrounds: keep the **middle 70% quiet** (low contrast) so the play field stays readable; put detail at the top and bottom edges.
6. No text, letters, logos, watermarks, signatures.
7. Originality checklist before accepting an image: not a recognizable character, not a copy of a known gem/candy/brick set, no real brand marks. Check the generator's terms for commercial use of outputs. Keep the prompts used (add them to `art/prompts-used.md`).
8. Priority order: (1) six gems, (2) frames + header, (3) two or three era backgrounds, then the rest.

## Palette (from the Deep Time design system)

Navy bg #0B1220 / #14223A / #1D3354; gem colours lava #FF6A4D, amber #FFC24B, jade #3DDC97, ice #6FD3FF, geode #A678FF, bone #F2F8FF (see design-system/tokens.json for exact values and era palettes).

## Asset list

### Priority 1: gems (folder `gems/`), 256x256, transparent

| File | Description |
| --- | --- |
| gem-lava.png | Red-orange faceted **diamond** gem with a glowing ember core |
| gem-amber.png | Gold-amber **hexagon** gem with a small trapped fossil insect or bubble |
| gem-jade.png | Green **rounded-square** gem with carved fern vein lines |
| gem-ice.png | Pale blue **circle** gem, frosted crystal with a bright highlight |
| gem-geode.png | Violet **triangle** gem, cracked geode with sparkling crystals inside |
| gem-bone.png | Ivory **star** gem, polished bone/fossil with fine growth rings |

Prompt template: `[Master style paragraph] A single game piece: <description>. Silhouette must be a clear <shape>. 256x256, transparent background.`

### Priority 2: frames, header, UI plates (folders `frames/`, `ui/`)

| File | Size | Description |
| --- | --- | --- |
| frame-board.png | 1024x1024 | Square stone/wood ring frame for the gem board, hollow centre transparent |
| frame-fossil.png | 1024x512 | Wide frame for the fossil display strip, hollow centre transparent |
| plank-header.png | 1024x192 | Wooden/stone plank for the top HUD bar |
| badge-moves.png | 256x256 | Round stone badge for the moves counter, empty centre |
| plaque-target.png | 384x192 | Stone plaque for the goal/target readout, empty centre |
| fossil-brick-bg.png | 600x200 | Stone slab strip behind the fossil goal |

### Dino Break pieces (folder `break/`)

| File | Size | Description |
| --- | --- | --- |
| block-tier1.png ... block-tier5.png | 256x128 each | Five brick materials from fragile (tier 1: sand/clay) to tough (tier 5: obsidian/metal-veined stone); same size and bevel, clearly different material and colour |
| paddle.png | 512x128 | Carved bone/stone paddle with amber trim |
| ball.png | 128x128 | Glowing amber/lava orb |

### Dino Match extras (folder `match/`)

| File | Size | Description |
| --- | --- | --- |
| dirt-1.png ... dirt-4.png | 128x128 each | Four dirt/rubble tile variants that cover the fossil (tileable look, distinct crack levels) |
| tool-pick.png | 256x256 | Pickaxe booster icon |
| tool-burst.png | 256x256 | Burst/dynamite-style (no brand) booster icon, e.g. a cracked stone shockwave |
| tool-brush.png | 256x256 | Archaeologist brush booster icon |

### Era backgrounds (folder `backgrounds/`), 1080x1920, opaque, quiet middle 70%

`bg-cambrian.png`, `bg-devonian.png`, `bg-carboniferous.png`, `bg-permian.png`, `bg-triassic.png`, `bg-jurassic.png`, `bg-cretaceous.png`, `bg-mammals.png`, `bg-iceage.png`, `bg-humans.png`

Scene hints: Cambrian shallow seabed with trilobite silhouettes; Devonian reef and early fish; Carboniferous giant ferns and swamp mist; Permian red desert rock; Triassic dry plains and cycads; Jurassic lush forest and tall conifers; Cretaceous skies with a faint meteor streak; Age of mammals open grassland; Ice age glaciers and snow; Early humans cave mouth and firelight. Use each era palette from tokens.json.

### Fossils (folder `fossils/`), 512x512 transparent, one per era

fossil-cambrian (ammonite or trilobite), fossil-devonian (fish), fossil-carboniferous (fern imprint), fossil-permian (early reptile), fossil-triassic (early reptile/dino skull piece), fossil-jurassic (sauropod bone), fossil-cretaceous (meteor-era shell), fossil-mammals (mammal tusk), fossil-iceage (mammoth tooth), fossil-humans (hand axe). Name files `fossil-<era>.png` using the era slugs above.

### Later (not needed yet)

- `props/`: scenery props per era (ferns, rocks, bones).
- `effects/`: sparkle, dust puff, shockwave, confetti sprites.
- `icons/`: UI icons, 128x128.
- `video-cards/`: history video title cards.
- `store/`: Play Store icon 512x512 and feature graphic 1024x500.
- Optional mascot: one invented prehistoric creature (original design, no resemblance to any existing character).

## How the next session should use these

1. Check which PNGs exist in each folder.
2. If gems exist, wire them into `preview/dino-preview.html` as sprite loading (replace the canvas-drawn gems), keeping the six-silhouette rule.
3. Do not start the real game build until Kratos says "go" (see CLAUDE.md).
