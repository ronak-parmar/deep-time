import { injectDesignSystem } from './ui/tokens.js';
import { preloadFx } from './render/fxArt.js';   // painted effect frames + island ambient art: loaded after boot, never on the loading screen
import { preloadAmbient } from './render/ambientArt.js';
import { reducedMotion } from './ui/motion.js';
import { D, dur, RECIPES, YUVI as YUVI_T, BOOT } from './render/motion.js';
import { cue, unlock, setMuted, setHaptics } from './render/sound.js';
import { Renderer } from './render/renderer.js';
import { createState, swap, hintMove, addMoves, useBooster } from './core/game.js';
import { boosterTargets, owned, spendBooster, buyBooster, giftBooster, applyPreBooster } from './core/boosters.js';
import { BOOSTERS, unlockedBoosters } from './data/boosters.js';
import { mountShop } from './screens/shop.js';
import { mountCredits } from './screens/credits.js';
import { generateLevel } from './core/level.js';
import { eraOf, ERAS } from './core/eras.js';
import { settleLevel, doubleCoins, spendCoins } from './core/profile.js';
import { syncLives, canStartLevel, refillLives } from './core/lives.js';
import { digPart, FOSSILS } from './core/fossils.js';
import { starsFor, nearMissOffer } from './core/rules.js';
import { CONFIG } from './core/config.js';
import { mountBoot } from './screens/boot.js';
import { createLoader, bootTips, within } from './core/preload.js';
import { bootTasks } from './render/bootplan.js';
import { ROSTER } from './data/roster.js';
import { setSpecialUrls, specialUrls } from './render/specialArt.js';
import { mountHome } from './screens/home.js';
import { mountIsland } from './screens/island.js';
import { loadIslandArt } from './render/islandart.js';
import { mountPlay } from './screens/play.js';
import { mountPrelevel } from './screens/prelevel.js';
import { bestStars } from './core/journey.js';
import { skipTutorial, tutorialMove } from './core/tutorial.js';
import { coachNeeded, markCoach, skipCoach, firstMade, cellOf, swapsWith, adjacentSpecials, swapAllowed } from './core/coach.js';
import { coachStep, activeCoach } from './screens/coach.js';
import { HELLO, COACH } from './data/yuvi.js';
import { SPECIALS } from './core/specials.js';
import './ui/kit.js';
import { mountIntro } from './screens/intro.js';
import { mountHowTo } from './screens/howto.js';
import { INTROS, COMBO_INTROS, introsFor, introNeeded, markIntroSeen, comboId, comboIntroFor, isPreIntro } from './data/intros.js';
import { setupTest, ALL_TESTS } from './core/testboards.js';
import { targetProgress } from './core/targets.js';
import { mountResult } from './screens/result.js';
import { mountDig } from './screens/dig.js';
import { mountOutOfLives } from './screens/lives.js';
import { mountOffer } from './screens/offer.js';
import { mountHistory } from './screens/history.js';
import { mountMuseum } from './screens/museum.js';
import { createLocalSaveStore, createCloudSaveStore, CLOUD_TOASTS } from './ports/save.js';
import { createPlayGamesPort } from './ports/playgames.js';
import { showToast } from './ui/playgames.js';
import { createAdPort, AD_EVENTS } from './ports/ads.js';
import * as yuvi from './ui/helper.js';
import { h } from './ui/dom.js';
import { mountWelcome } from './screens/welcome.js';
import { islandsOpen } from './core/profile.js';

injectDesignSystem();
const stage = document.getElementById('stage');
const ui = document.getElementById('ui');
const renderer = new Renderer(document.getElementById('game'));
// Saves: always local; plus Google Play Games saved games when signed in (Android, docs/17). The Play Games port loads lazily.
const gamesPort = createPlayGamesPort();
const games = Object.fromEntries(['available', 'isAuthenticated', 'signIn', 'saveGame', 'loadGame'].map((k) => [k, async (a) => (await gamesPort)[k](a)]));
const save = createCloudSaveStore({
  local: createLocalSaveStore(), games,
  toast: (m) => showToast(ui, m, m === CLOUD_TOASTS.saved || m === CLOUD_TOASTS.restored ? 'success' : 'info'),
  // the cloud had progress this phone did not: adopt the merged profile; the map redraws with it (a level in play is left alone)
  onRemote: (p) => { profile = p; applySettings(); if (!game && /\b(home|isle)\b/.test(screen?.el?.className || '')) showHome(); }
});
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save.flush(); });
// Ads: the mock until AdMob is ready (Android build). Test ads unless the build is live (VITE_ADS_LIVE=1, docs/20).
const ads = createAdPort({ live: import.meta.env.VITE_ADS_LIVE === '1' });
// Injectable clock (debug: window.__clockOffset shifts time, used by the scripted tests)
const now = () => Date.now() + (window.__clockOffset || 0);

// Scale the 360 x 640 stage to the window, centred.
// Outside a level the stage grows taller on tall phones (no letterbox); in a level it stays 360 x 640 and is centred.
let tall = true;
function fit() {
  const s = Math.min(innerWidth / 360, innerHeight / 640);
  const h = tall ? Math.max(640, innerHeight / s) : 640;
  stage.style.height = h + 'px';
  stage.style.transform = `translate(${(innerWidth - 360 * s) / 2}px, ${(innerHeight - h * s) / 2}px) scale(${s})`;
  document.getElementById('game').style.top = (h - 640) / 2 + 'px';
  renderer.resize(s);
  yuvi.sync();
}
const setTall = (b) => { if (tall !== b) { tall = b; fit(); } };
addEventListener('resize', fit);
fit();
document.body.classList.toggle('is-reduced', reducedMotion());

