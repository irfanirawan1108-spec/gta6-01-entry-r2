// Palma Verde — the city itself. A fixed-seed generated coastal city:
// 10 x 8 blocks, a beach and ocean on the east edge, a marina on the
// south edge, a central park, and four districts with their own look.
// Roads are a grid; traffic drives on them, pedestrians use sidewalks.

import { WORLD, PALETTE } from './config.js';
import { mulberry32, pick, range, rangeInt, chance, shuffled, clamp } from './random.js';

const PITCH = WORLD.block + WORLD.road; // 416
export const CITY_W = WORLD.cols * PITCH + WORLD.road; // 4256
export const CITY_H = WORLD.rows * PITCH + WORLD.road; // 3424
export const BEACH_X = CITY_W;
export const OCEAN_X = CITY_W + WORLD.beachWidth;
export const WORLD_W = OCEAN_X + 900;
export const WORLD_H = CITY_H + WORLD.marinaHeight;

// Road rectangles: road index 0..cols horizontally, 0..rows vertically.
export function roadX(i) {
  return i * PITCH;
}
export function roadY(j) {
  return j * PITCH;
}
export function blockX(c) {
  return c * PITCH + WORLD.road;
}
export function blockY(r) {
  return r * PITCH + WORLD.road;
}

export function isOnRoad(x, y) {
  if (x < 0 || y < 0 || x > CITY_W || y > CITY_H) return false;
  const mx = x % PITCH;
  const my = y % PITCH;
  return mx < WORLD.road || my < WORLD.road;
}

export function isWater(x, y) {
  if (x > OCEAN_X) return true;
  if (y > CITY_H + 40 && x > CITY_W * 0.55) return true; // marina basin
  return false;
}

export function isBeach(x, y) {
  return x >= BEACH_X && x <= OCEAN_X && y >= 0 && y <= CITY_H;
}

