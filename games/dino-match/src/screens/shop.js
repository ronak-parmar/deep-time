// Shop (docs/16): every booster with what it does, how many you own and a Buy button in coins. Painted with the UI kit. Shown as its own
// screen from the map dock, or as an overlay when an empty booster is tapped (onClose returns to where the player was).
import { h } from '../ui/dom.js';
import { Panel, KButton, Cur } from '../ui/kit.js';
import { glyph } from '../ui/glyphs.js';
import { BOOSTERS, BOOSTER_IDS } from '../data/boosters.js';
import { BoosterMedal } from '../ui/boosters.js';
import { owned } from '../core/boosters.js';

// profile: current profile. only: optional list of booster ids to show (default all). onBuy(id) must persist and return the new profile (or null).
export function mountShop(root, { profile, onBuy, onClose, level = 1, focus = null, overlay = false }) {
  let p = profile;
  const wallet = h('div', { class: 'shop__wallet' });
  const list = h('ul', { class: 'shop__list', id: 'shop-list' });
  const rows = new Map();
  const ids = BOOSTER_IDS;   // everything is listed; the ones not taught yet are marked
  const draw = () => {
    wallet.replaceChildren(Cur(p.coins, 'Coins'));
    for (const id of ids) {
      const b = BOOSTERS[id], n = owned(p, id), afford = p.coins >= b.price, row = rows.get(id);
      const buy = KButton({ variant: 'gold', class: 'shop__buy', id: 'buy-' + id, disabled: !afford, onClick: async () => { const q = await onBuy(id); if (q) { p = q; draw(); } } }, glyph('coin', 16), String(b.price));
      row.replaceChildren(BoosterMedal(id, { size: 42, count: n }),
        h('div', { class: 'shop__txt' }, h('span', { class: 'heading' }, b.name), h('span', { class: 'caption' }, (b.first > level ? `From level ${b.first}. ` : '') + b.text.split('. ')[0].replace(/\.$/, ''))), buy);
    }
  };
  for (const id of ids) { const row = h('li', { class: 'shop__row', 'data-booster': id }); rows.set(id, row); list.append(row); }
  draw();
  const close = () => { el.remove(); onClose?.(); };
  const panel = Panel({ title: 'Shop', class: 'shop__panel', label: 'Shop', onClose: close }, wallet, list);
  const el = h('div', { class: 'scrim kit-scrim shop' + (overlay ? ' shop--overlay' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Shop', onClick: (e) => { if (e.target === el) close(); } }, panel);
  root.append(el);
  if (focus) rows.get(focus)?.scrollIntoView({ block: 'center' });
  return { el, update(q) { p = q; draw(); }, destroy() { el.remove(); } };
}
