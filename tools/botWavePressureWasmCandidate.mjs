// Precompiled with clang17 from tools/pressure-solver.c, -O3, NO fast-math.
// Non-shipping experiment until bitwise Gold parity and hardware A/B acceptance.
// Exact 14 sweeps; no resolution, visual, skill, effect, or bot reduction.
export const pressureWasmBase64 = 'AGFzbQEAAAABDQFgCX9/f39/f39/fwACDwEDZW52Bm1lbW9yeQIAAgMCAQAEBQFwAQEBBggBfwFBgIgECwcLAQdwcm9qZWN0AAAKvAYBuQYCE38BfQJAIAMgBEoiCQ0AIAEgAkoiCg0AIAYgACADQX9qbEECdCABQQJ0amohCyAGIABBAnQiDCABIAMgAGxqIg1BAnQiDmpqIQ8gAkEBaiEQIAcgDmohESAIIA5qIRIgBSAOaiETQQAhDiADIRQDQCARIRUgEiEWIAshFyATIRggDyEZIBAhGgNAIBYgDmogGCAOaiIbQQRqKgIAuyAbQXxqKgIAu6EgGSAOaioCALugIBcgDmoqAgC7oUQAAAAAAADgv6K2OAIAIBUgDmpBADYCACAVQQRqIRUgFkEEaiEWIBdBBGohFyAYQQRqIRggGUEEaiEZIAEgGkF/aiIaRw0ACyAOIAxqIQ4gFCAERiEVIBRBAWohFCAVRQ0ACyAJDQAgCg0AIAcgACADQX9qbEECdCABQQJ0amohFyAHIABBAnQiDCANQQJ0Ig5qaiEYIAJBAWohDyAIIA5qIRkgByAOaiIaQXxqIRBBACERA0BBACEbQQAhFCADIQsDQCAQIAwgFGxqKgIAIRwgGyEOIA8hFQNAIBogDmoiFiAZIA5qKgIAuyAcu6AgFkEEaioCALugIBcgDmoqAgC7oCAYIA5qKgIAu6BEAAAAAAAA0D+itiIcOAIAIA5BBGohDiABIBVBf2oiFUcNAAsgGyAMaiEbIBRBAWohFCALIARGIQ4gC0EBaiELIA5FDQALIBFBAWoiEUEORw0ACyAJDQAgCg0AIAcgACADQX9qbEECdCABQQJ0amohGyAHIABBAnQiFCANQQJ0Ig5qaiELIAIgAWtBAWohDCAGIA5qIQ8gBSAOaiEQIAcgDmohEUEAIQ4DQCAbIRUgDyEWIBAhASARIRcgCyEYIAwhGQNAIAEgDmoiGiAaKgIAuyAXIA5qIhpBBGoqAgC7IBpBfGoqAgC7oUQAAAAAAADgP6KhtjgCACAWIA5qIhogGioCALsgGCAOaioCALsgFSAOaioCALuhRAAAAAAAAOA/oqG2OAIAIBVBBGohFSAWQQRqIRYgAUEEaiEBIBdBBGohFyAYQQRqIRggGUF/aiIZDQALIA4gFGohDiADIARGIRUgA0EBaiEDIBVFDQALCwsANQRuYW1lAA4NcHJlc3N1cmUud2FzbQEKAQAHcHJvamVjdAcSAQAPX19zdGFja19wb2ludGVyAH8JcHJvZHVjZXJzAQxwcm9jZXNzZWQtYnkBBWNsYW5nXzE3LjAuMCAoaHR0cHM6Ly9naXRodWIuY29tL3N3aWZ0bGFuZy9sbHZtLXByb2plY3QuZ2l0IDEwOTk5YjZkMDM0ZmUzMThmM2Q1NmM4M2JkZGI2NTcyNTkzYThiYjApAEkPdGFyZ2V0X2ZlYXR1cmVzBCsKbXVsdGl2YWx1ZSsPbXV0YWJsZS1nbG9iYWxzKw9yZWZlcmVuY2UtdHlwZXMrCHNpZ24tZXh0';
export function pressureWasmBytes() {
    return Uint8Array.from(atob(pressureWasmBase64), x => x.charCodeAt(0));
}
export async function installPressureWasm(fluid) {
    const n = fluid.n;
    if (!Number.isInteger(n) || n < 3) throw Error('Unexpected fluid grid');
    const len = n * n, stride = len * 4;
    const memory = new WebAssembly.Memory({ initial: Math.max(16, Math.ceil(stride * 4 / 65536)), maximum: 32 });
    const wasm = (await WebAssembly.instantiate(pressureWasmBytes(), { env: { memory } })).instance.exports;
    const previous = fluid.project;
    for (let i = 0; i < 4; i++) {
        const name = ['u', 'v', 'p', 'div'][i];
        const target = new Float32Array(memory.buffer, i * stride, len);
        target.set(fluid[name]); fluid[name] = target;
    }
    fluid.project = function(i0, i1, j0, j1) {
        wasm.project(n, i0, i1, j0, j1, 0, stride, 2 * stride, 3 * stride);
    };
    return { backend: 'webassembly-f64-lossless-pressure', previous, memory, wasm };
}