// District of a block (col,row): downtown NW, old town centre, suburbs SE.
export function districtAt(c, r) {
  if (c <= 3 && r <= 2) return 'downtown';
  if (c >= 7 && r >= 5) return 'suburb';
  if (r >= 6) return 'marina';
  return 'oldtown';
}

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const city = {
    seed,
    buildings: [],
    trees: [],
    lamps: [],
    props: [], // benches, hydrants, dumpsters, billboards
    ramps: [],
    lights: [], // traffic lights at major intersections
    spots: {}, // named places: safehouse, spray, ammu, showroom, hospital, garage
    park: null,
    docks: [],
  };

  // Central park: block (4,3) and (5,3) joined as one green.
  city.park = { x: blockX(4), y: blockY(3), w: WORLD.block * 2 + WORLD.road, h: WORLD.block };

  // Buildings, block by block.
  for (let r = 0; r < WORLD.rows; r++) {
    for (let c = 0; c < WORLD.cols; c++) {
      const bx = blockX(c);
      const by = blockY(r);
      // Park blocks stay green.
      if ((c === 4 || c === 5) && r === 3) continue;
      // The plaza block (2,4) is an open square with a fountain.
      if (c === 2 && r === 4) {
        city.props.push({ kind: 'fountain', x: bx + WORLD.block / 2, y: by + WORLD.block / 2, r: 42 });
        continue;
      }
      const d = districtAt(c, r);
      const palette = PALETTE[d] || PALETTE.oldtown;
      const tall = d === 'downtown';
      const n = tall ? 1 : rangeInt(rng, 2, 4);
      if (tall) {
        const w = range(rng, 220, 290);
        const h = range(rng, 200, 280);
        city.buildings.push({
          x: bx + (WORLD.block - w) / 2, y: by + (WORLD.block - h) / 2, w, h,
          color: pick(rng, palette), height: rangeInt(rng, 3, 6), district: d,
          roof: pick(rng, ['pool', 'ac', 'garden', 'helipad']),
        });
      } else {
        // 2x2 small buildings with a courtyard gap.
        const cells = shuffled(rng, [[0, 0], [1, 0], [0, 1], [1, 1]]).slice(0, n);
        for (const [gx, gy] of cells) {
          const w = range(rng, 110, 140);
          const h = range(rng, 100, 140);
          city.buildings.push({
            x: bx + gx * 160 + 12, y: by + gy * 160 + 12, w, h,
            color: pick(rng, palette), height: rangeInt(rng, 1, 3), district: d,
            roof: pick(rng, ['ac', 'garden', 'flat', 'flat']),
          });
        }
      }
    }
  }

  // Palm trees: beach line, park, and scattered along sidewalks.
  for (let y = 60; y < CITY_H; y += 170) {
    city.trees.push({ x: BEACH_X + 42, y: y + range(rng, -20, 20), kind: 'palm', s: range(rng, 0.9, 1.3) });
    city.trees.push({ x: BEACH_X + 120, y: y + 90 + range(rng, -20, 20), kind: 'palm', s: range(rng, 0.8, 1.2) });
  }
  for (let i = 0; i < 26; i++) {
    city.trees.push({
      x: city.park.x + range(rng, 20, city.park.w - 20),
      y: city.park.y + range(rng, 20, city.park.h - 20),
      kind: chance(rng, 0.5) ? 'palm' : 'oak', s: range(rng, 0.9, 1.4),
    });
  }
  for (let i = 0; i < 40; i++) {
    const c = rangeInt(rng, 0, WORLD.cols - 1);
    const r = rangeInt(rng, 0, WORLD.rows - 1);
    if ((c === 4 || c === 5) && r === 3) continue;
    city.trees.push({
      x: blockX(c) + range(rng, 8, 30), y: blockY(r) + range(rng, 8, WORLD.block - 8),
      kind: 'oak', s: range(rng, 0.8, 1.2),
    });
  }

  // Street lamps along every road, both sides.
  for (let i = 0; i <= WORLD.cols; i++) {
    for (let y = 140; y < CITY_H; y += 380) {
      city.lamps.push({ x: roadX(i) + 12, y });
      city.lamps.push({ x: roadX(i) + WORLD.road - 12, y: y + 190 });
    }
  }
  for (let j = 0; j <= WORLD.rows; j++) {
    for (let x = 140; x < CITY_W; x += 380) {
      city.lamps.push({ x, y: roadY(j) + 12 });
    }
  }

  // Traffic lights at the big intersections (even columns and rows).
  for (let i = 0; i <= WORLD.cols; i += 2) {
    for (let j = 0; j <= WORLD.rows; j += 2) {
      city.lights.push({ x: roadX(i) + WORLD.road / 2, y: roadY(j) + WORLD.road / 2, phase: (i + j) % 4 });
    }
  }

  // Stunt ramps: three jumps aimed down long straight roads.
  city.ramps = [
    { x: roadX(5) + WORLD.road / 2, y: roadY(2) + 40, angle: Math.PI / 2, id: 'ramp1' },
    { x: roadX(8) + WORLD.road / 2, y: roadY(6) + 40, angle: Math.PI / 2, id: 'ramp2' },
    { x: roadX(2) + 40, y: roadY(5) + WORLD.road / 2, angle: 0, id: 'ramp3' },
  ];

  // Marina docks along the south water.
  for (let i = 0; i < 6; i++) {
    city.docks.push({ x: 600 + i * 560, y: CITY_H + 60, w: 300, h: 26 });
  }

  // Named places (world positions used by missions and the HUD).
  const plaza = { x: blockX(2) + WORLD.block / 2, y: blockY(4) + WORLD.block / 2 };
  city.spots = {
    safehouse: { x: blockX(6) + 60, y: blockY(6) + 60, label: 'Safehouse' },
    spray: { x: roadX(3) + WORLD.road / 2, y: blockY(1) + WORLD.block - 20, label: 'Pay N Spray' },
    ammu: { x: blockX(3) + 40, y: blockY(5) + 40, label: 'Ammu-Nation' },
    showroom: { x: blockX(1) + 60, y: blockY(1) + 60, label: 'Showroom' },
    hospital: { x: blockX(7) + 60, y: blockY(2) + 60, label: 'Hospital' },
    garage: { x: blockX(8) + 60, y: blockY(4) + 60, label: 'Delia\u2019s Garage' },
    plaza,
    beach: { x: BEACH_X + 110, y: CITY_H * 0.45, label: 'Palma Beach' },
    airport: { x: roadX(9) + WORLD.road / 2, y: roadY(7) + WORLD.road / 2, label: 'Airport' },
  };

  // A few billboards and benches for colour.
  city.props.push({ kind: 'billboard', x: roadX(4) + WORLD.road / 2, y: blockY(0) + 8, w: 180, h: 44, text: 'PALMA VERDE' });
  city.props.push({ kind: 'billboard', x: blockX(6) + WORLD.block / 2, y: roadY(6) + 8, w: 180, h: 44, text: 'VICE SODA' });
  for (let i = 0; i < 14; i++) {
    city.props.push({
      kind: 'bench',
      x: city.park.x + range(rng, 30, city.park.w - 30),
      y: city.park.y + range(rng, 30, city.park.h - 30),
    });
  }
  return city;
}

