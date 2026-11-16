import { validateConfig, SEGMENTS } from './config.js';
import { createInitialState, normalizeState, MemorySaveStore } from './state.js';
import { toRngFn } from './rng.js';
import { NullAnalytics } from './analytics.js';

/** Events games report. Names follow docs/01 + docs/02. */
export const EVENTS = Object.freeze({
  APP_OPEN: 'app_open',
  LEVEL_START: 'level_start',
  LEVEL_COMPLETE: 'level_complete',
  LEVEL_FAILED: 'level_failed',
  NEAR_MISS: 'near_miss',
  STREAK_BROKEN: 'streak_broken',
  CELEBRATION_DONE: 'celebration_done', // milestone celebration screen finished
  BOOSTERS_EMPTY: 'boosters_empty', // Dino Match
});

export const GAMES = Object.freeze({ DINO_BREAK: 'dino-break', DINO_MATCH: 'dino-match' });

/** Why a forced ad was (not) approved. */
export const REASONS = Object.freeze({
  SHOW: 'roll_passed',
  ROLL_FAILED: 'roll_failed',
  NOT_APPLICABLE: 'not_applicable',
  NOT_HAPPY_MOMENT: 'not_happy_moment',
  ADS_REMOVED: 'ads_removed',
  IN_PLAY: 'in_play',
  LOST_ROUND: 'lost_round',
  NEAR_MISS: 'near_miss',
  EARLY_LEVELS: 'early_levels',
  FIRST_WIN_AFTER_LOSSES: 'first_win_after_losses',
  LOSS_STREAK_BLOCK: 'loss_streak_block',
  HISTORY_VIDEO: 'history_video',
  HARD_CAP: 'daily_hard_cap',
  COOLDOWN: 'cooldown',
  MIN_ROUNDS: 'min_rounds',
  AFTER_REWARDED: 'after_rewarded',
  NOT_READY: 'not_ready',
  AWAIT_CELEBRATION: 'await_celebration',
  NO_PENDING_MILESTONE: 'no_pending_milestone',
});

/** Rewarded offer types. The game decides what each one concretely grants. */
export const OFFERS = Object.freeze({
  DOUBLE_COINS: 'double_coins',
  SAVE_STREAK: 'save_streak',
  EXTRA_BALL: 'extra_ball', // dino-break near miss
  EXTRA_MOVES: 'extra_moves', // dino-match near miss (+5 moves)
  HELP: 'help',
  REFILL_BOOSTERS: 'refill_boosters',
});

const DAY_MS = 86400000;
const defaultDayKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * @typedef {Object} AdBrainOptions
 * @property {object} [config]            partial/remote config (validated + clamped)
 * @property {{load():any, save(s:any):any}} [store]  SaveStore (default: in-memory)
 * @property {import('./providers/IAdProvider.js').IAdProvider} [provider]
 * @property {import('./analytics.js').IAnalytics} [analytics]
 * @property {(() => number) | {next():number}} [rng]
 * @property {() => number} [clock]       ms; default Date.now
 * @property {(ms:number) => string} [dayKey]  day bucket for budgets; default local date
 */

export class AdBrain {
  /** @param {AdBrainOptions} [opts] */
  constructor(opts = {}) {
    const v = validateConfig(opts.config);
    this.config = v.config;
    this.configIssues = v.issues;
    this.store = opts.store ?? new MemorySaveStore();
    this.provider = opts.provider ?? null;
    this.analytics = opts.analytics ?? NullAnalytics;
    this.rng = toRngFn(opts.rng);
    this.clock = opts.clock ?? (() => Date.now());
    this.dayKey = opts.dayKey ?? defaultDayKey;
    this.state = createInitialState(this.clock());
    /** transient, not persisted */
    this.round = { level: null, inPlay: false, streakOffered: false, nearMissOffered: false, milestone: null };
    this._offerSeq = 0;
    this._decisionSeq = 0;
    this._openOffers = new Map();
    this._approved = null; // decision id approved for showing
    if (this.configIssues.length) this.analytics.track('config_issues', { count: this.configIssues.length });
  }

