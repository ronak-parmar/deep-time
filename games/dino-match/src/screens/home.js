import { Panel, KButton, Cur } from '../ui/kit.js';
import { h } from '../ui/dom.js';
import { Button, Chip, mmss } from '../ui/components.js';
import { glyph } from '../ui/glyphs.js';
import { ERAS, TOTAL_LEVELS } from '../core/eras.js';
import { journeyStats } from '../core/journey.js';
import { CONFIG } from '../core/config.js';
import { syncLives, nextLifeIn } from '../core/lives.js';
import { reducedMotion } from '../ui/motion.js';
import { buildLayout, nodeStates, islandState, createMap, W } from '../render/islandmap.js';
import { Logo, logoUrl } from '../ui/logo.js';
import { artSizes } from '../render/islandart.js';

// Home = the journey map. A vertical world of ten floating islands (Cambrian at the bottom), a winding trail of level
// nodes, a slim top bar, a Play pill and an icon dock. The picture is a canvas painted by render/islandmap.js; the
// nodes and plaques are real buttons/labels in a native scroller (touch drag with inertia comes from the browser).
export function mountHome(root, { profile, now, onPlay, onPlayLevel, onDig, onMuseum, onSetting, onHowTo, onCredits, onShop, onIsland, onMeetYuvi }) {
  const layout = buildLayout(artSizes());
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

  // the world map: one card per era island (name, levels, stars, fossils; locked = fog + lock + the level that opens it).
  // Tap an open island to go into it (screens/island.js). No level nodes here.
  const stats = journeyStats(profile);
  const curI = Math.max(0, stats.findIndex((q) => q.state === 'current'));
  const centreOf = (isl) => (isl.art ? { x: isl.art.x + isl.art.w / 2, y: isl.art.y + isl.art.h * 0.5 } : { x: isl.cx, y: isl.cy });
  const cards = layout.islands.map((isl, i) => {
    const e = ERAS[i], q = stats[i], locked = q.state === 'locked';
    return h('button', { type: 'button', class: `wcard wcard--${q.state}`, 'data-era': e.id, disabled: locked,
      'aria-label': locked ? `${e.name}, locked, reach level ${q.unlockAt}` : `${e.name}: ${q.won} of ${q.levels} levels, ${q.stars} of ${q.maxStars} stars, ${q.fossils} of ${q.totalFossils} fossils`,
      onClick: (ev) => onIsland?.(e.id, { x: ev.clientX, y: ev.clientY }) },
      h('span', { class: 'wcard__name heading' }, locked ? glyph('lock', 16) : null, e.name),
      locked ? h('span', { class: 'wcard__lock caption' }, `Reach level ${q.unlockAt}`)
        : h('span', { class: 'wcard__stats caption dt-num' },
          h('span', {}, `${q.won}/${q.levels}`), h('i', { class: 'wcard__star' }), h('span', {}, `${q.stars}/${q.maxStars}`), h('span', { class: 'wcard__f' }, `${q.fossils}/${q.totalFossils} fossils`)));
  });
  const marker = h('div', { class: 'map__marker', 'aria-hidden': 'true' }, h('span', { class: 'map__pin' }, h('i', { class: 'map__sun' })), h('i', { class: 'map__spark map__spark--a' }), h('i', { class: 'map__spark map__spark--b' }), h('i', { class: 'map__spark map__spark--c' }));
  // one container per island: it bobs with the island picture so the card stays on it
  const isles = layout.islands.map((_, i) => h('div', { class: 'map__isle' }, cards[i]));
  isles[curI].append(marker);
  world.append(...isles);

  // settings sheet (sound, haptics, how to play)
  const toggle = (id, label, on, change) => {
    const b = KButton({ id, variant: 'stone', full: true, icon: on ? 'check' : null }, `${label} ${on ? 'on' : 'off'}`);
    b.setAttribute('aria-pressed', String(on));
    b.addEventListener('click', () => { on = !on; b.setAttribute('aria-pressed', String(on)); b.querySelector('.kit-btn__t').textContent = `${label} ${on ? 'on' : 'off'}`; b.querySelector('svg')?.remove(); if (on) b.prepend(glyph('check', 20)); change(on); });
    return b;
  };
  const sound = toggle('set-sound', 'Sound', !profile.settings.muted, (on) => onSetting?.('muted', !on));
  const hap = toggle('set-haptics', 'Haptics', !!profile.settings.haptics, (on) => onSetting?.('haptics', on));
  // Yuvi, the helper dino: off = intro cards keep their text without him, no win / lose lines (profile.settings.yuvi)
  const yuviT = toggle('set-yuvi', 'Yuvi tips', profile.settings.yuvi !== false, (on) => onSetting?.('yuvi', on));
  const close = () => { sheet.hidden = true; };
  const sheet = h('div', { class: 'map__sheet kit-scrim scrim', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Settings', onClick: (e) => { if (e.target === sheet) close(); } },
    Panel({ title: 'Settings', class: 'map__panel', onClose: close }, logoUrl ? h('div', { class: 'lockup' }, Logo({ size: 72 }), h('span', { class: 'lockup__t' }, h('b', {}, 'Dino Match'), h('small', {}, 'A fossil puzzle adventure'))) : null, sound, hap, yuviT,
      onMeetYuvi ? KButton({ full: true, variant: 'stone', icon: 'info', onClick: () => { close(); onMeetYuvi(); }, id: 'meet-yuvi' }, 'Meet Yuvi again') : null,
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
  const map = createMap(layout, { state, dpr, reduced: reducedMotion, world: true });
  let s = 1, vw = 360, vh = 640, raf = 0, alive = true, t0 = performance.now(), ready = false, dirty = true;
  const place = () => {
    vw = el.clientWidth || 360; vh = el.clientHeight || 640; s = vw / W;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr); canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
    world.style.height = layout.H * s + 'px';
    layout.islands.forEach((isl, i) => { const c = centreOf(isl); cards[i].style.left = c.x * s + 'px'; cards[i].style.top = c.y * s + 'px'; });
    const cc = centreOf(layout.islands[curI]);
    marker.style.left = cc.x * s + 'px'; marker.style.top = (cc.y - 34) * s + 'px';
    dirty = true;
  };
  place();
  const frame = (now2) => {
    if (!alive) return;
    const animate = !reducedMotion();
    if (animate) isles.forEach((e, i) => { e.style.transform = `translateY(${(map.bobOf(i, (now2 - t0) / 1000) * s).toFixed(2)}px)`; });
    if (ready && (animate || dirty)) { ctx.clearRect(0, 0, canvas.width, canvas.height); map.draw(ctx, scroller.scrollTop / s, vw, vh / s, (now2 - t0) / 1000); dirty = false; }
    raf = requestAnimationFrame(frame);
  };
  scroller.addEventListener('scroll', () => { dirty = true; if (ready && reducedMotion()) { ctx.clearRect(0, 0, canvas.width, canvas.height); map.draw(ctx, scroller.scrollTop / s, vw, vh / s, 0); dirty = false; } }, { passive: true });
  addEventListener('resize', place);
  // start at the current island: the player's node sits about 60% down the screen
  scroller.scrollTop = Math.max(0, centreOf(layout.islands[curI]).y * s - vh * 0.55);
  map.ensure().then(() => { ready = true; dirty = true; });
  raf = requestAnimationFrame(frame);
  return { el, destroy() { alive = false; cancelAnimationFrame(raf); clearInterval(timer); removeEventListener('resize', place); el.remove(); } };
}
