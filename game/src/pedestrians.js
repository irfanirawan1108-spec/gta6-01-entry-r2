// Pedestrians: walk the sidewalks, flee from gunfire and speeding cars,
// and can be punched or shot (which draws police heat).
import { G, floatText } from './state.js';
import { CITY, collide } from './city.js';
import { mulberry32, rand, randi, choice } from './random.js';
import { spawn } from './particles.js';
import { addHeat } from './police.js';

const R = mulberry32(4242);
const SHIRTS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#fd79a8', '#e17055'];

function walkTarget() {
  const p = choice(R, CITY.intersections);
  const horiz = R() < 0.5;
  return {
    x: horiz ? p.x + rand(R, -120, 120) : p.x + (R() < 0.5 ? -30 : 30),
    y: horiz ? p.y + (R() < 0.5 ? -30 : 30) : p.y + rand(R, -120, 120),
  };
}
export function spawnPeds(n) {
  for (let k = 0; k < n; k++) {
    const t = walkTarget();
    G.peds.push({
      x: t.x, y: t.y, a: rand(R, 0, Math.PI * 2), sp: rand(R, 28, 48),
      tx: t.x, ty: t.y, flee: 0, hp: 30, dead: 0, color: choice(R, SHIRTS),
      bob: rand(R, 0, 6),
    });
  }
}
export function hurtPed(p, dmg, byPlayer) {
  p.hp -= dmg;
  spawn(p.x, p.y, 6, '#c0392b', 60, 0.5, 3);
  if (p.hp <= 0 && !p.dead) {
    p.dead = 8; // lies on the ground for 8s, then despawns
    if (byPlayer) { addHeat(25); G.stats.kills++; floatText(p.x, p.y, 'WASTED', '#ff5b5b'); }
  } else if (byPlayer) {
    addHeat(8);
    p.flee = 3;
  }
  // nearby pedestrians run
  for (const o of G.peds) if (o !== p && Math.hypot(o.x - p.x, o.y - p.y) < 160) o.flee = 3;
}
export function updatePeds(dt) {
  const px = G.x, py = G.y;
  const playerCar = G.car;
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const p = G.peds[i];
    if (p.dead > 0) { p.dead -= dt; if (p.dead <= 0) G.peds.splice(i, 1); continue; }
    if (p.flee > 0) p.flee -= dt;
    // flee from the player when they are loud, fast or violent
    const dPlayer = Math.hypot(p.x - px, p.y - py);
    const danger = (playerCar && Math.abs(playerCar.sp) > 160 && dPlayer < 90)
      || (!playerCar && G.weapon === 1 && dPlayer < 120)
      || p.flee > 0;
    let tx = p.tx, ty = p.ty, sp = p.sp;
    if (danger) {
      const a = Math.atan2(p.y - py, p.x - px);
      tx = p.x + Math.cos(a) * 120; ty = p.y + Math.sin(a) * 120;
      sp = 95;
    } else if (Math.hypot(p.tx - p.x, p.ty - p.y) < 10) {
      const t = walkTarget(); p.tx = t.x; p.ty = t.y;
    }
    const a = Math.atan2(ty - p.y, tx - p.x);
    let da = ((a - p.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    p.a += Math.max(-4 * dt, Math.min(4 * dt, da));
    p.x += Math.cos(p.a) * sp * dt;
    p.y += Math.sin(p.a) * sp * dt;
    p.bob += dt * 8;
    const c = collide(p.x, p.y, 7);
    p.x = c[0]; p.y = c[1];
  }
}