let profile, screen = null, game = null;
// Old screen fades out (and stops taking input) while the new one slides in; it is removed after the leave time.
const swapScreen = (next) => {
  game?.tut?.destroy();                       // a tutorial overlay never outlives its play screen
  const old = screen; screen = next;
  welcome?.destroy(); welcome = null;         // a welcome never outlives the screen it was shown on
  activeCoach()?.destroy();                   // nor does a coaching step
  yuvi.leave();                               // Yuvi waddles out on every screen change (the next screen may call him back)
  if (!old) return;
  old.el?.classList.add('leaving');
  setTimeout(() => old.destroy(), dur(RECIPES.screenChange.leave));
  cue('screenChange');
};
const applySettings = () => { setMuted(profile.settings.muted); setHaptics(profile.settings.haptics); };
const setSetting = async (k, v) => { await persist({ ...profile, settings: { ...profile.settings, [k]: v } }); applySettings(); if (k === 'yuvi' && !v) yuvi.leave(); };
const setYuvi = (patch) => persist({ ...profile, yuvi: { ...profile.yuvi, ...patch } });
// every button gets the press sound and haptic; the first touch also unlocks WebAudio
document.addEventListener('pointerdown', (e) => { unlock(); if (e.target.closest?.('button:not(:disabled)')) cue('buttonPress'); }, true);
const persist = async (p) => { profile = p; await save.save(p); return p; };
const refreshLives = async () => { const p = syncLives(profile, now()); if (p !== profile) await persist(p); };

// ---- screens -----------------------------------------------------------------------------
async function showHome() {
  setTall(true);
  game?.tut?.destroy(); game = null; renderer.clearLevel();
  await refreshLives();
  const stall = (p) => within(p, BOOT.stall, (ms) => new Promise((r) => setTimeout(r, ms)));   // slow art never holds the map (it pops in)
  await stall(renderer.setEra(eraOf(profile.level).id));
  await stall(loadIslandArt(ERAS.map((e) => e.id)));
  swapScreen(mountHome(ui, { profile, now, onSetting: setSetting, onMeetYuvi: () => showWelcome(),  onPlay: () => startLevel(profile.level), onPlayLevel: (n) => startLevel(n), onHowTo: () => showHowTo(showHome), onDig: () => showDig(showHome), onMuseum: () => showMuseum(showHome), onShop: () => openShop({ onClose: showHome }), onCredits: () => mountCredits(ui, {}), cloud: save, onIsland: (id, origin) => showIsland(id, origin) }));
  // a newly opened island gets a surprised + wave (the first launch goes to the first island instead: see boot / showIsland)
  const open = islandsOpen(profile);
  if (open > profile.yuvi.islands) { await setYuvi({ islands: open }); yuvi.island(ERAS[open - 1].name); }
}

// Settings > Meet Yuvi again / How to play: his hello plus a mini how-to (screens/welcome.js, data/yuvi.js MEET). Tap to advance.
let welcome = null;
function showWelcome() {
  welcome?.destroy();
  welcome = mountWelcome({ onDone: async () => { welcome = null; await setYuvi({ welcomeSeen: true, met: true }); } });
  return welcome;
}
// The very first launch (M8): straight to the first island, two bubbles, then the player taps level 1 themselves.
const firstLaunch = () => coachNeeded(profile, 'hello') && profile.level === 1 && !Object.keys(profile.stars).length;

// Shop (docs/16): over whatever is on screen. Buying persists the profile; onClose runs when the player leaves it.
function openShop({ onClose, focus = null, level = profile.level } = {}) {
  const view = mountShop(ui, { profile, level, focus, onBuy: async (id) => { const q = buyBooster(profile, id); if (!q) return null; await persist(q); cue('boosterSelect'); game?.view.boosters?.update(q.boosters); return q; }, onClose: () => { yuvi.leave(); onClose?.(); } });
  yuvi.shop(focus ? BOOSTERS[focus].name : null);   // Yuvi points at the shop list (an empty booster: at the one you tapped)
  return view;
}

function showHowTo(back, all = false) {
  setTall(true);
  swapScreen(mountHowTo(ui, { profile, onBack: back, all, onMeetYuvi: () => showWelcome() }));
}

