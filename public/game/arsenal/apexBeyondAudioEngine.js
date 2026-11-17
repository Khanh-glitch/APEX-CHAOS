/* =============================================================================
 * APEX CHAOS — BEYOND Audio Synthesis Engine
 * Plugs directly into the existing Apex battle WebAudio graph
 * (window.audioCtx / window.battleAudioMaster) — never creates a second
 * AudioContext, always honors global mute/SFX volume, and enforces strict
 * per-cue polyphony and cooldown throttling.
 * ========================================================================== */
(function installApexBeyondAudio(global) {
  'use strict';
  if (global.APEX_BEYOND_AUDIO) return;

  const lastPlayed = Object.create(null);
  let noiseBuffer = null;

  function getAudioGraph() {
    if (global.apexSfxMuted || global.apexBattleAudioMuted) return null;
    const ac = global.audioCtx;
    if (!ac || ac.state === 'closed') return null;
    if (ac.state === 'suspended') {
      try { ac.resume(); } catch (_) {}
    }
    const dest = global.battleAudioMaster || ac.destination;
    return { ac, dest };
  }

  function ensureNoiseBuffer(ac) {
    if (noiseBuffer && noiseBuffer.sampleRate === ac.sampleRate) return noiseBuffer;
    const len = Math.floor(ac.sampleRate * 0.65);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 0x9e3779b9;
    for (let i = 0; i < len; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = (seed / 2147483648) - 1;
    }
    noiseBuffer = buf;
    return buf;
  }

  function throttle(key, minMs) {
    const now = performance.now();
    if (now - (lastPlayed[key] || 0) < minMs) return false;
    lastPlayed[key] = now;
    return true;
  }

  function playImpulse(intensity = 1) {
    if (!throttle('impulse', 70)) return;
    const g = getAudioGraph();
    if (!g) return;
    const { ac, dest } = g;
    const t = ac.currentTime;
    const vol = Math.min(1, 0.34 * intensity);

    // Sub pneumatic punch
    const osc = ac.createOscillator();
    const og = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, t);
    osc.frequency.exponentialRampToValueAtTime(52, t + 0.16);
    og.gain.setValueAtTime(vol * 0.85, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    osc.connect(og).connect(dest);
    osc.start(t);
    osc.stop(t + 0.18);

    // Filtered thruster whoosh
    const src = ac.createBufferSource();
    src.buffer = ensureNoiseBuffer(ac);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.9;
    bp.frequency.setValueAtTime(1900, t);
    bp.frequency.exponentialRampToValueAtTime(420, t + 0.22);
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.001, t);
    ng.gain.linearRampToValueAtTime(vol * 0.65, t + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.23);
    src.connect(bp).connect(ng).connect(dest);
    src.start(t);
    src.stop(t + 0.24);
  }

  function playDeflect() {
    if (!throttle('deflect', 90)) return;
    const g = getAudioGraph();
    if (!g) return;
    const { ac, dest } = g;
    const t = ac.currentTime;

    // Crystalline parry fifth chord + snap
    const freqs = [880, 1318.5, 2093];
    freqs.forEach((f, idx) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f * 0.94, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.03, t + 0.045);
      osc.frequency.exponentialRampToValueAtTime(f, t + 0.34);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.20 / (idx + 1), t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.36);
      osc.connect(gain).connect(dest);
      osc.start(t);
      osc.stop(t + 0.38);
    });

    // Metallic snap transient
    const src = ac.createBufferSource();
    src.buffer = ensureNoiseBuffer(ac);
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3200;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.28, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    src.connect(hp).connect(ng).connect(dest);
    src.start(t);
    src.stop(t + 0.08);
  }

  function playClash(heavy = false) {
    if (!throttle('clash', 85)) return;
    const g = getAudioGraph();
    if (!g) return;
    const { ac, dest } = g;
    const t = ac.currentTime;

    // Inharmonic metallic steel ring (FM bell pair)
    const partials = heavy ? [470, 742, 1185, 1940, 3120] : [540, 860, 1410, 2380];
    partials.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = i < 2 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq * 1.06, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.97, t + 0.28);
      const amp = (heavy ? 0.16 : 0.11) / (1 + i * 0.65);
      gain.gain.setValueAtTime(amp, t);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + (heavy ? 0.42 : 0.28));
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = heavy ? 5200 : 4200;
      osc.connect(lp).connect(gain).connect(dest);
      osc.start(t);
      osc.stop(t + (heavy ? 0.44 : 0.3));
    });

    // Impact crunch
    const src = ac.createBufferSource();
    src.buffer = ensureNoiseBuffer(ac);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = heavy ? 1600 : 2100;
    bp.Q.value = 1.2;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(heavy ? 0.34 : 0.22, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    src.connect(bp).connect(ng).connect(dest);
    src.start(t);
    src.stop(t + 0.14);
  }

  function playWallSlam(strength = 1) {
    if (!throttle('wallSlam', 85)) return;
    const g = getAudioGraph();
    if (!g) return;
    const { ac, dest } = g;
    const t = ac.currentTime;
    const s = Math.max(0.5, Math.min(1.5, strength));

    // Heavy steel plate sub-boom
    const osc = ac.createOscillator();
    const og = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(118 * s, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + 0.24);
    og.gain.setValueAtTime(0.36 * Math.min(1.2, s), t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(og).connect(dest);
    osc.start(t);
    osc.stop(t + 0.28);

    // Hydraulic rivet rattle
    const src = ac.createBufferSource();
    src.buffer = ensureNoiseBuffer(ac);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1250, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + 0.18);
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.24 * Math.min(1.2, s), t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
    src.connect(lp).connect(ng).connect(dest);
    src.start(t);
    src.stop(t + 0.2);
  }

  function playOverdrive() {
    if (!throttle('overdrive', 350)) return;
    const g = getAudioGraph();
    if (!g) return;
    const { ac, dest } = g;
    const t = ac.currentTime;

    // Ascending power harmonic surge
    const notes = [220, 330, 440, 659.25];
    notes.forEach((f, idx) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(700, t);
      lp.frequency.exponentialRampToValueAtTime(4600, t + 0.36);
      osc.frequency.setValueAtTime(f * 0.72, t + idx * 0.03);
      osc.frequency.exponentialRampToValueAtTime(f * 1.0, t + 0.24 + idx * 0.03);
      gain.gain.setValueAtTime(0.001, t + idx * 0.03);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.09 + idx * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.56);
      osc.connect(lp).connect(gain).connect(dest);
      osc.start(t + idx * 0.03);
      osc.stop(t + 0.58);
    });
  }

  function playEventWarn() {
    if (!throttle('eventWarn', 450)) return;
    const g = getAudioGraph();
    if (!g) return;
    const { ac, dest } = g;
    const t = ac.currentTime;

    // Clean dual-pulse industrial gantry beacon
    [0, 0.17].forEach((offset, idx) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      const base = idx === 0 ? 520 : 680;
      osc.frequency.setValueAtTime(base, t + offset);
      osc.frequency.linearRampToValueAtTime(base * 1.05, t + offset + 0.11);
      gain.gain.setValueAtTime(0.001, t + offset);
      gain.gain.linearRampToValueAtTime(0.14, t + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.13);
      osc.connect(gain).connect(dest);
      osc.start(t + offset);
      osc.stop(t + offset + 0.14);
    });
  }

  function playEventActivate() {
    if (!throttle('eventAct', 350)) return;
    const g = getAudioGraph();
    if (!g) return;
    const { ac, dest } = g;
    const t = ac.currentTime;

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1600, t);
    lp.frequency.exponentialRampToValueAtTime(280, t + 0.35);
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.35);
    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc.connect(lp).connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  function playKoFinisher() {
    if (!throttle('koFinisher', 800)) return;
    const g = getAudioGraph();
    if (!g) return;
    const { ac, dest } = g;
    const t = ac.currentTime;

    // Dramatic sub-bass time-stretch boom
    const sub = ac.createOscillator();
    const sg = ac.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(135, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + 0.65);
    sg.gain.setValueAtTime(0.45, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.72);
    sub.connect(sg).connect(dest);
    sub.start(t);
    sub.stop(t + 0.75);

    // Glass/steel shatter crack
    const src = ac.createBufferSource();
    src.buffer = ensureNoiseBuffer(ac);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(340, t + 0.42);
    bp.Q.value = 0.85;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.32, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    src.connect(bp).connect(ng).connect(dest);
    src.start(t);
    src.stop(t + 0.48);

    // Iconic metallic chime tail
    const bell = ac.createOscillator();
    const bg = ac.createGain();
    bell.type = 'triangle';
    bell.frequency.setValueAtTime(740, t + 0.04);
    bell.frequency.exponentialRampToValueAtTime(554.37, t + 0.62);
    bg.gain.setValueAtTime(0.001, t + 0.04);
    bg.gain.linearRampToValueAtTime(0.16, t + 0.06);
    bg.gain.exponentialRampToValueAtTime(0.0008, t + 0.68);
    bell.connect(bg).connect(dest);
    bell.start(t + 0.04);
    bell.stop(t + 0.7);
  }

  function playCasingClink() {
    if (!throttle('casing', 55)) return;
    const g = getAudioGraph();
    if (!g) return;
    const { ac, dest } = g;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    const base = 3900 + Math.random() * 1400;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 0.82, t + 0.04);
    gain.gain.setValueAtTime(0.035, t);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.045);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  global.APEX_BEYOND_AUDIO = Object.freeze({
    playImpulse,
    playDeflect,
    playClash,
    playWallSlam,
    playOverdrive,
    playEventWarn,
    playEventActivate,
    playKoFinisher,
    playCasingClink,
  });
})(window);
