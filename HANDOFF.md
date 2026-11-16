# Deep Time: handoff for a new Claude session

Paste this file into a new chat, or point Claude at it, to continue from where this left off.

## What this is
Personal side project (not for Motilal Oswal). Two Android-first casual games sharing one reusable ad-revenue plugin and one design system, built in Vite JS and wrapped with Capacitor. Repo: github.com/ronak-parmar/deep-time. Local folder: D:\arcade\deep-time.

- **Dino Break**: brick breaker. **Dino Match**: match-3 with prehistoric stones; goal is to dig away dirt and uncover a buried fossil.
- **ad-brain**: engine-agnostic ad plugin. Interstitial + rewarded video, streak-aware, probabilistic (never predictable), per-day budget, player segments, hard limits in code, tuned by a simulator. Rewarded ads are opt-in only. No ads on levels 1 to 3, during play, or straight after a lost round.
- **Levels**: procedural, seeded, bot-checked. Ten eras of 100 levels each (Cambrian, Devonian, Carboniferous, Permian, Triassic, Jurassic, Cretaceous, Age of mammals, Ice age, Early humans), cycling after level 1,000. A short history video every 50 levels (not an ad).
- **Save**: Play Games Services. **Release**: GitHub Actions to Google Play (internal test, closed test with 12 testers for 14 days, manual production). General audience (13+); a dinosaur theme may appeal to children, so check Play Families policy.

## What exists
- `design-system/`: Deep Time tokens (one dark theme, Nunito), 12 React components, 10 era palettes, usage rules in `design-system/README.md`. Published also as a Claude Design System artifact (private to the original account).
- `preview/dino-preview.html`: self-contained playable preview of both games (era switcher, animated match-3, dig goal, boosters, per-era scenery). Open in a browser.
- Not built yet: ad-brain code, real game code, Android shell. Only the plan and previews exist.

## Decisions made
- Art is original and drawn from code or generated separately; no look-alikes of existing games (no Arkanoid/Breakout/Ice Age/Jurassic/candy/crush/saga names or characters).
- The six gem silhouettes stay fixed for accessibility: diamond (lava), hexagon (amber), rounded square (jade), circle (ice), triangle (geode), star (bone).
- Era changes the background, block tier colours and fossil goal.
- UI follows the 20-point ui-polish checklist (one primary action, tabular numbers, loading and empty states, useful motion only, reduced-motion respected).

## Open decisions
Final names (needs trademark and store-name clearance), build order, whether Dino Match gets an energy timer (current lean: no), web build, launch slice (current lean: first 4 eras, 400 levels), mascot, history video format, audience and Families-policy risk.

## Art still to supply (generated separately)
Six gem sprites, block tiers 1 to 5, paddle and ball, board and fossil frames, header plank and badges, dirt tiles, three booster icons, ten era backgrounds (1080x1920, quiet middle 70%), ten fossil goal images, props, effects, icon set, store graphics. Transparent PNG, light from top left, thick dark outline, no text.

## Next steps when you say go
1. ad-brain core plus mock provider and simulator.
2. Dino Break and Dino Match on top of the design system.
3. Capacitor Android shell, AdMob (test IDs only), Play Games Services, consent (UMP).
4. GitHub Actions release pipeline.
