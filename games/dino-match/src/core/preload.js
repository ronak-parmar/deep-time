// Counted asset loader for the loading screen (M10). Pure: no DOM, no timers of its own, so it is unit tested.
//
//   const L = createLoader([{ id, weight, run: () => Promise }, ...])
//   L.start()          runs every task once (in parallel); a task that rejects or resolves null still counts as done
//   L.progress()       0..1, by weight (weight = files a task stands for; default 1)
//   L.done             Promise that resolves when every task has settled (never rejects)
//   L.failed()         ids whose task rejected (art then uses its fallback)
//
// barTarget(real, elapsed, minShow): what the bar should show. Never ahead of real progress, and never ahead of the minimum display
// time, so a fast load still fills smoothly over minShow and a slow one shows its real progress.
export function createLoader(tasks) {
  const list = tasks.filter(Boolean).map((t) => ({ weight: 1, ...t, settled: false, ok: null }));
  const total = list.reduce((s, t) => s + Math.max(0, t.weight), 0);
  let got = 0, started = null;
  const L = {
    tasks: list, total,
    progress: () => (total ? Math.min(1, got / total) : 1),
    failed: () => list.filter((t) => t.settled && !t.ok).map((t) => t.id),
    pending: () => list.filter((t) => !t.settled).map((t) => t.id),
    start() {
      if (started) return started;
      started = Promise.all(list.map((t) => {
        let p; try { p = Promise.resolve(t.run()); } catch { p = Promise.reject(new Error('task threw')); }
        return p.then(() => true, () => false).then((ok) => { t.settled = true; t.ok = ok; got += Math.max(0, t.weight); });
      })).then(() => L);
      return started;
    },
    get done() { return L.start(); }
  };
  return L;
}

export const barTarget = (real, elapsed, minShow) => Math.max(0, Math.min(1, real, minShow > 0 ? elapsed / minShow : 1));
// one smoothing step toward the target (frame-rate independent: k is the fraction per 60 fps frame)
export const follow = (shown, target, dtMs, k) => {
  if (target <= shown) return target < shown - 0.5 ? target : shown;   // the bar never goes backwards (except a reset)
  const a = 1 - Math.pow(1 - k, Math.max(0, dtMs) / (1000 / 60));
  const next = shown + (target - shown) * a;
  return target - next < 0.002 ? target : next;
};
// The gate: resolves 'loaded' once every task settled AND minShow has passed, or 'timeout' at maxWait (whatever is still loading
// keeps loading in the background). wait(ms) is injected (setTimeout in the game, fake time in tests).
export function gate(loader, { minShow, maxWait, wait }) {
  const loaded = Promise.all([loader.done, wait(minShow)]).then(() => 'loaded');
  return Promise.race([loaded, wait(maxWait).then(() => 'timeout')]);
}
// a promise that gives up after ms (resolves `fallback`); the original keeps running
export const within = (p, ms, wait, fallback = null) => Promise.race([Promise.resolve(p), wait(ms).then(() => fallback)]);

// Loading-screen tips: short facts taken word for word from the fossil roster (data/roster.js), with "It"/"Its" at the start
// turned into the animal's name. [roster id, fact index]
export const TIP_PICKS = [
  ['cambrian-opabinia', 0], ['devonian-ichthyostega', 1], ['carboniferous-meganeura', 0], ['cretaceous-spinosaurus', 1],
  ['cretaceous-triceratops', 0], ['mammals-basilosaurus', 1], ['iceage-irish-elk', 1], ['cretaceous-tyrannosaurus', 0]
];
export function tipText(f, i) {
  const s = f.facts[i];
  if (/^Its\s/.test(s)) return `${f.name}'s ${s.slice(4)}`;
  if (/^It\s/.test(s)) return `${f.name} ${s.slice(3)}`;
  if (!s.toLowerCase().includes(f.name.toLowerCase().split(' ')[0])) return `${f.name}: ${s.charAt(0).toLowerCase()}${s.slice(1)}`;
  return s;
}
export function bootTips(roster) {
  const by = new Map(roster.map((f) => [f.id, f]));
  return TIP_PICKS.filter(([id, i]) => by.get(id)?.facts[i]).map(([id, i]) => tipText(by.get(id), i));
}

// ---- rotating loading backgrounds (M10) ----------------------------------------------------------------------------------
// art/boot/loading-<name>.webp are general backgrounds ('bg-final' is the default), loading-era-<era-id>.webp belong to one era,
// loading-bg.webp is only the small first-paint copy of the default (index.html) and never picked.
// bootBgCatalog(paths -> url) -> { general: { name: url }, era: { eraId: url }, firstPaint: url|null }
export const BOOT_BG_DEFAULT = 'bg-final';
export function bootBgCatalog(files) {
  const out = { general: {}, era: {}, firstPaint: null };
  for (const [p, url] of Object.entries(files)) {
    const m = p.match(/loading-([a-z0-9-]+)\.webp$/i); if (!m) continue;
    const n = m[1].toLowerCase();
    if (n === 'bg') out.firstPaint = url;
    else if (n.startsWith('era-')) out.era[n.slice(4)] = url;
    else out.general[n] = url;
  }
  return out;
}
// Which background this launch shows (a key: a general name or 'era-<id>'), or null when there is none.
//   first launch (no progress): the default one
//   progress + an image for the player's era: that one ERA_SHARE of the time
//   otherwise a random general one, never the same as last launch (when there is any other choice)
export const ERA_SHARE = 0.6;
export function pickBootBg({ general = [], era = [], eraId = null, hasProgress = false, last = null, r = Math.random, def = BOOT_BG_DEFAULT } = {}) {
  const names = [...general].sort();
  const fallback = names.includes(def) ? def : names[0] || (era.includes(eraId) ? 'era-' + eraId : null);
  if (!hasProgress) return fallback;
  if (eraId && era.includes(eraId) && r() < ERA_SHARE) return 'era-' + eraId;
  const pool = names.filter((n) => n !== last);
  if (!pool.length) return fallback;
  return pool[Math.min(pool.length - 1, Math.floor(r() * pool.length))];
}
export const hasProgress = (p) => !!p && ((p.level || 1) > 1 || Object.keys(p.stars || {}).length > 0);
