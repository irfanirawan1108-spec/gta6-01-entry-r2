// Particles and floating text: smoke, sparks, muzzle flashes, splashes,
// crash debris. All drawn as small circles/rects; no images.
import { G } from './state.js';

export function spawn(x, y, n, color, speed = 60, life = 0.6, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: life * (0.6 + Math.random() * 0.7), max: life, color, size: size * (0.6 + Math.random() * 0.8) });
  }
}
export function smoke(x, y) {
  G.parts.push({ x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 12, vy: -18 - Math.random() * 14, t: 0.9, max: 0.9, color: '#888', size: 5 + Math.random() * 4, smoke: true });
}
export function updateParts(dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i];
    p.t -= dt;
    if (p.t <= 0) { G.parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.98; p.vy *= 0.98;
  }
  for (let i = G.texts.length - 1; i >= 0; i--) {
    const t = G.texts[i];
    t.t -= dt; t.y -= 22 * dt;
    if (t.t <= 0) G.texts.splice(i, 1);
  }
}
