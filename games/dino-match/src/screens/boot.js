// Loading screen (M10): a painted background (rotating: art/boot/loading-*.webp, see chooseBackground and docs/19; the default
// loading-bg-final shows from the first frame, its small copy loading-bg.webp is the page background in index.html), soft light rays and
// dust motes on top, the logo (bounce-in + soft glow), a painted stone trough with an amber fill and
// the kit pickaxe riding its edge, the percentage, and rotating "Did you know?" facts from the fossil roster.
// The bar shows REAL progress (core/preload.js counts the critical files) and never runs ahead of BOOT.minShow, so it always fills
// smoothly; after BOOT.maxWait the game goes on and the rest keeps loading. Leaving: the logo scales up and the screen fades into the map.
import { h } from '../ui/dom.js';
import { Logo, logoUrl } from '../ui/logo.js';
import { aiUrl } from '../ui/kitart.js';
import { urlOf } from '../render/art.js';
import { UI_SLOTS } from '../render/artManifest.js';
import { drawRays, drawMotes } from '../render/bootart.js';
import { BOOT, D, dur } from '../render/motion.js';
import { barTarget, follow, gate, bootBgCatalog, pickBootBg, hasProgress } from '../core/preload.js';

// every art/boot/loading-*.webp is picked up at build time (add a file, rebuild: it joins the rotation; docs/19-loading-art.md)
const bgFiles = import.meta.glob('../../../../art/boot/loading-*.webp', { eager: true, query: '?url', import: 'default' });
export const BOOT_BGS = bootBgCatalog(bgFiles);
const urlFor = (key) => (!key ? null : key.startsWith('era-') ? BOOT_BGS.era[key.slice(4)] : BOOT_BGS.general[key]) || null;
// the default (first launch, and what the first paint shows): loading-bg-final, else any general one, else the first-paint copy
const defKey = pickBootBg({ general: Object.keys(BOOT_BGS.general) });
export const BOOT_BG = defKey ? { url: urlFor(defKey), final: true, key: defKey } : BOOT_BGS.firstPaint ? { url: BOOT_BGS.firstPaint, final: false, key: null } : null;
// paintings get a soft warm vignette laid over them in CSS (darker edges and lower third, a little gold behind the logo);
// index.html lays the same one over the small first-paint copy, so the hand-over is seamless
const VIGNETTE = 'radial-gradient(ellipse 75% 62% at 50% 45%, rgba(42,26,12,0) 45%, rgba(42,26,12,.62) 100%), linear-gradient(180deg, rgba(42,26,12,0) 62%, rgba(42,26,12,.35) 100%), radial-gradient(ellipse 62% 34% at 50% 36%, rgba(255,200,110,.28), rgba(255,200,110,0) 70%)';
export const bootBackground = (bg = BOOT_BG) => (bg ? `${bg.final ? VIGNETTE + ', ' : ''}url(${bg.url}) center / cover no-repeat, #2A1A0C` : '#2A1A0C');
const LAST_KEY = 'dm.bootBg';
const readLast = () => { try { return localStorage.getItem(LAST_KEY); } catch { return null; } };
const writeLast = (k) => { try { if (k) localStorage.setItem(LAST_KEY, k); } catch { /* private mode: no memory, still never crashes */ } };

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

function Trough() {
  const frame = urlOf('ui/progress-frame.png'), fillUrl = urlOf('ui/progress-fill.png'), pick = aiUrl('pickaxe');
  const fill = h('i', { class: 'boot__fill' }), edge = h('i', { class: 'boot__edge' }, pick ? h('img', { src: pick, alt: '', draggable: 'false' }) : h('b', { class: 'boot__fossil' }));
  const bar = h('div', { class: 'boot__bar' + (frame && fillUrl ? ' boot__bar--art' : ''), role: 'progressbar', 'aria-label': 'Loading', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0 }, fill, edge);
  if (frame && fillUrl) {   // the painted kit bar: 9-slice frame (footprint cap on the left), amber fill piece
    const [l, t, r, b] = UI_SLOTS['progress-frame'].nine, k = 1.25, [fl, ft, fr, fb] = UI_SLOTS['progress-fill'].nine;
    Object.assign(bar.style, { borderImageSource: `url(${frame})`, borderImageSlice: `${t * 2} ${r * 2} ${b * 2} ${l * 2} fill`, borderImageWidth: `${t * k}px ${r * k}px ${b * k}px ${l * k}px` });
    Object.assign(fill.style, { borderImageSource: `url(${fillUrl})`, borderImageSlice: `${ft * 2} ${fr * 2} ${fb * 2} ${fl * 2} fill`, borderImageWidth: `${ft}px ${fr}px ${fb}px ${fl}px` });
  }
  return { bar, fill, edge };
}

