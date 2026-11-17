import { CONFIG } from './config.js';
import { makeRng, shuffle, hashSeed, next, int } from './rng.js';
import { eraOf, eraIndexOf, cycleOf, levelInEra } from './eras.js';
import { winRate } from './bot.js';
import { unlockedKinds } from './specials.js';
import { defaultTargets, validateTargets } from './targets.js';
import { OBSTACLES, parseLayout, layoutRows, glyphOf } from './obstacles.js';

// Block lists are data: 'T0 S1 K2' = tar/sand/stone block of gem colour 0/1/2 (colours: 0 red, 1 green, 2 blue, 3 yellow, 4 purple, 5 amber).
// tar = 1 hit point, sand = 2, stone = 3 (CONFIG.dig.blockTypes). A 3-match hits once, 4 twice, 5+ three times.
const TYPE = { T: 'tar', S: 'sand', K: 'stone' };
export const parseBlocks = (str) => str.trim().split(/\s+/).map((w) => ({ t: TYPE[w[0]], c: +w.slice(1) }));
export const blocksToString = (blocks) => blocks.map((b) => Object.keys(TYPE).find((k) => TYPE[k] === b.t) + b.c).join(' ');

// Hand-authored onboarding (levels 1-15, Cambrian). Levels 1-5 have NO dig plaque: only collect-colour targets ("Break 10 red"), and they
// double as the first-time tutorial (core/tutorial.js). The plaque arrives on level 6 ("Match the colours shown on the blocks to dig"),
// sand on 8, stone on 10; levels 8-10 mix dig and collect. Levels 1-6 use fixed `seed` boards that always start with a valid move of
// the target colour (tests check this). Levels 11-15 keep the authored board size; the generator fills the rest.
// { size, colors, blocks ('' = no plaque), collect: [[colour, n]], moves, tip, seed }
const ONBOARDING = [
  { size: 6, colors: 4, blocks: '', collect: [[0, 10]], moves: 14, tip: 'Match 3 or more gems of the target colour to break them.', seed: 1 },
  { size: 6, colors: 4, blocks: '', collect: [[2, 12]], moves: 16, tip: 'Other colours still use a move but do not count toward the target.', seed: 1 },
  { size: 6, colors: 4, blocks: '', collect: [[0, 8], [1, 8]], moves: 16, tip: 'Two targets this time. Finish both before the moves run out.', seed: 1 },
  { size: 6, colors: 4, blocks: '', collect: [[1, 15]], moves: 18, tip: 'Gems that fall can match again. Chains count too.', seed: 1 },
  { size: 6, colors: 5, blocks: '', collect: [[3, 10], [4, 10]], moves: 18, tip: 'Match 4 in a line to make a Firecracker. Match it to blast a row or column.', seed: 5 },
  { size: 6, colors: 4, blocks: 'T0 T1 T0 T1', moves: 14, tip: 'Match the colours shown on the blocks to dig.', seed: 1 },
  { size: 6, colors: 4, blocks: 'T0 T1 T2 T0 T1', moves: 14, tip: 'Bigger matches hit harder: 4 in a row hits twice. A wrong colour does nothing.', seed: 7 },
  { size: 6, colors: 5, blocks: 'T0 T1 T2 S3 T4', collect: [[2, 8]], moves: 20, tip: 'Dig the blocks and break the gems. Sand takes two hits.', seed: 8 },
  { size: 7, colors: 5, blocks: 'T0 T1 S2 S3 T4 S0 T1 S2 T3', moves: 18, tip: 'Swap two Firecrackers together for a cross blast.', seed: 9 },
  { size: 7, colors: 5, blocks: 'S0 S1 T2 T3 S4 K0 T1 S2 T3 K4', collect: [[1, 10]], moves: 22, tip: 'Stone takes three hits. A match of 5 breaks it in one go.', seed: 10 },
  { size: 7, colors: 5 }, { size: 7, colors: 5 }, { size: 7, colors: 5 }, { size: 7, colors: 5 }, { size: 7, colors: 5 }
];
export const AUTHORED = ONBOARDING;
const ONB_DIRT = [4, 5, 6, 6, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12];   // plaque size for levels 11-15 (generated blocks)

