import { describe, it, expect } from 'vitest';
import { OBSTACLES, OBSTACLE_KINDS, parseLayout, layoutRows, buildObstacles, hitObstacles, hazards, newObstacle, freshCounters, countKind } from '../src/core/obstacles.js';
import { createState, swap, reshuffle, hasMove } from '../src/core/game.js';
import { targetProgress, targetsDone, validateTargets, targetLabel, leftLabel } from '../src/core/targets.js';
import { generateLevel, validateLevel, INTRO, workOf } from '../src/core/level.js';
import { winRate } from '../src/core/bot.js';
import { findMatches } from '../src/core/board.js';
import { CONFIG } from '../src/core/config.js';

// a 5x5 board built from digit rows (colour per cell, 'x' = an obstacle cell from the layout). The base pattern has no matches.
const base = (x, y) => (x + 2 * y) % 4;
function level(layout, extra = {}) {
  return { level: 40, w: 5, h: 5, colors: 4, seed: 3, moves: 12, dirtTotal: 1, blocks: [{ t: 'tar', c: 0 }], layout, targets: [{ type: 'dig', n: 1 }], specials: [], ...extra };
}
function make(layout, extra = {}, mutate) {
  const s = createState(level(layout, extra)), w = 5;
  for (let i = 0; i < 25; i++) if (!s.obst[i] && !(s.cells[i] && s.cells[i].a)) s.cells[i] = { id: 1000 + i, c: base(i % w, Math.floor(i / w)) };
  if (mutate) mutate(s);
  return s;
}
const set = (s, x, y, c) => { s.cells[y * 5 + x] = { id: 2000 + y * 5 + x, c }; };
// swap (2,2) with (2,3): row 2 becomes 1 1 1 . . and the match touches (1,1) / (2,1) / (0,2)...
const matchSetup = (s) => { set(s, 0, 2, 1); set(s, 1, 2, 1); set(s, 2, 2, 2); set(s, 3, 2, 3); set(s, 4, 2, 0); set(s, 2, 3, 1); };
const idx = (x, y) => y * 5 + x;
const eventOf = (r, t) => r.events.filter((e) => e.t === t);

describe('obstacle data and layout', () => {
  it('every obstacle is defined by data: hit points, what hurts it, flags', () => {
    expect(OBSTACLE_KINDS.sort()).toEqual(['bone', 'crate', 'fossil', 'lava', 'rock', 'sandstone', 'tar', 'vine']);
    for (const k of OBSTACLE_KINDS) { const o = OBSTACLES[k]; expect(o.name, k).toBeTruthy(); expect(o.hp > 0, k).toBe(true); expect(typeof o.byMatch, k).toBe('boolean'); expect(typeof o.byBlast, k).toBe('boolean'); }
    expect(OBSTACLES.tar.hp).toBe(1); expect(OBSTACLES.sandstone.hp).toBe(2); expect(OBSTACLES.vine.hp).toBe(2); expect(OBSTACLES.lava.hp).toBe(3);
    expect(OBSTACLES.rock.hp).toBe(Infinity);
  });
  it('layout rows round trip', () => {
    const rows = ['a.....#', '.T.S.F.', '...B...', '.V...C.', '.......', '...L...', '.......'];
    const p = parseLayout(rows);
    expect(p.cells.map((c) => c.k).sort()).toEqual(['bone', 'crate', 'fossil', 'lava', 'rock', 'sandstone', 'tar', 'vine']);
    expect(p.artefacts).toEqual([0]);
    expect(layoutRows(p.cells, p.artefacts, 7, 7)).toEqual(rows);
  });
  it('a built board puts no gem in an obstacle cell and starts without matches', () => {
    const s = createState(level(['.T...', '..S..', '.....', '...#.', '..a..']));
    for (let i = 0; i < 25; i++) expect(!!(s.obst[i] && s.cells[i])).toBe(false);
    expect(s.cells.filter((p) => p && p.a).length).toBe(1);
    expect(findMatches(s.cells, 5, 5)).toEqual([]);
  });
});

