// Obstacles (docs/11 phase B) as DATA plus the pure rules that act on them. An obstacle sits in a board cell that holds no gem
// (state.obst[i] = null | { k, hp, max, heat? }); gems fall within the free stretch of their column, so a blocker shapes the board.
// Hit rules per kind: `byMatch` = hit once per clear step by a match group touching it (4-neighbours),
// `byBlast` = hit once per clear step when a special's blast area covers its cell. hp Infinity = permanent.
import { CONFIG } from './config.js';
import { next, int } from './rng.js';

export const OBSTACLES = {
  tar:    { name: 'Tar pit',          hp: 1, byMatch: true,  byBlast: true,  stone: false, note: 'Cleared by one adjacent match or any blast. In hard levels it spreads.' },
  sandstone: { name: 'Cracked sandstone', hp: 2, byMatch: true, byBlast: true, stone: true, note: 'Two hits (adjacent match or blast): cracks, then crumbles.' },
  fossil: { name: 'Fossil tile',      hp: 2, byMatch: true,  byBlast: true,  stone: true, fossil: true, note: 'A fossil is buried under this tile. Break the tile to collect it.' },
  bone:   { name: 'Skeleton tile',    hp: 1, byMatch: true,  byBlast: true,  stone: true, bone: true, note: 'One tile of a buried skeleton. Uncover them all.' },
  vine:   { name: 'Vine stone',       hp: 2, byMatch: true,  byBlast: false, stone: true, note: 'Two adjacent matches cut it (blasts do not). Nothing swaps through it.' },
  crate:  { name: 'Ancient crate',    hp: 1, byMatch: false, byBlast: true,  blastReach: 1, stone: false, drop: true, note: 'Only a blast breaks it (a blast that reaches the next cell is enough). Drops coins.' },
  lava:   { name: 'Lava rock',        hp: 3, byMatch: true,  byBlast: true,  stone: false, heat: 3, note: 'Heats every 3 moves, then erupts tar around it. Three hits to clear.' },
  rock:   { name: 'Unbreakable rock', hp: Infinity, byMatch: false, byBlast: false, stone: false, note: 'Never breaks. It shapes the board.' }
};
export const OBSTACLE_KINDS = Object.keys(OBSTACLES);

// Layout rows are text, one character per cell ('.' = plain gem). a = an artefact gem to carry to the bottom row.
export const GLYPHS = { T: 'tar', S: 'sandstone', F: 'fossil', B: 'bone', V: 'vine', C: 'crate', L: 'lava', '#': 'rock' };
export const glyphOf = (k) => Object.keys(GLYPHS).find((g) => GLYPHS[g] === k);

// parseLayout(rows) -> { w, h, cells:[{ i, k }], artefacts:[i] }
export function parseLayout(rows) {
  const h = rows.length, w = rows[0].length, cells = [], artefacts = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === 'a') artefacts.push(y * w + x);
    else if (GLYPHS[ch]) cells.push({ i: y * w + x, k: GLYPHS[ch] });
  }));
  return { w, h, cells, artefacts };
}
export function layoutRows(cells, artefacts, w, h) {
  const g = Array.from({ length: h }, () => new Array(w).fill('.'));
  for (const c of cells) g[Math.floor(c.i / w)][c.i % w] = glyphOf(c.k);
  for (const i of artefacts || []) g[Math.floor(i / w)][i % w] = 'a';
  return g.map((r) => r.join(''));
}

export const newObstacle = (k) => ({ k, hp: OBSTACLES[k].hp, max: OBSTACLES[k].hp, ...(OBSTACLES[k].heat ? { heat: 0 } : {}) });
export function buildObstacles(rows, w, h) {
  const obst = new Array(w * h).fill(null), p = parseLayout(rows);
  for (const c of p.cells) obst[c.i] = newObstacle(c.k);
  return { obst, artefacts: p.artefacts };
}
export const countKind = (obst, k) => obst.reduce((a, o) => a + (o && o.k === k ? 1 : 0), 0);
export const countKinds = (obst) => { const n = {}; for (const o of obst) if (o) n[o.k] = (n[o.k] || 0) + 1; return n; };
export const isBlocked = (state, i) => !!(state.obst && state.obst[i]);

export const freshCounters = () => ({ broken: {}, found: { fossil: 0, bone: 0, artefact: 0 }, coinsFound: 0 });
const neigh = (i, w, h) => { const x = i % w, y = Math.floor(i / w), o = []; if (x > 0) o.push(i - 1); if (x < w - 1) o.push(i + 1); if (y > 0) o.push(i - w); if (y < h - 1) o.push(i + w); return o; };

