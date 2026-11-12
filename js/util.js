'use strict';
// ---------- Perusapuvälineet ----------
const V3 = THREE.Vector3;
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let _rng = mulberry32(20240611);
const rng = () => _rng();
const rand = (a, b) => a + (b - a) * rng();
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (a) => a[Math.floor(rng() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function hex(h) { return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]; }
function tint(h, amt) { // satunnaisvaihtelu väriin
  const c = hex(h);
  const k = 1 + (rng() - 0.5) * amt;
  return [clamp(c[0] * k, 0, 1), clamp(c[1] * k, 0, 1), clamp(c[2] * k, 0, 1)];
}

// ---------- Proseduraaliset tekstuurit ----------
function canvasTex(size, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
function speckle(g, s, n, cols, minS, maxS, alpha) {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * (0.3 + Math.random() * 0.7);
    g.fillStyle = cols[Math.floor(Math.random() * cols.length)];
    const w = minS + Math.random() * (maxS - minS);
    g.fillRect(Math.random() * s, Math.random() * s, w, w * (0.5 + Math.random()));
  }
  g.globalAlpha = 1;
}

const Tex = {};
function makeTextures() {
  // Rappaus + ikkuna + hirsikehys. Yksi laatta = 4 m x 4 m
  Tex.wall = canvasTex(256, (g, s) => {
    g.fillStyle = '#e9dfc9'; g.fillRect(0, 0, s, s);
    speckle(g, s, 900, ['#d8ccb0', '#f2eada', '#cfc2a5', '#bfb396'], 1, 4, 0.5);
    // hirsikehys
    g.fillStyle = '#5a3e2a';
    g.fillRect(0, 0, s, 12); g.fillRect(0, 0, 12, s); g.fillRect(s - 12, 0, 12, s);
    // vinot tukipuut
    g.strokeStyle = '#5a3e2a'; g.lineWidth = 8;
    g.beginPath(); g.moveTo(12, s - 12); g.lineTo(60, 128); g.stroke();
    g.beginPath(); g.moveTo(s - 12, s - 12); g.lineTo(s - 60, 128); g.stroke();
    // ikkuna
    g.fillStyle = '#7a5a3c'; g.fillRect(88, 84, 80, 96);
    g.fillStyle = '#2b3a4a'; g.fillRect(96, 92, 64, 80);
    g.fillStyle = 'rgba(180,210,240,.25)'; g.fillRect(96, 92, 64, 30);
    g.fillStyle = '#7a5a3c'; g.fillRect(126, 92, 4, 80); g.fillRect(96, 128, 64, 4);
    // ikkunaluukut
    g.fillStyle = '#6b3b2a'; g.fillRect(70, 86, 16, 92); g.fillRect(170, 86, 16, 92);
    g.fillStyle = '#a89878'; g.fillRect(84, 180, 88, 8);
  });
  Tex.stone = canvasTex(256, (g, s) => {
    g.fillStyle = '#9b9a94'; g.fillRect(0, 0, s, s);
    speckle(g, s, 900, ['#85847e', '#b0afa8', '#77766f', '#a5a49c'], 2, 6, 0.5);
    g.strokeStyle = '#5f5e58'; g.lineWidth = 3;
    const rows = 8, rh = s / rows;
    for (let r = 0; r < rows; r++) {
      g.beginPath(); g.moveTo(0, r * rh); g.lineTo(s, r * rh); g.stroke();
      const off = (r % 2) * 32;
      for (let x = off; x < s + 64; x += 64) { g.beginPath(); g.moveTo(x, r * rh); g.lineTo(x, (r + 1) * rh); g.stroke(); }
    }
  });
  Tex.roof = canvasTex(256, (g, s) => {
    g.fillStyle = '#a4553a'; g.fillRect(0, 0, s, s);
    const rows = 10, rh = s / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * 12;
      for (let x = -12 + off; x < s; x += 24) {
        g.fillStyle = ['#a4553a', '#94472f', '#b46444', '#8a4029'][Math.floor(Math.random() * 4)];
        g.fillRect(x + 1, r * rh + 1, 22, rh - 2);
      }
    }
  });
  Tex.wood = canvasTex(128, (g, s) => {
    g.fillStyle = '#7b5a3a'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 16; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#6a4b2e' : '#8a6845';
      g.fillRect(0, i * 8, s, 7);
    }
    speckle(g, s, 200, ['#5a3f27', '#94724c'], 1, 3, 0.5);
  });
  Tex.ground = canvasTex(512, (g, s) => {
    g.fillStyle = '#7d756a'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * s, y = Math.random() * s, w = 14 + Math.random() * 16, h = 10 + Math.random() * 12;
      const v = 90 + Math.random() * 50;
      g.fillStyle = `rgb(${v + 12},${v + 6},${v - 4})`;
      g.beginPath(); g.ellipse(x, y, w / 2, h / 2, Math.random() * 3, 0, 7); g.fill();
      g.strokeStyle = 'rgba(40,36,30,.6)'; g.lineWidth = 1.5; g.stroke();
    }
  });
  Tex.grass = canvasTex(256, (g, s) => {
    g.fillStyle = '#5f7a3c'; g.fillRect(0, 0, s, s);
    speckle(g, s, 2500, ['#6f8c45', '#4f6a30', '#7a9650', '#56733a'], 1, 3, 0.6);
  });
  Tex.cloth = canvasTex(128, (g, s) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#d7c9b0'; g.fillRect(i * 16, 0, 16, s); }
  });
  Tex.hay = canvasTex(128, (g, s) => {
    g.fillStyle = '#d6b44a'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 400; i++) {
      g.strokeStyle = ['#e8cb6a', '#b89530', '#c9a43c'][Math.floor(Math.random() * 3)];
      g.lineWidth = 1;
      const x = Math.random() * s, y = Math.random() * s;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - .5) * 18, y + (Math.random() - .5) * 18); g.stroke();
    }
  });
  Tex.flat = canvasTex(8, (g, s) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); });
}

