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
  const HERO_UI_ART_REVISION = (() => {
    try {
      const src = document.currentScript && document.currentScript.src;
      if (!src) return '';
      return new URL(src, window.location.href).searchParams.get('v') || '';
    } catch (error) { return ''; }
  })();
  function heroUiAsset(relativePath) {
    const url = HERO_UI_ART_ROOT + String(relativePath || '').replace(/^\/+/, '');
    return HERO_UI_ART_REVISION
      ? url + '?v=' + encodeURIComponent(HERO_UI_ART_REVISION)
      : url;
  }
  const HERO_UI_ART = {
    newbot: {
      portrait: heroUiAsset('newbot/pick_roster_cover.webp'),
      art: heroUiAsset('newbot/pick_selected_large.webp'),
      battleAvatar: heroUiAsset('newbot/battle_avatar.webp'),
      skillIcons: [
        heroUiAsset('newbot/skill_passive.webp'),
        heroUiAsset('newbot/skill_a1.webp'),
        heroUiAsset('newbot/skill_a2.webp'),
      ],
    },
    hunter: {
      portrait: heroUiAsset('hunter/pick_roster_cover.webp'),
      art: heroUiAsset('hunter/pick_selected_large.webp'),
      battleAvatar: heroUiAsset('hunter/battle_avatar.webp'),
      skillIcons: [
        heroUiAsset('hunter/skill_passive.webp'),
        heroUiAsset('hunter/skill_a1.webp'),
        heroUiAsset('hunter/skill_a2.webp'),
      ],
    },
    crystala: {
      portrait: heroUiAsset('crystala/pick_roster_cover.webp'),
      art: heroUiAsset('crystala/pick_selected_large.webp'),
      battleAvatar: heroUiAsset('crystala/battle_avatar.webp'),
      skillIcons: [
        heroUiAsset('crystala/skill_passive.webp'),
        heroUiAsset('crystala/skill_a1.webp'),
        heroUiAsset('crystala/skill_a2.webp'),
      ],
    },
    magnet: {
      portrait: heroUiAsset('magnet/pick_roster_cover.webp'),
      art: heroUiAsset('magnet/pick_selected_large.webp'),
      battleAvatar: heroUiAsset('magnet/battle_avatar.webp'),
      skillIcons: [
        heroUiAsset('magnet/skill_passive.webp'),
        heroUiAsset('magnet/skill_a1.webp'),
        heroUiAsset('magnet/skill_a2.webp'),
      ],
    },
    frost: {
      portrait: heroUiAsset('frost/pick_roster_cover.webp'),
      art: heroUiAsset('frost/pick_selected_large.webp'),
      battleAvatar: heroUiAsset('frost/battle_avatar.webp'),
      skillIcons: [
        heroUiAsset('frost/skill_passive.webp'),
        heroUiAsset('frost/skill_a1.webp'),
        heroUiAsset('frost/skill_a2.webp'),
      ],
    },
    // Mirror: no PICK_SELECTED_LARGE by owner decision.
    mirror: {
      portrait: heroUiAsset('mirror/pick_roster_cover.webp'),
      battleAvatar: heroUiAsset('mirror/battle_avatar.webp'),
      skillIcons: [
        heroUiAsset('mirror/skill_passive.webp'),
        heroUiAsset('mirror/skill_a1.webp'),
        heroUiAsset('mirror/skill_a2.webp'),
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
  // ONE accent per hero. These are FALLBACKS for the case where the shell
  // registry is not loaded yet; the live value is APEX_ARSENAL_SHELLS.typeFor()
  // -> the fighter type's own authored colour. CRYSTALA is violet because her
  // whole authored palette is violet (AMETHYST ramp, crystalaGoldV6.js); the
  // former #55bfff / engine #6ed3d8 were another hero's colour language and
  // showed up as soon as a crit/heavy slash or a rail plate took her accent.
  const FALLBACK_ACCENTS = {
    newbot: '#ff941f', hunter: '#96ca2d', crystala: '#a066f0',
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
        // Lucky Draw consumes the same production presentation registry. Most
        // fighters use the transparent stand-pick art; fighters with an
        // intentional special Pick treatment (currently Mirror) fall back to
        // their real roster art rather than a fabricated placeholder.
        drawArt: (art && art.art) || (art && art.portrait) || (art && art.battleAvatar) || '',
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
    // The player's BOT choice (owner law 2026-10-06) is written through the ONE
    // production authority, never stored a second time in presentation: resolve
    // the shell key to its production id and let production validate it. A
    // rejected id leaves the accepted default untouched and returns false, so
    // the pick screen can never advertise a fighter the CPU will not use.
    BRIDGE0.setBotOpponent = function setBotOpponent(shellKey) {
      const key = String(shellKey || '').toLowerCase();
      const production = PRODUCTION_ID_BY_SHELL_KEY[key];
      if (!production) return false;
      const shells = window.APEX_ARSENAL_SHELLS;
      if (!shells || typeof shells.setBotOpponentId !== 'function') return false;
      const applied = shells.setBotOpponentId(production) === true;
      if (applied) {
        // Keep the pick-screen presentation in step with production truth in the
        // same tick (the transition identity and the HUD read the bridge, not a
        // stale copy). This is a notification, never a second store.
        try { document.dispatchEvent(new CustomEvent('apex:bot-opponent', { detail: { shellKey: key, productionId: production } })); } catch (_) {}
      }
      return applied;
    };
    // Production-visible roster authority (one explicit mapping covering EVERY
    // production-visible entry; no hard cap, nothing silently omitted).
    BRIDGE0.roster = function goldRoster() {
      const prod = rosterFromProduction();
      return Object.keys(prod).map((key) => Object.assign({ id: key }, prod[key]));
    };
    // Lucky Draw presentation registry. This is deliberately derived from the
    // same production-visible roster as Fighter Pick, while ownership remains
    // exclusively in APEX_ARSENAL_META.poolLocked()/spin(). Adding a future
    // playable fighter therefore requires no Lucky-specific switch/case.
    BRIDGE0.luckyRoster = function goldLuckyRoster() {
      return BRIDGE0.roster()
        .filter((hero) => hero && hero.playable !== false)
        .map((hero) => ({
          shellKey: hero.id,
          productionId: hero.productionId,
          name: hero.name,
          tag: hero.tag,
          accent: hero.accent || hero.color || '#8d8375',
          drawArt: hero.drawArt || hero.art || hero.portrait || hero.battleAvatar || '',
        }));
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
    // ACTIVE-state notification only. Fetch/decode/evaluation belongs to the
    // awaited prepareSurface() contract so the Mechanical Door can hold until
    // the exact destination requirement set is READY.
    theme.setSurface(surfaceId);
  };
  BRIDGE.prepareSurface = async function prepareSurface(surfaceId, context = {}) {
    const surface = String(surfaceId || '').toLowerCase();
    const assets = window.apexProductAssets;
    const heroIds = Array.isArray(context.heroIds) ? context.heroIds.filter(Boolean) : [];
    const tasks = [];

    if (surface === 'battle' || surface === 'transition') {
      tasks.push(
        ensureSelectedBattleRuntimes(heroIds).then(async (ok) => {
          if (ok !== true) throw new Error('selected battle runtime set did not reach READY');
          // R58: transition HOLD includes audio readiness. The destination is
          // not "ready" while first-use SFX can still be downloading/decoding.
          await warmMatchHeroAudio(...heroIds);
          return true;
        })
      );
    }

    // E2: only the three cues that can be the FIRST Home interaction are part
    // of Home readiness. This uses uiSfxAuthority.warm(), which prepares the
    // exact cached elements play() later reuses; it does not preload all 18
    // cues and never manufactures audible playback.
    if (surface === 'home' && window.apexUiSfx?.warm) {
      tasks.push(window.apexUiSfx.warm([
        'ui.button.press',
        'ui.focus.move',
        'ui.screen.transition',
      ]));
    }

    if (assets && typeof assets.prepare === 'function') {
      if (surface === 'home') {
        tasks.push(assets.prepare('home', { scope: 'surface:home', intent: 'required' }));
      } else if (surface === 'mode') {
        tasks.push(assets.prepare('mode', { scope: 'surface:mode', intent: 'required' }));
      } else if (surface === 'fighter') {
        tasks.push(assets.prepare('fighter', { scope: 'surface:fighter', heroIds, intent: 'required' }));
      } else if (surface === 'battle' || surface === 'transition') {
        tasks.push(assets.prepare('battle', { scope: 'surface:battle', heroIds, intent: 'required' }));
      } else if (surface === 'lucky') {
        // Fetch the donor document on intent; the iframe owns DOM/evaluation.
        tasks.push(assets.prepare('lucky', { scope: 'surface:lucky', decode: false, intent: 'required' }));
      }
    }
    await Promise.all(tasks);
    return true;
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
  function arenaCanvas() {
    return document.getElementById('game-canvas');
  }
  function hideLegacyProductScreens() {
    // Public menu/picker DOM no longer exists. Only suppress the engine HUD
    // writer surface while the Gold battle compositor is live.
    const legacyHud = legacyUiElement('hud');
    if (legacyHud) legacyHud.style.opacity = 0;
  }
  function relocateArena() {
    const canvas = arenaCanvas();
    const arena = arenaElement();
    if (!canvas || !arena) return false;
    if (canvas.parentElement === arena) return true;
    arenaOriginParent = canvas.parentElement;
    arenaOriginNext = canvas.nextElementSibling;
    arena.appendChild(canvas);
    // Move ONLY the 1000×1000 gameplay canvas. #game-wrapper is engine/combat
    // infrastructure; public product surfaces belong exclusively to Gold.
    canvas.style.position = 'absolute';
    canvas.style.inset = 'auto';
    canvas.style.left = '50%';
    canvas.style.top = '50%';
    canvas.style.transform = 'translate(-50%,-50%)';
    canvas.style.aspectRatio = '1 / 1';
    canvas.style.height = '100%';
    canvas.style.width = 'auto';
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    canvas.style.display = 'block';
    return true;
  }
  function restoreArena() {
    const canvas = arenaCanvas();
    if (!canvas || !arenaOriginParent) return;
    canvas.style.cssText = '';
    if (arenaOriginNext && arenaOriginNext.parentElement === arenaOriginParent) {
      arenaOriginParent.insertBefore(canvas, arenaOriginNext);
    } else {
      arenaOriginParent.appendChild(canvas);
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
  // E4 selected-runtime seam. Current App publishes this as soon as the menu
  // runtime is ready. Standalone/older hosts fail open to the canonical full
  // arsenalProduct graph; optimization must never become a boot dependency.
  function ensureSelectedBattleRuntimes(heroIds) {
    const loader = window.__apexEnsureBattleRuntimes;
    if (typeof loader !== 'function') return ensureDeferredRuntimes('arsenalProduct');
    try {
      return Promise.resolve(loader(heroIds)).then(() => true, () => false);
    } catch (error) {
      return Promise.resolve(false);
    }
  }

  // ONE match-audio readiness seam. R58 deliberately waits for the existing
  // owners instead of inventing another player: Arsenal/Hunter uses decoded
  // AudioBuffers, Core-Six uses its cached HTMLAudioElements, Robot uses its
  // accepted decoded buffer bank. The transition may hold; the first gameplay
  // trigger may not become the downloader.
  async function warmMatchHeroAudio(...keys) {
    const ids = [];
    for (const raw of keys) {
      const key = String(raw || '').toLowerCase();
      if (!key) continue;
      ids.push(key);
      const production = PRODUCTION_ID_BY_SHELL_KEY[key];
      if (production) ids.push(production);
    }
    const tasks = [];
    try {
      if (window.APEX_ARSENAL_AV?.warmAudio) {
        tasks.push(Promise.resolve(window.APEX_ARSENAL_AV.warmAudio()));
      }
    } catch (_) {}
    try {
      if (window.apexHeroSfx?.warm) {
        tasks.push(Promise.resolve(window.apexHeroSfx.warm(ids)));
      }
    } catch (_) {}
    try {
      if (ids.some((id) => id === 'robot' || id === 'newbot')) {
        tasks.push(Promise.resolve(window.APEX_ROBOT_PRESENTATION?.loadRobotAudio?.()));
      }
    } catch (_) {}
    await Promise.all(tasks);
    return true;
  }

  BRIDGE.onBattleLive = async function onBattleLive(pick) {
    if (battleLiveRunning) return false;
    const sessionToken = ++battleSessionToken;
    const questFirstWake = pick && pick.mode === 'quest-first-wake';
    const questReflexPreview=pick && pick.mode==='quest-reflex-preview';
    const questPreview=questFirstWake||questReflexPreview;
    const mode = questPreview || (pick && pick.mode === 'bot') ? 'BOT' : 'LOCAL';
    const p1Shell = String((pick && pick.p1) || 'newbot').toLowerCase();
    // BOT OPPONENT = ONE TRUTH: the production CPU identity, never a second
    // hardcoded presentation identity.
    const p2Shell = questPreview ? 'newbot'
      : mode === 'BOT' ? BRIDGE.botOpponentShellKey()
      : String((pick && pick.p2) || 'newbot').toLowerCase();
    const p1 = PRODUCTION_ID_BY_SHELL_KEY[p1Shell] || 'ROBOT';
    const p2 = PRODUCTION_ID_BY_SHELL_KEY[p2Shell] || 'ROBOT';
    if (window.APEX_GOLD_LOCKED && (window.APEX_GOLD_LOCKED(p1Shell) || window.APEX_GOLD_LOCKED(p2Shell))) return false;
    battleLiveRunning = true;
    try {
      // Suppress only engine battle chrome before deferred runtime work. The
      // retired menu/picker DOM has been removed from production entirely.
      hideLegacyProductScreens();

      // Runtime FIRST, handoff state SECOND. This order is mandatory: on a cold
      // load arsenalShellSelectRuntime creates APEX_ARSENAL_SHELLS and its
      // pending-selection state. Writing those fields before the script exists
      // makes the flow timing-dependent and lets slow loads erase the handoff.
      const loaded = await ensureSelectedBattleRuntimes([p1Shell, p2Shell]);
      if (!loaded || sessionToken !== battleSessionToken || !hudMounted || !battleLiveRunning) {
        battleLiveRunning = false;
        return false;
      }
      const shells = window.APEX_ARSENAL_SHELLS;
      if (!shells || typeof shells.typeFor !== 'function') {
        battleLiveRunning = false;
        return false;
      }
      const p1Type = shells.typeFor(p1);
      const p2Type = shells.typeFor(p2);
      if (!p1Type || !p2Type) {
        battleLiveRunning = false;
        return false;
      }
      window.__apexArsenalSelectionMode = mode.toLowerCase();
      window.__apexArsenalBotBattle = mode === 'BOT';
      window.__apexArsenalFreeBattle = mode !== 'BOT';
      window.p1Selection = p1Type;
      window.p2Selection = p2Type;
      window.__apexArsenalSelectPending = !questPreview;

      // The Gold shell already published the music-off battle surface. From
      // here the bridge starts only the real engine + presentation projection.
      hideLegacyProductScreens();
      captureLegacyBattleUi(false);
      hideLegacyBattleUi();
      if (!relocateArena()) {
        console.warn('[gold-bridge] gameplay canvas unavailable; battle did not start.');
        battleLiveRunning = false;
        return false;
      }
      // Wrap the real HUD observer only after the group is present.
      installEventTranslation();

      // Direct-entry safety: prepareSurface normally warmed audio behind the
      // transition seam, but onBattleLive is also an API boundary. Await the
      // same idempotent readiness contract before the engine can accept input.
      await warmMatchHeroAudio(p1Shell, p2Shell);
      if (sessionToken !== battleSessionToken || !hudMounted || !battleLiveRunning) {
        battleLiveRunning = false;
        restoreArena();
        return false;
      }

      // Gold-hosted status is set BEFORE startMatch so every fallback branch
      // knows it must never resurrect the legacy selection surface.
      window.__apexGoldBattleHosted = true;
      if (!questPreview && typeof window.startMatch !== 'function') {
        console.warn('[gold-bridge] startMatch unavailable; battle did not start.');
        battleLiveRunning = false;
        window.__apexGoldBattleHosted = false;
        return false;
      }
      // CP04 playtest alone uses the opt-in Quest entry. Both modes still
      // resolve through the ONE real Arsenal startArsenalBattleMode and the
      // same Gold READY contract; no second battle engine or fake art scene.
      const started = questPreview ? (() => {
        window.__APEX_QUEST_DEV = true;
        try { return (questReflexPreview
          ? window.__apexQuestReflexStart?.()
          : window.__apexQuestFirstWakeStart?.()) === true; }
        finally { delete window.__APEX_QUEST_DEV; }
      })() : await Promise.resolve(window.startMatch());
      if (started !== true || sessionToken !== battleSessionToken || !hudMounted || !battleLiveRunning) {
        console.warn('[gold-bridge] production match start did not reach READY.');
        battleLiveRunning = false;
        window.__apexGoldBattleHosted = false;
        restoreArena();
        return false;
      }

      // arsenalBattleRuntime may create its DOM HUD during match start. Capture
      // and suppress it after the engine is real, then push one truthful frame
      // synchronously so Gold is never revealed with donor defaults (0 HP,
      // A1/A2 labels, fake 10s cooldowns, placeholder weapon glyphs).
      hideLegacyProductScreens();
      captureLegacyBattleUi(false);
      hideLegacyBattleUi();
      const seam = window.APEX_GOLD_HUD;
      if (!seam) {
        battleLiveRunning = false;
        window.__apexGoldBattleHosted = false;
        restoreArena();
        return false;
      }
      const first = projection();
      if (typeof seam.applyState === 'function') seam.applyState(first.state);
      if (typeof seam.syncFighters === 'function') seam.syncFighters(first.fighters);
      // Audio was already awaited before startMatch; projection can begin with
      // no first-trigger network/decode debt.
      startPump();
      return true;
    } catch (error) {
      console.warn('[gold-bridge] battle live failed.', error);
      battleLiveRunning = false;
      window.__apexGoldBattleHosted = false;
      restoreArena();
      return false;
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
  BRIDGE.pressSkill = function pressSkill(pi, ai, sourceMeta) {
    const heroRework = window.APEX_HERO_REWORK;
    const fighters = window.fighters;
    if (!heroRework || typeof heroRework.pressAbility !== 'function') return;
    if (!Array.isArray(fighters) || !fighters[pi]) return;
    const side = pi === 1 ? 'p2' : 'p1';
    const meta = Object.assign({ side, source: 'pointer' }, sourceMeta || {});
    meta.side = side; // caller may describe the pointer, never reassign ownership
    try { heroRework.pressAbility(fighters[pi], ai === 1 ? 'A2' : 'A1', meta); } catch (e) {}
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
  // Q3: Quest teams have independent physical victims, not one HP pool.
  const questHeavyByVictim = new Map();
  let translationInstalled = false;

  function sideOfBody(body) {
    if (window.APEX_ARSENAL?.state?.questMultiActor) {
      return body?.questTeam === 'ALLY' ? 0 : body?.questTeam === 'HOSTILE' ? 1 : -1;
    }
    const id = body && body.id;
    return (id === 1 || id === 2) ? id - 1 : -1;
  }
  function questTeamHp(team) {
    const actors = Array.isArray(window.fighters) ? window.fighters : [];
    return actors.filter(f => f?.questTeam === team).reduce((sum, f) => sum + Math.max(0, Number(f.hp) || 0), 0);
  }
  function heavyTierFor(victimIdx, amount, now, victim) {
    // Quest Heavy is per real VICTIM; summing different robots into one
    // side-based burst would falsely classify ordinary hits as Heavy.
    if (window.APEX_ARSENAL?.state?.questMultiActor && victim?.questId) {
      const key = String(victim.questId);
      let h = questHeavyByVictim.get(key);
      if (!h) { h = { window: [], latch: 0 }; questHeavyByVictim.set(key, h); }
      h.window.push({ t: now, amount });
      while (h.window.length && now - h.window[0].t > HEAVY_WINDOW_MS) h.window.shift();
      if (h.window.reduce((sum, e) => sum + e.amount, 0) <= HEAVY_THRESHOLD) return false;
      if (h.latch && now - h.latch <= HEAVY_WINDOW_MS) return false;
      h.latch = now;
      return true;
    }
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
    const victimHp = window.APEX_ARSENAL?.state?.questMultiActor
      ? questTeamHp(ev.victim.questTeam)
      : ((ev.victim && typeof ev.victim.hp === 'number') ? ev.victim.hp : null);
    // Capture the source accent on THIS transaction. Never mutate one shared
    // CSS variable: simultaneous Local hits must keep their own source color.
    const impactAccent = accentOf(ev.attacker);
    const storm = stormbreakerHit(ev);
    const heavy = heavyTierFor(v, amount, now, ev.victim);
    if (storm) {
      if (seam.hitStorm) seam.hitStorm(a, v, amount, victimHp, impactAccent);
      else seam.hit(a, v, amount, 'heavy', victimHp, impactAccent);
      return;
    }
    if (heavy) {
      if (seam.hit) seam.hit(a, v, amount, 'heavy', victimHp, impactAccent);
      return;
    }
    if (ev.critical) {
      if (seam.hit) seam.hit(a, v, amount, 'crit', victimHp, impactAccent);
      return;
    }
    if (seam.hit) seam.hit(a, v, amount, 'normal', victimHp, impactAccent);
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
        let targetIndex = payload.side === 'p2' || payload.combatantId === 'p2' ? 1
          : (payload.side === 'p1' || payload.combatantId === 'p1' ? 0 : -1);
        // Backward compatibility for old recorded events only. New runtime
        // events always carry side/combatantId, so same-hero Local cannot
        // collapse onto the first matching fighter.
        if (targetIndex < 0) {
          for (let i = 0; i < 2; i++) {
            const f = fighters[i];
            if (f && heroIdOf(f) === hero) { targetIndex = i; break; }
          }
        }
        if (targetIndex < 0 || !fighters[targetIndex]) return;
        try {
          // Visual cue only. Cooldown/charge authority stays with the
          // production combatant and is projected per frame below.
          const meta = heroSkillMeta(heroIdOf(fighters[targetIndex]) || hero, payload.slot === 'A2' ? 'A2' : 'A1');
          if (typeof seam.cast === 'function') seam.cast(targetIndex, slot);
          if (typeof seam.setSkill === 'function') seam.setSkill(targetIndex, slot, {
            castUntil: true,
            activeFor: meta.kind === 'duration' ? meta.duration : 0,
            kind: meta.kind,
          });
        } catch (e) {}
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
    questHeavyByVictim.clear();
  }

  // ── per-frame production projection → canonical HUD state ───────────────
  function heroRegistry() {
    return window.APEX_HERO_REWORK_REGISTRY || null;
  }
  const GOLD_SKILL_COPY = {
    ROBOT: { A1: 'WEAPON DASH', A2: 'VIRTUAL ARMOR' },
    HUNTER: { A1: 'TRAP DEPLOY', A2: 'DASH / STRIKE' },
    CRYSTAL: { A1: 'CONTEXT CONSTRUCT', A2: 'AWAKENING' },
    MAGNET: { A1: 'MAGNETIC ATTRACTION', A2: 'MAGNETIC REPEL' },
    ICE: { A1: 'FROST BREATH', A2: 'FROST RUSH' },
    MIRROR: { A1: 'MIRROR ARSENAL', A2: 'MIRROR EXCHANGE' },
  };
  function canonicalHeroId(heroId) {
    const id = String(heroId || '').toUpperCase();
    return id === 'FROST' ? 'ICE' : id;
  }
  function skillSemantic(kind, maxCharges, cooldown, duration) {
    const cd = Number(cooldown) || 0;
    const dur = Number(duration) || 0;
    if (kind === 'charges') return String(maxCharges) + ' CHARGES · ' + cd.toFixed(1) + 'S RECHARGE';
    if (kind === 'duration') return dur.toFixed(1) + 'S ACTIVE · ' + cd.toFixed(1) + 'S CD';
    return cd.toFixed(1) + 'S COOLDOWN';
  }
  function heroSkillMeta(heroId, slot) {
    const id = canonicalHeroId(heroId);
    const reg = heroRegistry();
    let def = null, cfg = null;
    try {
      const hero = reg && reg.HEROES ? reg.HEROES[id] : null;
      def = hero && hero.skills ? hero.skills[slot] : null;
      cfg = reg && typeof reg.resolveSkillLevel === 'function'
        ? reg.resolveSkillLevel(id, slot, 1)
        : (def && def.baseConfig ? def.baseConfig : null);
    } catch (e) { cfg = def && def.baseConfig ? def.baseConfig : null; }
    cfg = cfg || {};
    const cooldown = Number.isFinite(Number(cfg.cooldown)) ? Number(cfg.cooldown) : 10;
    const maxCharges = Number(cfg.maxCharges) > 0 ? Number(cfg.maxCharges) : 1;
    const durationKeys = ['activeWindow', 'gameplayDuration', 'active', 'duration'];
    let duration = 0;
    for (const key of durationKeys) {
      const value = Number(cfg[key]);
      if (Number.isFinite(value) && value > 0) { duration = value; break; }
    }
    const kind = maxCharges > 1 ? 'charges' : (duration > 0 ? 'duration' : 'cooldown');
    const shellKey = GOLD_SHELL_KEY_BY_PRODUCTION_ID[id] || id.toLowerCase();
    const art = heroUiArt(shellKey);
    const iconIndex = slot === 'A2' ? 2 : 1;
    const icon = art && Array.isArray(art.skillIcons) ? (art.skillIcons[iconIndex] || '') : '';
    const fallbackName = def && def.id
      ? String(def.id).split('.').pop().replace(/_/g, ' ').toUpperCase()
      : slot;
    const name = (GOLD_SKILL_COPY[id] && GOLD_SKILL_COPY[id][slot]) || fallbackName;
    return {
      name,
      cooldown,
      maxCharges,
      duration,
      kind,
      icon,
      desc: skillSemantic(kind, maxCharges, cooldown, duration),
    };
  }
  function heroSkillCooldown(heroId, slot) {
    return heroSkillMeta(heroId, slot).cooldown;
  }
  function heroSkillName(heroId, slot) {
    return heroSkillMeta(heroId, slot).name;
  }
  // Shared display-name authority for Fighter Pick preview + Battle handoff.
  // Passive copy stays authored by the shell, while A1/A2 always come from the
  // same production mapping used by the live HUD projection.
  BRIDGE.skillDisplay = function skillDisplay(shellKey, fallback) {
    const key = String(shellKey || '').toLowerCase();
    const productionId = PRODUCTION_ID_BY_SHELL_KEY[key] || canonicalHeroId(key);
    const base = Array.isArray(fallback) ? fallback : ['PASSIVE', 'A1', 'A2'];
    const copy = GOLD_SKILL_COPY[productionId] || {};
    return [
      base[0] || 'PASSIVE',
      copy.A1 || base[1] || 'A1',
      copy.A2 || base[2] || 'A2',
    ];
  };
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
    if (maxCharges > 1) {
      // Charge skills may be READY with one charge while another charge is
      // already recharging. cooldownLeft() intentionally reports 0 in that
      // playable state, so rechargeLeft is the truthful HUD source.
      nextIn = charges < maxCharges ? Math.max(0, Number(s.rechargeLeft) || 0) : 0;
    } else if (ct.__ctl && typeof ct.__ctl.cooldownLeft === 'function') {
      nextIn = Math.max(0, Number(ct.__ctl.cooldownLeft(slot)) || 0);
    } else {
      nextIn = Math.max(0, Number(s.cdLeft) || 0);
    }
    const meta = heroSkillMeta(heroIdOf(fighter) || (ct.heroId || ''), slot);
    const kind = maxCharges > 1 ? 'charges' : meta.kind;
    return {
      name: meta.name,
      cd: cooldown,
      max: maxCharges,
      charges,
      nextIn,
      truth: true,
      kind,
      duration: meta.duration,
      icon: meta.icon,
      desc: skillSemantic(kind, maxCharges, cooldown, meta.duration),
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
      const meta = heroId ? heroSkillMeta(heroId, slot) : { name: slot, cooldown: 10, maxCharges: 1, duration: 0, kind: 'cooldown', icon: '', desc: '10.0S COOLDOWN' };
      out.push({
        name: meta.name,
        cd: meta.cooldown,
        max: meta.maxCharges,
        charges: meta.maxCharges,
        nextIn: 0,
        castUntil: false,
        truth: false,
        kind: meta.kind,
        duration: meta.duration,
        icon: meta.icon,
        desc: meta.desc,
      });
    }
    return out;
  }
  function weaponProjection(fighter) {
    const holder = fighter && fighter.data && fighter.data.arsenal;
    if (!holder || !holder.def) return null;
    const def = holder.def;
    const weaponId = String(holder.weaponId || '').toUpperCase();
    // OWNER LAW (R52, ammo x/y like Gold): the magazine/ammo authority is the
    // ONE weapon config table (`APEX_ARSENAL_CONFIG.WEAPONS`), never the
    // behaviour def — the behaviour def carries routing (activate/update/
    // spriteKey), not numbers, so reading `def.shots` reported every firearm as
    // UNARMED and the HUD could never count ammo.
    const cfg = window.APEX_ARSENAL_CONFIG;
    const spec = (cfg && cfg.WEAPONS && cfg.WEAPONS[weaponId]) || null;
    const shots = Number(def.shots) || Number(spec && spec.shots) || 0;
    const fired = Number(holder.shotsFired) || 0;
    const name = def.art || (spec && spec.art) || weaponId.replace(/_/g, ' ') || 'UNARMED';
    const family = def.family || (spec && spec.family) || (def.category === 'ranged' ? 'RANGED' : 'MELEE');
    let asset = '';
    try {
      const av = window.APEX_ARSENAL_AV;
      const meta = av && typeof av.weaponMeta === 'function' ? av.weaponMeta(weaponId) : null;
      if (meta && meta.file) asset = '/assets/arsenal/' + String(meta.file).replace(/^\/+/, '');
    } catch (e) {}
    const usesAmmo = shots > 0;
    let tier = holder && holder.meta && holder.meta.tier ? String(holder.meta.tier) : '';
    if (!tier && cfg && typeof cfg.tierOf === 'function') {
      try { tier = String(cfg.tierOf(weaponId) || ''); } catch (e) {}
    }
    const tierColor = tier && cfg && cfg.TIER_COLORS ? String(cfg.TIER_COLORS[tier] || '') : '';
    return {
      id: weaponId,
      name: String(name).toUpperCase(),
      type: String(family).toUpperCase(),
      asset,
      tier,
      tierColor,
      index: 0,
      mag: usesAmmo ? shots : 0,
      ammo: usesAmmo ? Math.max(0, shots - fired) : 0,
      usesAmmo,
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
    const questRoster = state?.questMultiActor && Array.isArray(fighters)
      ? [fighters.filter(f => f?.questTeam === 'ALLY'), fighters.filter(f => f?.questTeam === 'HOSTILE')] : null;
    const sides = [];
    const fighterPos = [];
    for (let i = 0; i < 2; i++) {
      const group = questRoster ? questRoster[i] : null;
      const f = questRoster ? (group[0] || null) : (Array.isArray(fighters) ? fighters[i] : null);
      // 1v1 combat projection names the first two bodies. Quest is two TEAMS.
      const projSide = questRoster ? null : (base && Array.isArray(base.sides) ? base.sides[i] : null);
      const identity = (projSide && projSide.identity) || {};
      const vitals = (projSide && projSide.vitals) || {};
      const liveHeroId = canonicalHeroId(identity.heroId || heroIdOf(f) || '');
      const shellKey = GOLD_SHELL_KEY_BY_PRODUCTION_ID[liveHeroId] || liveHeroId.toLowerCase();
      const art = heroUiArt(shellKey) || {};
      const copy = GOLD_HERO_COPY[shellKey] || {};
      const skills = skillProjection(f);
      // E01 J unlock after R2, K unlock only on successful J Cast.
      if(state?.questReflex===true&&i===0){
        const phase=state.questReflexGate?.snapshot()?.phase;
        skills[0].locked=!['J_CAST','K_CAST','BOTH_HALF','AWAIT_RIVET'].includes(phase);
        skills[1].locked=!['K_CAST','BOTH_HALF','AWAIT_RIVET'].includes(phase);
      }
      const weapon = weaponProjection(f) || { id: 'UNARMED', name: 'UNARMED', type: 'UNARMED', asset: '', tier: '', tierColor: '', index: 0, mag: 0, ammo: 0, usesAmmo: false, reloading: false, alt: '' };
      const vitalsFallback = vitalsProjection(f) || { hp: 0, maxHp: 1000 };
      const teamVitals = group ? {
        hp: group.reduce((sum, actor) => sum + Math.max(0, Number(actor.hp) || 0), 0),
        maxHp: group.reduce((sum, actor) => sum + Math.max(0, Number(actor.maxHp) || 0), 0)
      } : null;
      const teamName = group ? (i===0?'NEWBOT':(state?.questReflex?'T.O.T':'SCRAP')) : null;
      sides.push({
        hp: teamVitals ? teamVitals.hp : ((vitals && Number.isFinite(vitals.hp)) ? vitals.hp : vitalsFallback.hp),
        maxHp: teamVitals ? teamVitals.maxHp : ((vitals && Number.isFinite(vitals.maxHp)) ? vitals.maxHp : vitalsFallback.maxHp),
        rage: (vitals && Number.isFinite(vitals.rage)) ? vitals.rage : 0,
        accent: identity.color || (f && f.color) || '#ffffff',
        name: teamName || identity.name || (f && f.name) || '',
        identity: {
          heroId: liveHeroId,
          name: teamName || identity.name || (f && f.name) || '',
          tag: copy.tag || '',
          battleAvatar: art.battleAvatar || art.portrait || '',
          accent: identity.color || (f && f.color) || '#ffffff',
        },
        skills,
        weapon,
        // Control labels come from the ACCEPTED production key law, so the HUD
        // can never advertise a key the engine does not accept:
        //   P1 J/K; Local P2 = the right-hand numpad pair (Numpad1/Numpad2 —
        //   the top-row Digit1/Digit2 pair is inert by owner law); BOT P2 = CPU
        //   (no human keys).
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
      ko: !!(state && state.over && !state.questFirstWake),
      sides,
      // Metadata only: the live Gold HUD still has TWO original rails.
      // Q3 segmentation will use these independent real actor HP entries.
      questTeams: questRoster ? questRoster.map(group => group.map(f => ({
        id: f.questId, hp: Math.max(0, Number(f.hp)||0), maxHp: Math.max(0, Number(f.maxHp)||0)
      }))) : null,
    };
    return { state: matchState, fighters: fighterPos };
  }
  // Accepted production key law per side (see heroReworkRuntime J/K and the
  // Local P2 right-hand numpad seam: Numpad1 -> A1, Numpad2 -> A2).
  //
  // OWNER CORRECTION (2026-10-07): the tile badge used to read "1"/"2" while
  // the accepted physical pair is the RIGHT-HAND NUMPAD. A bare "1" reads as
  // the number row, so the badge now names the pair it means ("NUM1"/"NUM2")
  // and matches the desk control line ("LOCAL · NUM 1 2"). This is a copy
  // truth fix, not a second input law: the accepted codes are unchanged.
  function keyLabelsForSide(sideIndex) {
    const arsenal = window.APEX_ARSENAL;
    const battleMode = arsenal && arsenal.state ? arsenal.state.battleMode : null;
    if (sideIndex === 0) return ['J', 'K'];
    return battleMode === 'BOT' ? ['CPU', 'CPU'] : ['NUM1', 'NUM2'];
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
    // Quest result is owned by the Quest Director, not Gold's 1v1 win
    // counter or 2600 ms auto-return. The two systems must not race.
    const over = state && !state.questFirstWake && state.over ? String(state.over) : null;
    if (over && over !== lastKo) {
      lastKo = over;
      // ONE result signal for the shell: the match is over, so the backdrop tap
      // may leave immediately instead of waiting out the K.O. hold. It is set
      // here (the seam that already owns `state.over`) and cleared by the next
      // match start / teardown — never by a second observer.
      try { document.body.classList.add('battle-result'); } catch (error) {}
      // Production truth: winnerSide is combatant identity and survives
      // same-hero Local matches. state.over is legacy display copy only.
      const fighters = window.fighters;
      let winnerIdx = state && state.winnerSide === 'P1' ? 0
        : (state && state.winnerSide === 'P2' ? 1 : -1);
      // Compatibility for old recorded states that predate winnerSide: resolve
      // by name ONLY when exactly one side matches. Same-name ambiguity stays
      // unknown instead of silently crediting P1.
      if (winnerIdx < 0 && Array.isArray(fighters)) {
        const matches = [];
        for (let i = 0; i < fighters.length; i++) {
          if (fighters[i] && String(fighters[i].name) === over) matches.push(i);
        }
        if (matches.length === 1) winnerIdx = matches[0];
      }
      const loserIdx = winnerIdx === 0 ? 1 : winnerIdx === 1 ? 0 : -1;
      if (winnerIdx >= 0 && typeof seam.ko === 'function') seam.ko(winnerIdx, loserIdx);
      else if (typeof seam.ko === 'function') seam.ko(-1, -1);
      // Draw/time-out still returns: the stamp reads TIME and the shell goes
      // back to fighter select either way.
      scheduleResultReturn();
    }
    if (!over) {
      lastKo = null;
      if (document.body.classList.contains('battle-result')) document.body.classList.remove('battle-result');
    }
  }
  function startPump() {
    lastKo = null;
    if (document.body.classList.contains('battle-result')) document.body.classList.remove('battle-result');
    cancelResultReturn();
    if (!pumpId) pumpId = requestAnimationFrame(pump);
  }

  // ── production event surface for tooling/evidence (read-only) ────────────
  window.APEX_GOLD_PROJECTION = projection;

  window.apexGoldProductBridge = 'ready';
})();
