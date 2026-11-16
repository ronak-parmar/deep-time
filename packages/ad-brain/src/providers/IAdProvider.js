/**
 * Ad provider interface. Mock first (MockProvider), AdMob later (test IDs only until approved).
 * Only the ad-brain talks to a provider; games never do.
 *
 * @typedef {Object} ShowInterstitialResult
 * @property {boolean} shown
 * @property {string} [error]
 *
 * @typedef {Object} ShowRewardedResult
 * @property {boolean} shown      the ad was displayed
 * @property {boolean} rewarded   the user earned the reward (watched enough)
 * @property {string} [error]
 *
 * @typedef {Object} IAdProvider
 * @property {() => Promise<void>} init
 * @property {() => boolean} isInterstitialReady
 * @property {() => boolean} isRewardedReady
 * @property {() => Promise<boolean>} loadInterstitial
 * @property {() => Promise<boolean>} loadRewarded
 * @property {() => Promise<ShowInterstitialResult>} showInterstitial
 * @property {() => Promise<ShowRewardedResult>} showRewarded
 */

export const PROVIDER_METHODS = Object.freeze([
  'init',
  'isInterstitialReady',
  'isRewardedReady',
  'loadInterstitial',
  'loadRewarded',
  'showInterstitial',
  'showRewarded',
]);

/** Returns the names of required methods a provider is missing (empty array = valid). */
export function missingProviderMethods(provider) {
  return PROVIDER_METHODS.filter((m) => !provider || typeof provider[m] !== 'function');
}
