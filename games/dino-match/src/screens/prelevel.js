import { h } from '../ui/dom.js';
import { Ribbon, KButton } from '../ui/kit.js';
import { eraOf } from '../core/eras.js';
import { targetProgress, targetLabel, TARGET_TYPES } from '../core/targets.js';
import { objectiveIcon, setObjectiveEra } from '../ui/objectives.js';
import { GOAL_VERB } from '../data/objectiveArt.js';
import { KINDS, SPECIALS } from '../core/specials.js';
import { CONFIG } from '../core/config.js';
import { OBSTACLES } from '../core/obstacles.js';
import { tierOf, TIERS } from '../core/difficulty.js';
import { BoosterMedal } from '../ui/boosters.js';
import { BOOSTERS } from '../data/boosters.js';
import { aiUrl } from '../ui/kitart.js';

// Pre-level screen: level ribbon, difficulty ribbon (hard / super hard + the bigger reward), the stars to beat, the goals as big
// painted icons ("Collect 20"), the move budget, one tip, the pre-level booster picks and one primary action: a gold Play.
// pre = { ids: pre-level booster ids taught by now, counts: { id: n }, onShop() } (optional). onPlay(chosenIds) gets the ones picked.
// best = the player's best stars on this level (0 = not won yet).
export function mountPrelevel(root, { level, state, onPlay, onBack, pre, best = 0 }) {
  const chosen = new Set(), counts = { ...(pre?.counts || {}) }, toggles = new Map();
  const drawToggle = (id) => { const b = BOOSTERS[id], n = counts[id] || 0, on = chosen.has(id), t = toggles.get(id); t.classList.toggle('prebst--on', on); t.classList.toggle('prebst--empty', n <= 0 && !on); t.replaceChildren(BoosterMedal(id, { size: 38, count: n }), h('span', { class: 'prebst__t' }, h('span', { class: 'heading' }, b.name), h('span', { class: 'caption' }, on ? 'Picked' : n > 0 ? 'Tap to pick' : 'Get more'))); t.setAttribute('aria-pressed', String(on)); t.setAttribute('aria-label', `${b.name}: ${on ? 'picked, tap to undo' : n > 0 ? b.hit : 'none left, tap for the shop'}`); };
  const pick = (id) => { if ((counts[id] || 0) <= 0 && !chosen.has(id)) { pre.onShop?.(id); return; } if (chosen.has(id)) chosen.delete(id); else chosen.add(id); drawToggle(id); };
  const preRow = pre && pre.ids.length ? h('div', { class: 'prebst', 'aria-label': 'Boosters for this level' }, ...pre.ids.map((id) => { const t = h('button', { type: 'button', class: 'prebst__btn', 'data-booster': id, onClick: () => pick(id) }); toggles.set(id, t); drawToggle(id); return t; })) : null;
  const era = eraOf(level.level), prog = targetProgress(state);
  setObjectiveEra(era.id);
  const tier = level.tier || tierOf(level.level), T = TIERS[tier];
  const colours = [...new Set(state.blocks.map((b) => b.c))].sort((a, b) => a - b);   // plaque colours (none on collect-only levels: the goals show the gems)
  const tip = level.tip || TARGET_TYPES[prog[0].type].tip;
  const newSpecial = KINDS.find((k) => CONFIG.specials.unlock[k] === level.level);
  const newObstacle = Object.keys(CONFIG.obstacles.unlock).map((k) => (k === 'artefact' ? null : k)).find((k) => k && CONFIG.obstacles.unlock[k] === level.level) || null;   // first level of an obstacle
  const news = [newSpecial ? SPECIALS[newSpecial].name : null, newObstacle ? OBSTACLES[newObstacle].name : null].filter(Boolean);

  // one goal: the board's own art in a big dark well, "Collect 20" under it, what it is in small print
  const goal = (t) => {
    const label = targetLabel(t), noun = label.replace(/^\S+\s+(all\s+)?(\d+\s*)?/, '');
    return h('li', { class: 'pgoal', 'data-target': t.type, 'aria-label': label },
      h('span', { class: 'pgoal__well' }, objectiveIcon({ ...t, blocks: state.blocks }, prog.length > 2 ? 40 : 44)),
      h('span', { class: 'pgoal__n dt-num' }, `${GOAL_VERB[t.type] || ''} ${t.n}`),
      h('span', { class: 'pgoal__what' }, noun));
  };
  const star = (on) => (aiUrl('star') ? h('img', { class: 'pstars__s' + (on ? '' : ' pstars__s--off'), src: aiUrl('star'), alt: '', draggable: 'false' }) : h('i', { class: 'pstars__s pstars__s--v' + (on ? '' : ' pstars__s--off') }));
  const stars = h('div', { class: 'pstars', 'aria-label': best > 0 ? `Your best: ${best} of 3 stars` : 'Win to earn up to 3 stars' },
    h('span', { class: 'caption' }, best > 0 ? (best >= 3 ? 'Best: all 3 stars' : 'Your best, beat it') : 'Earn up to 3 stars'), h('span', { class: 'pstars__row' }, star(best >= 1), star(best >= 2), star(best >= 3)));
  const tierRibbon = tier !== 'normal' ? h('div', { class: `ptier ptier--${tier}`, role: 'note' },
    h('i', { class: 'ptier__flame' }), tier === 'super-hard' ? h('i', { class: 'ptier__flame' }) : null,
    h('span', { class: 'ptier__t' }, tier === 'super-hard' ? 'Super hard' : 'Hard level'),
    h('span', { class: 'ptier__r dt-num' }, `x${T.coins} coins`)) : null;

  const card = h('div', { class: `dt-modal__card prelevel prelevel--${tier}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pre-title' },
    Ribbon(`Level ${level.level}`, 'pre-title'),
    h('p', { class: 'caption dim prelevel__era' }, era.name),
    tierRibbon,
    stars,
    h('ul', { class: `pgoals pgoals--${prog.length}`, 'aria-label': 'Goals' }, ...prog.map(goal)),
    colours.length ? h('div', { class: 'prelevel__colours', 'aria-label': 'Colours that dig the blocks' }, h('span', { class: 'caption dim' }, 'Dig with'), ...colours.map((c) => h('span', { class: 'pcol' }, objectiveIcon({ kind: 'gem', key: c }, 22)))) : null,
    h('p', { class: 'prelevel__moves dt-num', id: 'pre-moves' }, h('b', {}, String(state.moves)), ' moves'),
    news.length ? h('p', { class: 'body-small prelevel__new' }, `New: ${news.join(', ')}`) : null,
    h('p', { class: 'body-small dim prelevel__tip', id: 'pre-tip' }, tip),
    preRow,
    h('div', { class: 'prelevel__actions' },
      KButton({ variant: 'stone', id: 'pre-back', class: 'prelevel__back', onClick: onBack }, 'Back'),
      KButton({ variant: 'gold', id: 'pre-play', class: 'prelevel__play', icon: 'play', onClick: () => onPlay([...chosen]) }, 'Play')));
  const el = h('div', { class: 'scrim scrim--pre' }, card);
  root.append(el);
  el.querySelector('#pre-play')?.focus({ preventScroll: true });
  return { el, select(id) { if ((counts[id] || 0) > 0 && !chosen.has(id)) { chosen.add(id); drawToggle(id); } }, setCounts(c) { Object.assign(counts, c); for (const id of toggles.keys()) drawToggle(id); }, destroy() { el.remove(); } };
}
