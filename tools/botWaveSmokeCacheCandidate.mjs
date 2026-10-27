// Instrumental, non-shipping candidate: reuse smoke's identical ImageData
// twice inside one render, without dropping either composited smoke pass.
// To preserve pixels after a mid-render effect injection, the cache includes
// a mutation generation advanced by touch(), step() and clear().
import assert from 'node:assert/strict';

function replaceOnce(source, from, to, label) {
    assert.equal(source.split(from).length - 1, 1, `${label}: expected unique source anchor`);
    return source.replace(from, to);
}

export function smokeCacheCandidateHtml(gold) {
    const start = '\n    draw(ctx, layer) {';
    const end = '\n    /** hot regions in world space';
    const a = gold.indexOf(start), b = gold.indexOf(end, a);
    assert.ok(a > 0 && b > a, 'Gold Fluid.draw method missing');
    const first = gold.slice(0, a), last = gold.slice(b);
    let body = gold.slice(a, b);
    body = replaceOnce(body, '        px.fill(0);', `        // If unchanged since the first smoke raster, the second smoke
        // draw still executes with its existing 0.45 opacity and blur.
        const reuseSmoke = layer === 'smoke' && this._rasterLayer === 'smoke' &&
            this._rasterEpoch === this._renderEpoch &&
            this._rasterRevision === this._mutationRevision;
        if (!reuseSmoke) {
        px.fill(0);`, 'fluid clear');
    body = replaceOnce(body, `        this.cctx.putImageData(this.img, 0, 0);
        ctx.save();`, `        this.cctx.putImageData(this.img, 0, 0);
        this._rasterLayer = layer;
        this._rasterEpoch = this._renderEpoch;
        this._rasterRevision = this._mutationRevision;
        }
        ctx.save();`, 'fluid image upload');
    let out = first + body + last;
    out = replaceOnce(out, `    touch(i, j, r = 1) {
        this.minI`, `    touch(i, j, r = 1) {
        this._mutationRevision = (this._mutationRevision || 0) + 1;
        this.minI`, 'injected heat/smoke/force');
    out = replaceOnce(out, `    step(dt) {
        // decay the activity box`, `    step(dt) {
        this._mutationRevision = (this._mutationRevision || 0) + 1;
        // decay the activity box`, 'simulation step');
    out = replaceOnce(out, `    clear() {
        this.u.fill(0);`, `    clear() {
        this._mutationRevision = (this._mutationRevision || 0) + 1;
        this.u.fill(0);`, 'fluid clear state');
    out = replaceOnce(out, `    render() {
        // the world draws into an offscreen buffer`, `    render() {
        this.fluid._renderEpoch = (this.fluid._renderEpoch || 0) + 1;
        // the world draws into an offscreen buffer`, 'game render');
    return out;
}
