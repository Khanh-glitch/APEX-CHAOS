// APEX CONTROL currently reuses the Manual Lab runtime shell and controller path.
(function APEX_MANUAL_LAB_MODE(){
  if (window.__apexManualLabMode) return;
  window.__apexManualLabMode = true;

  const CONTROL_RUNTIME_MAP_URL = '/assets/control_map/apex_control_runtime_map.json';
  function loadControlRuntimeMap() {
    try {
      const request = new XMLHttpRequest();
      request.open('GET', CONTROL_RUNTIME_MAP_URL, false);
      request.send(null);
      if (request.status >= 200 && request.status < 300 && request.responseText) return JSON.parse(request.responseText);
    } catch (error) {
      console.warn('[APEX CONTROL] Failed to load runtime map export.', error);
    }
    return null;
  }
  const CONTROL_RUNTIME_MAP_RAW = loadControlRuntimeMap();
  const CONTROL_RAW_COORD_SCALE = (CONTROL_RUNTIME_MAP_RAW?.world?.width || 3000) / 3000;
  const CONTROL_MAP_SCALE = (CONTROL_RUNTIME_MAP_RAW?.world?.width || 3000) <= 3200 ? 2 : 1;
  const CONTROL_WORLD_COORD_SCALE = CONTROL_RAW_COORD_SCALE * CONTROL_MAP_SCALE;
  const S = value => value * CONTROL_WORLD_COORD_SCALE;
  function scaleControlRuntimeMap(map, scale) {
    if (!map || scale === 1) return map;
    const coordinateKeys = new Set(['x','y','w','h','width','height','centerX','centerY','minX','minY','maxX','maxY']);
    const visit = value => {
      if (Array.isArray(value)) return value.map(visit);
      if (!value || typeof value !== 'object') return value;
      const out = {};
      for (const [key, item] of Object.entries(value)) {
        out[key] = coordinateKeys.has(key) && Number.isFinite(item) ? item * scale : visit(item);
      }
      return out;
    };
    return visit(map);
  }
  const CONTROL_RUNTIME_MAP = scaleControlRuntimeMap(CONTROL_RUNTIME_MAP_RAW, CONTROL_MAP_SCALE);
  function boundsFromPoints(points) {
    const xs = (points || []).map(p => p.x).filter(Number.isFinite);
    const ys = (points || []).map(p => p.y).filter(Number.isFinite);
    if (!xs.length || !ys.length) return {x:0,y:0,w:0,h:0};
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return {x:minX,y:minY,w:maxX-minX,h:maxY-minY};
  }
  function pointFromMarker(marker, fallback) {
    if (!marker) return fallback;
    if (Number.isFinite(marker.x) && Number.isFinite(marker.y)) return {x:marker.x,y:marker.y};
    const b = marker.bounds || marker;
    return {x:(b.x || 0) + (b.w || 0) / 2, y:(b.y || 0) + (b.h || 0) / 2};
  }
  function markerByZoneRole(list, zoneId, role) {
    return (list || []).find(item => item.zoneId === zoneId || item.role === role) || null;
  }
  function runtimeZoneBounds(zoneId) {
    const zone = (CONTROL_RUNTIME_MAP?.activeZones || []).find(item => item.zoneId === zoneId)
      || (CONTROL_RUNTIME_MAP?.captureZones || []).find(item => item.zoneId === zoneId);
    return zone?.worldPoints ? boundsFromPoints(zone.worldPoints) : null;
  }

  const APEX_CONTROL_WORLD = Object.freeze({
    width:CONTROL_RUNTIME_MAP?.world?.width || S(3000),
    height:CONTROL_RUNTIME_MAP?.world?.height || S(3000),
    centerX:CONTROL_RUNTIME_MAP?.world?.centerX || S(1500),
    centerY:CONTROL_RUNTIME_MAP?.world?.centerY || S(1500)
  });
  const NEUTRAL_CORE = Object.freeze({ x:S(1320), y:S(1320), w:S(360), h:S(360) });
  const NEUTRAL_VERTICAL_LANE = Object.freeze({ x:S(1320), y:0, w:S(360), h:APEX_CONTROL_WORLD.height });
  const NEUTRAL_HORIZONTAL_LANE = Object.freeze({ x:0, y:S(1320), w:APEX_CONTROL_WORLD.width, h:S(360) });
  const TERRITORY_ROOMS = Object.freeze({
    p1Base:runtimeZoneBounds('p1Base') || { x:0, y:0, w:S(1500), h:S(1500) },
    topRightSpecial:runtimeZoneBounds('topRightSpecial') || { x:S(1500), y:0, w:S(1500), h:S(1500) },
    bottomLeftSpecial:runtimeZoneBounds('bottomLeftSpecial') || { x:0, y:S(1500), w:S(1500), h:S(1500) },
    p2Base:runtimeZoneBounds('p2Base') || { x:S(1500), y:S(1500), w:S(1500), h:S(1500) }
  });
  const WALL_THICKNESS = S(50);
  const DOOR_WIDTH = S(240);
  const DOOR_NO_BUILD_PADDING = S(80);
  const SPAWN_NO_BUILD_RADIUS = S(120);
  const CAPTURE_RADIUS = S(480);
  const DOORS = Object.freeze({});
  const CAPTURE_CORNERS = Object.freeze({
    p1Base:{ originX:S(750), originY:S(750), radius:CAPTURE_RADIUS },
    topRightSpecial:{ originX:S(2250), originY:S(750), radius:CAPTURE_RADIUS },
    bottomLeftSpecial:{ originX:S(750), originY:S(2250), radius:CAPTURE_RADIUS },
    p2Base:{ originX:S(2250), originY:S(2250), radius:CAPTURE_RADIUS }
  });
  const SPAWN_POINTS = Object.freeze({
    p1Base:pointFromMarker(markerByZoneRole(CONTROL_RUNTIME_MAP?.spawnPoints, 'p1Base', 'p1'), { x:S(427), y:S(515) }),
    topRightSpecial:pointFromMarker(markerByZoneRole(CONTROL_RUNTIME_MAP?.spawnPoints, 'topRightSpecial', 'heal'), { x:S(2571), y:S(515) }),
    bottomLeftSpecial:pointFromMarker(markerByZoneRole(CONTROL_RUNTIME_MAP?.spawnPoints, 'bottomLeftSpecial', 'rage'), { x:S(427), y:S(2494) }),
    p2Base:pointFromMarker(markerByZoneRole(CONTROL_RUNTIME_MAP?.spawnPoints, 'p2Base', 'p2'), { x:S(2585), y:S(2503) })
  });
  function makeWallSegments() {
    if (CONTROL_RUNTIME_MAP?.walls?.length) {
      return Object.freeze(CONTROL_RUNTIME_MAP.walls.map(wall => ({
        id:wall.id,
        kind:'polygon',
        note:wall.note || '',
        zoneId:wall.zoneId || null,
        worldPoints:wall.worldPoints || [],
        ...boundsFromPoints(wall.worldPoints || [])
      })));
    }
    const t = WALL_THICKNESS;
    const half = t / 2;
    const vertical = (x, y1, y2, id) => ({ id, x:x-half, y:y1, w:t, h:y2-y1, axis:'vertical' });
    const horizontal = (y, x1, x2, id) => ({ id, x:x1, y:y-half, w:x2-x1, h:t, axis:'horizontal' });
    return Object.freeze([
      vertical(S(1020), 0, S(390), 'p1Base-east-a'),
      vertical(S(1020), S(630), S(1020), 'p1Base-east-b'),
      horizontal(S(1020), 0, S(390), 'p1Base-south-a'),
      horizontal(S(1020), S(630), S(1020), 'p1Base-south-b'),
      vertical(S(1380), 0, S(390), 'topRightSpecial-west-a'),
      vertical(S(1380), S(630), S(1020), 'topRightSpecial-west-b'),
      horizontal(S(1020), S(1380), S(1770), 'topRightSpecial-south-a'),
      horizontal(S(1020), S(2010), S(2400), 'topRightSpecial-south-b'),
      vertical(S(1020), S(1380), S(1770), 'bottomLeftSpecial-east-a'),
      vertical(S(1020), S(2010), S(2400), 'bottomLeftSpecial-east-b'),
      horizontal(S(1380), 0, S(390), 'bottomLeftSpecial-north-a'),
      horizontal(S(1380), S(630), S(1020), 'bottomLeftSpecial-north-b'),
      vertical(S(1380), S(1380), S(1770), 'p2Base-west-a'),
      vertical(S(1380), S(2010), S(2400), 'p2Base-west-b'),
      horizontal(S(1380), S(1380), S(1770), 'p2Base-north-a'),
      horizontal(S(1380), S(2010), S(2400), 'p2Base-north-b')
    ]);
  }
  const WALL_SEGMENTS = makeWallSegments();
  function shapeBounds(shape) {
    if (!shape) return {x:0,y:0,w:0,h:0};
    if (shape.worldPoints?.length) return shape.__controlBounds || (shape.__controlBounds = boundsFromPoints(shape.worldPoints));
    return shape;
  }
  function boundsIntersects(a, b) {
    return !!a && !!b && a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
  }
  function expandedBoundsForSegment(x1, y1, x2, y2, padding=0) {
    const minX = Math.min(x1, x2) - padding;
    const minY = Math.min(y1, y2) - padding;
    return {x:minX, y:minY, w:Math.abs(x2 - x1) + padding * 2, h:Math.abs(y2 - y1) + padding * 2};
  }
  function expandedBoundsForCircle(circle, padding=0) {
    const r = (circle?.radius || 0) + padding;
    return {x:(circle?.x || 0) - r, y:(circle?.y || 0) - r, w:r * 2, h:r * 2};
  }
  const WALL_GRID_SIZE = Math.max(420, S(420));
  function buildWallSpatialIndex(walls) {
    const cells = new Map();
    const bounds = new Map();
    const addCell = (key, wall) => {
      let list = cells.get(key);
      if (!list) cells.set(key, list = []);
      list.push(wall);
    };
    for (const wall of walls || []) {
      const b = shapeBounds(wall);
      bounds.set(wall, b);
      const x0 = Math.floor(b.x / WALL_GRID_SIZE), x1 = Math.floor((b.x + b.w) / WALL_GRID_SIZE);
      const y0 = Math.floor(b.y / WALL_GRID_SIZE), y1 = Math.floor((b.y + b.h) / WALL_GRID_SIZE);
      for (let gx = x0; gx <= x1; gx += 1) for (let gy = y0; gy <= y1; gy += 1) addCell(`${gx},${gy}`, wall);
    }
    return {cells, bounds};
  }
  const WALL_SPATIAL_INDEX = buildWallSpatialIndex(WALL_SEGMENTS);
  const WALL_VISIT_STAMPS = new WeakMap();
  let WALL_VISIT_STAMP = 1;
  function forEachWallCandidate(bounds, includeLocked=true, visitor=()=>{}) {
    if (!bounds) return undefined;
    const stamp = ++WALL_VISIT_STAMP;
    const visit = wall => {
      if (!wall || WALL_VISIT_STAMPS.get(wall) === stamp) return undefined;
      WALL_VISIT_STAMPS.set(wall, stamp);
      if (!boundsIntersects(bounds, WALL_SPATIAL_INDEX.bounds.get(wall) || shapeBounds(wall))) return undefined;
      return visitor(wall);
    };
    const x0 = Math.floor(bounds.x / WALL_GRID_SIZE), x1 = Math.floor((bounds.x + bounds.w) / WALL_GRID_SIZE);
    const y0 = Math.floor(bounds.y / WALL_GRID_SIZE), y1 = Math.floor((bounds.y + bounds.h) / WALL_GRID_SIZE);
    for (let gx = x0; gx <= x1; gx += 1) for (let gy = y0; gy <= y1; gy += 1) {
      const list = WALL_SPATIAL_INDEX.cells.get(`${gx},${gy}`);
      if (!list) continue;
      for (const wall of list) {
        const result = visit(wall);
        if (result !== undefined) return result;
      }
    }
    if (includeLocked) {
      for (const wall of lockedCaptureZoneShapes()) {
        const result = visit(wall);
        if (result !== undefined) return result;
      }
    }
    return undefined;
  }
  const CONTROL_CAPTURE_ZONES = Object.freeze(CONTROL_RUNTIME_MAP?.captureZones || []);
  const CONTROL_ACTIVE_ZONES = Object.freeze(CONTROL_RUNTIME_MAP?.activeZones || []);
  const CONTROL_VISUAL_LAYERS = Object.freeze(CONTROL_RUNTIME_MAP?.visualLayers || []);
  const CONTROL_VISUAL_LAYERS_SORTED = Object.freeze(CONTROL_VISUAL_LAYERS.slice().sort((a,b) => (a.z || 0) - (b.z || 0)));
  const CONTROL_CAPTURE_RINGS = Object.freeze(CONTROL_RUNTIME_MAP?.captureRings || []);
  const CONTROL_RING_ASSETS = Object.freeze(CONTROL_RUNTIME_MAP?.ringAssets || {});
  const CONTROL_TURRET_SPAWNS = Object.freeze(CONTROL_RUNTIME_MAP?.turretSpawns || []);
  const CONTROL_BOSS_SPAWNS = Object.freeze(CONTROL_RUNTIME_MAP?.bossSpawns || []);
  const CONTROL_TURRET_ASSETS = Object.freeze({
    base:'/assets/engineer_v1/đế chung cho cả turret và rocket.webp',
    barrel:'/assets/engineer_v1/thân trên trục xoay rocket.webp',
    barrelReload:'/assets/engineer_v1/thân súng trên trục xoay rocket nhưng đang reload.webp',
    rocket:'/assets/engineer_v1/rocket bullet.webp'
  });
  const CONTROL_CONFIG = Object.freeze({
    modeId:'apex-control',
    modeName:'APEX CONTROL',
    modeSubtitle:'Territory Mode',
    mapScale:CONTROL_MAP_SCALE,
    worldCoordinateScale:CONTROL_WORLD_COORD_SCALE,
    playerHp:100,
    respawnSeconds:5,
    worldWidth:APEX_CONTROL_WORLD.width,
    worldHeight:APEX_CONTROL_WORLD.height,
    worldCenterX:APEX_CONTROL_WORLD.centerX,
    worldCenterY:APEX_CONTROL_WORLD.centerY,
    viewportWidth:1680,
    viewportHeight:1200,
    championRadius:75,
    mapWidth:APEX_CONTROL_WORLD.width,
    mapHeight:APEX_CONTROL_WORLD.height,
    neutralCore:NEUTRAL_CORE,
    neutralVerticalLane:NEUTRAL_VERTICAL_LANE,
    neutralHorizontalLane:NEUTRAL_HORIZONTAL_LANE,
    territoryRooms:TERRITORY_ROOMS,
    wallThickness:WALL_THICKNESS,
    doorWidth:DOOR_WIDTH,
    doorNoBuildPadding:DOOR_NO_BUILD_PADDING,
    spawnNoBuildRadius:SPAWN_NO_BUILD_RADIUS,
    captureRadius:CAPTURE_RADIUS,
    doors:DOORS,
    wallSegments:WALL_SEGMENTS,
    captureCorners:CAPTURE_CORNERS,
    spawnPoints:SPAWN_POINTS,
    territories:TERRITORY_ROOMS,
    neutralCaptureSeconds:5,
    creepWaveMinSeconds:8,
    creepWaveMaxSeconds:12,
    creepMaxAlive:22,
    creepXp:38,
    creepHp:42,
    creepMeleeDps:2,
    creepFarmDps:18,
    maxLevel:10,
    levelXp:[100,140,190,250,320,400,500,620,760],
    baseSecureSeconds:10,
    stealSeconds:10,
    disabledSeconds:5,
    dominanceRequiredTerritories:3,
    dominanceCountdownSeconds:10,
    botDifficulty:'normal',
    baseTurretDps:2,
    baseTurretKnockback:155,
    healPerSecond:5,
    contestedHealPerSecond:2,
    healPauseSeconds:1,
    rageMultiplier:1.5,
    contestedRageMultiplier:1.2
  });
  const CONTROL_LEVEL_XP = Object.freeze(CONTROL_CONFIG.levelXp);
  window.APEX_CONTROL_CONFIG = CONTROL_CONFIG;
  window.APEX_CONTROL_WORLD = APEX_CONTROL_WORLD;
  const LEGACY_GAME_SIZE = GAME_SIZE;
  const LEGACY_CANVAS = { width:canvas.width, height:canvas.height };

  const ACTIONS = Object.freeze({
    MOVE_VECTOR:'MOVE_VECTOR', AIM_POINT:'AIM_POINT', PRIMARY:'PRIMARY', SECONDARY:'SECONDARY',
    ABILITY_1:'ABILITY_1', ABILITY_2:'ABILITY_2', CORE:'CORE', APEX:'APEX'
  });
  const KEY_ACTION = Object.freeze({ KeyQ:ACTIONS.ABILITY_1, KeyE:ACTIONS.ABILITY_2, Space:ACTIONS.CORE, KeyR:ACTIONS.APEX });
  const MOVE_KEYS = Object.freeze({ KeyW:[0,-1], KeyA:[-1,0], KeyS:[0,1], KeyD:[1,0] });
  const input = window.APEX_MANUAL_INPUT = {
    actions:ACTIONS,
    active:false,
    held:new Set(),
    pressed:new Set(),
    aimPoint:{x:CONTROL_CONFIG.worldCenterX,y:CONTROL_CONFIG.worldCenterY},
    pointerInside:false,
    moveVector:{x:0,y:0},
    clear() {
      this.held.clear();
      this.pressed.clear();
      this.moveVector = {x:0,y:0};
      this.pointerInside = false;
    },
    isHeld(action) { return this.held.has(action); },
    consume(action) {
      const had = this.pressed.has(action);
      this.pressed.delete(action);
      return had;
    },
    endFrame() { this.pressed.clear(); },
    snapshot() {
      return {
        MOVE_VECTOR:{...this.moveVector}, AIM_POINT:{...this.aimPoint}, pointerInside:this.pointerInside,
        PRIMARY:{held:this.isHeld(ACTIONS.PRIMARY),pressed:this.pressed.has(ACTIONS.PRIMARY)},
        SECONDARY:{held:this.isHeld(ACTIONS.SECONDARY),pressed:this.pressed.has(ACTIONS.SECONDARY)},
        ABILITY_1:{held:this.isHeld(ACTIONS.ABILITY_1),pressed:this.pressed.has(ACTIONS.ABILITY_1)},
        ABILITY_2:{held:this.isHeld(ACTIONS.ABILITY_2),pressed:this.pressed.has(ACTIONS.ABILITY_2)},
        CORE:{held:this.isHeld(ACTIONS.CORE),pressed:this.pressed.has(ACTIONS.CORE)},
        APEX:{held:this.isHeld(ACTIONS.APEX),pressed:this.pressed.has(ACTIONS.APEX)}
      };
    }
  };
  const STATE = window.APEX_MANUAL_LAB = {
    mode:'APEX_CONTROL', modeId:CONTROL_CONFIG.modeId, config:CONTROL_CONFIG,
    active:false, selecting:false, localFighter:null, opponent:null,
    selectedBlueprint:0, feedback:null, lastConfig:null, controller:null, input,
    localSlot:0, remoteSlot:null, remoteInput:null, remoteController:null, room:null,
    specialAssignments:null, territories:null, captureContest:false, bot:null,
    lastKillBonus:null,
    debug:{mode:'off', zones:false, walls:false, botRoute:false, structures:false, rings:false, bosses:false, locks:false},
    effects:null,
    map:CONTROL_RUNTIME_MAP,
    mapWarnings:CONTROL_RUNTIME_MAP?.missingMetadata || [],
    bosses:null,
    lockedCaptureZones:new Set(),
    neutralTurrets:null,
    creeps:null,
    creepSpawner:null,
    levels:null,
    captureRingImages:{},
    visualImages:{},
    turretImages:{},
    lifecycle:null,
    match:{state:'idle', winner:null, endReason:null, message:null},
    dominance:{active:false, playerId:null, timer:0, lastCanceled:null}
  };
  const PERF = window.__apexPerfSnapshot = {
    frame:0, secondStart:performance.now(), frameTimeSum:0, frameTimeMax:0, frames:0,
    updateTimeSum:0, updateTimeMax:0, renderTimeSum:0, renderTimeMax:0,
    collisionTimeSum:0, wallCheckTimeSum:0, projectileUpdateTimeSum:0, vfxUpdateTimeSum:0,
    wallPolygonChecks:0, segmentWallChecks:0, wallCandidatesChecked:0, canvasDrawCalls:0,
    allocations:0, last:null
  };
  window.__apexPerfDebug ??= location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  const CONTROL_RENDER_BUDGET = Object.freeze({
    particles:120,
    shockwaves:10,
    floatingTexts:24,
    katanaVfx:{afterimage:3, petal:8, slash:4, default:16},
    fang:{afterimages:2, particles:48, rings:3, marks:6}
  });
  function controlFastRenderActive() {
    return !!(STATE.active && window.__apexControlFastRender);
  }
  function installControlCanvasRenderGuards() {
    const proto = window.CanvasRenderingContext2D?.prototype;
    if (!proto || proto.__apexControlRenderGuards) return;
    proto.__apexControlRenderGuards = true;
    const nativeDrawImage = proto.drawImage;
    const katanaFrames = new Set(window.APEX_KATANA?.frameImages || []);
    const controlFrameCache = new WeakMap();
    const cacheKatanaFrame = source => {
      if (!katanaFrames.has(source) || !source?.complete || !source.naturalWidth) return null;
      const cached = controlFrameCache.get(source);
      if (cached) return cached;
      const size = 384;
      const useOffscreen = typeof OffscreenCanvas !== 'undefined';
      const canvas = useOffscreen
        ? new OffscreenCanvas(size, size)
        : Object.assign(document.createElement('canvas'), {width:size, height:size});
      const cacheCtx = canvas.getContext('2d');
      if (!cacheCtx) return null;
      cacheCtx.imageSmoothingEnabled = true;
      cacheCtx.imageSmoothingQuality = 'high';
      if (useOffscreen) cacheCtx.drawImage(source, 0, 0, size, size);
      else nativeDrawImage.call(cacheCtx, source, 0, 0, size, size);
      const entry = {canvas, scaleX:size / source.naturalWidth, scaleY:size / source.naturalHeight};
      controlFrameCache.set(source, entry);
      return entry;
    };
    proto.drawImage = function(source, ...args) {
      const cached = controlFastRenderActive() ? cacheKatanaFrame(source) : null;
      if (!cached) return nativeDrawImage.call(this, source, ...args);
      if (args.length === 4) return nativeDrawImage.call(this, cached.canvas, ...args);
      if (args.length === 8) {
        const [sx, sy, sw, sh, dx, dy, dw, dh] = args;
        return nativeDrawImage.call(this, cached.canvas, sx * cached.scaleX, sy * cached.scaleY,
          sw * cached.scaleX, sh * cached.scaleY, dx, dy, dw, dh);
      }
      return nativeDrawImage.call(this, source, ...args);
    };
    const warmKatanaFrames = deadline => {
      const pending = [...katanaFrames].filter(frame => !controlFrameCache.has(frame));
      while (pending.length && (!deadline || deadline.timeRemaining() > 2)) cacheKatanaFrame(pending.shift());
      if (pending.length) window.requestIdleCallback?.(warmKatanaFrames, {timeout:500});
    };
    Promise.all([...katanaFrames].map(frame => frame.decode?.().catch(() => null)))
      .then(() => window.requestIdleCallback ? window.requestIdleCallback(warmKatanaFrames, {timeout:500}) : setTimeout(warmKatanaFrames, 0));
    const filterDesc = Object.getOwnPropertyDescriptor(proto, 'filter');
    if (filterDesc?.get && filterDesc?.set) {
      Object.defineProperty(proto, 'filter', {
        configurable:true,
        enumerable:filterDesc.enumerable,
        get() { return filterDesc.get.call(this); },
        set(value) {
          if (controlFastRenderActive() && value && value !== 'none') return filterDesc.set.call(this, 'none');
          return filterDesc.set.call(this, value);
        }
      });
    }
    const shadowDesc = Object.getOwnPropertyDescriptor(proto, 'shadowBlur');
    if (shadowDesc?.get && shadowDesc?.set) {
      Object.defineProperty(proto, 'shadowBlur', {
        configurable:true,
        enumerable:shadowDesc.enumerable,
        get() { return shadowDesc.get.call(this); },
        set(value) {
          const blur = Number(value) || 0;
          return shadowDesc.set.call(this, controlFastRenderActive() ? Math.min(blur, 4) : blur);
        }
      });
    }
  }
  function keepNewest(array, max) {
    if (!Array.isArray(array) || array.length <= max) return;
    array.splice(0, array.length - max);
  }
  function keepNewestByType(array, caps) {
    if (!Array.isArray(array) || !caps) return;
    const counts = {};
    const kept = [];
    for (let i = array.length - 1; i >= 0; i -= 1) {
      const item = array[i];
      const type = item?.type || 'default';
      const max = caps[type] ?? caps.default ?? Infinity;
      counts[type] = (counts[type] || 0) + 1;
      if (counts[type] <= max) kept.push(item);
    }
    kept.reverse();
    if (kept.length !== array.length) array.splice(0, array.length, ...kept);
  }
  function applyControlRenderBudget() {
    if (!STATE.active) return;
    keepNewest(particles, CONTROL_RENDER_BUDGET.particles);
    keepNewest(shockwaves, CONTROL_RENDER_BUDGET.shockwaves);
    keepNewest(floatingTexts, CONTROL_RENDER_BUDGET.floatingTexts);
    const katana = window.APEX_KATANA?.state;
    keepNewestByType(katana?.vfx, CONTROL_RENDER_BUDGET.katanaVfx);
    const fang = window.APEX_FANG?.state;
    keepNewest(fang?.afterimages, CONTROL_RENDER_BUDGET.fang.afterimages);
    keepNewest(fang?.particles, CONTROL_RENDER_BUDGET.fang.particles);
    keepNewest(fang?.rings, CONTROL_RENDER_BUDGET.fang.rings);
    keepNewest(fang?.marks, CONTROL_RENDER_BUDGET.fang.marks);
  }
  installControlCanvasRenderGuards();
  function perfFreshSample() {
    const katana = window.APEX_KATANA?.state || {};
    const vfx = katana.vfx || [];
    return {
      t:performance.now(),
      frameTimeMs:PERF.last?.frameTimeMs || {avg:0,max:0},
      updateTimeMs:PERF.last?.updateTimeMs || {avg:0,max:0},
      renderTimeMs:PERF.last?.renderTimeMs || {avg:0,max:0},
      collisionTimeMs:PERF.last?.collisionTimeMs || 0,
      wallCheckTimeMs:PERF.last?.wallCheckTimeMs || 0,
      projectileUpdateTimeMs:PERF.last?.projectileUpdateTimeMs || 0,
      vfxUpdateTimeMs:PERF.last?.vfxUpdateTimeMs || 0,
      activeProjectiles:(projectiles || []).length,
      activeBladeWaves:(katana.waves || []).length,
      activeKatanaVfx:vfx.length,
      activeSlashVfx:vfx.filter(fx => fx?.type === 'slash').length,
      activePetals:vfx.filter(fx => fx?.type === 'petal').length,
      activeClones:(fighters || []).filter(f => f?.name === 'KATANA').reduce((sum, f) => sum + (f.data?.katana?.clones || []).filter(c => !c.consumed).length, 0),
      segmentWallChecksPerFrame:PERF.last?.segmentWallChecksPerFrame || 0,
      wallPolygonChecksPerFrame:PERF.last?.wallPolygonChecksPerFrame || 0,
      wallCandidatesCheckedPerFrame:PERF.last?.wallCandidatesCheckedPerFrame || 0,
      allocations:PERF.last?.allocations || PERF.allocations || 0,
      canvasDrawCalls:PERF.last?.canvasDrawCalls || PERF.canvasDrawCalls || 0,
      katana:window.__apexKatanaDebugCounters || null,
      katanaWarmup:window.APEX_KATANA?.state?.visualWarmup
        ? {
          ready:!!window.APEX_KATANA.state.visualWarmup.ready,
          bladeMaskReady:!!window.APEX_KATANA.state.visualWarmup.bladeMaskReady,
          error:window.APEX_KATANA.state.visualWarmup.error || null
        }
        : null
    };
  }
  function mergeCasePerf(sample) {
    const rec = PERF.case;
    if (!rec) return;
    rec.samples += 1;
    const addMetric = (key, value) => {
      const item = rec.metrics[key] || (rec.metrics[key] = {sum:0,max:0});
      item.sum += value;
      item.max = Math.max(item.max, value);
    };
    addMetric('frameTimeMs.avg', sample.frameTimeMs.avg || 0);
    addMetric('frameTimeMs.max', sample.frameTimeMs.max || 0);
    addMetric('updateTimeMs.avg', sample.updateTimeMs.avg || 0);
    addMetric('updateTimeMs.max', sample.updateTimeMs.max || 0);
    addMetric('renderTimeMs.avg', sample.renderTimeMs.avg || 0);
    addMetric('renderTimeMs.max', sample.renderTimeMs.max || 0);
    addMetric('collisionTimeMs', sample.collisionTimeMs || 0);
    addMetric('wallCheckTimeMs', sample.wallCheckTimeMs || 0);
    addMetric('projectileUpdateTimeMs', sample.projectileUpdateTimeMs || 0);
    addMetric('vfxUpdateTimeMs', sample.vfxUpdateTimeMs || 0);
    addMetric('canvasDrawCalls.avg', sample.canvasDrawCalls?.avg || sample.canvasDrawCalls || 0);
    addMetric('canvasDrawCalls.max', sample.canvasDrawCalls?.max || sample.canvasDrawCalls || 0);
    for (const key of ['activeProjectiles','activeBladeWaves','activeKatanaVfx','activeSlashVfx','activePetals','activeClones','segmentWallChecksPerFrame','wallPolygonChecksPerFrame','wallCandidatesCheckedPerFrame','allocations']) {
      rec.peaks[key] = Math.max(rec.peaks[key] || 0, sample[key] || 0);
    }
    rec.peaks.canvasDrawCalls = Math.max(rec.peaks.canvasDrawCalls || 0, sample.canvasDrawCalls?.max || sample.canvasDrawCalls || 0);
  }
  function summarizeCasePerf(rec=PERF.case) {
    if (!rec) return null;
    const metrics = {};
    for (const [key, item] of Object.entries(rec.metrics || {})) metrics[key] = {avg:item.sum / Math.max(1, rec.samples), max:item.max};
    return {label:rec.label, seconds:(performance.now() - rec.start) / 1000, samples:rec.samples, metrics, peaks:{...rec.peaks}, last:perfFreshSample()};
  }
  window.__startApexPerfCase = function(label='case') {
    PERF.case = {label, start:performance.now(), samples:0, metrics:{}, peaks:{}};
    return {started:label};
  };
  window.__dumpApexPerf = function(label=null) {
    const sample = perfFreshSample();
    const out = {label, sample, case:summarizeCasePerf(), lastSecond:PERF.last || null};
    console.log('[APEX PERF]', out);
    return out;
  };
  window.__stopApexPerfCase = function() {
    const out = summarizeCasePerf();
    PERF.case = null;
    console.log('[APEX PERF CASE]', out);
    return out;
  };
  function perfDebugEnabled() { return !!window.__apexPerfDebug; }
  function perfNow() { return performance.now(); }
  function perfAdd(key, value) { PERF[key] = (PERF[key] || 0) + value; }
  function perfCount(key, value=1) { PERF[key] = (PERF[key] || 0) + value; }
  function perfFrameStart() {
    PERF.frame += 1;
    PERF.__frameStart = perfNow();
    PERF.wallPolygonChecks = 0;
    PERF.segmentWallChecks = 0;
    PERF.wallCandidatesChecked = 0;
    PERF.canvasDrawCalls = 0;
  }
  function perfFrameEnd() {
    const now = perfNow();
    const frameMs = now - (PERF.__frameStart || now);
    PERF.frameTimeSum += frameMs;
    PERF.frameTimeMax = Math.max(PERF.frameTimeMax || 0, frameMs);
    PERF.wallPolygonChecksSum = (PERF.wallPolygonChecksSum || 0) + (PERF.wallPolygonChecks || 0);
    PERF.segmentWallChecksSum = (PERF.segmentWallChecksSum || 0) + (PERF.segmentWallChecks || 0);
    PERF.wallCandidatesCheckedSum = (PERF.wallCandidatesCheckedSum || 0) + (PERF.wallCandidatesChecked || 0);
    PERF.canvasDrawCallsSum = (PERF.canvasDrawCallsSum || 0) + (PERF.canvasDrawCalls || 0);
    PERF.canvasDrawCallsMax = Math.max(PERF.canvasDrawCallsMax || 0, PERF.canvasDrawCalls || 0);
    PERF.frames += 1;
    if (now - PERF.secondStart >= 1000) {
      const katana = window.APEX_KATANA?.state || {};
      const vfx = katana.vfx || [];
      PERF.last = {
        frameTimeMs:{avg:PERF.frameTimeSum / Math.max(1, PERF.frames), max:PERF.frameTimeMax},
        updateTimeMs:{avg:PERF.updateTimeSum / Math.max(1, PERF.frames), max:PERF.updateTimeMax || 0},
        renderTimeMs:{avg:PERF.renderTimeSum / Math.max(1, PERF.frames), max:PERF.renderTimeMax || 0},
        collisionTimeMs:PERF.collisionTimeSum / Math.max(1, PERF.frames),
        wallCheckTimeMs:PERF.wallCheckTimeSum / Math.max(1, PERF.frames),
        projectileUpdateTimeMs:PERF.projectileUpdateTimeSum / Math.max(1, PERF.frames),
        vfxUpdateTimeMs:PERF.vfxUpdateTimeSum / Math.max(1, PERF.frames),
        activeProjectiles:(projectiles || []).length,
        activeBladeWaves:(katana.waves || []).length,
        activeKatanaVfx:vfx.length,
        activeSlashVfx:vfx.filter(fx => fx?.type === 'slash').length,
        activePetals:vfx.filter(fx => fx?.type === 'petal').length,
        activeClones:(fighters || []).filter(f => f?.name === 'KATANA').reduce((sum, f) => sum + (f.data?.katana?.clones || []).filter(c => !c.consumed).length, 0),
        wallPolygonChecksPerFrame:(PERF.wallPolygonChecksSum || 0) / Math.max(1, PERF.frames),
        segmentWallChecksPerFrame:(PERF.segmentWallChecksSum || 0) / Math.max(1, PERF.frames),
        wallCandidatesCheckedPerFrame:(PERF.wallCandidatesCheckedSum || 0) / Math.max(1, PERF.frames),
        canvasDrawCalls:{
          avg:(PERF.canvasDrawCallsSum || 0) / Math.max(1, PERF.frames),
          max:PERF.canvasDrawCallsMax || 0
        },
        allocations:PERF.allocations || 0,
        katana:window.__apexKatanaDebugCounters || null
      };
      if (perfDebugEnabled()) console.table(PERF.last);
      mergeCasePerf(perfFreshSample());
      PERF.secondStart = now;
      PERF.frameTimeSum = 0; PERF.frameTimeMax = 0; PERF.frames = 0;
      PERF.updateTimeSum = 0; PERF.updateTimeMax = 0; PERF.renderTimeSum = 0; PERF.renderTimeMax = 0;
      PERF.collisionTimeSum = 0; PERF.wallCheckTimeSum = 0; PERF.projectileUpdateTimeSum = 0; PERF.vfxUpdateTimeSum = 0;
      PERF.wallPolygonChecks = 0; PERF.segmentWallChecks = 0; PERF.wallCandidatesChecked = 0;
      PERF.wallPolygonChecksSum = 0; PERF.segmentWallChecksSum = 0; PERF.wallCandidatesCheckedSum = 0; PERF.allocations = 0;
      PERF.canvasDrawCallsSum = 0; PERF.canvasDrawCallsMax = 0; PERF.canvasDrawCalls = 0;
    }
  }

  function textEntryTarget(target) {
    return !!target?.closest?.('input, textarea, select, [contenteditable="true"]');
  }
  function refreshMoveVector() {
    let x=0,y=0;
    for (const [code, vector] of Object.entries(MOVE_KEYS)) if (input.held.has(code)) { x+=vector[0]; y+=vector[1]; }
    const length = Math.hypot(x,y);
    input.moveVector = length > 0 ? {x:x/length,y:y/length} : {x:0,y:0};
  }
  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const style = getComputedStyle(canvas);
    const leftBorder = parseFloat(style.borderLeftWidth) || 0;
    const rightBorder = parseFloat(style.borderRightWidth) || 0;
    const topBorder = parseFloat(style.borderTopWidth) || 0;
    const bottomBorder = parseFloat(style.borderBottomWidth) || 0;
    const left = rect.left + leftBorder;
    const top = rect.top + topBorder;
    const width = Math.max(1, rect.width - leftBorder - rightBorder);
    const height = Math.max(1, rect.height - topBorder - bottomBorder);
    const sx = (clientX - left) * canvas.width / width;
    const sy = (clientY - top) * canvas.height / height;
    const view = window.__apexCameraView || {worldX:0,worldY:0,shakeX:0,shakeY:0,zoom:1};
    const zoom = Number.isFinite(view.zoom) && view.zoom !== 0 ? view.zoom : 1;
    if (view.modeId === CONTROL_CONFIG.modeId) {
      return {
        x:view.worldX + (sx - (view.shakeX || 0)) / zoom,
        y:view.worldY + (sy - (view.shakeY || 0)) / zoom,
        inside:clientX >= left && clientX <= left + width && clientY >= top && clientY <= top + height
      };
    }
    return {
      x:(sx - GAME_SIZE/2 - (view.shakeX || 0)) / zoom + GAME_SIZE/2,
      y:(sy - GAME_SIZE/2 - (view.shakeY || 0)) / zoom + GAME_SIZE/2,
      inside:clientX >= left && clientX <= left + width && clientY >= top && clientY <= top + height
    };
  }
  let pendingPointer = null;
  let pointerMoveFrame = 0;

  function applyPointerClient(clientX, clientY) {
    if (!input.active) return;
    const point = screenToWorld(clientX, clientY);
    input.aimPoint = {x:point.x,y:point.y};
    input.pointerInside = point.inside;
    if (!point.inside) {
      input.held.delete(ACTIONS.PRIMARY);
      input.held.delete(ACTIONS.SECONDARY);
    }
  }

  function updatePointer(event) {
    applyPointerClient(event.clientX, event.clientY);
  }

  function onPointerMove(event) {
    if (!input.active) return;
    pendingPointer = {clientX:event.clientX, clientY:event.clientY};
    if (pointerMoveFrame) return;
    pointerMoveFrame = requestAnimationFrame(() => {
      pointerMoveFrame = 0;
      const point = pendingPointer;
      pendingPointer = null;
      if (point) applyPointerClient(point.clientX, point.clientY);
    });
  }
  function onKeyDown(event) {
    if (!input.active || textEntryTarget(event.target)) return;
    const localOwner = playerIdForIndex(STATE.localSlot);
    if (localOwner && STATE.levels?.[localOwner]?.pending && (event.code === 'KeyH' || event.code === 'KeyJ')) {
      chooseControlUpgrade(localOwner, event.code === 'KeyH' ? 'hp' : 'damage');
      event.preventDefault();
      return;
    }
    if (/^F([1-8])$/.test(event.code)) {
      const debug = STATE.debug || (STATE.debug = {mode:'off', zones:false, walls:false, botRoute:false, structures:false, rings:false, bosses:false, locks:false});
      if (event.code === 'F1') {
        const modes = ['off','basic','dev'];
        debug.mode = modes[(modes.indexOf(debug.mode) + 1) % modes.length];
      } else if (event.code === 'F2') debug.zones = !debug.zones;
      else if (event.code === 'F3') debug.walls = !debug.walls;
      else if (event.code === 'F4') debug.botRoute = !debug.botRoute;
      else if (event.code === 'F5') debug.structures = !debug.structures;
      else if (event.code === 'F6') debug.rings = !debug.rings;
      else if (event.code === 'F7') debug.bosses = !debug.bosses;
      else if (event.code === 'F8') debug.locks = !debug.locks;
      feedback(`DEBUG ${debug.mode.toUpperCase()} · Z${debug.zones?'1':'0'} W${debug.walls?'1':'0'} B${debug.botRoute?'1':'0'} S${debug.structures?'1':'0'}`, true, 1.1);
      event.preventDefault();
      return;
    }
    if (MOVE_KEYS[event.code]) {
      input.held.add(event.code);
      refreshMoveVector();
      event.preventDefault();
      return;
    }
    const action = KEY_ACTION[event.code];
    if (!action) return;
    if (!event.repeat && !input.held.has(action)) input.pressed.add(action);
    input.held.add(action);
    event.preventDefault();
  }
  function onKeyUp(event) {
    if (MOVE_KEYS[event.code]) {
      input.held.delete(event.code);
      refreshMoveVector();
    }
    const action = KEY_ACTION[event.code];
    if (action) input.held.delete(action);
  }
  function onPointerDown(event) {
    if (!input.active || event.target !== canvas) return;
    updatePointer(event);
    const action = event.button === 0 ? ACTIONS.PRIMARY : event.button === 2 ? ACTIONS.SECONDARY : null;
    if (!action) return;
    if (!input.held.has(action)) input.pressed.add(action);
    input.held.add(action);
    event.preventDefault();
    try { canvas.focus({preventScroll:true}); } catch (error) {}
  }
  function onPointerUp(event) {
    if (event.button === 0) input.held.delete(ACTIONS.PRIMARY);
    if (event.button === 2) input.held.delete(ACTIONS.SECONDARY);
  }
  function releaseHeldInput() {
    input.clear();
    const f = STATE.localFighter;
    if (f?.name === 'ENGINEER') window.APEX_ENGINEER?.manualApi?.setMagnetRequested?.(f, false);
  }
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('pointermove', onPointerMove, true);
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('blur', releaseHeldInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseHeldInput(); });
  canvas.addEventListener('pointerdown', onPointerDown, true);
  canvas.addEventListener('pointerleave', () => {
    releaseHeldInput();
  });
  canvas.addEventListener('contextmenu', event => { if (input.active) event.preventDefault(); });
  canvas.tabIndex = canvas.tabIndex >= 0 ? canvas.tabIndex : 0;

  function feedback(text, valid=false, duration=.95) {
    STATE.feedback = {text,valid,until:performance.now()+duration*1000};
  }
  function imageFor(src, cache) {
    if (!src) return null;
    const bucket = cache || STATE.visualImages || (STATE.visualImages = {});
    if (!bucket[src]) {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      bucket[src] = img;
    }
    return bucket[src];
  }
  function preloadControlMapImages() {
    for (const layer of CONTROL_VISUAL_LAYERS) imageFor(layer.src, STATE.visualImages);
    for (const src of Object.values(CONTROL_RING_ASSETS)) imageFor(src, STATE.captureRingImages);
    for (const src of Object.values(CONTROL_TURRET_ASSETS)) imageFor(src, STATE.turretImages);
  }
  preloadControlMapImages();
  function currentEngineer() {
    const f = STATE.localFighter;
    return STATE.active && f?.name === 'ENGINEER' && f.hp > 0 ? f : null;
  }
  function engineerApi() { return window.APEX_ENGINEER?.manualApi || null; }
  function engineerBlueprintKinds(api=engineerApi()) {
    const kinds = (api?.buildKinds || ['turret','repair','factory']).filter(kind => kind !== 'mine');
    return kinds.length ? kinds : ['turret'];
  }
  function selectedKind() {
    const kinds = engineerBlueprintKinds();
    STATE.selectedBlueprint = ((STATE.selectedBlueprint % kinds.length) + kinds.length) % kinds.length;
    return kinds[STATE.selectedBlueprint];
  }
  function structurePlacementRadius(api, kind) {
    const spec = api?.baseSpecs?.[kind];
    return Math.max(spec?.radius || 44, spec ? api?.structureVisualFootprint?.({kind,radius:spec.radius}) || 0 : 0);
  }
  function rollSpecialAssignments() {
    return { topRightSpecial:'healPoint', bottomLeftSpecial:'ragePoint' };
  }
  function assignmentLabel(roomId) {
    const assignment = STATE.specialAssignments?.[roomId];
    if (assignment === 'healPoint') return 'HEAL SLOT';
    if (assignment === 'ragePoint') return 'RAGE SLOT';
    if (roomId === 'p1Base') return 'P1 BASE';
    if (roomId === 'p2Base') return 'P2 BASE';
    return 'HEAL/RAGE SLOT';
  }
  function worldWidth() { return CONTROL_CONFIG.worldWidth; }
  function worldHeight() { return CONTROL_CONFIG.worldHeight; }
  function worldCenter() { return {x:CONTROL_CONFIG.worldCenterX, y:CONTROL_CONFIG.worldCenterY}; }
  function clampWorldX(x, radius=0) { return clamp(x, radius, worldWidth() - radius); }
  function clampWorldY(y, radius=0) { return clamp(y, radius, worldHeight() - radius); }
  function clampWorldEntity(entity) {
    if (!entity) return;
    const r = entity.radius || 0;
    entity.x = clampWorldX(entity.x, r);
    entity.y = clampWorldY(entity.y, r);
  }
  function rectContainsPoint(rect, point) {
    return !!rect && !!point && point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
  }
  function rectsOverlap(a, b) {
    return !!a && !!b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function expandedRect(rect, padding) {
    return { x:rect.x-padding, y:rect.y-padding, w:rect.w+padding*2, h:rect.h+padding*2 };
  }
  function circleIntersectsRect(circle, rect) {
    if (!circle || !rect) return false;
    const cx = clamp(circle.x, rect.x, rect.x + rect.w);
    const cy = clamp(circle.y, rect.y, rect.y + rect.h);
    return dist(circle.x, circle.y, cx, cy) <= (circle.radius || 0);
  }
  function pointInPolygon(point, polygon) {
    const pts = polygon?.worldPoints || polygon?.points || polygon || [];
    if (!point || pts.length < 3) return false;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay;
    const lenSq = vx * vx + vy * vy;
    const t = lenSq > 0 ? clamp(((px - ax) * vx + (py - ay) * vy) / lenSq, 0, 1) : 0;
    return {x:ax + vx * t, y:ay + vy * t};
  }
  function closestPointOnPolygon(point, polygon) {
    const pts = polygon?.worldPoints || [];
    let best = null;
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const p = closestPointOnSegment(point.x, point.y, a.x, a.y, b.x, b.y);
      const d = dist(point.x, point.y, p.x, p.y);
      if (!best || d < best.distance) best = {point:p, distance:d, a, b};
    }
    return best;
  }
  function circleIntersectsPolygon(circle, polygon) {
    if (!circle || !polygon?.worldPoints?.length) return false;
    if (pointInPolygon(circle, polygon)) return true;
    const closest = closestPointOnPolygon(circle, polygon);
    return !!closest && closest.distance <= (circle.radius || 0);
  }
  function circleIntersectsShape(circle, shape) {
    return shape?.worldPoints ? circleIntersectsPolygon(circle, shape) : circleIntersectsRect(circle, shape);
  }
  function isOutsideWorld(point, radius=0) {
    return !point || point.x < radius || point.y < radius || point.x > worldWidth() - radius || point.y > worldHeight() - radius;
  }
  function isInsideWall(pointOrCircle, radius=0) {
    const circle = { x:pointOrCircle?.x, y:pointOrCircle?.y, radius:pointOrCircle?.radius ?? radius };
    if (!Number.isFinite(circle.x) || !Number.isFinite(circle.y)) return true;
    const start = perfNow();
    const hit = forEachWallCandidate(expandedBoundsForCircle(circle), false, wall => {
      perfCount('wallCandidatesChecked');
      if (wall?.worldPoints?.length) perfCount('wallPolygonChecks');
      if (circleIntersectsShape(circle, wall)) {
        perfAdd('wallCheckTimeSum', perfNow() - start);
        return true;
      }
      return undefined;
    });
    if (hit) return true;
    perfAdd('wallCheckTimeSum', perfNow() - start);
    return false;
  }
  function lockedCaptureZoneShapes() {
    const locked = STATE.lockedCaptureZones || new Set();
    return CONTROL_CAPTURE_ZONES.filter(zone => locked.has(zone.zoneId)).map(captureLockShapeForZone);
  }
  function rectToWorldPolygon(rect, source={}) {
    return {
      ...source,
      ...rect,
      worldPoints:[
        {x:rect.x,y:rect.y},
        {x:rect.x + rect.w,y:rect.y},
        {x:rect.x + rect.w,y:rect.y + rect.h},
        {x:rect.x,y:rect.y + rect.h}
      ]
    };
  }
  function captureLockShapeForZone(zone) {
    if (!zone?.worldPoints?.length || zone.zoneId !== 'topRightSpecial' || zoneById(CONTROL_ACTIVE_ZONES, zone.zoneId)) return zone;
    const b = boundsFromPoints(zone.worldPoints);
    const size = Math.min(820, Math.max(560, Math.min(b.w, b.h) * .62));
    const rect = {x:b.x + b.w - size, y:b.y, w:size, h:size};
    return rectToWorldPolygon(rect, {
      id:`${zone.id || zone.zoneId}-lock-core`,
      zoneId:zone.zoneId,
      role:zone.role,
      sourceZoneId:zone.id,
      lockCore:true,
      fallbackReason:'HEAL export has no active polygon; lock only the outer capture core so the active/boss approach stays open.'
    });
  }
  function isInsideLockedCaptureZone(pointOrCircle, radius=0) {
    const circle = { x:pointOrCircle?.x, y:pointOrCircle?.y, radius:pointOrCircle?.radius ?? radius };
    if (!Number.isFinite(circle.x) || !Number.isFinite(circle.y)) return false;
    return lockedCaptureZoneShapes().some(zone => circleIntersectsPolygon(circle, zone));
  }
  function neutralRects() {
    return [];
  }
  function isInsideNeutralNoEffectZone(point) {
    return neutralRects().some(rect => rectContainsPoint(rect, point));
  }
  function doorRects(padding=0) {
    const half = WALL_THICKNESS / 2;
    const rects = [];
    for (const [roomId, roomDoors] of Object.entries(DOORS)) {
      for (const [doorId, door] of Object.entries(roomDoors)) {
        const rect = Number.isFinite(door.wallX)
          ? { x:door.wallX-half, y:door.y1, w:WALL_THICKNESS, h:door.y2-door.y1 }
          : { x:door.x1, y:door.wallY-half, w:door.x2-door.x1, h:WALL_THICKNESS };
        rects.push({ ...expandedRect(rect, padding), roomId, doorId });
      }
    }
    return rects;
  }
  function getControlDoorAt(point, radius=0, padding=0) {
    const circle = { x:point?.x, y:point?.y, radius };
    return doorRects(padding).find(rect => circleIntersectsRect(circle, rect)) || null;
  }
  function getControlRoomAt(point) {
    for (const zone of CONTROL_CAPTURE_ZONES) {
      if (pointInPolygon(point, zone)) return zone.zoneId;
    }
    for (const [id, rect] of Object.entries(TERRITORY_ROOMS)) {
      if (rectContainsPoint(rect, point)) return id;
    }
    return null;
  }
  function getControlRegionAt(point, radius=0) {
    if (isOutsideWorld(point, radius)) return 'outside';
    if (isInsideWall(point, radius)) return 'wall';
    if (isInsideLockedCaptureZone(point, radius)) return 'lockedCapture';
    if (isInsideNeutralNoEffectZone(point)) return 'neutralNoEffect';
    return getControlRoomAt(point) || 'neutralNoEffect';
  }
  function isInsideCaptureCorner(point) {
    for (const zone of CONTROL_CAPTURE_ZONES) {
      if (STATE.lockedCaptureZones?.has(zone.zoneId)) continue;
      if (pointInPolygon(point, zone) && !isInsideWall(point, 0)) return zone.zoneId;
    }
    return null;
  }
  function spawnBlocked(point, radius=0) {
    return Object.values(SPAWN_POINTS).some(spawn => dist(point.x, point.y, spawn.x, spawn.y) <= SPAWN_NO_BUILD_RADIUS + radius);
  }
  function canPlaceStructureAt(point, structureRadius=0) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return {valid:false, reason:'INVALID POINT'};
    if (isOutsideWorld(point, structureRadius)) return {valid:false, reason:'OUTSIDE WORLD'};
    if (isInsideWall(point, structureRadius)) return {valid:false, reason:'BLOCKED BY WALL'};
    if (isInsideLockedCaptureZone(point, structureRadius)) return {valid:false, reason:'CAPTURE LOCKED'};
    if (getControlDoorAt(point, structureRadius, DOOR_NO_BUILD_PADDING)) return {valid:false, reason:'DOOR NO-BUILD'};
    if (isInsideNeutralNoEffectZone(point)) return {valid:false, reason:'NEUTRAL NO-BUILD'};
    const room = getControlRoomAt(point);
    if (!room) return {valid:false, reason:'NEUTRAL NO-BUILD'};
    if (spawnBlocked(point, structureRadius)) return {valid:false, reason:'SPAWN NO-BUILD'};
    return {valid:true, reason:'READY', room};
  }
  function canPlacePersistentTerrainAt(point, radius=0) {
    return canPlaceStructureAt(point, radius);
  }
  function wallCollisionInfo(circle, wall) {
    if (wall?.worldPoints?.length) {
      if (!circleIntersectsPolygon(circle, wall)) return null;
      const closest = closestPointOnPolygon(circle, wall);
      if (!closest) return null;
      let nx = circle.x - closest.point.x;
      let ny = circle.y - closest.point.y;
      let d = Math.hypot(nx, ny);
      if (d <= 0.001) {
        const edge = norm(closest.b.y - closest.a.y, -(closest.b.x - closest.a.x));
        nx = edge.x; ny = edge.y; d = 1;
      } else {
        nx /= d; ny /= d;
      }
      const inside = pointInPolygon(circle, wall);
      const push = inside ? (circle.radius || 0) + closest.distance + .01 : (circle.radius || 0) - closest.distance + .01;
      return {wall, nx, ny, push:Math.max(.01, push), side:Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 'right' : 'left') : (ny > 0 ? 'bottom' : 'top')};
    }
    const nearestX = clamp(circle.x, wall.x, wall.x + wall.w);
    const nearestY = clamp(circle.y, wall.y, wall.y + wall.h);
    let dx = circle.x - nearestX;
    let dy = circle.y - nearestY;
    let d = Math.hypot(dx, dy);
    const r = circle.radius || 0;
    if (d > 0 && d <= r) {
      const push = r - d + .01;
      const nx = dx / d;
      const ny = dy / d;
      return {wall, nx, ny, push, side:Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 'right' : 'left') : (ny > 0 ? 'bottom' : 'top')};
    }
    if (rectContainsPoint(wall, circle)) {
      const left = Math.abs(circle.x - wall.x);
      const right = Math.abs(wall.x + wall.w - circle.x);
      const top = Math.abs(circle.y - wall.y);
      const bottom = Math.abs(wall.y + wall.h - circle.y);
      const min = Math.min(left, right, top, bottom);
      if (min === left) return {wall, nx:-1, ny:0, push:r + left + .01, side:'left'};
      if (min === right) return {wall, nx:1, ny:0, push:r + right + .01, side:'right'};
      if (min === top) return {wall, nx:0, ny:-1, push:r + top + .01, side:'top'};
      return {wall, nx:0, ny:1, push:r + bottom + .01, side:'bottom'};
    }
    return null;
  }
  function resolveBattleWallCollision(f) {
    if (!STATE.active || !f || f.hp <= 0) return null;
    const r = f.radius || CONTROL_CONFIG.championRadius;
    const circle = {x:f.x, y:f.y, radius:r};
    let hit = null;
    const start = perfNow();
    forEachWallCandidate(expandedBoundsForCircle(circle), true, wall => {
      perfCount('wallCandidatesChecked');
      if (wall?.worldPoints?.length) perfCount('wallPolygonChecks');
      const info = wallCollisionInfo(circle, wall);
      if (info && (!hit || info.push > hit.push)) hit = info;
      return undefined;
    });
    perfAdd('wallCheckTimeSum', perfNow() - start);
    if (!hit) return null;
    f.x = clampWorldX(f.x + hit.nx * hit.push, r);
    f.y = clampWorldY(f.y + hit.ny * hit.push, r);
    if (Math.abs(hit.nx) > Math.abs(hit.ny)) f.dir.x = hit.nx > 0 ? Math.abs(f.dir.x || 0) : -Math.abs(f.dir.x || 0);
    else f.dir.y = hit.ny > 0 ? Math.abs(f.dir.y || 0) : -Math.abs(f.dir.y || 0);
    f.dir = norm(f.dir.x, f.dir.y);
    if (f.data) {
      f.data.apexWallHit = {id:hit.wall.id, side:hit.side, t:matchClock};
      if (f.data.deform !== undefined) f.data.deform = 0.35;
    }
    return {id:hit.wall.id, side:hit.side, wall:hit.wall};
  }
  function segmentIntersectsRect(x1, y1, x2, y2, rect, padding=0) {
    const r = expandedRect(rect, padding);
    if (rectContainsPoint(r, {x:x1,y:y1}) || rectContainsPoint(r, {x:x2,y:y2})) return true;
    const lines = [
      [r.x,r.y,r.x+r.w,r.y],
      [r.x+r.w,r.y,r.x+r.w,r.y+r.h],
      [r.x+r.w,r.y+r.h,r.x,r.y+r.h],
      [r.x,r.y+r.h,r.x,r.y]
    ];
    return lines.some(([a,b,c,d]) => segmentsIntersect(x1,y1,x2,y2,a,b,c,d));
  }
  function ccw(ax,ay,bx,by,cx,cy) { return (cy-ay)*(bx-ax) > (by-ay)*(cx-ax); }
  function segmentsIntersect(ax,ay,bx,by,cx,cy,dx,dy) {
    return ccw(ax,ay,cx,cy,dx,dy) !== ccw(bx,by,cx,cy,dx,dy) &&
      ccw(ax,ay,bx,by,cx,cy) !== ccw(ax,ay,bx,by,dx,dy);
  }
  function segmentIntersectsPolygon(x1, y1, x2, y2, polygon) {
    const pts = polygon?.worldPoints || [];
    if (pts.length < 3) return false;
    if (pointInPolygon({x:x1,y:y1}, polygon) || pointInPolygon({x:x2,y:y2}, polygon)) return true;
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (segmentsIntersect(x1,y1,x2,y2,a.x,a.y,b.x,b.y)) return true;
    }
    return false;
  }
  function raycastControlWall(x1, y1, x2, y2, padding=0) {
    const start = perfNow();
    perfCount('segmentWallChecks');
    const query = expandedBoundsForSegment(x1, y1, x2, y2, padding);
    const found = forEachWallCandidate(query, true, wall => {
      perfCount('wallCandidatesChecked');
      let hit = false;
      if (wall.worldPoints) {
        perfCount('wallPolygonChecks');
        hit = segmentIntersectsPolygon(x1,y1,x2,y2,wall);
      } else {
        hit = segmentIntersectsRect(x1,y1,x2,y2,wall,padding);
      }
      if (hit) {
        perfAdd('wallCheckTimeSum', perfNow() - start);
        return wall;
      }
      return undefined;
    });
    if (found) return found;
    perfAdd('wallCheckTimeSum', perfNow() - start);
    return null;
  }
  function segmentIntersectsWall(a, b, padding=0) {
    if (!a || !b) return null;
    return raycastControlWall(a.x, a.y, b.x, b.y, padding);
  }
  function wallBounceNormal(wall, point) {
    if (wall?.worldPoints?.length) {
      const closest = closestPointOnPolygon(point, wall);
      if (closest) {
        let nx = point.x - closest.point.x;
        let ny = point.y - closest.point.y;
        const d = Math.hypot(nx, ny);
        if (d > .001) return {x:nx / d, y:ny / d};
        const edge = norm(closest.b.y - closest.a.y, -(closest.b.x - closest.a.x));
        return edge;
      }
    }
    const b = wall?.worldPoints ? boundsFromPoints(wall.worldPoints) : wall;
    if (!b) return {x:-1,y:0};
    const dl = Math.abs(point.x - b.x);
    const dr = Math.abs(point.x - (b.x + b.w));
    const dt = Math.abs(point.y - b.y);
    const db = Math.abs(point.y - (b.y + b.h));
    const m = Math.min(dl, dr, dt, db);
    if (m === dl) return {x:-1,y:0};
    if (m === dr) return {x:1,y:0};
    if (m === dt) return {x:0,y:-1};
    return {x:0,y:1};
  }
  function reflectVector(v, n) {
    const d = (v.x || 0) * n.x + (v.y || 0) * n.y;
    return {x:(v.x || 0) - 2 * d * n.x, y:(v.y || 0) - 2 * d * n.y};
  }
  function hasLineOfSight(a, b, padding=0) {
    return !segmentIntersectsWall(a, b, padding);
  }
  function projectileHitsWall(p, dt=0) {
    if (!STATE.active || !p || p._dead || p.life <= 0 || p.__apexWallChecked) return null;
    if (p.__apexControlManaged || p.type === 'string_wall_thread' || p.visualOnly || isPersistentTerrainProjectile(p)) return null;
    let a = null, b = null;
    if (Number.isFinite(p.x1) && Number.isFinite(p.y1) && Number.isFinite(p.x2) && Number.isFinite(p.y2)) {
      a = {x:p.x1,y:p.y1};
      b = {x:p.x2,y:p.y2};
    } else if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
      b = {x:p.x,y:p.y};
      if (Number.isFinite(p.prevX) && Number.isFinite(p.prevY)) a = {x:p.prevX,y:p.prevY};
      else if (Number.isFinite(p.vx) && Number.isFinite(p.vy) && dt > 0) a = {x:p.x - p.vx * dt,y:p.y - p.vy * dt};
      else a = b;
    }
    if (!a || !b) return null;
    const padding = isReflectableBladeWave(p) ? Math.min(72, (p.halfWidth || p.radius || 0) * .32) : Math.min(24, p.radius || p.width || 0);
    return segmentIntersectsWall(a, b, padding);
  }
  function isReflectableBladeWave(p) {
    return !!p && /blade_wave|black_wave|katana_blade_wave/i.test(String(p.type || ''));
  }
  function bounceOrKillBladeProjectile(p, hit, dt=0) {
    if (!p || !hit) return false;
    const owner = p.owner;
    const canBounce = !!owner?.isRage && (p.bounces || 0) > 0;
    if (!canBounce) {
      p.life = 0;
      p._dead = true;
      p.__apexWallHit = hit.id || true;
      spawnShockwave?.(p.x || p.x2 || 0, p.y || p.y2 || 0, '#f4fbff', 95);
      return true;
    }
    const n = wallBounceNormal(hit, {x:p.x || p.x2 || 0, y:p.y || p.y2 || 0});
    const reflected = reflectVector({x:p.vx || 0, y:p.vy || 0}, n);
    const speed = Math.hypot(p.vx || 0, p.vy || 0) || Math.hypot(reflected.x, reflected.y) || 900;
    const dir = norm(reflected.x, reflected.y);
    p.vx = dir.x * speed;
    p.vy = dir.y * speed;
    p.x = (p.prevX ?? p.x ?? 0) + dir.x * Math.max(12, speed * Math.max(dt, 1 / 120));
    p.y = (p.prevY ?? p.y ?? 0) + dir.y * Math.max(12, speed * Math.max(dt, 1 / 120));
    p.bounces -= 1;
    p.hit = false;
    p.hitIds = {};
    p.__apexWallBounce = {id:hit.id || true, t:matchClock};
    spawnShockwave?.(p.x, p.y, '#f4fbff', 90);
    return true;
  }
  function enforceProjectileWallBlocking(dt) {
    if (!STATE.active || !Array.isArray(projectiles)) return;
    for (const p of projectiles) {
      const hit = projectileHitsWall(p, dt);
      if (!hit) continue;
      if (isReflectableBladeWave(p)) {
        bounceOrKillBladeProjectile(p, hit, dt);
        continue;
      }
      p.life = 0;
      p._dead = true;
      p.__apexWallHit = hit.id || true;
      if (/rocket|missile|explosion/i.test(String(p.type || ''))) {
        spawnShockwave?.(p.x || p.x2 || 0, p.y || p.y2 || 0, '#ffdf7b', 120);
      }
    }
  }
  function enforceKatanaWaveWalls(dt) {
    const waves = window.APEX_KATANA?.state?.waves;
    if (!STATE.active || !Array.isArray(waves)) return;
    for (const w of waves) {
      if (!w || w.life <= 0 || w.hit || !Number.isFinite(w.prevX) || !Number.isFinite(w.prevY) || !Number.isFinite(w.x) || !Number.isFinite(w.y)) continue;
      const hit = segmentIntersectsWall({x:w.prevX,y:w.prevY}, {x:w.x,y:w.y}, 12);
      if (!hit) continue;
      if (w.owner?.isRage) {
        const n = wallBounceNormal(hit, {x:w.x,y:w.y});
        const reflected = reflectVector(w.dir || {x:0,y:0}, n);
        w.dir = norm(reflected.x, reflected.y);
        w.x = w.prevX + w.dir.x * Math.max(14, (w.speed || 900) * Math.max(dt, 1 / 120));
        w.y = w.prevY + w.dir.y * Math.max(14, (w.speed || 900) * Math.max(dt, 1 / 120));
        w.bounces = (w.bounces || 0) + 1;
        w.damage = Math.max(0, (w.damage || 0) * .9);
        if (w.bounces >= 10 || w.damage <= 0) w.life = 0;
        spawnShockwave?.(w.x, w.y, '#ff99c8', 80);
      } else {
        w.life = 0;
        w.hit = true;
        w.held = false;
        w.brightHeld = false;
        w.brightRealUntil = 0;
        spawnShockwave?.(w.x, w.y, '#ffc5e4', 82);
      }
    }
  }
  window.APEX_CONTROL_BATTLE_WALLS = {
    active:() => !!STATE.active,
    getWalls:() => WALL_SEGMENTS,
    resolveFighterWall:resolveBattleWallCollision,
    isBlocked:(x,y,radius=0) => isBlockedCircle(x,y,radius),
    raycast:raycastControlWall,
    segmentIntersectsWall,
    hasLineOfSight,
    projectileHitsWall,
    enforceKatanaWaveWalls
  };
  function isBlockedCircle(x, y, radius) {
    return isOutsideWorld({x,y}, radius) || isInsideWall({x,y,radius}) || isInsideLockedCaptureZone({x,y,radius});
  }
  function isKatanaCinematicAction(f) {
    const action = f?.name === 'KATANA' ? f.data?.katana?.action : null;
    return !!action && (action.type === 'one' || action.type === 'twin' || action.type === 'infinite');
  }
  function isManualKatanaControl(f) {
    return !!(f?.name === 'KATANA' && f.data?.manualController?.mode === 'MANUAL_LAB' && f.data.manualController.active);
  }
  function resolveControlMovement(f, before) {
    if (!f || !before || f.hp <= 0) return;
    if (isKatanaCinematicAction(f) && !isManualKatanaControl(f)) return;
    const r = f.radius || CONTROL_CONFIG.championRadius;
    f.x = clampWorldX(f.x, r);
    f.y = clampWorldY(f.y, r);
    if (!isBlockedCircle(f.x, f.y, r)) return;
    const target = {x:f.x, y:f.y};
    const tryX = {x:clampWorldX(target.x, r), y:clampWorldY(before.y, r)};
    if (!isBlockedCircle(tryX.x, tryX.y, r)) {
      f.x = tryX.x;
      f.y = tryX.y;
      return;
    }
    const tryY = {x:clampWorldX(before.x, r), y:clampWorldY(target.y, r)};
    if (!isBlockedCircle(tryY.x, tryY.y, r)) {
      f.x = tryY.x;
      f.y = tryY.y;
      return;
    }
    f.x = clampWorldX(before.x, r);
    f.y = clampWorldY(before.y, r);
  }
  function enforceMovementSegmentWall(f, before) {
    if (!STATE.active || !f || !before || f.hp <= 0) return false;
    if (isKatanaCinematicAction(f)) return false;
    const r = f.radius || CONTROL_CONFIG.championRadius;
    const end = {x:f.x,y:f.y};
    if (dist(before.x,before.y,end.x,end.y) < 4) return false;
    if (!segmentIntersectsWall(before, end, Math.min(42, r * .45)) && !isBlockedCircle(end.x, end.y, r)) return false;
    let lo = 0, hi = 1;
    let best = {x:before.x,y:before.y};
    for (let i = 0; i < 10; i += 1) {
      const mid = (lo + hi) / 2;
      const p = {x:lerp(before.x,end.x,mid), y:lerp(before.y,end.y,mid)};
      if (!isBlockedCircle(p.x, p.y, r) && !segmentIntersectsWall(before, p, Math.min(42, r * .45))) {
        best = p;
        lo = mid;
      } else hi = mid;
    }
    f.x = clampWorldX(best.x, r);
    f.y = clampWorldY(best.y, r);
    if (f.data?.katana?.manual?.qDash) f.data.katana.manual.qDash = null;
    return true;
  }
  function pointAtAimRange(f, aim, range=100) {
    if (!f || !aim || !Number.isFinite(aim.x) || !Number.isFinite(aim.y)) return null;
    const dir = norm(aim.x - f.x, aim.y - f.y);
    if (!dir.x && !dir.y) return null;
    return {x:clampWorldX(f.x + dir.x * range, 0), y:clampWorldY(f.y + dir.y * range, 0)};
  }
  function engineerHasActiveConstruction(f) {
    const d = f?.name === 'ENGINEER' ? window.APEX_ENGINEER?.ownerData?.(f) : null;
    return !!(d?.structures || []).some(s => s && !s.dead && s.hp > 0 && s.state === 'building');
  }
  function controlPlacementStatus(f, kind, x, y, buildRange=100) {
    const api = engineerApi();
    const radius = structurePlacementRadius(api, kind);
    const mapStatus = canPlaceStructureAt({x,y}, radius);
    if (!mapStatus.valid) {
      return {
        valid:false,
        committed:false,
        reason:mapStatus.reason,
        kind,
        radius,
        room:mapStatus.room || null,
        distance:f ? dist(f.x, f.y, x, y) : Infinity,
        range:buildRange
      };
    }
    const engineStatus = api?.placementStatus?.(f, kind, x, y, buildRange) || {valid:false, reason:'ENGINEER API MISSING'};
    return { ...engineStatus, room:mapStatus.room, radius };
  }
  window.APEX_CONTROL_MAP = {
    world:APEX_CONTROL_WORLD,
    runtime:CONTROL_RUNTIME_MAP,
    neutral:{ core:NEUTRAL_CORE, verticalLane:NEUTRAL_VERTICAL_LANE, horizontalLane:NEUTRAL_HORIZONTAL_LANE },
    rooms:TERRITORY_ROOMS,
    walls:WALL_SEGMENTS,
    captureZones:CONTROL_CAPTURE_ZONES,
    activeZones:CONTROL_ACTIVE_ZONES,
    captureRings:CONTROL_CAPTURE_RINGS,
    turretSpawns:CONTROL_TURRET_SPAWNS,
    bossSpawns:CONTROL_BOSS_SPAWNS,
    doors:DOORS,
    doorRects,
    captureCorners:CAPTURE_CORNERS,
    spawnPoints:SPAWN_POINTS,
    getRegionAt:getControlRegionAt,
    getDoorAt:getControlDoorAt,
    getRoomAt:getControlRoomAt,
    getCaptureCornerAt:isInsideCaptureCorner,
    isInsideWall,
    isInsideLockedCaptureZone,
    isInsideNeutralNoEffectZone,
    canPlaceStructureAt,
    canPlacePersistentTerrainAt
  };
  const TERRITORY_LABELS = Object.freeze({
    p1Base:'P1 Base',
    topRightSpecial:'HEAL',
    bottomLeftSpecial:'RAGE',
    p2Base:'P2 Base'
  });
  function playerIdForIndex(index) { return index === 1 ? 'p2' : 'p1'; }
  function indexForPlayerId(id) { return id === 'p2' ? 1 : 0; }
  function fighterPlayerId(f) {
    const index = (fighters || []).indexOf(f);
    return index === 0 || index === 1 ? playerIdForIndex(index) : null;
  }
  function isRealControlChampion(f) {
    const id = fighterPlayerId(f);
    const life = id ? lifecycleForPlayer(id) : null;
    return !!(STATE.active && id && f && f.hp > 0 && (!life || (life.alive && !life.dead && life.canCapture)));
  }
  function territoryType(roomId) {
    if (roomId === 'p1Base' || roomId === 'p2Base') return 'base';
    if (roomId === 'topRightSpecial') return 'healPoint';
    if (roomId === 'bottomLeftSpecial') return 'ragePoint';
    return STATE.specialAssignments?.[roomId] || 'neutralPoint';
  }
  function createTerritoryState() {
    return Object.fromEntries(Object.keys(TERRITORY_ROOMS).map(roomId => [roomId, {
      id:roomId,
      roomId,
      type:territoryType(roomId),
      owner:null,
      status:'neutral',
      captureProgress:0,
      stealProgress:0,
      disabled:false,
      contested:false,
      actor:null,
      lastAction:null
    }]));
  }
  function ownedTerritoryCount(owner) {
    return Object.values(STATE.territories || {}).filter(t => t.owner === owner).length;
  }
  function getOwnedTerritories(owner) {
    return Object.values(STATE.territories || {}).filter(t => t.owner === owner);
  }
  function isRespawnTerritory(territory, owner) {
    return !!territory && territory.owner === owner && !territory.disabled && territory.status !== 'disabled';
  }
  function getRespawnTerritories(owner) {
    return Object.values(STATE.territories || {}).filter(t => isRespawnTerritory(t, owner));
  }
  function respawnTerritoryCount(owner) {
    return getRespawnTerritories(owner).length;
  }
  function createLifecycleState() {
    const make = () => ({
      alive:true,
      dead:false,
      respawnTimer:0,
      respawnPhase:null,
      respawnProtectionTimer:0,
      invulnerable:false,
      canMove:true,
      canAttack:true,
      canDealDamage:true,
      canCapture:true,
      respawnTarget:null,
      deathReason:null,
      warning:null
    });
    return {p1:make(), p2:make()};
  }
  function lifecycleForPlayer(owner) {
    return STATE.lifecycle?.[owner] || null;
  }
  function lifecycleForFighter(f) {
    const owner = fighterPlayerId(f);
    return owner ? lifecycleForPlayer(owner) : null;
  }
  function isLifecycleActive(owner) {
    const life = lifecycleForPlayer(owner);
    return !!(life && life.alive && !life.dead);
  }
  function createLevelState() {
    const make = () => ({level:1, xp:0, hpUpgrades:0, damageUpgrades:0, pending:false, pendingLevel:0, choices:['hp','damage']});
    return {p1:make(), p2:make()};
  }
  function levelState(owner) {
    return STATE.levels?.[owner] || null;
  }
  function xpForNextLevel(owner) {
    const level = levelState(owner)?.level || 1;
    return CONTROL_LEVEL_XP[level - 1] || Infinity;
  }
  function playerDamageLevelMultiplier(owner) {
    return 1 + 0.2 * (levelState(owner)?.damageUpgrades || 0);
  }
  function playerMaxHpForLevel(owner) {
    return CONTROL_CONFIG.playerHp + 100 * (levelState(owner)?.hpUpgrades || 0);
  }
  function applyPlayerLevelStats(owner, healDelta=false) {
    const f = fighterForPlayer(owner);
    if (!f) return;
    const nextMax = playerMaxHpForLevel(owner);
    const oldMax = f.maxHp || CONTROL_CONFIG.playerHp;
    f.maxHp = nextMax;
    if (healDelta && nextMax > oldMax) f.hp = Math.min(nextMax, (f.hp || 0) + (nextMax - oldMax));
    else f.hp = Math.min(f.hp || nextMax, nextMax);
  }
  function applyAllPlayerLevelStats() {
    applyPlayerLevelStats('p1');
    applyPlayerLevelStats('p2');
  }
  function addPlayerXp(owner, amount, reason='creep') {
    const level = levelState(owner);
    if (!level || amount <= 0 || level.level >= CONTROL_CONFIG.maxLevel) return;
    level.xp += amount;
    while (!level.pending && level.level < CONTROL_CONFIG.maxLevel && level.xp >= xpForNextLevel(owner)) {
      level.xp -= xpForNextLevel(owner);
      level.pending = true;
      level.pendingLevel = level.level + 1;
      feedback(`${owner.toUpperCase()} LEVEL UP - CHOOSE HP OR DAMAGE`, true, 1.6);
    }
  }
  function chooseControlUpgrade(owner, choice) {
    const level = levelState(owner);
    if (!level?.pending) return false;
    const pick = choice === 'hp' ? 'hp' : 'damage';
    level.level = Math.min(CONTROL_CONFIG.maxLevel, level.pendingLevel || level.level + 1);
    level.pending = false;
    level.pendingLevel = 0;
    if (pick === 'hp') {
      level.hpUpgrades += 1;
      applyPlayerLevelStats(owner, true);
    } else {
      level.damageUpgrades += 1;
    }
    const f = fighterForPlayer(owner);
    if (f) floatingTexts.push(new FloatingText(f.x, f.y - f.radius - 100, `LV ${level.level} ${pick === 'hp' ? '+100 HP' : '+20% DMG'}`, pick === 'hp' ? '#9cffad' : '#ffe58d'));
    if (level.level < CONTROL_CONFIG.maxLevel && level.xp >= xpForNextLevel(owner)) {
      level.pending = true;
      level.pendingLevel = level.level + 1;
    }
    return true;
  }
  function chooseBotUpgradeIfPending() {
    const level = levelState('p2');
    if (!level?.pending) return false;
    const bot = fighterForPlayer('p2');
    const enemy = fighterForPlayer('p1');
    const lowHp = bot && bot.hp / Math.max(1, bot.maxHp || 1) < .45;
    const behind = enemy && bot && (bot.hp < enemy.hp * .75 || (level.level < (levelState('p1')?.level || 1)));
    return chooseControlUpgrade('p2', (lowHp || behind || level.damageUpgrades > level.hpUpgrades + 1) ? 'hp' : 'damage');
  }
  function canPlayerCapture(owner) {
    const life = lifecycleForPlayer(owner);
    return !!(life && life.alive && !life.dead && life.canCapture);
  }
  function endApexMatch(winner, reason) {
    if (!STATE.active || STATE.match?.state === 'ended') return;
    STATE.match = {
      state:'ended',
      winner,
      endReason:reason,
      message:winner === 'p1'
        ? (reason === 'territory_dominance' ? 'P1 WINS - TERRITORY DOMINANCE' : 'P1 WINS - P2 HAS NO RESPAWN TERRITORY')
        : (reason === 'territory_dominance' ? 'P2 WINS - TERRITORY DOMINANCE' : 'P2 WINS - P1 HAS NO RESPAWN TERRITORY')
    };
    STATE.dominance = {active:false, playerId:null, timer:0, lastCanceled:null};
    input.clear();
    remoteInput.clear();
    if (STATE.bot) STATE.bot.action = 'match-ended';
    feedback(STATE.match.message, true, 4);
  }
  function chooseRespawnTerritory(owner, opponent) {
    const owned = getRespawnTerritories(owner);
    if (!owned.length) return {territory:null, warning:'NO OWNED TERRITORY'};
    const sorted = owned.slice().sort((a,b) => {
      const pa = SPAWN_POINTS[a.roomId] || captureTargetPoint(a.roomId);
      const pb = SPAWN_POINTS[b.roomId] || captureTargetPoint(b.roomId);
      const ax = opponent?.x ?? worldCenter().x, ay = opponent?.y ?? worldCenter().y;
      return dist(pb.x,pb.y,ax,ay) - dist(pa.x,pa.y,ax,ay);
    });
    const valid = sorted.find(t => {
      const p = SPAWN_POINTS[t.roomId];
      return p && !isOutsideWorld(p, 0) && !isInsideWall(p, CONTROL_CONFIG.championRadius) && !getControlDoorAt(p, CONTROL_CONFIG.championRadius, 0) && !isInsideNeutralNoEffectZone(p);
    });
    return valid ? {territory:valid, warning:null} : {territory:sorted[0], warning:'RESPAWN FALLBACK'};
  }
  function respawnPointForTerritory(roomId, opponent) {
    const r = CONTROL_CONFIG.championRadius;
    const candidates = [];
    const marker = SPAWN_POINTS[roomId];
    if (marker) candidates.push({...marker, tag:'export-spawn-marker'});
    const zone = zoneById(CONTROL_CAPTURE_ZONES, roomId);
    if (zone?.center) candidates.push({x:zone.center.x,y:zone.center.y,tag:'capture-center'});
    const bounds = zone?.bounds || (zone?.worldPoints?.length ? boundsFromPoints(zone.worldPoints) : null);
    if (bounds) candidates.push({x:bounds.x + bounds.w / 2, y:bounds.y + bounds.h / 2, tag:'capture-bounds-center'});
    candidates.push({...captureTargetPoint(roomId), tag:'capture-target'});
    const valid = candidates.find(p => Number.isFinite(p.x) && Number.isFinite(p.y)
      && !isOutsideWorld(p, r) && !isBlockedCircle(p.x, p.y, r) && !getControlDoorAt(p, r, 0));
    if (valid) return {point:valid, warning:valid.tag === 'export-spawn-marker' ? null : `RESPAWN FALLBACK ${valid.tag}`};
    for (const p of candidates) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const unclipped = {x:clampWorldX(p.x, r), y:clampWorldY(p.y, r), tag:p.tag};
      if (!isInsideWall(unclipped, r)) return {point:unclipped, warning:`RESPAWN CLAMPED ${p.tag}`};
    }
    // TODO(control-respawn): if a future export provides separate safe respawn sockets, prefer those over capture center.
    return {point:{...worldCenter()}, warning:'RESPAWN FALLBACK WORLD CENTER'};
  }
  function seedHomeBaseOwnership() {
    const seeds = [['p1Base','p1'], ['p2Base','p2']];
    for (const [roomId, owner] of seeds) {
      const territory = STATE.territories?.[roomId];
      if (!territory) continue;
      territory.owner = owner;
      territory.actor = null;
      territory.captureProgress = 0;
      territory.status = 'owned';
      territory.disabled = false;
      territory.justCapturedTimer = 0;
    }
  }
  function markPlayerDead(owner, reason='hp_zero') {
    if (STATE.match?.state === 'ended') return;
    const life = lifecycleForPlayer(owner);
    const f = fighterForPlayer(owner);
    if (!life || life.dead) return;
    life.alive = false;
    life.dead = true;
    life.canMove = false;
    life.canAttack = false;
    life.canDealDamage = false;
    life.canCapture = false;
    life.invulnerable = true;
    life.respawnPhase = 'dead';
    life.deathReason = reason;
    if (f) {
      clearEngineerPilotState(f);
      f.hp = 0;
      f.statuses ||= {};
      f.data ||= {};
      f.data.positionLocked = true;
      f.setDir?.(0,0);
    }
    if (respawnTerritoryCount(owner) <= 0) {
      if (f) f.hp = 0;
      endApexMatch(owner === 'p1' ? 'p2' : 'p1', 'no_respawn_right');
      return;
    }
    if (f) f.hp = 0.01;
    life.respawnTimer = CONTROL_CONFIG.respawnSeconds;
    const target = chooseRespawnTerritory(owner, fighterForPlayer(owner === 'p1' ? 'p2' : 'p1'));
    life.respawnTarget = target.territory?.roomId || null;
    life.warning = target.warning;
  }
  function respawnPlayer(owner) {
    const life = lifecycleForPlayer(owner);
    const f = fighterForPlayer(owner);
    if (!life || !f || STATE.match?.state === 'ended') return;
    const target = chooseRespawnTerritory(owner, fighterForPlayer(owner === 'p1' ? 'p2' : 'p1'));
    const roomId = target.territory?.roomId || life.respawnTarget;
    const respawn = respawnPointForTerritory(roomId, fighterForPlayer(owner === 'p1' ? 'p2' : 'p1'));
    const point = respawn.point;
    f.x = point.x;
    f.y = point.y;
    applyPlayerLevelStats(owner);
    f.hp = f.maxHp || playerMaxHpForLevel(owner);
    f.statuses = {};
    f.data ||= {};
    f.data.positionLocked = true;
    life.alive = true;
    life.dead = false;
    life.respawnTimer = 0;
    life.respawnProtectionTimer = 2;
    life.respawnPhase = 'locked';
    life.invulnerable = true;
    life.canMove = false;
    life.canAttack = false;
    life.canDealDamage = false;
    life.canCapture = false;
    life.respawnTarget = roomId;
    life.warning = respawn.warning || target.warning;
  }
  function updateLifecycleFlags(owner) {
    const life = lifecycleForPlayer(owner);
    if (!life || life.dead) return;
    if (life.respawnProtectionTimer > 1) {
      life.respawnPhase = 'locked';
      life.invulnerable = true;
      life.canMove = false;
      life.canAttack = false;
      life.canDealDamage = false;
      life.canCapture = false;
    } else if (life.respawnProtectionTimer > 0) {
      life.respawnPhase = 'moveOnly';
      life.invulnerable = true;
      life.canMove = true;
      life.canAttack = false;
      life.canDealDamage = false;
      life.canCapture = false;
    } else {
      life.respawnPhase = null;
      life.invulnerable = false;
      life.canMove = true;
      life.canAttack = true;
      life.canDealDamage = true;
      life.canCapture = true;
    }
  }
  function updateLifecycle(dt) {
    if (!STATE.lifecycle || STATE.match?.state === 'ended') return;
    for (const owner of ['p1','p2']) {
      const life = lifecycleForPlayer(owner);
      const f = fighterForPlayer(owner);
      if (!life || !f) continue;
      if (!life.dead && f.hp <= 0) markPlayerDead(owner, 'hp_zero');
      if (life.dead) {
        if (respawnTerritoryCount(owner) <= 0) {
          if (f) f.hp = 0;
          endApexMatch(owner === 'p1' ? 'p2' : 'p1', 'no_respawn_right');
          continue;
        }
        life.respawnTimer = Math.max(0, life.respawnTimer - dt);
      if (f) {
          f.hp = Math.max(0.01, f.hp || 0.01);
          f.data ||= {};
          f.data.positionLocked = true;
        }
        if (life.respawnTimer <= 0 && respawnTerritoryCount(owner) > 0) respawnPlayer(owner);
        continue;
      }
      if (life.respawnProtectionTimer > 0) life.respawnProtectionTimer = Math.max(0, life.respawnProtectionTimer - dt);
      updateLifecycleFlags(owner);
      if (!life.canMove && f?.data) f.data.positionLocked = true;
      else if (life.canMove && f?.data?.positionLocked && !f.data.apexControlBoss) f.data.positionLocked = false;
    }
  }
  function updateDominance(dt) {
    if (!STATE.territories || STATE.match?.state === 'ended') return;
    const mainZones = getMainControlZones();
    for (const owner of ['p1','p2']) {
      if (mainZones.length && mainZones.every(roomId => STATE.territories?.[roomId]?.owner === owner)) {
        endApexMatch(owner, 'all_main_zones_controlled');
        return;
      }
    }
    const p1Count = ownedTerritoryCount('p1');
    const p2Count = ownedTerritoryCount('p2');
    const required = CONTROL_CONFIG.dominanceRequiredTerritories;
    const leader = p1Count >= required ? 'p1' : p2Count >= required ? 'p2' : null;
    if (!leader) {
      if (STATE.dominance?.active) STATE.dominance.lastCanceled = STATE.dominance.playerId;
      STATE.dominance = {active:false, playerId:null, timer:0, lastCanceled:STATE.dominance?.lastCanceled || null};
      return;
    }
    if (!STATE.dominance?.active || STATE.dominance.playerId !== leader) {
      STATE.dominance = {active:true, playerId:leader, timer:0, lastCanceled:null};
      return;
    }
    STATE.dominance.timer = Math.min(CONTROL_CONFIG.dominanceCountdownSeconds, STATE.dominance.timer + dt);
    if (STATE.dominance.timer >= CONTROL_CONFIG.dominanceCountdownSeconds && ownedTerritoryCount(leader) >= required) {
      endApexMatch(leader, 'territory_dominance');
    }
  }
  function getMainControlZones() {
    const ids = [...new Set((CONTROL_CAPTURE_ZONES || []).map(zone => zone.zoneId).filter(Boolean))];
    return ids.length ? ids : Object.keys(STATE.territories || TERRITORY_ROOMS);
  }
  function captureRequirement(territory, actor) {
    if (!territory) return CONTROL_CONFIG.neutralCaptureSeconds;
    if (territory.type === 'base' && territory.owner == null) return CONTROL_CONFIG.baseSecureSeconds;
    return CONTROL_CONFIG.neutralCaptureSeconds;
  }
  function canCaptureNeutral(territory, actor) {
    if (!territory || territory.owner != null || !actor) return false;
    if (territory.roomId === 'p1Base') return actor === 'p1';
    if (territory.roomId === 'p2Base') return actor === 'p2';
    return true;
  }
  function playersInCaptureCorner(roomId) {
    const out = [];
    for (const f of fighters || []) {
      if (!isRealControlChampion(f)) continue;
      if (isInsideCaptureCorner({x:f.x,y:f.y}) === roomId) out.push(fighterPlayerId(f));
    }
    return [...new Set(out)];
  }
  function applyTerritoryProgress(roomId, actor, seconds, kind='capture') {
    const territory = STATE.territories?.[roomId];
    if (!territory || !actor || seconds <= 0) return;
    if (kind === 'steal' || (territory.owner && territory.owner !== actor)) {
      territory.stealProgress = clamp((territory.stealProgress || 0) + seconds, 0, CONTROL_CONFIG.stealSeconds);
      territory.actor = actor;
      if (territory.stealProgress >= CONTROL_CONFIG.disabledSeconds && territory.owner !== actor) {
        territory.disabled = true;
        territory.status = 'disabled';
      }
      if (territory.stealProgress >= CONTROL_CONFIG.stealSeconds) {
        territory.owner = actor;
        territory.stealProgress = 0;
        territory.captureProgress = 0;
        territory.disabled = false;
        territory.status = 'owned';
      }
      return;
    }
    if (canCaptureNeutral(territory, actor)) {
      const req = captureRequirement(territory, actor);
      territory.captureProgress = clamp((territory.captureProgress || 0) + seconds, 0, req);
      territory.actor = actor;
      territory.status = 'capturing';
      if (territory.captureProgress >= req) {
        territory.owner = actor;
        territory.captureProgress = 0;
        territory.stealProgress = 0;
        territory.disabled = false;
        territory.status = 'owned';
      }
    }
  }
  function updateTerritories(dt) {
    if (!STATE.territories) return;
    STATE.captureContest = false;
    for (const territory of Object.values(STATE.territories)) {
      territory.type = territoryType(territory.roomId);
      const occupants = playersInCaptureCorner(territory.roomId);
      territory.contested = occupants.length > 1;
      if (territory.contested) {
        territory.status = 'contested';
        STATE.captureContest = true;
        continue;
      }
      const actor = occupants[0] || null;
      if (actor) {
        territory.actor = actor;
        if (territory.owner == null && canCaptureNeutral(territory, actor)) {
          const req = captureRequirement(territory, actor);
          territory.captureProgress = clamp(territory.captureProgress + dt, 0, req);
          territory.status = 'capturing';
          territory.lastAction = `CAPTURING ${TERRITORY_LABELS[territory.roomId]}`;
          if (territory.captureProgress >= req) {
            territory.owner = actor;
            territory.captureProgress = 0;
            territory.status = 'owned';
            territory.lastAction = `OWNED BY ${actor.toUpperCase()}`;
          }
        } else if (territory.owner && territory.owner !== actor) {
          territory.stealProgress = clamp(territory.stealProgress + dt, 0, CONTROL_CONFIG.stealSeconds);
          territory.status = territory.stealProgress >= CONTROL_CONFIG.disabledSeconds ? 'disabled' : 'stealing';
          territory.disabled = territory.stealProgress >= CONTROL_CONFIG.disabledSeconds;
          territory.lastAction = `STEALING ${TERRITORY_LABELS[territory.roomId]}`;
          if (territory.stealProgress >= CONTROL_CONFIG.stealSeconds) {
            territory.owner = actor;
            territory.stealProgress = 0;
            territory.captureProgress = 0;
            territory.disabled = false;
            territory.status = 'owned';
            territory.lastAction = `STOLEN BY ${actor.toUpperCase()}`;
          }
        } else {
          territory.status = territory.owner ? 'owned' : 'neutral';
          territory.disabled = false;
        }
      } else {
        territory.captureProgress = Math.max(0, territory.captureProgress - dt / 1.5);
        territory.stealProgress = Math.max(0, territory.stealProgress - dt / 1.2);
        if (territory.stealProgress < CONTROL_CONFIG.disabledSeconds) territory.disabled = false;
        territory.status = territory.owner ? (territory.disabled ? 'disabled' : 'owned') : (territory.captureProgress > 0 ? 'capturing' : 'neutral');
        territory.contested = false;
      }
    }
  }
  function applyKillProgressBonus(killer, victim) {
    const killerId = fighterPlayerId(killer);
    const victimId = fighterPlayerId(victim);
    const killerLife = killerId ? lifecycleForPlayer(killerId) : null;
    if (!STATE.active || !killerId || !victimId || !killer || !victim || killer.hp <= 0 || (killerLife && !killerLife.canDealDamage)) return;
    const actor = fighterPlayerId(killer);
    const roomId = isInsideCaptureCorner({x:victim.x,y:victim.y});
    const territory = roomId ? STATE.territories?.[roomId] : null;
    if (!territory) return;
    let bonus = 0;
    let kind = 'capture';
    if (territory.owner == null) bonus = 2.5;
    else if (territory.owner !== actor) {
      bonus = territory.owner === victimId ? 5 : 4;
      kind = 'steal';
    }
    if (bonus > 0) {
      applyTerritoryProgress(roomId, actor, bonus, kind);
      STATE.lastKillBonus = {roomId, actor, bonus, kind, t:matchClock};
    }
  }
  function createEffectState() {
    return {
      heal:{p1:'OFF',p2:'OFF'},
      rage:{p1:'OFF',p2:'OFF'},
      turret:{p1Base:'OFF',p2Base:'OFF'},
      lastDamageAt:{p1:-999,p2:-999}
    };
  }
  function fighterForPlayer(owner) {
    return fighters?.[indexForPlayerId(owner)] || null;
  }
  function territoryForType(type) {
    return Object.values(STATE.territories || {}).find(t => t.type === type) || null;
  }
  function isEffectSuppressed(territory) {
    return !territory || !territory.owner || territory.disabled || territory.status === 'disabled';
  }
  function isFighterInEffectRoom(f, roomId) {
    if (!f || f.hp <= 0 || !roomId) return false;
    const point = {x:f.x,y:f.y};
    return getControlRoomAt(point) === roomId &&
      !isInsideNeutralNoEffectZone(point) &&
      !getControlDoorAt(point, f.radius || 0, 0) &&
      !isInsideWall(point, f.radius || 0);
  }
  function isCaptureContestAt(roomId) {
    return !!STATE.territories?.[roomId]?.contested;
  }
  function zoneById(collection, zoneId) {
    return (collection || []).find(zone => zone.zoneId === zoneId) || null;
  }
  function markerForFallbackActive(zoneId) {
    const role = zoneId === 'topRightSpecial' ? 'boss_string'
      : zoneId === 'bottomLeftSpecial' ? 'boss_shotgun'
        : zoneId === 'p1Base' ? 'p1'
          : zoneId === 'p2Base' ? 'p2'
            : '';
    return (CONTROL_BOSS_SPAWNS || []).find(spawn => spawn.markerType === role || spawn.role === role)
      || (CONTROL_RUNTIME_MAP?.spawnPoints || []).find(spawn => spawn.zoneId === zoneId || spawn.role === role)
      || null;
  }
  function fallbackActiveZoneForZone(zoneId) {
    const room = TERRITORY_ROOMS[zoneId];
    if (!room) return null;
    const marker = markerForFallbackActive(zoneId);
    const center = pointFromMarker(marker, {x:room.x + room.w / 2, y:room.y + room.h / 2});
    const w = Math.min(Math.max(760, room.w * .68), room.w);
    const h = Math.min(Math.max(760, room.h * .68), room.h);
    const x = clamp(center.x - w / 2, room.x, Math.max(room.x, room.x + room.w - w));
    const y = clamp(center.y - h / 2, room.y, Math.max(room.y, room.y + room.h - h));
    return {
      id:`${zoneId}-fallback-active`,
      zoneId,
      role:`${territoryType(zoneId)}_active_fallback`,
      x,y,w,h,
      bounds:{x,y,w,h},
      fallback:true,
      fallbackReason:'missing explicit active polygon; using boss/spawn room area instead of locked capture polygon'
    };
  }
  function rectZoneContains(zone, point) {
    const rect = zone?.bounds || zone;
    return !!rect && rectContainsPoint(rect, point);
  }
  function activeZoneForZone(zoneId) {
    const explicit = zoneById(CONTROL_ACTIVE_ZONES, zoneId);
    if (explicit) return explicit;
    return fallbackActiveZoneForZone(zoneId);
  }
  function activeZonesForDebug() {
    const seen = new Set();
    const zones = [];
    for (const zone of CONTROL_ACTIVE_ZONES) {
      if (!zone?.zoneId || seen.has(zone.zoneId)) continue;
      seen.add(zone.zoneId);
      zones.push(zone);
    }
    for (const zoneId of Object.keys(TERRITORY_ROOMS)) {
      if (seen.has(zoneId)) continue;
      const fallback = activeZoneForZone(zoneId);
      if (fallback) zones.push(fallback);
    }
    return zones;
  }
  function pointInZoneShape(point, zone) {
    if (!point || !zone) return false;
    if (zone.worldPoints?.length) return pointInPolygon(point, zone);
    return rectZoneContains(zone, point);
  }
  function fighterInZone(f, zone, radius=0) {
    if (!f || f.hp <= 0 || !zone) return false;
    return pointInZoneShape({x:f.x,y:f.y}, zone) || (radius > 0 && pointInZoneShape({x:f.x + radius * .5,y:f.y}, zone));
  }
  function playersInActiveZone(zoneId) {
    const zone = activeZoneForZone(zoneId);
    return (fighters || []).slice(0, 2).filter(f => f && isRealControlChampion(f) && fighterInZone(f, zone, f.radius || 0));
  }
  function bossSpawnFor(type) {
    return CONTROL_BOSS_SPAWNS.find(spawn => spawn.markerType === type || spawn.role === type || spawn.role === type.replace('boss_', '')) || null;
  }
  function fighterType(name) {
    return (window.apexFighterTypes || window.FighterTypes || FighterTypes || []).find(ft => ft?.name === name) || null;
  }
  function makeBossRecord(key, champion, zoneId, hp, markerType) {
    const marker = bossSpawnFor(markerType);
    const point = pointFromMarker(marker, {x:worldCenter().x,y:worldCenter().y});
    return {key, champion, zoneId, hp, marker, guard:{...point}, fighter:null, spawned:false, dead:false, active:false, lastActive:false, cooldown:0};
  }
  function createBossState() {
    return {
      rage:makeBossRecord('rage', 'SHOTGUN', 'bottomLeftSpecial', 500, 'boss_shotgun'),
      heal:makeBossRecord('heal', 'STRING', 'topRightSpecial', 500, 'boss_string'),
      ice:makeBossRecord('ice', 'ICE', 'center', 1000, 'boss_ice')
    };
  }
  function spawnBoss(record) {
    if (!record || record.spawned || record.dead) return null;
    const type = fighterType(record.champion);
    if (!type) {
      STATE.mapWarnings ||= [];
      STATE.mapWarnings.push({kind:'boss_runtime', champion:record.champion, message:'Champion runtime not found.'});
      return null;
    }
    const id = record.champion === 'SHOTGUN' ? 9101 : record.champion === 'STRING' ? 9102 : 9103;
    const f = new Fighter(id, record.guard.x, record.guard.y, type);
    f.maxHp = record.hp;
    f.hp = record.hp;
    f.data ||= {};
    f.data.apexControlBoss = {key:record.key, zoneId:record.zoneId, guard:{...record.guard}};
    f.data.positionLocked = true;
    f.setDir?.(0, 1);
    record.fighter = f;
    record.spawned = true;
    fighters.push(f);
    if (record.champion === 'STRING') seedStringBossThreads(record);
    return f;
  }
  function wallAnchorsForZone(zoneId) {
    const zone = activeZoneForZone(zoneId) || zoneById(CONTROL_CAPTURE_ZONES, zoneId);
    const anchors = [];
    for (const wall of WALL_SEGMENTS) {
      const pts = wall.worldPoints || [];
      for (let i = 0; i < pts.length; i += 1) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        const mid = {x:(a.x + b.x) / 2, y:(a.y + b.y) / 2};
        if (!zone || pointInZoneShape(mid, zone)) anchors.push(mid);
      }
    }
    return anchors;
  }
  function seedStringBossThreads(record) {
    const boss = record?.fighter;
    if (!boss || boss.name !== 'STRING') return;
    const anchors = wallAnchorsForZone(record.zoneId);
    if (!anchors.length) {
      STATE.mapWarnings ||= [];
      STATE.mapWarnings.push({kind:'string_threads', zoneId:record.zoneId, message:'No wall anchors found in HEAL active zone for STRING preseed threads.'});
      return;
    }
    for (let i = 0; i < 45; i += 1) {
      const anchor = anchors[i % anchors.length];
      projectiles.push({
        type:'string_wall_thread',
        owner:boss,
        x1:anchor.x,
        y1:anchor.y,
        x2:boss.x,
        y2:boss.y,
        anchorKind:'map_control',
        life:Infinity,
        maxLife:Infinity,
        createdAt:matchClock || 0,
        snapCd:0
      });
    }
  }
  function refreshBossLocks() {
    const locked = new Set();
    const bosses = STATE.bosses || {};
    if (bosses.rage?.spawned && !bosses.rage.dead && bosses.rage.fighter?.hp > 0) locked.add('bottomLeftSpecial');
    if (bosses.heal?.spawned && !bosses.heal.dead && bosses.heal.fighter?.hp > 0) locked.add('topRightSpecial');
    STATE.lockedCaptureZones = locked;
  }
  function resetInactiveBoss(record) {
    const f = record?.fighter;
    if (!f || f.hp <= 0) return;
    f.x = record.guard.x;
    f.y = record.guard.y;
    f.data ||= {};
    f.data.positionLocked = true;
    f.setDir?.(0, 1);
  }
  function bossLeashZone(record) {
    if (!record) return null;
    if (record.key === 'ice') return iceTriggerZone();
    return activeZoneForZone(record.zoneId) || zoneById(CONTROL_CAPTURE_ZONES, record.zoneId);
  }
  function clampBossToLeash(record, before, dt) {
    const f = record?.fighter;
    if (!f || f.hp <= 0) return;
    const zone = bossLeashZone(record);
    if (!zone) return;
    const radius = f.radius || CONTROL_CONFIG.championRadius;
    if (fighterInZone(f, zone, radius * .35)) return;
    const guard = record.guard || before || worldCenter();
    const toward = norm(guard.x - f.x, guard.y - f.y);
    const step = Math.max(80, (f.baseSpeed || 405) * 2.4) * dt;
    const candidate = {
      x:clampWorldX(f.x + toward.x * step, radius),
      y:clampWorldY(f.y + toward.y * step, radius)
    };
    if (pointInZoneShape(candidate, zone) && !isInsideWall(candidate, radius * .5)) {
      f.x = candidate.x;
      f.y = candidate.y;
    } else if (before && pointInZoneShape(before, zone) && !isInsideWall(before, radius * .5)) {
      f.x = before.x;
      f.y = before.y;
    } else {
      f.x = guard.x;
      f.y = guard.y;
    }
    f.setDir?.(toward.x, toward.y);
    f.data ||= {};
    f.data.apexBossLeashedAt = matchClock;
  }
  function updateGuardBoss(record, dt) {
    if (!record?.spawned || record.dead || !record.fighter) return;
    const f = record.fighter;
    if (f.hp <= 0) {
      record.dead = true;
      record.active = false;
      refreshBossLocks();
      return;
    }
    const players = playersInActiveZone(record.zoneId);
    const target = players
      .filter(player => bossHasLineOfSight(record, player))
      .sort((a,b) => dist(f.x,f.y,a.x,a.y) - dist(f.x,f.y,b.x,b.y))[0] || null;
    record.active = !!target;
    if (!target) {
      resetInactiveBoss(record);
      return;
    }
    f.data.positionLocked = false;
    f.data.__apexControlBossTick = true;
    const before = {x:f.x,y:f.y};
    try {
      f.update(dt, target);
    } finally {
      f.data.__apexControlBossTick = false;
    }
    resolveControlMovement(f, before);
    clampBossToLeash(record, before, dt);
  }
  function bossRecordForFighter(f) {
    const key = f?.data?.apexControlBoss?.key;
    return key ? STATE.bosses?.[key] || null : null;
  }
  function bossHasLineOfSight(record, target) {
    const f = record?.fighter;
    if (!f || !target || target.hp <= 0) return false;
    if (record.zoneId && !playersInActiveZone(record.zoneId).includes(target)) return false;
    return !raycastControlWall(f.x, f.y, target.x, target.y, Math.min(42, (f.radius || 75) * .35));
  }
  function cullInactiveBossProjectiles() {
    if (!Array.isArray(projectiles)) return;
    const activeBosses = new Set(Object.values(STATE.bosses || {}).filter(b => b?.active && b.fighter?.hp > 0).map(b => b.fighter));
    for (const p of projectiles) {
      if (p?.owner?.data?.apexControlBoss && !activeBosses.has(p.owner)) {
        p.life = 0;
        p._dead = true;
      }
    }
  }
  function iceTriggerZone() {
    const explicit = CONTROL_ACTIVE_ZONES.find(zone => zone.role === 'ice' || /ice|center|middle/i.test(`${zone.id || ''} ${zone.note || ''} ${zone.label || ''}`));
    if (explicit) return explicit;
    const marker = bossSpawnFor('boss_ice');
    if (marker?.bounds) return {...marker.bounds, id:'iceboss-image-bounds', fallback:true, fallbackReason:'missing explicit center active polygon'};
    return {x:S(1350),y:S(1350),w:S(300),h:S(300),fallback:true,fallbackReason:'missing ice marker and active polygon'};
  }
  function castIceAgeFromBoss(record) {
    const f = record?.fighter;
    if (!f || f.hp <= 0) return;
    projectiles.push({type:'ice_age_field', owner:f, life:5.65, maxLife:5.65, enemyInside:0, dmgTick:0, freezeTriggered:false});
    floatingTexts.push(new FloatingText(f.x, f.y - f.radius - 90, 'ICE AGE', '#bff7ff'));
    triggerFlash?.(125,225,255,.16);
    spawnShockwave?.(f.x,f.y,'#8deaff',260);
  }
  function updateIceBoss(dt) {
    const bosses = STATE.bosses;
    if (!bosses?.ice) return;
    if (!bosses.ice.spawned && bosses.rage?.dead && bosses.heal?.dead) {
      spawnBoss(bosses.ice);
      refreshBossLocks();
    }
    const record = bosses.ice;
    if (!record.spawned || record.dead || !record.fighter) return;
    const f = record.fighter;
    if (f.hp <= 0) {
      record.dead = true;
      return;
    }
    resetInactiveBoss(record);
    record.cooldown = Math.max(0, (record.cooldown || 0) - dt);
    const zone = iceTriggerZone();
    const active = (fighters || []).slice(0, 2).some(player => player && isRealControlChampion(player) && fighterInZone(player, zone, player.radius || 0));
    record.active = active;
    if (active && record.cooldown <= 0) {
      castIceAgeFromBoss(record);
      record.cooldown = 10;
    }
  }
  function createNeutralTurrets() {
    return CONTROL_TURRET_SPAWNS.map((spawn, index) => ({
      id:spawn.id || `neutral-turret-${index}`,
      zoneId:spawn.zoneId,
      role:spawn.role,
      x:spawn.x,
      y:spawn.y,
      bounds:spawn.bounds,
      cooldown:0,
      aimAngle:0,
      targetId:null,
      state:'OFF'
    }));
  }
  function updateNeutralTurrets(dt) {
    const turrets = STATE.neutralTurrets || [];
    for (const turret of turrets) {
      turret.cooldown = Math.max(0, (turret.cooldown || 0) - dt);
      turret.state = 'OFF';
      const zone = activeZoneForZone(turret.zoneId);
      const territory = STATE.territories?.[turret.zoneId];
      if (!zone || !territory?.owner || territory.status !== 'owned') {
        turret.state = 'WAITING OWNER';
        continue;
      }
      const target = (fighters || []).slice(0, 2).find(f => {
        if (!f || !isRealControlChampion(f) || !fighterInZone(f, zone, f.radius || 0)) return false;
        const owner = fighterPlayerId(f);
        if (territory?.owner && owner === territory.owner) return false;
        return hasLineOfSight(turret, f, 20);
      });
      if (!target) continue;
      const fireAngle = Math.atan2(target.y - turret.y, target.x - turret.x);
      turret.fireAngle = fireAngle;
      turret.aimAngle = fireAngle - Math.PI / 2;
      turret.targetId = target.id;
      turret.state = `ACTIVE -> ${fighterPlayerId(target)?.toUpperCase() || 'PLAYER'}`;
      if (turret.cooldown <= 0) {
        if (!hasLineOfSight(turret, target, 20)) continue;
        const dir = norm(target.x - turret.x, target.y - turret.y);
        projectiles.push({
          type:'apex_control_turret_rocket',
          owner:null,
          x:turret.x,
          y:turret.y,
          prevX:turret.x,
          prevY:turret.y,
          x1:turret.x,
          y1:turret.y,
          x2:target.x,
          y2:target.y,
          vx:dir.x * 760,
          vy:dir.y * 760,
          angle:fireAngle,
          life:3,
          maxLife:3,
          targetId:target.id,
          __apexControlManaged:true,
          damage:5,
          knockback:150,
          assetKey:'engineer_rocket'
        });
        turret.cooldown = 5;
      }
    }
  }
  function updateControlTurretRockets(dt) {
    if (!Array.isArray(projectiles)) return;
    for (const p of projectiles) {
      if (p?.type !== 'apex_control_turret_rocket' || p.life <= 0 || p._dead) continue;
      p.prevX = p.x;
      p.prevY = p.y;
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
      p.angle = Math.atan2(p.vy || 0, p.vx || 1);
      if (segmentIntersectsWall({x:p.prevX,y:p.prevY}, {x:p.x,y:p.y}, p.radius || 18)) {
        p.life = 0;
        p._dead = true;
        spawnShockwave?.(p.x, p.y, '#ffdf7b', 120);
        continue;
      }
      const target = p.targetKind === 'creep'
        ? (STATE.creeps || []).find(c => c?.id === p.targetId && c.hp > 0)
        : (fighters || []).find(f => f?.id === p.targetId && f.hp > 0);
      if (target && dist(p.x,p.y,target.x,target.y) <= (target.radius || 70) + 24) {
        if (p.targetKind === 'creep') damageCreep(target, p.damage || 5, p.owner || null, 'engineer-structure-creep-rocket');
        else target.takeDamage(p.damage || 5, null, 'apex-control-neutral-turret-rocket', true);
        const away = norm(target.x - (p.x1 || p.prevX), target.y - (p.y1 || p.prevY));
        if (p.targetKind === 'creep') {
          target.x = clampWorldX(target.x + away.x * Math.min(46, (p.knockback || 120) * .08), target.radius || 0);
          target.y = clampWorldY(target.y + away.y * Math.min(46, (p.knockback || 120) * .08), target.radius || 0);
        } else target.applyStatus?.('push', .18, {x:away.x, y:away.y, strength:p.knockback || 150});
        p.life = 0;
        p._dead = true;
        spawnShockwave?.(target.x, target.y, '#ffdf7b', 95);
      }
    }
  }
  function createCreepSpawner() {
    return {timer:rand(CONTROL_CONFIG.creepWaveMinSeconds, CONTROL_CONFIG.creepWaveMaxSeconds), nextId:1, stopped:false};
  }
  function creepSpawnPoints() {
    const center = worldCenter();
    const edge = S(260);
    return [
      {x:center.x,y:edge,lane:'north'},
      {x:center.x,y:worldHeight() - edge,lane:'south'},
      {x:edge,y:center.y,lane:'west'},
      {x:worldWidth() - edge,y:center.y,lane:'east'}
    ];
  }
  function spawnControlCreep(spawn) {
    const id = STATE.creepSpawner ? STATE.creepSpawner.nextId++ : Math.floor(Math.random() * 99999);
    const jitter = 55;
    const x = clamp(spawn.x + rand(-jitter,jitter), 80, worldWidth() - 80);
    const y = clamp(spawn.y + rand(-jitter,jitter), 80, worldHeight() - 80);
    return {
      id:`creep-${id}`,
      x,y,
      prevX:x,
      prevY:y,
      radius:24,
      hp:CONTROL_CONFIG.creepHp,
      maxHp:CONTROL_CONFIG.creepHp,
      xp:CONTROL_CONFIG.creepXp,
      lane:spawn.lane,
      target:{...worldCenter()},
      hitFlash:0,
      meleeCd:0,
      despawnTimer:null
    };
  }
  function spawnCreepWave() {
    const creeps = STATE.creeps || (STATE.creeps = []);
    const available = Math.max(0, CONTROL_CONFIG.creepMaxAlive - creeps.length);
    if (available <= 0) return;
    const count = Math.min(available, 2 + Math.floor(Math.random() * 2));
    const shuffled = creepSpawnPoints().slice().sort(() => Math.random() - .5);
    for (let i = 0; i < count; i += 1) creeps.push(spawnControlCreep(shuffled[i % shuffled.length]));
  }
  function projectileDamageValue(p) {
    return p.damage || p.dmg || p.tickDamage || (p.type === 'blade_wave' ? 8 : p.type === 'katana_blade_wave' ? 9 : 3);
  }
  function damageCreep(creep, amount, source, label='control-creep-hit') {
    if (!creep || creep.hp <= 0 || amount <= 0) return;
    const owner = fighterPlayerId(source);
    const mult = owner ? playerDamageLevelMultiplier(owner) : 1;
    const dealt = amount * mult;
    creep.hp -= dealt;
    creep.hitFlash = .12;
    if (source?.name === 'KATANA' || /katana/i.test(String(label || ''))) {
      const angle = Math.atan2(creep.y - (source?.y || creep.y), creep.x - (source?.x || creep.x));
      window.APEX_KATANA?.spawnSlashEffect?.(creep.x, creep.y, angle, /twin|infinite|finisher/i.test(String(label || '')));
    }
    floatingTexts.push(new FloatingText(creep.x, creep.y - creep.radius - 22, dealt.toFixed(1), '#ff766b'));
    if (creep.hp <= 0) {
      creep.dead = true;
      if (owner) addPlayerXp(owner, creep.xp, 'creep');
      floatingTexts.push(new FloatingText(creep.x, creep.y - 42, `+${creep.xp} XP`, '#b6ff70'));
      emitParticles?.(creep.x, creep.y, '#b6ff70', 12, 180, 4, .35, 'square');
    }
  }
  function updateCreepProjectileHits() {
    const creeps = STATE.creeps || [];
    for (const p of projectiles || []) {
      const owner = p?.owner;
      if (!owner || !fighterPlayerId(owner) || p.life <= 0 || p._dead) continue;
      const pos = Number.isFinite(p.x) && Number.isFinite(p.y) ? p : Number.isFinite(p.x2) && Number.isFinite(p.y2) ? {x:p.x2,y:p.y2} : null;
      if (!pos) continue;
      const piercing = /blade_wave|katana_blade_wave|black_wave/i.test(String(p.type || ''));
      if (piercing) p.__controlCreepHitIds ||= {};
      else if (p.__controlCreepHit) continue;
      const radius = c => c.radius + (p.radius || p.width || p.halfWidth || 22) * (piercing ? .82 : .6);
      const hits = creeps.filter(c => c.hp > 0 && (!piercing || !p.__controlCreepHitIds[c.id])
        && dist(pos.x,pos.y,c.x,c.y) <= radius(c) && hasLineOfSight(owner, c, 12));
      if (!hits.length) continue;
      for (const creep of hits) {
        damageCreep(creep, projectileDamageValue(p), owner, p.type || 'projectile');
        if (piercing) p.__controlCreepHitIds[creep.id] = true;
      }
      if (!piercing) {
        p.__controlCreepHit = true;
        if (!isPersistentTerrainProjectile(p) && p.life !== Infinity) p.life = 0;
      }
    }
  }
  function updateKatanaWaveCreepHits() {
    const waves = window.APEX_KATANA?.state?.waves || [];
    const creeps = STATE.creeps || [];
    for (const w of waves) {
      if (!w || w.life <= 0 || w.hit || !w.owner || !fighterPlayerId(w.owner)) continue;
      const seg = bladeWaveSegment(w);
      if (!seg || segmentIntersectsWall(seg.a, seg.b, 8)) continue;
      w.__controlCreepHitIds ||= {};
      for (const creep of creeps) {
        if (creep.hp <= 0 || w.__controlCreepHitIds[creep.id]) continue;
        const forward = dot(creep.x - seg.a.x, creep.y - seg.a.y, seg.dir.x, seg.dir.y);
        if (forward < 0 || forward > seg.length + creep.radius) continue;
        if (pointSegmentDistance(creep, seg.a, seg.b) > (w.halfWidth || 120) + creep.radius * .45) continue;
        damageCreep(creep, w.damage || 9, w.owner, 'katana-blade-wave-creep');
        w.__controlCreepHitIds[creep.id] = true;
      }
    }
  }
  function updateKatanaContactCreepHits(dt) {
    const creeps = STATE.creeps || [];
    for (const f of (fighters || []).slice(0, 2)) {
      if (!f || f.name !== 'KATANA' || f.hp <= 0 || !fighterPlayerId(f)) continue;
      const d = f.data?.katana;
      const dash = d?.manual?.qDash || d?.action;
      if (!dash) continue;
      d.__controlCreepHitIds ||= {};
      for (const creep of creeps) {
        if (creep.hp <= 0 || d.__controlCreepHitIds[creep.id]) continue;
        if (dist(f.x,f.y,creep.x,creep.y) > (f.radius || 70) + creep.radius + 34) continue;
        if (!hasLineOfSight(f, creep, 12)) continue;
        damageCreep(creep, 18, f, 'katana-one-sword-creep');
        d.__controlCreepHitIds[creep.id] = true;
      }
    }
  }
  function structureCreepDamage(kind) {
    if (kind === 'heavy_turret') return 30;
    if (kind === 'war_machine') return 60;
    return 2;
  }
  function structureCreepCooldown(kind) {
    if (kind === 'heavy_turret') return 2;
    if (kind === 'war_machine') return 3.2;
    return .8 / 4.5;
  }
  function structureCreepRange(kind) {
    if (kind === 'heavy_turret') return 750;
    if (kind === 'war_machine') return 930;
    return 300;
  }
  function updateEngineerStructuresVsCreeps(dt) {
    const creeps = STATE.creeps || [];
    const engineer = window.APEX_ENGINEER;
    if (!engineer?.allStructures || !creeps.length) return;
    for (const s of engineer.allStructures()) {
      if (!s || s.dead || s.hp <= 0 || s.state !== 'online' || !['turret','heavy_turret','war_machine'].includes(s.kind)) continue;
      s.__controlCreepFireCd = Math.max(0, (s.__controlCreepFireCd || 0) - dt);
      const range = structureCreepRange(s.kind);
      const target = creeps.filter(c => c.hp > 0 && dist(s.x,s.y,c.x,c.y) <= range && hasLineOfSight(s, c, 12))
        .sort((a,b) => dist(s.x,s.y,a.x,a.y) - dist(s.x,s.y,b.x,b.y))[0];
      if (!target) continue;
      s.aimAngle = Math.atan2(target.y - s.y, target.x - s.x) - Math.PI / 2;
      if (s.__controlCreepFireCd > 0) continue;
      const dir = norm(target.x - s.x, target.y - s.y);
      projectiles.push({
        type:'apex_control_turret_rocket',
        owner:s.owner || null,
        sourceStructureId:s.id,
        x:s.x,
        y:s.y,
        prevX:s.x,
        prevY:s.y,
        x1:s.x,
        y1:s.y,
        vx:dir.x * (s.kind === 'turret' ? 2940 : 860),
        vy:dir.y * (s.kind === 'turret' ? 2940 : 860),
        angle:Math.atan2(dir.y, dir.x),
        life:3,
        maxLife:3,
        targetId:target.id,
        targetKind:'creep',
        __apexControlManaged:true,
        damage:structureCreepDamage(s.kind),
        knockback:s.kind === 'war_machine' ? 210 : 120,
        assetKey:s.kind === 'turret' ? 'engineer_turret_bullet' : 'engineer_rocket'
      });
      s.__controlCreepFireCd = structureCreepCooldown(s.kind);
    }
  }
  function playerFarmIntent(owner) {
    if (owner === playerIdForIndex(STATE.localSlot)) return input.isHeld(ACTIONS.PRIMARY);
    if (owner === playerIdForIndex(STATE.remoteSlot)) return remoteInput.isHeld(ACTIONS.PRIMARY) || STATE.bot?.state === 'FARM_CREEP';
    return false;
  }
  function updatePlayerCreepFarmDamage(dt) {
    const creeps = STATE.creeps || [];
    for (const owner of ['p1','p2']) {
      const f = fighterForPlayer(owner);
      const life = lifecycleForPlayer(owner);
      if (!f || f.hp <= 0 || life?.dead || !life?.canDealDamage || !playerFarmIntent(owner)) continue;
      const target = creeps.filter(c => c.hp > 0 && dist(f.x,f.y,c.x,c.y) <= 230 && hasLineOfSight(f, c, 18))
        .sort((a,b) => dist(f.x,f.y,a.x,a.y) - dist(f.x,f.y,b.x,b.y))[0];
      if (target) damageCreep(target, CONTROL_CONFIG.creepFarmDps * dt, f, 'player-farm');
    }
  }
  function updateControlCreeps(dt) {
    const spawner = STATE.creepSpawner || (STATE.creepSpawner = createCreepSpawner());
    const creeps = STATE.creeps || (STATE.creeps = []);
    const iceDead = !!STATE.bosses?.ice?.dead;
    spawner.stopped = iceDead;
    if (!spawner.stopped) {
      spawner.timer -= dt;
      if (spawner.timer <= 0) {
        spawnCreepWave();
        spawner.timer = rand(CONTROL_CONFIG.creepWaveMinSeconds, CONTROL_CONFIG.creepWaveMaxSeconds);
      }
    }
    for (const creep of creeps) {
      creep.hitFlash = Math.max(0, (creep.hitFlash || 0) - dt);
      if (iceDead) creep.despawnTimer = creep.despawnTimer ?? 10;
      if (creep.despawnTimer != null) creep.despawnTimer -= dt;
      creep.prevX = creep.x;
      creep.prevY = creep.y;
      const toCenter = norm(creep.target.x - creep.x, creep.target.y - creep.y);
      creep.x = clampWorldX(creep.x + toCenter.x * 74 * dt, creep.radius);
      creep.y = clampWorldY(creep.y + toCenter.y * 74 * dt, creep.radius);
      if (isBlockedCircle(creep.x, creep.y, creep.radius)) {
        creep.x = creep.prevX;
        creep.y = creep.prevY;
      }
      creep.meleeCd = Math.max(0, (creep.meleeCd || 0) - dt);
      const target = (fighters || []).slice(0,2).find(f => f && f.hp > 0 && dist(f.x,f.y,creep.x,creep.y) <= (f.radius || 70) + creep.radius + 18);
      if (target && creep.meleeCd <= 0) {
        target.takeDamage(CONTROL_CONFIG.creepMeleeDps, null, 'control-creep-melee', true);
        creep.meleeCd = 1;
      }
    }
    updateCreepProjectileHits();
    updateKatanaWaveCreepHits();
    updateKatanaContactCreepHits(dt);
    updateEngineerStructuresVsCreeps(dt);
    updatePlayerCreepFarmDamage(dt);
    STATE.creeps = creeps.filter(c => !c.dead && c.hp > 0 && (c.despawnTimer == null || c.despawnTimer > 0)).slice(-CONTROL_CONFIG.creepMaxAlive);
  }
  function updateControlBosses(dt) {
    if (!STATE.bosses) return;
    updateGuardBoss(STATE.bosses.rage, dt);
    updateGuardBoss(STATE.bosses.heal, dt);
    updateIceBoss(dt);
    cullInactiveBossProjectiles();
    refreshBossLocks();
  }
  function getHealEffect(owner) {
    const territory = territoryForType('healPoint');
    if (isEffectSuppressed(territory) || territory.owner !== owner) return {state:isEffectSuppressed(territory) && territory?.owner === owner ? 'DISABLED' : 'OFF', rate:0, territory};
    const f = fighterForPlayer(owner);
    if (!isFighterInEffectRoom(f, territory.roomId)) return {state:'OFF', rate:0, territory};
    const last = STATE.effects?.lastDamageAt?.[owner] ?? -999;
    if (matchClock - last < CONTROL_CONFIG.healPauseSeconds) return {state:'PAUSED', rate:0, territory};
    const contested = isCaptureContestAt(territory.roomId);
    return {state:contested ? 'CONTEST' : 'ACTIVE', rate:contested ? CONTROL_CONFIG.contestedHealPerSecond : CONTROL_CONFIG.healPerSecond, territory};
  }
  function getRageEffect(owner) {
    const territory = territoryForType('ragePoint');
    if (isEffectSuppressed(territory) || territory.owner !== owner) return {state:isEffectSuppressed(territory) && territory?.owner === owner ? 'DISABLED' : 'OFF', multiplier:1, territory};
    const f = fighterForPlayer(owner);
    if (!isFighterInEffectRoom(f, territory.roomId)) return {state:'OFF', multiplier:1, territory};
    const contested = isCaptureContestAt(territory.roomId);
    return {state:contested ? 'CONTEST' : 'ACTIVE', multiplier:contested ? CONTROL_CONFIG.contestedRageMultiplier : CONTROL_CONFIG.rageMultiplier, territory};
  }
  function getTerritoryDamageMultiplier(attacker, damageSource=null) {
    const owner = fighterPlayerId(attacker);
    const life = owner ? lifecycleForPlayer(owner) : null;
    if (!STATE.active || !owner || !attacker || attacker.hp <= 0 || (life && !life.canDealDamage)) return 1;
    const label = String(damageSource || '');
    if (/^apex-territory-|structure|turret|factory|mine|summon|clone/i.test(label)) return 1;
    return (getRageEffect(owner).multiplier || 1) * playerDamageLevelMultiplier(owner);
  }
  function applyBaseTurretEffect(dt) {
    const effects = STATE.effects || createEffectState();
    for (const roomId of ['p1Base','p2Base']) {
      effects.turret[roomId] = 'OFF';
    }
    STATE.effects = effects;
  }
  function applyHealEffect(dt) {
    const effects = STATE.effects || createEffectState();
    for (const owner of ['p1','p2']) {
      const heal = getHealEffect(owner);
      effects.heal[owner] = heal.state === 'ACTIVE' ? `ACTIVE ${heal.rate}/s` : heal.state === 'CONTEST' ? `CONTEST ${heal.rate}/s` : heal.state;
      const f = fighterForPlayer(owner);
      if (heal.rate > 0 && f && f.hp > 0 && f.hp < f.maxHp) f.heal?.(heal.rate * dt, false);
    }
    STATE.effects = effects;
  }
  function refreshRageEffectStatus() {
    const effects = STATE.effects || createEffectState();
    for (const owner of ['p1','p2']) {
      const rage = getRageEffect(owner);
      effects.rage[owner] = rage.state === 'ACTIVE' ? 'ACTIVE +50%' : rage.state === 'CONTEST' ? 'CONTEST +20%' : rage.state;
    }
    STATE.effects = effects;
  }
  function updateTerritoryEffects(dt) {
    if (!STATE.active || !STATE.territories) return;
    if (!STATE.effects) STATE.effects = createEffectState();
    applyBaseTurretEffect(dt);
    applyHealEffect(dt);
    refreshRageEffectStatus();
  }
  window.APEX_CONTROL_EFFECTS = {
    getTerritoryDamageMultiplier,
    getHealEffect,
    getRageEffect,
    getState:() => STATE.effects
  };
  const previousControlFighterUpdate = Fighter?.prototype?.update;
  if (previousControlFighterUpdate && !Fighter.prototype.__apexControlBossUpdatePatched) {
    Fighter.prototype.__apexControlBossUpdatePatched = true;
    Fighter.prototype.update = function(dt, enemy) {
      if (STATE.active && this?.data?.apexControlBoss && !this.data.__apexControlBossTick) {
        const record = bossRecordForFighter(this);
        if (record) record.active = false;
        this.data.positionLocked = true;
        return;
      }
      return previousControlFighterUpdate.call(this, dt, enemy);
    };
  }
  function wallPiercingDamage(label, statusDamage=false) {
    return /dot|burn|bleed|poison|aura|ice_age|ice-age|terrain|field|trail|zone|status/i.test(String(label || ''));
  }
  function pointSegmentDistance(point, a, b) {
    const p = closestPointOnSegment(point.x, point.y, a.x, a.y, b.x, b.y);
    return dist(point.x, point.y, p.x, p.y);
  }
  function bladeWaveSegment(p) {
    if (!p || (p.type && !/blade_wave|black_wave|katana_blade_wave/i.test(String(p.type))) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    const dir = p.dir ? norm(p.dir.x || 0, p.dir.y || 0) : norm(p.vx || 0, p.vy || 0);
    const length = p.length || 320;
    return {a:{x:p.x - dir.x * length, y:p.y - dir.y * length}, b:{x:p.x, y:p.y}, dir, length};
  }
  function bladeWaveForDamage(source, target) {
    if (!source || !target) return null;
    const waves = [
      ...((projectiles || []).filter(p => p?.type === 'blade_wave')),
      ...((window.APEX_KATANA?.state?.waves || []).filter(Boolean))
    ];
    return waves.find(p => {
      if (!p || p.owner !== source || p.life <= 0 || p._dead || p.hit) return false;
      const seg = bladeWaveSegment(p);
      if (!seg) return false;
      const forward = dot(target.x - seg.a.x, target.y - seg.a.y, seg.dir.x, seg.dir.y);
      if (forward < 0 || forward > seg.length + (target.radius || 0)) return false;
      return pointSegmentDistance(target, seg.a, seg.b) <= (p.halfWidth || 120) + (target.radius || 0) * .35;
    }) || null;
  }
  function bladeWaveBlockedByWall(source, target, label) {
    if (!/blade-wave|blade_wave|katana-blade-wave/i.test(String(label || ''))) return false;
    const wave = bladeWaveForDamage(source, target);
    const seg = bladeWaveSegment(wave);
    return !!seg && !!segmentIntersectsWall(seg.a, seg.b, 8);
  }
  function shouldBlockDamageByWall(source, target, label, statusDamage=false) {
    if (!STATE.active || !source || !target || source === target || wallPiercingDamage(label, statusDamage)) return false;
    if (bladeWaveBlockedByWall(source, target, label)) return true;
    let attackOrigin = source;
    if (/^engineer-(turret|rocket|war_machine|war-machine)/i.test(String(label || '')) && source?.name === 'ENGINEER') {
      const structures = (window.APEX_ENGINEER?.ownerData?.(source)?.structures || [])
        .filter(s => s && !s.dead && s.hp > 0 && s.state === 'online' && ['turret','heavy_turret','war_machine'].includes(s.kind));
      attackOrigin = structures.sort((a,b) => dist(a.x,a.y,target.x,target.y) - dist(b.x,b.y,target.x,target.y))[0] || source;
    }
    if (!Number.isFinite(attackOrigin.x) || !Number.isFinite(attackOrigin.y) || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return false;
    return !hasLineOfSight(attackOrigin, target, Math.min(42, (attackOrigin.radius || target.radius || 80) * .35));
  }
  function canControlDamageApply(target, source=null, label='', statusDamage=false) {
    if (!STATE.active || !Number.isFinite(target?.hp)) return true;
    if (STATE.match?.state === 'ended') return false;
    const victimId = fighterPlayerId(target);
    const victimLife = victimId ? lifecycleForPlayer(victimId) : null;
    if (victimLife?.invulnerable || victimLife?.dead) return false;
    const sourceId = fighterPlayerId(source);
    const sourceLife = sourceId ? lifecycleForPlayer(sourceId) : null;
    if (sourceId && (!sourceLife || sourceLife.dead || !sourceLife.canDealDamage)) return false;
    const sourceBoss = bossRecordForFighter(source);
    const targetBoss = bossRecordForFighter(target);
    if (sourceBoss && victimId && !bossHasLineOfSight(sourceBoss, target)) return false;
    if (sourceId && targetBoss && (targetBoss.dead || target.hp <= 0)) return false;
    if (shouldBlockDamageByWall(source, target, label, statusDamage)) return false;
    return true;
  }
  const previousControlTakeDamage = Fighter?.prototype?.takeDamage;
  if (previousControlTakeDamage && !Fighter.prototype.__apexControlKillBonusPatched) {
    Fighter.prototype.__apexControlKillBonusPatched = true;
    Fighter.prototype.takeDamage = function(amount, source=null, label='', statusDamage=false) {
      const wasAlive = this.hp > 0;
      if (STATE.active && Number.isFinite(amount) && amount > 0) {
        if (!canControlDamageApply(this, source, label, statusDamage)) return;
        const victimId = fighterPlayerId(this);
        if (victimId && respawnTerritoryCount(victimId) > 0 && this.hp - amount <= 0) {
          markPlayerDead(victimId, label || 'hp_zero');
          return;
        }
      }
      if (STATE.active && source && source !== this && Number.isFinite(amount) && amount > 0) {
        const multiplier = getTerritoryDamageMultiplier(source, label);
        if (multiplier !== 1) {
          amount *= multiplier;
          label = `${label || 'direct'}-apex-rage-${multiplier.toFixed(1)}x`;
        }
        const victimId = fighterPlayerId(this);
        if (victimId && STATE.effects?.lastDamageAt) STATE.effects.lastDamageAt[victimId] = matchClock;
      }
      const result = previousControlTakeDamage.call(this, amount, source, label, statusDamage);
      if (STATE.active && wasAlive && this.hp <= 0 && source && source !== this && (fighters || []).includes(source)) {
        applyKillProgressBonus(source, this);
      }
      if (STATE.active && wasAlive && this.hp <= 0) {
        const victimId = fighterPlayerId(this);
        if (victimId) markPlayerDead(victimId, label || 'hp_zero');
      }
      return result;
    };
  }
  function computeControlCamera() {
    const baseFocus = STATE.localFighter || fighters?.[STATE.localSlot] || fighters?.[0] || worldCenter();
    const engineerData = baseFocus?.name === 'ENGINEER' ? window.APEX_ENGINEER?.ownerData?.(baseFocus) : null;
    const warMachine = engineerData?.pilotingWarMachine
      ? (engineerData.structures || []).find(s => s.id === engineerData.pilotWarMachineId && s.kind === 'war_machine' && !s.dead && s.hp > 0)
      : null;
    const focus = warMachine || baseFocus;
    const vw = CONTROL_CONFIG.viewportWidth;
    const vh = CONTROL_CONFIG.viewportHeight;
    const maxX = Math.max(0, worldWidth() - vw);
    const maxY = Math.max(0, worldHeight() - vh);
    return {
      modeId:CONTROL_CONFIG.modeId,
      worldX:clamp((Number.isFinite(focus.x) ? focus.x : CONTROL_CONFIG.worldCenterX) - vw / 2, 0, maxX),
      worldY:clamp((Number.isFinite(focus.y) ? focus.y : CONTROL_CONFIG.worldCenterY) - vh / 2, 0, maxY),
      width:vw,
      height:vh,
      zoom:1,
      shakeX:rand(-cameraShake,cameraShake),
      shakeY:rand(-cameraShake,cameraShake)
    };
  }
  function applyControlWorld() {
    GAME_SIZE = CONTROL_CONFIG.worldWidth;
    if (canvas.width !== CONTROL_CONFIG.viewportWidth) canvas.width = CONTROL_CONFIG.viewportWidth;
    if (canvas.height !== CONTROL_CONFIG.viewportHeight) canvas.height = CONTROL_CONFIG.viewportHeight;
    document.body.classList.add('apex-control-camera');
  }
  function controlWarMachineTargets(ownerFighter, wm, fallbackEnemy) {
    const targets = [];
    const enemyId = fighterPlayerId(fallbackEnemy);
    if (fallbackEnemy && isRealControlChampion(fallbackEnemy) && enemyId !== fighterPlayerId(ownerFighter)) targets.push(fallbackEnemy);
    for (const record of Object.values(STATE.bosses || {})) {
      const boss = record?.fighter;
      if (boss && boss.hp > 0 && !record.dead && (record.active || record.kind === 'ice') && boss !== ownerFighter) targets.push(boss);
    }
    return targets
      .filter(t => Number.isFinite(t.x) && Number.isFinite(t.y) && dist(wm.x, wm.y, t.x, t.y) <= 930 && hasLineOfSight(wm, t, 18))
      .sort((a,b) => dist(wm.x,wm.y,a.x,a.y) - dist(wm.x,wm.y,b.x,b.y));
  }
  function controlWarMachineAimTarget(ownerFighter, wm, aim, fallbackEnemy) {
    if (!wm || !aim || !Number.isFinite(aim.x) || !Number.isFinite(aim.y)) return null;
    const dir = norm(aim.x - wm.x, aim.y - wm.y);
    if (!dir.x && !dir.y) return null;
    return controlWarMachineTargets(ownerFighter, wm, fallbackEnemy).map(target => {
      const dx = target.x - wm.x, dy = target.y - wm.y;
      const along = dot(dx, dy, dir.x, dir.y);
      const lateral = Math.abs(dx * dir.y - dy * dir.x);
      return {target, along, lateral};
    }).filter(hit => hit.along > 0 && hit.along <= 930 && hit.lateral <= (hit.target.radius || 75) + 56)
      .sort((a,b) => a.lateral - b.lateral || a.along - b.along)[0]?.target || null;
  }
  function stabilizeEngineerPilotState(f, wm) {
    if (!f || !wm) return;
    f.data ||= {};
    const key = '__apexControlPilotHp';
    if (!Number.isFinite(f.data[key]) || f.data[key] <= 1.5) f.data[key] = Math.max(f.hp || 1, 1);
    if (f.hp <= 1.5 && f.data[key] > 1.5) f.hp = Math.min(f.data[key], f.maxHp || f.data[key]);
    f.x = wm.x;
    f.y = wm.y;
  }
  function clearEngineerPilotState(f) {
    const d = f?.name === 'ENGINEER' ? window.APEX_ENGINEER?.ownerData?.(f) : null;
    if (!d?.pilotingWarMachine) return;
    const wm = (d.structures || []).find(s => s.id === d.pilotWarMachineId && s.kind === 'war_machine');
    if (wm) wm.pilotedBy = null;
    d.pilotingWarMachine = false;
    d.pilotWarMachineId = null;
  }
  function restoreLegacyWorld() {
    GAME_SIZE = LEGACY_GAME_SIZE;
    if (canvas.width !== LEGACY_CANVAS.width) canvas.width = LEGACY_CANVAS.width;
    if (canvas.height !== LEGACY_CANVAS.height) canvas.height = LEGACY_CANVAS.height;
    document.body.classList.remove('apex-control-camera');
    window.__apexCameraView = {shakeX:0,shakeY:0,zoom:1};
  }
  function updateHud() {
    const panel = document.getElementById('manual-lab-hud');
    if (!panel) return;
    const local = STATE.active && STATE.localFighter?.hp > 0 ? STATE.localFighter : null;
    const supported = local?.name === 'ENGINEER' || local?.name === 'KATANA';
    panel.classList.toggle('hidden', !supported);
    if (!supported) return;
    const isKatana = local.name === 'KATANA';
    panel.querySelector('.manual-engineer-hud')?.classList.toggle('hidden', isKatana);
    panel.querySelector('.manual-katana-hud')?.classList.toggle('hidden', !isKatana);
    panel.querySelector('.manual-lab-keys')?.classList.toggle('hidden', isKatana);
    if (isKatana) {
      const h = window.APEX_KATANA?.manualApi?.hudState?.(local);
      const title = panel.querySelector('.manual-lab-title');
      if (title) title.textContent = 'APEX CONTROL · KATANA';
      const q = document.getElementById('manual-katana-q');
      const ev = document.getElementById('manual-katana-e');
      const rewrite = document.getElementById('manual-katana-r');
      if (q) q.textContent = h?.qWindow > 0 ? `REFRESH ${h.qWindow.toFixed(1)}s` : h?.qCooldown > 0 ? `${h.qCooldown.toFixed(1)}s` : 'READY';
      if (ev) ev.textContent = h?.eCooldown > 0 ? `${h.eCooldown.toFixed(1)}s` : h?.eReady ? 'FARTHEST' : 'LOCKED';
      if (rewrite) rewrite.textContent = h?.rewriteRemaining > 0 ? `CHARGE ${h.rewriteRemaining.toFixed(1)}s` : h?.rCooldown > 0 ? `${h.rCooldown.toFixed(1)}s` : 'FAN READY';
      const status = document.getElementById('manual-status');
      if (status) {
        status.textContent = h?.feedback || `${String(h?.mode || 'IDLE').toUpperCase()} · FRAME ${h?.frame || 1}`;
        status.classList.remove('invalid');
      }
      return;
    }
    const f = currentEngineer();
    if (!f) return;
    const api = engineerApi();
    const kind = selectedKind();
    const spec = api?.baseSpecs?.[kind];
    const data = f ? window.APEX_ENGINEER?.ownerData?.(f) : null;
    const title = panel.querySelector('.manual-lab-title');
    if (title) title.textContent = data?.pilotingWarMachine ? 'APEX CONTROL · WAR MACHINE' : 'APEX CONTROL · ENGINEER';
    const blueprint = document.getElementById('manual-blueprint');
    const cost = document.getElementById('manual-cost');
    const scrap = document.getElementById('manual-scrap');
    if (blueprint) blueprint.textContent = String(spec?.label || kind).toUpperCase();
    if (cost) cost.textContent = String(spec?.cost ?? '-');
    if (scrap) scrap.textContent = String(data?.scrap ?? '-');
    let statusText = 'READY';
    let valid = true;
    if (f && data?.pilotingWarMachine) {
      statusText = 'LMB: EXISTING LASER · RMB/APEX: NO CURRENT WAR MACHINE ACTION';
      valid = true;
    } else if (f && input.pointerInside) {
      const aim = pointAtAimRange(f, input.aimPoint, api?.buildRange || 100);
      const place = aim ? controlPlacementStatus(f, kind, aim.x, aim.y, api?.buildRange || 100) : {valid:false, reason:'AIM OUTSIDE ARENA'};
      statusText = place?.reason || statusText;
      valid = !!place?.valid;
    }
    if (STATE.feedback && STATE.feedback.until > performance.now()) {
      statusText = STATE.feedback.text;
      valid = STATE.feedback.valid;
    }
    const status = document.getElementById('manual-status');
    if (status) {
      status.textContent = statusText;
      status.classList.toggle('invalid', !valid);
    }
  }

  function supportedManualFighter(f) {
    return f?.name === 'ENGINEER' || f?.name === 'KATANA';
  }
  function createRemoteInputState() {
    return {
      held:new Set(),
      pressed:new Set(),
      aimPoint:{x:CONTROL_CONFIG.worldCenterX,y:CONTROL_CONFIG.worldCenterY},
      pointerInside:false,
      moveVector:{x:0,y:0},
      lastSeq:-1,
      clear() {
        this.held.clear();
        this.pressed.clear();
        this.moveVector = {x:0,y:0};
        this.pointerInside = false;
      },
      consume(action) {
        const had = this.pressed.has(action);
        this.pressed.delete(action);
        return had;
      },
      isHeld(action) { return this.held.has(action); },
      endFrame() { this.pressed.clear(); },
      applySnapshot(snapshot={}) {
        const seq = Number.isFinite(snapshot.seq) ? snapshot.seq : this.lastSeq + 1;
        this.held = new Set((snapshot.held || []).filter(Boolean));
        if (seq > this.lastSeq) {
          for (const action of snapshot.pressed || []) this.pressed.add(action);
          this.lastSeq = seq;
        }
        if (snapshot.aimPoint && Number.isFinite(snapshot.aimPoint.x) && Number.isFinite(snapshot.aimPoint.y)) {
          this.aimPoint = {x:snapshot.aimPoint.x,y:snapshot.aimPoint.y};
        }
        if (snapshot.moveVector && Number.isFinite(snapshot.moveVector.x) && Number.isFinite(snapshot.moveVector.y)) {
          const len = Math.hypot(snapshot.moveVector.x,snapshot.moveVector.y);
          this.moveVector = len > 0 ? {x:snapshot.moveVector.x/len,y:snapshot.moveVector.y/len} : {x:0,y:0};
        }
        this.pointerInside = snapshot.pointerInside !== false;
      }
    };
  }
  const remoteInput = STATE.remoteInput = createRemoteInputState();
  function makeManualController(source, options={}) {
    const controllerOwner = () => options.local ? playerIdForIndex(STATE.localSlot) : playerIdForIndex(STATE.remoteSlot);
    const controllerLife = () => lifecycleForPlayer(controllerOwner());
    const canUseAction = () => {
      const life = controllerLife();
      return STATE.match?.state !== 'ended' && (!life || (!life.dead && life.canAttack));
    };
    const canUseMove = () => {
      const life = controllerLife();
      return STATE.match?.state !== 'ended' && (!life || (!life.dead && life.canMove));
    };
    const manual = {
    mode:'MANUAL_LAB', modeId:CONTROL_CONFIG.modeId, active:false,
    isLocal:!!options.local,
    selectedBlueprint:0,
    mineCooldown:0,
    warMachineCooldown:0,
    warLaserCooldown:0,
    getAimPoint:() => ({...source.aimPoint}),
    getMoveVector:() => canUseMove() ? ({...source.moveVector}) : ({x:0,y:0}),
    getMoveMagnitude:() => canUseMove() ? Math.hypot(source.moveVector.x,source.moveVector.y) : 0,
    hasAimPoint:() => source.pointerInside,
    consume:action => canUseAction() ? source.consume(action) : false,
    isHeld:action => canUseAction() && source.isHeld(action),
    moveMagnitude:() => canUseMove() ? Math.hypot(source.moveVector.x,source.moveVector.y) : 0,
    updateEngineer(f, enemy, dt, api) {
      if (!STATE.active || f?.data?.manualController !== manual) return;
      const owner = fighterPlayerId(f);
      const life = owner ? lifecycleForPlayer(owner) : null;
      if (life?.dead || STATE.match?.state === 'ended') {
        source.pressed.clear();
        return;
      }
      manual.mineCooldown = Math.max(0, (manual.mineCooldown || 0) - dt);
      manual.warMachineCooldown = Math.max(0, (manual.warMachineCooldown || 0) - dt);
      if (manual.isLocal && Number.isFinite(STATE.selectedBlueprint)) manual.selectedBlueprint = STATE.selectedBlueprint;
      if (source.consume(ACTIONS.ABILITY_1)) manual.selectedBlueprint--;
      const kinds = engineerBlueprintKinds(api);
      manual.selectedBlueprint = ((manual.selectedBlueprint % kinds.length) + kinds.length) % kinds.length;
      if (manual.isLocal) STATE.selectedBlueprint = manual.selectedBlueprint;
      const move = source.moveVector;
      if ((move.x || move.y) && (!life || life.canMove)) f.setDir(move.x, move.y);
      if (life && (!life.canAttack || !life.canDealDamage)) {
        source.pressed.clear();
        api.setMagnetRequested(f, false);
        if (manual.isLocal) updateHud();
        return;
      }
      if (source.consume(ACTIONS.PRIMARY)) {
        if (!source.pointerInside) { if (manual.isLocal) feedback('AIM OUTSIDE ARENA', false); }
        else {
          const point = pointAtAimRange(f, source.aimPoint, api.buildRange || 100);
          const placement = point ? controlPlacementStatus(f, kinds[manual.selectedBlueprint], point.x, point.y, api.buildRange || 100) : {valid:false, reason:'AIM OUTSIDE ARENA'};
          const result = placement.valid
            ? api.commitBuildAt(f, kinds[manual.selectedBlueprint], point.x, point.y)
            : placement;
          if (manual.isLocal) feedback(result.reason, !!result.committed);
        }
      }
      if (source.consume(ACTIONS.SECONDARY)) {
        const pulled = api.setMagnetRequested(f, true);
        if (manual.isLocal) feedback(pulled ? 'MAGNET PULSE' : 'MAGNET ON COOLDOWN', !!pulled);
      }
      if (source.consume(ACTIONS.ABILITY_2)) {
        if (manual.mineCooldown > 0) { if (manual.isLocal) feedback(`MINE ${manual.mineCooldown.toFixed(1)}s`, false); }
        else if (!source.pointerInside) { if (manual.isLocal) feedback('AIM OUTSIDE ARENA', false); }
        else {
          const point = pointAtAimRange(f, source.aimPoint, api.buildRange || 100);
          const placement = point ? controlPlacementStatus(f, 'mine', point.x, point.y, api.buildRange || 100) : {valid:false, reason:'AIM OUTSIDE ARENA'};
          const result = placement.valid ? api.commitBuildAt(f, 'mine', point.x, point.y) : placement;
          if (result.committed) manual.mineCooldown = 5;
          if (manual.isLocal) feedback(result.reason, !!result.committed);
        }
      }
      const merge = api.requestAutoMerge?.(f);
      if (merge?.committed && manual.isLocal) feedback(merge.reason, true);
      if (source.consume(ACTIONS.APEX)) {
        if (manual.warMachineCooldown > 0) { if (manual.isLocal) feedback(`WAR MACHINE ${manual.warMachineCooldown.toFixed(1)}s`, false); updateHud(); return; }
        const result = api.requestWarMachine(f);
        if (result.committed) manual.warMachineCooldown = 10;
        if (manual.isLocal) feedback(result.reason, !!result.committed);
      }
      if (manual.isLocal) updateHud();
    },
    updateWarMachine(f, wm, enemy, dt, api) {
      if (!STATE.active || f?.data?.manualController !== manual) return;
      const owner = fighterPlayerId(f);
      const life = owner ? lifecycleForPlayer(owner) : null;
      if (life?.dead || STATE.match?.state === 'ended') {
        source.pressed.clear();
        return;
      }
      manual.warMachineCooldown = Math.max(0, (manual.warMachineCooldown || 0) - dt);
      manual.warLaserCooldown = Math.max(0, (manual.warLaserCooldown || 0) - dt);
      stabilizeEngineerPilotState(f, wm);
      const move = source.moveVector;
      if ((move.x || move.y) && (!life || life.canMove)) {
        const speed = (f.baseSpeed || 405) * .5;
        const radius = engineerApi()?.structureFootprint?.(wm) || wm.radius || 44;
        const before = {x:wm.x,y:wm.y};
        wm.x = clampWorldX(wm.x + move.x * speed * dt, radius);
        wm.y = clampWorldY(wm.y + move.y * speed * dt, radius);
        if (isBlockedCircle(wm.x, wm.y, radius) || segmentIntersectsWall(before, {x:wm.x,y:wm.y}, Math.min(42, radius * .45))) {
          wm.x = before.x;
          wm.y = before.y;
        }
        wm.dir = {x:move.x,y:move.y};
        f.setDir(move.x,move.y);
        stabilizeEngineerPilotState(f, wm);
      }
      if (life && (!life.canAttack || !life.canDealDamage)) {
        source.pressed.clear();
        if (manual.isLocal) updateHud();
        return;
      }
      const target = controlWarMachineAimTarget(f, wm, source.aimPoint, enemy);
      const aimDir = source.pointerInside ? norm(source.aimPoint.x - wm.x, source.aimPoint.y - wm.y) : null;
      if (aimDir && (aimDir.x || aimDir.y)) wm.aimAngle = Math.atan2(aimDir.y, aimDir.x) - Math.PI / 2;
      if (target && source.isHeld(ACTIONS.PRIMARY) && !engineerHasActiveConstruction(f) && manual.warLaserCooldown <= 0) {
        wm.aimAngle = Math.atan2(target.y - wm.y, target.x - wm.x) - Math.PI / 2;
        if (api?.fireWarMachineLaser?.(wm, target)) manual.warLaserCooldown = 5;
      }
      if (source.consume(ACTIONS.APEX)) {
        const data = window.APEX_ENGINEER?.ownerData?.(f);
        if (data?.pilotingWarMachine) {
          const result = api?.requestWarMachine?.(f) || {committed:false, reason:'WAR MACHINE API MISSING'};
          if (result.committed) manual.warMachineCooldown = 10;
          if (manual.isLocal) feedback(result.reason, !!result.committed);
        } else if (manual.warMachineCooldown > 0) { if (manual.isLocal) feedback(`WAR MACHINE ${manual.warMachineCooldown.toFixed(1)}s`, false); }
        else {
          const result = api?.requestWarMachine?.(f) || {committed:false, reason:'WAR MACHINE API MISSING'};
          if (result.committed) manual.warMachineCooldown = 10;
          if (manual.isLocal) feedback(result.reason, !!result.committed);
        }
      }
      if (source.consume(ACTIONS.CORE) && manual.isLocal) feedback('WAR MACHINE HAS NO CORE ACTION IN CURRENT RUNTIME', false);
      if (manual.isLocal) updateHud();
    }
    };
    return manual;
  }

  const controller = STATE.controller = makeManualController(input, {local:true});
  const remoteController = STATE.remoteController = makeManualController(remoteInput, {local:false});
  function makeBotControllerState() {
    return {
      enabled:true,
      difficulty:CONTROL_CONFIG.botDifficulty,
      state:'SECURE_HOME',
      objective:'secure p2 base',
      targetTerritory:'p2Base',
      targetPoint:{...SPAWN_POINTS.p2Base},
      targetWaypoint:null,
      route:[],
      routeIndex:0,
      reevaluate:0,
      stuckTimer:0,
      lastPos:null,
      action:'idle',
      canSeePlayer:true,
      skillTimer:0,
      attackPulse:0
    };
  }
  const WAYPOINTS = Object.freeze({
    P1_ROOM_CENTER:{x:S(750),y:S(750)},
    P1_EAST_DOOR:{x:S(1320),y:S(750)},
    P1_SOUTH_DOOR:{x:S(750),y:S(1320)},
    TOP_RIGHT_ROOM_CENTER:{x:S(2250),y:S(750)},
    TOP_RIGHT_WEST_DOOR:{x:S(1680),y:S(750)},
    TOP_RIGHT_SOUTH_DOOR:{x:S(2250),y:S(1320)},
    BOTTOM_LEFT_ROOM_CENTER:{x:S(750),y:S(2250)},
    BOTTOM_LEFT_EAST_DOOR:{x:S(1320),y:S(2250)},
    BOTTOM_LEFT_NORTH_DOOR:{x:S(750),y:S(1680)},
    P2_ROOM_CENTER:{x:S(2250),y:S(2250)},
    P2_WEST_DOOR:{x:S(1680),y:S(2250)},
    P2_NORTH_DOOR:{x:S(2250),y:S(1680)},
    NEUTRAL_CORE_CENTER:{x:S(1500),y:S(1500)},
    HORIZONTAL_LANE_LEFT:{x:S(1125),y:S(1500)},
    HORIZONTAL_LANE_RIGHT:{x:S(1875),y:S(1500)},
    VERTICAL_LANE_TOP:{x:S(1500),y:S(1125)},
    VERTICAL_LANE_BOTTOM:{x:S(1500),y:S(1875)}
  });
  const ROOM_NAV = Object.freeze({
    p1Base:['P1_EAST_DOOR','P1_SOUTH_DOOR'],
    topRightSpecial:['TOP_RIGHT_WEST_DOOR','TOP_RIGHT_SOUTH_DOOR'],
    bottomLeftSpecial:['BOTTOM_LEFT_EAST_DOOR','BOTTOM_LEFT_NORTH_DOOR'],
    p2Base:['P2_WEST_DOOR','P2_NORTH_DOOR']
  });
  const ROOM_CENTER_NAV = Object.freeze({
    p1Base:'P1_ROOM_CENTER',
    topRightSpecial:'TOP_RIGHT_ROOM_CENTER',
    bottomLeftSpecial:'BOTTOM_LEFT_ROOM_CENTER',
    p2Base:'P2_ROOM_CENTER'
  });
  function captureTargetPoint(roomId) {
    const spawn = SPAWN_POINTS[roomId];
    if (spawn) return {...spawn};
    const corner = CAPTURE_CORNERS[roomId];
    return corner ? {x:corner.originX, y:corner.originY} : worldCenter();
  }
  function nearestWaypointName(point, names=Object.keys(WAYPOINTS)) {
    return names.slice().sort((a,b) => dist(point.x,point.y,WAYPOINTS[a].x,WAYPOINTS[a].y) - dist(point.x,point.y,WAYPOINTS[b].x,WAYPOINTS[b].y))[0];
  }
  function directPathClear(a, b, radius=60) {
    return !raycastControlWall(a.x,a.y,b.x,b.y,radius * .45);
  }
  function routeToRoom(from, roomId, target) {
    const fromRoom = getControlRoomAt(from);
    const route = [];
    if (fromRoom && ROOM_NAV[fromRoom]) route.push(WAYPOINTS[nearestWaypointName(from, ROOM_NAV[fromRoom])]);
    else route.push(WAYPOINTS[nearestWaypointName(from, ['NEUTRAL_CORE_CENTER','HORIZONTAL_LANE_LEFT','HORIZONTAL_LANE_RIGHT','VERTICAL_LANE_TOP','VERTICAL_LANE_BOTTOM'])]);
    route.push(WAYPOINTS.NEUTRAL_CORE_CENTER);
    if (ROOM_NAV[roomId]) route.push(WAYPOINTS[nearestWaypointName(target, ROOM_NAV[roomId])]);
    if (ROOM_CENTER_NAV[roomId]) route.push(WAYPOINTS[ROOM_CENTER_NAV[roomId]]);
    route.push(target);
    return route.filter(Boolean);
  }
  function botCanSeePlayer(bot, player) {
    if (!bot || !player || player.hp <= 0) return false;
    return hasLineOfSight(bot, player, 24);
  }
  function nearestCreepForPlayer(f, maxDistance=900) {
    if (!f) return null;
    return (STATE.creeps || []).filter(c => c.hp > 0 && dist(f.x,f.y,c.x,c.y) <= maxDistance && hasLineOfSight(f, c, 18))
      .sort((a,b) => dist(f.x,f.y,a.x,a.y) - dist(f.x,f.y,b.x,b.y))[0] || null;
  }
  function chooseBotObjective(bot, p2, p1) {
    const territories = STATE.territories || {};
    chooseBotUpgradeIfPending();
    const p2Life = lifecycleForPlayer('p2');
    if (p2Life?.dead) return {state:'RESPAWNING', objective:'wait respawn', territory:null, point:p2};
    const p2Base = territories.p2Base;
    const defend = Object.values(territories).find(t => t.owner === 'p2' && t.actor === 'p1' && (t.stealProgress > 0 || t.status === 'stealing' || t.status === 'disabled'));
    const ownedHeal = Object.values(territories).find(t => t.owner === 'p2' && t.type === 'healPoint' && !t.disabled);
    const ownedRage = Object.values(territories).find(t => t.owner === 'p2' && t.type === 'ragePoint' && !t.disabled);
    const p2Level = levelState('p2')?.level || 1;
    const p1Level = levelState('p1')?.level || 1;
    const farmTarget = nearestCreepForPlayer(p2, 1150);
    if ((p2Level < Math.min(5, p1Level + 1) || (p2.hp / Math.max(1,p2.maxHp) < .55 && !ownedHeal)) && farmTarget) {
      return {state:'FARM_CREEP', objective:`farm ${farmTarget.id}`, territory:null, point:{x:farmTarget.x,y:farmTarget.y}, creepId:farmTarget.id};
    }
    if (STATE.dominance?.active && STATE.dominance.playerId === 'p1') {
      const critical = Object.values(territories).filter(t => t.owner === 'p1')
        .sort((a,b) => dist(p2.x,p2.y,captureTargetPoint(a.roomId).x,captureTargetPoint(a.roomId).y) - dist(p2.x,p2.y,captureTargetPoint(b.roomId).x,captureTargetPoint(b.roomId).y))[0];
      if (critical) return {state:'STEAL_ENEMY_TERRITORY', objective:`break p1 dominance ${critical.roomId}`, territory:critical.roomId};
    }
    if (STATE.dominance?.active && STATE.dominance.playerId === 'p2' && defend) {
      return {state:'DEFEND_OWN_TERRITORY', objective:`hold dominance ${defend.roomId}`, territory:defend.roomId};
    }
    if (p2Base && p2Base.owner !== 'p2' && ownedTerritoryCount('p2') === 0) {
      return {state:'SECURE_HOME', objective:'secure p2 base', territory:'p2Base'};
    }
    if (defend) return {state:'DEFEND_OWN_TERRITORY', objective:`defend ${defend.roomId}`, territory:defend.roomId};
    if (ownedHeal && p2.hp / Math.max(1,p2.maxHp) < .42) {
      return {state:'RETREAT_TO_HEAL', objective:`retreat heal ${ownedHeal.roomId}`, territory:ownedHeal.roomId};
    }
    const p1Owned = Object.values(territories).filter(t => t.owner === 'p1');
    if (p1Owned.length >= 2) {
      const target = p1Owned.sort((a,b) => dist(p2.x,p2.y,captureTargetPoint(a.roomId).x,captureTargetPoint(a.roomId).y) - dist(p2.x,p2.y,captureTargetPoint(b.roomId).x,captureTargetPoint(b.roomId).y))[0];
      return {state:'STEAL_ENEMY_TERRITORY', objective:`steal ${target.roomId}`, territory:target.roomId};
    }
    const neutral = Object.values(territories).filter(t => t.owner == null && canCaptureNeutral(t, 'p2'));
    if (neutral.length) {
      const lowHp = p2.hp / Math.max(1,p2.maxHp) < .45;
      const preferred = neutral.find(t => lowHp && t.type === 'healPoint') || neutral.find(t => t.type === 'ragePoint') || neutral[0];
      return {state:'CAPTURE_NEUTRAL', objective:`capture ${preferred.roomId}`, territory:preferred.roomId};
    }
    if (p1Owned.length) {
      const target = p1Owned[0];
      return {state:'STEAL_ENEMY_TERRITORY', objective:`steal ${target.roomId}`, territory:target.roomId};
    }
    if (ownedRage && isFighterInEffectRoom(p2, ownedRage.roomId) && p1 && dist(p2.x,p2.y,p1.x,p1.y) < 650) return {state:'FIGHT_PLAYER', objective:'fight with rage', territory:null};
    if (farmTarget) return {state:'FARM_CREEP', objective:`farm ${farmTarget.id}`, territory:null, point:{x:farmTarget.x,y:farmTarget.y}, creepId:farmTarget.id};
    if (p1 && dist(p2.x,p2.y,p1.x,p1.y) < 520) return {state:'FIGHT_PLAYER', objective:'fight player', territory:null};
    return {state:'PATROL_NEUTRAL', objective:'patrol neutral', territory:null, point:worldCenter()};
  }
  function setBotRoute(bot, p2) {
    const target = bot.targetPoint || captureTargetPoint(bot.targetTerritory);
    if (directPathClear(p2, target, p2.radius || CONTROL_CONFIG.championRadius)) bot.route = [target];
    else bot.route = routeToRoom(p2, bot.targetTerritory || getControlRoomAt(target) || 'p2Base', target);
    bot.routeIndex = 0;
  }
  function pressBotAction(source, action) {
    source.held.add(action);
    source.pressed.add(action);
  }
  function updateBotController(dt) {
    const bot = STATE.bot;
    const p2 = fighters?.[1] || null;
    const p1 = fighters?.[0] || null;
    if (!STATE.active || !bot?.enabled || !p2 || p2.hp <= 0) return;
    remoteInput.held.clear();
    remoteInput.pressed.clear();
    remoteInput.pointerInside = true;
    bot.canSeePlayer = botCanSeePlayer(p2, p1);
    bot.reevaluate -= dt;
    if (bot.reevaluate <= 0) {
      const objective = chooseBotObjective(bot, p2, p1);
      const changed = objective.state !== bot.state || objective.territory !== bot.targetTerritory;
      bot.state = objective.state;
      bot.objective = objective.objective;
      bot.targetTerritory = objective.territory;
      bot.creepId = objective.creepId || null;
      bot.targetPoint = objective.point ? {...objective.point} : objective.territory ? captureTargetPoint(objective.territory) : (p1 ? {x:p1.x,y:p1.y} : worldCenter());
      bot.reevaluate = bot.difficulty === 'hard' ? .25 : bot.difficulty === 'easy' ? .65 : .4;
      if (changed || !bot.route?.length) setBotRoute(bot, p2);
    }
    if (p1 && bot.canSeePlayer && dist(p2.x,p2.y,p1.x,p1.y) < 430) {
      const p1Corner = isInsideCaptureCorner({x:p1.x,y:p1.y});
      const p2Corner = isInsideCaptureCorner({x:p2.x,y:p2.y});
      if (p1Corner && p1Corner === p2Corner) bot.state = 'CONTEST_PLAYER';
      else if (!bot.targetTerritory) bot.state = 'FIGHT_PLAYER';
    }
    const current = bot.route?.[bot.routeIndex] || bot.targetPoint || (p1 ? {x:p1.x,y:p1.y} : worldCenter());
    bot.targetWaypoint = current;
    if (bot.lastPos && dist(p2.x,p2.y,bot.lastPos.x,bot.lastPos.y) < 5 && Math.hypot(remoteInput.moveVector.x,remoteInput.moveVector.y) > .2) bot.stuckTimer += dt;
    else bot.stuckTimer = Math.max(0, bot.stuckTimer - dt * .5);
    bot.lastPos = {x:p2.x,y:p2.y};
    if (bot.stuckTimer > 2 || (bot.stuckTimer > .5 && isInsideWall({x:p2.x,y:p2.y}, p2.radius || 70))) {
      setBotRoute(bot, p2);
      bot.stuckTimer = 0;
    }
    const distanceToWaypoint = dist(p2.x,p2.y,current.x,current.y);
    if (distanceToWaypoint < 55 && bot.routeIndex < (bot.route?.length || 1) - 1) {
      bot.routeIndex += 1;
      bot.targetWaypoint = bot.route[bot.routeIndex];
    }
    const holdCorner = bot.targetTerritory && isInsideCaptureCorner({x:p2.x,y:p2.y}) === bot.targetTerritory;
    const fightDistance = p1 ? dist(p2.x,p2.y,p1.x,p1.y) : Infinity;
    let moveTarget = holdCorner ? p2 : (bot.targetWaypoint || bot.targetPoint);
    if (bot.state === 'FIGHT_PLAYER' && p1) moveTarget = fightDistance > 260 ? p1 : p2;
    if (bot.state === 'FARM_CREEP') {
      const creep = (STATE.creeps || []).find(c => c.id === bot.creepId && c.hp > 0) || nearestCreepForPlayer(p2, 1200);
      if (creep) {
        bot.targetPoint = {x:creep.x,y:creep.y};
        moveTarget = dist(p2.x,p2.y,creep.x,creep.y) > 185 ? creep : p2;
      }
    }
    if (bot.state === 'RETREAT_TO_HEAL') moveTarget = bot.targetPoint || captureTargetPoint('p2Base');
    const mv = holdCorner && fightDistance < 380
      ? norm((p2.x - (p1?.x || p2.x)) * .18 + (bot.targetPoint.x - p2.x), (p2.y - (p1?.y || p2.y)) * .18 + (bot.targetPoint.y - p2.y))
      : norm(moveTarget.x - p2.x, moveTarget.y - p2.y);
    remoteInput.moveVector = (holdCorner && fightDistance > 520) || distanceToWaypoint < 20 ? {x:0,y:0} : mv;
    if (remoteInput.moveVector.x || remoteInput.moveVector.y) {
      remoteInput.held.add('BOT_MOVE');
      bot.action = holdCorner ? 'capture' : 'move';
    } else bot.action = holdCorner ? 'capture' : 'idle';
    const aimError = bot.difficulty === 'hard' ? 16 : bot.difficulty === 'easy' ? 95 : 42;
    const farmCreep = bot.state === 'FARM_CREEP' ? ((STATE.creeps || []).find(c => c.id === bot.creepId && c.hp > 0) || nearestCreepForPlayer(p2, 1200)) : null;
    const aimBase = farmCreep || (p1 && bot.canSeePlayer ? p1 : (bot.targetWaypoint || bot.targetPoint));
    remoteInput.aimPoint = {x:aimBase.x + rand(-aimError, aimError), y:aimBase.y + rand(-aimError, aimError)};
    bot.skillTimer = Math.max(0, bot.skillTimer - dt);
    bot.attackPulse = Math.max(0, bot.attackPulse - dt);
    if (farmCreep && dist(p2.x,p2.y,farmCreep.x,farmCreep.y) < 320) {
      remoteInput.held.add(ACTIONS.PRIMARY);
      bot.action = 'farm';
      if (bot.attackPulse <= 0) {
        remoteInput.pressed.add(ACTIONS.PRIMARY);
        bot.attackPulse = .32;
      }
    } else if (p1 && bot.canSeePlayer && fightDistance < 560) {
      remoteInput.held.add(ACTIONS.PRIMARY);
      bot.action = bot.state === 'CONTEST_PLAYER' ? 'contest+attack' : 'attack';
      if (bot.attackPulse <= 0) {
        remoteInput.pressed.add(ACTIONS.PRIMARY);
        bot.attackPulse = bot.difficulty === 'easy' ? .65 : bot.difficulty === 'hard' ? .24 : .38;
      }
      if (bot.skillTimer <= 0) {
        const roll = Math.random();
        pressBotAction(remoteInput, roll < .45 ? ACTIONS.ABILITY_1 : roll < .8 ? ACTIONS.ABILITY_2 : ACTIONS.APEX);
        bot.skillTimer = bot.difficulty === 'easy' ? 2.4 : bot.difficulty === 'hard' ? .95 : 1.45;
        bot.action += '+skill';
      }
    }
  }
  function applyBotFallbackMovement(dt, beforeP2=null) {
    const bot = STATE.bot;
    const p2 = fighters?.[1] || null;
    if (!STATE.active || !bot?.enabled || !p2 || p2.hp <= 0 || p2.data?.manualController === remoteController) return;
    const mv = remoteInput.moveVector || {x:0,y:0};
    if (!mv.x && !mv.y) return;
    const life = lifecycleForPlayer('p2');
    if (life?.dead || life?.canMove === false || p2.hardCC?.() || p2.data?.positionLocked) return;
    const moved = beforeP2 && dist(p2.x,p2.y,beforeP2.x,beforeP2.y) > 2;
    if (moved) return;
    const speed = (p2.baseSpeed || CONTROL_CONFIG.playerSpeed || 450) * (p2.speedMult?.() || 1);
    const before = {x:p2.x,y:p2.y};
    p2.setDir(mv.x,mv.y);
    p2.x = clampWorldX(p2.x + mv.x * speed * dt, p2.radius || CONTROL_CONFIG.championRadius);
    p2.y = clampWorldY(p2.y + mv.y * speed * dt, p2.radius || CONTROL_CONFIG.championRadius);
    if (isBlockedCircle(p2.x,p2.y,p2.radius || CONTROL_CONFIG.championRadius) || segmentIntersectsWall(before, {x:p2.x,y:p2.y}, Math.min(42, (p2.radius || 70) * .45))) {
      p2.x = before.x;
      p2.y = before.y;
    }
  }

  function detachManualController(f, expected=null) {
    if (!f?.data?.manualController) return;
    if (!expected || f.data.manualController === expected) {
      if (f.name === 'KATANA') window.APEX_KATANA?.manualApi?.reset?.(f);
      if (f.name === 'ENGINEER') window.APEX_ENGINEER?.manualApi?.setMagnetRequested?.(f, false);
      delete f.data.manualController;
    }
  }

  function attachController() {
    for (const fighter of fighters || []) {
      if (fighter?.data?.manualController === controller || fighter?.data?.manualController === remoteController) detachManualController(fighter);
    }
    const localSlot = STATE.localSlot === 1 ? 1 : 0;
    const remoteSlot = STATE.remoteSlot === 0 || STATE.remoteSlot === 1 ? STATE.remoteSlot : null;
    const f = fighters?.[localSlot] || null;
    const remote = remoteSlot !== null ? fighters?.[remoteSlot] || null : null;
    STATE.localFighter = f;
    STATE.opponent = fighters?.[localSlot === 0 ? 1 : 0] || null;
    controller.active = !!(STATE.active && supportedManualFighter(f));
    if (controller.active) {
      f.data ||= {};
      f.data.manualController = controller;
      const d = window.APEX_ENGINEER?.ownerData?.(f);
      if (d) d.openingPending = false;
      if (f.name === 'KATANA') window.APEX_KATANA?.manualApi?.reset?.(f);
    }
    remoteController.active = !!(STATE.active && remote && remote !== f && supportedManualFighter(remote));
    if (remoteController.active) {
      remote.data ||= {};
      remote.data.manualController = remoteController;
      const d = window.APEX_ENGINEER?.ownerData?.(remote);
      if (d) d.openingPending = false;
      if (remote.name === 'KATANA') window.APEX_KATANA?.manualApi?.reset?.(remote);
    }
  }
  function deactivate(clearRoute=true) {
    releaseHeldInput();
    remoteInput.clear();
    input.active = false;
    controller.active = false;
    remoteController.active = false;
    detachManualController(STATE.localFighter, controller);
    for (const fighter of fighters || []) detachManualController(fighter, remoteController);
    STATE.active = false;
    STATE.localFighter = null;
    STATE.opponent = null;
    STATE.feedback = null;
    STATE.remoteSlot = null;
    STATE.territories = null;
    STATE.bot = null;
    STATE.captureContest = false;
    STATE.effects = null;
    STATE.bosses = null;
    STATE.lockedCaptureZones = new Set();
    STATE.neutralTurrets = null;
    STATE.creeps = null;
    STATE.creepSpawner = null;
    STATE.levels = null;
    STATE.lifecycle = null;
    STATE.match = {state:'idle', winner:null, endReason:null, message:null};
    if (clearRoute) STATE.selecting = false;
    document.body.classList.remove('manual-lab-mode','manual-lab-select');
    document.getElementById('manual-lab-hud')?.classList.add('hidden');
    restoreLegacyWorld();
  }
  function activate(ft1, ft2, opts) {
    applyControlWorld();
    STATE.active = true;
    STATE.selecting = false;
    STATE.localSlot = opts.localSlot === 1 ? 1 : 0;
    STATE.remoteSlot = opts.remoteSlot === 0 || opts.remoteSlot === 1 ? opts.remoteSlot : (STATE.localSlot === 0 ? 1 : 0);
    STATE.specialAssignments = rollSpecialAssignments();
    STATE.territories = createTerritoryState();
    seedHomeBaseOwnership();
    STATE.captureContest = false;
    STATE.lastKillBonus = null;
    STATE.bot = makeBotControllerState();
    STATE.effects = createEffectState();
    STATE.bosses = createBossState();
    STATE.lockedCaptureZones = new Set();
    STATE.neutralTurrets = createNeutralTurrets();
    STATE.creeps = [];
    STATE.creepSpawner = createCreepSpawner();
    STATE.levels = createLevelState();
    STATE.lifecycle = createLifecycleState();
    STATE.match = {state:'playing', winner:null, endReason:null, message:null};
    STATE.dominance = {active:false, playerId:null, timer:0, lastCanceled:null};
    STATE.lastConfig = {ft1,ft2,opts:{...opts,manualLab:true,countdown:false,tournament:false,trial:false}};
    input.active = true;
    input.clear();
    remoteInput.clear();
    controller.selectedBlueprint = STATE.selectedBlueprint || 0;
    remoteController.selectedBlueprint = 0;
    for (const f of fighters || []) {
      if (!f) continue;
      f.maxHp = CONTROL_CONFIG.playerHp;
      f.hp = CONTROL_CONFIG.playerHp;
      f.data ||= {};
      f.data.apexControl = { modeId:CONTROL_CONFIG.modeId };
      clampWorldEntity(f);
    }
    applyAllPlayerLevelStats();
    if (fighters?.[0]) { fighters[0].x = SPAWN_POINTS.p1Base.x; fighters[0].y = SPAWN_POINTS.p1Base.y; }
    if (fighters?.[1]) { fighters[1].x = SPAWN_POINTS.p2Base.x; fighters[1].y = SPAWN_POINTS.p2Base.y; }
    spawnBoss(STATE.bosses.rage);
    spawnBoss(STATE.bosses.heal);
    refreshBossLocks();
    document.body.classList.remove('manual-lab-select');
    document.body.classList.add('manual-lab-mode');
    attachController();
    updateHUD();
    feedback(supportedManualFighter(STATE.localFighter) ? `MANUAL CONTROL ACTIVE · P${STATE.localSlot+1}` : 'LOCAL CHAMPION REMAINS AUTOBATTLE AI', true, 1.4);
    updateHud();
  }

  function drawManualOverlay(localCtx) {
    const f = currentEngineer();
    const api = engineerApi();
    if (!f || !api || gameState !== 'PLAYING') return;
    const d = window.APEX_ENGINEER?.ownerData?.(f);
    if (d?.pilotingWarMachine || !input.pointerInside) return;
    const aim = pointAtAimRange(f, input.aimPoint, api?.buildRange || 100) || input.aimPoint;
    const kind = selectedKind();
    const placement = controlPlacementStatus(f, kind, aim.x, aim.y, 100);
    localCtx.save();
    localCtx.strokeStyle = placement.valid ? 'rgba(75,255,160,.9)' : 'rgba(255,85,70,.9)';
    localCtx.fillStyle = placement.valid ? 'rgba(75,255,160,.12)' : 'rgba(255,85,70,.12)';
    localCtx.lineWidth = 4;
    localCtx.setLineDash([12,9]);
    localCtx.beginPath(); localCtx.arc(f.x,f.y,100,0,TAU); localCtx.stroke();
    localCtx.setLineDash([]);
    const spec = api.baseSpecs[kind];
    const ghost = {owner:f,kind,state:'building',x:aim.x,y:aim.y,radius:spec.radius,blockRadius:0,hp:spec.underHp,maxHp:spec.underHp,progress:.5,fireCd:0};
    localCtx.globalAlpha = placement.valid ? .48 : .28;
    api.drawStructure(localCtx, ghost);
    localCtx.globalAlpha = 1;
    localCtx.fillStyle = placement.valid ? '#9cffad' : '#ff8c7f';
    localCtx.font = '900 18px ui-monospace, monospace';
    localCtx.textAlign = 'center';
    localCtx.fillText(placement.reason, aim.x, aim.y - (api.structureVisualFootprint(ghost) || 48) - 18);
    const merge = api.mergeCandidateAt(f, aim.x, aim.y);
    if (merge) {
      localCtx.strokeStyle = '#7ff8ff';
      localCtx.fillStyle = 'rgba(49,245,255,.12)';
      localCtx.lineWidth = 7;
      for (const s of merge.ingredients) {
        const radius = api.structureVisualFootprint(s) + 12;
        localCtx.beginPath(); localCtx.arc(s.x,s.y,radius,0,TAU); localCtx.fill(); localCtx.stroke();
      }
    }
    localCtx.restore();
  }

  const previousDrawManualLab = drawProjectiles;
  drawProjectiles = function(localCtx) {
    const result = previousDrawManualLab(localCtx);
    drawManualOverlay(localCtx);
    return result;
  };
  function activeCaptureRows() {
    return Object.values(STATE.territories || {}).filter(t => t.contested || t.disabled || t.captureProgress > 0 || t.stealProgress > 0)
      .map(t => {
        const req = t.owner && t.actor && t.actor !== t.owner ? CONTROL_CONFIG.stealSeconds : captureRequirement(t, t.actor);
        const value = t.owner && t.actor && t.actor !== t.owner ? t.stealProgress : t.captureProgress;
        return `${TERRITORY_LABELS[t.roomId]} ${t.status} ${value.toFixed(1)}/${req}`;
      });
  }
  function disabledTerritories() {
    return Object.values(STATE.territories || {}).filter(t => t.disabled).map(t => TERRITORY_LABELS[t.roomId]);
  }
  function drawDebugPanel(localCtx, view) {
    const debug = STATE.debug || {};
    if (debug.mode === 'off') return;
    const p = STATE.localFighter || fighters?.[STATE.localSlot] || fighters?.[0] || null;
    const p2 = fighters?.[1] || null;
    const point = p ? {x:p.x,y:p.y} : null;
    const p2Point = p2 ? {x:p2.x,y:p2.y} : null;
    const region = point ? getControlRegionAt(point, p.radius || 0) : 'none';
    const room = point ? getControlRoomAt(point) : null;
    const p2Room = p2Point ? getControlRoomAt(p2Point) : null;
    const door = point ? getControlDoorAt(point, p?.radius || 0, 0) : null;
    const capture = point ? isInsideCaptureCorner(point) : null;
    const p2Capture = p2Point ? isInsideCaptureCorner(p2Point) : null;
    const neutral = point ? isInsideNeutralNoEffectZone(point) : false;
    const wall = point ? isInsideWall(point, p?.radius || 0) : false;
    const structures = engineerStructures();
    const px = p ? `${p.x.toFixed(1)}, ${p.y.toFixed(1)}` : '--';
    const hp = p ? `${p.hp.toFixed(1)} / ${p.maxHp}` : '--';
    const p2Pos = p2 ? `${p2.x.toFixed(1)}, ${p2.y.toFixed(1)}` : '--';
    const bot = STATE.bot;
    const effects = STATE.effects || {};
    const healActiveZone = activeZoneForZone('topRightSpecial');
    const healCaptureZone = zoneById(CONTROL_CAPTURE_ZONES, 'topRightSpecial');
    const healLocked = !!STATE.lockedCaptureZones?.has('topRightSpecial');
    const healInsideActive = p ? fighterInZone(p, healActiveZone, p.radius || 0) : false;
    const healInsideCapture = p ? fighterInZone(p, healCaptureZone, p.radius || 0) : false;
    const bossRows = Object.values(STATE.bosses || {}).map(b => `${b.champion}:${b.dead?'DEAD':b.spawned?`${b.fighter?.hp?.toFixed?.(0) || 0}HP ${b.active?'ACTIVE':'GUARD'}`:'WAIT'}`).join(' | ') || 'none';
    const lockRows = [...(STATE.lockedCaptureZones || new Set())].map(id => TERRITORY_LABELS[id] || id).join(', ') || 'none';
    const dev = debug.mode === 'dev';
    const activeRows = activeCaptureRows();
    const disabled = disabledTerritories();
    const basicRows = [
      `P1 room: ${room || 'none'} | corner: ${capture || 'none'}`,
      `Territories: P1 ${ownedTerritoryCount('p1')} / P2 ${ownedTerritoryCount('p2')}`,
      `Active: ${activeRows[0] || 'none'}`,
      `Disabled: ${disabled.join(', ') || 'none'}`,
      `Heal P1/P2: ${effects.heal?.p1 || 'OFF'} / ${effects.heal?.p2 || 'OFF'}`,
      `Rage P1/P2: ${effects.rage?.p1 || 'OFF'} / ${effects.rage?.p2 || 'OFF'}`,
      `Turret: P1 ${effects.turret?.p1Base || 'OFF'} | P2 ${effects.turret?.p2Base || 'OFF'}`,
      `Boss: ${bossRows}`,
      `Locks: ${lockRows}`,
      `HEAL active/cap/lock: ${healInsideActive}/${healInsideCapture}/${healLocked}`,
      `P2 Bot: ${bot?.state || 'off'} | ${bot?.objective || 'none'}`
    ];
    const devRows = [
      `World: ${worldWidth()}x${worldHeight()}`,
      `Camera: ${view.worldX.toFixed(0)},${view.worldY.toFixed(0)},${view.width},${view.height}`,
      `P1 world: ${px}`,
      `P2 world: ${p2Pos}`,
      `P1 HP: ${hp}`,
      `P1 room: ${room || 'none'}`,
      `P2 room: ${p2Room || 'none'}`,
      `P1 region: ${region}`,
      `P1 neutral: ${neutral}`,
      `P1 capture corner: ${capture || 'none'}`,
      `P2 capture corner: ${p2Capture || 'none'}`,
      `P1 door: ${door ? `${door.roomId}.${door.doorId}` : 'false'}`,
      `P1 wall: ${wall}`,
      `Capture Contest: ${STATE.captureContest}`,
      `Engineer structures: ${structures.length}`,
      `Boss: ${bossRows}`,
      `Locks: ${lockRows}`,
      `HEAL active: ${healInsideActive} ${healActiveZone?.fallback ? '(fallback)' : ''}`,
      `HEAL capture: ${healInsideCapture} locked ${healLocked}`,
      `Map warnings: ${(STATE.mapWarnings || []).length}`,
      `Debug: F1 ${debug.mode} F2 zones ${!!debug.zones} F3 walls ${!!debug.walls} F4 bot ${!!debug.botRoute} F5 structs ${!!debug.structures} F6 rings ${!!debug.rings} F7 boss ${!!debug.bosses} F8 locks ${!!debug.locks}`
    ];
    const rows = dev ? devRows : basicRows;
    localCtx.save();
    localCtx.globalAlpha = .94;
    const panelW = dev ? 520 : 430;
    const panelH = Math.min(canvas.height - 24, 54 + rows.length * 16 + (dev ? 190 : 0));
    localCtx.fillStyle = 'rgba(4,10,14,.78)';
    localCtx.strokeStyle = 'rgba(127,248,255,.42)';
    localCtx.lineWidth = 2;
    localCtx.fillRect(12, 12, panelW, panelH);
    localCtx.strokeRect(12, 12, panelW, panelH);
    localCtx.textAlign = 'left';
    localCtx.textBaseline = 'top';
    localCtx.font = '900 15px ui-monospace, monospace';
    localCtx.fillStyle = '#7ff8ff';
    localCtx.shadowColor = 'rgba(49,245,255,.55)';
    localCtx.shadowBlur = 6;
    localCtx.fillText(`APEX CONTROL | ${debug.mode.toUpperCase()}`, 24, 22);
    localCtx.shadowBlur = 0;
    localCtx.font = '800 12px ui-monospace, monospace';
    localCtx.fillStyle = '#eaffff';
    rows.forEach((row, index) => localCtx.fillText(row, 24, 46 + index * 16));
    if (dev) {
      let y = 54 + rows.length * 16;
      localCtx.fillStyle = '#ffe58d';
      localCtx.fillText('Territory states:', 24, y);
      y += 16;
      for (const territory of Object.values(STATE.territories || {})) {
        const capReq = captureRequirement(territory, territory.actor);
        const disabledFlag = territory.disabled ? ' DISABLED' : '';
        const progress = territory.owner && territory.actor && territory.actor !== territory.owner
          ? `steal ${territory.stealProgress.toFixed(1)}/${CONTROL_CONFIG.stealSeconds}`
          : `cap ${territory.captureProgress.toFixed(1)}/${capReq}`;
        localCtx.fillText(`- ${TERRITORY_LABELS[territory.roomId]} ${territory.type}: ${territory.owner || 'none'} ${territory.status} ${progress}${disabledFlag}`, 24, y);
        y += 16;
      }
      y += 5;
      localCtx.fillStyle = '#b6ff70';
      const botRows = [
        `Bot target: ${bot?.targetTerritory || 'none'} waypoint ${bot?.targetWaypoint ? `${bot.targetWaypoint.x.toFixed(0)},${bot.targetWaypoint.y.toFixed(0)}` : 'none'}`,
        `Bot see: ${!!bot?.canSeePlayer} dist ${bot?.targetPoint && p2 ? dist(p2.x,p2.y,bot.targetPoint.x,bot.targetPoint.y).toFixed(0) : '--'} stuck ${(bot?.stuckTimer || 0).toFixed(1)} action ${bot?.action || 'idle'}`,
        `Last kill bonus: ${STATE.lastKillBonus ? `${STATE.lastKillBonus.actor}+${STATE.lastKillBonus.bonus}s ${STATE.lastKillBonus.roomId}` : 'none'}`
      ];
      for (const row of botRows) {
        localCtx.fillText(row, 24, y);
        y += 16;
      }
    }
    localCtx.restore();
  }
  function drawRectDebug(localCtx, rect, fill, stroke, label) {
    localCtx.save();
    localCtx.fillStyle = fill;
    localCtx.strokeStyle = stroke;
    localCtx.lineWidth = 4;
    localCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
    localCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    localCtx.restore();
  }
  function drawPolygonDebug(localCtx, polygon, fill, stroke, label) {
    const pts = polygon?.worldPoints || [];
    if (pts.length < 2) return;
    localCtx.save();
    localCtx.fillStyle = fill;
    localCtx.strokeStyle = stroke;
    localCtx.lineWidth = 4;
    localCtx.beginPath();
    pts.forEach((pt, index) => index ? localCtx.lineTo(pt.x, pt.y) : localCtx.moveTo(pt.x, pt.y));
    localCtx.closePath();
    localCtx.fill();
    localCtx.stroke();
    if (label) {
      const b = boundsFromPoints(pts);
      localCtx.fillStyle = stroke;
      localCtx.font = '900 22px ui-monospace, monospace';
      localCtx.fillText(label, b.x + 12, b.y + 28);
    }
    localCtx.restore();
  }
  function fittedImageRect(img, item, fit='fill') {
    const target = {x:-item.w / 2, y:-item.h / 2, w:item.w, h:item.h};
    if (!img?.naturalWidth || !img?.naturalHeight || fit === 'fill') return target;
    const natural = img.naturalWidth / Math.max(1, img.naturalHeight);
    const box = item.w / Math.max(1, item.h);
    if (fit === 'cover') {
      if (box > natural) {
        const h = item.w / natural;
        return {x:-item.w / 2, y:-h / 2, w:item.w, h};
      }
      const w = item.h * natural;
      return {x:-w / 2, y:-item.h / 2, w, h:item.h};
    }
    if (box > natural) {
      const w = item.h * natural;
      return {x:-w / 2, y:-item.h / 2, w, h:item.h};
    }
    const h = item.w / natural;
    return {x:-item.w / 2, y:-h / 2, w:item.w, h};
  }
  function captureRingDrawRect(ring, img) {
    const rect = fittedImageRect(img, ring, ring.objectFit || ring.fit || 'contain');
    return {x:ring.x + ring.w / 2 + rect.x, y:ring.y + ring.h / 2 + rect.y, w:rect.w, h:rect.h};
  }
  function currentViewRect(margin=220) {
    const view = window.__apexCameraView || {worldX:0,worldY:0,width:worldWidth(),height:worldHeight()};
    return {
      x:(view.worldX || 0) - margin,
      y:(view.worldY || 0) - margin,
      w:(view.width || CONTROL_CONFIG.viewportWidth) + margin * 2,
      h:(view.height || CONTROL_CONFIG.viewportHeight) + margin * 2
    };
  }
  function itemInCurrentView(item, margin=220) {
    if (!item || !Number.isFinite(item.x) || !Number.isFinite(item.y) || !Number.isFinite(item.w) || !Number.isFinite(item.h)) return true;
    const view = currentViewRect(margin);
    return item.x + item.w >= view.x && item.x <= view.x + view.w && item.y + item.h >= view.y && item.y <= view.y + view.h;
  }
  function drawCaptureRingProgressMask(localCtx, img, ring, progress) {
    if (!ring?.visible || !ring.w || !ring.h || progress <= 0) return;
    const fit = ring.objectFit || ring.fit || 'contain';
    const rect = fittedImageRect(img, ring, fit === 'fill' ? 'contain' : fit);
    const radius = Math.hypot(rect.w, rect.h) * .55;
    localCtx.save();
    localCtx.globalAlpha *= .95 * (ring.opacity ?? 1);
    localCtx.translate(ring.x + ring.w / 2, ring.y + ring.h / 2);
    localCtx.rotate(((ring.rotation ?? ring.rotate ?? 0) * Math.PI) / 180);
    localCtx.scale(ring.flipX ? -1 : 1, ring.flipY ? -1 : 1);
    localCtx.beginPath();
    localCtx.moveTo(0, 0);
    localCtx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(progress, 0, 1), false);
    localCtx.closePath();
    localCtx.clip();
    if (img?.complete && img.naturalWidth) {
      perfCount('canvasDrawCalls');
      localCtx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
    }
    else {
      localCtx.fillStyle = 'rgba(130,240,255,.45)';
      perfCount('canvasDrawCalls');
      localCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    localCtx.restore();
  }
  function drawTransformedImage(localCtx, img, item, alpha=1, options={}) {
    if (!img || !item?.visible || !item.w || !item.h) return;
    if (!itemInCurrentView(item, 360)) return;
    const fit = options.fit || item.objectFit || item.fit || 'fill';
    const rect = fittedImageRect(img, item, options.preserveAspect ? (fit === 'fill' ? 'contain' : fit) : fit);
    localCtx.save();
    localCtx.globalAlpha *= alpha * (item.opacity ?? 1);
    localCtx.translate(item.x + item.w / 2, item.y + item.h / 2);
    localCtx.rotate(((item.rotation ?? item.rotate ?? 0) * Math.PI) / 180);
    localCtx.scale(item.flipX ? -1 : 1, item.flipY ? -1 : 1);
    if (img.complete && img.naturalWidth) {
      perfCount('canvasDrawCalls');
      localCtx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
    }
    else {
      localCtx.fillStyle = 'rgba(28,34,42,.85)';
      perfCount('canvasDrawCalls');
      localCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    localCtx.restore();
  }
  function isMapHighlightLayer(layer) {
    const srcText = `${layer?.assetKey || ''} ${layer?.id || ''} ${layer?.src || ''}`;
    return /overlay_(cyan|green|purple|red)|overlay.*alpha/i.test(srcText);
  }
  const CONTROL_HIGHLIGHT_LAYERS = Object.freeze(CONTROL_VISUAL_LAYERS_SORTED
    .map((layer, index) => ({layer, index}))
    .filter(item => isMapHighlightLayer(item.layer)));
  const CONTROL_BASE_VISUAL_LAYERS = Object.freeze(CONTROL_VISUAL_LAYERS_SORTED
    .map((layer, index) => ({layer, index}))
    .filter(item => !isMapHighlightLayer(item.layer)));
  function renderMapHighlightLayer(localCtx, layer, time, index) {
    if (!isMapHighlightLayer(layer)) {
      drawTransformedImage(localCtx, imageFor(layer.src, STATE.visualImages), layer, 1);
      return;
    }
    const phase = index * 1.37;
    const pulse = clamp(.72 + Math.sin(time * 2.15 + phase) * .22, .42, .94);
    drawTransformedImage(localCtx, imageFor(layer.src, STATE.visualImages), layer, pulse);
  }
  function drawControlVisualMap(localCtx) {
    if (!CONTROL_VISUAL_LAYERS.length) {
      drawBackground(localCtx);
      return;
    }
    const time = performance.now() / 1000;
    for (const item of CONTROL_BASE_VISUAL_LAYERS) {
      renderMapHighlightLayer(localCtx, item.layer, time, item.index);
    }
    localCtx.save();
    localCtx.globalCompositeOperation = 'multiply';
    localCtx.fillStyle = 'rgba(16,18,22,.24)';
    const view = currentViewRect(0);
    perfCount('canvasDrawCalls');
    localCtx.fillRect(view.x, view.y, view.w, view.h);
    localCtx.restore();
    for (const item of CONTROL_HIGHLIGHT_LAYERS) {
      renderMapHighlightLayer(localCtx, item.layer, time, item.index);
    }
    drawCaptureRings(localCtx);
  }
  function ringProgressForZone(zoneId) {
    const territory = STATE.territories?.[zoneId];
    if (!territory) return 0;
    if (territory.owner) return territory.disabled ? .35 : 1;
    const req = captureRequirement(territory, territory.actor);
    return clamp((territory.captureProgress || 0) / Math.max(.001, req), 0, 1);
  }
  function drawCaptureRings(localCtx) {
    for (const ring of CONTROL_CAPTURE_RINGS) {
      const src = CONTROL_RING_ASSETS[ring.assetKey];
      const img = imageFor(src, STATE.captureRingImages);
      const progress = ringProgressForZone(ring.zoneId);
      ring.progress = progress;
      drawTransformedImage(localCtx, img, ring, .22, {preserveAspect:true, fit:ring.objectFit || ring.fit || 'contain'});
      if (progress <= 0) continue;
      drawCaptureRingProgressMask(localCtx, img, ring, progress);
    }
  }
  function drawControlCustomProjectiles(localCtx) {
    for (const p of projectiles || []) {
      if (p?.type !== 'apex_control_turret_shot' && p?.type !== 'apex_control_turret_rocket') continue;
      const a = clamp((p.life || 0) / Math.max(.001, p.maxLife || .18), 0, 1);
      if (p.type === 'apex_control_turret_rocket') {
        const img = imageFor(CONTROL_TURRET_ASSETS.rocket, STATE.turretImages);
        const x = p.x;
        const y = p.y;
        localCtx.save();
        localCtx.globalAlpha = a;
        localCtx.translate(x, y);
        localCtx.rotate(p.angle || 0);
        if (img?.complete && img.naturalWidth) {
          perfCount('canvasDrawCalls');
          localCtx.drawImage(img, -34, -14, 68, 28);
        }
        else {
          localCtx.fillStyle = '#ffdf7b';
          localCtx.strokeStyle = '#211409';
          localCtx.lineWidth = 3;
          localCtx.beginPath();
          localCtx.moveTo(36,0);
          localCtx.lineTo(-24,-12);
          localCtx.lineTo(-18,0);
          localCtx.lineTo(-24,12);
          localCtx.closePath();
          perfCount('canvasDrawCalls');
          localCtx.fill();
          localCtx.stroke();
        }
        localCtx.restore();
        continue;
      }
      localCtx.save();
      localCtx.globalAlpha = a;
      localCtx.strokeStyle = '#ffdf7b';
      localCtx.lineWidth = 7;
      localCtx.beginPath();
      localCtx.moveTo(p.x1, p.y1);
      localCtx.lineTo(p.x2, p.y2);
      perfCount('canvasDrawCalls');
      localCtx.stroke();
      localCtx.strokeStyle = '#fff7ce';
      localCtx.lineWidth = 2;
      perfCount('canvasDrawCalls');
      localCtx.stroke();
      localCtx.restore();
    }
  }
  function drawNeutralTurrets(localCtx) {
    const baseImg = imageFor(CONTROL_TURRET_ASSETS.base, STATE.turretImages);
    const barrelImg = imageFor(CONTROL_TURRET_ASSETS.barrel, STATE.turretImages);
    const reloadImg = imageFor(CONTROL_TURRET_ASSETS.barrelReload, STATE.turretImages);
    for (const turret of STATE.neutralTurrets || []) {
      const vr = 68 * 1.12 * 1.3;
      const baseSize = vr * 2.0;
      const barrelSize = vr * 2.25;
      const barrel = (turret.cooldown || 0) < .25 ? barrelImg : (reloadImg || barrelImg);
      localCtx.save();
      localCtx.translate(turret.x, turret.y);
      if (baseImg?.complete && baseImg.naturalWidth) {
        perfCount('canvasDrawCalls');
        localCtx.drawImage(baseImg, -baseSize / 2, -baseSize / 2, baseSize, baseSize);
      } else {
        localCtx.fillStyle = turret.state?.startsWith('ACTIVE') ? 'rgba(255,210,90,.88)' : 'rgba(190,205,215,.62)';
        localCtx.strokeStyle = '#101820';
        localCtx.lineWidth = 7;
        localCtx.beginPath();
        localCtx.arc(0,0,46,0,TAU);
        perfCount('canvasDrawCalls');
        localCtx.fill();
        localCtx.stroke();
      }
      localCtx.rotate((turret.aimAngle || 0) + Math.PI);
      if (barrel?.complete && barrel.naturalWidth) {
        perfCount('canvasDrawCalls');
        localCtx.drawImage(barrel, -barrelSize / 2, -barrelSize / 2, barrelSize, barrelSize);
      } else {
        localCtx.fillStyle = '#101820';
        perfCount('canvasDrawCalls');
        localCtx.fillRect(-14,-48,28,88);
        localCtx.fillStyle = '#ffdf7b';
        perfCount('canvasDrawCalls');
        localCtx.fillRect(-9,-74,18,32);
      }
      localCtx.restore();
    }
  }
  function drawControlCreeps(localCtx) {
    for (const creep of STATE.creeps || []) {
      const pulse = creep.hitFlash > 0 ? 1.18 : 1;
      localCtx.save();
      localCtx.translate(creep.x, creep.y);
      localCtx.rotate(Math.PI / 4);
      localCtx.fillStyle = creep.hitFlash > 0 ? '#f7ffcb' : '#a7b7aa';
      localCtx.strokeStyle = '#20261f';
      localCtx.lineWidth = 4;
      localCtx.fillRect(-creep.radius * pulse, -creep.radius * pulse, creep.radius * 2 * pulse, creep.radius * 2 * pulse);
      localCtx.strokeRect(-creep.radius * pulse, -creep.radius * pulse, creep.radius * 2 * pulse, creep.radius * 2 * pulse);
      localCtx.restore();
      const w = 58, h = 7;
      localCtx.save();
      localCtx.fillStyle = 'rgba(0,0,0,.58)';
      localCtx.fillRect(creep.x - w / 2, creep.y - creep.radius - 20, w, h);
      localCtx.fillStyle = '#b6ff70';
      localCtx.fillRect(creep.x - w / 2, creep.y - creep.radius - 20, w * clamp(creep.hp / Math.max(1, creep.maxHp), 0, 1), h);
      localCtx.restore();
    }
  }
  function drawBossHpBars(localCtx) {
    for (const boss of Object.values(STATE.bosses || {})) {
      const f = boss?.fighter;
      if (!f || f.hp <= 0 || boss.dead) continue;
      const w = boss.champion === 'ICE' ? 160 : 130;
      const h = 12;
      const x = f.x - w / 2;
      const y = f.y - (f.radius || 80) - 34;
      localCtx.save();
      localCtx.fillStyle = 'rgba(0,0,0,.68)';
      localCtx.fillRect(x, y, w, h);
      localCtx.strokeStyle = 'rgba(255,255,255,.65)';
      localCtx.lineWidth = 2;
      localCtx.strokeRect(x, y, w, h);
      localCtx.fillStyle = boss.champion === 'ICE' ? '#bff7ff' : boss.champion === 'STRING' ? '#d9ccff' : '#ff9b66';
      localCtx.fillRect(x + 2, y + 2, (w - 4) * clamp(f.hp / Math.max(1, f.maxHp || boss.hp), 0, 1), h - 4);
      localCtx.fillStyle = '#ffffff';
      localCtx.font = '900 13px ui-monospace, monospace';
      localCtx.textAlign = 'center';
      localCtx.textBaseline = 'bottom';
      localCtx.fillText(boss.champion, f.x, y - 3);
      localCtx.restore();
    }
  }
  function drawUpgradeChoice(localCtx) {
    const owner = playerIdForIndex(STATE.localSlot);
    const level = levelState(owner);
    if (!level?.pending) return;
    localCtx.save();
    localCtx.setTransform(1,0,0,1,0,0);
    const w = 430, h = 92, x = (canvas.width - w) / 2, y = 26;
    localCtx.fillStyle = 'rgba(5,10,12,.86)';
    localCtx.strokeStyle = 'rgba(255,229,141,.78)';
    localCtx.lineWidth = 2;
    localCtx.fillRect(x, y, w, h);
    localCtx.strokeRect(x, y, w, h);
    localCtx.fillStyle = '#ffe58d';
    localCtx.font = '900 18px ui-monospace, monospace';
    localCtx.textAlign = 'center';
    localCtx.fillText(`LEVEL ${level.pendingLevel} UPGRADE`, x + w / 2, y + 18);
    localCtx.font = '800 14px ui-monospace, monospace';
    localCtx.fillStyle = '#eaffff';
    localCtx.fillText('H: +100 MAX HP        J: +20% BASE DAMAGE', x + w / 2, y + 52);
    localCtx.fillStyle = '#9cffad';
    localCtx.fillText(`Current: LV ${level.level} | HP +${level.hpUpgrades * 100} | DMG +${level.damageUpgrades * 20}%`, x + w / 2, y + 76);
    localCtx.restore();
  }
  function drawRespawnStatus(localCtx) {
    const owner = playerIdForIndex(STATE.localSlot);
    const life = lifecycleForPlayer(owner);
    if (!life || (!life.dead && !life.invulnerable)) return;
    localCtx.save();
    localCtx.setTransform(1,0,0,1,0,0);
    localCtx.textAlign = 'center';
    localCtx.textBaseline = 'top';
    if (life.dead) {
      localCtx.fillStyle = 'rgba(0,0,0,.62)';
      localCtx.fillRect(canvas.width / 2 - 145, canvas.height - 88, 290, 48);
      localCtx.fillStyle = '#ffe58d';
      localCtx.font = '900 18px ui-monospace, monospace';
      localCtx.fillText(`RESPAWN ${Math.ceil(life.respawnTimer || 0)}s`, canvas.width / 2, canvas.height - 78);
    } else if (life.invulnerable) {
      localCtx.fillStyle = 'rgba(191,247,255,.88)';
      localCtx.font = '900 15px ui-monospace, monospace';
      localCtx.fillText('INVULNERABLE', canvas.width / 2, canvas.height - 58);
    }
    localCtx.restore();
  }
  function drawCaptureCorner(localCtx, roomId, corner) {
    const zone = zoneById(CONTROL_CAPTURE_ZONES, roomId);
    if (zone) {
      drawPolygonDebug(localCtx, zone, 'rgba(255,229,141,.08)', '#ffe58d', roomId);
      return;
    }
    localCtx.save();
    localCtx.strokeStyle = '#ffe58d';
    localCtx.fillStyle = 'rgba(255,229,141,.08)';
    localCtx.lineWidth = 7;
    localCtx.beginPath();
    localCtx.moveTo(corner.originX, corner.originY);
    localCtx.arc(corner.originX, corner.originY, corner.radius, 0, TAU);
    localCtx.closePath();
    localCtx.fill();
    localCtx.stroke();
    localCtx.restore();
  }
  function drawDoorDebug(localCtx, rect) {
    localCtx.save();
    localCtx.fillStyle = 'rgba(70,255,170,.24)';
    localCtx.strokeStyle = '#70ffaa';
    localCtx.lineWidth = 5;
    localCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
    localCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    localCtx.restore();
  }
  function drawSpawnPoint(localCtx, id, point) {
    localCtx.save();
    localCtx.fillStyle = 'rgba(255,255,255,.12)';
    localCtx.strokeStyle = '#ffffff';
    localCtx.lineWidth = 4;
    localCtx.beginPath();
    localCtx.arc(point.x, point.y, SPAWN_NO_BUILD_RADIUS, 0, TAU);
    localCtx.fill();
    localCtx.stroke();
    localCtx.restore();
  }
  function drawControlMapDebug(localCtx) {
    const debug = STATE.debug || {};
    const dev = debug.mode === 'dev';
    if (debug.mode === 'off' && !debug.zones && !debug.walls) return;
    localCtx.save();
    if (debug.zones || dev) {
      for (const zone of activeZonesForDebug()) {
        const fill = zone.fallback ? 'rgba(70,180,255,.13)' : 'rgba(70,180,255,.08)';
        const stroke = zone.fallback ? 'rgba(110,235,255,.78)' : 'rgba(90,210,255,.48)';
        const label = `ACTIVE ${zone.zoneId || ''}${zone.fallback ? ' FALLBACK' : ''}`;
        zone.worldPoints ? drawPolygonDebug(localCtx, zone, fill, stroke, label) : drawRectDebug(localCtx, zone.bounds || zone, fill, stroke, label);
      }
      for (const [roomId, corner] of Object.entries(CAPTURE_CORNERS)) drawCaptureCorner(localCtx, roomId, corner);
    }
    if (debug.walls || dev) {
      for (const wall of WALL_SEGMENTS) {
        if (wall.worldPoints) drawPolygonDebug(localCtx, wall, 'rgba(25,20,18,.48)', 'rgba(255,95,70,.55)', '');
        else drawRectDebug(localCtx, wall, 'rgba(25,20,18,.48)', 'rgba(255,95,70,.55)', '');
      }
      for (const rect of doorRects(0)) drawDoorDebug(localCtx, rect);
      for (const [id, point] of Object.entries(SPAWN_POINTS)) drawSpawnPoint(localCtx, id, point);
    }
    if (debug.rings || dev) {
      for (const ring of CONTROL_CAPTURE_RINGS) {
        const img = imageFor(CONTROL_RING_ASSETS[ring.assetKey], STATE.captureRingImages);
        const rect = captureRingDrawRect(ring, img);
        drawRectDebug(localCtx, ring, 'rgba(255,255,255,.035)', 'rgba(255,255,255,.36)', ring.id);
        drawRectDebug(localCtx, rect, 'rgba(255,229,141,.05)', 'rgba(255,229,141,.72)', `${ring.id} ${img?.naturalWidth || '?'}x${img?.naturalHeight || '?'}`);
      }
    }
    if (debug.locks || dev) {
      for (const zone of lockedCaptureZoneShapes()) drawPolygonDebug(localCtx, zone, 'rgba(255,30,30,.22)', 'rgba(255,45,45,.9)', `LOCK ${zone.zoneId}`);
    }
    if (debug.bosses || dev) {
      for (const boss of Object.values(STATE.bosses || {})) {
        if (boss?.guard) drawSpawnPoint(localCtx, `${boss.champion} BOSS`, boss.guard);
      }
    }
    localCtx.restore();
  }
  function engineerStructures() {
    const result = [];
    for (const f of fighters || []) {
      if (f?.name !== 'ENGINEER') continue;
      const structures = window.APEX_ENGINEER?.ownerData?.(f)?.structures || [];
      result.push(...structures.filter(s => s && !s.dead && s.hp > 0));
    }
    return result;
  }
  function drawEngineerStructureDebug(localCtx) {
    const api = engineerApi();
    localCtx.save();
    for (const s of engineerStructures()) {
      const radius = api?.structureFootprint?.(s) || s.blockRadius || s.radius || 40;
      const visual = api?.structureVisualFootprint?.(s) || radius;
      localCtx.save();
      localCtx.strokeStyle = s.state === 'building' ? '#ffe58d' : '#7ff8ff';
      localCtx.fillStyle = s.state === 'building' ? 'rgba(255,229,141,.10)' : 'rgba(127,248,255,.10)';
      localCtx.lineWidth = 4;
      localCtx.beginPath();
      localCtx.arc(s.x, s.y, radius, 0, TAU);
      localCtx.fill();
      localCtx.stroke();
      localCtx.setLineDash([8,6]);
      localCtx.strokeStyle = 'rgba(255,255,255,.5)';
      localCtx.beginPath();
      localCtx.arc(s.x, s.y, visual, 0, TAU);
      localCtx.stroke();
      localCtx.setLineDash([]);
      localCtx.restore();
    }
    localCtx.restore();
  }
  function isPersistentTerrainProjectile(p) {
    return !!p && /ice_lane|ice_floor|toxic_puddle|toxic_trail|fire_pit|lava|paint|painter_stroke|web|trap|minefield/i.test(String(p.type || ''));
  }
  function persistentTerrainAllowed(p) {
    if (!p?.owner || !STATE.active) return true;
    const samples = [];
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) samples.push({x:p.x,y:p.y});
    if (Number.isFinite(p.x1) && Number.isFinite(p.y1)) samples.push({x:p.x1,y:p.y1});
    if (Number.isFinite(p.x2) && Number.isFinite(p.y2)) samples.push({x:p.x2,y:p.y2});
    if (samples.length >= 2) samples.push({x:(samples[0].x + samples[1].x) / 2, y:(samples[0].y + samples[1].y) / 2});
    return samples.every(point => canPlacePersistentTerrainAt(point, Math.min(48, p.radius || p.width || p.halfWidth || 24)).valid);
  }
  function enforceNoPersistentZones() {
    if (!Array.isArray(projectiles)) return;
    for (const p of projectiles) {
      if (isPersistentTerrainProjectile(p) && !persistentTerrainAllowed(p)) {
        p.life = 0;
        p._dead = true;
      }
    }
  }
  function drawTerritoryProgress(localCtx) {
    if (!STATE.territories) return;
    const debug = STATE.debug || {};
    if (debug.mode === 'off') return;
    localCtx.save();
    for (const territory of Object.values(STATE.territories)) {
      const point = captureTargetPoint(territory.roomId);
      const req = territory.owner ? CONTROL_CONFIG.stealSeconds : captureRequirement(territory, territory.actor);
      const value = territory.owner && territory.actor && territory.actor !== territory.owner ? territory.stealProgress : territory.captureProgress;
      const progress = clamp(value / Math.max(.001, req), 0, 1);
      if (progress <= 0 && !territory.contested && !territory.disabled) continue;
      const w = 260, h = 18;
      localCtx.fillStyle = 'rgba(0,0,0,.55)';
      localCtx.fillRect(point.x - w/2, point.y - 190, w, h);
      localCtx.fillStyle = territory.contested ? '#ffef8a' : territory.disabled ? '#ff6961' : '#7ff8ff';
      localCtx.fillRect(point.x - w/2, point.y - 190, w * progress, h);
      localCtx.strokeStyle = '#eaffff';
      localCtx.lineWidth = 3;
      localCtx.strokeRect(point.x - w/2, point.y - 190, w, h);
    }
    localCtx.restore();
  }
  function drawBotDebugWorld(localCtx) {
    const bot = STATE.bot;
    const p2 = fighters?.[1];
    const debug = STATE.debug || {};
    if (!(debug.botRoute || debug.mode === 'dev')) return;
    if (!bot || !p2) return;
    localCtx.save();
    if (bot.targetWaypoint) {
      localCtx.strokeStyle = '#b6ff70';
      localCtx.fillStyle = 'rgba(182,255,112,.18)';
      localCtx.lineWidth = 5;
      localCtx.beginPath();
      localCtx.arc(bot.targetWaypoint.x, bot.targetWaypoint.y, 38, 0, TAU);
      localCtx.fill();
      localCtx.stroke();
      localCtx.beginPath();
      localCtx.moveTo(p2.x,p2.y);
      localCtx.lineTo(bot.targetWaypoint.x,bot.targetWaypoint.y);
      localCtx.stroke();
    }
    if (bot.targetTerritory) {
      const target = captureTargetPoint(bot.targetTerritory);
      localCtx.strokeStyle = '#ffffff';
      localCtx.setLineDash([10,8]);
      localCtx.beginPath();
      localCtx.arc(target.x, target.y, 70, 0, TAU);
      localCtx.stroke();
      localCtx.setLineDash([]);
    }
    localCtx.restore();
  }
  const previousDrawControl = draw;
  draw = function() {
    if (!STATE.active) return previousDrawControl();
    const renderStart = perfNow();
    applyControlWorld();
    // Bosses and Control-specific systems can emit VFX after the main engine update.
    applyControlRenderBudget();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const view = computeControlCamera();
    window.__apexCameraView = view;
    ctx.save();
    window.__apexControlFastRender = true;
    try {
      ctx.translate(view.shakeX, view.shakeY);
      ctx.scale(view.zoom, view.zoom);
      ctx.translate(-view.worldX, -view.worldY);
      drawControlVisualMap(ctx);
      drawControlMapDebug(ctx);
      drawTerritoryProgress(ctx);
      drawBotDebugWorld(ctx);
      window.__apexRenderFrame = (window.__apexRenderFrame || 0) + 1;
      drawProjectiles(ctx);
      drawControlCustomProjectiles(ctx);
      drawControlCreeps(ctx);
      drawNeutralTurrets(ctx);
      if (STATE.debug?.structures || STATE.debug?.mode === 'dev') drawEngineerStructureDebug(ctx);
      for (const f of fighters) {
        if (f && f.hasStatus && f.hasStatus('scent')) {
          const lost = (f.maxHp - f.hp) / f.maxHp;
          const rr = Math.max(120, 1000 * lost);
          ctx.save();
          ctx.globalAlpha = .18; ctx.fillStyle = '#ff2020'; ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 5;
          ctx.setLineDash([20,14]); ctx.beginPath(); ctx.arc(f.x,f.y,rr,0,TAU); ctx.fill(); ctx.stroke();
          ctx.setLineDash([]); ctx.fillStyle = '#ffd0d0'; ctx.font = '900 18px monospace'; ctx.textAlign = 'center';
          ctx.fillText('BLOOD SCENT', f.x, f.y - rr - 12);
          ctx.restore();
        }
      }
      for (const s of shockwaves) { ctx.save(); ctx.globalAlpha=s.alpha; ctx.strokeStyle=s.color; ctx.lineWidth=7; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,TAU); ctx.stroke(); ctx.restore(); }
      for (const p of particles) p.draw(ctx);
      if (fighters[0]) fighters[0].draw(ctx);
      if (fighters[1]) fighters[1].draw(ctx);
      for (const f of (fighters || []).slice(2)) if (f && f.hp > 0) f.draw(ctx);
      drawBossHpBars(ctx);
      for (const f of fighters) {
        if (f && f.name === 'SNIPER' && f.data && f.data.aim > 0) {
          const enemy = fighters.find(q => q.id !== f.id);
          if (enemy) {
            ctx.save(); ctx.globalAlpha=.9; ctx.strokeStyle='rgba(255,45,45,.95)'; ctx.lineWidth=2;
            ctx.beginPath(); ctx.moveTo(f.x,f.y); ctx.lineTo(enemy.x,enemy.y); ctx.stroke();
            ctx.strokeStyle='rgba(255,45,45,.95)'; ctx.lineWidth=3; ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius+16, 0, TAU);
            ctx.moveTo(enemy.x-(enemy.radius+28), enemy.y); ctx.lineTo(enemy.x+(enemy.radius+28), enemy.y);
            ctx.moveTo(enemy.x, enemy.y-(enemy.radius+28)); ctx.lineTo(enemy.x, enemy.y+(enemy.radius+28)); ctx.stroke();
            ctx.restore();
          }
        }
      }
      for (const t of floatingTexts) t.draw(ctx);
      if (arenaFlash.a > 0) { ctx.fillStyle=`rgba(${arenaFlash.r},${arenaFlash.g},${arenaFlash.b},${arenaFlash.a})`; ctx.fillRect(0,0,worldWidth(),worldHeight()); }
    } finally {
      ctx.restore();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
      window.__apexControlFastRender = false;
    }
    drawDebugPanel(ctx, view);
    drawRespawnStatus(ctx);
    drawUpgradeChoice(ctx);
    const renderMs = perfNow() - renderStart;
    PERF.renderTimeSum += renderMs;
    PERF.renderTimeMax = Math.max(PERF.renderTimeMax || 0, renderMs);
    if (STATE.active) perfFrameEnd();
  };
  const previousUpdateManualLab = update;
  update = function(dt) {
    if (STATE.active) perfFrameStart();
    const updateStart = perfNow();
    const beforePositions = STATE.active
      ? (fighters || []).map(f => f ? {id:f.id, x:f.x, y:f.y} : null)
      : null;
    if (STATE.active) {
      updateBotController(dt);
      const p2 = fighters?.[1];
      if (p2 && p2.data?.manualController !== remoteController && remoteInput.moveVector && (remoteInput.moveVector.x || remoteInput.moveVector.y)) {
        p2.setDir(remoteInput.moveVector.x, remoteInput.moveVector.y);
      }
    }
    const result = previousUpdateManualLab(dt);
    if (STATE.active) {
      applyControlRenderBudget();
      applyBotFallbackMovement(dt, beforePositions?.[1]);
      const projectileStart = perfNow();
      enforceProjectileWallBlocking(dt);
      enforceKatanaWaveWalls(dt);
      const projectileMs = perfNow() - projectileStart;
      PERF.projectileUpdateTimeSum += projectileMs;
      updateLifecycle(dt);
      updateControlBosses(dt);
      updateNeutralTurrets(dt);
      updateControlTurretRockets(dt);
      updateControlCreeps(dt);
      const collisionStart = perfNow();
      for (let i = 0; i < (fighters || []).length; i += 1) {
        enforceMovementSegmentWall(fighters[i], beforePositions?.[i]);
        resolveControlMovement(fighters[i], beforePositions?.[i]);
      }
      PERF.collisionTimeSum += perfNow() - collisionStart;
      enforceNoPersistentZones();
      updateTerritories(dt);
      updateTerritoryEffects(dt);
      updateDominance(dt);
      updateHud();
      window.dispatchEvent(new CustomEvent('apex-manual-lab-input-frame', { detail:getInputSnapshot() }));
      input.endFrame();
      remoteInput.endFrame();
      const updateMs = perfNow() - updateStart;
      PERF.updateTimeSum += updateMs;
      PERF.updateTimeMax = Math.max(PERF.updateTimeMax || 0, updateMs);
      PERF.vfxUpdateTimeSum += window.APEX_KATANA?.state?.perf?.vfxUpdateMs || 0;
    }
    return result;
  };

  function getInputSnapshot() {
    const actionValues = new Set(Object.values(ACTIONS));
    return {
      seq:(input.seq = (input.seq || 0) + 1),
      held:[...input.held].filter(key => actionValues.has(key)),
      pressed:[...input.pressed].filter(key => actionValues.has(key)),
      aimPoint:{...input.aimPoint},
      pointerInside:input.pointerInside,
      moveVector:{...input.moveVector}
    };
  }
  function getMatchSnapshot() {
    return {
      t:matchClock,
      gameState,
      localSlot:STATE.localSlot,
      fighters:(fighters || []).map(f => f ? ({
        id:f.id,name:f.name,x:f.x,y:f.y,hp:f.hp,maxHp:f.maxHp,dir:{...f.dir},
        damageDone:f.damageDone,dead:f.hp<=0
      }) : null)
    };
  }
  function applyMatchSnapshot(snapshot, options={}) {
    if (!snapshot?.fighters || !fighters?.length) return false;
    const protectLocal = options.protectLocal !== false;
    snapshot.fighters.forEach((src, index) => {
      const f = fighters[index];
      if (!src || !f) return;
      const isLocal = protectLocal && index === STATE.localSlot;
      if (!isLocal) {
        if (Number.isFinite(src.x)) f.x = clampWorldX(src.x, f.radius);
        if (Number.isFinite(src.y)) f.y = clampWorldY(src.y, f.radius);
        if (src.dir && Number.isFinite(src.dir.x) && Number.isFinite(src.dir.y)) f.setDir(src.dir.x, src.dir.y);
      }
      if (Number.isFinite(src.hp)) f.hp = clamp(src.hp, 0, f.maxHp || src.maxHp || 1000);
      if (Number.isFinite(src.damageDone)) f.damageDone = src.damageDone;
    });
    updateHUD();
    return true;
  }
  function fighterByName(name) {
    return (window.apexFighterTypes || []).find(ft => ft.name === name) || null;
  }
  function startNetworkMatch(p1Name, p2Name, slot=0, room=null) {
    const ft1 = typeof p1Name === 'string' ? fighterByName(p1Name) : p1Name;
    const ft2 = typeof p2Name === 'string' ? fighterByName(p2Name) : p2Name;
    if (!ft1 || !ft2) return false;
    STATE.room = room || STATE.room || null;
    STATE.localSlot = slot === 1 ? 1 : 0;
    STATE.remoteSlot = STATE.localSlot === 0 ? 1 : 0;
    startSpecificMatch(ft1, ft2, {countdown:false,tournament:false,trial:false,manualLab:true,localSlot:STATE.localSlot,remoteSlot:STATE.remoteSlot,networkRoom:STATE.room});
    return true;
  }
  function applyRemoteInputSnapshot(snapshot) {
    remoteInput.applySnapshot(snapshot);
  }

  const previousStartSpecificManualLab = startSpecificMatch;
  startSpecificMatch = function(ft1, ft2, opts={}) {
    const manual = opts.manualLab === true;
    if (!manual) deactivate(true);
    else applyControlWorld();
    const result = previousStartSpecificManualLab(ft1, ft2, opts);
    if (manual) activate(ft1,ft2,opts);
    return result;
  };
  const previousStartMatchManualLab = startMatch;
  startMatch = function() {
    if (!STATE.selecting) return previousStartMatchManualLab();
    if (!p1Selection || !p2Selection) return;
    return startSpecificMatch(p1Selection,p2Selection,{countdown:false,tournament:false,manualLab:true});
  };
  const previousGoToSelectManualLab = goToSelect;
  goToSelect = function() {
    deactivate(true);
    return previousGoToSelectManualLab();
  };
  function goToManualLabSelect() {
    deactivate(false);
    previousGoToSelectManualLab();
    STATE.selecting = true;
    document.body.classList.add('manual-lab-select');
    const title = document.getElementById('select-title');
    if (title) { title.textContent = 'APEX CONTROL · TERRITORY MODE'; title.style.color = '#7ff8ff'; }
  }
  const previousGoToMenuManualLab = goToMenu;
  goToMenu = function() {
    deactivate(true);
    return previousGoToMenuManualLab();
  };
  const previousEndMatchManualLab = endMatch;
  endMatch = function() {
    if (STATE.active) releaseHeldInput();
    const result = previousEndMatchManualLab();
    deactivate(true);
    return result;
  };
  const previousRestartWindow = window.restartAutoBattle;
  const restartManualAware = function() {
    if (STATE.active && STATE.lastConfig) {
      releaseHeldInput();
      const cfg = STATE.lastConfig;
      return startSpecificMatch(cfg.ft1,cfg.ft2,{...cfg.opts,manualLab:true,countdown:false,tournament:false,trial:false});
    }
    return previousRestartWindow?.();
  };
  restartAutoBattle = restartManualAware;
  window.restartAutoBattle = restartManualAware;
  const previousExitWindow = window.exitAutoBattle;
  const exitManualAware = function() {
    if (STATE.active || STATE.selecting) return goToMenu();
    return previousExitWindow?.();
  };
  exitAutoBattle = exitManualAware;
  window.exitAutoBattle = exitManualAware;

  Object.assign(STATE, {
    setLocalSlot(slot) { STATE.localSlot = slot === 1 ? 1 : 0; attachController(); },
    setRemoteSlot(slot) { STATE.remoteSlot = slot === 0 || slot === 1 ? slot : null; attachController(); },
    applyRemoteInput:applyRemoteInputSnapshot,
    getInputSnapshot,
    getMatchSnapshot,
    applyMatchSnapshot,
    startNetworkMatch,
    releaseHeldInput
  });
  Object.assign(window.apexReactBridge || {}, {goToManualLabSelect,startMatch,startSpecificMatch,goToSelect,goToMenu,restartAutoBattle:restartManualAware,exitAutoBattle:exitManualAware});
  Object.assign(window, window.apexReactBridge || {});
  window.goToManualLabSelect = goToManualLabSelect;
  window.startMatch = startMatch;
  window.startSpecificMatch = startSpecificMatch;
  window.goToSelect = goToSelect;
  window.goToMenu = goToMenu;
  window.APEX_MANUAL_LAB_READY = true;
})();
