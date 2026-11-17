// Island screen geometry (pure, unit tested): one era as a tall winding path, every level a node, numbered continuously
// from the era's first level (bottom) to its last (top). World units: 360 wide, y grows downward.
import { CONFIG } from '../core/config.js';
import { rng01 } from './util.js';

export const PW = 360, STEP = 78, TOP = 150, BOTTOM = 230, MILESTONE_GAP = 70;

export function islandPath(era) {
  const PER = CONFIG.fossils.levelsPerFossil, n = era.levels, blocks = Math.ceil(n / PER);
  const H = TOP + BOTTOM + (n - 1) * STEP + blocks * MILESTONE_GAP;
  const nodes = [], milestones = [];
  let y = H - BOTTOM;
  for (let i = 0; i < n; i++) {
    const level = era.start + i, b = Math.floor(i / PER);
    const x = PW / 2 + Math.sin(i * 0.55 + era.index) * 96 + Math.sin(i * 0.17) * 18;
    nodes.push({ i, level, x, y, block: b, fossil: era.fossils[b] });
    if ((i + 1) % PER === 0 || i === n - 1) {   // the fossil this block of 50 levels digs up: marker above its last level
      y -= MILESTONE_GAP / 2 + STEP / 2;
      milestones.push({ block: b, fossil: era.fossils[b], after: level, x: PW / 2 + (x < PW / 2 ? 70 : -70), y });
      y -= MILESTONE_GAP / 2 + STEP / 2;
    } else y -= STEP;
  }
  // decorations: seeded, beside the path, never on a node or a marker
  const decor = [], r = rng01(4100 + era.index * 13);
  for (let k = 0; k < n * 0.9; k++) {
    const a = nodes[Math.floor(r() * n)], side = r() > 0.5 ? 1 : -1, x = a.x + side * (54 + r() * 70), yy = a.y + (r() - 0.5) * STEP;
    if (x < 14 || x > PW - 14) continue;
    if (nodes.some((q) => Math.abs(q.y - yy) < 60 && Math.abs(q.x - x) < 46)) continue;
    if (milestones.some((m) => Math.abs(m.y - yy) < 50 && Math.abs(m.x - x) < 90)) continue;
    decor.push({ x, y: yy, s: 0.7 + r() * 0.6, k: Math.floor(r() * 100) });
  }
  decor.sort((p, q) => p.y - q.y);
  return { H, nodes, milestones, decor };
}

// nodes whose y is inside [y0, y1] (binary search on the descending y list)
export function visibleRange(path, y0, y1) {
  const ns = path.nodes; let lo = 0, hi = ns.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (ns[m].y > y1) lo = m + 1; else hi = m; }
  let end = lo; while (end < ns.length && ns[end].y >= y0) end++;
  return [lo, end];
}
