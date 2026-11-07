// ---------------------------------------------------------------------------
// APEX CHAOS — production bridge for the curated Core Six hero SFX authority.
//
// Subscribes the ONE hero-SFX authority to the REAL production semantic event
// seam (window.APEX_HERO_REWORK_AIL.bus). No demo cast events, no guessed event
// names, no render-frame or simulation-tick triggering.
//
//   · The AIL bus is the same seam the gameplay runtimes already emit on, and
//     the same one hunterPresentationRuntime.js uses for its accepted cues.
//   · Magnet's a2 bullet-deflect beat is a PRESENTATION cue driven by the
//     gameplay runtime's real captureEvents, so it is bridged from the magnet
//     presentation runtime's existing GOLD.cue('a2capture') seam rather than
//     from a second event name.
//   · Mirror's passive shard drop is seeded from the REAL production seam
//     APEX_MIRROR_PRESENTATION.capturePassiveShardSeeds, which the gameplay
//     runtime calls with the exact shard identities it spawned from a realized
//     MIRROR HP loss — so it fires ONE sound per proc, never per shard.
//   · ROBOT and HUNTER are deliberately absent: they keep their existing
//     accepted production SFX authorities untouched.
// ---------------------------------------------------------------------------
(function apexHeroSfxBridge() {
  'use strict';

  function install() {
    const g = typeof window !== 'undefined' ? window : globalThis;
    const auth = g.apexHeroSfx || (typeof g.installHeroSfxAuthority === 'function'
      ? g.installHeroSfxAuthority({ window: g }) : null);
    if (!auth) return null;
    if (g.__apexHeroSfxBridgeInstalled) return g.__apexHeroSfxBridgeUninstall;
    g.__apexHeroSfxBridgeInstalled = true;

    const offs = [];

    // ── 1. the AIL semantic event seam ────────────────────────────────────
    const AIL = g.APEX_HERO_REWORK_AIL;
    const bus = AIL && AIL.bus;
    if (bus && typeof bus.on === 'function') {
      const EVENTS = [
        'CrystalAwaken',
        'CrystalConstructCast',
        'CrystalIntercept',
        'CrystalReserve',
        'CrystalConstructHit',
        'MagnetA1Start',
        'MagnetA2Start',
        'FrostBreathCast',
        'FrostFreezeStart',
        'FrostSlotFrozen',
        'FrostGunFrozen',
        'MirrorA1Cast',
        'MirrorExchange',
        'MirrorNodeForming',
        'MirrorNodeOff',
      ];
      for (const type of EVENTS) {
        offs.push(bus.on(type, (ev) => {
          try { auth.dispatch(type, (ev && ev.payload) || {}); } catch (error) { /* never break play */ }
        }));
      }
    }

    // ── 2. magnet's real a2capture presentation seam ──────────────────────
    // The magnet presentation runtime already resolves the real time-of-impact
    // for every captured projectile and calls GOLD.cue(ct,'a2capture',...).
    // Bridge that cue to the curated deflect sound so one projectile event
    // produces at most one audible cue (rate-limited inside the authority).
    try {
      const magGold = g.apexMagnetGoldV1;
      if (magGold && typeof magGold.cue === 'function' && !magGold.__apexHeroSfxBridged) {
        const baseCue = magGold.cue;
        magGold.cue = function cue(combatant, type, data) {
          try {
            if (type === 'a2capture') auth.play('magnet', 'a2_bullet_deflect');
          } catch (error) { /* never break presentation */ }
          return baseCue.apply(this, arguments);
        };
        magGold.__apexHeroSfxBridged = true;
      }
    } catch (error) { /* magnet presentation absent */ }

    // ── 3. mirror's REAL realized-damage shard provenance ─────────────────
    // The production seam is APEX_MIRROR_PRESENTATION.capturePassiveShardSeeds,
    // which the gameplay runtime calls with the exact real shard identities it
    // just spawned from a realized MIRROR HP loss. Bridging THAT seam means the
    // LOW ACCENT shard-drop cue fires once per real proc (never per shard, and
    // never from a fabricated event).
    try {
      const pres = g.APEX_MIRROR_PRESENTATION;
      if (pres && typeof pres.capturePassiveShardSeeds === 'function'
        && !pres.__apexHeroSfxBridged) {
        const baseCapture = pres.capturePassiveShardSeeds;
        pres.capturePassiveShardSeeds = function capturePassiveShardSeeds(ct, shards) {
          try {
            if (Array.isArray(shards) && shards.length) auth.play('mirror', 'passive_shard_drop');
          } catch (error) { /* never break presentation */ }
          return baseCapture.apply(this, arguments);
        };
        pres.__apexHeroSfxBridged = true;
      }
    } catch (error) { /* mirror presentation absent */ }

    g.__apexHeroSfxBridgeUninstall = function uninstall() {
      for (const off of offs) { try { off(); } catch (error) { /* ignore */ } }
      offs.length = 0;
      g.__apexHeroSfxBridgeInstalled = false;
      delete g.__apexHeroSfxBridgeUninstall;
    };
    return g.__apexHeroSfxBridgeUninstall;
  }

  const g = typeof window !== 'undefined' ? window : globalThis;
  if (g && !g.__apexHeroSfxBridgeAutoInstalled) {
    g.__apexHeroSfxBridgeAutoInstalled = true;
    try { install(); } catch (error) { /* headless stubs */ }
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { install };
  }
})();