function iconTexture(txt, color) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 54px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(txt, 32, 34);
  g.fillStyle = color; g.fillText(txt, 32, 34);
  return new THREE.CanvasTexture(c);
}
function diamondTexture(color) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 32); g.rotate(Math.PI / 4);
  g.fillStyle = color; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 5;
  g.fillRect(-14, -14, 28, 28); g.strokeRect(-14, -14, 28, 28);
  return new THREE.CanvasTexture(c);
}

// ---------- Äänet (WebAudio, kaikki generoitu) ----------
const Sfx = {
  ctx: null, wind: null, windGain: null,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = last * 3.5; }
      this.noiseBuf = buf;
      const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6;
      this.windGain = this.ctx.createGain(); this.windGain.gain.value = 0.0;
      src.connect(f); f.connect(this.windGain); this.windGain.connect(this.ctx.destination);
      src.start();
      this.windFilter = f;
      // kaupungin humina
      const s2 = this.ctx.createBufferSource(); s2.buffer = buf; s2.loop = true; s2.playbackRate.value = 0.6;
      const f2 = this.ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 280; f2.Q.value = 0.5;
      this.murGain = this.ctx.createGain(); this.murGain.gain.value = 0.0;
      s2.connect(f2); f2.connect(this.murGain); this.murGain.connect(this.ctx.destination); s2.start(0, 0.3);
    } catch (e) { this.ctx = null; }
  },
  tone(f, dur, type = 'sine', vol = 0.15, slide = 0, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.2, freq = 1200, type = 'lowpass', delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.ctx.destination); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  },
  step(kind) {
    if (kind === 'wood') { this.tone(110, 0.08, 'triangle', 0.07, -40); this.noise(0.05, 0.06, 400); }
    else if (kind === 'roof') this.noise(0.06, 0.08, 800);
    else if (kind === 'hay') this.noise(0.1, 0.07, 3000, 'highpass');
    else if (kind === 'grass') this.noise(0.09, 0.06, 900, 'bandpass');
    else if (kind === 'water') this.noise(0.16, 0.1, 1400, 'bandpass');
    else this.noise(0.07, 0.10, 500);
  },
  climb() { this.noise(0.09, 0.07, 1500, 'bandpass'); },
  whoosh(v) { this.noise(0.25, clamp(v / 60, 0.05, 0.25), 2500, 'bandpass'); },
  musicOn: true, mus: null,
  musicStart() {
    if (!this.ctx || this.mus) return;
    const c = this.ctx; this.mus = { nt: 2, kt: 0, bt: 25 };
    const pf = c.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 520;
    this.padGain = c.createGain(); this.padGain.gain.value = 0.0; pf.connect(this.padGain); this.padGain.connect(c.destination);
    [110, 164.81, 220, 277.18].forEach((f, i) => { const o = c.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f * (1 + (i - 1.5) * 0.002); o.connect(pf); o.start(); });
    const lfo = c.createOscillator(); lfo.frequency.value = 0.08; const lg = c.createGain(); lg.gain.value = 180; lfo.connect(lg); lg.connect(pf.frequency); lfo.start();
    this.padFilter = pf;
  },
  musicTick(dt, tension) {
    if (!this.ctx || !this.mus) return;
    const m = this.mus, now = this.ctx.currentTime;
    if (!this.musicOn) { this.padGain.gain.setTargetAtTime(0, now, 0.3); return; }
    this.padGain.gain.setTargetAtTime(0.03 + tension * 0.035, now, 0.8);
    m.nt -= dt;
    if (m.nt <= 0) {
      const sc = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33], f = sc[Math.floor(Math.random() * sc.length)];
      this.tone(f, 1.8, 'triangle', 0.03 + tension * 0.02); this.tone(f * 2, 1.2, 'sine', 0.012, 0, 0.01);
      m.nt = (1.5 + Math.random() * 3) / (1 + tension * 1.6);
    }
    if (tension > 0.4) { m.kt -= dt; if (m.kt <= 0) { this.tone(70, 0.22, 'sine', 0.16, -40); m.kt = 0.55 - tension * 0.12; } }
    m.bt -= dt;
    if (m.bt <= 0) { [392, 784, 1176].forEach((f, i) => this.tone(f, 3.2, 'sine', 0.045 / (i + 1))); m.bt = 50 + Math.random() * 30; }
  },
  jump() { this.tone(180, 0.12, 'triangle', 0.08, 120); },
  land(v) { this.noise(0.18, clamp(v / 30, 0.1, 0.5), 300); },
  hit() { this.noise(0.12, 0.3, 3000, 'bandpass'); this.tone(220, 0.1, 'square', 0.08, -120); },
  swing() { this.noise(0.15, 0.12, 2200, 'highpass'); },
  clang() { this.tone(1400, 0.25, 'triangle', 0.12, -300); this.noise(0.1, 0.2, 5000, 'highpass'); },
  kill() { this.noise(0.25, 0.28, 900); this.tone(110, 0.3, 'sawtooth', 0.08, -60); },
  alert() { this.tone(520, 0.18, 'square', 0.1, 0); this.tone(700, 0.3, 'square', 0.1, 0, 0.12); },
  pickup() { [660, 880, 1320].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.1, 0, i * 0.07)); },
  sync() { [262, 330, 392, 523].forEach((f, i) => this.tone(f, 1.4, 'sine', 0.09, 0, i * 0.12)); },
  hurt() { this.tone(140, 0.2, 'sawtooth', 0.12, -60); },
  bolt() { this.noise(0.1, 0.2, 1800, 'bandpass'); },
  setWind(h, spd) {
    if (this.windGain) this.windGain.gain.value = clamp(h / 45, 0, 1) * 0.22 + clamp((spd || 0) / 40, 0, 1) * 0.25 + 0.01;
    if (this.windFilter) this.windFilter.frequency.value = 400 + (spd || 0) * 25;
    if (this.murGain) this.murGain.gain.value = clamp(1 - h / 35, 0, 1) * 0.05;
  },
};
