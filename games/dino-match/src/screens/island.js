// Island screen: one era as a tall winding path with EVERY level as a node (numbered continuously), best stars under each node,
// a fossil milestone after every 50 levels, the painted era background full-bleed. Only the nodes near the screen exist in the
// DOM (virtualised), so 400 levels scroll smoothly. Tap a node = play that level.
import { h } from '../ui/dom.js';
import { glyph } from '../ui/glyphs.js';
import { ERAS } from '../core/eras.js';
import { FOSSILS } from '../core/fossils.js';
import { tierOf } from '../core/difficulty.js';
import { levelState, bestStars, eraStats } from '../core/journey.js';
import { islandPath, visibleRange, PW } from '../render/islandpath.js';
import { PROPS, LOOK } from '../render/islandmap.js';
import { drawFossilArt } from '../render/fossilArt.js';
import { loadEra } from '../render/art.js';
import { reducedMotion } from '../ui/motion.js';
import { rng01 } from '../render/util.js';

export function mountIsland(root, { profile, eraId, onBack, onPlayLevel, origin }) {
  const era = ERAS.find((e) => e.id === eraId) || ERAS[0], path = islandPath(era), st = eraStats(profile, era), L = LOOK[era.id];
  const bg = h('div', { class: 'isle__bg', 'aria-hidden': 'true' });
  const canvas = h('canvas', { class: 'isle__canvas', 'aria-hidden': 'true' });
  const world = h('div', { class: 'isle__world' });
  const scroller = h('div', { class: 'isle__scroll', tabindex: '-1' }, world);
  const done = new Set(profile.completedFossils || []), digging = Object.keys(profile.fossilProgress || {});
  const el = h('main', { class: 'screen isle', 'data-era': era.id, 'aria-label': `${era.name} levels` },
    bg, canvas, scroller,
    h('header', { class: 'isle__top' },
      h('button', { type: 'button', class: 'icon-btn', id: 'isle-back', 'aria-label': 'Back to the world map', onClick: onBack }, glyph('back', 22)),
      h('div', { class: 'isle__title' }, h('span', { class: 'heading' }, era.name),
        h('span', { class: 'caption dt-num' }, `${st.won}/${st.levels} levels`, h('i', { class: 'isle__tstar' }), `${st.stars}/${st.maxStars}`, '  ', `${st.fossils}/${st.totalFossils} fossils`))));
  if (origin) { el.style.transformOrigin = `${origin.x}px ${origin.y}px`; el.classList.add('isle--zoom'); }
  root.append(el);
  loadEra(era.id).then((e) => { if (e?.bg) bg.style.backgroundImage = `url(${e.bg.src})`; });

  // fossil milestones: few, always in the DOM
  const ms = path.milestones.map((m) => {
    const f = FOSSILS.find((q) => q.id === m.fossil), state = done.has(m.fossil) ? 'done' : digging.includes(m.fossil) ? 'digging' : 'locked';
    const c = h('canvas', { width: 120, height: 68, class: 'isle__mfossil', 'aria-hidden': 'true' }), g = c.getContext('2d');
    g.scale(2, 2); drawFossilArt(g, f.shape, 2, 2, 56, 30, state === 'done' ? { look: 'bone', revealed: 10, margin: 0.04 } : state === 'digging' ? { look: 'dig', revealed: (profile.fossilProgress || {})[m.fossil] || 0, margin: 0.04 } : { look: 'stone', revealed: 0, margin: 0.04 });
    return { m, el: h('div', { class: `isle__mile isle__mile--${state}`, 'aria-label': `Fossil after level ${m.after}: ${f.name}` }, c,
      h('span', { class: 'isle__mtext' }, h('b', {}, state === 'locked' ? 'Fossil dig' : f.name), h('small', {}, `Levels ${m.after - 49}-${m.after}`))) };
  });
  world.append(...ms.map((x) => x.el));
  const marker = h('div', { class: 'map__marker isle__marker', 'aria-hidden': 'true' }, h('span', { class: 'map__pin' }, h('i', { class: 'map__sun' })), h('i', { class: 'map__spark map__spark--a' }), h('i', { class: 'map__spark map__spark--b' }), h('i', { class: 'map__spark map__spark--c' }));
  world.append(marker);

  // virtualised node pool
  const live = new Map();
  const nodeEl = (n) => {
    const s = levelState(profile, n.level), tier = tierOf(n.level), stars = bestStars(profile, n.level);
    const b = h('button', { type: 'button', class: `inode inode--${s} inode--t-${tier}`, 'data-level': n.level, disabled: s === 'locked',
      'aria-label': `Level ${n.level}${tier !== 'normal' ? ', ' + tier.replace('-', ' ') : ''}${s === 'done' ? `, ${stars} star${stars === 1 ? '' : 's'}` : s === 'locked' ? ', locked' : ''}`,
      onClick: () => onPlayLevel(n.level) },
      h('span', { class: 'inode__n dt-num' }, String(n.level)),
      tier !== 'normal' ? h('i', { class: `inode__badge inode__badge--${tier}` }) : null,
      s === 'done' ? h('span', { class: 'inode__stars' }, ...[0, 1, 2].map((k) => h('i', { class: k < stars ? 'on' : '' }))) : null);
    return b;
  };
  let s = 1, vw = 360, vh = 640;
  const sync = () => {
    const y0 = scroller.scrollTop / s - 120, y1 = (scroller.scrollTop + vh) / s + 120, [a, b] = visibleRange(path, y0, y1), want = new Set();
    for (let i = a; i < b; i++) {
      const n = path.nodes[i]; want.add(n.level);
      if (!live.has(n.level)) { const e = nodeEl(n); e.style.left = n.x * s + 'px'; e.style.top = n.y * s + 'px'; world.append(e); live.set(n.level, e); }
    }
    for (const [lv, e] of live) if (!want.has(lv)) { e.remove(); live.delete(lv); }
  };

  // canvas: glowing trail dots and the props beside the path, for the part on screen
  const ctx = canvas.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
  const curIdx = path.nodes.findIndex((n) => levelState(profile, n.level) === 'current');
  const draw = (t) => {
    const y0 = scroller.scrollTop / s, y1 = y0 + vh / s, motion = !reducedMotion();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, -y0 * dpr * s);
    for (const d of path.decor) {
      if (d.y < y0 - 80 || d.y > y1 + 80) continue;
      const kind = L.props[d.k % L.props.length]; ctx.save(); ctx.globalAlpha = 0.95; PROPS[kind](ctx, d.x, d.y, 30 * d.s, L, rng01(d.k + 7)); ctx.restore();
    }
    const [a, b] = visibleRange(path, y0 - 100, y1 + 100);
    for (let i = Math.max(1, a); i < Math.min(path.nodes.length, b + 1); i++) {
      const p = path.nodes[i - 1], q = path.nodes[i], len = Math.hypot(q.x - p.x, q.y - p.y), k = Math.max(2, Math.floor(len / 13)), lit = curIdx < 0 || i <= curIdx;
      for (let j = 1; j < k; j++) {
        const f = j / k, x = p.x + (q.x - p.x) * f, y = p.y + (q.y - p.y) * f, wave = motion ? 0.75 + 0.25 * Math.sin(t * 2.4 - (i * k + j) * 0.35) : 1;
        ctx.globalAlpha = (lit ? 1 : 0.45) * wave;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 8); g.addColorStop(0, lit ? 'rgba(255,236,150,.85)' : 'rgba(230,230,240,.6)'); g.addColorStop(1, 'rgba(255,214,110,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 8, y - 8, 16, 16); ctx.fillStyle = lit ? '#FFF6D2' : '#E8E8EE'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 6.283); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };
  const place = () => {
    vw = el.clientWidth || 360; vh = el.clientHeight || 640; s = vw / PW;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr); canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
    world.style.height = path.H * s + 'px';
    ms.forEach(({ m, el: e }) => { e.style.left = m.x * s + 'px'; e.style.top = m.y * s + 'px'; });
    for (const [lv, e] of live) { const n = path.nodes[lv - era.start]; e.style.left = n.x * s + 'px'; e.style.top = n.y * s + 'px'; }
    const cur = path.nodes[curIdx]; marker.hidden = !cur; if (cur) { marker.style.left = cur.x * s + 'px'; marker.style.top = cur.y * s + 'px'; }
    sync();
  };
  place();
  const cur = path.nodes[curIdx >= 0 ? curIdx : 0];
  scroller.scrollTop = Math.max(0, cur.y * s - vh * 0.6);
  sync();
  let raf = 0, alive = true; const t0 = performance.now();
  scroller.addEventListener('scroll', sync, { passive: true });
  const frame = (now) => { if (!alive) return; draw((now - t0) / 1000); raf = requestAnimationFrame(frame); };
  raf = requestAnimationFrame(frame);
  addEventListener('resize', place);
  return { el, path, destroy() { alive = false; cancelAnimationFrame(raf); removeEventListener('resize', place); el.remove(); } };
}
