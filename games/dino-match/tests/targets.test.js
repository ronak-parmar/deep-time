import { describe, it, expect } from 'vitest';
import { targetProgress, targetsDone, remainingUnits, validateTargets, TARGET_TYPES, creditClear, targetLabel, leftLabel, MAX_TARGETS } from '../src/core/targets.js';
import { createState, swap } from '../src/core/game.js';
import { generateLevel } from '../src/core/level.js';
import { judge, nearMissOffer } from '../src/core/rules.js';
import { setupTest } from '../src/core/testboards.js';
import { makeBlock } from '../src/core/rules.js';

const st = (extra = {}) => ({ dug: 0, dirtTotal: 4, moves: 5, targets: [{ type: 'dig', n: 4 }], ...extra });

describe('target framework', () => {
  it('dig is the first target type and defaults from dirtTotal', () => {
    expect(Object.keys(TARGET_TYPES)[0]).toBe('dig');
    expect(targetProgress({ dug: 1, dirtTotal: 3 })).toEqual([{ type: 'dig', n: 3, got: 1, left: 2, done: false }]);
  });
  it('1 to 3 targets, all must be done to win', () => {
    expect(MAX_TARGETS).toBe(3);
    const s = st({ targets: [{ type: 'dig', n: 4 }, { type: 'collect', n: 5, c: 2, got: 0 }], dug: 4 });
    expect(targetsDone(s)).toBe(false); expect(judge(s)).toBe('playing');
    s.targets[1].got = 5; expect(targetsDone(s)).toBe(true); expect(judge(s)).toBe('won');
  });
  it('collect counts cleared gems of its colour', () => {
    const s = st({ targets: [{ type: 'dig', n: 4 }, { type: 'collect', n: 3, c: 1, got: 0 }] });
    creditClear(s, [1, 1, 0, 2, 1]); expect(targetProgress(s)[1]).toMatchObject({ got: 3, done: true });
  });
  it('validation rejects 0 or 4 targets, unknown types and a dig target that disagrees with the plaque', () => {
    expect(validateTargets([], 4).length).toBeGreaterThan(0);
    expect(validateTargets(Array(4).fill({ type: 'dig', n: 4 }), 4).length).toBeGreaterThan(0);
    expect(validateTargets([{ type: 'nope', n: 1 }], 4).length).toBeGreaterThan(0);
    expect(validateTargets([{ type: 'dig', n: 3 }], 4).length).toBeGreaterThan(0);
    expect(validateTargets([{ type: 'dig', n: 4 }], 4)).toEqual([]);
  });
  it('labels say what is left (used by the near-miss and Lose screens)', () => {
    const p = targetProgress(st({ dug: 3 }))[0];
    expect(targetLabel(p)).toBe('Dig 4 blocks'); expect(leftLabel(p)).toBe('1 block left to dig');
    expect(remainingUnits(st({ dug: 2 }))).toBe(2);
  });
  it('near miss reads the remaining progress of every target', () => {
    const s = createState(generateLevel(6)); s.status = 'lost'; s.dug = s.dirtTotal - 1;
    expect(nearMissOffer(s).blocksLeft).toBe(1);
    s.dug = s.dirtTotal - 3; expect(nearMissOffer(s)).toBe(null);
  });
  it('dig progress follows the plaque: blocks broken by a move show up in targetProgress', () => {
    const s = createState({ ...generateLevel(40), w: 7, h: 7 }); const t = setupTest(s, 'firecracker');
    s.blocks = [makeBlock('tar', 0), makeBlock('tar', 5), makeBlock('tar', 5)]; s.dirtTotal = 3; s.targets = [{ type: 'dig', n: 3 }];
    swap(s, ...t.swap); expect(targetProgress(s)[0].got).toBe(1);
  });
  it('every authored level has 1 to 3 targets with a tip or a target default tip', () => {
    for (let n = 1; n <= 10; n++) { const l = generateLevel(n); expect(l.targets.length).toBeGreaterThanOrEqual(1); expect(l.tip).toBeTruthy(); }
    expect(TARGET_TYPES.dig.tip).toMatch(/block/);
  });
});
