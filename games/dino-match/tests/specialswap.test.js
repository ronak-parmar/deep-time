import { describe, it, expect } from 'vitest';
import { createState, swap, hasMove, hintMove } from '../src/core/game.js';
import { legalSwaps, findRuns } from '../src/core/match.js';
import { generateLevel } from '../src/core/level.js';
import { effectCells, SPECIALS } from '../src/core/specials.js';

// M10 rule: a special swapped with ANY adjacent tile moves there and fires, no colour match needed.
// A dead pattern (no 3-match possible by any swap) so only the special can make the move legal.
function deadBoard() {
  const s = createState({ ...generateLevel(40), w: 7, h: 7 });
  s.obst = new Array(49).fill(null);
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) s.cells[y * 7 + x] = { id: 1000 + y * 7 + x, c: (x + 2 * y) % 5 };
  s.moves = 20; s.status = 'playing';
  return s;
}
const cleared = (r) => new Set(r.events.filter((e) => e.t === 'clear').flatMap((e) => e.cells.map((c) => c.id)));

describe('special + any tile fires (M10)', () => {
  it('the dead pattern really has no plain move', () => {
    const s = deadBoard(); expect(legalSwaps(s.cells, 7, 7)).toEqual([]); expect(hasMove(s)).toBe(false);
  });
  for (const kind of ['firecracker', 'bomb', 'dynamite', 'tnt']) for (const o of kind === 'firecracker' ? ['h', 'v'] : ['h']) it(`${kind}${kind === 'firecracker' ? ' ' + o : ''}: moves to the target cell and blasts from there`, () => {
    const s = deadBoard(), from = 3 * 7 + 3, to = from + 1;              // special at (3,3) swapped right onto a plain gem
    s.cells[from] = { id: 7000, c: 2, s: kind, o };
    const before = s.cells.slice(), m = s.moves;
    expect(legalSwaps(s.cells, 7, 7).some(([a, b]) => (a === from && b === to) || (a === to && b === from))).toBe(true);
    const r = swap(s, from, to);
    expect(r.valid).toBe(true); expect(s.moves).toBe(m - 1);
    const fire = r.events.find((e) => e.t === 'fire').fires[0];
    expect(fire.kind).toBe(kind); expect(fire.i).toBe(to); expect(fire.id).toBe(7000);
    // every gem in the blast area around the NEW cell is cleared (the plain gem moved to `from` and is cleared only if in the area)
    const area = effectCells(SPECIALS[kind].effect, to, 7, 7, o, before, 2);
    const gone = cleared(r);
    for (const j of area) { const p = j === to ? before[from] : j === from ? before[to] : before[j]; expect(gone.has(p.id), `cell ${j}`).toBe(true); }
    expect(gone.has(7000)).toBe(true);
  });
  it('works in every direction, and with an artefact as the partner', () => {
    for (const d of [1, -1, 7, -7]) {
      const s = deadBoard(), from = 24; s.cells[from] = { id: 7001, c: 0, s: 'bomb', o: 'h' };
      expect(swap(s, from, from + d).valid, String(d)).toBe(true);
    }
    const s = deadBoard(); s.cells[24] = { id: 7002, c: 0, s: 'firecracker', o: 'h' }; s.cells[25] = { id: 7003, c: -3, a: 1 };
    expect(swap(s, 24, 25).valid).toBe(true);
  });
  it('rainbow + plain tile clears the colour of the tile it was swapped with; rainbow + artefact stays illegal', () => {
    const s = deadBoard(); s.cells[24] = { id: 7004, c: -1, s: 'rainbow', o: 'h' };
    const colour = s.cells[25].c, n = s.cells.filter((p) => p.c === colour).length;
    const r = swap(s, 24, 25);
    expect([...cleared(r)].length).toBeGreaterThanOrEqual(n + 1);
    const s2 = deadBoard(); s2.cells[24] = { id: 7005, c: -1, s: 'rainbow' }; s2.cells[25] = { id: 7006, c: -3, a: 1 };
    expect(swap(s2, 24, 25).valid).toBe(false);
  });
  it('a special next to anything means the board has moves (no reshuffle)', () => {
    const s = deadBoard(); s.cells[0] = { id: 7007, c: 0, s: 'bomb', o: 'h' };
    expect(hasMove(s)).toBe(true);
  });
  it('the hint prefers a plain match; a special swap only when there is none', () => {
    const s = deadBoard(); s.cells[0] = { id: 7008, c: 0, s: 'tnt', o: 'h' };
    const h1 = hintMove(s); expect(s.cells[h1[0]].s || s.cells[h1[1]].s).toBeTruthy();
    // make a plain match available: (5,6) and (6,6) colour of (4,6)... put a ready 2-in-a-row with a matching gem one step away
    s.cells[44] = { id: 8001, c: 4 }; s.cells[45] = { id: 8002, c: 4 }; s.cells[39] = { id: 8003, c: 4 };   // (2,6) (3,6) and (4,5): swap (4,5)<->(4,6)
    const h2 = hintMove(s); expect(h2).toBeTruthy(); expect(s.cells[h2[0]].s || s.cells[h2[1]].s).toBeFalsy();
    const t = s.cells.slice(); [t[h2[0]], t[h2[1]]] = [t[h2[1]], t[h2[0]]]; expect(findRuns(t, 7, 7).length).toBeGreaterThan(0);
  });
  it('a special inside a normal 3-match still fires', () => {
    const s = deadBoard();
    // row 6: (0,6)=c (1,6)=c special and (2,5)=c; swapping (2,5)<->(2,6) completes the run with the special in it
    const c = 4; s.cells[42] = { id: 8101, c }; s.cells[43] = { id: 8102, c, s: 'bomb', o: 'h' }; s.cells[37] = { id: 8103, c };
    const r = swap(s, 37, 44);
    expect(r.valid).toBe(true);
    expect(r.events.find((e) => e.t === 'fire')?.fires.some((f) => f.kind === 'bomb')).toBe(true);
  });
});
