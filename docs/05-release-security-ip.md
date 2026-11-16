# 05. Release, security, privacy and IP

Copy of the plan's checklist, plus decisions. Roles: Claude does code/workflows/drafts; Kratos does anything needing his accounts or devices.

| Area | Plan | Who |
| --- | --- | --- |
| App signing | Enroll in Play App Signing; upload keystore only in GitHub Secrets, backed up | Claude writes workflow; account steps by Kratos |
| Build pipeline | GitHub Actions builds a signed `.aab`; third-party actions pinned to a commit; minimum permissions; secrets only on protected branches/tags | Claude |
| Play releases | Internal testing, then closed testing, then production promoted by hand; personal account created after Nov 13, 2023 needs 12 testers opted in for 14 consecutive days before production | Kratos (Play Console) |
| Accounts | 2-step verification or passkey on Google and GitHub; personal Google account kept separate from work | Kratos |
| Ads | Google test ad unit IDs and a registered test device in dev; live IDs only after AdMob approval; never click live ads; consent form (UMP) before first request where required | Claude builds; Kratos supplies live IDs |
| Ad safety | Hard ceilings in code; remote values clamped; invalid config falls back to defaults; reward buttons away from game buttons | Claude |
| App shell | All code bundled in the app, navigation restricted, web debugging off in release, cleartext off, backup off | Claude |
| Saves | Play Games Services saved games with custom merge (higher level, larger coin total, remove-ads kept if either has it) | Claude; first device test needs a phone |
| Privacy | Privacy policy and `app-ads.txt` on GitHub Pages (a user site is likely accepted by AdMob; to confirm); Data safety form matching real SDK behaviour | Claude drafts; Kratos publishes/submits |
| Audience | General audience, declared 13+; no kid-focused art or store wording | Both |
| IP | Original names cleared by Play Store + trademark search; art and creatures from code, none modeled on an existing film/show/game; sound synthesized; third-party notices file generated in build | Kratos picks names; Claude checks notices |

## IP rules

- Do not use: Arkanoid, Breakout, Ice Age, Jurassic, candy, crush, saga in names.
- No look-alike characters, mascots, or gem designs copied from any reference game. A user-supplied reference image of a popular game was explicitly NOT copied; instead an original brief was written for Gemini (art/README.md).
- Dino Match name is crowded; check before use.

## Audience risk

Dinosaurs strongly attract children. Declaring 13+ may not hold. Default: mature stylized art for teens/adults; read Play's Families policy before writing the listing; if treated as child-appealing, ad settings go child-safe and revenue drops.

## Sources

- Google Play Console Help, testing requirements for new personal accounts: https://support.google.com/googleplay/android-developer/answer/14151465
- AdMob Help, app-ads.txt: https://support.google.com/admob/answer/9363762
- Play Games Services saved games: https://developer.android.com/games/pgs/android/saved-games
- Play Games Services sign-in: https://developer.android.com/games/pgs/android/android-signin
