// Dev-only: contact sheet of every fossil in the roster (bone look), with the reveal progress you pick in the URL:
// /preview-fossils.html?revealed=10 (all bone, default) or ?revealed=4 (4 parts unearthed, 6 still under dirt).
import { ROSTER } from './data/roster.js';
import { drawFossilArt } from './render/fossilArt.js';
import { preloadUi } from './render/art.js';

const q = new URLSearchParams(location.search), revealed = +(q.get('revealed') ?? 10), only = q.get('only');
await preloadUi();
const list = only ? ROSTER.filter((f) => f.id.includes(only)) : ROSTER;
const cols = +(q.get('cols') || 4), cw = 300, ch = 170, rows = Math.ceil(list.length / cols);
const cv = document.getElementById('c'); cv.width = cols * cw; cv.height = rows * ch;
const c = cv.getContext('2d');
list.forEach((f, i) => {
  const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
  c.fillStyle = '#D9C79F'; c.fillRect(x + 4, y + 4, cw - 8, ch - 8);
  drawFossilArt(c, f.shape, x + 10, y + 10, cw - 20, ch - 36, { revealed, look: revealed >= 10 ? 'bone' : 'dig' });
  c.fillStyle = '#222'; c.font = '13px sans-serif'; c.fillText(f.name, x + 12, y + ch - 12);
});
window.__ready = true;
