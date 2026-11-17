// UI kit for every screen outside a level (docs/06): painted plates, buttons, medallions, ribbons. The images are 9-slice PNGs made by
// tools/gen-kit.py (art-standins/ui/kit/). Drop a file with the SAME NAME into art/ui/kit/ and it replaces the stand-in: no code change.
// The CSS (kit.css) reads the images from custom properties set here, and only needs the insets below.
import './kit.css';
import './kitart.js';
import { h } from './dom.js';
import { glyph } from './glyphs.js';
import { urlOf } from '../render/art.js';

export const KIT = {   // file -> { w, h logical size, nine: [left, top, right, bottom] insets in logical px (source = 2x) }
  panel:           { w: 160, h: 160, nine: [30, 30, 30, 30] },
  'panel-small':   { w: 160, h: 96,  nine: [30, 30, 30, 30] },
  'btn-gold':      { w: 120, h: 56,  nine: [20, 18, 20, 22] },
  'btn-gold-down': { w: 120, h: 56,  nine: [20, 18, 20, 22] },
  'btn-stone':     { w: 120, h: 56,  nine: [20, 18, 20, 22] },
  'btn-stone-down':{ w: 120, h: 56,  nine: [20, 18, 20, 22] },
  medallion:       { w: 72, h: 72 },
  'medallion-teal':{ w: 72, h: 72 },
  slot:            { w: 160, h: 64, nine: [18, 16, 18, 18] }
};
const standins = import.meta.glob('../../art-standins/ui/kit/*.png', { eager: true, query: '?url', import: 'default' });
const owner = import.meta.glob('../../../../art/ui/kit/*.png', { eager: true, query: '?url', import: 'default' });
const urls = {};
for (const m of [standins, owner]) for (const [p, u] of Object.entries(m)) urls[p.split('/').pop().replace('.png', '')] = u;   // art/ (owner) wins

// Sets --kit-<name>: url(...) on :root. Called once at start; safe to call again after art changes.
export function applyKit(root = document.documentElement) {
  for (const name of Object.keys(KIT)) if (urls[name]) root.style.setProperty('--kit-' + name, `url(${urls[name]})`);
  const sign = urlOf('ui/hud-sign.png'); if (sign) root.style.setProperty('--kit-ribbon', `url(${sign})`);   // the same wood sign as the in-level HUD
  root.classList.add('has-kit');
}
applyKit();

// ---- components ------------------------------------------------------------------------------------------------------
// Painted stone plate with a wood frame and vines. title = ribbon over its top edge.
export function Panel({ title, id, class: cls = '', small = false, role, label, onClose } = {}, ...kids) {
  return h('section', { class: `kit-panel${small ? ' kit-panel--small' : ''} kit-drop ${cls}`.trim(), id, role, 'aria-label': label || title },
    title ? Ribbon(title) : null, onClose ? CloseBtn(onClose) : null, ...kids);
}
// Round X in the corner of a plate.
export const CloseBtn = (onClick, label = 'Close') => h('button', { type: 'button', class: 'kit-close', 'aria-label': label, onClick });
// Coin pill: the coin is part of the image; value text sits in the bar.
export const Cur = (value, label = 'Coins', cls = '') => h('span', { class: `kit-cur dt-num ${cls}`.trim(), role: 'status', 'aria-label': `${label} ${value}` }, String(value));
export const Ribbon = (text, id) => h('h2', { class: 'kit-ribbon', id }, h('span', { class: 'kit-ribbon__t' }, text));

// Chunky painted button. variant: 'gold' (main action) | 'stone' (everything else).
export function KButton({ variant = 'gold', full = false, onClick, id, label, disabled, icon, class: cls = '' } = {}, ...kids) {
  return h('button', { type: 'button', id, 'aria-label': label, disabled, onClick, class: `kit-btn kit-btn--${variant}${full ? ' kit-btn--full' : ''} ${cls}`.trim() },
    icon ? glyph(icon, 20) : null, h('span', { class: 'kit-btn__t' }, ...kids));
}

// Round stone medallion with a glowing core. content = a glyph name, an Element, or null. tone: 'gold' | 'teal'.
export function Medal({ content, size = 64, tone = 'gold', sparkle = true } = {}) {
  const inner = typeof content === 'string' ? glyph(content, Math.round(size * 0.42)) : content;
  return h('div', { class: `kit-medal kit-medal--${tone}${sparkle ? ' kit-medal--spark' : ''}`, style: { '--s': size + 'px' }, 'aria-hidden': 'true' }, inner);
}

// Dimmed backdrop + centred panel (a modal). Returns { el, destroy }.
export function Modal(root, panel, { onScrim } = {}) {
  const el = h('div', { class: 'scrim kit-scrim', onClick: (e) => { if (e.target === el) onScrim?.(); } }, panel);
  root.append(el);
  return { el, destroy() { el.remove(); } };
}

// Inset carved row (lists, chips).
export const Slot = (cls = '', ...kids) => h('div', { class: `kit-slot ${cls}`.trim() }, ...kids);
