// Board helpers. Cells are stored row-major in a flat array: index = y * w + x.
// A piece is { id, c } where c is the gem colour index (0..5).
export const idx = (x, y, w) => y * w + x;
export const colOf = (i, w) => i % w;
export const rowOf = (i, w) => Math.floor(i / w);

export function adjacent(a, b, w) {
  const dx = Math.abs(colOf(a, w) - colOf(b, w));
  const dy = Math.abs(rowOf(a, w) - rowOf(b, w));
  return dx + dy === 1;
}

// All runs of 3+ equal colours, horizontal and vertical. Returns a sorted array of cell indexes
// (each cell once) or an empty array. `cells` may contain nulls (treated as no colour).
export function findMatches(cells, w, h) {
  const hit = new Set();
  const at = (x, y) => (cells[y * w + x] ? cells[y * w + x].c : -1);
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const c = at(x, y);
      let e = x + 1;
      while (c >= 0 && e < w && at(e, y) === c) e++;
      if (c >= 0 && e - x >= 3) for (let k = x; k < e; k++) hit.add(y * w + k);
      x = e;
    }
  }
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      const c = at(x, y);
      let e = y + 1;
      while (c >= 0 && e < h && at(x, e) === c) e++;
      if (c >= 0 && e - y >= 3) for (let k = y; k < e; k++) hit.add(k * w + x);
      y = e;
    }
  }
  return [...hit].sort((a, b) => a - b);
}

// Every swap of two neighbours that would create a match.
export function validSwaps(cells, w, h) {
  const out = [];
  const test = (a, b) => {
    [cells[a], cells[b]] = [cells[b], cells[a]];
    const ok = findMatches(cells, w, h).length > 0;
    [cells[a], cells[b]] = [cells[b], cells[a]];
    if (ok) out.push([a, b]);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x + 1 < w) test(i, i + 1);
      if (y + 1 < h) test(i, i + w);
    }
  }
  return out;
}
