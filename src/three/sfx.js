// Small synthesised sound effects (no audio files). Ported from Iron Rail Duel.
let ctx = null;
let master = null;
let noise = null;
let on = true;

try {
  on = window.localStorage.getItem('iron-rails-sound') !== 'off';
} catch {
  on = true;
}

function init() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

function burst(dur, type, f0, f1, vol, q = 1) {
  if (!ctx || !on) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(f0, t);
  filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

function tone(freqs, dur, vol, type = 'sine') {
  if (!ctx || !on) return;
  const t = ctx.currentTime;
  for (const freq of freqs) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.05);
    gain.gain.setValueAtTime(vol, t + dur - 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

export const sfx = {
  init,
  get on() {
    return on;
  },
  toggle() {
    on = !on;
    try {
      window.localStorage.setItem('iron-rails-sound', on ? 'on' : 'off');
    } catch {
      // Storage can be blocked; the toggle still works for this visit.
    }
    if (on) init();
    return on;
  },
  chuff: (v) => burst(0.12, 'bandpass', 900, 400, 0.05 + Math.min(60, v) * 0.0008, 0.8),
  whoosh: () => burst(0.55, 'bandpass', 400, 2400, 0.35, 2),
  rumble: () => burst(0.6, 'lowpass', 200, 90, 0.35),
  thunder: () => {
    burst(0.15, 'highpass', 3000, 1200, 0.5);
    burst(1.4, 'lowpass', 600, 60, 0.7);
  },
  boom: (big) => burst(big ? 0.7 : 0.45, 'lowpass', 1200, 80, big ? 0.6 : 0.45),
  chime: () => tone([880, 1320], 0.5, 0.06, 'triangle'),
  siphon: () => tone([330, 247, 196], 0.8, 0.05, 'sawtooth'),
  whistle: () => tone([587, 740, 880], 1.1, 0.05, 'square'),
  alert: () => tone([392, 370, 349, 330], 1.2, 0.06, 'sawtooth'),
  win: () => tone([523, 659, 784, 1046], 1.4, 0.05, 'triangle'),
  lose: () => tone([392, 330, 262], 1.2, 0.05, 'triangle'),
};