// Hand-authored obstacle introduction levels (docs/11 schedule, one new thing at a time in a safe level first). Every other level that
// shows an obstacle gets a generated layout (placeObstacles). layout rows: . gem, T tar, S sandstone, F fossil tile, B skeleton tile,
// V vine stone, C crate, L lava rock, # rock, a artefact. extra = targets next to the dig target; moves come from the tuned generator.
export const INTRO = {
  11: { layout: ['.......', '.......', '..T.T..', '.......', '..T.T..', '.......', '.......'], extra: [{ type: 'clearAll', k: 'tar', n: 4 }], tip: 'Tar pits clear when you match next to them, or blast them.' },
  18: { layout: ['#.....#', '.......', '.......', '...#...', '.......', '.......', '#.....#'], extra: [], tip: 'Rocks never break. Gems fall around them.' },
  25: { layout: ['.......', '.S...S.', '.......', '...S...', '.......', '.S...S.', '.......'], extra: [{ type: 'stones', n: 5 }], tip: 'Sandstone cracks after two hits and then crumbles.' },
  35: { layout: ['.......', '..F.F..', '.......', '.......', '..F....', '.......', '.......'], extra: [{ type: 'fossils', n: 3 }], tip: 'Break a fossil tile to collect the fossil buried under it.' },
  55: { layout: ['.......', '..BBB..', '...B...', '..BBB..', '...B...', '.......', '.......'], extra: [{ type: 'skeleton', n: 8 }], tip: 'Uncover every tile of the buried skeleton.' },
  70: { layout: ['..a.a..', '.......', '.......', '.......', '.......', '.......', '.......'], extra: [{ type: 'drop', n: 2 }], tip: 'Match gems under an artefact so it falls to the bottom row.' },
  101: { layout: ['.......', '.V...V.', '.......', '.......', '.V...V.', '.......', '.......'], extra: [{ type: 'clearAll', k: 'vine', n: 4 }], tip: 'Vine stone needs two matches next to it. Blasts do not cut vines.' },
  201: { layout: ['.......', '.......', '.......', '.C...C.', '.......', '.......', '.......'], extra: [{ type: 'clearAll', k: 'crate', n: 2 }], tip: 'Crates only break in a blast. Make a Firecracker or Bomb.' },
  301: { layout: ['.......', '.......', '.......', '...L...', '.......', '.......', '.......'], extra: [{ type: 'clearAll', k: 'lava', n: 1 }], tip: 'Lava rock erupts tar every 3 moves. Break it with three hits.' }
};

