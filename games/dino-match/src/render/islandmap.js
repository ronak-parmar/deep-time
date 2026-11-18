// The home screen world: ten floating islands (Cambrian at the bottom, Early humans at the top) joined by one winding
// trail with level nodes. Everything is code-drawn. The layout (islands, trail, nodes) is pure data so it is unit tested;
// the painter draws the water, the islands (pre-rendered once into bitmaps), foam, clouds, fog and the trail.
// Units: the world is 360 units wide (scaled to the phone width), y grows downward, the bottom of the world is Cambrian.
import { ERAS, TOTAL_LEVELS } from '../core/eras.js';
import { FOSSILS } from '../core/fossils.js';
import { CONFIG } from '../core/config.js';
import { themeFor } from './eraTheme.js';
import { rng01, mix, shade, rgba, clamp } from './util.js';
import { drawFossilArt } from './fossilArt.js';
import { drawThumb, thumbsReady } from './fossilThumbs.js';
import { peek, loadEra } from './art.js';
import { nodesFor, GROUND } from '../data/islandNodes.js';
import { artOf } from './islandart.js';

export const W = 360;
export const NODES_PER_FOSSIL = 2;                    // one node per 25 levels
export const NODE_STEP = CONFIG.fossils.levelsPerFossil / NODES_PER_FOSSIL;
const GAP = 120, TOP_PAD = 170, BOTTOM_PAD = 190, CLIFF = 24;
const islandHeight = (nFossils) => 96 + nFossils * 84;

const catmull = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  return [0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)];
};

// ---- layout (pure) -----------------------------------------------------------------------------
export const ISLAND_W = 346, STEP_K = 0.78, ART_TOP_PAD = 300;
// art = Map(eraId -> { w, h }) of the island pictures that exist (render/islandart.js). An era with a picture is laid out from
// the picture (its nodes come from data/islandNodes.js); the others keep the code-drawn island.
export function buildLayout(art = new Map()) {
  const info = ERAS.map((e) => {
    const a = art.get(e.id), hI = islandHeight(e.fossils.length);
    if (a) { const ah = ISLAND_W * a.h / a.w; return { art: a, h: ah, step: ah * STEP_K }; }
    return { art: null, h: hI, step: hI + GAP };
  });
  const topPad = art.size ? ART_TOP_PAD : TOP_PAD;
  const H = topPad + BOTTOM_PAD + info.slice(0, -1).reduce((s, q) => s + q.step, 0) + info.at(-1).h;
  const islands = [], nodes = [];
  let bottom = H - BOTTOM_PAD;
  ERAS.forEach((era, i) => {
    const inf = info[i], hI = inf.h, top = bottom - hI, N = era.fossils.length * NODES_PER_FOSSIL;
    const addNode = (k, x, y) => {
      const fi = Math.floor(k / NODES_PER_FOSSIL), level = era.start + fi * CONFIG.fossils.levelsPerFossil + (k % NODES_PER_FOSSIL) * NODE_STEP;
      const node = { id: nodes.length, island: i, k, x, y, level, fossil: era.fossils[fi] };
      nodes.push(node); return node;
    };
    if (inf.art) {
      const cx = 180 + (i % 2 ? 8 : -8), ax = cx - ISLAND_W / 2;
      const isl = { index: i, era: era.id, cx, cy: top + GROUND.cy * hI, rx: GROUND.rx * ISLAND_W, ry: GROUND.ry * hI, top, bottom, h: hI, lobes: [], nodes: [], fossils: [],
        art: { x: ax, y: top, w: ISLAND_W, h: hI }, plaque: { x: cx, y: top + 0.05 * hI } };
      nodesFor(era.id, N, hI / ISLAND_W).forEach(([u, v], k) => isl.nodes.push(addNode(k, ax + u * ISLAND_W, top + v * hI)));
      isl.lobes.push({ x: ax + GROUND.cx * ISLAND_W, y: top + GROUND.cy * hI, rx: GROUND.rx * ISLAND_W * 1.08, ry: GROUND.ry * hI * 1.1 });
      isl.box = { x0: isl.lobes[0].x - isl.lobes[0].rx, x1: isl.lobes[0].x + isl.lobes[0].rx, y0: isl.lobes[0].y - isl.lobes[0].ry, y1: isl.lobes[0].y + isl.lobes[0].ry };
      islands.push(isl);
    } else {
      const rx = 146, ry = hI / 2, cx = 180 + (i % 2 ? 10 : -10), cy = top + ry, rnd = rng01(1000 + i * 77);
      const isl = { index: i, era: era.id, cx, cy, rx, ry, top, bottom, h: hI, lobes: [], nodes: [], fossils: [], art: null };
      for (let k = 0; k < N; k++) {                          // nodes wind up the island
        const t = N === 1 ? 0.5 : k / (N - 1), y = bottom - 0.14 * hI - t * 0.72 * hI;
        isl.nodes.push(addNode(k, cx + Math.sin(t * N * 0.62 + i * 1.7) * 52, y));
      }
      // the island is a chain of lobes along the trail (one per fossil) with a cap at each end, so it reads as a winding island
      const first = isl.nodes[0], last = isl.nodes.at(-1);
      isl.lobes.push({ x: first.x, y: first.y + 24, rx: 84, ry: 48 });
      era.fossils.forEach((fid, fi) => {
        const a = isl.nodes[fi * NODES_PER_FOSSIL], b = isl.nodes[fi * NODES_PER_FOSSIL + NODES_PER_FOSSIL - 1];
        const my = (a.y + b.y) / 2, mx = (a.x + b.x) / 2, side = mx > cx ? -1 : 1;
        isl.lobes.push({ x: mx + side * 10, y: my, rx: 96 + rnd() * 12, ry: 56 + rnd() * 8 });
        isl.fossils.push({ id: fid, x: clamp(mx + side * 46, 52, 308), y: my + 2, w: 76, h: 42 });
      });
      isl.lobes.push({ x: last.x, y: last.y - 24, rx: 84, ry: 48 });
      for (let k = 0, nl = isl.lobes.length - 1; k < nl; k++) { const p = isl.lobes[k], q = isl.lobes[k + 1]; isl.lobes.push({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, rx: 76, ry: 44 }); }
      isl.box = { x0: Math.min(...isl.lobes.map((l) => l.x - l.rx)), x1: Math.max(...isl.lobes.map((l) => l.x + l.rx)), y0: Math.min(...isl.lobes.map((l) => l.y - l.ry)), y1: Math.max(...isl.lobes.map((l) => l.y + l.ry)) };
      isl.plaque = { x: cx, y: isl.box.y0 - 16 };
      islands.push(isl);
    }
    const il = islands.at(-1); il.minGap = 1e9;
    for (let a = 0; a < il.nodes.length; a++) for (let b = a + 1; b < il.nodes.length; b++) il.minGap = Math.min(il.minGap, Math.hypot(il.nodes[a].x - il.nodes[b].x, il.nodes[a].y - il.nodes[b].y));
    bottom -= inf.step;
  });
  // the trail: a smooth spline through every node, in order; segments between islands are bridges
  const pts = [[nodes[0].x, nodes[0].y + 40], ...nodes.map((n) => [n.x, n.y]), [nodes.at(-1).x, nodes.at(-1).y - 40]];
  const trail = [];
  for (let s = 1; s < pts.length - 2; s++) {
    const bridge = nodes[s - 1].island !== nodes[s].island;
    for (let u = 0; u < 10; u++) trail.push({ p: catmull(pts[s - 1], pts[s], pts[s + 1], pts[s + 2], u / 10), bridge, seg: s - 1, a: nodes[s - 1].island, b: nodes[s].island, u: u / 10 });
  }
  trail.push({ p: [nodes.at(-1).x, nodes.at(-1).y], bridge: false, seg: nodes.length - 1, a: nodes.at(-1).island, b: nodes.at(-1).island, u: 0 });
  return { H, topPad, islands, nodes, trail };
}


