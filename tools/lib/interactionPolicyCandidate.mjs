// CP3 shadow candidate ONLY. This module is never loaded by product runtimes.
export function installShadowQuery(CapabilityAuthority) {
  /* ------------------------------------------------------------------ *
   * CP3: read-only interaction query adapter on the EXISTING capability
   * authority. No gameplay consumer is migrated in this checkpoint.
   *
   * Explicit context injection keeps AIL engine-agnostic. "unresolved"
   * means unsupported/unregistered content, never an implicit permission.
   * This function does not adjudicate collision geometry, ownership,
   * damage, TOI, hero cooldowns or presentation.
   * ------------------------------------------------------------------ */
  CapabilityAuthority.query = function queryInteraction(action, target, context = {}) {
    const result = (status, reason) => Object.freeze({ status, reason });
    if (!target || typeof target !== 'object') return result('unresolved', 'missing-target');
    const config = context.config;
    const id = typeof target.weapon === 'string' ? target.weapon : target.weaponId;
    const weapon = config && config.WEAPONS && config.WEAPONS[id];
    const special = config && config.V43_WEAPONS && config.V43_WEAPONS[id];
    const known = !!(weapon || special);
    const t6 = this.isT6(target) || id === 'T6' || id === 'STORMBREAKER';

    if (action.startsWith('hero-object:')) {
      const kind = action.slice('hero-object:'.length);
      const supported = ['graph', 'gate-x2', 'gate-div2', 'singularity',
        'mirror', 'reflect', 'capture', 'dodge', 'weak'];
      if (!supported.includes(kind)) return result('unresolved', 'unknown-hero-action');
      return result(this.allows(kind, target) ? 'allowed' : 'denied', 'legacy-ail-t6-law');
    }

    if (action === 'magnet-projectile') {
      if (!config || typeof config.isGun !== 'function') return result('unresolved', 'missing-config');
      if (!id || !known) return result('unresolved', 'unregistered-weapon');
      if (target.aq !== true || !(target.life > 0) || t6 || target.__hr?.cryHold)
        return result('denied', 'inactive-held-or-t6');
      if (target.type === 'aq_bullet')
        return result(config.isGun(id) ? 'allowed' : 'denied', 'ordinary-gun-law');
      if (target.type !== 'aq_v43') return result('denied', 'unsupported-projectile-family');
      if (!special) return result('denied', 'not-a-v43-special');
      if (!Array.isArray(special.magnetizableKinds))
        return result('unresolved', 'missing-v43-magnet-tags');
      if (special.tier === 'T6') return result('denied', 't6-special');
      if (!special.magnetizableKinds.includes(target.kind))
        return result('denied', 'non-kinetic-kind');
      if (target.kind === 'mine' && target.phase !== 'flight')
        return result('denied', 'stationary-mine');
      return result('allowed', 'physical-v43-projectile');
    }

    if (action === 'magnet-revealed-slot') {
      if (!config || typeof config.isGun !== 'function') return result('unresolved', 'missing-config');
      if (!id || !known) return result('unresolved', 'unregistered-weapon');
      const specialFloor = !!special && special.tier !== 'T6'
        && context.weapons?.[id]?.category === 'ranged';
      const ok = target.phase === 'REVEALED' && target.kind !== 'HEAL'
        && !t6 && (config.isGun(id) || specialFloor);
      return result(ok ? 'allowed' : 'denied', 'magnet-floor-gun-law');
    }

    if (action === 'frost-freezable-equipment') {
      const defs = context.weapons;
      if (!defs || typeof defs !== 'object') return result('unresolved', 'missing-equipment-definitions');
      if (!id || !defs[id]) return result('unresolved', 'unregistered-equipment');
      const ok = target.kind !== 'HEAL' && id !== 'GRENADE'
        && !t6 && target.tier !== 'T6' && defs[id].category === 'ranged';
      return result(ok ? 'allowed' : 'denied', 'frost-ranged-holder-law');
    }

    if (action === 'mirror-f2-projectile') {
      if (typeof context.matchActive !== 'boolean') return result('unresolved', 'missing-match-state');
      if (!config || !id || !known) return result('unresolved', 'unregistered-weapon-or-config');
      if (!context.matchActive || !target.aq || t6) return result('denied', 'inactive-or-t6');
      const ok = target.type === 'aq_bullet' || target.type === 'aq_grenade'
        || (target.type === 'aq_thrown' && target.state === 'flight');
      return result(ok ? 'allowed' : 'denied', 'mirror-f2-current-family-law');
    }

    if (action === 'v43-reflection-tag') {
      if (!config || !id || !known) return result('unresolved', 'unregistered-weapon-or-config');
      if (target.type !== 'aq_v43' || t6) return result('denied', 'not-a-reflectable-v43-body');
      if (!special) return result('denied', 'not-a-v43-special');
      if (!Array.isArray(special.reflectableKinds))
        return result('unresolved', 'missing-v43-reflection-tags');
      // ONLY the declared kind. Actual Crystal/Swirl execution also needs
      // ordered collision, direction, ownership and live-phase predicates.
      return result(special.reflectableKinds.includes(target.kind) ? 'allowed' : 'denied',
        'v43-reflection-kind-tag-only');
    }
    return result('unresolved', 'unknown-interaction-action');
  };

  return CapabilityAuthority.query;
}
