// Palma Verde — shared constants: one coastal city, 10 by 8 blocks.
export const BLOCK = 170, ROAD = 46, COLS = 10, ROWS = 8;
export const W = COLS * BLOCK + (COLS + 1) * ROAD; // 2206
export const H = ROWS * BLOCK + (ROWS + 1) * ROAD; // 1774
export const rx = (i) => i * (BLOCK + ROAD); // vertical road i, left edge
export const ry = (j) => j * (BLOCK + ROAD); // horizontal road j, top edge
export const rcx = (i) => rx(i) + ROAD / 2; // vertical road centre
export const rcy = (j) => ry(j) + ROAD / 2; // horizontal road centre
export const TAU = Math.PI * 2;
export const SAVE_KEY = 'palma-verde-r2-save';

// District of block (cx, cy). Marina east, beach south, downtown north-centre.
export function district(cx, cy) {
  if (cy >= 6 && cx >= 7) return 'marina';
  if (cy === 7) return 'beach';
  if (cx >= 3 && cx <= 5 && cy <= 2) return 'downtown';
  if (cx <= 2 && cy >= 3 && cy <= 5) return 'oldtown';
  if (cx >= 4 && cx <= 5 && cy >= 3 && cy <= 4) return 'park';
  if (cx === 7 && cy === 3) return 'plaza';
  return 'homes';
}

// Fixed shop blocks: garage (missions), ammo, hospital, spray, showroom, safehouse, bank, airport, police.
export const SHOPS = {
  garage: { cx: 3, cy: 6, name: "Delia's Garage", short: 'GARAGE' },
  ammo: { cx: 1, cy: 1, name: 'Ammu-Nation', short: 'AMMU' },
  hospital: { cx: 8, cy: 1, name: 'Palma General', short: 'HOSP' },
  spray: { cx: 6, cy: 5, name: 'Pay N Spray', short: 'SPRAY' },
  showroom: { cx: 2, cy: 6, name: 'Verde Motors', short: 'CARS' },
  safe: { cx: 0, cy: 6, name: 'Safehouse', short: 'HOME' },
  bank: { cx: 5, cy: 1, name: 'Palma Bank', short: 'BANK' },
  airport: { cx: 9, cy: 0, name: 'Palma Airport', short: 'AIR' },
  police: { cx: 0, cy: 0, name: 'Palma PD', short: 'PD' },
};

// Six car types: size in px, accel, top speed (px/s), turn rate, palette.
export const CARS = [
  { name: 'Sedan', w: 34, h: 17, acc: 260, max: 330, turn: 2.6, colors: ['#c0392b', '#7f8c8d', '#2c3e50', '#b7950b'] },
  { name: 'Coupe', w: 32, h: 16, acc: 300, max: 360, turn: 2.9, colors: ['#8e44ad', '#16a085', '#e67e22', '#dfe6e9'] },
  { name: 'Taxi', w: 34, h: 17, acc: 250, max: 320, turn: 2.6, colors: ['#f1c40f'] },
  { name: 'Van', w: 40, h: 19, acc: 200, max: 260, turn: 2.2, colors: ['#ecf0f1', '#3498db', '#95a5a6'] },
  { name: 'Truck', w: 46, h: 20, acc: 170, max: 240, turn: 1.9, colors: ['#e74c3c', '#2ecc71', '#f39c12'] },
  { name: 'Sports', w: 33, h: 16, acc: 380, max: 460, turn: 3.3, colors: ['#ff2d55', '#00d4ff', '#ffd60a', '#ff9500'] },
];
export const COP_COLOR = '#1f6feb';
export const DAY_LEN = 150; // one game day = 150 real seconds (24h)
