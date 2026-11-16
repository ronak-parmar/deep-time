import { CONFIG } from './config.js';
import { next, int, makeRng } from './rng.js';
import { validSwaps } from './board.js';
import { createState, swap } from './game.js';

// A casual-player bot: mostly takes the first good-looking valid swap, sometimes a random one.
// Used to check a level is winnable and to nudge the move budget into the target band.
export function botPlay(level, seed) {
  const state = createState(level);
  const r = makeRng(seed);
  let guard = 0;
  while (state.status === 'playing' && guard++ < 200) {
    const options = validSwaps(state.cells, state.w, state.h);
    if (!options.length) break;
    const pick = next(r) < CONFIG.levels.botSloppy ? options[int(r, options.length)] : options[int(r, Math.min(options.length, 3))];
    swap(state, pick[0], pick[1]);
  }
  return state;
}

export function winRate(level, sims = CONFIG.levels.sims) {
  let wins = 0;
  for (let s = 0; s < sims; s++) if (botPlay(level, level.seed * 31 + s + 1).status === 'won') wins++;
  return wins / sims;
}
