import { h } from '../ui/dom.js';
import { Panel } from '../ui/kit.js';
import { Button, Chip } from '../ui/components.js';
import { glyph } from '../ui/glyphs.js';
import { CONFIG } from '../core/config.js';
import { ERAS } from '../core/eras.js';
import { museumEntries } from '../core/fossils.js';
import { drawFossilArt } from '../render/fossilArt.js';
import { loadSlab } from '../render/slabart.js';

const TW = 150, TH = 84;

// Museum: every fossil of the roster by era. Done = bone drawing, name, tap for the detail sheet (facts and "Watch history");
// the one being dug = partly unearthed, tap goes to the Dig site; the rest = dark stone silhouettes with the name hidden.
export function mountMuseum(root, { profile, onBack, onDig, onWatch }) {
  const entries = museumEntries(profile), done = entries.filter((e) => e.status === 'done').length;
  const body = h('div', { class: 'museum__body' });
  for (const era of ERAS) {
    const mine = entries.filter((e) => e.fossil.eraIndex === era.index), n = mine.filter((e) => e.status === 'done').length;
    const grid = h('ul', { class: 'museum__grid', 'aria-label': `${era.name} fossils` });
    for (const e of mine) grid.append(card(e));
    body.append(h('section', { class: 'museum__era' },
      h('div', { class: 'museum__erahead' },
        h('span', { class: 'heading' }, era.name), h('span', { class: 'caption dim dt-num' }, `${n} of ${mine.length}`)),
      grid));
  }
  function card(e) {
    // the slab picture when the fossil has one (buried under dirt while locked or partly dug), else the code-drawn fossil
    const c = h('canvas', { width: TW * 2, height: TH * 2, class: 'museum__thumb', 'aria-hidden': 'true' }), g = c.getContext('2d');
    g.setTransform(2, 0, 0, 2, 0, 0);
    const vector = () => { const bg = g.createRadialGradient(TW / 2, TH * 0.45, 4, TW / 2, TH * 0.45, TW * 0.7); bg.addColorStop(0, e.status === 'locked' ? '#3A2D20' : '#7A5630'); bg.addColorStop(1, e.status === 'locked' ? '#1C140C' : '#2E1D0E'); g.fillStyle = bg; g.fillRect(0, 0, TW, TH); drawFossilArt(g, e.fossil.shape, 4, 4, TW - 8, TH - 8, { look: e.status === 'done' ? 'bone' : e.status === 'locked' ? 'stone' : 'dig', revealed: e.parts, margin: 0.04 }); };
    loadSlab(e.fossil.id).then((sl) => {
      if (!sl) return vector();
      const H = Math.round(Math.max(96, Math.min(176, TW * sl.AR))); c.height = H * 2; c.style.aspectRatio = `${TW} / ${H}`; g.setTransform(2, 0, 0, 2, 0, 0);
      sl.draw(g, 0, 0, TW, H, { fit: 'contain', revealed: e.status === 'done' ? CONFIG.fossils.parts : e.status === 'digging' ? e.parts : 0, dim: e.status === 'locked' ? 0.35 : 0 });
    });
    vector();
    const label = e.status === 'locked' ? 'Locked' : e.status === 'digging' ? `${e.parts} of ${CONFIG.fossils.parts} parts` : e.fossil.when;
    const btn = h('button', { type: 'button', class: `museum__card museum__card--${e.status}`, 'data-id': e.fossil.id, disabled: e.status === 'locked', 'aria-label': e.status === 'locked' ? 'Locked fossil' : `${e.fossil.name}, ${label}`,
      onClick: () => (e.status === 'done' ? detail(e) : onDig()) },
      c,
      h('span', { class: 'museum__name heading' }, e.status === 'locked' ? '?' : e.fossil.name),
      h('span', { class: 'museum__sub caption dim' }, e.status === 'locked' ? 'Keep winning levels' : label));
    return h('li', {}, btn);
  }
  let sheet = null;
  function detail(e) {
    const f = e.fossil, c = h('canvas', { width: 304 * 2, height: 150 * 2, class: 'museum__big', 'aria-hidden': 'true' }), g = c.getContext('2d');
    g.setTransform(2, 0, 0, 2, 0, 0); { const bg = g.createRadialGradient(152, 70, 6, 152, 70, 200); bg.addColorStop(0, '#8A6234'); bg.addColorStop(1, '#2E1D0E'); g.fillStyle = bg; g.fillRect(0, 0, 304, 150); }
    drawFossilArt(g, f.shape, 4, 4, 296, 142, { look: 'bone', glow: 0.25, margin: 0.04 });
    loadSlab(f.id).then((sl) => { if (!sl) return; const H = Math.round(Math.max(120, Math.min(290, 304 * sl.AR))); c.height = H * 2; c.style.aspectRatio = `304 / ${H}`; c.classList.add('museum__big--slab'); g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, 304, H); sl.draw(g, 0, 0, 304, H, { fit: 'contain', glow: 0.35 }); });
    const close = () => { sheet?.remove(); sheet = null; };
    sheet = h('div', { class: 'museum__sheet scrim', role: 'dialog', 'aria-modal': 'true', 'aria-label': f.name, onClick: (ev) => { if (ev.target === sheet) close(); } },
      Panel({ title: f.name, class: 'museum__panel', onClose: close },
        c,
        h('p', { class: 'caption dim' }, `${f.sci}, ${f.when}`),
        h('ul', { class: 'museum__facts body-small' }, ...f.facts.map((t) => h('li', {}, t))),
        Button({ full: true, id: 'watch', onClick: () => { close(); onWatch(f); } }, glyph('video', 18), ' Watch history'),
        Button({ variant: 'secondary', full: true, id: 'close-sheet', onClick: close }, 'Close')));
    el.append(sheet);
    sheet.querySelector('#watch').focus({ preventScroll: true });
  }
  const el = h('main', { class: 'screen museum' },
    h('header', { class: 'dig__top' },
      h('button', { type: 'button', class: 'icon-btn', id: 'back', 'aria-label': 'Back', onClick: onBack }, glyph('back', 22)),
      h('span', { class: 'heading' }, 'Museum'),
      Chip('check', `${done}/${entries.length}`, 'Fossils found')),
    body);
  root.append(el);
  return { el, destroy() { el.remove(); } };
}