  /** Load persisted state. Call once at startup (use createAdBrain for the async-friendly shortcut). */
  async init() {
    let loaded = null;
    try {
      loaded = normalizeState(await this.store.load(), this.clock());
    } catch {
      loaded = null; // unreadable save: start fresh
    }
    if (loaded) this.state = loaded;
    this._rollDay(this.clock());
    return this;
  }

  // ---------------------------------------------------------------- public API

  /** Snapshot of persisted state (copy). */
  getState() {
    return structuredClone(this.state);
  }

  /** Which segment the player is in right now. */
  getSegment() {
    return this._segment(this.clock());
  }

  setAdsRemoved(value = true) {
    this.state.adsRemoved = !!value;
    this._persist();
  }
  recordPurchase({ removesAds = false } = {}) {
    this.state.lifetime.purchases++;
    if (removesAds) this.state.adsRemoved = true;
    this._persist();
  }
  /** Force a segment (null to go back to automatic classification). */
  setSegmentOverride(segment) {
    if (segment !== null && !SEGMENTS.includes(segment)) throw new RangeError(`unknown segment: ${segment}`);
    this.state.segmentOverride = segment;
    this._persist();
  }
  /** Keep coin total in the save so mergeStates can take the larger one. */
  setCoins(n) {
    this.state.coins = Math.max(0, Math.floor(n) || 0);
    this._persist();
  }

  /**
   * Report an event, get a decision. Pure bookkeeping: never touches an ad network.
   * @param {string} name one of EVENTS
   * @param {{level?:number, game?:string, streak?:number}} [payload]
   * @returns {Decision}
   */
  handleEvent(name, payload = {}) {
    const now = this.clock();
    this._rollDay(now);
    let d;
    switch (name) {
      case EVENTS.APP_OPEN:
        this.state.lifetime.sessions++;
        this.round.inPlay = false;
        d = this._blank(name, payload, REASONS.NOT_HAPPY_MOMENT);
        break;
      case EVENTS.LEVEL_START:
        this.round = { level: payload.level ?? null, inPlay: true, streakOffered: false, nearMissOffered: false, milestone: null };
        d = this._blank(name, payload, REASONS.IN_PLAY);
        break;
      case EVENTS.LEVEL_COMPLETE:
        d = this._onComplete(payload, now);
        break;
      case EVENTS.LEVEL_FAILED:
        d = this._onFailed(payload, now);
        break;
      case EVENTS.NEAR_MISS:
        d = this._blank(name, payload, REASONS.NEAR_MISS);
        this._offer(d, payload.game === GAMES.DINO_BREAK ? OFFERS.EXTRA_BALL : payload.game === GAMES.DINO_MATCH ? OFFERS.EXTRA_MOVES : OFFERS.HELP, 'near_miss', now);
        if (d.rewardedOffers.length) this.round.nearMissOffered = true;
        break;
      case EVENTS.STREAK_BROKEN:
        d = this._blank(name, payload, REASONS.LOST_ROUND);
        if (!this.round.streakOffered && !this.round.nearMissOffered) {
          const streak = payload.streak ?? 0;
          if (streak >= this.config.moments.streakSaveMin) {
            this._offer(d, OFFERS.SAVE_STREAK, 'streak_broken', now, { streak });
            if (d.rewardedOffers.length) this.round.streakOffered = true;
          }
        }
        break;
      case EVENTS.CELEBRATION_DONE:
        d = this._onCelebration(payload, now);
        break;
      case EVENTS.BOOSTERS_EMPTY:
        d = this._blank(name, payload, this.round.inPlay ? REASONS.IN_PLAY : REASONS.NOT_HAPPY_MOMENT);
        if (this.round.inPlay && !this.config.moments.boosterOfferAllowedInPlay) d.rewardedSuppressed = 'in_play';
        else this._offer(d, OFFERS.REFILL_BOOSTERS, 'boosters_empty', now);
        break;
      default:
        throw new RangeError(`unknown ad-brain event: ${name}`);
    }
    d.meta = this._meta();
    this._persist();
    this.analytics.track('ad_decision', { event: name, level: d.level, interstitial: d.interstitial.show, reason: d.interstitial.reason, probability: d.interstitial.probability, offers: d.rewardedOffers.map((o) => o.type), segment: d.segment });
    if (d.interstitial.show) this._approved = d.id;
    return d;
  }

