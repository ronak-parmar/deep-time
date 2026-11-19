import { describe, it, expect } from 'vitest';
import { buildLayout, nodeStates, islandState, insideIsland, NODES_PER_FOSSIL, NODE_STEP } from '../src/render/islandmap.js';
import { ERAS, TOTAL_LEVELS } from '../src/core/eras.js';

const L = buildLayout();
describe('island map layout', () => {
  it('has ten islands, Cambrian at the bottom and Early humans at the top, without overlap', () => {
    expect(L.islands.length).toBe(10);
    for (let i = 1; i < 10; i++) expect(L.islands[i].box.y1).toBeLessThan(L.islands[i - 1].box.y0);
    expect(L.islands[0].era).toBe('cambrian'); expect(L.islands[9].era).toBe('early-humans');
  });
  it('has one node per 25 levels, in level order, bottom to top', () => {
    expect(L.nodes.length).toBe(ERAS.reduce((n, e) => n + e.fossils.length * NODES_PER_FOSSIL, 0));
    for (let i = 1; i < L.nodes.length; i++) { expect(L.nodes[i].level - L.nodes[i - 1].level).toBe(NODE_STEP); expect(L.nodes[i].y).toBeLessThan(L.nodes[i - 1].y); }
    expect(L.nodes.at(-1).level + NODE_STEP - 1).toBe(TOTAL_LEVELS);
  });
  it('keeps every node on its island, inside the phone width, and tappable (no two closer than 36 units)', () => {
    for (const n of L.nodes) { expect(insideIsland(L.islands[n.island], n.x, n.y)).toBe(true); expect(n.x).toBeGreaterThan(24); expect(n.x).toBeLessThan(336); }
    for (let i = 0; i < L.nodes.length; i++) for (let j = i + 1; j < L.nodes.length; j++) expect(Math.hypot(L.nodes[i].x - L.nodes[j].x, L.nodes[i].y - L.nodes[j].y)).toBeGreaterThan(36);
  });
  it('marks done, current and locked nodes and islands from the level', () => {
    const st = nodeStates(L, 60);
    expect(st[0]).toBe('done'); expect(st[1]).toBe('done'); expect(st[2]).toBe('current'); expect(st[3]).toBe('locked');
    expect(islandState(L.islands[0], 60)).toBe('current'); expect(islandState(L.islands[1], 60)).toBe('locked');
    expect(islandState(L.islands[0], ERAS[0].end + 1)).toBe('done');
  });
});

describe('island map with island pictures', () => {
  const art = new Map(ERAS.map((e) => [e.id, { w: 900, h: 1010 }]));   // the real pictures are ~900 x 950-1060 (tools/prep-islands.py)
  const A = buildLayout(art);
  it('stacks the pictures with the nearest island at the bottom and no ground overlap', () => {
    expect(A.islands).toHaveLength(10);
    for (let i = 1; i < 10; i++) expect(A.islands[i].box.y1).toBeLessThan(A.islands[i - 1].box.y0);
    for (const isl of A.islands) { expect(isl.art.w).toBeGreaterThanOrEqual(280); expect(isl.art.x).toBeGreaterThanOrEqual(0); expect(isl.art.x + isl.art.w).toBeLessThanOrEqual(360); expect(isl.art.y).toBeGreaterThanOrEqual(0); }
    expect(A.islands[0].art.y + A.islands[0].art.h).toBeLessThan(A.H);
  });
  it('puts every node on the ground of its picture, in order, with room between them', () => {
    expect(A.nodes).toHaveLength(L.nodes.length);
    A.nodes.forEach((n, i) => { expect(n.level).toBe(L.nodes[i].level); expect(insideIsland(A.islands[n.island], n.x, n.y)).toBe(true); expect(n.x).toBeGreaterThan(20); expect(n.x).toBeLessThan(340); });
    for (const isl of A.islands) expect(isl.minGap).toBeGreaterThan(26);
    // the trail climbs each island: it may dip a little along the front edge or the back (perspective), never much, and ends well above its start
    for (let i = 1; i < A.nodes.length; i++) if (A.nodes[i].island === A.nodes[i - 1].island) expect(A.nodes[i].y <= A.nodes[i - 1].y + 22).toBe(true);
    for (const isl of A.islands) expect(isl.nodes.at(-1).y).toBeLessThan(isl.nodes[0].y - 0.15 * isl.h);
  });
  it('puts the era card on the front edge under the fossil pin, inside the picture and clear of the island above', () => {
    for (const isl of A.islands) {
      expect(isl.card.y).toBeGreaterThan(isl.pin.y + 40); expect(isl.pin.y).toBeGreaterThan(isl.art.y + isl.art.h * 0.3);
      expect(isl.card.y).toBeLessThan(isl.art.y + isl.art.h * 0.8);
    }
    for (let i = 1; i < 10; i++) expect(A.islands[i].art.y + A.islands[i].art.h).toBeLessThan(A.islands[i - 1].card.y - 24);
  });
  it('mixes picture islands with code-drawn ones', () => {
    const M = buildLayout(new Map([['jurassic', { w: 800, h: 600 }]]));
    expect(M.islands.filter((q) => q.art)).toHaveLength(1);
    expect(M.islands.every((q) => q.nodes.length === q.nodes.length && q.plaque)).toBe(true);
    M.nodes.forEach((n) => expect(insideIsland(M.islands[n.island], n.x, n.y)).toBe(true));
  });
  it('is the same layout as before when there is no art', () => { expect(buildLayout(new Map()).H).toBe(L.H); });
});
