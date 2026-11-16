import { h } from '../ui/dom.js';
import { Button, Progress } from '../ui/components.js';
import { ERAS } from '../core/eras.js';
import { reducedMotion } from '../ui/motion.js';

// History video placeholder, shown when a fossil is complete. Plain text card, skippable, never an ad.
// The real video (made from code) replaces the frame later; the DS HistoryPlayer layout stays.
export function mountHistory(root, { fossil, onDone, seconds = 8 }) {
  const era = ERAS[fossil.eraIndex];
  const bar = h('div');
  const frame = h('div', { class: 'dt-player__frame history__frame' },
    h('div', { class: 'history__card' },
      h('p', { class: 'caption' }, 'History video, placeholder'),
      h('h2', { class: 'title' }, fossil.name),
      h('p', { class: 'body' }, era.fact)));
  const skip = Button({ variant: 'secondary', id: 'skip', onClick: () => finish() }, 'Skip');
  const el = h('main', { class: 'screen history' },
    h('section', { class: 'dt-player', 'aria-label': 'History video' },
      frame,
      h('div', { class: 'dt-player__meta' }, h('span', { class: 'dt-player__era caption' }, era.name), h('p', { class: 'dt-player__caption body' }, `${fossil.name} complete. Added to your field journal.`)),
      h('div', { class: 'dt-player__foot' }, bar, skip)));
  bar.replaceWith(Progress(0));
  root.append(el);
  let done = false;
  const finish = () => { if (done) return; done = true; clearInterval(iv); onDone(); };
  const start = performance.now();
  const iv = setInterval(() => {
    const t = (performance.now() - start) / (seconds * 1000);
    el.querySelector('.dt-progress__bar').style.width = Math.min(100, t * 100) + '%';
    if (t >= 1) finish();
  }, reducedMotion() ? 500 : 100);
  skip.focus({ preventScroll: true });
  return { el, destroy() { done = true; clearInterval(iv); el.remove(); } };
}