  /**
   * Safety net for games that want to ask "may I show a forced ad right now?" at some other moment.
   * Mid-play and straight-after-loss are always refused.
   */
  requestInterstitial({ placement = 'custom' } = {}) {
    const now = this.clock();
    this._rollDay(now);
    const d = this._blank('request_interstitial', { level: this.round.level ?? this.state.highestLevel }, REASONS.NOT_APPLICABLE);
    const ctx = { placement, level: d.level, prevLoss: false, firstWinAfterLosses: false, blockedByLossStreak: false, milestone: false, afterLoss: this.state.lastRound === 'loss' };
    d.interstitial = this._evalInterstitial(ctx, now);
    d.meta = this._meta();
    if (d.interstitial.show) this._approved = d.id;
    return d;
  }

  /**
   * Show an approved forced ad through the provider and record it. Only counts if the provider really showed it.
   * @returns {Promise<{shown:boolean, reason?:string}>}
   */
  async showInterstitial(decision) {
    if (!decision?.interstitial?.show || decision.id !== this._approved) return { shown: false, reason: 'not_approved' };
    if (this.round.inPlay) return { shown: false, reason: REASONS.IN_PLAY };
    // re-check the time-based limits: a rewarded ad may have been watched since the decision was made
    const t = this.clock();
    if (this.state.lastRewardedAt !== null && t - this.state.lastRewardedAt < this.config.pacing.rewardedGuardSec * 1000) return { shown: false, reason: REASONS.AFTER_REWARDED };
    if (this.state.lastInterstitialAt !== null && t - this.state.lastInterstitialAt < this.config.pacing.cooldownSec * 1000) return { shown: false, reason: REASONS.COOLDOWN };
    if (!this.provider) throw new Error('showInterstitial needs a provider; use commitInterstitial() in decision-only mode');
    this._approved = null;
    let res;
    try {
      res = await this.provider.showInterstitial();
    } catch (e) {
      res = { shown: false, error: String(e?.message ?? e) };
    }
    if (!res?.shown) {
      this.analytics.track('interstitial_failed', { error: res?.error });
      return { shown: false, reason: res?.error ?? 'provider_failed' };
    }
    this.commitInterstitial();
    return { shown: true };
  }

  /** Record that a forced ad was shown (used by showInterstitial; call directly in decision-only mode). */
  commitInterstitial() {
    const now = this.clock();
    this._rollDay(now);
    this.state.day.interstitials++;
    this.state.lifetime.interstitials++;
    this.state.roundsSinceInterstitial = 0;
    this.state.lastInterstitialAt = now;
    this._approved = null;
    this._persist();
    this.analytics.track('interstitial_shown', { today: this.state.day.interstitials });
  }

  /**
   * Player tapped a rewarded offer: show it. Opt-in only; the brain never starts one by itself.
   * @returns {Promise<{shown:boolean, granted:boolean, offer:object, error?:string}>}
   */
  async showRewarded(offer) {
    if (!offer || !this._openOffers.has(offer.id)) return { shown: false, granted: false, offer, error: 'unknown_offer' };
    if (!this.provider) throw new Error('showRewarded needs a provider');
    this._openOffers.delete(offer.id);
    this.state.lifetime.rewardedAccepted++;
    let res;
    try {
      res = await this.provider.showRewarded();
    } catch (e) {
      res = { shown: false, rewarded: false, error: String(e?.message ?? e) };
    }
    const now = this.clock();
    this._rollDay(now);
    if (res?.shown) {
      this.state.lastRewardedAt = now;
      this.state.day.rewardedShown++;
    }
    const granted = !!(res?.shown && res?.rewarded);
    if (granted) {
      this.state.lifetime.rewardedCompleted++;
      if (offer.type === OFFERS.SAVE_STREAK && offer.payload?.streak) {
        this.state.winStreak = offer.payload.streak;
        this.state.lossStreak = Math.max(0, this.state.lossStreak - 1);
        this.state.lastRound = 'win';
        this.state.adBlockLevelsLeft = 0;
      }
    }
    this._persist();
    this.analytics.track('rewarded_result', { type: offer.type, shown: !!res?.shown, granted });
    return { shown: !!res?.shown, granted, offer, error: res?.error };
  }

