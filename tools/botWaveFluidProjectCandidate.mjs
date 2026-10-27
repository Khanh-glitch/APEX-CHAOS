// Diagnostic-only, lossless Gauss-Seidel pressure projection for BOT WAVE.
// NEVER loaded by the shipped game. Used by hardware A/B via the profiler.
// The 14 iterations, traversal order, typed arrays and floating-point
// expression are identical to the Gold canonical Fluid.project() method.
export function losslessProject(i0b, i1b, j0b, j1b) {
    const n = this.n, u = this.u, v = this.v, p = this.p, div = this.div;
    // Hoist the row multiplication and use monotonic contiguous typed-array
    // offsets. Each cell and each dependency is visited in the same order.
    for (let j = j0b, row = j0b * n; j <= j1b; j++, row += n) {
        for (let idx = row + i0b, end = row + i1b; idx <= end; idx++) {
            div[idx] = -0.5 * (u[idx + 1] - u[idx - 1] + v[idx + n] - v[idx - n]);
            p[idx] = 0;
        }
    }
    for (let k = 0; k < 14; k++) {
        for (let j = j0b, row = j0b * n; j <= j1b; j++, row += n) {
            for (let idx = row + i0b, end = row + i1b; idx <= end; idx++) {
                p[idx] = (div[idx] + p[idx - 1] + p[idx + 1] + p[idx - n] + p[idx + n]) * 0.25;
            }
        }
    }
    for (let j = j0b, row = j0b * n; j <= j1b; j++, row += n) {
        for (let idx = row + i0b, end = row + i1b; idx <= end; idx++) {
            u[idx] -= 0.5 * (p[idx + 1] - p[idx - 1]);
            v[idx] -= 0.5 * (p[idx + n] - p[idx - n]);
        }
    }
}
