// Every sound in the game is synthesised here: no audio files. Gunfire is filtered noise with a
// low thump, quieter and duller with distance and delayed by the speed of sound; the rest are
// short tones and noises. Sound starts with the first click or tap, as browsers require.

const SHOT = {
  pistol: { f: 1900, q: 0.8, len: 0.11, thump: 150, gain: 0.5 },
  smg: { f: 1700, q: 0.9, len: 0.09, thump: 170, gain: 0.42 },
  carbine: { f: 1300, q: 0.7, len: 0.14, thump: 120, gain: 0.55 },
  rifle: { f: 1000, q: 0.7, len: 0.2, thump: 95, gain: 0.7 },
  dmr: { f: 950, q: 0.7, len: 0.24, thump: 90, gain: 0.72 },
  sniper: { f: 700, q: 0.6, len: 0.4, thump: 70, gain: 0.9 },
  shotgun: { f: 600, q: 0.5, len: 0.3, thump: 80, gain: 0.85 },
  lmg: { f: 1050, q: 0.7, len: 0.15, thump: 100, gain: 0.6 },
  e_pistol: { f: 1900, q: 0.8, len: 0.11, thump: 150, gain: 0.45 },
  e_smg: { f: 1700, q: 0.9, len: 0.09, thump: 170, gain: 0.4 },
  e_rifle: { f: 1200, q: 0.7, len: 0.15, thump: 115, gain: 0.5 },
  e_lmg: { f: 1000, q: 0.7, len: 0.15, thump: 100, gain: 0.55 },
  e_dmr: { f: 900, q: 0.7, len: 0.26, thump: 85, gain: 0.7 },
  e_shotgun: { f: 600, q: 0.5, len: 0.3, thump: 80, gain: 0.75 },
  s_rifle: { f: 1300, q: 0.7, len: 0.14, thump: 120, gain: 0.45 },
  s_carbine: { f: 1300, q: 0.7, len: 0.14, thump: 120, gain: 0.45 },
  s_dmr: { f: 950, q: 0.7, len: 0.24, thump: 90, gain: 0.6 },
  s_lmg: { f: 1050, q: 0.7, len: 0.15, thump: 100, gain: 0.5 },
  s_smg: { f: 1700, q: 0.9, len: 0.09, thump: 170, gain: 0.3 },
  s_shotgun: { f: 600, q: 0.5, len: 0.3, thump: 80, gain: 0.7 },
};

export class GameAudio {
  constructor(getVolume) {
    this.getVolume = getVolume;
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.wind = null;
    this.lastStep = 0;
    this.shots = 0;
    this.shotWindow = 0;
    this.chirpAt = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx.state === 'running';
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.getVolume();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    // wind: a bed of low noise that swells and dies
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    this.wind = ctx.createGain();
    this.wind.gain.value = 0.0;
    src.connect(lp);
    lp.connect(this.wind);
    this.wind.connect(this.master);
    src.start();
    return ctx.state === 'running';
  }

  // ---------- building blocks ----------
  burst({ at = 0, len = 0.1, type = 'bandpass', f = 1000, f1 = null, q = 1, gain = 0.3, pan = 0 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f, t);
    if (f1) filter.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    src.connect(filter);
    filter.connect(g);
    this.out(g, pan);
    src.start(t, Math.random(), len + 0.05);
  }

