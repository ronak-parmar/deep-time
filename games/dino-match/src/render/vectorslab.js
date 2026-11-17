// Code-drawn fossil slab, made to sit next to the painted T. rex slab (art/fossils/cretaceous-tyrannosaurus.webp): a dark teal
// niche under a carved stone arch, a warm golden light shaft from the top left, a chunky orange sandstone slab with chiselled
// edges, cracks and mineral speckle, the fossil's skeleton carved in relief (recessed groove, cast shadow, warm rim light, ivory to
// amber bone with grain), two stone posts holding a brass plaque, and a brush and a brass dish on the ledge.
// Used for every fossil that has no picture yet, so the museum and the dig site never mix two styles. Pure canvas, no images.
import { drawFossilArt, fitFor } from './fossilArt.js';
import { rng01 } from './util.js';

export const VW = 540, VH = 870;   // same size as the 540 x 870 view of the painted slabs (1080 x 1740)
// outline of the slab face that the dig dirt covers (0..1), traced from the slab path below
export const VECTOR_COVER = [[.08, .17], [.3, .12], [.62, .11], [.86, .15], [.95, .3], [.96, .55], [.93, .7], [.6, .74], [.2, .74], [.05, .68], [.03, .45], [.04, .28]];

const BOX = { x: VW * 0.09, y: VH * 0.17, w: VW * 0.82, h: VH * 0.5 };   // where the skeleton is drawn

// The 10 dig strokes follow the skeleton's own 10 parts: each brushes along its part's long side, wide enough to clear it.
export function vectorReveal(fossil) {
  const f = fitFor(fossil.shape, BOX.x, BOX.y, BOX.w, BOX.h, 0.02);
  return fossil.shape.map((part) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y) => { x = f.ox + x * f.s; y = f.oy + y * f.s; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const pr of part) { if (pr.k === 'e') { add(pr.p[0] - pr.p[2], pr.p[1] - pr.p[3]); add(pr.p[0] + pr.p[2], pr.p[1] + pr.p[3]); } else for (let k = 0; k < pr.p.length; k += 2) add(pr.p[k], pr.p[k + 1]); }
    const wide = x1 - x0 >= y1 - y0, rad = Math.min(VW * 0.22, (wide ? y1 - y0 : x1 - x0) * 0.6 + 16), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const a = wide ? [x0 + rad * 0.5, cy] : [cx, y0 + rad * 0.5], b = wide ? [x1 - rad * 0.5, cy] : [cx, y1 - rad * 0.5];
    const pts = (wide ? x1 - x0 : y1 - y0) > rad ? [a, [cx, cy], b] : [[cx, cy]];
    return pts.map(([x, y]) => [Math.max(0, Math.min(1, x / VW)), Math.max(0, Math.min(1, y / VH)), rad / VW]);
  });
}

const SLAB = [[.06, .16], [.2, .125], [.42, .105], [.64, .1], [.82, .125], [.93, .19], [.965, .33], [.97, .5], [.955, .64], [.9, .73], [.7, .755], [.45, .76], [.22, .755], [.08, .72], [.03, .6], [.025, .42], [.035, .27]];

