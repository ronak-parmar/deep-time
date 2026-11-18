// The fossil pictures from the art sheet (tools/fossil-sheet.py): every roster fossil has its slab and its thumbnail, the manifest points
// at files that exist, sizes stay reasonable, and the generated dig strokes are sane.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROSTER } from '../src/data/roster.js';
import { IMAGES, VECTOR_FALLBACK } from '../src/data/fossilImages.js';
import { SLABS, SLAB_COVER } from '../src/data/fossilSlabs.js';
import { CONFIG } from '../src/core/config.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ART = resolve(ROOT, 'art/fossils');
const ids = ROSTER.map((f) => f.id);

// width/height from a .webp header (VP8, VP8L or VP8X)
function webpSize(p) {
  const b = readFileSync(p); expect(b.toString('ascii', 0, 4)).toBe('RIFF'); expect(b.toString('ascii', 8, 12)).toBe('WEBP');
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

describe('fossil art from the sheet', () => {
  it('every roster fossil has a slab picture and a thumbnail', () => {
    for (const id of ids) {
      expect(existsSync(resolve(ART, id + '.webp')), id + ' slab').toBe(true);
      expect(existsSync(resolve(ART, 'thumb', id + '.webp')), id + ' thumb').toBe(true);
    }
  });
  it('every fossil has an image entry, none falls back to the vector slab', () => {
    expect(VECTOR_FALLBACK).toEqual([]);
    for (const id of ids) { expect(IMAGES[id], id).toBeTruthy(); expect(existsSync(resolve(ART, IMAGES[id].file + '.webp')), id).toBe(true); }
  });
  it('slabs are 1080 x 1740 and thumbnails at most 256 px', () => {
    for (const id of ids) {
      expect(webpSize(resolve(ART, id + '.webp')), id).toEqual([1080, 1740]);
      const [w, h] = webpSize(resolve(ART, 'thumb', id + '.webp'));
      expect(Math.max(w, h), id).toBeLessThanOrEqual(256); expect(Math.max(w, h), id).toBeGreaterThanOrEqual(128);
      expect([w, h], id).toEqual(SLABS[id].thumb);
    }
  });
  it('sizes are reasonable (art/fossils under 25 MB in total)', () => {
    let total = 0;
    for (const dir of [ART, resolve(ART, 'thumb')]) for (const f of readdirSync(dir)) { const s = statSync(resolve(dir, f)); if (s.isFile()) total += s.size; }
    for (const id of ids) { const s = statSync(resolve(ART, id + '.webp')).size; expect(s, id).toBeGreaterThan(40e3); expect(s, id).toBeLessThan(1.2e6); }
    expect(total).toBeLessThan(25e6);
  });
  it('generated dig strokes: 10 per sheet-made slab, inside the slab face, head to tail', () => {
    expect(SLAB_COVER.length).toBeGreaterThanOrEqual(3);
    for (const id of ids) {
      const s = SLABS[id]; expect(s, id).toBeTruthy(); expect(['left', 'right', 'top']).toContain(s.head);
      const rev = IMAGES[id].reveal; expect(rev.length, id).toBe(CONFIG.fossils.parts);
      if (!s.reveal) continue;   // the T. rex keeps its hand-tuned strokes
      expect(IMAGES[id].reveal).toBe(s.reveal); expect(IMAGES[id].cover).toBe(SLAB_COVER);
      const c = (st) => st.reduce((a, p) => a + (s.head === 'top' ? p[1] : p[0]), 0) / st.length;
      const first = c(rev[0]), last = c(rev[rev.length - 1]);
      if (s.head === 'right') expect(first, id).toBeGreaterThan(last); else expect(first, id).toBeLessThan(last);
    }
  });
});
