import { h } from '../ui/dom.js';
import { Button, RewardButton, watchAd } from '../ui/components.js';
import { glyph } from '../ui/glyphs.js';

// Near-miss offer over the board: +N moves for coins or a rewarded ad (mock). Declining shows the Lose screen.
export function mountOffer(root, { offer, coins, ads, onCoins, onAd, onDecline }) {
  const afford = coins >= offer.coinCost;
  const adBtn = RewardButton({ benefit: `Get ${offer.extraMoves} more moves`, id: 'offer-ad' });
  adBtn.addEventListener('click', async () => { if (await watchAd(ads, adBtn)) onAd(); });
  const left = offer.blocksLeft === 1 ? '1 block' : `${offer.blocksLeft} blocks`;
  const card = h('div', { class: 'dt-modal__card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'offer-title' },
    h('h2', { class: 'title', id: 'offer-title' }, 'So close'),
    h('p', { class: 'body' }, `Only ${left} left to dig. Get ${offer.extraMoves} more moves?`),
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
