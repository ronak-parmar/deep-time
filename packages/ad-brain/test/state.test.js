import { describe, it, expect } from 'vitest';
import { MemorySaveStore, LocalStorageSaveStore, createInitialState, normalizeState, mergeStates, createAdBrain } from '../src/index.js';
import { makeBrain, veteran, T0, fixedDay } from './helpers.js';

const fakeStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

describe('SaveStore adapters', () => {
  it('memory store round-trips a copy', () => {
    const s = new MemorySaveStore();
    expect(s.load()).toBeNull();
    const st = createInitialState(5);
    s.save(st);
    st.coins = 99;
    expect(s.load().coins).toBe(0);
  });
  it('localStorage adapter round-trips', () => {
    const ls = fakeStorage();
    const s = new LocalStorageSaveStore(ls);
    s.save(createInitialState(5, { coins: 12 }));
    expect(new LocalStorageSaveStore(ls).load().coins).toBe(12);
  });
  it('localStorage adapter survives corrupt JSON and a throwing storage', () => {
    const ls = fakeStorage();
    ls.m.set('deep-time.ad-brain.v1', '{not json');
    expect(new LocalStorageSaveStore(ls).load()).toBeNull();
    expect(new LocalStorageSaveStore({ getItem() { throw new Error('denied'); } }).load()).toBeNull();
  });
});

describe('state normalisation', () => {
  it('fills missing fields and drops wrong-typed ones', () => {
    const s = normalizeState({ highestLevel: 'many', coins: 7, winStreak: NaN, lifetime: { wins: 4, losses: 'x' }, extra: 1 });
    expect(s.highestLevel).toBe(0);
    expect(s.coins).toBe(7);
    expect(s.winStreak).toBe(0);
    expect(s.lifetime.wins).toBe(4);
    expect(s.lifetime.losses).toBe(0);
    expect(s.extra).toBeUndefined();
  });
  it('rejects non-objects', () => {
    for (const bad of [null, 'x', 3, [], undefined]) expect(normalizeState(bad)).toBeNull();
  });
});

describe('mergeStates (Play Games saved-game conflicts)', () => {
  it('higher level wins, larger coins, remove-ads kept if either has it', () => {
    const a = createInitialState(100, { highestLevel: 40, coins: 500, adsRemoved: false });
    const b = createInitialState(50, { highestLevel: 25, coins: 900, adsRemoved: true });
    const m = mergeStates(a, b);
    expect(m.highestLevel).toBe(40);
    expect(m.coins).toBe(900);
    expect(m.adsRemoved).toBe(true);
    expect(m.installedAt).toBe(50);
    expect(mergeStates(null, b)).toBe(b);
    expect(mergeStates(a, null)).toBe(a);
  });
});

describe('brain persistence', () => {
  it('saves after every event and a new brain resumes', async () => {
    const t = await makeBrain({ state: veteran({ highestLevel: 10 }) });
    t.win(12);
    t.advance(300);
    t.win(13);
    expect(t.store.saves).toBeGreaterThan(0);
    const again = await createAdBrain({ store: t.store, clock: () => t.time.now, dayKey: fixedDay, rng: () => 0 });
    const s = again.getState();
    expect(s.winStreak).toBe(2);
    expect(s.highestLevel).toBe(13);
    expect(s.day.rounds).toBe(2);
  });
  it('a broken store never breaks the game', async () => {
    const store = { load() { throw new Error('boom'); }, save() { throw new Error('boom'); } };
    const brain = await createAdBrain({ store, clock: () => T0, rng: () => 0 });
    expect(() => brain.handleEvent('level_complete', { level: 5 })).not.toThrow();
  });
  it('an async store (Play Games) works and a rejected save is swallowed', async () => {
    const store = { load: async () => createInitialState(T0, { highestLevel: 77 }), save: async () => { throw new Error('offline'); } };
    const brain = await createAdBrain({ store, clock: () => T0, rng: () => 0 });
    expect(brain.getState().highestLevel).toBe(77);
    brain.handleEvent('level_complete', { level: 78 });
    await new Promise((r) => setTimeout(r, 5));
  });
  it('garbage in the store starts a fresh state', async () => {
    const store = new MemorySaveStore();
    store.load = () => 'garbage';
    const brain = await createAdBrain({ store, clock: () => T0 });
    expect(brain.getState().highestLevel).toBe(0);
  });
});
