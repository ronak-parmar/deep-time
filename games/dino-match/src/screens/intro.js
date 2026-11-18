// Element intro cards (docs/14). Shown once per element, from the registry in data/intros.js. Level-start cards dim the board,
// light the element and wait for a tap. Soft cards (hint, shuffle, combos) are small, never block play and go away on the next move.
// Timing comes from the docs/09 tokens (css vars) like the tutorial.
import { h } from '../ui/dom.js';
import { Panel, KButton, Medal } from '../ui/kit.js';
import { glyph } from '../ui/glyphs.js';
import { paintIntroArt } from '../render/introart.js';
import { reducedMotion } from '../ui/motion.js';
import { D } from '../render/motion.js';
import { BOOSTERS } from '../data/boosters.js';
import { introLine, bandTop, leave as yuviLeave, getYuvi } from '../ui/helper.js';
import { lineFor, poseFor } from '../data/yuvi.js';

const LW = 360, LH = 640, ART = 72;

export function artBox(entry, size = ART) {
  const a = entry.art || {};
  if (a.kind === 'booster' && size >= 100) size = 112;
  if (a.kind === 'icon') { const b = h('div', { class: 'intro__icon' }); b.append(glyph(a.key, size * 0.6)); return { el: b, stop() {} }; }
  const cv = h('canvas', { class: 'intro__art', width: size * 2, height: size * 2, 'aria-hidden': 'true' }), c = cv.getContext('2d');
  cv.style.width = cv.style.height = size + 'px'; let raf = 0, dead = false, late = false; const t0 = performance.now();
  const frame = () => { if (dead) return; c.setTransform(2, 0, 0, 2, 0, 0); paintIntroArt(c, a, size, (performance.now() - t0) / 1000); if (!reducedMotion()) raf = requestAnimationFrame(frame); else if (!late) { late = true; setTimeout(frame, D.dramatic); } };   // reduced motion: one late repaint once pictures are in
  frame();
  return { el: cv, stop() { dead = true; cancelAnimationFrame(raf); } };
}

// Where the lit part is, in screen px. Returns null for "no spotlight".
function spotRect(spot, renderer, state) {
  const r = renderer.canvas.getBoundingClientRect(), k = r.width / LW, pad = 6, P = (lx, ly) => [r.left + lx * k, r.top + (ly / LH) * r.height];
  const board = () => { const [x, y] = P(renderer.boardX, renderer.boardY); return { x: x - pad, y: y - pad, w: state.w * renderer.cs * k + 2 * pad, h: state.h * renderer.cs * k + 2 * pad }; };
  if (spot && spot.obstacle) {
    const idx = state.obst.map((o, i) => (o && o.k === spot.obstacle ? i : -1)).filter((i) => i >= 0);
    if (idx.length) {
      const xs = idx.map((i) => renderer.cx(i)), ys = idx.map((i) => renderer.cy(i)), cs = renderer.cs, [x0, y0] = P(Math.min(...xs) - cs / 2, Math.min(...ys) - cs / 2), [x1, y1] = P(Math.max(...xs) + cs / 2, Math.max(...ys) + cs / 2);
      return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
    }
    return board();
  }
  if (spot && spot.booster) { const q = document.querySelector(`[data-booster="${spot.booster}"]`)?.getBoundingClientRect(); return q ? { x: q.left - pad, y: q.top - pad, w: q.width + 2 * pad, h: q.height + 2 * pad } : board(); }
  if (spot === 'plaque') { const q = renderer.panel, [x, y] = P(q.x, q.y); return { x: x - pad, y: y - pad, w: q.w * k + 2 * pad, h: q.h * k + 2 * pad }; }
  if (spot === 'target') { const q = document.querySelector('.stat--target')?.getBoundingClientRect(); return q ? { x: q.left - pad, y: q.top - pad, w: q.width + 2 * pad, h: q.height + 2 * pad } : board(); }
  return board();
}

