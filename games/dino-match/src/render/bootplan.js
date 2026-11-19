// What the loading screen waits for (M10): the critical art for the first screen, as counted tasks for core/preload.js.
// Each task warms the SAME cache the game reads later (art.js, atlas.js, islandart.js, fossilThumbs.js, specialArt.js), so nothing
// loads twice. A file that fails still counts as done: that slot just keeps its code-drawn fallback.
import { CONFIG } from '../core/config.js';
import { ERAS } from '../core/eras.js';
import { ROSTER } from '../data/roster.js';
import { SLOT_NAMES, slotFiles } from './artManifest.js';
import { load, loadEra, hasFile } from './art.js';
import { loadEraSprites } from './atlas.js';
import { loadIslandArt } from './islandart.js';
import { loadThumb, hasThumb } from './fossilThumbs.js';
import { specialLoadTasks } from './specialArt.js';
import { aiNames, aiUrl } from '../ui/kitart.js';
import { logoUrl } from '../ui/logo.js';
import { FRAME_URLS, preloadYuvi } from '../ui/yuvi.js';
import { loadFonts } from '../ui/tokens.js';

const img = (url) => new Promise((res, rej) => { if (!url || typeof Image === 'undefined') return res(null); const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => rej(new Error(url)); im.src = url; });

// eraId: the era of the player's level (its background, gem sprites, island picture and fossil thumbnails come first)
export function bootTasks(eraId) {
  const era = ERAS.find((e) => e.id === eraId) || ERAS[0];
  return [
    { id: 'fonts', run: () => loadFonts() },
    logoUrl && { id: 'logo', run: () => img(logoUrl) },
    ...aiNames().map((n) => ({ id: 'kit:' + n, run: () => img(aiUrl(n)) })),
    ...SLOT_NAMES.flatMap(slotFiles).filter(hasFile).map((f) => ({ id: 'ui:' + f, run: () => load(f) })),
    { id: 'gems:' + era.id, weight: CONFIG.gemKinds.length, run: () => loadEraSprites(era.id) },
    { id: 'era:' + era.id, weight: 2, run: () => loadEra(era.id) },
    ...Object.keys(FRAME_URLS).map((f) => ({ id: 'yuvi:' + f, run: () => img(FRAME_URLS[f]) })),
    { id: 'yuvi', weight: 0, run: () => preloadYuvi() },
    { id: 'islands', run: () => loadIslandArt(ERAS.map((e) => e.id)) },
    ...ROSTER.filter((f) => f.era === era.id && hasThumb(f.id)).map((f) => ({ id: 'thumb:' + f.id, run: () => loadThumb(f.id) })),
    ...specialLoadTasks()
  ].filter(Boolean);
}
