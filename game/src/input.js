// Keyboard + mouse input. Keys are tracked by code; the game reads
// held() every frame, and pressed() for one-shot actions (cleared each frame).
export const keys = {};
export const justPressed = new Set();
export const mouse = { x: 0, y: 0, down: false, clicked: false };

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!keys[e.code]) justPressed.add(e.code);
    keys[e.code] = true;
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => { mouse.down = true; mouse.clicked = true; if (e.button === 0) e.preventDefault(); });
  addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
export const held = (...codes) => codes.some((c) => keys[c]);
export const pressed = (...codes) => codes.some((c) => justPressed.has(c));
export function endFrame() { justPressed.clear(); mouse.clicked = false; }
