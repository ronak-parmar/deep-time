import { h } from '../ui/dom.js';
import { glyph } from '../ui/glyphs.js';
import { Toast } from '../ui/components.js';
import { eraOf } from '../core/eras.js';
import { CONFIG } from '../core/config.js';
import { TargetPanel } from '../ui/targets.js';
import { setObjectiveEra } from '../ui/objectives.js';
import { tierOf } from '../core/difficulty.js';
import { BoosterBar } from '../ui/boosters.js';
import { BOOSTERS, unlockedBoosters } from '../data/boosters.js';

// Play: HUD (level, moves, dug) over the canvas, the booster bar along the bottom (docs/16: only boosters already taught show up).
// boosters = { counts: { id: n }, onTap(id), onCancel() }.
export function mountPlay(root, { level, state, onHome, tip, boosters: bp }) {
  const stat = (cls, label, value) => {
    const v = h('span', { class: 'heading dt-num' }, String(value));
    return { v, el: h('div', { class: `stat ${cls}`, role: 'status', 'aria-label': label }, h('span', { class: 'caption' }, label), v) };
  };
  setObjectiveEra(eraOf(level.level).id);
  const lvl = stat('stat--level', 'Level', level.level);
  const moves = stat('stat--moves', 'Moves', state.moves);
  moves.el.classList.toggle('stat--low', state.moves <= 5 && state.moves > 3); moves.el.classList.toggle('stat--crit', state.moves <= 3);
  const targets = TargetPanel(state);
  const tgtEl = h('div', { class: 'stat stat--target' }, h('span', { class: 'caption' }, state.targets.length && state.targets.every((t) => t.type === 'collect') ? 'Break' : 'Target'), targets.el);   // collect-only levels read "Break" over the gem icons and counts
  const home = h('button', { type: 'button', class: 'icon-btn play-back', 'aria-label': 'Back to home', onClick: onHome }, glyph('back', 22, { painted: false }));
  const kinds = bp ? unlockedBoosters(level.level, 'level') : [];
  const bar = kinds.length ? BoosterBar({ kinds, counts: { ...bp.counts }, onTap: bp.onTap }) : null;
  const promptText = h('span', {}), promptBtn = h('button', { type: 'button', id: 'booster-cancel', onClick: () => bp?.onCancel?.() }, 'Cancel');
  const prompt = h('div', { class: 'play__prompt', id: 'booster-prompt', role: 'status', hidden: true }, promptText, promptBtn);
  const tier = level.tier || tierOf(level.level);
  document.body.dataset.tier = tier;   // in-level tint for hard levels (frame, HUD plates, background), see game.css
  const el = h('main', { class: `screen play play--${tier}`, 'data-era': eraOf(level.level).id },
    h('header', { class: 'play__hud' }, home, lvl.el, tgtEl, moves.el),
    tip ? h('div', { class: 'play__tip' }, Toast(tip)) : null,
    bar ? bar.el : null, prompt);
  root.append(el);
  return {
    el,
    update({ moves: m, dug: d, total, state: st, got }) {
      if (m != null) { moves.v.textContent = String(m); moves.el.classList.toggle('stat--low', m <= 5 && m > 3); moves.el.classList.toggle('stat--crit', m <= 3); }
      if (got) targets.update({ got });
      else if (st || d != null) targets.update({ state: st, dug: d, total });
    },
    boosters: bar,
    // the targeting prompt: text + a clear Cancel; null hides it
    prompt(text, cancelLabel = 'Cancel') { prompt.hidden = !text; if (text) { promptText.textContent = text; promptBtn.textContent = cancelLabel; } },
    destroy() { delete document.body.dataset.tier; el.remove(); }
  };
}
