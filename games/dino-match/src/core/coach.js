// In-context onboarding (M8, "coach"): pure rules, no DOM. Yuvi teaches one thing at a time, only when it becomes relevant, and each
// step waits for the player. Which steps ran is kept in profile.coach = { off, done: [step ids] }; specials use the intro seen list
// (profile.tutorial.intros) so the How to play page unlocks them too. The overlay is screens/coach.js, the triggers are in main.js.
import { COACH_STEPS } from '../data/yuvi.js';
import { seenIntros } from '../data/intros.js';
import { KINDS } from './specials.js';
import { legalSwaps } from './match.js';

export const freshCoach = () => ({ off: false, done: [] });
export function normaliseCoach(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  return { off: !!c.off, done: Array.isArray(c.done) ? [...new Set(c.done.filter((x) => COACH_STEPS.includes(x)))] : [] };
}
export const coachDone = (profile, id) => normaliseCoach(profile.coach).done.includes(id);
export const coachNeeded = (profile, id) => !normaliseCoach(profile.coach).off && !coachDone(profile, id);
export const markCoach = (profile, ...ids) => { const c = normaliseCoach(profile.coach); return { ...profile, coach: { ...c, done: [...new Set([...c.done, ...ids])] } }; };
export const skipCoach = (profile) => ({ ...profile, coach: { ...normaliseCoach(profile.coach), off: true } });

// v3 -> v4: what an existing save has clearly already done counts as done; everything else it still gets, in context.
export function migrateCoach(raw, p) {
  if (raw && typeof raw === 'object' && raw.coach) return normaliseCoach(raw.coach);
  const done = [];
  if (p.yuvi && p.yuvi.welcomeSeen) done.push('hello');
  if (1 in (p.stars || {})) done.push('goal', 'swap');
  const dug = Object.values(p.fossilProgress || {}).some((n) => n > 0) || (p.completedFossils || []).length > 0;
  if (dug) done.push('pickaxe', 'dig');
  if ((p.completedFossils || []).length) done.push('museum');
  return { off: false, done };
}

// The first special the player has just made that was never explained (or null). events = a move's event log.
export function firstMade(profile, events) {
  if (normaliseCoach(profile.coach).off) return null;
  const seen = seenIntros(profile.tutorial);
  const e = (events || []).find((ev) => ev.t === 'create' && KINDS.includes(ev.s) && !seen.has(ev.s));
  return e ? { kind: e.s, id: e.id, o: e.o } : null;
}
// where a piece is now (after the cascade), by its id
export const cellOf = (state, id) => state.cells.findIndex((c) => c && c.id === id);
// the legal swaps that use the piece at i (a forced first use needs one)
export const swapsWith = (state, i) => legalSwaps(state.cells, state.w, state.h).filter(([a, b]) => a === i || b === i);
// two specials next to each other (the combo step), or null
export function adjacentSpecials(state) {
  const { cells, w, h } = state;
  for (let i = 0; i < w * h; i++) {
    if (!cells[i]?.s) continue;
    const x = i % w;
    if (x + 1 < w && cells[i + 1]?.s) return [i, i + 1];
    if (Math.floor(i / w) + 1 < h && cells[i + w]?.s) return [i, i + w];
  }
  return null;
}
// a coach step can limit the board to some swaps: { pair: [a, b] } (exactly that swap) or { cell: i } (any swap using cell i)
export function swapAllowed(guard, a, b) {
  if (!guard) return true;
  if (guard.pair) { const [x, y] = guard.pair; return (a === x && b === y) || (a === y && b === x); }
  if (guard.cell != null) return a === guard.cell || b === guard.cell;
  return true;
}
