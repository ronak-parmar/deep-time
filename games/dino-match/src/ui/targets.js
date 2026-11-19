// Target icons and the HUD Target panel (docs/11). Presentation only: progress comes from core/targets.js.
import { h } from './dom.js';
import { glyph } from './glyphs.js';
import { objectiveIcon } from './objectives.js';
import { targetProgress, targetLabel } from '../core/targets.js';
import { cue } from '../render/sound.js';
import { roll } from '../render/motion.js';
import { goalLeft } from '../core/targets.js';

// Target icons: one shared drawing (ui/objectives.js), the same art the board uses.
export const gemIcon = (c, size = 20) => objectiveIcon({ kind: 'gem', key: c }, size);
export const obstacleIcon = (kind, size = 20) => objectiveIcon(kind === 'artefact' ? { kind: 'artefact', key: 'artefact' } : { kind: 'obstacle', key: kind }, size);
export const targetIcon = (t, size = 20) => objectiveIcon(t, size);

// HUD panel with 1 to 3 targets: each = the objective's own board art on a dark inset well + how many are LEFT (counting down);
// a tick badge and a small burst when it is done. update(state | partial).
export function TargetPanel(state) {
  const rows = [], el = h('div', { class: 'target-panel', role: 'status', 'aria-label': 'Targets' });
  const list = targetProgress(state), many = list.length;
  el.classList.toggle('target-panel--many', many > 1); el.dataset.n = String(many);
  for (const t of list) {
    const left = goalLeft(t.n, t.got);
    const val = h('span', { class: 'heading dt-num tgt-val' }, String(left));
    const tick = h('span', { class: 'tgt-tick', 'aria-hidden': 'true' }, glyph('check', 12));
    const well = h('span', { class: 'tgt__well' }, objectiveIcon({ ...t, blocks: state.blocks }, many > 2 ? 23 : many > 1 ? 24 : 26), tick, h('i', { class: 'tgt__burst', 'aria-hidden': 'true' }));
    const row = h('div', { class: 'tgt' + (t.done ? ' tgt--done' : ''), 'aria-label': targetLabel(t) }, well, val);
    rows.push({ t, val, row }); el.append(row);
  }
  // one target moved: the LEFT count rolls down (clamped at 0, never negative), the row pops; reaching 0 adds the tick + burst
  const set = (i, got, n) => {
    const r = rows[i], was = r.t.got, from = goalLeft(r.t.n, was), left = goalLeft(n, got), done = left === 0;
    r.t = { ...r.t, got: Math.min(got, n), n };
    r.row.setAttribute('aria-label', targetLabel(r.t) + `, ${left} left`);
    if (from !== left) roll(r.val, from, left); else r.val.textContent = String(left);
    if (got !== was) { r.row.classList.remove('tgt--pop'); void r.row.offsetWidth; r.row.classList.add('tgt--pop'); cue('targetPop'); }
    if (done && !r.row.classList.contains('tgt--done')) { r.row.classList.add('tgt--done'); cue('targetDone'); }
  };
  return {
    el,
    // update({ state }) refreshes every target; update({ dug, total }) moves only the dig target (called as blocks break on screen)
    // update({ got: [...] }) applies a core 'targets' event (live, during the move's animation)
    update({ state: st, dug, total, got }) {
      if (got) got.forEach((v, i) => rows[i] && rows[i].t.type !== 'dig' && set(i, v, rows[i].t.n));   // dig moves with the crumbling blocks (onDig)
      else if (st) targetProgress(st).forEach((t, i) => set(i, t.got, t.n));
      else if (dug != null) rows.forEach((r, i) => { if (r.t.type === 'dig') set(i, dug, total ?? r.t.n); });
    }
  };
}
