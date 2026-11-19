# 17. Google Play Games: sign-in and cloud save

Package name: **com.ronki.dinomatch** (`games/dino-match/capacitor.config.json`). This name is permanent once the app is on Play.

## How it works
- Native code: local Capacitor plugin `packages/capacitor-play-games` (Play Games Services v2, `play-services-games-v2:20.1.2`). `cap sync` adds it to the generated `android/` project. Its manifest carries the `com.google.android.gms.games.APP_ID` meta-data; CI writes the value to `android/app/src/main/res/values/games-ids.xml` from `PLAY_GAMES_APP_ID`. Without it the value is `0`, Play Games is reported as not configured, and the game keeps local saves only.
- JS: `src/ports/playgames.js` (plugin wrapper) and `src/ports/save.js` `createCloudSaveStore` (wraps the local store). The game always saves locally first. When the player is signed in, it uploads the profile (one saved game, `dino-match-profile`) after changes, at most once every 30 s, plus when the app goes to the background. On start, on Sign in and on Sync now it downloads the cloud copy and merges it (`core/profile.js mergeProfiles`): furthest level, best stars, furthest fossil parts, union of fossils and tutorial/coach steps. Coins, pickaxes, boosters, lives and settings come from whichever copy was saved last (`profile.savedAt`, profile v5).
- UI: Settings > Google Play Games (Android only). Signed out, it shows Sign in. Signed in, it shows the player name, "Cloud save on" and Sync now. On start, PGS v2 signs in silently in the background, so play never waits for it. Toasts: "Progress restored", "Progress saved to Google Play" (after Sync now).
- Tests: `tests/cloudsave.test.js`.

## Your checklist (Play Console, once)
1. **Upload key**: follow `tools/make-keystore.md`. You end up with the four `ANDROID_*` GitHub secrets and the key's **SHA-1**.
2. **Create the app** in Play Console: All apps > Create app (name "Dino Match", Game, Free). It can stay a draft.
3. **First upload** (the package name is claimed on the first upload): push, wait for the Actions run, download `dino-match-release-aab` (or the `.aab` on the GitHub release), then go to Test and release > Testing > Internal testing > Create new release and upload the `.aab`. Accept Play App Signing when asked.
4. **Play Games Services**: Grow users > Play Games Services > Setup and management > Configuration.
   - Choose "No, my game doesn't use Google APIs" and create the game ("Dino Match"). The Cloud project is made for you.
   - **Properties**: turn **Saved games** on. Save.
   - **Credentials** > Add credential > **Android**. Name it "Dino Match upload key" and pick the app (`com.ronki.dinomatch`). Under Authorization, create an OAuth client with package name `com.ronki.dinomatch` and the **upload key SHA-1**. If it asks, first set up the OAuth consent screen (External; app name, your email).
   - Add a **second Android credential** with the **Play App Signing SHA-1** (Play Console > Test and release > Setup > App signing > "App signing key certificate"). Builds installed from Play are signed with that key. Sideloaded GitHub builds use the upload key.
5. **Testers**: Play Games Services > Setup and management > **Testers**: add your Google account and your testers. Until Play Games is published, only testers can sign in.
6. **App ID**: the number at the top of the Play Games Services Configuration page (12 digits, "Project ID"). In GitHub, open Settings > Secrets and variables > Actions > **Variables** > New variable `PLAY_GAMES_APP_ID` = that number. A secret with the same name also works.
7. Push (or Actions > Build debug APK > Run workflow). Install the new APK. Settings > Google Play Games > Sign in. Play a level, then Sync now. Install on a second phone (or after reinstalling) and sign in with the same account: "Progress restored".
8. Before release: Play Games Services > **Review and publish** (publish the Play Games configuration together with the app).

## If sign-in fails
- Sign-in fails straight away, or the row does not appear: check that `PLAY_GAMES_APP_ID` is set and the Actions log step "Write the Play Games App ID" shows no warning.
- "Could not sign in": the SHA-1 or package name in the credential does not match the installed build (a GitHub build uses the upload key SHA-1, a Play build uses the App signing SHA-1). Also check that your account is a tester.
- The game always keeps working with local saves.