async function showIsland(eraId, origin, { hello = false } = {}) {
  setTall(true);
  game?.tut?.destroy(); game = null; renderer.clearLevel();
  await refreshLives();
  lastIsland = eraId;
  let helloStep = null;
  swapScreen(mountIsland(ui, { profile, eraId, origin, onBack: () => { lastIsland = null; showHome(); },
    onPlayLevel: async (n) => { if (helloStep) { helloStep = null; await persist(markCoach({ ...profile, yuvi: { ...profile.yuvi, welcomeSeen: true, met: true } }, 'hello')); return startLevel(n, { skipPre: n === 1 }); } startLevel(n); } }));
  if (!hello) return;
  // first launch: wave hello (tap; no Skip on the very first bubble), then point at level 1 and wait for the player to tap it
  const node = () => document.querySelector('.inode[data-level="1"]');
  node()?.scrollIntoView({ block: 'center' });
  await new Promise((r) => requestAnimationFrame(r));
  const r1 = await coachStep({ say: HELLO[0].say, action: 'wave', wait: 'tap' }).promise;
  if (r1 !== 'tap') return;
  helloStep = coachStep({ say: HELLO[1].say, action: 'point', wait: 'action', spot: node(), onSkip: async () => { helloStep = null; await persist(skipCoach(markCoach(profile, 'hello'))); yuvi.leave(); } });
}
let lastIsland = null;
const backToMap = () => (lastIsland ? showIsland(lastIsland) : showHome());
async function showDig(back) {
  setTall(true);
  game?.tut?.destroy(); game = null; renderer.clearLevel();
  await refreshLives();
  await renderer.setEra(eraOf(profile.level).id);
  const view = mountDig(ui, {
    profile, now, level: profile.level, onBack: back,
    onPlay: () => startLevel(profile.level),
    onMuseum: () => showMuseum(() => showDig(back)),
    dig: () => { const r = digPart(profile); if (r.ok) { persist(markCoach(r.profile, 'dig')); activeCoach()?.done(); } return r; },
    yuvi: { enter: (dock) => yuvi.digEnter(dock), strike: () => yuvi.digStart(), part: () => (coachNeeded(profile, 'museum') ? coachMuseum() : yuvi.digPart()), fossil: (f) => yuvi.digFossil(f.name) },
    onComplete: (fossil) => {
      ads.report(AD_EVENTS.fossilComplete, { fossil: fossil.id });
      showHistory(fossil, () => showDig(back));
    }
  });
  swapScreen(view);
  if (coachNeeded(profile, 'dig') && profile.pickaxes >= 1) coachDig(view);   // first visit with a pickaxe: slab, top-up, Dig
}

// History cutscene (never an ad): after a fossil is completed, or replayed from the museum.
function showHistory(fossil, back) {
  setTall(true);
  swapScreen(mountHistory(ui, { fossil, onDone: back }));
}

async function showMuseum(back) {
  setTall(true);
  game?.tut?.destroy(); game = null; renderer.clearLevel();
  await refreshLives();
  await renderer.setEra(eraOf(profile.level).id);
  swapScreen(mountMuseum(ui, {
    profile, onBack: back,
    onDig: () => showDig(() => showMuseum(back)),
    onWatch: (fossil) => showHistory(fossil, () => showMuseum(back))
  }));
}

async function showOutOfLives(levelNo) {
  setTall(true);
  game?.tut?.destroy(); game = null; renderer.clearLevel();
  await refreshLives();
  ads.report(AD_EVENTS.livesEmpty, { level: levelNo });
  const view = mountOutOfLives(ui, {
    profile, level: levelNo, now, ads,
    onPlay: () => startLevel(levelNo),
    onDig: () => showDig(() => showOutOfLives(levelNo)),
    onHome: showHome,
    onRefillCoins: async () => {
      const p = spendCoins(profile, CONFIG.lives.refillCoins);
      if (!p) return;
      await persist(refillLives(p));
      startLevel(levelNo);
    },
    onRefillAd: async () => { ads.report(AD_EVENTS.rewardedCompleted, { kind: 'refill_lives' }); await persist(refillLives(profile)); startLevel(levelNo); }
  });
  swapScreen(view);
  yuvi.lose('noLives');
}

// ---- a level -----------------------------------------------------------------------------
// opts.skipPre skips the pre-level screen (retry, scripted tests). opts.test = a debug board name from core/testboards.js.
async function startLevel(n, opts = {}) {
  await refreshLives();
  if (!canStartLevel(profile, now())) return showOutOfLives(n);
  const level = generateLevel(n, { tune: !opts.test });
  const state = createState(level);
  if (opts.test) { const t = setupTest(state, opts.test); if (t) { state.moves = state.movesMax = 40; window.__testSwap = t.swap; } }
  await renderer.setEra(eraOf(n).id);
  renderer.startLevel(state);
  renderer.locked = true; game?.tut?.destroy(); game = null;
  const begin = async (chosen = []) => {
    for (const id of chosen) {                       // pre-level boosters: spend, then change the fresh board before anything is drawn
      const q = spendBooster(profile, id); if (!q) continue;
      await persist(q); applyPreBooster(state, id); renderer.startLevel(state);
    }
    setTall(false);
    const view = mountPlay(ui, { level, state, tip: null, onHome: () => { cancelBooster(); renderer.locked = true; backToMap(); }, boosters: opts.test ? null : { counts: { ...profile.boosters }, onTap: (id) => boosterTap(id), onCancel: () => cancelBooster() } });
    swapScreen(view);
    game = { level, state, view, tut: null };
    if (!opts.test && n === 1 && !(1 in profile.stars) && coachNeeded(profile, 'swap')) {   // level 1 (M8): goal, then one guided swap
      coachLevel1(game);
    } else if (!opts.test) {                          // new element on this level (data/intros.js): a card per element, once
      const list = introsFor(profile, level).filter((e) => !isPreIntro(e));
      if (list.length) game.tut = mountIntro({ entries: list, renderer, state, yuvi: yuviIntro(), onDone: () => introDone(list), onSkip: () => persist(skipTutorial(profile)) });
    }
    renderer.getHint = () => { const m = hintMove(state); if (m && !opts.test && !activeCoach() && introNeeded(profile, 'hint')) softIntro(INTROS.hint); return m; };
    renderer.onSwap = (a, b) => onSwap(a, b);
    renderer.onTarget = (i) => runBooster(i);
    renderer.locked = false;
    ads.report(AD_EVENTS.levelStart, { level: n });
  };
  if (opts.skipPre || opts.test) return begin();
  const preIds = unlockedBoosters(n, 'pre');
  const pre = { ids: preIds, counts: { ...profile.boosters }, onShop: (id) => openShop({ focus: id, level: n, onClose: () => { pv.setCounts(profile.boosters); } }) };
  const pv = mountPrelevel(ui, { level, state, onPlay: begin, onBack: showHome, pre: preIds.length ? pre : null, best: bestStars(profile, n) });
  swapScreen(pv);
  const preIntros = introsFor(profile, level).filter(isPreIntro);   // a pre-level booster met for the first time: explained here, gifted, and already picked
  if (preIntros.length) mountIntro({ entries: preIntros, renderer, state, yuvi: yuviIntro(), onDone: async () => { let p = markIntroSeen(profile, ...preIntros.map((e) => e.id)); for (const e of preIntros) p = giftBooster(p, e.booster); await persist(p); pv.setCounts(p.boosters); for (const e of preIntros) pv.select(e.booster); }, onSkip: () => persist(skipTutorial(profile)) });
}

