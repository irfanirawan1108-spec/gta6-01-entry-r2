// Palma Verde's city: 10x8 blocks, roads between them, districts, shops,
// park pond, marina water, beach sea, stunt ramps and package spots.
// Built once from a fixed seed, so the map is identical every run.
import { BLOCK, ROAD, COLS, ROWS, W, H, rx, ry, rcx, rcy, district, SHOPS } from './config.js';
import { mulberry32, rand, randi, choice } from './random.js';

const R = mulberry32(20261123);
const ROOFS = {
  downtown: ['#5d6d7e', '#2e4053', '#1a5276', '#7fb3d5'],
  oldtown: ['#e67e22', '#d35400', '#c0392b', '#f39c12', '#a93226'],
  homes: ['#a569bd', '#5499c7', '#58d68d', '#f5b041', '#ec7063'],
  park: ['#229954'], plaza: ['#b7950b'], marina: ['#2471a3'], beach: ['#f9e79f'],
};
const SHOP_COLORS = { garage: '#f39c12', ammo: '#c0392b', hospital: '#ecf0f1', spray: '#8e44ad', showroom: '#00d4ff', safe: '#58d68d', bank: '#f1c40f', airport: '#5d6d7e', police: '#1f6feb' };

function buildCity() {
  const blocks = [], rects = [], trees = [];
  const shops = {};
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      const d = district(cx, cy);
      const bx = rx(cx) + ROAD, by = ry(cy) + ROAD;
      const block = { cx, cy, d, buildings: [], trees: [] };
      if (d === 'park') {
        for (let i = 0; i < 7; i++) block.trees.push({ x: bx + rand(R, 14, BLOCK - 14), y: by + rand(R, 14, BLOCK - 14), r: rand(R, 9, 15) });
        blocks.push(block); continue;
      }
      if (d === 'plaza') { blocks.push(block); continue; }
      if (d === 'marina') { blocks.push(block); continue; }
      if (d === 'beach') {
        for (let i = 0; i < 4; i++) block.trees.push({ x: bx + rand(R, 20, BLOCK - 20), y: by + rand(R, 20, BLOCK - 60), r: rand(R, 8, 12) });
        blocks.push(block); continue;
      }
      // shop block: one shop building, door on the road below
      const shopKey = Object.keys(SHOPS).find((k) => SHOPS[k].cx === cx && SHOPS[k].cy === cy);
      if (shopKey) {
        const b = { x: bx + 34, y: by + 30, w: BLOCK - 68, h: BLOCK - 76, c: SHOP_COLORS[shopKey], hgt: randi(R, 1, 2), shop: shopKey };
        block.buildings.push(b); rects.push(b);
        shops[shopKey] = { ...SHOPS[shopKey], x: bx + BLOCK / 2, y: ry(cy + 1) + ROAD / 2 };
        blocks.push(block); continue;
      }
      // normal block: 1-3 buildings
      const n = d === 'downtown' ? 1 : randi(R, 2, 3);
      for (let i = 0; i < n; i++) {
        const w = d === 'downtown' ? rand(R, 90, 130) : rand(R, 44, 78);
        const h = d === 'downtown' ? rand(R, 90, 130) : rand(R, 40, 70);
        const x = bx + rand(R, 8, BLOCK - w - 8), y = by + rand(R, 8, BLOCK - h - 8);
        const b = { x, y, w, h, c: choice(R, ROOFS[d]), hgt: d === 'downtown' ? randi(R, 3, 6) : randi(R, 1, 2) };
        block.buildings.push(b); rects.push(b);
      }
      if (d === 'homes' || d === 'oldtown') for (let i = 0; i < 3; i++) block.trees.push({ x: bx + rand(R, 12, BLOCK - 12), y: by + rand(R, 12, BLOCK - 12), r: rand(R, 7, 11) });
      blocks.push(block);
    }
  }
  // water: park pond (centre of the 2x2 park), marina basin, beach sea strip
  const pond = { x: rx(4) + ROAD + 60, y: ry(3) + ROAD + 60, w: (BLOCK + ROAD) * 2 - 120, h: (BLOCK + ROAD) * 2 - 120, water: true };
  const basin = { x: rx(8) + ROAD, y: ry(6) + ROAD, w: W - rx(8) - ROAD - 8, h: H - ry(6) - ROAD - 8, water: true };
  const sea = { x: 0, y: H - 34, w: rx(7) + ROAD, h: 34, water: true };
  rects.push(pond, basin, sea);
  // stunt ramps: beach road east, park edge, marina road
  const ramps = [
    { x: rcx(2), y: rcy(7), a: 0 },
    { x: rcx(6), y: rcy(4), a: Math.PI / 2 },
    { x: rcx(8), y: rcy(6), a: Math.PI },
  ];
  // 15 hidden packages on sidewalks, seeded
  const packages = [];
  for (let id = 0; id < 15; id++) {
    const i = randi(R, 0, COLS), j = randi(R, 0, ROWS);
    const horiz = chance0();
    const x = horiz ? rcx(i) + rand(R, -90, 90) : rcx(i) + (R() < 0.5 ? -26 : 26);
    const y = horiz ? rcy(j) + (R() < 0.5 ? -26 : 26) : rcy(j) + rand(R, -90, 90);
    packages.push({ id, x: Math.max(30, Math.min(W - 30, x)), y: Math.max(30, Math.min(H - 30, y)), taken: false });
  }
  const intersections = [];
  for (let j = 0; j <= ROWS; j++) for (let i = 0; i <= COLS; i++) intersections.push({ x: rcx(i), y: rcy(j) });
  return { blocks, rects, trees, shops, ramps, packages, pond, basin, sea, intersections };
}
function chance0() { return R() < 0.5; }

