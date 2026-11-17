import { h } from '../ui/dom.js';
import { Panel } from '../ui/kit.js';
import { Button, Chip } from '../ui/components.js';
import { glyph } from '../ui/glyphs.js';
import { CONFIG } from '../core/config.js';
import { ERAS } from '../core/eras.js';
import { museumEntries } from '../core/fossils.js';
import { drawFossilArt } from '../render/fossilArt.js';
import { plaqueUrl } from '../render/frame.js';

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
      h('div', { class: 'museum__erahead', style: { backgroundImage: `url(${plaqueUrl(era.id, 328, 44)})` } },
        h('span', { class: 'heading' }, era.name), h('span', { class: 'caption dim dt-num' }, `${n} of ${mine.length}`)),
      grid));
  }
  function card(e) {
    const c = h('canvas', { width: TW * 2, height: TH * 2, class: 'museum__thumb', 'aria-hidden': 'true' }), g = c.getContext('2d');
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.fillStyle = e.status === 'locked' ? '#2A2F3A' : '#D9C79F'; g.fillRect(0, 0, TW, TH);
    drawFossilArt(g, e.fossil.shape, 4, 4, TW - 8, TH - 8, { look: e.status === 'done' ? 'bone' : e.status === 'locked' ? 'stone' : 'dig', revealed: e.parts, margin: 0.04 });
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
    g.setTransform(2, 0, 0, 2, 0, 0); g.fillStyle = '#D9C79F'; g.fillRect(0, 0, 304, 150);
    drawFossilArt(g, f.shape, 4, 4, 296, 142, { look: 'bone', glow: 0.25, margin: 0.04 });
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
