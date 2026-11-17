// Painted-art loader with caching and a clean fallback: every lookup returns null when a file is missing or fails to
// load, and callers then draw the vector look. Nothing here throws.
import { UI_SLOTS, SLOT_NAMES, slotFiles, bgFiles, propsPrefix, parseProp } from './artManifest.js';

// art/ (owner art) overrides games/dino-match/art-standins/ (temporary). Missing folders just give empty maps.
const standins = import.meta.glob('../../art-standins/{backgrounds,props,ui}/**/*.{png,webp}', { eager: true, query: '?url', import: 'default' });
// backgrounds/_*.png (contact sheets) are working files and never shipped
const owner = import.meta.glob(['../../../../art/{backgrounds/runtime/*.webp,backgrounds/*.png,props/**/*.png,ui/**/*.png}', '!../../../../art/backgrounds/_*.png'], { eager: true, query: '?url', import: 'default' });
const rel = (p) => p.replace(/^.*\/((backgrounds|props|ui)\/.*)$/, '$1');

let URLS = new Map(), SOURCE = new Map();
const cache = new Map();           // rel -> Promise<img|null>, and `ready` for sync reads
const ready = new Map();
let artVersion = 0;
export const getArtVersion = () => artVersion;

export function registerUrls(map, source = 'art') {
  for (const [p, u] of Object.entries(map)) { const r = rel(p); URLS.set(r, u); SOURCE.set(r, source); cache.delete(r); ready.delete(r); }
  artVersion++;
}
export function resetArt() { URLS = new Map(); SOURCE = new Map(); cache.clear(); ready.clear(); artVersion++; }
registerUrls(standins, 'standin'); registerUrls(owner, 'art');

export const sourceOf = (r) => SOURCE.get(r) || null;
export const hasFile = (r) => URLS.has(r);
export const urlOf = (r) => URLS.get(r) || null;
// Dev switch: ?vector (or window.__noArt) forces the vector look so both can be compared.
export const artEnabled = () => !(typeof window !== 'undefined' && (window.__noArt || /[?&]vector\b/.test(window.location?.search || '')));

let loader = (url) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
export const setImageLoader = (fn) => { loader = fn; cache.clear(); ready.clear(); };

export function load(r) {
  if (!URLS.has(r)) return Promise.resolve(null);
  if (!cache.has(r)) cache.set(r, loader(URLS.get(r)).then((im) => { ready.set(r, im || null); return im || null; }).catch(() => { ready.set(r, null); return null; }));
  return cache.get(r);
}
// sync read of an already loaded image
export const peek = (r) => (artEnabled() ? ready.get(r) || null : null);

// ---- UI kit ---------------------------------------------------------------------------------
export const preloadUi = () => Promise.all(SLOT_NAMES.flatMap((n) => slotFiles(n)).map(load));
// slot image (variant index wraps), or null
export function slot(name, variant = 0) {
  const files = slotFiles(name);
  return peek(files[((variant % files.length) + files.length) % files.length]);
}
export const slotReady = (name) => slotFiles(name).every((f) => !!peek(f));
export const slotsReady = (...names) => names.every(slotReady);
export const slotUrl = (name, variant = 0) => (slot(name, variant) ? urlOf(slotFiles(name)[variant % slotFiles(name).length]) : null);

// Draw a slot at x,y,w,h. 9-slice when the manifest has insets. Returns false when the slot is missing (caller falls back).
export function drawSlot(c, name, x, y, w, h, variant = 0) {
  const im = slot(name, variant); if (!im) return false;
  const nine = UI_SLOTS[name].nine;
  if (!nine) { c.drawImage(im, x, y, w, h); return true; }
  drawNine(c, im, nine, UI_SLOTS[name], x, y, w, h); return true;
}
// Insets are given at logical size; convert to source pixels with the image's own scale.
export function drawNine(c, im, nine, spec, x, y, w, h) {
  const sx = im.width / spec.w, sy = im.height / spec.h;
  const [l, t, r, b] = nine, sl = l * sx, st = t * sy, sr = r * sx, sb = b * sy;
  const mw = Math.max(0, w - l - r), mh = Math.max(0, h - t - b), iw = im.width - sl - sr, ih = im.height - st - sb;
  c.drawImage(im, 0, 0, sl, st, x, y, l, t); c.drawImage(im, im.width - sr, 0, sr, st, x + w - r, y, r, t);
  c.drawImage(im, 0, im.height - sb, sl, sb, x, y + h - b, l, b); c.drawImage(im, im.width - sr, im.height - sb, sr, sb, x + w - r, y + h - b, r, b);
  c.drawImage(im, sl, 0, iw, st, x + l, y, mw, t); c.drawImage(im, sl, im.height - sb, iw, sb, x + l, y + h - b, mw, b);
  c.drawImage(im, 0, st, sl, ih, x, y + t, l, mh); c.drawImage(im, im.width - sr, st, sr, ih, x + w - r, y + t, r, mh);
  c.drawImage(im, sl, st, iw, ih, x + l, y + t, mw, mh);
}

// ---- era layers ------------------------------------------------------------------------------
const propFiles = (id) => [...URLS.keys()].filter((r) => propsPrefix(id).some((p) => r.startsWith(p))).sort();
export const bgFile = (id) => bgFiles(id).find(hasFile) || null;
export const hasPaintedEra = (id) => !!bgFile(id);
const eraCache = {};
// Loads (once) the era background and prop layers. Resolves to { bg, props:[{img, anchor, glow, name}] } or null.
export async function loadEra(id) {
  const key = id + '|' + artVersion;
  if (eraCache[key]) return eraCache[key];
  return (eraCache[key] = (async () => {
    const bf = bgFile(id); if (!bf) return null;
    const bg = await load(bf); if (!bg) return null;                         // unreadable background = vector fallback
    const props = [];
    for (const r of propFiles(id)) { const img = await load(r); if (img) props.push({ img, ...parseProp(r) }); }
    return { bg, props, file: bf, source: sourceOf(bf) };
  })());
}
