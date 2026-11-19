import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { newProfile, migrateProfile, mergeProfiles, sameProfile, PROFILE_VERSION } from '../src/core/profile.js';
import { createCloudSaveStore, CLOUD_TOASTS, CLOUD_SLOT, createLocalSaveStore } from '../src/ports/save.js';
import { wrapPlayGames, createPlayGamesPort } from '../src/ports/playgames.js';
import { playGamesRowModel } from '../src/ui/playgames-model.js';
import { FOSSILS } from '../src/core/fossils.js';
import { CONFIG } from '../src/core/config.js';

const F0 = FOSSILS[0].id, F1 = FOSSILS[1].id, F2 = FOSSILS[2].id;

// ---- mergeProfiles -----------------------------------------------------------------------------------------------------
describe('mergeProfiles (cloud save)', () => {
  const P = (patch) => ({ ...newProfile(), ...patch });

  it('profile v5 has savedAt; migration keeps a good one and zeroes garbage', () => {
    expect(PROFILE_VERSION).toBe(5);
    expect(newProfile().savedAt).toBe(0);
    expect(migrateProfile({ v: 4, level: 3, savedAt: 1234.7 }).savedAt).toBe(1234);
    expect(migrateProfile({ v: 4, level: 3, savedAt: 'x' }).savedAt).toBe(0);
    expect(migrateProfile({ v: 4, level: 3 }).savedAt).toBe(0);
  });

  it('progress only grows: furthest level, best stars per level, furthest fossil parts, union of fossils', () => {
    const a = P({ level: 12, stars: { 1: 3, 2: 1, 11: 2 }, fossilProgress: { [F0]: 4, [F1]: 10 }, completedFossils: [F1], savedAt: 100 });
    const b = P({ level: 8, stars: { 1: 1, 2: 3, 7: 3 }, fossilProgress: { [F0]: 7, [F2]: 2 }, completedFossils: [F2], savedAt: 200 });
    for (const m of [mergeProfiles(a, b), mergeProfiles(b, a)]) {
      expect(m.level).toBe(12);
      expect(m.stars).toEqual({ 1: 3, 2: 3, 7: 3, 11: 2 });
      expect(m.fossilProgress).toEqual({ [F0]: 7, [F1]: 10, [F2]: 2 });
      expect([...m.completedFossils].sort()).toEqual([F1, F2].sort());
      expect(m.savedAt).toBe(200);
    }
  });

  it('spendables and settings come from the copy saved last (spending is not undone)', () => {
    const local = P({ level: 5, coins: 40, pickaxes: 1, boosters: { ...newProfile().boosters, pick: 0 }, settings: { ...newProfile().settings, muted: true }, savedAt: 2000 });
    const cloud = P({ level: 5, coins: 300, pickaxes: 6, boosters: { ...newProfile().boosters, pick: 5 }, settings: { ...newProfile().settings, muted: false }, savedAt: 1000 });
    const m = mergeProfiles(local, cloud);
    expect(m).toMatchObject({ coins: 40, pickaxes: 1, settings: { muted: true } });
    expect(m.boosters.pick).toBe(0);
    const m2 = mergeProfiles({ ...local, savedAt: 500 }, cloud);   // now the cloud copy is newer
    expect(m2).toMatchObject({ coins: 300, pickaxes: 6, settings: { muted: false } });
    expect(m2.boosters.pick).toBe(5);
  });

  it('with no save times on either copy, the larger of each spendable is kept', () => {
    const m = mergeProfiles(P({ coins: 10, pickaxes: 4, lives: 1 }), P({ coins: 50, pickaxes: 2, lives: 3 }));
    expect(m).toMatchObject({ coins: 50, pickaxes: 4, lives: 3 });
  });

  it('tutorial, coach steps and Yuvi flags are unions (never shown twice)', () => {
    const a = P({ tutorial: { seen: [1, 2], off: false, intros: ['bomb'] }, coach: { off: false, done: ['hello', 'goal'] }, yuvi: { welcomeSeen: true, met: false, islands: 2 }, savedAt: 10 });
    const b = P({ tutorial: { seen: [3], off: true, intros: ['line'] }, coach: { off: false, done: ['dig'] }, yuvi: { welcomeSeen: false, met: true, islands: 1 }, savedAt: 5 });
    const m = mergeProfiles(a, b);
    expect(m.tutorial).toEqual({ seen: [1, 2, 3], off: false, intros: ['bomb', 'line'] });
    expect([...m.coach.done].sort()).toEqual(['dig', 'goal', 'hello']);
    expect(m.yuvi).toEqual({ welcomeSeen: true, met: true, islands: 2 });
  });

  it('merging a copy with itself changes nothing, and the result survives migration', () => {
    const a = migrateProfile(P({ level: 30, coins: 99, stars: { 1: 2, 29: 3 }, fossilProgress: { [F0]: 3 }, savedAt: 7 }));
    expect(sameProfile(mergeProfiles(a, a), a)).toBe(true);
    const m = mergeProfiles(a, migrateProfile(P({ level: 2, savedAt: 3 })));
    expect(sameProfile(migrateProfile(m), m)).toBe(true);
  });

  it('sameProfile ignores key order and savedAt', () => {
    expect(sameProfile({ a: 1, b: { c: 2, d: 3 }, savedAt: 1 }, { b: { d: 3, c: 2 }, a: 1, savedAt: 9 })).toBe(true);
    expect(sameProfile({ a: 1 }, { a: 2 })).toBe(false);
  });
});

