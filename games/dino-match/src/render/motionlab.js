// Dev-only Motion lab (?motion): one Play button per docs/09 section 4 event, using the real renderer and screens.
import { RECIPES, EVENTS, DEBUG, roll } from './motion.js';
import { cue } from './sound.js';
import { createState } from '../core/game.js';
import { generateLevel } from '../core/level.js';
import { eraOf } from '../core/eras.js';
import { newProfile } from '../core/profile.js';
import { digPart } from '../core/fossils.js';
import { mountResult } from '../screens/result.js';
import { mountDig } from '../screens/dig.js';
import { Button } from '../ui/components.js';
import { h } from '../ui/dom.js';

export async function mountLab({ renderer, ui }) {
  document.body.dataset.lab = '1';
  const level = generateLevel(3), era = eraOf(3);
  let demo = null;
  const fresh = async () => { demo?.destroy?.(); demo = null; ui.replaceChildren(); await renderer.setEra(era.id); const st = createState(level); renderer.startLevel(st); renderer.locked = false; return st; };
  const ids = (st) => st.cells.map((p) => p);
  let nid = 9000;
  const clearLog = (st, idx, step = 1) => ({ t: 'clear', step, score: 30 * step, cells: idx.map((i) => ({ i, id: st.cells[i].id, c: st.cells[i].c })) });
  const bottom = (st, n) => Array.from({ length: n }, (_, k) => (st.h - 1) * st.w + k);
  const play = async (ev, hooks) => { renderer.locked = false; await renderer.play(ev, hooks || {}); renderer.locked = false; };
  const hitOf = (broke) => ({ t: 'hit', step: 1, hits: [{ b: 0, hp: broke ? 0 : 1, max: 2, c: 0, broke }], dug: broke ? 1 : 0, total: renderer.state.dirtTotal });

  const demos = {
    tapGem: async () => { const st = await fresh(); renderer.sel = 8; renderer.selT0 = renderer.vnow; cue('tapGem'); void st; },
    swapValid: async () => { await fresh(); await play([{ t: 'swap', a: 0, b: 1, ok: true }]); },
    swapInvalid: async () => { await fresh(); await play([{ t: 'swap', a: 0, b: 1, ok: false }]); },
    matchClear: async () => { const st = await fresh(); await play([clearLog(st, [0, 1, 2], 1)]); },
    fallRefill: async () => { const st = await fresh(); const idx = bottom(st, 3); await play([clearLog(st, idx), { t: 'fall', moves: [], spawns: idx.map((to, k) => ({ id: nid++, c: k % 6, to, fromRow: -1 - k })) }]); },
    cascadeStep: async () => { const st = await fresh(); await play([clearLog(st, [0, 1, 2], 1), clearLog(st, [8, 9, 10, 11, 12], 4)]); },
    digBlock: async () => { await fresh(); await play([hitOf(true)]); },
    hitBlock: async () => { await fresh(); await play([hitOf(false)]); },
    createSpecial: async () => { const st = await fresh(); const id = nid++; await play([clearLog(st, [0, 1, 2, 3], 1), { t: 'create', step: 1, i: 1, id, c: 0, s: 'firecracker', o: 'h' }]); },
    fireSpecial: async () => { const st = await fresh(); await play([{ t: 'fire', step: 1, fires: [{ i: 10, id: 1, kind: 'bomb', o: 'h', depth: 1, cells: [9, 10, 11, 16, 17, 18, 2, 3, 4] }, { i: 17, id: 2, kind: 'firecracker', o: 'h', depth: 2, cells: [14, 15, 16, 17, 18, 19, 20] }] }, clearLog(st, [9, 10, 11, 14, 15, 16, 17, 18, 19, 20], 1)]); },
    obstacleHit: async () => { const st = await fresh(); renderer.obst[10] = { k: 'sandstone', hp: 2, max: 2, s: 1, a: 1, jolt: 0 }; st.cells[10] = null; await play([{ t: 'obstacle', step: 1, hits: [{ i: 10, k: 'sandstone', hp: 1, max: 2, by: 'match', broke: false }] }]); },
    obstacleBreak: async () => { const st = await fresh(); renderer.obst[10] = { k: 'crate', hp: 1, max: 1, s: 1, a: 1, jolt: 0 }; st.cells[10] = null; await play([{ t: 'obstacle', step: 1, hits: [{ i: 10, k: 'crate', hp: 0, max: 1, by: 'blast', broke: true, drop: { coins: 3 } }] }]); },
    collectItem: async () => { const st = await fresh(); const i = (st.h - 1) * st.w + 3, id = nid++; st.cells[i] = { id, c: -3, a: 1 }; renderer.grid[i] = renderer.makePiece({ id, c: -3, a: 1 }, i); await play([{ t: 'collect', items: [{ i, id, kind: 'artefact' }] }]); },
    tarSpread: async () => { const st = await fresh(); renderer.obst[9] = { k: 'tar', hp: 1, max: 1, s: 1, a: 1, jolt: 0 }; await play([{ t: 'spread', items: [{ i: 10, id: st.cells[10].id, from: 9 }] }]); },
    lavaErupt: async () => { const st = await fresh(); renderer.obst[16] = { k: 'lava', hp: 3, max: 3, heat: 2, s: 1, a: 1, jolt: 0 }; await play([{ t: 'erupt', i: 16, items: [10, 15, 17].map((i) => ({ i, id: st.cells[i].id })) }]); },
    targetPop: async () => { cue('targetPop'); },
    targetDone: async () => { cue('targetDone'); },
    lastBlock: async () => { await fresh(); const n = renderer.state.dirtTotal; renderer.blocks.forEach((b, i) => { if (i !== 0) b.alive = false; }); await play([{ ...hitOf(true), dug: n, total: n }, { t: 'end', status: 'won', stars: 3 }]); },
    foundBanner: async () => { await fresh(); await play([{ t: 'end', status: 'won', stars: 3 }]); },
    winScreen: async () => { await fresh(); const st = renderer.state; st.score = 4200; demo = mountResult(ui, { won: true, level, state: st, stars: 3, rewards: { coins: 40, pickaxes: 1 }, lives: 5, ads: { show: async () => true, report() {} }, onNext() {}, onRetry() {}, onHome() {}, onDig() {}, onDouble() {} }); },
    loseScreen: async () => { await fresh(); demo = mountResult(ui, { won: false, level, state: renderer.state, stars: 0, rewards: { coins: 0, pickaxes: 0 }, lives: 3, ads: { show: async () => true, report() {} }, onNext() {}, onRetry() {}, onHome() {}, onDig() {}, onDouble() {} }); await play([{ t: 'end', status: 'lost', stars: 0 }]); },
    pickaxeSpend: async () => { await fresh(); let p = { ...newProfile(), pickaxes: 5 }; demo = mountDig(ui, { profile: p, dig: () => { const r = digPart(p); if (r.ok) p = r.profile; return r; }, onBack() {}, onComplete() {} }); setTimeout(() => demo.el.querySelector('#dig-btn')?.click(), 400); },
    fossilComplete: async () => { await fresh(); let p = { ...newProfile(), pickaxes: 50 }; for (let i = 0; i < 9; i++) { const r = digPart(p); if (r.ok) p = r.profile; } demo = mountDig(ui, { profile: p, dig: () => { const r = digPart(p); if (r.ok) p = r.profile; return r; }, onBack() {}, onComplete() {} }); setTimeout(() => demo.el.querySelector('#dig-btn')?.click(), 400); },
    buttonPress: async () => { await fresh(); const b = Button({ id: 'demo-btn' }, 'Press me'); demo = { el: b, destroy: () => b.remove() }; const w = h('main', { class: 'screen', style: { alignItems: 'center', justifyContent: 'center' } }, b); ui.append(w); demo.destroy = () => w.remove(); cue('buttonPress'); b.classList.add('is-pressed'); setTimeout(() => b.classList.remove('is-pressed'), RECIPES.buttonPress.dur * 2); },
    screenChange: async () => { await fresh(); const mk = (t) => h('main', { class: 'screen', style: { alignItems: 'center', justifyContent: 'center', background: '#16233A' } }, h('h1', { class: 'display' }, t)); const a = mk('Screen A'); ui.append(a); await new Promise(requestAnimationFrame); a.classList.add('leaving'); cue('screenChange'); const b = mk('Screen B'); ui.append(b); demo = { destroy: () => { a.remove(); b.remove(); } }; },
    counterChange: async () => { await fresh(); const n = h('p', { class: 'display dt-num', style: { textAlign: 'center', marginTop: '200px' } }, '0'); const w = h('main', { class: 'screen' }, n); ui.append(w); demo = { destroy: () => w.remove() }; await roll(n, 0, 1280, (v) => v.toLocaleString('en-US')); },
    lifeRegained: async () => { await fresh(); const c = h('span', { class: 'chip heading dt-num', style: { margin: '200px auto 0' } }, '4/5'); const w = h('main', { class: 'screen' }, c); ui.append(w); demo = { destroy: () => w.remove() }; cue('lifeRegained'); c.textContent = '5/5'; c.classList.add('pulse'); }
  };

  const box = h('aside', { id: 'lab', style: { position: 'fixed', left: '8px', top: '8px', width: '170px', maxHeight: 'calc(100vh - 16px)', overflow: 'auto', zIndex: 50, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#F2F8FF' } },
    h('strong', {}, 'Motion lab'));
  for (const e of EVENTS) {
    const b = h('button', { type: 'button', class: 'lab-btn', 'data-event': e, style: { minHeight: '32px', textAlign: 'left', padding: '4px 8px' }, onClick: () => demos[e]?.() }, e);
    box.append(b);
  }
  const speed = h('select', { id: 'lab-speed', onChange: (ev) => { DEBUG.timeScale = Number(ev.target.value); } }, ...[1, 0.5, 0.25, 0.1].map((v) => h('option', { value: v }, 'speed ' + v + 'x')));
  const red = h('label', {}, h('input', { type: 'checkbox', id: 'lab-reduced', onChange: (ev) => { window.__forceReduced = ev.target.checked; window.__forceMotion = !ev.target.checked; document.body.classList.toggle('is-reduced', ev.target.checked); } }), ' reduced motion');
  box.append(speed, red);
  document.body.append(box);
  window.__lab = { demos, fresh };
  await fresh();
}
