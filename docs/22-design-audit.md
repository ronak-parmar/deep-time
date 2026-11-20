# Dino Match: design audit and story-video plan (20 Nov 2026)

Screenshots: `shots/` (360x640 CSS px, numbered as referenced below).

## Top findings
1. Story videos use old code-drawn art (cartoon skeleton, old scenery); T. rex title runs off screen (shot 20).
2. The ~34 MB AAB almost certainly ships without the 47 videos (a default build would carry 111 MB of mp4); players see the in-engine fallback.
3. Out of lives screen bug: always shows 5 full hearts, even at 0; 5 stacked buttons incl. a disabled Play (shot 10).
4. Rewarded-ad button is flat CSS green, the only unpainted control, on all 3 money screens.
5. Win screen: "Fossil found!" vs "part uncovered" contradiction, plain-text rewards, Yuvi's bubble covers Next level (08, 25).
6. Typography: only Nunito 400/700/800 bundled but 900 used (faked), no display face, numbers unoutlined, 10 px HUD labels.
7. App icon: whole framed logo inside the launcher shape; text unreadable at icon size (32).
8. Pre-level, home map and dig site look empty/flat (lavender sky, navy CSS dock, brown gaps around the dig slab).

## Ranked list (impact / effort; S < half a day, M 1-3 days, L > 3 days)
| # | Where | Weak | Do | Type | Impact | Effort |
|---|---|---|---|---|---|---|
| 1 | Out of lives | hearts ignore lives; 5 buttons; disabled Play | real hearts, hide Play at 0, compact row | code + heart art | High | S |
| 2 | Ad button | flat CSS green | painted jade plank button with AD tag | art + CSS | High | S |
| 3 | Win screen | wrong banner text, plain rewards, bubble over button | correct banner, reward chips that count up and fly to the HUD, outlined score | code | High | M |
| 4 | Typography | faked 900, no display face, tiny labels | display font for titles/numbers, outlined number styles, 11-12 px labels | CSS | High | S |
| 5 | Story video look | old code art, title overflow | rebuild (see below); quick fix: clamp title size | art + code | High | M-L |
| 6 | App icon | framed logo shrunk, unreadable | full-bleed hero (Yuvi + glowing gem), no text | art | High | S |
| 7 | Store listing | no screenshots | 6 framed 1080x1920 shots + feature graphic | art + capture | High | M |
| 8 | Pre-level | empty panel, placeholder stars, wrapping text | fossil slab thumbnail + x/10, big objective slot, painted star slots | code | High | S |
| 9 | Home map | flat lavender sky, navy dock, "Museum 0" | painted sky + wood/stone dock, badge counts | art + CSS | High | M |
| 10 | Dig site | brown gaps, flat panel, code dirt | excavation backdrop, dirt texture, painted card/heart plate | art + CSS | High | M |
| 11 | So close | weak loss framing, wrapping button | show goals left + "Keep your pickaxe!", "+5 moves · 50" | code | High | S |
| 12 | Museum | flat bg, wrapping dates, repeated locked text | gallery backdrop, plinth cards, short dates, era strip | art + CSS | Med | M |
| 13 | Museum detail | narrow slab, stray dots | full-width slab, fact chips | code | Med | S |
| 14 | In-level HUD | empty band below board before boosters, tiny goal icons, no low-moves warning | bigger board or fossil strip, 28-32 px goal icons, red pulsing moves at 5 or fewer | code | Med | S |
| 15 | Shop | 4-line descriptions, clipped last row, no packs | 1-line text, padding, lock badge "Lv 75", owned badge, coin/ad row | code | Med | S |
| 16 | Settings | label-swap buttons, duplicate icon, two closes | painted toggles, Yuvi icon, one close | art + code | Med | S |
| 17 | History intro | flat gradient | glowing slab, ribbon, confetti | code | Med | S |
| 18 | Island props | code-drawn sticker plants | (being replaced by ambient art) | art | Med | M |
| 19 | Transitions | generic fade everywhere | sand/dust wipe for map <-> level | code + fx | Med | M |
| 20 | Yuvi stacking | bubble + card + popup overlap | queue lines until popups close | code | Med | S |
| 21 | Lose screen | big "0" score, tiny progress | goal progress, "-1 life" chip, Try again primary | code | Med | S |
| 22 | Button feedback | scale + sound only | pressed drop + darken, clearer disabled | CSS | Med | S |
| 23 | Colours | leftover navy tokens, black bars | one warm palette, amber bars | CSS | Med | S |
| 24 | How to play | header looks like a button, dense | ribbon headers, mini demos | code | Low | M |
| 25 | Hard tint | code flame on locked hard nodes | painted flame, tinted HUD plates | art + CSS | Low | S |
| 26 | Colour-blind | blue diamond vs purple pentagon close | optional high-contrast symbols | code | Low | S |
| 27 | Contrast / taps | low contrast spots, 18 px booster "+" | 4.5:1, whole medal tappable | CSS | Low | S |
| 28 | Loading | flat bar fill and fact card | painted card, bar shine | CSS | Low | S |

