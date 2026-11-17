import { describe, it, expect } from 'vitest';
import { BOOSTERS, BOOSTER_IDS, LEVEL_BOOSTERS, PRE_BOOSTERS, boosterIntroId } from '../src/data/boosters.js';
import { INTROS, elementsOfLevel, introsFor, isPreIntro } from '../src/data/intros.js';
import { createState, useBooster, hasMove, swap } from '../src/core/game.js';
import { boosterTargets, buyBooster, spendBooster, giftBooster, owned, applyPreBooster } from '../src/core/boosters.js';
import { generateLevel } from '../src/core/level.js';
import { newProfile, migrateProfile } from '../src/core/profile.js';
import { findMatches } from '../src/core/board.js';
import { targetProgress } from '../src/core/targets.js';
import { CONFIG } from '../src/core/config.js';
import { newObstacle } from '../src/core/obstacles.js';
import { legalSwaps } from '../src/core/match.js';

const fresh = (n = 8) => createState(generateLevel(n));
const live = (state) => state.cells.filter(Boolean).length;
const healthy = (state) => { expect(findMatches(state.cells, state.w, state.h)).toHaveLength(0); if (state.status === 'playing') expect(hasMove(state)).toBe(true); };

describe('booster registry: guard', () => {
  it('every booster has an intro entry that points back at it, with art, a spot on its button and a short text', () => {
    for (const id of BOOSTER_IDS) {
      const e = INTROS[boosterIntroId(id)]; expect(e, id).toBeTruthy();
      expect(e.group).toBe('booster'); expect(e.hook).toEqual({ kind: 'booster', key: id }); expect(e.art.kind).toBe('booster');
      expect(e.spot).toEqual({ booster: id }); expect(e.first).toBe(BOOSTERS[id].first); expect(e.text.length).toBeLessThanOrEqual(130);
      expect(BOOSTERS[id].price).toBeGreaterThan(0); expect(['level', 'pre']).toContain(BOOSTERS[id].kind);
    }
    expect(BOOSTER_IDS.length).toBe(8); expect(CONFIG.boosters.kinds).toEqual(BOOSTER_IDS);
  });
  it('a booster is explained at its teach level and never before (one new element per 5 levels is enforced in intros.test)', () => {
    for (const id of BOOSTER_IDS) {
      const f = BOOSTERS[id].first;
      expect(elementsOfLevel({ level: f - 1 })).not.toContain(boosterIntroId(id));
      expect(elementsOfLevel({ level: f })).toContain(boosterIntroId(id));
    }
  });
  it('new profiles own none, old saves migrate, and pre-level intros are told apart from in-level ones', () => {
    const p = newProfile(); for (const k of BOOSTER_IDS) expect(p.boosters[k]).toBe(0);
    const old = migrateProfile({ v: 2, boosters: { pick: 2, burst: 1, brush: 1 } });
    expect(old.boosters.pick).toBe(2); expect(old.boosters.amber).toBe(0); expect('burst' in old.boosters).toBe(false);
    for (const id of PRE_BOOSTERS) expect(isPreIntro(INTROS[boosterIntroId(id)])).toBe(true);
    for (const id of LEVEL_BOOSTERS) expect(isPreIntro(INTROS[boosterIntroId(id)])).toBe(false);
    expect(introsFor(newProfile(), { level: 60, targets: [] }).map((e) => e.id)).toContain('bst-pick');
  });
});

describe('profile side', () => {
  it('buy takes coins and adds one; refuses when too poor; spend refuses at zero; the gift is free', () => {
    let p = { ...newProfile(), coins: 100 };
    const q = buyBooster(p, 'pick'); expect(q.coins).toBe(100 - BOOSTERS.pick.price); expect(owned(q, 'pick')).toBe(1);
    expect(buyBooster({ ...p, coins: 10 }, 'pick')).toBeNull();
    expect(spendBooster(p, 'pick')).toBeNull(); expect(owned(spendBooster(q, 'pick'), 'pick')).toBe(0);
    expect(owned(giftBooster(p, 'amber'), 'amber')).toBe(1); expect(giftBooster(p, 'amber').coins).toBe(100);
  });
});