// where the player is: node index (the node whose 25-level band holds the level)
export function nodeStates(layout, level) {
  const lvl = ((Math.max(1, Math.floor(level)) - 1) % TOTAL_LEVELS) + 1;
  return layout.nodes.map((n) => (lvl >= n.level + NODE_STEP ? 'done' : lvl >= n.level ? 'current' : 'locked'));
}
export function islandState(isl, level) {
  const e = ERAS[isl.index], lvl = ((Math.max(1, Math.floor(level)) - 1) % TOTAL_LEVELS) + 1;
  return lvl > e.end ? 'done' : lvl >= e.start ? 'current' : 'locked';
}

// ---- era looks ---------------------------------------------------------------------------------
const LOOK = {
  cambrian:        { ground: '#E8D6A2', groundD: '#C9B278', rock: '#7B6A5C', sea: '#1E7C8C', props: ['coral', 'shell', 'coral', 'star', 'kelp'] },
  devonian:        { ground: '#79A85A', groundD: '#4B7B3E', rock: '#6A5A3C', sea: '#237A78', props: ['lycopod', 'fern', 'pond', 'lycopod', 'fern'] },
  carboniferous:   { ground: '#4E9C5B', groundD: '#2E6E45', rock: '#5B5A44', sea: '#1F7168', props: ['fern', 'lycopod', 'fern', 'mushroom', 'fern'] },
  permian:         { ground: '#CF8450', groundD: '#9E5A35', rock: '#8A4E36', sea: '#2A6F86', props: ['mesa', 'shrub', 'mesa', 'cactus', 'rock'] },
  triassic:        { ground: '#B3A35E', groundD: '#7E7340', rock: '#756A52', sea: '#2A7088', props: ['conifer', 'rock', 'conifer', 'shrub', 'conifer'] },
  jurassic:        { ground: '#56A85F', groundD: '#2F7541', rock: '#5E5444', sea: '#1F7A86', props: ['cycad', 'volcano', 'fern', 'cycad', 'rock'] },
  cretaceous:      { ground: '#6FAE62', groundD: '#3E7B4A', rock: '#6A5260', sea: '#2B6A8F', props: ['blossom', 'cycad', 'blossom', 'fern', 'rock'] },
  'age-of-mammals':{ ground: '#9BBB5E', groundD: '#668E43', rock: '#7B6C50', sea: '#2E7392', props: ['tree', 'bush', 'tree', 'flower', 'tree'] },
  'ice-age':       { ground: '#E9F2F8', groundD: '#B6CDDD', rock: '#6E849A', sea: '#3B7FA6', props: ['iceSpire', 'snowPine', 'iceSpire', 'snowPine', 'rock'] },
  'early-humans':  { ground: '#C09A62', groundD: '#8F6C3F', rock: '#6E5A48', sea: '#2F6F8B', props: ['hut', 'fire', 'rock', 'tree', 'bush'] }
};

// ---- small drawing helpers --------------------------------------------------------------------
const path = (c, pts, close = true) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); if (close) c.closePath(); };
const smooth = (c, pts) => {   // closed quadratic-smoothed blob through points
  const n = pts.length; c.beginPath();
  const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], s = m(pts[n - 1], pts[0]); c.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) { const q = pts[i], e = m(pts[i], pts[(i + 1) % n]); c.quadraticCurveTo(q[0], q[1], e[0], e[1]); }
  c.closePath();
};
const lobesPath = (c, lobes, k = 1, dx = 0, dy = 0) => { c.beginPath(); lobes.forEach((l) => { c.moveTo(l.x + dx + l.rx * k, l.y + dy); c.ellipse(l.x + dx, l.y + dy, l.rx * k, l.ry * k, 0, 0, Math.PI * 2); }); };
const ellipse = (c, x, y, rx, ry, fill, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); };
const lin = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const rad = (c, x, y, r0, r1, stops) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const shadowAt = (c, x, y, rx, a = 0.28) => ellipse(c, x, y, rx, rx * 0.32, `rgba(10,20,30,${a})`);

