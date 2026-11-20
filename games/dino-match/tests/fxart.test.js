import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EFFECTS, SpriteFx, drawFxFrame, tailFade } from '../src/render/fxArt.js';
import { drawAmbientLife, AMBIENT_COUNT } from '../src/render/ambientArt.js';
import { FX, AMBIENT, D, LOOP, PARTICLES } from '../src/render/motion.js';
import { ERAS } from '../src/core/eras.js';
import { CONFIG } from '../src/core/config.js';
import { runChain } from '../src/core/chain.js';

const root = join(import.meta.dirname, '..'), ART = join(root, '../../art');
// width / height of a png (IHDR) or a webp (VP8X / VP8L / VP8)
function dims(p) {
  const b = readFileSync(p);
  if (b.toString('ascii', 1, 4) === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}
const GRIDS = { 'fx/explosion.webp': [4, 4], 'fx/beam.webp': [1, 8], 'fx/rainbow.webp': [4, 4], 'fx/small.webp': [6, 4] };

describe('painted effect frames (render/fxArt.js, art/fx)', () => {
  it('every atlas is in art/fx, cut on its grid, from a sheet kept in art/sheets', () => {
    for (const [f, [c, r]] of Object.entries(GRIDS)) {
      expect(existsSync(join(ART, f)), f).toBe(true);
      const [w, h] = dims(join(ART, f)); expect(w % c, f).toBe(0); expect(h % r, f).toBe(0);
    }
    for (const s of ['fx-explosion', 'fx-beam', 'fx-rainbow', 'fx-small', 'ambient']) expect(existsSync(join(ART, `sheets/${s}.png`)), s).toBe(true);
  });
  it('effects use frames that exist on their sheet', () => {
    const n = { explosion: 16, beam: 8, rainbow: 16, small: 24 };
    for (const [k, e] of Object.entries(EFFECTS)) expect(e.from + e.n, k).toBeLessThanOrEqual(n[e.sheet]);
  });
  it('timing comes from motion.js tokens; the explosion runs ~0.5 s and fades out at the end', () => {
    expect(FX.blast).toBe(D.slow + D.quick); expect(FX.small.confetti).toBe(PARTICLES.confetti.life);
    expect(tailFade(0)).toBe(1); expect(tailFade(FX.tail)).toBe(1); expect(tailFade(1)).toBe(0); expect(tailFade(0.9)).toBeLessThan(0.5);
    expect(AMBIENT.cross).toBe(LOOP.scene * 2);
  });
  it('without the art (node: nothing loaded) nothing is drawn and the callers keep their fallback', () => {
    const calls = []; const c = new Proxy({}, { get: (_, k) => (...a) => calls.push(k) });
    expect(drawFxFrame(c, 'explosion', 0.5, 0, 0, 10, 10)).toBe(false);
    expect(new SpriteFx().add('sparkle', 0, 0, 10, 0)).toBe(false);
    drawAmbientLife(c, 'cambrian', 360, 640, 1000, false);
    expect(calls).toEqual([]);
  });
  it('chain fires carry the effect shape for the painted blast size', () => {
    const w = 7, h = 7, cells = Array.from({ length: w * h }, (_, i) => ({ id: i + 1, c: i % 3 }));
    cells[24] = { id: 99, c: 0, s: 'bomb' };
    const r = runChain(cells, w, h, [24]);
    const f = r.fires.find((q) => q.kind === 'bomb'); expect(f.shape).toBe('square'); expect(f.r).toBe(1);
  });
});

describe('ambient life (render/ambientArt.js, art/ambient)', () => {
  it('three elements per era, cut from the ambient sheet', () => {
    for (const e of ERAS) for (const n of [1, 2, 3]) expect(existsSync(join(ART, `ambient/${e.dir}/${n}.webp`)), `${e.dir}/${n}`).toBe(true);
    expect(AMBIENT_COUNT).toBeGreaterThanOrEqual(3); expect(AMBIENT_COUNT).toBeLessThanOrEqual(5);
  });
  it('the island screen no longer draws the code props beside the path', () => {
    const src = readFileSync(join(root, 'src/screens/island.js'), 'utf8');
    expect(src).not.toMatch(/PROPS/); expect(src).toMatch(/drawAmbientLife/);
  });
});

describe('era art', () => {
  it('every era has six 192 px gem sprites and a 768x1360 runtime background', () => {
    for (const e of ERAS) {
      for (const k of CONFIG.gemKinds) { const p = join(ART, `sprites/${e.dir}/${k}.png`); expect(existsSync(p), p).toBe(true); expect(dims(p)).toEqual([192, 192]); }
      const bg = join(ART, `backgrounds/runtime/${e.dir}.webp`); expect(existsSync(bg), bg).toBe(true); expect(dims(bg)).toEqual([768, 1360]);
    }
  });
  it('production builds drop every stand-in of render/art.js (the jurassic leaf / lava props included)', async () => {
    const cfg = (await import('../vite.config.js')).default, plug = cfg.plugins.find((p) => p.name === 'runtime-art-only');
    const code = readFileSync(join(root, 'src/render/art.js'), 'utf8'), out = plug.transform(code, join(root, 'src/render/art.js'));
    expect(out).not.toMatch(/glob\('\.\.\/\.\.\/art-standins/); expect(out).toMatch(/const standins = \{\}/);
  });
});
