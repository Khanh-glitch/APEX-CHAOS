// Lossless raster-cache acceptance: compare all image bytes + 2D draw passes
// against the actual Gold Fluid.draw implementation with deterministic fields.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { smokeCacheCandidateHtml } from './botWaveSmokeCacheCandidate.mjs';

const gold = fs.readFileSync(new URL('../public/bot-wave/game.html', import.meta.url), 'utf8');
const candidate = smokeCacheCandidateHtml(gold);
assert.notEqual(gold, candidate);
const N = 158;
const exports = { N, HALF: 936, CELL: 12, BB: Uint8ClampedArray.from({ length: 768 }, (_, i) => i % 256) };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
function method(html) {
    const begin = '\n    draw(ctx, layer) {';
    const end = '\n    /** hot regions in world space';
    const a = html.indexOf(begin), b = html.indexOf(end, a);
    assert.ok(a >= 0 && b > a);
    const source = html.slice(a + 1, b).trim();
    // Evaluating trusted repository source in an isolated Node test fixture.
    return new Function('exports', 'clamp', 'lerp', `return ({ ${source} }).draw`)(exports, clamp, lerp);
}
const original = method(gold);
const optimized = method(candidate);
function mock() {
    const img = { data: new Uint8ClampedArray(N * N * 4) };
    const cvs = { pixels: new Uint8ClampedArray(img.data.length) };
    const state = {
        n: N, img, cvs, minI: 3, maxI: N - 6, minJ: 4, maxJ: N - 6,
        temp: new Float32Array(N * N), dens: new Float32Array(N * N), soot: new Float32Array(N * N),
        _renderEpoch: 1, _mutationRevision: 1, uploads: 0,
        cctx: { putImageData(data) { cvs.pixels.set(data.data); state.uploads++; } }
    };
    for (let i = 0; i < N * N; i++) {
        state.temp[i] = (Math.sin(i * 0.011) + 1) * 0.4;
        state.dens[i] = (Math.cos(i * 0.007) + 1) * 0.3;
        state.soot[i] = (Math.sin(i * 0.001) + 1) * 0.48;
    }
    const snapshots = [], stack = [];
    const ctx = {
        globalCompositeOperation: 'source-over', globalAlpha: 1, filter: 'none',
        imageSmoothingEnabled: true, imageSmoothingQuality: 'low',
        save() { stack.push({ globalCompositeOperation: this.globalCompositeOperation, globalAlpha: this.globalAlpha,
            filter: this.filter, imageSmoothingEnabled: this.imageSmoothingEnabled,
            imageSmoothingQuality: this.imageSmoothingQuality }); },
        restore() { Object.assign(this, stack.pop()); },
        drawImage(source, ...coords) {
            snapshots.push({
                digest: createHash('sha256').update(source.pixels).digest('hex'),
                coords, composite: this.globalCompositeOperation, alpha: this.globalAlpha,
                filter: this.filter, smoothing: this.imageSmoothingEnabled,
                quality: this.imageSmoothingQuality
            });
        }
    };
    return { state, ctx, snapshots };
}
function compare(sequence, expectedSaved) {
    const a = mock(), b = mock();
    for (const action of sequence) {
        if (action === 'new-frame') {
            a.state._renderEpoch++; b.state._renderEpoch++;
        } else if (action === 'mutate') {
            a.state.temp[2500] += 0.3; b.state.temp[2500] += 0.3;
            a.state._mutationRevision++; b.state._mutationRevision++;
        } else {
            original.call(a.state, a.ctx, action);
            optimized.call(b.state, b.ctx, action);
        }
    }
    assert.deepEqual(b.snapshots, a.snapshots, 'Pixel data, compositing, filters or pass order changed');
    assert.equal(a.state.uploads - b.state.uploads, expectedSaved,
        'Unexpected number of eliminated redundant image uploads');
}
compare(['smoke', 'smoke', 'fire'], 1);
compare(['smoke', 'smoke', 'fire', 'new-frame', 'smoke', 'smoke', 'fire'], 2);
compare(['smoke', 'mutate', 'smoke', 'fire'], 0);
compare(['smoke', 'smoke', 'new-frame', 'smoke', 'smoke', 'fire'], 2);
console.log('BOT WAVE smoke raster cache parity PASS: same ImageData bytes, blur/filter/alpha/pass order; mutation and frame invalidation verified.');
