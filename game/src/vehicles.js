// Cars: arcade driving physics, traffic AI that follows the road grid,
// parked cars to steal, and spawning around the camera.
// A car is {id,type,x,y,angle,speed,color,driver,hp,...}.
// driver: 'player' | 'traffic' | 'parked' | 'police' | 'mission'.

import { CARS, WORLD } from './config.js';
import { CITY_W, CITY_H, isOnRoad, nearestRoad, randomRoadPoint, lightState, hitsBuilding } from './city.js';
import { clamp, dist, turnToward, pick } from './random.js';
import { spawn, explosion, addSkid } from './particles.js';

let nextId = 1;

export function makeCar(type, x, y, angle, driver = 'traffic') {
  const spec = CARS[type];
  return {
    id: nextId++,
    type,
    label: spec.label,
    x, y,
    angle,
    speed: 0,
    color: pick(Math.random, spec.colors),
    driver,
    hp: 100,
    top: spec.top,
    accel: spec.accel,
    grip: spec.grip,
    value: spec.value,
    // Traffic AI state.
    lane: 0, // -1 left lane, +1 right lane (relative to heading)
    targetSpeed: spec.top * (0.55 + Math.random() * 0.25),
    wait: 0,
    stuck: 0,
    lastX: x, lastY: y,
    brakeLight: false,
    airTime: 0, // >0 while flying off a ramp
    airVy: 0,
    horned: 0,
  };
}

export function carSize(car) {
  // Length x width in pixels, by type.
  switch (car.type) {
    case 'truck': return { len: 74, wid: 30 };
    case 'van': return { len: 58, wid: 28 };
    case 'sports': return { len: 52, wid: 24 };
    case 'coupe': return { len: 50, wid: 24 };
    case 'police': return { len: 54, wid: 26 };
    default: return { len: 50, wid: 25 };
  }
}

export function spawnTraffic(G, n) {
  let made = 0;
  let guard = 0;
  while (made < n && guard++ < n * 12) {
    const p = randomRoadPoint(Math.random);
    const d = dist(p.x, p.y, G.camera.x, G.camera.y);
    if (d < 420 || d > 1500) continue;
    const types = ['sedan', 'sedan', 'taxi', 'van', 'coupe', 'truck', 'sports'];
    const type = types[Math.floor(Math.random() * types.length)];
    const angle = p.vertical ? (Math.PI / 2 + (Math.random() < 0.5 ? 0 : Math.PI)) : (Math.random() < 0.5 ? 0 : Math.PI);
    const car = makeCar(type, p.x, p.y, angle, 'traffic');
    car.speed = car.targetSpeed * 0.7;
    G.cars.push(car);
    made++;
  }
}

export function spawnParked(G, n) {
  let made = 0;
  let guard = 0;
  while (made < n && guard++ < n * 20) {
    const p = randomRoadPoint(Math.random);
    const d = dist(p.x, p.y, G.player.x, G.player.y);
    if (d < 260) continue;
    const types = ['sedan', 'coupe', 'van', 'sports', 'taxi'];
    const type = types[Math.floor(Math.random() * types.length)];
    const angle = p.vertical ? Math.PI / 2 : 0;
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = p.vertical ? p.x + side * 40 : p.x;
    const y = p.vertical ? p.y : p.y + side * 40;
    if (!isOnRoad(x, y)) continue;
    const car = makeCar(type, x, y, angle + (Math.random() < 0.5 ? 0 : Math.PI), 'parked');
    G.cars.push(car);
    made++;
  }
}

// --- Physics ---------------------------------------------------------------

function collideBuildings(G, car) {
  const { len, wid } = carSize(car);
  const r = Math.max(len, wid) / 2 - 4;
  const b = hitsBuilding(G.city, car.x, car.y, r);
  if (b) {
    // Push the car out along the smallest penetration axis.
    const cx = clamp(car.x, b.x, b.x + b.w);
    const cy = clamp(car.y, b.y, b.y + b.h);
    const dx = car.x - cx;
    const dy = car.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    car.x = cx + (dx / d) * r;
    car.y = cy + (dy / d) * r;
    if (Math.abs(car.speed) > 120) {
      G.audio.sfx('crash');
      car.hp -= 8;
      spawn(G.particles, 'spark', car.x, car.y, { n: 6, speed: 200, life: 0.4, size: 2, color: '#ffe95a' });
      spawn(G.particles, 'smoke', car.x, car.y, { n: 5, speed: 50, life: 1, size: 8, color: '#666' });
    }
    car.speed *= 0.35;
    return true;
  }
  return false;
}


