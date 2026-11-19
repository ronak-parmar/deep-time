import { describe, it, expect } from 'vitest';
import { createState, swap } from '../src/core/game.js';
import { generateLevel } from '../src/core/level.js';
import { goalLeft, targetProgress } from '../src/core/targets.js';
import { HOLD, D } from '../src/render/motion.js';

// M10 bug: with 2 left and 3 cleared the HUD never showed 0; the win screen just appeared.
function board(targets) {
  const s = createState({ ...generateLevel(40), w: 7, h: 7 });
  s.obst = new Array(49).fill(null); s.blocks = []; s.dirtTotal = 0; s.dug = 0;
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) s.cells[y * 7 + x] = { id: 1000 + y * 7 + x, c: (x + 2 * y) % 5 };
  s.targets = targets; s.moves = 10; s.status = 'playing';
  // a ready 3-match of colour 4 on the bottom row: (2,6) (3,6) + (4,5) swapped down into (4,6)
  s.cells[44] = { id: 1, c: 4 }; s.cells[45] = { id: 2, c: 4 }; s.cells[39] = { id: 3, c: 4 }; s.cells[46] = { id: 4, c: 0 };
  return s;
}
describe('goal counter (M10)', () => {
  it('the HUD count is clamped: never negative, 0 when more than needed were cleared', () => {
    expect(goalLeft(5, 3)).toBe(2); expect(goalLeft(5, 5)).toBe(0); expect(goalLeft(5, 7)).toBe(0); expect(goalLeft(2, -1)).toBe(2); expect(goalLeft(3, undefined)).toBe(3);
  });
  it('2 left, 3 cleared: a targets event takes the count to 0 BEFORE the end event (and the level is won)', () => {
    const s = board([{ type: 'collect', c: 4, n: 5, got: 3 }]);
    const r = swap(s, 39, 46);
    expect(r.valid).toBe(true);
    const ti = r.events.findIndex((e) => e.t === 'targets' && e.left[0] === 0), ei = r.events.findIndex((e) => e.t === 'end');
    expect(ti).toBeGreaterThanOrEqual(0); expect(ei).toBeGreaterThan(ti);
    expect(r.events[ei].status).toBe('won');
    expect(r.events[ti].got[0]).toBe(5);                     // clamped to n (3 + 3 = 6 cleared)
    expect(r.events.filter((e) => e.t === 'targets').every((e) => e.left.every((v) => v >= 0))).toBe(true);
    expect(targetProgress(s)[0].left).toBe(0);
  });
  it('multiple goals: every goal reaches 0 in a targets event before the win; a goal not touched by a move logs nothing', () => {
    const s = board([{ type: 'collect', c: 4, n: 4, got: 2 }, { type: 'collect', c: 0, n: 1, got: 1 }]);
    const r = swap(s, 39, 46);
    const ev = r.events.filter((e) => e.t === 'targets'), ei = r.events.findIndex((e) => e.t === 'end');
    expect(ev.length).toBeGreaterThan(0);
    const last = ev[ev.length - 1]; expect(last.left).toEqual([0, 0]);
    expect(r.events.lastIndexOf(last)).toBeLessThan(ei);
    const s2 = board([{ type: 'collect', c: 4, n: 20, got: 0 }]); const r2 = swap(s2, 39, 46);
    expect(r2.events.find((e) => e.t === 'end').status).toBe('playing');
    const firstLeft = r2.events.find((e) => e.t === 'targets').left[0]; expect(firstLeft).toBeLessThan(20); expect(firstLeft).toBeGreaterThanOrEqual(0);
  });
  it('the win waits for the 0 + tick: hold is 0.6 to 0.8 s and covers the count roll and the tick pop', () => {
    expect(HOLD.goalTick).toBeGreaterThanOrEqual(600); expect(HOLD.goalTick).toBeLessThanOrEqual(800);
    expect(HOLD.goalTick).toBeGreaterThanOrEqual(D.slow);   // counterChange roll and targetDone pop are both 'slow'
  });
});
