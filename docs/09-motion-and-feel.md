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
| Pickaxe spend (Dig site) | pickaxe swing `base`, part reveal with shine `slow`, small shake | crumble then chime | medium |
| Fossil complete | confetti, shake `big`, fossil lift `dramatic`, history card after | fanfare-big | heavy |
| Button press | scale 0.96 `instant`, release `quick` `pop` | tick | light |
| Screen change | outgoing fades `quick`, incoming slides 16 px and fades `base` `out` | none | none |
| Counter change | number rolls `slow`, small scale pulse | tick | none |
| Life regained | heart pops `pop` | chime | light |

New events must be added to this table before they are built.

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
