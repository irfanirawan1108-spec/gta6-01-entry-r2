// Story missions and side jobs. Missions are data: a list of steps the
// engine walks through. Steps: goto | talk | car | deliver | chase |
// disable | wait | survive | collect. The engine owns the objective
// marker, the dialogue box and the pass / fail flow.

import { ECONOMY } from './config.js';
import { dist, clamp } from './random.js';
import { addFloat } from './particles.js';
import { makeCar } from './vehicles.js';

export const MISSION_DEFS = [
  {
    id: 'm1', title: 'New in Town', giver: 'Delia', reward: 250,
    intro: [
      'Delia: Milo! You made it to Palma Verde. Forty bucks and no car — classic.',
      'Delia: Grab any car off the street and meet me at the plaza. Try not to get spotted.',
    ],
    steps: [
      { type: 'car', label: 'Steal a car' },
      { type: 'goto', at: (s) => s.plaza, label: 'Drive to the plaza' },
    ],
    outro: 'Delia: Not bad. You drive like you stole it — because you did. Here is your cut.',
  },
  {
    id: 'm2', title: 'Taxi Rush', giver: 'Delia', reward: 350,
    intro: [
      'Delia: My cousin runs the taxi stand. Three fares, quick feet — I mean wheels.',
      'Delia: Get a taxi, pick up the fares, drop them off. Tips are yours.',
    ],
    steps: [
      { type: 'taxi', label: 'Get in a taxi' },
      { type: 'fare', count: 3, label: 'Complete 3 fares' },
    ],
    outro: 'Delia: Three fares, no complaints. The stand likes you.',
  },
  {
    id: 'm3', title: 'Hot Delivery', giver: 'Delia', reward: 500,
    intro: [
      'Delia: A package for the beach house. The cops already know the route, so be quick.',
      'Delia: Ninety seconds. Do not stop for anyone.',
    ],
    steps: [
      { type: 'car', label: 'Get a car' },
      { type: 'deliver', at: (s) => s.beach, time: 90, label: 'Deliver to the beach house (90s)' },
    ],
    outro: 'Delia: Delivered hot. The beach house sends its regards — and cash.',
    onStart: (G) => { G.wanted = Math.max(G.wanted, 1); G.heat = 60; },
  },
  {
    id: 'm4', title: 'Repo Man', giver: 'Rico', reward: 650,
    intro: [
      'Rico: Some clown stopped paying for his coupe. Bring it back to the garage.',
      'Rico: He will run. Ram him till the engine gives up, then walk up and take the keys.',
    ],
    steps: [
      { type: 'chase', label: 'Chase the coupe' },
      { type: 'disable', label: 'Disable the coupe, then walk up to it' },
    ],
    outro: 'Rico: Keys in hand. The garage owes you one.',
    onStart: (G) => spawnTargetCar(G, 'coupe', '#2a8a7a'),
  },
  {
    id: 'm5', title: 'The Vault', giver: 'Delia', reward: 1200,
    intro: [
      'Delia: The downtown bank keeps a vault nobody watches at noon. Crack it, then vanish.',
      'Delia: Hold the door for six seconds. Then the whole city will want you — get home.',
    ],
    steps: [
      { type: 'goto', at: (s) => ({ x: s.plaza.x - 600, y: s.plaza.y - 500 }), label: 'Reach the bank' },
      { type: 'wait', time: 6, label: 'Hold the vault door (6s)' },
      { type: 'escape', at: (s) => s.safehouse, label: 'Lose the heat — get to the safehouse' },
    ],
    outro: 'Delia: The vault is empty and so is your wanted level. Beautiful.',
    onWaitDone: (G) => { G.wanted = 3; G.heat = 100; },
  },
  {
    id: 'm6', title: 'Chase the Rat', giver: 'Rico', reward: 800,
    intro: [
      'Rico: The rat who sold us out is in a red sedan, heading for the marina.',
      'Rico: Hit him three times. Hard. Then he talks.',
    ],
    steps: [
      { type: 'ram', hits: 3, label: 'Ram the rat 3 times' },
    ],
    outro: 'Rico: He talked. We know who set us up. Good driving.',
    onStart: (G) => spawnTargetCar(G, 'sedan', '#d42a2a'),
  },
  {
    id: 'm7', title: 'Four-Star Escape', giver: 'Delia', reward: 1500,
    intro: [
      'Delia: The whole department is coming. Four stars, helicopter and all.',
      'Delia: Survive sixty seconds. Then disappear.',
    ],
    steps: [
      { type: 'survive', time: 60, label: 'Survive the manhunt (60s)' },
      { type: 'goto', at: (s) => s.safehouse, label: 'Get to the safehouse' },
    ],
    outro: 'Delia: Four stars and you walked away. Palma Verde is yours, Milo.',
    onStart: (G) => { G.wanted = 4; G.heat = 100; },
  },
  {
    id: 'm8', title: 'The Last Run', giver: 'Delia', reward: 3000,
    intro: [
      'Delia: One last job. A case from the marina to the airport. Two stars, two minutes.',
      'Delia: Do this and we are done running. We own this city.',
    ],
    steps: [
      { type: 'goto', at: (s) => ({ x: 900, y: 3400 }), label: 'Pick up the case at the marina' },
      { type: 'deliver', at: (s) => s.airport, time: 120, label: 'Deliver to the airport (120s)' },
    ],
    outro: 'Delia: That is the last run. Palma Verde is ours — and so is the sunset.',
    onStart: (G) => { G.wanted = Math.max(G.wanted, 2); G.heat = 80; },
  },
];