// ---- CloudSave with a fake Play Games plugin ----------------------------------------------------------------------------
const memStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const err = (code) => Object.assign(new Error(code), { code });

function fakePlugin({ available = true, authenticated = true, name = 'Dino Fan', cloud = null } = {}) {
  const f = {
    available, authenticated, name, cloud, offline: false, conflictOnce: false, saves: 0, loads: 0,
    async isAvailable() { return { available: f.available }; },
    async isAuthenticated() { if (f.offline) throw err('NETWORK'); return f.authenticated ? { authenticated: true, playerId: 'p1', displayName: f.name } : { authenticated: false }; },
    async signIn() { if (f.offline) throw err('NETWORK'); f.authenticated = true; return { authenticated: true, playerId: 'p1', displayName: f.name }; },
    async saveGame({ name: slot, data }) {
      if (!f.authenticated) throw err('NOT_AUTHENTICATED');
      if (f.offline) throw err('NETWORK');
      if (f.conflictOnce) { f.conflictOnce = false; throw err('CONFLICT'); }
      expect(slot).toBe(CLOUD_SLOT); f.cloud = data; f.saves++; return { saved: true };
    },
    async loadGame() { if (!f.authenticated) throw err('NOT_AUTHENTICATED'); if (f.offline) throw err('NETWORK'); f.loads++; return { data: f.cloud }; }
  };
  return f;
}

async function setup({ plugin = fakePlugin(), localProfile = null, t0 = 1_000_000 } = {}) {
  vi.setSystemTime(t0);
  const storage = memStorage();
  const local = createLocalSaveStore('k', storage);
  if (localProfile) await local.save(localProfile);
  const toasts = [], remote = [];
  const store = createCloudSaveStore({ local, games: wrapPlayGames(plugin), now: () => Date.now(), toast: (m) => toasts.push(m), onRemote: (p) => remote.push(p) });
  return { store, plugin, local, toasts, remote, advance: (ms) => vi.advanceTimersByTimeAsync(ms) };
}

