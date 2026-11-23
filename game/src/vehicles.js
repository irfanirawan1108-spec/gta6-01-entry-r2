// Vehicles: six car types, traffic that follows the road grid and stops
// at red lights, parked cars to steal, and car-vs-car crashes.
import { G } from './state.js';
import { CARS, rcx, rcy, COLS, ROWS } from './config.js';
import { CITY, lightAllowsNS, lightAllowsEW, collide, onRoad } from './city.js';
import { mulberry32, rand, randi, choice } from './random.js';
import { spawn } from './particles.js';

const R = mulberry32(777);
let carSeq = 0;

export function makeCar(type, x, y, a, driver) {
  const t = CARS[type];
  return {
    id: ++carSeq, type, name: t.name, x, y, a, sp: 0, w: t.w, h: t.h,
    acc: t.acc, max: t.max, turn: t.turn,
    color: type === 2 ? '#f1c40f' : choice(R, t.colors),
    hp: 100, driver, route: null, ri: 0, wait: 0, smoke: 0, target: null,
  };
}
function randomRoute(from) {
  // Walk the intersection grid: current intersection -> random neighbour, 6 steps.
  let i = Math.round((from.x - 23) / 216), j = Math.round((from.y - 23) / 216);
  i = Math.max(0, Math.min(COLS, i)); j = Math.max(0, Math.min(ROWS, j));
  const pts = [{ x: rcx(i), y: rcy(j) }];
  for (let s = 0; s < 6; s++) {
    const opts = [];
    if (i > 0) opts.push([i - 1, j]);
    if (i < COLS) opts.push([i + 1, j]);
    if (j > 0) opts.push([i, j - 1]);
    if (j < ROWS) opts.push([i, j + 1]);
    const [ni, nj] = choice(R, opts);
    i = ni; j = nj;
    pts.push({ x: rcx(i), y: rcy(j) });
  }
  return pts;
}
export function spawnTraffic(n) {
  for (let k = 0; k < n; k++) {
    const p = choice(R, CITY.intersections);
    const type = randi(R, 0, 5);
    const c = makeCar(type, p.x + rand(R, -14, 14), p.y + rand(R, -14, 14), rand(R, 0, Math.PI * 2), 'traffic');
    c.route = randomRoute(p); c.ri = 1;
    G.cars.push(c);
  }
}
export function spawnParked(n) {
  for (let k = 0; k < n; k++) {
    const p = choice(R, CITY.intersections);
    const horiz = R() < 0.5;
    const type = randi(R, 0, 5);
    const x = horiz ? p.x + rand(R, -120, 120) : p.x + (R() < 0.5 ? -19 : 19);
    const y = horiz ? p.y + (R() < 0.5 ? -19 : 19) : p.y + rand(R, -120, 120);
    if (!onRoad(x, y)) continue;
    G.cars.push(makeCar(type, x, y, horiz ? 0 : Math.PI / 2, 'none'));
  }
}
export function nearestCar(x, y, maxD) {
  let best = null, bd = maxD;
  for (const c of G.cars) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
// One traffic car follows its route along road centrelines, on the
// right-hand lane, stopping at red lights and behind the car ahead.
function driveTraffic(c, dt, now) {
  if (c.hp <= 0) { c.sp = 0; return; } // a wreck stays a wreck
  if (!c.route || c.ri >= c.route.length) { c.route = randomRoute(c); c.ri = 1; }
  const tgt = c.route[c.ri];
  const dx = tgt.x - c.x, dy = tgt.y - c.y, d = Math.hypot(dx, dy);
  if (d < 14) { c.ri++; return; }
  // lane offset: right-hand side of the direction of travel
  const ux = dx / d, uy = dy / d;
  const lx = c.x + -uy * 11, ly = c.y + ux * 11;
  const tx = tgt.x + -uy * 11, ty = tgt.y + uy * 11;
  const want = Math.atan2(ty - ly, tx - lx);
  // red light: stop before the intersection when the light is against us
  const ns = Math.abs(uy) > 0.5;
  const lightOk = ns ? lightAllowsNS(now) : lightAllowsEW(now);
  const nearJunction = d < 60;
  let targetSpeed = c.max * 0.55;
  if (nearJunction && !lightOk) targetSpeed = 0;
  // car ahead in our lane: slow down
  for (const o of G.cars) {
    if (o === c) continue;
    const ox = o.x - c.x, oy = o.y - c.y;
    const along = ox * ux + oy * uy, side = Math.abs(ox * -uy + oy * ux);
    if (along > 0 && along < 46 && side < 16) { targetSpeed = Math.min(targetSpeed, Math.max(0, (along - 26) * 4)); }
  }
  const diff = ((want - c.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  c.a += Math.max(-c.turn * dt, Math.min(c.turn * dt, diff));
  c.sp += (targetSpeed - c.sp) * Math.min(1, 2.2 * dt);
  if (Math.abs(c.sp) < 1) c.sp = 0;
  c.x += Math.cos(c.a) * c.sp * dt;
  c.y += Math.sin(c.a) * c.sp * dt;
  const p = collide(c.x, c.y, 14);
  c.x = p[0]; c.y = p[1];
}
export function damageCar(c, dmg, byPlayer) {
  c.hp -= dmg;
  if (c.hp <= 0) {
    c.hp = 0; c.sp = 0;
    spawn(c.x, c.y, 14, '#ff9500', 90, 0.7, 4);
    if (byPlayer && c.driver === 'traffic') { /* a wrecked traffic car draws heat */ }
  } else if (c.hp < 40 && Math.random() < 0.3) {
    smokeFn(c.x, c.y);
  }
}
import { smoke as smokeFn } from './particles.js';

export function updateVehicles(dt, now) {
  for (const c of G.cars) {
    if (c.driver === 'traffic' || c.driver === 'target') driveTraffic(c, dt, now);
    if (c.hp < 40 && c.hp > 0 && Math.random() < dt * 2) smokeFn(c.x, c.y);
  }
  // car-vs-car bumps: push apart, spark on hard hits
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      const a = G.cars[i], b = G.cars[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = 20;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2, nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        const rel = Math.abs(a.sp - b.sp);
        if (rel > 120) {
          damageCar(a, 4, false); damageCar(b, 4, false);
          spawn((a.x + b.x) / 2, (a.y + b.y) / 2, 6, '#ffd60a', 70, 0.4, 3);
        }
      }
    }
  }
}
