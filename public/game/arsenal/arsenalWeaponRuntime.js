// ARSENAL QUEST P0 — weapon registry + holder-state runtime (handoff §7, §9).
// Data-driven definitions; no scattered string-conditionals in the engine.
// Reuses Apex globals: projectiles, particles, floatingTexts, shockwaves, cameraShake,
// hitStop, FloatingText, emitParticles, spawnShockwave, triggerFlash, playFighterSound.
(function apexArsenalWeaponRuntime() {
  if (window.apexArsenalWeaponRuntime === 'ready') return;
  const AQ = window.APEX_ARSENAL;
  const CFG = window.APEX_ARSENAL_CONFIG;
  const log = (event, fields) => AQ.log(event, fields);

  // ---------------------------------------------------------------------------
  // Holder state (handoff §9): one object answers weapon id / phase / ammo /
  // elapsed timers / consumed flag. Lives on fighter.data.arsenal.
  // ---------------------------------------------------------------------------
  function getHolder(f) { return (f && f.data && f.data.arsenal) || null; }

  function makeCtx(f) {
    const enemy = (typeof fighters !== 'undefined' && fighters)
      ? fighters.find(q => q && q !== f) || null
      : null;
    return { fighter: f, enemy, holder: getHolder(f), api: weaponApi };
  }

  function equip(f, weaponId) {
    const def = WEAPONS[weaponId];
    if (!f || f.hp <= 0 || !def) return false;
    f.data.arsenal = {
      weaponId,
      def,
      phase: 'READY',
      elapsed: 0,
      shotsFired: 0,
      consumed: false,
      meta: {},
    };
    if (def.onEquip) def.onEquip(makeCtx(f));
    playFighterSound(f, 'wall');
    floatingTexts.push(new FloatingText(f.x, f.y - f.radius - 78, weaponId.replace(/_/g, ' '), defColor(def)));
    window.avCue('pickup', { x: f.x, y: f.y, weapon: weaponId });
    return true;
  }

  function consume(f, reason) {
    const h = getHolder(f);
    if (!h) return;
    h.consumed = true;
    if (h.def.cleanup) { try { h.def.cleanup(makeCtx(f)); } catch (error) { console.warn('[AQ] weapon cleanup failed', h.weaponId, error); } }
    f.data.arsenal = null; // holder returns to UNARMED; no stale owner/target refs remain
    log('CONSUME', `fighter=${f.name} weapon=${h.weaponId}${reason ? ` reason=${reason}` : ''}`);
  }

  function defColor(def) {
    return def.category === 'ranged' ? '#ffd479' : def.category === 'melee' ? '#ff9d7a' : '#9fd8ff';
  }

  // ---------------------------------------------------------------------------
  // Damage pipeline — single entry point so Tower Shield / logging / feedback
  // stay consistent (handoff §8 reuse policy).
  // ---------------------------------------------------------------------------
  function aqDamage(target, amount, source, weaponId, opts = {}) {
    if (!target || target.hp <= 0 || !(amount > 0)) return 0;
    let mult = 1;
    const th = getHolder(target);
    if (th && th.weaponId === 'TOWER_SHIELD' && th.phase === 'GUARD') {
      mult = CFG.WEAPONS.TOWER_SHIELD.damageTakenMult;
      floatingTexts.push(new FloatingText(target.x, target.y - target.radius - 104, 'GUARDED', '#9fd8ff'));
      emitParticles(target.x, target.y, '#9fd8ff', 10, 200, 4, 0.35, 'square');
      const srcAngle = source && source !== target ? Math.atan2(source.y - target.y, source.x - target.x) : 0;
      window.avCue('tower_block', { x: target.x + Math.cos(srcAngle) * target.radius, y: target.y + Math.sin(srcAngle) * target.radius, angle: srcAngle, heavy: amount >= 10 });
    }
    const dealt = amount * mult;
    target.takeDamage(dealt, source && source !== target ? source : null, `arsenal-${(weaponId || 'unknown').toLowerCase()}`, !!opts.statusDamage);
    if (opts.knockback && source && source !== target && target.hp > 0) {
      const n = norm(target.x - source.x || 1, target.y - source.y);
      target.applyStatus('push', 0.18, { x: n.x, y: n.y, strength: opts.knockback });
    }
    if (opts.stun && target.hp > 0) target.applyStatus('stun', opts.stun, {});
    if (opts.shake) cameraShake = Math.max(cameraShake, opts.shake);
    if (opts.hitStop) hitStop = Math.max(hitStop, opts.hitStop);
    log('HIT', `source=${(source && source.name) || 'world'} target=${target.name} weapon=${weaponId || 'world'} damage=${dealt.toFixed(1)}`);
    return dealt;
  }

  // ---------------------------------------------------------------------------
  // Projectile helpers — Arsenal projectiles live in the shared global
  // `projectiles` collection with aq_* types (handoff §8). Movement/hit logic
  // is in updateArsenalProjectiles below; life/cleanup reuse the engine path.
  // ---------------------------------------------------------------------------
  function fireBullet(spec) {
    const { owner, x, y, angle, speed, damage, weapon } = spec;
    projectiles.push({
      type: 'aq_bullet',
      aq: true,
      owner,
      weapon,
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: spec.radius || 7,
      damage,
      life: spec.life || 2.2,
      maxLife: spec.life || 2.2,
      knockback: spec.knockback || 0,
      stun: spec.stun || 0,
      color: spec.color || (owner && owner.color) || '#ffffff',
    });
  }

  function throwGrenade(spec) {
    const { owner, x, y, angle, speed, weapon } = spec;
    projectiles.push({
      type: 'aq_grenade',
      aq: true,
      owner,
      weapon,
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 16,
      fuse: CFG.WEAPONS.GRENADE.fuse,
      life: CFG.WEAPONS.GRENADE.fuse + 0.6,
      maxLife: CFG.WEAPONS.GRENADE.fuse + 0.6,
      color: '#6d8f4e',
    });
  }

  function explodeGrenade(p) {
    const spec = CFG.WEAPONS.GRENADE;
    for (const f of fighters) {
      if (!f || f.hp <= 0 || f === p.owner) continue;
      const d = dist(p.x, p.y, f.x, f.y);
      if (d > spec.blastRadius + f.radius * 0.4) continue;
      const falloff = clamp(1 - d / (spec.blastRadius + f.radius * 0.4), 0, 1);
      aqDamage(f, spec.maxDamage * falloff, p.owner, p.weapon || 'GRENADE', { knockback: spec.knockback * falloff, shake: 14, hitStop: 0.05 });
    }
    spawnShockwave(p.x, p.y, '#ffb347', 260);
    triggerFlash(255, 170, 60, 0.22);
    emitParticles(p.x, p.y, '#ffcf7a', 42, 620, 8, 0.7, 'square');
    emitParticles(p.x, p.y, '#8a5a2b', 26, 380, 6, 0.9, 'friction');
    playFighterSound(p.owner || 'VOLCANO', 'skill');
    window.avCue('explosion', { x: p.x, y: p.y });
    log('EXPLODE', `weapon=GRENADE x=${Math.round(p.x)} y=${Math.round(p.y)}`);
    p.life = 0;
  }

  // Per-frame movement/hit resolution for aq_* projectiles.
  function updateArsenalProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (!p || !p.aq) continue;
      if (p.type === 'aq_bullet') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -20 || p.x > GAME_SIZE + 20 || p.y < -20 || p.y > GAME_SIZE + 20) { p.life = 0; continue; }
        const target = fighters.find(f => f && f !== p.owner && f.hp > 0);
        if (target && dist(p.x, p.y, target.x, target.y) < target.radius * CFG.BULLET_HIT_RADIUS_SCALE + p.radius) {
          aqDamage(target, p.damage, p.owner, p.weapon, { knockback: p.knockback, stun: p.stun });
          emitParticles(p.x, p.y, p.color, 12, 300, 4, 0.35, 'square');
          p.life = 0;
        }
        continue;
      }
      if (p.type === 'aq_grenade') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // Bounce off arena walls until the fuse burns out.
        if (p.x < p.radius) { p.x = p.radius; p.vx = Math.abs(p.vx); }
        if (p.x > GAME_SIZE - p.radius) { p.x = GAME_SIZE - p.radius; p.vx = -Math.abs(p.vx); }
        if (p.y < p.radius) { p.y = p.radius; p.vy = Math.abs(p.vy); }
        if (p.y > GAME_SIZE - p.radius) { p.y = GAME_SIZE - p.radius; p.vy = -Math.abs(p.vy); }
        p.fuse -= dt;
        if (p.fuse <= 0) explodeGrenade(p);
        continue;
      }
    }
  }

  // Presentation for aq projectiles; injected ahead of the engine draw pass.
  function drawArsenalProjectiles(ctx) {
    for (const p of projectiles) {
      if (!p || !p.aq) continue;
      ctx.save();
      if (p.type === 'aq_bullet') {
        const a = clamp(p.life / p.maxLife, 0.35, 1);
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillStyle = p.color;
        ctx.strokeStyle = '#141008';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 1.7, p.radius * 0.85, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff8e0';
        ctx.beginPath();
        ctx.arc(p.radius * 0.7, 0, p.radius * 0.34, 0, TAU);
        ctx.fill();
      } else if (p.type === 'aq_grenade') {
        ctx.translate(p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = '#20280f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, TAU);
        ctx.fill();
        ctx.stroke();
        const blink = p.fuse < 0.5 && Math.floor(p.fuse * 12) % 2 === 0;
        ctx.fillStyle = blink ? '#ff5a3c' : '#c8b26a';
        ctx.beginPath();
        ctx.arc(0, -p.radius - 5, 5, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // Shared activation helpers
  // ---------------------------------------------------------------------------
  function enemyAlive(ctx) { return !!(ctx.enemy && ctx.enemy.hp > 0); }
  function enemyDistance(ctx) { return enemyAlive(ctx) ? dist(ctx.fighter.x, ctx.fighter.y, ctx.enemy.x, ctx.enemy.y) : Infinity; }
  function angleToEnemy(ctx) { return Math.atan2(ctx.enemy.y - ctx.fighter.y, ctx.enemy.x - ctx.fighter.x); }
  function aimAtHolder(ctx) { ctx.fighter.setDir(Math.cos(angleToEnemy(ctx)), Math.sin(angleToEnemy(ctx))); }
  function pushVisual(visual) {
    const state = AQ.state;
    if (!state || !state.visuals) return;
    state.visuals.push(visual);
    if (state.visuals.length > 24) state.visuals.shift();
  }

  // Melee strike geometry: cone + reach around holder facing (handoff §7).
  function strikeCone(ctx, spec, weaponId, extra = {}) {
    const { fighter: f, enemy: e } = ctx;
    let hit = false;
    if (enemyAlive(ctx)) {
      const d = dist(f.x, f.y, e.x, e.y);
      const ang = Math.atan2(e.y - f.y, e.x - f.x);
      let diff = Math.abs(ang - Math.atan2(f.dir.y, f.dir.x));
      if (diff > Math.PI) diff = TAU - diff;
      if (d <= spec.reach + e.radius * 0.35 && diff <= spec.halfAngle) {
        aqDamage(e, spec.damage, f, weaponId, { knockback: spec.knockback, stun: spec.stun, shake: spec.shake || 7, hitStop: spec.hitStop });
        hit = true;
      }
    }
    // Curated slash VFX + SFX come from the presentation layer (avCue melee_*).
    return hit;
  }

  function makeMelee(id, spriteKey, color, extra = {}) {
    const spec = CFG.WEAPONS[id];
    return {
      id,
      category: 'melee',
      spriteKey,
      // Critical rule: melee is NOT consumed on pickup; it waits for valid
      // activation geometry (opponent inside trigger range).
      onEquip(ctx) { ctx.holder.phase = 'READY'; },
      canActivate(ctx) { return ctx.holder.phase === 'READY' && enemyAlive(ctx) && enemyDistance(ctx) <= spec.triggerRange; },
      activate(ctx) {
        const h = ctx.holder;
        h.phase = 'WINDUP';
        h.meta.windupLeft = spec.windup;
        aimAtHolder(ctx);
        log('USE', `fighter=${ctx.fighter.name} weapon=${id}`);
        if (spec.windup > 0.3) {
          pushVisual({ kind: 'windup', x: ctx.fighter.x, y: ctx.fighter.y, owner: ctx.fighter, life: spec.windup, maxLife: spec.windup, color });
        }
      },
      update(ctx, dt) {
        const h = ctx.holder;
        if (h.phase !== 'WINDUP') return;
        h.meta.windupLeft -= dt;
        if (h.meta.windupLeft <= 0) {
          h.phase = 'STRIKE';
          window.avCue('melee_swing', { weapon: id, x: ctx.fighter.x, y: ctx.fighter.y, angle: Math.atan2(ctx.fighter.dir.y, ctx.fighter.dir.x) });
          const landed = strikeCone(ctx, spec, id, { color });
          if (landed) window.avCue('melee_hit', { weapon: id, x: ctx.enemy.x, y: ctx.enemy.y });
          consume(ctx.fighter, 'melee-resolved');
        }
      },
      ...extra,
    };
  }

  function makeGun(id, spriteKey, color, extra = {}) {
    const spec = CFG.WEAPONS[id];
    return {
      id,
      category: 'ranged',
      spriteKey,
      onEquip(ctx) { ctx.holder.phase = 'READY'; },
      canActivate(ctx) {
        return ctx.holder.phase === 'READY'
          && enemyAlive(ctx)
          && ctx.holder.elapsed >= CFG.RANGED_READY_DELAY_SECONDS
          && (!spec.triggerRange || enemyDistance(ctx) <= spec.triggerRange);
      },
      activate(ctx) {
        const h = ctx.holder;
        h.phase = 'FIRING';
        h.meta.nextShot = 0;
        log('USE', `fighter=${ctx.fighter.name} weapon=${id}`);
      },
      update(ctx, dt) {
        const h = ctx.holder;
        if (h.phase !== 'FIRING') return;
        const f = ctx.fighter;
        h.meta.nextShot -= dt;
        let fired = false;
        while (h.meta.nextShot <= 0 && h.shotsFired < spec.shots) {
          const spread = (Math.random() * 2 - 1) * spec.spread;
          const angle = enemyAlive(ctx) ? angleToEnemy(ctx) + spread : Math.atan2(f.dir.y, f.dir.x) + spread;
          window.avCue('fire', { weapon: id, x: f.x + Math.cos(angle) * (f.radius * 0.95), y: f.y + Math.sin(angle) * (f.radius * 0.95), angle });
          fireBullet({
            owner: f,
            x: f.x + Math.cos(angle) * (f.radius * 0.7),
            y: f.y + Math.sin(angle) * (f.radius * 0.7),
            angle,
            speed: spec.bulletSpeed,
            damage: spec.damagePerShot,
            radius: spec.bulletRadius,
            life: spec.bulletLife,
            weapon: id,
            knockback: spec.knockback,
            color,
          });
          h.shotsFired += 1;
          h.meta.nextShot += spec.interval;
          fired = true;
        }
        if (fired) {
          cameraShake = Math.max(cameraShake, 3);
          playFighterSound(f, 'skill');
        }
        if (h.shotsFired >= spec.shots && h.meta.nextShot <= 0) consume(f, 'sequence-complete');
      },
      ...extra,
    };
  }

  // ---------------------------------------------------------------------------
  // The 12 P0 weapons (handoff §7). Sprite keys per P0_ASSET_MANIFEST.csv.
  // ---------------------------------------------------------------------------
  const WEAPONS = {
    PISTOL: makeGun('PISTOL', 'G01_pistol', '#ffe08a'),

    SHOTGUN: (() => {
      const spec = CFG.WEAPONS.SHOTGUN;
      return {
        id: 'SHOTGUN',
        category: 'ranged',
        spriteKey: 'G03_shotgun',
        onEquip(ctx) { ctx.holder.phase = 'READY'; },
        canActivate(ctx) {
          return ctx.holder.phase === 'READY'
            && enemyAlive(ctx)
            && ctx.holder.elapsed >= CFG.RANGED_READY_DELAY_SECONDS
            && enemyDistance(ctx) <= spec.triggerRange;
        },
        activate(ctx) {
          const h = ctx.holder;
          h.phase = 'FIRING';
          const f = ctx.fighter;
          const base = angleToEnemy(ctx);
          for (let i = 0; i < spec.pellets; i++) {
            const t = spec.pellets === 1 ? 0.5 : i / (spec.pellets - 1);
            const angle = base + (t - 0.5) * spec.cone;
            fireBullet({
              owner: f,
              x: f.x + Math.cos(angle) * (f.radius * 0.7),
              y: f.y + Math.sin(angle) * (f.radius * 0.7),
              angle,
              speed: spec.bulletSpeed * (0.92 + Math.random() * 0.16),
              damage: spec.damagePerPellet,
              radius: spec.bulletRadius,
              life: spec.bulletLife,
              weapon: 'SHOTGUN',
              knockback: spec.knockback / spec.pellets,
              color: '#ffbe6b',
            });
          }
          window.avCue('fire', { weapon: 'SHOTGUN', x: f.x + Math.cos(base) * (f.radius * 0.95), y: f.y + Math.sin(base) * (f.radius * 0.95), angle: base });
          spawnShockwave(f.x, f.y, '#ffbe6b', 130);
          cameraShake = Math.max(cameraShake, 9);
          hitStop = Math.max(hitStop, 0.03);
          playFighterSound(f, 'skill');
          log('USE', `fighter=${f.name} weapon=SHOTGUN`);
          h.shotsFired = 1;
          consume(f, 'blast-resolved');
        },
        update() {},
      };
    })(),

    SMG: makeGun('SMG', 'G05_smg', '#b9f6ca'),

    SNIPER: (() => {
      const spec = CFG.WEAPONS.SNIPER;
      return {
        id: 'SNIPER',
        category: 'ranged',
        spriteKey: 'G08_sniper_rifle',
        onEquip(ctx) { ctx.holder.phase = 'READY'; },
        canActivate(ctx) {
          return ctx.holder.phase === 'READY' && enemyAlive(ctx) && ctx.holder.elapsed >= CFG.RANGED_READY_DELAY_SECONDS;
        },
        activate(ctx) {
          const h = ctx.holder;
          h.phase = 'AIM';
          h.meta.aimLeft = spec.aimTime;
          log('USE', `fighter=${ctx.fighter.name} weapon=SNIPER`);
          playFighterSound(ctx.fighter, 'skill');
          window.avCue('sniper_aim', { x: ctx.fighter.x, y: ctx.fighter.y, angle: enemyAlive(ctx) ? angleToEnemy(ctx) : Math.atan2(ctx.fighter.dir.y, ctx.fighter.dir.x) });
        },
        update(ctx, dt) {
          const h = ctx.holder;
          const f = ctx.fighter;
          if (h.phase === 'AIM') {
            // Visible aim telegraph so the shot feels dangerous before firing.
            if (enemyAlive(ctx)) {
              aimAtHolder(ctx);
              pushVisual({ kind: 'aimline', x1: f.x, y1: f.y, x2: ctx.enemy.x, y2: ctx.enemy.y, life: 0.06, maxLife: 0.06, color: '#ff4a4a' });
            }
            h.meta.aimLeft -= dt;
            if (h.meta.aimLeft <= 0) {
              const angle = enemyAlive(ctx) ? angleToEnemy(ctx) : Math.atan2(f.dir.y, f.dir.x);
              fireBullet({
                owner: f,
                x: f.x + Math.cos(angle) * (f.radius * 0.7),
                y: f.y + Math.sin(angle) * (f.radius * 0.7),
                angle,
                speed: spec.bulletSpeed,
                damage: spec.damage,
                radius: spec.bulletRadius,
                life: spec.bulletLife,
                weapon: 'SNIPER',
                knockback: spec.knockback,
                color: '#f4f4f4',
              });
              cameraShake = Math.max(cameraShake, 8);
              triggerFlash(255, 250, 235, 0.12);
              playFighterSound(f, 'skill');
              window.avCue('sniper_shot', { x: f.x + Math.cos(angle) * (f.radius * 0.95), y: f.y + Math.sin(angle) * (f.radius * 0.95), angle });
              consume(f, 'shot-fired');
            }
          }
        },
      };
    })(),

    GRENADE: (() => {
      const spec = CFG.WEAPONS.GRENADE;
      return {
        id: 'GRENADE',
        category: 'ranged',
        spriteKey: 'G10_grenade',
        onEquip(ctx) { ctx.holder.phase = 'READY'; },
        canActivate(ctx) { return ctx.holder.phase === 'READY' && enemyAlive(ctx) && ctx.holder.elapsed >= CFG.RANGED_READY_DELAY_SECONDS; },
        activate(ctx) {
          const f = ctx.fighter;
          const angle = angleToEnemy(ctx);
          // Lob so the grenade lands near the target around fuse time; walls
          // still bounce it when the arena geometry gets in the way.
          const targetDist = enemyDistance(ctx);
          const lobSpeed = clamp((targetDist / spec.fuse) * 0.8, 240, spec.throwSpeed);
          throwGrenade({
            owner: f,
            x: f.x + Math.cos(angle) * (f.radius * 0.7),
            y: f.y + Math.sin(angle) * (f.radius * 0.7),
            angle,
            speed: lobSpeed,
            weapon: 'GRENADE',
          });
          log('USE', `fighter=${f.name} weapon=GRENADE`);
          playFighterSound(f, 'skill');
          window.avCue('grenade_throw', { x: f.x + Math.cos(angle) * (f.radius * 0.95), y: f.y + Math.sin(angle) * (f.radius * 0.95), angle });
          // Consumed immediately after throw; grenade stays in world until it resolves.
          consume(f, 'thrown');
        },
        update() {},
      };
    })(),

    SABRE: makeMelee('SABRE', 'M01_sabre', '#c9e6ff'),
    BATTLE_AXE: makeMelee('BATTLE_AXE', 'M04_battle_axe', '#ffb3a0'),

    DAGGER: (() => {
      const spec = CFG.WEAPONS.DAGGER;
      return {
        id: 'DAGGER',
        category: 'melee',
        spriteKey: 'M08_dagger',
        onEquip(ctx) { ctx.holder.phase = 'READY'; },
        canActivate(ctx) {
          return ctx.holder.phase === 'READY' && enemyAlive(ctx) && enemyDistance(ctx) <= spec.triggerRange;
        },
        activate(ctx) {
          const h = ctx.holder;
          h.phase = 'DASH';
          h.meta.dashLeft = spec.dashTime;
          h.meta.hitDone = false;
          aimAtHolder(ctx);
          log('USE', `fighter=${ctx.fighter.name} weapon=DAGGER`);
          playFighterSound(ctx.fighter, 'skill');
          window.avCue('melee_swing', { weapon: 'DAGGER', x: ctx.fighter.x, y: ctx.fighter.y, angle: Math.atan2(ctx.fighter.dir.y, ctx.fighter.dir.x) });
        },
        update(ctx, dt) {
          const h = ctx.holder;
          if (h.phase !== 'DASH') return;
          const f = ctx.fighter;
          f.x += f.dir.x * spec.dashSpeed * dt;
          f.y += f.dir.y * spec.dashSpeed * dt;
          f.x = clamp(f.x, f.radius, GAME_SIZE - f.radius);
          f.y = clamp(f.y, f.radius, GAME_SIZE - f.radius);
          // Precise hitbox, but it must account for the Apex body volumes so a
          // dash that reaches the opponent always connects.
          if (!h.meta.hitDone && enemyAlive(ctx) && dist(f.x, f.y, ctx.enemy.x, ctx.enemy.y) < ctx.enemy.radius + f.radius * 0.6 + spec.hitBonus) {
            h.meta.hitDone = true;
            aqDamage(ctx.enemy, spec.damage, f, 'DAGGER', { shake: 5 });
            emitParticles(ctx.enemy.x, ctx.enemy.y, '#e8f4ff', 16, 340, 4, 0.4, 'square');
            window.avCue('melee_hit', { weapon: 'DAGGER', x: ctx.enemy.x, y: ctx.enemy.y });
          }
          h.meta.dashLeft -= dt;
          if (h.meta.dashLeft <= 0) consume(f, h.meta.hitDone ? 'stab-landed' : 'stab-whiffed');
        },
      };
    })(),

    SPEAR: makeMelee('SPEAR', 'M10_spear', '#d9ffb3'),
    SPIKED_CLUB: makeMelee('SPIKED_CLUB', 'M12_spiked_club', '#e6c9ff'),

    SWIRL_SHIELD: (() => {
      const spec = CFG.WEAPONS.SWIRL_SHIELD;
      return {
        id: 'SWIRL_SHIELD',
        category: 'defense',
        spriteKey: 'D03_swirl_shield',
        onEquip(ctx) {
          ctx.holder.phase = 'GUARD';
          ctx.holder.meta.timer = spec.duration;
          log('USE', `fighter=${ctx.fighter.name} weapon=SWIRL_SHIELD`);
          window.avCue('shield_activate', { weapon: 'SWIRL_SHIELD', x: ctx.fighter.x, y: ctx.fighter.y });
        },
        canActivate() { return false; },
        activate() {},
        update(ctx, dt) {
          const h = ctx.holder;
          const f = ctx.fighter;
          if (h.phase !== 'GUARD') return;
          h.meta.timer -= dt;
          // Reflect the first eligible hostile projectile that comes close.
          for (const p of projectiles) {
            if (!p || p.type !== 'aq_bullet' || !p.owner || p.owner === f || p.aqReflected) continue;
            if (dist(p.x, p.y, f.x, f.y) > spec.reflectRadius + p.radius) continue;
            const toHolder = { x: f.x - p.x, y: f.y - p.y };
            if (p.vx * toHolder.x + p.vy * toHolder.y <= 0) continue; // moving away
            const originalOwner = p.owner;
            const speed = Math.hypot(p.vx, p.vy) || 700;
            p.owner = f; // ownership switches to the reflector
            p.aqReflected = true;
            const back = norm(originalOwner.x - p.x || 1, originalOwner.y - p.y);
            p.vx = back.x * speed * 1.08;
            p.vy = back.y * speed * 1.08;
            window.avCue('reflect', { x: p.x, y: p.y, angle: Math.atan2(back.y, back.x) });
            spawnShockwave(p.x, p.y, '#9fe8ff', 150);
            emitParticles(p.x, p.y, '#cff4ff', 20, 380, 5, 0.5, 'square');
            floatingTexts.push(new FloatingText(f.x, f.y - f.radius - 92, 'REFLECT', '#9fe8ff'));
            cameraShake = Math.max(cameraShake, 6);
            playFighterSound(f, 'skill');
            log('REFLECT', `fighter=${f.name} weapon=SWIRL_SHIELD projectileFrom=${originalOwner.name}`);
            consume(f, 'reflect-resolved');
            return;
          }
          if (h.meta.timer <= 0) consume(f, 'expired');
        },
      };
    })(),

    TOWER_SHIELD: (() => {
      const spec = CFG.WEAPONS.TOWER_SHIELD;
      return {
        id: 'TOWER_SHIELD',
        category: 'defense',
        spriteKey: 'D07_tower_shield',
        onEquip(ctx) {
          ctx.holder.phase = 'GUARD';
          ctx.holder.meta.timer = spec.duration;
          log('USE', `fighter=${ctx.fighter.name} weapon=TOWER_SHIELD`);
          window.avCue('shield_activate', { weapon: 'TOWER_SHIELD', x: ctx.fighter.x, y: ctx.fighter.y });
        },
        canActivate() { return false; },
        activate() {},
        update(ctx, dt) {
          const h = ctx.holder;
          const f = ctx.fighter;
          if (h.phase !== 'GUARD') return;
          h.meta.timer -= dt;
          // Movement penalty while the fortress state is up (engine slow status).
          f.applyStatus('slow', 0.25, { mult: spec.speedMult });
          if (h.meta.timer <= 0) consume(f, 'expired');
        },
      };
    })(),
  };

  // ---------------------------------------------------------------------------
  // Per-frame holder driver — called by the mode runtime for each fighter.
  // ---------------------------------------------------------------------------
  function updateHolder(f, dt) {
    const h = getHolder(f);
    if (!h || f.hp <= 0) return;
    h.elapsed += dt;
    const ctx = makeCtx(f);
    ctx.holder = h;
    if (h.phase === 'READY' && h.def.canActivate && h.def.canActivate(ctx)) {
      h.def.activate(ctx);
    }
    if (h.def.update) h.def.update(ctx, dt);
  }

  // World-space presentation for transient weapon visuals (slashes, aim lines).
  function drawArsenalVisuals(ctx) {
    const state = AQ.state;
    if (!state || !state.visuals) return;
    for (const v of state.visuals) {
      const a = clamp(v.life / v.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      if (v.kind === 'slash') {
        ctx.translate(v.x, v.y);
        ctx.rotate(v.angle);
        ctx.strokeStyle = v.color;
        ctx.lineWidth = 16 * a + 4;
        ctx.beginPath();
        ctx.arc(0, 0, v.reach * 0.8, -v.halfAngle, v.halfAngle);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4 * a + 1;
        ctx.stroke();
      } else if (v.kind === 'aimline') {
        ctx.strokeStyle = v.color;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([14, 10]);
        ctx.beginPath();
        ctx.moveTo(v.x1, v.y1);
        ctx.lineTo(v.x2, v.y2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(v.x2, v.y2, 26, 0, TAU);
        ctx.moveTo(v.x2 - 38, v.y2);
        ctx.lineTo(v.x2 + 38, v.y2);
        ctx.moveTo(v.x2, v.y2 - 38);
        ctx.lineTo(v.x2, v.y2 + 38);
        ctx.stroke();
      } else if (v.kind === 'windup') {
        const owner = v.owner;
        if (owner) {
          const t = 1 - clamp(v.life / v.maxLife, 0, 1);
          ctx.translate(owner.x, owner.y);
          ctx.rotate(Math.atan2(owner.dir.y, owner.dir.x));
          ctx.strokeStyle = v.color;
          ctx.lineWidth = 9;
          ctx.beginPath();
          ctx.arc(0, 0, owner.radius + 34, -1.1 + t * 0.5, 1.1 - t * 0.5);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  function tickVisuals(dt) {
    const state = AQ.state;
    if (!state || !state.visuals) return;
    for (let i = state.visuals.length - 1; i >= 0; i--) {
      state.visuals[i].life -= dt;
      if (state.visuals[i].life <= 0) state.visuals.splice(i, 1);
    }
  }

  const weaponApi = {
    getHolder,
    equip,
    consume,
    aqDamage,
    fireBullet,
    throwGrenade,
    explodeGrenade,
    updateArsenalProjectiles,
    drawArsenalProjectiles,
    drawArsenalVisuals,
    tickVisuals,
    updateHolder,
    strikeCone,
    makeCtx,
  };

  window.APEX_ARSENAL_WEAPONS = WEAPONS;
  AQ.weapons = WEAPONS;
  AQ.weaponApi = weaponApi;
  window.apexArsenalWeaponRuntime = 'ready';
})();
