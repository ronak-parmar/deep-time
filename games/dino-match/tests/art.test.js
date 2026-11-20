import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { UI_SLOTS, SLOT_NAMES, slotFiles, bgFiles, parseProp, HUD_LAYOUT, PROP_ANCHORS } from '../src/render/artManifest.js';
import * as art from '../src/render/art.js';
import { drawBackdrop } from '../src/render/paint.js';
import { eraIds, THEMES } from '../src/render/eraTheme.js';

const REQUIRED = ['hud-sign', 'hud-plaque', 'moves-medallion', 'target-sign', 'gear-button', 'back-button', 'progress-frame', 'progress-fill', 'star-on', 'star-off',
  'booster-pick', 'booster-rockslide', 'booster-brush', 'booster-amber', 'booster-tremor', 'booster-moves5', 'booster-lucky', 'booster-start3', 'count-badge-blue', 'count-badge-red', 'count-badge-green', 'tile-cream', 'tile-dirt', 'tile-sand', 'tile-stone', 'tile-cracked',
  'tablet-skull', 'tablet-footprint', 'tablet-fern', 'dirt-crumbs'];
const root = join(import.meta.dirname, '..');
const here = (r) => existsSync(join(root, 'art-standins', r)) || existsSync(join(root, '../../art', r));

describe('art manifest', () => {
  it('names every slot in the brief', () => { for (const n of REQUIRED) expect(UI_SLOTS[n], n).toBeTruthy(); expect(SLOT_NAMES.filter((n) => !UI_SLOTS[n].sheet || REQUIRED.includes(n)).sort()).toEqual([...REQUIRED].sort()); });
  it('slots cut from owner sheets (boosters, map pieces, icons) name their sheet and exist in art/', () => {
    const cut = SLOT_NAMES.filter((n) => UI_SLOTS[n].sheet);
    for (const k of ['booster-rockslide', 'node-current', 'map-pin', 'step-stone-1', 'cloud-1', 'mist-1', 'icon-hand', 'icon-back']) expect(cut, k).toContain(k);
    for (const n of cut) for (const f of slotFiles(n)) expect(existsSync(join(root, '../../art', f)), f).toBe(true);
  });
  it('every slot has a size, and 9-slice insets that fit inside it', () => {
    for (const [n, s] of Object.entries(UI_SLOTS)) {
      expect(s.w > 0 && s.h > 0, n).toBe(true);
      if (s.nine) { const [l, t, r, b] = s.nine; expect(l + r, n).toBeLessThan(s.w); expect(t + b, n).toBeLessThan(s.h); }
    }
  });
  it('tile slots have four variants, with unique file names', () => {
    for (const n of ['tile-cream', 'tile-dirt', 'tile-sand', 'tile-stone', 'tile-cracked']) expect(slotFiles(n)).toHaveLength(4);
    const all = SLOT_NAMES.flatMap(slotFiles); expect(new Set(all).size).toBe(all.length);
  });
  it('stretchable plates have insets', () => { for (const n of ['hud-sign', 'hud-plaque', 'target-sign', 'progress-frame', 'progress-fill']) expect(UI_SLOTS[n].nine, n).toBeTruthy(); });
  it('every slot file exists as a stand-in or as real art', () => { for (const n of SLOT_NAMES) for (const f of slotFiles(n)) expect(here(f), f).toBe(true); });
  it('every era has a background (stand-in or real art)', () => { for (const id of eraIds()) expect(bgFiles(id).some(here), id).toBe(true); });
  it('the four real painted eras load their runtime webp (not the stand-in)', () => {
    for (const id of ['cambrian', 'devonian', 'carboniferous', 'permian']) { expect(bgFiles(id)[0]).toBe(`backgrounds/runtime/${id}.webp`); expect(existsSync(join(root, '../../art', bgFiles(id)[0])), id).toBe(true); expect(art.sourceOf(art.bgFile(id)), id).toBe('art'); }
  });
  it('tools/gen-ui.py has a builder for every manifest slot, and art/ui holds every generated file', () => {
    const py = readFileSync(join(root, '../../tools/gen-ui.py'), 'utf8');
    for (const n of SLOT_NAMES.filter((k) => !UI_SLOTS[k].sheet)) { expect(py.includes(`'${n}':`), n).toBe(true); for (const f of slotFiles(n)) expect(existsSync(join(root, '../../art', f)), f).toBe(true); }
  });
  it('HUD layout fits the 360 px stage without overlaps', () => {
    const r = Object.values(HUD_LAYOUT).sort((a, b) => a.x - b.x);
    for (let i = 0; i < r.length; i++) { expect(r[i].x + r[i].w).toBeLessThanOrEqual(360); if (i) expect(r[i].x).toBeGreaterThanOrEqual(r[i - 1].x + r[i - 1].w); }
  });
  it('parses prop file names', () => {
    expect(parseProp('props/jurassic/leaves-tl.png')).toEqual({ name: 'leaves', anchor: 'tl', glow: false });
    expect(parseProp('props/jurassic/lava-br-glow.png')).toEqual({ name: 'lava', anchor: 'br', glow: true });
    expect(parseProp('props/x/moss.png').anchor).toBe('c'); expect(PROP_ANCHORS).toContain('b');
  });
  it('every theme has paint settings with a drifting-particle kind', () => { for (const id of eraIds()) { const p = THEMES[id].paint; expect(p?.drift, id).toBeGreaterThan(0); expect(p.ambient?.kind, id).toBeTruthy(); } });
});

