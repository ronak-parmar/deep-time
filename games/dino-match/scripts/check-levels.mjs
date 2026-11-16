// Usage: npm run levels:check -- [from] [to]   (default 1 to 120)
import { generateLevel, validateLevel } from '../src/core/level.js';
const from = +process.argv[2] || 1, to = +process.argv[3] || 120;
let bad = 0;
for (let n = from; n <= to; n++) {
  const t0 = performance.now();
  const c = generateLevel(n);
  const p = validateLevel(c);
  if (p.length) bad++;
  console.log(`L${n} ${c.kind} dirt=${c.dirtTotal} moves=${c.moves} target=${c.target.toFixed(2)} bot=${c.botWinRate ?? '-'} ${(performance.now() - t0).toFixed(0)}ms ${p.join(',')}`);
}
console.log(bad ? `${bad} problems` : 'all levels ok');
process.exit(bad ? 1 : 0);
