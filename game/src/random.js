// Seeded RNG (mulberry32) and small random helpers. The city and the
// screenshot scenes use fixed seeds so the world is the same every run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rand = (r, a, b) => a + r() * (b - a);
export const randi = (r, a, b) => Math.floor(rand(r, a, b + 1));
export const choice = (r, arr) => arr[Math.floor(r() * arr.length)];
export const chance = (r, p) => r() < p;
