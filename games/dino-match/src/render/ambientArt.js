// Ambient life on the island screens: a few soft painted elements (art/ambient/<era dir>/<1..3>.webp, cut from the owner's sheet
// art/sheets/ambient.png by tools/prep-fx-sheet.py ambient) drift slowly across the visible part of the screen, behind the level nodes:
// swimmers and flyers cross sideways with a gentle bob, petals / leaves / snow fall and sway, bubbles / embers / smoke rise, soft dust
// and light just float. Sparse (AMBIENT_COUNT at a time), low opacity. Nothing under reduced motion; nothing when the art is missing
// (no code-drawn props). Speeds: motion.js AMBIENT (built from the LOOP tokens). Stateless: every element's place is a function of time.
import { load, peek } from './art.js';
import { AMBIENT } from './motion.js';
import { ERAS } from '../core/eras.js';

// how each of the three elements of an era moves (sheet columns 1..3); the art faces right, so a leftward mover is mirrored
const MOVES = {
  cambrian:      ['rise', 'swim', 'rise'],     // jellyfish, swimming arthropod, bubbles
  devonian:      ['swim', 'drift', 'glide'],   // armoured fish, spores, early insect
  carboniferous: ['glide', 'drift', 'fall'],   // giant dragonfly, glow motes, fern frond
  permian:       ['drift', 'glide', 'fall'],   // red dust, small flyer, dry twig
  triassic:      ['glide', 'drift', 'fall'],   // pterosaur, dust cloud, dry leaf
  jurassic:      ['glide', 'fall', 'drift'],   // pterosaur, winged seed, light shaft
  cretaceous:    ['fall', 'glide', 'drift'],   // magnolia petal, pterosaur, firefly
  mammals:       ['glide', 'fall', 'glide'],   // bird, dandelion seed, butterfly
  iceage:        ['fall', 'glide', 'drift'],   // snowflake, owl, stardust
  humans:        ['rise', 'rise', 'glide']     // ember, smoke, bat
};
// elements drawn see-through (light / smoke / dust): lower opacity and bigger
const SOFT = new Set(['cambrian/3', 'devonian/2', 'carboniferous/2', 'permian/1', 'triassic/2', 'jurassic/3', 'iceage/3', 'humans/2', 'mammals/2']);
export const AMBIENT_COUNT = 4;
const file = (dir, n) => `ambient/${dir}/${n}.webp`;
const dirOf = (eraId) => ERAS.find((e) => e.id === eraId)?.dir || eraId;

export const preloadAmbient = (eraId) => Promise.all((eraId ? [dirOf(eraId)] : Object.keys(MOVES)).flatMap((d) => [1, 2, 3].map((n) => load(file(d, n)))));
export const hasAmbient = (eraId) => [1, 2, 3].some((n) => !!peek(file(dirOf(eraId), n)));

const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

// Draw the era's ambient layer in screen space (w x h css px) at time `ms`. reduced = true: nothing.
export function drawAmbientLife(c, eraId, w, h, ms, reduced) {
  if (reduced) return;
  const dir = dirOf(eraId), moves = MOVES[dir]; if (!moves) return;
  for (let k = 0; k < AMBIENT_COUNT; k++) {
    const n = 1 + ((k + Math.floor(hash(k, 3) * 3)) % 3), im = peek(file(dir, n)); if (!im) continue;
    const move = moves[n - 1], soft = SOFT.has(`${dir}/${n}`);
    const period = (move === 'fall' || move === 'rise' ? AMBIENT.fall : move === 'drift' ? AMBIENT.cross * 1.4 : AMBIENT.cross) * (0.8 + 0.4 * hash(k, 1));
    const run = ms / period + k / AMBIENT_COUNT + hash(k, 2), cyc = Math.floor(run), u = run - cyc;   // u: 0..1 along this pass
    const r1 = hash(k, cyc), r2 = hash(cyc, k + 9), r3 = hash(k + cyc, 5);
    const size = (soft ? 82 : move === 'fall' || move === 'rise' ? 34 : 50) * (0.8 + 0.4 * r2), iw = size, ih = size * im.height / im.width;
    const sway = Math.sin((ms / AMBIENT.sway) * Math.PI * 2 + k * 1.7), bob = Math.sin((ms / AMBIENT.bob) * Math.PI * 2 + k);
    let x, y, rot = 0, flip = 1;
    if (move === 'swim' || move === 'glide' || move === 'drift') {
      const dirX = r1 < 0.5 ? 1 : -1; flip = move === 'drift' ? 1 : dirX;
      x = dirX > 0 ? -iw + (w + 2 * iw) * u : w + iw - (w + 2 * iw) * u;
      y = h * (0.14 + 0.66 * r3) + bob * (move === 'swim' ? 5 : move === 'glide' ? 8 : 3);
      rot = move === 'glide' ? bob * 0.06 : 0;
    } else {   // fall / rise with a side sway and a slow turn
      const down = move === 'fall';
      x = w * (0.1 + 0.8 * r1) + sway * 18; y = down ? -ih + (h + 2 * ih) * u : h + ih - (h + 2 * ih) * u;
      rot = down ? sway * 0.5 + u * (r3 - 0.5) * 3 : sway * 0.12;
    }
    const edge = Math.min(1, Math.sin(Math.PI * u) * 2.5);   // fades in and out at the ends of its pass
    c.save(); c.globalAlpha = (soft ? 0.45 : 0.62) * edge; c.translate(x, y); c.rotate(rot); c.scale(flip, 1);
    c.drawImage(im, -iw / 2, -ih / 2, iw, ih); c.restore();
  }
}