export const CITY = buildCity();

// --- queries ---------------------------------------------------------------
export function blockAt(x, y) {
  const cx = Math.floor((x - ROAD) / (BLOCK + ROAD)), cy = Math.floor((y - ROAD) / (BLOCK + ROAD));
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return null;
  return { cx, cy };
}
export function onRoad(x, y) {
  const inV = ((x - ROAD) % (BLOCK + ROAD) + (BLOCK + ROAD)) % (BLOCK + ROAD) < ROAD || x < ROAD;
  const inH = ((y - ROAD) % (BLOCK + ROAD) + (BLOCK + ROAD)) % (BLOCK + ROAD) < ROAD || y < ROAD;
  return (x >= 0 && x < W && y >= 0 && y < H) && (inV || inH);
}
export function waterAt(x, y) {
  return (x >= CITY.pond.x && x <= CITY.pond.x + CITY.pond.w && y >= CITY.pond.y && y <= CITY.pond.y + CITY.pond.h)
    || (x >= CITY.basin.x && x <= CITY.basin.x + CITY.basin.w && y >= CITY.basin.y && y <= CITY.basin.y + CITY.basin.h)
    || (x >= 0 && x <= CITY.sea.w && y >= CITY.sea.y);
}
// Push a circle (x, y, r) out of every solid rect; returns corrected [x, y].
export function collide(x, y, r) {
  for (let pass = 0; pass < 2; pass++) {
    for (const b of CITY.rects) {
      const nx = Math.max(b.x, Math.min(x, b.x + b.w)), ny = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - nx, dy = y - ny, d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.01) { const d = Math.sqrt(d2); x = nx + (dx / d) * r; y = ny + (dy / d) * r; }
        else { // centre inside: push out along the smallest penetration
          const pl = x - b.x, pr = b.x + b.w - x, pt = y - b.y, pb = b.y + b.h - y;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = b.x - r; else if (m === pr) x = b.x + b.w + r;
          else if (m === pt) y = b.y - r; else y = b.y + b.h + r;
        }
      }
    }
    x = Math.max(r, Math.min(W - r, x)); y = Math.max(r, Math.min(H - r, y));
  }
  return [x, y];
}
// Traffic-light cycle: 14s — NS green 6s, yellow 1s, EW green 6s, yellow 1s.
export function lightPhase(now) { const t = now % 14; return t < 6 ? 0 : t < 7 ? 1 : t < 13 ? 2 : 3; }
export function lightAllowsNS(now) { return lightPhase(now) === 0; }
export function lightAllowsEW(now) { return lightPhase(now) === 2; }
export function nearestIntersection(x, y) {
  let best = null, bd = 1e9;
  for (const p of CITY.intersections) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
