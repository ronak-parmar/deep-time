import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/core/config.js';
import { newProfile, migrateProfile, settleLevel, winRewards, doubleCoins, spendCoins, mergeProfiles, PROFILE_VERSION } from '../src/core/profile.js';
import { syncLives, loseLife, nextLifeIn, canStartLevel, refillLives } from '../src/core/lives.js';
import { FOSSILS, currentFossil, digPart, partOrder, partsUnearthed } from '../src/core/fossils.js';
import { nearMissOffer } from '../src/core/rules.js';
import { createState, addMoves } from '../src/core/game.js';
import { generateLevel } from '../src/core/level.js';

const MIN = 60 * 1000;
const T0 = 1_700_000_000_000;
const REGEN = CONFIG.lives.regenMinutes * MIN;
const win = (p, lvl, stars = 1, now = T0) => settleLevel(p, lvl, { won: true, stars }, now);
const lose = (p, lvl, now = T0) => settleLevel(p, lvl, { won: false, stars: 0 }, now);

describe('pickaxes and coins on a win', () => {
  it('first win of a level gives +1 pickaxe and coins', () => {
    const { profile, rewards } = win(newProfile(), 1, 2);
    expect(rewards).toMatchObject({ firstWin: true, pickaxes: 1, coins: CONFIG.coins.win + 2 * CONFIG.coins.perStar });
    expect(profile.pickaxes).toBe(1);
    expect(profile.coins).toBe(rewards.coins);
  });
  it('a replay of a won level gives no pickaxe (coins still paid)', () => {
    const first = win(newProfile(), 1).profile;
    const { profile, rewards } = win(first, 1);
    expect(rewards.firstWin).toBe(false);
    expect(rewards.pickaxes).toBe(0);
    expect(profile.pickaxes).toBe(1);
    expect(profile.coins).toBeGreaterThan(first.coins);
  });
  it('winRewards does not change the profile', () => {
    const p = newProfile();
    winRewards(p, 1, 3);
    expect(p.pickaxes).toBe(0);
  });
  it('coin amounts come from config', () => {
    CONFIG.coins.win = 100;
    expect(win(newProfile(), 1, 1).rewards.coins).toBe(100 + CONFIG.coins.perStar);
    CONFIG.coins.win = 10;
  });
  it('double coins pays the win coins once more', () => {
    const { profile, rewards } = win(newProfile(), 1, 3);
    expect(doubleCoins(profile, rewards.coins).coins).toBe(rewards.coins * 2);
  });
  it('spendCoins refuses when short and charges when enough', () => {
    expect(spendCoins({ ...newProfile(), coins: 10 }, 50)).toBeNull();
    expect(spendCoins({ ...newProfile(), coins: 80 }, 50).coins).toBe(30);
  });
});

describe('lives with an injected clock', () => {
  it('a loss costs exactly one life and starts the timer', () => {
    const { profile, rewards } = lose(newProfile(), 1);
    expect(rewards.lifeLost).toBe(true);
    expect(profile.lives).toBe(CONFIG.lives.max - 1);
    expect(profile.lastLifeTimestamp).toBe(T0);
  });
  it('a win costs nothing', () => {
    expect(win(newProfile(), 1).profile.lives).toBe(CONFIG.lives.max);
  });
  it('never goes below zero and blocks starting a level at zero', () => {
    let p = newProfile();
    for (let i = 0; i < 8; i++) p = lose(p, 1).profile;
    expect(p.lives).toBe(0);
    expect(canStartLevel(p, T0)).toBe(false);
  });
  it('regenerates one life per interval, computed from timestamps', () => {
    let p = newProfile();
    for (let i = 0; i < 5; i++) p = lose(p, 1, T0).profile;
    expect(p.lives).toBe(0);
    expect(syncLives(p, T0 + REGEN - 1).lives).toBe(0);
    expect(syncLives(p, T0 + REGEN).lives).toBe(1);
    expect(syncLives(p, T0 + 2 * REGEN + 5).lives).toBe(2);
    expect(canStartLevel(p, T0 + REGEN)).toBe(true);
  });
  it('works across a reload (only the stored profile and a later time are needed)', () => {
    let p = newProfile();
    for (let i = 0; i < 3; i++) p = lose(p, 1, T0).profile;
    const reloaded = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(syncLives(reloaded, T0 + 2 * REGEN).lives).toBe(4);
  });
  it('caps at max, clears the timer, and keeps leftover time toward the next life', () => {
    let p = lose(newProfile(), 1, T0).profile; // 4 lives
    expect(syncLives(p, T0 + 10 * REGEN)).toMatchObject({ lives: CONFIG.lives.max, lastLifeTimestamp: null });
    for (let i = 0; i < 2; i++) p = lose(p, 1, T0).profile; // 2 lives
    const q = syncLives(p, T0 + REGEN + 7 * MIN);
    expect(q.lives).toBe(3);
    expect(nextLifeIn(q, T0 + REGEN + 7 * MIN)).toBe(REGEN - 7 * MIN);
  });
  it('a loss after partial regeneration does not reset the running clock', () => {
    let p = lose(newProfile(), 1, T0).profile;
    p = lose(p, 1, T0 + 10 * MIN).profile;
    expect(p.lives).toBe(3);
    expect(p.lastLifeTimestamp).toBe(T0);
  });
  it('nextLifeIn is null when full; clock going backwards restarts the timer safely', () => {
    expect(nextLifeIn(newProfile(), T0)).toBeNull();
    const p = lose(newProfile(), 1, T0).profile;
    expect(syncLives(p, T0 - 5 * MIN).lastLifeTimestamp).toBe(T0 - 5 * MIN);
  });
  it('the regeneration time is config-driven', () => {
    CONFIG.lives.regenMinutes = 30;
    const p = lose(newProfile(), 1, T0).profile;
    expect(syncLives(p, T0 + 25 * MIN).lives).toBe(4);
    expect(syncLives(p, T0 + 30 * MIN).lives).toBe(5);
    CONFIG.lives.regenMinutes = 25;
  });
  it('refill restores all lives', () => {
    let p = newProfile();
    for (let i = 0; i < 5; i++) p = lose(p, 1).profile;
    expect(refillLives(p)).toMatchObject({ lives: CONFIG.lives.max, lastLifeTimestamp: null });
  });
});

