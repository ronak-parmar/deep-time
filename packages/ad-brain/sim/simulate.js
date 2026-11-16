#!/usr/bin/env node
/**
 * ad-brain simulator: synthetic players play through the real brain with a mock ad network
 * and a virtual clock. Use it to tune the numbers in src/config.js (docs/02 numbers are placeholders).
 *
 *   node sim/simulate.js --players 1000 --days 7 --seed 1
 *   node sim/simulate.js --set prob.base=0.25 --set pacing.softBudgetPerDay=3
 *   node sim/simulate.js --sweep prob.base=0.2,0.35,0.5
 *   node sim/simulate.js --help
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createAdBrain, createRng, hashSeed, MemorySaveStore, MockProvider, validateConfig } from '../src/index.js';
import { PROFILES, DEFAULT_MIX, ANNOY_PER_AD, MAX_DAILY_HAZARD } from './profiles.js';

const DAY = 86400000;
const EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0);
const AD_SEC = { interstitial: 20, rewarded: 30, video: 25, between: 8 };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** Run the simulation. Returns plain data (see formatReport for the text view). */
export async function runSimulation(opts = {}) {
  const o = {
    players: 500, days: 7, seed: 1, config: undefined, mix: DEFAULT_MIX, game: 'mixed',
    ecpmInterstitial: 8, ecpmRewarded: 14, // USD per 1000 impressions, placeholders
    interstitialFill: 0.85, rewardedFill: 0.9, failRate: 0.02, ...opts,
  };
  const { config } = validateConfig(o.config);
  const names = Object.keys(o.mix);
  const total = names.reduce((a, n) => a + o.mix[n], 0);
  const pick = (r) => { let x = r * total; for (const n of names) { x -= o.mix[n]; if (x < 0) return n; } return names[names.length - 1]; };
  const root = createRng(hashSeed(`mix:${o.seed}`));

  const newBucket = () => ({ players: 0, activeDays: 0, sessions: 0, rounds: 0, interstitials: 0, rewardedShown: 0, offers: 0, accepted: 0, hazardSum: 0 });
  const agg = { all: newBucket(), byProfile: {}, reasons: {}, happyMoments: 0, adsPerDay: [], daysSoft: 0, daysHard: 0, daysAtOfferCap: 0, offerSuppressed: {}, violations: {}, alive: Array(o.days).fill(0), videos: 0, installs: o.players };
  const violate = (k) => (agg.violations[k] = (agg.violations[k] || 0) + 1);

  for (let i = 0; i < o.players; i++) {
    const profName = pick(root());
    const prof = PROFILES[profName];
    const rng = createRng(hashSeed(`${o.seed}:p:${i}`));
    const game = o.game === 'mixed' ? (i % 2 ? 'dino-match' : 'dino-break') : o.game;
    const time = { now: EPOCH };
    const provider = new MockProvider({
      interstitialFillRate: o.interstitialFill, rewardedFillRate: o.rewardedFill, failRate: o.failRate, rng: rng.fork('provider'),
      interstitialShowMs: AD_SEC.interstitial * 1000, rewardedShowMs: AD_SEC.rewarded * 1000,
      sleep: async (ms) => { time.now += ms; }, // virtual time: the ad "plays" on the sim clock
    });
    await provider.init();
    const brain = await createAdBrain({ config: o.config, store: new MemorySaveStore(), provider, rng: rng.fork('brain'), clock: () => time.now, dayKey: (ms) => String(Math.floor((ms - EPOCH) / DAY)) });
    const bucket = (agg.byProfile[profName] ||= newBucket());
    bucket.players++; agg.all.players++;
    if (prof.purchases) brain.recordPurchase();

    const p = { level: 1, assist: 0, lastIntAt: null, lastRewAt: null, roundsSinceInt: 99, lastWin: true, intToday: 0 };
    let churned = false;

    const bump = (k, n = 1) => { bucket[k] += n; agg.all[k] += n; };
    const tryRewarded = async (d, boost = 1) => {
      let granted = false;
      if (d.rewardedSuppressed) agg.offerSuppressed[d.rewardedSuppressed] = (agg.offerSuppressed[d.rewardedSuppressed] || 0) + 1;
      for (const offer of d.rewardedOffers) {
        bump('offers');
        if (rng() < clamp(prof.acceptRewarded * boost, 0, 1)) {
          bump('accepted');
          const r = await brain.showRewarded(offer);
          if (r.shown) {
            p.lastRewAt = time.now; bump('rewardedShown');
            if (r.granted) granted = true;
          }
        } else brain.declineRewarded(offer);
      }
      return granted;
    };
    const tryInterstitial = async (d) => {
      agg.happyMoments++;
      const r = d.interstitial.reason;
      if (!d.interstitial.show) { agg.reasons[r] = (agg.reasons[r] || 0) + 1; return false; }
      const s = brain.getState();
      const res = await brain.showInterstitial(d);
      if (!res.shown) { agg.reasons[`blocked_at_show:${res.reason}`] = (agg.reasons[`blocked_at_show:${res.reason}`] || 0) + 1; return false; }
      agg.reasons.shown = (agg.reasons.shown || 0) + 1;
      // independent check of docs/02 hard limits against what really happened
      const c = config;
      if (d.level < c.blocks.minInterstitialLevel) violate('level_1_to_3');
      if (!p.lastWin) violate('after_loss');
      if (p.lastIntAt !== null && time.now - p.lastIntAt < c.pacing.cooldownSec * 1000) violate('cooldown');
      if (p.lastRewAt !== null && time.now - p.lastRewAt < c.pacing.rewardedGuardSec * 1000) violate('after_rewarded');
      if (p.roundsSinceInt < c.pacing.minRoundsBetween) violate('min_rounds');
      if (s.day.interstitials + 1 > c.pacing.hardCapPerDay) violate('hard_cap');
      p.lastIntAt = time.now; p.roundsSinceInt = 0; p.intToday++;
      bump('interstitials');
      return true;
    };

    for (let day = 0; day < o.days && !churned; day++) {
      if (day > 0 && rng() > prof.returnRate) continue;
      agg.alive[day]++;
      bump('activeDays');
      p.intToday = 0;
      const nSessions = Math.max(1, Math.round(prof.sessionsPerDay + (rng() - 0.5) * 2));
      const starts = Array.from({ length: nSessions }, () => EPOCH + day * DAY + (8 + rng() * 14) * 3600000).sort((a, b) => a - b);
      for (const start of starts) {
        time.now = Math.max(time.now, start);
        brain.handleEvent('app_open');
        bump('sessions');
        const nRounds = rng.int(prof.rounds[0], prof.rounds[1]);
        for (let r = 0; r < nRounds; r++) {
          const level = p.level;
          brain.handleEvent('level_start', { level, game });
          time.now += prof.roundSec * (0.7 + 0.6 * rng()) * 1000;
          bump('rounds');
          if (game === 'dino-match' && rng() < 0.08) await tryRewarded(brain.handleEvent('boosters_empty', { level, game }));
          const difficulty = level * 0.0008 + (level % 10 === 0 ? 0.08 : 0);
          let win = rng() < clamp(prof.skill - difficulty + p.assist + Math.min(0.15, 0.05 * (brain.getState().lossStreak)), 0.05, 0.95);
          p.assist = 0;
          if (!win && rng() < 0.35) {
            const granted = await tryRewarded(brain.handleEvent('near_miss', { level, game }), 1.5);
            if (granted && rng() < 0.7) win = true;
          }
          let quit = false;
          if (win) {
            const d = brain.handleEvent('level_complete', { level, game });
            p.roundsSinceInt++;
            p.lastWin = true;
            p.level++;
            if (d.historyVideo) { agg.videos++; time.now += AD_SEC.video * 1000; }
            // rewarded first (player taps the button on the result screen), then the transition ad
            await tryRewarded(d);
            let shown = await tryInterstitial(d);
            if (d.interstitial.reason === 'await_celebration') {
              time.now += 4000;
              const c = brain.handleEvent('celebration_done', { level, game });
              shown = (await tryInterstitial(c)) || shown;
            }
            if (shown && rng() < 0.03 * prof.annoyance) quit = true;
          } else {
            const d = brain.handleEvent('level_failed', { level, game });
            p.roundsSinceInt++;
            p.lastWin = false;
            const granted = await tryRewarded(d, 1.2);
            if (granted && d.rewardedOffers.some((x) => x.type === 'help')) p.assist = 0.15;
            if (rng() < 0.06) quit = true;
          }
          time.now += AD_SEC.between * 1000;
          if (quit) break;
        }
      }
      // end of day: ad exposure and churn
      const st = brain.getState().day;
      agg.adsPerDay.push(st.interstitials);
      if (st.interstitials >= config.pacing.softBudgetPerDay) agg.daysSoft++;
      if (st.interstitials >= config.pacing.hardCapPerDay) agg.daysHard++;
      if (st.rewardedOffered >= config.pacing.rewardedMaxPerDay) agg.daysAtOfferCap++;
      const hazard = clamp(prof.baseChurn + ANNOY_PER_AD * prof.annoyance * p.intToday, 0, MAX_DAILY_HAZARD);
      bump('hazardSum', hazard);
      if (rng() < hazard) churned = true;
    }
  }
  return summarize(agg, o, config);
}

