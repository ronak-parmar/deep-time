// Pooled particles: fixed typed arrays, no allocation per frame. Counts and lifetimes come from motion.js tokens.
import { PARTICLES, particleCount, DEBUG } from './motion.js';

const N = PARTICLES.max;
const KIND = { sparkle: 0, dust: 1, confetti: 2, shard: 3 };

export class ParticlePool {
  constructor() {
    this.x = new Float32Array(N); this.y = new Float32Array(N); this.vx = new Float32Array(N); this.vy = new Float32Array(N);
    this.age = new Float32Array(N); this.life = new Float32Array(N); this.size = new Float32Array(N);
    this.rot = new Float32Array(N); this.vr = new Float32Array(N); this.kind = new Uint8Array(N);
    this.live = new Uint8Array(N); this.color = new Array(N).fill('#fff');
    this.count = 0; this.cursor = 0;
  }
  alloc() { // reuse a free slot, else overwrite the oldest (ring) so the cap is never exceeded
    for (let k = 0; k < N; k++) { const i = (this.cursor + k) % N; if (!this.live[i]) { this.cursor = (i + 1) % N; this.live[i] = 1; this.count++; return i; } }
    const i = this.cursor; this.cursor = (i + 1) % N; return i;
  }
  emit(kind, x, y, color, n, speed = 3, spread = 1) {
    const cnt = particleCount(kind, n);
    for (let j = 0; j < cnt; j++) {
      const i = this.alloc(), a = Math.random() * 6.2832, v = (0.4 + Math.random()) * speed * spread;
      this.x[i] = x; this.y[i] = y; this.vx[i] = Math.cos(a) * v; this.vy[i] = Math.sin(a) * v - (kind === 'confetti' ? speed * 1.2 : speed * 0.35);
      this.age[i] = 0; this.life[i] = PARTICLES[kind].life * (0.75 + Math.random() * 0.5);
      this.size[i] = kind === 'dust' ? 2 + Math.random() * 3.5 : kind === 'shard' ? 4 + Math.random() * 3 : kind === 'confetti' ? 3 + Math.random() * 3 : 1.6 + Math.random() * 2.4;
      this.rot[i] = Math.random() * 6.28; this.vr[i] = (Math.random() - 0.5) * 0.4; this.kind[i] = KIND[kind]; this.color[i] = color;
    }
  }
  // dt in ms (scaled by the debug time scale so slow-motion captures stay consistent)
  step(dt) {
    dt *= DEBUG.timeScale; const f = dt / 16.667;
    for (let i = 0; i < N; i++) {
      if (!this.live[i]) continue;
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) { this.live[i] = 0; this.count--; continue; }
      const k = this.kind[i];
      this.x[i] += this.vx[i] * f; this.y[i] += this.vy[i] * f;
      this.vy[i] += (k === 1 ? 0.06 : k === 0 ? 0.05 : 0.2) * f;
      if (k === 1) { this.vx[i] *= 0.97; this.vy[i] *= 0.97; }
      this.rot[i] += this.vr[i] * f;
    }
  }
  draw(c) {
    for (let i = 0; i < N; i++) {
      if (!this.live[i]) continue;
      const t = this.age[i] / this.life[i], k = this.kind[i];
      c.globalAlpha = k === 1 ? 0.7 * (1 - t) : 1 - t * t;
      c.fillStyle = this.color[i];
      if (k === 0) { // 4-point sparkle
        const s = this.size[i] * (1 - t * 0.6);
        c.beginPath(); c.moveTo(this.x[i], this.y[i] - s * 1.6); c.lineTo(this.x[i] + s * 0.45, this.y[i]); c.lineTo(this.x[i], this.y[i] + s * 1.6); c.lineTo(this.x[i] - s * 0.45, this.y[i]); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(this.x[i] - s * 1.6, this.y[i]); c.lineTo(this.x[i], this.y[i] + s * 0.45); c.lineTo(this.x[i] + s * 1.6, this.y[i]); c.lineTo(this.x[i], this.y[i] - s * 0.45); c.closePath(); c.fill();
      } else if (k === 1) { c.beginPath(); c.arc(this.x[i], this.y[i], this.size[i] * (0.6 + t * 0.8), 0, 6.2832); c.fill(); }
      else { c.save(); c.translate(this.x[i], this.y[i]); c.rotate(this.rot[i]); const s = this.size[i]; c.fillRect(-s / 2, -s / 3, s, s * (k === 3 ? 0.9 : 0.6)); c.restore(); }
    }
    c.globalAlpha = 1;
  }
  clear() { this.live.fill(0); this.count = 0; }
}
