// Target icons and the HUD Target panel (docs/11). Presentation only: progress comes from core/targets.js.
import { h } from './dom.js';
import { glyph } from './glyphs.js';
import { drawGemShape } from '../render/gems.js';
import { slotUrl } from '../render/art.js';
import { targetProgress, targetLabel } from '../core/targets.js';
import { cue } from '../render/sound.js';
import { drawObstacle, drawArtefact } from '../render/obstacles.js';

// A small icon for a target: dig = the dirt block, collect = the gem it asks for. `colour` badges draw the gem silhouette.
export function gemIcon(c, size = 20) {
  const cv = h('canvas', { width: size * 2, height: size * 2, class: 'tgt-icon', 'aria-hidden': 'true' });
  cv.style.width = size + 'px'; cv.style.height = size + 'px';
  const g = cv.getContext('2d'); g.translate(size, size); drawGemShape(g, c, size * 0.42);
  return cv;
}
// obstacle / artefact icons reuse the board drawing, so a target looks like what is on the board
const ICON_KIND = { fossils: 'fossil', skeleton: 'bone', stones: 'sandstone' };
export function obstacleIcon(kind, size = 20) {
  const cv = h('canvas', { width: size * 2, height: size * 2, class: 'tgt-icon', 'aria-hidden': 'true' });
  cv.style.width = size + 'px'; cv.style.height = size + 'px';
  const g = cv.getContext('2d'); g.scale(2, 2);
  if (kind === 'artefact') { g.translate(size / 2, size / 2); drawArtefact(g, size * 0.4, 0, true); }
  else drawObstacle(g, { k: kind, hp: 1, max: 1 }, size / 2, size / 2, size + 4, 0, 0, true);
  return cv;
}
export function targetIcon(t, size = 20) {
  if (t.type === 'collect') return gemIcon(t.c, size);
  if (t.type === 'drop') return obstacleIcon('artefact', size);
  if (t.type === 'clearAll') return obstacleIcon(t.k, size);
  if (ICON_KIND[t.type]) return obstacleIcon(ICON_KIND[t.type], size);
  const url = slotUrl('tile-dirt');
  if (url) return h('img', { src: url, alt: '', class: 'tgt-icon', width: size, height: size, draggable: 'false' });
  const s = glyph('level', size); s.setAttribute('class', 'dt-glyph tgt-icon'); return s;
}

// HUD panel with 1 to 3 targets: icon + progress, pops when it changes, ticks when done. update(state | partial).
export function TargetPanel(state) {
  const rows = [], el = h('div', { class: 'target-panel', role: 'status', 'aria-label': 'Targets' });
  const many = targetProgress(state).length > 1;
  el.classList.toggle('target-panel--many', many);
  for (const t of targetProgress(state)) {
    const val = h('span', { class: 'heading dt-num tgt-val' }, `${t.got}/${t.n}`);
    const tick = h('span', { class: 'tgt-tick', 'aria-hidden': 'true' }, glyph('check', 14));
    const row = h('div', { class: 'tgt' + (t.done ? ' tgt--done' : ''), 'aria-label': targetLabel(t) }, targetIcon(t, many ? 18 : 24), val, tick);
    rows.push({ t, val, row }); el.append(row);
  }
  const set = (i, got, n) => {
    const r = rows[i], was = r.t.got, done = got >= n;
    r.t = { ...r.t, got, n }; r.val.textContent = `${got}/${n}`;
    if (got !== was) { r.row.classList.remove('tgt--pop'); void r.row.offsetWidth; r.row.classList.add('tgt--pop'); cue('targetPop'); }
    if (done && !r.row.classList.contains('tgt--done')) { r.row.classList.add('tgt--done'); cue('targetDone'); }
  };
  return {
    el,
    // update({ state }) refreshes every target; update({ dug, total }) moves only the dig target (called as blocks break on screen)
    update({ state: st, dug, total }) {
      if (st) targetProgress(st).forEach((t, i) => set(i, t.got, t.n));
      else if (dug != null) rows.forEach((r, i) => { if (r.t.type === 'dig') set(i, dug, total ?? r.t.n); });
    }
  };
}
