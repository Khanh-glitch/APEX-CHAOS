// ===== UNIVERSAL FIGHTER POSE LOCK: stun, freeze and cinematic stop-motion =====
(function APEX_UNIVERSAL_FIGHTER_POSE_LOCK(){
  if (window.__apexUniversalFighterPoseLock) return;
  window.__apexUniversalFighterPoseLock = true;

  function globalStopMotionActive() {
    if (typeof hitStop === 'number' && hitStop > 0) return true;
    if (typeof timeScale === 'number' && timeScale < .12) return true;
    if (performance.now() < (window.__apexNinjaStopMotionUntil || 0)) return true;
    if (performance.now() < (window.__apexVisualStopMotionUntil || 0)) return true;
    return (fighters || []).some(f => f?.name === 'GALAXY' && (f.data?.galaxyDivine?.worldFreeze || 0) > 0);
  }
  function posePaused(f) {
    return !!(f?.hasStatus?.('stun') || f?.hasStatus?.('freeze') || globalStopMotionActive());
  }
  function ensurePoseLock(f) {
    f.data ||= {};
    if (!f.data.apexPoseLock) {
      f.data.apexPoseLock = {
        dir:{x:f.dir?.x || 1,y:f.dir?.y || 0},
        visualDir:f.data?.katana?.visualDir ? {...f.data.katana.visualDir} : null,
        frameClock:typeof matchClock === 'number' ? matchClock : 0,
        canvas:null
      };
      const cache = f.data.apexControlPoseCache;
      if (cache?.canvas && f.name === 'ENGINEER' && window.APEX_CONTROL_BATTLE_WALLS?.active?.()) {
        f.data.apexPoseLock.canvas = cache.canvas;
        f.data.apexPoseLock.offsetX = cache.offsetX;
        f.data.apexPoseLock.offsetY = cache.offsetY;
        f.data.apexPoseLock.size = cache.size;
        f.data.apexPoseLock.cached = true;
      }
    }
    return f.data.apexPoseLock;
  }
  function captureLocalPose(f, lock) {
    if (lock.canvas || !f?.type?.draw || typeof document === 'undefined') return;
    try {
      const controlPoseLock = !!window.APEX_CONTROL_BATTLE_WALLS?.active?.();
      const size = controlPoseLock ? 320 : 1024;
      const useOffscreenPose = controlPoseLock && typeof OffscreenCanvas !== 'undefined';
      const off = useOffscreenPose ? new OffscreenCanvas(size, size) : document.createElement('canvas');
      if (!useOffscreenPose) {
        off.width = size;
        off.height = size;
      }
      const c = off.getContext('2d', {willReadFrequently:!controlPoseLock});
      c.translate(size / 2, size / 2);
      f.type.draw(c, f);
      if (controlPoseLock) {
        lock.canvas = useOffscreenPose && typeof off.transferToImageBitmap === 'function'
          ? off.transferToImageBitmap()
          : off;
        lock.offsetX = -size / 2;
        lock.offsetY = -size / 2;
        lock.size = size;
        return;
      }
      const image = c.getImageData(0, 0, size, size);
      const data = image.data;
      let minX = size, minY = size, maxX = -1, maxY = -1;
      for (let y = 0; y < size; y += 1) {
        const row = y * size * 4;
        for (let x = 0; x < size; x += 1) {
          if (data[row + x * 4 + 3] <= 2) continue;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX >= minX && maxY >= minY) {
        const pad = 18;
        minX = Math.max(0, minX - pad);
        minY = Math.max(0, minY - pad);
        maxX = Math.min(size - 1, maxX + pad);
        maxY = Math.min(size - 1, maxY + pad);
        const trimmed = document.createElement('canvas');
        trimmed.width = maxX - minX + 1;
        trimmed.height = maxY - minY + 1;
        trimmed.getContext('2d').putImageData(c.getImageData(minX, minY, trimmed.width, trimmed.height), 0, 0);
        lock.canvas = trimmed;
        lock.offsetX = minX - size / 2;
        lock.offsetY = minY - size / 2;
      } else {
        lock.canvas = off;
        lock.offsetX = -size / 2;
        lock.offsetY = -size / 2;
      }
      lock.size = size;
    } catch (error) {
      lock.canvas = null;
    }
  }
  function closePoseSource(source) {
    try {
      if (source && typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap && typeof source.close === 'function') source.close();
    } catch (error) {}
  }
  function shouldCacheControlPose(f) {
    return !!(f?.name === 'ENGINEER'
      && f.hp > 0
      && window.APEX_CONTROL_BATTLE_WALLS?.active?.()
      && !posePaused(f));
  }
  function refreshControlPoseCache(f) {
    if (!shouldCacheControlPose(f)) return;
    f.data ||= {};
    const lock = {};
    captureLocalPose(f, lock);
    if (!lock.canvas) return;
    const previous = f.data.apexControlPoseCache;
    if (previous?.canvas && previous.canvas !== lock.canvas) closePoseSource(previous.canvas);
    f.data.apexControlPoseCache = {
      canvas:lock.canvas,
      offsetX:lock.offsetX,
      offsetY:lock.offsetY,
      size:lock.size,
      capturedAt:performance.now()
    };
  }
  function scheduleControlPoseCache(f) {
    if (!shouldCacheControlPose(f)) return;
    f.data ||= {};
    const now = performance.now();
    const cache = f.data.apexControlPoseCache;
    if (f.data.apexControlPoseCachePending) return;
    if (cache?.canvas && now - (cache.capturedAt || 0) < 700) return;
    f.data.apexControlPoseCachePending = true;
    const run = () => {
      f.data.apexControlPoseCachePending = false;
      refreshControlPoseCache(f);
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, {timeout:500});
    else setTimeout(run, 80);
  }

  const previousApplyStatusPoseLock = Fighter.prototype.applyStatus;
  Fighter.prototype.applyStatus = function(name, duration, data={}) {
    if ((name === 'stun' || name === 'freeze') && duration > 0) ensurePoseLock(this);
    return previousApplyStatusPoseLock.call(this, name, duration, data);
  };

  const previousSetDirPoseLock = Fighter.prototype.setDir;
  Fighter.prototype.setDir = function(x, y) {
    if (this.data?.apexPoseLock && posePaused(this)) return;
    return previousSetDirPoseLock.call(this, x, y);
  };

  const previousDrawPoseLock = Fighter.prototype.draw;
  Fighter.prototype.draw = function(ctx) {
    const paused = posePaused(this);
    if (!paused) {
      if (this.data?.apexPoseLock) delete this.data.apexPoseLock;
      const result = previousDrawPoseLock.call(this, ctx);
      scheduleControlPoseCache(this);
      return result;
    }
    const lock = ensurePoseLock(this);
    captureLocalPose(this, lock);
    const actualDir = this.dir;
    const actualVisualDir = this.data?.katana?.visualDir;
    const originalTypeDraw = this.type?.draw;
    const originalClock = typeof matchClock === 'number' ? matchClock : null;
    this.dir = {x:lock.dir.x,y:lock.dir.y};
    if (lock.visualDir && this.data?.katana) this.data.katana.visualDir = {...lock.visualDir};
    if (originalClock !== null) matchClock = lock.frameClock;
    if (lock.canvas && this.type) {
      this.type.draw = function(localCtx) {
        localCtx.drawImage(lock.canvas, lock.offsetX ?? -lock.size / 2, lock.offsetY ?? -lock.size / 2);
      };
    }
    try {
      return previousDrawPoseLock.call(this, ctx);
    } finally {
      if (this.type) this.type.draw = originalTypeDraw;
      this.dir = actualDir;
      if (this.data?.katana) this.data.katana.visualDir = actualVisualDir;
      if (originalClock !== null) matchClock = originalClock;
    }
  };

  window.__apexUniversalVisualStopMotionActive = globalStopMotionActive;
})();
