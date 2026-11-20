// First-time tutorial overlay (levels 1-6, rules in core/tutorial.js). Dims the screen with a spotlight on the relevant part, an
// animated hand pointer shows a real swap, tap to continue, Skip is always there. All timing comes from the docs/09 tokens (css vars).
import { handArt } from '../ui/glyphs.js';
import { h } from '../ui/dom.js';
import { Button } from '../ui/components.js';
import { CONFIG } from '../core/config.js';
import { TUTORIAL, tutorialMove, wantColours } from '../core/tutorial.js';
import { reducedMotion } from '../ui/motion.js';

const LW = 360, LH = 640;   // the renderer's logical canvas size

const HAND = `<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><path d="M20 6a4 4 0 0 1 8 0v16l3-1a4 4 0 0 1 5 2l1 2a4 4 0 0 1 5 2v8c0 7-5 12-12 12h-4c-5 0-8-3-11-8l-5-8a4 4 0 0 1 6-4l3 3z" fill="#FFF1D0" stroke="#3A2610" stroke-width="2.4" stroke-linejoin="round"/></svg>`;

// opts: { level, state, renderer, onDone(), onSkip() }. Returns { el, moved(), destroy(), step }.
export function mountTutorial({ level, state, renderer, onDone, onSkip }) {
  const spec = TUTORIAL[level.level], steps = spec.steps, colourName = CONFIG.gemKinds[wantColours(state)[0]] ?? 'target';
  const move = steps.some((s) => s.hand) ? tutorialMove(state, spec.want) : null;
  let i = 0, dead = false;
  const spot = h('div', { class: 'tut__spot' });
  const trail = h('div', { class: 'tut__trail' });
  const hand = h('div', { class: 'tut__hand', 'aria-hidden': 'true' }); const handImg = handArt(); if (handImg) hand.append(handImg); else hand.innerHTML = HAND;
  const text = h('p', { class: 'body tut__text', id: 'tut-text' });
  const hint = h('p', { class: 'caption dim tut__hint' }, 'Tap to continue');
  const skip = Button({ variant: 'secondary', id: 'tut-skip', onClick: (e) => { e.stopPropagation(); skipNow(); } }, 'Skip tutorial');
  const card = h('div', { class: 'tut__card', role: 'dialog', 'aria-live': 'polite', 'aria-label': 'Tutorial' }, text, hint, skip);
  const el = h('div', { class: 'tut', id: 'tutorial', onClick: () => { if (steps[i].tap) next(); } }, spot, trail, hand, card);
  document.body.append(el);

  const scr = (lx, ly) => { const r = renderer.canvas.getBoundingClientRect(); return [r.left + (lx / LW) * r.width, r.top + (ly / LH) * r.height, r.width / LW]; };
  function rectOf(name) {
    const pad = 6;
    if (name === 'board') { const { w, h: hh } = renderer.state, [x, y, k] = scr(renderer.boardX, renderer.boardY); return { x: x - pad, y: y - pad, w: w * renderer.cs * k + 2 * pad, h: hh * renderer.cs * k + 2 * pad }; }
    if (name === 'plaque') { const P = renderer.panel, [x, y, k] = scr(P.x, P.y); return { x: x - pad, y: y - pad, w: P.w * k + 2 * pad, h: P.h * k + 2 * pad }; }
    const q = document.querySelector(name === 'moves' ? '.stat--moves' : '.stat--target');
    const r = q ? q.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    return { x: r.left - pad, y: r.top - pad, w: r.width + 2 * pad, h: r.height + 2 * pad };
  }
  function show() {
    if (dead) return;
    const st = steps[i], r = rectOf(st.spot);
    Object.assign(spot.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    text.textContent = st.text.replace('{colour}', colourName);
    hint.hidden = !st.tap; el.classList.toggle('tut--tap', !!st.tap);
    // the card sits on the side of the spotlight with more room
    const below = r.y + r.h / 2 < innerHeight / 2;
    card.style.top = below ? Math.min(innerHeight - 170, r.y + r.h + 16) + 'px' : 'auto'; card.style.bottom = below ? 'auto' : Math.max(16, innerHeight - r.y + 16) + 'px';
    const showHand = st.hand && move;
    hand.hidden = trail.hidden = !showHand;
    if (showHand) {
      const [ax, ay] = scr(renderer.cx(move[0]), renderer.cy(move[0])), [bx, by] = scr(renderer.cx(move[1]), renderer.cy(move[1]));
      hand.style.setProperty('--x0', ax - 10 + 'px'); hand.style.setProperty('--y0', ay - 4 + 'px'); hand.style.setProperty('--x1', bx - 10 + 'px'); hand.style.setProperty('--y1', by - 4 + 'px');
      const len = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax);
      Object.assign(trail.style, { left: ax + 'px', top: ay + 'px', width: len + 'px', transform: `rotate(${ang}rad)` });
      el.classList.toggle('tut--still', reducedMotion());
    }
  }
  function finish() { if (dead) return; destroy(); onDone?.(); }
  function skipNow() { if (dead) return; destroy(); onSkip?.(); }
  function next() { i += 1; if (i >= steps.length) finish(); else show(); }
  function destroy() { dead = true; removeEventListener('resize', show); el.remove(); }
  addEventListener('resize', show);
  show();
  return { el, destroy, get step() { return i; }, move,
    // call after every valid move: ends a step that waits for it
    moved() { if (!dead && steps[i].until === 'move') next(); } };
}
