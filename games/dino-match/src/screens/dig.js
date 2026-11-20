import { h } from '../ui/dom.js';
import { Button, Chip, Progress, mmss } from '../ui/components.js';
import { glyph } from '../ui/glyphs.js';
import { CONFIG } from '../core/config.js';
import { ERAS } from '../core/eras.js';
import { FOSSILS, currentFossil, partsUnearthed } from '../core/fossils.js';
import { syncLives, nextLifeIn } from '../core/lives.js';
import { drawFossilArt, partCentre } from '../render/fossilArt.js';
import { aiUrl } from '../ui/kitart.js';
import { RECIPES, EASE, D, dur, sleep, shakeOf } from '../render/motion.js';
import { ParticlePool } from '../render/particles.js';
import { SpriteFx, preloadFx } from '../render/fxArt.js';
import { cue } from '../render/sound.js';
import { plaqueUrl, drawPlaque } from '../render/frame.js';
import { themeFor } from '../render/eraTheme.js';
import { reducedMotion } from '../ui/motion.js';
import { Panel, KButton, Ribbon } from '../ui/kit.js';
import { loadSlab, hasSlab } from '../render/slabart.js';

const CW = 328, CH = 170, PAD = 12;
const ART = { x: PAD + 6, y: PAD + 4, w: CW - PAD * 2 - 12, h: CH - PAD * 2 - 8 };