export function mountBoot(root, { tips = [], reduced = () => false } = {}) {
  const cv = h('canvas', { class: 'boot__bg', 'aria-hidden': 'true' });
  const { bar, fill, edge } = Trough();
  const pct = h('b', { class: 'boot__pct' }, '0%');
  const tipText = h('span', { class: 'boot__tiptext' }, tips[0] || '');
  const tip = tips.length ? h('p', { class: 'boot__tip', 'aria-live': 'polite' }, h('span', { class: 'boot__tiphead' }, 'Did you know?'), tipText) : null;
  const el = h('main', { class: 'screen boot', 'aria-busy': 'true' }, cv,
    h('div', { class: 'boot__col' },
      logoUrl ? h('div', { class: 'boot__logo' }, h('i', { class: 'boot__glow' }), Logo({ size: 248, class: 'boot__img' }), h('h1', { class: 'sr-only' }, 'Dino Match')) : h('h1', { class: 'display boot__title' }, 'Dino Match'),
      h('div', { class: 'boot__load' }, bar, h('div', { class: 'boot__row' }, h('span', { class: 'boot__sub' }, 'Digging up the game'), pct))),
    tip);
  el.style.background = bootBackground();
  // the chosen background crossfades in over the default once its file is loaded (never holds the boot; instant under reduced motion)
  const swapLayer = h('i', { class: 'boot__bgswap', 'aria-hidden': 'true', style: { position: 'absolute', inset: '0', opacity: '0', pointerEvents: 'none' } });
  el.prepend(swapLayer);
  root.append(el);

  // the moving layer over the painting: light rays and dust motes (a transparent canvas; nothing under reduced motion)
  let W = 360, H = 640, scale = 1;
  const size = () => {
    W = el.clientWidth || 360; H = el.clientHeight || 640;
    scale = Math.min(2, (el.getBoundingClientRect().width / W || 1) * (globalThis.devicePixelRatio || 1));
    cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
  };
  size();
  const ctx = cv.getContext('2d');
  const paint = (t) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    if (reduced()) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0); drawRays(ctx, W, H, t); drawMotes(ctx, W, H, t);
  };
  paint(0);

  // tips rotate (fade out, swap, fade in); none under reduced motion other than the swap itself
  // (the first tip turns over halfway through a minimum-length boot, so a quick load shows two and the 100% moment is not mid-swap)
  let tipI = 0, tipTimer = null;
  const nextTip = () => {
    tip.classList.add('boot__tip--out');
    setTimeout(() => { tipI = (tipI + 1) % tips.length; tipText.textContent = tips[tipI]; tip.classList.remove('boot__tip--out'); }, dur(BOOT.out) / 2);
  };
  if (tips.length > 1) tipTimer = setTimeout(() => { nextTip(); tipTimer = setInterval(nextTip, BOOT.tip); }, BOOT.minShow / 2);

  let shown = 0, raf = 0, last = 0, alive = true, t0 = performance.now(), source = () => 0, minShow = BOOT.minShow;
  const show = (p) => {
    const q = Math.round(p * 100);
    fill.style.width = `calc((100% - var(--boot-in-l) - var(--boot-in-r)) * ${p.toFixed(4)})`;
    fill.style.opacity = p > 0.004 ? '1' : '0';
    edge.style.left = `calc(var(--boot-in-l) + (100% - var(--boot-in-l) - var(--boot-in-r)) * ${p.toFixed(4)})`;
    if (pct.textContent !== q + '%') { pct.textContent = q + '%'; bar.setAttribute('aria-valuenow', q); }
  };
  const tick = (now) => {
    if (!alive) return;
    const dt = last ? now - last : 0; last = now;
    const target = barTarget(source(), now - t0, minShow);
    shown = reduced() ? target : follow(shown, target, dt, BOOT.follow);
    show(shown); paint(now);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    el,
    get shown() { return shown; },
    // after the save is read: pick this launch's background (docs/19 rotation rules), remember it, crossfade to it when it differs
    chooseBackground(profile, eraId, r = Math.random) {
      const key = pickBootBg({ general: Object.keys(BOOT_BGS.general), era: Object.keys(BOOT_BGS.era), eraId, hasProgress: hasProgress(profile), last: readLast(), r });
      writeLast(key);
      const url = urlFor(key);
      if (!url || !BOOT_BG || url === BOOT_BG.url) return key;
      const im = new Image();
      im.onload = () => {
        if (!alive) return;
        swapLayer.style.background = bootBackground({ url, final: true });
        swapLayer.style.transition = reduced() ? 'none' : `opacity ${dur(D.slow)}ms linear`;
        requestAnimationFrame(() => { swapLayer.style.opacity = '1'; });
      };
      im.src = url;
      return key;
    },
    // legacy: a fixed value (debug pages)
    setProgress(p) { source = () => p; minShow = 0; },
    // runs the loader behind the bar; resolves 'loaded' (all in, bar at 100%) or 'timeout' (BOOT.maxWait passed)
    async run(loader, { min = BOOT.minShow, max = BOOT.maxWait } = {}) {
      source = () => loader.progress(); minShow = min; t0 = performance.now(); loader.start();
      const how = await gate(loader, { minShow: min, maxWait: max, wait });
      if (how === 'loaded') {   // let the bar land on 100% (bounded, in case frames are paused)
        const until = performance.now() + dur(BOOT.out);
        while (shown < 1 && performance.now() < until) await wait(dur(BOOT.out) / 8);
        shown = 1; show(1);
      }
      el.setAttribute('aria-busy', 'false');
      return how;
    },
    destroy() {   // swapScreen adds .leaving (logo scales up, screen fades) and calls this; remove once the fade is done
      clearTimeout(tipTimer); clearInterval(tipTimer);
      setTimeout(() => { alive = false; cancelAnimationFrame(raf); el.remove(); }, dur(BOOT.out));
    }
  };
}