describe('hit rules (pure)', () => {
  const st = (rows) => { const { obst } = buildObstacles(rows, 5, 5); return { w: 5, h: 5, obst, ...freshCounters() }; };
  it('tar: one adjacent match clears it; a match two cells away does not; a blast clears it', () => {
    let s = st(['.....', '..T..', '.....', '.....', '.....']);
    expect(hitObstacles(s, new Set([idx(0, 4), idx(1, 4), idx(2, 4)]), new Set())).toEqual([]);
    const h = hitObstacles(s, new Set([idx(2, 2), idx(3, 2), idx(4, 2)]), new Set());
    expect(h).toEqual([{ i: idx(2, 1), k: 'tar', hp: 0, max: 1, by: 'match', broke: true }]); expect(s.obst[idx(2, 1)]).toBe(null); expect(s.broken.tar).toBe(1);
    s = st(['.....', '..T..', '.....', '.....', '.....']);
    expect(hitObstacles(s, new Set(), new Set([idx(2, 1)]))[0]).toMatchObject({ by: 'blast', broke: true });
  });
  it('cracked sandstone: two hits, crack stage between, then it crumbles', () => {
    const s = st(['.....', '..S..', '.....', '.....', '.....']), m = new Set([idx(1, 1), idx(0, 1), idx(0, 0)]);
    expect(hitObstacles(s, m, new Set())[0]).toMatchObject({ hp: 1, max: 2, broke: false });
    expect(s.obst[idx(2, 1)].hp).toBe(1);
    expect(hitObstacles(s, m, new Set())[0]).toMatchObject({ hp: 0, broke: true }); expect(s.broken.sandstone).toBe(1);
  });
  it('a clear step hits an obstacle at most once even when a match and a blast both reach it', () => {
    const s = st(['.....', '..S..', '.....', '.....', '.....']);
    expect(hitObstacles(s, new Set([idx(1, 1)]), new Set([idx(2, 1)]))).toHaveLength(1);
  });
  it('fossil tile: breaking it collects the fossil underneath (counts once)', () => {
    const s = st(['.....', '..F..', '.....', '.....', '.....']), m = new Set([idx(1, 1)]);
    hitObstacles(s, m, new Set()); expect(s.found.fossil).toBe(0);
    hitObstacles(s, m, new Set()); expect(s.found.fossil).toBe(1); expect(s.broken.fossil).toBe(1);
  });
  it('buried skeleton: each tile has its own single hit and is counted', () => {
    const s = st(['.....', '.BBB.', '.....', '.....', '.....']);
    hitObstacles(s, new Set([idx(1, 0)]), new Set()); expect(s.found.bone).toBe(1);
    hitObstacles(s, new Set([idx(2, 0), idx(3, 2)]), new Set()); expect(s.found.bone).toBe(3);
  });
  it('vine stone: two adjacent matches, a blast does not cut it', () => {
    const s = st(['.....', '..V..', '.....', '.....', '.....']);
    expect(hitObstacles(s, new Set(), new Set([idx(2, 1)]))).toEqual([]);
    expect(hitObstacles(s, new Set([idx(1, 1)]), new Set())[0].hp).toBe(1);
    expect(hitObstacles(s, new Set([idx(1, 1)]), new Set())[0].broke).toBe(true);
  });
  it('crate: matches never hurt it, a blast does (also one cell away) and it drops coins', () => {
    const s = st(['.....', '..C..', '.....', '.....', '.....']);
    expect(hitObstacles(s, new Set([idx(1, 1), idx(2, 2)]), new Set())).toEqual([]);
    const h = hitObstacles(s, new Set(), new Set([idx(2, 2)]));
    expect(h[0]).toMatchObject({ k: 'crate', by: 'blast', broke: true, drop: { coins: CONFIG.obstacles.crateCoins } });
    expect(s.coinsFound).toBe(CONFIG.obstacles.crateCoins);
  });
  it('unbreakable rock: nothing hurts it', () => {
    const s = st(['.....', '..#..', '.....', '.....', '.....']);
    expect(hitObstacles(s, new Set([idx(1, 1), idx(2, 0)]), new Set([idx(2, 1)]))).toEqual([]); expect(s.obst[idx(2, 1)].hp).toBe(Infinity);
  });
  it('lava rock: three hits', () => {
    const s = st(['.....', '..L..', '.....', '.....', '.....']), m = new Set([idx(1, 1)]);
    hitObstacles(s, m, new Set()); hitObstacles(s, m, new Set()); expect(s.obst[idx(2, 1)].hp).toBe(1);
    expect(hitObstacles(s, m, new Set())[0].broke).toBe(true);
  });
});

