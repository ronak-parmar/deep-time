import { injectDesignSystem, loadFonts } from './ui/tokens.js';
import { reducedMotion } from './ui/motion.js';
import { D, dur, RECIPES } from './render/motion.js';
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
import { mountHome } from './screens/home.js';
import { mountIsland } from './screens/island.js';
import { loadIslandArt } from './render/islandart.js';
import { mountPlay } from './screens/play.js';
import { mountPrelevel } from './screens/prelevel.js';
import { bestStars } from './core/journey.js';
import { mountTutorial } from './screens/tutorial.js';
import { needsTutorial, markTutorialSeen, skipTutorial } from './core/tutorial.js';
import './ui/kit.js';
import { mountIntro } from './screens/intro.js';
import { mountHowTo } from './screens/howto.js';
import { INTROS, introsFor, introNeeded, markIntroSeen, comboId, comboIntroFor, isPreIntro } from './data/intros.js';
import { setupTest, ALL_TESTS } from './core/testboards.js';
import { targetProgress } from './core/targets.js';
import { mountResult } from './screens/result.js';
import { mountDig } from './screens/dig.js';
import { mountOutOfLives } from './screens/lives.js';
import { mountOffer } from './screens/offer.js';
import { mountHistory } from './screens/history.js';
import { mountMuseum } from './screens/museum.js';
import { createLocalSaveStore } from './ports/save.js';
import { createMockAdPort, AD_EVENTS } from './ports/ads.js';

injectDesignSystem();
const stage = document.getElementById('stage');
const ui = document.getElementById('ui');
const renderer = new Renderer(document.getElementById('game'));
const save = createLocalSaveStore();
const ads = createMockAdPort();
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
  if (!old) return;
  old.el?.classList.add('leaving');
  setTimeout(() => old.destroy(), dur(RECIPES.screenChange.leave));
  cue('screenChange');
};
const applySettings = () => { setMuted(profile.settings.muted); setHaptics(profile.settings.haptics); };
const setSetting = async (k, v) => { await persist({ ...profile, settings: { ...profile.settings, [k]: v } }); applySettings(); };
// every button gets the press sound and haptic; the first touch also unlocks WebAudio
document.addEventListener('pointerdown', (e) => { unlock(); if (e.target.closest?.('button:not(:disabled)')) cue('buttonPress'); }, true);
const persist = async (p) => { profile = p; await save.save(p); return p; };
const refreshLives = async () => { const p = syncLives(profile, now()); if (p !== profile) await persist(p); };

// ---- screens -----------------------------------------------------------------------------
async function showHome() {
  setTall(true);
  game?.tut?.destroy(); game = null; renderer.clearLevel();
  await refreshLives();
  await renderer.setEra(eraOf(profile.level).id);
  await loadIslandArt(ERAS.map((e) => e.id));
  swapScreen(mountHome(ui, { profile, now, onSetting: setSetting, onPlay: () => startLevel(profile.level), onPlayLevel: (n) => startLevel(n), onHowTo: () => showHowTo(showHome), onDig: () => showDig(showHome), onMuseum: () => showMuseum(showHome), onShop: () => openShop({ onClose: showHome }), onCredits: () => mountCredits(ui, {}), onIsland: (id, origin) => showIsland(id, origin) }));
}

// Shop (docs/16): over whatever is on screen. Buying persists the profile; onClose runs when the player leaves it.
function openShop({ onClose, focus = null, level = profile.level } = {}) {
  return mountShop(ui, { profile, level, focus, onBuy: async (id) => { const q = buyBooster(profile, id); if (!q) return null; await persist(q); cue('boosterSelect'); game?.view.boosters?.update(q.boosters); return q; }, onClose });
}

function showHowTo(back, all = false) {
  setTall(true);
  swapScreen(mountHowTo(ui, { profile, onBack: back, all }));
}

async function showIsland(eraId, origin) {
  setTall(true);
  game?.tut?.destroy(); game = null; renderer.clearLevel();
  await refreshLives();
  lastIsland = eraId;
  swapScreen(mountIsland(ui, { profile, eraId, origin, onBack: () => { lastIsland = null; showHome(); }, onPlayLevel: (n) => startLevel(n) }));
}
let lastIsland = null;
const backToMap = () => (lastIsland ? showIsland(lastIsland) : showHome());
async function showDig(back) {
  setTall(true);
  game?.tut?.destroy(); game = null; renderer.clearLevel();
  await refreshLives();
  await renderer.setEra(eraOf(profile.level).id);
  swapScreen(mountDig(ui, {
    profile, now, level: profile.level, onBack: back,
    onPlay: () => startLevel(profile.level),
    onMuseum: () => showMuseum(() => showDig(back)),
    dig: () => { const r = digPart(profile); if (r.ok) persist(r.profile); return r; },
    onComplete: (fossil) => {
      ads.report(AD_EVENTS.fossilComplete, { fossil: fossil.id });
      showHistory(fossil, () => showDig(back));
    }
  }));
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
    if (!opts.test && needsTutorial(profile, n)) {    // first-time tutorial, levels 1-6: shown once, skippable, kept in the profile
      game.tut = mountTutorial({ level, state, renderer, onDone: () => persist(markTutorialSeen(profile, n)), onSkip: () => persist(skipTutorial(profile)) });
    } else if (!opts.test) {                          // new element on this level (data/intros.js): a card per element, once
      const list = introsFor(profile, level).filter((e) => !isPreIntro(e));
      if (list.length) game.tut = mountIntro({ entries: list, renderer, state, onDone: () => introDone(list), onSkip: () => persist(skipTutorial(profile)) });
    }
    renderer.getHint = () => { const m = hintMove(state); if (m && !opts.test && introNeeded(profile, 'hint')) softIntro(INTROS.hint); return m; };
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
  if (preIntros.length) mountIntro({ entries: preIntros, renderer, state, onDone: async () => { let p = markIntroSeen(profile, ...preIntros.map((e) => e.id)); for (const e of preIntros) p = giftBooster(p, e.booster); await persist(p); pv.setCounts(p.boosters); for (const e of preIntros) pv.select(e.booster); }, onSkip: () => persist(skipTutorial(profile)) });
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
  await renderer.play(r.events, { onMove: () => g.view.update({ moves: g.state.moves }), onDig: (dug, total) => g.view.update({ dug, total }) });
  if (game !== g) return;
  g.view.update({ moves: g.state.moves, state: g.state });
  void wasForced;
  if (g.state.status === 'playing') { renderer.locked = false; return; }
  finish(g);
}

