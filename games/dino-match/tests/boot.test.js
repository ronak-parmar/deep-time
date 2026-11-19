import { describe, it, expect } from 'vitest';
import { createLoader, barTarget, follow, gate, within, bootTips, tipText, TIP_PICKS, bootBgCatalog, pickBootBg, hasProgress, ERA_SHARE, BOOT_BG_DEFAULT } from '../src/core/preload.js';
import { ROSTER } from '../src/data/roster.js';
import { BOOT } from '../src/render/motion.js';
import { existsSync, statSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bootBackground, BOOT_BG, BOOT_BGS } from '../src/screens/boot.js';

const later = (v, fail) => new Promise((res, rej) => setTimeout(() => (fail ? rej(new Error('x')) : res(v)), 1));
describe('loading screen: counted loader (M10)', () => {
  it('progress counts settled tasks by weight; failures count as done and are listed', async () => {
    const L = createLoader([{ id: 'a', run: () => later(1) }, { id: 'b', weight: 3, run: () => later(1, true) }, null, { id: 'c', run: () => { throw new Error('sync'); } }]);
    expect(L.total).toBe(5); expect(L.progress()).toBe(0);
    await L.start();
    expect(L.progress()).toBe(1); expect(L.failed().sort()).toEqual(['b', 'c']); expect(L.pending()).toEqual([]);
  });
  it('an empty plan is complete', async () => { const L = createLoader([]); expect(L.progress()).toBe(1); await L.done; });
  it('the bar never runs ahead of real progress nor of the minimum display time', () => {
    expect(barTarget(1, 0, BOOT.minShow)).toBe(0);
    expect(barTarget(1, BOOT.minShow / 2, BOOT.minShow)).toBeCloseTo(0.5);
    expect(barTarget(0.3, BOOT.minShow, BOOT.minShow)).toBe(0.3);
    expect(barTarget(1, BOOT.minShow * 3, BOOT.minShow)).toBe(1);
  });
  it('the bar eases forward, never backwards, and lands exactly on the target', () => {
    let s = 0; for (let i = 0; i < 200; i++) s = follow(s, 1, 1000 / 60, BOOT.follow);
    expect(s).toBe(1); expect(follow(0.6, 0.5, 16, BOOT.follow)).toBe(0.6); expect(follow(0.5, 0.6, 0, BOOT.follow)).toBe(0.5);
  });
  it('gate: loaded after minShow when fast; timeout at maxWait when something hangs (it keeps loading)', async () => {
    const t = []; const wait = (ms) => new Promise((r) => { t.push(ms); setTimeout(r, ms / 1000); });
    expect(await gate(createLoader([{ id: 'a', run: () => later(1) }]), { minShow: BOOT.minShow, maxWait: BOOT.maxWait, wait })).toBe('loaded');
    const hang = createLoader([{ id: 'h', run: () => new Promise(() => {}) }]);
    expect(await gate(hang, { minShow: BOOT.minShow, maxWait: BOOT.maxWait, wait })).toBe('timeout');
    expect(hang.pending()).toEqual(['h']);
    expect(await within(new Promise(() => {}), 5, wait, 'late')).toBe('late');
    expect(BOOT.minShow).toBeGreaterThanOrEqual(2000); expect(BOOT.maxWait).toBeLessThanOrEqual(12000);
  });
  it('6 to 8 tips, each a roster fact (word for word apart from the name), short enough for the card', () => {
    const tips = bootTips(ROSTER); expect(tips.length).toBeGreaterThanOrEqual(6); expect(tips.length).toBeLessThanOrEqual(8);
    expect(tips).toHaveLength(TIP_PICKS.length);
    for (const [id, i] of TIP_PICKS) {
      const f = ROSTER.find((x) => x.id === id); const tip = tipText(f, i), fact = f.facts[i];
      expect(tip.toLowerCase()).toContain(fact.replace(/^Its? /, '').slice(0, 20).toLowerCase());
      expect(tip.length).toBeLessThanOrEqual(90);
    }
  });
});

