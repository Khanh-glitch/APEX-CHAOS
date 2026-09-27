// Extracted verbatim from apexEngine.js; keep classic-script globals available.
var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var battleAudioMaster = audioCtx.createGain();
battleAudioMaster.gain.value = 1;
battleAudioMaster.connect(audioCtx.destination);
var battleAudioFadeTimer = null;
var battleMediaElements = new Set();
var activeBattleMediaElements = new Set();

// Mobile WebAudio policy: the context is created during boot, so Safari/iOS can
// leave it suspended until resume() is called from a trusted user activation.
// Keep a tiny unlock bridge armed until the context is actually running. If
// WebKit suspends/interrupts the context after backgrounding, re-arm the bridge
// for the next real user gesture instead of changing the existing SFX engine.
var battleAudioUnlockArmed = false;
function removeBattleAudioUnlockListeners() {
    if (!battleAudioUnlockArmed) return;
    battleAudioUnlockArmed = false;
    window.removeEventListener('pointerdown', unlockBattleAudioFromGesture, true);
    window.removeEventListener('touchend', unlockBattleAudioFromGesture, true);
    window.removeEventListener('keydown', unlockBattleAudioFromGesture, true);
}
function unlockBattleAudioFromGesture() {
    if (window.__apexStatsSilent) {
        removeBattleAudioUnlockListeners();
        return;
    }
    if (audioCtx.state === 'running') {
        removeBattleAudioUnlockListeners();
        return;
    }
    try {
        const resumeResult = audioCtx.resume();
        if (resumeResult?.then) {
            resumeResult.then(() => {
                if (audioCtx.state === 'running') removeBattleAudioUnlockListeners();
            }).catch(() => {
                // Keep listeners armed. A later trusted gesture may succeed.
            });
        } else if (audioCtx.state === 'running') {
            removeBattleAudioUnlockListeners();
        }
    } catch (error) {
        // Keep listeners armed. A later trusted gesture may succeed.
    }
}
function armBattleAudioUnlock() {
    if (window.__apexStatsSilent || audioCtx.state === 'running' || battleAudioUnlockArmed) return;
    battleAudioUnlockArmed = true;
    window.addEventListener('pointerdown', unlockBattleAudioFromGesture, { capture: true, passive: true });
    window.addEventListener('touchend', unlockBattleAudioFromGesture, { capture: true, passive: true });
    window.addEventListener('keydown', unlockBattleAudioFromGesture, true);
}
armBattleAudioUnlock();
if (audioCtx.addEventListener) {
    audioCtx.addEventListener('statechange', () => {
        if (audioCtx.state === 'running') removeBattleAudioUnlockListeners();
        else armBattleAudioUnlock();
    });
}
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && audioCtx.state !== 'running') armBattleAudioUnlock();
    });
}
window.addEventListener('pageshow', () => {
    if (audioCtx.state !== 'running') armBattleAudioUnlock();
});

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

// ── Global battle-audio session registry (owner correction pass CP6) ──────
// Every Web Audio source that produces battle/game SFX registers here, and
// every session-scoped delayed cue is scheduled through apexBattleAudio-
// ScheduleCue. Session begin/end TERMINATES all registered sources (stop +
// disconnect — not just master-gain muting), clears pending cues, and bumps
// the session token so any delayed callback that somehow survives its timer
// clear becomes a no-op. Menu BGM (flagged elements) stays outside this
// lifecycle by design; decoded AudioBuffers/caches are never cleared.
var battleAudioSessionToken = 0;
var battleAudioSessionActiveFlag = false;
var battleAudioSessionSources = new Set();
var battleAudioSessionTimers = new Set();
function stopRegisteredBattleAudioSources() {
    for (const src of Array.from(battleAudioSessionSources)) {
        battleAudioSessionSources.delete(src);
        try { if (typeof src.stop === 'function') src.stop(0); } catch (error) {}
        try { if (typeof src.disconnect === 'function') src.disconnect(); } catch (error) {}
    }
}
function clearBattleAudioSessionTimers() {
    for (const id of Array.from(battleAudioSessionTimers)) {
        battleAudioSessionTimers.delete(id);
        clearTimeout(id);
    }
}
window.apexRegisterBattleAudioSource = function (src) {
    if (!src) return src;
    battleAudioSessionSources.add(src);
    try {
        src.addEventListener('ended', () => battleAudioSessionSources.delete(src), { once: true });
    } catch (error) {}
    return src;
};
window.apexBattleAudioScheduleCue = function (fn, delayMs) {
    const token = battleAudioSessionToken;
    const id = setTimeout(() => {
        battleAudioSessionTimers.delete(id);
        if (token !== battleAudioSessionToken) return; // old session: no-op
        try { fn(); } catch (error) {}
    }, Math.max(0, delayMs | 0));
    battleAudioSessionTimers.add(id);
    return id;
};
window.apexBattleAudioSessionInfo = function () {
    return {
        sessionId: battleAudioSessionToken,
        active: battleAudioSessionActiveFlag,
        registeredSources: battleAudioSessionSources.size,
        pendingCues: battleAudioSessionTimers.size,
    };
};