// Intro cards with Yuvi (when Yuvi tips are on): he says the card text; a player who has not met him yet gets his hello first.
const yuviIntro = () => (yuvi.helperOn() ? { greet: !profile.yuvi.met, onGreet: () => setYuvi({ met: true }) } : null);

// ---- in-context coaching (M8, core/coach.js + screens/coach.js) -------------------------------------------------------------
// screen rect of the board / of some cells, and the centre of a cell (for the hand pointer)
const boardRect = () => { const r = renderer.canvas.getBoundingClientRect(), k = r.width / 360, st = renderer.state, pad = 6; return { x: r.left + renderer.boardX * k - pad, y: r.top + renderer.boardY * (r.height / 640) - pad, w: st.w * renderer.cs * k + 2 * pad, h: st.h * renderer.cs * k + 2 * pad }; };
const cellXY = (i) => { const r = renderer.canvas.getBoundingClientRect(), k = r.width / 360; return [r.left + renderer.cx(i) * k, r.top + renderer.cy(i) * (r.height / 640)]; };
function cellsRect(ids) {
  const r = renderer.canvas.getBoundingClientRect(), k = r.width / 360, cs = renderer.cs, pad = 6;
  const xs = ids.map((i) => renderer.cx(i)), ys = ids.map((i) => renderer.cy(i));
  const x0 = r.left + (Math.min(...xs) - cs / 2) * k, y0 = r.top + (Math.min(...ys) - cs / 2) * k, x1 = r.left + (Math.max(...xs) + cs / 2) * k, y1 = r.top + (Math.max(...ys) + cs / 2) * k;
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
}
const coachSkip = async () => { if (game) game.guard = null; await persist(skipCoach(profile)); yuvi.leave(); };
const coachEnd = () => yuvi.leave();

