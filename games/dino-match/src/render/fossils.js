// Code-drawn fossils, one per era, drawn in a cream-on-stone style into the rect (x, y, w, h).
const BONE = '#EADFC2', EDGE = '#5E4B30', SHADE = '#B8A57E';

function ink(c) { c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = EDGE; c.fillStyle = BONE; c.lineWidth = 2.5; }

const DRAW = {
  cambrian(c, w, h) { // trilobite
    const rx = Math.min(w, h * 1.6) * 0.3, ry = h * 0.4;
    ink(c); c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 6.283); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(0, -ry * 0.55, rx * 0.75, ry * 0.4, 0, Math.PI, 0); c.fillStyle = SHADE; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(0, -ry * 0.55); c.lineTo(0, ry); c.stroke();
    for (let i = 0; i < 6; i++) { const y = -ry * 0.2 + i * ry * 0.22, k = Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)); c.beginPath(); c.moveTo(-rx * k, y); c.quadraticCurveTo(0, y + 5, rx * k, y); c.stroke(); }
  },
  devonian(c, w, h) { // fish
    const L = Math.min(w * 0.42, h * 0.9);
    ink(c); c.beginPath(); c.moveTo(-L, 0); c.quadraticCurveTo(-L * 0.1, -h * 0.4, L * 0.7, 0); c.quadraticCurveTo(-L * 0.1, h * 0.4, -L, 0); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(L * 0.7, 0); c.lineTo(L, -h * 0.3); c.lineTo(L, h * 0.3); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.arc(-L * 0.68, -h * 0.05, 4, 0, 6.283); c.fillStyle = EDGE; c.fill();
    c.lineWidth = 1.5; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(-L * 0.4 + i * L * 0.18, 0, h * 0.16, -1, 1); c.stroke(); }
  },
  carboniferous(c, w, h) { // fern
    ink(c); c.beginPath(); c.moveTo(-w * 0.4, h * 0.3); c.quadraticCurveTo(0, -h * 0.1, w * 0.4, -h * 0.25); c.stroke();
    for (let i = 0; i < 11; i++) { const t = i / 10, x = -w * 0.4 + t * w * 0.8, y = h * 0.3 - t * h * 0.55 - Math.sin(t * 3.14) * h * 0.13, l = (1 - t * 0.6) * h * 0.38;
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 4, y + s * l); c.stroke(); } }
  },
  permian(c, w, h) { // early reptile skeleton
    ink(c); c.lineWidth = 3; c.beginPath(); c.moveTo(-w * 0.4, h * 0.1); c.quadraticCurveTo(0, -h * 0.1, w * 0.25, 0); c.stroke();
    c.beginPath(); c.moveTo(-w * 0.4, h * 0.1); c.quadraticCurveTo(-w * 0.48, h * 0.3, -w * 0.32, h * 0.38); c.stroke();
    c.lineWidth = 2; for (let i = 0; i < 7; i++) { const x = -w * 0.28 + i * w * 0.075; c.beginPath(); c.moveTo(x, -h * 0.03); c.quadraticCurveTo(x + 3, h * 0.2, x + 9, h * 0.28); c.stroke(); }
    c.beginPath(); c.ellipse(w * 0.34, 0, w * 0.1, h * 0.14, 0.2, 0, 6.283); c.fill(); c.stroke(); c.beginPath(); c.arc(w * 0.37, -h * 0.03, 3, 0, 6.283); c.fillStyle = EDGE; c.fill();
  },
  triassic(c, w, h) { // dinosaur skull
    ink(c); c.beginPath(); c.moveTo(-w * 0.3, -h * 0.05); c.quadraticCurveTo(-w * 0.05, -h * 0.45, w * 0.18, -h * 0.25); c.lineTo(w * 0.42, -h * 0.05); c.lineTo(w * 0.4, h * 0.1); c.lineTo(w * 0.1, h * 0.14); c.quadraticCurveTo(-w * 0.2, h * 0.4, -w * 0.3, h * 0.2); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(w * 0.05, -h * 0.08, w * 0.07, h * 0.12, 0, 0, 6.283); c.fillStyle = EDGE; c.fill();
    c.fillStyle = BONE; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(w * 0.12 + i * w * 0.05, h * 0.12); c.lineTo(w * 0.14 + i * w * 0.05, h * 0.2); c.lineTo(w * 0.16 + i * w * 0.05, h * 0.12); c.fill(); c.stroke(); }
  },
  jurassic(c, w, h) { // sauropod bone
    ink(c); const L = w * 0.36, r = h * 0.2;
    for (const x of [-L, L]) for (const y of [-r * 0.9, r * 0.9]) { c.beginPath(); c.arc(x, y * 0.5, r * 0.75, 0, 6.283); c.fill(); c.stroke(); }
    c.beginPath(); c.rect(-L, -r * 0.4, L * 2, r * 0.8); c.fill(); c.beginPath(); c.moveTo(-L, -r * 0.4); c.lineTo(L, -r * 0.4); c.moveTo(-L, r * 0.4); c.lineTo(L, r * 0.4); c.stroke();
  },
  cretaceous(c, w, h) { // ammonite
    const R = Math.min(w * 0.3, h * 0.46);
    ink(c); c.beginPath(); c.arc(0, 0, R, 0, 6.283); c.fill(); c.stroke();
    c.beginPath(); for (let a = 0; a <= 6.283 * 2.3; a += 0.15) { const r = R * 0.92 * (1 - a / (6.283 * 2.6)); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.stroke();
    c.lineWidth = 1.5; for (let k = 0; k < 14; k++) { const a = (k / 14) * 6.283 + 0.3; c.beginPath(); c.moveTo(Math.cos(a) * R * 0.35, Math.sin(a) * R * 0.35); c.lineTo(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9); c.stroke(); }
  },
  'age-of-mammals'(c, w, h) { // tusk
    ink(c); c.lineWidth = 3; c.beginPath(); c.moveTo(-w * 0.35, h * 0.3); c.bezierCurveTo(-w * 0.2, -h * 0.5, w * 0.25, -h * 0.5, w * 0.38, h * 0.05); c.lineTo(w * 0.33, h * 0.1); c.bezierCurveTo(w * 0.2, -h * 0.28, -w * 0.15, -h * 0.25, -w * 0.28, h * 0.32); c.closePath(); c.fill(); c.stroke();
  },
  'ice-age'(c, w, h) { // mammoth tooth
    ink(c); const tw = w * 0.34, th = h * 0.36;
    c.beginPath(); c.moveTo(-tw, th * 0.6); c.lineTo(-tw, -th * 0.2); c.quadraticCurveTo(0, -th * 1.3, tw, -th * 0.2); c.lineTo(tw, th * 0.6); c.closePath(); c.fill(); c.stroke();
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * tw * 0.28, th * 0.55); c.lineTo(i * tw * 0.24, -th * 0.55 + Math.abs(i) * 5); c.stroke(); }
  },
  'early-humans'(c, w, h) { // hand axe
    ink(c); c.beginPath(); c.moveTo(0, -h * 0.42); c.bezierCurveTo(w * 0.22, -h * 0.2, w * 0.2, h * 0.25, 0, h * 0.42); c.bezierCurveTo(-w * 0.2, h * 0.25, -w * 0.22, -h * 0.2, 0, -h * 0.42); c.fillStyle = SHADE; c.fill(); c.stroke();
    c.lineWidth = 1.5; c.beginPath(); c.moveTo(-w * 0.1, -h * 0.1); c.lineTo(0, -h * 0.3); c.lineTo(w * 0.1, -h * 0.1); c.moveTo(-w * 0.12, h * 0.15); c.lineTo(0, 0); c.lineTo(w * 0.12, h * 0.15); c.stroke();
  }
};

export function drawFossil(c, eraId, x, y, w, h) {
  c.save();
  c.translate(x + w / 2, y + h / 2);
  (DRAW[eraId] || DRAW.cretaceous)(c, w, h);
  c.restore();
}
