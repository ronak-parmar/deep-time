// M8: specials from level 1 (taught when first made) and the in-context onboarding rules (core/coach.js).
import { describe, it, expect } from 'vitest';
import { generateLevel } from '../src/core/level.js';
import { createState, swap } from '../src/core/game.js';
import { setupTest } from '../src/core/testboards.js';
import { KINDS } from '../src/core/specials.js';
import { CONFIG } from '../src/core/config.js';
import { INTROS, markIntroSeen, introsFor } from '../src/data/intros.js';
import { tutorialMove } from '../src/core/tutorial.js';
import { newProfile, migrateProfile } from '../src/core/profile.js';
import { firstMade, coachNeeded, markCoach, skipCoach, swapAllowed, adjacentSpecials, cellOf, normaliseCoach } from '../src/core/coach.js';
import { HELLO, MEET, COACH, COACH_STEPS } from '../src/data/yuvi.js';
import { ACTIONS } from '../src/ui/yuvi.js';
import { FOSSILS } from '../src/core/fossils.js';

// a level-1 board rigged by the debug test boards, but with the specials LEVEL 1 itself allows (not the test board's "all")
function level1(name) {
  const cfg = generateLevel(1), s = createState({ ...cfg, w: 7, h: 7 }), t = setupTest(s, name);
  s.specials = cfg.specials.slice();
  return { s, t };
}
const made = (name) => { const { s, t } = level1(name); const r = swap(s, ...t.swap); return { s, r, create: r.events.find((e) => e.t === 'create') }; };

describe('specials work from level 1', () => {
  it('every special kind is unlocked on every level, from level 1', () => {
    for (const k of KINDS) expect(CONFIG.specials.unlock[k], k).toBe(1);
    for (const n of [1, 2, 3, 5, 9, 10]) expect(generateLevel(n).specials, 'level ' + n).toEqual(KINDS);
  });
  it('a 4-in-a-row on level 1 creates a Firecracker', () => { const { create } = made('firecracker'); expect(create?.s).toBe('firecracker'); });
  it('5 in a straight line on level 1 creates a Rainbow gem', () => { const { create } = made('rainbow'); expect(create?.s).toBe('rainbow'); });
  it('an L or a T on level 1 creates a Bomb', () => { expect(made('bomb-l').create?.s).toBe('bomb'); expect(made('bomb-t').create?.s).toBe('bomb'); });
  it('the hand-made early levels (1-10) still generate, start with a legal move, and level 1 has a guided 3-match', () => {
    for (let n = 1; n <= 10; n++) { const s = createState(generateLevel(n)); expect(s.w * s.h, 'level ' + n).toBeGreaterThan(0); expect(s.moves).toBeGreaterThan(0); }
    expect(tutorialMove(createState(generateLevel(1)), { size: 3 })).toBeTruthy();
  });
  it('intro data no longer ties specials to a level: no level-start card, they are events taught when made', () => {
    for (const k of KINDS) { expect(INTROS[k].first, k).toBe(null); expect(INTROS[k].event, k).toBe(true); }
    for (let n = 1; n <= 60; n++) expect(introsFor(newProfile(), generateLevel(n)).some((e) => KINDS.includes(e.id)), 'level ' + n).toBe(false);
  });
});

describe('first special made: the explain event fires once per kind', () => {
  it('fires for a new kind, not again once seen, and not for another move making the same kind', () => {
    let p = newProfile();
    const { r } = made('firecracker');
    const f = firstMade(p, r.events); expect(f).toMatchObject({ kind: 'firecracker' });
    p = markIntroSeen(p, f.kind);
    expect(firstMade(p, r.events)).toBe(null);
    expect(firstMade(p, made('firecracker').r.events)).toBe(null);
    expect(firstMade(p, made('bomb-l').r.events)).toMatchObject({ kind: 'bomb' });   // a different kind still gets its turn
  });
  it('is off when the player skipped the tutorial; the made piece can be found after the cascade', () => {
    const { s, r } = made('firecracker'), f = firstMade(newProfile(), r.events);
    expect(firstMade(skipCoach(newProfile()), r.events)).toBe(null);
    expect(s.cells[cellOf(s, f.id)].s).toBe('firecracker');
    expect(COACH.special.firecracker('h')).toMatch(/row/); expect(COACH.special.firecracker('v')).toMatch(/column/);
    for (const k of KINDS) expect(COACH.special[k](), k).toBeTruthy();
  });
});

describe('coach steps', () => {
  it('first launch is two bubbles: wave hello, then point at level 1 and wait for the tap on it', () => {
    expect(HELLO.length).toBe(2); expect(HELLO[0].action).toBe('wave'); expect(HELLO[1]).toMatchObject({ action: 'point', wait: 'action', spot: 'node1' });
    for (const s of [...HELLO, ...MEET]) expect(ACTIONS).toContain(s.action);
  });
  it('each step runs once, and Skip turns the rest off', () => {
    let p = newProfile(); for (const id of COACH_STEPS) expect(coachNeeded(p, id), id).toBe(true);
    p = markCoach(p, 'goal'); expect(coachNeeded(p, 'goal')).toBe(false); expect(coachNeeded(p, 'swap')).toBe(true);
    expect(coachNeeded(skipCoach(p), 'swap')).toBe(false);
    expect(normaliseCoach({ done: ['goal', 'nonsense'] }).done).toEqual(['goal']);
  });
  it('a guided step only lets the wanted swap through', () => {
    expect(swapAllowed(null, 1, 2)).toBe(true);
    expect(swapAllowed({ pair: [3, 4] }, 4, 3)).toBe(true); expect(swapAllowed({ pair: [3, 4] }, 3, 10)).toBe(false);
    expect(swapAllowed({ cell: 7 }, 7, 8)).toBe(true); expect(swapAllowed({ cell: 7 }, 1, 2)).toBe(false);
  });
  it('finds two specials side by side (the combo step)', () => {
    const { s } = made('firecracker'), i = s.cells.findIndex((c) => c && c.s);
    expect(adjacentSpecials(s)).toBe(null);
    const j = i % s.w + 1 < s.w ? i + 1 : i - 1; s.cells[j] = { ...s.cells[j], s: 'bomb' };
    expect(adjacentSpecials(s).sort((a, b) => a - b)).toEqual([i, j].sort((a, b) => a - b));
  });
  it('migration: a save that saw the old welcome keeps "hello" done and still gets every in-context step it has not done', () => {
    const q = migrateProfile({ v: 3, level: 40, stars: { 1: 3, 2: 3 }, yuvi: { welcomeSeen: true, met: true, islands: 1 } });
    expect(q.coach.done).toEqual(expect.arrayContaining(['hello', 'goal', 'swap']));
    for (const id of ['moves', 'combo', 'pickaxe', 'dig', 'museum']) expect(coachNeeded(q, id), id).toBe(true);
    const dug = migrateProfile({ v: 3, level: 80, stars: { 1: 1 }, fossilProgress: { [FOSSILS[0].id]: 3 }, yuvi: { welcomeSeen: true } });
    expect(coachNeeded(dug, 'dig')).toBe(false); expect(coachNeeded(dug, 'pickaxe')).toBe(false);
    expect(migrateProfile({ v: 2, level: 1 }).coach).toEqual({ off: false, done: [] });   // a new player gets everything
    expect(migrateProfile(JSON.parse(JSON.stringify(markCoach(newProfile(), 'moves')))).coach.done).toEqual(['moves']);
  });
});
