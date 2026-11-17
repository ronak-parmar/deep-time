// First-time tutorial for levels 1 to 6 (owner request): one idea per level, shown once, skippable, state kept in the profile.
// Pure data + functions. The overlay itself is screens/tutorial.js. Levels 1-6 use fixed seed boards (level.js `seed`) whose starting
// layout always holds a valid move of the wanted colour, so the hand pointer always has a swap to show.
import { CONFIG } from './config.js';
import { legalSwaps, findGroups } from './match.js';

// steps: spot = what stays lit ('target' HUD panel, 'board', 'plaque', 'moves'); text may use {colour}; tap = tap anywhere to
// continue, hand = animated hand pointer showing `want`'s swap, until:'move' = the step ends when the player makes a valid move.
// want = { size, straight? }: the swap the hand shows makes a match of that many gems of a target colour.
export const TUTORIAL = {
  1: { want: { size: 3 }, steps: [
    { spot: 'target', text: 'Break {colour} gems! This is your target.', tap: true },
    { spot: 'board', text: 'Swap these two gems to line up 3 {colour} gems.', hand: true, until: 'move' }] },
  2: { want: { size: 3 }, steps: [
    { spot: 'target', text: 'Other colours still use a move but do not count toward the target.', tap: true }] },
  3: { want: { size: 3 }, steps: [
    { spot: 'target', text: 'Two targets this time. Finish both before the moves run out.', tap: true },
    { spot: 'board', text: 'Hint: match 4 gems in a line to make a Firecracker.', tap: true }] },
  4: { want: { size: 3 }, steps: [
    { spot: 'board', text: 'Gems that fall can match again. Chains of matches count too.', tap: true }] },
  5: { want: { size: 4, straight: true }, steps: [
    { spot: 'board', text: 'Match 4 in a line to make a Firecracker. Match it later to blast a row or column.', hand: true, until: 'move' }] },
  6: { want: { size: 3 }, steps: [
    { spot: 'plaque', text: 'Match the colours shown on the blocks to dig.', tap: true }] }
};
export const TUTORIAL_LEVELS = Object.keys(TUTORIAL).map(Number);

// Colours the tutorial move should be of: the collect targets, else the plaque block colours.
export function wantColours(state) {
  const c = state.targets.filter((t) => t.type === 'collect').map((t) => t.c);
  return c.length ? c : [...new Set((state.blocks || []).map((b) => b.c))];
}

// The swap the hand shows: a legal swap making a match of exactly want.size gems (a straight run when want.straight) of a wanted
// colour. Returns [a, b] or null.
export function tutorialMove(state, want = { size: 3 }, colours = wantColours(state)) {
  const { cells, w, h } = state;
  for (const [a, b] of legalSwaps(cells, w, h)) {
    if (cells[a].s || cells[b].s) continue;
    [cells[a], cells[b]] = [cells[b], cells[a]];
    const ok = findGroups(cells, w, h).some((g) => colours.includes(g.c) && g.cells.length === want.size && (!want.straight || (g.runs.length === 1 && g.runs[0].cells.length === want.size)));
    [cells[a], cells[b]] = [cells[b], cells[a]];
    if (ok) return [a, b];
  }
  return null;
}

// ---- persistence (profile.tutorial = { seen: [levels], off: boolean }) ------------------------------------------
export const freshTutorial = () => ({ seen: [], off: false });
export function normaliseTutorial(raw) {
  const t = raw && typeof raw === 'object' ? raw : {};
  return { seen: Array.isArray(t.seen) ? [...new Set(t.seen.map(Number).filter((n) => TUTORIAL[n]))].sort((a, b) => a - b) : [], off: !!t.off };
}
// Shown once per level, only on levels 1-6, never after Skip, and never on a level the player has already won.
export const needsTutorial = (profile, level) => !!TUTORIAL[level] && !normaliseTutorial(profile.tutorial).off && !normaliseTutorial(profile.tutorial).seen.includes(level) && !(level in (profile.stars || {}));
export function markTutorialSeen(profile, level) {
  const t = normaliseTutorial(profile.tutorial);
  return { ...profile, tutorial: { ...t, seen: [...new Set([...t.seen, level])].sort((a, b) => a - b) } };
}
// Skip turns the whole tutorial off (it is skippable at any time, and stays skipped).
export const skipTutorial = (profile) => ({ ...profile, tutorial: { ...normaliseTutorial(profile.tutorial), off: true } });
void CONFIG;
