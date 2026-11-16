# Deep Time

Deep Time is the shared design system for two casual Android games, Dino Break (brick breaker) and Dino Match (match-3), both set across ten eras of Earth history. One dark theme, one font, shape-coded pieces, and ad surfaces that are always honest about being ads.

Load `tokens.css`, `components/bundle.css`, React 18, then `components/bundle.js`. Components live on `window.DeepTime`. Set `data-era="<id>"` on the game root to switch era colours.

## Content fundamentals

- Voice: plain, calm, curious. Short sentences. Say what happened, then what the player can do.
- Buttons are verbs: "Next level", "Try again", "Skip". Never "OK" or "Submit".
- Losing is neutral: "Out of balls", never "You failed". Winning is "Level complete".
- Every ad surface says "AD". Rewarded offers name the benefit first and the cost second: benefit "Get 3 extra balls", note "Watch a short ad".
- History captions teach one fact in one sentence, in past tense, with a number if there is one. No emoji anywhere.
- Era names are proper nouns: Cambrian, Devonian, Carboniferous, Permian, Triassic, Jurassic, Cretaceous, Age of mammals, Ice age, Early humans.

## Visual foundations

- Ground is `bg-0`, panels are `bg-1`, raised controls are `surface`, dividers are `hairline`, control outlines are `border-strong`. Text is `text`; secondary text is `text-dim` and only at 14px or larger.
- `action` (amber) is the one primary button per screen. `reward` (green) is only for opt-in rewarded ads and earned rewards. `danger` is destructive or lives. `info` and `violet` mark counters, never actions.
- Gems are told apart by shape and colour together: lava diamond, amber hexagon, jade rounded square, ice circle, geode triangle, bone star. Never rely on colour alone.
- Blocks take their colour from the active era's `era-tier-1` to `era-tier-5` and show hit points as notches, so tier reads without colour.
- Each era sets `era-sky-top`, `era-sky-bottom` and `era-field`. Text on the sky is 4.5:1 and tiers on the field are 3:1 in every era.
- Spacing uses `space-1` to `space-7`; screen gutters are `space-4`. Cards and buttons use `radius-md`, chips and toasts `radius-pill`.
- Type is Nunito only: `display` for result titles, `title` for sheet titles, `heading` for buttons, `body` for copy, `caption` for tags. Numbers use tabular figures.
- Touch targets are at least `touch-target` (48px). The playfield is `canvas-width` by `canvas-height` (360 by 640), with the HUD at `hud-height`.
- Focus: a 3px `focus-ring` outline with a 3px gap, so it sits on the ground rather than on amber or green fills.
- Motion: `duration-feedback` for taps, `duration-ui` for panels, `duration-reward` for earned rewards, always `ease-out`. Honour reduced motion by dropping transitions.
- Layers: `z-hud`, `z-overlay`, `z-modal`, `z-toast`.

## Ad surfaces

- Interstitials and rewarded video appear only between rounds, never during play, on levels 1 to 3, or straight after a lost round. The ad-brain decides when; this system only draws the result.
- `AdOverlay` always shows the AD tag and a real 48px close control. Interstitials count down to closable; rewarded ads show "Reward in Ns".
- `RewardButton` is the only way a rewarded ad is offered. It is never auto-played.
- `ConsentSheet` gives Accept and Manage choices equal weight: both are secondary buttons.
- `HistoryPlayer` is a short history video and is not an ad. It never carries the AD tag and always has Skip.

## Iconography

Glyphs are drawn from simple geometry (rounded strokes, filled shapes) inside the bundle: video, close, check, warn, info, heart, coin, level, score. No emoji, no icon font. The system includes no logo; the name is set in Nunito 800.

## Components

Button, RewardButton, Counter, Hud, Gem, Block, AdOverlay, ResultScreen, HistoryPlayer, ConsentSheet, Modal, Toast. Each has a guideline file and a live preview under `components/`.