// Level 1: (a) the goal plate, tap; (b) a hand shows one real swap, the board takes only that swap; then "Nice!" and free play.
async function coachLevel1(g) {
  const t = g.state.targets.find((q) => q.type === 'collect');
  if (t && coachNeeded(profile, 'goal')) {
    const r = await coachStep({ say: COACH.goal(t.n, CONFIG.gemKinds[t.c] || 'target'), action: 'point', wait: 'tap', spot: document.querySelector('.stat--target'), onSkip: coachSkip }).promise;
    await persist(markIntroSeen(markCoach(profile, 'goal'), 'obj-collect'));
    if (r !== 'tap' || game !== g) return;
  }
  const mv = tutorialMove(g.state, { size: 3 }); if (!mv) return coachEnd();
  g.guard = { pair: mv, step: 'swap' };
  g.coach = coachStep({ say: COACH.swap, action: 'point', wait: 'action', spot: boardRect(), hand: { a: cellXY(mv[0]), b: cellXY(mv[1]) }, place: 'soft', onSkip: coachSkip });
}
// after a move resolves (the level is still on): the first special made, 5 moves left, the first two specials side by side.
// Returns true when a step was shown (soft tips wait for the next move).
async function coachAfterMove(g, r) {
  if (g.level.test && !window.__coachTest) return false;
  const made = firstMade(profile, r.events);
  if (made) { const i = cellOf(g.state, made.id); if (i >= 0) { await coachSpecial(g, made, i); return true; } }
  if (g.state.moves <= 5 && coachNeeded(profile, 'moves')) {
    await persist(markCoach(profile, 'moves'));
    await coachStep({ say: COACH.moves, action: 'surprised', wait: 'tap', spot: document.querySelector('.stat--moves') }).promise; coachEnd(); return true;
  }
  const adj = coachNeeded(profile, 'combo') ? adjacentSpecials(g.state) : null;
  if (adj) {
    await persist(markCoach(profile, 'combo'));
    await coachStep({ say: COACH.combo, action: 'point', wait: 'tap', spot: cellsRect(adj), place: 'soft' }).promise; coachEnd(); return true;
  }
  return false;
}
// the first time a special is made: light it, Yuvi explains it, then the player must use it (Not now = later). No legal swap with it:
// just the explanation (tap).
async function coachSpecial(g, made, i) {
  await persist(markIntroSeen(profile, made.kind));
  const line = COACH.special[made.kind](made.o), opts = swapsWith(g.state, i), name = SPECIALS[made.kind]?.name || made.kind;
  if (!opts.length) { await coachStep({ say: line, action: 'point', wait: 'tap', spot: cellsRect([i]), place: 'soft' }).promise; return coachEnd(); }
  const [a, b] = opts[0], other = a === i ? b : a;
  const r1 = await coachStep({ say: line, action: 'point', wait: 'tap', spot: cellsRect([i]), place: 'soft' }).promise;
  if (r1 !== 'tap' || game !== g) return coachEnd();
  g.guard = { cell: i, step: 'special' };
  g.coach = coachStep({ say: COACH.useIt(name), action: 'point', wait: 'action', spot: cellsRect([i, ...opts.map(([x, y]) => (x === i ? y : x))]), hand: { a: cellXY(i), b: cellXY(other) }, place: 'soft', alt: { label: 'Not now', fn: () => { g.guard = null; g.coach = null; coachEnd(); } } });
}
// first win: cheer and point at the pickaxe reward (tap), then light the Dig site button and wait for it
async function coachPickaxe() {
  await new Promise((r) => setTimeout(r, dur(D.dramatic)));   // the panel has slid up
  const line = document.getElementById('pick-line'); if (!line) return;
  const r = await coachStep({ say: COACH.pickaxe, action: 'cheer', then: 'point', wait: 'tap', spot: line }).promise;
  await persist(markCoach(profile, 'pickaxe'));
  if (r !== 'tap') return;
  const btn = document.querySelector('.dt-result #dig'); if (!btn) return coachEnd();
  coachStep({ say: COACH.toDig, action: 'point', wait: 'action', spot: btn });
}
// the dig site, the first time with a pickaxe: the slab (tap), a top-up gift so the first part is affordable (tap), then Dig (action)
async function coachDig(view) {
  await new Promise((r) => setTimeout(r, dur(D.celebrate)));   // Yuvi has walked onto the table
  const stage = document.querySelector('.dig__stage'); if (!stage || !coachNeeded(profile, 'dig')) return;
  let r = await coachStep({ say: COACH.slab, action: 'point', wait: 'tap', spot: stage, place: 'dig', lift: false }).promise;
  if (r !== 'tap') return;
  const cost = CONFIG.fossils.pickaxesPerPart;
  if (profile.pickaxes < cost) {
    r = await coachStep({ say: COACH.gift(profile.pickaxes, cost), action: 'cheer', wait: 'tap', place: 'dig' }).promise;
    await persist({ ...profile, pickaxes: cost }); view.update(profile);
    if (r !== 'tap') return;
  }
  coachStep({ say: COACH.digTap, action: 'point', wait: 'action', spot: document.getElementById('dig-btn'), place: 'dig' });
}
// after the first part comes out: the museum button, once
async function coachMuseum() {
  await persist(markCoach(profile, 'museum'));
  await coachStep({ say: COACH.museum, action: 'point', wait: 'tap', spot: document.getElementById('museum-btn'), place: 'dig', lift: false }).promise;
  yuvi.digPart();
}

// ---- boosters (docs/16) ----------------------------------------------------------------------
// tap a booster -> (targeted ones) choose a tile -> useBooster() in core -> the same event replay as a move. An empty one opens the shop.
// The first time a booster is taught its card gifts one and the player must use it (forced), with a clear Cancel.
const PROMPT = { cell: 'Tap a tile to smash', row: 'Tap a row to clear', area: 'Tap the middle of the area', colour: 'Tap a gem: its colour goes', none: '' };
function introDone(list) {
  let p = markIntroSeen(profile, ...list.map((e) => e.id)); const bst = list.filter((e) => e.booster);
  for (const e of bst) p = giftBooster(p, e.booster);
  persist(p).then(() => { const g = game; if (!g || !bst.length) return; g.view.boosters?.update(p.boosters); g.tut = null; forceBooster(bst[0].booster); });
}
function forceBooster(id) {
  const g = game; if (!g) return;
  g.force = id; g.view.boosters?.setForce(id);
  const b = BOOSTERS[id]; g.view.prompt(b.target === 'none' ? `Your turn: tap ${b.name}` : `Your turn: tap ${b.name}, then a tile`, 'Not now');
  if (b.target !== 'none') boosterTap(id, true);
}
function cancelBooster() {
  const g = game; renderer.setTargeting(null); if (!g) return;
  g.pending = null; g.force = null; g.view.boosters?.setActive(null); g.view.boosters?.setForce(null); g.view.prompt(null);
}
function boosterTap(id, auto = false) {
  const g = game; if (!g || renderer.locked || g.state.status !== 'playing') return;
  const b = BOOSTERS[id];
  if (g.tut?.el?.classList.contains('intro--soft')) { g.tut.destroy(); g.tut = null; }
  if (g.tut) return;                                             // an intro card is open
  if (g.pending === id && !auto) { const f = g.force; cancelBooster(); if (f) { g.force = null; } return; }
  if (owned(profile, id) <= 0) { cancelBooster(); renderer.locked = true; openShop({ focus: id, level: g.level.level, onClose: () => { if (game === g) { g.view.boosters?.update(profile.boosters); renderer.locked = false; } } }); return; }
  cue('boosterSelect');
  if (b.target === 'none') { g.pending = id; return runBooster(-1); }
  g.pending = id; g.view.boosters?.setActive(id);
  const valid = new Set(); for (let i = 0; i < g.state.w * g.state.h; i++) if (boosterTargets(g.state, id, i)) valid.add(i);
  renderer.setTargeting(id, valid);
  g.view.prompt(g.force === id ? `Your turn: ${PROMPT[b.target].toLowerCase()}` : PROMPT[b.target], g.force === id ? 'Not now' : 'Cancel');
}
async function runBooster(i) {
  const g = game; if (!g || !g.pending || renderer.locked) return;
  const id = g.pending, r = useBooster(g.state, id, i);
  if (!r.valid) { renderer.doShake('tiny'); return; }            // a tile the booster cannot use: nothing spent, still choosing
  const q = spendBooster(profile, id); if (q) await persist(q);
  const wasForced = g.force === id;
  renderer.setTargeting(null); g.pending = null; g.force = null; g.view.boosters?.setActive(null); g.view.boosters?.setForce(null); g.view.prompt(null);
  g.view.boosters?.update(profile.boosters);
  await renderer.play(r.events, { onMove: () => g.view.update({ moves: g.state.moves }), onDig: (dug, total) => g.view.update({ dug, total }), onTargets: (ev) => g.view.update({ got: ev.got }) });
  if (game !== g) return;
  g.view.update({ moves: g.state.moves, state: g.state });
  void wasForced;
  if (g.state.status === 'playing') { renderer.locked = false; return; }
  finish(g);
}