  /** Player dismissed a rewarded offer. */
  declineRewarded(offer) {
    if (offer && this._openOffers.delete(offer.id)) {
      this.state.lifetime.rewardedDeclined++;
      this._persist();
    }
  }

  // ---------------------------------------------------------------- event handlers

  _onComplete(p, now) {
    const s = this.state;
    const level = p.level ?? this.round.level ?? s.highestLevel + 1;
    const prevLoss = s.lastRound === 'loss';
    const firstWinAfterLosses = s.lossStreak >= this.config.blocks.winAfterLossesThreshold;
    const blockedByLossStreak = s.adBlockLevelsLeft > 0;
    if (blockedByLossStreak) s.adBlockLevelsLeft--;

    s.lifetime.rounds++;
    s.lifetime.wins++;
    s.day.rounds++;
    s.roundsSinceInterstitial++;
    s.winStreak++;
    s.bestStreak = Math.max(s.bestStreak, s.winStreak);
    s.lossStreak = 0;
    s.lastRound = 'win';
    s.highestLevel = Math.max(s.highestLevel, level);
    this.round.inPlay = false;
    this.round.level = level;
    this.round.streakOffered = false;

    const d = this._blank(EVENTS.LEVEL_COMPLETE, { ...p, level }, REASONS.NOT_APPLICABLE);
    const m = this.config.moments;
    d.historyVideo = level > 0 && level % m.historyVideoEvery === 0;
    const milestone = level > 0 && level % m.milestoneEvery === 0;
    const ctx = { placement: 'level_clear', level, prevLoss, firstWinAfterLosses, blockedByLossStreak, milestone: false };
    if (milestone) {
      // interstitial waits for the celebration screen; remember what we knew now
      this.round.milestone = { ...ctx, placement: 'milestone', milestone: true, level };
      d.interstitial = { ...d.interstitial, show: false, reason: REASONS.AWAIT_CELEBRATION, placement: 'milestone' };
    } else {
      d.interstitial = this._evalInterstitial({ ...ctx, historyVideo: d.historyVideo }, now);
    }
    this._offer(d, OFFERS.DOUBLE_COINS, firstWinAfterLosses ? 'comeback' : 'clear', now);
    return d;
  }

  _onFailed(p, now) {
    const s = this.state;
    const level = p.level ?? this.round.level ?? s.highestLevel + 1;
    const brokenStreak = s.winStreak;
    s.lifetime.rounds++;
    s.lifetime.losses++;
    s.day.rounds++;
    s.roundsSinceInterstitial++;
    s.winStreak = 0;
    s.lossStreak++;
    s.lastRound = 'loss';
    if (s.lossStreak >= this.config.blocks.lossStreakBlock) s.adBlockLevelsLeft = this.config.blocks.levelsBlockedAfterLossStreak;
    this.round.inPlay = false;
    this.round.level = level;

    const d = this._blank(EVENTS.LEVEL_FAILED, { ...p, level }, REASONS.LOST_ROUND);
    if (brokenStreak >= this.config.moments.streakSaveMin) d.streakBroken = { streak: brokenStreak };
    if (!this.round.nearMissOffered) {
      if (d.streakBroken && !this.round.streakOffered) {
        this._offer(d, OFFERS.SAVE_STREAK, 'streak_broken', now, { streak: brokenStreak });
        if (d.rewardedOffers.length) this.round.streakOffered = true;
      } else if (s.lossStreak >= this.config.moments.helpLossStreak) {
        this._offer(d, OFFERS.HELP, 'loss_streak', now);
      }
    }
    return d;
  }

  _onCelebration(p, now) {
    const pending = this.round.milestone;
    const d = this._blank(EVENTS.CELEBRATION_DONE, p, REASONS.NO_PENDING_MILESTONE);
    if (!pending || (p.level !== undefined && p.level !== pending.level)) return d;
    this.round.milestone = null;
    d.level = pending.level;
    d.historyVideo = pending.level % this.config.moments.historyVideoEvery === 0;
    d.interstitial = this._evalInterstitial({ ...pending, historyVideo: d.historyVideo }, now);
    return d;
  }

