// Palma Verde — entry point. Owns the game state, the loop, the camera,
// the mode machine (title / play / pause / busted / wasted), the
// contextual prompts, and the save timer. Systems live in their own files.

import { WORLD, DAY, ECONOMY } from './config.js';
import { buildCity, CITY_W, CITY_H, BEACH_X, randomSidewalkPoint } from './city.js';
import { mulberry32, range, clamp, dist } from './random.js';
import { createInput } from './input.js';
import { createParticles, updateParticles, addFloat } from './particles.js';
import { createAudio } from './audio.js';
import { createUI, drawHUD, drawDialogue, drawTitle, drawPause, drawEndCard, drawStoryComplete } from './hud.js';
import { drawWorld } from './render.js';
import { makePlayer, updatePlayerOnFoot, exitCar, shopAction } from './player.js';
import { drivePlayerCar, updateTrafficCar, maintainTraffic, spawnTraffic, spawnParked, makeCar } from './vehicles.js';
import { spawnPeds, updatePeds, maintainPeds } from './pedestrians.js';
import { updatePolice, maybeRoadblock } from './police.js';
import { startMission, updateMissions, missionLabel, missionMarker, updateVigilante, startVigilante, startFare, updateFare, updateMissionTarget, MISSION_DEFS } from './missions.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const shotSeed = parseInt(params.get('seed') || '7', 10);

function resize() {
  canvas.width = Math.floor(window.innerWidth * window.devicePixelRatio);
  canvas.height = Math.floor(window.innerHeight * window.devicePixelRatio);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
}
window.addEventListener('resize', resize);
resize();

const G = {
  ctx,
  view: { w: window.innerWidth, h: window.innerHeight },
  camera: { x: 0, y: 0, zoom: 1 },
  input: createInput(canvas),
  audio: createAudio(),
  particles: createParticles(),
  city: buildCity(20261123),
  timeSec: 0,
  clock: DAY.startMinutes,
  mode: 'title',
  modeTimer: 0,
  playTime: 0,
  wanted: 0,
  heat: 0,
  player: null,
  cars: [],
  peds: [],
  cops: [],
  packages: [],
  heli: { active: false, x: 0, y: 0, angle: 0, spotX: 0, spotY: 0 },
  mission: null,
  nextMission: 0,
  taxi: null,
  vigilante: null,
  flags: { missionsDone: 0, packages: 0, stunts: 0, storyDone: false },
  groundPatches: [],
  tracer: null,
  roadblockTimer: 10,
  saveTimer: 0,
  shotMode: null,
  light: { dark: 0, tint: '#fff', sun: { x: 0.7, y: 1 } },
  missionLabel: null,
  missionMarker: null,
  titleButtons: [],
  storyShown: false,
  ui: null,
};
G.ui = createUI(G);
window.__game = G; // for play-testing from the console

// Grass variation patches (seeded, decorative).
{
  const rng = mulberry32(99);
  for (let i = 0; i < 70; i++) {
    G.groundPatches.push({
      x: range(rng, 0, CITY_W),
      y: range(rng, 0, CITY_H),
      w: range(rng, 60, 220),
      h: range(rng, 40, 140),
    });
  }
}

function placePackages() {
  const rng = mulberry32(777);
  const spots = [];
  // A few hand-placed, the rest scattered on sidewalks, park and beach.
  const fixed = [
    { x: 220, y: 220 }, { x: 3900, y: 300 }, { x: 4400, y: 900 },
    { x: 4400, y: 2400 }, { x: 900, y: 3300 }, { x: 2100, y: 2100 },
    { x: 3100, y: 1200 }, { x: 600, y: 2600 },
  ];
  for (const f of fixed) spots.push(f);
  while (spots.length < ECONOMY.packageCount) {
    const p = randomSidewalkPoint(rng);
    if (dist(p.x, p.y, 2000, 1700) < 200) continue;
    spots.push({ x: p.x, y: p.y });
  }
  G.packages = spots.slice(0, ECONOMY.packageCount).map((s, i) => ({ id: i, x: s.x, y: s.y, taken: false }));
}

