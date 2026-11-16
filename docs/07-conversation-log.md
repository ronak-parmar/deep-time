# 07. Conversation log (condensed, chronological)

## Earlier sessions
- Kratos described two casual games (brick breaker and gem match) for Android with ads, and a reusable ad-revenue plugin. Standing preference: discuss first, he will say when to build; do not assign tasks to him.
- Plan doc written: scope, theme (Deep Time, prehistoric eras), 10 eras x 100 levels, history videos, play-time model, architecture, design system, both games, ad moments, level scaling, roadmap, release/security/IP checklist, open decisions (see plan-full.md).
- Design system "Deep Time" built and published as an artifact; ui-polish skill (his 20 UI rules) saved.

## This stretch
1. Asked whether to create a new repo; named it deep-time-ad-brain, then created https://github.com/ronak-parmar/deep-time.
2. Asked Claude to work directly on the repo. Session cannot authenticate to GitHub (no valid token, no add-repo tool). Workaround: files placed in `D:\arcade\deep-time`; Kratos runs `push.bat`. First push succeeded.
3. Asked for an artifact showing how the game looks (blocks and other things): a playable preview was built (Dino Break + Dino Match) and published.
4. Asked for wireframes via Claude Design: a Design artifact with Main, BreakPlay, BreakResult, MatchPlay, HistoryVideo, AdChoices was published.
5. Shared the ui-polish skill (20 rules); applied to the work.
6. Feedback: "does not look fun, lifeless, no animation in the gem one". Fix: full animation/juice (tweens, bounce, cascades, trails, squash, shake, combos).
7. Shared a reference image of a popular match-3 game as "the idea". Chose "Upgrade the playable page". Added dig-the-fossil goal, dirt over an ammonite, boosters (pick/burst/brush), themed frames, new gems.
8. "The background changes according to the age we are in": per-era scenery added.
9. "Still the internal gems don't look like the ones I shared; can I use Gemini to generate the same?" Claude declined to copy the reference (IP risk), and instead defined an original art brief: style paragraph, per-asset prompts, file names, sizes, rules. Now stored in art/README.md.
10. Asked what design assets are needed so he can generate them: full asset table given (gems 256x256, blocks, paddle, ball, frames, plank header, badges, plaque, dirt, fossil strip, tools, 10 era backgrounds 1080x1920, 10 fossils 512x512, later props/effects/icons/video cards/store assets/mascot).
11. Asked how to continue the session in another Claude login: answer: the repo/docs are the memory; a new session reads CLAUDE.md. (Hence this documentation.)
12. Asked to write every detail into the folder, including the Gemini requirement, so the next session reads the git repo and knows everything. This documentation set is the result.

## Corrections and preferences to remember
- Do not assign tasks to Kratos.
- Discuss before building; he says when to build.
- He wants the games to look fun and alive, not flat; animation and juice matter.
- He wants art like the reference he showed, but original (via Gemini), to avoid IP issues.