// --- Queries used by traffic, pedestrians and missions --------------------

// Is a point inside any building (solid)?
export function hitsBuilding(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

// Is a point inside the park or plaza (walkable green)?
export function inPark(city, x, y) {
  const p = city.park;
  return x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h;
}

// Nearest point on the road grid to (x,y), plus the road's direction.
export function nearestRoad(x, y) {
  const px = x % PITCH;
  const py = y % PITCH;
  const onV = px < WORLD.road;
  const onH = py < WORLD.road;
  if (onV && !onH) {
    const i = Math.floor(x / PITCH);
    return { x: roadX(i) + WORLD.road / 2, y, vertical: true, angle: Math.PI / 2 };
  }
  if (onH && !onV) {
    const j = Math.floor(y / PITCH);
    return { x, y: roadY(j) + WORLD.road / 2, vertical: false, angle: 0 };
  }
  // Inside a block: walk to the nearest road edge.
  const dxRoad = onV ? 0 : Math.min(px - WORLD.road, PITCH - px);
  const dyRoad = onH ? 0 : Math.min(py - WORLD.road, PITCH - py);
  if (dxRoad <= dyRoad) {
    const i = Math.floor(x / PITCH);
    const edge = px < WORLD.road + WORLD.block / 2 ? roadX(i) + WORLD.road / 2 : roadX(i + 1) + WORLD.road / 2;
    return { x: clamp(edge, 0, CITY_W), y, vertical: true, angle: Math.PI / 2 };
  }
  const j = Math.floor(y / PITCH);
  const edge = py < WORLD.road + WORLD.block / 2 ? roadY(j) + WORLD.road / 2 : roadY(j + 1) + WORLD.road / 2;
  return { x, y: clamp(edge, 0, CITY_H), vertical: false, angle: 0 };
}

// A random point on a road, for traffic spawns.
export function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    const i = rangeInt(rng, 0, WORLD.cols);
    return { x: roadX(i) + WORLD.road / 2 + (rng() < 0.5 ? -22 : 22), y: range(rng, 0, CITY_H), vertical: true };
  }
  const j = rangeInt(rng, 0, WORLD.rows);
  return { x: range(rng, 0, CITY_W), y: roadY(j) + WORLD.road / 2 + (rng() < 0.5 ? -22 : 22), vertical: false };
}

// A random sidewalk point near a road, for pedestrian spawns.
export function randomSidewalkPoint(rng) {
  const p = randomRoadPoint(rng);
  if (p.vertical) return { x: p.x + (rng() < 0.5 ? -58 : 58), y: p.y };
  return { x: p.x, y: p.y + (rng() < 0.5 ? -58 : 58) };
}

// Traffic-light state at a light: 'green' or 'red' for the given axis.
export function lightState(light, timeSec, vertical) {
  const cycle = 14;
  const t = (timeSec + light.phase * 3.5) % cycle;
  const nsGreen = t < 6;
  return vertical ? (nsGreen ? 'green' : 'red') : (nsGreen ? 'red' : 'green');
}
