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
  // booster medallions: one per booster (data/boosters.js slot), cut from the owner sheet art/sheets/boosters.png by
  // tools/prep-boosters-sheet.py at 256 px (sheet: not built by tools/gen-ui.py; do not regenerate them with it)
  'booster-pick':      { w: 56, h: 56, sheet: 'boosters', note: 'round teal medallion with the pickaxe' },
  'booster-rockslide': { w: 56, h: 56, sheet: 'boosters', note: 'round red medallion with tumbling boulders' },
  'booster-brush':     { w: 56, h: 56, sheet: 'boosters', note: 'round green medallion with the brush' },
  'booster-amber':     { w: 56, h: 56, sheet: 'boosters', note: 'round amber medallion with an insect in an amber drop' },
  'booster-tremor':    { w: 56, h: 56, sheet: 'boosters', note: 'round violet medallion with cracked ground' },
  'booster-moves5':    { w: 56, h: 56, sheet: 'boosters', note: 'round blue medallion, "+5" painted in' },
  'booster-lucky':     { w: 56, h: 56, sheet: 'boosters', note: 'round gold medallion with a shining ammonite' },
  'booster-start3':    { w: 56, h: 56, sheet: 'boosters', note: 'round light blue medallion, "+3" painted in' },
  'count-badge-blue':  { w: 20, h: 20, note: 'small round badge, blank' },
  'count-badge-red':   { w: 20, h: 20, note: 'small round badge, blank' },
  'count-badge-green': { w: 20, h: 20, note: 'small round badge, blank' },
  'tile-cream':   { w: 48, h: 48, n: 4, note: 'cream sandstone board tile' },
  'tile-dirt':    { w: 48, h: 48, n: 4, note: 'black tar dirt tile' },
  'tile-sand':    { w: 48, h: 48, n: 4, note: 'packed sand block, 2 hit points (dig plaque)' },
  'tile-stone':   { w: 48, h: 48, n: 4, note: 'grey rock block, 3 hit points (dig plaque)' },
  'tile-cracked': { w: 48, h: 48, n: 4, note: 'cracked pale stone, fossil layer' },
  'tablet-skull':     { w: 48, h: 48, note: 'carved tablet with a skull impression (reserved for the Dig site)' },
  'tablet-footprint': { w: 48, h: 48, note: 'carved tablet with a footprint (reserved)' },
  'tablet-fern':      { w: 48, h: 48, note: 'carved tablet with a fern (reserved)' },
  'dirt-crumbs':      { w: 64, h: 64, note: 'pile of loose dirt crumbs (reserved for dig effects)' },
  // journey map pieces, cut from art/sheets/map-pieces.png by tools/prep-pieces-sheet.py map. Coins: the coin fills 70% of the square
  // (the rest is room for the halo / flame badges); game.css draws them round the node buttons (.isle--art / .map--art).
  'node-done':      { w: 58, h: 58, sheet: 'map', note: 'golden coin, blank centre: a played level' },
  'node-open':      { w: 58, h: 58, sheet: 'map', note: 'cream sandstone coin: open, not played yet' },
  'node-locked':    { w: 58, h: 58, sheet: 'map', note: 'blue-grey slate coin: locked level' },
  'node-current':   { w: 58, h: 58, sheet: 'map', note: 'glowing amber coin with a soft halo: the next level' },
  'node-hard':      { w: 58, h: 58, sheet: 'map', note: 'crimson coin with one flame badge: hard level' },
  'node-superhard': { w: 58, h: 58, sheet: 'map', note: 'violet coin with two flame badges: super hard level' },
  'map-pin':        { w: 44, h: 44, sheet: 'map', note: 'amber map pin with a footprint: where the player is' },
  'step-stone-1':   { w: 20, h: 15, sheet: 'map', note: 'round stepping stone (trail)' },
  'step-stone-2':   { w: 20, h: 14, sheet: 'map', note: 'oval mossy stepping stone (trail)' },
  'cloud-1':        { w: 150, h: 95, sheet: 'map', note: 'big white cloud' },
  'cloud-2':        { w: 110, h: 73, sheet: 'map', note: 'small white cloud' },
  'mist-1':         { w: 220, h: 112, sheet: 'map', note: 'wispy see-through fog band' },
  // painted icons (ui/glyphs.js glyph() uses them in place of the svg), cut from art/sheets/ui-icons.png: prep-pieces-sheet.py icons
  ...Object.fromEntries(['dig', 'shop', 'museum', 'settings', 'back', 'play', 'howto', 'info', 'lock', 'check', 'video', 'hand']
    .map((n) => ['icon-' + n, { w: 24, h: 24, sheet: 'icons', file: `ui/icons/${n}.png`, note: `painted ${n} icon` }]))
};
export const SLOT_NAMES = Object.keys(UI_SLOTS);

// Relative files for a slot: ['ui/hud-sign.png'] or ['ui/tile-cream-1.png', ...].
export const slotFiles = (name) => {
  const s = UI_SLOTS[name];
  if (s.file) return [s.file];
  return s.n ? Array.from({ length: s.n }, (_, i) => `ui/${name}-${i + 1}.png`) : [`ui/${name}.png`];
};

// Era ids and the art-folder ids used for gems/sprites/props (docs: cambrian ... mammals, iceage, humans).
const DIR = { 'age-of-mammals': 'mammals', 'ice-age': 'iceage', 'early-humans': 'humans' };
export const eraDir = (id) => DIR[id] || id;
// Background candidates in priority order: art/backgrounds/<era>.png, then the art brief name bg-<dir>.png.
export const bgFiles = (id) => [`backgrounds/runtime/${id}.webp`, `backgrounds/runtime/${eraDir(id)}.webp`, `backgrounds/${id}.png`, `backgrounds/${eraDir(id)}.png`, `backgrounds/bg-${eraDir(id)}.png`];
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
  level:  { x: 58,  y: 0, w: 96, h: 56 },
  target: { x: 160, y: 0, w: 134, h: 56 },   // wide enough for 3 goals (icon well + count each)
  moves:  { x: 300, y: 0, w: 56, h: 56 }
};
export const BOOSTER_LAYOUT = { cy: 604, size: 56, cx: [76, 180, 284] };   // matches the three 96 px DOM booster buttons