// ── Shared idle-task chain (CP6) ──────────────────────────────────────────
// Defined in this file because it is the one boot-tier classic script that
// every deferred runtime loads after. Used to chunk heavy visual/asset
// preprocessing (forced image decode + per-pixel canvas work) so background
// warmup never monopolizes the main thread: one task per idle slot, yielding
// to real input/paint between tasks.
window.apexIdleChain = function (tasks) {
    return new Promise((resolve) => {
        const list = tasks.slice();
        const step = () => {
            if (!list.length) { resolve(true); return; }
            const task = list.shift();
            try { task(); } catch (error) {}
            if (!list.length) { resolve(true); return; }
            if (typeof window.requestIdleCallback === 'function') {
                window.requestIdleCallback(step, { timeout: 200 });
            } else {
                window.setTimeout(step, 0);
            }
        };
        if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(step, { timeout: 200 });
        else window.setTimeout(step, 0);
    });
};
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
// ── Battle-audio session lifecycle (owner correction pass) ─────────────────
// Explicit session semantics replace the old mute-then-auto-restore timer:
// entering battle TERMINATES the previous session (every live Arsenal
// AudioBufferSourceNode is stopped+disconnected, pending playLater cues are
// cancelled, battle media elements pause, ninja audio stops) and then unmutes
// the master for the new session. Leaving battle/menu return ends the session
// and the master STAYS silent until the next explicit begin — old voices can
// never become audible again behind a restore. Menu BGM is a separate
// HTMLMediaElement (never routed through this graph), so it is unaffected.
// Decoded AudioBuffers (the AV HOT bank) are session-independent and stay
// cached; only playback state resets.
function stopActiveBattleMediaElements() {
    for (const audio of [...activeBattleMediaElements]) {
        if (!audio || audio.__apexMenuMusic) continue;
        audio.pause();
        try { audio.currentTime = 0; } catch (err) {}
    }
    activeBattleMediaElements.clear();
}
function terminateBattleAudioPlayback() {
    if (battleAudioFadeTimer) {
        clearInterval(battleAudioFadeTimer);
        battleAudioFadeTimer = null;
    }
    if (window.APEX_ARSENAL_AV && typeof window.APEX_ARSENAL_AV.resetAudioSession === 'function') {
        try { window.APEX_ARSENAL_AV.resetAudioSession(); } catch (error) {}
    }
    if (typeof window.stopNinjaAudio === 'function') window.stopNinjaAudio();
    stopActiveBattleMediaElements();
    // CP6 global ownership: kill every registered Web Audio source, cancel
    // every session-scoped cue, and invalidate the token so surviving delayed
    // callbacks become no-ops.
    battleAudioSessionToken += 1;
    battleAudioSessionActiveFlag = false;
    stopRegisteredBattleAudioSources();
    clearBattleAudioSessionTimers();
}
function beginBattleAudioSession() {
    terminateBattleAudioPlayback();
    battleAudioSessionActiveFlag = true;
    // Explicit session start: the master goes live NOW, for THIS session only.
    restoreBattleAudio();
}
function endBattleAudioSession() {
    terminateBattleAudioPlayback();
    // No auto-restore timer: the master stays silent until the next explicit
    // beginBattleAudioSession() (or the engine's post-first-frame restore at
    // a real match start).
    const now = audioCtx.currentTime;
    battleAudioMaster.gain.cancelScheduledValues(now);
    battleAudioMaster.gain.setValueAtTime(.001, now);
}
function stopBattleAudio() {
    // Back-compat alias: every historical call site wants "no battle SFX
    // after this point" — that is end-of-session semantics.
    endBattleAudioSession();
}
function apexBattleAudioSessionState() {
    let avSources = null, avTimers = null;
    if (window.APEX_ARSENAL_AV && typeof window.APEX_ARSENAL_AV.audioSessionProbe === 'function') {
        try {
            const probe = window.APEX_ARSENAL_AV.audioSessionProbe();
            avSources = probe.liveSources;
            avTimers = probe.pendingTimers;
        } catch (error) {}
    }
    let masterGain = null;
    try { masterGain = battleAudioMaster.gain.value; } catch (error) {}
    const session = window.apexBattleAudioSessionInfo ? window.apexBattleAudioSessionInfo() : null;
    return { masterGain, avLiveSources: avSources, avPendingTimers: avTimers, session };
}
window.apexFadeBattleAudio = fadeBattleAudio;
window.apexStopBattleAudio = stopBattleAudio;
window.apexBeginBattleAudioSession = beginBattleAudioSession;
window.apexEndBattleAudioSession = endBattleAudioSession;
window.apexBattleAudioSessionState = apexBattleAudioSessionState;

// ── Audio 2B: tiered WARM-bank prefetch ────────────────────────────────────
// Fighter/mode runtimes play their SFX through HTMLAudioElement pools that are
// created when the runtime script evaluates. A few create elements lazily on
// the first gameplay event, which would turn the trigger into a network fetch.
// The tiered runtime loader therefore prefetches every audio URL a group's
// runtimes reference the moment that group loads (background warmup or route
// intent): the bytes land in the HTTP cache, so the eventual trigger-time
// element starts from cache with no network round-trip.
// Elements are kept in a Set so the browser cannot GC-cancel the fetch, and
// are never played or routed through the battle graph — volume/mute/fade
// semantics of real playback are untouched.
var apexWarmAudioPrefetched = new Set();
window.apexWarmAudioUrls = function apexWarmAudioUrls(urls) {
    if (!urls || !urls.length) return 0;
    var warmed = 0;
    for (var i = 0; i < urls.length; i++) {
        var url = urls[i];
        if (!url || apexWarmAudioPrefetched.has(url)) continue;
        apexWarmAudioPrefetched.add(url);
        try {
            var el = new Audio(url);
            el.preload = 'auto';
            el.__apexAudioWarmOnly = true;
            el.muted = true; // never audible; preload metadata/bytes only
            el.load();
            warmed += 1;
        } catch (error) { /* prefetch is best-effort */ }
    }
    return warmed;
};
window.apexWarmAudioStatus = function apexWarmAudioStatus() {
    return { prefetched: apexWarmAudioPrefetched.size };
};
