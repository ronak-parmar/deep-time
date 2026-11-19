// Painted obstacle pictures (M11): art/obstacles/<slot>.webp, cut from the owner's AI sheet by tools/prep-obstacles-sheet.py
// (order and prompt: docs/18-obstacle-art.md). One picture per damage stage for obstacles with hit points: <kind>-<hp left>.
// Every slot is optional; a missing picture keeps the code-drawn look (render/obstacles.js) for that obstacle / stage.
//
// art-standins/obstacles/ is only read with ?standins in the URL (synthetic test art, never shipped). ?vector forces the code look.

// [slot, note] in SHEET ORDER (reading order on the sheet: 5 columns x 4 rows). tools/prep-obstacles-sheet.py reads the same list.
export const OBSTACLE_SHEET = [
  ['tar', 'tar pit (1 hit)'],
  ['sandstone-2', 'cracked sandstone, whole (2 hits left)'],
  ['sandstone-1', 'cracked sandstone, badly cracked (1 hit left)'],
  ['fossil-2', 'fossil tile: sandstone with an ammonite, whole'],
  ['fossil-1', 'fossil tile, cracked, the ammonite showing more'],
  ['bone', 'skeleton tile: sandstone with a bone (1 hit)'],
  ['vine-2', 'vine stone: grey stone wrapped in two vines'],
  ['vine-1', 'vine stone, one vine cut and hanging loose'],
  ['crate', 'ancient wooden crate with a gold coin emblem (1 hit)'],
  ['lava-3', 'lava rock, glowing cracks, whole'],
  ['lava-2', 'lava rock, cracked'],
  ['lava-1', 'lava rock, almost broken'],
  ['rock', 'unbreakable boulder'],
  ['artefact', 'golden relic piece (collect item, round)'],
  ['dig-tar', 'dig plaque block: dark tar dirt (1 hit)'],
  ['dig-sand-2', 'dig plaque block: packed sand, whole'],
  ['dig-sand-1', 'dig plaque block: packed sand, cracked'],
  ['dig-stone-3', 'dig plaque block: grey stone, whole'],
  ['dig-stone-2', 'dig plaque block: grey stone, cracked'],
  ['dig-stone-1', 'dig plaque block: grey stone, badly cracked']
];
export const OBSTACLE_SLOTS = OBSTACLE_SHEET.map(([s]) => s);
export const OBSTACLE_SIZE = 192;

// Which slot pictures an obstacle at a given hp: stage pictures '<k>-<hp>', else the plain '<k>' picture (for one-hit kinds and
// as a fallback), else the nearest stage that exists (more damaged first). has(slot) says whether a file exists. -> slot | null
export function obstacleSlot(k, hp, max, has) {
  if (hp === Infinity || !(max > 1)) return has(k) ? k : null;
  const h = Math.max(1, Math.min(max, hp | 0));
  if (has(`${k}-${h}`)) return `${k}-${h}`;
  if (has(k)) return k;
  for (let d = 1; d < max; d++) { if (has(`${k}-${h - d}`)) return `${k}-${h - d}`; if (has(`${k}-${h + d}`)) return `${k}-${h + d}`; }
  return null;
}
// dig plaque blocks (renderer drawDirt): t = 'tar' | 'sand' | 'stone'
export const digSlot = (t, hp, max, has) => obstacleSlot('dig-' + t, max > 1 ? hp : Infinity, max, has);

const real = import.meta.glob('../../../../art/obstacles/*.{webp,png}', { eager: true, query: '?url', import: 'default' });
const stand = import.meta.glob('../../art-standins/obstacles/*.{webp,png}', { eager: true, query: '?url', import: 'default' });
const useStand = () => typeof location !== 'undefined' && /[?&]standins\b/.test(location.search);
const noArt = () => typeof window !== 'undefined' && (window.__noArt || /[?&]vector\b/.test(window.location?.search || ''));
const slotOf = (p) => p.split('/').pop().replace(/\.(webp|png)$/, '');
let URLS = null;
export function obstacleUrls() {
  if (URLS) return URLS;
  URLS = {};
  const known = new Set(OBSTACLE_SLOTS);
  if (useStand()) for (const [p, u] of Object.entries(stand)) if (known.has(slotOf(p))) URLS[slotOf(p)] = u;
  for (const [p, u] of Object.entries(real)) if (known.has(slotOf(p))) URLS[slotOf(p)] = u;
  return URLS;
}
export const setObstacleUrls = (m) => { URLS = { ...m }; imgs.clear(); proms.clear(); };
export const hasObstacleFile = (slot) => !!obstacleUrls()[slot];

const imgs = new Map(), proms = new Map();
const loadOne = (slot, url) => new Promise((res) => {
  if (typeof Image === 'undefined') { imgs.set(slot, null); return res(null); }
  const im = new Image(); im.decoding = 'async';
  im.onload = () => { imgs.set(slot, im); res(im); }; im.onerror = () => { imgs.set(slot, null); res(null); }; im.src = url;
});
const loadSlot = (slot, url) => { if (!proms.has(slot)) proms.set(slot, loadOne(slot, url)); return proms.get(slot); };
// counted tasks for the loading screen (same shape as specialLoadTasks), or load them all at once
export const obstacleLoadTasks = () => Object.entries(obstacleUrls()).map(([slot, url]) => ({ id: 'obstacle:' + slot, run: () => loadSlot(slot, url) }));
export const loadObstacleArt = () => Promise.all(obstacleLoadTasks().map((t) => t.run()));

const imgOf = (slot) => {
  if (!slot) return null;
  const im = imgs.get(slot);
  if (im === undefined) { loadObstacleArt(); return null; }
  return im && im.naturalWidth ? im : null;
};
// the loaded picture for an obstacle stage, or null (code-drawn fallback); starts loading lazily
export const obstacleImage = (k, hp, max) => (noArt() ? null : imgOf(obstacleSlot(k, hp, max, hasObstacleFile)));
export const digImage = (t, hp, max) => (noArt() ? null : imgOf(digSlot(t, hp, max, hasObstacleFile)));

// Break chunks: the picture split into 4 wedges (centre to each side) that fly apart, spin and fade. t = 0..1, h = half size.
// Drawn at the obstacle centre (0,0) in the caller's transform. Pure canvas, no allocation per frame beyond the path.
const WEDGES = [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]];
const DIRS = [[0.15, -1], [1, -0.25], [-0.1, 0.9], [-1, -0.35]];
export function drawChunks(c, im, h, t, i = 0) {
  const e = 1 - (1 - t) * (1 - t);
  c.save(); c.globalAlpha *= Math.max(0, 1 - t * t);
  WEDGES.forEach(([a, b], k) => {
    const [dx, dy] = DIRS[k], cx = (a[0] + b[0]) / 3, cy = (a[1] + b[1]) / 3, spin = ((k + i) % 2 ? 1 : -1) * (0.7 + ((i * 7 + k) % 3) * 0.2);
    c.save();
    c.translate(dx * h * 1.3 * e, dy * h * 1.3 * e + h * 1.6 * t * t);        // fly out, then fall
    c.translate(cx * h, cy * h); c.rotate(spin * e); c.scale(1 - 0.2 * e, 1 - 0.2 * e); c.translate(-cx * h, -cy * h);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(a[0] * h, a[1] * h); c.lineTo(b[0] * h, b[1] * h); c.closePath(); c.clip();
    c.drawImage(im, -h, -h, h * 2, h * 2);
    c.restore();
  });
  c.restore();
}
