// The wanted system: foot cops, police cruisers, roadblocks and the
// helicopter. Heat (0..100) rises with crimes and falls when no cop can
// see the player; stars are the visible level. Get caught on foot and
// you are BUSTED; die and you are WASTED.

import { WANTED } from './config.js';
import { CITY_W, CITY_H, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { clamp, dist, angleTo, turnToward, pick } from './random.js';
import { spawn } from './particles.js';
import { makeCar, carSize } from './vehicles.js';
import { hurtPlayer } from './player.js';

export function makeCop(x, y, onFoot) {
  return {
    x, y,
    angle: 0,
    speed: 0,
    onFoot,
    car: null,
    hp: 50,
    down: false,
    downTimer: 0,
    shootTimer: 0,
    color: '#1d3a5f',
  };
}

export function spawnCopCar(G) {
  const p = randomRoadPoint(Math.random);
  const car = makeCar('police', p.x, p.y, Math.random() * Math.PI * 2, 'police');
  car.speed = car.top * 0.6;
  const cop = makeCop(p.x, p.y, false);
  cop.car = car;
  G.cars.push(car);
  G.cops.push(cop);
  return cop;
}

export function spawnFootCop(G) {
  const p = randomSidewalkPoint(Math.random);
  const cop = makeCop(p.x, p.y, true);
  cop.speed = 0;
  G.cops.push(cop);
  return cop;
}

// How many cops does the current wanted level demand?
export function desiredCops(G) {
  const spec = WANTED[G.wanted] || WANTED[0];
  return spec;
}

export function updatePolice(G, dt) {
  const p = G.player;
  const spec = desiredCops(G);

  // Heat: rises with crimes (set elsewhere), falls when unseen.
  const anyCopSees = G.cops.some((c) => !c.down && dist(c.x, c.y, p.x, p.y) < WANTED.sightRange);
  if (G.wanted > 0 && !anyCopSees) {
    G.heat -= WANTED.decayPerSecond * dt;
    if (G.heat <= 0) {
      G.heat = 0;
      G.wanted = Math.max(0, G.wanted - 1);
      if (G.wanted > 0) G.heat = 60;
      G.ui.message(G.wanted === 0 ? 'You lost the heat.' : `Wanted level down to ${G.wanted} star${G.wanted > 1 ? 's' : ''}.`, '#7ddc8a', 2);
    }
  }

  // Spawn / despawn cops to match the wanted level.
  const footCops = G.cops.filter((c) => c.onFoot && !c.down).length;
  const carCops = G.cops.filter((c) => !c.onFoot && !c.down).length;
  if (G.wanted > 0) {
    if (footCops < spec.foot && Math.random() < dt * 1.2) spawnFootCop(G);
    if (carCops < spec.cars && Math.random() < dt * 0.8) spawnCopCar(G);
  }
  // Despawn far cops when the heat is gone.
  for (let i = G.cops.length - 1; i >= 0; i--) {
    const c = G.cops[i];
    if (c.down) {
      c.downTimer -= dt;
      if (c.downTimer <= 0) {
        G.cops.splice(i, 1);
        if (c.car) {
          const idx = G.cars.indexOf(c.car);
          if (idx >= 0) G.cars.splice(idx, 1);
        }
      }
      continue;
    }
    if (G.wanted === 0 && dist(c.x, c.y, p.x, p.y) > 900) {
      if (c.car) {
        const idx = G.cars.indexOf(c.car);
        if (idx >= 0) G.cars.splice(idx, 1);
      }
      G.cops.splice(i, 1);
    }
  }

  // Helicopter follows at 4+ stars.
  G.heli.active = G.wanted >= 4;
  if (G.heli.active) {
    const hx = p.x + 120;
    const hy = p.y - 160;
    G.heli.x += (hx - G.heli.x) * Math.min(1, dt * 1.2);
    G.heli.y += (hy - G.heli.y) * Math.min(1, dt * 1.2);
    G.heli.angle += dt * 2;
    G.heli.spotX = p.x;
    G.heli.spotY = p.y;
    // The spotlight pins the player: heat does not fall under it.
    G.heat = Math.max(G.heat, 40);
  }

  // Each cop acts.
  for (const cop of G.cops) {
    if (cop.down) continue;
    cop.shootTimer = Math.max(0, cop.shootTimer - dt);
    if (cop.onFoot) updateFootCop(G, cop, dt);
    else updateCopCar(G, cop, dt);
  }

  // Busted: a cop reaches the player on foot while the player is on foot.
  if (!p.car && G.wanted > 0 && G.mode === 'play') {
    for (const cop of G.cops) {
      if (cop.onFoot && !cop.down && dist(cop.x, cop.y, p.x, p.y) < WANTED.bustedRange) {
        G.mode = 'busted';
        G.modeTimer = 0;
        G.audio.sfx('busted');
        break;
      }
    }
  }

  // Siren audio follows the nearest chase.
  const chase = G.cops.some((c) => !c.down && dist(c.x, c.y, p.x, p.y) < 900);
  G.audio.setSiren(chase && G.wanted > 0);
}

function updateFootCop(G, cop, dt) {
  const p = G.player;
  const d = dist(cop.x, cop.y, p.x, p.y);
  if (G.wanted === 0) {
    // Off duty: stroll.
    cop.angle += dt * 0.4;
    cop.x += Math.cos(cop.angle) * 30 * dt;
    cop.y += Math.sin(cop.angle) * 30 * dt;
    return;
  }
  // Chase the player.
  const target = angleTo(cop.x, cop.y, p.x, p.y);
  cop.angle = turnToward(cop.angle, target, 7 * dt);
  const speed = 175;
  cop.x += Math.cos(cop.angle) * speed * dt;
  cop.y += Math.sin(cop.angle) * speed * dt;
  // Shoot at range when the player is on foot and far enough to not bust.
  if (!p.car && d > 120 && d < 420 && cop.shootTimer <= 0) {
    cop.shootTimer = 1.1 + Math.random() * 0.5;
    G.audio.sfx('gun');
    if (Math.random() < 0.45) {
      hurtPlayer(G, 9, cop.x, cop.y);
      spawn(G.particles, 'spark', p.x, p.y, { n: 3, speed: 100, life: 0.25, size: 2, color: '#ffe95a' });
    }
    G.tracer = { x1: cop.x, y1: cop.y, x2: p.x, y2: p.y, life: 0.09 };
  }
  // Melee the player up close.
  if (d < 40 && cop.shootTimer <= 0) {
    cop.shootTimer = 0.8;
    hurtPlayer(G, 8, cop.x, cop.y);
  }
}

function updateCopCar(G, cop, dt) {
  const car = cop.car;
  if (!car) return;
  const p = G.player;
  // The cruiser rams the player's car, or chases the player on foot.
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const d = dist(car.x, car.y, tx, ty);
  const target = angleTo(car.x, car.y, tx, ty);
  // Ram speed: faster when far, ease off when close to avoid orbiting.
  const wantSpeed = d > 260 ? car.top : car.top * 0.72;
  car.angle = turnToward(car.angle, target, car.grip * 1.1 * dt);
  if (car.speed < wantSpeed) car.speed += car.accel * dt;
  else car.speed -= car.accel * 0.8 * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 10, CITY_W + 100);
  car.y = clamp(car.y, 10, CITY_H + 100);
  cop.x = car.x;
  cop.y = car.y;
  cop.angle = car.angle;
  // Ram damage to the player's car.
  if (p.car && d < 44) {
    p.car.hp -= 14 * dt;
    p.car.speed *= 0.985;
    if (Math.random() < dt * 6) {
      G.audio.sfx('crash');
      spawn(G.particles, 'spark', (car.x + p.car.x) / 2, (car.y + p.car.y) / 2, { n: 4, speed: 150, life: 0.3, size: 2, color: '#ffe95a' });
    }
  }
  // Cop cars also collide with buildings and traffic like any car.
  const { len, wid } = carSize(car);
  const r = Math.max(len, wid) / 2 - 4;
  const b = G.city && (function () {
    for (const bb of G.city.buildings) {
      if (car.x > bb.x - r && car.x < bb.x + bb.w + r && car.y > bb.y - r && car.y < bb.y + bb.h + r) return bb;
    }
    return null;
  })();
  if (b) {
    const cx = clamp(car.x, b.x, b.x + b.w);
    const cy = clamp(car.y, b.y, b.y + b.h);
    const dx = car.x - cx;
    const dy = car.y - cy;
    const dd = Math.hypot(dx, dy) || 1;
    car.x = cx + (dx / dd) * r;
    car.y = cy + (dy / dd) * r;
    car.speed *= 0.4;
  }
  if (car.hp <= 0) {
    cop.down = true;
    cop.downTimer = 5;
    car.driver = 'parked';
  }
}

// Roadblocks: two cruisers parked across a road ahead of the player.
export function maybeRoadblock(G, dt) {
  if (G.wanted < 3) return;
  G.roadblockTimer = (G.roadblockTimer || 0) - dt;
  if (G.roadblockTimer > 0) return;
  G.roadblockTimer = 26;
  const p = G.player;
  if (!p.car) return;
  const ahead = 420;
  const bx = p.car.x + Math.cos(p.car.angle) * ahead;
  const by = p.car.y + Math.sin(p.car.angle) * ahead;
  if (bx < 40 || by < 40 || bx > CITY_W || by > CITY_H) return;
  for (const side of [-1, 1]) {
    const car = makeCar('police', bx + Math.cos(p.car.angle + Math.PI / 2) * side * 26, by + Math.sin(p.car.angle + Math.PI / 2) * side * 26, p.car.angle + Math.PI / 2, 'police');
    car.speed = 0;
    G.cars.push(car);
    const cop = makeCop(car.x, car.y, false);
    cop.car = car;
    G.cops.push(cop);
  }
  G.ui.message('Roadblock ahead!', '#ff5a5a', 2.5);
}
