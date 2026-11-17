// Booster UI (docs/16): the painted medallion (art slot if the owner supplied one, code-drawn otherwise), the in-level bar, and the owned count.
import { h } from './dom.js';
import { glyph } from './glyphs.js';
import { BOOSTERS } from '../data/boosters.js';
import { slotUrl, slotReady } from '../render/art.js';

const LABEL = { moves5: '+5', start3: '+3' };

// A round medallion. size in px. count: number shown in a badge (undefined = no badge). empty counts as a dimmed one with a "+" (shop).
export function BoosterMedal(id, { size = 52, count, tone } = {}) {
  const b = BOOSTERS[id], art = b.slot && slotReady(b.slot) ? slotUrl(b.slot) : null;
  const face = art ? h('img', { class: 'bmed__art', src: art, alt: '', draggable: 'false' })
    : h('span', { class: 'bmed__face' }, LABEL[id] ? h('span', { class: 'bmed__lab' }, LABEL[id]) : glyph(b.glyph, Math.round(size * 0.5)));
  const el = h('span', { class: `bmed bmed--${tone || b.tone}${art ? ' bmed--painted' : ''}`, style: { '--s': size + 'px' }, 'aria-hidden': 'true' }, face);
  if (count != null) el.append(h('span', { class: 'bmed__n dt-num' }, count > 0 ? String(count) : '+'));
  return el;
}

// The in-level bar. kinds: booster ids to show. counts: { id: n }. onTap(id).
export function BoosterBar({ kinds, counts, onTap }) {
  const btns = new Map();
  const el = h('div', { class: 'play__boosters play__boosters--live', role: 'toolbar', 'aria-label': 'Boosters' });
  const set = (id) => {
    const n = counts[id] || 0, b = BOOSTERS[id], btn = btns.get(id), medal = BoosterMedal(id, { size: 50, count: n });
    btn.replaceChildren(medal, h('span', { class: 'play__bname' }, b.name));
    btn.classList.toggle('booster--empty', n <= 0);
    btn.setAttribute('aria-label', n > 0 ? `${b.name}, ${n} left` : `${b.name}, none left: open the shop`);
  };
  for (const id of kinds) {
    const btn = h('button', { type: 'button', class: 'booster booster--med', 'data-booster': id, onClick: () => onTap(id) });
    btns.set(id, btn); el.append(btn); set(id);
  }
  return {
    el, btn: (id) => btns.get(id),
    update(c) { Object.assign(counts, c); for (const id of kinds) set(id); },
    setActive(id) { for (const [k, b] of btns) b.classList.toggle('booster--on', k === id); },
    setForce(id) { for (const [k, b] of btns) b.classList.toggle('booster--force', k === id); }
  };
}
