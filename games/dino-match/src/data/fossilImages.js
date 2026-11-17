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

const A = (w, h) => (x, y, r) => [x / w, y / h, r / w];
const T = A(540, 870);   // helper for the Tyrannosaurus slab (pixels of a 540 x 870 view of art/fossils/cretaceous-tyrannosaurus.webp)

export const CREDIT_DEFAULT = { author: 'Game author', source: 'AI-generated art (image generator), prompted and chosen by the game author', licence: 'Owned by the game author' };

export const IMAGES = {
  'cretaceous-tyrannosaurus': {
    file: 'cretaceous-tyrannosaurus',
    credit: { ...CREDIT_DEFAULT, title: 'Tyrannosaurus rex slab' },
    cover: [[40, 150], [200, 95], [380, 95], [480, 140], [525, 260], [530, 450], [515, 600], [420, 640], [120, 640], [25, 600], [15, 400], [20, 250]].map(([x, y]) => [x / 540, y / 870]),
    reveal: [
      [T(75, 220, 55), T(130, 200, 60), T(180, 215, 45)],                       // 1 skull and jaw
      [T(200, 200, 40), T(205, 265, 40)],                                       // 2 neck
      [T(110, 385, 45), T(160, 370, 40), T(80, 410, 38)],                       // 3 small arm and claws
      [T(240, 320, 55), T(290, 320, 55), T(330, 330, 45)],                      // 4 ribcage
      [T(190, 330, 45), T(170, 420, 45), T(135, 460, 45)],                      // 5 shoulder and front leg
      [T(360, 320, 50), T(410, 355, 45)],                                       // 6 hips and back
      [T(300, 430, 45), T(310, 490, 40), T(280, 520, 40)],                      // 7 thigh and shin
      [T(230, 555, 50), T(290, 545, 40), T(390, 520, 45)],                      // 8 feet and claws
      [T(440, 380, 42), T(470, 430, 42), T(480, 480, 40)],                      // 9 upper tail
      [T(470, 530, 40), T(420, 585, 42), T(360, 610, 38)]                       // 10 tail tip
    ]
  }
};

// Any roster fossil whose picture file exists (art/fossils/<id>.webp from tools/prep-sheet.py, or a stand-in) gets a default entry: the
// whole slab face is covered, the 10 strokes are a serpentine sweep (see slabart.js). Give a fossil its own entry above to tune cover/strokes.
const present = import.meta.glob(['../../art-standins/fossils/*.{webp,jpg,png}', '../../../../art/fossils/*.{webp,jpg,png}'], { eager: false });
const nameOf = Object.fromEntries(ROSTER.map((f) => [f.id, f.name]));
for (const p of Object.keys(present)) {
  const id = p.split('/').pop().replace(/\.(webp|jpg|png)$/, '');
  if (nameOf[id] && !IMAGES[id]) IMAGES[id] = { file: id, credit: { ...CREDIT_DEFAULT, title: `${nameOf[id]} slab` } };
}

// Every roster fossil that still uses the vector drawing. Remove an id from here when its image is added to IMAGES.
export const VECTOR_FALLBACK = ROSTER.map((f) => f.id).filter((id) => !IMAGES[id]);
export const hasImageEntry = (id) => !!IMAGES[id];
