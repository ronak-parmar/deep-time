import { CONFIG } from './config.js';
import { makeRng, shuffle, hashSeed } from './rng.js';
import { eraOf, eraIndexOf, cycleOf, levelInEra } from './eras.js';
import { winRate } from './bot.js';

// Hand-authored onboarding (levels 1-15, Cambrian). Very forgiving: moves is well above dirt.
// [size, colours, dirtBlocks, moves, tip]
const ONBOARDING = [
  [6, 4, 4, 12, 'Swap two neighbours to line up three of a kind. Every move digs one block.'],
  [6, 4, 5, 12, 'A swap that makes no match bounces back and costs nothing.'],
  [6, 4, 6, 13, 'Dig every block to uncover the fossil before the moves run out.'],
  [6, 5, 6, 12, null],
  [6, 5, 7, 13, null],
  [7, 5, 8, 13, null],
  [7, 5, 8, 12, null],
  [7, 5, 9, 13, null],
  [7, 5, 9, 12, null],
  [7, 5, 10, 13, null],
  [7, 5, 10, 12, null],
  [7, 5, 11, 13, null],
  [7, 5, 11, 12, null],
  [7, 5, 12, 13, null],
  [7, 5, 12, 12, null]
];

// Difficulty target in 0..0.8 (docs/03).
export function difficultyTarget(level) {
  const L = CONFIG.levels;
  const progress = (levelInEra(level) - 1) / (L.perEra - 1);
  let t = L.base + L.perEraStep * eraIndexOf(level) + L.acrossEra * progress + L.cycleBump * cycleOf(level);
  if (level % 10 === 0) t += L.milestoneBump;
  else if (level % 5 === 0 || levelInEra(level) === 1) t *= L.breatherFactor;
  return Math.min(L.cap, t);
}
export function levelKind(level) {
  if (level <= CONFIG.levels.onboarding) return 'onboarding';
  if (level % 10 === 0) return 'milestone';
  if (level % 5 === 0 || levelInEra(level) === 1) return 'breather';
  return 'normal';
}

function base(level) {
  const rng = makeRng(hashSeed(level, 7));
  return { level, seed: level, era: eraOf(level).id, rng };
}
function withOrder(cfg, rng) {
  const order = shuffle(rng, Array.from({ length: cfg.dirtTotal }, (_, i) => i));
  return { ...cfg, dirtOrder: order };
}

// Generate level n. Deterministic: same n always gives the same level (seed = level number).
// tune=true runs the bot to land the win rate in the target band; false gives the cheap estimate.
export function generateLevel(level, { tune = true } = {}) {
  const b = base(level);
  const kind = levelKind(level);
  if (kind === 'onboarding') {
    const [size, colors, dirtTotal, moves, tip] = ONBOARDING[level - 1];
    return withOrder({ level, seed: b.seed, era: b.era, kind, w: size, h: size, colors, dirtTotal, moves, tip, target: 0.1 }, b.rng);
  }
  const target = difficultyTarget(level);
  const colors = eraIndexOf(level) === 0 && target < 0.3 ? 5 : 6;
  const dirtTotal = 7 + Math.floor(target * 14) + (kind === 'milestone' ? 2 : 0);
  const cfg = withOrder({ level, seed: b.seed, era: b.era, kind, w: CONFIG.size.normal, h: CONFIG.size.normal, colors, dirtTotal, target, tip: null, moves: dirtTotal + 4 }, b.rng);
  const L = CONFIG.levels;
  // v1 (no bonus digs): a move digs exactly one block, so moves >= dirtTotal is always winnable.
  // Slack shrinks as the target rises. With bonus hooks ON the bot tunes the budget instead.
  const extras = CONFIG.dig.extraBigMatch || CONFIG.dig.extraPerCascadeStep;
  const lo = extras ? Math.ceil(dirtTotal * L.minMoveRatio) : dirtTotal, hi = dirtTotal + L.maxSlack;
  if (!tune || !extras) { cfg.moves = dirtTotal + Math.round((1 - target / L.cap) * 6); return cfg; }
  // find the smallest budget whose bot win rate reaches the goal, then keep the closer neighbour
  const goal = 1 - target;
  let a = lo, z = hi;
  while (a < z) {
    const mid = (a + z) >> 1;
    if (winRate({ ...cfg, moves: mid }) >= goal) z = mid; else a = mid + 1;
  }
  let best = a;
  if (a > lo && Math.abs(winRate({ ...cfg, moves: a - 1 }) - goal) < Math.abs(winRate({ ...cfg, moves: a }) - goal)) best = a - 1;
  cfg.moves = best;
  cfg.botWinRate = winRate(cfg);
  return cfg;
}

// Sanity check used by tests and the checker script: solvable by construction or by the bot.
export function validateLevel(cfg) {
  const problems = [];
  if (cfg.dirtTotal < 1) problems.push('no dirt');
  if (cfg.dirtOrder.length !== cfg.dirtTotal) problems.push('dirt order mismatch');
  if (cfg.moves < Math.ceil(cfg.dirtTotal * CONFIG.levels.minMoveRatio)) problems.push('too few moves');
  if (cfg.kind !== 'onboarding' && !(CONFIG.dig.extraBigMatch || CONFIG.dig.extraPerCascadeStep) && cfg.moves < cfg.dirtTotal) problems.push('unwinnable without bonus digs');
  if (cfg.moves < cfg.dirtTotal && winRate(cfg, 24) === 0) problems.push('bot never wins');
  return problems;
}