// Small card for things that happen mid-level (hint, shuffle, a first combo). Never blocks; the next move removes it.
// With Yuvi tips on, Yuvi says it instead of the small card (think for hint / shuffle, point for a combo); taps pass through him.
function softIntro(entry, seenId = entry.id, pose = 'think') {
  if (!game || game.tut) return;
  persist(markIntroSeen(profile, seenId));
  if (yuvi.helperOn()) {
    const g = game, tip = { el: h('div', { class: 'intro--soft' }), destroy() { if (g.tut === tip) g.tut = null; yuvi.leave(); }, moved() { tip.destroy(); } };
    game.tut = tip; yuvi.softTip(entry.text, pose, () => tip.destroy());
    return;
  }
  game.tut = mountIntro({ entries: [entry], renderer, state: game.state, soft: true });
}

async function onSwap(a, b) {
  const g = game;
  if (!g || renderer.locked) return;
  if (g.force || g.pending) { renderer.doShake('tiny'); return; }   // a booster is being chosen (or its first use is required): no swaps
  if (!swapAllowed(g.guard, a, b)) { renderer.doShake('tiny'); return; }   // a coaching step wants one particular swap
  if (g.tut?.el?.classList.contains('intro--soft')) { g.tut.destroy(); g.tut = null; }
  const sa = g.state.cells[a]?.s, sb = g.state.cells[b]?.s, combo = sa && sb ? comboIntroFor(sa, sb) : null;
  const r = swap(g.state, a, b);
  if (!r.events.length) return;
  const coached = r.valid && g.guard ? g.guard.step : null;   // the guided swap (level 1) or the first use of a new special
  if (coached) { g.guard = null; g.coach?.done(); g.coach = null; }
  await renderer.play(r.events, {
    onMove: () => g.view.update({ moves: g.state.moves }),
    onDig: (dug, total) => g.view.update({ dug, total }), onTargets: (ev) => g.view.update({ got: ev.got })
  });
  if (game !== g) return; // left the level while animating
  g.view.update({ moves: g.state.moves, state: g.state });
  if (r.valid) g.tut?.moved();
  if (coached === 'swap') { persist(markCoach(profile, 'swap')); yuvi.scene('soft', async ({ y, wait: w }) => { y.play('cheer'); y.say(COACH.nice); if (await w(YUVI_T.longBeat)) yuvi.leave(); }); }
  else if (coached) coachEnd();
  if (g.state.status === 'playing') {
    renderer.locked = false;
    if (!coached && await coachAfterMove(g, r)) return;
    if (game !== g) return;
    if (!g.level.test) {
      if (combo && introNeeded(profile, combo.id)) softIntro({ title: combo.ids.map((k) => INTROS[k].title).join(' + '), text: combo.text, art: INTROS[combo.ids[0]].art, spot: 'board' }, combo.id, 'point');
      else if (r.events.some((e) => e.t === 'shuffle') && introNeeded(profile, 'shuffle')) softIntro(INTROS.shuffle);
    }
    return;
  }
  finish(g);
}

async function finish(g) {
  g.tut?.destroy();
  const won = g.state.status === 'won';
  if (!won) {
    const offer = nearMissOffer(g.state);
    if (offer) return showNearMiss(g, offer);
  }
  settle(g, won);
}

// Out of moves within 2 blocks: +5 moves for coins or a rewarded ad (mock). Declining is a normal loss.
// The offer sits on top of the play screen; accepting puts the level back in play (no life lost).
function showNearMiss(g, offer) {
  ads.report(AD_EVENTS.nearMiss, { level: g.level.level, blocksLeft: offer.blocksLeft });
  ads.report(AD_EVENTS.rewardedOffer, { kind: 'extra_moves' });
  const resume = () => {
    view.destroy(); yuvi.leave();
    addMoves(g.state, offer.extraMoves);
    g.view.update({ moves: g.state.moves, state: g.state });
    renderer.locked = false;
  };
  const view = mountOffer(ui, {
    offer, progress: targetProgress(g.state), coins: profile.coins, ads,
    onCoins: async () => { const p = spendCoins(profile, offer.coinCost); if (!p) return; await persist(p); resume(); },
    onAd: () => { ads.report(AD_EVENTS.rewardedCompleted, { kind: 'extra_moves' }); resume(); },
    onDecline: () => { view.destroy(); settle(g, false); }
  });
  yuvi.lose('nearMiss');
}

