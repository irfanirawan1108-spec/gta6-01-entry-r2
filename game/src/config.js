// Palma Verde — tuning, palette and world constants.
// A sun-soaked coastal city: warm sand, turquoise water, pastel blocks.
// All distances are world pixels; one block is 320px, roads are 96px wide.

export const WORLD = {
  cols: 10, // city blocks across (west -> east)
  rows: 8, // city blocks down (north -> south)
  block: 320,
  road: 96,
  // Ocean strip on the east edge, marina along the south edge.
  beachWidth: 220,
  marinaHeight: 180,
};

export const DAY = {
  // Game clock: minutes in a day. The day starts at 09:00, sunset ~18:30.
  startMinutes: 9 * 60,
  minutesPerSecond: 0.6, // a full day lasts ~40 real minutes
  dawn: 6 * 60,
  noon: 12 * 60,
  sunset: 18 * 60 + 30,
  night: 20 * 60,
};

// Warm, sun-soaked palette. render.js picks tints from the time of day.
export const PALETTE = {
  grass: '#7fae62',
  grassDry: '#a8b46a',
  park: '#6da356',
  sand: '#e8d29a',
  sandWet: '#d9c184',
  water: '#2fa8b8',
  waterDeep: '#1d7f9e',
  waterFoam: '#bfeef2',
  road: '#3d3a38',
  roadEdge: '#2c2a29',
  lane: '#e8d44f',
  sidewalk: '#b8ab93',
  sidewalkEdge: '#9a8d75',
  crosswalk: '#e8e4da',
  // District building palettes (walls, roofs, trim).
  downtown: ['#c96f5a', '#5a7ba6', '#7a9e7e', '#b08a4f', '#8a6f9e'],
  oldtown: ['#e8a04c', '#d96f5a', '#e8c96a', '#7fb3a0', '#c97b9e'],
  suburb: ['#e8b48a', '#a8c4d6', '#d6c9a8', '#b5a8c9', '#e89a7a'],
  marina: ['#8fb3c9', '#c9a87f', '#7fa8a0', '#d6b48a'],
};

export const PLAYER = {
  walkSpeed: 165,
  runSpeed: 265,
  radius: 13,
  maxHealth: 100,
  maxArmor: 100,
  punchDamage: 12,
  punchRange: 30,
  punchCooldown: 0.35,
  gunDamage: 34,
  gunRange: 420,
  gunCooldown: 0.28,
};

export const CARS = {
  // type: {label, top speed px/s, accel, grip, seats, value, color pool}
  sedan: { label: 'Sedan', top: 430, accel: 300, grip: 3.4, value: 350, colors: ['#b8443a', '#3a6fb8', '#c9c9c9', '#4a4a52', '#7a9e5a'] },
  taxi: { label: 'Taxi', top: 420, accel: 290, grip: 3.4, value: 300, colors: ['#e8b93a'] },
  sports: { label: 'Sports', top: 620, accel: 430, grip: 4.6, value: 2400, colors: ['#d42a2a', '#e8e83a', '#2a7ad4', '#111111'] },
  truck: { label: 'Truck', top: 340, accel: 210, grip: 2.6, value: 500, colors: ['#7a7a7a', '#4a6b8a', '#8a6b4a'] },
  van: { label: 'Van', top: 380, accel: 250, grip: 3.0, value: 420, colors: ['#c9c9c9', '#5a8a6b', '#8a5a6b'] },
  coupe: { label: 'Coupe', top: 520, accel: 380, grip: 4.0, value: 1400, colors: ['#2a2a2a', '#8a2a5a', '#2a8a7a', '#d4d4d4'] },
  police: { label: 'Police', top: 560, accel: 400, grip: 4.2, value: 0, colors: ['#1d3a5f'] },
};

export const WANTED = {
  // stars -> {cops, cars, heli, roadblocks}
  0: { foot: 0, cars: 0, heli: false, roadblock: false },
  1: { foot: 2, cars: 1, heli: false, roadblock: false },
  2: { foot: 3, cars: 2, heli: false, roadblock: false },
  3: { foot: 4, cars: 3, heli: false, roadblock: true },
  4: { foot: 5, cars: 4, heli: true, roadblock: true },
  5: { foot: 6, cars: 5, heli: true, roadblock: true },
  // Heat 0..100; heat falls when no cop can see the player.
  decayPerSecond: 4.5,
  sightRange: 520,
  bustedRange: 46,
  // Cash lost on busted / wasted.
  penaltyRate: 0.1,
};

export const ECONOMY = {
  startCash: 40,
  taxiFareBase: 45,
  taxiFarePerPx: 0.05,
  packageReward: 150,
  packageCount: 15,
  vigilanteReward: 220,
  stuntReward: 180,
  gunPrice: 300,
  ammoPrice: 60,
  ammoPack: 24,
  armorPrice: 250,
  sprayPrice: 100,
  healPrice: 80,
  carPrices: { sedan: 900, coupe: 2600, sports: 5200, van: 1200, truck: 1500 },
};

export const MISSIONS = [
  { id: 'm1', title: 'New in Town', giver: 'Delia', reward: 250 },
  { id: 'm2', title: 'Taxi Rush', giver: 'Delia', reward: 350 },
  { id: 'm3', title: 'Hot Delivery', giver: 'Delia', reward: 500 },
  { id: 'm4', title: 'Repo Man', giver: 'Rico', reward: 650 },
  { id: 'm5', title: 'The Vault', giver: 'Delia', reward: 1200 },
  { id: 'm6', title: 'Chase the Rat', giver: 'Rico', reward: 800 },
  { id: 'm7', title: 'Four-Star Escape', giver: 'Delia', reward: 1500 },
  { id: 'm8', title: 'The Last Run', giver: 'Delia', reward: 3000 },
];

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  enter: ['KeyE', 'Enter'],
  attack: ['Space'],
  run: ['ShiftLeft', 'ShiftRight'],
  mute: ['KeyM'],
  pause: ['Escape'],
  radio: ['KeyR'],
  horn: ['KeyH'],
};
