import { h } from '../ui/dom.js';
import { glyph } from '../ui/glyphs.js';
import { Toast } from '../ui/components.js';
import { eraOf } from '../core/eras.js';
import { CONFIG } from '../core/config.js';

// Play: HUD (level, moves, dug) over the canvas, booster placeholders along the bottom.
// Boosters are inert in v1 (CONFIG.boosters.enabled is false): drawn disabled so they can be wired later.
export function mountPlay(root, { level, state, onHome, tip }) {
  const stat = (cls, label, value) => {
    const v = h('span', { class: 'heading dt-num' }, String(value));
    return { v, el: h('div', { class: `stat ${cls}`, role: 'status', 'aria-label': label }, h('span', { class: 'caption' }, label), v) };
  };
  const lvl = stat('stat--level', 'Level', level.level);
  const moves = stat('stat--moves', 'Moves', state.moves);
  const dug = stat('stat--dug', 'Dug', `${state.dug}/${state.dirtTotal}`);
  const home = h('button', { type: 'button', class: 'icon-btn play-back', 'aria-label': 'Back to home', onClick: onHome }, glyph('back', 22));
  const boosters = h('div', { class: 'play__boosters', 'aria-label': 'Boosters, coming soon' },
    ...CONFIG.boosters.kinds.map((k) => h('button', { type: 'button', class: 'booster', disabled: !CONFIG.boosters.enabled, 'aria-label': `${k}, coming soon` }, glyph(k, 18), k[0].toUpperCase() + k.slice(1))));
  const el = h('main', { class: 'screen play', 'data-era': eraOf(level.level).id },
    h('header', { class: 'play__hud' }, home, lvl.el, dug.el, moves.el),
    tip ? h('div', { class: 'play__tip' }, Toast(tip)) : null,
    boosters);
  root.append(el);
  return {
    el,
    update({ moves: m, dug: d, total }) {
      if (m != null) moves.v.textContent = String(m);
      if (d != null) dug.v.textContent = `${d}/${total}`;
    },
    destroy() { el.remove(); }
  };
}
