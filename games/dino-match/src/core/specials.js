// Special pieces as DATA (docs/11 phase A). Pure functions only: no DOM, no randomness.
// A special piece on the board is { id, c, s: kind, o: 'h'|'v' }. Rainbow has c = -1 (no colour, never matches).
import { CONFIG } from './config.js';

export const KINDS = ['firecracker', 'bomb', 'dynamite', 'tnt', 'rainbow'];
// Effects. shape: line (axis from piece.o) | square r (side 2r+1) | diamond r | colour | cross t (band half-width) | board
export const SPECIALS = {
  firecracker: { name: 'Firecracker', effect: { shape: 'line' } },
  bomb:        { name: 'Bomb',        effect: { shape: 'square', r: 1 } },       // 3x3
  dynamite:    { name: 'Dynamite',    effect: { shape: 'diamond', r: 2 } },      // 5x5 diamond
  tnt:         { name: 'TNT',         effect: { shape: 'square', r: 3 } },       // 7x7
  rainbow:     { name: 'Rainbow',     effect: { shape: 'colour' } }              // clears one colour
};
// What each match pattern makes (unique cells). Rule priority lives in match.js: cross/T/L, then straight, then group size.
export const CREATE = { straight4: 'firecracker', straight5: 'rainbow', tl5: 'bomb', cross: 'tnt', group6: 'dynamite', group7: 'tnt' };
// Firecracker axis: 'along' = a horizontal match makes a row-clearer, a vertical match a column-clearer.
export const FIRECRACKER_AXIS = 'along';

// Combination table (two specials swapped together). Rainbow pairs are handled in game.js (colour logic).
export const COMBOS = {
  'firecracker+firecracker': { shape: 'cross', t: 0 },      // row and column
  'firecracker+bomb':        { shape: 'cross', t: 1 },      // 3-wide cross
  'firecracker+dynamite':    { shape: 'cross', t: 2 },
  'firecracker+tnt':         { shape: 'cross', t: 3 },
  'bomb+bomb':               { shape: 'square', r: 2 },     // 5x5
  'bomb+dynamite':           { shape: 'square', r: 3 },     // 7x7
  'bomb+tnt':                { shape: 'square', r: 4 },     // 9x9
  'dynamite+dynamite':       { shape: 'diamond', r: 4 },
  'dynamite+tnt':            { shape: 'square', r: 4 },     // 9x9
  'tnt+tnt':                 { shape: 'board' }
};
export const pairKey = (a, b) => [a, b].sort((x, y) => KINDS.indexOf(x) - KINDS.indexOf(y)).join('+');
export const comboFor = (a, b) => COMBOS[pairKey(a, b)] || null;

export const isSpecial = (p) => !!(p && p.s);
export const unlockedKinds = (level) => KINDS.filter((k) => level >= (CONFIG.specials.unlock[k] ?? Infinity));

// Cells hit by an effect centred on cell i of a w x h board. Returns a sorted array of unique indexes.
// `colour` is used by shape 'colour' (cells = the board cells array so we can read piece colours).
export function effectCells(effect, i, w, h, o = 'h', cells = null, colour = -1) {
  const x0 = i % w, y0 = Math.floor(i / w), out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = Math.abs(x - x0), dy = Math.abs(y - y0);
    let hit = false;
    switch (effect.shape) {
      case 'line': hit = o === 'v' ? dx === 0 : dy === 0; break;
      case 'cross': hit = dx <= effect.t || dy <= effect.t; break;
      case 'square': hit = dx <= effect.r && dy <= effect.r; break;
      case 'diamond': hit = dx + dy <= effect.r; break;
      case 'colour': hit = !!(cells && cells[y * w + x] && cells[y * w + x].c === colour && colour >= 0); break;
      case 'board': hit = true; break;
    }
    if (hit) out.push(y * w + x);
  }
  return out;
}

// The colour a rainbow clears when it fires without a target (hit by a blast): the most common colour, lowest index on ties.
export function dominantColour(cells) {
  const n = {};
  for (const p of cells) if (p && p.c >= 0) n[p.c] = (n[p.c] || 0) + 1;
  let best = -1, cnt = 0;
  for (const [c, k] of Object.entries(n)) if (k > cnt || (k === cnt && +c < best)) { best = +c; cnt = k; }
  return best;
}
