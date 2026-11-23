// Story missions (8, for Delia and Rico), the dialogue box, taxi fares,
// vigilante chases and shop interactions. Missions are data: stages with
// a kind the updater checks — go, car, deliver, ram, survive, hold,
// taxi, reach.
import { G, say, floatText, fmtCash } from './state.js';
import { CITY } from './city.js';
import { makeCar } from './vehicles.js';
import { addHeat } from './police.js';
import { saveGame } from './save.js';
import { sfx } from './audio.js';

const S = CITY.shops;
const AIR = { x: S.airport.x, y: S.airport.y };
const BANK = { x: S.bank.x, y: S.bank.y };
const GAR = { x: S.garage.x, y: S.garage.y };

export const MISSIONS = [
  { name: 'Borrowed Wheels', giver: 'Delia', pay: 120,
    brief: ['Milo. You want work? First, prove you can drive.', 'Borrow any car on the street and bring it to my garage.', 'No cops, no dents — or at least, no cops.'],
    done: ['Not bad. The garage can use a driver like you.', 'Here is your cut. Come back when you want real work.'],
    stages: [
      { k: 'go', x: GAR.x, y: GAR.y, text: 'Go to Delia\'s Garage' },
      { k: 'car', text: 'Steal a car' },
      { k: 'deliver', x: GAR.x, y: GAR.y, text: 'Bring the car to the garage' },
    ] },
  { name: 'Taxi Rush', giver: 'Delia', pay: 200,
    brief: ['The taxi firm is short a driver and the fares are good.', 'Run three fares. The meter is running — be quick.'],
    done: ['Three fares, no complaints. You drive like you mean it.'],
    stages: [{ k: 'taxi', n: 3, t: 200, text: 'Run 3 taxi fares' }] },
  { name: 'Hot Delivery', giver: 'Rico', pay: 250,
    brief: ['Rico here. I have a package that cannot wait.', 'Take any car, pick it up at the bank, drop it at the airport.', 'If the cops get curious, drive faster.'],
    done: ['Delivered clean. Rico remembers people who deliver.'],
    stages: [
      { k: 'go', x: BANK.x, y: BANK.y, text: 'Pick up the package at the bank' },
      { k: 'car', text: 'Get a car' },
      { k: 'deliver', x: AIR.x, y: AIR.y, text: 'Deliver to the airport' },
    ] },
  { name: 'Repo Run', giver: 'Delia', pay: 300,
    brief: ['A client stopped paying. His sports car is mine now.', 'Chase it down and ram it till it stops, then bring it here.'],
    done: ['The repo is done. The car is mine, the cut is yours.'],
    stages: [
      { k: 'ram', text: 'Ram the target car until it stops' },
      { k: 'deliver', x: GAR.x, y: GAR.y, text: 'Bring the repo car to the garage' },
    ] },
  { name: 'Vault Job', giver: 'Rico', pay: 450,
    brief: ['The bank vault. Sixty seconds inside, that is all.', 'Hold the doors while I work. The cops will come — hold anyway.'],
    done: ['Sixty seconds and we are rich. You held like a wall.'],
    stages: [
      { k: 'go', x: BANK.x, y: BANK.y, text: 'Get to the bank' },
      { k: 'hold', x: BANK.x, y: BANK.y, t: 45, text: 'Hold the bank doors — 45s' },
      { k: 'deliver', x: GAR.x, y: GAR.y, text: 'Escape to the garage' },
    ] },
  { name: 'Three Hits', giver: 'Delia', pay: 400,
    brief: ['Three rivals. Three cars. One message.', 'Ram each of them until they stop running.'],
    done: ['Three wrecks, one message delivered. Beautiful.'],
    stages: [
      { k: 'ram', text: 'Ram target car 1 until it stops' },
      { k: 'ram', text: 'Ram target car 2 until it stops' },
      { k: 'ram', text: 'Ram target car 3 until it stops' },
    ] },
  { name: 'Four-Star Escape', giver: 'Rico', pay: 550,
    brief: ['You are about to be the most wanted man in Palma Verde.', 'Survive ninety seconds at four stars. Lose them and it does not count.'],
    done: ['Ninety seconds, four stars, still free. Legendary.'],
    stages: [{ k: 'survive', stars: 4, t: 90, text: 'Survive 90s at 4 stars' }] },
  { name: 'Airport Run', giver: 'Delia', pay: 700,
    brief: ['Last job. The heat is already on us.', 'Get to the airport with the cops on your tail. Do not stop for anything.'],
    done: ['You made it. Palma Verde is yours now, Milo. Drive safe.'],
    stages: [
      { k: 'car', text: 'Get a fast car' },
      { k: 'reach', x: AIR.x, y: AIR.y, stars: 3, text: 'Reach the airport at 3+ stars' },
    ] },
];

