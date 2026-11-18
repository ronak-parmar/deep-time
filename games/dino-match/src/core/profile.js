import { tierInfo } from './difficulty.js';
import { CONFIG } from './config.js';
import { syncLives, loseLife } from './lives.js';
import { freshTutorial, normaliseTutorial } from './tutorial.js';
import { migrateFossilId, fossilById } from './fossils.js';
import { ERAS } from './eras.js';
import { eraUnlocked } from './journey.js';
import { freshCoach, migrateCoach } from './coach.js';

export const PROFILE_VERSION = 4;   // v4 (M8): profile.coach, the in-context onboarding steps

// Yuvi, the helper dino (v3): welcomeSeen = the first-launch welcome ran (or was skipped), met = he has said hello,
// islands = how many islands the player has seen open (a new one gets a surprised + wave on the world map).
export const islandsOpen = (p) => ERAS.filter((e) => eraUnlocked(p, e)).length;
export const freshYuvi = () => ({ welcomeSeen: false, met: false, islands: 1 });

export function newProfile() {
  return {
    v: PROFILE_VERSION,
    level: 1,
    coins: 0,
    pickaxes: 0,
    lives: CONFIG.lives.max,
    lastLifeTimestamp: null,
    fossilProgress: {},          // fossil id -> parts unearthed (0-10)
    completedFossils: [],        // fossil ids
    stars: {},                   // level -> best stars; a level present here has been won
    winStreak: 0,
    boosters: Object.fromEntries(CONFIG.boosters.kinds.map((k) => [k, CONFIG.boosters.start[k] || 0])),
    tutorial: freshTutorial(),    // levels 1-6 first-time tutorial: { seen: [levels], off }
    settings: { consent: null, reducedMotion: null, muted: false, haptics: true, yuvi: true },   // yuvi = Settings > Yuvi tips
    yuvi: freshYuvi(),
    coach: freshCoach()           // in-context onboarding steps done (core/coach.js)
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d) => (Number.isFinite(v) ? v : d);

// Bring any saved profile (v1, v2, or garbage) up to the current version. Never throws.
export function migrateProfile(raw) {
  if (!raw || typeof raw !== 'object') return newProfile();
  const base = newProfile();
  const p = { ...base, ...raw, v: PROFILE_VERSION };
  // best stars per level: whole numbers 0..3 keyed by level; a save without a stars table gets 1 star for every level it had passed
  const hadStars = raw.stars && typeof raw.stars === 'object';
  p.stars = {};
  if (hadStars) for (const [k, v] of Object.entries(raw.stars)) { const n = Math.floor(+k); if (n >= 1) p.stars[n] = Math.max(0, Math.min(3, Math.round(+v) || 0)); }
  else for (let n = 1; n < Math.floor(num(raw.level, 1)); n++) p.stars[n] = 1;
  if (!(raw.v >= 2)) {
    // v1 had no pickaxes: one for every level already won, so nobody loses progress
    p.pickaxes = Object.keys(p.stars).length;
  }
  p.level = Math.max(1, Math.floor(num(p.level, 1)));
  p.coins = Math.max(0, Math.floor(num(p.coins, 0)));
  p.pickaxes = Math.max(0, Math.floor(num(p.pickaxes, 0)));
  p.lives = clamp(Math.floor(num(p.lives, CONFIG.lives.max)), 0, CONFIG.lives.max);
  p.lastLifeTimestamp = Number.isFinite(p.lastLifeTimestamp) ? p.lastLifeTimestamp : null;
  // fossil ids: old saves used "<era>-1"; unknown ids are dropped, parts are clamped to 0..parts
  p.fossilProgress = {};
  for (const [k, v] of Object.entries(raw.fossilProgress && typeof raw.fossilProgress === 'object' ? raw.fossilProgress : {})) {
    const id = migrateFossilId(k);
    if (fossilById(id)) p.fossilProgress[id] = Math.max(p.fossilProgress[id] || 0, clamp(Math.floor(num(v, 0)), 0, CONFIG.fossils.parts));
  }
  p.completedFossils = [...new Set((Array.isArray(raw.completedFossils) ? raw.completedFossils : []).map(migrateFossilId).filter((id) => fossilById(id)))];
  p.boosters = {}; for (const k of CONFIG.boosters.kinds) p.boosters[k] = Math.max(0, Math.floor(num((raw.boosters || {})[k], (base.boosters || {})[k] || 0)));
  p.settings = { ...base.settings, ...(raw.settings || {}) };
  p.tutorial = normaliseTutorial(raw.tutorial);
  // v3: Yuvi. "Yuvi tips" defaults on; a save that already has progress has had its first launch (no welcome, it is in Settings),
  // and the islands it already has open are not new.
  p.settings.yuvi = typeof p.settings.yuvi === 'boolean' ? p.settings.yuvi : true;
  const y = raw.yuvi && typeof raw.yuvi === 'object' ? raw.yuvi : null, played = p.level > 1 || Object.keys(p.stars).length > 0;
  p.yuvi = {
    welcomeSeen: y ? !!y.welcomeSeen : played,
    met: y ? !!y.met : false,
    islands: Math.max(1, Math.min(ERAS.length, Math.floor(num(y && y.islands, islandsOpen(p)))))
  };
  p.coach = migrateCoach(raw, p);   // v4: a save that saw the old welcome still gets every in-context step it has not done
  return p;
}

// What a win pays, before applying it. Pickaxe only on the first win of a level.
export function winRewards(profile, levelNo, stars) {
  const firstWin = !(levelNo in profile.stars), T = tierInfo(levelNo);
  return {
    firstWin, tier: T.id,
    pickaxes: firstWin ? CONFIG.economy.pickaxesPerFirstWin + T.pickaxes : 0,
    coins: Math.round((CONFIG.coins.win + CONFIG.coins.perStar * stars) * T.coins)
  };
}

// Settle a finished level. `result` = { won, stars }. Returns { profile, rewards }.
// A loss costs one life (regeneration is computed from `now`).
export function settleLevel(profile, levelNo, result, now) {
  if (!result.won) {
    return { profile: { ...loseLife(profile, now), winStreak: 0 }, rewards: { firstWin: false, pickaxes: 0, coins: 0, lifeLost: true } };
  }
  const rewards = { ...winRewards(profile, levelNo, result.stars), lifeLost: false };
  const p = syncLives({
    ...profile,
    stars: { ...profile.stars, [levelNo]: Math.max(profile.stars[levelNo] || 0, result.stars) },
    level: Math.max(profile.level, levelNo + 1),
    coins: profile.coins + rewards.coins,
    pickaxes: profile.pickaxes + rewards.pickaxes,
    winStreak: profile.winStreak + 1
  }, now);
  return { profile: p, rewards };
}

// Rewarded "double coins" on the win screen: pays the win coins a second time.
export function doubleCoins(profile, winCoins) {
  return { ...profile, coins: profile.coins + winCoins * (CONFIG.economy.doubleCoinsMultiplier - 1) };
}

export const canAfford = (profile, cost) => profile.coins >= cost;
// Returns the new profile, or null when the player cannot afford it.
export const spendCoins = (profile, cost) => (canAfford(profile, cost) ? { ...profile, coins: profile.coins - cost } : null);

// Merge two saves (local and cloud): higher level, larger coins and pickaxes, best stars,
// furthest fossil progress, union of completed fossils.
export function mergeProfiles(a, b) {
  const stars = { ...a.stars };
  for (const k of Object.keys(b.stars)) stars[k] = Math.max(stars[k] || 0, b.stars[k]);
  const fossilProgress = { ...a.fossilProgress };
  for (const k of Object.keys(b.fossilProgress || {})) fossilProgress[k] = Math.max(fossilProgress[k] || 0, b.fossilProgress[k]);
  const base = a.level >= b.level ? a : b;
  return {
    ...base, stars, fossilProgress,
    level: Math.max(a.level, b.level),
    coins: Math.max(a.coins, b.coins),
    pickaxes: Math.max(a.pickaxes || 0, b.pickaxes || 0),
    completedFossils: [...new Set([...(a.completedFossils || []), ...(b.completedFossils || [])])]
  };
}