function spawnTargetCar(G, type, color) {
  const p = G.player;
  const x = clamp(p.x + 500, 200, 4000);
  const y = clamp(p.y + 200, 200, 3200);
  const car = makeCar(type, x, y, 0, 'mission');
  car.color = color;
  car.missionTarget = true;
  car.targetSpeed = car.top * 0.8;
  G.cars.push(car);
  G.mission.target = car;
  G.mission.hits = 0;
  return car;
}

export function startMission(G, index) {
  const def = MISSION_DEFS[index];
  if (!def) return false;
  G.mission = {
    def,
    index,
    step: 0,
    state: 'intro',
    line: 0,
    timer: 0,
    marker: null,
    target: null,
    hits: 0,
    fare: null,
    faresDone: 0,
    waitT: 0,
    surviveT: 0,
  };
  G.ui.showDialogue(def.intro, def.giver);
  if (def.onStart) def.onStart(G);
  return true;
}

export function missionLabel(G) {
  const m = G.mission;
  if (!m || m.state === 'none') return null;
  if (m.state === 'done') return 'Mission complete!';
  const step = m.def.steps[m.step];
  return step ? step.label : m.def.title;
}

export function missionMarker(G) {
  const m = G.mission;
  if (!m || m.state !== 'active') return null;
  return m.marker;
}

function setMarker(G, step) {
  const m = G.mission;
  if (!step) {
    m.marker = null;
    return;
  }
  if (step.at) {
    const spot = step.at(G.city.spots);
    m.marker = { x: spot.x, y: spot.y, label: step.label };
  } else if (step.type === 'chase' || step.type === 'ram' || step.type === 'disable') {
    m.marker = null; // marker follows the target car instead
  } else {
    m.marker = null;
  }
}

export function advanceMission(G) {
  const m = G.mission;
  m.step++;
  if (m.step >= m.def.steps.length) {
    completeMission(G);
    return;
  }
  const step = m.def.steps[m.step];
  m.timer = step.time || 0;
  m.waitT = 0;
  m.surviveT = 0;
  setMarker(G, step);
  G.ui.message(step.label, '#ffd94a', 2.5);
  if (step.type === 'fare') startFare(G);
}

function completeMission(G) {
  const m = G.mission;
  m.state = 'done';
  m.marker = null;
  G.player.cash += m.def.reward;
  G.flags.missionsDone = (G.flags.missionsDone || 0) + 1;
  G.audio.sfx('mission');
  addFloat(G.particles, G.player.x, G.player.y - 30, '+$' + m.def.reward, '#ffd94a');
  G.ui.showDialogue([m.def.outro], m.def.giver);
  G.ui.message(`Mission complete: ${m.def.title}  +$${m.def.reward}`, '#ffd94a', 4);
  if (m.index >= MISSION_DEFS.length - 1) {
    G.flags.storyDone = true;
  }
}

export function failMission(G, why) {
  const m = G.mission;
  if (!m || m.state !== 'active') return;
  m.state = 'failed';
  m.marker = null;
  G.audio.sfx('fail');
  G.ui.message(`Mission failed: ${why}`, '#ff5a5a', 3.5);
  // The mission stays available: the player can restart it at the garage.
  G.mission.failedDef = m.def;
  G.mission.index = m.index;
}

