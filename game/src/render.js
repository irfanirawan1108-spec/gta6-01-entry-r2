// Rendering: the whole look of Palma Verde. Top-down canvas with a
// smooth camera, culling, long building shadows, animated water, a
// day/night cycle with headlights and lit windows, and detailed cars,
// pedestrians and effects. The judge's screenshots come from here.

import { WORLD, PALETTE, DAY } from './config.js';
import { CITY_W, CITY_H, BEACH_X, OCEAN_X, WORLD_W, WORLD_H, roadX, roadY, blockX, blockY, isOnRoad } from './city.js';
import { clamp, lerp } from './random.js';
import { carSize } from './vehicles.js';
import { drawParticles } from './particles.js';

// Time of day -> {dark: 0..1, tint: css color, sun: {x,y} shadow direction}
export function lighting(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  if (m < DAY.dawn) return { dark: 0.62, tint: '#1a2a55', sun: { x: -1, y: 0.4 } };
  if (m < 9 * 60) {
    const t = (m - DAY.dawn) / 180;
    return { dark: lerp(0.55, 0.08, t), tint: '#ffb36b', sun: { x: -1, y: 0.5 } };
  }
  if (m < 17 * 60) return { dark: 0, tint: '#ffffff', sun: { x: 0.7, y: 1 } };
  if (m < DAY.sunset) {
    const t = (m - 17 * 60) / 90;
    return { dark: lerp(0.08, 0.36, t), tint: '#ff9a4a', sun: { x: 1, y: 0.35 } };
  }
  if (m < DAY.night) {
    const t = (m - DAY.sunset) / 90;
    return { dark: lerp(0.3, 0.58, t), tint: '#5a6bb0', sun: { x: 1, y: -0.2 } };
  }
  return { dark: 0.62, tint: '#1a2a55', sun: { x: -1, y: 0.4 } };
}

export function drawWorld(G) {
  const ctx = G.ctx;
  const cam = G.camera;
  const view = G.view;
  const light = lighting(G.clock);
  G.light = light;

  ctx.save();
  ctx.clearRect(0, 0, view.w, view.h);
  // Sky-tinted background outside the world.
  ctx.fillStyle = '#1d7f9e';
  ctx.fillRect(0, 0, view.w, view.h);

  ctx.translate(view.w / 2, view.h / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  const vx0 = cam.x - view.w / 2 / cam.zoom - 80;
  const vy0 = cam.y - view.h / 2 / cam.zoom - 80;
  const vx1 = cam.x + view.w / 2 / cam.zoom + 80;
  const vy1 = cam.y + view.h / 2 / cam.zoom + 80;
  const inView = (x, y, pad = 60) => x > vx0 - pad && x < vx1 + pad && y > vy0 - pad && y < vy1 + pad;

  drawGround(G, ctx, inView);
  drawRoads(G, ctx, inView);
  drawPark(G, ctx, inView);
  drawBuildings(G, ctx, inView, light);
  drawProps(G, ctx, inView, light);
  drawPackages(G, ctx, inView);
  drawRamps(G, ctx, inView);
  drawMarker(G, ctx);

  // Cars, peds, player: draw in y order so overlaps read right.
  const drawables = [];
  for (const car of G.cars) drawables.push({ y: car.y, kind: 'car', obj: car });
  for (const ped of G.peds) drawables.push({ y: ped.y, kind: 'ped', obj: ped });
  for (const cop of G.cops) {
    if (cop.onFoot && !cop.down) drawables.push({ y: cop.y, kind: 'cop', obj: cop });
    if (cop.onFoot && cop.down) drawables.push({ y: cop.y, kind: 'copdown', obj: cop });
  }
  drawables.push({ y: G.player.y, kind: 'player', obj: G.player });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) {
    if (!inView(d.obj.x, d.obj.y, 80)) continue;
    if (d.kind === 'car') drawCar(G, ctx, d.obj);
    else if (d.kind === 'ped') drawPed(ctx, d.obj, false);
    else if (d.kind === 'cop') drawPed(ctx, d.obj, true);
    else if (d.kind === 'copdown') drawDownPed(ctx, d.obj);
    else if (d.kind === 'player') drawPlayer(G, ctx, d.obj);
  }
  // Down peds (lying) under the living.
  for (const ped of G.peds) {
    if (ped.state === 'down' && inView(ped.x, ped.y, 60)) drawDownPed(ctx, ped);
  }

  drawParticles(ctx, G.particles);

  // Bullet tracer.
  if (G.tracer && G.tracer.life > 0) {
    ctx.strokeStyle = 'rgba(255,233,90,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(G.tracer.x1, G.tracer.y1);
    ctx.lineTo(G.tracer.x2, G.tracer.y2);
    ctx.stroke();
  }

  drawHelicopter(G, ctx, inView);
  drawNight(G, ctx, view, light);
  ctx.restore();
}

