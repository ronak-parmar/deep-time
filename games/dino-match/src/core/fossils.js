import { CONFIG } from './config.js';
import { ERAS } from './eras.js';
import { ROSTER } from '../data/roster.js';

// The fossils come from ONE data file (data/roster.js). Everything here is derived: index, era index, level range.
// Rules (tested in tests/fossils.test.js): a fossil has CONFIG.fossils.parts parts, each costs CONFIG.fossils.pickaxesPerPart
// pickaxes, parts are unearthed in recipe order, the fossil being dug is the first one not yet complete.
const eraIndexById = new Map(ERAS.map((e) => [e.id, e.index]));
export const FOSSILS = ROSTER.map((f, index) => {
  const eraIndex = eraIndexById.get(f.era), era = ERAS[eraIndex], k = era.fossils.indexOf(f.id);
  return { ...f, index, eraIndex, firstLevel: era.start + k * CONFIG.fossils.levelsPerFossil, lastLevel: era.start + (k + 1) * CONFIG.fossils.levelsPerFossil - 1, finale: !!f.script?.finale };
});

export const fossilById = (id) => FOSSILS.find((f) => f.id === id) || null;
export const partsUnearthed = (profile, id) => profile.fossilProgress[id] || 0;
export const isComplete = (profile, id) => profile.completedFossils.includes(id);

// Saves from before the roster used ids like "cambrian-1", "cambrian-2": map them onto the era's 1st / 2nd fossil.
export function migrateFossilId(id) {
  if (fossilById(id)) return id;
  const m = /^(.*)-(\d+)$/.exec(id);
  const era = m && ERAS.find((e) => e.id === m[1]);
  return era ? era.fossils[Math.min(era.fossils.length, +m[2]) - 1] || id : id;
}

// The fossil being dug: the first one not yet complete, or null when every fossil is done.
export function currentFossil(profile) {
  return FOSSILS.find((f) => !isComplete(profile, f.id)) || null;
}

// Parts are unearthed in recipe order (body first, the head last): part number -> part index. Kept as a function so the order
// could be changed per fossil later.
export function partOrder(fossilId) {
  return Array.from({ length: CONFIG.fossils.parts }, (_, i) => i);
}

// Spend pickaxes to unearth the next part of the current fossil.
// -> { ok:true, profile, fossil, part (0-based part number), tile (= part index), completed } or { ok:false, reason }.
export function digPart(profile) {
  const fossil = currentFossil(profile);
  if (!fossil) return { ok: false, reason: 'all-complete' };
  const cost = CONFIG.fossils.pickaxesPerPart;
  if (profile.pickaxes < cost) return { ok: false, reason: 'not-enough-pickaxes' };
  const part = partsUnearthed(profile, fossil.id);
  const parts = part + 1;
  const completed = parts >= CONFIG.fossils.parts;
  const next = {
    ...profile,
    pickaxes: profile.pickaxes - cost,
    fossilProgress: { ...profile.fossilProgress, [fossil.id]: parts },
    completedFossils: completed ? [...profile.completedFossils, fossil.id] : profile.completedFossils
  };
  return { ok: true, profile: next, fossil, part, tile: partOrder(fossil.id)[part], completed };
}

// Museum: every fossil with its state. 'done' | 'digging' (the current one, may have 0 parts) | 'locked'.
export function museumEntries(profile) {
  const cur = currentFossil(profile);
  return FOSSILS.map((fossil) => ({
    fossil,
    parts: isComplete(profile, fossil.id) ? CONFIG.fossils.parts : partsUnearthed(profile, fossil.id),
    status: isComplete(profile, fossil.id) ? 'done' : cur && cur.id === fossil.id ? 'digging' : 'locked'
  }));
}
// Pickaxes needed to finish everything still open on the current fossil.
export const pickaxesToFinish = (profile) => { const f = currentFossil(profile); return f ? (CONFIG.fossils.parts - partsUnearthed(profile, f.id)) * CONFIG.fossils.pickaxesPerPart : 0; };