export function updateMissions(G, dt, input) {
  const m = G.mission;
  if (!m || m.state === 'none') return;
  if (m.state === 'intro' || m.state === 'done') {
    // Dialogue is showing; E/click advances it. main.js handles the advance.
    return;
  }
  if (m.state === 'failed') return;
  const p = G.player;
  const step = m.def.steps[m.step];
  if (!step) return;

  // Timers.
  if (step.time && (step.type === 'deliver' || step.type === 'survive')) {
    m.timer -= dt;
    if (m.timer <= 0) {
      if (step.type === 'deliver') failMission(G, 'Out of time.');
      else advanceMission(G);
      return;
    }
  }

  const atMarker = m.marker && dist(p.x, p.y, m.marker.x, m.marker.y) < (step.type === 'escape' ? 70 : 56);

  switch (step.type) {
    case 'car': {
      if (p.car) advanceMission(G);
      break;
    }
    case 'taxi': {
      if (p.car && p.car.type === 'taxi') advanceMission(G);
      break;
    }
    case 'goto': {
      if (atMarker) advanceMission(G);
      break;
    }
    case 'talk': {
      if (atMarker && input.wasPressed('enter')) advanceMission(G);
      break;
    }
    case 'wait': {
      if (atMarker) {
        m.waitT += dt;
        if (m.waitT >= step.time) {
          if (m.def.onWaitDone) m.def.onWaitDone(G);
          advanceMission(G);
        }
      } else {
        m.waitT = 0;
      }
      break;
    }
    case 'deliver': {
      if (atMarker) advanceMission(G);
      break;
    }
    case 'escape': {
      if (atMarker && G.wanted === 0) advanceMission(G);
      else if (atMarker && G.wanted > 0) {
        G.ui.message('Lose the heat first — stay out of sight!', '#ff5a5a', 1.2);
      }
      break;
    }
    case 'survive': {
      m.surviveT += dt;
      if (m.surviveT >= step.time) advanceMission(G);
      break;
    }
    case 'chase': {
      const t = m.target;
      if (!t || t.hp <= 0) {
        // Target wrecked or gone: move on.
        advanceMission(G);
      }
      break;
    }
    case 'disable': {
      const t = m.target;
      if (t && t.hp <= 25 && !p.car && dist(p.x, p.y, t.x, t.y) < 60) {
        advanceMission(G);
      } else if (t && t.hp <= 25 && p.car) {
        G.ui.message('Get out and walk up to the coupe.', '#ffd94a', 1.2);
      }
      break;
    }
    case 'ram': {
      const t = m.target;
      if (t && t.hp <= 0) {
        // Target destroyed counts as all hits.
        advanceMission(G);
      }
      break;
    }
    case 'fare': {
      updateFare(G, dt);
      if (m.faresDone >= step.count) advanceMission(G);
      break;
    }
    default:
      break;
  }
}

// --- Taxi fares (also the standalone side job) ------------------------------

export function startFare(G) {
  const m = G.mission;
  const spots = G.city.spots;
  const p = G.player;
  const pickups = [spots.plaza, spots.beach, spots.hospital, spots.showroom, spots.safehouse, spots.airport];
  const drop = pickups[Math.floor(Math.random() * pickups.length)];
  const from = pickups[Math.floor(Math.random() * pickups.length)];
  const fare = {
    from: { x: from.x + (Math.random() - 0.5) * 120, y: from.y + (Math.random() - 0.5) * 120 },
    to: { x: drop.x + (Math.random() - 0.5) * 120, y: drop.y + (Math.random() - 0.5) * 120 },
    phase: 'pickup',
    timer: 75,
    paid: 0,
  };
  if (m) {
    m.fare = fare;
    m.marker = { x: fare.from.x, y: fare.from.y, label: 'Pick up the fare' };
  } else {
    const done = G.taxi ? G.taxi.faresDone : 0;
    G.taxi = { active: true, fare, faresDone: done };
    G.ui.message('Taxi fare: pick up the passenger.', '#ffd94a', 2.5);
  }
}