function newGame() {
  G.player = makePlayer(G.city.spots.safehouse.x + 80, G.city.spots.safehouse.y + 40);
  G.cars = [];
  G.peds = [];
  G.cops = [];
  G.wanted = 0;
  G.heat = 0;
  G.mission = null;
  G.nextMission = 0;
  G.taxi = null;
  G.vigilante = null;
  G.flags = { missionsDone: 0, packages: 0, stunts: 0, storyDone: false };
  G.clock = DAY.startMinutes;
  G.timeSec = 0;
  G.playTime = 0;
  G.storyShown = false;
  placePackages();
  spawnTraffic(G, 14);
  spawnParked(G, 12);
  spawnPeds(G, 24);
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  G.mode = 'play';
  G.ui.message('Welcome to Palma Verde. Head to Delia\u2019s Garage to start.', '#ffd94a', 5);
}

function continueGame() {
  const data = loadGame();
  if (!data) {
    newGame();
    return;
  }
  newGame();
  const p = G.player;
  p.cash = data.cash;
  p.health = data.health;
  p.armor = data.armor;
  p.weapon = data.weapon;
  p.ammo = data.ammo;
  p.x = data.x;
  p.y = data.y;
  G.clock = data.clock;
  G.flags.missionsDone = data.missionsDone;
  G.nextMission = Math.min(data.nextMission, MISSION_DEFS.length - 1);
  G.flags.packages = data.packages;
  G.flags.stunts = data.stunts;
  G.flags.storyDone = data.storyDone;
  for (const id of data.packagesTaken || []) {
    const pkg = G.packages[id];
    if (pkg) pkg.taken = true;
  }
  G.camera.x = p.x;
  G.camera.y = p.y;
  G.mode = 'play';
  G.ui.message('Welcome back, Milo.', '#ffd94a', 3);
}

function buildTitleButtons() {
  const view = G.view;
  const w = 260;
  const h = 48;
  const x = view.w / 2 - w / 2;
  const labels = hasSave() ? ['Continue', 'New Game'] : ['New Game', 'How to Play'];
  G.titleButtons = labels.map((label, i) => ({
    label,
    x, y: view.h * 0.52 + i * 62, w, h,
    hover: false,
    action: label === 'Continue' ? 'continue' : label === 'New Game' ? 'new' : 'howto',
  }));
}
buildTitleButtons();
window.addEventListener('resize', () => {
  G.view.w = window.innerWidth;
  G.view.h = window.innerHeight;
  buildTitleButtons();
});

// --- Mode transitions -------------------------------------------------------

function applyPenalty() {
  const p = G.player;
  const lost = Math.floor(p.cash * 0.1);
  p.cash -= lost;
  p.health = 100;
  p.armor = Math.max(0, p.armor - 50);
  if (p.car) {
    p.car.driver = 'parked';
    p.car = null;
  }
  // Wake up at the hospital.
  p.x = G.city.spots.hospital.x + 40;
  p.y = G.city.spots.hospital.y + 40;
  p.weapon = p.weapon; // keep the gun
  G.wanted = 0;
  G.heat = 0;
  G.cops.length = 0;
  G.heli.active = false;
  return lost;
}

// --- Prompts -----------------------------------------------------------------

