// Local procedural sound design (WebAudio, no external assets). Each gameplay event has its own voice.
let ctx: AudioContext | null = null; let master: GainNode | null = null; let vol = 0.6, muted = false; let noiseBuf: AudioBuffer | null = null;
let ambient: { rain: GainNode; wind: GainNode } | null = null;
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new AudioContext(); } catch { return; }
  master = ctx.createGain(); master.gain.value = muted ? 0 : vol; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const loop = (freq: number, q: number) => { const s = ctx!.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx!.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; const g = ctx!.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(master!); s.start(); return g; };
  ambient = { rain: loop(2400, 0.6), wind: loop(380, 0.8) };
}
export function setVolume(v: number, m: boolean) { vol = v; muted = m; if (master) master.gain.value = m ? 0 : v; }
export function setAmbience(rain: number, wind: number) { if (!ambient || !ctx) return; ambient.rain.gain.setTargetAtTime(rain * 0.18, ctx.currentTime, 0.8); ambient.wind.gain.setTargetAtTime(wind * 0.12, ctx.currentTime, 1.2); }
function tone(f0: number, f1: number, dur: number, type: OscillatorType = 'square', gain = 0.15, delay = 0) {
  if (!ctx || !master) return; const t = ctx.currentTime + delay; const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur: number, freq: number, gain = 0.2, type: BiquadFilterType = 'lowpass', delay = 0, q = 1) {
  if (!ctx || !master || !noiseBuf) return; const t = ctx.currentTime + delay; const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
}
const last: Record<string, number> = {};
export function sfx(e: any) {
  if (!ctx) return; const now = performance.now(); const k = e.type + (e.mat || ''); if (last[k] && now - last[k] < 40) return; last[k] = now;
  switch (e.type) {
    case 'whoosh': noise(0.12, 1800, 0.08, 'bandpass', 0, 2); break;
    case 'chip': if (e.mat === 'wood') { tone(180, 90, 0.08, 'triangle', 0.25); noise(0.06, 900, 0.15); } else if (e.mat === 'stone' || e.mat === 'ore') { tone(900, 600, 0.06, 'square', 0.08); noise(0.08, 3000, 0.12, 'highpass'); } else if (e.mat === 'scrap') { tone(1400, 1100, 0.12, 'square', 0.06); tone(2100, 1700, 0.1, 'square', 0.04, 0.02); } else noise(0.1, 2600, 0.1, 'bandpass', 0, 1); if (e.depleted) tone(300, 120, 0.25, 'triangle', 0.15, 0.05); break;
    case 'fell': noise(0.5, 400, 0.25); tone(120, 50, 0.4, 'triangle', 0.2, 0.1); break;
    case 'clank': tone(1600, 1500, 0.05, 'square', 0.05); break;
    case 'mhit': tone(220, 80, 0.1, 'square', 0.14); noise(0.08, 1200, 0.18); break;
    case 'phit': tone(160, 60, 0.18, 'sawtooth', 0.16); noise(0.12, 600, 0.2); break;
    case 'mdeath': tone(300, 40, 0.35, 'sawtooth', 0.12); break;
    case 'pickup': tone(660, 990, 0.07, 'square', 0.06); tone(990, 1320, 0.06, 'square', 0.05, 0.05); break;
    case 'step': if (Math.random() < 0.5) noise(0.04, e.t === 9 ? 1500 : e.t === 12 ? 900 : 500, 0.035); break;
    case 'roll': noise(0.18, 700, 0.1); break;
    case 'windup': tone(200, 800, 0.45, 'sine', 0.08); break;
    case 'cast': tone(e.core === 'frost' ? 1200 : 300, e.core === 'frost' ? 400 : 900, 0.25, 'sawtooth', 0.1); noise(0.2, 2000, 0.1); break;
    case 'boom': noise(0.6, 300, 0.4); tone(90, 30, 0.5, 'sine', 0.3); break;
    case 'bolt': case 'lightning': noise(0.3, 5000, 0.25, 'highpass'); tone(80, 40, 0.5, 'sawtooth', 0.12, 0.05); break;
    case 'fizzle': tone(400, 100, 0.25, 'sine', 0.08); break;
    case 'dodge': noise(0.08, 3000, 0.06, 'highpass'); break;
    case 'tell': tone(520, 520, 0.06, 'square', 0.05); break;
    case 'etell': tone(110, 140, 0.5, 'sawtooth', 0.1); break;
    case 'hazfire': noise(0.2, 600, 0.12); break;
    case 'banner': tone(196, 196, 0.6, 'triangle', 0.12); tone(147, 147, 0.8, 'triangle', 0.1, 0.25); break;
    case 'zap': tone(1200, 300, 0.1, 'square', 0.05); break;
    case 'tongue': noise(0.15, 1400, 0.08, 'bandpass', 0, 3); break;
    case 'bowshot': tone(400, 200, 0.08, 'triangle', 0.1); noise(0.1, 2500, 0.06, 'bandpass'); break;
    case 'structhit': tone(140, 90, 0.1, 'square', 0.1); break;
    case 'structbreak': noise(0.5, 500, 0.3); break;
    case 'eat': tone(500, 300, 0.08, 'triangle', 0.08); tone(400, 250, 0.08, 'triangle', 0.08, 0.1); break;
    case 'break': tone(800, 200, 0.3, 'square', 0.08); noise(0.2, 2000, 0.1); break;
    case 'ui': tone(880, 880, 0.03, 'square', 0.04); break;
    case 'deny': tone(200, 150, 0.12, 'square', 0.07); break;
    case 'coin': tone(1320, 1320, 0.06, 'square', 0.06); tone(1760, 1760, 0.12, 'square', 0.05, 0.06); break;
    case 'craft': tone(300, 300, 0.05, 'square', 0.06); tone(450, 450, 0.08, 'square', 0.06, 0.07); break;
    case 'build': noise(0.1, 700, 0.18); tone(150, 100, 0.12, 'triangle', 0.15); break;
    case 'discover': tone(523, 523, 0.15, 'triangle', 0.08); tone(659, 659, 0.15, 'triangle', 0.08, 0.12); tone(784, 784, 0.25, 'triangle', 0.08, 0.24); break;
    case 'ignite': noise(0.4, 1000, 0.1, 'bandpass'); break;
    case 'sniff': tone(300, 350, 0.1, 'sine', 0.04); break;
  }
}
