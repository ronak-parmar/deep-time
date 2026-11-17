import { describe, it, expect } from 'vitest';
import { ERAS, TOTAL_LEVELS } from '../src/core/eras.js';
import { eraLevels, eraStats, levelState, bestStars, eraUnlocked, fossilBlockOf } from '../src/core/journey.js';
import { islandPath, visibleRange } from '../src/render/islandpath.js';
import { newProfile, migrateProfile } from '../src/core/profile.js';

describe('level numbering on the island screens', () => {
  it('every era numbers its levels continuously, no gaps or duplicates, 2350 in all', () => {
    const seen = [];
    for (const e of ERAS) {
      const p = islandPath(e), lv = p.nodes.map((n) => n.level);
      expect(lv).toEqual(eraLevels(e));
      expect(lv[0]).toBe(e.start); expect(lv.at(-1)).toBe(e.end);
      for (let i = 1; i < lv.length; i++) expect(lv[i]).toBe(lv[i - 1] + 1);
      for (let i = 1; i < p.nodes.length; i++) expect(p.nodes[i].y).toBeLessThan(p.nodes[i - 1].y);   // climbs upward
      seen.push(...lv);
    }
    expect(seen.length).toBe(TOTAL_LEVELS); expect(TOTAL_LEVELS).toBe(2350);
    expect(new Set(seen).size).toBe(TOTAL_LEVELS); expect(seen[0]).toBe(1); expect(seen.at(-1)).toBe(2350);
  });
  it('one fossil milestone per 50 levels, naming the fossil that block digs up', () => {
    for (const e of ERAS) {
      const p = islandPath(e);
      expect(p.milestones.map((m) => m.fossil)).toEqual(e.fossils);
      p.milestones.forEach((m, b) => { expect(m.after).toBe(e.start + b * 50 + 49); expect(fossilBlockOf(e, m.after).fossil).toBe(m.fossil); });
    }
  });
  it('nodes stay on screen and apart; the visible range finds exactly the nodes in view', () => {
    const p = islandPath(ERAS[6]);
    for (const n of p.nodes) { expect(n.x).toBeGreaterThan(30); expect(n.x).toBeLessThan(330); }
    const [a, b] = visibleRange(p, 1000, 1700);
    const want = p.nodes.filter((n) => n.y >= 1000 && n.y <= 1700).map((n) => n.i);
    expect(p.nodes.slice(a, b).map((n) => n.i)).toEqual(want);
  });
});

describe('stars and unlock rules', () => {
  const prof = (level, stars = {}, done = []) => ({ ...newProfile(), level, stars, completedFossils: done });
  it('island totals add up the best stars of each level', () => {
    const p = prof(5, { 1: 3, 2: 1, 3: 2, 4: 0 }), s = eraStats(p, ERAS[0]);
    expect(s.won).toBe(4); expect(s.stars).toBe(6); expect(s.maxStars).toBe(ERAS[0].levels * 3); expect(s.state).toBe('current');
    expect(bestStars(p, 1)).toBe(3); expect(bestStars(p, 9)).toBe(0);
  });
  it('a level is done once won, current when it is the next one, locked beyond it', () => {
    const p = prof(5, { 1: 3, 2: 1, 3: 2, 4: 1 });
    expect(['done', 'done', 'done', 'done', 'current', 'locked'].map((x, i) => levelState(p, i + 1))).toEqual(['done', 'done', 'done', 'done', 'current', 'locked']);
  });
  it('an era unlocks when the player reaches its first level; every era is open in a later cycle', () => {
    expect(eraUnlocked(prof(150), ERAS[1])).toBe(false);
    expect(eraUnlocked(prof(151), ERAS[1])).toBe(true);
    expect(eraStats(prof(151), ERAS[2]).state).toBe('locked');
    expect(eraStats(prof(151), ERAS[2]).unlockAt).toBe(ERAS[2].start);
    expect(ERAS.every((e) => eraUnlocked(prof(TOTAL_LEVELS + 3), e))).toBe(true);
  });
  it('old saves keep their progress: missing stars become 1 star per passed level, bad values are cleaned', () => {
    const a = migrateProfile({ v: 2, level: 4 });
    expect(a.stars).toEqual({ 1: 1, 2: 1, 3: 1 });
    const b = migrateProfile({ v: 3, level: 9, stars: { 1: 5, 2: -1, x: 2, 3: 2.4 } });
    expect(b.stars).toEqual({ 1: 3, 2: 0, 3: 2 });
  });
});
