// Booster rules that need no board animation: which cells a booster touches, whether a target is legal, and the profile side
// (owned counts, buying, gifts). The board change itself is useBooster() in game.js, which reuses the match/blast pipeline so
// goals, dig hits, obstacles, chains and the reshuffle all behave exactly as after a move. Pure; no DOM.
import { CONFIG } from './config.js';
import { BOOSTERS } from '../data/boosters.js';
import { int } from './rng.js';

const hittable = (state, i) => { const o = state.obst[i]; return !!o && o.hp !== Infinity && o.hp > 0; };
const plainGem = (p) => !!p && !p.a;

// Cells a booster would touch for a target tile (a board index; ignored by 'none' boosters). null = illegal target (nothing happens, nothing is spent).
//   gems:  cells whose gem is cleared (as a blast: specials fire, goals and dig blocks count)
//   strike: cells whose obstacle loses one layer (even ones a blast cannot hurt)
export function boosterTargets(state, id, i) {
  const b = BOOSTERS[id]; if (!b || !state || state.status !== 'playing') return null;
  const { w, h, cells } = state;
  const inBoard = (j) => j >= 0 && j < w * h;
  switch (b.target) {
    case 'cell': {
      if (!inBoard(i)) return null;
      const gem = plainGem(cells[i]), strike = hittable(state, i);
      return gem || strike ? { gems: gem ? [i] : [], strike: strike ? [i] : [], area: [i] } : null;
    }
    case 'row': {
      if (!inBoard(i)) return null;
      const y = Math.floor(i / w), row = Array.from({ length: w }, (_, x) => y * w + x);
      const gems = row.filter((j) => plainGem(cells[j]));
      return gems.length || row.some((j) => hittable(state, j)) ? { gems, strike: [], area: row } : null;
    }
    case 'area': {
      if (!inBoard(i)) return null;
      const cx = Math.min(w - 2, Math.max(1, i % w)), cy = Math.min(h - 2, Math.max(1, Math.floor(i / w)));   // keep the 3x3 on the board
      const area = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) area.push((cy + dy) * w + cx + dx);
      const strike = area.filter((j) => hittable(state, j));
      return strike.length ? { gems: [], strike, area } : null;     // nothing to sweep: not allowed, so it is never wasted
    }
    case 'colour': {
      const p = cells[i]; if (!plainGem(p) || p.c < 0) return null;
      const gems = []; cells.forEach((q, j) => { if (plainGem(q) && q.c === p.c) gems.push(j); });
      return { gems, strike: [], area: gems, colour: p.c };
    }
    case 'none': return { gems: [], strike: [], area: [] };
    default: return null;
  }
}
export const isBlastBooster = (id) => ['pick', 'rockslide', 'amber'].includes(id);

// ---- profile side (pure: return a new profile, or null when it is not possible) ----------------------------------------
export const owned = (profile, id) => Math.max(0, (profile.boosters && profile.boosters[id]) || 0);
export const withBooster = (profile, id, n) => ({ ...profile, boosters: { ...profile.boosters, [id]: Math.max(0, owned(profile, id) + n) } });
export const spendBooster = (profile, id) => (owned(profile, id) > 0 ? withBooster(profile, id, -1) : null);
export function buyBooster(profile, id) {
  const b = BOOSTERS[id]; if (!b || profile.coins < b.price) return null;
  return { ...withBooster(profile, id, 1), coins: profile.coins - b.price };
}
// the free one given when the intro card is shown
export const giftBooster = (profile, id) => withBooster(profile, id, BOOSTERS[id]?.gift || 0);

// ---- pre-level boosters (applied once, right after the board is built) --------------------------------------------------
// start3: more moves. lucky: one random plain gem becomes a random special (never changes colours, so no instant match appears).
export function applyPreBooster(state, id) {
  if (id === 'start3') { state.moves += CONFIG.boosters.preMoves; state.movesMax += CONFIG.boosters.preMoves; return { id, moves: CONFIG.boosters.preMoves }; }
  if (id === 'lucky') {
    const allowed = CONFIG.boosters.luckySpecials.filter((k) => state.specials.includes(k)), kinds = allowed.length ? allowed : state.specials.filter((k) => k !== 'rainbow');
    if (!kinds.length) return null;
    const free = []; state.cells.forEach((p, i) => { if (p && !p.s && !p.a) free.push(i); });
    if (!free.length) return null;
    const rnd = (n) => int(state.rng, n);
    const i = free[rnd(free.length)], kind = kinds[rnd(kinds.length)];
    state.cells[i] = { ...state.cells[i], s: kind, o: rnd(2) ? 'v' : 'h' };
    return { id, i, kind };
  }
  return null;
}