describe('CloudSave', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('not available (web build / no App ID): local saves only, never touches the cloud', async () => {
    const plugin = fakePlugin({ available: false });
    const { store, local } = await setup({ plugin });
    const p = await store.load();
    expect(await store.start()).toMatchObject({ available: false, signedIn: false });
    await store.save({ ...p, level: 4 });
    expect((await local.load()).level).toBe(4);
    await vi.advanceTimersByTimeAsync(120000);
    expect(plugin.saves + plugin.loads).toBe(0);
  });

  it('a missing plugin counts as not available', async () => {
    const port = wrapPlayGames(null);
    expect(await port.available()).toEqual({ available: false });
    await expect(port.signIn()).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    expect(await (await createPlayGamesPort()).available()).toEqual({ available: false });   // node = not Android
  });

  it('not signed in: nothing is uploaded until Sign in; Sign in uploads this phone\'s save', async () => {
    const plugin = fakePlugin({ authenticated: false });
    const { store, advance } = await setup({ plugin });
    const p = await store.load();
    expect(await store.start()).toMatchObject({ available: true, signedIn: false });
    await store.save({ ...p, level: 3 });
    await advance(60000);
    expect(plugin.saves).toBe(0);
    expect(await store.signIn()).toMatchObject({ signedIn: true, name: 'Dino Fan' });
    await advance(5000);
    expect(plugin.saves).toBe(1);
    expect(JSON.parse(plugin.cloud).level).toBe(3);
  });

  it('uploads are throttled to one per 30 s and a burst becomes one upload', async () => {
    const { store, plugin, advance } = await setup({});
    let p = await store.load(); await store.start();
    await advance(5000); const base = plugin.saves;          // the first sync pushed this phone's save
    for (let i = 0; i < 5; i++) { p = { ...p, coins: p.coins + 1 }; await store.save(p); }
    await advance(1000); expect(plugin.saves).toBe(base);   // quiet period
    await advance(30000); expect(plugin.saves).toBe(base + 1);
    await store.save({ ...p, coins: 99 });
    await advance(10000); expect(plugin.saves).toBe(base + 1);   // < 30 s since the last upload
    await advance(25000); expect(plugin.saves).toBe(base + 2);
    expect(JSON.parse(plugin.cloud).coins).toBe(99);
  });

  it('offline: saves stay local, the upload is retried later, no progress lost', async () => {
    const { store, plugin, local, advance } = await setup({});
    const p = await store.load(); await store.start(); await advance(5000);
    plugin.offline = true;
    await store.save({ ...p, level: 9 });
    await advance(40000);
    expect((await local.load()).level).toBe(9);
    expect(JSON.parse(plugin.cloud).level).not.toBe(9);
    plugin.offline = false;
    await advance(40000);
    expect(JSON.parse(plugin.cloud).level).toBe(9);
  });

  it('offline at start: play goes on, status stays usable', async () => {
    const plugin = fakePlugin(); plugin.offline = true;
    const { store } = await setup({ plugin });
    await store.load();
    const s = await store.start();
    expect(s.available).toBe(true); expect(s.signedIn).toBe(false);
  });

  it('newer cloud copy: progress restored and merged, its wallet wins, toast shown', async () => {
    const cloudP = { ...newProfile(), level: 40, coins: 500, stars: { 1: 3, 39: 2 }, savedAt: 5_000_000 };
    const plugin = fakePlugin({ cloud: JSON.stringify(cloudP) });
    const { store, toasts, remote, local } = await setup({ plugin, localProfile: { ...newProfile(), level: 3, coins: 20, stars: { 1: 1, 2: 3 } } });
    await store.load();
    await store.start();
    expect(remote).toHaveLength(1);
    const m = remote[0];
    expect(m).toMatchObject({ level: 40, coins: 500, stars: { 1: 3, 2: 3, 39: 2 } });
    expect((await local.load()).level).toBe(40);
    expect(toasts).toContain(CLOUD_TOASTS.restored);
  });

  it('newer local copy: local wallet kept, cloud progress still merged in and pushed back up', async () => {
    const cloudP = { ...newProfile(), level: 10, coins: 500, stars: { 9: 3 }, savedAt: 10 };
    const plugin = fakePlugin({ cloud: JSON.stringify(cloudP) });
    const { store, remote, advance } = await setup({ plugin });
    let p = await store.load();
    await store.save({ ...p, level: 6, coins: 5, stars: { 5: 2 } });   // stamped now (1e6) > cloud's 10
    await store.start();
    expect(remote[0]).toMatchObject({ level: 10, coins: 5, stars: { 5: 2, 9: 3 } });
    await advance(5000);
    expect(JSON.parse(plugin.cloud)).toMatchObject({ level: 10, coins: 5, stars: { 5: 2, 9: 3 } });
  });

  it('cloud has nothing new: no restore, no toast', async () => {
    const plugin = fakePlugin();
    const { store, toasts, remote, advance } = await setup({ plugin });
    const p = await store.load();
    await store.save({ ...p, level: 7 });
    await store.start(); await advance(5000);        // first sync: cloud empty -> upload
    await store.syncNow();
    expect(remote).toHaveLength(0);
    expect(toasts).toEqual([CLOUD_TOASTS.saved]);
  });

  it('a conflict on upload is retried, never lost', async () => {
    const { store, plugin, advance } = await setup({});
    const p = await store.load(); await store.start(); await advance(5000);
    plugin.conflictOnce = true;
    await store.save({ ...p, level: 21 });
    await advance(35000);
    expect(JSON.parse(plugin.cloud).level).not.toBe(21);
    await advance(35000);
    expect(JSON.parse(plugin.cloud).level).toBe(21);
  });

  it('a corrupt cloud copy is ignored and replaced', async () => {
    const plugin = fakePlugin({ cloud: '{nope' });
    const { store, remote, advance } = await setup({ plugin, localProfile: { ...newProfile(), level: 5 } });
    await store.load(); await store.start(); await advance(5000);
    expect(remote).toHaveLength(0);
    expect(JSON.parse(plugin.cloud).level).toBe(5);
  });

  it('Sync now: pushes straight away and says so; offline says progress is on this phone', async () => {
    const { store, plugin, toasts } = await setup({});
    const p = await store.load(); await store.start();
    await store.save({ ...p, level: 8 });
    expect(await store.syncNow()).toBe(true);
    expect(JSON.parse(plugin.cloud).level).toBe(8);
    expect(toasts.at(-1)).toBe(CLOUD_TOASTS.saved);
    plugin.offline = true;
    expect(await store.syncNow()).toBe(false);
    expect(toasts.at(-1)).toBe(CLOUD_TOASTS.offline);
  });

  it('signed out elsewhere (NOT_AUTHENTICATED): status goes to signed out, no retry loop', async () => {
    const { store, plugin, advance } = await setup({});
    const p = await store.load(); await store.start(); await advance(5000);
    plugin.authenticated = false;
    await store.save({ ...p, level: 2 });
    await advance(35000);
    expect(store.status().signedIn).toBe(false);
    const saves = plugin.saves; await advance(120000); expect(plugin.saves).toBe(saves);
  });

  it('flush on going to the background uploads pending progress (respecting the throttle)', async () => {
    const { store, plugin, advance } = await setup({});
    const p = await store.load(); await store.start(); await advance(35000);
    const n = plugin.saves;
    await store.save({ ...p, level: 13 });
    await store.flush();
    expect(plugin.saves).toBe(n + 1);
    expect(JSON.parse(plugin.cloud).level).toBe(13);
  });

  it('subscribers see sign-in status changes', async () => {
    const { store } = await setup({ plugin: fakePlugin({ authenticated: false }) });
    const seen = []; const off = store.subscribe((s) => seen.push(s.signedIn));
    await store.load(); await store.start(); await store.signIn(); off();
    expect(seen).toContain(false); expect(seen.at(-1)).toBe(true);
  });
});

// ---- Settings row ------------------------------------------------------------------------------------------------------
describe('Settings > Google Play Games row', () => {
  it('hidden when Play Games is not available', () => {
    expect(playGamesRowModel({ available: false })).toBeNull();
    expect(playGamesRowModel(null)).toBeNull();
  });
  it('signed out: a Sign in button', () => {
    const m = playGamesRowModel({ available: true, signedIn: false });
    expect(m.title).toBe('Google Play Games');
    expect(m.action).toMatchObject({ id: 'pg-signin', label: 'Sign in', kind: 'signIn' });
  });
  it('signed in: player name, "Cloud save on" and Sync now (disabled while syncing)', () => {
    const m = playGamesRowModel({ available: true, signedIn: true, name: 'Dino Fan' });
    expect(m.lines).toEqual(['Signed in as Dino Fan', 'Cloud save on']);
    expect(m.action).toMatchObject({ id: 'pg-sync', label: 'Sync now', kind: 'syncNow', disabled: false });
    expect(playGamesRowModel({ available: true, signedIn: true, syncing: true }).action).toMatchObject({ label: 'Syncing', disabled: true });
    expect(playGamesRowModel({ available: true, signedIn: true }).lines[0]).toBe('Signed in');
  });
});

void CONFIG;
