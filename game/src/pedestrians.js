// Pedestrians: they stroll the sidewalks, cross at corners, flee from
// gunfire and speeding cars, and sometimes hail a taxi. Each ped is
// {x,y,angle,speed,color,state,shirt,pants,walkPhase}.

import { CITY_W, CITY_H, hitsBuilding, inPark, randomSidewalkPoint } from './city.js';
import { clamp, dist, angleTo, turnToward, pick } from './random.js';
import { spawn } from './particles.js';

const SHIRTS = ['#d45a5a', '#5a8ad4', '#5ad48a', '#e8c95a', '#9a5ad4', '#e8e8e8', '#2a2a2a', '#d48a5a', '#5ad4c9', '#e85aa0'];
const PANTS = ['#2a3a5a', '#3a3a3a', '#5a4a3a', '#6b7a8a', '#8a8a8a'];
const SKINS = ['#e8b88a', '#c98a5a', '#8a5a3a', '#f0c8a0', '#a06a42'];

export function makePed(x, y) {
  return {
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 40 + Math.random() * 35,
    shirt: pick(Math.random, SHIRTS),
    pants: pick(Math.random, PANTS),
    skin: pick(Math.random, SKINS),
    hair: pick(Math.random, ['#1a1a1a', '#4a2a1a', '#8a8a8a', '#d4a02a', '#6b3a1a']),
    state: 'walk', // walk | flee | down | taxi
    tx: x, ty: y, // walk target
    wait: 0,
    walkPhase: Math.random() * Math.PI * 2,
    scared: 0,
  };
}

export function spawnPeds(G, n) {
  let made = 0;
  let guard = 0;
  while (made < n && guard++ < n * 10) {
    const p = randomSidewalkPoint(Math.random);
    if (dist(p.x, p.y, G.player.x, G.player.y) < 300) continue;
    if (hitsBuilding(G.city, p.x, p.y, 4)) continue;
    const ped = makePed(p.x, p.y);
    pickNewTarget(G, ped);
    G.peds.push(ped);
    made++;
  }
}

function pickNewTarget(G, ped) {
  // Walk to a nearby sidewalk point, or into the park / beach.
  const roll = Math.random();
  if (roll < 0.18) {
    ped.tx = G.city.park.x + Math.random() * G.city.park.w;
    ped.ty = G.city.park.y + Math.random() * G.city.park.h;
  } else if (roll < 0.3) {
    ped.tx = 4350 + Math.random() * 130;
    ped.ty = Math.random() * CITY_H;
  } else {
    const p = randomSidewalkPoint(Math.random);
    ped.tx = p.x;
    ped.ty = p.y;
  }
}

export function scarePeds(G, x, y, radius) {
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const d = dist(ped.x, ped.y, x, y);
    if (d < radius) {
      ped.state = 'flee';
      ped.scared = 2.5 + Math.random();
      const away = angleTo(x, y, ped.x, ped.y);
      ped.tx = ped.x + Math.cos(away) * 260;
      ped.ty = ped.y + Math.sin(away) * 260;
      ped.tx = clamp(ped.tx, 20, CITY_W + 100);
      ped.ty = clamp(ped.ty, 20, CITY_H);
    }
  }
}

export function updatePeds(G, dt) {
  const px = G.player.x;
  const py = G.player.y;
  const playerCar = G.player.car;
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    // Flee from a speeding player car or gunfire.
    if (playerCar && playerCar.speed > 200) {
      const d = dist(ped.x, ped.y, playerCar.x, playerCar.y);
      if (d < 130) {
        ped.state = 'flee';
        ped.scared = 1.5;
        const away = angleTo(playerCar.x, playerCar.y, ped.x, ped.y);
        ped.tx = ped.x + Math.cos(away) * 220;
        ped.ty = ped.y + Math.sin(away) * 220;
      }
    }
    if (ped.state === 'flee') {
      ped.scared -= dt;
      if (ped.scared <= 0) ped.state = 'walk';
    }
    const speed = ped.state === 'flee' ? 240 : ped.speed;
    const d = dist(ped.x, ped.y, ped.tx, ped.ty);
    if (d < 18) {
      if (ped.state === 'walk') {
        ped.wait -= dt;
        if (ped.wait <= 0) {
          pickNewTarget(G, ped);
          ped.wait = 1 + Math.random() * 4;
        }
      } else {
        pickNewTarget(G, ped);
        ped.state = 'walk';
      }
      continue;
    }
    const targetAngle = angleTo(ped.x, ped.y, ped.tx, ped.ty);
    ped.angle = turnToward(ped.angle, targetAngle, 6 * dt);
    let nx = ped.x + Math.cos(ped.angle) * speed * dt;
    let ny = ped.y + Math.sin(ped.angle) * speed * dt;
    // Don't walk through buildings: slide along them.
    if (hitsBuilding(G.city, nx, ny, 6)) {
      if (!hitsBuilding(G.city, nx, ped.y, 6)) ny = ped.y;
      else if (!hitsBuilding(G.city, ped.x, ny, 6)) nx = ped.x;
      else {
        pickNewTarget(G, ped);
        continue;
      }
    }
    // Don't walk into the ocean.
    if (nx > 4480) nx = ped.x;
    if (ny > CITY_H + 160) ny = ped.y;
    ped.x = nx;
    ped.y = ny;
    ped.walkPhase += dt * (speed / 14);
    // Bump into the player on foot: shove them aside.
    const pd = dist(ped.x, ped.y, px, py);
    if (pd < 22 && !playerCar) {
      const a = angleTo(px, py, ped.x, ped.y);
      ped.x = px + Math.cos(a) * 22;
      ped.y = py + Math.sin(a) * 22;
    }
  }

  // Car vs ped collisions (traffic and player): peds get knocked down.
  for (const car of G.cars) {
    if (Math.abs(car.speed) < 60) continue;
    for (const ped of G.peds) {
      if (ped.state === 'down') continue;
      if (dist(car.x, car.y, ped.x, ped.y) < 26) {
        ped.state = 'down';
        spawn(G.particles, 'spark', ped.x, ped.y, { n: 8, speed: 160, life: 0.5, size: 3, color: '#ffffff' });
        if (car.driver === 'player') {
          G.wanted = Math.min(5, G.wanted + 1);
          G.heat = Math.min(100, G.heat + 35);
          G.audio.sfx('crash');
          scarePeds(G, ped.x, ped.y, 320);
          G.ui.message('Pedestrian down! Wanted level up.', '#ff5a5a', 2);
        }
      }
    }
  }
}

export function maintainPeds(G) {
  let near = 0;
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const ped = G.peds[i];
    if (dist(ped.x, ped.y, G.camera.x, G.camera.y) > 1600) {
      G.peds.splice(i, 1);
    } else {
      near++;
    }
  }
  if (near < 22) spawnPeds(G, 22 - near);
}
