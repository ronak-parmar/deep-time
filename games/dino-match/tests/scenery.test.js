import { describe, it, expect } from 'vitest';
import { THEMES, eraIds } from '../src/render/eraTheme.js';
import { ELEMENTS } from '../src/render/scenery.js';
import { luminance } from '../src/render/util.js';

describe('era scenery', () => {
  it('every era has its own scenery list using known element types', () => {
    for (const id of eraIds()) { const list = THEMES[id].scenery; expect(list?.length, id).toBeGreaterThanOrEqual(3); for (const el of list) { expect(ELEMENTS[el.type], `${id}:${el.type}`).toBeTruthy(); expect(ELEMENTS[el.type].still || ELEMENTS[el.type].live).toBeTruthy(); } }
  });
  it('no two eras share a scenery element', () => {
    const seen = new Map();
    for (const id of eraIds()) for (const el of THEMES[id].scenery) { expect(seen.has(el.type), `${el.type} used by ${seen.get(el.type)} and ${id}`).toBe(false); seen.set(el.type, id); }
  });
  it('no scenery element type is unused or shared with the old fern fronds', () => {
    const used = new Set(eraIds().flatMap((id) => THEMES[id].scenery.map((e) => e.type)));
    for (const k of Object.keys(ELEMENTS)) expect(used.has(k), k).toBe(true);
    expect(ELEMENTS.frond).toBeUndefined();
  });
  it('elements stay low contrast: faint, or a dark silhouette', () => {
    for (const id of eraIds()) for (const el of THEMES[id].scenery) { expect(el.alpha, `${id}:${el.type}`).toBeLessThanOrEqual(0.9); if (el.alpha > 0.4) expect(luminance(el.color), `${id}:${el.type}`).toBeLessThan(0.1); }
  });
});
