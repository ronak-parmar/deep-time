// Seeded RNG (mulberry32). The state is one integer so it serialises with the game.
export function makeRng(seed) {
  return { s: ((seed >>> 0) ^ 0x9e3779b9) >>> 0 };
}
export function next(r) {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function int(r, n) {
  return Math.floor(next(r) * n);
}
export function shuffle(r, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = int(r, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
export function hashSeed(...nums) {
  let h = 2166136261;
  for (const n of nums) {
    h ^= n | 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