describe('obstacles in play', () => {
  it('a match next to tar breaks it, the cell refills and gems above fall into it', () => {
    const s = make(['.....', '.T...', '.....', '.....', '.....'], {}, matchSetup);
    const r = swap(s, idx(2, 2), idx(2, 3));
    expect(r.valid).toBe(true);
    const ob = eventOf(r, 'obstacle')[0]; expect(ob.hits[0]).toMatchObject({ i: idx(1, 1), k: 'tar', broke: true });
    expect(s.obst[idx(1, 1)]).toBe(null); expect(s.cells[idx(1, 1)]).toBeTruthy();
    for (let i = 0; i < 25; i++) expect(s.cells[i] || s.obst[i]).toBeTruthy();
  });
  it('gems cannot be swapped into an obstacle cell', () => {
    const s = make(['.....', '.T...', '.....', '.....', '.....']);
    expect(swap(s, idx(1, 1), idx(1, 2))).toMatchObject({ valid: false, reason: 'blocked' });
    expect(swap(s, idx(0, 1), idx(1, 1))).toMatchObject({ valid: false, reason: 'blocked' });
    expect(s.moves).toBe(12);
  });
  it('a rock stays in place, gems fall around it and the stretch under it refills from its own top', () => {
    const s = make(['.....', '..#..', '.....', '.....', '.....'], {}, matchSetup);
    const r = swap(s, idx(2, 2), idx(2, 3));
    expect(r.valid).toBe(true);
    expect(s.obst[idx(2, 1)].k).toBe('rock');
    for (let i = 0; i < 25; i++) expect(!!(s.cells[i]) !== !!(s.obst[i])).toBe(true);
    const fall = eventOf(r, 'fall')[0];
    expect(fall.spawns.some((sp) => sp.to === idx(2, 2) && sp.fromRow === 1)).toBe(true);   // below the rock: spawns just above its stretch
    expect(s.cells[idx(2, 0)]).toBeTruthy();                                                // above the rock the top row is filled too
  });
  it('a special blast hits obstacles in its area (line, one hit per step)', () => {
    const s = make(['.....', '.C...', '.....', '.....', '.....'], { specials: ['firecracker'] }, (st) => { st.cells[idx(0, 2)] = { id: 3000, c: 1, s: 'firecracker', o: 'h' }; matchSetup(st); st.cells[idx(0, 2)] = { id: 3000, c: 1, s: 'firecracker', o: 'h' }; });
    const r = swap(s, idx(2, 2), idx(2, 3));
    expect(eventOf(r, 'fire').length).toBeGreaterThan(0);
    expect(s.obst[idx(1, 1)]).toBe(null);   // crate one cell off the cleared row 2: the blast reaches the next cell
    expect(s.coinsFound).toBe(CONFIG.obstacles.crateCoins);
  });
  const bottomRow = (st) => { set(st, 0, 4, 1); set(st, 1, 4, 1); set(st, 2, 4, 3); set(st, 3, 4, 1); set(st, 4, 4, 0); };   // swap (2,4)<->(3,4) makes 1 1 1 in the bottom row
  it('an artefact that lands on the bottom row is collected, the cell refills, and the drop target counts it', () => {
    const s = make(['.....', '.....', '.....', '.....', '.....'], { targets: [{ type: 'dig', n: 1 }, { type: 'drop', n: 1 }] }, (st) => { bottomRow(st); st.cells[idx(2, 3)] = { id: 5, c: -3, a: 1 }; });
    expect(targetProgress(s)[1].got).toBe(0);
    const r = swap(s, idx(2, 4), idx(3, 4));
    expect(r.valid).toBe(true);
    const col = eventOf(r, 'collect')[0]; expect(col.items).toEqual([{ i: idx(2, 4), id: 5, kind: 'artefact' }]);
    expect(s.found.artefact).toBe(1); expect(s.cells.some((p) => p && p.a)).toBe(false); expect(s.cells[idx(2, 4)]).toBeTruthy();
    expect(targetProgress(s)[1]).toMatchObject({ got: 1, done: true });
  });
  it('an artefact higher up falls only as far as the cleared cells under it allow', () => {
    const s = make(['.....', '.....', '.....', '.....', '.....'], { targets: [{ type: 'dig', n: 1 }, { type: 'drop', n: 1 }] }, (st) => { bottomRow(st); st.cells[idx(2, 2)] = { id: 5, c: -3, a: 1 }; });
    swap(s, idx(2, 4), idx(3, 4));
    const at = s.cells.findIndex((p) => p && p.a);
    expect(at % 5).toBe(2); expect(Math.floor(at / 5)).toBeGreaterThanOrEqual(3); expect(s.found.artefact).toBe(0);
  });
  it('artefacts never match, never get cleared by blasts and a rainbow does not swap with one', () => {
    const s = make(['.....', '.....', '..a..', '.....', '.....'], { specials: ['firecracker', 'rainbow'] }, (st) => { st.cells[idx(2, 2)] = { id: 5, c: -3, a: 1 }; st.cells[idx(1, 2)] = { id: 7, c: -1, s: 'rainbow' }; });
    expect(swap(s, idx(1, 2), idx(2, 2))).toMatchObject({ valid: false, reason: 'artefact' });
  });
  it('dead board reshuffle keeps obstacles and artefacts where they are', () => {
    const s = make(['.....', '..#..', '.....', '.....', '..a..']);
    const before = s.obst.map((o) => o && o.k), art = s.cells.findIndex((p) => p && p.a);
    reshuffle(s);
    expect(s.obst.map((o) => o && o.k)).toEqual(before); expect(s.cells.findIndex((p) => p && p.a)).toBe(art);
    expect(findMatches(s.cells, 5, 5)).toEqual([]); expect(hasMove(s)).toBe(true);
  });
});

