# 09. Motion and feel standard

One rulebook so every screen moves, sounds and rewards the same way. Applies to Dino Match first, then Dino Break. Code source of truth: `src/render/motion.js` (timings, easings, shake, particles) and `src/render/sound.js` (sound map). Nothing may hardcode a duration, easing or shake size outside those files.

## 1. Feel in one line

Digging should feel **weighty and earthy** (stone, dirt, bone); gems feel **light, glassy and bright**; rewards feel **generous but short**. Era themes change colours and textures only. They never change timing.

## 2. Motion principles

1. **Everything has mass.** Heavy things (dirt, fossils, plaques) move slower and settle with a small thud. Light things (gems, sparkles, numbers) move fast and bounce.
2. **Ease out to arrive, ease in to leave.** Things entering decelerate. Things falling accelerate. No linear motion except looping ambient.
3. **One thing is the hero.** Per moment, one element gets the biggest motion. Everything else supports it.
4. **Never block the player.** Input is accepted again as soon as the logic allows. Celebrations can be skipped by a tap.
5. **Escalate, do not repeat.** Bigger events get bigger motion, never longer waits for small events.
6. **Same event, same motion, everywhere.** If a coin counter ticks up on the Win screen, it ticks the same way in the Dig site.

## 3. Tokens

Durations (ms): `instant 80`, `quick 140`, `base 220`, `slow 360`, `dramatic 600`, `celebrate 900`.
Stagger between siblings: `40` (gems in a column), `80` (list items), `120` (reward items).

Easings:
- `out`: cubic-bezier(0.2, 0, 0, 1). Default for entering and moving to rest.
- `in`: cubic-bezier(0.4, 0, 1, 1). For leaving.
- `pop`: cubic-bezier(0.34, 1.56, 0.64, 1). Small overshoot, for appearing and rewards.
- `fall`: ease-in quadratic then a settle bounce (amplitude 12% of fall height, once).
- `linear`: only for loops and progress bars.

Squash and stretch: pop 1.15, squash on land 0.88 tall / 1.12 wide, return `quick`.

Shake (px, ms): `tiny 2/100` (invalid swap), `small 4/160` (dirt crumble), `medium 6/220` (big cascade), `big 9/320` (fossil reveal). Disabled under reduced motion.

Particles: `sparkle` 6 to 10 per gem, life 450 ms, gem colour. `dust` 8 to 12 per dirt block, life 600 ms, earth tone. `confetti` 30 to 60 for fossil complete, life 1200 ms. Pooled, max 200 live.

## 4. Event recipes (the one place events map to motion)

| Event | Motion | Sound | Haptic |
| --- | --- | --- | --- |
| Tap gem | scale 1.08, `quick`, `out` | tick | none |
| Swap valid | glide `base`, `out`, overshoot 4% | swap | none |
| Swap invalid | glide, `tiny` shake, return `base` | thud-soft | light |
| Match clear | pop 1.15 then shrink to 0, `base`, `pop`, sparkles | pop (pitch by size) | light |
| Fall and refill | `fall`, stagger `40`, landing squash | tick-soft | none |
| Cascade step n | match recipe, combo text scales in, pitch +1 semitone per step | pop ladder | light at step 2+ |
| Dig block | crumble 3 pieces, dust, `small` shake, counter ticks | crumble | medium |
| Last block | `medium` hold 120 ms, fossil glow `slow`, flash, `big` shake | reveal | heavy |
| Fossil found banner | drops in `slow` `pop`, holds, leaves `base` `in` | fanfare | none |
| Win screen | panel slides up `slow` `out`, then stars and pickaxes pop (`120` stagger), coins tick up (count `slow`) | star ladder | light per star |
| Lose screen | panel fades `base`, no shake, soft | low-tone | none |
| Pickaxe spend (Dig site) | the kit pickaxe (art/ui/kit/pickaxe.webp) swings 3 strikes onto the next part (each `base` x1.2: wind-up `out`, strike `in`, `instant` gap): rock chips, dust, crack lines and a half `small` shake per strike, the last one heaviest with a full `small` shake; then the dirt is brushed away along the part's stroke `slow` and the bone shines (sparkles). Reduced motion: no swing, the part just appears | crumble then chime | medium |
| Moves running low (HUD) | MOVES number turns amber and pulses (`celebrate` loop) at 5 or less, red and faster (`dramatic` loop) at 3 or less, with a soft glow ring. Reduced motion: colour only | none | none |
| Hard / super hard level | static: crimson (hard) or violet (super hard) glow around the board frame and behind the HUD plates, background 22-28% darker; the frame glow breathes on the hint loop. Gems and board unchanged. Reduced motion: no breathing | none | none |
| Fossil complete | confetti, shake `big`, fossil lift `dramatic`, history card after | fanfare-big | heavy |
| Button press | scale 0.96 `instant`, release `quick` `pop` | tick | light |
| Screen change | outgoing fades `quick`, incoming slides 16 px and fades `base` `out` | none | none |
| Counter change | number rolls `slow`, small scale pulse | tick | none |
| Life regained | heart pops `pop` | chime | light |
| Hit block (plaque, block survives) | block jolts `quick` `out`, 2 shards, a little dust, `tiny` shake, crack stage shows | chip | light |
| Create special | piece pops in `base` `pop` (1.15 overshoot), sparkles | chime | light |
| Fire special | blast flash and beams `slow` `out`, chained fires start `list` (80 ms) after each other (capped so a chain never exceeds 2 s), `medium` shake, sparkles | boom | medium |
| Obstacle hit (board, survives) | tile jolts `quick` `out`, 2 shards, a little dust, `tiny` shake, crack stage shows | chip | light |
| Obstacle breaks (board) | tile crumbles `base` `in` (3 shards, dust), `small` shake; a crate shows its coin drop | crumble | medium |
| Collect item (artefact reaches the bottom row) | piece pops `slow` `pop` and fades with sparkles, a label floats up | chime | light |
| Tar spreads | a new tar pit grows in `slow` `out` from its neighbour, the gem under it shrinks away, `tiny` shake | lowTone | none |
| Lava erupts | lava flares and shakes `medium`, tar pits grow in over `slow` `out` with dust, gems under them shrink away | boom | medium |
| Booster picked (bar button) | medallion lifts and glows `quick` `pop`, tiles that can be targeted breathe a gold ring, a prompt with Cancel slides in | chime | light |
| Booster used | effect on the board `slow` `out` (Pickaxe: the kit pickaxe swings down onto the tile over `base` x1.4, then dust and shards; dust and shards for Rockslide, green sparkles for Brush, gold for Amber Lure, shake for Tremor), `small` shake, then the normal clear / hit / fall events | crumble then chime | medium |
| Target changes (HUD) | the target row pulses `base` `pop` | tick | none |
| Target done (HUD) | row pulses `slow` `pop`, tick glyph appears | star | light |

