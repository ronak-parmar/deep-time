// Glyphs drawn from simple geometry (same style as the design-system bundle). No emoji.
const P = {
  check: '<path d="M5 12.5 L10 17.5 L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  close: '<path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>',
  back: '<path d="M15 5 L8 12 L15 19" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  coin: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><rect x="9.5" y="7" width="5" height="10" rx="1.5" fill="currentColor"/>',
  level: '<path d="M4 19 L10 8 L14 14 L16.5 10.5 L21 19 Z" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11 V16 M12 7.5 V8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="10,9 16,12 10,15" fill="currentColor"/>',
  heart: '<path d="M12 20 C4 14 3 9.5 6 7 C8.5 5 11 6.5 12 8.5 C13 6.5 15.5 5 18 7 C21 9.5 20 14 12 20 Z" fill="currentColor"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2.5" fill="currentColor"/><path d="M8 11 V8 a4 4 0 0 1 8 0 V11" stroke="currentColor" stroke-width="2.2" fill="none"/>',
  pick: '<path d="M5 19 L15 9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M8 6 Q15 2 21 9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" fill="none"/>',
  museum: '<path d="M3 9 L12 4 L21 9 Z" fill="currentColor"/><rect x="5" y="10.5" width="2.6" height="7" fill="currentColor"/><rect x="10.7" y="10.5" width="2.6" height="7" fill="currentColor"/><rect x="16.4" y="10.5" width="2.6" height="7" fill="currentColor"/><rect x="3" y="18.5" width="18" height="2.2" rx="1" fill="currentColor"/>',
  gear: '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 3.5 V6 M12 18 V20.5 M3.5 12 H6 M18 12 H20.5 M6 6 L7.8 7.8 M16.2 16.2 L18 18 M18 6 L16.2 7.8 M7.8 16.2 L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  book: '<path d="M4 5.5 Q9 4 12 6.5 Q15 4 20 5.5 V18.5 Q15 17 12 19.5 Q9 17 4 18.5 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 6.5 V19.5" stroke="currentColor" stroke-width="2"/>',
  rockslide: '<g fill="currentColor"><rect x="2.5" y="9" width="5" height="6" rx="2"/><rect x="9.2" y="8" width="5.6" height="8" rx="2.2"/><rect x="16.5" y="9.5" width="5" height="5.5" rx="2"/></g><path d="M4 19.5 H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 4.5 H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  amber: '<path d="M12 2.8 C15.6 7 18.2 10.2 18.2 14 a6.2 6.2 0 0 1 -12.4 0 C5.8 10.2 8.4 7 12 2.8 Z" fill="currentColor"/><path d="M9 14.2 a3 3 0 0 0 2.4 2.9" stroke="rgba(255,255,255,.75)" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  tremor: '<path d="M2.5 12 L6.5 6.5 L10 17 L13.5 5.5 L16.5 17.5 L19 9 L21.5 12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  moves: '<path d="M12 5 V19 M5 12 H19" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  lucky: '<path d="M12 2.5 L14.2 9.8 L21.5 12 L14.2 14.2 L12 21.5 L9.8 14.2 L2.5 12 L9.8 9.8 Z" fill="currentColor"/>',
  play: '<polygon points="8,5 19,12 8,19" fill="currentColor"/>',
  burst: '<path d="M12 3 L14 9 L20 8 L16 12.5 L20 17 L14 16 L12 21 L10 16 L4 17 L8 12.5 L4 8 L10 9 Z" fill="currentColor"/>',
  brush: '<path d="M6 20 L14 12" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M13 7 L17 11 L12 15 L8 11 Z" fill="currentColor"/>',
  star: (() => { const p = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.9 : 11, a = (-90 + i * 36) * Math.PI / 180; p.push((12 + r * Math.cos(a)).toFixed(2) + ',' + (12.8 + r * Math.sin(a)).toFixed(2)); } return `<polygon points="${p.join(' ')}" />`; })()
};
import { aiUrl, aiKitOn } from './kitart.js';
import { urlOf, artEnabled } from '../render/art.js';
import { UI_SLOTS } from '../render/artManifest.js';
const PAINTED = { heart: 'heart', star: 'star', pick: 'pickaxe', coin: 'coin' };   // painted icons from the AI kit when present
// painted icons (art/ui/icons, artManifest 'icon-*' slots) by glyph name. Names only used in ONE meaning are mapped; the dock's own
// names (dig, shop, settings) have the svg of pick / coin / gear as their fallback, so the coin currency glyph stays the coin.
const ICON = { back: 'back', play: 'play', book: 'howto', info: 'info', lock: 'lock', check: 'check', video: 'video', museum: 'museum', dig: 'dig', shop: 'shop', settings: 'settings', hand: 'hand' };
const FALLBACK = { dig: 'pick', shop: 'coin', settings: 'gear' };
export const iconUrl = (name) => { const s = UI_SLOTS['icon-' + ICON[name]]; return s && artEnabled() ? urlOf(s.file) : null; };
const img = (src, name, size) => {
  const im = document.createElement('img'); im.src = src; im.alt = ''; im.draggable = false; im.width = im.height = size;
  im.setAttribute('class', 'dt-glyph dt-glyph--img dt-glyph--' + name); im.style.width = im.style.height = size + 'px'; im.setAttribute('aria-hidden', 'true');
  return im;
};
// opts.painted: false = always the svg (the in-level back button sits on the painted HUD art). Painted icons only from 16 px up:
// tiny ticks (12 px on a green badge) read better as the plain svg.
export function glyph(name, size = 20, { painted = true } = {}) {
  if (PAINTED[name] && aiKitOn() && aiUrl(PAINTED[name])) return img(aiUrl(PAINTED[name]), name, size);
  const icon = painted && size >= 16 ? iconUrl(name) : null;
  if (icon) { const im = img(icon, name, size); im.classList.add('dt-glyph--icon'); return im; }
  name = FALLBACK[name] || name;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); s.setAttribute('class', 'dt-glyph');
  s.innerHTML = P[name] || '';
  return s;
}

// The tutorial / coach pointer: the painted hand (finger up-left) placed so its fingertip lands where the svg hand's did (22, 2 in
// the 44 px .tut__hand box; game.css .tut__handimg), or null (callers keep their svg).
export function handArt() {
  const u = iconUrl('hand'); if (!u) return null;
  const im = document.createElement('img'); im.src = u; im.alt = ''; im.draggable = false; im.className = 'tut__handimg'; return im;
}
