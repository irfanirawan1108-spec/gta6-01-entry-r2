// Sound: three synth radio stations (Web Audio only, no files) plus
// small synthesized effects. Everything starts on a user gesture;
// screenshot mode never starts audio.
import { G } from './state.js';

let ctx = null, master = null, noiseBuf = null;
let schedTimer = null, step = 0, nextT = 0;
let engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;

// 16-step patterns per station: [bass notes (Hz, 0 = rest), lead notes, bpm]
const STATIONS = [
  { name: 'SUNSET FM', bpm: 92, bass: [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 65.4, 0], lead: [220, 0, 261.6, 0, 329.6, 0, 293.7, 0, 220, 0, 246.9, 0, 293.7, 0, 329.6, 0] },
  { name: 'PALMA HEAT', bpm: 128, bass: [55, 55, 0, 55, 65.4, 0, 55, 0, 49, 49, 0, 49, 58.3, 0, 65.4, 73.4], lead: [440, 0, 0, 440, 0, 523.3, 0, 0, 440, 0, 0, 440, 587.3, 0, 523.3, 0] },
  { name: 'NEON DRIVE', bpm: 110, bass: [65.4, 0, 82.4, 0, 98, 0, 82.4, 0, 65.4, 0, 82.4, 0, 110, 0, 98, 0], lead: [261.6, 329.6, 392, 329.6, 261.6, 329.6, 392, 493.9, 440, 392, 329.6, 392, 440, 493.9, 523.3, 0] },
];
export const STATION_NAMES = STATIONS.map((s) => s.name);

export function ensureAudio() {
  if (ctx || G.shot) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(engineGain); engineGain.connect(master); engineOsc.start();
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
    nextT = ctx.currentTime + 0.1;
    schedTimer = setInterval(schedule, 90);
  } catch { ctx = null; }
}
function note(freq, at, dur, type, gain) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  o.connect(g); g.connect(master);
  o.start(at); o.stop(at + dur + 0.02);
}
function schedule() {
  if (!ctx || G.muted) return;
  const st = STATIONS[G.radio];
  const spb = 60 / st.bpm / 4; // 16th notes
  while (nextT < ctx.currentTime + 0.25) {
    const s = step % 16;
    const b = st.bass[s], l = st.lead[s];
    if (b) note(b, nextT, spb * 1.8, 'triangle', 0.16);
    if (l) note(l, nextT, spb * 1.4, 'square', 0.045);
    if (s % 4 === 2) { // hat
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.05, nextT);
      g.gain.exponentialRampToValueAtTime(0.001, nextT + 0.05);
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
      src.connect(f); f.connect(g); g.connect(master);
      src.start(nextT); src.stop(nextT + 0.06);
    }
    step++; nextT += spb;
  }
  // engine hum follows the driven car; siren wails while wanted
  if (engineGain) {
    const driving = !G.onFoot && G.car;
    engineGain.gain.value = driving ? 0.02 + Math.abs(G.car.sp) / 460 * 0.05 : 0;
    if (driving) engineOsc.frequency.value = 50 + Math.abs(G.car.sp) / 4;
  }
  if (sirenGain) {
    const on = G.stars >= 2;
    sirenGain.gain.value = on ? 0.03 : 0;
    if (on) sirenOsc.frequency.value = 650 + Math.sin(performance.now() / 300) * 180;
  }
}
export function setStation(i) { G.radio = (i + STATIONS.length) % STATIONS.length; }
export function toggleMute() {
  G.muted = !G.muted;
  if (master) master.gain.value = G.muted ? 0 : 0.5;
}
export function sfx(name) {
  if (!ctx || G.muted) return;
  const t = ctx.currentTime;
  if (name === 'pickup') { note(660, t, 0.09, 'sine', 0.12); note(990, t + 0.08, 0.12, 'sine', 0.12); }
  else if (name === 'punch') { note(120, t, 0.08, 'square', 0.1); }
  else if (name === 'shot') {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(g); g.connect(master); src.start(t); src.stop(t + 0.13);
  }
  else if (name === 'crash') { note(70, t, 0.25, 'sawtooth', 0.14); }
  else if (name === 'jump') { note(300, t, 0.3, 'sine', 0.1); note(600, t + 0.1, 0.3, 'sine', 0.08); }
  else if (name === 'busted') { note(392, t, 0.2, 'square', 0.1); note(311, t + 0.2, 0.2, 'square', 0.1); note(233, t + 0.4, 0.4, 'square', 0.1); }
  else if (name === 'horn') { note(370, t, 0.25, 'sawtooth', 0.08); note(466, t, 0.25, 'sawtooth', 0.06); }
}
