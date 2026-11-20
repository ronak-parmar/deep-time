// Painted journey-map pieces (art/ui/node-*.png, map-pin, step-stone-*, cloud-*, mist-1: artManifest 'map' slots, cut from
// art/sheets/map-pieces.png by tools/prep-pieces-sheet.py map). Every piece is optional: the code-drawn look stays the fallback.
import { slot, slotReady, slotUrl, load } from './art.js';
import { slotFiles } from './artManifest.js';

export const NODE_PICS = ['node-done', 'node-open', 'node-locked', 'node-current', 'node-hard', 'node-superhard', 'map-pin'];

// DOM nodes and pin: when every node picture is in, set --pic-<slot> on `el` and add `cls` (game.css draws the coins from them).
// Loads the pictures first when the boot preload has not got to them yet. Returns a function that stops a pending apply.
export function applyMapArt(el, cls) {
  let dead = false;
  const go = () => {
    if (dead || !NODE_PICS.every(slotReady)) return false;
    for (const n of NODE_PICS) el.style.setProperty('--pic-' + n, `url(${slotUrl(n)})`);
    el.classList.add(cls); return true;
  };
  if (!go()) Promise.all(NODE_PICS.flatMap(slotFiles).map(load)).then(go);
  return () => { dead = true; };
}

// Canvas pieces: the image or null (draw the code-drawn one).
export const stoneImg = (i) => slot(i % 2 ? 'step-stone-2' : 'step-stone-1');
export const cloudImg = (k) => slot(k % 2 ? 'cloud-2' : 'cloud-1');
export const mistImg = () => slot('mist-1');
export const loadCanvasPieces = () => Promise.all(['step-stone-1', 'step-stone-2', 'cloud-1', 'cloud-2', 'mist-1'].flatMap(slotFiles).map(load));

// One stepping stone centred at x, y, w units wide (aspect kept). Returns false when the picture is missing.
export function drawStone(c, i, x, y, w) {
  const im = stoneImg(i); if (!im) return false;
  const h = w * im.height / im.width; c.drawImage(im, x - w / 2, y - h / 2, w, h); return true;
}
