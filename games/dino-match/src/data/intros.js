// The element registry (docs/14). ONE place that says what every board element is, when the player first meets it and how it is
// explained. Adding an element = one entry here (plus its rules in core/). A guard test (tests/intros.test.js) fails if a level
// uses an element that has no entry, so nothing can reach the player unexplained.
//
// entry = { id, group, title, text (1-2 short lines), first (level where it is taught), slot (pacing group, default id),
//           hook (where its rules live: { kind, key }), art (what the card draws: { kind, key }), spot (what is lit on the board),
//           tutorial? (level whose scripted tutorial already teaches it: no popup there), event? (shown when it first happens) }
// spot: 'board' | 'target' | 'plaque' | 'moves' | { obstacle: kind } | { special: kind }
import { CONFIG } from '../core/config.js';
import { OBSTACLES, parseLayout } from '../core/obstacles.js';
import { KINDS, COMBOS } from '../core/specials.js';
import { BOOSTERS, boosterIntroId } from './boosters.js';
import { firstLevelOfTier } from '../core/difficulty.js';

const U = CONFIG.specials.unlock, O = CONFIG.obstacles.unlock;
const E = (id, group, title, text, first, extra) => ({ id, group, title, text, first, slot: id, ...extra });

export const INTROS = Object.fromEntries([
  // ---- objectives: what a level asks you to do
  E('obj-collect', 'objective', 'Break gems', 'Match gems of the target colour to break them. Other colours still use a move.', 1, { hook: { kind: 'target', key: 'collect' }, art: { kind: 'gem', key: 0 }, spot: 'target', tutorial: 1 }),
  E('obj-dig', 'objective', 'Dig blocks', 'Match the colour shown on a block to hit it. Dig every block to uncover a fossil part.', 6, { hook: { kind: 'target', key: 'dig' }, art: { kind: 'block', key: 'tar', badge: 0, pick: true }, spot: 'plaque', tutorial: 6 }),   // same picture as the HUD dig goal
  E('obj-clearAll', 'objective', 'Clear them all', 'Clear every obstacle of the kind shown before the moves run out.', O.tar, { slot: 'tar', hook: { kind: 'target', key: 'clearAll' }, art: { kind: 'obstacle', key: 'tar' }, spot: 'target' }),
  E('obj-stones', 'objective', 'Break stones', 'Break the stone tiles. Sandstone and vine stone both count.', O.sandstone, { slot: 'sandstone', hook: { kind: 'target', key: 'stones' }, art: { kind: 'obstacle', key: 'sandstone' }, spot: 'target' }),
  E('obj-fossils', 'objective', 'Collect fossils', 'Break the fossil tiles to collect the fossil buried under each one.', O.fossil, { slot: 'fossil', hook: { kind: 'target', key: 'fossils' }, art: { kind: 'obstacle', key: 'fossil' }, spot: 'target' }),
  E('obj-skeleton', 'objective', 'Uncover the skeleton', 'Break every tile of the buried skeleton to uncover it.', O.bone, { slot: 'bone', hook: { kind: 'target', key: 'skeleton' }, art: { kind: 'obstacle', key: 'bone' }, spot: 'target' }),
  E('obj-drop', 'objective', 'Drop the artefact', 'Match gems under an artefact so it falls to the bottom row.', O.artefact, { slot: 'artefact', hook: { kind: 'target', key: 'drop' }, art: { kind: 'artefact' }, spot: 'target' }),
  // ---- dig blocks on the plaque
  E('plaque', 'block', 'The plaque', 'The plaque shows the blocks to dig. A 3-match hits once, 4 hits twice, 5 or more hits three times.', 6, { hook: { kind: 'block', key: 'tar' }, art: { kind: 'block', key: 'tar' }, spot: 'plaque', tutorial: 6 }),
  E('sand', 'block', 'Sand block', 'Sand takes two hits. Bigger matches hit harder.', 8, { hook: { kind: 'block', key: 'sand' }, art: { kind: 'block', key: 'sand' }, spot: 'plaque' }),
  E('stone', 'block', 'Stone block', 'Stone takes three hits. A match of 5 breaks it in one go.', 10, { hook: { kind: 'block', key: 'stone' }, art: { kind: 'block', key: 'stone' }, spot: 'plaque' }),
  // ---- special pieces
  E('firecracker', 'special', 'Firecracker', 'Match 4 in a line to make one. Match it later to blast a whole row or column.', U.firecracker, { hook: { kind: 'special', key: 'firecracker' }, art: { kind: 'special', key: 'firecracker' }, spot: 'board', tutorial: 5 }),
  E('bomb', 'special', 'Bomb', 'Match 5 in an L or T shape to make one. It blasts a 3 by 3 square.', U.bomb, { hook: { kind: 'special', key: 'bomb' }, art: { kind: 'special', key: 'bomb' }, spot: 'board' }),
  E('dynamite', 'special', 'Dynamite', 'Match 6 gems in one group to make one. It blasts a wide diamond.', U.dynamite, { hook: { kind: 'special', key: 'dynamite' }, art: { kind: 'special', key: 'dynamite' }, spot: 'board' }),
  E('tnt', 'special', 'TNT', 'Match 5 in a cross, or 7 in a group. It blasts a 7 by 7 area.', U.tnt, { hook: { kind: 'special', key: 'tnt' }, art: { kind: 'special', key: 'tnt' }, spot: 'board' }),
  E('rainbow', 'special', 'Rainbow gem', 'Match 5 in a straight line to make one. Swap it with a gem to clear every gem of that colour.', U.rainbow, { hook: { kind: 'special', key: 'rainbow' }, art: { kind: 'special', key: 'rainbow' }, spot: 'board' }),
  // ---- obstacles (each one is taught first on a safe, hand-made level)
  ...Object.keys(OBSTACLES).map((k) => E(k, 'obstacle', OBSTACLES[k].name, ({
    tar: 'Tar clears when you match next to it, or blast it. Watch out: in hard levels it spreads.',
    rock: 'Rock never breaks. Gems fall around it, so it shapes the board.',
    sandstone: 'Sandstone cracks after two hits and then crumbles. Match next to it, or blast it.',
    fossil: 'A fossil is buried under this tile. Break the tile to collect it.',
    bone: 'One tile of a buried skeleton. Break them all to uncover it.',
    vine: 'Vine stone needs two matches next to it. Blasts cannot cut vines, and nothing swaps through it.',
    crate: 'Crates only break in a blast. Make a Firecracker or Bomb. They drop coins.',
    lava: 'Lava rock heats every 3 moves, then erupts tar around it. Hit it three times to clear it.'
  })[k], O[k], { hook: { kind: 'obstacle', key: k }, art: { kind: 'obstacle', key: k }, spot: { obstacle: k } })),
  E('artefact', 'obstacle', 'Artefact', 'An artefact does not match. Clear the gems under it so it falls to the bottom row.', O.artefact, { hook: { kind: 'artefact', key: 'a' }, art: { kind: 'artefact' }, spot: 'board' }),
  // ---- boosters (generated from data/boosters.js: the card says what it does, 'tap the booster, then tap where to use it', lights the button)
  ...Object.values(BOOSTERS).map((b) => E(boosterIntroId(b.id), 'booster', b.name, b.text, b.first, { hook: { kind: 'booster', key: b.id }, art: { kind: 'booster', key: b.id }, spot: { booster: b.id }, booster: b.id })),
  // ---- things that happen during play (shown the first time, as a small card)
  // ---- difficulty tiers (core/difficulty.js): shown the first time a hard / super-hard level comes up
  E('tier-hard', 'event2', 'Hard level', 'Hard level: fewer moves, bigger rewards. Look for the red frame.', firstLevelOfTier('hard'), { group: 'tier', hook: { kind: 'tier', key: 'hard' }, art: { kind: 'tier', key: 'hard' }, spot: 'moves' }),
  E('tier-super-hard', 'event2', 'Super hard level', 'Super hard: even fewer moves, double coins. Look for the violet frame.', firstLevelOfTier('super-hard'), { group: 'tier', hook: { kind: 'tier', key: 'super-hard' }, art: { kind: 'tier', key: 'super-hard' }, spot: 'moves' }),
  E('shuffle', 'event', 'Shuffle', 'No moves left? The board shuffles for you. Specials stay where they are.', null, { event: true, hook: { kind: 'event', key: 'shuffle' }, art: { kind: 'icon', key: 'burst' }, spot: 'board' }),
  E('hint', 'event', 'Hint', 'Stuck? After a short wait, two gems glow to show you a move.', null, { event: true, hook: { kind: 'event', key: 'hint' }, art: { kind: 'icon', key: 'info' }, spot: 'board' })
].map((e) => [e.id, e]));

