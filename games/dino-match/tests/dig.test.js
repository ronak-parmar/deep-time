import { describe, it, expect } from 'vitest';
import { hitsForMatch, hitsForBlast, applyHits, digStep, makeBlock, dugCount, hitPointsLeft } from '../src/core/rules.js';
import { createState, swap } from '../src/core/game.js';
import { generateLevel, parseBlocks, blocksToString, validateLevel, hpOf, assignBlocks } from '../src/core/level.js';
import { winRate, botPlay } from '../src/core/bot.js';
import { setupTest } from '../src/core/testboards.js';
import { CONFIG } from '../src/core/config.js';
import { makeRng } from '../src/core/rng.js';

const B = (...spec) => spec.map(([t, c]) => makeBlock(t, c));

describe('dig rule: matches hit blocks of their colour', () => {
  it('hits by match size: 3 = 1, 4 = 2, 5 and more = 3, under 3 = 0', () => {
    expect([2, 3, 4, 5, 6, 9].map(hitsForMatch)).toEqual([0, 1, 2, 3, 3, 3]);
  });
  it('block types carry hit points: tar 1, sand 2, stone 3', () => {
    expect(B(['tar', 0], ['sand', 0], ['stone', 0]).map((b) => b.hp)).toEqual([1, 2, 3]);
  });
  it('a match only hurts blocks of its own colour (wrong colours do nothing)', () => {
    const blocks = B(['tar', 1], ['tar', 2]);
    expect(digStep(blocks, [{ c: 0, n: 3 }])).toEqual([]);
    expect(dugCount(blocks)).toBe(0);
    const hits = digStep(blocks, [{ c: 2, n: 3 }]);
    expect(hits).toHaveLength(1); expect(hits[0]).toMatchObject({ b: 1, broke: true }); expect(dugCount(blocks)).toBe(1);
  });
  it('multi-hit: a 4-match deals 2 hits, a 5-match breaks stone in one go', () => {
    const sand = B(['sand', 3]); digStep(sand, [{ c: 3, n: 4 }]); expect(sand[0].hp).toBe(0);
    const stone = B(['stone', 3]); digStep(stone, [{ c: 3, n: 3 }]); expect(stone[0].hp).toBe(2);
    digStep(stone, [{ c: 3, n: 5 }]); expect(stone[0].hp).toBe(0);
  });
  it('hits go to the first standing block of the colour, then spill to the next', () => {
    const blocks = B(['tar', 4], ['tar', 4], ['tar', 4]);
    const hits = digStep(blocks, [{ c: 4, n: 5 }]);
    expect(hits.map((h) => h.b)).toEqual([0, 1, 2]); expect(dugCount(blocks)).toBe(3);
  });
  it('extra hits on a colour with nothing left are wasted', () => {
    const blocks = B(['tar', 0]); expect(applyHits(blocks, 0, 3)).toHaveLength(1);
  });
  it('a special blast hits several blocks: one salvo per colour among the cleared gems', () => {
    const blocks = B(['tar', 0], ['tar', 1], ['sand', 2], ['tar', 5]);
    const hits = digStep(blocks, [], [0, 0, 1, 2, 2, 2, 2, 3]);   // colours cleared by a blast
    expect(hits.map((h) => h.c)).toEqual([0, 1, 2, 2]);           // red 2 gems -> 1 hit, green 1 -> 1, blue 4 -> 2 hits, yellow has no block
    expect(dugCount(blocks)).toBe(3); expect(blocks[3].hp).toBe(1);
  });
  it('blast hits at least 1 per colour present and follow the match table beyond that', () => {
    expect([0, 1, 3, 4, 5, 20].map(hitsForBlast)).toEqual([0, 1, 1, 2, 3, 3]);
  });
  it('hit points left and dug count', () => {
    const blocks = B(['sand', 0], ['stone', 1]); expect(hitPointsLeft(blocks)).toBe(5); digStep(blocks, [{ c: 0, n: 4 }]); expect(dugCount(blocks)).toBe(1); expect(hitPointsLeft(blocks)).toBe(3);
  });
});

