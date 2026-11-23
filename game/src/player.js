// The player on foot: walking, running, punching, shooting, stealing
// cars, and interacting with shops and pickups. Driving lives in
// vehicles.js; the player object is the shared state both use.

import { PLAYER, ECONOMY } from './config.js';
import { CITY_W, CITY_H, hitsBuilding, isWater } from './city.js';
import { clamp, dist, angleTo, turnToward } from './random.js';
import { spawn, addFloat } from './particles.js';
import { scarePeds } from './pedestrians.js';
import { carSize, explodeCar } from './vehicles.js';

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    speed: 0,
    health: PLAYER.maxHealth,
    armor: 0,
    cash: ECONOMY.startCash,
    car: null, // car object when driving
    weapon: 'fists', // fists | pistol
    ammo: 0,
    punchTimer: 0,
    gunTimer: 0,
    hurtTimer: 0,
    aimAngle: 0,
    walkPhase: 0,
    moving: false,
  };
}

export function hurtPlayer(G, dmg, fromX, fromY) {
  const p = G.player;
  if (p.hurtTimer > 0 || G.mode === 'busted' || G.mode === 'wasted') return;
  p.hurtTimer = 0.5;
  let rest = dmg;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.health -= rest;
  spawn(G.particles, 'spark', p.x, p.y, { n: 6, speed: 140, life: 0.4, size: 3, color: '#ff5a5a' });
  if (fromX !== undefined) {
    const a = angleTo(fromX, fromY, p.x, p.y);
    p.x += Math.cos(a) * 14;
    p.y += Math.sin(a) * 14;
  }
  if (p.health <= 0) {
    p.health = 0;
    G.mode = 'wasted';
    G.modeTimer = 0;
    G.audio.sfx('fail');
  }
}

export function updatePlayerOnFoot(G, input, dt) {
  const p = G.player;
  p.punchTimer = Math.max(0, p.punchTimer - dt);
  p.gunTimer = Math.max(0, p.gunTimer - dt);
  p.hurtTimer = Math.max(0, p.hurtTimer - dt);

  const ax = input.axis();
  const running = input.isDown('run');
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const mx = ax.x;
  const my = ax.y;
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    const len = Math.hypot(mx, my) || 1;
    const tx = mx / len;
    const ty = my / len;
    p.angle = turnToward(p.angle, Math.atan2(ty, tx), 12 * dt);
    let nx = p.x + tx * speed * dt;
    let ny = p.y + ty * speed * dt;
    // Building collision: slide.
    if (hitsBuilding(G.city, nx, ny, PLAYER.radius)) {
      if (!hitsBuilding(G.city, nx, p.y, PLAYER.radius)) ny = p.y;
      else if (!hitsBuilding(G.city, p.x, ny, PLAYER.radius)) nx = p.x;
      else {
        nx = p.x;
        ny = p.y;
      }
    }
    // Ocean edge and world bounds.
    nx = clamp(nx, 16, 5560);
    ny = clamp(ny, 16, 3580);
    if (isWater(nx, ny)) {
      nx = p.x;
      ny = p.y;
    }
    p.x = nx;
    p.y = ny;
    p.walkPhase += dt * speed / 12;
    // Footstep dust on sand.
    if (Math.random() < dt * 6) {
      spawn(G.particles, 'smoke', p.x, p.y + 10, { n: 1, speed: 12, life: 0.4, size: 3, color: '#c9b896' });
    }
  }

  // Aim: face the mouse when the gun is out, else face movement.
  if (p.weapon === 'pistol') {
    const wx = G.camera.x + (input.mouse.x - G.view.w / 2) / G.camera.zoom;
    const wy = G.camera.y + (input.mouse.y - G.view.h / 2) / G.camera.zoom;
    p.aimAngle = angleTo(p.x, p.y, wx, wy);
    p.angle = p.aimAngle;
  }

  // Attack.
  if (input.wasPressed('attack') || (input.mouse.clicked && p.weapon === 'pistol')) {
    if (p.weapon === 'fists' && p.punchTimer <= 0) {
      p.punchTimer = PLAYER.punchCooldown;
      G.audio.sfx('punch');
      punch(G);
    } else if (p.weapon === 'pistol' && p.gunTimer <= 0 && p.ammo > 0) {
      p.gunTimer = PLAYER.gunCooldown;
      p.ammo--;
      shoot(G);
    } else if (p.weapon === 'pistol' && p.ammo <= 0) {
      G.ui.message('Out of ammo — buy more at Ammu-Nation.', '#e8c95a', 2.5);
      p.weapon = 'fists';
    }
  }

  // Enter the nearest car.
  if (input.wasPressed('enter')) {
    tryEnterCar(G);
  }

  // Pick up hidden packages.
  for (const pkg of G.packages) {
    if (!pkg.taken && dist(p.x, p.y, pkg.x, pkg.y) < 30) {
      pkg.taken = true;
      p.cash += ECONOMY.packageReward;
      G.flags.packages = (G.flags.packages || 0) + 1;
      G.audio.sfx('cash');
      addFloat(G.particles, pkg.x, pkg.y - 20, '+' + ECONOMY.packageReward + '  Hidden package!', '#ffd94a');
      G.ui.message(`Hidden package ${G.flags.packages}/${ECONOMY.packageCount} — +$${ECONOMY.packageReward}`, '#ffd94a', 2.5);
      if (G.flags.packages >= ECONOMY.packageCount) {
        p.cash += 1000;
        G.ui.message('ALL PACKAGES FOUND! Bonus $1,000!', '#ffd94a', 4);
      }
    }
  }
}

