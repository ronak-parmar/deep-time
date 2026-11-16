# CLAUDE.md: start here

You are continuing a personal side project by **Kratos** (not for his employer). Read this file first, then the docs in the order below. Everything discussed so far is written down in this repo so no chat history is needed.

## What the project is

Two Android-first casual games sharing one engine-agnostic ad-revenue plugin and one design system:

- **Dino Break**: brick breaker (working title).
- **Dino Match**: match-3 gem puzzle with a "dig the fossil" goal and boosters (working title; the name is crowded in the stores, see docs/01).
- **ad-brain**: reusable ad-decision plugin. Games report events and ask for decisions; they never call ad networks directly.
- **Deep Time**: the shared dark design system (tokens, fonts, 12 React components, 10 era palettes).

Stack: Vite JS + Capacitor, Play Games Services saves, GitHub Actions to Google Play, general audience 13+. Levels are procedural and seeded: 10 eras x 100 levels, history video every 50 levels (not an ad).

## Rules of engagement (important)

1. **Do NOT write game code, ad-brain code, or the Android shell until Kratos says "go".** He wants to discuss first and will authorize building. As of the last session this had NOT been authorized.
2. **Do not assign tasks to Kratos.** Do the work yourself where possible; ask only for things only he can do (accounts, keys, a phone test).
3. Use the Deep Time design system for every visual; apply the ui-polish checklist (the user's 20 rules, saved as a skill) to any front-end surface.
4. IP safety: no Arkanoid/Breakout/Ice Age/Jurassic/candy/crush/saga names, no look-alike characters or gems copied from reference games. Original art only (see art/README.md).
5. Sessions may be in a cloud sandbox that cannot push to GitHub. Kratos pushes with `push.bat` in this folder (his PC: `D:\arcade\deep-time`). Tell him to run it after you add files.

## Read order

1. `docs/01-overview-and-decisions.md`: scope, decisions made, open questions.
2. `docs/02-ad-brain.md`: every ad rule and number.
3. `docs/03-levels-and-eras.md`: level curve, 10 eras, play-time model, videos.
4. `docs/04-games.md`: both games, boosters, dig goal, preview behaviour.
5. `docs/05-release-security-ip.md`: Play, AdMob, privacy, security, IP, audience risk.
6. `docs/06-design-system-and-art.md`: tokens, gem shape coding, era scenery, preview.
7. `art/README.md`: **the Gemini art brief** (prompts, file names, sizes, rules).
8. `docs/07-conversation-log.md`: chronological requests/answers, user feedback.
9. `docs/08-next-steps.md`: what to do next once "go" is given.
10. `docs/plan-full.md`: the full original plan document, verbatim.
11. `HANDOFF.md`: short handoff note; `design-system/`: the design system source; `preview/dino-preview.html`: playable preview (self-contained, open in a browser).

## Repo map

```
CLAUDE.md            this file
README.md            repo readme
HANDOFF.md           short handoff
push.bat             init/commit/pull/push helper for Kratos's PC
design-system/       Deep Time tokens, fonts, components
preview/             dino-preview.html (playable Dino Break + Dino Match demo)
docs/                full project documentation
art/                 Gemini art brief + drop folders for generated assets
```

## Published artifacts (claude.ai, private to Kratos)

- Design system: https://claude.ai/artifact/CQne3rtbiNM7PdkWtdx8jw
- Playable preview: https://claude.ai/artifact/99R53zbXHqCPBj3rGdufz5
- Wireframes (Design): https://claude.ai/artifact/Su8idErZrUYKPwoNvdraEA
- Plan doc: https://claude.ai/artifact/N4Rq6eiFuekFEEQ5KD3x5N

Repo: https://github.com/ronak-parmar/deep-time
