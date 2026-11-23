// The renderer: top-down city, day/night cycle with lit windows and
// headlights, traffic, pedestrians, police, effects. Canvas 2D only.
import { G } from './state.js';
import { CITY, lightPhase } from './city.js';
import { W, H, BLOCK, ROAD, rx, ry, rcx, rcy, COLS, ROWS } from './config.js';
import { missionMarker } from './missions.js';

const GROUND = { downtown: '#6e7b8a', oldtown: '#b59a6a', homes: '#7fa36b', park: '#4c9a4c', plaza: '#c2a24a', marina: '#6b7c8c', beach: '#eed9a0' };

// 0 = deep night, 1 = full day. Sunrise 6-7, sunset 17-20.
export function daylight(t) {
  if (t < 6 || t >= 20) return 0.08;
  if (t < 7) return 0.08 + (t - 6) * 0.92;
  if (t < 17) return 1;
  if (t < 18.5) return 1 - (t - 17) * 0.33;
  return 0.5 - (t - 18.5) * 0.28;
}
export function golden(t) {
  return Math.max(0, 1 - Math.abs(t - 17.75) / 1.3);
}
function inView(x, y, cam, vw, vh, m = 80) {
  return x > cam.x - m && x < cam.x + vw + m && y > cam.y - m && y < cam.y + vh + m;
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}
function drawGround(ctx, cam, vw, vh) {
  ctx.fillStyle = '#3d6b35';
  ctx.fillRect(cam.x, cam.y, vw, vh);
  for (const b of CITY.blocks) {
    const x = rx(b.cx) + ROAD, y = ry(b.cy) + ROAD;
    if (!inView(x + BLOCK / 2, y + BLOCK / 2, cam, vw, vh, 120)) continue;
    ctx.fillStyle = GROUND[b.d];
    ctx.fillRect(x, y, BLOCK, BLOCK);
  }
  // water: pond, marina basin, sea (animated wave lines)
  const wave = (x0, y0, w, h, n) => {
    ctx.fillStyle = '#2a7ab8';
    ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const yy = y0 + ((i * 23 + G.elapsed * 14) % h);
      ctx.beginPath(); ctx.moveTo(x0 + 8, yy); ctx.lineTo(x0 + w - 8, yy); ctx.stroke();
    }
  };
  wave(CITY.pond.x, CITY.pond.y, CITY.pond.w, CITY.pond.h, 4);
  ctx.fillStyle = '#1f6f9f';
  ctx.fillRect(CITY.basin.x, CITY.basin.y, CITY.basin.w, CITY.basin.h);
  wave(CITY.sea.x, CITY.sea.y, CITY.sea.w, CITY.sea.h, 1);
  // roads
  ctx.fillStyle = '#33373c';
  for (let i = 0; i <= COLS; i++) ctx.fillRect(rx(i), 0, ROAD, H);
  for (let j = 0; j <= ROWS; j++) ctx.fillRect(0, ry(j), W, ROAD);
  // centre dashes
  ctx.strokeStyle = '#d8c95a'; ctx.lineWidth = 2; ctx.setLineDash([14, 18]);
  for (let i = 0; i <= COLS; i++) {
    ctx.beginPath(); ctx.moveTo(rcx(i), 0); ctx.lineTo(rcx(i), H); ctx.stroke();
  }
  for (let j = 0; j <= ROWS; j++) {
    ctx.beginPath(); ctx.moveTo(0, rcy(j)); ctx.lineTo(W, rcy(j)); ctx.stroke();
  }
  ctx.setLineDash([]);
  // plaza fountain, park trees, beach palms, marina docks
  ctx.fillStyle = '#2a7ab8';
  ctx.beginPath(); ctx.arc(rcx(7), rcy(3), 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(rcx(7), rcy(3), 12 + Math.sin(G.elapsed * 3) * 3, 0, Math.PI * 2); ctx.fill();
  for (const b of CITY.blocks) {
    for (const t of b.trees) {
      if (!inView(t.x, t.y, cam, vw, vh, 40)) continue;
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#43a047';
      ctx.beginPath(); ctx.arc(t.x - 2, t.y - 2, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = '#8d6e63';
  for (let i = 0; i < 3; i++) ctx.fillRect(CITY.basin.x - 4, CITY.basin.y + 40 + i * 90, 60, 10);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.ellipse(CITY.basin.x + 90 + i * 90, CITY.basin.y + 60 + i * 80, 16, 7, 0.4, 0, Math.PI * 2); ctx.fill();
  }
}
function drawBuildings(ctx, cam, vw, vh, dark) {
  for (const b of CITY.blocks) {
    for (const bd of b.buildings) {
      if (!inView(bd.x + bd.w / 2, bd.y + bd.h / 2, cam, vw, vh, 60)) continue;
      // wall shadow to the south, height by hgt
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(bd.x + 4, bd.y + bd.h, bd.w, bd.hgt * 3);
      ctx.fillStyle = bd.c;
      rr(ctx, bd.x, bd.y, bd.w, bd.h, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      rr(ctx, bd.x + 4, bd.y + 4, bd.w - 8, bd.h - 8, 2);
      if (bd.shop) {
        ctx.fillStyle = '#111';
        ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(CITY.shops[bd.shop].short, bd.x + bd.w / 2, bd.y + bd.h / 2 + 4);
        ctx.textAlign = 'left';
      }
      if (dark > 0.3) {
        ctx.fillStyle = `rgba(255,214,90,${0.75 * dark})`;
        const n = Math.min(5, 2 + bd.hgt);
        for (let i = 0; i < n; i++) {
          const wx = bd.x + 8 + ((bd.x * 7 + i * 23) % Math.max(12, bd.w - 16));
          const wy = bd.y + 8 + ((bd.y * 5 + i * 17) % Math.max(12, bd.h - 16));
          ctx.fillRect(wx, wy, 5, 4);
        }
      }
    }
  }
  // traffic lights at intersections in view
  const ph = lightPhase(G.elapsed);
  for (const p of CITY.intersections) {
    if (!inView(p.x, p.y, cam, vw, vh, 30)) continue;
    ctx.fillStyle = '#222';
    ctx.fillRect(p.x - 24, p.y - 24, 4, 8);
    ctx.fillStyle = ph === 0 || ph === 1 ? '#2ecc71' : '#e74c3c';
    ctx.beginPath(); ctx.arc(p.x - 22, p.y - 26, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ph === 2 || ph === 3 ? '#2ecc71' : '#e74c3c';
    ctx.beginPath(); ctx.arc(p.x - 22, p.y - 18, 4, 0, Math.PI * 2); ctx.fill();
  }
  // stunt ramps
  for (const r of CITY.ramps) {
    if (!inView(r.x, r.y, cam, vw, vh, 40)) continue;
    ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.a);
    ctx.fillStyle = '#ff9500';
    ctx.beginPath(); ctx.moveTo(-18, 12); ctx.lineTo(18, 12); ctx.lineTo(18, -12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('JUMP', 0, 4); ctx.textAlign = 'left';
    ctx.restore();
  }
  // hidden packages
  for (const p of G.packages) {
    if (p.taken || !inView(p.x, p.y, cam, vw, vh, 30)) continue;
    const pulse = 1 + Math.sin(G.elapsed * 4 + p.id) * 0.25;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4); ctx.scale(pulse, pulse);
    ctx.fillStyle = '#58d68d'; ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = '#fff'; ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }
  // mission marker beacon
  const mk = missionMarker();
  if (mk) {
    const pr = 16 + Math.sin(G.elapsed * 5) * 5;
    ctx.strokeStyle = 'rgba(255,214,10,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(mk.x, mk.y, pr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath(); ctx.moveTo(mk.x, mk.y - 34); ctx.lineTo(mk.x + 9, mk.y - 20); ctx.lineTo(mk.x, mk.y - 8); ctx.lineTo(mk.x - 9, mk.y - 20); ctx.closePath(); ctx.fill();
  }
}
function drawCar(ctx, c, cam, vw, vh, dark) {
  if (!inView(c.x, c.y, cam, vw, vh, 60)) return;
  const air = c === G.car && G.airT > 0;
  ctx.save();
  if (air) { // shadow stays on the ground, body lifts
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(c.x, c.y + 6, 20, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(c.x, c.y - 16);
  } else ctx.translate(c.x, c.y);
  ctx.rotate(c.a);
  const w = c.w, h = c.h;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = c.color;
  rr(ctx, -w / 2, -h / 2, w, h, 5);
  ctx.fillStyle = 'rgba(20,30,40,0.85)';
  ctx.fillRect(-w / 6, -h / 2 + 3, w / 3, h - 6); // windshield + roof glass
  ctx.fillStyle = '#111';
  ctx.fillRect(-w / 2 + 2, -h / 2 - 2, 7, 4); ctx.fillRect(-w / 2 + 2, h / 2 - 2, 7, 4);
  ctx.fillRect(w / 2 - 9, -h / 2 - 2, 7, 4); ctx.fillRect(w / 2 - 9, h / 2 - 2, 7, 4);
  if (c.type === 2) { // taxi checker band
    ctx.fillStyle = '#111';
    for (let i = 0; i < 4; i++) ctx.fillRect(-w / 2 + 4 + i * 8, -2, 4, 4);
  }
  if (c.driver === 'police') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-w / 4, -h / 2 + 2, w / 2, h - 4);
    const flash = Math.floor(G.elapsed * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d55' : '#2d7dff';
    ctx.fillRect(-4, -h / 2 - 1, 8, 4);
  }
  if (c.hp < 40) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(w / 4, 0, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // headlights punch through the dark (drawn after the overlay instead)
}
function drawPerson(ctx, x, y, a, color, down, cam, vw, vh) {
  if (!inView(x, y, cam, vw, vh, 30)) return;
  ctx.save(); ctx.translate(x, y);
  if (down) { ctx.rotate(a); ctx.fillStyle = '#888'; ctx.fillRect(-9, -4, 18, 8); ctx.restore(); return; }
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(3, 0, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
export function drawWorld(ctx, vw, vh) {
  const cam = G.cam;
  const dl = daylight(G.time), dark = 1 - dl, gold = golden(G.time);
  ctx.save();
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  drawGround(ctx, cam, vw, vh);
  drawBuildings(ctx, cam, vw, vh, dark);
  // player marker: a pulsing ring, so the player is findable in any shot
  const pr = G.onFoot ? 13 : 24;
  ctx.strokeStyle = `rgba(255,255,255,${0.55 + Math.sin(G.elapsed * 4) * 0.25})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(G.x, G.y, pr + 4, (G.onFoot ? pr + 4 : pr * 0.62 + 4), 0, 0, Math.PI * 2);
  ctx.stroke();
  for (const c of G.cars) drawCar(ctx, c, cam, vw, vh, dark);
  for (const p of G.peds) drawPerson(ctx, p.x, p.y, p.a, p.color, p.dead > 0, cam, vw, vh);
  if (G.onFoot) {
    drawPerson(ctx, G.x, G.y, G.a, '#0e9aa7', false, cam, vw, vh);
    if (G.weapon === 1) {
      ctx.save(); ctx.translate(G.x, G.y); ctx.rotate(G.a);
      ctx.fillStyle = '#222'; ctx.fillRect(6, -1.5, 12, 3); ctx.restore();
    }
  }
  for (const c of G.cops) drawPerson(ctx, c.x, c.y, c.a, '#1f6feb', c.down > 0, cam, vw, vh);
  // helicopter: shadow on the ground, body above
  if (G.heli) {
    const hx = G.x + Math.cos(G.heli.a) * G.heli.r, hy = G.y + Math.sin(G.heli.a) * G.heli.r;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(hx + 30, hy + 40, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(G.heli.a + Math.PI / 2);
    ctx.fillStyle = '#1f6feb';
    rr(ctx, -16, -8, 32, 16, 6);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
    const ra = G.elapsed * 14;
    ctx.beginPath(); ctx.moveTo(Math.cos(ra) * -22, Math.sin(ra) * -22); ctx.lineTo(Math.cos(ra) * 22, Math.sin(ra) * 22); ctx.stroke();
    ctx.restore();
    if (dark > 0.3) { // searchlight cone to the player
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(G.x, G.y, 10, G.x, G.y, 120);
      g.addColorStop(0, 'rgba(255,240,160,0.35)'); g.addColorStop(1, 'rgba(255,240,160,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(G.x, G.y, 120, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  // particles
  for (const p of G.parts) {
    ctx.globalAlpha = Math.max(0, p.t / p.max) * (p.smoke ? 0.5 : 0.9);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.smoke ? (1.6 - p.t / p.max) : 1), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // floating texts
  ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
  for (const t of G.texts) {
    ctx.globalAlpha = Math.min(1, t.t);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
  ctx.restore();
  // night + golden-hour overlay (screen space)
  if (dark > 0.05) {
    ctx.fillStyle = `rgba(5,8,32,${(dark * 0.5).toFixed(3)})`;
    ctx.fillRect(0, 0, vw, vh);
  }
  if (gold > 0.05) {
    ctx.fillStyle = `rgba(255,110,30,${(gold * 0.13).toFixed(3)})`;
    ctx.fillRect(0, 0, vw, vh);
  }
  // headlight cones after the dark, so they punch through
  if (dark > 0.25) {
    ctx.save();
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
    ctx.globalCompositeOperation = 'lighter';
    for (const c of G.cars) {
      if (!inView(c.x, c.y, cam, vw, vh, 60) || Math.abs(c.sp) < 5) continue;
      const fx = c.x + Math.cos(c.a) * (c.w / 2), fy = c.y + Math.sin(c.a) * (c.h / 2);
      const g = ctx.createRadialGradient(fx, fy, 6, fx + Math.cos(c.a) * 120, fy + Math.sin(c.a) * 120, 130);
      g.addColorStop(0, 'rgba(255,240,170,0.30)'); g.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.arc(fx + Math.cos(c.a) * 120, fy + Math.sin(c.a) * 120, 70, c.a - 0.5, c.a + 0.5);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}