// One clear step. matchCells = cells cleared by match groups, blastCells = every cell inside a blast area this step.
// Returns [{ i, k, hp, max, by, broke, drop? }] in cell order. Mutates state.obst and the counters.
export function hitObstacles(state, matchCells, blastCells) {
  const { w, h, obst } = state, out = [];
  for (let i = 0; i < obst.length; i++) {
    const o = obst[i]; if (!o || o.hp === Infinity) continue;
    const d = OBSTACLES[o.k];
    let by = null;
    if (d.byBlast && (blastCells.has(i) || (d.blastReach && neigh(i, w, h).some((j) => blastCells.has(j))))) by = 'blast';
    else if (d.byMatch && neigh(i, w, h).some((j) => matchCells.has(j))) by = 'match';
    if (!by) continue;
    o.hp -= 1;
    const e = { i, k: o.k, hp: o.hp, max: o.max, by, broke: o.hp <= 0 };
    if (e.broke) {
      obst[i] = null;
      state.broken[o.k] = (state.broken[o.k] || 0) + 1;
      if (d.fossil) state.found.fossil += 1;
      if (d.bone) state.found.bone += 1;
      if (d.drop) { state.coinsFound += CONFIG.obstacles.crateCoins; e.drop = { coins: CONFIG.obstacles.crateCoins }; }
    }
    out.push(e);
  }
  return out;
}

// Booster hit: every listed cell with a breakable obstacle loses one layer, whatever would normally be needed to hurt it (vine, crate...).
// Same accounting as hitObstacles (broken counters, fossils, bones, crate coins). Returns the same event shape.
export function strikeObstacles(state, cells) {
  const { obst } = state, out = [];
  for (const i of [...cells].sort((a, b) => a - b)) {
    const o = obst[i]; if (!o || o.hp === Infinity) continue;
    o.hp -= 1;
    const d = OBSTACLES[o.k], e = { i, k: o.k, hp: o.hp, max: o.max, by: 'booster', broke: o.hp <= 0 };
    if (e.broke) {
      obst[i] = null; state.broken[o.k] = (state.broken[o.k] || 0) + 1;
      if (d.fossil) state.found.fossil += 1;
      if (d.bone) state.found.bone += 1;
      if (d.drop) { state.coinsFound += CONFIG.obstacles.crateCoins; e.drop = { coins: CONFIG.obstacles.crateCoins }; }
    }
    out.push(e);
  }
  return out;
}

// After a valid move that did not end the level: lava heats (and erupts every `heat` moves), tar spreads every
// CONFIG.obstacles.spreadEvery moves when `state.spread` is on and no tar was cleared this move.
// Returns events [{ t:'erupt', i, items:[{ i, id }] } | { t:'spread', items:[{ i, id, from }] }].
const convertible = (state, j) => { const p = state.cells[j]; return p && !p.s && !p.a && !(state.obst && state.obst[j]); };
export function hazards(state, tarCleared) {
  const { w, h } = state, ev = [];
  const place = (j) => { const p = state.cells[j]; state.cells[j] = null; state.obst[j] = newObstacle('tar'); return { i: j, id: p.id }; };
  for (let i = 0; i < state.obst.length; i++) {
    const o = state.obst[i]; if (!o || o.k !== 'lava') continue;
    o.heat += 1;
    if (o.heat < OBSTACLES.lava.heat) continue;
    o.heat = 0;
    const cx = Math.min(w - 2, Math.max(1, (i % w) + int(state.rng, 3) - 1)), cy = Math.min(h - 2, Math.max(1, Math.floor(i / w) + int(state.rng, 3) - 1));
    const win = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = (cy + dy) * w + cx + dx; if (convertible(state, j)) win.push(j); }
    const items = [];
    for (let n = 0; n < CONFIG.obstacles.lavaTar && win.length; n++) items.push(place(win.splice(int(state.rng, win.length), 1)[0]));
    ev.push({ t: 'erupt', i, items });
  }
  const every = state.spread;
  if (every && !tarCleared && (state.movesMax - state.moves) % every === 0) {
    const tars = []; state.obst.forEach((o, i) => { if (o && o.k === 'tar') tars.push(i); });
    if (tars.length) {
      const from = tars[int(state.rng, tars.length)], opts = neigh(from, w, h).filter((j) => convertible(state, j));
      if (opts.length) { const it = place(opts[int(state.rng, opts.length)]); ev.push({ t: 'spread', items: [{ ...it, from }] }); }
    }
  }
  return ev;
}
void next;
