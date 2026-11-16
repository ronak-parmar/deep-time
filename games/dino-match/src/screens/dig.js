import { h } from '../ui/dom.js';
import { Button, Chip, Progress } from '../ui/components.js';
import { glyph } from '../ui/glyphs.js';
import { CONFIG } from '../core/config.js';
import { ERAS } from '../core/eras.js';
import { FOSSILS, currentFossil, partOrder, partsUnearthed } from '../core/fossils.js';
import { drawFossil } from '../render/fossils.js';
import { RECIPES, EASE, D, dur, sleep, shakeOf } from '../render/motion.js';
import { ParticlePool } from '../render/particles.js';
import { cue } from '../render/sound.js';
import { slot, slotsReady, drawSlot } from '../render/art.js';
import { plaqueUrl, drawPlaque } from '../render/frame.js';
import { themeFor } from '../render/eraTheme.js';
import { reducedMotion } from '../ui/motion.js';

const CW = 328, CH = 170, COLS = 5, ROWS = 2, PAD = 12;
const TW = (CW - PAD * 2) / COLS, TH = (CH - PAD * 2) / ROWS;
const tileXY = (i) => ({ x: PAD + (i % COLS) * TW, y: PAD + Math.floor(i / COLS) * TH });

// Dig site: the current fossil as 10 dirt tiles over placeholder art. `dig()` spends pickaxes in core
// (the caller persists) and returns the digPart result; this screen only animates it.
export function mountDig(root, { profile, dig, onBack, onComplete }) {
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
  const foundEl = h('ul', { class: 'dig__found', 'aria-label': 'Fossils found' });

  // animation state
  let alive = new Array(10).fill(true), crumble = {}, glow = 0, anim = true, busy = false, swing = null, shake = null, vt = 0, lastT = 0;
  const pool = new ParticlePool();

  const syncTiles = () => {
    const f = fossil();
    alive = new Array(10).fill(true);
    if (f) partOrder(f.id).slice(0, partsUnearthed(current, f.id)).forEach((t) => { alive[t] = false; });
    if (!f) alive = new Array(10).fill(false);
  };
  const label = () => {
    const f = fossil(), cost = CONFIG.fossils.pickaxesPerPart, n = current.pickaxes;
    pickChip.replaceChildren(Chip('pick', n, 'Pickaxes', 'chip--pick'));
    foundEl.replaceChildren(...current.completedFossils.map((id) => h('li', { class: 'dig__chip caption' }, glyph('check', 14), FOSSILS.find((x) => x.id === id)?.name)));
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
    await reveal(r.tile, r.completed);
    busy = false;
    label();
    if (r.completed) { await wait(RECIPES.fossilComplete.dur); onComplete(r.fossil); }
  });

  const wait = (ms) => sleep(ms);
  // Pickaxe swing (wind-up, strike) then the tile crumbles with dust, shards and a small shake, then the reveal shine.
  async function reveal(tile, completed) {
    const { x, y } = tileXY(tile), R = RECIPES.pickaxeSpend, cx = x + TW / 2, cy = y + TH / 2;
    cue('pickaxeSpend');
    if (reducedMotion()) { alive[tile] = false; if (completed) glow = 0.5; return; }
    swing = { x: cx, y: cy, t0: vt, ms: dur(R.dur) };
    await sleep(R.dur);
    swing = null;
    pool.emit('dust', cx, cy, '#9A7A55', 10, 1.8); pool.emit('shard', cx, cy, '#4A3526', 3, 3.2);
    const k = shakeOf(R.shake); if (k) shake = { px: k.px, ms: dur(k.ms), t0: vt };
    await new Promise((res) => { crumble[tile] = { t0: vt, ms: dur(R.reveal), res, completed }; });
    if (completed) { cue('fossilComplete'); const F = RECIPES.fossilComplete; pool.emit('confetti', CW / 2, CH / 2, '#FFC24B', 40, 4); pool.emit('sparkle', CW / 2, CH / 2, '#FFE9A8', 10, 4); const k2 = shakeOf(F.shake); if (k2) shake = { px: k2.px, ms: dur(k2.ms), t0: vt }; }
  }

  let raf = 0;
  const frame = (now) => {
    if (!anim) return;
    const dt = Math.min(64, now - (lastT || now)); lastT = now; vt += dt;
    for (const k of Object.keys(crumble)) {
      const c = crumble[k], t = Math.min(1, (vt - c.t0) / c.ms);
      c.t = t;
      if (t >= 1) { alive[k] = false; delete crumble[k]; if (c.completed) glow = 1; c.res(); }
    }
    if (glow > 0.5) glow = Math.max(0.5, glow - dt / (D.celebrate * 2));
    pool.step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  };

  function draw() {
    const c = ctx, f = fossil() || currentFossilForDisplay();
    c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, CW, CH);
    c.save();
    if (shake && vt - shake.t0 < shake.ms) { const k = (1 - (vt - shake.t0) / shake.ms) * shake.px; c.translate((Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * 2 * k); } else shake = null;
    drawPlaque(c, themeFor(f ? f.era : 'cambrian'), 1, 1, CW - 2, CH - 2);
    c.fillStyle = '#D9C79F'; rr(c, PAD, PAD, CW - PAD * 2, CH - PAD * 2, 8); c.fill();
    if (slotsReady('tile-cracked')) for (let i = 0; i < 10; i++) { const { x, y } = tileXY(i); drawSlot(c, 'tile-cracked', x, y, TW, TH, i); }   // painted fossil-layer stone
    c.save();
    if (glow) { c.shadowColor = '#FFE9A8'; c.shadowBlur = 28 * glow; }
    if (f) drawFossil(c, f.era, PAD + 6, PAD + 4, CW - PAD * 2 - 12, CH - PAD * 2 - 8);
    c.restore();
    for (let i = 0; i < 10; i++) {
      const cr = crumble[i];
      if (!alive[i] && !cr) continue;
      const s = cr ? 1 - EASE[RECIPES.pickaxeSpend.ease](cr.t || 0) : 1, { x, y } = tileXY(i);
      drawTile(c, x, y, TW, TH, s, cr ? (cr.t || 0) * 0.7 : 0, i);
    }
    if (swing) drawPick(c, swing, vt);
    pool.draw(c);
    c.restore();
  }
  // pickaxe: lifts back, then strikes down onto the tile (ease in), pivoting on the handle end
  function drawPick(c, sw, now) {
    const t = Math.min(1, (now - sw.t0) / sw.ms), a = t < 0.4 ? -0.9 * EASE.out(t / 0.4) : -0.9 + 1.8 * EASE.in((t - 0.4) / 0.6);
    c.save(); c.translate(sw.x + 18, sw.y - 14); c.rotate(a);
    c.strokeStyle = '#7A5A3A'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-22, 26); c.stroke();
    c.strokeStyle = '#C8CFD8'; c.lineWidth = 5; c.beginPath(); c.moveTo(-30, 14); c.quadraticCurveTo(-20, 8, -12, 20); c.stroke();
    c.restore();
  }
  const currentFossilForDisplay = () => FOSSILS[FOSSILS.length - 1];

  syncTiles(); label();
  const el = h('main', { class: 'screen dig' },
    h('header', { class: 'dig__top' },
      h('button', { type: 'button', class: 'icon-btn', id: 'back', 'aria-label': 'Back', onClick: onBack }, glyph('back', 22)),
      h('span', { class: 'heading' }, 'Dig site'),
      pickChip),
    (titleBox.append(subEl, nameEl), titleBox),
    canvas,
    h('div', { class: 'dig__progress' }, partsEl, barWrap),
    digBtn, hint,
    h('div', { class: 'dig__foundwrap' }, h('span', { class: 'caption dim' }, current.completedFossils.length ? 'Fossils found' : 'No fossils found yet'), foundEl));
  root.append(el);
  raf = requestAnimationFrame(frame);
  return { el, destroy() { anim = false; cancelAnimationFrame(raf); el.remove(); } };
}

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function drawTile(c, x, y, w, h, s, rot, i = 0) {
  c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(rot);
  const hw = (w / 2 - 1) * s, hh = (h / 2 - 1) * s;
  if (slot('tile-dirt')) { drawSlot(c, 'tile-dirt', -hw, -hh, hw * 2, hh * 2, i); c.restore(); return; }
  const g = c.createLinearGradient(0, -hh, 0, hh); g.addColorStop(0, '#5A4230'); g.addColorStop(1, '#2F2118');
  rr(c, -hw, -hh, hw * 2, hh * 2, 6); c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = '#1E140D'; c.stroke();
  c.fillStyle = 'rgba(0,0,0,.35)';
  for (const q of [[-0.28, -0.22, 0.07], [0.25, -0.05, 0.06], [-0.08, 0.28, 0.07]]) { c.beginPath(); c.arc(q[0] * hw * 2, q[1] * hh * 2, q[2] * hw * 2, 0, 6.283); c.fill(); }
  c.restore();
}