// Generated obstacle layout for a level (after the intro level of each obstacle). Returns { layout, extra, spread } or null.
const FREE_BAND = (h) => [1, h - 2];
export function placeObstacles(level, w, h, target, colors, kind) {
  const rng = makeRng(hashSeed(level, 11)), L = CONFIG.obstacles;
  if (level <= L.unlock.tar || kind === 'breather' || INTRO[level] || next(rng) < 0.35) return null;
  const kinds = Object.keys(L.unlock).filter((k) => L.unlock[k] <= level);
  if (!kinds.length) return null;
  const k = kinds[int(rng, kinds.length)], grid = Array.from({ length: h }, () => new Array(w).fill('.'));
  const [r0, r1] = FREE_BAND(h);
  const spots = [];                                          // interior cells, shuffled; keep blockers apart
  for (let y = r0; y <= r1; y++) for (let x = 0; x < w; x++) spots.push([x, y]);
  shuffle(rng, spots);
  const apart = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const v = grid[y + dy]?.[x + dx]; if (v && v !== '.' && v !== 'a') return false; } return true; };
  const put = (ch, n) => { let c = 0; for (const [x, y] of spots) { if (c >= n) break; if (grid[y][x] === '.' && apart(x, y)) { grid[y][x] = ch; c++; } } return c; };
  const sc = 1 + Math.floor(target * 4);                     // 1..4 scale with difficulty
  const extra = []; let spread = 0;
  if (k === 'tar') { const n = put('T', 3 + sc); extra.push({ type: 'clearAll', k: 'tar', n }); if (target >= 0.35) spread = CONFIG.obstacles.spreadEvery; }
  else if (k === 'rock') put('#', 2 + sc);
  else if (k === 'sandstone') { const n = put('S', 4 + sc); extra.push({ type: 'stones', n: Math.max(3, n - 1) }); }
  else if (k === 'fossil') { const n = put('F', 2 + Math.min(2, sc)); extra.push({ type: 'fossils', n }); }
  else if (k === 'bone') {
    const shapes = [['BBB', '.B.', '.B.'], ['.B.', 'BBB', '.B.'], ['B.B', 'BBB', 'B.B']], sh = shapes[int(rng, shapes.length)], ox = int(rng, w - 2), oy = 1 + int(rng, h - 5);
    let n = 0; sh.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch === 'B') { grid[oy + dy][ox + dx] = 'B'; n++; } }));
    extra.push({ type: 'skeleton', n });
  } else if (k === 'artefact') { const n = Math.min(3, 1 + Math.floor(sc / 2)), xs = shuffle(rng, Array.from({ length: w }, (_, i) => i)).slice(0, n); xs.forEach((x) => { grid[0][x] = 'a'; }); extra.push({ type: 'drop', n }); }
  else if (k === 'vine') { const n = put('V', 3 + sc); extra.push({ type: 'clearAll', k: 'vine', n }); }
  else if (k === 'crate') { const n = put('C', 2 + Math.min(2, sc)); extra.push({ type: 'clearAll', k: 'crate', n }); }
  else if (k === 'lava') { const n = put('L', 1 + (sc > 2 ? 1 : 0)); extra.push({ type: 'clearAll', k: 'lava', n }); }
  void colors;
  return { layout: grid.map((r) => r.join('')), extra, spread };
}

// Work (hit-point equivalents) the player has to do: plaque hit points, plus half the obstacle hit points, plus the artefact falls.
export function workOf(blocks, layout, collects = []) {
  let w = hpOf(blocks) + collects.reduce((a, t) => a + t.n, 0) / CONFIG.levels.gemsPerMove;
  if (layout) { const p = parseLayout(layout); for (const c of p.cells) { const hp = OBSTACLES[c.k].hp; if (hp !== Infinity) w += hp * 0.5; } w += p.artefacts.length * 3; }
  return Math.ceil(w);
}

// Targets for a level (1 to 3). Levels 1-10 are authored above. After that the generator assigns them; phase A assigns only the
// dig target, later phases add types here (data-driven, see targets.js).
export function assignTargets(level, dirtTotal, extra = []) {
  return [...(dirtTotal ? defaultTargets(dirtTotal) : []), ...extra.map((t) => ({ ...t }))].slice(0, 3);
}

// Generated blocks: hit points and colour spread rise with the difficulty target.
export function assignBlocks(n, colors, target, rng) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const stone = clamp((target - 0.25) * 0.7, 0, 0.3), sand = clamp(target * 0.55, 0, 0.45);
  const spread = clamp(2 + Math.round(target * 5), 2, colors);
  const palette = shuffle(rng, Array.from({ length: colors }, (_, i) => i)).slice(0, spread);
  return Array.from({ length: n }, (_, i) => {
    const r = next(rng);
    return { t: r < stone ? 'stone' : r < stone + sand ? 'sand' : 'tar', c: palette[i % spread] };
  });
}
export const hpOf = (blocks) => blocks.reduce((a, b) => a + CONFIG.dig.blockTypes[b.t].hp, 0);

// Move budget from the hit points to clear and the difficulty target (calibrated with the bot, see tests/dig.test.js).
export function movesFor(blocks, target, layout = null, collects = []) {
  const L = CONFIG.levels;
  return Math.ceil(workOf(blocks, layout, collects) * (L.moveFactorEasy - (L.moveFactorEasy - L.moveFactorHard) * (target / L.cap)));
}

