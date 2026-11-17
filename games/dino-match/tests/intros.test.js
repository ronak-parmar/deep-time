import { describe, it, expect } from 'vitest';
import { INTROS, COMBO_INTROS, comboId, comboIntroFor, elementsOfLevel, introsFor, markIntroSeen, seenIntros, MAX_PER_LEVEL, ALL_INTRO_IDS } from '../src/data/intros.js';
import { generateLevel } from '../src/core/level.js';
import { TOTAL_LEVELS } from '../src/core/eras.js';
import { tierOf, firstLevelOfTier, TIERS, TIER_RULES } from '../src/core/difficulty.js';
import { OBSTACLES, parseLayout } from '../src/core/obstacles.js';
import { KINDS, COMBOS } from '../src/core/specials.js';
import { TARGET_TYPES } from '../src/core/targets.js';
import { CONFIG } from '../src/core/config.js';
import { newProfile, migrateProfile } from '../src/core/profile.js';
import { markTutorialSeen } from '../src/core/tutorial.js';

// first level that uses each element, from the real generator (all levels of one cycle)
const firstUse = {}, levels = [];
for (let n = 1; n <= TOTAL_LEVELS; n++) { const c = generateLevel(n); levels.push(c); for (const id of elementsOfLevel(c)) if (!(id in firstUse)) firstUse[id] = n; }

describe('intro registry: guard', () => {
  it('every element any level uses has an intro entry (a new element cannot reach the player unexplained)', () => {
    for (const id of Object.keys(firstUse)) expect(INTROS[id], 'no intro for ' + id).toBeTruthy();
  });
  it('every special, obstacle and objective type in the rules has an entry', () => {
    for (const k of KINDS) expect(INTROS[k], k).toBeTruthy();
    for (const k of Object.keys(OBSTACLES)) expect(INTROS[k], k).toBeTruthy();
    for (const t of Object.keys(TARGET_TYPES)) expect(INTROS['obj-' + t], t).toBeTruthy();
    expect(INTROS.artefact).toBeTruthy();
  });
  it('each entry has a title, a short explanation, a hook, art and a spot; its hook points at real rules', () => {
    for (const e of Object.values(INTROS)) {
      expect(e.title.length, e.id).toBeGreaterThan(2);
      expect(e.text.length, e.id + ' text is too long for 2 lines').toBeLessThanOrEqual(130);
      expect(e.hook && e.art && e.spot, e.id).toBeTruthy();
      const { kind, key } = e.hook;
      if (kind === 'special') expect(KINDS).toContain(key);
      if (kind === 'obstacle') expect(OBSTACLES[key], e.id).toBeTruthy();
      if (kind === 'target') expect(TARGET_TYPES[key], e.id).toBeTruthy();
      if (kind === 'block') expect(CONFIG.dig.blockTypes[key], e.id).toBeTruthy();
    }
  });
  it('the taught level is exactly the first level that uses the element', () => {
    for (const e of Object.values(INTROS)) { if (e.event) continue; expect(firstUse[e.id], e.id).toBe(e.first); }
  });
  it('every special combo has a combo intro (and every combo intro is a real pair)', () => {
    for (const key of Object.keys(COMBOS)) { const [a, b] = key.split('+'); expect(comboIntroFor(a, b), key).toBeTruthy(); }
    for (const c of COMBO_INTROS) { expect(c.ids.every((i) => KINDS.includes(i))).toBe(true); expect(c.id).toBe(comboId(c.ids[0], c.ids[1])); expect(c.text.length).toBeLessThanOrEqual(150); }
    expect(comboIntroFor('rainbow', 'bomb')).toBeTruthy(); expect(comboIntroFor('rainbow', 'rainbow')).toBeTruthy();
  });
  it('event intros (shuffle, hint) exist', () => { expect(INTROS.shuffle.event && INTROS.hint.event).toBe(true); });
});

