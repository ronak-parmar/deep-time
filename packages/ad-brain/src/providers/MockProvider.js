import { createRng, toRngFn } from '../rng.js';

/**
 * Configurable fake ad network. Deterministic when given a seeded rng.
 *
 * @typedef {Object} MockProviderOptions
 * @property {number} [interstitialFillRate=1]   chance an ad is available when asked to load
 * @property {number} [rewardedFillRate=1]
 * @property {number} [latencyMs=0]              await time on load/show (real timers)
 * @property {number} [failRate=0]               chance a show() errors out
 * @property {number} [interstitialShowMs=0]     how long a shown interstitial "plays" (awaited via sleep)
 * @property {number} [rewardedShowMs=0]
 * @property {number} [rewardedCompletionRate=1] chance the user watches enough to be rewarded
 * @property {() => number} [rng]
 * @property {(ms:number)=>Promise<void>} [sleep]
 */
export class MockProvider {
  /** @param {MockProviderOptions} [opts] */
  constructor(opts = {}) {
    this.opts = { interstitialFillRate: 1, rewardedFillRate: 1, latencyMs: 0, failRate: 0, interstitialShowMs: 0, rewardedShowMs: 0, rewardedCompletionRate: 1, ...opts };
    this.rng = toRngFn(opts.rng ?? createRng(1));
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.ready = { interstitial: false, rewarded: false };
    this.stats = { interstitialShown: 0, rewardedShown: 0, rewardedGranted: 0, failures: 0, loads: 0 };
    this.initialized = false;
  }
  async _wait() {
    if (this.opts.latencyMs > 0) await this.sleep(this.opts.latencyMs);
  }
  async init() {
    await this._wait();
    this.initialized = true;
    await this.loadInterstitial();
    await this.loadRewarded();
  }
  isInterstitialReady() {
    return this.initialized && this.ready.interstitial;
  }
  isRewardedReady() {
    return this.initialized && this.ready.rewarded;
  }
  async loadInterstitial() {
    await this._wait();
    this.stats.loads++;
    this.ready.interstitial = this.rng() < this.opts.interstitialFillRate;
    return this.ready.interstitial;
  }
  async loadRewarded() {
    await this._wait();
    this.stats.loads++;
    this.ready.rewarded = this.rng() < this.opts.rewardedFillRate;
    return this.ready.rewarded;
  }
  async showInterstitial() {
    if (!this.isInterstitialReady()) return { shown: false, error: 'not_ready' };
    await this._wait();
    this.ready.interstitial = false;
    if (this.rng() < this.opts.failRate) {
      this.stats.failures++;
      await this.loadInterstitial();
      return { shown: false, error: 'show_failed' };
    }
    this.stats.interstitialShown++;
    if (this.opts.interstitialShowMs > 0) await this.sleep(this.opts.interstitialShowMs);
    await this.loadInterstitial(); // preload the next one
    return { shown: true };
  }
  async showRewarded() {
    if (!this.isRewardedReady()) return { shown: false, rewarded: false, error: 'not_ready' };
    await this._wait();
    this.ready.rewarded = false;
    if (this.rng() < this.opts.failRate) {
      this.stats.failures++;
      await this.loadRewarded();
      return { shown: false, rewarded: false, error: 'show_failed' };
    }
    this.stats.rewardedShown++;
    if (this.opts.rewardedShowMs > 0) await this.sleep(this.opts.rewardedShowMs);
    const rewarded = this.rng() < this.opts.rewardedCompletionRate;
    if (rewarded) this.stats.rewardedGranted++;
    await this.loadRewarded();
    return { shown: true, rewarded };
  }
}
