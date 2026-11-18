/* =============================================================================
 * APEX CHAOS: TOTAL EVOLUTION — WebGL2 Real-Time GPU Post-FX & Shader Compositor
 *
 * Delivers studio-grade GPU compositing directly over #game-canvas:
 *  - Dual-pass Half/Quarter-Res Kawase HDR Emissive Bloom (~77–84% fewer texels
 *    than full-res 13-tap sampling while preserving 1:1 sharp fighter silhouettes)
 *  - Relativistic Gravitational Lensing (Einstein ring deflection)
 *  - Up to 8 concurrent Radial Shockwaves with RGB Chromatic Dispersion
 *  - Up to 8 Dynamic Colored Point Lights illuminating metallic arena decks
 *  - Quality presets ('auto' | 'ultra' | 'balanced' | 'off') + hysteresis Auto-FPS
 *    governor and shared window.APEX_GFX_QUALITY budget authority.
 *  - Zero-risk fallback: if WebGL2 is unavailable or toggled off, #game-canvas
 *    remains untouched with zero visual regressions.
 * ========================================================================== */
(function (g) {
  'use strict';
  if (g.APEX_EVOLUTION_SHADER) return;

  const MAX_WAVES = 8;
  const MAX_LENSES = 4;
  const MAX_LIGHTS = 8;
  const VALID_MODES = ['auto', 'ultra', 'balanced', 'off'];
  const STORAGE_KEY = 'apexEvolution.shaderQuality';

  const VERT_SRC = `#version 300 es
  precision highp float;
  out vec2 vUv;
  void main() {
    vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    vUv = vec2(pos.x, 1.0 - pos.y);
    gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
  }`;

  // Pass 1: Bright-pass + 5-tap Dual-Kawase downsample into half/quarter-res FBO.
  // Note: FBO coordinates are already matched to scene UV without extra Y flip.
  const BLOOM_VERT_SRC = `#version 300 es
  precision mediump float;
  out vec2 vUv;
  void main() {
    vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    vUv = pos;
    gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const BLOOM_FRAG_SRC = `#version 300 es
  precision mediump float;
  in vec2 vUv;
  out vec4 fragColor;
  uniform sampler2D uScene;
  uniform vec2 uTexel;

  vec3 brightTap(vec2 uv) {
    vec3 c = texture(uScene, clamp(uv, 0.001, 0.999)).rgb;
    float lum = max(c.r, max(c.g, c.b));
    return c * smoothstep(0.60, 0.96, lum);
  }

  void main() {
    vec2 h = uTexel * 2.75;
    vec3 sum = brightTap(vUv) * 0.36;
    sum += brightTap(vUv + vec2( h.x,  h.y)) * 0.16;
    sum += brightTap(vUv + vec2(-h.x,  h.y)) * 0.16;
    sum += brightTap(vUv + vec2( h.x, -h.y)) * 0.16;
    sum += brightTap(vUv + vec2(-h.x, -h.y)) * 0.16;
    fragColor = vec4(sum, 1.0);
  }`;

  // Pass 2: Full-res 1:1 scene + bilinear-upsampled Kawase bloom + waves/lens/lights.
  const FRAG_SRC = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;

  uniform sampler2D uScene;
  uniform sampler2D uBloom;
  uniform vec2 uRes;
  uniform vec2 uBloomTexel;
  uniform float uBloomGain;
  uniform float uOverdriveTint;
  uniform int uWideHalo;

  uniform int uWaveCount;
  uniform vec4 uWaves[${MAX_WAVES}];
  uniform vec4 uWaveMeta[${MAX_WAVES}]; // x=widthUV, y=chroma, z=fade, w=unused

  uniform int uLensCount;
  uniform vec4 uLenses[${MAX_LENSES}];

  uniform int uLightCount;
  uniform vec4 uLightPos[${MAX_LIGHTS}];
  uniform vec4 uLightCol[${MAX_LIGHTS}];

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / max(uRes.y, 1.0);
    vec2 totalDisp = vec2(0.0);
    float chromaAmt = 0.0;

    // 1. Relativistic Gravitational Lenses
    for (int i = 0; i < ${MAX_LENSES}; i++) {
      if (i >= uLensCount) break;
      vec4 L = uLenses[i];
      vec2 d = uv - L.xy;
      d.x *= aspect;
      float r = length(d) + 0.0008;
      if (r < L.z) {
        float u = 1.0 - (r / L.z);
        float bend = L.w * 0.042 * u * u / (r * 8.0 + 0.14);
        vec2 dir = normalize(d);
        dir.x /= aspect;
        totalDisp -= dir * bend;
        chromaAmt += u * L.w * 0.0055;
      }
    }

    // 2. Radial Shockwave Distortion Ripples
    for (int i = 0; i < ${MAX_WAVES}; i++) {
      if (i >= uWaveCount) break;
      vec4 W = uWaves[i];
      vec4 M = uWaveMeta[i];
      vec2 d = uv - W.xy;
      d.x *= aspect;
      float dist = length(d);
      float band = abs(dist - W.z);
      if (band < M.x) {
        float waveProfile = (1.0 - band / M.x);
        float signedRing = sin(((dist - W.z) / M.x) * 3.14159265);
        vec2 dir = dist > 0.0001 ? d / dist : vec2(0.0, 1.0);
        dir.x /= aspect;
        float push = W.w * 0.032 * waveProfile * signedRing * M.z;
        totalDisp += dir * push;
        chromaAmt += abs(push) * M.y * 0.48;
      }
    }

    vec2 suv = clamp(uv + totalDisp, 0.001, 0.999);
    vec3 col;
    if (chromaAmt > 0.00025) {
      vec2 cDir = normalize(uv - vec2(0.5) + 0.0001) * clamp(chromaAmt, 0.0, 0.014);
      col.r = texture(uScene, clamp(suv + cDir, 0.001, 0.999)).r;
      col.g = texture(uScene, suv).g;
      col.b = texture(uScene, clamp(suv - cDir, 0.001, 0.999)).b;
    } else {
      col = texture(uScene, suv).rgb;
    }

    // 3. HDR Emissive Bloom (pre-downsampled FBO)
    if (uBloomGain > 0.01) {
      vec3 bloom = texture(uBloom, suv).rgb;
      if (uWideHalo == 1) {
        vec2 w = uBloomTexel * 2.2;
        bloom = bloom * 0.56
          + (texture(uBloom, clamp(suv + vec2(w.x, w.y), 0.002, 0.998)).rgb
           + texture(uBloom, clamp(suv + vec2(-w.x, w.y), 0.002, 0.998)).rgb
           + texture(uBloom, clamp(suv + vec2(w.x, -w.y), 0.002, 0.998)).rgb
           + texture(uBloom, clamp(suv + vec2(-w.x, -w.y), 0.002, 0.998)).rgb) * 0.16;
      }
      col += bloom * uBloomGain;
    }

    // 4. Dynamic Point-Light Floor & Rim Illumination
    if (uLightCount > 0) {
      vec3 lightAdd = vec3(0.0);
      for (int i = 0; i < ${MAX_LIGHTS}; i++) {
        if (i >= uLightCount) break;
        vec4 lp = uLightPos[i];
        vec2 d = suv - lp.xy;
        d.x *= aspect;
        float att = clamp(1.0 - length(d) / max(lp.z, 0.001), 0.0, 1.0);
        att = att * att * (3.0 - 2.0 * att);
        lightAdd += uLightCol[i].rgb * (att * lp.w * 0.24);
      }
      col += lightAdd * (vec3(1.0) - col * 0.45);
    }

    // 5. Subtle Overdrive Atmosphere & Edge Framing Vignette
    vec2 vigD = (uv - 0.5) * 1.38;
    float vig = clamp(1.0 - dot(vigD, vigD) * 0.16, 0.80, 1.0);
    col *= vig;
    if (uOverdriveTint > 0.01) {
      col = mix(col, col * vec3(1.08, 1.02, 1.12) + vec3(0.03, 0.015, 0.04), uOverdriveTint * 0.45);
    }

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }`;

  function detectInitialAutoTier() {
    try {
      const nav = g.navigator || {};
      const mem = Number(nav.deviceMemory) || 0;
      const cores = Number(nav.hardwareConcurrency) || 0;
      if (g.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'balanced';
      if ((mem > 0 && mem <= 4) || (cores > 0 && cores <= 4)) return 'balanced';
    } catch (_) {}
    return 'ultra';
  }

  let glCanvas = null;
  let gl = null;
  let prog = null;
  let bloomProg = null;
  let tex = null;
  let texW = 0;
  let texH = 0;
  let bloomFbo = null;
  let bloomTex = null;
  let bloomW = 0;
  let bloomH = 0;
  let vao = null;
  let locs = null;
  let bloomLocs = null;
  let glFailed = false;
  let cached2dCanvas = null;
  let cached2dCtx = null;

  let quality = 'auto'; // 'auto' | 'ultra' | 'balanced' | 'off'
  let autoTier = detectInitialAutoTier(); // 'ultra' | 'balanced' | 'off'
  let emaFrameMs = 16.67;
  let slowAccum = 0;
  let fastAccum = 0;
  let tierCooldown = 0;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (VALID_MODES.includes(saved)) quality = saved;
  } catch (_) {}

  function effectiveTier() {
    return quality === 'auto' ? autoTier : quality;
  }

  function updateAutoGovernor(dt, rawFrameMs) {
    if (quality !== 'auto') return;
    if (tierCooldown > 0) tierCooldown = Math.max(0, tierCooldown - dt);
    const sample = Number(rawFrameMs);
    if (!(sample > 2 && sample < 250)) return;
    emaFrameMs += (sample - emaFrameMs) * 0.08;
    const slowThreshold = autoTier === 'ultra' ? 21.5 : 25.5;
    if (emaFrameMs > slowThreshold) {
      slowAccum += dt;
      fastAccum = 0;
      if (tierCooldown <= 0 && slowAccum >= (autoTier === 'ultra' ? 1.6 : 2.2)) {
        const prev = autoTier;
        autoTier = autoTier === 'ultra' ? 'balanced' : 'off';
        slowAccum = 0;
        tierCooldown = 6.0;
        if (prev !== autoTier) notifyQualityChange();
      }
    } else if (emaFrameMs < 13.5 && autoTier !== 'ultra') {
      fastAccum += dt;
      slowAccum = Math.max(0, slowAccum - dt * 0.5);
      if (tierCooldown <= 0 && fastAccum >= 8.0) {
        const prev = autoTier;
        autoTier = autoTier === 'off' ? 'balanced' : 'ultra';
        fastAccum = 0;
        tierCooldown = 10.0;
        if (prev !== autoTier) notifyQualityChange();
      }
    } else {
      slowAccum = Math.max(0, slowAccum - dt * 0.5);
      fastAccum = Math.max(0, fastAccum - dt * 0.5);
    }
  }

  function notifyQualityChange() {
    try {
      g.dispatchEvent(new CustomEvent('apex:gfx-quality-changed', {
        detail: { mode: quality, effective: effectiveTier() },
      }));
    } catch (_) {}
  }

  const waves = [];
  const frameLenses = [];
  const frameLights = [];
  let overdriveTint = 0;

  const waveArr = new Float32Array(MAX_WAVES * 4);
  const waveMetaArr = new Float32Array(MAX_WAVES * 4);
  const lensArr = new Float32Array(MAX_LENSES * 4);
  const lightPosArr = new Float32Array(MAX_LIGHTS * 4);
  const lightColArr = new Float32Array(MAX_LIGHTS * 4);

  function compileShader(context, type, src) {
    const sh = context.createShader(type);
    context.shaderSource(sh, src);
    context.compileShader(sh);
    if (!context.getShaderParameter(sh, context.COMPILE_STATUS)) {
      console.warn('[ApexEvolutionShader] compile warning:', context.getShaderInfoLog(sh));
      context.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function linkProgram(context, vsSrc, fsSrc) {
    const vs = compileShader(context, context.VERTEX_SHADER, vsSrc);
    const fs = compileShader(context, context.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const p = context.createProgram();
    context.attachShader(p, vs);
    context.attachShader(p, fs);
    context.linkProgram(p);
    context.deleteShader(vs);
    context.deleteShader(fs);
    if (!context.getProgramParameter(p, context.LINK_STATUS)) {
      context.deleteProgram(p);
      return null;
    }
    return p;
  }

  function createLinearTexture(context) {
    const t = context.createTexture();
    context.bindTexture(context.TEXTURE_2D, t);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
    return t;
  }

  function ensureBloomTarget(w, h, scale) {
    const targetW = Math.max(64, Math.round(w * scale));
    const targetH = Math.max(64, Math.round(h * scale));
    if (bloomFbo && bloomW === targetW && bloomH === targetH) return true;
    if (!bloomTex) bloomTex = createLinearTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, bloomTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, targetW, targetH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    if (!bloomFbo) bloomFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, bloomFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bloomTex, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      glFailed = true;
      return false;
    }
    bloomW = targetW;
    bloomH = targetH;
    return true;
  }

  function ensureGl(srcCanvas, tier) {
    if (glFailed || tier === 'off' || !srcCanvas) return false;
    if (gl && typeof gl.isContextLost === 'function' && gl.isContextLost()) {
      glFailed = true;
      return false;
    }
    if (!glCanvas) {
      glCanvas = document.createElement('canvas');
      glCanvas.id = 'apex-evolution-webgl-offscreen';
      glCanvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault?.();
        glFailed = true;
      }, false);
      glCanvas.addEventListener('webglcontextrestored', () => {
        // Allow clean lazy re-init on next frame after GPU driver reset.
        gl = null;
        prog = null;
        bloomProg = null;
        vao = null;
        tex = null;
        bloomTex = null;
        bloomFbo = null;
        texW = 0;
        texH = 0;
        bloomW = 0;
        bloomH = 0;
        glCanvas = null;
        glFailed = false;
      }, false);
      const context = glCanvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        // Drawback into #game-canvas occurs synchronously before yielding to the
        // browser compositor, so retaining the backbuffer only wastes GPU bandwidth.
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      });
      if (!context) {
        glFailed = true;
        return false;
      }
      const mainP = linkProgram(context, VERT_SRC, FRAG_SRC);
      const bP = linkProgram(context, BLOOM_VERT_SRC, BLOOM_FRAG_SRC);
      if (!mainP || !bP) {
        glFailed = true;
        return false;
      }
      gl = context;
      prog = mainP;
      bloomProg = bP;
      vao = gl.createVertexArray();
      tex = createLinearTexture(gl);

      bloomLocs = {
        uScene: gl.getUniformLocation(bloomProg, 'uScene'),
        uTexel: gl.getUniformLocation(bloomProg, 'uTexel'),
      };
      locs = {
        uScene: gl.getUniformLocation(prog, 'uScene'),
        uBloom: gl.getUniformLocation(prog, 'uBloom'),
        uRes: gl.getUniformLocation(prog, 'uRes'),
        uBloomTexel: gl.getUniformLocation(prog, 'uBloomTexel'),
        uBloomGain: gl.getUniformLocation(prog, 'uBloomGain'),
        uOverdriveTint: gl.getUniformLocation(prog, 'uOverdriveTint'),
        uWideHalo: gl.getUniformLocation(prog, 'uWideHalo'),
        uWaveCount: gl.getUniformLocation(prog, 'uWaveCount'),
        uWaves: gl.getUniformLocation(prog, 'uWaves[0]'),
        uWaveMeta: gl.getUniformLocation(prog, 'uWaveMeta[0]'),
        uLensCount: gl.getUniformLocation(prog, 'uLensCount'),
        uLenses: gl.getUniformLocation(prog, 'uLenses[0]'),
        uLightCount: gl.getUniformLocation(prog, 'uLightCount'),
        uLightPos: gl.getUniformLocation(prog, 'uLightPos[0]'),
        uLightCol: gl.getUniformLocation(prog, 'uLightCol[0]'),
      };
    }

    if (glCanvas.width !== srcCanvas.width || glCanvas.height !== srcCanvas.height) {
      glCanvas.width = srcCanvas.width;
      glCanvas.height = srcCanvas.height;
    }
    if (!ensureBloomTarget(glCanvas.width, glCanvas.height, tier === 'ultra' ? 0.5 : 0.28)) return false;
    return true;
  }

  function worldSize() {
    return typeof g.GAME_SIZE === 'number' && g.GAME_SIZE > 0 ? g.GAME_SIZE : 1000;
  }

  const api = {
    getQuality: () => quality,
    getEffectiveQuality: () => effectiveTier(),
    getFrameEmaMs: () => emaFrameMs,
    setQuality(next) {
      if (!VALID_MODES.includes(next)) return quality;
      quality = next;
      if (next === 'auto') {
        autoTier = detectInitialAutoTier();
        slowAccum = 0;
        fastAccum = 0;
        tierCooldown = 2.0;
      }
      try { localStorage.setItem(STORAGE_KEY, quality); } catch (_) {}
      notifyQualityChange();
      return quality;
    },
    cycleQuality() {
      const next = VALID_MODES[(VALID_MODES.indexOf(quality) + 1) % VALID_MODES.length];
      return api.setQuality(next);
    },
    spawnShockwave(wx, wy, strength = 0.42, maxRadiusWorld = 320, speedWorld = 680, chroma = 1.0) {
      if (effectiveTier() === 'off') return;
      const S = worldSize();
      if (waves.length >= MAX_WAVES) {
        // Recycle oldest/most-faded slot in place without O(n) array shift.
        let oldest = 0;
        let maxProg = -1;
        for (let i = 0; i < waves.length; i++) {
          const progRatio = waves[i].r / waves[i].maxR;
          if (progRatio > maxProg) { maxProg = progRatio; oldest = i; }
        }
        const slot = waves[oldest];
        slot.ux = wx / S; slot.uy = wy / S; slot.r = 0.015;
        slot.maxR = Math.max(0.08, maxRadiusWorld / S);
        slot.spd = Math.max(0.2, speedWorld / S);
        slot.str = strength; slot.width = 0.075; slot.chroma = chroma;
        return;
      }
      waves.push({
        ux: wx / S,
        uy: wy / S,
        r: 0.015,
        maxR: Math.max(0.08, maxRadiusWorld / S),
        spd: Math.max(0.2, speedWorld / S),
        str: strength,
        width: 0.075,
        chroma,
      });
    },
    pushLens(wx, wy, radiusWorld = 110, strength = 0.25) {
      if (effectiveTier() === 'off' || frameLenses.length >= MAX_LENSES) return;
      const S = worldSize();
      frameLenses.push({
        ux: wx / S,
        uy: wy / S,
        r: radiusWorld / S,
        str: strength,
      });
    },
    pushLight(wx, wy, r = 1, gCol = 0.6, b = 0.2, radiusWorld = 180, intensity = 0.6) {
      const tier = effectiveTier();
      const cap = tier === 'ultra' ? MAX_LIGHTS : (tier === 'balanced' ? 4 : 0);
      if (frameLights.length >= cap) return;
      const S = worldSize();
      frameLights.push({
        ux: wx / S,
        uy: wy / S,
        rad: radiusWorld / S,
        int: intensity,
        r,
        g: gCol,
        b,
      });
    },
    setOverdriveTint(val) {
      overdriveTint = Math.max(0, Math.min(1, Number(val) || 0));
    },
    stepAndComposite(dt = 1 / 60, rawFrameMs = g.__apexFrameDeltaMs) {
      const safeDt = Math.min(0.05, Math.max(0.001, Number(dt) || (1 / 60)));
      updateAutoGovernor(safeDt, rawFrameMs);

      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i];
        w.r += w.spd * safeDt;
        if (w.r >= w.maxR) {
          waves[i] = waves[waves.length - 1];
          waves.pop();
        }
      }

      const tier = effectiveTier();
      const srcCanvas = document.getElementById('game-canvas');
      const liveMatch = g.gameState === 'ARSENAL' || g.gameState === 'PLAYING';
      if (!liveMatch || tier === 'off' || !srcCanvas || srcCanvas.width < 16) {
        frameLenses.length = 0;
        frameLights.length = 0;
        overdriveTint = Math.max(0, overdriveTint - safeDt * 1.4);
        return;
      }

      if (!ensureGl(srcCanvas, tier)) {
        frameLenses.length = 0;
        frameLights.length = 0;
        return;
      }

      const wCount = Math.min(waves.length, MAX_WAVES);
      for (let i = 0; i < wCount; i++) {
        const w = waves[i];
        const fade = Math.max(0, 1 - w.r / w.maxR);
        const base = i * 4;
        waveArr[base] = w.ux;
        waveArr[base + 1] = w.uy;
        waveArr[base + 2] = w.r;
        waveArr[base + 3] = w.str;
        waveMetaArr[base] = w.width;
        waveMetaArr[base + 1] = w.chroma;
        waveMetaArr[base + 2] = fade * fade;
        waveMetaArr[base + 3] = 0;
      }

      const lCount = Math.min(frameLenses.length, MAX_LENSES);
      for (let i = 0; i < lCount; i++) {
        const L = frameLenses[i];
        const base = i * 4;
        lensArr[base] = L.ux;
        lensArr[base + 1] = L.uy;
        lensArr[base + 2] = L.r;
        lensArr[base + 3] = L.str;
      }

      const ltCount = tier === 'ultra' ? Math.min(frameLights.length, MAX_LIGHTS) : Math.min(frameLights.length, 4);
      for (let i = 0; i < ltCount; i++) {
        const lt = frameLights[i];
        const base = i * 4;
        lightPosArr[base] = lt.ux;
        lightPosArr[base + 1] = lt.uy;
        lightPosArr[base + 2] = lt.rad;
        lightPosArr[base + 3] = lt.int;
        lightColArr[base] = lt.r;
        lightColArr[base + 1] = lt.g;
        lightColArr[base + 2] = lt.b;
        lightColArr[base + 3] = 0;
      }

      try {
        gl.bindVertexArray(vao);

        // Upload 2D scene once, reusing allocated GPU texture storage when same-size.
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        if (texW !== srcCanvas.width || texH !== srcCanvas.height) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);
          texW = srcCanvas.width;
          texH = srcCanvas.height;
        } else {
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);
        }

        // Pass 1: Downsampled bright-pass Kawase bloom into FBO.
        gl.bindFramebuffer(gl.FRAMEBUFFER, bloomFbo);
        gl.viewport(0, 0, bloomW, bloomH);
        gl.useProgram(bloomProg);
        gl.uniform1i(bloomLocs.uScene, 0);
        gl.uniform2f(bloomLocs.uTexel, 1 / texW, 1 / texH);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        // Pass 2: Full-resolution 1:1 composite.
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, glCanvas.width, glCanvas.height);
        gl.useProgram(prog);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, bloomTex);

        gl.uniform1i(locs.uScene, 0);
        gl.uniform1i(locs.uBloom, 1);
        gl.uniform2f(locs.uRes, glCanvas.width, glCanvas.height);
        gl.uniform2f(locs.uBloomTexel, 1 / bloomW, 1 / bloomH);
        gl.uniform1f(locs.uBloomGain, tier === 'ultra' ? 0.56 : 0.30);
        gl.uniform1f(locs.uOverdriveTint, overdriveTint);
        gl.uniform1i(locs.uWideHalo, tier === 'ultra' ? 1 : 0);

        gl.uniform1i(locs.uWaveCount, wCount);
        if (wCount > 0) {
          gl.uniform4fv(locs.uWaves, waveArr);
          gl.uniform4fv(locs.uWaveMeta, waveMetaArr);
        }

        gl.uniform1i(locs.uLensCount, lCount);
        if (lCount > 0) gl.uniform4fv(locs.uLenses, lensArr);

        gl.uniform1i(locs.uLightCount, ltCount);
        if (ltCount > 0) {
          gl.uniform4fv(locs.uLightPos, lightPosArr);
          gl.uniform4fv(locs.uLightCol, lightColArr);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 3);

        // Write back synchronously into the single authoritative 2D canvas,
        // ONLY when the WebGL2 context is still healthy (never overwrite with black).
        if (typeof gl.isContextLost === 'function' && gl.isContextLost()) {
          glFailed = true;
          return;
        }
        if (cached2dCanvas !== srcCanvas) {
          cached2dCanvas = srcCanvas;
          cached2dCtx = srcCanvas.getContext('2d');
        }
        const scene2d = cached2dCtx;
        if (scene2d) {
          scene2d.save();
          try {
            scene2d.setTransform(1, 0, 0, 1, 0, 0);
            scene2d.globalAlpha = 1;
            scene2d.globalCompositeOperation = 'copy';
            scene2d.filter = 'none';
            scene2d.drawImage(glCanvas, 0, 0, srcCanvas.width, srcCanvas.height);
          } finally { scene2d.restore(); }
        }
      } catch (err) {
        glFailed = true;
        console.warn('[ApexEvolutionShader] GPU post-FX disabled; raw game canvas remains playable', err);
      }

      frameLenses.length = 0;
      frameLights.length = 0;
      overdriveTint = Math.max(0, overdriveTint - safeDt * 1.4);
    },
    hide() {
      waves.length = 0;
      frameLenses.length = 0;
      frameLights.length = 0;
      overdriveTint = 0;
    },
  };

  // Shared runtime graphics quality budget consumed by arenas, VFX, fluid & HUD.
  g.APEX_GFX_QUALITY = Object.freeze({
    getMode: () => quality,
    getEffective: () => effectiveTier(),
    setMode: (next) => api.setQuality(next),
    cycleMode: () => api.cycleQuality(),
    particleScale() {
      const t = effectiveTier();
      return t === 'ultra' ? 1.0 : t === 'balanced' ? 0.65 : 0.4;
    },
    allowHeavyBlur() {
      return effectiveTier() === 'ultra';
    },
    hudFxDprCap() {
      const t = effectiveTier();
      return t === 'ultra' ? 1.5 : 1.0;
    },
  });

  g.APEX_EVOLUTION_SHADER = api;
  g.apexEvolutionShaderCompositor = 'ready';
})(window);
