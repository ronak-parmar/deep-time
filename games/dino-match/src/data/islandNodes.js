// Level-node waypoints per era island, in picture space: u = 0..1 across the island picture, v = 0..1 down it.
// The nodes (era.fossils * 2) are spaced evenly along the era's ground path (ISLAND_PATHS), from the first node (front of the
// island) to the last (back), so the trail climbs the island. The world map draws its glowing trail through these points.
//
// ISLAND_PATHS were traced by eye on the real island pictures (art/islands/<era>.webp, cut from art/sheets/islands-final.png by
// tools/prep-islands.py; see docs/screens/m11/islands-grid-*.png): every point sits on walkable ground (sand, mud, grass, the
// cave floor) and the path goes round the big fossil prop in the middle, along the front edge first, up one side, then across
// the back. If an island picture is replaced, re-trace its path (or delete it: the serpentine default below takes over).
// ISLAND_NODES (explicit node list, exactly era.fossils * 2 points) wins over a path when given.
export const GROUND = { cx: 0.5, cy: 0.5, rx: 0.36, ry: 0.2 };

export const ISLAND_PATHS = {
  cambrian:         [[0.28, 0.64], [0.50, 0.66], [0.70, 0.60], [0.78, 0.47], [0.68, 0.34], [0.48, 0.30], [0.30, 0.32]],
  devonian:         [[0.24, 0.60], [0.45, 0.64], [0.68, 0.63], [0.86, 0.52], [0.80, 0.40], [0.60, 0.37], [0.40, 0.37], [0.22, 0.42]],
  carboniferous:    [[0.22, 0.64], [0.42, 0.70], [0.64, 0.69], [0.84, 0.58], [0.76, 0.44], [0.56, 0.37], [0.36, 0.40]],
  permian:          [[0.24, 0.62], [0.40, 0.66], [0.62, 0.66], [0.82, 0.57], [0.72, 0.42], [0.58, 0.31], [0.50, 0.22]],
  triassic:         [[0.18, 0.56], [0.40, 0.62], [0.62, 0.62], [0.82, 0.55], [0.80, 0.42], [0.66, 0.30], [0.45, 0.27], [0.28, 0.33]],
  jurassic:         [[0.24, 0.62], [0.45, 0.66], [0.70, 0.62], [0.88, 0.50], [0.80, 0.38], [0.58, 0.31], [0.38, 0.34], [0.22, 0.42]],
  cretaceous:       [[0.28, 0.64], [0.50, 0.68], [0.70, 0.66], [0.85, 0.55], [0.80, 0.42], [0.64, 0.30], [0.46, 0.28], [0.30, 0.32]],
  'age-of-mammals': [[0.24, 0.60], [0.45, 0.62], [0.68, 0.62], [0.88, 0.52], [0.90, 0.38], [0.74, 0.30], [0.55, 0.26], [0.35, 0.31]],
  'ice-age':        [[0.15, 0.55], [0.35, 0.60], [0.55, 0.62], [0.75, 0.56], [0.85, 0.45], [0.75, 0.33], [0.52, 0.29], [0.30, 0.35]],
  'early-humans':   [[0.24, 0.63], [0.40, 0.66], [0.62, 0.66], [0.82, 0.58], [0.76, 0.48], [0.60, 0.44], [0.38, 0.47]]
};

export const ISLAND_NODES = {
  // 'cambrian': [[.22,.70],[.50,.66],[.74,.60],[.60,.50],[.36,.44],[.62,.36]],
};

// n points spaced evenly (by arc length in picture px, hw = height / width) along a polyline, first and last on its ends
export function alongPath(path, n, hw = 1) {
  if (n <= 1) return [path[Math.floor(path.length / 2)].slice()];
  const seg = [], d = (a, b) => Math.hypot(b[0] - a[0], (b[1] - a[1]) * hw);
  let total = 0; for (let i = 1; i < path.length; i++) { const l = d(path[i - 1], path[i]); seg.push(l); total += l; }
  const out = [];
  for (let k = 0; k < n; k++) {
    let want = (total * k) / (n - 1), i = 0;
    while (i < seg.length - 1 && want > seg[i]) { want -= seg[i]; i++; }
    const f = seg[i] ? Math.min(1, want / seg[i]) : 0, a = path[i], b = path[i + 1];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

// serpentine default: rows of up to 4 nodes, the first row at the front of the island and the last at the back, each row
// running the other way, so the trail climbs the island and always keeps its distance from the next node.
export function defaultNodes(n, hw = 0.65) {   // hw = picture height / width
  const maxRows = Math.max(1, Math.floor(0.4 * hw * 346 / 40) + 1);
  const R = Math.max(1, Math.min(maxRows, Math.ceil(n / 4)));
  const vs = Array.from({ length: R }, (_, r) => (R === 1 ? 0.56 : R === 2 ? [0.6, 0.42][r] : 0.62 - r * (0.3 / (R - 1))));
  const half = vs.map((v) => { const dy = (v - GROUND.cy) / GROUND.ry; return Math.sqrt(Math.max(0, 1 - dy * dy)) * GROUND.rx * 0.85; });
  // nodes per row in proportion to the row's width (largest remainder), so a narrow front or back row is not crowded
  const tot = half.reduce((a, b) => a + b, 0), raw = half.map((hh) => (n * hh) / tot), cnt = raw.map(Math.floor);
  let left = n - cnt.reduce((a, b) => a + b, 0);
  raw.map((x, i) => [x - Math.floor(x), i]).sort((p, q) => q[0] - p[0]).forEach(([, i]) => { if (left > 0) { cnt[i]++; left--; } });
  const pts = [];
  for (let r = 0; r < R; r++) {
    const dir = r % 2 ? -1 : 1;
    for (let j = 0; j < cnt[r]; j++) {
      const f = cnt[r] === 1 ? 0.5 : j / (cnt[r] - 1);
      pts.push([GROUND.cx + dir * (-half[r] + 2 * half[r] * f), vs[r] + (j % 2 ? -0.012 : 0.012)]);
    }
  }
  return pts;
}
export const nodesFor = (eraId, n, hw) => {
  const given = ISLAND_NODES[eraId];
  if (given && given.length === n) return given;
  const path = ISLAND_PATHS[eraId];
  return path ? alongPath(path, n, hw) : defaultNodes(n, hw);
};
// the walkable ground of an island picture (for insideIsland and the trail): the ground ellipse plus a disc round every path point
export const groundOf = (eraId) => ISLAND_PATHS[eraId] || null;
