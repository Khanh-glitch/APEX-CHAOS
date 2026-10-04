// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function musicianVisualAssetIntegration(){
  try {
    const roleToPath = {
      battleIdle: 'assets/musician_v2/normalized/battle_idle_reference.webp',
      move16: 'assets/musician_v2/normalized/move_16.webp',
      noteShot16: 'assets/musician_v2/normalized/note_shot_16.webp',
      majorChord16: 'assets/musician_v2/normalized/major_chord_16.webp',
      minorChord16: 'assets/musician_v2/normalized/minor_chord_16.webp',
      dropChord32: 'assets/musician_v2/normalized/drop_chord_32.webp',
      soloChord32: 'assets/musician_v2/normalized/solo_chord_32.webp',
      rage32: 'assets/musician_v2/normalized/rage_32.webp',
      vfxSheet: 'assets/musician_v2/normalized/vfx_text_sheet.webp'
    };

    const visualLog = {
      sourceGameFile: 'original apex chaos.html',
      confirmedRosterMarkers: ['MUSICIAN','MASTER_CHEF','MASK','ARCADE','NINJA'],
      removedRosterMarkers: ['MAGNET','MATH_V2','HUNTER','PAINTER','WITCH'],
      selectedAssets: {
        battleIdle: 'a6a5f5bd-f13d-4218-bf23-1a92ae8a279b.webp',
        move16: '73bad526-527e-49c4-9461-e9144e98a910.webp',
        noteShot16: '630c3983-dd8c-4542-9c87-e3fb4ca14182.webp',
        majorChord16: 'd57706d1-df74-4ee9-81cf-fb3d5bdbcc6c.webp',
        minorChord16: 'd6544c22-aa5c-47be-81e9-ed9497d9bcf3.webp',
        dropChord32: '0d1fc6f5-aa77-4aba-b15e-ea0375e42f0a.webp',
        soloChord32: '810f2e9a-32ab-4d55-aa57-dd733ba83e53.webp',
        rage32: '7109d1f4-2f16-4fe2-8f67-733edd00db92.webp',
        vfxSheet: '0442d443-63a5-40c0-a6e7-9b7dbe6100f4.webp'
      },
      missingRoles: ['hit16','defeat16','victory16'],
      notes: [
        'MUSICIAN v2 manifest lives in assets/musician_v2/normalized/manifest.json.',
        'All selected MUSICIAN images available to the workspace are 1254x1254 top-down dark-background PNGs.',
        'Battle idle reference is always drawn as the canonical body. Action sheets are drawn as VFX layers only, preventing body shrink, pop, or disappearance.',
        'hit16, defeat16, and victory16 were not present as files in the attachment tree, so those states use battleIdleReference with visual-only tint/pose fallbacks.',
        'Old root slash/blade PNGs were excluded because they are not MUSICIAN assets.'
      ],
      grids: {}
    };

    const ASSETS = {};
    const roleGridHints = {
      move16: {cols:4, rows:4, frames:16, fps:17, loop:true},
      noteShot16: {cols:4, rows:4, frames:16, fps:18, loop:false},
      majorChord16: {cols:4, rows:4, frames:16, fps:17, loop:false},
      minorChord16: {cols:4, rows:4, frames:16, fps:17, loop:false},
      dropChord32: {cols:8, rows:4, frames:32, fps:22, loop:false},
      soloChord32: {cols:8, rows:4, frames:32, fps:22, loop:false},
      rage32: {cols:4, rows:4, frames:16, fps:18, loop:false}
    };

    function detectGrid(img, role) {
      const hint = roleGridHints[role];
      if (hint) {
        const cellW = img.naturalWidth / hint.cols;
        const cellH = img.naturalHeight / hint.rows;
        const plausible = cellW >= 90 && cellH >= 90 && Math.abs(cellW - cellH) <= Math.max(cellW, cellH) * 0.55;
        const grid = plausible ? {...hint, cellW, cellH} : {cols:1, rows:1, frames:1, fps:12, loop:role === 'battleIdle', cellW:img.naturalWidth, cellH:img.naturalHeight};
        visualLog.grids[role] = `${grid.cols}x${grid.rows}, ${grid.frames} frames`;
        return grid;
      }
      visualLog.grids[role] = 'single full image';
      return {cols:1, rows:1, frames:1, fps:8, loop:role === 'battleIdle', cellW:img.naturalWidth, cellH:img.naturalHeight};
    }

    function transparentizeDarkBackground(img, role) {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const c = canvas.getContext('2d', {willReadFrequently:true});
      c.drawImage(img, 0, 0);
      try {
        const data = c.getImageData(0, 0, canvas.width, canvas.height);
        const px = data.data;
        for (let i=0; i<px.length; i+=4) {
          const r=px[i], g=px[i+1], b=px[i+2];
          const max = Math.max(r,g,b), min = Math.min(r,g,b);
          const chroma = max - min;
          if (max < 58 && chroma < 36) px[i+3] = 0;
          else if (max < 82 && chroma < 30) px[i+3] = Math.max(0, (max - 58) * 7);
        }
        c.putImageData(data, 0, 0);
        return canvas;
      } catch (err) {
        console.warn('[MUSICIAN visuals] dark-background processing skipped for', role, err);
        return img;
      }
    }

    function preloadMusicianAssets() {
      // CP6: the transparentize preprocessing (decode + full getImageData
      // pass) used to run inside every img.onload; when a group's images
      // arrive together the callbacks coalesced into one long main-thread
      // stall. Each asset now processes in its own idle slot through a
      // rolling drain that keeps accepting late arrivals.
      const prepQueue = [];
      let prepDraining = false;
      const drainPrep = () => {
        if (prepDraining) return;
        prepDraining = true;
        const step = () => {
          const task = prepQueue.shift();
          if (task) { try { task(); } catch (err) {} }
          if (prepQueue.length) {
            if (typeof requestIdleCallback === 'function') requestIdleCallback(step, { timeout: 200 });
            else setTimeout(step, 0);
          } else prepDraining = false;
        };
        if (typeof requestIdleCallback === 'function') requestIdleCallback(step, { timeout: 200 });
        else setTimeout(step, 0);
      };
      const queuePrep = (task) => { prepQueue.push(task); drainPrep(); };
      Object.entries(roleToPath).forEach(([role, src]) => {
        const img = new Image();
        ASSETS[role] = {role, src, img, ready:false, error:null, surface:null, grid:null};
        img.onload = () => queuePrep(() => {
          const a = ASSETS[role];
          a.ready = true;
          a.surface = transparentizeDarkBackground(img, role);
          a.grid = detectGrid(img, role);
        });
        img.onerror = () => {
          ASSETS[role].error = `Failed to load ${src}`;
          console.warn('[MUSICIAN visuals] asset load failed', role, src);
        };
        img.src = src;
      });
    }

    function musicianAsset(role) {
      const a = ASSETS[role];
      return a && a.ready && a.surface ? a : null;
    }

    function frameFor(asset, startMs, fpsOverride) {
      const grid = asset.grid || {frames:1, fps:12, loop:true};
      if (grid.frames <= 1) return 0;
      const elapsed = Math.max(0, (performance.now() - (startMs || performance.now())) / 1000);
      const fps = fpsOverride || grid.fps || 16;
      const raw = Math.floor(elapsed * fps);
      return grid.loop ? raw % grid.frames : Math.min(grid.frames - 1, raw);
    }

    function drawSheetFrame(ctx, asset, frameIndex, size, alpha=1, blend='source-over') {
      if (!asset) return false;
      const grid = asset.grid || {cols:1, rows:1, frames:1, cellW:asset.surface.width, cellH:asset.surface.height};
      const safeFrame = Math.min(Math.max(0, frameIndex || 0), (grid.frames || 1) - 1);
      const col = safeFrame % grid.cols;
      const row = Math.floor(safeFrame / grid.cols);
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.globalCompositeOperation = blend;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(
        asset.surface,
        col * grid.cellW, row * grid.cellH, grid.cellW, grid.cellH,
        -size/2, -size/2, size, size
      );
      ctx.restore();
      return true;
    }

    function drawFullAsset(ctx, asset, size, alpha=1, blend='source-over') {
      if (!asset) return false;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.globalCompositeOperation = blend;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(asset.surface, -size/2, -size/2, size, size);
      ctx.restore();
      return true;
    }

    function drawMaskedSheetVfx(ctx, asset, frameIndex, size, alpha=1) {
      if (!asset || !asset.surface || !asset.grid) return false;
      const grid = asset.grid;
      const safeFrame = Math.min(Math.max(0, frameIndex || 0), (grid.frames || 1) - 1);
      const key = `${safeFrame}:${Math.round(size)}`;
      asset.maskedFrameCache ||= {};
      let canvas = asset.maskedFrameCache[key];
      if (!canvas) {
        const col = safeFrame % grid.cols;
        const row = Math.floor(safeFrame / grid.cols);
        canvas = document.createElement('canvas');
        canvas.width = Math.ceil(size);
        canvas.height = Math.ceil(size);
        const mc = canvas.getContext('2d');
        mc.imageSmoothingEnabled = true;
        mc.drawImage(
          asset.surface,
          col * grid.cellW, row * grid.cellH, grid.cellW, grid.cellH,
          0, 0, canvas.width, canvas.height
        );
        mc.save();
        mc.globalCompositeOperation = 'destination-out';
        mc.beginPath();
        mc.ellipse(canvas.width * .5, canvas.height * .5, canvas.width * .34, canvas.height * .40, 0, 0, TAU);
        mc.fill();
        mc.restore();
        asset.maskedFrameCache[key] = canvas;
      }
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(canvas, -size/2, -size/2, size, size);
      ctx.restore();
      return true;
    }

    function musicianFrameStats(asset, frameIndex) {
      if (!asset || !asset.surface || !asset.grid) return {safeBody:false, totalHits:0, centerHits:0};
      asset.frameStats ||= {};
      const key = String(frameIndex);
      if (asset.frameStats[key]) return asset.frameStats[key];
      const grid = asset.grid;
      const frame = Math.min(Math.max(0, frameIndex || 0), (grid.frames || 1) - 1);
      const col = frame % grid.cols;
      const row = Math.floor(frame / grid.cols);
      const sx = Math.floor(col * grid.cellW);
      const sy = Math.floor(row * grid.cellH);
      const sw = Math.floor(grid.cellW);
      const sh = Math.floor(grid.cellH);
      const probe = document.createElement('canvas');
      probe.width = sw;
      probe.height = sh;
      const pc = probe.getContext('2d', {willReadFrequently:true});
      pc.drawImage(asset.surface, sx, sy, sw, sh, 0, 0, sw, sh);
      let totalHits = 0, centerHits = 0;
      let minX = sw, minY = sh, maxX = 0, maxY = 0;
      const cx0 = sw * .28, cx1 = sw * .72, cy0 = sh * .18, cy1 = sh * .82;
      const data = pc.getImageData(0, 0, sw, sh).data;
      const step = 4;
      for (let y=0; y<sh; y+=step) {
        for (let x=0; x<sw; x+=step) {
          const i = (y * sw + x) * 4;
          if (data[i+3] > 28) {
            totalHits++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1) centerHits++;
          }
        }
      }
      const safeBody = centerHits >= 35 && totalHits >= 140;
      const stat = {safeBody, totalHits, centerHits, bbox:{minX,minY,maxX,maxY}};
      asset.frameStats[key] = stat;
      return stat;
    }

    const visualDurations = {
      rageActivation: 1150,
      hit: 340,
      dropChord: 1380,
      soloChord: 1380,
      majorChord: 940,
      minorChord: 940,
      noteShot: 650
    };
    const visualPriority = {
      defeat: 100,
      rageActivation: 90,
      hit: 80,
      dropChord: 70,
      soloChord: 70,
      majorChord: 70,
      minorChord: 70,
      noteShot: 60,
      move: 10,
      battleIdle: 0
    };

    function ensureMusicianVisual(f) {
      if (!f.visual || f.visual.owner !== 'MUSICIAN') {
        f.visual = {
          owner:'MUSICIAN',
          animName:'battleIdle',
          animStart:performance.now(),
          lastHp:f.hp,
          lastRage:!!f.isRage,
          lastChordName:f.data && f.data.chordName,
          lastNoteCount:0,
          lastX:f.x,
          lastY:f.y,
          moving:false
        };
      }
      return f.visual;
    }

    function triggerMusicianVisualEvent(f, animName, force=false) {
      if (!f || f.name !== 'MUSICIAN') return;
      const v = ensureMusicianVisual(f);
      const currentDur = visualDurations[v.animName] || 0;
      const currentActive = currentDur && performance.now() - (v.animStart || 0) < currentDur;
      const incomingPriority = visualPriority[animName] ?? 0;
      const currentPriority = visualPriority[v.animName] ?? 0;
      if (!force && currentActive && incomingPriority < currentPriority) return;
      v.animName = animName;
      v.animStart = performance.now();
    }

    function activeMusicNoteCount(f) {
      return projectiles.filter(p => p && p.type === 'music_note' && p.owner === f && (!p.customLife || p.customLife > 0) && !p._dead).length;
    }

    function detectMusicianVisualEvents(f) {
      const v = ensureMusicianVisual(f);
      const now = performance.now();
      const moved = Math.hypot((f.x || 0) - (v.lastX || f.x || 0), (f.y || 0) - (v.lastY || f.y || 0));
      v.moving = moved > 0.45;

      if (f.hp <= 0) {
        if (v.animName !== 'defeat') triggerMusicianVisualEvent(f, 'defeat');
      } else if (!v.lastRage && f.isRage) {
        triggerMusicianVisualEvent(f, 'rageActivation');
      } else if (Number.isFinite(v.lastHp) && f.hp < v.lastHp - 0.05) {
        triggerMusicianVisualEvent(f, 'hit');
      } else {
        const chordName = f.data && f.data.chordName;
        const chordPulse = f.data && f.data.chordPulse > 0;
        if (chordPulse && chordName && chordName !== v.lastChordName) {
          const map = {MAJOR:'majorChord', MINOR:'minorChord', DROP:'dropChord', SOLO:'soloChord'};
          triggerMusicianVisualEvent(f, map[chordName] || 'noteShot');
        } else {
          const noteCount = activeMusicNoteCount(f);
          if (noteCount > v.lastNoteCount) triggerMusicianVisualEvent(f, 'noteShot');
          v.lastNoteCount = noteCount;
        }
      }

      const dur = visualDurations[v.animName] || 0;
      if (dur && now - v.animStart > dur) v.animName = v.moving ? 'move' : 'battleIdle';
      if (!dur && v.animName !== 'defeat') v.animName = v.moving ? 'move' : 'battleIdle';

      v.lastHp = f.hp;
      v.lastRage = !!f.isRage;
      v.lastChordName = f.data && f.data.chordName;
      v.lastX = f.x;
      v.lastY = f.y;
      return v;
    }

    function musicianRoleForAnim(animName) {
      return {
        move:'move16',
        noteShot:'noteShot16',
        majorChord:'majorChord16',
        minorChord:'minorChord16',
        dropChord:'dropChord32',
        soloChord:'soloChord32',
        rageActivation:'rage32'
      }[animName] || 'battleIdle';
    }

    function drawMusicianVFX(ctx, f, v) {
      return false;
      const r = f.radius || 75;
      const age = Math.max(0, performance.now() - (v.animStart || performance.now()));
      const p = clamp(age / Math.max(1, visualDurations[v.animName] || 700), 0, 1);
      ctx.save();
      ctx.rotate(-Math.atan2(f.dir.y, f.dir.x));
      if (v.animName === 'majorChord') {
        ctx.globalAlpha = .72 * (1-p);
        ctx.strokeStyle = '#44ff8a';
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(0,0,r + 28 + p*120,0,TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(68,255,138,.16)';
        ctx.beginPath(); ctx.arc(0,0,r + 20 + p*130,0,TAU); ctx.fill();
      }
      if (v.animName === 'minorChord') {
        ctx.globalAlpha = .68 * (1-p);
        ctx.strokeStyle = '#8bb8ff';
        ctx.lineWidth = 7;
        ctx.setLineDash([18,12]);
        ctx.beginPath(); ctx.arc(0,0,r + 32 + p*132,0,TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (v.animName === 'dropChord') {
        ctx.globalAlpha = .78 * (1-p);
        ctx.strokeStyle = '#ff4bd8';
        ctx.fillStyle = 'rgba(255,45,210,.14)';
        ctx.lineWidth = 11;
        ctx.beginPath(); ctx.arc(0,0,r + 34 + p*180,0,TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0,0,Math.max(10, r*.6*(1-p)),0,TAU); ctx.stroke();
      }
      if (v.animName === 'soloChord') {
        ctx.globalAlpha = .9 * (1-p);
        ctx.fillStyle = '#e9d7ff';
        ctx.strokeStyle = '#5c2bff';
        ctx.lineWidth = 3;
        ctx.font = `900 ${Math.round(r*.42)}px serif`;
        ctx.textAlign = 'center';
        for (let i=0;i<10;i++) {
          const a = i*TAU/10 + p*2.2;
          const rr = r + 22 + p*170 + (i%2)*15;
          ctx.strokeText(i%2 ? 'Ă¢â„¢Âª' : 'Ă¢â„¢Â«', Math.cos(a)*rr, Math.sin(a)*rr);
          ctx.fillText(i%2 ? 'Ă¢â„¢Âª' : 'Ă¢â„¢Â«', Math.cos(a)*rr, Math.sin(a)*rr);
        }
      }
      if (f.isRage) {
        const t = performance.now()/260;
        ctx.globalAlpha = .54;
        ctx.strokeStyle = '#ffd95b';
        ctx.lineWidth = 4;
        for (let i=0;i<3;i++) {
          ctx.beginPath();
          ctx.arc(0,0,r + 20 + i*12 + Math.sin(t+i)*4,0,TAU);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    function drawMusicianFallback(ctx, f, v, oldDraw) {
      if (typeof oldDraw === 'function') {
        oldDraw(ctx, f);
        return;
      }
      drawPolygon(ctx,[[-48,-56],[28,-64],[68,-12],[32,58],[-52,50],[-70,-6]],'#33210a','#ffd36b',5);
      ctx.strokeStyle='#fff4ba'; ctx.lineWidth=6; ctx.beginPath(); ctx.moveTo(-20,-44); ctx.lineTo(78,-82); ctx.stroke();
      ctx.fillStyle='#fff3bd'; ctx.font='900 20px serif'; ctx.textAlign='center'; ctx.fillText('*',-10,12);
    }

    function drawMusicianActionVfxFrame(ctx, role, v, r) {
      if (!role || role === 'battleIdle') return false;
      const asset = musicianAsset(role);
      if (!asset || !asset.grid || asset.grid.frames <= 1) return false;
      const idx = frameFor(asset, v.animStart);
      const sizeByRole = {
        move16: 2.92,
        noteShot16: 3.02,
        majorChord16: 3.18,
        minorChord16: 3.18,
        dropChord32: 3.38,
        soloChord32: 3.42,
        rage32: 3.36
      };
      const alphaByRole = {
        move16: .42,
        noteShot16: .58,
        majorChord16: .78,
        minorChord16: .76,
        dropChord32: .70,
        soloChord32: .68,
        rage32: .72
      };
      return drawSheetFrame(ctx, asset, idx, r * (sizeByRole[role] || 3.0), alphaByRole[role] ?? .62, 'lighter');
    }

    function musicianAssetWordForState(f, animName) {
      const chord = f && f.data && f.data.chordName;
      if (animName === 'rageActivation') return 'RAGE';
      if (animName === 'dropChord' || chord === 'DROP') return 'DROP';
      if (animName === 'soloChord' || chord === 'SOLO') return 'SOLO';
      if (animName === 'majorChord' || chord === 'MAJOR') return 'HEAL';
      if (animName === 'minorChord' || chord === 'MINOR') return 'SLOW';
      if (animName === 'noteShot') return 'BASS';
      if (f && f.isRage) return 'RAGE';
      return null;
    }

    function drawMusicianAssetWord(ctx, word, r) {
      const asset = musicianAsset('vfxSheet');
      if (!asset || !word) return false;
      // Current vfx sheet contains effect panels only; do not crop fake word art from it.
      return false;
      const crops = {
        BASS: [0, 1025, 210, 140],
        HEAL: [210, 1025, 210, 140],
        SLOW: [420, 1025, 210, 140],
        DROP: [630, 1025, 210, 140],
        SOLO: [840, 1025, 205, 140],
        RAGE: [1045, 1025, 209, 140]
      };
      const c = crops[word];
      if (!c) return false;
      ctx.save();
      ctx.globalAlpha = .92;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(asset.surface, c[0], c[1], c[2], c[3], -r * .74, -r - 58, r * 1.48, r * .56);
      ctx.restore();
      return true;
    }

    function drawMusicianSprite(ctx, f, oldDraw) {
      const v = detectMusicianVisualEvents(f);
      drawMusicianVFX(ctx, f, v);
      const baseAngle = Math.atan2(f.dir.y, f.dir.x);
      ctx.save();
      ctx.rotate(-baseAngle);
      const r = f.radius || 75;
      const animName = v.animName;
      const actionRole = (animName === 'defeat' || animName === 'hit') ? null : musicianRoleForAnim(animName);
      drawMusicianActionVfxFrame(ctx, actionRole, v, r);

      let drawn = false;
      const bodyAsset = musicianAsset('battleIdle');
      if (bodyAsset) drawn = drawFullAsset(ctx, bodyAsset, r * 2.95, animName === 'hit' ? .72 : 1);
      if (!drawn) drawMusicianFallback(ctx, f, v, oldDraw);
      drawMusicianAssetWord(ctx, musicianAssetWordForState(f, animName), r);

      ctx.restore();
    }

    function drawMusicianProjectile(ctx, p, overlay=false) {
      if (!p || p.type !== 'music_note') return;
      if (!overlay) return;
      const asset = musicianAsset('vfxSheet');
      if (!asset) return;
      const assetAngle = Math.atan2(p.vy || 0, p.vx || 1);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(assetAngle);
      ctx.globalAlpha = .92;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(asset.surface, 0, 0, 420, 270, -38, -24, 84, 54);
      ctx.restore();
      return;
      const a = Math.atan2(p.vy || 0, p.vx || 1);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      if (!overlay) {
        ctx.globalAlpha = .34;
        ctx.strokeStyle = p.color || '#b678ff';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(-42, 0);
        ctx.lineTo(-8, 0);
        ctx.stroke();
      } else {
        ctx.globalAlpha = .65;
        ctx.fillStyle = p.color || '#d8b8ff';
        ctx.font = '900 22px serif';
        ctx.textAlign = 'center';
        ctx.fillText('Ă¢â„¢Âª', 8, 7);
      }
      ctx.restore();
    }

    function drawMusicianProjectileLayer(ctx, overlay=false) {
      for (const p of projectiles) {
        if (p && p.type === 'music_note' && p.owner && p.owner.name === 'MUSICIAN') drawMusicianProjectile(ctx, p, overlay);
      }
    }

    preloadMusicianAssets();

    const musicianType = FighterTypes.find(t => t && t.name === 'MUSICIAN');
    if (musicianType && !musicianType.__visualAssetDrawPatched) {
      musicianType.__visualAssetDrawPatched = true;
      const oldMusicianDraw = musicianType.draw;
      musicianType.draw = function(ctx, f) { drawMusicianSprite(ctx, f, oldMusicianDraw); };
    }

    if (!window.__musicianProjectileVisualPatched) {
      window.__musicianProjectileVisualPatched = true;
      const oldDrawProjectilesMusicianVisual = drawProjectiles;
      drawProjectiles = function(ctx) {
        const hiddenMusicNotes = [];
        for (const p of projectiles) {
          if (p && p.type === 'music_note' && p.owner && p.owner.name === 'MUSICIAN') {
            hiddenMusicNotes.push(p);
            p.type = '__music_note_asset_draw';
          }
        }
        oldDrawProjectilesMusicianVisual(ctx);
        for (const p of hiddenMusicNotes) p.type = 'music_note';
        drawMusicianProjectileLayer(ctx, true);
      };
      window.drawProjectiles = drawProjectiles;
    }

    window.triggerMusicianVisualEvent = triggerMusicianVisualEvent;
    window.apexMusicianVisualAssets = ASSETS;
    window.apexMusicianVisualAssetLog = visualLog;
    console.info('[Apex Chaos] MUSICIAN visual assets integrated', visualLog);
  } catch (err) {
    window.apexMusicianVisualError = {message: err && err.message, stack: err && err.stack};
    console.error('[Apex Chaos] MUSICIAN visual integration failed', err);
  }
})();
