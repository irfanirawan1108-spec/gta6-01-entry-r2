// The player: on foot (walk, run, punch, shoot) and driving (arcade
// handling, handbrake, ramps, crashes). Stealing a car in front of a
// witness draws police heat.
import { G, clamp, floatText, say } from './state.js';
import { CITY, collide, onRoad } from './city.js';
import { nearestCar, damageCar } from './vehicles.js';
import { hurtPed } from './pedestrians.js';
import { addHeat } from './police.js';
import { held, pressed, mouse } from './input.js';
import { spawn, smoke } from './particles.js';
import { interact } from './missions.js';
import { sfx } from './audio.js';

const FOOT = 150, RUN = 235;

function witnessNear(x, y) {
  for (const p of G.peds) if (!p.dead && Math.hypot(p.x - x, p.y - y) < 130) return true;
  for (const c of G.cops) if (Math.hypot(c.x - x, c.y - y) < 220) return true;
  return false;
}
function tryEnterCar() {
  const c = nearestCar(G.x, G.y, 36);
  if (!c || c.hp <= 0) return false;
  if (c.driver === 'traffic') {
    if (witnessNear(c.x, c.y)) { addHeat(18); say('Car stolen — witness called it in!'); }
    c.route = null;
  }
  c.driver = 'player';
  G.car = c; G.onFoot = false; G.speed = 0;
  return true;
}
function exitCar() {
  const c = G.car;
  c.driver = 'none'; c.sp = 0;
  G.car = null; G.onFoot = true;
  G.x = c.x - Math.sin(c.a) * 26; G.y = c.y + Math.cos(c.a) * 26;
  const p = collide(G.x, G.y, 8);
  G.x = p[0]; G.y = p[1];
  G.a = c.a;
}
function punch() {
  const fx = G.x + Math.cos(G.a) * 24, fy = G.y + Math.sin(G.a) * 24;
  let best = null, bd = 34;
  for (const p of G.peds) {
    if (p.dead) continue;
    const d = Math.hypot(p.x - fx, p.y - fy);
    if (d < bd) { bd = d; best = p; }
  }
  if (best) { hurtPed(best, 14, true); sfx('punch'); return; }
  const c = nearestCar(fx, fy, 30);
  if (c) { damageCar(c, 5, true); addHeat(4); spawn(c.x, c.y, 4, '#ffd60a', 50, 0.3, 2); sfx('punch'); }
}
function shoot() {
  if (!G.hasPistol || G.ammo <= 0 || G.weapon !== 1) return;
  G.ammo--;
  const wx = G.cam.x + mouse.x, wy = G.cam.y + mouse.y;
  const a = Math.atan2(wy - G.y, wx - G.x);
  G.a = a;
  spawn(G.x + Math.cos(a) * 20, G.y + Math.sin(a) * 20, 3, '#ffd60a', 80, 0.15, 2);
  // first ped or car within 14px of the shot line, up to 420px out
  let best = null, bd = 420, kind = '';
  for (const p of G.peds) {
    if (p.dead) continue;
    const dx = p.x - G.x, dy = p.y - G.y, along = dx * Math.cos(a) + dy * Math.sin(a);
    if (along < 0 || along > bd) continue;
    const side = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
    if (side < 16) { bd = along; best = p; kind = 'ped'; }
  }
  for (const c of G.cars) {
    if (c === G.car) continue;
    const dx = c.x - G.x, dy = c.y - G.y, along = dx * Math.cos(a) + dy * Math.sin(a);
    if (along < 0 || along > bd) continue;
    const side = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
    if (side < 18) { bd = along; best = c; kind = 'car'; }
  }
  if (best) {
    if (kind === 'ped') hurtPed(best, 34, true); else damageCar(best, 22, true);
    spawn(best.x, best.y, 6, '#c0392b', 70, 0.4, 3);
  }
  addHeat(8); sfx('shot');
}
function drive(dt) {
  const c = G.car;
  const wrecked = c.hp <= 0;
  if (wrecked && !c.wreckToast) { c.wreckToast = true; say('Your car is wrecked — press E to get out'); }
  const fwd = wrecked ? 0 : held('KeyW', 'ArrowUp') ? 1 : held('KeyS', 'ArrowDown') ? -1 : 0;
  const steer = (held('KeyA', 'ArrowLeft') ? -1 : 0) + (held('KeyD', 'ArrowRight') ? 1 : 0);
  const brake = held('Space');
  const offroad = !onRoad(c.x, c.y);
  const top = c.max * (offroad ? 0.55 : 1);
  if (fwd > 0) c.sp += c.acc * dt;
  else if (fwd < 0) c.sp -= (c.sp > 0 ? c.acc * 1.4 : c.acc * 0.7) * dt;
  else c.sp *= Math.pow(0.4, dt);
  if (brake) c.sp *= Math.pow(0.05, dt);
  c.sp = clamp(c.sp, -c.max * 0.35, top);
  const dir = c.sp >= 0 ? 1 : -1;
  c.a += steer * c.turn * dt * dir * clamp(Math.abs(c.sp) / 90, 0, 1);
  const nx = c.x + Math.cos(c.a) * c.sp * dt, ny = c.y + Math.sin(c.a) * c.sp * dt;
  const before = Math.abs(c.sp);
  const p = collide(nx, ny, 14);
  if ((p[0] !== nx || p[1] !== ny) && before > 280) {
    damageCar(c, (before - 280) / 22, false);
    G.health -= (before - 280) / 40;
    spawn(c.x, c.y, 10, '#ffd60a', 90, 0.5, 3);
    sfx('crash');
    c.sp *= 0.3;
  }
  c.x = p[0]; c.y = p[1];
  G.x = c.x; G.y = c.y; G.a = c.a; G.speed = c.sp;
  // stunt ramps: cross one fast and you fly
  if (G.airT <= 0) {
    for (const r of CITY.ramps) {
      if (Math.hypot(c.x - r.x, c.y - r.y) < 26 && Math.abs(c.sp) > 200) {
        G.airT = 0.55 + Math.abs(c.sp) / 900;
        G.jumpT = G.airT;
        sfx('jump');
        break;
      }
    }
  } else {
    G.airT -= dt;
    if (G.airT <= 0) {
      const bonus = 25 + Math.floor((G.jumpT || 0.6) * 40);
      G.cash += bonus; G.stats.jumps++; G.stats.earned += bonus;
      floatText(c.x, c.y - 20, 'STUNT +$' + bonus, '#ffd60a');
      sfx('pickup');
    }
  }
  if (c.hp < 40 && Math.random() < dt * 3) smoke(c.x, c.y);
}
function walk(dt) {
  let dx = 0, dy = 0;
  if (held('KeyW', 'ArrowUp')) dy -= 1;
  if (held('KeyS', 'ArrowDown')) dy += 1;
  if (held('KeyA', 'ArrowLeft')) dx -= 1;
  if (held('KeyD', 'ArrowRight')) dx += 1;
  const run = held('ShiftLeft', 'ShiftRight');
  const sp = run ? RUN : FOOT;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    G.a = Math.atan2(dy, dx);
    const p = collide(G.x + dx * sp * dt, G.y + dy * sp * dt, 8);
    G.x = p[0]; G.y = p[1];
    G.speed = sp;
  } else G.speed = 0;
  if (pressed('Space')) punch();
  if (mouse.clicked) shoot();
  if (pressed('Digit1')) G.weapon = 0;
  if (pressed('Digit2') && G.hasPistol) G.weapon = 1;
}
export function updatePlayer(dt) {
  if (pressed('KeyE')) {
    if (G.onFoot) {
      if (!tryEnterCar()) interact();
    } else exitCar();
  }
  if (G.onFoot) walk(dt);
  else drive(dt);
  // hidden packages
  for (const p of G.packages) {
    if (!p.taken && Math.hypot(p.x - G.x, p.y - G.y) < 24) {
      p.taken = true; G.cash += 25; G.stats.pkgs++; G.stats.earned += 25;
      floatText(p.x, p.y - 10, 'PACKAGE +$25', '#58d68d');
      say(`Hidden package ${G.stats.pkgs}/15 found (+$25)`);
      sfx('pickup');
    }
  }
  if (G.health <= 0) G.health = 0;
}
