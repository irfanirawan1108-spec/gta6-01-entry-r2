// Save / load through localStorage. Auto-saves every few seconds and on
// mission completion. Nothing secret is stored — just progress.

const KEY = 'palma-verde-save-v1';

export function saveGame(G) {
  try {
    const p = G.player;
    const data = {
      cash: Math.floor(p.cash),
      health: p.health,
      armor: p.armor,
      weapon: p.weapon,
      ammo: p.ammo,
      x: Math.round(p.x),
      y: Math.round(p.y),
      clock: G.clock,
      missionsDone: G.flags.missionsDone || 0,
      nextMission: G.nextMission,
      packages: G.flags.packages || 0,
      packagesTaken: G.packages.filter((k) => k.taken).map((k) => k.id),
      stunts: G.flags.stunts || 0,
      storyDone: !!G.flags.storyDone,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    // ignore
  }
}

export function hasSave() {
  return loadGame() !== null;
}