async function settle(g, won) {
  let leaving = false;   // one tap only: the interstitial (if any) closes, then we move on
  const between = (go) => async () => { if (leaving) return; leaving = true; await ads.maybeInterstitial(n); go(); };
  activeCoach()?.destroy(); g.guard = null;
  const n = g.level.level;
  const stars = won ? starsFor(g.state) : 0;
  let { profile: p, rewards } = settleLevel(profile, n, { won, stars }, now());
  const found = won ? g.state.coinsFound || 0 : 0;                   // coins dropped by ancient crates are kept on a win
  if (found) { p = { ...p, coins: p.coins + found }; rewards = { ...rewards, coins: rewards.coins + found }; }
  await persist(p);
  ads.report(won ? AD_EVENTS.levelComplete : AD_EVENTS.levelFailed, { level: n, stars });
  let current = p;
  swapScreen(mountResult(ui, {
    won, level: g.level, state: g.state, stars, rewards, lives: p.lives, ads,
    // an interstitial may show only here, between levels (ports/ads.js INTERSTITIAL_RULES decide when)
    onNext: between(() => startLevel(n + 1)),
    onRetry: () => startLevel(n, { skipPre: true }),
    onHome: between(backToMap),
    onDig: () => showDig(showHome),
    onWait: () => showOutOfLives(n),
    onDouble: async () => { ads.report(AD_EVENTS.rewardedCompleted, { kind: 'double_coins' }); current = doubleCoins(profile, rewards.coins); await persist(current); }
  }));
  if (won) ads.report(AD_EVENTS.rewardedOffer, { kind: 'double_coins' });
  if (won && rewards.pickaxes > 0 && coachNeeded(profile, 'pickaxe')) coachPickaxe();   // first win: guide to the dig site
  else if (won) yuvi.win({ stars, part: !!g.state.hasDig }); else yuvi.lose('lose');   // every time (unless Yuvi tips are off)
}

// Loading screen (M10): mounts at once (painted backdrop + logo), reads the save, then preloads the critical art for the first screen
// with a counted loader; the bar shows real progress, at least BOOT.minShow, at most BOOT.maxWait (the rest loads in the background).
async function boot() {
  const view = mountBoot(ui, { tips: bootTips(ROSTER), reduced: reducedMotion });
  profile = await save.load();
  await persist(syncLives(profile, now()));
  const era = eraOf(profile.level).id;
  view.chooseBackground(profile, era);   // this launch's loading painting (crossfades in, never waited for)
  const loader = createLoader(bootTasks(era));
  await view.run(loader);
  await within(renderer.setEra(era), BOOT.stall, (ms) => new Promise((r) => setTimeout(r, ms)));   // instant once the loader is done
  applySettings();
  yuvi.initHelper({ stage, isOn: () => profile?.settings?.yuvi !== false, isReduced: reducedMotion });
  screen = view;
  document.documentElement.classList.remove('booting');
  await (firstLaunch() ? showIsland(ERAS[0].id, null, { hello: true }) : showHome());   // first launch: the first island, Yuvi says hello
  save.start();   // Play Games: silent sign-in check + cloud merge in the background; play never waits for it
}
boot().then(() => { preloadFx(); preloadAmbient(); if (location.search.includes('motion')) import('./render/motionlab.js').then((l) => l.mountLab({ renderer, ui, stage, fit, getProfile: () => profile })); });

if (import.meta.env.DEV || location.search.includes('debug')) {
  window.__dino = {
    get game() { return game; }, renderer, get profile() { return profile; }, hint: () => game && hintMove(game.state), CONFIG,
    setProfile: async (patch) => { await persist({ ...profile, ...patch }); },
    boosters: { give: async (n = 3) => { let p = profile; for (const k of Object.keys(BOOSTERS)) p = { ...p, boosters: { ...p.boosters, [k]: (p.boosters[k] || 0) + n } }; await persist(p); game?.view.boosters?.update(p.boosters); }, shop: (f) => openShop({ focus: f }), tap: (id) => boosterTap(id), use: (i) => runBooster(i), force: (id) => forceBooster(id) },
    go: { island: (id) => showIsland(id), home: showHome, howto: (all) => showHowTo(showHome, all), dig: () => showDig(showHome), museum: () => showMuseum(showHome), history: (id) => showHistory(FOSSILS.find((f) => f.id === id), showHome), lives: showOutOfLives, level: startLevel, play: (n) => startLevel(n, { skipPre: true }), test: (name, n = 40) => startLevel(n, { test: name }) },
    result: (won = true) => { const g = game; if (!g) return; g.state.status = won ? 'won' : 'lost'; if (won) g.state.score = g.state.score || 12480; return settle(g, won); },
    offer: () => { const g = game; if (g) return showNearMiss(g, { extraMoves: 5, coinCost: 50, blocksLeft: 2 }); },
    tests: ALL_TESTS,
    specialArt: { set: setSpecialUrls, urls: specialUrls },   // M10: swap the painted specials (debug screenshots: fallback / stand-ins)
    yuvi: { welcome: () => showWelcome(), helper: yuvi }
  };
}
// Debug picker (?debug): jump to any level, or start a board that is one swap away from each special / combination.
if (location.search.includes('debug')) import('./screens/debugpicker.js').then((m) => m.mountPicker({ ALL_TESTS, go: (n) => startLevel(n, { skipPre: true }), test: (name) => startLevel(40, { test: name }), home: () => showHome(), intros: () => showHowTo(showHome, true), yuvi: () => showYuviDebug() }));

