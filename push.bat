@echo off
cd /d "%~dp0"
rem Put the GitHub Actions workflow in place (a tool cannot write there, so this script does it)
if exist apk.yml (
  if not exist .github\workflows mkdir .github\workflows
  move /Y apk.yml .github\workflows\apk.yml
)
if exist keystore.yml (
  if not exist .github\workflows mkdir .github\workflows
  move /Y keystore.yml .github\workflows\keystore.yml
)
if not exist .git (
  git init -b main
  git remote add origin https://github.com/ronak-parmar/deep-time.git
)
git add -A
git commit -m "Dino Match: Google Play Games sign-in and cloud save, signed builds"
git branch -M main
git pull origin main --allow-unrelated-histories --no-edit
git push -u origin main
pause
