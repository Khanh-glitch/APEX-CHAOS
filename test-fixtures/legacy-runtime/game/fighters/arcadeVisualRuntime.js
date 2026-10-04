// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function arcadeVisualAssetIntegration(){
  try {
    const roleToPath = {
      battleIdleReference: 'assets/arcade_v1/normalized/battle_idle_reference.webp',
      idleMove16: 'assets/arcade_v1/normalized/idle_move_16.webp',
      optionalHit16: 'assets/arcade_v1/normalized/optional_hit_16.webp',
      rageJackpot32: 'assets/arcade_v1/normalized/rage_jackpot_32.webp',
      defeatReviveVictory16: 'assets/arcade_v1/normalized/defeat_revive_victory_16.webp',
      propVfxSheet: 'assets/arcade_v1/normalized/prop_vfx_sheet.webp',
      textMultiplierSheet: 'assets/arcade_v1/normalized/text_multiplier_sheet.webp'
    };

    const visualLog = {
      sourceGameFile: 'apex_chaos_musician_visuals.html',
      confirmedMechanics: ['ARCADE_SYMBOLS','arcade_machine','arcade_hammer','arcade_rocket','arcade_bunny','reviveTokens','lastSpin'],
      selectedAssets: {
        battleIdleReference: 'ARCADE ASSET/1b3a4b4a-ac66-42b9-8241-36482cee2af3.webp',
        idleMove16: 'ARCADE ASSET/62f5a00d-c8df-4728-878f-a6702c47905e.webp',
        optionalHit16: 'ARCADE ASSET/c92cfb5d-3518-491b-b85b-ed0c25ffa126.webp',
        rageJackpot32: 'ARCADE ASSET/11c945a6-b7c7-4a5f-823c-823b261de978.webp',
        defeatReviveVictory16: 'ARCADE ASSET/04d09d13-2ba8-4e0c-94b2-158d99ae179f.webp',
        propVfxSheet: 'ARCADE ASSET/dcb8c5b4-8224-41d3-a2b3-319270ab1008.webp',
        textMultiplierSheet: 'ARCADE ASSET/99f2a440-b529-452b-a26d-7f64375235a2.webp'
      },
      notes: [
        'All ARCADE gameplay functions are left intact; this module replaces drawing only.',
        'Concept sheets are cropped by role so labels/frame numbers are not drawn in battle.',
        'Body animation uses fixed frame boxes from 4x4/8x4 grids, anchored at fighter center.',
        'Procedural ARCADE custom projectile drawing is hidden only during render and restored immediately.'
      ],
      grids: {}
    };

    const ASSETS = {};
    const gridHints = {
      idleMove16: {cols:4, rows:4, frames:16, fps:14, loop:true},
      optionalHit16: {cols:4, rows:4, frames:16, fps:18, loop:false},
      rageJackpot32: {cols:8, rows:4, frames:32, fps:18, loop:false},
      defeatReviveVictory16: {cols:4, rows:4, frames:16, fps:12, loop:false}
    };

    const propCrops = {
      MACHINE: [24, 4, 405, 472],
      HAMMER: [455, 58, 280, 420],
      ROCKET: [780, 80, 230, 360],
      BUNNY: [1000, 78, 230, 365],
      SHIELD: [45, 575, 280, 280],
      GLITCH: [390, 575, 300, 255],
      COIN: [635, 555, 275, 285],
      JACKPOT_FLARE: [930, 540, 310, 290],
      ICON_HAMMER: [55, 1015, 135, 140],
      ICON_ROCKET: [220, 1015, 135, 140],
      ICON_BUNNY: [410, 1015, 135, 140],
      ICON_HEART: [585, 1015, 135, 140],
      ICON_SHIELD: [745, 1015, 135, 140],
      ICON_GLITCH: [910, 1015, 135, 140],
      ICON_COIN: [1080, 1015, 135, 140]
    };
    const textCrops = {
      SPIN: [14, 18, 350, 148],
      JACKPOT: [350, 0, 505, 175],
      BUNNY_REVIVE: [845, 22, 390, 135],
      SHIELD: [12, 155, 380, 142],
      GLITCH: [345, 228, 470, 170],
      COIN: [810, 160, 410, 135],
      BONUS: [24, 325, 330, 130],
      X1: [350, 405, 125, 125],
      X2: [475, 405, 125, 125],
      X5: [606, 405, 135, 125],
      SLOT777: [805, 300, 405, 155],
      RING_ORBIT: [0, 560, 315, 270],
      RING_COIN: [318, 830, 310, 280],
      RING_SHIELD: [930, 555, 315, 285],
      RING_GLITCH: [0, 830, 310, 280],
      RING_JACKPOT: [635, 555, 300, 285],
      TILE_STAR: [15, 1122, 95, 95],
      TILE_SEVEN: [118, 1122, 95, 95],
      TILE_DIAMOND: [220, 1122, 95, 95],
      TILE_HEART: [325, 1122, 95, 95],
      TILE_COIN: [430, 1122, 95, 95],
      TILE_BELL: [535, 1122, 95, 95],
      TILE_CHERRY: [640, 1122, 95, 95],
      TILE_BUNNY: [760, 1110, 110, 110],
      TILE_SHIELD: [875, 1122, 95, 95],
      TILE_GLITCH: [980, 1122, 95, 95],
      TILE_WILD: [1085, 1110, 120, 110]
    };
    const symbolToCrop = {
      HAMMER: 'ICON_HAMMER',
      ROCKET: 'ICON_ROCKET',
      BUNNY: 'ICON_BUNNY',
      HEART: 'ICON_HEART',
      SHIELD: 'ICON_SHIELD',
      GLITCH: 'ICON_GLITCH',
      COIN: 'ICON_COIN'
    };
    const symbolToTile = {
      HAMMER: 'TILE_STAR',
      ROCKET: 'TILE_SEVEN',
      BUNNY: 'TILE_BUNNY',
      HEART: 'TILE_HEART',
      SHIELD: 'TILE_SHIELD',
      GLITCH: 'TILE_GLITCH',
      COIN: 'TILE_COIN'
    };
    const fallbackSymbols = [
      {key:'HAMMER', icon:'H', color:'#ffd36b'},
      {key:'ROCKET', icon:'R', color:'#ff6b4a'},
      {key:'BUNNY', icon:'B', color:'#ffffff'},
      {key:'HEART', icon:'H', color:'#ff85c7'},
      {key:'SHIELD', icon:'S', color:'#78d7ff'},
      {key:'GLITCH', icon:'G', color:'#9cff5b'},
      {key:'COIN', icon:'$', color:'#ffe66e'}
    ];

    function arcadeSymbolsForVisual() {
      return typeof ARCADE_SYMBOLS !== 'undefined' ? ARCADE_SYMBOLS : fallbackSymbols;
    }

    function arcadeCustomAlpha(p) {
      return p && p.customLife === Infinity ? 1 : clamp((p && p.customLife || 0) / Math.max(.001, p && p.maxCustomLife || 1), 0, 1);
    }

    function arcadeEnemyOf(owner) {
      return fighters.find(f => f && owner && f.id !== owner.id && f.hp > 0) || fighters.find(f => f && f !== owner && f.hp > 0) || null;
    }

    function arcadeResultInfo(result) {
      const groups = {};
      for (const s of result || []) groups[s.key] = (groups[s.key] || 0) + 1;
      const maxCount = Math.max(0, ...Object.values(groups));
      const topKey = Object.keys(groups).sort((a,b) => groups[b] - groups[a])[0] || null;
      return {groups, maxCount, topKey, multiplier:maxCount >= 3 ? 5 : maxCount === 2 ? 2 : 1};
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
          if (max < 50 && chroma < 34) px[i+3] = 0;
          else if (max < 78 && chroma < 28) px[i+3] = Math.max(0, (max - 50) * 8);
        }
        c.putImageData(data, 0, 0);
      } catch (err) {
        console.warn('[ARCADE visuals] dark-background processing skipped for', role, err);
      }
      return canvas;
    }

    function detectGrid(img, role) {
      const hint = gridHints[role];
      if (!hint) {
        visualLog.grids[role] = 'single full image';
        return {cols:1, rows:1, frames:1, fps:8, loop:false, cellW:img.naturalWidth, cellH:img.naturalHeight};
      }
      const grid = {...hint, cellW:img.naturalWidth / hint.cols, cellH:img.naturalHeight / hint.rows};
      visualLog.grids[role] = `${grid.cols}x${grid.rows}, ${grid.frames} frames`;
      return grid;
    }

    function preloadArcadeAssets() {
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
      const queuePrep = (role) => {
        prepQueue.push(() => {
          const a = ASSETS[role];
          const img = a && a.img;
          if (!img || a.ready) return;
          a.ready = true;
          a.surface = transparentizeDarkBackground(img, role);
          a.grid = detectGrid(img, role);
        });
        drainPrep();
      };
      Object.entries(roleToPath).forEach(([role, src]) => {
        const img = new Image();
        ASSETS[role] = {role, src, img, ready:false, error:null, surface:null, grid:null};
        img.onload = () => { queuePrep(role); };
        img.onerror = () => {
          ASSETS[role].error = `Failed to load ${src}`;
          console.warn('[ARCADE visuals] asset load failed', role, src);
        };
        img.src = src;
      });
    }

    function arcadeAsset(role) {
      const a = ASSETS[role];
      return a && a.ready && a.surface ? a : null;
    }

    function frameFor(asset, startMs, fpsOverride) {
      const grid = asset.grid || {frames:1, fps:12, loop:true};
      if (grid.frames <= 1) return 0;
      const elapsed = Math.max(0, (performance.now() - (startMs || performance.now())) / 1000);
      const raw = Math.floor(elapsed * (fpsOverride || grid.fps || 12));
      return grid.loop ? raw % grid.frames : Math.min(grid.frames - 1, raw);
    }

    function drawCrop(ctx, assetRole, crop, x, y, w, h, alpha=1, blend='source-over') {
      const asset = arcadeAsset(assetRole);
      if (!asset || !crop) return false;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.globalCompositeOperation = blend;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(asset.surface, crop[0], crop[1], crop[2], crop[3], x, y, w, h);
      ctx.restore();
      return true;
    }

    function drawSheetFrame(ctx, asset, frameIndex, size, alpha=1, blend='source-over', yOffset=0) {
      if (!asset || !asset.grid) return false;
      const grid = asset.grid;
      const safe = Math.min(Math.max(0, frameIndex || 0), (grid.frames || 1) - 1);
      const col = safe % grid.cols;
      const row = Math.floor(safe / grid.cols);
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.globalCompositeOperation = blend;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(asset.surface, col*grid.cellW, row*grid.cellH, grid.cellW, grid.cellH, -size/2, -size/2 + yOffset, size, size);
      ctx.restore();
      return true;
    }

    function drawFullAsset(ctx, asset, size, alpha=1, yOffset=0) {
      if (!asset) return false;
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(asset.surface, -size/2, -size/2 + yOffset, size, size);
      ctx.restore();
      return true;
    }

    function ensureArcadeVisual(f) {
      if (!f.visual || f.visual.owner !== 'ARCADE') {
        f.visual = {
          owner:'ARCADE',
          animName:'idle',
          animStart:performance.now(),
          text:null,
          textStart:0,
          lastHp:f.hp,
          lastRage:!!f.isRage,
          lastSpin:f.data && f.data.lastSpin,
          lastReviveTokens:f.data && f.data.reviveTokens || 0,
          lastMachineCount:0
        };
      }
      return f.visual;
    }

    function triggerArcadeVisualEvent(f, animName, text) {
      if (!f || f.name !== 'ARCADE') return;
      const v = ensureArcadeVisual(f);
      v.animName = animName || 'idle';
      v.animStart = performance.now();
      if (text) {
        v.text = text;
        v.textStart = performance.now();
      }
    }

    function detectArcadeVisualState(f) {
      const v = ensureArcadeVisual(f);
      const machineCount = projectiles.filter(p => p && p.type === 'arcade_machine' && p.owner === f).length;
      if (!v.lastRage && f.isRage) triggerArcadeVisualEvent(f, 'rage', 'RAGE');
      else if ((f.data.reviveTokens || 0) < (v.lastReviveTokens || 0) && f.hp > 0) triggerArcadeVisualEvent(f, 'revive', 'BUNNY_REVIVE');
      else if (Number.isFinite(v.lastHp) && f.hp < v.lastHp - 0.1) triggerArcadeVisualEvent(f, 'hit');
      else if (machineCount > v.lastMachineCount) triggerArcadeVisualEvent(f, 'spin');
      else if ((f.data.lastSpin || '') !== (v.lastSpin || '') && f.data.lastSpin && f.data.lastSpin !== '---') {
        const parts = String(f.data.lastSpin || '').trim().split(/\s+/).filter(Boolean);
        const groups = {};
        for (const part of parts) groups[part] = (groups[part] || 0) + 1;
        const maxCount = Math.max(0, ...Object.values(groups));
        if (maxCount >= 3) triggerArcadeVisualEvent(f, 'jackpot', 'JACKPOT');
        else if (maxCount === 2) triggerArcadeVisualEvent(f, 'spin', 'X2');
        else triggerArcadeVisualEvent(f, 'spin', 'X1');
      }

      const age = performance.now() - (v.animStart || 0);
      const dur = {rage:1750, revive:1600, hit:430, spin:900, jackpot:1300}[v.animName] || 0;
      if (dur && age > dur) v.animName = 'idle';

      v.lastHp = f.hp;
      v.lastRage = !!f.isRage;
      v.lastSpin = f.data && f.data.lastSpin;
      v.lastReviveTokens = f.data && f.data.reviveTokens || 0;
      v.lastMachineCount = machineCount;
      return v;
    }

    function drawArcadeTextSprite(ctx, key, y, scale=1) {
      const crop = textCrops[key];
      if (!crop) return false;
      const isMultiplier = /^X[125]$/.test(key);
      const w = isMultiplier ? crop[2] * .95 * scale : Math.min(260, crop[2] * .52 * scale);
      const h = w * crop[3] / crop[2];
      return drawCrop(ctx, 'textMultiplierSheet', crop, -w/2, y - h/2, w, h, .96, 'source-over');
    }

    function drawArcadeTextSpriteAt(ctx, key, x, y, scale=1) {
      ctx.save();
      ctx.translate(x, 0);
      const ok = drawArcadeTextSprite(ctx, key, y, scale);
      ctx.restore();
      return ok;
    }

    function drawArcadeCleanLabel(ctx, key, y, scale=1) {
      const pretty = {
        X1:'x1', X2:'x2', X5:'x5',
        RAGE:'RAGE',
        SPIN:'SPIN',
        JACKPOT:'JACKPOT',
        BUNNY_REVIVE:'BUNNY REVIVE',
        SHIELD:'SHIELD',
        GLITCH:'GLITCH',
        COIN:'COIN',
        BONUS:'BONUS'
      }[key] || String(key || '');
      const color = key === 'X5' || key === 'JACKPOT' || key === 'COIN'
        ? '#ffd95b'
        : key === 'X2' || key === 'BUNNY_REVIVE' || key === 'GLITCH'
          ? '#ff7cff'
          : key === 'SHIELD'
            ? '#78d7ff'
            : '#75f0ff';
      const isWord = !/^X[125]$/.test(key);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.round((isWord ? 24 : 34)*scale)}px monospace`;
      ctx.lineWidth = Math.max(4, 7*scale);
      ctx.strokeStyle = '#08040f';
      ctx.shadowColor = color;
      ctx.shadowBlur = 16 * scale;
      ctx.fillStyle = color;
      ctx.strokeText(pretty, 0, y);
      ctx.fillText(pretty, 0, y);
      ctx.restore();
      return true;
    }

    function drawArcadeSymbolIcon(ctx, symbol, x, y, size=34, useTile=false) {
      const key = symbol && symbol.key;
      const cropKey = useTile ? symbolToTile[key] : symbolToCrop[key];
      const crop = (useTile ? textCrops : propCrops)[cropKey];
      if (crop && drawCrop(ctx, useTile ? 'textMultiplierSheet' : 'propVfxSheet', crop, x-size/2, y-size/2, size, size, .98)) return true;
      ctx.save();
      ctx.fillStyle = symbol && symbol.color || '#fff';
      ctx.strokeStyle = '#050505';
      ctx.lineWidth = 4;
      ctx.font = `900 ${Math.round(size*.55)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(symbol && symbol.icon || '?', x, y);
      ctx.fillText(symbol && symbol.icon || '?', x, y);
      ctx.restore();
      return false;
    }

    function arcadeMultiplierKey(info) {
      return info.maxCount >= 3 ? 'X5' : info.maxCount === 2 ? 'X2' : 'X1';
    }

    function drawArcadeResultBanner(ctx, result, y=-128, scale=1) {
      if (!result || !result.length) return;
      const info = arcadeResultInfo(result);
      const multKey = arcadeMultiplierKey(info);
      const labelKey = textCrops[info.topKey] ? info.topKey : null;
      const iconSize = 38 * scale;
      ctx.save();
      if (info.maxCount >= 3) {
        drawArcadeTextSprite(ctx, 'JACKPOT', y - 62 * scale, .50 * scale);
        drawArcadeTextSprite(ctx, 'X5', y - 22 * scale, .48 * scale);
        for (let i=0; i<3; i++) {
          const x = (i - 1) * 48 * scale;
          drawArcadeSymbolIcon(ctx, result[i], x, y + 30 * scale, iconSize, false);
        }
        ctx.restore();
        return;
      }

      if (labelKey) drawArcadeTextSprite(ctx, labelKey, y - 60 * scale, .48 * scale);
      drawArcadeTextSprite(ctx, multKey, y - 22 * scale, .44 * scale);

      if (info.maxCount === 2) {
        const matched = result.filter(s => s && s.key === info.topKey);
        const other = result.find(s => s && s.key !== info.topKey);
        const pairY = y + 24 * scale;
        drawArcadeSymbolIcon(ctx, matched[0], -24 * scale, pairY, iconSize, false);
        drawArcadeSymbolIcon(ctx, matched[1] || matched[0], 24 * scale, pairY, iconSize, false);
        if (other) {
          ctx.save();
          ctx.globalAlpha = .62;
          drawArcadeSymbolIcon(ctx, other, 70 * scale, pairY + 2 * scale, iconSize * .68, false);
          ctx.restore();
        }
        ctx.restore();
        return;
      }

      for (let i=0; i<3; i++) {
        const x = (i - 1) * 44 * scale;
        ctx.save();
        ctx.globalAlpha = .96;
        ctx.shadowColor = '#75f0ff';
        ctx.shadowBlur = 12 * scale;
        drawArcadeSymbolIcon(ctx, result[i], x, y + 24 * scale, iconSize, false);
        ctx.restore();
      }
      ctx.restore();
    }

    function drawArcadeStatusVfx(ctx, f, v, r) {
      if (f.hasStatus && f.hasStatus('immune')) {
        drawCrop(ctx, 'textMultiplierSheet', textCrops.RING_SHIELD, -r*1.75, -r*1.75, r*3.5, r*3.5, .58, 'lighter');
        drawArcadeTextSprite(ctx, 'SHIELD', r + 34, .55);
      }
      if (f.isRage || v.animName === 'rage' || v.animName === 'jackpot') {
        if (v.animName === 'jackpot') drawCrop(ctx, 'textMultiplierSheet', textCrops.RING_COIN, -r*1.6, -r*1.45, r*3.2, r*2.9, .42, 'lighter');
      }
    }

    function drawArcadeBody(ctx, f, v, oldDraw) {
      const r = f.radius || 75;
      const baseAngle = Math.atan2(f.dir.y, f.dir.x);
      ctx.save();
      ctx.rotate(-baseAngle);
      drawArcadeStatusVfx(ctx, f, v, r);

      let drawn = false;
      if (f.hp <= 0 || v.animName === 'revive') {
        const asset = arcadeAsset('defeatReviveVictory16');
        const idx = v.animName === 'revive' ? Math.min(15, 8 + frameFor(asset, v.animStart, 8) % 8) : Math.min(7, frameFor(asset, v.animStart, 9));
        drawn = drawSheetFrame(ctx, asset, idx, r*2.84, 1, 'source-over');
      } else if (v.animName === 'rage' || v.animName === 'jackpot') {
        const asset = arcadeAsset('rageJackpot32');
        const idx = frameFor(asset, v.animStart, 18);
        drawSheetFrame(ctx, asset, idx, r*3.15, .72, 'lighter');
        drawn = drawFullAsset(ctx, arcadeAsset('battleIdleReference'), r*2.88, 1);
      } else if (v.animName === 'hit') {
        const pulse = .68 + .22*Math.sin((performance.now() - v.animStart) / 45);
        drawn = drawFullAsset(ctx, arcadeAsset('battleIdleReference'), r*2.86, pulse);
      } else {
        drawn = drawFullAsset(ctx, arcadeAsset('battleIdleReference'), r*2.86, 1);
      }
      if (!drawn) drawn = drawFullAsset(ctx, arcadeAsset('battleIdleReference'), r*2.82, 1);
      if (!drawn && typeof oldDraw === 'function') oldDraw(ctx, f);

      const textAge = performance.now() - (v.textStart || 0);
      if (v.text && textAge < 1200 && !/^X[125]$/.test(v.text)) {
        if (v.text === 'BUNNY_REVIVE') drawArcadeTextSprite(ctx, 'BUNNY_REVIVE', r + 42, .56);
        else if (textCrops[v.text]) drawArcadeTextSprite(ctx, v.text, v.text === 'RAGE' ? -r - 66 : r + 38, .56);
        else if (v.text === 'RAGE') drawArcadeCleanLabel(ctx, 'RAGE', -r - 66, .82);
      }
      ctx.restore();
    }

    function drawArcadeMachine(ctx, p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      const rollProgress = clamp(1 - Math.max(0, p.rollTimer || 0) / 1.25, 0, 1);
      const nearTop = p.y < 175;
      drawCrop(ctx, 'propVfxSheet', propCrops.MACHINE, -95, -112, 190, 222, .97);
      ctx.save();
      ctx.fillStyle = 'rgba(3,6,13,.96)';
      ctx.strokeStyle = 'rgba(255,215,105,.78)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(-49, 10, 102, 48, 8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      if (!p.result && p.rollTimer > 0) drawArcadeTextSprite(ctx, 'SPIN', nearTop ? 125 : -128, .68);
      const reelY = 34;
      const spin = Math.floor(performance.now()/90);
      const symbols = arcadeSymbolsForVisual();
      const res = p.result || [0,1,2].map(i => symbols[(spin + i*2) % symbols.length]);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-47, 12, 98, 44, 7);
      ctx.clip();
      for (let i=0; i<3; i++) drawArcadeSymbolIcon(ctx, res[i], -30 + i*31, reelY, 28, true);
      ctx.restore();
      if (p.result) {
        drawArcadeResultBanner(ctx, p.result, nearTop ? 142 : -142, .98);
      } else {
        // The SPIN word and animated reel carry the rolling state; avoid broad VFX crops here
        // because several source sheets include dark rectangular padding.
      }
      ctx.restore();
    }

    function drawArcadeResolvedSkillVfx(ctx, p) {
      if (!p || !p.result || !p.owner) return false;
      const info = arcadeResultInfo(p.result);
      const owner = p.owner;
      const target = p.targetId !== undefined ? fighters.find(f => f.id === p.targetId) : arcadeEnemyOf(owner);
      const age = Math.max(0, (p.maxCustomLife || 1.6) - (p.customLife || 0));
      const a = clamp((p.customLife || 0) / Math.max(.001, p.maxCustomLife || 1.6), 0, 1);
      const key = info.topKey;
      const dest = key === 'HEART' || key === 'SHIELD' || key === 'BUNNY'
        ? {x:owner.x, y:owner.y}
        : (target ? {x:target.x, y:target.y} : {x:p.x, y:p.y});
      const travel = smoothstep(clamp(age / .72, 0, 1));
      const mx = lerp(p.x, dest.x, travel);
      const my = lerp(p.y, dest.y, travel);
      const nearTop = dest.y < 185;

      ctx.save();
      ctx.translate(mx, my);
      const pulse = 1 + .12*Math.sin(age*20);
      ctx.scale(pulse, pulse);
      if (info.maxCount >= 3) {
        drawCrop(ctx, 'propVfxSheet', propCrops.COIN, -128, -108, 256, 206, .82*a, 'lighter');
      } else if (key === 'HAMMER') {
        ctx.rotate(-.35 + .45*Math.sin(age*9));
        drawCrop(ctx, 'propVfxSheet', propCrops.HAMMER, -72, -112, 144, 168, .88*a, 'source-over');
      } else if (key === 'ROCKET') {
        ctx.rotate(Math.atan2(dest.y - p.y, dest.x - p.x) + Math.PI / 2);
        drawCrop(ctx, 'propVfxSheet', propCrops.ROCKET, -58, -92, 116, 168, .90*a, 'lighter');
      } else if (key === 'BUNNY') {
        drawCrop(ctx, 'propVfxSheet', propCrops.BUNNY, -58, -78, 116, 124, .88*a, 'source-over');
      } else if (key === 'HEART') {
        drawCrop(ctx, 'textMultiplierSheet', textCrops.RING_JACKPOT, -106, -98, 212, 196, .50*a, 'lighter');
        drawArcadeSymbolIcon(ctx, {key:'HEART', icon:'H', color:'#ff85c7'}, 0, -8, 92, false);
      } else if (key === 'SHIELD') {
        drawCrop(ctx, 'propVfxSheet', propCrops.SHIELD, -108, -110, 216, 216, .72*a, 'lighter');
      } else if (key === 'GLITCH') {
        drawCrop(ctx, 'propVfxSheet', propCrops.GLITCH, -122, -92, 244, 176, .80*a, 'lighter');
      } else if (key === 'COIN') {
        drawCrop(ctx, 'propVfxSheet', propCrops.COIN, -118, -96, 236, 190, .82*a, 'lighter');
      }
      ctx.restore();
      return true;
    }

    function drawArcadeProjectile(ctx, p) {
      if (!p) return;
      if (p.type === 'arcade_machine') return drawArcadeMachine(ctx, p);
      if (p.type === 'arcade_hammer') {
        const a = arcadeCustomAlpha(p);
        ctx.save();
        ctx.translate(p.x, p.y - 105*a);
        ctx.rotate(-.28);
        drawCrop(ctx, 'propVfxSheet', propCrops.HAMMER, -60, -70, 120, 135, .98);
        ctx.restore();
        return;
      }
      if (p.type === 'arcade_rocket') {
        const ang = Math.atan2(p.vy || 0, p.vx || 1);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang + Math.PI / 2);
        drawCrop(ctx, 'propVfxSheet', propCrops.ROCKET, -32, -58, 64, 104, .98);
        ctx.restore();
        return;
      }
      if (p.type === 'arcade_bunny') {
        ctx.save();
        ctx.translate(p.x, p.y);
        drawCrop(ctx, 'propVfxSheet', propCrops.BUNNY, -34, -42, 68, 76, .98);
        ctx.restore();
      }
    }

    function drawArcadeProjectileLayer(ctx) {
      for (const p of projectiles) {
        if (p && p.apexCustom && /^arcade_/.test(p.type)) {
          if (p.type === 'arcade_machine' && p.resolved) drawArcadeResolvedSkillVfx(ctx, p);
          drawArcadeProjectile(ctx, p);
        }
      }
    }

    preloadArcadeAssets();

    const arcadeType = FighterTypes.find(t => t && t.name === 'ARCADE');
    if (arcadeType && !arcadeType.__visualAssetDrawPatched) {
      arcadeType.__visualAssetDrawPatched = true;
      const oldArcadeDraw = arcadeType.draw;
      arcadeType.draw = function(ctx, f) {
        const v = detectArcadeVisualState(f);
        drawArcadeBody(ctx, f, v, oldArcadeDraw);
      };
      const oldArcadeTakeDamage = arcadeType.onTakeDamage;
      arcadeType.onTakeDamage = function(f, amount, src, label) {
        const before = f && f.data ? (f.data.reviveTokens || 0) : 0;
        const result = oldArcadeTakeDamage && oldArcadeTakeDamage(f, amount, src, label);
        const after = f && f.data ? (f.data.reviveTokens || 0) : 0;
        if (before > after && f && f.hp > 0) triggerArcadeVisualEvent(f, 'revive', 'BUNNY_REVIVE');
        return result;
      };
    }

    if (!window.__arcadeProjectileVisualPatched) {
      window.__arcadeProjectileVisualPatched = true;
      const oldDrawProjectilesArcadeVisual = drawProjectiles;
      drawProjectiles = function(ctx) {
        const hiddenArcade = [];
        for (const p of projectiles) {
          if (p && p.apexCustom && /^arcade_/.test(p.type)) {
            hiddenArcade.push([p, p.type]);
            p.type = '__arcade_asset_draw';
          }
        }
        oldDrawProjectilesArcadeVisual(ctx);
        for (const pair of hiddenArcade) pair[0].type = pair[1];
        drawArcadeProjectileLayer(ctx);
      };
      window.drawProjectiles = drawProjectiles;
    }

    if (typeof FloatingText !== 'undefined' && !FloatingText.prototype.__arcadeSpecialTextFiltered) {
      FloatingText.prototype.__arcadeSpecialTextFiltered = true;
      const oldFloatingTextDrawArcade = FloatingText.prototype.draw;
      FloatingText.prototype.draw = function(ctx) {
        const text = String(this.text || '');
        if (/^(SPIN|BUNNY REVIVE|JACKPOT|HAMMER|ROCKET|BUNNY|HEART|SHIELD|GLITCH|COIN)\b/.test(text)) return;
        return oldFloatingTextDrawArcade.call(this, ctx);
      };
    }

    window.triggerArcadeVisualEvent = triggerArcadeVisualEvent;
    window.apexArcadeVisualAssets = ASSETS;
    window.apexArcadeVisualAssetLog = visualLog;
    console.info('[Apex Chaos] ARCADE visual assets integrated', visualLog);
  } catch (err) {
    window.apexArcadeVisualError = {message: err && err.message, stack: err && err.stack};
    console.error('[Apex Chaos] ARCADE visual integration failed', err);
  }
})();
