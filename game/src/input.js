// Keyboard and mouse input. Tracks held keys, pressed-this-frame edges,
// and the mouse position in screen space (converted to world by render).

import { KEYS } from './config.js';

export function createInput(canvas) {
  const input = {
    held: new Set(),
    pressed: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false },
    anyKey: false,
  };

  function code(e) {
    return e.code;
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!input.held.has(e.code)) input.pressed.add(e.code);
    input.held.add(e.code);
    input.anyKey = true;
  });
  window.addEventListener('keyup', (e) => {
    input.held.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.held.clear();
  });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - r.left;
    input.mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouse.down = true;
    input.mouse.clicked = true;
    const r = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - r.left;
    input.mouse.y = e.clientY - r.top;
  });
  window.addEventListener('mouseup', () => {
    input.mouse.down = false;
  });

  input.isDown = (group) => KEYS[group].some((k) => input.held.has(k));
  input.wasPressed = (group) => KEYS[group].some((k) => input.pressed.has(k));
  // Drop a pressed-this-frame edge so a later handler in the same frame
  // does not see the same keypress twice (e.g. exit car, then re-enter).
  input.consume = (group) => {
    for (const k of KEYS[group]) input.pressed.delete(k);
  };
  input.wasPressedCode = (c) => input.pressed.has(c);
  input.axis = () => {
    let x = 0;
    let y = 0;
    if (input.isDown('left')) x -= 1;
    if (input.isDown('right')) x += 1;
    if (input.isDown('up')) y -= 1;
    if (input.isDown('down')) y += 1;
    return { x, y };
  };

  // Call once per frame after the game reads input.
  input.endFrame = () => {
    input.pressed.clear();
    input.mouse.clicked = false;
    input.anyKey = false;
  };

  return input;
}
