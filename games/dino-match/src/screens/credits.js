// Credits / about. States plainly that the pictures are AI-generated (docs/15), by whom and what is drawn in code.
import { h } from '../ui/dom.js';
import { Panel, KButton } from '../ui/kit.js';
import { Logo, logoUrl } from '../ui/logo.js';
import { IMAGES } from '../data/fossilImages.js';

export const CREDITS = {
  lines: [
    'Dino Match is a personal project by its author.',
    'The artwork is AI-generated: the fossil slabs, the island map, the dialog and button kit and the backgrounds were made with an AI image generator, prompted and chosen by the game author.',
    'Yuvi (helper dino) artwork: nine pose drawings, AI-generated, prompted and chosen by the game author; his motion is code.',
    'The gems, effects, animations and sounds are drawn and synthesised in code.',
    'Fossil facts are checked against museum and university sources (see docs/13).',
    'Font: Nunito, SIL Open Font Licence.'
  ]
};

export function mountCredits(root, { onClose }) {
  const close = () => { el.remove(); onClose?.(); };
  const n = Object.keys(IMAGES).length;
  const panel = Panel({ title: 'Credits', class: 'credits__panel', label: 'Credits', onClose: close },
    logoUrl ? h('div', { class: 'lockup' }, Logo({ size: 72 }), h('span', { class: 'lockup__t' }, h('b', {}, 'Dino Match'), h('small', {}, 'About this game'))) : null,
    h('div', { class: 'credits__body' }, ...CREDITS.lines.map((t) => h('p', { class: 'body-small' }, t)), n ? h('p', { class: 'caption dim' }, `${n} fossil slab pictures in this build.`) : null),
    KButton({ variant: 'gold', full: true, id: 'credits-close', onClick: close }, 'Close'));
  const el = h('div', { class: 'scrim kit-scrim credits', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Credits', onClick: (e) => { if (e.target === el) close(); } }, panel);
  root.append(el);
  return { el, destroy() { el.remove(); } };
}
