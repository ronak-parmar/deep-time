/**
 * ad-brain config: defaults, hard ceilings and validation.
 *
 * Every number from docs/02-ad-brain.md lives here as a default. Each leaf also carries
 * a hard [min, max] that is the ceiling/floor no remote config can pass. Remote values
 * are clamped; wrong types fall back to the default for that key; a config that is not
 * a plain object falls back to the whole default config.
 */

const num = (def, min, max, opts = {}) => ({ kind: 'number', def, min, max, int: !!opts.int });
const bool = (def) => ({ kind: 'boolean', def });

/** Schema: leaves are { kind, def, min, max }. Nested objects are groups. */
export const SCHEMA = {
  prob: {
    base: num(0.35, 0, 0.9), // docs/02: starts at 35%
    perWinStreak: num(0.05, 0, 0.2), // +0.05 per win
    streakCap: num(6, 0, 10, { int: true }), // streak counted up to 6
    lossPenalty: num(0.15, 0, 0.5), // -0.15 after a loss
    perAdToday: num(0.04, 0, 0.2), // -0.04 per ad already shown today
    milestoneBonus: num(0.15, 0, 0.4), // +0.15 after milestone celebration
    catchUpBonus: num(0.1, 0, 0.3), // +0.10 when behind on expected revenue
    starvationBonus: num(0.3, 0, 0.5), // +0.30 after starvation
    starvationRounds: num(8, 4, 30, { int: true }), // 8 rounds without an ad
    softBudgetOverageScale: num(0.5, 0, 1), // assumption: beyond soft budget, probability is scaled down
    max: num(0.9, 0, 0.9), // never certain: hard ceiling 0.9
  },
  pacing: {
    cooldownSec: num(60, 30, 3600), // 60 s between forced ads (floor 30)
    minRoundsBetween: num(2, 1, 20, { int: true }), // at least 2 rounds between forced ads
    rewardedGuardSec: num(90, 45, 3600), // no forced ad within 90 s of a rewarded ad
    softBudgetPerDay: num(4, 0, 8, { int: true }), // soft 4/day
    hardCapPerDay: num(8, 0, 8, { int: true }), // hard 8/day (ceiling 8)
    rewardedMaxPerDay: num(10, 0, 10, { int: true }), // rewarded offers max 10/day
    rewardedMinGapSec: num(15, 10, 3600), // min gap about 15 s
  },
  blocks: {
    minInterstitialLevel: num(4, 4, 1000, { int: true }), // levels 1-3 never get a forced ad
    winAfterLossesThreshold: num(3, 1, 3, { int: true }), // first win after >= 3 losses
    lossStreakBlock: num(4, 2, 4, { int: true }), // loss streak >= 4 ...
    levelsBlockedAfterLossStreak: num(3, 2, 10, { int: true }), // ... blocks "the next few" levels
  },
  moments: {
    milestoneEvery: num(10, 1, 1000, { int: true }),
    historyVideoEvery: num(50, 1, 1000, { int: true }), // video is NOT an ad
    historyVideoSuppressesInterstitial: bool(true), // assumption
    streakSaveMin: num(3, 2, 50, { int: true }), // assumption: min streak worth a "save it" offer
    helpLossStreak: num(2, 2, 10, { int: true }), // loss streak >= 2 -> help offer
    boosterOfferAllowedInPlay: bool(true), // assumption: refill button may show mid-round
  },
  catchUp: {
    expectedRoundsPerDay: num(20, 1, 500, { int: true }), // assumption
    tolerance: num(0.5, 0, 5),
    minRounds: num(4, 1, 100, { int: true }),
  },
  segmentRules: {
    // classification thresholds (assumptions; the game can also force a segment)
    newMaxLevels: num(15, 0, 1000, { int: true }),
    newMaxDays: num(2, 0, 30, { int: true }),
    minOffersForRates: num(5, 1, 100, { int: true }),
    rewardedLoverRate: num(0.5, 0, 1),
    adAverseRate: num(0.1, 0, 1),
  },
  segments: Object.fromEntries(
    Object.entries({
      regular: [1, 1],
      new: [0.6, 0.75],
      rewarded_lover: [0.8, 1],
      ad_averse: [0.5, 0.5],
      spender: [0.6, 0.6],
    }).map(([k, [p, b]]) => [k, { probScale: num(p, 0, 1.5), budgetScale: num(b, 0, 1.5) }]),
  ),
};

