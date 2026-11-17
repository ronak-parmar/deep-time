// Level-node waypoints per era island, in picture space: u = 0..1 across the island picture, v = 0..1 down it.
// One point per node (era.fossils * 2), listed from the first node (bottom of the island) to the last (top).
// The nodes must sit on the island's ground. Tune an era by giving it an explicit list here; eras without a list get
// a winding default that stays inside the ground ellipse (centre .5/.54, radii .34/.24).
// The first node of an era should be near the bottom front, the last near the top back, so the trail climbs the island.
export const GROUND = { cx: 0.5, cy: 0.54, rx: 0.34, ry: 0.24 };

export const ISLAND_NODES = {
  // 'cambrian': [[.22,.70],[.50,.66],[.74,.60],[.60,.50],[.36,.44],[.62,.36]],
};

// serpentine default: rows of up to 4 nodes, the first row at the front of the island and the last at the back, each row
// running the other way, so the trail climbs the island and always keeps its distance from the next node.
export function defaultNodes(n, hw = 0.65) {   // hw = picture height / width
  const maxRows = Math.max(1, Math.floor(0.4 * hw * 346 / 40) + 1);
  const R = Math.max(1, Math.min(maxRows, Math.ceil(n / 4)));
  const vs = Array.from({ length: R }, (_, r) => (R === 1 ? 0.56 : R === 2 ? [0.66, 0.44][r] : 0.72 - r * (0.4 / (R - 1))));
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
  return given && given.length === n ? given : defaultNodes(n, hw);
};
