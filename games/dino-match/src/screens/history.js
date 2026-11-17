import { h } from '../ui/dom.js';
import { Button } from '../ui/components.js';
import { glyph } from '../ui/glyphs.js';
import { buildScript } from '../data/cutscene.js';
import { drawCutscene, loadCutsceneEnv, SIZE } from '../render/cutscene.js';
import { videoUrlFor } from '../render/videos.js';
import { startBed, stopBed, settings as soundSettings } from '../render/sound.js';
import { ERAS } from '../core/eras.js';

// History cutscene for a completed fossil (docs/04, docs/12 M2). Never an ad, always skippable, replayable from the museum.
// It starts from a tap (so sound is allowed), then plays either the rendered mp4 (art/videos/<fossil-id>.mp4) or, when the file
// is missing or fails, the same script drawn live by our canvas renderer with the synthesised music bed.
export function mountHistory(root, { fossil, onDone }) {
  const script = buildScript(fossil), era = ERAS[fossil.eraIndex], url = videoUrlFor(fossil.id);
  const bar = h('div', { class: 'history__bar', role: 'progressbar', 'aria-label': 'Video progress', 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('div', { class: 'history__barfill' }));
  const fill = bar.firstChild;
  const skip = Button({ variant: 'secondary', id: 'skip', onClick: () => finish() }, 'Skip');
  const stage = h('div', { class: 'history__stage' });
  const start = Button({ full: true, id: 'start', onClick: () => begin() }, glyph('video', 20), ' Watch');
  const intro = h('div', { class: 'history__intro' },
    h('p', { class: 'caption history__era' }, `${era.name}, ${fossil.when}`),
    h('h1', { class: 'display' }, fossil.name),
    h('p', { class: 'body dim' }, 'Fossil complete. Watch its story.'),
    start);
  const el = h('main', { class: 'screen history', 'aria-label': `${fossil.name} history` }, stage, bar, intro, h('div', { class: 'history__skip' }, skip));
  root.append(el);
  start.focus({ preventScroll: true });

  let done = false, raf = 0, video = null, env = null;
  const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); stopBed(); video?.pause(); onDone(); };
  const progress = (t) => { const k = Math.min(1, t / script.duration); fill.style.width = `${k * 100}%`; bar.setAttribute('aria-valuenow', String(Math.round(k * 100))); };

  async function begin() {
    intro.hidden = true;
    if (url && (await playVideo())) return;
    await playCanvas();
  }
  function playVideo() {
    return new Promise((resolve) => {
      video = h('video', { class: 'history__video', playsinline: '', preload: 'auto', 'aria-label': `${fossil.name} history video` });
      video.muted = !!soundSettings.muted;
      video.src = url;
      let started = false;
      video.addEventListener('error', () => { if (!started) { video.remove(); video = null; resolve(false); } }, { once: true });
      video.addEventListener('timeupdate', () => progress(video.currentTime), { passive: true });
      video.addEventListener('ended', () => finish());
      stage.append(video);
      video.play().then(() => { started = true; resolve(true); }).catch(() => { video.remove(); video = null; resolve(false); });
    });
  }
  async function playCanvas() {
    const canvas = h('canvas', { class: 'history__canvas', 'aria-hidden': 'true' }), px = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(SIZE.w * px * 1.5); canvas.height = Math.round(SIZE.h * px * 1.5);
    stage.append(canvas);
    const c = canvas.getContext('2d'), k = canvas.width / SIZE.w;
    env = await loadCutsceneEnv(fossil.era);
    startBed(script, fossil);
    const t0 = performance.now();
    const tick = (now) => {
      if (done) return;
      const t = (now - t0) / 1000;
      c.setTransform(k, 0, 0, k, 0, 0);
      drawCutscene(c, env, fossil, Math.min(t, script.duration), SIZE, script); progress(t);
      if (t >= script.duration) return finish();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  return { el, destroy() { done = true; cancelAnimationFrame(raf); stopBed(); video?.pause(); el.remove(); } };
}