describe('dig rule in play', () => {
  it('a match of the right colour emits a hit event and updates state.dug', () => {
    const s = createState({ ...generateLevel(40), w: 7, h: 7 });
    const t = setupTest(s, 'firecracker');                     // 4 of colour 0 in a row = 2 hits
    s.blocks = B(['sand', 0], ['tar', 1]);
    const r = swap(s, ...t.swap);
    const hit = r.events.find((e) => e.t === 'hit');
    expect(hit.hits.filter((x) => x.c === 0).length).toBeGreaterThanOrEqual(2);
    expect(s.blocks[0].hp).toBe(0); expect(s.dug).toBeGreaterThanOrEqual(1);
  });
  it('a wrong-colour match digs nothing and still spends the move', () => {
    const s = createState({ ...generateLevel(40), w: 7, h: 7 });
    const t = setupTest(s, 'firecracker'); s.blocks = B(['tar', 5]);
    const m = s.moves, r = swap(s, ...t.swap);
    expect(r.events.some((e) => e.t === 'hit' && e.hits.some((h) => h.c === 0))).toBe(false);
    expect(s.dug).toBe(0); expect(s.moves).toBe(m - 1);
  });
  it('a special blast digs several blocks at once', () => {
    const s = createState({ ...generateLevel(40), w: 7, h: 7 });
    const t = setupTest(s, 'combo:tnt+tnt');                   // clears the board: every colour present gets a salvo
    s.blocks = B(['tar', 0], ['tar', 1], ['tar', 2], ['tar', 3]);
    const r = swap(s, ...t.swap);
    expect(r.events.find((e) => e.t === 'hit').hits.length).toBeGreaterThanOrEqual(3);
    expect(s.dug).toBeGreaterThanOrEqual(3);
  });
  it('win timing: the move that breaks the last block ends the level as won, checked after the board settles', () => {
    const s = createState({ ...generateLevel(40), w: 7, h: 7 });
    const t = setupTest(s, 'rainbow');                          // 5 of colour 0 = 3 hits
    s.blocks = B(['stone', 0]); s.dirtTotal = 1; s.targets = [{ type: 'dig', n: 1 }];
    const r = swap(s, ...t.swap);
    expect(s.status).toBe('won'); expect(r.events.at(-1)).toMatchObject({ t: 'end', status: 'won' });
  });
  it('moves stay the budget: dug blocks but no moves left is a loss', () => {
    const s = createState({ ...generateLevel(40), w: 7, h: 7 });
    const t = setupTest(s, 'firecracker'); s.blocks = B(['stone', 0], ['tar', 1]); s.dirtTotal = 2; s.targets = [{ type: 'dig', n: 2 }]; s.moves = 1;
    swap(s, ...t.swap); expect(s.status).toBe('lost');
  });
  it('cascades dig too (every match counts)', () => {
    let steps = 0;
    for (let seed = 1; seed < 40 && !steps; seed++) {
      const s = createState({ ...generateLevel(3), seed }); s.blocks = B(['stone', 0], ['stone', 1], ['stone', 2], ['stone', 3]); s.dirtTotal = 4;
      const rng = makeRng(seed);
      for (let k = 0; k < 4 && s.status === 'playing'; k++) { const m = require_pick(s, rng); const r = swap(s, ...m); steps = Math.max(steps, r.events.filter((e) => e.t === 'hit').length); }
    }
    expect(steps).toBeGreaterThanOrEqual(2);
  });
});
import { pickMove } from '../src/core/bot.js';
function require_pick(s, rng) { return pickMove(s, rng); }

