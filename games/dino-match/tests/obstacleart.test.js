import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { OBSTACLE_SHEET, OBSTACLE_SLOTS, obstacleSlot, digSlot } from '../src/render/obstacleArt.js';
import { OBSTACLES } from '../src/core/obstacles.js';

const tools = join(import.meta.dirname, '../../../tools');
const has = (list) => (s) => list.includes(s);

describe('painted obstacle slots (docs/18)', () => {
  it('has one picture per damage stage of every obstacle, the artefact and the dig blocks, 20 in a 5 x 4 sheet', () => {
    expect(OBSTACLE_SLOTS).toHaveLength(20); expect(new Set(OBSTACLE_SLOTS).size).toBe(20);
    for (const [k, d] of Object.entries(OBSTACLES)) {
      if (d.hp === Infinity || d.hp === 1) expect(OBSTACLE_SLOTS).toContain(k);
      else for (let hp = 1; hp <= d.hp; hp++) expect(OBSTACLE_SLOTS).toContain(`${k}-${hp}`);
    }
    for (const s of ['artefact', 'dig-tar', 'dig-sand-2', 'dig-sand-1', 'dig-stone-3', 'dig-stone-2', 'dig-stone-1']) expect(OBSTACLE_SLOTS).toContain(s);
    for (const [, note] of OBSTACLE_SHEET) expect(note.length).toBeGreaterThan(5);
  });
  it('picks the stage picture, else the plain one, else the nearest stage; null = code-drawn fallback', () => {
    const all = has(OBSTACLE_SLOTS);
    expect(obstacleSlot('sandstone', 2, 2, all)).toBe('sandstone-2');
    expect(obstacleSlot('sandstone', 1, 2, all)).toBe('sandstone-1');
    expect(obstacleSlot('sandstone', 0, 2, all)).toBe('sandstone-1');      // breaking: the last stage
    expect(obstacleSlot('lava', 3, 3, all)).toBe('lava-3');
    expect(obstacleSlot('rock', Infinity, Infinity, all)).toBe('rock');
    expect(obstacleSlot('tar', 1, 1, all)).toBe('tar');
    expect(obstacleSlot('lava', 2, 3, has(['lava-1', 'lava-3']))).toBe('lava-1');   // more damaged first
    expect(obstacleSlot('vine', 2, 2, has(['vine']))).toBe('vine');
    expect(obstacleSlot('crate', 1, 1, has([]))).toBe(null);
    expect(digSlot('stone', 2, 3, all)).toBe('dig-stone-2');
    expect(digSlot('tar', 1, 1, all)).toBe('dig-tar');
    expect(digSlot('sand', 2, 2, has([]))).toBe(null);
  });
  it('tools/prep-obstacles-sheet.py self test: a synthetic sheet is cut in order; an empty cell or touching items fail loudly', () => {
    const r = spawnSync('python3', [join(tools, 'prep-obstacles-selftest.py')], { encoding: 'utf8' });
    if (/No module named/.test(r.stderr)) return;   // pillow/numpy/scipy not installed here: skip
    expect(r.stdout + r.stderr).toContain('selftest ok'); expect(r.status).toBe(0);
  }, 60000);
});
