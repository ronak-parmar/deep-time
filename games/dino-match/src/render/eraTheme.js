// One theme object per era. Renderers (frame.js) read these; adding an era = adding one object here.
// Fields:
//   palette  base/light/dark = frame material, edge = outline, accent/accent2 = ornament colours
//   material texture on the frame (see TEXTURES in frame.js)   corner  corner ornament (CORNERS)
//   trim     pattern along the frame (TRIMS)                    cap     extra on the top edge (CAPS) or null
//   plaque   plaque shape: round | notch | arch | ragged        ambient { kind, color, count } or null
//   tint/tintAlpha  wash over the era scenery                   interior  board floor colour (kept dark and calm)
//   scenery  array of { type, color, alpha, ... } elements for the background (see ELEMENTS in scenery.js); each
//            type belongs to one era, alpha stays low so the board always reads
//   paint    { drift, sway, glow, ambient } for the painted layers (art/backgrounds, art/props): parallax drift in px,
//            prop sway (shear), glow pulse depth, and the drifting particles over the painted background
//   glow     optional warm glow colour at the top corners
import { ERAS } from '../core/eras.js';
import { mix } from './util.js';

export const THEMES = {
  cambrian: {
    label: 'Shallow-sea stone',
    palette: { base: '#3F8F8E', light: '#7FC4B8', dark: '#1F5558', edge: '#0E2F33', accent: '#E8D5A0', accent2: '#F6EBCB' },
    material: 'ripple', corner: 'shell', trim: 'pearl', cap: null, plaque: 'round',
    ambient: { kind: 'bubble', color: '#BFF3EA', count: 14 }, tint: '#0B6B7A', tintAlpha: 0.08, interior: '#041620',
    scenery: [{ type: 'seabed', color: '#06222B', alpha: 0.7 }, { type: 'lightRays', color: '#BFF3EA', alpha: 0.07, count: 4 }, { type: 'kelp', color: '#0F5A4A', alpha: 0.5, count: 9 }, { type: 'bubbles', color: '#CFF8F0', alpha: 0.28, count: 14 }],
    paint: { drift: 5, sway: 0.03, glow: 0.3, ambient: { kind: 'bubble', color: '#CFF8F0', count: 16 } }
  },
  devonian: {
    label: 'Swamp wood and ferns',
    palette: { base: '#6F5B38', light: '#9A8250', dark: '#3A2F1C', edge: '#1D170B', accent: '#79B05A', accent2: '#B6DC8A' },
    material: 'grain', corner: 'fern', trim: 'leaf', cap: null, plaque: 'arch',
    ambient: { kind: 'bubble', color: '#A8E6C8', count: 12 }, tint: '#0E5A4A', tintAlpha: 0.1, interior: '#04140F',
    scenery: [{ type: 'swampWater', color: '#0A2A22', alpha: 0.6 }, { type: 'lycopod', color: '#07201A', alpha: 0.65, count: 5 }, { type: 'mist', color: '#BFE8D6', alpha: 0.07, count: 3 }],
    paint: { drift: 5, sway: 0.03, glow: 0.25, ambient: { kind: 'spore', color: '#BFE8D6', count: 12 } }
  },
  carboniferous: {
    label: 'Coal and moss',
    palette: { base: '#34363A', light: '#5A5E64', dark: '#17181B', edge: '#08090A', accent: '#6FA03E', accent2: '#A9D064' },
    material: 'speckle', corner: 'moss', trim: 'tuft', cap: 'moss', plaque: 'notch',
    ambient: { kind: 'spore', color: '#B6E07A', count: 16 }, tint: '#173A18', tintAlpha: 0.1, interior: '#050A07',
    scenery: [{ type: 'forestFloor', color: '#050A06', alpha: 0.8 }, { type: 'giantFern', color: '#07140A', alpha: 0.75, count: 3 }, { type: 'horsetail', color: '#0A1A0C', alpha: 0.7, count: 8 }, { type: 'fireflies', color: '#D6F27A', alpha: 0.35, count: 14 }],
    paint: { drift: 6, sway: 0.04, glow: 0.4, ambient: { kind: 'spore', color: '#D6F27A', count: 16 } }
  },
  permian: {
    label: 'Red desert sandstone',
    palette: { base: '#B2603C', light: '#DE8F5E', dark: '#6C3320', edge: '#2E140B', accent: '#F0C28A', accent2: '#FFE2B8' },
    material: 'cracks', corner: 'chip', trim: 'strata', cap: null, plaque: 'ragged',
    ambient: { kind: 'dust', color: '#F4C79A', count: 14 }, tint: '#7A2A10', tintAlpha: 0.08, interior: '#140806',
    scenery: [{ type: 'sunDisc', color: '#FFD28A', alpha: 0.3 }, { type: 'mesas', color: '#5A2412', alpha: 0.6 }, { type: 'dunes', color: '#7A3A1C', alpha: 0.6, count: 3 }, { type: 'heatShimmer', color: '#FFD9A0', alpha: 0.09, count: 5 }],
    paint: { drift: 6, sway: 0.02, glow: 0.2, ambient: { kind: 'dust', color: '#F4C79A', count: 14 } }
  },
  triassic: {
    label: 'Orange-tan rock and ash',
    palette: { base: '#C58A4E', light: '#E8B67C', dark: '#7B4E27', edge: '#33200F', accent: '#8C8A86', accent2: '#FF8A3D' },
    material: 'ash', corner: 'ash', trim: 'ember', cap: null, plaque: 'notch',
    ambient: { kind: 'ember', color: '#FF9A4D', count: 14 }, tint: '#8A3F22', tintAlpha: 0.08, interior: '#130917',
    scenery: [{ type: 'ashSky', color: '#2A1A22', alpha: 0.45, count: 7 }, { type: 'volcano', color: '#1A0E14', alpha: 0.8, glow: '#FF7A3A' }, { type: 'ridge', color: '#0F0810', alpha: 0.8 }, { type: 'ashFall', color: '#B9A9B0', alpha: 0.22, count: 22 }],
    paint: { drift: 5, sway: 0.025, glow: 0.5, ambient: { kind: 'ember', color: '#FF9A4D', count: 14 } }
  },
  jurassic: {
    label: 'Lush vines and ivory bone',
    palette: { base: '#3E7C4A', light: '#6FB06F', dark: '#1D4228', edge: '#0A1E10', accent: '#F1E8CC', accent2: '#9ED67A' },
    material: 'leafy', corner: 'vine', trim: 'bone', cap: 'vines', plaque: 'arch',
    ambient: { kind: 'spore', color: '#D6F2A0', count: 16 }, tint: '#0E4A2A', tintAlpha: 0.1, interior: '#041208',
    scenery: [{ type: 'conifer', color: '#0B1D12', alpha: 0.75, count: 7 }, { type: 'cycad', color: '#0A1A10', alpha: 0.8, count: 2 }, { type: 'longNeck', color: '#14301F', alpha: 0.55 }],
    paint: { drift: 6, sway: 0.04, glow: 0.45, ambient: { kind: 'spore', color: '#D6F2A0', count: 12 } }
  },
  cretaceous: {
    label: 'Warm stone, amber and flowers',
    palette: { base: '#A98563', light: '#D4B088', dark: '#5E4630', edge: '#2A1D12', accent: '#F0A93A', accent2: '#F27A8A' },
    material: 'blocks', corner: 'flower', trim: 'amber', cap: null, plaque: 'round',
    ambient: { kind: 'dust', color: '#FFD08A', count: 12 }, tint: '#992E22', tintAlpha: 0.08, interior: '#120709',
    scenery: [{ type: 'skyGlow', color: '#FF9A7A', alpha: 0.3 }, { type: 'flowerPlants', color: '#2A0F18', alpha: 0.7, count: 7, bloom: '#FF8FA8' }, { type: 'petals', color: '#FFC0CC', alpha: 0.3, count: 12 }],
    paint: { drift: 6, sway: 0.04, glow: 0.3, ambient: { kind: 'dust', color: '#FFC0CC', count: 12 } }
  },
  'age-of-mammals': {
    label: 'Grassland earth, wood and leaf',
    palette: { base: '#7C5B3A', light: '#A98258', dark: '#3F2C1B', edge: '#1D130A', accent: '#8DB84C', accent2: '#D8C060' },
    material: 'earth', corner: 'leaf', trim: 'grass', cap: 'grass', plaque: 'arch',
    ambient: { kind: 'spore', color: '#E6D87A', count: 14 }, tint: '#587A30', tintAlpha: 0.08, interior: '#0A1008',
    scenery: [{ type: 'sunGlow', color: '#FFE08A', alpha: 0.28 }, { type: 'grassHorizon', color: '#1C2B12', alpha: 0.75 }, { type: 'acacia', color: '#141E0D', alpha: 0.7, count: 2 }, { type: 'herd', color: '#0F1609', alpha: 0.6, count: 6 }],
    paint: { drift: 7, sway: 0.04, glow: 0.2, ambient: { kind: 'dust', color: '#E6D87A', count: 14 } }
  },
  'ice-age': {
    label: 'Frost-blue ice',
    palette: { base: '#7FB9DC', light: '#C9ECFA', dark: '#3A6F94', edge: '#102C47', accent: '#FFFFFF', accent2: '#DDF4FF' },
    material: 'frost', corner: 'snow', trim: 'crystal', cap: 'snow', plaque: 'ragged',
    ambient: { kind: 'snow', color: '#FFFFFF', count: 26 }, tint: '#1F5E8C', tintAlpha: 0.08, interior: '#040C18',
    scenery: [{ type: 'glacierCliffs', color: '#9FD0F0', alpha: 0.35 }, { type: 'aurora', color: '#78FFC8', alpha: 0.16, count: 3 }, { type: 'snowfall', color: '#FFFFFF', alpha: 0.35, count: 30 }],
    paint: { drift: 5, sway: 0.02, glow: 0.35, ambient: { kind: 'snow', color: '#FFFFFF', count: 30 } }
  },
  'early-humans': {
    label: 'Cave wall, ochre and torchlight',
    palette: { base: '#4B403A', light: '#76665B', dark: '#241D1A', edge: '#0C0908', accent: '#C9843C', accent2: '#E8B36A' },
    material: 'rock', corner: 'hand', trim: 'ochre', cap: null, plaque: 'ragged',
    ambient: { kind: 'ember', color: '#FFB04D', count: 12 }, tint: '#5C3219', tintAlpha: 0.08, interior: '#0A0705', glow: '#FF9A3D',
    scenery: [{ type: 'caveWall', color: '#1B120C', alpha: 0.85 }, { type: 'stalactites', color: '#120B07', alpha: 0.8, count: 7 }, { type: 'handprints', color: '#C8642D', alpha: 0.3, count: 5 }, { type: 'torchLight', color: '#FFB04D', alpha: 0.2 }],
    paint: { drift: 4, sway: 0.015, glow: 0.5, ambient: { kind: 'ember', color: '#FFB04D', count: 12 } }
  }
};

// Preview / art-folder ids (age, ice, early, mammals, iceage, humans) map onto era ids.
const ALIAS = { mammals: 'age-of-mammals', age: 'age-of-mammals', iceage: 'ice-age', ice: 'ice-age', humans: 'early-humans', early: 'early-humans' };
export function themeFor(idOrDir) {
  const id = ALIAS[idOrDir] || idOrDir;
  const t = THEMES[id] || THEMES.cambrian;
  return { id: THEMES[id] ? id : 'cambrian', ...t };
}

// Plate colours derived from the palette: dark enough for the design-system text colour (4.5:1).
export function hudColors(theme) {
  const p = theme.palette;
  return { top: mix(p.base, '#06101C', 0.62), bottom: mix(p.dark, '#06101C', 0.5) };
}

export const THEME_FIELDS = ['label', 'palette', 'material', 'corner', 'trim', 'plaque', 'tint', 'tintAlpha', 'interior', 'scenery'];
export const eraIds = () => ERAS.map((e) => e.id);
