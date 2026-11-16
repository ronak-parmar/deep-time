/**
 * Persistent ad-brain state + SaveStore adapters.
 *
 * SaveStore interface (sync or async, both are fine):
 *   load(): State | null | Promise<State | null>
 *   save(state: State): void | Promise<void>
 * Local first (LocalStorageSaveStore), Play Games saved games later (use mergeStates for conflicts).
 */

export const STATE_VERSION = 1;

/**
 * @typedef {Object} DayCounters
 * @property {string} key       day key (local date by default)
 * @property {number} interstitials  forced ads shown today
 * @property {number} rewardedOffered
 * @property {number} rewardedShown
 * @property {number} rounds         finished rounds today
 *
 * @typedef {Object} AdState
 * @property {number} version
 * @property {number} installedAt  ms
 * @property {boolean} adsRemoved
 * @property {string|null} segmentOverride
 * @property {number} highestLevel
 * @property {number} coins
 * @property {number} winStreak
 * @property {number} bestStreak
 * @property {number} lossStreak      consecutive lost rounds
 * @property {'win'|'loss'|null} lastRound
 * @property {number} roundsSinceInterstitial
 * @property {number} adBlockLevelsLeft  wins still protected after a long loss streak
 * @property {number|null} lastInterstitialAt
 * @property {number|null} lastRewardedAt
 * @property {number|null} lastRewardedOfferAt
 * @property {DayCounters} day
 * @property {{rounds:number,wins:number,losses:number,interstitials:number,rewardedOffered:number,rewardedAccepted:number,rewardedDeclined:number,rewardedCompleted:number,purchases:number,sessions:number}} lifetime
 */

/** @returns {AdState} */
export function createInitialState(now = 0, overrides = {}) {
  const base = {
    version: STATE_VERSION,
    installedAt: now,
    adsRemoved: false,
    segmentOverride: null,
    highestLevel: 0,
    coins: 0,
    winStreak: 0,
    bestStreak: 0,
    lossStreak: 0,
    lastRound: null,
    roundsSinceInterstitial: 0,
    adBlockLevelsLeft: 0,
    lastInterstitialAt: null,
    lastRewardedAt: null,
    lastRewardedOfferAt: null,
    day: { key: '', interstitials: 0, rewardedOffered: 0, rewardedShown: 0, rounds: 0 },
    lifetime: { rounds: 0, wins: 0, losses: 0, interstitials: 0, rewardedOffered: 0, rewardedAccepted: 0, rewardedDeclined: 0, rewardedCompleted: 0, purchases: 0, sessions: 0 },
  };
  return {
    ...base,
    ...overrides,
    day: { ...base.day, ...(overrides.day || {}) },
    lifetime: { ...base.lifetime, ...(overrides.lifetime || {}) },
  };
}

/** Make a loaded blob safe: fill missing fields, drop junk. Returns null if unusable. */
export function normalizeState(raw, now = 0) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const init = createInitialState(now);
  const out = createInitialState(now);
  for (const k of Object.keys(init)) {
    if (k === 'day' || k === 'lifetime') {
      if (raw[k] && typeof raw[k] === 'object') {
        for (const f of Object.keys(init[k])) {
          if (typeof raw[k][f] === typeof init[k][f] && (typeof raw[k][f] !== 'number' || Number.isFinite(raw[k][f]))) out[k][f] = raw[k][f];
        }
      }
    } else if (raw[k] !== undefined && (typeof raw[k] === typeof init[k] || raw[k] === null || init[k] === null)) {
      if (typeof raw[k] === 'number' && !Number.isFinite(raw[k])) continue;
      out[k] = raw[k];
    }
  }
  out.version = STATE_VERSION;
  return out;
}

/**
 * Merge two saves (e.g. local vs cloud): higher level wins, larger coin total,
 * remove-ads kept if either copy has it (docs/02, docs/05). Counters take the max.
 */
export function mergeStates(a, b) {
  if (!a) return b ?? null;
  if (!b) return a;
  const newer = (a.day?.key || '') >= (b.day?.key || '') ? a : b;
  const out = structuredClone(newer);
  out.adsRemoved = !!(a.adsRemoved || b.adsRemoved);
  out.highestLevel = Math.max(a.highestLevel, b.highestLevel);
  out.coins = Math.max(a.coins, b.coins);
  out.bestStreak = Math.max(a.bestStreak, b.bestStreak);
  out.installedAt = Math.min(a.installedAt, b.installedAt);
  for (const k of Object.keys(out.lifetime)) out.lifetime[k] = Math.max(a.lifetime[k] ?? 0, b.lifetime[k] ?? 0);
  return out;
}

/** In-memory store, for tests and the simulator. */
export class MemorySaveStore {
  constructor(initial = null) {
    this.data = initial ? structuredClone(initial) : null;
    this.saves = 0;
  }
  load() {
    return this.data ? structuredClone(this.data) : null;
  }
  save(state) {
    this.data = structuredClone(state);
    this.saves++;
  }
}

/** localStorage-style adapter: pass any object with getItem/setItem (window.localStorage in the app). */
export class LocalStorageSaveStore {
  constructor(storage, key = 'deep-time.ad-brain.v1') {
    this.storage = storage;
    this.key = key;
  }
  load() {
    try {
      const raw = this.storage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null; // corrupt or unavailable: start fresh
    }
  }
  save(state) {
    this.storage.setItem(this.key, JSON.stringify(state));
  }
}