describe('fossils', () => {
  const rich = (n) => ({ ...newProfile(), pickaxes: n });
  it('has 20 fossils, 2 per era, Cambrian names from the emblem list', () => {
    expect(FOSSILS).toHaveLength(20);
    expect(FOSSILS.slice(0, 2).map((f) => f.name)).toEqual(['Anomalocaris', 'Trilobite']);
    expect(FOSSILS[2].eraIndex).toBe(1);
    expect(FOSSILS[19].eraIndex).toBe(9);
  });
  it('a part costs the configured pickaxes', () => {
    const r = digPart(rich(7));
    expect(r.ok).toBe(true);
    expect(r.profile.pickaxes).toBe(7 - CONFIG.fossils.pickaxesPerPart);
    expect(partsUnearthed(r.profile, FOSSILS[0].id)).toBe(1);
  });
  it('refuses to dig without enough pickaxes and changes nothing', () => {
    const p = rich(CONFIG.fossils.pickaxesPerPart - 1);
    expect(digPart(p)).toEqual({ ok: false, reason: 'not-enough-pickaxes' });
  });
  it('the part cost is config-driven', () => {
    CONFIG.fossils.pickaxesPerPart = 2;
    expect(digPart(rich(2)).ok).toBe(true);
    CONFIG.fossils.pickaxesPerPart = 5;
  });
  it('the 10th part completes the fossil and moves on to the next one', () => {
    let p = rich(5 * 10), last;
    for (let i = 0; i < 10; i++) { last = digPart(p); expect(last.ok).toBe(true); expect(last.completed).toBe(i === 9); p = last.profile; }
    expect(p.completedFossils).toEqual([FOSSILS[0].id]);
    expect(p.pickaxes).toBe(0);
    expect(currentFossil(p).id).toBe(FOSSILS[1].id);
    expect(partsUnearthed(p, FOSSILS[0].id)).toBe(10);
  });
  it('reveal order covers every part exactly once', () => {
    expect(partOrder(FOSSILS[0].id).slice().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(partOrder(FOSSILS[0].id)).toEqual(partOrder(FOSSILS[0].id));
  });
  it('reports all-complete after the last fossil', () => {
    const p = { ...rich(50), completedFossils: FOSSILS.map((f) => f.id) };
    expect(currentFossil(p)).toBeNull();
    expect(digPart(p)).toEqual({ ok: false, reason: 'all-complete' });
  });
  it('50 first-time wins fund exactly one fossil', () => {
    let p = newProfile();
    for (let l = 1; l <= 50; l++) p = win(p, l).profile;
    expect(p.pickaxes).toBe(50);
    for (let i = 0; i < 10; i++) p = digPart(p).profile;
    expect(p.completedFossils).toHaveLength(1);
  });
});

describe('near-miss offer', () => {
  const lost = (dug) => { const s = createState(generateLevel(6)); s.status = 'lost'; s.moves = 0; s.dug = dug; return s; };
  it('is offered within 2 blocks of done', () => {
    const s = lost(0); s.dug = s.dirtTotal - 2;
    expect(nearMissOffer(s)).toEqual({ extraMoves: 5, coinCost: 50, blocksLeft: 2 });
    s.dug = s.dirtTotal - 1;
    expect(nearMissOffer(s).blocksLeft).toBe(1);
  });
  it('is not offered further away, while playing, or after it was used', () => {
    const s = lost(0); s.dug = s.dirtTotal - 3;
    expect(nearMissOffer(s)).toBeNull();
    s.dug = s.dirtTotal - 1; s.status = 'playing';
    expect(nearMissOffer(s)).toBeNull();
    s.status = 'lost'; s.extended = 1;
    expect(nearMissOffer(s)).toBeNull();
  });
  it('the distance is config-driven', () => {
    CONFIG.nearMiss.blocks = 3;
    const s = lost(0); s.dug = s.dirtTotal - 3;
    expect(nearMissOffer(s)).not.toBeNull();
    CONFIG.nearMiss.blocks = 2;
  });
  it('accepting gives +5 moves and puts the level back in play (no life lost)', () => {
    const s = lost(0); s.dug = s.dirtTotal - 2;
    addMoves(s, 5);
    expect(s.moves).toBe(5);
    expect(s.status).toBe('playing');
    s.moves = 0; s.status = 'lost';
    expect(nearMissOffer(s)).toBeNull(); // only once per attempt
  });
});

describe('profile migration', () => {
  it('upgrades a v1 save: keeps progress, grants a pickaxe per won level, full lives', () => {
    const v1 = { v: 1, level: 4, coins: 77, stars: { 1: 3, 2: 2, 3: 1 }, winStreak: 3, boosters: { pick: 2, burst: 1, brush: 1 }, settings: { consent: null, reducedMotion: null } };
    const p = migrateProfile(v1);
    expect(p.v).toBe(PROFILE_VERSION);
    expect(p).toMatchObject({ level: 4, coins: 77, pickaxes: 3, lives: CONFIG.lives.max, lastLifeTimestamp: null, fossilProgress: {}, completedFossils: [] });
    expect(p.stars).toEqual(v1.stars);
  });
  it('keeps a v2 save as is and is idempotent', () => {
    const p = { ...newProfile(), pickaxes: 9, lives: 2, lastLifeTimestamp: T0, fossilProgress: { 'cambrian-1': 4 }, completedFossils: ['x'] };
    expect(migrateProfile(p)).toEqual(p);
    expect(migrateProfile(migrateProfile(p))).toEqual(p);
  });
  it('survives garbage and clamps bad numbers', () => {
    expect(migrateProfile(null)).toEqual(newProfile());
    expect(migrateProfile('nope')).toEqual(newProfile());
    const p = migrateProfile({ v: 2, lives: 99, coins: -5, pickaxes: 'x', level: 0 });
    expect(p).toMatchObject({ lives: CONFIG.lives.max, coins: 0, pickaxes: 0, level: 1 });
  });
  it('merging two saves keeps the best of both', () => {
    const a = { ...newProfile(), level: 5, pickaxes: 3, fossilProgress: { f: 4 }, completedFossils: ['a'] };
    const b = { ...newProfile(), level: 9, pickaxes: 1, fossilProgress: { f: 7, g: 1 }, completedFossils: ['b'] };
    const m = mergeProfiles(a, b);
    expect(m).toMatchObject({ level: 9, pickaxes: 3, fossilProgress: { f: 7, g: 1 } });
    expect(m.completedFossils.sort()).toEqual(['a', 'b']);
  });
});

import { ERAS } from '../src/core/eras.js';
import { THEMES, THEME_FIELDS, themeFor, hudColors } from '../src/render/eraTheme.js';
import { contrast } from '../src/render/util.js';
describe('era themes', () => {
  it('every era id (and art-folder alias) has a complete theme', () => {
    for (const e of ERAS) {
      const t = THEMES[e.id];
      expect(t, e.id).toBeTruthy();
      for (const f of THEME_FIELDS) expect(t[f], `${e.id}.${f}`).toBeDefined();
      for (const k of ['base', 'light', 'dark', 'edge', 'accent', 'accent2']) expect(t.palette[k]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(themeFor(e.dir).id).toBe(e.id);
    }
    expect(Object.keys(THEMES)).toHaveLength(ERAS.length);
  });
  it('HUD plates keep the design-system text colour readable (4.5:1) in every era', () => {
    for (const e of ERAS) { const h = hudColors(themeFor(e.id)); expect(contrast('#F2F8FF', h.top)).toBeGreaterThan(4.5); expect(contrast('#9DB4CF', h.bottom)).toBeGreaterThan(4.5); }
  });
  it('board floors stay dark so the six gem colours read', () => {
    for (const e of ERAS) expect(contrast('#F2F8FF', themeFor(e.id).interior)).toBeGreaterThan(12);
  });
});
