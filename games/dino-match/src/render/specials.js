import { aiUrl } from '../ui/kitart.js';
// Special pieces drawn as simple code overlays, plus their blast effects. Presentation only: the rules live in core/specials.js.
// No durations here: effect life and timing come from motion.js recipes (passed in as fx.life).
import { LOOP, EASE } from './motion.js';

const TAU = Math.PI * 2;
const OUT = '#1A100A';

function arrow(c, dir, r) {   // small triangle pointing along `dir` (+1 / -1) on the x axis
  c.beginPath(); c.moveTo(dir * r * 0.95, 0); c.lineTo(dir * r * 0.45, -r * 0.34); c.lineTo(dir * r * 0.45, r * 0.34); c.closePath();
  c.fillStyle = '#FFF4D2'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
}

// p = { k: kind, o: 'h'|'v' }. Drawn on top of the gem (or alone for rainbow), centred at 0,0, radius r.
export function drawSpecial(c, p, r, now, reduced) {
  const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin((now / LOOP.ambient) * TAU * 0.8);
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  switch (p.k) {
    case 'firecracker': {      // gem with two arrows along its blast axis and a lit fuse tip
      c.globalAlpha = 0.5 + 0.35 * pulse; c.strokeStyle = '#FFE9A8'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, r * 1.08, 0, TAU); c.stroke(); c.globalAlpha = 1;
      if (p.o === 'v') c.rotate(Math.PI / 2);
      c.save(); c.translate(-r * 0.05, 0); arrow(c, -1, r); c.restore(); c.save(); c.translate(r * 0.05, 0); arrow(c, 1, r); c.restore();
      break;
    }
    case 'bomb': {             // dark round bomb with a fuse and a spark
      c.fillStyle = 'rgba(20,16,22,.88)'; c.beginPath(); c.arc(0, r * 0.1, r * 0.62, 0, TAU); c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-r * 0.22, -r * 0.18, r * 0.16, r * 0.1, -0.7, 0, TAU); c.fill();
      c.strokeStyle = '#C79B5A'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(r * 0.2, -r * 0.45); c.quadraticCurveTo(r * 0.5, -r * 0.8, r * 0.7, -r * 0.62); c.stroke();
      c.fillStyle = `rgba(255,${190 + 50 * pulse | 0},80,1)`; c.beginPath(); c.arc(r * 0.72, -r * 0.64, r * (0.14 + 0.06 * pulse), 0, TAU); c.fill();
      break;
    }
    case 'dynamite': {         // three red sticks tied with a band and a fuse
      for (let k = -1; k <= 1; k++) {
        c.fillStyle = '#D5362B'; c.beginPath(); c.roundRect(k * r * 0.38 - r * 0.16, -r * 0.55, r * 0.32, r * 1.1, r * 0.1); c.fill(); c.lineWidth = 1.8; c.strokeStyle = OUT; c.stroke();
      }
      c.fillStyle = '#F2D79A'; c.fillRect(-r * 0.62, -r * 0.12, r * 1.24, r * 0.24); c.strokeStyle = OUT; c.lineWidth = 1.4; c.strokeRect(-r * 0.62, -r * 0.12, r * 1.24, r * 0.24);
      c.strokeStyle = '#C79B5A'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -r * 0.55); c.quadraticCurveTo(r * 0.1, -r * 0.85, r * 0.32, -r * 0.8); c.stroke();
      c.fillStyle = `rgba(255,${190 + 50 * pulse | 0},80,1)`; c.beginPath(); c.arc(r * 0.34, -r * 0.8, r * (0.11 + 0.05 * pulse), 0, TAU); c.fill();
      break;
    }
    case 'tnt': {              // red crate with a white label
      c.fillStyle = '#C42B22'; c.beginPath(); c.roundRect(-r * 0.78, -r * 0.62, r * 1.56, r * 1.24, r * 0.14); c.fill(); c.lineWidth = 2.2; c.strokeStyle = OUT; c.stroke();
      c.fillStyle = '#F6EAD0'; c.fillRect(-r * 0.62, -r * 0.24, r * 1.24, r * 0.48);
      c.fillStyle = '#7B1810'; c.font = `800 ${Math.round(r * 0.5)}px Nunito, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('TNT', 0, r * 0.02);
      c.globalAlpha = 0.35 + 0.3 * pulse; c.strokeStyle = '#FFE9A8'; c.lineWidth = 2.5; c.strokeRect(-r * 0.86, -r * 0.7, r * 1.72, r * 1.4); c.globalAlpha = 1;
      break;
    }
    case 'rainbow': {          // spinning rainbow orb
      const g = c.createLinearGradient(-r, -r, r, r), t = reduced ? 0 : (now / LOOP.scene) % 1;
      ['#E5483F', '#F2C230', '#2FB868', '#3A9BE0', '#8E4FD0'].forEach((col, i, a) => g.addColorStop(i / (a.length - 1), col));
      c.rotate(t * TAU); c.beginPath(); c.arc(0, 0, r * 0.95, 0, TAU); c.fillStyle = g; c.fill(); c.lineWidth = 2.4; c.strokeStyle = OUT; c.stroke();
      c.rotate(-t * TAU); c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-r * 0.3, -r * 0.38, r * 0.24, r * 0.12, -0.7, 0, TAU); c.fill();
      c.globalAlpha = 0.5 + 0.4 * pulse; c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(r * 0.35, r * 0.3, r * 0.08, 0, TAU); c.fill(); c.globalAlpha = 1;
      break;
    }
  }
  c.restore();
}

// Blast effects: fx = { kind, o, x, y, cells:[{x,y}], t0, life, big, cs }. Drawn while `now` is inside [t0, t0 + life].
// the Pickaxe booster: the kit pickaxe swings down onto the cell (art/ui/kit/pickaxe.webp; a code pick if missing)
let pickImg = null;
function drawPickStrike(c, f, t) {
  if (pickImg === null) { const u = aiUrl('pickaxe'); pickImg = u ? Object.assign(new Image(), { src: u }) : false; }
  const S = f.cs * 1.6, strike = -1.39, raised = strike + 1.05, a = t < 0.5 ? strike + (raised - strike) * EASE.out(Math.min(1, t / 0.15)) : raised + (strike - raised) * EASE.in(Math.min(1, (t - 0.5) / 0.4));
  c.save(); c.globalAlpha = t > 0.92 ? (1 - t) / 0.08 : 1; c.translate(f.x + S * 0.5, f.y + S * 0.5); c.rotate(a);
  if (pickImg && pickImg.complete && pickImg.naturalWidth) { c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 6; c.shadowOffsetY = 3; c.drawImage(pickImg, -0.2 * S, -0.88 * S, S, S); }
  else { c.rotate(0.97); c.strokeStyle = '#7A5A3A'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -S * 0.7); c.stroke(); c.strokeStyle = '#C8CFD8'; c.lineWidth = 5; c.beginPath(); c.moveTo(-S * 0.3, -S * 0.62); c.quadraticCurveTo(0, -S * 0.8, S * 0.3, -S * 0.62); c.stroke(); }
  c.restore();
}
export function drawFx(c, list, now) {
  for (const f of list) {
    const t = (now - f.t0) / f.life; if (t < 0 || t > 1) continue;
    if (f.kind === 'pickstrike') { drawPickStrike(c, f, t); continue; }
    const e = EASE.out(t), fade = 1 - t * t, cs = f.cs;
    c.save(); c.globalAlpha = Math.max(0, fade); c.lineCap = 'round';
    if (f.kind === 'firecracker' || f.kind === 'combo' && f.cells.length) {
      // light beams from the source to every cell it hit (firecracker lines become a straight bar)
      c.strokeStyle = '#FFE9A8'; c.lineWidth = cs * 0.5 * (1 - t) + 2;
      for (const q of f.cells) { c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(f.x + (q.x - f.x) * e, f.y + (q.y - f.y) * e); c.stroke(); }
    }
    if (f.kind === 'rainbow') {
      c.strokeStyle = '#FFFFFF'; c.lineWidth = 3 * (1 - t) + 1;
      for (const q of f.cells) { c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(f.x + (q.x - f.x) * e, f.y + (q.y - f.y) * e); c.stroke(); }
    }
    if (f.kind === 'bomb' || f.kind === 'dynamite' || f.kind === 'tnt' || f.big) {
      const R = cs * (f.big ? 3.2 : f.kind === 'tnt' ? 3.6 : f.kind === 'dynamite' ? 2.6 : 1.8) * e;
      const g = c.createRadialGradient(f.x, f.y, R * 0.1, f.x, f.y, Math.max(1, R));
      g.addColorStop(0, 'rgba(255,244,214,.9)'); g.addColorStop(0.6, 'rgba(255,170,60,.5)'); g.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y, Math.max(1, R), 0, TAU); c.fill();
    }
    c.restore();
  }
}
