/**
 * Seedable RNG (mulberry32) so ad decisions are reproducible in tests and the simulator.
 * An "rng" anywhere in ad-brain is just a function returning a float in [0, 1).
 */

/** Hash a string (or number) into a 32-bit seed (FNV-1a). */
export function hashSeed(input) {
  const s = String(input);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * @param {number|string} [seed] omit for a non-deterministic seed
 * @returns {(() => number) & { int(min:number,max:number):number, chance(p:number):boolean, fork(label:string):(() => number) }}
 */
export function createRng(seed) {
  let a =
    seed === undefined
      ? (Math.random() * 0x100000000) >>> 0
      : typeof seed === 'number'
        ? seed >>> 0
        : hashSeed(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (min, max) => min + Math.floor(next() * (max - min + 1));
  next.chance = (p) => next() < p;
  next.fork = (label) => createRng((a ^ hashSeed(label)) >>> 0);
  return next;
}

/** Accepts a function or an object with next(); returns a plain function. */
export function toRngFn(rng) {
  if (typeof rng === 'function') return rng;
  if (rng && typeof rng.next === 'function') return () => rng.next();
  return createRng();
}
