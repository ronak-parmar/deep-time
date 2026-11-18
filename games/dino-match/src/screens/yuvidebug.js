// ?debug > "Yuvi": every action on its own, and every place he appears in the game (each button opens the real screen).
import { h } from '../ui/dom.js';
import { Panel, KButton } from '../ui/kit.js';
import { ACTIONS } from '../ui/yuvi.js';
import { scene, leave } from '../ui/helper.js';

// places = [[label, fn]] from main.js
export function mountYuviDebug(root, { places, onClose }) {
  const say = { idle: '', talk: "Hi! I'm Yuvi, your dig buddy!", wave: 'Hello!', point: 'Over here!', cheer: 'Yay!', think: 'Hmm...', dig: '', sad: 'Oh no...', surprised: '!?', walk: '' };
  const act = (a) => scene('debug', async ({ y }) => {
    if (a === 'walk') { await y.hide(); await y.show(); return; }
    y.play(a, { dir: 'right' }); await y.say(say[a] || null, { talk: a === 'talk' });
  }, { force: true });
  const close = () => { leave(); el.remove(); onClose?.(); };
  const go = (fn) => () => { el.remove(); fn(); };
  const grid = (kids) => h('div', { class: 'ydbg__grid' }, ...kids);
  const el = h('div', { class: 'scrim kit-scrim ydbg', id: 'yuvi-debug', role: 'dialog', 'aria-label': 'Yuvi debug' },
    Panel({ title: 'Yuvi', class: 'ydbg__panel', onClose: close },
      h('p', { class: 'caption' }, 'Actions'),
      grid([...ACTIONS.map((a) => KButton({ variant: 'stone', class: 'ydbg__b', id: 'ya-' + a, onClick: () => act(a) }, a)), KButton({ variant: 'stone', class: 'ydbg__b', id: 'ya-confetti', onClick: () => scene('debug', async ({ y }) => { y.play('cheer', { big: true, dir: 'right' }); y.confetti(); }, { force: true }) }, '3 stars')]),
      h('p', { class: 'caption' }, 'Where he appears'),
      grid(places.map(([label, fn], i) => KButton({ variant: 'gold', class: 'ydbg__b', id: 'yp-' + i, onClick: go(fn) }, label)))));
  root.append(el);
  return { el, destroy() { el.remove(); } };
}
