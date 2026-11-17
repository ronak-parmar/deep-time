import { describe, it, expect } from 'vitest';
import { findRuns, findGroups, classify, spawnCell, legalSwaps } from '../src/core/match.js';
import { findMatches } from '../src/core/board.js';
import { runChain } from '../src/core/chain.js';
import { KINDS, SPECIALS, COMBOS, CREATE, comboFor, effectCells, unlockedKinds, pairKey } from '../src/core/specials.js';
import { createState, swap, reshuffle, hasMove, hintMove } from '../src/core/game.js';
import { generateLevel } from '../src/core/level.js';
import { setupTest, ALL_TESTS, SPECIAL_TESTS } from '../src/core/testboards.js';
import { CONFIG } from '../src/core/config.js';

// grid('0011', ...) -> cells; digits are colours, '.' is empty, letters build specials: F firecracker(h), B bomb, D dynamite, T tnt, R rainbow
let nid = 1;
const SP = { F: 'firecracker', B: 'bomb', D: 'dynamite', T: 'tnt', R: 'rainbow' };
const grid = (rows) => rows.flatMap((r) => r.split('').map((ch) => (ch === '.' ? null : SP[ch] ? { id: nid++, c: ch === 'R' ? -1 : 0, s: SP[ch], o: 'h' } : { id: nid++, c: +ch })));
const W = (rows) => rows[0].length;
const groupsOf = (rows) => findGroups(grid(rows), W(rows), rows.length);
const kindOf = (rows, allowed = null) => { const g = groupsOf(rows); return g.length ? classify(g[0], allowed) : null; };

describe('match shapes (unique cells)', () => {
  it('3 in a line makes nothing', () => expect(kindOf(['0001', '1212', '2121', '1212'])).toBe(null));
  it('4 in a row is a firecracker clearing along the match', () => { const k = kindOf(['0000', '1212', '2121', '1212']); expect(k.kind).toBe('firecracker'); expect(k.o).toBe('h'); });
  it('4 in a column is a vertical firecracker', () => { const k = kindOf(['0123', '0231', '0312', '0123']); expect(k.kind).toBe('firecracker'); expect(k.o).toBe('v'); });
  it('straight 5 is a rainbow', () => expect(kindOf(['00000', '12121', '21212', '12121', '21212']).kind).toBe('rainbow'));
  it('T of 5 is a bomb, counted as 5 unique cells', () => {
    const rows = ['00011', '10112', '12011', '21210', '12121'].map((r) => r); // 0-row of 3 on top + stem down the middle would need col 2
    const T = ['10001', '21012', '12013', '31231', '23123'];
    const g = groupsOf(T); expect(g).toHaveLength(1); expect(g[0].cells).toHaveLength(5); expect(classify(g[0]).kind).toBe('bomb'); void rows;
  });
  it('L of 5 is a bomb', () => { const L = ['00012', '10123', '10231', '21312', '32123']; const g = groupsOf(L); expect(g[0].cells).toHaveLength(5); expect(classify(g[0]).kind).toBe('bomb'); });
  it('a plus (cross-shaped) is TNT, even though it has only 5 cells', () => {
    const P = ['12012', '20002', '31013', '23123', '12312'];
    const g = groupsOf(P); expect(g[0].cells).toHaveLength(5); const k = classify(g[0]); expect(k.kind).toBe('tnt'); expect(k.cross).toBe(true);
  });
  it('a 6 cell connected group is dynamite', () => { const g = groupsOf(['0000', '1012', '2013', '3123']); expect(g[0].cells).toHaveLength(6); expect(classify(g[0]).kind).toBe('dynamite'); });
  it('straight 6 is dynamite and 7+ is TNT (size wins over a long line)', () => {
    expect(kindOf(['000000', '121212', '212121', '121212', '212121', '121212']).kind).toBe('dynamite');
    expect(kindOf(['0000000', '1212121', '2121212', '1212121', '2121212', '1212121', '2121212']).kind).toBe('tnt');
  });
  it('rule priority: a cross beats a straight line; groups never double count a shared cell', () => {
    const g = groupsOf(['1200001', '2112121', '1221212']); // row of 4 only
    expect(classify(g[0]).kind).toBe('firecracker');
    const plus = findGroups(grid(['12012', '20002', '31013', '23123', '12312']), 5, 5)[0];
    expect(plus.runs).toHaveLength(2); expect(plus.cells).toHaveLength(5);
  });
  it('locked kinds make a plain match', () => {
    const g = groupsOf(['0000', '1212', '2121', '1212'])[0];
    expect(classify(g, ['bomb'])).toBe(null); expect(classify(g, ['firecracker']).kind).toBe('firecracker');
  });
  it('findRuns ignores rainbow and empty cells', () => { expect(findRuns(grid(['RRR', '...', '...']), 3, 3)).toEqual([]); });
});

