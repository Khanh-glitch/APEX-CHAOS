/* =============================================================================
 * APEX CHAOS: TOTAL EVOLUTION — Procedural Tactile Combat Audio Synthesizer
 *
 * Zero-latency WebAudio layered synthesis for Perfect Clash Parries, Overdrive
 * Ultimates, Ricochet Boosts, Interactive Arena Mechanics, Black Hole & Chrono.
 * Respects global Apex audio mute policy and shares one bounded voice budget.
 * ========================================================================== */
(function (g) {
  'use strict';
  if (g.APEX_EVOLUTION_AUDIO) return;

  let ctx = null;
  let masterGain = null;
  let lastTriggerAt = 0;

  function isMuted() {
    try {
      if (g.__apexStatsSilent || g.__apexSfxMuted) return true;
      if (typeof g.apexIsBattleSfxMuted === 'function' && g.apexIsBattleSfxMuted()) return true;
      if (g.APEX_BATTLE_AUDIO?.isMuted?.()) return true;
    } catch (_) {}
    return false;
  }

  let gestureUnlockArmed = false;
  function disarmGestureUnlock() {
    if (!gestureUnlockArmed || typeof document === 'undefined') return;
    gestureUnlockArmed = false;
    document.removeEventListener('pointerdown', unlockOnGesture);
    document.removeEventListener('keydown', unlockOnGesture);
  }

  function ensureContext() {
    if (isMuted()) return null;
    // Share the canonical battle AudioContext + battleAudioMaster when present
    // so zero duplicate audio threads exist and SFX mute/session end apply cleanly.
    if (!ctx) {
      if (g.audioCtx && typeof g.audioCtx.createGain === 'function') {
        try {
          ctx = g.audioCtx;
          masterGain = ctx.createGain();
          masterGain.gain.value = 0.36;
          masterGain.connect(g.battleAudioMaster || ctx.destination);
        } catch (_) {
          ctx = null;
          masterGain = null;
        }
      }
      if (!ctx) {
        const AC = g.AudioContext || g.webkitAudioContext;
        if (!AC) return null;
        try {
          ctx = new AC();
          masterGain = ctx.createGain();
          masterGain.gain.value = 0.36;
          masterGain.connect(ctx.destination);
        } catch (_) {
          return null;
        }
      }
    }
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (_) {}
    }
    if (ctx.state === 'running') {
      disarmGestureUnlock();
      return ctx;
    }
    return null;
  }

  function unlockOnGesture() {
    ensureContext();
  }
  if (typeof document !== 'undefined') {
    gestureUnlockArmed = true;
    document.addEventListener('pointerdown', unlockOnGesture, { passive: true });
    document.addEventListener('keydown', unlockOnGesture, { passive: true });
  }

  function tone(ac, type, f0, f1, dur, gainVal, delay = 0) {
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gn = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, f0), t0);
    if (f1 && f1 !== f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    }
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.linearRampToValueAtTime(gainVal, t0 + Math.min(0.014, dur * 0.25));
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gn);
    gn.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const api = {
    playPerfectParry() {
      const ac = ensureContext();
      if (!ac) return;
      // Sub kinetic thud + resonant crystalline titanium harmonic triad
      tone(ac, 'sine', 135, 42, 0.24, 0.58);
      tone(ac, 'triangle', 880, 1760, 0.32, 0.34);
      tone(ac, 'sine', 1320, 2640, 0.42, 0.26, 0.012);
      tone(ac, 'sine', 2217, 2093, 0.48, 0.18, 0.025);
    },
    playGuardPulse() {
      const ac = ensureContext();
      if (!ac) return;
      tone(ac, 'sine', 260, 110, 0.16, 0.28);
      tone(ac, 'triangle', 520, 310, 0.14, 0.16);
    },
    playRicochetBoost() {
      const now = performance.now();
      if (now - lastTriggerAt < 90) return;
      lastTriggerAt = now;
      const ac = ensureContext();
      if (!ac) return;
      tone(ac, 'sawtooth', 190, 480, 0.13, 0.14);
      tone(ac, 'sine', 380, 760, 0.15, 0.16);
    },
    playOverdriveActivate(heroId) {
      const ac = ensureContext();
      if (!ac) return;
      // Deep seismic sub-drop + heroic power riser chord
      tone(ac, 'sine', 120, 36, 0.55, 0.65);
      const base = heroId === 'BLACK_HOLE' ? 196 : heroId === 'TIME' ? 293.66 : 246.94;
      tone(ac, 'sawtooth', base, base * 2, 0.46, 0.22);
      tone(ac, 'triangle', base * 1.5, base * 3, 0.52, 0.24, 0.04);
      tone(ac, 'sine', base * 2, base * 4, 0.60, 0.20, 0.08);
    },
    playArenaEvent(kind) {
      const ac = ensureContext();
      if (!ac) return;
      if (kind === 'lorentz') {
        tone(ac, 'sawtooth', 420, 1480, 0.16, 0.18);
        tone(ac, 'sine', 960, 1920, 0.18, 0.15);
      } else if (kind === 'cryo') {
        tone(ac, 'triangle', 1420, 620, 0.28, 0.22);
        tone(ac, 'sine', 2100, 1280, 0.32, 0.16, 0.02);
      } else if (kind === 'forge') {
        tone(ac, 'sawtooth', 140, 82, 0.34, 0.22);
      } else if (kind === 'mythic_drop') {
        tone(ac, 'sawtooth', 164.8, 164.8, 0.45, 0.24);
        tone(ac, 'triangle', 329.6, 493.88, 0.55, 0.24, 0.06);
      }
    },
    playRail(over) {
      const ac = ensureContext(); if (!ac) return;
      tone(ac, 'sawtooth', over ? 90 : 160, over ? 900 : 1400, over ? 0.22 : 0.12, over ? 0.42 : 0.24);
      tone(ac, 'square', 2200, 600, 0.08, 0.1);
      if (over) tone(ac, 'sine', 60, 30, 0.4, 0.5, 0.02);
    },
    playSlash() {
      const ac = ensureContext(); if (!ac) return;
      tone(ac, 'sawtooth', 1800, 260, 0.14, 0.2); tone(ac, 'triangle', 420, 120, 0.16, 0.22, 0.01);
    },
    playCrystalBurst() {
      const ac = ensureContext(); if (!ac) return;
      for (let i = 0; i < 6; i++) tone(ac, 'triangle', 1400 + i * 310, 2000 + i * 260, 0.22, 0.14, i * 0.025);
      tone(ac, 'sine', 180, 60, 0.4, 0.38);
    },
    playMeteorSlam() {
      const ac = ensureContext(); if (!ac) return;
      tone(ac, 'sine', 140, 28, 0.7, 0.75); tone(ac, 'sawtooth', 260, 50, 0.35, 0.3); tone(ac, 'square', 90, 40, 0.5, 0.25, 0.04);
    },
    playBell() {
      const ac = ensureContext(); if (!ac) return;
      tone(ac, 'sine', 523.25, 523.25, 1.4, 0.4); tone(ac, 'sine', 1318.5, 1318.5, 1.1, 0.16, 0.01); tone(ac, 'triangle', 261.6, 261.6, 1.6, 0.22, 0.02);
    },
    playKo() {
      const ac = ensureContext(); if (!ac) return;
      tone(ac, 'sine', 110, 26, 0.9, 0.8); tone(ac, 'sawtooth', 440, 55, 0.6, 0.3, 0.05);
      tone(ac, 'triangle', 659.25, 659.25, 0.5, 0.22, 0.32); tone(ac, 'triangle', 880, 880, 0.7, 0.24, 0.5);
    },
    playHeroCue(heroId, slot) {
      const ac = ensureContext();
      if (!ac) return;
      if (heroId === 'BLACK_HOLE') {
        if (slot === 'A1') {
          tone(ac, 'sine', 310, 92, 0.36, 0.36);
          tone(ac, 'triangle', 620, 210, 0.32, 0.20, 0.03);
        } else {
          tone(ac, 'sine', 95, 210, 0.28, 0.42);
          tone(ac, 'sawtooth', 190, 58, 0.44, 0.24, 0.12);
        }
      } else if (heroId === 'TIME') {
        if (slot === 'A1') {
          for (let i = 0; i < 4; i++) {
            tone(ac, 'triangle', 1180 + i * 220, 1240 + i * 220, 0.07, 0.18, i * 0.055);
          }
        } else {
          tone(ac, 'sawtooth', 980, 240, 0.28, 0.24);
          tone(ac, 'sine', 480, 1440, 0.32, 0.26, 0.08);
        }
      }
    },
  };

  g.APEX_EVOLUTION_AUDIO = api;
  g.apexEvolutionAudio = 'ready';
})(window);