// Difficulty target in 0..0.8 (docs/03).
export function difficultyTarget(level) {
  const L = CONFIG.levels;
  const progress = (levelInEra(level) - 1) / (L.perEra - 1);
  let t = L.base + L.perEraStep * eraIndexOf(level) + L.acrossEra * progress + L.cycleBump * cycleOf(level);
  if (level % 10 === 0) t += L.milestoneBump;
  else if (level % 5 === 0 || levelInEra(level) === 1) t *= L.breatherFactor;
  return Math.min(L.cap, t);
}
export function levelKind(level) {
  if (level <= CONFIG.levels.onboarding) return 'onboarding';
  if (level % 10 === 0) return 'milestone';
  if (level % 5 === 0 || levelInEra(level) === 1) return 'breather';
  return 'normal';
}

function base(level) {
  const rng = makeRng(hashSeed(level, 7));
  return { level, seed: level, era: eraOf(level).id, rng };
}
const collectsOf = (cfg) => (cfg.targets || []).filter((t) => t.type === 'collect');
// Levels after 10 mix the target kinds: dig only (40%), dig + collect (35%) or collect only (25%), by a seeded hash of the level.
export function modeFor(level) { const r = hashSeed(level, 17) % 100; return r < 40 ? 'dig' : r < 75 ? 'both' : 'collect'; }
function mixTargets(level, cfg, target, kind) {
  const mode = modeFor(level); if (mode === 'dig') return;
  const rng = makeRng(hashSeed(level, 13)), cols = shuffle(rng, Array.from({ length: cfg.colors }, (_, i) => i));
  const nCols = mode === 'collect' && target >= 0.3 ? 2 : 1, per = 8 + Math.floor(target * 14) + (kind === 'milestone' ? 4 : 0);
  const collect = cols.slice(0, nCols).map((c) => ({ type: 'collect', c, n: per }));
  const extra = cfg.targets.filter((t) => t.type !== 'dig' && t.type !== 'collect');
  const dig = cfg.targets.filter((t) => t.type === 'dig');
  if (mode === 'collect') { cfg.blocks = []; cfg.dirtTotal = 0; cfg.targets = [...collect, ...extra].slice(0, 3); }
  else cfg.targets = [...dig, ...collect.slice(0, 1), ...extra].slice(0, 3);
  cfg.moves = movesFor(cfg.blocks, target, cfg.layout || null, collectsOf(cfg));
}
// Generate level n. Deterministic: same n always gives the same level (seed = level number).
// tune=true runs the bot and nudges the move budget into the target win-rate band (used by levels:check, too slow for play).
export function generateLevel(level, { tune = false } = {}) {
  const b = base(level);
  const kind = levelKind(level);
  const common = { level, seed: b.seed, era: b.era, kind, specials: unlockedKinds(level) };
  let cfg;
  if (kind === 'onboarding') {
    const A = ONBOARDING[level - 1], size = A.size, colors = A.colors, moves = A.moves, tip = A.tip;
    const target = 0.1;
    const blocks = A.blocks === '' ? [] : A.blocks ? parseBlocks(A.blocks) : assignBlocks(ONB_DIRT[level - 1], colors, target, b.rng);
    const ob = INTRO[level] ? { ...INTRO[level], spread: 0 } : null;
    const collect = (A.collect || []).map(([c, n]) => ({ type: 'collect', c, n }));
    cfg = { ...common, seed: A.seed ?? b.seed, w: size, h: size, colors, blocks, dirtTotal: blocks.length, moves: moves ?? movesFor(blocks, target, ob && ob.layout, collect), tip: ob ? ob.tip : tip, target, targets: assignTargets(level, blocks.length, [...collect, ...(ob ? ob.extra : [])]) };
    if (ob) { cfg.layout = ob.layout; if (ob.spread) cfg.spread = ob.spread; }
    if (level >= 12 && !ob) mixTargets(level, cfg, target, kind);
  } else {
    const target = difficultyTarget(level);
    const colors = eraIndexOf(level) === 0 && target < 0.3 ? 5 : 6;
    const n = 5 + Math.floor(target * 8) + (kind === 'milestone' ? 2 : 0);
    const blocks = assignBlocks(n, colors, target, b.rng);
    const intro = INTRO[level], ob = intro ? { ...intro, spread: 0 } : placeObstacles(level, CONFIG.size.normal, CONFIG.size.normal, target, colors, kind);
    cfg = { ...common, w: CONFIG.size.normal, h: CONFIG.size.normal, colors, blocks, dirtTotal: n, target, tip: intro ? intro.tip : null, moves: movesFor(blocks, target, ob && ob.layout), targets: assignTargets(level, n, ob ? ob.extra : []) };
    if (ob) { cfg.layout = ob.layout; if (ob.spread) cfg.spread = ob.spread; }
    if (!intro) mixTargets(level, cfg, target, kind);
  }
  if (!tune || (kind === 'onboarding' && !cfg.layout)) return cfg;
  // smallest budget whose bot win rate reaches the goal (win rate rises with moves), then keep the closer neighbour
  const L = CONFIG.levels, planned = cfg.layout && cfg.layout.some((r) => /[Ca]/.test(r));   // crates and artefacts need planning a bot lacks
  const goal = 1 - cfg.target - (planned ? L.plannedSlack : 0), hp = workOf(cfg.blocks, cfg.layout, collectsOf(cfg));
  const floor = Math.ceil(hp * L.minMoveFactor);
  let lo = floor, hi = Math.ceil(hp * (cfg.layout && cfg.layout.some((r) => r.includes('C')) ? 7 : 4));
  while (lo < hi) { const mid = (lo + hi) >> 1; if (winRate({ ...cfg, moves: mid }) >= goal) hi = mid; else lo = mid + 1; }
  let moves = lo;
  if (lo > floor && Math.abs(winRate({ ...cfg, moves: lo - 1 }) - goal) < Math.abs(winRate({ ...cfg, moves: lo }) - goal)) moves = lo - 1;
  moves = Math.max(floor, Math.ceil(moves * L.humanMargin));   // the bot plays better than a casual human: keep a margin
  cfg.moves = moves; cfg.botWinRate = winRate(cfg);
  return cfg;
}

