
window.apexEarlyErrors = [];
window.onerror = function(message, source, lineno, colno, error) {
    window.apexEarlyErrors.push({ message: String(message), lineno, colno, stack: error && error.stack });
};
var canvas = document.getElementById('game-canvas');
var ctx = canvas.getContext('2d', { alpha: false });
var GAME_SIZE = 1000;
var WALL_SKETCH = '#6c6557';

var lastTime = 0, reqId = null, gameState = 'MENU';
var timeScale = 1.0, hitStop = 0, cameraShake = 0, cameraZoom = 1.0;
var arenaFlash = { r: 0, g: 0, b: 0, a: 0 };
var fighters = [], particles = [], projectiles = [], floatingTexts = [], shockwaves = [];
var p1Selection = null, p2Selection = null;
var calcOverlay = null;
var tournamentSeeds = [];
var tournamentState = null;
var activeTournamentMatchId = null;
var pendingTournamentMatchId = null;
var tournamentModeActive = false;
var matchStartTime = 0;
var matchClock = 0;
var currentChallenge = null;
var sawWallRage = { timer: 0, owner: null, phase: 0 };
var autoBattlePaused = false;
var autoBattleControlsActive = false;
var autoBattleLastConfig = null;
var AUTO_BATTLE_INF_HP = 1e12;
var DEFAULT_MATCH_HP = 1000;

// Battle audio runtime now loads from /game/core/apexBattleAudioRuntime.js.
var TAU = Math.PI * 2;
var STATUS_VFX = {
    stun: (() => {
        const img = new Image();
        img.src = '/assets/status_vfx/stun_swirl.webp';
        return img;
    })()
};

var clamp = (v, min, max) => Math.max(min, Math.min(max, v));
function hpRatio(entity) {
    return entity && Number.isFinite(entity.maxHp) && entity.maxHp > 0 ? entity.hp / entity.maxHp : 1;
}
function isHpBelowRatio(entity, ratio) {
    return !!entity && entity.hp > 0 && hpRatio(entity) <= ratio;
}
function shouldTriggerRage(entity) {
    return !!entity && !entity.isRage && !entity.type?.noRage && isHpBelowRatio(entity, 0.5);
}
var rand = (min, max) => Math.random() * (max - min) + min;
var dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
var lerp = (a, b, t) => a + (b - a) * t;
function norm(x, y) {
    const m = Math.hypot(x, y) || 1;
    return { x: x / m, y: y / m };
}
function dot(ax, ay, bx, by) { return ax * bx + ay * by; }
function reflectDir(dir, nx, ny) {
    const d = dir.x * nx + dir.y * ny;
    return norm(dir.x - 2 * d * nx, dir.y - 2 * d * ny);
}
function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2-x1)**2 + (y2-y1)**2;
    if (l2 === 0) return dist(px, py, x1, y1);
    const t = clamp(((px-x1)*(x2-x1)+(py-y1)*(y2-y1))/l2, 0, 1);
    return dist(px, py, x1 + t*(x2-x1), y1 + t*(y2-y1));
}
function pointOnRayToEdge(x, y, dx, dy) {
    const tx = dx > 0 ? (GAME_SIZE - x) / dx : dx < 0 ? (0 - x) / dx : Infinity;
    const ty = dy > 0 ? (GAME_SIZE - y) / dy : dy < 0 ? (0 - y) / dy : Infinity;
    const t = Math.min(tx > 0 ? tx : Infinity, ty > 0 ? ty : Infinity);
    return { x: x + dx * t, y: y + dy * t };
}
function signedAmount(amount) {
    const fixed = Math.abs(amount).toFixed(1);
    return amount >= 0 ? `+${fixed}` : `-${fixed}`;
}
function poisonLevelFromExposure(exposure = 0) {
    if (exposure >= 10) return 5;
    if (exposure >= 7.5) return 4;
    if (exposure >= 5) return 3;
    if (exposure >= 3) return 2;
    if (exposure >= 1.5) return 1;
    return 0;
}
function smoothstep(t) {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
}
function triggerFlash(r, g, b, a) { arenaFlash = { r, g, b, a }; }
function spawnShockwave(x, y, color, maxR = 150) {
    shockwaves.push({ x, y, r: 10, maxR, alpha: 1, color });
}
function drawStunAsset(ctx, radius) {
    const img = STATUS_VFX.stun;
    if (!img?.complete || !img.naturalWidth) return;
    const size = clamp(radius * 1.15, 62, 104);
    const y = -radius - size * .42;
    ctx.save();
    ctx.translate(0, y);
    ctx.rotate(matchClock * 4.8);
    ctx.globalCompositeOperation = 'screen';
    ctx.shadowColor = '#4fe8ff';
    ctx.shadowBlur = 10;
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
}

var SOUND_ID = {
    RUBBER: { base: 150, wave: 'sine', bend: 2.25, noise: 0.06 },
    ICE: { base: 720, wave: 'triangle', bend: 0.48, noise: 0.03 },
    VAMPIRE: { base: 82, wave: 'sawtooth', bend: 0.62, noise: 0.05 },
    STRING: { base: 430, wave: 'square', bend: 1.35, noise: 0.025 },
    VOLCANO: { base: 58, wave: 'sawtooth', bend: 0.38, noise: 0.12 },
    MAGNET: { base: 120, wave: 'sine', bend: 1.02, noise: 0.035 },
    FLASH: { base: 920, wave: 'sawtooth', bend: 2.7, noise: 0.02 },
    ELECTRIC: { base: 980, wave: 'square', bend: 0.31, noise: 0.07 },
    ORBIT: { base: 530, wave: 'sine', bend: 1.62, noise: 0.02 },
    TOXIC: { base: 190, wave: 'triangle', bend: 0.58, noise: 0.09 },
    MIRROR: { base: 840, wave: 'triangle', bend: 1.42, noise: 0.025 },
    BLACK_HOLE: { base: 42, wave: 'sine', bend: 0.42, noise: 0.045 },
    SAW: { base: 310, wave: 'sawtooth', bend: 1.1, noise: 0.11 },
    BLADE: { base: 640, wave: 'triangle', bend: 1.85, noise: 0.04 },
    NOVA: { base: 240, wave: 'sine', bend: 3.25, noise: 0.035 },
    HUNTER: { base: 520, wave: 'triangle', bend: 1.48, noise: 0.035 },
    CRYSTAL: { base: 900, wave: 'sine', bend: 1.72, noise: 0.025 },
    MATH: { base: 460, wave: 'square', bend: 1.18, noise: 0.015 },
    VIRUS: { base: 115, wave: 'sawtooth', bend: 0.72, noise: 0.10 },
    CARD: { base: 620, wave: 'triangle', bend: 1.32, noise: 0.018 },
    DRUM: { base: 95, wave: 'sine', bend: 0.55, noise: 0.16 },
    SLIME: { base: 210, wave: 'sine', bend: .65, noise:.08 }, TIME: { base: 520, wave: 'square', bend: .8, noise:.02 }, WOLF:{base:140,wave:'sawtooth',bend:.55,noise:.07}, WIND:{base:620,wave:'sine',bend:1.8,noise:.05}, WITCH:{base:760,wave:'triangle',bend:.72,noise:.03}, PIRATE:{base:180,wave:'sawtooth',bend:.62,noise:.08}, PAINTER:{base:460,wave:'triangle',bend:1.4,noise:.025}, MONK:{base:300,wave:'triangle',bend:1.2,noise:.04}, SUPERSTAR:{base:680,wave:'sine',bend:1.55,noise:.035}
};
var battleNoiseBuffers = new Map();
var battleAudioResumePromise = null;
function ensureBattleAudioReady() {
    if (window.__apexStatsSilent) return;
    if (audioCtx.state === 'running') return;
    if (!battleAudioResumePromise) {
        battleAudioResumePromise = audioCtx.resume().catch(() => {}).finally(() => { battleAudioResumePromise = null; });
    }
}
function playNoise(duration, gainValue, filterFreq = 900, type = 'bandpass') {
    if (window.__apexStatsSilent) return;
    ensureBattleAudioReady();
    const now = audioCtx.currentTime;
    const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
    let buffer = battleNoiseBuffers.get(bufferSize);
    if (!buffer) {
        buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        battleNoiseBuffers.set(bufferSize, buffer);
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(6, now);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter); filter.connect(gain); gain.connect(battleAudioMaster);
    src.start(now); src.stop(now + duration);
}
function playTone(freq, endFreq, dur, wave, gainValue, when = 0) {
    if (window.__apexStatsSilent) return;
    const now = audioCtx.currentTime + when;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(Math.max(20, freq), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain); gain.connect(battleAudioMaster);
    osc.start(now); osc.stop(now + dur);
}
var ASSET_ONLY_FIGHTER_SFX = new Set(['ICE', 'STRING', 'GALAXY', 'SOCCER', 'NINJA', 'SHOTGUN']);
function playFighterSound(fighterOrName, action = 'skill') {
    ensureBattleAudioReady();
    const name = typeof fighterOrName === 'string' ? fighterOrName : fighterOrName.name;
    if (action === 'skill' && typeof fighterOrName !== 'string') recordSkill(fighterOrName);
    if (ASSET_ONLY_FIGHTER_SFX.has(name)) return;
    const p = SOUND_ID[name] || { base: 300, wave: 'triangle', bend: 1.2, noise: 0.03 };
    const dur = action === 'death' ? 0.55 : action === 'wall' ? 0.16 : 0.32;
    const g = action === 'death' ? 0.22 : action === 'wall' ? 0.09 : 0.14;
    const start = action === 'wall' ? p.base * 0.72 : action === 'death' ? p.base * 0.85 : p.base;
    const end = action === 'death' ? Math.max(24, p.base * 0.22) : start * p.bend;
    playTone(start, end, dur, p.wave, g);
    if (action !== 'wall') playTone(start * 1.51, Math.max(28, end * 0.82), dur * 0.85, name === 'ELECTRIC' || name === 'MATH' ? 'square' : 'sine', g * 0.38, 0.018);
    if (p.noise) playNoise(dur * 0.72, p.noise * (action === 'death' ? 1.7 : 1), name === 'SAW' ? 1600 : name === 'VOLCANO' ? 180 : name === 'TOXIC' ? 650 : name === 'ICE' ? 2200 : 900);

    if (name === 'RUBBER' && action !== 'death') playTone(110, 330, 0.12, 'sine', 0.07, 0.04);
    if (name === 'ICE' && action === 'skill') { playNoise(0.16, 0.04, 3000, 'highpass'); playTone(1100, 420, 0.18, 'triangle', 0.06, 0.08); }
    if (name === 'VAMPIRE' && action === 'skill') playTone(65, 45, 0.38, 'sawtooth', 0.08, 0.02);
    if (name === 'FLASH' && action === 'skill') { playTone(1400, 2800, 0.055, 'sawtooth', 0.08); playNoise(0.08, 0.025, 3600, 'highpass'); }
    if (name === 'BLACK_HOLE' && action === 'skill') playTone(36, 22, 0.48, 'sine', 0.16);
    if (name === 'BLADE' && action === 'skill') playNoise(0.11, 0.055, 2400, 'highpass');
    if (name === 'CRYSTAL' && action === 'skill') { playTone(1320, 1760, 0.16, 'sine', 0.05); playTone(660, 990, 0.18, 'triangle', 0.04, 0.03); }
    if (name === 'MATH' && action === 'skill') { playTone(420, 420, 0.045, 'square', 0.035); playTone(520, 520, 0.045, 'square', 0.035, 0.06); playTone(640, 640, 0.045, 'square', 0.035, 0.12); playTone(900, 520, 0.11, 'square', 0.05, 0.22); }
    if (name === 'VIRUS' && action === 'skill') { playTone(90, 54, 0.12, 'sawtooth', 0.055); playNoise(0.15, 0.035, 520, 'bandpass'); }
    if (name === 'CARD' && action === 'skill') { playTone(740, 880, 0.055, 'triangle', 0.05); playTone(520, 420, 0.08, 'sine', 0.03, 0.055); }
    if (name === 'DRUM') { playTone(action==='wall'?120:82, action==='wall'?55:42, action==='wall'?.18:.34, 'sine', action==='wall'?.13:.20); playNoise(action==='wall'?.12:.24, .08, 180, 'lowpass'); }
}

var FloatingText = class FloatingText {
    constructor(x, y, text, color) {
        this.x = x + rand(-30, 30);
        this.y = y + rand(-18, 18);
        this.text = text;
        this.color = color;
        this.life = 0.9;
        this.maxLife = 0.9;
        this.vy = -75;
    }
    update(dt) { this.y += this.vy * dt; this.life -= dt; }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.font = `900 ${this.size || 33}px 'Segoe UI'`;
        ctx.textAlign = "center";
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#050505";
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
};
function spawnDamageText(x, y, amount, isHeal = false) {
    if (!Number.isFinite(amount) || amount === 0) return;
    floatingTexts.push(new FloatingText(x, y, signedAmount(isHeal ? amount : -amount), isHeal ? "#44ff7a" : "#ff5950"));
}

var Particle = class Particle {
    constructor(x, y, color, vx, vy, life, size, type = "normal") {
        this.x = x; this.y = y; this.color = color; this.vx = vx; this.vy = vy;
        this.life = life; this.maxLife = life; this.size = size; this.type = type;
    }
    update(dt) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        if (this.type === 'friction') { this.vx *= 0.90; this.vy *= 0.90; }
        this.life -= dt;
    }
    draw(ctx) {
        const a = Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#0b0b0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (this.type === 'square') ctx.rect(this.x - this.size*a, this.y - this.size*a, this.size*2*a, this.size*2*a);
        else ctx.arc(this.x, this.y, this.size * a, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
};
function emitParticles(x, y, color, count, speed, size, life, type = "friction") {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU, v = Math.random() * speed;
        particles.push(new Particle(x, y, color, Math.cos(a)*v, Math.sin(a)*v, rand(life*0.55, life), rand(size*0.6, size*1.2), type));
    }
}


function recordSkill(f) {
    if (!f || typeof f === 'string') return;
    f.skillsUsed = (f.skillsUsed || 0) + 1;
}
function startToxicCharge(source, target) {
    if (!source || !target) return;
    source.data ||= {};
    source.data.toxicCharge = { targetId: target.id, timer: 3, amount: 0 };
    floatingTexts.push(new FloatingText(source.x, source.y - source.radius - 70, 'TOXIC CHARGE', '#caff58'));
    floatingTexts.push(new FloatingText(target.x, target.y - target.radius - 70, 'VENOM SIPHON', '#caff58'));
    spawnShockwave(target.x, target.y, '#9cff2b', 160);
}
function triggerToxicBreak(target, source) {
    if (!target || target.hp <= 0) return;
    if (target.hasStatus && target.hasStatus('poison')) {
        startToxicCharge(source, target);
        return;
    }
    target.takeDamage(5, source, 'toxic-break', true);
    projectiles.push({ type:'toxic_puddle', owner:source, x:target.x, y:target.y, radius:72, life:3.4, maxLife:3.4 });
    floatingTexts.push(new FloatingText(target.x, target.y - target.radius - 70, 'TOXIC BREAK', '#b9ff4b'));
    emitParticles(target.x, target.y, '#9cff2b', 46, 520, 7, .7, 'square');
    spawnShockwave(target.x, target.y, '#9cff2b', 165);
}

function sortedBreakdown(labels) {
    return Object.entries(labels || {}).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`${k}: ${v.toFixed(1)}`).join(' Ă‚Â· ') || 'No damage labels yet';
}

function weightedElectricK() {
    // k in 25..50; higher values are slightly more common for controlled high-rolls.
    return clamp(25 + Math.floor(26 * Math.sqrt(Math.random())), 25, 50);
}
function getVirusStats(f) {
    const list = f.virusParasites || [];
    let dmgReduction = 0, healReduction = 0, hasLvl3 = false;
    for (const v of list) {
        if (v.level === 1) { dmgReduction += 0.01; healReduction += 0.02; }
        else { dmgReduction += 0.05; healReduction += 0.10; if (v.level >= 3) hasLvl3 = true; }
    }
    return { damageOut: clamp(1 - dmgReduction, 0.25, 1), healMult: clamp(1 - healReduction, 0.05, 1), damageTaken: hasLvl3 ? 2 : 1, cooldownMult: hasLvl3 ? 0.7 : 1, lvl3: hasLvl3 };
}
function addVirusParasite(target, source, level) {
    if (!target || target.hp <= 0) return;
    target.virusParasites ||= [];
    target.virusParasites.push({ level, source, angle: Math.random() * TAU, pulse: 0, timer: 30, maxTimer: 30 });
    const txt = level === 1 ? 'VIRUS I' : level === 2 ? 'VIRUS II' : 'VIRUS III';
    floatingTexts.push(new FloatingText(target.x, target.y - target.radius - 58, txt, '#b9ff55'));
    emitParticles(target.x, target.y, level >= 3 ? '#ff7070' : '#b9ff55', 24 + level * 8, 360, 5, .65, 'square');
}
function activeGravityWellFor(owner) {
    return projectiles.find(p => p.type === 'gravity_well' && p.owner === owner && p.life > 0);
}
function mirrorZonePower(kind) { return kind === 'whole' ? 2 : 0.5; }
function createMirrorGate(owner) {
    const pair = Math.random().toString(36).slice(2);
    let x1 = rand(220, 780), y1 = rand(220, 780), x2 = rand(220, 780), y2 = rand(220, 780);
    for (let i=0; i<10 && dist(x1,y1,x2,y2) < 360; i++) { x2 = rand(220,780); y2 = rand(220,780); }
    projectiles.push({ type:'mirror_zone', owner, pair, kind:'broken', x:x1, y:y1, radius:212, life:8.8, maxLife:8.8, triggered:false });
    projectiles.push({ type:'mirror_zone', owner, pair, kind:'whole', x:x2, y:y2, radius:212, life:8.8, maxLife:8.8, triggered:false });
    floatingTexts.push(new FloatingText(owner.x, owner.y - owner.radius - 70, 'MIRROR GATES', '#e9f7ff'));
    playFighterSound(owner, 'skill');
}
function setupMirrorCopiedData(mirror, target, power) {
    mirror.data.stolenType = target.type;
    mirror.data.stolenData = { __power: power, __copiedType: target.name };
    mirror.data.stolenTimer = Infinity;
    mirror.data.stolenPower = power;
    mirror.data.stolenVictim = target;
    if (target.name === 'TOXIC') mirror.applyStatus('poison', 99, { source: mirror, selfSafe: true, exposure: 10 });
    if (target.name === 'ORBIT') mirror.data.stolenData.sats = [{a:0,hp:2,cd:0,ring:1},{a:Math.PI,hp:2,cd:0,ring:1}];
    if (target.name === 'CARD') mirror.data.stolenData.deck = makeDeck();
    if (target.name === 'ELECTRIC') mirror.data.stolenData.wallHits = 4;
}
function triggerMirrorGateSwap(mirror, enemy, mirrorKind, enemyKind) {
    if (!mirror || !enemy || mirror.data.gateSwapCd > 0) return;
    mirror.data.gateSwapCd = 1.25;
    const mirrorPower = mirrorZonePower(mirrorKind);
    const enemyPower = mirrorZonePower(enemyKind);
    if (mirrorKind === 'broken') mirror.takeDamage(10, enemy, 'broken-mirror-tax');
    if (enemyKind === 'broken') enemy.takeDamage(10, mirror, 'broken-mirror-tax');
    if (mirror.data.stolenType) {
        mirror.data.stolenType = null; mirror.data.stolenData = {}; mirror.data.stolenTimer = 0; mirror.data.stolenPower = 1; mirror.data.stolenVictim = null;
        delete enemy.statuses.abilityDisabled;
        floatingTexts.push(new FloatingText(mirror.x, mirror.y - mirror.radius - 70, 'SKILL RETURNED', '#e9f7ff'));
    } else {
        setupMirrorCopiedData(mirror, enemy, mirrorPower);
        enemy.applyStatus('abilityDisabled', Infinity, { mirrorLocked: true, power: enemyPower });
        floatingTexts.push(new FloatingText(mirror.x, mirror.y - mirror.radius - 70, `MIRROR SWAP Ä‚â€”${mirrorPower}`, mirrorKind === 'whole' ? '#ffffff' : '#aeb6ba'));
        floatingTexts.push(new FloatingText(enemy.x, enemy.y - enemy.radius - 70, `SKILL LOST Ä‚â€”${enemyPower}`, enemyKind === 'whole' ? '#ffffff' : '#aeb6ba'));
    }
    mirror.timeline ||= [];
    mirror.timeline.push(`${matchClock.toFixed(1)}s Mirror gate swap: ${mirrorKind} / ${enemyKind}`);
    emitParticles(mirror.x, mirror.y, '#e9f7ff', 80, 620, 6, .9, 'square');
    emitParticles(enemy.x, enemy.y, '#e9f7ff', 50, 520, 5, .8, 'square');
    spawnShockwave((mirror.x+enemy.x)/2, (mirror.y+enemy.y)/2, '#e9f7ff', 270);
    playFighterSound(mirror, 'death');
}
function pointInMirrorZone(f, z) { return f && z && dist(f.x, f.y, z.x, z.y) <= z.radius + f.radius * .35; }
function updateMirrorZones(p) {
    if (p.kind !== 'whole' || p.triggered) return;
    const pair = projectiles.filter(q => q.type === 'mirror_zone' && q.pair === p.pair);
    if (pair.length < 2) return;
    const a = pair.find(q => q.kind === 'broken'), b = pair.find(q => q.kind === 'whole');
    const mirror = p.owner, enemy = fighters.find(f => mirror && f.id !== mirror.id);
    if (!mirror || !enemy) return;
    const mirrorOnA = pointInMirrorZone(mirror, a), mirrorOnB = pointInMirrorZone(mirror, b);
    const enemyOnA = pointInMirrorZone(enemy, a), enemyOnB = pointInMirrorZone(enemy, b);
    if ((mirrorOnA && enemyOnB) || (mirrorOnB && enemyOnA)) {
        p.triggered = a.triggered = b.triggered = true;
        triggerMirrorGateSwap(mirror, enemy, mirrorOnA ? 'broken' : 'whole', enemyOnA ? 'broken' : 'whole');
        a.life = b.life = 0.65;
    }
}
function flashDistanceToLine(f, line) {
    return distToSegment(f.x, f.y, line.a.x, line.a.y, line.b.x, line.b.y);
}
function triggerFlashSuper(owner, enemy) {
    if (!owner || !enemy || owner.data.superLock > 0) return;
    owner.data.superLock = 5.5;
    enemy.applyStatus('stun', 1.2, { flashSuper: true });
    projectiles.push({ type:'flash_super', owner, enemyId: enemy.id, lines: owner.data.rageLines.map(l => ({a:{...l.a}, b:{...l.b}})), life:1.05, maxLife:1.05, tick:0, pass:0 });
    floatingTexts.push(new FloatingText(enemy.x, enemy.y - enemy.radius - 80, 'FLASH CROSS LOCK', '#fff06b'));
    playFighterSound(owner, 'death');
}
function redSlash(target, owner) {
    target.applyStatus('weak', 3, { source: owner });
    target.takeDamage(4, owner, 'red-slash-bonus');
    projectiles.push({ type:'red_slash', owner, x:target.x, y:target.y, life:.55, maxLife:.55, angle: rand(-.8,.8) });
}

function buildPostMatchStats(winner, loser) {
    const duration = Math.max(0.1, (performance.now() - matchStartTime) / 1000);
    const totalDmg = fighters.reduce((sum, f) => sum + (f.damageDone || 0), 0);
    const totalHits = fighters.reduce((sum, f) => sum + (f.hitsLanded || 0), 0);
    const allLabels = fighters.flatMap(f => Object.entries(f.damageLabels || {}).map(([k,v]) => ({ fighter:f, label:k, value:v })));
    allLabels.sort((a,b)=>b.value-a.value);
    const biggest = fighters.reduce((best,f)=> (f.maxHit||0) > (best.maxHit||0) ? f : best, fighters[0]);
    const dotKing = fighters.reduce((best,f)=> (f.dotDamage||0) > (best.dotDamage||0) ? f : best, fighters[0]);
    const skillKing = fighters.reduce((best,f)=> (f.skillsUsed||0) > (best.skillsUsed||0) ? f : best, fighters[0]);
    const headline = winner.hp <= 10 ? 'LAST-BREATH EXECUTION' : duration < 28 ? 'VIOLENT TEMPO KILL' : duration < 70 ? 'CHAOS ESCALATION' : 'LONG WAR COLLAPSE';
    const topMoments = [
        `${duration.toFixed(1)}s Ă¢â‚¬â€ ${winner.name} survived with ${winner.hp.toFixed(1)} HP`,
        `${biggest.name} landed the biggest hit: ${(biggest.maxHit||0).toFixed(1)}`,
        allLabels[0] ? `${allLabels[0].fighter.name}'s top source: ${allLabels[0].label} (${allLabels[0].value.toFixed(1)})` : `${totalHits} confirmed hits across the match`
    ];
    const maxDmg = Math.max(1, ...fighters.map(f => f.damageDone || 0));
    const maxTaken = Math.max(1, ...fighters.map(f => f.damageTaken || 0));
    const maxHeal = Math.max(1, ...fighters.map(f => f.healingDone || 0));
    const bars = (f) => Object.entries(f.damageLabels || {}).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v]) => `
        <div class="bar-row"><div class="bar-label"><span>${k}</span><b>${v.toFixed(1)}</b></div><div class="bar-track"><div class="bar-fill" style="width:${clamp(v/Math.max(1,f.damageDone)*100,3,100).toFixed(0)}%"></div></div></div>`).join('') || '<div class="bar-row"><div class="bar-label"><span>No major damage source</span><b>0</b></div><div class="bar-track"><div class="bar-fill" style="width:3%"></div></div></div>';
    const card = f => `
        <div class="stat-card" style="border-color:${f.color}88">
            <h3 style="color:${f.color}"><span>${f.name}</span><span>${f === winner ? 'WINNER' : 'DEFEATED'}</span></h3>
            <div class="stat-line"><span>Final HP</span><b>${f.hp.toFixed(1)} / ${f.maxHp}</b></div>
            <div class="stat-line"><span>Damage dealt</span><b>${(f.damageDone||0).toFixed(1)}</b></div>
            <div class="bar-track"><div class="bar-fill" style="width:${clamp((f.damageDone||0)/maxDmg*100,3,100).toFixed(0)}%"></div></div>
            <div class="stat-line"><span>Damage taken</span><b>${(f.damageTaken||0).toFixed(1)}</b></div>
            <div class="bar-track"><div class="bar-fill" style="width:${clamp((f.damageTaken||0)/maxTaken*100,3,100).toFixed(0)}%"></div></div>
            <div class="stat-line"><span>Healing</span><b>${(f.healingDone||0).toFixed(1)}</b></div>
            <div class="bar-track"><div class="bar-fill" style="width:${clamp((f.healingDone||0)/maxHeal*100,3,100).toFixed(0)}%"></div></div>
            <div class="stat-line"><span>Hits / biggest</span><b>${f.hitsLanded||0} / ${(f.maxHit||0).toFixed(1)}</b></div>
            <div class="stat-line"><span>DOT/status</span><b>${(f.dotDamage||0).toFixed(1)}</b></div>
            <div class="stat-line"><span>Skill pulses</span><b>${f.skillsUsed||0}</b></div>
            <div class="stat-line"><span>Rage</span><b>${f.isRage ? 'Activated' : 'Not activated'}</b></div>
            ${bars(f)}
        </div>`;
    return `
        <div class="stats-headline">${headline}: ${winner.name} defeated ${loser.name}</div>
        <div class="battle-tags"><span class="battle-tag">${duration.toFixed(1)}s match</span><span class="battle-tag">${totalHits} hits</span><span class="battle-tag">${totalDmg.toFixed(1)} total damage</span><span class="battle-tag">${winner.hp.toFixed(1)} HP left</span></div>
        <div class="mvp-strip"><div class="mvp-chip"><b>BIGGEST HIT</b>${biggest.name} Ă‚Â· ${(biggest.maxHit||0).toFixed(1)}</div><div class="mvp-chip"><b>DOT KING</b>${dotKing.name} Ă‚Â· ${(dotKing.dotDamage||0).toFixed(1)}</div><div class="mvp-chip"><b>SKILL TEMPO</b>${skillKing.name} Ă‚Â· ${skillKing.skillsUsed||0}</div></div>
        <div class="stats-grid">${card(fighters[0])}${card(fighters[1])}</div>
        <div class="timeline"><h4>KEY MOMENTS</h4>${topMoments.map(m=>`<div>${m}</div>`).join('')}</div>`;
}

