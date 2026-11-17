import { describe, it, expect } from 'vitest';
import { generateLevel } from '../src/core/level.js';
import { TOTAL_LEVELS } from '../src/core/eras.js';
import { TARGET_TYPES } from '../src/core/targets.js';
import { OBSTACLES } from '../src/core/obstacles.js';
import { GEM_COLORS } from '../src/render/gems.js';
import { OBJECTIVE_ART, ART_KINDS, objectiveArt, GOAL_VERB } from '../src/data/objectiveArt.js';

// Batch F: one shared objective icon. Every objective kind any level uses must map to real board art (no fallback glyph).
describe('objective icons', () => {
  it('every target type in the rules has an art mapping and a goal verb', () => {
    for (const t of Object.keys(TARGET_TYPES)) { expect(OBJECTIVE_ART[t], t).toBeTypeOf('function'); expect(GOAL_VERB[t], t).toBeTruthy(); }
  });
  it('every objective used in the 2350 levels maps to board art that exists', () => {
    const seen = new Set();
    for (let n = 1; n <= TOTAL_LEVELS; n++) {
      const c = generateLevel(n);
      for (const t of c.targets) {
        const a = objectiveArt({ ...t, blocks: c.blocks }); seen.add(t.type);
        expect(a, `level ${n} ${t.type}`).toBeTruthy();
        expect(ART_KINDS, `level ${n} ${t.type}`).toContain(a.kind);
        if (a.kind === 'gem') expect(GEM_COLORS[a.key], `level ${n} colour ${a.key}`).toBeTruthy();
        if (a.kind === 'obstacle') expect(OBSTACLES[a.key], `level ${n} obstacle ${a.key}`).toBeTruthy();
        if (a.kind === 'block') { expect(['tar', 'sand', 'stone']).toContain(a.key); if (c.blocks.length) expect(GEM_COLORS[a.badge], `level ${n} dig badge`).toBeTruthy(); }
      }
    }
    expect(seen.size).toBe(Object.keys(TARGET_TYPES).length);   // every kind is really used somewhere
  });
});
