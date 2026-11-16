// Code-drawn gems: the fallback when an era has no sprites yet. Fixed silhouette per colour
// (red octagon, green oval, blue diamond, yellow triangle, purple pentagon, amber teardrop).
export const GEM_COLORS = ['#E5483F', '#2FB868', '#3A9BE0', '#F2C230', '#8E4FD0', '#F28A1E'];
export const GEM_NAMES = ['Red', 'Green', 'Blue', 'Yellow', 'Purple', 'Amber'];

function poly(c, n, r, rot = 0) {
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 2 * Math.PI) / n;
    i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath();
}

function shapePath(c, k, r) {
  switch (k) {
    case 0: poly(c, 8, r, Math.PI / 8); break;                       // octagon
    case 1: c.beginPath(); c.ellipse(0, 0, r * 0.78, r, 0, 0, 6.283); break; // oval
    case 2: poly(c, 4, r * 1.05, 0); break;                          // diamond
    case 3: c.beginPath(); c.moveTo(-r, -r * 0.7); c.lineTo(r, -r * 0.7); c.lineTo(0, r * 0.95); c.closePath(); break; // triangle (point down)
    case 4: poly(c, 5, r, -Math.PI / 2); break;                      // pentagon
    default:                                                         // teardrop
      c.beginPath(); c.moveTo(0, -r); c.bezierCurveTo(r * 0.3, -r * 0.4, r * 0.85, r * 0.1, r * 0.85, r * 0.2);
      c.arc(0, r * 0.2, r * 0.85, 0, Math.PI); c.bezierCurveTo(-r * 0.85, r * 0.1, -r * 0.3, -r * 0.4, 0, -r); c.closePath();
  }
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), ch = [n >> 16, (n >> 8) & 255, n & 255];
  return `rgb(${ch.map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)).join(',')})`;
}

// Draw gem k centred at 0,0 with radius r.
export function drawGemShape(c, k, r) {
  const col = GEM_COLORS[k];
  c.save();
  c.lineJoin = 'round';
  shapePath(c, k, r); c.fillStyle = shade(col, -0.5); c.fill(); c.lineWidth = Math.max(2, r * 0.1); c.strokeStyle = '#0B1220'; c.stroke();
  shapePath(c, k, r * 0.88);
  const g = c.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.05, 0, 0, r * 1.05);
  g.addColorStop(0, shade(col, 0.55)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, -0.35));
  c.fillStyle = g; c.fill();
  c.clip();
  c.fillStyle = 'rgba(255,255,255,.14)';
  for (let f = 0; f < 4; f++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(f * 1.57) * r * 1.3, Math.sin(f * 1.57) * r * 1.3); c.lineTo(Math.cos(f * 1.57 + 0.78) * r * 1.3, Math.sin(f * 1.57 + 0.78) * r * 1.3); c.closePath(); c.fill(); }
  c.restore();
  c.save(); shapePath(c, k, r * 0.88); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.4)'; c.stroke(); c.restore();
  c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(-r * 0.35, -r * 0.45, r * 0.2, r * 0.1, -0.7, 0, 6.283); c.fill();
}