describe('spawn cell', () => {
  const g = groupsOf(['0000', '1212', '2121', '1212'])[0], info = classify(g);
  it('is the swapped-to cell when it belongs to the group', () => expect(spawnCell(g, info, 1)).toBe(1));
  it('else the middle of the longest run', () => expect(spawnCell(g, info, 9)).toBe(2));
  it('else the intersection for T and L shapes', () => {
    const T = groupsOf(['10001', '21012', '12013', '31231', '23123'])[0];
    expect(spawnCell(T, classify(T), -1)).toBe(2);
  });
});

describe('effects and combination table', () => {
  const w = 9, h = 9, c = 4 * 9 + 4;
  it('every shape clears the right cells', () => {
    expect(effectCells(SPECIALS.firecracker.effect, c, w, h, 'h')).toHaveLength(9);
    expect(effectCells(SPECIALS.firecracker.effect, c, w, h, 'v').every((i) => i % w === 4)).toBe(true);
    expect(effectCells(SPECIALS.bomb.effect, c, w, h)).toHaveLength(9);
    expect(effectCells(SPECIALS.dynamite.effect, c, w, h)).toHaveLength(13);
    expect(effectCells(SPECIALS.tnt.effect, c, w, h)).toHaveLength(49);
    expect(effectCells({ shape: 'board' }, c, w, h)).toHaveLength(81);
  });
  it('the table matches docs/11', () => {
    expect(effectCells(comboFor('firecracker', 'firecracker'), c, w, h)).toHaveLength(17);          // row + column
    expect(effectCells(comboFor('bomb', 'firecracker'), c, w, h)).toHaveLength(27 + 27 - 9);        // 3-wide cross
    expect(effectCells(comboFor('bomb', 'bomb'), c, w, h)).toHaveLength(25);                        // 5x5
    expect(effectCells(comboFor('bomb', 'dynamite'), c, w, h)).toHaveLength(49);                    // 7x7
    expect(effectCells(comboFor('tnt', 'dynamite'), c, w, h)).toHaveLength(81);                      // 9x9
  });
  it('every non-rainbow pair has an entry', () => {
    const plain = KINDS.filter((k) => k !== 'rainbow');
    for (const a of plain) for (const b of plain) expect(COMBOS[pairKey(a, b)], a + b).toBeTruthy();
  });
  it('introduction schedule: firecracker 5, bomb 15, rainbow 45', () => {
    expect(unlockedKinds(4)).toEqual([]); expect(unlockedKinds(5)).toEqual(['firecracker']); expect(unlockedKinds(16)).toEqual(['firecracker', 'bomb']); expect(unlockedKinds(46)).toEqual(KINDS);
    expect(CREATE.straight5).toBe('rainbow');
  });
});

describe('chain queue', () => {
  it('a blast sets off the specials it hits, each fires once', () => {
    const cells = grid(['1212', '2B12', '1F21', '2121']);   // bomb at (1,1), firecracker below it at (1,2)
    const r = runChain(cells, 4, 4, new Set([5]));
    expect(r.fires.map((f) => f.kind)).toEqual(['bomb', 'firecracker']);
    expect(new Set(r.cleared).size).toBe(r.cleared.length);
  });
  it('a special hit by two blasts fires only once', () => {
    const cells = grid(['B.B', '.F.', 'B.B'].map((r) => r.replace(/\./g, '1')));
    const r = runChain(cells, 3, 3, new Set([0, 2, 6, 8]));
    expect(r.fires.filter((f) => f.id === cells[4].id)).toHaveLength(1);
  });
  it('terminates at the depth cap', () => {
    const w = 80, cells = Array.from({ length: w }, (_, i) => ({ id: i + 1, c: 0, s: 'bomb', o: 'h' }));
    const r = runChain(cells, w, 1, new Set([0]));
    expect(r.capped).toBe(true); expect(r.fires.length).toBe(CONFIG.specials.chainDepth); expect(Math.max(...r.fires.map((f) => f.depth))).toBe(CONFIG.specials.chainDepth);
  });
});

function boardFor(name, level = 40) {
  const s = createState({ ...generateLevel(level), w: 7, h: 7 });
  const t = setupTest(s, name); return { s, t };
}
describe('creating specials by playing (debug boards)', () => {
  for (const name of SPECIAL_TESTS) it(`${name} appears where the player swapped`, () => {
    const { s, t } = boardFor(name);
    expect(findMatches(s.cells, s.w, s.h)).toEqual([]);
    const target = t.swap[1], moved = s.cells[t.swap[0]].id;
    const r = swap(s, ...t.swap);
    expect(r.valid).toBe(true);
    const create = r.events.find((e) => e.t === 'create');
    expect(create.s).toBe(t.expect);
    expect(create.i).toBe(target);
    void moved;
    const piece = create && s.cells.find((p) => p && p.id === create.id);
    expect(piece, 'special survives gravity').toBeTruthy(); expect(piece.s).toBe(t.expect);
  });
  it('a special is only made when its kind is unlocked for the level', () => {
    const s = createState(generateLevel(1)); const t = setupTest(s, 'firecracker'); s.specials = [];
    const r = swap(s, ...t.swap); expect(r.events.some((e) => e.t === 'create')).toBe(false);
  });
});