describe('hazards', () => {
  it('lava heats each move and erupts tar around itself every 3 moves, then heat resets', () => {
    const s = make(['.....', '.....', '..L..', '.....', '.....']);
    expect(hazards(s, false)).toEqual([]); expect(hazards(s, false)).toEqual([]);
    const ev = hazards(s, false);
    expect(ev).toHaveLength(1); expect(ev[0].t).toBe('erupt'); expect(ev[0].items).toHaveLength(CONFIG.obstacles.lavaTar);
    for (const it of ev[0].items) { expect(s.obst[it.i].k).toBe('tar'); expect(s.cells[it.i]).toBe(null); }
    expect(s.obst[idx(2, 2)].heat).toBe(0);
  });
  it('a cleared lava rock never erupts', () => {
    const s = make(['.....', '.....', '..L..', '.....', '.....']);
    s.obst[idx(2, 2)] = null; s.cells[idx(2, 2)] = { id: 9, c: 0 };
    for (let k = 0; k < 6; k++) expect(hazards(s, false)).toEqual([]);
  });
  it('tar spreads into a neighbouring plain gem every N moves unless tar was cleared that move', () => {
    const s = make(['.....', '.....', '..T..', '.....', '.....'], { spread: 3 });
    const n0 = countKind(s.obst, 'tar');
    s.moves = 11; expect(hazards(s, false)).toEqual([]);     // used 1
    s.moves = 9; const ev = hazards(s, false);               // used 3
    expect(ev[0].t).toBe('spread'); expect(countKind(s.obst, 'tar')).toBe(n0 + 1);
    s.moves = 6; expect(hazards(s, true)).toEqual([]);       // used 6, but tar was cleared this move
  });
  it('tar does not spread when the level has no spread setting', () => {
    const s = make(['.....', '.....', '..T..', '.....', '.....']);
    s.moves = 9; expect(hazards(s, false)).toEqual([]);
  });
});

