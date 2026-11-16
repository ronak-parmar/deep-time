import { CONFIG } from './config.js';
import { ERAS } from './eras.js';
import { makeRng, shuffle, hashSeed } from './rng.js';

// 20 fossils: 2 per era. Names are placeholders: the Cambrian pair follows the gem emblem creatures,
// the rest are generic until the real list is decided.
const CAMBRIAN = ['Anomalocaris', 'Trilobite'];
export const FOSSILS = ERAS.flatMap((era, e) =>
  Array.from({ length: CONFIG.fossils.perEra }, (_, k) => ({
    id: `${era.id}-${k + 1}`,
    index: e * CONFIG.fossils.perEra + k,
    era: era.id,
    eraIndex: e,
    name: e === 0 ? CAMBRIAN[k] : `${era.name} fossil ${k + 1}`
  })));

export const fossilById = (id) => FOSSILS.find((f) => f.id === id) || null;

export const partsUnearthed = (profile, id) => profile.fossilProgress[id] || 0;
export const isComplete = (profile, id) => profile.completedFossils.includes(id);

// The fossil being dug: the first one not yet complete, or null when every fossil is done.
export function currentFossil(profile) {
  return FOSSILS.find((f) => !isComplete(profile, f.id)) || null;
}

// Fixed, seeded reveal order of the 10 parts for a fossil (part number -> tile index).
export function partOrder(fossilId) {
  const f = fossilById(fossilId);
  return shuffle(makeRng(hashSeed(7, f ? f.index : 0)), Array.from({ length: CONFIG.fossils.parts }, (_, i) => i));
}

// Spend pickaxes to unearth the next part of the current fossil.
// -> { ok:true, profile, fossil, part (0-based part number), tile, completed } or { ok:false, reason }.
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
