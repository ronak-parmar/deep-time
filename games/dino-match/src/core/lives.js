import { CONFIG } from './config.js';

// Lives regenerate on a timer, computed from timestamps (ms since epoch) so it survives reloads.
// Every function takes `now` explicitly: the clock is injectable, tests pass fake times.
// profile.lastLifeTimestamp is when the regeneration clock last ticked; null while lives are full.
const interval = () => CONFIG.lives.regenMinutes * 60 * 1000;

// Credit every life earned up to `now`. Returns a new profile.
export function syncLives(profile, now) {
  const max = CONFIG.lives.max;
  if (profile.lives >= max) return { ...profile, lives: max, lastLifeTimestamp: null };
  if (profile.lastLifeTimestamp == null || profile.lastLifeTimestamp > now) {
    // no clock yet, or the device clock went backwards: restart the clock from now
    return { ...profile, lastLifeTimestamp: now };
  }
  const gained = Math.floor((now - profile.lastLifeTimestamp) / interval());
  if (gained <= 0) return profile;
  const lives = Math.min(max, profile.lives + gained);
  return { ...profile, lives, lastLifeTimestamp: lives >= max ? null : profile.lastLifeTimestamp + gained * interval() };
}

// A lost level costs one life (never below 0). Starts the regeneration clock if it was not running.
export function loseLife(profile, now) {
  const p = syncLives(profile, now);
  if (p.lives <= 0) return p;
  return { ...p, lives: p.lives - 1, lastLifeTimestamp: p.lastLifeTimestamp ?? now };
}

// Milliseconds until the next life, or null when lives are full.
export function nextLifeIn(profile, now) {
  const p = syncLives(profile, now);
  if (p.lives >= CONFIG.lives.max) return null;
  return Math.max(0, p.lastLifeTimestamp + interval() - now);
}

export const canStartLevel = (profile, now) => syncLives(profile, now).lives > 0;

// Full refill (after paying coins or watching a rewarded ad; the caller does the paying).
export const refillLives = (profile) => ({ ...profile, lives: CONFIG.lives.max, lastLifeTimestamp: null });
