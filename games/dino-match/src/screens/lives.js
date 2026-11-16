import { h } from '../ui/dom.js';
import { Button, RewardButton, watchAd, mmss } from '../ui/components.js';
import { glyph } from '../ui/glyphs.js';
import { CONFIG } from '../core/config.js';
import { syncLives, nextLifeIn } from '../core/lives.js';

// Out of lives: countdown to the next life, refill by coins or by a rewarded ad (mock), Dig site.
// Rewarded refill only, never a forced ad. The primary button starts the level once a life is back.
export function mountOutOfLives(root, { profile, level, now, ads, onPlay, onDig, onHome, onRefillCoins, onRefillAd }) {
  let current = profile;
  const timer = h('p', { class: 'title dt-num lives__timer', id: 'countdown', role: 'timer' });
  const coinBtn = Button({ variant: 'secondary', full: true, id: 'refill-coins', onClick: () => onRefillCoins() });
  const play = Button({ full: true, id: 'play', onClick: onPlay }, `Play level ${level}`);
  const adBtn = RewardButton({ benefit: 'Refill all lives', id: 'refill-ad' });
  adBtn.addEventListener('click', async () => { if (await watchAd(ads, adBtn)) onRefillAd(); });
  const note = h('p', { class: 'body-small dim lives__note' });
  const refresh = () => {
    const t = now(), p = syncLives(current, t), left = nextLifeIn(p, t);
    const has = p.lives > 0;
    timer.textContent = has ? 'A life is ready' : mmss(left ?? 0);
    timer.classList.toggle('lives__timer--ready', has);
    note.textContent = has ? 'You can play again.' : 'until your next life. You can still spend pickaxes at the dig site.';
    play.disabled = !has;
    const afford = current.coins >= CONFIG.lives.refillCoins;
    coinBtn.disabled = !afford;
    coinBtn.replaceChildren(glyph('coin', 20), afford ? ` Refill for ${CONFIG.lives.refillCoins} coins` : ` ${CONFIG.lives.refillCoins} coins (need ${CONFIG.lives.refillCoins - current.coins} more)`);
  };
  refresh();
  const iv = setInterval(refresh, 1000);
  const el = h('main', { class: 'screen lives' },
    h('div', { class: 'lives__head' },
      h('div', { class: 'lives__hearts', 'aria-hidden': 'true' }, ...Array.from({ length: CONFIG.lives.max }, () => glyph('heart', 28))),
      h('h1', { class: 'display', id: 'lives-title' }, 'Out of lives'),
      timer, note),
    h('div', { class: 'lives__actions' },
      play,
      h('div', { class: 'lives__gap' }),
      adBtn,
      coinBtn,
      Button({ variant: 'secondary', full: true, id: 'dig', onClick: onDig }, 'Dig site'),
      Button({ variant: 'secondary', full: true, id: 'home', onClick: onHome }, 'Home')));
  root.append(el);
  return { el, update(p) { current = p; refresh(); }, destroy() { clearInterval(iv); el.remove(); } };
}
