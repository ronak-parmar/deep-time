// AdPort: the only thing the game knows about ads. Two adapters: the mock (web, tests) and AdMob (Android build,
// @capacitor-community/admob, loaded lazily). Event names follow docs/02. See docs/20-ads.md.
export const AD_EVENTS = Object.freeze({
  levelStart: 'level_start',
  levelComplete: 'level_complete',
  levelFailed: 'level_failed',
  nearMiss: 'near_miss',
  streakBroken: 'streak_broken',
  boosterEmpty: 'booster_empty',
  rewardedOffer: 'rewarded_offer',       // payload: { kind: 'double_coins' | 'extra_moves' | 'refill_lives' }
  rewardedCompleted: 'rewarded_completed',
  livesEmpty: 'lives_empty',
  fossilComplete: 'fossil_complete'
});

// The mock never shows interstitials. Its rewarded ad "completes" after `delayMs` (set `completes:false` to test skips).
export function createMockAdPort({ log = false, delayMs = 700, completes = true } = {}) {
  const sent = [];
  return {
    sent,
    report(event, payload = {}) {
      sent.push({ event, payload });
      if (log) console.debug('[ads]', event, payload);
    },
    // kind: 'interstitial' | 'rewarded_offer'. The mock never shows anything.
    async requestDecision(kind) {
      return { kind, show: false };
    },
    async showRewarded() {
      await new Promise((r) => setTimeout(r, delayMs));
      return { completed: completes };
    },
    async maybeInterstitial() { return false; }
  };
}

// ---- AdMob ----------------------------------------------------------------------------------------------------
// Real IDs (AdMob app "Dino Match"). The app ID also goes in AndroidManifest.xml (apk.yml writes it).
export const ADMOB = Object.freeze({
  appId: 'ca-app-pub-5244654412310526~2506824278',
  rewarded: 'ca-app-pub-5244654412310526/2999272155',      // "Rewarded - extra moves" (used for every opt-in reward)
  interstitial: 'ca-app-pub-5244654412310526/6661691707',  // "Interstitial - between levels"
  // Google's public sample units: always fill, never earn, safe to tap. Used unless the build is live.
  testRewarded: 'ca-app-pub-3940256099942544/5224354917',
  testInterstitial: 'ca-app-pub-3940256099942544/1033173712'
});

// When an interstitial may show. Only ever between levels (the player pressed Next or Home on the result screen),
// never in the first levels, at most every `every` finished levels, with a gap since the last interstitial and since
// the last rewarded ad (someone who just chose to watch an ad is not shown another one).
export const INTERSTITIAL_RULES = Object.freeze({ fromLevel: 8, every: 3, gapMs: 150000, afterRewardedMs: 90000 });

export function createAdPolicy(rules = INTERSTITIAL_RULES) {
  let ends = 0, lastInter = -Infinity, lastRewarded = -Infinity;
  return {
    levelEnded() { ends++; },
    rewardedShown(now) { lastRewarded = now; },
    interstitialShown(now) { lastInter = now; ends = 0; },
    allowInterstitial(level, now) {
      return level >= rules.fromLevel && ends >= rules.every && now - lastInter >= rules.gapMs && now - lastRewarded >= rules.afterRewardedMs;
    }
  };
}

// Wrap the AdMob plugin (or a fake in tests). Never throws: a failed load or show is "no ad" (rewarded: not completed).
export function wrapAdMob(plugin, { live = false, now = () => Date.now(), policy = createAdPolicy(), log = false } = {}) {
  const sent = [];
  const ids = { rewarded: live ? ADMOB.rewarded : ADMOB.testRewarded, interstitial: live ? ADMOB.interstitial : ADMOB.testInterstitial };
  const opts = (adId) => ({ adId, isTesting: !live });
  let ready = null, interLoaded = null;
  const init = () => (ready ??= (async () => {
    try {
      await plugin.initialize({ initializeForTesting: !live, tagForUnderAgeOfConsent: false, maxAdContentRating: 'ParentalGuidance' });
      // UMP consent (EEA/UK): ask once if required; ads can still be requested afterwards with whatever was chosen
      try {
        const info = await plugin.requestConsentInfo();
        if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') await plugin.showConsentForm();
      } catch { /* consent service unreachable: carry on */ }
      return true;
    } catch { return false; }
  })());
  const preloadInterstitial = () => (interLoaded ??= init().then((ok) => ok && plugin.prepareInterstitial(opts(ids.interstitial)).then(() => true, () => false)).then((ok) => { if (!ok) interLoaded = null; return ok; }));
  return {
    sent, ids, init,
    report(event, payload = {}) {
      sent.push({ event, payload });
      if (log) console.debug('[ads]', event, payload);
      if (event === AD_EVENTS.levelComplete || event === AD_EVENTS.levelFailed) { policy.levelEnded(); preloadInterstitial(); }
    },
    async requestDecision(kind) { return { kind, show: kind === 'interstitial' ? policy.allowInterstitial(Infinity, now()) : true }; },
    async showRewarded() {
      if (!(await init())) return { completed: false };
      let rewarded = false;
      const handles = [];
      try {
        handles.push(await plugin.addListener('onRewardedVideoAdReward', () => { rewarded = true; }));
        await plugin.prepareRewardVideoAd(opts(ids.rewarded));
        const closed = new Promise((res) => {
          Promise.all([
            plugin.addListener('onRewardedVideoAdDismissed', res),
            plugin.addListener('onRewardedVideoAdFailedToShow', res)
          ]).then((hs) => handles.push(...hs));
        });
        const item = await plugin.showRewardVideoAd();
        if (item && (item.amount > 0 || item.type)) rewarded = true;
        await Promise.race([closed, new Promise((r) => setTimeout(r, 1500))]);
      } catch { /* no fill, offline, closed early */ }
      finally { for (const h of handles) try { h && h.remove && h.remove(); } catch { /* ignore */ } }
      if (rewarded) policy.rewardedShown(now());
      return { completed: rewarded };
    },
    // Call between levels. Resolves true if an interstitial was shown (after it closes), false straight away otherwise.
    async maybeInterstitial(level) {
      if (!policy.allowInterstitial(level, now())) return false;
      if (!(await preloadInterstitial())) return false;
      interLoaded = null;
      try { await plugin.showInterstitial(); policy.interstitialShown(now()); return true; } catch { return false; }
    }
  };
}

// The real port: only on a native Android build with the plugin present; the module is loaded lazily, so the web
// build and the tests never need it. Live ads only when the build sets VITE_ADS_LIVE=1 (repository variable ADS_LIVE).
export async function createAdMobPort({ live = false } = {}) {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android' || !Capacitor.isPluginAvailable('AdMob')) return null;
    const { AdMob } = await import('@capacitor-community/admob');
    const port = wrapAdMob(AdMob, { live });
    port.init();
    return port;
  } catch {
    return null;
  }
}

// What main.js uses: starts as the mock (so the first screens never wait) and switches to AdMob once it is available.
export function createAdPort({ live = false, mock = createMockAdPort(), load = createAdMobPort } = {}) {
  let real = null;
  const ready = Promise.resolve(load({ live })).then((p) => { real = p; return !!p; }, () => false);
  const port = () => real || mock;
  return {
    ready,
    get native() { return !!real; },
    report: (e, p) => port().report(e, p),
    requestDecision: (k) => port().requestDecision(k),
    showRewarded: () => port().showRewarded(),
    maybeInterstitial: (level) => (real ? real.maybeInterstitial(level) : Promise.resolve(false))
  };
}