  tone({ at = 0, len = 0.12, f = 440, f1 = null, type = 'sine', gain = 0.2, pan = 0, attack = 0.005 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    osc.connect(g);
    this.out(g, pan);
    osc.start(t);
    osc.stop(t + len + 0.05);
  }

  out(node, pan) {
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p);
      p.connect(this.master);
    } else node.connect(this.master);
  }

  // Where a sound at (x, z) sits for this listener: distance and left/right.
  place(x, z, p) {
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.hypot(dx, dz);
    const rel = Math.atan2(dx, -dz) - p.yaw;
    return { d, pan: d < 1 ? 0 : Math.sin(rel) * Math.min(1, d / 12) };
  }

  gunshot(kind, loud, d, pan) {
    const s = SHOT[kind] ?? SHOT.carbine;
    // too many at once just turns to mush: thin out distant automatic fire
    const now = this.ctx.currentTime;
    if (now - this.shotWindow > 0.25) {
      this.shotWindow = now;
      this.shots = 0;
    }
    if (++this.shots > 9 && d > 20) return;
    const near = 1 / (1 + d / 28);
    const delay = Math.min(1.2, d / 343);
    if (!loud) {
      this.burst({ at: delay, len: 0.07, type: 'highpass', f: 2600, q: 0.6, gain: 0.16 * near, pan });
      this.tone({ at: delay, len: 0.04, f: 240, f1: 120, gain: 0.12 * near, pan });
      return;
    }
    const dull = Math.max(0.25, 1 - d / 500);
    this.burst({ at: delay, len: s.len * (1 + d / 300), type: 'lowpass', f: s.f * 4 * dull, f1: s.f * 0.5 * dull, q: s.q, gain: s.gain * near, pan });
    this.tone({ at: delay, len: s.len * 0.9, f: s.thump, f1: s.thump * 0.45, type: 'triangle', gain: s.gain * 0.9 * near, pan });
    if (d > 60) this.burst({ at: delay + 0.05, len: 0.5, type: 'lowpass', f: 500, f1: 160, gain: s.gain * 0.25 * near, pan });
  }

  // ---------- what the simulation says happened ----------
  play(fx, p) {
    if (!this.ensure()) return;
    switch (fx.t) {
      case 'shot': {
        if (fx.own && fx.first === false) return; // one bang per shot, not per pellet
        const { d, pan } = fx.own ? { d: 0, pan: 0 } : this.place(fx.x, fx.z, p);
        this.gunshot(fx.weapon, fx.loud, d, pan);
        break;
      }
      case 'explosion': {
        const { d, pan } = this.place(fx.x, fx.z, p);
        const near = 1 / (1 + d / 45);
        const delay = Math.min(1.5, d / 343);
        this.tone({ at: delay, len: 0.9, f: 95, f1: 28, type: 'sine', gain: 1.0 * near, pan });
        this.burst({ at: delay, len: 1.3, type: 'lowpass', f: 1400, f1: 90, gain: 0.9 * near, pan });
        break;
      }
      case 'flashbang':
        this.burst({ len: 0.25, type: 'highpass', f: 1500, gain: 0.6 });
        this.tone({ at: 0.05, len: 2.2, f: 3400, gain: 0.08 });
        break;
      case 'step': {
        const now = this.ctx.currentTime;
        if (now - this.lastStep < 0.12) return;
        this.lastStep = now;
        const soft = fx.ground === 3 || fx.ground === 1 || fx.ground === 6;
        this.burst({ len: 0.07, type: 'lowpass', f: soft ? 420 : 760, gain: 0.07 * fx.loud + 0.02 });
        break;
      }
      case 'land':
        this.tone({ len: 0.12, f: 90, f1: 50, gain: 0.25 });
        break;
      case 'jump':
      case 'climb':
        this.burst({ len: 0.1, type: 'lowpass', f: 500, gain: 0.07 });
        break;
      case 'reload':
        this.burst({ len: 0.04, type: 'highpass', f: 2200, gain: 0.14 });
        this.burst({ at: Math.max(0.25, fx.seconds * 0.5), len: 0.05, type: 'bandpass', f: 1500, q: 3, gain: 0.16 });
        this.burst({ at: Math.max(0.5, fx.seconds - 0.18), len: 0.05, type: 'highpass', f: 2600, gain: 0.2 });
        break;
      case 'dry':
      case 'swap':
        this.burst({ len: 0.035, type: 'highpass', f: 3000, gain: 0.13 });
        break;
      case 'hitmark':
        this.tone({ len: 0.05, f: fx.kill ? 1250 : 1850, type: 'square', gain: 0.06 });
        if (fx.kill) this.tone({ at: 0.07, len: 0.09, f: fx.head ? 2100 : 1650, type: 'square', gain: 0.06 });
        break;
      case 'hurt':
        this.tone({ len: 0.16, f: 130, f1: 60, type: 'triangle', gain: 0.4 });
        this.burst({ len: 0.09, type: 'lowpass', f: 900, gain: 0.2 });
        break;
      case 'whizz': {
        const { pan } = this.place(fx.fromX, fx.fromZ, p);
        this.burst({ len: 0.12, type: 'bandpass', f: 3200, f1: 900, q: 5, gain: 0.12, pan: -pan });
        break;
      }
      case 'melee':
      case 'throw':
        this.burst({ len: 0.16, type: 'bandpass', f: 700, f1: 1700, q: 2, gain: 0.1 });
        break;
      case 'takedown':
        this.tone({ len: 0.14, f: 110, f1: 60, type: 'triangle', gain: 0.3 });
        break;
      case 'use':
        this.burst({ len: 0.35, type: 'bandpass', f: 1500, q: 1.5, gain: 0.05 });
        break;
      case 'heal':
      case 'pickup':
        this.tone({ len: 0.08, f: 660, gain: 0.1 });
        this.tone({ at: 0.08, len: 0.12, f: 990, gain: 0.1 });
        break;
      case 'place':
        this.burst({ len: 0.05, type: 'highpass', f: 1800, gain: 0.12 });
        this.tone({ at: 0.1, len: 0.08, f: 1400, type: 'square', gain: 0.04 });
        break;
      case 'tag':
      case 'ping':
        this.tone({ len: 0.09, f: 1250, f1: 1700, gain: 0.09 });
        break;
      case 'alert':
        this.tone({ len: 0.1, f: 520, f1: 760, type: 'sawtooth', gain: 0.05 });
        break;
      case 'alarm':
        for (let i = 0; i < 6; i++) this.tone({ at: i * 0.7, len: 0.65, f: 560, f1: 900, type: 'sawtooth', gain: 0.07, attack: 0.1 });
        break;
      case 'whistle':
        this.tone({ len: 0.5, f: 2500, f1: 2350, gain: 0.08, attack: 0.02 });
        break;
      case 'targetup':
        this.burst({ len: 0.04, type: 'highpass', f: 2000, gain: 0.06 });
        break;
      case 'targethit':
        this.tone({ len: 0.2, f: 1500, f1: 1400, type: 'triangle', gain: 0.12 });
        break;
      case 'gate':
        this.tone({ len: 0.12, f: 880, gain: 0.1 });
        break;
      case 'order':
      case 'radio':
      case 'shout':
        this.burst({ len: 0.05, type: 'bandpass', f: 2200, q: 2, gain: 0.07 });
        this.tone({ at: 0.06, len: 0.07, f: 1100, type: 'square', gain: 0.03 });
        break;
      case 'nvg':
        this.tone({ len: 0.5, f: fx.on ? 400 : 1800, f1: fx.on ? 2400 : 300, gain: 0.04 });
        break;
      case 'jet':
        this.burst({ len: 3.2, type: 'bandpass', f: 300, f1: 2400, q: 0.8, gain: 0.5 });
        break;
      case 'wave':
        this.tone({ len: 0.5, f: 220, type: 'sawtooth', gain: 0.07, attack: 0.05 });
        this.tone({ at: 0.25, len: 0.6, f: 165, type: 'sawtooth', gain: 0.07, attack: 0.05 });
        break;
      case 'skillup':
        this.chord([660, 880], 0.07);
        break;
      case 'objective':
        this.chord([523, 784], 0.09);
        break;
      case 'levelup':
        this.cue('fanfare');
        break;
      case 'missionwon':
        this.chord([392, 523, 659, 784], 0.16, 0.14);
        break;
      case 'missionlost':
      case 'playerdead':
        this.chord([330, 277, 220], 0.2, 0.12);
        break;
      case 'playerdown':
        this.tone({ len: 0.8, f: 180, f1: 60, type: 'triangle', gain: 0.3 });
        break;
      default:
    }
  }

  chord(notes, gap = 0.08, gain = 0.1) {
    notes.forEach((f, i) => this.tone({ at: i * gap, len: 0.35, f, type: 'triangle', gain }));
  }

  cue(name) {
    if (!this.ensure()) return;
    if (name === 'fanfare') this.chord([392, 494, 587, 784], 0.11, 0.13);
    else if (name === 'ui') this.tone({ len: 0.04, f: 900, type: 'square', gain: 0.03 });
  }

  // Wind that follows the weather of the place, and birds by day.
  update(sim, paused) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const volume = this.getVolume();
    this.master.gain.value += (volume * (paused ? 0.35 : 1) - this.master.gain.value) * 0.1;
    const p = sim.player;
    const high = Math.min(1, Math.max(0, (p.y - 20) / 120));
    const swell = 0.5 + 0.5 * Math.sin(sim.time * 0.23) * Math.sin(sim.time * 0.071);
    this.wind.gain.value += (0.025 + 0.05 * swell + 0.08 * high - this.wind.gain.value) * 0.05;
    if (!paused && sim.hour > 6 && sim.hour < 19.5 && sim.time > this.chirpAt && !sim.inFight()) {
      this.chirpAt = sim.time + 2.5 + Math.random() * 7;
      const f = 2400 + Math.random() * 1600;
      const pan = Math.random() * 2 - 1;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.tone({ at: i * 0.13, len: 0.09, f, f1: f * (1.1 + Math.random() * 0.3), gain: 0.012, pan });
    }
  }

  dispose() {
    try {
      this.ctx?.close();
    } catch {
      /* already closed */
    }
    this.ctx = null;
  }
}
