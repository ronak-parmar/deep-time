import { CONFIG } from './config.js';
import { makeRng, next, int, shuffle } from './rng.js';
import { adjacent, findMatches, validSwaps } from './board.js';
import { digForMove, judge, starsFor } from './rules.js';

// ---- state ------------------------------------------------------------------------------
// state = { level, w, h, colors, cells, rng, nextId, moves, movesMax, dug, dirtTotal, dirtOrder,
//           score, status, combo }   (plain JSON, so it saves as is)

const newPiece = (state, c) => ({ id: state.nextId++, c });
const randColor = (state) => int(state.rng, state.colors);

export function createState(level) {
  const state = {
    level: level.level, w: level.w, h: level.h, colors: level.colors,
    cells: [], rng: makeRng(level.seed), nextId: 1,
    moves: level.moves, movesMax: level.moves,
    dug: 0, dirtTotal: level.dirtTotal, dirtOrder: level.dirtOrder.slice(),
    score: 0, status: 'playing'
  };
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
      do {
        c = randColor(state);
        state.cells[i] = { id: state.nextId++, c };
      } while (findMatches(state.cells, w, h).length && ++guard < 20);
    }
    if (!findMatches(state.cells, w, h).length && validSwaps(state.cells, w, h).length) return;
  }
  throw new Error('could not build a playable board');
}

export const hasMove = (state) => validSwaps(state.cells, state.w, state.h).length > 0;
export const hintMove = (state) => validSwaps(state.cells, state.w, state.h)[0] || null;

// ---- one move ---------------------------------------------------------------------------
// swap(state, a, b) mutates the state to its final position and returns a result with an event
// log the renderer replays:
//   { valid:false, events:[{t:'swap',a,b,ok:false}] }
//   { valid:true, events:[swap, clear, dig, fall, (clear, fall)..., shuffle?, end], dug, status }
export function swap(state, a, b) {
  const { w, h } = state;
  if (state.status !== 'playing') return { valid: false, events: [], reason: 'over' };
  if (a < 0 || b < 0 || a >= w * h || b >= w * h || !adjacent(a, b, w)) return { valid: false, events: [], reason: 'not-adjacent' };

  [state.cells[a], state.cells[b]] = [state.cells[b], state.cells[a]];
  if (!findMatches(state.cells, w, h).length) {
    [state.cells[a], state.cells[b]] = [state.cells[b], state.cells[a]];
    return { valid: false, events: [{ t: 'swap', a, b, ok: false }], reason: 'no-match' };
  }

  const events = [{ t: 'swap', a, b, ok: true }];
  state.moves -= 1;
  const move = { groups: [], steps: 0, biggest: 0 };
  let m;
  while ((m = findMatches(state.cells, w, h)).length) {
    move.steps += 1;
    move.groups.push(m.length);
    move.biggest = Math.max(move.biggest, runLength(state, m));
    const gained = m.length * CONFIG.score.perGem * move.steps;
    state.score += gained;
    events.push({ t: 'clear', step: move.steps, cells: m.map((i) => ({ i, id: state.cells[i].id, c: state.cells[i].c })), score: gained });
    for (const i of m) state.cells[i] = null;
    if (move.steps === 1) events.push(digEvent(state, move)); // the dig for this move
    events.push(gravity(state));
  }
  // cascades never dig in v1 (the hook lives in digForMove)
  state.status = judge(state);
  if (state.status === 'playing' && !hasMove(state)) events.push(reshuffle(state));
  events.push({ t: 'end', status: state.status, stars: state.status === 'won' ? starsFor(state) : 0 });
  return { valid: true, events, dug: state.dug, status: state.status };
}

// Longest straight run among cleared cells (informational, used by the optional 4+ hook).
function runLength(state, cleared) {
  const set = new Set(cleared);
  let best = 0;
  for (const i of cleared) {
    for (const d of [1, state.w]) {
      let n = 1;
      while (set.has(i + d * n) && (d === state.w || (i % state.w) + n < state.w)) n++;
      best = Math.max(best, n);
    }
  }
  return best;
}

function digEvent(state, move) {
  const want = Math.min(digForMove(move), state.dirtTotal - state.dug);
  const blocks = state.dirtOrder.slice(state.dug, state.dug + want);
  state.dug += want;
  return { t: 'dig', blocks, dug: state.dug, total: state.dirtTotal };
}

function gravity(state) {
  const { w, h } = state;
  const moves = [], spawns = [];
  for (let x = 0; x < w; x++) {
    let write = h - 1;
    for (let y = h - 1; y >= 0; y--) {
      const p = state.cells[y * w + x];
      if (!p) continue;
      if (write !== y) {
        state.cells[write * w + x] = p;
        state.cells[y * w + x] = null;
        moves.push({ id: p.id, from: y * w + x, to: write * w + x });
      }
      write--;
    }
    // refill the empty top cells; `fromRow` is negative (above the board)
    const empty = write + 1;
    for (let y = write; y >= 0; y--) {
      const p = newPiece(state, randColor(state));
      state.cells[y * w + x] = p;
      spawns.push({ id: p.id, c: p.c, to: y * w + x, fromRow: y - empty });
    }
  }
  return { t: 'fall', moves, spawns };
}

// Deadlock: no valid swap left. Reshuffle the same pieces until there are no matches and a move exists.
export function reshuffle(state) {
  const { w, h } = state;
  const before = state.cells.map((p, i) => ({ id: p.id, from: i }));
  for (let tries = 0; tries < 100; tries++) {
    const pieces = shuffle(state.rng, state.cells.slice());
    if (!findMatches(pieces, w, h).length && validSwaps(pieces, w, h).length) {
      state.cells = pieces;
      return { t: 'shuffle', moves: pieces.map((p, to) => ({ id: p.id, from: before.find((b) => b.id === p.id).from, to })) };
    }
  }
  // fallback: brand new pieces
  fillBoard(state);
  return { t: 'shuffle', moves: [], fresh: true };
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
