// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(() => {
  const stringType = FighterTypes.find(t => t.name === 'STRING');
  if (!stringType || window.apexStringChampionPatch === 'ready') return;

  const STRING_ASSET_ROOT = 'assets/string_v1/normalized/';
  const STRING_AUDIO_ROOT = 'assets/string_v1/audio/';
  const STRING_IMAGES = {
    main: STRING_ASSET_ROOT + 'stringMainStatic.webp',
    idleAlt: STRING_ASSET_ROOT + 'stringIdleAltPose.webp',
    shotPose: STRING_ASSET_ROOT + 'stringShotPose.webp',
    overheatPose: STRING_ASSET_ROOT + 'overheatPrepPose.webp',
    overheatWhipPose: STRING_ASSET_ROOT + 'overheatWhipPose.webp',
    godPose: STRING_ASSET_ROOT + 'godThreadsPose.webp',
    clawFrames: STRING_ASSET_ROOT + 'fiveColorClawFrames.webp',
    fiveSlash: STRING_ASSET_ROOT + 'fiveColorSlash.webp',
    birdCage: STRING_ASSET_ROOT + 'birdCage.webp',
    godCircle: STRING_ASSET_ROOT + 'godThreadsCircle.webp',
    bodyWeb: STRING_ASSET_ROOT + 'bodyThreadWeb.webp',
    pinkWeb: STRING_ASSET_ROOT + 'pinkThreadWeb.webp',
    overheatThread: STRING_ASSET_ROOT + 'overheatThread.webp',
    silverThread: STRING_ASSET_ROOT + 'silverThread.webp',
    shotThread: STRING_ASSET_ROOT + 'stringShotThread.webp',
    godThread: STRING_ASSET_ROOT + 'godThreadLance.webp',
    textShotHeat: STRING_ASSET_ROOT + 'stringshotOverheatText.webp',
    textParasite: STRING_ASSET_ROOT + 'parasiteStringText.webp',
    textFive: STRING_ASSET_ROOT + 'fiveColorStringText.webp',
    textGod: STRING_ASSET_ROOT + 'godThreadsText.webp'
  };
  const stringImgs = {};
  for (const [key, src] of Object.entries(STRING_IMAGES)) {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    stringImgs[key] = img;
  }
  const STRING_AUDIO = {
    tension: STRING_AUDIO_ROOT + 'thread_tension.mp3',
    break: STRING_AUDIO_ROOT + 'thread_break.mp3',
    shot: STRING_AUDIO_ROOT + 'stringshot.mp3',
    overheat: STRING_AUDIO_ROOT + 'overheat.mp3',
    claw: STRING_AUDIO_ROOT + 'claws.mp3',
    lock: STRING_AUDIO_ROOT + 'web_lock.mp3',
    bird: STRING_AUDIO_ROOT + 'birdcage_sound.mp3',
    voiceShot: STRING_AUDIO_ROOT + 'stringshot_voice.mp3',
    voiceOverheat: STRING_AUDIO_ROOT + 'overheat_voice.mp3',
    voiceFive: STRING_AUDIO_ROOT + 'fivecolor_strings_voice.mp3',
    voiceBird: STRING_AUDIO_ROOT + 'birdcage_voice.mp3'
  };
  const stringAudioCache = {};
  const stringAudioPools = {};
  const stringAudioCd = {};
  const STRING_AUDIO_OFFSET = { break: 1.02, overheat: .32, voiceShot: .24, voiceBird: .18 };
  const STRING_RENDER_SCALE = 1.62;
  function playStringAudio(key, volume = 0.72, rate = 1, cooldown = 0.04) {
    const now = performance.now() / 1000;
    if ((stringAudioCd[key] || 0) > now) return;
    stringAudioCd[key] = now + cooldown;
    try {
      const base = stringAudioCache[key] || (stringAudioCache[key] = new Audio(STRING_AUDIO[key]));
      base.preload = 'auto';
      registerBattleMediaElement(base);
      const pool = stringAudioPools[key] || (stringAudioPools[key] = [base]);
      let snd = pool.find(item => item.paused || item.ended);
      if (!snd && pool.length < 6) {
        snd = base.cloneNode(true);
        snd.preload = 'auto';
        registerBattleMediaElement(snd);
        pool.push(snd);
      }
      if (!snd) return;
      snd.volume = volume;
      snd.playbackRate = rate;
      if (STRING_AUDIO_OFFSET[key]) {
        try { snd.currentTime = STRING_AUDIO_OFFSET[key]; } catch (err) {}
      } else {
        try { snd.currentTime = 0; } catch (err) {}
      }
      snd.play().catch(() => {});
    } catch (err) {}
  }

  function stringData(f) {
    f.data ||= {};
    if (!f.data.stringReady) {
      f.data.stringReady = true;
      f.data.stringCycleTimer = 5;
      f.data.stringThreadCount = 0;
      f.data.stringState = 'idle';
      f.data.stringStateTimer = 0;
      f.data.stringBodyHitCd = 0;
      f.data.stringWallCreateCd = 0;
      f.data.stringCageCreateCd = 0;
      f.data.stringLatestContact = null;
      f.data.stringContactSerial = 0;
      f.data.stringBodyThreadQueue = [];
      f.data.stringLastBoundaryContact = null;
      f.data.stringBaseDamageThisSkill = 0;
      f.data.stringCurrentCastCount = 0;
      f.data.stringBodyConsumedThisSkill = 0;
      f.data.stringClawHits = 0;
      f.data.stringSkillStats = { shot: 0, overheat: 0, five: 0, bird: 0 };
      f.data.stringCycleStartTime = matchClock || 0;
      f.data.stringBreakRecords = [];
      f.data.stringBreakOrder = 0;
      f.data.stringGodThreads = [];
      f.data.stringGodNextIndex = 0;
      f.data.stringGodElapsed = 0;
      f.data.stringGodPulseUntil = 0;
      f.data.stringGodPierced = 0;
      f.data.stringQueuedHeal = 0;
      f.data.stringQueuedHealText = null;
      f.data.stringCarryThreadCount = 0;
      f.data.stringCarryBreakRecords = [];
    }
    return f.data;
  }

  function stringGuardReduction(f) {
    const d = f && f.data;
    if (!(f && f.name === 'STRING' && d)) return 0;
    if (d.stringState === 'five' && (d.stringClawHits || 0) > 0) return Math.min(1, Math.min(5, d.stringClawHits || 0) * .2);
    if (d.stringState === 'god' && (d.stringGodPierced || 0) > 0) return Math.min(1, Math.min(5, d.stringGodPierced || 0) * .2);
    return 0;
  }

  function stringClawGuard(f) {
    return stringGuardReduction(f) >= 1;
  }

  function queueStringHeal(owner, amount) {
    if (!owner || owner.hp <= 0 || amount <= 0) return 0;
    amount *= getVirusStats(owner).healMult;
    const before = owner.hp;
    owner.hp = Math.min(owner.maxHp, owner.hp + amount);
    const healed = Math.max(0, owner.hp - before);
    if (healed <= 0) return 0;
    owner.healingDone = (owner.healingDone || 0) + healed;
    const d = stringData(owner);
    d.stringQueuedHeal = (d.stringQueuedHeal || 0) + healed;
    let ft = d.stringQueuedHealText;
    if (!ft || ft.life <= 0) {
      ft = new FloatingText(owner.x, owner.y - owner.radius - 10, `+${d.stringQueuedHeal.toFixed(1)}`, '#44ff7a');
      d.stringQueuedHealText = ft;
      floatingTexts.push(ft);
    } else {
      ft.x = owner.x + rand(-12, 12);
      ft.y = owner.y - owner.radius - 10 + rand(-8, 8);
      ft.text = `+${d.stringQueuedHeal.toFixed(1)}`;
      ft.life = ft.maxLife = .9;
    }
    setTimeout(() => {
      if (d.stringQueuedHealText === ft) d.stringQueuedHeal = 0;
    }, 950);
    updateHUD();
    return healed;
  }

  function dealStringDamage(owner, target, amount, label, silent = false) {
    if (!owner || !target || amount <= 0) return 0;
    if (owner.name === 'STRING' && owner.isRage) {
      amount *= Math.max(1, 1 + activeStringThreads(owner).length * .05);
    }
    const before = target.hp;
    target.takeDamage(amount, owner, label, silent);
    const dealt = Math.max(0, before - target.hp);
    if (dealt > 0) {
      const d0 = stringData(owner);
      const healMult = d0.stringBodyConsumedThisSkill > 0 ? (owner.isRage ? 2 : 1) : (owner.isRage ? 1 : .5);
      queueStringHeal(owner, dealt * healMult);
    }
    const d = stringData(owner);
    d.stringBaseDamageThisSkill += dealt;
    return dealt;
  }

  function activeStringThreads(owner) {
    return projectiles.filter(p => p.type === 'string_wall_thread' && p.owner === owner && p.life > 0);
  }

  function activeBodyThreads(owner, target = null) {
    return projectiles.filter(p => p.type === 'string_body_thread' && p.owner === owner && p.life > 0 && (!target || p.target === target));
  }

  function handAnchor(f, mode = 'front') {
    const d = norm(f.dir.x, f.dir.y);
    return handAnchorForDir(f, d, mode);
  }

  function handAnchorForDir(f, d, mode = 'front') {
    const px = -d.y, py = d.x;
    const side = mode === 'overheat' ? 0.22 : 0.12;
    return { x: f.x + d.x * f.radius * 0.68 + px * f.radius * side, y: f.y + d.y * f.radius * 0.68 + py * f.radius * side };
  }

  function stringTargetDir(f, e) {
    if (!f || !e) return norm(f.dir.x, f.dir.y);
    const d = norm(e.x - f.x, e.y - f.y);
    return Number.isFinite(d.x) && Number.isFinite(d.y) ? d : norm(f.dir.x, f.dir.y);
  }

  function handAnchorToward(f, e, mode = 'front') {
    return handAnchorForDir(f, stringTargetDir(f, e), mode);
  }

  function stringRenderRotation(f) {
    const enemy = fighters && fighters.find(x => x && x.id !== f.id && x.hp > 0);
    if (!enemy) return Math.PI / 2;
    const targetAngle = Math.atan2(enemy.y - f.y, enemy.x - f.x);
    const moveAngle = Math.atan2(f.dir.y, f.dir.x);
    return targetAngle - moveAngle + Math.PI * 1.5;
  }

  function cageAnchorPoint(cage, angle) {
    if (!cage) return null;
    return { x: cage.x + Math.cos(angle) * cage.radius, y: cage.y + Math.sin(angle) * cage.radius };
  }

  function boundaryAnchorFromSide(f, side) {
    const anchor = { x: f.x, y: f.y, kind: 'wall', side };
    if (side === 'left') anchor.x = 0;
    if (side === 'right') anchor.x = GAME_SIZE;
    if (side === 'top') anchor.y = 0;
    if (side === 'bottom') anchor.y = GAME_SIZE;
    return anchor;
  }

  function spawnStringThread(f, sideOrContact) {
    const d = stringData(f);
    if (d.stringWallCreateCd > 0) return;
    d.stringWallCreateCd = 0.06;
    const contact = typeof sideOrContact === 'object' ? sideOrContact : boundaryAnchorFromSide(f, sideOrContact);
    const anchor = contact.kind === 'cage' ? cageAnchorPoint(contact.cage, contact.angle) || contact : contact;
    projectiles.push({
      type: 'string_wall_thread',
      owner: f,
      x1: anchor.x,
      y1: anchor.y,
      x2: f.x,
      y2: f.y,
      anchorKind: contact.kind || 'wall',
      cage: contact.cage || null,
      cageAngle: contact.angle,
      life: Infinity,
      maxLife: Infinity,
      createdAt: matchClock || 0,
      snapCd: 0
    });
    const live = activeStringThreads(f);
    if (live.length > 140) live[0].life = 0;
    playStringAudio('tension', 0.44, 1, 0.08);
  }

  function rememberOpponentContact(owner, enemy) {
    const d = stringData(owner);
    if (d.stringBodyHitCd > 0 || !enemy || enemy.hp <= 0) return false;
    d.stringBodyHitCd = 0.18;
    const n = norm(enemy.x - owner.x, enemy.y - owner.y);
    d.stringLatestContact = {
      type: 'opponent',
      enemy,
      x: enemy.x - n.x * enemy.radius * .62,
      y: enemy.y - n.y * enemy.radius * .62,
      time: matchClock || 0,
      serial: ++d.stringContactSerial,
      used: false
    };
    emitParticles(enemy.x, enemy.y, '#f2f2ff', 5, 90, 2, .18);
    return true;
  }

  function opponentAttachPoint(owner, target) {
    if (!target) return { x: 0, y: 0 };
    if (!owner) return { x: target.x, y: target.y };
    const n = norm(owner.x - target.x, owner.y - target.y);
    return { x: target.x + n.x * target.radius * .35, y: target.y + n.y * target.radius * .35 };
  }

  function createBodyThread(owner, enemy, contact) {
    if (!owner || !enemy || enemy.hp <= 0) return false;
    const d = stringData(owner);
    enemy.data ||= {};
    const wallPoint = contact.kind === 'cage' ? cageAnchorPoint(contact.cage, contact.angle) || contact : contact;
    const thread = {
      type: 'string_body_thread',
      owner,
      target: enemy,
      x1: wallPoint.x,
      y1: wallPoint.y,
      anchorKind: contact.kind || 'wall',
      side: contact.side || null,
      cage: contact.cage || null,
      cageAngle: contact.angle,
      life: Infinity,
      maxLife: Infinity,
      createdAt: matchClock || 0,
      order: ++d.stringContactSerial,
      phase: rand(0, TAU)
    };
    projectiles.push(thread);
    d.stringBodyThreadQueue.push(thread);
    enemy.data.stringBodyThreads = activeBodyThreads(owner, enemy).length;
    emitParticles(enemy.x, enemy.y, '#ffd1ee', 9, 150, 2.6, .28);
    playStringAudio('tension', 0.36, 1.08, 0.08);
    return true;
  }

  function consumeBodyThreads(owner, enemy, count) {
    const d = stringData(owner);
    d.stringBodyThreadQueue = d.stringBodyThreadQueue.filter(p => p && p.life > 0);
    const matches = d.stringBodyThreadQueue
      .filter(p => p.target === enemy && p.life > 0)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    let removed = 0;
    for (const p of matches) {
      if (removed >= count) break;
      p.life = 0;
      removed++;
    }
    if (enemy && enemy.data) enemy.data.stringBodyThreads = Math.max(0, activeBodyThreads(owner, enemy).length);
    return removed;
  }

  function explodeBirdCageThreads(cage) {
    if (!cage || cage.stringThreadBurstDone) return;
    cage.stringThreadBurstDone = true;
    const owner = cage.owner;
    if (!owner) return;
    const cageWallThreads = projectiles.filter(p => p.type === 'string_wall_thread' && p.owner === owner && p.anchorKind === 'cage' && p.cage === cage && p.life > 0);
    if (cageWallThreads.length) {
      for (const p of cageWallThreads) p.life = 0;
      const heal = cageWallThreads.length * 5;
      queueStringHeal(owner, heal);
      emitParticles(owner.x, owner.y, '#ffb7e4', 20, 340, 4, .45);
    }
    const cageThreads = projectiles.filter(p => p.type === 'string_body_thread' && p.owner === owner && p.anchorKind === 'cage' && p.cage === cage && p.life > 0);
    const byTarget = new Map();
    for (const p of cageThreads) {
      p.life = 0;
      if (p.target && p.target.hp > 0) byTarget.set(p.target, (byTarget.get(p.target) || 0) + 1);
    }
    for (const [target, count] of byTarget) {
      if (target.data) target.data.stringBodyThreads = Math.max(0, activeBodyThreads(owner, target).length);
      const dmg = count * 5;
      dealStringDamage(owner, target, dmg, 'bird-cage-thread-burst');
      floatingTexts.push(new FloatingText(target.x, target.y - target.radius - 98, `CAGE BURST ${dmg}`, '#ff9fd8'));
      emitParticles(target.x, target.y, '#ff9fd8', 26, 430, 4.5, .55);
      spawnShockwave(target.x, target.y, '#ff8fd4', 160 + count * 18);
    }
  }

  function handleStringBoundaryContact(f, sideOrContact) {
    const d = stringData(f);
    const contact = typeof sideOrContact === 'object' ? sideOrContact : boundaryAnchorFromSide(f, sideOrContact);
    const pt = contact.kind === 'cage' ? cageAnchorPoint(contact.cage, contact.angle) || contact : contact;
    const last = d.stringLastBoundaryContact;
    if (last && matchClock - last.time < .12 && dist(last.x, last.y, pt.x, pt.y) < 34) return;
    d.stringLastBoundaryContact = { x: pt.x, y: pt.y, time: matchClock || 0, kind: contact.kind || 'wall' };
    if (d.stringLatestContact && d.stringLatestContact.type === 'opponent' && !d.stringLatestContact.used && d.stringLatestContact.enemy && d.stringLatestContact.enemy.hp > 0) {
      createBodyThread(f, d.stringLatestContact.enemy, { ...contact, x: pt.x, y: pt.y });
      d.stringLatestContact.used = true;
      d.stringLatestContact = { type: contact.kind || 'wall', x: pt.x, y: pt.y, time: matchClock || 0, serial: ++d.stringContactSerial };
      return;
    }
    spawnStringThread(f, { ...contact, x: pt.x, y: pt.y });
    d.stringLatestContact = { type: contact.kind || 'wall', x: pt.x, y: pt.y, time: matchClock || 0, serial: ++d.stringContactSerial };
  }

  function predictedStringSkill(count) {
    if (count <= 0) return 'NEXT NONE';
    if (count <= 2) return 'NEXT STRINGSHOT';
    if (count <= 4) return 'NEXT OVERHEAT';
    return 'NEXT GOD THREADS';
  }

  function predictedStringBonus(count, body) {
    if (count <= 0) return 'BONUS NONE';
    if (count > 5) return 'BONUS LOCKED';
    if (body < count) return 'BONUS WAIT';
    if (count === 5) return 'BIRD CAGE READY';
    if (count === 4) return 'PUPPET READY';
    if (count === 3) return 'PARASITE READY';
    if (count === 2) return 'BOUND READY';
    return 'TIGHTEN READY';
  }

  function drawStringTextImage(ctx, key, x, y, w, h) {
    const shotHeat = key === 'stringshot' || key === 'overheat';
    const img = key === 'god' ? stringImgs.textGod : (shotHeat ? stringImgs.textShotHeat : (key === 'five' ? stringImgs.textFive : stringImgs.textParasite));
    if (!img || !img.complete || !img.naturalWidth) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#100a12';
      ctx.lineWidth = 5;
      ctx.font = '900 24px sans-serif';
      ctx.textAlign = 'center';
      const fallback = key === 'stringshot' ? 'STRINGSHOT' : key === 'overheat' ? 'OVERHEAT' : key === 'five' ? 'FIVE-COLOR STRING' : key === 'god' ? 'GOD THREADS' : 'PARASITE STRING';
      ctx.strokeText(fallback, x, y);
      ctx.fillText(fallback, x, y);
      return;
    }
    if (shotHeat) {
      const half = img.naturalHeight / 2;
      const sy = key === 'stringshot' ? 0 : half;
      ctx.drawImage(img, 0, sy, img.naturalWidth, half, x - w / 2, y - h / 2, w, h);
    } else {
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, x - w / 2, y - h / 2, w, h);
    }
  }

  function spawnStringSkillText(kind, x, y, life = .72) {
    return;
  }

  function drawBodyThreadBundle(ctx, p, alphaMul = 1) {
    if (!p || !p.owner || !p.target) return;
    const t = p.target;
    const o = p.owner;
    const a = clamp((p.life || 0) / (p.maxLife || p.life || 1), 0, 1);
    const alpha = alphaMul * Math.min(1, a * 1.8);
    if (alpha <= 0) return;
    const from = handAnchorToward(o, t, p.mode === 'puppet' ? 'overheat' : 'front');
    const to = opponentAttachPoint(o, t);
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const strands = p.mode === 'tighten' ? 5 : p.mode === 'puppet' ? 11 : 8;
    const color = p.mode === 'puppet' ? '#ff74d0' : p.mode === 'web-lock' ? '#fff3fb' : '#ffb7e4';
    const core = p.mode === 'puppet' ? '#ffd1ee' : '#ffffff';
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = p.mode === 'puppet' ? '#ff4ec0' : '#ff9fd8';
    ctx.shadowBlur = p.mode === 'tighten' ? 12 : 18;
    for (let j = 0; j < strands; j++) {
      const spread = (j - (strands - 1) / 2) * (p.mode === 'tighten' ? 4.5 : 7);
      const wave = Math.sin(Date.now() / 150 + j * 1.31 + (p.phase || 0)) * clamp(len * .025, 5, 24);
      const targetOrbit = (p.mode === 'tighten' ? .55 : .85) * t.radius;
      const endAng = j * TAU / strands + Date.now() / (p.mode === 'puppet' ? 380 : 520);
      const ex = to.x + Math.cos(endAng) * targetOrbit * .28;
      const ey = to.y + Math.sin(endAng) * targetOrbit * .28;
      const cx = (from.x + ex) / 2 + nx * (spread + wave);
      const cy = (from.y + ey) / 2 + ny * (spread + wave);
      ctx.globalAlpha = alpha * (j % 2 ? .58 : .78);
      ctx.strokeStyle = color;
      ctx.lineWidth = p.mode === 'tighten' ? 2.2 : 2.8;
      ctx.beginPath();
      ctx.moveTo(from.x + nx * spread * .15, from.y + ny * spread * .15);
      ctx.quadraticCurveTo(cx, cy, ex, ey);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha * .95;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = core;
    ctx.lineWidth = p.mode === 'tighten' ? 1.3 : 1.8;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo((from.x + to.x) / 2 + nx * Math.sin(Date.now() / 180 + (p.phase || 0)) * 10, (from.y + to.y) / 2 + ny * Math.sin(Date.now() / 180 + (p.phase || 0)) * 10, to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawPendingBodyContact(ctx, f) {
    if (!f || f.name !== 'STRING' || f.hp <= 0) return;
    const d = f.data;
    const c = d && d.stringLatestContact;
    const target = c && c.type === 'opponent' && !c.used ? c.enemy : null;
    if (!target || target.hp <= 0) return;
    const age = Math.max(0, (matchClock || 0) - (c.time || 0));
    const a = clamp(1 - age / 5, .28, .78);
    const from = handAnchorToward(f, target, 'front');
    const to = opponentAttachPoint(f, target);
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = '#ff8fd4';
    ctx.shadowBlur = 10;
    for (let i = -1; i <= 1; i++) {
      const wobble = Math.sin(Date.now() / 190 + i * 1.7) * clamp(len * .018, 3, 14);
      const cx = (from.x + to.x) / 2 + nx * (i * 6 + wobble);
      const cy = (from.y + to.y) / 2 + ny * (i * 6 + wobble);
      ctx.globalAlpha = a * (i === 0 ? .82 : .5);
      ctx.strokeStyle = i === 0 ? '#ffd1ee' : '#ff8fd4';
      ctx.lineWidth = i === 0 ? 1.9 : 1.15;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(cx, cy, to.x, to.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function godThreadCurvePoints(p, tail, tip, age) {
    const dx = tip.x - tail.x, dy = tip.y - tail.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const launch = clamp(age / .58, 0, 1);
    const retract = clamp((age - .66) / .42, 0, 1);
    const energy = Math.sin(clamp(launch, 0, 1) * Math.PI) * (1 - retract * .78);
    const bend = clamp(len * .08, 18, 72) * energy;
    const side = p.bendSign || 1;
    const points = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const baseX = lerp(tail.x, tip.x, t);
      const baseY = lerp(tail.y, tip.y, t);
      const arc = Math.sin(t * Math.PI) * bend * .42 * side;
      const wave = Math.sin(t * Math.PI * 1.2 + (p.phase || 0) + age * 5.2) * bend * .18 * Math.sin(t * Math.PI);
      const snap = Math.sin(Math.min(1, age / .62) * Math.PI) * clamp(len * .012, 2, 11) * Math.pow(t, 1.25);
      points.push({ x: baseX + nx * (arc + wave + snap), y: baseY + ny * (arc + wave + snap) });
    }
    return points;
  }

  function drawGodThreadAsset(ctx, points, alpha = 1, drawWidth = 16) {
    const img = stringImgs.godThread;
    if (!img || !img.complete || !img.naturalWidth || points.length < 2) return false;
    const sx = Math.floor(img.naturalWidth * .459);
    const sw = Math.max(1, Math.ceil(img.naturalWidth * .075));
    const topPad = Math.floor(img.naturalHeight * .024);
    const srcH = Math.max(1, Math.floor(img.naturalHeight * .954));
    const width = drawWidth;
    const n = points.length - 1;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    for (let i = 0; i < n; i++) {
      const a = points[i], b = points[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const segLen = Math.hypot(dx, dy);
      if (segLen < .5) continue;
      const sy = topPad + Math.floor(srcH * i / n);
      const sh = Math.max(1, Math.ceil(srcH / n) + 2);
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, sx, sy, sw, Math.min(sh, topPad + srcH - sy), -width / 2, -1, width, segLen + 3);
      ctx.restore();
    }
    ctx.restore();
    return true;
  }

  function drawGodThreadTipAsset(ctx, points, alpha = 1) {
    const img = stringImgs.godThread;
    if (!img || !img.complete || !img.naturalWidth || points.length < 3) return false;
    const head = points[points.length - 1];
    const prev = points[Math.max(0, points.length - 4)];
    const dx = head.x - prev.x, dy = head.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const sx = Math.floor(img.naturalWidth * .459);
    const sw = Math.max(1, Math.ceil(img.naturalWidth * .075));
    const srcH = Math.max(1, Math.floor(img.naturalHeight * .24));
    const sy = Math.max(0, Math.floor(img.naturalHeight * .954) - srcH + Math.floor(img.naturalHeight * .024));
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 0;
    ctx.drawImage(img, sx, sy, sw, srcH, -10, -45, 20, 54);
    ctx.restore();
    return true;
  }

  function godCircleRadius(f) {
    return clamp((f && f.radius ? f.radius : 48) * 2.22, 102, 146);
  }

  function godCircleCenter(f) {
    return { x: f.x, y: f.y + (f.radius || 48) * .16 };
  }

  function drawOneGodCircle(ctx, f, alpha = .76, pulse = 0) {
    if (!f || f.hp <= 0) return;
    const img = stringImgs.godCircle;
    const c = godCircleCenter(f);
    const size = godCircleRadius(f) * 2 * (1 + pulse * .055);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(Date.now() / 2800);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha + pulse * .26;
    ctx.shadowColor = '#b45cff';
    ctx.shadowBlur = 22 + pulse * 18;
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      ctx.strokeStyle = '#b45cff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGodThreadsCircle(ctx) {
    let owner = fighters.find(f => f && f.name === 'STRING' && f.hp > 0 && f.data && f.data.stringState === 'god');
    let target = owner && fighters.find(f => f && f !== owner && f.hp > 0);
    if (!owner || !target) {
      const p = projectiles.find(q => q && q.type === 'string_god_thread' && q.life > 0 && q.owner && q.target);
      if (p) {
        owner = p.owner;
        target = p.target;
      }
    }
    if (!owner || !target) return;
    const pulse = clamp(((owner.data && owner.data.stringGodPulseUntil) || 0) - (matchClock || 0), 0, .32) / .32;
    drawOneGodCircle(ctx, owner, .74, pulse);
    drawOneGodCircle(ctx, target, .74, pulse);
  }

  function startStringShot(f, e, count) {
    const d = stringData(f);
    d.stringState = 'stringshot';
    d.stringStateTimer = .24;
    d.stringCurrentCastCount = count;
    d.stringBaseDamageThisSkill = 0;
    d.stringBodyConsumedThisSkill = 0;
    d.stringShotResolved = false;
    recordSkill(f);
    d.stringSkillStats.shot++;
    spawnStringSkillText('stringshot', f.x, f.y - f.radius - 88);
    playStringAudio('voiceShot', 0.48, 1, 0.65);
  }

  function resolveStringShot(f, e) {
    const d = stringData(f);
    if (d.stringShotResolved || !e) return;
    d.stringShotResolved = true;
    const count = d.stringCurrentCastCount;
    const damage = count === 1 ? 7 : 12;
    const origin = handAnchorToward(f, e, 'front');
    const aim = norm(e.x - origin.x, e.y - origin.y);
    const end = { x: origin.x + aim.x * 1400, y: origin.y + aim.y * 1400 };
    const hit = distToSegment(e.x, e.y, origin.x, origin.y, end.x, end.y) <= e.radius + 22;
    projectiles.push({ type: 'string_shot_line', owner: f, target: e, x1: origin.x, y1: origin.y, x2: end.x, y2: end.y, length: 1400, life: .46, maxLife: .46, dot: 0, phase: rand(0, TAU) });
    playStringAudio('shot', 0.72, 1, 0.10);
    if (hit) {
      dealStringDamage(f, e, damage, 'stringshot');
      emitParticles(e.x, e.y, '#ffffff', 10, 280, 3, .22);
    }
  }

  function startOverheat(f, e, count) {
    const d = stringData(f);
    d.stringState = 'overheat';
    d.stringStateTimer = 1.05;
    d.stringCurrentCastCount = count;
    d.stringBaseDamageThisSkill = 0;
    d.stringBodyConsumedThisSkill = 0;
    d.stringOverheatResolved = false;
    d.stringOverheatWhipPoseAt = 0;
    recordSkill(f);
    d.stringSkillStats.overheat++;
    spawnStringSkillText('overheat', f.x, f.y - f.radius - 88);
    playStringAudio('overheat', 0.58, 1, 0.08);
    playStringAudio('voiceOverheat', 0.48, 1, 0.65);
  }

  function resolveOverheat(f, e) {
    const d = stringData(f);
    if (d.stringOverheatResolved || !e) return;
    d.stringOverheatResolved = true;
    d.stringOverheatWhipPoseAt = (matchClock || 0) + .18;
    const count = d.stringCurrentCastCount;
    const damage = count === 3 ? 13 : 17;
    const origin = handAnchorToward(f, e, 'overheat');
    const aim = norm(e.x - origin.x, e.y - origin.y);
    const end = { x: origin.x + aim.x * 1660, y: origin.y + aim.y * 1660 };
    projectiles.push({ type: 'string_overheat_whip', owner: f, target: e, x1: origin.x, y1: origin.y, x2: end.x, y2: end.y, cx: (origin.x + e.x) / 2 - aim.y * 150, cy: (origin.y + e.y) / 2 + aim.x * 150, damage, life: .86, maxLife: .86, phase: rand(0, TAU), swingSide: Math.random() < .5 ? -1 : 1 });
    const hit = distToSegment(e.x, e.y, origin.x, origin.y, end.x, end.y) <= e.radius + 52;
    if (hit) {
      dealStringDamage(f, e, damage, 'overheat-string');
      e.applyStatus('push', .22, { x: aim.x, y: aim.y, strength: 720 });
      emitParticles(e.x, e.y, '#ff7b2e', 16, 360, 5, .35);
      playStringAudio('overheat', 0.72, 1.06, 0.02);
    }
  }

  function startFiveColor(f, e, count) {
    const d = stringData(f);
    d.stringState = 'five';
    d.stringStateTimer = Math.max(5, count);
    d.stringFiveDuration = Math.max(5, count);
    d.stringCurrentCastCount = count;
    d.stringBaseDamageThisSkill = 0;
    d.stringBodyConsumedThisSkill = 0;
    d.stringFiveTick = .08;
    d.stringClawFrame = 0;
    d.stringClawHits = 0;
    recordSkill(f);
    d.stringSkillStats.five++;
    spawnStringSkillText('five', f.x, f.y - f.radius - 94, .92);
    playStringAudio('voiceFive', 0.5, 1, 0.9);
  }

  function startGodThreads(f, e, count) {
    const d = stringData(f);
    const records = (d.stringBreakRecords || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    let prev = 0;
    d.stringGodThreads = records.map((r, i) => {
      const gap = Math.max(0, (r.timeInCycle || 0) - prev);
      prev = r.timeInCycle || 0;
      const ratio = clamp(gap / 5, 0, 1);
      const base = lerp(5, 20, ratio);
      return {
        x: r.x,
        y: r.y,
        order: r.order || i,
        delay: i * .5,
        damage: clamp(base + rand(-1.5, 1.8), 5, 20),
        gap
      };
    });
    d.stringBreakRecords = [];
    d.stringBreakOrder = 0;
    d.stringState = 'god';
    d.stringGodElapsed = 0;
    d.stringGodNextIndex = 0;
    d.stringGodPierced = 0;
    d.stringStateTimer = Math.max(1.1, d.stringGodThreads.length * .5 + 1.15);
    d.stringCurrentCastCount = count;
    d.stringBaseDamageThisSkill = 0;
    d.stringBodyConsumedThisSkill = 0;
    recordSkill(f);
    d.stringSkillStats.five++;
    timeScale = 1;
    hitStop = 0;
    spawnStringSkillText('god', f.x, f.y - f.radius - 98, 1.05);
    playStringAudio('voiceFive', 0.52, 1, 0.9);
    triggerFlash(60, 20, 90, .16);
  }

  function nearestStringThreadPoint(owner, enemy) {
    let best = null;
    for (const p of activeStringThreads(owner)) {
      const ax = p.x1, ay = p.y1, bx = owner.x, by = owner.y;
      const vx = bx - ax, vy = by - ay;
      const len2 = vx * vx + vy * vy || 1;
      const t = clamp(((enemy.x - ax) * vx + (enemy.y - ay) * vy) / len2, 0, .72);
      const pt = { x: ax + vx * t, y: ay + vy * t };
      const dd = dist(enemy.x, enemy.y, pt.x, pt.y);
      if (!best || dd < best.d) best = { ...pt, d: dd };
    }
    return best || { x: owner.x, y: owner.y, d: dist(enemy.x, enemy.y, owner.x, owner.y) };
  }

  function stringSelfCastOptions(target) {
    const name = target?.name || '';
    if (name === 'ICE') return ['ICE LANE', 'ICE AGE', 'FROZEN', 'ICE DART'];
    if (name === 'GALAXY') return ['GAL DIVINE', 'IMPACT', 'SPLIT'];
    if (name === 'SOCCER') return ['SHOOT', 'PENALTY', 'OWN GOAL'];
    if (name === 'ENGINEER') return ['TURRET FIRE', 'ROCKET', 'WAR MACHINE'];
    if (name === 'NINJA') return ['SHURIKEN', 'KUNAI', 'STRIKE'];
    return ['SKILL'];
  }

  function startStringForcedSelfCast(owner, target, duration = 5) {
    if (!owner || !target?.data) return;
    const options = stringSelfCastOptions(target);
    const skill = options[Math.floor(Math.random() * options.length)] || 'SKILL';
    target.data.stringSelfCastTimer = duration;
    target.data.stringSelfCastOwner = owner;
    target.data.stringSelfCastSkill = skill;
    target.data.stringSelfCastTick = .12;
    target.data.stringSelfCastPulse = .35;
    target.data.stringSelfCastReflecting = false;
    const label = `SELF ${skill}`;
    const text = new FloatingText(target.x, target.y - target.radius - 92, label, '#f7d7ff');
    text.size = 23;
    floatingTexts.push(text);
    if (target.name === 'ICE') {
      target.applyStatus('freeze', .85, { source: target, stringSelfCast: true, dartTotal: 8 });
      target.takeDamage(5, target, 'string-forced-ice-self', true);
      projectiles.push({ type:'ice_lane', owner:target, x1:target.x, y1:target.y, x2:target.x + target.dir.x * 260, y2:target.y + target.dir.y * 260, halfWidth:120, life:.65, maxLife:.65, enemyInside:0, dmgTick:0 });
    } else if (target.name === 'GALAXY') {
      target.takeDamage(14, target, 'string-forced-galaxy-self', true);
      spawnShockwave(target.x, target.y, '#bb8cff', 190);
    } else if (target.name === 'SOCCER') {
      target.takeDamage(6, target, 'string-forced-soccer-ball', true);
    } else if (target.name === 'ENGINEER') {
      target.takeDamage(8, target, 'string-forced-engineer-structure', true);
    } else if (target.name === 'NINJA') {
      target.takeDamage(8, target, 'string-forced-ninja-self', true);
      const a = Math.atan2(target.dir.y || 1, target.dir.x || 0) + Math.PI;
      projectiles.push({ type:'ninja_shuriken', owner:target, targetId:target.id, x:target.x + Math.cos(a)*70, y:target.y + Math.sin(a)*70, vx:-Math.cos(a)*900, vy:-Math.sin(a)*900, radius:12, dmg:1, customLife:.45, maxCustomLife:.45, straight:true, apexCustom:true });
    } else {
      target.takeDamage(7, target, 'string-forced-self-skill', true);
    }
    playStringAudio('lock', .58, .92, .08);
  }

  function updateStringForcedSelfCast(owner, target, dt) {
    if (!owner || !target?.data || !(target.data.stringSelfCastTimer > 0)) return;
    target.data.stringSelfCastTimer = Math.max(0, target.data.stringSelfCastTimer - dt);
    target.data.stringSelfCastPulse = Math.max(0, (target.data.stringSelfCastPulse || 0) - dt);
    target.data.stringSelfCastTick = (target.data.stringSelfCastTick || 0) - dt;
    while (target.data.stringSelfCastTick <= 0 && target.data.stringSelfCastTimer > 0) {
      target.data.stringSelfCastTick += .72;
      let dmg = 3.5;
      let label = 'string-forced-self-cast';
      if (target.name === 'SOCCER') { dmg = 5.5; label = 'string-forced-own-ball'; }
      else if (target.name === 'ENGINEER') {
        const structures = (window.APEX_ENGINEER?.ownerData?.(target)?.structures || []).filter(s => s && !s.dead && s.hp > 0);
        dmg = structures.length ? 6 : 3;
        label = structures.length ? 'string-forced-own-structure' : 'string-forced-self-cast';
      } else if (target.name === 'GALAXY') { dmg = 5; label = 'string-forced-galaxy-self'; }
      else if (target.name === 'NINJA') { dmg = 4.5; label = 'string-forced-ninja-self'; }
      else if (target.name === 'ICE') { dmg = 4; label = 'string-forced-ice-self'; }
      target.takeDamage(dmg, target, label, true);
      if (Math.random() < .42) {
        const pulse = new FloatingText(target.x, target.y - target.radius - 64, target.data.stringSelfCastSkill || 'SELF CAST', '#e8c8ff');
        pulse.size = 17;
        pulse.life = pulse.maxLife = .55;
        floatingTexts.push(pulse);
      }
    }
    if (target.data.stringSelfCastTimer <= 0) {
      target.data.stringSelfCastOwner = null;
      target.data.stringSelfCastSkill = null;
      target.data.stringSelfCastTick = 0;
      target.data.stringSelfCastReflecting = false;
    }
  }

  function applyStringBonus(f, e) {
    const d = stringData(f);
    const count = d.stringCurrentCastCount;
    const body = e ? activeBodyThreads(f, e).length : 0;
    if (e && e.data) e.data.stringBodyThreads = body;
    if (count === 5 && e) {
      if (body < 5) {
        d.stringState = 'idle';
        d.stringCycleTimer = 5;
        d.stringThreadCount = 0;
        d.stringCycleStartTime = matchClock || 0;
        d.stringBreakRecords = [];
        d.stringBreakOrder = 0;
        return;
      }
      d.stringBodyConsumedThisSkill = consumeBodyThreads(f, e, 5);
      if (!projectiles.some(p => p.type === 'string_bird_cage' && p.life > 0)) {
        const minRadius = ((f.radius * 2) + (e.radius * 2)) / 2;
        projectiles.push({ type: 'string_bird_cage', owner: f, x: GAME_SIZE / 2, y: GAME_SIZE / 2, radius: 520, startRadius: 520, minRadius, life: 20, maxLife: 20, contactCd: 0, flash: 0 });
        d.stringSkillStats.bird++;
        playStringAudio('bird', 0.52, 1, 1.0);
        playStringAudio('voiceBird', 0.48, 1, 1.0);
      }
      d.stringState = 'bonus';
      d.stringStateTimer = .7;
      return;
    }
    if (!e || count <= 0 || count > 5 || body < count) {
      d.stringState = 'idle';
      d.stringCycleTimer = 5;
      d.stringThreadCount = 0;
      d.stringCycleStartTime = matchClock || 0;
      d.stringBreakRecords = [];
      d.stringBreakOrder = 0;
      return;
    }
    d.stringBodyConsumedThisSkill = consumeBodyThreads(f, e, count);
    if (d.stringBaseDamageThisSkill > 0 && d.stringBodyConsumedThisSkill > 0) {
      queueStringHeal(f, d.stringBaseDamageThisSkill * (f.isRage ? 1 : .5));
    }
    if (count === 1) {
      const bonus = d.stringBaseDamageThisSkill * .5;
      if (bonus > 0) dealStringDamage(f, e, bonus, 'body-thread-tighten');
      projectiles.push({ type: 'string_body_pulse', owner: f, target: e, life: .45, maxLife: .45, mode: 'tighten' });
      d.stringState = 'bonus';
      d.stringStateTimer = .42;
    } else if (count === 2) {
      e.data.stringBodyLockTimer = 1.5;
      e.applyStatus('stun', 1.5, { source: f, stringBodyLock: true });
      projectiles.push({ type: 'string_body_pulse', owner: f, target: e, life: 1.5, maxLife: 1.5, mode: 'web-lock', phase: rand(0, TAU) });
      playStringAudio('lock', 0.62, 1, 0.12);
      d.stringState = 'bonus';
      d.stringStateTimer = 1;
    } else if (count === 3) {
      e.data.stringParasiteTimer = 2;
      e.data.stringParasiteOwner = f;
      e.applyStatus('abilityDisabled', 2, { source: f });
      projectiles.push({ type: 'string_body_pulse', owner: f, target: e, life: 2, maxLife: 2, mode: 'parasite', phase: rand(0, TAU) });
      spawnStringSkillText('parasite', e.x, e.y - e.radius - 86, 1.2);
      d.stringState = 'bonus';
      d.stringStateTimer = 2;
    } else if (count === 4) {
      startStringForcedSelfCast(f, e, 5);
      projectiles.push({ type: 'string_body_pulse', owner: f, target: e, life: 5, maxLife: 5, mode: 'puppet', phase: rand(0, TAU) });
      spawnStringSkillText('parasite', e.x, e.y - e.radius - 86, 1.2);
      d.stringState = 'bonus';
      d.stringStateTimer = 5;
    }
  }

  function finishStringSkill(f, e) {
    applyStringBonus(f, e);
  }

  function updateStringState(f, e, dt) {
    const d = stringData(f);
    d.stringBodyHitCd = Math.max(0, d.stringBodyHitCd - dt);
    d.stringWallCreateCd = Math.max(0, d.stringWallCreateCd - dt);
    d.stringCageCreateCd = Math.max(0, d.stringCageCreateCd - dt);
    if (e && e.data) {
      e.data.stringBodyThreads = activeBodyThreads(f, e).length;
      if (e.data.stringBodyLockTimer > 0) {
        e.data.stringBodyLockTimer = Math.max(0, e.data.stringBodyLockTimer - dt);
        e.data.positionLocked = true;
        e.applyStatus('stun', .12, { source: f, stringBodyLock: true });
      }
      if (e.data.stringParasiteTimer > 0) {
        e.data.stringParasiteTimer = Math.max(0, e.data.stringParasiteTimer - dt);
        const target = nearestStringThreadPoint(f, e);
        const n = norm(target.x - e.x, target.y - e.y);
        e.data.positionLocked = true;
        e.x = clamp(e.x + n.x * 430 * dt, e.radius, GAME_SIZE - e.radius);
        e.y = clamp(e.y + n.y * 430 * dt, e.radius, GAME_SIZE - e.radius);
        e.setDir(n.x, n.y);
        e.applyStatus('abilityDisabled', .12, { source: f });
      }
      if (e.data.stringPuppetTimer > 0) {
        e.data.stringPuppetTimer = Math.max(0, e.data.stringPuppetTimer - dt);
        const off = e.data.stringPuppetOffset || norm(e.x - f.x, e.y - f.y);
        const gap = Math.max(f.radius + e.radius + 24, e.data.stringPuppetDistance || dist(f.x, f.y, e.x, e.y));
        const desired = { x: clamp(f.x + off.x * gap, e.radius, GAME_SIZE - e.radius), y: clamp(f.y + off.y * gap, e.radius, GAME_SIZE - e.radius) };
        const n = norm(desired.x - e.x, desired.y - e.y);
        const step = Math.min(dist(e.x, e.y, desired.x, desired.y), 860 * dt);
        e.data.positionLocked = true;
        e.x = clamp(e.x + n.x * step, e.radius, GAME_SIZE - e.radius);
        e.y = clamp(e.y + n.y * step, e.radius, GAME_SIZE - e.radius);
        e.setDir(f.dir.x, f.dir.y);
        e.applyStatus('abilityDisabled', .12, { source: f, stringPuppet: true });
      }
      updateStringForcedSelfCast(f, e, dt);
    }

    if (d.stringState === 'bonus') {
      d.stringStateTimer -= dt;
        if (d.stringStateTimer <= 0) {
        const carryCount = d.stringCarryThreadCount || 0;
        const carryRecords = (d.stringCarryBreakRecords || []).slice();
          d.stringState = 'idle';
          d.stringCycleTimer = 5;
        d.stringThreadCount = carryCount;
          d.stringCycleStartTime = matchClock || 0;
        d.stringBreakRecords = carryRecords.map((r, i) => ({ ...r, timeInCycle: 0, order: i + 1 }));
        d.stringBreakOrder = d.stringBreakRecords.length;
        d.stringCarryThreadCount = 0;
        d.stringCarryBreakRecords = [];
        }
      return;
    }

    if (d.stringState === 'stringshot') {
      d.stringStateTimer -= dt;
      if (!d.stringShotResolved) resolveStringShot(f, e);
      if (d.stringStateTimer <= 0) finishStringSkill(f, e);
      return;
    }

    if (d.stringState === 'overheat') {
      d.stringStateTimer -= dt;
      if (d.stringStateTimer <= .52 && !d.stringOverheatResolved) resolveOverheat(f, e);
      if (d.stringStateTimer <= 0) finishStringSkill(f, e);
      return;
    }

    if (d.stringState === 'five') {
      d.stringStateTimer -= dt;
      if (e) {
        const n = norm(e.x - f.x, e.y - f.y);
        f.setDir(n.x, n.y);
        f.applyStatus('speed', .08, { mult: 1.55 });
        d.stringFiveTick -= dt;
        while (d.stringFiveTick <= 0) {
          d.stringFiveTick += .5;
          d.stringClawFrame = (d.stringClawFrame + 1) % 4;
          const close = dist(f.x, f.y, e.x, e.y) <= f.radius + e.radius + 88;
          if (close) {
            const dmg = Math.floor(rand(2, 8));
            d.stringClawHits = Math.min(5, (d.stringClawHits || 0) + 1);
            dealStringDamage(f, e, dmg, 'five-color-string');
            e.applyStatus('stun', .3, { source: f, fiveColor: true });
            projectiles.push({ type: 'string_five_slash', owner: f, target: e, angle: Math.atan2(n.y, n.x), life: .24, maxLife: .24 });
            playStringAudio('claw', 0.62, rand(.95, 1.05), 0.03);
          }
        }
      }
      if (d.stringStateTimer <= 0) finishStringSkill(f, e);
      return;
    }

    if (d.stringState === 'god') {
      f.data.positionLocked = true;
      timeScale = 1;
      hitStop = 0;
      d.stringStateTimer -= dt;
      d.stringGodElapsed = (d.stringGodElapsed || 0) + dt;
      const list = d.stringGodThreads || [];
      while ((d.stringGodNextIndex || 0) < list.length && d.stringGodElapsed >= list[d.stringGodNextIndex].delay) {
        const rec = list[d.stringGodNextIndex++];
        const aim = e ? norm(e.x - rec.x, e.y - rec.y) : norm(GAME_SIZE / 2 - rec.x, GAME_SIZE / 2 - rec.y);
        const targetX = e ? e.x : rec.x + aim.x * 720;
        const targetY = e ? e.y : rec.y + aim.y * 720;
        projectiles.push({
          type: 'string_god_thread',
          owner: f,
          target: e,
          anchorX: rec.x,
          anchorY: rec.y,
          hitX: targetX,
          hitY: targetY,
          pierceX: targetX + aim.x * 92,
          pierceY: targetY + aim.y * 92,
          damage: rec.damage,
          hit: false,
          life: .92,
          maxLife: .92,
          phase: rand(0, TAU),
          bendSign: Math.random() < .5 ? -1 : 1
        });
        playStringAudio('tension', 0.64, rand(.9, 1.04), .05);
      }
      const liveGod = projectiles.some(p => p.type === 'string_god_thread' && p.owner === f && p.life > 0);
      if ((d.stringGodNextIndex || 0) >= list.length && !liveGod && d.stringStateTimer <= .2) finishStringSkill(f, e);
      else if (d.stringStateTimer <= 0) finishStringSkill(f, e);
      return;
    }

    d.stringCycleTimer -= dt;
    if (d.stringCycleTimer <= 0) {
      const count = d.stringThreadCount || 0;
      if (count <= 0) {
        d.stringCycleTimer = 5;
        d.stringThreadCount = 0;
        d.stringCycleStartTime = matchClock || 0;
        d.stringBreakRecords = [];
        d.stringBreakOrder = 0;
      } else if (count <= 2) startStringShot(f, e, count);
      else if (count <= 4) startOverheat(f, e, count);
      else startGodThreads(f, e, count);
    }
  }

  const originalStringSpeedMult = Fighter.prototype.speedMult;
  Fighter.prototype.speedMult = function() {
    let mult = originalStringSpeedMult.call(this);
    const body = (this.data && this.data.stringBodyThreads) || 0;
    if (body > 0) mult *= Math.max(.12, 1 - body * .05);
    return Math.max(0, mult);
  };

  const originalStringTakeDamage = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source = null, label = 'hit', silent = false) {
    if (this.name === 'STRING' && source?.data?.stringSelfCastTimer > 0 && source.data.stringSelfCastOwner === this && source !== this && !source.data.stringSelfCastReflecting) {
      source.data.stringSelfCastReflecting = true;
      source.takeDamage(amount, source, `string-reflected-${label}`, true);
      source.data.stringSelfCastReflecting = false;
      return 0;
    }
    if (this.name === 'STRING' && this.isRage && source && source !== this) {
      const body = activeBodyThreads(this, source).length;
      if (body > 0) amount *= Math.max(.25, 1 - body * .05);
    }
    const stringReduction = stringGuardReduction(this);
    if (stringReduction > 0) {
      const reduction = stringReduction;
      if (reduction >= 1) return 0;
      amount *= (1 - reduction);
    }
    return originalStringTakeDamage.call(this, amount, source, label, silent);
  };

  const originalStringApplyStatus = Fighter.prototype.applyStatus;
  Fighter.prototype.applyStatus = function(name, duration, data = {}) {
    if (stringClawGuard(this) && data && data.source && data.source !== this) return;
    return originalStringApplyStatus.call(this, name, duration, data);
  };

  const originalStringUpdateProjectiles = updateProjectiles;
  updateProjectiles = function(dt) {
    for (const p of projectiles) {
      if (p && p.type === 'string_bird_cage' && p.life !== Infinity && p.life <= dt + 0.0001) explodeBirdCageThreads(p);
    }
    originalStringUpdateProjectiles(dt);
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (!p || !String(p.type || '').startsWith('string_')) continue;
      if (p.type === 'string_wall_thread') {
        if (!p.owner || p.owner.hp <= 0) { projectiles.splice(i, 1); continue; }
        if (p.anchorKind === 'cage' && p.cage && p.cage.life > 0 && Number.isFinite(p.cageAngle)) {
          const a = cageAnchorPoint(p.cage, p.cageAngle);
          p.x1 = a.x; p.y1 = a.y;
        }
        p.x2 = p.owner.x;
        p.y2 = p.owner.y;
        const enemy = fighters.find(f => f.id !== p.owner.id);
        const ownerState = p.owner && p.owner.data && p.owner.data.stringState;
        if (ownerState !== 'five' && ownerState !== 'god' && enemy && enemy.hp > 0 && distToSegment(enemy.x, enemy.y, p.x1, p.y1, p.x2, p.y2) <= enemy.radius + 8) {
          p.life = 0;
          const od = stringData(p.owner);
          od.stringThreadCount = (od.stringThreadCount || 0) + 1;
          od.stringBreakRecords ||= [];
          od.stringCycleStartTime ||= matchClock || 0;
          const breakRecord = {
            x: p.x1,
            y: p.y1,
            time: matchClock || 0,
            timeInCycle: clamp((matchClock || 0) - (od.stringCycleStartTime || 0), 0, 5),
            order: ++od.stringBreakOrder
          };
          od.stringBreakRecords.push(breakRecord);
          if (ownerState === 'bonus') {
            od.stringCarryThreadCount = (od.stringCarryThreadCount || 0) + 1;
            od.stringCarryBreakRecords ||= [];
            od.stringCarryBreakRecords.push({ ...breakRecord });
          }
          playStringAudio('break', 0.68, 1, 0.03);
          emitParticles(enemy.x, enemy.y, '#f5f5ff', 14, 330, 3, .28);
          projectiles.splice(i, 1);
          continue;
        }
      } else if (p.type === 'string_body_thread') {
        if (!p.owner || !p.target || p.owner.hp <= 0 || p.target.hp <= 0) { projectiles.splice(i, 1); continue; }
        if (p.anchorKind === 'cage' && p.cage && p.cage.life > 0 && Number.isFinite(p.cageAngle)) {
          const a = cageAnchorPoint(p.cage, p.cageAngle);
          p.x1 = a.x; p.y1 = a.y;
        }
        p.x2 = opponentAttachPoint(p.owner, p.target).x;
        p.y2 = opponentAttachPoint(p.owner, p.target).y;
      } else if (p.type === 'string_overheat_whip') {
        if (!p.owner || p.owner.hp <= 0) { projectiles.splice(i, 1); continue; }
        const origin = p.target ? handAnchorToward(p.owner, p.target, 'overheat') : handAnchor(p.owner, 'overheat');
        p.x1 = origin.x;
        p.y1 = origin.y;
      } else if (p.type === 'string_god_thread') {
        if (!p.owner || p.owner.hp <= 0) { projectiles.splice(i, 1); continue; }
        if (!p.hit && p.target && p.target.hp > 0) {
          const aim = norm(p.target.x - p.anchorX, p.target.y - p.anchorY);
          p.hitX = p.target.x;
          p.hitY = p.target.y;
          p.pierceX = p.target.x + aim.x * 102;
          p.pierceY = p.target.y + aim.y * 102;
        }
        const age = (p.maxLife || .92) - (p.life || 0);
        if (!p.hit && age >= .28 && p.target && p.target.hp > 0) {
          p.hit = true;
          if (p.owner && p.owner.data) p.owner.data.stringGodPierced = Math.min(5, (p.owner.data.stringGodPierced || 0) + 1);
          dealStringDamage(p.owner, p.target, p.damage || 5, 'god-threads');
          if (p.owner && p.owner.data) p.owner.data.stringGodPulseUntil = (matchClock || 0) + .32;
          p.target.applyStatus('stun', .3, { source: p.owner, godThread: true });
          playStringAudio('claw', 0.68, rand(.94, 1.08), 0.02);
          emitParticles(p.target.x, p.target.y, '#120414', 12, 260, 3.5, .25);
          emitParticles(p.target.x, p.target.y, '#b45cff', 10, 320, 3, .22);
        }
      } else if (p.type === 'string_bird_cage') {
        p.contactCd = Math.max(0, (p.contactCd || 0) - dt);
        p.flash = Math.max(0, (p.flash || 0) - dt * 5);
        const progress = 1 - p.life / p.maxLife;
        p.radius = lerp(p.startRadius, p.minRadius, clamp(progress, 0, 1));
        for (const fighter of fighters) {
          if (!fighter || fighter.hp <= 0) continue;
          const dd = Math.max(1, dist(fighter.x, fighter.y, p.x, p.y));
          if (dd + fighter.radius >= p.radius) {
            const n = norm(fighter.x - p.x, fighter.y - p.y);
            const limit = Math.max(1, p.radius - fighter.radius - 3);
            fighter.x = clamp(p.x + n.x * limit, fighter.radius, GAME_SIZE - fighter.radius);
            fighter.y = clamp(p.y + n.y * limit, fighter.radius, GAME_SIZE - fighter.radius);
            if (fighter.dir.x * n.x + fighter.dir.y * n.y > 0) {
              const r = reflectDir(fighter.dir, n.x, n.y);
              if (Number.isFinite(r.x) && Number.isFinite(r.y)) fighter.setDir(r.x, r.y);
              else fighter.setDir(-n.x, -n.y);
            }
            if (fighter === p.owner) {
              const d = stringData(fighter);
              const angle = Math.atan2(n.y, n.x);
              const last = d.stringLastCageBoundary;
              const angleDelta = last ? Math.abs(Math.atan2(Math.sin(angle - last.angle), Math.cos(angle - last.angle))) : Infinity;
              if (d.stringCageCreateCd <= 0 && (!last || matchClock - last.time > .22 || angleDelta > .18)) {
                d.stringCageCreateCd = .18;
                d.stringLastCageBoundary = { angle, time: matchClock || 0 };
                handleStringBoundaryContact(fighter, { kind: 'cage', cage: p, angle, x: p.x + n.x * p.radius, y: p.y + n.y * p.radius });
              }
            }
            p.flash = Math.max(p.flash || 0, .45);
          }
        }
      }
      if (p.life !== Infinity && p.life <= 0) projectiles.splice(i, 1);
    }
  };

  const originalStringDrawProjectiles = drawProjectiles;
  drawProjectiles = function(ctx) {
    originalStringDrawProjectiles(ctx);
    drawGodThreadsCircle(ctx);
    for (const p of projectiles) {
      if (!p || !String(p.type || '').startsWith('string_')) continue;
      ctx.save();
      if (p.type === 'string_wall_thread') {
        if (p.owner) { p.x2 = p.owner.x; p.y2 = p.owner.y; }
        if (p.anchorKind === 'cage' && p.cage && p.cage.life > 0 && Number.isFinite(p.cageAngle)) {
          const a = cageAnchorPoint(p.cage, p.cageAngle);
          p.x1 = a.x; p.y1 = a.y;
        }
        ctx.globalAlpha = .58;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#f7f7ff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(150,170,210,.7)';
        ctx.lineWidth = .9;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (p.type === 'string_body_thread') {
        const target = p.target;
        if (target) {
          if (p.anchorKind === 'cage' && p.cage && p.cage.life > 0 && Number.isFinite(p.cageAngle)) {
            const a = cageAnchorPoint(p.cage, p.cageAngle);
            p.x1 = a.x; p.y1 = a.y;
          }
          const attach = opponentAttachPoint(p.owner, target);
          p.x2 = attach.x; p.y2 = attach.y;
          const dx = p.x2 - p.x1, dy = p.y2 - p.y1;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len, ny = dx / len;
          const wobble = Math.sin(Date.now() / 260 + (p.phase || 0)) * clamp(len * .035, 4, 22);
          const cx = (p.x1 + p.x2) / 2 + nx * wobble;
          const cy = (p.y1 + p.y2) / 2 + ny * wobble;
          ctx.globalAlpha = .44;
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(255,96,190,.95)';
          ctx.shadowColor = '#ff8fd4';
          ctx.shadowBlur = 12;
          ctx.lineWidth = 5.2;
          ctx.beginPath();
          ctx.moveTo(p.x1, p.y1);
          ctx.quadraticCurveTo(cx, cy, p.x2, p.y2);
          ctx.stroke();
          ctx.globalAlpha = .92;
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#ffd1ee';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(p.x1, p.y1);
          ctx.quadraticCurveTo(cx, cy, p.x2, p.y2);
          ctx.stroke();
          ctx.globalAlpha = .62;
          ctx.strokeStyle = '#ff77c8';
          ctx.lineWidth = 1.05;
          ctx.setLineDash([7, 10]);
          ctx.beginPath();
          ctx.moveTo(p.x1, p.y1);
          ctx.quadraticCurveTo(cx - nx * 5, cy - ny * 5, p.x2, p.y2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else if (p.type === 'string_shot_line') {
        if (p.owner && p.target) {
          const origin = handAnchorToward(p.owner, p.target, 'front');
          const aim = norm(p.target.x - origin.x, p.target.y - origin.y);
          p.x1 = origin.x; p.y1 = origin.y;
          p.x2 = origin.x + aim.x * (p.length || 1400);
          p.y2 = origin.y + aim.y * (p.length || 1400);
        }
        const a = clamp(p.life / p.maxLife, 0, 1);
        const t = 1 - a;
        const dx = p.x2 - p.x1, dy = p.y2 - p.y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#ff8fd4';
        ctx.shadowBlur = 14;
        for (let j = -2; j <= 2; j++) {
          const off = j * 5 + Math.sin(Date.now() / 95 + j + (p.phase || 0)) * 2.5;
          ctx.globalAlpha = (j === 0 ? .96 : .54) * a;
          ctx.strokeStyle = j === 0 ? '#fff3fb' : 'rgba(255,145,210,.9)';
          ctx.lineWidth = j === 0 ? 3.2 : 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x1 + nx * off, p.y1 + ny * off);
          ctx.lineTo(p.x2 + nx * off, p.y2 + ny * off);
          ctx.stroke();
        }
        ctx.globalAlpha = .9 * a;
        ctx.fillStyle = '#fff3fb';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(lerp(p.x1, p.x2, t), lerp(p.y1, p.y2, t), 6, 0, TAU);
        ctx.fill();
      } else if (p.type === 'string_overheat_whip') {
        const a = clamp(p.life / p.maxLife, 0, 1);
        if (p.owner) {
          const origin = p.target ? handAnchorToward(p.owner, p.target, 'overheat') : handAnchor(p.owner, 'overheat');
          p.x1 = origin.x; p.y1 = origin.y;
          const target = p.target;
          if (target) {
            const aim = norm(target.x - origin.x, target.y - origin.y);
            p.aimX = aim.x;
            p.aimY = aim.y;
            const swing = Math.sin((1 - a) * Math.PI) * 190;
            p.cx = (origin.x + target.x) / 2 - aim.y * (115 + swing);
            p.cy = (origin.y + target.y) / 2 + aim.x * (115 + swing);
          }
        }
        const progress = 1 - a;
        const tx = Number.isFinite(p.aimX) ? p.aimX : norm(p.x2 - p.x1, p.y2 - p.y1).x;
        const ty = Number.isFinite(p.aimY) ? p.aimY : norm(p.x2 - p.x1, p.y2 - p.y1).y;
        const nx = -ty, ny = tx;
        const side = p.swingSide || 1;
        const windup = { x: p.x1 - tx * 470 + nx * side * 560, y: p.y1 - ty * 470 + ny * side * 560 };
        const strike = { x: p.x1 + tx * 1660, y: p.y1 + ty * 1660 };
        const swingT = smoothstep(clamp((progress - .18) / .5, 0, 1));
        p.x2 = lerp(windup.x, strike.x, swingT);
        p.y2 = lerp(windup.y, strike.y, swingT);
        const targetPoint = p.target ? { x: p.target.x, y: p.target.y } : { x: p.x1 + tx * 720, y: p.y1 + ty * 720 };
        const c1 = { x: lerp(windup.x, p.x1 - tx * 180 + nx * side * 420, swingT), y: lerp(windup.y, p.y1 - ty * 180 + ny * side * 420, swingT) };
        const c2 = { x: lerp(windup.x, targetPoint.x - tx * 250 + nx * side * 190, swingT), y: lerp(windup.y, targetPoint.y - ty * 250 + ny * side * 190, swingT) };
        const impactT = .72;
        const points = [];
        for (let j = 0; j <= 14; j++) {
          const t = j / 14;
          let qx, qy;
          if (t <= impactT) {
            const u = t / impactT;
            const mu = 1 - u;
            qx = mu * mu * mu * p.x1 + 3 * mu * mu * u * c1.x + 3 * mu * u * u * c2.x + u * u * u * targetPoint.x;
            qy = mu * mu * mu * p.y1 + 3 * mu * mu * u * c1.y + 3 * mu * u * u * c2.y + u * u * u * targetPoint.y;
          } else {
            const u = (t - impactT) / (1 - impactT);
            qx = lerp(targetPoint.x, p.x2, u);
            qy = lerp(targetPoint.y, p.y2, u);
          }
          const impactMask = Math.min(1, Math.abs(t - impactT) * 5.5);
          const wave = Math.sin(t * Math.PI * 1.85 - progress * Math.PI * 5.2 + (p.phase || 0)) * (1 - t * .28) * Math.sin(progress * Math.PI) * 24 * impactMask;
          const snap = Math.sin(Math.min(1, progress * 1.4) * Math.PI) * 18 * Math.pow(t, 1.4) * impactMask;
          points.push({ x: qx + nx * (wave + snap), y: qy + ny * (wave + snap) });
        }
        ctx.globalAlpha = .98 * a;
        ctx.shadowColor = '#ff3b16';
        ctx.shadowBlur = 22;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let j = 1; j < points.length; j++) ctx.lineTo(points[j].x, points[j].y);
        ctx.strokeStyle = '#ff4a18';
        ctx.lineWidth = 7.5;
        ctx.stroke();
        ctx.strokeStyle = '#ffd1a0';
        ctx.lineWidth = 2.3;
        ctx.stroke();
        const img = stringImgs.overheatThread;
        if (img && img.complete && img.naturalWidth && points.length > 2) {
          const tip = points[Math.floor(points.length * .72)];
          ctx.save();
          ctx.translate(tip.x, tip.y);
          ctx.rotate(Math.atan2(ty, tx) + Math.PI / 2);
          ctx.globalAlpha = .32 * a;
          ctx.drawImage(img, -18, -110, 36, 220);
          ctx.restore();
        }
      } else if (p.type === 'string_god_thread') {
        const age = (p.maxLife || .92) - (p.life || 0);
        const anchor = { x: p.anchorX, y: p.anchorY };
        const hit = { x: p.hitX, y: p.hitY };
        const pierce = { x: p.pierceX, y: p.pierceY };
        let tip = anchor, tail = anchor, alpha = 1;
        if (age < .07) {
          const t = smoothstep(clamp(age / .07, 0, 1));
          tip = { x: lerp(anchor.x, hit.x, t * .2), y: lerp(anchor.y, hit.y, t * .2) };
          tail = anchor;
          alpha = t;
        } else if (age < .31) {
          const t = smoothstep(clamp((age - .07) / .24, 0, 1));
          tip = { x: lerp(anchor.x, pierce.x, t), y: lerp(anchor.y, pierce.y, t) };
          tail = anchor;
        } else if (age < .46) {
          tip = pierce;
          tail = anchor;
        } else {
          const t = smoothstep(clamp((age - .46) / .46, 0, 1));
          tip = { x: lerp(pierce.x, anchor.x, t), y: lerp(pierce.y, anchor.y, t) };
          tail = anchor;
          alpha = 1 - t * .68;
        }
        const dx = tip.x - tail.x, dy = tip.y - tail.y;
        const len = Math.hypot(dx, dy) || 1;
        const points = godThreadCurvePoints(p, tail, tip, age);
        const drewAsset = drawGodThreadAsset(ctx, points, .98 * alpha);
        if (drewAsset) {
          drawGodThreadTipAsset(ctx, points, .98 * alpha);
        }
        if (!drewAsset) {
          const nx = -dy / len, ny = dx / len;
          ctx.globalAlpha = .92 * alpha;
          ctx.shadowColor = '#8e35ff';
          ctx.shadowBlur = 20;
          ctx.strokeStyle = 'rgba(24, 4, 34, .96)';
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let k = 1; k < points.length; k++) ctx.lineTo(points[k].x, points[k].y);
          ctx.stroke();
          ctx.globalAlpha = .9 * alpha;
          ctx.shadowBlur = 9;
          ctx.strokeStyle = '#0b050e';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let k = 1; k < points.length; k++) ctx.lineTo(points[k].x, points[k].y);
          ctx.stroke();
          const head = points[points.length - 1];
          const prev = points[Math.max(0, points.length - 3)];
          const hdx = head.x - prev.x, hdy = head.y - prev.y;
          const hLen = Math.hypot(hdx, hdy) || 1;
          const ux = hdx / hLen, uy = hdy / hLen;
          const hx = -uy, hy = ux;
          ctx.globalAlpha = .98 * alpha;
          ctx.shadowColor = '#b45cff';
          ctx.shadowBlur = 18;
          ctx.fillStyle = '#08030d';
          ctx.strokeStyle = '#d998ff';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(head.x + ux * 8, head.y + uy * 8);
          ctx.lineTo(head.x - ux * 38 + hx * 15, head.y - uy * 38 + hy * 15);
          ctx.lineTo(head.x - ux * 26, head.y - uy * 26);
          ctx.lineTo(head.x - ux * 38 - hx * 15, head.y - uy * 38 - hy * 15);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      } else if (p.type === 'string_five_slash') {
        const target = p.target;
        if (target) {
          const a = clamp(p.life / p.maxLife, 0, 1);
          ctx.translate(target.x, target.y);
          ctx.rotate(p.angle || 0);
          ctx.globalAlpha = .98 * a;
          const img = stringImgs.fiveSlash;
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 18;
          if (img && img.complete && img.naturalWidth) ctx.drawImage(img, -155, -118, 310, 236);
          else {
            const colors = ['#ff3333','#ffe342','#3cff62','#44a8ff','#b34cff'];
            for (let j = 0; j < 5; j++) {
              ctx.strokeStyle = colors[j];
              ctx.lineWidth = 5;
              ctx.beginPath();
              ctx.moveTo(-95, -44 + j * 22);
              ctx.lineTo(95, -14 + j * 10);
              ctx.stroke();
            }
          }
        }
      } else if (p.type === 'string_body_pulse') {
        const t = p.target;
        if (t && p.owner) {
          drawBodyThreadBundle(ctx, p, .86);
          const a = clamp(p.life / p.maxLife, 0, 1);
          const overlay = p.mode === 'puppet' ? stringImgs.pinkWeb : stringImgs.bodyWeb;
          if (overlay && overlay.complete && overlay.naturalWidth && p.mode !== 'tighten') {
            const size = t.radius * (p.mode === 'puppet' ? 3.2 : p.mode === 'web-lock' ? 3.55 : 2.95);
            ctx.translate(t.x, t.y);
            ctx.rotate(Math.sin(Date.now() / 560) * .08);
            ctx.globalAlpha = (p.mode === 'puppet' ? .58 : p.mode === 'web-lock' ? .96 : .64) * Math.min(1, a * 1.8);
            if (p.mode === 'web-lock') {
              ctx.shadowColor = '#ffffff';
              ctx.shadowBlur = 14;
              ctx.globalCompositeOperation = 'lighter';
            }
            ctx.drawImage(overlay, -size / 2, -size / 2, size, size);
          } else {
            ctx.globalAlpha = .72 * a;
            ctx.strokeStyle = p.mode === 'web-lock' ? '#fff3fb' : '#ffb7e4';
            ctx.lineWidth = p.mode === 'web-lock' ? 4.5 : 3;
            ctx.lineCap = 'round';
            const strands = p.mode === 'tighten' ? 4 : 7;
            for (let j = 0; j < strands; j++) {
              const wobble = Math.sin(Date.now() / 150 + j * 1.7) * 18;
              const ox = Math.cos(j * TAU / strands) * (t.radius * .45);
              const oy = Math.sin(j * TAU / strands) * (t.radius * .45);
              ctx.beginPath();
              ctx.moveTo(p.owner.x, p.owner.y);
              ctx.quadraticCurveTo((p.owner.x + t.x) / 2 + wobble, (p.owner.y + t.y) / 2 - wobble * .45, t.x + ox, t.y + oy);
              ctx.stroke();
            }
          }
        }
      } else if (p.type === 'string_bird_cage') {
        const a = clamp(p.life / p.maxLife, 0, 1);
        ctx.translate(p.x, p.y);
        ctx.globalAlpha = .42 + .28 * (p.flash || 0);
        const img = stringImgs.birdCage;
        if (img && img.complete && img.naturalWidth) ctx.drawImage(img, -p.radius, -p.radius, p.radius * 2, p.radius * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 + 3 * (p.flash || 0);
        for (let j = 0; j < 36; j++) {
          const ang = j * TAU / 36;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang) * p.radius, Math.sin(ang) * p.radius);
          ctx.stroke();
        }
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, TAU);
        ctx.stroke();
      } else if (p.type === 'string_text') {
        const a = clamp(p.life / p.maxLife, 0, 1);
        ctx.globalAlpha = Math.min(1, a * 1.25);
        const textW = p.kind === 'god' ? 430 : (p.kind === 'five' || p.kind === 'parasite' ? 360 : 310);
        const textH = p.kind === 'god' ? 118 : 94;
        drawStringTextImage(ctx, p.kind, p.x, p.y - (1 - a) * 12, textW, textH);
      }
      ctx.restore();
    }
    for (const f of fighters) drawPendingBodyContact(ctx, f);
  };

  const originalStringDrawFighter = Fighter.prototype.draw;
  Fighter.prototype.draw = function(ctx) {
    originalStringDrawFighter.call(this, ctx);
    for (const p of projectiles) {
      if (!p || p.type !== 'string_body_pulse' || p.target !== this || p.life <= 0) continue;
      const a = clamp(p.life / p.maxLife, 0, 1);
      drawBodyThreadBundle(ctx, p, .74);
      ctx.save();
      ctx.translate(this.x, this.y);
      if (p.mode === 'tighten') {
        ctx.globalAlpha = p.mode === 'web-lock' ? .95 * a : .72 * a;
        ctx.strokeStyle = '#ff9fd8';
        if (p.mode === 'web-lock') ctx.strokeStyle = '#ffffff';
        ctx.shadowColor = '#ff7ccd';
        if (p.mode === 'web-lock') ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
          const ang = i * TAU / 6 + Date.now() / 420;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * this.radius * .25, Math.sin(ang) * this.radius * .25);
          ctx.lineTo(Math.cos(ang + .9) * this.radius * 1.35, Math.sin(ang + .9) * this.radius * 1.35);
          ctx.stroke();
        }
      } else {
        const overlay = p.mode === 'puppet' ? stringImgs.pinkWeb : stringImgs.bodyWeb;
        const size = this.radius * (p.mode === 'puppet' ? 3.35 : p.mode === 'web-lock' ? 3.75 : 3.1);
        ctx.rotate(Math.sin(Date.now() / 520) * .08);
        ctx.globalAlpha = (p.mode === 'puppet' ? .62 : p.mode === 'web-lock' ? .98 : .68) * Math.min(1, a * 2.1);
        if (p.mode === 'web-lock') {
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 16;
          ctx.globalCompositeOperation = 'lighter';
        }
        if (overlay && overlay.complete && overlay.naturalWidth) ctx.drawImage(overlay, -size / 2, -size / 2, size, size);
      }
      ctx.restore();
    }
    const hasLock = this.statuses && Object.values(this.statuses).some(s => s && s.data && s.data.stringBodyLock);
    const parasite = this.data && this.data.stringParasiteTimer > 0;
    const puppet = this.data && this.data.stringPuppetTimer > 0;
    if (this.name !== 'STRING' && (hasLock || parasite || puppet)) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const img = puppet ? stringImgs.pinkWeb : stringImgs.bodyWeb;
      const pulse = .96 + Math.sin(Date.now() / 240) * .035;
      const size = this.radius * (puppet ? 3.15 : hasLock ? 3.65 : 2.9) * pulse;
      ctx.globalAlpha = puppet ? .48 : hasLock ? .92 : .54;
      if (hasLock) {
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 16;
        ctx.globalCompositeOperation = 'lighter';
      }
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img, -size / 2, -size / 2, size, size);
      else {
        ctx.strokeStyle = puppet ? '#ff8fd4' : '#eef2ff';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(-size * .35, -size * .35 + i * size * .18);
          ctx.lineTo(size * .35, size * .28 - i * size * .13);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  };

  Object.assign(stringType, {
    color: '#f0a6d4',
    desc: 'Wall and body thread control',
    speed: 519,
    init: f => { stringData(f); },
    speedModifier: f => {
      const live = activeStringThreads(f).length;
      return Math.min(4.2, 1 + live * .05);
    },
    onWallBounce: (f, side) => handleStringBoundaryContact(f, side),
    onCollide: (f, e) => { if (stringData(f).stringState !== 'five') rememberOpponentContact(f, e); return stringData(f).stringState === 'five'; },
    update: (f, e, dt) => updateStringState(f, e, dt),
    draw: (ctx, f) => {
      const d = stringData(f);
      const state = d.stringState;
      let img = stringImgs.main;
      if (state === 'stringshot') img = stringImgs.shotPose;
      else if (state === 'overheat') img = ((d.stringOverheatWhipPoseAt || Infinity) <= (matchClock || 0)) ? stringImgs.overheatWhipPose : stringImgs.overheatPose;
      else if (state === 'god') img = stringImgs.godPose;
      else if (state === 'five') img = stringImgs.clawFrames;
      const drawR = f.radius * STRING_RENDER_SCALE;
      ctx.save();
      ctx.rotate(stringRenderRotation(f));
      if (state === 'five' && img && img.complete && img.naturalWidth) {
        const frame = d.stringClawFrame || 0;
        const fw = img.naturalWidth / 4;
        ctx.drawImage(img, fw * frame, 0, fw, img.naturalHeight, -drawR, -drawR, drawR * 2, drawR * 2);
      } else if (img && img.complete && img.naturalWidth) {
        ctx.drawImage(img, -drawR, -drawR, drawR * 2, drawR * 2);
      } else {
        drawSketchBlob(ctx, f.radius, '#f0a6d4', 14);
      }
      ctx.restore();
    }
  });

  window.apexStringChampionPatch = 'ready';
})();
