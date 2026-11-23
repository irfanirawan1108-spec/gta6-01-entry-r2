// HUD: wanted stars, health and armor, cash, clock, radio, mission
// tracker, speedometer, the live minimap, dialogue boxes, toast
// messages, and the title / pause / busted / wasted screens.

import { fmtCash, fmtClock, clamp } from './random.js';
import { STATIONS } from './audio.js';
import { CITY_W, CITY_H, BEACH_X, OCEAN_X } from './city.js';

export function createUI(G) {
  const ui = {
    messageText: '',
    messageColor: '#ffffff',
    messageTimer: 0,
    dialogue: null, // {lines, giver, index}
    dialogueDone: null, // callback when the dialogue closes
    prompt: '', // contextual prompt line (e.g. "E — enter car")
    promptKey: '',
  };

  ui.message = (text, color = '#ffffff', secs = 2.5) => {
    ui.messageText = text;
    ui.messageColor = color;
    ui.messageTimer = secs;
  };

  ui.showDialogue = (lines, giver, onDone) => {
    ui.dialogue = { lines, giver, index: 0 };
    ui.dialogueDone = onDone || null;
  };

  ui.advanceDialogue = () => {
    if (!ui.dialogue) return false;
    ui.dialogue.index++;
    if (ui.dialogue.index >= ui.dialogue.lines.length) {
      const cb = ui.dialogueDone;
      ui.dialogue = null;
      ui.dialogueDone = null;
      if (cb) cb();
      return true;
    }
    return false;
  };

  return ui;
}

export function drawHUD(G) {
  const ctx = G.ctx;
  const view = G.view;
  const p = G.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // --- Top right: minimap ---
  drawMinimap(G, ctx, view.w - 208, 14, 194, 150);

  // --- Top left: wanted stars + health + armor ---
  const x0 = 16;
  let y0 = 16;
  // Wanted stars.
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, x0 + 14 + i * 26, y0 + 12, 11, i < G.wanted ? '#ffd94a' : 'rgba(0,0,0,0.45)');
  }
  y0 += 34;
  // Health bar.
  bar(ctx, x0, y0, 170, 14, p.health / 100, '#e5484d', 'rgba(0,0,0,0.5)');
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HP', x0 + 4, y0 + 11);
  y0 += 20;
  // Armor bar.
  bar(ctx, x0, y0, 170, 14, p.armor / 100, '#7fb3d6', 'rgba(0,0,0,0.5)');
  ctx.fillStyle = '#fff';
  ctx.fillText('ARMOR', x0 + 4, y0 + 11);

  // --- Bottom left: cash, clock, radio, weapon ---
  const bx = 16;
  const by = view.h - 66;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRectPath(ctx, bx - 6, by - 8, 220, 58, 8);
  ctx.fill();
  ctx.fillStyle = '#7ddc8a';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(fmtCash(p.cash), bx, by + 16);
  ctx.fillStyle = '#fff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(fmtClock(G.clock) + '  ·  ' + STATIONS[G.audio.station].name, bx, by + 38);
  ctx.fillStyle = '#e8c95a';
  ctx.fillText(p.weapon === 'pistol' ? `Pistol  •  ${p.ammo} ammo` : 'Fists', bx + 150, by + 38);

  // --- Bottom right: speedometer when driving ---
  if (p.car) {
    const sx = view.w - 130;
    const sy = view.h - 66;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRectPath(ctx, sx - 6, sy - 8, 116, 58, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(Math.abs(p.car.speed) * 0.22)), sx + 96, sy + 20);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('km/h', sx + 96, sy + 38);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8c95a';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(p.car.label.toUpperCase(), sx, sy + 38);
    // Car health.
    bar(ctx, sx, sy + 44, 104, 6, clamp(p.car.hp / 100, 0, 1), '#e5484d', 'rgba(0,0,0,0.5)');
  }

  // --- Mission tracker (top centre) ---
  const label = G.missionLabel;
  if (label) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const w = ctx.measureText(label).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRectPath(ctx, view.w / 2 - w / 2, 12, w, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd94a';
    ctx.textAlign = 'center';
    ctx.fillText(label, view.w / 2, 32);
    // Mission timer.
    const m = G.mission;
    if (m && m.state === 'active') {
      const step = m.def.steps[m.step];
      if (step && step.time && (step.type === 'deliver' || step.type === 'survive')) {
        ctx.fillStyle = m.timer < 15 ? '#ff5a5a' : '#fff';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.fillText(Math.ceil(m.timer) + 's', view.w / 2, 58);
      }
      if (step && step.type === 'wait') {
        bar(ctx, view.w / 2 - 80, 48, 160, 8, clamp(m.waitT / step.time, 0, 1), '#ffd94a', 'rgba(0,0,0,0.5)');
      }
    }
  }

  // --- Toast message (centre) ---
  if (G.ui.messageTimer > 0) {
    ctx.globalAlpha = clamp(G.ui.messageTimer, 0, 1);
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(G.ui.messageText).width + 30;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRectPath(ctx, view.w / 2 - tw / 2, view.h - 150, tw, 32, 8);
    ctx.fill();
    ctx.fillStyle = G.ui.messageColor;
    ctx.fillText(G.ui.messageText, view.w / 2, view.h - 128);
    ctx.globalAlpha = 1;
  }

  // --- Contextual prompt (bottom centre) ---
  if (G.ui.prompt) {
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const pw = ctx.measureText(G.ui.prompt).width + 24;
    roundRectPath(ctx, view.w / 2 - pw / 2, view.h - 44, pw, 26, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(G.ui.prompt, view.w / 2, view.h - 26);
  }

  // --- Dialogue box ---
  if (G.ui.dialogue) {
    drawDialogue(G, ctx);
  }

  // --- Controls hint (first minute of play) ---
  if (G.mode === 'play' && G.playTime < 25 && !G.ui.dialogue) {
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('WASD move/drive · E enter car / interact · SPACE punch / handbrake · 1/2 weapons · R radio · M mute · ESC pause', view.w / 2, view.h - 84);
  }

  ctx.restore();
}

