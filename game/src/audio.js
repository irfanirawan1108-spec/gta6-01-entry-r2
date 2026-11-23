// Synthesised sound only — no audio files. Engine hum, police sirens,
// gunshots, and three radio stations with simple sequenced loops.
// Everything is lazy: the AudioContext starts on the first key press.

export const STATIONS = [
  { name: 'VICE FM', desc: 'synthwave', bpm: 112, root: 55, scale: [0, 3, 5, 7, 10, 12] },
  { name: 'CALLE 8', desc: 'latin groove', bpm: 96, root: 65.41, scale: [0, 2, 3, 5, 7, 8, 10] },
  { name: 'PALMA LO-FI', desc: 'chill', bpm: 76, root: 49, scale: [0, 2, 4, 7, 9, 12] },
];

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    station: 0,
    muted: false,
    step: 0,
    nextStepTime: 0,
    started: false,
  };

  audio.ensure = () => {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = audio.muted ? 0 : 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.musicGain = audio.ctx.createGain();
      audio.musicGain.gain.value = 0.16;
      audio.musicGain.connect(audio.master);
      audio.sfxGain = audio.ctx.createGain();
      audio.sfxGain.gain.value = 0.9;
      audio.sfxGain.connect(audio.master);
      // Engine: two detuned saws through a lowpass.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      const engFilter = audio.ctx.createBiquadFilter();
      engFilter.type = 'lowpass';
      engFilter.frequency.value = 320;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineOsc.connect(engFilter);
      engFilter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
      // Siren: a sine that wails up and down.
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'sine';
      audio.sirenOsc.frequency.value = 700;
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.master);
      audio.sirenOsc.start();
      audio.started = true;
      return true;
    } catch (e) {
      return false;
    }
  };

  audio.setMuted = (m) => {
    audio.muted = m;
    if (audio.master) audio.master.gain.value = m ? 0 : 0.5;
  };

  audio.setEngine = (speed01, on) => {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    audio.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.075 : 0, t, 0.08);
    audio.engineOsc.frequency.setTargetAtTime(48 + speed01 * 130, t, 0.1);
  };

  audio.setSiren = (on) => {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    audio.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, t, 0.2);
    if (on) {
      const wail = 700 + Math.sin(t * 2.4) * 260;
      audio.sirenOsc.frequency.setTargetAtTime(wail, t, 0.05);
    }
  };

  function blip(freq, dur, type, vol, when = 0) {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime + when;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(audio.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, when = 0) {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime + when;
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    const f = audio.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = audio.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(audio.sfxGain);
    src.start(t);
  }

  audio.sfx = (name) => {
    if (!audio.ctx || audio.muted) return;
    switch (name) {
      case 'punch': noise(0.08, 0.5, 900); break;
      case 'gun': noise(0.14, 0.7, 2600); blip(180, 0.1, 'square', 0.25); break;
      case 'crash': noise(0.35, 0.8, 500); break;
      case 'pickup': blip(660, 0.09, 'sine', 0.4); blip(990, 0.12, 'sine', 0.4, 0.08); break;
      case 'cash': blip(880, 0.08, 'triangle', 0.35); blip(1174, 0.1, 'triangle', 0.35, 0.07); blip(1568, 0.16, 'triangle', 0.35, 0.14); break;
      case 'mission': [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.16, 'triangle', 0.4, i * 0.1)); break;
      case 'fail': [392, 330, 262].forEach((f, i) => blip(f, 0.2, 'sawtooth', 0.25, i * 0.12)); break;
      case 'horn': blip(370, 0.18, 'square', 0.2); blip(466, 0.18, 'square', 0.18); break;
      case 'door': noise(0.12, 0.4, 700); break;
      case 'jump': blip(300, 0.3, 'sine', 0.3); break;
      case 'busted': [220, 196, 165].forEach((f, i) => blip(f, 0.3, 'sawtooth', 0.3, i * 0.18)); break;
      case 'click': blip(800, 0.05, 'square', 0.2); break;
      default: break;
    }
  };

  // One sequencer step: bass note + hat + occasional lead, per station.
  audio.musicStep = () => {
    if (!audio.ctx || audio.muted) return;
    const st = STATIONS[audio.station];
    const stepDur = 60 / st.bpm / 2; // eighth notes
    const now = audio.ctx.currentTime;
    if (audio.nextStepTime < now) audio.nextStepTime = now + 0.05;
    const s = audio.step;
    const scale = st.scale;
    const root = st.root;
    // Bass on beats 0 and 4, root or fifth.
    if (s % 8 === 0 || s % 8 === 4) {
      const f = root * (s % 16 === 4 ? 1.5 : 1);
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.5, audio.nextStepTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.nextStepTime + stepDur * 1.8);
      o.connect(g);
      g.connect(audio.musicGain);
      o.start(audio.nextStepTime);
      o.stop(audio.nextStepTime + stepDur * 2);
    }
    // Lead pluck every other bar, pentatonic walk.
    if (s % 16 === 8 || s % 16 === 12) {
      const deg = scale[(s * 7 + 3) % scale.length];
      const f = root * 4 * Math.pow(2, deg / 12);
      blipAt(audio, f, 0.22, 'square', 0.12, audio.nextStepTime);
    }
    // Hat tick.
    hatAt(audio, audio.nextStepTime, s % 2 === 0 ? 0.05 : 0.03);
    audio.step = (s + 1) % 64;
    audio.nextStepTime += stepDur;
  };

  audio.update = (dt) => {
    if (!audio.ctx || audio.muted) return;
    const st = STATIONS[audio.station];
    const stepDur = 60 / st.bpm / 2;
    const now = audio.ctx.currentTime;
    // Schedule a few steps ahead.
    let guard = 0;
    while (audio.nextStepTime < now + 0.15 && guard < 8) {
      audio.musicStep();
      guard++;
    }
    void dt;
    void stepDur;
  };

  return audio;
}

function blipAt(audio, freq, dur, type, vol, when) {
  const o = audio.ctx.createOscillator();
  const g = audio.ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + dur);
  o.connect(g);
  g.connect(audio.musicGain);
  o.start(when);
  o.stop(when + dur + 0.02);
}

function hatAt(audio, when, vol) {
  const len = Math.floor(audio.ctx.sampleRate * 0.03);
  const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = audio.ctx.createBufferSource();
  src.buffer = buf;
  const f = audio.ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 7000;
  const g = audio.ctx.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(audio.musicGain);
  src.start(when);
}
