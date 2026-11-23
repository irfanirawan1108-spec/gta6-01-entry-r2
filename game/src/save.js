// Autosave to localStorage: cash, health, mission progress, packages,
// time of day, player position and stats. Saved on mission completes,
// pickups and every 30 seconds of play.
import { G } from './state.js';
import { SAVE_KEY } from './config.js';

export function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: G.cash, health: G.health, ammo: G.ammo, hasPistol: G.hasPistol,
      missionIdx: G.mission.idx, time: G.time, day: G.day,
      x: G.x, y: G.y, pkgs: G.packages.filter((p) => p.taken).map((p) => p.id),
      stats: G.stats,
    }));
  } catch { /* storage unavailable: play on without saving */ }
}
export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function hasSave() { return loadGame() !== null; }
export function applySave(s) {
  G.cash = s.cash; G.health = s.health; G.ammo = s.ammo || 0; G.hasPistol = !!s.hasPistol;
  G.mission.idx = s.missionIdx || 0; G.time = s.time ?? 10; G.day = s.day || 1;
  G.x = s.x; G.y = s.y; G.stats = { ...G.stats, ...(s.stats || {}) };
  for (const p of G.packages) if ((s.pkgs || []).includes(p.id)) { p.taken = true; G.stats.pkgs++; }
}
export function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ } }
