// First-launch welcome (also Settings > Meet Yuvi again, and How to play): Yuvi waddles in over a soft dim and explains the game in
// six short bubbles (data/yuvi.js WELCOME). Tap anywhere (or the bubble) to finish the typing, tap again for the next one. Skip ends it.
// Two steps show something: a mini gem row he points at, and a ring on the museum button of the world map.
import { h } from '../ui/dom.js';
import { KButton } from '../ui/kit.js';
import { artBox } from './intro.js';
import { WELCOME } from '../data/yuvi.js';
import { scene, leave, getYuvi, bandTop, toScreen, ARM, PLACES } from '../ui/helper.js';

export function mountWelcome({ steps = WELCOME, onDone } = {}) {
  let i = -1, dead = false, stops = [];
  const count = h('p', { class: 'welcome__step', 'aria-hidden': 'true' });
  const show = h('div', { class: 'welcome__show', hidden: true, 'aria-hidden': 'true' });
  const ring = h('div', { class: 'welcome__ring', hidden: true });
  const skip = KButton({ variant: 'stone', id: 'welcome-skip', class: 'welcome__skip', onClick: (e) => { e.stopPropagation(); finish(true); } }, 'Skip');
  const el = h('div', { class: 'welcome', id: 'welcome', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Welcome from Yuvi', onClick: () => next() }, count, show, ring, skip);
  document.body.append(el);

  function stopArt() { stops.forEach((f) => f()); stops = []; }
  function step() {
    const s = steps[i];
    count.textContent = `${i + 1} of ${steps.length}  ·  tap to continue`;
    count.style.top = '72px';
    bandTop(s.say, 'welcome');   // places Yuvi and his bubble for this line
    // the picture for this step: gems in a row to Yuvi's right (he points at it), or a ring on the museum button
    stopArt(); show.hidden = s.show !== 'gems'; ring.hidden = s.show !== 'museum';
    if (s.show === 'gems') {
      const boxes = [0, 0, 0, 3].map((k) => artBox({ art: { kind: 'gem', key: k } }, 36));
      boxes.forEach((b) => stops.push(b.stop));
      show.replaceChildren(...boxes.map((b) => b.el));
      const p = toScreen(ARM.x, PLACES.welcome.feet + ARM.y);   // level with his pointing hand, just past it
      Object.assign(show.style, { top: p.y + 'px', left: p.x + 'px', transform: `translateY(-50%) scale(${p.s})`, transformOrigin: '0 50%' });
    }
    if (s.show === 'museum') {
      const q = document.querySelector('#museum')?.getBoundingClientRect();
      if (q) Object.assign(ring.style, { left: q.left - 4 + 'px', top: q.top - 4 + 'px', width: q.width + 8 + 'px', height: q.height + 8 + 'px' }); else ring.hidden = true;
    }
    scene('welcome', async ({ y }) => {
      y.play(s.action, { dir: 'right' });
      await y.say(s.say, { talk: s.action === 'talk', after: 'idle', tap: () => next() });
    }, { force: true });
  }
  function next() {
    if (dead) return;
    if (getYuvi()?.skip()) return;   // first tap: the whole line at once
    i += 1;
    if (i >= steps.length) return finish(false);
    step();
  }
  function finish(skipped) {
    if (dead) return; dead = true; stopArt(); el.remove(); leave(); onDone?.({ skipped });
  }
  next();
  return { el, next, finish, get step() { return i; }, destroy() { if (!dead) { dead = true; stopArt(); el.remove(); leave(); } } };
}
