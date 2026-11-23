// Palma Verde — boot, game loop and mode machine. Title, play, pause,
// dialogue, busted and wasted; the camera follows the player and the
// day/night clock runs while playing (frozen in screenshot mode).
import { G, clamp } from './state.js';
import { W, H, DAY_LEN } from './config.js';
import { CITY } from './city.js';
import { initInput, pressed, endFrame, mouse } from './input.js';
import { updatePlayer } from './player.js';
import { updateVehicles, spawnTraffic, spawnParked } from './vehicles.js';
import { updatePeds, spawnPeds } from './pedestrians.js';
import { updateWanted, updatePolice, wasted, respawn } from './police.js';
import { updateMissions, sideJob, openDialogue } from './missions.js';
import { updateParts } from './particles.js';
import { drawWorld } from './render.js';
import { drawHUD, drawTitle, drawPause, drawEndCard } from './hud.js';
import { ensureAudio, setStation, toggleMute, sfx } from './audio.js';
import { saveGame, loadGame, applySave, hasSave, wipeSave } from './save.js';
import { applyShot } from './shots.js';

const VW = 1280, VH = 800;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
// Debug handle for automated tests (state inspection only).
window.PV = { G };

G.packages = CITY.packages;

function resetWorld() {
  G.cars = []; G.peds = []; G.cops = []; G.parts = []; G.texts = [];
  G.roadblocks = []; G.heli = null; G.taxi = null; G.vig = null; G.dlg = null;
  G.heat = 0; G.stars = 0;
  spawnTraffic(14); spawnParked(10); spawnPeds(20);
}
function newGame() {
  wipeSave();
  G.cash = 40; G.health = 100; G.ammo = 0; G.hasPistol = false; G.weapon = 0;
  G.mission = { idx: 0, active: false, stage: 0, timer: 0, target: null, fares: 0, hits: 0, zone: null };
  G.time = 10; G.day = 1;
  G.x = CITY.shops.garage.x; G.y = CITY.shops.garage.y + 44; G.a = -Math.PI / 2;
  G.onFoot = true; G.car = null; G.speed = 0;
  G.stats = { earned: 0, busted: 0, wasted: 0, fares: 0, jumps: 0, pkgs: 0, vig: 0 };
  for (const p of G.packages) p.taken = false;
  resetWorld();
  G.mode = 'play';
  openDialogue('Delia', ['Milo Vane. New in town, forty bucks, no car.', 'My garage is home base. Come see me when you want work.'], null);
}
function continueGame() {
  const s = loadGame();
  if (!s) { newGame(); return; }
  applySave(s);
  resetWorld();
  G.onFoot = true; G.car = null;
  G.mode = 'play';
}
function updateCamera() {
  G.cam.x = clamp(G.x - VW / 2, 0, W - VW);
  G.cam.y = clamp(G.y - VH / 2, 0, H - VH);
}
function advanceDialogue() {
  const d = G.dlg;
  if (!d) return;
  d.i++;
  if (d.i >= d.lines.length) {
    const done = d.done;
    G.dlg = null;
    if (done) done();
  }
}

initInput(canvas);
addEventListener('keydown', ensureAudio, { once: false });
addEventListener('mousedown', ensureAudio, { once: false });
resetWorld();

// screenshot mode: ?shot=cover|street|mission|night
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  applyShot(shot);
} else {
  G.time = 17.5; // golden-hour backdrop behind the title
  G.cam.x = W / 2 - VW / 2; G.cam.y = H / 2 - VH / 2;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.elapsed += dt;
  if (G.toastT > 0) G.toastT -= dt;
  if (G.msgT > 0) G.msgT -= dt;

  if (G.mode === 'title') {
    updateVehicles(dt, G.elapsed);
    updatePeds(dt);
    if (pressed('Enter')) newGame();
    else if (pressed('KeyC') && hasSave()) continueGame();
  } else if (G.mode === 'play') {
    if (G.dlg) {
      if (pressed('KeyE', 'Enter') || mouse.clicked) advanceDialogue();
    } else if (!G.shot) {
      // Shot mode freezes the scene: the placed cars, cops and dialogue
      // are the photograph, so no update runs (no driving off, no rams,
      // no toasts). Only the camera and the ambient clock move.
      G.time += (dt * 24) / DAY_LEN;
      if (G.time >= 24) { G.time -= 24; G.day++; }
      if (pressed('Escape')) G.mode = 'pause';
      if (pressed('KeyR')) { setStation(G.radio + 1); }
      if (pressed('KeyM')) toggleMute();
      if (pressed('KeyH') && !G.onFoot) sfx('horn');
      if (pressed('KeyF')) sideJob();
      updatePlayer(dt);
      updateVehicles(dt, G.elapsed);
      updatePeds(dt);
      updateWanted(dt);
      updatePolice(dt);
      updateMissions(dt);
      updateParts(dt);
      if (G.stars === 0 && G.health < 100) G.health = Math.min(100, G.health + 2 * dt);
      if (G.health <= 0) wasted();
      G.saveT += dt;
      if (!G.shot && G.saveT > 30) { G.saveT = 0; saveGame(); }
    }
    updateCamera();
  } else if (G.mode === 'pause') {
    if (pressed('Escape', 'Enter')) G.mode = 'play';
  } else if (G.mode === 'busted' || G.mode === 'wasted') {
    if (pressed('Enter')) respawn(G.respawnAt);
  }

  drawWorld(ctx, VW, VH);
  if (G.mode === 'title') drawTitle(ctx);
  else if (G.mode === 'pause') { drawHUD(ctx); drawPause(ctx); }
  else if (G.mode === 'busted') drawEndCard(ctx, 'busted');
  else if (G.mode === 'wasted') drawEndCard(ctx, 'wasted');
  else drawHUD(ctx);
  endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
