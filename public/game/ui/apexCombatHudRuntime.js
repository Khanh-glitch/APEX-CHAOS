// APEX CHAOS — PASS B universal combat HUD (state adapter + DOM renderer).
//
// Product context: docs/CURRENT_PRODUCT_AUTHORITY.md
//
// Architecture law (authority §13):
//
//     engine / mode truth
//          ↓  (realized-damage events + match-start events only)
//     APEX_COMBAT_HUD state adapter
//          ↓
//     DOM side-panel shell + cached weapon-art renderer
//
// The renderer never recalculates damage, crit, weapon, or cooldown rules.
// It consumes:
//   - APEX_COMBAT_HUD.onRealizedDamage({attacker, victim, amount, critical, label})
//     fired once per positive realized damage transaction from the engine's
//     central Fighter.takeDamage path (amount = actual HP loss, already
//     post-mitigation; never mutates the damage result);
//   - APEX_COMBAT_HUD.onMatchStart() fired from startSpecificMatch /
//     startArsenalBattleMode (energy + burst reset).
//
// DOM contract: React (src/App.jsx) owns the panel markup. This module only
// caches element refs and writes when a value actually changes (the same
// cached-ref / last-value pattern as arsenalBattleRuntime.syncDomHud).
(function apexCombatHudRuntime() {
  if (window.apexCombatHudRuntime === 'ready') return;
  if (typeof document === 'undefined') return;

  // ------------------------------------------------------------------ law --
  const SILENCE_MS = 1200;                       // §7.3: reset only after 1.20 s silence
  const ENERGY_CAP = 100;                        // §11: 0..100
  // §11 exact law: dealGain = 100 * realizedDamage / targetMaxHp
  //                takeGain = 60  * realizedDamage / selfMaxHp
  // (i.e. +1.00 per 1% max HP dealt, +0.60 per 1% max HP taken)
  const ENERGY_DEALT_CONST = 100;
  const ENERGY_TAKEN_CONST = 60;
  const BEHIND_RATIO = 0.75;                     // §9 "meaningfully behind in HP"
  const RECONCILE_MS = 100;                    // low-rate reconciliation for cooldown/loadout state

  // §9 deterministic commentary tiers (priority high → low).
  const TIERS = ['DEVASTATING', 'CRITICAL RUSH', 'MOMENTUM SWING', 'OVERDRIVE', 'RAMPAGE', 'PRESSURE', 'CONTACT'];
  const TIER_COLOR = {
    CONTACT: null,                               // side accent
    PRESSURE: '#F2CF55',
    RAMPAGE: '#FF9E35',
    OVERDRIVE: '#FF6A2A',
    'CRITICAL RUSH': '#FF4931',
    'MOMENTUM SWING': '#FF6A2A',                 // OVERDRIVE / orange-red family
    DEVASTATING: '#FF2727',
  };
  // Panel impact translation is allowed at higher tiers only (authority §10).
  const PUNCH_SHIFT_TIER = 2; // OVERDRIVE index and above

  const TIER_RANK = {};
  for (let i = 0; i < TIERS.length; i++) TIER_RANK[TIERS[i]] = TIERS.length - i;

  // Pure, testable commentary resolver (authority §9 thresholds, normalized
  // to the target's authoritative max HP so it works outside 1000-HP).
  function commentaryFor(burst, targetMaxHp, attackerHp, victimHp) {
    const b = burst || {};
    const maxHp = Math.max(1, Number(targetMaxHp) || 1);
    const total = Number(b.total) || 0;
    const hits = Number(b.hits) || 0;
    const crits = Number(b.crits) || 0;
    const bigHit = Number(b.bigHit) || 0;
    const pct = (v) => total >= (v / 100) * maxHp;
    const isDevastating = bigHit >= 0.18 * maxHp || pct(23.5);
    const isCritRush = pct(10) && crits >= 2;
    const isBehind = (Number(attackerHp) || 0) < (Number(victimHp) || 0) * BEHIND_RATIO;
    const isSwing = isBehind && pct(12.5);
    if (isDevastating) return 'DEVASTATING';
    if (isCritRush) return 'CRITICAL RUSH';
    if (isSwing) return 'MOMENTUM SWING';
    if (pct(15)) return 'OVERDRIVE';
    if (pct(9) || hits >= 4) return 'RAMPAGE';
    if (pct(4.5)) return 'PRESSURE';
    return 'CONTACT';
  }

  // ---------------------------------------------------------------- state --
  function freshSide() {
    return {
      fighter: null,
      energy: 0,
      burst: null,        // { total, hits, crits, bigHit } while active
      timer: null,        // exactly ONE silence timeout per side (§7.5)
      punchRelease: null,
      loadoutKey: null,
      loadoutPending: false,
      last: {},           // last rendered values per element (change-only writes)
    };
  }
  const sides = [freshSide(), freshSide()];
  const stats = {
    events: 0,
    timerArms: 0,
    resets: 0,
    energyWrites: 0,
    loadoutDraws: 0,
    panelWrites: 0,
    vitalWrites: 0,
    matchStarts: 0,
  };

  const refs = { hud: null, panels: [null, null], sides: [{}, {}], interval: null };

  const SIDE_IDS = (n) => ({
    panel: `p${n}-combat-panel`,
    name: `p${n}-name`,
    hp: `p${n}-hp`,
    hpText: `p${n}-hp-text`,
    hpLoss: `p${n}-hp-loss`,
    rage: `p${n}-rage`,
    chip: `p${n}-cp-chip`,
    burst: `p${n}-burst`,
    burstLabel: `p${n}-burst-label`,
    burstTotal: `p${n}-burst-total`,
    burstHits: `p${n}-burst-hits`,
    burstCrits: `p${n}-burst-crits`,
    burstFill: `p${n}-burst-fill`,
    loadoutSection: `p${n}-loadout`,
    loadoutCanvas: `p${n}-loadout-canvas`,
    loadoutFallback: `p${n}-loadout-fallback`,
    loadoutGlyph: `p${n}-cp-glyph`,
    loadoutFallbackLabel: `p${n}-loadout-fallback-label`,
    loadoutName: `p${n}-loadout-name`,
    loadoutFamily: `p${n}-loadout-family`,
    loadoutTier: `p${n}-loadout-tier`,
    loadoutState: `p${n}-loadout-state`,
    energyFill: `p${n}-energy-fill`,
    energyVal: `p${n}-energy-val`,
    energyState: `p${n}-energy-state`,
    modeSlot: `p${n}-mode-slot`,
  });

  function $(id) { return document.getElementById(id); }

  function cacheRefs() {
    if (refs.sides[0].panel) return true;
    let ok = true;
    refs.hud = $('hud');
    for (let i = 0; i < 2; i++) {
      const ids = SIDE_IDS(i + 1);
      const r = { _ids: ids };
      r.panel = $(ids.panel);
      r.name = $(ids.name);
      r.hp = $(ids.hp);
      r.hpText = $(ids.hpText);
      r.hpLoss = $(ids.hpLoss);
      r.rage = $(ids.rage);
      r.chip = $(ids.chip);
      r.burst = $(ids.burst);
      r.burstLabel = $(ids.burstLabel);
      r.burstTotal = $(ids.burstTotal);
      r.burstHits = $(ids.burstHits);
      r.burstCrits = $(ids.burstCrits);
      r.burstFill = $(ids.burstFill);
      r.loadoutSection = $(ids.loadoutSection);
      r.loadoutCanvas = $(ids.loadoutCanvas);
      r.loadoutFallback = $(ids.loadoutFallback);
      r.loadoutGlyph = $(ids.loadoutGlyph);
      r.loadoutFallbackLabel = $(ids.loadoutFallbackLabel);
      r.loadoutName = $(ids.loadoutName);
      r.loadoutFamily = $(ids.loadoutFamily);
      r.loadoutTier = $(ids.loadoutTier);
      r.loadoutState = $(ids.loadoutState);
      r.energyFill = $(ids.energyFill);
      r.energyVal = $(ids.energyVal);
      r.energyState = $(ids.energyState);
      r.modeSlot = $(ids.modeSlot);
      refs.sides[i] = r;
      if (!r.panel) ok = false;
    }
    return ok;
  }

  // ------------------------------------------------------------- helpers --
  function fighterList() {
    return (typeof fighters !== 'undefined') ? fighters : null;
  }
  function sideIndexOf(fighter) {
    const fs = fighterList();
    if (!fs) return -1;
    for (let i = 0; i < 2; i++) if (fs[i] === fighter) return i;
    return -1;
  }
  function gameStateNow() {
    return (typeof gameState !== 'undefined') ? gameState : 'MENU';
  }
  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  // --------------------------------------------------------- projection --
  // Gold-HUD boundary: all presentation truth is projected here. Renderers
  // consume this shape; they do not re-query unrelated DOM nodes.
  function identityProjection(f) {
    if (!f) return { name: '', color: '#ffffff', heroId: null };
    const hr = window.APEX_HERO_REWORK;
    const p = hr && hr.hudIdentity ? hr.hudIdentity(f) : null;
    return {
      name: String((p && p.name) || f.name || ''),
      color: String((p && p.color) || f.color || '#ffffff'),
      heroId: (p && p.heroId) || null,
    };
  }

  function vitalsProjection(f) {
    if (!f) return { hp: 0, maxHp: 1, visiblePct: 0, label: '0 / 1', rage: false };
    const hr = window.APEX_HERO_REWORK;
    const projected = hr && hr.bodyHudHp ? hr.bodyHudHp(f) : { hp: f.hp, maxHp: f.maxHp };
    const maxHp = Number.isFinite(projected && projected.maxHp) && projected.maxHp > 0 ? projected.maxHp : 1;
    const hp = Number.isFinite(projected && projected.hp) ? Math.max(0, projected.hp) : 0;
    const pct = Math.max(0, Math.min(140, (hp / maxHp) * 100));
    const visiblePct = Math.min(100, pct);
    const infinite = !!(f.data && f.data.autoBattleInfiniteHp);
    return {
      hp,
      maxHp,
      visiblePct,
      label: infinite ? `${hp.toFixed(1)} / INF` : `${hp.toFixed(1)} / ${maxHp}`,
      rage: !!f.isRage,
    };
  }

  function modeProjection(i, f) {
    const AQ = window.APEX_ARSENAL;
    if (gameStateNow() !== 'ARSENAL' || !AQ || typeof AQ.hudProjectionFor !== 'function') {
      return { active: false, modeLabel: '', skillLines: [], skillText: '' };
    }
    return AQ.hudProjectionFor(f, i) || { active: false, modeLabel: '', skillLines: [], skillText: '' };
  }

  function updateHpLossTrail(fill, trail, visiblePct) {
    if (!fill) return;
    const previous = Number(fill.dataset.hpPct);
    if (trail && Number.isFinite(previous) && visiblePct < previous - 0.01) {
      trail.style.transition = 'none';
      trail.style.left = `${visiblePct}%`;
      trail.style.width = `${previous - visiblePct}%`;
      trail.style.opacity = '1';
      void trail.offsetWidth;
      trail.style.transition = 'opacity .62s ease-out';
      clearTimeout(trail.__apexFadeTimer);
      trail.__apexFadeTimer = setTimeout(() => { trail.style.opacity = '0'; }, 70);
    } else if (trail && Number.isFinite(previous) && visiblePct > previous + 0.01) {
      trail.style.opacity = '0';
      trail.style.width = '0';
    }
    const width = `${visiblePct}%`;
    if (fill.style.width !== width) {
      fill.style.width = width;
      stats.vitalWrites += 1;
    }
    if (fill.dataset.hpPct !== String(visiblePct)) fill.dataset.hpPct = String(visiblePct);
  }

  function renderVitals(i) {
    cacheRefs();
    const r = refs.sides[i];
    const fs = fighterList();
    const f = fs && fs[i];
    if (!r || !r.panel || !f) return;
    const identity = identityProjection(f);
    const vitals = vitalsProjection(f);
    if (r.name) {
      if (r.name.innerText !== identity.name) { r.name.innerText = identity.name; stats.vitalWrites += 1; }
      if (r.name.style.color !== identity.color) { r.name.style.color = identity.color; stats.vitalWrites += 1; }
    }
    if (r.hp) {
      if (r.hp.style.backgroundColor !== identity.color) { r.hp.style.backgroundColor = identity.color; stats.vitalWrites += 1; }
      updateHpLossTrail(r.hp, r.hpLoss, vitals.visiblePct);
    }
    if (r.hpText && r.hpText.innerText !== vitals.label) { r.hpText.innerText = vitals.label; stats.vitalWrites += 1; }
    if (r.rage) {
      const opacity = vitals.rage ? '1' : '0';
      const display = vitals.rage ? 'block' : 'none';
      if (String(r.rage.style.opacity) !== opacity) { r.rage.style.opacity = opacity; stats.vitalWrites += 1; }
      if (r.rage.style.display !== display) { r.rage.style.display = display; stats.vitalWrites += 1; }
    }
  }

  // -------------------------------------------------------------- energy --
  function addEnergy(i, gain) {
    if (!(gain > 0)) return;
    const s = sides[i];
    const next = Math.min(ENERGY_CAP, s.energy + gain);
    if (next === s.energy) return;
    s.energy = next;
    stats.energyWrites += 1;
    renderEnergy(i);
  }

  function renderEnergy(i) {
    cacheRefs();
    const r = refs.sides[i];
    if (!r || !r.energyFill) return;
    const e = sides[i].energy;
    const pctText = String(Math.round(e));
    if (r.energyVal && r.energyVal.textContent !== pctText) { r.energyVal.textContent = pctText; stats.panelWrites += 1; }
    const width = `${e.toFixed(1)}%`;
    if (r.energyFill.style.width !== width) { r.energyFill.style.width = width; stats.panelWrites += 1; }
    const ready = e >= ENERGY_CAP;
    if (r.energyState && r.energyState.textContent !== (ready ? 'READY' : '')) { r.energyState.textContent = ready ? 'READY' : ''; stats.panelWrites += 1; }
    if (r.energyFill.classList.contains('is-ready') !== ready) {
      r.energyFill.classList.toggle('is-ready', ready);
      if (r.energyVal) r.energyVal.classList.toggle('is-ready', ready);
    }
    if (r.loadoutState && sides[i].loadoutKey) {
      const armed = String(sides[i].loadoutKey).startsWith('W:');
      const desired = ready && armed ? 'SKILL READY' : armed ? 'EQUIPPED' : (gameStateNow() === 'ARSENAL' ? 'UNARMED' : 'FIGHTER ID');
      if (r.loadoutState.textContent !== desired) { r.loadoutState.textContent = desired; stats.panelWrites += 1; }
    }
  }

  // --------------------------------------------------------------- burst --
  function renderBurst(i) {
    cacheRefs();
    const r = refs.sides[i];
    if (!r || !r.burstTotal) return;
    const s = sides[i];
    const b = s.burst;
    if (!b) {
      // idle — no filler commentary (authority §9)
      if (r.burstLabel.textContent !== '') r.burstLabel.textContent = '';
      if (r.burstLabel.style.color !== '') r.burstLabel.style.color = '';
      if (r.burstTotal.textContent !== '0') r.burstTotal.textContent = '0';
      if (r.burstTotal.style.color !== '') r.burstTotal.style.color = '';
      if (r.burstHits.textContent !== '0 HITS') r.burstHits.textContent = '0 HITS';
      if (r.burstCrits.textContent !== '0 CRIT') r.burstCrits.textContent = '0 CRIT';
      if (r.burstFill && r.burstFill.style.width !== '0%') r.burstFill.style.width = '0%';
      if (r.burst) {
        r.burst.style.setProperty('--cp-heat', '#4E5964');
        r.burst.classList.remove('is-hot', 'is-shift');
      }
      if (r.loadoutSection) {
        r.loadoutSection.style.setProperty('--cp-heat', i === 0 ? '#43B9EC' : '#FF6942');
        r.loadoutSection.classList.remove('is-hot');
      }
      if (r.burst.classList.contains('is-punch')) r.burst.classList.remove('is-punch');
      if (r.burstTotal.classList.contains('is-punch')) r.burstTotal.classList.remove('is-punch');
      return;
    }
    const fs = fighterList();
    const attacker = fs ? fs[i] : null;
    const victim = fs ? fs[1 - i] : null;
    const tier = commentaryFor(b, victim ? victim.maxHp : 1000, attacker ? attacker.hp : 0, victim ? victim.hp : 0);
    const color = TIER_COLOR[tier] || '';
    if (r.burstLabel.textContent !== tier) { r.burstLabel.textContent = tier; stats.panelWrites += 1; }
    if (r.burstLabel.style.color !== color) r.burstLabel.style.color = color;
    const totalText = String(Math.round(b.total));
    if (r.burstTotal.textContent !== totalText) { r.burstTotal.textContent = totalText; stats.panelWrites += 1; }
    if (r.burstTotal.style.color !== color) r.burstTotal.style.color = color;
    const hitsText = `${b.hits} HIT${b.hits === 1 ? '' : 'S'}`;
    if (r.burstHits && r.burstHits.textContent !== hitsText) { r.burstHits.textContent = hitsText; stats.panelWrites += 1; }
    const critsText = `${b.crits} CRIT${b.crits === 1 ? '' : 'S'}`;
    if (r.burstCrits && r.burstCrits.textContent !== critsText) { r.burstCrits.textContent = critsText; stats.panelWrites += 1; }
    const maxHp = Math.max(1, Number(victim && victim.maxHp) || 1000);
    const fillPct = Math.max(0, Math.min(100, (b.total / maxHp) * (100 / 0.24)));
    if (r.burstFill) {
      const w = `${fillPct.toFixed(1)}%`;
      if (r.burstFill.style.width !== w) r.burstFill.style.width = w;
      r.burstFill.style.backgroundColor = color;
    }
    if (r.burst) {
      r.burst.style.setProperty('--cp-heat', color);
      r.burst.classList.toggle('is-hot', TIER_RANK[tier] >= TIER_RANK['RAMPAGE']);
    }
    if (r.loadoutSection) {
      r.loadoutSection.style.setProperty('--cp-heat', color);
      r.loadoutSection.classList.toggle('is-hot', TIER_RANK[tier] >= TIER_RANK['OVERDRIVE']);
    }
    // subtle panel impact translation at higher tiers only (authority §10)
    const shift = TIER_RANK[tier] >= TIER_RANK['OVERDRIVE'];
    if (r.burst.classList.contains('is-shift') !== shift) r.burst.classList.toggle('is-shift', shift);
  }

  function punch(i) {
    cacheRefs();
    const r = refs.sides[i];
    const el = r && r.burstTotal;
    if (!el) return;
    if (sides[i].punchRelease) { clearTimeout(sides[i].punchRelease); sides[i].punchRelease = null; }
    el.classList.remove('is-punch');
    // restart the CSS transition so rapid consecutive hits re-punch cleanly
    void el.offsetWidth;
    el.classList.add('is-punch'); // fast ~45 ms attack (CSS)
    sides[i].punchRelease = setTimeout(() => {
      sides[i].punchRelease = null;
      el.classList.remove('is-punch'); // settle ~120 ms (CSS) → 165 ms total
    }, 95);
  }

  function resetBurst(i) {
    const s = sides[i];
    if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    if (!s.burst) return;
    s.burst = null;
    stats.resets += 1;
    renderBurst(i);
  }

  // One active burst per attacking side (authority §7).
  function onHit(i, amount, critical) {
    const s = sides[i];
    if (!s.burst) s.burst = { total: 0, hits: 0, crits: 0, bigHit: 0 };
    const b = s.burst;
    b.total += amount;                    // immediate truthful total (no counting animation)
    b.hits += 1;
    if (critical) b.crits += 1;           // explicit critical=true only
    if (amount > b.bigHit) b.bigHit = amount;
    // Each positive realized hit restarts the ONE 1.20 s silence timeout.
    if (s.timer) clearTimeout(s.timer);
    s.timer = setTimeout(() => {
      s.timer = null;
      resetBurst(i);
    }, SILENCE_MS);
    stats.timerArms += 1;
    renderBurst(i);
    punch(i);
  }

  // -------------------------------------------------------------- loadout --
  function weaponCategory(id) {
    const CFG = window.APEX_ARSENAL_CONFIG;
    if (!CFG) return 'other';
    if (CFG.isGun && CFG.isGun(id)) return 'gun';
    if (CFG.isMelee && CFG.isMelee(id)) return 'melee';
    if ((CFG.SHIELD_IDS || []).includes(id)) return 'defense';
    return 'other';
  }

  function drawWeaponArt(i, weaponId) {
    const r = refs.sides[i];
    const cv = r && r.loadoutCanvas;
    if (!cv || !cv.getContext) return false;
    const av = window.APEX_ARSENAL_AV;
    // Canonical cached image (authority §8.1) — never a second asset map.
    const res = (av && av.weaponImage) ? av.weaponImage(weaponId) : null;
    const img = res && res.img;
    if (!img || !img.complete || !(img.naturalWidth || img.width)) {
      r._pending = true; // image still decoding — retried on next sync
      return false;
    }
    if (r._pending) {
      r._pending = false;
      cv.classList.add('is-swapping'); // short crossfade on state change (≈140 ms)
      setTimeout(() => cv.classList.remove('is-swapping'), 160);
    }
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const boxW = cv.clientWidth || cv.width || 240;
    const boxH = cv.clientHeight || cv.height || 120;
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const bw = Math.max(1, Math.round(boxW * dpr));
    const bh = Math.max(1, Math.round(boxH * dpr));
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    const c = cv.getContext('2d');
    c.clearRect(0, 0, bw, bh);
    const cat = weaponCategory(weaponId);
    const upright = cat === 'melee' || cat === 'defense'; // authored upright in world art
    // Contain-fit, aspect preserved (authority §8.3). P1 reads toward the
    // arena (right); P2 mirrors (left).
    const s = Math.min(bw / (upright ? ih : iw), bh / (upright ? iw : ih));
    const drawW = (upright ? ih : iw) * s;
    const drawH = (upright ? iw : ih) * s;
    c.save();
    c.translate(bw / 2, bh / 2);
    if (i === 1) c.scale(-1, 1);            // P2 mirror (blade/muzzle flips toward arena)
    if (upright) c.rotate(Math.PI / 2);     // upright-authored melee/shield → reads toward arena
    c.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    c.restore();
    stats.loadoutDraws += 1;
    return true;
  }

  function loadoutProjection(i) {
    const fs = fighterList();
    const f = fs ? fs[i] : null;
    if (!f) return null;
    const arsenal = gameStateNow() === 'ARSENAL';
    const CFG = window.APEX_ARSENAL_CONFIG;
    let key, name, family = '', tier = '', tierColor = '', weaponId = null;
    if (arsenal) {
      const h = (f.data && f.data.arsenal) || null;
      if (h && h.weaponId) {
        weaponId = h.weaponId;
        const w = (CFG && CFG.WEAPONS) ? CFG.WEAPONS[weaponId] : null;
        name = (w && w.art) || String(weaponId).replace(/_/g, ' ');
        family = (w && w.family) ? String(w.family) : '';
        tier = (CFG && CFG.tierOf) ? (CFG.tierOf(weaponId) || '') : '';
        tierColor = (CFG && CFG.TIER_COLORS && tier) ? CFG.TIER_COLORS[tier] : '';
        key = `W:${weaponId}`;
      } else {
        name = 'UNARMED';
        key = 'UNARMED';
      }
    } else {
      name = identityProjection(f).name;
      key = `F:${f.name}:${f.color || ''}`;
    }
    const ready = sides[i].energy >= ENERGY_CAP;
    return {
      key, name, family, tier, tierColor, weaponId,
      state: weaponId ? (ready ? 'SKILL READY' : 'EQUIPPED') : (arsenal ? 'UNARMED' : 'FIGHTER ID'),
      fallbackLabel: arsenal ? 'UNARMED' : 'EMBLEM',
    };
  }

  function renderLoadout(i) {
    cacheRefs();
    const r = refs.sides[i];
    if (!r || !r.loadoutName) return;
    const fs = fighterList();
    const f = fs ? fs[i] : null;
    const p = loadoutProjection(i);
    if (!f || !p) return;
    if (sides[i].loadoutKey === p.key && !r._pending) return;
    const changed = sides[i].loadoutKey !== p.key;
    sides[i].loadoutKey = p.key;
    if (r.loadoutName.textContent !== p.name) { r.loadoutName.textContent = p.name; stats.panelWrites += 1; }
    if (r.loadoutFamily && r.loadoutFamily.textContent !== p.family) { r.loadoutFamily.textContent = p.family; stats.panelWrites += 1; }
    if (r.loadoutTier) {
      r.loadoutTier.textContent = p.tier;
      r.loadoutTier.style.color = p.tierColor;
      r.loadoutTier.style.display = p.tier ? 'inline-block' : 'none';
    }
    if (r.loadoutState && r.loadoutState.textContent !== p.state) { r.loadoutState.textContent = p.state; stats.panelWrites += 1; }
    if (r.loadoutGlyph && typeof window.fighterGlyph === 'function') r.loadoutGlyph.textContent = window.fighterGlyph(f.name);
    if (p.weaponId) {
      if (r.loadoutFallback.style.display !== 'none') { r.loadoutFallback.style.display = 'none'; stats.panelWrites += 1; }
      if (r.loadoutCanvas.style.display !== 'block') { r.loadoutCanvas.style.display = 'block'; stats.panelWrites += 1; }
      if (changed) drawWeaponArt(i, p.weaponId);
    } else {
      if (r.loadoutCanvas.style.display !== 'none') { r.loadoutCanvas.style.display = 'none'; stats.panelWrites += 1; }
      if (r.loadoutFallback.style.display !== 'flex') { r.loadoutFallback.style.display = 'flex'; stats.panelWrites += 1; }
      if (r.loadoutFallbackLabel && r.loadoutFallbackLabel.textContent !== p.fallbackLabel) {
        r.loadoutFallbackLabel.textContent = p.fallbackLabel; stats.panelWrites += 1;
      }
      if (changed && r.loadoutCanvas && r.loadoutCanvas.getContext) {
        try { r.loadoutCanvas.getContext('2d').clearRect(0, 0, r.loadoutCanvas.width, r.loadoutCanvas.height); } catch (e) { /* headless */ }
      }
    }
  }

  // ------------------------------------------------------- mode slot -----
  function renderModeSlot(i) {
    cacheRefs();
    const r = refs.sides[i];
    if (!r || !r.modeSlot) return;
    const fs = fighterList();
    const p = modeProjection(i, fs && fs[i]);
    if (r.chip) {
      const chipText = gameStateNow() === 'ARSENAL' ? 'ARSENAL' : 'COMBAT';
      if (r.chip.textContent !== chipText) { r.chip.textContent = chipText; stats.panelWrites += 1; }
    }
    const text = p && p.active ? (p.skillText ? p.modeLabel + ' · ' + p.skillText : p.modeLabel) : '';
    if (r.modeSlot.textContent !== text) { r.modeSlot.textContent = text; stats.panelWrites += 1; }
  }

  function renderRobotPassive(i) {
    const fs = fighterList(), hr = window.APEX_HERO_REWORK;
    const state = hr && hr.robotPassiveHud && fs ? hr.robotPassiveHud(fs[i]) : null;
    const prefix = `p${i + 1}-robot-`, panel = $(prefix + 'passive');
    if (!panel) return;
    panel.hidden = !state;
    if (!state) return;
    const write = (key, text) => { const el = $(prefix + key); if (el && el.textContent !== text) el.textContent = text; };
    write('count', `${Math.floor(state.burst)} / ${state.next}`);
    write('progress', state.active ? `BURST ${Math.floor(state.burst)} DMG · NEXT ${state.next}` : 'BURST IDLE · RESET 1.2S');
    const refund = state.refund;
    // Never round UP to a larger claimed reduction; preserve small refunds.
    const amount = refund ? Math.floor((refund.refund + 1e-9) * 1000) / 1000 : 0;
    write('refund', refund ? `${refund.slot} −${amount}s` : (state.crossing ? `MILESTONE ${state.reached + 1}` : ''));
    panel.classList.toggle('is-punch', state.crossing);
    // Rail = progress inside the CURRENT burst only; silence empties it.
    for (let k = 0; k < 6; k++) {
      const segment = $(prefix + 'step-' + k);
      if (segment) segment.style.setProperty('--progress', `${(k < state.reached ? 1 : k === state.reached ? state.fraction : 0) * 100}%`);
    }
  }

  // ------------------------------------------------------------ sync -----
  function sync() {
    if (!cacheRefs()) return;
    const fs = fighterList();
    const hud = refs.hud;
    let visible = false;
    if (fs && fs[0] && fs[1] && hud) {
      const op = hud.style && hud.style.opacity !== '' ? parseFloat(hud.style.opacity) : (parseFloat(getComputedStyle(hud).opacity) || 0);
      visible = !!(Number.isFinite(op) && op > 0.5);
    }
    if (refs._visible !== visible) {
      refs._visible = visible;
      for (let i = 0; i < 2; i++) {
        const p = refs.sides[i].panel;
        if (!p) continue;
        const cls = 'is-battle';
        if (p.classList.contains(cls) !== visible) p.classList.toggle(cls, visible);
      }
      // Body class lets the stylesheet compact the arena budget on narrow
      // layouts without per-frame JS layout work.
      try { document.body.classList.toggle('apex-battle', visible); } catch (e) { /* headless */ }
    }
    if (!visible) return;
    // New match identity: fighters are fresh objects on every match start.
    for (let i = 0; i < 2; i++) {
      if (sides[i].fighter !== fs[i]) {
        sides[i].fighter = fs[i];
        sides[i].energy = 0;
        if (sides[i].timer) { clearTimeout(sides[i].timer); sides[i].timer = null; }
        sides[i].burst = null;
        sides[i].loadoutKey = null;
        sides[i].last = {};
        stats.resets += 1;
      }
    }
    for (let i = 0; i < 2; i++) {
      renderVitals(i);
      renderLoadout(i);
      renderEnergy(i);
      renderModeSlot(i);
      renderRobotPassive(i);
    }
  }

  // ------------------------------------------------------------- events --
  function onRealizedDamage(ev) {
    try {
      if (!ev) return;
      const victim = ev.victim;
      const attacker = ev.attacker;
      const amount = Number(ev.amount) || 0;
      if (!victim || !(amount > 0)) return; // zero/blocked/miss never extend (§7.4)
      stats.events += 1;
      const vi = sideIndexOf(victim);
      if (vi < 0) return;
      const vMax = Math.max(1, Number(victim.maxHp) || 1);
      // ENERGY B1 telemetry (authority §11): taken side always gains 0.60/1%.
      addEnergy(vi, ENERGY_TAKEN_CONST * amount / vMax);
      const ai = sideIndexOf(attacker);
      if (ai >= 0) {
        // dealt side gains 1.00/1% of the target's max HP.
        addEnergy(ai, ENERGY_DEALT_CONST * amount / vMax);
        // burst belongs to the attacking side (authority §7).
        onHit(ai, amount, !!ev.critical);
      }
      sync();
    } catch (error) {
      // A HUD failure must never break combat.
    }
  }

  function onMatchStart() {
    try {
      stats.matchStarts += 1;
      for (let i = 0; i < 2; i++) {
        sides[i].energy = 0;
        if (sides[i].timer) { clearTimeout(sides[i].timer); sides[i].timer = null; }
        sides[i].burst = null;
        sides[i].loadoutKey = null;
        sides[i].last = {};
        // Lab entry (and any rematch) must not display the last match's
        // RECENT PRESSURE after the burst state has been reset.
        renderBurst(i);
      }
      sync();
    } catch (error) {
      /* never break match start */
    }
  }

  function startInterval() {
    if (refs.interval) return;
    if (typeof setInterval !== 'function') return;
    refs.interval = setInterval(() => { try { sync(); } catch (e) { /* headless safety */ } }, RECONCILE_MS);
  }

  // ------------------------------------------------------------ public --
  function sideProjection(i) {
    const fs = fighterList();
    const f = fs && fs[i];
    if (!f) return null;
    const hr = window.APEX_HERO_REWORK;
    return {
      side: i + 1,
      identity: identityProjection(f),
      vitals: vitalsProjection(f),
      energy: sides[i].energy,
      burst: sides[i].burst ? { ...sides[i].burst } : null,
      loadout: loadoutProjection(i),
      mode: modeProjection(i, f),
      robotPassive: hr && hr.robotPassiveHud ? hr.robotPassiveHud(f) : null,
    };
  }

  function projection() {
    return { gameState: gameStateNow(), visible: !!refs._visible, sides: [sideProjection(0), sideProjection(1)] };
  }

  window.APEX_COMBAT_HUD = {
    version: 'authority-r42',
    SILENCE_MS,
    TIERS,
    TIER_COLOR,
    commentaryFor,
    onRealizedDamage,
    onMatchStart,
    onProjectionChanged() { sync(); },
    syncVitals() { for (let i = 0; i < 2; i++) renderVitals(i); },
    sync,
    projection,
    stats,
    debug() {
      return {
        sides: sides.map((s) => ({
          energy: s.energy,
          burst: s.burst ? { total: s.burst.total, hits: s.burst.hits, crits: s.burst.crits, bigHit: s.burst.bigHit } : null,
          loadoutKey: s.loadoutKey,
        })),
      };
    },
    _test: {
      resetBurst: resetBurst,
      forceExpire(i) { if (sides[i].timer) { clearTimeout(sides[i].timer); sides[i].timer = null; } resetBurst(i); },
      setBurst(i, burst) {
        if (sides[i].timer) { clearTimeout(sides[i].timer); sides[i].timer = null; }
        sides[i].burst = burst ? { total: burst.total || 0, hits: burst.hits || 0, crits: burst.crits || 0, bigHit: burst.bigHit || 0 } : null;
        renderBurst(i);
      },
      setEnergy(i, v) { sides[i].energy = Math.max(0, Math.min(ENERGY_CAP, Number(v) || 0)); renderEnergy(i); },
      sync,
    },
  };
  window.apexCombatHudRuntime = 'ready';
  startInterval();
  sync();
})();
