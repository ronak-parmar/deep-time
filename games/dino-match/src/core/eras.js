import { CONFIG } from './config.js';
import { ROSTER } from '../data/roster.js';

// Era ids match design-system/tokens.json (data-era values). `dir` is the folder under art/sprites.
// `span` is the real time range shown on the cards. The level range of an era is NOT written here: it is derived from the
// roster (data/roster.js): era length = levelsPerFossil x the number of fossils of that era.
const ERA_BASE = [
  { id: 'cambrian', name: 'Cambrian', dir: 'cambrian', fossil: 'Trilobite', fact: 'Animals with hard shells appeared in a burst of new life about 540 million years ago.', span: '539 to 485 million years ago' },
  { id: 'devonian', name: 'Devonian', dir: 'devonian', fossil: 'Armoured fish', fact: 'Fish diversified so much that this era is called the Age of Fishes.', span: '419 to 359 million years ago' },
  { id: 'carboniferous', name: 'Carboniferous', dir: 'carboniferous', fossil: 'Fern imprint', fact: 'Vast swampy forests laid down the coal we still burn today.', span: '359 to 299 million years ago' },
  { id: 'permian', name: 'Permian', dir: 'permian', fossil: 'Early reptile', fact: 'The largest mass extinction ever ended this era about 252 million years ago.', span: '299 to 252 million years ago' },
  { id: 'triassic', name: 'Triassic', dir: 'triassic', fossil: 'Dinosaur skull', fact: 'The first dinosaurs and the first mammals appeared in this era.', span: '252 to 201 million years ago' },
  { id: 'jurassic', name: 'Jurassic', dir: 'jurassic', fossil: 'Sauropod bone', fact: 'Giant sauropods walked the land and the first birds took to the air.', span: '201 to 145 million years ago' },
  { id: 'cretaceous', name: 'Cretaceous', dir: 'cretaceous', fossil: 'Ammonite', fact: 'Flowering plants spread, and an asteroid ended the era 66 million years ago.', span: '145 to 66 million years ago' },
  { id: 'age-of-mammals', name: 'Age of mammals', dir: 'mammals', fossil: 'Tusk', fact: 'After the dinosaurs, mammals grew into the many sizes and shapes we see today.', span: '66 to 2.6 million years ago' },
  { id: 'ice-age', name: 'Ice age', dir: 'iceage', fossil: 'Mammoth tooth', fact: 'Ice sheets advanced and retreated, and woolly mammoths roamed cold grasslands.', span: '2.6 million to 11,700 years ago' },
  { id: 'early-humans', name: 'Early humans', dir: 'humans', fossil: 'Hand axe', fact: 'Early humans made stone tools and learned to control fire.', span: 'about 4 million to 40,000 years ago' }
];


const PER = CONFIG.fossils.levelsPerFossil;
let at = 1;
export const ERAS = ERA_BASE.map((e, index) => {
  const fossils = ROSTER.filter((f) => f.era === e.id).map((f) => f.id);
  const levels = fossils.length * PER, era = { ...e, index, fossils, levels, start: at, end: at + levels - 1 };
  at += levels;
  return era;
});
// All levels of one pass through the journey; after the last roster level the game starts again (harder, cycleBump).
export const TOTAL_LEVELS = at - 1;

const inCycle = (level) => ((Math.max(1, Math.floor(level)) - 1) % TOTAL_LEVELS) + 1;
export function eraIndexOf(level) {
  const n = inCycle(level);
  for (const e of ERAS) if (n <= e.end) return e.index;
  return ERAS.length - 1;
}
export const eraOf = (level) => ERAS[eraIndexOf(level)];
export const cycleOf = (level) => Math.floor((Math.max(1, Math.floor(level)) - 1) / TOTAL_LEVELS);
// 1..era length inside the era
export const levelInEra = (level) => inCycle(level) - eraOf(level).start + 1;
export const eraLength = (level) => eraOf(level).levels;
// the fossil whose 50 levels contain this level (its last level is the one that finishes it)
export function fossilIdForLevel(level) {
  const e = eraOf(level);
  return e.fossils[Math.min(e.fossils.length - 1, Math.floor((levelInEra(level) - 1) / PER))];
}
export const isHistoryLevel = (level) => level > 0 && level % CONFIG.levels.historyEvery === 0;
