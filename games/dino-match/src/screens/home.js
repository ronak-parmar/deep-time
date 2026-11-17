import { Panel, KButton, Cur } from '../ui/kit.js';
import { h } from '../ui/dom.js';
import { Button, Chip, mmss } from '../ui/components.js';
import { glyph } from '../ui/glyphs.js';
import { ERAS, TOTAL_LEVELS } from '../core/eras.js';
import { plaqueUrl } from '../render/frame.js';
import { CONFIG } from '../core/config.js';
import { syncLives, nextLifeIn } from '../core/lives.js';
import { reducedMotion } from '../ui/motion.js';
import { buildLayout, nodeStates, islandState, createMap, W } from '../render/islandmap.js';

// Home = the journey map. A vertical world of ten floating islands (Cambrian at the bottom), a winding trail of level
// nodes, a slim top bar, a Play pill and an icon dock. The picture is a canvas painted by render/islandmap.js; the
// nodes and plaques are real buttons/labels in a native scroller (touch drag with inertia comes from the browser).
export function mountHome(root, { profile, now, onPlay, onPlayLevel, onDig, onMuseum, onSetting, onHowTo, onCredits, onShop }) {
  const layout = buildLayout(), states = nodeStates(layout, profile.level);
  const lvlC = ((profile.level - 1) % TOTAL_LEVELS) + 1;
  const state = { level: profile.level, completed: new Set(profile.completedFossils), progress: profile.fossilProgress || {} };

  const livesEl = h('span', { class: 'chip heading dt-num chip--lives', id: 'lives-chip' });
  const timerEl = h('span', { class: 'caption dim dt-num', id: 'lives-timer' });
  const waitHint = h('button', { type: 'button', class: 'map__wait caption', id: 'wait-hint', hidden: true, onClick: onDig }, 'No lives. Dig a fossil part while you wait.');
  const refresh = () => {
    const t = now(), p = syncLives(profile, t), left = nextLifeIn(p, t);
    livesEl.replaceChildren(glyph('heart', 16), `${p.lives}/${CONFIG.lives.max}`);
    livesEl.setAttribute('aria-label', `Lives ${p.lives} of ${CONFIG.lives.max}`);
    timerEl.textContent = left == null ? '' : mmss(left);
    waitHint.hidden = !(p.lives === 0 && profile.pickaxes >= CONFIG.fossils.pickaxesPerPart);
  };
  refresh();
  const timer = setInterval(refresh, 1000);

  const canvas = h('canvas', { class: 'map__canvas', 'aria-hidden': 'true' });
  const world = h('div', { class: 'map__world' });
  const scroller = h('div', { class: 'map__scroll', tabindex: '-1' }, world);

  // era plaques and nodes (positions are in world units, scaled to the phone width)
  const plaques = layout.islands.map((isl) => {
    const e = ERAS[isl.index], st = islandState(isl, profile.level), done = e.fossils.filter((f) => state.completed.has(f)).length;
    return h('div', { class: `map__plaque map__plaque--${st}`, 'data-era': e.id, 'aria-label': `${e.name}, ${done} of ${e.fossils.length} fossils${st === 'locked' ? ', locked' : ''}`, style: { backgroundImage: `url(${plaqueUrl(e.id, 168, 46)})` } },
      h('span', { class: 'heading map__pname' }, st === 'locked' ? glyph('lock', 14) : null, e.name),
      h('span', { class: 'caption map__pcount dt-num' }, `${done}/${e.fossils.length} fossils`));
  });
  const nodeEls = layout.nodes.map((n, i) => {
    const st = states[i], label = st === 'current' ? String(lvlC) : String(n.level);
    const b = h('button', { type: 'button', class: `map__node map__node--${st}`, 'data-level': n.level, 'aria-label': st === 'locked' ? `Level ${n.level}, locked` : `Level ${st === 'current' ? lvlC : n.level}${st === 'done' ? ', completed' : ''}`, disabled: st === 'locked', onClick: () => (st === 'current' ? onPlay() : onPlayLevel?.(n.level)) },
      h('span', { class: 'dt-num map__nnum' }, label));
    return b;
  });
  const marker = h('div', { class: 'map__marker', 'aria-hidden': 'true' }, h('span', { class: 'map__pin' }, glyph('pick', 18)));
  world.append(...plaques, ...nodeEls, marker);

  // settings sheet (sound, haptics, how to play)
  const toggle = (id, label, on, change) => {
    const b = KButton({ id, variant: 'stone', full: true, icon: on ? 'check' : null }, `${label} ${on ? 'on' : 'off'}`);
    b.setAttribute('aria-pressed', String(on));
    b.addEventListener('click', () => { on = !on; b.setAttribute('aria-pressed', String(on)); b.querySelector('.kit-btn__t').textContent = `${label} ${on ? 'on' : 'off'}`; b.querySelector('svg')?.remove(); if (on) b.prepend(glyph('check', 20)); change(on); });
    return b;
  };
  const sound = toggle('set-sound', 'Sound', !profile.settings.muted, (on) => onSetting?.('muted', !on));
  const hap = toggle('set-haptics', 'Haptics', !!profile.settings.haptics, (on) => onSetting?.('haptics', on));
  const close = () => { sheet.hidden = true; };
  const sheet = h('div', { class: 'map__sheet kit-scrim scrim', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Settings', onClick: (e) => { if (e.target === sheet) close(); } },
    Panel({ title: 'Settings', class: 'map__panel', onClose: close }, sound, hap,
      onHowTo ? KButton({ full: true, variant: 'stone', icon: 'book', onClick: () => { close(); onHowTo(); }, id: 'howto' }, 'How to play') : null,
      onCredits ? KButton({ full: true, variant: 'stone', icon: 'info', onClick: () => { close(); onCredits(); }, id: 'credits' }, 'Credits') : null,
      KButton({ full: true, variant: 'gold', onClick: close, id: 'settings-close' }, 'Close')));

  const dockBtn = (id, name, label, onClick) => h('button', { type: 'button', class: 'map__dockbtn', id, 'aria-label': label, onClick }, glyph(name, 24), h('span', { class: 'map__docklabel' }, label));
  const el = h('main', { class: 'screen home map' },
    canvas, scroller,
    h('div', { class: 'map__top' }, h('div', { class: 'home__lives' }, livesEl, timerEl), h('div', { class: 'home__wallet' }, Chip('pick', profile.pickaxes, 'Pickaxes', 'chip--pick'), Chip('coin', profile.coins, 'Coins', 'chip--coin'))),
    waitHint,
    KButton({ id: 'play', class: 'map__play', icon: 'play', onClick: onPlay }, `Play ${lvlC}`),
    h('nav', { class: 'map__dock', 'aria-label': 'Menu' },
      dockBtn('dig', 'pick', 'Dig site', onDig),
      onShop ? dockBtn('shop', 'coin', 'Shop', onShop) : null,
      dockBtn('museum', 'museum', `Museum ${profile.completedFossils.length}`, onMuseum),
      dockBtn('settings', 'gear', 'Settings', () => { sheet.hidden = false; })),
    sheet);
  root.append(el);

  // sizing: world units -> css px
  const ctx = canvas.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
  const map = createMap(layout, { state, dpr, reduced: reducedMotion });
  let s = 1, vw = 360, vh = 640, raf = 0, alive = true, t0 = performance.now(), ready = false, dirty = true;
  const place = () => {
    vw = el.clientWidth || 360; vh = el.clientHeight || 640; s = vw / W;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr); canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
    world.style.height = layout.H * s + 'px';
    layout.islands.forEach((isl, i) => { const p = plaques[i]; p.style.left = isl.cx * s + 'px'; p.style.top = (isl.box.y0 - 16) * s + 'px'; });
    layout.nodes.forEach((n, i) => { nodeEls[i].style.left = n.x * s + 'px'; nodeEls[i].style.top = n.y * s + 'px'; });
    const cur = layout.nodes[states.indexOf('current')] || layout.nodes.at(-1);
    marker.style.left = cur.x * s + 'px'; marker.style.top = cur.y * s + 'px';
    dirty = true;
  };
  place();
  const frame = (now2) => {
    if (!alive) return;
    const animate = !reducedMotion();
    if (ready && (animate || dirty)) { ctx.clearRect(0, 0, canvas.width, canvas.height); map.draw(ctx, scroller.scrollTop / s, vw, vh / s, (now2 - t0) / 1000); dirty = false; }
    raf = requestAnimationFrame(frame);
  };
  scroller.addEventListener('scroll', () => { dirty = true; if (ready && reducedMotion()) { ctx.clearRect(0, 0, canvas.width, canvas.height); map.draw(ctx, scroller.scrollTop / s, vw, vh / s, 0); dirty = false; } }, { passive: true });
  addEventListener('resize', place);
  // start at the current island: the player's node sits about 60% down the screen
  const cur = layout.nodes[states.indexOf('current')] || layout.nodes.at(-1);
  scroller.scrollTop = Math.max(0, cur.y * s - vh * 0.6);
  map.ensure().then(() => { ready = true; dirty = true; });
  raf = requestAnimationFrame(frame);
  return { el, destroy() { alive = false; cancelAnimationFrame(raf); clearInterval(timer); removeEventListener('resize', place); el.remove(); } };
}
