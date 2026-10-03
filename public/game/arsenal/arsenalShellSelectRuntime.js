// ARSENAL QUEST V2 — Checkpoint A shells + B-handoff A-CORR-3 compatibility.
// Canonical 32 fighter shells, independently selectable for P1/P2.
// Shells reuse each fighter's real identity: native kits run per the
// documented KEEP/ADAPT/SUPPRESS matrix in
// docs/arsenal-quest/V2_ROSTER_COMPATIBILITY_MATRIX.md. Movement base speed is
// Arsenal-normalized; rage variants are suppressed roster-wide (noRage).
// No second roster renderer: the shared select screen renders these cards.
(function apexArsenalShellSelectRuntime() {
  if (window.apexArsenalShellSelectRuntime === 'ready') return;
  const CFG = window.APEX_ARSENAL_CONFIG;

  const CANONICAL_32 = [
    'RUBBER', 'ICE', 'VAMPIRE', 'STRING', 'VOLCANO', 'MAGNET', 'FLASH', 'ELECTRIC',
    'ORBIT', 'TOXIC', 'MIRROR', 'BLACK_HOLE', 'SAW', 'BLADE', 'NOVA', 'HUNTER',
    'CRYSTAL', 'VIRUS', 'DRUM', 'CARD', 'MATH', 'MATH_V2', 'SNIPER', 'SLIME',
    'TIME', 'WOLF', 'WIND', 'WITCH', 'PIRATE', 'PAINTER', 'MONK', 'SUPERSTAR',
    // POST-C §7: NEWBIE — the Arsenal-original hero (33rd shell).
    'NEWBIE',
  ];

  // Hero Rework owns the canonical twelve identities. The pre-pilot product
  // graph intentionally exposes all twelve as visible roster records but only
  // its Core Six as ACTIVE/selectable. The product authority is queried here
  // rather than re-encoding a shop/select-only allowlist.
  const CANONICAL_12 = [
    'ROBOT', 'CRYSTAL', 'MAGNET', 'BLACK_HOLE', 'MATH_V2', 'ICE', 'RUBBER',
    'HUNTER', 'TIME', 'MIRROR', 'SLIME', 'SNIPER',
  ];
  const REWORK_PRODUCT_CUTOVER = !!(window.APEX_HERO_REWORK_REGISTRY
    && window.APEX_HERO_REWORK_REGISTRY.productCutover !== false);
  function productAuthority() { return window.APEX_PRODUCT_SURFACES || null; }
  function visibleProductIds() {
    const P = productAuthority();
    return REWORK_PRODUCT_CUTOVER && P && P.visibleRosterIds ? P.visibleRosterIds() : CANONICAL_12.slice();
  }
  function playableIds() {
    const P = productAuthority();
    return REWORK_PRODUCT_CUTOVER && P && P.activeRosterIds ? P.activeRosterIds() : (REWORK_PRODUCT_CUTOVER ? CANONICAL_12.slice() : CANONICAL_32.slice());
  }
  function canSelectProductFighter(name) {
    const P = productAuthority();
    return P && P.canSelectFighter ? P.canSelectFighter(name) : playableIds().includes(String(name || '').toUpperCase());
  }
  function canUseProductFighter(name) {
    const id = String(name || '').toUpperCase();
    if (!canSelectProductFighter(id)) return false;
    // Availability alone is insufficient at a launch boundary. When Meta is
    // present (every product route), ownership is also required. The fallback
    // keeps explicit compatibility harnesses functional before Meta loads.
    const meta = window.APEX_ARSENAL_META;
    return !meta || typeof meta.owns !== 'function' || meta.owns(id);
  }

  // HERO REWORK: rework shell — runs NO legacy kit (no-double-execution law,
  // docs/hero-rework/phase1/04). Movement/AI comes from the rework runtime;
  // visual stays the engine's neutral default (temporary presentation, not
  // owner visual direction).
  function makeReworkShell(name) {
    const base = baseTypeFor(name);
    // FROST V1 (authority §1): product copy shows the display identity;
    // the shell name/storage key stays canonical.
    const REG = window.APEX_HERO_REWORK_REGISTRY;
    const label = (REG && REG.displayNameFor) ? REG.displayNameFor(name) : name;
    return {
      name,
      color: (base && base.color) || '#c8c2b4',
      desc: `Hero Rework — ${label}`,
      speed: CFG.FIGHTER_SPEED,
      startDx: (base && base.startDx != null) ? base.startDx : 1,
      startDy: (base && base.startDy != null) ? base.startDy : 0.55,
      noRage: true,
      arsenalShell: true,
      __hrHero: name,
      compatKit: 'REWORK',
      init: (f) => { f.data = f.data || {}; },
      update: (f, enemy, dt) => {
        if (window.APEX_HERO_REWORK && window.APEX_HERO_REWORK.shellUpdate) {
          window.APEX_HERO_REWORK.shellUpdate(f, enemy, dt);
        }
        // Without the rework runtime the body stays inert (never a legacy kit).
      },
    };
  }

  // Three canonical identities were re-keyed by boot-time mainline patches:
  // GALAXY_REPLACES_NOVA_PATCH (NOVA -> GALAXY), apexCanonicalBalance
  // (WIND -> PUPPET, MONK -> KUNGFU) with apexPrecisionFixes re-writing the
  // KUNGFU kit. Shells keep the canonical NAMES (cards, engine hooks, QA) but
  // resolve the CURRENT live identity so compatible kits actually run.
  const IDENTITY_ALIASES = { NOVA: 'GALAXY', WIND: 'PUPPET', MONK: 'KUNGFU' };

  function baseTypeFor(name) {
    const live = (typeof FighterTypes !== 'undefined' && FighterTypes)
      ? FighterTypes.find(t => t && t.name === name) : null;
    if (live) return live;
    const alias = IDENTITY_ALIASES[name];
    if (alias && typeof FighterTypes !== 'undefined' && FighterTypes) {
      const aliased = FighterTypes.find(t => t && t.name === alias);
      if (aliased) return aliased;
    }
    return (window.__APEX_REMOVED_FIGHTER_TYPES || {})[name] || null;
  }

  // V2 B-handoff A-CORR-3: data-driven compatibility profiles. One entry per
  // canonical fighter; see docs/arsenal-quest/V2_ROSTER_COMPATIBILITY_MATRIX.md
  // for the per-mechanic rationale. Default is KEEP (native kit runs).
  // 'ADAPT' rows run native too — their narrow compatibility changes live as
  // arsenalShell-keyed engine hooks (VAMPIRE latch 2.5s, MONK rush 2.5s).
  // No per-fighter mode checks scattered through gameplay code.
  const COMPAT_PROFILES = {
    RUBBER: 'KEEP', ICE: 'KEEP', VAMPIRE: 'ADAPT', STRING: 'KEEP',
    VOLCANO: 'KEEP', MAGNET: 'KEEP', FLASH: 'KEEP', ELECTRIC: 'KEEP',
    ORBIT: 'KEEP', TOXIC: 'KEEP', MIRROR: 'KEEP', BLACK_HOLE: 'KEEP',
    SAW: 'KEEP', BLADE: 'KEEP', NOVA: 'KEEP', HUNTER: 'KEEP',
    CRYSTAL: 'KEEP', VIRUS: 'KEEP', DRUM: 'KEEP', CARD: 'KEEP',
    MATH: 'KEEP', MATH_V2: 'KEEP', SNIPER: 'KEEP', SLIME: 'KEEP',
    TIME: 'KEEP', WOLF: 'KEEP', WIND: 'KEEP', WITCH: 'KEEP',
    PIRATE: 'KEEP', PAINTER: 'KEEP', MONK: 'ADAPT', SUPERSTAR: 'KEEP',
    NEWBIE: 'KEEP',
  };

  // POST-C §7 — NEWBIE: Arsenal-original 33rd shell. Simple beginner body
  // (no glyphs). One active: 10s cooldown, dash toward the nearest REVEALED
  // pickup. P1 uses J via the skill gate (nbTrigger); P2 auto-casts when
  // ready. Activation fails (cooldown NOT consumed) if no eligible pickup.
  function makeNewbieType() {
    const spec = (CFG && CFG.NEWBIE) || { cooldown: 10, dashSpeed: 3400, dashMaxSeconds: 0.55, turnRate: 11, magnetRadius: 34, magnetPull: 900 };
    function nearestRevealedPickup(f) {
      const slots = (window.APEX_ARSENAL && window.APEX_ARSENAL.state && window.APEX_ARSENAL.state.slots) || [];
      let best = null, bestD = Infinity;
      for (const s of slots) {
        if (!s || s.phase !== 'REVEALED' || !s.weaponId) continue;
        // B7: red-tier (T6) pickups are NOT dash targets — no auto
        // acquisition. The hero can still pick one up PHYSICALLY by
        // walking over it; the dash simply never seeks it.
        if (CFG.isHeroManipulablePickup && !CFG.isHeroManipulablePickup(s)) continue;
        const d = Math.hypot(s.x - f.x, s.y - f.y);
        if (d < bestD) { bestD = d; best = s; }
      }
      return best;
    }
    function tryLaunchDash(f, opts) {
      const slot = nearestRevealedPickup(f);
      if (!slot) {
        // CP7 (owner playtest round 4): fail feedback belongs to DELIBERATE
        // activation (P1's skill-gate J pulse). The P2 auto-cast polls this
        // every tick while unarmed with no revealed pickup — cueing here
        // re-triggered metalClick ~10x/s from match start until the first
        // pickup ("one sound loops forever"). Auto-cast failures are silent.
        if (!(opts && opts.auto)) window.avCue && window.avCue('newbie_fail', { x: f.x, y: f.y });
        return false;
      }
      const dx = slot.x - f.x, dy = slot.y - f.y;
      const mag = Math.hypot(dx, dy) || 1;
      f.data.nbDash = {
        tx: slot.x, ty: slot.y, slotId: slot.id,
        vx: (dx / mag) * spec.dashSpeed,
        vy: (dy / mag) * spec.dashSpeed,
        t: 0, max: spec.dashMaxSeconds,
      };
      // Trajectory BEND — setDir so movement reads as a real dash, not a teleport.
      if (typeof f.setDir === 'function') f.setDir(dx / mag, dy / mag);
      f.data.nbCd = spec.cooldown;
      window.avCue && window.avCue('newbie_dash', { x: f.x, y: f.y, angle: Math.atan2(dy, dx) });
      if (window.APEX_ARSENAL && window.APEX_ARSENAL.log) {
        window.APEX_ARSENAL.log('NEWBIE_DASH', `fighter=${f.name} slot=${slot.id} weapon=${slot.weaponId}`);
      }
      return true;
    }
    return {
      name: 'NEWBIE',
      color: '#c8c2b4',
      desc: 'Beginner shell — dash to the nearest revealed weapon',
      speed: CFG.FIGHTER_SPEED,
      startDx: 1,
      startDy: 0.55,
      noRage: true,
      arsenalShell: true,
      arsenalOriginal: true,
      compatKit: 'KEEP',
      init: (f) => {
        f.data = f.data || {};
        f.data.nbCd = 0;
        f.data.nbDash = null;
        f.data.nbTrigger = false;
      },
      update: (f, e, dt) => {
        f.data.nbCd = Math.max(0, (f.data.nbCd || 0) - (typeof abilityDt === 'function' ? abilityDt(f, dt) : dt));
        // In-flight dash: physical motion toward the pickup, magnet in last metre.
        if (f.data.nbDash) {
          const d = f.data.nbDash;
          d.t += dt;
          const dx = d.tx - f.x, dy = d.ty - f.y;
          const mag = Math.hypot(dx, dy) || 1;
          // Steer toward the (possibly moving) pickup without teleporting.
          const desiredVx = (dx / mag) * spec.dashSpeed;
          const desiredVy = (dy / mag) * spec.dashSpeed;
          const k = Math.min(1, spec.turnRate * dt);
          d.vx += (desiredVx - d.vx) * k;
          d.vy += (desiredVy - d.vy) * k;
          f.x += d.vx * dt;
          f.y += d.vy * dt;
          if (typeof f.setDir === 'function') f.setDir(d.vx, d.vy);
          // Soft magnet on the pickup in the last few dozen pixels.
          const slots = (window.APEX_ARSENAL && window.APEX_ARSENAL.state && window.APEX_ARSENAL.state.slots) || [];
          const slot = slots.find((s) => s && s.id === d.slotId);
          // B7: the magnetic pull must never yank a red-tier (T6) pickup —
          // hero manipulation can't move it. Physical pickup still works.
          if (slot && slot.phase === 'REVEALED' && (!CFG.isHeroManipulablePickup || CFG.isHeroManipulablePickup(slot))) {
            const sd = Math.hypot(slot.x - f.x, slot.y - f.y);
            if (sd < spec.magnetRadius * 3) {
              const pull = spec.magnetPull * dt;
              const nx = (f.x - slot.x) / (sd || 1);
              const ny = (f.y - slot.y) / (sd || 1);
              slot.x += nx * pull * 0.15;
              slot.y += ny * pull * 0.15;
            }
          }
          const arrived = mag < spec.magnetRadius || d.t >= d.max;
          if (arrived) f.data.nbDash = null;
          return;
        }
        // P1: the skill gate sets nbTrigger on a successful J pulse.
        // P2: auto-cast when ready (narrow exception to no-weapon-seeking-AI).
        const isP1 = typeof fighters !== 'undefined' && fighters && fighters[0] === f;
        if (f.data.nbTrigger) {
          f.data.nbTrigger = false;
          if (f.data.nbCd > 1e-6) return;
          tryLaunchDash(f);
          return;
        }
        if (!isP1 && f.data.nbCd <= 1e-6) tryLaunchDash(f, { auto: true });
      },
      draw: (c, f) => {
        // Glyph-free beginner body: stacked rounded blobs + visor band.
        if (typeof drawSketchBlob === 'function') drawSketchBlob(c, f.radius, f.color, 14);
        else {
          c.fillStyle = f.color;
          c.beginPath();
          c.arc(0, 0, f.radius, 0, Math.PI * 2);
          c.fill();
        }
        c.save();
        c.fillStyle = '#2a2c32';
        c.beginPath();
        c.ellipse(0, -8, f.radius * 0.55, 10, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(180, 220, 255, 0.55)';
        c.beginPath();
        c.ellipse(0, -8, f.radius * 0.42, 6, 0, 0, Math.PI * 2);
        c.fill();
        if (f.data && f.data.nbDash) {
          c.strokeStyle = 'rgba(232,224,200,0.55)';
          c.lineWidth = 6;
          c.beginPath();
          c.arc(0, 0, f.radius + 18, 0, Math.PI * 2);
          c.stroke();
        }
        c.restore();
      },
    };
  }

  // Every native hook is delegated through a guard so a native-kit fault can
  // never corrupt Arsenal weapon pickup/reveal/holder state (A-CORR-3 rule).
  function guardHook(fn, fallback) {
    if (typeof fn !== 'function') return null;
    return function guarded(...args) {
      try { return fn(...args); } catch (error) { return fallback; }
    };
  }

  const shellCache = new Map();
  function shellTypeFor(name) {
    if (!name) return null;
    // FROST V1 (authority §1): FROST is an external alias for the canonical
    // ICE storage hero — same rework shell, never a duplicate roster entry.
    if (name === 'FROST') return shellTypeFor('ICE');
    if (shellCache.has(name)) return shellCache.get(name);
    // HERO REWORK cutover: canonical-12 playable heroes (and the retired
    // NEWBIE, replaced by ROBOT) resolve to rework shells — no legacy kit
    // double-executes. All other legacy names (Quest boss encounters) keep
    // the audited legacy compatibility path (doc 06 roster classes).
    if (REWORK_PRODUCT_CUTOVER) {
      const reworkName = name === 'NEWBIE' ? 'ROBOT' : null;
      const canonical = (window.APEX_HERO_REWORK_REGISTRY && window.APEX_HERO_REWORK_REGISTRY.isCanonicalHero
        && window.APEX_HERO_REWORK_REGISTRY.isCanonicalHero(name)) ? name : null;
      const reworkTarget = reworkName || canonical;
      if (reworkTarget) {
        const shell = makeReworkShell(reworkTarget);
        shellCache.set(name, shell);
        return shell;
      }
    }
    if (name === 'NEWBIE') {
      const newbie = makeNewbieType();
      shellCache.set(name, newbie);
      return newbie;
    }
    const base = baseTypeFor(name);
    const kit = COMPAT_PROFILES[name] || 'KEEP';
    let shell;
    if (!base) {
      shell = {
        name,
        color: '#9e9e9e',
        desc: 'Arsenal shell — no native kit found',
        speed: CFG.FIGHTER_SPEED,
        startDx: 1,
        startDy: 0.55,
        noRage: true,
        arsenalShell: true,
        compatKit: 'SUPPRESS',
        init: () => {},
        update: () => {},
        draw: (c, f) => { drawSketchBlob(c, f.radius, f.color, 12); },
      };
    } else {
      // Real characters with compatible identity: native init/update/collide/
      // wall/damage hooks run as documented in the matrix. Rage variants stay
      // suppressed roster-wide via noRage (global ADAPT, documented).
      shell = {
        name: base.name,
        color: base.color,
        desc: base.desc,
        speed: CFG.FIGHTER_SPEED,
        startDx: base.startDx != null ? base.startDx : 1,
        startDy: base.startDy != null ? base.startDy : 0.55,
        noRage: true,
        arsenalShell: true,
        shellOf: base.name,
        compatKit: kit,
        init: (f) => { f.data = f.data || {}; try { if (base.init) base.init(f); } catch (error) {} },
        update: guardHook(base.update, undefined) || (() => {}),
        speedModifier: guardHook(base.speedModifier, 1),
        onWallBounce: guardHook(base.onWallBounce, undefined),
        onCollide: guardHook(base.onCollide, false),
        onTakeDamage: guardHook(base.onTakeDamage, undefined),
        draw: typeof base.draw === 'function'
          ? (c, f) => { try { base.draw(c, f); } catch (error) {} }
          : (c, f) => { drawSketchBlob(c, f.radius, f.color, 12); },
      };
    }
    shellCache.set(name, shell);
    return shell;
  }

  // Product selection is deliberately narrower than typeFor(): the latter
  // still resolves historical bosses and retired shells for compatibility,
  // while the picker receives only currently ACTIVE product fighters.
  function roster() { return playableIds().map(shellTypeFor).filter(Boolean); }
  function selectionTypeFor(name) {
    const id = String(name || '').toUpperCase();
    return canUseProductFighter(id) ? shellTypeFor(id) : null;
  }

  function ensureNewbieOnRoster() {
    // HERO REWORK cutover: NEWBIE is retired from the roster — ROBOT is the
    // product-facing replacement. No-op after cutover (idempotent).
    if (REWORK_PRODUCT_CUTOVER) return;
    if (typeof FighterTypes === 'undefined' || !FighterTypes) return;
    if (FighterTypes.some((t) => t && t.name === 'NEWBIE')) return;
    FighterTypes.push(shellTypeFor('NEWBIE'));
  }
  function dropNewbieFromRoster() {
    if (typeof FighterTypes === 'undefined' || !FighterTypes) return;
    const i = FighterTypes.findIndex((t) => t && t.name === 'NEWBIE' && t.arsenalOriginal);
    if (i >= 0) FighterTypes.splice(i, 1);
  }

  function beginSelection(options) {
    const requested = options && options.mode;
    // Legacy ladder callers set their own explicit pending flag. They retain
    // their compatibility route but cannot leak into normal public navigation.
    const mode = requested || (window.__apexArsenalQuestPick ? 'legacy-quest' : 'local');
    window.__apexArsenalSelectionMode = mode;
    window.__apexArsenalSelectPending = true;
    window.__apexArsenalFreeBattle = mode === 'local';
    window.__apexArsenalBotBattle = mode === 'bot';
    if (mode !== 'legacy-quest') window.__apexArsenalQuestPick = false;
    ensureNewbieOnRoster();
    if (typeof goToSelect === 'function') goToSelect();
    else if (typeof window.goToSelect === 'function') window.goToSelect();
    // Product display identity is owned by the Hero Registry (FROST, NEWBOT,
    // CRYSTALA); this patch remains a non-authoritative compatibility hook.
    try {
      const HR = window.APEX_HERO_REWORK;
      if (HR && HR.patchFrostProductCopy) HR.patchFrostProductCopy();
    } catch (e) { /* copy never breaks selection */ }
  }

  // Route the shared select screen's START into the neutral Arsenal combat
  // shell. The historical function name remains below as a compatibility
  // alias, but product launch no longer waits for the retired quest ladder.
  const baseStartMatch = typeof window.startMatch === 'function' ? window.startMatch : null;
  window.startMatch = function (...args) {
    if (window.__apexArsenalSelectPending) {
      window.__apexArsenalSelectPending = false;
      const mode = window.__apexArsenalSelectionMode || (window.__apexArsenalQuestPick ? 'legacy-quest' : 'local');
      const legacyQuest = mode === 'legacy-quest' || window.__apexArsenalQuestPick === true;
      const p1 = typeof p1Selection !== 'undefined' ? p1Selection : null;
      const p2 = typeof p2Selection !== 'undefined' ? p2Selection : null;
      const productSelectionAllowed = !!p1 && !!p2
        && canUseProductFighter(p1.name)
        && (mode === 'bot' || legacyQuest || canUseProductFighter(p2.name));
      // Product entry must reject stale/future selections below the UI. Quest
      // compatibility may still resolve its historical opponent through
      // typeFor, but its player side remains an ACTIVE roster fighter.
      if (!p1 || !p2 || !productSelectionAllowed) {
        if (typeof window.openApexProductSurface === 'function' && !legacyQuest) window.openApexProductSurface(mode === 'bot' ? 'bot-battle' : 'local-1v1');
        else if (typeof window.beginArsenalQuestSelection === 'function') window.beginArsenalQuestSelection();
        return;
      }
      const launch = () => {
        const productLauncher = window.startArsenalProductBattle;
        if (typeof window.startArsenalQuestMode === 'function' && (legacyQuest || typeof productLauncher === 'function')) {
          window.__apexArsenalBattleKind = mode === 'bot' ? 'BOT_BATTLE' : (legacyQuest ? 'LEGACY_QUEST' : 'LOCAL_1V1');
          window.APEX_ARSENAL_META?.setLast?.(p1.name, legacyQuest ? null : p2.name);
          const result = legacyQuest ? window.startArsenalQuestMode(p1.name, p2.name) : productLauncher(p1.name, p2.name);
          if (result && result.ok === false) {
            if (typeof window.openApexProductSurface === 'function') window.openApexProductSurface(mode === 'bot' ? 'bot-battle' : 'local-1v1');
            return;
          }
          window.__apexArsenalSelectionMode = null;
          window.__apexArsenalQuestPick = false;
          window.__apexArsenalFreeBattle = false;
          window.__apexArsenalBotBattle = false;
        } else if (typeof window.openApexProductSurface === 'function' && !legacyQuest) {
          window.openApexProductSurface(mode === 'bot' ? 'bot-battle' : 'local-1v1');
        } else if (typeof window.beginArsenalQuestSelection === 'function') {
          window.beginArsenalQuestSelection();
        }
      };
      // The barrier loads arsenalCore, the shared combat/presentation spine.
      // It has no dependency on the historical 20-stage ladder.
      if (window.apexArsenalGameplayBarrierSync && window.apexArsenalGameplayBarrierSync('match')) { launch(); return; }
      if (window.apexArsenalGameplayBarrier) {
        window.apexArsenalGameplayBarrier('match').then((ok) => { if (ok) launch(); });
        return;
      }
      const ensure = window.__apexEnsureDeferredRuntimes;
      if (typeof ensure === 'function') ensure(legacyQuest ? 'arsenalQuest' : 'arsenalCore').then(launch).catch(() => {});
      else launch();
      return;
    }
    return baseStartMatch ? baseStartMatch.apply(this, args) : undefined;
  };

  // Leaving the select screen any other way cancels the pending Arsenal select.
  const baseGoToMenu = typeof window.goToMenu === 'function' ? window.goToMenu : null;
  window.goToMenu = function (...args) {
    window.__apexArsenalSelectPending = false;
    window.__apexArsenalSelectionMode = null;
    window.__apexArsenalFreeBattle = false;
    window.__apexArsenalBotBattle = false;
    return baseGoToMenu ? baseGoToMenu.apply(this, args) : undefined;
  };

  // Compatibility alias deliberately retained for historical integrations.
  // Product callers use beginArsenalProductSelection/openApexProductSurface.
  window.beginArsenalQuestSelection = beginSelection;
  window.beginArsenalProductSelection = beginSelection;

  window.APEX_ARSENAL_SHELLS = {
    // `ids` is strictly the currently ACTIVE selection/purchase/draw pool.
    // `visibleIds` preserves the exact twelve-row product roster for shop UI;
    // `typeFor` remains unrestricted for historical encounter compatibility.
    ids: playableIds(),
    visibleIds: visibleProductIds(),
    legacyIds: CANONICAL_32,
    isPlayable: (name) => canSelectProductFighter(name),
    canSelect: canSelectProductFighter,
    canUse: canUseProductFighter,
    typeFor: shellTypeFor,
    selectionTypeFor,
    roster,
    beginSelection,
    isPending: () => !!window.__apexArsenalSelectPending,
  };
  window.apexArsenalShellSelectRuntime = 'ready';
})();
