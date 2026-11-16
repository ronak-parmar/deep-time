import { ERAS } from '../core/eras.js';
import { buildScenery, drawSceneryLive } from './scenery.js';
import { loadEraSprites, spriteFor } from './atlas.js';
import { drawGemShape, GEM_COLORS } from './gems.js';
import { drawFossil } from './fossils.js';
import { reducedMotion } from '../ui/motion.js';
import { eraPalette } from '../ui/tokens.js';
import { themeFor } from './eraTheme.js';
import { buildFrame, drawPlaque, drawHudPlate, drawAmbient, ringPath, FRAME_T, FRAME_M } from './frame.js';
import { rgba } from './util.js';
import { D, STAGGER, SQUASH, SHAKE, FALL, HOLD, HINT_AFTER, LOOP, EASE, RECIPES, dur, shakeOf, fallSquash, DEBUG } from './motion.js';
import { ParticlePool } from './particles.js';
import { cue, unlock } from './sound.js';
import { loadEra, preloadUi, slot, slotsReady, drawSlot } from './art.js';
import { drawBackdrop, drawHud, hudPainted, drawBoosters, boostersPainted } from './paint.js';
import { CONFIG } from '../core/config.js';

const W = 360, H = 640, TEXTS = 8;
const FONTS = {};
const font = (s) => FONTS[s] || (FONTS[s] = `800 ${s}px Nunito, system-ui, sans-serif`);

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.scale = 1;
    this.tweens = []; this.pool = new ParticlePool();
    this.texts = Array.from({ length: TEXTS }, () => ({ on: false, x: 0, y: 0, s: 18, c: '#fff', t: '', age: 0, life: 0 }));
    this.shakeAmp = 0; this.shakeEnd = 0; this.flash = 0; this.glow = 0;
    this.banner = { on: false, t: '', a: 0, y: 0, s: 1, c: '#FFC24B' };
    this.scenery = null; this.art = null; this.eraId = null; this.state = null; this.locked = true; this.skip = false; this.celebrating = false;
    this.sel = null; this.selT0 = 0; this.drag = null; this.h0 = -1; this.h1 = -1; this.hasHint = false;
    this.vnow = 0; this.last = 0; this.lastInput = 0; this.active = 0;
    this.onSwap = null; this.getHint = null; this.perf = null;
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', () => { this.drag = null; });
    canvas.addEventListener('pointercancel', () => { this.drag = null; });
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---- setup -------------------------------------------------------------------------
  resize(cssScale) {
    this.scale = cssScale * (window.devicePixelRatio || 1);
    this.canvas.width = Math.round(W * this.scale); this.canvas.height = Math.round(H * this.scale);
  }
  async setEra(eraId) {
    this.eraId = eraId; this.scenery = buildScenery(eraId); this.palette = eraPalette(eraId);
    this.theme = themeFor(eraId); this.frameKey = null;
    await preloadUi(); this.art = await loadEra(eraId);    // painted layers, or null = vector fallback
    await loadEraSprites(eraId);
  }
  startLevel(state) {
    this.state = state;
    const { w } = state;
    this.cs = Math.min(50, Math.floor(320 / w));
    const n = state.dirtTotal, rows = n <= 6 ? 1 : n <= 12 ? 2 : 3, cols = Math.ceil(n / rows);
    this.bs = Math.min(46, Math.floor(300 / cols), Math.floor(112 / rows));
    this.rows = rows; this.cols = cols;
    this.panel = { x: (W - cols * this.bs) / 2 - 12, y: 92, w: cols * this.bs + 24, h: rows * this.bs + 20 };
    this.blockPos = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), inRow = r === rows - 1 ? n - r * cols : cols;
      const x0 = this.panel.x + 12 + ((cols - inRow) * this.bs) / 2;
      this.blockPos.push({ x: x0 + (i - r * cols) * this.bs, y: this.panel.y + 10 + r * this.bs });
    }
    this.blocks = this.blockPos.map(() => ({ s: 1, rot: 0, alive: true }));
    for (const b of state.dirtOrder.slice(0, state.dug)) this.blocks[b].alive = false;
    this.boardX = (W - w * this.cs) / 2; this.boardY = this.panel.y + this.panel.h + 14;
    this.glow = 0; this.flash = 0; this.sel = null; this.hasHint = false; this.banner.on = false; this.skip = false;
    this.pool.clear(); this.tweens.length = 0; this.pieces = new Map();
    this.grid = state.cells.map((p, i) => this.makePiece(p, i));
    this.lastInput = this.vnow;
  }
  clearLevel() { this.state = null; this.locked = true; }
  cx(i) { return this.boardX + (i % this.state.w) * this.cs + this.cs / 2; }
  cy(i) { return this.boardY + Math.floor(i / this.state.w) * this.cs + this.cs / 2; }
  makePiece(p, i, fromY) {
    const piece = { id: p.id, c: p.c, x: this.cx(i), y: fromY ?? this.cy(i), s: 1, sx: 1, sy: 1, a: 1 };
    this.pieces.set(p.id, piece); return piece;
  }
  sync() {
    this.grid = this.state.cells.map((p, i) => { const o = this.pieces.get(p.id) || this.makePiece(p, i); o.x = this.cx(i); o.y = this.cy(i); o.s = 1; o.sx = 1; o.sy = 1; o.a = 1; return o; });
    const live = new Set(this.state.cells.map((p) => p.id));
    for (const id of this.pieces.keys()) if (!live.has(id)) this.pieces.delete(id);
  }

  // ---- tween + fx --------------------------------------------------------------------
  // fn(t) with t in 0..1 over dur(ms). skippable tweens end early when the player taps.
  tween(ms, fn, skippable = false) {
    return new Promise((res) => this.tweens.push({ ms: dur(ms), fn, start: -1, res, skippable }));
  }
  wait(ms, skippable = false) { return this.tween(ms, null, skippable); }
  doShake(kind) { const k = shakeOf(kind); if (!k) return; this.shakeAmp = Math.max(this.shakeAmp, k.px); this.shakeEnd = this.vnow + k.ms; this.shakeStart = this.vnow; this.shakeLen = k.ms; }
  text(t, x, y, color, size, life = D.slow * 2) {
    for (const o of this.texts) if (!o.on) { o.on = true; o.t = t; o.x = x; o.y = y; o.c = color; o.s = size; o.age = 0; o.life = dur(life); return; }
  }
  sparks(x, y, color, n = 8) { this.pool.emit('sparkle', x, y, color, n, 2.6); }

  // ---- input -------------------------------------------------------------------------
  pt(e) { const r = this.canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height }; }
  cellAt(p) {
    if (!this.state) return -1;
    const x = Math.floor((p.x - this.boardX) / this.cs), y = Math.floor((p.y - this.boardY) / this.cs);
    return x < 0 || y < 0 || x >= this.state.w || y >= this.state.h ? -1 : y * this.state.w + x;
  }
  down(e) {
    unlock(); this.lastInput = this.vnow; this.hasHint = false;
    if (this.celebrating) this.skip = true;
    if (this.locked || !this.state) return;
    const p = this.pt(e), i = this.cellAt(p);
    if (i < 0) { this.sel = null; return; }
    const { w } = this.state;
    if (this.sel !== null && this.sel !== i) {
      const dx = Math.abs((this.sel % w) - (i % w)), dy = Math.abs(Math.floor(this.sel / w) - Math.floor(i / w));
      if (dx + dy === 1) { const a = this.sel; this.sel = null; this.onSwap?.(a, i); return; }
    }
    this.sel = this.sel === i ? null : i; if (this.sel !== null) { this.selT0 = this.vnow; cue('tapGem'); }
    this.drag = { i, x: p.x, y: p.y };
    this.canvas.setPointerCapture?.(e.pointerId);
  }
  move(e) {
    if (!this.drag || this.locked) return;
    const p = this.pt(e), dx = p.x - this.drag.x, dy = p.y - this.drag.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < this.cs * 0.3) return;
    const { w, h } = this.state, i = this.drag.i, x = i % w, y = Math.floor(i / w), horiz = Math.abs(dx) > Math.abs(dy);
    const nx = x + (horiz ? Math.sign(dx) : 0), ny = y + (horiz ? 0 : Math.sign(dy));
    this.drag = null; this.sel = null;
    if (nx >= 0 && ny >= 0 && nx < w && ny < h) this.onSwap?.(i, ny * w + nx);
  }

  // ---- replaying the core's event log (section 4 recipes) ----------------------------------------
  async play(events, hooks = {}) {
    this.active++; this.locked = true; this.sel = null;
    const pending = []; let status = 'playing';
    for (const ev of events) {
      if (ev.t === 'swap') await this.animSwap(ev, hooks);
      else if (ev.t === 'clear') await this.animClear(ev, hooks);
      else if (ev.t === 'dig') pending.push(this.animDig(ev, hooks, ev.dug >= ev.total));
      else if (ev.t === 'fall') await this.animFall(ev);
      else if (ev.t === 'shuffle') await this.animShuffle(ev);
      else if (ev.t === 'end') { status = ev.status; await Promise.all(pending); await this.animEnd(ev); }
    }
    await Promise.all(pending);
    this.active--; if (!this.active) this.sync();
    this.lastInput = this.vnow;
    if (status === 'playing' && !this.active) this.locked = false;   // input back the moment the logic allows
  }

  async animSwap(ev, hooks) {
    const A = this.grid[ev.a], B = this.grid[ev.b], ax = A.x, ay = A.y, bx = B.x, by = B.y, R = RECIPES.swapValid;
    cue(ev.ok ? 'swapValid' : 'swapInvalid');
    await this.tween(R.dur, (t) => { const e = EASE[R.ease](t); A.x = ax + (bx - ax) * e; A.y = ay + (by - ay) * e; B.x = bx + (ax - bx) * e; B.y = by + (ay - by) * e; });
    if (ev.ok) { this.grid[ev.a] = B; this.grid[ev.b] = A; hooks.onMove?.(); return; }
    this.doShake(RECIPES.swapInvalid.shake);
    await this.tween(RECIPES.swapInvalid.dur, (t) => { const e = EASE.out(t); A.x = bx + (ax - bx) * e; A.y = by + (ay - by) * e; B.x = ax + (bx - ax) * e; B.y = ay + (by - ay) * e; });
  }

  async animClear(ev, hooks) {
    const R = RECIPES.matchClear, n = ev.cells.length;
    const items = ev.cells.map((c) => this.pieces.get(c.id));
    let sx = 0, sy = 0;
    ev.cells.forEach((c, k) => { const p = items[k]; this.sparks(p.x, p.y, GEM_COLORS[c.c], 8); sx += p.x; sy += p.y; });
    cue(ev.step > 1 ? 'cascadeStep' : 'matchClear', { step: ev.step, size: n });
    this.text('+' + ev.score, sx / n, sy / n, '#FFC24B', 18 + Math.min(ev.step, 4) * 3);
    if (ev.step >= RECIPES.cascadeStep.comboFrom) this.text('Combo x' + ev.step, W / 2, this.boardY + 16, '#6FD3FF', 20 + Math.min(ev.step, 5) * 4, D.slow * 3);
    if (ev.step >= 3 || n >= 5) this.doShake('medium');
    hooks.onScore?.(ev.score);
    await this.tween(R.dur, (t) => {
      const s = t < 0.3 ? 1 + (SQUASH.pop - 1) * EASE.out(t / 0.3) : SQUASH.pop * (1 - EASE[R.ease === 'pop' ? 'in' : R.ease]((t - 0.3) / 0.7));
      for (let k = 0; k < items.length; k++) items[k].s = s;
    });
    for (const p of items) { const gi = this.grid.indexOf(p); if (gi >= 0) this.grid[gi] = null; this.pieces.delete(p.id); }
  }

  async animFall(ev) {
    const jobs = [], R = RECIPES.fallRefill, cs = this.cs;
    for (const m of ev.moves) { const p = this.pieces.get(m.id), gi = this.grid.indexOf(p); if (gi >= 0) this.grid[gi] = null; jobs.push({ p, to: m.to, sy: p.y, ty: 0, delay: 0, d: 0 }); }
    for (const s of ev.spawns) { const p = this.makePiece({ id: s.id, c: s.c }, s.to, this.boardY + (s.fromRow - 0.5) * cs); jobs.push({ p, to: s.to, sy: p.y, ty: 0, delay: 0, d: 0 }); }
    // stagger within a column, lowest piece first
    const w = this.state.w; jobs.sort((a, b) => b.to - a.to);
    const rank = new Array(w).fill(0); let total = 0;
    for (const j of jobs) {
      this.grid[j.to] = j.p; j.ty = this.cy(j.to);
      const cells = (j.ty - j.sy) / cs;
      j.d = D.quick + (R.dur - D.quick) * Math.min(1, cells / FALL.maxCells);
      j.delay = rank[j.to % w]++ * R.stagger;
      total = Math.max(total, j.delay + j.d);
    }
    if (jobs.length) cue('fallRefill');
    const tot = dur(total), k = tot / total;
    await this.tween(total, (t) => {
      const el = t * tot;
      for (let i = 0; i < jobs.length; i++) {
        const j = jobs[i], u = Math.min(1, Math.max(0, (el - j.delay * k) / (j.d * k)));
        j.p.y = j.sy + (j.ty - j.sy) * EASE.fall(u);
        const q = fallSquash(u); j.p.sx = 1 + (R.squash[0] - 1) * q; j.p.sy = 1 - (1 - R.squash[1]) * q;
      }
    });
    for (const j of jobs) { j.p.y = j.ty; j.p.x = this.cx(j.to); j.p.sx = 1; j.p.sy = 1; }
  }

  async animShuffle(ev) {
    this.text('No moves left. Shuffling', W / 2, this.boardY + (this.state.h * this.cs) / 2, '#F2F8FF', 20);
    if (ev.fresh) return;
    const next = new Array(this.grid.length);
    const jobs = ev.moves.map((m) => { const p = this.pieces.get(m.id); next[m.to] = p; return { p, sx: p.x, sy: p.y, to: m.to }; });
    await this.tween(D.slow, (t) => { const e = EASE.out(t); for (const j of jobs) { j.p.x = j.sx + (this.cx(j.to) - j.sx) * e; j.p.y = j.sy + (this.cy(j.to) - j.sy) * e; } });
    this.grid = next;
  }

  // dirt block: 3 shards + dust + small shake. The last block adds the section 4 "last block" beat.
  async animDig(ev, hooks) {
    const R = RECIPES.digBlock;
    for (let k = 0; k < ev.blocks.length; k++) {
      const b = this.blocks[ev.blocks[k]], pos = this.blockPos[ev.blocks[k]], x = pos.x + this.bs / 2, y = pos.y + this.bs / 2;
      cue('digBlock');
      this.pool.emit('dust', x, y, '#9A7A55', 10, 1.8); this.pool.emit('shard', x, y, '#4A3526', R.shards, 3.2); this.pool.emit('shard', x, y, '#6B4A2F', 2, 2.6);
      this.doShake(R.shake); hooks.onDig?.(ev.dug, ev.total);
      await this.tween(R.dur, (t) => { b.s = 1 - EASE[R.ease](t); b.rot = t * 0.7; });
      b.alive = false; b.s = 0;
    }
  }

  async animEnd(ev) {
    const P = this.panel, cx = W / 2, B = this.banner;
    if (ev.status === 'won') {
      const L = RECIPES.lastBlock, F = RECIPES.foundBanner;
      this.celebrating = true; this.skip = false;
      await this.wait(L.hold);                                   // short hold on the last crumble
      cue('lastBlock'); this.doShake(L.shake);
      this.pool.emit('sparkle', cx, P.y + P.h / 2, '#FFE9A8', 10, 4); this.pool.emit('sparkle', cx, P.y + P.h / 2, '#FFC24B', 10, 5);
      const flash = this.tween(L.flash, (t) => { this.flash = 0.55 * (1 - EASE.out(t)); });
      const glow = this.tween(L.dur, (t) => { this.glow = EASE.out(t); });
      await Promise.all([flash, glow]); this.flash = 0;
      cue('foundBanner');
      { const C = RECIPES.fossilComplete; this.pool.emit('confetti', cx, this.boardY, '#FFC24B', 30, 4); this.pool.emit('confetti', cx, this.boardY, '#6FD3FF', 20, 4); this.doShake(C.shake); }
      B.on = true; B.t = 'Fossil found!'; B.c = '#FFC24B';
      const lift = reducedMotion() ? 0 : -48;
      await this.tween(F.dur, (t) => { const e = EASE[F.ease](t); B.a = Math.min(1, t * 3); B.y = lift * (1 - e); B.s = reducedMotion() ? 1 : 0.6 + 0.4 * e; }, true);
      await this.wait(F.hold, true);
      await this.tween(F.leave, (t) => { B.a = 1 - EASE[F.leaveEase](t); }, true);
      B.on = false; this.glow = 0.4; this.celebrating = false;
    } else if (ev.status === 'lost') {
      const R = RECIPES.loseScreen; B.on = true; B.t = 'Out of moves'; B.c = '#F2F8FF'; B.y = 0; B.s = 1;
      await this.tween(R.dur, (t) => { B.a = EASE.out(t); });
      await this.wait(D.slow); B.on = false;
    }
  }

  // ---- frame -------------------------------------------------------------------------
  frame(now) {
    const dt = Math.min(64, now - (this.last || now)); this.last = now;
    this.vnow += dt * DEBUG.timeScale;
    const t0 = this.perf ? performance.now() : 0;
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      if (tw.start < 0) tw.start = this.vnow;
      let t = tw.ms <= 0 ? 1 : Math.min(1, (this.vnow - tw.start) / tw.ms);
      if (tw.skippable && this.skip) t = 1;
      tw.fn?.(t);
      if (t >= 1) { this.tweens.splice(i, 1); tw.res(); }
    }
    this.pool.step(dt);
    for (const o of this.texts) if (o.on) { o.age += dt * DEBUG.timeScale; if (o.age >= o.life) o.on = false; }
    this.draw(this.vnow);
    if (this.perf) { const d = performance.now() - t0; this.perf.n++; this.perf.sum += d; if (d > this.perf.max) this.perf.max = d; this.perf.dt += dt; if (dt > 20) this.perf.slow++; }
    requestAnimationFrame((t) => this.frame(t));
  }

  draw(now) {
    const c = this.ctx;
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0); c.clearRect(0, 0, W, H);
    if (this.art) { drawBackdrop(c, this.art, this.theme, now, reducedMotion()); if (!reducedMotion() && this.theme.paint?.ambient) drawAmbient(c, { ...this.theme, ambient: this.theme.paint.ambient }, { x: 0, y: 0, w: W, h: H }, now); }
    else if (this.scenery) { c.drawImage(this.scenery.image, 0, 0, W, H); drawSceneryLive(c, this.scenery, now, reducedMotion()); }
    if (!this.state) return;
    if (hudPainted()) drawHud(c); else drawHudPlate(c, this.theme);
    document.body.classList.toggle('has-hud-art', hudPainted()); document.body.classList.toggle('has-booster-art', boostersPainted());
    c.save();
    if (this.shakeAmp && now < this.shakeEnd) { const k = (this.shakeEnd - now) / this.shakeLen * this.shakeAmp; c.translate((Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * 2 * k); } else this.shakeAmp = 0;
    this.drawPanel(c); this.drawBoard(c, now);
    this.pool.draw(c);
    this.drawTexts(c);
    if (boostersPainted()) drawBoosters(c, this.boosterCounts || CONFIG.boosters.start, CONFIG.boosters.enabled, (cc, t, x, y, sz) => this.label(cc, t, x, y, sz));
    c.restore();
    if (this.banner.on) this.drawBanner(c);
    if (this.flash > 0.01) { c.fillStyle = `rgba(255,244,214,${this.flash})`; c.fillRect(0, 0, W, H); }
  }

  label(c, t, x, y, size, fill = '#F2F8FF') {
    c.font = font(size); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.lineWidth = Math.max(3, size / 5); c.strokeStyle = 'rgba(8,14,26,.85)'; c.strokeText(t, x, y); c.fillStyle = fill; c.fillText(t, x, y);
  }
  rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  drawTexts(c) {
    for (const o of this.texts) {
      if (!o.on) continue;
      const k = o.age / o.life, pop = Math.min(1, o.age / dur(D.quick)), s = reducedMotion() ? 1 : 0.5 + 0.5 * EASE.pop(pop);
      c.globalAlpha = Math.max(0, Math.min(1, (1 - k) * 2));
      c.save(); c.translate(o.x, o.y - (reducedMotion() ? 0 : k * 26)); c.scale(s, s); this.label(c, o.t, 0, 0, o.s, o.c); c.restore();
    }
    c.globalAlpha = 1;
  }
  drawBanner(c) {
    const B = this.banner, y = this.boardY + (this.state.h * this.cs) / 2;
    c.save(); c.globalAlpha = Math.max(0, B.a); c.translate(W / 2, y + B.y); c.scale(B.s, B.s); this.label(c, B.t, 0, 0, 40, B.c); c.restore(); c.globalAlpha = 1;
  }

  drawPanel(c) {
    const era = ERAS.find((e) => e.id === this.eraId), P = this.panel;
    this.label(c, 'Dig up: ' + era.fossil, W / 2, 76, 14, '#E8D3A0');
    if (!drawSlot(c, 'hud-plaque', P.x, P.y, P.w, P.h)) drawPlaque(c, this.theme, P.x, P.y, P.w, P.h);
    c.save(); c.beginPath(); for (const p of this.blockPos) c.rect(p.x, p.y, this.bs, this.bs); c.clip();
    c.fillStyle = '#D9C79F'; c.fillRect(P.x, P.y, P.w, P.h);
    if (this.glow) { c.shadowColor = '#FFE9A8'; c.shadowBlur = 30 * this.glow; }
    drawFossil(c, this.eraId, P.x + 6, P.y + 4, P.w - 12, P.h - 8);
    c.restore();
    for (let i = 0; i < this.blocks.length; i++) { const b = this.blocks[i]; if (b.alive && b.s > 0) this.drawDirt(c, this.blockPos[i], b, i); }
  }
  drawDirt(c, pos, b, i = 0) {
    const h = (this.bs / 2 - 1) * b.s;
    if (slot('tile-dirt')) { c.save(); c.translate(pos.x + this.bs / 2, pos.y + this.bs / 2); c.rotate(b.rot); drawSlot(c, 'tile-dirt', -h, -h, h * 2, h * 2, i); c.restore(); return; }
    c.save(); c.translate(pos.x + this.bs / 2, pos.y + this.bs / 2); c.rotate(b.rot);
    const g = c.createLinearGradient(0, -h, 0, h); g.addColorStop(0, '#5A4230'); g.addColorStop(1, '#2F2118');
    this.rr(c, -h, -h, h * 2, h * 2, 6); c.fillStyle = g; c.fill(); c.lineWidth = 2; c.strokeStyle = '#1E140D'; c.stroke();
    c.fillStyle = 'rgba(0,0,0,.35)';
    for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(DIRT_DOTS[k][0] * h * 2, DIRT_DOTS[k][1] * h * 2, DIRT_DOTS[k][2] * h * 2, 0, 6.283); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.09)'; this.rr(c, -h + 3, -h + 3, h * 2 - 6, 4, 2); c.fill();
    c.restore();
  }

  drawBoard(c, now) {
    const { w, h } = this.state, cs = this.cs, x0 = this.boardX, y0 = this.boardY;
    const fx = x0 - FRAME_T - 2, fy = y0 - FRAME_T - 2, fw = w * cs + 2 * FRAME_T + 4, fh = h * cs + 2 * FRAME_T + 4;
    const tiles = slotsReady('tile-cream');
    if (tiles) { c.fillStyle = 'rgba(38,26,16,.9)'; this.rr(c, x0 - 6, y0 - 6, w * cs + 12, h * cs + 12, 10); c.fill(); c.strokeStyle = 'rgba(214,190,140,.55)'; c.lineWidth = 2; c.stroke(); }
    else { c.fillStyle = rgba(this.theme.interior, 0.82); this.rr(c, x0 - 2, y0 - 2, w * cs + 4, h * cs + 4, 6); c.fill(); }
    for (let i = 0; i < w * h; i++) {
      if (tiles) { drawSlot(c, 'tile-cream', x0 + (i % w) * cs, y0 + Math.floor(i / w) * cs, cs, cs, (i * 7 + Math.floor(i / w)) % 4); continue; }
      c.fillStyle = ((i % w) + Math.floor(i / w)) % 2 ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.09)';
      this.rr(c, x0 + (i % w) * cs + 2, y0 + Math.floor(i / w) * cs + 2, cs - 4, cs - 4, 8); c.fill();
    }
    if (this.sel !== null) { c.strokeStyle = '#FFC24B'; c.lineWidth = 3; this.rr(c, x0 + (this.sel % w) * cs + 2, y0 + Math.floor(this.sel / w) * cs + 2, cs - 4, cs - 4, 8); c.stroke(); }
    c.save(); c.beginPath(); c.rect(x0 - 4, y0 - 4, w * cs + 8, h * cs + 8); c.clip();
    if (!this.locked && !this.hasHint && now - this.lastInput > HINT_AFTER && this.getHint) { const hm = this.getHint(); if (hm) { this.h0 = hm[0]; this.h1 = hm[1]; this.hasHint = true; } }
    const pulse = this.hasHint && !reducedMotion() ? 1 + (SQUASH.tapScale - 1) * Math.sin(now / LOOP.hint) : 1;
    const selK = this.sel !== null ? 1 + (SQUASH.tapScale - 1) * EASE.out(Math.min(1, (now - this.selT0) / dur(RECIPES.tapGem.dur))) : 1;
    for (let i = 0; i < this.grid.length; i++) {
      const p = this.grid[i]; if (!p) continue;
      const hi = this.hasHint && (i === this.h0 || i === this.h1);
      this.drawGem(c, p, (this.sel === i ? selK : 1) * (hi ? pulse : 1), hi);
    }
    c.restore();
    if (tiles) return;   // painted tiles replace the vector frame
    const key = this.eraId + '|' + fw + '|' + fh + '|' + this.scale;
    if (this.frameKey !== key) { this.frameImg = buildFrame(this.theme, fw, fh, this.scale); this.frameKey = key; }
    c.drawImage(this.frameImg, fx - FRAME_M, fy - FRAME_M, fw + 2 * FRAME_M, fh + 2 * FRAME_M);
    if (!reducedMotion() && this.theme.ambient) {
      c.save(); ringPath(c, fx, fy, fw, fh, FRAME_T); c.clip('evenodd');
      drawAmbient(c, this.theme, { x: fx, y: fy, w: fw, h: fh }, now); c.restore();
    }
  }

  drawGem(c, p, sc, hinted) {
    const r = this.cs * 0.42 * p.s * sc;
    if (r <= 0) return;
    c.save(); c.globalAlpha = Math.max(0, p.a); c.translate(p.x, p.y); c.scale(p.sx, p.sy);
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(0, r * 0.85, r * 0.8, r * 0.22, 0, 0, 6.283); c.fill();
    const sp = spriteFor(this.eraId, p.c);
    if (sp) { const d = r * 2.3; c.drawImage(sp, -d / 2, -d / 2, d, d); } else drawGemShape(c, p.c, r);
    if (hinted) { c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, r * 1.15, 0, 6.283); c.stroke(); }
    c.restore();
  }
}
const DIRT_DOTS = [[-0.3, -0.25, 0.1], [0.28, -0.1, 0.08], [-0.1, 0.3, 0.09], [0.3, 0.3, 0.07]];
void STAGGER; void SHAKE; void HOLD;