describe('objectives (phase B target types)', () => {
  const types = ['fossils', 'skeleton', 'drop', 'stones', 'clearAll'];
  it('every phase B type has progress, label, left text and a tip', () => {
    const s = make(['.T...', '.....', '.....', '.....', '.....']);
    for (const t of types) {
      const tg = { type: t, n: 2, k: 'tar' };
      const p = targetProgress({ ...s, targets: [{ type: 'dig', n: 1 }, tg] })[1];
      expect(targetLabel(p), t).toBeTruthy(); expect(leftLabel(p), t).toMatch(/left/);
    }
  });
  it('fossils: complete when enough fossil tiles are broken', () => {
    const s = make(['.F.F.', '.....', '.....', '.....', '.....'], { targets: [{ type: 'dig', n: 1 }, { type: 'fossils', n: 2 }] });
    s.found.fossil = 1; expect(targetProgress(s)[1]).toMatchObject({ got: 1, done: false });
    s.found.fossil = 2; expect(targetProgress(s)[1].done).toBe(true);
  });
  it('skeleton: complete only when every bone tile is uncovered', () => {
    const s = make(['.BBB.', '.....', '.....', '.....', '.....'], { targets: [{ type: 'dig', n: 1 }, { type: 'skeleton', n: 3 }] });
    s.found.bone = 2; expect(targetsDone({ ...s, dug: 1 })).toBe(false); s.found.bone = 3; expect(targetProgress(s)[1].done).toBe(true);
  });
  it('stones counts sandstone and vine tiles broken', () => {
    const s = make(['.S.V.', '.....', '.....', '.....', '.....'], { targets: [{ type: 'dig', n: 1 }, { type: 'stones', n: 2 }] });
    s.broken.sandstone = 1; expect(targetProgress(s)[1].got).toBe(1); s.broken.vine = 1; expect(targetProgress(s)[1].done).toBe(true);
  });
  it('clearAll is done only when none of that kind is left (tar that spreads counts again)', () => {
    const s = make(['.T.T.', '.....', '.....', '.....', '.....'], { targets: [{ type: 'dig', n: 1 }, { type: 'clearAll', k: 'tar', n: 2 }] });
    expect(targetProgress(s)[1]).toMatchObject({ got: 0, done: false });
    s.obst[1] = null; expect(targetProgress(s)[1].got).toBe(1);
    s.obst[3] = null; expect(targetProgress(s)[1].done).toBe(true);
    s.obst[7] = newObstacle('tar'); expect(targetProgress(s)[1].done).toBe(false);
  });
  it('win needs every target: the dig target alone does not win, and the win is checked after the board settled', () => {
    const s = make(['.....', '.T...', '.....', '.....', '.....'], { targets: [{ type: 'dig', n: 1 }, { type: 'clearAll', k: 'tar', n: 1 }] }, matchSetup);
    s.blocks[0].hp = 0; s.dug = 1;          // plaque already dug
    const r = swap(s, idx(2, 2), idx(2, 3));
    expect(r.valid).toBe(true);
    expect(s.status).toBe('won');            // this move also broke the tar next to the match
    const end = r.events[r.events.length - 1]; expect(end).toMatchObject({ t: 'end', status: 'won' });
  });
  it('the move that runs out the budget with an objective left is a loss (near miss counts remaining units)', () => {
    const s = make(['.....', '.....', '.....', '.....', '....C'], { moves: 1, targets: [{ type: 'dig', n: 1 }, { type: 'clearAll', k: 'crate', n: 1 }] }, matchSetup);
    s.blocks[0].hp = 0; s.dug = 1;
    swap(s, idx(2, 2), idx(2, 3));          // matches never hurt a crate, and the last move is spent
    expect(s.status).toBe('lost'); expect(targetProgress(s)[1].done).toBe(false);
  });
  it('validation checks objective counts against the layout', () => {
    const p = parseLayout(['.F...', '.....', '.....', '.....', 'a....']);
    expect(validateTargets([{ type: 'dig', n: 1 }, { type: 'fossils', n: 2 }], 1, p).length).toBeGreaterThan(0);
    expect(validateTargets([{ type: 'dig', n: 1 }, { type: 'fossils', n: 1 }], 1, p)).toEqual([]);
    expect(validateTargets([{ type: 'dig', n: 1 }, { type: 'drop', n: 2 }], 1, p).length).toBeGreaterThan(0);
    expect(validateTargets([{ type: 'dig', n: 1 }, { type: 'clearAll', k: 'rock', n: 0 }], 1, p).length).toBeGreaterThan(0);
  });
});

