# 06. Design system, themed art and preview decisions

Source of truth for tokens: `design-system/tokens.json`. This file records the decisions.

## Deep Time tokens (one dark "night" theme)

| Token | Value |
| --- | --- |
| bg-0 | #0B1220 |
| bg-1 | #14223A |
| surface | #1D3354 |
| hairline | #2E4A73 |
| border-strong | #6F93C4 |
| text | #F2F8FF |
| text-dim | #9DB4CF |
| action | #FFC24B (on-action #1A1203) |
| reward | #3DDC97 (on-reward #052414) |
| danger | #FF6A4D |
| info | #6FD3FF |
| violet | #A678FF |
| focus-ring | #FFFFFF |

- Gem aliases: lava, amber, jade, ice, geode, bone.
- Font: Nunito 400/700/800 (embedded in the preview).
- Spacing 4/8/12/16/24/32/48. Radius 8/16/pill. Touch target 48. HUD 56. Canvas 360x640.
- Durations 120/220/400 ms. z-index tokens.
- 10 era palettes (sky top/bottom, field, 5 brick tiers), contrast-checked.

## Components (design-system/components/bundle.js, window.DeepTime, React.createElement, no JSX)

12 components incl. Gem, Block, AdOverlay, ResultScreen, HistoryPlayer, ConsentSheet. Glyph SVGs. Each has a README and preview.

## Gem shape coding (accessibility)

lava diamond, amber hexagon, jade rounded square, ice circle, geode triangle, bone star. Never rely on colour alone.

## Themed art decisions (preview)

- The preview originally looked lifeless; the user asked for animation/juice, a themed look like a reference game's feel, and backgrounds that change with the era.
- Frames became ring slabs (stone/wood/etc.) with translucent field panels so era backgrounds show through; overlay darkness reduced.
- Each era has generated scenery (buildScenery/eraArt: fronds, lava rocks, planks, slabs, rings, labels) and a fact per era (FACTS).
- Gem colours use alias resolution (res()) so token aliases resolve to real hex.
- Boosters, dig dirt over an ammonite, new gem looks per theme.
- The user then asked to design gems like a reference image. Copying was declined for IP reasons; plan is original art from Gemini via the brief in art/README.md. Optional next: load Gemini PNG sprites into the preview and add a textured layer to the design system.

## Preview file

`preview/dino-preview.html`: self-contained, base64 Nunito, vanilla JS/canvas. Functions: buildScenery, eraArt, frond, lavaRock, plank, slab, ring, label; Dino Break engine (resetBrk, stepBrk, drawBrk with trail/flash/squash/shake/combos); Dino Match engine (gem objects, tween/ease/bounce, cascade, tryMove, useBoost, crumble, afterMove); era chips; interstitial countdown; history card.

## Wireframes

Design artifact (see CLAUDE.md for link): Main, BreakPlay, BreakResult, MatchPlay, HistoryVideo, AdChoices frames with notes.