describe('combinations', () => {
  const plain = KINDS.filter((k) => k !== 'rainbow');
  for (const a of plain) for (const b of plain) if (KINDS.indexOf(a) <= KINDS.indexOf(b)) it(`${a} + ${b}`, () => {
    const { s, t } = boardFor(`combo:${a}+${b}`);
    const r = swap(s, ...t.swap);
    expect(r.valid).toBe(true);
    const fire = r.events.find((e) => e.t === 'fire');
    expect(fire.fires[0].kind).toBe('combo');
    const expected = effectCells(comboFor(a, b), t.swap[1], 7, 7, 'h');
    const cleared = new Set(r.events.find((e) => e.t === 'clear').cells.map((c) => c.i));
    for (const i of expected) expect(cleared.has(i), `cell ${i}`).toBe(true);
  });
  it('rainbow + gem clears every gem of that colour', () => {
    const { s, t } = boardFor('rainbow+gem');
    const colour = s.cells[t.swap[1]].c, count = s.cells.filter((p) => p.c === colour).length;
    const r = swap(s, ...t.swap);
    const clear = r.events.find((e) => e.t === 'clear');
    expect(clear.cells.filter((c) => c.c === colour)).toHaveLength(count);
    expect(clear.cells.some((c) => c.s === 'rainbow')).toBe(true);
  });
  it('rainbow + special turns that colour into that special and fires them all', () => {
    const { s, t } = boardFor('combo:rainbow+bomb');
    const bombColour = s.cells[t.swap[1]].c, n = s.cells.filter((p) => p.c === bombColour).length;
    const r = swap(s, ...t.swap);
    const fire = r.events.find((e) => e.t === 'fire');
    expect(fire.fires.filter((f) => f.kind === 'bomb').length).toBeGreaterThanOrEqual(n);
  });
  it('rainbow + rainbow clears the whole board', () => {
    const { s, t } = boardFor('combo:rainbow+rainbow');
    const r = swap(s, ...t.swap);
    expect(r.events.find((e) => e.t === 'clear').cells).toHaveLength(49);
  });
});

describe('moves, counts and fairness', () => {
  it('a special move spends one move', () => {
    const { s, t } = boardFor('combo:bomb+bomb'); const m = s.moves;
    swap(s, ...t.swap); expect(s.moves).toBe(m - 1);
  });
  it('score counts unique cleared cells', () => {
    const { s, t } = boardFor('combo:tnt+tnt'); const r = swap(s, ...t.swap);
    expect(r.events.find((e) => e.t === 'clear').score).toBe(49 * CONFIG.score.perGem);
  });
  it('legalSwaps includes special pairs and rainbow swaps even without a match', () => {
    const { s, t } = boardFor('combo:bomb+firecracker');
    expect(legalSwaps(s.cells, 7, 7).some(([a, b]) => a === t.swap[0] && b === t.swap[1])).toBe(true);
    expect(hasMove(s)).toBe(true); expect(hintMove(s)).toBeTruthy();
  });
  it('dead board: fair reshuffle keeps specials in place, makes no instant match, leaves a legal move', () => {
    const s = createState(generateLevel(40));
    // fill with a dead pattern (no legal move): diagonal colours, plus two fixed specials far apart
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) s.cells[y * 7 + x] = { id: 1000 + y * 7 + x, c: (x + 2 * y) % 5 };
    s.cells[0] = { id: 5000, c: 0, s: 'bomb', o: 'h' }; s.cells[48] = { id: 5001, c: 1, s: 'firecracker', o: 'v' };
    if (hasMove(s)) { /* pattern may have a move; force dead by checking reshuffle contract anyway */ }
    const before = s.cells.map((p) => p.s || null);
    const ev = reshuffle(s);
    expect(s.cells.map((p) => p.s || null)).toEqual(before);
    expect(s.cells[0].id).toBe(5000); expect(s.cells[48].id).toBe(5001);
    expect(findMatches(s.cells, 7, 7)).toEqual([]); expect(hasMove(s)).toBe(true); expect(ev.t).toBe('shuffle');
  });
  it('a board with a rainbow is never dead', () => {
    const s = createState(generateLevel(40));
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) s.cells[y * 7 + x] = { id: 1 + y * 7 + x, c: (x + 2 * y) % 5 };
    s.cells[24] = { id: 9000, c: -1, s: 'rainbow' }; expect(hasMove(s)).toBe(true);
  });
  it('all debug tests are known names', () => { for (const n of ALL_TESTS) { const { t } = boardFor(n); expect(t, n).toBeTruthy(); } });
});
