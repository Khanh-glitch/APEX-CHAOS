// Extracted verbatim from apexEngine.js; keep classic-script globals available.
var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var battleAudioMaster = audioCtx.createGain();
battleAudioMaster.gain.value = 1;
battleAudioMaster.connect(audioCtx.destination);
var battleAudioFadeTimer = null;
var battleMediaElements = new Set();
var activeBattleMediaElements = new Set();
function registerBattleMediaElement(audio) {
    if (!audio || audio.__apexMenuMusic) return audio;
    if (audio.__apexBattleRegistered) {
        battleMediaElements.add(audio);
        return audio;
    }
    audio.__apexBattleRegistered = true;
    try {
        if (!audio.__apexBattleMediaSource) {
            audio.__apexBattleMediaSource = audioCtx.createMediaElementSource(audio);
            audio.__apexBattleMediaSource.connect(battleAudioMaster);
        }
    } catch (error) {}
    battleMediaElements.add(audio);
    audio.addEventListener('ended', () => activeBattleMediaElements.delete(audio));
    audio.addEventListener('pause', () => activeBattleMediaElements.delete(audio));
    return audio;
}
if (typeof HTMLMediaElement !== 'undefined' && !HTMLMediaElement.prototype.__apexBattlePlayPatched) {
    HTMLMediaElement.prototype.__apexBattlePlayPatched = true;
    const nativeMediaPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function(...args) {
        if (window.__apexStatsSilent && !this.__apexMenuMusic) return Promise.resolve();
        if (!this.__apexMenuMusic) {
            registerBattleMediaElement(this);
            activeBattleMediaElements.add(this);
        }
        const result = nativeMediaPlay.apply(this, args);
        if (result?.catch && !this.__apexMenuMusic) result.catch(() => activeBattleMediaElements.delete(this));
        return result;
    };
}
function restoreBattleAudio() {
    if (window.__apexStatsSilent) {
        try { battleAudioMaster.gain.setValueAtTime(0, audioCtx.currentTime); } catch (error) {}
        return;
    }
    if (battleAudioFadeTimer) {
        clearInterval(battleAudioFadeTimer);
        battleAudioFadeTimer = null;
    }
    const now = audioCtx.currentTime;
    battleAudioMaster.gain.cancelScheduledValues(now);
    battleAudioMaster.gain.setValueAtTime(1, now);
}
function fadeBattleAudio(duration = .85, stopAfter = false) {
    if (battleAudioFadeTimer) {
        clearInterval(battleAudioFadeTimer);
        battleAudioFadeTimer = null;
    }
    const now = audioCtx.currentTime;
    battleAudioMaster.gain.cancelScheduledValues(now);
    battleAudioMaster.gain.setValueAtTime(Math.max(.001, battleAudioMaster.gain.value), now);
    battleAudioMaster.gain.exponentialRampToValueAtTime(.001, now + duration);
    const entries = [...activeBattleMediaElements].filter(a => a && !a.paused);
    const start = performance.now();
    const baseVolumes = new Map(entries.map(a => [a, a.volume]));
    battleAudioFadeTimer = setInterval(() => {
        const t = clamp((performance.now() - start) / (duration * 1000), 0, 1);
        const k = 1 - smoothstep(t);
        for (const audio of entries) {
            if (!audio || audio.__apexMenuMusic) continue;
            const base = baseVolumes.get(audio) ?? audio.volume;
            audio.volume = Math.max(0, base * k);
            if (stopAfter && t >= 1) {
                audio.pause();
                try { audio.currentTime = 0; } catch (err) {}
            }
        }
        if (t >= 1) {
            clearInterval(battleAudioFadeTimer);
            battleAudioFadeTimer = null;
        }
    }, 33);
}
function stopBattleAudio() {
    if (battleAudioFadeTimer) {
        clearInterval(battleAudioFadeTimer);
        battleAudioFadeTimer = null;
    }
    const now = audioCtx.currentTime;
    battleAudioMaster.gain.cancelScheduledValues(now);
    battleAudioMaster.gain.setValueAtTime(.001, now);
    for (const audio of [...activeBattleMediaElements]) {
        if (!audio || audio.__apexMenuMusic) continue;
        audio.pause();
        try { audio.currentTime = 0; } catch (err) {}
    }
    activeBattleMediaElements.clear();
    if (typeof window.stopNinjaAudio === 'function') window.stopNinjaAudio();
    if (!window.__apexStatsSilent) window.setTimeout(() => restoreBattleAudio(), 80);
}
window.apexFadeBattleAudio = fadeBattleAudio;
window.apexStopBattleAudio = stopBattleAudio;
