// Extracted verbatim from apexEngine.js; keep classic-script render helpers global.
var STATUS_VFX = {
    stun: (() => {
        const img = new Image();
        img.src = '/assets/status_vfx/stun_swirl.webp';
        return img;
    })()
};

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


// Retained presentation infrastructure shared by production hero adapters.
// No extra animation clock, canvas, quality reduction, or global context patch.
(function installRetainedPresentation(root) {
    if (root.APEX_RETAINED_PRESENTATION) return;
    const polygons = new WeakMap();
    const named = new Map();
    const prepared = new WeakMap();
    const actors = new Map();
    function polygon(points) {
        if (typeof Path2D !== 'function' || !points || !points.length) return null;
        let path = polygons.get(points);
        if (!path) {
            path = new Path2D();
            path.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) path.lineTo(points[i].x, points[i].y);
            path.closePath();
            polygons.set(points, path);
        }
        return path;
    }
    function geometry(key, build) {
        if (typeof Path2D !== 'function') return null;
        if (named.has(key)) return named.get(key);
        const value = build();
        // Keys are authored geometry parameters, never timestamps or poses.
        if (named.size >= 128) named.delete(named.keys().next().value);
        named.set(key, value);
        return value;
    }
    function prepare(actor) {
        if (!actor) return;
        const id = actor.type?.__hrHero || actor.__hrCombatant?.heroId;
        const update = actors.get(id);
        if (!update) return;
        const frame = root.__apexRenderFrame || 0;
        const clock = root.APEX_HERO_REWORK_AIL?.clock?.() || 0;
        const previous = prepared.get(actor);
        if (previous && previous.frame === frame && previous.clock === clock) return;
        update(actor);
        if (previous) { previous.frame = frame; previous.clock = clock; }
        else prepared.set(actor, {frame, clock});
    }
    root.APEX_RETAINED_PRESENTATION = Object.freeze({
        polygon, geometry, prepare,
        registerActor(id, update) { actors.set(id, update); },
        invalidatePolygon(points) { polygons.delete(points); },
        clearGeometry() { named.clear(); }
    });
})(typeof window !== 'undefined' ? window : globalThis);