function punch(G) {
  const p = G.player;
  const px = p.x + Math.cos(p.angle) * 26;
  const py = p.y + Math.sin(p.angle) * 26;
  spawn(G.particles, 'spark', px, py, { n: 5, speed: 120, life: 0.3, size: 3, color: '#ffffff' });
  // Hit a ped.
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    if (dist(px, py, ped.x, ped.y) < 34) {
      ped.state = 'down';
      scarePeds(G, ped.x, ped.y, 260);
      G.wanted = Math.min(5, G.wanted + 1);
      G.heat = Math.min(100, G.heat + 25);
      return;
    }
  }
  // Hit a cop on foot.
  for (const cop of G.cops) {
    if (cop.onFoot && dist(px, py, cop.x, cop.y) < 34) {
      cop.hp -= PLAYER.punchDamage;
      if (cop.hp <= 0) {
        cop.down = true;
        cop.downTimer = 6;
        G.wanted = Math.min(5, G.wanted + 1);
        G.heat = 100;
      }
      return;
    }
  }
  // Smash a car window: damage a parked car.
  for (const car of G.cars) {
    if (dist(px, py, car.x, car.y) < 40) {
      car.hp -= PLAYER.punchDamage;
      spawn(G.particles, 'spark', car.x, car.y, { n: 4, speed: 150, life: 0.3, size: 2, color: '#bfeef2' });
      return;
    }
  }
}

function shoot(G) {
  const p = G.player;
  G.audio.sfx('gun');
  const a = p.aimAngle;
  const mx = p.x + Math.cos(a) * 22;
  const my = p.y + Math.sin(a) * 22;
  spawn(G.particles, 'spark', mx, my, { n: 4, speed: 260, life: 0.15, size: 3, color: '#ffe95a' });
  // Trace the bullet: first ped / cop / car within range along the ray.
  let bestD = PLAYER.gunRange;
  let hit = null;
  let hitKind = null;
  const step = 14;
  for (let d = 20; d < PLAYER.gunRange; d += step) {
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d;
    if (hitsBuilding(G.city, x, y, 2)) {
      bestD = d;
      spawn(G.particles, 'spark', x, y, { n: 3, speed: 120, life: 0.25, size: 2, color: '#cccccc' });
      break;
    }
    for (const ped of G.peds) {
      if (ped.state !== 'down' && dist(x, y, ped.x, ped.y) < 16) {
        hit = ped;
        hitKind = 'ped';
        bestD = d;
        break;
      }
    }
    if (hit) break;
    for (const cop of G.cops) {
      if (cop.onFoot && !cop.down && dist(x, y, cop.x, cop.y) < 16) {
        hit = cop;
        hitKind = 'cop';
        bestD = d;
        break;
      }
    }
    if (hit) break;
    for (const car of G.cars) {
      const { len, wid } = carSize(car);
      const dx = x - car.x;
      const dy = y - car.y;
      const along = Math.abs(dx * Math.cos(car.angle) + dy * Math.sin(car.angle));
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along < len / 2 && side < wid / 2) {
        hit = car;
        hitKind = 'car';
        bestD = d;
        break;
      }
    }
    if (hit) break;
  }
  // Draw a tracer.
  G.tracer = { x1: mx, y1: my, x2: p.x + Math.cos(a) * bestD, y2: p.y + Math.sin(a) * bestD, life: 0.09 };
  if (hitKind === 'ped') {
    hit.state = 'down';
    scarePeds(G, hit.x, hit.y, 320);
    G.wanted = Math.min(5, G.wanted + 1);
    G.heat = Math.min(100, G.heat + 30);
  } else if (hitKind === 'cop') {
    hit.hp -= PLAYER.gunDamage;
    if (hit.hp <= 0) {
      hit.down = true;
      hit.downTimer = 6;
      G.wanted = Math.min(5, G.wanted + 1);
      G.heat = 100;
    }
  } else if (hitKind === 'car') {
    hit.hp -= PLAYER.gunDamage;
    spawn(G.particles, 'smoke', hit.x, hit.y, { n: 4, speed: 60, life: 0.8, size: 6, color: '#555' });
    if (hit.driver === 'police') {
      G.wanted = Math.min(5, G.wanted + 1);
      G.heat = 100;
    }
    if (hit.hp <= 0) explodeCar(G, hit);
  }
  // A gunshot is loud: witnesses raise the heat.
  G.heat = Math.min(100, G.heat + 12);
  scarePeds(G, p.x, p.y, 420);
}