// ---- props (x, y is the base; s = size in units) -------------------------------------------------
const PROPS = {
  tree(c, x, y, s, L, r) {
    shadowAt(c, x, y, s * 0.5);
    c.fillStyle = lin(c, x - 3, 0, x + 3, 0, [[0, '#8B6A47'], [1, '#4E3924']]); c.beginPath(); c.moveTo(x - s * 0.07, y); c.lineTo(x - s * 0.04, y - s * 0.55); c.lineTo(x + s * 0.04, y - s * 0.55); c.lineTo(x + s * 0.07, y); c.fill();
    [[-0.28, -0.62, 0.34], [0.26, -0.66, 0.32], [0, -0.9, 0.38]].forEach(([dx, dy, k]) => { const g = rad(c, x + dx * s - s * 0.08, y + dy * s - s * 0.1, 1, s * k, [[0, shade(L.ground, 0.25)], [1, shade(L.groundD, -0.15)]]); ellipse(c, x + dx * s, y + dy * s, s * k, s * k * 0.9, g); });
  },
  bush(c, x, y, s, L) { shadowAt(c, x, y, s * 0.5); [-0.25, 0.25, 0].forEach((d, i) => ellipse(c, x + d * s, y - s * (0.2 + (i === 2 ? 0.1 : 0)), s * 0.3, s * 0.24, rad(c, x + d * s - 2, y - s * 0.35, 1, s * 0.35, [[0, shade(L.ground, 0.2)], [1, shade(L.groundD, -0.1)]]))); },
  flower(c, x, y, s, L, r) { for (let i = 0; i < 4; i++) { const px = x + (r() - 0.5) * s, py = y + (r() - 0.5) * s * 0.3; c.strokeStyle = '#3F7A3A'; c.lineWidth = 1; c.beginPath(); c.moveTo(px, py); c.lineTo(px, py - s * 0.35); c.stroke(); ellipse(c, px, py - s * 0.38, 2.6, 2.6, ['#FFD35A', '#FF8FA3', '#fff', '#9AD0FF'][i % 4]); } },
  conifer(c, x, y, s) {
    shadowAt(c, x, y, s * 0.4); c.fillStyle = '#5A4630'; c.fillRect(x - 1.8, y - s * 0.2, 3.6, s * 0.2);
    for (let i = 0; i < 4; i++) { const yy = y - s * 0.12 - i * s * 0.22, w = s * (0.42 - i * 0.07); c.beginPath(); c.moveTo(x - w, yy); c.lineTo(x, yy - s * 0.34); c.lineTo(x + w, yy); c.closePath(); c.fillStyle = lin(c, x - w, 0, x + w, 0, [[0, '#4F8F4C'], [0.55, '#2F6B3E'], [1, '#1E4A2E']]); c.fill(); }
  },
  snowPine(c, x, y, s) {
    shadowAt(c, x, y, s * 0.4);
    for (let i = 0; i < 4; i++) { const yy = y - s * 0.1 - i * s * 0.22, w = s * (0.4 - i * 0.07); c.beginPath(); c.moveTo(x - w, yy); c.lineTo(x, yy - s * 0.34); c.lineTo(x + w, yy); c.closePath(); c.fillStyle = lin(c, x - w, 0, x + w, 0, [[0, '#6FA58F'], [1, '#2F5F58']]); c.fill(); c.beginPath(); c.moveTo(x - w * 0.8, yy - s * 0.06); c.lineTo(x, yy - s * 0.34); c.lineTo(x + w * 0.8, yy - s * 0.06); c.quadraticCurveTo(x, yy - s * 0.14, x - w * 0.8, yy - s * 0.06); c.fillStyle = '#F4FAFF'; c.fill(); }
  },
  cycad(c, x, y, s) {
    shadowAt(c, x, y, s * 0.45);
    c.fillStyle = lin(c, x - 4, 0, x + 4, 0, [[0, '#8A6B4A'], [1, '#4B3924']]); c.beginPath(); c.moveTo(x - s * 0.07, y); c.quadraticCurveTo(x - s * 0.02, y - s * 0.35, x - s * 0.03, y - s * 0.62); c.lineTo(x + s * 0.05, y - s * 0.62); c.quadraticCurveTo(x + s * 0.06, y - s * 0.3, x + s * 0.08, y); c.fill();
    for (let i = 0; i < 9; i++) { const a = -Math.PI * (0.05 + i * 0.113), l = s * 0.62; c.strokeStyle = i % 2 ? '#3E8F4A' : '#56AA5A'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x, y - s * 0.62); c.quadraticCurveTo(x + Math.cos(a) * l * 0.55, y - s * 0.62 + Math.sin(a) * l * 0.55 - 6, x + Math.cos(a) * l, y - s * 0.62 + Math.sin(a) * l * 0.7 + 8); c.stroke(); }
  },
  fern(c, x, y, s) {
    shadowAt(c, x, y, s * 0.4, 0.2);
    for (let i = 0; i < 7; i++) { const a = -Math.PI * (0.08 + i * 0.14), l = s * (0.7 - Math.abs(i - 3) * 0.06); c.strokeStyle = '#2D7A45'; c.lineWidth = 1.3; const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l * 0.9 + l * 0.18; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.8 - 4, ex, ey); c.stroke();
      for (let k = 1; k < 6; k++) { const t = k / 6, px = x + (ex - x) * t, py = y + (ey - y) * t - Math.sin(t * Math.PI) * 3; c.strokeStyle = k % 2 ? '#52B26A' : '#3C9658'; c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.sin(a) * 5, py - Math.cos(a) * 3 + 3); c.moveTo(px, py); c.lineTo(px - Math.sin(a) * 5, py + Math.cos(a) * 3 - 3); c.stroke(); } }
  },
  lycopod(c, x, y, s) {
    shadowAt(c, x, y, s * 0.35);
    c.fillStyle = lin(c, x - 4, 0, x + 4, 0, [[0, '#8C7B55'], [1, '#4C412A']]); c.fillRect(x - s * 0.06, y - s * 0.95, s * 0.12, s * 0.95);
    c.strokeStyle = 'rgba(40,30,16,.55)'; c.lineWidth = 1; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(x - s * 0.06, y - i * s * 0.1); c.lineTo(x, y - i * s * 0.1 - 3); c.lineTo(x + s * 0.06, y - i * s * 0.1); c.stroke(); }
    for (let i = 0; i < 7; i++) { const a = -Math.PI * (0.1 + i * 0.13); c.strokeStyle = '#3F9E55'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y - s * 0.95); c.quadraticCurveTo(x + Math.cos(a) * s * 0.3, y - s * 0.95 + Math.sin(a) * s * 0.3 - 3, x + Math.cos(a) * s * 0.42, y - s * 0.95 + Math.sin(a) * s * 0.28 + 6); c.stroke(); }
  },
  mushroom(c, x, y, s) { shadowAt(c, x, y, s * 0.3); c.fillStyle = '#E9DFC8'; c.fillRect(x - s * 0.06, y - s * 0.4, s * 0.12, s * 0.4); ellipse(c, x, y - s * 0.42, s * 0.3, s * 0.2, lin(c, x, y - s * 0.6, x, y - s * 0.25, [[0, '#E86A50'], [1, '#A63B34']])); [-0.1, 0.08, 0].forEach((d, i) => ellipse(c, x + d * s * 1.5, y - s * (0.5 - i * 0.04), 1.6, 1.3, '#FFF3D8')); },
  rock(c, x, y, s, L) {
    shadowAt(c, x, y + 1, s * 0.55, 0.3);
    c.beginPath(); c.moveTo(x - s * 0.5, y); c.lineTo(x - s * 0.38, y - s * 0.34); c.lineTo(x - s * 0.05, y - s * 0.52); c.lineTo(x + s * 0.34, y - s * 0.36); c.lineTo(x + s * 0.5, y); c.closePath();
    c.fillStyle = lin(c, x - s * 0.5, y - s * 0.5, x + s * 0.5, y, [[0, shade(L.rock, 0.35)], [0.5, L.rock], [1, shade(L.rock, -0.35)]]); c.fill();
    c.beginPath(); c.moveTo(x - s * 0.38, y - s * 0.34); c.lineTo(x - s * 0.05, y - s * 0.52); c.lineTo(x + s * 0.34, y - s * 0.36); c.lineTo(x, y - s * 0.22); c.closePath(); c.fillStyle = 'rgba(255,255,255,.18)'; c.fill();
  },
  mesa(c, x, y, s, L) {
    shadowAt(c, x, y, s * 0.7, 0.3);
    c.beginPath(); c.moveTo(x - s * 0.55, y); c.lineTo(x - s * 0.42, y - s * 0.8); c.lineTo(x + s * 0.36, y - s * 0.8); c.lineTo(x + s * 0.55, y); c.closePath();
    c.fillStyle = lin(c, x - s * 0.5, 0, x + s * 0.5, 0, [[0, shade(L.rock, 0.3)], [0.55, L.rock], [1, shade(L.rock, -0.4)]]); c.fill();
    c.strokeStyle = 'rgba(60,20,10,.28)'; c.lineWidth = 1; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(x - s * 0.52 + i * 1.5, y - i * s * 0.16); c.lineTo(x + s * 0.52 - i * 1.5, y - i * s * 0.16); c.stroke(); }
    ellipse(c, x - 2, y - s * 0.8, s * 0.39, s * 0.07, lin(c, x - s * 0.4, 0, x + s * 0.4, 0, [[0, '#E8A96B'], [1, '#B96C44']]));
  },
  cactus(c, x, y, s) { shadowAt(c, x, y, s * 0.3); c.fillStyle = '#5E9A4A'; c.beginPath(); c.roundRect(x - s * 0.08, y - s * 0.7, s * 0.16, s * 0.7, s * 0.08); c.fill(); c.beginPath(); c.roundRect(x - s * 0.3, y - s * 0.5, s * 0.12, s * 0.28, s * 0.06); c.fill(); c.beginPath(); c.roundRect(x + s * 0.18, y - s * 0.55, s * 0.12, s * 0.3, s * 0.06); c.fill(); },
  shrub(c, x, y, s) { shadowAt(c, x, y, s * 0.4, 0.2); c.strokeStyle = '#8E7440'; c.lineWidth = 1.4; for (let i = 0; i < 6; i++) { const a = -Math.PI * (0.15 + i * 0.14); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * s * 0.3, y + Math.sin(a) * s * 0.4, x + Math.cos(a) * s * 0.45, y + Math.sin(a) * s * 0.55); c.stroke(); } },
  volcano(c, x, y, s) {
    shadowAt(c, x, y, s * 0.85, 0.3);
    c.beginPath(); c.moveTo(x - s * 0.85, y); c.quadraticCurveTo(x - s * 0.3, y - s * 0.3, x - s * 0.18, y - s * 0.95); c.lineTo(x + s * 0.2, y - s * 0.95); c.quadraticCurveTo(x + s * 0.3, y - s * 0.3, x + s * 0.85, y); c.closePath();
    c.fillStyle = lin(c, x - s * 0.8, 0, x + s * 0.8, 0, [[0, '#8C7867'], [0.5, '#5B4C42'], [1, '#2F2824']]); c.fill();
    c.beginPath(); c.moveTo(x - s * 0.18, y - s * 0.95); c.lineTo(x + s * 0.2, y - s * 0.95); c.lineTo(x + s * 0.08, y - s * 0.8); c.quadraticCurveTo(x, y - s * 0.86, x - s * 0.08, y - s * 0.8); c.closePath(); c.fillStyle = '#FF7A2E'; c.fill();
    c.strokeStyle = '#FF9D4A'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + s * 0.02, y - s * 0.85); c.quadraticCurveTo(x + s * 0.12, y - s * 0.5, x + s * 0.05, y - s * 0.2); c.stroke();
    ellipse(c, x - s * 0.12, y - s * 1.15, s * 0.2, s * 0.13, 'rgba(70,60,60,.55)'); ellipse(c, x + s * 0.05, y - s * 1.32, s * 0.16, s * 0.11, 'rgba(90,80,80,.4)');
  },
  blossom(c, x, y, s) {
    PROPS.tree(c, x, y, s, { ground: '#F2A1B6', groundD: '#C96485' }, () => 0.5);
  },
  coral(c, x, y, s, L, r) {
    shadowAt(c, x, y, s * 0.4, 0.2); const col = ['#F26D6D', '#F5A25D', '#C770E0'][Math.floor(r() * 3)];
    for (let i = 0; i < 5; i++) { const a = -Math.PI * (0.15 + i * 0.175), l = s * (0.55 + r() * 0.25); c.strokeStyle = col; c.lineWidth = 3.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l * 0.55, y + Math.sin(a) * l * 0.55); c.stroke(); c.beginPath(); c.moveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5); c.lineTo(x + Math.cos(a - 0.5) * l * 0.85, y + Math.sin(a - 0.5) * l * 0.85); c.stroke(); ellipse(c, x + Math.cos(a - 0.5) * l * 0.88, y + Math.sin(a - 0.5) * l * 0.88, 2.2, 2.2, shade(col, 0.45)); }
    c.lineCap = 'butt';
  },
  kelp(c, x, y, s) { c.strokeStyle = '#2F9C6B'; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + i * 5, y); c.bezierCurveTo(x + i * 5 - 8, y - s * 0.3, x + i * 5 + 8, y - s * 0.6, x + i * 5, y - s * (0.8 + i * 0.1)); c.stroke(); } },
  shell(c, x, y, s) { shadowAt(c, x, y, s * 0.3, 0.2); c.beginPath(); c.moveTo(x - s * 0.3, y); c.quadraticCurveTo(x, y - s * 0.6, x + s * 0.3, y); c.closePath(); c.fillStyle = lin(c, x, y - s * 0.5, x, y, [[0, '#FFF1E0'], [1, '#EBB59C']]); c.fill(); c.strokeStyle = 'rgba(160,90,70,.5)'; c.lineWidth = 0.8; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + i * s * 0.1, y - s * 0.38 + Math.abs(i) * 2); c.stroke(); } },
  star(c, x, y, s) { c.fillStyle = '#F0885A'; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.12 : s * 0.3, a = -Math.PI / 2 + (i * Math.PI) / 5; c.lineTo(x + Math.cos(a) * r, y - s * 0.2 + Math.sin(a) * r * 0.7); } c.closePath(); c.fill(); },
  pond(c, x, y, s) { ellipse(c, x, y - 2, s * 0.8, s * 0.32, lin(c, x, y - s * 0.3, x, y + s * 0.2, [[0, '#4FA9B8'], [1, '#2B7C8B']])); ellipse(c, x - s * 0.2, y - 4, s * 0.25, s * 0.06, 'rgba(255,255,255,.3)'); ellipse(c, x + s * 0.3, y, 5, 2.5, '#4C9B4A'); },
  iceSpire(c, x, y, s) {
    shadowAt(c, x, y, s * 0.5, 0.25);
    [[-0.3, 0.55, 0.16], [0.28, 0.7, 0.18], [0, 1, 0.22]].forEach(([dx, h, w]) => { const bx = x + dx * s; c.beginPath(); c.moveTo(bx - w * s, y); c.lineTo(bx - w * s * 0.2, y - h * s); c.lineTo(bx + w * s * 0.8, y); c.closePath(); c.fillStyle = lin(c, bx - w * s, 0, bx + w * s, 0, [[0, '#EAF8FF'], [0.5, '#9AD3F0'], [1, '#4F90B8']]); c.fill(); c.beginPath(); c.moveTo(bx - w * s * 0.2, y - h * s); c.lineTo(bx - w * s * 0.05, y); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1; c.stroke(); });
  },
  hut(c, x, y, s) {
    shadowAt(c, x, y, s * 0.6, 0.3);
    c.beginPath(); c.moveTo(x - s * 0.5, y); c.lineTo(x, y - s * 0.85); c.lineTo(x + s * 0.5, y); c.closePath(); c.fillStyle = lin(c, x - s * 0.5, 0, x + s * 0.5, 0, [[0, '#B9855A'], [1, '#6E4A32']]); c.fill();
    c.beginPath(); c.moveTo(x - s * 0.14, y); c.lineTo(x, y - s * 0.4); c.lineTo(x + s * 0.14, y); c.closePath(); c.fillStyle = '#2A1B14'; c.fill();
    c.strokeStyle = '#4A3322'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x - s * 0.08, y - s * 0.78); c.lineTo(x - s * 0.18, y - s * 1.0); c.moveTo(x + s * 0.08, y - s * 0.78); c.lineTo(x + s * 0.18, y - s * 1.0); c.stroke();
  },
  fire(c, x, y, s) {
    ellipse(c, x, y - s * 0.2, s * 0.8, s * 0.6, rad(c, x, y - s * 0.2, 1, s * 0.8, [[0, 'rgba(255,170,60,.55)'], [1, 'rgba(255,170,60,0)']]));
    c.strokeStyle = '#5B3B25'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - s * 0.3, y); c.lineTo(x + s * 0.3, y - 3); c.moveTo(x + s * 0.3, y); c.lineTo(x - s * 0.3, y - 3); c.stroke();
    c.beginPath(); c.moveTo(x - s * 0.18, y - 2); c.quadraticCurveTo(x - s * 0.22, y - s * 0.4, x, y - s * 0.7); c.quadraticCurveTo(x + s * 0.2, y - s * 0.4, x + s * 0.18, y - 2); c.closePath(); c.fillStyle = lin(c, x, y - s * 0.7, x, y, [[0, '#FFD65A'], [0.5, '#FF8E2E'], [1, '#E4442A']]); c.fill();
  }
};

