// Fossil thumbnails (art/fossils/thumb/<id>.webp, made by tools/fossil-sheet.py): an RGBA cut-out of each fossil's carving from the
// art sheet, about 256 px. Used wherever a small fossil is drawn (museum grid, island milestones, island map, the level's dig panel).
// The vector fossil (render/fossilArt.js) stays the fallback for any id without a thumbnail, or while it is still loading.
//
// drawThumb(c, id, x, y, w, h, { look, revealed }) draws contained in the box and returns true, or false when there is no image yet:
//   look 'bone'  the carving as painted
//   look 'stone' a dark stone silhouette (locked)
//   look 'dig'   the silhouette with `revealed` of 10 parts uncovered, head first (order of the dig strokes)
import { SLABS } from '../data/fossilSlabs.js';
import { CONFIG } from '../core/config.js';

const files = import.meta.glob('../../../../art/fossils/thumb/*.webp', { eager: true, query: '?url', import: 'default' });
const URLS = Object.fromEntries(Object.entries(files).map(([p, u]) => [p.split('/').pop().replace(/\.webp$/, ''), u]));

const imgs = new Map();   // id -> HTMLImageElement once loaded (null = failed)
const pending = new Map();
export const thumbUrl = (id) => URLS[id] || null;
export const hasThumb = (id) => !!URLS[id];
export const thumbNow = (id) => imgs.get(id) || null;
export function loadThumb(id) {
  if (!URLS[id] || typeof Image === 'undefined') return Promise.resolve(null);
  if (imgs.has(id)) return Promise.resolve(imgs.get(id));
  if (!pending.has(id)) pending.set(id, new Promise((res) => { const im = new Image(); im.decoding = 'async'; im.onload = () => { imgs.set(id, im); res(im); }; im.onerror = () => { imgs.set(id, null); res(null); }; im.src = URLS[id]; }));
  return pending.get(id);
}
let all = null;
// every thumbnail (about 0.5 MB together); the island map waits for this before it paints its bitmaps
export const thumbsReady = () => (all ||= Promise.all(Object.keys(URLS).map(loadThumb)));

const STONE = ['#4A5060', '#2C313C'];
const tint = new Map();   // `${id}|${look}|${revealed}` -> canvas
function variant(id, im, look, revealed) {
  const key = `${id}|${look}|${look === 'dig' ? revealed : ''}`;
  if (tint.has(key)) return tint.get(key);
  const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  // the silhouette: stone colour where the carving is, with a little of its relief kept so it reads as a carved shape
  g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in';
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, STONE[0]); gr.addColorStop(1, STONE[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.55; g.drawImage(im, 0, 0); g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-in'; g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-over';
  if (look === 'dig' && revealed > 0) {   // uncovered part: a soft-edged wipe from the head
    const n = CONFIG.fossils.parts, f = Math.min(1, revealed / n), head = SLABS[id]?.head || 'left', soft = 0.06;
    const m = document.createElement('canvas'); m.width = w; m.height = h; const mc = m.getContext('2d');
    const lg = head === 'top' ? mc.createLinearGradient(0, 0, 0, h) : head === 'right' ? mc.createLinearGradient(w, 0, 0, 0) : mc.createLinearGradient(0, 0, w, 0);
    lg.addColorStop(0, '#000'); lg.addColorStop(Math.max(0, f - soft), '#000'); lg.addColorStop(Math.min(1, f + soft), 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    mc.fillStyle = lg; mc.fillRect(0, 0, w, h); mc.globalCompositeOperation = 'source-in'; mc.drawImage(im, 0, 0);
    g.drawImage(m, 0, 0);
  }
  tint.set(key, cv); return cv;
}

// where the thumbnail lands inside the box (contain, centred, `margin` of the box kept free)
export function thumbRect(im, x, y, w, h, margin = 0.04) {
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, bw = w * (1 - margin * 2), bh = h * (1 - margin * 2), k = Math.min(bw / iw, bh / ih);
  return { x: x + (w - iw * k) / 2, y: y + (h - ih * k) / 2, w: iw * k, h: ih * k };
}

export function drawThumb(c, id, x, y, w, h, opt = {}) {
  const im = thumbNow(id); if (!im) { if (URLS[id] && !imgs.has(id)) loadThumb(id); return false; }   // per-frame callers get it next frame
  const look = opt.look || 'bone', revealed = opt.revealed ?? CONFIG.fossils.parts, r = thumbRect(im, x, y, w, h, opt.margin ?? 0.04);
  const src = look === 'bone' || (look === 'dig' && revealed >= CONFIG.fossils.parts) ? im : variant(id, im, look, revealed);
  c.drawImage(src, r.x, r.y, r.w, r.h);
  return true;
}
