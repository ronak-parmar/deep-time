// Debug / test boards: one swap away from each special (used by the debug level picker and the tests). Pure.
// Filler gems use colours 1..3 in a diagonal pattern (no accidental matches); colour 0 builds the pattern.
import { KINDS } from './specials.js';

export const SPECIAL_TESTS = ['firecracker', 'firecracker-v', 'bomb-t', 'bomb-l', 'dynamite', 'tnt', 'rainbow'];
export const COMBO_TESTS = [];
for (let i = 0; i < KINDS.length; i++) for (let j = i; j < KINDS.length; j++) COMBO_TESTS.push(`combo:${KINDS[i]}+${KINDS[j]}`);
export const ALL_TESTS = [...SPECIAL_TESTS, ...COMBO_TESTS, 'rainbow+gem'];

const filler = (x, y) => ((x + 2 * y) % 3) + 1;

// Rewrites state.cells for the named test and unlocks every special. Returns { swap:[a,b], expect } or null when the board is too small.
export function setupTest(state, name) {
  const { w, h } = state;
  if (w < 6 || h < 6 || state.colors < 4) return null;
  state.specials = KINDS.slice();
  let id = state.nextId;
  const put = (x, y, c, extra = {}) => { state.cells[y * w + x] = { id: id++, c, ...extra }; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, filler(x, y));
  const i = (x, y) => y * w + x;
  let swapPair, expect = null;
  const A = 0;
  switch (name) {
    case 'firecracker': for (const x of [0, 1, 3]) put(x, 2, A); put(2, 3, A); swapPair = [i(2, 3), i(2, 2)]; expect = 'firecracker'; break;
    case 'firecracker-v': for (const y of [0, 1, 3]) put(2, y, A); put(3, 2, A); swapPair = [i(3, 2), i(2, 2)]; expect = 'firecracker'; break;
    case 'bomb-t': for (const [x, y] of [[1, 2], [3, 2], [2, 3], [2, 4], [2, 1]]) put(x, y, A); swapPair = [i(2, 1), i(2, 2)]; expect = 'bomb'; break;
    case 'bomb-l': for (const [x, y] of [[3, 2], [4, 2], [2, 3], [2, 4], [2, 1]]) put(x, y, A); swapPair = [i(2, 1), i(2, 2)]; expect = 'bomb'; break;
    case 'dynamite': for (const [x, y] of [[0, 2], [1, 2], [3, 2], [2, 3], [2, 4], [2, 1]]) put(x, y, A); swapPair = [i(2, 1), i(2, 2)]; expect = 'dynamite'; break;   // 4 across + 3 down sharing a cell = 6
    case 'tnt': for (const [x, y] of [[0, 2], [1, 2], [3, 2], [4, 2], [2, 3], [2, 4], [2, 1]]) put(x, y, A); swapPair = [i(2, 1), i(2, 2)]; expect = 'tnt'; break;   // 5 across + 3 down = 7 cells
    case 'rainbow': for (const x of [0, 1, 3, 4]) put(x, 2, A); put(2, 3, A); swapPair = [i(2, 3), i(2, 2)]; expect = 'rainbow'; break;
    case 'rainbow+gem': put(2, 3, -1, { s: 'rainbow', o: 'h' }); swapPair = [i(2, 3), i(3, 3)]; break;
    default: {
      const m = /^combo:(\w+)\+(\w+)$/.exec(name); if (!m) return null;
      put(2, 3, m[1] === 'rainbow' ? -1 : 2, { s: m[1], o: 'h' }); put(3, 3, m[2] === 'rainbow' ? -1 : 2, { s: m[2], o: 'v' });
      swapPair = [i(2, 3), i(3, 3)];
    }
  }
  state.nextId = id;
  return { swap: swapPair, expect };
}
