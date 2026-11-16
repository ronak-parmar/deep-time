# 08. Next steps

Nothing below that writes game/ad-brain/Android code may start until Kratos says "go".

## Allowed now (design/discussion)

- Wire Gemini-generated PNGs (in `art/`) into `preview/dino-preview.html` as sprite loading, keeping canvas fallbacks.
- Add a textured layer (stone/wood/foliage) and the new gem look to the design system.
- Add the plan doc and wireframes exports into `docs/` if wanted.
- Sound synthesis sketch (all sound synthesized, no samples).
- Name search notes for Play Store / trademarks.

## After "go" (proposed order, see docs/01 open decision 2)

1. Repo scaffold: Vite + Capacitor project structure, shared packages (`ad-brain`, `design-system`, `games/dino-break`, `games/dino-match`).
2. `ad-brain` with Mock provider and simulator; unit tests for all pacing rules in docs/02.
3. Dino Break on the shared engine.
4. Dino Match.
5. Procedural level generator with bot + win-rate band (docs/03).
6. Android shell: Capacitor, hardened WebView, Play Games Services saves.
7. GitHub Actions: signed `.aab`, pinned actions, minimal permissions.
8. AdMob adapter with test IDs, UMP consent.
9. Privacy policy and app-ads.txt on GitHub Pages; Data safety draft.
10. Internal test, then closed test (12 testers x 14 days), then production.

## Needs Kratos

Real-phone tests, Play Console and AdMob accounts, tester recruitment, publishing the policy pages, picking final names, running `push.bat` after each batch of file changes.