// Sanity check used by tests and the checker script: solvable by construction or by the bot.
export function validateLevel(cfg) {
  const problems = [];
  if (cfg.dirtTotal < 1 && !collectsOf(cfg).length) problems.push('no dirt and no collect target');
  for (const t of collectsOf(cfg)) if (!(t.c >= 0 && t.c < cfg.colors)) problems.push('collect colour not on the board');
  if (cfg.blocks.length !== cfg.dirtTotal) problems.push('block list mismatch');
  for (const b of cfg.blocks) { if (!CONFIG.dig.blockTypes[b.t]) problems.push('unknown block type ' + b.t); if (!(b.c >= 0 && b.c < cfg.colors)) problems.push('block colour not on the board'); }
  const parsed = cfg.layout ? parseLayout(cfg.layout) : null;
  if (parsed && (parsed.w !== cfg.w || parsed.h !== cfg.h)) problems.push('layout size mismatch');
  if (cfg.targets) problems.push(...validateTargets(cfg.targets, cfg.dirtTotal, parsed || { cells: [], artefacts: [] }));
  if (parsed) {   // every column keeps at least 3 free cells and no artefact can be sealed in below a rock
    for (let x = 0; x < cfg.w; x++) { let free = 0; for (let y = 0; y < cfg.h; y++) if (!parsed.cells.some((c) => c.i === y * cfg.w + x)) free++; if (free < 3) problems.push('column ' + x + ' too blocked'); }
    for (const a of parsed.artefacts) { const x = a % cfg.w; if (parsed.cells.some((c) => c.i % cfg.w === x && c.k === 'rock')) problems.push('rock below an artefact'); }
  }
  if (cfg.moves < Math.ceil(workOf(cfg.blocks, cfg.layout, collectsOf(cfg)) / 3)) problems.push('too few moves');   // even 5-matches every move could not finish
  return problems;
}
