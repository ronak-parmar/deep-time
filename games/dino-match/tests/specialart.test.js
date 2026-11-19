import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { SPECIAL_SLOTS, SHEET_ORDER, resolveSpecial, setSpecialUrls, specialArt, specialUrls, specialLoadTasks } from '../src/render/specialArt.js';
import { drawSpecialPiece } from '../src/render/specials.js';
import { KINDS } from '../src/core/specials.js';

const root = join(import.meta.dirname, '../../..');
const ctx = () => { const calls = []; const c = new Proxy({}, { get: (_, k) => (k === 'calls' ? calls : typeof k === 'string' && /^(globalAlpha|fillStyle|strokeStyle|lineWidth|lineJoin|lineCap|font|textAlign|textBaseline|globalCompositeOperation)$/.test(k) ? 1 : (...a) => { calls.push(k); return k.startsWith('create') ? { addColorStop() {} } : undefined; }), set: () => true }); return c; };

describe('special pieces art slots (M10)', () => {
  it('names a slot for every special, in the sheet order the tool uses', () => {
    expect(SHEET_ORDER).toEqual(['firecracker-h', 'firecracker-v', 'bomb', 'dynamite', 'tnt', 'rainbow']);
    for (const k of KINDS) expect(Object.values(SPECIAL_SLOTS).some((s) => s.kind === k), k).toBe(true);
    for (const n of SHEET_ORDER) expect(SPECIAL_SLOTS[n]).toBeTruthy();
    expect(SPECIAL_SLOTS.firecracker.optional).toBe(true);
  });
  it('the owner art is in place: art/specials/<slot>.webp for all six sheet slots', () => {
    for (const n of SHEET_ORDER) expect(existsSync(join(root, 'art/specials', n + '.webp')), n).toBe(true);
    expect(Object.keys(specialUrls()).sort()).toEqual([...SHEET_ORDER].sort());
    expect(specialLoadTasks()).toHaveLength(6);
  });
  it('resolves firecracker pictures for both axes, with the single picture or one axis turned 90 degrees', () => {
    const has = (set) => (s) => set.includes(s);
    expect(resolveSpecial('firecracker', 'h', has(['firecracker-h', 'firecracker-v']))).toMatchObject({ slot: 'firecracker-h', rot: 0 });
    expect(resolveSpecial('firecracker', 'v', has(['firecracker-h', 'firecracker-v']))).toMatchObject({ slot: 'firecracker-v', rot: 0 });
    expect(resolveSpecial('firecracker', 'v', has(['firecracker']))).toMatchObject({ slot: 'firecracker', rot: Math.PI / 2 });
    expect(resolveSpecial('firecracker', 'v', has(['firecracker-h']))).toMatchObject({ slot: 'firecracker-h', rot: Math.PI / 2 });
    expect(resolveSpecial('firecracker', 'h', has(['firecracker-v']))).toMatchObject({ slot: 'firecracker-v', rot: -Math.PI / 2 });
    for (const k of ['bomb', 'dynamite', 'tnt', 'rainbow']) expect(resolveSpecial(k, 'h', has([k]))).toMatchObject({ slot: k, mode: 'replace' });
  });
  it('a missing picture falls back to the code-drawn special (and nothing throws)', () => {
    for (const k of KINDS) expect(resolveSpecial(k, 'h', () => false), k).toBe(null);
    setSpecialUrls({});
    for (const k of KINDS) {
      expect(specialArt(k, 'h')).toBe(null);
      const c = ctx(); let gem = 0;
      expect(drawSpecialPiece(c, { k, o: 'h', c: 0 }, 20, 0, true, () => { gem++; })).toBe('code');
      expect(gem, k).toBe(k === 'rainbow' ? 0 : 1);                         // the code look draws the gem under the overlay (not for rainbow)
    }
    const c = ctx(); let gem = 0; expect(drawSpecialPiece(c, { c: 2 }, 20, 0, true, () => { gem++; })).toBe('gem'); expect(gem).toBe(1);
  });
  it('tools/prep-specials-sheet.py on synthetic sheets: cut, alpha, 256 px squares, order, grid, loud failure on a wrong count', () => {
    const r = spawnSync('python3', [join(root, 'tools/prep-specials-selftest.py')], { encoding: 'utf8' });
    if (/No module named/.test(r.stderr)) return;   // pillow/numpy/scipy not installed here: skip
    expect(r.stdout + r.stderr).toContain('selftest ok'); expect(r.status).toBe(0);
  }, 90000);
});
