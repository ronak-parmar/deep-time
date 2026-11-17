import { CONFIG } from './config.js';
import { makeRng, next, int, shuffle } from './rng.js';
import { adjacent, findMatches } from './board.js';
import { judge, starsFor, digStep, dugCount, makeBlock } from './rules.js';
import { findGroups, classify, spawnCell, legalSwaps } from './match.js';
import { runChain } from './chain.js';
import { comboFor, unlockedKinds, SPECIALS } from './specials.js';
import { defaultTargets, creditClear } from './targets.js';
import { buildObstacles, hitObstacles, hazards, freshCounters } from './obstacles.js';

// ---- state ------------------------------------------------------------------------------
// state = { level, w, h, colors, cells, rng, nextId, moves, movesMax, dug, dirtTotal, dirtOrder, targets, specials,
//           score, status, combo }   (plain JSON, so it saves as is)
// A piece is { id, c } or a special { id, c, s, o } (rainbow has c = -1).

const newPiece = (state, c) => ({ id: state.nextId++, c });
const randColor = (state) => int(state.rng, state.colors);

// Levels without a block list (old tests, saves) get plain tar blocks cycling through the colours.
const legacyBlocks = (level) => Array.from({ length: level.dirtTotal }, (_, i) => ({ t: 'tar', c: i % level.colors }));

export function createState(level) {
  const state = {
    level: level.level, w: level.w, h: level.h, colors: level.colors,
    cells: [], rng: makeRng(level.seed), nextId: 1,
    moves: level.moves, movesMax: level.moves,
    dug: 0, dirtTotal: level.dirtTotal, blocks: (level.blocks || legacyBlocks(level)).map((b) => makeBlock(b.t, b.c)),
    targets: (level.targets || (level.dirtTotal ? defaultTargets(level.dirtTotal) : [])).map((t) => ({ ...t, ...(t.type === 'dig' ? { n: level.dirtTotal } : {}) })),   // the dirt panel (dirtTotal) drives the dig target
    specials: level.specials ? level.specials.slice() : unlockedKinds(level.level),
    hasDig: level.dirtTotal > 0, score: 0, status: 'playing', spread: level.spread || 0, ...freshCounters()
  };
  const built = level.layout ? buildObstacles(level.layout, level.w, level.h) : { obst: new Array(level.w * level.h).fill(null), artefacts: [] };
  state.obst = built.obst; state.artefacts = built.artefacts;
  fillBoard(state);
  return state;
}

// Fill with no starting matches and at least one valid move.
function fillBoard(state) {
  const { w, h } = state;
  for (let tries = 0; tries < 200; tries++) {
    state.cells = new Array(w * h).fill(null);
    for (let i = 0; i < w * h; i++) {
      let c, guard = 0;
      if (state.obst[i]) { state.cells[i] = null; continue; }
      do {
        c = randColor(state);
        state.cells[i] = { id: state.nextId++, c };
      } while (findMatches(state.cells, w, h).length && ++guard < 20);
    }
    for (const i of state.artefacts) state.cells[i] = { id: state.nextId++, c: -3, a: 1 };   // artefact: no colour, never matches
    if (!findMatches(state.cells, w, h).length && legalSwaps(state.cells, w, h).length) return;
  }
  throw new Error('could not build a playable board');
}

export const hasMove = (state) => legalSwaps(state.cells, state.w, state.h).length > 0;
export const hintMove = (state) => legalSwaps(state.cells, state.w, state.h)[0] || null;

