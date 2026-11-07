// Extracted verbatim from apexEngine.js; keep combat effect helpers global.
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
