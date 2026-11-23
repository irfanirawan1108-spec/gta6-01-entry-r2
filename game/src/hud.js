// HUD: wanted stars, cash, health, minimap, objective, radio, toasts,
// dialogue box, title screen, pause and busted/wasted cards. All canvas.
import { G, fmtCash, fmtTime } from './state.js';
import { CITY } from './city.js';
import { W, H } from './config.js';
import { MISSIONS, objectiveText, missionMarker } from './missions.js';
import { STATION_NAMES } from './audio.js';
import { hasSave } from './save.js';

const VW = 1280, VH = 800;

function pill(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(8,12,20,${alpha})`;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
}
function star(ctx, x, y, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd60a' : 'rgba(255,255,255,0.25)';
  ctx.fill();
}
function drawMinimap(ctx) {
  const mw = 184, mh = 148, mx = VW - mw - 14, my = 12, s = Math.min(mw / W, mh / H);
  pill(ctx, mx - 4, my - 4, mw + 8, mh + 8, 0.6);
  ctx.save();
  ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
  ctx.fillStyle = '#0d1b2a'; ctx.fillRect(mx, my, mw, mh);
  // water
  ctx.fillStyle = '#1a5f8a';
  ctx.fillRect(mx + CITY.pond.x * s, my + CITY.pond.y * s, CITY.pond.w * s, CITY.pond.h * s);
  ctx.fillRect(mx + CITY.basin.x * s, my + CITY.basin.y * s, CITY.basin.w * s, CITY.basin.h * s);
  ctx.fillRect(mx, my + CITY.sea.y * s, CITY.sea.w * s, CITY.sea.h * s);
  // roads
  ctx.strokeStyle = '#5a6672'; ctx.lineWidth = 2;
  for (let i = 0; i <= 10; i++) {
    const x = mx + (i * 216 + 23) * s;
    ctx.beginPath(); ctx.moveTo(x, my); ctx.lineTo(x, my + mh); ctx.stroke();
  }
  for (let j = 0; j <= 8; j++) {
    const y = my + (j * 216 + 23) * s;
    ctx.beginPath(); ctx.moveTo(mx, y); ctx.lineTo(mx + mw, y); ctx.stroke();
  }
  // shops
  ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
  for (const k in CITY.shops) {
    const sh = CITY.shops[k];
    ctx.fillStyle = '#ffd60a';
    ctx.fillRect(mx + sh.x * s - 2, my + sh.y * s - 2, 4, 4);
  }
  // packages
  ctx.fillStyle = '#58d68d';
  for (const p of G.packages) if (!p.taken) ctx.fillRect(mx + p.x * s - 1.5, my + p.y * s - 1.5, 3, 3);
  // mission marker
  const mk = missionMarker();
  if (mk) {
    const pulse = 3 + Math.sin(G.elapsed * 5) * 1.5;
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath(); ctx.arc(mx + mk.x * s, my + mk.y * s, pulse, 0, Math.PI * 2); ctx.fill();
  }
  // cops
  ctx.fillStyle = '#ff5b5b';
  for (const c of G.cops) ctx.fillRect(mx + c.x * s - 2, my + c.y * s - 2, 4, 4);
  for (const c of G.cars) if (c.driver === 'police') ctx.fillRect(mx + c.x * s - 2, my + c.y * s - 2, 4, 4);
  // player arrow
  ctx.save();
  ctx.translate(mx + G.x * s, my + G.y * s);
  ctx.rotate(G.a);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -4.5); ctx.lineTo(-5, 4.5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
  ctx.strokeRect(mx - 4.5, my - 4.5, mw + 9, mh + 9);
}
export function drawHUD(ctx) {
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  // wanted stars
  for (let i = 0; i < 5; i++) star(ctx, 26 + i * 26, 30, 11, i < G.stars);
  // cash + health
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#58d68d';
  ctx.fillText(fmtCash(G.cash), 16, 66);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(16, 74, 130, 10);
  ctx.fillStyle = G.health > 50 ? '#2ecc71' : G.health > 25 ? '#f39c12' : '#e74c3c';
  ctx.fillRect(16, 74, 130 * Math.max(0, G.health / 100), 10);
  ctx.font = '13px sans-serif'; ctx.fillStyle = '#fff';
  ctx.fillText(G.weapon === 1 ? `PISTOL ${G.ammo}` : 'FISTS', 16, 102);
  drawMinimap(ctx);
  // objective
  const obj = objectiveText();
  ctx.font = 'bold 15px sans-serif';
  const ow = ctx.measureText(obj).width + 24;
  pill(ctx, (VW - ow) / 2, 12, ow, 28);
  ctx.fillStyle = '#ffd60a'; ctx.textAlign = 'center';
  ctx.fillText(obj, VW / 2, 31);
  ctx.textAlign = 'left';
  // time, radio, speed, controls hint — hidden while a dialogue box
  // is open, since the box covers the bottom-left corner
  if (!G.dlg) {
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#fff';
    const tod = G.time >= 6 && G.time < 18 ? 'DAY' : G.time >= 17 && G.time < 20 ? 'SUNSET' : 'NIGHT';
    ctx.fillText(`${fmtTime(G.time)} · DAY ${G.day} · ${tod}`, 16, VH - 44);
    ctx.fillText(`♪ ${STATION_NAMES[G.radio]}${G.muted ? ' (muted)' : ''} · R radio · M mute`, 16, VH - 24);
  }
  if (!G.onFoot && G.car) {
    ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Math.abs(G.car.sp) / 4)} mph`, VW - 16, VH - 24);
    ctx.textAlign = 'left';
  }
  if (!G.dlg) {
    ctx.font = '12px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('E interact · F side job · SPACE punch/brake · ESC pause', 16, VH - 64);
  }
  // toast
  if (G.toastT > 0) {
    ctx.font = 'bold 16px sans-serif';
    const tw = ctx.measureText(G.toast).width + 24;
    ctx.globalAlpha = Math.min(1, G.toastT);
    pill(ctx, (VW - tw) / 2, VH - 170, tw, 30);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(G.toast, VW / 2, VH - 150);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }
  // dialogue
  if (G.dlg) {
    const d = G.dlg;
    pill(ctx, 140, VH - 150, VW - 280, 110, 0.82);
    ctx.fillStyle = '#ffd60a'; ctx.font = 'bold 17px sans-serif';
    ctx.fillText(d.who, 160, VH - 122);
    ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif';
    const line = d.lines[d.i] || '';
    // simple wrap at 90 chars
    const words = line.split(' ');
    let row = '', y = VH - 96;
    for (const w of words) {
      if ((row + ' ' + w).trim().length > 92) { ctx.fillText(row.trim(), 160, y); y += 22; row = w; }
      else row += ' ' + w;
    }
    ctx.fillText(row.trim(), 160, y);
    ctx.fillStyle = '#ffd60a'; ctx.font = '13px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('E / Enter ▸', VW - 160, VH - 58);
    ctx.textAlign = 'left';
  }
}
export function drawTitle(ctx) {
  ctx.fillStyle = 'rgba(4,8,18,0.62)'; ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd60a';
  ctx.font = 'bold 92px sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 18;
  ctx.fillText('PALMA VERDE', VW / 2, 250);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff'; ctx.font = '22px sans-serif';
  ctx.fillText('A coastal open-world crime game — steal, drive, run jobs, lose the cops', VW / 2, 292);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#58d68d';
  ctx.fillText('ENTER — New Game', VW / 2, 380);
  if (hasSave()) { ctx.fillStyle = '#fff'; ctx.fillText('C — Continue', VW / 2, 414); }
  ctx.font = '15px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const lines = [
    'WASD / arrows — walk & drive · E — get in a car, talk, use shops · SPACE — punch / handbrake',
    'Mouse — aim & shoot (pistol) · 1 / 2 — fists / pistol · F — taxi & vigilante jobs · R — radio · M — mute',
    'Steal a car in front of a witness and the heat rises. Busted or wasted costs 10% of your cash.',
    'Eight story missions for Delia and Rico · 15 hidden packages · stunt jumps · Pay N Spray clears the heat',
  ];
  lines.forEach((l, i) => ctx.fillText(l, VW / 2, 470 + i * 26));
  ctx.font = '13px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('An original game made for make.fun — no Rockstar / GTA content, all art and music drawn and synthesized in code.', VW / 2, VH - 30);
  ctx.textAlign = 'left';
}
export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(4,8,18,0.6)'; ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', VW / 2, 300);
  ctx.font = '17px sans-serif';
  ctx.fillText(`Cash ${fmtCash(G.cash)} · Missions ${Math.min(G.mission.idx, MISSIONS.length)}/8 · Packages ${G.stats.pkgs}/15 · Fares ${G.stats.fares}`, VW / 2, 350);
  ctx.fillText('ESC — resume · ENTER — resume', VW / 2, 390);
  ctx.textAlign = 'left';
}
export function drawEndCard(ctx, kind) {
  ctx.fillStyle = 'rgba(10,4,8,0.72)'; ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'busted' ? '#5dade2' : '#ff5b5b';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', VW / 2, 330);
  ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
  ctx.fillText(G.msg, VW / 2, 380);
  ctx.fillText('ENTER — back on the streets', VW / 2, 430);
  ctx.textAlign = 'left';
}