function computePrompt() {
  const p = G.player;
  const ui = G.ui;
  ui.prompt = '';
  ui.promptKey = '';
  if (G.mode !== 'play' || ui.dialogue) return;
  const spots = G.city.spots;
  const near = (s, r) => dist(p.x, p.y, s.x, s.y) < r;
  if (!p.car) {
    // Near a car?
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
    if (best) {
      ui.prompt = `E — Get in the ${best.label}`;
      ui.promptKey = 'car';
      return;
    }
    if (near(spots.garage, 90) && G.nextMission < MISSION_DEFS.length && (!G.mission || G.mission.state !== 'active')) {
      const def = MISSION_DEFS[G.nextMission];
      ui.prompt = `E — Start mission: ${def.title} ($${def.reward})`;
      ui.promptKey = 'mission';
      return;
    }
    if (near(spots.ammu, 70)) {
      ui.prompt = p.weapon === 'pistol' ? 'E — Ammu-Nation: ammo $60 / armor $250' : 'E — Ammu-Nation: pistol $300';
      ui.promptKey = 'ammu';
      return;
    }
    if (near(spots.hospital, 70)) {
      ui.prompt = 'E — Hospital: treatment $80';
      ui.promptKey = 'heal';
      return;
    }
    if (near(spots.spray, 70) && G.wanted > 0) {
      ui.prompt = 'E — Pay N Spray: lose the heat $100';
      ui.promptKey = 'spray';
      return;
    }
    if (near(spots.showroom, 80)) {
      ui.prompt = 'E — Showroom: buy a Sports car $5,200';
      ui.promptKey = 'showroom';
      return;
    }
    if (near(spots.plaza, 80) && !G.vigilante && G.wanted === 0) {
      ui.prompt = 'E — Vigilante work: stop a criminal (+$220)';
      ui.promptKey = 'vigilante';
      return;
    }
    if (near(spots.safehouse, 80)) {
      ui.prompt = 'Safehouse — health restores here';
      ui.promptKey = 'safehouse';
      return;
    }
  } else {
    if (p.car.type === 'taxi' && !G.taxi && (!G.mission || G.mission.state !== 'active')) {
      ui.prompt = 'Driving a taxi — fares will find you. (E to start a shift)';
      ui.promptKey = 'taxi';
      return;
    }
  }
}

function usePrompt() {
  const key = G.ui.promptKey;
  const p = G.player;
  if (!key) return;
  if (key === 'mission') {
    if (G.mission && G.mission.state === 'failed') {
      // Retry the failed mission.
      startMission(G, G.mission.index);
    } else {
      startMission(G, G.nextMission);
    }
  } else if (key === 'ammu') {
    shopAction(G, 'gun');
  } else if (key === 'heal') {
    shopAction(G, 'heal');
  } else if (key === 'spray') {
    shopAction(G, 'spray');
  } else if (key === 'vigilante') {
    startVigilante(G);
  } else if (key === 'taxi') {
    startFare(G);
  } else if (key === 'showroom') {
    if (p.cash >= 5200) {
      p.cash -= 5200;
      const car = makeCar('sports', p.car.x + 90, p.car.y + 40, 0, 'parked');
      car.color = '#e8e83a';
      G.cars.push(car);
      G.audio.sfx('cash');
      G.ui.message('Sports car bought! It is parked beside you.', '#ffd94a', 3);
    } else {
      G.ui.message('Not enough cash for a Sports car ($5,200).', '#ff5a5a', 2);
    }
  }
}

// --- Update -------------------------------------------------------------------