describe('loading screen backgrounds (M10)', () => {
  const art = join(import.meta.dirname, '../../../art/boot');
  it('the glob list: every art/boot/loading-*.webp is sorted into general / era / first-paint', () => {
    const files = readdirSync(art).filter((f) => /^loading-.*\.webp$/.test(f));
    const general = files.filter((f) => f !== 'loading-bg.webp' && !f.startsWith('loading-era-')).map((f) => f.slice(8, -5));
    expect(Object.keys(BOOT_BGS.general).sort()).toEqual(general.sort());
    expect(Object.keys(BOOT_BGS.general)).toContain(BOOT_BG_DEFAULT);
    expect(!!BOOT_BGS.firstPaint).toBe(files.includes('loading-bg.webp'));
    const c = bootBgCatalog({ 'x/loading-bg.webp': 'fp', 'x/loading-bg-final.webp': 'd', 'x/loading-dusk.webp': 'k', 'x/loading-era-ice-age.webp': 'i', 'x/other.webp': 'no' });
    expect(c).toEqual({ general: { 'bg-final': 'd', dusk: 'k' }, era: { 'ice-age': 'i' }, firstPaint: 'fp' });
  });
  it('the default and its small first-paint copy exist; the copy is small enough to bundle (< 80 KB)', () => {
    expect(existsSync(join(art, 'loading-bg-final.webp'))).toBe(true);
    const f = join(art, 'loading-bg.webp'); expect(existsSync(f)).toBe(true); expect(statSync(f).size).toBeLessThan(80 * 1024);
    expect(BOOT_BG).toMatchObject({ final: true, key: BOOT_BG_DEFAULT });
  });
  const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
  const G = ['bg-final', 'dusk', 'river'];
  it('first launch always shows the default', () => {
    for (const r of [0, 0.5, 0.99]) expect(pickBootBg({ general: G, era: ['cambrian'], eraId: 'cambrian', hasProgress: false, last: 'bg-final', r: () => r })).toBe('bg-final');
    expect(hasProgress({ level: 1, stars: {} })).toBe(false); expect(hasProgress({ level: 4, stars: { 1: 3 } })).toBe(true); expect(hasProgress(null)).toBe(false);
  });
  it('with progress and an image for the era: the era one about 60% of the time', () => {
    expect(pickBootBg({ general: G, era: ['cambrian'], eraId: 'cambrian', hasProgress: true, r: () => ERA_SHARE - 0.01 })).toBe('era-cambrian');
    expect(pickBootBg({ general: G, era: ['cambrian'], eraId: 'cambrian', hasProgress: true, r: seq(ERA_SHARE + 0.01, 0) })).not.toMatch(/^era-/);
    let n = 0, x = 7; const r = () => ((x = (x * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2000; i++) if (pickBootBg({ general: G, era: ['cambrian'], eraId: 'cambrian', hasProgress: true, r }) === 'era-cambrian') n++;
    expect(n / 2000).toBeGreaterThan(0.55); expect(n / 2000).toBeLessThan(0.65);
    expect(pickBootBg({ general: G, era: ['devonian'], eraId: 'cambrian', hasProgress: true, r: () => 0 })).toBe('bg-final');   // no image for this era
  });
  it('never the same general one as last launch; falls back when there is no other choice', () => {
    for (const last of G) for (const u of [0, 0.34, 0.67, 0.99]) expect(pickBootBg({ general: G, hasProgress: true, last, r: () => u })).not.toBe(last);
    expect(pickBootBg({ general: ['bg-final'], hasProgress: true, last: 'bg-final', r: () => 0.3 })).toBe('bg-final');
    expect(pickBootBg({ general: [], era: [], hasProgress: true, r: () => 0.3 })).toBe(null);
    expect(pickBootBg({ general: ['dusk'], hasProgress: false })).toBe('dusk');   // no bg-final: the first general one is the default
  });
  it('paintings get the CSS vignette; the first paint (index.html) uses the same one over the small copy', () => {
    expect(bootBackground({ url: 'x.webp', final: true })).toMatch(/radial-gradient.*url\(x\.webp\) center \/ cover no-repeat, #2A1A0C$/);
    expect(bootBackground({ url: 'y.webp', final: false })).toBe('url(y.webp) center / cover no-repeat, #2A1A0C');
    expect(bootBackground(null)).toBe('#2A1A0C');
    const html = readFileSync(join(import.meta.dirname, '../index.html'), 'utf8');
    const vignette = bootBackground({ url: 'Q', final: true }).split(', url(Q)')[0];
    expect(html).toContain(vignette); expect(html).toContain("url('../../art/boot/loading-bg.webp')");
  });
});