// ?debug > Yuvi: every action, and every place he shows up (each opens the real screen with a suitable profile)
async function showYuviDebug() {
  const { mountYuviDebug } = await import('./screens/yuvidebug.js');
  const fresh = { seen: [1, 2, 3, 4, 5, 6], off: false, intros: [] };
  const setP = (patch) => persist({ ...profile, lives: CONFIG.lives.max, ...patch, settings: { ...profile.settings, yuvi: true } });
  const inLevel = async (n, fn) => { await setP({ level: n, tutorial: { ...fresh, off: true } }); await startLevel(n, { skipPre: true }); setTimeout(fn, dur(D.celebrate)); };
  const places = [
    ['Meet Yuvi again', () => showWelcome()],
    ['First launch (hello)', async () => { await setP({ level: 1, stars: {}, coach: { off: false, done: [] }, yuvi: { ...profile.yuvi, met: false } }); showIsland(ERAS[0].id, null, { hello: true }); }],
    ['Level 1: goal + swap', async () => { await setP({ level: 1, stars: {}, coach: { off: false, done: ['hello'] } }); startLevel(1, { skipPre: true }); }],
    ['First special', async () => { window.__coachTest = true; await setP({ tutorial: { seen: [], off: true, intros: [] }, coach: { off: false, done: ['hello', 'goal', 'swap', 'moves', 'combo'] } }); startLevel(9, { test: 'firecracker' }); }],
    ['5 moves left', () => inLevel(30, () => { if (game) { game.state.moves = 6; game.view.update({ moves: 6 }); persist(markCoach({ ...profile, coach: { off: false, done: [] } }, 'goal', 'swap', 'combo')); } })],
    ['First win: pickaxe', async () => { await setP({ coach: { off: false, done: ['hello', 'goal', 'swap', 'moves'] }, stars: {} }); inLevel(44, () => { if (game) { game.state.moves = 2; window.__dino.result(true); } }); }],
    ['Dig site: first dig', async () => { await setP({ pickaxes: 1, coach: { off: false, done: ['hello', 'goal', 'swap', 'moves', 'pickaxe'] }, fossilProgress: {}, completedFossils: [] }); showDig(showHome); }],
    ['First intro (hello)', async () => { await setP({ level: 8, tutorial: fresh, yuvi: { ...profile.yuvi, met: false } }); startLevel(8, { skipPre: true }); }],
    ['Booster intro', async () => { await setP({ level: 60, tutorial: { ...fresh, intros: Object.keys(INTROS).filter((k) => k !== 'bst-pick') }, yuvi: { ...profile.yuvi, met: true } }); startLevel(60, { skipPre: true }); }],
    ['Hard level intro', async () => { await setP({ level: 16, tutorial: { ...fresh, intros: Object.keys(INTROS).filter((k) => k !== 'tier-hard') }, yuvi: { ...profile.yuvi, met: true } }); startLevel(16, { skipPre: true }); }],
    ['Hint tip', () => inLevel(30, () => { if (game) { game.tut = null; persist({ ...profile, tutorial: fresh }).then(() => softIntro(INTROS.hint)); } })],
    ['Shuffle tip', () => inLevel(30, () => { if (game) persist({ ...profile, tutorial: fresh }).then(() => softIntro(INTROS.shuffle)); })],
    ['First combo tip', () => inLevel(30, () => { if (game) persist({ ...profile, tutorial: fresh }).then(() => softIntro({ title: 'Combo', text: COMBO_INTROS[0].text }, COMBO_INTROS[0].id, 'point')); })],
    ['Win', () => inLevel(44, () => { if (game) { game.state.moves = 1; window.__dino.result(true); } })],
    ['Win 3 stars', () => inLevel(44, () => { if (game) { game.state.moves = game.state.movesMax; window.__dino.result(true); } })],
    ['Win + fossil part', () => inLevel(62, () => window.__dino.result(true))],
    ['Lose', () => inLevel(44, () => window.__dino.result(false))],
    ['Out of moves', () => inLevel(62, () => window.__dino.offer())],
    ['Out of lives', async () => { await setP({ lives: 0 }); persist({ ...profile, lives: 0 }).then(() => showOutOfLives(profile.level)); }],
    ['Dig site', async () => { await setP({ pickaxes: 60 }); showDig(showHome); }],
    ['Shop (empty booster)', async () => { await setP({ level: 70, boosters: { ...profile.boosters, pick: 0 }, tutorial: { ...fresh, off: true } }); await startLevel(70, { skipPre: true }); setTimeout(() => boosterTap('pick'), dur(D.celebrate)); }],
    ['New island', async () => { await setP({ level: 151, yuvi: { ...profile.yuvi, welcomeSeen: true, islands: 1 } }); showHome(); }]
  ];
  mountYuviDebug(ui, { places });
}