export function renderVectorSlab(fossil) {
  const W = VW, H = VH, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), r = rng01(fossil.id.length * 977 + fossil.id.charCodeAt(0) * 31 + fossil.id.charCodeAt(fossil.id.length - 1));
  const off = () => { const o = document.createElement('canvas'); o.width = W; o.height = H; return [o, o.getContext('2d')]; };

  // ---- the niche: dark teal wall, carved arch, light shaft --------------------------------------------------------------
  let g = c.createRadialGradient(W * 0.5, H * 0.35, 20, W * 0.5, H * 0.4, H * 0.7); g.addColorStop(0, '#2E5A52'); g.addColorStop(0.6, '#1A3833'); g.addColorStop(1, '#0E1E1B');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const archPath = (inset) => { c.beginPath(); c.moveTo(inset, H); c.lineTo(inset, H * 0.2); c.quadraticCurveTo(W / 2, -H * 0.06 + inset * 0.6, W - inset, H * 0.2); c.lineTo(W - inset, H); };
  c.lineJoin = 'round';
  archPath(14); c.lineWidth = 34; c.strokeStyle = '#4A2E18'; c.stroke();
  archPath(14); c.lineWidth = 26; g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#B07840'); g.addColorStop(0.5, '#8A5A2E'); g.addColorStop(1, '#6A4222'); c.strokeStyle = g; c.stroke();
  archPath(10); c.lineWidth = 4; c.strokeStyle = 'rgba(255,214,150,.45)'; c.stroke();
  // brass plates on the wall, as in the painted slab
  for (const [x, y] of [[W * 0.14, H * 0.12], [W * 0.86, H * 0.12]]) { g = c.createLinearGradient(0, y - 8, 0, y + 8); g.addColorStop(0, '#F2C66A'); g.addColorStop(1, '#8A5A14'); c.fillStyle = g; c.beginPath(); c.roundRect(x - 38, y - 8, 76, 16, 3); c.fill(); }
  c.save(); c.globalCompositeOperation = 'screen';
  g = c.createRadialGradient(W * 0.08, -H * 0.02, 10, W * 0.08, 0, H * 0.75); g.addColorStop(0, 'rgba(255,206,120,.75)'); g.addColorStop(0.45, 'rgba(255,190,100,.22)'); g.addColorStop(1, 'rgba(255,190,100,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (const [x0, x1, al] of [[0.02, 0.16, 0.16], [0.2, 0.3, 0.1]]) { g = c.createLinearGradient(0, 0, W * 0.5, H * 0.6); g.addColorStop(0, `rgba(255,220,150,${al})`); g.addColorStop(1, 'rgba(255,220,150,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(W * x0, 0); c.lineTo(W * x1, 0); c.lineTo(W * (x1 + 0.45), H * 0.7); c.lineTo(W * (x0 + 0.45), H * 0.7); c.closePath(); c.fill(); }
  c.restore();

  // ---- the slab -----------------------------------------------------------------------------------------------------------
  const pts = [];   // the outline with chips: every edge gets 2 extra jittered points, some pushed in (a chipped edge)
  SLAB.forEach(([x, y], i) => { const [nx, ny] = SLAB[(i + 1) % SLAB.length]; for (let k = 0; k < 3; k++) { const f = k / 3, cx = (x + (nx - x) * f) * W, cy = (y + (ny - y) * f) * H, dx = cx - W / 2, dy = cy - H * 0.43, d = Math.hypot(dx, dy) || 1, push = k === 0 ? (r() - 0.5) * 6 : -r() * 9; pts.push([cx + dx / d * push, cy + dy / d * push]); } });
  const slab = (cc) => { cc.beginPath(); pts.forEach(([x, y], i) => (i ? cc.lineTo(x, y) : cc.moveTo(x, y))); cc.closePath(); };   // straight chiselled facets
  c.save(); c.shadowColor = 'rgba(0,0,0,.7)'; c.shadowBlur = 26; c.shadowOffsetX = 8; c.shadowOffsetY = 12; slab(c); c.fillStyle = '#9A5A22'; c.fill(); c.restore();
  // side thickness (bottom right) so it reads as a chunk of rock
  c.save(); c.translate(7, 9); slab(c); c.fillStyle = '#6E3A12'; c.fill(); c.restore();
  c.save(); slab(c); c.clip();
  g = c.createLinearGradient(0, H * 0.1, W, H * 0.75); g.addColorStop(0, '#F6C27A'); g.addColorStop(0.35, '#E59A4C'); g.addColorStop(0.75, '#C8762E'); g.addColorStop(1, '#9C5420'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 240; i++) { const x = r() * W, y = H * 0.08 + r() * H * 0.72, rr = 10 + r() * 50, k = r() > 0.45; const gg = c.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, k ? 'rgba(255,224,160,.16)' : 'rgba(110,52,14,.14)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gg; c.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  for (let i = 0; i < 900; i++) { const x = r() * W, y = H * 0.08 + r() * H * 0.72; c.fillStyle = r() > 0.5 ? 'rgba(255,236,190,.35)' : 'rgba(90,40,10,.35)'; c.fillRect(x, y, 1 + r() * 1.6, 1 + r() * 1.6); }   // mineral speckle
  // chiselled facets: a few big planes, lighter on the top left
  for (let i = 0; i < 7; i++) { const x = r() * W, y = H * 0.12 + r() * H * 0.55, s = 40 + r() * 70; c.fillStyle = `rgba(${r() > 0.5 ? '255,226,170,.12' : '120,56,16,.12'})`; c.beginPath(); c.moveTo(x, y); c.lineTo(x + s, y + s * (r() - 0.3)); c.lineTo(x + s * (r() - 0.2), y + s); c.closePath(); c.fill(); }
  c.lineCap = 'round';
  for (let i = 0; i < 9; i++) {   // cracks: dark line with a lit lip
    let x = r() * W, y = H * 0.12 + r() * H * 0.6; const seg = [[x, y]];
    for (let k = 0; k < 6; k++) { x += (r() - 0.45) * 42; y += (r() - 0.35) * 30; seg.push([x, y]); }
    c.beginPath(); seg.forEach(([a, b], k) => (k ? c.lineTo(a, b) : c.moveTo(a, b))); c.strokeStyle = 'rgba(70,30,6,.65)'; c.lineWidth = 1.4 + r() * 1.4; c.stroke();
    c.save(); c.translate(1.2, 1.4); c.strokeStyle = 'rgba(255,220,160,.35)'; c.lineWidth = 0.9; c.stroke(); c.restore();
  }
  // bevel: shadow along the bottom right inside edge, rim light on the top left
  slab(c); c.lineWidth = 26; c.strokeStyle = 'rgba(90,36,6,.35)'; c.stroke();
  c.save(); c.translate(-5, -6); slab(c); c.lineWidth = 8; c.strokeStyle = 'rgba(255,236,180,.55)'; c.stroke(); c.restore();

  // ---- the skeleton in relief --------------------------------------------------------------------------------------------
  const [art, a] = off();
  const box = BOX;
  drawFossilArt(a, fossil.shape, box.x, box.y, box.w, box.h, { look: 'bone', revealed: 10, margin: 0.02 });
  const sil = (col) => { const [o, oc] = off(); oc.drawImage(art, 0, 0); oc.globalCompositeOperation = 'source-in'; oc.fillStyle = col; oc.fillRect(0, 0, W, H); return o; };
  const dark = sil('#3A1A04'), light = sil('#FFE9B0');
  // carved groove around the bones (the stone was cut away), then the cast shadow, then the rim light
  c.save(); c.globalAlpha = 0.45; c.filter = 'blur(7px)'; c.drawImage(dark, 0, 0); c.restore();
  c.save(); c.globalAlpha = 0.6; c.filter = 'blur(3px)'; c.drawImage(dark, 5, 7); c.restore();
  c.save(); c.globalAlpha = 0.85; c.drawImage(light, -2.5, -3); c.restore();
  // the bone: ivory (top left) to amber (bottom right), the drawing's own lines kept on top, rounded by an inner bevel, plus grain
  const [bone, b] = off();
  g = b.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h); g.addColorStop(0, '#FFF6DE'); g.addColorStop(0.5, '#F6D9A4'); g.addColorStop(1, '#E2AE68');
  b.fillStyle = g; b.fillRect(0, 0, W, H); b.globalCompositeOperation = 'destination-in'; b.drawImage(art, 0, 0);
  b.globalCompositeOperation = 'multiply'; b.globalAlpha = 0.55; b.drawImage(art, 0, 0); b.globalAlpha = 1;
  const bevel = (col, dx, dy, al) => { const [o, oc] = off(); oc.fillStyle = col; oc.fillRect(0, 0, W, H); oc.globalCompositeOperation = 'destination-out'; oc.filter = 'blur(2.5px)'; oc.drawImage(art, dx, dy); b.globalCompositeOperation = 'source-atop'; b.globalAlpha = al; b.drawImage(o, 0, 0); b.globalAlpha = 1; };
  bevel('#7A3C0C', -4, -5, 0.6);   // shade along the bottom right of every bone
  bevel('#FFFBEA', 3, 4, 0.75);    // light along the top left
  b.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 700; i++) { const x = box.x + r() * box.w, y = box.y + r() * box.h; b.fillStyle = r() > 0.5 ? 'rgba(120,70,20,.2)' : 'rgba(255,250,230,.25)'; b.fillRect(x, y, 1.5, 1.5); }
  c.drawImage(bone, 0, 0);
  c.restore();   // end slab clip

  // ---- ledge, posts, brass plaque, props ------------------------------------------------------------------------------------
  g = c.createLinearGradient(0, H * 0.8, 0, H); g.addColorStop(0, '#B07038'); g.addColorStop(0.15, '#8A5226'); g.addColorStop(1, '#3E200C'); c.fillStyle = g; c.fillRect(0, H * 0.8, W, H * 0.2);
  c.fillStyle = 'rgba(255,214,150,.4)'; c.fillRect(0, H * 0.8, W, 3);
  for (let i = 0; i < 6; i++) { c.strokeStyle = 'rgba(40,18,4,.5)'; c.lineWidth = 2; const x = W * (0.08 + i * 0.17 + r() * 0.05); c.beginPath(); c.moveTo(x, H * 0.8); c.lineTo(x + 6, H); c.stroke(); }
  for (const x of [W * 0.12, W * 0.8]) {   // stone posts
    g = c.createLinearGradient(x, 0, x + W * 0.08, 0); g.addColorStop(0, '#D89A58'); g.addColorStop(1, '#8A5226');
    c.fillStyle = g; c.beginPath(); c.roundRect(x, H * 0.735, W * 0.08, H * 0.09, 4); c.fill(); c.strokeStyle = 'rgba(50,22,6,.6)'; c.lineWidth = 2; c.stroke();
  }
  const px = W * 0.31, py = H * 0.755, pw = W * 0.38, ph = H * 0.05;
  c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 8; c.shadowOffsetY = 3;
  g = c.createLinearGradient(0, py, 0, py + ph); g.addColorStop(0, '#FFE6A0'); g.addColorStop(0.45, '#D9A440'); g.addColorStop(1, '#8A5A14');
  c.fillStyle = g; c.beginPath(); c.roundRect(px, py, pw, ph, 6); c.fill(); c.restore();
  c.strokeStyle = '#5A3A0A'; c.lineWidth = 2.5; c.beginPath(); c.roundRect(px, py, pw, ph, 6); c.stroke();
  c.strokeStyle = 'rgba(255,240,190,.6)'; c.lineWidth = 1.2; c.beginPath(); c.roundRect(px + 5, py + 5, pw - 10, ph - 10, 3); c.stroke();
  c.fillStyle = '#4A2C06'; c.font = `800 ${Math.round(ph * 0.44)}px Nunito, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(fossil.name, px + pw / 2, py + ph / 2 + 1, pw - 22);
  // brush (bottom left) and brass dish (bottom right)
  c.save(); c.translate(W * 0.22, H * 0.925); c.rotate(-0.3); c.scale(1.45, 1.45);
  g = c.createLinearGradient(0, -8, 0, 8); g.addColorStop(0, '#9A4E22'); g.addColorStop(1, '#4E200A'); c.fillStyle = g; c.beginPath(); c.roundRect(-110, -8, 110, 16, 8); c.fill();
  c.fillStyle = '#D9A440'; c.fillRect(-2, -10, 18, 20);
  g = c.createLinearGradient(16, 0, 70, 0); g.addColorStop(0, '#E8C890'); g.addColorStop(1, '#B08A50'); c.fillStyle = g; c.beginPath(); c.moveTo(16, -11); c.lineTo(66, -16); c.lineTo(70, 16); c.lineTo(16, 11); c.closePath(); c.fill();
  c.restore();
  c.save(); c.translate(W * 0.83, H * 0.9); c.scale(1.3, 1.3);
  g = c.createLinearGradient(0, -14, 0, 18); g.addColorStop(0, '#F2C66A'); g.addColorStop(1, '#7A4A10'); c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 62, 20, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#C08A4A'; c.beginPath(); c.ellipse(0, -3, 50, 12, 0, 0, Math.PI * 2); c.fill();
  c.restore();
  for (let i = 0; i < 5; i++) { const x = W * (0.45 + r() * 0.3), y = H * (0.86 + r() * 0.08), s = 8 + r() * 12; c.fillStyle = '#8A4E22'; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s, y); c.lineTo(x, y + s * 0.5); c.lineTo(x - s * 0.8, y); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,214,150,.4)'; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.3, y - s * 0.3); c.lineTo(x - s * 0.8, y); c.closePath(); c.fill(); }
  return cv;
}
