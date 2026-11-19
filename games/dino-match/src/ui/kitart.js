// The AI-made UI kit (art/ui/kit/<name>.webp, cut from the owner's sheet by tools/prep-ui-sheet.py). Names: panel, panel-small, btn-gold,
// btn-stone, close, star, heart, medallion, pickaxe, currency, coin. Any file may be missing: every consumer falls back to the code-drawn
// kit (art-standins/ui/kit, svg glyphs). Resolution-agnostic: the CSS only uses fractions of the image size (see "ai-kit" in kit.css).
const files = import.meta.glob('../../../../art/ui/kit/*.webp', { eager: true, query: '?url', import: 'default' });
const urls = {};
for (const [p, u] of Object.entries(files)) urls[p.split('/').pop().replace('.webp', '')] = u;

export const aiUrl = (name) => urls[name] || null;
export const aiNames = () => Object.keys(urls);
export const aiHas = (...names) => names.every((n) => !!urls[n]);
// the plate-and-button restyle needs these four; icons are picked up one by one
export const aiKitOn = () => aiHas('panel', 'panel-small', 'btn-gold', 'btn-stone') && !(typeof window !== 'undefined' && (window.__noArt || /[?&]vector\b/.test(window.location?.search || '')));

export function applyAiKit(root = document.documentElement) {
  for (const [n, u] of Object.entries(urls)) root.style.setProperty('--ai-' + n, `url(${u})`);
  root.classList.toggle('ai-kit', aiKitOn());
}
if (typeof document !== 'undefined') applyAiKit();
