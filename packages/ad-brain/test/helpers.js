import { createAdBrain, createRng, createInitialState, MemorySaveStore, MemoryAnalytics, MockProvider } from '../src/index.js';

export const T0 = Date.UTC(2026, 0, 1, 12, 0, 0);
export const fixedDay = (ms) => String(Math.floor(ms / 86400000));

/** Brain with a controllable clock. rng can be a number (always returns it), a function or omitted (seed 1). */
export async function makeBrain({ state, config, rng = 0.0, provider, seed } = {}) {
  const time = { now: T0 };
  const store = new MemorySaveStore(state ? createInitialState(T0, state) : null);
  const analytics = new MemoryAnalytics();
  const rngFn = seed !== undefined ? createRng(seed) : typeof rng === 'number' ? () => rng : rng;
  const brain = await createAdBrain({ config, store, provider, analytics, rng: rngFn, clock: () => time.now, dayKey: fixedDay });
  const advance = (sec) => (time.now += sec * 1000);
  /** play a full won round at `level` */
  const win = (level, extra = {}) => {
    brain.handleEvent('level_start', { level, game: 'dino-match', ...extra });
    return brain.handleEvent('level_complete', { level, game: 'dino-match', ...extra });
  };
  const lose = (level, extra = {}) => {
    brain.handleEvent('level_start', { level, game: 'dino-match', ...extra });
    return brain.handleEvent('level_failed', { level, game: 'dino-match', ...extra });
  };
  return { brain, time, store, analytics, advance, win, lose };
}

/** a veteran regular player state: past 'new' segment, free of blocks, day freshly started */
export function veteran(overrides = {}) {
  return {
    installedAt: T0 - 30 * 86400000,
    highestLevel: 200,
    roundsSinceInterstitial: 5,
    day: { key: fixedDay(T0), interstitials: 0, rewardedOffered: 0, rewardedShown: 0, rounds: 0 },
    ...overrides,
  };
}

export { MockProvider };
