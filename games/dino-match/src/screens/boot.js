import { h } from '../ui/dom.js';
import { Progress } from '../ui/components.js';

// Boot / loading: shown while fonts and sprites load. `setProgress(0..1)` fills the bar.
export function mountBoot(root) {
  const bar = h('div');
  const el = h('main', { class: 'screen boot', 'aria-busy': 'true' },
    h('h1', { class: 'display' }, 'Dino Match'),
    bar,
    h('p', { class: 'body-small boot__sub' }, 'Loading'));
  bar.replaceWith(Progress(0));
  root.append(el);
  return {
    el,
    setProgress(p) { const b = el.querySelector('.dt-progress__bar'); b.style.width = Math.round(p * 100) + '%'; },
    destroy() { el.remove(); }
  };
}
