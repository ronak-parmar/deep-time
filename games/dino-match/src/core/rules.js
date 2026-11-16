import { CONFIG } from './config.js';

// THE dig rule. Nothing else in the game knows how digging works.
// `move` describes what a valid swap did: { groups: [cellCount...per cascade step], steps }.
// Returns how many dirt blocks this move digs (before clamping to what is left).
export function digForMove(move) {
  let n = CONFIG.dig.perValidMove;
  if (CONFIG.dig.extraBigMatch && move.biggest >= 4) n += CONFIG.dig.extraBigMatch;
  if (CONFIG.dig.extraPerCascadeStep && move.steps >= 2) n += CONFIG.dig.extraPerCascadeStep * (move.steps - 1);
  return n;
}

// THE win/lose rule. Returns 'won', 'lost' or 'playing'.
export function judge(state) {
  if (state.dug >= state.dirtTotal) return 'won';
  if (state.moves <= 0) return 'lost';
  return 'playing';
}

// Stars for a win: share of the move budget left over.
export function starsFor(state) {
  const left = state.moves / state.movesMax;
  return left >= CONFIG.stars.three ? 3 : left >= CONFIG.stars.two ? 2 : 1;
}

// Near miss: lost with at most CONFIG.nearMiss.blocks dirt blocks left, and the +moves offer not yet
// used this attempt. Returns { extraMoves, coinCost, blocksLeft } or null (show the plain Lose screen).
export function nearMissOffer(state) {
  if (state.status !== 'lost') return null;
  const left = state.dirtTotal - state.dug;
  const used = state.extended || 0;
  if (left > CONFIG.nearMiss.blocks || used >= CONFIG.nearMiss.maxPerAttempt) return null;
  return { extraMoves: CONFIG.nearMiss.extraMoves, coinCost: CONFIG.nearMiss.coinCost, blocksLeft: left };
}