function drawMinimap(G, ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.78)';
  roundRectPath(ctx, x - 4, y - 4, w + 8, h + 8, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const sx = w / (CITY_W + 500);
  const sy = h / (CITY_H + 200);
  const s = Math.min(sx, sy);
  const ox = x + (w - CITY_W * s) / 2;
  const oy = y + (h - CITY_H * s) / 2;
  // Water + beach.
  ctx.fillStyle = '#1d7f9e';
  ctx.fillRect(ox + BEACH_X * s, oy, (OCEAN_X - BEACH_X + 300) * s, CITY_H * s);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(ox + BEACH_X * s, oy, (OCEAN_X - BEACH_X) * s, CITY_H * s);
  // Roads.
  ctx.fillStyle = '#5a5a5a';
  for (let i = 0; i <= 10; i++) ctx.fillRect(ox + (i * 416) * s, oy, 96 * s, CITY_H * s);
  for (let j = 0; j <= 8; j++) ctx.fillRect(ox, oy + (j * 416) * s, CITY_W * s, 96 * s);
  // Park.
  ctx.fillStyle = '#3f7a3a';
  ctx.fillRect(ox + G.city.park.x * s, oy + G.city.park.y * s, G.city.park.w * s, G.city.park.h * s);
  // Objective marker.
  const marker = G.missionMarker;
  if (marker) {
    const pulse = 1 + Math.sin(G.timeSec * 5) * 0.3;
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(ox + marker.x * s, oy + marker.y * s, 5 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission target car.
  if (G.mission && G.mission.target && G.mission.target.hp > 0) {
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.arc(ox + G.mission.target.x * s, oy + G.mission.target.y * s, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips.
  ctx.fillStyle = '#2a6bff';
  for (const cop of G.cops) {
    if (cop.down) continue;
    ctx.fillRect(ox + cop.x * s - 2, oy + cop.y * s - 2, 4, 4);
  }
  // Player arrow.
  const px = ox + G.player.x * s;
  const py = oy + G.player.y * s;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // North label.
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N', x + 2, y + 12);
  ctx.restore();
}

export function drawDialogue(G, ctx) {
  const d = G.ui.dialogue;
  const view = G.view;
  const w = Math.min(680, view.w - 80);
  const x = (view.w - w) / 2;
  const y = view.h - 190;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,16,0.88)';
  roundRectPath(ctx, x, y, w, 120, 10);
  ctx.fill();
  ctx.strokeStyle = '#ffd94a';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Portrait: coloured circle with the giver's initial.
  ctx.fillStyle = d.giver === 'Delia' ? '#c96f9e' : '#5a8a6b';
  ctx.beginPath();
  ctx.arc(x + 44, y + 46, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(d.giver[0], x + 44, y + 54);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(d.giver, x + 84, y + 30);
  ctx.fillStyle = '#fff';
  ctx.font = '16px system-ui, sans-serif';
  wrapText(ctx, d.lines[d.index], x + 84, y + 54, w - 110, 21);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('E / click — continue', x + w - 14, y + 104);
  ctx.restore();
}

export function drawTitle(G) {
  const ctx = G.ctx;
  const view = G.view;
  ctx.save();
  // Dim the world behind.
  ctx.fillStyle = 'rgba(8,10,18,0.62)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  // Logo.
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('PALMA VERDE', view.w / 2, view.h * 0.3);
  ctx.fillStyle = '#ff5a7a';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('A  G T A - S T Y L E  O P E N  W O R L D', view.w / 2, view.h * 0.3 + 36);
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('You are Milo Vane — $40, no car, one city that never sleeps.', view.w / 2, view.h * 0.42);
  ctx.fillText('Steal cars. Lose the cops. Run eight jobs for Delia.', view.w / 2, view.h * 0.42 + 26);
  // Menu buttons.
  const buttons = G.titleButtons;
  for (const b of buttons) {
    ctx.fillStyle = b.hover ? '#ffd94a' : 'rgba(255,255,255,0.12)';
    roundRectPath(ctx, b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    ctx.strokeStyle = b.hover ? '#ffd94a' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = b.hover ? '#111' : '#fff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + 33);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('WASD move & drive · E enter car · SPACE punch / handbrake · 1/2 weapons · R radio · M mute', view.w / 2, view.h - 40);
  ctx.fillText('Progress saves automatically. Missions start at Delia\u2019s Garage.', view.w / 2, view.h - 20);
  ctx.restore();
}

export function drawPause(G) {
  const ctx = G.ctx;
  const view = G.view;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.7)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', view.w / 2, view.h * 0.36);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`Cash ${fmtCash(G.player.cash)}  ·  Missions done ${G.flags.missionsDone || 0}/8  ·  Packages ${G.flags.packages || 0}/15`, view.w / 2, view.h * 0.36 + 34);
  ctx.fillText('ESC resume  ·  M mute  ·  R radio', view.w / 2, view.h * 0.36 + 62);
  ctx.restore();
}

export function drawEndCard(G) {
  const ctx = G.ctx;
  const view = G.view;
  const dead = G.mode === 'wasted';
  ctx.save();
  ctx.fillStyle = dead ? 'rgba(40,0,0,0.72)' : 'rgba(0,10,40,0.72)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = dead ? '#ff5a5a' : '#2a6bff';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillText(dead ? 'WASTED' : 'BUSTED', view.w / 2, view.h * 0.4);
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  const lost = Math.floor(G.player.cash * 0.1);
  ctx.fillText(`The city takes 10% of your cash — $${lost} gone.`, view.w / 2, view.h * 0.4 + 36);
  ctx.fillText('Press E to get back on your feet.', view.w / 2, view.h * 0.4 + 64);
  ctx.restore();
}

export function drawStoryComplete(G) {
  const ctx = G.ctx;
  const view = G.view;
  ctx.save();
  ctx.fillStyle = 'rgba(8,16,8,0.78)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('STORY COMPLETE', view.w / 2, view.h * 0.38);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Every job done. Palma Verde is yours, Milo.', view.w / 2, view.h * 0.38 + 36);
  ctx.fillText(`Final cash: ${fmtCash(G.player.cash)}   ·   Keep playing — the city stays open.`, view.w / 2, view.h * 0.38 + 66);
  ctx.fillText('Press E to keep playing.', view.w / 2, view.h * 0.38 + 96);
  ctx.restore();
}

// --- Small drawing helpers ---------------------------------------------------

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

function drawStar(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lh;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}
