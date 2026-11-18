// Fossil slab images (docs/15): one AI-generated picture per fossil (a carved skeleton on a warm sandstone slab, brass plaque, arched
// frame), dropped in art/fossils/<fossil-id>.webp (jpg/png also work). Until a fossil has one it uses the code-drawn vector fossil
// (render/fossilArt.js), listed explicitly in VECTOR_FALLBACK so nothing is missing by accident (tests/fossilimages.test.js).
//
// Per image (all coordinates 0..1 of the image, x to the right, y down):
//   credit : shown on the Credits screen (settings). AI-generated art made by the game author, so no third-party licence.
//   cover  : outline of the slab face that the dirt covers (the frame, plaque and props are never covered)
//   reveal : the 10 dig strokes in order. Each stroke = list of [x, y, radius] points the brush passes along.
//            Missing = a default serpentine sweep over the cover area.
import { ROSTER } from './roster.js';
import { SLABS, SLAB_COVER } from './fossilSlabs.js';

export const CREDIT_DEFAULT = { author: 'Game author', source: 'AI-generated art (image generator), prompted and chosen by the game author', licence: 'Owned by the game author' };

// Hand-tuned entries (cover / reveal by hand) go here; every fossil now comes from the art sheet with generated strokes (below). The
// original T. rex slab and its hand strokes were replaced by the sheet version so all 47 slabs match (original kept in
// art/reference/slab-frame-trex.webp: the frame every slab is built on).
export const IMAGES = {};

// Any roster fossil whose picture file exists (art/fossils/<id>.webp from tools/fossil-sheet.py, or a stand-in) gets an entry. Slabs made
// by tools/fossil-sheet.py share the T. rex frame, so they share its slab face as the cover (SLAB_COVER) and get their own 10 strokes that
// follow the carving head to tail (data/fossilSlabs.js, generated). Anything else: the whole face is covered, the strokes are a
// serpentine sweep (see slabart.js). Give a fossil its own entry above to tune cover/strokes by hand.
const present = import.meta.glob(['../../art-standins/fossils/*.{webp,jpg,png}', '../../../../art/fossils/*.{webp,jpg,png}'], { eager: false });
const nameOf = Object.fromEntries(ROSTER.map((f) => [f.id, f.name]));
for (const p of Object.keys(present)) {
  const id = p.split('/').pop().replace(/\.(webp|jpg|png)$/, '');
  if (!nameOf[id] || IMAGES[id]) continue;
  const gen = SLABS[id]?.reveal;
  IMAGES[id] = { file: id, credit: { ...CREDIT_DEFAULT, title: `${nameOf[id]} slab` }, ...(gen ? { cover: SLAB_COVER, reveal: gen } : {}) };
}

// Every roster fossil that still uses the vector drawing. Remove an id from here when its image is added to IMAGES.
export const VECTOR_FALLBACK = ROSTER.map((f) => f.id).filter((id) => !IMAGES[id]);
export const hasImageEntry = (id) => !!IMAGES[id];