New events must be added to this table before they are built.

### 4b. Yuvi, the helper dino (M7)
Nine drawn pose frames (`art/mascot/dino-*.webp`) with whole-body motion ported 1:1 from `preview/yuvi-lab.html` (approved). Code: `src/ui/yuvi.js` (component, pose math), `src/ui/helper.js` (where and when), lines in `src/data/yuvi.js`, timings in `motion.js` `YUVI`.

| Event | Motion | Sound | Haptic |
| --- | --- | --- | --- |
| Pose change | the new frame squash-pops (`quick`, 8%) | none | none |
| Enter / leave | waddles in from the left edge `celebrate` `out` (idle frame, rock and bob), leaves the same way `in` (flipped) | none | none |
| Speech bubble | pops in `base` `pop` after `quick`, text types out (28 ms a character); tap = finish, tap again = continue | none | none |
| Idle / talk / wave / point / think / sad / surprised / cheer / dig | lab loops: bob + squash, talk frame at 5 Hz, sway, lean toward the target (the point drawing faces right; flipped for a target on the left), tilt, droop + desaturate, hop, hop with sparkles (3 stars: 1.6x hop + confetti burst), swing with rock chips to the right | none | none |
| Reduced motion | pose swaps only: no bob, hop, walk, pop or particles; the text appears at once | none | none |


## 5. Reward ladder

Small (match, coin): <= 300 ms, no shake. Medium (dirt dug, star): <= 600 ms, small shake. Large (win, part unearthed): <= 1.2 s, medium shake plus confetti allowed. Huge (fossil complete): <= 2.5 s, skippable after 600 ms.

## 6. Sound

Palette: stone, wood, glass, soft chimes. No harsh synths. Master volume 0.6, UI sounds 0.4. Combo ladder: pitch up one semitone per cascade step, capped at +7. Max 6 simultaneous sounds, sounds under 300 ms except fanfares. Mute toggle saved in the profile. Audio unlocks on first tap. No music in v1.

## 7. Haptics

`navigator.vibrate` only where available, behind a setting. light = 8 ms, medium = 16 ms, heavy = 30 ms. Never more than one haptic per 80 ms.

## 8. Accessibility and performance

- `prefers-reduced-motion`: no shake, no particles, durations halved, no looping ambient, banners fade only.
- No flashes above 3 per second.
- 60 fps target on a mid-range phone. No per-frame allocations, pool particles, animate transform and opacity only, cap draw calls on the board.
- All timing goes through `motion.js`, so one change retunes the whole game.

## 9. Theme versus motion

Era themes (docs/06, `eraTheme.js`) set palette, frame, texture and ambient visuals only. Timing, easing, shake and particle counts are global. Ambient loops (shimmer, snow) are slow and subtle, and must not distract from the board.

## 10. Review checklist (every new animation)

1. Is the event in the section 4 table?
2. Uses tokens only? No raw numbers.
3. Does it block input longer than needed?
4. Reduced-motion variant exists?
5. Same on every era and every screen?
6. Sound and haptic assigned?
7. Within the reward ladder cap?

## History cutscenes (M2)
Cutscenes are a pure function of time (`data/cutscene.js`, seconds, 20-30 s, T. rex finale up to 30 s): title, 10 parts unearthed, hold, 2-3 fact captions, outro. Drawn by `render/cutscene.js`; music bed by `renderBed` in `render/sound.js` (works live and offline). Skippable and replayable from the museum. No new RECIPES were added to motion.js.
