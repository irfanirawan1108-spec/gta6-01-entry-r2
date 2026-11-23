// The wanted system: heat builds with witnessed crime and decays when
// the player breaks line of sight; foot cops, cruisers, roadblocks at
// 3+ stars and a helicopter with a searchlight at 4-5 stars respond.
// Busted (caught on foot) or wasted (health gone) costs 10% of cash.
import { G, clamp, say, floatText } from './state.js';
import { CITY, nearestIntersection } from './city.js';
import { makeCar } from './vehicles.js';
import { mulberry32, rand, choice } from './random.js';
import { spawn } from './particles.js';
import { sfx } from './audio.js';

const R = mulberry32(99);
const STAR_HEAT = [0, 8, 25, 45, 65, 85];

export function addHeat(n) {
  G.heat = clamp(G.heat + n, 0, 100);
  updateStars();
}
function updateStars() {
  let s = 0;
  for (let i = 1; i <= 5; i++) if (G.heat >= STAR_HEAT[i]) s = i;
  if (s > G.stars) say(s >= 4 ? 'The helicopter is on you!' : `Wanted level ${s} star${s > 1 ? 's' : ''}`);
  G.stars = s;
}
function copNear(d) {
  for (const c of G.cops) if (Math.hypot(c.x - G.x, c.y - G.y) < d) return true;
  for (const c of G.cars) if (c.driver === 'police' && Math.hypot(c.x - G.x, c.y - G.y) < d) return true;
  return false;
}
function spawnPoint(minD, maxD) {
  for (let tries = 0; tries < 12; tries++) {
    const p = choice(R, CITY.intersections);
    const d = Math.hypot(p.x - G.x, p.y - G.y);
    if (d > minD && d < maxD) return p;
  }
  return nearestIntersection(G.x + 400, G.y);
}
function wantCounts(s) {
  return {
    foot: [0, 2, 2, 3, 4, 6][s],
    cars: [0, 0, 2, 4, 5, 6][s],
  };
}
export function updateWanted(dt) {
  updateStars(); // derive stars from heat every frame, however heat changed
  if (G.stars > 0) {
    G.heat -= (copNear(450) ? 0.8 : 4) * dt;
    if (G.heat < 0) G.heat = 0;
    updateStars();
  }
  const want = wantCounts(G.stars);
  const foot = G.cops.filter((c) => c.kind === 'foot').length;
  const cars = G.cars.filter((c) => c.driver === 'police').length;
  if (G.stars > 0 && foot < want.foot) {
    const p = spawnPoint(320, 520);
    G.cops.push({ kind: 'foot', x: p.x, y: p.y, a: 0, sp: 0, down: 0 });
  }
  if (G.stars > 0 && cars < want.cars) {
    const p = spawnPoint(340, 560);
    const c = makeCar(0, p.x, p.y, 0, 'police');
    c.color = '#1f6feb'; c.max = 400; c.acc = 340;
    G.cars.push(c);
  }
  // helicopter at 4-5 stars
  if (G.stars >= 4 && !G.heli) G.heli = { a: 0, r: 210 };
  if (G.stars < 4) G.heli = null;
  // roadblocks at 3+ stars: two cruisers across the road ahead
  if (G.stars >= 3 && G.roadblocks.length === 0) {
    const ahead = { x: G.x + Math.cos(G.a) * 420, y: G.y + Math.sin(G.a) * 420 };
    const p = nearestIntersection(ahead.x, ahead.y);
    if (Math.hypot(p.x - G.x, p.y - G.y) > 200) {
      const horiz = Math.abs(Math.sin(G.a)) > 0.5;
      for (const off of [-16, 16]) {
        const c = makeCar(0, horiz ? p.x + off : p.x, horiz ? p.y : p.y + off, horiz ? Math.PI / 2 : 0, 'police');
        c.color = '#1f6feb'; c.sp = 0;
        G.cars.push(c);
        G.roadblocks.push(c);
      }
      G.cops.push({ kind: 'foot', x: p.x - 30, y: p.y - 30, a: 0, sp: 0, down: 0 });
      G.cops.push({ kind: 'foot', x: p.x + 30, y: p.y + 30, a: 0, sp: 0, down: 0 });
      say('Roadblock ahead!');
    }
  }
  if (G.stars < 3) G.roadblocks = [];
}
export function updatePolice(dt) {
  // foot cops chase; a speeding car bowls them over (and that is a crime)
  for (let i = G.cops.length - 1; i >= 0; i--) {
    const c = G.cops[i];
    if (c.down > 0) { c.down -= dt; if (c.down <= 0) G.cops.splice(i, 1); continue; }
    const d = Math.hypot(G.x - c.x, G.y - c.y);
    if (d > 800) { G.cops.splice(i, 1); continue; }
    const a = Math.atan2(G.y - c.y, G.x - c.x);
    c.a = a;
    const sp = 132 + G.stars * 8;
    c.x += Math.cos(a) * sp * dt;
    c.y += Math.sin(a) * sp * dt;
    if (!G.onFoot && G.car && Math.abs(G.car.sp) > 110 && d < 26) {
      c.down = 8; addHeat(25); spawn(c.x, c.y, 8, '#1f6feb', 70, 0.5, 3);
      say('You ran over a cop!');
    } else if (G.onFoot && d < 18 && G.stars > 0) {
      busted();
      return;
    }
  }
  // cruisers hunt the player and ram; on foot they stop and a cop gets out
  for (const c of G.cars) {
    if (c.driver !== 'police' || G.roadblocks.includes(c)) continue;
    c.ramT = Math.max(0, (c.ramT || 0) - dt);
    const d = Math.hypot(G.x - c.x, G.y - c.y);
    if (d > 900) { c.driver = 'none'; continue; }
    const want = Math.atan2(G.y - c.y, G.x - c.x);
    const diff = ((want - c.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    c.a += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
    const target = d > 60 ? 380 : 140;
    c.sp += (target - c.sp) * Math.min(1, 1.6 * dt);
    c.x += Math.cos(c.a) * c.sp * dt;
    c.y += Math.sin(c.a) * c.sp * dt;
    if (G.onFoot && d < 30 && c.sp < 60) {
      const p = { kind: 'foot', x: c.x + 20, y: c.y + 20, a: 0, sp: 0, down: 0 };
      G.cops.push(p); c.sp = 0; c.driver = 'none';
    } else if (!G.onFoot && G.car && d < 30 && c.ramT <= 0) {
      // a ram is one hit with a cooldown, not continuous damage
      c.ramT = 1;
      G.car.hp = Math.max(0, G.car.hp - 6);
      G.health = Math.max(0, G.health - 3);
      spawn(c.x, c.y, 6, '#ffd60a', 70, 0.4, 3);
      sfx('crash');
    }
  }
  if (G.heli) G.heli.a += dt * 0.45;
}
function penalty() {
  const lost = Math.floor(G.cash * 0.1);
  G.cash -= lost;
  return lost;
}
export function busted() {
  const lost = penalty();
  G.stats.busted++;
  G.mode = 'busted';
  G.respawnAt = 'pd';
  G.heat = 0; G.stars = 0; G.heli = null; G.roadblocks = [];
  G.cops = [];
  for (const c of G.cars) if (c.driver === 'police') c.driver = 'none';
  G.msg = `BUSTED — the city took $${lost} (10%)`;
  sfx('busted');
}
export function wasted() {
  const lost = penalty();
  G.stats.wasted++;
  G.mode = 'wasted';
  G.respawnAt = 'hospital';
  G.heat = 0; G.stars = 0; G.heli = null; G.roadblocks = [];
  G.cops = [];
  for (const c of G.cars) if (c.driver === 'police') c.driver = 'none';
  G.msg = `WASTED — the city took $${lost} (10%)`;
  sfx('busted');
}
export function respawn(at) {
  // at: 'pd' | 'hospital'
  const s = at === 'pd' ? CITY.shops.police : CITY.shops.hospital;
  G.x = s.x; G.y = s.y + 30; G.a = Math.PI / 2;
  G.onFoot = true; G.car = null; G.health = 100; G.speed = 0;
  G.mode = 'play';
}
