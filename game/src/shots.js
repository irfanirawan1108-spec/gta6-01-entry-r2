// Screenshot scenes: ?shot=cover|street|mission|night sets up a
// deterministic, frozen scene for the four dossier screenshots. Time
// does not advance in shot mode, and audio never starts.
import { G } from './state.js';
import { CITY } from './city.js';
import { rcx, rcy } from './config.js';
import { makeCar } from './vehicles.js';
import { MISSIONS, openDialogue } from './missions.js';

function giveCar(type, x, y, a, speed, color) {
  const c = makeCar(type, x, y, a, 'player');
  c.sp = speed;
  if (color) c.color = color;
  G.cars.push(c);
  G.car = c; G.onFoot = false; G.speed = speed;
  G.x = x; G.y = y; G.a = a;
  return c;
}
function cruiser(x, y, a, speed) {
  const c = makeCar(0, x, y, a, 'police');
  c.color = '#1f6feb'; c.max = 400; c.acc = 340; c.sp = speed;
  G.cars.push(c);
  return c;
}
export function applyShot(name) {
  G.shot = name;
  G.mode = 'play';
  G.toastT = 0;
  // clear the ambient traffic/peds the boot spawned; each scene places its own
  G.cars = G.cars.filter((c) => c.driver === 'player');
  if (name === 'cover') {
    // golden-hour chase on the beach road: 4 stars, helicopter overhead.
    // Cruisers trail behind (west); nothing head-on, so the chase holds.
    G.time = 17.75;
    giveCar(5, rcx(2) + 60, rcy(7), 0, 300, '#ff2d55');
    cruiser(rcx(2) - 110, rcy(7) + 10, 0, 280);
    cruiser(rcx(2) - 200, rcy(7) - 10, 0, 260);
    const t1 = makeCar(1, rcx(4) + 40, rcy(7) + 10, 0, 'traffic'); t1.sp = 150; G.cars.push(t1);
    G.heat = 70; G.stars = 4; G.heli = { a: 0.6, r: 200 };
    G.mission = { idx: 6, active: true, stage: 0, timer: 82, target: null, fares: 0, hits: 0, zone: null };
  } else if (name === 'street') {
    // midday downtown drive, traffic around, no heat
    G.time = 12;
    giveCar(0, rcx(4) - 40, rcy(1) + 40, Math.PI / 2, 210, '#00d4ff');
    const t1 = makeCar(1, rcx(4) - 11, rcy(1) - 140, Math.PI / 2, 'traffic'); t1.sp = 120; G.cars.push(t1);
    const t2 = makeCar(3, rcx(5) + 11, rcy(2) + 60, -Math.PI / 2, 'traffic'); t2.sp = 90; G.cars.push(t2);
    const t3 = makeCar(2, rcx(3) + 80, rcy(1) + 11, 0, 'traffic'); t3.sp = 100; G.cars.push(t3);
    G.heat = 0; G.stars = 0;
    G.mission = { idx: 0, active: false, stage: 0, timer: 0, target: null, fares: 0, hits: 0, zone: null };
  } else if (name === 'mission') {
    // Delia briefs the first mission at the garage, on foot
    G.time = 15;
    G.x = CITY.shops.garage.x; G.y = CITY.shops.garage.y + 44; G.a = -Math.PI / 2;
    G.onFoot = true; G.car = null;
    G.heat = 0; G.stars = 0;
    G.mission = { idx: 0, active: false, stage: 0, timer: 0, target: null, fares: 0, hits: 0, zone: null };
    openDialogue('Delia', MISSIONS[0].brief, () => {
      G.mission.active = true;
      G.mission.stage = 0;
    });
  } else if (name === 'night') {
    // night at the marina, headlights on, two stars behind
    G.time = 22.5;
    giveCar(1, rcx(8), rcy(6) + 11, Math.PI, 180, '#ffd60a');
    cruiser(rcx(8) + 150, rcy(6) - 11, Math.PI, 170);
    G.heat = 30; G.stars = 2;
    G.mission = { idx: 2, active: true, stage: 2, timer: 0, target: null, fares: 0, hits: 0, zone: null };
  }
}
