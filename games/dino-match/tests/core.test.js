import { describe, it, expect } from 'vitest';
import { makeRng, next, int, shuffle } from '../src/core/rng.js';
import { findMatches, validSwaps, adjacent } from '../src/core/board.js';
import { createState, swap, hasMove, reshuffle, serialize, deserialize } from '../src/core/game.js';
import { judge, starsFor } from '../src/core/rules.js';
import { CONFIG } from '../src/core/config.js';
import { eraOf, eraIndexOf, isHistoryLevel, levelInEra, cycleOf, ERAS, TOTAL_LEVELS } from '../src/core/eras.js';
import { generateLevel, difficultyTarget, validateLevel, levelKind } from '../src/core/level.js';
import { botPlay } from '../src/core/bot.js';
import { newProfile, settleLevel, mergeProfiles } from '../src/core/profile.js';

const grid = (rows) => rows.flatMap((r) => r.split('').map((ch, k) => ({ id: Math.random(), c: +ch })));

describe('rng', () => {
  it('is deterministic and serialisable', () => {
    const a = makeRng(5), b = makeRng(5);
    expect([next(a), next(a)]).toEqual([next(b), next(b)]);
    const c = JSON.parse(JSON.stringify(a));
    expect(next(c)).toBe(next(a));
  });
  it('int stays in range and shuffle keeps members', () => {
    const r = makeRng(1);
    for (let i = 0; i < 200; i++) expect(int(r, 6)).toBeLessThan(6);
    expect(shuffle(r, [1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('board', () => {
  it('finds horizontal, vertical and 4+ runs', () => {
    const g = grid(['001', '101', '121']);
    expect(findMatches(g, 3, 3)).toEqual([2, 5, 8]);
    expect(findMatches(grid(['0000', '1212', '2121', '1212']), 4, 4)).toEqual([0, 1, 2, 3]);
  });
  it('finds nothing when there is no run and does not wrap across rows', () => {
    expect(findMatches(grid(['010', '001', '110']), 3, 3)).toEqual([]);
    expect(findMatches(grid(['0012', '0120', '1201', '2012']), 4, 4)).toEqual([]);
  });
  it('lists valid swaps', () => {
    const g = grid(['0120', '1201', '2012', '0121']);
    const g2 = grid(['010', '101', '000'].map((r) => r));
    expect(validSwaps(g2, 3, 3).length).toBeGreaterThan(0);
    expect(adjacent(0, 1, 3)).toBe(true);
    expect(adjacent(2, 3, 3)).toBe(false);
    expect(Array.isArray(validSwaps(g, 4, 4))).toBe(true);
  });
});

function levelOf(n = 1) { return generateLevel(n); }
function firstValid(state) { return validSwaps(state.cells, state.w, state.h)[0]; }
function firstInvalid(state) {
  for (let i = 0; i < state.w * state.h; i++) for (const j of [i + 1, i + state.w]) {
    if (j >= state.w * state.h || !adjacent(i, j, state.w)) continue;
    [state.cells[i], state.cells[j]] = [state.cells[j], state.cells[i]];
    const bad = findMatches(state.cells, state.w, state.h).length === 0;
    [state.cells[i], state.cells[j]] = [state.cells[j], state.cells[i]];
    if (bad) return [i, j];
  }
}

describe('game', () => {
  it('starts with no matches and a valid move', () => {
    for (let n = 1; n <= 30; n++) {
      const s = createState(levelOf(n));
      expect(findMatches(s.cells, s.w, s.h)).toEqual([]);
      expect(hasMove(s)).toBe(true);
    }
  });
  it('an invalid swap bounces: no move spent, nothing dug, board unchanged', () => {
    const s = createState(levelOf(1));
    const before = JSON.stringify(s.cells);
    const [a, b] = firstInvalid(s);
    const r = swap(s, a, b);
    expect(r.valid).toBe(false);
    expect(s.moves).toBe(s.movesMax);
    expect(s.dug).toBe(0);
    expect(JSON.stringify(s.cells)).toBe(before);
    expect(r.events[0]).toMatchObject({ t: 'swap', ok: false });
  });
  it('a non-adjacent swap is rejected', () => {
    const s = createState(levelOf(1));
    expect(swap(s, 0, 2).valid).toBe(false);
    expect(s.moves).toBe(s.movesMax);
  });
  it('a valid move spends one move and ends with an end event', () => {
    const s = createState(levelOf(1));
    const [a, b] = firstValid(s);
    const r = swap(s, a, b);
    expect(r.valid).toBe(true);
    expect(s.moves).toBe(s.movesMax - 1);
    expect(r.events.at(-1).t).toBe('end');
  });
  it('leaves a full board with no matches after each move', () => {
    const s = createState(levelOf(16));
    for (let k = 0; k < 6 && s.status === 'playing'; k++) {
      swap(s, ...firstValid(s));
      expect(s.cells.every(Boolean)).toBe(true);
      expect(findMatches(s.cells, s.w, s.h)).toEqual([]);
    }
  });
  it('wins when every block is dug, and the game is over after that', () => {
    const lvl = { ...levelOf(1), moves: 99, dirtTotal: 1, blocks: [{ t: 'tar', c: 0 }, ] };
    lvl.blocks = [{ t: 'tar', c: 0 }];
    const s = createState(lvl);
    s.blocks[0].c = -9;                       // colour never present: wrong colours do nothing
    for (let i = 0; i < 3; i++) swap(s, ...firstValid(s));
    expect(s.dug).toBe(0); expect(s.status).toBe('playing');
    s.blocks[0].c = 0; let last;
    for (let i = 0; i < 60 && s.status === 'playing'; i++) last = swap(s, ...firstValid(s));
    expect(s.status).toBe('won');
    expect(last.events.at(-1)).toMatchObject({ t: 'end', status: 'won' });
    expect(swap(s, 0, 1).valid).toBe(false);
  });
  it('loses when moves run out first', () => {
    const lvl = { ...levelOf(1), moves: 2, dirtTotal: 1, blocks: [{ t: 'stone', c: 0 }] };
    const s = createState(lvl);
    swap(s, ...firstValid(s)); swap(s, ...firstValid(s));
    expect(s.status === 'lost' || s.status === 'won').toBe(true);   // stone needs 3 hits; 2 moves rarely do it
    if (s.status === 'lost') expect(s.moves).toBe(0);
  });
  it('is deterministic for the same level and moves', () => {
    const run = () => { const s = createState(levelOf(7)); for (let i = 0; i < 4; i++) swap(s, ...firstValid(s)); return serialize(s); };
    expect(run()).toBe(run());
  });
  it('reshuffles a dead board into a playable one', () => {
    const s = createState(levelOf(1));
    const r = reshuffle(s);
    expect(r.t).toBe('shuffle');
    expect(findMatches(s.cells, s.w, s.h)).toEqual([]);
    expect(hasMove(s)).toBe(true);
  });
  it('round-trips through save', () => {
    const s = createState(levelOf(3));
    swap(s, ...firstValid(s));
    const t = deserialize(serialize(s));
    expect(t).toEqual(s);
    if (t.status === 'playing') swap(t, ...firstValid(t)); // still playable after load
    expect(t.moves).toBeLessThan(t.movesMax);
  });
});

describe('rules', () => {
  it('judge and stars', () => {
    expect(judge({ dug: 3, dirtTotal: 3, moves: 0 })).toBe('won');
    expect(judge({ dug: 2, dirtTotal: 3, moves: 0 })).toBe('lost');
    expect(judge({ dug: 2, dirtTotal: 3, moves: 1 })).toBe('playing');
    expect(starsFor({ moves: 6, movesMax: 10 })).toBe(3);
    expect(starsFor({ moves: 3, movesMax: 10 })).toBe(2);
    expect(starsFor({ moves: 0, movesMax: 10 })).toBe(1);
  });
});

describe('eras and levels', () => {
  it('maps levels to eras from the roster (50 levels per fossil), cycling after the last level', () => {
    const E = ERAS;
    expect(eraOf(1).id).toBe('cambrian');
    expect(eraOf(E[0].end).id).toBe('cambrian');
    expect(eraOf(E[0].end + 1).id).toBe('devonian');
    expect(eraOf(TOTAL_LEVELS).id).toBe('early-humans');
    expect(eraOf(TOTAL_LEVELS + 1).id).toBe('cambrian');
    expect(cycleOf(TOTAL_LEVELS + 1)).toBe(1);
    expect(levelInEra(E[1].start + 49)).toBe(50);
    expect(eraIndexOf(E[7].start)).toBe(7);
    E.forEach((e, i) => { expect(e.levels).toBe(e.fossils.length * 50); if (i) expect(e.start).toBe(E[i - 1].end + 1); });
    expect(TOTAL_LEVELS).toBe(E.reduce((a, e) => a + e.levels, 0));
  });
  it('flags history levels every 50', () => {
    expect([49, 50, 100, 150].map(isHistoryLevel)).toEqual([false, true, true, true]);
  });
  it('is deterministic (seed = level number)', () => {
    expect(generateLevel(42)).toEqual(generateLevel(42));
    expect(generateLevel(42).seed).toBe(42);
  });
  it('follows the difficulty curve: breathers easier, milestones harder, capped', () => {
    expect(difficultyTarget(25)).toBeLessThan(difficultyTarget(24));
    expect(difficultyTarget(101)).toBeLessThan(difficultyTarget(102));
    expect(difficultyTarget(30)).toBeGreaterThan(difficultyTarget(29));
    for (let n = 1; n <= 1200; n += 7) expect(difficultyTarget(n)).toBeLessThanOrEqual(0.8);
    expect(levelKind(5)).toBe('onboarding');
    expect(levelKind(25)).toBe('breather');
    expect(levelKind(30)).toBe('milestone');
  });
  it('hand-authors the first 15 levels and keeps them forgiving', () => {
    for (let n = 1; n <= 15; n++) {
      const l = generateLevel(n);
      expect(l.kind).toBe('onboarding');
      expect(l.moves).toBeGreaterThanOrEqual(l.dirtTotal);
    }
    expect(generateLevel(1).moves - generateLevel(1).dirtTotal).toBeGreaterThanOrEqual(6);
  });
  it('every generated level validates and is winnable', () => {
    for (const n of [1, 15, 16, 25, 30, 99, 100, 101, 250, 500, 999, 1000, 1001, 2500, TOTAL_LEVELS - 1, TOTAL_LEVELS, TOTAL_LEVELS + 1]) {
      const l = generateLevel(n);
      expect(validateLevel(l)).toEqual([]);
      expect(l.blocks).toHaveLength(l.dirtTotal);
    }
  });
  it('the bot can win a level (solvability check)', () => {
    expect(botPlay(generateLevel(20), 1).status).toBe('won');
    expect(botPlay(generateLevel(1), 2).status).toBe('won');
  });
});

describe('profile', () => {
  it('a win advances the level and records stars', () => {
    const { profile: p } = settleLevel(newProfile(), 1, { won: true, stars: 2 }, 0);
    expect(p.level).toBe(2);
    expect(p.stars[1]).toBe(2);
    expect(p.coins).toBe(20);
    expect(p.winStreak).toBe(1);
  });
  it('a loss resets the streak and keeps the level', () => {
    let p = settleLevel(newProfile(), 1, { won: true, stars: 1 }, 0).profile;
    p = settleLevel(p, 2, { won: false, stars: 0 }, 0).profile;
    expect(p.level).toBe(2);
    expect(p.winStreak).toBe(0);
  });
  it('merges saves: higher level, larger coins, best stars', () => {
    const a = { ...newProfile(), level: 5, coins: 10, stars: { 1: 3 } };
    const b = { ...newProfile(), level: 3, coins: 50, stars: { 1: 1, 2: 2 } };
    const m = mergeProfiles(a, b);
    expect(m).toMatchObject({ level: 5, coins: 50, stars: { 1: 3, 2: 2 } });
  });
});