describe('level data and generator', () => {
  it('every introduction level validates, uses its obstacle once as a new thing, and is solvable by the bot', () => {
    for (const [n, intro] of Object.entries(INTRO)) {
      const cfg = generateLevel(+n, { tune: true });
      expect(validateLevel(cfg), 'level ' + n).toEqual([]);
      expect(cfg.layout, 'layout ' + n).toEqual(intro.layout); expect(cfg.tip).toBe(intro.tip);
      const goal = 1 - cfg.target - (cfg.layout.some((r) => /[Ca]/.test(r)) ? CONFIG.levels.plannedSlack : 0);
      expect(winRate(cfg), 'bot win ' + n).toBeGreaterThanOrEqual(goal - 0.2);
    }
  });
  it('each obstacle appears first on its intro level, never before (data schedule)', () => {
    const first = {};
    for (let n = 1; n <= 320; n++) { const c = generateLevel(n); if (!c.layout) continue; for (const ch of c.layout.join('')) if (ch !== '.') first[ch] = first[ch] ?? n; }
    const want = { T: 11, '#': 18, S: 25, F: 35, B: 55, a: 70, V: 101, C: 201, L: 301 };
    for (const [g, n] of Object.entries(want)) expect(first[g], g).toBe(n);
  });
  it('generated levels from 1 to 1000 are valid and layouts keep columns playable', () => {
    for (let n = 1; n <= 1000; n++) { const c = generateLevel(n); expect(validateLevel(c), 'level ' + n).toEqual([]); if (c.layout) { expect(c.layout.length).toBe(c.h); expect(c.targets.length).toBeLessThanOrEqual(3); } }
  });
  it('a level with a layout is deterministic and its work estimate counts obstacles', () => {
    expect(generateLevel(253)).toEqual(generateLevel(253));
    expect(workOf([{ t: 'tar', c: 0 }], ['.S...', '.....', '.....', '.....', 'a....'])).toBeGreaterThan(workOf([{ t: 'tar', c: 0 }], null));
  });
  it('a tuned generated obstacle level lands in a sane move range and is winnable', () => {
    const c = generateLevel(206, { tune: true });
    expect(c.moves).toBeGreaterThanOrEqual(Math.ceil(workOf(c.blocks, c.layout) * CONFIG.levels.minMoveFactor));
    expect(winRate(c)).toBeGreaterThan(0.5);
  });
});