// Combos: two specials swapped together. Keyed by pair, shown the first time the player makes that pair.
export const COMBO_INTROS = [
  { ids: ['firecracker', 'firecracker'], text: 'Two Firecrackers: a row and a column blast at once.' },
  { ids: ['firecracker', 'bomb'], text: 'Firecracker + Bomb: a 3-wide cross blast.' },
  { ids: ['firecracker', 'dynamite'], text: 'Firecracker + Dynamite: a 5-wide cross blast.' },
  { ids: ['firecracker', 'tnt'], text: 'Firecracker + TNT: a 7-wide cross blast.' },
  { ids: ['bomb', 'bomb'], text: 'Two Bombs: a 5 by 5 blast.' },
  { ids: ['bomb', 'dynamite'], text: 'Bomb + Dynamite: a 7 by 7 blast.' },
  { ids: ['bomb', 'tnt'], text: 'Bomb + TNT: a 9 by 9 blast.' },
  { ids: ['dynamite', 'dynamite'], text: 'Two Dynamites: a huge diamond blast.' },
  { ids: ['dynamite', 'tnt'], text: 'Dynamite + TNT: a 9 by 9 blast.' },
  { ids: ['tnt', 'tnt'], text: 'Two TNTs clear the whole board.' },
  { ids: ['rainbow', 'rainbow'], text: 'Two Rainbows clear the whole board.' },
  ...['firecracker', 'bomb', 'dynamite', 'tnt'].map((k) => ({ ids: [k, 'rainbow'], text: `Rainbow + ${INTRO_NAME(k)}: every gem of one colour turns into a ${INTRO_NAME(k)}, then they all go off.` }))
].map((c) => ({ ...c, id: comboId(c.ids[0], c.ids[1]), ids: sortIds(c.ids) }));
function INTRO_NAME(k) { return { firecracker: 'Firecracker', bomb: 'Bomb', dynamite: 'Dynamite', tnt: 'TNT' }[k]; }
function sortIds(ids) { return [...ids].sort((a, b) => KINDS.indexOf(a) - KINDS.indexOf(b)); }
export function comboId(a, b) { return 'combo:' + sortIds([a, b]).join('+'); }
export const comboIntroFor = (a, b) => COMBO_INTROS.find((c) => c.id === comboId(a, b)) || null;
export const ALL_INTRO_IDS = [...Object.keys(INTROS), ...COMBO_INTROS.map((c) => c.id)];

