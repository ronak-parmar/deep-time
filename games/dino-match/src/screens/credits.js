// About this game (shown from Settings): player-facing blurb, Yuvi, and a short credits line (AI-made artwork, built in code).
import { h } from '../ui/dom.js';
import { Panel, KButton } from '../ui/kit.js';
import { Logo, logoUrl } from '../ui/logo.js';
import { IMAGES } from '../data/fossilImages.js';

export const CREDITS = {
  lines: [
    'Grab your pickaxe! Travel back through deep time with Yuvi, a pint-sized palaeontologist in a too-big explorer hat, and dig up the greatest fossils on Earth.',
    'Match gems to win levels, earn pickaxes, uncover 47 real fossils from 10 eras, from Cambrian trilobites to Ice Age mammoths, and fill your own museum.',
    'Every fossil comes with real facts, checked against museum and university sources.',
    'Made by Ronki. Artwork created with AI image tools, directed and chosen by the game author; gameplay, animation and sound are built in code.',
    'Font: Nunito, SIL Open Font Licence.'
  ]
};

export function mountCredits(root, { onClose }) {
  const close = () => { el.remove(); onClose?.(); };
  const n = Object.keys(IMAGES).length;
  const panel = Panel({ title: 'About', class: 'credits__panel', label: 'About', onClose: close },
    logoUrl ? h('div', { class: 'lockup' }, Logo({ size: 72 }), h('span', { class: 'lockup__t' }, h('b', {}, 'Dino Match'), h('small', {}, 'About this game'))) : null,
    h('div', { class: 'credits__body' }, ...CREDITS.lines.map((t) => h('p', { class: 'body-small' }, t)), n ? h('p', { class: 'caption dim' }, `${n} fossil slab pictures in this build.`) : null),
    KButton({ variant: 'gold', full: true, id: 'credits-close', onClick: close }, 'Close'));
  const el = h('div', { class: 'scrim kit-scrim credits', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'About', onClick: (e) => { if (e.target === el) close(); } }, panel);
  root.append(el);
  return { el, destroy() { el.remove(); } };
}
