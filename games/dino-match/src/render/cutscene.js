// Canvas renderer for the history cutscenes. Everything is a pure function of time t (seconds): the in-game player calls it
// from requestAnimationFrame and tools/render-cutscene steps it frame by frame, so both give the same picture.
// Logical size is 360 x 640 (portrait); the caller scales the context (720 x 1280 for the mp4).
import { buildScript, sceneAt } from '../data/cutscene.js';
import { drawFossilArt, partCentre } from './fossilArt.js';
import { themeFor } from './eraTheme.js';
import { buildScenery, drawSceneryLive } from './scenery.js';
import { loadEra } from './art.js';
import { mix } from './util.js';
import { ERAS } from '../core/eras.js';
import { makeRng, next, hashSeed } from '../core/rng.js';

export const SIZE = { w: 360, h: 640 };
const FONT = 'Nunito, system-ui, sans-serif';
const STAGE = { x: 20, y: 196, w: 320, h: 230 };
const ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const hash = (i, k = 0) => { const r = makeRng(hashSeed(i, k, 91)); return next(r); };

// env = { theme, scene (baked + live scenery), bg (painted image or null) }
export async function loadCutsceneEnv(eraId) {
  const art = await loadEra(eraId).catch(() => null);
  return { theme: themeFor(eraId), scene: buildScenery(eraId), bg: art?.bg || null };
}

export function drawCutscene(c, env, fossil, t, size = SIZE, script = buildScript(fossil)) {
  const { w: W, h: H } = size, S = sceneAt(script, fossil, t), th = env.theme, pal = th.palette, motion = script.motion;
  const era = ERAS[fossil.eraIndex];
  c.save();
  c.clearRect(0, 0, W, H);
  // camera: slow push-in, shake on the finale's last part
  const prog = t / script.duration;
  let sx = 0, sy = 0;
  if (script.finale && S.anim && S.anim.index === script.beats.find((b) => b.kind === 'assemble').parts - 1) { const k = (1 - S.anim.t) * 5; sx = Math.sin(t * 90) * k; sy = Math.cos(t * 77) * k; }
  c.translate(sx, sy);
  background(c, env, W, H, t, prog);
  layers(c, th, W, H, t, motion);
  motes(c, th, W, H, t, motion);
  // spotlight and display slab under the fossil
  spotlight(c, pal, S);
  // fossil
  fossilLayer(c, fossil, script, S, t);
  // title block that glides to the top
  header(c, fossil, era, th, S, W);
  // part pips
  pips(c, th, S, W, fossil.shape.length);
  // captions
  if (S.beat === 'fact') factCard(c, th, S, script, fossil, W);
  if (S.beat === 'outro') outro(c, th, S, fossil, era, W, H);
  // finale confetti while the finished fossil is shown
  if (script.finale && (S.beat === 'hold' || (S.beat === 'fact' && S.beatIndex <= 4))) confetti(c, t, W, H, th);
  // vignette and fades
  c.restore();
  vignette(c, W, H);
  const fadeIn = clamp01(t / 0.6), fadeOut = clamp01((script.duration - t) / 0.7);
  if (fadeIn < 1 || fadeOut < 1) { c.fillStyle = `rgba(4,6,12,${1 - Math.min(fadeIn, fadeOut)})`; c.fillRect(0, 0, W, H); }
  return S;
}

