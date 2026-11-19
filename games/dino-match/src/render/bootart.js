// The loading screen's moving layer (M10), drawn over the painted background (art/boot/loading-bg.webp, or the final painting
// art/boot/loading-bg-final.webp; see screens/boot.js): a few soft light rays swaying down from the top and dust motes drifting up
// through the light. Transparent canvas, nothing allocated per frame beyond colour strings. Not drawn under reduced motion.
const TAU = Math.PI * 2;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const RAYS = Array.from({ length: 5 }, (_, i) => { const r = rng(40 + i); return [-0.5 + i * 0.25 + (r() - 0.5) * 0.1, 0.05 + r() * 0.05, r() * TAU, 0.6 + r() * 0.6]; });
export function drawRays(c, W, H, t) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const ox = W / 2, oy = -H * 0.08;
  for (const [ang, wid, ph, sp] of RAYS) {
    const a = ang + Math.sin(t * 0.00025 * sp + ph) * 0.05, al = 0.05 + 0.04 * (0.5 + 0.5 * Math.sin(t * 0.0007 * sp + ph));
    const g = c.createLinearGradient(ox, oy, ox + Math.sin(a) * H, oy + Math.cos(a) * H);
    g.addColorStop(0, `rgba(255,224,150,${al.toFixed(3)})`); g.addColorStop(0.7, 'rgba(255,214,140,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(ox, oy);
    c.lineTo(ox + Math.sin(a - wid) * H * 1.1, oy + Math.cos(a - wid) * H * 1.1); c.lineTo(ox + Math.sin(a + wid) * H * 1.1, oy + Math.cos(a + wid) * H * 1.1);
    c.closePath(); c.fill();
  }
  c.restore();
}

// dust motes drifting up through the light (t in ms; positions are a pure function of t, nothing allocated)
const MOTES = Array.from({ length: 26 }, (_, i) => { const r = rng(100 + i); return [r(), r(), 0.4 + r() * 0.8, 0.8 + r() * 1.8, r() * TAU]; });
export function drawMotes(c, W, H, t) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const [sx, sy, sp, sz, ph] of MOTES) {
    const y = H - (((t * 0.012 * sp) + sy * H) % (H * 0.9)), x = sx * W + Math.sin(t * 0.0006 * sp + ph) * 14;
    const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.002 * sp + ph));
    c.fillStyle = `rgba(255,226,160,${a.toFixed(3)})`; c.beginPath(); c.arc(x, y, sz, 0, TAU); c.fill();
  }
  c.restore();
}