// entries: [{ title, text, art, spot }]. soft = small card, no dimming, no tap needed. onDone(ids) when the last card is dismissed.
// yuvi = { greet, onGreet } when Yuvi tips are on: Yuvi stands bottom-left and says the card text in his bubble (the card keeps its
// title, picture and hint, and sits above him). greet: the player has not met him yet, so the first card starts with his hello.
export function mountIntro({ entries, renderer, state, soft = false, onDone, onSkip, yuvi = null }) {
  let i = 0, dead = false, art = null, greet = !!(yuvi && yuvi.greet);
  if (soft) yuvi = null;
  const spot = h('div', { class: 'tut__spot intro__spot' });
  const artHost = h('div', { class: 'intro__arthost' });
  const text = h('p', { class: 'body intro__text' });
  const hint = h('p', { class: 'caption dim tut__hint' });
  const skip = onSkip ? KButton({ variant: 'stone', id: 'intro-skip', class: 'intro__skip', onClick: (e) => { e.stopPropagation(); destroy(); onSkip(); } }, 'Turn off tips') : null;
  const medal = Medal({ content: artHost, size: 92 }), bhost = h('div', { class: 'intro__bart', hidden: true }), how = h('p', { class: 'body intro__how', hidden: true });
  const card = Panel({ title: ' ', class: 'intro__card', role: 'dialog', label: 'New on the board' }, medal, bhost, text, how, hint, skip);
  card.setAttribute('aria-live', 'polite');
  const title = card.querySelector('.kit-ribbon__t');
  const el = h('div', { class: 'tut intro' + (soft ? ' intro--soft' : ' tut--tap'), id: 'intro', onClick: () => { if (!soft) next(); } }, soft ? null : spot, card);
  document.body.append(el);
  function show() {
    if (dead) return;
    const e = entries[i], bst = e.booster ? BOOSTERS[e.booster] : null; art?.stop();
    if (bst) { art = artBox(e, 112); bhost.replaceChildren(art.el); } else { art = artBox(e); artHost.replaceChildren(art.el); }
    medal.hidden = !!bst; bhost.hidden = !bst; how.hidden = !bst || soft;
    if (bst) how.textContent = bst.kind === 'pre' ? 'Pick it on the start screen, before you play.' : bst.target === 'none' ? 'Tap the booster to use it.' : 'Tap the booster, then tap where to use it.';
    title.textContent = e.title; text.textContent = e.text;
    let band = innerHeight;
    el.classList.toggle('intro--yuvi', !!yuvi);
    if (yuvi) { band = bandTop(lineFor(e)); introLine(lineFor(e), { pose: poseFor(e), greet, onTap: () => next() }); }
    hint.textContent = soft ? '' : i < entries.length - 1 ? 'Tap for the next one' : bst && bst.kind === 'level' ? 'Tap to try it now' : 'Tap to continue'; hint.hidden = soft;
    if (soft) { card.style.top = 'auto'; card.style.bottom = '18px'; return; }
    card.style.top = card.style.bottom = '';
    const r = spotRect(e.spot, renderer, state), big = r.h > 300;   // the whole board: no outline, just dim it and centre the card
    el.classList.toggle('intro--dim', big); spot.hidden = big;
    el.classList.toggle('intro--center', big);
    el.style.paddingBottom = big && yuvi ? Math.max(0, innerHeight - band) + 'px' : '';   // centred in the space above Yuvi
    if (big) return;
    Object.assign(spot.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    const below = r.y + r.h / 2 < innerHeight / 2;
    card.style.top = below ? Math.min(innerHeight - 230, r.y + r.h + 16) + 'px' : 'auto'; card.style.bottom = below ? 'auto' : Math.max(16, innerHeight - r.y + 16) + 'px';
    requestAnimationFrame(() => {
      const q = card.getBoundingClientRect();
      if (q.bottom > band - 8) { card.style.top = Math.max(8, band - 8 - q.height) + 'px'; card.style.bottom = 'auto'; }   // never over Yuvi and his bubble
      else if (q.top < 8) { card.style.top = '8px'; card.style.bottom = 'auto'; }   // a tall card never runs off the top
    });
  }
  function next() {
    if (dead) return;
    if (yuvi && getYuvi()?.skip()) return;                          // first tap finishes the typing
    if (greet) { greet = false; yuvi.onGreet?.(); show(); return; }  // hello done: now the card's own line
    i += 1; if (i >= entries.length) { destroy(); onDone?.(); } else show(); }
  function destroy() { if (yuvi && !dead) yuviLeave(); dead = true; art?.stop(); removeEventListener('resize', show); el.remove(); }
  addEventListener('resize', show); show();
  return { el, destroy, moved() { if (soft) destroy(); }, get step() { return i; } };
}
