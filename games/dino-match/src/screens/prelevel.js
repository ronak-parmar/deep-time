import { h } from '../ui/dom.js';
import { Button } from '../ui/components.js';
import { eraOf } from '../core/eras.js';
import { targetProgress, targetLabel, TARGET_TYPES } from '../core/targets.js';
import { targetIcon, gemIcon } from '../ui/targets.js';
import { KINDS, SPECIALS } from '../core/specials.js';
import { CONFIG } from '../core/config.js';
import { OBSTACLES } from '../core/obstacles.js';

// Pre-level screen: the level, its targets, the move budget and one line of advice. One primary action: Play.
export function mountPrelevel(root, { level, state, onPlay, onBack }) {
  const era = eraOf(level.level), prog = targetProgress(state);
  const colours = [...new Set(state.blocks.map((b) => b.c))].sort((a, b) => a - b);   // plaque colours (none on collect-only levels: the targets show the gems)
  const tip = level.tip || TARGET_TYPES[prog[0].type].tip;
  const newSpecial = KINDS.find((k) => CONFIG.specials.unlock[k] === level.level);
  const newObstacle = Object.keys(CONFIG.obstacles.unlock).map((k) => (k === 'artefact' ? null : k)).find((k) => k && CONFIG.obstacles.unlock[k] === level.level) || null;   // first level of an obstacle
  const card = h('div', { class: 'dt-modal__card prelevel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pre-title' },
    h('p', { class: 'caption dim' }, era.name),
    h('h2', { class: 'title', id: 'pre-title' }, `Level ${level.level}`),
    h('p', { class: 'caption prelevel__cap' }, 'Targets'),
    h('ul', { class: 'prelevel__targets' }, ...prog.map((t) => h('li', { class: 'prelevel__target' }, targetIcon(t, 28), h('span', { class: 'body' }, targetLabel(t))))),
    colours.length ? h('div', { class: 'prelevel__colours', 'aria-label': 'Colours to match' }, h('span', { class: 'caption dim' }, 'Match'), ...colours.map((c) => gemIcon(c, 26))) : null,
    h('p', { class: 'body-small prelevel__moves dt-num', id: 'pre-moves' }, `${state.moves} moves`),
    newSpecial ? h('p', { class: 'body-small prelevel__new' }, `New: ${SPECIALS[newSpecial].name}`) : null,
    newObstacle ? h('p', { class: 'body-small prelevel__new' }, `New: ${OBSTACLES[newObstacle].name}`) : null,
    h('p', { class: 'body-small dim prelevel__tip', id: 'pre-tip' }, tip),
    h('div', { class: 'dt-modal__actions' },
      Button({ id: 'pre-play', onClick: onPlay }, 'Play'),
      Button({ variant: 'secondary', id: 'pre-back', onClick: onBack }, 'Back')));
  const el = h('div', { class: 'scrim scrim--pre' }, card);
  root.append(el);
  el.querySelector('#pre-play')?.focus({ preventScroll: true });
  return { el, destroy() { el.remove(); } };
}