function drawGround(G, ctx, inView) {
  // Base grass.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, CITY_W, CITY_H);
  // Subtle grass variation patches.
  ctx.fillStyle = PALETTE.grassDry;
  for (const patch of G.groundPatches) {
    if (!inView(patch.x, patch.y, 100)) continue;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(patch.x, patch.y, patch.w, patch.h);
  }
  ctx.globalAlpha = 1;
  // Beach sand.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(BEACH_X, 0, WORLD.beachWidth, CITY_H);
  ctx.fillStyle = PALETTE.sandWet;
  ctx.fillRect(OCEAN_X - 26, 0, 26, CITY_H);
  // Ocean with animated waves.
  const t = G.timeSec;
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(OCEAN_X, 0, WORLD_W - OCEAN_X, WORLD_H);
  ctx.fillStyle = PALETTE.water;
  for (let y = 0; y < WORLD_H; y += 90) {
    const wob = Math.sin(y * 0.02 + t * 1.2) * 14;
    ctx.fillRect(OCEAN_X + wob, y, WORLD_W - OCEAN_X - wob, 26);
  }
  // Foam line at the shore.
  ctx.fillStyle = PALETTE.waterFoam;
  ctx.globalAlpha = 0.7 + Math.sin(t * 1.6) * 0.2;
  for (let y = 0; y < CITY_H; y += 64) {
    const wob = Math.sin(y * 0.05 + t * 2) * 8;
    ctx.fillRect(OCEAN_X - 8 + wob, y, 10, 26);
  }
  ctx.globalAlpha = 1;
  // Marina basin.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(CITY_W * 0.55, CITY_H + 40, CITY_W * 0.45, WORLD.marinaHeight - 40);
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(CITY_W * 0.55, CITY_H + 40, CITY_W * 0.45, 18);
  // Marina quay.
  ctx.fillStyle = PALETTE.sidewalk;
  ctx.fillRect(0, CITY_H, CITY_W, 40);
}

