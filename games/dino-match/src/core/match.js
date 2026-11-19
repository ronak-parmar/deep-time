// Match grouping and special creation (docs/11 phase A). Pure functions.
// Counting is always by UNIQUE CELLS of a connected same-colour group, never by run length sums.
import { CREATE, SPECIALS, FIRECRACKER_AXIS } from './specials.js';

const at = (cells, i) => (cells[i] ? cells[i].c : -1);

// Every straight run of 3+ same-colour cells. { dir:'h'|'v', c, cells:[...] } (rainbow / empty never match: c < 0).
export function findRuns(cells, w, h) {
  const runs = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const c = at(cells, y * w + x); let e = x + 1;
      while (c >= 0 && e < w && at(cells, y * w + e) === c) e++;
      if (c >= 0 && e - x >= 3) runs.push({ dir: 'h', c, cells: Array.from({ length: e - x }, (_, k) => y * w + x + k) });
      x = e;
    }
  }
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      const c = at(cells, y * w + x); let e = y + 1;
      while (c >= 0 && e < h && at(cells, e * w + x) === c) e++;
      if (c >= 0 && e - y >= 3) runs.push({ dir: 'v', c, cells: Array.from({ length: e - y }, (_, k) => (y + k) * w + x) });
      y = e;
    }
  }
  return runs;
}

// Connected groups of matched cells (4-neighbour, same colour). { c, cells:[sorted unique], runs:[...] }
export function findGroups(cells, w, h) {
  const runs = findRuns(cells, w, h);
  if (!runs.length) return [];
  const colour = new Map();
  for (const r of runs) for (const i of r.cells) colour.set(i, r.c);
  const seen = new Set(), groups = [];
  for (const start of [...colour.keys()].sort((a, b) => a - b)) {
    if (seen.has(start)) continue;
    const comp = [], stack = [start]; seen.add(start);
    while (stack.length) {
      const i = stack.pop(); comp.push(i);
      const x = i % w, y = Math.floor(i / w);
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !seen.has(j) && colour.get(j) === colour.get(i)) { seen.add(j); stack.push(j); }
      }
    }
    comp.sort((a, b) => a - b);
    const set = new Set(comp);
    groups.push({ c: colour.get(start), cells: comp, runs: runs.filter((r) => set.has(r.cells[0])) });
  }
  return groups;
}

// Deterministic rule priority: 7+ cells, then cross/T/L (two runs sharing a cell), then straight runs, then group size.
// Returns { kind, o, cross, hub } or null. `kind` is looked up from CREATE (data). `allowed` = unlocked kinds (array) or null for all.
export function classify(group, allowed = null) {
  const n = group.cells.length, H = group.runs.filter((r) => r.dir === 'h'), V = group.runs.filter((r) => r.dir === 'v');
  let hub = -1, cross = false;
  for (const rh of H) for (const rv of V) for (const i of rh.cells) {
    if (!rv.cells.includes(i)) continue;
    if (hub < 0) hub = i;
    const interior = i !== rh.cells[0] && i !== rh.cells[rh.cells.length - 1] && i !== rv.cells[0] && i !== rv.cells[rv.cells.length - 1];
    if (interior) { cross = true; hub = i; }
  }
  let kind = null, o = null;
  const longest = group.runs.reduce((a, r) => (r.cells.length > a.cells.length ? r : a), group.runs[0]);
  if (n >= 7) kind = CREATE.group7;
  else if (hub >= 0) kind = cross ? CREATE.cross : n === 5 ? CREATE.tl5 : n === 6 ? CREATE.group6 : null;
  else if (n === 5 && longest.cells.length === 5) kind = CREATE.straight5;
  else if (n === 4 && longest.cells.length === 4) kind = CREATE.straight4;
  else if (n === 6) kind = CREATE.group6;
  if (kind && allowed && !allowed.includes(kind)) kind = null;
  if (!kind) return null;
  if (kind === 'firecracker') o = FIRECRACKER_AXIS === 'along' ? longest.dir : longest.dir === 'h' ? 'v' : 'h';
  return { kind, o, cross, hub, longest };
}

// Where the special appears: the cell the player swapped INTO when it is part of the group, else the hub (intersection),
// else the middle of the longest run, else the middle of the group.
export function spawnCell(group, info, swappedTo = -1) {
  if (swappedTo >= 0 && group.cells.includes(swappedTo)) return swappedTo;
  if (info.hub >= 0) return info.hub;
  const run = info.longest;
  return run ? run.cells[Math.floor(run.cells.length / 2)] : group.cells[Math.floor(group.cells.length / 2)];
}

// A swap is legal when it makes a match or involves a special: since M10 a special swapped with ANY adjacent tile fires (a rainbow
// cannot take an artefact's colour, so rainbow + artefact stays illegal). Used for hints, the bot and dead-board checks.
export function legalSwaps(cells, w, h) {
  const out = [];
  const test = (a, b) => {
    const pa = cells[a], pb = cells[b];
    if (!pa || !pb) return;
    if ((pa.s === 'rainbow' && pb.a) || (pb.s === 'rainbow' && pa.a)) return;
    if (pa.s || pb.s) { out.push([a, b]); return; }
    [cells[a], cells[b]] = [pb, pa];
    const ok = findRuns(cells, w, h).length > 0;
    [cells[a], cells[b]] = [pa, pb];
    if (ok) out.push([a, b]);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (x + 1 < w) test(i, i + 1); if (y + 1 < h) test(i, i + w); }
  return out;
}

export const kindName = (k) => SPECIALS[k]?.name || k;