var Fighter = class Fighter {
    constructor(id, x, y, typeClass) {
        this.id = id;
        this.x = x; this.y = y;
        this.type = typeClass;
        this.name = typeClass.name;
        this.color = typeClass.color;
        this.baseRadius = 75;
        this.radius = 75;
        this.maxHp = DEFAULT_MATCH_HP;
        this.hp = DEFAULT_MATCH_HP;
        this.baseSpeed = typeClass.speed || 450;
        this.dir = norm(typeClass.startDx * (id === 1 ? 1 : -1), typeClass.startDy);
        this.restitution = 1;
        this.isRage = false;
        this.rageStartHp = null;
        this.data = {};
        this.statuses = {};
        this.trail = [];
        this.damageDone = 0;
        this.damageTaken = 0;
        this.healingDone = 0;
        this.hitsLanded = 0;
        this.maxHit = 0;
        this.dotDamage = 0;
        this.skillsUsed = 0;
        this.damageLabels = {};
        this.timeline = [];
        this.virusParasites = [];
        this.killSoundPlayed = false;
        if (this.type.init) this.type.init(this);
    }
    setDir(x, y) { this.dir = norm(x, y); }
    applyStatus(name, duration, data = {}) {
        if (this.name === 'NINJA' && this.data && (this.data.ninjaImmuneUntil || 0) > matchClock) {
            const harmful = new Set(['slow','push','burn','poison','freeze','bleed','stun','weak','brittle','scent','abilityDisabled','silenceCurse','hexBurn','rapidPunch','disease','paintRed','paintBlue','paintYellow','innerTrauma','mathGraphContact','mathFormulaContact']);
            if (harmful.has(name)) return;
        }
        const current = this.statuses[name] || {};
        if (name === 'slow' || name === 'speed') {
            this.statuses[name] = { timer: duration, mult: data.mult };
        } else if (name === 'push') {
            this.statuses[name] = { timer: duration, max: duration, x: data.x || 0, y: data.y || 0, strength: data.strength || 0 };
        } else if (name === 'burn') {
            if (!current.timer || current.timer <= 0) this.statuses[name] = { timer: duration, tick: 0, source: data.source, interval: data.interval || 0.8, dmg: data.dmg || 0.5 };
        } else if (name === 'poison') {
            const exposure = data.exposure !== undefined ? data.exposure : (current.exposure || 0);
            const copiedToxic = this.name === 'MIRROR' && this.data && this.data.stolenType && this.data.stolenType.name === 'TOXIC' && this.data.stolenTimer > 0;
            const selfSafe = !!data.selfSafe || copiedToxic;
            this.statuses[name] = { timer: duration, tick: current.tick || 0, exposure, source: data.source, selfSafe, breakDone: data.forceBreak ? false : (data.exposure !== undefined ? false : !!current.breakDone) };
        } else if (name === 'freeze') {
            this.statuses[name] = { timer: duration, max: duration, tick: 0, dartTick: 0, source: data.source, dartTotal: data.dartTotal || 0, dartDone: 0 };
        } else if (name === 'bleed') {
            this.statuses[name] = { timer: duration, tick: current.tick || 0, source: data.source };
        } else {
            this.statuses[name] = { timer: duration, ...data };
        }
    }
    hasStatus(name) { return !!(this.statuses[name] && this.statuses[name].timer > 0); }
    hardCC() { return this.hasStatus('freeze') || this.hasStatus('stun'); }
    cooldownPaused() { return this.hardCC() || this.hasStatus('abilityDisabled'); }
    cooldownRate() {
        if (this.cooldownPaused()) return 0;
        let rate = 1;
        if (this.hasStatus('poison') && !((this.name === 'TOXIC' || this.name === 'MIRROR') && this.statuses.poison.selfSafe)) rate *= 0.7;
        if (this.hasStatus('silenceCurse')) rate *= 0.55;
        if (this.hasStatus('paintBlue')) rate *= 0.7;
        rate *= getVirusStats(this).cooldownMult;
        return rate;
    }
    speedMult() {
        if (this.hardCC()) return 0;
        let mult = 1;
        if (this.hasStatus('slow')) mult *= clamp(this.statuses.slow.mult ?? 1, 0, 1);
        if (this.hasStatus('speed')) mult *= Math.max(0, this.statuses.speed.mult ?? 1);
        if (this.type.speedModifier) mult *= this.type.speedModifier(this);
        return Math.max(0, mult);
    }
    updateStatuses(dt) {
        for (const key of Object.keys(this.statuses)) {
            const s = this.statuses[key];
            if (!s || s.timer <= 0) continue;
            if (key === 'burn') {
                s.tick += dt;
                while (s.tick >= s.interval) {
                    s.tick -= s.interval;
                    this.takeDamage(s.dmg, s.source, 'burn', true);
                }
            }
            if (key === 'poison') {
                s.exposure = (s.exposure || 0) + dt;
                s.tick += dt;
                let poisonDmg = 0;
                if (s.exposure >= 12) poisonDmg = 0.4;
                else if (s.exposure >= 9) poisonDmg = 0.32;
                else if (s.exposure >= 6.5) poisonDmg = 0.24;
                else if (s.exposure >= 4) poisonDmg = 0.16;
                else if (s.exposure >= 2) poisonDmg = 0.08;
                while (s.tick >= 0.1) {
                    s.tick -= 0.1;
                    if (poisonDmg > 0 && !((this.name === 'TOXIC' || this.name === 'MIRROR') && s.selfSafe)) this.takeDamage(poisonDmg, s.source, 'poison', true);
                }
                if (s.exposure >= 12 && !s.breakDone && !((this.name === 'TOXIC' || this.name === 'MIRROR') && s.selfSafe)) {
                    s.breakDone = true;
                    startToxicCharge(s.source, this);
                }
            }
            if (key === 'freeze') {
                if (s.dartTotal && s.timer > 0) {
                    const duration = Math.max(.6, s.max || 1.8);
                    s.iceVolley ||= {
                        id: `${this.id}-${Math.round(matchClock * 1000)}-${Math.random().toString(36).slice(2,7)}`,
                        count: clamp(Math.round(s.dartTotal / 2), 5, 8),
                        spawned: 0,
                        launched: false,
                        sourceAngle: s.source ? Math.atan2(s.source.y-this.y, s.source.x-this.x) : -Math.PI/2,
                        spawnSpacing: Math.min(.14, Math.max(.06, duration * .36 / clamp(Math.round(s.dartTotal / 2), 5, 8)))
                    };
                    const volley = s.iceVolley;
                    const sourceAngle = volley.sourceAngle;
                    const span = TAU / 3;
                    const arcRadius = this.radius + 142;
                    const wanted = volley.count;
                    const volleyAge = duration - s.timer;
                    while (volley.spawned < wanted && s.source && volleyAge >= volley.spawned * (volley.spawnSpacing || .09)) {
                        const slot = volley.spawned++;
                        const t = volley.count > 1 ? slot / (volley.count - 1) : .5;
                        const angle = sourceAngle - span / 2 + span * t;
                        const tx = clamp(this.x + Math.cos(angle) * arcRadius, 24, GAME_SIZE - 24);
                        const ty = clamp(this.y + Math.sin(angle) * arcRadius, 24, GAME_SIZE - 24);
                        projectiles.push({
                            type:'ice_dart', owner:s.source, targetId:this.id, volleyId:volley.id,
                            phase:'stage', slot, slotCount:volley.count, damage:s.dartTotal / volley.count,
                            x:s.source.x, y:s.source.y, radius:12, life:duration + .8, maxLife:duration + .8,
                            vx:undefined, vy:undefined, stageBlend:0,
                            stageTargetX:tx, stageTargetY:ty, stageAngle:angle + Math.PI
                        });
                    }
                    if (!volley.launched && s.timer <= .24) {
                        volley.launched = true;
                        for (const dart of projectiles) {
                            if (dart.type !== 'ice_dart' || dart.volleyId !== volley.id) continue;
                            dart.phase = 'launch';
                            dart.flightTime = Math.max(.12, s.timer);
                            dart.life = Math.max(dart.life, dart.flightTime + .25);
                        }
                    }
                }
            }
            if (key === 'hexBurn') {
                s.tick = (s.tick || 0) + dt;
                while (s.tick >= 1) { s.tick -= 1; this.takeDamage(1.05, s.source || null, 'hex-burn', true); }
            }
            if (key === 'rapidPunch') {
                s.tick = (s.tick || 0) + dt;
                while (s.tick >= 0.1) {
                    s.tick -= 0.1;
                    this.takeDamage(0.5, s.source || null, 'rapid-punch', false);
                }
            }
            if (key === 'disease') {
                s.tick = (s.tick || 0) + dt;
                while (s.tick >= 0.5) {
                    s.tick -= 0.5;
                    if (s.dmg) this.takeDamage(s.dmg, s.source || null, 'disease', true);
                }
            }
            if (key === 'bleed') {
                s.tick += dt;
                while (s.tick >= 1) {
                    s.tick -= 1;
                    const lost = Math.max(0, this.maxHp - this.hp);
                    if (lost > 0) this.takeDamage(lost * 0.03, s.source, 'bleed', true);
                }
            }
            s.timer -= dt;
            if (s.timer <= 0) {
                if (key === 'poison' && this.name === 'TOXIC') this.data.selfPoisonTimer = 0;
                delete this.statuses[key];
            }
        }
    }
    takeDamage(amount, source = null, label = '', statusDamage = false) {
        if (this.hp <= 0 || amount <= 0) return;
        if (source && source.statuses && source.statuses.disease && source.statuses.disease.timer > 0) amount *= source.statuses.disease.mult ?? 1;
        if (source && source !== this) amount *= getVirusStats(source).damageOut;
        amount *= getVirusStats(this).damageTaken;

        // PUPPET: oldest effigy takes the hit first; excess counterplay leaks to Puppet, never to the next effigy.
        if (this.name === 'PUPPET' && source && source !== this && !statusDamage) {
            const effigy = projectiles.find(p => p.type === 'puppet_effigy' && p.owner === this && p.hp > 0 && p.life > 0);
            if (effigy) {
                const block = Math.min(effigy.hp, amount);
                effigy.hp -= block;
                floatingTexts.push(new FloatingText(effigy.x, effigy.y - effigy.radius - 30, `VOODOO ${block.toFixed(1)}`, '#d6c0ff'));
                emitParticles(effigy.x, effigy.y, '#d6c0ff', 18, 220, 5, .45, 'square');
                if (effigy.hp <= 0) { effigy.life = 0; spawnShockwave(effigy.x, effigy.y, '#8d6b45', 120); }
                const leak = Math.max(0, amount - block) * .9 + block * 0.38;
                if (leak <= 0) return;
                amount = leak;
                label = (label || 'direct') + '-puppet-effigy-leak';
                floatingTexts.push(new FloatingText(this.x, this.y - this.radius - 92, `LEAK ${leak.toFixed(1)}`, '#d6c0ff'));
            }
        }

        if (this.name === 'VAMPIRE' && this.data && this.data.latchTimer > 0) {
            amount *= 0.5;
            label = (label || 'direct') + '-vampire-latch-guard';
        }
        if (this.name === 'MATH_V2' && this.data && this.data.phase === 'typing') {
            amount *= 0.6;
            label = (label || 'direct') + '-graph-casting-guard';
        }
        if (this.name === 'RUBBER' && this.data && this.data.afterTier >= 3 && !this.data.active) {
            amount *= 0.5;
            label = (label || 'direct') + '-black-rubber-guard';
        }
        if (this.name === 'DRUM' && this.data && this.data.rageSolo > 0 && !statusDamage) {
            amount *= 0.2;
            label = (label || 'direct') + '-drum-solo-guard';
        }
        if (this.hasStatus('bladeWeak') && source && source.name === 'BLADE') {
            amount *= 2;
            label = (label || 'direct') + '-blade-weak-x2';
        }
        if (this.hasStatus('weak') && source && source !== this && Math.random() < 0.5) {
            amount *= 3;
            label = (label || 'direct') + '-weak-crit';
            floatingTexts.push(new FloatingText(this.x, this.y - this.radius - 92, `WEAK CRIT Ä‚â€”3`, '#ff2a2a'));
        }
        if (this.hasStatus('brittle')) {
            amount *= 1.25;
            label = (label || 'direct') + '-brittle';
            floatingTexts.push(new FloatingText(this.x, this.y - this.radius - 108, 'BRITTLE +25%', '#d98cff'));
        }
        if (this.hasStatus('paintRed')) { amount *= 1.2; label = (label || 'direct') + '-red-ink-vulnerable'; }
        if (this.hasStatus('paintYellow')) { amount *= 0.8; label = (label || 'direct') + '-yellow-ink-guard'; }
        if (this.hasStatus('innerTrauma')) {
            const traumaStacks = this.statuses.innerTrauma.stacks || 0;
            if (traumaStacks > 0) {
                amount *= (1 + traumaStacks * 0.02);
                label = (label || 'direct') + '-inner-trauma';
            }
        }
        if (this.name === 'SLIME' && this.data && this.data.gelArmorTimer > 0) {
            const red = clamp(this.data.gelArmorReduction || 0, 0, .65);
            amount *= (1 - red);
            label = (label || 'direct') + '-gel-armor';
        }
        if (this.name === 'PAINTER' && this.hasStatus('painterGuard')) {
            amount *= 0.7;
            label = (label || 'direct') + '-painter-red-guard';
        }

        // SLIME children actively guard normal incoming damage, no slow HP drain / delayed buffer.
        if (this.name === 'SLIME' && this.data && source && source !== this && !statusDamage) {
            const guards = projectiles.filter(p => p.type === 'slime_child' && p.owner === this && p.hp > 0 && p.life > 0);
            if (guards.length) {
                const guardBudget = amount * 0.45;
                let remaining = amount;
                let budgetLeft = guardBudget;
                for (const g of guards) {
                    if (remaining <= 0 || budgetLeft <= 0) break;
                    const block = Math.min(g.hp, remaining, budgetLeft);
                    g.hp -= block;
                    remaining -= block;
                    budgetLeft -= block;
                    emitParticles(g.x, g.y, this.color, 8, 180, 4, .25, 'square');
                    floatingTexts.push(new FloatingText(g.x, g.y - g.radius - 28, `SLIME GUARD ${block.toFixed(1)}`, '#caffbb'));
                    if (g.hp <= 0) { g.life = 0; createSlimeMucus(g.x, g.y, this); }
                }
                amount = remaining;
                if (amount <= 0) return;
                label = (label || 'direct') + '-slime-guard-leak';
            }
        }

        // TIME death denial during Mark. Exactly once.
        if (this.name === 'TIME' && this.data && this.data.mark && !this.data.deathRewindUsed && this.hp - amount <= 0) {
            const m = this.data.mark;
            this.hp = Math.max(1, m.hp || 1); this.x = m.x; this.y = m.y; this.data.deathRewindUsed = true; this.data.mark = null; this.data.markCd = 9;
            floatingTexts.push(new FloatingText(this.x, this.y - this.radius - 90, 'DEATH DENIED', '#efeaff'));
            spawnShockwave(this.x, this.y, '#d6d0ff', 300); triggerFlash(210,200,255,.3); return;
        }

        const well = activeGravityWellFor(this);
        if (this.name === 'BLACK_HOLE' && this.isRage && well && source && source !== this) {
            well.absorbedDamage = (well.absorbedDamage || 0) + amount;
            floatingTexts.push(new FloatingText(this.x, this.y - this.radius - 42, `ABSORB ${amount.toFixed(1)}`, '#9d6bff'));
            emitParticles(this.x, this.y, '#22102e', 18, 240, 5, .5, 'square');
            return;
        }
        if (this.name === 'NINJA' && this.data && (this.data.ninjaImmuneUntil || 0) > matchClock) return;
        if (this.hasStatus('immune') && !statusDamage) return;

        if (this.name === 'SLIME' && this.data && source && source !== this) {
            this.data.slimeDmgWindow ||= [];
            this.data.slimeDmgWindow.push({t: matchClock, amount});
            this.data.shockDmgWindow ||= [];
            this.data.shockDmgWindow.push({t: matchClock, amount});
        }

        this.hp = Math.max(0, this.hp - amount);
        this.damageTaken += amount;
        if (source && source !== this) {
            source.damageDone += amount;
            source.hitsLanded = (source.hitsLanded || 0) + 1;
            source.maxHit = Math.max(source.maxHit || 0, amount);
            if (statusDamage) source.dotDamage = (source.dotDamage || 0) + amount;
            source.damageLabels[label || 'direct'] = (source.damageLabels[label || 'direct'] || 0) + amount;
            if (source.name === 'TOXIC' && source.data && source.data.toxicCharge && source.data.toxicCharge.timer > 0 && source.data.toxicCharge.targetId === this.id && label === 'poison') {
                source.data.toxicCharge.amount = (source.data.toxicCharge.amount || 0) + amount;
                floatingTexts.push(new FloatingText(source.x, source.y-source.radius-112, `SIPHON +${amount.toFixed(1)}`, '#caff58'));
            }
        }
        spawnDamageText(this.x, this.y - this.radius - 6, amount, false);
        emitParticles(this.x, this.y, this.color, Math.min(22, 4 + Math.ceil(amount * 2)), 245, 4, 0.45, 'square');
        if (this.type.onTakeDamage && !this.hasStatus('abilityDisabled')) this.type.onTakeDamage(this, amount, source, label);
        if (shouldTriggerRage(this)) {
            this.isRage = true;
            this.rageStartHp = this.hp;
            playFighterSound(this, 'skill');
            emitParticles(this.x, this.y, this.color, 60, 540, 7, 1.2, 'square');
            spawnShockwave(this.x, this.y, this.color, 190);
            if (this.type.onRage) this.type.onRage(this);
        }
        if (this.hp <= 0 && this.name === 'PUPPET' && this.data && !this.data.finalCardActive) {
            this.hp = 1; this.data.finalCardActive = true; this.data.cardTimer = 5;
            spawnPuppetFinalCard(this);
            floatingTexts.push(new FloatingText(this.x, this.y - this.radius - 100, 'FINAL CARD', '#f1d8a8'));
            return;
        }
        if (this.hp <= 0 && !this.killSoundPlayed) {
            this.killSoundPlayed = true;
            playFighterSound(this, 'death');
            triggerSlowMoFinish();
        }
        updateHUD();
    }
    heal(amount, overheal = false) {
        if (this.hp <= 0 || amount <= 0) return;
        amount *= getVirusStats(this).healMult;
        const cap = overheal ? Math.max(this.maxHp, 140) : this.maxHp;
        const before = this.hp;
        this.hp = Math.min(cap, this.hp + amount);
        this.healingDone += Math.max(0, this.hp - before);
        spawnDamageText(this.x, this.y - this.radius - 6, amount, true);
        updateHUD();
    }
    update(dt, enemy) {
        if (this.hp <= 0) return;
        this.updateStatuses(dt);
        if (this.virusParasites && this.virusParasites.length) {
            for (const v of this.virusParasites) v.timer = (v.timer ?? 30) - dt;
            this.virusParasites = this.virusParasites.filter(v => v.timer > 0);
        }
        const canAct = !this.hardCC() && !this.hasStatus('abilityDisabled');
        if (canAct && this.type.update) this.type.update(this, enemy, dt);
        updateMirrorStolen(this, enemy, dt);

        if (!this.hardCC() && !this.data.positionLocked) {
            const mod = this.speedMult();
            let mvx = this.dir.x * this.baseSpeed * mod;
            let mvy = this.dir.y * this.baseSpeed * mod;
            if (this.hasStatus('push')) {
                const p = this.statuses.push;
                const t = clamp(p.timer / p.max, 0, 1);
                mvx += p.x * p.strength * t;
                mvy += p.y * p.strength * t;
            }
            this.x += mvx * dt;
            this.y += mvy * dt;
        }
        this.data.positionLocked = false;

        this.trail.length = 0;

        const wall = this.resolveWalls();
        if (wall) {
            playFighterSound(this, 'wall');
            canvas.style.borderColor = this.color;
            setTimeout(() => canvas.style.borderColor = WALL_SKETCH, 80);
            if (!this.hasStatus('abilityDisabled') && this.type.onWallBounce && !this.data.wallInteractionBlocked) this.type.onWallBounce(this, wall);
            mirrorStolenWall(this, enemy, wall);
        }
    }
    resolveWalls() {
        this.data.wallInteractionBlocked = false;
        let side = null;
        const apexControlWalls = window.APEX_CONTROL_BATTLE_WALLS;
        if (apexControlWalls?.active?.()) {
            const hit = apexControlWalls.resolveFighterWall?.(this);
            if (hit) side = hit.side || hit.id || 'wall';
        }
        if (this.x - this.radius < 0) { this.x = this.radius; this.dir.x = Math.abs(this.dir.x); side = 'left'; }
        if (this.x + this.radius > GAME_SIZE) { this.x = GAME_SIZE - this.radius; this.dir.x = -Math.abs(this.dir.x); side = 'right'; }
        if (this.y - this.radius < 0) { this.y = this.radius; this.dir.y = Math.abs(this.dir.y); side = 'top'; }
        if (this.y + this.radius > GAME_SIZE) { this.y = GAME_SIZE - this.radius; this.dir.y = -Math.abs(this.dir.y); side = 'bottom'; }
        if (side) {
            if (sawWallRage.timer > 0 && sawWallRage.owner && sawWallRage.owner !== this) {
                const base = sawWallRage.owner.isRage ? 4.8 : 4.0;
                this.takeDamage(base * 0.65, sawWallRage.owner, 'saw-wall');
                this.data.wallInteractionBlocked = true;
                floatingTexts.push(new FloatingText(this.x, this.y - this.radius - 50, 'SAW WALL', '#ff6358'));
            }
            this.dir = norm(this.dir.x, this.dir.y);
            if (this.data.deform !== undefined) this.data.deform = 0.35;
        }
        return side;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.hasStatus('immune') ? 0.55 : 1;
        if (false && this.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i=1; i<this.trail.length; i++) ctx.lineTo(this.trail[i].x, this.trail[i].y);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.radius * 0.55;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = 0.13;
            ctx.stroke();
            ctx.globalAlpha = this.hasStatus('immune') ? 0.55 : 1;
        }
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.dir.y, this.dir.x));

        if (this.isRage) {
            const glow = this.color || '#ffffff';
            ctx.filter = `drop-shadow(0 0 5px ${glow}) drop-shadow(0 0 11px ${glow})`;
        }
        if (this.type.draw) this.type.draw(ctx, this);
        else drawSketchBlob(ctx, this.radius, this.color, 14);
        if (this.isRage) ctx.filter = 'none';

        if (this.hasStatus('freeze')) drawStatusRing(ctx, this.radius + 18, '#a6f4ff', 'FREEZE');
        if (this.hasStatus('stun')) {
            ctx.save();
            ctx.rotate(-Math.atan2(this.dir.y, this.dir.x));
            drawStunAsset(ctx, this.radius);
            ctx.restore();
        }
        if (this.hasStatus('poison')) {
            const lvl = poisonLevelFromExposure(this.statuses.poison.exposure || 0);
            drawStatusRing(ctx, this.radius + 26, '#88ff00', `POISON ${lvl}`);
            if (lvl > 0) {
                ctx.save();
                ctx.rotate(-Math.atan2(this.dir.y, this.dir.x));
                ctx.fillStyle = '#b6ff4a';
                ctx.strokeStyle = '#0b1702';
                ctx.lineWidth = 6;
                ctx.font = "900 54px 'Segoe UI'";
                ctx.textAlign = 'center';
                ctx.strokeText(String(lvl), 0, -this.radius - 50);
                ctx.fillText(String(lvl), 0, -this.radius - 50);
                ctx.restore();
            }
        }
        if (this.hasStatus('disease')) drawStatusRing(ctx, this.radius + 30, '#b9ff55', `VIRUS -${Math.round((1-(this.statuses.disease.mult ?? 1))*100)}%`);
        if (this.hasStatus('weak') && !(this.statuses.weak && this.statuses.weak.source && this.statuses.weak.source.name === 'BLADE')) drawStatusRing(ctx, this.radius + 34, '#ff3030', 'WEAK');
        if (this.virusParasites && this.virusParasites.length) {
            const now = Date.now()/600;
            const vs=getVirusStats(this); ctx.save(); ctx.rotate(-Math.atan2(this.dir.y,this.dir.x)); ctx.fillStyle='#b9ff55'; ctx.strokeStyle='#102006'; ctx.lineWidth=5; ctx.font="900 20px monospace"; ctx.textAlign='center'; ctx.strokeText(`VIRUS -${Math.round((1-vs.damageOut)*100)}% DMG`,0,-this.radius-82); ctx.fillText(`VIRUS -${Math.round((1-vs.damageOut)*100)}% DMG`,0,-this.radius-82); ctx.restore();
            this.virusParasites.slice(0,18).forEach((v,i)=>{
                const rr = this.radius + 44 + (i%3)*10;
                const a = v.angle + now*(.35 + v.level*.08);
                ctx.fillStyle = v.level===1 ? '#b8ff63' : v.level===2 ? '#78cf3d' : '#ff7070';
                ctx.strokeStyle = '#102006'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(Math.cos(a)*rr, Math.sin(a)*rr, v.level===1?7:v.level===2?10:14, 0, TAU); ctx.fill(); ctx.stroke();
            });
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }
};

function drawStatusRing(ctx, r, color, label) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.rotate(-Math.atan2(0,1));
    ctx.fillStyle = color;
    ctx.font = "700 15px 'Segoe UI'";
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, -r - 8);
    ctx.restore();
}
function drawSketchBlob(ctx, r, color, seed = 10) {
    ctx.save();
    ctx.beginPath();
    for (let i=0; i<=seed; i++) {
        const a = i / seed * TAU;
        const jitter = 0.88 + 0.14 * Math.sin(i*2.17 + r) + 0.06 * Math.cos(i*5.1);
        const rr = r * jitter;
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 6;
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (let i=0; i<4; i++) {
        ctx.beginPath();
        ctx.moveTo(rand(-r*0.55,r*0.2), rand(-r*0.55,r*0.55));
        ctx.lineTo(rand(-r*0.15,r*0.65), rand(-r*0.55,r*0.55));
        ctx.stroke();
    }
    ctx.restore();
}
function drawPolygon(ctx, pts, fill, stroke = '#0b0b0b', lw = 5) {
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
}

function abilityDt(f, dt) { return dt * f.cooldownRate(); }
function tickDataTimer(f, key, dt, resetValue) {
    f.data[key] -= abilityDt(f, dt);
    if (f.data[key] <= 0) { f.data[key] = resetValue; return true; }
    return false;
}
function scaledByMirror(f, value) {
    if (!f || f.name !== 'MIRROR' || !f.data) return value;
    const power = f.data.stolenPower || f.data.__power || 1;
    return value * power;
}
function updateMirrorStolen(f, enemy, dt) {
    if (f.name !== 'MIRROR' || !f.data.stolenType || f.data.stolenTimer <= 0) return;
    if (f.data.stolenTimer !== Infinity) f.data.stolenTimer -= abilityDt(f, dt);
    if (f.data.stolenTimer !== Infinity && f.data.stolenTimer <= 0) {
        if (f.data.stolenVictim) f.data.stolenVictim.statuses.abilityDisabled = { timer: 0 };
        f.data.stolenType = null;
        f.data.stolenData = {};
        f.data.stolenVictim = null;
        f.data.stolenPower = 1;
        return;
    }
    if (f.hardCC()) return;
    const type = f.data.stolenType;
    if (!type.update) return;
    const savedData = f.data;
    f.data = savedData.stolenData;
    if (!f.data.__mirrorInit && type.init) { type.init(f); f.data.__mirrorInit = true; }
    f.data.__power = savedData.stolenPower || 1;
    f.data.__copiedType = type.name;
    type.update(f, enemy, dt, true);
    f.data = savedData;
}
function mirrorStolenWall(f, enemy, wall) {
    if (f.name !== 'MIRROR' || !f.data.stolenType || f.data.stolenTimer <= 0) return;
    const type = f.data.stolenType;
    if (!type.onWallBounce) return;
    const savedData = f.data;
    f.data = savedData.stolenData;
    f.data.__power = savedData.stolenPower || 1;
    f.data.__copiedType = type.name;
    type.onWallBounce(f, wall, true);
    f.data = savedData;
}
function mirrorStolenCollide(f, enemy, dt, normal) {
    if (f.name !== 'MIRROR' || !f.data.stolenType || f.data.stolenTimer <= 0) return false;
    const type = f.data.stolenType;
    if (!type.onCollide) return false;
    const savedData = f.data;
    f.data = savedData.stolenData;
    f.data.__power = savedData.stolenPower || 1;
    f.data.__copiedType = type.name;
    const result = type.onCollide(f, enemy, dt, normal, true);
    f.data = savedData;
    return result;
}


function rubberSubSkillLabel(ft) {
    if (!ft) return 'NONE';
    const labels = {BLADE:'BLADE WAVE', ICE:'ICE LANE', VAMPIRE:'BLOOD BITE', STRING:'STRING CYCLE', VOLCANO:'METEOR', MAGNET:'MAGNET FIELD', FLASH:'FLASH DASH', ELECTRIC:'LIGHTNING', ORBIT:'SATELLITE', TOXIC:'ACID TRAIL', BLACK_HOLE:'GRAVITY WELL', SAW:'SAW SPIN', NOVA:'NOVA MINI', HUNTER:'HUNT MARK', CRYSTAL:'CRYSTAL WALL', VIRUS:'VIRUS SPAWN', DRUM:'DRUM WAVE', CARD:'CARD THROW', MATH:'MATH NUMBER', MATH_V2:'GRAPH WALL', SNIPER:'SNIPER SHOT'};
    return labels[ft.name] || ft.name;
}
function castRubberSubSkill(f, e) {
    const name = f.data.subSkill && f.data.subSkill.name;
    if (!name || !e) return;
    recordSkill(f);
    floatingTexts.push(new FloatingText(f.x, f.y - f.radius - 92, `SUB: ${rubberSubSkillLabel(f.data.subSkill)}`, '#ff7070'));
    if (name === 'BLADE') { const a=Math.atan2(e.y-f.y,e.x-f.x); projectiles.push({type:'blade_wave',owner:f,x:f.x,y:f.y,vx:Math.cos(a)*1020,vy:Math.sin(a)*1020,halfWidth:190,length:320,life:2,maxLife:2,dmg:2.4,bounces:1,hit:false}); }
    else if (name === 'ICE') { const a=Math.atan2(e.y-f.y,e.x-f.x); const far=pointOnRayToEdge(f.x,f.y,Math.cos(a),Math.sin(a)); projectiles.push({type:'ice_lane',owner:f,x1:f.x,y1:f.y,x2:far.x,y2:far.y,halfWidth:150,life:4.4,maxLife:4.4,enemyInside:0,dmgTick:0}); }
    else if (name === 'VAMPIRE') { e.takeDamage(2.5,f,'rubber-blood-bite'); f.heal(2.5,true); }
    else if (name === 'STRING') { /* STRING is cycle-driven; no borrowed web-anchor side skill. */ }
    else if (name === 'VOLCANO') { projectiles.push({type:'meteor',owner:f,x:e.x+rand(-80,80),y:e.y+rand(-80,80),radius:75,delay:.45,life:.70,hit:false,volcanoAmp:1}); }
    else if (name === 'MAGNET') { projectiles.push({type:'magnet_field',owner:f,radius:220,life:1.8,maxLife:1.8,hitCd:{},inside:{},slamCd:0}); }
    else if (name === 'FLASH') { f.data.dashTimer=.25; f.data.dashHitIds={}; f.setDir(e.x-f.x,e.y-f.y); }
    else if (name === 'ELECTRIC') { projectiles.push({type:'lightning',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.25,maxLife:.25}); e.applyStatus('stun',.75); e.takeDamage(3.5,f,'rubber-lightning'); }
    else if (name === 'ORBIT') { if(!f.data.rubberSats) f.data.rubberSats=[]; f.data.rubberSats.push(newOrbitSat(Math.random()*TAU)); e.takeDamage(2,f,'rubber-orbit'); }
    else if (name === 'TOXIC') { projectiles.push({type:'toxic_puddle',owner:f,x:e.x,y:e.y,radius:62,life:3,maxLife:3}); }
    else if (name === 'BLACK_HOLE') { projectiles.push({type:'gravity_well',owner:f,x:(f.x+e.x)/2,y:(f.y+e.y)/2,core:70,radius:150,life:1.7,maxLife:1.7,exploded:false,absorbed:0,absorbedDamage:0}); }
    else if (name === 'SAW') { f.data.spin=Math.max(f.data.spin||0,1.8); }
    else if (name === 'NOVA') { const d=dist(f.x,f.y,e.x,e.y); e.takeDamage(Math.max(1,8-d/160),f,'rubber-mini-nova'); spawnShockwave(f.x,f.y,'#fff1b4',180); }
    else if (name === 'HUNTER') { e.applyStatus('weak',2.5); e.takeDamage(3.5,f,'rubber-hunter-cut'); }
    else if (name === 'CRYSTAL') { const a=Math.atan2(e.y-f.y,e.x-f.x)+Math.PI/2; const len=125; const cx=(f.x+e.x)/2,cy=(f.y+e.y)/2; projectiles.push({type:'crystal_wall',owner:f,x1:cx-Math.cos(a)*len,y1:cy-Math.sin(a)*len,x2:cx+Math.cos(a)*len,y2:cy+Math.sin(a)*len,life:3,maxLife:3,hitIds:{},touchCd:{},permanent:false}); }
    else if (name === 'VIRUS') { spawnVirusChildren(f,2,1,f.x,f.y); }
    else if (name === 'DRUM') { projectiles.push({type:'drum_wave',owner:f,x:f.x,y:f.y,radius:8,maxRadius:1415,life:1.0,maxLife:1.0,minDmg:1,maxDmg:8,hitIds:{}}); }
    else if (name === 'CARD') { const hand=[randomCard(),randomCard(),randomCard()]; const dmg=Math.max(3,cardCaoDamage(hand)); projectiles.push({type:'card_throw',owner:f,enemy:e,x:f.x,y:f.y-f.radius-64,hand,dmg,radius:34,life:2.2,maxLife:2.2,hit:false,unblockable:true}); }
    else if (name === 'MATH') { const val=Math.random()<.5?-8:8; projectiles.push({type:'math_formula',owner:f,enemy:e,formula:'RUBBER Ă‚Â±8',value:val,rage:false,life:3,maxLife:3,phase:'typing',age:0,x:f.x,y:f.y,hit:false,launched:false,vx:0,vy:0}); }
    else if (name === 'MATH_V2') { spawnMathV2Graph(f, 'y = sin(Ăâ‚¬x)', 'sin'); }
    else if (name === 'SNIPER') { const ratio=dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE); e.takeDamage(30*ratio,f,'rubber-sniper'); projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.35,maxLife:.35}); }
    else { e.takeDamage(3,f,'rubber-subskill'); }
    playFighterSound(f,'skill');
}


// === GRAND BRACKET 32 UPDATE: NEW FIGHTER HELPERS ===
function applyBrittleAndTrauma(target, amount, source, label) { return { amount, label }; }
function getInnerTraumaMult(f) { return f && f.statuses && f.statuses.innerTrauma && f.statuses.innerTrauma.timer>0 ? (1 + 0.02 * (f.statuses.innerTrauma.stacks || 0)) : 1; }
function addInnerTrauma(f, stacks=1) {
    const cur = f.statuses.innerTrauma || { timer: 9999, stacks: 0 };
    const next = clamp((cur.stacks || 0) + stacks, 0, 15);
    f.applyStatus('innerTrauma', 9999, { stacks: next });
    floatingTexts.push(new FloatingText(f.x, f.y - f.radius - 72, `TRAUMA ${next}`, '#ffb36b'));
}
function addSlimeChild(owner, angle) {
    projectiles.push({type:'slime_child', owner, angle, radius:24, hp:4, life:4, maxLife:4, hitCd:{}, blockCd:0, damageDone:0, x:owner.x, y:owner.y});
}
function resolveSlimeChild(p) {
    if (!p || p.resolved) return;
    p.resolved = true;
    const owner = p.owner;
    if (owner && p.damageDone) owner.heal(p.damageDone * 0.5, false);
    if (owner && owner.isRage && p.hp > 0) {
        owner.data.gelArmorStacks = (owner.data.gelArmorStacks || 0) + 1;
        const st = owner.data.gelArmorStacks;
        owner.data.gelArmorReduction = st >= 3 ? .55 : st >= 2 ? .45 : .30;
        owner.data.gelArmorTimer = 4;
        floatingTexts.push(new FloatingText(owner.x, owner.y-owner.radius-90, `GEL ARMOR ${Math.round(owner.data.gelArmorReduction*100)}%`, '#caffbb'));
    }
}
function spawnTimeRift(owner, x, y, storedDamage) {
    if (!storedDamage || storedDamage <= 0) return;
    projectiles.push({type:'time_rift', owner, x, y, radius:110, storedDamage, life:3, maxLife:3, hit:false});
    floatingTexts.push(new FloatingText(x, y-70, `RIFT ${storedDamage.toFixed(1)}`, '#d6d0ff'));
}
function clockDamageValue() {
    const sec = matchClock || 0;
    const hourAngle = ((sec % 13) / 13) * TAU - Math.PI/2;
    let n = Math.round((((hourAngle + Math.PI/2) % TAU) / TAU) * 12);
    if (n <= 0) n = 12;
    return clamp(n, 1, 12);
}
function spawnWolfScent(owner, enemy) {
    enemy.applyStatus('scent', 5, { source: owner });
    floatingTexts.push(new FloatingText(enemy.x, enemy.y-enemy.radius-66, 'SCENT', '#ff3838'));
    playFighterSound(owner, 'skill');
}
function spawnWindGale(owner, enemy) {
    const n = norm(enemy.x-owner.x, enemy.y-owner.y);
    const edge = pointOnRayToEdge(owner.x, owner.y, n.x, n.y);
    projectiles.push({type:'wind_gale', owner, x1:owner.x, y1:owner.y, x2:edge.x, y2:edge.y, nx:n.x, ny:n.y, width:330, life:2.35, maxLife:2.2, tick:0});
    playFighterSound(owner, 'skill');
}
function rollWitchCurse(owner, enemy) {
    const curses = ['frog','brittle','silence','hex'];
    const c = curses[Math.floor(Math.random()*curses.length)];
    if (c === 'frog') enemy.applyStatus('slow',3.8,{mult:.58});
    else if (c === 'brittle') enemy.applyStatus('brittle',3.8,{source:owner});
    else if (c === 'silence') enemy.applyStatus('silenceCurse',3.8,{source:owner});
    else if (c === 'hex') enemy.applyStatus('hexBurn',3.8,{source:owner,tick:0});
    floatingTexts.push(new FloatingText(enemy.x, enemy.y-enemy.radius-70, c.toUpperCase(), '#d98cff'));
}
function addPirateLoot(owner) {
    const r = Math.random();
    const kind = r < .4 ? 'treasure' : r < .8 ? 'cannon' : 'boat';
    const forward = owner.dir || {x:1,y:0};
    const perp = {x:-forward.y, y:forward.x};
    const x = clamp(owner.x + forward.x*rand(80,260) + perp.x*rand(-170,170), 75, 925);
    const y = clamp(owner.y + forward.y*rand(80,260) + perp.y*rand(-170,170), 75, 925);
    projectiles.push({type:'pirate_loot', owner, kind, x, y, radius: kind==='boat'?38:28, life:17, maxLife:17});
    const loot = projectiles.filter(p=>p.type==='pirate_loot' && p.owner===owner);
    if (loot.length>9) loot[0].life=0;
}
function triggerPirateAnchor(owner, enemy) {
    projectiles.push({type:'pirate_anchor', owner, x1:owner.x, y1:owner.y, x2:owner.x, y2:owner.y, life:9, maxLife:9, triggered:false});
    floatingTexts.push(new FloatingText(owner.x, owner.y-owner.radius-70, 'ANCHOR', '#d7a34a'));
}
function spawnPainterInk(owner, x, y, colorKind, x2=x, y2=y) {
    const col = colorKind === 'red' ? '#ff4040' : colorKind === 'blue' ? '#50a6ff' : '#ffd447';
    projectiles.push({type:'painter_stroke', owner, x1:x, y1:y, x2:x2, y2:y2, width:75, kind:colorKind, color:col, life: owner.isRage ? 4 : 3, maxLife: owner.isRage ? 4 : 3, tick:0});
}
function spawnPainterBlob(owner, enemy) {
    const kind=['red','blue','yellow'][owner.data.colorIndex || 0];
    const col = kind === 'red' ? '#ff4040' : kind === 'blue' ? '#50a6ff' : '#ffd447';
    const n = norm(enemy.x-owner.x, enemy.y-owner.y);
    projectiles.push({type:'painter_blob', owner, enemy, x:owner.x, y:owner.y, vx:n.x*640, vy:n.y*640, radius:20, kind, color:col, life:3, maxLife:3, hit:false});
    floatingTexts.push(new FloatingText(owner.x, owner.y-owner.radius-78, `PAINT ${kind.toUpperCase()}`, col));
}
function triggerSuperstarEvent(owner, enemy) {
    owner.data.mediaStreak = owner.data.mediaStreak || 0;
    let mediaChance = owner.data.mediaStreak >= 2 ? 0 : owner.data.mediaStreak === 1 ? .25 : .45;
    if (Math.random() < mediaChance) {
        owner.data.mediaStreak++;
        owner.applyStatus('immune',2,{source:owner});
        owner.data.spotlight = 2;
        floatingTexts.push(new FloatingText(owner.x, owner.y-owner.radius-80, 'LIVE SHIELD', '#fff2a0'));
        projectiles.push({type:'spotlight_flash', owner, x:owner.x, y:owner.y, radius:190, life:2, maxLife:2});
    } else {
        owner.data.mediaStreak = 0;
        for (let i=0;i<2;i++) projectiles.push({type:'superfan', owner, x:owner.x+rand(-35,35), y:owner.y+rand(-35,35), radius:10, hp:8, life:20, maxLife:20, tick:0, dir:norm(rand(-1,1),rand(-1,1))});
        const fans = projectiles.filter(p=>p.type==='superfan' && p.owner===owner);
        while (fans.length>6) { const old=fans.shift(); if(old) old.life=0; }
        floatingTexts.push(new FloatingText(owner.x, owner.y-owner.radius-80, '+2 FANS', '#ff7bd6'));
    }
    playFighterSound(owner, 'skill');
}
function countSuperFans(owner) { return projectiles.filter(p=>p.type==='superfan' && p.owner===owner && p.life>0).length; }