describe('gimmick pacing (docs/14)', () => {
  const slots = {};
  for (const e of Object.values(INTROS)) if (!e.event && e.group !== 'tier' && e.first > 10) slots[e.slot] = Math.min(slots[e.slot] ?? Infinity, e.first);
  it('after the hand-made onboarding (level 10) a new element is taught at most once per 5 levels', () => {
    const at = Object.values(slots).sort((a, b) => a - b);
    for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1], `new elements at ${at[i - 1]} and ${at[i]}`).toBeGreaterThanOrEqual(5);
  });
  it('objective types are taught together with the obstacle they belong to', () => {
    for (const e of Object.values(INTROS)) if (e.group === 'objective' && e.slot !== e.id) expect(INTROS[e.slot].first, e.id).toBe(e.first);
  });
  it('teach level: a new obstacle shows up alone (no other obstacle kind in that layout)', () => {
    for (const k of Object.keys(OBSTACLES)) {
      const n = INTROS[k].first, cfg = levels[n - 1], p = parseLayout(cfg.layout);
      expect([...new Set(p.cells.map((c) => c.k))], 'level ' + n).toEqual([k]);
    }
  });
  it('use level: after it is taught, each obstacle is used again soon (within 15 levels)', () => {
    for (const k of Object.keys(OBSTACLES)) {
      const n = INTROS[k].first; let again = 0;
      for (let m = n + 1; m <= n + 15; m++) if (elementsOfLevel(levels[m - 1]).includes(k)) { again = m; break; }
      expect(again, k + ' taught at ' + n).toBeGreaterThan(0);
    }
  });
  it('mixes: a level with two obstacle kinds only appears after both were taught', () => {
    for (const c of levels) { const ks = elementsOfLevel(c).filter((i) => OBSTACLES[i]); for (const k of ks) expect(INTROS[k].first).toBeLessThanOrEqual(c.level); }
  });
});

describe('showing intros', () => {
  const lvl = (n) => generateLevel(n);
  it('a fresh player gets the intro of a new element once, then never again', () => {
    let p = newProfile(); const n = INTROS.bomb.first;
    const first = introsFor(p, lvl(n)); expect(first.map((e) => e.id)).toContain('bomb');
    p = markIntroSeen(p, ...first.map((e) => e.id));
    expect(introsFor(p, lvl(n)).map((e) => e.id)).not.toContain('bomb');
  });
  it('shows at most MAX_PER_LEVEL cards, newest element first', () => {
    const got = introsFor(newProfile(), lvl(300)); expect(got.length).toBeLessThanOrEqual(MAX_PER_LEVEL);
    expect(got[0].first).toBeGreaterThanOrEqual(got.at(-1).first);
  });
  it('the scripted tutorial covers levels 1 to 6: no popup there, and the element counts as seen afterwards', () => {
    expect(introsFor(newProfile(), lvl(5))).toEqual([]);
    expect(seenIntros(markTutorialSeen(newProfile(), 5).tutorial).has('firecracker')).toBe(true);
  });
  it('Skip tutorial turns every intro off, and the seen list survives the save migration', () => {
    const p = { ...newProfile(), tutorial: { seen: [], off: true, intros: [] } }; expect(introsFor(p, lvl(INTROS.bomb.first))).toEqual([]);
    const q = migrateProfile(JSON.parse(JSON.stringify(markIntroSeen(newProfile(), 'bomb', 'nonsense')))); expect(q.tutorial.intros).toContain('bomb');
  });
  it('all ids are unique', () => { expect(new Set(ALL_INTRO_IDS).size).toBe(ALL_INTRO_IDS.length); });
});

describe('difficulty tiers (docs/14)', () => {
  const all = Array.from({ length: TOTAL_LEVELS }, (_, i) => tierOf(i + 1));
  it('no hard level in the onboarding, never two in a row, one every 8 to 12 levels', () => {
    const hard = all.map((t, i) => (t !== 'normal' ? i + 1 : 0)).filter(Boolean);
    expect(hard[0]).toBeGreaterThan(TIER_RULES.onboarding);
    for (let i = 1; i < hard.length; i++) { const g = hard[i] - hard[i - 1]; expect(g).toBeGreaterThanOrEqual(8); expect(g).toBeLessThanOrEqual(12 + 2); }
    for (const n of hard) { expect(n % 5).not.toBe(0); expect(n % 10).not.toBe(1); }
  });
  it('about one super-hard level per 40 levels, the rest hard', () => {
    const sup = all.filter((t) => t === 'super-hard').length;
    expect(sup).toBeGreaterThanOrEqual(Math.floor((TOTAL_LEVELS - 40) / 40) - 2);
    expect(sup).toBeLessThanOrEqual(Math.ceil(TOTAL_LEVELS / 40));
    expect(firstLevelOfTier('super-hard')).toBeGreaterThan(40);
  });
  it('hard tiers mean fewer moves and bigger rewards; the tier intro is taught on its first level', () => {
    expect(TIERS.hard.moves).toBeLessThan(1); expect(TIERS['super-hard'].moves).toBeLessThan(TIERS.hard.moves);
    expect(TIERS.hard.coins).toBeGreaterThan(1); expect(TIERS['super-hard'].coins).toBeGreaterThan(TIERS.hard.coins);
    expect(INTROS['tier-hard'].first).toBe(firstLevelOfTier('hard'));
    const n = firstLevelOfTier('hard'); expect(elementsOfLevel(levels[n - 1])).toContain('tier-hard');
  });
});
