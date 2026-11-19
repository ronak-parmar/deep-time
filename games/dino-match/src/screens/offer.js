import { h } from '../ui/dom.js';
import { Ribbon } from '../ui/kit.js';
import { Button, RewardButton, watchAd } from '../ui/components.js';
import { glyph } from '../ui/glyphs.js';
import { leftLabel } from '../core/targets.js';

// Near-miss offer over the board: +N moves for coins or a rewarded ad (mock). Declining shows the Lose screen.
export function mountOffer(root, { offer, progress, coins, ads, onCoins, onAd, onDecline }) {
  const afford = coins >= offer.coinCost;
  const adBtn = RewardButton({ benefit: `Get ${offer.extraMoves} more moves`, id: 'offer-ad' });
  adBtn.addEventListener('click', async () => { if (await watchAd(ads, adBtn)) onAd(); });
  const lines = (progress || []).filter((t) => !t.done).map(leftLabel);
  const card = h('div', { class: 'dt-modal__card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'offer-title' },
    Ribbon('So close', 'offer-title'),
    h('p', { class: 'body' }, `Get ${offer.extraMoves} more moves?`),
    h('ul', { class: 'remaining', id: 'offer-left' }, ...lines.map((l) => h('li', { class: 'body-small' }, l))),
    h('div', { class: 'dt-modal__actions' },
      Button({ id: 'offer-coins', disabled: !afford, onClick: onCoins }, glyph('coin', 20), ` +${offer.extraMoves} moves for ${offer.coinCost} coins`),
      afford ? null : h('p', { class: 'body-small dim' }, `You have ${coins} coins.`),
      h('div', { class: 'lives__gap' }),
      adBtn,
      Button({ variant: 'secondary', id: 'offer-no', onClick: onDecline }, 'No thanks')));
  const el = h('div', { class: 'scrim' }, card);
  root.append(el);
  el.querySelector(afford ? '#offer-coins' : '#offer-ad')?.focus({ preventScroll: true });
  return { el, destroy() { el.remove(); } };
}
