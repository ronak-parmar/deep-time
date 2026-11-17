// Difficulty tiers (docs/14): every level is 'normal', 'hard' or 'super-hard'. Data-driven and deterministic:
//  - never in the hand-made onboarding (levels 1-15)
//  - one hard level every 8 to 12 levels (seeded), so never two hard levels in a row
//  - never on a breather or milestone level (level % 5 === 0) or an obstacle teach level (level % 10 === 1)
//  - in every 40-level window from level 41 on, the first hard level at or after window start + 5 is super-hard
// A tier changes the move budget and the win reward only; the board and gems stay the same.
import { TOTAL_LEVELS } from './eras.js';
import { hashSeed } from './rng.js';

export const TIERS = {
  normal: { id: 'normal', moves: 1, coins: 1, pickaxes: 0, label: '' },
  hard: { id: 'hard', moves: 0.85, coins: 1.5, pickaxes: 0, label: 'Hard level' },
  'super-hard': { id: 'super-hard', moves: 0.72, coins: 2, pickaxes: 0, label: 'Super hard level' }
};
export const TIER_RULES = { onboarding: 15, gapMin: 8, gapMax: 12, superWindow: 40, superFrom: 41, superOffset: 5 };

const okSpot = (n) => n % 5 !== 0 && n % 10 !== 1;
let table = null;
function build() {
  const R = TIER_RULES, t = new Array(TOTAL_LEVELS + 1).fill('normal');
  const hard = [];
  let x = R.onboarding + 1;
  while (x <= TOTAL_LEVELS) {
    while (x <= TOTAL_LEVELS && !okSpot(x)) x++;
    if (x > TOTAL_LEVELS) break;
    hard.push(x); t[x] = 'hard';
    x += R.gapMin + (hashSeed(x, 29) % (R.gapMax - R.gapMin + 1));
  }
  for (let w = R.superFrom; w <= TOTAL_LEVELS; w += R.superWindow) {
    const h = hard.find((n) => n >= w + R.superOffset && n < w + R.superWindow);
    if (h) t[h] = 'super-hard';
  }
  return t;
}
// tier of level n (later cycles repeat the same pattern)
export function tierOf(level) {
  table ||= build();
  const n = ((Math.max(1, Math.floor(level)) - 1) % TOTAL_LEVELS) + 1;
  return table[n];
}
export const tierInfo = (level) => TIERS[tierOf(level)];
export const firstLevelOfTier = (tier) => { table ||= build(); return table.indexOf(tier); };