function update(dt) {
  G.timeSec += dt;
  G.clock = (G.clock + dt * DAY.minutesPerSecond) % 1440;

  if (G.mode === 'title') {
    updateTitle();
    return;
  }
  if (G.mode === 'pause') {
    if (G.input.wasPressed('pause')) G.mode = 'play';
    return;
  }
  if (G.mode === 'busted' || G.mode === 'wasted') {
    G.modeTimer += dt;
    if (G.input.wasPressed('enter') && G.modeTimer > 0.8) {
      applyPenalty();
      G.mode = 'play';
    }
    return;
  }
  if (G.mode === 'story') {
    if (G.input.wasPressed('enter')) {
      G.mode = 'play';
      G.storyShown = true;
    }
    return;
  }

  // --- play mode ---
  G.playTime += dt;
  const input = G.input;
  const p = G.player;

  // Global keys.
  if (input.wasPressed('pause')) {
    G.mode = 'pause';
    G.audio.setEngine(0, false);
    return;
  }
  if (input.wasPressed('mute')) {
    G.audio.setMuted(!G.audio.muted);
    G.ui.message(G.audio.muted ? 'Muted' : 'Sound on', '#ffffff', 1.2);
  }
  if (input.wasPressed('radio')) {
    G.audio.station = (G.audio.station + 1) % 3;
    G.audio.step = 0;
    G.ui.message('Radio: ' + ['VICE FM', 'CALLE 8', 'PALMA LO-FI'][G.audio.station], '#ffffff', 1.5);
  }
  if (input.wasPressedCode('Digit1')) {
    p.weapon = 'fists';
    G.ui.message('Fists', '#ffffff', 1);
  }
  if (input.wasPressedCode('Digit2') && p.ammo > 0) {
    p.weapon = 'pistol';
    G.ui.message('Pistol', '#ffffff', 1);
  }
  if (input.wasPressedCode('KeyH') && p.car) G.audio.sfx('horn');

  // Dialogue takes over input.
  if (G.ui.dialogue) {
    if (input.wasPressed('enter') || input.mouse.clicked) {
      const finished = G.ui.advanceDialogue();
      if (finished) {
        const m = G.mission;
        if (m && m.state === 'intro') {
          m.state = 'active';
          const step = m.def.steps[0];
          m.timer = step.time || 0;
          // Set the first objective marker.
          if (step.at) {
            const spot = step.at(G.city.spots);
            m.marker = { x: spot.x, y: spot.y, label: step.label };
          } else {
            m.marker = null;
          }
          G.ui.message(step.label, '#ffd94a', 2.5);
        } else if (m && m.state === 'done') {
          G.nextMission = Math.min(m.index + 1, MISSION_DEFS.length - 1);
          G.mission = null;
          saveGame(G);
          if (G.flags.storyDone && !G.storyShown) {
            G.mode = 'story';
          }
        }
      }
    }
    updateWorld(dt, true);
    return;
  }

  // Interaction key.
  if (input.wasPressed('enter')) {
    if (p.car) {
      exitCar(G);
      input.consume('enter');
    } else if (G.ui.promptKey && G.ui.promptKey !== 'car') {
      // A shop / mission / side-job prompt: handle it here and swallow the
      // press, so the same E does not also open a car door below.
      usePrompt();
      input.consume('enter');
    }
    // promptKey 'car' falls through: updatePlayerOnFoot enters the car.
  }

  updateWorld(dt, false);

  // Contextual prompt.
  computePrompt();

  // Safehouse: heal over time.
  if (!p.car && dist(p.x, p.y, G.city.spots.safehouse.x, G.city.spots.safehouse.y) < 90) {
    p.health = Math.min(100, p.health + 6 * dt);
  }

  // Stunt landing: reward the first three big jumps.
  if (p.car) {
    const wasAir = p.car._wasAir || 0;
    if (wasAir > 0.45 && p.car.airTime <= 0) {
      const n = G.flags.stunts;
      if (n <= 3) {
        p.cash += 180;
        addFloat(G.particles, p.x, p.y - 30, '+$180  STUNT JUMP!', '#ffd94a');
        G.audio.sfx('cash');
      }
    }
    p.car._wasAir = p.car.airTime > 0 ? Math.max(wasAir, p.car.airTime) : 0;
  }

  // Auto-save.
  G.saveTimer += dt;
  if (G.saveTimer > 20) {
    G.saveTimer = 0;
    saveGame(G);
  }

  // Story complete overlay.
  if (G.flags.storyDone && !G.storyShown && G.mode === 'play' && !G.mission) {
    G.mode = 'story';
  }

  // Camera.
  updateCamera(dt);

  // Audio: engine + music.
  G.audio.ensure();
  if (p.car) G.audio.setEngine(Math.abs(p.car.speed) / p.car.top, true);
  else G.audio.setEngine(0, false);
  G.audio.update(dt);

  // HUD values for hud.js.
  G.missionLabel = missionLabel(G);
  G.missionMarker = missionMarker(G);

  if (G.ui.messageTimer > 0) G.ui.messageTimer -= dt;
  if (G.tracer) G.tracer.life -= dt;
}

function updateWorld(dt, paused) {
  const p = G.player;
  if (!paused) {
    if (p.car) drivePlayerCar(G, p.car, G.input, dt);
    else updatePlayerOnFoot(G, G.input, dt);
    for (const car of G.cars) {
      if (car.driver === 'traffic') updateTrafficCar(G, car, dt);
      else if (car.driver === 'mission' || car.missionTarget) updateMissionTarget(G, car, dt);
    }
    updatePeds(G, dt);
    updatePolice(G, dt);
    maybeRoadblock(G, dt);
    updateMissions(G, dt, G.input);
    updateVigilante(G, dt);
    // Taxi side job (standalone, when no story mission is active).
    if (G.taxi && (!G.mission || G.mission.state !== 'active')) updateFare(G, dt);
    maintainTraffic(G, dt);
    maintainPeds(G);
  }
  updateParticles(G.particles, dt);
}

