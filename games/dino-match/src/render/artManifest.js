// Painted-art manifest: the one place that names every image slot the game can use.
// Files live in art/ (owner art) and games/dino-match/art-standins/ (temporary stand-ins, same layout).
// art/ wins when both exist. Every slot falls back to the vector look when its file is missing.
//
//   w,h     size the slot is drawn at in game px (stage is 360x640). Paint it at 2x to 3x that.
//   nine    [left, top, right, bottom] insets in SOURCE pixels at 1x of the logical size; the plate stretches
//           between them (9-slice), so one blank plate serves any size. Omitted = drawn as is.
//   n       number of variants (files <name>-1.png ... <name>-n.png), picked per cell.
export const UI_SLOTS = {
  'hud-sign':       { w: 140, h: 56, nine: [26, 18, 26, 18], note: 'wood sign with stone plaque, blank; Level N is drawn on it' },
  'hud-plaque':     { w: 160, h: 48, nine: [20, 16, 20, 16], note: 'grey stone plaque, blank; dirt counter plaque, era cards, titles' },
  'moves-medallion':{ w: 56, h: 56, note: 'round stone medallion, blank; moves counter' },
  'target-sign':    { w: 90, h: 56, nine: [18, 16, 18, 14], note: 'small wood header sign with stone face, blank; dug count' },
  'gear-button':    { w: 48, h: 48, note: 'stone square button with a gear' },
  'back-button':    { w: 48, h: 48, note: 'stone button with a back arrow' },
  'progress-frame': { w: 200, h: 28, nine: [20, 10, 12, 10], note: 'stone bar frame with a footprint on the left, empty' },
  'progress-fill':  { w: 180, h: 14, nine: [6, 4, 6, 4], note: 'orange bar piece' },
  'star-on':        { w: 40, h: 40, note: 'lit gold star' },
  'star-off':       { w: 40, h: 40, note: 'dark empty star' },
  'booster-pick':   { w: 56, h: 56, note: 'round teal medallion with the skull pickaxe' },
  'booster-burst':  { w: 56, h: 56, note: 'round red medallion with the volcano' },
  'booster-brush':  { w: 56, h: 56, note: 'round green medallion with the brush' },
  'count-badge-blue':  { w: 20, h: 20, note: 'small round badge, blank' },
  'count-badge-red':   { w: 20, h: 20, note: 'small round badge, blank' },
  'count-badge-green': { w: 20, h: 20, note: 'small round badge, blank' },
  'tile-cream':   { w: 48, h: 48, n: 4, note: 'cream sandstone board tile' },
  'tile-dirt':    { w: 48, h: 48, n: 4, note: 'black tar dirt tile' },
  'tile-cracked': { w: 48, h: 48, n: 4, note: 'cracked pale stone, fossil layer' },
  'tablet-skull':     { w: 48, h: 48, note: 'carved tablet with a skull impression (reserved for the Dig site)' },
  'tablet-footprint': { w: 48, h: 48, note: 'carved tablet with a footprint (reserved)' },
  'tablet-fern':      { w: 48, h: 48, note: 'carved tablet with a fern (reserved)' },
  'dirt-crumbs':      { w: 64, h: 64, note: 'pile of loose dirt crumbs (reserved for dig effects)' }
};
export const SLOT_NAMES = Object.keys(UI_SLOTS);

// Relative files for a slot: ['ui/hud-sign.png'] or ['ui/tile-cream-1.png', ...].
export const slotFiles = (name) => {
  const s = UI_SLOTS[name];
  return s.n ? Array.from({ length: s.n }, (_, i) => `ui/${name}-${i + 1}.png`) : [`ui/${name}.png`];
};

// Era ids and the art-folder ids used for gems/sprites/props (docs: cambrian ... mammals, iceage, humans).
const DIR = { 'age-of-mammals': 'mammals', 'ice-age': 'iceage', 'early-humans': 'humans' };
export const eraDir = (id) => DIR[id] || id;
// Background candidates in priority order: art/backgrounds/<era>.png, then the art brief name bg-<dir>.png.
export const bgFiles = (id) => [`backgrounds/${id}.png`, `backgrounds/${eraDir(id)}.png`, `backgrounds/bg-${eraDir(id)}.png`];
export const propsPrefix = (id) => [`props/${id}/`, `props/${eraDir(id)}/`];

// Prop files are named <name>-<anchor>[-glow].png, for example fern-tl.png or lava-br-glow.png.
// anchor: tl tr bl br (corners), t b (full-width edge), l r (side edge, centred), c (centre).
// The prop is drawn at PROP_W wide (edges: full stage width) and sways from its anchor point.
export const PROP_ANCHORS = ['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r', 'c'];
export const PROP_W = 150;
export function parseProp(rel) {
  const base = rel.split('/').pop().replace(/\.png$/i, ''), parts = base.split('-');
  const glow = parts[parts.length - 1] === 'glow'; if (glow) parts.pop();
  const anchor = PROP_ANCHORS.includes(parts[parts.length - 1]) ? parts.pop() : 'c';
  return { name: parts.join('-'), anchor, glow };
}

// Play HUD slots in stage px (HUD row is 56 px high). The DOM HUD uses the same widths so text sits on the plates.
export const HUD_LAYOUT = {
  back:   { x: 4,   y: 4, w: 48, h: 48 },
  level:  { x: 58,  y: 0, w: 140, h: 56 },
  target: { x: 204, y: 0, w: 90, h: 56 },
  moves:  { x: 300, y: 0, w: 56, h: 56 }
};
export const BOOSTER_LAYOUT = { cy: 604, size: 56, cx: [76, 180, 284] };   // matches the three 96 px DOM booster buttons