function background(c, env, W, H, t, prog) {
  const zoom = 1.05 + 0.07 * prog, panX = Math.sin(t * 0.18) * 10;
  c.save(); c.translate(W / 2 + panX, H / 2); c.scale(zoom, zoom); c.translate(-W / 2, -H / 2);
  if (env.bg) {
    const iw = env.bg.width, ih = env.bg.height, k = Math.max(W / iw, H / ih);
    c.drawImage(env.bg, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
  } else { c.drawImage(env.scene.image, 0, 0, W, H); drawSceneryLive(c, env.scene, t * 1000, false); }
  c.restore();
  c.fillStyle = 'rgba(5,9,18,.42)'; c.fillRect(0, 0, W, H);
}
// three parallax layers that drift at different speeds: ridges for land, caustic beams and a seabed for water, clouds for air
function layers(c, th, W, H, t, motion) {
  const pal = th.palette;
  if (motion === 'swim') {
    for (let i = 0; i < 4; i++) {
      const x = ((hash(i, 1) * W * 1.4 + t * (6 + i * 3)) % (W * 1.4)) - W * 0.2;
      const g = c.createLinearGradient(x, 0, x + 60, H * 0.7); g.addColorStop(0, 'rgba(190,243,234,.10)'); g.addColorStop(1, 'rgba(190,243,234,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 26, 0); c.lineTo(x + 110, H * 0.7); c.lineTo(x + 60, H * 0.7); c.closePath(); c.fill();
    }
  }
  if (motion === 'fly') {
    for (let i = 0; i < 7; i++) {
      const sp = 8 + (i % 3) * 7, x = ((hash(i, 2) * (W + 160) - t * sp) % (W + 160) + (W + 160)) % (W + 160) - 80, y = 60 + hash(i, 3) * 360, r = 36 + hash(i, 4) * 40;
      c.fillStyle = `rgba(230,236,248,${0.05 + (i % 3) * 0.025})`; c.beginPath(); c.ellipse(x, y, r * 1.8, r * 0.5, 0, 0, 7); c.fill();
    }
    return;
  }
  const specs = [{ y: 486, amp: 16, sp: 5, a: 0.5, col: mix(pal.dark, '#04070e', 0.4), seed: 1 }, { y: 520, amp: 12, sp: 10, a: 0.7, col: mix(pal.dark, '#04070e', 0.55), seed: 2 }, { y: 560, amp: 9, sp: 18, a: 0.9, col: mix(pal.edge, '#04070e', 0.6), seed: 3 }];
  for (const L of specs) {
    c.fillStyle = L.col; c.globalAlpha = L.a; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += 12) { const u = x + t * L.sp; c.lineTo(x, L.y + Math.sin(u * 0.021 + L.seed) * L.amp + Math.sin(u * 0.047 + L.seed * 2) * L.amp * 0.4); }
    c.lineTo(W, H); c.closePath(); c.fill();
  }
  c.globalAlpha = 1;
}
function motes(c, th, W, H, t, motion) {
  const kind = motion === 'swim' ? 'bubble' : th.paint?.ambient?.kind || 'dust', col = th.paint?.ambient?.color || '#F2E6C4';
  c.save();
  for (let i = 0; i < 22; i++) {
    const sp = 6 + hash(i, 5) * 14, x = hash(i, 6) * W + Math.sin(t * 0.6 + i) * 8, y0 = hash(i, 7) * H;
    const y = kind === 'bubble' || kind === 'spore' ? (((y0 - t * sp) % H) + H) % H : (y0 + Math.sin(t * 0.4 + i) * 10), r = 1 + hash(i, 8) * 2.2;
    c.globalAlpha = 0.18 + 0.25 * hash(i, 9);
    if (kind === 'bubble') { c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.arc(x, y, r + 1, 0, 7); c.stroke(); } else { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  }
  c.restore();
}
function spotlight(c, pal, S) {
  const k = S.beat === 'title' ? 0.25 + 0.2 * ease(S.local) : 0.55;
  const g = c.createRadialGradient(STAGE.x + STAGE.w / 2, STAGE.y + STAGE.h / 2, 10, STAGE.x + STAGE.w / 2, STAGE.y + STAGE.h / 2, 210);
  g.addColorStop(0, `rgba(255,240,200,${0.34 * k})`); g.addColorStop(1, 'rgba(255,240,200,0)');
  c.fillStyle = g; c.fillRect(0, STAGE.y - 80, 360, STAGE.h + 160);
  // stone display slab
  const x = STAGE.x + 14, y = STAGE.y + STAGE.h + 2, w = STAGE.w - 28;
  c.fillStyle = 'rgba(8,12,22,.55)'; round(c, x, y, w, 12, 6); c.fill();
  c.fillStyle = mix(pal.base, '#10131a', 0.5); round(c, x + 6, y - 2, w - 12, 8, 4); c.fill();
}
function fossilLayer(c, fossil, script, S, t) {
  const motion = script.motion;
  const alive = S.beat === 'hold' || S.beat === 'fact' || S.beat === 'outro';
  const a = alive ? ease((t - script.beats.find((b) => b.kind === 'hold').t0) / 1.2) : 0;
  let tx = 0, ty = 0, rot = 0, sc = 1;
  const ph = (f) => Math.PI * 2 * t * f;
  if (motion === 'walk') { ty = -Math.abs(Math.sin(ph(1.1))) * 5 * a; rot = Math.sin(ph(1.1)) * 0.012 * a; }
  else if (motion === 'swim') { tx = Math.sin(ph(0.35)) * 14 * a; ty = Math.sin(ph(0.5)) * 8 * a; rot = Math.sin(ph(0.35) + 1) * 0.03 * a; }
  else if (motion === 'fly') { ty = Math.sin(ph(0.6)) * 14 * a; rot = Math.sin(ph(0.6)) * 0.05 * a; tx = Math.sin(ph(0.3)) * 6 * a; }
  else if (motion === 'crawl') { tx = Math.sin(ph(0.5)) * 6 * a; }
  else sc = 1 + Math.sin(ph(0.4)) * 0.012 * a;
  // title: the buried fossil fades in; assemble/after: drawn from parts
  const cx = STAGE.x + STAGE.w / 2, cy = STAGE.y + STAGE.h / 2;
  c.save(); c.translate(cx + tx, cy + ty); c.rotate(rot); c.scale(sc, sc); c.translate(-cx, -cy);
  const buried = S.beat === 'title' || S.beat === 'assemble';
  c.globalAlpha = S.beat === 'title' ? ease(Math.max(0, (S.local - 0.35) / 0.65)) : 1;
  const glow = S.beat === 'hold' ? 1 - S.local * 0.4 : S.beat === 'fact' ? 0.35 : 0;
  drawFossilArt(c, fossil.shape, STAGE.x, STAGE.y, STAGE.w, STAGE.h, { revealed: buried ? S.revealed : 10, anim: S.anim, look: 'dig', glow, margin: 0.04 });
  c.restore();
  // sparkles and dust where a part is unearthed
  if (S.anim) burst(c, fossil, S, script);
  if (S.beat === 'hold') { const k = ease(S.local); drawFossilShine(c, fossil, k); }
}
function drawFossilShine(c, fossil, k) {
  c.save(); c.globalAlpha = (1 - k) * 0.5; c.fillStyle = '#FFF4CC'; c.fillRect(STAGE.x - 20, STAGE.y, 360, STAGE.h); c.restore();
}
function burst(c, fossil, S, script) {
  const p = partCentre(fossil.shape, S.anim.index, STAGE.x, STAGE.y, STAGE.w, STAGE.h), t = S.anim.t, last = S.anim.index === fossil.shape.length - 1, n = last && script.finale ? 26 : 12;
  c.save();
  for (let k = 0; k < n; k++) {
    const ang = (k / n) * Math.PI * 2 + S.anim.index, r = ease(t) * (last && script.finale ? 90 : 42) * (0.6 + hash(k, S.anim.index) * 0.6);
    c.globalAlpha = (1 - t) * 0.9; c.fillStyle = k % 3 === 0 ? '#FFE9A8' : k % 3 === 1 ? '#C9A978' : '#7A5C3C';
    const sz = k % 3 === 0 ? 2.6 : 3.2;
    c.fillRect(p.x + Math.cos(ang) * r - sz / 2, p.y + Math.sin(ang) * r + t * t * 26 - sz / 2, sz, sz);
  }
  if (last && script.finale && t < 0.5) { c.globalAlpha = (0.5 - t); c.fillStyle = '#FFF4CC'; c.fillRect(0, 0, 360, 640); }
  c.restore();
}
function confetti(c, t, W, H, th) {
  const cols = ['#FFC24B', '#6FD3FF', '#FF7A6B', '#9BE37A', '#E8B4FF'];
  c.save();
  for (let i = 0; i < 40; i++) {
    const x = hash(i, 11) * W, sp = 50 + hash(i, 12) * 70, y = ((hash(i, 13) * H + t * sp) % (H + 40)) - 20;
    c.translate(x, y); c.rotate(t * 3 + i); c.fillStyle = cols[i % cols.length]; c.globalAlpha = 0.85; c.fillRect(-3, -1.5, 6, 3); c.rotate(-(t * 3 + i)); c.translate(-x, -y);
  }
  c.restore();
}
function header(c, fossil, era, th, S, W) {
  const pal = th.palette;
  // glide: centred and large during the title, then up to the top
  const k = S.beat === 'title' ? ease((S.local - 0.55) / 0.45) : 1, alpha = S.beat === 'title' ? ease(S.local / 0.35) : 1;
  const y = 300 + (74 - 300) * k, sc = 1.35 + (1 - 1.35) * k;
  c.save(); c.globalAlpha = alpha; c.translate(W / 2, y); c.scale(sc, sc); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.fillStyle = pal.accent2; c.font = `800 11px ${FONT}`; spaced(c, era.name.toUpperCase(), 0, -22, 2.2);
  c.fillStyle = 'rgba(235,240,250,.78)'; c.font = `600 12px ${FONT}`; c.fillText(fossil.when, 0, -6);
  c.fillStyle = '#FFF8E2'; c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 8; c.font = `900 ${fitFont(c, fossil.name, 320, 34, 20, 900)}px ${FONT}`; c.fillText(fossil.name, 0, 28);
  c.shadowBlur = 0; c.fillStyle = 'rgba(235,240,250,.7)'; c.font = `italic 600 13px ${FONT}`; c.fillText(fossil.sci, 0, 48);
  c.restore();
}
function pips(c, th, S, W, n) {
  const asm = S.beat === 'title' ? -1 : S.revealed + (S.anim ? S.anim.t : 0);
  if (S.beat !== 'assemble' && S.beat !== 'title') return;
  const gap = 18, x0 = W / 2 - ((n - 1) * gap) / 2;
  c.save(); c.globalAlpha = S.beat === 'title' ? ease(S.local) * 0.6 : 0.95;
  for (let i = 0; i < n; i++) { c.fillStyle = i < asm ? th.palette.accent2 : 'rgba(255,255,255,.22)'; c.beginPath(); c.arc(x0 + i * gap, 468, 4, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(235,240,250,.8)'; c.font = `700 12px ${FONT}`; c.textAlign = 'center'; c.fillText(S.beat === 'title' ? 'Buried for millions of years' : `Unearthing part ${Math.min(n, S.revealed + 1)} of ${n}`, W / 2, 494); c.restore();
}
function factCard(c, th, S, script, fossil, W) {
  const pal = th.palette, fade = Math.min(ease(S.local / 0.12), ease((1 - S.local) / 0.1)), n = fossil.facts.length;
  const y = 456 + (1 - ease(S.local / 0.12)) * 14, x = 20, w = 320;
  c.save(); c.globalAlpha = fade;
  c.font = `700 17px ${FONT}`;
  const lines = wrap(c, S.fact, w - 40), h = 50 + lines.length * 23;
  c.fillStyle = 'rgba(9,14,26,.86)'; round(c, x, y, w, h, 18); c.fill(); c.strokeStyle = pal.accent; c.lineWidth = 2; c.stroke();
  c.fillStyle = pal.accent2; c.font = `800 11px ${FONT}`; c.textAlign = 'left'; spaced(c, `DID YOU KNOW  ${S.beatIndex - script.beats.findIndex((b) => b.kind === 'fact') + 1}/${n}`, x + 20, y + 26, 1.6);
  c.fillStyle = '#F4F7FC'; c.font = `700 17px ${FONT}`;
  lines.forEach((l, i) => c.fillText(l, x + 20, y + 54 + i * 23));
  c.restore();
}
function outro(c, th, S, fossil, era, W, H) {
  const pal = th.palette, k = ease(S.local / 0.25), y = 470;
  c.save(); c.globalAlpha = k; c.textAlign = 'center';
  c.fillStyle = 'rgba(9,14,26,.86)'; round(c, 40, y - 30, 280, 92, 18); c.fill(); c.strokeStyle = pal.accent; c.lineWidth = 2; c.stroke();
  c.fillStyle = '#9BE37A'; c.font = `900 26px ${FONT}`; c.fillText('✓', W / 2, y + 2);
  c.fillStyle = '#FFF8E2'; c.font = `900 19px ${FONT}`; c.fillText('Added to your museum', W / 2, y + 30);
  c.fillStyle = 'rgba(235,240,250,.75)'; c.font = `600 12px ${FONT}`; c.fillText(`${fossil.name}, ${era.name}`, W / 2, y + 50);
  c.restore();
}
function vignette(c, W, H) {
  const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.78); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}
function round(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function wrap(c, text, maxW) {
  const words = text.split(' '), lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines;
}
function fitFont(c, text, maxW, max, min, weight) {
  for (let s = max; s > min; s--) { c.font = `${weight} ${s}px ${FONT}`; if (c.measureText(text).width <= maxW) return s; }
  return min;
}
function spaced(c, text, x, y, gap) {   // letter-spaced text, centred when textAlign is centre
  const w = [...text].reduce((a, ch) => a + c.measureText(ch).width + gap, -gap), al = c.textAlign; let cx = al === 'center' ? x - w / 2 : x;
  c.textAlign = 'left'; for (const ch of text) { c.fillText(ch, cx, y); cx += c.measureText(ch).width + gap; } c.textAlign = al;
}