function updateTitle() {
  const input = G.input;
  const mx = input.mouse.x;
  const my = input.mouse.y;
  for (const b of G.titleButtons) {
    b.hover = mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
  }
  if (input.mouse.clicked) {
    for (const b of G.titleButtons) {
      if (b.hover) {
        G.audio.ensure();
        G.audio.sfx('click');
        if (b.action === 'continue') continueGame();
        else if (b.action === 'new') {
          clearSave();
          newGame();
        } else if (b.action === 'howto') {
          G.ui.showDialogue([
            'Milo: WASD to move and drive. E gets you in a car.',
            'Milo: SPACE punches on foot and handbrakes in a car. 1 and 2 switch weapons.',
            'Milo: Missions start at Delia\u2019s Garage. Steal cars, lose the cops, get rich.',
          ], 'Milo');
          G.mode = 'howto';
        }
        break;
      }
    }
  }
  if (input.wasPressed('enter')) {
    if (hasSave()) continueGame();
    else {
      clearSave();
      newGame();
    }
  }
}

function updateCamera(dt) {
  const p = G.player;
  const speed = p.car ? Math.abs(p.car.speed) : 0;
  const targetZoom = p.car ? clamp(0.92 - speed / 2400, 0.72, 0.92) : 1.15;
  G.camera.zoom += (targetZoom - G.camera.zoom) * Math.min(1, dt * 2);
  const lookX = p.car ? Math.cos(p.car.angle) * Math.min(90, speed * 0.16) : 0;
  const lookY = p.car ? Math.sin(p.car.angle) * Math.min(90, speed * 0.16) : 0;
  const tx = p.x + lookX;
  const ty = p.y + lookY;
  const k = Math.min(1, dt * 4);
  G.camera.x += (tx - G.camera.x) * k;
  G.camera.y += (ty - G.camera.y) * k;
}

// --- Render -------------------------------------------------------------------

function render() {
  const view = G.view;
  G.view.w = window.innerWidth;
  G.view.h = window.innerHeight;
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  if (G.mode === 'title' || G.mode === 'howto') {
    // Animated backdrop: the city at sunset behind the menu.
    drawWorld(G);
    drawTitle(G);
    if (G.mode === 'howto' && G.ui.dialogue) {
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
      drawDialogue(G, ctx);
    }
    return;
  }
  drawWorld(G);
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  drawHUD(G);
  if (G.mode === 'pause') drawPause(G);
  if (G.mode === 'busted' || G.mode === 'wasted') drawEndCard(G);
  if (G.mode === 'story') drawStoryComplete(G);
  // Screen-reader status line.
  const label = G.missionLabel;
  statusEl.textContent = G.mode === 'play'
    ? `Palma Verde. Cash ${Math.floor(G.player.cash)} dollars. Wanted ${G.wanted} stars. ${label || 'No active mission.'}`
    : 'Palma Verde title screen.';
}

// --- Boot ---------------------------------------------------------------------

function boot() {
  // A world exists behind the title screen.
  newGame();
  G.mode = 'title';
  G.camera.x = 2100;
  G.camera.y = 1700;
  G.clock = 17 * 60 + 50; // sunset behind the title
  // Screenshot staging happens before the first frame.
  if (shotName) {
    newGame();
    G.mode = 'play';
    applyShot(G, shotName, shotSeed);
    G.camera.zoom = 0.9;
  }
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      if (G.mode === 'howto') {
        // Dialogue-only mode on top of the title backdrop.
        if (G.input.wasPressed('enter') || G.input.mouse.clicked) {
          if (G.ui.advanceDialogue()) {
            G.mode = 'title';
            G.ui.dialogue = null;
          }
        }
        G.input.endFrame();
        render();
        requestAnimationFrame(frame);
        return;
      }
      update(dt);
      render();
    } catch (err) {
      // One bad frame must never freeze the game: log it and keep going.
      console.error('Palma Verde frame error:', err);
    }
    G.input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
