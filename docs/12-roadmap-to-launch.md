# 12. Roadmap to a finished Dino Match (owner: Claude, approved by Ronki 17 Nov 2026)

Rule: no external image generators (Gemini, Canva) any more. All art is built in code or reuses the four real painted backgrounds. Work is done in the order below, each milestone verified (tests, screenshots, byte check on the PC) and reported to the owner.

## Done
- Core match-3, lives, coins, pickaxes, progression data, ad-brain plugin, motion standard (docs/09).
- Painted-layer renderer, code-built UI kit, 10 era backgrounds (4 real, 6 procedural).
- Specials, chains, reshuffle, hint; match-driven dig; level targets; 8 obstacles and 5 objective types; tutorial; levels 1 to 1000 validated.

## In progress
- M0: Capacitor Android wrap and GitHub Actions apk.yml (debug APK as a downloadable artifact).

## To do, in order
- M1 Dig site (fossil dig-up) complete: 20 fossils (2 per era), 10 parts each, 5 pickaxes per part, pickaxe spending screen, per-part reveal animation, collection/museum screen, partial progress saved, "Dig site usable while waiting for lives" flow, fossil names and short facts (researched, accurate).
- M2 History videos: one per completed fossil (20), played in-game as data-driven cutscenes rendered by our own canvas renderer (era background parallax, fossil silhouette drawn on, captions with verified facts, music bed from sound.js), 20 to 30 s each, skippable, replayable from the museum. No mp4 bundles (keeps the APK small). Facts researched from reliable sources and recorded in docs/13-fossil-facts.md with sources.
- M3 Gems for eras 4 to 10 (42 gems): painterly generator in the style of the existing 18, per-era emblems, same silhouettes and colours.
- M4 Boosters: pickaxe (clear one tile), burst (clear 3x3), brush (recolour), earned/bought with coins, tutorial for each; enabled in the HUD.
- M5 Audio: finish sound design from docs/09 (synth-based effects, music loops per era via WebAudio), settings for sound/music/haptics.
- M6 Monetisation and meta: ad-brain wired to AdMob through Capacitor (test ids only), rewarded +5 moves and double-coins, daily reward, settings, privacy/consent flow (13+ audience), save backup.
- M7 Polish and balance: per-era difficulty curve pass with the bot, performance on low-end phones, fix console warnings (the 404), accessibility, localisation-ready strings, app icon and splash.
- M8 Release prep: signed release build workflow, Play Console listing text, privacy policy page, screenshots, content rating answers, data-safety notes. Needs the owner's Play and AdMob accounts.

## Honest limits
- Art made in code is clean and consistent but not hand-painted quality; the four real backgrounds are the bar. The owner can swap any asset later by dropping a file with the same slot name.
- Real-device testing, store accounts, AdMob ids and the final go/no-go are the owner's.

## Status update
- M0: Capacitor wrap and APK workflow written, not yet run on CI.
- M1: dig site, museum, roster (47) written; facts need web verification.
- M2: cutscene engine done; mp4 render pipeline (tools/render-cutscene) still to do.
