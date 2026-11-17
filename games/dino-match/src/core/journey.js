// The journey as the player sees it (pure, unit tested): which eras are open, how far each one is, stars and fossils per era.
// Level numbers are continuous across the journey (Cambrian 1-150, Devonian 151-300, ...), TOTAL_LEVELS in all.
import { ERAS, TOTAL_LEVELS, cycleOf } from './eras.js';
import { CONFIG } from './config.js';

const inCycle = (level) => ((Math.max(1, Math.floor(level)) - 1) % TOTAL_LEVELS) + 1;

// every level of an era, in order
export const eraLevels = (era) => Array.from({ length: era.levels }, (_, i) => era.start + i);

// state of one level for a profile: 'done' (won before), 'current' (the next one to play), 'open' (reachable, not won), 'locked'
export function levelState(profile, n) {
  const cur = profile.level, later = cycleOf(cur) > 0;
  if (n in (profile.stars || {})) return 'done';
  if (later) return n === inCycle(cur) ? 'current' : 'open';
  if (n === cur) return 'current';
  return n < cur ? 'open' : 'locked';
}
export const bestStars = (profile, n) => Math.max(0, Math.min(3, (profile.stars || {})[n] || 0));

export function eraUnlocked(profile, era) { return cycleOf(profile.level) > 0 || profile.level >= era.start; }

// { won, levels, stars, maxStars, fossils, totalFossils, state: 'locked' | 'current' | 'done' | 'open', unlockAt }
export function eraStats(profile, era) {
  let won = 0, stars = 0;
  for (let n = era.start; n <= era.end; n++) if (n in (profile.stars || {})) { won++; stars += bestStars(profile, n); }
  const done = new Set(profile.completedFossils || []), fossils = era.fossils.filter((f) => done.has(f)).length;
  const lvl = inCycle(profile.level), unlocked = eraUnlocked(profile, era);
  const state = !unlocked ? 'locked' : (lvl >= era.start && lvl <= era.end) ? 'current' : won === era.levels ? 'done' : 'open';
  return { won, levels: era.levels, stars, maxStars: era.levels * 3, fossils, totalFossils: era.fossils.length, state, unlockAt: era.start };
}
export const journeyStats = (profile) => ERAS.map((e) => eraStats(profile, e));

// the fossil block a level belongs to (50 levels per fossil) and whether the level ends that block
export function fossilBlockOf(era, n) {
  const PER = CONFIG.fossils.levelsPerFossil, i = Math.floor((n - era.start) / PER);
  return { index: i, fossil: era.fossils[i], first: era.start + i * PER, last: era.start + i * PER + PER - 1 };
}