  // ---------------------------------------------------------------- forced-ad evaluation

  _evalInterstitial(ctx, now) {
    const c = this.config;
    const s = this.state;
    const segment = this._segment(now);
    const out = { show: false, reason: REASONS.NOT_APPLICABLE, placement: ctx.placement, probability: 0, roll: null, factors: null };
    const block = (reason) => ((out.reason = reason), out);

    // hard blocks, in docs/02 order. None of these depend on config values being "nice".
    if (segment === 'ads_removed') return block(REASONS.ADS_REMOVED);
    if (this.round.inPlay) return block(REASONS.IN_PLAY);
    if (ctx.afterLoss) return block(REASONS.LOST_ROUND);
    if (ctx.level < c.blocks.minInterstitialLevel) return block(REASONS.EARLY_LEVELS);
    if (ctx.firstWinAfterLosses) return block(REASONS.FIRST_WIN_AFTER_LOSSES);
    if (ctx.blockedByLossStreak) return block(REASONS.LOSS_STREAK_BLOCK);
    if (ctx.historyVideo && c.moments.historyVideoSuppressesInterstitial) return block(REASONS.HISTORY_VIDEO);
    // pacing limits
    if (s.day.interstitials >= c.pacing.hardCapPerDay) return block(REASONS.HARD_CAP);
    if (s.lastInterstitialAt !== null && now - s.lastInterstitialAt < c.pacing.cooldownSec * 1000) return block(REASONS.COOLDOWN);
    if (s.roundsSinceInterstitial < c.pacing.minRoundsBetween) return block(REASONS.MIN_ROUNDS);
    if (s.lastRewardedAt !== null && now - s.lastRewardedAt < c.pacing.rewardedGuardSec * 1000) return block(REASONS.AFTER_REWARDED);
    if (this.provider && !this.provider.isInterstitialReady()) {
      this._preload('loadInterstitial'); // ask the network for another ad so the next moment has one
      return block(REASONS.NOT_READY);
    }

    const f = this._probability(ctx, segment);
    out.factors = f;
    out.probability = f.final;
    // Never certain: clamp the draw below 1 so `roll < p` can only be true for p > 0 and p <= max (0.9).
    const raw = this.rng();
    out.roll = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 0.999999) : 0.999999;
    out.show = out.roll < out.probability;
    out.reason = out.show ? REASONS.SHOW : REASONS.ROLL_FAILED;
    return out;
  }

  _probability(ctx, segment) {
    const c = this.config;
    const p = c.prob;
    const s = this.state;
    const seg = c.segments[segment] ?? c.segments.regular;
    const soft = Math.max(0, Math.round(c.pacing.softBudgetPerDay * seg.budgetScale));
    const overSoft = s.day.interstitials >= soft;
    const streak = Math.min(s.winStreak, p.streakCap);
    const expected = (c.pacing.softBudgetPerDay / c.catchUp.expectedRoundsPerDay) * s.day.rounds;
    const behind = !overSoft && s.day.rounds >= c.catchUp.minRounds && s.day.interstitials < expected - c.catchUp.tolerance;
    const starved = s.roundsSinceInterstitial >= p.starvationRounds;
    const f = {
      base: p.base,
      winStreak: streak * p.perWinStreak,
      loss: ctx.prevLoss ? -p.lossPenalty : 0,
      adsToday: -s.day.interstitials * p.perAdToday,
      milestone: ctx.milestone ? p.milestoneBonus : 0,
      catchUp: behind ? p.catchUpBonus : 0,
      starvation: starved ? p.starvationBonus : 0,
    };
    let sum = f.base + f.winStreak + f.loss + f.adsToday + f.milestone + f.catchUp + f.starvation;
    f.subtotal = sum;
    f.segment = segment;
    f.segmentScale = seg.probScale;
    f.softBudget = soft;
    f.overSoftBudget = overSoft;
    f.overBudgetScale = overSoft ? p.softBudgetOverageScale : 1;
    sum = sum * seg.probScale * f.overBudgetScale;
    // hard ceiling: 0.9 in code, whatever the config says
    f.final = Math.min(0.9, p.max, Math.max(0, sum));
    return f;
  }

  // ---------------------------------------------------------------- rewarded offers

  _offer(d, type, placement, now, payload) {
    const c = this.config.pacing;
    const s = this.state;
    let why = null;
    if (s.day.rewardedOffered >= c.rewardedMaxPerDay) why = 'daily_offer_cap';
    else if (s.lastRewardedOfferAt !== null && now - s.lastRewardedOfferAt < c.rewardedMinGapSec * 1000) why = 'offer_gap';
    else if (this.provider && !this.provider.isRewardedReady()) {
      why = 'no_fill';
      this._preload('loadRewarded');
    }
    if (why) {
      d.rewardedSuppressed = why;
      return null;
    }
    const offer = { id: `o${++this._offerSeq}`, type, placement, ...(payload ? { payload } : {}) };
    s.day.rewardedOffered++;
    s.lifetime.rewardedOffered++;
    s.lastRewardedOfferAt = now;
    this._openOffers.set(offer.id, offer);
    d.rewardedOffers.push(offer);
    return offer;
  }

  // ---------------------------------------------------------------- helpers

  _blank(event, payload, reason) {
    return {
      id: ++this._decisionSeq,
      event,
      level: payload.level ?? this.round.level ?? null,
      game: payload.game ?? null,
      segment: this._segment(this.clock()),
      interstitial: { show: false, reason, placement: null, probability: 0, roll: null, factors: null },
      rewardedOffers: [],
      rewardedSuppressed: null,
      historyVideo: false,
      streakBroken: null,
      meta: null,
    };
  }

  _meta() {
    const s = this.state;
    return { adsToday: s.day.interstitials, rewardedOfferedToday: s.day.rewardedOffered, roundsSinceInterstitial: s.roundsSinceInterstitial, winStreak: s.winStreak, lossStreak: s.lossStreak };
  }

  _segment(now) {
    const s = this.state;
    const r = this.config.segmentRules;
    if (s.adsRemoved || s.segmentOverride === 'ads_removed') return 'ads_removed';
    if (s.segmentOverride) return s.segmentOverride;
    if (s.lifetime.purchases > 0) return 'spender';
    const days = Math.floor((now - s.installedAt) / DAY_MS);
    if (s.highestLevel < r.newMaxLevels && days <= r.newMaxDays) return 'new';
    if (s.lifetime.rewardedOffered >= r.minOffersForRates) {
      const rate = s.lifetime.rewardedAccepted / s.lifetime.rewardedOffered;
      if (rate >= r.rewardedLoverRate) return 'rewarded_lover';
      if (rate <= r.adAverseRate) return 'ad_averse';
    }
    return 'regular';
  }

  _rollDay(now) {
    const key = this.dayKey(now);
    if (this.state.day.key !== key) this.state.day = { key, interstitials: 0, rewardedOffered: 0, rewardedShown: 0, rounds: 0 };
  }

  _preload(method) {
    try {
      const r = this.provider[method]();
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch {
      /* a failing preload must never reach the game */
    }
  }

  _persist() {
    try {
      const r = this.store.save(this.state);
      if (r && typeof r.catch === 'function') r.catch((e) => this.analytics.track('save_error', { error: String(e) }));
    } catch (e) {
      this.analytics.track('save_error', { error: String(e) });
    }
  }
}

/** Create and load a brain in one call. */
export async function createAdBrain(opts = {}) {
  return new AdBrain(opts).init();
}

/**
 * @typedef {Object} Decision
 * @property {number} id
 * @property {string} event
 * @property {number|null} level
 * @property {string|null} game
 * @property {string} segment
 * @property {{show:boolean, reason:string, placement:string|null, probability:number, roll:number|null, factors:object|null}} interstitial
 * @property {{id:string, type:string, placement:string, payload?:object}[]} rewardedOffers
 * @property {string|null} rewardedSuppressed
 * @property {boolean} historyVideo   play the history video (NOT an ad, never counted)
 * @property {{streak:number}|null} streakBroken
 * @property {object} meta
 */
