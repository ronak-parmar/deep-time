// Level targets as DATA (docs/11): a level has 1 to 3 targets; it is won when all are done. Pure functions.
// A target is { type, n, ...params }. Progress is derived from the game state, so new types only add an entry here.
import { CONFIG } from './config.js';
import { OBSTACLES, countKind } from './obstacles.js';

export const MAX_TARGETS = 3;
// what the HUD shows for a target: how many are LEFT, never negative (clearing 3 when 2 are left shows 0)
export const goalLeft = (n, got) => Math.max(0, n - Math.min(n, Math.max(0, got || 0)));
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const plural = (n, one, many = one + 's') => (n === 1 ? one : many);

export const TARGET_TYPES = {
  dig: {
    progress: (s) => s.dug || 0,
    label: (t) => `Dig ${t.n} ${plural(t.n, 'block')}`,
    left: (t, left) => `${left} ${plural(left, 'block')} left to dig`,
    short: (t) => String(t.n),
    tip: 'Dig every block before the moves run out.'
  },
  collect: {     // gems of one colour cleared (matches and blasts both count)
    progress: (s, t) => t.got || 0,
    label: (t) => `Break ${t.n} ${CONFIG.gemKinds[t.c]} ${plural(t.n, 'gem')}`,
    left: (t, left) => `${left} ${CONFIG.gemKinds[t.c]} ${plural(left, 'gem')} left`,
    units: (left) => Math.ceil(left / 4),     // near-miss weight: about 4 gems of one colour are worth one dug block
    short: (t) => String(t.n),
    tip: 'Match or blast gems of the target colour.'
  }
};

// phase B objective types: all progress is derived from state.found / state.broken / state.obst
const fixed = (key, one, many, tip, grp = 'found') => ({
  progress: (s) => (s[grp] ? s[grp][key] || 0 : 0),
  label: (t) => `${one[0]} ${t.n} ${plural(t.n, one[1], many)}`,
  left: (t, left) => `${left} ${plural(left, one[1], many)} left`,
  short: (t) => String(t.n), tip
});
const NOUN = { tar: 'tar', sandstone: 'sandstone', fossil: 'fossil tiles', bone: 'skeleton tiles', vine: 'vine stones', crate: 'crates', lava: 'lava rock' };
Object.assign(TARGET_TYPES, {
  fossils: fixed('fossil', ['Collect', 'fossil'], 'fossils', 'Break the fossil tiles to collect what is buried under them.'),
  skeleton: fixed('bone', ['Uncover', 'bone tile'], 'bone tiles', 'Break every skeleton tile to uncover the skeleton.'),
  drop: fixed('artefact', ['Drop', 'artefact'], 'artefacts', 'Match gems underneath an artefact until it reaches the bottom row.'),
  stones: {     // break N stone tiles (sandstone and vine stone)
    progress: (s) => (s.broken ? (s.broken.sandstone || 0) + (s.broken.vine || 0) : 0),
    label: (t) => `Break ${t.n} stone ${plural(t.n, 'tile')}`, left: (t, left) => `${left} stone ${plural(left, 'tile')} left`,
    short: (t) => String(t.n), tip: 'Match next to stone tiles, or blast them, to break them.'
  },
  clearAll: {   // clear every obstacle of one kind (t.k); n = how many there are at the start
    progress: (s, t) => Math.max(0, t.n - countKind(s.obst || [], t.k)),
    label: (t) => `Clear all ${NOUN[t.k] || t.k}`,
    left: (t, left) => `${left} ${NOUN[t.k] || t.k} left`,
    short: (t) => String(t.n), tip: 'Clear every one of them before the moves run out.'
  }
});

export const defaultTargets = (dirtTotal) => [{ type: 'dig', n: dirtTotal }];
export const targetsOf = (state) => state.targets || defaultTargets(state.dirtTotal);

// [{ type, n, got, left, done, ... }] in level order.
export function targetProgress(state) {
  return targetsOf(state).map((t) => {
    const got = Math.min(t.n, TARGET_TYPES[t.type].progress(state, t));
    return { ...t, got, left: t.n - got, done: got >= t.n };
  });
}
export const targetsDone = (state) => targetProgress(state).every((t) => t.done);
export const remainingUnits = (state) => targetProgress(state).reduce((a, t) => a + (TARGET_TYPES[t.type].units ? TARGET_TYPES[t.type].units(t.left) : t.left), 0);
export const targetLabel = (t) => TARGET_TYPES[t.type].label(t);
export const leftLabel = (t) => TARGET_TYPES[t.type].left(t, t.left);

// Credit a clear to collect targets. `colours` = array of colour indexes of the cleared pieces.
export function creditClear(state, colours) {
  for (const t of targetsOf(state)) if (t.type === 'collect') t.got = (t.got || 0) + colours.filter((c) => c === t.c).length;
}

export function validateTargets(targets, dirtTotal, layout = null) {
  const bad = [];
  if (!Array.isArray(targets) || targets.length < 1 || targets.length > MAX_TARGETS) bad.push('1 to 3 targets');
  for (const t of targets || []) { if (!TARGET_TYPES[t.type]) bad.push('unknown target ' + t.type); if (!(t.n > 0)) bad.push('target n'); }
  const dig = (targets || []).filter((t) => t.type === 'dig');
  if (dirtTotal === 0) { if (dig.length) bad.push('a level without a plaque has no dig target'); }   // collect-only levels (1 to 5): no plaque
  else if (dig.length !== 1 || dig[0].n !== dirtTotal) bad.push('dig target must match dirtTotal');   // dirt panel is driven by the dig target
  if (layout) {   // objective counts must be reachable from the layout
    const have = {}; for (const c of layout.cells) have[c.k] = (have[c.k] || 0) + 1;
    for (const t of targets || []) {
      if (t.type === 'fossils' && t.n > (have.fossil || 0)) bad.push('more fossils asked than fossil tiles');
      if (t.type === 'skeleton' && t.n > (have.bone || 0)) bad.push('more bone tiles asked than exist');
      if (t.type === 'stones' && t.n > (have.sandstone || 0) + (have.vine || 0)) bad.push('more stone tiles asked than exist');
      if (t.type === 'drop' && t.n > layout.artefacts.length) bad.push('more artefacts asked than placed');
      if (t.type === 'clearAll' && (!OBSTACLES[t.k] || OBSTACLES[t.k].hp === Infinity || t.n !== (have[t.k] || 0))) bad.push('clearAll needs a breakable kind with n = its count');
    }
  } else for (const t of targets || []) if (!['dig', 'collect'].includes(t.type)) bad.push('needs a layout');
  return bad;
}