function carCollide(G, car) {
  for (const other of G.cars) {
    if (other === car || other.airTime > 0) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    const min = 34;
    if (d < min && d > 0.01) {
      const push = (min - d) / 2;
      const nx = (car.x - other.x) / d;
      const ny = (car.y - other.y) / d;
      car.x += nx * push;
      car.y += ny * push;
      other.x -= nx * push;
      other.y -= ny * push;
      const rel = Math.abs(car.speed - other.speed);
      if (rel > 140) {
        car.hp -= 4;
        other.hp -= 4;
        if (car.driver === 'player' || other.driver === 'player') G.audio.sfx('crash');
        spawn(G.particles, 'spark', (car.x + other.x) / 2, (car.y + other.y) / 2, { n: 5, speed: 180, life: 0.35, size: 2, color: '#ffe95a' });
      }
      const avg = (car.speed + other.speed) / 2;
      car.speed = avg * 0.7;
      other.speed = avg * 0.7;
    }
  }
}

// --- Player driving ---------------------------------------------------------

export function drivePlayerCar(G, car, input, dt) {
  const ax = input.axis();
  const forward = ax.y !== 0 ? -ax.y : 0; // W/up = forward
  const steer = ax.x;
  const handbrake = input.isDown('attack');

  if (forward > 0) car.speed += car.accel * dt * (car.speed < 0 ? 1.6 : 1);
  else if (forward < 0) {
    if (car.speed > 30) car.speed -= car.accel * 1.4 * dt; // brake
    else car.speed -= car.accel * 0.6 * dt; // reverse
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  }
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 520 * dt);
    if (Math.abs(car.speed) > 150 && Math.random() < 0.5) {
      const bx = car.x - Math.cos(car.angle) * 20;
      const by = car.y - Math.sin(car.angle) * 20;
      spawn(G.particles, 'smoke', bx, by, { n: 1, speed: 20, life: 0.6, size: 5, color: '#999' });
    }
  }
  car.speed = clamp(car.speed, -car.top * 0.45, car.top);
  const steerRate = car.grip * clamp(Math.abs(car.speed) / 160, 0.25, 1);
  car.angle += steer * steerRate * dt * Math.sign(car.speed || 1);

  // Ramp jumps.
  if (car.airTime <= 0) {
    for (const ramp of G.city.ramps) {
      if (dist(car.x, car.y, ramp.x, ramp.y) < 34 && Math.abs(car.speed) > 260) {
        car.airTime = 0.55;
        car.airVy = 260;
        G.audio.sfx('jump');
        G.flags.stunts = (G.flags.stunts || 0) + 1;
        break;
      }
    }
  }
  if (car.airTime > 0) {
    car.airTime -= dt;
    car.airVy -= 900 * dt;
  }

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(nx, 20, 5600);
  car.y = clamp(ny, 20, 3600);

  // Skid marks when turning hard at speed.
  if (Math.abs(steer) > 0.6 && Math.abs(car.speed) > 260 && car.airTime <= 0) {
    const bx = car.x - Math.cos(car.angle) * 18;
    const by = car.y - Math.sin(car.angle) * 18;
    const px = bx + Math.cos(car.angle + Math.PI / 2) * 10;
    const py = by + Math.sin(car.angle + Math.PI / 2) * 10;
    if (car._lastSkid) addSkid(G.particles, car._lastSkid.x, car._lastSkid.y, px, py);
    car._lastSkid = { x: px, y: py };
  } else {
    car._lastSkid = null;
  }

  collideBuildings(G, car);
  carCollide(G, car);

  // The player rides in the car: keep them (and the camera) on it.
  const p = G.player;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;

  // Water = splash and damage.
  if (car.x > 5150 || car.y > 3560) {
    car.hp -= 30 * dt;
    spawn(G.particles, 'smoke', car.x, car.y, { n: 2, speed: 40, life: 0.8, size: 6, color: '#bfeef2' });
  }

  // Smoke when wrecked.
  if (car.hp < 35 && Math.random() < dt * 8) {
    spawn(G.particles, 'smoke', car.x, car.y, { n: 1, speed: 30, life: 1.2, size: 9, color: '#444' });
  }
  if (car.hp <= 0) {
    // The player's ride blows up under them: eject and hurt them.
    explosion(G.particles, car.x, car.y);
    G.audio.sfx('crash');
    car.hp = 100;
    car.speed = 0;
    car.driver = 'parked';
    const p = G.player;
    p.car = null;
    p.x = car.x + 40;
    p.y = car.y + 40;
    p.health -= 45;
    if (p.health <= 0) {
      p.health = 0;
      G.mode = 'wasted';
      G.modeTimer = 0;
      G.audio.sfx('fail');
    }
  }
}