// Small card for things that happen mid-level (hint, shuffle, a first combo). Never blocks; the next move removes it.
function softIntro(entry, seenId = entry.id) {
  if (!game || game.tut) return;
  persist(markIntroSeen(profile, seenId));
  game.tut = mountIntro({ entries: [entry], renderer, state: game.state, soft: true });
}

async function onSwap(a, b) {
  const g = game;
  if (!g || renderer.locked) return;
  if (g.force || g.pending) { renderer.doShake('tiny'); return; }   // a booster is being chosen (or its first use is required): no swaps
  if (g.tut?.el?.classList.contains('intro--soft')) { g.tut.destroy(); g.tut = null; }
  const sa = g.state.cells[a]?.s, sb = g.state.cells[b]?.s, combo = sa && sb ? comboIntroFor(sa, sb) : null;
  const r = swap(g.state, a, b);
  if (!r.events.length) return;
  await renderer.play(r.events, {
    onMove: () => g.view.update({ moves: g.state.moves }),
    onDig: (dug, total) => g.view.update({ dug, total })
  });
  if (game !== g) return; // left the level while animating
  g.view.update({ moves: g.state.moves, state: g.state });
  if (r.valid) g.tut?.moved();
  if (g.state.status === 'playing') {
    renderer.locked = false;
    if (!g.level.test) {
      if (combo && introNeeded(profile, combo.id)) softIntro({ title: combo.ids.map((k) => INTROS[k].title).join(' + '), text: combo.text, art: INTROS[combo.ids[0]].art, spot: 'board' }, combo.id);
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
    view.destroy();
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
}

async function settle(g, won) {
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
    onNext: () => startLevel(n + 1), onRetry: () => startLevel(n, { skipPre: true }), onHome: backToMap,
    onDig: () => showDig(showHome),
    onWait: () => showOutOfLives(n),
    onDouble: async () => { ads.report(AD_EVENTS.rewardedCompleted, { kind: 'double_coins' }); current = doubleCoins(profile, rewards.coins); await persist(current); }
  }));
  if (won) ads.report(AD_EVENTS.rewardedOffer, { kind: 'double_coins' });
}

async function boot() {
  const view = mountBoot(ui);
  view.setProgress(0.1);
  await loadFonts();
  view.setProgress(0.5);
  profile = await save.load();
  await persist(syncLives(profile, now()));
  await renderer.setEra(eraOf(profile.level).id);
  view.setProgress(1);
  applySettings();
  await new Promise((r) => setTimeout(r, dur(D.base)));
  screen = view;
  await showHome();
}
boot().then(() => { if (location.search.includes('motion')) import('./render/motionlab.js').then((l) => l.mountLab({ renderer, ui, stage, fit, getProfile: () => profile })); });

if (import.meta.env.DEV || location.search.includes('debug')) {
  window.__dino = {
    get game() { return game; }, renderer, get profile() { return profile; }, hint: () => game && hintMove(game.state), CONFIG,
    setProfile: async (patch) => { await persist({ ...profile, ...patch }); },
    boosters: { give: async (n = 3) => { let p = profile; for (const k of Object.keys(BOOSTERS)) p = { ...p, boosters: { ...p.boosters, [k]: (p.boosters[k] || 0) + n } }; await persist(p); game?.view.boosters?.update(p.boosters); }, shop: (f) => openShop({ focus: f }), tap: (id) => boosterTap(id), use: (i) => runBooster(i), force: (id) => forceBooster(id) },
    go: { island: (id) => showIsland(id), home: showHome, howto: (all) => showHowTo(showHome, all), dig: () => showDig(showHome), museum: () => showMuseum(showHome), history: (id) => showHistory(FOSSILS.find((f) => f.id === id), showHome), lives: showOutOfLives, level: startLevel, play: (n) => startLevel(n, { skipPre: true }), test: (name, n = 40) => startLevel(n, { test: name }) },
    result: (won = true) => { const g = game; if (!g) return; g.state.status = won ? 'won' : 'lost'; if (won) g.state.score = g.state.score || 12480; return settle(g, won); },
    offer: () => { const g = game; if (g) return showNearMiss(g, { extraMoves: 5, coinCost: 50, blocksLeft: 2 }); },
    tests: ALL_TESTS
  };
}
// Debug picker (?debug): jump to any level, or start a board that is one swap away from each special / combination.
if (location.search.includes('debug')) import('./screens/debugpicker.js').then((m) => m.mountPicker({ ALL_TESTS, go: (n) => startLevel(n, { skipPre: true }), test: (name) => startLevel(40, { test: name }), home: () => showHome(), intros: () => showHowTo(showHome, true) }));