export function updateFare(G, dt) {
  const m = G.mission && G.mission.state === 'active' ? G.mission : null;
  const fare = m ? m.fare : G.taxi && G.taxi.fare;
  if (!fare) return;
  const p = G.player;
  fare.timer -= dt;
  if (fare.timer <= 0) {
    if (m) {
      failMission(G, 'The fare got tired of waiting.');
    } else {
      G.taxi = null;
      G.ui.message('The fare left. Taxi job over.', '#ff5a5a', 2);
    }
    return;
  }
  const target = fare.phase === 'pickup' ? fare.from : fare.to;
  const inTaxi = p.car && p.car.type === 'taxi';
  if (!inTaxi) return;
  if (dist(p.x, p.y, target.x, target.y) < 56) {
    if (fare.phase === 'pickup') {
      fare.phase = 'drop';
      fare.timer = 75;
      if (m) m.marker = { x: fare.to.x, y: fare.to.y, label: 'Drop off the fare' };
      G.ui.message('Passenger in — drive to the destination.', '#ffd94a', 2);
      G.audio.sfx('pickup');
    } else {
      const pay = 45 + Math.floor(dist(fare.from.x, fare.from.y, fare.to.x, fare.to.y) * 0.05);
      p.cash += pay;
      G.audio.sfx('cash');
      addFloat(G.particles, p.x, p.y - 30, '+$' + pay, '#ffd94a');
      if (m) {
        m.faresDone++;
        if (m.faresDone < 3) startFare(G);
      } else {
        G.taxi.faresDone++;
        G.ui.message(`Fare paid $${pay}. Total fares: ${G.taxi.faresDone}`, '#ffd94a', 2);
        startFare(G);
      }
    }
  }
}

// --- Vigilante side job ------------------------------------------------------

export function startVigilante(G) {
  if (G.vigilante) return;
  const p = G.player;
  const car = makeCar(pick(['sedan', 'coupe', 'sports']), clamp(p.x + 420, 200, 4000), clamp(p.y + 120, 200, 3200), 0, 'mission');
  car.color = '#3a3a3a';
  car.missionTarget = true;
  car.criminal = true;
  G.cars.push(car);
  G.vigilante = { target: car, timer: 90 };
  G.ui.message('Vigilante: a criminal is fleeing — stop his car!', '#ff5a5a', 3);
}

export function updateVigilante(G, dt) {
  const v = G.vigilante;
  if (!v) return;
  v.timer -= dt;
  const t = v.target;
  if (!t || t.hp <= 0 || v.timer <= 0) {
    if (t && t.hp <= 0) {
      G.player.cash += 220;
      G.audio.sfx('cash');
      addFloat(G.particles, G.player.x, G.player.y - 30, '+$220', '#ffd94a');
      G.ui.message('Criminal stopped! +$220', '#ffd94a', 3);
    } else {
      G.ui.message('The criminal got away.', '#ff5a5a', 2);
    }
    const idx = G.cars.indexOf(t);
    if (idx >= 0) G.cars.splice(idx, 1);
    G.vigilante = null;
  }
}

// Mission target cars flee from the player; criminal cars too.
export function updateMissionTarget(G, car, dt) {
  const p = G.player;
  const d = dist(car.x, car.y, p.x, p.y);
  // Flee: steer away from the player, roughly along roads.
  const away = Math.atan2(car.y - p.y, car.x - p.x);
  car.angle = turnTowardAngle(car.angle, away, 2.4 * dt);
  if (car.speed < car.targetSpeed) car.speed += car.accel * 0.8 * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 20, 4200);
  car.y = clamp(car.y, 20, 3400);
  // Ram detection: the player's car hitting the target.
  if (p.car && d < 46) {
    const rel = Math.abs(p.car.speed);
    car._hitCd = Math.max(0, (car._hitCd || 0) - dt);
    if (rel > 120 && car._hitCd <= 0) {
      car._hitCd = 0.8;
      car.hp -= 12;
      if (G.mission && G.mission.target === car) {
        G.mission.hits++;
        G.audio.sfx('crash');
        addFloat(G.particles, car.x, car.y - 30, 'HIT ' + G.mission.hits + '/3', '#ff5a5a');
        if (G.mission.def && G.mission.def.id === 'm6' && G.mission.hits >= 3) {
          // m6 completes on 3 hits.
          const m = G.mission;
          if (m.state === 'active') advanceMission(G);
        }
      }
      p.car.speed *= 0.6;
      car.speed *= 0.8;
    }
  }
  if (car.hp <= 25 && car.driver === 'mission') {
    // Disabled: the target gives up and stops.
    car.speed = Math.max(0, car.speed - 300 * dt);
  }
}

import { turnToward as turnTowardAngle } from './random.js';
import { pick } from './random.js';
