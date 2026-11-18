import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ACTIONS, ACTION_FRAMES, FRAMES, FRAME_URLS, frameAt, motionAt, transformOf } from '../src/ui/yuvi.js';
import { INTROS, COMBO_INTROS } from '../src/data/intros.js';
import { lineFor, poseFor, WELCOME, LINES, GREETING } from '../src/data/yuvi.js';
import { newProfile, migrateProfile, PROFILE_VERSION } from '../src/core/profile.js';
import { createLocalSaveStore } from '../src/ports/save.js';

const ART = join(import.meta.dirname, '../../../art/mascot');
const T = Array.from({ length: 60 }, (_, i) => i * 0.137);

describe('Yuvi frames', () => {
  it('the nine pose frames exist on disk and are bundled', () => {
    expect(FRAMES.length).toBe(9);
    for (const f of FRAMES) { expect(existsSync(join(ART, `dino-${f}.webp`)), f).toBe(true); expect(FRAME_URLS[f], f).toBeTruthy(); }
  });
  it('every action maps to existing frames, at every moment', () => {
    for (const a of ACTIONS) {
      for (const f of ACTION_FRAMES[a]) expect(FRAMES, `${a} -> ${f}`).toContain(f);
      for (const t of T) expect(ACTION_FRAMES[a], `${a} @ ${t}`).toContain(frameAt(a, t));
    }
  });
  it('talk alternates the talk and idle frames (5 Hz, as in the lab)', () => {
    expect(new Set(T.map((t) => frameAt('talk', t)))).toEqual(new Set(['talk', 'idle']));
    expect(frameAt('talk', 0.1)).toBe('idle'); expect(frameAt('talk', 0.3)).toBe('talk');
  });
  it('the point drawing faces right: flipped only for a target on the left', () => {
    expect(motionAt('point', 1, { dir: 'right' }).flip).toBe(false);
    expect(motionAt('point', 1, { dir: 'left' }).flip).toBe(true);
    expect(motionAt('point', 0.5).x).toBeGreaterThan(0);   // leans toward what he points at
  });
});

describe('reduced motion', () => {
  it('no action animates the transform: the same still pose at every moment', () => {
    for (const a of ACTIONS) {
      const tf = new Set(T.map((t) => transformOf(motionAt(a, t, { reduced: true }), 0.4, 1)));
      expect(tf.size, a).toBe(1);
      const m = motionAt(a, 1.3, { reduced: true });
      expect([m.x, m.y, m.r, m.sx, m.sy], a).toEqual([0, 0, 0, 1, 1]);
    }
  });
  it('the full-motion path does move (so the test above means something)', () => {
    for (const a of ['idle', 'cheer', 'dig', 'surprised', 'wave']) expect(new Set(T.map((t) => transformOf(motionAt(a, t), 0.4, 1))).size, a).toBeGreaterThan(1);
  });
});

describe('Yuvi lines', () => {
  it('every intro card and combo has a Yuvi line that fits the bubble, and a pose he has', () => {
    for (const e of Object.values(INTROS)) { const l = lineFor(e); expect(l.length, e.id).toBeGreaterThan(0); expect(l.length, e.id).toBeLessThanOrEqual(130); expect(ACTIONS, e.id).toContain(poseFor(e)); }
    for (const c of COMBO_INTROS) { expect(c.text.length, c.id).toBeGreaterThan(0); expect(c.text.length, c.id).toBeLessThanOrEqual(130); }
    expect(poseFor(INTROS.hint)).toBe('think'); expect(poseFor(INTROS['bst-pick'])).toBe('point');
  });
  it('the welcome is 4 to 6 short bubbles: hello first, cheer last, every pose exists', () => {
    expect(WELCOME.length).toBeGreaterThanOrEqual(4); expect(WELCOME.length).toBeLessThanOrEqual(6);
    expect(WELCOME[0]).toMatchObject({ action: 'wave', say: GREETING }); expect(WELCOME.at(-1).action).toBe('cheer');
    for (const s of WELCOME) { expect(ACTIONS).toContain(s.action); expect(s.say.length).toBeLessThanOrEqual(130); }
  });
  it('win / lose lists are not empty', () => { for (const k of ['win', 'threeStars', 'part', 'lose', 'nearMiss', 'noLives', 'digPart', 'shop']) expect(LINES[k].length, k).toBeGreaterThan(0); });
});

describe('Yuvi tips setting and profile', () => {
  const memStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
  it('is on for a new player, who has not seen the welcome', () => {
    const p = newProfile(); expect(p.v).toBe(PROFILE_VERSION); expect(p.settings.yuvi).toBe(true); expect(p.yuvi).toEqual({ welcomeSeen: false, met: false, islands: 1 });
  });
  it('toggle persists through save and load', async () => {
    const st = createLocalSaveStore('t', memStorage()), p = newProfile();
    await st.save({ ...p, settings: { ...p.settings, yuvi: false }, yuvi: { ...p.yuvi, welcomeSeen: true, met: true } });
    const q = await st.load();
    expect(q.settings.yuvi).toBe(false); expect(q.yuvi.welcomeSeen).toBe(true); expect(q.yuvi.met).toBe(true);
    await st.save({ ...q, settings: { ...q.settings, yuvi: true } }); expect((await st.load()).settings.yuvi).toBe(true);
  });
  it('migrates v2 saves: tips on, no welcome for a player with progress, open islands are not new', () => {
    const old = migrateProfile({ v: 2, level: 160, stars: { 1: 3, 2: 2 }, settings: { muted: true } });
    expect(old.settings.yuvi).toBe(true); expect(old.settings.muted).toBe(true);
    expect(old.yuvi.welcomeSeen).toBe(true); expect(old.yuvi.met).toBe(false); expect(old.yuvi.islands).toBe(2);
    const fresh = migrateProfile({ v: 2, level: 1 }); expect(fresh.yuvi.welcomeSeen).toBe(false);
    expect(migrateProfile({ v: 3, settings: { yuvi: 'x' } }).settings.yuvi).toBe(true);   // garbage -> default on
    expect(migrateProfile({ v: 3, settings: { yuvi: false } }).settings.yuvi).toBe(false);
  });
});
