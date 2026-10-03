// APEX CHAOS — pre-pilot product surface authority.
//
// This file is deliberately small and data-only. It is the one queryable
// authority for what the shipped product exposes, what is structurally locked,
// what remains developer-only, and what has been detached into compatibility
// history. Rendering and gameplay launchers consume this table; they do not
// infer availability from old runtime filenames or menu placement.
(function apexProductSurfaceRuntime(globalScope) {
  'use strict';

  if (globalScope.APEX_PRODUCT_SURFACES) return;

  const AVAILABILITY = Object.freeze({
    ACTIVE: 'ACTIVE',
    LOCKED: 'LOCKED',
    ADMIN: 'ADMIN',
    LEGACY: 'LEGACY',
    DETACHED: 'DETACHED',
  });

  const SURFACES = Object.freeze([
    Object.freeze({ id: 'quest-01', title: 'Quest 01 — The Ones Thrown Away', summary: 'Quest content is not available in this pre-pilot cut.', availability: AVAILABILITY.LOCKED, public: true }),
    Object.freeze({ id: 'bot-battle', title: 'Bot Battle', summary: 'Fight the accepted Arsenal P1-versus-CPU seam.', availability: AVAILABILITY.ACTIVE, public: true, route: 'bot' }),
    Object.freeze({ id: 'local-1v1', title: 'Local 1v1', summary: 'Choose two active owned fighters for accepted Arsenal Free Battle.', availability: AVAILABILITY.ACTIVE, public: true, route: 'local' }),
    Object.freeze({ id: 'fighter-shop', title: 'Fighter Shop', summary: 'Unlock active fighters for 1000 AC.', availability: AVAILABILITY.ACTIVE, public: true, route: 'shop' }),
    Object.freeze({ id: 'lucky-draw', title: 'Lucky Draw', summary: 'Draw an active unowned fighter for 350 AC.', availability: AVAILABILITY.ACTIVE, public: true, route: 'draw' }),
    Object.freeze({ id: 'fighter-upgrade', title: 'Fighter Upgrade', summary: 'Upgrade systems are not available in this pre-pilot cut.', availability: AVAILABILITY.LOCKED, public: true }),
    Object.freeze({ id: 'dictionary', title: 'Dictionary', summary: 'Reference data is not available in this pre-pilot cut.', availability: AVAILABILITY.LOCKED, public: true }),
    Object.freeze({ id: 'missions', title: 'Missions', summary: 'Mission systems are not available in this pre-pilot cut.', availability: AVAILABILITY.LOCKED, public: true }),
    Object.freeze({ id: 'achievements', title: 'Achievements', summary: 'Achievement systems are not available in this pre-pilot cut.', availability: AVAILABILITY.LOCKED, public: true }),
    Object.freeze({ id: 'account-profile', title: 'Account / Profile', summary: 'Account and profile systems are not available in this pre-pilot cut.', availability: AVAILABILITY.LOCKED, public: true }),

    // Deliberate developer seam. It is not a public surface and no public menu
    // may render it merely because its combat implementation still exists.
    Object.freeze({ id: 'arsenal-lab', title: 'Arsenal Lab', availability: AVAILABILITY.ADMIN, public: false, developerOnly: true, route: 'lab' }),

    // Historical systems remain source-compatible but are not routes in the
    // pre-pilot product graph. Keeping these explicit prevents accidental
    // resurrection through a generic "all modes" menu.
    Object.freeze({ id: 'classic-play', title: 'Classic Play', availability: AVAILABILITY.DETACHED, public: false }),
    Object.freeze({ id: 'apex-control', title: 'APEX CONTROL', availability: AVAILABILITY.DETACHED, public: false }),
    Object.freeze({ id: 'three-phase-battle', title: '3-Phase / Tam Chien', availability: AVAILABILITY.DETACHED, public: false }),
    Object.freeze({ id: 'saitama-trial', title: 'Saitama Trial', availability: AVAILABILITY.DETACHED, public: false }),
    Object.freeze({ id: 'tournament', title: 'Tournament', availability: AVAILABILITY.DETACHED, public: false }),
    Object.freeze({ id: 'standalone-solo', title: 'Standalone Solo', availability: AVAILABILITY.DETACHED, public: false }),
    Object.freeze({ id: 'arsenal-quest-20', title: 'Historical 20-stage Arsenal Quest', availability: AVAILABILITY.LEGACY, public: false }),
  ]);

  // Storage ids never change. Availability is product authority, not a
  // cosmetic shop/select filter: only ACTIVE entries may be selected, bought,
  // or included in the draw pool. LOCKED entries remain visible so future
  // rollout can unlock them without reshaping saved ownership.
  const ROSTER = Object.freeze([
    Object.freeze({ id: 'ROBOT', availability: AVAILABILITY.ACTIVE }),
    Object.freeze({ id: 'HUNTER', availability: AVAILABILITY.ACTIVE }),
    Object.freeze({ id: 'CRYSTAL', availability: AVAILABILITY.ACTIVE }),
    Object.freeze({ id: 'MAGNET', availability: AVAILABILITY.ACTIVE }),
    Object.freeze({ id: 'ICE', availability: AVAILABILITY.ACTIVE }),
    Object.freeze({ id: 'MIRROR', availability: AVAILABILITY.ACTIVE }),
    Object.freeze({ id: 'BLACK_HOLE', availability: AVAILABILITY.LOCKED }),
    Object.freeze({ id: 'MATH_V2', availability: AVAILABILITY.LOCKED }),
    Object.freeze({ id: 'RUBBER', availability: AVAILABILITY.LOCKED }),
    Object.freeze({ id: 'TIME', availability: AVAILABILITY.LOCKED }),
    Object.freeze({ id: 'SLIME', availability: AVAILABILITY.LOCKED }),
    Object.freeze({ id: 'SNIPER', availability: AVAILABILITY.LOCKED }),
  ]);

  const PRODUCT_DISPLAY_FALLBACKS = Object.freeze({
    ROBOT: 'NEWBOT',
    CRYSTAL: 'CRYSTALA',
    ICE: 'FROST',
  });
  const surfaceById = Object.freeze(Object.fromEntries(SURFACES.map((entry) => [entry.id, entry])));
  const rosterById = Object.freeze(Object.fromEntries(ROSTER.map((entry) => [entry.id, entry])));

  function normalizeId(value) {
    const raw = String(value == null ? '' : value).trim().toUpperCase();
    if (raw === 'NEWBIE') return 'ROBOT'; // persisted migration compatibility
    if (raw === 'FROST') return 'ICE';
    return raw;
  }

  function clone(entry) {
    return entry ? { ...entry } : null;
  }

  function surface(id) {
    return clone(surfaceById[String(id || '').toLowerCase()]);
  }

  function rosterEntry(id) {
    return clone(rosterById[normalizeId(id)]);
  }

  function displayNameFor(id) {
    const canonical = normalizeId(id);
    const registry = globalScope.APEX_HERO_REWORK_REGISTRY;
    if (registry && typeof registry.displayNameFor === 'function') {
      const display = registry.displayNameFor(canonical);
      if (display && String(display).toUpperCase() !== canonical) return String(display);
    }
    return PRODUCT_DISPLAY_FALLBACKS[canonical] || canonical;
  }

  function isRosterActive(id) {
    return rosterById[normalizeId(id)]?.availability === AVAILABILITY.ACTIVE;
  }

  function canSelectFighter(id) {
    return isRosterActive(id);
  }

  function canPurchaseFighter(id) {
    return isRosterActive(id);
  }

  function canDrawFighter(id) {
    return isRosterActive(id);
  }

  function sanitizeSelection(id, fallback) {
    const preferredFallback = isRosterActive(fallback) ? normalizeId(fallback) : 'ROBOT';
    const canonical = normalizeId(id);
    return canSelectFighter(canonical) ? canonical : preferredFallback;
  }

  function publicSurfaces() {
    return SURFACES.filter((entry) => entry.public).map(clone);
  }

  function visibleRoster() {
    return ROSTER.map((entry) => ({ ...entry, displayName: displayNameFor(entry.id) }));
  }

  function activeRosterIds() {
    return ROSTER.filter((entry) => entry.availability === AVAILABILITY.ACTIVE).map((entry) => entry.id);
  }

  function visibleRosterIds() {
    return ROSTER.map((entry) => entry.id);
  }

  function request(id, options) {
    const entry = surfaceById[String(id || '').toLowerCase()];
    if (!entry) return { ok: false, reason: 'unknown-surface', id: String(id || '') };
    if (entry.availability === AVAILABILITY.ACTIVE) return { ok: true, surface: clone(entry) };
    if (entry.availability === AVAILABILITY.ADMIN && options && options.developer === true) {
      return { ok: true, surface: clone(entry), developer: true };
    }
    return { ok: false, reason: String(entry.availability).toLowerCase(), surface: clone(entry) };
  }

  const BOT_BATTLE_SEAM = Object.freeze({
    availability: AVAILABILITY.ACTIVE,
    // The existing accepted Arsenal battle already has a bounded P1/P2 seam:
    // P1 uses manual J/K rework inputs while P2 uses Hero Rework's p2CastAI.
    // Product routing only preselects a legal CPU shell; it does not build a
    // second AI, alter combat tuning, or claim unsupported direct controls.
    launcher: 'arsenalShellSelectRuntime.beginSelection({ mode: "bot" })',
    p1Input: 'accepted Arsenal P1 manual ability gate',
    p2Policy: 'Hero Rework p2CastAI plus accepted automatic combat loop',
  });

  const authority = Object.freeze({
    version: 'pre-pilot-product-graph-v1',
    AVAILABILITY,
    BOT_BATTLE_SEAM,
    surfaces: () => SURFACES.map(clone),
    publicSurfaces,
    surface,
    request,
    roster: visibleRoster,
    rosterEntry,
    activeRosterIds,
    visibleRosterIds,
    displayNameFor,
    normalizeId,
    isRosterActive,
    canSelectFighter,
    canPurchaseFighter,
    canDrawFighter,
    sanitizeSelection,
  });

  // Aliases deliberately point to the exact same frozen authority; there is
  // still one source of truth for code written under either product naming
  // convention during the transition.
  globalScope.APEX_PRODUCT_SURFACES = authority;
  globalScope.APEX_CHAOS_PRODUCT = authority;
  globalScope.APEX_PRODUCT = authority;
  globalScope.apexProductSurfaceRuntime = 'ready';
})(typeof window !== 'undefined' ? window : globalThis);
