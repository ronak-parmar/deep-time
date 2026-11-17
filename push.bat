@echo off
cd /d "%~dp0"
rem Put the GitHub Actions workflow in place (a tool cannot write there, so this script does it)
if exist apk.yml (
  if not exist .github\workflows mkdir .github\workflows
  move /Y apk.yml .github\workflows\apk.yml
)
if not exist .git (
  git init -b main
  git remote add origin https://github.com/ronak-parmar/deep-time.git
)
git add -A
git commit -m "Update Dino Match: fossils, dig site, tutorial, Android build"
git branch -M main
git pull origin main --allow-unrelated-histories --no-edit
git push -u origin main
pause
