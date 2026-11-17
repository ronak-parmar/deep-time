import { h } from '../ui/dom.js';
import { Button, Chip, Progress, mmss } from '../ui/components.js';
import { glyph } from '../ui/glyphs.js';
import { CONFIG } from '../core/config.js';
import { ERAS } from '../core/eras.js';
import { FOSSILS, currentFossil, partsUnearthed } from '../core/fossils.js';
import { syncLives, nextLifeIn } from '../core/lives.js';
import { drawFossilArt, partCentre } from '../render/fossilArt.js';
import { RECIPES, EASE, D, dur, sleep, shakeOf } from '../render/motion.js';
import { ParticlePool } from '../render/particles.js';
import { cue } from '../render/sound.js';
import { plaqueUrl, drawPlaque } from '../render/frame.js';
import { themeFor } from '../render/eraTheme.js';
import { reducedMotion } from '../ui/motion.js';

const CW = 328, CH = 170, PAD = 12;
const ART = { x: PAD + 6, y: PAD + 4, w: CW - PAD * 2 - 12, h: CH - PAD * 2 - 8 };

// Dig site: the current fossil buried part by part. `dig()` spends pickaxes in core (the caller persists) and returns the digPart
// result; this screen only animates it: a pickaxe swing onto the part, the dirt crumbles away with dust, shards and a small shake
// (docs/09 pickaxeSpend), and the bone underneath lights up. While lives are low or empty a banner shows the countdown, so
// the wait is spent digging; Play appears as soon as a life is back.
export function mountDig(root, { profile, dig, onBack, onComplete, onMuseum, onPlay, now = () => Date.now(), level = 1 }) {
  let current = profile;
  const fossil = () => currentFossil(current);
  const canvas = h('canvas', { width: CW * 2, height: CH * 2, class: 'dig__canvas', role: 'img' });
  const ctx = canvas.getContext('2d');
  const pickChip = h('span', { id: 'pick-chip' });
  const titleBox = h('div', { class: 'dig__title' });
  const nameEl = h('h1', { class: 'title', id: 'fossil-name' });
  const subEl = h('p', { class: 'caption dim dt-num', id: 'fossil-sub' });
  const partsEl = h('p', { class: 'body-small dt-num dig__parts', id: 'parts' });
  const barWrap = h('div');
  const hint = h('p', { class: 'body-small dim dig__hint', id: 'dig-hint' });
  const digBtn = Button({ full: true, id: 'dig-btn' });
  const museumBtn = Button({ variant: 'secondary', full: true, id: 'museum-btn', onClick: () => onMuseum?.() });
  const wait = h('section', { class: 'dig__wait', id: 'dig-wait', hidden: true, 'aria-live': 'polite' });
  const waitText = h('span', { class: 'body-small' });
  const playBtn = Button({ id: 'dig-play', onClick: () => onPlay?.() }, `Play level ${level}`);
  wait.append(h('span', { class: 'dig__wait-hearts', 'aria-hidden': 'true' }, glyph('heart', 18)), waitText, playBtn);

  // animation state
  let revealed = 0, animIdx = -1, animStart = 0, animMs = 0, animRes = null, completedAnim = false, glow = 0, busy = false, swing = null, shake = null, vt = 0, lastT = 0, alive = true;
  const pool = new ParticlePool();

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
    museumBtn.replaceChildren(`Museum, ${current.completedFossils.length} of ${FOSSILS.length} found`);
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
    await reveal(r.part, r.completed, r.fossil);
    busy = false;
    syncRevealed(); label();
    if (r.completed) { await sleep(RECIPES.fossilComplete.dur); onComplete(r.fossil); }
  });

  // Pickaxe swing (wind-up, strike) then the dirt over the part crumbles with dust, shards and a small shake, then the bone shines.
  async function reveal(part, completed, f) {
    const c = partCentre(f.shape, part, ART.x, ART.y, ART.w, ART.h), R = RECIPES.pickaxeSpend;
    cue('pickaxeSpend');
    revealed = part;
    if (reducedMotion()) { revealed = part + 1; if (completed) glow = 0.5; return; }
    swing = { x: c.x, y: c.y, t0: vt, ms: dur(R.dur) };
    await sleep(R.dur);
    swing = null;
    pool.emit('dust', c.x, c.y, '#9A7A55', 10, 1.8); pool.emit('shard', c.x, c.y, '#4A3526', 3, 3.2);
    const k = shakeOf(R.shake); if (k) shake = { px: k.px, ms: dur(k.ms), t0: vt };
    await new Promise((res) => { animIdx = part; animStart = vt; animMs = dur(R.reveal); animRes = res; completedAnim = completed; });
    revealed = part + 1;
    if (completed) { cue('fossilComplete'); const F = RECIPES.fossilComplete; pool.emit('confetti', CW / 2, CH / 2, '#FFC24B', 40, 4); pool.emit('sparkle', CW / 2, CH / 2, '#FFE9A8', 10, 4); const k2 = shakeOf(F.shake); if (k2) shake = { px: k2.px, ms: dur(k2.ms), t0: vt }; }
  }

  let raf = 0;
  const frame = (now2) => {
    if (!alive) return;
    const dt = Math.min(64, now2 - (lastT || now2)); lastT = now2; vt += dt;
    if (animIdx >= 0 && vt - animStart >= animMs) { const res = animRes; animIdx = -1; animRes = null; if (completedAnim) glow = 1; res(); }
    if (glow > 0.5) glow = Math.max(0.5, glow - dt / (D.celebrate * 2));
    pool.step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  };

  function draw() {
    const c = ctx, f = fossil() || FOSSILS[FOSSILS.length - 1];
    c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, CW, CH);
    c.save();
    if (shake && vt - shake.t0 < shake.ms) { const k = (1 - (vt - shake.t0) / shake.ms) * shake.px; c.translate((Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * 2 * k); } else shake = null;
    drawPlaque(c, themeFor(f.era), 1, 1, CW - 2, CH - 2);
    c.fillStyle = '#D9C79F'; rr(c, PAD, PAD, CW - PAD * 2, CH - PAD * 2, 8); c.fill();
    const done = !fossil();
    drawFossilArt(c, f.shape, ART.x, ART.y, ART.w, ART.h, { revealed: done ? 10 : revealed, look: done ? 'bone' : 'dig', anim: animIdx >= 0 ? { index: animIdx, t: Math.min(1, (vt - animStart) / animMs) } : null, glow });
    if (swing) drawPick(c, swing, vt);
    pool.draw(c);
    c.restore();
  }
  // pickaxe: lifts back, then strikes down onto the part (ease in), pivoting on the handle end
  function drawPick(c, sw, now2) {
    const t = Math.min(1, (now2 - sw.t0) / sw.ms), a = t < 0.4 ? -0.9 * EASE.out(t / 0.4) : -0.9 + 1.8 * EASE.in((t - 0.4) / 0.6);
    c.save(); c.translate(sw.x + 18, sw.y - 14); c.rotate(a);
    c.strokeStyle = '#7A5A3A'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-22, 26); c.stroke();
    c.strokeStyle = '#C8CFD8'; c.lineWidth = 5; c.beginPath(); c.moveTo(-30, 14); c.quadraticCurveTo(-20, 8, -12, 20); c.stroke();
    c.restore();
  }

  syncRevealed(); label(); refreshWait();
  const iv = setInterval(refreshWait, 1000);
  const el = h('main', { class: 'screen dig' },
    h('header', { class: 'dig__top' },
      h('button', { type: 'button', class: 'icon-btn', id: 'back', 'aria-label': 'Back', onClick: onBack }, glyph('back', 22)),
      h('span', { class: 'heading' }, 'Dig site'),
      pickChip),
    wait,
    (titleBox.append(subEl, nameEl), titleBox),
    canvas,
    h('div', { class: 'dig__progress' }, partsEl, barWrap),
    digBtn, hint, museumBtn);
  root.append(el);
  raf = requestAnimationFrame(frame);
  return { el, update(p) { current = p; syncRevealed(); label(); refreshWait(); }, destroy() { alive = false; clearInterval(iv); cancelAnimationFrame(raf); el.remove(); } };
}

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