var FighterTypes = [
    {
        name: "RUBBER", color: "#b7376f", desc: "Kinetic bounce with a permanent learned sub-skill", speed: 525, startDx: 1, startDy: 0.55,
        init: f => { f.data.cd=1.2; f.data.active=false; f.data.timer=0; f.data.kinetic=0; f.data.deform=0; f.data.bounceBoost=0; f.data.superHits=0; f.data.afterTier=0; f.data.subSkill=null; f.data.subData={cd:2.5}; },
        speedModifier: f => f.data.active ? (2.05 + (f.data.bounceBoost || 0)) : (f.data.afterTier>=4 ? 1.18 + Math.min(.9,(f.data.kinetic||0)*.06) : 1),
        update: (f,e,dt) => { 
            if(f.data.active){ f.data.timer-=dt; if(f.data.timer<=0){ f.data.active=false; f.data.cd=5.8; const hits=f.data.superHits||0; if(hits>=4){ f.data.afterTier=5; if(!f.data.subSkill){ const pool=FighterTypes.filter(t=>!['RUBBER','MIRROR'].includes(t.name)); f.data.subSkill=pool[Math.floor(Math.random()*pool.length)]; } floatingTexts.push(new FloatingText(f.x,f.y-f.radius-82,`LEARNED: ${rubberSubSkillLabel(f.data.subSkill)}`,'#ff3030')); } else if(hits>=3){ f.data.afterTier=4; } else if(hits>=2){ f.data.afterTier=3; } else f.data.afterTier=0; f.data.superHits=0; } }
            else { f.data.cd-=abilityDt(f,dt); if(f.data.cd<=0){ f.data.active=true; f.data.timer=5.0; f.data.kinetic=0; f.data.bounceBoost=0; f.data.superHits=0; f.data.afterTier=0; playFighterSound(f,'skill'); } }
            if(f.data.subSkill && !f.hasStatus('abilityDisabled')) { f.data.subData ||= {cd:2.5}; f.data.subData.cd-=abilityDt(f,dt); if(f.data.subData.cd<=0){ f.data.subData.cd=6.5; castRubberSubSkill(f,e); } }
            if(f.isRage) f.radius=f.baseRadius*(1+0.25+(50-Math.max(0,f.hp))*0.006); 
        },
        onWallBounce: f => { if(f.data.active){ f.data.kinetic=Math.min(9,(f.data.kinetic||0)+1); f.data.bounceBoost=Math.min(1.35,(f.data.bounceBoost||0)+.16); f.data.timer = Math.min(6.5, (f.data.timer||0) + 0.25); } else if(f.data.afterTier>=4){ f.data.kinetic=Math.min(8,(f.data.kinetic||0)+1); f.data.bounceBoost=Math.min(1.1,(f.data.bounceBoost||0)+.22); } f.data.deform=.45; playFighterSound(f,'skill'); },
        onTakeDamage: (f, amount, src) => {},
        onCollide: (f,e) => { if(f.data.active || f.data.afterTier>=4){ if(f.data.active) f.data.superHits=(f.data.superHits||0)+1; const sizeBonus=Math.max(0,Math.floor(((f.radius/f.baseRadius)-1)/.10)); const kinetic=(f.data.kinetic||0); const speedFactor=f.data.afterTier>=4&&!f.data.active?0.55:0.8; let dmg=(f.data.active?3:1.5)+sizeBonus+kinetic*speedFactor; if(!f.data.active && f.data.afterTier>=4) dmg*=1.15; e.takeDamage(scaledByMirror(f,dmg),f,f.data.active?'kinetic-bounce':'red-rubber-impact'); const n=norm(e.x-f.x,e.y-f.y); e.applyStatus('push',.22,{x:n.x,y:n.y,strength:900+kinetic*90}); f.data.deform=.5; if(f.data.active)f.data.kinetic=0; return true; } return false; },
        draw: (ctx,f) => { const col=f.data.afterTier>=4?'#9d1515':f.data.afterTier>=3?'#020202':f.color; if(f.data.deform>0){ctx.scale(1+f.data.deform*.35,1-f.data.deform*.18);f.data.deform=Math.max(0,f.data.deform-.04);} drawSketchBlob(ctx,f.radius,col,16); if(f.data.afterTier>=4){ctx.fillStyle='rgba(255,60,20,.35)';for(let i=0;i<8;i++){ctx.beginPath();ctx.arc(rand(-55,55),rand(-55,55),rand(8,18),0,TAU);ctx.fill();}} ctx.fillStyle='#ffd4e7';ctx.font='900 16px monospace';ctx.textAlign='center';ctx.fillText(f.data.active?`K${f.data.kinetic||0}`:f.data.afterTier?`T${f.data.afterTier}`:'',0,4); if(f.data.subSkill){ctx.fillStyle='#ffe0e8';ctx.font='900 12px monospace';ctx.fillText(rubberSubSkillLabel(f.data.subSkill).slice(0,14),0,24); ctx.fillStyle='#ffb0c8';ctx.font='900 15px monospace';ctx.fillText('CD '+Math.max(0,(f.data.subData?.cd||0)).toFixed(1),0,45);} }
    },
    {
        name: "ICE", color: "#74d8e8", desc: "Frost lane and ice dagger execution", speed: 490, startDx: 1, startDy: 0.75,
        init: f => { f.data.cd = 1.5; f.data.laneActive = false; f.data.rageTouches = {}; },
        update: (f,e,dt) => { if(!f.data.laneActive) f.data.cd -= abilityDt(f, dt); if(!f.data.laneActive && f.data.cd <= 0){ const a=Math.atan2(e.y-f.y,e.x-f.x); const far=pointOnRayToEdge(f.x,f.y,Math.cos(a),Math.sin(a)); projectiles.push({type:'ice_lane',owner:f,x1:f.x,y1:f.y,x2:far.x,y2:far.y,halfWidth:205,life:6.6,maxLife:6.6,enemyInside:0,dmgTick:0}); f.data.laneActive=true; playFighterSound(f,'skill'); } },
        onCollide: (f,e) => { if(f.isRage){ const rec=f.data.rageTouches[e.id]||{n:0,t:0}; if(matchClock-rec.t>5.5)rec.n=0; rec.n++; rec.t=matchClock; f.data.rageTouches[e.id]=rec; floatingTexts.push(new FloatingText(e.x,e.y-e.radius-50,`${rec.n}/3 FROST`, '#bff7ff')); if(rec.n>=3){{ const bonus=e.hasStatus('frostMark')?1.25:1; e.applyStatus('freeze',1.8,{source:f,dartTotal:rand(10,16)*bonus}); e.applyStatus('frostMark',7); rec.n=0; }} } return false; },
        draw: (ctx,f) => { drawPolygon(ctx, [[0,-78],[58,-20],[32,62],[-45,55],[-66,-10]], f.color, '#10353a', 5); ctx.strokeStyle='#eaffff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-40,-20);ctx.lineTo(35,24);ctx.moveTo(-20,50);ctx.lineTo(10,-56);ctx.stroke(); }
    },
    {
        name: "VAMPIRE", color: "#6f0b15", desc: "Fixed-contact bite and growing eternal blood link", speed: 545, startDx: 1, startDy: 0.25,
        init: f => { f.data.latchTimer=0; f.data.latchCd=0; f.data.latchTick=0; f.data.latchOffset={x:0,y:0}; f.data.bloodLinkLevel=0; f.data.linkTick=0; },
        update: (f,e,dt) => { if(f.data.latchTimer>0){ f.data.positionLocked=true; f.data.latchTimer-=dt; const off=f.data.latchOffset||norm(f.x-e.x,f.y-e.y); const gap=e.radius+f.radius+2; f.x=clamp(e.x+off.x*gap,f.radius,GAME_SIZE-f.radius); f.y=clamp(e.y+off.y*gap,f.radius,GAME_SIZE-f.radius); f.setDir(e.x-f.x,e.y-f.y); e.applyStatus('slow',0.18,{mult:.3}); f.data.latchTick+=dt; if(f.data.latchTick>=.5){f.data.latchTick-=.5; const d=scaledByMirror(f,1.5); e.takeDamage(d,f,'blood-drain'); f.heal(d,true); f.hp=Math.min(f.hp,125);} if(f.data.latchTimer<=0)f.data.latchCd=2.1; } else f.data.latchCd=Math.max(0,f.data.latchCd-abilityDt(f,dt)); if(f.isRage&&f.data.bloodLinkLevel>0){ f.data.linkTick+=dt; while(f.data.linkTick>=.5){ f.data.linkTick-=.5; const d=.375*f.data.bloodLinkLevel; e.takeDamage(d,f,'permanent-blood-link',true); f.heal(d,true); if(f.data.bloodLinkLevel>=4) e.applyStatus('slow',2,{mult:.8}); } } },
        onCollide: (f,e) => { if(f.data.latchCd<=0&&f.data.latchTimer<=0){ f.data.latchOffset=norm(f.x-e.x,f.y-e.y); f.data.latchTimer=5.0; f.data.latchTick=0; f.data.latchPulse=.45; if(f.isRage){ f.data.bloodLinkLevel=(f.data.bloodLinkLevel||0)+1; floatingTexts.push(new FloatingText(e.x,e.y-e.radius-66,`BLOOD LINK ${f.data.bloodLinkLevel}`,'#ff3040')); } playFighterSound(f,'skill'); } return false; },
        draw: (ctx,f) => { const latched=f.data.latchTimer>0; if(latched){ ctx.scale(.82,.82); ctx.globalAlpha=.98; } drawSketchBlob(ctx,f.radius,'#4a0710',14); ctx.fillStyle='#fff0e8'; ctx.beginPath(); ctx.moveTo(42,-28);ctx.lineTo(104,-12);ctx.lineTo(46,3);ctx.fill();ctx.beginPath();ctx.moveTo(42,28);ctx.lineTo(104,12);ctx.lineTo(46,-3);ctx.fill(); if(latched){ ctx.strokeStyle='rgba(255,30,45,.85)'; ctx.lineWidth=7; ctx.beginPath(); ctx.arc(58,0,30,0,TAU); ctx.stroke(); ctx.fillStyle='#ffb2a8'; ctx.font='900 14px monospace'; ctx.textAlign='center'; ctx.fillText('LOCKED BITE',0,-f.radius-20); } if(f.data.bloodLinkLevel>0){ctx.strokeStyle='rgba(255,20,40,.75)';ctx.lineWidth=4+Math.min(18,f.data.bloodLinkLevel*2);ctx.beginPath();ctx.arc(0,0,f.radius+22+Math.min(35,f.data.bloodLinkLevel*4),0,TAU);ctx.stroke();} }
    },

    {
        name: "STRING", color: "#2c1935", desc: "Living snare web network", speed: 505, startDx: 0.7, startDy: 1,
        init: f => {},
        speedModifier: f => 1,
        onWallBounce: (f, side) => {},
        draw: (ctx, f) => { drawSketchBlob(ctx, f.radius, '#f0a6d4', 14); }
    },
    {
        name: "VOLCANO", color: "#763226", desc: "Triple-damage meteor disaster", speed: 425, startDx: 1, startDy: 1,
        init: f => { f.data.cd = 1.8; },
        update: (f,e,dt) => { f.data.cd -= abilityDt(f,dt); if (f.data.cd <= 0) { f.data.cd = 11.5; playFighterSound(f,'skill'); triggerFlash(255,80,0,0.18); let delay=0.20; for(let i=0;i<9;i++){ delay += rand(0.10,0.40); const predictedX = e ? clamp(e.x + e.dir.x * e.baseSpeed * 0.55 + rand(-100,100),100,900) : rand(100,900); const predictedY = e ? clamp(e.y + e.dir.y * e.baseSpeed * 0.55 + rand(-100,100),100,900) : rand(100,900); projectiles.push({type:'meteor',owner:f,x:i<4?predictedX:rand(100,900),y:i<4?predictedY:rand(100,900),radius:90,delay,life:delay+0.25,hit:false,volcanoAmp:3}); } } },
        draw: (ctx,f) => { const r=f.radius; drawPolygon(ctx,[[-r,-r*.1],[-r*.55,-r*.8],[r*.3,-r*.65],[r*.9,-r*.05],[r*.72,r*.75],[-r*.55,r*.7]],f.color,'#190704',6); ctx.strokeStyle='#ff9b2e'; ctx.lineWidth=7; ctx.beginPath(); ctx.moveTo(-30,-35); ctx.lineTo(-5,0); ctx.lineTo(18,-22); ctx.lineTo(36,35); ctx.stroke(); ctx.fillStyle='#ff4e00'; ctx.beginPath(); ctx.arc(3,3,25,0,TAU); ctx.fill(); }
    },
    {
        name: "MAGNET", color: "#c6a92d", desc: "Two-pole magnetic slam field", speed: 475, startDx: 1, startDy: -0.75,
        init: f => { f.data.cd = 2.5; f.data.fieldTimer = 0; },
        update: (f,e,dt) => { f.data.cd -= abilityDt(f,dt); if (f.data.cd <= 0) { f.data.cd=6.6; f.data.fieldTimer=3.1; projectiles.push({type:'magnet_field',owner:f,radius:310,life:3.1,maxLife:3.1,hitCd:{},inside:{},slamCd:0}); playFighterSound(f,'skill'); } if (f.data.fieldTimer>0) { f.data.fieldTimer-=dt; const shell=310; if(f.x<shell){f.x=shell;f.setDir(1,f.dir.y);} if(f.x>GAME_SIZE-shell){f.x=GAME_SIZE-shell;f.setDir(-1,f.dir.y);} if(f.y<shell){f.y=shell;f.setDir(f.dir.x,1);} if(f.y>GAME_SIZE-shell){f.y=GAME_SIZE-shell;f.setDir(f.dir.x,-1);} } },
        draw: (ctx, f) => { ctx.save(); ctx.lineWidth=22; ctx.strokeStyle=f.color; ctx.lineCap='square'; ctx.beginPath(); ctx.arc(0,0,48,-Math.PI*.78,Math.PI*.78); ctx.stroke(); ctx.lineWidth=7; ctx.strokeStyle='#211b00'; ctx.stroke(); ctx.fillStyle='#211b00'; ctx.fillRect(35,-70,30,28); ctx.fillRect(35,42,30,28); if(f.data.fieldTimer>0){ctx.strokeStyle='rgba(255,225,58,0.45)';ctx.lineWidth=4;ctx.setLineDash([12,10]);ctx.beginPath();ctx.arc(0,0,310,0,TAU);ctx.stroke();ctx.setLineDash([]);} ctx.restore(); }
    },
    {
        name: "FLASH", color: "#e6d946", desc: "Readable lightning zigzag rage", speed: 620, startDx: 1, startDy: 0.8,
        init: f => { f.data.cd = 2; f.data.dashTimer = 0; f.data.dashHitIds = {}; f.data.rageCd = 1.0; f.data.ragePrep = 0; f.data.zigzag = null; f.data.zigIndex = 0; f.data.zigTimer = 0; f.data.zigHitCd = 0; f.data.zigHitCount = 0; },
        speedModifier: f => f.data.dashTimer > 0 ? (f.data.zigTimer > 0 ? 9.4 : 5.0) : (f.data.ragePrep > 0 ? 0.12 : 1),
        update: (f,e,dt) => {
            if (f.isRage) {
                if (f.data.ragePrep > 0) {
                    f.data.ragePrep -= dt; f.applyStatus('immune', 0.08); f.data.dashTimer = Math.max(f.data.dashTimer || 0, 0.12);
                    if (f.data.ragePrep <= 0) {
                        const pts = [{x:f.x,y:f.y}];
                        const rows = [150, 310, 470, 630, 790];
                        const leftFirst = Math.random()<.5;
                        for (let i=0;i<rows.length;i++) pts.push({x:leftFirst === (i%2===0) ? rand(110,260) : rand(740,890), y:clamp(rows[i]+rand(-65,65),95,905)});
                        if (Math.random()<.6) pts.push({x:rand(120,880), y:rand(120,880)});
                        f.data.zigzag = pts; f.data.zigIndex = 1; f.data.zigTimer = 2.0; f.data.dashHitIds = {}; f.data.zigHitCd = 0; f.data.zigHitCount = 0; playFighterSound(f,'skill');
                    }
                    return;
                }
                if (f.data.zigTimer > 0 && f.data.zigzag) {
                    f.data.zigTimer -= dt; f.data.zigHitCd=Math.max(0,(f.data.zigHitCd||0)-dt); f.applyStatus('immune', 0.08); f.data.dashTimer = 0.12;
                    const target = f.data.zigzag[f.data.zigIndex];
                    if (target) { f.setDir(target.x-f.x, target.y-f.y); if (dist(f.x,f.y,target.x,target.y)<32) f.data.zigIndex++; }
                    if (!target || f.data.zigTimer <= 0 || f.data.zigIndex >= f.data.zigzag.length) { f.data.zigTimer=0; f.data.zigzag=null; f.data.dashTimer=0; f.data.rageCd=1.55; }
                    return;
                }
                f.data.rageCd -= abilityDt(f,dt);
                if (f.data.rageCd <= 0) { f.data.rageCd = 3.5; f.data.ragePrep = 1.0; f.data.zigzag = null; floatingTexts.push(new FloatingText(f.x,f.y-f.radius-70,'DRAWING ZIGZAG','#fff06b')); playFighterSound(f,'wall'); return; }
            }
            if(f.data.dashTimer>0){ f.data.dashTimer-=dt; f.applyStatus('immune',0.05); if(Math.random()<0.42)emitParticles(f.x,f.y,f.color,2,35,8,.28,'square'); if(f.data.dashTimer<=0)f.data.dashHitIds={}; }
            else { f.data.cd -= abilityDt(f,dt); if(f.data.cd<=0){ f.data.cd=6.5; f.data.dashTimer=.4; f.data.dashHitIds={}; f.setDir(e.x-f.x,e.y-f.y); playFighterSound(f,'skill'); } }
        },
        onCollide: (f,e) => { if(f.data.dashTimer>0 && !f.data.dashHitIds[e.id]){ f.data.dashHitIds[e.id]=true; if(f.data.zigTimer>0){ if((f.data.zigHitCd||0)>0) return true; f.data.zigHitCd=.18; f.data.zigHitCount=(f.data.zigHitCount||0)+1; e.takeDamage(scaledByMirror(f,10),f,'flash-zigzag'); if(f.data.zigHitCount===2){e.takeDamage(scaledByMirror(f,15),f,'flash-zigzag-bonus'); floatingTexts.push(new FloatingText(e.x,e.y-e.radius-70,'ZIGZAG BONUS','#fff06b'));} return true; } const dmg = 6; e.takeDamage(scaledByMirror(f,dmg),f,'flash-dash'); return true; } return false; },
        draw: (ctx,f) => { drawPolygon(ctx,[[-28,-70],[55,-8],[16,-5],[52,70],[-62,-3],[-12,0]],f.color,'#211c00',5); ctx.strokeStyle='#fff7a0';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-55,-28);ctx.lineTo(15,-12);ctx.lineTo(-20,8);ctx.lineTo(58,30);ctx.stroke(); if(f.isRage){ctx.save();ctx.rotate(-Math.atan2(f.dir.y,f.dir.x));ctx.translate(-f.x,-f.y); if(f.data.ragePrep>0){ctx.strokeStyle='rgba(255,240,107,.9)';ctx.lineWidth=8;ctx.setLineDash([10,8]);ctx.beginPath();ctx.arc(f.x,f.y,120,0,TAU);ctx.stroke();ctx.setLineDash([]);} if(f.data.zigzag){ctx.strokeStyle='rgba(246,232,74,.72)';ctx.lineWidth=7;ctx.beginPath();for(let i=0;i<f.data.zigzag.length;i++){const p=f.data.zigzag[i];i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.stroke();ctx.strokeStyle='rgba(255,255,210,.38)';ctx.lineWidth=18;ctx.stroke();} ctx.restore();} }
    },

    {
        name: "ELECTRIC", color: "#2f6dff", desc: "Wall-hit charge discharge on contact", speed: 505, startDx: 1, startDy: -1, noRage: true,
        init: f => { f.data.wallHits = 0; f.data.wallNodes = []; f.data.nodeWallCd = 0; },
        update: (f,e,dt) => { f.data.nodeWallCd=Math.max(0,(f.data.nodeWallCd||0)-dt); },
        onWallBounce: (f, side) => {
            if(sawWallRage.timer>0 && sawWallRage.owner && sawWallRage.owner!==f){ floatingTexts.push(new FloatingText(f.x,f.y-f.radius-55,'CHARGE BLOCKED','#bde5ff')); return; }
            if((f.data.nodeWallCd||0)>0) return;
            f.data.nodeWallCd=.10;
            f.data.wallHits=(f.data.wallHits||0)+1;
            const pnt={x:f.x,y:f.y};
            if(side==='left')pnt.x=0; if(side==='right')pnt.x=GAME_SIZE; if(side==='top')pnt.y=0; if(side==='bottom')pnt.y=GAME_SIZE;
            f.data.wallNodes ||= [];
            f.data.wallNodes.push({x:pnt.x,y:pnt.y});
            if(f.data.wallNodes.length>18) f.data.wallNodes.shift();
            projectiles.push({type:'electric_node',owner:f,x:pnt.x,y:pnt.y,radius:18,life:2.8,maxLife:2.8,armed:.15,picked:true,visualOnly:true});
            floatingTexts.push(new FloatingText(f.x, f.y - f.radius - 55, `CHARGE ${f.data.wallHits}`, '#bde5ff'));
            playFighterSound(f,'wall');
        },
        onTakeDamage: (f, amount) => {},
        onCollide: (f,e) => {
            const charges = f.data.wallHits || 0;
            if(charges <= 0) return false;
            const lost = Math.max(0, f.maxHp - f.hp);
            const dmg = scaledByMirror(f, 0.002 * (lost + 10) * Math.pow(2, charges));
            const nodes = (f.data.wallNodes && f.data.wallNodes.length ? f.data.wallNodes : [{x:f.x,y:f.y}]).slice(-Math.min(18, charges));
            for(const node of nodes){ projectiles.push({type:'lightning',owner:f,x1:node.x,y1:node.y,x2:e.x,y2:e.y,life:.36,maxLife:.36}); }
            projectiles.push({type:'lightning',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.24,maxLife:.24});
            e.takeDamage(dmg,f,'electric-contact');
            floatingTexts.push(new FloatingText(e.x, e.y - e.radius - 72, `DISCHARGE ${charges} CH`, '#bde5ff'));
            triggerFlash(255,255,255,.24);
            playFighterSound(f,'skill');
            f.data.wallHits = 0;
            f.data.wallNodes = [];
            return false;
        },
        draw: (ctx,f) => { drawSketchBlob(ctx,f.radius*.82,'#1f3d90',11); ctx.strokeStyle='#bde5ff';ctx.lineWidth=7; for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(rand(-60,-10),rand(-55,55));ctx.lineTo(rand(-5,30),rand(-55,55));ctx.lineTo(rand(20,70),rand(-55,55));ctx.stroke();} ctx.fillStyle='#e9fbff';ctx.font='900 24px monospace';ctx.textAlign='center';ctx.fillText(String(f.data.wallHits),0,9); }
    },

    {
        name: "ORBIT", color: "#dedbd1", desc: "Random elemental satellite system", speed: 430, startDx: 1, startDy: 1,
        init: f => { f.data.cd = 2.2; f.data.theta = 0; f.data.sats = [newOrbitSat(0), newOrbitSat(Math.PI)]; f.data.rageCd = 0; },
        update: (f,e,dt) => { const full=f.data.sats.length>=6; f.data.theta+=dt*(full?5.6:4.2); f.data.cd-=abilityDt(f,dt); if(f.data.cd<=0){ f.data.cd=6.2; while(f.data.sats.length<6 && Math.random()<.72) f.data.sats.push(newOrbitSat(Math.random()*TAU)); if(f.data.sats.length<6)f.data.sats.push(newOrbitSat(Math.random()*TAU)); playFighterSound(f,'skill'); } if(f.isRage){ f.data.rageCd-=abilityDt(f,dt); if(f.data.rageCd<=0&&f.data.sats.length<6){ f.data.rageCd=1.6; const sat=newOrbitSat(Math.random()*TAU); sat.ring=2; f.data.sats.push(sat); } } for(let i=f.data.sats.length-1;i>=0;i--){ const sat=f.data.sats[i]; sat.cd=Math.max(0,sat.cd-dt); const rad=sat.ring===2?175:full?150:130; const sx=f.x+Math.cos(f.data.theta+sat.a)*rad; const sy=f.y+Math.sin(f.data.theta+sat.a)*rad; if(sat.cd<=0&&dist(sx,sy,e.x,e.y)<24+e.radius){ e.takeDamage(scaledByMirror(f,2.2),f,'satellite'); applyOrbitEffect(sat,e,f); sat.hp--; sat.cd=.55; emitParticles(sx,sy,sat.color,18,280,4,.5); if(sat.hp<=0)f.data.sats.splice(i,1); } } },
        draw: (ctx,f) => { const full=f.data.sats.length>=6; drawSketchBlob(ctx,f.radius*.78,'#d9d4c6',10); ctx.strokeStyle=full?'#fff7c6':'#1d1d1d';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,full?70:52,0,TAU);ctx.stroke(); for(const sat of f.data.sats){const rad=sat.ring===2?175:full?150:130; const sx=Math.cos(f.data.theta+sat.a)*rad;const sy=Math.sin(f.data.theta+sat.a)*rad;ctx.fillStyle=sat.color;ctx.strokeStyle='#111';ctx.lineWidth=4;ctx.beginPath();ctx.arc(sx,sy,22,0,TAU);ctx.fill();ctx.stroke();} }
    },
    {
        name: "TOXIC", color: "#6e9f2b", desc: "Poison level 5 rupture", speed: 465, startDx: 0.8, startDy: 1,
        init: f => { f.data.drop=0; f.data.selfPoisonTimer=0; f.data.spitCd=0; f.data.collisionCd=0; },
        update: (f,e,dt) => { f.data.drop-=dt; if(f.data.drop<=0){ f.data.drop=.10; projectiles.push({type:'toxic_trail',owner:f,x:f.x,y:f.y,radius:36,life:3.3,maxLife:3.3}); } if(f.data.toxicCharge && f.data.toxicCharge.timer>0){ f.data.toxicCharge.timer-=dt; if(f.data.toxicCharge.timer<=0){ const heal=(f.data.toxicCharge.amount||0)*0.70; if(heal>0)f.heal(heal,true); floatingTexts.push(new FloatingText(f.x,f.y-f.radius-76,`+${heal.toFixed(1)} CHARGE HEAL`,'#caff58')); f.data.toxicCharge=null; } } if(f.hasStatus('poison')&&f.statuses.poison.selfSafe)f.data.selfPoisonTimer+=dt; else f.data.selfPoisonTimer=0; f.data.spitCd=Math.max(0,f.data.spitCd-abilityDt(f,dt)); if(f.isRage&&f.data.selfPoisonTimer>2.3&&f.data.spitCd<=0){ f.data.spitCd=2.8; f.data.selfPoisonTimer=0; const d=norm(e.x-f.x,e.y-f.y); projectiles.push({type:'toxic_shot',owner:f,x:f.x,y:f.y,vx:d.x*900,vy:d.y*900,radius:45,life:2.2,maxLife:2.2}); playFighterSound(f,'skill'); } f.data.collisionCd=Math.max(0,f.data.collisionCd-dt); },
        onCollide: (f,e) => { if(f.data.collisionCd<=0){ f.data.collisionCd=1.0; const count=Math.floor(rand(4,12)); for(let i=0;i<count;i++)projectiles.push({type:'toxic_puddle',owner:f,x:f.x+rand(-100,100),y:f.y+rand(-100,100),radius:54,life:3.4,maxLife:3.4}); f.takeDamage(1,f,'self-toxic'); playFighterSound(f,'skill'); } return false; },
        draw: (ctx,f) => { drawSketchBlob(ctx,f.radius,f.color,16); ctx.fillStyle='#172408'; for(let i=0;i<7;i++){ctx.beginPath();ctx.arc(rand(-45,45),rand(-40,40),rand(5,13),0,TAU);ctx.fill();} ctx.strokeStyle='#caff58';ctx.lineWidth=3;ctx.beginPath();ctx.arc(25,-20,20,0,TAU);ctx.stroke(); }
    },
    {
        name: "MIRROR", color: "#aeb6ba", desc: "Broken and whole mirror skill swap", speed: 485, startDx: 1, startDy: 1,
        init: f => { f.data.cd=1.2; f.data.gateSwapCd=0; f.data.stolenType=null; f.data.stolenTimer=0; f.data.stolenData={}; f.data.stolenPower=1; f.data.stolenVictim=null; },
        update: (f,e,dt) => { f.data.gateSwapCd=Math.max(0,(f.data.gateSwapCd||0)-dt); f.data.cd-=abilityDt(f,dt); if(f.data.cd<=0){ f.data.cd=10; createMirrorGate(f); } },
        onCollide: (f,e,dt,normal,copied) => mirrorStolenCollide(f,e,dt,normal),
        draw: (ctx,f) => { const shards=[[[-55,-50],[8,-35],[-12,8],[-65,20]],[[10,-60],[62,-28],[35,12],[-8,-4]],[[-22,15],[24,0],[58,55],[-35,62]]]; for(const s of shards)drawPolygon(ctx,s,f.color,'#141414',4); ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-44,-28);ctx.lineTo(44,38);ctx.moveTo(35,-23);ctx.lineTo(-28,46);ctx.stroke(); if(f.data.stolenType){ctx.fillStyle='#fff';ctx.font='900 18px monospace';ctx.textAlign='center';ctx.fillText(`${f.data.stolenType.name} Ä‚â€”${f.data.stolenPower}`,0,88);} }
    },
    {
        name: "BLACK_HOLE", color: "#19101c", desc: "Rage absorbs damage and reflects double", speed: 435, startDx: 1, startDy: 1.1,
        init: f => { f.data.cd = 2.6; },
        update: (f,e,dt) => { f.data.cd-=abilityDt(f,dt); if(f.data.cd<=0){ f.data.cd=7.5; projectiles.push({type:'gravity_well',owner:f,x:f.x,y:f.y,core:100,radius:200,life:3.1,maxLife:3.1,exploded:false,absorbed:0,absorbedDamage:0}); triggerFlash(0,0,0,.35); playFighterSound(f,'skill'); } },
        draw: (ctx,f) => { ctx.fillStyle='#000';ctx.strokeStyle='#3f2858';ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,0,58,0,TAU);ctx.fill();ctx.stroke(); for(let i=0;i<3;i++){ctx.rotate(.45+i*.3);ctx.strokeStyle=`rgba(100,58,138,${.45-i*.1})`;ctx.beginPath();ctx.ellipse(0,0,82+i*18,25+i*6,0,0,TAU);ctx.stroke();} }
    },
    {
        name: "SAW", color: "#963326", desc: "Blood-rip and rage saw-wall arena", speed: 530, startDx: 1, startDy: 0.65,
        init: f => { f.data.cd=1.1; f.data.spin=0; f.data.angle=0; f.data.hitCd=0; },
        speedModifier: f => f.data.spin>0?1.55:1,
        update: (f,e,dt) => { f.data.angle += dt * (f.data.spin>0 ? 31 : 5); f.data.hitCd = Math.max(0, f.data.hitCd - dt); if (f.data.spin > 0) { if(f.isRage){sawWallRage.timer=Math.max(sawWallRage.timer,.18);sawWallRage.owner=f;sawWallRage.phase+=dt*3;} f.data.spin -= dt; if (dist(f.x,f.y,e.x,e.y) <= f.radius + e.radius + 46 && f.data.hitCd <= 0) { f.data.hitCd = .20; let dmg=f.isRage?5.3:4.4; if(e.hasStatus('bleed')){ const lost=Math.max(0,e.maxHp-e.hp); dmg += 3.5 + lost*.035; floatingTexts.push(new FloatingText(e.x,e.y-e.radius-62,'BLOOD RIP','#ff6358')); } e.takeDamage(scaledByMirror(f,dmg), f, 'blood-rip-saw'); e.applyStatus('bleed', 4.8, { source: f }); const n = norm(e.x-f.x,e.y-f.y); e.applyStatus('push', .12, { x:n.x, y:n.y, strength: 620 }); emitParticles(e.x,e.y,'#f6d06a',25,620,4,.38,'square'); } } else { f.data.cd -= abilityDt(f,dt); if(f.data.cd<=0){ f.data.cd=4.8; f.data.spin=4.1; playFighterSound(f,'skill'); } } },
        onCollide: (f,e) => { if(f.data.spin>0 && f.data.hitCd<=0){ f.data.hitCd=.20; let dmg=f.isRage?5.3:4.4; if(e.hasStatus('bleed')){ const lost=Math.max(0,e.maxHp-e.hp); dmg += 3.5 + lost*.035; } e.takeDamage(scaledByMirror(f,dmg),f,'saw-impact'); e.applyStatus('bleed',4.8,{source:f}); const n=norm(e.x-f.x,e.y-f.y); e.applyStatus('push',.18,{x:n.x,y:n.y,strength:680}); return true; } return false; },
        draw: (ctx,f) => { ctx.save();ctx.rotate(f.data.angle);const r=f.radius;ctx.beginPath();for(let i=0;i<32;i++){const a=i/32*TAU;const rr=i%2===0?r+30:r-9;const x=Math.cos(a)*rr,y=Math.sin(a)*rr;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.fillStyle='#c7c0b0';ctx.fill();ctx.strokeStyle='#101010';ctx.lineWidth=6;ctx.stroke();ctx.fillStyle=f.color;ctx.beginPath();ctx.arc(0,0,35,0,TAU);ctx.fill();if(f.data.spin>0){ctx.strokeStyle='rgba(255,80,20,.75)';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,r+44,0,TAU);ctx.stroke();}ctx.restore(); }
    },
    {
        name: "BLADE", color: "#c6cfd2", desc: "Huge crescent waves with red weak slash", speed: 520, startDx: 1, startDy: 0.9,
        init: f => {},
        onWallBounce: f => { const a=Math.atan2(GAME_SIZE/2-f.y,GAME_SIZE/2-f.x); const spread=f.isRage?[-.16,.16]:[0]; for(const off of spread){const aa=a+off; projectiles.push({type:'blade_wave',owner:f,x:f.x,y:f.y,vx:Math.cos(aa)*1050,vy:Math.sin(aa)*1050,halfWidth:240,length:360,life:2.2,maxLife:2.2,dmg:scaledByMirror(f,2.7),bounces:f.isRage?2:0,hit:false});} playFighterSound(f,'skill'); },
        draw: (ctx,f) => { drawPolygon(ctx,[[-58,-26],[28,-16],[82,0],[28,16],[-58,26],[-35,0]],f.color,'#101010',5);ctx.fillStyle='#202326';ctx.fillRect(-72,-18,28,36);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-10,-11);ctx.lineTo(64,0);ctx.lineTo(-10,11);ctx.stroke(); }
    },
    {
        name: "NOVA", color: "#c98743", desc: "Peak auto-detonation fate core", speed: 395, startDx: 1, startDy: 1,
        init: f => { f.data.chargeTime=0; },
        update: (f,e,dt) => { const prev=f.data.chargeTime; f.data.chargeTime=clamp(f.data.chargeTime+abilityDt(f,dt),0,15); const dmg=novaDamage(f.data.chargeTime); if(prev<8 && f.data.chargeTime>=8){ const maxD=Math.hypot(GAME_SIZE,GAME_SIZE); const ratio=clamp(1-dist(f.x,f.y,e.x,e.y)/maxD,0,1); const dealt=9 + (46-9)*ratio; if(dealt>0)e.takeDamage(scaledByMirror(f,dealt),f,'nova-peak-auto'); spawnShockwave(f.x,f.y,'#fff1b4',360); triggerFlash(255,230,160,.28); f.data.chargeTime=0; playFighterSound(f,'death'); return; } if(dmg>34){ cameraShake=Math.max(cameraShake,1.4); if(Math.random()<.18)emitParticles(f.x,f.y,'#fff1b4',3,120,5,.25,'square'); } },
        onCollide: (f,e) => { const dmg=novaDamage(f.data.chargeTime); if(dmg>0){ e.takeDamage(scaledByMirror(f,dmg),f,'nova-contact'); spawnShockwave(f.x,f.y,'#fff1b4',250); triggerFlash(255,230,160,.22); if(f.isRage&&Math.random()<.45){ setTimeout(()=>{ if(e.hp>0) e.takeDamage(scaledByMirror(f,dmg*.55),f,'nova-double'); },250); spawnShockwave(e.x,e.y,'#fff1b4',180);} f.data.chargeTime=0; playFighterSound(f,'death'); return true; } return false; },
        draw: (ctx,f) => { drawSketchBlob(ctx,f.radius*.9,'#5b3419',12); const dmg=novaDamage(f.data.chargeTime); const r=clamp(14+dmg*1.45,16,f.radius+42); ctx.fillStyle='#fff2b0';ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();ctx.strokeStyle=Math.abs(f.data.chargeTime-8)<.55?'#fff':'#ff8e1f';ctx.lineWidth=Math.abs(f.data.chargeTime-8)<.55?10:5;ctx.beginPath();ctx.arc(0,0,r+8,0,TAU);ctx.stroke();ctx.fillStyle='#220';ctx.font='900 18px monospace';ctx.textAlign='center';ctx.fillText(dmg.toFixed(1),0,7); }
    },
    {
        name: "HUNTER", color: "#203d28", desc: "Invisible hunt mode with homing weak strike", speed: 500, startDx: 1, startDy: 0.85,
        init: f => { f.data.cd=2.2; f.data.hitCd=0; f.data.hunt=0; },
        speedModifier: f => f.data.hunt>0 ? 1.65 : 1,
        update: (f,e,dt) => {
            f.data.hitCd=Math.max(0,f.data.hitCd-dt);
            if(f.data.hunt>0){
                f.data.hunt-=dt;
                const n=norm(e.x-f.x,e.y-f.y);
                const steer = norm(f.dir.x*0.25+n.x*0.75, f.dir.y*0.25+n.y*0.75);
                f.setDir(steer.x, steer.y);
                if(f.data.hunt<=0) f.data.cd=2;
            } else {
                f.data.cd-=abilityDt(f,dt);
                if(f.data.cd<=0){ f.data.hunt=4.0; floatingTexts.push(new FloatingText(f.x,f.y-f.radius-70,'HUNT MODE','#ffb0a0')); playFighterSound(f,'skill'); }
            }
        },
        onCollide: (f,e) => { if(f.data.hitCd>0)return false; f.data.hitCd=.45; if(f.data.hunt>0){ e.takeDamage(scaledByMirror(f,4),f,'hunt-strike'); e.applyStatus('weak',5); f.data.hunt=0; f.data.cd=7; spawnShockwave(e.x,e.y,'#ff3030',120); } else { let damage=2; let critChance=e.hasStatus('weak')?.5:0; let critMult=e.hasStatus('weak')?3:1; if(f.isRage){critChance+=.3;critMult+=2;} const crit=Math.random()<critChance; e.takeDamage(scaledByMirror(f,crit?damage*critMult:damage),f,crit?'knife-crit':'knife'); } return true; },
        draw: (ctx,f) => { const hidden=f.data.hunt>0; ctx.save(); if(hidden) ctx.globalAlpha=.14; drawSketchBlob(ctx,f.radius*.86,f.color,12); drawPolygon(ctx,[[15,-15],[104,0],[15,15],[30,0]],'#d0d0cc','#0d0d0d',4);ctx.fillStyle='#111';ctx.fillRect(-45,-22,34,44); ctx.restore(); if(f.data.hunt>0){ ctx.strokeStyle='rgba(255,45,40,.72)';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,f.radius+20,0,TAU);ctx.stroke();ctx.fillStyle='#ffb0a0';ctx.font='900 15px monospace';ctx.textAlign='center';ctx.fillText('HUNT',0,-f.radius-22);} }
    },
    {
        name: "CRYSTAL", color: "#6ed3d8", desc: "Diamond prison execution", speed: 405, startDx: 1, startDy: 1,
        init: f => { f.data.cd=1.8; },
        update: (f,e,dt) => { f.data.cd-=abilityDt(f,dt); if(f.data.cd<=0){ f.data.cd=2.4; const a=Math.atan2(e.y-f.y,e.x-f.x)+Math.PI/2; const len=190; const cx=(f.x+e.x)/2,cy=(f.y+e.y)/2; projectiles.push({type:'crystal_wall',owner:f,x1:cx-Math.cos(a)*len,y1:cy-Math.sin(a)*len,x2:cx+Math.cos(a)*len,y2:cy+Math.sin(a)*len,life:f.isRage?Infinity:5,maxLife:f.isRage?Infinity:5,hitIds:{},touchCd:{},permanent:f.isRage}); playFighterSound(f,'skill'); checkCrystalDiamond(f); } },
        draw: (ctx,f) => { drawPolygon(ctx,[[0,-75],[58,-18],[35,58],[-35,58],[-58,-18]],f.color,'#0a3236',5);ctx.strokeStyle='#e9ffff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-75);ctx.lineTo(0,58);ctx.moveTo(-58,-18);ctx.lineTo(58,-18);ctx.moveTo(-35,58);ctx.lineTo(0,-75);ctx.lineTo(35,58);ctx.stroke(); }
    },
    {
        name: "VIRUS", color: "#7fca3a", desc: "Permanent parasite exposure swarm", speed: 440, startDx: 1, startDy: 0.6,
        init: f => { f.data.spawnCd = 1.6; f.data.superFlash = 0; },
        update: (f,e,dt) => { f.data.spawnCd -= abilityDt(f, dt); f.data.superFlash = Math.max(0, (f.data.superFlash || 0) - dt); if (f.data.spawnCd <= 0) { f.data.spawnCd = 4.0; spawnVirusChildren(f, 3, 1, f.x, f.y); playFighterSound(f, 'skill'); } mergeVirusMinions(f, e); },
        draw: (ctx,f) => { drawSketchBlob(ctx,f.radius,'#5f8f2d',18); ctx.strokeStyle='#d4ff69';ctx.lineWidth=4; for(let i=0;i<9;i++){ctx.save();ctx.rotate(i*TAU/9);ctx.beginPath();ctx.moveTo(30,0);ctx.lineTo(82,0);ctx.stroke();ctx.fillStyle='#bfff5e';ctx.beginPath();ctx.arc(86,0,8,0,TAU);ctx.fill();ctx.restore();} ctx.fillStyle='#132206';ctx.beginPath();ctx.arc(-18,-10,9,0,TAU);ctx.arc(18,-10,9,0,TAU);ctx.arc(0,20,12,0,TAU);ctx.fill(); if(f.data.superFlash>0){ctx.strokeStyle='rgba(185,255,80,.85)';ctx.lineWidth=8;ctx.beginPath();ctx.arc(0,0,f.radius+38,0,TAU);ctx.stroke();} }
    },
    {
        name: "DRUM", color: "#b7783c", desc: "Wall shockwave drums and rage solo", speed: 455, startDx: 1, startDy: 0.72,
        init: f => { f.data.wallBeats = 0; f.data.rageSolo = 0; f.data.rageBeatTick = 0; f.data.rageBeatsLeft = 0; },
        speedModifier: f => f.data.rageSolo > 0 ? 0.30 : 1,
        update: (f,e,dt) => { f.data.wallWaveCd=Math.max(0,(f.data.wallWaveCd||0)-dt); if(f.data.rageSolo>0){ f.data.rageSolo-=dt; f.data.rageBeatTick-=dt; f.applyStatus('immune',0.06); if(f.data.rageBeatTick<=0 && f.data.rageBeatsLeft>0){ f.data.rageBeatTick=1.0; f.data.rageBeatsLeft--; projectiles.push({type:'drum_wave',owner:f,x:f.x,y:f.y,radius:8,maxRadius:1415,life:1.0,maxLife:1.0,minDmg:2,maxDmg:2}); playFighterSound(f,'skill'); } } },
        onWallBounce: (f, side) => { if((f.data.wallWaveCd||0)>0) return; f.data.wallWaveCd=.12; const pnt={x:f.x,y:f.y}; if(side==='left')pnt.x=0; if(side==='right')pnt.x=GAME_SIZE; if(side==='top')pnt.y=0; if(side==='bottom')pnt.y=GAME_SIZE; projectiles.push({type:'drum_wave',owner:f,x:pnt.x,y:pnt.y,radius:8,maxRadius:1415,life:.9,maxLife:.9,minDmg:.5,maxDmg:6}); f.data.wallBeatTimes=(f.data.wallBeatTimes||[]).filter(t=>matchClock-t<=5); f.data.wallBeatTimes.push(matchClock); if(f.isRage && f.data.wallBeatTimes.length>=3 && f.data.rageSolo<=0){ f.data.wallBeatTimes=[]; f.data.rageSolo=5; f.data.rageBeatTick=.05; f.data.rageBeatsLeft=5; floatingTexts.push(new FloatingText(f.x,f.y-f.radius-76,'DRUM SOLO','#ffcf7a')); } },
        onTakeDamage: (f, amount, src) => { if(f.data.rageSolo>0 && src && src!==f){ f.hp = Math.min(f.maxHp, f.hp + amount*0.5); f.damageTaken = Math.max(0, f.damageTaken - amount*0.5); } },
        draw: (ctx,f) => { drawSketchBlob(ctx,f.radius,'#6b3a20',14); ctx.fillStyle='#d8b17a';ctx.strokeStyle='#1b0d06';ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(0,0,60,48,0,0,TAU);ctx.fill();ctx.stroke();ctx.strokeStyle='#2a1408';ctx.lineWidth=5;for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(-58,i*18);ctx.lineTo(58,i*18);ctx.stroke();} if(f.data.rageSolo>0){ctx.strokeStyle='#ffcf7a';ctx.lineWidth=8;ctx.beginPath();ctx.arc(0,0,f.radius+34,0,TAU);ctx.stroke();} }
    },
    {
        name: "CARD", color: "#b58b52", desc: "Draw 3, reveal, guaranteed card throw", speed: 445, startDx: 1, startDy: -0.65,
        init: f => { f.data.deck = makeDeck(); f.data.hand = []; f.data.drawCd = 1; f.data.showTimer = 0; f.data.phase = 'draw'; f.data.resolvePulse = 0; f.data.lastDmg = 0; },
        update: (f,e,dt) => {
            f.data.resolvePulse = Math.max(0, (f.data.resolvePulse || 0) - dt);
            if (f.data.phase === 'show') {
                f.data.showTimer -= abilityDt(f, dt);
                if (f.data.showTimer <= 0) {
                    const hand = [...f.data.hand];
                    const dmg = f.isRage ? cardRageDamage(hand) : cardCaoDamage(hand);
                    f.data.lastDmg = dmg;
                    projectiles.push({type:'card_throw', owner:f, enemy:e, x:f.x, y:f.y - f.radius - 64, hand, dmg:scaledByMirror(f,dmg), radius:34, life:2.8, maxLife:2.8, hit:false, unblockable:true});
                    f.data.resolvePulse = .75;
                    f.data.hand = [];
                    f.data.deck = makeDeck();
                    f.data.phase = 'draw';
                    f.data.drawCd = 1;
                    playFighterSound(f, 'skill');
                }
                return;
            }
            f.data.drawCd -= abilityDt(f, dt);
            if (f.data.drawCd <= 0) {
                f.data.drawCd = 1;
                if (!f.data.deck || f.data.deck.length === 0) f.data.deck = makeDeck();
                f.data.hand.push(f.data.deck.pop());
                playFighterSound(f, 'wall');
                if (f.data.hand.length >= 3) {
                    f.data.phase = 'show';
                    f.data.showTimer = 1;
                    f.data.lastDmg = f.isRage ? cardRageDamage(f.data.hand) : cardCaoDamage(f.data.hand);
                }
            }
        },
        draw: (ctx,f) => { drawPolygon(ctx,[[-52,-70],[52,-70],[66,50],[-40,68]],'#efe7d2','#20150d',5);ctx.fillStyle='#20150d';ctx.font='900 27px serif';ctx.textAlign='center';ctx.fillText('AĂ¢â„¢Â ',0,-10);ctx.fillText('CARD',0,25); const hand=f.data.hand||[]; const scale=f.data.phase==='show'?1.28:1.0; for(let i=0;i<hand.length;i++){ const x=(-64+i*64)*scale, y=-f.radius-(f.data.phase==='show'?96:62); drawPlayingCard(ctx, hand[i], x, y, scale, -0.18+i*.18); } if(f.data.phase==='show'){ctx.fillStyle='#ffe8a0';ctx.strokeStyle='#120a04';ctx.lineWidth=5;ctx.font='900 30px serif';ctx.textAlign='center';ctx.strokeText(String(f.data.lastDmg),0,-f.radius-16);ctx.fillText(String(f.data.lastDmg),0,-f.radius-16);} if(f.data.resolvePulse>0){ctx.strokeStyle='rgba(255,232,160,.9)';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,f.radius+24,0,TAU);ctx.stroke();} }
    },
    {
        name: "MATH", color: "#e4dcc9", desc: "Unspoiled moving number spell", speed: 430, startDx: 1, startDy: -0.8,
        init: f => { f.data.cd=5; },
        update: (f,e,dt) => { f.data.cd-=abilityDt(f,dt); if(f.data.cd<=0){ f.data.cd=5; let formula,result,isRageFormula=false; if(f.isRage){ const rage = makeRageMathExpression(); result=rage.result; formula=rage.formula; isRageFormula=true; } else { const X=Math.round(f.x/50),Y=Math.round(f.y/50),A=Math.round(e.x/50),B=Math.max(1,Math.round(e.y/50)); result=Math.round((X-Y)*A/B); if(result===0) result = (Math.random()<.5?-1:1); formula=`(${X}Ă¢Ë†â€™${Y})Ä‚â€”${A}/${B}`; } projectiles.push({type:'math_formula',owner:f,enemy:e,formula,value:result,rage:isRageFormula,life:4.2,maxLife:4.2,phase:'typing',age:0,x:f.x,y:f.y,hit:false,launched:false,vx:0,vy:0}); playFighterSound(f,'skill'); } },
        draw: (ctx,f) => { drawPolygon(ctx,[[-60,-55],[58,-48],[66,48],[-55,60]],f.color,'#171717',5);ctx.fillStyle='#171717';ctx.font='900 25px monospace';ctx.textAlign='center';ctx.fillText('Ă¢Ë†â€˜',-20,-12);ctx.fillText('Ä‚Â·',22,-10);ctx.fillText('x:y',0,25); }
    },
    {
        name: "MATH_V2", color: "#8fcfff", desc: "Oxy graph wall caster", speed: 425, startDx: 1, startDy: 0.72,
        init: f => { f.data.cd=1.2; f.data.phase='idle'; f.data.timer=0; f.data.formula=null; f.data.option=null; },
        update: (f,e,dt) => { const hasGraph=projectiles.some(p=>p.type==='math_v2_graph'&&p.owner===f&&p.life>0); if(f.data.phase==='typing'){ f.data.timer-=dt; if(f.data.timer<=1 && !f.data.fullShown){ f.data.fullShown=true; floatingTexts.push(new FloatingText(f.x,f.y-f.radius-82,f.data.option.label,'#9ad7ff')); } if(f.data.timer<=0){ spawnMathV2Graph(f, f.data.option.label, f.data.option.fn); f.data.phase='idle'; f.data.cd=f.isRage?0:5; } return; } if(!hasGraph){ f.data.cd-=abilityDt(f,dt); if(f.data.cd<=0){ f.data.option=makeMathV2Function(); f.data.phase='typing'; f.data.timer=f.isRage?1.2:3; f.data.fullShown=false; const gridLife=(f.data.timer+4.5); projectiles.push({type:'math_v2_grid',owner:f,x:500,y:500,life:gridLife,maxLife:gridLife,formula:f.data.option.label}); playFighterSound(f,'skill'); } } },
        draw: (ctx,f) => { drawPolygon(ctx,[[-60,-55],[58,-48],[66,48],[-55,60]],'#cceeff','#173544',5); ctx.fillStyle='#173544'; ctx.font='900 18px monospace'; ctx.textAlign='center'; ctx.fillText('Oxy',0,-8); ctx.fillText('f(x)',0,22); if(f.data.phase==='typing'&&f.data.option){ const totalType=f.isRage?1.2:3; const progress=clamp((totalType-f.data.timer)/Math.max(.5,totalType-1),0,1); const txt=f.data.option.label.slice(0,Math.max(1,Math.floor(f.data.option.label.length*progress))); ctx.fillStyle='#eaffff'; ctx.strokeStyle='#0b1620'; ctx.lineWidth=4; ctx.strokeText(txt,0,-f.radius-18); ctx.fillText(txt,0,-f.radius-18); } }
    },
    {
        name: "SNIPER", color: "#2d3035", desc: "Guaranteed distance shot and rage corner nests", speed: 410, startDx: 1, startDy: -0.55,
        init: f => { f.data.cd=2.0; f.data.aim=0; f.data.aimMax=0; f.data.rageCd=0; f.data.nests=[{x:95,y:95},{x:905,y:95},{x:95,y:905},{x:905,y:905}]; f.data.nestIndex=0; },
        update: (f,e,dt) => {
            if(f.isRage){
                f.data.positionLocked=true;
                if(f.data.aim>0){
                    f.data.aim-=dt;
                    f.setDir(e.x-f.x,e.y-f.y);
                    if(dist(f.x,f.y,e.x,e.y)<300 && (f.data.aimMax-f.data.aim) > 0.45){ const best=f.data.nests.reduce((a,b)=>dist(b.x,b.y,e.x,e.y)>dist(a.x,a.y,e.x,e.y)?b:a,f.data.nests[0]); if(dist(best.x,best.y,e.x,e.y) > dist(f.x,f.y,e.x,e.y) + 120){ f.x=best.x; f.y=best.y; f.data.aim=3; f.data.aimMax=3; floatingTexts.push(new FloatingText(f.x,f.y-f.radius-70,'RELOCATE','#ff8b8b')); } return; }
                    if(f.data.aim<=0){ const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); const dmg=30*ratio; projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45}); e.takeDamage(scaledByMirror(f,dmg),f,'sniper-shot'); f.data.rageCd=3; playFighterSound(f,'skill'); }
                    return;
                }
                f.data.rageCd-=abilityDt(f,dt);
                if(f.data.rageCd<=0){ const best=f.data.nests.reduce((a,b)=>dist(b.x,b.y,e.x,e.y)>dist(a.x,a.y,e.x,e.y)?b:a,f.data.nests[0]); f.x=best.x; f.y=best.y; f.data.aim=3; f.data.aimMax=3; floatingTexts.push(new FloatingText(f.x,f.y-f.radius-70,'AIMING','#ff8b8b')); }
                return;
            }
            if(f.data.aim>0){ f.data.positionLocked=true; f.data.aim-=dt; f.setDir(e.x-f.x,e.y-f.y); if(f.data.aim<=0){ const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); const dmg=30*ratio; projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45}); e.takeDamage(scaledByMirror(f,dmg),f,'sniper-shot'); f.data.cd=8; playFighterSound(f,'skill'); } return; }
            f.data.cd-=abilityDt(f,dt); if(f.data.cd<=0){ const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); f.data.aim=Math.max(1.2,0.55+1.35*ratio); f.data.aimMax=f.data.aim; floatingTexts.push(new FloatingText(f.x,f.y-f.radius-70,'LOCK ON','#ff8b8b')); }
        },
        draw: (ctx,f) => { const crouch=f.isRage && f.data.aim<=0; ctx.save(); if(crouch){ ctx.translate(0,18); ctx.scale(.9,.62); ctx.globalAlpha=.72; } drawPolygon(ctx,[[-58,-40],[8,-56],[56,-30],[56,28],[8,54],[-58,42]],'#41464e','#090b0d',5); drawPolygon(ctx,[[8,-10],[122,-10],[122,10],[8,10]],'#7a7f86','#0a0a0a',4); ctx.fillStyle='#0a0a0a'; ctx.fillRect(32,-18,24,36); ctx.fillStyle='#636973'; ctx.fillRect(42,-26,20,10); ctx.fillStyle='#b9c0c8'; ctx.beginPath(); ctx.arc(-16,-8,8,0,TAU); ctx.arc(-16,8,8,0,TAU); ctx.fill(); ctx.restore(); if(f.data.aim>0){ const t=1-f.data.aim/Math.max(.1,f.data.aimMax||1); ctx.strokeStyle='rgba(255,90,90,.9)'; ctx.lineWidth=5; ctx.beginPath(); ctx.arc(0,0,f.radius+22+18*t,0,TAU); ctx.stroke(); ctx.fillStyle='#ff8b8b'; ctx.font='900 14px monospace'; ctx.textAlign='center'; ctx.fillText('AIM '+Math.round(t*100)+'%',0,-f.radius-22); } else if(crouch){ ctx.fillStyle='#b8bcc2'; ctx.font='900 13px monospace'; ctx.textAlign='center'; ctx.fillText('HIDDEN',0,-f.radius-18); } }
    }

    ,
    {
        name: "SLIME", color: "#7be66f", desc: "Split guard and gel armor", speed: 420, startDx: 1, startDy: 0.58,
        init: f => { f.data.splitCd=1.5; f.data.recentDamage=[]; f.data.gelArmorTimer=0; f.data.gelArmorReduction=0; },
        update: (f,e,dt) => { 
            f.data.splitCd -= abilityDt(f,dt);
            f.data.gelArmorTimer = Math.max(0,(f.data.gelArmorTimer||0)-dt);
            if (f.data.gelArmorTimer <= 0) { f.data.gelArmorReduction = 0; f.data.gelArmorStacks = 0; }
            if (f.data.delayedGel && f.data.delayedGel.length) {
                for (const d of f.data.delayedGel) {
                    d.timer -= dt; d.tick += dt;
                    while (d.tick >= .25 && d.remaining > 0) {
                        d.tick -= .25;
                        const chunk = Math.min(1, d.remaining);
                        d.remaining -= chunk;
                        f.takeDamage(chunk, d.source || null, 'gel-buffer-dot', true);
                    }
                }
                f.data.delayedGel = f.data.delayedGel.filter(d => d.timer > 0 && d.remaining > 0);
            }
            f.data.recentDamage=(f.data.recentDamage||[]).filter(x=>matchClock-x.t<2);
            const dmg2=f.data.recentDamage.reduce((a,b)=>a+b.amount,0);
            if(dmg2>=8 && f.data.splitCd<=0){
                const count=f.isRage?3:2;
                for(let i=0;i<count;i++) addSlimeChild(f, i*TAU/count + Math.random()*0.4);
                f.data.recentDamage=[]; f.data.splitCd=4.5;
                floatingTexts.push(new FloatingText(f.x,f.y-f.radius-76,'SPLIT GUARD',f.color));
                spawnShockwave(f.x,f.y,'#7be66f',170);
                playFighterSound(f,'skill');
            }
        },
        draw: (ctx,f) => { 
            ctx.save();
            const g=ctx.createRadialGradient(-18,-20,10,0,0,f.radius+22);
            g.addColorStop(0,'rgba(230,255,205,.95)');
            g.addColorStop(.45,'rgba(112,217,104,.72)');
            g.addColorStop(1,'rgba(27,92,34,.95)');
            ctx.fillStyle=g; ctx.strokeStyle='#143d18'; ctx.lineWidth=6;
            ctx.beginPath();
            for(let i=0;i<24;i++){const a=i*TAU/24; const r=f.radius*(.88+.13*Math.sin(i*1.7+matchClock*3)); const x=Math.cos(a)*r,y=Math.sin(a)*r; i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.globalAlpha=.35; ctx.fillStyle='#d8ffc8';
            for(let i=0;i<7;i++){ctx.beginPath();ctx.arc(-35+i*12, -22+Math.sin(i+matchClock*2)*12, 6+i%3,0,TAU);ctx.fill();}
            ctx.globalAlpha=1; ctx.fillStyle='#102b12'; ctx.beginPath(); ctx.arc(0,0,18,0,TAU); ctx.fill();
            if(f.data.gelArmorTimer>0){ctx.strokeStyle='#caffbb';ctx.lineWidth=10;ctx.setLineDash([14,8]);ctx.beginPath();ctx.arc(0,0,f.radius+22,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#d6ffc8';ctx.font='900 14px monospace';ctx.textAlign='center';ctx.fillText('GEL ARMOR',0,-f.radius-18);}
            ctx.restore();
        }
    },
    {
        name: "TIME", color: "#c8b6ff", desc: "Clock arena and rewind mark", speed: 430, startDx: 1, startDy: -0.67,
        init: f => { f.data.clockTick=3.5; f.data.markCd=2; f.data.mark=null; f.data.deathRewindUsed=false; },
        update: (f,e,dt) => { f.data.clockTick-=abilityDt(f,dt); if(f.data.clockTick<=0){ f.data.clockTick=3.5; const dmg=clockDamageValue(); e.takeDamage(scaledByMirror(f,dmg),f,'clock-hand'); floatingTexts.push(new FloatingText(e.x,e.y-e.radius-68,`CLOCK ${dmg}`,'#d6d0ff')); playFighterSound(f,'skill'); } if(f.data.mark){ const m=f.data.mark; m.timer-=dt; m.dealtNow=f.damageDone; if(f.hp<=0 && f.isRage && !f.data.deathRewindUsed){ f.data.deathRewindUsed=true; m.timer=0; f.hp=1; } if(m.timer<=0){ const lost=Math.max(0,m.hp-f.hp); const dealt=Math.max(0,(f.damageDone||0)-m.damageStart); f.x=m.x; f.y=m.y; f.hp=Math.min(f.maxHp,m.hp); if(e && dealt>0) e.heal(dealt,false); if(f.isRage) spawnTimeRift(f,m.x,m.y,lost); f.data.mark=null; f.data.markCd=9; floatingTexts.push(new FloatingText(f.x,f.y-f.radius-80,'REWIND','#d6d0ff')); updateHUD(); } return; } f.data.markCd-=abilityDt(f,dt); if(f.data.markCd<=0){ f.data.mark={x:f.x,y:f.y,hp:f.hp,timer:3,damageStart:f.damageDone||0}; f.data.markCd=99; projectiles.push({type:'time_mark',owner:f,x:f.x,y:f.y,life:3,maxLife:3}); floatingTexts.push(new FloatingText(f.x,f.y-f.radius-80,'TIME MARK','#d6d0ff')); } },
        draw: (ctx,f) => { drawPolygon(ctx,[[-55,-58],[55,-58],[66,0],[55,58],[-55,58],[-66,0]],'#2a2440','#d6d0ff',5);ctx.strokeStyle='#d6d0ff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,43,0,TAU);ctx.stroke();const a=((matchClock%13)/13)*TAU-Math.PI/2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*34,Math.sin(a)*34);ctx.moveTo(0,0);ctx.lineTo(25*Math.cos(matchClock),25*Math.sin(matchClock));ctx.stroke(); if(f.data.mark){ctx.fillStyle='#efeaff';ctx.font='900 12px monospace';ctx.textAlign='center';ctx.fillText('MARK '+f.data.mark.timer.toFixed(1),0,-f.radius-16);} }
    },
    {
        name: "WOLF", color: "#8f1010", desc: "Blood scent hunter", speed: 510, startDx: 1, startDy: 0.75,
        init: f => { f.data.scentCd=1.2; f.data.biteCd=0; },
        speedModifier: f => { const e=fighters.find(q=>q.id!==f.id); if(e&&e.hasStatus('scent')){ const lost=(e.maxHp-e.hp)/e.maxHp; if(dist(f.x,f.y,e.x,e.y)<1000*lost) return 1.75; } return 1; },
        update: (f,e,dt) => { f.data.biteCd=Math.max(0,(f.data.biteCd||0)-dt); f.data.scentCd-=abilityDt(f,dt); if(e.hasStatus('scent')){ const lost=(e.maxHp-e.hp)/e.maxHp; const radius=Math.max(120,1000*lost); if(dist(f.x,f.y,e.x,e.y)<radius){ const n=norm(e.x-f.x,e.y-f.y); f.setDir(f.dir.x*.62+n.x*.38,f.dir.y*.62+n.y*.38); } } if(f.data.scentCd<=0){ f.data.scentCd=7; spawnWolfScent(f,e); } },
        onCollide: (f,e) => { if(e.hasStatus('scent') && f.data.biteCd<=0){ e.takeDamage(scaledByMirror(f,10),f,'wolf-bite'); f.data.biteCd=2; if(f.isRage){ const chance=lerp(.5,1,clamp((50-f.hp)/50,0,1)); if(Math.random()<chance) e.applyStatus('weak',4,{source:f}); } floatingTexts.push(new FloatingText(e.x,e.y-e.radius-70,'BITE','#ff4646')); } },
        draw: (ctx,f) => { drawPolygon(ctx,[[-68,-18],[-16,-58],[50,-46],[72,-8],[42,42],[-36,56]],'#251010','#ff3030',5);ctx.fillStyle='#ff3030';ctx.beginPath();ctx.arc(22,-18,8,0,TAU);ctx.fill();ctx.fillStyle='#f1e3d3';ctx.beginPath();ctx.moveTo(52,-4);ctx.lineTo(92,-18);ctx.lineTo(58,16);ctx.fill();ctx.strokeStyle='rgba(255,40,40,.55)';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-45,36);ctx.lineTo(-92,66);ctx.stroke(); }
    },
    {
        name: "WIND", color: "#cfd9d4", desc: "Cyclone orbit and gale lane", speed: 360, startDx: 1, startDy: 0.42,
        init: f => { f.data.cx=f.x; f.data.cy=f.y; f.data.ca=0; f.data.galeCd=2; f.data.cycloneCd={}; },
        update: (f,e,dt) => { 
            f.data.cx += f.dir.x*f.baseSpeed*dt; f.data.cy += f.dir.y*f.baseSpeed*dt; 
            if(f.data.cx<120||f.data.cx>880){f.dir.x*=-1;f.data.cx=clamp(f.data.cx,120,880);} 
            if(f.data.cy<120||f.data.cy>880){f.dir.y*=-1;f.data.cy=clamp(f.data.cy,120,880);} 
            f.data.ca += dt*4.2; 
            const br=100 + (f.isRage?clamp((f.rageStartHp-f.hp)*10,0,300):0); 
            f.x=f.data.cx+Math.cos(f.data.ca)*br; f.y=f.data.cy+Math.sin(f.data.ca)*br; f.data.positionLocked=true; 
            if(e){ 
                f.data.cycloneCd[e.id]=Math.max(0,(f.data.cycloneCd[e.id]||0)-dt);
                f.data.cycloneHold ||= {};
                const hold=f.data.cycloneHold[e.id];
                if(hold && hold.timer>0){
                    hold.timer-=dt; hold.tick=(hold.tick||0)+dt; hold.angle += dt*7.0;
                    const rr = Math.max(38, br*.58);
                    e.x = clamp(f.data.cx + Math.cos(hold.angle)*rr, e.radius, GAME_SIZE-e.radius);
                    e.y = clamp(f.data.cy + Math.sin(hold.angle)*rr, e.radius, GAME_SIZE-e.radius);
                    e.data.positionLocked = true;
                    while(hold.tick>=.2){ hold.tick-=.2; e.takeDamage(1.2,f,'cyclone-core',true); }
                    if(hold.timer<=0){ f.data.cycloneCd[e.id]=1.5; delete f.data.cycloneHold[e.id]; }
                } else if(dist(e.x,e.y,f.data.cx,f.data.cy)<br+50+e.radius*.35 && f.data.cycloneCd[e.id]<=0){
                    f.data.cycloneHold[e.id]={timer:1, tick:0, angle:Math.atan2(e.y-f.data.cy,e.x-f.data.cx)};
                    floatingTexts.push(new FloatingText(e.x,e.y-e.radius-72,'CYCLONE HOLD','#dbe7e1'));
                } 
            } 
            f.data.galeCd-=abilityDt(f,dt); if(f.data.galeCd<=0){ f.data.galeCd=8; spawnWindGale(f,e); } 
        },
        draw: (ctx,f) => { 
            const br=100 + (f.isRage?clamp((f.rageStartHp-f.hp)*10,0,300):0);
            ctx.save();
            ctx.strokeStyle='rgba(230,245,240,.28)';ctx.lineWidth=10;ctx.setLineDash([22,14]);ctx.beginPath();ctx.arc(-(f.x-(f.data.cx||f.x)),-(f.y-(f.data.cy||f.y)),br,0,TAU);ctx.stroke();ctx.setLineDash([]);
            const g=ctx.createRadialGradient(0,0,4,0,0,f.radius+16);g.addColorStop(0,'#ffffff');g.addColorStop(.35,'#dbe7e1');g.addColorStop(1,'#5e716b');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,f.radius,0,TAU);ctx.fill();
            ctx.strokeStyle='#ffffff';ctx.globalAlpha=.82;ctx.lineWidth=6;for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(0,0,28+i*16,Date.now()/420+i,Date.now()/420+i+Math.PI*1.45);ctx.stroke();}ctx.globalAlpha=1;
            ctx.fillStyle='#21322e';ctx.font='900 15px monospace';ctx.textAlign='center';ctx.fillText('EYE',0,5);
            ctx.restore();
        }
    },
    {
        name: "WITCH", color: "#ba67e8", desc: "Curses and magic ray", speed: 440, startDx: 1, startDy: -0.62,
        init: f => { f.data.rayCd=1.2; f.data.curseCd=2.5; },
        update: (f,e,dt) => { f.data.rayCd-=abilityDt(f,dt); if(f.data.rayCd<=0){ f.data.rayCd=2; const end={x:e.x,y:e.y}; projectiles.push({type:'witch_ray',owner:f,x1:f.x,y1:f.y,x2:end.x,y2:end.y,life:.18,maxLife:.18}); if(distToSegment(e.x,e.y,f.x,f.y,end.x,end.y)<=e.radius+18) e.takeDamage(scaledByMirror(f,4),f,'magic-ray'); playFighterSound(f,'skill'); } f.data.curseCd-=abilityDt(f,dt); if(f.data.curseCd<=0){ f.data.curseCd=7; rollWitchCurse(f,e); if(f.isRage) rollWitchCurse(f,e); } },
        draw: (ctx,f) => { drawPolygon(ctx,[[-54,58],[-28,-8],[0,-82],[32,-8],[58,58]],'#24102f','#e49aff',5);drawPolygon(ctx,[[-46,-42],[0,-100],[48,-42],[20,-54],[-18,-54]],'#17071e','#e49aff',4);ctx.strokeStyle='#e49aff';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(44,26);ctx.lineTo(92,-42);ctx.stroke();ctx.fillStyle='#f7e8ff';ctx.beginPath();ctx.arc(96,-48,12,0,TAU);ctx.fill();ctx.fillStyle='#f5d6ff';ctx.font='900 16px serif';ctx.textAlign='center';ctx.fillText('HEX',0,16); }
    },
    {
        name: "PIRATE", color: "#d7a34a", desc: "Anchor rope and loot combo", speed: 455, startDx: 1, startDy: 0.36,
        init: f => { f.data.lootCd=1; f.data.anchorCd=2.5; },
        update: (f,e,dt) => { f.data.lootCd-=abilityDt(f,dt); if(f.data.lootCd<=0){ f.data.lootCd=3; addPirateLoot(f); } f.data.anchorCd-=abilityDt(f,dt); if(f.data.anchorCd<=0){ f.data.anchorCd=7; triggerPirateAnchor(f,e); } },
        draw: (ctx,f) => { drawPolygon(ctx,[[-62,-34],[-20,-62],[50,-44],[60,48],[-48,56]],'#3a1f14','#d7a34a',5);ctx.fillStyle='#14100c';ctx.fillRect(-44,-58,92,18);ctx.fillStyle='#d7a34a';ctx.font='900 18px serif';ctx.textAlign='center';ctx.fillText('Ă¢ËœÂ ',-4,-2);ctx.strokeStyle='#eee1bb';ctx.lineWidth=5;ctx.beginPath();ctx.arc(32,4,18,-.8,.8);ctx.stroke();ctx.strokeStyle='#8a6230';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-22,32);ctx.lineTo(-82,62);ctx.stroke();ctx.font='900 20px serif';ctx.fillText('Ă¢Ââ€œ',-88,68); }
    },
    {
        name: "PAINTER", color: "#f7d64a", desc: "Terrain paint strokes", speed: 470, startDx: 1, startDy: -0.4,
        init: f => { f.data.colorIndex=0; f.data.colorTimer=2; f.data.paintTimer=0; f.data.paintDrop=0; f.data.blobCd=1.2; },
        update: (f,e,dt) => { 
            f.data.colorTimer-=dt; if(f.data.colorTimer<=0){f.data.colorTimer=2;f.data.colorIndex=(f.data.colorIndex+1)%3;} 
            f.data.blobCd -= abilityDt(f,dt); if(e && f.data.blobCd<=0){ f.data.blobCd=3.2; spawnPainterBlob(f,e); }
            if(f.data.paintTimer>0){ 
                f.data.paintTimer-=dt; f.data.paintDrop-=dt; f.applyStatus('immune',.12,{source:f}); 
                if(f.data.paintDrop<=0){ 
                    f.data.paintDrop=.12; const kind=['red','blue','yellow'][f.data.colorIndex]; 
                    spawnPainterInk(f, f.data.lastPaintX ?? f.x, f.data.lastPaintY ?? f.y, kind, f.x, f.y);
                    f.data.lastPaintX=f.x; f.data.lastPaintY=f.y;
                } 
            } 
        },
        onWallBounce: (f,wall) => { f.data.paintTimer=2; f.data.paintDrop=0; f.data.lastPaintX=f.x; f.data.lastPaintY=f.y; floatingTexts.push(new FloatingText(f.x,f.y-f.radius-70,'PAINT STROKE','#fff4a0')); },
        draw: (ctx,f) => { drawPolygon(ctx,[[-62,-45],[38,-62],[64,44],[-42,60]],'#2b2418','#f7d64a',5); const colors=['#ff4040','#50a6ff','#ffd447']; ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(-48,-32,92,34);for(let i=0;i<3;i++){ctx.fillStyle=colors[i];ctx.fillRect(-40+i*30,-24,24,24); if(i===f.data.colorIndex){ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.strokeRect(-40+i*30,-24,24,24);}} ctx.strokeStyle=colors[f.data.colorIndex];ctx.lineWidth=13;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(28,18);ctx.lineTo(94,40);ctx.stroke(); ctx.fillStyle='#fff8d2';ctx.font='900 13px monospace';ctx.textAlign='center';ctx.fillText(['RED','BLUE','GOLD'][f.data.colorIndex],0,36); }
    },
    {
        name: "MONK", color: "#e2a65d", desc: "Four-step combo and trauma rush", speed: 500, startDx: 1, startDy: 0.54,
        init: f => { f.data.combo=0; f.data.comboTimer=0; f.data.hitCd=0; f.data.rushTimer=0; f.data.rushHitCd=0; },
        speedModifier: f => f.data.rushTimer>0 ? 10 : 1,
        update: (f,e,dt) => { f.data.hitCd=Math.max(0,f.data.hitCd-dt); f.data.comboTimer=Math.max(0,f.data.comboTimer-dt); if(f.data.comboTimer<=0) f.data.combo=0; if(f.data.rushTimer>0){ f.data.rushTimer-=dt; f.data.rushHitCd=Math.max(0,f.data.rushHitCd-dt); const target=fighters.find(q=>q.id===f.data.rushTargetId)||e; if(target && f.data.rushAnchor){ target.x=f.data.rushAnchor.x; target.y=f.data.rushAnchor.y; target.data.positionLocked=true; if(dist(f.x,f.y,target.x,target.y)<f.radius+target.radius+26 && f.data.rushHitCd<=0){ addInnerTrauma(target,1); f.data.rushHitCd=.16; }} if(f.data.rushTimer<=0){ f.data.combo=0; if(target&&target.statuses.stun) target.statuses.stun.timer=0; f.data.rushTargetId=null; f.data.rushAnchor=null; } } },
        onCollide: (f,e) => { 
            if(f.data.hitCd>0) return; 
            f.data.hitCd=.45; 
            if(f.data.rushTimer>0){ 
                if(f.data.rushHitCd<=0){ addInnerTrauma(e,1); f.data.rushHitCd=.18; } 
                return; 
            } 
            f.data.combo=(f.data.combo||0)+1; f.data.comboTimer=5; const c=f.data.combo; 
            floatingTexts.push(new FloatingText(f.x,f.y-f.radius-78,`COMBO ${c}`,'#ffd28a')); 
            if(c===1){ e.takeDamage(3,f,'monk-punch'); } 
            else if(c===2){ e.applyStatus('stun',1,{source:f}); e.applyStatus('rapidPunch',1,{source:f,tick:0}); floatingTexts.push(new FloatingText(e.x,e.y-e.radius-88,'RAPID PUNCH','#ffd28a')); } 
            else if(c===3){ e.takeDamage(10,f,'palm-blast'); const n=norm(e.x-f.x,e.y-f.y); e.applyStatus('push',.45,{x:n.x,y:n.y,strength:1600}); } 
            else if(c===4 && f.isRage){ e.applyStatus('stun',.8,{source:f}); f.heal(10,false); floatingTexts.push(new FloatingText(f.x,f.y-f.radius-96,'DIM MAK HEAL','#ffe4aa')); } 
            else if((!f.isRage && c>=4) || (f.isRage && c>=5)){ 
                e.applyStatus('stun',5,{source:f}); f.data.rushTimer=5; f.data.rushTargetId=e.id; f.data.rushAnchor={x:e.x,y:e.y}; f.data.combo=0; 
                const nd=norm((e.x<500?1000:0)-f.x, (e.y<500?1000:0)-f.y); f.setDir(nd.x,nd.y); 
                floatingTexts.push(new FloatingText(e.x,e.y-e.radius-100,'TRAUMA RUSH','#ff9b50'));
            } 
        },
        draw: (ctx,f) => { drawPolygon(ctx,[[-46,-58],[46,-58],[62,40],[0,66],[-62,40]],'#3b2417','#ffd28a',5);ctx.strokeStyle='#ffd28a';ctx.lineWidth=9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-40,-5);ctx.lineTo(-86,-22);ctx.moveTo(40,-5);ctx.lineTo(86,-22);ctx.stroke();if(f.data.rushTimer>0){ctx.globalAlpha=.65;ctx.strokeStyle='#ff9b50';ctx.lineWidth=14;ctx.beginPath();ctx.arc(0,0,f.radius+28,0,TAU);ctx.stroke();ctx.globalAlpha=1;}ctx.fillStyle='#ffd28a';ctx.font='900 18px serif';ctx.textAlign='center';ctx.fillText('Ă¦â€¹Â³',0,8); if(f.data.combo>0){ctx.font='900 22px monospace';ctx.fillText('COMBO '+String(f.data.combo),0,-f.radius-16);} }
    },
    {
        name: "SUPERSTAR", color: "#ff7bd6", desc: "Media invincibility and fan swarm", speed: 455, startDx: 1, startDy: -0.42,
        init: f => { f.data.eventCd=2; f.data.mediaStreak=0; f.data.spotlight=0; },
        update: (f,e,dt) => { f.data.spotlight=Math.max(0,(f.data.spotlight||0)-dt); const fanCount=countSuperFans(f); const cdRate = f.isRage ? (1 + clamp(fanCount*.04,0,.3)) : 1; f.data.eventCd -= abilityDt(f,dt)*cdRate; if(f.data.eventCd<=0){ f.data.eventCd=6; triggerSuperstarEvent(f,e); } },
        draw: (ctx,f) => { drawPolygon(ctx,[[-52,-58],[30,-66],[66,18],[20,64],[-58,44]],'#431b3a','#ff7bd6',5);ctx.fillStyle='#ffe6fb';ctx.font='900 16px sans-serif';ctx.textAlign='center';ctx.fillText('STAR',0,8);ctx.strokeStyle='#fff2a0';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-46,-70);ctx.lineTo(0,-100);ctx.lineTo(46,-70);ctx.stroke(); if(f.data.spotlight>0){ctx.strokeStyle='#fff2a0';ctx.lineWidth=9;ctx.setLineDash([12,10]);ctx.beginPath();ctx.arc(0,0,f.radius+30,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#fff2a0';ctx.font='900 14px monospace';ctx.fillText('LIVE',0,-f.radius-24);} const fans=countSuperFans(f); if(fans>0){ctx.fillStyle='#ffb8ea';ctx.font='900 13px monospace';ctx.fillText('FANS '+fans,0,f.radius+25);} }
    }

];


function newOrbitSat(a) {
    const types = [
        {kind:'freeze', color:'#74d8e8'}, {kind:'burn', color:'#ff7a1f'}, {kind:'bleed', color:'#8d1111'}, {kind:'stun', color:'#e5fbff'}, {kind:'poison', color:'#8dff26'}
    ];
    const t = types[Math.floor(Math.random()*types.length)];
    return { a, hp:2, cd:0, ring:1, kind:t.kind, color:t.color };
}
function applyOrbitEffect(sat, enemy, owner) {
    if (!sat || !enemy) return;
    if (sat.kind === 'freeze') enemy.applyStatus('freeze', .9, { source: owner, dartTotal: 4 });
    else if (sat.kind === 'burn') enemy.applyStatus('burn', 2.4, { source: owner, interval:.8, dmg:.6 });
    else if (sat.kind === 'bleed') enemy.applyStatus('bleed', 3.5, { source: owner });
    else if (sat.kind === 'stun') enemy.applyStatus('stun', .65, { source: owner });
    else if (sat.kind === 'poison') enemy.applyStatus('poison', 2.2, { source: owner, exposure: Math.max(1.5, (enemy.statuses.poison?.exposure || 0) + 1.5) });
}

function typeByName(name) { return FighterTypes.find(t => t.name === name); }
function novaDamage(t) {
    t = clamp(t, 0, 15);
    const pts = [[0,1],[1,1],[2,1.5],[3,2.5],[4,4],[5,8],[6,17],[7,29],[8,46],[9,29],[10,17],[11,8],[12,4],[13,2.5],[14,1.5],[15,1]];
    for (let i=0; i<pts.length-1; i++) {
        const [t0,d0] = pts[i], [t1,d1] = pts[i+1];
        if (t >= t0 && t <= t1) return lerp(d0, d1, smoothstep((t - t0) / (t1 - t0)));
    }
    return 1;
}
function randomRageMath() {
    let v = 0;
    while (v === 0) {
        const sign = Math.random() < 0.5 ? -1 : 1;
        v = sign * Math.max(1, Math.round(Math.pow(Math.random(), 1.75) * 100));
    }
    return v;
}
function makeDeck() {
    const suits = ['Ă¢â„¢Â ','Ă¢â„¢Â¥','Ă¢â„¢Â¦','Ă¢â„¢Â£'];
    const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    const deck = [];
    for (const suit of suits) for (const rank of ranks) deck.push({rank, suit});
    for (let i=deck.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]]; }
    return deck;
}
function cardIsFace(c) { return c && ['J','Q','K'].includes(c.rank); }
function cardCaoPoint(c) { if (!c) return 0; if (c.rank === 'A') return 1; if (['10','J','Q','K'].includes(c.rank)) return 0; return Number(c.rank); }
function cardRagePoint(c) { if (!c) return 0; if (c.rank === 'A') return 1; if (['J','Q','K','10'].includes(c.rank)) return 10; return Number(c.rank); }
function cardCaoDamage(hand) { if (hand.length === 3 && hand.every(cardIsFace)) return 10; return hand.reduce((sum,c)=>sum+cardCaoPoint(c),0) % 10; }
function cardRageDamage(hand) { return Math.min(30, hand.reduce((sum,c)=>sum+cardRagePoint(c),0)); }
function drawPlayingCard(ctx, c, x, y, scale = 1, rot = 0) {
    if (!c) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = c.rank === 'J' ? '#ffd4b0' : c.rank === 'Q' ? '#d9fbff' : c.rank === 'K' ? '#ffd0d0' : '#fff4dc';
    ctx.strokeStyle = '#1b120b';
    ctx.lineWidth = 3;
    ctx.fillRect(-28, -42, 56, 84);
    ctx.strokeRect(-28, -42, 56, 84);
    ctx.shadowBlur = 0;
    const red = c.suit === 'Ă¢â„¢Â¥' || c.suit === 'Ă¢â„¢Â¦';
    ctx.fillStyle = red ? '#9e1515' : '#111111';
    ctx.font = '900 18px serif';
    ctx.textAlign = 'left';
    ctx.fillText(c.rank, -18, -17);
    ctx.fillText(c.suit, -18, 0);
    ctx.font = '900 32px serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.suit, 0, 13); if(['J','Q','K'].includes(c.rank)){ctx.font='900 13px serif';ctx.fillText(c.rank==='J'?'BURN':c.rank==='Q'?'FREEZE':'WEAK',0,31);} 
    ctx.save();
    ctx.rotate(Math.PI);
    ctx.font = '900 18px serif';
    ctx.textAlign = 'left';
    ctx.fillText(c.rank, -18, -17);
    ctx.fillText(c.suit, -18, 0);
    ctx.restore();
    ctx.restore();
}
function randomCard(){ const suits=['Ă¢â„¢Â ','Ă¢â„¢Â¥','Ă¢â„¢Â¦','Ă¢â„¢Â£']; const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K']; return {suit:suits[Math.floor(Math.random()*suits.length)], rank:ranks[Math.floor(Math.random()*ranks.length)]}; }
function makeRageMathExpression() {
    const result = randomRageMath();
    const a = Math.floor(rand(6, 23));
    const b = Math.floor(rand(3, 17));
    const c = Math.floor(rand(4, 20));
    const d = Math.floor(rand(2, 13));
    const r = Math.floor(rand(2, 10));
    const base = a * b - c * d + r;
    const adjust = result - base;
    const adj = adjust >= 0 ? `+${adjust}` : `${adjust}`;
    return { result, formula: `Ă¢Å’Â(((${a}Ä‚â€”${b})Ă¢Ë†â€™(${c}Ä‚â€”${d}))+Ă¢Ë†Â${r*r}${adj})Ä‚Â·1Ă¢Å’â€¹` };
}

function makeMathV2Function() {
    const options = [
        {label:'f(x)=sin(2Ăâ‚¬x)/2 + xĂ‚Â²/3', fn:x=>Math.sin(2*Math.PI*x)*0.5 + x*x/3},
        {label:'f(x)=0.7sin(3Ăâ‚¬x)+0.2cos(5Ăâ‚¬x)', fn:x=>0.7*Math.sin(3*Math.PI*x)+0.2*Math.cos(5*Math.PI*x)},
        {label:'f(x)=xĂ‚Â³Ă¢Ë†â€™0.65x', fn:x=>x*x*x-0.65*x},
        {label:'f(x)=0.8cos(Ăâ‚¬x)sin(2Ăâ‚¬x)', fn:x=>0.8*Math.cos(Math.PI*x)*Math.sin(2*Math.PI*x)},
        {label:'f(x)=0.45tan(1.05x)', fn:x=>0.45*Math.tan(1.05*x)},
        {label:'f(x)=0.55sin(Ăâ‚¬/x*)', fn:x=>x===0?0:0.55*Math.sin(Math.PI/(Math.abs(x)+0.25))}
    ];
    return options[Math.floor(Math.random()*options.length)];
}
function graphPointsFromFn(fn) {
    const pts=[];
    for(let i=0;i<=96;i++){
        const x=-1+2*i/96;
        let y=clamp(fn(x),-1,1);
        pts.push({x:500+x*450,y:500-y*450,nx:x,ny:y});
    }
    return pts;
}
function spawnMathV2Graph(owner, formula, kindOrFn) {
    const opt = typeof kindOrFn === 'function' ? {label:formula, fn:kindOrFn} : (typeof kindOrFn === 'string' ? {label:formula, fn:(x)=>Math.sin(Math.PI*x)} : makeMathV2Function());
    const pts=graphPointsFromFn(opt.fn);
    projectiles.push({type:'math_v2_graph',owner,x:500,y:500,points:pts,formula:opt.label,life:4.5,maxLife:4.5,hitCd:{},touchCount:{},collapseDone:{},thick:18});
    floatingTexts.push(new FloatingText(500, 105, opt.label, '#9ad7ff'));
    playFighterSound(owner,'skill');
}
function distToGraphPoints(px,py,pts){ let best=Infinity; for(let i=1;i<pts.length;i++){ const a=pts[i-1], b=pts[i]; best=Math.min(best, distToSegment(px,py,a.x,a.y,b.x,b.y)); } return best; }

function runProjectileHit(p, target, amount, label) { target.takeDamage(amount, p.owner, label); }
function checkCrystalDiamond(owner) {
    const walls = projectiles.filter(p => p.type === 'crystal_wall' && p.owner === owner && p.permanent);
    if (walls.length >= 6) {
        const selected = walls.slice(0,6);
        projectiles = projectiles.filter(p => !selected.includes(p));
        const enemy = fighters.find(f => f.id !== owner.id);
        const cx = enemy ? enemy.x : GAME_SIZE/2, cy = enemy ? enemy.y : GAME_SIZE/2;
        const radius = 220;
        const d = norm(rand(-1,1), rand(-1,1));
        projectiles.push({ type: 'crystal_cage', owner, prisonerId: enemy ? enemy.id : null, sides:6, x: cx, y: cy, cageRadius: radius, diamondX: cx, diamondY: cy, vx: d.x * owner.baseSpeed * 5.8, vy: d.y * owner.baseSpeed * 5.8, diamondRadius: 30, life: 5, maxLife: 5, hitCd: 0, hitIds: {}, forming: .55, sourceWalls: selected.map(w=>({x1:w.x1,y1:w.y1,x2:w.x2,y2:w.y2})) });
        floatingTexts.push(new FloatingText(cx, cy - radius - 35, 'HEX PRISON', '#bffcff'));
        playFighterSound(owner, 'skill');
    }
}
function spawnVirusChildren(owner, count, level, x, y) {
    for (let i=0; i<count; i++) {
        const a = Math.random() * TAU, spread = level === 1 ? rand(20,55) : rand(30,80);
        projectiles.push({ type:'virus_minion', owner, level, x:x+Math.cos(a)*spread, y:y+Math.sin(a)*spread, dir:norm(Math.cos(a),Math.sin(a)), radius: level===1?7:level===2?22:38, hp: level===1?1:level===2?12:30, mergeTimer:4, spawnCd:4, life:Infinity, maxLife:Infinity, hitCd:{} });
    }
}
function mergeVirusMinions(owner, enemy) {
    const groups = {};
    for (const v of projectiles) if (v.type === 'virus_minion' && v.owner === owner) { const key = String(v.level); (groups[key] ||= []).push(v); }
    for (const level of [1,2]) {
        const ready = (groups[String(level)] || []).filter(v => v.mergeTimer <= 0);
        if (ready.length >= 3) {
            const selected = ready.slice(0,3);
            const x = selected.reduce((s,v)=>s+v.x,0)/3, y = selected.reduce((s,v)=>s+v.y,0)/3;
            projectiles = projectiles.filter(p => !selected.includes(p));
            if (level === 2) {
                spawnVirusChildren(owner, 1, 3, x, y);
                const lost = Math.max(0, owner.maxHp - owner.hp);
                owner.heal(lost * 0.5, true);
                const parasiteSum = enemy && enemy.virusParasites ? enemy.virusParasites.reduce((sum,v)=>sum+(v.level||1),0) : 3;
                if (enemy) enemy.takeDamage(scaledByMirror(owner, Math.max(3, parasiteSum)), owner, 'virus-outbreak');
                owner.data.superFlash = 1.3;
                floatingTexts.push(new FloatingText(owner.x, owner.y-owner.radius-78, 'OUTBREAK HEAL', '#b9ff55'));
                emitParticles(owner.x, owner.y, '#b9ff55', 80, 620, 7, 1.2, 'square');
                playFighterSound(owner, 'death');
            } else {
                spawnVirusChildren(owner, 1, level + 1, x, y);
                playFighterSound(owner, 'skill');
            }
            return;
        }
    }
}
function lineNormal(x1,y1,x2,y2, px, py) {
    const wx = x2 - x1, wy = y2 - y1;
    const n1 = norm(-wy, wx), n2 = norm(wy, -wx);
    const midx = (x1+x2)/2, midy=(y1+y2)/2;
    const to = norm(px-midx, py-midy);
    return dot(n1.x,n1.y,to.x,to.y) > dot(n2.x,n2.y,to.x,to.y) ? n1 : n2;
}
function reflectProjectileFromCrystals(p) {
    if (p.type === 'crystal_wall' || p.type === 'gravity_well' || p.type === 'magnet_field' || p.type === 'meteor') return false;
    if (p.vx === undefined || p.vy === undefined || p.x === undefined || p.y === undefined) return false;
    for (const w of projectiles) {
        if (w.type !== 'crystal_wall' || w.owner === p.owner) continue;
        const r = p.radius || Math.max(8, (p.halfWidth || 0) * 0.15);
        if (distToSegment(p.x,p.y,w.x1,w.y1,w.x2,w.y2) <= r + 16) {
            const n = lineNormal(w.x1,w.y1,w.x2,w.y2,p.x,p.y);
            const v = reflectDir(norm(p.vx,p.vy), n.x, n.y);
            const sp = Math.hypot(p.vx,p.vy) || 900;
            p.vx = v.x * sp; p.vy = v.y * sp;
            p.owner = w.owner;
            emitParticles(p.x,p.y,w.owner.color,14,260,4,.42,'square');
            playFighterSound(w.owner,'wall');
            return true;
        }
    }
    return false;
}
function distToBladeWave(p, target) {
    const dir = norm(p.vx, p.vy);
    const backX = p.x - dir.x * p.length, backY = p.y - dir.y * p.length;
    const forward = dot(target.x - backX, target.y - backY, dir.x, dir.y);
    if (forward < 0 || forward > p.length + target.radius) return Infinity;
    return distToSegment(target.x,target.y,backX,backY,p.x,p.y);
}
function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        let owner = p.owner;
        let enemy = fighters.find(f => owner && f.id !== owner.id) || fighters[0];
        if (p.life !== Infinity) p.life -= dt;
        if (p.x !== undefined && p.y !== undefined && p.vx !== undefined && p.vy !== undefined && reflectProjectileFromCrystals(p)) {
            owner = p.owner;
            enemy = fighters.find(f => owner && f.id !== owner.id) || fighters[0];
        }

        if (p.x !== undefined && p.y !== undefined && p.vx !== undefined && p.vy !== undefined) {
            for (const mf of fighters) {
                if (mf && mf.name === 'MAGNET' && mf.data.fieldTimer > 0 && p.owner !== mf && !['meteor','gravity_well','ice_lane','fire_pit','magnet_field','crystal_cage','drum_wave'].includes(p.type)) {
                    const shell = 310;
                    const md = dist(p.x,p.y,mf.x,mf.y);
                    if (md <= shell + (p.radius||10)) { const n=norm(p.x-mf.x,p.y-mf.y); p.x=mf.x+n.x*(shell+(p.radius||10)+8); p.y=mf.y+n.y*(shell+(p.radius||10)+8); p.life = 0; emitParticles(p.x,p.y,mf.color,18,280,4,.45,'square'); floatingTexts.push(new FloatingText(mf.x,mf.y-mf.radius-84,'MAGNETIC SHELL','#ffe44e')); }
                }
            }
        }
        if (p.type === 'slime_child' && (p.life <= 0 || p.hp <= 0)) { resolveSlimeChild(p); projectiles.splice(i, 1); continue; }
        const expirySensitive = ['gravity_well','ice_lane','meteor'].includes(p.type);
        if (p.life <= 0 && !expirySensitive) { projectiles.splice(i, 1); continue; }

        if (p.type === 'mirror_zone') {
            updateMirrorZones(p);
        }

        if (p.type === 'drum_wave') {
            const progress = 1 - p.life / p.maxLife;
            const prevR = p.radius || 0;
            p.radius = lerp(8, p.maxRadius || Math.hypot(GAME_SIZE,GAME_SIZE), smoothstep(progress));
            p.hitIds ||= {};
            if (enemy && !p.hitIds[enemy.id]) {
                const d = dist(enemy.x, enemy.y, p.x, p.y);
                if (d <= p.radius + enemy.radius && d >= prevR - enemy.radius - 18) {
                    const ratio = clamp(1 - d / Math.max(1, p.maxRadius || Math.hypot(GAME_SIZE,GAME_SIZE)), 0, 1);
                    const dmg = lerp(p.minDmg || 1, p.maxDmg || 10, ratio);
                    enemy.takeDamage(scaledByMirror(owner, dmg), owner, 'drum-wave');
                    p.hitIds[enemy.id] = true;
                    spawnShockwave(p.x, p.y, '#ffcf7a', Math.min(p.radius + 30, 500));
                }
            }
        }
        if (p.type === 'math_v2_grid') {}
        if (p.type === 'math_v2_graph') {
            p.hitCd[enemy.id] = Math.max(0, (p.hitCd[enemy.id] || 0) - dt);
            if (enemy && p.hitCd[enemy.id] <= 0 && distToGraphPoints(enemy.x, enemy.y, p.points || []) <= enemy.radius + (p.thick || 18)) {
                enemy.takeDamage(1.8, owner, 'graph-wall');
                p.touchCount[enemy.id] = (p.touchCount[enemy.id] || 0) + 1;
                if(p.touchCount[enemy.id] >= 4 && !p.collapseDone[enemy.id]){ p.collapseDone[enemy.id]=true; enemy.takeDamage(5, owner, 'function-collapse'); floatingTexts.push(new FloatingText(enemy.x, enemy.y-enemy.radius-70, 'FUNCTION COLLAPSE', '#9ad7ff')); spawnShockwave(enemy.x, enemy.y, '#8fcfff', 135); }
                p.hitCd[enemy.id] = 0.55;
            }
            for (const q of projectiles) {
                if (q === p || !q.owner || q.owner === owner || q.x === undefined || q.y === undefined || q.vx === undefined || q.vy === undefined) continue;
                if (['meteor','gravity_well','ice_lane','toxic_puddle','toxic_trail','fire_pit','crystal_wall','crystal_cage','math_v2_graph','math_v2_grid'].includes(q.type)) continue;
                if (distToGraphPoints(q.x, q.y, p.points || []) <= (p.thick || 18) + (q.radius || 10)) { p.energy = (p.energy ?? 7) - 1; q.life = 0; emitParticles(q.x,q.y,'#8fcfff',14,260,4,.4,'square'); if(p.energy<=0){p.life=Math.min(p.life,.45); floatingTexts.push(new FloatingText(500,125,'GRAPH SATURATED','#9ad7ff'));} }
            }
        }

        if (p.type === 'flash_super') {
            p.tick += dt;
            const target = fighters.find(f=>f.id===p.enemyId);
            if (target) {
                target.applyStatus('stun', .18, { flashSuper:true });
                while (p.tick >= .12) {
                    p.tick -= .12;
                    p.pass++;
                    for (const line of p.lines || []) {
                        if (flashDistanceToLine(target, line) <= target.radius + 26) target.takeDamage(3, owner, 'flash-super');
                    }
                }
            }
        }
        if (p.type === 'ice_dart') {
            const target = fighters.find(f=>f.id===p.targetId);
            if (!target || target.hp <= 0) { p.life = 0; }
            else if (p.phase === 'stage') {
                if (!Number.isFinite(p.stageTargetX) || !Number.isFinite(p.stageTargetY)) {
                    const sourceAngle = p.owner ? Math.atan2(p.owner.y-target.y, p.owner.x-target.x) : -Math.PI/2;
                    const span = TAU / 3;
                    const t = p.slotCount > 1 ? p.slot / (p.slotCount - 1) : .5;
                    const angle = sourceAngle - span / 2 + span * t;
                    const arcRadius = target.radius + 142;
                    p.stageTargetX = clamp(target.x + Math.cos(angle) * arcRadius, 24, GAME_SIZE - 24);
                    p.stageTargetY = clamp(target.y + Math.sin(angle) * arcRadius, 24, GAME_SIZE - 24);
                    p.stageAngle = angle + Math.PI;
                }
                const tx = p.stageTargetX;
                const ty = p.stageTargetY;
                p.stageBlend = Math.min(1, (p.stageBlend || 0) + dt * 3.6);
                const settle = smoothstep(p.stageBlend);
                p.x = lerp(p.x, tx, settle);
                p.y = lerp(p.y, ty, settle);
                p.vx = undefined; p.vy = undefined;
            } else {
                p.flightTime = Math.max(.001, (p.flightTime || .12) - dt);
                const n = norm(target.x-p.x, target.y-p.y);
                const speed = Math.max(1250, dist(p.x,p.y,target.x,target.y) / p.flightTime);
                p.vx=n.x*speed; p.vy=n.y*speed; p.x += p.vx*dt; p.y += p.vy*dt;
                if(dist(p.x,p.y,target.x,target.y)<target.radius+16 || p.flightTime <= .001) {
                    target.takeDamage(p.damage || 0, p.owner || null, 'ice-darts', true);
                    emitParticles(target.x,target.y,'#d8ffff',8,180,3,.28,'square');
                    p.life=0;
                }
            }
        }
        if (p.type === 'red_slash') {}
        if (p.type === 'ice_lane') {
            const foe = enemy;
            if (owner && distToSegment(owner.x, owner.y, p.x1,p.y1,p.x2,p.y2) <= p.halfWidth) owner.applyStatus('speed', 2, { mult: 1.5 });
            if (foe && distToSegment(foe.x, foe.y, p.x1,p.y1,p.x2,p.y2) <= p.halfWidth + foe.radius * 0.3) {
                foe.applyStatus('slow', 2, { mult: 0.3 });
                p.enemyInside += dt; p.dmgTick += dt;
                while (p.dmgTick >= 1) { p.dmgTick -= 1; foe.takeDamage(foe.hasStatus('freeze') ? 2.8 : 1.4, owner, 'ice-field'); }
                if (p.enemyInside >= 3.25) { { const bonus=foe.hasStatus('frostMark')?1.25:1; foe.applyStatus('freeze', 1.8, { source: owner, dartTotal: rand(10,16)*bonus }); foe.applyStatus('frostMark',7); p.enemyInside = 0; } }
            } else p.enemyInside = Math.max(0, p.enemyInside - dt * 1.5);
            if (p.life <= 0 && owner) { owner.data.laneActive = false; owner.data.cd = 7.6; }
        }
        if (p.type === 'meteor') {
            if (!p.hit && p.life <= 0.25) { p.hit = true; if (enemy) { const md = dist(enemy.x,enemy.y,p.x,p.y); if (md <= p.radius + enemy.radius) { enemy.takeDamage(9.4, owner, 'meteor'); enemy.applyStatus('burn', 4, { source: owner, interval: 0.8, dmg: 1.5 }); } else if (md <= 112 + enemy.radius) enemy.takeDamage(3.2, owner, 'meteor-shock'); } emitParticles(p.x,p.y,'#ff7a1f',35,450,8,.75); spawnShockwave(p.x,p.y,'#ff7a1f',150); projectiles.push({type:'fire_pit',owner,x:p.x,y:p.y,radius:owner&&owner.isRage?92:50,life:owner&&owner.isRage?10:3.8,maxLife:owner&&owner.isRage?10:3.8}); }
        }
        if (p.type === 'fire_pit') {
            if (enemy && dist(enemy.x,enemy.y,p.x,p.y) <= p.radius + enemy.radius*.3 && !enemy.hasStatus('burn')) { enemy.applyStatus('burn',1.8,{source:owner,interval:.8,dmg:owner&&owner.isRage?1.9:1.42}); if(owner&&owner.isRage) enemy.applyStatus('slow',.8,{mult:.82}); }
        }
        if (p.type === 'magnet_field') {
            p.x=owner.x; p.y=owner.y;
            p.slamCd = Math.max(0,(p.slamCd||0)-dt);
            const d=dist(enemy.x,enemy.y,p.x,p.y);
            if(d<=p.radius+enemy.radius){ const n=norm(enemy.x-p.x,enemy.y-p.y); let sx=n.x, sy=n.y; if(owner.isRage){ const pole={x:clamp(enemy.x-owner.dir.x*180,120,880),y:clamp(enemy.y-owner.dir.y*180,120,880)}; const a=norm(pole.x-enemy.x,pole.y-enemy.y); sx=norm(n.x+a.x*.8,n.y+a.y*.8).x; sy=norm(n.x+a.x*.8,n.y+a.y*.8).y; } enemy.applyStatus('push',.24,{x:sx,y:sy,strength:owner.isRage?1450:1250}); p.hitCd[enemy.id]=(p.hitCd[enemy.id]||0)-dt; if(p.hitCd[enemy.id]<=0){ enemy.takeDamage(2.6,owner,'magnetic-field'); p.hitCd[enemy.id]=.25; } if(p.slamCd<=0&&(enemy.x<=enemy.radius+4||enemy.x>=GAME_SIZE-enemy.radius-4||enemy.y<=enemy.radius+4||enemy.y>=GAME_SIZE-enemy.radius-4)){ enemy.takeDamage(owner.isRage?6:4.5,owner,'magnetic-slam'); p.slamCd=.7; } }
            else if (enemy) p.hitCd[enemy.id] = 0;
        }
        if (p.type === 'web_line') {
            if (owner) { p.x2 = owner.x; p.y2 = owner.y; }
            if (enemy) {
                p.hitCd[enemy.id] = Math.max(0, (p.hitCd[enemy.id] || 0) - dt);
                const near = distToSegment(enemy.x, enemy.y, p.x1,p.y1,p.x2,p.y2) <= enemy.radius + 10;
                if (near && p.hitCd[enemy.id] <= 0) { enemy.takeDamage(0.75, owner, 'web'); p.hitCd[enemy.id] = owner && owner.isRage ? 0.5 : 0.68; enemy.data.webCuts = (enemy.data.webCuts || []).filter(t => performance.now()/1000 - t < 2); enemy.data.webCuts.push(performance.now()/1000); if(enemy.data.webCuts.length>=3){ const n=norm(owner.x-enemy.x,owner.y-enemy.y); enemy.applyStatus('slow',1.35,{mult:.52}); enemy.applyStatus('push',.18,{x:n.x,y:n.y,strength:540}); enemy.data.webCuts=[]; floatingTexts.push(new FloatingText(enemy.x,enemy.y-enemy.radius-58,'THREAD CUT','#d9ccff')); } playFighterSound(owner,'skill'); }
            }
        }
        if (p.type === 'toxic_trail' || p.type === 'toxic_puddle') {
            for (const target of fighters) if (dist(target.x,target.y,p.x,p.y) <= p.radius + target.radius*.28) target.applyStatus('poison', 2, { source: owner, selfSafe: target === owner });
        }
        if (p.type === 'toxic_shot') {
            const target = enemy;
            if (target) {
                const n = norm(target.x - p.x, target.y - p.y);
                p.vx = n.x * 1120; p.vy = n.y * 1120;
                p.x += p.vx*dt; p.y += p.vy*dt;
                if (dist(target.x,target.y,p.x,p.y) <= target.radius + p.radius + 8) {
                    target.takeDamage(3,owner,'toxic-spit');
                    target.applyStatus('poison',3.2,{source:owner, exposure:10, forceBreak:true});
                    target.applyStatus('slow',2,{mult:.4});
                    p.life=0;
                }
            }
        }
        if (p.type === 'gravity_well') {
            if (enemy) {
                const dx=p.x-enemy.x, dy=p.y-enemy.y;
                const d=Math.max(90,Math.hypot(dx,dy));
                const n=norm(dx,dy);
                const pullSpeed = clamp(18000000 / (d*d), 25, 850);
                enemy.data.positionLocked = true;
                enemy.x = clamp(enemy.x + n.x * pullSpeed * dt, enemy.radius, GAME_SIZE - enemy.radius);
                enemy.y = clamp(enemy.y + n.y * pullSpeed * dt, enemy.radius, GAME_SIZE - enemy.radius);
                enemy.setDir(n.x, n.y);
            }
            if (owner && owner.isRage) {
                for (const q of projectiles) {
                    if (q === p || !q.owner || q.owner === owner || q.x === undefined || q.y === undefined || q.vx === undefined || q.vy === undefined) continue;
                    if (['meteor','ice_lane','toxic_puddle','toxic_trail','fire_pit','gravity_well','crystal_cage','crystal_wall'].includes(q.type)) continue;
                    const d = Math.max(35, dist(q.x,q.y,p.x,p.y)); const n = norm(p.x-q.x,p.y-q.y);
                    q.vx += n.x * clamp(360000/(d*d),90,880) * dt; q.vy += n.y * clamp(360000/(d*d),90,880) * dt;
                    if (d < p.core + (q.radius||10)) { p.absorbed=(p.absorbed||0)+1; q.life=0; emitParticles(p.x,p.y,'#22102e',18,220,5,.45,'square'); playFighterSound(owner,'skill'); }
                }
            }
            if (p.life <= 0 && !p.exploded) { 
                p.exploded=true; 
                if(enemy){
                    const d=dist(enemy.x,enemy.y,p.x,p.y);
                    let dmg = d<=200 ? lerp(20,5,clamp(d/200,0,1)) : 0;
                    if (p.absorbedDamage && p.absorbedDamage > 0) dmg += p.absorbedDamage * 2;
                    if (dmg > 0) enemy.takeDamage(dmg,owner,(p.absorbedDamage||0)>0?'black-hole-reflect':'black-hole-explosion');
                } 
                spawnShockwave(p.x,p.y,'#201020',280 + (p.absorbed||0)*8); triggerFlash(0,0,0,.45); 
            }
        }
        if (p.type === 'blade_wave') {
            p.x += p.vx*dt; p.y += p.vy*dt; reflectProjectileFromCrystals(p);
            let bounced=false; const pad=24;
            if(p.x<pad||p.x>GAME_SIZE-pad){p.vx*=-1;bounced=true;} if(p.y<pad||p.y>GAME_SIZE-pad){p.vy*=-1;bounced=true;}
            if(bounced){p.bounces--;p.x=clamp(p.x,pad,GAME_SIZE-pad);p.y=clamp(p.y,pad,GAME_SIZE-pad);if(p.bounces<0)p.life=0;}
            if(enemy && distToBladeWave(p,enemy) <= p.halfWidth + enemy.radius*.2 && !p.hit){enemy.takeDamage(p.dmg,owner,'blade-wave'); const prev=enemy.hasStatus('bladeWindow')?(enemy.statuses.bladeWindow.count||0):0; enemy.applyStatus('bladeWindow',.10,{count:prev+1}); if(prev+1>=2){redSlash(enemy,owner); enemy.statuses.bladeWindow.count=0;} p.hit=true;p.life=0;}
        }
        if (p.type === 'crystal_wall') {
            for (const target of fighters) {
                if (target === owner) continue;
                p.touchCd[target.id] = Math.max(0, (p.touchCd[target.id] || 0) - dt);
                if (distToSegment(target.x,target.y,p.x1,p.y1,p.x2,p.y2) <= target.radius + 8) {
                    const n=lineNormal(p.x1,p.y1,p.x2,p.y2,target.x,target.y);
                    target.x += n.x * 7; target.y += n.y * 7;
                    const rdir = reflectDir(target.dir,n.x,n.y); target.setDir(rdir.x,rdir.y);
                    if (target.name === 'FLASH' && target.data.dashTimer > 0) continue;
                    if (!p.hitIds[target.id]) { target.takeDamage(3,owner,'crystal-wall'); p.hitIds[target.id]=true; }
                    if (p.touchCd[target.id] <= 0) { target.applyStatus('push',.10,{x:n.x,y:n.y,strength:520}); p.touchCd[target.id]=.18; }
                }
            }
        }
        if (p.type === 'crystal_cage') {
            p.hitCd=Math.max(0,p.hitCd-dt);
            p.diamondX += p.vx*dt; p.diamondY += p.vy*dt;
            const dd = dist(p.diamondX,p.diamondY,p.x,p.y);
            if (dd > p.cageRadius - p.diamondRadius) {
                const n = norm(p.diamondX-p.x,p.diamondY-p.y);
                p.diamondX = p.x + n.x*(p.cageRadius-p.diamondRadius);
                p.diamondY = p.y + n.y*(p.cageRadius-p.diamondRadius);
                const r = reflectDir(norm(p.vx,p.vy), n.x, n.y); const sp=Math.hypot(p.vx,p.vy)||owner.baseSpeed*5; p.vx=r.x*sp; p.vy=r.y*sp;
            }
            const prisoner = fighters.find(f=>f.id===p.prisonerId);
            if (prisoner) {
                const pd = dist(prisoner.x,prisoner.y,p.x,p.y);
                if (pd > p.cageRadius - prisoner.radius) {
                    const n = norm(prisoner.x-p.x,prisoner.y-p.y);
                    prisoner.x = p.x + n.x*(p.cageRadius-prisoner.radius);
                    prisoner.y = p.y + n.y*(p.cageRadius-prisoner.radius);
                    const rdir = reflectDir(prisoner.dir,n.x,n.y); prisoner.setDir(rdir.x,rdir.y);
                }
                if(p.hitCd<=0&&dist(prisoner.x,prisoner.y,p.diamondX,p.diamondY)<=prisoner.radius+p.diamondRadius){prisoner.takeDamage(3,owner,'diamond-prison');const n=norm(p.vx,p.vy);prisoner.setDir(n.x,n.y);p.hitCd=.16;}
            }
        }
        if (p.type === 'virus_minion') {

            for (const mf of fighters) {
                if (mf && mf.name === 'MAGNET' && mf.data.fieldTimer > 0 && p.owner !== mf) {
                    const shell = 310, md = dist(p.x,p.y,mf.x,mf.y);
                    if (md < shell + p.radius) { const n=norm(p.x-mf.x,p.y-mf.y); p.x = mf.x + n.x*(shell+p.radius+8); p.y = mf.y + n.y*(shell+p.radius+8); p.dir = norm(n.x*1.4 + (p.dir?.x||0)*.2, n.y*1.4 + (p.dir?.y||0)*.2); }
                }
            }
            for (const w of projectiles) { if(w.type==='crystal_wall' && w.owner!==p.owner && distToSegment(p.x,p.y,w.x1,w.y1,w.x2,w.y2) <= (p.radius||8)+18){ const n=lineNormal(w.x1,w.y1,w.x2,w.y2,p.x,p.y); p.dir = norm(n.x,n.y); p.owner = w.owner; p.x += n.x*20; p.y += n.y*20; emitParticles(p.x,p.y,w.owner.color,12,240,4,.35,'square'); } }
            p.mergeTimer -= dt;
            if(enemy && dist(enemy.x,enemy.y,p.x,p.y)<300){ const chase=norm(enemy.x-p.x,enemy.y-p.y); p.dir=norm(p.dir.x*.72+chase.x*.28,p.dir.y*.72+chase.y*.28); }
            p.x += p.dir.x * (p.level===1?105:p.level===2?72:52) * dt;
            p.y += p.dir.y * (p.level===1?105:p.level===2?72:52) * dt;
            if (p.x < p.radius || p.x > GAME_SIZE-p.radius) p.dir.x *= -1;
            if (p.y < p.radius || p.y > GAME_SIZE-p.radius) p.dir.y *= -1;
            p.x = clamp(p.x,p.radius,GAME_SIZE-p.radius); p.y = clamp(p.y,p.radius,GAME_SIZE-p.radius);
            if (p.level >= 2) { p.spawnCd -= dt; if (p.spawnCd <= 0) { p.spawnCd = 6; spawnVirusChildren(owner, 3, 1, p.x, p.y); } }
            if (enemy && dist(enemy.x,enemy.y,p.x,p.y) <= enemy.radius + p.radius) {
                const virusDmg = p.level === 1 ? 0.8 : p.level === 2 ? 2.4 : 4.5;
                enemy.takeDamage(scaledByMirror(owner, virusDmg), owner, 'virus-contact');
                addVirusParasite(enemy, owner, p.level);
                floatingTexts.push(new FloatingText(enemy.x, enemy.y - enemy.radius - 45, `EXPOSED L${p.level}`, '#b9ff55'));
                p.hp -= p.level === 1 ? 99 : 5;
                p.mergeTimer = 6;
                playFighterSound(owner, 'skill');
                if (p.hp <= 0) p.life = 0;
            }
        }

        if (p.type === 'slime_child') {
            const owner = p.owner; if(!owner){ p.life=0; continue; }
            p.angle += dt * 4.2;
            p.x = owner.x + Math.cos(p.angle) * (owner.radius + 40);
            p.y = owner.y + Math.sin(p.angle) * (owner.radius + 40);
            for (const q of projectiles) {
                if(q===p || !q.owner || q.owner===owner || q.x===undefined || q.y===undefined || q.vx===undefined || q.vy===undefined) continue;
                if(['meteor','gravity_well','ice_lane','fire_pit','toxic_puddle','toxic_trail','crystal_wall','crystal_cage','math_v2_graph','math_v2_grid'].includes(q.type)) continue;
                if(dist(q.x,q.y,p.x,p.y)<(q.radius||10)+p.radius){ q.life=0; p.hp-=1; emitParticles(p.x,p.y,owner.color,10,220,4,.35,'square'); }
            }
            if(enemy){ const pull=norm(enemy.x-p.x, enemy.y-p.y); p.x += pull.x*70*dt; p.y += pull.y*70*dt; p.hitCd[enemy.id]=Math.max(0,(p.hitCd[enemy.id]||0)-dt); if(dist(enemy.x,enemy.y,p.x,p.y)<enemy.radius+p.radius+18 && p.hitCd[enemy.id]<=0){ const sd=p.damage||2.6; enemy.takeDamage(sd,owner,'slime-child'); enemy.applyStatus('slow',1,{mult:.65}); p.damageDone=(p.damageDone||0)+sd; p.hitCd[enemy.id]=.55; } }
            if(p.life<=0 || p.hp<=0){ p.life=0; }
        }
        if (p.type === 'time_rift') {
            if(enemy && !p.hit && dist(enemy.x,enemy.y,p.x,p.y)<enemy.radius+p.radius){ p.hit=true; enemy.takeDamage(p.storedDamage,owner,'time-rift'); p.life=0; spawnShockwave(p.x,p.y,'#d6d0ff',180); }
        }
        if (p.type === 'wind_gale') {
            p.tick=(p.tick||0)+dt;
            if(enemy && distToSegment(enemy.x,enemy.y,p.x1,p.y1,p.x2,p.y2)<p.width+enemy.radius*.2){ enemy.applyStatus('push',.20,{x:p.nx,y:p.ny,strength:690}); while(p.tick>=.1){p.tick-=.1; enemy.takeDamage(.4,owner,'gale-line',true);} }
            for(const q of projectiles){ if(q===p || !q.owner || q.owner===owner || q.x===undefined || q.y===undefined || q.vx===undefined || q.vy===undefined) continue; if(['meteor','gravity_well','ice_lane','fire_pit','toxic_puddle','toxic_trail','crystal_wall','crystal_cage'].includes(q.type)) continue; if(distToSegment(q.x,q.y,p.x1,p.y1,p.x2,p.y2)<p.width+(q.radius||8)){ q.vx=(q.vx||0)+p.nx*280*dt; q.vy=(q.vy||0)+p.ny*280*dt; } }
        }
        if (p.type === 'witch_ray') { /* visual only; damage happens at cast */ }
        if (p.type === 'pirate_loot') { /* static loot */ }
        if (p.type === 'pirate_anchor') {
            if(owner && !p.triggered){ p.x2=owner.x; p.y2=owner.y; }
            if(enemy && !p.triggered && distToSegment(enemy.x,enemy.y,p.x1,p.y1,p.x2,p.y2)<enemy.radius+28){
                p.triggered=true; p.dragTimer=.55; p.dragMax=.55; p.lootCollected=[]; p.startOwner={x:owner.x,y:owner.y}; p.startEnemy={x:enemy.x,y:enemy.y}; p.enemyId=enemy.id; p.finalDmg=20; p.boat=false;
                for(const q of projectiles){ 
                    if(q.type==='pirate_loot'&&q.owner===owner&&distToSegment(q.x,q.y,p.x1,p.y1,owner.x,owner.y)<q.radius+34){ 
                        p.lootCollected.push(q.kind);
                        if(q.kind==='treasure') owner.heal(5,false); 
                        if(q.kind==='cannon') p.finalDmg+=7; 
                        if(q.kind==='boat') p.boat=true; 
                        q.life=0; 
                    }
                }
                if(p.boat) p.finalDmg=Math.max(p.finalDmg,32);
                floatingTexts.push(new FloatingText(enemy.x,enemy.y-enemy.radius-90,'ANCHOR PULL','#d7a34a'));
            }
            if(owner && p.triggered){
                const target = fighters.find(f=>f.id===p.enemyId) || enemy;
                p.dragTimer -= dt;
                const t = smoothstep(1 - clamp(p.dragTimer/p.dragMax,0,1));
                owner.x = lerp(p.startOwner.x, p.x1, t); owner.y = lerp(p.startOwner.y, p.y1, t);
                if(target){ target.x = lerp(p.startEnemy.x, p.x1+36, t); target.y = lerp(p.startEnemy.y, p.y1+36, t); target.data.positionLocked=true; }
                p.x2=owner.x; p.y2=owner.y;
                if(p.dragTimer<=0){
                    if(target){ target.applyStatus('stun',1,{source:owner}); target.takeDamage(p.finalDmg,owner,'anchor-combo'); }
                    if(p.lootCollected && p.lootCollected.length) floatingTexts.push(new FloatingText(owner.x,owner.y-owner.radius-86,p.lootCollected.join('+').toUpperCase(),'#ffe0a0'));
                    spawnShockwave(p.x1,p.y1,owner.color,190); p.life=0;
                }
            }
        }
        if (p.type === 'painter_stroke' || p.type === 'painter_ink') {
            const nearEnemy = p.type==='painter_stroke'
                ? (enemy && distToSegment(enemy.x,enemy.y,p.x1,p.y1,p.x2,p.y2)<enemy.radius+(p.width||75))
                : (enemy && dist(enemy.x,enemy.y,p.x,p.y)<enemy.radius+p.radius);
            const nearOwner = p.type==='painter_stroke'
                ? (owner && distToSegment(owner.x,owner.y,p.x1,p.y1,p.x2,p.y2)<owner.radius+(p.width||75))
                : (owner && dist(owner.x,owner.y,p.x,p.y)<owner.radius+p.radius);
            if(nearEnemy){ 
                if(p.kind==='red'){ p.tick=(p.tick||0)+dt; while(p.tick>=1){p.tick-=1; enemy.takeDamage(2,owner,'red-ink',true);} } 
                else if(p.kind==='blue'){ enemy.applyStatus('paintBlue',.25,{source:owner}); floatingTexts.push(new FloatingText(enemy.x,enemy.y-enemy.radius-70,'BLUE +CD','#50a6ff')); } 
            }
            if(nearOwner && p.kind==='yellow') owner.applyStatus('speed',.25,{mult:1.7});
            if(nearOwner && owner && owner.isRage) owner.applyStatus('painterRageInk',.25,{source:owner});
        }
        if (p.type === 'painter_blob') {
            const target = p.enemy || enemy;
            if (target && !p.hit) {
                const n=norm(target.x-p.x,target.y-p.y);
                p.vx = n.x*640; p.vy = n.y*640;
            }
            p.x += (p.vx||0)*dt; p.y += (p.vy||0)*dt;
            if(target && !p.hit && dist(p.x,p.y,target.x,target.y)<target.radius+p.radius+8){
                p.hit=true;
                if(p.kind==='red'){ target.takeDamage(7,owner,'paint-blob-red'); spawnPainterInk(owner, target.x-35, target.y-35, 'red', target.x+35, target.y+35); }
                else if(p.kind==='blue'){ target.takeDamage(3,owner,'paint-blob-blue'); target.applyStatus('paintBlue',2,{source:owner}); }
                else { target.takeDamage(4,owner,'paint-blob-gold'); owner.applyStatus('speed',2,{mult:1.7}); owner.heal(3,false); }
                spawnShockwave(p.x,p.y,p.color||owner.color,90);
                p.life=0;
            }
            if(p.x<-60||p.x>1060||p.y<-60||p.y>1060) p.life=0;
        }
        if (p.type === 'superfan') {
            if(!owner){p.life=0; continue;}
            if(enemy){ const n=norm(enemy.x-p.x,enemy.y-p.y); p.dir=norm((p.dir?.x||0)*.75+n.x*.25,(p.dir?.y||0)*.75+n.y*.25); p.x+=p.dir.x*210*dt; p.y+=p.dir.y*210*dt; p.tick=(p.tick||0)+dt; if(dist(p.x,p.y,enemy.x,enemy.y)<enemy.radius+p.radius){ enemy.applyStatus('push',.16,{x:n.x,y:n.y,strength:420}); while(p.tick>=1){p.tick-=1; enemy.takeDamage(1,owner,'fan-swarm',true);} } }
            p.x=clamp(p.x,p.radius,GAME_SIZE-p.radius); p.y=clamp(p.y,p.radius,GAME_SIZE-p.radius);
            for(const q of projectiles){ if(q===p || !q.owner || q.owner===owner || q.x===undefined || q.y===undefined || q.vx===undefined || q.vy===undefined) continue; if(dist(q.x,q.y,p.x,p.y)<(q.radius||8)+p.radius){p.hp-=2; q.life=0;} }
            if(p.hp<=0) p.life=0;
        }
        if (p.type === 'spotlight_flash') { p.x=owner?owner.x:p.x; p.y=owner?owner.y:p.y; }

        if (p.type === 'card_throw') {
            const target = p.enemy || enemy;
            if (target) {
                const n = norm(target.x - p.x, target.y - p.y);
                p.vx = n.x * 980; p.vy = n.y * 980;
                p.x += p.vx * dt; p.y += p.vy * dt;
                if (!p.hit && dist(p.x,p.y,target.x,target.y) <= target.radius + p.radius + 12) {
                    p.hit = true;
                    if (p.dmg > 0) window.apexDealHybridNumericDamage ? window.apexDealHybridNumericDamage(target, owner, p.dmg, 'card-throw') : target.takeDamage(p.dmg, owner, 'card-throw');
                    else floatingTexts.push(new FloatingText(target.x, target.y - target.radius - 20, '-0.0', '#ff5950'));
                    for (const c of (p.hand || [])) { if (c.rank === 'J') target.applyStatus('burn',3,{source:owner,interval:.8,dmg:.8}); if (c.rank === 'Q') target.applyStatus('freeze',1.0,{source:owner,dartTotal:4}); if (c.rank === 'K') target.applyStatus('weak',4,{source:owner}); }
                    emitParticles(target.x,target.y,'#ffe8a0',34,420,6,.55,'square');
                    spawnShockwave(target.x,target.y,'#ffe8a0',150);
                    p.life = 0;
                }
            }
        }
        if (p.type === 'math_formula') {
            p.age += dt;
            if (!p.launched) {
                p.x = owner.x; p.y = owner.y - owner.radius - 52;
                if (p.age > 1.35) {
                    p.phase = 'throw'; p.launched = true;
                    const target = p.rage ? p.enemy : (p.value > 0 ? owner : p.enemy);
                    const n = norm(target.x - p.x, target.y - p.y);
                    p.vx = n.x * 760; p.vy = n.y * 760;
                }
            } else {
                const target = p.rage ? p.enemy : (p.value > 0 ? owner : p.enemy);
                if (target) { const n = norm(target.x - p.x, target.y - p.y); p.vx = n.x * (p.rage ? 920 : 760); p.vy = n.y * (p.rage ? 920 : 760); }
                p.x += p.vx * dt; p.y += p.vy * dt;
                if (!p.hit && target && dist(p.x,p.y,target.x,target.y) < target.radius + 34) {
                    p.hit = true;
                    if (p.rage) { if(window.apexDealHybridNumericDamage) window.apexDealHybridNumericDamage(target, owner, Math.abs(p.value), 'rage-equation'); else target.takeDamage(Math.abs(p.value), owner, 'rage-equation'); spawnShockwave(target.x,target.y,'#e4dcc9',220); triggerFlash(230,220,200,.22); }
                    else if (p.value > 0) owner.heal(Math.abs(p.value), false); else if(window.apexDealHybridNumericDamage) window.apexDealHybridNumericDamage(p.enemy, owner, Math.abs(p.value), 'math-number'); else p.enemy.takeDamage(Math.abs(p.value), owner, 'math-number');
                    emitParticles(target.x,target.y, p.rage?'#e4dcc9':(p.value>0?'#f0ead8':'#ff5050'), 34, 430, 6, .65, 'square');
                    p.life = 0;
                }
            }
        }
        if (p.life <= 0) projectiles.splice(i, 1);
    }
}
function drawProjectiles(ctx) {
    for (const p of projectiles) {

        ctx.save();
        if (p.type === 'ice_lane') { const a=p.life/p.maxLife; ctx.globalAlpha=.35*a; ctx.strokeStyle='#bff7ff'; ctx.lineWidth=p.halfWidth*2; ctx.lineCap='butt'; ctx.beginPath(); ctx.moveTo(p.x1,p.y1); ctx.lineTo(p.x2,p.y2); ctx.stroke(); ctx.globalAlpha=.85*a; ctx.strokeStyle='#f7ffff'; ctx.lineWidth=4; ctx.setLineDash([18,12]); ctx.beginPath(); ctx.moveTo(p.x1,p.y1); ctx.lineTo(p.x2,p.y2); ctx.stroke(); ctx.setLineDash([]); }
        if (p.type === 'meteor') { const t=clamp((p.life-.25)/Math.max(.001,p.delay),0,1); ctx.globalAlpha=.75; ctx.strokeStyle='#ff7a1f';ctx.lineWidth=5;ctx.setLineDash([8,8]);ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ff7a1f';ctx.beginPath();ctx.arc(p.x-140*t,p.y-240*t,16+(1-t)*20,0,TAU);ctx.fill(); }
        if (p.type === 'fire_pit') { ctx.globalAlpha=.48*(p.life/p.maxLife); ctx.fillStyle='#ff5a1d';ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,TAU);ctx.fill();ctx.strokeStyle='#ffbd4a';ctx.lineWidth=4;ctx.stroke(); }
        if (p.type === 'magnet_field') { ctx.globalAlpha=.32*(p.life/p.maxLife);ctx.strokeStyle='#ffe44e';ctx.lineWidth=7;ctx.setLineDash([16,12]);ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,TAU);ctx.stroke();ctx.setLineDash([]); }
        if (p.type === 'electric_node') { ctx.globalAlpha=.75*(p.life/p.maxLife);ctx.fillStyle='#bde5ff';ctx.strokeStyle='#e9fbff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,p.radius+6*Math.sin(Date.now()/90),0,TAU);ctx.fill();ctx.stroke(); }
        if (p.type === 'drum_wave') { ctx.globalAlpha=.72*(p.life/p.maxLife);ctx.strokeStyle='#ffcf7a';ctx.lineWidth=10;ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,TAU);ctx.stroke();ctx.strokeStyle='#5a2b12';ctx.lineWidth=3;ctx.stroke(); }
        if (p.type === 'electric_trail') { ctx.globalAlpha=.40*(p.life/p.maxLife);ctx.fillStyle='#68d6ff';ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,TAU);ctx.fill();ctx.strokeStyle='#e5fbff';ctx.lineWidth=3;ctx.setLineDash([6,8]);ctx.beginPath();ctx.arc(p.x,p.y,p.radius+8,0,TAU);ctx.stroke();ctx.setLineDash([]); }
        if (p.type === 'lightning') { ctx.globalAlpha=p.life/p.maxLife;ctx.strokeStyle='#e5fbff';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(p.x1,p.y1);const steps=9;for(let i=1;i<steps;i++){const t=i/steps;ctx.lineTo(lerp(p.x1,p.x2,t)+rand(-30,30),lerp(p.y1,p.y2,t)+rand(-30,30));}ctx.lineTo(p.x2,p.y2);ctx.stroke(); }
        if (p.type === 'web_line') { if(p.owner){p.x2=p.owner.x;p.y2=p.owner.y;} ctx.globalAlpha=.82;ctx.strokeStyle='#d9ccff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(p.x1,p.y1);ctx.lineTo(p.x2,p.y2);ctx.stroke();ctx.strokeStyle='#4a3b5b';ctx.lineWidth=2;for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(p.x1,p.y1);ctx.lineTo(lerp(p.x1,p.x2,i/4)+rand(-6,6),lerp(p.y1,p.y2,i/4)+rand(-6,6));ctx.stroke();} }
        if (p.type === 'toxic_trail' || p.type === 'toxic_puddle') { ctx.globalAlpha=.42*(p.life/p.maxLife);ctx.fillStyle='#8dff26';ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,TAU);ctx.fill();ctx.strokeStyle='#243a08';ctx.lineWidth=3;ctx.stroke(); }
        if (p.type === 'toxic_shot') { ctx.globalAlpha=p.life/p.maxLife;ctx.fillStyle='#9cff2b';ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,TAU);ctx.fill();ctx.strokeStyle='#223a09';ctx.lineWidth=4;ctx.stroke();ctx.fillStyle='#0a1600';ctx.font='900 22px monospace';ctx.textAlign='center';ctx.fillText('V',p.x,p.y+8); }
        if (p.type === 'gravity_well') { const a=p.life/p.maxLife;ctx.globalAlpha=.8;ctx.fillStyle='#000';ctx.beginPath();ctx.arc(p.x,p.y,p.core,0,TAU);ctx.fill();ctx.strokeStyle=`rgba(120,65,170,${.8*a})`;ctx.lineWidth=7;for(let j=0;j<3;j++){ctx.beginPath();ctx.ellipse(p.x,p.y,130+j*35,36+j*12,Date.now()/800+j,0,TAU);ctx.stroke();} if(p.owner&&p.owner.isRage){ctx.strokeStyle=`rgba(210,190,255,${.35*a})`;ctx.setLineDash([9,13]);ctx.beginPath();ctx.arc(p.x,p.y,360,0,TAU);ctx.stroke();ctx.setLineDash([]);} }
        if (p.type === 'blade_wave') { ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));ctx.globalAlpha=.82;ctx.fillStyle='rgba(230,246,255,.32)';ctx.beginPath();ctx.ellipse(-p.length*.35,0,p.length*.55,p.halfWidth*.95,0,-.82,.82);ctx.fill();ctx.strokeStyle='#f4fbff';ctx.lineWidth=9;ctx.beginPath();ctx.arc(-p.length*.30,0,p.halfWidth*.75,-.65,.65);ctx.stroke();ctx.strokeStyle='#111';ctx.lineWidth=3;ctx.stroke(); }
        if (p.type === 'crystal_wall') { ctx.strokeStyle='#bffcff';ctx.lineWidth=24;ctx.lineCap='butt';ctx.beginPath();ctx.moveTo(p.x1,p.y1);ctx.lineTo(p.x2,p.y2);ctx.stroke();ctx.strokeStyle='#12505c';ctx.lineWidth=5;ctx.stroke();const segs=7;for(let i=0;i<=segs;i++){const x=lerp(p.x1,p.x2,i/segs),y=lerp(p.y1,p.y2,i/segs);drawPolygon(ctx,[[x,y-22],[x+16,y],[x,y+22],[x-16,y]],'#eaffff','#12505c',2);} }
        if (p.type === 'crystal_cage') { const a=p.life/p.maxLife; ctx.globalAlpha=.90*a; const verts=[]; for(let i=0;i<(p.sides||10);i++){const ang=-Math.PI/2+i*TAU/(p.sides||10);verts.push({x:p.x+Math.cos(ang)*p.cageRadius,y:p.y+Math.sin(ang)*p.cageRadius});} ctx.strokeStyle='#bffcff';ctx.lineWidth=18;ctx.beginPath();verts.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();ctx.stroke();ctx.strokeStyle='#12505c';ctx.lineWidth=4;ctx.stroke();ctx.save();ctx.translate(p.diamondX,p.diamondY);ctx.rotate(Date.now()/90);drawPolygon(ctx,[[0,-34],[28,0],[0,34],[-28,0]],'#c7ffff','#0f4d55',4);ctx.restore(); }
        if (p.type === 'virus_minion') { const c=p.level===1?'#b8ff63':p.level===2?'#78cf3d':'#3e7f24'; ctx.globalAlpha=.88; ctx.fillStyle=c; ctx.strokeStyle='#0d1b06';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,TAU);ctx.fill();ctx.stroke();ctx.strokeStyle='#d9ff9a';ctx.lineWidth=2;for(let i=0;i<6;i++){ctx.beginPath();const a=i*TAU/6;ctx.moveTo(p.x+Math.cos(a)*p.radius*.7,p.y+Math.sin(a)*p.radius*.7);ctx.lineTo(p.x+Math.cos(a)*(p.radius+8),p.y+Math.sin(a)*(p.radius+8));ctx.stroke();} if(p.level>1){ctx.fillStyle='#0b1704';ctx.font='900 14px monospace';ctx.textAlign='center';ctx.fillText(String(p.level),p.x,p.y+5);} }
        if (p.type === 'card_throw') { ctx.translate(p.x,p.y); const hand=p.hand||[]; for(let i=0;i<hand.length;i++) drawPlayingCard(ctx, hand[i], -42+i*42, 0, .78, (-0.25+i*.25)+Date.now()/900); ctx.fillStyle='#ffe8a0';ctx.strokeStyle='#130a04';ctx.lineWidth=5;ctx.font='900 28px serif';ctx.textAlign='center';ctx.strokeText(String((p.dmg||0).toFixed ? p.dmg.toFixed(1) : p.dmg),0,-48);ctx.fillText(String((p.dmg||0).toFixed ? p.dmg.toFixed(1) : p.dmg),0,-48); }
        if (p.type === 'math_formula') { ctx.translate(p.x,p.y); const progress=clamp(p.age/1.35,0,1); const src=p.formula || p.text || ''; const typingText=src.slice(0,Math.max(1,Math.floor(src.length*progress))); const reveal=p.launched; ctx.fillStyle=reveal?(p.rage?'#fff0b8':(p.value>=0?'#95ff94':'#ff6464')):'#e4dcc9';ctx.strokeStyle='#080706';ctx.lineWidth=5;ctx.font=reveal?(p.rage?'900 48px monospace':'900 42px monospace'):(p.rage?'900 21px monospace':'900 25px monospace');ctx.textAlign='center';const txt=reveal?String(p.value):typingText;ctx.strokeText(txt,0,9);ctx.fillText(txt,0,9); }


        if (p.type === 'math_v2_grid') { const a=p.life/p.maxLife; ctx.globalAlpha=.18+0.18*a; ctx.strokeStyle='#8fcfff'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(50,500); ctx.lineTo(950,500); ctx.moveTo(500,50); ctx.lineTo(500,950); ctx.stroke(); ctx.fillStyle='#8fcfff'; ctx.font='900 18px monospace'; ctx.textAlign='center'; ctx.fillText('-1',55,525); ctx.fillText('1',945,525); ctx.fillText('1',525,60); ctx.fillText('-1',530,945); ctx.font='900 22px monospace'; ctx.fillText(p.formula || 'f(x)',500,105); }
        if (p.type === 'math_v2_graph') { const pts=p.points||[]; const n=Math.max(2,Math.ceil(pts.length*clamp(p.drawProgress ?? 1,0,1))); ctx.globalAlpha=.9*(p.life/p.maxLife); ctx.strokeStyle='#8fcfff'; ctx.lineWidth=18; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.beginPath(); pts.slice(0,n).forEach((pt,i)=>i?ctx.lineTo(pt.x,pt.y):ctx.moveTo(pt.x,pt.y)); ctx.stroke(); ctx.strokeStyle='#eaffff'; ctx.lineWidth=5; ctx.stroke(); const lead=pts[Math.min(pts.length-1,n-1)]; if(lead){ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(lead.x,lead.y,10,0,TAU);ctx.fill();ctx.strokeStyle='#8fcfff';ctx.lineWidth=3;ctx.stroke();} ctx.fillStyle='#eaffff'; ctx.font='900 21px monospace'; ctx.textAlign='center'; ctx.fillText(p.formula || 'f(x)',500,86); }
        if (p.type === 'sniper_laser') { const a=p.life/p.maxLife; ctx.globalAlpha=.95*a; ctx.strokeStyle='#ff3a3a'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(p.x1,p.y1); ctx.lineTo(p.x2,p.y2); ctx.stroke(); ctx.strokeStyle='rgba(255,170,170,.85)'; ctx.lineWidth=1; ctx.stroke(); }
        if (p.type === 'slime_child') { const a=clamp(p.life/p.maxLife,0,1); ctx.globalAlpha=.88; const g=ctx.createRadialGradient(p.x-6,p.y-8,3,p.x,p.y,p.radius+8); g.addColorStop(0,'#e6ffd9'); g.addColorStop(.55,'#7be66f'); g.addColorStop(1,'#1c6424'); ctx.fillStyle=g; ctx.strokeStyle='#123a16'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(p.x,p.y,p.radius,0,TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle='#113016'; ctx.beginPath(); ctx.arc(p.x,p.y,7,0,TAU); ctx.fill(); ctx.fillStyle='#d8ffc8';ctx.font='900 12px monospace';ctx.textAlign='center';ctx.fillText(Math.max(0,Math.ceil(p.hp||0)),p.x,p.y+p.radius+16); }
        if (p.type === 'time_mark') { const a=p.life/p.maxLife; ctx.globalAlpha=.82*a; ctx.strokeStyle='#d6d0ff'; ctx.lineWidth=5; ctx.setLineDash([8,8]); ctx.beginPath(); ctx.arc(p.x,p.y,82,0,TAU); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle='#d6d0ff'; ctx.font='900 18px monospace'; ctx.textAlign='center'; ctx.fillText('TIME MARK',p.x,p.y-92); }
        if (p.type === 'time_rift') { const a=p.life/p.maxLife; ctx.globalAlpha=.7*a; ctx.fillStyle='rgba(25,12,55,.72)'; ctx.strokeStyle='#d6d0ff'; ctx.lineWidth=6; ctx.beginPath(); ctx.ellipse(p.x,p.y,p.radius,p.radius*.55,Date.now()/400,0,TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle='#efeaff'; ctx.font='900 18px monospace'; ctx.textAlign='center'; ctx.fillText('RIFT '+Math.round(p.storedDamage||0),p.x,p.y+7); }
        if (p.type === 'wind_gale') { const a=p.life/p.maxLife; ctx.globalAlpha=.34*a; ctx.strokeStyle='#e7f7f0'; ctx.lineWidth=p.width*2; ctx.lineCap='butt'; ctx.beginPath(); ctx.moveTo(p.x1,p.y1); ctx.lineTo(p.x2,p.y2); ctx.stroke(); ctx.globalAlpha=.9*a; ctx.strokeStyle='#ffffff'; ctx.lineWidth=5; ctx.setLineDash([28,18]); ctx.beginPath(); ctx.moveTo(p.x1,p.y1); ctx.lineTo(p.x2,p.y2); ctx.stroke(); ctx.setLineDash([]); }
        if (p.type === 'witch_ray') { ctx.globalAlpha=p.life/p.maxLife; ctx.strokeStyle='#e49aff'; ctx.lineWidth=10; ctx.beginPath(); ctx.moveTo(p.x1,p.y1); ctx.lineTo(p.x2,p.y2); ctx.stroke(); ctx.strokeStyle='#f7e8ff'; ctx.lineWidth=3; ctx.stroke(); }
        if (p.type === 'pirate_loot') { ctx.globalAlpha=.9*(p.life/p.maxLife); ctx.translate(p.x,p.y); if(p.kind==='treasure'){drawPolygon(ctx,[[-28,-18],[28,-18],[34,18],[-34,18]],'#c9912b','#3b2108',4);ctx.fillStyle='#fff0a0';ctx.font='900 18px serif';ctx.textAlign='center';ctx.fillText('$',0,7);} else if(p.kind==='cannon'){drawPolygon(ctx,[[-34,-16],[24,-20],[38,0],[24,20],[-34,16]],'#2d3136','#d7a34a',4);ctx.fillStyle='#111';ctx.beginPath();ctx.arc(28,0,9,0,TAU);ctx.fill();} else {drawPolygon(ctx,[[-42,16],[-18,-20],[38,-14],[48,14],[10,30]],'#6d3c1d','#f2bf70',4);ctx.fillStyle='#f2bf70';ctx.font='900 13px serif';ctx.textAlign='center';ctx.fillText('BOAT',3,8);} }
        if (p.type === 'pirate_anchor') { ctx.globalAlpha=.92; ctx.strokeStyle=p.triggered?'#ffe0a0':'#8a6230'; ctx.lineWidth=p.triggered?7:5; ctx.beginPath(); ctx.moveTo(p.x1,p.y1); ctx.lineTo(p.x2,p.y2); ctx.stroke(); ctx.fillStyle='#2d2a25'; ctx.strokeStyle='#d7a34a'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(p.x1,p.y1,18,0,TAU); ctx.fill(); ctx.stroke(); ctx.font='900 24px serif'; ctx.fillStyle='#d7a34a'; ctx.textAlign='center';ctx.fillText('Ă¢Ââ€œ',p.x1,p.y1+9); }
        if (p.type === 'painter_stroke') { const a=p.life/p.maxLife; ctx.globalAlpha=.62*a; ctx.strokeStyle=p.color; ctx.lineWidth=(p.width||75)*2; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.beginPath(); ctx.moveTo(p.x1,p.y1); ctx.lineTo(p.x2,p.y2); ctx.stroke(); ctx.globalAlpha=.9*a; ctx.strokeStyle='#fff8d2'; ctx.lineWidth=4; ctx.setLineDash([10,10]); ctx.stroke(); ctx.setLineDash([]); }
        if (p.type === 'painter_blob') { ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=.92*(p.life/p.maxLife);ctx.fillStyle=p.color;ctx.strokeStyle='#fff8d2';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,p.radius,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#111';ctx.font='900 14px monospace';ctx.textAlign='center';ctx.fillText(p.kind==='red'?'R':p.kind==='blue'?'B':'G',0,5);ctx.restore(); }
        if (p.type === 'superfan') { ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#ff7bd6';ctx.strokeStyle='#2a0821';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,p.radius,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='900 10px sans-serif';ctx.textAlign='center';ctx.fillText('Ă¢â„¢Â¡',0,4);ctx.restore(); }

        if (p.type === 'mirror_zone') { const a = p.life / p.maxLife; ctx.globalAlpha = .28 + .20*a; ctx.fillStyle = p.kind === 'whole' ? 'rgba(235,250,255,.28)' : 'rgba(160,160,170,.24)'; ctx.strokeStyle = p.kind === 'whole' ? '#ffffff' : '#9aa0a8'; ctx.lineWidth = p.kind === 'whole' ? 7 : 5; ctx.setLineDash(p.kind === 'broken' ? [18,12] : []); ctx.beginPath(); ctx.arc(p.x,p.y,p.radius,0,TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle='#fff'; ctx.font='900 22px monospace'; ctx.textAlign='center'; ctx.fillText(p.kind==='whole'?'WHOLE Ä‚â€”200%':'BROKEN Ä‚â€”50%',p.x,p.y); }
        if (p.type === 'red_slash') { ctx.translate(p.x,p.y); ctx.rotate(p.angle); ctx.globalAlpha=p.life/p.maxLife; ctx.strokeStyle='#ff2020'; ctx.lineWidth=14; ctx.beginPath(); ctx.moveTo(-95,-75); ctx.lineTo(95,75); ctx.stroke(); ctx.lineWidth=4; ctx.strokeStyle='#ffe0e0'; ctx.stroke(); }
        if (p.type === 'flash_super') { const a=p.life/p.maxLife; ctx.globalAlpha=.85*a; ctx.strokeStyle='#fff06b'; ctx.lineWidth=8; for(const line of p.lines||[]){ctx.beginPath();ctx.moveTo(line.a.x,line.a.y);ctx.lineTo(line.b.x,line.b.y);ctx.stroke();} }
        if (p.type === 'ice_dart') {
            const target=fighters.find(f=>f.id===p.targetId);
            const angle=p.phase==='stage'&&Number.isFinite(p.stageAngle)?p.stageAngle:Math.atan2(p.vy||0,p.vx||1);
            ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.globalAlpha=clamp(p.life/p.maxLife,.35,1);
            ctx.shadowColor='#bff7ff';ctx.shadowBlur=10;
            drawPolygon(ctx,[[-22,-7],[22,0],[-22,7],[-12,0]],'#eaffff','#58c8d8',2);
        }
        if (p.type === 'kungfu_qi') { const a=clamp((p.life||1)/(p.maxLife||p.life||1),0,1); if (window) window.__kungfuCoreProjectileDrawCount=(window.__kungfuCoreProjectileDrawCount||0)+1; ctx.globalAlpha=.78*a; ctx.strokeStyle='#ffffff'; ctx.lineWidth=6; ctx.beginPath(); ctx.arc(p.x,p.y,14+(1-a)*58,0,TAU); ctx.stroke(); ctx.strokeStyle='#ffd28a'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(p.x,p.y,7+(1-a)*34,0,TAU); ctx.stroke(); }
        if (p.type === 'kungfu_palm') { const a=clamp((p.life||1)/(p.maxLife||p.life||1),0,1); if (window) window.__kungfuCoreProjectileDrawCount=(window.__kungfuCoreProjectileDrawCount||0)+1; ctx.translate(p.x,p.y); ctx.rotate(Math.atan2(p.vy||0,p.vx||1)); ctx.globalAlpha=.20+.25*a; ctx.fillStyle='rgba(255,210,138,.25)'; ctx.strokeStyle='rgba(255,210,138,.78)'; ctx.lineWidth=7; ctx.beginPath(); ctx.ellipse(0,0,235,132,0,0,TAU); ctx.fill(); ctx.stroke(); ctx.globalAlpha=.78*a; ctx.fillStyle='#ffe0a0'; ctx.font='900 40px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('Ă¦ÂÅ’',0,0); }
        if (p.type === 'kungfu_rage_seal') { const a=clamp((p.life||1)/(p.maxLife||p.life||1),0,1); if (window) window.__kungfuCoreProjectileDrawCount=(window.__kungfuCoreProjectileDrawCount||0)+1; ctx.globalAlpha=.88*a; ctx.strokeStyle='#ff9b50'; ctx.lineWidth=8; ctx.beginPath(); ctx.arc(p.x,p.y,76,0,TAU); ctx.stroke(); ctx.fillStyle='#ffdda8'; ctx.font='900 34px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('Ă¥Â°Â',p.x,p.y); }
        ctx.restore();
    }
}
function handleCollisions(dt) {
    const a=fighters[0], b=fighters[1]; if(!a||!b||a.hp<=0||b.hp<=0)return;
    const aNinjaProtected = a.name === 'NINJA' && a.data && (a.data.ninjaImmuneUntil || 0) > matchClock;
    const bNinjaProtected = b.name === 'NINJA' && b.data && (b.data.ninjaImmuneUntil || 0) > matchClock;
    if (aNinjaProtected || bNinjaProtected) return;
    const dx=b.x-a.x, dy=b.y-a.y; const d=Math.hypot(dx,dy)||1;
    const magnetShell = (a.name==='MAGNET' && a.data.fieldTimer>0) ? {mag:a, other:b} : (b.name==='MAGNET' && b.data.fieldTimer>0) ? {mag:b, other:a} : null;
    if (magnetShell) {
        const md = dist(magnetShell.mag.x, magnetShell.mag.y, magnetShell.other.x, magnetShell.other.y);
        const shellD = 310 + magnetShell.other.radius;
        if (md < shellD) {
            const n = norm(magnetShell.other.x-magnetShell.mag.x, magnetShell.other.y-magnetShell.mag.y);
            magnetShell.other.x = magnetShell.mag.x + n.x * shellD;
            magnetShell.other.y = magnetShell.mag.y + n.y * shellD;
            magnetShell.other.dir = reflectDir(magnetShell.other.dir, n.x, n.y);
            magnetShell.other.applyStatus('push', .16, {x:n.x,y:n.y,strength:720});
            return;
        }
    }
    const minD=a.radius+b.radius;
    if(d<minD){
        const nx=dx/d, ny=dy/d;
        const aPierce=a.name==='FLASH'&&a.data.dashTimer>0;
        const bPierce=b.name==='FLASH'&&b.data.dashTimer>0;
        if (aPierce || bPierce) {
            if(aPierce && !a.hasStatus('abilityDisabled')&&a.type.onCollide)a.type.onCollide(a,b,dt,{x:nx,y:ny});
            if(bPierce && !b.hasStatus('abilityDisabled')&&b.type.onCollide)b.type.onCollide(b,a,dt,{x:-nx,y:-ny});
            if(aPierce) mirrorStolenCollide(a,b,dt,{x:nx,y:ny});
            if(bPierce) mirrorStolenCollide(b,a,dt,{x:-nx,y:-ny});
            return;
        }
        const overlap=minD-d; a.x-=nx*overlap*.5; a.y-=ny*overlap*.5; b.x+=nx*overlap*.5; b.y+=ny*overlap*.5;
        a.dir=reflectDir(a.dir,-nx,-ny);
        b.dir=reflectDir(b.dir,nx,ny);
        if(!a.hasStatus('abilityDisabled')&&a.type.onCollide)a.type.onCollide(a,b,dt,{x:nx,y:ny});
        if(!b.hasStatus('abilityDisabled')&&b.type.onCollide)b.type.onCollide(b,a,dt,{x:-nx,y:-ny});
        mirrorStolenCollide(a,b,dt,{x:nx,y:ny}); mirrorStolenCollide(b,a,dt,{x:-nx,y:-ny});
    }
}
function drawTimeArenaClock(ctx) {
    if (!fighters || !fighters.some(f => f && f.name === 'TIME' && f.hp > 0)) return;
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = '#d6d0ff';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(500,500,430,0,TAU); ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#d6d0ff';
    ctx.font = '900 26px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i=1;i<=12;i++) {
        const a = -Math.PI/2 + i*TAU/12;
        ctx.fillText(String(i), 500 + Math.cos(a)*405, 500 + Math.sin(a)*405);
    }
    const hourA = ((matchClock % 13)/13)*TAU - Math.PI/2;
    const minA = ((matchClock % 7)/7)*TAU - Math.PI/2;
    ctx.globalAlpha = 0.62;
    ctx.strokeStyle = '#efeaff'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(500,500); ctx.lineTo(500+Math.cos(hourA)*260,500+Math.sin(hourA)*260); ctx.stroke();
    ctx.globalAlpha = 0.42; ctx.strokeStyle = '#9fa7ff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(500,500); ctx.lineTo(500+Math.cos(minA)*360,500+Math.sin(minA)*360); ctx.stroke();
    ctx.restore();
}

function drawBackground(ctx) {
    ctx.fillStyle = '#0d0b0a'; ctx.fillRect(0,0,GAME_SIZE,GAME_SIZE);
    const grad = ctx.createRadialGradient(500,500,80,500,500,720); grad.addColorStop(0,'rgba(70,55,42,.18)'); grad.addColorStop(.75,'rgba(10,9,8,.88)'); grad.addColorStop(1,'rgba(0,0,0,1)'); ctx.fillStyle=grad; ctx.fillRect(0,0,GAME_SIZE,GAME_SIZE);
    ctx.save(); ctx.globalAlpha=.14; ctx.strokeStyle='#b2a47e'; ctx.lineWidth=1; for(let x=0;x<=GAME_SIZE;x+=50){ctx.beginPath();ctx.moveTo(x+rand(-.8,.8),0);ctx.lineTo(x+rand(-.8,.8),GAME_SIZE);ctx.stroke();} for(let y=0;y<=GAME_SIZE;y+=50){ctx.beginPath();ctx.moveTo(0,y+rand(-.8,.8));ctx.lineTo(GAME_SIZE,y+rand(-.8,.8));ctx.stroke();}
    ctx.globalAlpha=.34; ctx.strokeStyle='#5f513b'; ctx.lineWidth=9; ctx.strokeRect(4,4,GAME_SIZE-8,GAME_SIZE-8); if(sawWallRage.timer>0){ctx.globalAlpha=.85;ctx.strokeStyle='#d7caba';ctx.lineWidth=26;ctx.setLineDash([18,12]);ctx.strokeRect(10,10,GAME_SIZE-20,GAME_SIZE-20);ctx.setLineDash([]);ctx.strokeStyle='#9b1d18';ctx.lineWidth=7;ctx.strokeRect(26,26,GAME_SIZE-52,GAME_SIZE-52);} ctx.globalAlpha=.10; ctx.fillStyle='#fff'; for(let i=0;i<140;i++)ctx.fillRect((i*137)%1000,(i*277)%1000,2,2); ctx.globalAlpha=.13; ctx.fillStyle='#2b2119'; for(let i=0;i<60;i++)ctx.fillRect((i*211)%1000,(i*83)%1000,rand(4,14),rand(4,14)); ctx.restore();
    drawTimeArenaClock(ctx);
}
function update(dt) {
    if (hitStop > 0) { hitStop -= dt; dt *= 0.1; }
    if (gameState !== 'PLAYING') return;
    if (autoBattlePaused && autoBattleControlsActive) {
        updateHUD();
        return;
    }
    matchClock += dt;
    if (sawWallRage.timer > 0) sawWallRage.timer = Math.max(0, sawWallRage.timer - dt);
    fighters[0].update(dt, fighters[1]); fighters[1].update(dt, fighters[0]); handleCollisions(dt); updateProjectiles(dt);
    let particleWrite=0;
    for(let i=0;i<particles.length;i++){const p=particles[i];p.update(dt);if(p.life>0)particles[particleWrite++]=p;}
    particles.length=particleWrite;
    let textWrite=0;
    for(let i=0;i<floatingTexts.length;i++){const text=floatingTexts[i];text.update(dt);if(text.life>0)floatingTexts[textWrite++]=text;}
    floatingTexts.length=textWrite;
    let shockWrite=0;
    for(let i=0;i<shockwaves.length;i++){const s=shockwaves[i];s.r+=420*dt;s.alpha=Math.max(0,1-s.r/s.maxR);if(s.alpha>0)shockwaves[shockWrite++]=s;}
    shockwaves.length=shockWrite;
    if (arenaFlash.a > 0) arenaFlash.a=Math.max(0,arenaFlash.a-dt*1.6); if(cameraShake>0)cameraShake=Math.max(0,cameraShake-dt*22); cameraZoom=lerp(cameraZoom,1,dt*2);
    if (fighters[0].hp <= 0 || fighters[1].hp <= 0) endMatch();
}
function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    try {
        const shakeX=rand(-cameraShake,cameraShake), shakeY=rand(-cameraShake,cameraShake);
        window.__apexCameraView = { shakeX, shakeY, zoom:cameraZoom };
        ctx.translate(GAME_SIZE/2+shakeX,GAME_SIZE/2+shakeY); ctx.scale(cameraZoom,cameraZoom); ctx.translate(-GAME_SIZE/2,-GAME_SIZE/2);
        drawBackground(ctx); drawProjectiles(ctx);
        for (const f of fighters) { 
            if (f && f.hasStatus && f.hasStatus('scent')) { 
                const lost=(f.maxHp-f.hp)/f.maxHp; const rr=Math.max(120,1000*lost); 
                ctx.save(); ctx.globalAlpha=.18; ctx.fillStyle='#ff2020'; ctx.strokeStyle='#ff4d4d'; ctx.lineWidth=5; ctx.setLineDash([20,14]); ctx.beginPath(); ctx.arc(f.x,f.y,rr,0,TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle='#ffd0d0'; ctx.font='900 18px monospace'; ctx.textAlign='center'; ctx.fillText('BLOOD SCENT',f.x,f.y-rr-12); ctx.restore(); 
            } 
        }
        for (const s of shockwaves) { ctx.save(); ctx.globalAlpha=s.alpha; ctx.strokeStyle=s.color; ctx.lineWidth=7; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,TAU); ctx.stroke(); ctx.restore(); }
        for (const p of particles) p.draw(ctx);
        if (fighters[0]) fighters[0].draw(ctx); if (fighters[1]) fighters[1].draw(ctx);
        for (const f of fighters) { if (f && f.name==='SNIPER' && f.data && f.data.aim>0) { const enemy = fighters.find(q=>q.id!==f.id); if(enemy){ ctx.save(); ctx.globalAlpha=.9; ctx.strokeStyle='rgba(255,45,45,.95)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(f.x,f.y); ctx.lineTo(enemy.x,enemy.y); ctx.stroke(); ctx.strokeStyle='rgba(255,45,45,.95)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.radius+16, 0, TAU); ctx.moveTo(enemy.x-(enemy.radius+28), enemy.y); ctx.lineTo(enemy.x+(enemy.radius+28), enemy.y); ctx.moveTo(enemy.x, enemy.y-(enemy.radius+28)); ctx.lineTo(enemy.x, enemy.y+(enemy.radius+28)); ctx.stroke(); ctx.restore(); }} }
        for (const t of floatingTexts) t.draw(ctx);
        if (arenaFlash.a > 0) { ctx.fillStyle=`rgba(${arenaFlash.r},${arenaFlash.g},${arenaFlash.b},${arenaFlash.a})`; ctx.fillRect(0,0,GAME_SIZE,GAME_SIZE); }
    } finally {
        ctx.restore();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = 'none';
    }
}

function loop(timestamp) {
    const rawDt = Math.min(0.033, (timestamp - lastTime) / 1000 || 0);
    lastTime = timestamp;
    update(rawDt * timeScale);
    draw();
    reqId = requestAnimationFrame(loop);
}

function triggerSlowMoFinish() {
    timeScale = 0.25;
    hitStop = 0.1;
    cameraShake = 18;
    cameraZoom = 1.08;
    setTimeout(() => { timeScale = 1.0; }, 900);
}

function updateHpLossTrail(fill,trail,visiblePct){
    if(!fill)return;
    const previous=Number(fill.dataset.hpPct);
    if(trail&&Number.isFinite(previous)&&visiblePct<previous-.01){
        trail.style.transition='none';
        trail.style.left=`${visiblePct}%`;
        trail.style.width=`${previous-visiblePct}%`;
        trail.style.opacity='1';
        void trail.offsetWidth;
        trail.style.transition='opacity .62s ease-out';
        clearTimeout(trail.__apexFadeTimer);
        trail.__apexFadeTimer=setTimeout(()=>{trail.style.opacity='0';},70);
    }else if(trail&&Number.isFinite(previous)&&visiblePct>previous+.01){
        trail.style.opacity='0';trail.style.width='0';
    }
    fill.style.width=`${visiblePct}%`;
    fill.dataset.hpPct=String(visiblePct);
}

function updateHUD() {
    if (!fighters[0] || !fighters[1]) return;
    for (let i=0; i<2; i++) {
        const f = fighters[i];
        const pct = clamp((f.hp / f.maxHp) * 100, 0, 140);
        const visiblePct=Math.min(100,pct);
        const fill=document.getElementById(`p${i+1}-hp`);
        const trail=document.getElementById(`p${i+1}-hp-loss`);
        updateHpLossTrail(fill,trail,visiblePct);
        const hpLabel = f.data && f.data.autoBattleInfiniteHp ? `${f.hp.toFixed(1)} / INF` : `${f.hp.toFixed(1)} / ${f.maxHp}`;
        document.getElementById(`p${i+1}-hp-text`).innerText = hpLabel;
        const rageEl=document.getElementById(`p${i+1}-rage`); rageEl.style.opacity = f.isRage ? 1 : 0; rageEl.style.display = f.isRage ? 'block' : 'none';
    }
}


function fighterGlyph(name) { const map={RUBBER:'Ă¢â€”Â',ICE:'Ă¢â€”â€ ',VAMPIRE:'Ă¢â„¢Â°',STRING:'Ă¢Å“Â£',VOLCANO:'Ă¢â€“Â²',MAGNET:'Ă¢Ë†Âª',FLASH:'ĂÅ¸',ELECTRIC:'Ă¢ÂÂ¡',ORBIT:'Ă¢ËœÂ',TOXIC:'Ă¢ËœÂ£',MIRROR:'Ă¢â€”Ë†',BLACK_HOLE:'Ă¢â€”Â',SAW:'Ă¢Å“Âº',BLADE:'Ă¢ËœÂ¾',NOVA:'Ă¢Å“Â¹',HUNTER:'Ä‘Å¸â€”Â¡',CRYSTAL:'Ă¢â€”â€¡',VIRUS:'Ă¢Å“Â³',CARD:'Ă¢â„¢Â ',MATH:'Ă¢Ë†â€˜',DRUM:'Ă¢â€”â€°',MATH_V2:'Ă†â€™',SNIPER:'Ă¢Å’â€“',SLIME:'Ă¢â€”Â',TIME:'Ă¢â€”Â·',WOLF:'Ă¢â„¢Â',WIND:'Ă¢â€°Ë†',WITCH:'Ă¢â„¢â€ ',PIRATE:'Ă¢ËœÂ ',PAINTER:'Ă¢â€“Â°',MONK:'Ă¦â€¹Â³',SUPERSTAR:'Ă¢Ëœâ€¦'}; return map[name] || 'Ă¢â€”â€ '; }
function shuffle(list){ const arr=[...list]; for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
function fighterTypeByName(name){ return FighterTypes.find(f=>f.name===name) || null; }
function challengeHash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function challengeRng(seed) {
    let s = challengeHash(seed) || 1;
    return () => {
        s = Math.imul(1664525, s) + 1013904223;
        return (s >>> 0) / 4294967296;
    };
}
function todayChallengeSeed(date = new Date()) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `AC-${yyyy}${mm}${dd}`;
}
function buildDailyChallenge(seed = todayChallengeSeed()) {
    const roll = challengeRng(seed);
    const roster = FighterTypes.filter(f => f.name !== 'WIND');
    const left = roster[Math.floor(roll() * roster.length)];
    let right = roster[Math.floor(roll() * roster.length)];
    while (right.name === left.name) right = roster[Math.floor(roll() * roster.length)];
    const rules = [
        { id:'one-hp-flex', title:'1 HP Flex', hook:'Win with the lowest HP possible', score:'LOW HP' },
        { id:'speed-run', title:'60 Second Violence', hook:'Finish before the clip gets boring', score:'FAST WIN' },
        { id:'big-hit', title:'Biggest Hit Hunt', hook:'Land the nastiest single hit', score:'BIG HIT' },
        { id:'rage-bait', title:'Rage Comeback', hook:'Let rage trigger, then steal the win', score:'RAGE' },
        { id:'chaos-proof', title:'No Excuses Mirror', hook:'Random matchup, same seed for everyone', score:'SURVIVE' }
    ];
    const rule = rules[Math.floor(roll() * rules.length)];
    return { seed, left:left.name, right:right.name, rule };
}
function buildChallengeCaption(challenge, winner, loser) {
    const duration = Math.max(.1, matchClock || ((performance.now() - matchStartTime) / 1000));
    const biggest = Math.max(winner.maxHit || 0, loser.maxHit || 0);
    const hp = Math.max(0, winner.hp || 0);
    return `APEX CHAOS Daily Challenge ${challenge.seed}: ${challenge.rule.title}. ${winner.name} beat ${loser.name} in ${duration.toFixed(1)}s with ${hp.toFixed(1)} HP. Biggest hit ${biggest.toFixed(1)}. Can you beat this seed? #ApexChaos #GamingTikTok #IndieGame`;
}
function buildChallengeSummary(winner, loser) {
    if (!currentChallenge) return '';
    const c = currentChallenge;
    const duration = Math.max(.1, matchClock || ((performance.now() - matchStartTime) / 1000));
    const biggest = Math.max(winner.maxHit || 0, loser.maxHit || 0);
    const caption = buildChallengeCaption(c, winner, loser).replace(/"/g, '&quot;');
    const score = c.rule.id === 'one-hp-flex'
        ? `${Math.max(0, winner.hp || 0).toFixed(1)} HP left`
        : c.rule.id === 'speed-run'
            ? `${duration.toFixed(1)}s clear`
            : c.rule.id === 'big-hit'
                ? `${biggest.toFixed(1)} biggest hit`
                : c.rule.id === 'rage-bait'
                    ? `${winner.isRage ? 'rage win' : 'no rage win'}`
                    : `${winner.name} survived`;
    return `
        <div class="challenge-share">
            <div>
                <span class="challenge-kicker">DAILY TIKTOK CHALLENGE</span>
                <h3>${c.rule.title}</h3>
                <p>${c.rule.hook}</p>
            </div>
            <div class="challenge-code">${c.seed}</div>
            <div class="challenge-meta">
                <span>${c.left} vs ${c.right}</span>
                <span>${c.rule.score}: ${score}</span>
            </div>
            <textarea id="challenge-caption" readonly>${caption}</textarea>
            <button type="button" class="compact-btn" onclick="copyChallengeCaption()">Copy TikTok Caption</button>
        </div>`;
}
function copyChallengeCaption() {
    const el = document.getElementById('challenge-caption');
    if (!el) return;
    const text = el.value;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
    else { el.focus(); el.select(); document.execCommand('copy'); }
}
function startDailyChallenge() {
    const challenge = buildDailyChallenge();
    currentChallenge = challenge;
    const left = fighterTypeByName(challenge.left);
    const right = fighterTypeByName(challenge.right);
    if (!left || !right) return;
    startSpecificMatch(left, right, { countdown:true, tournament:false, challenge });
}
function tournamentFighterStyle(name){ const ft=fighterTypeByName(name); return ft ? ft.color : '#80786c'; }
function tournamentMakeMatch(branch, round, index, a=null, b=null){ return { id:`${branch}-R${round}-M${index}`, branch, round, index, a, b, winner:null, loser:null, result:null, started:false }; }
function resetTournament(){ tournamentState = createTournamentState(); renderTournament(); }
function createTournamentState(){
    const names = shuffle(FighterTypes.map(f=>f.name));
    while(names.length < 32) names.push('BYE');
    const state = { createdAt: Date.now(), champion:null, matchesPlayed:0, log:[], branches:{A:{rounds:[]},B:{rounds:[]}}, final:tournamentMakeMatch('F',1,0,null,null) };
    for (const branchName of ['A','B']) {
        const slice = branchName === 'A' ? names.slice(0,16) : names.slice(16,32);
        const rounds = [];
        rounds[0] = [];
        for(let i=0;i<8;i++) rounds[0].push(tournamentMakeMatch(branchName,0,i,slice[i*2],slice[i*2+1]));
        rounds[1] = Array.from({length:4},(_,i)=>tournamentMakeMatch(branchName,1,i));
        rounds[2] = Array.from({length:2},(_,i)=>tournamentMakeMatch(branchName,2,i));
        rounds[3] = [tournamentMakeMatch(branchName,3,0)];
        state.branches[branchName].rounds = rounds;
    }
    tournamentAutoResolveByes(state);
    return state;
}
function tournamentAllMatches(state=tournamentState){
    if(!state) return [];
    return [...state.branches.A.rounds.flat(), ...state.branches.B.rounds.flat(), state.final];
}
function tournamentFindMatch(id){ return tournamentAllMatches().find(m=>m.id===id); }
function tournamentAutoResolveByes(state=tournamentState){
    if(!state) return;
    let changed=true, guard=0;
    while(changed && guard++ < 100){
        changed=false;
        for(const m of tournamentAllMatches(state)){
            if(m.winner) continue;
            const aReady = m.a && m.a !== 'BYE';
            const bReady = m.b && m.b !== 'BYE';
            if(aReady && m.b === 'BYE'){ tournamentSetWinner(m, m.a, 'BYE', true, state); changed=true; }
            else if(bReady && m.a === 'BYE'){ tournamentSetWinner(m, m.b, 'BYE', true, state); changed=true; }
            else if(m.a === 'BYE' && m.b === 'BYE'){ m.winner='BYE'; m.result={bye:true}; tournamentAdvance(m, 'BYE', state); changed=true; }
        }
    }
}
function tournamentAdvance(match, winnerName, state=tournamentState){
    if(!state || !winnerName || winnerName==='BYE') return;
    if(match.branch === 'F') { state.champion = winnerName; return; }
    const rounds = state.branches[match.branch].rounds;
    if(match.round < rounds.length-1){
        const next = rounds[match.round+1][Math.floor(match.index/2)];
        if(match.index % 2 === 0) next.a = winnerName; else next.b = winnerName;
    } else {
        if(match.branch === 'A') state.final.a = winnerName; else state.final.b = winnerName;
    }
}
function tournamentSetWinner(match, winnerName, loserName, bye=false, state=tournamentState, resultData=null){
    if(!match || match.winner) return;
    match.winner = winnerName; match.loser = loserName; match.result = resultData || { bye };
    if(!bye && state){ state.matchesPlayed++; state.log.push({ id:match.id, winner:winnerName, loser:loserName, result:match.result, time:match.result?.duration || 0 }); }
    tournamentAdvance(match, winnerName, state);
    tournamentAutoResolveByes(state);
}
function tournamentReady(match){ return match && !match.winner && match.a && match.b && match.a !== 'BYE' && match.b !== 'BYE'; }
function renderTournamentMatchCard(match){
    const ready = tournamentReady(match);
    const locked = !match.winner && !ready;
    const cls = match.winner ? 'done' : ready ? 'ready' : 'locked';
    const aColor = tournamentFighterStyle(match.a), bColor = tournamentFighterStyle(match.b);
    const click = ready ? `onclick="startTournamentMatch('${match.id}')"` : '';
    const result = match.winner ? `<div class="match-hint">Winner: <b style="color:${tournamentFighterStyle(match.winner)}">${match.winner}</b>${match.result&&match.result.duration?` Ă‚Â· ${match.result.duration.toFixed(1)}s`:''}</div>` : ready ? `<div class="match-hint">Ă¡ÂºÂ¤n Ă„â€˜Ă¡Â»Æ’ bĂ¡ÂºÂ¯t Ă„â€˜Ă¡ÂºÂ§u. 3 giÄ‚Â¢y Ă„â€˜Ă¡ÂºÂ¿m ngĂ†Â°Ă¡Â»Â£c trĂ†Â°Ă¡Â»â€ºc trĂ¡ÂºÂ­n.</div>` : `<div class="match-hint">CHĂ†Â¯A MĂ¡Â»Â KHÄ‚â€œA</div>`;
    const showName = (n)=> n || '???';
    return `<div class="match-card ${cls}" ${click}>
        <div class="match-title"><span>${match.branch==='F'?'GRAND FINAL':`R${match.round+1} Ă‚Â· CĂ¡ÂºÂ·p ${match.index+1}`}</span><span>${match.winner?'DONE':ready?'READY':'LOCKED'}</span></div>
        <div class="entrant ${match.winner===match.a?'winner':''}" style="color:${aColor}"><span class="dot" style="background:${aColor}"></span><span class="entrant-name">${showName(match.a)}</span></div>
        <div class="entrant ${match.winner===match.b?'winner':''}" style="color:${bColor}"><span class="dot" style="background:${bColor}"></span><span class="entrant-name">${showName(match.b)}</span></div>
        ${result}
    </div>`;
}
function renderTournamentRound(title, matches, isOuter=false){ return `<div class="round-col ${isOuter?'outer-round':''}"><h4>${title}${isOuter?' <span class="outer-badge">BĂ¡ÂºÂ¤M Ă¡Â»Â Ă„ÂÄ‚â€Y</span>':''}</h4>${matches.map(renderTournamentMatchCard).join('')}</div>`; }
function renderTournamentBranch(name, branch){
    const titles=['VÄ‚Â²ng ngoÄ‚Â i cÄ‚Â¹ng','VÄ‚Â²ng 2','BÄ‚Â¡n kĂ¡ÂºÂ¿t nhÄ‚Â¡nh','Chung kĂ¡ÂºÂ¿t nhÄ‚Â¡nh'];
    return `<div class="tournament-section"><div class="tournament-section-title"><span>${name}</span><span style="font-size:.75rem;opacity:.78">KÄ‚Â©o ngang Ă„â€˜Ă¡Â»Æ’ xem toÄ‚Â n nhÄ‚Â¡nh</span></div><div class="round-strip">${branch.rounds.map((r,i)=>renderTournamentRound(titles[i],r,i===0)).join('')}</div></div>`;
}
function tournamentReadyMatches(){ return tournamentAllMatches().filter(tournamentReady); }
function renderTournamentReadyPanel(){
    const ready = tournamentReadyMatches();
    if(!ready.length) return `<div class="tournament-section"><div class="tournament-section-title"><span>CĂ¡ÂºÂ¶P SĂ¡ÂºÂ´N SÄ‚â‚¬NG</span></div><div class="match-hint">ChĂ†Â°a cÄ‚Â³ cĂ¡ÂºÂ·p mĂ¡Â»Å¸ khÄ‚Â³a. HÄ‚Â£y hoÄ‚Â n thÄ‚Â nh cÄ‚Â¡c trĂ¡ÂºÂ­n Ă„â€˜ang hiĂ¡Â»Æ’n thĂ¡Â»â€¹ hoĂ¡ÂºÂ·c giĂ¡ÂºÂ£i Ă„â€˜Ă¡ÂºÂ¥u Ă„â€˜Ä‚Â£ hoÄ‚Â n tĂ¡ÂºÂ¥t.</div></div>`;
    const cards = ready.map(m=>{
        const ac=tournamentFighterStyle(m.a), bc=tournamentFighterStyle(m.b);
        return `<div class="ready-card" onclick="startTournamentMatch('${m.id}')">
            <div class="ready-title"><span>${m.branch==='F'?'GRAND FINAL':`NHÄ‚ÂNH ${m.branch} Ă‚Â· ${m.round===0?'VÄ‚â€™NG NGOÄ‚â‚¬I':`VÄ‚â€™NG ${m.round+1}`} Ă‚Â· CĂ¡ÂºÂ¶P ${m.index+1}`}</span><span>PLAY</span></div>
            <div class="ready-vs"><span style="color:${ac}">${fighterGlyph(m.a)} ${m.a}</span><span class="vs">VS</span><span style="color:${bc};text-align:right">${m.b} ${fighterGlyph(m.b)}</span></div>
        </div>`;
    }).join('');
    return `<div class="tournament-section"><div class="tournament-section-title"><span>CĂ¡ÂºÂ¶P SĂ¡ÂºÂ´N SÄ‚â‚¬NG Ă„ÂĂ¡Â»â€ Ă„ÂĂ¡ÂºÂ¤U</span><span style="font-size:.75rem;opacity:.78">BĂ¡ÂºÂ¥m card lĂ¡Â»â€ºn nÄ‚Â y nĂ¡ÂºÂ¿u vÄ‚Â²ng ngoÄ‚Â i cÄ‚Â¹ng khÄ‚Â³ nhÄ‚Â¬n</span></div><div class="ready-grid">${cards}</div></div>`;
}
function buildTournamentSummary(){
    const st=tournamentState; if(!st) return '';
    const played = st.log.length;
    const fastest = st.log.length ? st.log.reduce((a,b)=>(a.result.duration||9999)<(b.result.duration||9999)?a:b) : null;
    const biggest = st.log.length ? st.log.reduce((a,b)=>(a.result.biggest||0)>(b.result.biggest||0)?a:b) : null;
    const topDmg = st.log.length ? st.log.reduce((a,b)=>(a.result.winnerDamage||0)>(b.result.winnerDamage||0)?a:b) : null;
    const champion = st.champion;
    const stats = `<div class="tournament-summary">
        <div class="tour-stat"><b>${played}</b><span>TrĂ¡ÂºÂ­n Ă„â€˜Ä‚Â£ Ă„â€˜Ă¡ÂºÂ¥u</span></div>
        <div class="tour-stat"><b>${fastest?fastest.result.duration.toFixed(1)+'s':'-'}</b><span>TrĂ¡ÂºÂ­n nhanh nhĂ¡ÂºÂ¥t</span></div>
        <div class="tour-stat"><b>${biggest?biggest.result.biggest.toFixed(1):'-'}</b><span>Biggest hit</span></div>
        <div class="tour-stat"><b>${topDmg?topDmg.result.winnerDamage.toFixed(1):'-'}</b><span>Winner damage cao nhĂ¡ÂºÂ¥t</span></div>
    </div>`;
    const log = st.log.slice(-6).reverse().map(x=>`<div class="match-hint"><b style="color:${tournamentFighterStyle(x.winner)}">${x.winner}</b> thĂ¡ÂºÂ¯ng ${x.loser} Ă‚Â· ${x.result.duration.toFixed(1)}s Ă‚Â· ${x.result.winnerHp.toFixed(1)} HP</div>`).join('');
    const banner = champion ? `<div class="champion-banner"><h2 style="color:${tournamentFighterStyle(champion)}">Ä‘Å¸Ââ€  ${champion} VÄ‚â€ Ă„ÂĂ¡Â»ÂCH</h2><div>GiĂ¡ÂºÂ£i Ă„â€˜Ă¡ÂºÂ¥u hoÄ‚Â n tĂ¡ÂºÂ¥t. TĂ¡Â»â€¢ng kĂ¡ÂºÂ¿t Ă„â€˜Ă†Â°Ă¡Â»Â£c lĂ†Â°u trong bĂ¡ÂºÂ£ng dĂ†Â°Ă¡Â»â€ºi.</div></div>` : '';
    return `${banner}${stats}<div class="timeline"><h4>NHĂ¡ÂºÂ¬T KÄ‚Â GIĂ¡ÂºÂ¢I Ă„ÂĂ¡ÂºÂ¤U</h4>${log || '<div>ChĂ†Â°a cÄ‚Â³ trĂ¡ÂºÂ­n nÄ‚Â o. HÄ‚Â£y Ă¡ÂºÂ¥n vÄ‚Â o mĂ¡Â»â„¢t cĂ¡ÂºÂ·p READY Ă„â€˜Ă¡Â»Æ’ bĂ¡ÂºÂ¯t Ă„â€˜Ă¡ÂºÂ§u.</div>'}</div>`;
}
function renderTournament(){
    const board=document.getElementById('tournament-board');
    if(!board) return;
    if(!tournamentState) tournamentState = createTournamentState();
    board.classList.add('full');
    board.innerHTML = `${renderTournamentReadyPanel()}${renderTournamentBranch('NHÄ‚ÂNH A', tournamentState.branches.A)}${renderTournamentBranch('NHÄ‚ÂNH B', tournamentState.branches.B)}<div class="tournament-section"><div class="tournament-section-title"><span>CHUNG KĂ¡ÂºÂ¾T TĂ¡Â»â€NG</span></div><div class="round-strip final-strip">${renderTournamentRound('Grand Final',[tournamentState.final])}</div>${buildTournamentSummary()}</div>`;
}
function goToMenu(){ stopBattleAudio(); clearNinjaVisualArtifacts(); autoBattlePaused=false; autoBattleControlsActive=false; updateAutoBattleControls(); document.getElementById('select-screen').classList.add('hidden'); document.getElementById('end-screen').classList.add('hidden'); document.getElementById('tournament-screen').classList.add('hidden'); document.getElementById('menu-screen').classList.remove('hidden'); document.getElementById('hud').style.opacity = 0; tournamentModeActive=false; gameState='MENU'; }
function goToTournament(){ stopBattleAudio(); clearNinjaVisualArtifacts(); autoBattlePaused=false; autoBattleControlsActive=false; updateAutoBattleControls(); document.getElementById('menu-screen').classList.add('hidden'); document.getElementById('select-screen').classList.add('hidden'); document.getElementById('end-screen').classList.add('hidden'); document.getElementById('tournament-screen').classList.remove('hidden'); document.getElementById('hud').style.opacity = 0; gameState='TOURNAMENT'; tournamentModeActive=true; renderTournament(); }
function startTournamentMatch(matchId){
    const match = tournamentFindMatch(matchId);
    if(!tournamentReady(match)) return;
    activeTournamentMatchId = matchId;
    tournamentModeActive = true;
    const a = fighterTypeByName(match.a), b = fighterTypeByName(match.b);
    if(!a || !b) return;
    startSpecificMatch(a,b,{countdown:true,tournament:true});
}
function completeTournamentMatch(winner, loser){
    const match = tournamentFindMatch(activeTournamentMatchId);
    if(!match) return;
    const duration = Math.max(.1, matchClock || ((performance.now()-matchStartTime)/1000));
    const result = { duration, winnerHp:winner.hp, loserHp:loser.hp, winnerDamage:winner.damageDone||0, loserDamage:loser.damageDone||0, biggest:Math.max(winner.maxHit||0, loser.maxHit||0), label:sortedBreakdown(winner.damageLabels||{}) };
    tournamentSetWinner(match, winner.name, loser.name, false, tournamentState, result);
    activeTournamentMatchId = null;
}
function returnToTournament(){ goToTournament(); }
var rosterPreviewRaf = 0;
var rosterPreviewLastFrame = 0;
var ROSTER_PREVIEW_INTERVAL = 160;
var FULL_ROSTER_PREVIEW_INTERVAL = 450;
function makeRosterPreviewFighter(ft, id) {
    try {
        const f = new Fighter(9000 + id, 500, 500, ft);
        f.x = 70;
        f.y = 50;
        f.radius = 45;
        f.baseRadius = 45;
        f.maxHp = 100;
        f.hp = 100;
        f.isRage = false;
        f.dir = norm(1, -0.16);
        f.trail = [];
        f.statuses = {};
        f.virusParasites = [];
        f.data = Object.assign({}, f.data || {}, {
            beat: 1,
            chordName: f.name === 'MUSICIAN' ? 'READY' : (f.data && f.data.chordName),
            chordPulse: f.name === 'MUSICIAN' ? .18 : (f.data && f.data.chordPulse) || 0,
            reels: f.name === 'ARCADE' ? ['7','BAR','BELL'] : (f.data && f.data.reels),
            lastSpin: f.name === 'ARCADE' ? ['7','BAR','BELL'] : (f.data && f.data.lastSpin),
            cardTimer: f.name === 'PUPPET' ? 5 : (f.data && f.data.cardTimer)
        });
        return f;
    } catch (err) {
        return {
            id: 9000 + id, x:70, y:50, name:ft.name, type:ft, color:ft.color, radius:45,
            baseRadius:45, maxHp:100, hp:100, isRage:false, data:{}, statuses:{},
            trail:[], virusParasites:[], dir:norm(1,-0.16),
            hasStatus:()=>false
        };
    }
}
function drawRosterPreview(canvas, ft, index) {
    if (!canvas || !ft) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const fake = canvas.__previewFighter || (canvas.__previewFighter = makeRosterPreviewFighter(ft, index));
    fake.type = ft;
    fake.name = ft.name;
    fake.color = ft.color;
    fake.x = w / 2;
    fake.y = h * .58;
    fake.radius = Math.min(34, h * .32);
    fake.baseRadius = fake.radius;
    fake.dir = norm(1, -0.16);
    fake.trail = [];
    fake.statuses = {};
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath();
    ctx.ellipse(w/2, h*.78, w*.27, h*.08, 0, 0, TAU);
    ctx.fill();
    try {
        fake.draw(ctx);
    } catch (err) {
        ctx.save();
        ctx.translate(w/2, h*.5);
        drawSketchBlob(ctx, fake.radius, ft.color, 12);
        ctx.fillStyle = '#f3efe3';
        ctx.strokeStyle = '#080808';
        ctx.lineWidth = 4;
        ctx.font = "900 22px 'Segoe UI'";
        ctx.textAlign = 'center';
        ctx.strokeText(fighterGlyph(ft.name), 0, 8);
        ctx.fillText(fighterGlyph(ft.name), 0, 8);
        ctx.restore();
    }
    ctx.restore();
}
function renderRosterPreviews(forceFlag = false) {
    const force = forceFlag === true;
    if (force && rosterPreviewRaf) {
        window.clearTimeout(rosterPreviewRaf);
        rosterPreviewRaf = 0;
    }
    const selectScreen = document.getElementById('select-screen');
    if (!selectScreen || selectScreen.classList.contains('hidden')) {
        rosterPreviewRaf = 0;
        return;
    }
    const now = performance.now();
    const grid = document.getElementById('roster-grid');
    const cards = grid?.querySelectorAll('.fighter-card');
    const previewInterval = (cards?.length || 0) > 12 ? FULL_ROSTER_PREVIEW_INTERVAL : ROSTER_PREVIEW_INTERVAL;
    if (force || now - rosterPreviewLastFrame >= previewInterval) {
        rosterPreviewLastFrame = now;
        const viewport = grid?.getBoundingClientRect();
        cards?.forEach((card, index) => {
            const bounds = card.getBoundingClientRect();
            if (!force && viewport && (bounds.bottom < viewport.top || bounds.top > viewport.bottom)) return;
            const canvas = card.querySelector('.f-preview');
            const ft = fighterTypeByName(card.dataset.fighter || '');
            drawRosterPreview(canvas, ft, index);
        });
    }
    rosterPreviewRaf = window.setTimeout(() => {
        rosterPreviewRaf = 0;
        renderRosterPreviews(false);
    }, previewInterval);
}
function ensureRosterPreviewLoop() {
    if (!rosterPreviewRaf) renderRosterPreviews(true);
}
function populateRoster() {
    const grid = document.getElementById('roster-grid');
    grid.innerHTML = '';
    FighterTypes.forEach((ft) => {
        const card = document.createElement('div');
        card.className = 'fighter-card';
        card.dataset.fighter = ft.name;
        card.style.color = ft.color;
        const name = document.createElement('div');
        name.className = 'f-name';
        name.textContent = ft.name;
        const preview = document.createElement('canvas');
        preview.className = 'f-preview';
        preview.width = 140;
        preview.height = 96;
        preview.setAttribute('aria-label', `${ft.name} battle visual preview`);
        card.appendChild(name);
        card.appendChild(preview);
        card.onclick = () => selectFighter(ft, card);
        grid.appendChild(card);
    });
    renderRosterPreviews(true);
    ensureRosterPreviewLoop();
}
const SELECTED_FIGHTER_VFX = Object.freeze({
    ICE: '/assets/ui_2026/picked-ice.webp',
    STRING: '/assets/ui_2026/picked-string.webp',
    GALAXY: '/assets/ui_2026/picked-galaxy.webp',
    NOVA: '/assets/ui_2026/picked-galaxy.webp',
    SOCCER: '/assets/ui_2026/picked-soccer.webp',
    NINJA: '/assets/ui_2026/picked-ninja.webp',
    ENGINEER: '/assets/ui_2026/picked-engineer.webp',
    SHOTGUN: '/assets/shotgun_v1/picked.webp'
});
function syncSelectedFighterVfx() {
    [[1, p1Selection], [2, p2Selection]].forEach(([player, fighter]) => {
        const image = document.getElementById(`p${player}-fighter-vfx`);
        if (!image) return;
        const slot = image.closest('.picked-fighter-slot');
        if (slot) slot.dataset.fighter = fighter?.name || '';
        const source = fighter ? SELECTED_FIGHTER_VFX[fighter.name] : '';
        image.classList.toggle('has-fighter', Boolean(source));
        image.alt = fighter ? `Player ${player}: ${fighter.name}` : `Player ${player} fighter`;
        if (source) image.src = source;
        else image.removeAttribute('src');
    });
}
function selectFighter(ft, card) {
    if (!p1Selection) {
        p1Selection = ft;
        card.classList.add('selected-p1');
        document.getElementById('select-title').innerText = 'SELECT PLAYER 2';
        document.getElementById('select-title').style.color = '#ff776f';
    } else if (!p2Selection) {
        p2Selection = ft;
        card.classList.add('selected-p2');
        document.getElementById('start-btn').classList.remove('hidden');
        document.getElementById('select-title').innerText = 'READY TO FIGHT';
        document.getElementById('select-title').style.color = '#f3efe3';
    }
    syncSelectedFighterVfx();
}
function goToSelect() {
    stopBattleAudio();
    autoBattlePaused = false;
    autoBattleControlsActive = false;
    updateAutoBattleControls();
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.add('hidden');
    document.getElementById('tournament-screen').classList.add('hidden');
    document.getElementById('select-screen').classList.remove('hidden');
    document.getElementById('hud').style.opacity = 0;
    p1Selection = null; p2Selection = null;
    syncSelectedFighterVfx();
    gameState = 'SELECT';
    populateRoster();
    document.getElementById('start-btn').classList.add('hidden');
    document.getElementById('select-title').innerText = 'SELECT PLAYER 1';
    document.getElementById('select-title').style.color = '#7fd4ff';
}

function isPlainAutoBattleOptions(opts = {}) {
    return !opts.tournament && !opts.challenge && !opts.trial;
}
function parseAutoBattleHp(id) {
    const raw = String(document.getElementById(id)?.value || String(DEFAULT_MATCH_HP)).trim().toLowerCase();
    if (raw === 'inf' || raw === 'infinity' || raw === 'infinite' || raw === 'vo cuc' || raw === 'vô cực') {
        return { hp: AUTO_BATTLE_INF_HP, infinite: true };
    }
    const num = Number(raw.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(num)) return { hp: DEFAULT_MATCH_HP, infinite: false };
    return { hp: Math.max(100, num), infinite: false };
}
function parseAutoBattleDamage(id) {
    const raw = Number(document.getElementById(id)?.value || 100);
    return clamp(Number.isFinite(raw) ? raw : 100, 100, 1000) / 100;
}
function applyAutoBattleSettings() {
    const hp1 = parseAutoBattleHp('p1-hp-setting');
    const hp2 = parseAutoBattleHp('p2-hp-setting');
    const dmg1 = parseAutoBattleDamage('p1-dmg-setting');
    const dmg2 = parseAutoBattleDamage('p2-dmg-setting');
    const settings = [
        { fighter: fighters[0], hp: hp1, mult: dmg1 },
        { fighter: fighters[1], hp: hp2, mult: dmg2 }
    ];
    for (const entry of settings) {
        const f = entry.fighter;
        if (!f) continue;
        f.maxHp = entry.hp.hp;
        f.hp = entry.hp.hp;
        f.data.autoBattleInfiniteHp = entry.hp.infinite;
        f.data.autoBattleDamageMult = entry.mult;
    }
}
function updateAutoBattleControls() {
    const panel = document.getElementById('battle-controls');
    if (panel) panel.classList.toggle('hidden', !autoBattleControlsActive);
    const pause = document.getElementById('battle-pause-btn');
    if (pause) {
        pause.textContent = autoBattlePaused ? '>' : 'II';
        pause.setAttribute('aria-label', autoBattlePaused ? 'Resume' : 'Pause');
    }
    if (pause && !pause.__apexDirectPauseBound) {
        pause.__apexDirectPauseBound = true;
        pause.addEventListener('click', (event) => { event.stopImmediatePropagation(); toggleAutoBattlePause(); }, true);
    }
    const restart = panel && panel.querySelector('button:nth-child(2)');
    if (restart && !restart.__apexDirectRestartBound) {
        restart.__apexDirectRestartBound = true;
        restart.addEventListener('click', (event) => { event.stopImmediatePropagation(); restartAutoBattle(); }, true);
    }
    const exit = panel && panel.querySelector('button:nth-child(3)');
    if (exit && !exit.__apexDirectExitBound) {
        exit.__apexDirectExitBound = true;
        exit.addEventListener('click', (event) => { event.stopImmediatePropagation(); exitAutoBattle(); }, true);
    }
}
function toggleAutoBattlePause() {
    if (!autoBattleControlsActive || (gameState !== 'PLAYING' && gameState !== 'COUNTDOWN')) return;
    autoBattlePaused = !autoBattlePaused;
    updateAutoBattleControls();
}
function restartAutoBattle() {
    if (!autoBattleLastConfig) return;
    autoBattlePaused = false;
    const cfg = autoBattleLastConfig;
    startSpecificMatch(cfg.ft1, cfg.ft2, Object.assign({}, cfg.opts, { countdown:false, tournament:false, challenge:null, trial:false }));
}
function exitAutoBattle() {
    autoBattlePaused = false;
    autoBattleControlsActive = false;
    updateAutoBattleControls();
    goToMenu();
}
function clearNinjaVisualArtifacts() {
    const events = window.apexNinjaVisualEvents;
    if (Array.isArray(events)) events.length = 0;
    if (typeof window.stopNinjaAudio === 'function') window.stopNinjaAudio();
}
window.toggleAutoBattlePause = toggleAutoBattlePause;
window.restartAutoBattle = restartAutoBattle;
window.exitAutoBattle = exitAutoBattle;

function startMatch() {
    if (!p1Selection || !p2Selection) return;
    startSpecificMatch(p1Selection, p2Selection, { countdown:false, tournament:false });
}
function startSpecificMatch(ft1, ft2, opts = {}) {
    clearNinjaVisualArtifacts();
    currentChallenge = opts.challenge || null;
    document.getElementById('menu-screen')?.classList.add('hidden');
    document.getElementById('select-screen').classList.add('hidden');
    document.getElementById('tournament-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.add('hidden');
    document.getElementById('hud').style.opacity = 1;
    document.getElementById('tournament-return-btn')?.classList.add('hidden');
    document.getElementById('challenge-retry-btn')?.classList.add('hidden');
    fighters = [
        new Fighter(1, 200, GAME_SIZE/2, ft1),
        new Fighter(2, GAME_SIZE-200, GAME_SIZE/2, ft2)
    ];
    for (const f of fighters) {
        const angle = Math.random() * TAU;
        f.setDir(Math.cos(angle), Math.sin(angle));
    }
    autoBattlePaused = false;
    autoBattleControlsActive = isPlainAutoBattleOptions(opts);
    if (autoBattleControlsActive) {
        autoBattleLastConfig = { ft1, ft2, opts: Object.assign({}, opts) };
        applyAutoBattleSettings();
    }
    updateAutoBattleControls();
    document.getElementById('p1-name').innerText = fighters[0].name;
    document.getElementById('p1-name').style.color = fighters[0].color;
    document.getElementById('p2-name').innerText = fighters[1].name;
    document.getElementById('p2-name').style.color = fighters[1].color;
    document.getElementById('p1-hp').style.backgroundColor = fighters[0].color;
    document.getElementById('p2-hp').style.backgroundColor = fighters[1].color;
    projectiles = []; particles = []; floatingTexts = []; shockwaves = [];
    timeScale = 1.0; cameraZoom = 1.0; cameraShake = 0; hitStop = 0; calcOverlay = null; matchClock = 0; sawWallRage = { timer:0, owner:null, phase:0 };
    arenaFlash = {r:0,g:0,b:0,a:0};
    updateHUD();
    lastTime = performance.now();
    if (!reqId) reqId = requestAnimationFrame(loop);
    if (opts.countdown) {
        gameState = 'COUNTDOWN';
        const overlay = document.getElementById('countdown-overlay');
        const num = document.getElementById('countdown-num');
        const sub = document.getElementById('countdown-sub');
        overlay.style.display = 'flex';
        sub.innerText = currentChallenge ? `${currentChallenge.rule.title}: ${ft1.name} VS ${ft2.name}` : `${ft1.name} VS ${ft2.name}`;
        let n = 3; num.innerText = n;
        const tick = setInterval(() => {
            n--;
            if (n > 0) num.innerText = n;
            else if (n === 0) num.innerText = 'FIGHT';
            else {
                clearInterval(tick);
                overlay.style.display = 'none';
                matchStartTime = performance.now();
                lastTime = performance.now();
                gameState = 'PLAYING';
                if (typeof updateCombatInspector === 'function') updateCombatInspector(true);
            }
        }, 1000);
    } else {
        matchStartTime = performance.now();
        lastTime = performance.now();
        gameState = 'PLAYING';
        if (typeof updateCombatInspector === 'function') updateCombatInspector(true);
    }
    // Commit a visible battle frame before battle audio is allowed to resume.
    // This keeps slow match initialization from leaving an old menu overlay on screen
    // while combat sounds have already started.
    try {
        document.getElementById('game-canvas')?.getBoundingClientRect();
        draw();
    } catch (error) {}
    restoreBattleAudio();
}
function endMatch() {
    if (gameState !== 'PLAYING') return;
    gameState = 'END';
    autoBattlePaused = false;
    autoBattleControlsActive = false;
    updateAutoBattleControls();
    const winner = fighters[0].hp > fighters[1].hp ? fighters[0] : fighters[1];
    const loser = winner === fighters[0] ? fighters[1] : fighters[0];
    if (activeTournamentMatchId) completeTournamentMatch(winner, loser);
    playFighterSound(winner, 'skill');
    fadeBattleAudio(.95, false);
    document.getElementById('winner-text').innerText = `${winner.name} WINS`;
    document.getElementById('winner-text').style.color = winner.color;
    document.getElementById('stats-panel').innerHTML = buildChallengeSummary(winner, loser) + buildPostMatchStats(winner, loser);
    const tbtn = document.getElementById('tournament-return-btn');
    if (tbtn) tbtn.classList.toggle('hidden', !tournamentModeActive);
    const cbtn = document.getElementById('challenge-retry-btn');
    if (cbtn) cbtn.classList.toggle('hidden', !currentChallenge);
    setTimeout(() => {
        document.getElementById('end-screen').classList.remove('hidden');
        document.getElementById('hud').style.opacity = 0;
    }, 650);
}



// ===== MAJOR MECHANIC + VISUAL PATCH: PUPPET / 32F BALANCE =====
// Major mechanic visuals now load from /game/core/apexMajorMechanicVisuals.js.

// ===== SHOTGUN CHAMPION: hitscan pellets, breach, counter, magazine runtime =====
// Shotgun champion now loads from /game/fighters/shotgunRuntime.js.

// ===== ENGINEER CHAMPION: scrap economy, construction, match-3 merge =====
// Engineer champion now loads from /game/fighters/engineerRuntime.js.

// War Machine merge can temporarily stand in for ENGINEER as the directed-skill target.
// Engineer merge bridge now loads from /game/guards/apexEngineerMergeBridge.js.

// ===== SOCCER CHAMPION: possession, Goal Drive, Penalty, free ball, Chase Down =====
// Soccer champion now loads from /game/fighters/soccerChampionRuntime.js.

// ===== PRECISION FIX PATCH: requested targeted corrections =====
// Precision fixes now load from /game/core/apexPrecisionFixes.js.


// ===== FULL-ROSTER QA PATCH: simulation-derived runtime fixes + team-aware clone support =====
function createSlimeMucus(x, y, owner) {
    projectiles.push({ type: 'slime_mucus', owner, x, y, radius: 75, life: 5, maxLife: 5 });
}
// Full roster QA now loads from /game/core/apexFullRosterQa.js.


// ===== FREEZE / DISAPPEAR HOTFIX: PUPPET + SLIME + FLASH IMMUNITY =====
// Freeze disappear hotfix now loads from /game/guards/apexFreezeDisappearHotfix.js.


// ===== GLOBAL RUNTIME STABILITY GUARD: prevent random frame-freeze from draw/update exceptions =====
// Runtime stability guard now loads from /game/guards/apexRuntimeStability.js.


// ===== SLIME LIVE BODY CAP PATCH =====
// Slime body cap now loads from /game/guards/apexSlimeBodyCap.js.

// ===== FINAL CANONICAL IDENTITY + BALANCE MERGE PATCH =====
window.apexBeforeFinalPatch = true;
// Canonical balance now loads from /game/core/apexCanonicalBalance.js.



// ===== APEX CHAOS: ROSTER REPLACEMENT + NEW TIKTOK-READABLE KITS =====
// Roster extensions now load from /game/core/apexRosterExtensions.js.


ctx.fillStyle = "#11100e";
ctx.fillRect(0,0,GAME_SIZE,GAME_SIZE);

// ===== EXTERNAL FIGHTER TELEMETRY HUD: readable counters below arena =====
// Fight telemetry now loads from /game/core/apexFightTelemetry.js.

// ===== MUSICIAN VISUAL ASSET INTEGRATION: asset-only, no gameplay changes =====
// Musician visuals now load from /game/fighters/musicianVisualRuntime.js.

// ===== ARCADE VISUAL ASSET INTEGRATION: asset-only, no gameplay changes =====
// Arcade visuals now loads from /game/fighters/arcadeVisualRuntime.js.

// ===== PUPPET VISUAL ASSET INTEGRATION: asset bodies + dynamic voodoo rope =====
// Puppet visuals now loads from /game/fighters/puppetVisualRuntime.js.

// ===== BLADE VISUAL ASSET INTEGRATION: spinner/wave visuals only, no gameplay changes =====
// Blade visuals now load from /game/fighters/bladeVisualRuntime.js.

// ===== NINJA VISUAL INTEGRATION: asset-driven rendering only, gameplay untouched =====
// Ninja visuals now load from /game/fighters/ninjaVisualRuntime.js.

// ===== GLOBAL TEXT HYGIENE: visible text/font cleanup only, no gameplay changes =====
// Text hygiene now loads from /game/core/apexTextHygiene.js.

// ===== ICE VISUAL + RAGE INTEGRATION: asset-driven rendering and ICE AGE field =====
// Ice visual integration now loads from /game/fighters/iceVisualRuntime.js.

// ===== SOLO 1V1 LOCAL RESTORE: deploy keeps current manual mode while auto battle stays from latest standalone =====
// Solo mode now loads from /game/modes/soloRuntime.js.

// String champion now loads from /game/fighters/stringRuntime.js.

// ===== DAU THU MODE: single fighter test against non-lethal SAITAMA boss =====
// Trial mode now loads from /game/modes/trialRuntime.js.

// ===== GALAXY CHAMPION REPLACEMENT PATCH: NOVA -> GALAXY =====
// Galaxy core patches now load from /game/fighters/galaxyRuntime.js.

// ===== RESTORED STRING MAINLINE HARDENING: controls, settings, NINJA cleanup =====
// String hardening now loads from /game/fighters/stringHardeningRuntime.js.

// ===== GALAXY REFINEMENT PASS: facing, scale, planets, Divine, Impact, Bluehole =====
// Galaxy refinement now loads from /game/fighters/galaxyRefinementRuntime.js.

// ===== UTILITY FEATURES: sandbox controls, matchup stats, and match recorder =====
// Utility features now load from /game/core/apexUtilityFeatures.js.

// Keep SOCCER's state machine outside legacy update wrappers. The timestamp guard
// inside preUpdate makes this compatible with the original nested SOCCER wrapper.
// Soccer runtime extensions now load from /game/fighters/soccerRuntime.js.

// ===== GALAXY DIVINE STOP-MOTION FINAL GUARD =====
// Galaxy guards now load from /game/guards/apexGalaxyGuards.js.

// ===== ENGINEER LATE BINDER: keep ENGINEER active after all later runtime patches =====
// Engineer/Galaxy guards now load from /game/guards/apexEngineerGuards.js.

// ===== FINAL MATCH LIFECYCLE / AUDIO / HUD GUARD =====
// Final match runtime guard now loads from /game/guards/apexFinalMatchGuard.js.

// ===== TAM CHIEN / THREE-PHASE BATTLE: local offline mode controller =====
// Tam Chien mode now loads from /game/modes/tamChienRuntime.js.

// Keep screen state honest when a match starts after late runtime wrappers.
// Battle visibility guard now loads from /game/guards/apexBattleVisibilityGuard.js.

// SHOTGUN is registered early enough for every roster builder, then rebound here
// so later champion/runtime patches cannot bypass its VFX and stun-immunity clock.
// Shotgun late binder now loads from /game/guards/apexShotgunLateBinder.js.

// ===== KATANA CHAMPION: 48-frame sword rhythm, clone network, moon trap =====
// Katana champion runtime now loads from /game/fighters/katanaRuntime.js.

// ===== FANG V7: lunar/solar wolf hunt, frame-authoritative pounces =====
// Fang champion runtime now loads from /game/fighters/fangRuntime.js.

// ===== CHARACTER SELECT UI UPGRADE: framed runtime composition =====
// Character select UI upgrade now loads from /game/ui/apexCharacterSelectUi.js.

// ===== ISOLATED JSON PICK RUNTIME: absolute design-pixel renderer =====
// JSON character picker now loads from /game/ui/apexPickRuntime.js.

// Universal fighter pose locking now loads from /game/core/apexPoseLockRuntime.js.
