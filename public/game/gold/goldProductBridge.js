// ---------------------------------------------------------------------------
// APEX CHAOS — Gold product production bridge (runtime truth seam).
//
// Loaded by the Gold shell (/gold/shell.html) BEFORE the canonical shell
// script. This is the ONLY place the Gold surfaces touch production runtimes.
// The Gold donor surfaces stay canonical; this bridge supplies production
// truth underneath them and translates real production events into the
// canonical Gold HUD presentation callbacks (window.APEX_GOLD_HUD).
//
// Contracts implemented here (see docs/gold-ui/preload relocks):
//   · roster/credits/economy   — APEX_ARSENAL_SHELLS + APEX_ARSENAL_META
//   · match start               — the real product match entry
//                                 (startMatch → startArsenalBattleMode)
//   · battle presentation       — APEX_COMBAT_HUD projection + damage events
//   · ability presentation      — heroRegistry skill defs + AIL 'Cast' events
//   · music                     — owner Forward Drive theme (AV preload):
//                                 playhead preservation, global M mute,
//                                 tab-hidden pause, outside the battle graph
//   · arena ownership           — the live #game-canvas occupies the donor's
//                                 authored arena slot (same-document mount)
//
// Idempotent: every listener installs once and survives battle sessions.
// ---------------------------------------------------------------------------
(function apexGoldProductBridge() {
  'use strict';
  if (window.APEX_GOLD_PRODUCTION_BRIDGE === 'ready') return;
  window.APEX_GOLD_PRODUCTION_BRIDGE = 'ready';

  // ── canonical hero copy (Gold pack identity; ids are production ids) ─────
  // Canonical Gold shell keys ↔ production storage ids (productSurface.js
  // PLAYABLE_ROSTER_IDS; ICE displays as FROST, CRYSTAL as CRYSTALA).
  const GOLD_SHELL_KEY_BY_PRODUCTION_ID = {
    ROBOT: 'newbot', HUNTER: 'hunter', CRYSTAL: 'crystala',
    MAGNET: 'magnet', ICE: 'frost', MIRROR: 'mirror',
  };
  const PRODUCTION_ID_BY_SHELL_KEY = {
    newbot: 'ROBOT', hunter: 'HUNTER', crystala: 'CRYSTAL',
    magnet: 'MAGNET', frost: 'ICE', mirror: 'MIRROR',
  };
  const GOLD_HERO_COPY = {
    newbot: { name: 'ROBOT', tag: 'APEX COMBAT FRAME' },
    hunter: { name: 'HUNTER', tag: 'MANTIS ASSASSIN' },
    crystala: { name: 'CRYSTALA', tag: 'ANCIENT CRYSTAL ENTITY' },
    magnet: { name: 'MAGNET', tag: 'FIELD CONTROL UNIT' },
    frost: { name: 'FROST', tag: 'CRYO EDGE UNIT' },
    mirror: { name: 'MIRROR', tag: 'ECHO DUPLICATE' },
  };
  const FALLBACK_ACCENTS = {
    newbot: '#ff941f', hunter: '#96ca2d', crystala: '#55bfff',
    magnet: '#c7c5e9', frost: '#7ee8ff', mirror: '#e9e5df',
  };

  function rosterFromProduction() {
    const shells = window.APEX_ARSENAL_SHELLS;
    const meta = window.APEX_ARSENAL_META;
    // Production truth: the shell runtime publishes the playable list as an
    // ARRAY (playableIds/ids), not a function. Read either shape so the Gold
    // roster is derived from the real playable set (never a hardcoded copy).
    let ids = [];
    if (shells) {
      if (Array.isArray(shells.playableIds)) ids = shells.playableIds;
      else if (typeof shells.playableIds === 'function') ids = shells.playableIds() || [];
      else if (Array.isArray(shells.ids)) ids = shells.ids;
      else if (typeof shells.ids === 'function') ids = shells.ids() || [];
    }
    const heroes = {};
    for (const id of ids) {
      const productionId = String(id).toUpperCase();
      const key = GOLD_SHELL_KEY_BY_PRODUCTION_ID[productionId] || productionId.toLowerCase();
      if (!GOLD_HERO_COPY[key]) continue;
      const shell = (shells && typeof shells.typeFor === 'function') ? shells.typeFor(id) : null;
      const copy = GOLD_HERO_COPY[key];
      const color = (shell && shell.color) || FALLBACK_ACCENTS[key] || '#c4a574';
      heroes[key] = {
        name: copy.name,
        color,
        accent: color,
        tag: copy.tag,
        productionId,
        owned: !(meta && typeof meta.owns === 'function') || meta.owns(productionId),
      };
    }
    return heroes;
  }

  // Published for the canonical shell script (patch SHL-S2 resolves the
  // canonical HEROES contract from this when production is present; the
  // canonical shell roster is the fallback).
  Object.defineProperty(window, 'APEX_GOLD_ROSTER', {
    configurable: true,
    get() {
      const prod = rosterFromProduction();
      return Object.keys(prod).length ? prod : null;
    },
  });

  // Production ownership gate for the canonical fighter-select screen.
  window.APEX_GOLD_LOCKED = function isGoldHeroLocked(shellKey) {
    const roster = rosterFromProduction();
    const hero = roster[shellKey];
    if (!hero) return true; // not in the production playable roster
    return !hero.owned;
  };

  // ── owner theme music (AV preload: playhead + global mute + tab pause) ───
  const THEME_SRC = '/assets/audio/forward_drive_theme.ogg';
  const theme = {
    el: null,
    started: false,
    muted: false,
    ensure() {
      if (this.el) return this.el;
      const el = new Audio(THEME_SRC);
      el.loop = true;
      el.preload = 'auto';
      el.volume = 0.55;
      this.el = el;
      return el;
    },
    start() {
      const el = this.ensure();
      if (this.started) return;
      this.started = true;
      // Pause the production menu BGM; the theme owns product music while a
      // Gold surface is mounted. The menu playhead is preserved (reset=false).
      if (window.apexStopMenuMusic) { try { window.apexStopMenuMusic(false); } catch (e) {} }
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    },
    stop() {
      this.started = false;
      if (this.el) { try { this.el.pause(); } catch (e) {} }
      if (window.apexPlayMenuMusic) { try { window.apexPlayMenuMusic(false); } catch (e) {} }
    },
    toggleMute() {
      this.muted = !this.muted;
      if (this.el) this.el.muted = this.muted;
      return this.muted;
    },
  };
  document.addEventListener('visibilitychange', () => {
    if (!theme.started || !theme.el) return;
    if (document.hidden) { try { theme.el.pause(); } catch (e) {} }
    else { const p = theme.el.play(); if (p && typeof p.catch === 'function') p.catch(() => {}); }
  });
  // M is the global music mute/unmute key (owner law; supersedes any donor
  // motion/parallax/reference diagnostics).
  window.__apexGoldMusicMuted = false;
  addEventListener('keydown', (e) => {
    const k = String(e.key || '').toLowerCase();
    if (k !== 'm' || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = String((e.target && e.target.tagName) || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    const muted = theme.toggleMute();
    window.__apexGoldMusicMuted = muted;
  });

  // ── battle HUD mount (same document, canonical donor DOM) ────────────────
  const BRIDGE = window.APEX_GOLD || (window.APEX_GOLD = {});
  let hudHost = null;
  let hudMounted = false;
  let battleLiveRunning = false;
  let arenaOriginParent = null;
  let arenaOriginNext = null;

  // Same-document mount: the canonical donor DOM lives inside #battleHudHost
  // next to the real engine roots. Two consequences are handled explicitly:
  //   1. The donor's document-scoped selectors ($('#hud'), $('#stage'), …) must
  //      resolve to the DONOR's own elements. Any element outside the host that
  //      shares an id with a donor element (the legacy engine #hud, the shell's
  //      #stage/#p1Side/#p2Side) is id-parked for the duration of the mount and
  //      restored on unmount — production truth is never removed or rewritten.
  //   2. Re-created scripts must be appended to the LIVE document (appending to
  //      the detached parse document never executes them).
  const parkedIdElements = [];
  function parkCollidingIds() {
    const host = document.getElementById('battleHudHost');
    if (!host) return;
    const innerIds = new Set();
    for (const el of Array.from(host.querySelectorAll('[id]'))) innerIds.add(el.id);
    for (const id of innerIds) {
      let outside = [];
      try {
        outside = Array.from(document.querySelectorAll('[id="' + id + '"]'))
          .filter((el) => !host.contains(el));
      } catch (error) { outside = []; }
      for (const el of outside) {
        el.setAttribute('data-apex-parked-id', id);
        el.removeAttribute('id');
        parkedIdElements.push(el);
      }
    }
  }
  function restoreParkedIds() {
    for (const el of parkedIdElements) {
      const id = el.getAttribute('data-apex-parked-id');
      if (id) el.setAttribute('id', id);
      el.removeAttribute('data-apex-parked-id');
    }
    parkedIdElements.length = 0;
  }

  BRIDGE.mountBattleHud = function mountBattleHud(html, onready) {
    const host = document.getElementById('battleHudHost');
    if (!host) return;
    BRIDGE.unmountBattleHud();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = doc.body.firstElementChild || doc.documentElement;
    if (root) host.appendChild(document.importNode(root, true));
    // Park BEFORE the donor scripts run so their lookups hit their own DOM.
    parkCollidingIds();
    // The donor's inline scripts share one top-level lexical scope (the seam
    // script, the render script and the handoff bridge read each other's
    // declarations). Executing them as separate <script> elements would make a
    // REMOUNT fail: classic scripts share the document's global lexical scope,
    // so re-declaring the donor's top-level consts throws
    // "Identifier 'IC' has already been declared" and the HUD never boots.
    // Concatenating them into ONE freshly-scoped IIFE per mount keeps the
    // shared scope AND makes mount/unmount/remount idempotent.
    const scripts = Array.from(doc.querySelectorAll('script'));
    const inline = scripts.filter((node) => !node.src).map((node) => node.textContent || '').filter((t) => t.trim());
    if (inline.length) {
      const run = document.createElement('script');
      run.textContent = '(function apexGoldHudMount() {\n' + inline.join('\n;\n') + '\n})();';
      run.async = false;
      host.appendChild(run);
    }
    for (const src of scripts) {
      if (!src.src) continue;
      const run = document.createElement('script');
      run.src = src.src;
      run.async = false;
      host.appendChild(run);
    }
    hudHost = host;
    hudMounted = true;
    theme.start();
    const ready = () => { if (onready) onready(); };
    if (window.APEX_GOLD_HUD && window.APEX_GOLD_HUD.version) ready();
    else setTimeout(ready, 0);
  };

  BRIDGE.unmountBattleHud = function unmountBattleHud() {
    restoreArena();
    showLegacyBattleUi();
    stopEventTranslation();
    if (hudHost) hudHost.textContent = '';
    hudHost = null;
    hudMounted = false;
    restoreParkedIds();
    battleLiveRunning = false;
    cancelResultReturn();
    theme.stop();
  };

  // ── live arena ownership: the real canvas occupies the authored slot ─────
  function arenaElement() {
    return document.getElementById('arena');
  }
  function arenaWrapper() {
    return document.getElementById('game-wrapper') || document.getElementById('game-wrap');
  }
  function relocateArena() {
    const wrap = arenaWrapper();
    const arena = arenaElement();
    if (!wrap || !arena) return;
    if (wrap.parentElement === arena) return;
    arenaOriginParent = wrap.parentElement;
    arenaOriginNext = wrap.nextElementSibling;
    arena.appendChild(wrap);
    // Presentation adaptation only: the engine keeps its 1000×1000 gameplay
    // space; the wrapper is centered square so nothing distorts.
    wrap.style.position = 'absolute';
    wrap.style.inset = 'auto';
    wrap.style.left = '50%';
    wrap.style.top = '50%';
    wrap.style.transform = 'translate(-50%,-50%)';
    wrap.style.aspectRatio = '1 / 1';
    wrap.style.height = '100%';
    wrap.style.width = 'auto';
    wrap.style.maxWidth = '100%';
    wrap.style.maxHeight = '100%';
    wrap.style.margin = '0';
    const canvas = wrap.querySelector('#game-canvas');
    if (canvas) {
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
    }
  }
  function restoreArena() {
    const wrap = arenaWrapper();
    if (!wrap || !arenaOriginParent) return;
    wrap.style.cssText = '';
    const canvas = wrap.querySelector('#game-canvas');
    if (canvas) canvas.style.cssText = '';
    if (arenaOriginNext && arenaOriginNext.parentElement === arenaOriginParent) {
      arenaOriginParent.insertBefore(wrap, arenaOriginNext);
    } else {
      arenaOriginParent.appendChild(wrap);
    }
    arenaOriginParent = null;
    arenaOriginNext = null;
  }

  // ── legacy visible battle UI must not survive beside Gold ────────────────
  const LEGACY_BATTLE_IDS = [
    'hud', 'battle-controls', 'battle-pause-btn', 'challenge-caption',
    'countdown-overlay', 'end-screen', 'p1-name', 'p2-name', 'combat-inspector',
  ];
  function hideLegacyBattleUi() {
    for (const id of LEGACY_BATTLE_IDS) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (!el.__apexGoldHidden) {
        el.__apexGoldHidden = el.style.display;
      }
      el.style.display = 'none';
    }
  }
  function showLegacyBattleUi() {
    for (const id of LEGACY_BATTLE_IDS) {
      const el = document.getElementById(id);
      if (!el || el.__apexGoldHidden === undefined) continue;
      el.style.display = el.__apexGoldHidden || '';
      delete el.__apexGoldHidden;
    }
  }

  // ── handoff identity (accents from production) ───────────────────────────
  BRIDGE.onHandoff = function onHandoff(cfg) {
    const players = Array.isArray(cfg && cfg.players) ? cfg.players : [];
    for (const p of players) {
      if (!p) continue;
      const shellKey = String(p.id || p.name || '').toLowerCase();
      const productionId = PRODUCTION_ID_BY_SHELL_KEY[shellKey];
      if (!productionId) continue;
      const shells = window.APEX_ARSENAL_SHELLS;
      const shell = shells && typeof shells.typeFor === 'function' ? shells.typeFor(productionId) : null;
      const color = (shell && shell.color) || FALLBACK_ACCENTS[shellKey];
      if (color) p.accent = color;
      p.productionId = productionId;
    }
  };

  // ── real match start at the authored handoff beat ────────────────────────
  // The product match entry lives in the deferred 'arsenalProduct' group
  // (arsenalShellSelectRuntime.startMatch + arsenalBattleRuntime + the combat
  // HUD + presentation/SFX runtimes). Gold's shell mount only warms the hub
  // group, so the group must be loaded HERE — before any production trigger
  // is wired or fired — or startMatch/the HUD observer simply do not exist.
  function ensureDeferredRuntimes(group, timeoutMs = 10000) {
    return new Promise((resolve) => {
      const started = Date.now();
      const tick = () => {
        const loader = window.__apexEnsureDeferredRuntimes;
        if (typeof loader === 'function') {
          try {
            Promise.resolve(loader(group)).then(
              () => resolve(true),
              () => resolve(false)
            );
          } catch (error) {
            resolve(false);
          }
          return;
        }
        if (Date.now() - started > timeoutMs) {
          console.warn('[gold-bridge] deferred runtime loader never became available.');
          resolve(false);
          return;
        }
        setTimeout(tick, 50);
      };
      tick();
    });
  }
  BRIDGE.onBattleLive = async function onBattleLive(pick) {
    if (battleLiveRunning) return;
    const mode = (pick && pick.mode === 'bot') ? 'BOT' : 'LOCAL';
    const p1Shell = String((pick && pick.p1) || 'newbot').toLowerCase();
    const p2Shell = mode === 'BOT' ? 'newbot' : String((pick && pick.p2) || 'newbot').toLowerCase();
    const p1 = PRODUCTION_ID_BY_SHELL_KEY[p1Shell] || 'ROBOT';
    const p2 = PRODUCTION_ID_BY_SHELL_KEY[p2Shell] || 'ROBOT';
    const shells = window.APEX_ARSENAL_SHELLS;
    if (!shells || typeof shells.typeFor !== 'function') return;
    if (window.APEX_GOLD_LOCKED && (window.APEX_GOLD_LOCKED(p1Shell) || window.APEX_GOLD_LOCKED(p2Shell))) return;
    battleLiveRunning = true;
    try {
      window.__apexArsenalSelectionMode = mode.toLowerCase();
      window.__apexArsenalBotBattle = mode === 'BOT';
      window.__apexArsenalFreeBattle = mode !== 'BOT';
      window.__apexArsenalSelectPending = true;
      window.p1Selection = shells.typeFor(p1);
      window.p2Selection = shells.typeFor(p2);
      // Load the battle product runtimes first: startMatch, the combat HUD
      // observer and the SFX/VFX presentation runtimes must exist before any
      // production trigger is wired or fired.
      await ensureDeferredRuntimes('arsenalProduct');
      if (window.apexStopMenuMusic) { try { window.apexStopMenuMusic(true); } catch (e) {} }
      relocateArena();
      hideLegacyBattleUi();
      // Wrap the real HUD observer only after the group is present.
      installEventTranslation();
      // The product match entry validates ownership and starts the real match
      // (startArsenalBattleMode). No synthetic input is involved.
      if (typeof window.startMatch !== 'function') {
        console.warn('[gold-bridge] startMatch unavailable; battle did not start.');
        battleLiveRunning = false;
        return;
      }
      window.startMatch();
      startPump();
    } catch (error) {
      console.warn('[gold-bridge] battle live failed.', error);
      battleLiveRunning = false;
    }
  };

  // ── mobile skill cards / weapon panel through the production adapter ────
  BRIDGE.pressSkill = function pressSkill(pi, ai) {
    const heroRework = window.APEX_HERO_REWORK;
    const fighters = window.fighters;
    if (!heroRework || typeof heroRework.pressAbility !== 'function') return;
    if (!Array.isArray(fighters) || !fighters[pi]) return;
    try { heroRework.pressAbility(fighters[pi], ai === 1 ? 'A2' : 'A1'); } catch (e) {}
  };
  BRIDGE.pressSwap = function pressSwap() {
    // Production weapons are acquired by real pickup; there is no manual swap
    // command. The Gold weapon panel reflects the real equipped weapon.
  };

  // ── real damage events → canonical HUD presentation ─────────────────────
  // Locked owner law:
  //   Heavy  = >200 realized damage to the same victim in a rolling 1.20s
  //            window; one Heavy response per burst.
  //   A confirmed Stormbreaker damaging hit = Heavy family + separate
  //            Thunder/Lightning family.
  //   Critical response color follows the attacker/source accent.
  const HEAVY_WINDOW_MS = 1200;
  const HEAVY_THRESHOLD = 200;
  const heavyWindows = [[], []];
  // Locked owner law: one Heavy response per burst. The burst is the rolling
  // window; once a Heavy response has fired inside it, later hits of the same
  // burst present as their own tier (normal/crit) instead of re-triggering the
  // Heavy family. The latch clears when the window drains (new burst).
  const heavyLatch = [0, 0];
  let translationInstalled = false;

  function sideOfBody(body) {
    const id = body && body.id;
    return (id === 1 || id === 2) ? id - 1 : -1;
  }
  function heavyTierFor(victimIdx, amount, now) {
    const w = heavyWindows[victimIdx];
    w.push({ t: now, amount });
    while (w.length && now - w[0].t > HEAVY_WINDOW_MS) w.shift();
    let sum = 0;
    for (const e of w) sum += e.amount;
    if (sum <= HEAVY_THRESHOLD) return false;
    if (heavyLatch[victimIdx] && now - heavyLatch[victimIdx] <= HEAVY_WINDOW_MS) return false;
    heavyLatch[victimIdx] = now;
    return true;
  }
  function stormbreakerHit(ev) {
    const attacker = ev && ev.attacker;
    const holder = attacker && attacker.data && attacker.data.arsenal;
    return !!(holder && holder.weaponId === 'STORMBREAKER');
  }
  function accentOf(body) {
    return (body && body.color) || '#ff8a1e';
  }
  function setCritAccent(color) {
    const hud = document.getElementById('hud');
    // The donor HUD root carries data-mode; the Gold host wraps it.
    const root = (hud && hud.dataset && hud.dataset.mode) ? hud
      : (document.querySelector('#battleHudHost #hud') || hud);
    if (root && root.style) root.style.setProperty('--crit', color);
  }

  function onRealizedDamage(ev) {
    if (!hudMounted || !ev) return;
    const seam = window.APEX_GOLD_HUD;
    if (!seam || typeof seam.hit !== 'function') return;
    const v = sideOfBody(ev.victim);
    const a = sideOfBody(ev.attacker);
    if (v < 0 || a < 0) return;
    const now = performance.now();
    const amount = Math.max(0, Number(ev.amount) || 0);
    if (!(amount > 0)) return;
    const victimHp = (ev.victim && typeof ev.victim.hp === 'number') ? ev.victim.hp : null;
    const storm = stormbreakerHit(ev);
    const heavy = heavyTierFor(v, amount, now);
    if (storm) {
      setCritAccent(accentOf(ev.attacker));
      if (seam.hitStorm) seam.hitStorm(a, v, amount, victimHp);
      else seam.hit(a, v, amount, 'heavy', victimHp);
      return;
    }
    if (heavy) {
      if (seam.hit) seam.hit(a, v, amount, 'heavy', victimHp);
      return;
    }
    if (ev.critical) {
      // Critical response color follows the attacker/source accent.
      setCritAccent(accentOf(ev.attacker));
      if (seam.hit) seam.hit(a, v, amount, 'crit', victimHp);
      return;
    }
    if (seam.hit) seam.hit(a, v, amount, 'normal', victimHp);
  }

  function installEventTranslation() {
    if (translationInstalled) return;
    translationInstalled = true;
    // Wrap (never replace) the production combat HUD observer so the existing
    // energy/vitals math keeps running untouched.
    const hud = window.APEX_COMBAT_HUD;
    if (hud && typeof hud.onRealizedDamage === 'function' && !hud.__apexGoldWrapped) {
      const prev = hud.onRealizedDamage;
      hud.__apexGoldWrapped = true;
      hud.onRealizedDamage = function apexGoldObserved(ev) {
        try { prev.call(this, ev); } catch (e) {}
        try { onRealizedDamage(ev); } catch (e) {}
      };
    }
    // Real ability casts drive the canonical skill cards.
    const ail = window.APEX_HERO_REWORK_AIL;
    if (ail && ail.bus && typeof ail.bus.on === 'function' && !ail.bus.__apexGoldCast) {
      ail.bus.__apexGoldCast = true;
      ail.bus.on('Cast', (evt) => {
        if (!hudMounted) return;
        const seam = window.APEX_GOLD_HUD;
        const payload = evt && evt.payload;
        if (!seam || !payload) return;
        const fighters = window.fighters;
        if (!Array.isArray(fighters)) return;
        const hero = String(payload.hero || '').toUpperCase();
        const slot = payload.slot === 'A2' ? 1 : 0;
        for (let i = 0; i < 2; i++) {
          const f = fighters[i];
          if (!f || heroIdOf(f) !== hero) continue;
          try {
            if (typeof seam.cast === 'function') seam.cast(i, slot);
            if (typeof seam.setSkill === 'function') {
              seam.setSkill(i, slot, {
                cd: heroSkillCooldown(hero, payload.slot === 'A2' ? 'A2' : 'A1'),
                nextIn: heroSkillCooldown(hero, payload.slot === 'A2' ? 'A2' : 'A1'),
                castUntil: true,
              });
            }
          } catch (e) {}
          break;
        }
      });
    }
  }
  function stopEventTranslation() {
    // Listeners stay installed (idempotent across sessions); the hudMounted
    // flag above gates them. Heavy windows/latches reset per match.
    heavyWindows[0].length = 0;
    heavyWindows[1].length = 0;
    heavyLatch[0] = 0;
    heavyLatch[1] = 0;
  }

  // ── per-frame production projection → canonical HUD state ───────────────
  function heroRegistry() {
    return window.APEX_HERO_REWORK_REGISTRY || null;
  }
  function heroSkillCooldown(heroId, slot) {
    const reg = heroRegistry();
    if (!reg) return 10;
    try {
      const cfg = (typeof reg.resolveSkillLevel === 'function')
        ? reg.resolveSkillLevel(heroId, slot, 1)
        : (reg.HEROES && reg.HEROES[heroId] && reg.HEROES[heroId].skills ? reg.HEROES[heroId].skills[slot] : null);
      const cd = cfg && (cfg.cooldown != null ? cfg.cooldown : (cfg.def && cfg.def.cooldown));
      return Number.isFinite(cd) ? Number(cd) : 10;
    } catch (e) { return 10; }
  }
  function heroSkillName(heroId, slot) {
    const reg = heroRegistry();
    try {
      const hero = reg && reg.HEROES ? reg.HEROES[heroId] : null;
      const def = hero && hero.skills ? hero.skills[slot] : null;
      return def && def.name ? String(def.name).toUpperCase() : slot;
    } catch (e) { return slot; }
  }
  function heroIdOf(fighter) {
    return (fighter && (fighter.heroId || fighter.name)) ? String(fighter.heroId || fighter.name).toUpperCase() : null;
  }
  function skillProjection(fighter) {
    const heroId = heroIdOf(fighter);
    const out = [];
    for (let k = 0; k < 2; k++) {
      const slot = k === 0 ? 'A1' : 'A2';
      out.push({
        name: heroId ? heroSkillName(heroId, slot) : slot,
        cd: heroId ? heroSkillCooldown(heroId, slot) : 10,
        max: 1, charges: 1, nextIn: 0, castUntil: false,
      });
    }
    return out;
  }
  function weaponProjection(fighter) {
    const holder = fighter && fighter.data && fighter.data.arsenal;
    if (!holder || !holder.def) return null;
    const def = holder.def;
    const shots = Number(def.shots) || 0;
    const fired = Number(holder.shotsFired) || 0;
    const name = def.art || holder.weaponId || 'UNARMED';
    const family = def.family || (def.category === 'ranged' ? 'RANGED' : 'MELEE');
    return {
      name: String(name).toUpperCase(),
      type: String(family).toUpperCase(),
      index: 0,
      mag: Math.max(1, shots),
      ammo: Math.max(0, shots - fired),
      reloading: false,
      alt: 'UNARMED',
    };
  }
  function vitalsProjection(fighter) {
    if (!fighter) return null;
    return {
      hp: Number(fighter.hp) || 0,
      maxHp: Number(fighter.maxHp) || 1000,
    };
  }
  function projection() {
    const arsenal = window.APEX_ARSENAL;
    const state = arsenal && arsenal.state ? arsenal.state : null;
    const combat = window.APEX_COMBAT_HUD;
    const base = (combat && typeof combat.projection === 'function') ? combat.projection() : null;
    const fighters = window.fighters;
    const sides = [];
    const fighterPos = [];
    for (let i = 0; i < 2; i++) {
      const f = Array.isArray(fighters) ? fighters[i] : null;
      const projSide = base && Array.isArray(base.sides) ? base.sides[i] : null;
      const identity = (projSide && projSide.identity) || {};
      const vitals = (projSide && projSide.vitals) || {};
      const skills = skillProjection(f);
      const weapon = weaponProjection(f) || { name: 'UNARMED', type: 'MELEE', index: 0, mag: 1, ammo: 0, reloading: false, alt: 'UNARMED' };
      const vitalsFallback = vitalsProjection(f) || { hp: 0, maxHp: 1000 };
      sides.push({
        hp: (vitals && Number.isFinite(vitals.hp)) ? vitals.hp : vitalsFallback.hp,
        maxHp: (vitals && Number.isFinite(vitals.maxHp)) ? vitals.maxHp : vitalsFallback.maxHp,
        rage: (vitals && Number.isFinite(vitals.rage)) ? vitals.rage : 0,
        accent: identity.color || (f && f.color) || '#ffffff',
        name: identity.name || (f && f.name) || '',
        skills,
        weapon,
      });
      if (f) fighterPos.push({ x: f.x, y: f.y, aim: Number.isFinite(f.aim) ? f.aim : 0 });
      else fighterPos.push(null);
    }
    return {
      state: {
        timer: state && Number.isFinite(state.time) ? state.time : 0,
        round: 1,
        wins: [0, 0],
        ko: !!(state && state.over),
        sides,
      },
      fighters: fighterPos,
    };
  }

  let pumpId = 0;
  let lastKo = null;
  // ── result / return ─────────────────────────────────────────────────────
  // The Gold HUD owns the result presentation (canonical K.O./TIME stamp +
  // win counter). Once that presentation has played out, the REAL production
  // battle is exited (exitArsenalBattleMode: session teardown, AV/storm
  // clear, listener removal, menu restore) and the shell is told to return to
  // the fighter screen. Nothing synthetic is invented; the engine stays the
  // only match authority, and the whole sequence is idempotent per match.
  const RESULT_HOLD_MS = 2600; // donor K.O. stamp (1700ms) + read-out margin
  let resultReturnTimer = 0;
  function scheduleResultReturn() {
    if (resultReturnTimer) return;
    resultReturnTimer = setTimeout(() => {
      resultReturnTimer = 0;
      if (!hudMounted) return;
      try { window.exitArsenalBattleMode?.(); } catch (error) { /* truth-first */ }
      try {
        window.postMessage({ type: 'APEX_CHAOS_BATTLE_EXIT' }, '*');
      } catch (error) { /* same-document mount; parent === window */ }
    }, RESULT_HOLD_MS);
  }
  function cancelResultReturn() {
    if (resultReturnTimer) {
      clearTimeout(resultReturnTimer);
      resultReturnTimer = 0;
    }
  }

  function pump() {
    pumpId = requestAnimationFrame(pump);
    if (!hudMounted) return;
    const seam = window.APEX_GOLD_HUD;
    if (!seam) return;
    const proj = projection();
    if (typeof seam.applyState === 'function') seam.applyState(proj.state);
    if (typeof seam.syncFighters === 'function') seam.syncFighters(proj.fighters);
    const arsenal = window.APEX_ARSENAL;
    const state = arsenal && arsenal.state ? arsenal.state : null;
    const over = state && state.over ? String(state.over) : null;
    if (over && over !== lastKo) {
      lastKo = over;
      // Production truth: state.over carries the WINNER'S NAME (or TIME). Map
      // it to the real fighter side; never assume a P1/P2 token.
      const fighters = window.fighters;
      const winnerIdx = Array.isArray(fighters)
        ? fighters.findIndex((f) => f && String(f.name) === over)
        : -1;
      const loserIdx = winnerIdx === 0 ? 1 : winnerIdx === 1 ? 0 : -1;
      if (winnerIdx >= 0 && typeof seam.ko === 'function') seam.ko(winnerIdx, loserIdx);
      else if (typeof seam.ko === 'function') seam.ko(-1, -1);
      // Draw/time-out still returns: the stamp reads TIME and the shell goes
      // back to fighter select either way.
      scheduleResultReturn();
    }
    if (!over) lastKo = null;
  }
  function startPump() {
    lastKo = null;
    cancelResultReturn();
    if (!pumpId) pumpId = requestAnimationFrame(pump);
  }

  // ── production event surface for tooling/evidence (read-only) ────────────
  window.APEX_GOLD_PROJECTION = projection;

  window.apexGoldProductBridge = 'ready';
})();
