import { h } from '../ui/dom.js';
import { Button, Progress, Chip, mmss } from '../ui/components.js';
import { glyph } from '../ui/glyphs.js';
import { ERAS, eraOf } from '../core/eras.js';
import { plaqueUrl } from '../render/frame.js';
import { CONFIG } from '../core/config.js';
import { syncLives, nextLifeIn } from '../core/lives.js';
import { generateLevel } from '../core/level.js';
import { targetIcon } from '../ui/targets.js';

// Home: stats, title, the one primary action (Play), Dig site, the era journey.
export function mountHome(root, { profile, now, onPlay, onDig, onSetting }) {
  const era = eraOf(profile.level);
  const per = CONFIG.levels.perEra;
  const cards = ERAS.map((e, i) => {
    const first = i * per + 1, last = first + per - 1;
    const locked = profile.level < first, done = profile.level > last;
    const inEra = Math.max(0, Math.min(per, profile.level - first));
    const current = e.id === era.id;
    return h('li', { style: { backgroundImage: `url(${plaqueUrl(e.id, 124, 76)})` }, class: `era-card${current ? ' era-card--current' : ''}${locked ? ' era-card--locked' : ''}`, 'aria-current': current ? 'step' : null, 'aria-label': `${e.name}, levels ${first} to ${last}, ${locked ? 'locked' : done ? 'complete' : inEra + ' of ' + per + ' done'}` },
      h('span', { class: 'heading' }, locked ? glyph('lock', 16) : done ? glyph('check', 16) : null, e.name),
      h('span', { class: 'caption dim dt-num' }, `Levels ${first}-${last}`),
      Progress(locked ? 0 : done ? 1 : inEra / per));
  });
  const journey = h('ul', { class: 'home__journey', style: { listStyle: 'none', margin: 0, padding: 0 }, 'aria-label': 'Era journey' }, ...cards);

  // journey nodes: the next five levels, each with the icons of its targets
  const nodes = h('ol', { class: 'home__nodes', 'aria-label': 'Next levels', style: { listStyle: 'none', margin: 0, padding: 0 } },
    ...Array.from({ length: 5 }, (_, k) => {
      const n = profile.level + k, lv = generateLevel(n);
      return h('li', { class: 'node' + (k === 0 ? ' node--current' : ''), 'aria-label': `Level ${n}`, 'aria-current': k === 0 ? 'step' : null },
        h('span', { class: 'heading dt-num node__n' }, String(n)),
        h('span', { class: 'node__icons' }, ...lv.targets.map((t) => targetIcon(t, 18))));
    }));
  const livesEl = h('span', { class: 'chip heading dt-num chip--lives', id: 'lives-chip' });
  const timerEl = h('span', { class: 'caption dim dt-num', id: 'lives-timer' });
  const refresh = () => {
    const t = now();
    const p = syncLives(profile, t), left = nextLifeIn(p, t);
    livesEl.replaceChildren(glyph('heart', 18), `${p.lives}/${CONFIG.lives.max}`);
    livesEl.setAttribute('aria-label', `Lives ${p.lives} of ${CONFIG.lives.max}`);
    timerEl.textContent = left == null ? '' : `Next in ${mmss(left)}`;
  };
  refresh();
  const timer = setInterval(refresh, 1000);

  const toggle = (key, on, off) => {
    let v = profile.settings[key];
    const b = h('button', { type: 'button', class: 'toggle', id: 'set-' + key, 'aria-pressed': String(v) }, v ? on : off);
    b.addEventListener('click', () => { v = !v; b.setAttribute('aria-pressed', String(v)); b.textContent = v ? on : off; onSetting?.(key, v); });
    return b;
  };
  // sound is stored as `muted` (true = silent), so the toggle shows the inverse
  const sound = h('button', { type: 'button', class: 'toggle', id: 'set-sound', 'aria-pressed': String(!profile.settings.muted), 'aria-label': 'Sound' }, profile.settings.muted ? 'Sound off' : 'Sound on');
  sound.addEventListener('click', () => { const on = sound.getAttribute('aria-pressed') !== 'true'; sound.setAttribute('aria-pressed', String(on)); sound.textContent = on ? 'Sound on' : 'Sound off'; onSetting?.('muted', !on); });
  const toggles = h('div', { class: 'toggles' }, sound, toggle('haptics', 'Haptics on', 'Haptics off'));
  const el = h('main', { class: 'screen home' },
    h('div', { class: 'home__top' },
      h('div', { class: 'home__lives' }, livesEl, timerEl),
      h('div', { class: 'home__wallet' }, Chip('pick', profile.pickaxes, 'Pickaxes', 'chip--pick'), Chip('coin', profile.coins, 'Coins', 'chip--coin'))),
    h('div', { class: 'home__title' },
      h('h1', { class: 'display' }, 'Dino Match'),
      h('p', { class: 'heading home__era' }, era.name)),
    h('section', { class: 'home__fact' }, h('span', { class: 'caption' }, 'Did you know'), h('p', { class: 'body' }, era.fact)),
    h('div', { class: 'home__spacer' }),
    nodes,
    Button({ full: true, onClick: onPlay, id: 'play' }, `Play level ${profile.level}`),
    Button({ full: true, variant: 'secondary', onClick: onDig, id: 'dig' }, 'Dig site'),
    toggles,
    journey);
  root.append(el);
  requestAnimationFrame(() => el.querySelector('.era-card--current')?.scrollIntoView?.({ inline: 'center', block: 'nearest' }));
  return { el, destroy() { clearInterval(timer); el.remove(); } };
}