function summarize(agg, o, config) {
  const rev = (b) => (b.interstitials * o.ecpmInterstitial + b.rewardedShown * o.ecpmRewarded) / 1000;
  const row = (b) => ({
    players: b.players, activeDays: b.activeDays, sessions: b.sessions, rounds: b.rounds,
    interstitialsPerSession: b.interstitials / (b.sessions || 1),
    interstitialsPerActiveDay: b.interstitials / (b.activeDays || 1),
    rewardedPerActiveDay: b.rewardedShown / (b.activeDays || 1),
    offerAcceptRate: b.accepted / (b.offers || 1),
    revenuePerActiveDay: rev(b) / (b.activeDays || 1),
    revenuePerInstall: rev(b) / (b.players || 1),
    revenueInterstitial: (b.interstitials * o.ecpmInterstitial) / 1000,
    revenueRewarded: (b.rewardedShown * o.ecpmRewarded) / 1000,
    churnRiskPerDay: b.hazardSum / (b.activeDays || 1),
    interstitials: b.interstitials, rewardedShown: b.rewardedShown,
  });
  const sorted = [...agg.adsPerDay].sort((a, b) => a - b);
  const q = (f) => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))] ?? 0;
  const happy = agg.happyMoments || 1;
  return {
    options: { players: o.players, days: o.days, seed: o.seed, game: o.game, ecpmInterstitial: o.ecpmInterstitial, ecpmRewarded: o.ecpmRewarded, interstitialFill: o.interstitialFill, rewardedFill: o.rewardedFill },
    overall: row(agg.all),
    byProfile: Object.fromEntries(Object.entries(agg.byProfile).map(([k, b]) => [k, row(b)])),
    adsPerDayDistribution: { p50: q(0.5), p90: q(0.9), max: sorted[sorted.length - 1] ?? 0 },
    capHitRates: {
      softBudgetDays: agg.daysSoft / (agg.adsPerDay.length || 1),
      hardCapDays: agg.daysHard / (agg.adsPerDay.length || 1),
      rewardedOfferCapDays: agg.daysAtOfferCap / (agg.adsPerDay.length || 1),
    },
    happyMoments: agg.happyMoments,
    decisionOutcomes: Object.fromEntries(Object.entries(agg.reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v / happy])),
    offersSuppressed: agg.offerSuppressed,
    retention: agg.alive.map((n) => n / agg.installs),
    historyVideos: agg.videos,
    hardLimitViolations: agg.violations,
    config,
  };
}

