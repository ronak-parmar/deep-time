# 19. Loading screen art

The loading screen (screens/boot.js) sits on a painted background. All files live in `art/boot/` and are bundled with the game (Vite picks up every `loading-*.webp` at build time: drop a file in, rebuild, it joins the rotation).

| File | What |
| --- | --- |
| `loading-bg-final.webp` | THE DEFAULT painting (portrait 1080 x 1920). Always shown on the very first launch. |
| `loading-bg.webp` | Small first-paint copy of the default (540 x 960, under 80 KB), the page background in `index.html` before any script runs. Never picked by the rotation. Remake it whenever the default changes: `python tools/make-loading-bg.py --first-paint` |
| `loading-<name>.webp` | More general paintings for the rotation (any name, e.g. `loading-river.webp`, `loading-dusk.webp`), portrait 1080 x 1920. |
| `loading-era-<era-id>.webp` | Optional painting for one era (`cambrian`, `devonian`, `carboniferous`, `permian`, `triassic`, `jurassic`, `cretaceous`, `age-of-mammals`, `ice-age`, `early-humans`). |

Every painting gets the same soft warm vignette laid over it in CSS (darker edges and lower third, a little gold behind the logo), and `index.html` lays the identical vignette over the small copy, so the hand-over from the first paint to the boot screen is seamless. Base colour under everything: `#2A1A0C` (also the Android WebView background, `capacitor.config.json`).

## Rotation

Which painting a launch shows (`pickBootBg` in `src/core/preload.js`, unit tested in `tests/boot.test.js`):

1. First launch (no level won yet): the default, `loading-bg-final`.
2. With progress, and a `loading-era-<id>` exists for the era of the player's current level: that one, about 60% of launches.
3. Otherwise a random general painting, never the same one as last launch (the last pick is kept in localStorage `dm.bootBg`; private mode just forgets it). With only one general painting it is always that one.

The first paint always shows the default (small copy, then full size). When this launch's pick is a different painting it crossfades in over about 0.3 s once its file has loaded (instant under reduced motion). Boot never waits for it: if the game is ready first, the map simply follows.

## Making a painting

1. Paste a prompt below into the image tool. Attach the islands sheet and the specials sheet as style references if the tool takes images.
2. Pick the one where the upper middle and the lower third are calm (the logo covers the upper middle; the progress bar and the fact card sit in the lower third).
3. Export or convert it to webp, portrait 1080 x 1920 (any 9:16 works; keep it under about 350 KB, quality 80 is fine), and save it as `art/boot/loading-<name>.webp` (or `loading-era-<era-id>.webp`). To make it the new default, save it as `loading-bg-final.webp` and run `python tools/make-loading-bg.py --first-paint`.
4. Rebuild. Nothing else to change.

### Prompt (the default: golden-hour dig site)

```
A vertical 9:16 mobile game loading-screen background, portrait 1080x1920, in a glossy, richly painted cartoon style: soft
painterly shading, warm saturated colours, crisp clean shapes with gentle rim light, like premium casual mobile game art (the same
style as a set of floating fossil-dig islands with carved fossil slabs, mossy rock cliffs, ferns and little waterfalls).

Scene: a golden-hour fossil dig site in a lush prehistoric jungle. In the middle distance, a big carved stone slab with a fossil
skeleton in relief, half dug out of warm sandstone, with a few wooden pegs, a rope line and small dig tools around it. Giant ferns,
cycads and tree ferns frame the left and right edges. In the sky, several small floating islands of rock and jungle with thin
waterfalls spilling off them, hazy with distance. Warm sunbeams from the top centre, golden light, soft mist and floating dust
specks, deep green foliage against amber and peach sky.

Composition: keep the UPPER MIDDLE (the area from about 15% to 50% of the height, centre 70% of the width) calm and open, just soft
sky and glow, because a large square game logo sits there. Keep the LOWER THIRD fairly calm and slightly darker (ground and soft
shadow), because a progress bar and a text card sit there. Put the detail (fossil slab, ferns, islands) around these areas: the slab
just below the logo area, the plants on the sides, the islands near the top corners.

No text, no letters, no logo, no characters, no people, no animals, no dinosaurs (only fossil bones carved in stone), no UI, no
frame or border. Full-bleed painting edge to edge.
```

If the result is busy behind the logo, ask for "more empty glowing sky in the upper middle" or "a softer, darker lower third".

### More ideas for the rotation

Use the same first paragraph (style) and the same Composition and No-text paragraphs as above; swap only the Scene paragraph.

- **Moonlit river camp:** "Scene: a calm prehistoric river at dusk under a big pale moon and a violet-to-amber sky. A small dig camp on the near bank: a canvas tent glowing with lantern light, a fossil slab propped on a rock, brushes and a pickaxe. Giant horsetails and cycads frame the sides, fireflies over the water, floating islands with waterfalls silhouetted in the sky."
- **Cliff-face quarry at sunrise:** "Scene: a towering sandstone cliff with a huge ammonite and a long-necked skeleton carved in relief, wooden scaffolding and ladders against it, rope pulleys, sunrise light raking across the rock in warm orange and pink. Ferns and moss along the base, a few floating rock islands drifting in the morning haze above."
- **Ice-age dig (era: `loading-era-ice-age.webp`):** "Scene: a snowy valley in soft golden morning light, a mammoth skull with curved tusks half uncovered in blue ice, wooden stakes and rope marking the dig, pine trees dusted with snow on both sides, small floating islands of ice and rock with frozen waterfalls in the pale sky."