Remaining code-drawn bits not in the current art batch: cutscene renderer, dig slab dirt cover, some glyph icons (heart, video, lock, coin, pick), locked hard-node flame, CSS progress bars, hard-level ribbon, objective icon tile, ad button, dock bar, settings toggles, history screen chrome.

## Story videos
Now: they play after a fossil's 10th part (about every 50 levels) and from the museum. ~26.5 s each (29.8 s T. rex), captions + generated music, 47 mp4s (107 MB at 720p, 42.7 MB small copies). The shipped AAB most likely has none of them, so players see the live canvas version.

| Option | What | Cost | App size | Effort | Risk |
|---|---|---|---|---|---|
| (a) painted stills in-engine | era painting -> painted slab dig reveal -> living animal cut-out with parallax/zoom -> facts -> museum | 8 Gemini sheets of 6 animals | +6-10 MB, drop videos | M (2-4 days) | low |
| (b) AI clip per fossil | 2-3 clips of 8-10 s each | ~$250-350 with retries | +70-120 MB | L | style drift, model retirements |
| (c) hybrid | (a) + ~10 short AI hero clips from the painted stills | ~$25 | (a) + 6-12 MB | (a) + M | low-med |
| (d) fewer | 10 era videos | varies | varies | M | loses per-fossil story |

Recommendation: (a) now, stop bundling mp4s; (c) later for the T. rex and era finales.

### Animal sheet prompt template (2 x 3 grid, 6 animals)
```
Sheet of 6 separate prehistoric animals for a mobile paleontology puzzle game, in a 2 x 3 grid
(2 columns, 3 rows) with wide plain pure-white gaps between them. Each cell: ONE living animal,
full body, whole silhouette inside the cell with margin, on plain pure white (no ground, no
shadow puddle, no scenery), so it can be cut out. Style: semi-realistic painterly 3D look like a
premium mobile game, rich saturated colours, soft golden key light from the upper left, warm rim
light, gentle glossy highlights, clean readable silhouette, anatomically correct. Same lighting,
same scale feel and same rendering for every cell. No text, no letters, no frames, no humans,
no other animals.

For each animal follow the anatomy, pose and colouring exactly:
1. <NAME> (<scientific name>, <era>): ANATOMY: <must-have features>. POSE: <pose>, facing <left|right>.
   SKIN/COLOUR: <covering + palette that fits the era painting>.
...
```

### T. rex example cell
```
1. TYRANNOSAURUS REX (Tyrannosaurus rex, Late Cretaceous, about 67 million years ago):
   ANATOMY: huge deep skull, forward-facing eyes, heavy jaw, thick neck, body held horizontal,
   tail straight out and off the ground (never dragging), powerful legs with three forward toes,
   tiny arms with only TWO fingers each, adult skin mostly scaly and pebbly, no full feather coat.
   POSE: mid-stride walk, head slightly lowered, mouth a little open showing teeth.
   SKIN/COLOUR: warm olive-brown back fading to a sandy belly, faint darker stripes, amber eye.
```

### Hero clip (option c), 8 s, from a painted still
```
Start from this exact image. Slow cinematic push-in. The Tyrannosaurus takes two heavy steps toward
the camera, lowers its head and roars; leaves and dust shake; birds burst from the trees. Keep
the painterly style, lighting and colours exactly; no new characters, no text.
```

Sources (check current pricing in the tools before buying):
- https://ai.google.dev/gemini-api/docs/video
- https://letsdatascience.com/news/google-launches-gemini-omni-12-flash-with-15-second-video-ch-678ef595
- https://the-decoder.com/googles-gemini-omni-1-1-flash-makes-ai-video-generation-cheaper-and-more-flexible/
- https://runware.ai/docs/models/google-gemini-omni-flash-1-1/guides/resolution-and-duration
- https://ai.google.dev/gemini-api/terms
- https://9to5google.com/2026/03/17/google-ai-pro-ultra-features
- https://eesel.ai/blog/kling-ai-pricing
