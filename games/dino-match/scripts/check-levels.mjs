// Usage: npm run levels:check -- [from] [to] [--fast]   (default 1 to 120; tuned with the bot unless --fast)
import { generateLevel, validateLevel, hpOf, workOf } from '../src/core/level.js';
const from = +process.argv[2] || 1, to = +process.argv[3] || 120;
let bad = 0;
for (let n = from; n <= to; n++) {
  const t0 = performance.now();
  const c = generateLevel(n, { tune: !process.argv.includes('--fast') });
  const p = validateLevel(c);
  if (p.length) bad++;
  console.log(`L${n} ${c.kind} blocks=${c.dirtTotal} hp=${hpOf(c.blocks)} work=${workOf(c.blocks, c.layout)} obst=${c.layout ? [...new Set(c.layout.join('').replace(/\./g, ''))].join('') : '-'} targets=${c.targets.map((t) => t.type + (t.k ? ':' + t.k : '')).join('+')} moves=${c.moves} target=${c.target.toFixed(2)} bot=${c.botWinRate ?? '-'} ${(performance.now() - t0).toFixed(0)}ms ${p.join(',')}`);
}
console.log(bad ? `${bad} problems` : 'all levels ok');
process.exit(bad ? 1 : 0);
