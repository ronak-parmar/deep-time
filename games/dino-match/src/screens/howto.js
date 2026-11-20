// How to play: every element intro, grouped. Seen ones show the picture and the text; the rest are locked with the level that teaches them.
import { h } from '../ui/dom.js';
import { Ribbon, Slot, Medal, KButton } from '../ui/kit.js';
import { glyph } from '../ui/glyphs.js';
import { INTROS, COMBO_INTROS, seenIntros } from '../data/intros.js';
import { artBox } from './intro.js';
import { BoosterMedal } from '../ui/boosters.js';
import { BOOSTERS } from '../data/boosters.js';
import { slotReady } from '../render/art.js';

const GROUPS = [['objective', 'Goals'], ['block', 'Dig blocks'], ['special', 'Special pieces'], ['obstacle', 'Obstacles'], ['booster', 'Boosters'], ['tier', 'Hard levels'], ['event', 'Good to know']];

// all = true (debug page) shows everything unlocked.
export function mountHowTo(root, { profile, onBack, all = false, onMeetYuvi }) {
  const seen = seenIntros(profile.tutorial), stops = [];
  const row = (e, open) => {
    // a booster row shows its painted medallion (the same picture as the bar, shop and start screen); else the little animated picture
    const medal = open && e.booster && BOOSTERS[e.booster]?.slot && slotReady(BOOSTERS[e.booster].slot) ? { el: BoosterMedal(e.booster, { size: 52 }), stop() {} } : null;
    const box = open ? medal || artBox(e, 56) : null; if (box) stops.push(box.stop);
    return h('li', { 'data-id': e.id }, Slot('howto__row' + (open ? '' : ' howto__row--locked'),
      h('div', { class: 'howto__pic' }, open ? box.el : glyph('lock', 22)),
      h('div', { class: 'howto__txt' }, h('span', { class: 'heading' }, open ? e.title : '???'), h('span', { class: 'body-small' }, open ? e.text : e.first ? `You will meet this on level ${e.first}.` : 'You will meet this while playing.'))));
  };
  const body = h('div', { class: 'howto__body' });
  for (const [g, name] of GROUPS) {
    const list = Object.values(INTROS).filter((e) => e.group === g).sort((a, b) => (a.first ?? 1e9) - (b.first ?? 1e9));
    if (list.length) body.append(h('section', { class: 'howto__sec' }, Ribbon(name), h('ul', { class: 'howto__list' }, ...list.map((e) => row(e, all || seen.has(e.id))))));
  }
  const cs = COMBO_INTROS.map((c) => { const open = all || (profile.tutorial?.intros || []).includes(c.id); return h('li', { 'data-id': c.id }, Slot('howto__row' + (open ? '' : ' howto__row--locked'), h('div', { class: 'howto__pic' }, glyph(open ? 'burst' : 'lock', 22)), h('div', { class: 'howto__txt' }, h('span', { class: 'heading' }, open ? c.ids.map((k) => INTROS[k].title).join(' + ') : '???'), h('span', { class: 'body-small' }, open ? c.text : 'Swap two special pieces together to find out.')))); });
  body.append(h('section', { class: 'howto__sec' }, Ribbon('Combos'), h('ul', { class: 'howto__list' }, ...cs)));
  if (onMeetYuvi) body.prepend(KButton({ variant: 'gold', full: true, id: 'howto-yuvi', class: 'howto__yuvi', onClick: onMeetYuvi }, 'Yuvi explains the game'));
  const el = h('main', { class: 'screen howto', id: 'howto' },
    h('header', { class: 'howto__bar' }, h('button', { type: 'button', class: 'icon-btn', id: 'howto-back', 'aria-label': 'Back', onClick: onBack }, glyph('back', 22)), h('h2', { class: 'kit-title heading' }, 'How to play')),
    body);
  root.append(el);
  return { el, destroy() { stops.forEach((f) => f()); el.remove(); } };
}
