import { CONFIG } from './config.js';

// Era ids match design-system/tokens.json (data-era values). `dir` is the folder under art/sprites.
export const ERAS = [
  { id: 'cambrian', name: 'Cambrian', dir: 'cambrian', fossil: 'Trilobite', fact: 'Animals with hard shells appeared in a burst of new life about 540 million years ago.' },
  { id: 'devonian', name: 'Devonian', dir: 'devonian', fossil: 'Armoured fish', fact: 'Fish diversified so much that this era is called the Age of Fishes.' },
  { id: 'carboniferous', name: 'Carboniferous', dir: 'carboniferous', fossil: 'Fern imprint', fact: 'Vast swampy forests laid down the coal we still burn today.' },
  { id: 'permian', name: 'Permian', dir: 'permian', fossil: 'Early reptile', fact: 'The largest mass extinction ever ended this era about 252 million years ago.' },
  { id: 'triassic', name: 'Triassic', dir: 'triassic', fossil: 'Dinosaur skull', fact: 'The first dinosaurs and the first mammals appeared in this era.' },
  { id: 'jurassic', name: 'Jurassic', dir: 'jurassic', fossil: 'Sauropod bone', fact: 'Giant sauropods walked the land and the first birds took to the air.' },
  { id: 'cretaceous', name: 'Cretaceous', dir: 'cretaceous', fossil: 'Ammonite', fact: 'Flowering plants spread, and an asteroid ended the era 66 million years ago.' },
  { id: 'age-of-mammals', name: 'Age of mammals', dir: 'mammals', fossil: 'Tusk', fact: 'After the dinosaurs, mammals grew into the many sizes and shapes we see today.' },
  { id: 'ice-age', name: 'Ice age', dir: 'iceage', fossil: 'Mammoth tooth', fact: 'Ice sheets advanced and retreated, and woolly mammoths roamed cold grasslands.' },
  { id: 'early-humans', name: 'Early humans', dir: 'humans', fossil: 'Hand axe', fact: 'Early humans made stone tools and learned to control fire.' }
];

export function eraIndexOf(level) {
  return Math.floor((Math.max(1, level) - 1) / CONFIG.levels.perEra) % CONFIG.levels.eras;
}
export function eraOf(level) {
  return ERAS[eraIndexOf(level)];
}
export function cycleOf(level) {
  return Math.floor((Math.max(1, level) - 1) / (CONFIG.levels.perEra * CONFIG.levels.eras));
}
// 1..100 inside the era
export function levelInEra(level) {
  return ((Math.max(1, level) - 1) % CONFIG.levels.perEra) + 1;
}
export function isHistoryLevel(level) {
  return level > 0 && level % CONFIG.levels.historyEvery === 0;
}
