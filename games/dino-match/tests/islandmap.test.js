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
