import { describe, it, expect } from 'vitest';
import { ROSTER } from '../src/data/roster.js';
import { ERAS, TOTAL_LEVELS, eraOf, fossilIdForLevel, levelInEra } from '../src/core/eras.js';
import { CONFIG } from '../src/core/config.js';
import { FOSSILS, fossilById, currentFossil, digPart, partsUnearthed, isComplete, migrateFossilId, museumEntries, pickaxesToFinish } from '../src/core/fossils.js';
import { newProfile, migrateProfile, settleLevel } from '../src/core/profile.js';
import { generateLevel, validateLevel } from '../src/core/level.js';

const rich = (n) => ({ ...newProfile(), pickaxes: n });
const COUNTS = { cambrian: 3, devonian: 3, carboniferous: 3, permian: 4, triassic: 6, jurassic: 8, cretaceous: 7, 'age-of-mammals': 4, 'ice-age': 6, 'early-humans': 3 };

describe('roster data', () => {
  it('has the agreed per-era counts (47 fossils)', () => {
    for (const e of ERAS) expect(e.fossils.length, e.id).toBe(COUNTS[e.id]);
    expect(ROSTER).toHaveLength(47);
  });
  it('every entry is complete: unique id, era, name, 2 to 3 facts, 10 parts, script', () => {
    const ids = new Set();
    for (const f of ROSTER) {
      expect(ids.has(f.id), 'duplicate ' + f.id).toBe(false); ids.add(f.id);
      expect(ERAS.some((e) => e.id === f.era), f.id + ' era').toBe(true);
      expect(f.id.startsWith(f.era === 'age-of-mammals' ? 'mammals-' : f.era === 'ice-age' ? 'iceage-' : f.era === 'early-humans' ? 'humans-' : f.era + '-'), f.id).toBe(true);
      expect(f.name.length).toBeGreaterThan(2); expect(f.sci.length).toBeGreaterThan(2); expect(f.when).toMatch(/ago/);
      expect(f.facts.length, f.id).toBeGreaterThanOrEqual(2); expect(f.facts.length, f.id).toBeLessThanOrEqual(3);
      for (const t of f.facts) { expect(t.length, f.id).toBeGreaterThan(15); expect(t.length, f.id).toBeLessThan(220); }
      expect(f.shape, f.id).toHaveLength(CONFIG.fossils.parts);
      for (const part of f.shape) { expect(part.length).toBeGreaterThan(0); for (const q of part) { expect(['b', 'p', 'l', 'e']).toContain(q.k); expect(q.p.every(Number.isFinite), f.id).toBe(true); expect([0, 1, 2]).toContain(q.t); } }
      expect(['walk', 'swim', 'fly', 'crawl', 'sway']).toContain(f.script.motion);
    }
  });
  it('entries of an era are consecutive and eras follow the era order', () => {
    const order = ERAS.map((e) => e.id); let last = -1;
    for (const f of ROSTER) { const i = order.indexOf(f.era); expect(i).toBeGreaterThanOrEqual(last); last = i; }
  });
  it('Tyrannosaurus rex is the last Cretaceous fossil and the only finale', () => {
    const c = ERAS.find((e) => e.id === 'cretaceous');
    expect(c.fossils.at(-1)).toBe('cretaceous-tyrannosaurus');
    expect(FOSSILS.filter((f) => f.finale).map((f) => f.id)).toEqual(['cretaceous-tyrannosaurus']);
  });
  it('pterosaurs are called flying reptiles, not dinosaurs, in their facts', () => {
    for (const id of ['jurassic-pterodactylus', 'cretaceous-pteranodon']) expect(fossilById(id).facts.join(' ')).toMatch(/not dinosaurs/);
  });
});

describe('eras are derived from the roster', () => {
  it('an era is 50 levels per fossil, back to back; the total is their sum', () => {
    let at = 1;
    for (const e of ERAS) { expect(e.start).toBe(at); expect(e.levels).toBe(50 * COUNTS[e.id]); at += e.levels; expect(e.end).toBe(at - 1); }
    expect(TOTAL_LEVELS).toBe(2350);
  });
  it('final level count per era', () => {
    expect(ERAS.map((e) => e.levels)).toEqual([150, 150, 150, 200, 300, 400, 350, 200, 300, 150]);
  });
  it('each fossil owns 50 consecutive levels and the level lookup agrees', () => {
    for (const f of FOSSILS) {
      expect(f.lastLevel - f.firstLevel + 1).toBe(50);
      expect(fossilIdForLevel(f.firstLevel)).toBe(f.id); expect(fossilIdForLevel(f.lastLevel)).toBe(f.id);
      expect(eraOf(f.firstLevel).id).toBe(f.era);
    }
    expect(FOSSILS[0].firstLevel).toBe(1); expect(FOSSILS.at(-1).lastLevel).toBe(TOTAL_LEVELS);
  });
  it('levelInEra counts 1..length', () => {
    for (const e of ERAS) { expect(levelInEra(e.start)).toBe(1); expect(levelInEra(e.end)).toBe(e.levels); }
  });
  it('the game wraps to the first era after the last level', () => {
    expect(fossilIdForLevel(TOTAL_LEVELS + 1)).toBe(FOSSILS[0].id);
  });
});

