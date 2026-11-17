// Chain queue for special activations (docs/11): each special fires at most once per move, activations are queued
// breadth-first, depth is capped (CONFIG.specials.chainDepth = 40). Cells are counted as a unique set. Pure.
import { CONFIG } from './config.js';
import { SPECIALS, effectCells, dominantColour } from './specials.js';

// cells: board array of pieces|null. base: iterable of cell indexes already cleared (a match).
// seeds: extra activations [{ i, ids:[pieceId], kind, effect?, colour?, o? }] (combos, rainbow swaps).
// opts.fired: Set of piece ids that must not fire again this move. opts.maxDepth overrides the cap.
// Returns { cleared:[unique indexes, in clear order], fires:[{ i, id, kind, o, depth, cells:[...] }], capped }.
export function runChain(cells, w, h, base, seeds = [], opts = {}) {
  const cap = opts.maxDepth ?? CONFIG.specials.chainDepth;
  const fired = opts.fired || new Set();
  const cleared = new Set(), order = [], fires = [], queued = new Set();
  let capped = false;
  const clear = (i) => { if (!cleared.has(i)) { cleared.add(i); order.push(i); } };
  const queue = [];
  const enqueue = (i, depth) => {
    const p = cells[i];
    if (!p || p.a || !p.s || fired.has(p.id) || queued.has(p.id)) return;
    queued.add(p.id); queue.push({ i, id: p.id, ids: [p.id], kind: p.s, o: p.o || 'h', depth, effect: SPECIALS[p.s].effect });
  };
  for (const i of base) { clear(i); }
  for (const s of seeds) { queue.push({ depth: 1, o: 'h', ...s, ids: s.ids || [] }); for (const id of s.ids || []) queued.add(id); }
  for (const i of base) enqueue(i, 1);
  for (let q = 0; q < queue.length; q++) {
    const it = queue[q];
    if (it.depth > cap) { capped = true; continue; }
    if (it.ids.length && it.ids.every((id) => fired.has(id))) continue;
    for (const id of it.ids) fired.add(id);
    let colour = it.colour;
    if (it.effect.shape === 'colour' && colour == null) colour = dominantColour(cells);
    const hit = effectCells(it.effect, it.i, w, h, it.o, cells, colour);
    if (cells[it.i]) clear(it.i);
    const list = [];
    for (const j of hit) { if (cells[j] && !cells[j].a) { clear(j); list.push(j); enqueue(j, it.depth + 1); } }
    fires.push({ i: it.i, id: it.ids[0] ?? -1, kind: it.kind, o: it.o, depth: it.depth, cells: list, area: it.effect.shape === 'colour' ? list : hit, colour });
  }
  return { cleared: order, fires, capped };
}
