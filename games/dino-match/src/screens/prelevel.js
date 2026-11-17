import { h } from '../ui/dom.js';
import { Ribbon } from '../ui/kit.js';
import { Button } from '../ui/components.js';
import { eraOf } from '../core/eras.js';
import { targetProgress, targetLabel, TARGET_TYPES } from '../core/targets.js';
import { targetIcon, gemIcon } from '../ui/targets.js';
import { KINDS, SPECIALS } from '../core/specials.js';
import { CONFIG } from '../core/config.js';
import { OBSTACLES } from '../core/obstacles.js';
import { BoosterMedal } from '../ui/boosters.js';
import { BOOSTERS } from '../data/boosters.js';

// Pre-level screen: the level, its targets, the move budget and one line of advice. One primary action: Play.
// pre = { ids: pre-level booster ids taught by now, counts: { id: n }, onShop() } (optional). onPlay(chosenIds) gets the ones picked.
export function mountPrelevel(root, { level, state, onPlay, onBack, pre }) {
  const chosen = new Set(), counts = { ...(pre?.counts || {}) }, toggles = new Map();
  const drawToggle = (id) => { const b = BOOSTERS[id], n = counts[id] || 0, on = chosen.has(id), t = toggles.get(id); t.classList.toggle('prebst--on', on); t.classList.toggle('prebst--empty', n <= 0 && !on); t.replaceChildren(BoosterMedal(id, { size: 44, count: n }), h('span', { class: 'prebst__t' }, h('span', { class: 'heading' }, b.name), h('span', { class: 'caption' }, on ? 'Picked. Tap to undo' : n > 0 ? b.hit : 'None left: tap for the shop'))); t.setAttribute('aria-pressed', String(on)); };
  const pick = (id) => { if ((counts[id] || 0) <= 0 && !chosen.has(id)) { pre.onShop?.(id); return; } if (chosen.has(id)) chosen.delete(id); else chosen.add(id); drawToggle(id); };
  const preRow = pre && pre.ids.length ? h('div', { class: 'prebst', 'aria-label': 'Boosters for this level' }, ...pre.ids.map((id) => { const t = h('button', { type: 'button', class: 'prebst__btn', 'data-booster': id, onClick: () => pick(id) }); toggles.set(id, t); drawToggle(id); return t; })) : null;
  const era = eraOf(level.level), prog = targetProgress(state);
  const colours = [...new Set(state.blocks.map((b) => b.c))].sort((a, b) => a - b);   // plaque colours (none on collect-only levels: the targets show the gems)
  const tip = level.tip || TARGET_TYPES[prog[0].type].tip;
  const newSpecial = KINDS.find((k) => CONFIG.specials.unlock[k] === level.level);
  const newObstacle = Object.keys(CONFIG.obstacles.unlock).map((k) => (k === 'artefact' ? null : k)).find((k) => k && CONFIG.obstacles.unlock[k] === level.level) || null;   // first level of an obstacle
  const card = h('div', { class: 'dt-modal__card prelevel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pre-title' },
    Ribbon(`Level ${level.level}`, 'pre-title'),
    h('p', { class: 'caption dim' }, era.name),
    h('p', { class: 'caption prelevel__cap' }, 'Targets'),
    h('ul', { class: 'prelevel__targets' }, ...prog.map((t) => h('li', { class: 'prelevel__target' }, targetIcon(t, 28), h('span', { class: 'body' }, targetLabel(t))))),
    colours.length ? h('div', { class: 'prelevel__colours', 'aria-label': 'Colours to match' }, h('span', { class: 'caption dim' }, 'Match'), ...colours.map((c) => gemIcon(c, 26))) : null,
    h('p', { class: 'body-small prelevel__moves dt-num', id: 'pre-moves' }, `${state.moves} moves`),
    newSpecial ? h('p', { class: 'body-small prelevel__new' }, `New: ${SPECIALS[newSpecial].name}`) : null,
    newObstacle ? h('p', { class: 'body-small prelevel__new' }, `New: ${OBSTACLES[newObstacle].name}`) : null,
    h('p', { class: 'body-small dim prelevel__tip', id: 'pre-tip' }, tip),
    preRow,
    h('div', { class: 'dt-modal__actions' },
      Button({ id: 'pre-play', onClick: () => onPlay([...chosen]) }, 'Play'),
      Button({ variant: 'secondary', id: 'pre-back', onClick: onBack }, 'Back')));
  const el = h('div', { class: 'scrim scrim--pre' }, card);
  root.append(el);
  el.querySelector('#pre-play')?.focus({ preventScroll: true });
  return { el, select(id) { if ((counts[id] || 0) > 0 && !chosen.has(id)) { chosen.add(id); drawToggle(id); } }, setCounts(c) { Object.assign(counts, c); for (const id of toggles.keys()) drawToggle(id); }, destroy() { el.remove(); } };
}
