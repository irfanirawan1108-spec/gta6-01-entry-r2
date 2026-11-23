// Screenshot staging. `?shot=<name>&seed=<n>` puts the game into a
// fixed, good-looking scene so the maker's screenshots are deterministic
// and show the systems that matter. The game itself is unchanged —
// shots only set positions, time of day, wanted level and the mission.
//
//   ?shot=cover   — sunset police chase, 3 stars, sports car, minimap + HUD
//   ?shot=street  — midday downtown drive with traffic and pedestrians
//   ?shot=mission — on-foot heist at the bank with the dialogue box open
//   ?shot=night   — night neon, headlights, 2 stars, helicopter searchlight
//
// shots.json lists the four shots the dossier uses.

import { mulberry32, range } from './random.js';
import { makeCar } from './vehicles.js';
import { makePed } from './pedestrians.js';
import { makeCop, spawnCopCar } from './police.js';
import { startMission } from './missions.js';

export function applyShot(G, name, seed) {
  const rng = mulberry32(seed || 7);
  G.shotMode = name;
  const p = G.player;
  // Clear the default traffic/peds so the scene is fully staged.
  G.cars.length = 0;
  G.peds.length = 0;
  G.cops.length = 0;

  if (name === 'cover') {
    G.clock = 18 * 60 + 22; // golden sunset
    // Chase east along the road at y=1296 (road row 3 centre).
    const car = makeCar('sports', 1500, 1296, 0, 'player');
    car.color = '#d42a2a';
    car.speed = 420;
    G.cars.push(car);
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    p.cash = 12480;
    // Three cruisers in pursuit behind the player.
    for (let i = 0; i < 3; i++) {
      const cx = car.x - 260 - i * 130 + range(rng, -20, 20);
      const cy = car.y + (i - 1) * 70 + range(rng, -20, 20);
      const cop = makeCar('police', cx, cy, 0, 'police');
      cop.speed = 380;
      G.cars.push(cop);
      const c = makeCop(cx, cy, false);
      c.car = cop;
      G.cops.push(c);
    }
    // Traffic ahead and pedestrians on the sidewalks.
    for (let i = 0; i < 6; i++) {
      const t = makeCar(i % 2 ? 'sedan' : 'taxi', car.x + 420 + i * 110, 1296 + (i % 2 ? 48 : -48), 0, 'traffic');
      t.speed = 200;
      G.cars.push(t);
    }
    for (let i = 0; i < 8; i++) {
      const ped = makePed(car.x + range(rng, -260, 420), 1296 + range(rng, -190, 190));
      ped.state = 'flee';
      G.peds.push(ped);
    }
    G.camera.x = car.x + 60;
    G.camera.y = car.y;
    startMission(G, 6); // Four-Star Escape — then stage it as a 3-star chase.
    G.ui.dialogue = null;
    G.mission.state = 'active';
    G.mission.step = 0;
    G.wanted = 3;
    G.heat = 90;
    G.mission.marker = { x: 2400, y: 1296, label: 'Get to the safehouse' };
    G.ui.message('WANTED — 3 stars! Lose the cops!', '#ff5a5a', 99);
    return;
  }

  if (name === 'street') {
    G.clock = 12 * 60 + 20; // bright midday
    G.wanted = 0;
    // Drive east along the road at y=880 (road row 2 centre).
    const car = makeCar('coupe', 1200, 880, 0, 'player');
    car.color = '#2a7ad4';
    car.speed = 300;
    G.cars.push(car);
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    p.cash = 3240;
    for (let i = 0; i < 9; i++) {
      const t = makeCar(['sedan', 'taxi', 'van', 'truck'][i % 4], 700 + i * 150, 880 + (i % 2 ? 48 : -48), 0, 'traffic');
      t.speed = 180;
      G.cars.push(t);
    }
    for (let i = 0; i < 12; i++) {
      const ped = makePed(1200 + range(rng, -320, 480), 880 + range(rng, -230, 270));
      G.peds.push(ped);
    }
    G.camera.x = car.x + 40;
    G.camera.y = car.y;
    G.ui.message('Palma Verde — downtown at noon', '#ffffff', 99);
    return;
  }

  if (name === 'mission') {
    G.clock = 11 * 60 + 40;
    G.wanted = 1;
    G.heat = 55;
    // On foot at the bank door, on the road at (464, 1420).
    p.car = null;
    p.x = 464;
    p.y = 1420;
    p.cash = 860;
    p.weapon = 'pistol';
    p.ammo = 24;
    for (let i = 0; i < 4; i++) {
      const ped = makePed(464 + range(rng, -160, 200), 1420 + range(rng, -120, 160));
      G.peds.push(ped);
    }
    for (let i = 0; i < 2; i++) {
      const cop = makeCop(464 + range(rng, 200, 320), 1420 + range(rng, -80, 80), true);
      G.cops.push(cop);
    }
    const car = makeCar('sedan', 560, 1480, Math.PI / 2, 'parked');
    G.cars.push(car);
    G.camera.x = p.x;
    G.camera.y = p.y;
    startMission(G, 4); // The Vault — dialogue box open on the cover shot.
    return;
  }

  if (name === 'night') {
    G.clock = 22 * 60 + 10; // deep night
    G.wanted = 2;
    G.heat = 70;
    // Drive south down the road at x=2128 (road col 5 centre).
    const car = makeCar('sports', 2128, 880, Math.PI / 2, 'player');
    car.color = '#e8e83a';
    car.speed = 360;
    G.cars.push(car);
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    p.cash = 5870;
    const cop = spawnCopCar(G);
    cop.car.x = car.x;
    cop.car.y = car.y - 300;
    cop.car.angle = Math.PI / 2;
    cop.car.speed = 340;
    for (let i = 0; i < 5; i++) {
      const t = makeCar(['sedan', 'taxi', 'coupe'][i % 3], 2128 + (i % 2 ? 48 : -48), 500 + i * 130, Math.PI / 2, 'traffic');
      t.speed = 170;
      G.cars.push(t);
    }
    for (let i = 0; i < 6; i++) {
      const ped = makePed(2128 + range(rng, -260, 320), 880 + range(rng, -160, 200));
      G.peds.push(ped);
    }
    G.camera.x = car.x;
    G.camera.y = car.y + 40;
    G.ui.message('Night in Palma Verde — the city glows', '#ffffff', 99);
    return;
  }

  // Unknown shot: leave the default scene alone.
  G.shotMode = null;
}