export function explodeCar(G, car) {
  explosion(G.particles, car.x, car.y);
  G.audio.sfx('crash');
  car.hp = 100;
  car.speed = 0;
  car.driver = 'traffic';
  // Respawn the wreck as a fresh parked car elsewhere.
  const p = randomRoadPoint(Math.random);
  car.x = p.x;
  car.y = p.y;
  car.angle = p.vertical ? Math.PI / 2 : 0;
}

// --- Traffic AI --------------------------------------------------------------

function nearestLight(G, car) {
  let best = null;
  let bestD = 1e9;
  for (const l of G.city.lights) {
    const d = dist(car.x, car.y, l.x, l.y);
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return bestD < 260 ? { light: best, d: bestD } : null;
}

function carAhead(G, car) {
  let bestD = 120;
  let found = null;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > 0 && along < bestD && side < 26) {
      bestD = along;
      found = other;
    }
  }
  return found;
}

export function updateTrafficCar(G, car, dt) {
  if (car.driver === 'parked') return;
  // Keep on the road: if pushed off, steer back to the nearest road.
  const road = nearestRoad(car.x, car.y);
  const onRoad = isOnRoad(car.x, car.y);
  let desired = car.angle;
  if (!onRoad) {
    desired = Math.atan2(road.y - car.y, road.x - car.x);
    car.targetSpeed = car.top * 0.5;
  } else {
    // At an intersection, sometimes turn.
    const px = car.x % (WORLD.block + WORLD.road);
    const py = car.y % (WORLD.block + WORLD.road);
    const nearCenter = Math.abs(px - WORLD.road / 2) < 14 && Math.abs(py - WORLD.road / 2) < 14;
    if (nearCenter && Math.random() < dt * 0.5) {
      const turn = [-Math.PI / 2, 0, Math.PI / 2][Math.floor(Math.random() * 3)];
      car._turnTarget = car.angle + turn;
    }
    if (car._turnTarget !== undefined) {
      desired = car._turnTarget;
      if (Math.abs(((car.angle - desired + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.15) {
        car.angle = desired;
        car._turnTarget = undefined;
      }
    }
  }

  // Traffic lights: stop at red when approaching.
  let wantSpeed = car.targetSpeed;
  const near = nearestLight(G, car);
  if (near && near.d < 130) {
    const vertical = Math.abs(Math.sin(car.angle)) > 0.7;
    const state = lightState(near.light, G.timeSec, vertical);
    const approaching = ((car.x - near.light.x) * Math.cos(car.angle) + (car.y - near.light.y) * Math.sin(car.angle)) > 0;
    if (state === 'red' && approaching) wantSpeed = 0;
  }
  // Slow for the car ahead.
  const ahead = carAhead(G, car);
  if (ahead) wantSpeed = Math.min(wantSpeed, Math.max(0, ahead.speed * 0.85));

  if (car.speed < wantSpeed) car.speed += car.accel * 0.7 * dt;
  else if (car.speed > wantSpeed) car.speed -= car.accel * 1.2 * dt;
  car.speed = clamp(car.speed, 0, car.top);
  car.brakeLight = wantSpeed < car.speed - 20;

  car.angle = turnToward(car.angle, desired, car.grip * 0.9 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 10, CITY_W + 100);
  car.y = clamp(car.y, 10, CITY_H + 100);

  // Stuck detection: if barely moving for a while, nudge a turn.
  const moved = dist(car.x, car.y, car.lastX, car.lastY);
  if (moved < 2 && car.speed > 20) car.stuck += dt;
  else car.stuck = 0;
  car.lastX = car.x;
  car.lastY = car.y;
  if (car.stuck > 3) {
    car._turnTarget = car.angle + Math.PI / 2;
    car.stuck = 0;
  }

  collideBuildings(G, car);
  carCollide(G, car);
  if (car.hp <= 0) explodeCar(G, car);
}

// --- Maintenance: keep the streets alive around the camera ------------------

export function maintainTraffic(G, dt) {
  void dt;
  // Despawn far traffic, respawn near the camera.
  let traffic = 0;
  for (let i = G.cars.length - 1; i >= 0; i--) {
    const c = G.cars[i];
    if (c.driver === 'traffic') {
      traffic++;
      if (dist(c.x, c.y, G.camera.x, G.camera.y) > 1700) {
        G.cars.splice(i, 1);
        traffic--;
      }
    }
  }
  if (traffic < 14) spawnTraffic(G, 14 - traffic);
  let parked = 0;
  for (const c of G.cars) if (c.driver === 'parked') parked++;
  if (parked < 10) spawnParked(G, 10 - parked);
}