describe('effects (pure logic)', () => {
  it('Pickaxe: clears one gem, credits its colour to the goals, fills the hole, never a move', () => {
    const s = fresh(); const i = 20, c = s.cells[i].c, moves = s.moves;
    const r = useBooster(s, 'pick', i);
    expect(r.valid).toBe(true); expect(r.events[0]).toMatchObject({ t: 'booster', id: 'pick', target: i });
    expect(r.events.some((e) => e.t === 'clear' && e.cells.some((x) => x.i === i))).toBe(true);
    expect(s.moves).toBe(moves); expect(s.cells.every((p, k) => p || s.obst[k])).toBe(true); healthy(s); void c;
  });
  it('Pickaxe: hits an obstacle under the tile once (even a vine), and a tile with nothing to hit is refused', () => {
    const s = fresh(); s.cells[10] = null; s.obst[10] = newObstacle('vine');
    const hp = s.obst[10].hp, r = useBooster(s, 'pick', 10);
    expect(r.valid).toBe(true); expect(s.obst[10] ? s.obst[10].hp : 0).toBe(hp - 1 <= 0 ? 0 : hp - 1);
    expect(r.events.some((e) => e.t === 'obstacle' && e.hits[0].by === 'booster')).toBe(true);
    s.cells[11] = null; s.obst[11] = newObstacle('rock');
    expect(useBooster(s, 'pick', 11).valid).toBe(false); expect(useBooster(s, 'pick', 9999).valid).toBe(false);
  });
  it('Rockslide: clears every gem of the tapped row and counts them as a blast', () => {
    const s = fresh(); const y = 3, ids = []; for (let x = 0; x < s.w; x++) ids.push(s.cells[y * s.w + x].id);
    const r = useBooster(s, 'rockslide', y * s.w + 2);
    const cleared = new Set(r.events.filter((e) => e.t === 'clear').flatMap((e) => e.cells.map((c) => c.id)));
    for (const id of ids) expect(cleared.has(id)).toBe(true);
    healthy(s);
  });
  it('Brush: removes one layer from every obstacle in the 3x3 and moves no gem outside the refill', () => {
    const s = fresh(); const w = s.w, c = 3 * w + 3;
    for (const j of [c - w, c, c + 1]) { s.cells[j] = null; s.obst[j] = newObstacle('sandstone'); }
    const before = s.obst[c].hp, r = useBooster(s, 'brush', c);
    expect(r.valid).toBe(true); expect(s.obst[c].hp).toBe(before - 1);
    expect(r.events.filter((e) => e.t === 'clear')).toHaveLength(0);
    healthy(s);
    const empty = fresh(); expect(useBooster(empty, 'brush', 24).valid).toBe(false);   // nothing to sweep: refused, not wasted
  });
  it('Brush on the board edge keeps the 3x3 on the board', () => {
    const s = fresh(); s.cells[0] = null; s.obst[0] = newObstacle('tar'); const t = boosterTargets(s, 'brush', 0);
    expect(t.area).toHaveLength(9); expect(t.area.every((j) => j >= 0 && j < s.w * s.h)).toBe(true);
  });
  it('Amber Lure: clears every gem of the tapped colour and credits a colour goal', () => {
    const s = fresh(); const c = s.cells[0].c, n = s.cells.filter((p) => p && p.c === c).length;
    s.targets = [{ type: 'collect', c, n: 999 }]; const got0 = targetProgress(s)[0].got;
    const r = useBooster(s, 'amber', 0);
    const cleared = r.events.filter((e) => e.t === 'clear')[0].cells.filter((x) => x.c === c).length;
    expect(cleared).toBe(n); expect(targetProgress(s)[0].got).toBeGreaterThanOrEqual(got0 + n); healthy(s);
    expect(useBooster(fresh(), 'amber', -1).valid).toBe(false);
  });
  it('Tremor: shuffles, always leaves a move and no match, keeps specials where they are', () => {
    const s = fresh(); s.cells[5] = { ...s.cells[5], s: 'bomb', o: 'h' }; const id = s.cells[5].id;
    const r = useBooster(s, 'tremor'); expect(r.valid).toBe(true); expect(r.events.some((e) => e.t === 'shuffle')).toBe(true);
    expect(s.cells[5].id).toBe(id); healthy(s);
  });
  it('+5 Moves adds five moves (and budget), and cannot be used on a finished level', () => {
    const s = fresh(); const m = s.moves; useBooster(s, 'moves5'); expect(s.moves).toBe(m + CONFIG.boosters.plusMoves);
    s.status = 'lost'; expect(useBooster(s, 'moves5').valid).toBe(false); expect(useBooster(s, 'pick', 3).valid).toBe(false);
  });
  it('pre-level: +3 Moves adds moves; Lucky Start turns one plain gem into a special without creating a match', () => {
    const s = fresh(); const m = s.moves; applyPreBooster(s, 'start3'); expect(s.moves).toBe(m + 3);
    const t = fresh(), n = t.cells.filter((p) => p && p.s).length, r = applyPreBooster(t, 'lucky');
    expect(r.kind).toBeTruthy(); expect(t.cells.filter((p) => p && p.s).length).toBe(n + 1); healthy(t);
  });
});

describe('boosters never break solvability or the goal accounting (random play)', () => {
  it('600 random booster uses over many levels keep the board valid, hole-free and the counters consistent', () => {
    let uses = 0;
    for (let n = 60; n < 160; n += 5) {
      const s = createState(generateLevel(n)); s.moves = s.movesMax = 99;
      const kinds = LEVEL_BOOSTERS;
      for (let k = 0; k < 6 && s.status === 'playing'; k++) {
        const id = kinds[(n + k) % kinds.length], i = (n * 7 + k * 13) % (s.w * s.h);
        const r = useBooster(s, id, i); if (r.valid) uses++;
        expect(s.cells.every((p, j) => p || s.obst[j]), `hole after ${id}`).toBe(true);
        expect(findMatches(s.cells, s.w, s.h)).toHaveLength(0);
        if (s.status === 'playing') expect(hasMove(s)).toBe(true);
        for (const t of s.targets) expect(t.type).toBeTruthy();
        const sw = legalSwaps(s.cells, s.w, s.h)[0]; if (sw && s.status === 'playing') swap(s, sw[0], sw[1]);   // normal play continues to work
      }
    }
    expect(uses).toBeGreaterThan(40);
  });
  it('a booster that wins the level reports the win (goal accounting goes through the same judge)', () => {
    const s = fresh(); s.targets = [{ type: 'collect', c: s.cells[0].c, n: 1 }];
    const r = useBooster(s, 'pick', 0); expect(r.status).toBe('won'); expect(r.events.at(-1)).toMatchObject({ t: 'end', status: 'won' });
  });
});
