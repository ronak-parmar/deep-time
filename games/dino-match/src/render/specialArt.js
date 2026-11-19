// Painted special pieces (M10): art/specials/<slot>.webp, cut from the owner's AI sheet by tools/prep-specials-sheet.py.
// Every slot is optional; a special without a picture keeps the code-drawn look (render/specials.js drawSpecial).
//
//   Every painted special is a NEUTRAL standalone piece (the owner's sheet, M10): it is drawn instead of the gem, over a faint under-glow
//   in the gem colour (the piece still matches by colour in a normal 3-match). firecracker = optional single picture for both axes
//   (as is for 'h', turned 90 degrees for 'v'). mode 'overlay' (gem first, picture on top) is kept for a future gem-tinted overlay.
//
// art-standins/specials/ is only read with ?standins in the URL (synthetic test art, never shipped).
export const SPECIAL_SLOTS = {
  'firecracker-h': { kind: 'firecracker', mode: 'replace', note: 'firecracker / arrow lying horizontally, stone rocket with a footprint, sparks on the left' },
  'firecracker-v': { kind: 'firecracker', mode: 'replace', note: 'the same firecracker standing vertically' },
  firecracker:     { kind: 'firecracker', mode: 'replace', optional: true, note: 'one horizontal firecracker used for both axes' },
  bomb:            { kind: 'bomb', mode: 'replace', note: 'round black bomb with a lit fuse' },
  dynamite:        { kind: 'dynamite', mode: 'replace', note: 'bundle of three red sticks with a fuse' },
  tnt:             { kind: 'tnt', mode: 'replace', note: 'red TNT crate' },
  rainbow:         { kind: 'rainbow', mode: 'replace', note: 'rainbow orb / gem' }
};
// the order the AI sheet must follow (tools/prep-specials-sheet.py reads the same list)
export const SHEET_ORDER = ['firecracker-h', 'firecracker-v', 'bomb', 'dynamite', 'tnt', 'rainbow'];
export const SPECIAL_SIZE = 256;

// Which picture draws a piece: { slot, rot (radians), mode } or null for the code-drawn fallback. has(slot) says whether a file exists.
export function resolveSpecial(kind, o, has) {
  if (kind === 'firecracker') {
    const v = o === 'v';
    const mode = SPECIAL_SLOTS['firecracker-h'].mode;
    if (has(v ? 'firecracker-v' : 'firecracker-h')) return { slot: v ? 'firecracker-v' : 'firecracker-h', rot: 0, mode };
    if (has('firecracker')) return { slot: 'firecracker', rot: v ? Math.PI / 2 : 0, mode };
    if (has(v ? 'firecracker-h' : 'firecracker-v')) return { slot: v ? 'firecracker-h' : 'firecracker-v', rot: v ? Math.PI / 2 : -Math.PI / 2, mode };
    return null;
  }
  const s = SPECIAL_SLOTS[kind];
  return s && has(kind) ? { slot: kind, rot: 0, mode: s.mode } : null;
}

const real = import.meta.glob('../../../../art/specials/*.{webp,png}', { eager: true, query: '?url', import: 'default' });
const stand = import.meta.glob('../../art-standins/specials/*.{webp,png}', { eager: true, query: '?url', import: 'default' });
const useStand = () => typeof location !== 'undefined' && /[?&]standins\b/.test(location.search);
const noArt = () => typeof window !== 'undefined' && (window.__noArt || /[?&]vector\b/.test(window.location?.search || ''));
const slotOf = (p) => p.split('/').pop().replace(/\.(webp|png)$/, '');
let URLS = null;
export function specialUrls() {
  if (URLS) return URLS;
  URLS = {};
  if (useStand()) for (const [p, u] of Object.entries(stand)) if (SPECIAL_SLOTS[slotOf(p)]) URLS[slotOf(p)] = u;
  for (const [p, u] of Object.entries(real)) if (SPECIAL_SLOTS[slotOf(p)]) URLS[slotOf(p)] = u;
  return URLS;
}
// tests (and the debug page) can swap the table
export const setSpecialUrls = (m) => { URLS = { ...m }; imgs.clear(); proms.clear(); };

const imgs = new Map();   // slot -> HTMLImageElement (loaded) | null (failed)
const proms = new Map();  // slot -> Promise (one load per slot)
const loadOne = (slot, url) => new Promise((res) => {
  if (typeof Image === 'undefined') { imgs.set(slot, null); return res(null); }
  const im = new Image(); im.decoding = 'async';
  im.onload = () => { imgs.set(slot, im); res(im); }; im.onerror = () => { imgs.set(slot, null); res(null); }; im.src = url;
});
// one promise per slot (the loading screen counts them); loadSpecialArt() = all of them
const loadSlot = (slot, url) => { if (!proms.has(slot)) proms.set(slot, loadOne(slot, url)); return proms.get(slot); };
export const specialLoadTasks = () => Object.entries(specialUrls()).map(([slot, url]) => ({ id: 'special:' + slot, run: () => loadSlot(slot, url) }));
export const loadSpecialArt = () => Promise.all(specialLoadTasks().map((t) => t.run()));
export const hasSpecialFile = (slot) => !!specialUrls()[slot];
// the loaded picture for a piece, or null (fallback); starts loading lazily the first time it is asked for
export function specialArt(kind, o) {
  if (noArt()) return null;
  const r = resolveSpecial(kind, o, hasSpecialFile); if (!r) return null;
  const im = imgs.get(r.slot);
  if (im === undefined) { loadSpecialArt(); return null; }
  return im && im.naturalWidth ? { ...r, img: im } : null;
}