// ---- one move ---------------------------------------------------------------------------
// swap(state, a, b) mutates the state to its final position and returns a result with an event
// log the renderer replays:
//   { valid:false, events:[{t:'swap',a,b,ok:false}] }
//   { valid:true, events:[swap, (fire, clear, create, hit, fall)..., shuffle?, end], dug, status }
// hit:    { t:'hit', step, hits:[{ b, hp, max, c, broke }], dug, total }   blocks of the dig plaque damaged by this clear
// fire:   { t:'fire', step, fires:[{ i, id, kind, o, depth, cells, colour }] }   special activations (chain order)
// clear:  { t:'clear', step, cells:[{ i, id, c, s }], score }
// create: { t:'create', step, i, id, c, s, o }                                  a new special appears in a cleared cell
export function swap(state, a, b) {
  const { w, h } = state;
  if (state.status !== 'playing') return { valid: false, events: [], reason: 'over' };
  if (a < 0 || b < 0 || a >= w * h || b >= w * h || !adjacent(a, b, w)) return { valid: false, events: [], reason: 'not-adjacent' };

  const pa = state.cells[a], pb = state.cells[b];
  if (!pa || !pb) return { valid: false, events: [{ t: 'swap', a, b, ok: false }], reason: 'blocked' };   // an obstacle is in the way
  if ((pa.a && pb.s === 'rainbow') || (pb.a && pa.s === 'rainbow')) return { valid: false, events: [{ t: 'swap', a, b, ok: false }], reason: 'artefact' };
  [state.cells[a], state.cells[b]] = [pb, pa];     // pa is now at b (the cell the player swapped INTO), pb at a
  let mode = null;
  if (pa.s === 'rainbow' || pb.s === 'rainbow') mode = 'rainbow';
  else if (pa.s && pb.s) mode = 'combo';
  else if (findMatches(state.cells, w, h).length) mode = 'match';
  if (!mode) {
    [state.cells[a], state.cells[b]] = [pa, pb];
    return { valid: false, events: [{ t: 'swap', a, b, ok: false }], reason: 'no-match' };
  }

  const events = [{ t: 'swap', a, b, ok: true }];
  state.moves -= 1;
  const move = { groups: [], steps: 0, biggest: 0 };
  const fired = new Set();                          // each special fires at most once per move
  let activation = mode === 'match' ? null : activationFor(state, mode, a, b, pa, pb);
  if (activation) events.push({ t: 'combo', a, b, kinds: [pa.s, pb.s].filter(Boolean), mode });
  for (;;) {
    let groups = [];
    if (!activation) { groups = findGroups(state.cells, w, h); if (!groups.length) break; }
    move.steps += 1;
    clearStep(state, move, groups, activation, move.steps === 1 ? b : -1, fired, events);
    activation = null;
    events.push(gravity(state));
    while (collectArtefacts(state, events)) events.push(gravity(state));
  }
  state.status = judge(state);
  if (state.status === 'playing') {                // hazards act after the board settled: lava heats, tar spreads
    const hz = hazards(state, move.tarCleared);
    if (hz.length) { events.push(...hz); events.push(gravity(state)); while (collectArtefacts(state, events)) events.push(gravity(state)); }
    for (let guard = 0; hz.length && guard < 20; guard++) {   // a refill after an eruption can make a match: resolve it like any cascade
      const groups = findGroups(state.cells, w, h); if (!groups.length) break;
      move.steps += 1; clearStep(state, move, groups, null, -1, fired, events); events.push(gravity(state));
      while (collectArtefacts(state, events)) events.push(gravity(state));
    }
    state.status = judge(state);
  }
  if (state.status === 'playing' && !hasMove(state)) events.push(reshuffle(state));
  events.push({ t: 'end', status: state.status, stars: state.status === 'won' ? starsFor(state) : 0 });
  return { valid: true, events, dug: state.dug, status: state.status };
}

// What a special-to-special swap or a rainbow swap does: { cells (cleared up front), seeds (chain activations) }.
function activationFor(state, mode, a, b, pa, pb) {
  const { w, h } = state, cells = state.cells;
  const base = new Set([a, b]);
  if (mode === 'rainbow') {
    const rb = pa.s === 'rainbow' ? pa : pb, other = rb === pa ? pb : pa, ri = rb === pa ? b : a;
    if (other.s === 'rainbow') return { cells: cells.map((_, i) => i).filter((i) => cells[i] && !cells[i].a), seeds: [{ i: ri, ids: [pa.id, pb.id], kind: 'combo', effect: { shape: 'board' } }] };
    if (other.s) {                                    // rainbow + special: every gem of that colour becomes that special, then all fire
      for (let i = 0; i < cells.length; i++) {
        const p = cells[i];
        if (p && !p.s && !p.a && p.c === other.c) { p.s = other.s; p.o = other.o || ((i + Math.floor(i / w)) % 2 ? 'v' : 'h'); base.add(i); }
      }
      return { cells: [...base], seeds: [{ i: ri, ids: [rb.id], kind: 'rainbow', effect: { shape: 'colour' }, colour: -2 }], converted: true };
    }
    return { cells: [...base], seeds: [{ i: ri, ids: [rb.id], kind: 'rainbow', effect: { shape: 'colour' }, colour: other.c }] };   // rainbow + gem
  }
  const combo = comboFor(pa.s, pb.s);
  return { cells: [...base], seeds: [{ i: b, ids: [pa.id, pb.id], kind: 'combo', effect: combo || SPECIALS[pa.s].effect, o: pa.o || 'h', combo: [pa.s, pb.s] }] };
}

