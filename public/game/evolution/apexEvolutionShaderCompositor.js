/* =============================================================================
 * APEX CHAOS: TOTAL EVOLUTION — WebGL2 Real-Time GPU Post-FX & Shader Compositor
 *
 * Delivers studio-grade GPU compositing directly over #game-canvas:
 *  - Relativistic Gravitational Lensing (Einstein ring deflection)
 *  - Up to 8 concurrent Radial Shockwaves with RGB Chromatic Dispersion
 *  - Multi-tap HDR Emissive Bloom on projectiles, skills, plasma & explosions
 *  - Up to 8 Dynamic Colored Point Lights illuminating metallic arena decks
 *  - Zero-risk fallback: if WebGL2 is unavailable or toggled off, #game-canvas
 *    remains untouched with zero visual regressions.
 * ========================================================================== */
(function (g) {
  'use strict';
  if (g.APEX_EVOLUTION_SHADER) return;

  const MAX_WAVES = 8;
  const MAX_LENSES = 4;
  const MAX_LIGHTS = 8;

  const VERT_SRC = `#version 300 es
  precision highp float;
  out vec2 vUv;
  void main() {
    vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    vUv = vec2(pos.x, 1.0 - pos.y);
    gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
  }`;

  const FRAG_SRC = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;

  uniform sampler2D uScene;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uBloomGain;
  uniform float uOverdriveTint;

  // vec4(cx, cy, currentRadiusUV, strengthAndWidthPacked)
  uniform int uWaveCount;
  uniform vec4 uWaves[${MAX_WAVES}];
  uniform vec4 uWaveMeta[${MAX_WAVES}]; // x=widthUV, y=chroma, z=fade, w=unused

  // vec4(cx, cy, radiusUV, strength)
  uniform int uLensCount;
  uniform vec4 uLenses[${MAX_LENSES}];

  // vec4(cx, cy, radiusUV, intensity), vec4(r, g, b, 0)
  uniform int uLightCount;
  uniform vec4 uLightPos[${MAX_LIGHTS}];
  uniform vec4 uLightCol[${MAX_LIGHTS}];

  vec3 sampleBloom(vec2 uv, vec2 texel) {
    vec3 sum = vec3(0.0);
    float weights[9] = float[9](0.0625, 0.125, 0.0625, 0.125, 0.25, 0.125, 0.0625, 0.125, 0.0625);
    int idx = 0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 off = vec2(float(x), float(y)) * texel * 4.5;
        vec3 c = texture(uScene, clamp(uv + off, 0.001, 0.999)).rgb;
        float lum = max(c.r, max(c.g, c.b));
        float knee = smoothstep(0.60, 0.96, lum);
        sum += c * knee * weights[idx];
        idx++;
      }
    }
    // Wide halo second tap
    for (int i = 0; i < 4; i++) {
      float a = float(i) * 1.5707963 + 0.785398;
      vec2 off = vec2(cos(a), sin(a)) * texel * 11.5;
      vec3 c = texture(uScene, clamp(uv + off, 0.001, 0.999)).rgb;
      float lum = max(c.r, max(c.g, c.b));
      sum += c * smoothstep(0.68, 0.98, lum) * 0.14;
    }
    return sum;
  }

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

    // 3. HDR Emissive Bloom
    if (uBloomGain > 0.01) {
      vec2 texel = 1.0 / max(uRes, vec2(256.0));
      vec3 bloom = sampleBloom(suv, texel);
      col += bloom * uBloomGain;
    }

    // 4. Dynamic Point-Light Floor & Rim Illumination
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
    // Additive-screen hybrid so dark metal gleams while whites never clip harshly
    col += lightAdd * (vec3(1.0) - col * 0.45);

    // 5. Subtle Overdrive Atmosphere & Edge Framing Vignette
    vec2 vigD = (uv - 0.5) * 1.38;
    float vig = clamp(1.0 - dot(vigD, vigD) * 0.16, 0.80, 1.0);
    col *= vig;
    if (uOverdriveTint > 0.01) {
      col = mix(col, col * vec3(1.08, 1.02, 1.12) + vec3(0.03, 0.015, 0.04), uOverdriveTint * 0.45);
    }

    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }`;

  let glCanvas = null;
  let gl = null;
  let prog = null;
  let tex = null;
  let vao = null;
  let locs = null;
  let glFailed = false;
  let quality = 'balanced'; // 'ultra' | 'balanced' | 'off'
  try {
    const saved = localStorage.getItem('apexEvolution.shaderQuality');
    if (saved === 'ultra' || saved === 'balanced' || saved === 'off') quality = saved;
  } catch (_) {}
  const graphics = () => g.APEX_GRAPHICS?.getSnapshot?.();
  function syncQuality() { if (graphics()) quality = graphics().profile.shader; }
  g.addEventListener('apex:graphics-changed', syncQuality);
  syncQuality();

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

  function ensureGl(srcCanvas) {
    if (glFailed || quality === 'off' || !srcCanvas) return false;
    if (!glCanvas) {
      // GPU target is OFF-DOM. Gold relocates the authoritative #game-canvas
      // into #arena during battle. A visible second canvas duplicates the map,
      // and offsetLeft/top no longer describe the relocated canvas geometry.
      // Keep GPU postprocessing but write its result back into the SINGLE
      // authoritative 2D game canvas at the end of the render pass.
      glCanvas = document.createElement('canvas');
      glCanvas.id = 'apex-evolution-webgl-offscreen';
      glCanvas.addEventListener('webglcontextlost', event => {
        event.preventDefault(); glFailed = true;
        g.APEX_GRAPHICS?.reportGpuAvailability?.(false);
      });
      glCanvas.addEventListener('webglcontextrestored', () => {
        glCanvas = null; gl = null; prog = null; tex = null; vao = null; locs = null;
        glFailed = false; g.APEX_GRAPHICS?.reportGpuAvailability?.(true);
      });
      const context = glCanvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'default',
      });
      if (!context) {
        glFailed = true;
        g.APEX_GRAPHICS?.reportGpuAvailability?.(false);
        return false;
      }
      const vs = compileShader(context, context.VERTEX_SHADER, VERT_SRC);
      const fs = compileShader(context, context.FRAGMENT_SHADER, FRAG_SRC);
      if (!vs || !fs) {
        glFailed = true;
        if (vs) context.deleteShader(vs);
        if (fs) context.deleteShader(fs);
        g.APEX_GRAPHICS?.reportGpuAvailability?.(false);
        return false;
      }
      const p = context.createProgram();
      context.attachShader(p, vs);
      context.attachShader(p, fs);
      context.linkProgram(p);
      context.deleteShader(vs);
      context.deleteShader(fs);
      if (!context.getProgramParameter(p, context.LINK_STATUS)) {
        glFailed = true;
        context.deleteProgram(p);
        g.APEX_GRAPHICS?.reportGpuAvailability?.(false);
        return false;
      }
      gl = context;
      prog = p;
      vao = gl.createVertexArray();
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      locs = {
        uScene: gl.getUniformLocation(prog, 'uScene'),
        uRes: gl.getUniformLocation(prog, 'uRes'),
        uTime: gl.getUniformLocation(prog, 'uTime'),
        uBloomGain: gl.getUniformLocation(prog, 'uBloomGain'),
        uOverdriveTint: gl.getUniformLocation(prog, 'uOverdriveTint'),
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

    // Never append the GPU surface to the Gold HUD / DOM. Its CSS cannot
    // remain aligned after Gold's ResizeObserver, scene transitions or mobile
    // layout changes. Physical pixels are matched, not CSS coordinates.
    const scale = graphics()?.profile.postScale || 1;
    const width = Math.max(16, Math.round(srcCanvas.width * scale));
    const height = Math.max(16, Math.round(srcCanvas.height * scale));
    if (glCanvas.width !== width || glCanvas.height !== height) {
      glCanvas.width = width;
      glCanvas.height = height;
    }
    return true;
  }

  function worldSize() {
    return typeof g.GAME_SIZE === 'number' && g.GAME_SIZE > 0 ? g.GAME_SIZE : 1000;
  }

  const api = {
    getQuality: () => quality,
    setQuality(next) {
      if (!['ultra', 'balanced', 'off'].includes(next)) return quality;
      quality = next;
      try { localStorage.setItem('apexEvolution.shaderQuality', quality); } catch (_) {}
      return quality;
    },
    cycleQuality() {
      const order = ['ultra', 'balanced', 'off'];
      const next = order[(order.indexOf(quality) + 1) % order.length];
      return api.setQuality(next);
    },
    spawnShockwave(wx, wy, strength = 0.42, maxRadiusWorld = 320, speedWorld = 680, chroma = 1.0) {
      const S = worldSize();
      if (waves.length >= MAX_WAVES) waves.shift();
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
      if (frameLenses.length >= MAX_LENSES) return;
      const S = worldSize();
      frameLenses.push({
        ux: wx / S,
        uy: wy / S,
        r: radiusWorld / S,
        str: strength,
      });
    },
    pushLight(wx, wy, r = 1, gCol = 0.6, b = 0.2, radiusWorld = 180, intensity = 0.6) {
      if (frameLights.length >= MAX_LIGHTS) return;
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
    stepAndComposite(dt = 1 / 60) {
      const preferences = graphics();
      const calm = preferences?.reducedMotion || preferences?.clarity;
      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i];
        w.r += w.spd * dt;
        if (w.r >= w.maxR) waves.splice(i, 1);
      }

      const srcCanvas = document.getElementById('game-canvas');
      const liveMatch = g.gameState === 'ARSENAL' || g.gameState === 'PLAYING';
      if (!liveMatch || quality === 'off' || !srcCanvas || srcCanvas.width < 16) {
        frameLenses.length = 0;
        frameLights.length = 0;
        return;
      }

      if (!ensureGl(srcCanvas)) {
        frameLenses.length = 0;
        frameLights.length = 0;
        return;
      }

      const wCount = Math.min(waves.length, MAX_WAVES);
      for (let i = 0; i < wCount; i++) {
        const w = waves[i];
        const fade = Math.max(0, 1 - w.r / w.maxR);
        waveArr[i * 4] = w.ux;
        waveArr[i * 4 + 1] = w.uy;
        waveArr[i * 4 + 2] = w.r;
        waveArr[i * 4 + 3] = w.str;
        waveMetaArr[i * 4] = w.width;
        waveMetaArr[i * 4 + 1] = calm ? 0 : w.chroma;
        waveMetaArr[i * 4 + 2] = fade * fade;
        waveMetaArr[i * 4 + 3] = 0;
      }

      const lCount = Math.min(frameLenses.length, MAX_LENSES);
      for (let i = 0; i < lCount; i++) {
        const L = frameLenses[i];
        lensArr[i * 4] = L.ux;
        lensArr[i * 4 + 1] = L.uy;
        lensArr[i * 4 + 2] = L.r;
        lensArr[i * 4 + 3] = L.str;
      }

      const ltCount = quality === 'ultra' ? Math.min(frameLights.length, MAX_LIGHTS) : Math.min(frameLights.length, 4);
      for (let i = 0; i < ltCount; i++) {
        const lt = frameLights[i];
        lightPosArr[i * 4] = lt.ux;
        lightPosArr[i * 4 + 1] = lt.uy;
        lightPosArr[i * 4 + 2] = lt.rad;
        lightPosArr[i * 4 + 3] = lt.int;
        lightColArr[i * 4] = lt.r;
        lightColArr[i * 4 + 1] = lt.g;
        lightColArr[i * 4 + 2] = lt.b;
        lightColArr[i * 4 + 3] = 0;
      }

      try {
        gl.viewport(0, 0, glCanvas.width, glCanvas.height);
        gl.useProgram(prog);
        gl.bindVertexArray(vao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);

        gl.uniform1i(locs.uScene, 0);
        gl.uniform2f(locs.uRes, glCanvas.width, glCanvas.height);
        gl.uniform1f(locs.uTime, performance.now() * 0.001);
        gl.uniform1f(locs.uBloomGain, (quality === 'ultra' ? 0.56 : 0.28) * (calm ? 0.45 : 1));
        gl.uniform1f(locs.uOverdriveTint, overdriveTint);

        gl.uniform1i(locs.uWaveCount, preferences?.reducedMotion ? 0 : wCount);
        if (wCount > 0) {
          gl.uniform4fv(locs.uWaves, waveArr);
          gl.uniform4fv(locs.uWaveMeta, waveMetaArr);
        }

        gl.uniform1i(locs.uLensCount, calm ? 0 : lCount);
        if (lCount > 0) gl.uniform4fv(locs.uLenses, lensArr);

        gl.uniform1i(locs.uLightCount, ltCount);
        if (ltCount > 0) {
          gl.uniform4fv(locs.uLightPos, lightPosArr);
          gl.uniform4fv(locs.uLightCol, lightColArr);
        }

        gl.drawArrays(gl.TRIANGLES, 0, 3);

        // Composite once into the original scene, never into a floating overlay.
        // The 2D context is at identity and remains owned by the game engine.
        const scene2d = srcCanvas.getContext('2d');
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
        g.APEX_GRAPHICS?.reportGpuAvailability?.(false);
        console.warn('[ApexEvolutionShader] GPU post-FX disabled; raw game canvas remains playable', err);
      }

      frameLenses.length = 0;
      frameLights.length = 0;
      overdriveTint = Math.max(0, overdriveTint - dt * 1.4);
    },
    hide() {
      waves.length = 0;
      frameLenses.length = 0;
      frameLights.length = 0;
    },
  };

  g.APEX_EVOLUTION_SHADER = api;
  g.apexEvolutionShaderCompositor = 'ready';
})(window);
