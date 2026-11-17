import { CONFIG } from './config.js';
import { next, int, makeRng } from './rng.js';
import { findMatches } from './board.js';
import { legalSwaps, findGroups } from './match.js';
import { hitsForMatch } from './rules.js';
import { createState, swap } from './game.js';
import { OBSTACLES } from './obstacles.js';
import { SPECIALS, effectCells } from './specials.js';

// A casual-player bot. Mostly it picks the legal swap that digs the most (matches of colours the plaque still needs, bigger
// matches, special pieces), sometimes a random legal swap. Used to check a level is winnable and to calibrate the move budget.
function score(state, a, b) {
  const { cells, w, h } = state, pa = cells[a], pb = cells[b];
  if (pa.s === 'rainbow' || pb.s === 'rainbow') return 7;
  if (pa.s && pb.s) return 8;
  [cells[a], cells[b]] = [pb, pa];
  let v = 0;
  const art = [];                                   // artefacts still to bring down: (column, row)
  if (state.targets.some((t) => t.type === 'drop')) cells.forEach((p, i) => { if (p && p.a) art.push([i % w, Math.floor(i / w)]); });
  const collect = state.targets.filter((t) => t.type === 'collect' && (t.got || 0) < t.n);
  for (const g of findGroups(cells, w, h)) {
    const need = state.blocks.some((x) => x.c === g.c && x.hp > 0);
    v += need ? 10 * hitsForMatch(g.cells.length) : 0.5;
    if (collect.some((t) => t.c === g.c)) v += 4 * g.cells.length;
    const crates = state.obst.map((o, i) => (o && o.k === 'crate' ? i : -1)).filter((i) => i >= 0);
    if (g.cells.length >= 4) v += crates.length && !cells.some((p) => p && p.s) ? 7 : 2;      // makes a special (the bot wants one when crates need a blast)
    if (g.cells.length >= 4 && crates.length) {       // aim the firecracker: a straight 4+ in a row or column that holds crates
      const ys = new Set(g.cells.map((i) => Math.floor(i / w))), xs = new Set(g.cells.map((i) => i % w));
      if (ys.size === 1 && crates.some((j) => Math.floor(j / w) === [...ys][0])) v += 10;
      if (xs.size === 1 && crates.some((j) => j % w === [...xs][0])) v += 10;
    }
    for (const i of g.cells) {            // a special inside the match fires: bonus when its blast covers crates or lots of obstacles
      const sp = cells[i]; if (!sp || !sp.s || !crates.length) continue;
      const area = new Set(effectCells(SPECIALS[sp.s].effect, i, w, h, sp.o || 'h', cells, sp.c));
      v += 12 * crates.filter((j) => area.has(j)).length;
    }
    for (const i of g.cells) {            // matches that touch breakable obstacles, and matches under an artefact
      const x = i % w, y = Math.floor(i / w);
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        const o = j >= 0 && state.obst[j]; if (o && OBSTACLES[o.k].byMatch && o.hp !== Infinity) v += o.k === 'tar' ? 3 : 4;
      }
      for (const [ax, ay] of art) if (ax === x && y > ay) v += 5;
    }
  }
  if (cells[a] && cells[a].s || cells[b] && cells[b].s) v += state.obst.some((o) => o && o.k === 'crate') ? 3 : 0;
  [cells[a], cells[b]] = [pa, pb];
  return v;
}
export function pickMove(state, r) {
  const options = legalSwaps(state.cells, state.w, state.h);
  if (!options.length) return null;
  if (next(r) < CONFIG.levels.botSloppy) return options[int(r, options.length)];
  let best = options[0], bv = -1;
  for (const o of options) { const v = score(state, o[0], o[1]) + next(r) * 0.8; if (v > bv) { bv = v; best = o; } }
  return best;
}

export function botPlay(level, seed) {
  const state = createState(level);
  const r = makeRng(seed);
  let guard = 0;
  while (state.status === 'playing' && guard++ < 200) {
    const m = pickMove(state, r);
    if (!m) break;
    swap(state, m[0], m[1]);
  }
  return state;
}

export function winRate(level, sims = CONFIG.levels.sims) {
  let wins = 0;
  for (let s = 0; s < sims; s++) if (botPlay(level, level.seed * 31 + s + 1).status === 'won') wins++;
  return wins / sims;
}
void findMatches;