export function openDialogue(who, lines, done) {
  G.dlg = { who, lines, i: 0, done: done || null };
}
function stageMarker() {
  const m = MISSIONS[G.mission.idx];
  if (!m || !G.mission.active) return null;
  const st = m.stages[G.mission.stage];
  if (!st) return null;
  if (st.k === 'ram' && G.mission.target) return { x: G.mission.target.x, y: G.mission.target.y };
  if (st.x !== undefined) return { x: st.x, y: st.y };
  if (G.taxi) return { x: G.taxi.x, y: G.taxi.y };
  return null;
}
export function missionMarker() { return stageMarker(); }
export function objectiveText() {
  if (G.taxi) return G.taxi.picked ? `Fare: drop off (${Math.ceil(G.taxi.timer)}s)` : `Fare: pick up the passenger`;
  if (G.vig) return 'Vigilante: ram the getaway car until it stops';
  const m = MISSIONS[G.mission.idx];
  if (!m) return 'All missions complete — Palma Verde is yours';
  if (!G.mission.active) return `Next: ${m.name} — see Delia at the garage`;
  const st = m.stages[G.mission.stage];
  if (!st) return m.name;
  if (st.k === 'survive') return `${m.name}: ${Math.ceil(G.mission.timer)}s left at ${st.stars} stars`;
  if (st.k === 'hold') return `${m.name}: hold ${Math.ceil(st.t - G.mission.timer)}s`;
  if (st.k === 'taxi') return `${m.name}: fares ${G.mission.fares}/${st.n} (${Math.ceil(G.mission.timer)}s)`;
  return `${m.name}: ${st.text}`;
}
function spawnTarget() {
  const p = CITY.intersections[Math.floor(Math.random() * CITY.intersections.length)];
  const c = makeCar(5, p.x, p.y, 0, 'target');
  c.color = '#ff2d55'; c.max = 430; c.acc = 360;
  c.route = null;
  G.cars.push(c);
  G.mission.target = c;
  return c;
}
function startStage() {
  const st = MISSIONS[G.mission.idx].stages[G.mission.stage];
  if (st.k === 'ram') spawnTarget();
  if (st.k === 'survive') { addHeat(70); G.mission.timer = st.t; }
  if (st.k === 'hold') { addHeat(30); G.mission.timer = 0; }
  if (st.k === 'taxi') { G.mission.timer = st.t; G.mission.fares = 0; startTaxi(true); }
  if (st.k === 'reach') addHeat(50);
}
export function startMission(idx) {
  const m = MISSIONS[idx];
  G.mission.idx = idx; G.mission.active = false; G.mission.stage = 0;
  G.mission.target = null; G.mission.fares = 0; G.mission.timer = 0;
  openDialogue(m.giver, m.brief, () => {
    G.mission.active = true;
    startStage();
    say(`Mission: ${m.name}`);
    sfx('pickup');
  });
}
function completeMission() {
  const m = MISSIONS[G.mission.idx];
  G.cash += m.pay; G.stats.earned += m.pay;
  G.mission.active = false; G.mission.idx++;
  G.mission.target = null; G.taxi = null; G.vig = null;
  openDialogue(m.giver, [...m.done, `Pay: ${fmtCash(m.pay)}`], null);
  floatText(G.x, G.y - 24, `+$${m.pay}`, '#58d68d');
  saveGame();
  sfx('pickup');
}
function advanceStage() {
  const m = MISSIONS[G.mission.idx];
  G.mission.stage++;
  if (G.mission.stage >= m.stages.length) completeMission();
  else startStage();
}
// --- taxi fares ---------------------------------------------------------------
function farePoint() {
  const p = CITY.intersections[Math.floor(Math.random() * CITY.intersections.length)];
  return { x: p.x + (Math.random() < 0.5 ? -24 : 24), y: p.y + (Math.random() < 0.5 ? -24 : 24) };
}
export function startTaxi(forMission) {
  const p = farePoint();
  G.taxi = { x: p.x, y: p.y, picked: false, timer: 90, mission: !!forMission };
  say(forMission ? 'Taxi fare: pick up the passenger' : 'Taxi fare started — pick up the passenger');
}
function updateTaxi(dt) {
  const t = G.taxi;
  t.timer -= dt;
  if (t.timer <= 0) {
    say('Fare cancelled — too slow');
    if (G.mission.active && MISSIONS[G.mission.idx].stages[G.mission.stage].k === 'taxi') {
      G.mission.active = false; G.taxi = null;
      say('Mission failed — the fares ran out of time');
      return;
    }
    G.taxi = null; return;
  }
  if (Math.hypot(G.x - t.x, G.y - t.y) < 42) {
    if (!t.picked) {
      t.picked = true;
      const d = farePoint();
      t.x = d.x; t.y = d.y; t.timer = 100;
      say('Passenger in — drive to the marker');
      sfx('pickup');
    } else {
      const pay = 40 + Math.floor(Math.random() * 40);
      G.cash += pay; G.stats.earned += pay; G.stats.fares++;
      floatText(G.x, G.y - 20, `FARE +$${pay}`, '#58d68d');
      sfx('pickup');
      if (t.mission) {
        G.mission.fares++;
        if (G.mission.fares >= MISSIONS[G.mission.idx].stages[G.mission.stage].n) {
          G.taxi = null; advanceStage(); return;
        }
      }
      startTaxi(t.mission);
    }
  }
}
// --- vigilante -----------------------------------------------------------------
function startVig() {
  const p = CITY.intersections[Math.floor(Math.random() * CITY.intersections.length)];
  const c = makeCar(0, p.x, p.y, 0, 'target');
  c.color = '#2c3e50'; c.max = 380;
  G.cars.push(c);
  G.vig = { target: c };
  say('Vigilante: ram the getaway car until it stops');
}
function updateVig() {
  const t = G.vig.target;
  if (!t || t.hp <= 0) {
    if (t) {
      G.cash += 150; G.stats.earned += 150; G.stats.vig++;
      floatText(t.x, t.y - 20, 'VIGILANTE +$150', '#58d68d');
      say('Getaway car stopped (+$150)');
      sfx('pickup');
    }
    G.vig = null;
  }
}
// --- F key: start a side job from a suitable car --------------------------------
export function sideJob() {
  if (G.onFoot || !G.car) return;
  if (G.car.type === 2 && !G.taxi) { startTaxi(false); return; }
  if (G.car.driver === 'player' && G.car.color === '#1f6feb' && !G.vig) { startVig(); return; }
}
// --- E key on foot: shops and mission start --------------------------------------
export function interact() {
  const near = (s) => Math.hypot(G.x - s.x, G.y - s.y) < 60;
  if (near(S.garage) && !G.mission.active && G.mission.idx < MISSIONS.length) {
    startMission(G.mission.idx); return;
  }
  if (near(S.ammo)) {
    if (!G.hasPistol && G.cash >= 100) { G.cash -= 100; G.hasPistol = true; G.ammo = 24; G.weapon = 1; say('Pistol bought ($100) — press 2 to draw it'); sfx('pickup'); }
    else if (G.hasPistol && G.cash >= 20) { G.cash -= 20; G.ammo += 12; say('Ammo +12 ($20)'); sfx('pickup'); }
    else say(G.hasPistol ? 'Need $20 for ammo' : 'Pistol costs $100');
    return;
  }
  if (near(S.hospital)) {
    if (G.cash >= 20 && G.health < 100) { G.cash -= 20; G.health = 100; say('Patched up ($20)'); sfx('pickup'); }
    else if (G.health >= 100) say('You are already healthy');
    else say('Need $20 for treatment');
    return;
  }
  if (near(S.safe)) {
    G.health = 100; saveGame(); say('Safehouse — healed and saved'); sfx('pickup'); return;
  }
  if (near(S.showroom)) {
    if (G.cash >= 500) {
      G.cash -= 500;
      const c = makeCar(5, S.showroom.x + 40, S.showroom.y + 40, 0, 'none');
      G.cars.push(c);
      say('Sports car bought ($500) — it is parked by the showroom'); sfx('pickup');
    } else say('Sports car costs $500');
    return;
  }
}
// Pay N Spray: drive through the marker and the heat is gone, for $50.
function updateSpray(dt) {
  if (!G.onFoot && G.car && G.stars > 0 && G.cash >= 50) {
    if (Math.hypot(G.x - S.spray.x, G.y - S.spray.y) < 46) {
      G.cash -= 50; G.heat = 0; G.stars = 0;
      say('Pay N Spray — clean ($50)');
      sfx('pickup');
    }
  }
}
export function updateMissions(dt) {
  if (G.dlg) return;
  updateSpray(dt);
  if (G.taxi) updateTaxi(dt);
  if (G.vig) updateVig();
  if (!G.mission.active) return;
  const m = MISSIONS[G.mission.idx];
  const st = m.stages[G.mission.stage];
  if (!st) return;
  if (st.k === 'go' && Math.hypot(G.x - st.x, G.y - st.y) < 44) advanceStage();
  else if (st.k === 'car' && !G.onFoot) advanceStage();
  else if (st.k === 'deliver' && !G.onFoot && Math.hypot(G.x - st.x, G.y - st.y) < 48) advanceStage();
  else if (st.k === 'ram') {
    const t = G.mission.target;
    if (t && t.hp <= 0) { G.mission.target = null; advanceStage(); }
    else if (t && Math.hypot(t.x - G.x, t.y - G.y) > 700) { // target escaped too far: respawn it closer
      const p = CITY.intersections[Math.floor(Math.random() * CITY.intersections.length)];
      t.x = p.x; t.y = p.y;
    }
  }
  else if (st.k === 'survive') {
    if (G.stars < st.stars) G.heat = Math.max(G.heat, 66);
    G.mission.timer -= dt;
    if (G.mission.timer <= 0) advanceStage();
  }
  else if (st.k === 'hold') {
    if (Math.hypot(G.x - st.x, G.y - st.y) < 90) {
      G.mission.timer += dt;
      G.heat = Math.max(G.heat, 46);
      if (G.mission.timer >= st.t) advanceStage();
    }
  }
  else if (st.k === 'taxi') {
    G.mission.timer -= dt;
    if (G.mission.timer <= 0) { G.mission.active = false; G.taxi = null; say('Mission failed — out of time'); }
  }
  else if (st.k === 'reach' && Math.hypot(G.x - st.x, G.y - st.y) < 48 && G.stars >= st.stars) advanceStage();
}
