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
  // ── immutable Git art authority (R44 owner-playtest media manifest) ─────
  // Every URL below is a gitPath recorded in
  // docs/gold-ui/preload/OWNER_PLAYTEST_MEDIA_R44_MANIFEST.json — nothing is
  // inferred, fabricated or substituted. Production state MERGES into this
  // mapping (see rosterFromProduction); it never replaces it, so a state
  // projection can no longer drop a resolved Core Six art role.
  // MIRROR deliberately has NO static selected pose: its selected presentation
  // is the accepted opponent-derived/translucent mirror treatment, so
  // PICK_SELECTED_LARGE is absent by design and is never replaced by a broken
  // or placeholder image.
  const HERO_UI_ART_ROOT = '/assets/gold-ui/heroes/';
  const HERO_UI_ART = {
    newbot: {
      portrait: HERO_UI_ART_ROOT + 'newbot/pick_roster_cover.webp',
      art: HERO_UI_ART_ROOT + 'newbot/pick_selected_large.webp',
      battleAvatar: HERO_UI_ART_ROOT + 'newbot/battle_avatar.webp',
      skillIcons: [
        HERO_UI_ART_ROOT + 'newbot/skill_passive.webp',
        HERO_UI_ART_ROOT + 'newbot/skill_a1.webp',
        HERO_UI_ART_ROOT + 'newbot/skill_a2.webp',
      ],
    },
    hunter: {
      portrait: HERO_UI_ART_ROOT + 'hunter/pick_roster_cover.webp',
      art: HERO_UI_ART_ROOT + 'hunter/pick_selected_large.webp',
      battleAvatar: HERO_UI_ART_ROOT + 'hunter/battle_avatar.webp',
      skillIcons: [
        HERO_UI_ART_ROOT + 'hunter/skill_passive.webp',
        HERO_UI_ART_ROOT + 'hunter/skill_a1.webp',
        HERO_UI_ART_ROOT + 'hunter/skill_a2.webp',
      ],
    },
    crystala: {
      portrait: HERO_UI_ART_ROOT + 'crystala/pick_roster_cover.webp',
      art: HERO_UI_ART_ROOT + 'crystala/pick_selected_large.webp',
      battleAvatar: HERO_UI_ART_ROOT + 'crystala/battle_avatar.webp',
      skillIcons: [
        HERO_UI_ART_ROOT + 'crystala/skill_passive.webp',
        HERO_UI_ART_ROOT + 'crystala/skill_a1.webp',
        HERO_UI_ART_ROOT + 'crystala/skill_a2.webp',
      ],
    },
    magnet: {
      portrait: HERO_UI_ART_ROOT + 'magnet/pick_roster_cover.webp',
      art: HERO_UI_ART_ROOT + 'magnet/pick_selected_large.webp',
      battleAvatar: HERO_UI_ART_ROOT + 'magnet/battle_avatar.webp',
      skillIcons: [
        HERO_UI_ART_ROOT + 'magnet/skill_passive.webp',
        HERO_UI_ART_ROOT + 'magnet/skill_a1.webp',
        HERO_UI_ART_ROOT + 'magnet/skill_a2.webp',
      ],
    },
    frost: {
      portrait: HERO_UI_ART_ROOT + 'frost/pick_roster_cover.webp',
      art: HERO_UI_ART_ROOT + 'frost/pick_selected_large.webp',
      battleAvatar: HERO_UI_ART_ROOT + 'frost/battle_avatar.webp',
      skillIcons: [
        HERO_UI_ART_ROOT + 'frost/skill_passive.webp',
        HERO_UI_ART_ROOT + 'frost/skill_a1.webp',
        HERO_UI_ART_ROOT + 'frost/skill_a2.webp',
      ],
    },
    // Mirror: no PICK_SELECTED_LARGE by owner decision.
    mirror: {
      portrait: HERO_UI_ART_ROOT + 'mirror/pick_roster_cover.webp',
      battleAvatar: HERO_UI_ART_ROOT + 'mirror/battle_avatar.webp',
      skillIcons: [
        HERO_UI_ART_ROOT + 'mirror/skill_passive.webp',
        HERO_UI_ART_ROOT + 'mirror/skill_a1.webp',
        HERO_UI_ART_ROOT + 'mirror/skill_a2.webp',
      ],
    },
  };
  // Roles the manifest resolves for the current Core Six (mirror's selected
  // pose is intentionally absent — 5 roles, not 6).
  const HERO_UI_ART_ROLES = ['portrait', 'art', 'battleAvatar', 'skillIcons'];
  function heroUiArt(shellKey) {
    const art = HERO_UI_ART[shellKey];
    if (!art) return null;
    // Clone so a consumer can never mutate the immutable Git authority.
    const out = {};
    for (const role of HERO_UI_ART_ROLES) {
      if (Object.prototype.hasOwnProperty.call(art, role)) out[role] = Array.isArray(art[role]) ? art[role].slice() : art[role];
    }
    return out;
  }

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

  // Production-visible roster authority (2026-10-05): the Gold roster is
  // NEVER hard-capped to the Core Six. Every production-VISIBLE fighter is
  // published; playability/ownership stay production authority, and future
  // visible fighters present as LOCKED cards (fallback copy, no fake
  // mechanics) instead of being silently omitted.
  function productionVisibleIds() {
    const shells = window.APEX_ARSENAL_SHELLS;
    const read = (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'function') { try { return v() || []; } catch (e) { return []; } }
      return [];
    };
    if (shells) {
      const visible = read(shells.visibleIds);
      if (visible.length) return visible.map((id) => String(id).toUpperCase());
      const all = read(shells.ids);
      if (all.length) return all.map((id) => String(id).toUpperCase());
    }
    return [];
  }
  function productionPlayableIds() {
    const shells = window.APEX_ARSENAL_SHELLS;
    const read = (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'function') { try { return v() || []; } catch (e) { return []; } }
      return [];
    };
    if (shells) {
      const playable = read(shells.playableIds);
      if (playable.length) return new Set(playable.map((id) => String(id).toUpperCase()));
      if (typeof shells.isPlayable === 'function') return null; // predicate fallback below
    }
    return new Set();
  }
  function isProductionPlayable(productionId) {
    const shells = window.APEX_ARSENAL_SHELLS;
    const playable = productionPlayableIds();
    if (playable) return playable.has(productionId);
    return !!(shells && typeof shells.isPlayable === 'function' && shells.isPlayable(productionId));
  }
  function rosterFromProduction() {
    const shells = window.APEX_ARSENAL_SHELLS;
    const meta = window.APEX_ARSENAL_META;
    const heroes = {};
    for (const productionId of productionVisibleIds()) {
      const key = GOLD_SHELL_KEY_BY_PRODUCTION_ID[productionId] || productionId.toLowerCase();
      const shell = (shells && typeof shells.typeFor === 'function') ? shells.typeFor(productionId) : null;
      const copy = GOLD_HERO_COPY[key];
      const playable = isProductionPlayable(productionId);
      // Locked/fallback presentation for future visible fighters: no fabricated
      // mechanics, no invented art, just a real locked card.
      const color = (shell && shell.color) || (copy && copy.color) || FALLBACK_ACCENTS[key] || '#8d8375';
      const name = (copy && copy.name)
        || (shell && shell.name ? String(shell.name).toUpperCase() : productionId);
      // Ownership is production authority (the meta save). A missing/absent
      // ownership API simply means "not owned yet" — never "owned".
      const owned = !!(meta && typeof meta.owns === 'function' && meta.owns(productionId));
      // MERGE, never replace: the immutable Git art authority is the base and
      // the production state projection is layered on top. Art roles are
      // therefore always present for a resolved Core Six fighter even when the
      // state projection is partial, and a Gold placeholder is never used for
      // a role that has a real Git asset.
      const art = heroUiArt(key);
      heroes[key] = Object.assign({}, art, {
        name,
        color,
        accent: color,
        tag: (copy && copy.tag) || 'LOCKED // PRE-PILOT',
        productionId,
        playable,
        // A locked future fighter is never "owned" for selection purposes; the
        // Core Six keep real production ownership.
        owned: playable ? owned : false,
        locked: !playable,
        // Explicit art roles (survive the state projection by construction).
        portrait: (art && art.portrait) || '',
        // Mirror has no static selected pose: leave it undefined rather than
        // emitting a broken or placeholder image.
        art: art && Object.prototype.hasOwnProperty.call(art, 'art') ? art.art : undefined,
        battleAvatar: (art && art.battleAvatar) || (art && art.portrait) || '',
        skillIcons: (art && art.skillIcons) ? art.skillIcons.slice() : [],
      });
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
    if (!hero) return true; // not in the production visible roster
    if (hero.playable === false) return true; // future visible fighter: locked
    // ONE selection authority: the production meta's canPublicSelect(), which
    // owns the single fenced owner-playtest selection override. This bridge
    // never implements a second bypass, and ownership/Lucky Draw/Shop keep
    // reading production truth (owns()).
    const meta = window.APEX_ARSENAL_META;
    if (meta && typeof meta.canPublicSelect === 'function') {
      return !meta.canPublicSelect(hero.productionId);
    }
    return !hero.owned;
  };
  // Full production-visible roster (playable + locked) for the shell picker.
  window.APEX_GOLD_ROSTER_ORDER = function goldRosterOrder() {
    const roster = rosterFromProduction();
    return Object.keys(roster).sort((a, b) => {
      const pa = roster[a].playable === false ? 1 : 0;
      const pb = roster[b].playable === false ? 1 : 0;
      if (pa !== pb) return pa - pb;
      return String(roster[a].productionId).localeCompare(String(roster[b].productionId));
    });
  };
  // The one BOT opponent identity: production owns it, presentation derives it.
  BRIDGE_BOT_HELPERS: {
    const botProductionId = () => {
      const shells = window.APEX_ARSENAL_SHELLS;
      if (shells && typeof shells.botOpponentId === 'function') {
        const id = shells.botOpponentId();
        if (id) return String(id).toUpperCase();
      }
      return 'ROBOT';
    };
    const BRIDGE0 = window.APEX_GOLD || (window.APEX_GOLD = {});
    BRIDGE0.botOpponentProductionId = botProductionId;
    BRIDGE0.botOpponentShellKey = function botOpponentShellKey() {
      const id = botProductionId();
      return GOLD_SHELL_KEY_BY_PRODUCTION_ID[id] || id.toLowerCase();
    };
    // Production-visible roster authority (one explicit mapping covering EVERY
    // production-visible entry; no hard cap, nothing silently omitted).
    BRIDGE0.roster = function goldRoster() {
      const prod = rosterFromProduction();
      return Object.keys(prod).map((key) => Object.assign({ id: key }, prod[key]));
    };
    BRIDGE0.rosterOrder = function goldRosterOrder() {
      return window.APEX_GOLD_ROSTER_ORDER();
    };
    BRIDGE0.isPlayable = function goldIsPlayable(shellKey) {
      const prod = rosterFromProduction();
      const hero = prod[String(shellKey || '')];
      return !!hero && hero.playable !== false;
    };
  }

  // ── owner theme music — ONE authority (2026-10-05 correction slice) ─────
  // The product music authority lives in src/App.jsx: ONE persistent
  // HTMLMediaElement whose source is the Forward Drive theme. This bridge
  // NEVER creates a second Audio element and NEVER opens a music AudioContext;
  // it only tells that authority which product surface is showing. Surface
  // policy, fades (300–450ms), playhead preservation, hidden/blur pause and
  // the M key (music only) all live in that single authority.
  const THEME_SRC = '/assets/audio/forward_drive_theme.ogg';
  const productMusic = () => (typeof window !== 'undefined' ? window.apexProductMusic : null);
  const theme = {
    // Surfaces where the Forward Drive theme plays: Home, mode select, fighter
    // select and the battle-entry transition. Everything else is music-off.
    ALLOWED: ['home', 'mode', 'fighter', 'transition'],
    started: false,
    ensure() {
      // The single existing element is created by the product authority; the
      // bridge only verifies that its source really is the Forward Drive theme.
      const music = productMusic();
      const state = music && typeof music.state === 'function' ? music.state() : null;
      const ok = !!music && !!state && /forward_drive_theme\.ogg/.test(String(state.src || ''));
      window.__apexGoldThemeSourceOk = ok;
      return ok ? music : null;
    },
    start() {
      const music = this.ensure();
      if (this.started) return;
      this.started = true;
      if (music && typeof music.fadeIn === 'function') music.fadeIn();
    },
    stop() {
      this.started = false;
      const music = productMusic();
      if (music && typeof music.fadeOut === 'function') music.fadeOut();
    },
    // The actual match starting fades the theme out (playhead preserved).
    fadeOutForMatch() {
      const music = productMusic();
      if (music && typeof music.fadeOut === 'function') music.fadeOut();
    },
    setSurface(surfaceId) {
      const music = productMusic();
      if (music && typeof music.setSurface === 'function') music.setSurface(surfaceId);
    },
    toggleMute() {
      const music = productMusic();
      if (music && typeof music.toggleMute === 'function') return music.toggleMute();
      return false;
    },
    state() {
      const music = productMusic();
      return music && typeof music.state === 'function' ? music.state() : null;
    },
  };
  // hidden/blur pause and visible/focus resume (only when playback was
  // previously allowed) are owned by the single product authority in App.jsx.
  // M is the global music mute — handled there too, so this bridge must not
  // install a second M handler (that would double-toggle the same element).
  window.__apexGoldMusicMuted = false;

  // ── battle HUD mount (same document, canonical donor DOM) ────────────────
  const BRIDGE = window.APEX_GOLD || (window.APEX_GOLD = {});
  // Product surface notifications (Home / mode / fighter / transition /
  // lucky / locked surfaces) drive the single music authority's policy.
  BRIDGE.onSurface = function onSurface(surfaceId) {
    theme.setSurface(surfaceId);
  };
  let hudHost = null;
  let hudMounted = false;
  let battleLiveRunning = false;
  // Invalidate any deferred battle launch that outlives its Gold HUD session.
  // A user can ESC while arsenalProduct runtimes are still loading; without a
  // session token that stale continuation can start the engine after Pick is
  // already visible again.
  let battleSessionToken = 0;
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

  // Battle HUD donor is a full-page document. When mounted same-document its
  // head CSS must come with it, but never as global CSS: broad donor rules
  // (:root, html/body, *, button, .side, .skill...) would otherwise leak into
  // Home/Pick. Keep keyframes global by name, and scope every normal/conditional
  // rule to #battleHudHost. The current donor has no @font-face/import rules.
  function extractKeyframeBlocks(cssText) {
    const src = String(cssText || '');
    const frames = [];
    let rules = '';
    let cursor = 0;
    while (cursor < src.length) {
      const a = src.indexOf('@keyframes', cursor);
      const b = src.indexOf('@-webkit-keyframes', cursor);
      let start = -1;
      if (a >= 0 && b >= 0) start = Math.min(a, b);
      else start = Math.max(a, b);
      if (start < 0) { rules += src.slice(cursor); break; }
      rules += src.slice(cursor, start);
      const open = src.indexOf('{', start);
      if (open < 0) { rules += src.slice(start); break; }
      let depth = 0, quote = '', comment = false, end = open;
      for (let i = open; i < src.length; i++) {
        const ch = src[i], next = src[i + 1];
        if (comment) {
          if (ch === '*' && next === '/') { comment = false; i++; }
          continue;
        }
        if (!quote && ch === '/' && next === '*') { comment = true; i++; continue; }
        if (quote) {
          if (ch === '\\') { i++; continue; }
          if (ch === quote) quote = '';
          continue;
        }
        if (ch === '"' || ch === "'") { quote = ch; continue; }
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) { end = i + 1; break; }
        }
      }
      if (!end || end <= open) { rules += src.slice(start); break; }
      frames.push(src.slice(start, end));
      cursor = end;
    }
    return { rules, frames };
  }
  function scopedBattleHudCss(doc) {
    const raw = Array.from(doc.querySelectorAll('style'))
      .map((node) => node.textContent || '')
      .filter((text) => text.trim())
      .join('\n');
    if (!raw.trim()) return '';
    const split = extractKeyframeBlocks(raw);
    const scopedRules = split.rules
      .replace(/:root\b/g, ':scope')
      .replace(/html\s*,\s*body/g, ':scope');
    return '@scope (#battleHudHost){\n' + scopedRules + '\n}\n' + split.frames.join('\n');
  }

  BRIDGE.mountBattleHud = function mountBattleHud(html, onready) {
    const host = document.getElementById('battleHudHost');
    if (!host) return;
    BRIDGE.unmountBattleHud();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = doc.body.firstElementChild || doc.documentElement;
    if (root) host.appendChild(document.importNode(root, true));
    // Capture the exact legacy node references BEFORE their ids are parked, so
    // no later legacy hide can resolve (and hide) the Gold donor instead.
    captureLegacyBattleUi();
    // Park BEFORE the donor scripts run so their lookups hit their own DOM.
    parkCollidingIds();
    const hudCss = scopedBattleHudCss(doc);
    if (hudCss) {
      const style = document.createElement('style');
      style.setAttribute('data-apex-gold-hud-style', 'true');
      style.textContent = hudCss;
      host.insertBefore(style, host.firstChild);
    }
    // The production seam closes over donor-local renderer state. A remount
    // must create a FRESH seam; retaining window.APEX_GOLD_HUD would preserve
    // functions bound to the removed previous donor DOM.
    try { delete window.APEX_GOLD_HUD; } catch (error) { window.APEX_GOLD_HUD = undefined; }
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
    // Surface/music state is owned by the Gold shell. The bridge owns only
    // donor/runtime lifecycle; it must not create a competing fade sequence.
    const ready = () => { if (onready) onready(); };
    if (window.APEX_GOLD_HUD && window.APEX_GOLD_HUD.version) ready();
    else setTimeout(ready, 0);
  };

  BRIDGE.unmountBattleHud = function unmountBattleHud() {
    // Defensive/idempotent teardown. Invalidate any in-flight deferred launch
    // before removing the donor so it cannot resume against detached DOM.
    battleSessionToken += 1;
    if (battleLiveRunning || window.__apexGoldBattleHosted === true) BRIDGE.exitBattle?.();
    restoreArena();
    showLegacyBattleUi();
    stopEventTranslation();
    if (pumpId) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(pumpId);
      pumpId = 0;
    }
    if (hudHost) hudHost.textContent = '';
    hudHost = null;
    hudMounted = false;
    restoreParkedIds();
    battleLiveRunning = false;
    window.__apexGoldBattleHosted = false;
    cancelResultReturn();
    try { delete window.APEX_GOLD_HUD; } catch (error) { window.APEX_GOLD_HUD = undefined; }
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
  // OWNER LAW 2026-10-05 (P0 black battle screen): a global
  // document.getElementById(id) is AMBIGUOUS once the Gold donor owns the same
  // id. The donor HUD owns #hud (and #stage/#p1Side/#p2Side), so a legacy hide
  // that resolved by global id hid the GOLD HUD itself — the battle ran with
  // audio but a black/invisible presentation. Legacy nodes are therefore
  // captured by exact reference BEFORE the donor mount parks their ids, and
  // only those references are ever hidden.
  const LEGACY_BATTLE_IDS = [
    'hud', 'battle-controls', 'battle-pause-btn', 'challenge-caption',
    'countdown-overlay', 'end-screen', 'p1-name', 'p2-name', 'combat-inspector',
    // arsenalBattleRuntime creates this overlay only AFTER startMatch(); it
    // contains the legacy B/ESC hint, EXIT button, debug and result layer.
    'aq-dom-hud', 'aq-hint', 'aq-battle-exit', 'aq-debug', 'aq-win',
  ];
  // Elements a legacy hide must NEVER touch (hard invariant): the Gold host,
  // every authored donor node, the authored arena slot, #game-wrapper and
  // #game-canvas. Membership is captured by EXACT REFERENCE before the arena
  // relocation, because relocateArena() intentionally moves #game-wrapper (and
  // the legacy overlays inside it) into the donor's arena slot — a live
  // containment test would then misclassify those legacy overlays as donor
  // nodes and let them survive beside Gold.
  const PROTECTED_HIDE_IDS = ['battleHudHost', 'game-wrapper', 'game-canvas', 'arena'];
  const legacyBattleRefs = [];
  const protectedHideRefs = new Set();
  function isProtectedFromLegacyHide(el) {
    if (!el) return true;
    return protectedHideRefs.has(el);
  }
  // Resolve a legacy production node without ever resolving the Gold donor:
  // a node parked by the mount (id temporarily removed) is addressable through
  // its parked-id marker, otherwise the element with that id OUTSIDE the host.
  function legacyUiElement(id) {
    const key = String(id || '');
    if (!key) return null;
    let parked = null;
    try { parked = document.querySelector('[data-apex-parked-id="' + key + '"]'); } catch (error) { parked = null; }
    if (parked) return parked;
    const host = document.getElementById('battleHudHost');
    let nodes = [];
    try { nodes = Array.from(document.querySelectorAll('[id="' + key + '"]')); } catch (error) { nodes = []; }
    for (const el of nodes) {
      if (host && host.contains(el)) continue;
      return el;
    }
    return null;
  }
  function captureLegacyBattleUi(reset = true) {
    if (reset) {
      legacyBattleRefs.length = 0;
      protectedHideRefs.clear();
    }
    const protect = (el) => { if (el) protectedHideRefs.add(el); };
    const host = document.getElementById('battleHudHost');
    if (host) {
      protect(host);
      // Every authored donor node present at mount time (the donor root and
      // its whole subtree) — captured by reference, never re-derived later.
      const donorRoot = host.firstElementChild;
      protect(donorRoot);
      let donorNodes = [];
      try { donorNodes = Array.from(host.querySelectorAll('[id]')); } catch (error) { donorNodes = []; }
      for (const el of donorNodes) protect(el);
    }
    protect(document.getElementById('arena'));
    protect(document.getElementById('game-wrapper'));
    protect(document.getElementById('game-canvas'));
    for (const id of LEGACY_BATTLE_IDS) {
      const el = legacyUiElement(id);
      if (!el || protectedHideRefs.has(el) || legacyBattleRefs.includes(el)) continue;
      legacyBattleRefs.push(el);
    }
    return legacyBattleRefs.length;
  }
  function hideLegacyBattleUi() {
    for (const el of legacyBattleRefs) {
      if (!el || isProtectedFromLegacyHide(el)) continue;
      if (el.__apexGoldHidden === undefined) el.__apexGoldHidden = el.style.display;
      el.style.display = 'none';
    }
  }
  function showLegacyBattleUi() {
    for (const el of legacyBattleRefs) {
      if (!el || el.__apexGoldHidden === undefined) continue;
      el.style.display = el.__apexGoldHidden || '';
      delete el.__apexGoldHidden;
    }
    legacyBattleRefs.length = 0;
  }
  // Published so production code that legitimately needs a legacy node (the
  // engine's own HUD opacity handling) can never resolve the Gold donor.
  BRIDGE.legacyUiElement = legacyUiElement;
  BRIDGE.captureLegacyBattleUi = captureLegacyBattleUi;

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
    const sessionToken = ++battleSessionToken;
    const mode = (pick && pick.mode === 'bot') ? 'BOT' : 'LOCAL';
    const p1Shell = String((pick && pick.p1) || 'newbot').toLowerCase();
    // BOT OPPONENT = ONE TRUTH: the production CPU identity, never a second
    // hardcoded presentation identity.
    const p2Shell = mode === 'BOT'
      ? BRIDGE.botOpponentShellKey()
      : String((pick && pick.p2) || 'newbot').toLowerCase();
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
      const loaded = await ensureDeferredRuntimes('arsenalProduct');
      if (!loaded || sessionToken !== battleSessionToken || !hudMounted || !battleLiveRunning) {
        battleLiveRunning = false;
        return;
      }
      // The Gold shell already published the music-off battle surface. From
      // here the bridge starts only the real engine + presentation projection.
      relocateArena();
      hideLegacyBattleUi();
      // Wrap the real HUD observer only after the group is present.
      installEventTranslation();
      // The product match entry validates ownership and starts the real match
      // (startArsenalBattleMode). No synthetic input is involved.
      if (typeof window.startMatch !== 'function') {
        console.warn('[gold-bridge] startMatch unavailable; battle did not start.');
        battleLiveRunning = false;
        window.__apexGoldBattleHosted = false;
        return;
      }
      window.__apexGoldBattleHosted = true;
      window.startMatch();
      // arsenalBattleRuntime creates #aq-dom-hud during its first draw, after
      // the initial legacy capture. Capture again without losing the first set
      // and hide the late overlay before the browser paints the live frame.
      captureLegacyBattleUi(false);
      hideLegacyBattleUi();
      startPump();
    } catch (error) {
      console.warn('[gold-bridge] battle live failed.', error);
      battleLiveRunning = false;
      window.__apexGoldBattleHosted = false;
    }
  };

  // Gold shell owns the destination. The engine runtime only tears the live
  // match down; it must not open the legacy product menu or restart BGM.
  BRIDGE.exitBattle = function exitBattle() {
    const hadBattle = battleLiveRunning || window.__apexGoldBattleHosted === true;
    // Always invalidate a deferred launch, even when startMatch has not been
    // reached yet. This makes ESC-during-load a real cancellation.
    battleSessionToken += 1;
    if (!hadBattle) return false;
    if (pumpId) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(pumpId);
      pumpId = 0;
    }
    try {
      if (typeof window.exitArsenalBattleMode === 'function') {
        window.exitArsenalBattleMode({ goldHosted: true, silentGoldExit: true });
      }
    } catch (error) { /* shell still completes presentation teardown */ }
    battleLiveRunning = false;
    window.__apexGoldBattleHosted = false;
    return true;
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
    // Always the DONOR root inside the Gold host — never a global-id guess.
    const root = document.querySelector('#battleHudHost #hud');
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
            // Visual cue only. Cooldown/charge authority stays with the
            // production combatant and is projected per frame below.
            if (typeof seam.cast === 'function') seam.cast(i, slot);
            if (typeof seam.setSkill === 'function') seam.setSkill(i, slot, { castUntil: true });
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
  // Real production skill state (hero-rework combatants own the truth):
  //   ct.skills[slot].{charges, rechargeLeft, cdLeft, cfg.{maxCharges,cooldown}}
  //   ct.__ctl.cooldownLeft(slot) -> seconds until usable (0 = ready)
  // The Gold cards project THAT truth every frame. A Cast event is a visual
  // cue only and can never become cooldown authority.
  function skillTruthFor(fighter, slot) {
    const ct = fighter && (fighter.__hrCombatant || (fighter.anchor && fighter.anchor.__hrCombatant));
    if (!ct) return null;
    const s = ct.skills && ct.skills[slot];
    if (!s) return null;
    const cfg = s.cfg || {};
    const maxCharges = Number(cfg.maxCharges) > 0 ? Number(cfg.maxCharges) : 1;
    const cooldown = Number.isFinite(Number(cfg.cooldown)) && Number(cfg.cooldown) > 0
      ? Number(cfg.cooldown) : 10;
    let charges = Number.isFinite(Number(s.charges)) ? Number(s.charges) : maxCharges;
    charges = Math.max(0, Math.min(maxCharges, charges));
    let nextIn;
    if (ct.__ctl && typeof ct.__ctl.cooldownLeft === 'function') {
      nextIn = Number(ct.__ctl.cooldownLeft(slot)) || 0;
    } else if (maxCharges > 1) {
      nextIn = charges > 0 ? 0 : (Number(s.rechargeLeft) || 0);
    } else {
      nextIn = Math.max(0, Number(s.cdLeft) || 0);
    }
    if (charges >= maxCharges) nextIn = 0;
    return {
      name: heroSkillName(heroIdOf(fighter) || (ct.heroId || ''), slot),
      cd: cooldown,
      max: maxCharges,
      charges,
      nextIn,
      truth: true,
    };
  }
  function skillProjection(fighter) {
    const heroId = heroIdOf(fighter);
    const out = [];
    for (let k = 0; k < 2; k++) {
      const slot = k === 0 ? 'A1' : 'A2';
      const truth = skillTruthFor(fighter, slot);
      if (truth) {
        out.push(truth);
        continue;
      }
      // No production combatant yet (pre-match / non-rework): report the
      // authored cooldown with an explicit not-truth marker so the HUD never
      // presents invented readiness.
      out.push({
        name: heroId ? heroSkillName(heroId, slot) : slot,
        cd: heroId ? heroSkillCooldown(heroId, slot) : 10,
        max: 1, charges: 1, nextIn: 0, castUntil: false, truth: false,
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
        // Control labels come from the ACCEPTED production key law, so the HUD
        // can never advertise a key the engine does not accept:
        //   P1 J/K; Local P2 Digit1/Digit2; BOT P2 = CPU (no human keys).
        keyLabels: keyLabelsForSide(i),
      });
      if (f) fighterPos.push({ x: f.x, y: f.y, aim: Number.isFinite(f.aim) ? f.aim : 0 });
      else fighterPos.push(null);
    }
    // TIMER TRUTH (2026-10-05): production Arsenal owns ELAPSED time only
    // (AQ.state.time starts at 0 and increases) and has no best-of-three
    // round/win system. Present it as elapsed time; never fabricate a
    // countdown, a round number or win pips.
    const elapsed = state && Number.isFinite(state.time) ? Math.max(0, Number(state.time)) : 0;
    const matchState = {
      timer: elapsed,
      timeSemantics: 'elapsed',
      roundAuthority: false,
      ko: !!(state && state.over),
      sides,
    };
    return { state: matchState, fighters: fighterPos };
  }
  // Accepted production key law per side (see heroReworkRuntime J/K and the
  // Local P2 Digit1/Digit2 seam).
  function keyLabelsForSide(sideIndex) {
    const arsenal = window.APEX_ARSENAL;
    const battleMode = arsenal && arsenal.state ? arsenal.state.battleMode : null;
    if (sideIndex === 0) return ['J', 'K'];
    return battleMode === 'BOT' ? ['CPU', 'CPU'] : ['1', '2'];
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
    // An already queued callback after unmount clears itself instead of
    // recreating a permanent background RAF chain.
    if (!hudMounted) { pumpId = 0; return; }
    pumpId = requestAnimationFrame(pump);
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
