# Make the upload keystore (once)

Google sign-in only works when the APK is signed with a certificate whose SHA-1 is registered in Play Console. CI signs with your **upload key** when these GitHub secrets exist (Settings > Secrets and variables > Actions > Secrets):

| secret | value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the keystore file, base64 |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | same as the keystore password (PKCS12 uses one password) |

Keep a backup of `upload.jks` and the password somewhere safe outside the repo (password manager plus a cloud drive). **Never commit the keystore.** If it is lost, Play support can reset the upload key, which takes days.

## Option A: on your PC (keytool comes with Java or Android Studio)

Windows PowerShell. If `keytool` is not found, use Android Studio's copy: `& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"` instead of `keytool`.

```powershell
cd D:\arcade
keytool -genkeypair -v -keystore upload.jks -storetype PKCS12 -alias upload -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Dino Match"
# it asks for a password twice: pick a long one and save it

# base64 text for the ANDROID_KEYSTORE_BASE64 secret (copied to the clipboard)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\arcade\upload.jks")) | Set-Clipboard

# the SHA-1 for Play Console
keytool -list -v -keystore upload.jks -alias upload
```

Keep `upload.jks` outside `D:\arcade\deep-time` so `push.bat` never commits it.

## Option B: no Java? Let GitHub make it (workflow `keystore.yml`)

1. Add the secrets `ANDROID_KEYSTORE_PASSWORD` (a long password you choose), `ANDROID_KEY_PASSWORD` (the same password) and `ANDROID_KEY_ALIAS` = `upload`.
2. Run `push.bat`, which moves `keystore.yml` into `.github/workflows`. Then go to GitHub > Actions > "Make upload keystore (run once)" > Run workflow.
3. When it is green, open the run. The log shows the **SHA-1** (a fingerprint, not a secret). Download the artifact `upload-keystore` (kept 1 day). It holds `upload.jks` (password-protected) and `upload.jks.base64.txt`.
4. Paste the contents of `upload.jks.base64.txt` into a new secret `ANDROID_KEYSTORE_BASE64`. Back up `upload.jks`. Then delete the run (run page > ... > Delete workflow run) so the artifact is gone.
5. The workflow refuses to run again once `ANDROID_KEYSTORE_BASE64` exists, so the key is never replaced by accident.

## Where the SHA-1 goes
- `keytool -list -v` prints `SHA1: AB:CD:...`. Every Actions build also prints it in the step "Decode the upload keystore".
- Play Console > Grow users > Play Games Services > Setup and management > Configuration > Credentials > Add credential > **Android**: package name `com.ronki.dinomatch` + this SHA-1.
- Once the app is on Play (any testing track) with Play App Signing, Google re-signs Play installs with its own key. Copy the SHA-1 under Play Console > Test and release > Setup > **App signing** > App signing key certificate, and add it as a **second** Android credential. Keep both.