function tryEnterCar(G) {
  const p = G.player;
  let best = null;
  let bestD = 62;
  for (const car of G.cars) {
    if (car.driver === 'police') continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return;
  // Stealing in front of a witness raises the wanted level.
  const witnessed = G.peds.some((ped) => ped.state !== 'down' && dist(ped.x, ped.y, p.x, p.y) < 380);
  const wasParked = best.driver === 'parked';
  best.driver = 'player';
  best.speed = 0;
  p.car = best;
  G.audio.sfx('door');
  if (wasParked && witnessed) {
    G.wanted = Math.max(G.wanted, 1);
    G.heat = Math.min(100, G.heat + 30);
    G.ui.message('Car stolen — a witness called the cops!', '#ff5a5a', 2.5);
  } else if (wasParked) {
    G.ui.message(`You took the ${best.label}.`, '#ffffff', 1.6);
  }
}

export function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.driver = 'parked';
  car.speed = 0;
  // Step out to the side.
  const side = Math.random() < 0.5 ? 1 : -1;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * side * 26;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * side * 26;
  p.angle = car.angle;
  p.car = null;
  G.audio.sfx('door');
}

// Buying at a shop: called from the HUD prompt when the player is near.
export function shopAction(G, kind) {
  const p = G.player;
  if (kind === 'gun') {
    if (p.weapon !== 'pistol') {
      if (p.cash < ECONOMY.gunPrice) {
        G.ui.message('Not enough cash for a pistol ($300).', '#ff5a5a', 2);
        return;
      }
      p.cash -= ECONOMY.gunPrice;
      p.weapon = 'pistol';
      p.ammo = ECONOMY.ammoPack;
      G.ui.message('Pistol bought! Press 1 for fists, 2 for pistol.', '#ffd94a', 2.5);
      G.audio.sfx('cash');
      return;
    }
    if (p.ammo < ECONOMY.ammoPack * 2) {
      if (p.cash < ECONOMY.ammoPrice) {
        G.ui.message('Not enough cash for ammo ($60).', '#ff5a5a', 2);
        return;
      }
      p.cash -= ECONOMY.ammoPrice;
      p.ammo += ECONOMY.ammoPack;
      G.ui.message(`+${ECONOMY.ammoPack} ammo.`, '#ffd94a', 1.5);
      G.audio.sfx('cash');
      return;
    }
    if (p.armor < 100) {
      if (p.cash < ECONOMY.armorPrice) {
        G.ui.message('Not enough cash for armor ($250).', '#ff5a5a', 2);
        return;
      }
      p.cash -= ECONOMY.armorPrice;
      p.armor = 100;
      G.ui.message('Body armor fitted.', '#ffd94a', 1.5);
      G.audio.sfx('cash');
      return;
    }
    G.ui.message('Ammo and armor are full.', '#e8c95a', 1.5);
  } else if (kind === 'armor') {
    if (p.armor >= 100) {
      G.ui.message('Armor is full.', '#e8c95a', 1.5);
      return;
    }
    if (p.cash < ECONOMY.armorPrice) {
      G.ui.message('Not enough cash for armor ($250).', '#ff5a5a', 2);
      return;
    }
    p.cash -= ECONOMY.armorPrice;
    p.armor = 100;
    G.ui.message('Body armor fitted.', '#ffd94a', 1.5);
    G.audio.sfx('cash');
  } else if (kind === 'heal') {
    if (p.health >= 100) {
      G.ui.message('Health is full.', '#e8c95a', 1.5);
      return;
    }
    if (p.cash < ECONOMY.healPrice) {
      G.ui.message('Not enough cash for treatment ($80).', '#ff5a5a', 2);
      return;
    }
    p.cash -= ECONOMY.healPrice;
    p.health = 100;
    G.ui.message('Patched up. Health restored.', '#7ddc8a', 1.5);
    G.audio.sfx('pickup');
  } else if (kind === 'spray') {
    if (G.wanted === 0) {
      G.ui.message('No heat to lose.', '#e8c95a', 1.5);
      return;
    }
    if (p.cash < ECONOMY.sprayPrice) {
      G.ui.message('Not enough cash for a respray ($100).', '#ff5a5a', 2);
      return;
    }
    p.cash -= ECONOMY.sprayPrice;
    G.wanted = 0;
    G.heat = 0;
    if (p.car) p.car.color = '#3a6fb8';
    G.ui.message('Fresh paint — the heat is off.', '#7ddc8a', 2);
    G.audio.sfx('cash');
  }
}