// One clear step: matched groups (and/or an activation) -> specials created, chain resolved, cells cleared.
function clearStep(state, move, groups, activation, swappedTo, fired, events) {
  const { w, h } = state, step = move.steps;
  const base = new Set(), creates = [];
  let hitEvent = null;
  for (const g of groups) {
    g.cells.forEach((i) => base.add(i));
    const info = classify(g, state.specials);
    if (info) creates.push({ i: spawnCell(g, info, swappedTo), kind: info.kind, o: info.o, c: info.kind === 'rainbow' ? -1 : g.c });
    move.biggest = Math.max(move.biggest, ...g.runs.map((r) => r.cells.length));
  }
  if (activation) activation.cells.forEach((i) => base.add(i));
  const res = runChain(state.cells, w, h, base, activation ? activation.seeds : [], { fired });
  // a rainbow that was converted into "all colours" has no colour: seeds with colour -2 mean "colour of the partner special"
  const cleared = res.cleared.filter((i) => state.cells[i] && !state.cells[i].a);
  const info = cleared.map((i) => ({ i, id: state.cells[i].id, c: state.cells[i].c, s: state.cells[i].s || null }));
  move.groups.push(cleared.length);
  const gained = cleared.length * CONFIG.score.perGem * step;
  state.score += gained;
  if (res.fires.length) events.push({ t: 'fire', step, fires: res.fires });
  events.push({ t: 'clear', step, cells: info, score: gained });
  creditClear(state, info.map((x) => x.c));
  const inGroup = new Set(groups.flatMap((g) => g.cells));
  const blastCells = new Set(res.fires.flatMap((f) => f.area || f.cells));
  const oh = hitObstacles(state, inGroup, blastCells);
  if (oh.length) { events.push({ t: 'obstacle', step, hits: oh }); if (oh.some((e) => e.k === 'tar' && e.broke)) move.tarCleared = true; }
  const hits = digStep(state.blocks, groups.map((g) => ({ c: g.c, n: g.cells.length })), info.filter((x) => !inGroup.has(x.i)).map((x) => x.c));
  state.dug = dugCount(state.blocks);
  if (hits.length) hitEvent = { t: 'hit', step, hits, dug: state.dug, total: state.dirtTotal };
  for (const i of cleared) state.cells[i] = null;
  for (const c of creates) {
    const p = { id: state.nextId++, c: c.c, s: c.kind, o: c.o || 'h' };
    state.cells[c.i] = p;
    events.push({ t: 'create', step, i: c.i, id: p.id, c: p.c, s: p.s, o: p.o });
  }
  if (hitEvent) events.push(hitEvent);
}

// Gems fall within the free stretch of their column (obstacles are fixed); every stretch refills from its own top.
function gravity(state) {
  const { w, h } = state;
  const moves = [], spawns = [];
  const blocked = (i) => !!state.obst[i];
  for (let x = 0; x < w; x++) {
    let bottom = h - 1;
    while (bottom >= 0) {
      if (blocked(bottom * w + x)) { bottom--; continue; }
      let top = bottom; while (top - 1 >= 0 && !blocked((top - 1) * w + x)) top--;
      let write = bottom;
      for (let y = bottom; y >= top; y--) {
        const p = state.cells[y * w + x];
        if (!p) continue;
        if (write !== y) {
          state.cells[write * w + x] = p;
          state.cells[y * w + x] = null;
          moves.push({ id: p.id, from: y * w + x, to: write * w + x });
        }
        write--;
      }
      // refill the empty cells at the top of the stretch; `fromRow` is above the stretch (negative above the board)
      const empty = write + 1;
      for (let y = write; y >= top; y--) {
        const p = newPiece(state, randColor(state));
        state.cells[y * w + x] = p;
        spawns.push({ id: p.id, c: p.c, to: y * w + x, fromRow: y - empty + top });
      }
      bottom = top - 1;
    }
  }
  return { t: 'fall', moves, spawns };
}

// An artefact that reached the bottom row is collected (it leaves the board and the cell refills).
function collectArtefacts(state, events) {
  const { w, h } = state, items = [];
  for (let x = 0; x < w; x++) {
    const i = (h - 1) * w + x, p = state.cells[i];
    if (p && p.a) { items.push({ i, id: p.id, kind: 'artefact' }); state.cells[i] = null; state.found.artefact += 1; }
  }
  if (items.length) events.push({ t: 'collect', items });
  return items.length > 0;
}

// Dead board: no legal move left. FAIR reshuffle: specials stay where they are; only plain gems are shuffled, and only into a
// position with no match and at least one legal move. Never creates an instant match. (Obstacles will stay put the same way.)
export function reshuffle(state) {
  const { w, h } = state;
  const slots = [];
  state.cells.forEach((p, i) => { if (p && !p.s && !p.a) slots.push(i); });
  const pieces = slots.map((i) => state.cells[i]);
  const from = new Map(slots.map((i) => [state.cells[i].id, i]));
  for (let tries = 0; tries < 100; tries++) {
    const order = shuffle(state.rng, pieces.slice());
    const trial = state.cells.slice();
    slots.forEach((i, k) => { trial[i] = order[k]; });
    if (!findMatches(trial, w, h).length && legalSwaps(trial, w, h).length) {
      state.cells = trial;
      return { t: 'shuffle', moves: slots.map((to, k) => ({ id: order[k].id, from: from.get(order[k].id), to })) };
    }
  }
  // fallback: brand new plain gems in the plain slots (specials untouched)
  for (let tries = 0; tries < 200; tries++) {
    for (const i of slots) state.cells[i] = { id: state.nextId++, c: randColor(state) };
    if (!findMatches(state.cells, w, h).length && legalSwaps(state.cells, w, h).length) return { t: 'shuffle', moves: [], fresh: true };
  }
  throw new Error('could not reshuffle');
}

// Grant extra moves after a near-miss offer was accepted (coins or rewarded ad). Back to 'playing'.
export function addMoves(state, n) {
  state.moves += n;
  state.movesMax += n;
  state.extended = (state.extended || 0) + 1;
  state.status = judge(state);
  return state;
}

// ---- extras the UI needs ----------------------------------------------------------------
export const serialize = (state) => JSON.stringify(state);
export const deserialize = (s) => JSON.parse(s);
