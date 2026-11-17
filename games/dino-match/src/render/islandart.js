// Island pictures: art/islands/<era-id>.webp (transparent PNG-like webp cut by tools/prep-sheet.py). Any missing file means
// that island stays code-drawn (render/islandmap.js). art-standins/islands is only used when the URL has ?standins, so test
// pictures never ship in a normal build.
const real = import.meta.glob('../../../../art/islands/*.{webp,png}', { eager: true, query: '?url', import: 'default' });
const stand = import.meta.glob('../../art-standins/islands/*.{webp,png}', { eager: true, query: '?url', import: 'default' });
const useStand = () => typeof location !== 'undefined' && /[?&]standins\b/.test(location.search);
const idOf = (p) => p.split('/').pop().replace(/\.(webp|png)$/, '');
const table = () => {
  const m = {};
  if (useStand()) for (const [p, u] of Object.entries(stand)) m[idOf(p)] = u;
  for (const [p, u] of Object.entries(real)) m[idOf(p)] = u;
  return m;
};

const cache = new Map();           // era id -> { img, w, h } | null
const loadOne = (url) => new Promise((res) => { const im = new Image(); im.onload = () => res({ img: im, w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res(null); im.src = url; });

// Loads every island picture that exists. Resolves to a Map(eraId -> { img, w, h }); eras without a file are absent.
export async function loadIslandArt(eraIds) {
  const urls = table();
  await Promise.all(eraIds.map(async (id) => { if (!cache.has(id)) cache.set(id, urls[id] ? await loadOne(urls[id]) : null); }));
  return artSizes();
}
export const artSizes = () => { const m = new Map(); for (const [k, v] of cache) if (v) m.set(k, v); return m; };
export const artOf = (id) => cache.get(id) || null;
export const forgetIslandArt = () => cache.clear();
