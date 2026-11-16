@echo off
cd /d "%~dp0"
if not exist .git (
  git init -b main
  git remote add origin https://github.com/ronak-parmar/deep-time.git
)
git add -A
git commit -m "Add Deep Time design system and scaffold"
git branch -M main
git pull origin main --allow-unrelated-histories --no-edit
git push -u origin main
pause