// ---- island bitmaps ----------------------------------------------------------------------------
const distToTrail = (layout, isl, x, y) => { let d = 1e9; for (const n of isl.nodes) d = Math.min(d, Math.hypot(n.x - x, n.y - y)); for (const t of layout.trail) { if (Math.abs(t.p[1] - y) < 60) d = Math.min(d, Math.hypot(t.p[0] - x, t.p[1] - y)); } return d; };
export const insideIsland = (isl, x, y, m = 0) => isl.lobes.some((l) => ((x - l.x) / (l.rx - m)) ** 2 + ((y - l.y) / (l.ry - m)) ** 2 <= 1);

export function renderIsland(layout, isl, state, dpr, textureImg) {
  const pad = 40, bx = isl.box, bw = bx.x1 - bx.x0 + pad * 2, bh = bx.y1 - bx.y0 + CLIFF + pad * 2, ox = bx.x0 - pad, oy = bx.y0 - pad;
  const cv = document.createElement('canvas'); cv.width = Math.ceil(bw * dpr); cv.height = Math.ceil(bh * dpr);
  const c = cv.getContext('2d'); c.scale(dpr, dpr); c.translate(-ox, -oy);
  const era = ERAS[isl.index], L = LOOK[era.id], rnd = rng01(5000 + isl.index * 31), y0 = bx.y0, y1 = bx.y1, ih = y1 - y0, cxm = (bx.x0 + bx.x1) / 2, hw = (bx.x1 - bx.x0) / 2;
  // cliff: the island body under the grass, darker toward the bottom, with strata
  c.save(); lobesPath(c, isl.lobes, 0.97, 0, CLIFF); c.fillStyle = lin(c, 0, y0, 0, y1 + CLIFF, [[0, shade(L.rock, 0.1)], [1, shade(L.rock, -0.55)]]); c.fill(); c.clip();
  for (let i = 0; i < ih / 14; i++) { const y = y0 + i * 14 + rnd() * 6; c.strokeStyle = `rgba(0,0,0,${0.07 + rnd() * 0.08})`; c.lineWidth = 1 + rnd() * 2; c.beginPath(); c.moveTo(bx.x0, y); for (let x = bx.x0; x <= bx.x1; x += 24) c.lineTo(x, y + Math.sin(x * 0.07 + i) * 3); c.stroke(); }
  c.restore();
  // beach rim then grass top
  lobesPath(c, isl.lobes, 1.06); c.fillStyle = lin(c, 0, y0, 0, y1, [[0, shade(L.ground, 0.3)], [1, mix(L.ground, '#EAD7A0', 0.5)]]); c.fill();
  lobesPath(c, isl.lobes); c.fillStyle = rad(c, cxm - hw * 0.2, y0 + ih * 0.3, 10, hw * 1.6, [[0, shade(L.ground, 0.2)], [0.7, L.ground], [1, L.groundD]]); c.fill();
  c.save(); lobesPath(c, isl.lobes); c.clip();
  if (textureImg) {   // painted era background (its lower part: ground, plants) laid over the surface for hand-painted richness
    c.globalAlpha = 0.5; c.globalCompositeOperation = 'soft-light';
    const sw = textureImg.width, sh = textureImg.height * 0.3, sy = textureImg.height * 0.7, k = (hw * 2) / sw;
    for (let ty = y0; ty < y1; ty += sh * k) c.drawImage(textureImg, 0, sy, sw, sh, bx.x0, ty, sw * k, sh * k);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }
  for (let i = 0; i < 220; i++) { const x = bx.x0 + rnd() * hw * 2, y = y0 + rnd() * ih; c.fillStyle = rnd() > 0.5 ? rgba(shade(L.ground, 0.3), 0.35) : rgba(L.groundD, 0.3); c.fillRect(x, y, 2 + rnd() * 3, 1.5); }
  c.restore();
  // props placed away from the trail
  const placed = [], want = 14 + isl.nodes.length;
  for (let tries = 0, n = 0; tries < 400 && n < want; tries++) {
    const x = bx.x0 + rnd() * hw * 2, y = y0 + rnd() * ih;
    if (!insideIsland(isl, x, y, 12)) continue;
    if (distToTrail(layout, isl, x, y) < 26 || isl.fossils.some((f) => Math.abs(f.x - x) < f.w * 0.7 && Math.abs(f.y - y) < f.h * 0.9)) continue;
    if (placed.some((p) => Math.hypot(p[0] - x, p[1] - y) < 22)) continue;
    placed.push([x, y]); n++;
  }
  placed.sort((a, b) => a[1] - b[1]).forEach(([x, y], i) => {
    const kind = L.props[Math.floor(rnd() * L.props.length)], size = (kind === 'volcano' ? 52 : kind === 'mesa' ? 30 : kind === 'hut' ? 34 : 22 + rnd() * 14) * (0.85 + (y - y0) / ih * 0.35);
    c.save(); PROPS[kind](c, x, y, size, L, rnd); c.restore(); void i;
  });
  // fossils: finished = bone, being dug = partly unearthed, the rest = dark stone silhouette
  isl.fossils.forEach((f) => {
    const fo = FOSSILS.find((q) => q.id === f.id), done = state.completed.has(f.id), prog = state.progress[f.id] || 0;
    shadowAt(c, f.x, f.y + f.h * 0.45, f.w * 0.46, 0.3);
    c.save(); c.globalAlpha = done ? 1 : 0.96;
    const o = done ? { revealed: 10, look: 'bone', margin: 0.04 } : prog > 0 ? { revealed: prog, look: 'dig', margin: 0.04 } : { revealed: 0, look: 'stone', margin: 0.04 };
    if (!drawThumb(c, f.id, f.x - f.w / 2, f.y - f.h / 2, f.w, f.h, o)) drawFossilArt(c, fo.shape, f.x - f.w / 2, f.y - f.h / 2, f.w, f.h, o);   // thumbnail, else vector
    c.restore();
  });
  return { canvas: cv, ox, oy };
}

