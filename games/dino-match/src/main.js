import { injectDesignSystem, loadFonts } from './ui/tokens.js';
import { reducedMotion } from './ui/motion.js';
import { D, dur, RECIPES } from './render/motion.js';
import { cue, unlock, setMuted, setHaptics } from './render/sound.js';
import { Renderer } from './render/renderer.js';
import { createState, swap, hintMove, addMoves } from './core/game.js';
import { generateLevel } from './core/level.js';
import { eraOf } from './core/eras.js';
import { settleLevel, doubleCoins, spendCoins } from './core/profile.js';
import { syncLives, canStartLevel, refillLives } from './core/lives.js';
import { digPart } from './core/fossils.js';
import { starsFor, nearMissOffer } from './core/rules.js';
import { CONFIG } from './core/config.js';
import { mountBoot } from './screens/boot.js';
import { mountHome } from './screens/home.js';
import { mountPlay } from './screens/play.js';
import { mountResult } from './screens/result.js';
import { mountDig } from './screens/dig.js';
import { mountOutOfLives } from './screens/lives.js';
import { mountOffer } from './screens/offer.js';
import { mountHistory } from './screens/history.js';
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
function fit() {
  const s = Math.min(innerWidth / 360, innerHeight / 640);
  stage.style.transform = `translate(${(innerWidth - 360 * s) / 2}px, ${(innerHeight - 640 * s) / 2}px) scale(${s})`;
  renderer.resize(s);
}
addEventListener('resize', fit);
fit();
document.body.classList.toggle('is-reduced', reducedMotion());

let profile, screen = null, game = null;
// Old screen fades out (and stops taking input) while the new one slides in; it is removed after the leave time.
const swapScreen = (next) => {
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
  game = null; renderer.clearLevel();
  await refreshLives();
  await renderer.setEra(eraOf(profile.level).id);
  swapScreen(mountHome(ui, { profile, now, onSetting: setSetting, onPlay: () => startLevel(profile.level), onDig: () => showDig(showHome) }));
}

async function showDig(back) {
  game = null; renderer.clearLevel();
  await refreshLives();
  await renderer.setEra(eraOf(profile.level).id);
  swapScreen(mountDig(ui, {
    profile, onBack: back,
    dig: () => { const r = digPart(profile); if (r.ok) persist(r.profile); return r; },
    onComplete: (fossil) => {
      ads.report(AD_EVENTS.fossilComplete, { fossil: fossil.id });
      swapScreen(mountHistory(ui, { fossil, onDone: () => showDig(back) }));
    }
  }));
}

async function showOutOfLives(levelNo) {
  game = null; renderer.clearLevel();
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
async function startLevel(n) {
  await refreshLives();
  if (!canStartLevel(profile, now())) return showOutOfLives(n);
  const level = generateLevel(n);
  const state = createState(level);
  await renderer.setEra(eraOf(n).id);
  renderer.startLevel(state);
  const view = mountPlay(ui, { level, state, tip: level.tip, onHome: () => { renderer.locked = true; showHome(); } });
  swapScreen(view);
  game = { level, state, view };
  renderer.getHint = () => hintMove(state);
  renderer.onSwap = (a, b) => onSwap(a, b);
  renderer.locked = false;
  ads.report(AD_EVENTS.levelStart, { level: n });
}

async function onSwap(a, b) {
  const g = game;
  if (!g || renderer.locked) return;
  const r = swap(g.state, a, b);
  if (!r.events.length) return;
  await renderer.play(r.events, {
    onMove: () => g.view.update({ moves: g.state.moves }),
    onDig: (dug, total) => g.view.update({ dug, total })
  });
  if (game !== g) return; // left the level while animating
  g.view.update({ moves: g.state.moves, dug: g.state.dug, total: g.state.dirtTotal });
  if (g.state.status === 'playing') { renderer.locked = false; return; }
  finish(g);
}

async function finish(g) {
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
    g.view.update({ moves: g.state.moves, dug: g.state.dug, total: g.state.dirtTotal });
    renderer.locked = false;
  };
  const view = mountOffer(ui, {
    offer, coins: profile.coins, ads,
    onCoins: async () => { const p = spendCoins(profile, offer.coinCost); if (!p) return; await persist(p); resume(); },
    onAd: () => { ads.report(AD_EVENTS.rewardedCompleted, { kind: 'extra_moves' }); resume(); },
    onDecline: () => { view.destroy(); settle(g, false); }
  });
}

async function settle(g, won) {
  const n = g.level.level;
  const stars = won ? starsFor(g.state) : 0;
  const { profile: p, rewards } = settleLevel(profile, n, { won, stars }, now());
  await persist(p);
  ads.report(won ? AD_EVENTS.levelComplete : AD_EVENTS.levelFailed, { level: n, stars });
  let current = p;
  swapScreen(mountResult(ui, {
    won, level: g.level, state: g.state, stars, rewards, lives: p.lives, ads,
    onNext: () => startLevel(n + 1), onRetry: () => startLevel(n), onHome: showHome,
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
    go: { home: showHome, dig: () => showDig(showHome), lives: showOutOfLives, level: startLevel }
  };
}
