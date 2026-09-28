// Extracted verbatim from apexEngine.js; depends on apexBattleAudioRuntime.js.
var SOUND_ID = {
    RUBBER: { base: 150, wave: 'sine', bend: 2.25, noise: 0.06 },
    ICE: { base: 720, wave: 'triangle', bend: 0.48, noise: 0.03 },
    VAMPIRE: { base: 82, wave: 'sawtooth', bend: 0.62, noise: 0.05 },
    STRING: { base: 430, wave: 'square', bend: 1.35, noise: 0.025 },
    VOLCANO: { base: 58, wave: 'sawtooth', bend: 0.38, noise: 0.12 },
    MAGNET: { base: 120, wave: 'sine', bend: 1.02, noise: 0.035 },
    FLASH: { base: 920, wave: 'sawtooth', bend: 2.7, noise: 0.02 },
    ELECTRIC: { base: 980, wave: 'square', bend: 0.31, noise: 0.07 },
    ORBIT: { base: 530, wave: 'sine', bend: 1.62, noise: 0.02 },
    TOXIC: { base: 190, wave: 'triangle', bend: 0.58, noise: 0.09 },
    MIRROR: { base: 840, wave: 'triangle', bend: 1.42, noise: 0.025 },
    BLACK_HOLE: { base: 42, wave: 'sine', bend: 0.42, noise: 0.045 },
    SAW: { base: 310, wave: 'sawtooth', bend: 1.1, noise: 0.11 },
    BLADE: { base: 640, wave: 'triangle', bend: 1.85, noise: 0.04 },
    NOVA: { base: 240, wave: 'sine', bend: 3.25, noise: 0.035 },
    HUNTER: { base: 520, wave: 'triangle', bend: 1.48, noise: 0.035 },
    CRYSTAL: { base: 900, wave: 'sine', bend: 1.72, noise: 0.025 },
    MATH: { base: 460, wave: 'square', bend: 1.18, noise: 0.015 },
    VIRUS: { base: 115, wave: 'sawtooth', bend: 0.72, noise: 0.10 },
    CARD: { base: 620, wave: 'triangle', bend: 1.32, noise: 0.018 },
    DRUM: { base: 95, wave: 'sine', bend: 0.55, noise: 0.16 },
    SLIME: { base: 210, wave: 'sine', bend: .65, noise:.08 }, TIME: { base: 520, wave: 'square', bend: .8, noise:.02 }, WOLF:{base:140,wave:'sawtooth',bend:.55,noise:.07}, WIND:{base:620,wave:'sine',bend:1.8,noise:.05}, WITCH:{base:760,wave:'triangle',bend:.72,noise:.03}, PIRATE:{base:180,wave:'sawtooth',bend:.62,noise:.08}, PAINTER:{base:460,wave:'triangle',bend:1.4,noise:.025}, MONK:{base:300,wave:'triangle',bend:1.2,noise:.04}, SUPERSTAR:{base:680,wave:'sine',bend:1.55,noise:.035}
};
var battleNoiseBuffers = new Map();
var battleAudioResumePromise = null;
function ensureBattleAudioReady() {
    if (window.__apexStatsSilent) return;
    if (audioCtx.state === 'running') return;
    if (!battleAudioResumePromise) {
        battleAudioResumePromise = audioCtx.resume().catch(() => {}).finally(() => { battleAudioResumePromise = null; });
    }
}
function playNoise(duration, gainValue, filterFreq = 900, type = 'bandpass') {
    if (window.__apexStatsSilent) return;
    ensureBattleAudioReady();
    const now = audioCtx.currentTime;
    const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
    let buffer = battleNoiseBuffers.get(bufferSize);
    if (!buffer) {
        buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        battleNoiseBuffers.set(bufferSize, buffer);
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(6, now);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter); filter.connect(gain); gain.connect(battleAudioMaster);
    src.start(now); src.stop(now + duration);
    if (window.apexRegisterBattleAudioSource) window.apexRegisterBattleAudioSource(src);
}
function playTone(freq, endFreq, dur, wave, gainValue, when = 0) {
    if (window.__apexStatsSilent) return;
    const now = audioCtx.currentTime + when;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(Math.max(20, freq), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain); gain.connect(battleAudioMaster);
    osc.start(now); osc.stop(now + dur);
    if (window.apexRegisterBattleAudioSource) window.apexRegisterBattleAudioSource(osc);
}
var ASSET_ONLY_FIGHTER_SFX = new Set(['ICE', 'STRING', 'GALAXY', 'SOCCER', 'NINJA', 'SHOTGUN']);
function playFighterSound(fighterOrName, action = 'skill') {
    ensureBattleAudioReady();
    const name = typeof fighterOrName === 'string' ? fighterOrName : fighterOrName.name;
    if (action === 'skill' && typeof fighterOrName !== 'string') recordSkill(fighterOrName);
    if (ASSET_ONLY_FIGHTER_SFX.has(name)) return;
    const p = SOUND_ID[name] || { base: 300, wave: 'triangle', bend: 1.2, noise: 0.03 };
    const dur = action === 'death' ? 0.55 : action === 'wall' ? 0.16 : 0.32;
    const g = action === 'death' ? 0.22 : action === 'wall' ? 0.09 : 0.14;
    const start = action === 'wall' ? p.base * 0.72 : action === 'death' ? p.base * 0.85 : p.base;
    const end = action === 'death' ? Math.max(24, p.base * 0.22) : start * p.bend;
    playTone(start, end, dur, p.wave, g);
    if (action !== 'wall') playTone(start * 1.51, Math.max(28, end * 0.82), dur * 0.85, name === 'ELECTRIC' || name === 'MATH' ? 'square' : 'sine', g * 0.38, 0.018);
    if (p.noise) playNoise(dur * 0.72, p.noise * (action === 'death' ? 1.7 : 1), name === 'SAW' ? 1600 : name === 'VOLCANO' ? 180 : name === 'TOXIC' ? 650 : name === 'ICE' ? 2200 : 900);

    if (name === 'RUBBER' && action !== 'death') playTone(110, 330, 0.12, 'sine', 0.07, 0.04);
    if (name === 'ICE' && action === 'skill') { playNoise(0.16, 0.04, 3000, 'highpass'); playTone(1100, 420, 0.18, 'triangle', 0.06, 0.08); }
    if (name === 'VAMPIRE' && action === 'skill') playTone(65, 45, 0.38, 'sawtooth', 0.08, 0.02);
    if (name === 'FLASH' && action === 'skill') { playTone(1400, 2800, 0.055, 'sawtooth', 0.08); playNoise(0.08, 0.025, 3600, 'highpass'); }
    if (name === 'BLACK_HOLE' && action === 'skill') playTone(36, 22, 0.48, 'sine', 0.16);
    if (name === 'BLADE' && action === 'skill') playNoise(0.11, 0.055, 2400, 'highpass');
    if (name === 'CRYSTAL' && action === 'skill') { playTone(1320, 1760, 0.16, 'sine', 0.05); playTone(660, 990, 0.18, 'triangle', 0.04, 0.03); }
    if (name === 'MATH' && action === 'skill') { playTone(420, 420, 0.045, 'square', 0.035); playTone(520, 520, 0.045, 'square', 0.035, 0.06); playTone(640, 640, 0.045, 'square', 0.035, 0.12); playTone(900, 520, 0.11, 'square', 0.05, 0.22); }
    if (name === 'VIRUS' && action === 'skill') { playTone(90, 54, 0.12, 'sawtooth', 0.055); playNoise(0.15, 0.035, 520, 'bandpass'); }
    if (name === 'CARD' && action === 'skill') { playTone(740, 880, 0.055, 'triangle', 0.05); playTone(520, 420, 0.08, 'sine', 0.03, 0.055); }
    if (name === 'DRUM') { playTone(action==='wall'?120:82, action==='wall'?55:42, action==='wall'?.18:.34, 'sine', action==='wall'?.13:.20); playNoise(action==='wall'?.12:.24, .08, 180, 'lowpass'); }
}
