# 20 Ads (AdMob)

AdMob app "Dino Match": `ca-app-pub-5244654412310526~2506824278`.

| Ad unit | ID | Where |
|---|---|---|
| Rewarded - extra moves | `ca-app-pub-5244654412310526/2999272155` | every opt-in "Watch a short ad" button: +5 moves (So close), double coins (win), refill lives |
| Interstitial - between levels | `ca-app-pub-5244654412310526/6661691707` | only after Next/Home on the result screen, from level 8, at most every 3 finished levels, 150 s apart, never within 90 s of a rewarded ad |

Code: `src/ports/ads.js` (`createAdPort`, `wrapAdMob`, `INTERSTITIAL_RULES`), plugin `@capacitor-community/admob` 6.2.0 (Capacitor 6).
The web build and tests use the mock. Consent (EEA/UK) uses Google's UMP form when required: set up the message in AdMob > Privacy & messaging.

## Test vs live
Builds show **Google test ads** unless the GitHub repository variable `ADS_LIVE` is `1` (Settings > Secrets and variables > Actions > Variables).
Set it only for the production release. Never tap your own live ads.

## Manifest
`apk.yml` adds the `com.google.android.gms.ads.APPLICATION_ID` meta-data and the `com.google.android.gms.permission.AD_ID` permission
(the Play Console advertising ID declaration says the app uses the advertising ID).

## app-ads.txt
One line, at the **root** of the developer website set in the Play listing:

    google.com, pub-5244654412310526, DIRECT, f08c47fec0942fa0

A GitHub project page (`/deep-time/`) is not a root. Use a user site: repo `ronak-parmar.github.io` with `app-ads.txt` at its root,
then set the Play listing website to `https://ronak-parmar.github.io`. AdMob checks it after the app is live and linked to its store listing.
