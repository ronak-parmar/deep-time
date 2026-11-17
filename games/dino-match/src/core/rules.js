import { CONFIG } from './config.js';
import { targetsDone, remainingUnits } from './targets.js';

// THE dig rule. Nothing else in the game knows how digging works. Pure functions.
// A block is { t:'tar'|'sand'|'stone', c: gem colour, hp, max }. hp <= 0 means dug out.
const table = () => CONFIG.dig.hitsByMatchSize;
// hits dealt by one match of n cells (3 -> 1, 4 -> 2, 5+ -> 3)
export function hitsForMatch(n) {
  const t = table(), top = Math.max(...Object.keys(t).map(Number));
  return n < 3 ? 0 : t[Math.min(n, top)];
}
// hits dealt to ONE colour by a special's blast that cleared n gems of that colour (at least 1 when any were cleared)
export const hitsForBlast = (n) => (n <= 0 ? 0 : Math.max(1, hitsForMatch(n)));

export function makeBlock(t, c) { const hp = CONFIG.dig.blockTypes[t].hp; return { t, c, hp, max: hp }; }

// Apply `hits` hits of colour c: each hit damages the first block (plaque order) of that colour that is still standing.
// Wrong colours do nothing. Mutates blocks; returns [{ b, hp, max, c, broke }] one entry per hit that landed.
export function applyHits(blocks, c, hits) {
  const out = [];
  for (let k = 0; k < hits; k++) {
    const b = blocks.findIndex((x) => x.c === c && x.hp > 0);
    if (b < 0) break;
    blocks[b].hp -= 1;
    out.push({ b, hp: blocks[b].hp, max: blocks[b].max, c, broke: blocks[b].hp <= 0 });
  }
  return out;
}

// One clear step. matches = [{ c, n }] (plain match groups), blast = array of colours of gems cleared by special activations.
// Returns the hit list in order (matches first, then blasts by colour).
export function digStep(blocks, matches, blast = []) {
  const out = [];
  for (const m of matches) out.push(...applyHits(blocks, m.c, hitsForMatch(m.n)));
  const byColour = new Map();
  for (const c of blast) if (c >= 0) byColour.set(c, (byColour.get(c) || 0) + 1);
  for (const [c, n] of [...byColour].sort((a, b) => a[0] - b[0])) out.push(...applyHits(blocks, c, hitsForBlast(n)));
  return out;
}
export const dugCount = (blocks) => blocks.filter((b) => b.hp <= 0).length;
export const hitPointsLeft = (blocks) => blocks.reduce((a, b) => a + Math.max(0, b.hp), 0);

// THE win/lose rule. Returns 'won', 'lost' or 'playing'.
export function judge(state) {
  if (targetsDone(state)) return 'won';
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
  const left = remainingUnits(state);
  const used = state.extended || 0;
  if (left > CONFIG.nearMiss.blocks || used >= CONFIG.nearMiss.maxPerAttempt) return null;
  return { extraMoves: CONFIG.nearMiss.extraMoves, coinCost: CONFIG.nearMiss.coinCost, blocksLeft: left };
}