// ------------------------------------------------------------------ report

const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
const f2 = (x) => x.toFixed(2);
const usd = (x, d = 3) => `$${x.toFixed(d)}`;
const pad = (s, n) => String(s).padEnd(n);
const padl = (s, n) => String(s).padStart(n);

export function formatReport(r) {
  const o = r.overall;
  const L = [];
  L.push(`ad-brain simulation: ${r.options.players} players x ${r.options.days} days, seed ${r.options.seed}, game ${r.options.game}`);
  L.push(`assumptions: eCPM interstitial $${r.options.ecpmInterstitial}, rewarded $${r.options.ecpmRewarded}; fill ${pct(r.options.interstitialFill, 0)} / ${pct(r.options.rewardedFill, 0)} (behaviour model in sim/profiles.js is guesswork)`);
  L.push('');
  L.push('OVERALL');
  L.push(`  active player-days ${o.activeDays}, sessions ${o.sessions}, rounds ${o.rounds}`);
  L.push(`  forced ads per session     ${f2(o.interstitialsPerSession)}`);
  L.push(`  forced ads per active day  ${f2(o.interstitialsPerActiveDay)}   (p50 ${r.adsPerDayDistribution.p50}, p90 ${r.adsPerDayDistribution.p90}, max ${r.adsPerDayDistribution.max})`);
  L.push(`  rewarded watched per day   ${f2(o.rewardedPerActiveDay)}   (offer accept rate ${pct(o.offerAcceptRate)})`);
  L.push(`  revenue proxy              ${usd(o.revenuePerActiveDay)} per active day, ${usd(o.revenuePerInstall)} per install over ${r.options.days} days  [interstitial ${usd(o.revenueInterstitial, 2)}, rewarded ${usd(o.revenueRewarded, 2)}]`);
  L.push(`  churn-risk proxy           ${pct(o.churnRiskPerDay)} mean daily hazard`);
  L.push(`  simulated retention        ${r.retention.map((x, i) => `D${i + 1} ${pct(x, 0)}`).filter((_, i) => [0, 1, 2, 6, 13, 29].includes(i)).join('  ')}`);
  L.push('');
  L.push('CAP HIT RATES (share of player-days)');
  L.push(`  soft budget reached ${pct(r.capHitRates.softBudgetDays)}   hard cap reached ${pct(r.capHitRates.hardCapDays)}   rewarded offer cap reached ${pct(r.capHitRates.rewardedOfferCapDays)}`);
  L.push('');
  L.push(`WHAT HAPPENED AT ${r.happyMoments} FORCED-AD MOMENTS (level clear / celebration)`);
  for (const [k, v] of Object.entries(r.decisionOutcomes)) L.push(`  ${pad(k, 28)} ${padl(pct(v), 7)}`);
  if (Object.keys(r.offersSuppressed).length) L.push(`  rewarded offers suppressed: ${Object.entries(r.offersSuppressed).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  L.push('');
  L.push('BY BEHAVIOUR PROFILE');
  L.push(`  ${pad('profile', 16)}${padl('players', 8)}${padl('ads/sess', 10)}${padl('ads/day', 9)}${padl('rew/day', 9)}${padl('$/day', 9)}${padl('risk/day', 10)}`);
  for (const [k, b] of Object.entries(r.byProfile)) L.push(`  ${pad(k, 16)}${padl(b.players, 8)}${padl(f2(b.interstitialsPerSession), 10)}${padl(f2(b.interstitialsPerActiveDay), 9)}${padl(f2(b.rewardedPerActiveDay), 9)}${padl(usd(b.revenuePerActiveDay), 9)}${padl(pct(b.churnRiskPerDay), 10)}`);
  L.push('');
  const v = Object.entries(r.hardLimitViolations);
  L.push(`HARD-LIMIT CHECK: ${v.length ? 'VIOLATIONS ' + v.map(([k, n]) => `${k}=${n}`).join(', ') : 'none (levels 1-3, loss, cooldown, rounds gap, rewarded guard, daily cap all respected)'}`);
  return L.join('\n');
}

// ------------------------------------------------------------------ CLI

const HELP = `ad-brain simulator
  --players N          synthetic players (default 500)
  --days N             days to simulate (default 7)
  --seed N             rng seed (default 1)
  --game G             dino-break | dino-match | mixed (default mixed)
  --mix a:.4,b:.6      profile mix (profiles: ${Object.keys(PROFILES).join(', ')})
  --config file.json   remote-style config (partial, gets clamped)
  --set path=value     override one config number, repeatable (e.g. prob.base=0.25)
  --sweep path=a,b,c   run once per value, print a comparison table
  --ecpm-int N --ecpm-rew N   revenue assumptions (USD per 1000 impressions)
  --int-fill N --rew-fill N   mock fill rates 0..1
  --json               machine-readable output`;

function setPath(obj, path, value) {
  const keys = path.split('.');
  let t = obj;
  for (const k of keys.slice(0, -1)) t = t[k] = t[k] && typeof t[k] === 'object' ? t[k] : {};
  t[keys.at(-1)] = value;
}

export function parseArgs(argv) {
  const a = { config: {}, sets: [], json: false };
  const num = (x) => { const n = Number(x); if (!Number.isFinite(n)) throw new Error(`not a number: ${x}`); return n; };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const val = () => { if (i + 1 >= argv.length) throw new Error(`${k} needs a value`); return argv[++i]; };
    switch (k) {
      case '--players': a.players = num(val()); break;
      case '--days': a.days = num(val()); break;
      case '--seed': a.seed = num(val()); break;
      case '--game': a.game = val(); break;
      case '--mix': a.mix = Object.fromEntries(val().split(',').map((p) => { const [n, w] = p.split(':'); if (!PROFILES[n]) throw new Error(`unknown profile ${n}`); return [n, num(w)]; })); break;
      case '--config': a.config = JSON.parse(readFileSync(val(), 'utf8')); break;
      case '--set': { const [p, v] = val().split('='); a.sets.push([p, num(v)]); break; }
      case '--sweep': { const [p, v] = val().split('='); a.sweep = [p, v.split(',').map(num)]; break; }
      case '--ecpm-int': a.ecpmInterstitial = num(val()); break;
      case '--ecpm-rew': a.ecpmRewarded = num(val()); break;
      case '--int-fill': a.interstitialFill = num(val()); break;
      case '--rew-fill': a.rewardedFill = num(val()); break;
      case '--json': a.json = true; break;
      case '--help': case '-h': a.help = true; break;
      default: throw new Error(`unknown option ${k}`);
    }
  }
  for (const [p, v] of a.sets) setPath(a.config, p, v);
  return a;
}

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`error: ${e.message}\n\n${HELP}`); process.exit(2); }
  if (args.help) { console.log(HELP); return; }
  const { json, sets, sweep, ...opts } = args;
  if (sweep) {
    const [path, values] = sweep;
    const rows = [];
    for (const v of values) {
      const cfg = structuredClone(opts.config);
      setPath(cfg, path, v);
      const r = await runSimulation({ ...opts, config: cfg });
      rows.push({ value: v, ...r.overall, hardCapDays: r.capHitRates.hardCapDays, softBudgetDays: r.capHitRates.softBudgetDays, d7: r.retention.at(-1), violations: r.hardLimitViolations });
    }
    if (json) return console.log(JSON.stringify(rows, null, 2));
    console.log(`sweep ${path}  (${opts.players ?? 500} players x ${opts.days ?? 7} days)`);
    console.log(`  ${pad(path.split('.').pop(), 10)}${padl('ads/sess', 10)}${padl('ads/day', 9)}${padl('rew/day', 9)}${padl('$/day', 9)}${padl('$/install', 11)}${padl('risk/day', 10)}${padl('soft%', 8)}${padl('hard%', 8)}${padl('last-day ret', 14)}`);
    for (const r of rows) console.log(`  ${pad(r.value, 10)}${padl(f2(r.interstitialsPerSession), 10)}${padl(f2(r.interstitialsPerActiveDay), 9)}${padl(f2(r.rewardedPerActiveDay), 9)}${padl(usd(r.revenuePerActiveDay), 9)}${padl(usd(r.revenuePerInstall), 11)}${padl(pct(r.churnRiskPerDay), 10)}${padl(pct(r.softBudgetDays, 0), 8)}${padl(pct(r.hardCapDays, 0), 8)}${padl(pct(r.d7, 0), 14)}`);
    return;
  }
  const result = await runSimulation(opts);
  console.log(json ? JSON.stringify(result, null, 2) : formatReport(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