// ---- the painter -------------------------------------------------------------------------------
// Sky: pastel, lavender at the top of the world through blue to a warm pink at the bottom.
const SKY = [[0, '#B9A8E8'], [0.3, '#93B6F0'], [0.65, '#A4CDF3'], [1, '#EBCBE6']];
const skyAt = (f) => { f = clamp(f, 0, 1); for (let i = 1; i < SKY.length; i++) if (f <= SKY[i][0]) { const a = SKY[i - 1], b = SKY[i]; return mix(a[1], b[1], (f - a[0]) / (b[0] - a[0])); } return SKY.at(-1)[1]; };
const PUFFS = [[0, 0, 26], [-26, 7, 18], [24, 8, 20], [-8, -10, 18], [12, -8, 15], [-44, 12, 12], [42, 13, 12]];
const cloud = (c, x, y, s, a) => {
  c.fillStyle = `rgba(190,176,232,${a * 0.5})`; PUFFS.forEach(([dx, dy, r]) => { c.beginPath(); c.ellipse(x + dx * s, y + (dy + 7) * s, r * s, r * s * 0.6, 0, 0, Math.PI * 2); c.fill(); });
  c.fillStyle = `rgba(255,255,255,${a})`; PUFFS.forEach(([dx, dy, r]) => { c.beginPath(); c.ellipse(x + dx * s, y + dy * s, r * s, r * s * 0.62, 0, 0, Math.PI * 2); c.fill(); });
};
const mkCanvas = (w, h) => { const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w)); cv.height = Math.max(1, Math.ceil(h)); return cv; };