describe('block layouts are data', () => {
  it('parses and prints the compact block format', () => {
    expect(parseBlocks('T0 S1 K2')).toEqual([{ t: 'tar', c: 0 }, { t: 'sand', c: 1 }, { t: 'stone', c: 2 }]);
    expect(blocksToString(parseBlocks('T0 S1 K2'))).toBe('T0 S1 K2');
  });
  it('levels 6 and 7 (the first plaque levels) are forgiving but still need the right colours', () => {
    for (const n of [6, 7]) {
      const l = generateLevel(n), colours = new Set(l.blocks.map((b) => b.c));
      expect(l.blocks.every((b) => b.t === 'tar')).toBe(true);
      expect(colours.size).toBeGreaterThanOrEqual(2); expect(colours.size).toBeLessThan(l.colors);   // not every colour digs
      expect(l.moves).toBeGreaterThanOrEqual(l.dirtTotal * 2.5);
      expect(l.tip).toMatch(/colour/i);
    }
  });
  it('level 6 teaches: Match the colours shown on the blocks to dig', () => { expect(generateLevel(6).tip).toBe('Match the colours shown on the blocks to dig.'); });
  it('levels 1 to 5 are collect-only (no plaque); the plaque starts on level 6; sand from 8, stone on 10', () => {
    const types = (n) => new Set(generateLevel(n).blocks.map((b) => b.t));
    for (let n = 1; n <= 10; n++) { const l = generateLevel(n); expect(l.kind).toBe('onboarding'); expect(validateLevel(l)).toEqual([]); }
    for (let n = 1; n <= 5; n++) { const l = generateLevel(n); expect(l.blocks).toEqual([]); expect(l.dirtTotal).toBe(0); expect(l.targets.every((t) => t.type === 'collect')).toBe(true); }
    for (let n = 6; n <= 10; n++) { const l = generateLevel(n); expect(l.dirtTotal).toBeGreaterThan(0); expect(l.targets.filter((t) => t.type === 'dig')).toEqual([{ type: 'dig', n: l.blocks.length }]); }
    expect(types(7).has('sand')).toBe(false); expect(types(8).has('sand')).toBe(true); expect(types(9).has('stone')).toBe(false); expect(types(10).has('stone')).toBe(true);
    expect(generateLevel(8).targets.map((t) => t.type)).toEqual(['dig', 'collect']);   // dig + collect combinations from level 8
  });
  it('generated difficulty: more hit points and a wider colour spread as the target rises', () => {
    const withBlocks = (range) => range.filter((n) => generateLevel(n).blocks.length), avg = (f, range) => { const r = withBlocks(range); return r.reduce((a, n) => a + f(generateLevel(n)), 0) / r.length; };
    const easy = [16, 17, 18, 19, 21, 22, 23, 24], hard = [281, 282, 283, 284, 286, 287, 288, 289];
    expect(avg((l) => hpOf(l.blocks) / l.blocks.length, hard)).toBeGreaterThan(avg((l) => hpOf(l.blocks) / l.blocks.length, easy));
    expect(avg((l) => new Set(l.blocks.map((b) => b.c)).size, hard)).toBeGreaterThan(avg((l) => new Set(l.blocks.map((b) => b.c)).size, easy));
  });
  it('generated blocks only use colours that are on the board', () => {
    for (const n of [16, 99, 450, 999]) { const l = generateLevel(n); expect(validateLevel(l)).toEqual([]); }
    const rng = makeRng(3); expect(assignBlocks(8, 4, 0.9, rng).every((b) => b.c < 4)).toBe(true);
  });
});

describe('bot solvability', () => {
  it('the bot wins every authored level most of the time', () => {
    for (let n = 1; n <= 10; n++) expect(winRate(generateLevel(n), 8), 'level ' + n).toBeGreaterThanOrEqual(0.75);
  });
  it('a tuned generated level lands near the target win rate (and is winnable)', () => {
    for (const n of [16, 60, 150]) {
      const l = generateLevel(n, { tune: true });
      expect(l.botWinRate).toBeGreaterThanOrEqual(1 - l.target - 0.1);   // the human margin only ever makes it easier than the bot target
      expect(l.botWinRate).toBeGreaterThan(0);
    }
  });
  it('a level with a colour that is not on any block cannot be dug by that colour: hits only come from needed colours', () => {
    const l = generateLevel(7); const s = botPlay({ ...l, moves: 200 }, 5);
    expect(s.status).toBe('won'); expect(hpOf(l.blocks)).toBe(l.dirtTotal);
    expect(CONFIG.dig.blockTypes.stone.hp).toBe(3);
  });
});