// ---- which elements does a level use? (pure, from the generated level config) ------------------------------------------
const NAME = { tar: 'tar', sandstone: 'sandstone' };
void NAME; void COMBOS;
export function elementsOfLevel(cfg) {
  const ids = new Set();
  for (const s of cfg.specials || []) ids.add(s);
  if (cfg.blocks && cfg.blocks.length) { ids.add('plaque'); for (const b of cfg.blocks) if (b.t === 'sand' || b.t === 'stone') ids.add(b.t); }
  if (cfg.layout) { const p = parseLayout(cfg.layout); for (const c of p.cells) ids.add(c.k); if (p.artefacts.length) ids.add('artefact'); }
  for (const t of cfg.targets || []) ids.add('obj-' + t.type);
  if (cfg.tier && cfg.tier !== 'normal') ids.add('tier-' + cfg.tier);
  if (cfg.level) for (const b of Object.values(BOOSTERS)) if (b.first <= cfg.level) ids.add(boosterIntroId(b.id));   // boosters are available from their teach level on
  return [...ids];
}

// ---- what to show (pure) ----------------------------------------------------------------------------------------------
// profile.tutorial.intros = ids already shown. An element whose first-level scripted tutorial covers it counts as seen when that
// tutorial was seen. At most MAX_PER_LEVEL cards per level start: the newest elements first (so a player who jumps ahead is not
// buried; older elements stay in How to play and show up when they are met again).
export const MAX_PER_LEVEL = 2;
export function seenIntros(tut) {
  const t = tut || {}, seen = new Set(Array.isArray(t.intros) ? t.intros : []);
  for (const e of Object.values(INTROS)) if (e.tutorial && (t.seen || []).includes(e.tutorial)) seen.add(e.id);
  return seen;
}
export function introsFor(profile, cfg) {
  const t = profile.tutorial || {};
  if (t.off) return [];
  const seen = seenIntros(t);
  return elementsOfLevel(cfg).map((id) => INTROS[id]).filter((e) => e && !e.event && !seen.has(e.id) && !e.tutorial)
    .sort((a, b) => b.first - a.first).slice(0, MAX_PER_LEVEL);
}
// Pre-level boosters are explained on the level-start screen, in-level ones on the play screen: two lists from the same registry.
export const isPreIntro = (e) => !!e.booster && BOOSTERS[e.booster].kind === 'pre';
export const introNeeded = (profile, id) => !(profile.tutorial && profile.tutorial.off) && !seenIntros(profile.tutorial).has(id);
export function markIntroSeen(profile, ...ids) {
  const t = profile.tutorial || { seen: [], off: false };
  return { ...profile, tutorial: { ...t, intros: [...new Set([...(t.intros || []), ...ids])] } };
}