export function createMap(layout, { state, dpr = 1, reduced = () => false, world = false }) {
  const bitmaps = new Map(), greyArt = new Map(), rnd = rng01(42), states = nodeStates(layout, state.level);
  const curIdx = states.indexOf('current');
  // the picture rectangle of an island: its art, or the box of the code-drawn island
  const rectOf = (isl) => isl.art || { x: isl.box.x0 - 24, y: isl.box.y0 - 30, w: isl.box.x1 - isl.box.x0 + 48, h: isl.box.y1 - isl.box.y0 + CLIFF + 60 };
  // drifting clouds, behind and in front of each island (code drawn, they move sideways and wrap)
  const cloudsOf = layout.islands.map((isl, i) => {
    const r = rng01(900 + i * 13);
    const mk = (n, front) => Array.from({ length: n }, () => ({ u: r(), v: front ? 0.96 + r() * 0.16 : 0.55 + r() * 0.4, s: front ? 0.8 + r() * 0.6 : 0.7 + r() * 0.7, sp: 1.5 + r() * 2.5, a: front ? 0.9 : 0.7 }));
    return { back: mk(3, false), front: mk(3, true) };
  });
  // trail: glowing dots at an even spacing along the spline (island index pair + blend so they follow the island bob)
  // world map: the trail joins the island centres (no level nodes); the current island's index plays the role of the current node
  let trail = layout.trail, curIdx2 = curIdx;
  if (world) {
    const cen = layout.islands.map((q) => (q.art ? [q.art.x + q.art.w / 2, q.art.y + q.art.h * 0.5] : [q.cx, q.cy]));
    trail = [];
    for (let i = 1; i < cen.length; i++) for (let u = 0; u < 12; u++) { const f = u / 12, a = cen[i - 1], b = cen[i], bend = Math.sin(f * Math.PI) * (i % 2 ? 60 : -60); trail.push({ p: [a[0] + (b[0] - a[0]) * f + bend, a[1] + (b[1] - a[1]) * f], a: i - 1, b: i, u: f, seg: i - 1 }); }
    trail.push({ p: cen.at(-1), a: cen.length - 1, b: cen.length - 1, u: 0, seg: cen.length - 1 });
    curIdx2 = layout.islands.findIndex((q) => islandState(q, state.level) === 'current');
  }
  const dots = []; { let carry = 0; for (let i = 1; i < trail.length; i++) { const p = trail[i - 1], q = trail[i], d = Math.hypot(q.p[0] - p.p[0], q.p[1] - p.p[1]); let pos = 12 - carry;
    while (pos <= d) { const f = pos / d; dots.push({ x: p.p[0] + (q.p[0] - p.p[0]) * f, y: p.p[1] + (q.p[1] - p.p[1]) * f, a: p.a, b: p.b, u: p.u + (q.u - p.u) * f * (p.b === q.b ? 1 : 0), seg: p.seg, at: dots.length }); pos += 12; } carry = d - (pos - 12); } }
  const sprite = (() => {   // one glow dot, drawn many times
    const R = 9, cv = mkCanvas(R * 2 * dpr, R * 2 * dpr), c = cv.getContext('2d'); c.scale(dpr, dpr);
    c.fillStyle = rad(c, R, R, 0, R, [[0, 'rgba(255,236,150,.85)'], [0.35, 'rgba(255,214,110,.4)'], [1, 'rgba(255,200,90,0)']]); c.fillRect(0, 0, R * 2, R * 2);
    c.beginPath(); c.arc(R, R, 2.7, 0, Math.PI * 2); c.fillStyle = '#FFF6D2'; c.fill(); return { cv, R };
  })();
  let distant = [];
  const bobOf = (i, t) => (reduced() ? 0 : Math.sin(t * 0.9 + i * 1.3) * 2.2);

  const buildDistant = () => {
    distant = [];
    const have = [...layout.islands].filter((q) => q.art && artOf(q.era));
    const spots = [[8, 40, 190], [150, 92, 170], [236, 28, 150]];
    spots.forEach(([x, y, w], k) => {
      const src = have.length ? artOf(have[(k * 3 + 1) % have.length].era) : null;
      const h = src ? w * src.h / src.w : w * 0.55, cv = mkCanvas(w * dpr, h * dpr), c = cv.getContext('2d'); c.scale(dpr, dpr);
      if (src) { c.filter = 'blur(1.2px) saturate(.55) brightness(1.18)'; c.drawImage(src.img, 0, 0, w, h); c.filter = 'none'; }
      else {   // no pictures at all: a hazy floating rock
        c.fillStyle = 'rgba(150,165,190,.9)'; c.beginPath(); c.moveTo(w * 0.08, h * 0.45); c.quadraticCurveTo(w * 0.5, h * 0.22, w * 0.92, h * 0.45); c.quadraticCurveTo(w * 0.7, h * 0.95, w * 0.52, h); c.quadraticCurveTo(w * 0.3, h * 0.9, w * 0.08, h * 0.45); c.fill();
        c.fillStyle = 'rgba(176,196,170,.95)'; c.beginPath(); c.ellipse(w * 0.5, h * 0.44, w * 0.42, h * 0.16, 0, 0, Math.PI * 2); c.fill();
      }
      distant.push({ x, y, w, h, cv, k });
    });
  };
  const ensure = async () => { await thumbsReady(); bitmaps.clear(); greyArt.clear(); buildDistant(); };   // fossil thumbnails first: bitmaps are painted once
  const bitmapOf = (isl) => {
    if (!bitmaps.has(isl.index)) {
      const b = renderIsland(layout, isl, state, dpr, null);
      if (islandState(isl, state.level) === 'locked') {       // locked islands: greyed, calmer
        const g = mkCanvas(b.canvas.width, b.canvas.height), gc = g.getContext('2d');
        gc.filter = 'grayscale(0.8) brightness(0.82) contrast(0.95)'; gc.drawImage(b.canvas, 0, 0); gc.filter = 'none'; b.canvas = g;
      }
      bitmaps.set(isl.index, b);
    }
    return bitmaps.get(isl.index);
  };
  const artImage = (isl) => {
    const a = artOf(isl.era); if (!a) return null;
    if (islandState(isl, state.level) !== 'locked') return a.img;
    if (!greyArt.has(isl.index)) {
      const k = Math.min(1, 700 / a.w), g = mkCanvas(a.w * k, a.h * k), gc = g.getContext('2d');
      gc.filter = 'grayscale(0.85) brightness(0.78) contrast(0.92)'; gc.drawImage(a.img, 0, 0, g.width, g.height); gc.filter = 'none'; greyArt.set(isl.index, g);
    }
    return greyArt.get(isl.index);
  };
  const drawClouds = (c, isl, list, t, motion) => {
    const r = rectOf(isl), span = r.w + 200;
    list.forEach((cl, k) => { const x = r.x - 100 + ((cl.u * span + (motion ? t * cl.sp : 0)) % span), y = r.y + cl.v * r.h + (motion ? Math.sin(t * 0.4 + k + isl.index) * 2 : 0); cloud(c, x, y, cl.s, cl.a); });
  };

  function draw(c, scrollUnits, viewW, viewH, t) {
    const motion = !reduced(), y0 = scrollUnits, y1 = scrollUnits + viewH, H = layout.H;
    c.save(); c.setTransform(dpr * (viewW / W), 0, 0, dpr * (viewW / W), 0, 0);
    // sky
    c.fillStyle = lin(c, 0, 0, 0, viewH, [[0, skyAt(y0 / H)], [1, skyAt(y1 / H)]]); c.fillRect(0, 0, W + 2, viewH + 2);
    c.translate(0, -y0);
    // distant misty islands at the top of the world
    distant.forEach((d) => { const dy = d.y + (motion ? Math.sin(t * 0.35 + d.k * 2) * 3 : 0); if (dy + d.h < y0 || dy > y1) return; c.globalAlpha = 0.42; c.drawImage(d.cv, d.x, dy, d.w, d.h); c.globalAlpha = 1; });
    if (y0 < layout.topPad) { const g = lin(c, 0, 0, 0, layout.topPad + 40, [[0, 'rgba(232,226,252,.55)'], [1, 'rgba(232,226,252,0)']]); c.fillStyle = g; c.fillRect(0, 0, W, layout.topPad + 40); }
    // islands, far (top) to near (bottom): clouds behind, the island, clouds in front
    for (let i = layout.islands.length - 1; i >= 0; i--) {
      const isl = layout.islands[i], r = rectOf(isl);
      if (r.y + r.h + 120 < y0 || r.y - 120 > y1) continue;
      const bob = bobOf(i, t);
      drawClouds(c, isl, cloudsOf[i].back, t, motion);
      const img = isl.art ? artImage(isl) : null;
      if (img) { c.save(); c.translate(0, bob); c.drawImage(img, isl.art.x, isl.art.y, isl.art.w, isl.art.h); c.restore(); }
      else { const b = bitmapOf(isl); c.save(); c.translate(0, bob); c.drawImage(b.canvas, b.ox, b.oy, b.canvas.width / dpr, b.canvas.height / dpr); c.restore(); }
      if (islandState(isl, state.level) === 'locked') {   // fog over a locked island
        const bx = isl.box, mx = (bx.x0 + bx.x1) / 2, my = (bx.y0 + bx.y1) / 2, hw = (bx.x1 - bx.x0) / 2, hh = (bx.y1 - bx.y0) / 2;
        c.save(); c.translate(mx, my + bob); c.scale(hw * 1.35, hh * 1.3); c.fillStyle = rad(c, 0, 0, 0.05, 1, [[0, 'rgba(222,228,246,.4)'], [0.6, 'rgba(210,218,242,.26)'], [1, 'rgba(210,218,242,0)']]);
        c.beginPath(); c.arc(0, 0, 1, 0, Math.PI * 2); c.fill(); c.restore();
        for (let k = 0; k < 4; k++) { const px = mx + Math.sin(k * 2.3 + (motion ? t * 0.08 : 0) + isl.index) * hw * 0.8, py = bx.y0 + ((k + 0.5) / 4) * hh * 2 + bob; cloud(c, px, py, 0.9, 0.3); }
      }
      drawClouds(c, isl, cloudsOf[i].front, t, motion);
    }
    // the trail: glowing dots, brighter along the road already travelled and the next step, dim beyond
    for (const d of dots) {
      if (d.y < y0 - 20 || d.y > y1 + 20) continue;
      const locked = curIdx2 >= 0 && d.seg >= curIdx2 + (world ? 0 : 1), wave = motion ? 0.8 + 0.2 * Math.sin(t * 2.4 - d.at * 0.35) : 1;
      c.globalAlpha = (locked ? 0.4 : 1) * wave;
      c.drawImage(sprite.cv, d.x - sprite.R, d.y + bobOf(d.a, t) * (1 - d.u) + bobOf(d.b, t) * d.u - sprite.R, sprite.R * 2, sprite.R * 2);
    }
    c.globalAlpha = 1;
    c.restore();
  }
  return { draw, ensure, bobOf, invalidate: () => { bitmaps.clear(); greyArt.clear(); }, bitmaps };
}
export { PROPS, LOOK };
