import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROSTER } from '../src/data/roster.js';
import { ERAS } from '../src/core/eras.js';

const tools = join(import.meta.dirname, '../../../tools');
describe('tools/prep-sheet.py (docs/15)', () => {
  const ids = JSON.parse(readFileSync(join(tools, 'roster-ids.json'), 'utf8'));
  it('maps sheets onto the roster and the era ids in game order', () => {
    expect(ids.fossils).toEqual(ROSTER.map((f) => f.id)); expect(ids.islands).toEqual(ERAS.map((e) => e.id));
    expect(Math.ceil(ids.fossils.length / 6)).toBe(8); expect(ids.fossils.length - 42).toBe(5);
  });
  it('self test: synthetic sheets are cut, ordered and named; a wrong cell count fails loudly; small and missing sheets are flagged', () => {
    const r = spawnSync('python3', [join(tools, 'prep-sheet-selftest.py')], { encoding: 'utf8' });
    if (/No module named/.test(r.stderr)) return;   // pillow/numpy/scipy not installed here: skip
    expect(r.stdout + r.stderr).toContain('selftest ok'); expect(r.status).toBe(0);
  }, 60000);
});