describe('the dig rules (spend, reveal, complete)', () => {
  it('each part costs 5 pickaxes and reveals parts in order 0..9', () => {
    let p = rich(50);
    for (let i = 0; i < 10; i++) { const r = digPart(p); expect(r.ok).toBe(true); expect(r.part).toBe(i); expect(r.tile).toBe(i); expect(r.profile.pickaxes).toBe(p.pickaxes - 5); p = r.profile; }
    expect(p.pickaxes).toBe(0);
  });
  it('4 pickaxes buy nothing and change nothing', () => {
    const p = rich(4), r = digPart(p);
    expect(r).toEqual({ ok: false, reason: 'not-enough-pickaxes' }); expect(p.fossilProgress).toEqual({});
  });
  it('completing a fossil records it once and moves the dig to the next fossil', () => {
    let p = rich(50 * 2), done = [];
    for (let i = 0; i < 20; i++) { const r = digPart(p); p = r.profile; if (r.completed) done.push(r.fossil.id); }
    expect(done).toEqual([FOSSILS[0].id, FOSSILS[1].id]);
    expect(p.completedFossils).toEqual(done);
    expect(currentFossil(p).id).toBe(FOSSILS[2].id);
    expect(partsUnearthed(p, FOSSILS[2].id)).toBe(0);
  });
  it('partial progress is kept per fossil and survives the save migration', () => {
    let p = rich(15); for (let i = 0; i < 3; i++) p = digPart(p).profile;
    const back = migrateProfile(JSON.parse(JSON.stringify(p)));
    expect(partsUnearthed(back, FOSSILS[0].id)).toBe(3); expect(back.pickaxes).toBe(0);
  });
  it('50 first wins buy exactly one fossil (1 pickaxe per first win)', () => {
    let p = newProfile(); const now = 1e12;
    for (let n = 1; n <= 50; n++) p = settleLevel(p, n, { won: true, stars: 1 }, now).profile;
    expect(p.pickaxes).toBe(50);
    for (let i = 0; i < 10; i++) p = digPart(p).profile;
    expect(isComplete(p, FOSSILS[0].id)).toBe(true); expect(p.pickaxes).toBe(0);
  });
  it('digging works with no lives (the wait-for-lives flow only needs pickaxes)', () => {
    const p = { ...rich(5), lives: 0 };
    expect(digPart(p).ok).toBe(true);
  });
  it('when every fossil is done there is nothing left to dig', () => {
    const p = { ...rich(99), completedFossils: FOSSILS.map((f) => f.id) };
    expect(currentFossil(p)).toBe(null); expect(digPart(p)).toEqual({ ok: false, reason: 'all-complete' });
  });
  it('museum entries: done, one digging, the rest locked', () => {
    let p = rich(50); for (let i = 0; i < 10; i++) p = digPart(p).profile;
    p = { ...p, fossilProgress: { ...p.fossilProgress, [FOSSILS[1].id]: 3 } };
    const m = museumEntries(p);
    expect(m.map((e) => e.status).slice(0, 3)).toEqual(['done', 'digging', 'locked']);
    expect(m[1].parts).toBe(3); expect(m.filter((e) => e.status === 'digging')).toHaveLength(1);
    expect(pickaxesToFinish(p)).toBe(35);
  });
});

describe('old saves', () => {
  it('maps the old era-number ids onto the new roster', () => {
    expect(migrateFossilId('cambrian-1')).toBe('cambrian-trilobite');
    expect(migrateFossilId('cambrian-2')).toBe('cambrian-opabinia');
    expect(migrateFossilId('age-of-mammals-1')).toBe('mammals-hyracotherium');
    expect(migrateFossilId('cambrian-anomalocaris')).toBe('cambrian-anomalocaris');
    const p = migrateProfile({ v: 2, fossilProgress: { 'cambrian-1': 4, bogus: 3 }, completedFossils: ['cambrian-2', 'zzz'] });
    expect(p.fossilProgress).toEqual({ 'cambrian-trilobite': 4 }); expect(p.completedFossils).toEqual(['cambrian-opabinia']);
  });
});

describe('levels across the whole new range', () => {
  it('every level boundary and a sample inside each era generates a valid level', () => {
    const picks = new Set([1, 2, TOTAL_LEVELS - 1, TOTAL_LEVELS, TOTAL_LEVELS + 1]);
    for (const e of ERAS) for (const n of [e.start, e.start + 1, e.start + 49, e.start + 50, e.start + Math.floor(e.levels / 2), e.end - 1, e.end]) picks.add(n);
    for (const n of picks) expect(validateLevel(generateLevel(n)), 'level ' + n).toEqual([]);
  });
});
