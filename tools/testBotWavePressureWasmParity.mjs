import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installPressureWasm, pressureWasmBytes } from './botWavePressureWasmCandidate.mjs';

const gold = fs.readFileSync(new URL('../public/bot-wave/game.html', import.meta.url), 'utf8');
const match = gold.match(/\n    project\(i0b, i1b, j0b, j1b\) \{[\s\S]*?\n    \}\n    step\(dt\) \{/);
assert.ok(match && gold.match(/\n    project\(i0b, i1b, j0b, j1b\) \{/g)?.length === 1);
const source = match[0].slice(1).replace(/\n    step\(dt\) \{$/, '');
const original = new Function('exports', `return ({${source}}).project`)({ N: 158 });
assert.match(source, /k = 0; k < 14; k\+\+/);
assert.ok(WebAssembly.validate(pressureWasmBytes()), 'WASM blob must be valid');
const N = 158, size = N * N;
const spans = [
    [1, N-2, 1, N-2], [1, 1, 1, 1], [N-2, N-2, N-2, N-2],
    [1, N-2, 50, 50], [50, 50, 1, N-2], [12, 37, 18, 42],
    [24, 145, 10, 130], [N-3, N-2, 2, 4]
];
function sourceState(seed) {
    let x = seed >>> 0;
    const rnd = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 0x100000000) * 2 - 1;
    return {
        n: N, project: original,
        ...Object.fromEntries(['u', 'v', 'p', 'div'].map(name =>
            [name, Float32Array.from({ length: size }, () => rnd() * (name === 'p' ? 0.2 : 3))]))
    };
}
let cases = 0;
for (const [i0, i1, j0, j1] of spans) {
    for (let seed = 1; seed <= 5; seed++) {
        const orig = sourceState(seed * 437 + i0 * 41 + j0);
        const wasm = { n: N, project: original,
            ...Object.fromEntries(['u', 'v', 'p', 'div'].map(k => [k, orig[k].slice()])) };
        await installPressureWasm(wasm);
        for (let step = 0; step < 3; step++) {
            orig.project(i0, i1, j0, j1);
            wasm.project(i0, i1, j0, j1);
            for (const key of ['u', 'v', 'p', 'div']) {
                assert.ok(Buffer.from(orig[key].buffer).equals(
                    Buffer.from(wasm[key].buffer, wasm[key].byteOffset, wasm[key].byteLength)),
                    `WASM Gold mismatch at ${key}, [${i0},${i1},${j0},${j1}], seed=${seed}, step=${step}`);
            }
            cases++;
        }
    }
}
console.log(`BOT WAVE WASM pressure solver exact Gold parity PASS: ${cases} bitwise full-grid/partial-grid repeated-state cases`);
