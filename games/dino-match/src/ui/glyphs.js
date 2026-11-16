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
  burst: '<path d="M12 3 L14 9 L20 8 L16 12.5 L20 17 L14 16 L12 21 L10 16 L4 17 L8 12.5 L4 8 L10 9 Z" fill="currentColor"/>',
  brush: '<path d="M6 20 L14 12" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M13 7 L17 11 L12 15 L8 11 Z" fill="currentColor"/>',
  star: (() => { const p = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.9 : 11, a = (-90 + i * 36) * Math.PI / 180; p.push((12 + r * Math.cos(a)).toFixed(2) + ',' + (12.8 + r * Math.sin(a)).toFixed(2)); } return `<polygon points="${p.join(' ')}" />`; })()
};
export function glyph(name, size = 20) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); s.setAttribute('class', 'dt-glyph');
  s.innerHTML = P[name] || '';
  return s;
}
