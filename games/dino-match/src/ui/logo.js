// The game logo (art/logo/dino-match-logo.webp, transparent rounded square). Missing file = the plain text title.
import { h } from './dom.js';
const files = import.meta.glob('../../../../art/logo/dino-match-logo.{webp,png}', { eager: true, query: '?url', import: 'default' });
export const logoUrl = Object.values(files)[0] || null;
// size in css px; the text fallback keeps the same box so layouts do not jump
export function Logo({ size = 64, class: cls = '' } = {}) {
  if (!logoUrl) return h('span', { class: `logo logo--text display ${cls}`, role: 'img', 'aria-label': 'Dino Match' }, 'Dino Match');
  return h('img', { class: `logo ${cls}`, src: logoUrl, alt: 'Dino Match', width: size, height: size, draggable: 'false', style: { width: size + 'px', height: size + 'px' } });
}