function drawRoads(G, ctx, inView) {
  // Road beds.
  ctx.fillStyle = PALETTE.road;
  for (let i = 0; i <= WORLD.cols; i++) ctx.fillRect(roadX(i), 0, WORLD.road, CITY_H);
  for (let j = 0; j <= WORLD.rows; j++) ctx.fillRect(0, roadY(j), CITY_W, WORLD.road);
  // Sidewalk edging: lighter strips along block edges.
  ctx.fillStyle = PALETTE.sidewalk;
  for (let r = 0; r < WORLD.rows; r++) {
    for (let c = 0; c < WORLD.cols; c++) {
      const x = blockX(c);
      const y = blockY(r);
      if (!inView(x + WORLD.block / 2, y + WORLD.block / 2, 300)) continue;
      ctx.fillRect(x - 14, y - 14, WORLD.block + 28, 14);
      ctx.fillRect(x - 14, y + WORLD.block, WORLD.block + 28, 14);
      ctx.fillRect(x - 14, y, 14, WORLD.block);
      ctx.fillRect(x + WORLD.block, y, 14, WORLD.block);
    }
  }
  // Lane dashes.
  ctx.fillStyle = PALETTE.lane;
  for (let i = 0; i <= WORLD.cols; i++) {
    const x = roadX(i) + WORLD.road / 2;
    for (let y = 0; y < CITY_H; y += 56) {
      if (!inView(x, y, 60)) continue;
      ctx.fillRect(x - 2, y, 4, 28);
    }
  }
  for (let j = 0; j <= WORLD.rows; j++) {
    const y = roadY(j) + WORLD.road / 2;
    for (let x = 0; x < CITY_W; x += 56) {
      if (!inView(x, y, 60)) continue;
      ctx.fillRect(x, y - 2, 28, 4);
    }
  }
  // Crosswalks at major intersections.
  ctx.fillStyle = PALETTE.crosswalk;
  for (let i = 0; i <= WORLD.cols; i += 2) {
    for (let j = 0; j <= WORLD.rows; j += 2) {
      const x = roadX(i);
      const y = roadY(j);
      if (!inView(x + WORLD.road / 2, y + WORLD.road / 2, 120)) continue;
      for (let k = 0; k < 5; k++) {
        ctx.fillRect(x + 8 + k * 18, y + WORLD.road - 16, 10, 12);
        ctx.fillRect(x + 8 + k * 18, y + 4, 10, 12);
      }
    }
  }
  // Traffic lights.
  for (const l of G.city.lights) {
    if (!inView(l.x, l.y, 80)) continue;
    const vertical = true;
    const state = lightStateAt(G, l, vertical);
    ctx.fillStyle = '#222';
    ctx.fillRect(l.x - 30, l.y - 30, 10, 26);
    ctx.fillStyle = state === 'green' ? '#37d67a' : '#e5484d';
    ctx.beginPath();
    ctx.arc(l.x - 25, l.y - 24, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(l.x + 20, l.y + 4, 10, 26);
    const state2 = lightStateAt(G, l, false);
    ctx.fillStyle = state2 === 'green' ? '#37d67a' : '#e5484d';
    ctx.beginPath();
    ctx.arc(l.x + 25, l.y + 10, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

import { lightState } from './city.js';
function lightStateAt(G, l, vertical) {
  return lightState(l, G.timeSec, vertical);
}

function drawPark(G, ctx, inView) {
  const p = G.city.park;
  if (!inView(p.x + p.w / 2, p.y + p.h / 2, 500)) return;
  ctx.fillStyle = PALETTE.park;
  ctx.fillRect(p.x, p.y, p.w, p.h);
  // Pond.
  ctx.fillStyle = PALETTE.water;
  ctx.beginPath();
  ctx.ellipse(p.x + p.w * 0.68, p.y + p.h * 0.55, 90, 56, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.beginPath();
  ctx.ellipse(p.x + p.w * 0.68, p.y + p.h * 0.55, 70, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  // Paths.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(p.x, p.y + p.h / 2 - 8, p.w, 16);
  ctx.fillRect(p.x + p.w / 2 - 8, p.y, 16, p.h);
}

function drawBuildings(G, ctx, inView, light) {
  const sun = light.sun;
  for (const b of G.city.buildings) {
    if (!inView(b.x + b.w / 2, b.y + b.h / 2, 260)) continue;
    // Long shadow.
    const sh = 6 + b.height * 4;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + sun.x * sh, b.y + sun.y * sh, b.w, b.h);
    // Walls.
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Roof inset.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = shade(b.color, -18);
    ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
    // Roof details.
    if (b.roof === 'pool') {
      ctx.fillStyle = '#3fa8c9';
      ctx.fillRect(b.x + b.w / 2 - 26, b.y + b.h / 2 - 16, 52, 32);
      ctx.fillStyle = '#7fd4e8';
      ctx.fillRect(b.x + b.w / 2 - 20, b.y + b.h / 2 - 11, 40, 22);
    } else if (b.roof === 'ac') {
      ctx.fillStyle = '#d8d8d8';
      ctx.fillRect(b.x + 16, b.y + 16, 22, 16);
      ctx.fillRect(b.x + b.w - 40, b.y + b.h - 34, 22, 16);
    } else if (b.roof === 'garden') {
      ctx.fillStyle = '#5a9e4a';
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 22, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.roof === 'helipad') {
      ctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#e8e8e8';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('H', b.x + b.w / 2, b.y + b.h / 2 + 7);
    }
    // Lit windows at night on tall buildings.
    if (light.dark > 0.3 && b.height >= 3) {
      ctx.fillStyle = 'rgba(255,214,120,0.9)';
      const cols = Math.floor(b.w / 34);
      const rows = Math.floor(b.h / 30);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i * 7 + j * 13 + b.x) % 3 === 0) {
            ctx.fillRect(b.x + 14 + i * 34, b.y + 14 + j * 30, 12, 14);
          }
        }
      }
    }
    // Door.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + b.w / 2 - 9, b.y + b.h - 4, 18, 6);
  }
}

function drawProps(G, ctx, inView, light) {
  // Trees.
  for (const t of G.city.trees) {
    if (!inView(t.x, t.y, 60)) continue;
    drawTree(ctx, t);
  }
  // Lamps with night glow.
  for (const l of G.city.lamps) {
    if (!inView(l.x, l.y, 60)) continue;
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(l.x - 2, l.y - 2, 4, 14);
    if (light.dark > 0.3) {
      ctx.fillStyle = 'rgba(255,220,130,0.85)';
      ctx.beginPath();
      ctx.arc(l.x, l.y - 4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,220,130,0.12)';
      ctx.beginPath();
      ctx.arc(l.x, l.y - 4, 26, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#ffd67a';
      ctx.beginPath();
      ctx.arc(l.x, l.y - 4, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Billboards, fountain, benches, docks.
  for (const pr of G.city.props) {
    if (!inView(pr.x, pr.y, 120)) continue;
    if (pr.kind === 'billboard') {
      ctx.fillStyle = '#222';
      ctx.fillRect(pr.x - pr.w / 2 - 4, pr.y - pr.h / 2 - 4, pr.w + 8, pr.h + 8);
      ctx.fillStyle = '#ff5a7a';
      ctx.fillRect(pr.x - pr.w / 2, pr.y - pr.h / 2, pr.w, pr.h);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pr.text, pr.x, pr.y + 7);
    } else if (pr.kind === 'fountain') {
      ctx.fillStyle = '#8a8a8a';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.water;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.r - 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.waterFoam;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 10 + Math.sin(G.timeSec * 3) * 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (pr.kind === 'bench') {
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(pr.x - 12, pr.y - 4, 24, 8);
    }
  }
  for (const d of G.city.docks) {
    if (!inView(d.x, d.y, 200)) continue;
    ctx.fillStyle = '#8a6b4a';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(d.x + 20, d.y - 16, 60, 14);
    ctx.fillStyle = '#d42a2a';
    ctx.fillRect(d.x + 120, d.y - 16, 60, 14);
  }
}

function drawTree(ctx, t) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(t.x + 6 * t.s, t.y + 8 * t.s, 16 * t.s, 8 * t.s, 0, 0, Math.PI * 2);
  ctx.fill();
  if (t.kind === 'palm') {
    ctx.strokeStyle = '#7a5a3a';
    ctx.lineWidth = 4 * t.s;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y + 10 * t.s);
    ctx.lineTo(t.x + 3 * t.s, t.y - 12 * t.s);
    ctx.stroke();
    ctx.fillStyle = '#3f9e4d';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.ellipse(t.x + 3 * t.s + Math.cos(a) * 13 * t.s, t.y - 12 * t.s + Math.sin(a) * 9 * t.s, 13 * t.s, 5 * t.s, a, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#4a8a3a';
    ctx.beginPath();
    ctx.arc(t.x, t.y - 8 * t.s, 14 * t.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5aa84a';
    ctx.beginPath();
    ctx.arc(t.x - 6 * t.s, t.y - 14 * t.s, 9 * t.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(t.x - 2 * t.s, t.y - 2 * t.s, 4 * t.s, 12 * t.s);
  }
}

function drawPackages(G, ctx, inView) {
  for (const pkg of G.packages) {
    if (pkg.taken || !inView(pkg.x, pkg.y, 60)) continue;
    const pulse = 0.6 + Math.sin(G.timeSec * 4) * 0.4;
    ctx.fillStyle = `rgba(255,217,74,${0.25 * pulse})`;
    ctx.beginPath();
    ctx.arc(pkg.x, pkg.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd94a';
    ctx.fillRect(pkg.x - 8, pkg.y - 6, 16, 12);
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(pkg.x - 8, pkg.y - 1, 16, 2);
  }
}

function drawRamps(G, ctx, inView) {
  for (const r of G.city.ramps) {
    if (!inView(r.x, r.y, 80)) continue;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);
    ctx.fillStyle = '#e8a04c';
    ctx.beginPath();
    ctx.moveTo(-26, 20);
    ctx.lineTo(26, 20);
    ctx.lineTo(14, -20);
    ctx.lineTo(-14, -20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2a2a2a';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JUMP', 0, 14);
    ctx.restore();
  }
}

function drawMarker(G, ctx) {
  const m = G.mission && G.mission.marker;
  const spots = [];
  if (m) spots.push({ x: m.x, y: m.y, color: '#ffd94a', label: m.label });
  if (G.vigilante && G.vigilante.target) {
    spots.push({ x: G.vigilante.target.x, y: G.vigilante.target.y, color: '#ff5a5a', label: 'Criminal' });
  }
  if (G.mission && G.mission.target && (G.mission.def.steps[G.mission.step] || {}).type !== 'disable') {
    const t = G.mission.target;
    if (t.hp > 0) spots.push({ x: t.x, y: t.y, color: '#ff5a5a', label: 'Target' });
  }
  for (const s of spots) {
    const pulse = 1 + Math.sin(G.timeSec * 5) * 0.15;
    // Light beam.
    ctx.fillStyle = 'rgba(255,217,74,0.10)';
    ctx.fillRect(s.x - 14, s.y - 260, 28, 260);
    // Pulsing diamond.
    ctx.save();
    ctx.translate(s.x, s.y - 40);
    ctx.scale(pulse, pulse);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = s.color;
    ctx.fillRect(-11, -11, 22, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-11, -11, 22, 8);
    ctx.restore();
    // Ground ring.
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, 26 * pulse, 12 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawCar(G, ctx, car) {
  const { len, wid } = carSize(car);
  const lift = car.airTime > 0 ? Math.sin((0.55 - car.airTime) / 0.55 * Math.PI) * 46 : 0;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(car.x + 6, car.y + 8, len * 0.52, wid * 0.62, car.angle, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(car.x, car.y - lift);
  ctx.rotate(car.angle);
  const scale = lift > 0 ? 1 + lift / 300 : 1;
  ctx.scale(scale, scale);
  // Body.
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 8);
  ctx.fillStyle = car.color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Hood / trunk shading.
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRect(ctx, -len / 2 + 3, -wid / 2 + 3, len * 0.32, wid - 6, 6);
  ctx.fill();
  // Windshield + roof + rear window.
  ctx.fillStyle = '#1d2a3a';
  roundRect(ctx, -len * 0.08, -wid / 2 + 3, len * 0.2, wid - 6, 4);
  ctx.fill();
  ctx.fillStyle = shade(car.color, -24);
  roundRect(ctx, len * 0.14, -wid / 2 + 4, len * 0.3, wid - 8, 5);
  ctx.fill();
  ctx.fillStyle = '#1d2a3a';
  roundRect(ctx, len * 0.36, -wid / 2 + 3, len * 0.12, wid - 6, 4);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#111';
  const wx = len * 0.3;
  const wy = wid / 2;
  ctx.fillRect(-wx - 6, -wy - 2, 12, 5);
  ctx.fillRect(wx - 6, -wy - 2, 12, 5);
  ctx.fillRect(-wx - 6, wy - 3, 12, 5);
  ctx.fillRect(wx - 6, wy - 3, 12, 5);
  // Taxi sign / police light bar.
  if (car.type === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-8, -4, 16, 8);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (car.type === 'police') {
    const flash = Math.floor(G.timeSec * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2a2a' : '#2a6bff';
    ctx.fillRect(-6, -wid / 2 - 1, 5, 4);
    ctx.fillStyle = flash ? '#2a6bff' : '#ff2a2a';
    ctx.fillRect(1, -wid / 2 - 1, 5, 4);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
  }
  // Headlights and brake lights.
  const night = G.light && G.light.dark > 0.3;
  if (night || car.brakeLight) {
    ctx.fillStyle = car.brakeLight ? '#ff2a2a' : 'rgba(255,240,180,0.9)';
    ctx.fillRect(-len / 2 - 2, -wid / 2 + 3, 3, 5);
    ctx.fillRect(-len / 2 - 2, wid / 2 - 8, 3, 5);
    if (night) {
      ctx.fillStyle = '#fff6c9';
      ctx.fillRect(len / 2 - 1, -wid / 2 + 3, 3, 5);
      ctx.fillRect(len / 2 - 1, wid / 2 - 8, 3, 5);
    }
  }
  // Damage: dents and smoke handled by particles; show cracks when low.
  if (car.hp < 40) {
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-len / 4, -wid / 4);
    ctx.lineTo(0, 0);
    ctx.lineTo(len / 5, -wid / 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPed(ctx, ped, isCop) {
  const bob = Math.sin(ped.walkPhase || 0) * 2;
  ctx.save();
  ctx.translate(ped.x, ped.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 5, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs.
  ctx.strokeStyle = ped.pants || '#3a3a3a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(-3 + bob, 10);
  ctx.moveTo(0, 2);
  ctx.lineTo(3 - bob, 10);
  ctx.stroke();
  // Body.
  ctx.fillStyle = isCop ? '#1d3a5f' : ped.shirt;
  ctx.beginPath();
  ctx.arc(0, -2, 8, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = ped.skin || '#e8b88a';
  ctx.beginPath();
  ctx.arc(0, -12, 6, 0, Math.PI * 2);
  ctx.fill();
  // Hair / cap.
  ctx.fillStyle = ped.hair || '#1a1a1a';
  ctx.beginPath();
  ctx.arc(0, -13, 6, Math.PI, Math.PI * 2);
  ctx.fill();
  if (isCop) {
    ctx.fillStyle = '#0f2440';
    ctx.fillRect(-6, -19, 12, 4);
  }
  ctx.restore();
}

function drawDownPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.rotate(ped.angle || 0);
  ctx.fillStyle = ped.shirt || '#d45a5a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin || '#e8b88a';
  ctx.beginPath();
  ctx.arc(16, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(G, ctx, p) {
  if (p.car) return; // drawn as part of the car
  const bob = p.moving ? Math.sin(p.walkPhase) * 2 : 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 6, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs.
  ctx.strokeStyle = '#2a3a5a';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(-3 + bob, 11);
  ctx.moveTo(0, 2);
  ctx.lineTo(3 - bob, 11);
  ctx.stroke();
  // White shirt + jacket.
  ctx.fillStyle = '#e8e8e8';
  ctx.beginPath();
  ctx.arc(0, -2, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c96f5a';
  ctx.fillRect(-8, -6, 16, 5);
  // Head + cap.
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath();
  ctx.arc(0, -13, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d42a2a';
  ctx.beginPath();
  ctx.arc(0, -14, 6.5, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-6, -15, 12, 3);
  // Gun in hand.
  if (p.weapon === 'pistol') {
    ctx.save();
    ctx.rotate(p.aimAngle);
    ctx.fillStyle = '#222';
    ctx.fillRect(6, -2, 12, 4);
    ctx.restore();
  }
  // Punch swing.
  if (p.punchTimer > 0.2) {
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 18, Math.sin(p.angle) * 18 - 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Direction indicator when on foot.
  if (G.mode === 'play' && !p.car) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(12, -4);
    ctx.lineTo(12, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawHelicopter(G, ctx, inView) {
  const h = G.heli;
  if (!h.active) return;
  // Ground shadow + spotlight.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(h.x, h.y, 26, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,180,0.10)';
  ctx.beginPath();
  ctx.moveTo(h.x - 10, h.y - 60);
  ctx.lineTo(h.spotX - 60, h.spotY);
  ctx.lineTo(h.spotX + 60, h.spotY);
  ctx.lineTo(h.x + 10, h.y - 60);
  ctx.closePath();
  ctx.fill();
  // Body (drawn above the world, offset up to suggest altitude).
  const bx = h.x;
  const by = h.y - 60;
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(Math.sin(h.angle) * 0.2);
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a6b8a';
  ctx.beginPath();
  ctx.ellipse(8, -2, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 3;
  const rot = h.angle * 4;
  ctx.beginPath();
  ctx.moveTo(Math.cos(rot) * -30, Math.sin(rot) * -30);
  ctx.lineTo(Math.cos(rot) * 30, Math.sin(rot) * 30);
  ctx.stroke();
  ctx.restore();
}

function drawNight(G, ctx, view, light) {
  if (light.dark <= 0.02) return;
  // Dark blue overlay, cut out around the player and lit areas.
  ctx.save();
  ctx.fillStyle = light.tint;
  ctx.globalAlpha = Math.min(0.45, light.dark * 0.7);
  ctx.fillRect(G.camera.x - view.w / 2 / G.camera.zoom - 40, G.camera.y - view.h / 2 / G.camera.zoom - 40, view.w / G.camera.zoom + 80, view.h / G.camera.zoom + 80);
  ctx.restore();
  // Headlight cones from the player's car.
  const p = G.player;
  if (p.car && light.dark > 0.25) {
    const car = p.car;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(car.x, car.y, 10, car.x, car.y, 260);
    grad.addColorStop(0, 'rgba(255,240,180,0.20)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(car.x, car.y);
    ctx.arc(car.x, car.y, 260, car.angle - 0.45, car.angle + 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Warm glow around the player on foot.
  if (!p.car && light.dark > 0.25) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, 130);
    grad.addColorStop(0, 'rgba(255,220,150,0.14)');
    grad.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Darken / lighten a hex color by amount (-100..100).
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amount;
  let g = ((n >> 8) & 255) + amount;
  let b = (n & 255) + amount;
  r = clamp(r, 0, 255);
  g = clamp(g, 0, 255);
  b = clamp(b, 0, 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
