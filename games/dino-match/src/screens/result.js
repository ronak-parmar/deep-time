import { h } from '../ui/dom.js';
import { Ribbon } from '../ui/kit.js';
import { Button, Stars, RewardButton, watchAd } from '../ui/components.js';
import { eraOf, fossilIdForLevel } from '../core/eras.js';
import { fossilById } from '../core/fossils.js';
import { CONFIG } from '../core/config.js';
import { roll, RECIPES } from '../render/motion.js';
import { cue } from '../render/sound.js';
import { targetProgress, targetLabel } from '../core/targets.js';
import { objectiveIcon } from '../ui/objectives.js';
import { glyph } from '../ui/glyphs.js';

// Result: one template, win or lose, one primary action each.
// win:  title, stars, score, coins + pickaxe lines, rewarded double-coins (mock), Next level, Dig site, Home
// lose: title, dug count, life lost, Try again (or Wait for lives when none are left), Dig site, Home
// one goal: the board's own art in a small well, a tick when done, and how far it got
const goalRow = (t) => h('li', { class: 'result__target' + (t.done ? ' result__target--done' : ''), 'data-target': t.type, 'aria-label': `${targetLabel(t)}: ${Math.min(t.got, t.n)} of ${t.n}` },
  h('span', { class: 'result__well' }, objectiveIcon(t, 26), t.done ? h('span', { class: 'result__tick' }, glyph('check', 11)) : null),
  h('span', { class: 'body-small dt-num' }, `${Math.min(t.got, t.n)}/${t.n}`));

export function mountResult(root, p) {
  const { won, level, state, stars, rewards, lives, ads, onNext, onRetry, onHome, onDig, onDouble, onWait } = p;
  const era = eraOf(level.level);
  const coinsLine = h('p', { class: 'body-small result__coins dt-num', id: 'coins-line' }, `+${rewards.coins} coins`);
  let reward = null;
  if (won) {
    reward = RewardButton({ benefit: `Double coins (+${rewards.coins})`, id: 'double' });
    reward.addEventListener('click', async () => {
      if (await watchAd(ads, reward)) {
        reward.replaceWith(h('p', { class: 'body-small result__coins dt-num', id: 'doubled' }, 'Coins doubled'));
        coinsLine.textContent = `+${rewards.coins * CONFIG.economy.doubleCoinsMultiplier} coins`;
        onDouble();
      }
    });
  }
  const outOfLives = !won && lives <= 0;
  const card = h('section', { class: 'dt-result', 'aria-label': won ? 'Level won' : 'Level lost' },
    h('div', { class: 'dt-result__head' },
      Ribbon(won ? (state.hasDig ? 'Fossil found!' : 'Level complete!') : 'Out of moves', 'result-title'),
      won ? Stars(stars) : null,
      h('p', { class: 'title dt-num dt-result__score' }, state.score.toLocaleString('en-US')),
      won
        ? h('div', { class: 'result__rows' },
            h('p', { class: 'body-small dim' }, state.hasDig ? `${(fossilById(fossilIdForLevel(level.level)) || { name: era.fossil }).name} part uncovered, level ${level.level}` : `Level ${level.level} complete`),
            h('ul', { class: 'result__goals result__goals--won', 'aria-label': 'Goals done' }, ...targetProgress(state).map((t) => goalRow({ ...t, got: t.n, done: true }))),
            coinsLine,
            rewards.pickaxes > 0
              ? h('p', { class: 'body-small result__pick dt-num', id: 'pick-line' }, `+${rewards.pickaxes} pickaxe`)
              : h('p', { class: 'body-small dim', id: 'pick-line' }, 'Replay: no pickaxe this time'))
        : h('div', { class: 'result__rows' },
            h('ul', { class: 'result__goals', 'aria-label': 'Goals' }, ...targetProgress(state).map(goalRow)),
            h('p', { class: 'body-small result__life dt-num', id: 'life-line' }, `Lost 1 life. ${lives} of ${CONFIG.lives.max} left`))),
    reward ? h('div', { class: 'dt-result__offer' }, reward) : null,
    h('div', { class: 'dt-result__actions' },
      won ? Button({ onClick: onNext, id: 'next' }, 'Next level')
        : outOfLives ? Button({ onClick: onWait, id: 'wait' }, 'Out of lives')
          : Button({ onClick: onRetry, id: 'retry' }, 'Try again'),
      Button({ variant: 'secondary', onClick: onDig, id: 'dig' }, 'Dig site'),
      Button({ variant: 'secondary', onClick: onHome, id: 'home' }, 'Home')));
  const scoreEl = card.querySelector('.dt-result__score');
  const el = h('div', { class: 'scrim', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'result-title' }, card);
  root.append(el);
  el.querySelector('#next, #retry, #wait')?.focus({ preventScroll: true });
  // reward ladder: panel slides up (css), stars pop one by one, then score and coins tick up
  const fmt = (n) => n.toLocaleString('en-US'), ladder = RECIPES.winScreen;
  cue(won ? 'winScreen' : 'loseScreen', { stars });
  if (won) {
    const wait = ladder.stagger * (stars + 1);
    setTimeout(() => { roll(scoreEl, 0, state.score, fmt, ladder.count); roll(coinsLine, 0, rewards.coins, (n) => `+${n} coins`, ladder.count); }, wait);
    scoreEl.textContent = '0'; coinsLine.textContent = '+0 coins';
  }
  return { el, destroy() { el.remove(); } };
}
