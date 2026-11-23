// Particles, skid marks and floating text. Cheap, pooled, and drawn
// between the world and the HUD so effects read over the action.

import { clamp } from './random.js';

export function createParticles() {
  return {
    list: [],
    skids: [], // {x1,y1,x2,y2,life} tyre marks that fade slowly
    floats: [], // {x,y,text,color,life} rising score / pickup text
  };
}

export function spawn(p, kind, x, y, opts = {}) {
  const n = opts.n || 1;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = opts.speed ? opts.speed * (0.4 + Math.random() * 0.8) : 60 + Math.random() * 90;
    p.list.push({
      kind,
      x: x + (Math.random() - 0.5) * (opts.spread || 8),
      y: y + (Math.random() - 0.5) * (opts.spread || 8),
      vx: Math.cos(a) * sp + (opts.vx || 0),
      vy: Math.sin(a) * sp + (opts.vy || 0),
      life: opts.life || 0.5 + Math.random() * 0.4,
      maxLife: opts.life || 0.9,
      size: opts.size || 3 + Math.random() * 4,
      color: opts.color || '#ffffff',
      grav: opts.grav || 0,
      drag: opts.drag ?? 2.2,
    });
  }
  if (p.list.length > 900) p.list.splice(0, p.list.length - 900);
}

export function addSkid(p, x1, y1, x2, y2) {
  p.skids.push({ x1, y1, x2, y2, life: 6 });
  if (p.skids.length > 400) p.skids.shift();
}

export function addFloat(p, x, y, text, color = '#ffffff') {
  p.floats.push({ x, y, text, color, life: 1.4 });
}

export function updateParticles(p, dt) {
  for (let i = p.list.length - 1; i >= 0; i--) {
    const q = p.list[i];
    q.life -= dt;
    if (q.life <= 0) {
      p.list.splice(i, 1);
      continue;
    }
    q.vy += q.grav * dt;
    const d = Math.max(0, 1 - q.drag * dt);
    q.vx *= d;
    q.vy *= d;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
  }
  for (let i = p.skids.length - 1; i >= 0; i--) {
    p.skids[i].life -= dt;
    if (p.skids[i].life <= 0) p.skids.splice(i, 1);
  }
  for (let i = p.floats.length - 1; i >= 0; i--) {
    const f = p.floats[i];
    f.life -= dt;
    f.y -= 34 * dt;
    if (f.life <= 0) p.floats.splice(i, 1);
  }
}

export function explosion(p, x, y) {
  spawn(p, 'fire', x, y, { n: 26, speed: 260, life: 0.7, size: 7, color: '#ff9a2a', grav: -40 });
  spawn(p, 'smoke', x, y, { n: 14, speed: 70, life: 1.6, size: 12, color: '#555550', grav: -60 });
  spawn(p, 'spark', x, y, { n: 18, speed: 420, life: 0.5, size: 2, color: '#ffe95a', grav: 300 });
}

export function drawParticles(ctx, p) {
  // Skid marks first (under everything else).
  ctx.save();
  ctx.lineCap = 'round';
  for (const s of p.skids) {
    ctx.strokeStyle = `rgba(20,18,16,${clamp(s.life / 6, 0, 1) * 0.5})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  }
  ctx.restore();

  for (const q of p.list) {
    const a = clamp(q.life / q.maxLife, 0, 1);
    if (q.kind === 'smoke') {
      ctx.fillStyle = q.color;
      ctx.globalAlpha = a * 0.45;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.size * (1.6 - a * 0.6), 0, Math.PI * 2);
      ctx.fill();
    } else if (q.kind === 'fire') {
      ctx.globalAlpha = a;
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.size * a + 1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const f of p.floats) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.fillStyle = f.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}
