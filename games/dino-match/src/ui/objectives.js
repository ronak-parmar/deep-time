// objectiveIcon(target | {kind,key}, size, era): the objective drawn with the SAME art the board uses (painted gem sprites, plaque
// block tiles, obstacle sprites, artefact). Code-drawn shapes only where that art itself is code-drawn on the board.
import { h } from './dom.js';
import { aiUrl } from './kitart.js';
import { objectiveArt } from '../data/objectiveArt.js';
import { drawGemShape, GEM_COLORS } from '../render/gems.js';
import { spriteFor, loadEraSprites, eraHasSprites } from '../render/atlas.js';
import { slot, drawSlot, slotsReady } from '../render/art.js';
import { drawObstacle, drawArtefact } from '../render/obstacles.js';

const BLOCK_SLOT = { tar: 'tile-dirt', sand: 'tile-sand', stone: 'tile-stone' };
const BLOCK_FALLBACK = { tar: ['#5A4230', '#2F2118'], sand: ['#C9A064', '#8A6338'], stone: ['#9A9BA0', '#5C5D63'] };
let currentEra = 'cambrian';
const PICK = (() => { const u = aiUrl('pickaxe'); if (!u || typeof Image === 'undefined') return null; const im = new Image(); im.src = u; return im; })();
export const setObjectiveEra = (id) => { currentEra = id || currentEra; };

// paints the objective art centred in a size x size box at (0,0); clear = false keeps what is under it (intro cards animate it)
export function paintObjective(g, art, size, era = currentEra, clear = true) {
  const m = size / 2; if (clear) g.clearRect(0, 0, size, size);
  if (art.kind === 'gem') {
    const sp = spriteFor(era, art.key);
    if (sp) { const d = size * 0.98; g.drawImage(sp, m - d / 2, m - d / 2, d, d); }
    else if (GEM_COLORS[art.key]) { g.save(); g.translate(m, m); drawGemShape(g, art.key, size * 0.42); g.restore(); }
  } else if (art.kind === 'block') {
    const name = BLOCK_SLOT[art.key] || 'tile-dirt', s = size * 0.9, o = (size - s) / 2;
    if (slot(name)) drawSlot(g, name, o, o, s, s, 0);
    else { const gr = g.createLinearGradient(0, o, 0, o + s), col = BLOCK_FALLBACK[art.key] || BLOCK_FALLBACK.tar; gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]); g.beginPath(); g.roundRect(o, o, s, s, s * 0.16); g.fillStyle = gr; g.fill(); g.lineWidth = 2; g.strokeStyle = '#1E140D'; g.stroke(); }
    if (art.badge != null) {   // the gem that digs it, as on the plaque
      const gr = s * 0.26; g.fillStyle = 'rgba(12,9,6,.6)'; g.beginPath(); g.arc(m, m, gr * 1.25, 0, 6.283); g.fill();
      const sp = spriteFor(era, art.badge); if (sp) { const d = gr * 2.3; g.drawImage(sp, m - d / 2, m - d / 2, d, d); } else if (GEM_COLORS[art.badge]) { g.save(); g.translate(m, m); drawGemShape(g, art.badge, gr); g.restore(); }
    }
    if (art.pick && PICK && PICK.complete && PICK.naturalWidth) g.drawImage(PICK, size * 0.48, size * 0.44, size * 0.56, size * 0.56);
  } else if (art.kind === 'artefact') { g.save(); g.translate(m, m); drawArtefact(g, size * 0.4, 0, true); g.restore(); }
  else drawObstacle(g, { k: art.key, hp: 1, max: 1 }, m, m, size + 2, 0, 0, true);
}
// target: a level target ({ type, c, k, n }) or an art spec ({ kind, key })
export function objectiveIcon(target, size = 28, era = currentEra) {
  const art = target.kind ? target : objectiveArt(target);
  const cv = h('canvas', { width: size * 2, height: size * 2, class: 'obj-icon', 'aria-hidden': 'true' });
  cv.style.width = size + 'px'; cv.style.height = size + 'px';
  const g = cv.getContext('2d'); g.scale(2, 2);
  if (!art) return cv;
  paintObjective(g, art, size, era);
  // sprites and painted tiles load lazily: redraw once they are in
  if (!objectiveArtReady(art, era)) { if (eraHasSprites(era)) loadEraSprites(era).then(() => paintObjective(g, art, size, era)); setTimeout(() => paintObjective(g, art, size, era), 500); }
  return cv;
}
// true when every picture this art needs is loaded (else the caller paints again later)
export function objectiveArtReady(art, era = currentEra) {
  if (art.kind === 'gem') return !eraHasSprites(era) || !!spriteFor(era, art.key);
  if (art.kind === 'block') return slotsReady(BLOCK_SLOT[art.key] || 'tile-dirt') && (!art.pick || !PICK || PICK.complete) && (art.badge == null || !eraHasSprites(era) || !!spriteFor(era, art.badge));
  return true;
}
// a goal as a line of text for cards: 'Collect 20', 'Dig 8'
export { GOAL_VERB } from '../data/objectiveArt.js';
