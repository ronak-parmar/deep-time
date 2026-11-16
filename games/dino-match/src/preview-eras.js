// Dev-only: all ten era boards side by side, built with the real Renderer and Play screen.
import { injectDesignSystem, loadFonts } from './ui/tokens.js';
import { Renderer } from './render/renderer.js';
import { createState } from './core/game.js';
import { generateLevel } from './core/level.js';
import { ERAS } from './core/eras.js';
import { THEMES } from './render/eraTheme.js';
import { mountPlay } from './screens/play.js';

injectDesignSystem();
await loadFonts();
const grid = document.getElementById('grid');
for (let i = 0; i < ERAS.length; i++) {
  const era = ERAS[i], n = i * 100 + 21;
  const tile = document.createElement('div'); tile.className = 'tile';
  tile.innerHTML = `<div class="box"><div class="inner"><canvas width="360" height="640"></canvas><div class="ui"></div></div></div><p class="cap">${era.name}: ${THEMES[era.id].label}</p>`;
  grid.append(tile);
  const level = generateLevel(n), state = createState(level);
  const r = new Renderer(tile.querySelector('canvas'));
  r.resize(1);
  await r.setEra(era.id);
  r.startLevel(state); r.locked = true;
  mountPlay(tile.querySelector('.ui'), { level, state, onHome() {} });
}
document.body.dataset.ready = '1';
