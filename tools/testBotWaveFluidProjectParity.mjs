// Exact Float32 state-parity gate against the actual shipped Gold method,
// not a manually restated baseline. Run with node tools/testBotWaveFluidProjectParity.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { losslessProject } from './botWaveFluidProjectCandidate.mjs';

const html = fs.readFileSync(new URL('../public/bot-wave/game.html', import.meta.url), 'utf8');
const found = html.match(/\n    project\(i0b, i1b, j0b, j1b\) \{[\s\S]*?\n    \}\n    step\(dt\) \{/);
assert.ok(found, 'Gold source method Fluid.project() must be uniquely present');
assert.equal(html.match(/\n    project\(i0b, i1b, j0b, j1b\) \{/g)?.length, 1);
const originalMethod = found[0].slice(1).replace(/\n    step\(dt\) \{$/, '');
assert.match(originalMethod, /k = 0; k < 14; k\+\+/);
// Trusted repo source, evaluated only inside this Node test.
// eslint-disable-next-line no-new-func
const original = new Function('exports', `return ({${originalMethod}}).project;`)({ N: 158 });
const N = 158;
const spans = [
    [1, N - 2, 1, N - 2], [1, 1, 1, 1], [N - 2, N - 2, N - 2, N - 2],
    [1, N - 2, 50, 50], [50, 50, 1, N - 2], [12, 37, 18, 42],
    [24, 145, 10, 130], [N - 3, N - 2, 2, 4],
];
function build(seed) {
    const arrays = { n: N };
    let x = seed >>> 0;
    const rand = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 0x100000000) * 2 - 1;
    for (const name of ['u', 'v', 'p', 'div']) {
        arrays[name] = Float32Array.from({ length: N * N }, () => rand() * (name === 'p' ? 0.2 : 3));
    }
    return arrays;
}
function compareArrays(a, b, label) {
    for (const name of ['u', 'v', 'p', 'div']) {
        const originalBytes = Buffer.from(a[name].buffer);
        const candidateBytes = Buffer.from(b[name].buffer);
        assert.ok(originalBytes.equals(candidateBytes),
            `${label}: ${name} diverged from original Gold Float32 state`);
    }
}
let checked = 0;
for (const [i0, i1, j0, j1] of spans) {
    for (let seed = 1; seed <= 5; seed++) {
        const a = build(seed * 437 + i0 * 41 + j0);
        const b = { n: N, u: a.u.slice(), v: a.v.slice(), p: a.p.slice(), div: a.div.slice() };
        for (let step = 0; step < 3; step++) {
            original.call(a, i0, i1, j0, j1);
            losslessProject.call(b, i0, i1, j0, j1);
            compareArrays(a, b, `box [${i0},${i1},${j0},${j1}] seed ${seed} step ${step}`);
            checked++;
        }
    }
}
console.log(`BOT WAVE exact pressure solver parity PASS: ${checked} full-grid/partial-grid bitwise Float32 comparisons`);
