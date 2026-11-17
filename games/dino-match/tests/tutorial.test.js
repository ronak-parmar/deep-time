import { describe, it, expect } from 'vitest';
import { TUTORIAL, TUTORIAL_LEVELS, tutorialMove, needsTutorial, markTutorialSeen, skipTutorial, normaliseTutorial, freshTutorial, wantColours } from '../src/core/tutorial.js';
import { newProfile, migrateProfile } from '../src/core/profile.js';
import { generateLevel } from '../src/core/level.js';
import { createState, swap } from '../src/core/game.js';
import { findMatches } from '../src/core/board.js';
import { targetProgress, targetLabel } from '../src/core/targets.js';

describe('tutorial levels 1 to 6: fixed boards', () => {
  it('has one tutorial per level 1 to 6', () => { expect(TUTORIAL_LEVELS).toEqual([1, 2, 3, 4, 5, 6]); for (const n of TUTORIAL_LEVELS) expect(TUTORIAL[n].steps.length).toBeGreaterThan(0); });
  it('the starting board is the same every time (fixed seed) and has no match', () => {
    for (const n of TUTORIAL_LEVELS) {
      const a = createState(generateLevel(n)), b = createState(generateLevel(n));
      expect(a.cells.map((p) => p.c), 'level ' + n).toEqual(b.cells.map((p) => p.c));
      expect(findMatches(a.cells, a.w, a.h)).toEqual([]);
    }
  });
  it('the start layout always holds a valid move of the wanted colour with the wanted size', () => {
    for (const n of TUTORIAL_LEVELS) {
      const s = createState(generateLevel(n)), mv = tutorialMove(s, TUTORIAL[n].want);
      expect(mv, 'level ' + n).toBeTruthy();
      const r = swap(s, mv[0], mv[1]); expect(r.valid).toBe(true);
      const cleared = r.events.find((e) => e.t === 'clear'); expect(cleared.cells.some((c) => wantColours(createState(generateLevel(n))).includes(c.c))).toBe(true);
    }
  });
  it('level 5 shows a straight 4-match (firecracker) and creates the special', () => {
    const s = createState(generateLevel(5)), mv = tutorialMove(s, TUTORIAL[5].want);
    const r = swap(s, mv[0], mv[1]); expect(r.events.some((e) => e.t === 'create' && e.s === 'firecracker')).toBe(true);
  });
  it('levels 1 to 5 are collect-only with no plaque; level 6 introduces the plaque with its tip', () => {
    for (let n = 1; n <= 5; n++) { const l = generateLevel(n), s = createState(l); expect(s.hasDig).toBe(false); expect(s.blocks).toEqual([]); expect(l.targets.every((t) => t.type === 'collect')).toBe(true); }
    const l6 = generateLevel(6); expect(createState(l6).hasDig).toBe(true); expect(l6.tip).toBe('Match the colours shown on the blocks to dig.');
    expect(TUTORIAL[6].steps[0]).toMatchObject({ spot: 'plaque', text: 'Match the colours shown on the blocks to dig.' });
  });
  it('the Target panel reads "Break N colour gems" with counts that follow the clears', () => {
    const s = createState(generateLevel(1)); expect(targetLabel(targetProgress(s)[0])).toBe('Break 10 red gems');
    const mv = tutorialMove(s, TUTORIAL[1].want); swap(s, mv[0], mv[1]); expect(targetProgress(s)[0].got).toBeGreaterThanOrEqual(3);
  });
  it('a collect-only level is won when the targets are done and shows no fossil: hasDig is false', () => {
    const s = createState(generateLevel(1)); s.targets[0].got = s.targets[0].n; s.status = 'playing';
    const mv = tutorialMove(createState(generateLevel(1)), TUTORIAL[1].want); const s2 = createState(generateLevel(1)); s2.targets[0].got = 9; swap(s2, mv[0], mv[1]);
    expect(s2.status).toBe('won'); expect(s2.hasDig).toBe(false);
  });
});

describe('tutorial persistence (profile.tutorial)', () => {
  it('a new profile has a fresh tutorial and every tutorial level needs it', () => {
    const p = newProfile(); expect(p.tutorial).toEqual(freshTutorial());
    for (const n of TUTORIAL_LEVELS) expect(needsTutorial(p, n)).toBe(true);
    expect(needsTutorial(p, 7)).toBe(false);
  });
  it('is shown once per level: marking a level seen stops it, the others still show', () => {
    let p = markTutorialSeen(newProfile(), 1); expect(needsTutorial(p, 1)).toBe(false); expect(needsTutorial(p, 2)).toBe(true);
    p = markTutorialSeen(p, 1); expect(p.tutorial.seen).toEqual([1]);
  });
  it('skip turns the whole tutorial off and stays off', () => {
    const p = skipTutorial(markTutorialSeen(newProfile(), 1));
    for (const n of TUTORIAL_LEVELS) expect(needsTutorial(p, n)).toBe(false);
    expect(p.tutorial.off).toBe(true);
  });
  it('survives a save round trip and old saves without the field migrate to a fresh tutorial', () => {
    const p = markTutorialSeen(newProfile(), 3);
    expect(migrateProfile(JSON.parse(JSON.stringify(p))).tutorial).toEqual({ seen: [3], off: false });
    const old = { ...newProfile() }; delete old.tutorial; expect(migrateProfile(old).tutorial).toEqual(freshTutorial());
    expect(migrateProfile({ ...newProfile(), tutorial: 'garbage' }).tutorial).toEqual(freshTutorial());
    expect(normaliseTutorial({ seen: [3, 99, 'x', 3], off: 1 })).toEqual({ seen: [3], off: true });
  });
  it('a level that was already won never shows the tutorial again', () => {
    const p = { ...newProfile(), stars: { 2: 3 } }; expect(needsTutorial(p, 2)).toBe(false);
  });
});