describe('painted art fallback', () => {
  const fake = (w = 100, h = 100) => ({ width: w, height: h });
  beforeEach(() => { art.resetArt(); });
  afterEach(() => { art.setImageLoader(() => Promise.resolve(null)); });
  it('with no files at all, everything is null and nothing throws', async () => {
    expect(art.hasPaintedEra('cambrian')).toBe(false);
    expect(await art.loadEra('cambrian')).toBeNull();
    expect(art.slot('hud-sign')).toBeNull(); expect(art.slotsReady('hud-sign')).toBe(false);
    expect(art.drawSlot({}, 'hud-sign', 0, 0, 10, 10)).toBe(false);
  });
  it('a missing background means the vector fallback even when props exist', async () => {
    art.registerUrls({ '../x/props/cambrian/kelp-b.png': 'u' }); art.setImageLoader(async () => fake());
    expect(await art.loadEra('cambrian')).toBeNull();
  });
  it('a background that fails to decode falls back instead of throwing', async () => {
    art.registerUrls({ '../x/backgrounds/cambrian.png': 'u' }); art.setImageLoader(async () => null);
    expect(await art.loadEra('cambrian')).toBeNull();
  });
  it('loads background and props; accepts the era id, the art-folder id and the bg- name', async () => {
    art.setImageLoader(async () => fake());
    art.registerUrls({ '../x/backgrounds/bg-iceage.png': 'u1', '../x/props/iceage/pine-bl.png': 'u2' });
    const e = await art.loadEra('ice-age');
    expect(e.bg).toBeTruthy(); expect(e.props.map((p) => p.anchor)).toEqual(['bl']);
  });
  it('art/ wins over stand-ins, and a partially present kit reports per slot', async () => {
    art.registerUrls({ '../a/ui/gear-button.png': 'standin' }, 'standin'); art.registerUrls({ '../b/ui/gear-button.png': 'real' }, 'art');
    expect(art.urlOf('ui/gear-button.png')).toBe('real'); expect(art.sourceOf('ui/gear-button.png')).toBe('art');
    art.setImageLoader(async () => fake()); await art.load('ui/gear-button.png');
    expect(art.slotReady('gear-button')).toBe(true); expect(art.slotReady('back-button')).toBe(false);
  });
  it('drawBackdrop runs with sway and glow props and does not move anything when reduced', () => {
    const calls = []; const c = new Proxy({}, { get: (_, k) => (...a) => { calls.push([k, a]); } });
    const art1 = { bg: fake(540, 960), props: [{ img: fake(300, 300), anchor: 'tl', glow: false }, { img: fake(300, 300), anchor: 'br', glow: true }] };
    drawBackdrop(c, art1, THEMES.cambrian, 3000, true); const a = JSON.stringify(calls); calls.length = 0;
    drawBackdrop(c, art1, THEMES.cambrian, 9000, true); expect(JSON.stringify(calls)).toBe(a);    // frozen under reduced motion
    calls.length = 0; drawBackdrop(c, art1, THEMES.cambrian, 3000, false); const m1 = JSON.stringify(calls); calls.length = 0; drawBackdrop(c, art1, THEMES.cambrian, 5000, false);
    expect(JSON.stringify(calls)).not.toBe(m1);
  });
});
