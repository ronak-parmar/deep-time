// Painted layers: background + props with slow parallax and sway, HUD plates, booster medallions.
// Motion uses LOOP.scene from motion.js (slow, subtle) and is frozen under reduced motion. No per-frame allocations.
import { slot, slotsReady, drawSlot } from './art.js';
import { HUD_LAYOUT, BOOSTER_LAYOUT, PROP_W } from './artManifest.js';
import { LOOP } from './motion.js';

const W = 360, H = 640, TAU = Math.PI * 2, OVER = 0.06;      // background is drawn 6% larger so it can drift without edges showing
// per-era feel lives in eraTheme.js (theme.paint): drift px, sway amount (shear), glow depth
const DEF = { drift: 6, sway: 0.035, glow: 0.3 };

// Anchor point and image offset for each anchor code (stage px).
function place(anchor, w, h) {
  switch (anchor) {
    case 'tl': return [0, 0, 0, 0]; case 'tr': return [W, 0, -w, 0];
    case 'bl': return [0, H, 0, -h]; case 'br': return [W, H, -w, -h];
    case 't': return [W / 2, 0, -w / 2, 0]; case 'b': return [W / 2, H, -w / 2, -h];
    case 'l': return [0, H / 2, 0, -h / 2]; case 'r': return [W, H / 2, -w, -h / 2];
    default: return [W / 2, H / 2, -w / 2, -h / 2];
  }
}

export function drawBackdrop(c, art, theme, now, reduced) {
  const p = { ...DEF, ...(theme.paint || {}) }, t = reduced ? 0 : (now / LOOP.scene) * TAU;
  const bg = art.bg, k = 1 + OVER, bw = W * k, bh = H * k;
  c.drawImage(bg, -(bw - W) / 2 + Math.sin(t) * p.drift * 0.6, -(bh - H) / 2 + Math.cos(t * 0.7) * p.drift * 0.4, bw, bh);   // far layer drifts least
  for (let i = 0; i < art.props.length; i++) {
    const pr = art.props[i], img = pr.img;
    const w = pr.anchor === 't' || pr.anchor === 'b' ? W : PROP_W, h = (img.height / img.width) * w;
    const [ax, ay, ox, oy] = place(pr.anchor, w, h), ph = t + i * 1.7;
    const sway = Math.sin(ph) * p.sway, dx = Math.sin(t * 0.8 + i) * p.drift;   // near layer drifts more
    c.save(); c.translate(ax + dx, ay);
    c.transform(1, 0, sway * (pr.anchor[0] === 'b' ? -1 : 1), 1, 0, 0);          // shear about the anchor edge
    if (pr.glow) c.globalAlpha = 1 - p.glow * 0.5 + p.glow * 0.5 * Math.sin(ph * 1.3);
    c.drawImage(img, ox, oy, w, h);
    c.restore();
  }
}

export const hudPainted = () => slotsReady('hud-sign', 'target-sign', 'moves-medallion', 'back-button');
export function drawHud(c) {
  const L = HUD_LAYOUT;
  drawSlot(c, 'hud-sign', L.level.x, L.level.y, L.level.w, L.level.h);
  drawSlot(c, 'target-sign', L.target.x, L.target.y, L.target.w, L.target.h);
  drawSlot(c, 'moves-medallion', L.moves.x, L.moves.y, L.moves.w, L.moves.h);
  drawSlot(c, 'back-button', L.back.x, L.back.y, L.back.w, L.back.h);
}

const BOOSTERS = [['booster-pick', 'count-badge-blue', 'pick'], ['booster-burst', 'count-badge-red', 'burst'], ['booster-brush', 'count-badge-green', 'brush']];
export const boostersPainted = () => BOOSTERS.every(([m]) => !!slot(m));
export function drawBoosters(c, counts, enabled, label) {
  const B = BOOSTER_LAYOUT;
  BOOSTERS.forEach(([m, badge, k], i) => {
    c.globalAlpha = enabled ? 1 : 0.7;
    drawSlot(c, m, B.cx[i] - B.size / 2, B.cy - B.size / 2, B.size, B.size);
    if (slot(badge)) drawSlot(c, badge, B.cx[i] + 10, B.cy - 30, 20, 20);
    c.globalAlpha = 1; label(c, String(counts?.[k] ?? 0), B.cx[i] + 20, B.cy - 20, 12);
  });
}
