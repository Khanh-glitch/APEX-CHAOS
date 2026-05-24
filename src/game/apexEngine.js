window.apexEarlyErrors = [];
window.onerror = function(message, source, lineno, colno, error) {
    window.apexEarlyErrors.push({ message: String(message), lineno, colno, stack: error && error.stack });
};
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const GAME_SIZE = 1000;
const WALL_SKETCH = '#6c6557';

let lastTime = 0, reqId = null, gameState = 'MENU';
let timeScale = 1.0, hitStop = 0, cameraShake = 0, cameraZoom = 1.0;
let arenaFlash = { r: 0, g: 0, b: 0, a: 0 };
let fighters = [], particles = [], projectiles = [], floatingTexts = [], shockwaves = [];
let p1Selection = null, p2Selection = null;
let calcOverlay = null;
let tournamentSeeds = [];
let tournamentState = null;
let activeTournamentMatchId = null;
let pendingTournamentMatchId = null;
let tournamentModeActive = false;
let matchStartTime = 0;
let matchClock = 0;
let sawWallRage = { timer: 0, owner: null, phase: 0 };

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const TAU = Math.PI * 2;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (min, max) => Math.random() * (max - min) + min;
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const lerp = (a, b, t) => a + (b - a) * t;
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

const SOUND_ID = {
    RUBBER: { base: 150, wave: 'sine', bend: 2.25, noise: 0.06 },
    ICE: { base: 720, wave: 'triangle', bend: 0.48, noise: 0.03 },
    VAMPIRE: { base: 82, wave: 'sawtooth', bend: 0.62, noise: 0.05 },
    SPIDER: { base: 430, wave: 'square', bend: 1.35, noise: 0.025 },
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
function playNoise(duration, gainValue, filterFreq = 900, type = 'bandpass') {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(6, now);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    src.start(now); src.stop(now + duration);
}
function playTone(freq, endFreq, dur, wave, gainValue, when = 0) {
    const now = audioCtx.currentTime + when;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(Math.max(20, freq), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + dur);
}
function playFighterSound(fighterOrName, action = 'skill') {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const name = typeof fighterOrName === 'string' ? fighterOrName : fighterOrName.name;
    if (action === 'skill' && typeof fighterOrName !== 'string') recordSkill(fighterOrName);
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

class FloatingText {
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
        ctx.font = "900 33px 'Segoe UI'";
        ctx.textAlign = "center";
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#050505";
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}
function spawnDamageText(x, y, amount, isHeal = false) {
    if (!Number.isFinite(amount) || amount === 0) return;
    floatingTexts.push(new FloatingText(x, y, signedAmount(isHeal ? amount : -amount), isHeal ? "#44ff7a" : "#ff5950"));
}

class Particle {
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
}
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
    return Object.entries(labels || {}).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`${k}: ${v.toFixed(1)}`).join(' · ') || 'No damage labels yet';
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
        floatingTexts.push(new FloatingText(mirror.x, mirror.y - mirror.radius - 70, `MIRROR SWAP ×${mirrorPower}`, mirrorKind === 'whole' ? '#ffffff' : '#aeb6ba'));
        floatingTexts.push(new FloatingText(enemy.x, enemy.y - enemy.radius - 70, `SKILL LOST ×${enemyPower}`, enemyKind === 'whole' ? '#ffffff' : '#aeb6ba'));
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
    floatingTexts.push(new FloatingText(target.x, target.y - target.radius - 65, 'WEAK', '#ff3030'));
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
        `${duration.toFixed(1)}s — ${winner.name} survived with ${winner.hp.toFixed(1)} HP`,
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
        <div class="mvp-strip"><div class="mvp-chip"><b>BIGGEST HIT</b>${biggest.name} · ${(biggest.maxHit||0).toFixed(1)}</div><div class="mvp-chip"><b>DOT KING</b>${dotKing.name} · ${(dotKing.dotDamage||0).toFixed(1)}</div><div class="mvp-chip"><b>SKILL TEMPO</b>${skillKing.name} · ${skillKing.skillsUsed||0}</div></div>
        <div class="stats-grid">${card(fighters[0])}${card(fighters[1])}</div>
        <div class="timeline"><h4>KEY MOMENTS</h4>${topMoments.map(m=>`<div>${m}</div>`).join('')}</div>`;
}

class Fighter {
    constructor(id, x, y, typeClass) {
        this.id = id;
        this.x = x; this.y = y;
        this.type = typeClass;
        this.name = typeClass.name;
        this.color = typeClass.color;
        this.baseRadius = 75;
        this.radius = 75;
        this.maxHp = 100;
        this.hp = 100;
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
                    s.dartTick += dt;
                    const totalTicks = Math.max(1, Math.ceil((s.max || 2) / 0.3));
                    const tickDmg = s.dartTotal / totalTicks;
                    while (s.dartTick >= 0.3 && s.dartDone < s.dartTotal) {
                        s.dartTick -= 0.3;
                        const dmg = Math.min(tickDmg, s.dartTotal - s.dartDone);
                        s.dartDone += dmg;
                        this.takeDamage(dmg, s.source || null, 'ice-darts', true);
                        if (s.source) projectiles.push({type:'ice_dart', owner:s.source, x:s.source.x, y:s.source.y, targetId:this.id, life:.55, maxLife:.55});
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
            floatingTexts.push(new FloatingText(this.x, this.y - this.radius - 92, 'BLADE WEAK ×2', '#ff2a2a'));
        }
        if (this.hasStatus('weak') && source && source !== this && Math.random() < 0.5) {
            amount *= 3;
            label = (label || 'direct') + '-weak-crit';
            floatingTexts.push(new FloatingText(this.x, this.y - this.radius - 92, `WEAK CRIT ×3`, '#ff2a2a'));
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
        if (this.hp <= 50 && !this.isRage && !this.type.noRage) {
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
        const cap = overheal ? 140 : this.maxHp;
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

        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 16) this.trail.shift();

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
        if (this.trail.length > 1) {
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
            ctx.save();
            const t = Date.now()/240;
            ctx.strokeStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 18;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 14, 0, TAU);
            ctx.stroke();
            ctx.fillStyle = this.color;
            for (let i=0;i<10;i++) {
                const a = t + i*TAU/10;
                const rr = this.radius + 20 + 10*Math.sin(t*2+i);
                ctx.beginPath();
                ctx.moveTo(Math.cos(a)*rr, Math.sin(a)*rr);
                ctx.lineTo(Math.cos(a-.10)*(rr+28), Math.sin(a-.10)*(rr+28));
                ctx.lineTo(Math.cos(a+.10)*(rr+12), Math.sin(a+.10)*(rr+12));
                ctx.closePath();
                ctx.globalAlpha = .35;
                ctx.fill();
            }
            ctx.globalAlpha = this.hasStatus('immune') ? 0.55 : 1;
            ctx.restore();
        }

        if (this.type.draw) this.type.draw(ctx, this);
        else drawSketchBlob(ctx, this.radius, this.color, 14);

        if (this.hasStatus('freeze')) drawStatusRing(ctx, this.radius + 18, '#a6f4ff', 'FREEZE');
        if (this.hasStatus('stun')) drawStatusRing(ctx, this.radius + 22, '#fff36a', 'STUN');
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
        if (this.hasStatus('weak')) drawStatusRing(ctx, this.radius + 34, '#ff3030', 'WEAK');
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
}

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
    const labels = {BLADE:'BLADE WAVE', ICE:'ICE LANE', VAMPIRE:'BLOOD BITE', SPIDER:'WEB ANCHOR', VOLCANO:'METEOR', MAGNET:'MAGNET FIELD', FLASH:'FLASH DASH', ELECTRIC:'LIGHTNING', ORBIT:'SATELLITE', TOXIC:'ACID TRAIL', BLACK_HOLE:'GRAVITY WELL', SAW:'SAW SPIN', NOVA:'NOVA MINI', HUNTER:'HUNT MARK', CRYSTAL:'CRYSTAL WALL', VIRUS:'VIRUS SPAWN', DRUM:'DRUM WAVE', CARD:'CARD THROW', MATH:'MATH NUMBER', MATH_V2:'GRAPH WALL', SNIPER:'SNIPER SHOT'};
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
    else if (name === 'SPIDER') { projectiles.push({ type:'web_line', owner:f, x1:clamp(f.x+rand(-260,260),0,GAME_SIZE), y1:clamp(f.y+rand(-260,260),0,GAME_SIZE), x2:f.x, y2:f.y, hitCd:{}, life:6, maxLife:6 }); }
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
    else if (name === 'MATH') { const val=Math.random()<.5?-8:8; projectiles.push({type:'math_formula',owner:f,enemy:e,formula:'RUBBER ±8',value:val,rage:false,life:3,maxLife:3,phase:'typing',age:0,x:f.x,y:f.y,hit:false,launched:false,vx:0,vy:0}); }
    else if (name === 'MATH_V2') { spawnMathV2Graph(f, 'y = sin(πx)', 'sin'); }
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

const FighterTypes = [
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
        name: "SPIDER", color: "#2c1935", desc: "Living snare web network", speed: 505, startDx: 0.7, startDy: 1,
        init: f => {},
        speedModifier: f => f.isRage ? 1 + Math.max(0, (f.rageStartHp ?? f.hp) - f.hp) * 0.022 : 1,
        onWallBounce: (f, side) => { const anchor = { x: f.x, y: f.y }; if (side === 'left') anchor.x = 0; if (side === 'right') anchor.x = GAME_SIZE; if (side === 'top') anchor.y = 0; if (side === 'bottom') anchor.y = GAME_SIZE; projectiles.push({ type: 'web_line', owner: f, x1: anchor.x, y1: anchor.y, x2: f.x, y2: f.y, hitCd: {}, life: Infinity, maxLife: Infinity }); const webs = projectiles.filter(p => p.type === 'web_line' && p.owner === f); if (webs.length > 45) projectiles.splice(projectiles.indexOf(webs[0]), 1); playFighterSound(f, 'skill'); },
        draw: (ctx, f) => { for(let i=-2;i<=2;i++){ctx.strokeStyle='#080808';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-12,i*18);ctx.lineTo(-72,i*24-22);ctx.moveTo(-12,i*18);ctx.lineTo(-72,i*24+22);ctx.stroke();} ctx.fillStyle=f.color;ctx.strokeStyle='#050505';ctx.lineWidth=6;ctx.beginPath();ctx.ellipse(-10,0,60,48,0,0,TAU);ctx.fill();ctx.stroke();ctx.beginPath();ctx.ellipse(38,0,35,31,0,0,TAU);ctx.fill();ctx.stroke();ctx.strokeStyle='#ddd';ctx.lineWidth=2;for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(40,0,16+i*10,-0.8,0.8);ctx.stroke();} }
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
        draw: (ctx,f) => { const shards=[[[-55,-50],[8,-35],[-12,8],[-65,20]],[[10,-60],[62,-28],[35,12],[-8,-4]],[[-22,15],[24,0],[58,55],[-35,62]]]; for(const s of shards)drawPolygon(ctx,s,f.color,'#141414',4); ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-44,-28);ctx.lineTo(44,38);ctx.moveTo(35,-23);ctx.lineTo(-28,46);ctx.stroke(); if(f.data.stolenType){ctx.fillStyle='#fff';ctx.font='900 18px monospace';ctx.textAlign='center';ctx.fillText(`${f.data.stolenType.name} ×${f.data.stolenPower}`,0,88);} }
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
        draw: (ctx,f) => { drawPolygon(ctx,[[-52,-70],[52,-70],[66,50],[-40,68]],'#efe7d2','#20150d',5);ctx.fillStyle='#20150d';ctx.font='900 27px serif';ctx.textAlign='center';ctx.fillText('A♠',0,-10);ctx.fillText('CARD',0,25); const hand=f.data.hand||[]; const scale=f.data.phase==='show'?1.28:1.0; for(let i=0;i<hand.length;i++){ const x=(-64+i*64)*scale, y=-f.radius-(f.data.phase==='show'?96:62); drawPlayingCard(ctx, hand[i], x, y, scale, -0.18+i*.18); } if(f.data.phase==='show'){ctx.fillStyle='#ffe8a0';ctx.strokeStyle='#120a04';ctx.lineWidth=5;ctx.font='900 30px serif';ctx.textAlign='center';ctx.strokeText(String(f.data.lastDmg),0,-f.radius-16);ctx.fillText(String(f.data.lastDmg),0,-f.radius-16);} if(f.data.resolvePulse>0){ctx.strokeStyle='rgba(255,232,160,.9)';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,f.radius+24,0,TAU);ctx.stroke();} }
    },
    {
        name: "MATH", color: "#e4dcc9", desc: "Unspoiled moving number spell", speed: 430, startDx: 1, startDy: -0.8,
        init: f => { f.data.cd=5; },
        update: (f,e,dt) => { f.data.cd-=abilityDt(f,dt); if(f.data.cd<=0){ f.data.cd=5; let formula,result,isRageFormula=false; if(f.isRage){ const rage = makeRageMathExpression(); result=rage.result; formula=rage.formula; isRageFormula=true; } else { const X=Math.round(f.x/50),Y=Math.round(f.y/50),A=Math.round(e.x/50),B=Math.max(1,Math.round(e.y/50)); result=Math.round((X-Y)*A/B); if(result===0) result = (Math.random()<.5?-1:1); formula=`(${X}−${Y})×${A}/${B}`; } projectiles.push({type:'math_formula',owner:f,enemy:e,formula,value:result,rage:isRageFormula,life:4.2,maxLife:4.2,phase:'typing',age:0,x:f.x,y:f.y,hit:false,launched:false,vx:0,vy:0}); playFighterSound(f,'skill'); } },
        draw: (ctx,f) => { drawPolygon(ctx,[[-60,-55],[58,-48],[66,48],[-55,60]],f.color,'#171717',5);ctx.fillStyle='#171717';ctx.font='900 25px monospace';ctx.textAlign='center';ctx.fillText('∑',-20,-12);ctx.fillText('÷',22,-10);ctx.fillText('x:y',0,25); }
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
        draw: (ctx,f) => { drawPolygon(ctx,[[-62,-34],[-20,-62],[50,-44],[60,48],[-48,56]],'#3a1f14','#d7a34a',5);ctx.fillStyle='#14100c';ctx.fillRect(-44,-58,92,18);ctx.fillStyle='#d7a34a';ctx.font='900 18px serif';ctx.textAlign='center';ctx.fillText('☠',-4,-2);ctx.strokeStyle='#eee1bb';ctx.lineWidth=5;ctx.beginPath();ctx.arc(32,4,18,-.8,.8);ctx.stroke();ctx.strokeStyle='#8a6230';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-22,32);ctx.lineTo(-82,62);ctx.stroke();ctx.font='900 20px serif';ctx.fillText('⚓',-88,68); }
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
        draw: (ctx,f) => { drawPolygon(ctx,[[-46,-58],[46,-58],[62,40],[0,66],[-62,40]],'#3b2417','#ffd28a',5);ctx.strokeStyle='#ffd28a';ctx.lineWidth=9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-40,-5);ctx.lineTo(-86,-22);ctx.moveTo(40,-5);ctx.lineTo(86,-22);ctx.stroke();if(f.data.rushTimer>0){ctx.globalAlpha=.65;ctx.strokeStyle='#ff9b50';ctx.lineWidth=14;ctx.beginPath();ctx.arc(0,0,f.radius+28,0,TAU);ctx.stroke();ctx.globalAlpha=1;}ctx.fillStyle='#ffd28a';ctx.font='900 18px serif';ctx.textAlign='center';ctx.fillText('拳',0,8); if(f.data.combo>0){ctx.font='900 22px monospace';ctx.fillText('COMBO '+String(f.data.combo),0,-f.radius-16);} }
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
    const suits = ['♠','♥','♦','♣'];
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
    const red = c.suit === '♥' || c.suit === '♦';
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
function randomCard(){ const suits=['♠','♥','♦','♣']; const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K']; return {suit:suits[Math.floor(Math.random()*suits.length)], rank:ranks[Math.floor(Math.random()*ranks.length)]}; }
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
    return { result, formula: `⌊(((${a}×${b})−(${c}×${d}))+√${r*r}${adj})÷1⌋` };
}

function makeMathV2Function() {
    const options = [
        {label:'f(x)=sin(2πx)/2 + x²/3', fn:x=>Math.sin(2*Math.PI*x)*0.5 + x*x/3},
        {label:'f(x)=0.7sin(3πx)+0.2cos(5πx)', fn:x=>0.7*Math.sin(3*Math.PI*x)+0.2*Math.cos(5*Math.PI*x)},
        {label:'f(x)=x³−0.65x', fn:x=>x*x*x-0.65*x},
        {label:'f(x)=0.8cos(πx)sin(2πx)', fn:x=>0.8*Math.cos(Math.PI*x)*Math.sin(2*Math.PI*x)},
        {label:'f(x)=0.45tan(1.05x)', fn:x=>0.45*Math.tan(1.05*x)},
        {label:'f(x)=0.55sin(π/x*)', fn:x=>x===0?0:0.55*Math.sin(Math.PI/(Math.abs(x)+0.25))}
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
            if (target) { const n = norm(target.x-p.x, target.y-p.y); p.vx=n.x*900; p.vy=n.y*900; p.x += p.vx*dt; p.y += p.vy*dt; if(dist(p.x,p.y,target.x,target.y)<target.radius+14)p.life=0; }
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
                if (near && p.hitCd[enemy.id] <= 0) { enemy.takeDamage(0.75, owner, 'web'); p.hitCd[enemy.id] = owner && owner.isRage ? 0.5 : 0.68; enemy.data.webCuts = (enemy.data.webCuts || []).filter(t => performance.now()/1000 - t < 2); enemy.data.webCuts.push(performance.now()/1000); if(enemy.data.webCuts.length>=3){ const n=norm(owner.x-enemy.x,owner.y-enemy.y); enemy.applyStatus('slow',1.35,{mult:.52}); enemy.applyStatus('push',.18,{x:n.x,y:n.y,strength:540}); enemy.data.webCuts=[]; floatingTexts.push(new FloatingText(enemy.x,enemy.y-enemy.radius-58,'WEB SNARE','#d9ccff')); } playFighterSound(owner,'skill'); }
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
        if (p.type === 'pirate_anchor') { ctx.globalAlpha=.92; ctx.strokeStyle=p.triggered?'#ffe0a0':'#8a6230'; ctx.lineWidth=p.triggered?7:5; ctx.beginPath(); ctx.moveTo(p.x1,p.y1); ctx.lineTo(p.x2,p.y2); ctx.stroke(); ctx.fillStyle='#2d2a25'; ctx.strokeStyle='#d7a34a'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(p.x1,p.y1,18,0,TAU); ctx.fill(); ctx.stroke(); ctx.font='900 24px serif'; ctx.fillStyle='#d7a34a'; ctx.textAlign='center';ctx.fillText('⚓',p.x1,p.y1+9); }
        if (p.type === 'painter_stroke') { const a=p.life/p.maxLife; ctx.globalAlpha=.62*a; ctx.strokeStyle=p.color; ctx.lineWidth=(p.width||75)*2; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.beginPath(); ctx.moveTo(p.x1,p.y1); ctx.lineTo(p.x2,p.y2); ctx.stroke(); ctx.globalAlpha=.9*a; ctx.strokeStyle='#fff8d2'; ctx.lineWidth=4; ctx.setLineDash([10,10]); ctx.stroke(); ctx.setLineDash([]); }
        if (p.type === 'painter_blob') { ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=.92*(p.life/p.maxLife);ctx.fillStyle=p.color;ctx.strokeStyle='#fff8d2';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,p.radius,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#111';ctx.font='900 14px monospace';ctx.textAlign='center';ctx.fillText(p.kind==='red'?'R':p.kind==='blue'?'B':'G',0,5);ctx.restore(); }
        if (p.type === 'superfan') { ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#ff7bd6';ctx.strokeStyle='#2a0821';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,p.radius,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='900 10px sans-serif';ctx.textAlign='center';ctx.fillText('♡',0,4);ctx.restore(); }

        if (p.type === 'mirror_zone') { const a = p.life / p.maxLife; ctx.globalAlpha = .28 + .20*a; ctx.fillStyle = p.kind === 'whole' ? 'rgba(235,250,255,.28)' : 'rgba(160,160,170,.24)'; ctx.strokeStyle = p.kind === 'whole' ? '#ffffff' : '#9aa0a8'; ctx.lineWidth = p.kind === 'whole' ? 7 : 5; ctx.setLineDash(p.kind === 'broken' ? [18,12] : []); ctx.beginPath(); ctx.arc(p.x,p.y,p.radius,0,TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle='#fff'; ctx.font='900 22px monospace'; ctx.textAlign='center'; ctx.fillText(p.kind==='whole'?'WHOLE ×200%':'BROKEN ×50%',p.x,p.y); }
        if (p.type === 'red_slash') { ctx.translate(p.x,p.y); ctx.rotate(p.angle); ctx.globalAlpha=p.life/p.maxLife; ctx.strokeStyle='#ff2020'; ctx.lineWidth=14; ctx.beginPath(); ctx.moveTo(-95,-75); ctx.lineTo(95,75); ctx.stroke(); ctx.lineWidth=4; ctx.strokeStyle='#ffe0e0'; ctx.stroke(); }
        if (p.type === 'flash_super') { const a=p.life/p.maxLife; ctx.globalAlpha=.85*a; ctx.strokeStyle='#fff06b'; ctx.lineWidth=8; for(const line of p.lines||[]){ctx.beginPath();ctx.moveTo(line.a.x,line.a.y);ctx.lineTo(line.b.x,line.b.y);ctx.stroke();} }
        if (p.type === 'ice_dart') { ctx.translate(p.x,p.y); ctx.rotate(Math.atan2(p.vy||0,p.vx||1)); ctx.globalAlpha=p.life/p.maxLife; drawPolygon(ctx,[[-18,-6],[18,0],[-18,6],[-10,0]],'#d8ffff','#58c8d8',2); }
        if (p.type === 'kungfu_qi') { const a=clamp((p.life||1)/(p.maxLife||p.life||1),0,1); if (window) window.__kungfuCoreProjectileDrawCount=(window.__kungfuCoreProjectileDrawCount||0)+1; ctx.globalAlpha=.78*a; ctx.strokeStyle='#ffffff'; ctx.lineWidth=6; ctx.beginPath(); ctx.arc(p.x,p.y,14+(1-a)*58,0,TAU); ctx.stroke(); ctx.strokeStyle='#ffd28a'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(p.x,p.y,7+(1-a)*34,0,TAU); ctx.stroke(); }
        if (p.type === 'kungfu_palm') { const a=clamp((p.life||1)/(p.maxLife||p.life||1),0,1); if (window) window.__kungfuCoreProjectileDrawCount=(window.__kungfuCoreProjectileDrawCount||0)+1; ctx.translate(p.x,p.y); ctx.rotate(Math.atan2(p.vy||0,p.vx||1)); ctx.globalAlpha=.20+.25*a; ctx.fillStyle='rgba(255,210,138,.25)'; ctx.strokeStyle='rgba(255,210,138,.78)'; ctx.lineWidth=7; ctx.beginPath(); ctx.ellipse(0,0,235,132,0,0,TAU); ctx.fill(); ctx.stroke(); ctx.globalAlpha=.78*a; ctx.fillStyle='#ffe0a0'; ctx.font='900 40px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('掌',0,0); }
        if (p.type === 'kungfu_rage_seal') { const a=clamp((p.life||1)/(p.maxLife||p.life||1),0,1); if (window) window.__kungfuCoreProjectileDrawCount=(window.__kungfuCoreProjectileDrawCount||0)+1; ctx.globalAlpha=.88*a; ctx.strokeStyle='#ff9b50'; ctx.lineWidth=8; ctx.beginPath(); ctx.arc(p.x,p.y,76,0,TAU); ctx.stroke(); ctx.fillStyle='#ffdda8'; ctx.font='900 34px serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('封',p.x,p.y); }
        ctx.restore();
    }
}
function handleCollisions(dt) {
    const a=fighters[0], b=fighters[1]; if(!a||!b||a.hp<=0||b.hp<=0)return;
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
    matchClock += dt;
    if (sawWallRage.timer > 0) sawWallRage.timer = Math.max(0, sawWallRage.timer - dt);
    fighters[0].update(dt, fighters[1]); fighters[1].update(dt, fighters[0]); handleCollisions(dt); updateProjectiles(dt);
    for (let i=particles.length-1;i>=0;i--) { particles[i].update(dt); if(particles[i].life<=0)particles.splice(i,1); }
    for (let i=floatingTexts.length-1;i>=0;i--) { floatingTexts[i].update(dt); if(floatingTexts[i].life<=0)floatingTexts.splice(i,1); }
    for (let i=shockwaves.length-1;i>=0;i--) { const s=shockwaves[i]; s.r+=420*dt; s.alpha=Math.max(0,1-s.r/s.maxR); if(s.alpha<=0)shockwaves.splice(i,1); }
    if (arenaFlash.a > 0) arenaFlash.a=Math.max(0,arenaFlash.a-dt*1.6); if(cameraShake>0)cameraShake=Math.max(0,cameraShake-dt*22); cameraZoom=lerp(cameraZoom,1,dt*2);
    if (fighters[0].hp <= 0 || fighters[1].hp <= 0) endMatch();
}
function draw() {
    ctx.save(); const shakeX=rand(-cameraShake,cameraShake), shakeY=rand(-cameraShake,cameraShake); ctx.translate(GAME_SIZE/2+shakeX,GAME_SIZE/2+shakeY); ctx.scale(cameraZoom,cameraZoom); ctx.translate(-GAME_SIZE/2,-GAME_SIZE/2);
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
    ctx.restore();
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

function updateHUD() {
    if (!fighters[0] || !fighters[1]) return;
    for (let i=0; i<2; i++) {
        const f = fighters[i];
        const pct = clamp((f.hp / f.maxHp) * 100, 0, 140);
        document.getElementById(`p${i+1}-hp`).style.width = `${Math.min(100,pct)}%`;
        document.getElementById(`p${i+1}-hp-text`).innerText = `${f.hp.toFixed(1)} / ${f.maxHp}`;
        const rageEl=document.getElementById(`p${i+1}-rage`); rageEl.style.opacity = f.isRage ? 1 : 0; rageEl.style.display = f.isRage ? 'block' : 'none';
    }
}


function fighterGlyph(name) { const map={RUBBER:'●',ICE:'◆',VAMPIRE:'♰',SPIDER:'✣',VOLCANO:'▲',MAGNET:'∪',FLASH:'ϟ',ELECTRIC:'⚡',ORBIT:'☍',TOXIC:'☣',MIRROR:'◈',BLACK_HOLE:'●',SAW:'✺',BLADE:'☾',NOVA:'✹',HUNTER:'🗡',CRYSTAL:'◇',VIRUS:'✳',CARD:'♠',MATH:'∑',DRUM:'◉',MATH_V2:'ƒ',SNIPER:'⌖',SLIME:'◍',TIME:'◷',WOLF:'♞',WIND:'≈',WITCH:'♆',PIRATE:'☠',PAINTER:'▰',MONK:'拳',SUPERSTAR:'★'}; return map[name] || '◆'; }
function shuffle(list){ const arr=[...list]; for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
function fighterTypeByName(name){ return FighterTypes.find(f=>f.name===name) || null; }
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
    const result = match.winner ? `<div class="match-hint">Winner: <b style="color:${tournamentFighterStyle(match.winner)}">${match.winner}</b>${match.result&&match.result.duration?` · ${match.result.duration.toFixed(1)}s`:''}</div>` : ready ? `<div class="match-hint">Ấn để bắt đầu. 3 giây đếm ngược trước trận.</div>` : `<div class="match-hint">CHƯA MỞ KHÓA</div>`;
    const showName = (n)=> n || '???';
    return `<div class="match-card ${cls}" ${click}>
        <div class="match-title"><span>${match.branch==='F'?'GRAND FINAL':`R${match.round+1} · Cặp ${match.index+1}`}</span><span>${match.winner?'DONE':ready?'READY':'LOCKED'}</span></div>
        <div class="entrant ${match.winner===match.a?'winner':''}" style="color:${aColor}"><span class="dot" style="background:${aColor}"></span><span class="entrant-name">${showName(match.a)}</span></div>
        <div class="entrant ${match.winner===match.b?'winner':''}" style="color:${bColor}"><span class="dot" style="background:${bColor}"></span><span class="entrant-name">${showName(match.b)}</span></div>
        ${result}
    </div>`;
}
function renderTournamentRound(title, matches, isOuter=false){ return `<div class="round-col ${isOuter?'outer-round':''}"><h4>${title}${isOuter?' <span class="outer-badge">BẤM Ở ĐÂY</span>':''}</h4>${matches.map(renderTournamentMatchCard).join('')}</div>`; }
function renderTournamentBranch(name, branch){
    const titles=['Vòng ngoài cùng','Vòng 2','Bán kết nhánh','Chung kết nhánh'];
    return `<div class="tournament-section"><div class="tournament-section-title"><span>${name}</span><span style="font-size:.75rem;opacity:.78">Kéo ngang để xem toàn nhánh</span></div><div class="round-strip">${branch.rounds.map((r,i)=>renderTournamentRound(titles[i],r,i===0)).join('')}</div></div>`;
}
function tournamentReadyMatches(){ return tournamentAllMatches().filter(tournamentReady); }
function renderTournamentReadyPanel(){
    const ready = tournamentReadyMatches();
    if(!ready.length) return `<div class="tournament-section"><div class="tournament-section-title"><span>CẶP SẴN SÀNG</span></div><div class="match-hint">Chưa có cặp mở khóa. Hãy hoàn thành các trận đang hiển thị hoặc giải đấu đã hoàn tất.</div></div>`;
    const cards = ready.map(m=>{
        const ac=tournamentFighterStyle(m.a), bc=tournamentFighterStyle(m.b);
        return `<div class="ready-card" onclick="startTournamentMatch('${m.id}')">
            <div class="ready-title"><span>${m.branch==='F'?'GRAND FINAL':`NHÁNH ${m.branch} · ${m.round===0?'VÒNG NGOÀI':`VÒNG ${m.round+1}`} · CẶP ${m.index+1}`}</span><span>PLAY</span></div>
            <div class="ready-vs"><span style="color:${ac}">${fighterGlyph(m.a)} ${m.a}</span><span class="vs">VS</span><span style="color:${bc};text-align:right">${m.b} ${fighterGlyph(m.b)}</span></div>
        </div>`;
    }).join('');
    return `<div class="tournament-section"><div class="tournament-section-title"><span>CẶP SẴN SÀNG ĐỂ ĐẤU</span><span style="font-size:.75rem;opacity:.78">Bấm card lớn này nếu vòng ngoài cùng khó nhìn</span></div><div class="ready-grid">${cards}</div></div>`;
}
function buildTournamentSummary(){
    const st=tournamentState; if(!st) return '';
    const played = st.log.length;
    const fastest = st.log.length ? st.log.reduce((a,b)=>(a.result.duration||9999)<(b.result.duration||9999)?a:b) : null;
    const biggest = st.log.length ? st.log.reduce((a,b)=>(a.result.biggest||0)>(b.result.biggest||0)?a:b) : null;
    const topDmg = st.log.length ? st.log.reduce((a,b)=>(a.result.winnerDamage||0)>(b.result.winnerDamage||0)?a:b) : null;
    const champion = st.champion;
    const stats = `<div class="tournament-summary">
        <div class="tour-stat"><b>${played}</b><span>Trận đã đấu</span></div>
        <div class="tour-stat"><b>${fastest?fastest.result.duration.toFixed(1)+'s':'-'}</b><span>Trận nhanh nhất</span></div>
        <div class="tour-stat"><b>${biggest?biggest.result.biggest.toFixed(1):'-'}</b><span>Biggest hit</span></div>
        <div class="tour-stat"><b>${topDmg?topDmg.result.winnerDamage.toFixed(1):'-'}</b><span>Winner damage cao nhất</span></div>
    </div>`;
    const log = st.log.slice(-6).reverse().map(x=>`<div class="match-hint"><b style="color:${tournamentFighterStyle(x.winner)}">${x.winner}</b> thắng ${x.loser} · ${x.result.duration.toFixed(1)}s · ${x.result.winnerHp.toFixed(1)} HP</div>`).join('');
    const banner = champion ? `<div class="champion-banner"><h2 style="color:${tournamentFighterStyle(champion)}">🏆 ${champion} VÔ ĐỊCH</h2><div>Giải đấu hoàn tất. Tổng kết được lưu trong bảng dưới.</div></div>` : '';
    return `${banner}${stats}<div class="timeline"><h4>NHẬT KÝ GIẢI ĐẤU</h4>${log || '<div>Chưa có trận nào. Hãy ấn vào một cặp READY để bắt đầu.</div>'}</div>`;
}
function renderTournament(){
    const board=document.getElementById('tournament-board');
    if(!board) return;
    if(!tournamentState) tournamentState = createTournamentState();
    board.classList.add('full');
    board.innerHTML = `${renderTournamentReadyPanel()}${renderTournamentBranch('NHÁNH A', tournamentState.branches.A)}${renderTournamentBranch('NHÁNH B', tournamentState.branches.B)}<div class="tournament-section"><div class="tournament-section-title"><span>CHUNG KẾT TỔNG</span></div><div class="round-strip final-strip">${renderTournamentRound('Grand Final',[tournamentState.final])}</div>${buildTournamentSummary()}</div>`;
}
function goToMenu(){ document.getElementById('select-screen').classList.add('hidden'); document.getElementById('end-screen').classList.add('hidden'); document.getElementById('tournament-screen').classList.add('hidden'); document.getElementById('menu-screen').classList.remove('hidden'); document.getElementById('hud').style.opacity = 0; tournamentModeActive=false; gameState='MENU'; }
function goToTournament(){ document.getElementById('menu-screen').classList.add('hidden'); document.getElementById('select-screen').classList.add('hidden'); document.getElementById('end-screen').classList.add('hidden'); document.getElementById('tournament-screen').classList.remove('hidden'); document.getElementById('hud').style.opacity = 0; gameState='TOURNAMENT'; tournamentModeActive=true; renderTournament(); }
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
function populateRoster() {
    const grid = document.getElementById('roster-grid');
    grid.innerHTML = '';
    FighterTypes.forEach((ft) => {
        const card = document.createElement('div');
        card.className = 'fighter-card';
        card.style.color = ft.color;
        card.innerHTML = `<div class="f-name">${ft.name}</div><div class="f-icon">${fighterGlyph(ft.name)}</div>`;
        card.onclick = () => selectFighter(ft, card);
        grid.appendChild(card);
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
        document.getElementById('select-title').innerText = 'READY TO ENGAGE';
        document.getElementById('select-title').style.color = '#f3efe3';
    }
}
function goToSelect() {
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.add('hidden');
    document.getElementById('tournament-screen').classList.add('hidden');
    document.getElementById('select-screen').classList.remove('hidden');
    document.getElementById('hud').style.opacity = 0;
    p1Selection = null; p2Selection = null;
    gameState = 'SELECT';
    populateRoster();
    document.getElementById('start-btn').classList.add('hidden');
    document.getElementById('select-title').innerText = 'SELECT PLAYER 1';
    document.getElementById('select-title').style.color = '#7fd4ff';
}

function startMatch() {
    if (!p1Selection || !p2Selection) return;
    startSpecificMatch(p1Selection, p2Selection, { countdown:false, tournament:false });
}
function startSpecificMatch(ft1, ft2, opts = {}) {
    document.getElementById('select-screen').classList.add('hidden');
    document.getElementById('tournament-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.add('hidden');
    document.getElementById('hud').style.opacity = 1;
    document.getElementById('tournament-return-btn')?.classList.add('hidden');
    fighters = [
        new Fighter(1, 200, GAME_SIZE/2, ft1),
        new Fighter(2, GAME_SIZE-200, GAME_SIZE/2, ft2)
    ];
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
        sub.innerText = `${ft1.name} VS ${ft2.name}`;
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
            }
        }, 1000);
    } else {
        matchStartTime = performance.now();
        lastTime = performance.now();
        gameState = 'PLAYING';
    }
}
function endMatch() {
    if (gameState !== 'PLAYING') return;
    gameState = 'END';
    const winner = fighters[0].hp > fighters[1].hp ? fighters[0] : fighters[1];
    const loser = winner === fighters[0] ? fighters[1] : fighters[0];
    if (activeTournamentMatchId) completeTournamentMatch(winner, loser);
    playFighterSound(winner, 'skill');
    document.getElementById('winner-text').innerText = `${winner.name} WINS`;
    document.getElementById('winner-text').style.color = winner.color;
    document.getElementById('stats-panel').innerHTML = buildPostMatchStats(winner, loser);
    const tbtn = document.getElementById('tournament-return-btn');
    if (tbtn) tbtn.classList.toggle('hidden', !tournamentModeActive);
    setTimeout(() => {
        document.getElementById('end-screen').classList.remove('hidden');
        document.getElementById('hud').style.opacity = 0;
    }, 650);
}

window.apexReactBridge = window.apexReactBridge || {};
Object.assign(window.apexReactBridge, {
    goToMenu,
    goToTournament,
    startTournamentMatch,
    returnToTournament,
    goToSelect,
    startMatch,
    startSpecificMatch,
});
Object.assign(window, window.apexReactBridge);



// ===== MAJOR MECHANIC + VISUAL PATCH: PUPPET / 32F BALANCE =====
(function majorMechanicVisualPatch(){
    const FT = name => FighterTypes.find(f => f.name === name);
    const getEnemy = f => fighters.find(x => x && f && x.id !== f.id);

    function note(x,y,t,c){ floatingTexts.push(new FloatingText(x,y,t,c)); }
    function getFt(name){ return FT(name); }

    // Utility: store per-fighter UI tags for learned / copied skills.
    function addSkillBadge(f, label, color){ f.data.skillBadge = {label, color: color || f.color, pulse: .8}; }

    // RUBBER: permanent sub-skill must be visible and cast like a real second skill.
    const rubber = FT('RUBBER');
    if (rubber) {
        const oldUpdate = rubber.update;
        const oldDraw = rubber.draw;
        rubber.update = function(f,e,dt){
            oldUpdate(f,e,dt);
            f.data.subData ||= {cd:2.5};
            f.data.subData.cd = Math.max(0,(f.data.subData.cd||0)-abilityDt(f,dt));
            if (f.data.subSkill && f.data.afterTier>=5 && f.data.subData.cd<=0 && e) {
                const sub = f.data.subSkill.name || String(f.data.subSkill);
                castRubberSubSkill(f,e,sub);
                f.data.subData.cd = rubberSubCooldown(sub);
                addSkillBadge(f, `SUB: ${sub}`, '#ffb6d2');
            }
        };
        rubber.draw = function(ctx,f){
            if (oldDraw) oldDraw(ctx,f);
            if (f.data.subSkill) {
                ctx.save(); ctx.rotate(-Math.atan2(f.dir.y,f.dir.x));
                const sub = f.data.subSkill.name || String(f.data.subSkill);
                ctx.fillStyle='rgba(0,0,0,.78)'; ctx.strokeStyle='#ffb6d2'; ctx.lineWidth=4;
                ctx.fillRect(-74,-f.radius-72,148,28); ctx.strokeRect(-74,-f.radius-72,148,28);
                ctx.fillStyle='#ffd5e8'; ctx.font='900 12px monospace'; ctx.textAlign='center';
                ctx.fillText(`${sub} CD:${(f.data.subData?.cd||0).toFixed(1)}`.slice(0,18),0,-f.radius-52);
                ctx.restore();
            }
        };
    }
    function rubberSubCooldown(sub){
        if (['BLADE','FLASH','HUNTER','SAW'].includes(sub)) return 3.2;
        if (['VOLCANO','BLACK_HOLE','CRYSTAL','MATH','MATH_V2','SNIPER'].includes(sub)) return 6.5;
        return 4.6;
    }
    function castRubberSubSkill(f,e,sub){
        const pow=.65; recordSkill(f); playFighterSound(f,'skill');
        note(f.x,f.y-f.radius-92,`RUBBER USES ${sub}`,'#ffb6d2');
        if(sub==='BLADE'){ const n=norm(e.x-f.x,e.y-f.y); projectiles.push({type:'blade_wave',owner:f,x:f.x,y:f.y,vx:n.x*950,vy:n.y*950,life:1.3,maxLife:1.3,damage:2.4,halfWidth:110,bounces:1,hitIds:{},rubberSub:true}); }
        else if(sub==='TOXIC'){ projectiles.push({type:'toxic_puddle',owner:f,x:e.x,y:e.y,radius:66,life:2.5,maxLife:2.5}); }
        else if(sub==='ICE'){ const n=norm(e.x-f.x,e.y-f.y); projectiles.push({type:'ice_lane',owner:f,x1:f.x,y1:f.y,x2:f.x+n.x*1000,y2:f.y+n.y*1000,halfWidth:120,life:3,maxLife:3,hitCd:{},rubberSub:true}); }
        else if(sub==='VOLCANO'){ projectiles.push({type:'meteor',owner:f,x:e.x+rand(-80,80),y:e.y+rand(-80,80),radius:75,delay:.25,life:.6,hit:false,volcanoAmp:1.7,rubberSub:true}); }
        else if(sub==='BLACK_HOLE'){ projectiles.push({type:'gravity_well',owner:f,x:e.x,y:e.y,life:1.8,maxLife:1.8,core:85,radius:170,absorbedDamage:0,rubberSub:true}); }
        else if(sub==='SNIPER'){ const dmg=clamp(dist(f.x,f.y,e.x,e.y)/1000*20,2,20); e.takeDamage(dmg,f,'rubber-sniper'); projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.22,maxLife:.22}); }
        else if(sub==='MATH'){ const val=Math.ceil(rand(5,18)); if(Math.random()<.5) e.takeDamage(val,f,'rubber-math'); else f.heal(val,false); projectiles.push({type:'math_formula',owner:f,enemy:e,x:f.x,y:f.y,value:Math.random()<.5?-val:val,life:.65,maxLife:.65,rubberSub:true}); }
        else { e.takeDamage(4*pow,f,'rubber-sub-'+sub.toLowerCase()); spawnShockwave(e.x,e.y,f.color,100); }
    }

    // VAMPIRE: front-half bite check + speed nerf.
    const vamp = FT('VAMPIRE');
    if (vamp) {
        vamp.speed = 500;
        vamp.onCollide = function(f,e){
            if((f.data.latchCd||0)>0 || f.data.latchTimer>0) return false;
            const toEnemy = norm(e.x-f.x, e.y-f.y);
            const faceDot = dot(toEnemy.x,toEnemy.y,f.dir.x,f.dir.y);
            if (faceDot < 0.1) { note(f.x,f.y-f.radius-60,'MISS BITE','#bb2038'); return false; }
            f.data.latchTimer=5; f.data.latchTargetId=e.id; f.data.latchCd=7.2; f.data.latchOffset={x:f.x-e.x,y:f.y-e.y};
            if(f.isRage) f.data.bloodLinkLevel=(f.data.bloodLinkLevel||0)+1;
            playFighterSound(f,'skill'); note(f.x,f.y-f.radius-76,'FANG LOCK','#e43d57'); return true;
        };
    }

    // MAGNET: normal field blocks projectiles only; Rage field performs hard wall slam.
    const magnet = FT('MAGNET');
    if (magnet) {
        magnet.update = function(f,e,dt){
            f.data.cd -= abilityDt(f,dt);
            if(f.data.cd<=0){ f.data.cd=6.6; f.data.fieldTimer=3.1; projectiles.push({type:'magnet_field',owner:f,radius:310,life:3.1,maxLife:3.1,hitCd:{},inside:{},slamCd:0,normalOnly:!f.isRage}); playFighterSound(f,'skill'); }
            if(f.data.fieldTimer>0){ f.data.fieldTimer-=dt; }
        };
    }

    // ELECTRIC Rage comeback: timed discharge and 50% lifesteal.
    const electric = FT('ELECTRIC');
    if (electric) {
        electric.noRage = false;
        electric.onRage = f => { f.data.rageTimer=0; f.data.ragePulse=5; f.data.rageContactCharge=0; note(f.x,f.y-f.radius-100,'OVERCHARGE RAGE','#bde5ff'); };
        const oldUpdate = electric.update;
        const oldCollide = electric.onCollide;
        electric.update = function(f,e,dt){
            if(oldUpdate) oldUpdate(f,e,dt);
            if(f.isRage){
                f.data.rageContactCd=Math.max(0,(f.data.rageContactCd||0)-dt);
                f.data.ragePulse = (f.data.ragePulse||5) - dt;
                if(f.data.ragePulse<=0 && e){
                    f.data.ragePulse=5;
                    const charge=clamp(Math.max(1,(f.data.wallHits||0)+(f.data.rageContactCharge||0)+1),1,8);
                    const lost=f.maxHp-f.hp;
                    const raw=0.002*(lost+10)*Math.pow(2,charge);
                    const dmg = raw<=60?raw:60+(raw-60)*0.25;
                    electricDischargeVisual(f,e,charge);
                    e.takeDamage(dmg,f,'electric-rage-overcharge');
                    f.heal(dmg*.5,false);
                    f.data.wallHits=0; f.data.wallNodes=[]; f.data.rageContactCharge=0;
                    note(f.x,f.y-f.radius-104,`RAGE ZAP +${(dmg*.5).toFixed(1)}`,'#bde5ff');
                }
            }
        };
        electric.onCollide = function(f,e){ if(f.isRage){ if((f.data.rageContactCd||0)<=0){ f.data.rageContactCharge=(f.data.rageContactCharge||0)+1; f.data.rageContactCd=.45; note(e.x,e.y-e.radius-76,`CONTACT CHARGE ${f.data.rageContactCharge}`,'#bde5ff'); } return false; } return oldCollide ? oldCollide(f,e) : false; };
    }
    function electricDischargeVisual(f,e,charge){
        const nodes = (f.data.wallNodes||[]).slice(-18);
        if(!nodes.length) nodes.push({x:f.x,y:f.y});
        nodes.forEach(n => projectiles.push({type:'electric_trail',owner:f,x1:n.x,y1:n.y,x2:e.x,y2:e.y,life:.35,maxLife:.35,charge}));
        spawnShockwave(e.x,e.y,'#75cfff',160+charge*8); playFighterSound(f,'skill');
    }

    // TOXIC: make charge heal obvious and reliable.
    const oldStartToxicCharge = startToxicCharge;
    startToxicCharge = function(source,target){ oldStartToxicCharge(source,target); if(source&&source.data&&source.data.toxicCharge) source.data.toxicCharge.visible=true; };

    // BLACK HOLE Rage: base explosion + x2 absorbed damage.
    function blackHoleExplode(p, enemy){
        if(!p || p.exploded) return; p.exploded=true; const owner=p.owner;
        if(enemy){ const d=dist(enemy.x,enemy.y,p.x,p.y); const base=d<=200?lerp(20,5,clamp(d/200,0,1)):0; const refl=(p.absorbedDamage||0)*2; const dmg=base+refl; if(dmg>0) enemy.takeDamage(dmg,owner,refl>0?'black-hole-rage-explosion':'black-hole-explosion'); }
        spawnShockwave(p.x,p.y,'#201020',280+(p.absorbedDamage||0)*3); triggerFlash(0,0,0,.45);
    }

    // HUNTER: clear crit and +200% chase speed when enemy weak.
    const hunter=FT('HUNTER');
    if(hunter){ hunter.speedModifier = (f,e) => (e && e.hasStatus && e.hasStatus('weak')) ? 3.0 : (f.data.huntTimer>0?1.65:1); }

    // DRUM: solo is 80% damage reduction via takeDamage above, remove total immunity in update if any.
    const drum=FT('DRUM');
    if(drum){ const od=drum.update; drum.update=function(f,e,dt){ od(f,e,dt); if(f.data.rageSolo>0 && f.statuses.immune) f.statuses.immune.timer=0; }; }

    // CARD: add Jokers in Rage deck and ensure values.
    const oldMakeDeck = makeDeck;
    makeDeck = function(){ const deck=oldMakeDeck(); return deck; };
    const oldCardRageDamage = cardRageDamage;
    cardRageDamage = function(hand, owner, enemy){
        let total=0;
        for(const c of hand){ if(c.rank==='RJ') total += Math.ceil((owner.maxHp-owner.hp)*.5); else if(c.rank==='BJ') total += Math.ceil(enemy.hp*.5); else if(c.rank==='A') total+=1; else if(['J','Q','K','10'].includes(c.rank)) total+=10; else total += parseInt(c.rank)||0; }
        return Math.min(99,total);
    };
    const card=FT('CARD');
    if(card){ const oc=card.update; card.update=function(f,e,dt){
        // Inject 2 jokers into deck only while Rage, if not already present.
        f.data.deck ||= makeDeck();
        if(f.isRage && !f.data.jokersInjected){ f.data.deck.push({rank:'RJ',suit:'★'},{rank:'BJ',suit:'☆'}); f.data.jokersInjected=true; note(f.x,f.y-f.radius-90,'JOKERS IN DECK','#fff2a0'); }
        oc(f,e,dt);
    }; }

    // MATH Rage distribution: triangular toward zero, no zero.
    makeRageMathExpression = function(){
        let mag = Math.max(1, Math.ceil(100 * Math.pow(Math.random(), 2.15)));
        const sign = Math.random()<.5?-1:1;
        const result = sign * mag;
        const a = Math.ceil(rand(3,19)), b=Math.ceil(rand(2,12)), c=Math.ceil(rand(1,9));
        return { expr:`⌊(( ${a}² − ${b}×${c} ) ± chaos)⌋ = ${result}`, result };
    };

    // MATH V2 graph hand-draw progress.
    const oldSpawnMathV2Graph = spawnMathV2Graph;
    spawnMathV2Graph = function(owner, expr){ oldSpawnMathV2Graph(owner, expr); const g=projectiles.findLast?projectiles.findLast(p=>p.type==='math_v2_graph'&&p.owner===owner):[...projectiles].reverse().find(p=>p.type==='math_v2_graph'&&p.owner===owner); if(g){g.drawProgress=0;g.handDraw=true;} };

    // SNIPER: reverse recoil after shot; Rage hidden reload immune, vulnerable only while aiming; relocate resets aim.
    const sniper=FT('SNIPER');
    if(sniper){
        sniper.update=function(f,e,dt){
            f.data.cd-=abilityDt(f,dt);
            if(f.data.recoilTimer>0){ f.data.recoilTimer-=dt; f.applyStatus('speed',.1,{mult:1.8}); }
            if(f.isRage){
                f.data.reload=(f.data.reload||0)-dt;
                if(f.data.reload>0){ f.applyStatus('immune',.1,{source:f}); f.data.hiddenReload=true; return; }
                f.data.hiddenReload=false;
                f.data.aim=(f.data.aim||3)-dt;
                f.data.aiming=true;
                if(e && dist(f.x,f.y,e.x,e.y)<300 && f.data.aim>0.2){ relocateSniper(f,e); f.data.reload=3; f.data.aim=3; return; }
                if(f.data.aim<=0){ sniperShoot(f,e,true); f.data.reload=3; f.data.aim=3; }
            } else if(f.data.cd<=0){ f.data.cd=8; sniperShoot(f,e,false); }
        };
        sniper.draw=function(ctx,f){ drawPolygon(ctx,[[-70,-35],[20,-52],[58,-18],[60,32],[-46,54]],'#24282d','#a7adb5',5);ctx.fillStyle='#111';ctx.fillRect(10,-12,82,18);ctx.strokeStyle='#d6d6d6';ctx.lineWidth=4;ctx.strokeRect(12,-14,40,22);ctx.fillStyle='#d7dde5';ctx.font='900 13px monospace';ctx.textAlign='center';ctx.fillText(f.data.hiddenReload?'HIDDEN':'SNIPER',-10,8); };
    }
    function relocateSniper(f,e){ const holes=[[110,110],[890,110],[110,890],[890,890]]; holes.sort((a,b)=>dist(b[0],b[1],e.x,e.y)-dist(a[0],a[1],e.x,e.y)); f.x=holes[0][0]; f.y=holes[0][1]; note(f.x,f.y-f.radius-70,'RELOCATE','#ff5555'); }
    function sniperShoot(f,e,rage){ const d=dist(f.x,f.y,e.x,e.y); const dmg=clamp(d/1300*30,0,30); projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45}); e.takeDamage(dmg,f,rage?'rage-sniper-shot':'sniper-shot'); const n=norm(f.x-e.x,f.y-e.y); f.setDir(n.x,n.y); f.data.recoilTimer=.8; playFighterSound(f,'skill'); }

    // SLIME rework counters and clones.
    const slime=FT('SLIME');
    if(slime){
        slime.init=function(f){ f.data.splitCd=0; f.data.childCounter=[]; f.data.shockCounter=[]; f.data.gelArmorTimer=0; f.data.cloneDepth=f.data.cloneDepth||0; };
        slime.update=function(f,e,dt){
            f.data.splitCd=Math.max(0,(f.data.splitCd||0)-dt); f.data.gelArmorTimer=Math.max(0,(f.data.gelArmorTimer||0)-dt); if(f.data.gelArmorTimer<=0)f.data.gelArmorReduction=0;
            f.data.childCounter=(f.data.childCounter||[]).filter(x=>matchClock-x.t<=5); f.data.shockCounter=(f.data.shockCounter||[]).filter(x=>matchClock-x.t<=1);
            const csum=f.data.childCounter.reduce((a,b)=>a+b.amount,0);
            if(csum>=4 && f.data.splitCd<=0){ addSlimeChild(f, Math.random()*TAU, 8, 4); f.data.childCounter=[]; f.data.splitCd=.65; note(f.x,f.y-f.radius-80,'+ SLIME CHILD','#caffbb'); }
            const ssum=f.data.shockCounter.reduce((a,b)=>a+b.amount,0);
            if(ssum>f.hp*.20 && f.data.cloneDepth<3){ splitSlimeClone(f); f.data.shockCounter=[]; }
            if(f.isRage && f.data.gelArmorTimer>0) f.data.gelArmorReduction=Math.max(f.data.gelArmorReduction||0,.3);
        };
    }
    function splitSlimeClone(f){ const hp=Math.max(10,f.hp); f.hp=hp; const ft=FT('SLIME'); for(let i=0;i<2;i++){ f.teamId=f.teamId||f.id; const c=new Fighter(f.id,clamp(f.x+rand(-80,80),80,920),clamp(f.y+rand(-80,80),80,920),ft); c.teamId=f.teamId; c.hp=hp; c.data.cloneDepth=(f.data.cloneDepth||0)+1; c.dir=norm(rand(-1,1),rand(-1,1)); fighters.push(c); const kids=projectiles.filter(p=>p.type==='slime_child'&&p.owner===f&&p.hp>0); kids.forEach(k=>addSlimeChild(c,Math.random()*TAU,Math.max(1,k.hp*.5),Math.max(.5,(k.damage||4)*.5))); } note(f.x,f.y-f.radius-110,'MITOSIS!', '#caffbb'); spawnShockwave(f.x,f.y,'#7be66f',220); }
    function createSlimeMucus(x,y,owner){ projectiles.push({type:'slime_mucus',owner,x,y,radius:75,life:5,maxLife:5}); }

    // TIME buff: opponent only recovers 50% of Time damage during mark, clock flash number.
    const time=FT('TIME');
    if(time){
        time.update=function(f,e,dt){
            f.data.clockCd=(f.data.clockCd||0)-dt; if(f.data.clockCd<=0){ f.data.clockCd=4; const val=clockDamageValue(); e.takeDamage(val,f,'clock-strike'); projectiles.push({type:'clock_flash',owner:f,num:val,life:.9,maxLife:.9}); note(e.x,e.y-e.radius-100,`CLOCK ${val}`,'#d6d0ff'); }
            f.data.markCd-=abilityDt(f,dt); if(!f.data.mark&&f.data.markCd<=0){ f.data.markCd=9; f.data.mark={x:f.x,y:f.y,hp:f.hp,timer:3,dealt:0,received:0}; projectiles.push({type:'time_mark',owner:f,x:f.x,y:f.y,life:3,maxLife:3}); note(f.x,f.y-f.radius-80,'TIME MARK','#d6d0ff'); }
            if(f.data.mark){ const m=f.data.mark; m.timer-=dt; if(m.timer<=0){ f.x=m.x; f.y=m.y; f.hp=Math.max(f.hp,m.hp); if(e&&m.dealt>0) e.heal(m.dealt*.5,false); if(f.isRage&&m.received>0) spawnTimeRift(f,m.received); f.data.mark=null; spawnShockwave(f.x,f.y,'#d6d0ff',200); } }
        };
    }

    // WOLF: normal scent fixed; Rage scales +5 radius per target lost HP. Visible pounce, no sticking.
    const wolf=FT('WOLF');
    if(wolf){
        wolf.update=function(f,e,dt){ f.data.scentCd-=abilityDt(f,dt); f.data.biteCd=Math.max(0,(f.data.biteCd||0)-dt); if(f.data.pounceTimer>0){ f.data.pounceTimer-=dt; f.applyStatus('speed',.1,{mult:2.4}); if(f.data.pounceTimer<=0){f.data.afterBiteBounce=.5;} } if(f.data.scentCd<=0){ f.data.scentCd=7; e.applyStatus('scent',5,{source:f}); note(e.x,e.y-e.radius-82,'SCENT','#ff3030'); } if(e&&e.hasStatus('scent')&&f.data.biteCd<=0){ const rr=wolfScentRadius(f,e); if(dist(f.x,f.y,e.x,e.y)<rr){ f.setDir(e.x-f.x,e.y-f.y); if(f.data.pounceTimer<=0) f.data.pounceTimer=.45; } } };
        wolf.speedModifier=function(f,e){ return f.data.pounceTimer>0?2.3:1; };
        wolf.onCollide=function(f,e){ if(e.hasStatus('scent') && f.data.biteCd<=0 && f.data.pounceTimer>0){ e.takeDamage(10,f,'wolf-bite'); if(f.isRage){ const p=clamp(.5+(50-f.hp)/50*.5,.5,1); if(Math.random()<p) e.applyStatus('weak',4,{source:f}); } f.data.biteCd=2; f.data.pounceTimer=0; const n=norm(f.x-e.x,f.y-e.y); f.setDir(n.x,n.y); f.applyStatus('push',.22,{x:n.x,y:n.y,strength:950}); note(f.x,f.y-f.radius-80,'BITE','#ff3030'); return true; } return false; };
    }
    function wolfScentRadius(f,e){ return f.isRage ? 120 + (e.maxHp-e.hp)*5 : 120; }

    // WITCH clearer curse visuals.
    const oldRollWitchCurse=rollWitchCurse;
    rollWitchCurse=function(source,target){ oldRollWitchCurse(source,target); projectiles.push({type:'witch_talisman',owner:source,targetId:target.id,x:source.x,y:source.y,life:.8,maxLife:.8}); };

    // PIRATE item lifetime +2 and combo visuals.
    const oldAddPirateLoot=addPirateLoot;
    addPirateLoot=function(owner){ oldAddPirateLoot(owner); const p=[...projectiles].reverse().find(q=>q.type==='pirate_loot'&&q.owner===owner); if(p){p.life+=2;p.maxLife+=2;} };

    // PAINTER overhaul: line strokes, 5s equal blob throw, ink effects capped.
    const painter=FT('PAINTER');
    if(painter){
        painter.update=function(f,e,dt){ f.data.colorTimer=(f.data.colorTimer||2)-dt; if(f.data.colorTimer<=0){f.data.colorTimer=2;f.data.colorIndex=(f.data.colorIndex+1)%3;} f.data.blobCd=(f.data.blobCd||1)-abilityDt(f,dt); if(e&&f.data.blobCd<=0){ f.data.blobCd=5; spawnPainterBlob(f,e); } if(f.data.paintTimer>0){ f.data.paintTimer-=dt; f.data.paintDrop-=dt; if(f.data.paintDrop<=0){ f.data.paintDrop=.16; const kind=['red','blue','yellow'][f.data.colorIndex]; spawnPainterInk(f,f.data.lastPaintX??f.x,f.data.lastPaintY??f.y,kind,f.x,f.y); f.data.lastPaintX=f.x; f.data.lastPaintY=f.y; } } };
        painter.onWallBounce=function(f,wall){ f.data.paintTimer=2; f.data.paintDrop=0; f.data.lastPaintX=f.x; f.data.lastPaintY=f.y; note(f.x,f.y-f.radius-70,'BRUSH STROKE','#fff4a0'); };
    }
    spawnPainterBlob=function(owner,enemy){ const kinds=['red','blue','yellow']; const kind=kinds[Math.floor(Math.random()*3)]; const n=norm(enemy.x-owner.x,enemy.y-owner.y); projectiles.push({type:'paint_blob',owner,kind,x:owner.x,y:owner.y,vx:n.x*820,vy:n.y*820,radius:24,life:1.3,maxLife:1.3}); note(owner.x,owner.y-owner.radius-85,`THROW ${kind.toUpperCase()}`,'#fff4a0'); };

    // MONK -> KUNGFU, visual / combo polish, max trauma 30.
    const monk=FT('MONK');
    if(monk){ monk.name='KUNGFU'; monk.desc='Five-step martial combo, trauma and giant palm'; monk.speed=515; monk.draw=function(ctx,f){ drawPolygon(ctx,[[-48,-60],[48,-60],[64,42],[0,68],[-64,42]],'#3b2417','#ffd28a',5); ctx.fillStyle='#ffe0a0';ctx.font='900 23px serif';ctx.textAlign='center';ctx.fillText('尚武',0,8); if(f.data.combo>0){ctx.font='900 20px monospace';ctx.fillText('COMBO '+f.data.combo,0,-f.radius-18);} if(f.data.rushTimer>0){ctx.strokeStyle='#ff9b50';ctx.lineWidth=12;ctx.beginPath();ctx.arc(0,0,f.radius+24,0,TAU);ctx.stroke();} }; }
    addInnerTrauma=function(target,count=1){ target.applyStatus('innerTrauma',Infinity,{source:null}); target.statuses.innerTrauma.stacks=clamp((target.statuses.innerTrauma.stacks||0)+count,0,30); note(target.x,target.y-target.radius-92,`TRAUMA ${target.statuses.innerTrauma.stacks}`,'#ff9b50'); };

    // SUPERSTAR: fans are visible 10 HP bodies; no phantom damage.
    triggerSuperstarEvent=function(owner,enemy){ const canMedia=owner.data.mediaStreak<1; const media=canMedia && Math.random()<.35; if(media){owner.data.mediaStreak++; owner.applyStatus('immune',1.5,{source:owner}); owner.data.spotlight=1.5; projectiles.push({type:'spotlight_flash',owner,x:owner.x,y:owner.y,radius:190,life:1.5,maxLife:1.5}); note(owner.x,owner.y-owner.radius-80,'MEDIA SHIELD','#fff2a0');} else {owner.data.mediaStreak=0; for(let i=0;i<2;i++) projectiles.push({type:'superfan',owner,x:owner.x+rand(-35,35),y:owner.y+rand(-35,35),radius:12,hp:10,life:16,maxLife:16,tick:0,dir:norm(rand(-1,1),rand(-1,1))}); note(owner.x,owner.y-owner.radius-80,'+2 FANS','#ff7bd6');} };

    // PUPPET replaces WIND in roster.
    const wind=FT('WIND');
    if(wind){ Object.assign(wind,{name:'PUPPET',color:'#9b6b42',desc:'Effigy damage transfer and final cursed card',speed:465,startDx:1,startDy:-.5,init:f=>{f.data.wallCd=0;f.data.finalCardActive=false;},update:(f,e,dt)=>{},onWallBounce:(f,wall)=>{ if((f.data.wallCd||0)>0)return; f.data.wallCd=.35; spawnPuppetEffigy(f,wall); },draw:(ctx,f)=>{ drawPolygon(ctx,[[-42,-62],[42,-62],[56,42],[0,72],[-56,42]],'#4b2d1c','#d7b27a',5);ctx.strokeStyle='#111';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,-60);ctx.lineTo(0,58);ctx.moveTo(-48,-10);ctx.lineTo(48,-10);ctx.stroke();ctx.fillStyle='#f1d8a8';ctx.font='900 15px serif';ctx.textAlign='center';ctx.fillText('PUPPET',0,12);}}); }
    function spawnPuppetEffigy(owner,wall){ const e={type:'puppet_effigy',owner,x:owner.x,y:owner.y,radius:75,hp:10,life:Infinity,wall,order:matchClock}; projectiles.push(e); note(owner.x,owner.y-owner.radius-75,'EFFIGY','#d7b27a'); checkEffigyMerge(owner,wall); }
    function checkEffigyMerge(owner,wall){ const list=projectiles.filter(p=>p.type==='puppet_effigy'&&p.owner===owner&&p.wall===wall&&p.hp>0); if(list.length>=5){ list.slice(0,5).forEach(p=>p.life=0); projectiles.push({type:'straw_monster',owner,x:owner.x,y:owner.y,radius:55,hp:30,life:Infinity,tick:0}); note(owner.x,owner.y-owner.radius-95,'STRAW MONSTER','#d7b27a'); } }
    function spawnPuppetFinalCard(owner){ projectiles.push({type:'puppet_card',owner,x:owner.x,y:owner.y,vx:rand(-600,600),vy:rand(-600,600),radius:50,w:75,h:20,life:5,maxLife:5,value:1,tick:0,hitCd:0}); }

    // Patch projectile update/draw for new mechanics.
    const __updateProjectiles = updateProjectiles;
    updateProjectiles = function(dt){
        // pre-update special entities
        for(const p of projectiles){
            const owner=p.owner, enemy=owner?getEnemy(owner):null;
            if(p.type==='slime_child' && p.hp<=0 && p.life>0){ createSlimeMucus(p.x,p.y,owner); p.life=0; }
            if(p.type==='slime_mucus' && enemy && dist(enemy.x,enemy.y,p.x,p.y)<enemy.radius+p.radius){ enemy.applyStatus('slow',2,{mult:.1,source:owner}); }
            if(p.type==='puppet_effigy' && p.hp<=0) p.life=0;
            if(p.type==='straw_monster' && enemy){ const n=norm(enemy.x-p.x,enemy.y-p.y); p.x+=n.x*180*dt; p.y+=n.y*180*dt; p.tick=(p.tick||0)+dt; if(dist(p.x,p.y,enemy.x,enemy.y)<p.radius+enemy.radius && p.tick>=1){p.tick=0; enemy.takeDamage(2,owner,'straw-monster');} }
            if(p.type==='puppet_card' && enemy){ p.tick+=dt; p.hitCd=Math.max(0,p.hitCd-dt); if(p.tick>=1){p.tick=0;p.value=Math.ceil(rand(1,10));} p.x+=p.vx*dt; p.y+=p.vy*dt; if(p.x<20||p.x>980)p.vx*=-1; if(p.y<20||p.y>980)p.vy*=-1; if(dist(p.x,p.y,enemy.x,enemy.y)<p.radius+enemy.radius && p.hitCd<=0){p.hitCd=.4; enemy.takeDamage(p.value,owner,'puppet-final-card');} if(p.life<=dt && owner && enemy && enemy.hp>0){ owner.hp=0; } }
            if(p.type==='paint_blob' && enemy){ p.x+=p.vx*dt;p.y+=p.vy*dt; if(dist(p.x,p.y,enemy.x,enemy.y)<p.radius+enemy.radius){ if(p.kind==='red'){enemy.takeDamage(11,owner,'red-blob'); enemy.applyStatus('paintRed',3,{source:owner});} else if(p.kind==='blue'){enemy.takeDamage(6.5,owner,'blue-blob'); enemy.data.cd=0; enemy.applyStatus('paintBlue',3,{source:owner}); note(enemy.x,enemy.y-enemy.radius-85,'COOLDOWN RESET','#50a6ff');} else {enemy.takeDamage(7.5,owner,'yellow-blob'); enemy.applyStatus('slow',3,{mult:.66,source:owner}); owner.heal(3,false);} p.life=0; } }
            if(p.type==='math_v2_graph') p.drawProgress=Math.min(1,(p.drawProgress||0)+dt*1.8);
        }
        __updateProjectiles(dt);
    };
    const __drawProjectiles = drawProjectiles;
    drawProjectiles = function(ctx){ __drawProjectiles(ctx); for(const p of projectiles){ ctx.save(); if(p.type==='puppet_effigy'){ctx.globalAlpha=.86;drawPolygon(ctx,[[p.x-45,p.y-60],[p.x+45,p.y-60],[p.x+50,p.y+55],[p.x,p.y+75],[p.x-50,p.y+55]],'#6b4428','#d7b27a',4);ctx.fillStyle='#f1d8a8';ctx.font='900 13px serif';ctx.textAlign='center';ctx.fillText(`HP ${Math.ceil(p.hp)}`,p.x,p.y+5);} if(p.type==='straw_monster'){drawPolygon(ctx,[[p.x-55,p.y-65],[p.x+55,p.y-60],[p.x+60,p.y+55],[p.x,p.y+80],[p.x-60,p.y+55]],'#7d5a2f','#f0cf92',6);ctx.fillStyle='#27180b';ctx.font='900 15px serif';ctx.textAlign='center';ctx.fillText('STRAW',p.x,p.y+4);} if(p.type==='puppet_card'){ctx.translate(p.x,p.y);ctx.rotate(Date.now()/260);ctx.fillStyle='#f1d8a8';ctx.strokeStyle='#3a1b10';ctx.lineWidth=4;ctx.fillRect(-38,-10,76,20);ctx.strokeRect(-38,-10,76,20);ctx.fillStyle='#2b120a';ctx.font='900 16px serif';ctx.textAlign='center';ctx.fillText(String(p.value),0,6);} if(p.type==='slime_mucus'){ctx.globalAlpha=.35*(p.life/p.maxLife);ctx.fillStyle='#9dff8d';ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,TAU);ctx.fill();} if(p.type==='paint_blob'){ctx.globalAlpha=.9;ctx.fillStyle=p.kind==='red'?'#ff4040':p.kind==='blue'?'#50a6ff':'#ffd447';ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,TAU);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();} if(p.type==='clock_flash'){ctx.globalAlpha=p.life/p.maxLife;ctx.fillStyle='#efeaff';ctx.font='900 70px monospace';ctx.textAlign='center';const a=-Math.PI/2+p.num*TAU/12;ctx.fillText(String(p.num),500+Math.cos(a)*405,500+Math.sin(a)*405);} if(p.type==='witch_talisman'){const t=fighters.find(f=>f.id===p.targetId); if(t){ctx.globalAlpha=p.life/p.maxLife;ctx.strokeStyle='#e49aff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(t.x,t.y);ctx.stroke();ctx.fillStyle='#f7e8ff';ctx.font='900 18px serif';ctx.textAlign='center';ctx.fillText('符',t.x,t.y-t.radius-88);}} ctx.restore(); } };

    // Enhanced tournament summary MVP awards.
    buildTournamentSummary = function(){ const st=tournamentState;if(!st)return''; const log=st.log||[]; const champion=st.champion; const fastest=log.slice().sort((a,b)=>(a.result.duration||999)-(b.result.duration||999))[0]; const clutch=log.slice().sort((a,b)=>(a.result.winnerHp||99)-(b.result.winnerHp||99))[0]; const dmg=log.slice().sort((a,b)=>(b.result.winnerDamage||0)-(a.result.winnerDamage||0))[0]; const hit=log.slice().sort((a,b)=>(b.result.biggestHit||0)-(a.result.biggestHit||0))[0]; const awards=[['MVP Vô Địch',champion||'—'],['Fastest Kill',fastest?`${fastest.winner} ${fastest.result.duration.toFixed(1)}s`:'—'],['Clutch King',clutch?`${clutch.winner} ${clutch.result.winnerHp.toFixed(1)}HP`:'—'],['Damage Lord',dmg?`${dmg.winner} ${(dmg.result.winnerDamage||0).toFixed(1)}`:'—'],['Biggest Hit',hit?`${hit.winner} ${(hit.result.biggestHit||0).toFixed(1)}`:'—'],['Matches',String(st.matchesPlayed||0)]]; const cards=awards.map(a=>`<div class="summary-card"><span>${a[0]}</span><b>${a[1]}</b></div>`).join(''); const banner=champion?`<div class="champion-banner"><h2 style="color:${tournamentFighterStyle(champion)}">🏆 ${champion} VÔ ĐỊCH</h2><div>Grand Bracket hoàn tất. Các danh hiệu MVP đã được thống kê.</div></div>`:''; return `${banner}<div class="tournament-summary">${cards}</div>`; };

})();


// ===== PRECISION FIX PATCH: requested targeted corrections =====
(function precisionFixPatch(){
  const FT = n => FighterTypes.find(f => f.name === n);
  const EN = f => fighters.find(x => x && f && x.id !== f.id);
  const note = (x,y,t,c)=>floatingTexts.push(new FloatingText(x,y,t,c));
  const isContactLabel = l => /rubber|kinetic|saw|blood-rip|collision|spin|bite|hunt|slash|punch|monk|kungfu/i.test(String(l||''));
  const isFlyingLabel = l => /blade|meteor|burn|card|sniper|math|electric|lightning|toxic|poison|virus|graph|projectile|laser|ray|shot|wave|dart|meteor|blob/i.test(String(l||''));

  // System wrapper: Magnet Shield, Mirror global copied power, Time mark accounting, Superstar fan interception, Slime counters, Puppet effigy no-overflow.
  const baseTakeDamage = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source=null, label='', statusDamage=false){
    if (!amount || amount <= 0 || this.hp <= 0) return;

    // Mirror: any damage produced by a copied skill respects whole/broken mirror power, including DOTs.
    if (source && source.name === 'MIRROR' && source.data && source.data.stolenType && source.data.stolenTimer > 0) {
      const pow = source.data.stolenPower || 1;
      amount *= pow;
      if (pow !== 1) label = (label || 'mirror-copy') + `-mirror-x${pow}`;
    }

    // Magnet Shield: blocks flying damage. Heavy block breaks the field. Contact damage still passes and can break shield.
    if (this.name === 'MAGNET' && this.data && this.data.fieldTimer > 0 && source && source !== this && !statusDamage) {
      const flying = isFlyingLabel(label) && !isContactLabel(label);
      if (flying) {
        note(this.x, this.y-this.radius-95, `MAGNET SHIELD ${amount.toFixed(1)}`, '#ffe44e');
        emitParticles(this.x, this.y, '#ffe44e', 18, 260, 5, .45, 'square');
        if (amount > 20) { this.data.fieldTimer = 0; projectiles.forEach(p => { if(p.type==='magnet_field' && p.owner===this) p.life=0; }); note(this.x, this.y-this.radius-120, 'SHIELD BROKEN', '#ffcc55'); }
        return;
      }
      if (isContactLabel(label) && amount > 20) { this.data.fieldTimer = 0; projectiles.forEach(p => { if(p.type==='magnet_field' && p.owner===this) p.life=0; }); note(this.x, this.y-this.radius-100, 'CONTACT BREAK', '#ffcc55'); }
    }

    // Superstar fans are visible 10 HP bodies that intercept incoming non-status hits before Superstar.
    if (this.name === 'SUPERSTAR' && source && source !== this && !statusDamage) {
      const fan = projectiles.find(p => p.type === 'superfan' && p.owner === this && p.hp > 0 && p.life > 0);
      if (fan) {
        const block = Math.min(fan.hp, amount);
        fan.hp -= block;
        note(fan.x, fan.y-fan.radius-20, `FAN ${block.toFixed(1)}`, '#ffb8ea');
        emitParticles(fan.x, fan.y, '#ff7bd6', 10, 180, 4, .3, 'square');
        if (fan.hp <= 0) { fan.life = 0; spawnShockwave(fan.x, fan.y, '#ff7bd6', 80); }
        return;
      }
    }

    // PUPPET: oldest effigy absorbs exactly one hit; visible leak goes to Puppet, not to the next effigy.
    if (this.name === 'PUPPET' && source && source !== this && !statusDamage) {
      const eff = projectiles.filter(p=>p.type==='puppet_effigy' && p.owner===this && p.hp>0 && p.life>0).sort((a,b)=>(a.order||0)-(b.order||0))[0];
      if (eff) {
        const block = Math.min(eff.hp, amount);
        eff.hp -= block;
        note(eff.x, eff.y-eff.radius-30, `VOODOO ${block.toFixed(1)}`, '#d6c0ff');
        emitParticles(eff.x, eff.y, '#d6c0ff', 14, 220, 5, .35, 'square');
        if (eff.hp <= 0) { eff.life=0; spawnShockwave(eff.x, eff.y, '#8d6b45', 120); }
        const leak = Math.max(0, amount - block) * .9 + block * .38;
        if (leak <= 0) return;
        amount = leak;
        label = (label || 'direct') + '-puppet-effigy-leak';
        note(this.x, this.y-this.radius-92, `LEAK ${leak.toFixed(1)}`, '#d6c0ff');
      }
    }

    // TIME mark: track enemy damage to Time and Time damage to enemy. Enemy gets only 50% refund later.
    if (this.name === 'TIME' && this.data && this.data.mark && source && source !== this) {
      this.data.mark.damageTaken = (this.data.mark.damageTaken || 0) + amount;
    }
    if (source && source.name === 'TIME' && source.data && source.data.mark && this !== source) {
      source.data.mark.damageDealt = (source.data.mark.damageDealt || 0) + amount;
    }

    // SLIME: child spawn counter and shock-split counter. Only true incoming damage, not status ticks.
    if (this.name === 'SLIME' && this.data && source && source !== this && !statusDamage) {
      this.data.childCounter ||= [];
      this.data.childCounter.push({t:matchClock, amount});
      this.data.childCounter = this.data.childCounter.filter(x => matchClock - x.t <= 5);
      const csum = this.data.childCounter.reduce((a,b)=>a+b.amount,0);
      if (csum >= 4 && (this.data.childSpawnCd||0) <= 0) {
        addPrecisionSlimeChild(this, Math.random()*TAU, 8, 2.2);
        this.data.childCounter = [];
        this.data.childSpawnCd = .85;
        note(this.x, this.y-this.radius-86, '+SLIME CHILD', '#caffbb');
      }
      this.data.shockCounter ||= [];
      this.data.shockCounter.push({t:matchClock, amount});
      this.data.shockCounter = this.data.shockCounter.filter(x => matchClock - x.t <= 1);
      const ssum = this.data.shockCounter.reduce((a,b)=>a+b.amount,0);
      if (ssum >= Math.max(8, this.hp * .30) && (this.data.cloneCd||0) <= 0) {
        splitPrecisionSlime(this);
        this.data.shockCounter = [];
        this.data.cloneCd = 1.8;
      }
    }

    // TIME death denial during mark, once.
    if (this.name === 'TIME' && this.data && this.data.mark && !this.data.deathRewindUsed && this.hp - amount <= 0) {
      const m = this.data.mark;
      this.x = m.x; this.y = m.y; this.hp = Math.max(1, m.hp || this.maxHp);
      this.data.deathRewindUsed = true;
      this.data.mark = null;
      this.data.markCd = 9;
      note(this.x, this.y-this.radius-95, 'DEATH DENIED', '#efeaff');
      spawnShockwave(this.x, this.y, '#d6d0ff', 300);
      return;
    }
    return baseTakeDamage.call(this, amount, source, label, statusDamage);
  };

  // VAMPIRE: front semicircle bite, not omnidirectional, not impossible.
  const vamp = FT('VAMPIRE');
  if (vamp) {
    vamp.speed = 520;
    vamp.onCollide = function(f,e){
      if((f.data.latchCd||0)>0 || f.data.latchTimer>0) return false;
      const toEnemy = norm(e.x-f.x, e.y-f.y);
      const fangDir = norm(f.dir.x || toEnemy.x, f.dir.y || toEnemy.y);
      if (dot(toEnemy.x,toEnemy.y,fangDir.x,fangDir.y) < 0) { note(f.x,f.y-f.radius-60,'BITE MISS','#bb2038'); return false; }
      f.data.latchOffset = norm(f.x-e.x, f.y-e.y);
      f.data.latchTimer = 5; f.data.latchTick = 0; f.data.latchCd = 2.1; f.data.latchTargetId = e.id;
      if(f.isRage) f.data.bloodLinkLevel=(f.data.bloodLinkLevel||0)+1;
      note(f.x,f.y-f.radius-76,'FANG LOCK','#e43d57'); playFighterSound(f,'skill'); return true;
    };
  }

  // FLASH: deterministic Rage-only zigzag path. 1s draw, 2s immune traverse.
  const flash = FT('FLASH');
  if (flash) {
    flash.update = function(f,e,dt){
      if (f.isRage) {
        f.applyStatus('immune', .08, {source:f});
        f.data.flashRage ||= {phase:'prep', t:1, cooldown:0, path:null, hitIds:{}};
        const R=f.data.flashRage;
        if (R.phase === 'cool') { R.cooldown-=dt; if(R.cooldown<=0){R.phase='prep';R.t=1;R.path=null;R.hitIds={};} return; }
        if (R.phase === 'prep') {
          f.data.positionLocked = true; R.t -= dt;
          if (!R.path) R.path = buildFlashBouncePath(f);
          if (R.t <= 0) { R.phase='run'; R.t=2; R.startT=2; R.len=pathLength(R.path); R.damage=lerp(8,18,clamp((R.len-900)/2100,0,1)); note(f.x,f.y-f.radius-82,`ZIGZAG ${R.damage.toFixed(0)}`,'#fff06b'); }
          return;
        }
        if (R.phase === 'run') {
          f.data.positionLocked = true; f.data.dashTimer = .12;
          R.t -= dt; const t=clamp(1-R.t/2,0,1); const p=pointAlongPath(R.path,t); f.x=p.x; f.y=p.y;
          if(e && dist(f.x,f.y,e.x,e.y)<f.radius+e.radius+18 && !R.hitIds[e.id]){ R.hitIds[e.id]=true; e.takeDamage(R.damage,f,'flash-rage-zigzag'); spawnShockwave(e.x,e.y,'#fff06b',120); }
          if(R.t<=0){ R.phase='cool'; R.cooldown=.65; f.data.dashTimer=0; }
          return;
        }
      }
      // normal Flash
      f.data.cd = (f.data.cd||2) - abilityDt(f,dt);
      if(f.data.dashTimer>0){ f.data.dashTimer-=dt; f.applyStatus('immune',.08,{source:f}); }
      if(f.data.cd<=0){ f.data.cd=6.5; f.data.dashTimer=.4; f.data.dashHitIds={}; f.setDir(e.x-f.x,e.y-f.y); playFighterSound(f,'skill'); }
    };
    flash.draw = function(ctx,f){ drawSketchBlob(ctx,f.radius,'#e6d946',10); ctx.strokeStyle='#fff06b'; ctx.lineWidth=6; ctx.beginPath(); ctx.moveTo(-25,-45); ctx.lineTo(12,-5); ctx.lineTo(-8,-5); ctx.lineTo(24,45); ctx.stroke(); const R=f.data.flashRage; if(f.isRage && R && R.path){ctx.save();ctx.rotate(-Math.atan2(f.dir.y,f.dir.x));ctx.strokeStyle='rgba(255,240,107,.85)';ctx.lineWidth=5;ctx.setLineDash([18,10]);ctx.beginPath();for(let i=0;i<R.path.length;i++){const p=R.path[i]; i?ctx.lineTo(p.x-f.x,p.y-f.y):ctx.moveTo(p.x-f.x,p.y-f.y);}ctx.stroke();ctx.setLineDash([]);ctx.restore();} };
  }
  function buildFlashBouncePath(f){ let pts=[{x:f.x,y:f.y}], x=f.x,y=f.y, dir=norm(rand(-1,1),rand(-1,1)); const segs=4+Math.floor(rand(0,4)); for(let i=0;i<segs;i++){ let tx=dir.x>0?GAME_SIZE-35:35, ty=dir.y>0?GAME_SIZE-35:35; let ax=(tx-x)/dir.x, ay=(ty-y)/dir.y; let a=Math.min(Math.abs(ax),Math.abs(ay), rand(300,850)); if(!isFinite(a)||a<80)a=rand(300,700); x=clamp(x+dir.x*a,35,GAME_SIZE-35); y=clamp(y+dir.y*a,35,GAME_SIZE-35); pts.push({x,y}); if(x<=40||x>=GAME_SIZE-40)dir.x*=-1; if(y<=40||y>=GAME_SIZE-40)dir.y*=-1; dir=norm(dir.x+rand(-.45,.45),dir.y+rand(-.45,.45)); } return pts; }
  function pathLength(path){let L=0;for(let i=1;i<path.length;i++)L+=dist(path[i-1].x,path[i-1].y,path[i].x,path[i].y);return L;}
  function pointAlongPath(path,t){const L=pathLength(path);let need=L*t;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],d=dist(a.x,a.y,b.x,b.y);if(need<=d)return {x:lerp(a.x,b.x,need/d),y:lerp(a.y,b.y,need/d)};need-=d;}return path[path.length-1];}

  // ELECTRIC: exact Rage timed charge, contact counts as charge, no collision-discharge in Rage.
  const electric = FT('ELECTRIC');
  if(electric){ electric.noRage=false; const normalUpdate = electric.update; electric.onRage = f=>{f.data.ragePulse=5;f.data.rageContactCharge=0;note(f.x,f.y-f.radius-98,'TIMED OVERCHARGE','#bde5ff');}; electric.update=function(f,e,dt){ if(f.isRage){ f.data.ragePulse=(f.data.ragePulse||5)-dt; if(f.data.ragePulse<=0&&e){f.data.ragePulse=5; const charge=Math.max(1,(f.data.wallHits||0)+(f.data.rageContactCharge||0)); const raw=0.002*((f.maxHp-f.hp)+10)*Math.pow(2,charge); const dmg=raw<=60?raw:60+(raw-60)*.25; electricDischargeVisual2(f,e,charge); e.takeDamage(dmg,f,'electric-rage-timed'); f.heal(dmg*.5,false); f.data.wallHits=0; f.data.wallNodes=[]; f.data.rageContactCharge=0;} return; } normalUpdate&&normalUpdate(f,e,dt); }; electric.onCollide=function(f,e){ if(f.isRage){f.data.rageContactCharge=(f.data.rageContactCharge||0)+1;note(f.x,f.y-f.radius-70,'CONTACT CHARGE','#bde5ff');return false;} const charge=Math.max(1,f.data.wallHits||0); if(charge>0){const lost=f.maxHp-f.hp; const dmg=0.002*(lost+10)*Math.pow(2,charge); electricDischargeVisual2(f,e,charge); e.takeDamage(dmg,f,'electric-contact'); f.data.wallHits=0; f.data.wallNodes=[];} return false; }; }
  function electricDischargeVisual2(f,e,charge){const nodes=(f.data.wallNodes||[]).slice(-24); if(!nodes.length)nodes.push({x:f.x,y:f.y}); nodes.forEach(n=>projectiles.push({type:'electric_trail',owner:f,x1:n.x,y1:n.y,x2:e.x,y2:e.y,life:.35,maxLife:.35,charge})); spawnShockwave(e.x,e.y,'#75cfff',160+charge*8); playFighterSound(f,'skill');}

  // HUNTER: remove unclear normal crit spikes, add x4 speed when target Weak.
  const hunter=FT('HUNTER');
  if(hunter){ hunter.speedModifier=(f,e)=> e&&e.hasStatus&&e.hasStatus('weak') ? 4 : (f.data.hunt>0?1.8:1); hunter.onCollide=function(f,e){ if(f.data.hitCd>0)return false; f.data.hitCd=.38; if(f.data.hunt>0){e.takeDamage(scaledByMirror(f,12),f,'hunt-mode-weak-strike'); e.applyStatus('weak',5); f.data.hunt=0; f.data.cd=5.8; spawnShockwave(e.x,e.y,'#ff3030',150); note(e.x,e.y-e.radius-88,'HUNT WEAK STRIKE','#ff3030');} else {e.takeDamage(scaledByMirror(f,4),f,'knife');} return true; }; }

  // CARD: Rage Jokers and K = direct x3 card damage.
  const card=FT('CARD');
  if(card){ card.update=function(f,e,dt){ f.data.resolvePulse=Math.max(0,(f.data.resolvePulse||0)-dt); if(f.data.phase==='show'){ f.data.showTimer-=dt; if(f.data.showTimer<=0){ const hand=f.data.hand.slice(); let dmg=f.isRage?cardRageDamageFixed(hand,f,e):cardCaoDamage(hand); if(hand.some(c=>c.rank==='K')){dmg*=3; note(f.x,f.y-f.radius-108,'KING ×3','#ffd0d0');} dmg=scaledByMirror(f,dmg); f.data.lastDmg=dmg; projectiles.push({type:'card_throw',owner:f,enemy:e,x:f.x,y:f.y-f.radius-64,hand,dmg,rawDmg:dmg,hybridNumeric:true,radius:34,life:2.8,maxLife:2.8,hit:false,unblockable:true}); f.data.resolvePulse=.75; f.data.hand=[]; f.data.deck=makeDeckFixed(f); f.data.phase='draw'; f.data.drawCd=1; playFighterSound(f,'skill'); } return; } f.data.drawCd-=abilityDt(f,dt); if(f.data.drawCd<=0){f.data.drawCd=1; if(!f.data.deck||!f.data.deck.length)f.data.deck=makeDeckFixed(f); f.data.hand.push(f.data.deck.pop()); playFighterSound(f,'wall'); if(f.data.hand.length>=3){f.data.phase='show';f.data.showTimer=1; f.data.lastDmg=f.isRage?cardRageDamageFixed(f.data.hand,f,e):cardCaoDamage(f.data.hand);}} }; }
  function makeDeckFixed(owner){const suits=['♠','♥','♦','♣'], ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K']; const deck=[]; for(const s of suits)for(const r of ranks)deck.push({rank:r,suit:s}); if(owner&&owner.isRage)deck.push({rank:'RJ',suit:'★'},{rank:'BJ',suit:'☆'}); for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]];} return deck;}
  function cardRageDamageFixed(hand,owner,enemy){let total=0; for(const c of hand){ if(c.rank==='RJ')total+=Math.ceil((owner.maxHp-owner.hp)*.5); else if(c.rank==='BJ')total+=Math.ceil(enemy.hp*.5); else if(c.rank==='A')total+=1; else if(['10','J','Q','K'].includes(c.rank))total+=10; else total+=parseInt(c.rank)||0;} return Math.min(120,total);}

  // MATH: expression never interrupted, Rage expression visible and correct distribution.
  makeRageMathExpression=function(){const mag=Math.max(1,Math.ceil(100*Math.pow(Math.random(),2.25))); const sign=Math.random()<.5?-1:1; const result=sign*mag; const a=Math.ceil(rand(3,19)),b=Math.ceil(rand(2,12)),c=Math.ceil(rand(1,9)),d=Math.ceil(rand(1,7)); return {formula:`⌊(( ${a}² − ${b}×${c} + √${d*d}) ÷ 1)⌋ = ${result}`, result};};
  const math=FT('MATH'); if(math){ math.update=function(f,e,dt){ f.data.cd-=abilityDt(f,dt); if(f.data.cd<=0){f.data.cd=5; let formula,result,isRageFormula=false; if(f.isRage){const rage=makeRageMathExpression(); result=rage.result; formula=rage.formula; isRageFormula=true;} else {const X=Math.round(f.x/50),Y=Math.round(f.y/50),A=Math.round(e.x/50),B=Math.max(1,Math.round(e.y/50)); result=Math.round((X-Y)*A/B); if(result===0)result=(Math.random()<.5?-1:1); formula=`(${X}−${Y})×${A}/${B}`;} projectiles.push({type:'math_formula',owner:f,enemy:e,formula,value:result,rage:isRageFormula,life:4.2,maxLife:4.2,phase:'typing',age:0,x:f.x,y:f.y,hit:false,launched:false,vx:0,vy:0,uninterruptible:true}); playFighterSound(f,'skill'); }}; }

  // MATH V2: graph hand-drawn over time.
  const oldSpawnGraph = spawnMathV2Graph;
  spawnMathV2Graph=function(owner,label,fn){ oldSpawnGraph(owner,label,fn); const g=projectiles.filter(p=>p.type==='math_v2_graph'&&p.owner===owner).slice(-1)[0]; if(g){g.drawProgress=0;g.handDraw=true;} };

  // SNIPER: previous 4 nests with hidden immune reload, vulnerable aim, reverse recoil after normal shot.
  const sniper=FT('SNIPER'); if(sniper){ sniper.update=function(f,e,dt){ if(f.isRage){ f.data.positionLocked=true; if((f.data.reload||0)>0){f.data.reload-=dt; f.applyStatus('immune',.08,{source:f}); f.data.hiddenReload=true; if(f.data.reload<=0){const best=f.data.nests.reduce((a,b)=>dist(b.x,b.y,e.x,e.y)>dist(a.x,a.y,e.x,e.y)?b:a,f.data.nests[0]); f.x=best.x; f.y=best.y; f.data.aim=3; f.data.aimMax=3; f.data.hiddenReload=false; note(f.x,f.y-f.radius-70,'AIMING','#ff8b8b');} return;} if(f.data.aim>0){f.data.aim-=dt; f.setDir(e.x-f.x,e.y-f.y); if(dist(f.x,f.y,e.x,e.y)<300 && (f.data.aimMax-f.data.aim)>.45){f.data.reload=3; f.data.aim=0; note(f.x,f.y-f.radius-70,'RELOCATE','#ff8b8b'); return;} if(f.data.aim<=0){const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); const dmg=30*ratio; projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45}); e.takeDamage(scaledByMirror(f,dmg),f,'sniper-shot'); f.data.reload=3; playFighterSound(f,'skill');} return;} f.data.reload=(f.data.reload||0)-abilityDt(f,dt); if(f.data.reload<=0){f.data.reload=3;} return;} if(f.data.aim>0){f.data.positionLocked=true; f.data.aim-=dt; f.setDir(e.x-f.x,e.y-f.y); if(f.data.aim<=0){const dir=norm(e.x-f.x,e.y-f.y); const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); const dmg=30*ratio; projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45}); e.takeDamage(scaledByMirror(f,dmg),f,'sniper-shot'); f.x=clamp(f.x-dir.x*150,f.radius,GAME_SIZE-f.radius); f.y=clamp(f.y-dir.y*150,f.radius,GAME_SIZE-f.radius); f.data.cd=8; playFighterSound(f,'skill');} return;} f.data.cd-=abilityDt(f,dt); if(f.data.cd<=0){const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); f.data.aim=Math.max(1.2,0.55+1.35*ratio); f.data.aimMax=f.data.aim; note(f.x,f.y-f.radius-70,'LOCK ON','#ff8b8b');} }; }

  // TIME: mark rewind restores Time HP/pos; enemy only refunded 50% of Time damage.
  const timeFT=FT('TIME'); if(timeFT){ timeFT.update=function(f,e,dt){ f.data.clockCd=(f.data.clockCd||4)-dt; if(f.data.clockCd<=0){f.data.clockCd=4; const num=clockDamageValue(); e.takeDamage(num,f,'clock-hour'); projectiles.push({type:'clock_flash',owner:f,num,life:.9,maxLife:.9}); note(e.x,e.y-e.radius-80,`CLOCK ${num}`,'#efeaff');}
    if(f.data.mark){const m=f.data.mark; m.timer-=dt; if(m.timer<=0){f.x=m.x;f.y=m.y;f.hp=Math.max(f.hp,m.hp); if(m.damageDealt&&e) e.heal(m.damageDealt*.5,false); if(f.isRage&&m.damageTaken>0) spawnTimeRift(f,f.x,f.y,m.damageTaken); f.data.mark=null; f.data.markCd=9; note(f.x,f.y-f.radius-90,'REWIND 50% REFUND','#efeaff');} return;}
    f.data.markCd=(f.data.markCd||2)-abilityDt(f,dt); if(f.data.markCd<=0){f.data.mark={x:f.x,y:f.y,hp:f.hp,timer:3,damageDealt:0,damageTaken:0}; f.data.markCd=99; projectiles.push({type:'time_mark',owner:f,x:f.x,y:f.y,life:3,maxLife:3}); note(f.x,f.y-f.radius-85,'TIME MARK','#efeaff'); playFighterSound(f,'skill');}
  }; }

  // WOLF: visible pounce only inside scent, no sticking after bite.
  const wolf=FT('WOLF'); if(wolf){ wolf.update=function(f,e,dt){ f.data.scentCd=(f.data.scentCd||2)-abilityDt(f,dt); f.data.biteCd=Math.max(0,(f.data.biteCd||0)-dt); f.data.pounceTimer=Math.max(0,(f.data.pounceTimer||0)-dt); if(f.data.scentCd<=0){f.data.scentCd=7; e.applyStatus('scent',5,{source:f}); note(e.x,e.y-e.radius-90,'BLOOD SCENT','#ff3030');}
    const base=160; const rageBonus=f.isRage?Math.max(0,(e.maxHp-e.hp))*5:0; const inScent=e.hasStatus('scent')&&dist(f.x,f.y,e.x,e.y)<base+rageBonus; if(inScent&&f.data.biteCd<=0){const n=norm(e.x-f.x,e.y-f.y); f.setDir(n.x,n.y); f.data.pounceTimer=.55; f.data.biteCd=2; note(f.x,f.y-f.radius-76,'POUNCE','#ff3030');} if(f.data.pounceTimer>0){const n=norm(e.x-f.x,e.y-f.y); f.setDir(n.x,n.y);} };
    wolf.speedModifier=f=>f.data.pounceTimer>0?2.25:1; wolf.onCollide=function(f,e){ if(f.data.pounceTimer>0){let dmg=11; if(f.isRage){const chance=lerp(.5,1,clamp((50-Math.max(0,f.hp))/50,0,1)); if(Math.random()<chance)e.applyStatus('weak',4);} e.takeDamage(scaledByMirror(f,dmg),f,'wolf-bite'); const n=norm(f.x-e.x,f.y-e.y); f.x=clamp(f.x+n.x*100,f.radius,GAME_SIZE-f.radius); f.y=clamp(f.y+n.y*100,f.radius,GAME_SIZE-f.radius); f.data.pounceTimer=0; spawnShockwave(e.x,e.y,'#ff3030',120); return true;} return false;}; }

  // WITCH: actual throw talisman/potion visuals and icons.
  const witch=FT('WITCH'); if(witch){ const ou=witch.update; witch.update=function(f,e,dt){ const before=f.data.curseCd; ou(f,e,dt); if(before>0 && f.data.curseCd>6.5){projectiles.push({type:'witch_talisman',owner:f,x:f.x,y:f.y,targetId:e.id,life:.8,maxLife:.8});} }; }

  // PIRATE: one rope only, +2 item lifetime, invulnerable during pull and 1s after, stronger visuals.
  const pirate=FT('PIRATE'); if(pirate){ pirate.update=function(f,e,dt){ f.data.invulnAfter=Math.max(0,(f.data.invulnAfter||0)-dt); if(f.data.invulnAfter>0) f.applyStatus('immune',.08,{source:f}); f.data.lootCd-=abilityDt(f,dt); if(f.data.lootCd<=0){f.data.lootCd=3; addPirateLoot(f); const loot=projectiles.filter(p=>p.type==='pirate_loot'&&p.owner===f).slice(-1)[0]; if(loot){loot.life+=2; loot.maxLife+=2;}} f.data.anchorCd-=abilityDt(f,dt); if(f.data.anchorCd<=0&&!projectiles.some(p=>p.type==='pirate_anchor'&&p.owner===f&&p.life>0)){f.data.anchorCd=7; triggerPirateAnchor(f,e);} } }

  // PAINTER: guaranteed homing ink if not blocked, cd 4s.
  const painter=FT('PAINTER'); if(painter){ painter.update=function(f,e,dt){ f.data.colorTimer-=dt; if(f.data.colorTimer<=0){f.data.colorTimer=2;f.data.colorIndex=(f.data.colorIndex+1)%3;} f.data.blobCd-=abilityDt(f,dt); if(e&&f.data.blobCd<=0){f.data.blobCd=3.45; spawnPainterBlob(f,e);} if(f.data.paintTimer>0){f.data.paintTimer-=dt; f.data.paintDrop-=dt; if(f.data.paintDrop<=0){f.data.paintDrop=.17; const kind=['red','blue','yellow'][f.data.colorIndex]; spawnPainterInk(f,f.data.lastPaintX??f.x,f.data.lastPaintY??f.y,kind,f.x,f.y); f.data.lastPaintX=f.x;f.data.lastPaintY=f.y;}}}; }
  spawnPainterBlob=function(owner,enemy){const kinds=['red','blue','yellow']; const kind=kinds[Math.floor(Math.random()*3)]; projectiles.push({type:'paint_blob',owner,enemy,homing:true,kind,x:owner.x,y:owner.y,vx:0,vy:0,radius:25,life:2.1,maxLife:2.1}); note(owner.x,owner.y-owner.radius-85,`INK ${kind.toUpperCase()}`,'#fff4a0');};

  // KUNGFU: clearer combo VFX, max trauma 30, hidden damage detonation after cap.
  const kung=FT('KUNGFU')||FT('MONK'); if(kung){ kung.name='KUNGFU'; kung.onCollide=function(f,e){ if(f.data.hitCd>0)return false; f.data.hitCd=.45; if(f.data.rushTimer>0){ if(f.data.rushHitCd<=0){ if((e.statuses.innerTrauma?.stacks||0)>=30){ e.data.kungfuHidden=(e.data.kungfuHidden||0)+2; note(e.x,e.y-e.radius-105,`HIDDEN ${e.data.kungfuHidden}`,'#ff9b50'); } else addInnerTrauma(e,1); f.data.rushHitCd=.16; projectiles.push({type:'kungfu_qi',owner:f,x:e.x,y:e.y,life:.35,maxLife:.35}); playFighterSound(f,'wall'); } return true; } f.data.combo=(f.data.combo||0)+1; f.data.comboTimer=5; const c=f.data.combo; note(f.x,f.y-f.radius-78,`COMBO ${c}`,'#ffd28a'); if(c===1){e.takeDamage(3,f,'kungfu-punch');projectiles.push({type:'kungfu_qi',owner:f,x:e.x,y:e.y,life:.45,maxLife:.45});} else if(c===2){e.applyStatus('stun',1,{source:f}); e.applyStatus('rapidPunch',1,{source:f,tick:0}); f.data.comboAnim=1; note(e.x,e.y-e.radius-88,'RAPID FISTS','#ffd28a');} else if(c===3){e.takeDamage(10,f,'giant-palm'); const n=norm(e.x-f.x,e.y-f.y); e.applyStatus('push',.7,{x:n.x,y:n.y,strength:1900}); projectiles.push({type:'kungfu_palm',owner:f,x:f.x,y:f.y,vx:n.x*520,vy:n.y*520,life:1.1,maxLife:1.1});} else if(c===4&&f.isRage){e.applyStatus('stun',.8,{source:f}); f.heal(10,false); projectiles.push({type:'kungfu_rage_seal',owner:f,x:e.x,y:e.y,life:1,maxLife:1});} else if((!f.isRage&&c>=4)||(f.isRage&&c>=5)){e.applyStatus('stun',5,{source:f}); f.data.rushTimer=5; f.data.rushTargetId=e.id; f.data.rushAnchor={x:e.x,y:e.y}; f.data.combo=0; const nd=norm((e.x<500?1000:0)-f.x,(e.y<500?1000:0)-f.y); f.setDir(nd.x,nd.y); note(e.x,e.y-e.radius-100,'TRAUMA RUSH','#ff9b50');} return true;}; }
  const oldAddTrauma = addInnerTrauma;
  addInnerTrauma=function(target,count=1){ target.applyStatus('innerTrauma',Infinity,{source:null}); target.statuses.innerTrauma.stacks=clamp((target.statuses.innerTrauma.stacks||0)+count,0,30); note(target.x,target.y-target.radius-92,`TRAUMA ${target.statuses.innerTrauma.stacks}`,'#ff9b50');};

  // SLIME exact spawn/split helpers.
  const slime=FT('SLIME'); if(slime){ slime.update=function(f,e,dt){ f.data.childSpawnCd=Math.max(0,(f.data.childSpawnCd||0)-dt); f.data.cloneCd=Math.max(0,(f.data.cloneCd||0)-dt); f.data.gelArmorTimer=Math.max(0,(f.data.gelArmorTimer||0)-dt); if(f.data.gelArmorTimer<=0){f.data.gelArmorReduction=0;f.data.gelArmorStacks=0;} }; }
  function addPrecisionSlimeChild(owner, angle, hp=16, damage=4){ projectiles.push({type:'slime_child',owner,angle,radius:24,hp,life:4,maxLife:4,hitCd:{},blockCd:0,damageDone:0,damage}); }
  function splitPrecisionSlime(f){ const hp=Math.max(5,f.hp); const ft=FT('SLIME'); const kids=projectiles.filter(p=>p.type==='slime_child'&&p.owner===f&&p.hp>0); for(let i=0;i<2;i++){f.teamId=f.teamId||f.id; const c=new Fighter(f.id,clamp(f.x+rand(-90,90),80,920),clamp(f.y+rand(-90,90),80,920),ft); c.teamId=f.teamId; c.hp=hp; c.data.cloneDepth=(f.data.cloneDepth||0)+1; c.dir=norm(rand(-1,1),rand(-1,1)); fighters.push(c); kids.forEach(k=>addPrecisionSlimeChild(c,Math.random()*TAU,Math.max(1,k.hp*.5),Math.max(.5,(k.damage||4)*.5)));} note(f.x,f.y-f.radius-110,'MITOSIS','#caffbb'); spawnShockwave(f.x,f.y,'#7be66f',220); }

  // PUPPET: no limit, every wall touch creates effigy; old overflow already intercepted above.
  const puppet=FT('PUPPET'); if(puppet){ puppet.onWallBounce=function(f,wall){ spawnPuppetEffigyFixed(f,wall); }; }
  function spawnPuppetEffigyFixed(owner,wall){ const pos={x:owner.x,y:owner.y}; if(wall==='left')pos.x=0; if(wall==='right')pos.x=GAME_SIZE; if(wall==='top')pos.y=0; if(wall==='bottom')pos.y=GAME_SIZE; projectiles.push({type:'puppet_effigy',owner,x:pos.x,y:pos.y,radius:75,hp:10,life:Infinity,wall,order:matchClock+Math.random()*0.001}); note(pos.x,pos.y-85,'EFFIGY','#d7b27a'); const list=projectiles.filter(p=>p.type==='puppet_effigy'&&p.owner===owner&&p.wall===wall&&p.hp>0&&p.life>0); if(list.length>=5){list.slice(0,5).forEach(p=>p.life=0); projectiles.push({type:'straw_monster',owner,x:pos.x,y:pos.y,radius:55,hp:30,life:Infinity,tick:0}); note(pos.x,pos.y-105,'STRAW MONSTER','#d7b27a');} }

  // Projectile runtime precision additions.
  const prevUP = updateProjectiles;
  updateProjectiles=function(dt){
    for(const p of projectiles){ const owner=p.owner, enemy=owner?EN(owner):null;
      if(p.type==='paint_blob'&&p.homing&&enemy){const n=norm(enemy.x-p.x,enemy.y-p.y); p.vx=n.x*900; p.vy=n.y*900;}
      if(p.type==='slime_child'&&p.hp<=0&&p.life>0){ createSlimeMucus(p.x,p.y,owner); p.life=0; }
      if(p.type==='puppet_effigy'&&p.hp<=0)p.life=0;
      if(p.type==='kungfu_qi'||p.type==='kungfu_palm'||p.type==='kungfu_rage_seal'||p.type==='witch_talisman') { /* visual */ }
    }
    prevUP(dt);
    for(const f of fighters){ if(f&&f.data&&f.data.kungfuHidden>0&&!f.data.kungfuBombTimer){f.data.kungfuBombTimer=3;} if(f&&f.data&&f.data.kungfuBombTimer){f.data.kungfuBombTimer-=dt; if(f.data.kungfuBombTimer<=0){const dmg=f.data.kungfuHidden||0; f.data.kungfuHidden=0; f.data.kungfuBombTimer=0; f.takeDamage(dmg,null,'kungfu-hidden-burst'); note(f.x,f.y-f.radius-110,`HIDDEN BURST ${dmg}`,'#ff9b50');}} }
  };
  const prevDP=drawProjectiles;
  drawProjectiles=function(ctx){ prevDP(ctx); for(const p of projectiles){ctx.save(); if(p.type==='kungfu_qi'){ctx.globalAlpha=p.life/p.maxLife;ctx.strokeStyle='#ffffff';ctx.lineWidth=8;ctx.beginPath();ctx.arc(p.x,p.y,55*(1-p.life/p.maxLife),0,TAU);ctx.stroke();} if(p.type==='kungfu_palm'){ctx.globalAlpha=p.life/p.maxLife;ctx.fillStyle='rgba(255,210,138,.28)';ctx.strokeStyle='#ffd28a';ctx.lineWidth=8;ctx.beginPath();ctx.ellipse(p.x,p.y,250,145,Math.atan2(p.vy,p.vx),0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#ffe0a0';ctx.font='900 42px serif';ctx.textAlign='center';ctx.fillText('掌',p.x,p.y+16);} if(p.type==='kungfu_rage_seal'){ctx.globalAlpha=p.life/p.maxLife;ctx.strokeStyle='#ff9b50';ctx.lineWidth=8;ctx.beginPath();ctx.arc(p.x,p.y,80,0,TAU);ctx.stroke();ctx.fillStyle='#ffdda8';ctx.font='900 34px serif';ctx.textAlign='center';ctx.fillText('封',p.x,p.y+12);} if(p.type==='witch_talisman'){const t=fighters.find(f=>f.id===p.targetId); if(t){ctx.globalAlpha=p.life/p.maxLife;ctx.strokeStyle='#e49aff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(t.x,t.y);ctx.stroke();ctx.fillStyle='#f7e8ff';ctx.font='900 22px serif';ctx.textAlign='center';ctx.fillText('符',t.x,t.y-t.radius-96);}} ctx.restore(); }};

  // Crystal diamond path correction: any cage diamonds get non-axis irrational angle if too linear.
  const oldCheckCrystal = checkCrystalDiamond;
  checkCrystalDiamond=function(owner){ oldCheckCrystal(owner); projectiles.filter(p=>p.type==='crystal_cage'&&p.owner===owner).forEach(c=>{ if(c.diamond){ const a=-Math.PI/2+Math.PI/7; const sp=Math.hypot(c.diamond.vx||1,c.diamond.vy||1)||owner.baseSpeed*5.8; c.diamond.x=c.x+Math.cos(-Math.PI/2)*(c.radius||220)*.75; c.diamond.y=c.y+Math.sin(-Math.PI/2)*(c.radius||220)*.75; c.diamond.vx=Math.cos(a)*sp; c.diamond.vy=Math.sin(a)*sp; }}); };

  populateRoster();
})();


// ===== FULL-ROSTER QA PATCH: simulation-derived runtime fixes + team-aware clone support =====
function createSlimeMucus(x, y, owner) {
    projectiles.push({ type: 'slime_mucus', owner, x, y, radius: 75, life: 5, maxLife: 5 });
}
(function fullRosterQAPatch(){
    const FT = name => FighterTypes.find(f => f.name === name);
    const live = f => f && f.hp > 0;
    const teamOf = f => f ? (f.teamId ?? f.id) : null;
    const enemyOf = f => fighters.find(q => live(q) && teamOf(q) !== teamOf(f)) || fighters.find(q => q && q !== f) || null;
    const clampFighter = f => {
        if (!f) return;
        f.x = clamp(f.x, f.radius, GAME_SIZE - f.radius);
        f.y = clamp(f.y, f.radius, GAME_SIZE - f.radius);
        if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) { f.x = GAME_SIZE/2; f.y = GAME_SIZE/2; f.setDir(rand(-1,1), rand(-1,1)); }
    };

    // Return Magnet to the older stable field behavior: shell position clamp while shield remains real.
    const magnet = FT('MAGNET');
    if (magnet) {
        magnet.update = function(f,e,dt){
            f.data.cd -= abilityDt(f,dt);
            if (f.data.cd <= 0) {
                f.data.cd = 6.6;
                f.data.fieldTimer = 3.1;
                projectiles.push({type:'magnet_field',owner:f,radius:310,life:3.1,maxLife:3.1,hitCd:{},inside:{},slamCd:0});
                playFighterSound(f,'skill');
            }
            if (f.data.fieldTimer > 0) {
                f.data.fieldTimer -= dt;
                const shell = 310;
                if (f.x < shell) { f.x = shell; f.setDir(1, f.dir.y); }
                if (f.x > GAME_SIZE - shell) { f.x = GAME_SIZE - shell; f.setDir(-1, f.dir.y); }
                if (f.y < shell) { f.y = shell; f.setDir(f.dir.x, 1); }
                if (f.y > GAME_SIZE - shell) { f.y = GAME_SIZE - shell; f.setDir(f.dir.x, -1); }
            }
        };
    }

    // Sniper: rebuild from old 4-nest behavior, then add only requested deltas.
    const sniper = FT('SNIPER');
    if (sniper) {
        sniper.init = f => { f.data.cd=2.0; f.data.aim=0; f.data.aimMax=0; f.data.reload=0; f.data.rageCd=0; f.data.hiddenReload=false; f.data.nests=[{x:95,y:95},{x:905,y:95},{x:95,y:905},{x:905,y:905}]; };
        sniper.update = function(f,e,dt){
            if (!e) return;
            if (f.isRage) {
                f.data.positionLocked = true;
                if ((f.data.reload || 0) > 0) {
                    f.data.reload -= dt;
                    f.data.hiddenReload = true;
                    f.applyStatus('immune', .10, {source:f});
                    if (f.data.reload <= 0) {
                        const best = f.data.nests.reduce((a,b)=>dist(b.x,b.y,e.x,e.y)>dist(a.x,a.y,e.x,e.y)?b:a,f.data.nests[0]);
                        f.x = best.x; f.y = best.y;
                        f.data.aim = 3; f.data.aimMax = 3; f.data.hiddenReload = false;
                        floatingTexts.push(new FloatingText(f.x, f.y-f.radius-70, 'AIMING', '#ff8b8b'));
                    }
                    return;
                }
                if (f.data.aim > 0) {
                    f.data.hiddenReload = false;
                    f.data.aim -= dt;
                    f.setDir(e.x-f.x, e.y-f.y);
                    if (dist(f.x,f.y,e.x,e.y) < 300 && (f.data.aimMax - f.data.aim) > .45) {
                        f.data.aim = 0;
                        f.data.reload = 3;
                        floatingTexts.push(new FloatingText(f.x, f.y-f.radius-70, 'RELOAD RELOCATE', '#ff8b8b'));
                        return;
                    }
                    if (f.data.aim <= 0) {
                        const ratio = clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE), 0, 1);
                        const dmg = 30 * ratio;
                        projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45});
                        e.takeDamage(scaledByMirror(f,dmg), f, 'sniper-shot');
                        f.data.reload = 3;
                        playFighterSound(f,'skill');
                    }
                    return;
                }
                f.data.reload = 3;
                return;
            }
            f.data.hiddenReload = false;
            if (f.data.aim > 0) {
                f.data.positionLocked = true;
                f.data.aim -= dt;
                f.setDir(e.x-f.x, e.y-f.y);
                if (f.data.aim <= 0) {
                    const dir = norm(e.x-f.x, e.y-f.y);
                    const ratio = clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE), 0, 1);
                    const dmg = 30 * ratio;
                    projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45});
                    e.takeDamage(scaledByMirror(f,dmg), f, 'sniper-shot');
                    f.x = clamp(f.x - dir.x*150, f.radius, GAME_SIZE-f.radius);
                    f.y = clamp(f.y - dir.y*150, f.radius, GAME_SIZE-f.radius);
                    f.data.cd = 8;
                    playFighterSound(f,'skill');
                }
                return;
            }
            f.data.cd -= abilityDt(f,dt);
            if (f.data.cd <= 0) {
                const ratio = clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1);
                f.data.aim = Math.max(1.2, 0.55 + 1.35*ratio);
                f.data.aimMax = f.data.aim;
                floatingTexts.push(new FloatingText(f.x, f.y-f.radius-70, 'LOCK ON', '#ff8b8b'));
            }
        };
    }

    // Team-aware collisions for Slime clones and future multi-body fighters. Same-team bodies do not damage each other.
    handleCollisions = function(dt){
        for (let i=0;i<fighters.length;i++) for (let j=i+1;j<fighters.length;j++) {
            const a=fighters[i], b=fighters[j];
            if (!live(a) || !live(b)) continue;
            const sameTeam = teamOf(a) === teamOf(b);
            const dx=b.x-a.x, dy=b.y-a.y; const d=Math.hypot(dx,dy)||1;
            const magnetShell = !sameTeam && ((a.name==='MAGNET' && a.data.fieldTimer>0) ? {mag:a, other:b} : (b.name==='MAGNET' && b.data.fieldTimer>0) ? {mag:b, other:a} : null);
            if (magnetShell) {
                const md = dist(magnetShell.mag.x, magnetShell.mag.y, magnetShell.other.x, magnetShell.other.y);
                const shellD = 310 + magnetShell.other.radius;
                if (md < shellD) {
                    const n = norm(magnetShell.other.x-magnetShell.mag.x, magnetShell.other.y-magnetShell.mag.y);
                    magnetShell.other.x = clamp(magnetShell.mag.x + n.x * shellD, magnetShell.other.radius, GAME_SIZE-magnetShell.other.radius);
                    magnetShell.other.y = clamp(magnetShell.mag.y + n.y * shellD, magnetShell.other.radius, GAME_SIZE-magnetShell.other.radius);
                    magnetShell.other.dir = reflectDir(magnetShell.other.dir, n.x, n.y);
                    magnetShell.other.applyStatus('push', .16, {x:n.x,y:n.y,strength:520});
                    continue;
                }
            }
            const minD=a.radius+b.radius;
            if (d < minD) {
                const nx=dx/d, ny=dy/d, overlap=minD-d;
                a.x-=nx*overlap*.5; a.y-=ny*overlap*.5; b.x+=nx*overlap*.5; b.y+=ny*overlap*.5;
                clampFighter(a); clampFighter(b);
                if (sameTeam) continue;
                const aPierce=a.name==='FLASH'&&a.data.dashTimer>0;
                const bPierce=b.name==='FLASH'&&b.data.dashTimer>0;
                if (!aPierce && !bPierce) { a.dir=reflectDir(a.dir,-nx,-ny); b.dir=reflectDir(b.dir,nx,ny); }
                if(!a.hasStatus('abilityDisabled')&&a.type.onCollide)a.type.onCollide(a,b,dt,{x:nx,y:ny});
                if(!b.hasStatus('abilityDisabled')&&b.type.onCollide)b.type.onCollide(b,a,dt,{x:-nx,y:-ny});
                mirrorStolenCollide(a,b,dt,{x:nx,y:ny}); mirrorStolenCollide(b,a,dt,{x:-nx,y:-ny});
            }
        }
    };

    update = function(dt){
        if (hitStop > 0) { hitStop -= dt; dt *= 0.1; }
        if (gameState !== 'PLAYING') return;
        matchClock += dt;
        if (sawWallRage.timer > 0) sawWallRage.timer = Math.max(0, sawWallRage.timer - dt);
        if (fighters[0]) fighters[0].teamId ??= fighters[0].id;
        if (fighters[1]) fighters[1].teamId ??= fighters[1].id;
        for (const f of fighters.slice()) if (live(f)) f.update(dt, enemyOf(f));
        handleCollisions(dt);
        updateProjectiles(dt);
        for (const f of fighters) clampFighter(f);
        for (let i=particles.length-1;i>=0;i--) { particles[i].update(dt); if(particles[i].life<=0)particles.splice(i,1); }
        for (let i=floatingTexts.length-1;i>=0;i--) { floatingTexts[i].update(dt); if(floatingTexts[i].life<=0)floatingTexts.splice(i,1); }
        for (let i=shockwaves.length-1;i>=0;i--) { const s=shockwaves[i]; s.r+=420*dt; s.alpha=Math.max(0,1-s.r/s.maxR); if(s.alpha<=0)shockwaves.splice(i,1); }
        if (arenaFlash.a > 0) arenaFlash.a=Math.max(0,arenaFlash.a-dt*1.6); if(cameraShake>0)cameraShake=Math.max(0,cameraShake-dt*22); cameraZoom=lerp(cameraZoom,1,dt*2);
        const t1=fighters[0]?teamOf(fighters[0]):1, t2=fighters[1]?teamOf(fighters[1]):2;
        const alive1=fighters.some(f=>live(f)&&teamOf(f)===t1), alive2=fighters.some(f=>live(f)&&teamOf(f)===t2);
        if (!alive1 || !alive2) endMatch();
    };

    const oldDraw = draw;
    draw = function(){
        ctx.save(); const shakeX=rand(-cameraShake,cameraShake), shakeY=rand(-cameraShake,cameraShake); ctx.translate(GAME_SIZE/2+shakeX,GAME_SIZE/2+shakeY); ctx.scale(cameraZoom,cameraZoom); ctx.translate(-GAME_SIZE/2,-GAME_SIZE/2);
        drawBackground(ctx); drawProjectiles(ctx);
        for (const f of fighters) if (f && f.hasStatus && f.hasStatus('scent')) { const lost=(f.maxHp-f.hp)/f.maxHp; const rr=Math.max(120,1000*lost); ctx.save(); ctx.globalAlpha=.18; ctx.fillStyle='#ff2020'; ctx.strokeStyle='#ff4d4d'; ctx.lineWidth=5; ctx.setLineDash([20,14]); ctx.beginPath(); ctx.arc(f.x,f.y,rr,0,TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle='#ffd0d0'; ctx.font='900 18px monospace'; ctx.textAlign='center'; ctx.fillText('BLOOD SCENT',f.x,f.y-rr-12); ctx.restore(); }
        for (const f of fighters) if (live(f)) f.draw(ctx);
        for (const f of fighters) if (f && f.name==='SNIPER' && f.data && f.data.aim>0) { const enemy=enemyOf(f); if(enemy){ctx.save(); ctx.globalAlpha=.9; ctx.strokeStyle='rgba(255,45,45,.95)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(f.x,f.y); ctx.lineTo(enemy.x,enemy.y); ctx.stroke(); ctx.restore();}}
        for(const p of particles){ if(p && typeof p.draw === 'function') p.draw(ctx); }
        for(const sw of shockwaves){
            if(!sw) continue;
            if(typeof sw.draw === 'function') sw.draw(ctx);
            else {
                ctx.save();
                ctx.globalAlpha = Number.isFinite(sw.alpha) ? sw.alpha : 0.7;
                ctx.strokeStyle = sw.color || '#ffffff';
                ctx.lineWidth = 7;
                ctx.beginPath();
                ctx.arc(sw.x || 0, sw.y || 0, Math.max(1, sw.r || 10), 0, TAU);
                ctx.stroke();
                ctx.restore();
            }
        }
        for(const t of floatingTexts){ if(t && typeof t.draw === 'function') t.draw(ctx); }
        if(calcOverlay)drawCalcOverlay(ctx); if(arenaFlash.a>0){ctx.fillStyle=`rgba(${arenaFlash.r},${arenaFlash.g},${arenaFlash.b},${arenaFlash.a})`;ctx.fillRect(0,0,GAME_SIZE,GAME_SIZE);} ctx.restore(); updateHUD();
    };

    updateHUD = function(){
        if (!fighters[0] || !fighters[1]) return;
        const bases=[fighters[0],fighters[1]];
        for(let i=0;i<2;i++){
            const base=bases[i], tid=teamOf(base);
            const members=fighters.filter(f=>f && teamOf(f)===tid && f.hp>0);
            const hp=members.reduce((s,f)=>s+f.hp,0), max=members.reduce((s,f)=>s+f.maxHp,0)||base.maxHp;
            const pct=clamp(hp/max*100,0,100);
            document.getElementById(`p${i+1}-hp`).style.width = `${pct}%`;
            document.getElementById(`p${i+1}-hp-text`).innerText = `${hp.toFixed(1)} / ${max.toFixed(0)}${members.length>1?' | bodies '+members.length:''}`;
            const rageEl=document.getElementById(`p${i+1}-rage`); rageEl.style.opacity = base.isRage ? 1 : 0; rageEl.style.display = base.isRage ? 'block' : 'none';
        }
    };
})();


// ===== FREEZE / DISAPPEAR HOTFIX: PUPPET + SLIME + FLASH IMMUNITY =====
(function FREEZE_DISAPPEAR_HOTFIX(){
  const FT = name => FighterTypes.find(f => f.name === name);
  const live = f => f && Number.isFinite(f.hp) && f.hp > 0;
  const teamOf2 = f => f ? (f.teamId ?? f.id) : null;
  const enemyOf2 = f => fighters.find(q => live(q) && teamOf2(q) !== teamOf2(f)) || fighters.find(q => q && q !== f) || null;
  function safeClamp(f){
    if(!f) return;
    if(!Number.isFinite(f.x) || !Number.isFinite(f.y)) { f.x = GAME_SIZE/2; f.y = GAME_SIZE/2; }
    if(!f.dir || !Number.isFinite(f.dir.x) || !Number.isFinite(f.dir.y)) f.dir = norm(rand(-1,1), rand(-1,1));
    f.x = clamp(f.x, f.radius || 40, GAME_SIZE - (f.radius || 40));
    f.y = clamp(f.y, f.radius || 40, GAME_SIZE - (f.radius || 40));
  }
  function safeProjectilesCap(){
    // Keep dead objects from lingering and prevent browser freeze from pathological summoner growth.
    for(let i=projectiles.length-1;i>=0;i--){
      const p=projectiles[i];
      if(!p || p.life<=0 || p.hp<=0 && ['puppet_effigy','straw_monster','slime_child'].includes(p.type)) projectiles.splice(i,1);
    }
    // No gameplay max for Puppet effigies in normal play, but prevent pathological frame-lock after very long wall bouncing.
    for(const owner of fighters){
      if(!owner || owner.name!=='PUPPET') continue;
      const effs=projectiles.filter(p=>p.type==='puppet_effigy'&&p.owner===owner&&p.hp>0&&p.life>0).sort((a,b)=>(a.order||0)-(b.order||0));
      if(effs.length>64){ for(const p of effs.slice(0, effs.length-64)) p.life=0; }
      const monsters=projectiles.filter(p=>p.type==='straw_monster'&&p.owner===owner&&p.hp>0&&p.life>0).sort((a,b)=>(a.order||0)-(b.order||0));
      if(monsters.length>8){ for(const p of monsters.slice(0, monsters.length-8)) p.life=0; }
    }
    for(const owner of fighters){
      if(!owner || owner.name!=='SLIME') continue;
      const kids=projectiles.filter(p=>p.type==='slime_child'&&p.owner===owner&&p.hp>0&&p.life>0).sort((a,b)=>(a.spawnTime||0)-(b.spawnTime||0));
      if(kids.length>10){ for(const p of kids.slice(0,kids.length-10)) p.life=0; }
    }
    if(projectiles.length>220){
      const keepScore = p => {
        if(!p) return -999;
        if(p.type==='puppet_effigy') return 5;
        if(p.type==='straw_monster') return 4;
        if(p.type==='slime_child') return 4;
        if(p.type==='gravity_well'||p.type==='crystal_cage'||p.type==='time_mark') return 3;
        return Math.min(2, p.life || 0);
      };
      projectiles.sort((a,b)=>keepScore(b)-keepScore(a));
      projectiles.length = 220;
      if(fighters[0]) floatingTexts.push(new FloatingText(500,70,'OBJECT GUARD 220','#d0c6ad'));
    }
  }

  // FLASH: standing/prep phase is NOT immune. Immunity is only active while traversing the Rage path or normal dash.
  const flash=FT('FLASH');
  if(flash){
    flash.update=function(f,e,dt){
      if(f.isRage){
        f.data.flashRage ||= {phase:'prep',t:1,path:null,hitIds:{},cooldown:0};
        const R=f.data.flashRage;
        if(R.phase==='cool'){
          f.data.dashTimer=0;
          if(f.statuses) delete f.statuses.immune;
          R.cooldown-=dt;
          if(R.cooldown<=0){R.phase='prep';R.t=1;R.path=null;R.hitIds={};}
          return;
        }
        if(R.phase==='prep'){
          f.data.positionLocked=true;
          f.data.dashTimer=0;
          if(f.statuses) delete f.statuses.immune;
          if(!R.path) R.path=buildFlashHotfixPath(f);
          R.t-=dt;
          if(R.t<=0){
            R.phase='run';R.t=2;R.hitIds={};R.len=hotfixPathLength(R.path);
            R.damage=lerp(8,18,clamp((R.len-850)/2200,0,1));
            floatingTexts.push(new FloatingText(f.x,f.y-f.radius-82,`RAGE DASH ${R.damage.toFixed(0)}`,'#fff06b'));
            playFighterSound(f,'skill');
          }
          return;
        }
        if(R.phase==='run'){
          f.data.positionLocked=true;
          f.data.dashTimer=.12;
          f.applyStatus('immune',.08,{source:f});
          R.t-=dt;
          const p=hotfixPointAlong(R.path,clamp(1-R.t/2,0,1));
          f.x=p.x; f.y=p.y; safeClamp(f);
          if(e && live(e) && dist(f.x,f.y,e.x,e.y)<f.radius+e.radius+20 && !R.hitIds[e.id]){
            R.hitIds[e.id]=true; e.takeDamage(scaledByMirror(f,R.damage),f,'flash-rage-zigzag'); spawnShockwave(e.x,e.y,'#fff06b',120);
          }
          if(R.t<=0){R.phase='cool';R.cooldown=.75;f.data.dashTimer=0; if(f.statuses) delete f.statuses.immune;}
          return;
        }
      }
      // Normal skill only: brief dash immunity remains valid.
      if(f.data.dashTimer>0){ f.data.dashTimer-=dt; f.applyStatus('immune',.08,{source:f}); if(f.data.dashTimer<=0){f.data.dashTimer=0;if(f.statuses)delete f.statuses.immune;} return; }
      f.data.cd=(f.data.cd||2)-abilityDt(f,dt);
      if(f.data.cd<=0 && e){ f.data.cd=6.5; f.data.dashTimer=.4; f.data.dashHitIds={}; f.setDir(e.x-f.x,e.y-f.y); playFighterSound(f,'skill'); }
    };
  }
  function buildFlashHotfixPath(f){
    const pts=[{x:f.x,y:f.y}];
    let x=f.x,y=f.y; let dir=norm(rand(-1,1),rand(-1,1));
    const target={x:rand(90,910),y:rand(90,910)};
    const segs=5+Math.floor(rand(0,4));
    for(let i=0;i<segs;i++){
      const toward=norm(target.x-x,target.y-y);
      dir=norm(dir.x*.65+toward.x*.35+rand(-.28,.28), dir.y*.65+toward.y*.35+rand(-.28,.28));
      let step=rand(260,640);
      let nx=x+dir.x*step, ny=y+dir.y*step;
      if(nx<45||nx>955){nx=clamp(nx,45,955); dir.x*=-1;}
      if(ny<45||ny>955){ny=clamp(ny,45,955); dir.y*=-1;}
      x=nx;y=ny;pts.push({x,y});
    }
    pts.push(target);
    return pts;
  }
  function hotfixPathLength(path){let L=0;for(let i=1;i<path.length;i++)L+=dist(path[i-1].x,path[i-1].y,path[i].x,path[i].y);return L||1;}
  function hotfixPointAlong(path,t){const L=hotfixPathLength(path);let need=L*t;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],d=dist(a.x,a.y,b.x,b.y)||1;if(need<=d)return{x:lerp(a.x,b.x,need/d),y:lerp(a.y,b.y,need/d)};need-=d;}return path[path.length-1];}

  // PUPPET: one actual wall impact = one effigy. Debounce continuous wall-contact frames without imposing normal gameplay max.
  const puppet=FT('PUPPET');
  if(puppet){
    puppet.init=function(f){f.data.wallHitStamp={};f.data.finalCardActive=false;f.data.finalCardDone=false;};
    puppet.onWallBounce=function(f,wall){
      f.data.wallHitStamp ||= {};
      const last=f.data.wallHitStamp[wall] || -999;
      if(matchClock-last<0.22) return;
      f.data.wallHitStamp[wall]=matchClock;
      spawnPuppetEffigyStable(f,wall);
    };
    puppet.update=function(f,e,dt){
      // Keep final-card owner inside arena and prevent stuck 1 HP after card expires.
      if(f.data.finalCardActive){
        f.data.cardTimer = Math.max(0,(f.data.cardTimer||5)-dt);
        if(f.data.cardTimer<=0 && !projectiles.some(p=>p.type==='puppet_card'&&p.owner===f&&p.life>0)) f.hp=0;
      }
    };
  }
  function spawnPuppetEffigyStable(owner,wall){
    const pos={x:owner.x,y:owner.y};
    if(wall==='left')pos.x=owner.radius; if(wall==='right')pos.x=GAME_SIZE-owner.radius;
    if(wall==='top')pos.y=owner.radius; if(wall==='bottom')pos.y=GAME_SIZE-owner.radius;
    const eff={type:'puppet_effigy',owner,x:pos.x,y:pos.y,radius:75,hp:10,life:Infinity,wall,order:matchClock+Math.random()*0.0001};
    projectiles.push(eff); floatingTexts.push(new FloatingText(pos.x,pos.y-85,'EFFIGY','#d7b27a'));
    const list=projectiles.filter(p=>p.type==='puppet_effigy'&&p.owner===owner&&p.wall===wall&&p.hp>0&&p.life>0).sort((a,b)=>(a.order||0)-(b.order||0));
    while(list.length>=5){
      const group=list.splice(0,5); group.forEach(p=>p.life=0);
      projectiles.push({type:'straw_monster',owner,x:pos.x,y:pos.y,radius:55,hp:30,life:60,maxLife:60,tick:0,order:matchClock});
      floatingTexts.push(new FloatingText(pos.x,pos.y-105,'STRAW MONSTER','#d7b27a'));
    }
  }
  // Replace final card helper safely if later code calls it.
  spawnPuppetFinalCard = function(owner){
    if(!owner || projectiles.some(p=>p.type==='puppet_card'&&p.owner===owner&&p.life>0)) return;
    owner.data.finalCardActive=true; owner.data.cardTimer=5;
    projectiles.push({type:'puppet_card',owner,x:owner.x,y:owner.y,vx:rand(-650,650)||420,vy:rand(-650,650)||-420,radius:50,w:75,h:20,life:5,maxLife:5,value:1,tick:0,hitCd:0});
  };

  // SLIME: stop runaway clone/body growth, but keep children and mitosis playable.
  const slime=FT('SLIME');
  if(slime){
    const slimeDraw=slime.draw;
    slime.init=function(f){f.data.childSpawnCd=0;f.data.cloneCd=1.4;f.data.slimeDmgWindow=[];f.data.shockDmgWindow=[];f.data.gelArmorTimer=0;f.data.gelArmorReduction=0;f.data.cloneDepth=f.data.cloneDepth||0;};
    slime.update=function(f,e,dt){
      f.data.childSpawnCd=Math.max(0,(f.data.childSpawnCd||0)-dt);
      f.data.cloneCd=Math.max(0,(f.data.cloneCd||0)-dt);
      f.data.gelArmorTimer=Math.max(0,(f.data.gelArmorTimer||0)-dt);
      if(f.data.gelArmorTimer<=0){f.data.gelArmorReduction=0;f.data.gelArmorStacks=0;}
      // prune windows so counters do not grow forever
      f.data.slimeDmgWindow=(f.data.slimeDmgWindow||[]).filter(x=>matchClock-x.t<=5);
      f.data.shockDmgWindow=(f.data.shockDmgWindow||[]).filter(x=>matchClock-x.t<=1);
      if((f.data.childSpawnCd||0)<=0){
        const sum=f.data.slimeDmgWindow.reduce((s,x)=>s+x.amount,0);
        if(sum>=4){ addStableSlimeChild(f,Math.random()*TAU,8,2.4); f.data.childSpawnCd=.6; f.data.slimeDmgWindow=[]; floatingTexts.push(new FloatingText(f.x,f.y-f.radius-82,'+SLIME CHILD','#caffbb')); }
      }
      const shock=f.data.shockDmgWindow.reduce((s,x)=>s+x.amount,0);
      const teamBodies=fighters.filter(q=>q&&q.name==='SLIME'&&teamOf2(q)===teamOf2(f)&&q.hp>0).length;
      if(shock>Math.max(10,f.hp*.20) && f.data.cloneCd<=0 && (f.data.cloneDepth||0)<2 && teamBodies<4){ splitStableSlime(f); f.data.shockDmgWindow=[]; f.data.cloneCd=3.0; }
    };
    slime.draw=function(ctx,f){ slimeDraw ? slimeDraw(ctx,f) : drawSketchBlob(ctx,f.radius,'#7be66f',12); const bodies=fighters.filter(q=>q&&q.name==='SLIME'&&teamOf2(q)===teamOf2(f)&&q.hp>0).length; if(bodies>1){ctx.fillStyle='#d6ffc8';ctx.font='900 13px monospace';ctx.textAlign='center';ctx.fillText('BODY '+bodies,0,f.radius+25);} };
  }
  function addStableSlimeChild(owner,angle,hp=8,damage=2.4){
    const kids=projectiles.filter(p=>p.type==='slime_child'&&p.owner===owner&&p.hp>0&&p.life>0);
    if(kids.length>=10) return;
    projectiles.push({type:'slime_child',owner,angle,radius:24,hp,life:5,maxLife:5,hitCd:{},blockCd:0,damageDone:0,damage,spawnTime:matchClock});
  }
  function splitStableSlime(f){
    const ft=FT('SLIME'); if(!ft) return;
    const hp=Math.max(8,f.hp);
    const bodies=fighters.filter(q=>q&&q.name==='SLIME'&&teamOf2(q)===teamOf2(f)&&q.hp>0);
    if(bodies.length>=4) return;
    const c=new Fighter(f.id,clamp(f.x+rand(-85,85),80,920),clamp(f.y+rand(-85,85),80,920),ft);
    c.teamId=teamOf2(f); c.hp=hp; c.maxHp=f.maxHp; c.data.cloneDepth=(f.data.cloneDepth||0)+1; c.dir=norm(rand(-1,1),rand(-1,1)); fighters.push(c);
    const kids=projectiles.filter(p=>p.type==='slime_child'&&p.owner===f&&p.hp>0&&p.life>0);
    kids.forEach(k=>addStableSlimeChild(c,Math.random()*TAU,Math.max(1,k.hp*.5),Math.max(.5,(k.damage||4)*.5)));
    floatingTexts.push(new FloatingText(f.x,f.y-f.radius-110,'MITOSIS','#caffbb')); spawnShockwave(f.x,f.y,'#7be66f',220);
  }

  // Wrap damage only for the missing Slime counters and Puppet final card, without changing other tướng.
  const oldTD = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage=function(amount,source=null,label='',statusDamage=false){
    if(!Number.isFinite(amount) || amount<=0) return;
    if(this.name==='SLIME' && source && source!==this && !statusDamage){
      this.data ||= {}; this.data.slimeDmgWindow ||= []; this.data.shockDmgWindow ||= [];
      this.data.slimeDmgWindow.push({t:matchClock,amount}); this.data.shockDmgWindow.push({t:matchClock,amount});
    }
    if(this.name==='PUPPET' && this.hp-amount<=0 && !this.data.finalCardActive && !statusDamage){
      this.hp=1; this.data.finalCardActive=true; this.data.cardTimer=5; spawnPuppetFinalCard(this); floatingTexts.push(new FloatingText(this.x,this.y-this.radius-90,'FINAL CARD','#f1d8a8')); return;
    }
    return oldTD.call(this,amount,source,label,statusDamage);
  };

  // Stabilize projectile updates and keep all objects on map / finite.
  const oldUP2=updateProjectiles;
  updateProjectiles=function(dt){
    safeProjectilesCap();
    // Manual pre-step for risky projectile types so they cannot stall the old updater.
    for(const p of projectiles){
      const owner=p.owner, enemy=owner?enemyOf2(owner):null;
      if(p.type==='puppet_card'){
        p.tick=(p.tick||0)+dt; p.hitCd=Math.max(0,(p.hitCd||0)-dt); if(p.tick>=1){p.tick=0;p.value=Math.ceil(rand(1,10));}
        p.x+=p.vx*dt; p.y+=p.vy*dt; if(p.x<25||p.x>975){p.vx*=-1;p.x=clamp(p.x,25,975);} if(p.y<25||p.y>975){p.vy*=-1;p.y=clamp(p.y,25,975);}
        if(enemy&&live(enemy)&&dist(p.x,p.y,enemy.x,enemy.y)<p.radius+enemy.radius&&p.hitCd<=0){p.hitCd=.35;enemy.takeDamage(p.value,owner,'puppet-final-card');}
        if(p.life<=dt && owner && live(owner) && enemy && live(enemy)) owner.hp=0;
      }
      if(p.type==='straw_monster' && owner && enemy && live(enemy)){
        p.tick=(p.tick||0)+dt; const n=norm(enemy.x-p.x,enemy.y-p.y); p.x=clamp(p.x+n.x*210*dt,55,945); p.y=clamp(p.y+n.y*210*dt,55,945);
        while(p.tick>=1){p.tick-=1;if(dist(p.x,p.y,enemy.x,enemy.y)<p.radius+enemy.radius+40)enemy.takeDamage(2,owner,'straw-monster');}
      }
    }
    oldUP2(dt);
    safeProjectilesCap();
  };

  const oldUpdate2=update;
  update=function(dt){
    oldUpdate2(dt);
    // Remove excessive dead Slime bodies and hard-clamp every fighter; prevents disappearing / NaN lock.
    for(const f of fighters) safeClamp(f);
    for(let i=fighters.length-1;i>=0;i--){
      const f=fighters[i];
      if(!f) fighters.splice(i,1);
      else if(i>1 && f.hp<=0) fighters.splice(i,1);
    }
    safeProjectilesCap();
  };
})();


// ===== GLOBAL RUNTIME STABILITY GUARD: prevent random frame-freeze from draw/update exceptions =====
(function GLOBAL_RUNTIME_STABILITY_GUARD(){
  let updateErrors = 0, drawErrors = 0;
  const rawUpdateStable = update;
  const rawDrawStable = draw;
  function stableClean() {
    try {
      for (const f of fighters || []) {
        if (!f) continue;
        if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) { f.x = GAME_SIZE/2; f.y = GAME_SIZE/2; }
        if (!Number.isFinite(f.hp)) f.hp = Math.max(1, f.maxHp || 100);
        const r = f.radius || 40;
        f.x = clamp(f.x, r, GAME_SIZE-r); f.y = clamp(f.y, r, GAME_SIZE-r);
        if (!f.dir || !Number.isFinite(f.dir.x) || !Number.isFinite(f.dir.y)) f.dir = norm(rand(-1,1), rand(-1,1));
      }
      // Absolute safety cap: Slime mitosis must be visible but cannot create endless live bodies.
      const slimeTeams = new Map();
      for (const f of fighters || []) if (f && f.name === 'SLIME' && f.hp > 0) {
        const tid = f.teamId ?? f.id;
        if (!slimeTeams.has(tid)) slimeTeams.set(tid, []);
        slimeTeams.get(tid).push(f);
      }
      for (const [, arr] of slimeTeams) {
        arr.sort((a,b)=>(a.data?.cloneDepth||0)-(b.data?.cloneDepth||0) || b.hp-a.hp);
        for (const extra of arr.slice(4)) extra.hp = 0;
      }
      for (let i=fighters.length-1;i>=2;i--) if (!fighters[i] || fighters[i].hp <= 0) fighters.splice(i,1);
      for (let i=projectiles.length-1;i>=0;i--) {
        const p=projectiles[i];
        if(!p || p.life<=0 || p.hp<=0 || (p.x!==undefined && (!Number.isFinite(p.x)||!Number.isFinite(p.y)))) projectiles.splice(i,1);
      }
      if (projectiles.length > 180) projectiles.splice(0, projectiles.length - 180);
      if (particles.length > 350) particles.splice(0, particles.length - 350);
      if (floatingTexts.length > 120) floatingTexts.splice(0, floatingTexts.length - 120);
      if (shockwaves.length > 80) shockwaves.splice(0, shockwaves.length - 80);
    } catch (_) {}
  }
  update = function(dt){
    try {
      rawUpdateStable(Math.min(0.033, Math.max(0, dt || 0)));
    } catch (err) {
      updateErrors++;
      console.error('[Apex runtime update recovered]', err);
      stableClean();
      if (updateErrors <= 3 && typeof FloatingText !== 'undefined' && fighters && fighters[0]) {
        floatingTexts.push(new FloatingText(500,80,'RECOVERED UPDATE FRAME','#ffb36b'));
      }
    }
  };
  draw = function(){
    try {
      rawDrawStable();
    } catch (err) {
      drawErrors++;
      console.error('[Apex runtime draw recovered]', err);
      try {
        ctx.save();
        ctx.setTransform && ctx.setTransform(1,0,0,1,0,0);
        ctx.fillStyle = '#0d0b0a'; ctx.fillRect(0,0,GAME_SIZE,GAME_SIZE);
        drawBackground(ctx);
        for (const f of fighters || []) if (f && f.hp > 0) f.draw(ctx);
        ctx.fillStyle = '#ffb36b'; ctx.font = '900 24px monospace'; ctx.textAlign = 'center';
        if (drawErrors <= 3) ctx.fillText('DRAW FRAME RECOVERED', GAME_SIZE/2, 70);
        ctx.restore();
        updateHUD();
      } catch (_) {}
      stableClean();
    }
  };
})();


// ===== SLIME LIVE BODY CAP PATCH =====
(function SLIME_BODY_CAP_PATCH(){
  const oldUpdateCap = update;
  update = function(dt){
    oldUpdateCap(dt);
    try {
      const teams = new Map();
      for (const f of fighters || []) if (f && f.name === 'SLIME' && f.hp > 0) {
        const tid = f.teamId ?? f.id;
        if (!teams.has(tid)) teams.set(tid, []);
        teams.get(tid).push(f);
      }
      for (const [, arr] of teams) {
        arr.sort((a,b)=>(a.data?.cloneDepth||0)-(b.data?.cloneDepth||0) || b.hp-a.hp);
        for (const extra of arr.slice(4)) extra.hp = 0;
      }
      for (let i=fighters.length-1;i>=2;i--) if (!fighters[i] || fighters[i].hp <= 0) fighters.splice(i,1);
    } catch(e) { console.error('[Slime body cap recovered]', e); }
  };
})();

// ===== FINAL CANONICAL IDENTITY + BALANCE MERGE PATCH =====
window.apexBeforeFinalPatch = true;
(function FINAL_CANONICAL_IDENTITY_BALANCE_MERGE(){
  try {
  window.apexInsideFinalPatch = true;
  const FT = name => FighterTypes.find(f => f.name === name);
  const fmt = n => Number.isFinite(n) ? n.toFixed(1) : '0.0';
  const topSource = f => {
    const rows = Object.entries(f?.damageLabels || {}).sort((a,b)=>b[1]-a[1]);
    return rows[0] ? `${rows[0][0]} ${fmt(rows[0][1])}` : 'none';
  };

  // Canonical roster normalization: the original mechanics remain, but public names are final.
  const monk = FT('MONK');
  if (monk) monk.name = 'KUNGFU';
  const wind = FT('WIND');
  if (wind) wind.name = 'PUPPET';
  if (SOUND_ID.MONK && !SOUND_ID.KUNGFU) SOUND_ID.KUNGFU = SOUND_ID.MONK;
  if (SOUND_ID.WIND && !SOUND_ID.PUPPET) SOUND_ID.PUPPET = { base:265, wave:'triangle', bend:.7, noise:.04 };
  const glyphOld = fighterGlyph;
  fighterGlyph = function(name){
    if(name === 'KUNGFU') return '尚武';
    if(name === 'PUPPET') return 'PUP';
    return glyphOld(name);
  };
  const menuCopy = document.querySelector('#menu-screen p');
  if (menuCopy) menuCopy.textContent = '32 Fighters. Canonical Identity + Balance Merge. Arena 1000x1000.';

  // Public, non-hidden numeric tuning learned from the balanced project. These are speed/cooldown/lifetime nudges only;
  // damage remains tagged by the original skill source names.
  const tuningNotes = {
    TOXIC:'poison tempo softened; charge/heal remains visible',
    BLACK_HOLE:'gravity output normalized after stale-well cleanup',
    PAINTER:'guard cannot create near-immortality',
    SLIME:'body cap is visible and defensive layers are finite',
    PUPPET:'effigy FIFO and final card preserved',
    KUNGFU:'showcase buff kept through combo timing, not anonymous damage',
    PIRATE:'anchor/loot fantasy preserved with longer loot lifetime'
  };
  window.APEX_CANONICAL_MERGE_NOTES = tuningNotes;

  const CANONICAL_NUMERIC_TUNING = {
    RUBBER:{out:.95,taken:1.08,cd:.96,speed:1.00},
    ICE:{out:1.06,taken:.98,cd:1.04},
    SLIME:{out:.94,taken:1.14,cd:.96,speed:.98},
    PUPPET:{out:.92,taken:1.15,cd:.94,speed:.98},
    SUPERSTAR:{out:.86,taken:1.14,cd:.88},
    HUNTER:{out:1.08,taken:.96,cd:1.06,speed:1.03},
    KUNGFU:{out:1.15,taken:.90,cd:1.15,speed:1.06},
    PIRATE:{out:1.15,taken:.85,cd:1.15,speed:1.06},
    MAGNET:{out:1.15,taken:.92,cd:1.12,speed:1.03},
    TIME:{out:1.08,taken:.96,cd:1.06},
    MIRROR:{out:1.06,taken:.98,cd:1.04},
    CRYSTAL:{out:1.06,taken:.98,cd:1.04},
    BLADE:{out:.90,taken:1.10,cd:.94},
    PAINTER:{out:1.08,taken:.96,cd:1.06,speed:1.03},
    WITCH:{out:1.15,taken:.88,cd:1.12,speed:1.05},
    VAMPIRE:{out:1.06,taken:.97,cd:1.04,speed:1.02},
    NOVA:{out:1.15,taken:.92,cd:1.12},
    ELECTRIC:{out:1.08,taken:.96,cd:1.06},
    FLASH:{out:1.06,taken:.98,cd:1.04},
    SAW:{out:1.06,taken:.98,cd:1.04},
    DRUM:{out:1.06,taken:.98,cd:1.04},
    WOLF:{out:1.08,taken:.96,cd:1.06},
    CARD:{out:.92,taken:1.08,cd:.94},
    BLACK_HOLE:{out:1.04,taken:1.00,cd:1.02},
    MATH:{out:.96,taken:1.05,cd:.98},
    SPIDER:{out:1.06,taken:.98,cd:1.04},
    VOLCANO:{out:1.06,taken:.98,cd:1.04},
    SNIPER:{out:1.08,taken:.96,cd:1.06},
    ORBIT:{out:1.06,taken:.98,cd:1.04},
    VIRUS:{out:1.06,taken:.98,cd:1.04},
    MATH_V2:{out:1.00,taken:1.02,cd:1.00},
    TOXIC:{out:.92,taken:1.08,cd:.94}
  };
  window.APEX_VISIBLE_BALANCE_TUNING = CANONICAL_NUMERIC_TUNING;
  for (const ft of FighterTypes) {
    const t = CANONICAL_NUMERIC_TUNING[ft.name];
    if (t && t.speed && !ft.__speedTuned) { ft.speed = Math.max(260, ft.speed * t.speed); ft.__speedTuned = true; }
  }
  const abilityDtCanonical = abilityDt;
  abilityDt = function(f, dt){
    const t = CANONICAL_NUMERIC_TUNING[f?.name];
    return abilityDtCanonical(f, dt) * (t?.cd || 1);
  };
  const takeDamageCanonicalBalance = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source=null, label='', statusDamage=false){
    let tuned = amount;
    const st = CANONICAL_NUMERIC_TUNING[source?.name];
    const tt = CANONICAL_NUMERIC_TUNING[this?.name];
    if (source && source !== this && st?.out) tuned *= st.out;
    if (source && source !== this && tt?.taken) tuned *= tt.taken;
    if (source && source !== this && amount >= 15 && (Math.abs((st?.out||1)-1)>.01 || Math.abs((tt?.taken||1)-1)>.01)) {
      const main = label || 'hit';
      floatingTexts.push(new FloatingText(this.x,this.y-this.radius-118,`RAW ${amount.toFixed(1)} ${main} FINAL ${tuned.toFixed(1)}`, '#f2e2bd'));
    }
    return takeDamageCanonicalBalance.call(this, tuned, source, label, statusDamage);
  };

  // Enforce visible Rage text only while active, and add readable per-fighter counters required for spectators.
  const oldDrawFighterFinal = Fighter.prototype.draw;
  Fighter.prototype.draw = function(ctx){
    oldDrawFighterFinal.call(this, ctx);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 12px monospace';
    const y0 = -this.radius - 42;
    const lines = [];
    if (this.isRage) lines.push(['RAGE ACTIVE', '#ffe66d']);
    const bt = CANONICAL_NUMERIC_TUNING[this.name];
    if (bt && (Math.abs((bt.out||1)-1)>.01 || Math.abs((bt.taken||1)-1)>.01 || Math.abs((bt.cd||1)-1)>.01)) lines.push([`Fine Tune O${(bt.out||1).toFixed(2)} D${(bt.taken||1).toFixed(2)} C${(bt.cd||1).toFixed(2)}`, '#d0c6ad']);
    if (this.name === 'ELECTRIC') lines.push([`CHARGE ${this.data.wallHits||0}${this.isRage?`+${this.data.rageContactCharge||0}`:''}`, '#bde5ff']);
    if (this.name === 'TOXIC' && this.data.toxicCharge) lines.push([`TOXIC CHARGE ${fmt(this.data.toxicCharge.amount||0)}`, '#caff58']);
    if (this.name === 'BLACK_HOLE') {
      const well = projectiles.find(p=>p.type==='gravity_well'&&p.owner===this&&p.life>0);
      if (well) lines.push([`ABSORB ${fmt(well.absorbedDamage||0)}`, '#b48cff']);
    }
    if (this.name === 'PUPPET') lines.push([`PUPPETS ${projectiles.filter(p=>p.type==='puppet_effigy'&&p.owner===this&&p.hp>0&&p.life>0).length}`, '#d7b27a']);
    if (this.name === 'SLIME') {
      const bodies = fighters.filter(f=>f&&f.name==='SLIME'&&(f.teamId??f.id)===(this.teamId??this.id)&&f.hp>0).length;
      const kids = projectiles.filter(p=>p.type==='slime_child'&&p.owner===this&&p.hp>0&&p.life>0).length;
      lines.push([`BODY ${bodies} CHILD ${kids}`, '#caffbb']);
    }
    if (this.name === 'SUPERSTAR') lines.push([`FANS ${projectiles.filter(p=>p.type==='superfan'&&p.owner===this&&p.hp>0&&p.life>0).length}`, '#ff9ee2']);
    if (this.name === 'VAMPIRE' && (this.data.bloodLinkLevel||0)>0) lines.push([`BLOOD LINK ${this.data.bloodLinkLevel}`, '#ff4a62']);
    if (this.name === 'MATH' && this.data?.expr) lines.push([String(this.data.expr).slice(0,22), '#f4efe3']);
    if (this.name === 'SNIPER') lines.push([this.data.hiddenReload?'HIDDEN RELOAD':(this.data.aim>0?`AIM ${fmt(this.data.aim)}`:'NEST READY'), '#d7dde5']);
    if (this.name === 'TIME' && this.data.mark) lines.push([`MARK ${fmt(this.data.mark.timer)}`, '#d6d0ff']);
    if (this.name === 'KUNGFU') { const kEnemy = fighters.find(q => q && q !== this && q.hp > 0 && ((q.teamId ?? q.id) !== (this.teamId ?? this.id))) || fighters.find(q => q && q !== this); lines.push([`COMBO ${this.data.combo||0} TRAUMA ${kEnemy?.statuses?.innerTrauma?.stacks||0}`, '#ffd28a']); }
    for(let i=0;i<Math.min(3,lines.length);i++){
      ctx.fillStyle = 'rgba(0,0,0,.72)';
      ctx.fillRect(-82, y0 - i*18 - 14, 164, 16);
      ctx.fillStyle = lines[i][1];
      ctx.fillText(lines[i][0], 0, y0 - i*18);
    }
    ctx.restore();
  };

  // Tournament result enrichment and award summary. Bracket reveal logic stays canonical: future opponents remain hidden until advanced.
  const oldCompleteTournamentMatchFinal = completeTournamentMatch;
  completeTournamentMatch = function(winner, loser){
    const match = tournamentFindMatch(activeTournamentMatchId);
    if(!match) return oldCompleteTournamentMatchFinal(winner, loser);
    const duration = Math.max(.1, matchClock || ((performance.now()-matchStartTime)/1000));
    const all = fighters.filter(Boolean);
    const biggestOwner = all.slice().sort((a,b)=>(b.maxHit||0)-(a.maxHit||0))[0] || winner;
    const result = {
      duration,
      winnerHp:winner.hp, loserHp:loser.hp,
      winnerDamage:winner.damageDone||0, loserDamage:loser.damageDone||0,
      winnerStandard:winner.standardDamageDone||0, loserStandard:loser.standardDamageDone||0,
      winnerNormal:winner.normalDamageDone||0, loserNormal:loser.normalDamageDone||0,
      winnerTopStandard:sortedBreakdown(winner.standardDamageLabels||{}),
      loserTopStandard:sortedBreakdown(loser.standardDamageLabels||{}),
      winnerHybridRaw:Object.values(winner.hybridRawLog||{}).reduce((a,b)=>a+b,0),
      loserHybridRaw:Object.values(loser.hybridRawLog||{}).reduce((a,b)=>a+b,0),
      winnerTaken:winner.damageTaken||0, loserTaken:loser.damageTaken||0,
      winnerHealing:winner.healingDone||0, loserHealing:loser.healingDone||0,
      biggest:Math.max(winner.maxHit||0, loser.maxHit||0),
      biggestOwner:biggestOwner.name,
      label:sortedBreakdown(winner.damageLabels||{}),
      winnerTopSource:topSource(winner),
      loserTopSource:topSource(loser),
      control:(winner.dotDamage||0)+(winner.skillsUsed||0)*2,
      summons:projectiles.filter(p=>p.owner===winner&&(p.type||'').match(/slime|puppet|straw|virus|superfan/)).length,
      comeback:Math.max(0, 100-(winner.rageStartHp||winner.hp||100)),
      stylish:(winner.skillsUsed||0)+(winner.maxHit||0)/10+(winner.isRage?10:0)
    };
    tournamentSetWinner(match, winner.name, loser.name, false, tournamentState, result);
    activeTournamentMatchId = null;
  };
  buildTournamentSummary = function(){
    const st=tournamentState; if(!st) return '';
    const log=st.log||[];
    const pick=(fn,empty='-')=>log.length?log.slice().sort(fn)[0]:null;
    const champion=st.champion;
    const dmg=pick((a,b)=>(b.result.winnerDamage||0)-(a.result.winnerDamage||0));
    const hit=pick((a,b)=>(b.result.biggest||0)-(a.result.biggest||0));
    const fast=pick((a,b)=>(a.result.duration||999)-(b.result.duration||999));
    const clutch=pick((a,b)=>(a.result.winnerHp||999)-(b.result.winnerHp||999));
    const heal=pick((a,b)=>(b.result.winnerHealing||0)-(a.result.winnerHealing||0));
    const ctrl=pick((a,b)=>(b.result.control||0)-(a.result.control||0));
    const sum=pick((a,b)=>(b.result.summons||0)-(a.result.summons||0));
    const comeback=pick((a,b)=>(b.result.comeback||0)-(a.result.comeback||0));
    const style=pick((a,b)=>(b.result.stylish||0)-(a.result.stylish||0));
    const survival=pick((a,b)=>(b.result.duration||0)-(a.result.duration||0));
    const std=pick((a,b)=>(b.result.winnerStandard||0)-(a.result.winnerStandard||0));
    const hybrid=pick((a,b)=>(b.result.winnerHybridRaw||0)-(a.result.winnerHybridRaw||0));
    const awards=[
      ['Champion', champion||'-'],
      ['Damage Lord', dmg?`${dmg.winner} ${fmt(dmg.result.winnerDamage)} / ${dmg.result.winnerTopSource}`:'-'],
      ['Standard Damage Lord', std?`${std.winner} ${fmt(std.result.winnerStandard)} / ${std.result.winnerTopStandard||'-'}`:'-'],
      ['Best True-Number Kill', std?`${std.winner} ${fmt(std.result.winnerStandard)} bypass`:'-'],
      ['Best Hybrid Hit', hybrid?`${hybrid.winner} raw ${fmt(hybrid.result.winnerHybridRaw)}`:'-'],
      ['Number Master', hybrid?`${hybrid.winner} STD ${fmt(hybrid.result.winnerStandard)} NORM ${fmt(hybrid.result.winnerNormal)}`:'-'],
      ['Biggest Hit', hit?`${hit.result.biggestOwner||hit.winner} ${fmt(hit.result.biggest)}`:'-'],
      ['Fastest Kill', fast?`${fast.winner} ${fmt(fast.result.duration)}s`:'-'],
      ['Clutch King', clutch?`${clutch.winner} ${fmt(clutch.result.winnerHp)} HP`:'-'],
      ['Healer', heal?`${heal.winner} ${fmt(heal.result.winnerHealing)}`:'-'],
      ['Most Control', ctrl?`${ctrl.winner} ${fmt(ctrl.result.control)}`:'-'],
      ['Most Summons', sum?`${sum.winner} ${sum.result.summons||0}`:'-'],
      ['Most Comeback', comeback?`${comeback.winner} ${fmt(comeback.result.comeback)}`:'-'],
      ['Most Stylish Win', style?`${style.winner} ${fmt(style.result.stylish)}`:'-'],
      ['Longest Survival', survival?`${survival.winner} ${fmt(survival.result.duration)}s`:'-']
    ];
    const cards=awards.map(a=>`<div class="summary-card"><span>${a[0]}</span><b>${a[1]}</b></div>`).join('');
    const banner=champion?`<div class="champion-banner"><h2 style="color:${tournamentFighterStyle(champion)}">${champion} CHAMPION</h2><div>Full 32-fighter canonical bracket complete. Damage/heal sources are preserved in match stats.</div></div>`:'';
    return `${banner}<div class="tournament-summary">${cards}</div>`;
  };

  // Browser QA/stress runner: runs deterministic accelerated matches in-place and reports object caps/runtime errors.
  const qa = { runtimeErrors:0, maxProjectiles:0, maxFighters:0, samples:[] };
  window.addEventListener('error', e => { qa.runtimeErrors++; qa.lastError = e.message; });
  const oldUpdateFinal = update;
  update = function(dt){
    oldUpdateFinal(dt);
    qa.maxProjectiles = Math.max(qa.maxProjectiles, projectiles.length);
    qa.maxFighters = Math.max(qa.maxFighters, fighters.length);
  };
  function runQaMatch(aName,bName,seconds=210){
    const a=fighterTypeByName(aName), b=fighterTypeByName(bName);
    if(!a||!b) return {matchup:`${aName} vs ${bName}`, error:'missing fighter'};
    startSpecificMatch(a,b,{countdown:false,tournament:false});
    let frames=0, maxObj=0;
    while(gameState==='PLAYING' && matchClock<seconds && frames<seconds*30){
      update(1/30);
      maxObj=Math.max(maxObj, projectiles.length+particles.length+fighters.length);
      frames++;
    }
    const alive=fighters.filter(f=>f&&f.hp>0).sort((x,y)=>y.hp-x.hp);
    const winner=alive[0]?.name || 'NONE';
    const res={
      matchup:`${aName} vs ${bName}`,
      winner,
      duration:Number(matchClock.toFixed(2)),
      ko:gameState==='END'||fighters.some(f=>f.hp<=0),
      timeout:matchClock>=seconds,
      maxObjects:maxObj,
      runtimeErrors:qa.runtimeErrors,
      damage:fighters.map(f=>({name:f.name,dealt:fmt(f.damageDone||0),normal:fmt(f.normalDamageDone||0),standard:fmt(f.standardDamageDone||0),taken:fmt(f.damageTaken||0),stdTaken:fmt(f.standardDamageTaken||0),heal:fmt(f.healingDone||0),big:fmt(f.maxHit||0),source:topSource(f),standardSource:sortedBreakdown(f.standardDamageLabels||{})}))
    };
    qa.samples.push(res);
    return res;
  }
  window.apexFinalQA = {
    smoke(){
      const pairs=[['FLASH','TOXIC'],['VAMPIRE','BLADE'],['SLIME','SNIPER'],['PUPPET','ELECTRIC'],['MIRROR','BLACK_HOLE'],['KUNGFU','PIRATE']];
      return pairs.map(p=>runQaMatch(p[0],p[1],210));
    },
    stress(){
      const names=['SLIME','PUPPET','FLASH','SNIPER','MAGNET','VAMPIRE','PAINTER','KUNGFU'];
      const out=[];
      for(let i=0;i<names.length;i++) for(let j=i+1;j<names.length;j++) out.push(runQaMatch(names[i],names[j],240));
      return out;
    },
    roundRobin(limitSeconds=180){
      const names=FighterTypes.map(f=>f.name);
      const table={};
      for(const n of names) table[n]={w:0,l:0,t:0,dur:0};
      for(let i=0;i<names.length;i++) for(let j=0;j<names.length;j++) if(i!==j){
        const r=runQaMatch(names[i],names[j],limitSeconds);
        table[names[i]].dur+=r.duration;
        if(r.winner===names[i]) table[names[i]].w++; else if(r.winner===names[j]) table[names[i]].l++; else table[names[i]].t++;
      }
      return {table, maxProjectiles:qa.maxProjectiles, maxFighters:qa.maxFighters, runtimeErrors:qa.runtimeErrors, samples:qa.samples};
    },
    state:qa
  };

  // Mechanics-first rebalance pass: keep only light public fine tuning; put power back into readable skills.
  const mechFT = name => FighterTypes.find(f => f.name === name);
  const mechNote = (x,y,t,c)=>floatingTexts.push(new FloatingText(x,y,t,c));

  const mechVamp = mechFT('VAMPIRE');
  if (mechVamp) {
    mechVamp.speed = Math.max(mechVamp.speed || 500, 525);
    mechVamp.update = function(f,e,dt){
      if(f.data.latchTimer>0){
        f.data.positionLocked=true;
        f.data.latchTimer-=dt;
        const off=f.data.latchOffset||norm(f.x-e.x,f.y-e.y);
        const gap=e.radius+f.radius+2;
        f.x=clamp(e.x+off.x*gap,f.radius,GAME_SIZE-f.radius);
        f.y=clamp(e.y+off.y*gap,f.radius,GAME_SIZE-f.radius);
        f.setDir(e.x-f.x,e.y-f.y);
        e.applyStatus('slow',0.18,{mult:.38,source:f});
        f.data.latchTick=(f.data.latchTick||0)+dt;
        while(f.data.latchTick>=.5){
          f.data.latchTick-=.5;
          const d=scaledByMirror(f,3);
          e.takeDamage(d,f,'fang-blood-drain');
          f.heal(d,true);
          mechNote(e.x,e.y-e.radius-82,`DRAIN ${d.toFixed(1)}`,'#ff4a62');
        }
        if(f.data.latchTimer<=0) f.data.latchCd=1.75;
      } else {
        f.data.latchCd=Math.max(0,(f.data.latchCd||0)-abilityDt(f,dt));
      }
      if(f.isRage && (f.data.bloodLinkLevel||0)>0){
        f.data.linkTick=(f.data.linkTick||0)+dt;
        while(f.data.linkTick>=.5){
          f.data.linkTick-=.5;
          const d=.8*f.data.bloodLinkLevel;
          e.takeDamage(d,f,'permanent-blood-link',true);
          f.heal(d,true);
          if(f.data.bloodLinkLevel>=4) e.applyStatus('slow',1.5,{mult:.82,source:f});
        }
      }
    };
    mechVamp.onCollide = function(f,e){
      if((f.data.latchCd||0)>0 || f.data.latchTimer>0) return false;
      const toEnemy=norm(e.x-f.x,e.y-f.y);
      const fangDir=norm(f.dir.x||toEnemy.x,f.dir.y||toEnemy.y);
      const front=dot(toEnemy.x,toEnemy.y,fangDir.x,fangDir.y);
      if(front<-.05){mechNote(f.x,f.y-f.radius-62,'BITE MISS','#bb2038'); return false;}
      f.data.latchOffset=norm(f.x-e.x,f.y-e.y);
      f.data.latchTimer=5.0;
      f.data.latchTick=0;
      f.data.latchCd=2.0;
      if(f.isRage){f.data.bloodLinkLevel=(f.data.bloodLinkLevel||0)+1; mechNote(e.x,e.y-e.radius-84,`BLOOD LINK ${f.data.bloodLinkLevel}`,'#ff3040');}
      mechNote(f.x,f.y-f.radius-76,'FANG LOCK','#e43d57');
      playFighterSound(f,'skill');
      return true;
    };
  }

  const mechElectric = mechFT('ELECTRIC');
  if (mechElectric) {
    mechElectric.noRage=false;
    mechElectric.onRage = f => { f.data.ragePulse=5; f.data.rageContactCharge=0; mechNote(f.x,f.y-f.radius-98,'TIMED OVERCHARGE 5s','#bde5ff'); };
    mechElectric.update = function(f,e,dt){
      if(f.isRage){
        f.data.ragePulse=(f.data.ragePulse||5)-dt;
        if(f.data.ragePulse<=0 && e){
          f.data.ragePulse=5;
          const charge=clamp(Math.max(1,(f.data.wallHits||0)+(f.data.rageContactCharge||0)),1,10);
          const raw=.0025*((f.maxHp-f.hp)+12)*Math.pow(2,charge);
          const dmg=raw<=60?raw:60+(raw-60)*.22;
          const nodes=(f.data.wallNodes||[]).slice(-24); if(!nodes.length) nodes.push({x:f.x,y:f.y});
          nodes.forEach(n=>projectiles.push({type:'electric_trail',owner:f,x1:n.x,y1:n.y,x2:e.x,y2:e.y,life:.4,maxLife:.4,charge}));
          spawnShockwave(e.x,e.y,'#75cfff',180+charge*10);
          e.takeDamage(dmg,f,'electric-rage-5s-discharge');
          f.heal(dmg*.5,false);
          mechNote(e.x,e.y-e.radius-102,`CH ${charge} DMG ${dmg.toFixed(1)} HEAL ${(dmg*.5).toFixed(1)}`,'#bde5ff');
          f.data.wallHits=0; f.data.wallNodes=[]; f.data.rageContactCharge=0;
          playFighterSound(f,'skill');
        }
        return;
      }
      f.data.wallHits=f.data.wallHits||0;
      f.data.wallNodes=f.data.wallNodes||[];
    };
    mechElectric.onWallBounce = function(f,wall){
      f.data.wallHits=clamp((f.data.wallHits||0)+1,0,10);
      const pnt={x:f.x,y:f.y}; if(wall==='left')pnt.x=0; if(wall==='right')pnt.x=GAME_SIZE; if(wall==='top')pnt.y=0; if(wall==='bottom')pnt.y=GAME_SIZE;
      f.data.wallNodes.push(pnt);
      projectiles.push({type:'electric_node',owner:f,x:pnt.x,y:pnt.y,radius:18,life:3.2,maxLife:3.2,visualOnly:true});
      mechNote(pnt.x,pnt.y-28,`CHARGE ${f.data.wallHits}`,'#bde5ff');
    };
    mechElectric.onCollide = function(f,e){
      if(f.isRage){ f.data.rageContactCharge=clamp((f.data.rageContactCharge||0)+1,0,10); mechNote(e.x,e.y-e.radius-76,'CONTACT +1 CHARGE','#bde5ff'); return false; }
      const charge=clamp(f.data.wallHits||0,0,10);
      if(charge<=0) return false;
      const raw=.0025*((f.maxHp-f.hp)+12)*Math.pow(2,charge);
      const dmg=raw<=60?raw:60+(raw-60)*.22;
      (f.data.wallNodes||[]).slice(-24).forEach(n=>projectiles.push({type:'electric_trail',owner:f,x1:n.x,y1:n.y,x2:e.x,y2:e.y,life:.35,maxLife:.35,charge}));
      e.takeDamage(dmg,f,'electric-charge-discharge');
      mechNote(e.x,e.y-e.radius-84,`DISCHARGE ${charge} CH`,'#bde5ff');
      f.data.wallHits=0; f.data.wallNodes=[];
      playFighterSound(f,'skill');
      return false;
    };
  }

  const mechKung = mechFT('KUNGFU');
  if (mechKung) {
    mechKung.onCollide=function(f,e){
      if((f.data.hitCd||0)>0) return false;
      f.data.hitCd=.42;
      if(f.data.rushTimer>0){
        if((f.data.rushHitCd||0)<=0){
          if((e.statuses.innerTrauma?.stacks||0)>=30){ e.data.kungfuHidden=(e.data.kungfuHidden||0)+3; mechNote(e.x,e.y-e.radius-105,`QI STORED ${e.data.kungfuHidden}`,'#ff9b50'); }
          else addInnerTrauma(e,2);
          e.takeDamage(3.5,f,'trauma-rush-hit');
          f.data.rushHitCd=.15; projectiles.push({type:'kungfu_qi',owner:f,x:e.x,y:e.y,life:.35,maxLife:.35}); playFighterSound(f,'wall');
        }
        return true;
      }
      f.data.combo=((f.data.combo||0)%5)+1; f.data.comboTimer=5;
      const c=f.data.combo; mechNote(f.x,f.y-f.radius-78,`COMBO ${c}`,'#ffd28a');
      if(c===1){ e.takeDamage(10,f,'kungfu-qi-punch'); projectiles.push({type:'kungfu_qi',owner:f,x:e.x,y:e.y,life:.45,maxLife:.45}); playFighterSound(f,'skill'); }
      else if(c===2){ e.applyStatus('rapidPunch',2.0,{source:f,tick:0}); mechNote(e.x,e.y-e.radius-88,'RAPID FISTS','#ffd28a'); }
      else if(c===3){ e.takeDamage(24,f,'giant-palm'); const n=norm(e.x-f.x,e.y-f.y); e.applyStatus('push',.8,{x:n.x,y:n.y,strength:2100}); projectiles.push({type:'kungfu_palm',owner:f,x:f.x,y:f.y,vx:n.x*520,vy:n.y*520,life:1.1,maxLife:1.1}); }
      else if(c===4){ e.takeDamage(9,f,'trauma-rush-start'); e.applyStatus('stun',.55,{source:f}); f.data.rushTimer=4.2; f.data.rushHitCd=0; mechNote(e.x,e.y-e.radius-100,'TRAUMA RUSH','#ff9b50'); }
      else if(c===5 && f.isRage){ e.applyStatus('stun',.8,{source:f}); projectiles.push({type:'kungfu_rage_seal',owner:f,x:e.x,y:e.y,life:1,maxLife:1}); e.takeDamage(22,f,'dim-mak-qi-seal'); }
      return true;
    };
  }

  const mechSlime = mechFT('SLIME');
  if (mechSlime) {
    mechSlime.update=function(f,e,dt){
      f.data.childSpawnCd=Math.max(0,(f.data.childSpawnCd||0)-dt);
      f.data.cloneCd=Math.max(0,(f.data.cloneCd||0)-dt);
      f.data.slimeDmgWindow=(f.data.slimeDmgWindow||[]).filter(x=>matchClock-x.t<=5);
      const sum=f.data.slimeDmgWindow.reduce((s,x)=>s+x.amount,0);
      const kids=projectiles.filter(p=>p.type==='slime_child'&&p.owner===f&&p.hp>0&&p.life>0).length;
      if(sum>=4 && f.data.childSpawnCd<=0 && kids<8){ projectiles.push({type:'slime_child',owner:f,angle:Math.random()*TAU,radius:24,hp:8,life:5.5,maxLife:5.5,hitCd:{},blockCd:0,damageDone:0,damage:2.2,spawnTime:matchClock}); f.data.slimeDmgWindow=[]; f.data.childSpawnCd=.9; mechNote(f.x,f.y-f.radius-82,'+SLIME CHILD','#caffbb'); }
    };
  }

  const mechPuppet = mechFT('PUPPET');
  if (mechPuppet) {
    mechPuppet.onWallBounce=function(f,wall){
      f.data.wallHitStamp ||= {};
      if(matchClock-(f.data.wallHitStamp[wall]||-99)<.22) return;
      f.data.wallHitStamp[wall]=matchClock;
      const pos={x:f.x,y:f.y}; if(wall==='left')pos.x=0; if(wall==='right')pos.x=GAME_SIZE; if(wall==='top')pos.y=0; if(wall==='bottom')pos.y=GAME_SIZE;
      projectiles.push({type:'puppet_effigy',owner:f,x:pos.x,y:pos.y,radius:75,hp:7,life:28,maxLife:28,wall,order:matchClock+Math.random()*0.0001});
      mechNote(pos.x,pos.y-85,'EFFIGY 7HP','#d7b27a');
      const list=projectiles.filter(p=>p.type==='puppet_effigy'&&p.owner===f&&p.wall===wall&&p.hp>0&&p.life>0).sort((a,b)=>(a.order||0)-(b.order||0));
      if(list.length>=5){ list.slice(0,5).forEach(p=>p.life=0); projectiles.push({type:'straw_monster',owner:f,x:pos.x,y:pos.y,radius:55,hp:20,life:18,maxLife:18,tick:0}); mechNote(pos.x,pos.y-105,'STRAW MONSTER 20HP','#d7b27a'); }
    };
  }

  const mechTime = mechFT('TIME');
  if (mechTime) {
    mechTime.update=function(f,e,dt){
      f.data.clockCd=(f.data.clockCd||4)-abilityDt(f,dt);
      if(f.data.clockCd<=0 && e){
        f.data.clockCd=4.0;
        const num=clockDamageValue();
        const dmg=num+2;
        if (window.apexDealHybridNumericDamage) window.apexDealHybridNumericDamage(e,f,dmg,'clock-hour-strike');
        else e.takeDamage(dmg,f,'clock-hour-strike');
        projectiles.push({type:'clock_flash',owner:f,num,life:.9,maxLife:.9});
        mechNote(e.x,e.y-e.radius-80,`CLOCK ${num}+2`,'#efeaff');
      }
      if(f.data.mark){
        const m=f.data.mark;
        m.timer-=dt;
        if(m.timer<=0){
          f.x=m.x; f.y=m.y; f.hp=Math.max(f.hp,m.hp);
          if(m.damageDealt&&e) e.heal(m.damageDealt*.5,false);
          if(f.isRage&&m.damageTaken>0) spawnTimeRift(f,f.x,f.y,m.damageTaken);
          f.data.mark=null; f.data.markCd=7.5;
          mechNote(f.x,f.y-f.radius-90,'REWIND 50% REFUND','#efeaff');
        }
        return;
      }
      f.data.markCd=(f.data.markCd||2.5)-abilityDt(f,dt);
      if(f.data.markCd<=0){
        f.data.mark={x:f.x,y:f.y,hp:f.hp,timer:3,damageDealt:0,damageTaken:0};
        f.data.markCd=99;
        projectiles.push({type:'time_mark',owner:f,x:f.x,y:f.y,life:3,maxLife:3});
        mechNote(f.x,f.y-f.radius-85,'TIME MARK','#efeaff');
        playFighterSound(f,'skill');
      }
    };
  }

  // HYBRID STANDARD DAMAGE: only MATH, CARD, and TIME numeric hits use this helper.
  // The standard part bypasses defensive routing; the normal part still uses takeDamage.
  const normalDamageCounterBase = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source=null, label='', statusDamage=false){
    const beforeTaken = this.damageTaken || 0;
    const beforeSourceDone = source && source !== this ? (source.damageDone || 0) : 0;
    const beforeHp = this.hp;
    const result = normalDamageCounterBase.call(this, amount, source, label, statusDamage);
    const dealt = Math.max(0, beforeHp - this.hp);
    const normalDelta = Math.max(0, (this.damageTaken || 0) - beforeTaken);
    if (normalDelta > 0) this.normalDamageTaken = (this.normalDamageTaken || 0) + normalDelta;
    if (source && source !== this) {
      const sourceDelta = Math.max(0, (source.damageDone || 0) - beforeSourceDone);
      if (sourceDelta > 0) {
        source.normalDamageDone = (source.normalDamageDone || 0) + sourceDelta;
        source.normalDamageLabels ||= {};
        source.normalDamageLabels[label || 'direct'] = (source.normalDamageLabels[label || 'direct'] || 0) + sourceDelta;
      }
    }
    return result;
  };
  Fighter.prototype.takeStandardDamage = function(amount, source=null, label='standard-number'){
    if (this.hp <= 0 || amount <= 0) return 0;
    amount = Math.max(0, Number.isFinite(amount) ? amount : 0);
    if (amount <= 0) return 0;
    const before = this.hp;
    const bypassed = standardBypassHint(this);
    this.hp = Math.max(0, this.hp - amount);
    const dealt = Math.max(0, before - this.hp);
    if (dealt <= 0) return 0;
    this.damageTaken = (this.damageTaken || 0) + dealt;
    this.standardDamageTaken = (this.standardDamageTaken || 0) + dealt;
    if (bypassed) this.standardBypassedDefenseTaken = (this.standardBypassedDefenseTaken || 0) + dealt;
    if (source && source !== this) {
      source.damageDone = (source.damageDone || 0) + dealt;
      source.standardDamageDone = (source.standardDamageDone || 0) + dealt;
      source.standardDamageLabels ||= {};
      source.standardDamageLabels[label] = (source.standardDamageLabels[label] || 0) + dealt;
      source.hitsLanded = (source.hitsLanded || 0) + 1;
      source.maxHit = Math.max(source.maxHit || 0, dealt);
      if (bypassed) source.standardBypassCount = (source.standardBypassCount || 0) + 1;
    }
    floatingTexts.push(new FloatingText(this.x, this.y - this.radius - 34, `-${dealt.toFixed(dealt >= 10 ? 0 : 1)}`, '#ffffff'));
    emitParticles(this.x, this.y, '#ffffff', Math.min(24, 8 + Math.ceil(dealt)), 260, 4, .4, 'square');
    maybeTriggerStandardRageAndDeath(this);
    updateHUD();
    return dealt;
  };
  function standardBypassHint(target){
    if (!target) return false;
    if (target.name === 'MAGNET' && target.data?.fieldTimer > 0) return true;
    if (target.name === 'PUPPET' && projectiles.some(p=>p.type==='puppet_effigy'&&p.owner===target&&p.hp>0&&p.life>0)) return true;
    if (target.name === 'SLIME' && projectiles.some(p=>p.type==='slime_child'&&p.owner===target&&p.hp>0&&p.life>0)) return true;
    if (target.name === 'SUPERSTAR' && projectiles.some(p=>p.type==='superfan'&&p.owner===target&&p.hp>0&&p.life>0)) return true;
    if (target.name === 'BLACK_HOLE' && target.isRage && activeGravityWellFor(target)) return true;
    return target.hasStatus?.('immune') || target.hasStatus?.('painterGuard') || target.name === 'DRUM' && target.data?.rageSolo > 0;
  }
  function maybeTriggerStandardRageAndDeath(target){
    if (target.hp <= 50 && !target.isRage && !target.type.noRage) {
      target.isRage = true;
      target.rageStartHp = target.hp;
      playFighterSound(target, 'skill');
      emitParticles(target.x, target.y, target.color, 60, 540, 7, 1.2, 'square');
      spawnShockwave(target.x, target.y, target.color, 190);
      if (target.type.onRage) target.type.onRage(target);
    }
    if (target.hp <= 0 && target.name === 'PUPPET' && target.data && !target.data.finalCardActive) {
      target.hp = 1;
      target.data.finalCardActive = true;
      target.data.cardTimer = 5;
      spawnPuppetFinalCard(target);
      floatingTexts.push(new FloatingText(target.x, target.y - target.radius - 100, 'FINAL CARD', '#f1d8a8'));
      return;
    }
    if (target.hp <= 0 && !target.killSoundPlayed) {
      target.killSoundPlayed = true;
      playFighterSound(target, 'death');
      triggerSlowMoFinish();
    }
  }
  function dealHybridNumericDamage(target, source, rawDamage, label){
    if (!target || !source || rawDamage <= 0) return {standard:0, normal:0, normalFinal:0};
    const raw = Math.max(0, Number.isFinite(rawDamage) ? rawDamage : 0);
    const standardPart = Math.min(raw, 30);
    const normalPart = Math.max(0, raw - 30);
    source.hybridRawLog ||= {};
    source.hybridRawLog[label] = (source.hybridRawLog[label] || 0) + raw;
    const standardFinal = standardPart > 0 ? target.takeStandardDamage(standardPart, source, `${label}-standard`) : 0;
    let normalFinal = 0;
    if (normalPart > 0 && target.hp > 0) {
      const hpBefore = target.hp;
      target.takeDamage(normalPart, source, `${label}-normal`, false);
      normalFinal = Math.max(0, hpBefore - target.hp);
      if (normalFinal > 0) floatingTexts.push(new FloatingText(target.x + 18, target.y - target.radius - 72, `-${normalFinal.toFixed(normalFinal >= 10 ? 0 : 1)}`, '#ff5950'));
    }
    source.hybridHits ||= [];
    source.hybridHits.push({label, raw, standard:standardFinal, normalRaw:normalPart, normalFinal});
    return {standard:standardFinal, normal:normalPart, normalFinal};
  }
  window.apexDealHybridNumericDamage = dealHybridNumericDamage;

  const hybridPostMatchBase = buildPostMatchStats;
  buildPostMatchStats = function(winner, loser){
    const base = hybridPostMatchBase(winner, loser);
    const rows = fighters.map(f=>{
      const std = f.standardDamageDone || 0;
      const stdTaken = f.standardDamageTaken || 0;
      const norm = f.normalDamageDone || 0;
      const topStd = sortedBreakdown(f.standardDamageLabels || {}) || 'No standard source';
      const bypass = f.standardBypassCount || 0;
      return `<div class="summary-card"><span>${f.name} HYBRID</span><b>STD ${std.toFixed(1)} / NORM ${norm.toFixed(1)}</b><small>Taken STD ${stdTaken.toFixed(1)} · ${topStd} · bypass ${bypass}</small></div>`;
    }).join('');
    return `${base}<div class="tournament-summary">${rows}</div>`;
  };

  // NEXT MECHANICS-FIRST BALANCE PASS:
  // Local skill timing/reliability changes only. No extreme hidden whole-fighter tuning.
  (function nextMechanicsFirstPass(){
    const FT = name => FighterTypes.find(f => f.name === name);
    const note2 = (x,y,t,c)=>floatingTexts.push(new FloatingText(x,y,t,c));
    const clampNum = v => Number.isFinite(v) ? v : 0;

    const volcano = FT('VOLCANO');
    if (volcano) {
      volcano.update = function(f,e,dt){
        f.data.cd -= abilityDt(f,dt);
        if (f.data.cd <= 0) {
            f.data.cd = 10.9;
          playFighterSound(f,'skill');
          triggerFlash(255,80,0,0.15);
          let delay = 0.25;
          for (let i=0;i<9;i++) {
            delay += rand(0.14,0.44);
            const predictedX = e ? clamp(e.x + e.dir.x * e.baseSpeed * 0.48 + rand(-115,115), 100, 900) : rand(100,900);
            const predictedY = e ? clamp(e.y + e.dir.y * e.baseSpeed * 0.48 + rand(-115,115), 100, 900) : rand(100,900);
            projectiles.push({type:'meteor',owner:f,x:i<5?predictedX:rand(100,900),y:i<5?predictedY:rand(100,900),radius:92,delay,life:delay+0.25,hit:false,volcanoAmp:3});
          }
        }
      };
    }

    const card = FT('CARD');
    if (card) {
      const makeDeckLocal = owner => {
        const suits=['♠','♥','♦','♣'], ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
        const deck=[];
        for(const s of suits) for(const r of ranks) deck.push({rank:r,suit:s});
        if(owner&&owner.isRage) deck.push({rank:'RJ',suit:'★'},{rank:'BJ',suit:'☆'});
        for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]];}
        return deck;
      };
      const rageDamageLocal = (hand,owner,enemy) => {
        let total=0;
        for(const c of hand){
          if(c.rank==='RJ') total += Math.ceil((owner.maxHp-owner.hp)*.5);
          else if(c.rank==='BJ') total += Math.ceil(enemy.hp*.5);
          else if(c.rank==='A') total += 1;
          else if(['10','J','Q','K'].includes(c.rank)) total += 10;
          else total += parseInt(c.rank)||0;
        }
        return Math.min(120,total);
      };
      card.update = function(f,e,dt){
        f.data.resolvePulse = Math.max(0,(f.data.resolvePulse||0)-dt);
        if (f.data.phase === 'show') {
          f.data.showTimer -= dt;
          if (f.data.showTimer <= 0) {
            const hand = f.data.hand.slice();
            let dmg = f.isRage ? rageDamageLocal(hand,f,e) : cardCaoDamage(hand);
            if (hand.some(c=>c.rank==='K')) { dmg *= 3; note2(f.x,f.y-f.radius-108,'KING x3','#ffd0d0'); }
            dmg = scaledByMirror(f,dmg);
            f.data.lastDmg = dmg;
            projectiles.push({type:'card_throw',owner:f,enemy:e,x:f.x,y:f.y-f.radius-64,hand,dmg,rawDmg:dmg,hybridNumeric:true,radius:34,life:2.8,maxLife:2.8,hit:false,unblockable:true});
            f.data.resolvePulse = .75;
            f.data.hand = [];
            f.data.deck = makeDeckLocal(f);
            f.data.phase = 'draw';
            f.data.drawCd = 1.1;
            playFighterSound(f,'skill');
          }
          return;
        }
        f.data.drawCd -= abilityDt(f,dt);
        if (f.data.drawCd <= 0) {
          f.data.drawCd = 1.1;
          if (!f.data.deck || !f.data.deck.length) f.data.deck = makeDeckLocal(f);
          f.data.hand.push(f.data.deck.pop());
          playFighterSound(f,'wall');
          if (f.data.hand.length >= 3) {
            f.data.phase = 'show';
            f.data.showTimer = 1.04;
            f.data.lastDmg = f.isRage ? rageDamageLocal(f.data.hand,f,e) : cardCaoDamage(f.data.hand);
          }
        }
      };
    }

    const sniper = FT('SNIPER');
    if (sniper) {
      const shotRaw = (f,e) => 27 * clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1);
      sniper.update = function(f,e,dt){
        if (!e) return;
        if (f.isRage) {
          f.data.positionLocked = true;
          if ((f.data.reload || 0) > 0) {
            f.data.reload -= dt;
            f.data.hiddenReload = true;
            f.applyStatus('immune', .10, {source:f});
            if (f.data.reload <= 0) {
              const best = f.data.nests.reduce((a,b)=>dist(b.x,b.y,e.x,e.y)>dist(a.x,a.y,e.x,e.y)?b:a,f.data.nests[0]);
              f.x = best.x; f.y = best.y;
              f.data.aim = 3.15; f.data.aimMax = 3.15; f.data.hiddenReload = false;
              note2(f.x, f.y-f.radius-70, 'AIMING', '#ff8b8b');
            }
            return;
          }
          if (f.data.aim > 0) {
            f.data.hiddenReload = false;
            f.data.aim -= dt;
            f.setDir(e.x-f.x, e.y-f.y);
            if (dist(f.x,f.y,e.x,e.y) < 300 && (f.data.aimMax - f.data.aim) > .45) {
              f.data.aim = 0; f.data.reload = 3.15;
              note2(f.x, f.y-f.radius-70, 'RELOAD RELOCATE', '#ff8b8b');
              return;
            }
            if (f.data.aim <= 0) {
              projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45});
              e.takeDamage(scaledByMirror(f, shotRaw(f,e)), f, 'sniper-shot');
              f.data.reload = 3.15;
              playFighterSound(f,'skill');
            }
            return;
          }
          f.data.reload = 3.15;
          return;
        }
        f.data.hiddenReload = false;
        if (f.data.aim > 0) {
          f.data.positionLocked = true;
          f.data.aim -= dt;
          f.setDir(e.x-f.x,e.y-f.y);
          if (f.data.aim <= 0) {
            const dir = norm(e.x-f.x,e.y-f.y);
            projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45});
            e.takeDamage(scaledByMirror(f, shotRaw(f,e)), f, 'sniper-shot');
            f.x = clamp(f.x-dir.x*150, f.radius, GAME_SIZE-f.radius);
            f.y = clamp(f.y-dir.y*150, f.radius, GAME_SIZE-f.radius);
            f.data.cd = 8.4;
            playFighterSound(f,'skill');
          }
          return;
        }
        f.data.cd -= abilityDt(f,dt);
        if (f.data.cd <= 0) {
          const ratio = clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1);
          f.data.aim = Math.max(1.25, 0.65 + 1.45*ratio);
          f.data.aimMax = f.data.aim;
          note2(f.x,f.y-f.radius-70,'LOCK ON','#ff8b8b');
        }
      };
    }

    const ice = FT('ICE');
    if (ice) {
      ice.update = function(f,e,dt){
        if (!f.data.laneActive) f.data.cd -= abilityDt(f,dt);
        if (!f.data.laneActive && f.data.cd <= 0) {
          const a = Math.atan2(e.y-f.y,e.x-f.x);
          const far = pointOnRayToEdge(f.x,f.y,Math.cos(a),Math.sin(a));
          projectiles.push({type:'ice_lane',owner:f,x1:f.x,y1:f.y,x2:far.x,y2:far.y,halfWidth:212,life:6.8,maxLife:6.8,enemyInside:0,dmgTick:0});
          f.data.laneActive = true;
          playFighterSound(f,'skill');
        }
      };
    }

    const math = FT('MATH');
    if (math) {
      math.update = function(f,e,dt){
        f.data.cd -= abilityDt(f,dt);
        if (f.data.cd <= 0) {
          f.data.cd = f.isRage ? 4.65 : 4.85;
          let formula,result,isRageFormula=false;
          if (f.isRage) { const rage=makeRageMathExpression(); result=rage.result; formula=rage.formula; isRageFormula=true; }
          else {
            const X=Math.round(f.x/50),Y=Math.round(f.y/50),A=Math.round(e.x/50),B=Math.max(1,Math.round(e.y/50));
            result=Math.round((X-Y)*A/B);
            if(result===0) result=(Math.random()<.5?-1:1);
            formula=`(${X}-${Y})x${A}/${B}`;
          }
          projectiles.push({type:'math_formula',owner:f,enemy:e,formula,value:result,rage:isRageFormula,life:4.2,maxLife:4.2,phase:'typing',age:0,x:f.x,y:f.y,hit:false,launched:false,vx:0,vy:0,uninterruptible:true});
          playFighterSound(f,'skill');
        }
      };
    }

    const witch = FT('WITCH');
    if (witch) {
      witch.update = function(f,e,dt){
        f.data.rayCd -= abilityDt(f,dt);
        if (f.data.rayCd <= 0) {
          f.data.rayCd = 1.95;
          const end = {x:e.x,y:e.y};
          projectiles.push({type:'witch_ray',owner:f,x1:f.x,y1:f.y,x2:end.x,y2:end.y,life:.18,maxLife:.18});
          if (distToSegment(e.x,e.y,f.x,f.y,end.x,end.y)<=e.radius+18) e.takeDamage(scaledByMirror(f,4.2),f,'magic-ray');
          playFighterSound(f,'skill');
        }
        f.data.curseCd -= abilityDt(f,dt);
        if (f.data.curseCd <= 0) {
          f.data.curseCd = 6.85;
          rollWitchCurse(f,e);
          projectiles.push({type:'witch_talisman',owner:f,x:f.x,y:f.y,targetId:e.id,life:.8,maxLife:.8});
          if (f.isRage) rollWitchCurse(f,e);
        }
      };
    }

    const mirror = FT('MIRROR');
    if (mirror) {
      mirror.update = function(f,e,dt){
        f.data.gateSwapCd = Math.max(0,(f.data.gateSwapCd||0)-dt);
        f.data.cd -= abilityDt(f,dt);
        if (f.data.cd <= 0) {
          f.data.cd = 8.8;
          createMirrorGate(f);
        }
      };
    }

    const flash = FT('FLASH');
    if (flash) {
      flash.update = function(f,e,dt){
        if (f.isRage) {
          f.data.flashRage ||= {phase:'prep', t:1, cooldown:0, path:null, hitIds:{}};
          const R = f.data.flashRage;
          if (R.phase === 'cool') { R.cooldown -= dt; if (R.cooldown <= 0) { R.phase='prep'; R.t=1; R.path=null; R.hitIds={}; } return; }
          if (R.phase === 'prep') {
            f.data.positionLocked = true;
            R.t -= dt;
            if (!R.path) R.path = buildFlashPathLocal(f);
            if (R.t <= 0) { R.phase='run'; R.t=2; R.startT=2; R.len=pathLenLocal(R.path); R.damage=lerp(8,18,clamp((R.len-900)/2100,0,1)); note2(f.x,f.y-f.radius-82,`ZIGZAG ${R.damage.toFixed(0)}`,'#fff06b'); }
            return;
          }
          if (R.phase === 'run') {
            f.data.positionLocked = true;
            f.applyStatus('immune', .08, {source:f});
            f.data.dashTimer = .12;
            R.t -= dt;
            const prev = {x:f.x,y:f.y};
            const p = pointPathLocal(R.path, clamp(1-R.t/2,0,1));
            f.x = p.x; f.y = p.y;
            if (e && distToSegment(e.x,e.y,prev.x,prev.y,f.x,f.y) < f.radius + e.radius + 24 && (R.hitIds[e.id]||0) < 2) {
              R.hitIds[e.id] = (R.hitIds[e.id]||0) + 1;
              e.takeDamage(R.damage*.65,f,'flash-rage-zigzag');
              spawnShockwave(e.x,e.y,'#fff06b',120);
            }
            if (R.t <= 0) { R.phase='cool'; R.cooldown=.55; f.data.dashTimer=0; }
            return;
          }
        }
        f.data.cd = (f.data.cd||2) - abilityDt(f,dt);
        if (f.data.dashTimer > 0) { f.data.dashTimer -= dt; f.applyStatus('immune',.08,{source:f}); }
        if (f.data.cd <= 0) { f.data.cd=6.35; f.data.dashTimer=.42; f.data.dashHitIds={}; f.setDir(e.x-f.x,e.y-f.y); playFighterSound(f,'skill'); }
      };
      flash.onCollide = function(f,e){
        if (f.data.flashRage?.phase === 'run') return false;
        if (f.data.dashTimer > 0) {
          if (!f.data.dashHitIds) f.data.dashHitIds = {};
          if (f.data.dashHitIds[e.id]) return false;
          f.data.dashHitIds[e.id] = true;
          e.takeDamage(scaledByMirror(f,6.2),f,'flash-dash');
          return true;
        }
        return false;
      };
    }
    function buildFlashPathLocal(f){
      let pts=[{x:f.x,y:f.y}], x=f.x, y=f.y, dir=norm(rand(-1,1),rand(-1,1));
      const segs=5+Math.floor(rand(0,4));
      for(let i=0;i<segs;i++){
        let tx=dir.x>0?GAME_SIZE-35:35, ty=dir.y>0?GAME_SIZE-35:35;
        let ax=(tx-x)/(dir.x||.001), ay=(ty-y)/(dir.y||.001);
        let a=Math.min(Math.abs(ax),Math.abs(ay),rand(340,820));
        if(!isFinite(a)||a<80)a=rand(300,700);
        x=clamp(x+dir.x*a,35,GAME_SIZE-35); y=clamp(y+dir.y*a,35,GAME_SIZE-35);
        pts.push({x,y});
        if(x<=40||x>=GAME_SIZE-40)dir.x*=-1;
        if(y<=40||y>=GAME_SIZE-40)dir.y*=-1;
        dir=norm(dir.x+rand(-.38,.38),dir.y+rand(-.38,.38));
      }
      return pts;
    }
    function pathLenLocal(path){let L=0;for(let i=1;i<path.length;i++)L+=dist(path[i-1].x,path[i-1].y,path[i].x,path[i].y);return L;}
    function pointPathLocal(path,t){const L=pathLenLocal(path);let need=L*t;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],d=dist(a.x,a.y,b.x,b.y);if(need<=d)return {x:lerp(a.x,b.x,need/d),y:lerp(a.y,b.y,need/d)};need-=d;}return path[path.length-1];}

    const wolf = FT('WOLF');
    if (wolf) {
      wolf.update = function(f,e,dt){
        f.data.scentCd = (f.data.scentCd||2) - abilityDt(f,dt);
        f.data.biteCd = Math.max(0,(f.data.biteCd||0)-dt);
        f.data.pounceTimer = Math.max(0,(f.data.pounceTimer||0)-dt);
          if (f.data.scentCd <= 0) { f.data.scentCd = 6.7; e.applyStatus('scent',5.0,{source:f}); note2(e.x,e.y-e.radius-90,'BLOOD SCENT','#ff3030'); }
        const base = 162;
        const rageBonus = f.isRage ? Math.max(0,(e.maxHp-e.hp))*5 : 0;
        const inScent = e.hasStatus('scent') && dist(f.x,f.y,e.x,e.y) < base + rageBonus;
        if (inScent && f.data.biteCd <= 0) { const n=norm(e.x-f.x,e.y-f.y); f.setDir(n.x,n.y); f.data.pounceTimer=.58; f.data.biteCd=2.0; note2(f.x,f.y-f.radius-76,'POUNCE','#ff3030'); }
        if (f.data.pounceTimer > 0) { const n=norm(e.x-f.x,e.y-f.y); f.setDir(n.x,n.y); }
      };
      wolf.speedModifier = f => f.data.pounceTimer>0 ? 2.28 : 1;
      wolf.onCollide = function(f,e){
        if (f.data.pounceTimer > 0) {
          if (f.isRage) { const chance=lerp(.5,1,clamp((50-Math.max(0,f.hp))/50,0,1)); if(Math.random()<chance)e.applyStatus('weak',4); }
          e.takeDamage(scaledByMirror(f,11.4),f,'wolf-bite');
          const n=norm(f.x-e.x,f.y-e.y);
          f.x=clamp(f.x+n.x*112,f.radius,GAME_SIZE-f.radius);
          f.y=clamp(f.y+n.y*112,f.radius,GAME_SIZE-f.radius);
          f.data.pounceTimer=0;
          spawnShockwave(e.x,e.y,'#ff3030',120);
          return true;
        }
        return false;
      };
    }

    const crystal = FT('CRYSTAL');
    if (crystal) {
      crystal.update = function(f,e,dt){
        f.data.cd -= abilityDt(f,dt);
        if (f.data.cd <= 0) {
          f.data.cd = 2.15;
          const a=Math.atan2(e.y-f.y,e.x-f.x)+Math.PI/2;
          const len=198;
          const cx=(f.x+e.x)/2, cy=(f.y+e.y)/2;
          projectiles.push({type:'crystal_wall',owner:f,x1:cx-Math.cos(a)*len,y1:cy-Math.sin(a)*len,x2:cx+Math.cos(a)*len,y2:cy+Math.sin(a)*len,life:f.isRage?Infinity:5.2,maxLife:f.isRage?Infinity:5.2,hitIds:{},touchCd:{},permanent:f.isRage});
          playFighterSound(f,'skill');
          checkCrystalDiamond(f);
        }
      };
    }
  })();

  (function productionQualityPatch(){
    window.apexProductionPatchLoaded = 'starting';
    const FT = name => FighterTypes.find(t => t.name === name);
    const say = (x,y,text,color) => floatingTexts.push(new FloatingText(x,y,text,color));
    const rotate = (v,ang) => ({x:v.x*Math.cos(ang)-v.y*Math.sin(ang), y:v.x*Math.sin(ang)+v.y*Math.cos(ang)});
    const liveEnemyOf = f => fighters.find(q => q && q !== f && q.hp > 0 && !sameTeam(f,q));
    const hardSummonTypes = new Set(['superfan','slime_child','virus_minion','straw_monster','puppet_card','witch_talisman','paint_blob','pirate_anchor','card_throw','ice_dart','toxic_shot','sniper_laser']);

    const vamp = FT('VAMPIRE');
    if (vamp) {
      vamp.onCollide = function(f,e){
        if ((f.data.latchTimer||0) > 0) return true;
        const move = norm(f.dx || f.startDx || 1, f.dy || f.startDy || 0);
        const toEnemy = norm(e.x - f.x, e.y - f.y);
        const dot = move.x * toEnemy.x + move.y * toEnemy.y;
        const fangTip = { x:f.x + move.x * (f.radius * .74), y:f.y + move.y * (f.radius * .74) };
        const fangContact = dist(fangTip.x, fangTip.y, e.x, e.y) <= e.radius + f.radius * .62 + 18;
        const actualOverlap = dist(f.x,f.y,e.x,e.y) <= f.radius + e.radius + 8;
        if (dot < -0.02 || !fangContact || !actualOverlap) {
          if (Math.random() < .22) say(f.x, f.y-f.radius-78, 'FANG MISS', '#7c2130');
          return false;
        }
        f.data.latchTimer = .75;
        f.data.latchTarget = e.id;
        f.data.latchTick = 0;
        f.data.bloodLinkLevel = (f.data.bloodLinkLevel || 0) + 1;
        e.applyStatus('slow', .85, {factor:.58, source:f});
        e.takeDamage(scaledByMirror(f, 3), f, 'vampire-fang-drain');
        f.heal(3.0 + (f.data.bloodLinkLevel||0) * .08, true);
        projectiles.push({type:'blood_link',owner:f,targetId:e.id,life:.9,maxLife:.9});
        emitParticles(fangTip.x, fangTip.y, '#d80f2c', 22, 260, 5, .42, 'spark');
        say(fangTip.x, fangTip.y-40, 'BITE', '#ff3658');
        playFighterSound(f,'skill');
        return true;
      };
      vamp.update = function(f,e,dt){
        f.data.latchTimer = Math.max(0,(f.data.latchTimer||0)-dt);
        if (f.data.latchTimer > 0 && e && e.hp > 0) {
          f.data.latchTick = (f.data.latchTick||0) + dt;
          f.setDir(e.x-f.x,e.y-f.y);
          if (f.data.latchTick >= .42) {
            f.data.latchTick = 0;
            e.takeDamage(scaledByMirror(f, 3), f, 'vampire-latch-drain');
            f.heal(2.0 + (f.data.bloodLinkLevel||0)*.05, true);
            projectiles.push({type:'blood_link',owner:f,targetId:e.id,life:.5,maxLife:.5});
          }
        }
      };
    }

    const priorStandard = Fighter.prototype.takeStandardDamage;
    Fighter.prototype.takeStandardDamage = function(amount, source=null, label='standard-number'){
      const dealt = priorStandard.call(this, amount, source, label);
      if (dealt > 0) {
        const last = floatingTexts[floatingTexts.length-1];
        if (last && String(last.text || '').startsWith('STANDARD')) {
          last.text = `-${dealt.toFixed(dealt >= 10 ? 0 : 1)}`;
          last.color = '#ffffff';
        }
      }
      return dealt || 0;
    };
    window.apexDealHybridNumericDamage = function(target, source, rawDamage, label){
      if (!target || !source || rawDamage <= 0) return {standard:0, normal:0, normalFinal:0};
      const raw = Math.max(0, Number.isFinite(rawDamage) ? rawDamage : 0);
      const standardPart = Math.min(raw, 30);
      const normalPart = Math.max(0, raw - 30);
      source.hybridRawLog ||= {};
      source.hybridRawLog[label] = (source.hybridRawLog[label] || 0) + raw;
      const standardFinal = standardPart > 0 ? target.takeStandardDamage(standardPart, source, `${label}-standard`) : 0;
      let normalFinal = 0;
      if (normalPart > 0 && target.hp > 0) {
        const hpBefore = target.hp;
        target.takeDamage(normalPart, source, `${label}-normal`, false);
        normalFinal = Math.max(0, hpBefore - target.hp);
        if (normalFinal > 0) floatingTexts.push(new FloatingText(target.x+18, target.y-target.radius-70, `-${normalFinal.toFixed(normalFinal>=10?0:1)}`, '#ff5950'));
      }
      source.hybridHits ||= [];
      source.hybridHits.push({label, raw, standard:standardFinal, normalRaw:normalPart, normalFinal});
      return {standard:standardFinal, normal:normalPart, normalFinal};
    };

    const prevTakeDamage = Fighter.prototype.takeDamage;
    Fighter.prototype.takeDamage = function(amount, source=null, label='', statusDamage=false){
      if (this.name === 'PUPPET' && source && source !== this && !statusDamage && amount > 0) {
        const effigies = projectiles
          .filter(p => p.type === 'puppet_effigy' && p.owner === this && p.hp > 0 && p.life > 0)
          .sort((a,b)=>(a.order||0)-(b.order||0));
        if (effigies.length) {
          const effigy = effigies[0];
          const block = Math.min(effigy.hp, amount);
          effigy.hp -= block;
          projectiles.push({type:'puppet_transfer_link',owner:this,x1:this.x,y1:this.y,x2:effigy.x,y2:effigy.y,life:.42,maxLife:.42});
          say(this.x, this.y-this.radius-88, `-${Math.max(0, amount-block).toFixed(1)}`, '#d8ffbf');
          say(effigy.x, effigy.y-effigy.radius-38, `-${block.toFixed(1)}`, '#77ff9e');
          emitParticles(effigy.x,effigy.y,'#77ff9e',16,210,4,.35,'spark');
          if (effigy.hp <= 0) { effigy.life = 0; spawnShockwave(effigy.x, effigy.y, '#79ff9e', 110); }
          const puppetPart = Math.max(0, amount - block) * .9 + block * .38;
          if (puppetPart <= 0) return 0;
          return prevTakeDamage.call(this, puppetPart, source, `${label||'direct'}-puppet-transfer`, true);
        }
      }
      return prevTakeDamage.call(this, amount, source, label, statusDamage);
    };

    const prevUpdateProjectiles = updateProjectiles;
    updateProjectiles = function(dt){
      for (const mf of fighters) {
        if (!mf || mf.name !== 'MAGNET' || !(mf.data && mf.data.fieldTimer > 0)) continue;
        const shell = mf.radius + 248;
        for (const p of projectiles) {
          if (!p || p.owner === mf || !p.type || !hardSummonTypes.has(p.type) || p.x === undefined || p.y === undefined || p.life <= 0) continue;
          if (sameTeam(mf, p.owner)) continue;
          const r = p.radius || 12;
          if (dist(mf.x,mf.y,p.x,p.y) <= shell + r) {
            const n = norm(p.x-mf.x,p.y-mf.y);
            p.x = mf.x + n.x * (shell + r + 10);
            p.y = mf.y + n.y * (shell + r + 10);
            p.vx = (p.vx||0) + n.x * 260;
            p.vy = (p.vy||0) + n.y * 260;
            p.stun = Math.max(p.stun||0, .35);
            if (p.hp !== undefined) p.hp -= 2.5; else p.life = Math.min(p.life, .08);
            if (p.hp !== undefined && p.hp <= 0) p.life = 0;
            mf.blockedDamage = (mf.blockedDamage || 0) + 4;
            say(mf.x, mf.y-mf.radius-92, 'MAGNET BLOCK', '#ffe44e');
            emitParticles(p.x,p.y,'#ffe44e',14,260,4,.35,'square');
          }
        }
      }
      prevUpdateProjectiles(dt);
      for (const cage of projectiles) {
        if (!cage || cage.type !== 'crystal_cage' || cage.life <= 0) continue;
        const ang = Math.atan2((cage.diamondY||cage.y)-cage.y, (cage.diamondX||cage.x)-cage.x);
        const sector = Math.floor(((ang + Math.PI*2 + Math.PI/6) % TAU) / (TAU/6));
        cage.edgeHistory ||= [];
        if (cage.edgeHistory[cage.edgeHistory.length-1] !== sector) cage.edgeHistory.push(sector);
        if (cage.edgeHistory.length > 8) cage.edgeHistory.shift();
        if (cage.edgeHistory.length >= 6 && new Set(cage.edgeHistory).size <= 2) {
          const v = rotate(norm(cage.vx||1,cage.vy||.37), (11 + Math.random()*12) * Math.PI/180);
          const sp = Math.max(700, Math.hypot(cage.vx||0,cage.vy||0));
          cage.vx = v.x * sp; cage.vy = v.y * sp; cage.edgeHistory = [];
          say(cage.x, cage.y-cage.cageRadius-26, 'CHAOS REFRACT', '#c7ffff');
        }
      }
    };

    const prevSpawnGraph = spawnMathV2Graph;
    spawnMathV2Graph = function(owner, formula, kindOrFn){
      prevSpawnGraph(owner, formula, kindOrFn);
      const graph = [...projectiles].reverse().find(p => p.type === 'math_v2_graph' && p.owner === owner);
      if (graph) {
        graph.drawProgress = 0;
        graph.energy = graph.energy ?? 7;
        graph.life = Math.min(graph.life || 4.5, 4.0);
        graph.maxLife = graph.life;
        graph.hitCd = graph.hitCd || {};
      }
    };
    const math2 = FT('MATH_V2');
    if (math2) {
      math2.update = function(f,e,dt){
        const hasGraph = projectiles.some(p => p.type === 'math_v2_graph' && p.owner === f && p.life > 0);
        if (f.data.phase === 'typing') {
          f.data.typeTime = (f.data.typeTime || 0) + dt;
          const typeDur = f.isRage ? 1.05 : 1.85;
          const pauseDur = 1.0;
          f.data.typeProgress = clamp(f.data.typeTime / typeDur, 0, 1);
          if (f.data.typeTime >= typeDur + pauseDur) {
            spawnMathV2Graph(f, f.data.option.label, f.data.option.fn);
            f.data.phase = 'idle'; f.data.cd = f.isRage ? .75 : 6.3; f.data.typeTime = 0;
          }
          return;
        }
        if (!hasGraph) {
          f.data.cd -= abilityDt(f,dt);
          if (f.data.cd <= 0) {
            f.data.option = makeMathV2Function();
            f.data.phase = 'typing'; f.data.typeTime = 0; f.data.typeProgress = 0;
            projectiles.push({type:'math_v2_grid',owner:f,x:500,y:500,life:3.1,maxLife:3.1,formula:f.data.option.label});
            playFighterSound(f,'skill');
          }
        }
      };
      math2.draw = function(ctx,f){
        drawPolygon(ctx,[[-60,-55],[58,-48],[66,48],[-55,60]],'#cceeff','#173544',5);
        ctx.fillStyle='#173544'; ctx.font='900 18px monospace'; ctx.textAlign='center'; ctx.fillText('Oxy',0,-8); ctx.fillText('f(x)',0,22);
        if (f.data.phase === 'typing' && f.data.option) {
          const pct = clamp(f.data.typeProgress||0,0,1);
          const txt = f.data.option.label.slice(0, Math.max(1, Math.floor(f.data.option.label.length * pct)));
          ctx.fillStyle='#eaffff'; ctx.strokeStyle='#0b1620'; ctx.lineWidth=4; ctx.font='900 16px monospace'; ctx.textAlign='center';
          ctx.strokeText(txt,0,-f.radius-18); ctx.fillText(txt,0,-f.radius-18);
          if (pct >= 1) { ctx.fillStyle='#9ad7ff'; ctx.font='900 12px monospace'; ctx.fillText('ORIGIN READY',0,-f.radius-38); }
        }
      };
    }

    const sniper = FT('SNIPER');
    if (sniper) {
      function farNest(f,e){ return f.data.nests.reduce((best,n)=>dist(n.x,n.y,e.x,e.y)>dist(best.x,best.y,e.x,e.y)?n:best, f.data.nests[0]); }
      function relocate(f,e,resetAim){
        const n = farNest(f,e); f.x=n.x; f.y=n.y;
        if (resetAim) { f.data.aim=3; f.data.aimMax=3; }
        say(f.x,f.y-f.radius-78,'RELOCATE','#ff8b8b');
        emitParticles(f.x,f.y,'#ff8b8b',18,300,5,.35,'spark');
      }
      sniper.update = function(f,e,dt){
        if (f.isRage) {
          f.data.positionLocked = true;
          if (e && dist(f.x,f.y,e.x,e.y) < 300) relocate(f,e,(f.data.aim||0)>0);
          if ((f.data.reload||0) > 0) {
            f.data.reload -= dt; f.data.hiddenReload = true; f.applyStatus('immune',.08,{source:f});
            if (f.data.reload <= 0) { f.data.hiddenReload=false; relocate(f,e,true); }
            return;
          }
          if ((f.data.aim||0) > 0) {
            f.data.hiddenReload = false; f.data.aim -= dt; f.setDir(e.x-f.x,e.y-f.y);
            if (f.data.aim <= 0) {
              const ratio = clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1);
              projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45});
              e.takeDamage(scaledByMirror(f,30*ratio),f,'sniper-shot');
              f.data.reload=3; f.data.aim=0; playFighterSound(f,'skill');
            }
            return;
          }
          f.data.reload = 3;
          return;
        }
        if ((f.data.aim||0) > 0) {
          f.data.positionLocked = true; f.data.aim -= dt; f.setDir(e.x-f.x,e.y-f.y);
          if (f.data.aim <= 0) {
            const dir = norm(e.x-f.x,e.y-f.y), ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1);
            projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45});
            e.takeDamage(scaledByMirror(f,30*ratio),f,'sniper-shot');
            f.setDir(-dir.x,-dir.y); f.data.recoilMove = 1.4; f.data.cd=7.8; playFighterSound(f,'skill');
          }
          return;
        }
        f.data.recoilMove = Math.max(0,(f.data.recoilMove||0)-dt);
        f.data.cd -= abilityDt(f,dt);
        if (f.data.cd <= 0) { const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); f.data.aim=Math.max(1.2,.55+1.35*ratio); f.data.aimMax=f.data.aim; say(f.x,f.y-f.radius-70,'LOCK ON','#ff8b8b'); }
      };
      sniper.speedModifier = f => (f.data.recoilMove||0)>0 ? 1.35 : 1;
      const oldSniperDraw = sniper.draw;
      sniper.draw = function(ctx,f){
        oldSniperDraw(ctx,f);
        ctx.save(); ctx.textAlign='center'; ctx.font='900 14px monospace'; ctx.fillStyle='#ffb0b0';
        if ((f.data.aim||0)>0) ctx.fillText(`AIM ${Math.max(0,f.data.aim).toFixed(1)}s`,0,-f.radius-40);
        else if ((f.data.reload||0)>0 || f.data.hiddenReload) ctx.fillText(`RELOAD ${Math.max(0,f.data.reload||0).toFixed(1)}s`,0,-f.radius-40);
        ctx.restore();
      };
    }

    const prevDrawProjectiles = drawProjectiles;
    drawProjectiles = function(ctx){
      prevDrawProjectiles(ctx);
      for (const p of projectiles) {
        ctx.save();
        if (p.type === 'puppet_transfer_link') {
          ctx.globalAlpha = Math.max(0,p.life/p.maxLife);
          ctx.strokeStyle='rgba(112,255,152,.95)'; ctx.lineWidth=3; ctx.setLineDash([8,8]);
          ctx.beginPath(); ctx.moveTo(p.x1,p.y1);
          const mx=(p.x1+p.x2)/2 + Math.sin(matchClock*20)*18, my=(p.y1+p.y2)/2 - 25;
          ctx.quadraticCurveTo(mx,my,p.x2,p.y2); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle='#d9ffd5'; ctx.font='900 18px serif'; ctx.textAlign='center'; ctx.fillText('符',mx,my);
        }
        if (p.type === 'superfan') {
          const a = clamp(p.life/(p.maxLife||1),0,1);
          ctx.globalAlpha = .9*a; ctx.translate(p.x,p.y);
          ctx.fillStyle='#ff7bd6'; ctx.strokeStyle='#2a0821'; ctx.lineWidth=3;
          drawPolygon(ctx,[[0,-15],[13,-5],[10,13],[-10,13],[-13,-5]],'#ff7bd6','#2a0821',3);
          ctx.fillStyle='#fff'; ctx.font='900 11px sans-serif'; ctx.textAlign='center'; ctx.fillText('HP'+Math.ceil(p.hp||0),0,4);
        }
        if (p.type === 'pirate_pull_ring') {
          ctx.globalAlpha = clamp(p.life/p.maxLife,0,1); ctx.strokeStyle='#e6c27a'; ctx.lineWidth=4;
          ctx.beginPath(); ctx.arc(p.x,p.y,(1-p.life/p.maxLife)*44+8,0,TAU); ctx.stroke();
        }
        if (p.type === 'pirate_loot_fx') {
          ctx.globalAlpha = clamp(p.life/p.maxLife,0,1); ctx.textAlign='center'; ctx.font='900 42px serif';
          ctx.fillStyle=p.kind==='treasure'?'#ffd447':p.kind==='cannon'?'#ddd':'#b88755';
          ctx.fillText(p.kind==='boat'?'SHIP':p.kind==='cannon'?'CANNON':'GOLD',p.x,p.y);
        }
        ctx.restore();
      }
    };

    const prevUpdate = update;
    const prevDraw = draw;
    const soloKeys = {}, soloPrev = {};
    let soloState = null;
    window.addEventListener('keydown', e => { soloKeys[e.code]=true; if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyJ','KeyU','Numpad1','Numpad2','Digit1','Digit2'].includes(e.code)) e.preventDefault(); });
    window.addEventListener('keyup', e => { soloKeys[e.code]=false; });
    function edge(code){ const v=!!soloKeys[code], p=!!soloPrev[code]; soloPrev[code]=v; return v && !p; }
    function hideSolo(){ const s=document.getElementById('solo-screen'); if(s)s.classList.add('hidden'); const h=document.getElementById('solo-hud'); if(h)h.style.display='none'; }
    const oldGoMenu = goToMenu, oldGoSelect = goToSelect, oldGoTournament = goToTournament;
    goToMenu = function(){ hideSolo(); oldGoMenu(); };
    goToSelect = function(){ hideSolo(); oldGoSelect(); };
    goToTournament = function(){ hideSolo(); oldGoTournament(); };
    window.goToMenu = goToMenu;
    window.goToSelect = goToSelect;
    window.goToTournament = goToTournament;
    function renderSoloRoster(){
      const host=document.getElementById('solo-roster'); if(!host) return;
      host.innerHTML='';
      ['RUBBER','ICE','TOXIC','BLADE'].forEach(n=>{
        const div=document.createElement('div'); div.className='solo-card'; div.innerHTML=`<b>${n}</b><span>${FT(n)?.desc||''}</span>`;
        div.onclick=()=>{ soloState ||= {}; if(!soloState.p1Type) soloState.p1Type=n; else soloState.p2Type=n; renderSoloRoster(); };
        if(soloState && (soloState.p1Type===n || soloState.p2Type===n)) div.classList.add('active');
        host.appendChild(div);
      });
      const btn=document.getElementById('solo-start-btn'); if(btn) btn.classList.toggle('hidden', !(soloState?.p1Type && soloState?.p2Type));
    }
    function makeSolo(name,x,y,side){
      const t=FT(name), dir=side===1?{x:1,y:0}:{x:-1,y:0};
      return {name,type:t,x,y,dx:dir.x,dy:dir.y,radius:75,hp:100,maxHp:100,side,cd:{normal:0,special:0},status:{},rage:false,bounce:0,super:0,black:0,poison:0,color:t?.color||'#fff'};
    }
    window.goToSoloSelect = function(){
      document.getElementById('menu-screen').classList.add('hidden');
      document.getElementById('select-screen').classList.add('hidden');
      document.getElementById('tournament-screen').classList.add('hidden');
      document.getElementById('end-screen').classList.add('hidden');
      const s=document.getElementById('solo-screen'); if(s)s.classList.remove('hidden');
      const h=document.getElementById('solo-hud'); if(h)h.style.display='none';
      soloState={p1Type:null,p2Type:null,projectiles:[],texts:[],paused:false,w:4000,h:1500,clock:0};
      renderSoloRoster();
    };
    window.startSoloMode = function(){
      if(!soloState?.p1Type || !soloState?.p2Type) return;
      soloState.p1=makeSolo(soloState.p1Type,700,750,1);
      soloState.p2=makeSolo(soloState.p2Type,3300,750,2);
      soloState.projectiles=[]; soloState.texts=[]; soloState.clock=0; gameState='SOLO';
      document.getElementById('solo-screen').classList.add('hidden');
      const h=document.getElementById('solo-hud'); if(h)h.style.display='flex';
      if(!reqId) reqId=requestAnimationFrame(loop);
    };
    function soloInput(p,dt){
      const p1=p.side===1, left=p1?'KeyA':'ArrowLeft', right=p1?'KeyD':'ArrowRight', up=p1?'KeyW':'ArrowUp', down=p1?'KeyS':'ArrowDown';
      const nx=(soloKeys[right]?1:0)-(soloKeys[left]?1:0), ny=(soloKeys[down]?1:0)-(soloKeys[up]?1:0);
      const n=norm(nx,ny); if(nx||ny){ p.dx=n.x; p.dy=n.y; if(p.bounce>0 && (Math.abs(nx)>0||Math.abs(ny)>0)) p.bounce=0; }
      let sp=360; if(p.name==='TOXIC' && !(p1?soloKeys.KeyJ:(soloKeys.Numpad1||soloKeys.Digit1))) sp*=1.3; if(p.super>0)sp*=1.45; if(p.black>0)sp*=1.12;
      p.x=clamp(p.x+n.x*sp*dt,p.radius,soloState.w-p.radius); p.y=clamp(p.y+n.y*sp*dt,p.radius,soloState.h-p.radius);
      const normal=p1?'KeyJ':(soloKeys.Numpad1?'Numpad1':'Digit1'), special=p1?'KeyU':(soloKeys.Numpad2?'Numpad2':'Digit2');
      if(edge(normal)) soloNormal(p); if(edge(special)) soloSpecial(p);
      if(p.name==='TOXIC' && (p1?soloKeys.KeyJ:(soloKeys.Numpad1||soloKeys.Digit1))) soloState.projectiles.push({type:'solo_poison',owner:p,x:p.x,y:p.y,radius:55,life:3,maxLife:3});
    }
    function soloNormal(p){
      if((p.cd.normal||0)>0)return;
      if(p.name==='RUBBER'){p.bounce=3;p.dash=.32;p.cd.normal=.75;}
      if(p.name==='ICE'){soloState.projectiles.push({type:'solo_arrow',owner:p,x:p.x+p.dx*85,y:p.y+p.dy*85,vx:p.dx*760,vy:p.dy*760,radius:14,life:5,damage:3});p.cd.normal=1;}
      if(p.name==='BLADE'){p.cd.normal=.25;}
    }
    function soloSpecial(p){
      if((p.cd.special||0)>0)return;
      if(p.name==='RUBBER'){p.super=5;p.cd.special=9;soloText(p,'SUPER BOUNCE','#ffd65c');}
      if(p.name==='ICE'){soloState.projectiles.push({type:'solo_ice_lane',owner:p,x:p.x,y:p.y,dx:p.dx,dy:p.dy,life:2.6,width:70,damage:5});p.cd.special=5;}
      if(p.name==='TOXIC'){const e=p.side===1?soloState.p2:soloState.p1; const scale=[0,.5,.7,1,1.5,2][clamp(Math.ceil(e.poison||0),1,5)]; soloDamage(e,p,12*scale,'#9dff47');p.cd.special=5;}
      if(p.name==='BLADE'){p.black=5;p.cd.special=8;soloText(p,'BLACK BLADE','#ff3333');}
    }
    function soloText(p,t,c){soloState.texts.push({x:p.x,y:p.y-p.radius-25,text:t,color:c,life:1,maxLife:1});}
    function soloDamage(t,s,d,c='#ff4a4a'){t.hp=Math.max(0,t.hp-d);soloState.texts.push({x:t.x,y:t.y-t.radius-20,text:`-${d.toFixed(1)}`,color:c,life:.8,maxLife:.8});}
    function updateSolo(dt){
      if(!soloState?.p1 || !soloState?.p2) return; soloState.clock+=dt;
      if(edge('Escape')) soloState.paused=!soloState.paused; if(edge('KeyB')) return goToMenu(); if(edge('KeyR')) return window.startSoloMode(); if(soloState.paused)return;
      const ps=[soloState.p1,soloState.p2]; ps.forEach(p=>{for(const k of Object.keys(p.cd))p.cd[k]=Math.max(0,p.cd[k]-dt);p.super=Math.max(0,p.super-dt);p.black=Math.max(0,p.black-dt);soloInput(p,dt);});
      for(const p of soloState.projectiles){p.life-=dt;if(p.vx){p.x+=p.vx*dt;p.y+=p.vy*dt;} const e=p.owner.side===1?soloState.p2:soloState.p1; if(p.type==='solo_arrow'&&dist(p.x,p.y,e.x,e.y)<e.radius+p.radius){soloDamage(e,p.owner,p.damage,'#bffcff');e.slow=1;p.life=0;} if(p.type==='solo_poison'&&dist(p.x,p.y,e.x,e.y)<e.radius+p.radius){e.poison=clamp((e.poison||0)+dt*.8,0,5); if(Math.random()<dt*2)soloDamage(e,p.owner,.35,'#9dff47');} if(p.type==='solo_ice_lane'&&distToSegment(e.x,e.y,p.x,p.y,p.x+p.dx*820,p.y+p.dy*820)<p.width){soloDamage(e,p.owner,p.damage*dt,'#bffcff');}}
      soloState.projectiles=soloState.projectiles.filter(p=>p.life>0&&p.x>-100&&p.x<4100&&p.y>-100&&p.y<1600).slice(-220);
      const a=soloState.p1,b=soloState.p2; if(dist(a.x,a.y,b.x,b.y)<a.radius+b.radius){ if(a.bounce>0||a.dash>0)soloDamage(b,a,8+(a.super>0?4:0),'#ffd65c'); if(b.bounce>0||b.dash>0)soloDamage(a,b,8+(b.super>0?4:0),'#ffd65c');}
      ps.forEach(p=>{ if(p.dash>0){p.dash-=dt;p.x=clamp(p.x+p.dx*980*dt,p.radius,soloState.w-p.radius);p.y=clamp(p.y+p.dy*980*dt,p.radius,soloState.h-p.radius);} if(p.name==='BLADE' && (p.x<=p.radius+2||p.x>=soloState.w-p.radius-2||p.y<=p.radius+2||p.y>=soloState.h-p.radius-2)){soloState.projectiles.push({type:'solo_blade',owner:p,x:p.x,y:p.y,vx:-p.dx*(p.black>0?900:600),vy:-p.dy*(p.black>0?900:600),radius:28,life:1.4,damage:p.black>0?7:4});}});
      for(const p of soloState.projectiles) if(p.type==='solo_blade'){const e=p.owner.side===1?soloState.p2:soloState.p1;if(dist(p.x,p.y,e.x,e.y)<e.radius+p.radius){soloDamage(e,p.owner,p.damage,'#ff3333');p.life=0;}}
      soloState.texts.forEach(t=>{t.life-=dt;t.y-=24*dt;}); soloState.texts=soloState.texts.filter(t=>t.life>0);
      const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
      set('solo-p1-name',`${a.name} P1`); set('solo-p2-name',`${b.name} P2`); set('solo-p1-state',`HP ${a.hp.toFixed(0)}  ${a.super>0?'SUPER ':''}${a.black>0?'BLACK ':''}`); set('solo-p2-state',`HP ${b.hp.toFixed(0)}  ${b.super>0?'SUPER ':''}${b.black>0?'BLACK ':''}`);
      const hp1=document.getElementById('solo-p1-hp'),hp2=document.getElementById('solo-p2-hp'); if(hp1)hp1.style.width=`${a.hp}%`; if(hp2)hp2.style.width=`${b.hp}%`;
    }
    function drawSolo(){
      ctx.clearRect(0,0,GAME_SIZE,GAME_SIZE); if(!soloState?.p1)return;
      const a=soloState.p1,b=soloState.p2; const minX=Math.min(a.x,b.x)-520,maxX=Math.max(a.x,b.x)+520,minY=Math.min(a.y,b.y)-360,maxY=Math.max(a.y,b.y)+360;
      const z=clamp(Math.min(GAME_SIZE/(maxX-minX),GAME_SIZE/(maxY-minY)),.24,.78); const cx=clamp((minX+maxX)/2,GAME_SIZE/(2*z),soloState.w-GAME_SIZE/(2*z)); const cy=clamp((minY+maxY)/2,GAME_SIZE/(2*z),soloState.h-GAME_SIZE/(2*z));
      ctx.save(); ctx.translate(GAME_SIZE/2,GAME_SIZE/2); ctx.scale(z,z); ctx.translate(-cx,-cy);
      ctx.fillStyle='#120e12'; ctx.fillRect(0,0,soloState.w,soloState.h); ctx.strokeStyle='rgba(255,231,160,.22)'; ctx.lineWidth=8; ctx.strokeRect(0,0,soloState.w,soloState.h);
      for(let x=0;x<soloState.w;x+=250){ctx.strokeStyle='rgba(255,255,255,.035)';ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,soloState.h);ctx.stroke();}
      for(const p of soloState.projectiles){ctx.save();ctx.globalAlpha=clamp(p.life/(p.maxLife||p.life||1),0,1);ctx.fillStyle=p.type.includes('poison')?'#75ff55':p.type.includes('ice')?'#bffcff':p.type.includes('blade')?'#ff3333':'#fff'; if(p.type==='solo_ice_lane'){ctx.strokeStyle='#bffcff';ctx.lineWidth=p.width;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+p.dx*820,p.y+p.dy*820);ctx.stroke();} else {ctx.beginPath();ctx.arc(p.x,p.y,p.radius||14,0,TAU);ctx.fill();}ctx.restore();}
      [a,b].forEach(p=>{ctx.save();ctx.translate(p.x,p.y);drawPolygon(ctx,[[-55,-65],[55,-55],[64,45],[0,72],[-64,45]],p.color,'#0a0808',5);ctx.fillStyle='#fff';ctx.font='900 24px serif';ctx.textAlign='center';ctx.fillText(fighterGlyph(p.name),0,8);ctx.restore();});
      for(const t of soloState.texts){ctx.globalAlpha=clamp(t.life/t.maxLife,0,1);ctx.fillStyle=t.color;ctx.font='900 28px sans-serif';ctx.textAlign='center';ctx.fillText(t.text,t.x,t.y);}
      ctx.restore(); ctx.globalAlpha=1; ctx.fillStyle='#f5dfaa'; ctx.font='900 18px sans-serif'; ctx.textAlign='center'; ctx.fillText('SOLO 1V1 LOCAL  |  ESC pause  R restart  B menu',500,28); if(soloState.paused){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(0,0,1000,1000);ctx.fillStyle='#fff';ctx.font='900 64px serif';ctx.fillText('PAUSED',500,500);}
    }
    update = function(dt){ if(gameState === 'SOLO') return updateSolo(dt); return prevUpdate(dt); };
    draw = function(){ if(gameState === 'SOLO') return drawSolo(); return prevDraw(); };
    window.goToSoloSelect = window.goToSoloSelect;
    window.startSoloMode = window.startSoloMode;
    window.apexProductionPatchLoaded = 'ready';
  })();

  (function localPostPatchBalance(){
    const FT = name => FighterTypes.find(t => t.name === name);
    const note = (x,y,t,c) => floatingTexts.push(new FloatingText(x,y,t,c));
    const oldNovaDamageFn = novaDamage;
    novaDamage = function(t){ return oldNovaDamageFn(t) * .86; };

    const blade = FT('BLADE');
    if (blade) {
      blade.onWallBounce = function(f){
        const a=Math.atan2(GAME_SIZE/2-f.y,GAME_SIZE/2-f.x);
        const spread=f.isRage?[-.17,.17]:[0];
        for(const off of spread){
          const aa=a+off;
          projectiles.push({type:'blade_wave',owner:f,x:f.x,y:f.y,vx:Math.cos(aa)*1080,vy:Math.sin(aa)*1080,halfWidth:260,length:380,life:2.25,maxLife:2.25,dmg:scaledByMirror(f,3.05),bounces:f.isRage?2:0,hit:false});
        }
        playFighterSound(f,'skill');
      };
    }

    const wolf = FT('WOLF');
    if (wolf) {
      wolf.update = function(f,e,dt){
        f.data.scentCd = (f.data.scentCd||2) - abilityDt(f,dt);
        f.data.biteCd = Math.max(0,(f.data.biteCd||0)-dt);
        f.data.pounceTimer = Math.max(0,(f.data.pounceTimer||0)-dt);
        if (f.data.scentCd <= 0) { f.data.scentCd = 7.4; e.applyStatus('scent',4.7,{source:f}); note(e.x,e.y-e.radius-90,'BLOOD SCENT','#ff3030'); }
        const base = 150, rageBonus = f.isRage ? Math.max(0,(e.maxHp-e.hp))*4.25 : 0;
        if (e.hasStatus('scent') && dist(f.x,f.y,e.x,e.y) < base + rageBonus && f.data.biteCd <= 0) {
          const n=norm(e.x-f.x,e.y-f.y); f.setDir(n.x,n.y); f.data.pounceTimer=.48; f.data.biteCd=2.55; note(f.x,f.y-f.radius-76,'POUNCE','#ff3030');
        }
        if (f.data.pounceTimer > 0) { const n=norm(e.x-f.x,e.y-f.y); f.setDir(n.x,n.y); }
      };
      wolf.speedModifier = f => f.data.pounceTimer>0 ? 2.08 : 1;
      wolf.onCollide = function(f,e){
        if (f.data.pounceTimer > 0) {
          if (f.isRage) { const chance=lerp(.45,.9,clamp((50-Math.max(0,f.hp))/50,0,1)); if(Math.random()<chance)e.applyStatus('weak',3.4); }
          e.takeDamage(scaledByMirror(f,9.2),f,'wolf-bite');
          const n=norm(f.x-e.x,f.y-e.y);
          f.x=clamp(f.x+n.x*112,f.radius,GAME_SIZE-f.radius);
          f.y=clamp(f.y+n.y*112,f.radius,GAME_SIZE-f.radius);
          f.data.pounceTimer=0; spawnShockwave(e.x,e.y,'#ff3030',112); return true;
        }
        return false;
      };
    }

    const witch = FT('WITCH');
    if (witch) {
      witch.update = function(f,e,dt){
        f.data.rayCd -= abilityDt(f,dt);
        if (f.data.rayCd <= 0) {
          f.data.rayCd = 2.55;
          projectiles.push({type:'witch_ray',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.18,maxLife:.18});
          if(distToSegment(e.x,e.y,f.x,f.y,e.x,e.y)<=e.radius+18) e.takeDamage(scaledByMirror(f,3.2),f,'magic-ray');
          playFighterSound(f,'skill');
        }
        f.data.curseCd -= abilityDt(f,dt);
        if (f.data.curseCd <= 0) {
          f.data.curseCd = 8.2;
          rollWitchCurse(f,e);
          projectiles.push({type:'witch_talisman',owner:f,x:f.x,y:f.y,targetId:e.id,life:.8,maxLife:.8});
          if (f.isRage && Math.random() < .55) rollWitchCurse(f,e);
        }
      };
    }

    const time = FT('TIME');
    if (time) {
      time.update = function(f,e,dt){
        f.data.clockCd = (f.data.clockCd||4) - abilityDt(f,dt);
        if (f.data.clockCd <= 0) {
          f.data.clockCd = 4.8;
          const raw = Math.max(2, Math.round(clockDamageValue() * .82));
          if (window.apexDealHybridNumericDamage) window.apexDealHybridNumericDamage(e,f,raw,'clock-hour-strike');
          else e.takeDamage(raw,f,'clock-hour-strike');
          projectiles.push({type:'clock_flash',owner:f,num:raw,life:.9,maxLife:.9});
          note(e.x,e.y-e.radius-80,`CLOCK ${raw}`,'#efeaff');
        }
        if(f.data.markCd===undefined)f.data.markCd=7;
        f.data.markCd-=abilityDt(f,dt);
        if(f.data.markCd<=0&&!f.data.mark){f.data.markCd=10; f.data.mark={timer:3,hp:f.hp,x:f.x,y:f.y,enemyHp:e.hp}; projectiles.push({type:'time_mark',owner:f,x:f.x,y:f.y,life:3,maxLife:3}); note(f.x,f.y-f.radius-76,'TIME MARK','#efeaff');}
      };
    }

    const card = FT('CARD');
    if (card) {
      const prevCardUpdate = card.update;
      card.update = function(f,e,dt){
        prevCardUpdate(f,e,dt);
        if (f.data && f.data.phase === 'draw') f.data.drawCd = Math.min(f.data.drawCd, .95);
      };
    }

    const puppetFine = FT('PUPPET');
    const prevDamageForPuppetBuff = Fighter.prototype.takeDamage;
    Fighter.prototype.takeDamage = function(amount, source=null, label='', statusDamage=false){
      if (this.name === 'PUPPET' && source && source !== this && !statusDamage && amount > 0) {
        const effigy = projectiles.filter(p=>p.type==='puppet_effigy'&&p.owner===this&&p.hp>0&&p.life>0).sort((a,b)=>(a.order||0)-(b.order||0))[0];
        if (effigy) {
          const block=Math.min(effigy.hp, amount);
          effigy.hp -= block;
          projectiles.push({type:'puppet_transfer_link',owner:this,x1:this.x,y1:this.y,x2:effigy.x,y2:effigy.y,life:.42,maxLife:.42});
          note(this.x,this.y-this.radius-88,`-${Math.max(0,amount-block).toFixed(1)}`,'#d8ffbf');
          note(effigy.x,effigy.y-effigy.radius-38,`-${block.toFixed(1)}`,'#77ff9e');
          if (effigy.hp <= 0) { effigy.life = 0; spawnShockwave(effigy.x, effigy.y, '#79ff9e', 110); }
          const puppetPart=Math.max(0, amount-block)*.82 + block*.22;
          if (puppetPart > 0) return prevDamageForPuppetBuff.call(this, puppetPart, source, `${label||'direct'}-puppet-soft-transfer`, true);
          return 0;
        }
      }
      return prevDamageForPuppetBuff.call(this, amount, source, label, statusDamage);
    };

    const prevUP2 = updateProjectiles;
    updateProjectiles = function(dt){
      for (const p of projectiles) {
        if (p.type === 'pirate_anchor' && p.triggered) p.finalDmg = Math.min(p.finalDmg || 0, p.boat ? 25 : 20);
        if (p.type === 'paint_blob') { p.radius = Math.min(p.radius||25, 22); p.life = Math.min(p.life, 1.75); }
      }
      prevUP2(dt);
    };

    if (CANONICAL_NUMERIC_TUNING.MAGNET) Object.assign(CANONICAL_NUMERIC_TUNING.MAGNET,{out:1.08,taken:.98,cd:1.08});
    if (CANONICAL_NUMERIC_TUNING.PAINTER) Object.assign(CANONICAL_NUMERIC_TUNING.PAINTER,{out:1.00,taken:1.00,cd:1.02});
    if (CANONICAL_NUMERIC_TUNING.PIRATE) Object.assign(CANONICAL_NUMERIC_TUNING.PIRATE,{out:1.08,taken:.92,cd:1.08});
    if (CANONICAL_NUMERIC_TUNING.NOVA) Object.assign(CANONICAL_NUMERIC_TUNING.NOVA,{out:1.05,taken:.98,cd:1.05});
    window.apexLocalPostPatchBalance = 'ready';
  })();

  (function correctiveProductionPatch2(){
    const FT = name => FighterTypes.find(t => t.name === name);
    const DEBUG_VAMPIRE_BITE = false;
    window.DEBUG_VAMPIRE_BITE = DEBUG_VAMPIRE_BITE;
    const note = (x,y,text,color) => floatingTexts.push(new FloatingText(x,y,text,color));
    function resetCanvasState(ctx){
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.filter = 'none';
      ctx.setLineDash([]);
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
    }

    const vampire = FT('VAMPIRE');
    if (vampire) {
      vampire.onCollide = function(f,e){
        if ((f.data.latchTimer||0) > 0) return true;
        const last = f.data.lastMoveDir || f.dir || {x:f.startDx||1,y:f.startDy||0};
        const forward = norm(last.x || f.startDx || 1, last.y || f.startDy || 0);
        const toEnemy = norm(e.x - f.x, e.y - f.y);
        const centerDot = forward.x * toEnemy.x + forward.y * toEnemy.y;
        const fangX = f.x + forward.x * f.radius * .92;
        const fangY = f.y + forward.y * f.radius * .92;
        const bodyGapFromFang = dist(fangX, fangY, e.x, e.y) - e.radius;
        const overlap = dist(f.x,f.y,e.x,e.y) <= f.radius + e.radius + 12;
        const nearest = { x:e.x - forward.x * e.radius, y:e.y - forward.y * e.radius };
        const nearestGap = dist(fangX, fangY, nearest.x, nearest.y);
        f.data.debugFang = {x:fangX,y:fangY,ok:false};
        if (!overlap || centerDot <= .15 || bodyGapFromFang > 48 || nearestGap > e.radius + 82) {
          if (Math.random() < .12) note(fangX, fangY-34, 'FANG MISS', '#7c2130');
          return false;
        }
        f.data.debugFang.ok = true;
        f.data.latchTimer = .95;
        f.data.latchTarget = e.id;
        f.data.latchTick = 0;
        f.data.bloodLinkLevel = (f.data.bloodLinkLevel || 0) + 1;
        e.applyStatus('slow', .9, {factor:.58, source:f});
        e.takeDamage(scaledByMirror(f, 3), f, 'vampire-fang-drain');
        f.heal(3 + (f.data.bloodLinkLevel||0)*.08, true);
        projectiles.push({type:'blood_link',owner:f,targetId:e.id,life:.95,maxLife:.95});
        emitParticles(fangX, fangY, '#d80f2c', 26, 300, 5, .45, 'spark');
        note(fangX, fangY-40, 'FANG LOCK', '#ff3658');
        playFighterSound(f,'skill');
        return true;
      };
      vampire.update = function(f,e,dt){
        if ((f.data.latchTimer||0) <= 0 && f.dir) f.data.lastMoveDir = {x:f.dir.x, y:f.dir.y};
        f.data.latchTimer = Math.max(0,(f.data.latchTimer||0)-dt);
        if (f.data.latchTimer > 0 && e && e.hp > 0) {
          f.data.latchTick = (f.data.latchTick||0) + dt;
          f.setDir(e.x-f.x,e.y-f.y);
          if (f.data.latchTick >= .5) {
            f.data.latchTick -= .5;
            e.takeDamage(scaledByMirror(f,3), f, 'vampire-latch-drain');
            f.heal(2 + (f.data.bloodLinkLevel||0)*.05, true);
            projectiles.push({type:'blood_link',owner:f,targetId:e.id,life:.55,maxLife:.55});
          }
        }
      };
      const oldVampDraw = vampire.draw;
      vampire.draw = function(ctx,f){
        oldVampDraw(ctx,f);
        if (DEBUG_VAMPIRE_BITE && f.data.debugFang) {
          ctx.save(); resetCanvasState(ctx);
          const d = norm(f.dx || f.dir?.x || 1, f.dy || f.dir?.y || 0);
          ctx.translate(-f.x,-f.y);
          ctx.strokeStyle = f.data.debugFang.ok ? '#ff3658' : '#765';
          ctx.fillStyle = f.data.debugFang.ok ? '#ff3658' : '#765';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(f.data.debugFang.x, f.data.debugFang.y, 28, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(f.data.debugFang.x, f.data.debugFang.y); ctx.lineTo(f.data.debugFang.x+d.x*80, f.data.debugFang.y+d.y*80); ctx.stroke();
          ctx.restore();
        }
      };
    }

    const oldStd2 = Fighter.prototype.takeStandardDamage;
    Fighter.prototype.takeStandardDamage = function(amount, source=null, label='standard-number'){
      const before = floatingTexts.length;
      const dealt = oldStd2.call(this, amount, source, label) || 0;
      for (let i=before;i<floatingTexts.length;i++) {
        const t = floatingTexts[i];
        if (String(t.text||'').includes('STANDARD')) { t.text = `-${dealt.toFixed(dealt>=10?0:1)}`; t.color = '#fff'; }
      }
      return dealt;
    };
    window.apexDealHybridNumericDamage = function(target, source, rawDamage, label){
      if (!target || !source || rawDamage <= 0) return {standard:0, normal:0, normalFinal:0};
      const raw = Math.max(0, Number.isFinite(rawDamage) ? rawDamage : 0);
      const standardPart = Math.min(raw, 30), normalPart = Math.max(0, raw-30);
      source.hybridRawLog ||= {}; source.hybridRawLog[label] = (source.hybridRawLog[label]||0) + raw;
      const standardFinal = standardPart > 0 ? target.takeStandardDamage(standardPart, source, `${label}-standard`) : 0;
      let normalFinal = 0;
      if (normalPart > 0 && target.hp > 0) {
        const hp = target.hp;
        target.takeDamage(normalPart, source, `${label}-normal`, false);
        normalFinal = Math.max(0, hp-target.hp);
        if (normalFinal > 0) floatingTexts.push(new FloatingText(target.x+20,target.y-target.radius-76,`-${normalFinal.toFixed(normalFinal>=10?0:1)}`,'#ff5950'));
      }
      source.hybridHits ||= []; source.hybridHits.push({label, raw, standard:standardFinal, normalRaw:normalPart, normalFinal});
      return {standard:standardFinal, normal:normalPart, normalFinal};
    };

    const math2 = FT('MATH_V2');
    if (math2) {
      math2.update = function(f,e,dt){
        const hasGraph = projectiles.some(p=>p.type==='math_v2_graph'&&p.owner===f&&p.life>0);
        if (f.data.phase === 'typing') {
          f.data.typeTime = (f.data.typeTime||0) + dt;
          const typeDur = f.isRage ? 1.15 : 1.9;
          f.data.typeProgress = clamp(f.data.typeTime/typeDur,0,1);
          if (f.data.typeTime >= typeDur + 1.0) {
            spawnMathV2Graph(f, f.data.option.label, f.data.option.fn);
            const g = [...projectiles].reverse().find(p=>p.type==='math_v2_graph'&&p.owner===f);
            if (g) { g.drawProgress=0; g.energy=5; g.life=Math.min(g.life,3.6); g.maxLife=g.life; g.hitCd={}; }
            f.data.phase='idle'; f.data.cd=f.isRage ? 1.0 : 6.8; f.data.typeTime=0;
          }
          return;
        }
        if (!hasGraph) {
          f.data.cd -= abilityDt(f,dt);
          if (f.data.cd <= 0) {
            f.data.option = makeMathV2Function();
            f.data.phase = 'typing'; f.data.typeTime = 0; f.data.typeProgress = 0;
            projectiles.push({type:'math_v2_grid',owner:f,x:500,y:500,life:3.2,maxLife:3.2,formula:f.data.option.label});
            playFighterSound(f,'skill');
          }
        }
      };
    }

    const sniper = FT('SNIPER');
    if (sniper) {
      function farNest(f,e){ return f.data.nests.reduce((best,n)=>dist(n.x,n.y,e.x,e.y)>dist(best.x,best.y,e.x,e.y)?n:best,f.data.nests[0]); }
      function relocate(f,e,resetAim){ const n=farNest(f,e); f.x=n.x; f.y=n.y; if(resetAim){f.data.aim=3;f.data.aimMax=3;} note(f.x,f.y-f.radius-78,'RELOCATE','#ff8b8b'); }
      sniper.update = function(f,e,dt){
        if (f.isRage) {
          f.data.positionLocked = true;
          const close = e && dist(f.x,f.y,e.x,e.y) < 300;
          if (close) relocate(f,e,(f.data.aim||0)>0);
          if ((f.data.reload||0)>0) { f.data.reload-=dt; f.data.hiddenReload=true; f.applyStatus('immune',.08,{source:f}); if(f.data.reload<=0){f.data.hiddenReload=false; relocate(f,e,true);} return; }
          if ((f.data.aim||0)>0) { f.data.hiddenReload=false; f.data.aim-=dt; f.setDir(e.x-f.x,e.y-f.y); if(f.data.aim<=0){ const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45}); e.takeDamage(scaledByMirror(f,30*ratio),f,'sniper-shot'); f.data.reload=3; f.data.aim=0; playFighterSound(f,'skill'); } return; }
          f.data.reload=3; return;
        }
        if ((f.data.aim||0)>0) { f.data.positionLocked=true; f.data.aim-=dt; f.setDir(e.x-f.x,e.y-f.y); if(f.data.aim<=0){ const dir=norm(e.x-f.x,e.y-f.y), ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45}); e.takeDamage(scaledByMirror(f,30*ratio),f,'sniper-shot'); f.setDir(-dir.x,-dir.y); f.data.recoilMove=1.8; f.data.cd=7.8; playFighterSound(f,'skill'); } return; }
        f.data.recoilMove=Math.max(0,(f.data.recoilMove||0)-dt); f.data.cd-=abilityDt(f,dt); if(f.data.cd<=0){ const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); f.data.aim=Math.max(1.2,.55+1.35*ratio); f.data.aimMax=f.data.aim; note(f.x,f.y-f.radius-70,'LOCK ON','#ff8b8b'); }
      };
      sniper.speedModifier = f => (f.data.recoilMove||0)>0 ? 1.45 : 1;
    }

    const prevUpdate2 = update;
    const prevDraw2 = draw;
    let soloShake = 0;
    const soloKeyState = {};
    const soloPrevState = {};
    window.addEventListener('keydown', e => { soloKeyState[e.code]=true; });
    window.addEventListener('keyup', e => { soloKeyState[e.code]=false; soloPrevState[e.code]=false; });
    function edge2(code){ const v=!!soloKeyState[code], p=!!soloPrevState[code]; soloPrevState[code]=v; return v && !p; }
    function soloCurrent(){ return (typeof gameState !== 'undefined' && gameState === 'SOLO'); }
    function ensureSolo(){
      if (!window.__apexSoloState) window.__apexSoloState = {p1Type:'RUBBER',p2Type:'BLADE',w:4000,h:1500,projectiles:[],texts:[],clock:0,paused:false};
      return window.__apexSoloState;
    }
    window.goToSoloSelect = function(){
      const ids=['menu-screen','select-screen','tournament-screen','end-screen']; ids.forEach(id=>document.getElementById(id)?.classList.add('hidden'));
      document.getElementById('solo-screen')?.classList.remove('hidden');
      const hud=document.getElementById('solo-hud'); if(hud)hud.style.display='none';
      const st=ensureSolo(); st.p1Type=null; st.p2Type=null; st.projectiles=[]; st.texts=[];
      const host=document.getElementById('solo-roster');
      if(host){ host.innerHTML=''; ['RUBBER','ICE','TOXIC','BLADE'].forEach(n=>{ const d=document.createElement('div'); d.className='solo-card'; d.innerHTML=`<div class="f-icon">${fighterGlyph(n)}</div><div class="f-name">${n}</div><span>${FT(n)?.desc||''}</span>`; d.onclick=()=>{ if(!st.p1Type)st.p1Type=n; else st.p2Type=n; d.classList.add(st.p2Type===n?'selected-p2':'selected-p1'); const btn=document.getElementById('solo-start-btn'); if(btn)btn.classList.toggle('hidden',!(st.p1Type&&st.p2Type)); }; host.appendChild(d); }); }
      document.getElementById('solo-start-btn')?.classList.add('hidden');
    };
    function makeSoloF(name,x,y,side){ const t=FT(name); const d=side===1?1:-1; return {name,type:t,x,y,dx:d,dy:0,radius:75,hp:100,maxHp:100,side,color:t?.color||'#fff',cd:{normal:0,special:0},rage:0,super:0,bounce:0,dash:0,black:0,poison:0,k:0,t:0,selfSlow:0,lastWallHit:0}; }
    window.startSoloMode = function(){
      const st=ensureSolo(); if(!st.p1Type||!st.p2Type)return;
      st.p1=makeSoloF(st.p1Type,680,750,1); st.p2=makeSoloF(st.p2Type,3320,750,2); st.projectiles=[]; st.texts=[]; st.clock=0; st.paused=false; gameState='SOLO';
      document.getElementById('solo-screen')?.classList.add('hidden'); const hud=document.getElementById('solo-hud'); if(hud)hud.style.display='flex'; if(!reqId)reqId=requestAnimationFrame(loop);
    };
    function addSoloText(st,x,y,text,color){ st.texts.push({x,y,text,color,life:.9,maxLife:.9}); }
    function hitSolo(st,t,s,d,color){ t.hp=Math.max(0,t.hp-d); soloShake=Math.max(soloShake,Math.min(20,d*1.4)); addSoloText(st,t.x,t.y-t.radius-18,`-${d.toFixed(d>=10?0:1)}`,color||'#ff5950'); }
    function soloAttack(p,st){ if((p.cd.normal||0)>0)return; if(p.name==='RUBBER'){p.dash=.28;p.bounce=3;p.cd.normal=.75;addSoloText(st,p.x,p.y-p.radius-26,'DASH','#ffd65c');} if(p.name==='ICE'){p.selfSlow=.35;p.cd.normal=1;st.projectiles.push({type:'solo_arrow',owner:p,x:p.x+p.dx*90,y:p.y+p.dy*90,vx:p.dx*900,vy:p.dy*900,life:4,maxLife:4,damage:3});} if(p.name==='BLADE'){p.cd.normal=.15;} }
    function soloSpecial2(p,st){ if((p.cd.special||0)>0)return; if(p.name==='RUBBER'){p.super=5;p.k=0;p.t=0;p.cd.special=9;addSoloText(st,p.x,p.y-p.radius-36,'SUPER BOUNCE','#ffe783');} if(p.name==='ICE'){p.cd.special=5;st.projectiles.push({type:'solo_ice_lane',owner:p,x:p.x,y:p.y,dx:p.dx,dy:p.dy,life:2.5,maxLife:2.5,width:78,damage:5});} if(p.name==='TOXIC'){const e=p.side===1?st.p2:st.p1; const sc=[0,.5,.7,1,1.5,2][clamp(Math.ceil(e.poison||0),1,5)]; p.cd.special=5; hitSolo(st,e,p,12*sc,'#9dff47'); if(p.rage>0){p.hp=Math.min(100,p.hp+6);addSoloText(st,p.x,p.y-p.radius-34,'TOXIC HEAL +6','#9dff47');}} if(p.name==='BLADE'){p.black=5;p.cd.special=8;addSoloText(st,p.x,p.y-p.radius-34,'BLACK SWORD','#ff3333');} }
    function updateSolo2(dt){
      const st=ensureSolo(); if(!st.p1||!st.p2)return; st.clock+=dt; soloShake=Math.max(0,soloShake-dt*18);
      if(edge2('Escape'))st.paused=!st.paused; if(edge2('KeyB'))return goToMenu(); if(edge2('KeyR'))return window.startSoloMode(); if(st.paused)return;
      for(const p of [st.p1,st.p2]){
        const p1=p.side===1; const nx=(soloKeyState[p1?'KeyD':'ArrowRight']?1:0)-(soloKeyState[p1?'KeyA':'ArrowLeft']?1:0); const ny=(soloKeyState[p1?'KeyS':'ArrowDown']?1:0)-(soloKeyState[p1?'KeyW':'ArrowUp']?1:0); const n=norm(nx,ny);
        if(nx||ny){ if(p.bounce>0 && Math.abs(n.x-p.dx)+Math.abs(n.y-p.dy)>.35)p.bounce=0; p.dx=n.x;p.dy=n.y; }
        const normalDown=p1?soloKeyState.KeyJ:(soloKeyState.Numpad1||soloKeyState.Digit1);
        if(edge2(p1?'KeyJ':(soloKeyState.Numpad1?'Numpad1':'Digit1'))) soloAttack(p,st);
        if(edge2(p1?'KeyU':(soloKeyState.Numpad2?'Numpad2':'Digit2'))) soloSpecial2(p,st);
        for(const k of Object.keys(p.cd))p.cd[k]=Math.max(0,p.cd[k]-dt); p.super=Math.max(0,p.super-dt); p.black=Math.max(0,p.black-dt); p.selfSlow=Math.max(0,p.selfSlow-dt);
        let sp=360*(p.selfSlow>0?.7:1); if(p.name==='TOXIC'&&!normalDown)sp*=1.3; if(p.super>0)sp*=1.45; if(p.black>0)sp*=1.12;
        p.x+=n.x*sp*dt; p.y+=n.y*sp*dt;
        if(p.dash>0){p.dash-=dt;p.x+=p.dx*1050*dt;p.y+=p.dy*1050*dt;}
        let wall=false; if(p.x<p.radius||p.x>st.w-p.radius){p.dx*=-1;wall=true;} if(p.y<p.radius||p.y>st.h-p.radius){p.dy*=-1;wall=true;} p.x=clamp(p.x,p.radius,st.w-p.radius); p.y=clamp(p.y,p.radius,st.h-p.radius);
        if(wall){ if(p.name==='RUBBER'&&(p.bounce>0||p.dash>0||p.super>0)){p.bounce=Math.max(p.bounce,3);p.k+=1;p.t+=1;st.projectiles.push({type:'solo_rubber_spark',x:p.x,y:p.y,life:.45,maxLife:.45});} if(p.name==='BLADE'&&st.clock-(p.lastWallHit||0)>.18){p.lastWallHit=st.clock; const speed=(p.black>0?900:600); st.projectiles.push({type:'solo_blade',owner:p,x:p.x,y:p.y,vx:-p.dx*speed,vy:-p.dy*speed,life:1.6,maxLife:1.6,damage:p.black>0?7:4,bounces:p.black>0?1:0});}}
        if(p.name==='TOXIC'&&normalDown)st.projectiles.push({type:'solo_poison',owner:p,x:p.x,y:p.y,radius:58,life:3,maxLife:3});
      }
      const a=st.p1,b=st.p2; if(dist(a.x,a.y,b.x,b.y)<a.radius+b.radius){ if(a.name==='RUBBER'&&(a.bounce>0||a.dash>0||a.super>0)){hitSolo(st,b,a,8+(a.super>0?4:0),'#ffd65c');a.k++;a.t++;} if(b.name==='RUBBER'&&(b.bounce>0||b.dash>0||b.super>0)){hitSolo(st,a,b,8+(b.super>0?4:0),'#ffd65c');b.k++;b.t++;} }
      for(const pr of st.projectiles){ pr.life-=dt; if(pr.vx){pr.x+=pr.vx*dt;pr.y+=pr.vy*dt;} const e=pr.owner?.side===1?st.p2:st.p1; if(!e)continue; if(pr.type==='solo_arrow'&&dist(pr.x,pr.y,e.x,e.y)<e.radius+18){hitSolo(st,e,pr.owner,3,'#bffcff');e.cd.normal=(e.cd.normal||0)+.3;pr.life=0;} if(pr.type==='solo_poison'&&dist(pr.x,pr.y,e.x,e.y)<e.radius+pr.radius){e.poison=clamp((e.poison||0)+dt*.95,0,5); if(Math.random()<dt*2.2)hitSolo(st,e,pr.owner,.32,'#9dff47');} if(pr.type==='solo_ice_lane'&&distToSegment(e.x,e.y,pr.x,pr.y,pr.x+pr.dx*920,pr.y+pr.dy*920)<pr.width){hitSolo(st,e,pr.owner,pr.damage*dt,'#bffcff');} if(pr.type==='solo_blade'&&dist(pr.x,pr.y,e.x,e.y)<e.radius+32){hitSolo(st,e,pr.owner,pr.damage,'#ff3333');pr.life=0;} }
      st.projectiles=st.projectiles.filter(p=>p.life>0&&p.x>-200&&p.x<st.w+200&&p.y>-200&&p.y<st.h+200).slice(-260); st.texts.forEach(t=>{t.life-=dt;t.y-=26*dt;}); st.texts=st.texts.filter(t=>t.life>0);
    }
    function drawSoloFighter(ctx,p){
      ctx.save(); resetCanvasState(ctx); ctx.translate(p.x,p.y); ctx.rotate(Math.atan2(p.dy,p.dx));
      if(p.name==='RUBBER'){ ctx.scale(1+(p.dash>0?.25:0),1-(p.dash>0?.15:0)); drawSketchBlob(ctx,p.radius*(p.super>0?1.18:1),'#2b2b30',14); ctx.strokeStyle=p.super>0?'#ffe783':'#d7d7df'; ctx.lineWidth=7; ctx.beginPath(); ctx.ellipse(0,0,p.radius*.95,p.radius*.70,0,0,TAU); ctx.stroke(); if(p.super>0){ctx.strokeStyle='rgba(255,231,131,.8)';ctx.beginPath();ctx.arc(0,0,p.radius+26,0,TAU);ctx.stroke();} }
      else if(p.name==='ICE'){ drawPolygon(ctx,[[-50,-60],[24,-76],[70,-8],[36,62],[-42,58],[-74,-4]],'#d8ffff','#124d64',5); ctx.strokeStyle='#ffffff'; ctx.lineWidth=3; for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(-30,i*18);ctx.lineTo(42,-i*14);ctx.stroke();} }
      else if(p.name==='TOXIC'){ drawSketchBlob(ctx,p.radius,'#315015',12); ctx.fillStyle='#9dff47'; for(let i=0;i<6;i++){ctx.beginPath();ctx.arc(Math.cos(i)*38,Math.sin(i*2)*28,8,0,TAU);ctx.fill();} ctx.fillStyle='#102208';ctx.font='900 20px monospace';ctx.textAlign='center';ctx.fillText(`P${Math.ceil(p.poison||0)}`,0,8); }
      else if(p.name==='BLADE'){ drawPolygon(ctx,[[-64,-24],[10,-16],[100,0],[10,16],[-64,24],[-36,0]],p.black>0?'#101018':'#c6cfd2',p.black>0?'#ff3333':'#101010',6); if(p.black>0){ctx.strokeStyle='rgba(255,30,30,.85)';ctx.lineWidth=8;ctx.beginPath();ctx.arc(0,0,p.radius+22,0,TAU);ctx.stroke();} }
      ctx.restore();
    }
    function drawSolo2(){
      const st=ensureSolo(); ctx.save(); resetCanvasState(ctx); ctx.clearRect(0,0,GAME_SIZE,GAME_SIZE); if(!st.p1){ctx.restore();return;}
      const a=st.p1,b=st.p2; const minX=Math.min(a.x,b.x)-620,maxX=Math.max(a.x,b.x)+620,minY=Math.min(a.y,b.y)-420,maxY=Math.max(a.y,b.y)+420; const z=clamp(Math.min(GAME_SIZE/(maxX-minX),GAME_SIZE/(maxY-minY)),.24,.82); const cx=clamp((minX+maxX)/2,GAME_SIZE/(2*z),st.w-GAME_SIZE/(2*z)); const cy=clamp((minY+maxY)/2,GAME_SIZE/(2*z),st.h-GAME_SIZE/(2*z));
      ctx.translate(GAME_SIZE/2+rand(-soloShake,soloShake),GAME_SIZE/2+rand(-soloShake,soloShake)); ctx.scale(z,z); ctx.translate(-cx,-cy);
      const grd=ctx.createLinearGradient(0,0,st.w,st.h); grd.addColorStop(0,'#090706'); grd.addColorStop(.55,'#18110f'); grd.addColorStop(1,'#050404'); ctx.fillStyle=grd; ctx.fillRect(0,0,st.w,st.h);
      ctx.save(); ctx.globalAlpha=.16; ctx.strokeStyle='#7c6c4d'; for(let x=0;x<st.w;x+=180){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+Math.sin(x)*18,st.h);ctx.stroke();} for(let i=0;i<18;i++){ctx.fillStyle=i%2?'#201711':'#0f0d0b';ctx.fillRect(i*230%st.w,(i*97)%st.h,120,70);} ctx.restore(); ctx.strokeStyle='#806f4e'; ctx.lineWidth=16; ctx.strokeRect(0,0,st.w,st.h);
      for(const p of st.projectiles){ctx.save(); resetCanvasState(ctx); const a=clamp(p.life/(p.maxLife||p.life||1),0,1); ctx.globalAlpha=a; if(p.type==='solo_poison'){ctx.fillStyle='rgba(117,255,85,.38)';ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,TAU);ctx.fill();ctx.strokeStyle='#9dff47';ctx.stroke();} else if(p.type==='solo_arrow'){ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));drawPolygon(ctx,[[-34,-8],[28,0],[-34,8],[-18,0]],'#d8ffff','#58c8d8',3);} else if(p.type==='solo_ice_lane'){ctx.strokeStyle='rgba(191,252,255,.55)';ctx.lineWidth=p.width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+p.dx*920,p.y+p.dy*920);ctx.stroke();ctx.strokeStyle='#ffffff';ctx.lineWidth=6;ctx.setLineDash([24,16]);ctx.stroke();} else if(p.type==='solo_blade'){ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));ctx.fillStyle='rgba(230,246,255,.32)';ctx.beginPath();ctx.ellipse(-110,0,180,92,0,-.8,.8);ctx.fill();ctx.strokeStyle=p.owner?.black>0?'#ff3333':'#f4fbff';ctx.lineWidth=9;ctx.beginPath();ctx.arc(-90,0,80,-.7,.7);ctx.stroke();} else if(p.type==='solo_rubber_spark'){ctx.strokeStyle='#ffe783';ctx.lineWidth=6;ctx.beginPath();ctx.arc(p.x,p.y,(1-a)*60+12,0,TAU);ctx.stroke();} ctx.restore();}
      drawSoloFighter(ctx,a); drawSoloFighter(ctx,b); for(const t of st.texts){ctx.save();ctx.globalAlpha=clamp(t.life/t.maxLife,0,1);ctx.fillStyle=t.color;ctx.font='900 30px sans-serif';ctx.textAlign='center';ctx.strokeStyle='#000';ctx.lineWidth=5;ctx.strokeText(t.text,t.x,t.y);ctx.fillText(t.text,t.x,t.y);ctx.restore();}
      ctx.restore(); resetCanvasState(ctx); function bar(x,y,p,flip){ctx.save();ctx.fillStyle='rgba(5,5,5,.78)';ctx.fillRect(x,y,360,70);ctx.strokeStyle='rgba(255,231,160,.45)';ctx.lineWidth=2;ctx.strokeRect(x,y,360,70);ctx.fillStyle='#f5dfaa';ctx.font='900 18px sans-serif';ctx.textAlign=flip?'right':'left';ctx.fillText(`${p.name} ${p.side===1?'P1':'P2'}`,x+(flip?346:14),y+22);ctx.fillStyle='#23110e';ctx.fillRect(x+14,y+34,332,16);ctx.fillStyle=p.hp>35?'#82e06b':'#ff4a4a';ctx.fillRect(x+14,y+34,332*clamp(p.hp/100,0,1),16);ctx.fillStyle='#d8ccb1';ctx.font='800 11px monospace';ctx.fillText(`N ${p.cd.normal.toFixed(1)}  S ${p.cd.special.toFixed(1)}  ${p.name==='RUBBER'?`K${p.k} T${p.t}`:p.name==='BLADE'?`BLACK ${p.black.toFixed(1)}`:p.name==='TOXIC'?`POISON ${Math.ceil(p.poison||0)}`:p.selfSlow>0?'SELF SLOW':''}`,x+(flip?346:14),y+62);ctx.restore();} bar(18,18,a,false);bar(622,18,b,true); ctx.fillStyle='#f5dfaa';ctx.font='900 16px sans-serif';ctx.textAlign='center';ctx.fillText('SOLO 1V1 LOCAL | P1 WASD J/U | P2 ARROWS 1/2 | ESC pause R restart B menu',500,976); if(st.paused){ctx.fillStyle='rgba(0,0,0,.62)';ctx.fillRect(0,0,1000,1000);ctx.fillStyle='#fff';ctx.font='900 64px serif';ctx.textAlign='center';ctx.fillText('PAUSED',500,500);}
    }
    update = function(dt){ if(soloCurrent()) return updateSolo2(dt); return prevUpdate2(dt); };
    draw = function(){ if(soloCurrent()) return drawSolo2(); return prevDraw2(); };

    const oldDrawProjectiles2 = drawProjectiles;
    drawProjectiles = function(ctx){
      ctx.save(); resetCanvasState(ctx);
      try { oldDrawProjectiles2(ctx); }
      finally { ctx.restore(); resetCanvasState(ctx); }
      if (DEBUG_VAMPIRE_BITE) for(const f of fighters){ if(f?.name==='VAMPIRE'&&f.data.debugFang){ctx.save();resetCanvasState(ctx);ctx.strokeStyle=f.data.debugFang.ok?'#ff3658':'#765';ctx.beginPath();ctx.arc(f.data.debugFang.x,f.data.debugFang.y,28,0,TAU);ctx.stroke();ctx.restore();}}
    };
    window.apexCorrectivePatch2 = 'ready';
  })();

  (function correctiveProductionPatch3(){
    const FT = name => FighterTypes.find(t => t.name === name);
    const note = (x,y,text,color) => floatingTexts.push(new FloatingText(x,y,text,color));
    function resetCtx(c){
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0; c.shadowColor = 'transparent';
      c.shadowOffsetX = 0; c.shadowOffsetY = 0; c.filter = 'none'; c.setLineDash([]); c.lineCap = 'butt'; c.lineJoin = 'miter';
    }

    const drawBeforeKungfuFix = Fighter.prototype.draw;
    Fighter.prototype.draw = function(c){
      c.save();
      try { drawBeforeKungfuFix.call(this, c); }
      finally { c.restore(); resetCtx(c); }
    };

    const oldHybridStd3 = Fighter.prototype.takeStandardDamage;
    Fighter.prototype.takeStandardDamage = function(amount, source=null, label='standard-number'){
      const before = floatingTexts.length;
      const dealt = oldHybridStd3.call(this, amount, source, label) || 0;
      for (let i=before;i<floatingTexts.length;i++) {
        const t = floatingTexts[i];
        if (String(t.text||'').includes('STANDARD')) { t.text = `-${dealt.toFixed(dealt>=10?0:1)}`; t.color = '#fff'; }
      }
      return dealt;
    };
    window.apexDealHybridNumericDamage = function(target, source, rawDamage, label){
      if (!target || !source || rawDamage <= 0) return {standard:0, normal:0, normalFinal:0};
      const raw = Math.max(0, Number.isFinite(rawDamage) ? rawDamage : 0);
      const standardPart = Math.min(raw, 30), normalPart = Math.max(0, raw - 30);
      source.hybridRawLog ||= {}; source.hybridRawLog[label] = (source.hybridRawLog[label] || 0) + raw;
      const standardFinal = standardPart > 0 ? target.takeStandardDamage(standardPart, source, `${label}-standard`) : 0;
      let normalFinal = 0;
      if (normalPart > 0 && target.hp > 0) {
        const hp = target.hp, beforeTexts = floatingTexts.length;
        target.takeDamage(normalPart, source, `${label}-normal`, false);
        normalFinal = Math.max(0, hp - target.hp);
        for (let i=floatingTexts.length-1;i>=beforeTexts;i--) {
          if (/^-/.test(String(floatingTexts[i].text||''))) floatingTexts.splice(i,1);
        }
        if (normalFinal > 0) floatingTexts.push(new FloatingText(target.x+20, target.y-target.radius-72, `-${normalFinal.toFixed(normalFinal>=10?0:1)}`, '#ff5950'));
      }
      source.hybridHits ||= []; source.hybridHits.push({label, raw, standard:standardFinal, normalRaw:normalPart, normalFinal});
      return {standard:standardFinal, normal:normalPart, normalFinal};
    };

    const vampire = FT('VAMPIRE');
    if (vampire) {
      vampire.onCollide = function(f,e){
        if ((f.data.latchTimer||0)>0) return true;
        const forward = norm((f.data.lastMoveDir||f.dir||{x:1,y:0}).x, (f.data.lastMoveDir||f.dir||{x:1,y:0}).y);
        const toEnemy = norm(e.x-f.x,e.y-f.y);
        const front = forward.x*toEnemy.x + forward.y*toEnemy.y;
        const fang = {x:f.x+forward.x*f.radius*.92, y:f.y+forward.y*f.radius*.92};
        const gap = dist(fang.x, fang.y, e.x, e.y) - e.radius;
        if (front <= .15 || gap > 52 || dist(f.x,f.y,e.x,e.y) > f.radius+e.radius+12) return false;
        f.data.latchTimer = 5.0;
        f.data.latchTick = 0;
        f.data.latchTarget = e.id;
        f.data.bloodLinkLevel = (f.data.bloodLinkLevel||0) + 1;
        f.data.latchForward = forward;
        f.setDir(e.x-f.x,e.y-f.y);
        e.applyStatus('slow', .25, {mult:.3, source:f});
        projectiles.push({type:'blood_link',owner:f,targetId:e.id,life:5,maxLife:5});
        note(fang.x,fang.y-40,'FANG LOCK 5s','#ff3658');
        playFighterSound(f,'skill');
        return true;
      };
      vampire.update = function(f,e,dt){
        if ((f.data.latchTimer||0) <= 0 && f.dir) f.data.lastMoveDir = {x:f.dir.x,y:f.dir.y};
        if (f.data.latchTimer > 0 && e && e.hp > 0) {
          f.data.positionLocked = true;
          f.data.latchTimer = Math.max(0, f.data.latchTimer - dt);
          const forward = norm(e.x-f.x,e.y-f.y);
          const gap = e.radius + f.radius*.92 - 6;
          f.x = clamp(e.x - forward.x*gap, f.radius, GAME_SIZE-f.radius);
          f.y = clamp(e.y - forward.y*gap, f.radius, GAME_SIZE-f.radius);
          f.setDir(forward.x, forward.y);
          e.applyStatus('slow', .12, {mult:.3, source:f});
          f.data.latchTick += dt;
          while (f.data.latchTick >= .5) {
            f.data.latchTick -= .5;
            e.takeDamage(scaledByMirror(f,1.5), f, 'vampire-latch-drain');
            f.heal(1.5, true);
          }
          if (f.data.latchTimer <= 0) f.data.latchCd = 1.4;
        } else {
          f.data.latchCd = Math.max(0,(f.data.latchCd||0)-abilityDt(f,dt));
        }
        if(f.isRage && f.data.bloodLinkLevel>0){
          f.data.linkTick=(f.data.linkTick||0)+dt;
          while(f.data.linkTick>=.5){ f.data.linkTick-=.5; const d=.25*f.data.bloodLinkLevel; e.takeDamage(d,f,'permanent-blood-link',true); f.heal(d,true); }
        }
      };
      vampire.draw = function(c,f){
        const latched = f.data.latchTimer > 0;
        if (latched) c.scale(.88,.88);
        drawSketchBlob(c,f.radius,'#4a0710',14);
        c.fillStyle='#fff7ee';
        c.beginPath(); c.moveTo(42,-26); c.lineTo(116,-10); c.lineTo(46,4); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(42,26); c.lineTo(116,10); c.lineTo(46,-4); c.closePath(); c.fill();
        c.strokeStyle='#180205'; c.lineWidth=3;
        c.beginPath(); c.moveTo(42,-26); c.lineTo(116,-10); c.moveTo(42,26); c.lineTo(116,10); c.stroke();
        if (latched) {
          c.fillStyle='#ffb2a8'; c.font='900 14px monospace'; c.textAlign='center';
          c.fillText(`DRAIN ${f.data.latchTimer.toFixed(1)}s`,0,-f.radius-20);
        }
        if ((f.data.bloodLinkLevel||0)>0) {
          c.fillStyle='#ff6b78'; c.font='900 12px monospace'; c.textAlign='center';
          c.fillText(`BLOOD LINK ${f.data.bloodLinkLevel}`,0,f.radius+25);
        }
      };
    }
    const oldHandleCollisions3 = handleCollisions;
    handleCollisions = function(dt){
      const a=fighters[0], b=fighters[1];
      if (a&&b&&((a.name==='VAMPIRE'&&a.data?.latchTimer>0&&a.data?.latchTarget===b.id)||(b.name==='VAMPIRE'&&b.data?.latchTimer>0&&b.data?.latchTarget===a.id))) return;
      return oldHandleCollisions3(dt);
    };

    const oldSpawnGraph3 = spawnMathV2Graph;
    spawnMathV2Graph = function(owner, formula, kindOrFn){
      oldSpawnGraph3(owner, formula, kindOrFn);
      const g=[...projectiles].reverse().find(p=>p.type==='math_v2_graph'&&p.owner===owner);
      if (g) {
        g.drawProgress=0; g.energy=5; g.life=Math.min(g.life||3.6,3.8); g.maxLife=g.life;
        projectiles.push({type:'math_v2_grid',owner,x:500,y:500,life:g.life,maxLife:g.life,formula:g.formula||formula,followGraph:g});
      }
    };
    const oldDrawProjectiles3 = drawProjectiles;
    drawProjectiles = function(c){
      c.save(); resetCtx(c);
      try { oldDrawProjectiles3(c); }
      finally { c.restore(); resetCtx(c); }
    };

    const sniper = FT('SNIPER');
    if (sniper) {
      function farNest(f,e){ return f.data.nests.reduce((best,n)=>dist(n.x,n.y,e.x,e.y)>dist(best.x,best.y,e.x,e.y)?n:best,f.data.nests[0]); }
      function canRelocate(f){ f.data.relocWindow=(f.data.relocWindow||[]).filter(t=>matchClock-t<=6); return f.data.relocWindow.length<4; }
      function doRelocate(f,e,bonusAim){
        if (!canRelocate(f)) return false;
        f.data.relocWindow.push(matchClock);
        const n=farNest(f,e); f.x=n.x; f.y=n.y;
        if (bonusAim) { f.data.aim=Math.min(3, (f.data.aim||0)+1); f.data.aimMax=Math.max(f.data.aimMax||3, f.data.aim); }
        note(f.x,f.y-f.radius-78, bonusAim?'AIM +1s':'RELOCATE','#ff8b8b');
        return true;
      }
      sniper.update = function(f,e,dt){
        if (f.isRage) {
          f.data.positionLocked = true;
          const close = e && dist(f.x,f.y,e.x,e.y)<300;
          if (close && (f.data.aim||0)>0) doRelocate(f,e,true);
          if (close && (f.data.reload||0)>0) doRelocate(f,e,false);
          if ((f.data.reload||0)>0) { f.data.reload-=dt; f.data.hiddenReload=true; f.applyStatus('immune',.08,{source:f}); if(f.data.reload<=0){f.data.hiddenReload=false; const n=farNest(f,e); f.x=n.x; f.y=n.y; f.data.aim=3; f.data.aimMax=3;} return; }
          if ((f.data.aim||0)>0) { f.data.hiddenReload=false; f.data.aim-=dt; f.setDir(e.x-f.x,e.y-f.y); if(f.data.aim<=0){ const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45,knockback:true}); e.takeDamage(scaledByMirror(f,30*ratio),f,'rage-sniper-shot'); const n=norm(e.x-f.x,e.y-f.y); e.applyStatus('push',.22,{x:n.x,y:n.y,strength:900}); f.data.reload=3; f.data.aim=0; playFighterSound(f,'skill'); } return; }
          f.data.reload=3; return;
        }
        if ((f.data.aim||0)>0) { f.data.positionLocked=true; f.data.aim-=dt; f.setDir(e.x-f.x,e.y-f.y); if(f.data.aim<=0){ const dir=norm(e.x-f.x,e.y-f.y), ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45}); e.takeDamage(scaledByMirror(f,30*ratio),f,'sniper-shot'); f.setDir(-dir.x,-dir.y); f.data.recoilMove=1.8; f.data.cd=7.8; playFighterSound(f,'skill'); } return; }
        f.data.recoilMove=Math.max(0,(f.data.recoilMove||0)-dt); f.data.cd-=abilityDt(f,dt); if(f.data.cd<=0){ const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); f.data.aim=Math.max(1.2,.55+1.35*ratio); f.data.aimMax=f.data.aim; }
      };
    }

    let soloShake=0; const soloKeys={}, soloPrev={};
    window.addEventListener('keydown', e=>{soloKeys[e.code]=true;if(['KeyW','KeyA','KeyS','KeyD','KeyE','KeyR','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Digit1','Digit2','Digit3','Numpad1','Numpad2','Numpad3'].includes(e.code))e.preventDefault();});
    window.addEventListener('keyup', e=>{soloKeys[e.code]=false; soloPrev[e.code]=false;});
    function edge(code){const v=!!soloKeys[code], p=!!soloPrev[code]; soloPrev[code]=v; return v&&!p;}
    function soloState(){ if(!window.__solo375) window.__solo375={w:1000,h:375,projectiles:[],texts:[],clock:0,paused:false,p1Type:'RUBBER',p2Type:'BLADE'}; return window.__solo375; }
    function soloRosterTypes(){return FighterTypes.filter(t=>t&&t.name);}
    function soloSpeedScale(t){return clamp((t?.speed||500)/500,.75,1.35);}
    function makeSF(name,x,y,side){const t=FT(name);const speedScale=soloSpeedScale(t);return {name,type:t,x,y,dx:side===1?1:-1,dy:0,radius:clamp(24+speedScale*4,26,32),hp:100,maxHp:100,side,color:t?.color||'#fff',desc:t?.desc||'',baseSpeed:135*speedScale,cd:{normal:0,special:0,rage:0},super:0,bounce:0,dash:0,black:0,poison:0,k:0,t:0,selfSlow:0,dead:false,data:{}};}
    window.goToSoloSelect=function(){['menu-screen','select-screen','tournament-screen','end-screen'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));document.getElementById('solo-screen')?.classList.remove('hidden');const hud=document.getElementById('solo-hud');if(hud)hud.style.display='none';const st=soloState();st.p1Type=null;st.p2Type=null;const title=document.getElementById('solo-title');if(title)title.textContent='P1 SELECT';document.getElementById('solo-start-btn')?.classList.add('hidden');const host=document.getElementById('solo-roster');if(host){host.innerHTML='';const renderPickState=()=>{host.querySelectorAll('.solo-card').forEach(card=>{const n=card.dataset.name;card.classList.toggle('selected-p1',st.p1Type===n);card.classList.toggle('selected-p2',st.p2Type===n);});if(title)title.textContent=st.p1Type?(st.p2Type?'READY':'P2 SELECT'):'P1 SELECT';document.getElementById('solo-start-btn')?.classList.toggle('hidden',!(st.p1Type&&st.p2Type));};soloRosterTypes().forEach(t=>{const n=t.name;const d=document.createElement('div');d.className='solo-card';d.dataset.name=n;d.style.borderColor=t.color||'#5f584b';d.innerHTML=`<div class="f-icon" style="color:${t.color||'#fff'}">${fighterGlyph(n)}</div><div class="f-name" style="color:${t.color||'#fff'}">${n}</div><span class="f-desc">${t.desc||''}</span>`;d.onclick=()=>{if(!st.p1Type)st.p1Type=n;else if(!st.p2Type)st.p2Type=n;else{st.p1Type=n;st.p2Type=null;}renderPickState();};host.appendChild(d);});renderPickState();}};
    window.startSoloMode=function(){const st=soloState();if(!st.p1Type||!st.p2Type)return;st.p1=makeSF(st.p1Type,125,188,1);st.p2=makeSF(st.p2Type,875,188,2);st.projectiles=[];st.texts=[];st.clock=0;st.winner=null;gameState='SOLO';document.getElementById('solo-screen')?.classList.add('hidden');const hud=document.getElementById('solo-hud');if(hud)hud.style.display='flex';if(!reqId)reqId=requestAnimationFrame(loop);};
    const oldUpdate4=update, oldDraw4=draw;
    function text(st,x,y,t,c){st.texts.push({x,y,text:t,color:c,life:.8,maxLife:.8});}
    function dmg(st,target,src,val,c){if(target.dead)return;target.hp=Math.max(0,target.hp-val);text(st,target.x,target.y-target.radius-8,`-${val.toFixed(val>=10?0:1)}`,c||'#ff5950');soloShake=Math.max(soloShake,Math.min(12,val));if(target.hp<=0){target.dead=true;st.winner=src;}}
    function soloBasicShot(st,p,kind='solo_generic',opts={}){const speed=opts.speed||430+((p.type?.speed||500)-500)*.35;st.projectiles.push(Object.assign({type:kind,owner:p,x:p.x+p.dx*34,y:p.y+p.dy*34,vx:p.dx*speed,vy:p.dy*speed,life:2.2,maxLife:2.2,radius:kind==='solo_generic_special'?18:10,damage:kind==='solo_generic_special'?8:3.2,color:p.color},opts));}
    function soloBurst(st,p,x,y,radius,damage,opts={}){st.projectiles.push(Object.assign({type:'solo_generic_burst',owner:p,x,y,life:.55,maxLife:.55,radius,damage,color:p.color,hit:false},opts));}
    function spawnSoloWeb(st,p,count=3,life=5.5){
      for(let i=0;i<count;i++){
        const edge=Math.floor(rand(0,4));
        const anchor=edge===0?{x:0,y:rand(20,355)}:edge===1?{x:1000,y:rand(20,355)}:edge===2?{x:rand(20,980),y:0}:{x:rand(20,980),y:375};
        st.projectiles.push({type:'solo_web_line',owner:p,x1:anchor.x,y1:anchor.y,x2:p.x,y2:p.y,life,maxLife:life,hitCd:0,color:'#d9ccff'});
      }
    }
    function soloSkillNote(st,p,label){text(st,p.x,p.y-35,label,p.color||'#ffe783');playFighterSound(p.name,'skill');}
    function sAttack(st,p){if(p.cd.normal>0||p.dead)return;if(p.name==='RUBBER'){p.dash=.22;p.bounce=3;p.cd.normal=.65;}else if(p.name==='ICE'){p.selfSlow=.35;p.cd.normal=1;st.projectiles.push({type:'solo_arrow',owner:p,x:p.x+p.dx*34,y:p.y+p.dy*34,vx:p.dx*460,vy:p.dy*460,life:3,maxLife:3,damage:3});}else if(p.name==='BLADE'){p.cd.normal=.1;}else if(['FLASH','WOLF','KUNGFU','MONK'].includes(p.name)){p.dash=.16;p.bounce=1;p.cd.normal=.7;}else{soloBasicShot(st,p,'solo_generic',{damage:3.2,radius:10});p.cd.normal=clamp(.92/soloSpeedScale(p.type),.55,1.1);playFighterSound(p.name,'wall');}}
    function sSpecial(st,p){
      if(p.cd.special>0||p.dead)return;
      const e=p.side===1?st.p2:st.p1;
      const mid={x:(p.x+e.x)/2,y:(p.y+e.y)/2};
      let nextCd=5.8;
      if(p.name==='RUBBER'){
        p.super=5;p.k=0;p.t=0;nextCd=8;text(st,p.x,p.y-35,'KINETIC SUPER','#ffe783');
      }else if(p.name==='ICE'){
        nextCd=5;st.projectiles.push({type:'solo_ice_lane',owner:p,x:p.x,y:p.y,dx:p.dx,dy:p.dy,life:2,maxLife:2,width:38,damage:5});soloSkillNote(st,p,'ICE LANE');
      }else if(p.name==='TOXIC'){
        const sc=[0,.5,.7,1,1.5,2][clamp(Math.ceil(e.poison||0),1,5)];nextCd=5;dmg(st,e,p,12*sc,'#9dff47');soloBurst(st,p,e.x,e.y,58,2,{effect:'poison',life:1.4,maxLife:1.4});soloSkillNote(st,p,'RUPTURE');
      }else if(p.name==='BLADE'){
        p.black=5;nextCd=8;soloSkillNote(st,p,'BLACK SLASH');
      }else{
        switch(p.name){
          case'VAMPIRE':soloBasicShot(st,p,'solo_generic_special',{damage:6.5,radius:18,effect:'drain',heal:5,color:'#b80f24'});soloSkillNote(st,p,'BLOOD LINK');break;
          case'SPIDER':spawnSoloWeb(st,p,4,7);soloBurst(st,p,mid.x,mid.y,72,4,{effect:'web',slow:.9,life:1.8,maxLife:1.8,color:'#6f3f86'});soloSkillNote(st,p,'WEB SNARE');break;
          case'VOLCANO':soloBurst(st,p,e.x,e.y,82,10,{effect:'burn',life:.85,maxLife:.85,color:'#ff6d2e'});soloSkillNote(st,p,'METEOR');break;
          case'MAGNET':soloBurst(st,p,p.x,p.y,120,6,{effect:'magnet',slow:.65,life:1.6,maxLife:1.6,color:'#e0c23a'});soloSkillNote(st,p,'MAGNET FIELD');break;
          case'FLASH':p.dash=.46;p.bounce=1;soloBasicShot(st,p,'solo_generic_special',{damage:5,radius:13,effect:'stun',slow:.5,speed:760,color:'#fff14a'});soloSkillNote(st,p,'LIGHTNING DASH');break;
          case'ELECTRIC':soloBasicShot(st,p,'solo_generic_special',{damage:7.5,radius:16,effect:'stun',slow:.55,speed:700,color:'#4380ff'});soloSkillNote(st,p,'DISCHARGE');break;
          case'ORBIT':p.data.orbit=(p.data.orbit||0)+1;soloBurst(st,p,p.x,p.y,92,5,{effect:'orbit',life:1.2,maxLife:1.2,color:'#eee8dc'});soloSkillNote(st,p,'SATELLITE');break;
          case'MIRROR':p.data.mirror=3.2;soloBasicShot(st,p,'solo_generic_special',{damage:5.5,radius:18,effect:'mirror',color:'#d7dde0'});soloSkillNote(st,p,'MIRROR SWAP');break;
          case'BLACK_HOLE':soloBurst(st,p,mid.x,mid.y,115,9,{effect:'gravity',slow:1.1,life:1.5,maxLife:1.5,color:'#22142a'});soloSkillNote(st,p,'GRAVITY WELL');break;
          case'SAW':p.data.spin=2.2;soloBurst(st,p,p.x,p.y,82,7,{effect:'rip',life:.7,maxLife:.7,color:'#d84b36'});soloSkillNote(st,p,'SAW SPIN');break;
          case'NOVA':soloBurst(st,p,p.x,p.y,135,11,{effect:'nova',life:.8,maxLife:.8,color:'#ffc064'});soloSkillNote(st,p,'NOVA CORE');break;
          case'HUNTER':soloBasicShot(st,p,'solo_generic_special',{damage:8,radius:15,effect:'weak',slow:.35,speed:650,color:'#345b3c'});soloSkillNote(st,p,'HUNT MARK');break;
          case'CRYSTAL':soloBurst(st,p,mid.x,mid.y,78,7,{effect:'crystal',slow:1.2,life:1.8,maxLife:1.8,color:'#93f7ff'});soloSkillNote(st,p,'CRYSTAL PRISON');break;
          case'VIRUS':for(let i=-1;i<=1;i++)soloBasicShot(st,p,'solo_generic_special',{damage:3.2,radius:12,effect:'virus',slow:.25,speed:470+i*70,color:'#91ee43'});soloSkillNote(st,p,'PARASITE SWARM');break;
          case'DRUM':soloBurst(st,p,p.x,p.y,170,8,{effect:'drum',life:.9,maxLife:.9,color:'#d88a42'});soloSkillNote(st,p,'DRUM WAVE');break;
          case'CARD':soloBasicShot(st,p,'solo_generic_special',{damage:rand(5,13),radius:20,effect:'card',speed:620,color:'#d0a15d'});soloSkillNote(st,p,'CARD THROW');break;
          case'MATH':soloBasicShot(st,p,'solo_generic_special',{damage:Math.random()<.5?4:12,radius:19,effect:'math',speed:520,color:'#fff7dc'});soloSkillNote(st,p,'FORMULA');break;
          case'MATH_V2':soloBurst(st,p,mid.x,mid.y,105,7,{effect:'graph',slow:.7,life:1.35,maxLife:1.35,color:'#91d4ff'});soloSkillNote(st,p,'GRAPH WALL');break;
          case'SNIPER':soloBasicShot(st,p,'solo_generic_special',{damage:14,radius:9,effect:'snipe',speed:900,color:'#f4f4f4'});soloSkillNote(st,p,'NEST SHOT');break;
          case'SLIME':p.hp=Math.min(p.maxHp,p.hp+7);soloBurst(st,p,p.x,p.y,92,4,{effect:'slime',slow:.9,life:1.8,maxLife:1.8,color:'#95ff8b'});soloSkillNote(st,p,'GEL ARMOR');break;
          case'TIME':soloBurst(st,p,mid.x,mid.y,120,5,{effect:'time',slow:1.5,life:1.8,maxLife:1.8,color:'#c8b6ff'});soloSkillNote(st,p,'TIME RIFT');break;
          case'WOLF':p.dash=.36;soloBasicShot(st,p,'solo_generic_special',{damage:7,radius:16,effect:'scent',slow:.4,speed:650,color:'#c71d1d'});soloSkillNote(st,p,'BLOOD SCENT');break;
          case'PUPPET':case'WIND':soloBurst(st,p,e.x,e.y,76,6,{effect:'puppet',slow:.8,life:1.5,maxLife:1.5,color:'#c08a55'});soloSkillNote(st,p,'EFFIGY');break;
          case'WITCH':soloBasicShot(st,p,'solo_generic_special',{damage:6,radius:18,effect:'curse',slow:1.1,speed:560,color:'#d98cff'});soloSkillNote(st,p,'CURSE RAY');break;
          case'PIRATE':soloBasicShot(st,p,'solo_generic_special',{damage:8,radius:18,effect:'anchor',slow:1.0,speed:540,color:'#e2ad51'});soloSkillNote(st,p,'ANCHOR');break;
          case'PAINTER':soloBurst(st,p,e.x,e.y,82,5,{effect:'paint',slow:.8,life:1.7,maxLife:1.7,color:'#ffd447'});soloSkillNote(st,p,'INK STROKE');break;
          case'KUNGFU':case'MONK':p.dash=.42;p.bounce=1;soloBurst(st,p,e.x,e.y,64,9,{effect:'trauma',slow:.35,life:.6,maxLife:.6,color:'#e2a65d'});soloSkillNote(st,p,'TRAUMA RUSH');break;
          case'SUPERSTAR':p.data.shield=2.2;soloBurst(st,p,p.x,p.y,120,5,{effect:'spotlight',slow:.5,life:1.1,maxLife:1.1,color:'#ff7bd6'});soloSkillNote(st,p,'LIVE SHIELD');break;
          default:soloBasicShot(st,p,'solo_generic_special',{damage:8,radius:18});soloSkillNote(st,p,p.name);
        }
      }
      p.cd.special=clamp(nextCd/soloSpeedScale(p.type),4.2,8.2);
    }
    function sRage(st,p){
      if(p.cd.rage>0||p.dead)return;
      const e=p.side===1?st.p2:st.p1;
      p.data.ragePulse=4.5;
      p.super=Math.max(p.super,2.4);
      soloSkillNote(st,p,'RAGE');
      if(['RUBBER','FLASH','WOLF','KUNGFU','MONK','PIRATE'].includes(p.name)){p.dash=.6;p.bounce=2;}
      if(['VAMPIRE','SLIME','SUPERSTAR'].includes(p.name)){p.hp=Math.min(p.maxHp,p.hp+14);p.data.shield=3.2;}
      if(p.name==='BLADE'){p.black=7;}
      if(p.name==='TOXIC'){e.poison=5;soloBurst(st,p,e.x,e.y,90,8,{effect:'poison',life:2,maxLife:2,color:'#9dff47'});}
      else if(p.name==='ICE'){st.projectiles.push({type:'solo_ice_lane',owner:p,x:p.x,y:p.y,dx:p.dx,dy:p.dy,life:3,maxLife:3,width:62,damage:8});}
      else if(p.name==='SNIPER'){soloBasicShot(st,p,'solo_generic_special',{damage:22,radius:10,effect:'snipe',speed:980,color:'#f4f4f4'});}
      else if(p.name==='DRUM'){soloBurst(st,p,p.x,p.y,240,13,{effect:'drum',life:1.2,maxLife:1.2,color:'#d88a42'});}
      else if(p.name==='BLACK_HOLE'){soloBurst(st,p,(p.x+e.x)/2,(p.y+e.y)/2,170,14,{effect:'gravity',slow:1.8,life:2,maxLife:2,color:'#22142a'});}
      else if(p.name==='NOVA'||p.name==='VOLCANO'){soloBurst(st,p,e.x,e.y,150,16,{effect:'nova',life:1.2,maxLife:1.2,color:p.color});}
      else if(p.name==='VIRUS'){for(let i=-2;i<=2;i++)soloBasicShot(st,p,'solo_generic_special',{damage:4.2,radius:13,effect:'virus',slow:.35,speed:520+i*70,color:'#91ee43'});}
      else if(p.name==='MIRROR'){p.data.mirror=5.5;soloBurst(st,p,p.x,p.y,120,6,{effect:'mirror',life:1.4,maxLife:1.4,color:'#d7dde0'});}
      else if(p.name==='TIME'){soloBurst(st,p,(p.x+e.x)/2,(p.y+e.y)/2,170,9,{effect:'time',slow:2.2,life:2.2,maxLife:2.2,color:'#c8b6ff'});}
      else if(p.name==='SPIDER'){spawnSoloWeb(st,p,8,10);soloBurst(st,p,e.x,e.y,110,8,{effect:'web',slow:1.4,life:2.2,maxLife:2.2,color:'#d9ccff'});}
      else sSpecial(st,p);
      p.cd.rage=clamp(12/soloSpeedScale(p.type),9,15);
      soloShake=Math.max(soloShake,12);
    }
    function updateSolo375(dt){const st=soloState();if(!st.p1||!st.p2)return;if(st.winner){if(edge('KeyT'))window.startSoloMode();if(edge('KeyB'))goToMenu();return;}st.clock+=dt;soloShake=Math.max(0,soloShake-dt*16);if(edge('Escape'))st.paused=!st.paused;if(edge('KeyT'))return window.startSoloMode();if(edge('KeyB'))return goToMenu();if(st.paused)return;for(const p of [st.p1,st.p2]){const p1=p.side===1;const ix=(soloKeys[p1?'KeyD':'ArrowRight']?1:0)-(soloKeys[p1?'KeyA':'ArrowLeft']?1:0);const iy=(soloKeys[p1?'KeyS':'ArrowDown']?1:0)-(soloKeys[p1?'KeyW':'ArrowUp']?1:0);if(ix||iy){const n=norm(ix,iy);p.dx=n.x;p.dy=n.y;if(p.bounce>0)p.bounce=0;}const normalDown=p1?soloKeys.KeyE:(soloKeys.Numpad1||soloKeys.Digit1);if(edge(p1?'KeyE':(soloKeys.Numpad1?'Numpad1':'Digit1')))sAttack(st,p);if(edge(p1?'KeyR':(soloKeys.Numpad2?'Numpad2':'Digit2')))sSpecial(st,p);if(edge(p1?'Space':(soloKeys.Numpad3?'Numpad3':'Digit3')))sRage(st,p);for(const k of Object.keys(p.cd))p.cd[k]=Math.max(0,p.cd[k]-dt);p.super=Math.max(0,p.super-dt);p.black=Math.max(0,p.black-dt);p.selfSlow=Math.max(0,p.selfSlow-dt);p.data.shield=Math.max(0,(p.data.shield||0)-dt);p.data.mirror=Math.max(0,(p.data.mirror||0)-dt);p.data.spin=Math.max(0,(p.data.spin||0)-dt);p.data.ragePulse=Math.max(0,(p.data.ragePulse||0)-dt);if(p.data.spin>0){const e2=p.side===1?st.p2:st.p1;if(dist(p.x,p.y,e2.x,e2.y)<p.radius+e2.radius+34&&Math.random()<dt*9)dmg(st,e2,p,.75,p.color);}let sp=(p.baseSpeed||135)*(p.selfSlow>0?.7:1);if(p.name==='TOXIC'&&!normalDown)sp*=1.3;if(p.super>0)sp*=1.4;if(!ix&&!iy){/* auto-forward */}p.x+=p.dx*sp*dt;p.y+=p.dy*sp*dt;if(p.dash>0){p.dash-=dt;p.x+=p.dx*520*dt;p.y+=p.dy*520*dt;}let wall=false;if(p.x<p.radius||p.x>st.w-p.radius){p.dx*=-1;wall=true;}if(p.y<p.radius||p.y>st.h-p.radius){p.dy*=-1;wall=true;}p.x=clamp(p.x,p.radius,st.w-p.radius);p.y=clamp(p.y,p.radius,st.h-p.radius);if(wall&&p.name==='RUBBER'&&(p.bounce>0||p.dash>0||p.super>0)){p.k++;p.t++;st.projectiles.push({type:'solo_rubber_spark',x:p.x,y:p.y,life:.35,maxLife:.35});}if(wall&&p.name==='BLADE'){const speed=p.black>0?560:380;st.projectiles.push({type:'solo_blade',owner:p,x:p.x,y:p.y,vx:-p.dx*speed,vy:-p.dy*speed,life:1.4,maxLife:1.4,damage:p.black>0?7:4});}if(p.name==='TOXIC'&&normalDown)st.projectiles.push({type:'solo_poison',owner:p,x:p.x,y:p.y,radius:26,life:2.4,maxLife:2.4});}const a=st.p1,b=st.p2;if(dist(a.x,a.y,b.x,b.y)<a.radius+b.radius){if(a.name==='RUBBER'&&(a.bounce>0||a.dash>0||a.super>0))dmg(st,b,a,8+(a.super>0?4:0),'#ffd65c');if(b.name==='RUBBER'&&(b.bounce>0||b.dash>0||b.super>0))dmg(st,a,b,8+(b.super>0?4:0),'#ffd65c');if(a.data.spin>0)dmg(st,b,a,1.4,a.color);if(b.data.spin>0)dmg(st,a,b,1.4,b.color);}for(const pr of st.projectiles){pr.life-=dt;if(pr.vx){pr.x+=pr.vx*dt;pr.y+=pr.vy*dt;}const e=pr.owner?.side===1?st.p2:st.p1;if(!e)continue;if(pr.type==='solo_web_line'){pr.x2=pr.owner.x;pr.y2=pr.owner.y;pr.hitCd=Math.max(0,(pr.hitCd||0)-dt);if(distToSegment(e.x,e.y,pr.x1,pr.y1,pr.x2,pr.y2)<e.radius+8&&pr.hitCd<=0){dmg(st,e,pr.owner,.75,'#d9ccff');e.selfSlow=Math.max(e.selfSlow,.75);pr.hitCd=.42;if(Math.random()<.35)text(st,e.x,e.y-e.radius-24,'WEB SNARE','#d9ccff');}continue;}if((pr.type==='solo_generic'||pr.type==='solo_generic_special')&&dist(pr.x,pr.y,e.x,e.y)<e.radius+(pr.radius||10)){let amount=pr.damage||3;if(e.data?.shield>0)amount*=.55;if(e.data?.mirror>0){amount*=.55;dmg(st,pr.owner,e,amount*.65,'#d7dde0');}dmg(st,e,pr.owner,amount,pr.color||pr.owner?.color);if(pr.heal)pr.owner.hp=Math.min(pr.owner.maxHp,pr.owner.hp+pr.heal);if(pr.effect==='drain'||pr.owner?.name==='VAMPIRE')pr.owner.hp=Math.min(pr.owner.maxHp,pr.owner.hp+2.5);if(pr.slow)e.selfSlow=Math.max(e.selfSlow,pr.slow);if(['stun','web','gravity','time','anchor','curse','crystal','paint','slime'].includes(pr.effect))e.selfSlow=Math.max(e.selfSlow,pr.slow||.65);if(pr.effect==='virus')e.poison=clamp((e.poison||0)+1,0,5);if(pr.effect==='weak')e.cd.special+=.8;pr.life=0;}if(pr.type==='solo_generic_burst'&&!pr.hit&&dist(pr.x,pr.y,e.x,e.y)<e.radius+(pr.radius||60)){let amount=pr.damage||8;if(e.data?.shield>0)amount*=.55;if(e.data?.mirror>0){amount*=.55;dmg(st,pr.owner,e,amount*.65,'#d7dde0');}dmg(st,e,pr.owner,amount,pr.color||pr.owner?.color);if(pr.slow||['web','gravity','time','magnet','paint','crystal','slime','puppet'].includes(pr.effect))e.selfSlow=Math.max(e.selfSlow,pr.slow||.75);if(pr.effect==='poison'||pr.effect==='virus')e.poison=clamp((e.poison||0)+1.5,0,5);if(pr.effect==='nova'||pr.effect==='drum')soloShake=Math.max(soloShake,10);pr.hit=true;pr.life=0;}if(pr.type==='solo_arrow'&&dist(pr.x,pr.y,e.x,e.y)<e.radius+10){dmg(st,e,pr.owner,3,'#bffcff');e.cd.normal+=.3;pr.life=0;}if(pr.type==='solo_poison'&&dist(pr.x,pr.y,e.x,e.y)<e.radius+pr.radius){e.poison=clamp((e.poison||0)+dt,0,5);if(Math.random()<dt*2)dmg(st,e,pr.owner,.3,'#9dff47');}if(pr.type==='solo_ice_lane'&&distToSegment(e.x,e.y,pr.x,pr.y,pr.x+pr.dx*380,pr.y+pr.dy*380)<pr.width)dmg(st,e,pr.owner,pr.damage*dt,'#bffcff');if(pr.type==='solo_blade'&&dist(pr.x,pr.y,e.x,e.y)<e.radius+18){dmg(st,e,pr.owner,pr.damage,'#ff3333');pr.life=0;}}st.projectiles=st.projectiles.filter(p=>p.life>0&&p.x>-80&&p.x<1080&&p.y>-80&&p.y<455).slice(-120);st.texts.forEach(t=>{t.life-=dt;t.y-=18*dt;});st.texts=st.texts.filter(t=>t.life>0);}
    function drawSoloF(c,p){c.save();resetCtx(c);c.translate(p.x,p.y);c.rotate(Math.atan2(p.dy,p.dx));const s=.42;if(p.name==='RUBBER'){c.scale(s*(1+(p.dash>0?.25:0)),s*(1-(p.dash>0?.12:0)));drawSketchBlob(c,65*(p.super>0?1.15:1),'#2b2b30',12);c.strokeStyle=p.super>0?'#ffe783':'#ddd';c.lineWidth=7;c.beginPath();c.ellipse(0,0,58,42,0,0,TAU);c.stroke();}else if(p.name==='ICE'){c.scale(s,s);drawPolygon(c,[[-50,-60],[24,-76],[70,-8],[36,62],[-42,58],[-74,-4]],'#d8ffff','#124d64',5);}else if(p.name==='TOXIC'){c.scale(s,s);drawSketchBlob(c,65,'#315015',12);c.fillStyle='#9dff47';for(let i=0;i<5;i++){c.beginPath();c.arc(Math.cos(i)*34,Math.sin(i*2)*24,8,0,TAU);c.fill();}}else if(p.name==='BLADE'){c.scale(s,s);drawPolygon(c,[[-64,-24],[10,-16],[100,0],[10,16],[-64,24],[-36,0]],p.black>0?'#101018':'#c6cfd2',p.black>0?'#ff3333':'#101010',6);}else{c.scale(s,s);drawSketchBlob(c,58,p.color||'#f5dfaa',10);c.strokeStyle='#080808';c.lineWidth=5;c.stroke();c.fillStyle='#0a0a0a';c.font='900 38px serif';c.textAlign='center';c.textBaseline='middle';c.rotate(-Math.atan2(p.dy,p.dx));c.fillText(fighterGlyph(p.name),0,2);}c.restore();}
    function drawSolo375(){const st=soloState();ctx.save();resetCtx(ctx);ctx.clearRect(0,0,GAME_SIZE,GAME_SIZE);ctx.fillStyle='#090706';ctx.fillRect(0,0,1000,1000);ctx.translate(0,312+rand(-soloShake,soloShake));const sy=1000/1000;ctx.scale(1,sy);ctx.fillStyle='#15100e';ctx.fillRect(0,0,1000,375);ctx.strokeStyle='#806f4e';ctx.lineWidth=8;ctx.strokeRect(0,0,1000,375);ctx.globalAlpha=.12;ctx.strokeStyle='#d5c08a';for(let x=0;x<1000;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,375);ctx.stroke();}ctx.globalAlpha=1;for(const p of st.projectiles){ctx.save();resetCtx(ctx);const a=clamp(p.life/(p.maxLife||p.life||1),0,1);ctx.globalAlpha=a;if(p.type==='solo_web_line'){if(p.owner){p.x2=p.owner.x;p.y2=p.owner.y;}ctx.strokeStyle='rgba(217,204,255,.86)';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(p.x1,p.y1);ctx.lineTo(p.x2,p.y2);ctx.stroke();ctx.strokeStyle='rgba(74,59,91,.9)';ctx.lineWidth=1.5;for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(p.x1,p.y1);ctx.lineTo(lerp(p.x1,p.x2,i/4)+rand(-4,4),lerp(p.y1,p.y2,i/4)+rand(-4,4));ctx.stroke();}}else if(p.type==='solo_poison'){ctx.fillStyle='rgba(117,255,85,.38)';ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,TAU);ctx.fill();}else if(p.type==='solo_arrow'){ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));drawPolygon(ctx,[[-24,-6],[22,0],[-24,6]],'#d8ffff','#58c8d8',2);}else if(p.type==='solo_ice_lane'){ctx.strokeStyle='rgba(191,252,255,.55)';ctx.lineWidth=p.width;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+p.dx*380,p.y+p.dy*380);ctx.stroke();}else if(p.type==='solo_blade'){ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));ctx.strokeStyle=p.owner?.black>0?'#ff3333':'#f4fbff';ctx.lineWidth=7;ctx.beginPath();ctx.arc(-40,0,42,-.7,.7);ctx.stroke();}else if(p.type==='solo_rubber_spark'){ctx.strokeStyle='#ffe783';ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,(1-a)*30+6,0,TAU);ctx.stroke();}else if(p.type==='solo_generic'||p.type==='solo_generic_special'){ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy||0,p.vx||1));ctx.fillStyle=p.color||p.owner?.color||'#fff';ctx.strokeStyle='#080808';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,p.radius||10,0,TAU);ctx.fill();ctx.stroke();}else if(p.type==='solo_generic_burst'){ctx.strokeStyle=p.color||p.owner?.color||'#fff';ctx.lineWidth=6;ctx.beginPath();ctx.arc(p.x,p.y,(1-a)*(p.radius||70),0,TAU);ctx.stroke();}ctx.restore();}drawSoloF(ctx,st.p1);drawSoloF(ctx,st.p2);for(const t of st.texts){ctx.save();ctx.globalAlpha=clamp(t.life/t.maxLife,0,1);ctx.fillStyle=t.color;ctx.font='900 18px sans-serif';ctx.textAlign='center';ctx.fillText(t.text,t.x,t.y);ctx.restore();}ctx.restore();function hud(x,y,p){ctx.fillStyle='rgba(0,0,0,.75)';ctx.fillRect(x,y,280,52);ctx.strokeStyle='rgba(255,231,160,.35)';ctx.strokeRect(x,y,280,52);ctx.fillStyle=p.color||'#f5dfaa';ctx.font='900 14px sans-serif';ctx.textAlign='left';ctx.fillText(`${p.name} HP ${p.hp.toFixed(0)}`,x+8,y+17);ctx.fillStyle='#25100d';ctx.fillRect(x+8,y+25,264,10);ctx.fillStyle=p.hp>35?'#82e06b':'#ff4a4a';ctx.fillRect(x+8,y+25,264*clamp(p.hp/100,0,1),10);ctx.fillStyle='#d8ccb1';ctx.font='800 10px monospace';ctx.fillText(`N ${p.cd.normal.toFixed(1)} S ${p.cd.special.toFixed(1)} R ${p.cd.rage.toFixed(1)} ${p.name==='TOXIC'?`P${Math.ceil(p.poison||0)}`:p.name==='RUBBER'?`K${p.k} T${p.t}`:p.name==='BLADE'?`B${p.black.toFixed(1)}`:`SPD ${Math.round(p.baseSpeed||135)}`}`,x+8,y+45);}hud(16,16,st.p1);hud(704,16,st.p2);ctx.fillStyle='#f5dfaa';ctx.font='900 16px sans-serif';ctx.textAlign='center';ctx.fillText('SOLO 1V1 | P1 E/R/SPACE  P2 1/2/3 | T restart B menu',500,970);if(st.winner){ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(0,0,1000,1000);ctx.fillStyle='#ffe783';ctx.font='900 48px serif';ctx.fillText(`${st.winner.name} WINS`,500,500);}}
    update=function(dt){if(gameState==='SOLO')return updateSolo375(dt);return oldUpdate4(dt);};draw=function(){if(gameState==='SOLO')return drawSolo375();return oldDraw4();};
    window.apexCorrectivePatch3='ready';
  })();

  (function correctiveProductionPatch4(){
    const FT = name => FighterTypes.find(f => f.name === name);
    function hardReset(c){
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.shadowBlur = 0;
      c.shadowColor = 'transparent';
      c.shadowOffsetX = 0;
      c.shadowOffsetY = 0;
      c.filter = 'none';
      c.lineCap = 'butt';
      c.lineJoin = 'miter';
      c.setLineDash([]);
    }

    const kung = FT('KUNGFU') || FT('MONK');
    if (kung) {
      const kungDraw4 = kung.draw;
      kung.draw = function(c, f){
        c.save(); hardReset(c);
        try { kungDraw4 ? kungDraw4(c, f) : drawSketchBlob(c, f.radius, '#3b2417', 14); }
        finally { c.restore(); hardReset(c); }
      };
    }
    // KUNGFU root fix: no opponent/fighter redraw layer. The real issue was a scoped helper ReferenceError in Fighter.draw, fixed in the counter text above.
    const drawBeforeKungfuVisibility = draw;
    draw = function(){ return drawBeforeKungfuVisibility(); };

    const vampire = FT('VAMPIRE');
    if (vampire && vampire.update) {
      const vampireUpdate4 = vampire.update;
      vampire.update = function(f, e, dt){
        const wasLatched = (f.data.latchTimer || 0) > 0;
        vampireUpdate4.call(this, f, e, dt);
        if (wasLatched && (f.data.latchTimer || 0) <= 0) {
          f.data.latchCd = Math.max(f.data.latchCd || 0, 3);
          floatingTexts.push(new FloatingText(f.x, f.y - f.radius - 86, 'BITE CD 3s', '#ffb2a8'));
        }
      };
      const vampireDraw4 = vampire.draw;
      vampire.draw = function(c, f){
        c.save(); hardReset(c);
        try { if (vampireDraw4) vampireDraw4(c, f); }
        finally { c.restore(); hardReset(c); }
        if ((f.data.latchCd || 0) > 0 && (f.data.latchTimer || 0) <= 0) {
          c.save();
          c.fillStyle = '#ffb2a8';
          c.font = '900 12px monospace';
          c.textAlign = 'center';
          c.fillText(`BITE CD ${f.data.latchCd.toFixed(1)}`, 0, -f.radius - 20);
          c.restore();
        }
      };
    }

    const sniper = FT('SNIPER');
    if (sniper) {
      function enemyOfSniper(f){ return fighters.find(q => q && q !== f && q.hp > 0); }
      function farthestNest(f, e){
        if (!f.data.nests || !f.data.nests.length) f.data.nests = [{x:95,y:95},{x:905,y:95},{x:95,y:905},{x:905,y:905}];
        return f.data.nests.reduce((best, n) => dist(n.x,n.y,e.x,e.y) > dist(best.x,best.y,e.x,e.y) ? n : best, f.data.nests[0]);
      }
      const priorSniperRage4 = sniper.onRage;
      sniper.onRage = function(f){
        if (priorSniperRage4) priorSniperRage4(f);
        const e = enemyOfSniper(f);
        if (!e) return;
        const n = farthestNest(f, e);
        f.x = n.x;
        f.y = n.y;
        f.data.reload = 0;
        f.data.hiddenReload = false;
        f.data.aim = 3;
        f.data.aimMax = 3;
        f.data.relocWindow = [matchClock];
        f.data.positionLocked = true;
        f.setDir(e.x - f.x, e.y - f.y);
        floatingTexts.push(new FloatingText(f.x, f.y - f.radius - 86, 'RAGE NEST', '#ff8b8b'));
      };
    }
    window.apexCorrectivePatch4 = 'ready';
  })();

  (function correctiveProductionPatch5(){
    const FT = name => FighterTypes.find(f => f.name === name);
    window.DEBUG_VAMPIRE_BITE = false;
    window.apexDrawErrors = window.apexDrawErrors || [];
    window.__sniperReticleDrawCount = 0;

    function resetCanvasForPatch5(c){
      if (!c) return;
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.shadowBlur = 0;
      c.shadowColor = 'transparent';
      c.shadowOffsetX = 0;
      c.shadowOffsetY = 0;
      c.filter = 'none';
      c.lineCap = 'butt';
      c.lineJoin = 'miter';
      c.textAlign = 'start';
      c.textBaseline = 'alphabetic';
      c.setLineDash([]);
    }
    window.withCanvasState = function(c, fn){
      c.save();
      try { return fn(); }
      catch (err) {
        window.apexDrawErrors.push({message: err && err.message, stack: err && err.stack, t: Date.now()});
      } finally {
        c.restore();
        resetCanvasForPatch5(c);
      }
    };
    const withCanvasState = window.withCanvasState;

    function livingEnemyOf(f){
      return fighters.find(q => q && q !== f && q.hp > 0) || null;
    }
    function targetFor(f, id){
      return fighters.find(q => q && q.hp > 0 && q.id === id) || livingEnemyOf(f);
    }
    function vampireForward(f){
      const d = f.dir && (Math.abs(f.dir.x) + Math.abs(f.dir.y) > 0.01) ? f.dir : (f.data.lastMoveDir || {x:1,y:0});
      const n = norm(d.x, d.y);
      if (Math.abs(n.x) + Math.abs(n.y) > 0.01) f.data.lastMoveDir = {x:n.x, y:n.y};
      return n;
    }
    window.isVampireFrontBite = function(f, e){
      if (!f || !e) return false;
      const forward = vampireForward(f);
      const dx = e.x - f.x, dy = e.y - f.y;
      const centerDist = Math.max(0.001, Math.hypot(dx, dy));
      const overlap = centerDist <= f.radius + e.radius + 8;
      const dotFront = (forward.x * dx + forward.y * dy) / centerDist;
      const fangX = f.x + forward.x * f.radius * 0.92;
      const fangY = f.y + forward.y * f.radius * 0.92;
      const fangBodyGap = Math.max(0, Math.hypot(e.x - fangX, e.y - fangY) - e.radius);
      const ok = overlap && dotFront > 0.15 && fangBodyGap < 28;
      f.data.debugFang = {x:fangX, y:fangY, ok, dot:dotFront, gap:fangBodyGap};
      return ok;
    };

    const vampire = FT('VAMPIRE');
    if (vampire) {
      vampire.update = function(f, e, dt){
        if ((f.data.latchTimer || 0) <= 0 && f.dir) {
          const d = norm(f.dir.x, f.dir.y);
          if (Math.abs(d.x) + Math.abs(d.y) > 0.01) f.data.lastMoveDir = {x:d.x, y:d.y};
        }
        if ((f.data.latchTimer || 0) > 0) {
          const target = targetFor(f, f.data.latchTarget);
          if (!target) { f.data.latchTimer = 0; f.data.biteCd = f.data.latchCd = 3; return; }
          f.data.positionLocked = true;
          f.data.latchTimer = Math.max(0, f.data.latchTimer - dt);
          const away = norm(f.x - target.x, f.y - target.y);
          const gap = Math.max(4, target.radius + f.radius * 0.24);
          f.x = clamp(target.x + away.x * gap, f.radius, GAME_SIZE - f.radius);
          f.y = clamp(target.y + away.y * gap, f.radius, GAME_SIZE - f.radius);
          f.setDir(target.x - f.x, target.y - f.y);
          f.data.lastMoveDir = {x:f.dir.x, y:f.dir.y};
          target.applyStatus('slow', 0.18, {mult:.3, source:f});
          f.data.latchPulse = (f.data.latchPulse || 0) + dt;
          while (f.data.latchPulse >= .5) {
            f.data.latchPulse -= .5;
            const d = scaledByMirror(f, 1.5);
            target.takeDamage(d, f, 'vampire-latch-drain');
            f.heal(d, true);
            floatingTexts.push(new FloatingText(target.x, target.y - target.radius - 74, `DRAIN ${d.toFixed(1)}`, '#ff4a62'));
          }
          if (f.data.latchTimer <= 0) {
            f.data.biteCd = 3;
            f.data.latchCd = 3;
            floatingTexts.push(new FloatingText(f.x, f.y - f.radius - 86, 'BITE CD 3s', '#ffb2a8'));
          }
        } else {
          f.data.biteCd = Math.max(0, (f.data.biteCd || f.data.latchCd || 0) - abilityDt(f, dt));
          f.data.latchCd = f.data.biteCd;
        }
        const linkTarget = targetFor(f, f.data.bloodLinkTargetId);
        if (f.isRage && (f.data.bloodLinkLevel || 0) > 0 && linkTarget) {
          f.data.bloodLinkTargetId = linkTarget.id;
          f.data.linkTick = (f.data.linkTick || 0) + dt;
          while (f.data.linkTick >= .5) {
            f.data.linkTick -= .5;
            const d = scaledByMirror(f, 0.25 * f.data.bloodLinkLevel);
            linkTarget.takeDamage(d, f, 'permanent-blood-link', true);
            f.heal(d, true);
          }
        }
      };
      vampire.onCollide = function(f, e){
        if ((f.data.latchTimer || 0) > 0) return true;
        f.data.biteCd = Math.max(f.data.biteCd || 0, f.data.latchCd || 0);
        f.data.latchCd = f.data.biteCd;
        if (f.data.biteCd > 0) return false;
        if (!window.isVampireFrontBite(f, e)) return false;
        f.data.latchTimer = 5;
        f.data.latchPulse = 0;
        f.data.latchTarget = e.id;
        f.data.latchTargetId = e.id;
        f.data.biteCd = 0;
        f.data.latchCd = 0;
        const away = norm(f.x - e.x, f.y - e.y);
        f.data.latchOffset = {x:away.x, y:away.y};
        floatingTexts.push(new FloatingText(e.x, e.y - e.radius - 82, 'FANG LOCK', '#ff4a62'));
        if (f.isRage) {
          f.data.bloodLinkLevel = (f.data.bloodLinkLevel || 0) + 1;
          f.data.bloodLinkTargetId = e.id;
          floatingTexts.push(new FloatingText(e.x, e.y - e.radius - 108, `BLOOD LINK ${f.data.bloodLinkLevel}`, '#ff2038'));
        }
        playFighterSound(f, 'skill');
        return true;
      };
      vampire.draw = function(c, f){
        const latched = (f.data.latchTimer || 0) > 0;
        drawSketchBlob(c, f.radius, '#4a0710', 14);
        c.fillStyle = '#fff7ee';
        c.beginPath(); c.moveTo(42,-26); c.lineTo(116,-10); c.lineTo(46,4); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(42,26); c.lineTo(116,10); c.lineTo(46,-4); c.closePath(); c.fill();
        c.strokeStyle = '#180205'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(42,-26); c.lineTo(116,-10); c.moveTo(42,26); c.lineTo(116,10); c.stroke();
        if (latched) {
          c.strokeStyle = 'rgba(255,42,62,.55)';
          c.lineWidth = 4;
          c.beginPath();
          c.arc(58, 0, 24 + 6 * Math.sin(Date.now()/90), -.8, .8);
          c.stroke();
          c.fillStyle = '#ffb2a8'; c.font = '900 14px monospace'; c.textAlign = 'center';
          c.fillText(`DRAIN ${f.data.latchTimer.toFixed(1)}s`, 0, -f.radius - 20);
        } else if ((f.data.biteCd || 0) > 0) {
          c.fillStyle = '#ffb2a8'; c.font = '900 12px monospace'; c.textAlign = 'center';
          c.fillText(`BITE CD ${f.data.biteCd.toFixed(1)}`, 0, -f.radius - 20);
        }
        if ((f.data.bloodLinkLevel || 0) > 0) {
          c.fillStyle = '#ff6b78'; c.font = '900 12px monospace'; c.textAlign = 'center';
          c.fillText(`BLOOD LINK ${f.data.bloodLinkLevel}`, 0, f.radius + 25);
        }
      };
    }

    function drawVampireBloodLinks(c){
      for (const f of fighters) {
        if (!f || f.name !== 'VAMPIRE' || !f.isRage || !(f.data.bloodLinkLevel > 0)) continue;
        const t = targetFor(f, f.data.bloodLinkTargetId);
        if (!t) continue;
        withCanvasState(c, () => {
          const level = f.data.bloodLinkLevel || 1;
          const pulse = .62 + .24 * Math.sin(Date.now()/115);
          c.globalAlpha = pulse;
          c.strokeStyle = '#ff2038';
          c.lineWidth = Math.min(12, 3 + level * 1.5);
          c.lineCap = 'round';
          c.beginPath();
          const mx = (f.x + t.x) / 2 + Math.sin(Date.now()/240) * 32;
          const my = (f.y + t.y) / 2 - 42;
          c.moveTo(f.x, f.y);
          c.quadraticCurveTo(mx, my, t.x, t.y);
          c.stroke();
          c.globalAlpha = 1;
          c.fillStyle = '#ff2038';
          c.font = '900 13px monospace';
          c.textAlign = 'center';
          c.fillText(`BLOOD LINK ${level}`, mx, my - 10);
        });
      }
    }

    const kung = FT('KUNGFU') || FT('MONK');
    if (kung) {
      const kungDraw5 = kung.draw;
      kung.draw = function(c, f){ withCanvasState(c, () => kungDraw5 ? kungDraw5(c, f) : drawSketchBlob(c, f.radius, '#3b2417', 14)); };
    }
    function drawImportantNonKungfuProjectiles(c){
      const important = /painter|ice_lane|ice_dart|blade_wave|red_slash|toxic|card_throw|math_formula|math_v2|sniper_laser|witch|pirate|superfan|slime_child|virus_minion|web_line|meteor|fire_pit/;
      for (const p of projectiles) {
        if (!p || !important.test(String(p.type || '')) || (p.owner && p.owner.name === 'KUNGFU')) continue;
        withCanvasState(c, () => {
          const a = clamp((p.life || 1) / (p.maxLife || p.life || 1), 0, 1);
          c.globalAlpha = Math.max(.45, a);
          if (p.type === 'painter_stroke') { c.strokeStyle = p.color || '#ffd447'; c.lineWidth = Math.max(18, (p.width||55)); c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x1,p.y1); c.lineTo(p.x2,p.y2); c.stroke(); }
          else if (p.type === 'ice_lane') { c.strokeStyle = '#eaffff'; c.lineWidth = Math.max(8, (p.halfWidth||18)); c.beginPath(); c.moveTo(p.x1,p.y1); c.lineTo(p.x2,p.y2); c.stroke(); }
          else if (p.type === 'blade_wave') { c.translate(p.x,p.y); c.rotate(Math.atan2(p.vy||0,p.vx||1)); c.strokeStyle = '#ffffff'; c.lineWidth = 7; c.beginPath(); c.arc(-p.length*.3,0,(p.halfWidth||55)*.75,-.7,.7); c.stroke(); }
          else if (p.type === 'toxic_trail' || p.type === 'toxic_puddle') { c.fillStyle = 'rgba(141,255,38,.42)'; c.beginPath(); c.arc(p.x,p.y,p.radius||30,0,TAU); c.fill(); }
          else if (p.type === 'card_throw') { c.fillStyle = '#ffe8a0'; c.strokeStyle = '#130a04'; c.lineWidth = 4; c.fillRect(p.x-32,p.y-44,64,88); c.strokeRect(p.x-32,p.y-44,64,88); c.fillStyle = '#130a04'; c.font = '900 18px serif'; c.textAlign = 'center'; c.fillText('CARD',p.x,p.y+5); }
          else if (p.type === 'sniper_laser') { c.strokeStyle = '#ff3030'; c.lineWidth = 3; c.beginPath(); c.moveTo(p.x1,p.y1); c.lineTo(p.x2,p.y2); c.stroke(); }
        });
      }
    }

    function nearestLivingEnemy(f){
      let best = null, bd = Infinity;
      for (const q of fighters) if (q && q !== f && q.hp > 0) {
        const d = dist(f.x,f.y,q.x,q.y);
        if (d < bd) { bd = d; best = q; }
      }
      return best;
    }
    window.drawSniperAimOverlay = function(c){
      for (const s of fighters) {
        if (!s || s.name !== 'SNIPER' || s.hp <= 0 || !(s.data.aim > 0)) continue;
        const target = targetFor(s, s.data.targetId) || nearestLivingEnemy(s);
        if (!target) continue;
        window.__sniperReticleDrawCount++;
        withCanvasState(c, () => {
          const pulse = .65 + .25 * Math.sin(Date.now()/95);
          c.globalAlpha = pulse;
          c.strokeStyle = '#ff3030';
          c.lineWidth = 2;
          c.beginPath(); c.moveTo(s.x,s.y); c.lineTo(target.x,target.y); c.stroke();
          c.translate(target.x, target.y);
          c.rotate(Date.now()/900);
          c.globalAlpha = .92;
          c.strokeStyle = '#ff3030';
          c.fillStyle = '#ff3030';
          c.lineWidth = 4;
          for (const r of [target.radius + 14, target.radius + 28, target.radius + 42]) {
            c.beginPath(); c.arc(0,0,r,0,TAU); c.stroke();
          }
          const outer = target.radius + 52, inner = target.radius + 28;
          for (let i=0;i<4;i++) {
            const a = i * Math.PI / 2;
            c.beginPath();
            c.moveTo(Math.cos(a)*inner, Math.sin(a)*inner);
            c.lineTo(Math.cos(a)*outer, Math.sin(a)*outer);
            c.stroke();
          }
          c.beginPath(); c.arc(0,0,5,0,TAU); c.fill();
        });
      }
    };

    const drawProjectilesBeforePatch5 = drawProjectiles;
    drawProjectiles = function(c){
      withCanvasState(c, () => {
        try { drawProjectilesBeforePatch5(c); }
        catch (err) { window.apexDrawErrors.push({message: err && err.message, stack: err && err.stack, phase:'drawProjectiles', t:Date.now()}); }
      });
      // KUNGFU root fix: do not redraw opponent projectiles; original drawProjectiles now remains authoritative.
    };

    const drawBeforePatch5 = draw;
    draw = function(){
      drawBeforePatch5();
      if (gameState !== 'PLAYING') return;
      ctx.save();
      resetCanvasForPatch5(ctx);
      ctx.translate(GAME_SIZE/2 + rand(-cameraShake,cameraShake), GAME_SIZE/2 + rand(-cameraShake,cameraShake));
      ctx.scale(cameraZoom, cameraZoom);
      ctx.translate(-GAME_SIZE/2, -GAME_SIZE/2);
      drawVampireBloodLinks(ctx);
      window.drawSniperAimOverlay(ctx);
      ctx.restore();
      resetCanvasForPatch5(ctx);
    };

    window.testVampireBiteGeometry = function(){
      const f = {x:100,y:100,radius:50,dir:{x:1,y:0},data:{}};
      const enemy = (x,y,r=50)=>({x,y,radius:r});
      const cases = {
        front: window.isVampireFrontBite(f, enemy(185,100)),
        headFirst: window.isVampireFrontBite(f, enemy(178,104)),
        rear: window.isVampireFrontBite(f, enemy(15,100)),
        sideUp: window.isVampireFrontBite(f, enemy(100,185)),
        sideDown: window.isVampireFrontBite(f, enemy(100,15)),
        diagonalFront: window.isVampireFrontBite(f, enemy(168,132))
      };
      return {pass: cases.front && cases.headFirst && !cases.rear && !cases.sideUp && !cases.sideDown && cases.diagonalFront, cases};
    };
    window.testVampireCooldownAndBloodLink = function(){
      const type = FT('VAMPIRE');
      const f = new Fighter(1,100,100,type), e = new Fighter(2,185,100,FT('BLADE'));
      fighters = [f, e];
      f.dir = {x:1,y:0}; f.data.lastMoveDir = {x:1,y:0}; f.data.biteCd = 0; f.data.latchCd = 0; f.isRage = false;
      const normalBite = type.onCollide(f,e);
      const normalLevel = f.data.bloodLinkLevel || 0;
      type.update(f,e,1);
      const cdDuringLatch = f.data.biteCd || 0;
      type.update(f,e,4.1);
      const cdAfterRelease = f.data.biteCd || 0;
      const blockedDuringCd = type.onCollide(f,e) === false;
      f.data.latchTimer = 0; f.data.biteCd = 0; f.data.latchCd = 0; f.isRage = true;
      const rageBite = type.onCollide(f,e);
      const rageLevel = f.data.bloodLinkLevel || 0;
      return {
        pass: !!normalBite && normalLevel === 0 && cdDuringLatch === 0 && cdAfterRelease > 2.9 && blockedDuringCd && !!rageBite && rageLevel === 1 && f.data.bloodLinkTargetId === e.id,
        normalBite, normalLevel, cdDuringLatch, cdAfterRelease, blockedDuringCd, rageBite, rageLevel
      };
    };
    window.testKungfuVisualIntegrity = function(){
      const before = window.apexDrawErrors.length;
      const k = new Fighter(1,300,500,FT('KUNGFU'));
      const p = new Fighter(2,700,500,FT('PAINTER'));
      fighters = [k,p];
      gameState = 'PLAYING';
      projectiles.push({type:'kungfu_palm',owner:k,x:450,y:500,vx:1,vy:0,life:1,maxLife:1});
      projectiles.push({type:'painter_stroke',owner:p,x1:620,y1:450,x2:820,y2:560,width:75,color:'#ffd447',life:2,maxLife:2});
      for (let i=0;i<3;i++) draw();
      const painterStillThere = projectiles.some(q => q.type === 'painter_stroke');
      return {pass: window.apexDrawErrors.length === before && painterStillThere && ctx.globalAlpha === 1 && ctx.globalCompositeOperation === 'source-over', drawErrors: window.apexDrawErrors.length - before, painterStillThere};
    };
    window.testSniperReticle = function(){
      const s = new Fighter(1,100,100,FT('SNIPER'));
      const e = new Fighter(2,500,500,FT('BLADE'));
      fighters = [s,e]; gameState = 'PLAYING'; s.data.aim = 2; s.data.aimMax = 3; s.data.targetId = e.id;
      window.__sniperReticleDrawCount = 0;
      draw();
      const drew = window.__sniperReticleDrawCount > 0;
      s.data.aim = 0; window.__sniperReticleDrawCount = 0; draw();
      return {pass: drew && window.__sniperReticleDrawCount === 0, drew, countAfterNoAim: window.__sniperReticleDrawCount};
    };
    window.apexCorrectivePatch5 = 'ready';
  })();

  (function correctiveProductionPatch6(){
    const FT = name => FighterTypes.find(f => f.name === name);
    window.__kungfuSkillDrawCount = 0;
    window.__opponentSkillRedrawCount = 0;

    function resetCtx6(c){
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.shadowBlur = 0; c.shadowColor = 'transparent'; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
      c.filter = 'none'; c.lineCap = 'butt'; c.lineJoin = 'miter'; c.textAlign = 'start'; c.textBaseline = 'alphabetic'; c.setLineDash([]);
    }
    function safeDraw6(c, fn){
      c.save();
      try { fn(); }
      catch(err){ (window.apexDrawErrors ||= []).push({phase:'patch6', message:err && err.message, stack:err && err.stack, t:Date.now()}); }
      finally { c.restore(); resetCtx6(c); }
    }

    function vampForward6(f, normal){
      const d = f.data?.lastMoveDir || (normal && {x:normal.x, y:normal.y}) || f.dir || {x:1,y:0};
      const n = norm(d.x, d.y);
      if (Math.abs(n.x) + Math.abs(n.y) > .01) f.data.lastMoveDir = {x:n.x,y:n.y};
      return n;
    }
    window.isVampireFrontBite = function(f, e, collisionNormal){
      if (!f || !e) return false;
      const forward = vampForward6(f, collisionNormal);
      const dx = e.x - f.x, dy = e.y - f.y;
      const d = Math.max(.001, Math.hypot(dx,dy));
      const frontDot = (forward.x*dx + forward.y*dy) / d;
      const actualContact = d <= f.radius + e.radius + 18;
      const fangX = f.x + forward.x * f.radius * .92;
      const fangY = f.y + forward.y * f.radius * .92;
      const fangGap = Math.max(0, Math.hypot(e.x-fangX, e.y-fangY) - e.radius);
      const frontHemisphere = frontDot > 0.12;
      const broadNose = fangGap < 48 || (frontDot > .35 && actualContact);
      const ok = actualContact && frontHemisphere && broadNose;
      f.data.debugFang = {x:fangX,y:fangY,ok,dot:frontDot,gap:fangGap};
      return ok;
    };

    const vampire = FT('VAMPIRE');
    if (vampire) {
      vampire.onCollide = function(f,e,dt,normal){
        if ((f.data.latchTimer||0) > 0) return true;
        f.data.biteCd = Math.max(f.data.biteCd||0, f.data.latchCd||0);
        f.data.latchCd = f.data.biteCd;
        if (f.data.biteCd > 0) return false;
        const biteNormal = normal ? {x:normal.x, y:normal.y} : null;
        if (!window.isVampireFrontBite(f,e,biteNormal)) return false;
        f.data.latchTimer = 5;
        f.data.latchPulse = 0;
        f.data.latchTarget = e.id;
        f.data.latchTargetId = e.id;
        f.data.biteCd = 0;
        f.data.latchCd = 0;
        const away = norm(f.x-e.x, f.y-e.y);
        f.data.latchOffset = {x:away.x,y:away.y};
        floatingTexts.push(new FloatingText(e.x,e.y-e.radius-82,'FANG LOCK','#ff4a62'));
        if (f.isRage) {
          f.data.bloodLinkLevel = (f.data.bloodLinkLevel||0) + 1;
          f.data.bloodLinkTargetId = e.id;
          floatingTexts.push(new FloatingText(e.x,e.y-e.radius-108,`BLOOD LINK ${f.data.bloodLinkLevel}`,'#ff2038'));
        }
        playFighterSound(f,'skill');
        return true;
      };
    }

    function drawKungfuSkillLayer6(c){
      for (const p of projectiles) {
        if (!p || !p.type || !String(p.type).startsWith('kungfu_')) continue;
        safeDraw6(c, () => {
          const a = clamp((p.life||1)/(p.maxLife||p.life||1),0,1);
          if (p.type === 'kungfu_palm') {
            window.__kungfuSkillDrawCount++;
            c.globalAlpha = .18 + .20*a;
            c.fillStyle = 'rgba(255,210,138,.25)';
            c.strokeStyle = 'rgba(255,210,138,.72)';
            c.lineWidth = 6;
            c.translate(p.x,p.y);
            c.rotate(Math.atan2(p.vy||0,p.vx||1));
            c.beginPath(); c.ellipse(0,0,235,132,0,0,TAU); c.fill(); c.stroke();
            c.globalAlpha = .75*a;
            c.fillStyle = '#ffe0a0'; c.font = '900 40px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText('掌',0,0);
          } else if (p.type === 'kungfu_qi') {
            window.__kungfuSkillDrawCount++;
            c.globalAlpha = .85*a;
            c.strokeStyle = '#ffffff';
            c.lineWidth = 5;
            c.beginPath(); c.arc(p.x,p.y,16 + (1-a)*56,0,TAU); c.stroke();
            c.strokeStyle = '#ffd28a'; c.lineWidth = 2; c.beginPath(); c.arc(p.x,p.y,8 + (1-a)*32,0,TAU); c.stroke();
          } else if (p.type === 'kungfu_rage_seal') {
            window.__kungfuSkillDrawCount++;
            c.globalAlpha = .9*a;
            c.strokeStyle = '#ff9b50'; c.lineWidth = 7;
            c.beginPath(); c.arc(p.x,p.y,74,0,TAU); c.stroke();
            c.fillStyle = '#ffdda8'; c.font = '900 34px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('封',p.x,p.y);
          }
        });
      }
    }
    function drawOpponentSkillLayer6(c){
      if (!fighters.some(f => f && f.hp > 0 && f.name === 'KUNGFU')) return;
      for (const p of projectiles) {
        if (!p || (p.owner && p.owner.name === 'KUNGFU')) continue;
        const type = String(p.type||'');
        if (!/(painter|ice_lane|ice_dart|blade_wave|red_slash|toxic|card_throw|math_formula|math_v2|sniper_laser|witch|pirate|superfan|slime_child|virus_minion|web_line|meteor|fire_pit)/.test(type)) continue;
        safeDraw6(c, () => {
          const a = clamp((p.life||1)/(p.maxLife||p.life||1),0,1);
          c.globalAlpha = Math.max(.62,a);
          window.__opponentSkillRedrawCount++;
          if (type === 'painter_stroke') { c.strokeStyle=p.color||'#ffd447'; c.lineWidth=Math.max(26,p.width||60); c.lineCap='round'; c.beginPath(); c.moveTo(p.x1,p.y1); c.lineTo(p.x2,p.y2); c.stroke(); }
          else if (type === 'ice_lane') { c.strokeStyle='#eaffff'; c.lineWidth=Math.max(12,(p.halfWidth||18)*1.15); c.beginPath(); c.moveTo(p.x1,p.y1); c.lineTo(p.x2,p.y2); c.stroke(); }
          else if (type === 'blade_wave') { c.translate(p.x,p.y); c.rotate(Math.atan2(p.vy||0,p.vx||1)); c.strokeStyle='#f4fbff'; c.lineWidth=9; c.beginPath(); c.arc(-(p.length||120)*.3,0,(p.halfWidth||55)*.78,-.72,.72); c.stroke(); }
          else if (type === 'red_slash') { c.translate(p.x,p.y); c.rotate(p.angle||0); c.strokeStyle='#ff2020'; c.lineWidth=14; c.beginPath(); c.moveTo(-95,-75); c.lineTo(95,75); c.stroke(); }
          else if (type === 'toxic_trail' || type === 'toxic_puddle') { c.fillStyle='rgba(141,255,38,.50)'; c.beginPath(); c.arc(p.x,p.y,p.radius||30,0,TAU); c.fill(); }
          else if (type === 'card_throw') { c.fillStyle='#ffe8a0'; c.strokeStyle='#130a04'; c.lineWidth=4; c.fillRect(p.x-34,p.y-46,68,92); c.strokeRect(p.x-34,p.y-46,68,92); c.fillStyle='#130a04'; c.font='900 18px serif'; c.textAlign='center'; c.fillText('CARD',p.x,p.y+6); }
          else if (type === 'sniper_laser') { c.strokeStyle='#ff3030'; c.lineWidth=3; c.beginPath(); c.moveTo(p.x1,p.y1); c.lineTo(p.x2,p.y2); c.stroke(); }
        });
      }
    }

    // KUNGFU root fix: no post-draw skill/opponent redraw layer. KUNGFU visual projectiles are drawn once in core drawProjectiles.
    const drawBeforePatch6 = draw;
    draw = function(){ return drawBeforePatch6(); };

    window.testVampireBiteGeometry = function(){
      const f={x:100,y:100,radius:50,dir:{x:-1,y:0},data:{lastMoveDir:{x:1,y:0}}};
      const enemy=(x,y,r=50)=>({x,y,radius:r});
      const cases={
        front:window.isVampireFrontBite(f,enemy(185,100),{x:1,y:0}),
        headFirst:window.isVampireFrontBite(f,enemy(178,104),{x:1,y:0}),
        rear:window.isVampireFrontBite(f,enemy(15,100),{x:-1,y:0}),
        sideUp:window.isVampireFrontBite(f,enemy(100,185),{x:0,y:1}),
        sideDown:window.isVampireFrontBite(f,enemy(100,15),{x:0,y:-1}),
        diagonalFront:window.isVampireFrontBite(f,enemy(168,132),{x:.9,y:.42})
      };
      return {pass:cases.front&&cases.headFirst&&!cases.rear&&!cases.sideUp&&!cases.sideDown&&cases.diagonalFront,cases};
    };
    window.testKungfuVisualIntegrity = function(){
      const before=(window.apexDrawErrors||[]).length;
      window.__kungfuCoreProjectileDrawCount=0; window.__opponentSkillRedrawCount=0;
      const k=new Fighter(1,300,500,FT('KUNGFU')), p=new Fighter(2,700,500,FT('PAINTER'));
      fighters=[k,p]; gameState='PLAYING';
      projectiles.push({type:'kungfu_palm',owner:k,x:450,y:500,vx:1,vy:0,life:1,maxLife:1});
      projectiles.push({type:'kungfu_qi',owner:k,x:520,y:500,life:.6,maxLife:.6});
      projectiles.push({type:'painter_stroke',owner:p,x1:620,y1:450,x2:820,y2:560,width:75,color:'#ffd447',life:2,maxLife:2});
      draw();
      return {pass:(window.apexDrawErrors||[]).length===before && window.__kungfuCoreProjectileDrawCount>0 && window.__opponentSkillRedrawCount===0, drawErrors:(window.apexDrawErrors||[]).length-before, kungfuCoreDraws:window.__kungfuCoreProjectileDrawCount, opponentRedraws:window.__opponentSkillRedrawCount};
    };
    window.apexCorrectivePatch6 = 'ready';
    window.apexKungfuRootFix = 'enemyOf2-scope-fixed-core-projectile-draw-no-redraw';
  })();

  (function sniperSpriteVisualPatch(){
    const sniper = FighterTypes.find(f => f && f.name === 'SNIPER');
    if (!sniper) return;
    const fallbackDraw = sniper.draw;
    const aimSprite = new Image();
    aimSprite.src = '/sniper_cloak_sprite.png';
    const moveSprite = new Image();
    moveSprite.src = '/sniper_cloak_move_sprite.png';
    sniper.draw = function(c, f){
      const crouch = f.isRage && (f.data.aim || 0) <= 0;
      const isAiming = (f.data.aim || 0) > 0;
      const sprite = isAiming ? aimSprite : moveSprite;
      c.save();
      if (sprite.complete && sprite.naturalWidth > 0) {
        if (crouch) {
          c.translate(0, 18);
          c.scale(.9, .62);
          c.globalAlpha = .78;
        }
        const w = f.radius * (isAiming ? 4.55 : 3.5);
        const h = w * (sprite.naturalHeight / sprite.naturalWidth);
        c.shadowColor = 'rgba(0,0,0,.55)';
        c.shadowBlur = 12;
        c.drawImage(sprite, isAiming ? -f.radius * 1.9 : -f.radius * 1.85, -h * .5, w, h);
        c.shadowBlur = 0;
      } else if (fallbackDraw) {
        fallbackDraw(c, f);
      }
      c.restore();

      if (isAiming) {
        const t = 1 - f.data.aim / Math.max(.1, f.data.aimMax || 1);
        c.strokeStyle = 'rgba(255,90,90,.9)';
        c.lineWidth = 5;
        c.beginPath();
        c.arc(0, 0, f.radius + 22 + 18 * t, 0, TAU);
        c.stroke();
        c.fillStyle = '#ffb0b0';
        c.font = '900 14px monospace';
        c.textAlign = 'center';
        c.fillText('AIM ' + Math.round(t * 100) + '%', 0, -f.radius - 22);
        c.fillText('AIM ' + Math.max(0, f.data.aim).toFixed(1) + 's', 0, -f.radius - 40);
      } else if ((f.data.reload || 0) > 0 || f.data.hiddenReload) {
        c.fillStyle = '#ffb0b0';
        c.font = '900 14px monospace';
        c.textAlign = 'center';
        c.fillText('RELOAD ' + Math.max(0, f.data.reload || 0).toFixed(1) + 's', 0, -f.radius - 40);
      } else if (crouch) {
        c.fillStyle = '#b8bcc2';
        c.font = '900 13px monospace';
        c.textAlign = 'center';
        c.fillText('HIDDEN', 0, -f.radius - 18);
      }
    };
    window.apexSniperSpriteVisualPatch = {
      aim: '/sniper_cloak_sprite.png',
      move: '/sniper_cloak_move_sprite.png'
    };
  })();

  console.info('[Apex Final] canonical identity + balance merge loaded', FighterTypes.map(f=>f.name));
  } catch (err) {
    window.apexFinalBootError = { message: err && err.message, stack: err && err.stack };
    console.error('[Apex Final] boot patch failed', err);
  }
})();

ctx.fillStyle = "#11100e";
ctx.fillRect(0,0,GAME_SIZE,GAME_SIZE);

window.apexReactBridge = {};
function exposeApexGlobal(name, value) {
  if (typeof value === 'function') {
    window.apexReactBridge[name] = value;
    window[name] = value;
  }
}
exposeApexGlobal('goToMenu', typeof goToMenu !== 'undefined' ? goToMenu : window.goToMenu);
exposeApexGlobal('goToSelect', typeof goToSelect !== 'undefined' ? goToSelect : window.goToSelect);
exposeApexGlobal('goToTournament', typeof goToTournament !== 'undefined' ? goToTournament : window.goToTournament);
exposeApexGlobal('resetTournament', typeof resetTournament !== 'undefined' ? resetTournament : window.resetTournament);
exposeApexGlobal('startMatch', typeof startMatch !== 'undefined' ? startMatch : window.startMatch);
exposeApexGlobal('startSoloMode', typeof startSoloMode !== 'undefined' ? startSoloMode : window.startSoloMode);
exposeApexGlobal('goToSoloSelect', typeof goToSoloSelect !== 'undefined' ? goToSoloSelect : window.goToSoloSelect);