/** Segment names. ads_removed is fixed in code: it never sees a forced ad, no config can change that. */
export const SEGMENTS = Object.freeze(['regular', 'new', 'rewarded_lover', 'ad_averse', 'spender', 'ads_removed']);

const isLeaf = (n) => n && typeof n === 'object' && typeof n.kind === 'string';
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

function buildDefaults(schema) {
  const out = {};
  for (const [k, v] of Object.entries(schema)) out[k] = isLeaf(v) ? v.def : buildDefaults(v);
  return out;
}

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
}

/** Hard limits as a flat map "group.key" -> { min, max } (for docs/tests). */
export function hardLimits() {
  const out = {};
  const walk = (schema, path) => {
    for (const [k, v] of Object.entries(schema)) {
      const p = path ? `${path}.${k}` : k;
      if (isLeaf(v)) {
        if (v.kind === 'number') out[p] = { min: v.min, max: v.max };
      } else walk(v, p);
    }
  };
  walk(SCHEMA, '');
  return out;
}

export const DEFAULT_CONFIG = deepFreeze(buildDefaults(SCHEMA));

/**
 * Validate and clamp a (remote) config.
 * @param {unknown} input partial config; undefined/null means "use defaults"
 * @returns {{ config: typeof DEFAULT_CONFIG, issues: {path:string, problem:string, value:any, used:any}[], usedDefaults: boolean }}
 */
export function validateConfig(input) {
  const issues = [];
  if (input === undefined || input === null) return { config: DEFAULT_CONFIG, issues, usedDefaults: true };
  if (!isPlainObject(input)) {
    issues.push({ path: '', problem: 'config is not an object; using defaults', value: input, used: 'defaults' });
    return { config: DEFAULT_CONFIG, issues, usedDefaults: true };
  }

  const walk = (schema, src, path) => {
    const out = {};
    const srcObj = isPlainObject(src) ? src : {};
    if (src !== undefined && !isPlainObject(src)) {
      issues.push({ path, problem: 'expected an object; using defaults for the group', value: src, used: 'defaults' });
    }
    for (const key of Object.keys(srcObj)) {
      if (!(key in schema)) issues.push({ path: join(path, key), problem: 'unknown key ignored', value: srcObj[key], used: undefined });
    }
    for (const [k, node] of Object.entries(schema)) {
      const p = join(path, k);
      const v = srcObj[k];
      if (!isLeaf(node)) {
        out[k] = walk(node, v, p);
        continue;
      }
      if (v === undefined) {
        out[k] = node.def;
      } else if (node.kind === 'boolean') {
        if (typeof v === 'boolean') out[k] = v;
        else {
          issues.push({ path: p, problem: 'expected boolean; default used', value: v, used: node.def });
          out[k] = node.def;
        }
      } else if (typeof v !== 'number' || !Number.isFinite(v)) {
        issues.push({ path: p, problem: 'expected a finite number; default used', value: v, used: node.def });
        out[k] = node.def;
      } else {
        let x = node.int ? Math.round(v) : v;
        const clamped = Math.min(node.max, Math.max(node.min, x));
        if (clamped !== x || x !== v) issues.push({ path: p, problem: clamped !== x ? 'clamped to hard limit' : 'rounded to integer', value: v, used: clamped });
        out[k] = clamped;
      }
    }
    return out;
  };
  const join = (a, b) => (a ? `${a}.${b}` : b);

  const config = walk(SCHEMA, input, '');

  // Cross-field rules: soft budget can never exceed the hard cap.
  if (config.pacing.softBudgetPerDay > config.pacing.hardCapPerDay) {
    issues.push({ path: 'pacing.softBudgetPerDay', problem: 'soft budget above hard cap; lowered to hard cap', value: config.pacing.softBudgetPerDay, used: config.pacing.hardCapPerDay });
    config.pacing.softBudgetPerDay = config.pacing.hardCapPerDay;
  }
  return { config: deepFreeze(config), issues, usedDefaults: false };
}
