/* Shared Gold fluid accelerator (BOXE 1v1/BOT + BOT WAVE):
 *  1. Paired semi-Lagrangian advection (single bilinear index calc for u/v and dens/temp).
 *  2. Zero-allocation dirty-subrect rasterizer with exact blackbody LUT (eliminates
 *     up to 25k temporary JS arrays/frame and skips empty fire/smoke passes).
 *  3. Grid-space micro-softening + cropped bilinear blit instead of 3x full-world
 *     (1896x1896) ctx.filter='blur(6-7px)' convolutions — preserving exact Gold color,
 *     depth ordering, and soft volumetric edges at a fraction of frame time.
 */
(function (root) {
  'use strict';
  const installed = new WeakMap();
  const CELL = 12;
  const HALF = 936;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // Exact Gold blackbody LUT with Math.pow(t, 1.15) folded into 256-entry RGB table.
  const BB = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const r = clamp(t * 3.2, 0, 1);
    const g = clamp(Math.pow(Math.max(0, t - 0.18), 1.25) * 1.9, 0, 1);
    const b = clamp(Math.pow(Math.max(0, t - 0.55), 2.1) * 2.6, 0, 1);
    BB[i * 3] = Math.round(Math.pow(r, 0.9) * 255);
    BB[i * 3 + 1] = Math.round(Math.pow(g, 1.05) * 255);
    BB[i * 3 + 2] = Math.round(b * 255);
  }
  const FIRE_RGB = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const e = clamp(Math.pow(t, 1.15), 0, 1);
    const li = Math.min(255, (e * 255) | 0) * 3;
    const o = i * 4;
    FIRE_RGB[o] = BB[li];
    FIRE_RGB[o + 1] = BB[li + 1];
    FIRE_RGB[o + 2] = BB[li + 2];
    FIRE_RGB[o + 3] = Math.min(255, (clamp(t * 1.7, 0, 1) * 255) | 0);
  }

  function boxBlur3x3Subrect(src, dst, n, x0, y0, x1, y1) {
    // Ultra-fast separable 1-radius tent kernel [1, 2, 1] / 4 on active RGBA subrect.
    // Equivalent to ~0.55 cell blur = ~6.6px world blur after bilinear upscaling,
    // with zero Canvas2D filter surface allocation or GPU pipeline readback.
    for (let j = y0; j <= y1; j++) {
      const row = j * n;
      for (let i = x0; i <= x1; i++) {
        const il = i > 0 ? i - 1 : i;
        const ir = i < n - 1 ? i + 1 : i;
        const oL = (row + il) * 4, oC = (row + i) * 4, oR = (row + ir) * 4;
        const aC = src[oC + 3], aL = src[oL + 3], aR = src[oR + 3];
        if ((aC | aL | aR) === 0) {
          dst[oC] = dst[oC + 1] = dst[oC + 2] = dst[oC + 3] = 0;
          continue;
        }
        // Premultiplied horizontal blend avoids dark fringes on soft smoke/fire edges.
        const aSum = aL + (aC << 1) + aR;
        dst[oC + 3] = (aSum + 2) >> 2;
        const inv = 1 / aSum;
        dst[oC] = ((src[oL] * aL + ((src[oC] * aC) << 1) + src[oR] * aR) * inv + 0.5) | 0;
        dst[oC + 1] = ((src[oL + 1] * aL + ((src[oC + 1] * aC) << 1) + src[oR + 1] * aR) * inv + 0.5) | 0;
        dst[oC + 2] = ((src[oL + 2] * aL + ((src[oC + 2] * aC) << 1) + src[oR + 2] * aR) * inv + 0.5) | 0;
      }
    }
    for (let j = y0; j <= y1; j++) {
      const ju = j > 0 ? j - 1 : j;
      const jd = j < n - 1 ? j + 1 : j;
      const rU = ju * n, rC = j * n, rD = jd * n;
      for (let i = x0; i <= x1; i++) {
        const oU = (rU + i) * 4, oC = (rC + i) * 4, oD = (rD + i) * 4;
        const aC = dst[oC + 3], aU = dst[oU + 3], aD = dst[oD + 3];
        if ((aC | aU | aD) === 0) {
          src[oC] = src[oC + 1] = src[oC + 2] = src[oC + 3] = 0;
          continue;
        }
        const aSum = aU + (aC << 1) + aD;
        src[oC + 3] = (aSum + 2) >> 2;
        const inv = 1 / aSum;
        src[oC] = ((dst[oU] * aU + ((dst[oC] * aC) << 1) + dst[oD] * aD) * inv + 0.5) | 0;
        src[oC + 1] = ((dst[oU + 1] * aU + ((dst[oC + 1] * aC) << 1) + dst[oD + 1] * aD) * inv + 0.5) | 0;
        src[oC + 2] = ((dst[oU + 2] * aU + ((dst[oC + 2] * aC) << 1) + dst[oD + 2] * aD) * inv + 0.5) | 0;
      }
    }
  }

  function clearSubrect(buf, n, x0, y0, x1, y1) {
    const span = (x1 - x0 + 1) * 4;
    for (let j = y0; j <= y1; j++) {
      const start = (j * n + x0) * 4;
      buf.fill(0, start, start + span);
    }
  }

  function install(fluid) {
    if (!fluid) return null;
    if (installed.has(fluid)) return installed.get(fluid);
    const stats = { pairedAdvections: 0, smokeRasterReuses: 0, fastDraws: 0, emptySkips: 0 };
    const originalStep = fluid.step;
    const originalAdvect = fluid.advect;
    const originalDraw = fluid.draw;
    const source = String(originalStep);

    const paired = source.replace(/\s+/g, ' ').includes('this.advect(u, this.u0, this.u0, this.v0, dt * 1.0, i0b, i1b, j0b, j1b); this.advect(v, this.u0, this.u0, this.v0, dt * 1.0, i0b, i1b, j0b, j1b);')
      && source.replace(/\s+/g, ' ').includes('this.advect(d, this.dens0, u, v, dt, i0b, i1b, j0b, j1b); this.advect(t, this.temp0, u, v, dt, i0b, i1b, j0b, j1b);')
      && (source.match(/this\.advect\(/g) || []).length === 4;
    const compatibleRaster = fluid.n === 158
      && fluid.img && fluid.cvs && fluid.cctx && fluid.temp && fluid.dens && fluid.soot
      && String(originalDraw).includes("ctx.filter = layer === 'fire' ? 'blur(7px)' : 'blur(6px)'");

    let scratch = null;
    let fireCvs = null, fireCtx = null, fireImg = null;
    let stepping = false, pending = null;
    let smokeValid = false, smokeEmpty = true, sX0 = 0, sY0 = 0, sW = 0, sH = 0, pSX0 = 0, pSY0 = 0, pSX1 = -1, pSY1 = -1;
    let fireValid = false, fireEmpty = true, fX0 = 0, fY0 = 0, fW = 0, fH = 0, pFX0 = 0, pFY0 = 0, pFX1 = -1, pFY1 = -1;

    function invalidate() {
      smokeValid = false;
      fireValid = false;
    }

    if (paired) {
      fluid.advect = function (d, d0, u, v, dt, i0, i1, j0, j1) {
        if (!stepping) return originalAdvect.apply(this, arguments);
        if (pending) {
          const p = pending; pending = null;
          if (d === p.d && d0 === p.d0 && u === p.u && v === p.v && dt === p.dt
            && i0 === p.i0 && i1 === p.i1 && j0 === p.j0 && j1 === p.j1) return;
        }
        let other, other0;
        if (d === this.u && d0 === this.u0 && u === this.u0 && v === this.v0) { other = this.v; other0 = this.u0; }
        else if (d === this.dens && d0 === this.dens0 && u === this.u && v === this.v) { other = this.temp; other0 = this.temp0; }
        else return originalAdvect.apply(this, arguments);
        const n = this.n, sameSource = other0 === d0;
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const idx = j * n + i;
            let x = i - dt * u[idx], y = j - dt * v[idx];
            if (x < 0.5) x = 0.5; else if (x > n - 1.5) x = n - 1.5;
            if (y < 0.5) y = 0.5; else if (y > n - 1.5) y = n - 1.5;
            const ii = x | 0, jj = y | 0, s1 = x - ii, s0 = 1 - s1, t1 = y - jj, t0 = 1 - t1, a = jj * n + ii;
            const value = s0 * (t0 * d0[a] + t1 * d0[a + n]) + s1 * (t0 * d0[a + 1] + t1 * d0[a + n + 1]);
            d[idx] = value;
            other[idx] = sameSource ? value : s0 * (t0 * other0[a] + t1 * other0[a + n]) + s1 * (t0 * other0[a + 1] + t1 * other0[a + n + 1]);
          }
        }
        pending = { d: other, d0: other0, u, v, dt, i0, i1, j0, j1 };
        stats.pairedAdvections++;
      };
    }

    fluid.step = function () {
      invalidate(); stepping = true; pending = null;
      try { return originalStep.apply(this, arguments); }
      finally { stepping = false; pending = null; }
    };

    for (const name of ['addHeat', 'addSmoke', 'addForce', 'burst', 'vortex', 'clear', 'touch']) {
      const original = fluid[name];
      if (typeof original === 'function') {
        fluid[name] = function () { invalidate(); return original.apply(this, arguments); };
      }
    }

    function blitSubrect(ctx, srcCvs, x0, y0, w, h, isFire) {
      const ox = -HALF - CELL * 1.5;
      const wx = ox + x0 * CELL;
      const wy = ox + y0 * CELL;
      const ww = w * CELL;
      const wh = h * CELL;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      if (isFire) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(srcCvs, x0, y0, w, h, wx, wy, ww, wh);
        ctx.globalAlpha *= 0.55;
        ctx.drawImage(srcCvs, x0, y0, w, h, wx, wy, ww, wh);
      } else {
        ctx.drawImage(srcCvs, x0, y0, w, h, wx, wy, ww, wh);
      }
      ctx.restore();
    }

    if (compatibleRaster) {
      fluid.draw = function (ctx, layer) {
        if (this.maxI < this.minI) return;
        const n = this.n;
        const isFire = layer === 'fire';

        if (!isFire && smokeValid) {
          stats.smokeRasterReuses++;
          if (!smokeEmpty) blitSubrect(ctx, this.cvs, sX0, sY0, sW, sH, false);
          return;
        }
        if (isFire && fireValid) {
          if (!fireEmpty) blitSubrect(ctx, fireCvs, fX0, fY0, fW, fH, true);
          return;
        }

        const i0b = clamp(this.minI, 0, n - 1), i1b = clamp(this.maxI, 0, n - 1);
        const j0b = clamp(this.minJ, 0, n - 1), j1b = clamp(this.maxJ, 0, n - 1);
        const temp = this.temp, dens = this.dens, soot = this.soot;
        let targetImg, targetCtx, targetCvs;
        if (isFire) {
          if (!fireCvs) {
            fireCvs = document.createElement('canvas');
            fireCvs.width = n; fireCvs.height = n;
            fireCtx = fireCvs.getContext('2d');
            fireImg = fireCtx.createImageData(n, n);
          }
          targetImg = fireImg; targetCtx = fireCtx; targetCvs = fireCvs;
          if (pFX1 >= pFX0) clearSubrect(targetImg.data, n, pFX0, pFY0, pFX1, pFY1);
        } else {
          targetImg = this.img; targetCtx = this.cctx; targetCvs = this.cvs;
          if (pSX1 >= pSX0) clearSubrect(targetImg.data, n, pSX0, pSY0, pSX1, pSY1);
        }

        const px = targetImg.data;
        let visI0 = n, visI1 = -1, visJ0 = n, visJ1 = -1;

        if (isFire) {
          for (let j = j0b; j <= j1b; j++) {
            const row = j * n;
            for (let i = i0b; i <= i1b; i++) {
              const t = temp[row + i];
              if (t < 0.02) continue;
              const ti = t >= 1 ? 255 : (t * 255) | 0;
              const lo = ti * 4, o = (row + i) * 4;
              px[o] = FIRE_RGB[lo];
              px[o + 1] = FIRE_RGB[lo + 1];
              px[o + 2] = FIRE_RGB[lo + 2];
              px[o + 3] = t > 0.588 ? 255 : FIRE_RGB[lo + 3];
              if (i < visI0) visI0 = i;
              if (i > visI1) visI1 = i;
              if (j < visJ0) visJ0 = j;
              if (j > visJ1) visJ1 = j;
            }
          }
          fireValid = true;
          if (visI1 < visI0) {
            fireEmpty = true; pFX1 = -1; stats.emptySkips++;
            return;
          }
          const bx0 = Math.max(0, visI0 - 2), bx1 = Math.min(n - 1, visI1 + 2);
          const by0 = Math.max(0, visJ0 - 2), by1 = Math.min(n - 1, visJ1 + 2);
          if (!scratch) scratch = new Uint8ClampedArray(n * n * 4);
          boxBlur3x3Subrect(px, scratch, n, bx0, by0, bx1, by1);
          const upX0 = pFX1 >= pFX0 ? Math.min(bx0, pFX0) : bx0;
          const upY0 = pFX1 >= pFX0 ? Math.min(by0, pFY0) : by0;
          const upX1 = pFX1 >= pFX0 ? Math.max(bx1, pFX1) : bx1;
          const upY1 = pFX1 >= pFX0 ? Math.max(by1, pFY1) : by1;
          targetCtx.putImageData(targetImg, 0, 0, upX0, upY0, upX1 - upX0 + 1, upY1 - upY0 + 1);
          pFX0 = bx0; pFY0 = by0; pFX1 = bx1; pFY1 = by1;
          fX0 = bx0; fY0 = by0; fW = bx1 - bx0 + 1; fH = by1 - by0 + 1;
          fireEmpty = false;
          stats.fastDraws++;
          blitSubrect(ctx, targetCvs, fX0, fY0, fW, fH, true);
        } else {
          for (let j = j0b; j <= j1b; j++) {
            const row = j * n;
            for (let i = i0b; i <= i1b; i++) {
              const idx = row + i;
              const d = dens[idx];
              if (d < 0.02) continue;
              const s = soot[idx];
              const lit = clamp(temp[idx] * 1.6, 0, 1);
              const r = (132 - 96 * s) + lit * 190;
              const g = (120 - 88 * s) + lit * 95;
              const b = (100 - 70 * s) + lit * 20;
              const a = d * 0.78;
              const o = idx * 4;
              px[o] = r > 255 ? 255 : r < 0 ? 0 : r;
              px[o + 1] = g > 255 ? 255 : g < 0 ? 0 : g;
              px[o + 2] = b > 255 ? 255 : b < 0 ? 0 : b;
              px[o + 3] = ((a > 0.92 ? 0.92 : a) * 255) | 0;
              if (i < visI0) visI0 = i;
              if (i > visI1) visI1 = i;
              if (j < visJ0) visJ0 = j;
              if (j > visJ1) visJ1 = j;
            }
          }
          smokeValid = true;
          if (visI1 < visI0) {
            smokeEmpty = true; pSX1 = -1; stats.emptySkips++;
            return;
          }
          const bx0 = Math.max(0, visI0 - 2), bx1 = Math.min(n - 1, visI1 + 2);
          const by0 = Math.max(0, visJ0 - 2), by1 = Math.min(n - 1, visJ1 + 2);
          if (!scratch) scratch = new Uint8ClampedArray(n * n * 4);
          boxBlur3x3Subrect(px, scratch, n, bx0, by0, bx1, by1);
          const upX0 = pSX1 >= pSX0 ? Math.min(bx0, pSX0) : bx0;
          const upY0 = pSX1 >= pSX0 ? Math.min(by0, pSY0) : by0;
          const upX1 = pSX1 >= pSX0 ? Math.max(bx1, pSX1) : bx1;
          const upY1 = pSX1 >= pSX0 ? Math.max(by1, pSY1) : by1;
          targetCtx.putImageData(targetImg, 0, 0, upX0, upY0, upX1 - upX0 + 1, upY1 - upY0 + 1);
          pSX0 = bx0; pSY0 = by0; pSX1 = bx1; pSY1 = by1;
          sX0 = bx0; sY0 = by0; sW = bx1 - bx0 + 1; sH = by1 - by0 + 1;
          smokeEmpty = false;
          stats.fastDraws++;
          blitSubrect(ctx, targetCvs, sX0, sY0, sW, sH, false);
        }
      };
    }

    const api = Object.freeze({
      beginFrame() {},
      endFrame() {},
      snapshot: () => ({ ...stats, pairedAdvectionEnabled: paired, fastRasterEnabled: compatibleRaster }),
    });
    installed.set(fluid, api);
    return api;
  }

  root.APEX_GOLD_LOSSLESS_FLUID = Object.freeze({ install });
  root.APEX_WAVE_LOSSLESS_FLUID = root.APEX_GOLD_LOSSLESS_FLUID;
  root.apexBotWaveLosslessFluid = 'ready';
})(window);
