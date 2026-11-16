import { CONFIG } from '../core/config.js';
import { ERAS } from '../core/eras.js';

// Sprites live at art/sprites/<era dir>/<colour>.png (repo root). Vite bundles whatever exists at
// build / dev-server start. Missing eras simply have no entry, so the code-drawn gems are used.
const files = import.meta.glob('../../../../art/sprites/*/*.png', { eager: true, query: '?url', import: 'default' });

const urls = {}; // urls[dir][colour] = url
for (const [path, url] of Object.entries(files)) {
  const m = path.match(/sprites\/([^/]+)\/([^/]+)\.png$/);
  if (m) (urls[m[1]] ||= {})[m[2]] = url;
}

const cache = {}; // cache[dir] = { colour: HTMLImageElement | null }

export function loadEraSprites(eraId) {
  const dir = ERAS.find((e) => e.id === eraId)?.dir;
  if (!dir) return Promise.resolve();
  if (cache[dir]) return cache[dir].ready;
  const set = (cache[dir] = {});
  set.ready = Promise.all(CONFIG.gemKinds.map((name) => new Promise((res) => {
    const url = urls[dir]?.[name];
    if (!url) { set[name] = null; return res(); }
    const img = new Image();
    img.onload = () => { set[name] = img; res(); };
    img.onerror = () => { set[name] = null; res(); };
    img.src = url;
  })));
  return set.ready;
}

// Returns the image for a gem colour index in an era, or null (draw the fallback).
export function spriteFor(eraId, c) {
  const dir = ERAS.find((e) => e.id === eraId)?.dir;
  return cache[dir]?.[CONFIG.gemKinds[c]] || null;
}
export const eraHasSprites = (eraId) => !!urls[ERAS.find((e) => e.id === eraId)?.dir];