// Dig site: the current fossil buried part by part. `dig()` spends pickaxes in core (the caller persists) and returns the digPart
// result; this screen only animates it: a pickaxe swing onto the part, the dirt crumbles away with dust, shards and a small shake
// (docs/09 pickaxeSpend), and the bone underneath lights up. While lives are low or empty a banner shows the countdown, so
// the wait is spent digging; Play appears as soon as a life is back.
// yuvi = { enter(dock), strike(), part(), fossil(f) -> promise } (main.js -> ui/helper.js): dig pose while the strikes run, cheer when a part is out,
// cheer then surprised when the fossil is complete (the cutscene waits for him).
export function mountDig(root, { profile, dig, onBack, onComplete, onMuseum, onPlay, now = () => Date.now(), level = 1, yuvi = null }) {
  let current = profile;
  const fossil = () => currentFossil(current);
  const canvas = h('canvas', { width: CW * 2, height: CH * 2, class: 'dig__canvas', role: 'img' });
  const stageEl = h('div', { class: 'dig__stage' }, canvas);
  let box = { x: 0, y: 0, w: CW, h: CH };   // where the slab lands in the stage: full width, or as tall as fits (aspect kept)
  const ctx = canvas.getContext('2d');
  const pickChip = h('span', { id: 'pick-chip' });
  const titleBox = h('div', { class: 'dig__title' });
  const nameEl = h('h1', { class: 'title', id: 'fossil-name' });
  const subEl = h('p', { class: 'caption dim dt-num', id: 'fossil-sub' });
  const partsEl = h('p', { class: 'body-small dt-num dig__parts', id: 'parts' });
  const barWrap = h('div');
  const hint = h('p', { class: 'body-small dim dig__hint', id: 'dig-hint' });
  const digBtn = KButton({ full: true, id: 'dig-btn' });
  const museumBtn = h('button', { type: 'button', class: 'icon-btn dig__museum', id: 'museum-btn', onClick: () => onMuseum?.() }, glyph('museum', 22));
  const wait = h('section', { class: 'dig__wait', id: 'dig-wait', hidden: true, 'aria-live': 'polite' });
  const waitText = h('span', { class: 'body-small' });
  const playBtn = KButton({ id: 'dig-play', onClick: () => onPlay?.() }, `Play level ${level}`);
  wait.append(h('span', { class: 'dig__wait-hearts', 'aria-hidden': 'true' }, glyph('heart', 18)), waitText, playBtn);

  // animation state
  let celebrating = null, revealed = 0, animIdx = -1, animStart = 0, animMs = 0, animRes = null, completedAnim = false, glow = 0, busy = false, swing = null, shake = null, vt = 0, lastT = 0, alive = true;
  const pool = new ParticlePool(), sprites = new SpriteFx(); preloadFx();   // painted chips / sparkle / confetti (render/fxArt.js), particles stay
  let slab = null, slabId = null, W = CW, Hh = CH;
  const loadFor = () => { const f = fossil(); if (!f || f.id === slabId) return; slabId = f.id; loadSlab(f.id).then((sl) => { if (slabId !== f.id) return; slab = sl; el.classList.toggle('dig--slab', !!sl); resize(); }); };
  const resize = () => {
    const k = 2;
    if (slab) {
      W = stageEl.clientWidth || 360; Hh = stageEl.clientHeight || 400; canvas.width = W * k; canvas.height = Hh * k;
      const bw = Math.min(W, Hh / slab.AR); box = { w: bw, h: bw * slab.AR, x: (W - bw) / 2, y: Math.max(0, (Hh - bw * slab.AR) * 0.4) };
    } else { W = CW; Hh = CH; canvas.width = CW * k; canvas.height = CH * k; }
  };

  const syncRevealed = () => { const f = fossil(); revealed = f ? partsUnearthed(current, f.id) : CONFIG.fossils.parts; };
  const refreshWait = () => {
    const t = now(), p = syncLives(current, t), left = nextLifeIn(p, t), max = CONFIG.lives.max;
    wait.hidden = p.lives >= max;
    if (p.lives >= max) return;
    playBtn.hidden = p.lives <= 0;
    waitText.textContent = p.lives <= 0 ? `No lives right now, so dig while you wait. Next life in ${mmss(left ?? 0)}.` : `Lives ${p.lives}/${max}. Next life in ${mmss(left ?? 0)}.`;
  };
  const label = () => {
    const f = fossil(), cost = CONFIG.fossils.pickaxesPerPart, n = current.pickaxes;
    pickChip.replaceChildren(Chip('pick', n, 'Pickaxes', 'chip--pick'));
    museumBtn.setAttribute('aria-label', `Museum, ${current.completedFossils.length} of ${FOSSILS.length} found`);
    if (!f) {
      nameEl.textContent = 'Every fossil found';
      subEl.textContent = `${FOSSILS.length} of ${FOSSILS.length} complete`;
      partsEl.textContent = 'More eras and fossils are coming in later updates.';
      barWrap.replaceChildren(Progress(1));
      digBtn.disabled = true; digBtn.textContent = 'Nothing left to dig';
      hint.textContent = '';
      return;
    }
    const p = partsUnearthed(current, f.id);
    titleBox.style.backgroundImage = `url(${plaqueUrl(f.era, 328, 72)})`;
    nameEl.textContent = f.name;
    subEl.textContent = `${ERAS[f.eraIndex].name}, fossil ${f.index + 1} of ${FOSSILS.length}`;
    partsEl.textContent = `Part ${p} of ${CONFIG.fossils.parts} unearthed`;
    barWrap.replaceChildren(Progress(p / CONFIG.fossils.parts));
    const ok = n >= cost;
    digBtn.disabled = !ok || busy;
    digBtn.replaceChildren(glyph('pick', 20), ` Dig a part (${cost} pickaxes)`);
    hint.textContent = ok ? `You have ${n} pickaxes.` : `You need ${cost - n} more pickaxe${cost - n === 1 ? '' : 's'}. Win a new level to earn 1.`;
  };

  digBtn.addEventListener('click', async () => {
    if (busy) return;
    const r = dig();
    if (!r.ok) return;
    busy = true; digBtn.disabled = true;
    current = r.profile;
    pickChip.replaceChildren(Chip('pick', current.pickaxes, 'Pickaxes', 'chip--pick'));
    yuvi?.strike();
    await reveal(r.part, r.completed, r.fossil);
    busy = false;
    if (r.completed) {
      celebrating = r.fossil; revealed = CONFIG.fossils.parts; partsEl.textContent = `Part ${CONFIG.fossils.parts} of ${CONFIG.fossils.parts} unearthed`; barWrap.replaceChildren(Progress(1));
      const said = yuvi?.fossil(r.fossil);
      await sleep(RECIPES.fossilComplete.dur); if (said) await said;
      if (alive) onComplete(r.fossil);   // (left the dig site meanwhile: the cutscene is in the museum)
      return;
    }
    yuvi?.part();
    syncRevealed(); label();
  });

  // Pickaxe: three strikes onto the part (wind-up, swing, impact: rock chips, dust, crack lines, a small shake; the last strike is
  // the heaviest), then the dirt over the part is brushed away along its stroke and the bone shines. Reduced motion: no swing.
  async function reveal(part, completed, f) {
    const c = slab ? slab.centre(part, box.x, box.y, box.w, box.h) : partCentre(f.shape, part, ART.x, ART.y, ART.w, ART.h), R = RECIPES.pickaxeSpend;
    cue('pickaxeSpend');
    revealed = part;
    if (reducedMotion()) { revealed = part + 1; if (completed) glow = 0.5; return; }
    const STRIKES = 3, per = R.dur * 1.2;
    for (let k = 0; k < STRIKES; k++) {
      swing = { x: c.x, y: c.y, t0: vt, ms: dur(per), heavy: k === STRIKES - 1 };
      await sleep(per);
      const big = k === STRIKES - 1;
      pool.emit('shard', c.x, c.y, '#5A4030', big ? 6 : 3, big ? 3.6 : 2.6); pool.emit('shard', c.x, c.y, '#C8955A', big ? 4 : 2, 3);
      pool.emit('dust', c.x, c.y, slab ? '#D8A25E' : '#9A7A55', big ? 12 : 5, big ? 2 : 1.3);
      sprites.add('chips', c.x, c.y, box.w * (big ? 0.34 : 0.22), vt, { rot: k * 1.3 }); if (big) sprites.add('dust', c.x, c.y, box.w * 0.4, vt);
      addCracks(c.x, c.y, big ? 4 : 2, box.w * (big ? 0.16 : 0.1));
      const sk = shakeOf(R.shake); if (sk) shake = { px: sk.px * (big ? 1 : 0.5), ms: dur(sk.ms) * (big ? 1 : 0.6), t0: vt };
      if (!big) await sleep(D.instant * 0.75);
    }
    swing = null;
    await new Promise((res) => { animIdx = part; animStart = vt; animMs = dur(R.reveal); animRes = res; completedAnim = completed; });
    cracks.length = 0;
    revealed = part + 1;
    if (slab) { pool.emit('sparkle', c.x, c.y, '#FFF1B8', 12, 3.4); sprites.add('sparkle', c.x, c.y, box.w * 0.3, vt); }   // a small shine when the part clears
    if (completed) { cue('fossilComplete'); const F = RECIPES.fossilComplete; sprites.add('confetti', box.x + box.w / 2, box.y + box.h / 2, box.w * 1.1, vt); pool.emit('confetti', box.x + box.w / 2, box.y + box.h / 2, '#FFC24B', 40, 4); pool.emit('sparkle', box.x + box.w / 2, box.y + box.h / 2, '#FFE9A8', 10, 4); const k2 = shakeOf(F.shake); if (k2) shake = { px: k2.px, ms: dur(k2.ms), t0: vt }; }
  }
  // crack lines on the dirt where the pickaxe hits (fade out when the part is brushed away)
  const cracks = [];
  function addCracks(x, y, n, len) {
    for (let i = 0; i < n; i++) { let a = Math.random() * Math.PI * 2, px = x, py = y; const pts = [[px, py]]; for (let k = 0; k < 4; k++) { a += (Math.random() - 0.5) * 0.9; px += Math.cos(a) * len / 4; py += Math.sin(a) * len / 4; pts.push([px, py]); } cracks.push({ pts, t0: vt }); }
  }
  function drawCracks(c) {
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    for (const k of cracks) { const g = Math.min(1, (vt - k.t0) / D.instant); c.beginPath(); k.pts.forEach(([x, y], i) => { const q = k.pts[0]; const X = q[0] + (x - q[0]) * g, Y = q[1] + (y - q[1]) * g; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.strokeStyle = 'rgba(40,22,8,.75)'; c.lineWidth = 2.2; c.stroke(); c.strokeStyle = 'rgba(255,230,180,.35)'; c.lineWidth = 0.8; c.translate(1, 1); c.stroke(); c.translate(-1, -1); }
    c.restore();
  }
  let raf = 0;
  const frame = (now2) => {
    if (!alive) return;
    const dt = Math.min(64, now2 - (lastT || now2)); lastT = now2; vt += dt;
    if (animIdx >= 0 && vt - animStart >= animMs) { const res = animRes; animIdx = -1; animRes = null; if (completedAnim) glow = 1; res(); }
    if (glow > 0.5) glow = Math.max(0.5, glow - dt / (D.celebrate * 2));
    if (slab && animIdx >= 0 && !reducedMotion()) { const q = slab.point(animIdx, Math.min(1, (vt - animStart) / animMs), box.x, box.y, box.w, box.h); pool.emit('dust', q.x, q.y, '#D8A25E', 1, 1.3); }
    pool.step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  };

  function drawSlab(f) {
    const c = ctx, done = !celebrating && !fossil();
    c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, W, Hh);
    c.save();
    if (shake && vt - shake.t0 < shake.ms) { const k = (1 - (vt - shake.t0) / shake.ms) * shake.px; c.translate((Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * 2 * k); } else shake = null;
    slab.draw(c, box.x, box.y, box.w, box.h, { revealed: done ? CONFIG.fossils.parts : revealed, anim: animIdx >= 0 ? { index: animIdx, t: Math.min(1, (vt - animStart) / animMs) } : null, glow });
    drawCracks(c);
    if (swing) drawPick(c, swing, vt);
    pool.draw(c); sprites.draw(c, vt); c.restore();
  }
  function draw() {
    const c = ctx, f = celebrating || fossil() || FOSSILS[FOSSILS.length - 1];
    if (slab) return drawSlab(f);
    if (hasSlab(f.id)) { c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, W, Hh); return; }   // its picture is still loading: no vector flash
    c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, CW, CH);
    c.save();
    if (shake && vt - shake.t0 < shake.ms) { const k = (1 - (vt - shake.t0) / shake.ms) * shake.px; c.translate((Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * 2 * k); } else shake = null;
    // fallback window: warm umber frame with a gold inset line and a sandy dig bed (matches the slab dig site)
    { const g1 = c.createLinearGradient(0, 0, 0, CH); g1.addColorStop(0, '#8A5E30'); g1.addColorStop(1, '#4A2C12');
      c.fillStyle = g1; rr(c, 1, 1, CW - 2, CH - 2, 14); c.fill(); c.strokeStyle = '#E2A83A'; c.lineWidth = 2; rr(c, 4, 4, CW - 8, CH - 8, 11); c.stroke();
      const g2 = c.createRadialGradient(CW / 2, CH * 0.45, 10, CW / 2, CH * 0.45, CW * 0.6); g2.addColorStop(0, '#E3CE9C'); g2.addColorStop(1, '#B99C66');
      c.fillStyle = g2; rr(c, PAD, PAD, CW - PAD * 2, CH - PAD * 2, 8); c.fill(); c.strokeStyle = 'rgba(60,32,8,.55)'; c.lineWidth = 2; c.stroke(); }
    const done = !celebrating && !fossil();
    drawFossilArt(c, f.shape, ART.x, ART.y, ART.w, ART.h, { revealed: done ? 10 : revealed, look: done || celebrating ? 'bone' : 'dig', anim: animIdx >= 0 ? { index: animIdx, t: Math.min(1, (vt - animStart) / animMs) } : null, glow });
    drawCracks(c);
    if (swing) drawPick(c, swing, vt);
    pool.draw(c); sprites.draw(c, vt);
    c.restore();
  }
  // the kit pickaxe picture (art/ui/kit/pickaxe.webp) swung about its handle end; code-drawn pick if the picture is missing
  const pickImg = (() => { const u = aiUrl('pickaxe'); if (!u) return null; const im = new Image(); im.src = u; return im; })();
  function drawPick(c, sw, now2) {
    const t = Math.min(1, (now2 - sw.t0) / sw.ms), S = box.w * (sw.heavy ? 0.36 : 0.32);
    // wind up (lift back) for 45%, then strike (ease in) onto the target
    const strike = -1.39, raised = strike + (sw.heavy ? 1.15 : 0.95), a = t < 0.45 ? strike + (raised - strike) * EASE.out(t / 0.45) * (t < 0.05 ? t / 0.05 : 1) : raised + (strike - raised) * EASE.in((t - 0.45) / 0.55);
    c.save(); c.translate(sw.x + S * 0.5, sw.y + S * 0.5); c.rotate(a);
    if (pickImg && pickImg.complete && pickImg.naturalWidth) { c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 8; c.shadowOffsetY = 4; c.drawImage(pickImg, -0.2 * S, -0.88 * S, S, S); }
    else { c.rotate(0.97); c.strokeStyle = '#7A5A3A'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -S * 0.7); c.stroke(); c.strokeStyle = '#C8CFD8'; c.lineWidth = 6; c.beginPath(); c.moveTo(-S * 0.3, -S * 0.62); c.quadraticCurveTo(0, -S * 0.8, S * 0.3, -S * 0.62); c.stroke(); }
    c.restore();
  }

  syncRevealed(); label(); refreshWait();
  const iv = setInterval(refreshWait, 1000);
  const dock = h('section', { class: 'dig__dock2', 'aria-label': 'Dig' }, nameEl, subEl, h('div', { class: 'dig__progress' }, partsEl, barWrap), digBtn, hint);
  const el = h('main', { class: 'screen dig' },
    h('header', { class: 'dig__top' },
      h('button', { type: 'button', class: 'icon-btn', id: 'back', 'aria-label': 'Back', onClick: onBack }, glyph('back', 22)),
      h('span', { class: 'kit-title heading' }, 'Dig site'),
      h('span', { class: 'dig__topright' }, pickChip, museumBtn)),
    wait,
    stageEl,
    dock);
  root.append(el);
  loadFor(); resize();
  addEventListener('resize', resize);
  raf = requestAnimationFrame(frame);
  requestAnimationFrame(() => { if (alive) yuvi?.enter(dock); });   // Yuvi waits on the work table, above the dock
  return { el, update(p) { current = p; syncRevealed(); label(); refreshWait(); loadFor(); }, destroy() { alive = false; removeEventListener('resize', resize); clearInterval(iv); cancelAnimationFrame(raf); el.remove(); } };
}

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
