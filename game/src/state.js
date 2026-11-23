// The one shared game state. Every system reads and writes G; main.js
// owns the loop and the mode machine, the systems own their updates.
import { rcx, rcy } from './config.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const angDiff = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
export const fmtCash = (n) => '$' + Math.floor(n).toLocaleString('en-US');
export const fmtTime = (t) => {
  const h = Math.floor(t) % 24, m = Math.floor((t % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
};

export const G = {
  mode: 'title', // title | play | pause | busted | wasted
  time: 10, day: 1,
  cash: 40, health: 100, ammo: 0, hasPistol: false, weapon: 0, // 0 fists, 1 pistol
  heat: 0, stars: 0,
  x: rcx(3), y: rcy(7), a: -Math.PI / 2, speed: 0, onFoot: true,
  car: null, // the car the player drives (a member of G.cars)
  cars: [], peds: [], cops: [], parts: [], texts: [],
  roadblocks: [], heli: null,
  mission: { idx: 0, active: false, stage: 0, timer: 0, target: null, fares: 0, hits: 0, zone: null },
  packages: [], // {x, y, taken}
  dlg: null, // {who, lines, i, done}
  toast: '', toastT: 0,
  cam: { x: 0, y: 0 },
  radio: 0, muted: false,
  stats: { earned: 0, busted: 0, wasted: 0, fares: 0, jumps: 0, pkgs: 0, vig: 0 },
  taxi: null, vig: null, // active side jobs
  shot: null, // screenshot scene name, or null
  airT: 0, // air time for stunt jumps
  jumpT: 0, // air time at launch, for the stunt bonus
  respawnAt: 'pd', // where Enter takes you after busted/wasted
  msg: '', msgT: 0,
  elapsed: 0, saveT: 0,
  mouse: { x: 0, y: 0, down: false },
};

export function say(text, t = 2.5) { G.toast = text; G.toastT = t; }
export function floatText(x, y, text, color = '#fff') {
  G.texts.push({ x, y, text, color, t: 1.4 });
}
