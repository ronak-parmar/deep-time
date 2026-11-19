import { describe, it, expect } from 'vitest';
import { AD_EVENTS, ADMOB, INTERSTITIAL_RULES, createAdPolicy, wrapAdMob, createAdPort, createMockAdPort } from '../src/ports/ads.js';

// A fake AdMob plugin: records calls; listeners fire on show.
function fakePlugin({ rewardOnShow = true, loadFails = false, consent = 'NOT_REQUIRED' } = {}) {
  const calls = [], listeners = {};
  const p = {
    calls,
    async initialize(o) { calls.push(['initialize', o]); },
    async requestConsentInfo() { calls.push(['consentInfo']); return { status: consent, isConsentFormAvailable: true }; },
    async showConsentForm() { calls.push(['consentForm']); return { status: 'OBTAINED' }; },
    async addListener(name, fn) { (listeners[name] ||= []).push(fn); return { remove() { listeners[name] = listeners[name].filter((f) => f !== fn); } }; },
    async prepareRewardVideoAd(o) { calls.push(['prepareRewarded', o.adId, o.isTesting]); if (loadFails) throw new Error('no fill'); },
    async showRewardVideoAd() {
      calls.push(['showRewarded']);
      if (rewardOnShow) (listeners.onRewardedVideoAdReward || []).forEach((f) => f({ type: 'Reward', amount: 1 }));
      (listeners.onRewardedVideoAdDismissed || []).forEach((f) => f());
      return rewardOnShow ? { type: 'Reward', amount: 1 } : { type: '', amount: 0 };
    },
    async prepareInterstitial(o) { calls.push(['prepareInter', o.adId]); if (loadFails) throw new Error('no fill'); },
    async showInterstitial() { calls.push(['showInter']); }
  };
  return p;
}
const names = (p) => p.calls.map((c) => c[0]);

describe('ads: interstitial policy', () => {
  it('never before fromLevel, needs `every` level ends, and keeps gaps after interstitials and rewarded ads', () => {
    const r = INTERSTITIAL_RULES, pol = createAdPolicy();
    for (let i = 0; i < r.every; i++) pol.levelEnded();
    expect(pol.allowInterstitial(r.fromLevel - 1, 1e9)).toBe(false);
    expect(pol.allowInterstitial(r.fromLevel, 1e9)).toBe(true);
    pol.interstitialShown(1e9);
    for (let i = 0; i < r.every; i++) pol.levelEnded();
    expect(pol.allowInterstitial(20, 1e9 + r.gapMs - 1)).toBe(false);
    expect(pol.allowInterstitial(20, 1e9 + r.gapMs)).toBe(true);
    pol.rewardedShown(2e9);
    expect(pol.allowInterstitial(20, 2e9 + r.afterRewardedMs - 1)).toBe(false);
  });
});

describe('ads: AdMob adapter', () => {
  it('uses Google test units unless live, and real units when live', async () => {
    const t = fakePlugin(); await wrapAdMob(t).showRewarded();
    expect(t.calls.find((c) => c[0] === 'prepareRewarded').slice(1)).toEqual([ADMOB.testRewarded, true]);
    const l = fakePlugin(); await wrapAdMob(l, { live: true }).showRewarded();
    expect(l.calls.find((c) => c[0] === 'prepareRewarded').slice(1)).toEqual([ADMOB.rewarded, false]);
    expect(ADMOB.appId).toMatch(/^ca-app-pub-\d+~\d+$/);
  });

  it('a watched rewarded ad completes; a skipped or failed one does not, and nothing throws', async () => {
    expect(await wrapAdMob(fakePlugin()).showRewarded()).toEqual({ completed: true });
    expect(await wrapAdMob(fakePlugin({ rewardOnShow: false })).showRewarded()).toEqual({ completed: false });
    expect(await wrapAdMob(fakePlugin({ loadFails: true })).showRewarded()).toEqual({ completed: false });
  });

  it('asks for consent only when required', async () => {
    const a = fakePlugin(); await wrapAdMob(a).init();
    expect(names(a)).not.toContain('consentForm');
    const b = fakePlugin({ consent: 'REQUIRED' }); await wrapAdMob(b).init();
    expect(names(b)).toContain('consentForm');
  });

  it('interstitial: preloaded at level end, shown between levels only when the policy allows', async () => {
    let t = 1e9;
    const p = fakePlugin(), port = wrapAdMob(p, { now: () => t });
    expect(await port.maybeInterstitial(20)).toBe(false);            // no levels finished yet
    for (let i = 0; i < INTERSTITIAL_RULES.every; i++) port.report(AD_EVENTS.levelComplete, { level: 20 });
    expect(await port.maybeInterstitial(3)).toBe(false);             // too early in the game
    expect(await port.maybeInterstitial(20)).toBe(true);
    expect(names(p).filter((n) => n === 'showInter')).toHaveLength(1);
    expect(await port.maybeInterstitial(21)).toBe(false);            // counter reset
  });
});

describe('ads: port used by main.js', () => {
  it('stays the mock when AdMob is not available (web, tests) and never shows interstitials', async () => {
    const port = createAdPort({ load: async () => null, mock: createMockAdPort({ delayMs: 0 }) });
    await port.ready;
    expect(port.native).toBe(false);
    expect(await port.showRewarded()).toEqual({ completed: true });
    expect(await port.maybeInterstitial(50)).toBe(false);
  });
  it('switches to AdMob once loaded', async () => {
    const p = fakePlugin();
    const port = createAdPort({ load: async () => wrapAdMob(p) });
    await port.ready;
    expect(port.native).toBe(true);
    expect(await port.showRewarded()).toEqual({ completed: true });
    expect(names(p)).toContain('showRewarded');
  });
});
